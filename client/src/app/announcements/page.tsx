'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from '@/components/Navbar';
import { LiveTickerRibbon } from '@/components/LiveTickerRibbon';
import { SponsorsPartnersSection } from '@/components/SponsorsPartnersSection';
import { Footer } from '@/components/Footer';
import { apiGet } from '@/lib/api';

interface AnnouncementRecord {
  id: string;
  heading: string;
  description: string;
  targets: string[];
  createdAt: string;
}

const ACCENT_CYCLE = ['gold', 'carrot', 'burgundy'] as const;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState('LIVE FEED');

  useEffect(() => {
    apiGet<AnnouncementRecord[]>('/announcements/public')
      .then((data) => setAnnouncements(Array.isArray(data) ? data : []))
      .catch(() => setAnnouncements([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      setCurrentTime(`LIVE FEED • ${timeStr} IST`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredAnnouncements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return announcements;
    return announcements.filter(
      (a) => a.heading.toLowerCase().includes(q) || a.description.toLowerCase().includes(q),
    );
  }, [announcements, searchQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-[#121114] text-[#E8E6EB] antialiased selection:bg-[#FF4500] selection:text-white">
      <LiveTickerRibbon />
      <Navbar />

      {/* Tri-color Accent Line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-[#800020] via-[#FF4500] to-[#FFD700]"></div>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-7">
        {/* Hero & Announcement Header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-zinc-800/60">
          <div className="flex flex-col gap-2.5 max-w-3xl">
            {/* Eyebrow Tag */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-lg bg-[#111115] border border-[#FFD700]/40 text-[11px] font-bold uppercase tracking-widest text-[#FFD700] w-fit shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFD700] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FFD700]"></span>
              </span>
              <span>IIT JAMMU ATHLETIC BULLETINS &amp; DISPATCH</span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-display tracking-tight uppercase leading-tight">
              <span className="text-white">OFFICIAL FEST </span>
              <span className="text-[#FF4500]">ANNOUNCEMENTS &amp; BULLETINS</span>
            </h1>

            {/* Subheadline */}
            <p className="text-sm md:text-base text-zinc-400 font-normal leading-relaxed">
              Authoritative time-sensitive alerts, schedule adjustments, venue protocols, and
              collegiate circulars for Convoquer&apos;26 delegations.
            </p>
          </div>

          {/* Live Feed Clock Ticker */}
          <div className="flex items-center gap-3.5 bg-zinc-900/90 border border-zinc-800 px-4 py-2.5 rounded-xl shadow-inner shrink-0 self-start md:self-auto">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
                SYNCHRONIZED FEED
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700] animate-pulse"></span>
                <span className="text-sm sm:text-base font-mono font-bold text-[#FFD700] tracking-wide">
                  {currentTime}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Filter & Search Bar */}
        <section className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800">
          <span className="px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider bg-[#FFD700] text-black shadow-md whitespace-nowrap">
            ALL NOTICES ({announcements.length})
          </span>

          {/* Search Bar */}
          <div className="relative w-full lg:w-96">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </span>
            <input
              className="w-full pl-10 pr-4 py-2 text-xs md:text-sm bg-[#0e0e12] text-zinc-200 placeholder:text-zinc-500 rounded-lg border border-zinc-700/80 focus:outline-none focus:border-[#FF4500] transition-colors"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search announcements..."
              type="text"
              value={searchQuery}
            />
          </div>
        </section>

        {/* Bulletin Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            <div className="col-span-full p-8 text-center bg-[#111115] border border-zinc-800 rounded-xl">
              <p className="text-zinc-400 text-sm">Loading announcements…</p>
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="col-span-full p-8 text-center bg-[#111115] border border-zinc-800 rounded-xl flex flex-col items-center justify-center">
              <svg
                className="w-10 h-10 text-zinc-600 mb-2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <p className="text-zinc-400 text-sm">
                {announcements.length === 0
                  ? 'No announcements posted yet.'
                  : 'No bulletins match your search.'}
              </p>
            </div>
          ) : (
            filteredAnnouncements.map((bulletin, index) => {
              const accent = ACCENT_CYCLE[index % ACCENT_CYCLE.length];
              const borderTopColor =
                accent === 'gold'
                  ? 'bg-[#FFD700]'
                  : accent === 'carrot'
                    ? 'bg-[#FF4500]'
                    : 'bg-[#800020]';
              const badgeColor =
                accent === 'gold'
                  ? 'bg-[#FFD700]/15 text-[#FFD700] border-[#FFD700]/30'
                  : accent === 'carrot'
                    ? 'bg-[#FF4500]/15 text-[#FF4500] border-[#FF4500]/30'
                    : 'bg-[#800020]/30 text-rose-300 border-[#800020]/60';
              const titleHover =
                accent === 'gold'
                  ? 'group-hover:text-[#FFD700]'
                  : accent === 'carrot'
                    ? 'group-hover:text-[#FF4500]'
                    : 'group-hover:text-rose-300';

              return (
                <article
                  key={bulletin.id}
                  className="group relative bg-[#111115] hover:bg-[#14141a] border border-[#262630] hover:border-[#FFD700]/60 rounded-xl p-5 flex flex-col justify-between transition-all duration-200 shadow-lg overflow-hidden"
                >
                  <div className={`absolute top-0 left-0 right-0 h-1 ${borderTopColor}`}></div>
                  <div className="flex flex-col gap-3.5 pt-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider border font-mono ${badgeColor}`}
                      >
                        OFFICIAL DISPATCH
                      </span>
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-zinc-900 text-zinc-300 border border-zinc-700/80">
                        {timeAgo(bulletin.createdAt)}
                      </span>
                    </div>

                    <div>
                      <h3
                        className={`text-lg font-black font-display text-white tracking-tight uppercase transition-colors leading-tight ${titleHover}`}
                      >
                        {bulletin.heading}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                        {bulletin.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 mt-4 border-t border-zinc-800 flex items-center justify-between text-[11px] font-mono">
                    <span className="flex items-center gap-1.5 text-zinc-400 text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700]"></span>
                      Ref #{bulletin.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </main>

      <SponsorsPartnersSection />

      <Footer />
    </div>
  );
}
