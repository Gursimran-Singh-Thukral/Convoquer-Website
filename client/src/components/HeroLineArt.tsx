import React from 'react';

/**
 * Purely decorative line-art layer for the hero section — faint stroke-only
 * pictograms drawn from Convoquer's actual disciplines (athletics, football,
 * basketball, badminton, championship trophy) rather than generic Olympic
 * iconography, sitting between the background photo and the foreground text.
 * Safe to delete this file and its <HeroLineArt /> usage to revert.
 */
export const HeroLineArt: React.FC = () => {
  return (
    <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Top-left: running track lanes (Athletics) */}
      <svg
        className="absolute -top-6 -left-10 w-[260px] sm:w-[380px] opacity-[0.14]"
        viewBox="0 0 400 300"
        fill="none"
        stroke="#D4AF37"
        strokeWidth="1.5"
      >
        <path d="M-20 40 Q150 -20 420 40" />
        <path d="M-20 80 Q150 30 420 80" />
        <path d="M-20 120 Q150 80 420 120" />
        <path d="M-20 160 Q150 130 420 160" />
      </svg>

      {/* Top-right: basketball, hidden on small screens to avoid clutter */}
      <svg
        className="hidden md:block absolute -top-8 -right-8 w-[180px] sm:w-[220px] opacity-[0.13]"
        viewBox="0 0 100 100"
        fill="none"
        stroke="#D95D39"
        strokeWidth="1.5"
      >
        <circle cx="50" cy="50" r="40" />
        <path d="M50 10 V90" />
        <path d="M10 50 H90" />
        <path d="M17 22 Q50 50 17 78" />
        <path d="M83 22 Q50 50 83 78" />
      </svg>

      {/* Bottom-right: championship trophy (replaces generic laurel) */}
      <svg
        className="absolute -bottom-6 -right-6 w-[190px] sm:w-[260px] opacity-[0.16]"
        viewBox="0 0 100 120"
        fill="none"
        stroke="#D95D39"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M32 16 H68 V38 C68 54 58 64 50 64 C42 64 32 54 32 38 Z" />
        <path d="M32 20 H18 C18 34 24 42 32 44" />
        <path d="M68 20 H82 C82 34 76 42 68 44" />
        <path d="M50 64 V80" />
        <path d="M34 100 H66 L62 80 H38 Z" />
      </svg>

      {/* Bottom-left: badminton racket + shuttle */}
      <svg
        className="hidden sm:block absolute -bottom-4 -left-6 w-[160px] sm:w-[200px] opacity-[0.13]"
        viewBox="0 0 100 140"
        fill="none"
        stroke="#D4AF37"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <ellipse cx="45" cy="35" rx="28" ry="32" />
        <path d="M45 5 V65" />
        <path d="M20 20 Q45 35 70 20" />
        <path d="M20 50 Q45 35 70 50" />
        <path d="M45 67 L52 100" />
        <path d="M52 100 L48 128" />
        {/* shuttlecock, offset to the side */}
        <path d="M85 15 L95 30 M85 15 L92 32 M85 15 L88 34" />
        <circle cx="85" cy="15" r="4" />
      </svg>

      {/* Center-right, mid height: football, hidden on small screens */}
      <svg
        className="hidden lg:block absolute top-1/3 right-10 w-[110px] opacity-[0.12]"
        viewBox="0 0 100 100"
        fill="none"
        stroke="#D4AF37"
        strokeWidth="1.5"
        strokeLinejoin="round"
      >
        <circle cx="50" cy="50" r="38" />
        <path d="M50 22 L68 35 L61 56 L39 56 L32 35 Z" />
        <path d="M50 22 V12" />
        <path d="M68 35 L86 30" />
        <path d="M61 56 L72 74" />
        <path d="M39 56 L28 74" />
        <path d="M32 35 L14 30" />
      </svg>
    </div>
  );
};
