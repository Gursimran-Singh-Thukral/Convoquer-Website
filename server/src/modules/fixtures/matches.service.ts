import type { Prisma } from '@prisma/client';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import {
  CreateMatchDto,
  UpdateMatchDto,
  RescheduleMatchDto,
  AssignOfficialDto,
  GenerateKnockoutBracketDto,
  GenerateRoundRobinDto,
  GenerateSwissRoundDto,
} from './dto/fixtures.dto.js';

@Injectable()
export class MatchesService {
  private generationTransactionActive = false;

  private async sportScoringMode(
    sportId: string,
    override?: 'LIVE' | 'RESULT_ONLY',
  ) {
    const sport = await this.prisma.sport.findUnique({
      where: { id: sportId },
    });
    return override ?? sport?.scoringMode ?? 'LIVE';
  }

  private async generationCapacity(dto: {
    simultaneousMatches?: number;
    defaultVenueId?: string;
  }) {
    const capacity = dto.simultaneousMatches ?? 1;
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 64)
      throw new BadRequestException(
        'Simultaneous matches must be between 1 and 64',
      );
    if (dto.defaultVenueId) {
      const venue = await this.prisma.venue.findUnique({
        where: { id: dto.defaultVenueId },
      });
      if (capacity > (venue?.simultaneousMatches ?? 1))
        throw new BadRequestException(
          'Simultaneous matches exceed this venue capacity. Update the venue capacity or reduce this setting.',
        );
    }
    return capacity;
  }

  private async generateTransaction<T>(
    tournamentId: string,
    venueId: string | undefined,
    run: (service: MatchesService) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Tournament" WHERE "id" = ${tournamentId} FOR UPDATE`;
        await tx.$queryRaw`SELECT s."id" FROM "Sport" s JOIN "Tournament" t ON t."sportId" = s."id" WHERE t."id" = ${tournamentId} FOR SHARE OF s`;
        if (venueId)
          await tx.$queryRaw`SELECT "id" FROM "Venue" WHERE "id" = ${venueId} FOR UPDATE`;
        const service = new MatchesService(
          tx as PrismaService,
          this.rbacService,
        );
        service.generationTransactionActive = true;
        return run(service);
      },
      { timeout: 30000 },
    );
  }

  private async validateField(
    tournament: { sportId: string; eventId: string },
    ids: string[],
    venueId?: string,
  ) {
    if (new Set(ids).size !== ids.length || ids.length < 2 || ids.length > 128)
      throw new BadRequestException('Choose 2–128 unique teams');
    const teams = await this.prisma.team.findMany({
      where: { id: { in: ids } },
    });
    if (
      teams.length !== ids.length ||
      teams.some(
        (t) =>
          t.sportId !== tournament.sportId || t.eventId !== tournament.eventId,
      )
    )
      throw new BadRequestException(
        'Teams must belong to the tournament sport and event',
      );
    if (venueId) {
      const venue = await this.prisma.venue.findUnique({
        where: { id: venueId },
      });
      if (!venue || venue.eventId !== tournament.eventId)
        throw new BadRequestException(
          'Venue must belong to the tournament event',
        );
    }
  }
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
  ) {}

  /**
   * Object-level authorization for match-level mutations only (create/
   * update/reschedule/officials on a match that already exists inside some
   * tournament) — a Sports Coordinator's 'match.update' grant, scoped to
   * their own sport via UserRole.sportId, is enough for these. Deliberately
   * NOT used by the bracket/structure generators below — see
   * verifyStructureAuthority for those.
   */
  private async verifyCompetitionAuthority(
    userId: string,
    sportId?: string | null,
    eventId?: string | null,
  ) {
    const scope = {
      sportId: sportId ?? undefined,
      eventId: eventId ?? undefined,
    };
    const allowed =
      (await this.rbacService.hasPermission(userId, 'match.update', scope)) ||
      (await this.rbacService.hasPermission(
        userId,
        'competition.manage',
        scope,
      ));
    if (!allowed) {
      throw new ForbiddenException(
        'You are not authorized to manage matches for this sport',
      );
    }
  }

  /**
   * Object-level authorization for generating a tournament's structure
   * (initial knockout bracket / round-robin schedule / next Swiss round) —
   * requires full 'competition.manage', same as TournamentsService's own
   * check, so this stays with whoever builds the tournament (Convener/
   * Co-Convener/Web Dev Head) and never with a Sports Coordinator's
   * sport-scoped match.update alone. A Sports Coordinator "populates" matches
   * inside a structure that already exists (see verifyCompetitionAuthority
   * above) but doesn't create that structure.
   */
  private async verifyStructureAuthority(
    userId: string,
    sportId?: string | null,
    eventId?: string | null,
  ) {
    const allowed = await this.rbacService.hasPermission(
      userId,
      'competition.manage',
      { sportId: sportId ?? undefined, eventId: eventId ?? undefined },
    );
    if (!allowed) {
      throw new ForbiddenException(
        "You are not authorized to generate this tournament's structure",
      );
    }
  }

  // ===================================
  // QUERY MATCHES
  // ===================================

  async getMatches(filters: {
    tournamentId?: string;
    stageId?: string;
    venueId?: string;
    sportId?: string;
    status?: string;
    teamId?: string;
    date?: string; // YYYY-MM-DD
  }) {
    let dateFilter: any = undefined;
    if (filters.date) {
      const startOfDay = new Date(filters.date);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(filters.date);
      endOfDay.setUTCHours(23, 59, 59, 999);

      dateFilter = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    return this.prisma.match.findMany({
      where: {
        ...(filters.tournamentId ? { tournamentId: filters.tournamentId } : {}),
        ...(filters.stageId ? { stageId: filters.stageId } : {}),
        ...(filters.venueId ? { venueId: filters.venueId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.sportId
          ? {
              tournament: { sportId: filters.sportId },
            }
          : {}),
        ...(filters.teamId
          ? {
              OR: [{ teamAId: filters.teamId }, { teamBId: filters.teamId }],
            }
          : {}),
        ...(dateFilter ? { scheduledStartTime: dateFilter } : {}),
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            sport: { select: { id: true, name: true } },
          },
        },
        stage: { select: { id: true, name: true, sequence: true } },
        venue: { select: { id: true, name: true, location: true } },
        teamA: {
          select: {
            id: true,
            name: true,
            institute: { select: { name: true, shortName: true } },
          },
        },
        teamB: {
          select: {
            id: true,
            name: true,
            institute: { select: { name: true, shortName: true } },
          },
        },
        winnerTeam: { select: { id: true, name: true } },
        officials: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { scheduledStartTime: 'asc' },
    });
  }

  async getMatchById(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: {
        tournament: {
          include: {
            sport: true,
            event: true,
          },
        },
        stage: true,
        venue: true,
        teamA: {
          include: {
            institute: true,
            members: {
              include: { participant: { select: { id: true, name: true } } },
            },
          },
        },
        teamB: {
          include: {
            institute: true,
            members: {
              include: { participant: { select: { id: true, name: true } } },
            },
          },
        },
        winnerTeam: true,
        officials: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profilePhotoUrl: true,
              },
            },
          },
        },
      },
    });

    if (!match) throw new NotFoundException(`Match with id "${id}" not found`);
    return match;
  }

  // ===================================
  // CONFLICT DETECTION ENGINE
  // ===================================

  /**
   * Validates that neither the venue nor the participating teams have overlapping matches.
   */
  async checkSchedulingConflicts(params: {
    startTime: Date;
    endTime?: Date;
    venueId?: string;
    teamAId?: string;
    teamBId?: string;
    excludeMatchId?: string;
  }) {
    const { startTime, endTime, venueId, teamAId, teamBId, excludeMatchId } =
      params;
    // Default match duration is 90 mins if no end time specified
    const effectiveEndTime =
      endTime || new Date(startTime.getTime() + 90 * 60 * 1000);

    // 1. Check Venue Overlap
    if (venueId) {
      const venueConflict = await this.prisma.match.findFirst({
        where: {
          venueId,
          ...(excludeMatchId ? { id: { not: excludeMatchId } } : {}),
          status: { notIn: ['CANCELLED', 'ABANDONED'] },
          AND: [
            { scheduledStartTime: { lt: effectiveEndTime } },
            {
              OR: [
                { scheduledEndTime: { gt: startTime } },
                // If existing match has no endTime, assume 90 min window
                {
                  scheduledEndTime: null,
                  scheduledStartTime: {
                    gte: new Date(startTime.getTime() - 90 * 60 * 1000),
                  },
                },
              ],
            },
          ],
        },
        include: { venue: true },
      });

      if (venueConflict) {
        const venue = await this.prisma.venue.findUnique({
          where: { id: venueId },
        });
        const capacity = venue?.simultaneousMatches ?? 1;
        let peak = 1;
        if (capacity > 1) {
          const overlaps = await this.prisma.match.findMany({
            where: {
              venueId,
              ...(excludeMatchId ? { id: { not: excludeMatchId } } : {}),
              status: { notIn: ['CANCELLED', 'ABANDONED', 'BYE'] },
              scheduledStartTime: { lt: effectiveEndTime },
            },
          });
          const edges: Array<[number, number]> = [];
          for (const match of overlaps) {
            const from = Math.max(
              startTime.getTime(),
              match.scheduledStartTime.getTime(),
            );
            const to = Math.min(
              effectiveEndTime.getTime(),
              match.scheduledEndTime?.getTime() ??
                match.scheduledStartTime.getTime() + 90 * 60000,
            );
            if (from < to) edges.push([from, 1], [to, -1]);
          }
          let count = 0;
          peak = 0;
          for (const [, delta] of edges.sort(
            (a, b) => a[0] - b[0] || a[1] - b[1],
          )) {
            count += delta;
            peak = Math.max(peak, count);
          }
        }
        if (peak >= capacity)
          throw new ConflictException(
            `Scheduling conflict: Venue "${venueConflict.venue?.name || venueId}" has reached its capacity of ${capacity} simultaneous match(es)`,
          );
      }
    }

    // 2. Check Team Overlaps
    const teamsToCheck = [teamAId, teamBId].filter(Boolean) as string[];
    for (const teamId of teamsToCheck) {
      const teamConflict = await this.prisma.match.findFirst({
        where: {
          ...(excludeMatchId ? { id: { not: excludeMatchId } } : {}),
          status: { notIn: ['CANCELLED', 'ABANDONED'] },
          OR: [{ teamAId: teamId }, { teamBId: teamId }],
          AND: [
            { scheduledStartTime: { lt: effectiveEndTime } },
            {
              OR: [
                { scheduledEndTime: { gt: startTime } },
                {
                  scheduledEndTime: null,
                  scheduledStartTime: {
                    gte: new Date(startTime.getTime() - 90 * 60 * 1000),
                  },
                },
              ],
            },
          ],
        },
        include: {
          teamA: { select: { name: true } },
          teamB: { select: { name: true } },
        },
      });

      if (teamConflict) {
        const teamName =
          teamConflict.teamAId === teamId
            ? teamConflict.teamA?.name
            : teamConflict.teamB?.name;
        throw new ConflictException(
          `Scheduling conflict: Team "${teamName || teamId}" already has Match "${teamConflict.matchNumber || teamConflict.id}" scheduled at this time`,
        );
      }
    }
  }

  // ===================================
  // MATCH MANAGEMENT
  // ===================================

  async createMatch(
    dto: CreateMatchDto,
    userId: string,
  ): Promise<
    Prisma.MatchGetPayload<{
      include: { teamA: true; teamB: true; venue: true };
    }>
  > {
    if (!this.generationTransactionActive)
      return this.generateTransaction(
        dto.tournamentId,
        dto.venueId,
        (service) => service.createMatch(dto, userId),
      );
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: dto.tournamentId },
    });
    if (!tournament)
      throw new NotFoundException(`Tournament "${dto.tournamentId}" not found`);

    await this.verifyCompetitionAuthority(
      userId,
      tournament.sportId,
      tournament.eventId,
    );

    const startTime = new Date(dto.scheduledStartTime);
    const endTime = dto.scheduledEndTime
      ? new Date(dto.scheduledEndTime)
      : new Date(startTime.getTime() + 90 * 60 * 1000);

    // Validate conflicts
    await this.checkSchedulingConflicts({
      startTime,
      endTime,
      venueId: dto.venueId,
      teamAId: dto.teamAId,
      teamBId: dto.teamBId,
    });

    return this.prisma.match.create({
      data: {
        tournamentId: dto.tournamentId,
        stageId: dto.stageId,
        venueId: dto.venueId,
        matchNumber: dto.matchNumber,
        teamAId: dto.teamAId,
        teamBId: dto.teamBId,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        scoreDetails: dto.scoreDetails,
        scoringMode: await this.sportScoringMode(
          tournament.sportId,
          dto.scoringMode,
        ),
      },
      include: {
        teamA: true,
        teamB: true,
        venue: true,
      },
    });
  }

  async updateMatch(id: string, dto: UpdateMatchDto, userId: string) {
    const existing = await this.prisma.match.findUnique({
      where: { id },
      include: { tournament: true },
    });
    if (!existing) throw new NotFoundException(`Match "${id}" not found`);

    if (
      dto.winnerTeamId !== undefined ||
      dto.teamAScore !== undefined ||
      dto.teamBScore !== undefined ||
      dto.scoreDetails !== undefined
    ) {
      throw new BadRequestException(
        'Scores and winners must use the scoring and result approval workflow',
      );
    }
    if (
      dto.status &&
      !['SCHEDULED', 'READY', 'CANCELLED'].includes(dto.status)
    ) {
      throw new BadRequestException(
        'Use the scoring workflow to start or end a match',
      );
    }
    if (
      !['SCHEDULED', 'READY', 'RESCHEDULED'].includes(existing.status) &&
      Object.keys(dto).some((key) => key !== 'isTelecast')
    ) {
      throw new BadRequestException(
        'Started or completed fixtures cannot be changed here',
      );
    }
    if (
      existing.nextMatchId &&
      (dto.teamAId !== undefined ||
        dto.teamBId !== undefined ||
        dto.stageId !== undefined)
    ) {
      throw new BadRequestException(
        'Generated bracket teams and stages cannot be reassigned',
      );
    }

    await this.verifyCompetitionAuthority(
      userId,
      existing.tournament?.sportId,
      existing.tournament?.eventId,
    );

    const startTime = dto.scheduledStartTime
      ? new Date(dto.scheduledStartTime)
      : existing.scheduledStartTime;
    const endTime = dto.scheduledEndTime
      ? new Date(dto.scheduledEndTime)
      : dto.scheduledStartTime
        ? new Date(startTime.getTime() + 90 * 60 * 1000)
        : existing.scheduledEndTime;

    // Run conflict check if time, venue, or teams are being modified
    if (
      dto.scheduledStartTime ||
      dto.scheduledEndTime ||
      (dto.venueId && dto.venueId !== existing.venueId) ||
      (dto.teamAId && dto.teamAId !== existing.teamAId) ||
      (dto.teamBId && dto.teamBId !== existing.teamBId)
    ) {
      await this.checkSchedulingConflicts({
        startTime,
        endTime: endTime || undefined,
        venueId:
          dto.venueId !== undefined
            ? dto.venueId
            : existing.venueId || undefined,
        teamAId:
          dto.teamAId !== undefined
            ? dto.teamAId
            : existing.teamAId || undefined,
        teamBId:
          dto.teamBId !== undefined
            ? dto.teamBId
            : existing.teamBId || undefined,
        excludeMatchId: id,
      });
    }

    // NOTE: teamAScore / teamBScore / scoreDetails are intentionally NOT
    // accepted here. Live score mutation must go through ScoringService
    // (POST /api/matches/:id/score-events, PATCH /api/matches/:id/score-manual),
    // which enforces match-state validation, transactional updates, audit
    // logging and realtime broadcast. Allowing raw score writes through this
    // generic admin endpoint would bypass all of that (score integrity).
    const updated = await this.prisma.match.update({
      where: { id },
      data: {
        stageId: dto.stageId,
        venueId: dto.venueId,
        matchNumber: dto.matchNumber,
        teamAId: dto.teamAId,
        teamBId: dto.teamBId,
        winnerTeamId: dto.winnerTeamId,
        status: dto.status,
        isTelecast: dto.isTelecast,
        scoringMode: dto.scoringMode,
        scheduledStartTime: dto.scheduledStartTime ? startTime : undefined,
        scheduledEndTime: dto.scheduledEndTime ? endTime : undefined,
      },
      include: {
        teamA: true,
        teamB: true,
        venue: true,
        winnerTeam: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'match.update',
        resource: 'Match',
        resourceId: id,
        previousState: {
          stageId: existing.stageId,
          venueId: existing.venueId,
          teamAId: existing.teamAId,
          teamBId: existing.teamBId,
          winnerTeamId: existing.winnerTeamId,
          status: existing.status,
        },
        newState: {
          stageId: updated.stageId,
          venueId: updated.venueId,
          teamAId: updated.teamAId,
          teamBId: updated.teamBId,
          winnerTeamId: updated.winnerTeamId,
          status: updated.status,
        },
      },
    });

    return updated;
  }

  async rescheduleMatch(id: string, dto: RescheduleMatchDto, userId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: { tournament: true },
    });
    if (!match) throw new NotFoundException(`Match "${id}" not found`);
    if (!['SCHEDULED', 'READY', 'RESCHEDULED'].includes(match.status)) {
      throw new BadRequestException(
        'Only an unstarted fixture can be rescheduled',
      );
    }

    await this.verifyCompetitionAuthority(
      userId,
      match.tournament?.sportId,
      match.tournament?.eventId,
    );

    const startTime = new Date(dto.scheduledStartTime);
    const endTime = dto.scheduledEndTime
      ? new Date(dto.scheduledEndTime)
      : new Date(startTime.getTime() + 90 * 60 * 1000);

    const venueId =
      dto.venueId !== undefined ? dto.venueId : match.venueId || undefined;

    await this.checkSchedulingConflicts({
      startTime,
      endTime,
      venueId,
      teamAId: match.teamAId || undefined,
      teamBId: match.teamBId || undefined,
      excludeMatchId: id,
    });

    const updated = await this.prisma.match.update({
      where: { id },
      data: {
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        venueId,
        status: 'RESCHEDULED',
      },
      include: { venue: true, teamA: true, teamB: true },
    });

    // Write audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'match.reschedule',
        resource: 'Match',
        resourceId: id,
        previousState: {
          scheduledStartTime: match.scheduledStartTime,
          scheduledEndTime: match.scheduledEndTime,
          venueId: match.venueId,
        },
        newState: {
          scheduledStartTime: startTime,
          scheduledEndTime: endTime,
          venueId,
          reason: dto.reason,
        },
        reason: dto.reason || 'Match rescheduled by organizer',
      },
    });

    return {
      message: 'Match rescheduled successfully with conflict verification',
      match: updated,
    };
  }

  // ===================================
  // OFFICIALS / REFEREES / SCOREKEEPERS
  // ===================================

  async assignOfficial(
    matchId: string,
    dto: AssignOfficialDto,
    actingUserId: string,
  ) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });
    if (!match) throw new NotFoundException(`Match "${matchId}" not found`);

    await this.verifyCompetitionAuthority(
      actingUserId,
      match.tournament?.sportId,
      match.tournament?.eventId,
    );

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) throw new NotFoundException(`User "${dto.userId}" not found`);

    const existing = await this.prisma.matchOfficial.findUnique({
      where: {
        matchId_userId: { matchId, userId: dto.userId },
      },
    });

    if (existing) {
      return this.prisma.matchOfficial.update({
        where: { id: existing.id },
        data: { role: dto.role || 'SCOREKEEPER' },
        include: { user: true },
      });
    }

    return this.prisma.matchOfficial.create({
      data: {
        matchId,
        userId: dto.userId,
        role: dto.role || 'SCOREKEEPER',
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async removeOfficial(
    matchId: string,
    officialUserId: string,
    actingUserId: string,
  ) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    });
    if (!match) throw new NotFoundException(`Match "${matchId}" not found`);

    await this.verifyCompetitionAuthority(
      actingUserId,
      match.tournament?.sportId,
      match.tournament?.eventId,
    );

    const existing = await this.prisma.matchOfficial.findUnique({
      where: {
        matchId_userId: { matchId, userId: officialUserId },
      },
    });

    if (!existing)
      throw new NotFoundException('Match official assignment not found');

    await this.prisma.matchOfficial.delete({
      where: { id: existing.id },
    });

    return { success: true, message: 'Official removed from match' };
  }

  // =========================================================================
  // AUTOMATED KNOCKOUT BRACKET GENERATOR (WITH TOURNAMENT SEEDING GUARANTEE)
  // =========================================================================

  /**
   * Generates a seeded knockout tournament bracket.
   * Ensures Seed 1 and Seed 2 are placed in opposite halves so they
   * CANNOT play against each other before the Finals.
   */
  async generateKnockoutBracket(
    tournamentId: string,
    dto: GenerateKnockoutBracketDto,
    userId: string,
  ) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { seeds: { orderBy: { seedNumber: 'asc' } } },
    });
    if (!tournament)
      throw new NotFoundException(`Tournament "${tournamentId}" not found`);

    await this.verifyStructureAuthority(
      userId,
      tournament.sportId,
      tournament.eventId,
    );

    // Determine teams: prioritize passed seeds/teamIds or stored seeds
    let orderedTeams: Array<{ id: string; seedNumber: number; name?: string }> =
      [];

    if (dto.seeds && dto.seeds.length > 0) {
      orderedTeams = dto.seeds.map((s) => ({
        id: s.teamId,
        seedNumber: s.seedNumber,
      }));
    } else if (tournament.seeds && tournament.seeds.length > 0) {
      orderedTeams = tournament.seeds.map((s) => ({
        id: s.teamId,
        seedNumber: s.seedNumber,
      }));
    } else if (dto.teamIds && dto.teamIds.length > 0) {
      orderedTeams = dto.teamIds.map((id, index) => ({
        id,
        seedNumber: index + 1,
      }));
    } else {
      throw new BadRequestException(
        'Teams or Seeds must be provided to generate a bracket',
      );
    }

    if (orderedTeams.length < 2) {
      throw new BadRequestException(
        'At least 2 teams required to generate a knockout bracket',
      );
    }

    const ids = orderedTeams.map((t) => t.id);
    const numbers = orderedTeams.map((t) => t.seedNumber);
    if (
      ids.length > 128 ||
      new Set(ids).size !== ids.length ||
      new Set(numbers).size !== numbers.length ||
      numbers.some((n) => !Number.isInteger(n) || n < 1 || n > ids.length)
    ) {
      throw new BadRequestException(
        'Use unique teams and consecutive seeds from 1 to the number of teams (maximum 128)',
      );
    }
    const duration = dto.matchDurationMinutes ?? 90;
    const interval = dto.breakMinutes ?? 30;
    if (
      duration < 1 ||
      interval < 0 ||
      !Number.isFinite(Date.parse(dto.startTime))
    ) {
      throw new BadRequestException(
        'A valid start time and positive match duration are required',
      );
    }
    return this.prisma.$transaction(
      async (tx) => {
        // Serialize generation for this tournament and reservations of the shared venue.
        await tx.$queryRaw`SELECT "id" FROM "Tournament" WHERE "id" = ${tournamentId} FOR UPDATE`;
        await tx.$queryRaw`SELECT s."id" FROM "Sport" s JOIN "Tournament" t ON t."sportId" = s."id" WHERE t."id" = ${tournamentId} FOR SHARE OF s`;
        if (await tx.match.count({ where: { tournamentId } })) {
          throw new ConflictException(
            'Fixtures already exist for this tournament',
          );
        }
        const teams = await tx.team.findMany({
          where: { id: { in: ids } },
          include: { institute: true },
        });
        if (
          teams.length !== ids.length ||
          teams.some(
            (t) =>
              t.sportId !== tournament.sportId ||
              t.institute.eventId !== tournament.eventId,
          )
        ) {
          throw new BadRequestException(
            'All seeded teams must belong to this tournament sport and event',
          );
        }
        if (dto.defaultVenueId) {
          await tx.$queryRaw`SELECT "id" FROM "Venue" WHERE "id" = ${dto.defaultVenueId} FOR UPDATE`;
          const venue = await tx.venue.findUnique({
            where: { id: dto.defaultVenueId },
          });
          if (!venue || venue.eventId !== tournament.eventId)
            throw new BadRequestException('Venue belongs to a different event');
        }
        const size = 2 ** Math.ceil(Math.log2(ids.length));
        const order = this.calculateBracketSeedOrder(size);
        const seeds = new Map(orderedTeams.map((t) => [t.seedNumber, t.id]));
        const stages = [];
        const rounds: Array<
          Array<{ id: string; teamAId: string | null; teamBId: string | null }>
        > = [];
        const matches = [];
        const capacity = await new MatchesService(
          tx as PrismaService,
          this.rbacService,
        ).generationCapacity(dto);
        let timeSlot = 0;
        for (let slots = size, round = 0; slots >= 2; slots /= 2, round++) {
          const stage = await tx.tournamentStage.create({
            data: {
              tournamentId,
              sequence: round + 1,
              stageType: 'KNOCKOUT',
              name:
                round === 0 && dto.stageName
                  ? dto.stageName
                  : slots === 2
                    ? 'Final'
                    : slots === 4
                      ? 'Semifinals'
                      : slots === 8
                        ? 'Quarterfinals'
                        : `Round of ${slots}`,
            },
          });
          stages.push(stage);
          rounds.push([]);
          for (let position = 0; position < slots / 2; position++) {
            const teamAId =
              round === 0 ? (seeds.get(order[position * 2]) ?? null) : null;
            const teamBId =
              round === 0 ? (seeds.get(order[position * 2 + 1]) ?? null) : null;
            const startTime = new Date(
              Date.parse(dto.startTime) +
                (timeSlot + Math.floor(position / capacity)) *
                  (duration + interval) *
                  60000,
            );
            const endTime = new Date(startTime.getTime() + duration * 60000);
            await new MatchesService(
              tx as PrismaService,
              this.rbacService,
            ).checkSchedulingConflicts({
              startTime,
              endTime,
              venueId: dto.defaultVenueId,
              teamAId: teamAId ?? undefined,
              teamBId: teamBId ?? undefined,
            });
            const match = await tx.match.create({
              data: {
                tournamentId,
                stageId: stage.id,
                venueId: dto.defaultVenueId,
                matchNumber: `R${round + 1}-M${position + 1}`,
                teamAId,
                teamBId,
                scheduledStartTime: startTime,
                scheduledEndTime: endTime,
                status: 'SCHEDULED',
                scoringMode: await this.sportScoringMode(
                  tournament.sportId,
                  dto.scoringMode,
                ),
              },
              include: { teamA: true, teamB: true, venue: true },
            });
            rounds[round].push(match);
            matches.push({
              matchNumber: match.matchNumber,
              seedMatchup:
                round === 0
                  ? `Seed ${order[position * 2]} vs Seed ${order[position * 2 + 1]}`
                  : 'Winners of previous round',
              match,
            });
          }
          timeSlot += Math.ceil(slots / 2 / capacity);
        }
        for (let r = 0; r < rounds.length - 1; r++) {
          for (let i = 0; i < rounds[r].length; i++) {
            const match = rounds[r][i];
            const next = rounds[r + 1][Math.floor(i / 2)];
            await tx.match.update({
              where: { id: match.id },
              data: {
                nextMatchId: next.id,
                nextMatchSlot: i % 2 === 0 ? 'A' : 'B',
              },
            });
            // Only opening-round empty slots are byes; later empty slots await a result.
            if (r === 0 && (!match.teamAId || !match.teamBId)) {
              const winner = match.teamAId || match.teamBId;
              await tx.match.update({
                where: { id: match.id },
                data: { status: 'BYE', winnerTeamId: winner },
              });
              await tx.match.update({
                where: { id: next.id },
                data: { [i % 2 === 0 ? 'teamAId' : 'teamBId']: winner },
              });
            }
          }
        }
        await tx.auditLog.create({
          data: {
            userId,
            action: 'bracket.generate',
            resource: 'Tournament',
            resourceId: tournamentId,
            newState: {
              bracketSize: size,
              seeds: orderedTeams,
              matchCount: matches.length,
            },
          },
        });
        return {
          message:
            'Complete seeded knockout bracket generated. Winners advance on result publication.',
          stage: stages[0],
          stages,
          bracketSize: size,
          matches,
        };
      },
      { timeout: 30000 },
    );
  }

  /**
   * Generates the standard seeding pattern for bracket sizes 2, 4, 8, 16...
   * Ensures:
   * - Seed 1 is in position 0 (Top Half)
   * - Seed 2 is in the second half (Bottom Half)
   * - Top 2 seeds cannot meet until the Finals.
   */
  calculateBracketSeedOrder(numTeams: number): number[] {
    let rounds = Math.log2(numTeams);
    let order = [1, 2];

    for (let r = 1; r < rounds; r++) {
      const nextOrder: number[] = [];
      const currentSum = Math.pow(2, r + 1) + 1;
      for (const seed of order) {
        nextOrder.push(seed);
        nextOrder.push(currentSum - seed);
      }
      order = nextOrder;
    }

    return order;
  }

  // =========================================================================
  // AUTOMATED ROUND ROBIN GENERATOR
  // =========================================================================

  /**
   * Generates a complete round-robin schedule (Berger tables / polygon method)
   * where every team plays every other team once.
   */
  async generateRoundRobin(
    tournamentId: string,
    dto: GenerateRoundRobinDto,
    userId: string,
  ): Promise<any> {
    if (!this.generationTransactionActive)
      return this.generateTransaction(
        tournamentId,
        dto.defaultVenueId,
        (service) => service.generateRoundRobin(tournamentId, dto, userId),
      );
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament)
      throw new NotFoundException(`Tournament "${tournamentId}" not found`);

    await this.verifyStructureAuthority(
      userId,
      tournament.sportId,
      tournament.eventId,
    );

    if (dto.teamIds.length < 2) {
      throw new BadRequestException(
        'At least 2 teams required for round-robin schedule',
      );
    }

    await this.validateField(tournament, dto.teamIds, dto.defaultVenueId);
    if (await this.prisma.match.count({ where: { tournamentId } }))
      throw new ConflictException('Fixtures already exist for this tournament');

    const stage = await this.prisma.tournamentStage.create({
      data: {
        tournamentId,
        name: dto.stageName || 'Group Stage',
        sequence: 1,
        stageType: 'ROUND_ROBIN',
      },
    });

    const teams = [...dto.teamIds];
    const isOdd = teams.length % 2 !== 0;
    if (isOdd) {
      teams.push('BYE');
    }

    const n = teams.length;
    const rounds = n - 1;
    const matchesPerRound = n / 2;

    const matchDuration = dto.matchDurationMinutes || 90;
    const breakMinutes = dto.breakMinutes ?? 30;
    const baseStartTime = new Date(dto.startTime);

    const createdMatches = [];
    const capacity = await this.generationCapacity(dto);

    for (let round = 0; round < rounds; round++) {
      for (let i = 0; i < matchesPerRound; i++) {
        const teamA = teams[i];
        const teamB = teams[n - 1 - i];

        if (teamA === 'BYE' || teamB === 'BYE') continue;

        const matchStart = new Date(
          baseStartTime.getTime() +
            (round * Math.ceil(Math.floor(n / 2) / capacity) +
              Math.floor(i / capacity)) *
              (matchDuration + breakMinutes) *
              60 *
              1000,
        );
        const matchEnd = new Date(
          matchStart.getTime() + matchDuration * 60 * 1000,
        );

        await this.checkSchedulingConflicts({
          startTime: matchStart,
          endTime: matchEnd,
          venueId: dto.defaultVenueId,
          teamAId: teamA,
          teamBId: teamB,
        });
        const match = await this.prisma.match.create({
          data: {
            tournamentId,
            stageId: stage.id,
            venueId: dto.defaultVenueId,
            matchNumber: `RR-R${round + 1}-M${i + 1}`,
            teamAId: teamA,
            teamBId: teamB,
            scheduledStartTime: matchStart,
            scheduledEndTime: matchEnd,
            status: 'SCHEDULED',
            scoringMode: await this.sportScoringMode(
              tournament.sportId,
              dto.scoringMode,
            ),
          },
          include: {
            teamA: { select: { id: true, name: true } },
            teamB: { select: { id: true, name: true } },
          },
        });

        createdMatches.push(match);
      }

      // Rotate array for next round (keep index 0 fixed)
      teams.splice(1, 0, teams.pop()!);
    }

    return {
      message: `Round robin schedule generated with ${createdMatches.length} matches`,
      stage,
      totalMatches: createdMatches.length,
      matches: createdMatches,
    };
  }

  // =========================================================================
  // AUTOMATED SWISS SYSTEM PAIRING (Chess, etc — best-of-N rounds without a
  // full round-robin or knockout bracket)
  // =========================================================================

  /**
   * Generates the next Swiss round for a tournament. Round 1 requires
   * `teamIds` and pairs the top half of the field against the bottom half
   * (standard Swiss seeding). Every later round is derived automatically from
   * standings in prior SWISS stages of this tournament: teams are grouped by
   * score (1 pt win, 0.5 pt draw) and paired within score groups, greedily
   * avoiding repeat pairings. An odd field gets one bye, given to the
   * lowest-scoring team that hasn't already had one.
   */
  async generateSwissRound(
    tournamentId: string,
    dto: GenerateSwissRoundDto,
    userId: string,
  ): Promise<any> {
    if (!this.generationTransactionActive)
      return this.generateTransaction(
        tournamentId,
        dto.defaultVenueId,
        (service) => service.generateSwissRound(tournamentId, dto, userId),
      );
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament)
      throw new NotFoundException(`Tournament "${tournamentId}" not found`);

    await this.verifyStructureAuthority(
      userId,
      tournament.sportId,
      tournament.eventId,
    );

    const priorStages = await this.prisma.tournamentStage.findMany({
      where: { tournamentId, stageType: 'SWISS' },
      orderBy: { sequence: 'asc' },
      include: {
        matches: {
          include: { result: true },
        },
      },
    });
    if (
      priorStages.some((stage) =>
        stage.matches.some(
          (match) =>
            match.teamAId &&
            match.teamBId &&
            match.result?.status !== 'PUBLISHED',
        ),
      )
    ) {
      throw new ConflictException(
        'Publish all results in the previous Swiss round before generating the next round',
      );
    }
    const roundNumber = priorStages.length + 1;

    let teamIds: string[];
    let pairing: [string, string][];
    let byeTeamId: string | undefined;

    if (roundNumber === 1) {
      if (!dto.teamIds || dto.teamIds.length < 2) {
        throw new BadRequestException(
          'At least 2 teams required to start a Swiss tournament (round 1).',
        );
      }
      teamIds = [...dto.teamIds];
      if (teamIds.length % 2 !== 0) {
        byeTeamId = teamIds.pop();
      }
      const half = teamIds.length / 2;
      pairing = teamIds
        .slice(0, half)
        .map((a, i) => [a, teamIds[half + i]] as [string, string]);
    } else {
      // Reconstruct the field and each team's score + prior-opponent set from history.
      const scores = new Map<string, number>();
      const opponents = new Map<string, Set<string>>();
      const byes = new Set<string>();

      for (const stage of priorStages) {
        for (const m of stage.matches) {
          const a = m.teamAId;
          const b = m.teamBId;
          if (!a && !b) continue;
          if (a && !b) {
            byes.add(a);
            scores.set(a, (scores.get(a) || 0) + 1);
            continue;
          }
          if (!a) continue;
          if (!b) continue;

          if (!opponents.has(a)) opponents.set(a, new Set());
          if (!opponents.has(b)) opponents.set(b, new Set());
          opponents.get(a)!.add(b);
          opponents.get(b)!.add(a);

          if (!scores.has(a)) scores.set(a, 0);
          if (!scores.has(b)) scores.set(b, 0);

          const result = m.result;
          if (result?.status === 'PUBLISHED' && result.winnerTeamId) {
            scores.set(
              result.winnerTeamId,
              (scores.get(result.winnerTeamId) || 0) + 1,
            );
          } else if (result?.status === 'PUBLISHED' && !result.winnerTeamId) {
            scores.set(a, (scores.get(a) || 0) + 0.5);
            scores.set(b, (scores.get(b) || 0) + 0.5);
          }
        }
      }

      teamIds = Array.from(scores.keys());
      if (teamIds.length < 2) {
        throw new BadRequestException(
          'Could not determine the Swiss field from prior rounds — no completed pairings found.',
        );
      }

      // Standings order: highest score first (ties broken by team id for determinism).
      const standings = [...teamIds].sort(
        (a, b) =>
          (scores.get(b) || 0) - (scores.get(a) || 0) || a.localeCompare(b),
      );

      let field = standings;
      if (field.length % 2 !== 0) {
        // Lowest-ranked team that hasn't had a bye yet gets this round's bye.
        for (let i = field.length - 1; i >= 0; i--) {
          if (!byes.has(field[i])) {
            byeTeamId = field[i];
            break;
          }
        }
        byeTeamId = byeTeamId || field[field.length - 1];
        field = field.filter((id) => id !== byeTeamId);
      }

      // Greedy pairing: walk standings order, pair each unpaired team with the
      // nearest-ranked unpaired team it hasn't already faced.
      pairing = [];
      const paired = new Set<string>();
      for (let i = 0; i < field.length; i++) {
        const teamA = field[i];
        if (paired.has(teamA)) continue;
        let opponent: string | undefined;
        for (let j = i + 1; j < field.length; j++) {
          const candidate = field[j];
          if (paired.has(candidate)) continue;
          if (!opponents.get(teamA)?.has(candidate)) {
            opponent = candidate;
            break;
          }
        }
        // Fall back to the next unpaired team even on a repeat pairing (small fields
        // can exhaust fresh opponents in later rounds).
        if (!opponent) {
          for (let j = i + 1; j < field.length; j++) {
            if (!paired.has(field[j])) {
              opponent = field[j];
              break;
            }
          }
        }
        if (opponent) {
          pairing.push([teamA, opponent]);
          paired.add(teamA);
          paired.add(opponent);
        }
      }
    }

    await this.validateField(
      tournament,
      Array.from(new Set([...teamIds, ...(byeTeamId ? [byeTeamId] : [])])),
      dto.defaultVenueId,
    );
    const stage = await this.prisma.tournamentStage.create({
      data: {
        tournamentId,
        name: `Swiss Round ${roundNumber}`,
        sequence: roundNumber,
        stageType: 'SWISS',
      },
    });

    const matchDuration = dto.matchDurationMinutes || 60;
    const breakMinutes = dto.breakMinutes ?? 15;
    const baseStartTime = new Date(dto.startTime);

    const capacity = await this.generationCapacity(dto);
    const createdMatches = [];
    for (let i = 0; i < pairing.length; i++) {
      const [teamA, teamB] = pairing[i];
      const matchStart = new Date(
        baseStartTime.getTime() +
          Math.floor(i / capacity) * (matchDuration + breakMinutes) * 60 * 1000,
      );
      const matchEnd = new Date(
        matchStart.getTime() + matchDuration * 60 * 1000,
      );

      await this.checkSchedulingConflicts({
        startTime: matchStart,
        endTime: matchEnd,
        venueId: dto.defaultVenueId,
        teamAId: teamA,
        teamBId: teamB,
      });
      const match = await this.prisma.match.create({
        data: {
          tournamentId,
          stageId: stage.id,
          venueId: dto.defaultVenueId,
          matchNumber: `SW-R${roundNumber}-M${i + 1}`,
          teamAId: teamA,
          teamBId: teamB,
          scheduledStartTime: matchStart,
          scheduledEndTime: matchEnd,
          status: 'SCHEDULED',
          scoringMode: await this.sportScoringMode(
            tournament.sportId,
            dto.scoringMode,
          ),
        },
        include: {
          teamA: { select: { id: true, name: true } },
          teamB: { select: { id: true, name: true } },
        },
      });
      createdMatches.push(match);
    }

    if (byeTeamId) {
      // Recorded as a single-team "match" (teamB null) so it counts as a win in future score tallies.
      await this.prisma.match.create({
        data: {
          tournamentId,
          stageId: stage.id,
          matchNumber: `SW-R${roundNumber}-BYE`,
          teamAId: byeTeamId,
          scheduledStartTime: baseStartTime,
          status: 'COMPLETED',
          actualStartTime: baseStartTime,
          actualEndTime: baseStartTime,
          winnerTeamId: byeTeamId,
        },
      });
    }

    return {
      message: `Swiss round ${roundNumber} generated with ${createdMatches.length} pairing(s)${byeTeamId ? ' and 1 bye' : ''}.`,
      stage,
      roundNumber,
      totalMatches: createdMatches.length,
      matches: createdMatches,
      byeTeamId,
    };
  }
}
