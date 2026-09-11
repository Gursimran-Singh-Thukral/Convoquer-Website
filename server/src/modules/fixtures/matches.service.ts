import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import {
  CreateMatchDto,
  UpdateMatchDto,
  RescheduleMatchDto,
  AssignOfficialDto,
  GenerateKnockoutBracketDto,
  GenerateRoundRobinDto,
} from './dto/fixtures.dto.js';

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

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
            user: { select: { id: true, name: true, email: true } },
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
              include: { participant: true },
            },
          },
        },
        teamB: {
          include: {
            institute: true,
            members: {
              include: { participant: true },
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
                email: true,
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
        throw new ConflictException(
          `Scheduling conflict: Venue "${venueConflict.venue?.name || venueId}" already has Match "${venueConflict.matchNumber || venueConflict.id}" scheduled between ${venueConflict.scheduledStartTime.toISOString()} and ${venueConflict.scheduledEndTime?.toISOString() || 'TBD'}`,
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

  async createMatch(dto: CreateMatchDto) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: dto.tournamentId },
    });
    if (!tournament)
      throw new NotFoundException(`Tournament "${dto.tournamentId}" not found`);

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
      },
      include: {
        teamA: true,
        teamB: true,
        venue: true,
      },
    });
  }

  async updateMatch(id: string, dto: UpdateMatchDto) {
    const existing = await this.prisma.match.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Match "${id}" not found`);

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

    return this.prisma.match.update({
      where: { id },
      data: {
        stageId: dto.stageId,
        venueId: dto.venueId,
        matchNumber: dto.matchNumber,
        teamAId: dto.teamAId,
        teamBId: dto.teamBId,
        teamAScore: dto.teamAScore,
        teamBScore: dto.teamBScore,
        winnerTeamId: dto.winnerTeamId,
        status: dto.status,
        scheduledStartTime: dto.scheduledStartTime ? startTime : undefined,
        scheduledEndTime: dto.scheduledEndTime ? endTime : undefined,
        scoreDetails: dto.scoreDetails,
      },
      include: {
        teamA: true,
        teamB: true,
        venue: true,
        winnerTeam: true,
      },
    });
  }

  async rescheduleMatch(id: string, dto: RescheduleMatchDto, userId?: string) {
    const match = await this.prisma.match.findUnique({ where: { id } });
    if (!match) throw new NotFoundException(`Match "${id}" not found`);

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

  async assignOfficial(matchId: string, dto: AssignOfficialDto) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });
    if (!match) throw new NotFoundException(`Match "${matchId}" not found`);

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

  async removeOfficial(matchId: string, userId: string) {
    const existing = await this.prisma.matchOfficial.findUnique({
      where: {
        matchId_userId: { matchId, userId },
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
  ) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { seeds: { orderBy: { seedNumber: 'asc' } } },
    });
    if (!tournament)
      throw new NotFoundException(`Tournament "${tournamentId}" not found`);

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

    // Determine nearest power of 2 bracket size (e.g., 2, 4, 8, 16)
    let bracketSize = 2;
    while (bracketSize < orderedTeams.length) {
      bracketSize *= 2;
    }

    // Standard bracket pairing order algorithm (Binary bit reversal fold)
    // Ensures:
    // - Seed 1 is in Top half
    // - Seed 2 is in Bottom half
    // - They meet ONLY in the Finals!
    const seedPositions = this.calculateBracketSeedOrder(bracketSize);

    // Create a stage for the opening knockout round (e.g. Quarterfinals / Semifinals)
    const stageName =
      dto.stageName ||
      (bracketSize === 2
        ? 'Final'
        : bracketSize === 4
          ? 'Semifinals'
          : bracketSize === 8
            ? 'Quarterfinals'
            : `Round of ${bracketSize}`);

    const stage = await this.prisma.tournamentStage.create({
      data: {
        tournamentId,
        name: stageName,
        sequence: 1,
        stageType: 'KNOCKOUT',
      },
    });

    // Map seeded teams to their bracket seed slots
    const seedToTeamMap = new Map<number, string>();
    for (const t of orderedTeams) {
      seedToTeamMap.set(t.seedNumber, t.id);
    }

    const matchDuration = dto.matchDurationMinutes || 90;
    const breakMinutes = dto.breakMinutes || 30;
    const baseStartTime = new Date(dto.startTime);

    const matchesCreated = [];
    const totalMatches = bracketSize / 2;

    for (let m = 0; m < totalMatches; m++) {
      const seedA = seedPositions[m * 2];
      const seedB = seedPositions[m * 2 + 1];

      const teamAId = seedToTeamMap.get(seedA) || null;
      const teamBId = seedToTeamMap.get(seedB) || null;

      const matchStart = new Date(
        baseStartTime.getTime() +
          m * (matchDuration + breakMinutes) * 60 * 1000,
      );
      const matchEnd = new Date(
        matchStart.getTime() + matchDuration * 60 * 1000,
      );

      const matchNumber = `${tournament.name.substring(0, 4).toUpperCase()}-M0${m + 1}`;

      const createdMatch = await this.prisma.match.create({
        data: {
          tournamentId,
          stageId: stage.id,
          venueId: dto.defaultVenueId,
          matchNumber,
          teamAId,
          teamBId,
          scheduledStartTime: matchStart,
          scheduledEndTime: matchEnd,
          status: 'SCHEDULED',
        },
        include: {
          teamA: { select: { id: true, name: true } },
          teamB: { select: { id: true, name: true } },
          venue: true,
        },
      });

      matchesCreated.push({
        matchNumber,
        seedMatchup: `Seed ${seedA} vs Seed ${seedB}`,
        match: createdMatch,
      });
    }

    return {
      message: `Knockout bracket generated for ${bracketSize} slots with guaranteed top-seed separation before Finals`,
      stage,
      bracketSize,
      matches: matchesCreated,
    };
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
  async generateRoundRobin(tournamentId: string, dto: GenerateRoundRobinDto) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament)
      throw new NotFoundException(`Tournament "${tournamentId}" not found`);

    if (dto.teamIds.length < 2) {
      throw new BadRequestException(
        'At least 2 teams required for round-robin schedule',
      );
    }

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
    const breakMinutes = dto.breakMinutes || 30;
    const baseStartTime = new Date(dto.startTime);

    const createdMatches = [];
    let matchCounter = 1;

    for (let round = 0; round < rounds; round++) {
      for (let i = 0; i < matchesPerRound; i++) {
        const teamA = teams[i];
        const teamB = teams[n - 1 - i];

        if (teamA === 'BYE' || teamB === 'BYE') continue;

        const matchStart = new Date(
          baseStartTime.getTime() +
            (matchCounter - 1) * (matchDuration + breakMinutes) * 60 * 1000,
        );
        const matchEnd = new Date(
          matchStart.getTime() + matchDuration * 60 * 1000,
        );

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
          },
          include: {
            teamA: { select: { id: true, name: true } },
            teamB: { select: { id: true, name: true } },
          },
        });

        createdMatches.push(match);
        matchCounter++;
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
}
