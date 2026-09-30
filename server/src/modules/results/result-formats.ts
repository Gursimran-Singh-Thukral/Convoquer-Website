import { BadRequestException } from '@nestjs/common';

/**
 * Convoquer'26 records only FINAL results (no live scoring). Each sport has its
 * own scorecard shape, stored in Result.scoreDetails with a `kind` tag. This
 * module validates that payload and derives the canonical winner and headline
 * score (Result.finalScoreA/B) from it, so the headline can never disagree with
 * the detailed scorecard. It is pure (no I/O) so it is fully unit-testable.
 *
 * kind      sports                         headline score (finalScoreA/B)
 * SETS      Badminton (Women), Table       sets won (best of 3)
 *           Tennis, Volleyball
 * GAMES     Badminton (Men)                games won (best of 5 games,
 *                                          each game best of 3 sets)
 * QUARTERS  Basketball                     total points (4 quarters + OT)
 * CRICKET   Cricket                        runs (20 overs a side)
 * FOOTBALL  Football                       goals (regulation + extra time)
 * CHESS     Chess                          board points (0.5 increments)
 * TRACK     Athletics                      none (ranked entries per category)
 * LOBBY     E-Sports Free Fire / BGMI      none (ranked entries)
 * SCORE     E-Sports Valorant, anything    plain final score
 *           else
 */
export type ResultKind =
  | 'SETS'
  | 'GAMES'
  | 'QUARTERS'
  | 'CRICKET'
  | 'FOOTBALL'
  | 'CHESS'
  | 'TRACK'
  | 'LOBBY'
  | 'SCORE';

export interface FormatContext {
  teamAId: string | null;
  teamBId: string | null;
  /** A knockout fixture (feeds a next match) must produce a winner. */
  knockout: boolean;
  /** Teams allowed to appear in ranked (TRACK / LOBBY) entries. */
  fieldTeams?: Map<string, { name: string; shortName?: string | null }>;
  /** Explicit winner chosen by the submitter (used to break a cricket tie). */
  requestedWinnerId?: string | null;
  /** Sets in a SETS match: 3 (default) or 5 for volleyball. */
  bestOf?: number;
  /** Fixture label, used to tell E-Sports games apart. */
  label?: string | null;
  /** Two-team fixture that can never be drawn (knockouts, Valorant). */
  mustDecide?: boolean;
}

export interface BuiltResult {
  finalScoreA: number;
  finalScoreB: number;
  winnerTeamId: string | null;
  scoreDetails: Record<string, unknown>;
}

const bad = (message: string): never => {
  throw new BadRequestException(message);
};

/** Which scorecard a sport (and, for E-Sports, a fixture label) uses. */
export function resultKindFor(
  sportName: string | null | undefined,
  matchLabel?: string | null,
): ResultKind {
  const name = (sportName ?? '').toLowerCase();
  // Men's badminton ties are best of 5 games (each game best of 3 sets).
  if (/badminton/.test(name) && /\bmen\b/.test(name) && !/women/.test(name))
    return 'GAMES';
  if (/badminton|table tennis|volleyball/.test(name)) return 'SETS';
  if (/basketball/.test(name)) return 'QUARTERS';
  if (/cricket/.test(name)) return 'CRICKET';
  if (/football/.test(name)) return 'FOOTBALL';
  if (/chess/.test(name)) return 'CHESS';
  if (/athletics/.test(name)) return 'TRACK';
  if (/e-?sports/.test(name))
    return /free fire|bgmi/i.test(matchLabel ?? '') ? 'LOBBY' : 'SCORE';
  return 'SCORE';
}

/** Kinds that rank many teams in one fixture instead of pitting team A v B. */
export const isRankedKind = (kind: ResultKind) =>
  kind === 'TRACK' || kind === 'LOBBY';

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

function int(value: unknown, field: string, max = 1000): number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 0 ||
    (value as number) > max
  )
    bad(`${field} must be a whole number between 0 and ${max}`);
  return value as number;
}

