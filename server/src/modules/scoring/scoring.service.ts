import type { Match, ScoreEvent } from '@prisma/client';
import { matchTransaction } from '../../database/transaction.js';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import { ScoringRulesService } from './scoring-rules.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { ResultsService } from '../results/results.service.js';
import {
  StartMatchDto,
  PauseMatchDto,
  ResumeMatchDto,
  EndMatchDto,
  RecordScoreEventDto,
  ReverseScoreEventDto,
  UpdateScoreManualDto,
} from './dto/scoring.dto.js';

@Injectable()
export class ScoringService {
  private transactionActive = false;

  private mutate<T>(
    matchId: string,
    run: (service: ScoringService) => Promise<T>,
  ): Promise<T> {
    return matchTransaction(
      this.prisma,
      matchId,
      this.realtimeService,
      async (tx, realtime) => {
        const results = this.resultsService
          ? new ResultsService(tx, this.rbacService, realtime)
          : undefined;
        if (results) results.transactionActive = true;
        const service = new ScoringService(
          tx,
          this.rbacService,
          this.rulesService,
          realtime,
          results,
        );
        service.transactionActive = true;
        return run(service);
      },
    );
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
    private readonly rulesService: ScoringRulesService,
    private readonly realtimeService?: RealtimeService,
    private readonly resultsService?: ResultsService,
  ) {}

  // ===================================
  // HELPER: AUTHORIZATION & SCOPE VERIFICATION
  // ===================================

