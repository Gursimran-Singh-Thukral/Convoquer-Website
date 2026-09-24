'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { LiveTickerRibbon } from '@/components/LiveTickerRibbon';
import { Footer } from '@/components/Footer';
import { apiGet, teamCodeFromName, type Match } from '@/lib/api';

interface MatchItem {
  id: string;
  sport: string;
  stage: string;
  venue: string;
  time: string;
  timeSlot: 'Morning (08:00 - 12:00)' | 'Afternoon (12:00 - 16:00)' | 'Evening (16:00 - 20:00)';
  day: string;
  status: 'LIVE' | 'SCHEDULED' | 'COMPLETED';
  statusText: string;
  teamA: { name: string; code: string; seed?: string; score?: string };
  teamB: { name: string; code: string; seed?: string; score?: string };
  referee: string;
}

function formatClockTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return '';
  }
}

function timeSlotFor(iso: string): MatchItem['timeSlot'] {
  const hour = Number(
    new Date(iso).toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      hourCycle: 'h23',
    }),
  );
  if (hour < 12) return 'Morning (08:00 - 12:00)';
  if (hour < 16) return 'Afternoon (12:00 - 16:00)';
  return 'Evening (16:00 - 20:00)';
}

function statusBucket(status: string): MatchItem['status'] {
  if (status === 'LIVE' || status === 'PAUSED') return 'LIVE';
  if (status === 'COMPLETED' || status === 'ABANDONED' || status === 'CANCELLED')
    return 'COMPLETED';
  return 'SCHEDULED';
}

function statusTextFor(m: Match): string {
  const bucket = statusBucket(m.status);
  if (bucket === 'LIVE') {
    return `● LIVE${m.currentPeriod ? ` ${m.currentPeriod}` : ''}`;
  }
  if (m.status === 'CANCELLED') return 'CANCELLED';
  if (m.status === 'ABANDONED') return 'ABANDONED';
  if (bucket === 'COMPLETED') {
    if (m.teamAScore !== null && m.teamBScore !== null) {
      return `FINAL (${m.teamAScore}-${m.teamBScore})`;
    }
    return 'FINAL';
  }
  return `UPCOMING (${formatClockTime(m.scheduledStartTime)})`;
}

