'use client';
import { EventDates } from '@/components/EventDates';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { LiveTickerRibbon } from '@/components/LiveTickerRibbon';
import { Footer } from '@/components/Footer';
import { apiGet, fetchPublishedMedia, type MediaAsset } from '@/lib/api';

interface HomepageStats {
  eliteUniversities: number;
  cardedAthletes: number;
  olympicDisciplines: number;
  podiumMedals: number;
}

export default function AboutPage() {
  const [stats, setStats] = useState<HomepageStats | null>(null);
  const [moments, setMoments] = useState<MediaAsset[]>([]);

  useEffect(() => {
    apiGet<HomepageStats>('/stats/homepage')
      .then(setStats)
      .catch(() => setStats(null));
    fetchPublishedMedia('ABOUT').then(setMoments);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#121114] text-[#E8E6EB] selection:bg-[#FFD700] selection:text-black">
      <LiveTickerRibbon />
      <Navbar />

      {/* Tri-Color Accent Line */}
      <div className="h-[2.5px] w-full bg-gradient-to-r from-[#800020] via-[#FF4500] to-[#FFD700]"></div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Top Breadcrumb & Live Meta Stats Bar */}
        <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs font-semibold uppercase tracking-wider pb-2 border-b border-[#2f2b32]/70">
          <nav className="flex items-center space-x-2 text-neutral-400">
            <Link className="hover:text-[#FFD700] transition-colors" href="/">
              HOME
            </Link>
            <span className="text-neutral-600">/</span>
            <span className="text-[#FFD700] font-bold">ABOUT CONVOQUER&apos;26</span>
          </nav>
          <div className="flex items-center space-x-3">
            <div className="inline-flex items-center px-3 py-1 rounded bg-[#151316] border border-[#2f2b32] text-neutral-300 gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold text-[11px] tracking-wide">IIT JAMMU JAGTI CAMPUS</span>
            </div>
            <div className="px-3 py-1 rounded bg-[#151316] border border-[#2f2b32] text-[#FFD700] font-bold text-[11px] tracking-wide font-mono">
              <EventDates />
            </div>
          </div>
        </section>

        {/* Page Title Block */}
        <section className="pt-1">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-9 bg-[#FFD700] rounded-sm inline-block"></span>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-wide uppercase">
                ABOUT CONVOQUER&apos;26
              </h1>
            </div>
            <p className="text-sm sm:text-base text-neutral-300 pl-5 max-w-4xl leading-relaxed">
              The premier annual inter-collegiate athletic championship of the Indian Institute of
              Technology Jammu. Defend the ridge. Conquer the heights.
            </p>
          </div>
        </section>

        {/* Key Statistics Ribbon */}
        <section>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-4 bg-[#151316] border border-[#2f2b32] rounded-lg text-center shadow-lg">
              <span className="font-display text-3xl lg:text-4xl font-black text-[#FFD700] block leading-none mb-1">
                5
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Championship Days
              </span>
            </div>
            <div className="p-4 bg-[#151316] border border-[#2f2b32] rounded-lg text-center shadow-lg">
              <span className="font-display text-3xl lg:text-4xl font-black text-white block leading-none mb-1">
                {stats ? stats.olympicDisciplines : '—'}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Sanctioned Disciplines
              </span>
            </div>
            <div className="p-4 bg-[#151316] border border-[#2f2b32] rounded-lg text-center shadow-lg">
              <span className="font-display text-3xl lg:text-4xl font-black text-white block leading-none mb-1">
                {stats ? stats.eliteUniversities : '—'}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Elite Delegations
              </span>
            </div>
            <div className="p-4 bg-[#151316] border border-[#2f2b32] rounded-lg text-center shadow-lg">
              <span className="font-display text-3xl lg:text-4xl font-black text-[#FFD700] block leading-none mb-1">
                {stats ? stats.cardedAthletes : '—'}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Student Athletes
              </span>
            </div>
            <div className="p-4 bg-[#151316] border border-[#2f2b32] rounded-lg text-center col-span-2 sm:col-span-1 lg:col-span-1 shadow-lg">
              <span className="font-display text-3xl lg:text-4xl font-black text-[#FF4500] block leading-none mb-1">
                {stats ? stats.podiumMedals : '—'}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Podium Medals
              </span>
            </div>
          </div>
        </section>

        <section className="border border-white/15 rounded-xl p-6">
          <h2 className="text-2xl font-bold mb-3">Event information</h2>
          <p>
            Read the organizing team’s published rules, announcements and contacts for current event
            information.
          </p>
          <Link className="inline-block underline text-[#FFD700] mt-4" href="/rules">
            Official rules and resources
          </Link>
        </section>
        <section className="border border-white/20 rounded-xl p-6">
          <h2 className="text-2xl font-bold mb-3">Organizing Committee</h2>
          <p className="text-zinc-400">
            Approved committee information is published by the organizing team.
          </p>
          <Link href="/committee" className="text-[#FFD700] underline">
            View organizing committee
          </Link>
        </section>

        {/* Moments — curated by the Media Team (submit-then-approve via the organizer dashboard) */}
        {moments.length > 0 && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-white/5">
            <div className="mb-8">
              <span className="text-xs font-mono text-[#FFD700] uppercase tracking-widest">
                Media Team Curated
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-white mt-1">
                MOMENTS
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {moments.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl overflow-hidden border border-white/10 bg-[#161419]"
                >
                  <div className="relative aspect-square">
                    <Image
                      alt={m.title}
                      src={m.imageUrl}
                      fill
                      unoptimized={m.imageUrl.startsWith('data:')}
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-cover"
                    />
                  </div>
                  {m.caption && (
                    <p className="text-xs text-[#9E9AA3] p-2.5 line-clamp-2">{m.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
