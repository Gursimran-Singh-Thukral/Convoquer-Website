// Athletics events and E-Sports lobby games (Free Fire / BGMI) are played by
// every team in a single go, so their fixtures have no "Team A vs Team B".
// These helpers let every screen show the event itself instead of "TBD vs TBD".

export interface MatchLike {
  teamA?: unknown | null;
  teamB?: unknown | null;
  teamAId?: string | null;
  teamBId?: string | null;
  matchNumber?: string | null;
}

/** True for a fixture with no head-to-head sides (a one-go event). */
export const isTeamless = (m: MatchLike): boolean =>
  !m.teamA && !m.teamB && !m.teamAId && !m.teamBId;

/** The event name: "1500m (Reporting: 6:45 AM) — Men", "BGMI - Game 3". */
export const eventTitle = (m: MatchLike): string => (m.matchNumber ?? '').trim() || 'Event';

/** Short description of how a one-go event is played. */
export const eventSubtitle = (sportName?: string | null): string =>
  /athletics/i.test(sportName ?? '') ? 'All teams compete together' : 'All teams in one lobby';
