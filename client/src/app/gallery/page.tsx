'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Navbar } from '@/components/Navbar';
import { LiveTickerRibbon } from '@/components/LiveTickerRibbon';
import { Footer } from '@/components/Footer';
import { fetchPublishedMedia, type MediaAsset } from '@/lib/api';

export default function GalleryPage() {
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('ALL PHOTOS');
  const [selectedPhoto, setSelectedPhoto] = useState<MediaAsset | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPublishedMedia('GALLERY').then((data) => {
      if (!cancelled) {
        setItems(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(items.map((i) => i.category))).sort();
    return ['ALL PHOTOS', ...cats];
  }, [items]);

  const filteredItems = useMemo(() => {
    if (activeCategory === 'ALL PHOTOS') return items;
    return items.filter((item) => item.category === activeCategory);
  }, [items, activeCategory]);

  return (
    <div className="min-h-screen flex flex-col bg-[#121114] text-[#E8E6EB] selection:bg-[#FF4500] selection:text-white">
      <LiveTickerRibbon />
      <Navbar />

      {/* Tri-color Accent Line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-[#800020] via-[#FF4500] to-[#FFD700]"></div>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Title Area */}
        <div className="mb-8 pt-2">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-[#FFD700] mb-2 uppercase tracking-wider">
            <span>● CONVOQUER&apos;26 OFFICIAL MEDIA VAULT</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-black uppercase tracking-tight text-white leading-none">
            CHAMPIONSHIP <span className="text-[#FFD700]">GALLERY</span>
          </h1>
          <p className="text-[#9E9AA3] text-sm sm:text-base mt-2 max-w-2xl font-normal">
            High-octane captures, raw arena energy, and candid championship moments from
            Convoquer&apos;26 — curated by the Media Team.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-24 text-zinc-500 text-sm font-mono">Loading gallery…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-24 border border-[#2A242E] rounded-xl">
            <p className="text-zinc-400 text-sm">
              The gallery is being curated by the Media Team — photos will appear here as soon as
              they&apos;re approved.
            </p>
          </div>
        ) : (
          <>
            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2 mb-10 pb-4 border-b border-[#2A242E]">
              {categories.map((cat) => {
                const count =
                  cat === 'ALL PHOTOS'
                    ? items.length
                    : items.filter((i) => i.category === cat).length;
                const isActive = activeCategory === cat;

                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    type="button"
                    className={`px-4 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wider transition-all shadow ${
                      isActive
                        ? 'bg-[#FFD700] text-[#0B0A0D]'
                        : 'bg-[#161419] text-[#9E9AA3] border border-[#2A242E] hover:border-[#FFD700]/40 hover:text-white'
                    }`}
                  >
                    {cat} {cat === 'ALL PHOTOS' && `(${count})`}
                  </button>
                );
              })}
            </div>

            {/* Expansive Photo Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-16 auto-rows-[240px]">
              {filteredItems.map((item) => {
                const colSpan =
                  item.aspect === 'wide'
                    ? 'sm:col-span-2 md:col-span-2 md:row-span-1'
                    : item.aspect === 'tall'
                      ? 'sm:col-span-1 md:col-span-1 md:row-span-2'
                      : 'sm:col-span-1 md:col-span-1 md:row-span-1';

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedPhoto(item)}
                    className={`${colSpan} bg-[#161419] rounded-xl border border-[#2A242E] overflow-hidden flex flex-col group hover:border-[#FFD700]/60 transition-all duration-300 cursor-pointer shadow-lg`}
                  >
                    <div className="relative flex-1 overflow-hidden min-h-[160px]">
                      <Image
                        alt={item.title}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                        fill
                        unoptimized={item.imageUrl.startsWith('data:')}
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        src={item.imageUrl}
                      />
                      <div className="absolute top-3 left-3">
                        <span className="bg-[#100E12]/85 backdrop-blur-sm text-[#FFD700] border border-[#FFD700]/40 text-[10px] font-display uppercase tracking-wider px-2.5 py-1 rounded-md font-bold">
                          {item.category}
                        </span>
                      </div>
                    </div>
                    <div className="p-3.5 bg-[#161419] border-t border-[#2A242E]/60">
                      <h3 className="font-display text-sm sm:text-base font-bold uppercase text-white tracking-wide group-hover:text-[#FFD700] transition-colors truncate">
                        {item.title}
                      </h3>
                      <p className="text-xs text-[#9E9AA3] mt-0.5 font-normal line-clamp-1">
                        {item.caption}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Modal Lightbox */}
        {selectedPhoto && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in"
            onClick={() => setSelectedPhoto(null)}
          >
            <div
              className="relative max-w-4xl w-full bg-[#161419] border border-white/20 rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/70 border border-white/20 text-white flex items-center justify-center hover:bg-[#800020] transition-colors"
                onClick={() => setSelectedPhoto(null)}
                type="button"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="relative aspect-video w-full">
                <Image
                  alt={selectedPhoto.title}
                  className="w-full h-full object-cover"
                  fill
                  unoptimized={selectedPhoto.imageUrl.startsWith('data:')}
                  sizes="100vw"
                  src={selectedPhoto.imageUrl}
                />
              </div>

              <div className="p-6">
                <span className="text-[11px] font-mono text-[#FFD700] uppercase font-bold tracking-wider">
                  {selectedPhoto.category}
                </span>
                <h2 className="text-2xl font-display font-black text-white uppercase mt-1">
                  {selectedPhoto.title}
                </h2>
                <p className="text-sm text-gray-300 mt-2">{selectedPhoto.caption}</p>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
