import { BadRequestException } from '@nestjs/common';
import type {
  EngineContext,
  EngineEvent,
  EngineState,
  SportEngine,
} from './types.js';

/**
 * Football — FIFA Laws of the Game. Two 45-minute halves (configurable),
 * optional extra time + penalty shootout for a knockout fixture that must
 * produce a winner. Goals are the only scoring event; cards are logged but
 * don't affect the score.
 */

interface FootballDetails {
  halfMinutes: number;
  extraTime: boolean;
  decider: boolean; // must produce a winner (knockout) rather than allow a draw
  periodIndex: number; // index into PERIODS (or PERIODS_WITH_ET)
  periods: string[];
  cards: {
    teamA: { yellow: number; red: number };
    teamB: { yellow: number; red: number };
  };
  shootout: { teamA: number; teamB: number } | null;
}

const BASE_PERIODS = ['1st Half', '2nd Half'];
const ET_PERIODS = ['Extra Time 1st Half', 'Extra Time 2nd Half'];

function details(state: EngineState): FootballDetails {
  return state.scoreDetails as unknown as FootballDetails;
}

function otherTeam(context: EngineContext, teamId: string): string {
  return teamId === context.teamAId ? context.teamBId : context.teamAId;
}

export const footballEngine: SportEngine = {
  validEventTypes: [
    'GOAL',
    'OWN_GOAL',
    'YELLOW_CARD',
    'RED_CARD',
    'PERIOD_END',
    'PENALTY_GOAL',
    'PENALTY_MISS',
  ],

  initialState(context: EngineContext): EngineState {
    const halfMinutes = Number(context.config.halfMinutes) || 45;
    const extraTime = !!context.config.extraTime;
    const decider = !!context.config.decider;
    const d: FootballDetails = {
      halfMinutes,
      extraTime,
      decider,
      periodIndex: 0,
      periods: BASE_PERIODS,
      cards: { teamA: { yellow: 0, red: 0 }, teamB: { yellow: 0, red: 0 } },
      shootout: null,
    };
    return {
      teamAScore: 0,
      teamBScore: 0,
      scoreDetails: d as unknown as Record<string, unknown>,
      currentPeriod: BASE_PERIODS[0],
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
      case 'GOAL': {
        if (!event.teamId)
          throw new BadRequestException('GOAL requires teamId.');
        if (event.teamId === context.teamAId) teamAScore += 1;
        else teamBScore += 1;
        break;
      }
      case 'OWN_GOAL': {
        if (!event.teamId)
          throw new BadRequestException(
            'OWN_GOAL requires the team that conceded it.',
          );
        const scoringTeam = otherTeam(context, event.teamId);
        if (scoringTeam === context.teamAId) teamAScore += 1;
        else teamBScore += 1;
        break;
      }
      case 'YELLOW_CARD':
        if (!event.teamId)
          throw new BadRequestException('YELLOW_CARD requires teamId.');
        d.cards[teamKey(event.teamId)].yellow += 1;
        break;
      case 'RED_CARD':
        if (!event.teamId)
          throw new BadRequestException('RED_CARD requires teamId.');
        d.cards[teamKey(event.teamId)].red += 1;
        break;
      case 'PERIOD_END': {
        const allPeriods = d.extraTime
          ? [...BASE_PERIODS, ...ET_PERIODS]
          : BASE_PERIODS;
        if (d.periodIndex >= allPeriods.length - 1) {
          // Regulation (and extra time, if enabled) exhausted.
          if (d.decider && teamAScore === teamBScore)
            d.shootout = d.shootout ?? { teamA: 0, teamB: 0 };
          d.periodIndex = allPeriods.length; // sentinel: match finished
        } else {
          d.periodIndex += 1;
          d.periods = allPeriods;
        }
        break;
      }
      case 'PENALTY_GOAL':
      case 'PENALTY_MISS': {
        if (!d.shootout)
          throw new BadRequestException('No penalty shootout is in progress.');
        if (type === 'PENALTY_GOAL') {
          if (!event.teamId)
            throw new BadRequestException('PENALTY_GOAL requires teamId.');
          d.shootout[teamKey(event.teamId)] += 1;
        }
        break;
      }
      default:
        throw new BadRequestException(
          `Unsupported football event type "${type}".`,
        );
    }

    const allPeriods = d.extraTime
      ? [...BASE_PERIODS, ...ET_PERIODS]
      : BASE_PERIODS;
    const matchFinished = d.periodIndex >= allPeriods.length;
    const currentPeriod = d.shootout
      ? 'Penalty Shootout'
      : matchFinished
        ? 'Full Time'
        : allPeriods[d.periodIndex];

    let winnerTeamId: string | null = null;
    let isComplete = false;
    if (matchFinished) {
      if (d.shootout) {
        if (d.shootout.teamA !== d.shootout.teamB) {
          winnerTeamId =
            d.shootout.teamA > d.shootout.teamB
              ? context.teamAId
              : context.teamBId;
          isComplete = true;
        }
      } else {
        isComplete = true;
        if (teamAScore !== teamBScore)
          winnerTeamId =
            teamAScore > teamBScore ? context.teamAId : context.teamBId;
      }
    }

    return {
      teamAScore,
      teamBScore,
      scoreDetails: d as unknown as Record<string, unknown>,
      currentPeriod,
      winnerTeamId,
      isComplete,
    };
  },
};
