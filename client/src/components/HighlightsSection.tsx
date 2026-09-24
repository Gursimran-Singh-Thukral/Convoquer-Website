'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { fetchMatches, Match } from '@/lib/api';

interface MatchItem {
  id: string;
  tag: string;
  statusBadge: string;
  statusType: 'completed' | 'live' | 'upcoming';
  team1: { code: string; name: string; score: string; detail?: string; isHost?: boolean };
  team2: { code: string; name: string; score: string; detail?: string };
  venue: string;
  actionText: string;
}

export const HighlightsSection: React.FC = () => {
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMatches()
      .then((backendMatches) => {
        setIsLoading(false);
        if (backendMatches && backendMatches.length > 0) {
          const mapped: MatchItem[] = backendMatches.map((m: Match) => {
            const isLive = m.status === 'LIVE';
            const isCompleted = m.status === 'COMPLETED';
            const sportName = m.tournament?.sport?.name || 'Sport pending';
            const matchNum = m.matchNumber || '';
            const tag = `${sportName.toUpperCase()} • ${matchNum || 'MATCH'}`;

            const team1Name = m.teamA?.name || 'TBD';
            const team1Code =
              m.teamA?.institute?.shortName?.replace(/[^A-Z]/g, '').slice(0, 4) ||
              team1Name.substring(0, 4).toUpperCase();
            const team2Name = m.teamB?.name || 'TBD';
            const team2Code =
              m.teamB?.institute?.shortName?.replace(/[^A-Z]/g, '').slice(0, 4) ||
              team2Name.substring(0, 4).toUpperCase();

            const score1 = m.teamAScore !== null ? String(m.teamAScore) : 'vs';
            const score2 = m.teamBScore !== null ? String(m.teamBScore) : 'Scheduled';

            const statusType: 'completed' | 'live' | 'upcoming' = isLive
              ? 'live'
              : isCompleted
                ? 'completed'
                : 'upcoming';

            const statusBadge = isLive
              ? `${m.currentPeriod || 'LIVE'}`
              : isCompleted
                ? 'COMPLETED'
                : new Date(m.scheduledStartTime).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  }) +
                  ' ' +
                  new Date(m.scheduledStartTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  }) +
                  ' IST';

            return {
              id: m.id,
              tag,
              statusBadge,
              statusType,
              team1: {
                code: team1Code,
                name: team1Name,
                score: score1,
                isHost: team1Name.toLowerCase().includes('iit jammu'),
              },
              team2: {
                code: team2Code,
                name: team2Name,
                score: score2,
              },
              venue: m.venue?.name
                ? `${m.venue.name} • ${m.venue.location || 'TBD'}`
                : 'Venue pending',
              actionText: isLive
                ? 'Live Arena Stream →'
                : isCompleted
                  ? 'View Match Result →'
                  : 'Fixture Details →',
            };
          });

          setMatches(mapped);
        }
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <section
      className="py-12 bg-[#151317] border-b border-white/10"
      data-purpose="live-action-feed"
      id="highlights"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 bg-[#D95D39]/15 border border-[#D95D39]/30 text-[#D95D39] text-xs font-display font-medium uppercase tracking-wider rounded mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D95D39] pulse-dot" />
              Real-Time Tournament Feed
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-white uppercase tracking-tight">
              ARENA ACTION FEED • <span className="text-[#D4AF37]">FIXTURES &amp; RESULTS</span>
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs font-display text-gray-400">
            <span className="inline-block w-2 h-2 bg-emerald-500/80 rounded-full" /> Completed
            <span className="inline-block w-2 h-2 bg-[#D95D39] rounded-full ml-3" /> Live
            <span className="inline-block w-2 h-2 bg-[#D4AF37] rounded-full ml-3" /> Scheduled
          </div>
        </div>

        {/* Empty or Loaded State */}
        {isLoading ? (
          <div className="py-12 text-center text-gray-400 text-sm font-mono">
            Loading real-time arena feed...
          </div>
        ) : matches.length === 0 ? (
          <div className="bg-[#1B191E] border border-white/10 rounded-xl p-8 text-center max-w-lg mx-auto">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#701A2B]/40 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <h3 className="font-display font-bold text-lg text-white uppercase">
              Fixtures Pending Announcement
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Match draws and schedules will appear here automatically once entered into the
              official tournament registry.
            </p>
          </div>
        ) : (
          /* Horizontal / Responsive Cards Grid */
          <div className="overflow-x-auto flex flex-nowrap gap-4 pb-4 soft-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            {matches.map((m) => {
              const isLive = m.statusType === 'live';
              const isCompleted = m.statusType === 'completed';

              return (
                <article
                  key={m.id}
                  className={`snap-start shrink-0 min-w-[280px] sm:min-w-[340px] md:min-w-[380px] max-w-[400px] bg-[#1B191E] rounded-xl p-4 sm:p-6 flex flex-col justify-between shadow-md transition-all ${
                    isLive
                      ? 'border border-[#D95D39]/40 hover:border-[#D95D39]'
                      : 'border border-[#D4AF37]/30 hover:border-[#D4AF37]/60'
                  }`}
                  data-purpose="match-card"
                >
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <span
                        className={`text-[11px] font-display font-medium uppercase tracking-wider px-2.5 py-1 rounded ${
                          isLive
                            ? 'bg-[#D95D39]/20 text-[#D95D39] border border-[#D95D39]/30'
                            : 'bg-[#701A2B]/60 text-[#E5C158] border border-[#D4AF37]/20'
                        }`}
                      >
                        {m.tag}
                      </span>
                      <span
                        className={`text-xs font-mono font-semibold flex items-center gap-1.5 ${
                          isLive
                            ? 'text-[#D95D39]'
                            : isCompleted
                              ? 'text-emerald-400'
                              : 'text-[#D4AF37]'
                        }`}
                      >
                        {isLive && <span className="w-2 h-2 rounded-full bg-[#D95D39] pulse-dot" />}
                        {isCompleted && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                        {m.statusBadge}
                      </span>
                    </div>

                    <div className="space-y-3.5 my-4">
                      {/* Team 1 */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded flex items-center justify-center font-display text-xs ${
                              m.team1.isHost
                                ? 'bg-[#701A2B]/80 border border-[#D4AF37]/40 font-semibold text-[#D4AF37]'
                                : 'bg-[#27242C] border border-white/10 font-medium text-gray-300'
                            }`}
                          >
                            {m.team1.code}
                          </div>
                          <span className="font-medium text-white text-base">{m.team1.name}</span>
                        </div>
                        <span
                          className={`font-mono font-bold text-base ${
                            isLive ? 'text-[#D95D39] text-lg' : 'text-[#D4AF37]'
                          }`}
                        >
                          {m.team1.score}{' '}
                          {m.team1.detail && (
                            <span className="text-xs text-gray-400 font-normal">
                              {m.team1.detail}
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Team 2 */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded bg-[#27242C] border border-white/10 flex items-center justify-center font-display text-xs font-medium text-gray-300">
                            {m.team2.code}
                          </div>
                          <span className="font-medium text-gray-300 text-base">
                            {m.team2.name}
                          </span>
                        </div>
                        <span className="font-mono text-gray-400 text-base">
                          {m.team2.score}{' '}
                          {m.team2.detail && (
                            <span className="text-xs text-gray-500 font-normal">
                              {m.team2.detail}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 flex items-center gap-2 pt-3 border-t border-white/5">
                      <svg
                        className="w-4 h-4 text-[#D4AF37]/80 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        />
                      </svg>
                      <span>{m.venue}</span>
                    </p>
                  </div>

                  <Link
                    href={`/matches/${m.id}`}
                    className={`block text-center mt-5 w-full py-2 text-xs font-display font-medium uppercase tracking-wider rounded transition-colors cursor-pointer ${
                      isLive
                        ? 'bg-[#701A2B] hover:bg-[#882236] text-white border border-white/10'
                        : 'bg-[#201D24] hover:bg-[#701A2B]/60 text-[#E5C158] border border-white/10 hover:border-[#D4AF37]/30'
                    }`}
                  >
                    {m.actionText}
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
