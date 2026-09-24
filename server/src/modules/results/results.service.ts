import { advanceBracket } from '../fixtures/bracket.js';
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
  ) {
    if (
      ![scoreA, scoreB].every(
        (score) => Number.isSafeInteger(score) && score >= 0,
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
        tournament: true,
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

    // Determine final scores and winner
    const scoreA =
      dto.finalScoreA !== undefined ? dto.finalScoreA : (match.teamAScore ?? 0);
    const scoreB =
      dto.finalScoreB !== undefined ? dto.finalScoreB : (match.teamBScore ?? 0);

    let winnerId =
      dto.winnerTeamId ??
      (dto.finalScoreA === undefined && dto.finalScoreB === undefined
        ? match.winnerTeamId
        : null);
    if (!winnerId) {
      if (scoreA > scoreB) winnerId = match.teamAId;
      else if (scoreB > scoreA) winnerId = match.teamBId;
      else winnerId = null; // Draw
    }

    if (['CANCELLED', 'ABANDONED'].includes(match.status))
      throw new BadRequestException(
        'Cannot submit a result for a cancelled or abandoned match',
      );
    this.validateScores(scoreA, scoreB, winnerId, match);
    const scoreDetailsValue = (dto.scoreDetails ??
      match.scoreDetails ??
      undefined) as any;

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
      include: { match: { include: { tournament: true } } },
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

    let winnerId: string | null = dto.winnerTeamId ?? null;
    if (!winnerId) {
      if (dto.finalScoreA > dto.finalScoreB)
        winnerId = result.match.teamAId ?? null;
      else if (dto.finalScoreB > dto.finalScoreA)
        winnerId = result.match.teamBId ?? null;
      else winnerId = null;
    }

    this.validateScores(
      dto.finalScoreA,
      dto.finalScoreB,
      winnerId,
      result.match,
    );
    if (result.match.nextMatchId && winnerId !== result.winnerTeamId) {
      throw new BadRequestException(
        'A progressed knockout winner cannot be overridden; resolve downstream fixtures first',
      );
    }
    const overrideScoreDetails = (dto.scoreDetails ??
      result.scoreDetails ??
      undefined) as any;

    const updated = await this.prisma.result.update({
      where: { id: resultId },
      data: {
        status: 'PUBLISHED',
        finalScoreA: dto.finalScoreA,
        finalScoreB: dto.finalScoreB,
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
        teamAScore: dto.finalScoreA,
        teamBScore: dto.finalScoreB,
        winnerTeamId: winnerId,
        status: 'COMPLETED',
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
          finalScoreA: dto.finalScoreA,
          finalScoreB: dto.finalScoreB,
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
        finalScoreA: dto.finalScoreA,
        finalScoreB: dto.finalScoreB,
        winnerTeamId: winnerId,
      },
    );
    this.realtimeService?.emitStandingsUpdated(result.match.tournamentId, {
      tournamentId: result.match.tournamentId,
    });

    return updated;
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
        match: {
          select: {
            matchNumber: true,
            teamA: { select: { name: true } },
            teamB: { select: { name: true } },
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
