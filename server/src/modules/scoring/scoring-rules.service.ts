import { Injectable, BadRequestException } from '@nestjs/common';
import {
  sportEngine,
  type EngineContext,
  type EngineEvent,
  type EngineState,
} from './engines/index.js';

export type { EngineState } from './engines/index.js';

/**
 * Resolves the per-tournament format override for a sport from
 * `Tournament.rulesJson`, e.g. `{ cricket: { oversPerInnings: 10 } }`. Falls
 * back to that sport's official default (each engine already defaults its own
 * numbers when a field is missing) when nothing is configured.
 */
function resolveConfig(
  sportName: string | undefined | null,
  rulesJson: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!rulesJson) return {};
  const key = (sportName || '').trim().toLowerCase();
  const value = (rulesJson as Record<string, unknown>)[key];
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

@Injectable()
export class ScoringRulesService {
  /** Every sport's initial scoreboard state, per its own engine. */
  initialState(params: {
    sportName?: string | null;
    teamAId: string;
    teamBId: string;
    rulesJson?: Record<string, unknown> | null;
  }): EngineState {
    const engine = sportEngine(params.sportName);
    const context: EngineContext = {
      teamAId: params.teamAId,
      teamBId: params.teamBId,
      config: resolveConfig(params.sportName, params.rulesJson),
    };
    return engine.initialState(context);
  }

  /**
   * Applies a single score event to the current state via that sport's
   * engine. If no prior state exists yet (first event of the match), starts
   * from the engine's own `initialState` rather than a blind zero-state, so
   * the sport-specific `scoreDetails` shape is always well-formed.
   */
  applyEvent(params: {
    sportName?: string | null;
    teamAId: string;
    teamBId: string;
    rulesJson?: Record<string, unknown> | null;
    currentState: EngineState | null;
    event: EngineEvent;
  }): EngineState {
    const engine = sportEngine(params.sportName);
    const context: EngineContext = {
      teamAId: params.teamAId,
      teamBId: params.teamBId,
      config: resolveConfig(params.sportName, params.rulesJson),
    };
    const type = (params.event.eventType || '').trim().toUpperCase();
    if (!type) throw new BadRequestException('A score event type is required');
    if (!engine.validEventTypes.includes(type))
      throw new BadRequestException(
        `Unknown score event type "${type}" for this sport`,
      );
    const state = params.currentState ?? engine.initialState(context);
    return engine.applyEvent(
      state,
      { ...params.event, eventType: type },
      context,
    );
  }

  /**
   * Replays a match's full non-reversed ScoreEvent history from scratch
   * through that sport's engine, so `scoreDetails`/scores are always
   * derivable and consistent after a correction or reversal rather than
   * patched incrementally and potentially drifting.
   */
  recalculateMatch(params: {
    sportName?: string | null;
    teamAId: string;
    teamBId: string;
    rulesJson?: Record<string, unknown> | null;
    events: Array<{
      eventType: string;
      teamId: string | null;
      participantId?: string | null;
      points?: number;
      metadata?: unknown;
      isReversed: boolean;
    }>;
  }): EngineState {
    const engine = sportEngine(params.sportName);
    const context: EngineContext = {
      teamAId: params.teamAId,
      teamBId: params.teamBId,
      config: resolveConfig(params.sportName, params.rulesJson),
    };
    let state = engine.initialState(context);
    for (const ev of params.events) {
      if (ev.isReversed) continue;
      state = engine.applyEvent(
        state,
        {
          eventType: ev.eventType,
          teamId: ev.teamId,
          participantId: ev.participantId,
          points: ev.points,
          metadata: ev.metadata as Record<string, unknown> | null | undefined,
        },
        context,
      );
    }
    return state;
  }
}
