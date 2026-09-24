'use client';

import React, { useRef, useState, useEffect } from 'react';
import { fetchSports, Sport } from '@/lib/api';

interface SportItem {
  id: string;
  name: string;
  category: string;
  description: string;
  athletes: string;
  badge: string;
  accent: 'burgundy' | 'crimson';
  iconSvg: React.ReactNode;
}

const sportIcons: Record<string, React.ReactNode> = {
  athletics: (
    <path d="M13.5 5.5C14.6 5.5 15.5 4.6 15.5 3.5C15.5 2.4 14.6 1.5 13.5 1.5C12.4 1.5 11.5 2.4 11.5 3.5C11.5 4.6 12.4 5.5 13.5 5.5M9.8 8.9L7 23H9.1L11.2 13.2L13.3 15.3V23H15.4V13.8L13 11.4L13.7 7.9C15.1 9.5 17.1 10.5 19.5 10.5V8.4C17.5 8.4 15.8 7.4 14.8 5.9L13.8 4.3C13.4 3.7 12.8 3.3 12 3.3C11.3 3.3 10.6 3.6 10.1 4.1L6 8.3V13H8.1V9.8L9.8 8.9Z" />
  ),
  cricket: (
    <path d="M14.5 2C13.1 2 12 3.1 12 4.5C12 5.9 13.1 7 14.5 7C15.9 7 17 5.9 17 4.5C17 3.1 15.9 2 14.5 2M5 19L14 10L16 12L7 21L5 19M19.7 7.7L18.3 6.3L19.7 4.9C20.1 4.5 20.7 4.5 21.1 4.9L21.8 5.6C22.2 6 22.2 6.6 21.8 7L19.7 7.7Z" />
  ),
  football: (
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
  ),
  basketball: (
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm6.2 5.04C16.98 8.1 14.88 9 12 9c-.58 0-1.15-.04-1.7-.12C9.53 7.37 8.5 5.56 7.78 4.22 9.07 3.45 10.49 3 12 3c2.4 0 4.59 1.05 6.2 2.04zM5.56 6.07C6.35 7.47 7.45 9.4 8.35 11c-2.4.67-4.45 1-6.15 1.15.17-2.31 1.45-4.32 3.36-6.08zM4.1 14.07c2.05-.18 4.47-.56 7.15-1.34.42 1.15.79 2.37 1.07 3.63C9.4 17.5 6.54 18.9 5.2 19.64 4.3 18.07 3.8 16.27 4.1 14.07zM12 21c-1.4 0-2.73-.34-3.92-.95 1.1-.64 3.73-1.92 6.42-3.05.5 1.7 1.25 3.1 1.93 4.1-1.34.58-2.84.9-4.43.9zm6.65-2.25c-.75-1.1-1.57-2.6-2.1-4.4 2.82-.44 4.88-.1 5.35-.04-.4 1.83-1.55 3.39-3.25 4.44zm3.32-6.55c-.75-.08-3.07-.36-6.17.15-.3-1.28-.7-2.5-1.14-3.66 2.76-.02 4.8-.9 5.86-1.52.95 1.39 1.48 3.09 1.45 5.03z" />
  ),
  badminton: (
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.85 0 3.58-.5 5.08-1.39l2.84 2.84a1 1 0 001.41-1.41l-2.84-2.84C19.5 17.58 20 15.85 20 14c0-5.52-4.48-10-8-10zm0 16c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z" />
  ),
  volleyball: (
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-1.78.58-3.42 1.57-4.76L17.24 18.9C15.74 19.6 13.93 20 12 20zm6.43-3.24L6.76 5.1C8.26 4.4 10.07 4 12 4c4.41 0 8 3.59 8 8 0 1.78-.58 3.42-1.57 4.76z" />
  ),
  'table tennis': (
    <path d="M12 2a6 6 0 0 0-6 6c0 2.22 1.21 4.15 3 5.19V17a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-3.81c1.79-1.04 3-2.97 3-5.19a6 6 0 0 0-6-6m0 18a2 2 0 1 1 0 4 2 2 0 0 1 0-4" />
  ),
  chess: (
    <path d="M19 22H5V20H19V22M17.5 11C17.5 13.5 16.5 14.5 16 16H8C7.5 14.5 6.5 13.5 6.5 11C6.5 8.5 8 7 8 7L9 9C9 9 9.5 7.5 11 7C10 6 10 4.5 12 4.5C14 4.5 14 6 13 7C14.5 7.5 15 9 15 9L16 7C16 7 17.5 8.5 17.5 11M12 2C12.55 2 13 2.45 13 3C13 3.55 12.55 4 12 4C11.45 4 11 3.55 11 3C11 2.45 11.45 2 12 2Z" />
  ),
};

