'use client';
import Link from 'next/link';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '@/components/Navbar';
import { LiveTickerRibbon } from '@/components/LiveTickerRibbon';
import { Footer } from '@/components/Footer';
import { fetchMatches, Match, apiGet } from '@/lib/api';
import { formatTeamScores } from '@/lib/scoreDetails';

interface VolunteerInfo {
  name: string;
  role: string;
  /** Contact details are not exposed by the public volunteers endpoint — only shown when present. */
  phone?: string;
  desk?: string;
  radioChannel?: string;
}

interface PublicVolunteer {
  name: string;
  department: string;
  venueName?: string;
}

interface LiveMatchItem {
  id: string;
  sport: string;
  sportCategory: string;
  tournamentName: string;
  stageName: string;
  matchNumber: string;
  status: 'LIVE' | 'HALFTIME' | 'DRINKS' | 'UPCOMING';
  statusLabel: string;
  gameTime: string;
  gameTimeDetail: string;
  teamA: {
    name: string;
    shortName: string;
    code: string;
    score: string;
    secondaryScore?: string;
    isServing?: boolean;
    hasPossession?: boolean;
  };
  teamB: {
    name: string;
    shortName: string;
    code: string;
    score: string;
    secondaryScore?: string;
    isServing?: boolean;
    hasPossession?: boolean;
  };
  venue: {
    id: string;
    name: string;
    location: string;
    gate: string;
  };
  volunteer: VolunteerInfo;
  recentEvent: string;
  commentaryTimeline: Array<{
    time: string;
    team?: string;
    text: string;
    type: 'score' | 'foul' | 'highlight' | 'status';
  }>;
  statsBreakdown?: Array<{
    label: string;
    teamAVal: string;
    teamBVal: string;
  }>;
}

const fallbackVolunteer: VolunteerInfo = {
  name: 'Central Sports Secretariat',
  role: 'Point of Contact',
};

function volunteerFromPublicRecord(v: PublicVolunteer): VolunteerInfo {
  return {
    name: v.name,
    role: v.department,
    desk: v.venueName ? `${v.venueName} Desk` : undefined,
  };
}

