// Final-result scorecards (Result.scoreDetails / Match.scoreDetails) and the
// wording used to present them. Mirrors server/src/modules/results/result-formats.ts,
// which validates the same shapes and derives the headline score and winner.

export type ResultKind =
  'SETS' | 'GAMES' | 'QUARTERS' | 'CRICKET' | 'FOOTBALL' | 'CHESS' | 'TRACK' | 'LOBBY' | 'SCORE';

export interface Pair {
  a: number;
  b: number;
}
export interface SetsDetails {
  kind: 'SETS';
  bestOf?: number;
  sets: Pair[];
}
/** Badminton (Men): best of 5 games, each game best of 3 sets. */
export interface GamesDetails {
  kind: 'GAMES';
  bestOf?: number;
  playAll?: boolean;
  unit?: 'Game' | 'Match';
  games: { sets: Pair[]; setsA: number; setsB: number; playerA?: string; playerB?: string }[];
}
export interface QuartersDetails {
  kind: 'QUARTERS';
  periods: Pair[];
  overtime?: Pair[];
}
export interface CricketInnings {
  runs: number;
  wickets: number;
  overs: string;
}
export interface CricketDetails {
  kind: 'CRICKET';
  overs: number;
  battingFirst: 'A' | 'B';
  innings: { A: CricketInnings; B: CricketInnings };
  superOver?: Pair;
  noResult?: boolean;
}
export interface FootballDetails {
  kind: 'FOOTBALL';
  regulation: Pair;
  extraTime?: Pair;
  penalties?: Pair;
}
export interface ChessBoard {
  a: number;
  b: number;
  playerA?: string;
  playerB?: string;
}
export interface ChessDetails {
  kind: 'CHESS';
  boards?: ChessBoard[];
}
export interface RankedEntry {
  teamId: string;
  teamName?: string;
  shortName?: string;
  rank: number | null;
  note?: string;
  athlete?: string;
  mark?: string;
  qualified?: boolean;
  kills?: number;
  placementPoints?: number;
  killPoints?: number;
  points?: number;
}
export interface TrackDetails {
  kind: 'TRACK';
  round?: 'SEMIFINAL' | 'FINAL' | 'DIRECT';
  sections: { category: 'Men' | 'Women' | 'Mixed'; entries: RankedEntry[] }[];
}
export interface LobbyDetails {
  kind: 'LOBBY';
  game?: string;
  entries: RankedEntry[];
}
export interface ScoreDetails {
  kind: 'SCORE';
  a: number;
  b: number;
}
export type ResultDetails =
  | SetsDetails
  | GamesDetails
  | QuartersDetails
  | CricketDetails
  | FootballDetails
  | ChessDetails
  | TrackDetails
  | LobbyDetails
  | ScoreDetails;

/**
 * Team ties made of individual games, each game best of 3 sets. Mirrors
 * server gamesConfigFor(): Badminton (Men) best of 5 games, (Women) best of 3 —
 * the tie stops at a majority; Table Tennis (Men) 5 matches, (Women) 3 matches —
 * every match is played, each set to 11 points (win by 2).
 */
export interface GamesConfig {
  count: number;
  playAll: boolean;
  setTo?: number;
  unit: 'Game' | 'Match';
}
export function gamesConfigFor(sportName: string | null | undefined): GamesConfig | null {
  const name = (sportName ?? '').toLowerCase();
  const women = /women/.test(name);
  if (/badminton/.test(name)) return { count: women ? 3 : 5, playAll: false, unit: 'Game' };
  if (/table tennis/.test(name))
    return { count: women ? 3 : 5, playAll: true, setTo: 11, unit: 'Match' };
  return null;
}

