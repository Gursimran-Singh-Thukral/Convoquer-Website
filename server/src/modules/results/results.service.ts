import { advanceBracket } from '../fixtures/bracket.js';
import {
  buildResult,
  gamesConfigFor,
  isRankedKind,
  resultKindFor,
  type BuiltResult,
  type ResultKind,
} from './result-formats.js';
import type { Result } from '@prisma/client';
import { matchTransaction } from '../../database/transaction.js';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import {
  SubmitResultDto,
  ApproveResultDto,
  RejectResultDto,
  OverrideResultDto,
} from './dto/results.dto.js';

@Injectable()
export class ResultsService {
  transactionActive = false;

  private mutate<T>(
    matchId: string,
    run: (service: ResultsService) => Promise<T>,
  ): Promise<T> {
    return matchTransaction(
      this.prisma,
      matchId,
      this.realtimeService,
      async (tx, realtime) => {
        const service = new ResultsService(tx, this.rbacService, realtime);
        service.transactionActive = true;
        return run(service);
      },
    );
  }

  private validateScores(
    scoreA: number,
    scoreB: number,
    winnerId: string | null | undefined,
    match: { teamAId: string | null; teamBId: string | null },
    allowHalfPoints = false,
  ) {
    const step = allowHalfPoints ? 2 : 1;
    if (
      ![scoreA, scoreB].every(
        (score) => Number.isSafeInteger(score * step) && score >= 0,
      )
    )
      throw new BadRequestException('Scores must be non-negative integers');
    if (winnerId && ![match.teamAId, match.teamBId].includes(winnerId))
      throw new BadRequestException('Winner must be a team in this match');
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
    private readonly realtimeService?: RealtimeService,
  ) {}

  /**
   * Builds the canonical result for a sport-specific scorecard (sets, quarters,
   * cricket innings, football penalties, chess boards, athletics rankings…).
   * Returns null for sports/fixtures that use the plain two-score path.
   */
  private async structuredResult(
    match: {
      teamAId: string | null;
      teamBId: string | null;
      matchNumber: string | null;
      nextMatchId: string | null;
      scoringMode: string;
      tournament?: { sportId: string; sport?: { name: string } | null } | null;
    },
    details: Record<string, any> | undefined,
    requestedWinnerId: string | null | undefined,
    fallback: { a?: number; b?: number },
  ): Promise<(BuiltResult & { kind: ResultKind }) | null> {
    const kind = resultKindFor(
      match.tournament?.sport?.name,
      match.matchNumber,
    );
    const structured =
      match.scoringMode === 'RESULT_ONLY'
        ? kind !== 'SCORE' || !!details?.kind
        : !!details?.kind;
    if (!structured) return null;
    let fieldTeams:
      Map<string, { name: string; shortName: string | null }> | undefined;
    if (isRankedKind(kind) && match.tournament) {
      // A lobby only lists the teams of its own game (Free Fire or BGMI).
      const game = /bgmi/i.test(match.matchNumber ?? '')
        ? 'BGMI'
        : /free fire/i.test(match.matchNumber ?? '')
          ? 'Free Fire'
          : null;
      const teams = await this.prisma.team.findMany({
        where: {
          sportId: match.tournament.sportId,
          ...(kind === 'LOBBY' && game
            ? { name: { contains: `(${game}`, mode: 'insensitive' as const } }
            : {}),
        },
        select: {
          id: true,
          name: true,
          institute: { select: { shortName: true } },
        },
      });
      fieldTeams = new Map(
        teams.map((t) => [
          t.id,
          { name: t.name, shortName: t.institute?.shortName ?? null },
        ]),
      );
    }
    const built = buildResult(
      kind,
      details,
      {
        teamAId: match.teamAId,
        teamBId: match.teamBId,
        knockout: !!match.nextMatchId,
        bestOf: /volleyball/i.test(match.tournament?.sport?.name ?? '') ? 5 : 3,
        games: gamesConfigFor(match.tournament?.sport?.name) ?? undefined,
        mustDecide: /valorant/i.test(match.matchNumber ?? ''),
        label: match.matchNumber,
        fieldTeams,
        requestedWinnerId,
      },
      fallback,
    );
    return { ...built, kind };
  }

