'use client';

import React, { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';

interface SponsorItem {
  id: string;
  name: string;
  role: string;
  color?: string;
}

export const SponsorsPartnersSection: React.FC = () => {
  const [sponsors, setSponsors] = useState<SponsorItem[]>([]);

  useEffect(() => {
    apiGet<SponsorItem[]>('/sponsors')
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setSponsors(data);
        }
      })
      .catch(() => {
        setSponsors([]);
      });
  }, []);

  return (
    <section className="py-12 bg-[#121114] border-b border-white/10" data-purpose="sponsors-roster">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <span className="text-xs font-display font-medium uppercase tracking-widest text-gray-400 block mb-6">
          OFFICIAL PATRONS, TECHNICAL ALLIES &amp; APPAREL PARTNERS
        </span>
        {!sponsors.length && (
          <p className="text-gray-400">Partners will appear here once published.</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 items-center">
          {sponsors.map((p) => (
            <div
              key={p.id}
              className="p-3 bg-[#1B191E]/80 border border-white/10 rounded-lg flex flex-col items-center justify-center hover:border-[#D4AF37]/30 transition-colors"
            >
              <span
                className={`font-display font-bold text-base uppercase tracking-wider ${p.color || 'text-[#D4AF37]'}`}
              >
                {p.name}
              </span>
              <span className="text-[9px] text-gray-400 font-sans mt-0.5">{p.role}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
