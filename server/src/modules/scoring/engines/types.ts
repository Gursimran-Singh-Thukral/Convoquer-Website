/**
 * Shared contract every per-sport scoring engine implements. Each engine is a
 * pure reducer: `initialState` + repeated `applyEvent` folds over a match's
 * full ScoreEvent history always reproduces the same state, so a single live
 * event and a full replay (after a correction/reversal) use the exact same
 * code path and can never drift apart.
 */

export interface EngineContext {
  teamAId: string;
  teamBId: string;
  /** Resolved per-tournament format config (Tournament.rulesJson[sportKey]), merged over this sport's official defaults. */
  config: Record<string, unknown>;
}

export interface EngineEvent {
  eventType: string;
  teamId?: string | null;
  participantId?: string | null;
  points?: number;
  metadata?: Record<string, unknown> | null;
}

export interface EngineState {
  teamAScore: number;
  teamBScore: number;
  scoreDetails: Record<string, unknown>;
  currentPeriod: string | null;
  /** Set once the engine's win condition is met (e.g. all-out, 3 sets won, checkmate). Null while undecided (including draws). */
  winnerTeamId: string | null;
  /** True once the match is decided by the engine's own rules — a hint to the scorer UI, not a status transition by itself. */
  isComplete: boolean;
}

export interface SportEngine {
  /** Upper-cased event type catalog this engine accepts via /scoring/:matchId/events. */
  validEventTypes: string[];
  initialState(context: EngineContext): EngineState;
  /** Pure — must throw BadRequestException (not swallow) on a rules violation. */
  applyEvent(
    state: EngineState,
    event: EngineEvent,
    context: EngineContext,
  ): EngineState;
}

export function creditedTeam(
  event: EngineEvent,
  context: EngineContext,
): string {
  if (event.teamId) return event.teamId;
  throw new Error('teamId is required for this event type');
}