  /**
   * Object-level authorization: verifies the acting user's permission actually
   * covers the sport/event the result belongs to, deriving the scope from the
   * database record itself rather than trusting any client-supplied scope value.
   * Mirrors ScoringService.verifyScoringAuthority.
   */
  private async verifyResultAuthority(
    action: string,
    userId: string,
    sportId?: string | null,
    eventId?: string | null,
  ) {
    const allowed = await this.rbacService.hasPermission(userId, action, {
      sportId: sportId ?? undefined,
      eventId: eventId ?? undefined,
    });
    if (!allowed) {
      throw new ForbiddenException(
        `You are not authorized to perform "${action}" for this sport/tournament`,
      );
    }
  }

  // ===================================
  // SUBMIT RESULT
  // ===================================

  async submitResult(
    matchId: string,
    dto: SubmitResultDto,
    userId: string,
    ipAddress?: string,
  ): Promise<Result> {
    if (!this.transactionActive)
      return this.mutate(matchId, (service) =>
        service.submitResult(matchId, dto, userId, ipAddress),
      );
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: { include: { sport: true } },
        result: true,
        officials: true,
      },
    });

    if (!match) {
      throw new NotFoundException(`Match "${matchId}" not found`);
    }

    const isAssignedOfficial = (match.officials ?? []).some(
      (off: any) => off.userId === userId,
    );
    if (!isAssignedOfficial) {
      await this.verifyResultAuthority(
        'result.submit',
        userId,
        match.tournament?.sportId,
        match.tournament?.eventId,
      );
    }

    // Check existing published result immutability
    if (match.result && match.result.status === 'PUBLISHED') {
      throw new BadRequestException(
        'Official result has already been published. Use convener override to modify.',
      );
    }

    if (['CANCELLED', 'ABANDONED'].includes(match.status))
      throw new BadRequestException(
        'Cannot submit a result for a cancelled or abandoned match',
      );
    const structured = await this.structuredResult(
      match,
      dto.scoreDetails,
      dto.winnerTeamId,
      { a: dto.finalScoreA, b: dto.finalScoreB },
    );

    let scoreA: number;
    let scoreB: number;
    let winnerId: string | null;
    let scoreDetailsValue: any;
    if (structured) {
      scoreA = structured.finalScoreA;
      scoreB = structured.finalScoreB;
      winnerId = structured.winnerTeamId;
      scoreDetailsValue = structured.scoreDetails;
      this.validateScores(
        scoreA,
        scoreB,
        isRankedKind(structured.kind) ? null : winnerId,
        match,
        structured.kind === 'CHESS',
      );
    } else {
      if (!match.teamAId || !match.teamBId)
        throw new BadRequestException(
          'Both teams must be determined before submitting a result',
        );
      if (
        match.scoringMode === 'RESULT_ONLY' &&
        (dto.finalScoreA === undefined || dto.finalScoreB === undefined)
      )
        throw new BadRequestException(
          'Enter both final scores for a results-only fixture',
        );

      scoreA =
        dto.finalScoreA !== undefined
          ? dto.finalScoreA
          : (match.teamAScore ?? 0);
      scoreB =
        dto.finalScoreB !== undefined
          ? dto.finalScoreB
          : (match.teamBScore ?? 0);

      winnerId =
        dto.winnerTeamId ??
        (dto.finalScoreA === undefined && dto.finalScoreB === undefined
          ? match.winnerTeamId
          : null);
      if (!winnerId) {
        if (scoreA > scoreB) winnerId = match.teamAId;
        else if (scoreB > scoreA) winnerId = match.teamBId;
        else winnerId = null; // Draw
      }
      this.validateScores(scoreA, scoreB, winnerId, match);
      scoreDetailsValue = (dto.scoreDetails ??
        match.scoreDetails ??
        undefined) as any;
    }

    const result = await this.prisma.result.upsert({
      where: { matchId },
      update: {
        status: 'SUBMITTED',
        finalScoreA: scoreA,
        finalScoreB: scoreB,
        winnerTeamId: winnerId,
        scoreDetails: scoreDetailsValue,
        notes: dto.notes,
        submittedBy: userId,
        submittedAt: new Date(),
        rejectionReason: null,
      },
      create: {
        matchId,
        status: 'SUBMITTED',
        finalScoreA: scoreA,
        finalScoreB: scoreB,
        winnerTeamId: winnerId,
        scoreDetails: scoreDetailsValue,
        notes: dto.notes,
        submittedBy: userId,
        submittedAt: new Date(),
      },
      include: {
        match: true,
        winnerTeam: true,
      },
    });

    // Mark match as completed if it wasn't already
    {
      await this.prisma.match.update({
        where: { id: matchId },
        data: {
          status: 'COMPLETED',
          teamAScore: scoreA,
          teamBScore: scoreB,
          actualEndTime: match.actualEndTime || new Date(),
          winnerTeamId: winnerId,
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'result.submit',
        resource: 'Result',
        resourceId: result.id,
        newState: {
          matchId,
          status: 'SUBMITTED',
          finalScoreA: scoreA,
          finalScoreB: scoreB,
          winnerTeamId: winnerId,
        },
        ipAddress,
      },
    });

    this.realtimeService?.emitResultSubmitted({
      resultId: result.id,
      matchId,
      tournamentId: match.tournamentId,
      finalScoreA: scoreA,
      finalScoreB: scoreB,
      winnerTeamId: winnerId,
      submittedBy: userId,
    });

    return result;
  }

  // ===================================
  // APPROVE & PUBLISH RESULT
  // ===================================

  async approveResult(
    resultId: string,
    dto: ApproveResultDto,
    userId: string,
    ipAddress?: string,
  ): Promise<Result> {
    if (!this.transactionActive) {
      const target = await this.prisma.result.findUnique({
        where: { id: resultId },
      });
      if (!target) throw new NotFoundException('Result not found');
      return this.mutate(target.matchId, (service) =>
        service.approveResult(resultId, dto, userId, ipAddress),
      );
    }
    const result = await this.prisma.result.findUnique({
      where: { id: resultId },
      include: { match: { include: { tournament: true } } },
    });

    if (!result) {
      throw new NotFoundException(`Result "${resultId}" not found`);
    }

    await this.verifyResultAuthority(
      'result.approve',
      userId,
      result.match?.tournament?.sportId,
      result.match?.tournament?.eventId,
    );

    if (result.status === 'PUBLISHED') {
      return result; // Already approved & published
    }

    if (result.status !== 'SUBMITTED') {
      throw new BadRequestException(
        `Cannot approve result in "${result.status}" status. Result must be SUBMITTED.`,
      );
    }

    if (result.match.nextMatchId)
      await advanceBracket(this.prisma, result.matchId, result.winnerTeamId);
    const now = new Date();
    const updated = await this.prisma.result.update({
      where: { id: resultId },
      data: {
        status: 'PUBLISHED',
        approvedBy: userId,
        approvedAt: now,
        publishedAt: now,
        notes: dto.notes || result.notes,
      },
      include: {
        match: {
          include: {
            teamA: true,
            teamB: true,
            winnerTeam: true,
          },
        },
        winnerTeam: true,
      },
    });

    // Ensure match is strictly synchronized with official result
    await this.prisma.match.update({
      where: { id: result.matchId },
      data: {
        teamAScore: result.finalScoreA,
        teamBScore: result.finalScoreB,
        winnerTeamId: result.winnerTeamId,
        status: 'COMPLETED',
        // Public pages render the official scorecard straight from the match.
        scoreDetails: (result.scoreDetails ?? undefined) as any,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'result.approve',
        resource: 'Result',
        resourceId: resultId,
        previousState: { status: result.status },
        newState: { status: 'PUBLISHED', approvedAt: now, publishedAt: now },
        ipAddress,
      },
    });

    this.realtimeService?.emitResultPublished(
      result.match.tournamentId,
      result.matchId,
      {
        resultId,
        matchId: result.matchId,
        finalScoreA: result.finalScoreA,
        finalScoreB: result.finalScoreB,
        winnerTeamId: result.winnerTeamId,
      },
    );
    this.realtimeService?.emitStandingsUpdated(result.match.tournamentId, {
      tournamentId: result.match.tournamentId,
    });

    return updated;
  }

  // ===================================
  // REJECT RESULT
  // ===================================

  async rejectResult(
    resultId: string,
    dto: RejectResultDto,
    userId: string,
    ipAddress?: string,
  ): Promise<Result> {
    if (!this.transactionActive) {
      const target = await this.prisma.result.findUnique({
        where: { id: resultId },
      });
      if (!target) throw new NotFoundException('Result not found');
      return this.mutate(target.matchId, (service) =>
        service.rejectResult(resultId, dto, userId, ipAddress),
      );
    }
    const result = await this.prisma.result.findUnique({
      where: { id: resultId },
      include: { match: { include: { tournament: true } } },
    });

    if (!result) {
      throw new NotFoundException(`Result "${resultId}" not found`);
    }

    await this.verifyResultAuthority(
      'result.approve',
      userId,
      result.match?.tournament?.sportId,
      result.match?.tournament?.eventId,
    );

    if (result.status !== 'SUBMITTED') {
      throw new BadRequestException(
        `Cannot reject result in "${result.status}" status. Result must be SUBMITTED.`,
      );
    }

    if (!dto.reason?.trim())
      throw new BadRequestException('A rejection reason is required');
    const updated = await this.prisma.result.update({
      where: { id: resultId },
      data: {
        status: 'REJECTED',
        rejectionReason: dto.reason,
      },
      include: { match: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'result.reject',
        resource: 'Result',
        resourceId: resultId,
        previousState: { status: result.status },
        newState: { status: 'REJECTED', rejectionReason: dto.reason },
        reason: dto.reason,
        ipAddress,
      },
    });

    return updated;
  }

  // ===================================
  // CONVENER OVERRIDE
  // ===================================

  async overrideResult(
    resultId: string,
    dto: OverrideResultDto,
    userId: string,
    ipAddress?: string,
  ): Promise<Result> {
    if (!this.transactionActive) {
      const target = await this.prisma.result.findUnique({
        where: { id: resultId },
      });
      if (!target) throw new NotFoundException('Result not found');
      return this.mutate(target.matchId, (service) =>
        service.overrideResult(resultId, dto, userId, ipAddress),
      );
    }
    const result = await this.prisma.result.findUnique({
      where: { id: resultId },
      include: {
        match: { include: { tournament: { include: { sport: true } } } },
      },
    });

    if (!result) {
      throw new NotFoundException(`Result "${resultId}" not found`);
    }

    await this.verifyResultAuthority(
      'result.override',
      userId,
      result.match?.tournament?.sportId,
      result.match?.tournament?.eventId,
    );

    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException(
        'A reason is required to override a published result',
      );
    }

    const previousState = {
      finalScoreA: result.finalScoreA,
      finalScoreB: result.finalScoreB,
      winnerTeamId: result.winnerTeamId,
      status: result.status,
    };

    const structured = await this.structuredResult(
      result.match,
      dto.scoreDetails,
      dto.winnerTeamId,
      { a: dto.finalScoreA, b: dto.finalScoreB },
    );
    let winnerId: string | null;
    let finalA: number;
    let finalB: number;
    let overrideScoreDetails: any;
    if (structured) {
      finalA = structured.finalScoreA;
      finalB = structured.finalScoreB;
      winnerId = structured.winnerTeamId;
      overrideScoreDetails = structured.scoreDetails;
      this.validateScores(
        finalA,
        finalB,
        isRankedKind(structured.kind) ? null : winnerId,
        result.match,
        structured.kind === 'CHESS',
      );
    } else {
      if (dto.finalScoreA === undefined || dto.finalScoreB === undefined)
        throw new BadRequestException('Enter both final scores');
      finalA = dto.finalScoreA;
      finalB = dto.finalScoreB;
      winnerId = dto.winnerTeamId ?? null;
      if (!winnerId) {
        if (finalA > finalB) winnerId = result.match.teamAId ?? null;
        else if (finalB > finalA) winnerId = result.match.teamBId ?? null;
      }
      this.validateScores(finalA, finalB, winnerId, result.match);
      overrideScoreDetails = (dto.scoreDetails ??
        result.scoreDetails ??
        undefined) as any;
    }
    if (result.match.nextMatchId && winnerId !== result.winnerTeamId) {
      throw new BadRequestException(
        'A progressed knockout winner cannot be overridden; resolve downstream fixtures first',
      );
    }

    const updated = await this.prisma.result.update({
      where: { id: resultId },
      data: {
        status: 'PUBLISHED',
        finalScoreA: finalA,
        finalScoreB: finalB,
        winnerTeamId: winnerId,
        scoreDetails: overrideScoreDetails,
        overrideReason: dto.reason,
      },
      include: {
        match: true,
        winnerTeam: true,
      },
    });

    // Synchronize Match
    await this.prisma.match.update({
      where: { id: result.matchId },
      data: {
        teamAScore: finalA,
        teamBScore: finalB,
        winnerTeamId: winnerId,
        status: 'COMPLETED',
        scoreDetails: overrideScoreDetails,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'result.override',
        resource: 'Result',
        resourceId: resultId,
        previousState,
        newState: {
          finalScoreA: finalA,
          finalScoreB: finalB,
          winnerTeamId: winnerId,
          overrideReason: dto.reason,
        },
        reason: dto.reason,
        ipAddress,
      },
    });

    this.realtimeService?.emitResultPublished(
      result.match.tournamentId,
      result.matchId,
      {
        resultId,
        matchId: result.matchId,
        finalScoreA: finalA,
        finalScoreB: finalB,
        winnerTeamId: winnerId,
      },
    );
    this.realtimeService?.emitStandingsUpdated(result.match.tournamentId, {
      tournamentId: result.match.tournamentId,
    });

    return updated;
  }

  // ===================================
  // E-SPORTS LOBBY TEAMS
  // ===================================

  /**
   * Adds a Free Fire / BGMI team for a college (a college may field several).
   * Sports Coordinators lack the generic team.create permission, so this is
   * authorised by result.submit on the E-Sports sport instead. The team follows
   * the roster-import naming, e.g. "GCET E-Sports (BGMI - Team 2)", so a later
   * roster import lands in the same team.
   */
  async addLobbyTeam(
    dto: { sportId: string; instituteId: string; game: string; squad?: string },
    userId: string,
  ) {
    const sport = await this.prisma.sport.findUnique({
      where: { id: dto.sportId },
    });
    if (!sport) throw new NotFoundException('Sport not found');
    const isEsports = /e-?sports/i.test(sport.name);
    const isAthletics = /athletics/i.test(sport.name);
    if (!isEsports && !isAthletics)
      throw new BadRequestException(
        'Teams can only be added here for E-Sports and Athletics',
      );
    await this.verifyResultAuthority(
      'result.submit',
      userId,
      sport.id,
      sport.eventId,
    );
    if (isEsports && !['Free Fire', 'BGMI', 'Valorant'].includes(dto.game))
      throw new BadRequestException('Game must be Free Fire, BGMI or Valorant');
    const institute = await this.prisma.institute.findUnique({
      where: { id: dto.instituteId },
    });
    if (!institute || institute.eventId !== sport.eventId)
      throw new BadRequestException('Choose a participating institute');

    const base = `${institute.shortName || institute.name} ${sport.name}`;
    const existing = await this.prisma.team.findMany({
      where: {
        sportId: sport.id,
        instituteId: institute.id,
        ...(isEsports
          ? { name: { contains: `(${dto.game}`, mode: 'insensitive' as const } }
          : {}),
      },
    });
    if (isAthletics) {
      // One athletics team per college: its athletes are named on each result.
      if (existing.length)
        throw new BadRequestException(
          `"${existing[0].name}" is already registered`,
        );
      const team = await this.prisma.team.create({
        data: {
          eventId: sport.eventId,
          instituteId: institute.id,
          sportId: sport.id,
          name: base,
        },
        include: { institute: true },
      });
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'team.create',
          resource: 'Team',
          resourceId: team.id,
          newState: { name: base, game: 'Athletics' },
        },
      });
      return team;
    }
    // The first team of a college is plain; later ones are numbered squads.
    const squad =
      dto.squad?.trim() ||
      (existing.length ? `Team ${existing.length + 1}` : '');
    const name = squad
      ? `${base} (${dto.game} - ${squad.slice(0, 40)})`
      : `${base} (${dto.game})`;
    if (existing.some((t) => t.name.toLowerCase() === name.toLowerCase()))
      throw new BadRequestException(`"${name}" is already registered`);

    const team = await this.prisma.team.create({
      data: {
        eventId: sport.eventId,
        instituteId: institute.id,
        sportId: sport.id,
        name,
      },
      include: { institute: true },
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'team.create',
        resource: 'Team',
        resourceId: team.id,
        newState: { name, game: dto.game },
      },
    });
    return team;
  }

  // ===================================
  // QUERY METHODS
  // ===================================

  async getResultByMatchId(matchId: string) {
    const result = await this.prisma.result.findUnique({
      where: { matchId },
      include: {
        match: {
          include: {
            teamA: { include: { institute: true } },
            teamB: { include: { institute: true } },
            venue: true,
            tournament: { include: { sport: true } },
          },
        },
        winnerTeam: true,
      },
    });

    if (!result || result.status !== 'PUBLISHED') {
      throw new NotFoundException(`Result for match "${matchId}" not found`);
    }

    return result;
  }

  async getTournamentResults(tournamentId: string) {
    return this.prisma.result.findMany({
      where: {
        match: { tournamentId },
        status: 'PUBLISHED',
      },
      include: {
        match: {
          include: {
            teamA: {
              select: {
                id: true,
                name: true,
                institute: { select: { shortName: true } },
              },
            },
            teamB: {
              select: {
                id: true,
                name: true,
                institute: { select: { shortName: true } },
              },
            },
            stage: { select: { id: true, name: true } },
          },
        },
        winnerTeam: { select: { id: true, name: true } },
      },
      orderBy: { publishedAt: 'desc' },
    });
  }
  async getPublishedResults(sportId?: string) {
    return this.prisma.result.findMany({
      where: {
        status: 'PUBLISHED',
        ...(sportId ? { match: { tournament: { sportId } } } : {}),
      },
      select: {
        id: true,
        matchId: true,
        finalScoreA: true,
        finalScoreB: true,
        winnerTeamId: true,
        publishedAt: true,
        scoreDetails: true,
        match: {
          select: {
            matchNumber: true,
            scheduledStartTime: true,
            stage: { select: { name: true } },
            venue: { select: { name: true } },
            teamA: { select: { id: true, name: true } },
            teamB: { select: { id: true, name: true } },
            tournament: {
              select: { name: true, sport: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: 200,
    });
  }
}
