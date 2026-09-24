import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateVenueDto, UpdateVenueDto } from './dto/competition.dto.js';

function validateMapCoords(mapX?: number | null, mapY?: number | null) {
  for (const [key, val] of [
    ['mapX', mapX],
    ['mapY', mapY],
  ] as const) {
    if (val !== undefined && val !== null && (val < 0 || val > 100)) {
      throw new BadRequestException(`${key} must be between 0 and 100`);
    }
  }
}

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

    validateMapCoords(dto.mapX, dto.mapY);
    if (
      (dto.latitude != null) !== (dto.longitude != null) ||
      (dto.latitude === undefined) !== (dto.longitude === undefined)
    )
      throw new BadRequestException(
        'Provide both latitude and longitude, or clear both',
      );

    return this.prisma.venue.create({
      data: {
        eventId: dto.eventId,
        name: dto.name,
        location: dto.location,
        status: dto.status || 'ACTIVE',
        latitude: dto.latitude,
        longitude: dto.longitude,
        simultaneousMatches: dto.simultaneousMatches,
        mapX: dto.mapX,
        mapY: dto.mapY,
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

    validateMapCoords(dto.mapX, dto.mapY);
    if (
      (dto.latitude != null) !== (dto.longitude != null) ||
      (dto.latitude === undefined) !== (dto.longitude === undefined)
    )
      throw new BadRequestException(
        'Provide both latitude and longitude, or clear both',
      );

    return this.prisma.venue.update({
      where: { id },
      data: {
        name: dto.name,
        location: dto.location,
        status: dto.status,
        latitude: dto.latitude,
        longitude: dto.longitude,
        simultaneousMatches: dto.simultaneousMatches,
        mapX: dto.mapX,
        mapY: dto.mapY,
      },
    });
  }

  async deleteVenue(id: string) {
    const existing = await this.prisma.venue.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Venue with id "${id}" not found`);
    }

    if (await this.prisma.match.count({ where: { venueId: id } })) {
      return this.prisma.venue.update({
        where: { id },
        data: { status: 'INACTIVE' },
      });
    }
    await this.prisma.venue.delete({ where: { id } });
    return { success: true, message: `Venue "${existing.name}" deleted` };
  }
}
