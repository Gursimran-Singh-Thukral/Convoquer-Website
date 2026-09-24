'use client';

import React, { useEffect, useState } from 'react';
import { fetchMedalTally, MedalTallyRow } from '@/lib/api';

interface StandingItem {
  id: string;
  rank: string;
  code: string;
  name: string;
  sub: string;
  gold: number;
  silver: number;
  bronze: number;
  points: number;
  isHost?: boolean;
}

export const MedalTallySection: React.FC = () => {
  const [standings, setStandings] = useState<StandingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMedalTally()
      .then((tally: MedalTallyRow[]) => {
        setIsLoading(false);
        if (tally && tally.length > 0) {
          const mapped: StandingItem[] = tally.map((item, idx) => ({
            id: item.instituteId,
            rank: String(item.rank || idx + 1).padStart(2, '0'),
            code: item.instituteCode,
            name: item.instituteName,
            sub: item.isHost ? 'Host Delegation • BSA' : 'Participating Delegation',
            gold: item.gold,
            silver: item.silver,
            bronze: item.bronze,
            points: item.totalPoints,
            isHost: item.isHost,
          }));
          setStandings(mapped);
        }
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);
  return (
    <section
      className="py-16 bg-[#121114] border-b border-white/10"
      data-purpose="medal-tally-section"
      id="standings"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            {/* <span className="text-xs font-display font-medium uppercase tracking-widest text-[#D95D39]">
              Delegation Supremacy
            </span> */}
            <h2 className="font-display font-black text-3xl sm:text-4xl text-white uppercase tracking-tight mt-1">
              MEDAL TALLY <span className="text-[#D4AF37]">SNAPSHOT</span>
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Aggregated overall points standings across registered sports.
            </p>
          </div>
          {/* <div className="text-xs font-mono text-gray-400">
            Last updated: 13:45 IST • AIU Scored
          </div> */}
        </div>

        {/* Medal Standings Table Container */}
        <div className="bg-[#1B191E]/70 border border-white/10 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto soft-scrollbar">
            <table className="w-full min-w-[500px] text-left border-collapse" id="medal-table">
              <thead>
                <tr className="bg-[#121114]/80 border-b border-white/10 text-[11px] font-display uppercase tracking-widest text-gray-400">
                  <th className="py-3.5 px-4 sm:px-6">Rank &amp; University</th>
                  <th className="py-3.5 px-4 text-center text-[#D4AF37] font-medium">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#D4AF37] inline-block" /> Gold
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-center text-gray-300 font-medium">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> Silver
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-center text-amber-500 font-medium">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Bronze
                    </span>
                  </th>
                  <th className="py-3.5 px-4 sm:px-6 text-right font-medium text-white">
                    Total Points
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400 font-mono text-xs">
                      Loading official standings from championship database...
                    </td>
                  </tr>
                ) : standings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400 font-sans text-sm">
                      Medal awards will appear once published by the organizing team.
                    </td>
                  </tr>
                ) : (
                  standings.map((row) => (
                    <tr
                      key={row.id}
                      className={`transition-colors ${
                        row.isHost ? 'hover:bg-[#701A2B]/20 bg-[#701A2B]/10' : 'hover:bg-white/5'
                      }`}
                    >
                      <td className="py-4 px-4 sm:px-6 flex items-center gap-3">
                        <span
                          className={`font-display font-bold text-lg w-6 ${
                            row.rank === '01'
                              ? 'text-[#D4AF37]'
                              : row.rank === '02'
                                ? 'text-gray-300'
                                : row.rank === '03'
                                  ? 'text-amber-500'
                                  : 'text-gray-400'
                          }`}
                        >
                          {row.rank}
                        </span>
                        <div
                          className={`w-8 h-8 rounded flex items-center justify-center font-display font-bold text-xs ${
                            row.isHost
                              ? 'bg-[#701A2B]/80 border border-[#D4AF37]/40 text-[#D4AF37]'
                              : 'bg-[#27242C] border border-white/10 text-gray-300'
                          }`}
                        >
                          {row.code}
                        </div>
                        <div>
                          <span className="font-display font-bold text-base text-white tracking-wide block">
                            {row.name}
                          </span>
                          <span className="text-[11px] text-[#D4AF37]/80 font-medium uppercase tracking-wider">
                            {row.sub}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center font-mono font-bold text-[#D4AF37] text-base">
                        {row.gold}
                      </td>
                      <td className="py-4 px-4 text-center font-mono font-medium text-gray-300 text-base">
                        {row.silver}
                      </td>
                      <td className="py-4 px-4 text-center font-mono font-medium text-amber-400 text-base">
                        {row.bronze}
                      </td>
                      <td
                        className={`py-4 px-4 sm:px-6 text-right font-mono font-bold text-lg ${
                          row.isHost ? 'text-[#D4AF37]' : 'text-white'
                        }`}
                      >
                        {row.points} PTS
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Standings CTA */}
          <div className="p-4 bg-[#121114]/80 border-t border-white/10 text-center">
            <a
              className="inline-flex items-center gap-2 text-sm font-display font-medium uppercase tracking-wider text-[#D4AF37] hover:text-white transition-colors"
              href="#full-standings"
            >
              <span>VIEW FULL STANDINGS &amp; MEDAL BREAKDOWN</span>
              <svg
                className="w-4 h-4 text-[#D95D39]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
