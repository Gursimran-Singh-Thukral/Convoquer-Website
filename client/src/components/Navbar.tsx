'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { fetchSiteSettings, apiPost } from '@/lib/api';
import { useRouter, usePathname } from 'next/navigation';

export type NavbarActivePage =
  | 'home'
  | 'live'
  | 'sports'
  | 'schedule'
  | 'standings'
  | 'venues'
  | 'rules'
  | 'results'
  | 'bracket'
  | 'institutes'
  | 'campus-map'
  | 'announcements'
  | 'pass'
  | 'about'
  | 'gallery'
  | 'faq'
  | 'security'
  | 'scorer'
  | 'organizer';

export interface NavbarProps {
  /** Optional override — by default the active nav item is derived from the current URL. */
  activePage?: NavbarActivePage;
}

// Longest path first so a more specific route (e.g. /organizer/foo) doesn't get
// shadowed by a shorter prefix match.
const NAV_PATH_KEYS: { path: string; key: NavbarActivePage }[] = [
  { path: '/live', key: 'live' },
  { path: '/sports', key: 'sports' },
  { path: '/schedule', key: 'schedule' },
  { path: '/standings', key: 'standings' },
  { path: '/venues', key: 'venues' },
  { path: '/rules', key: 'rules' },
  { path: '/results', key: 'results' },
  { path: '/bracket', key: 'bracket' },
  { path: '/institutes', key: 'institutes' },
  { path: '/campus-map', key: 'campus-map' },
  { path: '/announcements', key: 'announcements' },
  { path: '/pass', key: 'pass' },
  { path: '/about', key: 'about' },
  { path: '/gallery', key: 'gallery' },
  { path: '/faq', key: 'faq' },
  { path: '/security', key: 'security' },
  { path: '/scorer', key: 'scorer' },
  { path: '/organizer', key: 'organizer' },
];
NAV_PATH_KEYS.sort((a, b) => b.path.length - a.path.length);

function deriveActivePage(pathname: string | null): NavbarActivePage {
  if (!pathname || pathname === '/') return 'home';
  const match = NAV_PATH_KEYS.find((entry) => pathname.startsWith(entry.path));
  return match ? match.key : 'home';
}

