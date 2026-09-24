import type {
  EngineContext,
  EngineEvent,
  EngineState,
  SportEngine,
} from './types.js';
import { applyPointEvent, initialSetsAndGamesState } from './setsAndGames.js';

/**
 * Squash — WSF Rules of Squash. Best-of-5 games; point-a-rally scoring (PAR)
 * to 11 points, win-by-2, no cap.
 */
export const squashEngine: SportEngine = {
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
