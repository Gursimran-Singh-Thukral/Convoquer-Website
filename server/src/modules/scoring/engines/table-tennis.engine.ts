import type {
  EngineContext,
  EngineEvent,
  EngineState,
  SportEngine,
} from './types.js';
import { applyPointEvent, initialSetsAndGamesState } from './setsAndGames.js';

/**
 * Table Tennis — ITTF Handbook. Best-of-5 (or 7) games; each game to 11
 * points win-by-2, no cap — deuce continues indefinitely at 10-10.
 */
export const tableTennisEngine: SportEngine = {
  validEventTypes: ['POINT'],

  initialState(context: EngineContext): EngineState {
    return initialSetsAndGamesState({
      pointsPerGame: Number(context.config.pointsPerGame) || 11,
      bestOfGames: Number(context.config.bestOfGames) || 5,
    });
  },

  applyEvent(
    state: EngineState,
    event: EngineEvent,
    context: EngineContext,
  ): EngineState {
    return applyPointEvent(state, event, context);
  },
};
