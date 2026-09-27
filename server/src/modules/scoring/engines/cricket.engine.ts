import { BadRequestException } from '@nestjs/common';
import type {
  EngineContext,
  EngineEvent,
  EngineState,
  SportEngine,
} from './types.js';

type Dismissal =
  | 'BOWLED'
  | 'CAUGHT'
  | 'LBW'
  | 'RUN_OUT'
  | 'STUMPED'
  | 'HIT_WICKET'
  | 'RETIRED_OUT';
interface BatterStats {
  participantId: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  dismissal?: Dismissal;
}
interface BowlerStats {
  participantId: string;
  balls: number;
  runs: number;
  wickets: number;
  wides: number;
  noBalls: number;
}
interface Delivery {
  ball: string;
  type: string;
  runs: number;
  batterId?: string;
  bowlerId?: string;
  wicket?: boolean;
}
interface InningsState {
  battingTeamId: string;
  runs: number;
  wickets: number;
  balls: number;
  extras: { wide: number; noBall: number; bye: number; legBye: number };
  completed: boolean;
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  freeHit: boolean;
  batters: Record<string, BatterStats>;
  bowlers: Record<string, BowlerStats>;
  deliveries: Delivery[];
}
interface CricketDetails {
  oversPerInnings: number;
  inningsNumber: 0 | 1 | 2;
  innings: InningsState[];
  target: number | null;
  toss: {
    winnerTeamId: string;
    decision: 'BAT' | 'BOWL';
    battingTeamId: string;
  } | null;
}
const DEFAULT_OVERS = 20;
const detail = (s: EngineState) => s.scoreDetails as unknown as CricketDetails;
const overs = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;
const current = (d: CricketDetails) =>
  d.inningsNumber ? d.innings[d.inningsNumber - 1] : null;
const id = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
const swapStrike = (i: InningsState) => {
  [i.strikerId, i.nonStrikerId] = [i.nonStrikerId, i.strikerId];
};
const batter = (i: InningsState, participantId: string) =>
  (i.batters[participantId] ||= {
    participantId,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    out: false,
  });
const bowler = (i: InningsState, participantId: string) =>
  (i.bowlers[participantId] ||= {
    participantId,
    balls: 0,
    runs: 0,
    wickets: 0,
    wides: 0,
    noBalls: 0,
  });

