import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { basketballEngine } from './basketball.engine.js';
import type { EngineContext, EngineState } from './types.js';

const ctx: EngineContext = { teamAId: 'A', teamBId: 'B', config: {} };
function apply(
  state: EngineState,
  eventType: string,
  teamId?: string,
  participantId?: string,
): EngineState {
  return basketballEngine.applyEvent(
    state,
    { eventType, teamId, participantId },
    ctx,
  );
}

describe('basketball engine (FIBA Official Basketball Rules)', () => {
  it('awards 1/2/3 points for free throw / two-pointer / three-pointer', () => {
    let state = basketballEngine.initialState(ctx);
    state = apply(state, 'FREE_THROW', 'A');
    state = apply(state, 'TWO_POINTS', 'A');
    state = apply(state, 'THREE_POINTS', 'A');
    expect(state.teamAScore).toBe(6);
  });

  it('goes to overtime if tied after 4 quarters, and only ends once someone leads', () => {
    let state = basketballEngine.initialState(ctx);
    state = apply(state, 'TWO_POINTS', 'A');
    state = apply(state, 'TWO_POINTS', 'B');
    for (let i = 0; i < 4; i++) state = apply(state, 'PERIOD_END');
    expect(state.currentPeriod).toBe('OT1');
    expect(state.isComplete).toBe(false);
    state = apply(state, 'TWO_POINTS', 'A');
    state = apply(state, 'PERIOD_END');
    expect(state.isComplete).toBe(true);
    expect(state.winnerTeamId).toBe('A');
  });

  it('fouls a player out at the 6th personal foul', () => {
    let state = basketballEngine.initialState(ctx);
    for (let i = 0; i < 5; i++) state = apply(state, 'FOUL', 'A', 'player-1');
    expect(() => apply(state, 'FOUL', 'A', 'player-1')).toThrow(
      BadRequestException,
    );
  });
});
