import { BadRequestException } from '@nestjs/common';
import type {
  EngineContext,
  EngineEvent,
  EngineState,
  SportEngine,
} from './types.js';

/**
 * Weightlifting — IWF Technical & Competition Rules. Two disciplines, Snatch
 * and Clean & Jerk, 3 attempts each; only the best *successful* lift per
 * discipline counts. Total = best Snatch + best Clean & Jerk. Ranked by Total
 * descending; ties are broken by bodyweight (the lighter lifter wins), which
 * must be recorded via SET_BODYWEIGHT before the tie can be resolved.
 */

type Discipline = 'SNATCH' | 'CLEAN_AND_JERK';

interface Attempt {
  weightKg: number;
  success: boolean;
}

interface SideState {
  snatch: Attempt[];
  cleanAndJerk: Attempt[];
  bodyWeightKg: number | null;
}

interface WeightliftingDetails {
  teamA: SideState;
  teamB: SideState;
}

function details(state: EngineState): WeightliftingDetails {
  return state.scoreDetails as unknown as WeightliftingDetails;
}

function bestSuccessful(attempts: Attempt[]): number {
  const successes = attempts.filter((a) => a.success).map((a) => a.weightKg);
  return successes.length ? Math.max(...successes) : 0;
}

function total(side: SideState): number {
  return bestSuccessful(side.snatch) + bestSuccessful(side.cleanAndJerk);
}

function emptySide(): SideState {
  return { snatch: [], cleanAndJerk: [], bodyWeightKg: null };
}

export const weightliftingEngine: SportEngine = {
  validEventTypes: ['ATTEMPT', 'SET_BODYWEIGHT'],

  initialState(): EngineState {
    const d: WeightliftingDetails = { teamA: emptySide(), teamB: emptySide() };
    return {
      teamAScore: 0,
      teamBScore: 0,
      scoreDetails: d as unknown as Record<string, unknown>,
      currentPeriod: 'Snatch',
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
    if (
      !event.teamId ||
      ![context.teamAId, context.teamBId].includes(event.teamId)
    )
      throw new BadRequestException('This event requires teamId.');
    const side = event.teamId === context.teamAId ? 'teamA' : 'teamB';
    const type = event.eventType.toUpperCase();

    if (type === 'SET_BODYWEIGHT') {
      const bodyWeightKg = Number(event.metadata?.bodyWeightKg ?? NaN);
      if (!Number.isFinite(bodyWeightKg) || bodyWeightKg <= 0)
        throw new BadRequestException(
          'bodyWeightKg must be a positive number.',
        );
      d[side].bodyWeightKg = bodyWeightKg;
    } else if (type === 'ATTEMPT') {
      const discipline = String(
        event.metadata?.discipline || '',
      ).toUpperCase() as Discipline;
      if (!['SNATCH', 'CLEAN_AND_JERK'].includes(discipline))
        throw new BadRequestException(
          'discipline must be SNATCH or CLEAN_AND_JERK.',
        );
      const weightKg = Number(event.metadata?.weightKg ?? NaN);
      if (!Number.isFinite(weightKg) || weightKg <= 0)
        throw new BadRequestException('weightKg must be a positive number.');
      const success = !!event.metadata?.success;
      const list =
        discipline === 'SNATCH' ? d[side].snatch : d[side].cleanAndJerk;
      if (list.length >= 3)
        throw new BadRequestException(
          `${discipline === 'SNATCH' ? 'Snatch' : 'Clean & Jerk'} already has 3 attempts recorded.`,
        );
      list.push({ weightKg, success });
    } else {
      throw new BadRequestException(
        `Unsupported weightlifting event type "${type}".`,
      );
    }

    const totalA = total(d.teamA);
    const totalB = total(d.teamB);
    const bothDone =
      d.teamA.snatch.length >= 3 &&
      d.teamA.cleanAndJerk.length >= 3 &&
      d.teamB.snatch.length >= 3 &&
      d.teamB.cleanAndJerk.length >= 3;

    let winnerTeamId: string | null = null;
    if (bothDone) {
      if (totalA !== totalB)
        winnerTeamId = totalA > totalB ? context.teamAId : context.teamBId;
      else if (
        d.teamA.bodyWeightKg &&
        d.teamB.bodyWeightKg &&
        d.teamA.bodyWeightKg !== d.teamB.bodyWeightKg
      ) {
        winnerTeamId =
          d.teamA.bodyWeightKg < d.teamB.bodyWeightKg
            ? context.teamAId
            : context.teamBId;
      }
    }

    const currentPeriod = bothDone
      ? 'Result Recorded'
      : d.teamA.snatch.length < 3 || d.teamB.snatch.length < 3
        ? 'Snatch'
        : 'Clean & Jerk';

    return {
      teamAScore: totalA,
      teamBScore: totalB,
      scoreDetails: d as unknown as Record<string, unknown>,
      currentPeriod,
      winnerTeamId,
      isComplete: bothDone,
    };
  },
};
