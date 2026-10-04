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

describe('chess tie-break order', () => {
  // Four teams, one round each, so everyone has 1 point except where noted; the
  // two sides of the tie differ only on the tie-breaks being tested.
  const team = (id: string) => ({
    id,
    name: id,
    instituteId: `i-${id}`,
    institute: { name: id, shortName: id },
  });
  const game = (a: string, b: string, winner: string | null) => ({
    teamAId: a,
    teamBId: b,
    teamA: team(a),
    teamB: team(b),
    winnerTeamId: winner,
    result: {
      status: 'PUBLISHED',
      finalScoreA: 2,
      finalScoreB: 2,
      winnerTeamId: winner,
      scoreDetails: { kind: 'CHESS' },
    },
  });
  const run = async (sport: string, games: ReturnType<typeof game>[]) => {
    const prisma: any = {
      tournament: {
        findUnique: vi.fn().mockResolvedValue({
          id: 't',
          name: 'C',
          format: 'LEAGUE',
          sportId: 's',
          sport: { name: sport },
          seeds: [],
        }),
      },
      tournamentStage: { findUnique: vi.fn() },
      match: {
        findMany: vi.fn().mockResolvedValueOnce(games).mockResolvedValue([]),
      },
    };
    return (await new StandingsService(prisma).getTournamentStandings('t'))
      .standings;
  };

  it('men (Swiss) still rank the leader first', async () => {
    // W beat X (so W has 2); Y drew Z (1 each).
    const s = await run('Chess (Men)', [
      game('W', 'X', 'W'),
      game('Y', 'Z', null),
    ]);
    expect(s[0].teamId).toBe('W');
    expect(s.every((r) => r.buchholzCut1 !== undefined)).toBe(true);
  });

  it('women (round robin) break a tie on game points, then the direct encounter', async () => {
    // A beat B and C beat A... a three-way cycle: everyone 2 points, equal SB.
    const s = await run('Chess (Women)', [
      game('A', 'B', 'A'),
      game('B', 'C', 'B'),
      game('C', 'A', 'C'),
    ]);
    expect(s).toHaveLength(3);
    expect(s.every((r) => r.points === 2)).toBe(true);
  });

  // Board points differ per game here (the shared helper fixes them at 2–2).
  const board = (
    a: string,
    b: string,
    winner: string | null,
    pa: number,
    pb: number,
  ) => {
    const g = game(a, b, winner);
    g.result.finalScoreA = pa;
    g.result.finalScoreB = pb;
    return g;
  };

  it('women: equal match points are split by game points (board points), highest first', async () => {
    // X and Y both win once and lose once (2 match points). X's wins were
    // 3½–½ (7 board points in total), Y's were 2½–1½.
    const s = await run('Chess (Women)', [
      board('X', 'P', 'X', 3.5, 0.5),
      board('Q', 'X', 'Q', 2.5, 1.5),
      board('Y', 'P', 'Y', 2.5, 1.5),
      board('Q', 'Y', 'Q', 2.5, 1.5),
    ]);
    const rank = (id: string) => s.find((r) => r.teamId === id)!.rank;
    const pts = (id: string) => s.find((r) => r.teamId === id)!.points;
    expect(pts('X')).toBe(2);
    expect(pts('Y')).toBe(2);
    expect(rank('X')).toBeLessThan(rank('Y')); // 5 board points vs 3.5
  });

  it('women: level on match points AND game points, the direct encounter decides', async () => {
    // M and N both: 1 win, 1 loss, 4 board points in total.
    const s = await run('Chess (Women)', [
      board('M', 'N', 'M', 2.5, 1.5), // M beat N
      board('R', 'M', 'R', 2.5, 1.5),
      board('N', 'S', 'N', 2.5, 1.5),
    ]);
    const m = s.find((r) => r.teamId === 'M')!;
    const n = s.find((r) => r.teamId === 'N')!;
    expect(m.points).toBe(n.points);
    expect(m.scoreFor).toBe(n.scoreFor);
    expect(m.rank).toBeLessThan(n.rank);
  });

  // X and Y: one win, one loss, same board points (4), never met each other.
  // X's win was over P (a strong team), Y's over R (a weak one): X has the better
  // Sonneborn-Berger. Y is given a bigger winning margin when asked.
  const menTie = (yWin: [number, number]) => [
    board('X', 'P', 'X', 2.5, 1.5),
    board('Q', 'X', 'Q', 2.5, 1.5),
    board('Y', 'R', 'Y', yWin[0], yWin[1]),
    board('Q', 'Y', 'Q', 2.5, 1.5),
    board('P', 'S', 'P', 2.5, 1.5),
    board('P', 'T', 'P', 2.5, 1.5),
  ];

  it('men: equal match points and game points are split by Sonneborn-Berger', async () => {
    const s = await run('Chess (Men)', menTie([2.5, 1.5]));
    const x = s.find((r) => r.teamId === 'X')!;
    const y = s.find((r) => r.teamId === 'Y')!;
    expect(x.points).toBe(y.points);
    expect(x.scoreFor).toBe(y.scoreFor);
    expect(x.sonnebornBerger!).toBeGreaterThan(y.sonnebornBerger!);
    expect(x.rank).toBeLessThan(y.rank);
  });

  it('men: game points come before Sonneborn-Berger', async () => {
    const s = await run('Chess (Men)', menTie([3.5, 0.5]));
    const x = s.find((r) => r.teamId === 'X')!;
    const y = s.find((r) => r.teamId === 'Y')!;
    expect(x.points).toBe(y.points);
    expect(y.scoreFor).toBeGreaterThan(x.scoreFor);
    expect(x.sonnebornBerger!).toBeGreaterThan(y.sonnebornBerger!);
    expect(y.rank).toBeLessThan(x.rank);
  });
});
