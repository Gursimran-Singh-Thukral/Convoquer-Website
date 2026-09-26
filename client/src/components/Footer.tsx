'use client';
import { EventDates } from '@/components/EventDates';

import React from 'react';
import Link from 'next/link';

export const Footer: React.FC = () => {
  return (
    <footer
      className="bg-[#0B0A0C] text-gray-400 pt-16 pb-8 border-t border-white/10 mt-auto"
      data-purpose="site-footer"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-white/10">
          {/* Col 1: Brand & Edition */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded bg-[#701A2B] border border-[#D4AF37]/30 flex items-center justify-center shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element -- static brand art shipped in /public */}
                <img
                  src="/brand/convoquer-mark.png"
                  alt=""
                  aria-hidden="true"
                  className="w-6 h-6 object-contain"
                />
              </div>
              <span className="font-display font-bold text-xl tracking-wider text-white">
                CONVOQUER<span className="text-[#D4AF37]">&apos;26</span>
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed mb-3">
              Annual Inter-Collegiate Sports Championship hosted at Indian Institute of Technology
              Jammu.
            </p>
            <span className="inline-block px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-[#D4AF37] bg-[#701A2B]/40 border border-[#D4AF37]/30 rounded">
              <EventDates />
            </span>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h4 className="font-display font-bold text-sm uppercase text-gray-200 tracking-wider mb-4 border-l-2 border-[#D4AF37] pl-2">
              Quick Links
            </h4>
            <ul className="space-y-2 text-xs font-medium">
              {['results', 'teams', 'rules', 'contact', 'news', 'committee'].map((path) => (
                <li key={path}>
                  <Link className="capitalize hover:text-[#D4AF37]" href={`/${path}`}>
                    {path}
                  </Link>
                </li>
              ))}
              <li>
                <Link className="hover:text-[#D4AF37] transition-colors" href="/">
                  Championship Home
                </Link>
              </li>
              <li>
                <Link className="hover:text-[#D4AF37] transition-colors" href="/live">
                  Live Arena Feed
                </Link>
              </li>
              <li>
                <Link className="hover:text-[#D4AF37] transition-colors" href="/sports">
                  Sanctioned Disciplines
                </Link>
              </li>
              <li>
                <a className="hover:text-[#D4AF37] transition-colors" href="/schedule">
                  Master Schedule &amp; Fixtures
                </a>
              </li>
              <li>
                <a className="hover:text-[#D4AF37] transition-colors" href="/standings">
                  Medal Tally Standings
                </a>
              </li>
              <li>
                <a className="hover:text-[#D4AF37] transition-colors" href="/bracket">
                  Tournament Bracket
                </a>
              </li>
              <li>
                <a className="hover:text-[#D4AF37] transition-colors" href="/campus-map">
                  Campus Venue Map
                </a>
              </li>
              <li>
                <a className="hover:text-[#D4AF37] transition-colors" href="/institutes">
                  Participating Delegations
                </a>
              </li>
              <li>
                <a className="hover:text-[#D4AF37] transition-colors" href="/announcements">
                  Fest Bulletins &amp; Notices
                </a>
              </li>
              <li>
                <a className="hover:text-[#D4AF37] transition-colors" href="/gallery">
                  Championship Gallery
                </a>
              </li>
              <li>
                <a className="hover:text-[#D4AF37] transition-colors" href="/faq">
                  Frequently Asked Questions
                </a>
              </li>
              <li>
                <a className="hover:text-[#D4AF37] transition-colors" href="/about">
                  About Convoquer&apos;26
                </a>
              </li>
              <li>
                <a
                  className="hover:text-[#D4AF37] transition-colors font-bold text-gray-300"
                  href="/login"
                >
                  Organizer Portal Login
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Emergency & Medical */}
          <div>
            <h4 className="font-display font-bold text-sm uppercase text-[#D95D39] tracking-wider mb-4 border-l-2 border-[#D95D39] pl-2">
              Emergency &amp; Medical
            </h4>
            <Link className="text-sm text-[#D4AF37] underline" href="/contact">
              Official medical, security and event contacts
            </Link>
          </div>

          {/* Col 4: Location */}
          <div>
            <h4 className="font-display font-bold text-sm uppercase text-[#D4AF37] tracking-wider mb-4 border-l-2 border-[#D4AF37] pl-2">
              IIT Jammu Location
            </h4>
            <address className="not-italic text-xs space-y-2 text-gray-400">
              <p className="text-white font-medium">Board of Sports Activities (BSA)</p>
              <p>Student Affairs Wing, Jagti Campus</p>
              <p>NH-44, PO Nagrota, Jammu 181221</p>
              <Link className="text-[#D4AF37]" href="/contact">
                Contact the organizing team
              </Link>
            </address>
          </div>
        </div>

        {/* Organized-by credit */}
        <div className="pt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-white/10">
          <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500">
            Organized by
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand art shipped in /public */}
          <img
            src="/brand/iit-jammu-mark.png"
            alt="Indian Institute of Technology Jammu"
            className="h-10 w-auto object-contain"
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand art shipped in /public */}
          <img
            src="/brand/student-sports-council.png"
            alt="Student Sports Council, IIT Jammu"
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* Bottom copyright */}
        <div className="mt-6 flex flex-col md:flex-row items-center justify-between text-xs text-gray-500 gap-4">
          <p>© 2026 Board of Sports Activities, IIT Jammu. All rights reserved.</p>
          <div className="flex items-center space-x-6 text-[11px] font-mono">
            <Link href="/rules">Rules &amp; Regulations</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
