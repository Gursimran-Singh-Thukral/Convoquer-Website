import { BadRequestException } from '@nestjs/common';
import type {
  EngineContext,
  EngineEvent,
  EngineState,
  SportEngine,
} from './types.js';

/**
 * Chess — FIDE Laws of Chess. A "match" is a fixed number of games (1 for a
 * single decisive game, or an odd number for a mini-match/tie). Each game's
 * result is recorded directly (1-0 / 0-1 / ½-½) with its reason — chess has
 * no incremental point-by-point scoring, only a final result per game. Points
 * are real fractional values (win=1, draw=0.5, loss=0), matching standard
 * chess scoring directly — no doubling/undoubling needed.
 */

type GameResult = 'WHITE' | 'BLACK' | 'DRAW';
type GameReason =
  | 'CHECKMATE'
  | 'RESIGNATION'
  | 'TIMEOUT'
  | 'DRAW_AGREEMENT'
  | 'STALEMATE'
  | 'THREEFOLD_REPETITION'
  | 'FIFTY_MOVE_RULE';

interface GameRecord {
  whiteTeamId: string;
  result: GameResult;
  reason: GameReason;
}

interface ChessDetails {
  numberOfGames: number;
  games: GameRecord[];
  points: { teamA: number; teamB: number };
}

const VALID_REASONS: GameReason[] = [
  'CHECKMATE',
  'RESIGNATION',
  'TIMEOUT',
  'DRAW_AGREEMENT',
  'STALEMATE',
  'THREEFOLD_REPETITION',
  'FIFTY_MOVE_RULE',
];

function details(state: EngineState): ChessDetails {
  return state.scoreDetails as unknown as ChessDetails;
}

export const chessEngine: SportEngine = {
  validEventTypes: ['GAME_RESULT'],

  initialState(context: EngineContext): EngineState {
    const numberOfGames = Number(context.config.numberOfGames) || 1;
    const d: ChessDetails = {
      numberOfGames,
      games: [],
      points: { teamA: 0, teamB: 0 },
    };
    return {
      teamAScore: 0,
      teamBScore: 0,
      scoreDetails: d as unknown as Record<string, unknown>,
      currentPeriod: `Game 1 of ${numberOfGames}`,
      winnerTeamId: null,
      isComplete: false,
    };
  },

  applyEvent(
    state: EngineState,
    event: EngineEvent,
    context: EngineContext,
  ): EngineState {
    if (event.eventType.toUpperCase() !== 'GAME_RESULT')
      throw new BadRequestException(
        `Unsupported chess event type "${event.eventType}".`,
      );
    const d = structuredClone(details(state));
    if (d.games.length >= d.numberOfGames)
      throw new BadRequestException(
        'All games in this match have already been played.',
      );

    const whiteTeamId = (event.metadata?.whiteTeamId as string) || event.teamId;
    if (
      !whiteTeamId ||
      ![context.teamAId, context.teamBId].includes(whiteTeamId)
    )
      throw new BadRequestException(
        'GAME_RESULT requires whiteTeamId (which side played White).',
      );
    const result = String(
      event.metadata?.result || '',
    ).toUpperCase() as GameResult;
    if (!['WHITE', 'BLACK', 'DRAW'].includes(result))
      throw new BadRequestException('result must be WHITE, BLACK or DRAW.');
    const reason = String(
      event.metadata?.reason || '',
    ).toUpperCase() as GameReason;
    if (!VALID_REASONS.includes(reason))
      throw new BadRequestException(
        `reason must be one of: ${VALID_REASONS.join(', ')}.`,
      );

    const blackTeamId =
      whiteTeamId === context.teamAId ? context.teamBId : context.teamAId;
    d.games.push({ whiteTeamId, result, reason });

    if (result === 'DRAW') {
      d.points.teamA += 0.5;
      d.points.teamB += 0.5;
    } else {
      const winnerTeamId = result === 'WHITE' ? whiteTeamId : blackTeamId;
      if (winnerTeamId === context.teamAId) d.points.teamA += 1;
      else d.points.teamB += 1;
    }

    const gamesPlayed = d.games.length;
    const gamesRemaining = d.numberOfGames - gamesPlayed;
    // A side already has an unassailable lead if the trailing side can't catch up even by winning every remaining game (1 pt each).
    const leaderMargin = Math.abs(d.points.teamA - d.points.teamB);
    const decidedEarly = leaderMargin > gamesRemaining;
    const isComplete = gamesPlayed >= d.numberOfGames || decidedEarly;

    let winnerTeamId: string | null = null;
    if (isComplete && d.points.teamA !== d.points.teamB)
      winnerTeamId =
        d.points.teamA > d.points.teamB ? context.teamAId : context.teamBId;

    const currentPeriod = isComplete
      ? 'Match Complete'
      : `Game ${gamesPlayed + 1} of ${d.numberOfGames}`;

    return {
      teamAScore: d.points.teamA,
      teamBScore: d.points.teamB,
      scoreDetails: d as unknown as Record<string, unknown>,
      currentPeriod,
      winnerTeamId,
      isComplete,
    };
  },
};
