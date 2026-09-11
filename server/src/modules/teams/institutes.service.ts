import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import {
  CreateInstituteDto,
  UpdateInstituteDto,
} from './dto/teams.dto.js';

@Injectable()
export class InstitutesService {
  constructor(private readonly prisma: PrismaService) {}

  async getInstitutes(eventId?: string, status?: string) {
    return this.prisma.institute.findMany({
      where: {
        ...(eventId ? { eventId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        event: { select: { id: true, name: true, slug: true } },
        _count: {
          select: { teams: true, participants: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getInstituteById(id: string) {
    const institute = await this.prisma.institute.findUnique({
      where: { id },
      include: {
        event: true,
        teams: {
          include: {
            sport: true,
            _count: { select: { members: true } },
          },
        },
        participants: {
          select: {
            id: true,
            name: true,
            category: true,
            gender: true,
            photographUrl: true,
            isCheckedIn: true,
          },
        },
      },
    });

    if (!institute) {
      throw new NotFoundException(`Institute with id "${id}" not found`);
    }

    return institute;
  }

  async createInstitute(dto: CreateInstituteDto) {
    const event = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
    });
    if (!event) {
      throw new NotFoundException(`Event with id "${dto.eventId}" not found`);
    }

    const existing = await this.prisma.institute.findFirst({
      where: { eventId: dto.eventId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `Institute "${dto.name}" already registered for this event`,
      );
    }

    return this.prisma.institute.create({
      data: {
        eventId: dto.eventId,
        name: dto.name,
        shortName: dto.shortName,
        logoUrl: dto.logoUrl,
        city: dto.city,
        state: dto.state,
      },
      include: { event: true },
    });
  }

  async updateInstitute(id: string, dto: UpdateInstituteDto) {
    const existing = await this.prisma.institute.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Institute with id "${id}" not found`);
    }

    if (dto.name && dto.name !== existing.name) {
      const clash = await this.prisma.institute.findFirst({
        where: { eventId: existing.eventId, name: dto.name },
      });
      if (clash) {
        throw new ConflictException(
          `Institute "${dto.name}" already registered for this event`,
        );
      }
    }

    return this.prisma.institute.update({
      where: { id },
      data: {
        name: dto.name,
        shortName: dto.shortName,
        logoUrl: dto.logoUrl,
        city: dto.city,
        state: dto.state,
        status: dto.status,
      },
    });
  }
}
