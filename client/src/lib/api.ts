export const getApiBaseUrl = (): string => {
  const envUrl =
    (typeof window === 'undefined' ? process.env.API_INTERNAL_URL : undefined) ||
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window === 'undefined' ? 'http://127.0.0.1:4000/api' : '/api');
  return envUrl.endsWith('/api') ? envUrl : `${envUrl.replace(/\/+$/, '')}/api`;
};

const API_BASE = getApiBaseUrl();

export interface Sport {
  scoringMode?: 'LIVE' | 'RESULT_ONLY';
  id: string;
  name: string;
  description: string | null;
  status: string;
  _count?: {
    teams: number;
  };
}

export interface Venue {
  latitude?: number | null;
  longitude?: number | null;
  simultaneousMatches?: number;
  id: string;
  name: string;
  location: string | null;
  status: string;
  zone?: string;
  surface?: string;
  description?: string;
  /** Percentage (0-100) position on the interactive campus map, if placed. */
  mapX?: number | null;
  mapY?: number | null;
}

export interface Institute {
  id: string;
  name: string;
  shortName: string | null;
  city: string | null;
  state: string | null;
  status?: string;
  logoUrl?: string | null;
  _count?: {
    teams: number;
    participants: number;
  };
}

export interface Team {
  id: string;
  name: string;
  status?: string;
  instituteId?: string;
  sportId?: string;
  institute?: {
    id?: string;
    name: string;
    shortName: string | null;
    logoUrl?: string | null;
  };
  sport?: {
    id?: string;
    name: string;
  };
  _count?: {
    members: number;
  };
}

export interface Match {
  nextMatchId?: string | null;
  scoringMode?: 'LIVE' | 'RESULT_ONLY';
  id: string;
  matchNumber: string | null;
  status: string;
  currentPeriod: string | null;
  /** Whether this match is flagged for the public Live Arena feed — set via Match Manager. */
  isTelecast?: boolean;
  scheduledStartTime: string;
  scheduledEndTime: string | null;
  teamAScore: number | null;
  teamBScore: number | null;
  teamAId?: string | null;
  teamBId?: string | null;
  winnerTeamId?: string | null;
  scoreDetails?: Record<string, unknown> | null;
  teamA?: Team;
  teamB?: Team;
  venue?: {
    id: string;
    name: string;
    location: string | null;
  };
  tournament?: {
    id?: string;
    name: string;
    sport?: {
      id?: string;
      name: string;
    };
  };
  tournamentId?: string;
  stageId?: string | null;
  stage?: {
    id?: string;
    name?: string;
    sequence?: number;
  };
  officials?: MatchOfficial[];
}

export interface MatchOfficial {
  id: string;
  matchId?: string;
  userId?: string;
  role: string;
  user?: {
    id: string;
    name: string;
    email?: string;
  };
}

export interface EventSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
}

/**
 * Participant record as returned by the security/participants endpoints
 * (`server/src/modules/teams/participants.service.ts`). Covers athletes,
 * on-spot audience/guest registrations, and officials alike.
 */
