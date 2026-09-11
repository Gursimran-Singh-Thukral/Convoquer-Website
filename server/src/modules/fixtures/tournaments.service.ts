import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import {
  CreateTournamentDto,
  UpdateTournamentDto,
  CreateStageDto,
  UpdateStageDto,
  SetSeedsDto,
} from './dto/fixtures.dto.js';

@Injectable()
export class TournamentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTournaments(eventId?: string, sportId?: string) {
    return this.prisma.tournament.findMany({
      where: {
        ...(eventId ? { eventId } : {}),
        ...(sportId ? { sportId } : {}),
      },
      include: {
        sport: { select: { id: true, name: true } },
        stages: { orderBy: { sequence: 'asc' } },
        seeds: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                institute: { select: { name: true, shortName: true } },
              },
            },
          },
          orderBy: { seedNumber: 'asc' },
        },
        _count: {
          select: { matches: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTournamentById(id: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        sport: true,
        event: true,
        stages: {
          orderBy: { sequence: 'asc' },
          include: {
            matches: {
              include: {
                teamA: {
                  include: {
                    institute: { select: { shortName: true, name: true } },
                  },
                },
                teamB: {
                  include: {
                    institute: { select: { shortName: true, name: true } },
                  },
                },
                winnerTeam: { select: { id: true, name: true } },
                venue: true,
              },
              orderBy: { scheduledStartTime: 'asc' },
            },
          },
        },
        seeds: {
          include: {
            team: {
              include: {
                institute: { select: { name: true, shortName: true } },
              },
            },
          },
          orderBy: { seedNumber: 'asc' },
        },
        matches: {
          include: {
            teamA: { select: { id: true, name: true } },
            teamB: { select: { id: true, name: true } },
            venue: true,
            officials: {
              include: { user: { select: { id: true, name: true } } },
            },
          },
          orderBy: { scheduledStartTime: 'asc' },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException(`Tournament with id "${id}" not found`);
    }

    return tournament;
  }

  async createTournament(dto: CreateTournamentDto) {
    const event = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
    });
    if (!event) throw new NotFoundException(`Event "${dto.eventId}" not found`);

    const sport = await this.prisma.sport.findUnique({
      where: { id: dto.sportId },
    });
    if (!sport) throw new NotFoundException(`Sport "${dto.sportId}" not found`);

    return this.prisma.tournament.create({
      data: {
        eventId: dto.eventId,
        sportId: dto.sportId,
        name: dto.name,
        format: dto.format || 'KNOCKOUT',
        pointsForWin: dto.pointsForWin ?? 3,
        pointsForDraw: dto.pointsForDraw ?? 1,
        pointsForLoss: dto.pointsForLoss ?? 0,
        rulesJson: dto.rulesJson,
      },
      include: {
        sport: true,
      },
    });
  }

  async updateTournament(id: string, dto: UpdateTournamentDto) {
    const existing = await this.prisma.tournament.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Tournament "${id}" not found`);
    }

    return this.prisma.tournament.update({
      where: { id },
      data: {
        name: dto.name,
        format: dto.format,
        status: dto.status,
        pointsForWin: dto.pointsForWin,
        pointsForDraw: dto.pointsForDraw,
        pointsForLoss: dto.pointsForLoss,
        rulesJson: dto.rulesJson,
      },
      include: {
        sport: true,
      },
    });
  }

  // ===================================
  // TOURNAMENT SEEDING ENGINE
  // ===================================

  /**
   * Set or update team seeds for a tournament.
   * Ensures top seeds (e.g. Seed 1 & Seed 2) are placed on opposite bracket halves
   * so they cannot face each other until the Finals.
   */
  async setSeeds(tournamentId: string, dto: SetSeedsDto) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) {
      throw new NotFoundException(`Tournament "${tournamentId}" not found`);
    }

    // Validate unique seed numbers and unique team IDs in payload
    const seedNumbers = new Set<number>();
    const teamIds = new Set<string>();

    for (const seed of dto.seeds) {
      if (seedNumbers.has(seed.seedNumber)) {
        throw new BadRequestException(
          `Duplicate seed number: ${seed.seedNumber}`,
        );
      }
      if (teamIds.has(seed.teamId)) {
        throw new BadRequestException(
          `Duplicate team in seeding list: ${seed.teamId}`,
        );
      }
      seedNumbers.add(seed.seedNumber);
      teamIds.add(seed.teamId);
    }

    // Clear existing seeds and create new seeds in a transaction
    return this.prisma.$transaction(async (tx) => {
      await tx.tournamentTeamSeed.deleteMany({
        where: { tournamentId },
      });

      const createdSeeds = [];
      for (const s of dto.seeds) {
        const team = await tx.team.findUnique({ where: { id: s.teamId } });
        if (!team) {
          throw new NotFoundException(`Team "${s.teamId}" not found`);
        }

        const seedRecord = await tx.tournamentTeamSeed.create({
          data: {
            tournamentId,
            teamId: s.teamId,
            seedNumber: s.seedNumber,
            notes: s.notes,
          },
          include: {
            team: {
              include: {
                institute: { select: { name: true, shortName: true } },
              },
            },
          },
        });
        createdSeeds.push(seedRecord);
      }

      return {
        message: 'Tournament seeds configured successfully',
        seeds: createdSeeds.sort((a, b) => a.seedNumber - b.seedNumber),
      };
    });
  }

  async getSeeds(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament)
      throw new NotFoundException(`Tournament "${tournamentId}" not found`);

    return this.prisma.tournamentTeamSeed.findMany({
      where: { tournamentId },
      include: {
        team: {
          include: {
            institute: { select: { name: true, shortName: true } },
          },
        },
      },
      orderBy: { seedNumber: 'asc' },
    });
  }

  // ===================================
  // STAGES / ROUNDS
  // ===================================

  async createStage(tournamentId: string, dto: CreateStageDto) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament)
      throw new NotFoundException(`Tournament "${tournamentId}" not found`);

    return this.prisma.tournamentStage.create({
      data: {
        tournamentId,
        name: dto.name,
        sequence: dto.sequence ?? 1,
        stageType: dto.stageType || 'KNOCKOUT',
      },
    });
  }

  async updateStage(stageId: string, dto: UpdateStageDto) {
    const stage = await this.prisma.tournamentStage.findUnique({
      where: { id: stageId },
    });
    if (!stage) throw new NotFoundException(`Stage "${stageId}" not found`);

    return this.prisma.tournamentStage.update({
      where: { id: stageId },
      data: {
        name: dto.name,
        sequence: dto.sequence,
        status: dto.status,
      },
    });
  }
}
