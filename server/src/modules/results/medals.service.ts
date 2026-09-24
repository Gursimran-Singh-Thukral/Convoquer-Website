import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { RbacService } from '../rbac/rbac.service.js';
import { AwardMedalDto } from './dto/results.dto.js';
import { randomUUID } from 'node:crypto';

export interface InstituteMedalTally {
  instituteId: string;
  instituteName: string;
  shortName: string | null;
  logoUrl: string | null;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
  points: number;
  rank: number;
}

@Injectable()
export class MedalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
  ) {}

  async awardMedal(dto: AwardMedalDto, userId: string, ipAddress?: string) {
    const allowed = await this.rbacService.hasPermission(
      userId,
      'result.approve',
      { sportId: dto.sportId, eventId: dto.eventId },
    );
    if (!allowed) {
      throw new ForbiddenException(
        'You are not authorized to award medals for this sport',
      );
    }

    const validTypes = ['GOLD', 'SILVER', 'BRONZE'];
    const type = dto.type.toUpperCase();
    if (!validTypes.includes(type)) {
      throw new BadRequestException(
        `Invalid medal type "${dto.type}". Must be GOLD, SILVER, or BRONZE.`,
      );
    }

    const institute = await this.prisma.institute.findUnique({
      where: { id: dto.instituteId },
    });
    if (!institute) {
      throw new NotFoundException(`Institute "${dto.instituteId}" not found`);
    }

    const event = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
    });
    if (!event) {
      throw new NotFoundException(`Event "${dto.eventId}" not found`);
    }

    const sport = await this.prisma.sport.findUnique({
      where: { id: dto.sportId },
    });
    if (
      !sport ||
      sport.eventId !== dto.eventId ||
      institute.eventId !== dto.eventId
    ) {
      throw new BadRequestException(
        'Medal sport and institute must belong to the selected event',
      );
    }
    if (dto.tournamentId) {
      const tournament = await this.prisma.tournament.findUnique({
        where: { id: dto.tournamentId },
      });
      if (
        !tournament ||
        tournament.eventId !== dto.eventId ||
        tournament.sportId !== dto.sportId
      ) {
        throw new BadRequestException(
          'Medal tournament must belong to the selected event and sport',
        );
      }
    }

    const medal = await this.prisma.medal.upsert({
      where: dto.tournamentId
        ? { tournamentId_type: { tournamentId: dto.tournamentId, type } }
        : { id: randomUUID() },
      update: {
        instituteId: dto.instituteId,
        sportId: dto.sportId,
        notes: dto.notes,
        awardedBy: userId,
        awardedAt: new Date(),
      },
      create: {
        eventId: dto.eventId,
        sportId: dto.sportId,
        tournamentId: dto.tournamentId,
        instituteId: dto.instituteId,
        type,
        notes: dto.notes,
        awardedBy: userId,
      },
      include: {
        institute: true,
        sport: true,
        tournament: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'medal.award',
        resource: 'Medal',
        resourceId: medal.id,
        newState: {
          instituteId: dto.instituteId,
          type,
          sportId: dto.sportId,
          tournamentId: dto.tournamentId,
        },
        ipAddress,
      },
    });

    return medal;
  }

  async getMedalTally(eventId?: string): Promise<InstituteMedalTally[]> {
    let targetEventId = eventId;
    if (!targetEventId) {
      const activeEvent =
        (await this.prisma.event.findFirst({ where: { status: 'ACTIVE' } })) ||
        (await this.prisma.event.findFirst());
      targetEventId = activeEvent?.id;
    }

    if (!targetEventId) {
      return [];
    }

    const institutes = await this.prisma.institute.findMany({
      where: { eventId: targetEventId },
      include: {
        medals: {
          where: { eventId: targetEventId },
        },
      },
    });

    const tallyList: InstituteMedalTally[] = institutes.map((inst) => {
      let gold = 0;
      let silver = 0;
      let bronze = 0;

      for (const m of inst.medals) {
        if (m.type === 'GOLD') gold++;
        else if (m.type === 'SILVER') silver++;
        else if (m.type === 'BRONZE') bronze++;
      }

      const total = gold + silver + bronze;
      // Formula: Gold = 5 pts, Silver = 3 pts, Bronze = 1 pt
      const points = gold * 5 + silver * 3 + bronze * 1;

      return {
        instituteId: inst.id,
        instituteName: inst.name,
        shortName: inst.shortName,
        logoUrl: inst.logoUrl,
        gold,
        silver,
        bronze,
        total,
        points,
        rank: 0,
      };
    });

    // Sort Olympic style: Gold desc -> Silver desc -> Bronze desc -> Total desc
    tallyList.sort((a, b) => {
      if (b.gold !== a.gold) return b.gold - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      if (b.bronze !== a.bronze) return b.bronze - a.bronze;
      return b.total - a.total;
    });

    tallyList.forEach((item, index) => {
      item.rank = index + 1;
    });

    return tallyList;
  }

  async getMedals(filters: {
    eventId?: string;
    sportId?: string;
    tournamentId?: string;
    instituteId?: string;
  }) {
    return this.prisma.medal.findMany({
      where: {
        ...(filters.eventId ? { eventId: filters.eventId } : {}),
        ...(filters.sportId ? { sportId: filters.sportId } : {}),
        ...(filters.tournamentId ? { tournamentId: filters.tournamentId } : {}),
        ...(filters.instituteId ? { instituteId: filters.instituteId } : {}),
      },
      include: {
        institute: {
          select: { id: true, name: true, shortName: true, logoUrl: true },
        },
        sport: { select: { id: true, name: true } },
        tournament: { select: { id: true, name: true } },
      },
      orderBy: { awardedAt: 'desc' },
    });
  }
}
