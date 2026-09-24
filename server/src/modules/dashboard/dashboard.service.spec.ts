import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DashboardService } from './dashboard.service.js';

describe('DashboardService & Role-Adaptive Aggregations', () => {
  let prismaMock: any;
  let dashboardService: DashboardService;

  beforeEach(() => {
    prismaMock = {
      userRole: {
        findMany: vi.fn(),
      },
      sport: {
        count: vi.fn(),
        findUnique: vi.fn(),
      },
      tournament: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      team: {
        count: vi.fn(),
      },
      match: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      result: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      participant: {
        count: vi.fn(),
      },
      institute: {
        findMany: vi.fn(),
      },
      venue: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      auditLog: {
        findMany: vi.fn(),
      },
      matchOfficial: {
        findMany: vi.fn(),
      },
      volunteer: {
        findUnique: vi.fn(),
      },
      operationsTask: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      teamMember: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const sponsorsServiceMock: any = {
      getSponsors: vi.fn().mockResolvedValue([]),
    };

    dashboardService = new DashboardService(prismaMock, sponsorsServiceMock);
  });

  describe('Role Context Resolution', () => {
    it('should detect CONVENER as highest priority role', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([
        { role: { name: 'VOLUNTEER' } },
        { role: { name: 'CONVENER' } },
      ]);

      const ctx = await dashboardService.getUserRoleContext('user-1');
      expect(ctx.primaryRole).toBe('CONVENER');
    });

    it('should detect SPORTS_COORDINATOR and capture scopedSportId', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([
        {
          role: { name: 'SPORTS_COORDINATOR' },
          sportId: 'sport-football',
          eventId: 'event-1',
        },
      ]);

      const ctx = await dashboardService.getUserRoleContext('user-coord');
      expect(ctx.primaryRole).toBe('SPORTS_COORDINATOR');
      expect(ctx.scopedSportId).toBe('sport-football');
      expect(ctx.scopedEventId).toBe('event-1');
    });

    it('should detect SECURITY_HEAD as the security persona', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([
        { role: { name: 'SECURITY_HEAD' } },
      ]);

      const ctx = await dashboardService.getUserRoleContext('user-sec');
      expect(ctx.primaryRole).toBe('SECURITY_HEAD');
    });

    it('should keep SECURITY_VOLUNTEER as its own persona, distinct from SECURITY_HEAD', async () => {
      prismaMock.userRole.findMany.mockResolvedValue([
        { role: { name: 'SECURITY_VOLUNTEER' } },
      ]);

      const ctx = await dashboardService.getUserRoleContext('user-sec-vol');
      expect(ctx.primaryRole).toBe('SECURITY_VOLUNTEER');
    });
  });

  describe('Convener Dashboard Aggregations', () => {
    it('should aggregate global competition metrics and check-in rate', async () => {
      prismaMock.sport.count.mockResolvedValue(8);
      prismaMock.tournament.count.mockResolvedValue(12);
      prismaMock.team.count.mockResolvedValue(48);
      prismaMock.match.count
        .mockResolvedValueOnce(96) // totalMatches
        .mockResolvedValueOnce(3) // liveMatches
        .mockResolvedValueOnce(45); // completedMatches
      prismaMock.result.count.mockResolvedValue(4); // pendingApprovals
      prismaMock.participant.count
        .mockResolvedValueOnce(500) // total
        .mockResolvedValueOnce(400); // checkedIn
      prismaMock.auditLog.findMany.mockResolvedValue([
        { id: 'audit-1', action: 'match.start' },
      ]);
      prismaMock.match.findMany.mockResolvedValue([]); // live activity

      const dashboard = await dashboardService.getConvenerDashboard('event-1');

      expect(dashboard.persona).toBe('CONVENER');
      expect(dashboard.metrics.sportsCount).toBe(8);
      expect(dashboard.metrics.tournamentsCount).toBe(12);
      expect(dashboard.metrics.matchesCount).toBe(96);
      expect(dashboard.metrics.liveMatchesCount).toBe(3);
      expect(dashboard.metrics.completedMatchesCount).toBe(45);
      expect(dashboard.metrics.pendingApprovalsCount).toBe(4);
      expect(dashboard.metrics.participantsCount).toBe(500);
      expect(dashboard.metrics.checkedInParticipantsCount).toBe(400);
      expect(dashboard.metrics.checkInRate).toBe(80);
      expect(dashboard.recentAuditLogs).toHaveLength(1);
    });
  });

  describe('Sports Coordinator Dashboard Aggregations', () => {
    it('should return strictly scoped information for assigned sport', async () => {
      prismaMock.sport.findUnique.mockResolvedValue({
        id: 'sport-football',
        name: 'Football',
      });
      prismaMock.tournament.findMany.mockResolvedValue([
        { id: 'tourn-fb', name: 'Football Cup' },
      ]);
      prismaMock.match.findMany
        .mockResolvedValueOnce([{ id: 'm-live', status: 'LIVE' }]) // live
        .mockResolvedValueOnce([{ id: 'm-sched', status: 'SCHEDULED' }]); // upcoming
      prismaMock.result.count.mockResolvedValue(2); // pending

      const dashboard =
        await dashboardService.getSportsCoordinatorDashboard('sport-football');

      expect(dashboard.persona).toBe('SPORTS_COORDINATOR');
      expect(dashboard.sport.name).toBe('Football');
      expect(dashboard.metrics.tournamentsCount).toBe(1);
      expect(dashboard.metrics.liveMatchesCount).toBe(1);
      expect(dashboard.metrics.upcomingMatchesCount).toBe(1);
      expect(dashboard.metrics.pendingApprovalsCount).toBe(2);
    });

    it('should handle unassigned sports coordinator gracefully', async () => {
      const dashboard =
        await dashboardService.getSportsCoordinatorDashboard(null);
      expect(dashboard.persona).toBe('SPORTS_COORDINATOR');
      expect(dashboard.tournaments).toEqual([]);
    });
  });

  describe('Security & Hospitality Overview', () => {
    it('should compute institutional attendance breakdown and gate check-in statistics', async () => {
      prismaMock.participant.count
        .mockResolvedValueOnce(200) // total
        .mockResolvedValueOnce(150); // checkedIn
      prismaMock.institute.findMany.mockResolvedValue([
        {
          id: 'inst-1',
          name: 'IIT Jammu',
          shortName: 'IITJMU',
          participants: [
            { isCheckedIn: true },
            { isCheckedIn: true },
            { isCheckedIn: false },
          ],
        },
        {
          id: 'inst-2',
          name: 'IIT Delhi',
          shortName: 'IITD',
          participants: [{ isCheckedIn: true }, { isCheckedIn: false }],
        },
      ]);
      prismaMock.venue.findMany.mockResolvedValue([
        {
          id: 'venue-1',
          name: 'Main Arena',
          location: 'SAC',
          _count: { presentParticipants: 42 },
        },
      ]);

      const sec = await dashboardService.getSecurityOverview('event-1');

      expect(sec.persona).toBe('SECURITY_HEAD');
      expect(sec.metrics.totalParticipants).toBe(200);
      expect(sec.metrics.checkedInCount).toBe(150);
      expect(sec.metrics.pendingCheckInCount).toBe(50);
      expect(sec.metrics.checkInRate).toBe(75);

      expect(sec.institutesBreakdown).toHaveLength(2);
      expect(sec.institutesBreakdown[0].totalAthletes).toBe(3);
      expect(sec.institutesBreakdown[0].checkedInAthletes).toBe(2);
      expect(sec.institutesBreakdown[0].pendingAthletes).toBe(1);
      expect(sec.venueOccupancy).toEqual([
        expect.objectContaining({ name: 'Main Arena', peoplePresent: 42 }),
      ]);
    });

    it('restricted Security Volunteer overview omits the per-institute breakdown a Head sees', async () => {
      prismaMock.participant.count
        .mockResolvedValueOnce(200)
        .mockResolvedValueOnce(150);
      prismaMock.venue.findMany.mockResolvedValue([
        {
          id: 'venue-1',
          name: 'Main Arena',
          location: 'SAC',
          _count: { presentParticipants: 42 },
        },
      ]);

      const overview =
        await dashboardService.getSecurityVolunteerOverview('event-1');

      expect(overview.persona).toBe('SECURITY_VOLUNTEER');
      expect(overview.metrics.totalParticipants).toBe(200);
      expect(overview.metrics.checkInRate).toBe(75);
      expect(overview.venueOccupancy).toEqual([
        expect.objectContaining({ name: 'Main Arena', peoplePresent: 42 }),
      ]);
      expect(
        (overview as Record<string, unknown>).institutesBreakdown,
      ).toBeUndefined();
    });

    it('projects expected audience per venue from scheduled/live matches, deduping shared roster members', async () => {
      prismaMock.venue.findMany.mockResolvedValue([
        {
          id: 'venue-arena',
          name: 'Main Arena',
          location: 'SAC',
          _count: { presentParticipants: 5 },
        },
        {
          id: 'venue-court',
          name: 'Court 2',
          location: 'Gym',
          _count: { presentParticipants: 0 },
        },
      ]);
      prismaMock.match.findMany.mockResolvedValue([
        {
          id: 'match-1',
          venueId: 'venue-arena',
          status: 'LIVE',
          scheduledStartTime: new Date('2026-10-02T10:00:00Z'),
          tournament: { sport: { name: 'Cricket' } },
          teamA: { id: 'team-a', name: 'IIT Jammu' },
          teamB: { id: 'team-b', name: 'IIT Delhi' },
        },
        {
          id: 'match-2',
          venueId: 'venue-arena',
          status: 'SCHEDULED',
          scheduledStartTime: new Date('2026-10-02T12:00:00Z'),
          tournament: { sport: { name: 'Cricket' } },
          // Shares team-a with match-1 — its 2 members must be counted once, not twice.
          teamA: { id: 'team-a', name: 'IIT Jammu' },
          teamB: { id: 'team-c', name: 'IIT Bombay' },
        },
      ]);
      prismaMock.teamMember.findMany.mockResolvedValue([
        { teamId: 'team-a', participantId: 'p1' },
        { teamId: 'team-a', participantId: 'p2' },
        { teamId: 'team-b', participantId: 'p3' },
        { teamId: 'team-c', participantId: 'p4' },
      ]);

      const projection =
        await dashboardService.getVenueAudienceProjection('event-1');

      expect(projection.persona).toBe('HOSPITALITY');
      const arena = projection.venues.find((v) => v.venueId === 'venue-arena')!;
      expect(arena.matches).toHaveLength(2);
      // p1+p2 (team-a, shared) + p3 (team-b) + p4 (team-c) = 4 distinct people, not 6.
      expect(arena.expectedAudience).toBe(4);
      expect(arena.currentPhysicalOccupancy).toBe(5);
      const court = projection.venues.find((v) => v.venueId === 'venue-court')!;
      expect(court.matches).toHaveLength(0);
      expect(court.expectedAudience).toBe(0);
      expect(projection.metrics.totalExpectedAudience).toBe(4);
      expect(projection.metrics.venuesWithActiveMatches).toBe(1);
    });
  });

  describe('Volunteer Dashboard — own tasks only', () => {
    it("does not leak a plain volunteer their whole department's tasks, only their own", async () => {
      prismaMock.matchOfficial.findMany.mockResolvedValue([]);
      prismaMock.match.findMany.mockResolvedValue([]);
      prismaMock.volunteer.findUnique.mockResolvedValue({
        id: 'vol-1',
        department: 'Hospitality',
      });
      prismaMock.operationsTask.findMany.mockResolvedValue([
        { id: 'task-mine', status: 'STANDBY', createdAt: new Date() },
      ]);

      const dashboard =
        await dashboardService.getVolunteerDashboard('user-vol-1');

      // The query must scope strictly to this volunteer's id — no OR-in of department-wide tasks.
      expect(prismaMock.operationsTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { assignees: { some: { volunteerId: 'vol-1' } } },
        }),
      );
      // A Hospitality volunteer gets the same read-only venue projection their Head sees.
      expect(dashboard.venues).toBeDefined();
    });

    it('gives a non-Hospitality volunteer no venue projection — read-only slices are department-specific', async () => {
      prismaMock.matchOfficial.findMany.mockResolvedValue([]);
      prismaMock.match.findMany.mockResolvedValue([]);
      prismaMock.volunteer.findUnique.mockResolvedValue({
        id: 'vol-2',
        department: 'Security',
      });
      prismaMock.operationsTask.findMany.mockResolvedValue([]);

      const dashboard =
        await dashboardService.getVolunteerDashboard('user-vol-2');

      expect(dashboard.venues).toBeUndefined();
    });
  });

  describe('Pipelines: Pending Approvals & Live Activity', () => {
    it('should query pending result approvals', async () => {
      prismaMock.result.findMany.mockResolvedValue([
        {
          id: 'res-1',
          status: 'SUBMITTED',
          match: {
            tournament: { name: 'Cricket Trophy', sport: { name: 'Cricket' } },
            teamA: { name: 'Team A' },
            teamB: { name: 'Team B' },
          },
        },
      ]);

      const approvals = await dashboardService.getPendingApprovals();
      expect(approvals).toHaveLength(1);
      expect(approvals[0].id).toBe('res-1');
    });

    it('should query live activity matches across venues', async () => {
      prismaMock.match.findMany.mockResolvedValue([
        {
          id: 'm-live',
          status: 'LIVE',
          tournament: { name: 'Basketball' },
          teamA: { name: 'A' },
          teamB: { name: 'B' },
          scoreEvents: [],
        },
      ]);

      const live = await dashboardService.getLiveActivity();
      expect(live).toHaveLength(1);
      expect(live[0].status).toBe('LIVE');
    });
  });
});
