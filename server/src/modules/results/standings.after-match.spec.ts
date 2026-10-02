import { describe, expect, it, vi } from 'vitest';
import { StandingsService } from './standings.service.js';

const team = (id: string) => ({
  id,
  name: id,
  instituteId: `i${id}`,
  institute: { name: id, shortName: id },
});
const game = (
  id: string,
  matchNumber: string,
  hour: number,
  a: string,
  b: string,
  winner: string | null,
) => ({
  id,
  matchNumber,
  scheduledStartTime: new Date(Date.UTC(2026, 9, 5, hour)),
  teamAId: a,
  teamBId: b,
  teamA: team(a),
  teamB: team(b),
  winnerTeamId: winner,
  result: {
    status: 'PUBLISHED',
    finalScoreA: winner === a ? 1 : 0,
    finalScoreB: winner === b ? 1 : 0,
    winnerTeamId: winner,
    scoreDetails: { kind: 'CHESS' },
  },
});

const service = (matches: unknown[]) =>
  new StandingsService({
    tournament: {
      findUnique: vi.fn().mockResolvedValue({
        id: 't1',
        name: 'Chess (Women)',
        format: 'LEAGUE',
        sportId: 's',
        sport: { name: 'Chess (Women)' },
        seeds: [],
      }),
    },
    tournamentStage: { findUnique: vi.fn() },
    match: {
      findMany: vi.fn().mockResolvedValueOnce(matches).mockResolvedValue([]),
    },
  } as never);

describe('standings after a given match (round robin)', () => {
  // Deliberately out of order: the table must follow the play order.
  const all = [
    game('m3', 'W-M3', 12, 'a', 'c', 'c'),
    game('m1', 'W-M1', 10, 'a', 'b', 'a'),
    game('m2', 'W-M2', 11, 'b', 'c', 'b'),
  ];

  it('counts only the matches played up to and including the chosen one', async () => {
    const res = await service(all).getTournamentStandings(
      't1',
      undefined,
      undefined,
      'm2',
    );
    expect(res.stage?.name).toBe('After W-M2');
    const row = (id: string) => res.standings.find((s) => s.teamId === id)!;
    expect(row('a').points).toBe(2); // beat b; lost to c is match 3, not counted
    expect(row('b').points).toBe(2); // lost to a, beat c
    expect(row('c').points).toBe(0);
    expect(row('a').played + row('b').played + row('c').played).toBe(4);
  });

  it('shows every published match without a chosen match', async () => {
    const res = await service(all).getTournamentStandings('t1');
    expect(res.standings.reduce((n, s) => n + s.played, 0)).toBe(6);
  });
});
