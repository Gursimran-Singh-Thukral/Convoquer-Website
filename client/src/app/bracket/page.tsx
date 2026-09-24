'use client';
import { EventDates } from '@/components/EventDates';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { LiveTickerRibbon } from '@/components/LiveTickerRibbon';
import { Footer } from '@/components/Footer';
import {
  apiGet,
  teamCodeFromName,
  type Sport,
  type Tournament,
  type TournamentStage,
  type Match,
} from '@/lib/api';

function matchStatusLabel(status: string): string {
  const s = (status || '').toUpperCase();
  if (s === 'LIVE') return 'LIVE NOW';
  if (s === 'PAUSED') return 'PAUSED';
  if (s === 'COMPLETED') return 'Completed';
  if (s === 'SCHEDULED' || s === 'RESCHEDULED') return 'Upcoming';
  if (s === 'POSTPONED') return 'Postponed';
  if (s === 'CANCELLED') return 'Cancelled';
  if (s === 'ABANDONED') return 'Abandoned';
  return status || 'TBD';
}

function scoreLabel(score: number | null): string {
  return score === null || score === undefined ? '-' : String(score);
}

function BracketTeamRow({
  team,
  score,
  isWinner,
  seedNumber,
}: {
  team?: { name: string; institute?: { name: string; shortName: string | null } | null } | null;
  score: number | null;
  isWinner: boolean;
  seedNumber?: number;
}) {
  const name = team?.name || 'TBD';
  const code = team ? teamCodeFromName(team.institute?.shortName || team.name) : 'TBD';
  return (
    <div
      className={`flex items-center justify-between p-2 rounded ${
        isWinner ? 'bg-[#151316] border border-emerald-500/30' : 'bg-black/20'
      }`}
    >
      <div className="flex items-center gap-2 truncate">
        <span className="px-1.5 py-0.5 rounded bg-[#701A2B] text-[#FFD700] font-mono text-[10px] font-bold">
          {code}
        </span>
        <span
          className={`text-xs font-display font-semibold truncate ${
            isWinner ? 'text-white font-bold' : 'text-gray-400'
          }`}
        >
          {name}
        </span>
        {seedNumber && (
          <span className="text-[9px] font-mono text-[#FFD700] bg-[#FFD700]/10 px-1 rounded">
            Seed {seedNumber}
          </span>
        )}
      </div>
      <span
        className={`font-mono text-xs font-bold ${isWinner ? 'text-emerald-400' : 'text-gray-400'}`}
      >
        {scoreLabel(score)}
      </span>
    </div>
  );
}

