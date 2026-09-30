import { describe, expect, it, vi } from 'vitest';
import { StandingsService } from './standings.service.js';

const team = (id: string, name: string) => ({
  id,
  name,
  instituteId: `i-${id}`,
  institute: { name: `${name} Inst`, shortName: id.toUpperCase() },
});

const lobby = (
  game: string,
  rows: [string, number, number, number][], // [teamId, rank, placementPoints, killPoints]
) => ({
  result: {
    status: 'PUBLISHED',
    scoreDetails: {
      kind: 'LOBBY',
      game,
      entries: rows.map(([teamId, rank, pp, kp]) => ({
        teamId,
        rank,
        kills: kp,
        placementPoints: pp,
        killPoints: kp,
        points: pp + kp,
      })),
    },
  },
});

function service(name: string, games: unknown[]) {
  const prisma: any = {
    tournament: {
      findUnique: vi.fn().mockResolvedValue({
        id: 't1',
        name,
        format: 'LEAGUE',
        sportId: 's1',
        sport: { name: 'E-Sports' },
        seeds: [],
      }),
    },
    tournamentStage: { findUnique: vi.fn() },
    match: { findMany: vi.fn().mockResolvedValue(games) },
    team: {
      findMany: vi
        .fn()
        .mockResolvedValue([team('x', 'X'), team('y', 'Y'), team('z', 'Z')]),
    },
  };
  return new StandingsService(prisma);
}

describe('Free Fire / BGMI overall points table', () => {
  it('adds placement and kill points over every game and ranks by total', async () => {
    const svc = service('E-Sports — Free Fire', [
      lobby('Free Fire', [
        ['x', 1, 12, 2],
        ['y', 2, 9, 5],
        ['z', 3, 8, 1],
      ]),
      lobby('Free Fire', [
        ['x', 2, 9, 0],
        ['y', 1, 12, 6],
        ['z', 3, 8, 3],
      ]),
    ]);
    const { standings } = await svc.getTournamentStandings('t1');
    expect(
      standings.map((s) => [
        s.teamId,
        s.points,
        s.won,
        s.placementPoints,
        s.killPoints,
      ]),
    ).toEqual([
      ['y', 32, 1, 21, 11],
      ['x', 23, 1, 21, 2],
      ['z', 20, 0, 16, 4],
    ]);
    expect(standings.map((s) => s.rank)).toEqual([1, 2, 3]);
    expect(standings[0].played).toBe(2);
  });

  it('Free Fire breaks a points tie on wins, then kill points', async () => {
    // x and y both 21; x has the win, so x leads despite fewer kills.
    const svc = service('E-Sports — Free Fire', [
      lobby('Free Fire', [
        ['x', 1, 12, 0],
        ['y', 2, 9, 8],
        ['z', 3, 0, 0],
      ]),
      lobby('Free Fire', [
        ['x', 2, 9, 0],
        ['y', 3, 4, 0],
        ['z', 1, 0, 0],
      ]),
    ]);
    const { standings } = await svc.getTournamentStandings('t1');
    expect(standings[0].teamId).toBe('x');
    expect(standings[1].teamId).toBe('y');
  });

  it('breaks an equal-wins tie on kill points in Free Fire but placement points in BGMI', async () => {
    const games = (game: string) => [
      // a: PP 10 + KP 5 = 15, b: PP 8 + KP 7 = 15, neither wins
      lobby(game, [
        ['x', 1, 15, 0],
        ['y', 3, 8, 7],
        ['z', 2, 10, 5],
      ]),
    ];
    const ff = await service(
      'E-Sports — Free Fire',
      games('Free Fire'),
    ).getTournamentStandings('t1');
    const order = (s: typeof ff) => s.standings.map((r) => r.teamId);
    expect(order(ff).slice(1)).toEqual(['y', 'z']); // higher kill points first
    const bgmi = await service(
      'E-Sports — BGMI',
      games('BGMI'),
    ).getTournamentStandings('t1');
    expect(order(bgmi).slice(1)).toEqual(['z', 'y']); // higher placement points first
  });
});

describe('several teams from one college', () => {
  it('ranks each E-Sports team separately', async () => {
    const prisma: any = {
      tournament: {
        findUnique: vi.fn().mockResolvedValue({
          id: 't1',
          name: 'E-Sports — BGMI',
          format: 'LEAGUE',
          sportId: 's1',
          sport: { name: 'E-Sports' },
          seeds: [],
        }),
      },
      tournamentStage: { findUnique: vi.fn() },
      match: {
        findMany: vi.fn().mockResolvedValue([
          lobby('BGMI', [
            ['g1', 2, 12, 3],
            ['g2', 1, 15, 8],
          ]),
        ]),
      },
      team: {
        findMany: vi.fn().mockResolvedValue([
          {
            ...team('g1', 'GCET E-Sports (BGMI - Team 1)'),
            instituteId: 'gcet',
          },
          {
            ...team('g2', 'GCET E-Sports (BGMI - Team 2)'),
            instituteId: 'gcet',
          },
        ]),
      },
    };
    const { standings } = await new StandingsService(
      prisma,
    ).getTournamentStandings('t1');
    expect(standings.map((s) => [s.teamName, s.instituteId, s.points])).toEqual(
      [
        ['GCET E-Sports (BGMI - Team 2)', 'gcet', 23],
        ['GCET E-Sports (BGMI - Team 1)', 'gcet', 15],
      ],
    );
  });
});
