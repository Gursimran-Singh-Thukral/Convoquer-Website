'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FixtureResultEditor } from '@/components/FixtureResultEditor';
import { Footer } from '@/components/Footer';
import { Navbar } from '@/components/Navbar';
import { OrganizerNavRail } from '@/components/OrganizerNavRail';
import { LiveTickerRibbon } from '@/components/LiveTickerRibbon';
import { RequireOrganizer } from '@/components/RequireOrganizer';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/ToastProvider';
import {
  apiAuthedGet,
  apiPatch,
  apiPost,
  ApiError,
  teamCodeFromName,
  type Match,
  type LiveMatchDetail,
  type MatchFullDetail,
  type ScoreEventItem,
} from '@/lib/api';
import { formatTeamScores } from '@/lib/scoreDetails';

// ===================================
// SPORT-SPECIFIC SCORE EVENT BUTTONS
// (mirrors the event types each engine actually accepts —
//  server/src/modules/scoring/engines/*.ts — one catalog per sport, built to
//  that sport's real rules rather than one generic point-counter)
// ===================================

interface PromptField {
  key: string;
  question: string;
  default?: string;
  parseNumber?: boolean;
}

interface EventAction {
  label: string;
  eventType: string;
  prompts?: PromptField[];
  /** Values baked into the event's metadata that don't need a prompt (e.g. which discipline this button is for). */
  fixedMetadata?: Record<string, unknown>;
}

// Attributed to whichever team's column the officiator clicks.
const TEAM_EVENT_TYPES: Record<string, EventAction[]> = {
  FOOTBALL: [
    { label: 'Goal', eventType: 'GOAL' },
    { label: 'Own Goal (credits opponent)', eventType: 'OWN_GOAL' },
    { label: 'Yellow Card', eventType: 'YELLOW_CARD' },
    { label: 'Red Card', eventType: 'RED_CARD' },
  ],
  BASKETBALL: [
    { label: 'Free Throw (+1)', eventType: 'FREE_THROW' },
    { label: 'Two Pointer (+2)', eventType: 'TWO_POINTS' },
    { label: 'Three Pointer (+3)', eventType: 'THREE_POINTS' },
    { label: 'Foul', eventType: 'FOUL' },
  ],
  CRICKET: [
    {
      label: 'Runs',
      eventType: 'RUN',
      prompts: [
        { key: 'runs', question: 'Runs off this ball (0-6):', default: '1', parseNumber: true },
      ],
    },
    {
      label: 'Wide',
      eventType: 'WIDE',
      prompts: [
        {
          key: 'runs',
          question: 'Extra runs run on the wide (default 0):',
          default: '0',
          parseNumber: true,
        },
      ],
    },
    {
      label: 'No Ball',
      eventType: 'NO_BALL',
      prompts: [
        {
          key: 'runs',
          question: 'Runs off the bat on the no-ball (default 0):',
          default: '0',
          parseNumber: true,
        },
      ],
    },
    {
      label: 'Bye',
      eventType: 'BYE',
      prompts: [
        { key: 'runs', question: 'Bye runs (default 1):', default: '1', parseNumber: true },
      ],
    },
    {
      label: 'Leg Bye',
      eventType: 'LEG_BYE',
      prompts: [
        { key: 'runs', question: 'Leg bye runs (default 1):', default: '1', parseNumber: true },
      ],
    },
    {
      label: 'Wicket',
      eventType: 'WICKET',
      prompts: [
        {
          key: 'runs',
          question: 'Runs completed before the dismissal (default 0):',
          default: '0',
          parseNumber: true,
        },
      ],
    },
    { label: 'Start Innings (this team bats)', eventType: 'START_INNINGS' },
  ],
  VOLLEYBALL: [{ label: 'Point', eventType: 'POINT' }],
  BADMINTON: [{ label: 'Point', eventType: 'POINT' }],
  'TABLE TENNIS': [{ label: 'Point', eventType: 'POINT' }],
  SQUASH: [{ label: 'Point', eventType: 'POINT' }],
  ATHLETICS: [
    {
      label: 'Record Attempt',
      eventType: 'RECORD_ATTEMPT',
      prompts: [
        {
          key: 'value',
          question: 'Time (seconds) or distance/height (meters) for this attempt:',
          parseNumber: true,
        },
      ],
    },
  ],
  WEIGHTLIFTING: [
    {
      label: 'Snatch Attempt',
      eventType: 'ATTEMPT',
      fixedMetadata: { discipline: 'SNATCH' },
      prompts: [
        { key: 'weightKg', question: 'Snatch attempt weight (kg):', parseNumber: true },
        { key: 'success', question: 'Successful lift? Enter YES or NO:', default: 'YES' },
      ],
    },
    {
      label: 'Clean & Jerk Attempt',
      eventType: 'ATTEMPT',
      fixedMetadata: { discipline: 'CLEAN_AND_JERK' },
      prompts: [
        { key: 'weightKg', question: 'Clean & Jerk attempt weight (kg):', parseNumber: true },
        { key: 'success', question: 'Successful lift? Enter YES or NO:', default: 'YES' },
      ],
    },
    {
      label: 'Set Bodyweight',
      eventType: 'SET_BODYWEIGHT',
      prompts: [
        {
          key: 'bodyWeightKg',
          question: 'Lifter bodyweight (kg), used only to break a tie:',
          parseNumber: true,
        },
      ],
    },
  ],
};

// Match-level actions with no single credited team (period/innings boundaries,
// a chess game result, etc.) — rendered as a separate control row.
const MATCH_CONTROL_TYPES: Record<string, EventAction[]> = {
  FOOTBALL: [{ label: 'End Period / Half', eventType: 'PERIOD_END' }],
  BASKETBALL: [{ label: 'End Quarter', eventType: 'PERIOD_END' }],
  CRICKET: [{ label: 'End Current Innings', eventType: 'END_INNINGS' }],
  CHESS: [
    {
      label: 'Record Game Result',
      eventType: 'GAME_RESULT',
      prompts: [
        { key: 'whiteTeamSide', question: 'Which side played White — enter A or B:', default: 'A' },
        { key: 'result', question: 'Result — enter WHITE, BLACK, or DRAW:', default: 'DRAW' },
        {
          key: 'reason',
          question:
            'Reason — CHECKMATE, RESIGNATION, TIMEOUT, DRAW_AGREEMENT, STALEMATE, THREEFOLD_REPETITION, or FIFTY_MOVE_RULE:',
          default: 'CHECKMATE',
        },
      ],
    },
  ],
};

const DEFAULT_EVENT_TYPES: EventAction[] = [{ label: 'Point (+1)', eventType: 'POINT' }];

