import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InstitutesService } from './institutes.service.js';
import { TeamsService } from './teams.service.js';
import { ParticipantsService } from './participants.service.js';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('Teams, Institutes & Participants Services', () => {
  let prismaMock: any;
  let institutesService: InstitutesService;
  let teamsService: TeamsService;
  let participantsService: ParticipantsService;

  beforeEach(() => {
    prismaMock = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      institute: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      team: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      teamMember: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        upsert: vi.fn(),
      },
      participant: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      event: {
        findUnique: vi.fn(),
      },
      sport: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      gateMovement: {
        create: vi.fn(),
      },
      venue: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(prismaMock)),
    };

    institutesService = new InstitutesService(prismaMock);
    teamsService = new TeamsService(prismaMock);
    participantsService = new ParticipantsService(prismaMock);
  });

  // ===================================
  // INSTITUTES SERVICE
  // ===================================
  describe('InstitutesService', () => {
    it('should return all institutes', async () => {
      prismaMock.institute.findMany.mockResolvedValue([
        { id: 'inst-1', name: 'IIT Jammu', code: 'IITJMU' },
      ]);

      const institutes = await institutesService.getInstitutes('event-1');
      expect(institutes).toHaveLength(1);
      expect(institutes[0].code).toBe('IITJMU');
    });

    it('should throw NotFoundException if institute not found', async () => {
      prismaMock.institute.findUnique.mockResolvedValue(null);

      await expect(
        institutesService.getInstituteById('invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException on duplicate institute code within event', async () => {
      prismaMock.event.findUnique.mockResolvedValue({ id: 'event-1' });
      prismaMock.institute.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        institutesService.createInstitute({
          eventId: 'event-1',
          name: 'IIT Jammu',
          code: 'IITJMU',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create institute successfully', async () => {
      prismaMock.event.findUnique.mockResolvedValue({ id: 'event-1' });
      prismaMock.institute.findFirst.mockResolvedValue(null);
      prismaMock.institute.create.mockResolvedValue({
        id: 'inst-new',
        name: 'NIT Srinagar',
        code: 'NITSRI',
      });

      const res = await institutesService.createInstitute({
        eventId: 'event-1',
        name: 'NIT Srinagar',
        code: 'NITSRI',
      });
      expect(res.id).toBe('inst-new');
    });
  });

  // ===================================
  // TEAMS SERVICE
  // ===================================
  describe('TeamsService', () => {
    it('should create a team when valid event, institute, and sport are provided', async () => {
      prismaMock.event.findUnique.mockResolvedValue({ id: 'event-1' });
      prismaMock.institute.findUnique.mockResolvedValue({
        id: 'inst-1',
        eventId: 'event-1',
      });
      prismaMock.sport.findUnique.mockResolvedValue({
        id: 'sport-1',
        eventId: 'event-1',
      });
      prismaMock.team.create.mockResolvedValue({
        id: 'team-1',
        name: 'IIT Jammu Football Men',
      });

      const team = await teamsService.createTeam({
        eventId: 'event-1',
        instituteId: 'inst-1',
        sportId: 'sport-1',
        name: 'IIT Jammu Football Men',
      });
      expect(team.id).toBe('team-1');
    });

    it('should upsert team member into team roster', async () => {
      prismaMock.team.findUnique.mockResolvedValue({ id: 'team-1' });
      prismaMock.participant.findUnique.mockResolvedValue({ id: 'part-2' });
      prismaMock.teamMember.upsert.mockResolvedValue({
        teamId: 'team-1',
        participantId: 'part-2',
        role: 'PLAYER',
        jerseyNumber: 10,
      });

      const member = await teamsService.addMember('team-1', {
        participantId: 'part-2',
        role: 'PLAYER',
        jerseyNumber: 10,
      });
      expect(member.role).toBe('PLAYER');
      expect(prismaMock.teamMember.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            teamId_participantId: {
              teamId: 'team-1',
              participantId: 'part-2',
            },
          },
        }),
      );
    });

    it('should remove member from team', async () => {
      prismaMock.team.findUnique.mockResolvedValue({ id: 'team-1' });
      prismaMock.teamMember.findUnique.mockResolvedValue({
        teamId: 'team-1',
        participantId: 'part-1',
      });
      prismaMock.teamMember.delete.mockResolvedValue({
        teamId: 'team-1',
        participantId: 'part-1',
      });

      const res = await teamsService.removeMember('team-1', 'part-1');
      expect(res.success).toBe(true);
      expect(prismaMock.teamMember.delete).toHaveBeenCalled();
    });
  });

  // ===================================
  // PARTICIPANTS & SECURITY SERVICE
  // ===================================
  describe('ParticipantsService', () => {
    it('should create participant and generate unique gatePassNumber', async () => {
      prismaMock.event.findUnique.mockResolvedValue({ id: 'event-1' });
      prismaMock.participant.findFirst.mockResolvedValue(null);
      prismaMock.participant.create.mockImplementation(({ data }: any) => {
        return { id: 'p-1', ...data };
      });

      const participant = await participantsService.createParticipant({
        eventId: 'event-1',
        name: 'Rahul Sharma',
        rollNumber: '2023CSB101',
        category: 'ATHLETE',
      });

      expect(participant.id).toBe('p-1');
      expect(participant.gatePassNumber).toMatch(/^CQ26-P-/);
      expect(participant.category).toBe('ATHLETE');
    });

    it('should detect duplicate participant roll number within same institute', async () => {
      prismaMock.event.findUnique.mockResolvedValue({ id: 'event-1' });
      prismaMock.institute.findUnique.mockResolvedValue({ id: 'inst-1' });
      prismaMock.participant.findFirst.mockResolvedValue({ id: 'existing-p' });

      await expect(
        participantsService.createParticipant({
          eventId: 'event-1',
          instituteId: 'inst-1',
          name: 'Rahul Sharma',
          rollNumber: '2023CSB101',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should register on-spot attendee (audience/guest) with immediate pass issuance', async () => {
      prismaMock.event.findUnique.mockResolvedValue({ id: 'event-1' });
      prismaMock.institute.findFirst.mockResolvedValue({ id: 'inst-1' });
      prismaMock.participant.create.mockImplementation(({ data }: any) => ({
        id: 'aud-1',
        ...data,
      }));

      const res = await participantsService.registerOnSpotAttendee({
        eventId: 'event-1',
        name: 'Ananya Verma',
        contactNumber: '9876543210',
        category: 'AUDIENCE',
        instituteName: 'SMVDU',
        photographUrl: 'data:image/jpeg;base64,abc123',
        idDocumentUrl: 'data:image/jpeg;base64,def456',
      });

      expect(res.attendee.name).toBe('Ananya Verma');
      expect(res.attendee.isCheckedIn).toBe(false);
      expect(res.attendee.gatePassNumber).toMatch(/^CQ26-AUD-/);
    });

    it('should fast-search participants for security desk', async () => {
      prismaMock.participant.findMany.mockResolvedValue([
        {
          id: 'p-1',
          name: 'Rahul Sharma',
          rollNumber: '2023CSB101',
          gatePassNumber: 'CQ26-P-ABCD12',
          isCheckedIn: false,
          category: 'ATHLETE',
        },
      ]);

      const results = await participantsService.securitySearch(
        'Rahul',
        'event-1',
      );
      expect(results).toHaveLength(1);
      expect(results[0].gatePassNumber).toBe('CQ26-P-ABCD12');
      expect(prismaMock.participant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventId: 'event-1',
            OR: expect.any(Array),
          }),
        }),
      );
    });

    it('should perform security check-in for registered participant', async () => {
      prismaMock.venue.findUnique.mockResolvedValue({
        id: 'venue-1',
        eventId: 'event-1',
      });
      prismaMock.participant.findFirst.mockResolvedValue({
        id: 'p-1',
        name: 'Rahul Sharma',
        gatePassNumber: 'CQ26-P-ABCD12',
        isCheckedIn: false,
        eventId: 'event-1',
        currentVenueId: null,
      });

      prismaMock.participant.update.mockResolvedValue({
        id: 'p-1',
        name: 'Rahul Sharma',
        gatePassNumber: 'CQ26-P-ABCD12',
        isCheckedIn: true,
        checkedInAt: new Date(),
      });

      const checkInRes = await participantsService.checkInParticipant(
        { gatePassNumber: 'CQ26-P-ABCD12', venueId: 'venue-1' },
        'security-guard-1',
      );

      expect(checkInRes.status).toBe('CHECK_IN_SUCCESS');
      expect(checkInRes.message).toContain('entered successfully');
      expect(checkInRes.participant.isCheckedIn).toBe(true);
      expect(prismaMock.gateMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          direction: 'ENTRY',
          venueId: 'venue-1',
        }),
      });
      expect(prismaMock.auditLog.create).toHaveBeenCalled();
    });

    it('should notify if participant is already checked in', async () => {
      const checkedInTime = new Date();
      prismaMock.participant.findFirst.mockResolvedValue({
        id: 'p-1',
        name: 'Rahul Sharma',
        gatePassNumber: 'CQ26-P-ABCD12',
        isCheckedIn: true,
        checkedInAt: checkedInTime,
      });

      const checkInRes = await participantsService.checkInParticipant({
        gatePassNumber: 'CQ26-P-ABCD12',
      });

      expect(checkInRes.status).toBe('ALREADY_CHECKED_IN');
      expect(checkInRes.message).toContain('already checked in');
    });

    it('should bulk import participants, creating institutes and returning summary', async () => {
      prismaMock.event.findUnique.mockResolvedValue({ id: 'event-1' });
      prismaMock.institute.findFirst.mockResolvedValue(null);
      prismaMock.institute.create.mockResolvedValue({
        id: 'inst-auto',
        name: 'IIT Delhi',
      });
      prismaMock.participant.findFirst.mockResolvedValue(null);
      prismaMock.participant.create.mockImplementation(({ data }: any) => ({
        id: 'imported-p',
        ...data,
      }));

      const summary = await participantsService.bulkImport({
        eventId: 'event-1',
        rows: [
          {
            name: 'Aman Deep',
            college: 'IIT Delhi',
            rollNumber: '2022ME109',
            contactNumber: '9998887776',
            category: 'ATHLETE',
          },
        ],
      });

      expect(summary.totalRows).toBe(1);
      expect(summary.importedCount).toBe(1);
      expect(summary.errors).toHaveLength(0);
      await expect(
        participantsService.bulkImport({
          eventId: 'event-1',
          rows: [{ name: '', college: 'IIT Delhi' }],
        }),
      ).rejects.toThrow('Row 1');
      expect(prismaMock.participant.create).toHaveBeenCalledTimes(1);
    });
  });
});