export default function TournamentBracketPage() {
  const [sports, setSports] = useState<Sport[]>([]);
  const [selectedSportId, setSelectedSportId] = useState<string>('');
  const [sportsLoading, setSportsLoading] = useState(true);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [tournamentLoading, setTournamentLoading] = useState(false);
  const [tournamentError, setTournamentError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      apiGet<Sport[]>('/sports')
        .then((data) => {
          if (cancelled) return;
          const list = Array.isArray(data) ? data : [];
          setSports(list);
          if (list.length > 0) setSelectedSportId(list[0].id);
          setSportsLoading(false);
        })
        .catch(() => {
          if (!cancelled) {
            setSports([]);
            setSportsLoading(false);
          }
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled || !selectedSportId) {
        setTournament(null);
        return;
      }
      setTournamentLoading(true);
      setTournamentError(null);
      apiGet<Tournament[]>(`/tournaments?sportId=${selectedSportId}`)
        .then((list) => {
          if (cancelled) return;
          const candidates = Array.isArray(list) ? list : [];
          const withMatches = candidates.find((t) => (t._count?.matches ?? 0) > 0) || candidates[0];
          if (!withMatches) {
            setTournament(null);
            setTournamentLoading(false);
            return;
          }
          return apiGet<Tournament>(`/tournaments/${withMatches.id}`).then((detail) => {
            if (cancelled) return;
            setTournament(detail);
            setTournamentLoading(false);
          });
        })
        .catch(() => {
          if (!cancelled) {
            setTournament(null);
            setTournamentError('Unable to load the bracket for this sport right now.');
            setTournamentLoading(false);
          }
        });
    });
    return () => {
      cancelled = true;
    };
  }, [selectedSportId]);

  const seedByTeamId = new Map<string, number>();
  for (const seed of tournament?.seeds || []) {
    seedByTeamId.set(seed.teamId, seed.seedNumber);
  }

  const stages: TournamentStage[] = (tournament?.stages || [])
    .slice()
    .sort((a, b) => a.sequence - b.sequence);

  return (
    <div className="min-h-screen flex flex-col bg-[#121114] text-[#E8E6EB]">
      <LiveTickerRibbon />
      <Navbar />

      {/* Header Accent Line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-[#800020] via-[#FF4500] to-[#FFD700]"></div>

      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Breadcrumb & Live Meta Stats */}
        <section className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 font-display uppercase tracking-wider">
            <Link className="hover:text-[#FFD700] transition-colors" href="/">
              HOME
            </Link>
            <span className="text-gray-600">/</span>
            <Link className="hover:text-[#FFD700] transition-colors" href="/sports">
              SPORTS
            </Link>
            <span className="text-gray-600">/</span>
            <span className="text-[#FF4500] font-bold">KNOCKOUT BRACKET</span>
          </div>

          <div className="flex items-center gap-2.5 font-mono text-xs">
            <span className="px-3 py-1 rounded bg-[#1C191E] border border-white/10 text-[#FFD700] font-semibold">
              <EventDates />
            </span>
          </div>
        </section>

        {/* Title & Sport Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-8 bg-gradient-to-b from-[#FF4500] to-[#FFD700] rounded-sm"></div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-display uppercase tracking-wide text-white font-bold">
                {tournament ? tournament.name : 'Tournament Bracket'}
              </h1>
            </div>
          </div>

          {sportsLoading ? (
            <span className="text-xs font-mono text-gray-500">Loading sports...</span>
          ) : (
            <div className="flex items-center gap-2 bg-[#1C191E] p-1 rounded-lg border border-white/10 self-start md:self-auto flex-wrap">
              {sports.map((sport) => (
                <button
                  key={sport.id}
                  onClick={() => setSelectedSportId(sport.id)}
                  className={`px-4 py-1.5 rounded text-xs font-display uppercase font-bold tracking-wider transition-all ${
                    selectedSportId === sport.id
                      ? 'bg-[#701A2B] text-[#FFD700] border border-[#FFD700]/50'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {sport.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tournament Tree Visualization Container */}
        <div className="bg-[#151316]/95 border border-white/10 rounded-2xl p-6 lg:p-8 shadow-2xl overflow-x-auto">
          {tournamentLoading ? (
            <div className="py-16 text-center text-gray-400 font-mono text-xs">
              Loading bracket from the championship database...
            </div>
          ) : tournamentError ? (
            <div className="py-16 text-center text-red-400 font-mono text-xs">
              {tournamentError}
            </div>
          ) : !tournament || stages.length === 0 ? (
            <div className="py-16 text-center text-gray-400 font-sans text-sm">
              No knockout bracket has been configured for this sport yet.
            </div>
          ) : (
            <div
              className="grid gap-8 items-start py-4"
              style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(280px, 1fr))` }}
            >
              {stages.map((stage, stageIdx) => {
                const isFinalStage = stageIdx === stages.length - 1 && stages.length > 1;
                return (
                  <div key={stage.id} className="space-y-6">
                    <div className="font-display font-bold text-xs uppercase tracking-widest text-[#FFD700] border-b border-white/10 pb-2 flex items-center justify-between">
                      <span>{stage.name}</span>
                      <span className="font-mono text-[10px] text-gray-400">
                        {stage.matches?.length ?? 0} FIXTURE
                        {(stage.matches?.length ?? 0) === 1 ? '' : 'S'}
                      </span>
                    </div>

                    {(stage.matches || []).length === 0 ? (
                      <div className="text-xs font-mono text-gray-500 py-6 text-center border border-dashed border-white/10 rounded-xl">
                        Fixtures not yet scheduled
                      </div>
                    ) : (
                      (stage.matches || []).map((m: Match) => {
                        const isLive = (m.status || '').toUpperCase() === 'LIVE';
                        const teamAWins = !!m.winnerTeamId && m.winnerTeamId === m.teamAId;
                        const teamBWins = !!m.winnerTeamId && m.winnerTeamId === m.teamBId;

                        return (
                          <div
                            key={m.id}
                            className={
                              isFinalStage
                                ? 'bg-gradient-to-b from-[#701A2B]/40 via-[#221E24] to-[#151316] border-2 border-[#FFD700] rounded-2xl p-5 shadow-[0_0_30px_rgba(255,215,0,0.15)]'
                                : 'bg-[#221E24] border border-white/10 rounded-xl p-3 shadow-md hover:border-[#FFD700]/50 transition-all'
                            }
                          >
                            <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 mb-2">
                              <span
                                className={`font-bold ${isFinalStage ? 'text-[#FFD700]' : 'text-[#FF4500]'}`}
                              >
                                {m.matchNumber || stage.name}
                              </span>
                              <span
                                className={isLive ? 'text-[#FF4500] font-bold animate-pulse' : ''}
                              >
                                {matchStatusLabel(m.status)}
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              <BracketTeamRow
                                team={m.teamA}
                                score={m.teamAScore}
                                isWinner={teamAWins}
                                seedNumber={m.teamAId ? seedByTeamId.get(m.teamAId) : undefined}
                              />
                              <BracketTeamRow
                                team={m.teamB}
                                score={m.teamBScore}
                                isWinner={teamBWins}
                                seedNumber={m.teamBId ? seedByTeamId.get(m.teamBId) : undefined}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
