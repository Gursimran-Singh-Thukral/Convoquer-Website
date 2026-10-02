import { describe, expect, it, vi } from 'vitest';
import { advanceBracket, resolveBye } from './bracket.js';
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
