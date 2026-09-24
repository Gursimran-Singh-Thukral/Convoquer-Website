'use client';
import { EventDates } from '@/components/EventDates';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { LiveTickerRibbon } from '@/components/LiveTickerRibbon';
import { Footer } from '@/components/Footer';
import { apiGet, type Venue } from '@/lib/api';

interface VenueCard {
  id: string;
  title: string;
  subtitle: string;
  accessTag: string;
  sports: string[];
  specs: {
    label: string;
    value: string;
    sub: string;
  }[];
  notes: string[];
  status: string;
}

function mapVenueToCard(venue: Venue): VenueCard {
  return {
    id: venue.id,
    title: venue.name.toUpperCase(),
    subtitle: venue.location || 'Venue details to be announced by the sports committee.',
    accessTag: venue.status === 'ACTIVE' ? 'ACTIVE COMPETITION VENUE' : venue.status,
    sports: [],
    status: venue.status,
    specs: [],
    notes: [],
  };
}

export default function VenuesPage() {
  const [filter, setFilter] = useState('all');
  const [venueCards, setVenueCards] = useState<VenueCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiGet<Venue[]>('/venues')
      .then((data) => {
        setVenueCards(Array.isArray(data) ? data.map(mapVenueToCard) : []);
        setIsLoading(false);
      })
      .catch(() => {
        setVenueCards([]);
        setIsLoading(false);
      });
  }, []);

  const filteredVenues = venueCards.filter((v) => {
    if (filter === 'all') return true;
    return v.status === filter;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#121114] text-[#E8E6EB]">
      <LiveTickerRibbon />
      <Navbar />

      {/* Main Header Tri-Gradient Accent Line */}
      <div className="w-full h-[2.5px] bg-gradient-to-r from-[#800020] via-[#FF4500] to-[#FFD700]"></div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top Breadcrumb & Live Meta Stats Bar */}
        <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs font-semibold uppercase tracking-wider pb-4 border-b border-white/10">
          <nav className="flex items-center space-x-2 text-neutral-400">
            <Link className="hover:text-[#FFD700] transition-colors" href="/">
              HOME
            </Link>
            <span className="text-neutral-600">/</span>
            <Link className="hover:text-[#FFD700] transition-colors" href="/venues">
              VENUES
            </Link>
            <span className="text-neutral-600">/</span>
            <span className="text-[#FFD700] font-bold">CAMPUS VENUES DIRECTORY</span>
          </nav>
          <div className="flex items-center space-x-3">
            <div className="inline-flex items-center px-3 py-1 rounded bg-[#151316] border border-white/10 text-neutral-300 gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold text-[11px] tracking-wide font-mono">
                {venueCards.length} COMPETITION VENUE{venueCards.length === 1 ? '' : 'S'}
              </span>
            </div>
            <div className="px-3 py-1 rounded bg-[#151316] border border-white/10 text-[#FFD700] font-bold text-[11px] tracking-wide font-mono">
              <EventDates />
            </div>
          </div>
        </section>

        {/* Page Title Block */}
        <section className="pt-2 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-8 bg-[#FFD700] rounded-sm inline-block shrink-0"></span>
              <h1 className="font-display text-3xl sm:text-4xl text-white tracking-wide font-bold uppercase">
                ATHLETIC VENUES &amp; ARENAS DIRECTORY
              </h1>
            </div>
            <p className="text-sm text-neutral-400 pl-5 max-w-3xl leading-relaxed">
              Venue locations and status published by the organizers.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 self-start md:self-end">
            {[
              { key: 'all', label: `ALL VENUES (${venueCards.length})` },
              ...Array.from(new Set(venueCards.map((venue) => venue.status)))
                .sort()
                .map((status) => ({ key: status, label: status })),
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded text-xs font-display font-semibold uppercase tracking-wider transition-all ${
                  filter === tab.key
                    ? 'bg-[#FFD700] text-black border border-[#FFD700] font-bold shadow-md'
                    : 'bg-[#151316] text-neutral-400 border border-white/10 hover:border-white/20'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {/* Venue Panels Grid: 3 columns */}
        <section className="pt-4">
          {isLoading ? (
            <div className="py-20 text-center bg-[#151316] rounded-xl border border-white/10">
              <div className="w-8 h-8 border-2 border-[#FFD700] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-neutral-400 text-xs font-mono uppercase tracking-widest">
                Loading venues from championship database...
              </p>
            </div>
          ) : filteredVenues.length === 0 ? (
            <div className="py-20 text-center bg-[#151316] rounded-xl border border-white/10">
              <p className="text-neutral-400 text-sm">No venues found for this status.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVenues.map((venue) => (
                <div
                  key={venue.id}
                  className="bg-gradient-to-b from-[#1d1b1e] to-[#151316] border border-white/10 rounded-xl p-6 flex flex-col justify-between space-y-5 hover:border-[#FFD700]/50 transition-all shadow-lg group"
                >
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <span className="px-2.5 py-0.5 bg-[#701A2B]/40 border border-[#701A2B] text-[#FFD700] font-mono font-bold text-[10px] tracking-wider rounded uppercase">
                          {venue.accessTag}
                        </span>
                      </div>
                      <h2 className="font-display text-xl text-white tracking-wide font-bold uppercase leading-tight">
                        {venue.title}
                      </h2>
                      <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                        {venue.subtitle}
                      </p>
                    </div>

                    {venue.sports.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {venue.sports.map((sp) => (
                          <span
                            key={sp}
                            className="px-2.5 py-1 rounded bg-[#1d1b1e] border border-white/10 text-xs font-medium text-neutral-200"
                          >
                            {sp}
                          </span>
                        ))}
                      </div>
                    )}

                    {venue.specs.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2.5 text-xs">
                        {venue.specs.map((spec) => (
                          <div
                            key={spec.label}
                            className="p-3 bg-[#151316]/90 rounded-lg border border-white/5"
                          >
                            <span className="text-[10px] text-neutral-400 block font-mono font-semibold uppercase tracking-wider mb-0.5">
                              {spec.label}
                            </span>
                            <span className="text-white font-bold block truncate">
                              {spec.value}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              {spec.sub}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-[#151316]/90 rounded-lg border border-white/5 text-xs text-neutral-400">
                        Detailed surface, capacity and lighting specifications for this venue will
                        be published closer to the championship.
                      </div>
                    )}

                    {venue.notes.length > 0 && (
                      <div className="bg-[#151316]/60 rounded-lg p-3.5 border border-white/5 text-xs space-y-1.5 text-neutral-300">
                        {venue.notes.map((note, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF4500] shrink-0 mt-1.5"></span>
                            <span className="text-[11px] leading-relaxed">{note}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-white/10">
                    <a
                      href="/campus-map"
                      className="w-full py-2.5 rounded-lg bg-[#252227] hover:bg-[#701A2B] hover:text-[#FFD700] border border-white/10 text-xs font-display font-bold tracking-wider text-neutral-200 transition-all flex items-center justify-center gap-2 uppercase"
                    >
                      <span>View on Campus Map →</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
