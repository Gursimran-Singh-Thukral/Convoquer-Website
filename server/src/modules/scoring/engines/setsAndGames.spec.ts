import { describe, it, expect } from 'vitest';
import { badmintonEngine } from './badminton.engine.js';
import { tableTennisEngine } from './table-tennis.engine.js';
import { volleyballEngine } from './volleyball.engine.js';
import { squashEngine } from './squash.engine.js';
import type { EngineContext, SportEngine, EngineState } from './types.js';

const ctx: EngineContext = { teamAId: 'A', teamBId: 'B', config: {} };

function pointsFor(
  engine: SportEngine,
  state: EngineState,
  teamId: string,
  n: number,
): EngineState {
  let s = state;
  for (let i = 0; i < n; i++)
    s = engine.applyEvent(s, { eventType: 'POINT', teamId }, ctx);
  return s;
}

describe('badminton engine (BWF Laws of Badminton)', () => {
  it('wins a game at 21 with a 2-point lead', () => {
    let state = badmintonEngine.initialState(ctx);
    state = pointsFor(badmintonEngine, state, 'A', 21);
    state = pointsFor(badmintonEngine, state, 'B', 19);
    // A: 21, B: 19 -> A already 2 clear at 21, game won
    expect((state.scoreDetails as any).gamesWon.teamA).toBe(1);
  });

  it('requires deuce beyond 20-20, but caps hard at 30 (30-29 wins outright)', () => {
    let state = badmintonEngine.initialState(ctx);
    // Alternate points so neither side ever gets a 2-point lead until the 30-point cap.
    for (let i = 0; i < 20; i++) {
      state = badmintonEngine.applyEvent(
        state,
        { eventType: 'POINT', teamId: 'A' },
        ctx,
      );
      state = badmintonEngine.applyEvent(
        state,
        { eventType: 'POINT', teamId: 'B' },
        ctx,
      );
    }
    // 20-20. One more each takes it to 21-21, ... up to 29-29.
    for (let i = 0; i < 9; i++) {
      state = badmintonEngine.applyEvent(
        state,
        { eventType: 'POINT', teamId: 'A' },
        ctx,
      );
      state = badmintonEngine.applyEvent(
        state,
        { eventType: 'POINT', teamId: 'B' },
        ctx,
      );
    }
    expect((state.scoreDetails as any).games[0].winnerTeamId).toBeNull(); // 29-29, no winner yet
    state = badmintonEngine.applyEvent(
      state,
      { eventType: 'POINT', teamId: 'A' },
      ctx,
    ); // 30-29 — hard cap, wins despite only a 1-point lead
    expect((state.scoreDetails as any).games[0].winnerTeamId).toBe('A');
  });

  it('wins the match after 2 games', () => {
    let state = badmintonEngine.initialState(ctx);
    state = pointsFor(badmintonEngine, state, 'A', 21);
    state = pointsFor(badmintonEngine, state, 'A', 21); // starts a fresh game 2, since gamesWon.A=1 < 2
    expect(state.winnerTeamId).toBe('A');
    expect(state.isComplete).toBe(true);
  });
});

describe('table tennis engine (ITTF Handbook)', () => {
  it('has no point cap — deuce continues indefinitely from 10-10', () => {
    let state = tableTennisEngine.initialState(ctx);
    state = pointsFor(tableTennisEngine, state, 'A', 10);
    state = pointsFor(tableTennisEngine, state, 'B', 10);
    state = tableTennisEngine.applyEvent(
      state,
      { eventType: 'POINT', teamId: 'A' },
      ctx,
    ); // 11-10, no 2pt lead
    expect((state.scoreDetails as any).games[0].winnerTeamId).toBeNull();
    state = tableTennisEngine.applyEvent(
      state,
      { eventType: 'POINT', teamId: 'A' },
      ctx,
    ); // 12-10, 2pt lead -> wins
    expect((state.scoreDetails as any).games[0].winnerTeamId).toBe('A');
  });
});

describe('volleyball engine (FIVB Rules of the Game)', () => {
  it('plays sets 1-4 to 25 but the deciding 5th set to only 15', () => {
    let state = volleyballEngine.initialState(ctx);
    // A wins sets 1-3 in straight sets (best of 5, gamesToWin=3) -- match ends before a 5th set is needed
    for (let g = 0; g < 3; g++)
      state = pointsFor(volleyballEngine, state, 'A', 25);
    expect(state.winnerTeamId).toBe('A');
    expect((state.scoreDetails as any).gamesWon.teamA).toBe(3);
  });

  it('uses 15 points for the deciding 5th set', () => {
    let state = volleyballEngine.initialState(ctx);
    // A wins sets 1,3 ; B wins sets 2,4 -> deciding 5th set
    state = pointsFor(volleyballEngine, state, 'A', 25);
    state = pointsFor(volleyballEngine, state, 'B', 25);
    state = pointsFor(volleyballEngine, state, 'A', 25);
    state = pointsFor(volleyballEngine, state, 'B', 25);
    expect((state.scoreDetails as any).games.length).toBe(5);
    state = pointsFor(volleyballEngine, state, 'A', 15); // deciding set target is 15, not 25
    expect(state.winnerTeamId).toBe('A');
  });
});

describe('squash engine (WSF Rules of Squash)', () => {
  it('plays point-a-rally to 11, win by 2, best of 5 games', () => {
    let state = squashEngine.initialState(ctx);
    for (let g = 0; g < 3; g++) state = pointsFor(squashEngine, state, 'A', 11);
    expect(state.winnerTeamId).toBe('A');
  });
});