function eventTypesForSport(sportName?: string): EventAction[] {
  if (!sportName) return DEFAULT_EVENT_TYPES;
  return TEAM_EVENT_TYPES[sportName.trim().toUpperCase()] || DEFAULT_EVENT_TYPES;
}

function matchControlsForSport(sportName?: string): EventAction[] {
  if (!sportName) return [];
  return MATCH_CONTROL_TYPES[sportName.trim().toUpperCase()] || [];
}

// ===================================
// FORMATTING HELPERS
// ===================================

function statusGroup(status: string): 'live' | 'upcoming' | 'completed' | 'other' {
  const s = (status || '').toUpperCase();
  if (s === 'LIVE' || s === 'PAUSED') return 'live';
  if (s === 'SCHEDULED' || s === 'RESCHEDULED') return 'upcoming';
  if (s === 'COMPLETED' || s === 'ABANDONED' || s === 'CANCELLED') return 'completed';
  return 'other';
}

function formatClock(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(key: string): string {
  const d = new Date(`${key}T00:00:00`);
  if (isNaN(d.getTime())) return key;
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function dayKeyOf(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? 'unknown' : d.toISOString().slice(0, 10);
}

function teamShort(
  team?: { name: string; institute?: { shortName: string | null } | null } | null,
): string {
  if (!team) return 'TBD';
  return teamCodeFromName(team.institute?.shortName || team.name);
}

export default function ScorerPage() {
  const { user, myScopedSportId, hasPermission, hasOfficialAssignments } = useAuth();
  const { confirm, promptText } = useToast();
  // A Sports Volunteer holds no sport-wide score.update/result.submit grant —
  // their only scoring authority comes from being tasked as a MatchOfficial on
  // specific matches (see ScoringService.verifyScoringAuthority), so their list
  // shows only those matches instead of the whole database.
  const canScoreBroadly = hasPermission('score.update') || hasPermission('result.submit');

  const [matches, setMatches] = useState<Match[]>([]);
  const [resultMatch, setResultMatch] = useState<Match | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [matchesError, setMatchesError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'upcoming' | 'completed'>(
    'all',
  );
  const [activeDayKey, setActiveDayKey] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Live scoring console
  const [consoleMatchId, setConsoleMatchId] = useState<string | null>(null);
  const [liveDetail, setLiveDetail] = useState<LiveMatchDetail | null>(null);
  const [liveDetailLoading, setLiveDetailLoading] = useState(false);
  const [liveDetailError, setLiveDetailError] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showManualOverride, setShowManualOverride] = useState(false);
  const [manualForm, setManualForm] = useState({
    teamAScore: '',
    teamBScore: '',
    currentPeriod: '',
    reason: '',
  });
  const [showCustomEvent, setShowCustomEvent] = useState(false);
  const [customEvent, setCustomEvent] = useState({ teamId: '', eventType: '', points: '' });

  // Roster modal
  const [rosterMatchId, setRosterMatchId] = useState<string | null>(null);
  const [rosterDetail, setRosterDetail] = useState<MatchFullDetail | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);

  // Match sheet modal (uses list data directly — already includes officials/venue/tournament)
  const [sheetMatch, setSheetMatch] = useState<Match | null>(null);

  const loadMatches = useCallback(async () => {
    setLoadingMatches(true);
    setMatchesError(null);
    try {
      // A Sports Coordinator scoped to a single sport defaults to seeing just
      // that sport's matches; a Convener/Overall Coordinator (global) and a
      // Sports Volunteer (no sport-wide grant at all — scoped per match via
      // MatchOfficial instead) both see the unfiltered list.
      const scopedSportId = myScopedSportId('competition.manage', 'match.update', 'score.update');
      const qs = scopedSportId ? `?sportId=${encodeURIComponent(scopedSportId)}` : '';
      const data = await apiAuthedGet<Match[]>(`/matches${qs}`);
      setMatches(Array.isArray(data) ? data : []);
    } catch (err) {
      setMatchesError(
        err instanceof ApiError
          ? err.message
          : 'Failed to load matches. Check your connection and try again.',
      );
    } finally {
      setLoadingMatches(false);
    }
  }, [myScopedSportId]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) loadMatches();
    });
    return () => {
      cancelled = true;
    };
  }, [loadMatches]);

  // Scoped to just this user's officiated matches when they have no broader
  // scoring authority — computed once up front so every downstream count/list
  // (day tabs, live/upcoming/completed counts, search) reflects only what they
  // can actually score, not the whole database.
  const myMatches = useMemo(() => {
    if (canScoreBroadly) return matches;
    return matches.filter((m) => m.officials?.some((o) => o.userId === user?.id));
  }, [matches, canScoreBroadly, user?.id]);

  const dayGroups = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of myMatches) {
      const key = dayKeyOf(m.scheduledStartTime);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [myMatches]);

  const filteredMatches = useMemo(() => {
    return myMatches
      .filter((m) => {
        if (activeDayKey !== 'ALL' && dayKeyOf(m.scheduledStartTime) !== activeDayKey) return false;
        if (statusFilter !== 'all' && statusGroup(m.status) !== statusFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const hay = [
            m.matchNumber,
            m.teamA?.name,
            m.teamB?.name,
            m.tournament?.sport?.name,
            m.tournament?.name,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime(),
      );
  }, [myMatches, activeDayKey, statusFilter, searchQuery]);

  const liveCount = myMatches.filter((m) => statusGroup(m.status) === 'live').length;
  const upcomingCount = myMatches.filter((m) => statusGroup(m.status) === 'upcoming').length;
  const completedCount = myMatches.filter((m) => statusGroup(m.status) === 'completed').length;

  // ===================================
  // LIVE SCORING CONSOLE
  // ===================================

  const loadLiveDetail = useCallback(async (matchId: string) => {
    setLiveDetailLoading(true);
    setLiveDetailError(null);
    try {
      const data = await apiAuthedGet<LiveMatchDetail>(`/matches/${matchId}/live`);
      if (data.scoringMode === 'RESULT_ONLY') {
        setResultMatch(data);
        setConsoleMatchId(null);
        return;
      }
      setLiveDetail(data);
      setManualForm({
        teamAScore: String(data.teamAScore ?? 0),
        teamBScore: String(data.teamBScore ?? 0),
        currentPeriod: data.currentPeriod ?? '',
        reason: '',
      });
    } catch (err) {
      setLiveDetailError(
        err instanceof ApiError ? err.message : 'Failed to load live match state.',
      );
    } finally {
      setLiveDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const matchId = new URLSearchParams(window.location.search).get('matchId');
    if (!matchId || !/^[0-9a-f-]{36}$/i.test(matchId)) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        setConsoleMatchId(matchId);
        void loadLiveDetail(matchId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadLiveDetail]);

  const openConsole = (matchId: string) => {
    setConsoleMatchId(matchId);
    setActionError(null);
    setShowManualOverride(false);
    setShowCustomEvent(false);
    setLiveDetail(null);
    loadLiveDetail(matchId);
  };

  const closeConsole = () => {
    setConsoleMatchId(null);
    setLiveDetail(null);
    setLiveDetailError(null);
    setActionError(null);
    setActionKey(null);
  };

  const runAction = useCallback(
    async (key: string, fn: () => Promise<unknown>, opts?: { refreshList?: boolean }) => {
      if (!consoleMatchId) return;
      setActionKey(key);
      setActionError(null);
      try {
        await fn();
        await loadLiveDetail(consoleMatchId);
        if (opts?.refreshList) {
          loadMatches();
        }
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : 'Action failed. Please try again.');
      } finally {
        setActionKey(null);
      }
    },
    [consoleMatchId, loadLiveDetail, loadMatches],
  );

  const handleStart = () => {
    runAction('start', () => apiPost(`/matches/${consoleMatchId}/start`, {}), {
      refreshList: true,
    });
  };

  const handlePause = async () => {
    const reason = await promptText('Reason for pausing the match (optional):');
    runAction(
      'pause',
      () => apiPost(`/matches/${consoleMatchId}/pause`, reason ? { reason } : {}),
      { refreshList: true },
    );
  };

  const handleResume = () => {
    runAction('resume', () => apiPost(`/matches/${consoleMatchId}/resume`, {}), {
      refreshList: true,
    });
  };

  const handleEnd = async () => {
    if (
      !(await confirm('End this match now? This locks live scoring and finalizes the match state.'))
    )
      return;
    runAction('end', () => apiPost(`/matches/${consoleMatchId}/end`, {}), { refreshList: true });
  };

  const handleRecordEvent = (
    teamId: string | undefined,
    eventType: string,
    extra?: { points?: number; metadata?: Record<string, unknown> },
  ) => {
    if (!consoleMatchId) return;
    runAction(`event-${teamId || 'match'}-${eventType}`, () =>
      apiPost(`/matches/${consoleMatchId}/score-events`, {
        requestId: crypto.randomUUID(),
        ...(teamId ? { teamId } : {}),
        eventType,
        ...(extra?.points !== undefined ? { points: extra.points } : {}),
        ...(extra?.metadata ? { metadata: extra.metadata } : {}),
        ...(liveDetail?.currentPeriod ? { period: liveDetail.currentPeriod } : {}),
      }),
    );
  };

  // Collects each prompt field in order (cancel at any step aborts the whole
  // event) and merges the results into a metadata object — this is what
  // drives every sport-specific event that needs more than just "which team".
  const collectPromptMetadata = async (
    prompts?: PromptField[],
  ): Promise<Record<string, unknown> | null> => {
    if (!prompts || !prompts.length) return {};
    const metadata: Record<string, unknown> = {};
    for (const field of prompts) {
      const answer = await promptText(field.question, field.default);
      if (answer === null) return null; // cancelled
      metadata[field.key] = field.parseNumber ? Number(answer) : answer;
    }
    return metadata;
  };

  const normalizeMetadata = (metadata: Record<string, unknown>): Record<string, unknown> => {
    const normalized = { ...metadata };
    if (typeof normalized.success === 'string') normalized.success = /^y/i.test(normalized.success);
    if (
      'value' in normalized &&
      typeof normalized.value === 'number' &&
      Number.isNaN(normalized.value)
    ) {
      delete normalized.value;
      normalized.disqualified = true;
    }
    return normalized;
  };

  const handleEventButtonClick = async (teamId: string, action: EventAction) => {
    const prompted = await collectPromptMetadata(action.prompts);
    if (prompted === null) return; // user cancelled a prompt
    const metadata = normalizeMetadata({ ...action.fixedMetadata, ...prompted });
    handleRecordEvent(
      teamId,
      action.eventType,
      Object.keys(metadata).length ? { metadata } : undefined,
    );
  };

  const handleMatchControlClick = async (action: EventAction) => {
    if (action.eventType === 'GAME_RESULT') {
      const raw = await collectPromptMetadata(action.prompts);
      if (raw === null || !liveDetail?.teamA || !liveDetail?.teamB) return;
      const whiteTeamId =
        String(raw.whiteTeamSide).trim().toUpperCase() === 'B'
          ? liveDetail.teamB.id
          : liveDetail.teamA.id;
      handleRecordEvent(undefined, 'GAME_RESULT', {
        metadata: {
          whiteTeamId,
          result: String(raw.result).trim().toUpperCase(),
          reason: String(raw.reason).trim().toUpperCase(),
        },
      });
      return;
    }
    const metadata = await collectPromptMetadata(action.prompts);
    if (metadata === null) return;
    handleRecordEvent(
      undefined,
      action.eventType,
      Object.keys(metadata).length ? { metadata } : undefined,
    );
  };

  const handleReverseEvent = async (eventId: string) => {
    const reason = await promptText('Reason for reversing this score event (required):');
    if (!reason || !reason.trim()) return;
    runAction(`reverse-${eventId}`, () =>
      apiPost(`/matches/${consoleMatchId}/score-events/${eventId}/reverse`, {
        reason: reason.trim(),
      }),
    );
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.reason.trim()) {
      setActionError('A reason is required for manual score corrections.');
      return;
    }
    const body: Record<string, unknown> = { reason: manualForm.reason.trim() };
    if (manualForm.teamAScore !== '') body.teamAScore = Number(manualForm.teamAScore);
    if (manualForm.teamBScore !== '') body.teamBScore = Number(manualForm.teamBScore);
    if (manualForm.currentPeriod.trim()) body.currentPeriod = manualForm.currentPeriod.trim();
    runAction('manual', () => apiPatch(`/matches/${consoleMatchId}/score-manual`, body), {
      refreshList: true,
    });
  };

  const handleCustomEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEvent.teamId || !customEvent.eventType.trim()) {
      setActionError('Select a team and enter an event type to record a custom event.');
      return;
    }
    const pointsTrim = customEvent.points.trim();
    const points = pointsTrim === '' ? undefined : Number(pointsTrim);
    handleRecordEvent(
      customEvent.teamId,
      customEvent.eventType.trim().toUpperCase(),
      points !== undefined ? { points } : undefined,
    );
    setCustomEvent((prev) => ({ ...prev, eventType: '', points: '' }));
  };

  // ===================================
  // ROSTER MODAL
  // ===================================

  const openRoster = async (matchId: string) => {
    setRosterMatchId(matchId);
    setRosterDetail(null);
    setRosterError(null);
    setRosterLoading(true);
    try {
      const data = await apiAuthedGet<MatchFullDetail>(`/matches/${matchId}`);
      setRosterDetail(data);
    } catch (err) {
      setRosterError(err instanceof ApiError ? err.message : 'Failed to load roster.');
    } finally {
      setRosterLoading(false);
    }
  };

  const closeRoster = () => {
    setRosterMatchId(null);
    setRosterDetail(null);
    setRosterError(null);
  };

  // ===================================
  // DERIVED CONSOLE STATE
  // ===================================

  const consoleStatus = (liveDetail?.status || '').toUpperCase();
  const canStart = consoleStatus === 'SCHEDULED' || consoleStatus === 'RESCHEDULED';
  const canPause = consoleStatus === 'LIVE';
  const canResume = consoleStatus === 'PAUSED';
  const canEnd = consoleStatus === 'LIVE' || consoleStatus === 'PAUSED';
  const canRecordEvents = consoleStatus === 'LIVE';
  const eventButtons = eventTypesForSport(liveDetail?.tournament?.sport?.name);
  const matchControls = matchControlsForSport(liveDetail?.tournament?.sport?.name);
  const visibleEvents: ScoreEventItem[] = (liveDetail?.scoreEvents || []).filter(
    (ev) => !ev.isReversed,
  );
  const liveTeamScores = liveDetail ? formatTeamScores(liveDetail) : null;

  return (
    <RequireOrganizer
      anyPermission={['score.update', 'result.submit']}
      extraAllowed={hasOfficialAssignments}
    >
      <div className="min-h-screen flex flex-col bg-[#121114] text-[#E8E6EB] selection:bg-[#FFD700] selection:text-black font-sans">
        <LiveTickerRibbon />
        <Navbar />
        <OrganizerNavRail />

        {/* Field-Side Scorer Portal Header */}
        <div className="w-full bg-[#121114] border-b border-[#FFD700]/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded bg-[#800020]/40 border border-[#800020] text-[#FFD700] font-black uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                FIELD CONSOLE READY
              </span>
              <span className="text-neutral-400 hidden sm:inline">•</span>
              <span className="text-neutral-300 font-mono hidden sm:inline">
                TERMINAL #FS-SEC-04
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-mono text-neutral-400 text-[10px]">SCORER:</span>
                <span className="font-bold text-white tracking-wide text-[11px]">
                  {user?.name || 'Loading...'}
                </span>
              </div>
              <Link
                href="/organizer"
                className="px-3 py-1.5 rounded-lg bg-[#800020] hover:bg-[#990026] text-white font-bold text-xs uppercase tracking-wider transition-colors border border-[#800020]/60 flex items-center gap-1.5"
              >
                <svg
                  className="w-3.5 h-3.5 text-[#FFD700]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                <span>Convener Overview</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="w-full flex-1 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
            {/* Section Title */}
            <div className="flex flex-col md:flex-row md:items-end justify-between pb-6 border-b border-white/10 gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-[#FFD700] tracking-widest uppercase mb-1">
                  <span>CONVOQUER&apos;26 OFFICIAL PROTOCOL</span>
                  <span>•</span>
                  <span>MATCH SCORING DESK</span>
                </div>
                <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white">
                  MATCH <span className="text-[#FFD700]">SCORING CONSOLE</span>
                </h1>
                <p className="text-sm text-neutral-400 mt-1 font-medium">
                  Authorized field-side scorekeeping console •{' '}
                  {loadingMatches ? 'Loading fixtures…' : `${myMatches.length} fixtures visible`}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => loadMatches()}
                  disabled={loadingMatches}
                  className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center gap-2 text-xs font-mono text-neutral-300 disabled:opacity-50"
                >
                  <svg
                    className={`w-3.5 h-3.5 ${loadingMatches ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>

            {matchesError && (
              <div className="mt-4 p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-sm">
                {matchesError}
              </div>
            )}

            {/* Quick Day Tabs, Status Filters & Search */}
            <div className="flex flex-col gap-4 py-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {/* Day Selector (derived from real fixture dates) */}
                <div className="flex items-center gap-1.5 bg-[#17171a] p-1 rounded-xl border border-white/10 overflow-x-auto max-w-full">
                  <button
                    onClick={() => setActiveDayKey('ALL')}
                    className={`px-3.5 sm:px-4 py-2 rounded-lg font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 whitespace-nowrap ${
                      activeDayKey === 'ALL'
                        ? 'bg-[#FFD700] text-black shadow-sm'
                        : 'text-neutral-400 hover:text-white font-semibold'
                    }`}
                  >
                    <span>ALL DAYS</span>
                    <span
                      className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-mono font-black ${activeDayKey === 'ALL' ? 'bg-black text-[#FFD700]' : 'text-neutral-500'}`}
                    >
                      {myMatches.length}
                    </span>
                  </button>
                  {dayGroups.map(([key, dayMatches], idx) => {
                    const isActive = activeDayKey === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveDayKey(key)}
                        className={`px-3.5 sm:px-4 py-2 rounded-lg font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 whitespace-nowrap ${
                          isActive
                            ? 'bg-[#FFD700] text-black shadow-sm'
                            : 'text-neutral-400 hover:text-white font-semibold'
                        }`}
                      >
                        <span>
                          DAY {idx + 1} · {formatDateShort(key)}
                        </span>
                        <span
                          className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-mono font-black ${isActive ? 'bg-black text-[#FFD700]' : 'text-neutral-500'}`}
                        >
                          {dayMatches.length}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Status Filter Badges */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 max-w-full">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-colors whitespace-nowrap ${
                      statusFilter === 'all'
                        ? 'bg-white/20 text-white font-bold'
                        : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    All ({myMatches.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('live')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                      statusFilter === 'live'
                        ? 'bg-[#FF4500] text-white shadow-md'
                        : 'bg-[#FF4500]/20 text-[#ff9478] border border-[#FF4500]/40 hover:bg-[#FF4500]/30'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                    Live ({liveCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter('upcoming')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs tracking-wide transition-colors whitespace-nowrap ${
                      statusFilter === 'upcoming'
                        ? 'bg-white/20 text-white font-bold'
                        : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    Upcoming ({upcomingCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter('completed')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs tracking-wide transition-colors whitespace-nowrap ${
                      statusFilter === 'completed'
                        ? 'bg-white/20 text-white font-bold'
                        : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    Completed ({completedCount})
                  </button>
                </div>
              </div>

              {/* Search box to find an assigned match */}
              <div className="relative max-w-md">
                <svg
                  className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by team, fixture code, or sport…"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#17171a] border border-white/10 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#FFD700]/50"
                />
              </div>
            </div>

            {/* Matches List */}
            <div className="space-y-6">
              {loadingMatches && matches.length === 0 && (
                <div className="p-12 rounded-2xl bg-[#17171a] border border-white/10 text-center text-neutral-400">
                  <p className="text-base font-semibold">Loading fixtures…</p>
                </div>
              )}

              {!loadingMatches &&
                filteredMatches.length === 0 &&
                myMatches.length === 0 &&
                !canScoreBroadly && (
                  <div className="p-12 rounded-2xl bg-[#17171a] border border-white/10 text-center text-neutral-400">
                    <p className="text-base font-semibold">
                      You haven&apos;t been assigned to score any match yet.
                    </p>
                    <p className="text-sm mt-1">
                      A Sports Coordinator assigns scoring duty by linking a task to a specific
                      match — check My Tasks on your dashboard.
                    </p>
                  </div>
                )}

              {!loadingMatches &&
                filteredMatches.length === 0 &&
                (myMatches.length > 0 || canScoreBroadly) && (
                  <div className="p-12 rounded-2xl bg-[#17171a] border border-white/10 text-center text-neutral-400">
                    <p className="text-base font-semibold">
                      No matches match the selected filter criteria.
                    </p>
                    <button
                      onClick={() => {
                        setActiveDayKey('ALL');
                        setStatusFilter('all');
                        setSearchQuery('');
                      }}
                      className="mt-3 px-4 py-2 rounded-lg bg-[#FFD700] text-black font-bold text-xs uppercase"
                    >
                      Reset Filters
                    </button>
                  </div>
                )}

              {filteredMatches.map((match) => {
                const group = statusGroup(match.status);
                const officialsNote =
                  match.officials && match.officials.length > 0
                    ? `Officials: ${match.officials.map((o) => `${o.user?.name || 'Unassigned'} (${o.role})`).join(', ')}`
                    : 'No officials assigned to this fixture yet';

                if (match.scoringMode === 'RESULT_ONLY')
                  return (
                    <article
                      key={match.id}
                      data-match-id={match.id}
                      className="rounded-2xl bg-[#17171a] border border-white/15 p-6 space-y-4"
                    >
                      <p className="text-[#FFD700]">
                        {match.tournament?.sport?.name} · Results only · {match.status}
                      </p>
                      <h3 className="font-bold text-xl">
                        {match.teamA?.name || 'TBD'} vs {match.teamB?.name || 'TBD'}
                      </h3>
                      <p>{new Date(match.scheduledStartTime).toLocaleString()}</p>
                      <button
                        type="button"
                        className="bg-[#800020] rounded px-4 py-3"
                        onClick={() => setResultMatch(match)}
                      >
                        Enter final result
                      </button>
                    </article>
                  );
                if (group === 'live') {
                  return (
                    /* LIVE MATCH HERO */
                    <div
                      key={match.id}
                      className="relative rounded-2xl bg-gradient-to-b from-[#1c1a1f] to-[#121114] border-2 border-[#FFD700]/70 p-6 sm:p-7 shadow-[0_12px_40px_rgba(0,0,0,0.6)] overflow-hidden"
                    >
                      <div className="absolute -right-20 -top-20 w-72 h-72 bg-[#FF4500]/10 rounded-full blur-3xl pointer-events-none"></div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-3 py-1 rounded-md bg-[#FF4500] text-white font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 shadow-md">
                            <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>●{' '}
                            {match.status.toUpperCase()}
                            {match.currentPeriod ? ` · ${match.currentPeriod}` : ''}
                          </span>
                          <span className="px-2.5 py-1 rounded bg-black/50 border border-white/10 text-white font-bold text-xs uppercase tracking-wider">
                            {match.tournament?.sport?.name || 'SPORT'} ·{' '}
                            {match.stage?.name || match.tournament?.name || ''}
                          </span>
                        </div>
                        <span className="px-3 py-0.5 rounded bg-[#FFD700]/10 text-[#FFD700] text-xs font-extrabold uppercase tracking-widest border border-[#FFD700]/40">
                          {match.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="text-xs text-neutral-300 pt-3 flex flex-wrap items-center gap-2 font-medium">
                        <svg
                          className="w-4 h-4 text-[#FFD700] shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span>
                          {match.venue?.name || 'Venue TBD'} • {match.venue?.location || ''}
                        </span>
                        <span className="text-neutral-600 hidden sm:inline">•</span>
                        <span className="font-mono text-neutral-400">
                          FIXTURE #{match.matchNumber || match.id.slice(0, 8)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center my-6">
                        <div className="md:col-span-5 bg-black/50 rounded-xl p-4 sm:p-5 border border-white/10 flex items-center justify-between">
                          <div className="flex items-center gap-3.5">
                            <div className="w-14 h-14 rounded-lg bg-[#800020] text-white font-black text-xl flex items-center justify-center border border-white/15 shadow-inner">
                              {teamShort(match.teamA)}
                            </div>
                            <div>
                              <h3 className="text-xl font-black text-white uppercase tracking-tight">
                                {match.teamA?.name || 'TBD'}
                              </h3>
                              <span className="inline-block text-[11px] font-bold text-[#FFD700] tracking-wide uppercase bg-[#FFD700]/10 px-2 py-0.5 rounded mt-0.5">
                                {match.teamA?.institute?.shortName || 'Institute TBD'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right pl-3">
                            <div className="font-mono text-5xl font-black text-[#FFD700]">
                              {formatTeamScores(match).teamA.primary}
                            </div>
                            {formatTeamScores(match).teamA.secondary && (
                              <div className="text-[10px] font-mono text-neutral-400">
                                {formatTeamScores(match).teamA.secondary}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="md:col-span-1 text-center py-2">
                          <span className="text-sm font-black text-[#f59e0b] tracking-wider uppercase">
                            VS
                          </span>
                        </div>

                        <div className="md:col-span-5 bg-black/50 rounded-xl p-4 sm:p-5 border border-white/10 flex items-center justify-between">
                          <div className="pr-3">
                            <div className="font-mono text-5xl font-black text-white">
                              {formatTeamScores(match).teamB.primary}
                            </div>
                            {formatTeamScores(match).teamB.secondary && (
                              <div className="text-[10px] font-mono text-neutral-400">
                                {formatTeamScores(match).teamB.secondary}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3.5 text-right">
                            <div>
                              <h3 className="text-xl font-black text-white uppercase tracking-tight">
                                {match.teamB?.name || 'TBD'}
                              </h3>
                              <span className="inline-block text-[11px] font-bold text-neutral-400 tracking-wide uppercase bg-white/5 px-2 py-0.5 rounded mt-0.5">
                                {match.teamB?.institute?.shortName || 'Institute TBD'}
                              </span>
                            </div>
                            <div className="min-w-14 px-2.5 h-14 rounded-lg bg-neutral-800 text-neutral-200 font-black text-xl flex items-center justify-center border border-white/15 shadow-inner tracking-tight">
                              {teamShort(match.teamB)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl bg-black/40 p-3.5 border border-white/10 text-xs text-neutral-300 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold text-[11px]">
                            OFFICIALS
                          </span>
                          <span className="font-medium text-neutral-200">{officialsNote}</span>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSheetMatch(match)}
                            className="px-3.5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors border border-white/10 active:scale-95"
                          >
                            <svg
                              className="w-4 h-4 text-[#FFD700]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            <span>Match Sheet</span>
                          </button>
                          <button
                            onClick={() => openRoster(match.id)}
                            className="px-3.5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors border border-white/10 active:scale-95"
                          >
                            <svg
                              className="w-4 h-4 text-emerald-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <span>Rosters</span>
                          </button>
                        </div>

                        <button
                          onClick={() => openConsole(match.id)}
                          className="h-12 px-7 rounded-xl hover:brightness-110 text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_6px_25px_rgba(255,69,0,0.4)] transition-all active:scale-95 border border-[#FF4500]/50 bg-[#FF4500]"
                        >
                          <span>OPEN LIVE SCORING CONSOLE</span>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M14 5l7 7m0 0l-7 7m7-7H3"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                }

                const isUpcoming = group === 'upcoming';
                return (
                  <div
                    key={match.id}
                    className="rounded-2xl bg-[#17171a] border border-white/10 p-6 shadow-md hover:border-white/20 transition-all"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 border ${
                            isUpcoming
                              ? 'bg-[#FFD700]/15 text-[#FFD700] border-[#FFD700]/30'
                              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          {isUpcoming
                            ? formatClock(match.scheduledStartTime) || 'Scheduled'
                            : match.status.toUpperCase()}
                        </span>
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          {match.tournament?.sport?.name || 'SPORT'} ·{' '}
                          {match.stage?.name || match.tournament?.name || ''}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-neutral-400 font-semibold">
                        {match.matchNumber || match.id.slice(0, 8)}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-4">
                      <div className="flex items-center gap-5">
                        <div>
                          <h4 className="text-lg font-black text-white uppercase tracking-tight">
                            {match.teamA?.name || 'TBD'}
                          </h4>
                          <span className="text-xs text-neutral-400 font-medium uppercase">
                            {match.teamA?.institute?.shortName || ''}
                          </span>
                          {group === 'completed' && (
                            <span className="block font-mono text-2xl font-black text-[#FFD700] mt-1">
                              {formatTeamScores(match).teamA.primary}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-black text-[#f59e0b] uppercase px-2">VS</span>
                        <div>
                          <h4 className="text-lg font-black text-white uppercase tracking-tight">
                            {match.teamB?.name || 'TBD'}
                          </h4>
                          <span className="text-xs text-neutral-400 font-medium uppercase">
                            {match.teamB?.institute?.shortName || ''}
                          </span>
                          {group === 'completed' && (
                            <span className="block font-mono text-2xl font-black text-white mt-1">
                              {formatTeamScores(match).teamB.primary}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="sm:text-right">
                        <div className="text-xs text-neutral-300 flex items-center sm:justify-end gap-1.5 font-medium">
                          <svg
                            className="w-3.5 h-3.5 text-[#FFD700]"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          <span>{match.venue?.name || 'Venue TBD'}</span>
                        </div>
                        <span className="text-xs text-[#FFD700] font-bold uppercase mt-1 block">
                          {match.venue?.location || ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
                      <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {officialsNote}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openRoster(match.id)}
                          className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-200 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors border border-white/10"
                        >
                          Rosters
                        </button>
                        <button
                          onClick={() =>
                            isUpcoming ? openConsole(match.id) : setSheetMatch(match)
                          }
                          className={`px-5 py-2 rounded-lg text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-sm ${
                            isUpcoming
                              ? 'bg-[#800020] hover:bg-[#990026]'
                              : 'bg-white/10 hover:bg-white/20'
                          }`}
                        >
                          {isUpcoming ? 'OPEN SCORING CONSOLE' : 'FIXTURE DETAILS & AUDIT'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
        {resultMatch && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div
              role="dialog"
              aria-label="Fixture final result"
              className="w-full max-w-lg max-h-[90vh] overflow-auto bg-[#18161b] rounded-xl p-6"
            >
              <button type="button" className="mb-4 underline" onClick={() => setResultMatch(null)}>
                Close result editor
              </button>
              <FixtureResultEditor match={resultMatch} onSaved={loadMatches} />
            </div>
          </div>
        )}

        {/* LIVE SCORING CONSOLE MODAL */}
        {consoleMatchId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <div className="w-full max-w-3xl my-8 bg-[#17161b] border-2 border-[#FFD700]/70 rounded-2xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div>
                  <span className="text-[10px] font-mono text-[#FFD700] uppercase tracking-widest block">
                    ACTIVE SCORER TERMINAL · #
                    {liveDetail?.matchNumber || consoleMatchId.slice(0, 8)}
                  </span>
                  <h3 className="text-xl font-black text-white uppercase">
                    {liveDetail?.tournament?.sport?.name || 'MATCH'} {liveDetail?.stage?.name || ''}{' '}
                    SCORING
                  </h3>
                  <span className="text-xs text-neutral-400 font-mono">
                    STATUS: {consoleStatus || '—'}
                  </span>
                </div>
                <button
                  onClick={closeConsole}
                  className="p-1 rounded-lg text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {liveDetailLoading && !liveDetail && (
                <div className="text-center py-10 text-neutral-400 text-sm">
                  Loading live match state…
                </div>
              )}
              {liveDetailError && (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs">
                  {liveDetailError}
                </div>
              )}
              {actionError && (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs">
                  {actionError}
                </div>
              )}

              {liveDetail && (
                <>
                  {/* Lifecycle Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleStart}
                      disabled={!canStart || actionKey !== null}
                      className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider"
                    >
                      {actionKey === 'start' ? 'Starting…' : 'Start Match'}
                    </button>
                    <button
                      onClick={handlePause}
                      disabled={!canPause || actionKey !== null}
                      className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider"
                    >
                      {actionKey === 'pause' ? 'Pausing…' : 'Pause'}
                    </button>
                    <button
                      onClick={handleResume}
                      disabled={!canResume || actionKey !== null}
                      className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider"
                    >
                      {actionKey === 'resume' ? 'Resuming…' : 'Resume'}
                    </button>
                    <button
                      onClick={handleEnd}
                      disabled={!canEnd || actionKey !== null}
                      className="px-3.5 py-2 rounded-lg bg-[#800020] hover:bg-[#990026] disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider"
                    >
                      {actionKey === 'end' ? 'Ending…' : 'End Match'}
                    </button>
                  </div>

                  {/* Score Display — sport-correct headline + detail (e.g. cricket: runs, "4 wkts · 16.2 ov") */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-black/50 border border-white/10 text-center space-y-1">
                      <span className="text-xs font-bold text-neutral-300 block uppercase">
                        {liveDetail.teamA?.name || 'Team A'}
                      </span>
                      <div className="text-5xl font-black font-mono text-[#FFD700]">
                        {liveTeamScores?.teamA.primary ?? liveDetail.teamAScore ?? 0}
                      </div>
                      {liveTeamScores?.teamA.secondary && (
                        <div className="text-[11px] font-mono text-neutral-400">
                          {liveTeamScores.teamA.secondary}
                        </div>
                      )}
                    </div>
                    <div className="p-4 rounded-xl bg-black/50 border border-white/10 text-center space-y-1">
                      <span className="text-xs font-bold text-neutral-300 block uppercase">
                        {liveDetail.teamB?.name || 'Team B'}
                      </span>
                      <div className="text-5xl font-black font-mono text-white">
                        {liveTeamScores?.teamB.primary ?? liveDetail.teamBScore ?? 0}
                      </div>
                      {liveTeamScores?.teamB.secondary && (
                        <div className="text-[11px] font-mono text-neutral-400">
                          {liveTeamScores.teamB.secondary}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Score Event Buttons */}
                  {canRecordEvents ? (
                    <div className="space-y-2">
                      {matchControls.length > 0 && (
                        <div className="p-3 rounded-lg bg-black/30 border border-[#FFD700]/20 space-y-1.5">
                          <span className="text-[11px] font-bold uppercase text-[#FFD700] block">
                            Match Controls
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {matchControls.map((ctrl) => (
                              <button
                                key={ctrl.eventType}
                                onClick={() => handleMatchControlClick(ctrl)}
                                disabled={actionKey !== null}
                                className="px-2.5 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wide bg-[#FFD700]/20 hover:bg-[#FFD700]/30 text-[#FFD700] border border-[#FFD700]/30 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                {actionKey === `event-match-${ctrl.eventType}`
                                  ? 'Sending…'
                                  : ctrl.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <span className="text-xs font-bold uppercase text-neutral-400 block">
                        Record Score Event
                      </span>
                      <div className="grid grid-cols-2 gap-3">
                        {[liveDetail.teamA, liveDetail.teamB].map((team, idx) =>
                          team ? (
                            <div
                              key={team.id}
                              className="p-3 rounded-lg bg-black/30 border border-white/5 space-y-1.5"
                            >
                              <span className="text-[11px] font-bold uppercase text-neutral-400 block">
                                {team.name}
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {eventButtons.map((btn) => (
                                  <button
                                    key={btn.eventType + btn.label}
                                    onClick={() => handleEventButtonClick(team.id, btn)}
                                    disabled={actionKey !== null}
                                    className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wide disabled:opacity-30 disabled:cursor-not-allowed ${
                                      idx === 0
                                        ? 'bg-[#800020] hover:bg-[#990026] text-white'
                                        : 'bg-neutral-700 hover:bg-neutral-600 text-white'
                                    }`}
                                  >
                                    {actionKey === `event-${team.id}-${btn.eventType}`
                                      ? 'Sending…'
                                      : btn.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null,
                        )}
                      </div>

                      <button
                        onClick={() => setShowCustomEvent((v) => !v)}
                        className="text-[11px] font-bold uppercase text-[#FFD700] hover:underline"
                      >
                        {showCustomEvent ? 'Hide' : '+ Other / Custom Event'}
                      </button>
                      {showCustomEvent && (
                        <form
                          onSubmit={handleCustomEventSubmit}
                          className="p-3 rounded-lg bg-black/30 border border-white/5 flex flex-wrap gap-2 items-end"
                        >
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-neutral-400 uppercase">Team</label>
                            <select
                              value={customEvent.teamId}
                              onChange={(e) =>
                                setCustomEvent((p) => ({ ...p, teamId: e.target.value }))
                              }
                              className="px-2 py-1.5 rounded bg-[#0e0e11] border border-white/10 text-xs text-white"
                            >
                              <option value="">Select team</option>
                              {liveDetail.teamA && (
                                <option value={liveDetail.teamA.id}>{liveDetail.teamA.name}</option>
                              )}
                              {liveDetail.teamB && (
                                <option value={liveDetail.teamB.id}>{liveDetail.teamB.name}</option>
                              )}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-neutral-400 uppercase">
                              Event Type
                            </label>
                            <input
                              value={customEvent.eventType}
                              onChange={(e) =>
                                setCustomEvent((p) => ({ ...p, eventType: e.target.value }))
                              }
                              placeholder="e.g. TRY, DISQUALIFICATION"
                              className="px-2 py-1.5 rounded bg-[#0e0e11] border border-white/10 text-xs text-white placeholder:text-neutral-600 w-44"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-neutral-400 uppercase">Points</label>
                            <input
                              value={customEvent.points}
                              onChange={(e) =>
                                setCustomEvent((p) => ({ ...p, points: e.target.value }))
                              }
                              placeholder="0"
                              type="number"
                              className="px-2 py-1.5 rounded bg-[#0e0e11] border border-white/10 text-xs text-white placeholder:text-neutral-600 w-20"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={actionKey !== null}
                            className="px-3 py-1.5 rounded bg-[#FFD700] text-black text-xs font-bold uppercase disabled:opacity-40"
                          >
                            Record
                          </button>
                        </form>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-neutral-400">
                      Score events can only be recorded while the match is LIVE. Start the match to
                      enable scoring.
                    </div>
                  )}

                  {/* Recent Event Log */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase text-neutral-400 block">
                      Recent Score Events
                    </span>
                    <div className="max-h-40 overflow-y-auto bg-black/40 p-3 rounded-lg border border-white/5 space-y-1.5 text-xs font-mono text-neutral-300">
                      {visibleEvents.length === 0 && (
                        <div className="text-neutral-500">No score events recorded yet.</div>
                      )}
                      {visibleEvents.map((ev) => (
                        <div key={ev.id} className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <span className="text-emerald-400">»</span>
                            <span>
                              {ev.eventType} {ev.points ? `(+${ev.points})` : ''} —{' '}
                              {ev.team?.name || 'Unattributed'}
                            </span>
                          </span>
                          <button
                            onClick={() => handleReverseEvent(ev.id)}
                            disabled={actionKey !== null}
                            className="text-[10px] text-red-400 hover:text-red-300 uppercase font-bold disabled:opacity-30"
                          >
                            {actionKey === `reverse-${ev.id}` ? 'Reversing…' : 'Reverse'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Manual Score Correction */}
                  <div className="pt-2 border-t border-white/10">
                    <button
                      onClick={() => setShowManualOverride((v) => !v)}
                      className="text-xs font-bold uppercase text-neutral-400 hover:text-white"
                    >
                      {showManualOverride ? '▾' : '▸'} Manual Score Correction
                    </button>
                    {showManualOverride && (
                      <form
                        onSubmit={handleManualSubmit}
                        className="mt-3 p-4 rounded-xl bg-black/30 border border-white/10 space-y-3"
                      >
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-neutral-400 uppercase block mb-1">
                              {liveDetail.teamA?.name || 'Team A'} Score
                            </label>
                            <input
                              type="number"
                              value={manualForm.teamAScore}
                              onChange={(e) =>
                                setManualForm((p) => ({ ...p, teamAScore: e.target.value }))
                              }
                              className="w-full px-2.5 py-1.5 rounded bg-[#0e0e11] border border-white/10 text-sm text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-neutral-400 uppercase block mb-1">
                              {liveDetail.teamB?.name || 'Team B'} Score
                            </label>
                            <input
                              type="number"
                              value={manualForm.teamBScore}
                              onChange={(e) =>
                                setManualForm((p) => ({ ...p, teamBScore: e.target.value }))
                              }
                              className="w-full px-2.5 py-1.5 rounded bg-[#0e0e11] border border-white/10 text-sm text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-neutral-400 uppercase block mb-1">
                            Current Period
                          </label>
                          <input
                            value={manualForm.currentPeriod}
                            onChange={(e) =>
                              setManualForm((p) => ({ ...p, currentPeriod: e.target.value }))
                            }
                            className="w-full px-2.5 py-1.5 rounded bg-[#0e0e11] border border-white/10 text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-neutral-400 uppercase block mb-1">
                            Reason (required)
                          </label>
                          <textarea
                            value={manualForm.reason}
                            onChange={(e) =>
                              setManualForm((p) => ({ ...p, reason: e.target.value }))
                            }
                            required
                            rows={2}
                            className="w-full px-2.5 py-1.5 rounded bg-[#0e0e11] border border-white/10 text-sm text-white"
                            placeholder="Why is this manual correction necessary?"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={actionKey !== null || !manualForm.reason.trim()}
                          className="px-4 py-2 rounded-lg bg-[#FF4500] hover:brightness-110 disabled:opacity-40 text-white text-xs font-black uppercase tracking-wider"
                        >
                          {actionKey === 'manual' ? 'Saving…' : 'Apply Correction'}
                        </button>
                      </form>
                    )}
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  onClick={closeConsole}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ROSTER MODAL */}
        {rosterMatchId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-xl bg-[#17161b] border border-white/20 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-lg font-black text-white uppercase">
                  Roster · {rosterDetail?.teamA?.name || '…'} vs {rosterDetail?.teamB?.name || '…'}
                </h3>
                <button onClick={closeRoster} className="text-neutral-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              {rosterLoading && (
                <div className="text-center py-8 text-neutral-400 text-sm">Loading roster…</div>
              )}
              {rosterError && (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs">
                  {rosterError}
                </div>
              )}
              {rosterDetail && (
                <div className="grid grid-cols-2 gap-4 text-xs">
                  {[rosterDetail.teamA, rosterDetail.teamB].map((team, idx) =>
                    team ? (
                      <div
                        key={team.id}
                        className="space-y-2 p-3 bg-black/40 rounded-xl border border-white/5"
                      >
                        <span
                          className={`font-bold uppercase block ${idx === 0 ? 'text-[#FFD700]' : 'text-neutral-200'}`}
                        >
                          {team.name}
                        </span>
                        {team.members && team.members.length > 0 ? (
                          <ul className="space-y-1 text-neutral-300">
                            {team.members.map((m) => (
                              <li key={m.id} className="flex items-center gap-1.5">
                                <span className="text-emerald-400 font-mono">
                                  {m.jerseyNumber != null ? `#${m.jerseyNumber}` : '—'}
                                </span>
                                <span>
                                  {m.participant.name}
                                  {m.participant.rollNumber
                                    ? ` (${m.participant.rollNumber})`
                                    : ''}{' '}
                                  — {m.role}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-neutral-500 italic">
                            No registered squad members found.
                          </p>
                        )}
                      </div>
                    ) : null,
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MATCH SHEET MODAL */}
        {sheetMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-xl bg-[#17161b] border border-white/20 rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-lg font-black text-white uppercase">
                  Fixture Sheet #{sheetMatch.matchNumber || sheetMatch.id.slice(0, 8)}
                </h3>
                <button
                  onClick={() => setSheetMatch(null)}
                  className="text-neutral-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="p-4 bg-black/50 rounded-xl font-mono text-xs text-neutral-300 space-y-2 border border-white/5">
                <div className="text-white font-bold border-b border-white/10 pb-2 flex justify-between">
                  <span>CONVOQUER 2026 FIXTURE RUNSHEET</span>
                  <span className="text-[#FFD700]">
                    {sheetMatch.matchNumber || sheetMatch.id.slice(0, 8)}
                  </span>
                </div>
                <p>
                  VENUE: {sheetMatch.venue?.name || 'TBD'} (
                  {sheetMatch.venue?.location || 'location TBD'})
                </p>
                <p>
                  COMPETITION: {sheetMatch.tournament?.sport?.name || 'SPORT'} -{' '}
                  {sheetMatch.stage?.name || sheetMatch.tournament?.name || ''}
                </p>
                <p>
                  TEAMS: {sheetMatch.teamA?.name || 'TBD'} vs {sheetMatch.teamB?.name || 'TBD'}
                </p>
                <p>
                  STATUS: {sheetMatch.status.toUpperCase()}
                  {sheetMatch.currentPeriod ? ` · ${sheetMatch.currentPeriod}` : ''}
                </p>
                <p>
                  SCHEDULED START:{' '}
                  {sheetMatch.scheduledStartTime
                    ? new Date(sheetMatch.scheduledStartTime).toLocaleString('en-IN')
                    : 'TBD'}
                </p>
                {sheetMatch.officials && sheetMatch.officials.length > 0 ? (
                  <p>
                    OFFICIALS:{' '}
                    {sheetMatch.officials
                      .map((o) => `${o.user?.name || 'Unassigned'} (${o.role})`)
                      .join(', ')}
                  </p>
                ) : (
                  <p>OFFICIALS: None assigned yet</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setSheetMatch(null)}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Official Tournament Patrons Strip & Footer */}
        <Footer />
      </div>
    </RequireOrganizer>
  );
}