export function resultKindFor(
  sportName: string | null | undefined,
  matchLabel?: string | null,
): ResultKind {
  const name = (sportName ?? '').toLowerCase();
  // Badminton and table tennis are team ties made of several games/matches.
  if (gamesConfigFor(name)) return 'GAMES';
  if (/volleyball/.test(name)) return 'SETS';
  if (/basketball/.test(name)) return 'QUARTERS';
  if (/cricket/.test(name)) return 'CRICKET';
  if (/football/.test(name)) return 'FOOTBALL';
  if (/chess/.test(name)) return 'CHESS';
  if (/athletics/.test(name)) return 'TRACK';
  if (/e-?sports/.test(name)) return /free fire|bgmi/i.test(matchLabel ?? '') ? 'LOBBY' : 'SCORE';
  return 'SCORE';
}

export const isRankedKind = (kind: ResultKind) => kind === 'TRACK' || kind === 'LOBBY';

/** True when `details` is one of the new final-result scorecards. */
export function isResultDetails(details: unknown): details is ResultDetails {
  return (
    !!details &&
    typeof details === 'object' &&
    typeof (details as { kind?: unknown }).kind === 'string' &&
    [
      'SETS',
      'GAMES',
      'QUARTERS',
      'CRICKET',
      'FOOTBALL',
      'CHESS',
      'TRACK',
      'LOBBY',
      'SCORE',
    ].includes((details as { kind: string }).kind)
  );
}

/** Real typographic minus/en dash used between scores: 21–15. */
export const dash = '–';

/** "1", "1½", "½", "2½" for chess board points. */
export function formatHalf(points: number): string {
  const whole = Math.floor(points);
  const half = points - whole >= 0.5;
  if (!half) return String(whole);
  return whole ? `${whole}½` : '½';
}

/** Cricket innings as "160/6" (all out is written "160 all out"). */
export function inningsLine(i: CricketInnings): string {
  return i.wickets >= 10 ? `${i.runs} all out` : `${i.runs}/${i.wickets}`;
}

/**
 * The official margin of victory, written the way cricket reports it:
 * "IIT Jammu won by 12 runs", "MIET won by 4 wickets", "Match tied".
 */
export function cricketResultText(
  d: CricketDetails,
  nameA: string,
  nameB: string,
  winnerSide: 'A' | 'B' | null,
): string {
  if (d.noResult) return 'No result';
  const A = d.innings.A;
  const B = d.innings.B;
  if (A.runs === B.runs) {
    if (d.superOver && winnerSide)
      return `Match tied — ${winnerSide === 'A' ? nameA : nameB} won the super over`;
    return winnerSide ? `Match tied — ${winnerSide === 'A' ? nameA : nameB} won` : 'Match tied';
  }
  const side = A.runs > B.runs ? 'A' : 'B';
  const name = side === 'A' ? nameA : nameB;
  if (d.battingFirst === side) {
    const diff = Math.abs(A.runs - B.runs);
    return `${name} won by ${diff} run${diff === 1 ? '' : 's'}`;
  }
  const left = 10 - d.innings[side].wickets;
  return `${name} won by ${left} wicket${left === 1 ? '' : 's'}`;
}

export interface TeamRef {
  id?: string | null;
  name?: string | null;
  shortName?: string | null;
  institute?: { shortName?: string | null } | null;
}

/**
 * The squad of a team that shares its college with others, taken from the team
 * name: "GCET E-Sports (BGMI - Team 2)" → "Team 2". Null for ordinary teams.
 */
export function squadOf(teamName?: string | null): string | null {
  const hit = /\(([^()]*)\)\s*$/.exec(teamName ?? '');
  if (!hit) return null;
  const parts = hit[1].split(' - ');
  return parts.length > 1 ? parts.slice(1).join(' - ').trim() : null;
}

/**
 * Institute short name ("MIET"), with the squad when a college fields several
 * teams in one sport ("GCET (Team 2)"); else the team name.
 */
export function teamLabel(
  t:
    | {
        name?: string | null;
        shortName?: string | null;
        institute?: { shortName?: string | null } | null;
      }
    | null
    | undefined,
  fallback = 'TBD',
): string {
  const base = t?.shortName || t?.institute?.shortName || t?.name || fallback;
  const squad = squadOf(t?.name);
  return squad && base !== t?.name ? `${base} (${squad})` : base;
}

