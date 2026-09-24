import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateEventDto, UpdateEventDto } from './dto/competition.dto.js';

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

  /**
   * Headline metrics shown on the public homepage hero strip. Resolves the active
   * event (falling back to the most recent one) so the numbers stay accurate as
   * institutes register, athletes are added, and medals get awarded.
   */
  async getHomepageStats(eventId?: string) {
    let targetEventId = eventId;
    if (!targetEventId) {
      const activeEvent =
        (await this.prisma.event.findFirst({ where: { status: 'ACTIVE' } })) ||
        (await this.prisma.event.findFirst({ orderBy: { startDate: 'desc' } }));
      targetEventId = activeEvent?.id;
    }

    if (!targetEventId) {
      return {
        eliteUniversities: 0,
        cardedAthletes: 0,
        olympicDisciplines: 0,
        podiumMedals: 0,
      };
    }

    const [
      eliteUniversities,
      cardedAthletes,
      olympicDisciplines,
      podiumMedals,
    ] = await Promise.all([
      this.prisma.institute.count({
        where: { eventId: targetEventId, status: 'ACTIVE' },
      }),
      this.prisma.participant.count({
        where: { eventId: targetEventId, category: 'ATHLETE' },
      }),
      this.prisma.sport.count({
        where: { eventId: targetEventId, status: 'ACTIVE' },
      }),
      this.prisma.medal.count({ where: { eventId: targetEventId } }),
    ]);

    return {
      eliteUniversities,
      cardedAthletes,
      olympicDisciplines,
      podiumMedals,
    };
  }

  async createEvent(dto: CreateEventDto, userId?: string) {
    this.validateEvent(dto.startDate, dto.endDate, dto.slug, dto.status);
    const existing = await this.prisma.event.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(
        `Event with slug "${dto.slug}" already exists`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
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
      await tx.auditLog.create({
        data: {
          userId,
          action: 'event.create',
          resource: 'Event',
          resourceId: event.id,
          newState: { name: event.name, status: event.status },
        },
      });
      return event;
    });
  }

  async updateEvent(id: string, dto: UpdateEventDto, userId?: string) {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Event with id "${id}" not found`);
    }
    this.validateEvent(
      dto.startDate ?? existing.startDate,
      dto.endDate ?? existing.endDate,
      dto.slug ?? existing.slug,
      dto.status ?? existing.status,
    );

    if (dto.slug && dto.slug !== existing.slug) {
      const slugClash = await this.prisma.event.findUnique({
        where: { slug: dto.slug },
      });
      if (slugClash) {
        throw new ConflictException(
          `Event with slug "${dto.slug}" already exists`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.update({
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
      await tx.auditLog.create({
        data: {
          userId,
          action: 'event.update',
          resource: 'Event',
          resourceId: id,
          previousState: { name: existing.name, status: existing.status },
          newState: { name: event.name, status: event.status },
        },
      });
      return event;
    });
  }

  private validateEvent(
    start: string | Date,
    end: string | Date,
    slug: string,
    status?: string,
  ) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
      throw new BadRequestException(
        'Use a lowercase URL slug with letters, numbers and hyphens',
      );
    const startTime = new Date(start).getTime(),
      endTime = new Date(end).getTime();
    if (
      !Number.isFinite(startTime) ||
      !Number.isFinite(endTime) ||
      endTime <= startTime
    )
      throw new BadRequestException('End date must be after start date');
    if (
      status &&
      !['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'].includes(status)
    )
      throw new BadRequestException('Invalid event status');
  }

  async deleteEvent(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${id} FOR UPDATE`;
      const event = await tx.event.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              sports: true,
              venues: true,
              institutes: true,
              teams: true,
              participants: true,
              tournaments: true,
              medals: true,
            },
          },
        },
      });
      if (!event) throw new NotFoundException('Event not found');
      if (Object.values(event._count).some((count) => count > 0))
        throw new ConflictException(
          'This event contains competition or registration records. Archive it to preserve history.',
        );
      await tx.event.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          userId,
          action: 'event.delete',
          resource: 'Event',
          resourceId: id,
          previousState: { name: event.name, slug: event.slug },
        },
      });
      return { success: true };
    });
  }
}