const defaultSportIcon = (
  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.93V17a1 1 0 0 1-2 0v-.07A8 8 0 0 1 4.07 11H5a1 1 0 0 1 0-2h-.93A8 8 0 0 1 11 4.07V5a1 1 0 0 1 2 0v-.93A8 8 0 0 1 19.93 11H19a1 1 0 0 1 0 2h.93A8 8 0 0 1 13 16.93z" />
);

export const SportsGridSection: React.FC = () => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [sportsList, setSportsList] = useState<SportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSports()
      .then((backendSports) => {
        setIsLoading(false);
        if (backendSports && backendSports.length > 0) {
          const mapped: SportItem[] = backendSports.map((bs: Sport, idx: number) => {
            const key = bs.name.toLowerCase();
            const icon = sportIcons[key] || defaultSportIcon;
            const isBurgundy = idx % 2 === 0;

            return {
              id: bs.id,
              name: bs.name.toUpperCase(),
              category: bs.status || 'SANCTIONED',
              description:
                bs.description || `Official ${bs.name} championship discipline at Convoquer'26.`,
              athletes:
                bs._count?.teams !== undefined
                  ? `${bs._count.teams} Teams Enrolled`
                  : 'Championship Event',
              badge: bs.status === 'ACTIVE' ? 'Active' : 'Scheduled',
              accent: isBurgundy ? 'burgundy' : 'crimson',
              iconSvg: icon,
            };
          });
          setSportsList(mapped);
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
      className="py-16 bg-[#121114] border-b border-white/10"
      data-purpose="sports-grid-section"
      id="sports"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title & Subtitle with Navigation Controls */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            {/* <span className="text-xs font-display font-medium uppercase tracking-widest text-[#D95D39]">
              Championship Categories
            </span> */}
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-white uppercase tracking-tight mt-1">
              SANCTIONED <span className="text-[#D4AF37]">DISCIPLINES</span>
            </h2>
            <p className="text-sm text-gray-400 mt-1 max-w-xl">
              Sports registered for the event. Open a sport for its teams and fixtures.
            </p>
          </div>

          {/* Horizontal Scroll Navigator Indicator */}
          <div className="flex items-center gap-2 text-xs font-mono text-gray-400 self-start md:self-auto">
            <span>Scroll to explore</span>
            <div className="inline-flex gap-1">
              <button
                aria-label="Scroll sports left"
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
                aria-label="Scroll sports right"
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

        {/* Linear Horizontal Scrolling Carousel */}
        {isLoading ? (
          <div className="py-12 text-center text-gray-400 text-sm font-mono">
            Loading sanctioned sports from registry...
          </div>
        ) : sportsList.length === 0 ? (
          <div className="bg-[#1B191E] border border-white/10 rounded-xl p-8 text-center max-w-lg mx-auto">
            <h3 className="font-display font-bold text-lg text-white uppercase">
              No Disciplines Registered
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Disciplines will appear once added to the active competition event.
            </p>
          </div>
        ) : (
          <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0">
            <div
              ref={trackRef}
              className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory soft-scrollbar"
              id="sports-horizontal-track"
            >
              {sportsList.map((sp) => {
                const isBurgundy = sp.accent === 'burgundy';

                return (
                  <div
                    key={sp.id}
                    className={`snap-start shrink-0 min-w-[280px] sm:min-w-[300px] max-w-[320px] bg-[#1B191E]/80 border border-white/10 rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 group flex flex-col justify-between ${
                      isBurgundy ? 'hover:border-[#D4AF37]/40' : 'hover:border-[#D95D39]/40'
                    }`}
                    data-purpose="sport-card"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div
                          className={`w-11 h-11 rounded-lg border flex items-center justify-center transition-colors ${
                            isBurgundy
                              ? 'bg-[#701A2B]/40 border-[#D4AF37]/30 text-[#D4AF37] group-hover:bg-[#701A2B]/70'
                              : 'bg-[#D95D39]/15 border-[#D95D39]/30 text-[#D95D39] group-hover:bg-[#D95D39]/30'
                          }`}
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            {sp.iconSvg}
                          </svg>
                        </div>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 bg-[#201D24] font-medium rounded border border-white/5 ${
                            isBurgundy ? 'text-[#D95D39]' : 'text-[#D4AF37]'
                          }`}
                        >
                          {sp.category}
                        </span>
                      </div>
                      <h3
                        className={`font-display font-bold text-xl text-white transition-colors ${
                          isBurgundy ? 'group-hover:text-[#D4AF37]' : 'group-hover:text-[#D95D39]'
                        }`}
                      >
                        {sp.name}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                        {sp.description}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                      <span className="text-gray-300">{sp.athletes}</span>
                      <span
                        className={
                          isBurgundy ? 'text-[#D4AF37] font-medium' : 'text-[#D95D39] font-medium'
                        }
                      >
                        {sp.badge}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
