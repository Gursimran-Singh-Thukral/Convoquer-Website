'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { GoogleCampusMap } from '@/components/GoogleCampusMap';
import { Navbar } from '@/components/Navbar';
import { OrganizerNavRail } from '@/components/OrganizerNavRail';
import { LiveTickerRibbon } from '@/components/LiveTickerRibbon';
import { Footer } from '@/components/Footer';
import { RequireOrganizer } from '@/components/RequireOrganizer';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/ToastProvider';
import {
  apiAuthedGet,
  apiPost,
  apiPatch,
  apiDelete,
  ApiError,
  type Sport,
  type Venue,
  type EventSummary,
} from '@/lib/api';

type ViewMode = 'SPORTS' | 'VENUES';

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'ARCHIVED'];

function statusBadgeClasses(status: string): string {
  const s = status.toUpperCase();
  if (s === 'ACTIVE') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (s === 'ARCHIVED') return 'bg-white/10 text-zinc-400 border-white/10';
  return 'bg-[#FF4500]/20 text-[#FF4500] border-[#FF4500]/40';
}

function SportsVenuesManagerContent() {
  const { hasPermission } = useAuth();
  const { confirm } = useToast();

  const canCreateSport = hasPermission('sport.create');
  const canUpdateSport = hasPermission('sport.update');
  const canCreateVenue = hasPermission('venue.create');
  const canUpdateVenue = hasPermission('venue.update');

  const [activeView, setActiveView] = useState<ViewMode>('SPORTS');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [activeEvent, setActiveEvent] = useState<EventSummary | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);

  const [sports, setSports] = useState<Sport[]>([]);
  const [sportsLoading, setSportsLoading] = useState(true);
  const [sportsError, setSportsError] = useState<string | null>(null);

  const [venues, setVenues] = useState<Venue[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [venuesError, setVenuesError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSport, setEditingSport] = useState<Sport | null>(null);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [formName, setFormName] = useState('');
  const [formSecondary, setFormSecondary] = useState(''); // description (sport) or location (venue)
  const [formStatus, setFormStatus] = useState('ACTIVE');
  const [sportScoringMode, setSportScoringMode] = useState<'LIVE' | 'RESULT_ONLY' | ''>('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [capacity, setCapacity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const selectVenuePoint = useCallback((point: { latitude: number; longitude: number }) => {
    setLatitude(point.latitude);
    setLongitude(point.longitude);
  }, []);

  const loadActiveEvent = useCallback(async () => {
    try {
      const events = await apiAuthedGet<EventSummary[]>('/events?status=ACTIVE');
      setActiveEvent(events[0] ?? null);
      setEventError(
        events.length === 0
          ? 'No active event found — creation is disabled until an event is active.'
          : null,
      );
    } catch (err) {
      setActiveEvent(null);
      setEventError(err instanceof ApiError ? err.message : 'Failed to load active event');
    }
  }, []);

  const loadSports = useCallback(async () => {
    setSportsLoading(true);
    setSportsError(null);
    try {
      const data = await apiAuthedGet<Sport[]>('/sports');
      setSports(data);
    } catch (err) {
      setSportsError(err instanceof ApiError ? err.message : 'Failed to load sports');
    } finally {
      setSportsLoading(false);
    }
  }, []);

  const loadVenues = useCallback(async () => {
    setVenuesLoading(true);
    setVenuesError(null);
    try {
      const data = await apiAuthedGet<Venue[]>('/venues');
      setVenues(data);
    } catch (err) {
      setVenuesError(err instanceof ApiError ? err.message : 'Failed to load venues');
    } finally {
      setVenuesLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Deferred via a microtask so the loader calls (which set loading/error
    // state) don't run synchronously during the effect itself — see
    // react-hooks/set-state-in-effect and auth-context.tsx for the same idiom.
    Promise.resolve().then(() => {
      if (cancelled) return;
      loadActiveEvent();
      loadSports();
      loadVenues();
    });
    return () => {
      cancelled = true;
    };
  }, [loadActiveEvent, loadSports, loadVenues]);

  const filteredSports = sports.filter((s) => {
    if (statusFilter !== 'ALL' && s.status.toUpperCase() !== statusFilter) return false;
    if (searchQuery.trim() && !s.name.toLowerCase().includes(searchQuery.toLowerCase()))
      return false;
    return true;
  });

  const filteredVenues = venues.filter((v) => {
    if (statusFilter !== 'ALL' && v.status.toUpperCase() !== statusFilter) return false;
    if (
      searchQuery.trim() &&
      !v.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !(v.location || '').toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const openCreateModal = () => {
    setEditingSport(null);
    setEditingVenue(null);
    setFormName('');
    setFormSecondary('');
    setFormStatus('ACTIVE');
    setSportScoringMode('');
    setLatitude(null);
    setCapacity(1);
    setLongitude(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditSportModal = (sport: Sport) => {
    setEditingSport(sport);
    setEditingVenue(null);
    setFormName(sport.name);
    setFormSecondary(sport.description || '');
    setFormStatus(sport.status || 'ACTIVE');
    setSportScoringMode(sport.scoringMode || 'LIVE');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditVenueModal = (venue: Venue) => {
    setEditingVenue(venue);
    setEditingSport(null);
    setFormName(venue.name);
    setFormSecondary(venue.location || '');
    setFormStatus(venue.status || 'ACTIVE');
    setLatitude(venue.latitude ?? null);
    setCapacity(venue.simultaneousMatches ?? 1);
    setLongitude(venue.longitude ?? null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingSport(null);
    setEditingVenue(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      if (activeView === 'SPORTS') {
        if (editingSport) {
          await apiPatch(`/sports/${editingSport.id}`, {
            name: formName.trim(),
            description: formSecondary.trim() || undefined,
            scoringMode: sportScoringMode || undefined,
            status: formStatus,
          });
        } else {
          if (!activeEvent) {
            throw new ApiError(400, 'No active event available to attach this sport to.');
          }
          await apiPost('/sports', {
            eventId: activeEvent.id,
            name: formName.trim(),
            description: formSecondary.trim() || undefined,
            scoringMode: sportScoringMode || undefined,
            status: formStatus,
          });
        }
        await loadSports();
      } else {
        if (editingVenue) {
          await apiPatch(`/venues/${editingVenue.id}`, {
            name: formName.trim(),
            location: formSecondary.trim() || undefined,
            status: formStatus,
            latitude,
            simultaneousMatches: capacity,
            longitude,
          });
        } else {
          if (!activeEvent) {
            throw new ApiError(400, 'No active event available to attach this venue to.');
          }
          await apiPost('/venues', {
            eventId: activeEvent.id,
            name: formName.trim(),
            location: formSecondary.trim() || undefined,
            status: formStatus,
            latitude,
            simultaneousMatches: capacity,
            longitude,
          });
        }
        await loadVenues();
      }
      setIsModalOpen(false);
      setEditingSport(null);
      setEditingVenue(null);
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSport = async (sport: Sport) => {
    if (!(await confirm(`Delete sport "${sport.name}"? This cannot be undone.`))) return;
    setDeletingId(sport.id);
    setActionError(null);
    try {
      await apiDelete(`/sports/${sport.id}`);
      await loadSports();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to delete sport');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteVenue = async (venue: Venue) => {
    if (!(await confirm(`Delete venue "${venue.name}"? This cannot be undone.`))) return;
    setDeletingId(venue.id);
    setActionError(null);
    try {
      await apiDelete(`/venues/${venue.id}`);
      await loadVenues();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to delete venue');
    } finally {
      setDeletingId(null);
    }
  };

  const canCreateActive = activeView === 'SPORTS' ? canCreateSport : canCreateVenue;

  return (
    <div className="min-h-screen flex flex-col bg-[#121114] text-[#E8E6EB] selection:bg-[#FFD700] selection:text-black font-sans">
      <LiveTickerRibbon />
      <Navbar />
      <OrganizerNavRail />

      {/* Tri-color Accent Line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-[#800020] via-[#FF4500] to-[#FFD700]"></div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#FFD700] uppercase tracking-widest mb-1">
              <span>CONVOQUER&apos;26 ATHLETICS SECRETARIAT</span>
              <span>•</span>
              <span>OPERATIONS HUB</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white">
              SPORTS &amp; <span className="text-[#FFD700]">VENUE MANAGER</span>
            </h1>
            <p className="text-zinc-400 text-sm mt-1 max-w-2xl leading-relaxed">
              Sanction disciplines, manage venue inventory, and control operational status across
              Convoquer&apos;26.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/organizer"
              className="px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold uppercase text-zinc-300 transition-colors"
            >
              Organizer Overview
            </Link>
            {canCreateActive && (
              <button
                onClick={openCreateModal}
                className="px-5 py-2.5 bg-[#FFD700] hover:bg-[#ffe16d] text-black font-bold text-xs uppercase tracking-wider rounded-lg transition-all shadow-md active:scale-95 flex items-center gap-2"
                type="button"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span>{activeView === 'SPORTS' ? 'ADD SPORT' : 'ADD VENUE'}</span>
              </button>
            )}
          </div>
        </section>

        {eventError && (
          <div className="mt-4 p-3 rounded-lg bg-[#FF4500]/10 border border-[#FF4500]/30 text-[#FF4500] text-xs font-semibold">
            {eventError}
          </div>
        )}

        {actionError && (
          <div className="mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center justify-between">
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-8">
          <div className="bg-[#1d1b1e] border border-white/10 p-5 rounded-xl">
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold block mb-1">
              SANCTIONED SPORTS
            </span>
            <div className="text-3xl font-black text-white font-mono">
              {sportsLoading ? '—' : String(sports.length).padStart(2, '0')}
            </div>
            <span className="text-xs text-[#FFD700] font-mono mt-1 block">
              {sportsLoading
                ? 'Loading…'
                : `${sports.filter((s) => s.status === 'ACTIVE').length} Active Disciplines`}
            </span>
          </div>

          <div className="bg-[#1d1b1e] border border-white/10 p-5 rounded-xl">
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold block mb-1">
              INACTIVE SPORTS
            </span>
            <div className="text-3xl font-black text-[#FF4500] font-mono">
              {sportsLoading ? '—' : sports.filter((s) => s.status !== 'ACTIVE').length}
            </div>
            <span className="text-xs text-[#FF4500] font-mono mt-1 block">Not Currently Live</span>
          </div>

          <div className="bg-[#1d1b1e] border border-white/10 p-5 rounded-xl">
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold block mb-1">
              TOTAL VENUES
            </span>
            <div className="text-3xl font-black text-white font-mono">
              {venuesLoading ? '—' : String(venues.length).padStart(2, '0')}
            </div>
            <span className="text-xs text-zinc-400 font-mono mt-1 block">
              Across Campus &amp; Grounds
            </span>
          </div>

          <div className="bg-[#1d1b1e] border border-white/10 p-5 rounded-xl">
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold block mb-1">
              ACTIVE VENUES
            </span>
            <div className="text-3xl font-black text-emerald-400 font-mono">
              {venuesLoading ? '—' : venues.filter((v) => v.status === 'ACTIVE').length}
            </div>
            <span className="text-xs text-zinc-400 font-mono mt-1 block">
              Ready for Fixture Allocation
            </span>
          </div>
        </div>

        {/* View / Status Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-[#1d1b1e] p-3 rounded-xl border border-white/10">
          <div className="flex items-center gap-1 overflow-x-auto py-1">
            {(['SPORTS', 'VENUES'] as ViewMode[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveView(tab)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                  activeView === tab
                    ? 'bg-[#800020] text-white border border-[#FFD700]/40'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab}
              </button>
            ))}
            <span className="w-px h-5 bg-white/10 mx-1" />
            {['ALL', ...STATUS_OPTIONS].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                  statusFilter === tab
                    ? 'bg-white/15 text-white'
                    : 'text-zinc-500 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeView.toLowerCase()} by name...`}
            className="bg-[#121014] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFD700] w-64"
          />
        </div>

        {/* SPORTS GRID */}
        {activeView === 'SPORTS' && (
          <>
            {sportsLoading && (
              <div className="text-center py-16 text-zinc-500 text-sm font-mono">
                Loading sports…
              </div>
            )}
            {!sportsLoading && sportsError && (
              <div className="text-center py-16 border border-rose-500/20 rounded-xl bg-rose-950/20">
                <p className="text-rose-300 text-sm mb-3">{sportsError}</p>
                <button
                  onClick={loadSports}
                  className="px-4 py-2 rounded-lg bg-white/10 text-white text-xs font-bold uppercase hover:bg-white/20"
                >
                  Retry
                </button>
              </div>
            )}
            {!sportsLoading && !sportsError && filteredSports.length === 0 && (
              <div className="text-center py-16 text-zinc-500 text-sm font-mono border border-white/10 rounded-xl">
                No sports match the current filters.
              </div>
            )}
            {!sportsLoading && !sportsError && filteredSports.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredSports.map((sport) => (
                  <div
                    key={sport.id}
                    className="bg-[#1d1b1e] border border-white/10 hover:border-[#FFD700]/40 rounded-xl p-5 flex flex-col justify-between gap-4 transition-all shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="px-2 py-0.5 bg-[#800020] text-[#FFD700] text-[10px] font-bold rounded uppercase tracking-wider font-mono">
                          SPORT
                        </span>
                        <span
                          className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusBadgeClasses(sport.status)}`}
                        >
                          {sport.status}
                        </span>
                      </div>
                      <div className="text-lg font-black text-white uppercase">{sport.name}</div>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                        {sport.description || 'No description provided.'}
                      </p>
                      {sport._count && (
                        <div className="text-xs text-zinc-500 font-mono mt-2">
                          {sport._count.teams} team{sport._count.teams === 1 ? '' : 's'} registered
                        </div>
                      )}
                    </div>

                    {canUpdateSport && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                        <button
                          onClick={() => openEditSportModal(sport)}
                          className="py-2 bg-white/5 hover:bg-white/10 text-zinc-200 text-xs font-bold uppercase tracking-wider rounded-lg text-center transition-colors border border-white/10"
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteSport(sport)}
                          disabled={deletingId === sport.id}
                          className="py-2 bg-[#800020] hover:bg-[#9a0026] text-white text-xs font-bold uppercase tracking-wider rounded-lg text-center transition-colors border border-[#FFD700]/30 disabled:opacity-50"
                          type="button"
                        >
                          {deletingId === sport.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* VENUES GRID */}
        {activeView === 'VENUES' && (
          <>
            {venuesLoading && (
              <div className="text-center py-16 text-zinc-500 text-sm font-mono">
                Loading venues…
              </div>
            )}
            {!venuesLoading && venuesError && (
              <div className="text-center py-16 border border-rose-500/20 rounded-xl bg-rose-950/20">
                <p className="text-rose-300 text-sm mb-3">{venuesError}</p>
                <button
                  onClick={loadVenues}
                  className="px-4 py-2 rounded-lg bg-white/10 text-white text-xs font-bold uppercase hover:bg-white/20"
                >
                  Retry
                </button>
              </div>
            )}
            {!venuesLoading && !venuesError && filteredVenues.length === 0 && (
              <div className="text-center py-16 text-zinc-500 text-sm font-mono border border-white/10 rounded-xl">
                No venues match the current filters.
              </div>
            )}
            {!venuesLoading && !venuesError && filteredVenues.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredVenues.map((venue) => (
                  <div
                    key={venue.id}
                    className="bg-[#1d1b1e] border border-white/10 hover:border-[#FFD700]/40 rounded-xl p-5 flex flex-col justify-between gap-4 transition-all shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="px-2 py-0.5 bg-[#800020] text-[#FFD700] text-[10px] font-bold rounded uppercase tracking-wider font-mono">
                          VENUE
                        </span>
                        <span
                          className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusBadgeClasses(venue.status)}`}
                        >
                          {venue.status}
                        </span>
                      </div>
                      <div className="text-lg font-black text-white uppercase">{venue.name}</div>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                        {venue.location || 'No location specified.'}
                      </p>
                    </div>

                    {canUpdateVenue && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                        <button
                          onClick={() => openEditVenueModal(venue)}
                          className="py-2 bg-white/5 hover:bg-white/10 text-zinc-200 text-xs font-bold uppercase tracking-wider rounded-lg text-center transition-colors border border-white/10"
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteVenue(venue)}
                          disabled={deletingId === venue.id}
                          className="py-2 bg-[#800020] hover:bg-[#9a0026] text-white text-xs font-bold uppercase tracking-wider rounded-lg text-center transition-colors border border-[#FFD700]/30 disabled:opacity-50"
                          type="button"
                        >
                          {deletingId === venue.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-[#18161b] border border-white/20 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-black text-white uppercase">
                {editingSport || editingVenue ? 'Edit' : 'Add'}{' '}
                {activeView === 'SPORTS' ? 'Sport' : 'Venue'}
              </h3>
              <button onClick={closeModal} className="text-zinc-400 hover:text-white" type="button">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
                  {formError}
                </div>
              )}
              <div>
                <label className="font-bold uppercase text-zinc-400 block mb-1">
                  {activeView === 'SPORTS' ? 'Sport Name' : 'Venue Name'}
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={activeView === 'SPORTS' ? 'e.g. Football' : 'e.g. Main Sports Arena'}
                  className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="font-bold uppercase text-zinc-400 block mb-1">
                  {activeView === 'SPORTS' ? 'Description' : 'Location'}
                </label>
                <input
                  type="text"
                  value={formSecondary}
                  onChange={(e) => setFormSecondary(e.target.value)}
                  placeholder={
                    activeView === 'SPORTS'
                      ? 'Short description (optional)'
                      : 'e.g. Campus West Ground'
                  }
                  className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="font-bold uppercase text-zinc-400 block mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              {activeView === 'SPORTS' && (
                <label className="block">
                  Sport scoring mode
                  <select
                    aria-label="Sport scoring mode"
                    className="block w-full p-3 bg-zinc-900 rounded"
                    value={sportScoringMode}
                    onChange={(e) =>
                      setSportScoringMode(e.target.value as 'LIVE' | 'RESULT_ONLY' | '')
                    }
                  >
                    {!editingSport && (
                      <option value="">Default (Chess: results only; other sports: live)</option>
                    )}
                    <option value="LIVE">Live scoring</option>
                    <option value="RESULT_ONLY">Results only</option>
                  </select>
                  <span className="block text-xs text-zinc-400 mt-2">
                    Applies to new fixtures and updates existing fixtures that have not started.
                    Started and completed matches keep their mode.
                  </span>
                </label>
              )}
              {activeView === 'VENUES' && (
                <div className="space-y-3">
                  <label className="block">
                    Simultaneous matches at this venue
                    <input
                      required
                      type="number"
                      min={1}
                      max={64}
                      value={capacity}
                      onChange={(e) => setCapacity(Number(e.target.value))}
                      className="block w-full p-2 bg-zinc-900 rounded"
                    />
                  </label>
                  <p className="text-xs text-zinc-400">
                    Set the number of courts or playing areas that can safely host matches at once.
                  </p>
                  <GoogleCampusMap
                    venues={venues.filter((venue) => venue.id !== editingVenue?.id)}
                    point={latitude != null && longitude != null ? { latitude, longitude } : null}
                    onSelect={selectVenuePoint}
                  />
                  <p role="status" className="text-xs text-zinc-400">
                    {latitude != null && longitude != null
                      ? 'Venue pin selected. Save to publish this location.'
                      : 'Click the Google map to place the venue pin.'}
                  </p>
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      setLatitude(null);
                      setLongitude(null);
                    }}
                  >
                    Clear location
                  </button>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-white/10 text-white font-bold uppercase disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-[#FFD700] text-black font-bold uppercase tracking-wider shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default function SportsManagerPage() {
  return (
    <RequireOrganizer>
      <SportsVenuesManagerContent />
    </RequireOrganizer>
  );
}