  /**
   * Verifies that the user has authority to modify the score/state of a match.
   * Authority is granted if:
   * 1. The user has 'score.update' permission scoped to the match's sport (or global).
   * 2. The user is an assigned official (SCOREKEEPER/REFEREE) on this specific match.
   */
  async verifyScoringAuthority(matchId: string, userId: string): Promise<any> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: {
          include: {
            sport: true,
          },
        },
        officials: true,
        teamA: true,
        teamB: true,
      },
    });

    if (!match) {
      throw new NotFoundException(`Match with id "${matchId}" not found`);
    }

    const sportId = match.tournament?.sportId;

    // Check RBAC permission
    const hasRbac = await this.rbacService.hasPermission(
      userId,
      'score.update',
      {
        sportId,
        eventId: match.tournament?.eventId,
      },
    );

    if (hasRbac) {
      return match;
    }

    // Check if user is an assigned official for this match
    const isAssignedOfficial = match.officials.some(
      (off) => off.userId === userId,
    );

    if (isAssignedOfficial) {
      return match;
    }

    throw new ForbiddenException(
      'You are not authorized to score or modify this match',
    );
  }

  // ===================================
  // MATCH LIFECYCLE MANAGEMENT
  // ===================================

  async startMatch(
    matchId: string,
    dto: StartMatchDto,
    userId: string,
    ipAddress?: string,
  ): Promise<Match> {
    if (!this.transactionActive)
      return this.mutate(matchId, (service) =>
        service.startMatch(matchId, dto, userId, ipAddress),
      );
    const match = await this.verifyScoringAuthority(matchId, userId);

    if (match.scoringMode === 'RESULT_ONLY')
      throw new BadRequestException(
        'This fixture uses results-only entry. Submit its final result instead of starting live scoring.',
      );
    if (!['SCHEDULED', 'READY', 'RESCHEDULED', 'LIVE'].includes(match.status)) {
      throw new BadRequestException('Cannot start an already completed match');
    }

    if (match.status === 'LIVE') {
      return match; // Already live
    }

    if (!match.teamAId || !match.teamBId)
      throw new BadRequestException(
        'Both teams must be determined before starting the match',
      );

    const startTime = match.actualStartTime || new Date();
    // Seed the sport-specific scoreDetails shape the first time a match goes
    // live, so the scorer UI and every subsequent event have a well-formed
    // starting state instead of an empty/generic one.
    const needsInitialState = !match.scoreDetails;
    const initial = needsInitialState
      ? this.rulesService.initialState({
          sportName: match.tournament?.sport?.name,
          teamAId: match.teamAId,
          teamBId: match.teamBId,
          rulesJson: match.tournament?.rulesJson as Record<
            string,
            unknown
          > | null,
        })
      : null;
    const currentPeriod =
      dto.period || match.currentPeriod || initial?.currentPeriod || null;

    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'LIVE',
        actualStartTime: startTime,
        currentPeriod,
        ...(needsInitialState
          ? { scoreDetails: initial!.scoreDetails as any }
          : {}),
      },
      include: {
        teamA: true,
        teamB: true,
        venue: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'match.start',
        resource: 'Match',
        resourceId: matchId,
        previousState: { status: match.status },
        newState: { status: 'LIVE', actualStartTime: startTime, currentPeriod },
        ipAddress,
      },
    });

    this.realtimeService?.emitMatchStatusUpdated(matchId, {
      matchId,
      status: 'LIVE',
      currentPeriod,
      actualStartTime: startTime,
    });

    return updated;
  }

  async pauseMatch(
    matchId: string,
    dto: PauseMatchDto,
    userId: string,
    ipAddress?: string,
  ): Promise<Match> {
    if (!this.transactionActive)
      return this.mutate(matchId, (service) =>
        service.pauseMatch(matchId, dto, userId, ipAddress),
      );
    const match = await this.verifyScoringAuthority(matchId, userId);

    if (match.status !== 'LIVE') {
      throw new BadRequestException(
        `Cannot pause match in "${match.status}" status. Match must be LIVE.`,
      );
    }

    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'PAUSED',
        currentPeriod: dto.period || match.currentPeriod,
      },
      include: {
        teamA: true,
        teamB: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'match.pause',
        resource: 'Match',
        resourceId: matchId,
        previousState: { status: match.status },
        newState: { status: 'PAUSED', currentPeriod: updated.currentPeriod },
        reason: dto.reason,
        ipAddress,
      },
    });

    this.realtimeService?.emitMatchStatusUpdated(matchId, {
      matchId,
      status: 'PAUSED',
      currentPeriod: updated.currentPeriod,
    });

    return updated;
  }

  async resumeMatch(
    matchId: string,
    dto: ResumeMatchDto,
    userId: string,
    ipAddress?: string,
  ): Promise<Match> {
    if (!this.transactionActive)
      return this.mutate(matchId, (service) =>
        service.resumeMatch(matchId, dto, userId, ipAddress),
      );
    const match = await this.verifyScoringAuthority(matchId, userId);

    if (match.status !== 'PAUSED') {
      throw new BadRequestException(
        `Cannot resume match in "${match.status}" status. Match must be PAUSED.`,
      );
    }

    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'LIVE',
        currentPeriod: dto.period || match.currentPeriod,
      },
      include: {
        teamA: true,
        teamB: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'match.resume',
        resource: 'Match',
        resourceId: matchId,
        previousState: { status: match.status },
        newState: { status: 'LIVE', currentPeriod: updated.currentPeriod },
        ipAddress,
      },
    });

    this.realtimeService?.emitMatchStatusUpdated(matchId, {
      matchId,
      status: 'LIVE',
      currentPeriod: updated.currentPeriod,
    });

    return updated;
  }

  async endMatch(
    matchId: string,
    dto: EndMatchDto,
    userId: string,
    ipAddress?: string,
  ): Promise<Match> {
    if (!this.transactionActive)
      return this.mutate(matchId, (service) =>
        service.endMatch(matchId, dto, userId, ipAddress),
      );
    const match = await this.verifyScoringAuthority(matchId, userId);

    if (match.status === 'COMPLETED') {
      return match;
    }

    if (match.status !== 'LIVE' && match.status !== 'PAUSED') {
      throw new BadRequestException(
        `Cannot end match in "${match.status}" status. Match must be LIVE or PAUSED.`,
      );
    }

    // Determine winner team. Prefer whatever the sport's scoring engine has
    // already decided from the live event history (match.winnerTeamId) —
    // for some sports a higher flat teamAScore/teamBScore does not mean that
    // side won (e.g. athletics track events, where a *lower* recorded time is
    // better). Only fall back to a raw score comparison for a match that was
    // never live-scored through an engine at all.
    let winnerTeamId: string | null =
      dto.winnerTeamId ?? match.winnerTeamId ?? null;
    if (!winnerTeamId && !match.scoreDetails) {
      const scoreA = match.teamAScore ?? 0;
      const scoreB = match.teamBScore ?? 0;
      if (scoreA > scoreB) winnerTeamId = match.teamAId;
      else if (scoreB > scoreA) winnerTeamId = match.teamBId;
      else winnerTeamId = null; // Draw
    }

    if (winnerTeamId && ![match.teamAId, match.teamBId].includes(winnerTeamId))
      throw new BadRequestException('Winner must be a team in this match');
    const endTime = match.actualEndTime || new Date();

    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'COMPLETED',
        actualEndTime: endTime,
        winnerTeamId,
        scoreDetails: dto.scoreDetails || match.scoreDetails,
      },
      include: {
        teamA: true,
        teamB: true,
        winnerTeam: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'match.end',
        resource: 'Match',
        resourceId: matchId,
        previousState: { status: match.status },
        newState: {
          status: 'COMPLETED',
          actualEndTime: endTime,
          winnerTeamId,
        },
        reason: dto.notes,
        ipAddress,
      },
    });

    this.realtimeService?.emitMatchStatusUpdated(matchId, {
      matchId,
      status: 'COMPLETED',
      winnerTeamId,
      actualEndTime: endTime,
      teamAScore: updated.teamAScore,
      teamBScore: updated.teamBScore,
    });

    // Ending a match already tells us the final score and winner — submit the
    // result automatically instead of making the scorekeeper visit a separate
    // results page to re-enter the same information. If the acting user lacks
    // result.submit authority (e.g. a scorekeeper who isn't an assigned
    // official), this silently no-ops and a coordinator submits it manually
    // as a fallback — ending the match itself must never fail because of this.
    if (this.resultsService) {
      try {
        await this.resultsService.submitResult(
          matchId,
          {
            winnerTeamId: winnerTeamId ?? undefined,
            finalScoreA: updated.teamAScore ?? undefined,
            finalScoreB: updated.teamBScore ?? undefined,
          },
          userId,
          ipAddress,
        );
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
      }
    }

    return updated;
  }

  // ===================================
  // SCORE EVENT RECORDING & REVERSALS
  // ===================================

  async recordScoreEvent(
    matchId: string,
    dto: RecordScoreEventDto,
    userId: string,
    ipAddress?: string,
  ): Promise<{ event: ScoreEvent; match: Match }> {
    if (!this.transactionActive)
      return this.mutate(matchId, (service) =>
        service.recordScoreEvent(matchId, dto, userId, ipAddress),
      );
    const match = await this.verifyScoringAuthority(matchId, userId);

    if (match.status !== 'LIVE') {
      throw new BadRequestException(
        `Cannot add score event: Match is currently "${match.status}". It must be LIVE.`,
      );
    }

    if (dto.requestId) {
      const previous = await this.prisma.scoreEvent.findUnique({
        where: { matchId_requestId: { matchId, requestId: dto.requestId } },
      });
      if (previous) return { event: previous, match };
    }
    if (dto.participantId) {
      const member = await this.prisma.teamMember.findFirst({
        where: {
          participantId: dto.participantId,
          teamId: dto.teamId || {
            in: [match.teamAId, match.teamBId].filter(Boolean),
          },
        },
      });
      if (!member)
        throw new BadRequestException('Participant is not on the scoring team');
    }
    // Next sequence number
    const eventCount = await this.prisma.scoreEvent.count({
      where: { matchId },
    });
    const sequenceNumber = eventCount + 1;

    // Apply the event through this sport's engine to get the full new
    // scoreboard state (score, structured scoreDetails, period, and — once
    // the engine's own win condition is met — the winner).
    const priorState = match.scoreDetails
      ? {
          teamAScore: match.teamAScore ?? 0,
          teamBScore: match.teamBScore ?? 0,
          scoreDetails: match.scoreDetails as Record<string, unknown>,
          currentPeriod: match.currentPeriod,
          winnerTeamId: match.winnerTeamId,
          isComplete: false,
        }
      : null;
    const newState = this.rulesService.applyEvent({
      sportName: match.tournament?.sport?.name,
      teamAId: match.teamAId,
      teamBId: match.teamBId,
      rulesJson: match.tournament?.rulesJson as Record<string, unknown> | null,
      currentState: priorState,
      event: {
        eventType: dto.eventType,
        teamId: dto.teamId,
        participantId: dto.participantId,
        points: dto.points,
        metadata: dto.metadata,
      },
    });

    const creditedTeamId =
      newState.teamAScore !== (priorState?.teamAScore ?? 0)
        ? match.teamAId
        : newState.teamBScore !== (priorState?.teamBScore ?? 0)
          ? match.teamBId
          : dto.teamId || null;
    const pointsAwarded = Math.max(
      newState.teamAScore - (priorState?.teamAScore ?? 0),
      newState.teamBScore - (priorState?.teamBScore ?? 0),
      0,
    );

    // Persist score event and update match in transaction
    const createdEvent = await this.prisma.scoreEvent.create({
      data: {
        matchId,
        sequenceNumber,
        requestId: dto.requestId,
        teamId: creditedTeamId,
        participantId: dto.participantId,
        eventType: dto.eventType.toUpperCase(),
        points: pointsAwarded,
        metadata: dto.metadata,
        createdBy: userId,
      },
      include: {
        team: { select: { id: true, name: true } },
        participant: { select: { id: true, name: true } },
      },
    });
    const updatedMatch = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        teamAScore: newState.teamAScore,
        teamBScore: newState.teamBScore,
        currentPeriod: dto.period || newState.currentPeriod,
        scoreDetails: newState.scoreDetails as any,
        winnerTeamId: newState.winnerTeamId ?? match.winnerTeamId,
      },
      include: {
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'score.event.create',
        resource: 'ScoreEvent',
        resourceId: createdEvent.id,
        previousState: {
          teamAScore: match.teamAScore,
          teamBScore: match.teamBScore,
        },
        newState: {
          teamAScore: newState.teamAScore,
          teamBScore: newState.teamBScore,
          scoreEventId: createdEvent.id,
          eventType: createdEvent.eventType,
          points: createdEvent.points,
        },
        ipAddress,
      },
    });

    this.realtimeService?.emitMatchScoreUpdated(matchId, {
      matchId,
      teamAScore: updatedMatch.teamAScore,
      teamBScore: updatedMatch.teamBScore,
      currentPeriod: updatedMatch.currentPeriod,
      event: createdEvent,
    });

    return {
      event: createdEvent,
      match: updatedMatch,
    };
  }

  async reverseScoreEvent(
    matchId: string,
    eventId: string,
    dto: ReverseScoreEventDto,
    userId: string,
    ipAddress?: string,
  ): Promise<{ reversedEvent: ScoreEvent; match: Match }> {
    if (!this.transactionActive)
      return this.mutate(matchId, (service) =>
        service.reverseScoreEvent(matchId, eventId, dto, userId, ipAddress),
      );
    const match = await this.verifyScoringAuthority(matchId, userId);
    if (!['LIVE', 'PAUSED'].includes(match.status))
      throw new BadRequestException('Only active matches can be corrected');
    if (!dto.reason?.trim())
      throw new BadRequestException('A correction reason is required');

    const event = await this.prisma.scoreEvent.findUnique({
      where: { id: eventId },
    });

    if (!event || event.matchId !== matchId) {
      throw new NotFoundException(
        `ScoreEvent with id "${eventId}" not found on match "${matchId}"`,
      );
    }

    if (event.isReversed) {
      throw new BadRequestException('This score event is already reversed');
    }

    // Mark reversed
    const reversedEvent = await this.prisma.scoreEvent.update({
      where: { id: eventId },
      data: {
        isReversed: true,
        reversalReason: dto.reason,
        reversedAt: new Date(),
        reversedBy: userId,
      },
    });

    // Replay the full (still-valid) event history from scratch through this
    // sport's engine rather than patching the flat score/wicket-count by
    // hand — this is the only way a structured state (overs, sets, periods)
    // stays consistent after removing an event from the middle of the timeline.
    const allEvents = await this.prisma.scoreEvent.findMany({
      where: { matchId },
      orderBy: { sequenceNumber: 'asc' },
    });
    const recalculated = this.rulesService.recalculateMatch({
      sportName: match.tournament?.sport?.name,
      teamAId: match.teamAId,
      teamBId: match.teamBId,
      rulesJson: match.tournament?.rulesJson as Record<string, unknown> | null,
      events: allEvents.map((e) => ({
        eventType: e.eventType,
        teamId: e.teamId,
        participantId: e.participantId,
        points: e.points,
        metadata: e.metadata,
        isReversed: e.id === eventId ? true : e.isReversed,
      })),
    });
    const updatedMatch = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        teamAScore: recalculated.teamAScore,
        teamBScore: recalculated.teamBScore,
        currentPeriod: recalculated.currentPeriod,
        scoreDetails: recalculated.scoreDetails as any,
        winnerTeamId: recalculated.winnerTeamId,
      },
      include: {
        teamA: true,
        teamB: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'score.event.reverse',
        resource: 'ScoreEvent',
        resourceId: eventId,
        previousState: {
          teamAScore: match.teamAScore,
          teamBScore: match.teamBScore,
          isReversed: false,
        },
        newState: {
          teamAScore: recalculated.teamAScore,
          teamBScore: recalculated.teamBScore,
          isReversed: true,
          reversalReason: dto.reason,
        },
        reason: dto.reason,
        ipAddress,
      },
    });

    this.realtimeService?.emitMatchScoreUpdated(matchId, {
      matchId,
      teamAScore: recalculated.teamAScore,
      teamBScore: recalculated.teamBScore,
      reversedEventId: eventId,
    });

    return {
      reversedEvent,
      match: updatedMatch,
    };
  }

  async updateScoreManual(
    matchId: string,
    dto: UpdateScoreManualDto,
    userId: string,
    ipAddress?: string,
  ): Promise<Match> {
    if (!this.transactionActive)
      return this.mutate(matchId, (service) =>
        service.updateScoreManual(matchId, dto, userId, ipAddress),
      );
    const match = await this.verifyScoringAuthority(matchId, userId);
    if (!['LIVE', 'PAUSED'].includes(match.status))
      throw new BadRequestException('Only active matches can be corrected');
    if (!dto.reason?.trim())
      throw new BadRequestException('A correction reason is required');
    for (const score of [dto.teamAScore, dto.teamBScore]) {
      if (score !== undefined && (!Number.isSafeInteger(score) || score < 0))
        throw new BadRequestException('Scores must be non-negative integers');
    }
    if (
      dto.winnerTeamId &&
      ![match.teamAId, match.teamBId].includes(dto.winnerTeamId)
    )
      throw new BadRequestException('Winner must be a team in this match');

    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        teamAScore:
          dto.teamAScore !== undefined ? dto.teamAScore : match.teamAScore,
        teamBScore:
          dto.teamBScore !== undefined ? dto.teamBScore : match.teamBScore,
        winnerTeamId:
          dto.winnerTeamId !== undefined
            ? dto.winnerTeamId
            : match.winnerTeamId,
        currentPeriod: dto.currentPeriod || match.currentPeriod,
        scoreDetails: dto.scoreDetails || match.scoreDetails,
      },
      include: {
        teamA: true,
        teamB: true,
        winnerTeam: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'score.manual.update',
        resource: 'Match',
        resourceId: matchId,
        previousState: {
          teamAScore: match.teamAScore,
          teamBScore: match.teamBScore,
          scoreDetails: match.scoreDetails,
        },
        newState: {
          teamAScore: updated.teamAScore,
          teamBScore: updated.teamBScore,
          scoreDetails: updated.scoreDetails,
        },
        reason: dto.reason,
        ipAddress,
      },
    });

    this.realtimeService?.emitMatchScoreUpdated(matchId, {
      matchId,
      teamAScore: updated.teamAScore,
      teamBScore: updated.teamBScore,
      winnerTeamId: updated.winnerTeamId,
    });

    return updated;
  }

  // ===================================
  // QUERY TIMELINE & LIVE SPECTATOR VIEW
  // ===================================

  async getScoreEvents(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });
    if (!match) throw new NotFoundException(`Match "${matchId}" not found`);

    return this.prisma.scoreEvent.findMany({
      where: { matchId },
      include: {
        team: { select: { id: true, name: true } },
        participant: { select: { id: true, name: true } },
      },
      orderBy: { sequenceNumber: 'asc' },
    });
  }

  async getLiveMatch(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        result: { select: { status: true } },
        tournament: {
          select: {
            id: true,
            name: true,
            sport: { select: { id: true, name: true } },
          },
        },
        stage: { select: { id: true, name: true } },
        venue: { select: { id: true, name: true, location: true } },
        teamA: {
          select: {
            id: true,
            name: true,
            institute: {
              select: { name: true, shortName: true, logoUrl: true },
            },
          },
        },
        teamB: {
          select: {
            id: true,
            name: true,
            institute: {
              select: { name: true, shortName: true, logoUrl: true },
            },
          },
        },
        winnerTeam: { select: { id: true, name: true } },
        officials: {
          select: {
            role: true,
            user: { select: { id: true, name: true } },
          },
        },
        scoreEvents: {
          where: { isReversed: false },
          take: 20,
          orderBy: { sequenceNumber: 'desc' },
          include: {
            team: { select: { id: true, name: true } },
            participant: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!match) throw new NotFoundException(`Match "${matchId}" not found`);
    const { result, ...publicMatch } = match;
    return { ...publicMatch, resultPublished: result?.status === 'PUBLISHED' };
  }
}
