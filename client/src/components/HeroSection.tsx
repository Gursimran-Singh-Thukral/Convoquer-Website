'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { HeroLineArt } from './HeroLineArt';
import { dayNumberForDate, isEventLive } from '@/lib/eventDays';

interface HomepageStats {
  eliteUniversities: number;
  cardedAthletes: number;
  olympicDisciplines: number;
  podiumMedals: number;
}

export const HeroSection: React.FC = () => {
  const [targetDate, setTargetDate] = useState<number | null>(null);
  const [eventDates, setEventDates] = useState<{
    startDate: string;
    endDate?: string | null;
  } | null>(null);
  const [timeLeft, setTimeLeft] = useState({ days: '—', hours: '—', minutes: '—', seconds: '—' });
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    apiGet<Array<{ startDate: string; endDate?: string | null }>>('/events?status=ACTIVE')
      .then((events) => {
        if (events[0]) {
          setTargetDate(Date.parse(events[0].startDate));
          setEventDates({ startDate: events[0].startDate, endDate: events[0].endDate });
        }
      })
      .catch(() => {});
  }, []);
  const [stats, setStats] = useState<HomepageStats | null>(null);
  const [heroBgUrl, setHeroBgUrl] = useState('/images/convoquer/hero-bg.jpg');

  useEffect(() => {
    apiGet<HomepageStats>('/stats/homepage')
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  // Probe the primary hero photo off-DOM so we can fall back to the .png
  // without ever mounting a plain <img> (a real <img> is a selectable/
  // draggable element and shows the browser's "image selected" outline
  // and save/drag affordances, which looks unprofessional for a page
  // background — this is rendered as a CSS background-image instead).
  useEffect(() => {
    const probe = new window.Image();
    probe.onerror = () => setHeroBgUrl('/images/convoquer/hero-bg.png');
    probe.src = '/images/convoquer/hero-bg.jpg';
  }, []);

  useEffect(() => {
    const updateCountdown = () => {
      const nowMs = new Date().getTime();
      setNow(new Date(nowMs));
      if (targetDate === null) return;
      const difference = Math.max(0, targetDate - nowMs);

      if (difference >= 0) {
        const d = Math.floor(difference / (1000 * 60 * 60 * 24));
        const h = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({
          days: String(d),
          hours: String(h).padStart(2, '0'),
          minutes: String(m).padStart(2, '0'),
          seconds: String(s).padStart(2, '0'),
        });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const live = eventDates ? isEventLive(eventDates.startDate, eventDates.endDate, now) : false;
  const dayNumber = eventDates ? dayNumberForDate(eventDates.startDate, now) : 1;

  return (
    <section
      className="relative min-h-[75vh] sm:min-h-[80vh] lg:min-h-[85vh] flex items-center justify-center border-b border-white/10 overflow-hidden"
      data-purpose="hero-banner"
      id="hero"
    >
      {/* Background Image Container - Spanning Full 100% of the Hero */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div
          role="img"
          aria-label="IIT Jammu Jagti Campus athletic sports arena"
          className="w-full h-full bg-cover bg-center convoquer-img"
          style={{ backgroundImage: `url(${heroBgUrl})` }}
        />
        {/* Refined dark dusk and institutional maroon gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#121114] via-[#121114]/85 to-[#121114]/50" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#121114]/90 via-[#121114]/50 to-[#121114]/90" />
        <div className="absolute inset-0 bg-[#701A2B]/15 mix-blend-multiply" />
      </div>

      <HeroLineArt />

      {/* Hero Centered Content Container */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 text-center flex flex-col items-center">
        {/* Institutional Host Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#701A2B]/40 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] sm:text-xs font-mono uppercase tracking-widest rounded mb-3 sm:mb-4">
          <span>HOSTED BY IIT JAMMU • BOARD OF SPORTS ACTIVITIES</span>
        </div>

        {/* Main Tournament Heading */}
        <h1 className="font-display font-black text-4xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight text-white uppercase leading-none drop-shadow">
          DEFEND THE RIDGE. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] via-[#D95D39] to-[#D4AF37]">
            CONQUER THE HEIGHTS.
          </span>
        </h1>

        <p className="mt-4 sm:mt-5 text-sm sm:text-base lg:text-lg text-gray-300 max-w-2xl font-sans font-normal leading-relaxed px-2 sm:px-0">
          The premier inter-collegiate sports championship of North India.{' '}
          <span className="text-white font-medium">
            Participating institutes, athletes, and sports
          </span>{' '}
          competing at Convoquer.
        </p>

        {/* Dynamic Countdown Widget — switches to a live "Day N" banner once the event starts */}
        <div
          className="mt-8 sm:mt-10 mb-2 w-full max-w-xl px-1 sm:px-0"
          data-purpose="championship-countdown"
        >
          {live ? (
            <Link
              href="/live"
              className="flex items-center justify-center gap-3 px-6 py-4 rounded-xl border border-[#FF4500]/50 bg-[#1B191E]/90 backdrop-blur-md shadow-lg hover:border-[#FF4500] transition-colors"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF4500] animate-pulse shrink-0"></span>
              <span className="font-display text-lg sm:text-xl font-bold uppercase tracking-wider text-white">
                Day {dayNumber} · Live Now
              </span>
            </Link>
          ) : (
            <>
              <div className="text-[10px] sm:text-[11px] font-display font-medium uppercase tracking-widest text-gray-400 mb-2 sm:mb-3">
                CHAMPIONSHIP START COUNTDOWN
              </div>
              <div className="grid grid-cols-4 gap-2 sm:gap-4 font-display">
                <div className="bg-[#1B191E]/90 border border-[#D4AF37]/40 rounded-lg sm:rounded-xl p-2.5 sm:p-4 text-center shadow-lg backdrop-blur-md">
                  <span className="block text-2xl sm:text-4xl lg:text-5xl font-bold text-[#D4AF37] font-mono leading-tight">
                    {timeLeft.days}
                  </span>
                  <span className="text-[10px] sm:text-xs tracking-wider uppercase text-gray-400 font-sans mt-1 block">
                    Days
                  </span>
                </div>
                <div className="bg-[#1B191E]/90 border border-white/10 rounded-lg sm:rounded-xl p-2.5 sm:p-4 text-center shadow-lg backdrop-blur-md">
                  <span className="block text-2xl sm:text-4xl lg:text-5xl font-bold text-[#D95D39] font-mono leading-tight">
                    {timeLeft.hours}
                  </span>
                  <span className="text-[10px] sm:text-xs tracking-wider uppercase text-gray-400 font-sans mt-1 block">
                    Hours
                  </span>
                </div>
                <div className="bg-[#1B191E]/90 border border-[#D4AF37]/40 rounded-lg sm:rounded-xl p-2.5 sm:p-4 text-center shadow-lg backdrop-blur-md">
                  <span className="block text-2xl sm:text-4xl lg:text-5xl font-bold text-[#D4AF37] font-mono leading-tight">
                    {timeLeft.minutes}
                  </span>
                  <span className="text-[10px] sm:text-xs tracking-wider uppercase text-gray-400 font-sans mt-1 block">
                    Minutes
                  </span>
                </div>
                <div className="bg-[#1B191E]/90 border border-white/10 rounded-lg sm:rounded-xl p-2.5 sm:p-4 text-center shadow-lg backdrop-blur-md">
                  <span className="block text-2xl sm:text-4xl lg:text-5xl font-bold text-[#D95D39] font-mono leading-tight">
                    {timeLeft.seconds}
                  </span>
                  <span className="text-[10px] sm:text-xs tracking-wider uppercase text-gray-400 font-sans mt-1 block">
                    Seconds
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Quick Metrics Strip */}
        <div className="mt-8 sm:mt-10 pt-6 border-t border-white/10 w-full max-w-3xl grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 text-center">
          <div className="p-2">
            <div className="font-display font-bold text-2xl sm:text-3xl text-[#D4AF37]">
              {stats ? stats.eliteUniversities : '—'}
            </div>
            <div className="text-[11px] sm:text-xs text-gray-400 uppercase font-sans tracking-wide mt-1">
              Elite Universities
            </div>
          </div>
          <div className="p-2">
            <div className="font-display font-bold text-2xl sm:text-3xl text-white">
              {stats ? stats.cardedAthletes : '—'}
            </div>
            <div className="text-[11px] sm:text-xs text-gray-400 uppercase font-sans tracking-wide mt-1">
              Carded Athletes
            </div>
          </div>
          <div className="p-2">
            <div className="font-display font-bold text-2xl sm:text-3xl text-[#D95D39]">
              {stats ? stats.olympicDisciplines : '—'}
            </div>
            <div className="text-[11px] sm:text-xs text-gray-400 uppercase font-sans tracking-wide mt-1">
              Olympic Disciplines
            </div>
          </div>
          <div className="p-2">
            <div className="font-display font-bold text-2xl sm:text-3xl text-[#D4AF37]">
              {stats ? stats.podiumMedals : '—'}
            </div>
            <div className="text-[11px] sm:text-xs text-gray-400 uppercase font-sans tracking-wide mt-1">
              Podium Medals
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