function pair(value: unknown, field: string, max = 1000) {
  if (!isObject(value)) return bad(`${field} is required`);
  return {
    a: int(value.a, `${field} (A)`, max),
    b: int(value.b, `${field} (B)`, max),
  };
}

function winnerOf(a: number, b: number, ctx: FormatContext): string | null {
  if (a > b) return ctx.teamAId;
  if (b > a) return ctx.teamBId;
  return null;
}

function requireTeams(ctx: FormatContext) {
  if (!ctx.teamAId || !ctx.teamBId)
    bad('Both teams must be determined before submitting a result');
}

// ---------------------------------------------------------------------------
// SETS — Badminton, Table Tennis, Volleyball (best of 3 sets)
// ---------------------------------------------------------------------------
function buildSets(
  d: Record<string, unknown>,
  ctx: FormatContext,
): BuiltResult {
  requireTeams(ctx);
  const bestOf = ctx.bestOf ?? 3;
  const need = (bestOf + 1) / 2; // sets a team must win
  if (!Array.isArray(d.sets) || d.sets.length < need || d.sets.length > bestOf)
    bad(`Enter the score of ${need} to ${bestOf} sets (best of ${bestOf})`);
  const sets = (d.sets as unknown[]).map((s, i) => pair(s, `Set ${i + 1}`, 99));
  let setsA = 0;
  let setsB = 0;
  sets.forEach((s, i) => {
    if (s.a === s.b) bad(`Set ${i + 1} cannot end level`);
    if (setsA === need || setsB === need)
      bad('The match was already decided — remove the extra set');
    if (s.a > s.b) setsA++;
    else setsB++;
  });
  if (setsA < need && setsB < need)
    bad(`Best of ${bestOf}: one team must win ${need} sets — add the next set`);
  return {
    finalScoreA: setsA,
    finalScoreB: setsB,
    winnerTeamId: setsA > setsB ? ctx.teamAId : ctx.teamBId,
    scoreDetails: { kind: 'SETS', bestOf, sets },
  };
}

// ---------------------------------------------------------------------------
// GAMES — Badminton (Men): best of 5 games, each game best of 3 sets
// ---------------------------------------------------------------------------
function buildGames(
  d: Record<string, unknown>,
  ctx: FormatContext,
): BuiltResult {
  requireTeams(ctx);
  if (!Array.isArray(d.games) || d.games.length < 3 || d.games.length > 5)
    bad('Enter 3 to 5 games (best of 5)');
  let gamesA = 0;
  let gamesB = 0;
  const games = (d.games as unknown[]).map((g, gi) => {
    const n = gi + 1;
    if (gamesA === 3 || gamesB === 3)
      bad('The tie was already decided — remove the extra game');
    if (
      !isObject(g) ||
      !Array.isArray(g.sets) ||
      g.sets.length < 2 ||
      g.sets.length > 3
    )
      bad(`Game ${n}: enter the score of 2 or 3 sets (best of 3)`);
    const raw = g as { sets: unknown[]; playerA?: unknown; playerB?: unknown };
    let setsA = 0;
    let setsB = 0;
    const sets = raw.sets.map((s, si) => {
      const score = pair(s, `Game ${n} set ${si + 1}`, 99);
      if (score.a === score.b) bad(`Game ${n} set ${si + 1} cannot end level`);
      if (setsA === 2 || setsB === 2)
        bad(`Game ${n} was already decided — remove the extra set`);
      if (score.a > score.b) setsA++;
      else setsB++;
      return score;
    });
    if (setsA < 2 && setsB < 2)
      bad(`Game ${n}: one side must win 2 sets — add the deciding set`);
    if (setsA > setsB) gamesA++;
    else gamesB++;
    const game: Record<string, unknown> = { sets, setsA, setsB };
    for (const key of ['playerA', 'playerB'] as const) {
      const v = raw[key];
      if (typeof v === 'string' && v.trim()) game[key] = v.trim().slice(0, 80);
    }
    return game;
  });
  if (gamesA < 3 && gamesB < 3)
    bad('Best of 5: one team must win 3 games — add the next game');
  return {
    finalScoreA: gamesA,
    finalScoreB: gamesB,
    winnerTeamId: gamesA > gamesB ? ctx.teamAId : ctx.teamBId,
    scoreDetails: { kind: 'GAMES', bestOf: 5, games },
  };
}

