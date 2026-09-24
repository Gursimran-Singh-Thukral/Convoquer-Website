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
                <svg className="w-4 h-4 text-[#D4AF37]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C10.5 4 8.5 6 8.5 8.5C8.5 10.4 10.1 12 12 12C13.9 12 15.5 10.4 15.5 8.5C15.5 6 13.5 4 12 2M12 13.5C9.2 13.5 7 15.7 7 18.5V21C7 21.6 7.4 22 8 22H16C16.6 22 17 21.6 17 21V18.5C17 15.7 14.8 13.5 12 13.5M10 19V17C10 16.4 10.4 16 11 16H13C13.6 16 14 16.4 14 17V19H10Z" />
                </svg>
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

        {/* Bottom copyright */}
        <div className="mt-8 flex flex-col md:flex-row items-center justify-between text-xs text-gray-500 gap-4">
          <p>© 2026 Board of Sports Activities, IIT Jammu. All rights reserved.</p>
          <div className="flex items-center space-x-6 text-[11px] font-mono">
            <Link href="/rules">Rules &amp; Regulations</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