export const Navbar: React.FC<NavbarProps> = ({ activePage: activePageOverride }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'explore' | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const { isLoading, authenticated, canAccessOrganizer, user, refresh } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const activePage = activePageOverride ?? deriveActivePage(pathname);
  const [logoutError, setLogoutError] = useState('');
  const logout = async () => {
    try {
      await apiPost('/auth/logout');
      await refresh();
      router.push('/');
    } catch {
      setLogoutError('Sign-out failed. Please try again.');
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchSiteSettings().then((settings) => {
      if (!cancelled) setLogoUrl(settings.logoUrl);
    });
    // Also keep the browser tab's favicon in sync with the uploaded logo.
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!logoUrl) return;
    const link =
      (document.querySelector("link[rel~='icon']") as HTMLLinkElement | null) ||
      document.createElement('link');
    link.rel = 'icon';
    link.href = logoUrl;
    if (!link.parentNode) document.head.appendChild(link);
  }, [logoUrl]);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (name: 'explore') => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setOpenDropdown(name);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setOpenDropdown(null);
    }, 180);
  };

  const closeAll = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpenDropdown(null);
    setIsMobileMenuOpen(false);
  };

  const isHome = activePage === 'home';
  const isLive = activePage === 'live';
  const isSports = activePage === 'sports';
  const isSchedule = activePage === 'schedule';
  const isStandings = activePage === 'standings';
  const isGallery = activePage === 'gallery';
  const isAbout = activePage === 'about';
  const isFaq = activePage === 'faq';
  const isBracket = activePage === 'bracket';
  const isInstitutes = activePage === 'institutes';
  const isCampusMap = activePage === 'campus-map';
  const isVenues = activePage === 'venues';
  const isAnnouncements = activePage === 'announcements';
  const isPass = activePage === 'pass';
  const isExploreActive =
    isBracket || isInstitutes || isCampusMap || isVenues || isAnnouncements || isPass;

  return (
    <header
      className="sticky top-0 z-50 bg-[#121114]/95 backdrop-blur-md border-b border-white/10 shadow-lg"
      data-purpose="site-header"
    >
      <div className="max-w-[1780px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
        {/* 1. Brand Logo with Enlarged Header Size & Typography */}
        <div className="flex items-center gap-3 shrink-0" data-purpose="branding-container">
          <Link
            aria-label="Convoquer 26 Homepage"
            className="flex items-center gap-3 group"
            href="/"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#701A2B] to-[#1B191E] border border-[#D4AF37]/40 flex items-center justify-center shadow-md group-hover:border-[#FFD700] transition-colors overflow-hidden">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded data URL/remote logo, not part of the static build
                <img src={logoUrl} alt="Convoquer'26 logo" className="w-full h-full object-cover" />
              ) : (
                <svg
                  className="w-6 h-6 text-[#D4AF37] transition-transform group-hover:scale-105"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C10.5 4 8.5 6 8.5 8.5C8.5 10.4 10.1 12 12 12C13.9 12 15.5 10.4 15.5 8.5C15.5 6 13.5 4 12 2M12 13.5C9.2 13.5 7 15.7 7 18.5V21C7 21.6 7.4 22 8 22H16C16.6 22 17 21.6 17 21V18.5C17 15.7 14.8 13.5 12 13.5M10 19V17C10 16.4 10.4 16 11 16H13C13.6 16 14 16.4 14 17V19H10Z" />
                </svg>
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-display font-black text-2xl sm:text-3xl tracking-wider text-white leading-none">
                CONVOQUER<span className="text-[#D4AF37]">&apos;26</span>
              </span>
              <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.22em] text-zinc-400 font-semibold mt-1 font-mono">
                Annual Inter-Collegiate
              </span>
            </div>
          </Link>
        </div>

        {/* 2. Desktop Navigation with FAQ, Gallery, and About on the Navbar */}
        <nav
          className="hidden lg:flex items-center space-x-1 xl:space-x-2 text-[14px] xl:text-[15px] font-bold tracking-wider uppercase font-display"
          data-purpose="nav-links"
        >
          {/* Primary Links */}
          <Link
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              isHome
                ? 'text-[#D4AF37] bg-white/5 font-bold shadow-sm'
                : 'text-gray-300 hover:text-[#D4AF37] hover:bg-white/5'
            }`}
            href="/"
          >
            Home
          </Link>

          <Link
            className={`px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors ${
              isLive
                ? 'text-[#FF4500] bg-[#FF4500]/10 font-bold'
                : 'text-gray-300 hover:text-[#FF4500] hover:bg-white/5'
            }`}
            href="/live"
          >
            <span className="w-2 h-2 rounded-full bg-[#FF4500] animate-pulse"></span>
            Live Arena
          </Link>

          <Link
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              isSports
                ? 'text-[#D4AF37] bg-white/5 font-bold'
                : 'text-gray-300 hover:text-[#D4AF37] hover:bg-white/5'
            }`}
            href="/sports"
          >
            Sports
          </Link>

          <Link
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              isSchedule
                ? 'text-[#D4AF37] bg-white/5 font-bold'
                : 'text-gray-300 hover:text-[#D4AF37] hover:bg-white/5'
            }`}
            href="/schedule"
          >
            Schedule
          </Link>

          <Link
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              isStandings
                ? 'text-[#D4AF37] bg-white/5 font-bold'
                : 'text-gray-300 hover:text-[#D4AF37] hover:bg-white/5'
            }`}
            href="/standings"
          >
            Leaderboard
          </Link>

          <Link
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              isGallery
                ? 'text-[#D4AF37] bg-white/5 font-bold'
                : 'text-gray-300 hover:text-[#D4AF37] hover:bg-white/5'
            }`}
            href="/gallery"
          >
            Gallery
          </Link>

          <Link
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              isAbout
                ? 'text-[#D4AF37] bg-white/5 font-bold'
                : 'text-gray-300 hover:text-[#D4AF37] hover:bg-white/5'
            }`}
            href="/about"
          >
            About
          </Link>

          <Link
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              isFaq
                ? 'text-[#D4AF37] bg-white/5 font-bold'
                : 'text-gray-300 hover:text-[#D4AF37] hover:bg-white/5'
            }`}
            href="/faq"
          >
            FAQ
          </Link>

          {/* Explore Flyout Dropdown (public pages only; organizer tools live in the dashboard's own nav rail) */}
          <div
            className="relative py-2"
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeAll();
            }}
            onMouseLeave={handleMouseLeave}
          >
            <button
              type="button"
              aria-expanded={openDropdown === 'explore'}
              aria-controls="explore-links"
              onClick={() => {
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                setOpenDropdown((current) => (current === 'explore' ? null : 'explore'));
              }}
              className={`px-3 py-1.5 rounded-lg inline-flex items-center gap-1 transition-all ${
                openDropdown === 'explore' || isExploreActive
                  ? 'text-[#FFD700] bg-white/10 font-bold'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>Explore</span>
              <svg
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  openDropdown === 'explore' ? 'rotate-180 text-[#FFD700]' : 'text-gray-400'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M19 9l-7 7-7-7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </button>

            {openDropdown === 'explore' && (
              <div
                id="explore-links"
                className="absolute top-full right-0 w-64 bg-[#16141a] border border-[#2f2b34] rounded-xl shadow-2xl p-2 z-50 animate-in fade-in duration-150"
                onMouseEnter={() => handleMouseEnter('explore')}
                onMouseLeave={handleMouseLeave}
              >
                <Link
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-colors ${isBracket ? 'text-[#FFD700] bg-white/10 font-bold' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                  href="/bracket"
                  onClick={closeAll}
                >
                  <svg
                    className="w-4 h-4 text-[#D4AF37] shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M4 6h16M4 12h8m-8 6h16"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                  <span>Knockout Brackets</span>
                </Link>
                <Link
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-colors ${isInstitutes ? 'text-[#FFD700] bg-white/10 font-bold' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                  href="/institutes"
                  onClick={closeAll}
                >
                  <svg
                    className="w-4 h-4 text-[#D4AF37] shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                  <span>Participating Delegations</span>
                </Link>
                <Link
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-colors ${isCampusMap ? 'text-[#FFD700] bg-white/10 font-bold' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                  href="/campus-map"
                  onClick={closeAll}
                >
                  <svg
                    className="w-4 h-4 text-[#D4AF37] shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                  <span>Campus Venue Map</span>
                </Link>
                <Link
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-colors ${isVenues ? 'text-[#FFD700] bg-white/10 font-bold' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                  href="/venues"
                  onClick={closeAll}
                >
                  <svg
                    className="w-4 h-4 text-[#D4AF37] shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                    <path
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                  <span>Venues &amp; Facilities</span>
                </Link>
                <Link
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-colors ${isAnnouncements ? 'text-[#FFD700] bg-white/10 font-bold' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                  href="/announcements"
                  onClick={closeAll}
                >
                  <svg
                    className="w-4 h-4 text-[#D4AF37] shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                  <span>Bulletins &amp; Notices</span>
                </Link>
                <Link
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-colors ${isPass ? 'text-[#FFD700] bg-white/10 font-bold' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                  href="/pass"
                  onClick={closeAll}
                >
                  <svg
                    className="w-4 h-4 text-[#FFD700] shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                    />
                  </svg>
                  <span>Audience Gate Pass Kiosk</span>
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* 3. Action Buttons & Mobile Hamburger */}
        <div className="flex items-center gap-3 shrink-0" data-purpose="header-actions">
          {!isLoading && authenticated ? (
            <div className="hidden sm:flex items-center gap-2">
              {canAccessOrganizer && (
                <Link
                  className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-[#701A2B] hover:bg-[#882236] text-white text-xs font-display font-bold uppercase tracking-wider rounded-xl border border-[#D4AF37]/40 shadow-sm transition-all active:scale-95"
                  href="/organizer"
                  title={user?.email}
                >
                  <svg
                    className="w-3.5 h-3.5 text-[#FFD700]"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>DASHBOARD</span>
                </Link>
              )}
              <button
                className="px-2.5 py-2 rounded-xl text-[10px] font-display font-bold uppercase tracking-wider text-gray-400 hover:text-white border border-white/10 hover:border-white/30 transition-colors"
                onClick={logout}
                type="button"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-[#701A2B] hover:bg-[#882236] text-white text-xs font-display font-bold uppercase tracking-wider rounded-xl border border-[#D4AF37]/40 shadow-sm transition-all active:scale-95"
              href="/login"
            >
              <svg className="w-3.5 h-3.5 text-[#FFD700]" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="hidden sm:inline">ORGANIZER </span>
              <span>LOGIN</span>
            </Link>
          )}

          {logoutError && <span role="alert">{logoutError}</span>}
          {/* Mobile Hamburger Button */}
          <button
            aria-label={isMobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-[#1B191E] border border-white/10 text-gray-300 hover:text-white hover:border-[#D4AF37]/40 transition-colors"
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          >
            {isMobileMenuOpen ? (
              <svg
                className="w-5 h-5 text-[#D4AF37]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M6 18L18 6M6 6l12 12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu - Clean & Without Emojis */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden bg-[#151317]/98 border-b border-white/10 px-5 py-4 space-y-4 backdrop-blur-xl animate-in slide-in-from-top duration-200 text-xs font-display uppercase tracking-wider"
          data-purpose="mobile-nav-menu"
        >
          {/* Group 1: Matchday Core */}
          <div className="space-y-1">
            <span className="text-[10px] text-gray-500 font-mono block px-2 mb-1">
              MATCHDAY &amp; COMPETITIONS
            </span>
            <div className="grid grid-cols-2 gap-1 font-semibold">
              <Link
                className="px-3 py-2 rounded-lg text-gray-300 hover:text-[#D4AF37] hover:bg-white/5"
                href="/"
                onClick={closeAll}
              >
                Home
              </Link>
              <Link
                className="px-3 py-2 rounded-lg text-gray-300 hover:text-[#FF4500] hover:bg-white/5 inline-flex items-center gap-1.5"
                href="/live"
                onClick={closeAll}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF4500]"></span>
                Live Arena
              </Link>
              <Link
                className="px-3 py-2 rounded-lg text-gray-300 hover:text-[#D4AF37] hover:bg-white/5"
                href="/sports"
                onClick={closeAll}
              >
                Sports
              </Link>
              <Link
                className="px-3 py-2 rounded-lg text-gray-300 hover:text-[#D4AF37] hover:bg-white/5"
                href="/schedule"
                onClick={closeAll}
              >
                Schedule
              </Link>
              <Link
                className="px-3 py-2 rounded-lg text-gray-300 hover:text-[#D4AF37] hover:bg-white/5"
                href="/standings"
                onClick={closeAll}
              >
                Leaderboard
              </Link>
              <Link
                className="px-3 py-2 rounded-lg text-gray-300 hover:text-[#D4AF37] hover:bg-white/5"
                href="/bracket"
                onClick={closeAll}
              >
                Brackets
              </Link>
            </div>
          </div>

          {/* Group 2: Venues & Delegations */}
          <div className="space-y-1 pt-2 border-t border-white/10">
            <span className="text-[10px] text-gray-500 font-mono block px-2 mb-1">
              CAMPUS &amp; DELEGATIONS
            </span>
            <div className="grid grid-cols-2 gap-1 font-semibold">
              <Link
                className="px-3 py-2 rounded-lg text-gray-300 hover:text-[#D4AF37] hover:bg-white/5"
                href="/campus-map"
                onClick={closeAll}
              >
                Campus Map
              </Link>
              <Link
                className="px-3 py-2 rounded-lg text-gray-300 hover:text-[#D4AF37] hover:bg-white/5"
                href="/venues"
                onClick={closeAll}
              >
                Venues
              </Link>
              <Link
                className="px-3 py-2 rounded-lg text-gray-300 hover:text-[#D4AF37] hover:bg-white/5 col-span-2"
                href="/institutes"
                onClick={closeAll}
              >
                Participating Institutes
              </Link>
            </div>
          </div>

          {/* Group 3: Fest Hub */}
          <div className="space-y-1 pt-2 border-t border-white/10">
            <span className="text-[10px] text-gray-500 font-mono block px-2 mb-1">
              FESTIVAL HUB
            </span>
            <div className="grid grid-cols-2 gap-1 font-semibold">
              <Link
                className="px-3 py-2 rounded-lg text-gray-300 hover:text-[#D4AF37] hover:bg-white/5"
                href="/announcements"
                onClick={closeAll}
              >
                Bulletins
              </Link>
              <Link
                className="px-3 py-2 rounded-lg text-gray-300 hover:text-[#D4AF37] hover:bg-white/5"
                href="/gallery"
                onClick={closeAll}
              >
                Media Gallery
              </Link>
              <Link
                className="px-3 py-2 rounded-lg text-gray-300 hover:text-[#D4AF37] hover:bg-white/5"
                href="/faq"
                onClick={closeAll}
              >
                FAQs
              </Link>
              <Link
                className="px-3 py-2 rounded-lg text-gray-300 hover:text-[#D4AF37] hover:bg-white/5"
                href="/about"
                onClick={closeAll}
              >
                About
              </Link>
              <Link
                className="px-3 py-2 rounded-lg text-[#FFD700] hover:bg-white/5 col-span-2 flex items-center gap-1.5"
                href="/pass"
                onClick={closeAll}
              >
                <span className="w-2 h-2 rounded-full bg-[#FFD700]"></span>
                Audience Gate Pass Kiosk
              </Link>
              {canAccessOrganizer && (
                <Link
                  className="px-3 py-2 rounded-lg text-gray-300 hover:text-[#D4AF37] hover:bg-white/5 col-span-2"
                  href="/organizer"
                  onClick={closeAll}
                >
                  Organizer Dashboard
                </Link>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 space-y-2">
            {!isLoading && authenticated ? (
              <>
                {canAccessOrganizer && (
                  <Link
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#701A2B] hover:bg-[#882236] text-white text-xs font-display font-bold uppercase tracking-wider rounded-xl border border-[#D4AF37]/40 shadow-sm"
                    href="/organizer"
                    onClick={closeAll}
                  >
                    <span>ORGANIZER DASHBOARD</span>
                  </Link>
                )}
                <button
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-gray-400 hover:text-white text-xs font-display font-bold uppercase tracking-wider rounded-xl border border-white/10"
                  onClick={logout}
                  type="button"
                >
                  <span>LOGOUT</span>
                </button>
              </>
            ) : (
              <Link
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#701A2B] hover:bg-[#882236] text-white text-xs font-display font-bold uppercase tracking-wider rounded-xl border border-[#D4AF37]/40 shadow-sm"
                href="/login"
                onClick={closeAll}
              >
                <span>ORGANIZER LOGIN PORTAL</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
