import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { cricketEngine } from './cricket.engine.js';
import type { EngineContext, EngineState } from './types.js';

const ctx: EngineContext = {
  teamAId: 'A',
  teamBId: 'B',
  config: { oversPerInnings: 2 },
}; // 2-over match for fast tests

function apply(
  state: EngineState,
  eventType: string,
  teamId?: string,
  metadata?: Record<string, unknown>,
): EngineState {
  return cricketEngine.applyEvent(state, { eventType, teamId, metadata }, ctx);
}

function start(state: EngineState, battingTeamId = 'A'): EngineState {
  state = apply(state, 'TOSS', battingTeamId, {
    winnerTeamId: battingTeamId,
    decision: 'BAT',
  });
  return apply(state, 'START_INNINGS', battingTeamId, { battingTeamId });
}

describe('cricket engine (ICC/MCC-style limited-overs)', () => {
  it('records the toss and enforces the elected first batting side', () => {
    let state = apply(cricketEngine.initialState(ctx), 'TOSS', 'A', {
      winnerTeamId: 'A',
      decision: 'BOWL',
    });
    expect((state.scoreDetails as any).toss.battingTeamId).toBe('B');
    expect(() =>
      apply(state, 'START_INNINGS', 'A', { battingTeamId: 'A' }),
    ).toThrow(BadRequestException);
    state = apply(state, 'START_INNINGS', 'B', { battingTeamId: 'B' });
    expect((state.scoreDetails as any).innings[0].battingTeamId).toBe('B');
  });
  it('requires an innings to be started before recording deliveries', () => {
    const initial = cricketEngine.initialState(ctx);
    expect(() => apply(initial, 'RUN', 'A', { runs: 4 })).toThrow(
      BadRequestException,
    );
  });

  it('wide and no-ball do not consume a legal ball; runs and byes do', () => {
    let state = start(cricketEngine.initialState(ctx));
    state = apply(state, 'WIDE', 'A', { runs: 0 }); // 1 run, ball uncounted
    state = apply(state, 'RUN', 'A', { runs: 4 }); // legal ball 1
    const details = state.scoreDetails as any;
    expect(details.innings[0].balls).toBe(1);
    expect(details.innings[0].runs).toBe(5); // 1 (wide) + 4
    expect(details.innings[0].extras.wide).toBe(1);
  });

  it('ends the innings at 10 wickets (all out) even before overs are complete', () => {
    let state = apply(
      cricketEngine.initialState(ctx),
      'START_INNINGS',
      undefined,
      { battingTeamId: 'A' },
    );
    for (let i = 0; i < 10; i++)
      state = apply(state, 'WICKET', 'A', { runs: 0 });
    const details = state.scoreDetails as any;
    expect(details.innings[0].wickets).toBe(10);
    expect(details.innings[0].completed).toBe(true);
  });

  it('ends the innings once overs are complete (2-over match = 12 legal balls)', () => {
    let state = apply(
      cricketEngine.initialState(ctx),
      'START_INNINGS',
      undefined,
      { battingTeamId: 'A' },
    );
    for (let i = 0; i < 12; i++) state = apply(state, 'RUN', 'A', { runs: 1 });
    const details = state.scoreDetails as any;
    expect(details.innings[0].balls).toBe(12);
    expect(details.innings[0].completed).toBe(true);
    expect(state.teamAScore).toBe(12);
  });

  it('sets the second-innings target to first-innings runs + 1, and declares the chasing team the winner once the target is reached', () => {
    let state = apply(
      cricketEngine.initialState(ctx),
      'START_INNINGS',
      undefined,
      { battingTeamId: 'A' },
    );
    for (let i = 0; i < 12; i++) state = apply(state, 'RUN', 'A', { runs: 5 }); // 60 runs
    state = apply(state, 'START_INNINGS', undefined, { battingTeamId: 'B' });
    expect((state.scoreDetails as any).target).toBe(61);
    for (
      let i = 0;
      i < 11 && !(state.scoreDetails as any).innings[1].completed;
      i++
    )
      state = apply(state, 'RUN', 'B', { runs: 6 }); // sixes — reaches 61 within the 12-ball limit
    expect(state.winnerTeamId).toBe('B');
    expect(state.isComplete).toBe(true);
  });

  it('declares the defending team the winner if the chase falls short after overs run out', () => {
    let state = apply(
      cricketEngine.initialState(ctx),
      'START_INNINGS',
      undefined,
      { battingTeamId: 'A' },
    );
    for (let i = 0; i < 12; i++) state = apply(state, 'RUN', 'A', { runs: 5 }); // 60 runs
    state = apply(state, 'START_INNINGS', undefined, { battingTeamId: 'B' });
    for (let i = 0; i < 12; i++) state = apply(state, 'RUN', 'B', { runs: 1 }); // only 12 runs, overs complete
    expect(state.winnerTeamId).toBe('A');
    expect(state.isComplete).toBe(true);
  });

  it('rejects a second innings batted by the same team as the first', () => {
    let state = apply(
      cricketEngine.initialState(ctx),
      'START_INNINGS',
      undefined,
      { battingTeamId: 'A' },
    );
    for (let i = 0; i < 12; i++) state = apply(state, 'RUN', 'A', { runs: 1 });
    expect(() =>
      apply(state, 'START_INNINGS', undefined, { battingTeamId: 'A' }),
    ).toThrow(BadRequestException);
  });

  it('tracks batters, bowlers, strike rotation and over changes', () => {
    let state = apply(cricketEngine.initialState(ctx), 'START_INNINGS', 'A', {
      battingTeamId: 'A',
      strikerId: 'a1',
      nonStrikerId: 'a2',
      bowlerId: 'b1',
    });
    state = cricketEngine.applyEvent(
      state,
      {
        eventType: 'RUN',
        teamId: 'A',
        participantId: 'a1',
        metadata: { runs: 1, bowlerId: 'b1' },
      },
      ctx,
    );
    let innings = (state.scoreDetails as any).innings[0];
    expect(innings.strikerId).toBe('a2');
    expect(innings.batters.a1).toMatchObject({ runs: 1, balls: 1 });
    for (let i = 0; i < 5; i++)
      state = apply(state, 'RUN', 'A', {
        runs: 0,
        strikerId: 'a2',
        bowlerId: 'b1',
      });
    innings = (state.scoreDetails as any).innings[0];
    expect(innings.bowlerId).toBeNull();
    expect(innings.bowlers.b1.balls).toBe(6);
  });

  it('enforces free-hit dismissal rules and stores a valid run-out', () => {
    let state = apply(cricketEngine.initialState(ctx), 'START_INNINGS', 'A', {
      battingTeamId: 'A',
      strikerId: 'a1',
      nonStrikerId: 'a2',
      bowlerId: 'b1',
    });
    state = apply(state, 'NO_BALL', 'A', { runs: 0 });
    expect(() =>
      apply(state, 'WICKET', 'A', { dismissalType: 'BOWLED' }),
    ).toThrow(BadRequestException);
    state = apply(state, 'WICKET', 'A', {
      dismissalType: 'RUN_OUT',
      dismissedPlayerId: 'a1',
      nextBatterId: 'a3',
    });
    expect((state.scoreDetails as any).innings[0].batters.a1.out).toBe(true);
  });
});
