import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResultsService } from './results.service.js';
import { StandingsService } from './standings.service.js';
import { MedalsService } from './medals.service.js';
import { BadRequestException } from '@nestjs/common';

describe('Results, Standings & Medal Tally Services', () => {
  let prismaMock: any;
  let rbacMock: any;
  let resultsService: ResultsService;
  let standingsService: StandingsService;
  let medalsService: MedalsService;

  const mockMatch = {
    id: 'match-1',
    tournamentId: 'tourn-1',
    teamAId: 'team-a',
    teamBId: 'team-b',
    teamAScore: 3,
    teamBScore: 1,
    winnerTeamId: 'team-a',
    status: 'COMPLETED',
    scoreDetails: null,
    actualEndTime: new Date(),
    result: null,
  };

  beforeEach(() => {
    prismaMock = {
      match: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      result: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
      tournament: {
        findUnique: vi.fn(),
      },
      tournamentStage: {
        findUnique: vi.fn(),
      },
      institute: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      sport: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'sport-1', eventId: 'event-1' }),
      },
      event: {
        findUnique: vi.fn(),
      },
      medal: {
        upsert: vi.fn(),
        findMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    };

    prismaMock.$queryRaw = vi.fn().mockResolvedValue([]);
    prismaMock.$transaction = vi.fn(async (work) =>
      typeof work === 'function' ? work(prismaMock) : Promise.all(work),
    );

    rbacMock = {
      hasPermission: vi.fn().mockResolvedValue(true),
    };

    resultsService = new ResultsService(prismaMock, rbacMock);
    standingsService = new StandingsService(prismaMock);
    medalsService = new MedalsService(prismaMock, rbacMock);
  });

  describe('ResultsService: Submission, Approval & Immutability', () => {
    it('should submit an official result with status SUBMITTED and write audit log', async () => {
      prismaMock.match.findUnique.mockResolvedValue(mockMatch);

      const fakeResult = {
        id: 'res-1',
        matchId: 'match-1',
        status: 'SUBMITTED',
        finalScoreA: 3,
        finalScoreB: 1,
        winnerTeamId: 'team-a',
        match: mockMatch,
        submittedBy: 'user-referee',
      };

      prismaMock.result.upsert.mockResolvedValue(fakeResult);

      const result = await resultsService.submitResult(
        'match-1',
        { finalScoreA: 3, finalScoreB: 1 },
        'user-referee',
        '127.0.0.1',
      );

      expect(result.status).toBe('SUBMITTED');
      expect(prismaMock.result.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { matchId: 'match-1' },
          create: expect.objectContaining({
            status: 'SUBMITTED',
            finalScoreA: 3,
            finalScoreB: 1,
            winnerTeamId: 'team-a',
          }),
        }),
      );
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'result.submit',
            resource: 'Result',
            resourceId: 'res-1',
          }),
        }),
      );
    });

    it('should enforce immutability: reject submit if result is already PUBLISHED', async () => {
      prismaMock.match.findUnique.mockResolvedValue({
        ...mockMatch,
        result: { id: 'res-1', status: 'PUBLISHED' },
      });

      await expect(
        resultsService.submitResult('match-1', {}, 'user-referee'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should approve a SUBMITTED result and transition status to PUBLISHED', async () => {
      prismaMock.result.findUnique.mockResolvedValue({
        id: 'res-1',
        matchId: 'match-1',
        match: mockMatch,
        status: 'SUBMITTED',
        finalScoreA: 3,
        finalScoreB: 1,
        winnerTeamId: 'team-a',
      });

      prismaMock.result.update.mockResolvedValue({
        id: 'res-1',
        status: 'PUBLISHED',
        approvedBy: 'user-coordinator',
      });

      const approved = await resultsService.approveResult(
        'res-1',
        { notes: 'Confirmed official score' },
        'user-coordinator',
      );

      expect(approved.status).toBe('PUBLISHED');
      expect(prismaMock.match.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'match-1' },
          data: expect.objectContaining({
            teamAScore: 3,
            teamBScore: 1,
            status: 'COMPLETED',
          }),
        }),
      );
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'result.approve',
            resource: 'Result',
            resourceId: 'res-1',
          }),
        }),
      );
    });

    it('should reject approval on non-SUBMITTED result', async () => {
      prismaMock.result.findUnique.mockResolvedValue({
        id: 'res-1',
        status: 'REJECTED',
      });

      await expect(
        resultsService.approveResult('res-1', {}, 'user-coordinator'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a submitted result with mandatory reason', async () => {
      prismaMock.result.findUnique.mockResolvedValue({
        id: 'res-1',
        status: 'SUBMITTED',
      });

      prismaMock.result.update.mockResolvedValue({
        id: 'res-1',
        status: 'REJECTED',
        rejectionReason: 'Score mismatch in 2nd half',
      });

      const rejected = await resultsService.rejectResult(
        'res-1',
        { reason: 'Score mismatch in 2nd half' },
        'user-coordinator',
      );

      expect(rejected.status).toBe('REJECTED');
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'result.reject',
            reason: 'Score mismatch in 2nd half',
          }),
        }),
      );
    });

    it('should perform Convener override on published result with audit trail', async () => {
      prismaMock.result.findUnique.mockResolvedValue({
        id: 'res-1',
        matchId: 'match-1',
        status: 'PUBLISHED',
        finalScoreA: 2,
        finalScoreB: 2,
        match: { teamAId: 'team-a', teamBId: 'team-b' },
      });

      prismaMock.result.update.mockResolvedValue({
        id: 'res-1',
        status: 'PUBLISHED',
        finalScoreA: 3,
        finalScoreB: 2,
        winnerTeamId: 'team-a',
        overrideReason: 'Late VAR penalty decision upheld by Convener',
      });

      const overridden = await resultsService.overrideResult(
        'res-1',
        {
          finalScoreA: 3,
          finalScoreB: 2,
          winnerTeamId: 'team-a',
          reason: 'Late VAR penalty decision upheld by Convener',
        },
        'user-convener',
      );

      expect(overridden.finalScoreA).toBe(3);
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'result.override',
            resource: 'Result',
            resourceId: 'res-1',
            reason: 'Late VAR penalty decision upheld by Convener',
          }),
        }),
      );
    });
  });

  describe('StandingsService: Dynamic Point Table Calculation', () => {
    it('should calculate points table accurately with win/draw/loss points and differential tiebreakers', async () => {
      prismaMock.tournament.findUnique.mockResolvedValue({
        id: 'tourn-1',
        name: 'Football Championship',
        format: 'ROUND_ROBIN',
        pointsForWin: 3,
        pointsForDraw: 1,
        pointsForLoss: 0,
        sport: { name: 'Football' },
        seeds: [
          {
            team: {
              id: 'team-a',
              name: 'IIT Jammu',
              institute: { name: 'IIT Jammu', shortName: 'IITJMU' },
            },
          },
          {
            team: {
              id: 'team-b',
              name: 'IIT Delhi',
              institute: { name: 'IIT Delhi', shortName: 'IITD' },
            },
          },
          {
            team: {
              id: 'team-c',
              name: 'IIT Bombay',
              institute: { name: 'IIT Bombay', shortName: 'IITB' },
            },
          },
        ],
      });

      // Match 1: Team A (3) vs Team B (1) -> Team A wins
      // Match 2: Team A (2) vs Team C (2) -> Draw
      prismaMock.match.findMany.mockResolvedValue([
        {
          id: 'm-1',
          status: 'COMPLETED',
          teamAId: 'team-a',
          teamBId: 'team-b',
          teamAScore: 3,
          teamBScore: 1,
          teamA: {
            id: 'team-a',
            name: 'IIT Jammu',
            institute: { name: 'IIT Jammu', shortName: 'IITJMU' },
          },
          teamB: {
            id: 'team-b',
            name: 'IIT Delhi',
            institute: { name: 'IIT Delhi', shortName: 'IITD' },
          },
          result: {
            status: 'PUBLISHED',
            finalScoreA: 3,
            finalScoreB: 1,
            winnerTeamId: 'team-a',
          },
        },
        {
          id: 'm-2',
          status: 'COMPLETED',
          teamAId: 'team-a',
          teamBId: 'team-c',
          teamAScore: 2,
          teamBScore: 2,
          teamA: {
            id: 'team-a',
            name: 'IIT Jammu',
            institute: { name: 'IIT Jammu', shortName: 'IITJMU' },
          },
          teamB: {
            id: 'team-c',
            name: 'IIT Bombay',
            institute: { name: 'IIT Bombay', shortName: 'IITB' },
          },
          result: {
            status: 'PUBLISHED',
            finalScoreA: 2,
            finalScoreB: 2,
            winnerTeamId: null,
          },
        },
      ]);

      const res = await standingsService.getTournamentStandings('tourn-1');

      expect(res.standings).toHaveLength(3);

      const teamA = res.standings.find((t) => t.teamId === 'team-a')!;
      expect(teamA.played).toBe(2);
      expect(teamA.won).toBe(1);
      expect(teamA.drawn).toBe(1);
      expect(teamA.lost).toBe(0);
      expect(teamA.points).toBe(4); // 3 (win) + 1 (draw)
      expect(teamA.scoreFor).toBe(5);
      expect(teamA.scoreAgainst).toBe(3);
      expect(teamA.differential).toBe(2);
      expect(teamA.rank).toBe(1);

      const teamC = res.standings.find((t) => t.teamId === 'team-c')!;
      expect(teamC.played).toBe(1);
      expect(teamC.drawn).toBe(1);
      expect(teamC.points).toBe(1);
      expect(teamC.rank).toBe(2);

      const teamB = res.standings.find((t) => t.teamId === 'team-b')!;
      expect(teamB.played).toBe(1);
      expect(teamB.lost).toBe(1);
      expect(teamB.points).toBe(0);
      expect(teamB.rank).toBe(3);
    });
  });

  describe('MedalsService: Awarding & Olympic-Style Medal Tally', () => {
    it('should award a medal and log audit record', async () => {
      prismaMock.institute.findUnique.mockResolvedValue({
        id: 'inst-1',
        eventId: 'event-1',
        name: 'IIT Jammu',
      });
      prismaMock.event.findUnique.mockResolvedValue({ id: 'event-1' });

      const fakeMedal = {
        id: 'medal-1',
        eventId: 'event-1',
        sportId: 'sport-1',
        instituteId: 'inst-1',
        type: 'GOLD',
      };
      prismaMock.medal.upsert.mockResolvedValue(fakeMedal);

      const awarded = await medalsService.awardMedal(
        {
          eventId: 'event-1',
          sportId: 'sport-1',
          instituteId: 'inst-1',
          type: 'GOLD',
        },
        'user-convener',
      );

      expect(awarded.type).toBe('GOLD');
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'medal.award',
            resource: 'Medal',
          }),
        }),
      );
    });

    it('should calculate Olympic-style medal tally sorting by Gold -> Silver -> Bronze', async () => {
      prismaMock.institute.findMany.mockResolvedValue([
        {
          id: 'inst-delhi',
          name: 'IIT Delhi',
          shortName: 'IITD',
          logoUrl: null,
          medals: [{ type: 'GOLD' }, { type: 'SILVER' }, { type: 'SILVER' }], // 1 Gold, 2 Silver
        },
        {
          id: 'inst-jammu',
          name: 'IIT Jammu',
          shortName: 'IITJMU',
          logoUrl: null,
          medals: [{ type: 'GOLD' }, { type: 'GOLD' }], // 2 Gold, 0 Silver
        },
        {
          id: 'inst-bombay',
          name: 'IIT Bombay',
          shortName: 'IITB',
          logoUrl: null,
          medals: [{ type: 'BRONZE' }, { type: 'BRONZE' }, { type: 'BRONZE' }], // 0 Gold, 0 Silver, 3 Bronze
        },
      ]);

      const tally = await medalsService.getMedalTally('event-1');

      expect(tally).toHaveLength(3);
      // IIT Jammu should be Rank 1 (2 Golds)
      expect(tally[0].instituteName).toBe('IIT Jammu');
      expect(tally[0].gold).toBe(2);
      expect(tally[0].rank).toBe(1);

      // IIT Delhi should be Rank 2 (1 Gold)
      expect(tally[1].instituteName).toBe('IIT Delhi');
      expect(tally[1].gold).toBe(1);
      expect(tally[1].silver).toBe(2);
      expect(tally[1].rank).toBe(2);

      // IIT Bombay should be Rank 3 (0 Gold)
      expect(tally[2].instituteName).toBe('IIT Bombay');
      expect(tally[2].bronze).toBe(3);
      expect(tally[2].rank).toBe(3);
    });
  });
});