export const cricketEngine: SportEngine = {
  validEventTypes: [
    'TOSS',
    'START_INNINGS',
    'SET_BATTERS',
    'SET_BOWLER',
    'RUN',
    'WIDE',
    'NO_BALL',
    'BYE',
    'LEG_BYE',
    'WICKET',
    'END_INNINGS',
  ],
  initialState(context) {
    const d: CricketDetails = {
      oversPerInnings: Number(context.config.oversPerInnings) || DEFAULT_OVERS,
      inningsNumber: 0,
      innings: [],
      target: null,
      toss: null,
    };
    return finish(d, context, 'Yet to start');
  },
  applyEvent(state, event, context) {
    const d = structuredClone(detail(state));
    d.toss ??= null;
    const type = event.eventType.toUpperCase();
    if (type === 'TOSS') {
      if (d.inningsNumber > 0)
        throw new BadRequestException(
          'The toss cannot be changed after an innings starts.',
        );
      const winnerTeamId = id(event.metadata?.winnerTeamId) || event.teamId;
      const decision = String(event.metadata?.decision || '').toUpperCase();
      if (
        !winnerTeamId ||
        ![context.teamAId, context.teamBId].includes(winnerTeamId) ||
        !['BAT', 'BOWL'].includes(decision)
      )
        throw new BadRequestException(
          'Select the toss winner and whether they chose to bat or bowl.',
        );
      const otherTeamId =
        winnerTeamId === context.teamAId ? context.teamBId : context.teamAId;
      d.toss = {
        winnerTeamId,
        decision: decision as 'BAT' | 'BOWL',
        battingTeamId: decision === 'BAT' ? winnerTeamId : otherTeamId,
      };
      return finish(d, context, 'Toss complete');
    }
    if (type === 'START_INNINGS') {
      if (d.inningsNumber >= 2)
        throw new BadRequestException('This match already has both innings.');
      const battingTeamId = id(event.metadata?.battingTeamId) || event.teamId;
      if (
        !battingTeamId ||
        ![context.teamAId, context.teamBId].includes(battingTeamId)
      )
        throw new BadRequestException(
          'START_INNINGS requires a valid battingTeamId.',
        );
      if (
        d.inningsNumber === 0 &&
        d.toss &&
        d.toss.battingTeamId !== battingTeamId
      )
        throw new BadRequestException(
          'The first batting team must match the recorded toss decision.',
        );
      if (d.inningsNumber === 1 && d.innings[0].battingTeamId === battingTeamId)
        throw new BadRequestException(
          'The second innings must be batted by the other team.',
        );
      d.inningsNumber = (d.inningsNumber + 1) as 1 | 2;
      d.innings.push({
        battingTeamId,
        runs: 0,
        wickets: 0,
        balls: 0,
        extras: { wide: 0, noBall: 0, bye: 0, legBye: 0 },
        completed: false,
        strikerId: id(event.metadata?.strikerId),
        nonStrikerId: id(event.metadata?.nonStrikerId),
        bowlerId: id(event.metadata?.bowlerId),
        freeHit: false,
        batters: {},
        bowlers: {},
        deliveries: [],
      });
      if (d.inningsNumber === 2) d.target = d.innings[0].runs + 1;
      return finish(d, context, `Innings ${d.inningsNumber} · 0.0 ov`);
    }
    const inn = current(d);
    if (!inn)
      throw new BadRequestException(
        'Start an innings before recording deliveries.',
      );
    if (inn.completed)
      throw new BadRequestException('This innings has already ended.');
    // Matches created before player scorecards were introduced still replay
    // correctly and are upgraded on the next event.
    inn.strikerId ??= null;
    inn.nonStrikerId ??= null;
    inn.bowlerId ??= null;
    inn.freeHit ??= false;
    inn.batters ??= {};
    inn.bowlers ??= {};
    inn.deliveries ??= [];
    if (type === 'SET_BATTERS') {
      const strikerId = id(event.metadata?.strikerId),
        nonStrikerId = id(event.metadata?.nonStrikerId);
      if (!strikerId || !nonStrikerId || strikerId === nonStrikerId)
        throw new BadRequestException('Select two different batters.');
      inn.strikerId = strikerId;
      inn.nonStrikerId = nonStrikerId;
      return finish(
        d,
        context,
        `Innings ${d.inningsNumber} · ${overs(inn.balls)} ov`,
      );
    }
    if (type === 'SET_BOWLER') {
      const bowlerId = id(event.metadata?.bowlerId);
      if (!bowlerId) throw new BadRequestException('Select a bowler.');
      inn.bowlerId = bowlerId;
      return finish(
        d,
        context,
        `Innings ${d.inningsNumber} · ${overs(inn.balls)} ov`,
      );
    }
    if (type === 'END_INNINGS') {
      inn.completed = true;
      return finish(
        d,
        context,
        `Innings ${d.inningsNumber} complete (${overs(inn.balls)} ov)`,
      );
    }
    const runs = Number(event.metadata?.runs ?? 0);
    if (!Number.isInteger(runs) || runs < 0 || runs > 6)
      throw new BadRequestException('runs must be an integer between 0 and 6.');
    const strikerId =
      id(event.participantId) || id(event.metadata?.strikerId) || inn.strikerId;
    const bowlerId = id(event.metadata?.bowlerId) || inn.bowlerId;
    const legal = !['WIDE', 'NO_BALL'].includes(type);
    const beforeBall = inn.balls;
    let total = runs,
      batterRuns = 0,
      bowlerRuns = 0,
      wicket = false;
    if (type === 'WIDE') {
      total = 1 + runs;
      inn.extras.wide += total;
      bowlerRuns = total;
    } else if (type === 'NO_BALL') {
      total = 1 + runs;
      inn.extras.noBall += 1;
      batterRuns = runs;
      bowlerRuns = total;
    } else if (type === 'BYE') {
      total = runs || 1;
      inn.extras.bye += total;
    } else if (type === 'LEG_BYE') {
      total = runs || 1;
      inn.extras.legBye += total;
    } else if (type === 'RUN') {
      batterRuns = runs;
      bowlerRuns = runs;
    } else if (type === 'WICKET') {
      if (inn.wickets >= 10)
        throw new BadRequestException('This team is already all out.');
      const dismissal = String(
        event.metadata?.dismissalType || 'BOWLED',
      ).toUpperCase() as Dismissal;
      if (inn.freeHit && dismissal !== 'RUN_OUT')
        throw new BadRequestException(
          'Only a run-out may be recorded on a free hit.',
        );
      total = runs;
      bowlerRuns = runs;
      wicket = true;
      inn.wickets += 1;
      const dismissedId = id(event.metadata?.dismissedPlayerId) || strikerId;
      if (dismissedId) {
        const bs = batter(inn, dismissedId);
        bs.out = true;
        bs.dismissal = dismissal;
      }
    } else
      throw new BadRequestException(
        `Unsupported cricket event type "${type}".`,
      );
    inn.runs += total;
    if (legal) inn.balls += 1;
    if (strikerId) {
      const bs = batter(inn, strikerId);
      if (legal) bs.balls += 1;
      bs.runs += batterRuns;
      if (batterRuns === 4) bs.fours += 1;
      if (batterRuns === 6) bs.sixes += 1;
    }
    if (bowlerId) {
      const bw = bowler(inn, bowlerId);
      if (legal) bw.balls += 1;
      bw.runs += bowlerRuns;
      if (type === 'WIDE') bw.wides += total;
      if (type === 'NO_BALL') bw.noBalls += 1;
      if (
        wicket &&
        String(event.metadata?.dismissalType || 'BOWLED').toUpperCase() !==
          'RUN_OUT'
      )
        bw.wickets += 1;
    }
    inn.deliveries.push({
      ball: `${Math.floor(beforeBall / 6)}.${(beforeBall % 6) + (legal ? 1 : 0)}`,
      type,
      runs: total,
      ...(strikerId ? { batterId: strikerId } : {}),
      ...(bowlerId ? { bowlerId } : {}),
      ...(wicket ? { wicket: true } : {}),
    });
    const rotationRuns =
      type === 'WIDE' ? runs : type === 'NO_BALL' ? runs : total;
    if (rotationRuns % 2 === 1) swapStrike(inn);
    if (legal && inn.balls % 6 === 0) {
      swapStrike(inn);
      inn.bowlerId = null;
    }
    inn.freeHit = type === 'NO_BALL';
    if (type === 'WICKET') inn.strikerId = id(event.metadata?.nextBatterId);
    if (
      inn.balls >= d.oversPerInnings * 6 ||
      inn.wickets >= 10 ||
      (d.inningsNumber === 2 && d.target !== null && inn.runs >= d.target)
    )
      inn.completed = true;
    return finish(
      d,
      context,
      inn.completed
        ? `Innings ${d.inningsNumber} complete (${overs(inn.balls)} ov)`
        : `Innings ${d.inningsNumber} · ${overs(inn.balls)} ov`,
    );
  },
};
function scoreForTeam(d: CricketDetails, teamId: string) {
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
function determineWinner(d: CricketDetails) {
  const [a, b] = d.innings;
  if (!a || !b || !b.completed || a.runs === b.runs) return null;
  return b.runs > a.runs ? b.battingTeamId : a.battingTeamId;
}