export default function LivePage() {
  const [matches, setMatches] = useState<LiveMatchItem[]>([]);
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeModalMatch, setActiveModalMatch] = useState<LiveMatchItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('Just now');
  const [venueVolunteers, setVenueVolunteers] = useState<Record<string, VolunteerInfo>>({});

  // Point-of-contact roster, fetched from the backend (never hardcoded — see volunteers.service.ts)
  useEffect(() => {
    apiGet<PublicVolunteer[]>('/volunteers/public')
      .then((list) => {
        const map: Record<string, VolunteerInfo> = {};
        for (const v of Array.isArray(list) ? list : []) {
          if (v.venueName) map[v.venueName.toLowerCase()] = volunteerFromPublicRecord(v);
        }
        setVenueVolunteers(map);
      })
      .catch(() => setVenueVolunteers({}));
  }, []);

  // Fetch live matches from backend and merge with high-fidelity live feed
  const loadMatches = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const backendMatches: Match[] = await fetchMatches();
      if (backendMatches && backendMatches.length > 0) {
        const liveFromBackend = backendMatches
          // Only matches an organizer has explicitly flagged for broadcast show up here —
          // being LIVE in the scoring system alone isn't enough (see Match.isTelecast).
          .filter((m) => m.status === 'LIVE' && m.isTelecast)
          .map((bm): LiveMatchItem => {
            const vName = bm.venue?.name?.toLowerCase() || 'main ground';
            const volunteer = venueVolunteers[vName] || fallbackVolunteer;
            const sportName = bm.tournament?.sport?.name || 'General';
            const teamScores = formatTeamScores(bm);

            return {
              id: bm.id,
              sport: sportName,
              sportCategory: 'Tournament',
              tournamentName: bm.tournament?.name || `Convoquer'26 ${sportName} Tournament`,
              stageName: bm.stageId ? 'Championship Round' : 'Live Match',
              matchNumber: bm.matchNumber || 'LIVE-01',
              status: 'LIVE',
              statusLabel: `LIVE • ${bm.currentPeriod || 'IN PROGRESS'}`,
              gameTime: bm.currentPeriod || 'Live Action',
              gameTimeDetail: `${sportName} Competition underway at ${bm.venue?.name || 'IIT Jammu'}`,
              teamA: {
                name: bm.teamA?.institute?.name || bm.teamA?.name || 'Team Alpha',
                shortName: bm.teamA?.institute?.shortName || bm.teamA?.name || 'Team A',
                code: (bm.teamA?.institute?.shortName || 'TMA').slice(0, 4).toUpperCase(),
                score: teamScores.teamA.primary,
                secondaryScore: teamScores.teamA.secondary,
                hasPossession: true,
              },
              teamB: {
                name: bm.teamB?.institute?.name || bm.teamB?.name || 'Team Beta',
                shortName: bm.teamB?.institute?.shortName || bm.teamB?.name || 'Team B',
                code: (bm.teamB?.institute?.shortName || 'TMB').slice(0, 4).toUpperCase(),
                score: teamScores.teamB.primary,
                secondaryScore: teamScores.teamB.secondary,
                hasPossession: false,
              },
              venue: {
                id: bm.venue?.id || 'v-active',
                name: bm.venue?.name || 'Sports Arena',
                location: bm.venue?.location || 'Jagti Campus',
                gate: 'Gate 2 Enclave',
              },
              volunteer,
              recentEvent: 'Official technical score recorded in championship registry.',
              commentaryTimeline: [
                {
                  time: 'Live',
                  team: bm.teamA?.name,
                  text: 'Match active and registered on Convoquer scoring server.',
                  type: 'status',
                },
              ],
            };
          });

        // No fallback to demo content here: if nothing is actually live and
        // telecast-flagged, the Live Arena should show an empty state, not
        // fabricated matches (a real match must never appear to be a fake one).
        setMatches(liveFromBackend);
      } else {
        setMatches([]);
      }
    } catch {
      setMatches([]);
    } finally {
      setIsRefreshing(false);
      const now = new Date();
      setLastRefreshedAt(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      );
    }
  }, [venueVolunteers]);

  useEffect(() => {
    let cancelled = false;
    // Defer the initial load to a microtask so the effect body itself never
    // synchronously calls a setState-triggering function (loadMatches sets
    // isRefreshing before its first await).
    Promise.resolve().then(() => {
      if (!cancelled) loadMatches();
    });
    // Auto-poll every 12 seconds for seamless live experience
    const interval = setInterval(loadMatches, 12000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [loadMatches]);

  const sportsList = ['all', ...Array.from(new Set(matches.map((m) => m.sport)))];

  const filteredMatches = matches.filter((m) => {
    const matchesSport =
      selectedSport === 'all' || m.sport.toLowerCase() === selectedSport.toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    if (!query) return matchesSport;
    const matchesQuery =
      m.sport.toLowerCase().includes(query) ||
      m.teamA.name.toLowerCase().includes(query) ||
      m.teamA.shortName.toLowerCase().includes(query) ||
      m.teamB.name.toLowerCase().includes(query) ||
      m.teamB.shortName.toLowerCase().includes(query) ||
      m.venue.name.toLowerCase().includes(query) ||
      m.volunteer.name.toLowerCase().includes(query);
    return matchesSport && matchesQuery;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#121114] text-[#E8E6EB]">
      {/* 1. Live Continuous Ticker Ribbon */}
      <LiveTickerRibbon />

      {/* 2. Main Navigation Header */}
      <Navbar />

      {/* 3. Live Wire Hero & Arena Status Banner */}
      <section className="relative py-10 sm:py-14 bg-gradient-to-b from-[#151317] via-[#121114] to-[#121114] border-b border-white/10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(112,26,43,0.35),transparent)] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              {/* Live Tag */}
              {/* <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#701A2B]/40 border border-[#D95D39]/40 text-[#D95D39] text-xs font-mono uppercase tracking-widest rounded-full mb-3 shadow-inner">
                <span className="w-2 h-2 rounded-full bg-[#D95D39] animate-ping" />
                <span className="font-bold">REAL-TIME ARENA PROTOCOL • CONVOQUER WIRE</span>
              </div> */}

              <h1 className="font-display font-black text-3xl sm:text-5xl lg:text-6xl text-white uppercase tracking-tight leading-none">
                LIVE MATCHES &amp; <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#D95D39] to-[#D4AF37]">
                  ARENA ACTION WIRE
                </span>
              </h1>

              <p className="mt-3 text-xs sm:text-sm text-gray-300 max-w-2xl font-sans leading-relaxed">
                Official real-time championship scorecard, game periods, live overs, set scores, and
                direct venue volunteer emergency marshalls across IIT Jammu Jagti.
              </p>
            </div>

            {/* Quick Stats & Refresh Controls */}
            <div className="flex flex-wrap items-center gap-3 self-start lg:self-end">
              <div className="bg-[#1B191E] border border-white/10 rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-md">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                <div>
                  <div className="text-[10px] uppercase font-mono text-gray-400">Live Clashes</div>
                  <div className="font-display font-bold text-sm text-white">
                    {matches.length} Arenas Active
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={loadMatches}
                disabled={isRefreshing}
                className="px-4 py-2.5 bg-[#1B191E] hover:bg-[#27242C] text-[#D4AF37] border border-[#D4AF37]/40 rounded-xl text-xs font-mono uppercase tracking-wider transition-all flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                title="Refresh Live Scores"
              >
                <svg
                  className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
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
                <span>{isRefreshing ? 'Syncing...' : 'Sync Feed'}</span>
              </button>
            </div>
          </div>

          {/* Sync Timestamp Strip */}
          <div className="mt-6 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-gray-400">
            <div className="flex items-center gap-2">
              <span className="text-[#D4AF37]">Auto-sync:</span>
              <span>Every 12s via Convoquer Realtime Engine</span>
            </div>
            <div>
              <span>Last updated: {lastRefreshedAt}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Filter Bar & Search Input */}
      <section className="bg-[#121114] border-b border-white/10 sticky top-[61px] z-30 backdrop-blur-md bg-opacity-95 py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 soft-scrollbar">
              {sportsList.map((sport) => {
                const count =
                  sport === 'all'
                    ? matches.length
                    : matches.filter((m) => m.sport.toLowerCase() === sport.toLowerCase()).length;
                return (
                  <button
                    key={sport}
                    type="button"
                    onClick={() => setSelectedSport(sport)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-display uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      selectedSport === sport
                        ? 'bg-[#701A2B] text-white border border-[#D4AF37]/50 font-bold shadow-sm'
                        : 'bg-[#1B191E] text-gray-300 hover:text-white border border-white/10 hover:border-white/20'
                    }`}
                  >
                    <span>{sport === 'all' ? 'All Live' : sport}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        selectedSport === sport
                          ? 'bg-[#121114] text-[#D4AF37]'
                          : 'bg-[#121114] text-gray-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* University/Sport Search Filter */}
            <div className="relative min-w-[220px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by college, sport, venue..."
                className="w-full bg-[#1B191E] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 font-sans focus:outline-none focus:border-[#D4AF37] transition-colors"
              />
              <svg
                className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
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
            </div>
          </div>
        </div>
      </section>

      {/* 5. Live Matches Main Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {filteredMatches.length === 0 ? (
          <div className="py-20 text-center bg-[#1B191E] rounded-2xl border border-white/10 max-w-xl mx-auto p-8">
            <div className="w-12 h-12 rounded-full bg-[#701A2B]/40 border border-[#D4AF37]/30 flex items-center justify-center mx-auto mb-3 text-[#D4AF37]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="font-display font-bold text-xl text-white uppercase">
              {matches.length === 0 ? 'No Matches On Air Right Now' : 'No Matches Matching Filter'}
            </h2>
            <p className="text-xs text-gray-400 mt-2">
              {matches.length === 0
                ? 'Nothing is currently flagged for live broadcast. Check back once a match goes on air, or browse the full schedule.'
                : 'No live matches found for your current search criteria. Try switching the sport filter or clear the search query.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedSport('all');
                setSearchQuery('');
              }}
              className="mt-5 px-4 py-2 bg-[#701A2B] hover:bg-[#882236] text-white rounded-lg text-xs font-display uppercase tracking-wider font-semibold transition-all border border-[#D4AF37]/30"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredMatches.map((match) => (
              <article
                key={match.id}
                className="bg-[#1B191E] rounded-2xl border border-white/10 hover:border-[#D4AF37]/40 shadow-xl overflow-hidden transition-all flex flex-col justify-between group"
              >
                {/* Match Card Header */}
                <div className="p-4 sm:p-5 border-b border-white/10 bg-gradient-to-r from-[#17151A] via-[#1B191E] to-[#17151A]">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-[#701A2B]/50 border border-[#D4AF37]/30 rounded text-[11px] font-display uppercase tracking-wider text-[#D4AF37] font-bold">
                        {match.sport}
                      </span>
                      <span className="text-xs font-mono text-gray-400">{match.stageName}</span>
                    </div>

                    {/* Live Progress Tag */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-red-950/80 border border-red-500/40 text-red-400 text-[11px] font-mono uppercase font-semibold">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span>{match.statusLabel}</span>
                    </div>
                  </div>

                  <div className="text-xs text-gray-300 font-sans truncate">
                    {match.tournamentName}
                  </div>
                </div>

                {/* Scoreboard Arena Centerpiece */}
                <div className="p-4 sm:p-6 bg-[#141216]">
                  {/* Game Time / Clock / Over / Set Bar */}
                  <div className="mb-5 p-2.5 rounded-xl bg-[#1B191E] border border-white/10 flex items-center justify-between gap-2 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-[#D4AF37] shrink-0"
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
                      <span className="font-bold text-white uppercase tracking-wider">
                        {match.gameTime}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-400 truncate max-w-[200px] sm:max-w-xs">
                      {match.gameTimeDetail}
                    </span>
                  </div>

                  {/* Two Teams & Big Scores Display */}
                  <div className="space-y-4">
                    {/* Team A */}
                    <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-[#1B191E]/60 border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#701A2B] to-[#121114] border border-[#D4AF37]/30 flex items-center justify-center font-display font-black text-sm text-[#D4AF37] shrink-0 shadow-sm">
                          {match.teamA.code}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-display font-bold text-base sm:text-lg text-white truncate">
                              {match.teamA.shortName}
                            </h3>
                            {match.teamA.hasPossession && (
                              <span
                                className="w-2 h-2 rounded-full bg-[#D4AF37] shrink-0"
                                title="Active Possession / Strike"
                              />
                            )}
                          </div>
                          <div className="text-[11px] text-gray-400 truncate">
                            {match.teamA.name}
                          </div>
                          {match.teamA.secondaryScore && (
                            <div className="text-[10px] font-mono text-[#D4AF37] mt-0.5">
                              {match.teamA.secondaryScore}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="font-mono font-black text-3xl sm:text-4xl text-white shrink-0 tracking-tight">
                        {match.teamA.score}
                      </div>
                    </div>

                    {/* Team B */}
                    <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-[#1B191E]/60 border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#27242C] to-[#121114] border border-white/20 flex items-center justify-center font-display font-black text-sm text-gray-200 shrink-0 shadow-sm">
                          {match.teamB.code}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-display font-bold text-base sm:text-lg text-white truncate">
                              {match.teamB.shortName}
                            </h3>
                            {match.teamB.hasPossession && (
                              <span
                                className="w-2 h-2 rounded-full bg-[#D4AF37] shrink-0"
                                title="Active Possession / Strike"
                              />
                            )}
                          </div>
                          <div className="text-[11px] text-gray-400 truncate">
                            {match.teamB.name}
                          </div>
                          {match.teamB.secondaryScore && (
                            <div className="text-[10px] font-mono text-gray-400 mt-0.5">
                              {match.teamB.secondaryScore}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="font-mono font-black text-3xl sm:text-4xl text-gray-300 shrink-0 tracking-tight">
                        {match.teamB.score}
                      </div>
                    </div>
                  </div>

                  {/* Real-time event ticker */}
                  <div className="mt-4 p-2.5 rounded-lg bg-[#18161B] border border-white/5 flex items-center gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D95D39] shrink-0 animate-pulse" />
                    <span className="font-mono text-[11px] text-gray-300 truncate">
                      {match.recentEvent}
                    </span>
                  </div>
                </div>

                {/* Venue & Assigned Volunteer Section */}
                <div className="p-4 sm:p-5 bg-[#17151A] border-t border-white/10 space-y-3">
                  {/* Venue Location Line */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-gray-300">
                      <svg
                        className="w-3.5 h-3.5 text-[#D4AF37] shrink-0"
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
                      <span className="font-bold text-white">{match.venue.name}</span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-400">{match.venue.location}</span>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 hidden sm:inline-block">
                      {match.venue.gate}
                    </span>
                  </div>

                  {/* Assigned Volunteer Contact Card */}
                  <div className="p-3 rounded-xl bg-[#121114] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#701A2B]/40 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shrink-0">
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
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold text-xs text-white uppercase">
                            {match.volunteer.name}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 bg-[#1B191E] border border-white/10 rounded font-mono text-[#D4AF37]">
                            Venue Volunteer
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400 font-sans">
                          {match.volunteer.role} • {match.volunteer.desk}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Link to Match Center Action Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveModalMatch(match)}
                      className="w-full py-2.5 rounded-xl bg-[#701A2B] hover:bg-[#882236] text-white font-display text-xs uppercase tracking-wider font-bold transition-all border border-[#D4AF37]/40 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Open Match Center</span>
                      <svg
                        className="w-4 h-4 text-[#D4AF37]"
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
              </article>
            ))}
          </div>
        )}

        {/* 6. Venue Operations & Volunteers Quick Directory */}
        <section className="mt-14 pt-10 border-t border-white/10" id="volunteer-roster">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-3">
            <div>
              <span className="text-xs font-mono text-[#D4AF37] uppercase tracking-widest">
                Arena Support &amp; Technical Desk
              </span>
              <h2 className="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight mt-0.5">
                VENUE VOLUNTEER ROSTER
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Direct contacts for student marshalls, pitch coordinators, and first-aid liaisons
                stationed at each competition arena.
              </p>
            </div>
            <div className="text-xs font-mono text-gray-400">
              <Link href="/contact" className="text-[#D95D39] underline">
                Official support contacts
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(venueVolunteers).map(([venueKey, vol]) => (
              <div
                key={venueKey}
                className="p-4 bg-[#1B191E] rounded-xl border border-white/10 hover:border-[#D4AF37]/30 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] font-mono mb-2">
                    <span className="text-[#D4AF37] uppercase font-bold">
                      {venueKey.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-base text-white">{vol.name}</h3>
                  <div className="text-xs text-gray-300 mt-0.5">{vol.role}</div>
                  <div className="text-[11px] text-gray-400 font-sans mt-1">{vol.desk}</div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-gray-400">
                    Locate this desk on arrival for match-day assistance.
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* 7. Match Center Interactive Modal */}
      {activeModalMatch && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveModalMatch(null)}
        >
          <div
            className="bg-[#1B191E] border border-white/15 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-white/10 bg-[#151317] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded bg-[#701A2B] text-[#D4AF37] font-display text-[10px] uppercase font-bold">
                    {activeModalMatch.sport}
                  </span>
                  <span className="text-xs font-mono text-gray-400">
                    {activeModalMatch.matchNumber}
                  </span>
                  <span className="text-[10px] font-mono text-red-400 uppercase font-semibold">
                    {activeModalMatch.statusLabel}
                  </span>
                </div>
                <h3 className="font-display text-xl sm:text-2xl font-black uppercase text-white tracking-wide">
                  MATCH CENTER &bull; {activeModalMatch.teamA.code} vs {activeModalMatch.teamB.code}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setActiveModalMatch(null)}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close match center"
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

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 soft-scrollbar text-sm">
              {/* Scoreboard Banner */}
              <div className="p-4 rounded-xl bg-[#121114] border border-white/10">
                <div className="grid grid-cols-3 items-center text-center gap-2">
                  <div>
                    <div className="font-display font-black text-2xl sm:text-3xl text-white">
                      {activeModalMatch.teamA.score}
                    </div>
                    <div className="font-display font-bold text-sm text-[#D4AF37] mt-0.5">
                      {activeModalMatch.teamA.shortName}
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">
                      {activeModalMatch.teamA.code}
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <span className="text-xs font-mono text-[#D95D39] font-bold uppercase">
                      {activeModalMatch.gameTime}
                    </span>
                    <span className="text-[10px] font-mono text-gray-400 mt-1">vs</span>
                  </div>

                  <div>
                    <div className="font-display font-black text-2xl sm:text-3xl text-white">
                      {activeModalMatch.teamB.score}
                    </div>
                    <div className="font-display font-bold text-sm text-gray-200 mt-0.5">
                      {activeModalMatch.teamB.shortName}
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">
                      {activeModalMatch.teamB.code}
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-2 text-center text-xs font-mono text-gray-300 border-t border-white/5">
                  {activeModalMatch.gameTimeDetail}
                </div>
              </div>

              {/* Statistical Breakdown */}
              {activeModalMatch.statsBreakdown && (
                <div>
                  <h4 className="font-display uppercase text-xs text-[#D4AF37] tracking-widest mb-3">
                    Technical Match Statistics
                  </h4>
                  <div className="space-y-2">
                    {activeModalMatch.statsBreakdown.map((stat) => (
                      <div
                        key={stat.label}
                        className="p-2.5 rounded-lg bg-[#151317] border border-white/5 flex items-center justify-between text-xs"
                      >
                        <span className="font-mono font-bold text-white w-20 text-left">
                          {stat.teamAVal}
                        </span>
                        <span className="text-gray-400 font-sans uppercase text-[11px] text-center flex-1">
                          {stat.label}
                        </span>
                        <span className="font-mono font-bold text-gray-300 w-20 text-right">
                          {stat.teamBVal}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Play-by-play Commentary Timeline */}
              <div>
                <h4 className="font-display uppercase text-xs text-[#D4AF37] tracking-widest mb-3">
                  Live Action Timeline
                </h4>
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1 soft-scrollbar">
                  {activeModalMatch.commentaryTimeline.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-[#151317] border border-white/5 flex items-start gap-3 text-xs"
                    >
                      <span className="font-mono text-[#D4AF37] font-bold shrink-0">
                        {item.time}
                      </span>
                      <div>
                        {item.team && (
                          <span className="font-display font-bold text-white uppercase mr-1.5">
                            [{item.team}]
                          </span>
                        )}
                        <span className="text-gray-300 leading-relaxed">{item.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Venue & Assigned Volunteer Section inside modal */}
              <div className="p-4 rounded-xl bg-[#151317] border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-mono">Arena Location:</span>
                  <span className="font-bold text-white">
                    {activeModalMatch.venue.name} &bull; {activeModalMatch.venue.location} (
                    {activeModalMatch.venue.gate})
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-white/5 pt-2">
                  <span className="text-gray-400 font-mono">Assigned Volunteer:</span>
                  <span className="font-bold text-[#D4AF37]">
                    {activeModalMatch.volunteer.name} ({activeModalMatch.volunteer.role})
                  </span>
                </div>
                {activeModalMatch.volunteer.desk && (
                  <div className="flex items-center justify-between text-xs border-t border-white/5 pt-2">
                    <span className="text-gray-400 font-mono">Desk:</span>
                    <span className="font-mono font-bold text-white">
                      {activeModalMatch.volunteer.desk}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/10 bg-[#151317] flex items-center justify-between gap-3">
              <span className="text-xs font-mono text-gray-400 hidden sm:inline-block">
                Convoquer Realtime v4.2 &bull; Official Scorer Station
              </span>
              <button
                type="button"
                onClick={() => setActiveModalMatch(null)}
                className="w-full sm:w-auto px-5 py-2 rounded-lg bg-[#701A2B] hover:bg-[#882236] text-white font-display text-xs uppercase tracking-wider font-bold transition-all border border-[#D4AF37]/30"
              >
                Close Match Center
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Championship Footer */}
      <Footer />
    </div>
  );
}
