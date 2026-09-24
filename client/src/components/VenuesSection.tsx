'use client';

import React, { useRef, useState, useEffect } from 'react';
import { fetchVenues, Venue } from '@/lib/api';

interface VenueItem {
  id: string;
  zone: string;
  location: string;
  name: string;
  description: string;
  surfaceLabel: string;
  surfaceVal: string;
  badge: string;
  badgeType: 'gold' | 'crimson' | 'neutral';
}

export const VenuesSection: React.FC = () => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [venues, setVenues] = useState<VenueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchVenues()
      .then((backendVenues: Venue[]) => {
        setIsLoading(false);
        if (backendVenues && backendVenues.length > 0) {
          const mapped = backendVenues.map((bv: Venue, idx: number) => {
            const isGold = idx % 2 === 0;

            return {
              id: bv.id,
              zone: bv.location ? bv.location.toUpperCase() : 'LOCATION PENDING',
              location: bv.location || 'Location not published',
              name: bv.name,
              description: bv.description || 'Description not published',
              surfaceLabel: 'Surface:',
              surfaceVal: bv.surface || 'Not published',
              badge: bv.status,
              badgeType: isGold ? ('gold' as const) : ('crimson' as const),
            };
          });

          setVenues(mapped);
        }
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  const scrollTrack = (offset: number) => {
    if (trackRef.current) {
      trackRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <section
      className="py-16 bg-[#151317] border-b border-white/10"
      data-purpose="venues-section"
      id="venues"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <span className="text-xs font-display font-medium uppercase tracking-widest text-[#D4AF37]">
              IIT Jammu Jagti Campus Guide
            </span>
            <h2 className="font-display font-black text-3xl sm:text-4xl text-white uppercase tracking-tight mt-1">
              CAMPUS MAP &amp; <span className="text-[#D95D39]">SPORTS VENUES</span>
            </h2>
            <p className="text-sm text-gray-400 mt-1 max-w-2xl">
              Explore the venues and locations published by the organizing team.
            </p>
          </div>

          {/* Horizontal Scroll Controller */}
          <div className="flex items-center gap-2 text-xs font-mono text-gray-400 self-start md:self-auto">
            <span>Scroll venues</span>
            <div className="inline-flex gap-1">
              <button
                aria-label="Scroll venues left"
                className="w-8 h-8 rounded border border-white/10 bg-[#1B191E] hover:bg-[#27242C] text-gray-300 flex items-center justify-center transition-colors cursor-pointer"
                onClick={() => scrollTrack(-320)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M15 19l-7-7 7-7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </button>
              <button
                aria-label="Scroll venues right"
                className="w-8 h-8 rounded border border-white/10 bg-[#1B191E] hover:bg-[#27242C] text-gray-300 flex items-center justify-center transition-colors cursor-pointer"
                onClick={() => scrollTrack(320)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M9 5l7 7-7 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Venues Horizontal Track */}
        {isLoading ? (
          <div className="py-12 text-center text-gray-400 text-sm font-mono">
            Loading campus venues from registry...
          </div>
        ) : venues.length === 0 ? (
          <div className="bg-[#1B191E] border border-white/10 rounded-xl p-8 text-center max-w-lg mx-auto">
            <h3 className="font-display font-bold text-lg text-white uppercase">
              No Venues Registered
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Venues will appear once added to the active competition registry.
            </p>
          </div>
        ) : (
          <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0">
            <div
              ref={trackRef}
              className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory soft-scrollbar"
              id="venues-horizontal-track"
            >
              {venues.map((v) => (
                <div
                  key={v.id}
                  className="snap-start shrink-0 min-w-[280px] sm:min-w-[320px] max-w-[340px] rounded-xl p-5 transition-colors flex flex-col justify-between shadow-sm border border-white/10 hover:border-[#D4AF37]/40 bg-[#1B191E]/80"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`text-xs font-mono font-medium ${
                          v.badgeType === 'crimson' ? 'text-[#D95D39]' : 'text-[#D4AF37]'
                        }`}
                      >
                        {v.zone}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-[#201D24] text-[#D4AF37] border-white/5">
                        {v.location}
                      </span>
                    </div>
                    <h3 className="font-display font-bold text-xl text-white">{v.name}</h3>
                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">{v.description}</p>
                  </div>
                  <div className="mt-5 pt-3 flex justify-between items-center text-xs border-t border-white/10">
                    <span className="text-gray-400">
                      {v.surfaceLabel}{' '}
                      <strong className="text-gray-200 font-normal">{v.surfaceVal}</strong>
                    </span>
                    <span
                      className={`font-medium ${
                        v.badgeType === 'crimson' ? 'text-[#D95D39]' : 'text-[#D4AF37]'
                      }`}
                    >
                      {v.badge}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