// ---------------------------------------------------------------------------
// QUARTERS — Basketball (4 quarters, optional overtime periods)
// ---------------------------------------------------------------------------
function buildQuarters(
  d: Record<string, unknown>,
  ctx: FormatContext,
): BuiltResult {
  requireTeams(ctx);
  if (!Array.isArray(d.periods) || d.periods.length !== 4)
    bad('Enter the score of all 4 quarters');
  const periods = (d.periods as unknown[]).map((p, i) =>
    pair(p, `Quarter ${i + 1}`, 300),
  );
  const overtime = Array.isArray(d.overtime)
    ? (d.overtime as unknown[]).map((p, i) => pair(p, `Overtime ${i + 1}`, 100))
    : [];
  if (overtime.length > 5) bad('At most 5 overtime periods are supported');
  const sum = (rows: { a: number; b: number }[], side: 'a' | 'b') =>
    rows.reduce((t, r) => t + r[side], 0);
  const regA = sum(periods, 'a');
  const regB = sum(periods, 'b');
  if (overtime.length && regA !== regB)
    bad('Overtime is only played when the score is level after 4 quarters');
  const totalA = regA + sum(overtime, 'a');
  const totalB = regB + sum(overtime, 'b');
  if (totalA === totalB)
    bad('A basketball game cannot end level — add an overtime period');
  return {
    finalScoreA: totalA,
    finalScoreB: totalB,
    winnerTeamId: winnerOf(totalA, totalB, ctx),
    scoreDetails: { kind: 'QUARTERS', periods, overtime },
  };
}

// ---------------------------------------------------------------------------
// CRICKET — 20 overs a side
// ---------------------------------------------------------------------------
const OVERS = /^(\d{1,2})(?:\.([0-5]))?$/;

function innings(value: unknown, field: string, limit: number) {
  if (!isObject(value)) return bad(`${field} innings is required`);
  const runs = int(value.runs, `${field} runs`, 1000);
  const wickets = int(value.wickets, `${field} wickets`, 10);
  const overs = String(value.overs ?? '').trim();
  const hit = OVERS.exec(overs);
  if (!hit) return bad(`${field} overs must look like 20 or 18.3 (balls 0-5)`);
  const completed = Number(hit[1]) + (hit[2] ? Number(hit[2]) / 6 : 0);
  if (completed > limit) bad(`${field} overs cannot exceed ${limit}`);
  return { runs, wickets, overs };
}

function buildCricket(
  d: Record<string, unknown>,
  ctx: FormatContext,
): BuiltResult {
  requireTeams(ctx);
  const limit = 20;
  if (d.battingFirst !== 'A' && d.battingFirst !== 'B')
    bad('Select which team batted first');
  if (!isObject(d.innings)) bad('Enter both innings');
  const inn = d.innings as Record<string, unknown>;
  const A = innings(inn.A, 'Team A', limit);
  const B = innings(inn.B, 'Team B', limit);
  let winner = winnerOf(A.runs, B.runs, ctx);
  let superOver: { a: number; b: number } | undefined;
  if (A.runs === B.runs) {
    if (d.superOver !== undefined && d.superOver !== null) {
      superOver = pair(d.superOver, 'Super over', 100);
      if (superOver.a === superOver.b) bad('The super over cannot end level');
      winner = winnerOf(superOver.a, superOver.b, ctx);
    } else if (
      ctx.requestedWinnerId &&
      [ctx.teamAId, ctx.teamBId].includes(ctx.requestedWinnerId)
    )
      winner = ctx.requestedWinnerId;
    else if (ctx.knockout)
      bad('Scores are level — enter the super over or select the winner');
  }
  const details: Record<string, unknown> = {
    kind: 'CRICKET',
    overs: limit,
    battingFirst: d.battingFirst,
    innings: { A, B },
  };
  if (superOver) details.superOver = superOver;
  if (typeof d.noResult === 'boolean' && d.noResult) details.noResult = true;
  return {
    finalScoreA: A.runs,
    finalScoreB: B.runs,
    winnerTeamId: winner,
    scoreDetails: details,
  };
}

