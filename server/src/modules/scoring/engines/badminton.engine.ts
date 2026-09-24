import type {
  EngineContext,
  EngineEvent,
  EngineState,
  SportEngine,
} from './types.js';
import { applyPointEvent, initialSetsAndGamesState } from './setsAndGames.js';

/**
 * Badminton — BWF Laws of Badminton. Best-of-3 games; each game to 21 points
 * win-by-2, hard-capped at 30 (30-29 wins the game outright).
 */
export const badmintonEngine: SportEngine = {
  validEventTypes: ['POINT'],

  initialState(context: EngineContext): EngineState {
    return initialSetsAndGamesState({
      pointsPerGame: Number(context.config.pointsPerGame) || 21,
      winBy2Cap: Number(context.config.winBy2Cap) || 30,
      bestOfGames: Number(context.config.bestOfGames) || 3,
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
