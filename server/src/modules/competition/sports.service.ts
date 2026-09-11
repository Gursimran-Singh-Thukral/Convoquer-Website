import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateSportDto, UpdateSportDto } from './dto/competition.dto.js';

@Injectable()
export class SportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSports(eventId?: string, status?: string) {
    return this.prisma.sport.findMany({
      where: {
        ...(eventId ? { eventId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        event: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { teams: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getSportById(id: string) {
    const sport = await this.prisma.sport.findUnique({
      where: { id },
      include: {
        event: true,
        teams: {
          include: { institute: true },
        },
      },
    });

    if (!sport) {
      throw new NotFoundException(`Sport with id "${id}" not found`);
    }

    return sport;
  }

  async createSport(dto: CreateSportDto) {
    const event = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
    });
    if (!event) {
      throw new NotFoundException(`Event with id "${dto.eventId}" not found`);
    }

    const existing = await this.prisma.sport.findFirst({
      where: { eventId: dto.eventId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `Sport "${dto.name}" already exists in event "${event.name}"`,
      );
    }

    return this.prisma.sport.create({
      data: {
        eventId: dto.eventId,
        name: dto.name,
        description: dto.description,
        status: dto.status || 'ACTIVE',
      },
      include: { event: true },
    });
  }

  async updateSport(id: string, dto: UpdateSportDto) {
    const existing = await this.prisma.sport.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Sport with id "${id}" not found`);
    }

    if (dto.name && dto.name !== existing.name) {
      const clash = await this.prisma.sport.findFirst({
        where: { eventId: existing.eventId, name: dto.name },
      });
      if (clash) {
        throw new ConflictException(
          `Sport "${dto.name}" already exists in this event`,
        );
      }
    }

    return this.prisma.sport.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
      },
    });
  }

  async deleteSport(id: string) {
    const existing = await this.prisma.sport.findUnique({
      where: { id },
      include: { _count: { select: { teams: true } } },
    });
    if (!existing) {
      throw new NotFoundException(`Sport with id "${id}" not found`);
    }

    if (existing._count.teams > 0) {
      // Soft-delete if registered teams exist
      return this.prisma.sport.update({
        where: { id },
        data: { status: 'INACTIVE' },
      });
    }

    await this.prisma.sport.delete({ where: { id } });
    return { success: true, message: `Sport "${existing.name}" deleted` };
  }
}
