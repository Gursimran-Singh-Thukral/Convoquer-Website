import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { weightliftingEngine } from './weightlifting.engine.js';
import type { EngineContext, EngineState } from './types.js';

const ctx: EngineContext = { teamAId: 'A', teamBId: 'B', config: {} };

function attempt(
  state: EngineState,
  teamId: string,
  discipline: string,
  weightKg: number,
  success: boolean,
): EngineState {
  return weightliftingEngine.applyEvent(
    state,
    {
      eventType: 'ATTEMPT',
      teamId,
      metadata: { discipline, weightKg, success },
    },
    ctx,
  );
}

describe('weightlifting engine (IWF Technical & Competition Rules)', () => {
  it('only counts the best successful lift per discipline toward the Total', () => {
    let state = weightliftingEngine.initialState(ctx);
    state = attempt(state, 'A', 'SNATCH', 80, true);
    state = attempt(state, 'A', 'SNATCH', 85, false); // failed, doesn't count
    state = attempt(state, 'A', 'SNATCH', 83, true); // best successful snatch = 83
    state = attempt(state, 'A', 'CLEAN_AND_JERK', 100, true);
    state = attempt(state, 'A', 'CLEAN_AND_JERK', 105, true); // best C&J = 105
    state = attempt(state, 'A', 'CLEAN_AND_JERK', 90, true);
    expect(state.teamAScore).toBe(83 + 105);
  });

  it('rejects a 4th attempt in the same discipline', () => {
    let state = weightliftingEngine.initialState(ctx);
    state = attempt(state, 'A', 'SNATCH', 80, true);
    state = attempt(state, 'A', 'SNATCH', 82, true);
    state = attempt(state, 'A', 'SNATCH', 84, true);
    expect(() => attempt(state, 'A', 'SNATCH', 86, true)).toThrow(
      BadRequestException,
    );
  });

  it('ranks by Total once both sides have used all 6 attempts, tie-broken by bodyweight', () => {
    let state = weightliftingEngine.initialState(ctx);
    for (const [side, sn, cj] of [
      ['A', 80, 100],
      ['B', 80, 100],
    ] as const) {
      for (let i = 0; i < 3; i++)
        state = attempt(state, side, 'SNATCH', sn, i === 0);
      for (let i = 0; i < 3; i++)
        state = attempt(state, side, 'CLEAN_AND_JERK', cj, i === 0);
    }
    expect(state.teamAScore).toBe(state.teamBScore); // tied Totals
    expect(state.winnerTeamId).toBeNull(); // no bodyweight recorded yet
    state = weightliftingEngine.applyEvent(
      state,
      {
        eventType: 'SET_BODYWEIGHT',
        teamId: 'A',
        metadata: { bodyWeightKg: 69 },
      },
      ctx,
    );
    state = weightliftingEngine.applyEvent(
      state,
      {
        eventType: 'SET_BODYWEIGHT',
        teamId: 'B',
        metadata: { bodyWeightKg: 73 },
      },
      ctx,
    );
    expect(state.winnerTeamId).toBe('A'); // lighter lifter wins the tie
    expect(state.isComplete).toBe(true);
  });
});