export interface Participant {
  id: string;
  eventId: string;
  instituteId: string | null;
  name: string;
  photographUrl: string | null;
  idDocumentUrl: string | null;
  rollNumber: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  contactNumber: string | null;
  category: 'ATHLETE' | 'AUDIENCE' | 'GUEST' | 'OFFICIAL' | string;
  isCheckedIn: boolean;
  checkedInAt: string | null;
  currentVenueId?: string | null;
  currentVenue?: { id: string; name: string } | null;
  gatePassNumber: string | null;
  isFlagged?: boolean;
  flagReason?: string | null;
  flaggedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  institute?: { id?: string; name: string; shortName: string | null } | null;
  teamMembers?: {
    role?: string;
    team?: { name: string; sport?: { name: string } };
  }[];
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

export interface TournamentStage {
  id: string;
  name: string;
  sequence: number;
  stageType?: string;
  status?: string;
  matches?: Match[];
}

export interface TournamentSeed {
  id?: string;
  seedNumber: number;
  teamId: string;
  notes?: string | null;
  team?: Team;
}

export interface Tournament {
  rulesJson?: Record<string, unknown> | null;
  id: string;
  eventId?: string;
  name: string;
  format: string;
  status?: string;
  sportId?: string;
  sport?: { id: string; name: string };
  pointsForWin?: number;
  pointsForDraw?: number;
  pointsForLoss?: number;
  stages?: TournamentStage[];
  seeds?: TournamentSeed[];
  matches?: Match[];
  _count?: { matches: number };
}

export interface TeamStanding {
  teamId: string;
  teamName: string;
  instituteId: string;
  instituteName: string;
  instituteShortName: string | null;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  scoreFor: number;
  scoreAgainst: number;
  differential: number;
  points: number;
  rank: number;
}

/**
 * Derives a short 2-4 letter uppercase badge code from a team/institute name
 * when no explicit short code is available from the API (e.g. "IIT Jammu
 * Football" -> "IJF", "GCET Jammu" -> "GJ").
 */
export function teamCodeFromName(name?: string | null): string {
  if (!name) return 'TBD';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 4);
  }
  const letters = name.replace(/[^A-Za-z]/g, '');
  return letters.slice(0, 4).toUpperCase() || 'TBD';
}

interface RawMedalTallyItem {
  rank?: number;
  instituteId?: string;
  instituteName?: string;
  shortName?: string | null;
  gold?: number;
  silver?: number;
  bronze?: number;
  points?: number;
  totalPoints?: number;
  isHost?: boolean;
}

export interface MedalTallyRow {
  rank: number;
  instituteId: string;
  instituteName: string;
  instituteCode: string;
  gold: number;
  silver: number;
  bronze: number;
  totalPoints: number;
  isHost?: boolean;
}

export async function apiGet<T = unknown>(endpoint: string): Promise<T> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return await res.json();
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Session-authenticated request helper. Sends the session cookie
 * (`credentials: 'include'`) and never caches, since every call here
 * is either a mutation or reads viewer-specific/live organizer data.
 */