// ---------------------------------------------------------------------------
// FOOTBALL — regulation, optional extra time, optional penalty shoot-out
// ---------------------------------------------------------------------------
function buildFootball(
  d: Record<string, unknown>,
  ctx: FormatContext,
): BuiltResult {
  requireTeams(ctx);
  const regulation = pair(d.regulation, 'Full-time score', 50);
  const extraTime =
    d.extraTime === undefined || d.extraTime === null
      ? undefined
      : pair(d.extraTime, 'Extra-time goals', 50);
  const penalties =
    d.penalties === undefined || d.penalties === null
      ? undefined
      : pair(d.penalties, 'Penalty shoot-out', 50);
  const goalsA = regulation.a + (extraTime?.a ?? 0);
  const goalsB = regulation.b + (extraTime?.b ?? 0);
  if (extraTime && regulation.a !== regulation.b)
    bad('Extra time is only played when the score is level after full time');
  let winner = winnerOf(goalsA, goalsB, ctx);
  if (penalties) {
    if (goalsA !== goalsB)
      bad('A penalty shoot-out is only played when the score is level');
    if (penalties.a === penalties.b)
      bad('A penalty shoot-out cannot end level');
    winner = winnerOf(penalties.a, penalties.b, ctx);
  } else if (goalsA === goalsB && ctx.knockout) {
    bad('Knockout match is level — enter the penalty shoot-out score');
  }
  const details: Record<string, unknown> = { kind: 'FOOTBALL', regulation };
  if (extraTime) details.extraTime = extraTime;
  if (penalties) details.penalties = penalties;
  return {
    finalScoreA: goalsA,
    finalScoreB: goalsB,
    winnerTeamId: winner,
    scoreDetails: details,
  };
}

// ---------------------------------------------------------------------------
// CHESS — team match decided over boards (1 / ½ / 0 each)
// ---------------------------------------------------------------------------
const BOARD_RESULTS = new Set([1, 0.5, 0]);
/** Each chess team fields 4 players; board N of one team meets board N of the other. */
const CHESS_BOARDS = 4;

function buildChess(
  d: Record<string, unknown>,
  ctx: FormatContext,
  fallback?: { a?: number; b?: number },
): BuiltResult {
  requireTeams(ctx);
  let totalA: number;
  let totalB: number;
  const out: Record<string, unknown> = { kind: 'CHESS' };
  if (Array.isArray(d.boards) && d.boards.length) {
    if (d.boards.length !== CHESS_BOARDS)
      bad(
        `Each team plays ${CHESS_BOARDS} players: enter all ${CHESS_BOARDS} boards`,
      );
    const boards = (d.boards as unknown[]).map((row, i) => {
      if (!isObject(row)) return bad(`Board ${i + 1} is invalid`);
      const a = row.a;
      if (typeof a !== 'number' || !BOARD_RESULTS.has(a))
        return bad(`Board ${i + 1} result must be win, draw or loss`);
      const board: Record<string, unknown> = { a, b: 1 - a };
      for (const key of ['playerA', 'playerB'] as const) {
        const v = row[key];
        if (typeof v === 'string' && v.trim())
          board[key] = v.trim().slice(0, 80);
      }
      return board as { a: number; b: number };
    });
    totalA = boards.reduce((t, b) => t + b.a, 0);
    totalB = boards.reduce((t, b) => t + b.b, 0);
    out.boards = boards;
  } else {
    totalA = Number(fallback?.a);
    totalB = Number(fallback?.b);
    const ok = (n: number) =>
      Number.isFinite(n) && n >= 0 && n <= 24 && n * 2 === Math.round(n * 2);
    if (!ok(totalA) || !ok(totalB))
      bad('Enter board results, or the team scores in steps of 0.5');
  }
  return {
    finalScoreA: totalA,
    finalScoreB: totalB,
    winnerTeamId: winnerOf(totalA, totalB, ctx), // level = drawn match (1 pt each)
    scoreDetails: out,
  };
}

