// Shared, sport-aware formatters for Match.scoreDetails — mirrors the shapes
// produced by server/src/modules/scoring/engines/*.ts. Every consumer (the
// scorer console, /live, the homepage ticker) reads through these so they
// can't drift out of sync with the actual engine output.

export interface MatchLike {
  teamAId?: string | null;
  teamBId?: string | null;
  teamAScore?: number | null;
  teamBScore?: number | null;
  currentPeriod?: string | null;
  scoreDetails?: unknown;
  tournament?: { sport?: { name?: string } | null } | null;
}

interface CricketInnings {
  battingTeamId: string;
  runs: number;
  wickets: number;
  balls: number;
}
interface CricketDetails {
  innings?: CricketInnings[];
}
interface GameRecord {
  teamAPoints: number;
  teamBPoints: number;
  winnerTeamId: string | null;
}
interface SetsAndGamesDetails {
  games?: GameRecord[];
  gamesWon?: { teamA: number; teamB: number };
}
interface ChessDetails {
  pointsX2?: { teamA: number; teamB: number };
}
interface AthleticsDetails {
  unit?: string;
}

function sportName(match: MatchLike): string {
  return (match.tournament?.sport?.name || '').trim().toUpperCase();
}

function oversDisplay(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

/** Short line for a scoreboard/ticker, e.g. "IND 142/4 (16.2 ov)" or "2-1 (2nd Half)". */
export function formatScoreLine(match: MatchLike, teamAName = 'A', teamBName = 'B'): string {
  const sport = sportName(match);
  const d = (match.scoreDetails || {}) as CricketDetails &
    SetsAndGamesDetails &
    ChessDetails &
    AthleticsDetails;

  if (sport === 'CRICKET' && Array.isArray(d.innings) && d.innings.length) {
    const parts = d.innings.map((inn) => {
      const name = inn.battingTeamId === match.teamAId ? teamAName : teamBName;
      const wkt = inn.wickets >= 10 ? 'all out' : `${inn.wickets}`;
      return `${name} ${inn.runs}/${wkt} (${oversDisplay(inn.balls)} ov)`;
    });
    return parts.join(' · ');
  }

  if (['VOLLEYBALL', 'BADMINTON', 'TABLE TENNIS', 'SQUASH'].includes(sport) && d.gamesWon) {
    const setsLine = Array.isArray(d.games)
      ? d.games
          .filter((g) => g.winnerTeamId)
          .map((g) => `${g.teamAPoints}-${g.teamBPoints}`)
          .join(', ')
      : '';
    return `${teamAName} ${d.gamesWon.teamA}-${d.gamesWon.teamB} ${teamBName}${setsLine ? ` (${setsLine})` : ''}`;
  }

  if (sport === 'CHESS' && d.pointsX2) {
    const fmt = (x2: number) => (x2 % 2 === 0 ? String(x2 / 2) : `${(x2 - 1) / 2}½`);
    return `${teamAName} ${fmt(d.pointsX2.teamA)}-${fmt(d.pointsX2.teamB)} ${teamBName}`;
  }

  if (sport === 'WEIGHTLIFTING') {
    return `${teamAName} ${match.teamAScore ?? 0}kg — ${teamBName} ${match.teamBScore ?? 0}kg (Total)`;
  }

  if (sport === 'ATHLETICS') {
    const unit = d.unit || '';
    const val = (scaled: number | null | undefined) =>
      scaled != null ? (scaled / 100).toFixed(2) : '—';
    return `${teamAName} ${val(match.teamAScore)}${unit ? ` ${unit}` : ''} — ${teamBName} ${val(match.teamBScore)}${unit ? ` ${unit}` : ''}`;
  }

  // Football, basketball, and anything else not yet engine-tracked: plain running score.
  return `${teamAName} ${match.teamAScore ?? 0} - ${match.teamBScore ?? 0} ${teamBName}`;
}

/** Short status/period line, e.g. "16.2 ov (Innings 2)", "Set 3", "2nd Half". */
export function formatPeriod(match: MatchLike): string {
  return match.currentPeriod || '';
}

export interface TeamScoreDisplay {
  primary: string;
  secondary?: string;
}

/** Per-team headline + secondary score for a scoreboard card (as opposed to one combined line). */
export function formatTeamScores(match: MatchLike): {
  teamA: TeamScoreDisplay;
  teamB: TeamScoreDisplay;
} {
  const sport = sportName(match);
  const d = (match.scoreDetails || {}) as CricketDetails &
    SetsAndGamesDetails &
    ChessDetails &
    AthleticsDetails;

  if (sport === 'CRICKET' && Array.isArray(d.innings) && d.innings.length) {
    const forTeam = (teamId: string | null | undefined): TeamScoreDisplay => {
      const inn = d.innings!.find((i) => i.battingTeamId === teamId);
      if (!inn) return { primary: '—', secondary: 'Yet to bat' };
      const wkt = inn.wickets >= 10 ? 'all out' : inn.wickets;
      return {
        primary: String(inn.runs),
        secondary: `${wkt} wkts · ${oversDisplay(inn.balls)} ov`,
      };
    };
    return { teamA: forTeam(match.teamAId), teamB: forTeam(match.teamBId) };
  }

  if (['VOLLEYBALL', 'BADMINTON', 'TABLE TENNIS', 'SQUASH'].includes(sport) && d.gamesWon) {
    const currentGame = Array.isArray(d.games) ? d.games[d.games.length - 1] : null;
    const secondary = currentGame
      ? `${currentGame.teamAPoints}-${currentGame.teamBPoints} this game`
      : undefined;
    return {
      teamA: { primary: String(d.gamesWon.teamA ?? 0), secondary },
      teamB: { primary: String(d.gamesWon.teamB ?? 0), secondary },
    };
  }

  if (sport === 'CHESS' && d.pointsX2) {
    const fmt = (x2: number) => (x2 % 2 === 0 ? String(x2 / 2) : `${(x2 - 1) / 2}½`);
    return { teamA: { primary: fmt(d.pointsX2.teamA) }, teamB: { primary: fmt(d.pointsX2.teamB) } };
  }

  if (sport === 'WEIGHTLIFTING') {
    return {
      teamA: { primary: `${match.teamAScore ?? 0}`, secondary: 'kg Total' },
      teamB: { primary: `${match.teamBScore ?? 0}`, secondary: 'kg Total' },
    };
  }

  if (sport === 'ATHLETICS') {
    const unit = d.unit || '';
    const val = (scaled: number | null | undefined) =>
      scaled != null ? (scaled / 100).toFixed(2) : '—';
    return {
      teamA: { primary: val(match.teamAScore), secondary: unit },
      teamB: { primary: val(match.teamBScore), secondary: unit },
    };
  }

  return {
    teamA: { primary: String(match.teamAScore ?? 0) },
    teamB: { primary: String(match.teamBScore ?? 0) },
  };
}
