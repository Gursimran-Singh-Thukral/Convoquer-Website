import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScoringService } from './scoring.service.js';
import { ScoringRulesService } from './scoring-rules.service.js';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

describe('ScoringService & Real-Time Match Management', () => {
  let prismaMock: any;
  let rbacMock: any;
  let rulesService: ScoringRulesService;
  let scoringService: ScoringService;

  const mockMatch = {
    id: 'match-1',
    tournamentId: 'tourn-1',
    tournament: {
      id: 'tourn-1',
      sportId: 'sport-football',
      eventId: 'event-1',
      sport: { id: 'sport-football', name: 'Football' },
    },
    teamAId: 'team-a',
    teamBId: 'team-b',
    teamAScore: 0,
    teamBScore: 0,
    status: 'SCHEDULED',
    currentPeriod: null,
    actualStartTime: null,
    actualEndTime: null,
    scoreDetails: null,
    officials: [],
    teamA: { id: 'team-a', name: 'IIT Jammu Team A' },
    teamB: { id: 'team-b', name: 'IIT Delhi Team B' },
  };

  beforeEach(() => {
    prismaMock = {
      match: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      scoreEvent: {
        count: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (ops: any[]) => {
        return Promise.all(ops);
      }),
    };

    prismaMock.$queryRaw = vi.fn().mockResolvedValue([]);
    prismaMock.$transaction = vi.fn(async (work) =>
      typeof work === 'function' ? work(prismaMock) : Promise.all(work),
    );

    rbacMock = {
      hasPermission: vi.fn(),
    };

    rulesService = new ScoringRulesService();
    scoringService = new ScoringService(prismaMock, rbacMock, rulesService);
  });

  describe('Authorization & Access Control', () => {
    it('should grant access to users with RBAC score.update permission', async () => {
      prismaMock.match.findUnique.mockResolvedValue(mockMatch);
      rbacMock.hasPermission.mockResolvedValue(true);

      const verified = await scoringService.verifyScoringAuthority(
        'match-1',
        'user-admin',
      );
      expect(verified).toBeDefined();
      expect(rbacMock.hasPermission).toHaveBeenCalledWith(
        'user-admin',
        'score.update',
        {
          sportId: 'sport-football',
          eventId: 'event-1',
        },
      );
    });

    it('should grant access to assigned match official even without global RBAC', async () => {
      const matchWithOfficial = {
        ...mockMatch,
        officials: [{ userId: 'user-referee', role: 'SCOREKEEPER' }],
      };
      prismaMock.match.findUnique.mockResolvedValue(matchWithOfficial);
      rbacMock.hasPermission.mockResolvedValue(false); // No global permission

      const verified = await scoringService.verifyScoringAuthority(
        'match-1',
        'user-referee',
      );
      expect(verified).toBeDefined();
      expect(verified.id).toBe('match-1');
    });

    it('should throw ForbiddenException for unauthorized user', async () => {
      prismaMock.match.findUnique.mockResolvedValue(mockMatch);
      rbacMock.hasPermission.mockResolvedValue(false);

      await expect(
        scoringService.verifyScoringAuthority('match-1', 'user-stranger'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if match does not exist', async () => {
      prismaMock.match.findUnique.mockResolvedValue(null);

      await expect(
        scoringService.verifyScoringAuthority('nonexistent', 'user-admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Match Lifecycle State Machine', () => {
    it('should start a scheduled match and set status to LIVE', async () => {
      prismaMock.match.findUnique.mockResolvedValue(mockMatch);
      rbacMock.hasPermission.mockResolvedValue(true);
      prismaMock.match.update.mockResolvedValue({
        ...mockMatch,
        status: 'LIVE',
        currentPeriod: '1st Half',
      });

      const result = await scoringService.startMatch(
        'match-1',
        { period: '1st Half' },
        'user-admin',
        '127.0.0.1',
      );

      expect(prismaMock.match.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'match-1' },
          data: expect.objectContaining({
            status: 'LIVE',
            currentPeriod: '1st Half',
          }),
        }),
      );
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'match.start',
            resource: 'Match',
          }),
        }),
      );
      expect(result.status).toBe('LIVE');
    });

    it('should reject starting an already completed match', async () => {
      prismaMock.match.findUnique.mockResolvedValue({
        ...mockMatch,
        status: 'COMPLETED',
      });
      rbacMock.hasPermission.mockResolvedValue(true);

      await expect(
        scoringService.startMatch('match-1', {}, 'user-admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should pause a LIVE match', async () => {
      prismaMock.match.findUnique.mockResolvedValue({
        ...mockMatch,
        status: 'LIVE',
        currentPeriod: '1st Half',
      });
      rbacMock.hasPermission.mockResolvedValue(true);
      prismaMock.match.update.mockResolvedValue({
        ...mockMatch,
        status: 'PAUSED',
      });

      const result = await scoringService.pauseMatch(
        'match-1',
        { reason: 'Half-time break' },
        'user-admin',
      );

      expect(prismaMock.match.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PAUSED' }),
        }),
      );
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'match.pause',
            reason: 'Half-time break',
          }),
        }),
      );
      expect(result.status).toBe('PAUSED');
    });

    it('should reject pausing a non-LIVE match', async () => {
      prismaMock.match.findUnique.mockResolvedValue({
        ...mockMatch,
        status: 'SCHEDULED',
      });
      rbacMock.hasPermission.mockResolvedValue(true);

      await expect(
        scoringService.pauseMatch('match-1', {}, 'user-admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should resume a PAUSED match back to LIVE', async () => {
      prismaMock.match.findUnique.mockResolvedValue({
        ...mockMatch,
        status: 'PAUSED',
      });
      rbacMock.hasPermission.mockResolvedValue(true);
      prismaMock.match.update.mockResolvedValue({
        ...mockMatch,
        status: 'LIVE',
      });

      const result = await scoringService.resumeMatch(
        'match-1',
        {},
        'user-admin',
      );
      expect(result.status).toBe('LIVE');
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'match.resume' }),
        }),
      );
    });

    it('should end a match and declare winner automatically based on score', async () => {
      prismaMock.match.findUnique.mockResolvedValue({
        ...mockMatch,
        status: 'LIVE',
        teamAScore: 3,
        teamBScore: 1,
      });
      rbacMock.hasPermission.mockResolvedValue(true);
      prismaMock.match.update.mockResolvedValue({
        ...mockMatch,
        status: 'COMPLETED',
        winnerTeamId: 'team-a',
      });

      const result = await scoringService.endMatch('match-1', {}, 'user-admin');

      expect(result.status).toBe('COMPLETED');
      expect(prismaMock.match.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            winnerTeamId: 'team-a',
          }),
        }),
      );
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'match.end',
            newState: expect.objectContaining({
              status: 'COMPLETED',
              winnerTeamId: 'team-a',
            }),
          }),
        }),
      );
    });
  });

  describe('Score Event Recording & Timeline', () => {
    it('should record a football GOAL, increment team score, and write audit log', async () => {
      prismaMock.match.findUnique.mockResolvedValue({
        ...mockMatch,
        status: 'LIVE',
        teamAScore: 0,
        teamBScore: 0,
      });
      rbacMock.hasPermission.mockResolvedValue(true);
      prismaMock.scoreEvent.count.mockResolvedValue(0);

      const fakeScoreEvent = {
        id: 'event-1',
        matchId: 'match-1',
        sequenceNumber: 1,
        teamId: 'team-a',
        eventType: 'GOAL',
        points: 1,
        isReversed: false,
      };

      prismaMock.scoreEvent.create.mockReturnValue(fakeScoreEvent);
      prismaMock.match.update.mockReturnValue({
        ...mockMatch,
        status: 'LIVE',
        teamAScore: 1,
        teamBScore: 0,
      });

      const res = await scoringService.recordScoreEvent(
        'match-1',
        {
          teamId: 'team-a',
          eventType: 'GOAL',
          period: '1st Half',
          metadata: { minute: 23 },
        },
        'user-admin',
      );

      expect(res.event).toEqual(fakeScoreEvent);
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'score.event.create',
            resource: 'ScoreEvent',
            newState: expect.objectContaining({
              teamAScore: 1,
              teamBScore: 0,
              eventType: 'GOAL',
              points: 1,
            }),
          }),
        }),
      );
    });

    it('should award OWN_GOAL to opponent team', async () => {
      const state = rulesService.applyEvent({
        sportName: 'Football',
        teamAId: 'team-a',
        teamBId: 'team-b',
        currentState: null,
        event: { eventType: 'OWN_GOAL', teamId: 'team-a' },
      });

      expect(state.teamBScore).toBe(1);
      expect(state.teamAScore).toBe(0);
    });

    it('should award basketball THREE_POINTS as 3 points', async () => {
      const state = rulesService.applyEvent({
        sportName: 'Basketball',
        teamAId: 'team-a',
        teamBId: 'team-b',
        currentState: null,
        event: { eventType: 'THREE_POINTS', teamId: 'team-a' },
      });

      expect(state.teamAScore).toBe(3);
      expect(state.teamBScore).toBe(0);
    });

    it('should reject score event if match is not LIVE', async () => {
      prismaMock.match.findUnique.mockResolvedValue({
        ...mockMatch,
        status: 'SCHEDULED',
      });
      rbacMock.hasPermission.mockResolvedValue(true);

      await expect(
        scoringService.recordScoreEvent(
          'match-1',
          { teamId: 'team-a', eventType: 'GOAL' },
          'user-admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Score Reversal & Recalculation Engine', () => {
    it('should reverse a score event, replay valid timeline, rollback match score, and write audit log', async () => {
      prismaMock.match.findUnique.mockResolvedValue({
        ...mockMatch,
        status: 'LIVE',
        teamAScore: 2,
        teamBScore: 1,
      });
      rbacMock.hasPermission.mockResolvedValue(true);

      // Event to reverse (team A goal)
      prismaMock.scoreEvent.findUnique.mockResolvedValue({
        id: 'event-2',
        matchId: 'match-1',
        teamId: 'team-a',
        eventType: 'GOAL',
        points: 1,
        isReversed: false,
      });

      prismaMock.scoreEvent.update.mockResolvedValue({
        id: 'event-2',
        isReversed: true,
        reversalReason: 'Offside confirmed by VAR',
      });

      // Events remaining: event 1 (team A goal, 1pt), event 2 (reversed), event 3 (team B goal, 1pt)
      prismaMock.scoreEvent.findMany.mockResolvedValue([
        {
          id: 'event-1',
          teamId: 'team-a',
          eventType: 'GOAL',
          points: 1,
          isReversed: false,
        },
        {
          id: 'event-2',
          teamId: 'team-a',
          eventType: 'GOAL',
          points: 1,
          isReversed: true,
        },
        {
          id: 'event-3',
          teamId: 'team-b',
          eventType: 'GOAL',
          points: 1,
          isReversed: false,
        },
      ]);

      prismaMock.match.update.mockResolvedValue({
        ...mockMatch,
        teamAScore: 1, // Reverted from 2 to 1
        teamBScore: 1,
      });

      const res = await scoringService.reverseScoreEvent(
        'match-1',
        'event-2',
        { reason: 'Offside confirmed by VAR' },
        'user-admin',
      );

      expect(res.reversedEvent.isReversed).toBe(true);
      expect(prismaMock.match.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            teamAScore: 1,
            teamBScore: 1,
          }),
        }),
      );
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'score.event.reverse',
            resource: 'ScoreEvent',
            resourceId: 'event-2',
            reason: 'Offside confirmed by VAR',
          }),
        }),
      );
    });

    it('should reject reversing an already reversed event', async () => {
      prismaMock.match.findUnique.mockResolvedValue({
        ...mockMatch,
        status: 'LIVE',
      });
      rbacMock.hasPermission.mockResolvedValue(true);

      prismaMock.scoreEvent.findUnique.mockResolvedValue({
        id: 'event-2',
        matchId: 'match-1',
        isReversed: true,
      });

      await expect(
        scoringService.reverseScoreEvent(
          'match-1',
          'event-2',
          { reason: 'Duplicate' },
          'user-admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Manual Score Adjustment & Public Views', () => {
    it('should perform manual score adjustment with reason and audit log', async () => {
      prismaMock.match.findUnique.mockResolvedValue({
        ...mockMatch,
        status: 'LIVE',
        teamAScore: 1,
        teamBScore: 1,
      });
      rbacMock.hasPermission.mockResolvedValue(true);

      prismaMock.match.update.mockResolvedValue({
        ...mockMatch,
        teamAScore: 2,
        teamBScore: 1,
        winnerTeamId: 'team-a',
      });

      const result = await scoringService.updateScoreManual(
        'match-1',
        { teamAScore: 2, teamBScore: 1, reason: 'Referee points adjustment' },
        'user-admin',
      );

      expect(result.teamAScore).toBe(2);
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'score.manual.update',
            reason: 'Referee points adjustment',
          }),
        }),
      );
    });

    it('should retrieve live spectator view', async () => {
      prismaMock.match.findUnique.mockResolvedValue({
        ...mockMatch,
        status: 'LIVE',
        teamAScore: 2,
        teamBScore: 1,
        scoreEvents: [],
      });

      const live = await scoringService.getLiveMatch('match-1');
      expect(live).toBeDefined();
      expect(live.status).toBe('LIVE');
    });
  });
});