// ---------------------------------------------------------------------------
// TRACK — Athletics: ranked entries per category, all decided in one race
// ---------------------------------------------------------------------------
const CATEGORIES = new Set(['Men', 'Women', 'Mixed']);
const STATUS_NOTES = new Set(['DNS', 'DNF', 'DQ', 'NM']);

function buildRanked(
  kind: 'TRACK' | 'LOBBY',
  d: Record<string, unknown>,
  ctx: FormatContext,
): BuiltResult {
  const field = ctx.fieldTeams;
  const checkEntry = (raw: unknown, where: string) => {
    if (!isObject(raw)) return bad(`${where}: invalid entry`);
    if (typeof raw.teamId !== 'string' || (field && !field.has(raw.teamId)))
      bad(`${where}: choose a team registered for this sport`);
    const rank = raw.rank;
    const note =
      typeof raw.note === 'string' ? raw.note.toUpperCase() : undefined;
    if (note && !STATUS_NOTES.has(note))
      bad(`${where}: unknown status "${note}"`);
    if (
      !note &&
      (!Number.isSafeInteger(rank) ||
        (rank as number) < 1 ||
        (rank as number) > 64)
    )
      bad(`${where}: enter the finishing position`);
    const team = field?.get(raw.teamId as string);
    const entry: Record<string, unknown> = {
      teamId: raw.teamId,
      // Snapshot so public scorecards render without further lookups.
      ...(team
        ? { teamName: team.name, shortName: team.shortName ?? undefined }
        : {}),
      rank: note ? null : rank,
    };
    if (note) entry.note = note;
    for (const key of ['athlete', 'mark'] as const) {
      const v = raw[key];
      if (typeof v === 'string' && v.trim()) entry[key] = v.trim().slice(0, 60);
    }
    if (raw.qualified === true) entry.qualified = true;
    if (kind === 'LOBBY') {
      const kills = int(raw.kills ?? 0, `${where} kills`, 100);
      const placementPoints = int(
        raw.placementPoints ?? 0,
        `${where} placement points`,
        500,
      );
      const killPoints = int(
        raw.killPoints ?? kills,
        `${where} kill points`,
        500,
      );
      entry.kills = kills;
      entry.placementPoints = placementPoints;
      entry.killPoints = killPoints;
      // Canonical total, never trusted from the client.
      entry.points = placementPoints + killPoints;
    }
    return entry;
  };
  // Shared positions are legitimate (dead heat); only require the table to
  // start at 1 so a forgotten winner is caught.
  const assertPositions = (rows: Record<string, unknown>[], where: string) => {
    const ranks = rows
      .map((e) => e.rank)
      .filter((r): r is number => typeof r === 'number');
    if (ranks.length && Math.min(...ranks) !== 1)
      bad(`${where}: positions must start at 1`);
  };

  if (kind === 'TRACK') {
    if (
      !Array.isArray(d.sections) ||
      !d.sections.length ||
      d.sections.length > 3
    )
      bad('Enter the results for at least one category');
    const seenCat = new Set<string>();
    const sections = (d.sections as unknown[]).map((s) => {
      if (
        !isObject(s) ||
        typeof s.category !== 'string' ||
        !CATEGORIES.has(s.category)
      )
        return bad('Each section needs a category: Men, Women or Mixed');
      if (seenCat.has(s.category)) bad(`${s.category} was entered twice`);
      seenCat.add(s.category);
      if (
        !Array.isArray(s.entries) ||
        !s.entries.length ||
        s.entries.length > 64
      )
        bad(`${s.category}: add at least one result`);
      const entries = (s.entries as unknown[]).map((e, i) =>
        checkEntry(e, `${s.category} #${i + 1}`),
      );
      assertPositions(entries, s.category as string);
      return { category: s.category, entries };
    });
    const first =
      sections.length === 1
        ? sections[0].entries.find((e) => e.rank === 1)
        : undefined;
    const stage =
      d.round === 'SEMIFINAL'
        ? 'SEMIFINAL'
        : d.round === 'FINAL'
          ? 'FINAL'
          : 'DIRECT';
    return {
      finalScoreA: 0,
      finalScoreB: 0,
      winnerTeamId: (first?.teamId as string | undefined) ?? null,
      scoreDetails: { kind: 'TRACK', round: stage, sections },
    };
  }
  // LOBBY
  if (
    !Array.isArray(d.entries) ||
    d.entries.length < 2 ||
    d.entries.length > 25
  )
    bad('Enter every team in the lobby (2-25 teams)');
  const entries = (d.entries as unknown[]).map((e, i) =>
    checkEntry(e, `Team #${i + 1}`),
  );
  assertPositions(entries, 'Lobby');
  const ids = entries.map((e) => e.teamId);
  if (new Set(ids).size !== ids.length)
    bad('A team appears twice in the lobby');
  const top = entries.find((e) => e.rank === 1);
  return {
    finalScoreA: 0,
    finalScoreB: 0,
    winnerTeamId: (top?.teamId as string | undefined) ?? null,
    scoreDetails: {
      kind: 'LOBBY',
      game: /bgmi/i.test(ctx.label ?? '')
        ? 'BGMI'
        : /free fire/i.test(ctx.label ?? '')
          ? 'Free Fire'
          : undefined,
      entries,
    },
  };
}

