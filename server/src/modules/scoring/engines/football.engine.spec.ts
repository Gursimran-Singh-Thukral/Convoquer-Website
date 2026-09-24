import { describe, it, expect } from 'vitest';
import { footballEngine } from './football.engine.js';
import type { EngineContext, EngineState } from './types.js';

const ctx: EngineContext = { teamAId: 'A', teamBId: 'B', config: {} };
function apply(
  state: EngineState,
  eventType: string,
  teamId?: string,
): EngineState {
  return footballEngine.applyEvent(state, { eventType, teamId }, ctx);
}

describe('football engine (FIFA Laws of the Game)', () => {
  it('credits an own goal to the opposing team', () => {
    const state = apply(footballEngine.initialState(ctx), 'OWN_GOAL', 'A');
    expect(state.teamBScore).toBe(1);
    expect(state.teamAScore).toBe(0);
  });

  it('allows a draw in regulation when a decider is not required', () => {
    let state = footballEngine.initialState(ctx);
    state = apply(state, 'GOAL', 'A');
    state = apply(state, 'GOAL', 'B');
    state = apply(state, 'PERIOD_END'); // -> 2nd half
    state = apply(state, 'PERIOD_END'); // -> full time
    expect(state.isComplete).toBe(true);
    expect(state.winnerTeamId).toBeNull();
    expect(state.currentPeriod).toBe('Full Time');
  });

  it('goes to a penalty shootout when a decider is required and scores are level', () => {
    const decidingCtx: EngineContext = { ...ctx, config: { decider: true } };
    let state = footballEngine.initialState(decidingCtx);
    state = footballEngine.applyEvent(
      state,
      { eventType: 'PERIOD_END' },
      decidingCtx,
    );
    state = footballEngine.applyEvent(
      state,
      { eventType: 'PERIOD_END' },
      decidingCtx,
    );
    expect(state.currentPeriod).toBe('Penalty Shootout');
    state = footballEngine.applyEvent(
      state,
      { eventType: 'PENALTY_MISS', teamId: 'B' },
      decidingCtx,
    );
    expect(state.isComplete).toBe(false); // still level 0-0 on shootout kicks taken
    state = footballEngine.applyEvent(
      state,
      { eventType: 'PENALTY_GOAL', teamId: 'A' },
      decidingCtx,
    );
    expect(state.winnerTeamId).toBe('A');
    expect(state.isComplete).toBe(true);
  });
});