const label = (t: TeamRef | null | undefined, fallback: string) => teamLabel(t, fallback);

/**
 * A single professional result line for lists and tickers, e.g.
 * "2–1 (21–15, 18–21, 21–19)", "1–1 (3–4 pens)", "MIET won by 4 wickets".
 * Returns null when the details are not a final-result scorecard.
 */
export function resultSummary(
  details: unknown,
  teamA?: TeamRef | null,
  teamB?: TeamRef | null,
  winnerTeamId?: string | null,
  scoreA?: number | null,
  scoreB?: number | null,
): string | null {
  if (!isResultDetails(details)) return null;
  const nameA = label(teamA, 'Team A');
  const nameB = label(teamB, 'Team B');
  const side = !winnerTeamId
    ? null
    : winnerTeamId === teamA?.id
      ? 'A'
      : winnerTeamId === teamB?.id
        ? 'B'
        : null;
  switch (details.kind) {
    case 'SETS': {
      const sets = details.sets.map((s) => `${s.a}${dash}${s.b}`).join(', ');
      return `${scoreA ?? 0}${dash}${scoreB ?? 0} (${sets})`;
    }
    case 'GAMES':
      return `${scoreA ?? 0}${dash}${scoreB ?? 0} (${details.unit === 'Match' ? 'matches' : 'games'})`;
    case 'QUARTERS': {
      const ot = details.overtime?.length ? ' (OT)' : '';
      return `${scoreA ?? 0}${dash}${scoreB ?? 0}${ot}`;
    }
    case 'CRICKET':
      return cricketResultText(details, nameA, nameB, side);
    case 'FOOTBALL': {
      const base = `${scoreA ?? 0}${dash}${scoreB ?? 0}`;
      if (details.penalties)
        return `${base} (${details.penalties.a}${dash}${details.penalties.b} pens)`;
      return details.extraTime ? `${base} (a.e.t.)` : base;
    }
    case 'CHESS':
      return `${formatHalf(scoreA ?? 0)}${dash}${formatHalf(scoreB ?? 0)}`;
    case 'SCORE':
      return `${details.a}${dash}${details.b}`;
    case 'TRACK': {
      const first = details.sections[0]?.entries.find((e) => e.rank === 1);
      return first
        ? `Winner: ${teamLabel({ name: first.teamName, shortName: first.shortName }, 'Team')}${first.mark ? ` (${first.mark})` : ''}`
        : 'Result recorded';
    }
    case 'LOBBY': {
      const top = details.entries.find((e) => e.rank === 1);
      return top
        ? `Winner: ${teamLabel({ name: top.teamName, shortName: top.shortName }, 'Team')}`
        : 'Result recorded';
    }
  }
}

/**
 * Headline figures for the two team rows of a scoreboard: what to show big next
 * to each team ("2", "160/6", "79").
 */
export function headlineFor(
  details: unknown,
  scoreA?: number | null,
  scoreB?: number | null,
): { a: string; b: string } {
  if (isResultDetails(details) && details.kind === 'CRICKET')
    return { a: inningsLine(details.innings.A), b: inningsLine(details.innings.B) };
  if (isResultDetails(details) && details.kind === 'CHESS')
    return { a: formatHalf(scoreA ?? 0), b: formatHalf(scoreB ?? 0) };
  return { a: String(scoreA ?? 0), b: String(scoreB ?? 0) };
}

/**
 * Usual battle-royale placement points, used only to pre-fill the entry form
 * (the coordinator can override every value). Kill points default to 1 per kill.
 */
export const PLACEMENT_POINTS: Record<'Free Fire' | 'BGMI', number[]> = {
  'Free Fire': [12, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0],
  BGMI: [15, 12, 10, 8, 6, 4, 2, 1, 0, 0, 0, 0],
};
export function suggestedPlacementPoints(game: 'Free Fire' | 'BGMI', rank: number | null): number {
  return rank && rank >= 1 ? (PLACEMENT_POINTS[game][rank - 1] ?? 0) : 0;
}
