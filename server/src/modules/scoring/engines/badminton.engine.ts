import type {
  EngineContext,
  EngineEvent,
  EngineState,
  SportEngine,
} from './types.js';
import { applyPointEvent, initialSetsAndGamesState } from './setsAndGames.js';
import { BadRequestException } from '@nestjs/common';

interface BadmintonService {
  teamAPlayers: string[];
  teamBPlayers: string[];
  serverTeamId: string | null;
  serverParticipantId: string | null;
  receiverParticipantId: string | null;
}

/**
 * Badminton — BWF Laws of Badminton. Best-of-3 games; each game to 21 points
 * win-by-2, hard-capped at 30 (30-29 wins the game outright).
 */
export const badmintonEngine: SportEngine = {
  validEventTypes: ['SET_SERVICE', 'POINT'],

  initialState(context: EngineContext): EngineState {
    const state = initialSetsAndGamesState({
      pointsPerGame: Number(context.config.pointsPerGame) || 21,
      winBy2Cap: Number(context.config.winBy2Cap) || 30,
      bestOfGames: Number(context.config.bestOfGames) || 3,
    });
    state.scoreDetails.service = {
      teamAPlayers: [],
      teamBPlayers: [],
      serverTeamId: null,
      serverParticipantId: null,
      receiverParticipantId: null,
    } satisfies BadmintonService;
    return state;
  },

  applyEvent(
    state: EngineState,
    event: EngineEvent,
    context: EngineContext,
  ): EngineState {
    const type = event.eventType.toUpperCase();
    if (type === 'SET_SERVICE') {
      const serverTeamId = String(event.metadata?.serverTeamId || '');
      const serverParticipantId = String(
        event.metadata?.serverParticipantId || '',
      );
      const receiverParticipantId = String(
        event.metadata?.receiverParticipantId || '',
      );
      if (
        ![context.teamAId, context.teamBId].includes(serverTeamId) ||
        !serverParticipantId ||
        !receiverParticipantId
      )
        throw new BadRequestException(
          'Select the serving team, server, and receiver.',
        );
      const next = structuredClone(state);
      next.scoreDetails.service = {
        teamAPlayers: Array.isArray(event.metadata?.teamAPlayers)
          ? event.metadata.teamAPlayers
          : [],
        teamBPlayers: Array.isArray(event.metadata?.teamBPlayers)
          ? event.metadata.teamBPlayers
          : [],
        serverTeamId,
        serverParticipantId,
        receiverParticipantId,
      } satisfies BadmintonService;
      return next;
    }
    const next = applyPointEvent(state, event, context);
    const previous = state.scoreDetails.service as BadmintonService | undefined;
    if (previous) {
      const service = structuredClone(previous);
      // Rally scoring: the rally winner serves next. In doubles, retain the
      // selected player on consecutive points and rotate when service changes.
      if (event.teamId && event.teamId !== service.serverTeamId) {
        const players =
          event.teamId === context.teamAId
            ? service.teamAPlayers
            : service.teamBPlayers;
        const receivers =
          event.teamId === context.teamAId
            ? service.teamBPlayers
            : service.teamAPlayers;
        const currentIndex = players.indexOf(service.serverParticipantId || '');
        service.serverParticipantId =
          players[(currentIndex + 1 + players.length) % players.length] || null;
        service.receiverParticipantId = receivers[0] || null;
      }
      service.serverTeamId = event.teamId || service.serverTeamId;
      next.scoreDetails.service = service;
    }
    return next;
  },
};
