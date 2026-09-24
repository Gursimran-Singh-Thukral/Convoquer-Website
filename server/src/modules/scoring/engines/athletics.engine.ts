import { BadRequestException } from '@nestjs/common';
import type {
  EngineContext,
  EngineEvent,
  EngineState,
  SportEngine,
} from './types.js';

/**
 * Athletics — World Athletics Technical Rules. Athletics events are naturally
 * multi-entrant and ranked, not a running head-to-head score — this engine
 * fits that into the fixture engine's 2-side Match record by comparing each
 * side's *best* recorded performance across up to World Athletics' typical
 * attempt allowance: track events rank ascending by time (fastest wins),
 * field events rank descending by distance/height (best single attempt wins).
 */

type EventKind = 'TRACK' | 'FIELD';

interface Attempt {
  value: number;
  /** Track events only — a foul/no-jump/no-throw in a field event is simply omitted rather than recorded with a value. */
  disqualified?: boolean;
}

interface AthleticsDetails {
  eventKind: EventKind;
  unit: string; // e.g. 'seconds', 'meters'
  attempts: { teamA: Attempt[]; teamB: Attempt[] };
}

function details(state: EngineState): AthleticsDetails {
  return state.scoreDetails as unknown as AthleticsDetails;
}

function bestValue(attempts: Attempt[], kind: EventKind): number | null {
  const valid = attempts.filter((a) => !a.disqualified).map((a) => a.value);
  if (!valid.length) return null;
  return kind === 'TRACK' ? Math.min(...valid) : Math.max(...valid);
}

export const athleticsEngine: SportEngine = {
  validEventTypes: ['RECORD_ATTEMPT'],

  initialState(context: EngineContext): EngineState {
    const eventKind = String(
      context.config.eventKind || 'TRACK',
    ).toUpperCase() as EventKind;
    const unit = String(
      context.config.unit || (eventKind === 'TRACK' ? 'seconds' : 'meters'),
    );
    const d: AthleticsDetails = {
      eventKind,
      unit,
      attempts: { teamA: [], teamB: [] },
    };
    return {
      teamAScore: 0,
      teamBScore: 0,
      scoreDetails: d as unknown as Record<string, unknown>,
      currentPeriod: 'Awaiting attempts',
      winnerTeamId: null,
      isComplete: false,
    };
  },

  applyEvent(
    state: EngineState,
    event: EngineEvent,
    context: EngineContext,
  ): EngineState {
    if (event.eventType.toUpperCase() !== 'RECORD_ATTEMPT')
      throw new BadRequestException(
        `Unsupported athletics event type "${event.eventType}".`,
      );
    const d = structuredClone(details(state));
    if (
      !event.teamId ||
      ![context.teamAId, context.teamBId].includes(event.teamId)
    )
      throw new BadRequestException('RECORD_ATTEMPT requires teamId.');

    const side = event.teamId === context.teamAId ? 'teamA' : 'teamB';
    const disqualified = !!event.metadata?.disqualified;
    const value = Number(event.metadata?.value ?? NaN);
    if (!disqualified && (!Number.isFinite(value) || value < 0))
      throw new BadRequestException(
        'value must be a non-negative number (or set disqualified: true).',
      );
    d.attempts[side].push({ value: disqualified ? 0 : value, disqualified });

    const bestA = bestValue(d.attempts.teamA, d.eventKind);
    const bestB = bestValue(d.attempts.teamB, d.eventKind);
    const isComplete = bestA !== null && bestB !== null;
    let winnerTeamId: string | null = null;
    if (isComplete && bestA !== bestB) {
      winnerTeamId =
        d.eventKind === 'TRACK'
          ? bestA! < bestB!
            ? context.teamAId
            : context.teamBId
          : bestA! > bestB!
            ? context.teamAId
            : context.teamBId;
    }
    const currentPeriod = isComplete ? 'Result Recorded' : 'Awaiting attempts';

    // teamAScore/teamBScore mirror each side's best recorded value (scaled to
    // an integer for display consistency) — the real result lives in scoreDetails.
    return {
      teamAScore: bestA !== null ? Math.round(bestA * 100) : 0,
      teamBScore: bestB !== null ? Math.round(bestB * 100) : 0,
      scoreDetails: d as unknown as Record<string, unknown>,
      currentPeriod,
      winnerTeamId,
      isComplete,
    };
  },
};
