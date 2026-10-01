import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import {
  buildResult,
  gamesConfigFor,
  resultKindFor,
  type FormatContext,
} from './result-formats.js';

const ctx: FormatContext = { teamAId: 'A', teamBId: 'B', knockout: false };
const ko: FormatContext = { ...ctx, knockout: true };

describe('resultKindFor', () => {
  it('maps sports to their scorecard', () => {
    expect(resultKindFor('Badminton (Men)')).toBe('GAMES');
    expect(resultKindFor('Badminton (Women)')).toBe('GAMES');
    expect(resultKindFor('Table Tennis (Women)')).toBe('GAMES');
    expect(resultKindFor('Table Tennis (Men)')).toBe('GAMES');
    expect(resultKindFor('Volleyball (Men)')).toBe('SETS');
    expect(resultKindFor('Basketball (Women)')).toBe('QUARTERS');
    expect(resultKindFor('Cricket')).toBe('CRICKET');
    expect(resultKindFor('Football')).toBe('FOOTBALL');
    expect(resultKindFor('Chess (Men)')).toBe('CHESS');
    expect(resultKindFor('Athletics')).toBe('TRACK');
  });
  it('splits E-Sports by game', () => {
    expect(resultKindFor('E-Sports', 'Free Fire - Match 1')).toBe('LOBBY');
    expect(resultKindFor('E-Sports', 'BGMI - Match 2')).toBe('LOBBY');
    expect(resultKindFor('E-Sports', 'Valorant Match 1: IIM vs CU')).toBe(
      'SCORE',
    );
  });
});

