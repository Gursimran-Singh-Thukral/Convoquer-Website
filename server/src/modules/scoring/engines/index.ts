import { BadRequestException } from '@nestjs/common';
import type { SportEngine } from './types.js';
import { cricketEngine } from './cricket.engine.js';
import { footballEngine } from './football.engine.js';
import { basketballEngine } from './basketball.engine.js';
import { volleyballEngine } from './volleyball.engine.js';
import { badmintonEngine } from './badminton.engine.js';
import { tableTennisEngine } from './table-tennis.engine.js';
import { squashEngine } from './squash.engine.js';
import { chessEngine } from './chess.engine.js';
import { athleticsEngine } from './athletics.engine.js';
import { weightliftingEngine } from './weightlifting.engine.js';

export * from './types.js';

const ENGINES: Record<string, SportEngine> = {
  CRICKET: cricketEngine,
  FOOTBALL: footballEngine,
  BASKETBALL: basketballEngine,
  VOLLEYBALL: volleyballEngine,
  BADMINTON: badmintonEngine,
  'TABLE TENNIS': tableTennisEngine,
  SQUASH: squashEngine,
  CHESS: chessEngine,
  ATHLETICS: athleticsEngine,
  WEIGHTLIFTING: weightliftingEngine,
};

/** Every sport gets its own engine — there is deliberately no generic fallback. */
export function sportEngine(sportName: string | undefined | null): SportEngine {
  const key = (sportName || '').trim().toUpperCase();
  const engine = ENGINES[key];
  if (!engine)
    throw new BadRequestException(
      `No scoring engine is configured for sport "${sportName}".`,
    );
  return engine;
}
