'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { LiveTickerRibbon } from '@/components/LiveTickerRibbon';
import { Footer } from '@/components/Footer';
import {
  apiGet,
  teamCodeFromName,
  type Sport,
  type Tournament,
  type Team,
  type Match,
} from '@/lib/api';

interface SportMedal {
  id: string;
  type: 'GOLD' | 'SILVER' | 'BRONZE' | string;
  institute: { id: string; name: string; shortName: string | null; logoUrl: string | null };
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, '-');
}

function formatClockTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function matchStatusDisplay(m: Match): { text: string; color: string } {
  if (m.status === 'LIVE' || m.status === 'PAUSED') {
    return {
      text: `● LIVE${m.currentPeriod ? ` ${m.currentPeriod}` : ''}`,
      color: 'text-[#FF4500]',
    };
  }
  if (m.status === 'COMPLETED') {
    const score =
      m.teamAScore !== null && m.teamBScore !== null ? ` (${m.teamAScore}-${m.teamBScore})` : '';
    return { text: `COMPLETED${score}`, color: 'text-emerald-400' };
  }
  if (m.status === 'CANCELLED' || m.status === 'ABANDONED') {
    return { text: m.status, color: 'text-gray-500' };
  }
  return { text: 'SCHEDULED', color: 'text-[#FFD700]' };
}

