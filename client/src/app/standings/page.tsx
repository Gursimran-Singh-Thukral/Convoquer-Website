'use client';
import { EventDates } from '@/components/EventDates';

import React, { useState, useMemo, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { LiveTickerRibbon } from '@/components/LiveTickerRibbon';
import { Footer } from '@/components/Footer';
import { apiGet, fetchMedalTally, MedalTallyRow, Sport, Tournament, TeamStanding } from '@/lib/api';

interface StandingRow {
  rank: number;
  name: string;
  badge: string;
  badgeType: 'host' | 'challenger' | 'delegation' | 'regional';
  gold: number;
  silver: number;
  bronze: number;
  total: number;
  disciplines: string;
  points: number;
  category: string[];
}

function mapTallyToStandings(tally: MedalTallyRow[]): StandingRow[] {
  return tally.map((row, idx) => ({
    rank: row.rank || idx + 1,
    name: row.instituteName,
    badge: row.isHost
      ? 'HOST DELEGATION • BSA'
      : idx === 1
        ? 'CHALLENGER DELEGATION'
        : 'PARTICIPATING DELEGATION',
    badgeType: row.isHost ? 'host' : idx === 1 ? 'challenger' : 'delegation',
    gold: row.gold,
    silver: row.silver,
    bronze: row.bronze,
    total: row.gold + row.silver + row.bronze,
    disciplines: 'See sport-specific standings below',
    points: row.totalPoints,
    category: ['all'],
  }));
}

export default function StandingsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  useEffect(() => {
    apiGet<Tournament[]>('/tournaments')
      .then(setTournaments)
      .catch(() => {});
  }, []);
  const sportStatuses = tournaments.map((t) => ({
    sport: t.sport?.name || t.name,
    status: t.status,
    statusColor: 'text-[#FFD700]',
    venue: '',
    match: t.name,
    time: t.format,
    weight: `${t.pointsForWin} win / ${t.pointsForDraw} draw / ${t.pointsForLoss} loss`,
    tag: t.name,
  }));
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [sortKey, setSortKey] = useState<'points' | 'medals' | 'gold'>('points');

  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sports, setSports] = useState<Sport[]>([]);

  // Per-sport tournament point table (team-based), fetched from
  // GET /api/tournaments?sportId=... + GET /api/tournaments/:id/standings
  // when a discipline tab other than "all" is selected.
  const [sportStandings, setSportStandings] = useState<TeamStanding[] | null>(null);
  const [sportStandingsTournament, setSportStandingsTournament] = useState<string | null>(null);
  const [sportStandingsLoading, setSportStandingsLoading] = useState(false);

  useEffect(() => {
    Promise.all([fetchMedalTally(), apiGet<Sport[]>('/sports').catch(() => [])])
      .then(([tally, sportList]) => {
        setStandings(mapTallyToStandings(tally));
        setSports(Array.isArray(sportList) ? sportList : []);
        setIsLoading(false);
      })
      .catch(() => {
        setStandings([]);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      if (selectedSport === 'all') {
        setSportStandings(null);
        setSportStandingsTournament(null);
        return;
      }
      const matchingSport = sports.find(
        (s) => s.name.toLowerCase().replace(/\s+/g, '-') === selectedSport,
      );
      if (!matchingSport) {
        setSportStandings(null);
        setSportStandingsTournament(null);
        return;
      }

      setSportStandingsLoading(true);
      apiGet<Tournament[]>(`/tournaments?sportId=${matchingSport.id}`)
        .then(async (tournaments) => {
          if (cancelled) return;
          const tournament = tournaments && tournaments.length > 0 ? tournaments[0] : null;
          if (!tournament) {
            setSportStandings(null);
            setSportStandingsTournament(null);
            setSportStandingsLoading(false);
            return;
          }
          setSportStandingsTournament(tournament.name);
          const result = await apiGet<{ standings: TeamStanding[] }>(
            `/tournaments/${tournament.id}/standings`,
          ).catch(() => ({ standings: [] }));
          if (!cancelled) {
            setSportStandings(result.standings || []);
            setSportStandingsLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSportStandings(null);
            setSportStandingsTournament(null);
            setSportStandingsLoading(false);
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [selectedSport, sports]);

  const podiumRows = useMemo(() => standings.slice(0, 3), [standings]);

  const totalMedals = useMemo(
    () => standings.reduce((sum, row) => sum + row.total, 0),
    [standings],
  );

  const filteredAndSorted = useMemo(() => {
    const list = [...standings];

    return list.sort((a, b) => {
      if (sortKey === 'points') return b.points - a.points;
      if (sortKey === 'medals') return b.total - a.total;
      if (sortKey === 'gold') return b.gold - a.gold || b.silver - a.silver;
      return 0;
    });
  }, [standings, sortKey]);

  return (
    <div className="min-h-screen flex flex-col bg-[#121114] text-[#E8E6EB]">
      <LiveTickerRibbon />
      <Navbar />

      <main className="flex-1 w-full bg-[#121114]">
        {/* Page Header & Championship Status Banner */}
        <section className="w-full px-4 sm:px-6 lg:px-12 pt-10 pb-8 bg-[#0e0e11] border-b border-white/10">
          <div className="max-w-[1720px] mx-auto flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="flex flex-col max-w-3xl">
              <div className="flex items-center gap-2 mb-3">
                {/* <span className="w-2.5 h-2.5 rounded-full bg-[#FF4500] animate-pulse"></span> */}
                {/* <span className="text-[11px] font-mono uppercase tracking-widest text-[#FF4500] font-bold">
                  OFFICIAL FESTIVAL STANDINGS
                </span> */}
              </div>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl uppercase tracking-tight text-white font-bold leading-none m-0">
                OVERALL LEADERBOARD &amp; <span className="text-[#FFD700]">MEDAL STANDINGS</span>
              </h1>
              <p className="text-sm sm:text-base text-gray-400 mt-3 max-w-2xl leading-relaxed">
                Official institutional medal tally and published championship rankings. Tournament
                points follow each tournament’s configured rules.
              </p>
            </div>

            {/* Right Side Live Status Card */}
            <div className="flex-shrink-0 bg-[#1f1f24] border border-white/10 p-5 rounded-lg flex flex-col justify-between min-w-[280px]">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#FF4500] animate-pulse"></span>
                  <span className="font-mono text-xs text-[#FF4500] tracking-wider uppercase font-bold">
                    TOURNAMENT ACTIVE
                  </span>
                </div>
                <span className="font-mono text-[11px] bg-white/10 px-2 py-0.5 text-[#FFD700] uppercase font-bold rounded">
                  DAY 2 OF 4
                </span>
              </div>
              <div className="mt-4 pt-3 border-t border-white/10">
                <div className="font-display text-lg text-white uppercase tracking-wider font-bold">
                  <EventDates />
                </div>
                <div className="font-mono text-xs text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-[#FFD700]"></span>
                  MAIN GROUNDS &amp; SAC ARENAS
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Metric Stats Band */}
        <section className="w-full px-4 sm:px-6 lg:px-12 py-6 bg-[#16151a] border-b border-white/10">
          <div className="max-w-[1720px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#1e1d23] border border-white/5 p-4 rounded-lg flex flex-col">
              <span className="font-mono text-[11px] text-gray-400 uppercase tracking-widest">
                TOTAL MEDALS AWARDED
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="font-display text-3xl font-bold text-white">
                  {isLoading ? '—' : totalMedals}
                </span>
              </div>
              <span className="text-xs text-[#FFD700] mt-1 font-medium">
                Live tally, updates as medals are awarded
              </span>
            </div>

            <div className="bg-[#1e1d23] border border-white/5 p-4 rounded-lg flex flex-col">
              <span className="font-mono text-[11px] text-gray-400 uppercase tracking-widest">
                PARTICIPATING DELEGATIONS
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="font-display text-3xl font-bold text-[#FFD700]">
                  {isLoading ? '—' : String(standings.length).padStart(2, '0')}
                </span>
                <span className="text-xs text-gray-400 font-medium">Institutes</span>
              </div>
              <span className="text-xs text-gray-400 mt-1">Registered for this championship</span>
            </div>

            <div className="bg-[#1e1d23] border border-white/5 p-4 rounded-lg flex flex-col">
              <span className="font-mono text-[11px] text-gray-400 uppercase tracking-widest">
                CURRENT STANDINGS LEADER
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="font-display text-2xl font-bold text-[#FFB3B5] truncate">
                  {isLoading ? 'Loading…' : podiumRows[0]?.name || 'TBD'}
                </span>
              </div>
              <span className="text-xs text-[#FFD700] mt-1 font-bold">
                {isLoading || !podiumRows[0] ? '—' : `${podiumRows[0].points} PTS • Rank 1`}
              </span>
            </div>

            <div className="bg-[#1e1d23] border border-white/5 p-4 rounded-lg flex flex-col">
              <span className="font-mono text-[11px] text-gray-400 uppercase tracking-widest">
                NEXT MEDAL CEREMONY
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="font-display text-xl font-bold text-white truncate">TBA</span>
              </div>
              <span className="text-xs text-[#FF4500] mt-1 font-medium">
                Schedule announced closer to finals
              </span>
            </div>
          </div>
        </section>

        {/* Top 3 Championship Podium Showcase */}
        <section className="w-full px-4 sm:px-6 lg:px-12 py-10 bg-[#121114]">
          <div className="max-w-[1720px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-3">
              <div>
                <span className="text-xs font-mono uppercase text-[#FFD700] tracking-widest font-bold">
                  PODIUM TRACKER
                </span>
                <h2 className="font-display text-2xl sm:text-3xl uppercase text-white tracking-tight mt-1 font-bold">
                  CHAMPIONSHIP PODIUM CONTENDERS
                </h2>
              </div>
              <span className="font-mono text-xs text-gray-400 uppercase tracking-wider">
                LIVE AS OF DAY 2 SESSION 3
              </span>
            </div>

            {isLoading ? (
              <div className="p-12 text-center bg-[#18181c] border border-white/10 rounded-lg">
                <p className="text-gray-400 text-xs font-mono uppercase tracking-widest">
                  Loading championship podium from database...
                </p>
              </div>
            ) : podiumRows.length === 0 ? (
              <div className="p-12 text-center bg-[#18181c] border border-white/10 rounded-lg">
                <p className="text-gray-400 text-sm">
                  Podium standings will populate once medals are awarded.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                {[podiumRows[1], podiumRows[0], podiumRows[2]].map((row, idx) => {
                  if (!row) return <div key={`podium-empty-${idx}`} className="hidden lg:block" />;
                  const isLeader = row.rank === 1;
                  const accent = isLeader ? '#FFD700' : row.rank === 2 ? '#FF4500' : '#CD7F32';
                  const leaderPoints = podiumRows[0]?.points ?? row.points;
                  const margin = isLeader ? 0 : row.points - leaderPoints;
                  return (
                    <div
                      key={row.name}
                      className={
                        isLeader
                          ? 'order-1 lg:order-2 bg-gradient-to-b from-[#701A2B]/40 via-[#18181c] to-[#121114] border-2 border-[#FFD700] p-6 rounded-lg flex flex-col justify-between relative shadow-[0_0_30px_rgba(255,215,0,0.15)]'
                          : row.rank === 2
                            ? 'order-2 lg:order-1 bg-[#18181c] border border-[#FF4500]/40 p-6 rounded-lg flex flex-col justify-between relative shadow-lg'
                            : 'order-3 bg-[#18181c] border border-[#CD7F32]/40 p-6 rounded-lg flex flex-col justify-between relative shadow-lg'
                      }
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center justify-between w-full mb-4">
                          <span
                            className="font-display font-black"
                            style={{ color: accent, fontSize: isLeader ? '3rem' : '2.25rem' }}
                          >
                            #{String(row.rank).padStart(2, '0')}
                          </span>
                          <span
                            className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded font-bold"
                            style={{
                              color: accent,
                              backgroundColor: isLeader ? '#701A2B' : '#351a14',
                              borderWidth: 1,
                              borderColor: `${accent}80`,
                            }}
                          >
                            {isLeader ? 'CHAMPIONSHIP LEADER' : row.badge}
                          </span>
                        </div>
                        <div className="flex flex-col items-center text-center gap-1 min-h-[56px] mt-2">
                          <h3
                            className={`font-display uppercase leading-tight font-bold text-white ${isLeader ? 'text-2xl' : 'text-xl'}`}
                          >
                            {row.name}
                          </h3>
                          <p className="text-xs text-gray-400">{row.badge}</p>
                        </div>
                        <div
                          className={`mt-6 bg-[#0e0e11] border p-4 rounded flex items-center justify-between text-center ${isLeader ? 'border-[#FFD700]/30' : 'border-white/10'}`}
                        >
                          <div>
                            <span className="text-[10px] font-mono text-gray-400 uppercase block">
                              AGGREGATE
                            </span>
                            <div
                              className="font-display tracking-tight leading-none mt-1 font-black"
                              style={{
                                color: isLeader ? '#FFD700' : '#fff',
                                fontSize: isLeader ? '2.25rem' : '1.875rem',
                              }}
                            >
                              {row.points}{' '}
                              <span className="text-xs font-mono text-gray-400">PTS</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-mono text-gray-400 uppercase block">
                              {isLeader ? 'TOTAL MEDALS' : 'MARGIN'}
                            </span>
                            {isLeader ? (
                              <div className="font-display text-3xl text-white leading-none mt-1 font-bold">
                                {String(row.total).padStart(2, '0')}
                              </div>
                            ) : (
                              <div
                                className="font-mono text-xs tracking-wider mt-1 font-bold"
                                style={{ color: accent }}
                              >
                                {margin} PTS
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                          <div className="bg-[#0e0e11] border border-[#FFD700]/30 p-2 rounded">
                            <span className="font-display text-xl text-[#FFD700] block font-bold">
                              {row.gold}
                            </span>
                            <span className="font-mono text-[10px] text-[#FFD700]/80">GOLD</span>
                          </div>
                          <div className="bg-[#0e0e11] border border-[#CBD5E1]/30 p-2 rounded">
                            <span className="font-display text-xl text-[#E2E8F0] block font-bold">
                              {row.silver}
                            </span>
                            <span className="font-mono text-[10px] text-[#CBD5E1]">SILVER</span>
                          </div>
                          <div className="bg-[#0e0e11] border border-[#CD7F32]/30 p-2 rounded">
                            <span className="font-display text-xl text-[#CD7F32] block font-bold">
                              {row.bronze}
                            </span>
                            <span className="font-mono text-[10px] text-[#CD7F32]">BRONZE</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-6 pt-3 bg-[#0e0e11]/60 border-t border-white/10 p-3 rounded flex flex-col justify-center text-center">
                        <span className="font-mono text-[10px] text-gray-400 uppercase tracking-wider block">
                          TOTAL MEDALS WON
                        </span>
                        <span className="text-xs text-white font-medium mt-1">
                          {row.gold} Gold • {row.silver} Silver • {row.bronze} Bronze
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Complete Institutional Standings Table Section */}
        <section className="w-full px-4 sm:px-6 lg:px-12 py-10 bg-[#0e0e11] border-t border-white/10">
          <div className="max-w-[1720px] mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
              {/* Discipline Filters */}
              <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-2">
                {[
                  { key: 'all', label: 'ALL SPORTS (8)' },
                  { key: 'football', label: 'FOOTBALL' },
                  { key: 'cricket', label: 'CRICKET' },
                  { key: 'basketball', label: 'BASKETBALL' },
                  { key: 'volleyball', label: 'VOLLEYBALL' },
                  { key: 'athletics', label: 'ATHLETICS' },
                  { key: 'badminton', label: 'BADMINTON' },
                  { key: 'table-tennis', label: 'TABLE TENNIS' },
                  { key: 'chess', label: 'CHESS' },
                ].map((sport) => {
                  const isActive = selectedSport === sport.key;
                  return (
                    <button
                      key={sport.key}
                      onClick={() => setSelectedSport(sport.key)}
                      className={`px-3 py-1.5 font-display text-xs uppercase tracking-wider rounded transition-all ${
                        isActive
                          ? 'bg-[#701A2B] text-[#FFD700] border border-[#FFD700]/50 font-bold shadow-sm'
                          : 'bg-[#18181c] text-gray-400 hover:text-white border border-white/5'
                      }`}
                    >
                      {sport.label}
                    </button>
                  );
                })}
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-2 self-end lg:self-auto">
                <span className="font-mono text-xs text-gray-400 uppercase">SORT:</span>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as 'points' | 'medals' | 'gold')}
                  className="bg-[#18181c] text-white font-mono text-xs uppercase px-3 py-1.5 rounded border border-white/10 focus:outline-none focus:border-[#FFD700] cursor-pointer"
                >
                  <option value="points">POINTS (DESCENDING)</option>
                  <option value="medals">TOTAL MEDALS</option>
                  <option value="gold">GOLD COUNT</option>
                </select>
              </div>
            </div>

            {/* Table: overall institute medal standings, or a real per-sport
                tournament point table (team-based) when a discipline tab is
                selected and that sport has a tournament with computed
                standings. */}
            {selectedSport === 'all' ? (
              <div className="w-full overflow-x-auto border border-white/10 rounded-lg">
                <table className="w-full text-left border-collapse min-w-[850px]">
                  <thead>
                    <tr className="bg-[#18181c] text-gray-400 font-display text-xs uppercase tracking-wider border-b border-white/10">
                      <th className="py-3.5 px-4">RANK &amp; UNIVERSITY</th>
                      <th className="py-3.5 px-3 text-center text-[#FFD700]">GOLD</th>
                      <th className="py-3.5 px-3 text-center text-[#CBD5E1]">SILVER</th>
                      <th className="py-3.5 px-3 text-center text-[#CD7F32]">BRONZE</th>
                      <th className="py-3.5 px-3 text-center text-white">TOTAL</th>
                      <th className="py-3.5 px-4 text-right text-[#FFD700]">OVERALL PTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {isLoading ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-12 text-center text-gray-400 font-mono text-xs"
                        >
                          Loading official standings from championship database...
                        </td>
                      </tr>
                    ) : filteredAndSorted.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-12 text-center text-gray-400 font-sans text-sm"
                        >
                          Standings will populate as institutes are registered and medals awarded.
                        </td>
                      </tr>
                    ) : (
                      filteredAndSorted.map((row) => {
                        const isFirst = row.rank === 1;
                        return (
                          <tr
                            key={row.name}
                            className={`transition-colors ${
                              isFirst
                                ? 'bg-[#701A2B]/20 hover:bg-[#701A2B]/35 border-l-4 border-[#FFD700]'
                                : 'bg-[#121114] hover:bg-[#18181c]'
                            }`}
                          >
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <span
                                  className={`font-display text-lg font-black w-8 ${
                                    row.rank === 1
                                      ? 'text-[#FFD700]'
                                      : row.rank === 2
                                        ? 'text-[#FF4500]'
                                        : row.rank === 3
                                          ? 'text-[#CD7F32]'
                                          : 'text-gray-400'
                                  }`}
                                >
                                  0{row.rank}
                                </span>
                                <div>
                                  <div className="font-display font-bold text-white uppercase text-base leading-snug">
                                    {row.name}
                                  </div>
                                  <span className="font-mono text-[10px] text-gray-400 uppercase">
                                    {row.badge}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-center font-display font-bold text-base text-[#FFD700]">
                              {row.gold}
                            </td>
                            <td className="py-3.5 px-3 text-center font-display font-bold text-base text-[#E2E8F0]">
                              {row.silver}
                            </td>
                            <td className="py-3.5 px-3 text-center font-display font-bold text-base text-[#CD7F32]">
                              {row.bronze}
                            </td>
                            <td className="py-3.5 px-3 text-center font-display font-bold text-base text-white">
                              {row.total}
                            </td>
                            <td className="py-3.5 px-4 text-right font-display text-lg font-black text-[#FFD700]">
                              {row.points}{' '}
                              <span className="font-mono text-[10px] text-gray-400">PTS</span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="w-full overflow-x-auto border border-white/10 rounded-lg">
                {sportStandingsTournament && (
                  <div className="px-4 py-2.5 bg-[#18181c] border-b border-white/10 text-xs font-mono text-gray-400 uppercase tracking-wider">
                    Point table for:{' '}
                    <span className="text-[#FFD700] font-bold">{sportStandingsTournament}</span>
                  </div>
                )}
                <table className="w-full text-left border-collapse min-w-[850px]">
                  <thead>
                    <tr className="bg-[#18181c] text-gray-400 font-display text-xs uppercase tracking-wider border-b border-white/10">
                      <th className="py-3.5 px-4">RANK &amp; TEAM</th>
                      <th className="py-3.5 px-3 text-center">PLAYED</th>
                      <th className="py-3.5 px-3 text-center text-emerald-400">WON</th>
                      <th className="py-3.5 px-3 text-center text-[#FF4500]">LOST</th>
                      <th className="py-3.5 px-3 text-center">DRAWN</th>
                      <th className="py-3.5 px-4 text-right text-[#FFD700]">POINTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {sportStandingsLoading ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-12 text-center text-gray-400 font-mono text-xs"
                        >
                          Loading point table from championship database...
                        </td>
                      </tr>
                    ) : !sportStandings || sportStandings.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-12 text-center text-gray-400 font-sans text-sm"
                        >
                          No tournament point table is available yet for this discipline.
                        </td>
                      </tr>
                    ) : (
                      sportStandings.map((row) => (
                        <tr
                          key={row.teamId}
                          className={`transition-colors ${
                            row.rank === 1
                              ? 'bg-[#701A2B]/20 hover:bg-[#701A2B]/35 border-l-4 border-[#FFD700]'
                              : 'bg-[#121114] hover:bg-[#18181c]'
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <span className="font-display text-lg font-black w-8 text-gray-400">
                                0{row.rank}
                              </span>
                              <div>
                                <div className="font-display font-bold text-white uppercase text-base leading-snug">
                                  {row.teamName}
                                </div>
                                <span className="font-mono text-[10px] text-gray-400 uppercase">
                                  {row.instituteName}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-center font-display font-bold text-base text-white">
                            {row.played}
                          </td>
                          <td className="py-3.5 px-3 text-center font-display font-bold text-base text-emerald-400">
                            {row.won}
                          </td>
                          <td className="py-3.5 px-3 text-center font-display font-bold text-base text-[#FF4500]">
                            {row.lost}
                          </td>
                          <td className="py-3.5 px-3 text-center font-display font-bold text-base text-white">
                            {row.drawn}
                          </td>
                          <td className="py-3.5 px-4 text-right font-display text-lg font-black text-[#FFD700]">
                            {row.points}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Sport-by-Sport Discipline Status */}
        <section className="w-full px-4 sm:px-6 lg:px-12 py-10 bg-[#121114]">
          <div className="max-w-[1720px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-3">
              <div>
                <span className="text-xs font-mono uppercase text-[#FFD700] tracking-widest font-bold">
                  BRACKET OUTCOMES
                </span>
                <h2 className="font-display text-2xl sm:text-3xl uppercase text-white tracking-tight mt-1 font-bold">
                  SPORT-BY-SPORT PODIUM STATUS
                </h2>
              </div>
              <span className="text-xs text-gray-400">
                Medal outcomes across all 8 sanctioned championship brackets
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {sportStatuses.map((item) => (
                <div
                  key={item.sport}
                  className="bg-[#18181c] border border-white/10 p-5 rounded-lg flex flex-col justify-between hover:border-[#FFD700]/40 transition-all shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-display text-base uppercase text-white font-bold">
                        {item.sport}
                      </span>
                      <span
                        className={`font-mono text-[10px] uppercase border px-2 py-0.5 rounded font-bold ${item.statusColor}`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-4">{item.venue}</p>
                    <div className="space-y-1.5 bg-[#0e0e11] border border-white/5 p-3 rounded text-xs">
                      <div className="text-white font-medium">{item.match}</div>
                      <div className="text-[11px] font-mono text-[#FFD700]">{item.time}</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 flex justify-between items-center text-gray-400 font-mono text-[11px] border-t border-white/5">
                    <span>{item.weight}</span>
                    <span className="text-[#FFD700] font-bold">{item.tag}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