function mapMatchToItem(m: Match): MatchItem {
  const timeRange = m.scheduledEndTime
    ? `${formatClockTime(m.scheduledStartTime)} - ${formatClockTime(m.scheduledEndTime)}`
    : formatClockTime(m.scheduledStartTime);

  return {
    id: m.id,
    sport: m.tournament?.sport?.name || 'Sport TBD',
    stage: (m.stage?.name || m.tournament?.name || 'Fixture').toUpperCase(),
    venue: m.venue?.name || 'Venue TBD',
    time: timeRange,
    timeSlot: timeSlotFor(m.scheduledStartTime),
    day: new Date(m.scheduledStartTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    status: statusBucket(m.status),
    statusText: statusTextFor(m),
    teamA: {
      name: m.teamA?.name || 'TBD',
      code: teamCodeFromName(m.teamA?.institute?.shortName || m.teamA?.name),
      score: m.teamAScore !== null && m.teamAScore !== undefined ? String(m.teamAScore) : undefined,
    },
    teamB: {
      name: m.teamB?.name || 'TBD',
      code: teamCodeFromName(m.teamB?.institute?.shortName || m.teamB?.name),
      score: m.teamBScore !== null && m.teamBScore !== undefined ? String(m.teamBScore) : undefined,
    },
    referee:
      m.officials
        ?.map((o) => o.user?.name)
        .filter(Boolean)
        .join(', ') || 'To be assigned',
  };
}

export default function SchedulePage() {
  const [allMatches, setAllMatches] = useState<MatchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'timeline'>('cards');

  useEffect(() => {
    apiGet<Match[]>('/matches')
      .then((data) => {
        const items = Array.isArray(data) ? data.map(mapMatchToItem) : [];
        setAllMatches(items);
        if (items.length > 0) {
          setSelectedDay(items[0].day);
        }
        setIsLoading(false);
      })
      .catch(() => {
        setAllMatches([]);
        setIsLoading(false);
      });
  }, []);

  const filteredMatches = useMemo(() => {
    return allMatches.filter((m) => {
      if (m.day !== selectedDay) return false;
      if (sportFilter !== 'all' && m.sport.toLowerCase() !== sportFilter.toLowerCase())
        return false;
      if (statusFilter !== 'all' && m.status.toLowerCase() !== statusFilter.toLowerCase())
        return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchStr =
          `${m.teamA.name} ${m.teamB.name} ${m.sport} ${m.venue} ${m.stage}`.toLowerCase();
        if (!matchStr.includes(q)) return false;
      }
      return true;
    });
  }, [allMatches, selectedDay, sportFilter, statusFilter, searchQuery]);

  const slots = [
    'Morning (08:00 - 12:00)',
    'Afternoon (12:00 - 16:00)',
    'Evening (16:00 - 20:00)',
  ] as const;

  // Court Timeline Grid — venues and their scheduled matches, derived entirely
  // from filteredMatches (real backend data), never hardcoded.
  const timelineRows = useMemo(() => {
    const venues = Array.from(new Set(filteredMatches.map((m) => m.venue))).sort();
    return venues.map((venue) => ({
      venue,
      cells: slots.map((slot) =>
        filteredMatches
          .filter((m) => m.venue === venue && m.timeSlot === slot)
          .map((m) => `${m.sport}: ${m.teamA.code} vs ${m.teamB.code}`)
          .join(', '),
      ),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `slots` is a fixed literal, never actually changes between renders
  }, [filteredMatches]);

  return (
    <div className="min-h-screen flex flex-col bg-[#121114] text-[#E8E6EB]">
      <LiveTickerRibbon />
      <Navbar />

      {/* Header Accent Line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-[#800020] via-[#FF4500] to-[#FFD700]"></div>

      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Breadcrumb & Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#FFD700] mb-2 uppercase">
              {/* <span>● TOURNAMENT MASTER SCHEDULE</span> */}
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-white uppercase tracking-wide">
              SCHEDULE &amp; FIXTURES DIRECTORY
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Official tournament time slots, venue assignments, and real-time live score updates.
            </p>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-[#1C191E] p-1 rounded-lg border border-white/10 self-start md:self-auto">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded text-xs font-display uppercase tracking-wider font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'cards'
                  ? 'bg-[#701A2B] text-[#FFD700] border border-[#FFD700]/40'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                />
              </svg>
              Ticket Cards
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded text-xs font-display uppercase tracking-wider font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'timeline'
                  ? 'bg-[#701A2B] text-[#FFD700] border border-[#FFD700]/40'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Court Timeline Grid
            </button>
          </div>
        </div>

        {/* Day Selector Strip */}
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          {Array.from(new Set(allMatches.map((m) => m.day)))
            .sort()
            .map((day, idx) => ({
              day,
              date: day,
              dayNumber: idx + 1,
              label: `${allMatches.filter((m) => m.day === day).length} fixtures`,
            }))
            .map((item) => {
              const isActive = selectedDay === item.day;
              return (
                <button
                  key={item.day}
                  onClick={() => setSelectedDay(item.day)}
                  className={`px-5 py-3 rounded-xl border text-left transition-all min-w-[200px] shrink-0 ${
                    isActive
                      ? 'bg-[#701A2B] border-[#FFD700] text-white shadow-lg'
                      : 'bg-[#151316] border-white/10 text-gray-400 hover:border-white/30 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono mb-1">
                    <span className={isActive ? 'text-[#FFD700] font-bold' : ''}>{item.date}</span>
                    {item.day ===
                      new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    )}
                  </div>
                  <div className="text-sm font-display font-bold uppercase tracking-wide">
                    DAY {item.dayNumber}{' '}
                    <span className="text-gray-500 normal-case font-normal">· {item.label}</span>
                  </div>
                </button>
              );
            })}
        </div>

        {/* Filter Toolbar */}
        <div className="bg-[#151316] border border-white/10 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Sport Filter */}
            <select
              value={sportFilter}
              onChange={(e) => setSportFilter(e.target.value)}
              className="bg-[#1C191E] border border-white/10 text-white font-mono text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-[#FFD700]"
            >
              <option value="all">All sports</option>
              {Array.from(new Set(allMatches.map((m) => m.sport)))
                .sort()
                .map((sport) => (
                  <option key={sport} value={sport}>
                    {sport}
                  </option>
                ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#1C191E] border border-white/10 text-white font-mono text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-[#FFD700]"
            >
              <option value="all">ALL STATUSES</option>
              <option value="live">Live Matches Only</option>
              <option value="scheduled">Upcoming / Scheduled</option>
              <option value="completed">Finished</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="Search team, venue, or match..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1C191E] border border-white/10 text-white placeholder-gray-500 font-sans text-xs px-3.5 py-2 rounded-lg focus:outline-none focus:border-[#FFD700]"
            />
          </div>
        </div>

        {/* View Mode: Cards */}
        {viewMode === 'cards' && isLoading && (
          <div className="p-16 text-center bg-[#151316] rounded-xl border border-white/10">
            <div className="w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400 text-xs font-mono uppercase tracking-widest">
              Loading official fixtures from championship database...
            </p>
          </div>
        )}
        {viewMode === 'cards' && !isLoading && (
          <div className="space-y-8">
            {slots.map((slotName) => {
              const matchesInSlot = filteredMatches.filter((m) => m.timeSlot === slotName);
              if (matchesInSlot.length === 0) return null;

              return (
                <div key={slotName} className="space-y-4">
                  <div className="font-display font-bold text-sm uppercase tracking-wider text-[#FFD700] flex items-center gap-2 border-b border-white/10 pb-2">
                    <span>⏱️ {slotName}</span>
                    <span className="text-xs font-mono text-gray-500">
                      ({matchesInSlot.length} fixtures)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {matchesInSlot.map((m) => (
                      <div
                        key={m.id}
                        className={`bg-[#151316] border rounded-xl p-5 shadow-lg flex flex-col justify-between transition-all ${
                          m.status === 'LIVE'
                            ? 'border-[#FF4500] shadow-[0_0_20px_rgba(255,69,0,0.2)]'
                            : 'border-white/10 hover:border-white/25'
                        }`}
                      >
                        <div>
                          {/* Top Meta Tag */}
                          <div className="flex items-center justify-between text-xs font-mono mb-3">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-[#FFD700]"></span>
                              <span className="font-bold text-white uppercase">{m.sport}</span>
                              <span className="text-gray-500">|</span>
                              <span className="text-gray-400">{m.stage}</span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                m.status === 'LIVE'
                                  ? 'bg-[#FF4500] text-white animate-pulse'
                                  : m.status === 'COMPLETED'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-[#1C191E] text-gray-400'
                              }`}
                            >
                              {m.statusText}
                            </span>
                          </div>

                          {/* Teams & Scoreboard */}
                          <div className="bg-[#0B0A0D] border border-white/5 rounded-lg p-3.5 space-y-2 mb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <span className="px-1.5 py-0.5 rounded bg-[#701A2B] text-[#FFD700] text-xs font-mono font-bold">
                                  {m.teamA.code}
                                </span>
                                <span className="font-display font-bold text-white text-base">
                                  {m.teamA.name}
                                </span>
                                {m.teamA.seed && (
                                  <span className="text-[10px] font-mono text-[#FFD700]">
                                    ({m.teamA.seed})
                                  </span>
                                )}
                              </div>
                              <span className="font-mono font-bold text-base text-[#FFD700]">
                                {m.teamA.score || '-'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <span className="px-1.5 py-0.5 rounded bg-[#1C191E] text-gray-300 text-xs font-mono font-bold">
                                  {m.teamB.code}
                                </span>
                                <span className="font-display font-bold text-white text-base">
                                  {m.teamB.name}
                                </span>
                                {m.teamB.seed && (
                                  <span className="text-[10px] font-mono text-[#FFD700]">
                                    ({m.teamB.seed})
                                  </span>
                                )}
                              </div>
                              <span className="font-mono font-bold text-base text-[#FFD700]">
                                {m.teamB.score || '-'}
                              </span>
                            </div>
                          </div>

                          <div className="text-[11px] font-mono text-gray-400 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <svg
                                className="w-3.5 h-3.5 text-[#FF4500]"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                              <span>
                                {m.venue} • {m.time}
                              </span>
                            </div>
                            <div>Referee: {m.referee}</div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                          <span className="text-[11px] font-mono text-[#FFD700]">
                            Pass: CQ26-{m.id.toUpperCase()}
                          </span>
                          <a
                            href={`/matches/${m.id}`}
                            className="text-xs font-display font-bold text-white hover:text-[#FFD700] uppercase tracking-wider transition-colors"
                          >
                            Go to Live Center →
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {filteredMatches.length === 0 && (
              <div className="p-12 text-center bg-[#151316] rounded-xl border border-white/10">
                <p className="text-gray-400 text-sm">
                  No matches found for the selected day and filters.
                </p>
              </div>
            )}
          </div>
        )}

        {/* View Mode: Timeline (Court Timeline Grid — backend-driven, see timelineRows above) */}
        {viewMode === 'timeline' && (
          <div className="bg-[#151316] border border-white/10 rounded-xl p-6 overflow-x-auto shadow-xl">
            {timelineRows.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-400 text-sm">
                  No matches found for the selected day and filters.
                </p>
              </div>
            ) : (
              <div className="min-w-[850px] space-y-4">
                <div className="grid grid-cols-4 gap-4 font-mono text-xs text-gray-400 border-b border-white/10 pb-3">
                  <span>VENUE / COURT</span>
                  {slots.map((slot) => (
                    <span key={slot}>{slot}</span>
                  ))}
                </div>

                {timelineRows.map((row) => (
                  <div
                    key={row.venue}
                    className="grid grid-cols-4 gap-4 py-3 border-b border-white/5 text-xs font-mono items-center"
                  >
                    <span className="font-display font-bold text-white">{row.venue}</span>
                    {row.cells.map((cell, idx) => (
                      <span
                        key={idx}
                        className={`p-2 rounded border ${
                          cell
                            ? 'bg-[#701A2B]/40 text-[#FFD700] border-[#FFD700]/30 font-bold'
                            : 'bg-[#0B0A0D] text-gray-600 border-white/5'
                        }`}
                      >
                        {cell || '—'}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
