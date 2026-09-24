'use client';

import React from 'react';
import { Navbar } from '@/components/Navbar';
import { LiveTickerRibbon } from '@/components/LiveTickerRibbon';
import { HeroSection } from '@/components/HeroSection';
import { HighlightsSection } from '@/components/HighlightsSection';
import { SportsGridSection } from '@/components/SportsGridSection';
import { MedalTallySection } from '@/components/MedalTallySection';
import { CampusMasterplanSection } from '@/components/CampusMasterplanSection';
import { VenuesSection } from '@/components/VenuesSection';
import { SponsorsPartnersSection } from '@/components/SponsorsPartnersSection';
import { Footer } from '@/components/Footer';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[#121114] text-[#E8E6EB]">
      {/* Live Continuous Ticker */}
      <LiveTickerRibbon />

      {/* Main Header */}
      <Navbar />

      {/* Main Content Sections */}
      <main className="flex-1">
        <HeroSection />
        <HighlightsSection />
        <SportsGridSection />
        <MedalTallySection />
        <CampusMasterplanSection />
        <VenuesSection />
        <SponsorsPartnersSection />
      </main>

      {/* Championship Footer */}
      <Footer />
    </div>
  );
}
