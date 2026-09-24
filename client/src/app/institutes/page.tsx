'use client';
import { EventDates } from '@/components/EventDates';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { LiveTickerRibbon } from '@/components/LiveTickerRibbon';
import { Footer } from '@/components/Footer';
import { apiGet, fetchMedalTally, type Institute, type Team, type MedalTallyRow } from '@/lib/api';

interface InstituteData {
  id: string;
  name: string;
  shortName: string;
  category: 'IIT' | 'NIT' | 'REGIONAL';
  location: string;
  aiuCode: string;
  athletesCount: number;
  disciplinesCount: number;
  lead: string;
  statusBadge: string;
  isHost?: boolean;
  medals: { gold: number; silver: number; bronze: number; points: number };
  squads: {
    sport: string;
    captain: string;
    playersCount: number;
    bestFinish: string;
    players: string[];
  }[];
}

function categoryFor(name: string, shortName: string | null): InstituteData['category'] {
  const text = `${name} ${shortName || ''}`.toLowerCase();
  if (text.includes('nit')) return 'NIT';
  if (text.includes('iit')) return 'IIT';
  return 'REGIONAL';
}

function mapInstitute(inst: Institute, tallyRow: MedalTallyRow | undefined): InstituteData {
  const shortName = inst.shortName || inst.name.slice(0, 6).toUpperCase();
  const isHost = tallyRow?.isHost ?? inst.name.toLowerCase().includes('iit jammu');
  return {
    id: inst.id,
    name: inst.name,
    shortName,
    category: categoryFor(inst.name, inst.shortName),
    location: [inst.city, inst.state].filter(Boolean).join(', ') || 'Location TBA',
    aiuCode: `INST-${inst.id.slice(0, 8).toUpperCase()}`,
    athletesCount: inst._count?.participants ?? 0,
    disciplinesCount: inst._count?.teams ?? 0,
    lead: 'Institute Sports Office',
    statusBadge: isHost ? 'HOST DELEGATION' : 'PARTICIPATING DELEGATION',
    isHost,
    medals: {
      gold: tallyRow?.gold ?? 0,
      silver: tallyRow?.silver ?? 0,
      bronze: tallyRow?.bronze ?? 0,
      points: tallyRow?.totalPoints ?? 0,
    },
    squads: [],
  };
}

