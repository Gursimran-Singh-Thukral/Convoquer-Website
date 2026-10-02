import { describe, expect, it, vi } from 'vitest';
import { advanceBracket, repairBracket, resolveBye } from './bracket.js';
import { buildResult } from '../results/result-formats.js';

const cancelled = {
  status: 'PUBLISHED',
  scoreDetails: { kind: 'FORFEIT', forfeitedBy: 'BOTH' },
};

/** In-memory bracket: QF1 -> SF1 slot A, QF2 -> SF1 slot B, SF1 -> Final slot A. */
function bracket(qf2Result: unknown) {
  const matches: Record<string, any> = {
    qf1: {
      id: 'qf1',
      nextMatchId: 'sf1',
      nextMatchSlot: 'A',
      result: cancelled,
      status: 'CANCELLED',
    },
    qf2: {
      id: 'qf2',
      nextMatchId: 'sf1',
      nextMatchSlot: 'B',
      result: qf2Result,
      status: 'COMPLETED',
    },
    sf1: {
      id: 'sf1',
      teamAId: null,
      teamBId: 'z',
      nextMatchId: 'fin',
      nextMatchSlot: 'A',
      result: null,
      status: 'SCHEDULED',
    },
    fin: {
      id: 'fin',
      teamAId: null,
      teamBId: null,
      result: null,
      status: 'SCHEDULED',
    },
  };
  const results: any[] = [];
  const tx: any = {
    match: {
      findUnique: vi.fn(async ({ where }: any) => {
        const m = { ...matches[where.id] };
        m.previousMatches = Object.values(matches).filter(
          (x: any) => x.nextMatchId === m.id,
        );
        return m;
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => matches[where.id]),
      update: vi.fn(async ({ where, data }: any) => {
        Object.assign(matches[where.id], data);
      }),
    },
    result: {
      create: vi.fn(async ({ data }: any) => {
        results.push(data);
        matches[data.matchId].result = {
          status: data.status,
          scoreDetails: data.scoreDetails,
        };
      }),
    },
    $queryRaw: vi.fn(),
  };
  return { tx, matches, results };
}

describe('a cancelled match gives the next opponent a bye', () => {
  it('walks the waiting team over and on to the following round', async () => {
    const { tx, matches, results } = bracket(cancelled);
    await resolveBye(tx, 'sf1');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      matchId: 'sf1',
      winnerTeamId: 'z',
      scoreDetails: { kind: 'FORFEIT', forfeitedBy: 'BYE' },
    });
    expect(matches.sf1.status).toBe('COMPLETED');
    expect(matches.fin.teamAId).toBe('z'); // advanced into the final
  });

  it('also counts a match simply set to CANCELLED, with no result', async () => {
    const { tx, matches, results } = bracket(cancelled);
    matches.qf1.result = null; // called off by status only
    await resolveBye(tx, 'sf1');
    expect(results[0]).toMatchObject({ matchId: 'sf1', winnerTeamId: 'z' });
    expect(matches.fin.teamAId).toBe('z');
  });

  it('does nothing while the other feeder is still to be played', async () => {
    const { tx, matches, results } = bracket(null);
    matches.sf1.teamBId = null; // nobody waiting yet: no bye to give
    await resolveBye(tx, 'sf1');
    expect(results).toHaveLength(0);
  });

  it('gives the bye when the other team arrives after the cancellation', async () => {
    const { tx, matches, results } = bracket({
      status: 'PUBLISHED',
      scoreDetails: { kind: 'SCORE' },
    });
    matches.sf1.teamBId = null; // winner of qf2 not placed yet
    matches.qf2.result = null;
    await resolveBye(tx, 'sf1'); // still waiting on qf2
    expect(results).toHaveLength(0);
    matches.qf2.result = {
      status: 'PUBLISHED',
      scoreDetails: { kind: 'SCORE' },
    };
    matches.qf2.winnerTeamId = 'w';
    await advanceBracket(tx, 'qf2', 'w'); // w lands in sf1 slot B
    expect(results[0]).toMatchObject({ matchId: 'sf1', winnerTeamId: 'w' });
    expect(matches.fin.teamAId).toBe('w');
  });
});

describe('cancelling a match when neither team turned up', () => {
  const ctx = { teamAId: 'a', teamBId: 'b', knockout: true };
  it('has no winner and is allowed even in a knockout', () => {
    const out = buildResult(
      'SETS',
      { kind: 'FORFEIT', forfeitedBy: 'BOTH' },
      ctx,
    );
    expect(out.winnerTeamId).toBeNull();
    expect(out.scoreDetails).toEqual({ kind: 'FORFEIT', forfeitedBy: 'BOTH' });
  });
});

describe('repairing a bracket whose winners never advanced', () => {
  it('moves published winners into empty next-round slots, and never overwrites', async () => {
    const rows: Record<string, any> = {
      m1: {
        id: 'm1',
        nextMatchId: 'q',
        nextMatchSlot: 'B',
        result: { status: 'PUBLISHED', winnerTeamId: 'gmc', scoreDetails: {} },
      },
      m2: {
        id: 'm2',
        nextMatchId: 'q2',
        nextMatchSlot: 'A',
        result: { status: 'PUBLISHED', winnerTeamId: 'x', scoreDetails: {} },
      },
      q: {
        id: 'q',
        teamAId: 'miet',
        teamBId: null,
        status: 'SCHEDULED',
        result: null,
        previousMatches: [],
      },
      q2: {
        id: 'q2',
        teamAId: 'already',
        teamBId: null,
        status: 'SCHEDULED',
        result: null,
        previousMatches: [],
      },
    };
    const update = vi.fn(async ({ where, data }: any) =>
      Object.assign(rows[where.id], data),
    );
    const tx: any = {
      match: {
        findMany: vi.fn(async () => [rows.m1, rows.m2]),
        findUnique: vi.fn(async ({ where }: any) => ({
          ...rows[where.id],
          previousMatches: [],
        })),
        update,
      },
    };
    expect(await repairBracket(tx, 't')).toBe(1);
    expect(rows.q.teamBId).toBe('gmc');
    expect(rows.q2.teamAId).toBe('already');
  });
});
