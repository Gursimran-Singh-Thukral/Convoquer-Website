import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TournamentsService } from './tournaments.service.js';
import { MatchesService } from './matches.service.js';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

describe('Fixtures, Tournaments, Seeding & Scheduling Services', () => {
  let prismaMock: any;
  let rbacMock: any;
  let tournamentsService: TournamentsService;
  let matchesService: MatchesService;
  const actingUserId = 'user-coordinator';

  beforeEach(() => {
    rbacMock = {
      hasPermission: vi.fn().mockResolvedValue(true),
    };

    prismaMock = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      tournament: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      tournamentTeamSeed: {
        findMany: vi.fn(),
        deleteMany: vi.fn(),
        create: vi.fn(),
      },
      tournamentStage: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      match: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      matchOfficial: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      team: {
        findMany: vi.fn(({ where }) =>
          Promise.resolve(where.id.in.map((id) => ({ id, institute: {} }))),
        ),
        findUnique: vi.fn(),
      },
      venue: {
        findUnique: vi.fn(),
      },
      event: {
        findUnique: vi.fn(),
      },
      sport: {
        findUnique: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(prismaMock)),
    };

    tournamentsService = new TournamentsService(prismaMock, rbacMock);
    matchesService = new MatchesService(prismaMock, rbacMock);
  });

  // ===================================
  // TOURNAMENTS & SEEDING SERVICE
  // ===================================
  describe('TournamentsService', () => {
    it('should return tournaments list', async () => {
      prismaMock.tournament.findMany.mockResolvedValue([
        {
          id: 'tourn-1',
          name: "Convoquer'26 Football Cup",
          format: 'KNOCKOUT',
        },
      ]);

      const list = await tournamentsService.getTournaments('event-1');
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe("Convoquer'26 Football Cup");
    });

    it('should throw NotFoundException for invalid tournament ID', async () => {
      prismaMock.tournament.findUnique.mockResolvedValue(null);

      await expect(
        tournamentsService.getTournamentById('invalid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create a tournament when event and sport exist', async () => {
      prismaMock.event.findUnique.mockResolvedValue({ id: 'event-1' });
      prismaMock.sport.findUnique.mockResolvedValue({
        id: 'sport-1',
        eventId: 'event-1',
      });
      prismaMock.tournament.create.mockResolvedValue({
        id: 'tourn-1',
        name: 'Inter-College Football Championship',
        format: 'KNOCKOUT',
      });

      const tourn = await tournamentsService.createTournament(
        {
          eventId: 'event-1',
          sportId: 'sport-1',
          name: 'Inter-College Football Championship',
          format: 'KNOCKOUT',
        },
        actingUserId,
      );

      expect(tourn.id).toBe('tourn-1');
      expect(tourn.name).toBe('Inter-College Football Championship');
    });

    it('should configure tournament seeds and reject duplicate seed numbers', async () => {
      prismaMock.tournament.findUnique.mockResolvedValue({ id: 'tourn-1' });

      await expect(
        tournamentsService.setSeeds(
          'tourn-1',
          {
            seeds: [
              { teamId: 'team-1', seedNumber: 1 },
              { teamId: 'team-2', seedNumber: 1 }, // Duplicate seed 1
            ],
          },
          actingUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should save tournament team seeds in transaction', async () => {
      prismaMock.tournament.findUnique.mockResolvedValue({ id: 'tourn-1' });
      prismaMock.team.findUnique.mockResolvedValue({
        id: 'team-1',
        name: 'IIT Jammu',
      });
      prismaMock.tournamentTeamSeed.create.mockImplementation(
        ({ data }: any) => ({
          id: 'seed-id',
          ...data,
        }),
      );

      const res = await tournamentsService.setSeeds(
        'tourn-1',
        {
          seeds: [
            { teamId: 'team-1', seedNumber: 1, notes: 'Defending Champion' },
            { teamId: 'team-2', seedNumber: 2, notes: 'Runner Up' },
          ],
        },
        actingUserId,
      );

      expect(res.seeds).toHaveLength(2);
      expect(res.seeds[0].seedNumber).toBe(1);
      expect(res.seeds[1].seedNumber).toBe(2);
      expect(prismaMock.tournamentTeamSeed.deleteMany).toHaveBeenCalled();
    });
  });

  // ===================================
  // MATCHES & SCHEDULING CONFLICT ENGINE
  // ===================================
  describe('MatchesService - Scheduling & Conflicts', () => {
    it('should create match when no venue or team conflicts exist', async () => {
      prismaMock.tournament.findUnique.mockResolvedValue({ id: 'tourn-1' });
      prismaMock.match.findFirst.mockResolvedValue(null); // No conflicts
      prismaMock.match.create.mockImplementation(({ data }: any) => ({
        id: 'match-1',
        ...data,
      }));

      const match = await matchesService.createMatch(
        {
          tournamentId: 'tourn-1',
          venueId: 'venue-1',
          teamAId: 'team-1',
          teamBId: 'team-2',
          matchNumber: 'FB-01',
          scheduledStartTime: '2026-10-02T10:00:00Z',
          scheduledEndTime: '2026-10-02T11:30:00Z',
        },
        actingUserId,
      );

      expect(match.id).toBe('match-1');
      expect(match.matchNumber).toBe('FB-01');
    });

    it('should reject match creation if venue is already booked for overlapping time', async () => {
      prismaMock.tournament.findUnique.mockResolvedValue({ id: 'tourn-1' });
      // Simulate existing match at same venue
      prismaMock.match.findFirst.mockResolvedValueOnce({
        id: 'match-existing',
        matchNumber: 'FB-00',
        scheduledStartTime: new Date('2026-10-02T10:30:00Z'),
        scheduledEndTime: new Date('2026-10-02T12:00:00Z'),
        venue: { name: 'Main Football Ground' },
      });

      await expect(
        matchesService.createMatch(
          {
            tournamentId: 'tourn-1',
            venueId: 'venue-1',
            teamAId: 'team-1',
            teamBId: 'team-2',
            scheduledStartTime: '2026-10-02T10:00:00Z',
            scheduledEndTime: '2026-10-02T11:30:00Z',
          },
          actingUserId,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject match creation if a participating team is already playing elsewhere', async () => {
      prismaMock.tournament.findUnique.mockResolvedValue({ id: 'tourn-1' });
      prismaMock.match.findFirst
        .mockResolvedValueOnce(null) // Venue check passes
        .mockResolvedValueOnce({
          // Team A check fails
          id: 'other-match',
          matchNumber: 'CRIC-01',
          teamA: { name: 'IIT Jammu' },
          teamAId: 'team-1',
        });

      await expect(
        matchesService.createMatch(
          {
            tournamentId: 'tourn-1',
            venueId: 'venue-free',
            teamAId: 'team-1',
            teamBId: 'team-2',
            scheduledStartTime: '2026-10-02T10:00:00Z',
            scheduledEndTime: '2026-10-02T11:30:00Z',
          },
          actingUserId,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should reschedule match and write audit log', async () => {
      prismaMock.match.findUnique.mockResolvedValue({
        id: 'match-1',
        status: 'SCHEDULED',
        venueId: 'venue-1',
        teamAId: 'team-1',
        teamBId: 'team-2',
        scheduledStartTime: new Date('2026-10-02T10:00:00Z'),
        scheduledEndTime: new Date('2026-10-02T11:30:00Z'),
      });
      prismaMock.match.findFirst.mockResolvedValue(null); // No conflicts at new time
      prismaMock.match.update.mockResolvedValue({
        id: 'match-1',
        status: 'RESCHEDULED',
        scheduledStartTime: new Date('2026-10-02T14:00:00Z'),
      });

      const res = await matchesService.rescheduleMatch(
        'match-1',
        {
          scheduledStartTime: '2026-10-02T14:00:00Z',
          scheduledEndTime: '2026-10-02T15:30:00Z',
          reason: 'Rain delay',
        },
        'user-admin',
      );

      expect(res.match.status).toBe('RESCHEDULED');
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'match.reschedule',
            reason: 'Rain delay',
          }),
        }),
      );
    });

    it('should assign and update scorekeeper / referee for a match', async () => {
      prismaMock.match.findUnique.mockResolvedValue({ id: 'match-1' });
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-ref' });
      prismaMock.matchOfficial.findUnique.mockResolvedValue(null);
      prismaMock.matchOfficial.create.mockResolvedValue({
        id: 'off-1',
        matchId: 'match-1',
        userId: 'user-ref',
        role: 'REFEREE',
      });

      const official = await matchesService.assignOfficial(
        'match-1',
        {
          userId: 'user-ref',
          role: 'REFEREE',
        },
        actingUserId,
      );

      expect(official.role).toBe('REFEREE');
    });
  });

  // =========================================================================
  // TOURNAMENT SEEDING BRACKET GENERATION (ENSURING TOP SEEDS MEET ONLY IN FINALS)
  // =========================================================================
  describe('Knockout Bracket Seeding Separation Guarantee', () => {
    it('should separate Seed 1 and Seed 2 into opposite halves so they cannot meet before Finals', async () => {
      prismaMock.tournament.findUnique.mockResolvedValue({
        id: 'tourn-1',
        name: 'Football Championship',
        seeds: [
          { teamId: 'team-top-1', seedNumber: 1 },
          { teamId: 'team-top-2', seedNumber: 2 },
          { teamId: 'team-top-3', seedNumber: 3 },
          { teamId: 'team-top-4', seedNumber: 4 },
        ],
      });

      prismaMock.tournamentStage.create.mockResolvedValue({
        id: 'stage-sf',
        name: 'Semifinals',
      });

      prismaMock.match.create.mockImplementation(({ data }: any) => ({
        id: `match-${data.matchNumber}`,
        ...data,
      }));

      const res = await matchesService.generateKnockoutBracket(
        'tourn-1',
        {
          startTime: '2026-10-02T09:00:00Z',
        },
        actingUserId,
      );

      expect(res.bracketSize).toBe(4);
      expect(res.matches).toHaveLength(3); // 2 semifinals and the linked final
      expect(prismaMock.match.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { nextMatchId: 'match-R2-M1', nextMatchSlot: 'A' },
        }),
      );

      const match1 = res.matches[0];
      const match2 = res.matches[1];

      // Match 1 (Top Half): Seed 1 vs Seed 4
      // Match 2 (Bottom Half): Seed 2 vs Seed 3
      expect(match1.seedMatchup).toBe('Seed 1 vs Seed 4');
      expect(match1.match.teamAId).toBe('team-top-1'); // Seed 1
      expect(match1.match.teamBId).toBe('team-top-4'); // Seed 4

      expect(match2.seedMatchup).toBe('Seed 2 vs Seed 3');
      expect(match2.match.teamAId).toBe('team-top-2'); // Seed 2
      expect(match2.match.teamBId).toBe('team-top-3'); // Seed 3

      // Proof of User Constraint: Seed 1 and Seed 2 are in separate matches!
      // They are in opposite semifinal brackets and CANNOT meet before the Finals.
      expect(match1.match.teamAId).not.toBe(match2.match.teamAId);
      expect(match1.match.teamAId).not.toBe(match2.match.teamBId);
      expect(match1.match.teamBId).not.toBe(match2.match.teamAId);
      expect(match1.match.teamBId).not.toBe(match2.match.teamBId);
    });

    it('should separate Seeds 1 and 2 in an 8-team quarterfinal bracket', async () => {
      // For 8 teams, bracket order is:
      // Match 1: Seed 1 vs Seed 8
      // Match 2: Seed 4 vs Seed 5
      // Match 3: Seed 2 vs Seed 7
      // Match 4: Seed 3 vs Seed 6
      const seedOrder = matchesService.calculateBracketSeedOrder(8);
      expect(seedOrder).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);

      // Seed 1 is in Match 1 (indices 0, 1) -> Top half
      // Seed 2 is in Match 3 (indices 4, 5) -> Bottom half
      // Winner of Match 1 plays winner of Match 2 in Semi 1
      // Winner of Match 3 plays winner of Match 4 in Semi 2
      // Therefore, Seed 1 and Seed 2 can ONLY meet in the Finals!
    });

    it('should generate round robin fixtures for all team pairs', async () => {
      prismaMock.team.findMany.mockResolvedValue(
        [1, 2, 3, 4].map((n) => ({ id: `team-${n}` })),
      );
      prismaMock.tournament.findUnique.mockResolvedValue({ id: 'tourn-rr' });
      prismaMock.tournamentStage.create.mockResolvedValue({
        id: 'stage-rr',
        name: 'Group Stage',
      });
      prismaMock.match.create.mockImplementation(({ data }: any) => ({
        id: `m-${data.matchNumber}`,
        ...data,
      }));

      const res = await matchesService.generateRoundRobin(
        'tourn-rr',
        {
          teamIds: ['team-1', 'team-2', 'team-3', 'team-4'],
          startTime: '2026-10-02T09:00:00Z',
        },
        actingUserId,
      );

      // For 4 teams in round-robin: 4 * 3 / 2 = 6 total matches
      expect(res.totalMatches).toBe(6);
      expect(res.matches).toHaveLength(6);
    });
  });

  describe('Swiss System Pairing', () => {
    it('pairs round 1 as top half vs bottom half, with a bye for an odd field', async () => {
      prismaMock.tournament.findUnique.mockResolvedValue({ id: 'tourn-swiss' });
      prismaMock.tournamentStage.findMany.mockResolvedValue([]); // no prior Swiss stages -> round 1
      prismaMock.tournamentStage.create.mockResolvedValue({
        id: 'stage-swiss-1',
        name: 'Swiss Round 1',
        sequence: 1,
      });
      prismaMock.match.create.mockImplementation(({ data }: any) => ({
        id: `m-${data.matchNumber}`,
        ...data,
      }));

      const res = await matchesService.generateSwissRound(
        'tourn-swiss',
        {
          teamIds: ['t1', 't2', 't3', 't4', 't5'],
          startTime: '2026-10-02T09:00:00Z',
        },
        actingUserId,
      );

      expect(res.roundNumber).toBe(1);
      // 5 teams -> 1 bye, 4 paired -> 2 matches
      expect(res.totalMatches).toBe(2);
      expect(res.byeTeamId).toBe('t5');
      // Top half (t1, t2) vs bottom half (t3, t4)
      expect(res.matches[0].teamAId).toBe('t1');
      expect(res.matches[0].teamBId).toBe('t3');
      expect(res.matches[1].teamAId).toBe('t2');
      expect(res.matches[1].teamBId).toBe('t4');
    });

    it('derives round 2 pairings from round 1 results and avoids a rematch', async () => {
      prismaMock.tournament.findUnique.mockResolvedValue({ id: 'tourn-swiss' });
      // Round 1 history: t1 beat t3, t2 beat t4 -> standings t1=1, t2=1, t3=0, t4=0
      prismaMock.tournamentStage.findMany.mockResolvedValue([
        {
          id: 'stage-swiss-1',
          stageType: 'SWISS',
          sequence: 1,
          matches: [
            {
              teamAId: 't1',
              teamBId: 't3',
              status: 'COMPLETED',
              winnerTeamId: 't1',
              teamAScore: 1,
              teamBScore: 0,
              result: { status: 'PUBLISHED', winnerTeamId: 't1' },
            },
            {
              teamAId: 't2',
              teamBId: 't4',
              status: 'COMPLETED',
              winnerTeamId: 't2',
              teamAScore: 1,
              teamBScore: 0,
              result: { status: 'PUBLISHED', winnerTeamId: 't2' },
            },
          ],
        },
      ]);
      prismaMock.tournamentStage.create.mockResolvedValue({
        id: 'stage-swiss-2',
        name: 'Swiss Round 2',
        sequence: 2,
      });
      prismaMock.match.create.mockImplementation(({ data }: any) => ({
        id: `m-${data.matchNumber}`,
        ...data,
      }));

      const res = await matchesService.generateSwissRound(
        'tourn-swiss',
        { startTime: '2026-10-03T09:00:00Z' },
        actingUserId,
      );

      expect(res.roundNumber).toBe(2);
      expect(res.totalMatches).toBe(2);
      // t1 and t2 are tied on top (1 pt each) and haven't played each other -> paired together.
      const pairs = res.matches.map((m: any) => [m.teamAId, m.teamBId].sort());
      expect(pairs).toContainEqual(['t1', 't2'].sort());
      expect(pairs).toContainEqual(['t3', 't4'].sort());
      // No repeat of round 1's pairings.
      expect(pairs).not.toContainEqual(['t1', 't3'].sort());
      expect(pairs).not.toContainEqual(['t2', 't4'].sort());
    });
  });
});
