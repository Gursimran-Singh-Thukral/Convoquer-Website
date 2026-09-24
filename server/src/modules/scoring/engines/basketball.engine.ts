import { BadRequestException } from '@nestjs/common';
import type {
  EngineContext,
  EngineEvent,
  EngineState,
  SportEngine,
} from './types.js';

/**
 * Basketball — FIBA Official Basketball Rules. Four 10-minute quarters
 * (configurable), 5-minute overtime periods if tied at the end of regulation.
 * Team fouls reset each period; the 5th team foul in a period puts the other
 * team "in the bonus" (free throws on the next foul) — tracked for display,
 * not auto-generated as free-throw events.
 */

interface BasketballDetails {
  quarterMinutes: number;
  overtimeMinutes: number;
  periodIndex: number; // 0-3 = Q1-Q4, 4+ = OT1, OT2, ...
  teamFoulsThisPeriod: { teamA: number; teamB: number };
  playerFouls: Record<string, number>; // participantId -> foul count (fouled out at 5)
}

function details(state: EngineState): BasketballDetails {
  return state.scoreDetails as unknown as BasketballDetails;
}

function periodLabel(d: BasketballDetails): string {
  return d.periodIndex < 4 ? `Q${d.periodIndex + 1}` : `OT${d.periodIndex - 3}`;
}

export const basketballEngine: SportEngine = {
  validEventTypes: [
    'FREE_THROW',
    'TWO_POINTS',
    'THREE_POINTS',
    'FOUL',
    'PERIOD_END',
  ],

  initialState(context: EngineContext): EngineState {
    const d: BasketballDetails = {
      quarterMinutes: Number(context.config.quarterMinutes) || 10,
      overtimeMinutes: Number(context.config.overtimeMinutes) || 5,
      periodIndex: 0,
      teamFoulsThisPeriod: { teamA: 0, teamB: 0 },
      playerFouls: {},
    };
    return {
      teamAScore: 0,
      teamBScore: 0,
      scoreDetails: d as unknown as Record<string, unknown>,
      currentPeriod: 'Q1',
      winnerTeamId: null,
      isComplete: false,
    };
  },

  applyEvent(
    state: EngineState,
    event: EngineEvent,
    context: EngineContext,
  ): EngineState {
    const d = structuredClone(details(state));
    const type = event.eventType.toUpperCase();
    let teamAScore = state.teamAScore;
    let teamBScore = state.teamBScore;
    const teamKey = (teamId: string) =>
      (teamId === context.teamAId ? 'teamA' : 'teamB') as 'teamA' | 'teamB';

    switch (type) {
      case 'FREE_THROW':
      case 'TWO_POINTS':
      case 'THREE_POINTS': {
        if (!event.teamId)
          throw new BadRequestException(`${type} requires teamId.`);
        const points =
          type === 'FREE_THROW' ? 1 : type === 'TWO_POINTS' ? 2 : 3;
        if (event.teamId === context.teamAId) teamAScore += points;
        else teamBScore += points;
        break;
      }
      case 'FOUL': {
        if (!event.teamId)
          throw new BadRequestException('FOUL requires teamId.');
        d.teamFoulsThisPeriod[teamKey(event.teamId)] += 1;
        if (event.participantId) {
          d.playerFouls[event.participantId] =
            (d.playerFouls[event.participantId] || 0) + 1;
          if (d.playerFouls[event.participantId] > 5)
            throw new BadRequestException(
              'This player has already fouled out (5 fouls).',
            );
        }
        break;
      }
      case 'PERIOD_END':
        d.periodIndex += 1;
        d.teamFoulsThisPeriod = { teamA: 0, teamB: 0 };
        break;
      default:
        throw new BadRequestException(
          `Unsupported basketball event type "${type}".`,
        );
    }

    const regulationOver = d.periodIndex >= 4;
    const tied = teamAScore === teamBScore;
    const matchFinished = regulationOver && !tied;
    const currentPeriod = matchFinished ? 'Final' : periodLabel(d);
    const winnerTeamId = matchFinished
      ? teamAScore > teamBScore
        ? context.teamAId
        : context.teamBId
      : null;

    return {
      teamAScore,
      teamBScore,
      scoreDetails: d as unknown as Record<string, unknown>,
      currentPeriod,
      winnerTeamId,
      isComplete: matchFinished,
    };
  },
};
