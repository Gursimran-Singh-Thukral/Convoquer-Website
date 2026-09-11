import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventsService } from './events.service.js';
import { SportsService } from './sports.service.js';
import { VenuesService } from './venues.service.js';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('Competition Services (Events, Sports, Venues)', () => {
  let prismaMock: any;
  let eventsService: EventsService;
  let sportsService: SportsService;
  let venuesService: VenuesService;

  beforeEach(() => {
    prismaMock = {
      event: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      sport: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      venue: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    eventsService = new EventsService(prismaMock);
    sportsService = new SportsService(prismaMock);
    venuesService = new VenuesService(prismaMock);
  });

  // ===================================
  // EVENTS SERVICE
  // ===================================

  describe('EventsService', () => {
    it('should return list of events', async () => {
      prismaMock.event.findMany.mockResolvedValue([
        { id: 'event-1', name: "Convoquer'26", slug: 'convoquer-26' },
      ]);

      const events = await eventsService.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].slug).toBe('convoquer-26');
    });

    it('should find event by slug', async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: 'event-1',
        slug: 'convoquer-26',
        name: "Convoquer'26",
      });

      const event = await eventsService.getEventByIdOrSlug('convoquer-26');
      expect(event.name).toBe("Convoquer'26");
    });

    it('should throw NotFoundException if event not found', async () => {
      prismaMock.event.findFirst.mockResolvedValue(null);

      await expect(
        eventsService.getEventByIdOrSlug('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException on duplicate slug when creating event', async () => {
      prismaMock.event.findUnique.mockResolvedValue({ id: 'event-old' });

      await expect(
        eventsService.createEvent({
          name: 'Convoquer 26',
          slug: 'convoquer-26',
          edition: '2026',
          startDate: '2026-10-01',
          endDate: '2026-10-04',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ===================================
  // SPORTS SERVICE
  // ===================================

  describe('SportsService', () => {
    it('should retrieve sports filtered by eventId', async () => {
      prismaMock.sport.findMany.mockResolvedValue([
        { id: 'sport-1', name: 'Cricket', eventId: 'event-1' },
        { id: 'sport-2', name: 'Football', eventId: 'event-1' },
      ]);

      const sports = await sportsService.getSports('event-1');
      expect(sports).toHaveLength(2);
      expect(sports[0].name).toBe('Cricket');
    });

    it('should throw NotFoundException on createSport if event does not exist', async () => {
      prismaMock.event.findUnique.mockResolvedValue(null);

      await expect(
        sportsService.createSport({
          eventId: 'invalid-event',
          name: 'Basketball',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException on duplicate sport name in same event', async () => {
      prismaMock.event.findUnique.mockResolvedValue({ id: 'event-1', name: "Convoquer'26" });
      prismaMock.sport.findFirst.mockResolvedValue({ id: 'sport-1', name: 'Cricket' });

      await expect(
        sportsService.createSport({
          eventId: 'event-1',
          name: 'Cricket',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should soft delete sport if teams are attached to it', async () => {
      prismaMock.sport.findUnique.mockResolvedValue({
        id: 'sport-football',
        name: 'Football',
        _count: { teams: 4 },
      });
      prismaMock.sport.update.mockResolvedValue({
        id: 'sport-football',
        status: 'INACTIVE',
      });

      await sportsService.deleteSport('sport-football');
      expect(prismaMock.sport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sport-football' },
          data: { status: 'INACTIVE' },
        }),
      );
    });

    it('should hard delete sport if no teams are attached', async () => {
      prismaMock.sport.findUnique.mockResolvedValue({
        id: 'sport-chess',
        name: 'Chess',
        _count: { teams: 0 },
      });
      prismaMock.sport.delete.mockResolvedValue({ id: 'sport-chess' });

      const res = await sportsService.deleteSport('sport-chess');
      expect(prismaMock.sport.delete).toHaveBeenCalledWith({
        where: { id: 'sport-chess' },
      });
      expect(res.success).toBe(true);
    });
  });

  // ===================================
  // VENUES SERVICE
  // ===================================

  describe('VenuesService', () => {
    it('should retrieve venues for an event', async () => {
      prismaMock.venue.findMany.mockResolvedValue([
        { id: 'v-1', name: 'Main Ground', location: 'Campus West' },
      ]);

      const venues = await venuesService.getVenues('event-1');
      expect(venues).toHaveLength(1);
      expect(venues[0].name).toBe('Main Ground');
    });

    it('should create a new venue', async () => {
      prismaMock.event.findUnique.mockResolvedValue({ id: 'event-1', name: "Convoquer'26" });
      prismaMock.venue.findFirst.mockResolvedValue(null);
      prismaMock.venue.create.mockResolvedValue({
        id: 'v-new',
        name: 'Badminton Court 1',
        location: 'SAC',
      });

      const venue = await venuesService.createVenue({
        eventId: 'event-1',
        name: 'Badminton Court 1',
        location: 'SAC',
      });

      expect(venue.name).toBe('Badminton Court 1');
    });

    it('should throw ConflictException on duplicate venue name in same event', async () => {
      prismaMock.event.findUnique.mockResolvedValue({ id: 'event-1', name: "Convoquer'26" });
      prismaMock.venue.findFirst.mockResolvedValue({ id: 'v-1', name: 'Main Ground' });

      await expect(
        venuesService.createVenue({
          eventId: 'event-1',
          name: 'Main Ground',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
