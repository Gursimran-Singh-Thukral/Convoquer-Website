import { BadRequestException } from '@nestjs/common';
import type {
  EngineContext,
  EngineEvent,
  EngineState,
  SportEngine,
} from './types.js';

/**
 * Cricket — ICC Playing Conditions / MCC Laws of Cricket, scoped to a single
 * limited-overs match (1 innings per side, e.g. T20/ODI-style), which is what
 * an inter-college fest actually runs. Test-style multi-innings cricket is out
 * of scope.
 */

interface InningsState {
  battingTeamId: string;
  runs: number;
  wickets: number;
  balls: number; // legal (non-wide, non-no-ball) deliveries bowled this innings
  extras: { wide: number; noBall: number; bye: number; legBye: number };
  completed: boolean;
}

interface CricketDetails {
  oversPerInnings: number;
  inningsNumber: 0 | 1 | 2;
  innings: InningsState[]; // index 0 = 1st innings, index 1 = 2nd innings
  target: number | null;
}

const DEFAULT_OVERS = 20;

function details(state: EngineState): CricketDetails {
  return state.scoreDetails as unknown as CricketDetails;
}

function oversDisplay(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function currentInnings(d: CricketDetails): InningsState | null {
  return d.inningsNumber === 0 ? null : d.innings[d.inningsNumber - 1];
}

export const cricketEngine: SportEngine = {
  validEventTypes: [
    'START_INNINGS',
    'RUN',
    'WIDE',
    'NO_BALL',
    'BYE',
    'LEG_BYE',
    'WICKET',
    'END_INNINGS',
  ],

  initialState(context: EngineContext): EngineState {
    const oversPerInnings =
      Number(context.config.oversPerInnings) || DEFAULT_OVERS;
    const d: CricketDetails = {
      oversPerInnings,
      inningsNumber: 0,
      innings: [],
      target: null,
    };
    return {
      teamAScore: 0,
      teamBScore: 0,
      scoreDetails: d as unknown as Record<string, unknown>,
      currentPeriod: 'Yet to start',
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

    if (type === 'START_INNINGS') {
      if (d.inningsNumber >= 2)
        throw new BadRequestException('This match already has both innings.');
      const battingTeamId =
        (event.metadata?.battingTeamId as string) || event.teamId || undefined;
      if (
        !battingTeamId ||
        ![context.teamAId, context.teamBId].includes(battingTeamId)
      ) {
        throw new BadRequestException(
          'START_INNINGS requires a valid battingTeamId.',
        );
      }
      if (
        d.inningsNumber === 1 &&
        d.innings[0].battingTeamId === battingTeamId
      ) {
        throw new BadRequestException(
          'The second innings must be batted by the other team.',
        );
      }
      d.inningsNumber = (d.inningsNumber + 1) as 1 | 2;
      d.innings.push({
        battingTeamId,
        runs: 0,
        wickets: 0,
        balls: 0,
        extras: { wide: 0, noBall: 0, bye: 0, legBye: 0 },
        completed: false,
      });
      if (d.inningsNumber === 2) d.target = d.innings[0].runs + 1;
      return finish(d, context, `Innings ${d.inningsNumber} · 0.0 ov`);
    }

    const innings = currentInnings(d);
    if (!innings)
      throw new BadRequestException(
        'Start an innings (START_INNINGS) before recording deliveries.',
      );
    if (innings.completed)
      throw new BadRequestException(
        'This innings has already ended — start the next one.',
      );

    const runs = Number(event.metadata?.runs ?? 0);
    if (!Number.isInteger(runs) || runs < 0 || runs > 6)
      throw new BadRequestException('runs must be an integer between 0 and 6.');

    switch (type) {
      case 'RUN':
        innings.runs += runs;
        innings.balls += 1;
        break;
      case 'WIDE':
        innings.runs += 1 + runs; // 1 mandatory wide run + any additional runs run
        innings.extras.wide += 1 + runs;
        // A wide is not a legal delivery — does not advance the over.
        break;
      case 'NO_BALL':
        innings.runs += 1 + runs;
        innings.extras.noBall += 1 + runs;
        // Not a legal delivery either.
        break;
      case 'BYE':
        innings.runs += runs || 1;
        innings.extras.bye += runs || 1;
        innings.balls += 1;
        break;
      case 'LEG_BYE':
        innings.runs += runs || 1;
        innings.extras.legBye += runs || 1;
        innings.balls += 1;
        break;
      case 'WICKET':
        if (innings.wickets >= 10)
          throw new BadRequestException('This team is already all out.');
        innings.wickets += 1;
        innings.runs += runs; // runs completed before the dismissal (e.g. a run-out)
        innings.balls += 1;
        break;
      case 'END_INNINGS':
        break; // handled by the completion check below regardless
      default:
        throw new BadRequestException(
          `Unsupported cricket event type "${type}".`,
        );
    }

    const oversComplete = innings.balls >= d.oversPerInnings * 6;
    const allOut = innings.wickets >= 10;
    if (type === 'END_INNINGS' || oversComplete || allOut)
      innings.completed = true;

    // Second innings ends early once the target is chased down.
    if (d.inningsNumber === 2 && d.target !== null && innings.runs >= d.target)
      innings.completed = true;

    const period = innings.completed
      ? `Innings ${d.inningsNumber} complete (${oversDisplay(innings.balls)} ov)`
      : `Innings ${d.inningsNumber} · ${oversDisplay(innings.balls)} ov`;
    return finish(d, context, period);
  },
};

function scoreForTeam(d: CricketDetails, teamId: string): number {
  return d.innings.find((i) => i.battingTeamId === teamId)?.runs ?? 0;
}

function finish(
  d: CricketDetails,
  context: EngineContext,
  currentPeriod: string,
): EngineState {
  const second = d.innings[1];
  return {
    teamAScore: scoreForTeam(d, context.teamAId),
    teamBScore: scoreForTeam(d, context.teamBId),
    scoreDetails: d as unknown as Record<string, unknown>,
    currentPeriod,
    winnerTeamId: determineWinner(d),
    isComplete: !!second?.completed,
  };
}

function determineWinner(d: CricketDetails): string | null {
  const [first, second] = d.innings;
  if (!first || !second || !second.completed) return null;
  if (second.runs === first.runs) return null; // tie
  if (second.runs > first.runs) return second.battingTeamId; // chased down: wins by wickets in hand
  return first.battingTeamId; // defended: wins by runs
}
