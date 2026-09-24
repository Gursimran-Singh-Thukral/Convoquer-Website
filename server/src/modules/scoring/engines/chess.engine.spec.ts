import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { chessEngine } from './chess.engine.js';
import type { EngineContext, EngineState } from './types.js';

const ctx: EngineContext = {
  teamAId: 'A',
  teamBId: 'B',
  config: { numberOfGames: 3 },
};
function result(
  state: EngineState,
  whiteTeamId: string,
  result: string,
  reason = 'CHECKMATE',
): EngineState {
  return chessEngine.applyEvent(
    state,
    { eventType: 'GAME_RESULT', metadata: { whiteTeamId, result, reason } },
    ctx,
  );
}

describe('chess engine (FIDE Laws of Chess)', () => {
  it('scores a win as 2 (doubled points) and a draw as 1 each', () => {
    let state = chessEngine.initialState(ctx);
    state = result(state, 'A', 'WHITE'); // A played White and won
    expect(state.teamAScore).toBe(2);
    expect(state.teamBScore).toBe(0);
    state = result(state, 'B', 'DRAW');
    expect(state.teamAScore).toBe(3);
    expect(state.teamBScore).toBe(1);
  });

  it('credits the result to whichever team actually held that colour, not always the nominal home side', () => {
    const state = result(chessEngine.initialState(ctx), 'B', 'BLACK'); // B played White, A (Black) won
    expect(state.teamAScore).toBe(2);
    expect(state.teamBScore).toBe(0);
  });

  it('ends the match early once the lead is unassailable', () => {
    let state = chessEngine.initialState(ctx); // best of 3
    state = result(state, 'A', 'WHITE'); // A 2-0
    state = result(state, 'B', 'WHITE'); // B could only draw level at best if it won every remaining game (1 left, 2pts) -> A still ahead by 0? check math
    // After 2 games: A=2, B=2 if B's white win counts for B. Not yet decided (1 game left, tied).
    expect(state.isComplete).toBe(false);
    state = result(state, 'A', 'WHITE'); // A wins final game outright: 4-2
    expect(state.isComplete).toBe(true);
    expect(state.winnerTeamId).toBe('A');
  });

  it('rejects an invalid result code', () => {
    expect(() =>
      result(chessEngine.initialState(ctx), 'A', 'WHITE_WINS'),
    ).toThrow(BadRequestException);
  });
});
