import type {
  EngineContext,
  EngineEvent,
  EngineState,
  SportEngine,
} from './types.js';
import { applyPointEvent, initialSetsAndGamesState } from './setsAndGames.js';

/**
 * Volleyball — FIVB Rules of the Game. Best-of-5 sets; sets 1-4 are played to
 * 25 points win-by-2, the deciding 5th set to 15 points win-by-2. No point cap.
 */
export const volleyballEngine: SportEngine = {
  validEventTypes: ['POINT'],

  initialState(context: EngineContext): EngineState {
    return initialSetsAndGamesState({
      pointsPerGame: Number(context.config.pointsPerSet) || 25,
      bestOfGames: Number(context.config.bestOfSets) || 5,
      decidingGamePoints: Number(context.config.decidingSetPoints) || 15,
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