export default function SportDetailPage() {
  const params = useParams();
  const rawSlug = params?.slug as string;
  const slug = (rawSlug || '').toLowerCase();

  const [activeTab, setActiveTab] = useState<'overview' | 'teams' | 'fixtures' | 'rules'>(
    'overview',
  );

  const [sportsLoading, setSportsLoading] = useState(true);
  const [matchedSport, setMatchedSport] = useState<Sport | null>(null);

  const [detailsLoading, setDetailsLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [podium, setPodium] = useState<SportMedal[]>([]);

  useEffect(() => {
    apiGet<Sport[]>('/sports')
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        const found = list.find((s) => slugify(s.name) === slug) || null;
        setMatchedSport(found);
        setSportsLoading(false);
      })
      .catch(() => {
        setMatchedSport(null);
        setSportsLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      if (!matchedSport) {
        setDetailsLoading(false);
        return;
      }
      setDetailsLoading(true);
      Promise.all([
        apiGet<Tournament[]>(`/tournaments?sportId=${matchedSport.id}`).catch(() => []),
        apiGet<Team[]>(`/teams?sportId=${matchedSport.id}`).catch(() => []),
        apiGet<Match[]>(`/matches?sportId=${matchedSport.id}`).catch(() => []),
        apiGet<SportMedal[]>(`/results/medals?sportId=${matchedSport.id}`).catch(() => []),
      ]).then(([tournaments, teamList, matchList, medals]) => {
        if (cancelled) return;
        setTournament(tournaments && tournaments.length > 0 ? tournaments[0] : null);
        setTeams(Array.isArray(teamList) ? teamList : []);
        setMatches(Array.isArray(matchList) ? matchList : []);
        setPodium(Array.isArray(medals) ? medals : []);
        setDetailsLoading(false);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [matchedSport]);

  const sport = useMemo(() => {
    const name = matchedSport?.name
      ? `${matchedSport.name.toUpperCase()} CHAMPIONSHIP`
      : `${slug.toUpperCase()} CHAMPIONSHIP`;
    const ptsWeight = tournament
      ? `${tournament.pointsForWin ?? 3} Win • ${tournament.pointsForDraw ?? 1} Draw • ${tournament.pointsForLoss ?? 0} Loss`
      : 'Points not published';
    const format = tournament ? `${tournament.format} Format` : 'Format not published';
    const primaryVenue = matches.find((m) => m.venue?.name)?.venue?.name || 'Venue to be announced';

    return {
      name,
      subtitle: tournament?.name || 'Tournament pending',
      dates: matches.length
        ? `${formatClockTime(matches[0].scheduledStartTime)} onwards`
        : 'Dates not published',
      venue: primaryVenue,
      teamsCount: teams.length,
      fixturesCount: matches.length,
      format,
      ptsWeight,
      quote: '',
      description: matchedSport?.description || 'Description not published',
      rules: tournament?.rulesJson
        ? Object.entries(tournament.rulesJson).map(
            ([key, value]) =>
              `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`,
          )
        : ['Official rules have not been published yet.'],
    };
  }, [matchedSport, tournament, teams, matches, slug]);

  return (
    <div className="min-h-screen flex flex-col bg-[#121114] text-[#E8E6EB]">
      <LiveTickerRibbon />
      <Navbar />

      {/* Main Header Tri-Gradient Accent Line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-[#800020] via-[#FF4500] to-[#FFD700]"></div>

      <main className="flex-1 w-full bg-[#121114]">
        {/* Breadcrumb Bar */}
        <section className="w-full bg-[#0E0D10] border-b border-white/5 py-3 px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1720px] mx-auto flex items-center justify-between">
            <nav className="flex items-center gap-2 font-display text-xs uppercase tracking-widest text-white/60">
              <Link className="hover:text-[#FFD700] transition-colors" href="/">
                Home
              </Link>
              <span className="text-white/20">/</span>
              <Link className="hover:text-[#FFD700] transition-colors" href="/sports">
                Sports
              </Link>
              <span className="text-white/20">/</span>
              <span className="text-[#FFD700] font-bold">{sport.name}</span>
            </nav>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FF4500] animate-pulse"></span>
              <span className="font-display text-xs font-bold uppercase text-[#FF4500] tracking-widest">
                AIU SANCTIONED EVENT
              </span>
            </div>
          </div>
        </section>

        {sportsLoading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-2 border-[#FFD700] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <span className="font-mono text-xs uppercase tracking-widest text-gray-400">
              Loading sport from database...
            </span>
          </div>
        ) : !matchedSport ? (
          <div className="py-24 text-center px-4">
            <h1 className="font-display text-2xl text-white uppercase font-bold">
              Sport Not Found
            </h1>
            <p className="text-sm text-gray-400 mt-2">
              &ldquo;{slug}&rdquo; does not match any sanctioned discipline for this event.
            </p>
            <Link
              href="/sports"
              className="inline-block mt-4 text-xs font-display font-bold text-[#FFD700] uppercase tracking-wider"
            >
              ← Back to Sports Directory
            </Link>
          </div>
        ) : (
          <>
            {/* Editorial Hero Section */}
            <section className="w-full relative overflow-hidden py-10 lg:py-14 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#121114] via-[#16141A] to-[#121114] border-b border-white/5">
              <div className="max-w-[1720px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="flex flex-col gap-5 max-w-3xl">
                  <div className="flex items-center gap-3">
                    <span className="px-3.5 py-1 bg-[#701A2B]/60 border border-[#701A2B] text-white font-display text-xs uppercase tracking-widest font-semibold rounded-lg">
                      {sport.dates}
                    </span>
                    <span className="px-3 py-1 bg-[#1A181D] border border-white/10 text-[#FFD700] font-display text-xs uppercase tracking-widest font-medium rounded-lg">
                      {sport.venue}
                    </span>
                  </div>

                  <div>
                    <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold uppercase tracking-tight text-white leading-none">
                      {sport.name}
                    </h1>
                    <p className="font-display text-lg uppercase tracking-widest text-[#FF4500] font-semibold mt-2">
                      {sport.quote}
                    </p>
                  </div>

                  <p className="text-sm sm:text-base text-white/70 leading-relaxed">
                    {sport.description}
                  </p>

                  {/* Quick Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="bg-[#1A181D] border border-white/5 p-4 rounded-xl flex flex-col">
                      <span className="font-display text-3xl font-bold text-[#FFD700]">
                        {detailsLoading ? '—' : String(sport.teamsCount).padStart(2, '0')}
                      </span>
                      <span className="font-display text-xs uppercase tracking-wider text-white/50 mt-1">
                        Varsity Teams
                      </span>
                    </div>
                    <div className="bg-[#1A181D] border border-white/5 p-4 rounded-xl flex flex-col">
                      <span className="font-display text-3xl font-bold text-[#FF4500]">
                        {detailsLoading ? '—' : sport.fixturesCount}
                      </span>
                      <span className="font-display text-xs uppercase tracking-wider text-white/50 mt-1">
                        Total Fixtures
                      </span>
                    </div>
                    <div className="bg-[#1A181D] border border-white/5 p-4 rounded-xl flex flex-col">
                      <span className="font-display text-xl font-bold text-white truncate">
                        {sport.ptsWeight}
                      </span>
                      <span className="font-display text-xs uppercase tracking-wider text-white/50 mt-1">
                        Pts Formula
                      </span>
                    </div>
                    <div className="bg-[#1A181D] border border-white/5 p-4 rounded-xl flex flex-col">
                      <span className="font-display text-2xl font-bold text-[#FFD700]">
                        {matches.some((m) => m.status === 'LIVE') ? 'LIVE' : 'READY'}
                      </span>
                      <span className="font-display text-xs uppercase tracking-wider text-white/50 mt-1">
                        Broadcast Ready
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Action Links Card */}
                <div className="bg-[#1A181D] border border-white/10 p-6 rounded-2xl flex flex-col gap-4 min-w-[320px] shadow-2xl">
                  <span className="text-xs font-mono uppercase text-[#FFD700] tracking-wider font-bold">
                    CHAMPIONSHIP ACTIONS
                  </span>
                  <a
                    href="/bracket"
                    className="py-3 px-4 rounded-xl bg-[#701A2B] hover:bg-[#882236] text-white font-display text-xs font-bold uppercase tracking-wider transition-all text-center border border-[#FFD700]/30 shadow-md"
                  >
                    View Tournament Tree Bracket →
                  </a>
                  <a
                    href="/standings"
                    className="py-3 px-4 rounded-xl bg-[#221F27] hover:bg-[#2d2934] text-white font-display text-xs font-bold uppercase tracking-wider transition-all text-center border border-white/10"
                  >
                    Medal Tally Leaderboard →
                  </a>
                  <a
                    href="/campus-map"
                    className="py-3 px-4 rounded-xl bg-[#221F27] hover:bg-[#2d2934] text-white font-display text-xs font-bold uppercase tracking-wider transition-all text-center border border-white/10"
                  >
                    Venue Map &amp; Navigation →
                  </a>
                </div>
              </div>
            </section>

            {/* Podium — fetched from /results/medals, only shown once results are declared */}
            {podium.length > 0 && (
              <section className="px-4 sm:px-6 lg:px-8 py-6 bg-[#0c0a0d] border-b border-white/10">
                <div className="max-w-[1720px] mx-auto">
                  <span className="text-xs font-mono uppercase text-[#FFD700] tracking-wider font-bold block mb-3">
                    PODIUM
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {(['GOLD', 'SILVER', 'BRONZE'] as const).map((type) => {
                      const winner = podium.find((m) => m.type === type);
                      if (!winner) return null;
                      const color =
                        type === 'GOLD'
                          ? 'text-[#FFD700] border-[#FFD700]/40'
                          : type === 'SILVER'
                            ? 'text-gray-300 border-gray-400/40'
                            : 'text-[#D9832E] border-[#D9832E]/40';
                      return (
                        <div
                          key={type}
                          className={`px-4 py-3 rounded-xl bg-[#1A181D] border ${color} flex items-center gap-3 min-w-[220px]`}
                        >
                          <span
                            className={`font-display text-xs font-bold uppercase tracking-wider ${color}`}
                          >
                            {type}
                          </span>
                          <span className="font-display text-sm font-semibold text-white truncate">
                            {winner.institute?.shortName || winner.institute?.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* Tab Navigation Strip */}
            <section className="sticky top-20 z-40 w-full bg-[#151318]/95 backdrop-blur-md border-b border-white/10 shadow-lg px-4 sm:px-6 lg:px-8">
              <div className="max-w-[1720px] mx-auto flex items-center gap-4 py-2.5">
                {[
                  { key: 'overview', label: '1. Overview & Format' },
                  { key: 'teams', label: `2. Teams (${teams.length})` },
                  { key: 'fixtures', label: `3. Schedule & Fixtures (${matches.length})` },
                  { key: 'rules', label: '4. Rules & Guidelines' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() =>
                      setActiveTab(tab.key as 'overview' | 'teams' | 'fixtures' | 'rules')
                    }
                    className={`px-4 py-2 rounded-lg font-display text-xs uppercase tracking-wider transition-all ${
                      activeTab === tab.key
                        ? 'bg-[#701A2B] text-[#FFD700] font-bold border border-[#FFD700]/40 shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Tab Contents */}
            <section className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-[#1A181D] border border-white/10 p-6 rounded-xl space-y-4">
                    <h3 className="text-xl font-display font-bold text-white uppercase tracking-wide">
                      Tournament Format
                    </h3>
                    <p className="text-sm text-gray-300 leading-relaxed">{sport.format}</p>
                    <div className="p-4 rounded-lg bg-[#0E0D10] border border-white/5 space-y-2 text-xs font-mono">
                      <div className="text-[#FFD700]">Weighting: {sport.ptsWeight}</div>
                      <div className="text-gray-400">Venue: {sport.venue}</div>
                      <div className="text-emerald-400">Status: {matchedSport.status}</div>
                    </div>
                  </div>

                  <div className="bg-[#1A181D] border border-white/10 p-6 rounded-xl space-y-4">
                    <h3 className="text-xl font-display font-bold text-white uppercase tracking-wide">
                      Championship Pathway
                    </h3>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      Seeded single-elimination knockout tree. Seed 1 and Seed 2 are separated into
                      opposite bracket halves to guarantee maximum competitive integrity.
                    </p>
                    <a
                      href="/bracket"
                      className="inline-block text-xs font-display font-bold text-[#FF4500] hover:text-[#FFD700] uppercase tracking-wider"
                    >
                      Explore Interactive Bracket Tree →
                    </a>
                  </div>
                </div>
              )}

              {activeTab === 'teams' &&
                (detailsLoading ? (
                  <div className="py-16 text-center bg-[#1A181D] border border-white/10 rounded-xl">
                    <p className="text-gray-400 text-xs font-mono uppercase tracking-widest">
                      Loading registered teams...
                    </p>
                  </div>
                ) : teams.length === 0 ? (
                  <div className="py-16 text-center bg-[#1A181D] border border-white/10 rounded-xl">
                    <p className="text-gray-400 text-sm">
                      No teams have been registered for this sport yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {teams.map((t) => (
                      <div
                        key={t.id}
                        className="bg-[#1A181D] border border-white/10 p-5 rounded-xl hover:border-[#FFD700]/50 transition-all shadow-md"
                      >
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#701A2B] text-[#FFD700] font-bold uppercase inline-block mb-2">
                          {teamCodeFromName(t.institute?.shortName || t.name)}
                        </span>
                        <h4 className="text-lg font-display font-bold text-white uppercase leading-snug">
                          {t.name}
                        </h4>
                        <div className="text-xs text-gray-400 mt-2 space-y-1">
                          <div>
                            Institute:{' '}
                            <span className="text-white">{t.institute?.name || 'TBD'}</span>
                          </div>
                          <div>Roster: {t._count?.members ?? 0} Players registered</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

              {activeTab === 'fixtures' &&
                (detailsLoading ? (
                  <div className="py-16 text-center bg-[#1A181D] border border-white/10 rounded-xl">
                    <p className="text-gray-400 text-xs font-mono uppercase tracking-widest">
                      Loading scheduled fixtures...
                    </p>
                  </div>
                ) : matches.length === 0 ? (
                  <div className="py-16 text-center bg-[#1A181D] border border-white/10 rounded-xl">
                    <p className="text-gray-400 text-sm">
                      No fixtures have been scheduled for this sport yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {matches.map((m) => {
                      const statusInfo = matchStatusDisplay(m);
                      return (
                        <div
                          key={m.id}
                          className="bg-[#1A181D] border border-white/10 p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <span className="font-display font-bold text-sm text-[#FFD700] uppercase">
                                {m.stage?.name || m.tournament?.name || 'Fixture'}
                              </span>
                              <span className="text-xs font-mono text-gray-400">
                                {m.venue?.name || 'Venue TBD'}
                              </span>
                            </div>
                            <div className="text-base font-display font-bold text-white uppercase">
                              {m.teamA?.name || 'TBD'} vs {m.teamB?.name || 'TBD'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-mono text-gray-400">
                              {formatClockTime(m.scheduledStartTime)}
                            </div>
                            <div
                              className={`text-sm font-display font-bold uppercase mt-0.5 ${statusInfo.color}`}
                            >
                              {statusInfo.text}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}

              {activeTab === 'rules' && (
                <div className="bg-[#1A181D] border border-white/10 p-6 rounded-xl space-y-4">
                  <h3 className="text-xl font-display font-bold text-white uppercase tracking-wide">
                    Official Rules &amp; Sanctioned Guidelines
                  </h3>
                  <ul className="space-y-3 text-sm text-gray-300">
                    {sport.rules.map((rule, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700] mt-2 shrink-0"></span>
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