// ---------------------------------------------------------------------------
// SCORE — plain two-team final score (Valorant, anything unspecialised)
// ---------------------------------------------------------------------------
function buildScore(
  d: Record<string, unknown>,
  ctx: FormatContext,
  fallback?: { a?: number; b?: number },
): BuiltResult {
  requireTeams(ctx);
  const a = int(d.a ?? fallback?.a, 'Score (A)', 1000);
  const b = int(d.b ?? fallback?.b, 'Score (B)', 1000);
  let winner = winnerOf(a, b, ctx);
  if (
    a === b &&
    ctx.requestedWinnerId &&
    [ctx.teamAId, ctx.teamBId].includes(ctx.requestedWinnerId)
  )
    winner = ctx.requestedWinnerId;
  if (!winner && (ctx.knockout || ctx.mustDecide))
    bad('This match cannot end level — a winner is required');
  return {
    finalScoreA: a,
    finalScoreB: b,
    winnerTeamId: winner,
    scoreDetails: { kind: 'SCORE', a, b },
  };
}

/**
 * Validates `details` for `kind` and derives the canonical result. Throws a
 * 400 (BadRequestException) naming the first thing wrong, in organiser terms.
 */
export function buildResult(
  kind: ResultKind,
  details: unknown,
  ctx: FormatContext,
  fallback?: { a?: number; b?: number },
): BuiltResult {
  if (!isObject(details))
    return bad('Result details are required for this sport');
  if (details.kind !== undefined && details.kind !== kind)
    bad(`This sport records a ${kind} scorecard, not ${String(details.kind)}`);
  switch (kind) {
    case 'SETS':
      return buildSets(details, ctx);
    case 'GAMES':
      return buildGames(details, ctx);
    case 'QUARTERS':
      return buildQuarters(details, ctx);
    case 'CRICKET':
      return buildCricket(details, ctx);
    case 'FOOTBALL':
      return buildFootball(details, ctx);
    case 'CHESS':
      return buildChess(details, ctx, fallback);
    case 'TRACK':
    case 'LOBBY':
      return buildRanked(kind, details, ctx);
    default:
      return buildScore(details, ctx, fallback);
  }
}
