import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import {
  CreateEventDto,
  UpdateEventDto,
} from './dto/competition.dto.js';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEvents(status?: string) {
    return this.prisma.event.findMany({
      where: status ? { status } : undefined,
      include: {
        _count: {
          select: {
            sports: true,
            venues: true,
            institutes: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async getEventByIdOrSlug(idOrSlug: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        sports: { orderBy: { name: 'asc' } },
        venues: { orderBy: { name: 'asc' } },
        _count: {
          select: {
            institutes: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event "${idOrSlug}" not found`);
    }

    return event;
  }

  async createEvent(dto: CreateEventDto) {
    const existing = await this.prisma.event.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(`Event with slug "${dto.slug}" already exists`);
    }

    return this.prisma.event.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        edition: dto.edition,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        description: dto.description,
        status: dto.status || 'DRAFT',
      },
    });
  }

  async updateEvent(id: string, dto: UpdateEventDto) {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Event with id "${id}" not found`);
    }

    if (dto.slug && dto.slug !== existing.slug) {
      const slugClash = await this.prisma.event.findUnique({
        where: { slug: dto.slug },
      });
      if (slugClash) {
        throw new ConflictException(`Event with slug "${dto.slug}" already exists`);
      }
    }

    return this.prisma.event.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        edition: dto.edition,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        description: dto.description,
        status: dto.status,
      },
    });
  }
}
