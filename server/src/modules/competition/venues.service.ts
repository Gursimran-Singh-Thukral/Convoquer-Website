import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateVenueDto, UpdateVenueDto } from './dto/competition.dto.js';

@Injectable()
export class VenuesService {
  constructor(private readonly prisma: PrismaService) {}

  async getVenues(eventId?: string, status?: string) {
    return this.prisma.venue.findMany({
      where: {
        ...(eventId ? { eventId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        event: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getVenueById(id: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id },
      include: { event: true },
    });

    if (!venue) {
      throw new NotFoundException(`Venue with id "${id}" not found`);
    }

    return venue;
  }

  async createVenue(dto: CreateVenueDto) {
    const event = await this.prisma.event.findUnique({
      where: { id: dto.eventId },
    });
    if (!event) {
      throw new NotFoundException(`Event with id "${dto.eventId}" not found`);
    }

    const existing = await this.prisma.venue.findFirst({
      where: { eventId: dto.eventId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `Venue "${dto.name}" already exists in event "${event.name}"`,
      );
    }

    return this.prisma.venue.create({
      data: {
        eventId: dto.eventId,
        name: dto.name,
        location: dto.location,
        status: dto.status || 'ACTIVE',
      },
      include: { event: true },
    });
  }

  async updateVenue(id: string, dto: UpdateVenueDto) {
    const existing = await this.prisma.venue.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Venue with id "${id}" not found`);
    }

    if (dto.name && dto.name !== existing.name) {
      const clash = await this.prisma.venue.findFirst({
        where: { eventId: existing.eventId, name: dto.name },
      });
      if (clash) {
        throw new ConflictException(
          `Venue "${dto.name}" already exists in this event`,
        );
      }
    }

    return this.prisma.venue.update({
      where: { id },
      data: {
        name: dto.name,
        location: dto.location,
        status: dto.status,
      },
    });
  }

  async deleteVenue(id: string) {
    const existing = await this.prisma.venue.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Venue with id "${id}" not found`);
    }

    await this.prisma.venue.delete({ where: { id } });
    return { success: true, message: `Venue "${existing.name}" deleted` };
  }
}
