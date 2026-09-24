import { BadRequestException } from '@nestjs/common';
import type { EngineContext, EngineEvent, EngineState } from './types.js';

/**
 * Shared reducer for every "win a rally, first to X points wins the game,
 * first to win a majority of games wins the match" sport — this is genuinely
 * how BWF (badminton), ITTF (table tennis), WSF (squash) and FIVB (volleyball)
 * all define a game/set, just with different numbers. Point-a-rally scoring
 * (PAR) means whichever side wins the rally gets the point regardless of who
 * served, so a single POINT event (credited to the winning side) is all that's
 * needed — the sport-specific engine just supplies its own numbers below.
 */

export interface SetsAndGamesConfig {
  pointsPerGame: number;
  /** Hard cap where a 2-point lead is no longer required (e.g. badminton: 30). Omit for sports where deuce continues indefinitely (table tennis, squash). */
  winBy2Cap?: number;
  bestOfGames: number; // 3 or 5
  /** If set, the last possible (deciding) game uses this point target instead — volleyball's 5th set is played to 15, not 25. */
  decidingGamePoints?: number;
}

export interface GameRecord {
  teamAPoints: number;
  teamBPoints: number;
  winnerTeamId: string | null;
}

export interface SetsAndGamesDetails {
  config: SetsAndGamesConfig;
  games: GameRecord[];
  gamesWon: { teamA: number; teamB: number };
}

function gamesToWin(bestOfGames: number): number {
  return Math.ceil(bestOfGames / 2);
}

function pointTargetFor(config: SetsAndGamesConfig, gameIndex: number): number {
  const isFinalPossibleGame = gameIndex === config.bestOfGames - 1;
  return isFinalPossibleGame && config.decidingGamePoints
    ? config.decidingGamePoints
    : config.pointsPerGame;
}

function isGameWon(
  game: GameRecord,
  target: number,
  cap?: number,
): 'teamA' | 'teamB' | null {
  const { teamAPoints: a, teamBPoints: b } = game;
  const leader = a > b ? 'teamA' : b > a ? 'teamB' : null;
  if (!leader) return null;
  const leaderPoints = Math.max(a, b);
  const trailerPoints = Math.min(a, b);
  if (cap && leaderPoints >= cap) return leader; // hard cap reached — win regardless of margin
  if (leaderPoints >= target && leaderPoints - trailerPoints >= 2)
    return leader;
  return null;
}

export function initialSetsAndGamesState(
  config: SetsAndGamesConfig,
): EngineState {
  const d: SetsAndGamesDetails = {
    config,
    games: [{ teamAPoints: 0, teamBPoints: 0, winnerTeamId: null }],
    gamesWon: { teamA: 0, teamB: 0 },
  };
  return {
    teamAScore: 0,
    teamBScore: 0,
    scoreDetails: d as unknown as Record<string, unknown>,
    currentPeriod: 'Game 1',
    winnerTeamId: null,
    isComplete: false,
  };
}

export function applyPointEvent(
  state: EngineState,
  event: EngineEvent,
  context: EngineContext,
): EngineState {
  const d = structuredClone(
    state.scoreDetails as unknown as SetsAndGamesDetails,
  );
  if (
    !event.teamId ||
    ![context.teamAId, context.teamBId].includes(event.teamId)
  ) {
    throw new BadRequestException(
      'A point must be credited to a team in this match.',
    );
  }
  if (
    d.gamesWon.teamA >= gamesToWin(d.config.bestOfGames) ||
    d.gamesWon.teamB >= gamesToWin(d.config.bestOfGames)
  ) {
    throw new BadRequestException('This match is already won.');
  }

  const gameIndex = d.games.length - 1;
  const game = d.games[gameIndex];
  if (game.winnerTeamId)
    throw new BadRequestException('The current game has already ended.');

  if (event.teamId === context.teamAId) game.teamAPoints += 1;
  else game.teamBPoints += 1;

  const target = pointTargetFor(d.config, gameIndex);
  const winnerKey = isGameWon(game, target, d.config.winBy2Cap);
  let currentPeriod = `Game ${gameIndex + 1}`;
  if (winnerKey) {
    game.winnerTeamId =
      winnerKey === 'teamA' ? context.teamAId : context.teamBId;
    d.gamesWon[winnerKey] += 1;
    const matchDecided =
      d.gamesWon.teamA >= gamesToWin(d.config.bestOfGames) ||
      d.gamesWon.teamB >= gamesToWin(d.config.bestOfGames);
    if (!matchDecided && d.games.length < d.config.bestOfGames) {
      d.games.push({ teamAPoints: 0, teamBPoints: 0, winnerTeamId: null });
      currentPeriod = `Game ${d.games.length}`;
    } else {
      currentPeriod = 'Match Complete';
    }
  }

  const isComplete =
    d.gamesWon.teamA >= gamesToWin(d.config.bestOfGames) ||
    d.gamesWon.teamB >= gamesToWin(d.config.bestOfGames);
  const winnerTeamId = isComplete
    ? d.gamesWon.teamA > d.gamesWon.teamB
      ? context.teamAId
      : context.teamBId
    : null;

  return {
    teamAScore: d.gamesWon.teamA,
    teamBScore: d.gamesWon.teamB,
    scoreDetails: d as unknown as Record<string, unknown>,
    currentPeriod,
    winnerTeamId,
    isComplete,
  };
}