export default function InstitutesPage() {
  const [institutes, setInstitutes] = useState<InstituteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [filter, setFilter] = useState<'ALL' | 'IIT' | 'NIT' | 'REGIONAL'>('ALL');
  const [squads, setSquads] = useState<InstituteData['squads']>([]);
  const [squadsLoading, setSquadsLoading] = useState(false);

  useEffect(() => {
    Promise.all([apiGet<Institute[]>('/institutes'), fetchMedalTally()])
      .then(([data, tally]) => {
        const tallyById = new Map(tally.map((row) => [row.instituteId, row]));
        const mapped = Array.isArray(data)
          ? data.map((inst) => mapInstitute(inst, tallyById.get(inst.id)))
          : [];
        setInstitutes(mapped);
        if (mapped.length > 0) setSelectedId(mapped[0].id);
        setIsLoading(false);
      })
      .catch(() => {
        setInstitutes([]);
        setIsLoading(false);
      });
  }, []);

  const selectedInst = useMemo(
    () => institutes.find((i) => i.id === selectedId) || institutes[0],
    [institutes, selectedId],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      if (!selectedInst) {
        setSquads([]);
        return;
      }
      setSquadsLoading(true);
      apiGet<Team[]>(`/teams?instituteId=${selectedInst.id}`)
        .then((teams) => {
          if (cancelled) return;
          const mapped = (Array.isArray(teams) ? teams : []).map((t) => ({
            sport: t.sport?.name || 'Sport',
            captain: 'To be confirmed',
            playersCount: t._count?.members ?? 0,
            bestFinish: 'In progress',
            players: [] as string[],
          }));
          setSquads(mapped);
          setSquadsLoading(false);
        })
        .catch(() => {
          if (!cancelled) {
            setSquads([]);
            setSquadsLoading(false);
          }
        });
    });
    return () => {
      cancelled = true;
    };
  }, [selectedInst]);

  const filteredList = institutes.filter((inst) => {
    if (filter === 'ALL') return true;
    return inst.category === filter;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#121114] text-[#E8E6EB]">
      <LiveTickerRibbon />
      <Navbar />

      {/* Subheader / Breadcrumb */}
      <section className="bg-[#121016] border-b border-[#242028] py-3.5">
        <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs uppercase tracking-wider font-display">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              HOME
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-gray-400">DELEGATIONS</span>
            <span className="text-gray-600">/</span>
            <span className="text-[#FFD700] font-semibold">INSTITUTE DIRECTORY</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-display tracking-widest uppercase">
            <div className="flex items-center gap-2 bg-[#1A1720] border border-[#2F2938] px-3 py-1 rounded text-gray-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{institutes.length} PARTICIPATING INSTITUTES</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-[#1A1720] border border-[#2F2938] px-3 py-1 rounded text-[#FFD700]">
              <span>
                <EventDates />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#242028] pb-6 mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="w-1.5 h-6 bg-[#FFD700] rounded-full"></span>
              <h1 className="text-3xl md:text-4xl font-display font-bold uppercase tracking-wide text-white">
                PARTICIPATING INSTITUTES DIRECTORY
              </h1>
            </div>
            <p className="text-sm text-gray-400 max-w-2xl font-sans leading-relaxed">
              Official roster of collegiate delegations sanctioned under AIU regulation for
              Convoquer&apos;26 at IIT Jammu. Select an institution tab to explore contingency
              squads, discipline registrations, and podium records.
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {(['ALL', 'IIT', 'NIT', 'REGIONAL'] as const).map((cat) => {
              const isActive = filter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-3.5 py-1.5 rounded text-xs font-display font-semibold uppercase tracking-wider transition-all ${
                    isActive
                      ? 'bg-[#FFD700] text-black border border-[#FFD700] shadow-md font-bold'
                      : 'bg-[#151318] text-gray-400 border border-[#2A2530] hover:border-gray-500'
                  }`}
                >
                  {cat === 'ALL'
                    ? `ALL (${institutes.length})`
                    : cat === 'IIT'
                      ? `IITS (${institutes.filter((i) => i.category === 'IIT').length})`
                      : cat === 'NIT'
                        ? `NITS (${institutes.filter((i) => i.category === 'NIT').length})`
                        : `REGIONAL & TECH (${institutes.filter((i) => i.category === 'REGIONAL').length})`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Layout: Left Institute Tabs + Right Detailed Profile Panel */}
        {isLoading ? (
          <div className="py-20 text-center bg-[#151318] rounded-xl border border-[#2A2530]">
            <div className="w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400 text-xs font-mono uppercase tracking-widest">
              Loading participating institutes from database...
            </p>
          </div>
        ) : !selectedInst ? (
          <div className="py-20 text-center bg-[#151318] rounded-xl border border-[#2A2530]">
            <p className="text-gray-400 text-sm">
              No institutes have been registered for this event yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT: Tabs of Each Institute (col 1-4) */}
            <div className="lg:col-span-4 flex flex-col gap-2.5">
              <div className="text-[11px] font-display font-semibold uppercase tracking-widest text-gray-400 px-1 mb-1 flex items-center justify-between">
                <span>CONTENDING INSTITUTIONS</span>
                <span className="text-[#FFD700]">SELECT DELEGATION</span>
              </div>

              {filteredList.map((inst) => {
                const isSelected = inst.id === selectedId;
                return (
                  <button
                    key={inst.id}
                    onClick={() => setSelectedId(inst.id)}
                    className={`w-full text-left p-3.5 rounded-lg border transition-all flex items-center justify-between group ${
                      isSelected
                        ? 'border-[#FFD700] bg-[#1C1920] shadow-lg text-[#FFD700]'
                        : 'border-[#2A2530] bg-[#151318] hover:bg-[#1C1920] text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-11 h-11 rounded flex items-center justify-center font-display font-bold text-base border ${
                          isSelected
                            ? 'bg-[#701A2B]/50 border-[#FFD700]/70 text-[#FFD700]'
                            : 'bg-[#1C1A24] border-[#2A2530] text-gray-300 group-hover:text-[#FFD700]'
                        }`}
                      >
                        {inst.shortName}
                      </div>
                      <div>
                        <div className="font-display font-semibold text-white group-hover:text-[#FFD700] transition-colors tracking-wide text-base leading-snug">
                          {inst.name}
                        </div>
                        <div className="text-[11px] text-gray-400 flex items-center gap-2 mt-0.5">
                          <span className={inst.isHost ? 'text-[#FFD700] font-bold' : ''}>
                            {inst.statusBadge}
                          </span>
                          <span>•</span>
                          <span>{inst.athletesCount} Athletes</span>
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-display font-bold px-2 py-0.5 rounded uppercase tracking-wider shrink-0 ml-2 ${
                        isSelected
                          ? 'bg-[#FFD700] text-black'
                          : 'bg-black/40 text-gray-400 group-hover:text-white'
                      }`}
                    >
                      {inst.shortName}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* RIGHT: Detailed Profile Panel (col 5-12) */}
            <div className="lg:col-span-8 bg-[#151318] border border-[#2A2530] rounded-xl p-6 sm:p-8 shadow-xl">
              {/* Header / Hero of Selected Institute */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#2A2530] pb-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-xl bg-[#701A2B]/40 border-2 border-[#FFD700] flex items-center justify-center font-display font-bold text-2xl text-[#FFD700] shadow-md shrink-0">
                    {selectedInst.shortName}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#701A2B] text-[#FFD700] border border-[#FFD700]/30 font-bold uppercase">
                        {selectedInst.category}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">
                        {selectedInst.aiuCode}
                      </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-display font-bold text-white uppercase tracking-wide">
                      {selectedInst.name}
                    </h2>
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                      <span className="flex items-center gap-1">
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
                        {selectedInst.location}
                      </span>
                      <span>•</span>
                      <span>Lead: {selectedInst.lead}</span>
                    </p>
                  </div>
                </div>

                {/* Medal Snapshot Pill */}
                <div className="bg-[#0B0A0D] border border-[#2A2530] p-3 rounded-lg flex items-center gap-4 shrink-0">
                  <div className="text-center">
                    <span className="text-[10px] font-mono text-gray-400 block">AGGREGATE</span>
                    <span className="font-display text-2xl font-bold text-[#FFD700]">
                      {selectedInst.medals.points} <span className="text-xs">PTS</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 border-l border-[#2A2530] pl-4 text-center">
                    <div>
                      <span className="text-[10px] font-mono text-[#FFD700] block font-bold">
                        GOLD
                      </span>
                      <span className="font-display text-lg font-bold text-white">
                        {selectedInst.medals.gold}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-[#CBD5E1] block font-bold">
                        SILVER
                      </span>
                      <span className="font-display text-lg font-bold text-white">
                        {selectedInst.medals.silver}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-[#CD7F32] block font-bold">
                        BRONZE
                      </span>
                      <span className="font-display text-lg font-bold text-white">
                        {selectedInst.medals.bronze}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
                <div className="bg-[#0B0A0D] border border-white/5 p-3 rounded-lg">
                  <span className="text-[10px] font-mono text-gray-400 uppercase block">
                    ATHLETES CONTINGENT
                  </span>
                  <span className="font-display text-xl font-bold text-white">
                    {selectedInst.athletesCount} Registered
                  </span>
                </div>
                <div className="bg-[#0B0A0D] border border-white/5 p-3 rounded-lg">
                  <span className="text-[10px] font-mono text-gray-400 uppercase block">
                    SANCTIONED SPORTS
                  </span>
                  <span className="font-display text-xl font-bold text-[#FFD700]">
                    {selectedInst.disciplinesCount} of 8 Sports
                  </span>
                </div>
                <div className="bg-[#0B0A0D] border border-white/5 p-3 rounded-lg">
                  <span className="text-[10px] font-mono text-gray-400 uppercase block">
                    GATE PASS VERIFICATION
                  </span>
                  <span className="font-display text-xl font-bold text-emerald-400">
                    100% Cleared
                  </span>
                </div>
                <div className="bg-[#0B0A0D] border border-white/5 p-3 rounded-lg">
                  <span className="text-[10px] font-mono text-gray-400 uppercase block">
                    CHAMPIONSHIP STATUS
                  </span>
                  <span className="font-display text-xl font-bold text-white">
                    {selectedInst.statusBadge}
                  </span>
                </div>
              </div>

              {/* Squads & Rosters Accordion */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-display font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#FF4500]"></span>
                    OFFICIAL SQUADS &amp; FIELDED TEAMS
                  </h3>
                  <span className="text-xs font-mono text-gray-400">
                    {squads.length} Disciplines Configured
                  </span>
                </div>

                {squadsLoading ? (
                  <div className="p-8 text-center bg-[#0B0A0D] border border-[#2A2530] rounded-lg">
                    <p className="text-gray-400 text-xs font-mono uppercase tracking-widest">
                      Loading fielded teams...
                    </p>
                  </div>
                ) : squads.length === 0 ? (
                  <div className="p-8 text-center bg-[#0B0A0D] border border-[#2A2530] rounded-lg">
                    <p className="text-gray-400 text-sm">
                      No teams registered for this institute yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {squads.map((squad) => (
                      <div
                        key={squad.sport}
                        className="bg-[#0B0A0D] border border-[#2A2530] rounded-lg p-4.5 hover:border-[#FFD700]/30 transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3 mb-3">
                          <div>
                            <span className="font-display font-bold text-base text-white uppercase tracking-wide">
                              {squad.sport}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="px-2 py-0.5 rounded bg-white/5 text-gray-300 font-mono">
                              {squad.playersCount} Athletes
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
