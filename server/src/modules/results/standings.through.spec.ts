import { describe, expect, it, vi } from 'vitest';
import { StandingsService } from './standings.service.js';

describe('standings after a given round', () => {
  it('counts every stage up to and including the chosen one', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma: any = {
      tournament: {
        findUnique: vi.fn().mockResolvedValue({
          id: 't1',
          name: 'Chess (Men) Championship',
          format: 'LEAGUE',
          sportId: 's1',
          sport: { name: 'Chess (Men)' },
          seeds: [],
        }),
      },
      tournamentStage: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'r2',
          tournamentId: 't1',
          sequence: 2,
          name: 'Swiss Round 2',
        }),
      },
      match: { findMany },
    };
    const res = await new StandingsService(prisma).getTournamentStandings(
      't1',
      undefined,
      'r2',
    );
    expect(res.stage).toEqual({ id: 'r2', name: 'After Swiss Round 2' });
    for (const call of findMany.mock.calls)
      expect(call[0].where.stage).toEqual({ sequence: { lte: 2 } });
    expect(findMany).toHaveBeenCalledTimes(2); // results + byes
  });

  it('ignores a stage that belongs to another tournament', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma: any = {
      tournament: {
        findUnique: vi.fn().mockResolvedValue({
          id: 't1',
          name: 'x',
          format: 'LEAGUE',
          sportId: 's',
          sport: { name: 'Football' },
          seeds: [],
        }),
      },
      tournamentStage: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'x',
          tournamentId: 'other',
          sequence: 1,
          name: 'R',
        }),
      },
      match: { findMany },
    };
    const res = await new StandingsService(prisma).getTournamentStandings(
      't1',
      undefined,
      'x',
    );
    expect(res.stage).toBeUndefined();
    expect(findMany.mock.calls[0][0].where.stage).toBeUndefined();
  });
});

describe('chess match points', () => {
  it('scores a win as 2 even when the tournament row still says 3', async () => {
    const m = {
      teamAId: 'a',
      teamBId: 'b',
      teamA: {
        id: 'a',
        name: 'A',
        instituteId: 'ia',
        institute: { name: 'A', shortName: 'A' },
      },
      teamB: {
        id: 'b',
        name: 'B',
        instituteId: 'ib',
        institute: { name: 'B', shortName: 'B' },
      },
      winnerTeamId: 'a',
      result: {
        status: 'PUBLISHED',
        finalScoreA: 3,
        finalScoreB: 1,
        winnerTeamId: 'a',
        scoreDetails: { kind: 'CHESS' },
      },
    };
    const prisma: any = {
      tournament: {
        findUnique: vi.fn().mockResolvedValue({
          id: 't1',
          name: 'Chess (Men) Championship',
          format: 'LEAGUE',
          sportId: 's',
          sport: { name: 'Chess (Men)' },
          seeds: [],
          pointsForWin: 3,
          pointsForDraw: 1,
          pointsForLoss: 0,
        }),
      },
      tournamentStage: { findUnique: vi.fn() },
      match: {
        findMany: vi.fn().mockResolvedValueOnce([m]).mockResolvedValue([]),
      },
    };
    const { standings } = await new StandingsService(
      prisma,
    ).getTournamentStandings('t1');
    expect(standings.find((s) => s.teamId === 'a')!.points).toBe(2);
    expect(standings.find((s) => s.teamId === 'b')!.points).toBe(0);
  });
});
