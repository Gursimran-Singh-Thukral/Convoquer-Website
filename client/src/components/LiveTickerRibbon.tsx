'use client';

import React, { useEffect, useState } from 'react';
import { fetchMatches, Match } from '@/lib/api';
import { formatScoreLine } from '@/lib/scoreDetails';

interface TickerItem {
  match: string;
  score: string;
  status: string;
}

export const LiveTickerRibbon: React.FC = () => {
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([]);

  useEffect(() => {
    const load = () =>
      fetchMatches()
        .then((backendMatches) => {
          const liveMatches = (backendMatches || []).filter(
            (m: Match) => m.status === 'LIVE' && m.isTelecast,
          );
          {
            const mapped = liveMatches.map((m: Match) => {
              const sportName = m.tournament?.sport?.name || 'MATCH';
              const matchNum = m.matchNumber || '';
              const teamAName = m.teamA?.name || 'Team A';
              const teamBName = m.teamB?.name || 'Team B';
              const score =
                m.teamAScore !== null && m.teamBScore !== null
                  ? formatScoreLine(m, teamAName, teamBName)
                  : `${teamAName} vs ${teamBName}`;

              return {
                match: `${sportName.toUpperCase()} ${matchNum}`.trim(),
                score,
                status: m.currentPeriod || m.status,
              };
            });
            setTickerItems(mapped);
          }
        })
        .catch(() => setTickerItems([]));
    void load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="w-full bg-[#0B0A0C] border-b border-white/10 overflow-hidden py-1.5 px-4 text-xs font-mono select-none">
      <div className="max-w-[1720px] mx-auto flex items-center gap-3">
        <div className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 bg-[#D95D39]/20 text-[#D95D39] border border-[#D95D39]/30 rounded text-[10px] font-display uppercase tracking-widest font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D95D39] pulse-dot" />
          ARENA WIRE
        </div>
        <div className="overflow-hidden relative w-full">
          {!tickerItems.length && <span className="text-gray-400">No live scores published</span>}
          <div className="animate-ticker flex items-center space-x-8">
            {[...tickerItems, ...tickerItems].map((item, idx) => (
              <div key={idx} className="inline-flex items-center space-x-2 text-gray-300 shrink-0">
                <span className="font-display font-medium text-[#D4AF37] uppercase tracking-wide">
                  {item.match}
                </span>
                <span className="text-white font-medium">{item.score}</span>
                <span className="px-1.5 py-0.2 bg-[#1B191E] rounded text-[10px] text-gray-400 border border-white/5">
                  {item.status}
                </span>
                <span className="text-gray-600 ml-3">•</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
