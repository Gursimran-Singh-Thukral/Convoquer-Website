'use client';

import React from 'react';

// Sponsorship roster is fixed for the event — one hierarchy, confirmed once,
// no admin tooling needed to add/remove a sponsor mid-fest.
interface SponsorTier {
  label: string;
  logoHeight: string;
  sponsors: { name: string; logo: string }[];
}

const TIERS: SponsorTier[] = [
  {
    label: 'Title Sponsor',
    logoHeight: 'h-16 sm:h-20',
    sponsors: [{ name: 'Shiv-Naresh', logo: '/sponsors/shiv-naresh.png' }],
  },
  {
    label: 'Co-Title Sponsor',
    logoHeight: 'h-14 sm:h-16',
    sponsors: [{ name: 'Dabur', logo: '/sponsors/dabur.png' }],
  },
  {
    label: 'Fest Sponsors',
    logoHeight: 'h-10 sm:h-12',
    sponsors: [
      { name: 'J&K Bank', logo: '/sponsors/jk-bank.png' },
      { name: 'ICICI Bank', logo: '/sponsors/icici.png' },
    ],
  },
  {
    label: 'Sports Partner',
    logoHeight: 'h-9 sm:h-10',
    sponsors: [{ name: 'Kamal Traders', logo: '/sponsors/kamal-traders.png' }],
  },
];

export const SponsorsPartnersSection: React.FC = () => {
  return (
    <section className="py-12 bg-[#121114] border-b border-white/10" data-purpose="sponsors-roster">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <span className="text-xs font-display font-medium uppercase tracking-widest text-gray-400 block mb-8">
          OFFICIAL PATRONS &amp; PARTNERS
        </span>
        <div className="flex flex-col items-center gap-8">
          {TIERS.map((tier) => (
            <div key={tier.label} className="flex flex-col items-center gap-3">
              <span className="text-[10px] font-display font-bold uppercase tracking-[0.2em] text-[#D4AF37]">
                {tier.label}
              </span>
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
                {tier.sponsors.map((s) => (
                  <div
                    key={s.name}
                    className="px-5 py-3 sm:px-6 sm:py-4 bg-white rounded-lg border border-white/10 flex items-center justify-center hover:scale-[1.03] transition-transform"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- static sponsor art shipped in /public, not routed through next/image optimization */}
                    <img
                      src={s.logo}
                      alt={s.name}
                      className={`${tier.logoHeight} w-auto object-contain`}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