async function authedRequest<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  endpoint: string,
  body?: unknown,
): Promise<T> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const res = await fetch(url, {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String(
            (payload as { message?: unknown }).message ??
              `Request failed with status ${res.status}`,
          )
        : `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message);
  }

  return payload as T;
}

export function apiAuthedGet<T = unknown>(endpoint: string): Promise<T> {
  return authedRequest<T>('GET', endpoint);
}

export function apiPost<T = unknown>(endpoint: string, body?: unknown): Promise<T> {
  return authedRequest<T>('POST', endpoint, body);
}

export function apiPatch<T = unknown>(endpoint: string, body?: unknown): Promise<T> {
  return authedRequest<T>('PATCH', endpoint, body);
}

export function apiDelete<T = unknown>(endpoint: string): Promise<T> {
  return authedRequest<T>('DELETE', endpoint);
}

export async function fetchSports(): Promise<Sport[]> {
  try {
    const res = await fetch(`${API_BASE}/sports`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchVenues(): Promise<Venue[]> {
  try {
    const res = await fetch(`${API_BASE}/venues`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchMatches(): Promise<Match[]> {
  try {
    const res = await fetch(`${API_BASE}/matches`, { cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Resolves the current live/active event's id, matching how the seed data
 * creates a single "convoquer-26" ACTIVE event. Returns null if none is
 * found or the request fails. Public/unauthenticated endpoint.
 */
export interface SiteSettings {
  logoUrl: string | null;
}

export interface MediaAsset {
  id: string;
  slot: string;
  title: string;
  category: string;
  caption: string;
  imageUrl: string;
  aspect: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedBy?: string;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string | null;
}

export async function fetchPublishedMedia(slot: string): Promise<MediaAsset[]> {
  try {
    const res = await fetch(`${API_BASE}/media-assets/published?slot=${encodeURIComponent(slot)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchSiteSettings(): Promise<SiteSettings> {
  try {
    const res = await fetch(`${API_BASE}/site-settings`, { next: { revalidate: 60 } });
    if (!res.ok) return { logoUrl: null };
    return await res.json();
  } catch {
    return { logoUrl: null };
  }
}

export async function fetchActiveEventId(): Promise<string | null> {
  try {
    const events = await apiGet<EventSummary[]>('/events?status=ACTIVE');
    return Array.isArray(events) && events.length > 0 ? events[0].id : null;
  } catch {
    return null;
  }
}

function formatInstituteCode(shortName: string | null | undefined, name?: string): string {
  if (shortName) {
    const letters = shortName.replace(/[^a-zA-Z]/g, '');
    if (letters.length <= 4) return letters.toUpperCase();
    const words = shortName.trim().split(/\s+/);
    if (words.length > 1) {
      return (words[0] + words[1][0]).toUpperCase().slice(0, 4);
    }
    return letters.slice(0, 4).toUpperCase();
  }
  if (name) {
    const words = name.trim().split(/\s+/);
    if (words.length >= 3) {
      return words
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 4);
    }
    return name.slice(0, 4).toUpperCase();
  }
  return 'INST';
}

// ===================================
// SCORING & RESULTS APPROVAL TYPES
// (used by scorer/page.tsx and results/approvals/page.tsx)
// ===================================

export interface ScoreEventItem {
  id: string;
  sequenceNumber: number;
  teamId: string | null;
  participantId?: string | null;
  eventType: string;
  points: number;
  metadata?: Record<string, unknown> | null;
  isReversed: boolean;
  reversalReason?: string | null;
  createdAt?: string;
  team?: { id: string; name: string } | null;
  participant?: { id: string; name: string; rollNumber?: string | null } | null;
}

/** Shape returned by GET /api/matches/:id/live */
export interface LiveMatchDetail extends Match {
  resultPublished?: boolean;
  scoreDetails?: Record<string, unknown> | null;
  scoreEvents?: ScoreEventItem[];
  winnerTeam?: { id: string; name: string } | null;
}

/** Shape returned by GET /api/matches/:id (full detail, includes rosters) */
export interface MatchFullDetail extends Match {
  teamA?: Team & {
    members?: {
      id: string;
      role: string;
      jerseyNumber: number | null;
      participant: { id: string; name: string; rollNumber: string | null };
    }[];
  };
  teamB?: Team & {
    members?: {
      id: string;
      role: string;
      jerseyNumber: number | null;
      participant: { id: string; name: string; rollNumber: string | null };
    }[];
  };
}

/** Shape returned by GET /api/dashboard/pending-approvals (Result rows awaiting review) */
export interface PendingResultItem {
  id: string;
  matchId: string;
  status: string;
  winnerTeamId: string | null;
  finalScoreA: number;
  finalScoreB: number;
  scoreDetails?: Record<string, unknown> | null;
  notes?: string | null;
  submittedAt?: string | null;
  match: {
    id: string;
    matchNumber: string | null;
    teamA?: Team | null;
    teamB?: Team | null;
    tournament?: { id: string; name: string; sport?: { id: string; name: string } };
    venue?: { name: string } | null;
  };
  submitter?: { id: string; name: string; email: string } | null;
}

export async function fetchMedalTally(eventId?: string): Promise<MedalTallyRow[]> {
  try {
    const url = eventId ? `${API_BASE}/events/${eventId}/medal-tally` : `${API_BASE}/medal-tally`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return (data as RawMedalTallyItem[]).map((item, idx) => ({
      rank: item.rank || idx + 1,
      instituteId: item.instituteId || `inst-${idx}`,
      instituteName: item.instituteName || 'Institute',
      instituteCode: formatInstituteCode(item.shortName, item.instituteName),
      gold: item.gold || 0,
      silver: item.silver || 0,
      bronze: item.bronze || 0,
      totalPoints:
        item.points ??
        item.totalPoints ??
        (item.gold || 0) * 5 + (item.silver || 0) * 3 + (item.bronze || 0),
      isHost:
        item.isHost ||
        item.instituteName?.toLowerCase().includes('iit jammu') ||
        item.shortName?.toLowerCase().includes('iit jammu'),
    }));
  } catch {
    return [];
  }
}