describe('SETS (best of 3)', () => {
  it('derives sets won and the winner', () => {
    const r = buildResult(
      'SETS',
      {
        sets: [
          { a: 21, b: 15 },
          { a: 18, b: 21 },
          { a: 21, b: 19 },
        ],
      },
      ctx,
    );
    expect([r.finalScoreA, r.finalScoreB, r.winnerTeamId]).toEqual([2, 1, 'A']);
    expect(r.scoreDetails.kind).toBe('SETS');
  });
  it('accepts a straight-sets win', () => {
    const r = buildResult(
      'SETS',
      {
        sets: [
          { a: 10, b: 21 },
          { a: 12, b: 21 },
        ],
      },
      ctx,
    );
    expect([r.finalScoreA, r.finalScoreB, r.winnerTeamId]).toEqual([0, 2, 'B']);
  });
  it('rejects a level set, an undecided match and a redundant third set', () => {
    expect(() =>
      buildResult(
        'SETS',
        {
          sets: [
            { a: 21, b: 21 },
            { a: 21, b: 10 },
          ],
        },
        ctx,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      buildResult(
        'SETS',
        {
          sets: [
            { a: 21, b: 10 },
            { a: 10, b: 21 },
          ],
        },
        ctx,
      ),
    ).toThrow(/next set/);
    expect(() =>
      buildResult(
        'SETS',
        {
          sets: [
            { a: 21, b: 10 },
            { a: 21, b: 12 },
            { a: 5, b: 21 },
          ],
        },
        ctx,
      ),
    ).toThrow(/already decided/);
  });
});

describe('SETS (volleyball, best of 5)', () => {
  const vb: FormatContext = { ...ctx, bestOf: 5 };
  const row = (...s: [number, number][]) => ({
    sets: s.map(([a, b]) => ({ a, b })),
  });
  it('needs 3 sets won and records the set-wise score', () => {
    const r = buildResult(
      'SETS',
      row([25, 20], [20, 25], [25, 22], [18, 25], [15, 12]),
      vb,
    );
    expect([r.finalScoreA, r.finalScoreB, r.winnerTeamId]).toEqual([3, 2, 'A']);
    expect(r.scoreDetails.bestOf).toBe(5);
    expect(
      buildResult('SETS', row([25, 10], [25, 12], [25, 9]), vb).winnerTeamId,
    ).toBe('A');
  });
  it('rejects an undecided match and sets after the deciding one', () => {
    expect(() => buildResult('SETS', row([25, 10], [25, 12]), vb)).toThrow(
      /3 to 5 sets/,
    );
    expect(() =>
      buildResult('SETS', row([25, 10], [10, 25], [25, 12], [10, 25]), vb),
    ).toThrow(/next set/);
    expect(() =>
      buildResult('SETS', row([25, 10], [25, 12], [25, 9], [25, 9]), vb),
    ).toThrow(/already decided/);
  });
});

describe('GAMES (badminton men, best of 5 games of 3 sets)', () => {
  const game = (...sets: [number, number][]) => ({
    sets: sets.map(([a, b]) => ({ a, b })),
  });
  const won = game([21, 10], [21, 12]); // A wins 2-0
  const lost = game([10, 21], [12, 21]); // B wins 2-0
  it('decides the tie on games won, not sets', () => {
    const r = buildResult(
      'GAMES',
      { games: [won, lost, game([21, 19], [19, 21], [21, 18]), lost, won] },
      ctx,
    );
    expect([r.finalScoreA, r.finalScoreB, r.winnerTeamId]).toEqual([3, 2, 'A']);
    expect(r.scoreDetails.kind).toBe('GAMES');
  });
  it('ends as soon as a team has 3 games', () => {
    expect(
      buildResult('GAMES', { games: [won, won, won] }, ctx).winnerTeamId,
    ).toBe('A');
    expect(() =>
      buildResult('GAMES', { games: [won, won, won, lost] }, ctx),
    ).toThrow(/already decided/);
  });
  it('rejects an undecided tie, an undecided game and level sets', () => {
    expect(() =>
      buildResult('GAMES', { games: [won, lost, won] }, ctx),
    ).toThrow(/3 games/);
    expect(() =>
      buildResult(
        'GAMES',
        { games: [won, won, game([21, 10], [10, 21])] },
        ctx,
      ),
    ).toThrow(/deciding set/);
    expect(() =>
      buildResult(
        'GAMES',
        { games: [won, won, game([21, 21], [21, 10])] },
        ctx,
      ),
    ).toThrow(/level/);
    expect(() => buildResult('GAMES', { games: [won, won] }, ctx)).toThrow(
      /3 to 5 games/,
    );
  });
});

describe('GAMES (badminton women best of 3, table tennis play-all)', () => {
  const game = (...sets: [number, number][]) => ({
    sets: sets.map(([a, b]) => ({ a, b })),
  });
  const won = game([21, 10], [21, 12]);
  const lost = game([10, 21], [12, 21]);
  it('badminton women: best of 3 games, stopping at 2', () => {
    const cfg = gamesConfigFor('Badminton (Women)')!;
    expect(cfg).toMatchObject({ count: 3, playAll: false });
    const w: FormatContext = { ...ctx, games: cfg };
    expect(buildResult('GAMES', { games: [won, won] }, w).winnerTeamId).toBe(
      'A',
    );
    expect(
      buildResult('GAMES', { games: [won, lost, won] }, w).finalScoreA,
    ).toBe(2);
    expect(() => buildResult('GAMES', { games: [won, won, won] }, w)).toThrow(
      /already decided/,
    );
    expect(() => buildResult('GAMES', { games: [won, lost] }, w)).toThrow(
      /2 to 3 games|next game/,
    );
  });
  const t11 = (a: number, b: number) => ({ a, b });
  const tt = (...sets: [number, number][]) => ({
    sets: sets.map(([a, b]) => t11(a, b)),
  });
  it('table tennis boys: all 5 matches, each best of 3 sets to 11', () => {
    const cfg = gamesConfigFor('Table Tennis (Men)')!;
    expect(cfg).toMatchObject({
      count: 5,
      playAll: true,
      setTo: 11,
      unit: 'Match',
    });
    const m: FormatContext = { ...ctx, games: cfg };
    const a = tt([11, 5], [11, 9]);
    const b = tt([4, 11], [9, 11]);
    const r = buildResult('GAMES', { games: [a, a, b, a, b] }, m);
    expect([r.finalScoreA, r.finalScoreB, r.winnerTeamId]).toEqual([3, 2, 'A']);
    expect(r.scoreDetails).toMatchObject({
      playAll: true,
      unit: 'Match',
      bestOf: 5,
    });
    // a decided tie still needs the remaining matches recorded
    expect(() => buildResult('GAMES', { games: [a, a, a] }, m)).toThrow(
      /all 5 matches/,
    );
  });
  it('table tennis girls: all 3 matches; sets validated to 11 win-by-2', () => {
    const m: FormatContext = {
      ...ctx,
      games: gamesConfigFor('Table Tennis (Women)')!,
    };
    const a = tt([11, 7], [12, 10]);
    const b = tt([5, 11], [8, 11]);
    expect(buildResult('GAMES', { games: [a, b, a] }, m).winnerTeamId).toBe(
      'A',
    );
    expect(() =>
      buildResult('GAMES', { games: [tt([11, 10], [11, 5]), b, a] }, m),
    ).toThrow(/won by 2/);
    expect(() =>
      buildResult('GAMES', { games: [tt([10, 5], [11, 5]), b, a] }, m),
    ).toThrow(/played to 11/);
    expect(() =>
      buildResult('GAMES', { games: [tt([13, 9], [11, 5]), b, a] }, m),
    ).toThrow(/won by 2/);
  });
});

describe('QUARTERS (basketball)', () => {
  const q = (...p: [number, number][]) => p.map(([a, b]) => ({ a, b }));
  it('sums four quarters', () => {
    const r = buildResult(
      'QUARTERS',
      { periods: q([20, 15], [18, 22], [25, 20], [16, 14]) },
      ctx,
    );
    expect([r.finalScoreA, r.finalScoreB, r.winnerTeamId]).toEqual([
      79,
      71,
      'A',
    ]);
  });
  it('requires 4 quarters, and overtime when level', () => {
    expect(() => buildResult('QUARTERS', { periods: q([10, 8]) }, ctx)).toThrow(
      /4 quarters/,
    );
    expect(() =>
      buildResult(
        'QUARTERS',
        { periods: q([10, 10], [10, 10], [10, 10], [10, 10]) },
        ctx,
      ),
    ).toThrow(/overtime/);
    const r = buildResult(
      'QUARTERS',
      {
        periods: q([10, 10], [10, 10], [10, 10], [10, 10]),
        overtime: q([6, 4]),
      },
      ctx,
    );
    expect([r.finalScoreA, r.finalScoreB, r.winnerTeamId]).toEqual([
      46,
      44,
      'A',
    ]);
  });
  it('rejects overtime when the game was not level', () => {
    expect(() =>
      buildResult(
        'QUARTERS',
        {
          periods: q([20, 10], [10, 10], [10, 10], [10, 10]),
          overtime: q([1, 0]),
        },
        ctx,
      ),
    ).toThrow(/level/);
  });
});

describe('CRICKET (20 overs)', () => {
  const inn = (runs: number, wickets: number, overs: string) => ({
    runs,
    wickets,
    overs,
  });
  it('computes winner by runs', () => {
    const r = buildResult(
      'CRICKET',
      {
        battingFirst: 'A',
        innings: { A: inn(160, 6, '20'), B: inn(148, 9, '20') },
      },
      ctx,
    );
    expect([r.finalScoreA, r.finalScoreB, r.winnerTeamId]).toEqual([
      160,
      148,
      'A',
    ]);
  });
  it('rejects more than 20 overs or invalid balls', () => {
    expect(() =>
      buildResult(
        'CRICKET',
        {
          battingFirst: 'A',
          innings: { A: inn(160, 6, '20.1'), B: inn(1, 1, '1') },
        },
        ctx,
      ),
    ).toThrow(/exceed 20/);
    expect(() =>
      buildResult(
        'CRICKET',
        {
          battingFirst: 'A',
          innings: { A: inn(1, 1, '18.7'), B: inn(1, 1, '1') },
        },
        ctx,
      ),
    ).toThrow(/overs/);
    expect(() =>
      buildResult(
        'CRICKET',
        {
          battingFirst: 'A',
          innings: { A: inn(1, 11, '5'), B: inn(1, 1, '1') },
        },
        ctx,
      ),
    ).toThrow(/wickets/);
  });
  it('needs a super over or winner for a tied knockout', () => {
    const tied = {
      battingFirst: 'B',
      innings: { A: inn(150, 5, '20'), B: inn(150, 8, '20') },
    };
    expect(() => buildResult('CRICKET', tied, ko)).toThrow(/super over/);
    expect(
      buildResult('CRICKET', { ...tied, superOver: { a: 8, b: 12 } }, ko)
        .winnerTeamId,
    ).toBe('B');
    expect(
      buildResult('CRICKET', tied, { ...ko, requestedWinnerId: 'A' })
        .winnerTeamId,
    ).toBe('A');
  });
});

describe('FOOTBALL', () => {
  it('records a normal result', () => {
    const r = buildResult('FOOTBALL', { regulation: { a: 2, b: 1 } }, ctx);
    expect([r.finalScoreA, r.finalScoreB, r.winnerTeamId]).toEqual([2, 1, 'A']);
  });
  it('decides a level knockout on penalties, keeping the goals level', () => {
    const r = buildResult(
      'FOOTBALL',
      { regulation: { a: 1, b: 1 }, penalties: { a: 3, b: 4 } },
      ko,
    );
    expect([r.finalScoreA, r.finalScoreB, r.winnerTeamId]).toEqual([1, 1, 'B']);
    expect(r.scoreDetails.penalties).toEqual({ a: 3, b: 4 });
  });
  it('adds extra-time goals to the score', () => {
    const r = buildResult(
      'FOOTBALL',
      { regulation: { a: 0, b: 0 }, extraTime: { a: 1, b: 0 } },
      ko,
    );
    expect([r.finalScoreA, r.finalScoreB, r.winnerTeamId]).toEqual([1, 0, 'A']);
  });
  it('rejects penalties on a decided game, level shoot-outs and a missing knockout decider', () => {
    expect(() =>
      buildResult(
        'FOOTBALL',
        { regulation: { a: 2, b: 1 }, penalties: { a: 3, b: 4 } },
        ko,
      ),
    ).toThrow(/level/);
    expect(() =>
      buildResult(
        'FOOTBALL',
        { regulation: { a: 1, b: 1 }, penalties: { a: 4, b: 4 } },
        ko,
      ),
    ).toThrow(/level/);
    expect(() =>
      buildResult('FOOTBALL', { regulation: { a: 1, b: 1 } }, ko),
    ).toThrow(/penalty/);
    expect(
      buildResult('FOOTBALL', { regulation: { a: 1, b: 1 } }, ctx).winnerTeamId,
    ).toBeNull();
  });
});

describe('CHESS', () => {
  it('totals board results in half points', () => {
    const r = buildResult(
      'CHESS',
      { boards: [{ a: 1 }, { a: 0.5 }, { a: 0 }, { a: 0.5 }] },
      ctx,
    );
    expect([r.finalScoreA, r.finalScoreB, r.winnerTeamId]).toEqual([
      2,
      2,
      null,
    ]);
  });
  it('requires exactly four boards — one per player', () => {
    expect(() =>
      buildResult('CHESS', { boards: [{ a: 1 }, { a: 1 }, { a: 1 }] }, ctx),
    ).toThrow(/4 players/);
    expect(() =>
      buildResult('CHESS', { boards: Array(5).fill({ a: 1 }) }, ctx),
    ).toThrow(/4 players/);
    expect(
      buildResult(
        'CHESS',
        { boards: [{ a: 1 }, { a: 1 }, { a: 0 }, { a: 0 }] },
        ctx,
      ).winnerTeamId,
    ).toBeNull();
  });
  it('accepts direct half-point scores and rejects quarter points', () => {
    expect(buildResult('CHESS', {}, ctx, { a: 3.5, b: 2.5 }).winnerTeamId).toBe(
      'A',
    );
    expect(() => buildResult('CHESS', {}, ctx, { a: 3.25, b: 2 })).toThrow(
      BadRequestException,
    );
  });
});

describe('TRACK (athletics)', () => {
  const field = new Map([
    ['A', { name: 'CU Athletics', shortName: 'CU' }],
    ['B', { name: 'IIMJ Athletics', shortName: 'IIMJ' }],
    ['C', { name: 'MIET Athletics', shortName: 'MIET' }],
    ['D', { name: 'GCET Athletics', shortName: 'GCET' }],
  ]);
  const tctx: FormatContext = {
    teamAId: null,
    teamBId: null,
    knockout: false,
    fieldTeams: field,
  };
  it('records ranked entries with qualifiers and needs no two teams', () => {
    const r = buildResult(
      'TRACK',
      {
        round: 'SEMIFINAL',
        sections: [
          {
            category: 'Men',
            entries: [
              { teamId: 'A', rank: 1, mark: '10.85', qualified: true },
              { teamId: 'B', rank: 2, mark: '10.91', qualified: true },
              { teamId: 'C', rank: 3, note: undefined, mark: '11.20' },
            ],
          },
        ],
      },
      tctx,
    );
    expect(r.winnerTeamId).toBe('A');
    expect(r.scoreDetails.round).toBe('SEMIFINAL');
    expect((r.scoreDetails as any).sections[0].entries[0].teamName).toBe(
      'CU Athletics',
    );
  });
  it('supports status codes and several categories in one event', () => {
    const r = buildResult(
      'TRACK',
      {
        sections: [
          {
            category: 'Men',
            entries: [
              { teamId: 'A', rank: 1 },
              { teamId: 'B', note: 'dns' },
            ],
          },
          { category: 'Women', entries: [{ teamId: 'C', rank: 1 }] },
        ],
      },
      tctx,
    );
    expect(r.winnerTeamId).toBeNull(); // two categories — no single winner
  });
  it('rejects unknown teams, bad categories and tables that skip first place', () => {
    expect(() =>
      buildResult(
        'TRACK',
        {
          sections: [{ category: 'Men', entries: [{ teamId: 'X', rank: 1 }] }],
        },
        tctx,
      ),
    ).toThrow(/registered/);
    expect(() =>
      buildResult(
        'TRACK',
        {
          sections: [{ category: 'Kids', entries: [{ teamId: 'A', rank: 1 }] }],
        },
        tctx,
      ),
    ).toThrow(/category/);
    expect(() =>
      buildResult(
        'TRACK',
        {
          sections: [{ category: 'Men', entries: [{ teamId: 'A', rank: 2 }] }],
        },
        tctx,
      ),
    ).toThrow(/start at 1/);
  });
});

describe('LOBBY (Free Fire / BGMI)', () => {
  const lctx: FormatContext = {
    teamAId: null,
    teamBId: null,
    knockout: false,
    fieldTeams: new Map([
      ['A', { name: 'A' }],
      ['B', { name: 'B' }],
    ]),
  };
  it('ranks teams with kills and points', () => {
    const r = buildResult(
      'LOBBY',
      {
        game: 'BGMI',
        entries: [
          { teamId: 'B', rank: 1, kills: 9, points: 21 },
          { teamId: 'A', rank: 2, kills: 4, points: 10 },
        ],
      },
      lctx,
    );
    expect(r.winnerTeamId).toBe('B');
    expect(() =>
      buildResult(
        'LOBBY',
        {
          entries: [
            { teamId: 'A', rank: 1 },
            { teamId: 'A', rank: 2 },
          ],
        },
        lctx,
      ),
    ).toThrow(/twice/);
  });
});

describe('SCORE', () => {
  it('never lets a must-decide match (Valorant) end level', () => {
    expect(() =>
      buildResult('SCORE', { a: 1, b: 1 }, { ...ctx, mustDecide: true }),
    ).toThrow(/winner/);
  });
  it('records a plain final score (Valorant)', () => {
    const r = buildResult('SCORE', { a: 13, b: 9 }, ctx);
    expect(r.winnerTeamId).toBe('A');
  });
});

describe('payload guards', () => {
  it('requires details and a matching kind', () => {
    expect(() => buildResult('SETS', undefined, ctx)).toThrow(
      BadRequestException,
    );
    expect(() => buildResult('SETS', { kind: 'QUARTERS' }, ctx)).toThrow(
      /SETS/,
    );
    expect(() =>
      buildResult('SETS', { sets: [] }, { ...ctx, teamAId: null }),
    ).toThrow(BadRequestException);
  });
});
