import { describe, it, expect } from 'vitest';
import { athleticsEngine } from './athletics.engine.js';
import type { EngineContext } from './types.js';

describe('athletics engine (World Athletics Technical Rules)', () => {
  it('ranks a track event by the fastest (lowest) time', () => {
    const ctx: EngineContext = {
      teamAId: 'A',
      teamBId: 'B',
      config: { eventKind: 'TRACK' },
    };
    let state = athleticsEngine.initialState(ctx);
    state = athleticsEngine.applyEvent(
      state,
      { eventType: 'RECORD_ATTEMPT', teamId: 'A', metadata: { value: 11.2 } },
      ctx,
    );
    state = athleticsEngine.applyEvent(
      state,
      { eventType: 'RECORD_ATTEMPT', teamId: 'B', metadata: { value: 10.8 } },
      ctx,
    );
    expect(state.winnerTeamId).toBe('B'); // faster time wins
    expect(state.isComplete).toBe(true);
  });

  it('ranks a field event by the best (highest) distance across multiple attempts', () => {
    const ctx: EngineContext = {
      teamAId: 'A',
      teamBId: 'B',
      config: { eventKind: 'FIELD' },
    };
    let state = athleticsEngine.initialState(ctx);
    state = athleticsEngine.applyEvent(
      state,
      { eventType: 'RECORD_ATTEMPT', teamId: 'A', metadata: { value: 6.1 } },
      ctx,
    );
    state = athleticsEngine.applyEvent(
      state,
      { eventType: 'RECORD_ATTEMPT', teamId: 'A', metadata: { value: 6.8 } },
      ctx,
    ); // A's best improves to 6.8
    state = athleticsEngine.applyEvent(
      state,
      { eventType: 'RECORD_ATTEMPT', teamId: 'B', metadata: { value: 6.5 } },
      ctx,
    );
    expect(state.winnerTeamId).toBe('A'); // 6.8 best beats 6.5
  });

  it('excludes a disqualified/foul attempt from the best-value comparison', () => {
    const ctx: EngineContext = {
      teamAId: 'A',
      teamBId: 'B',
      config: { eventKind: 'FIELD' },
    };
    let state = athleticsEngine.initialState(ctx);
    state = athleticsEngine.applyEvent(
      state,
      {
        eventType: 'RECORD_ATTEMPT',
        teamId: 'A',
        metadata: { disqualified: true },
      },
      ctx,
    );
    state = athleticsEngine.applyEvent(
      state,
      { eventType: 'RECORD_ATTEMPT', teamId: 'A', metadata: { value: 5.0 } },
      ctx,
    );
    state = athleticsEngine.applyEvent(
      state,
      { eventType: 'RECORD_ATTEMPT', teamId: 'B', metadata: { value: 4.5 } },
      ctx,
    );
    expect(state.winnerTeamId).toBe('A');
  });
});
