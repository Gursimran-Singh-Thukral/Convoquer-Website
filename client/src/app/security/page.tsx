'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Navbar } from '@/components/Navbar';
import { OrganizerNavRail } from '@/components/OrganizerNavRail';
import { LiveTickerRibbon } from '@/components/LiveTickerRibbon';
import { Footer } from '@/components/Footer';
import { RequireOrganizer } from '@/components/RequireOrganizer';
import { useAuth } from '@/lib/auth-context';
import {
  apiAuthedGet,
  apiPatch,
  apiPost,
  ApiError,
  fetchActiveEventId,
  type Participant,
} from '@/lib/api';

type AuditStatus = 'CLEARED' | 'FLAGGED' | 'NOTICE';
interface AuditEntry {
  id: string;
  time: string;
  text: string;
  status: AuditStatus;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function PersonAvatar({ participant, className }: { participant: Participant; className: string }) {
  return (
    <div className={className}>
      {participant.photographUrl ? (
        <Image
          src={participant.photographUrl}
          alt={participant.name}
          fill
          className="object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center font-display font-bold text-[#FFD700] bg-[#26202b]">
          {initialsOf(participant.name)}
        </div>
      )}
    </div>
  );
}

function formatTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return value;
  }
}

export default function SecurityGatePage() {
  const { user } = useAuth();
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventLoading, setEventLoading] = useState(true);

  const [query, setQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Participant[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [queue, setQueue] = useState<Participant[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);

  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);

  const [inspectModalImage, setInspectModalImage] = useState<{ title: string; url: string } | null>(
    null,
  );
  const [showFlagModal, setShowFlagModal] = useState<boolean>(false);
  const [flagReasonInput, setFlagReasonInput] = useState<string>(
    'Physical ID card photo does not match person',
  );
  const [flagSubmitting, setFlagSubmitting] = useState<boolean>(false);

  const [recentAudits, setRecentAudits] = useState<AuditEntry[]>([]);

  // Resolve the live/active event once on mount.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(async () => {
      const id = await fetchActiveEventId();
      if (!cancelled) {
        setEventId(id);
        setEventLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadQueue = useCallback(async (id: string) => {
    setQueueLoading(true);
    setQueueError(null);
    try {
      const list = await apiAuthedGet<Participant[]>(
        `/participants?eventId=${encodeURIComponent(id)}&category=AUDIENCE&isCheckedIn=false`,
      );
      setQueue(list);
    } catch (err) {
      setQueueError(
        err instanceof ApiError ? err.message : 'Could not load the live audience queue.',
      );
    } finally {
      setQueueLoading(false);
    }
  }, []);

  // Load the pending audience queue once the event is known, then poll for
  // fresh registrations coming in from the /pass kiosk (a separate device
  // in production, so there is no same-tab event bus to rely on anymore).
  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) loadQueue(eventId);
    });
    const interval = setInterval(() => loadQueue(eventId), 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [eventId, loadQueue]);

  const runSearch = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q) {
        setSearchResults([]);
        setSearchError(null);
        return;
      }
      setSearchLoading(true);
      setSearchError(null);
      try {
        const params = new URLSearchParams({ q });
        if (eventId) params.set('eventId', eventId);
        const results = await apiAuthedGet<Participant[]>(`/security/search?${params.toString()}`);
        setSearchResults(results);
        if (results.length > 0) {
          setSelectedParticipant(results[0]);
        }
      } catch (err) {
        setSearchResults([]);
        setSearchError(err instanceof ApiError ? err.message : 'Search failed. Please try again.');
      } finally {
        setSearchLoading(false);
      }
    },
    [eventId],
  );

  // Debounce live search-as-you-type.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      Promise.resolve().then(() => {
        setSearchResults([]);
        setSearchError(null);
      });
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const runQuickSearch = (text: string) => {
    setQuery(text);
    runSearch(text);
  };

  const pushAudit = (entry: Omit<AuditEntry, 'id' | 'time'>) => {
    const now = new Date();
    setRecentAudits((prev) =>
      [
        {
          id: `${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
          time: now.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          ...entry,
        },
        ...prev,
      ].slice(0, 30),
    );
  };

  const handleMovement = async (participant: Participant, direction: 'ENTRY' | 'EXIT') => {
    setCheckInError(null);
    setCheckingIn(true);
    try {
      // Campus has a single physical entry/exit point ("Main Gate") — no venue
      // is attached to a gate movement. Per-venue location tracking (currentVenueId)
      // is a separate concept for participants/volunteers moving between venues
      // once already on campus.
      const res = await apiPost<{ status: string; message: string; participant: Participant }>(
        '/security/movement',
        { participantId: participant.id, direction },
      );
      setSelectedParticipant(res.participant);
      setQueue((prev) =>
        direction === 'ENTRY'
          ? prev.filter((p) => p.id !== res.participant.id)
          : [res.participant, ...prev.filter((p) => p.id !== res.participant.id)],
      );
      setSearchResults((prev) =>
        prev.map((p) => (p.id === res.participant.id ? res.participant : p)),
      );

      pushAudit({
        text: `${res.participant.name} (${res.participant.gatePassNumber ?? 'no pass #'}) - ${res.message}`,
        status: res.status.startsWith('ALREADY') ? 'NOTICE' : 'CLEARED',
      });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Gate movement failed. Please try again.';
      setCheckInError(message);
      pushAudit({
        text: `${participant.name} - ${direction} FAILED: ${message}`,
        status: 'FLAGGED',
      });
    } finally {
      setCheckingIn(false);
    }
  };

  const handleFlagAttendee = async () => {
    if (!selectedParticipant) return;
    const reason = flagReasonInput || 'ID credentials unverified / suspicious';
    setFlagSubmitting(true);
    try {
      const updated = await apiPatch<Participant>(`/participants/${selectedParticipant.id}`, {
        isFlagged: true,
        flagReason: reason,
      });
      setSelectedParticipant(updated);
      setSearchResults((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setQueue((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      pushAudit({
        text: `${updated.name} (${updated.gatePassNumber ?? 'no pass #'}) - FLAGGED: ${reason}`,
        status: 'FLAGGED',
      });
      setShowFlagModal(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to flag participant.';
      pushAudit({
        text: `Flag attempt FAILED for ${selectedParticipant.name}: ${message}`,
        status: 'FLAGGED',
      });
    } finally {
      setFlagSubmitting(false);
    }
  };

  const activeFlag = selectedParticipant?.isFlagged
    ? {
        reason: selectedParticipant.flagReason || 'Unspecified',
        flaggedAt: formatTimestamp(selectedParticipant.flaggedAt) || '',
      }
    : undefined;

  return (
    <RequireOrganizer anyPermission={['security.access']}>
      <div className="min-h-screen flex flex-col bg-[#121114] text-[#E8E6EB]">
        <LiveTickerRibbon />
        <Navbar />
        <OrganizerNavRail />

        {/* Security Top Bar */}
        <section className="w-full bg-[#151317] border-b border-white/10 px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#701A2B] border border-[#FFD700]/50 flex items-center justify-center text-[#FFD700] shadow-md shrink-0">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div>
              <span className="font-display font-bold text-sm text-white uppercase tracking-wider block">
                CONVOQUER&apos;26 SECURITY DESK • MAIN GATE
              </span>
              <span className="text-xs font-mono text-gray-400">
                Signed in as{' '}
                <strong className="text-white">
                  {user?.name || user?.email || 'Security Officer'}
                </strong>{' '}
                • Scanner &amp; Physical ID Verification Active
              </span>
            </div>
          </div>

          {/* Public Audience Kiosk Link (Self-Registration) */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/pass"
              target="_blank"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1F1B24] hover:bg-[#282330] text-[#FFD700] hover:text-white font-mono text-xs font-bold uppercase tracking-wider transition-all border border-[#D4AF37]/40 shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Audience Self-Kiosk Portal (/pass) &rarr;</span>
            </Link>
          </div>
        </section>

        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
          {eventLoading ? (
            <div className="text-center py-3 text-xs font-mono text-zinc-400">
              Resolving active event...
            </div>
          ) : !eventId ? (
            <div className="bg-rose-950/40 border border-rose-500/40 text-rose-200 rounded-2xl p-4 text-xs font-mono">
              No active event found on the backend. Search will still attempt to run across all
              events, but the live audience queue cannot be loaded.
            </div>
          ) : null}

          {/* Live Audience Registration Queue Banner */}
          <div className="bg-[#151318] border border-[#FFD700]/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF4500] animate-pulse"></span>
                <h2 className="font-display font-bold text-sm text-white uppercase tracking-wider">
                  LIVE AUDIENCE &amp; VISITOR REGISTRATIONS QUEUE ({queue.length} Awaiting Physical
                  Check)
                </h2>
              </div>
              <span className="text-[11px] font-mono text-zinc-400">
                Refreshes automatically every 20s
              </span>
            </div>

            {queueLoading && queue.length === 0 ? (
              <div className="text-center py-3 text-xs font-mono text-zinc-400">
                Loading live queue...
              </div>
            ) : queueError ? (
              <div className="text-center py-3 text-xs font-mono text-rose-300">{queueError}</div>
            ) : queue.length === 0 ? (
              <div className="text-center py-3 text-xs font-mono text-zinc-400">
                No pending audience registrations at Gate 1. Newly submitted passes on{' '}
                <Link href="/pass" className="text-[#FFD700] underline">
                  /pass
                </Link>{' '}
                will appear here within 20 seconds.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {queue.map((aud) => (
                  <button
                    key={aud.id}
                    onClick={() => setSelectedParticipant(aud)}
                    type="button"
                    className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                      selectedParticipant?.id === aud.id
                        ? 'bg-[#221C28] border-[#FFD700] shadow-md'
                        : 'bg-[#18161D] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <PersonAvatar
                      participant={aud}
                      className="relative w-11 h-11 rounded-lg overflow-hidden border border-[#FFD700]/50 shrink-0 bg-black"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-display font-bold text-xs text-white uppercase truncate">
                          {aud.name}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#701A2B] text-[#FFD700] shrink-0 font-bold">
                          NEW
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono truncate block">
                        {aud.institute?.name || 'General Public / Spectator'}
                      </span>
                      <span className="text-[10px] text-amber-300 font-mono block">
                        {aud.gatePassNumber || '—'} • {formatTimestamp(aud.createdAt) || 'Just now'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Instant Search Bar */}
          <div className="bg-[#121114] border border-white/10 p-5 rounded-2xl shadow-xl space-y-3">
            <label className="text-xs font-mono text-[#FFD700] uppercase tracking-wider flex items-center gap-1.5 font-bold">
              <svg
                className="w-4 h-4 text-[#FFD700]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              INSTANT PARTICIPANT &amp; PASS VERIFICATION SEARCH
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Type Name, Roll Number, Phone, or Gate Pass (e.g. Aarav, 2023UEC0012, CQ26-P-..., CQ26-AUD-...)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-[#1B191E] border-2 border-white/15 focus:border-[#FFD700] text-white text-base font-mono px-4 py-3.5 rounded-xl focus:outline-none transition-all placeholder-gray-500"
              />
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-mono text-gray-400 pt-1">
              <span>Quick tests:</span>
              <button
                onClick={() => runQuickSearch('Aarav Sharma')}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/15 text-white underline"
              >
                Aarav Sharma (Athlete)
              </button>
              <button
                onClick={() => runQuickSearch('Tufail Ahmed')}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/15 text-white underline"
              >
                Tufail Ahmed (Captain)
              </button>
              <button
                onClick={() => runQuickSearch('Rohan Verma')}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/15 text-white underline"
              >
                Rohan Verma (Athlete)
              </button>
            </div>
            {searchLoading && (
              <div className="text-[11px] font-mono text-zinc-400">Searching...</div>
            )}
            {searchError && (
              <div className="text-[11px] font-mono text-rose-300">{searchError}</div>
            )}
            {!searchLoading && !searchError && query.trim() && searchResults.length === 0 && (
              <div className="text-[11px] font-mono text-zinc-400">
                No matches found for &quot;{query}&quot;.
              </div>
            )}

            {searchResults.length > 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedParticipant(r)}
                    className={`p-2.5 rounded-lg border text-left flex items-center gap-2.5 transition-all ${
                      selectedParticipant?.id === r.id
                        ? 'bg-[#221C28] border-[#FFD700]'
                        : 'bg-[#18161D] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <PersonAvatar
                      participant={r}
                      className="relative w-8 h-8 rounded-lg overflow-hidden border border-white/15 shrink-0 bg-black"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{r.name}</div>
                      <div className="text-[10px] text-zinc-400 font-mono truncate">
                        {r.gatePassNumber || '—'} • {r.category}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Full Verification Dossier (Face Photo & System Record Cross-Check) */}
          {!selectedParticipant ? (
            <div className="bg-[#121114] border border-white/10 rounded-2xl p-8 text-center text-xs font-mono text-zinc-400">
              Search a name, roll number, phone, or gate pass above (or tap a queued registration)
              to open the verification dossier.
            </div>
          ) : (
            <div className="bg-[#151317] border border-white/15 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                <div className="flex items-start gap-4">
                  {/* Person Headshot Photo */}
                  <div className="relative group">
                    <PersonAvatar
                      participant={selectedParticipant}
                      className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-[#FFD700] bg-black shrink-0 shadow-lg"
                    />
                    {selectedParticipant.photographUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setInspectModalImage({
                            title: `${selectedParticipant.name} - Biometric Photo`,
                            url: selectedParticipant.photographUrl as string,
                          })
                        }
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-mono text-white transition-opacity rounded-2xl"
                      >
                        Zoom Photo
                      </button>
                    )}
                  </div>

                  {/* Uploaded Government ID Document */}
                  {selectedParticipant.idDocumentUrl && (
                    <div className="relative group shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary decrypted data URL, not part of the static build */}
                      <img
                        src={selectedParticipant.idDocumentUrl}
                        alt={`${selectedParticipant.name} - Government ID`}
                        className="relative w-24 h-24 rounded-2xl overflow-hidden object-cover border-2 border-[#FFD700] bg-black shadow-lg"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setInspectModalImage({
                            title: `${selectedParticipant.name} - Government ID`,
                            url: selectedParticipant.idDocumentUrl as string,
                          })
                        }
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-mono text-white transition-opacity rounded-2xl text-center px-1"
                      >
                        Zoom ID
                      </button>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded uppercase ${
                          selectedParticipant.category === 'ATHLETE'
                            ? 'bg-[#701A2B] text-[#FFD700] border border-[#FFD700]/40'
                            : selectedParticipant.category === 'OFFICIAL'
                              ? 'bg-[#1E1D23] text-purple-300 border border-purple-500/30'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {selectedParticipant.category}
                      </span>
                      <span className="text-xs font-mono text-[#FFD700] font-bold">
                        {selectedParticipant.gatePassNumber || 'NO PASS #'}
                      </span>
                      {activeFlag && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/40 font-bold">
                          FLAGGED / BLOCKED
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-display font-bold text-white uppercase tracking-wide">
                      {selectedParticipant.name}
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                      {selectedParticipant.institute?.name || 'Unaffiliated / Walk-in'}
                    </p>
                    <p className="text-xs font-mono text-gray-500 mt-0.5">
                      Roll/ID:{' '}
                      <strong className="text-gray-300">
                        {selectedParticipant.rollNumber || '—'}
                      </strong>{' '}
                      • Phone:{' '}
                      <strong className="text-gray-300">
                        {selectedParticipant.contactNumber || '—'}
                      </strong>
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="sm:text-right">
                  <span className="text-[10px] font-mono text-gray-400 uppercase block mb-1">
                    GATE CLEARANCE STATUS
                  </span>
                  {activeFlag ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950 border border-rose-500/40 text-rose-400 font-mono text-xs font-bold uppercase">
                      <span>ENTRY DENIED</span>
                    </div>
                  ) : selectedParticipant.isCheckedIn ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950 border border-emerald-500/40 text-emerald-400 font-mono text-xs font-bold uppercase">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>CHECKED IN</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-400 font-mono text-xs font-bold uppercase">
                      <span>AWAITING PHYSICAL ID CHECK</span>
                    </div>
                  )}
                  {selectedParticipant.checkedInAt && (
                    <span className="block text-[11px] font-mono text-gray-400 mt-1">
                      At: {formatTimestamp(selectedParticipant.checkedInAt)}
                    </span>
                  )}
                </div>
              </div>

              {/* System Record for Physical Cross-Check */}
              <div className="bg-[#1A171F] border border-white/15 rounded-xl p-4 sm:p-5 space-y-3">
                <div className="border-b border-white/10 pb-2">
                  <span className="text-xs font-mono font-bold text-[#FFD700] uppercase tracking-wider block">
                    SYSTEM RECORD (CROSS-CHECK AGAINST PHYSICAL ID MANDATORY)
                  </span>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    Verify that the physical ID card presented matches {selectedParticipant.name}{' '}
                    and roll {selectedParticipant.rollNumber || 'N/A'} to curb fake/rubbish entries.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs font-mono text-zinc-300">
                  <div>
                    <span className="text-zinc-500">Category: </span>
                    <strong className="text-white">{selectedParticipant.category}</strong>
                  </div>
                  <div>
                    <span className="text-zinc-500">Affiliation: </span>
                    <strong className="text-white">
                      {selectedParticipant.institute?.name || 'Unaffiliated / Walk-in'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-zinc-500">Roll/Govt Number: </span>
                    <strong className="text-emerald-400">
                      {selectedParticipant.rollNumber || '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-zinc-500">Gate Pass Code: </span>
                    <strong className="text-white">
                      {selectedParticipant.gatePassNumber || '—'}
                    </strong>
                  </div>
                  {selectedParticipant.teamMembers &&
                    selectedParticipant.teamMembers.length > 0 && (
                      <div>
                        <span className="text-zinc-500">Team / Sport: </span>
                        <strong className="text-white">
                          {selectedParticipant.teamMembers[0].team?.name}
                          {selectedParticipant.teamMembers[0].team?.sport?.name
                            ? ` (${selectedParticipant.teamMembers[0].team?.sport?.name})`
                            : ''}
                        </strong>
                      </div>
                    )}
                  <div>
                    <span className="text-zinc-500">Registered: </span>
                    <span className="text-zinc-400">
                      {formatTimestamp(selectedParticipant.createdAt) || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Flagged Warning if any (session-only, not persisted to the backend) */}
              {activeFlag && (
                <div className="p-4 rounded-xl bg-rose-950/40 border-2 border-rose-500/60 text-rose-200 text-xs space-y-1">
                  <div className="font-display font-bold uppercase tracking-wider text-rose-300 flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-rose-400 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <span>FLAGGED ENTRY — REASON: {activeFlag.reason}</span>
                  </div>
                  <p>
                    This person has been flagged by security at {activeFlag.flaggedAt} on this
                    device. Do not permit entry through the turnstiles. Request physical government
                    ID card or escalate to Secretariat desk.
                  </p>
                  <p className="text-rose-400/80">
                    Note: this flag is recorded for this browser session only — there is no backend
                    field for it yet, so it is not visible to other gate devices.
                  </p>
                </div>
              )}

              {/* Warning Alert if Already Checked In (Stopping Badge Sharing) */}
              {selectedParticipant.isCheckedIn && (
                <div className="p-4 rounded-xl bg-amber-950/40 border-2 border-amber-500/60 text-amber-200 text-xs space-y-1">
                  <div className="font-display font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-amber-400 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <span>WARNING: PASS ALREADY SCANNED PREVIOUSLY</span>
                  </div>
                  <p>
                    This badge was already scanned at{' '}
                    <strong>{formatTimestamp(selectedParticipant.checkedInAt)}</strong>. Please
                    check physical government photo ID to prevent badge-sharing across campus
                    boundaries.
                  </p>
                </div>
              )}

              {checkInError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/50 text-rose-200 text-xs font-mono">
                  {checkInError}
                </div>
              )}

              {/* Action Buttons for Security Guard — campus has a single physical gate, so
                  there is nothing to select; every movement is logged against Main Gate. */}
              <div className="pt-4 border-t border-white/10 flex flex-wrap items-center gap-4">
                {!selectedParticipant.isCheckedIn ? (
                  <>
                    <button
                      onClick={() => handleMovement(selectedParticipant, 'ENTRY')}
                      disabled={checkingIn}
                      className="flex-1 py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-display text-sm font-bold uppercase tracking-wider transition-all shadow-lg text-center flex items-center justify-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>
                        {checkingIn ? 'Verifying...' : 'Verify Credentials & Allow Entry'}
                      </span>
                    </button>
                    <button
                      onClick={() => setShowFlagModal(true)}
                      className="py-3 px-5 rounded-xl bg-rose-900/60 hover:bg-rose-800 text-rose-200 font-display text-xs font-bold uppercase tracking-wider transition-all border border-rose-500/40"
                    >
                      Flag / Reject Invalid ID
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleMovement(selectedParticipant, 'EXIT')}
                      disabled={checkingIn}
                      className="flex-1 py-3 px-6 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-60 text-white font-display text-sm font-bold uppercase tracking-wider text-center"
                    >
                      {checkingIn ? 'Recording...' : 'Record Exit'}
                    </button>
                    <button
                      onClick={() => setShowFlagModal(true)}
                      className="py-3 px-4 rounded-xl bg-zinc-800 hover:bg-rose-900/60 text-zinc-300 hover:text-rose-200 font-display text-xs font-bold uppercase tracking-wider transition-all"
                    >
                      Flag for Review
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Live Gate Clearance Stream */}
          <div className="bg-[#121114] border border-white/10 p-5 rounded-2xl shadow-lg space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400 border-b border-white/5 pb-2">
              <span className="font-bold text-white uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                RECENT GATE CLEARANCE AUDIT STREAM
              </span>
              <span>This Session</span>
            </div>

            {recentAudits.length === 0 ? (
              <div className="text-center py-3 text-xs font-mono text-zinc-500">
                No verification actions yet this session. Actions taken above will appear here.
              </div>
            ) : (
              <div className="space-y-2 font-mono text-xs">
                {recentAudits.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded bg-[#1B191E] border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[#FFD700] font-bold">{item.time}</span>
                      <span className="text-gray-300">{item.text}</span>
                    </div>
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[10px] shrink-0 ${
                        item.status === 'CLEARED'
                          ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-500/30'
                          : item.status === 'NOTICE'
                            ? 'text-amber-400 bg-amber-950/60 border border-amber-500/30'
                            : 'text-rose-400 bg-rose-950/60 border border-rose-500/30'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Photo Fullscreen Preview Modal */}
        {inspectModalImage && (
          <div
            onClick={() => setInspectModalImage(null)}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[#18151C] border border-white/20 rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-2xl relative"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="font-display font-bold text-base text-white uppercase tracking-wide">
                  {inspectModalImage.title}
                </h3>
                <button
                  onClick={() => setInspectModalImage(null)}
                  className="text-gray-400 hover:text-white"
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
              </div>

              <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-white/15 bg-black">
                <Image
                  src={inspectModalImage.url}
                  alt={inspectModalImage.title}
                  fill
                  className="object-contain"
                />
              </div>

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setInspectModalImage(null)}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono text-xs font-bold"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Flag / Anti-Rubbish Modal */}
        {showFlagModal && (
          <div
            onClick={() => setShowFlagModal(false)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1A1418] border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="font-display font-bold text-base text-rose-300 uppercase tracking-wide">
                  Flag Suspicious / Rubbish Submission
                </h3>
                <button
                  onClick={() => setShowFlagModal(false)}
                  className="text-gray-400 hover:text-white"
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
              </div>

              <p className="text-xs text-zinc-300 font-mono">
                Prevent unauthorized entry by flagging suspicious submissions where the photo does
                not match the attendee or credentials look bogus. This is recorded for this
                session/device only — there is no backend field yet to persist or sync it.
              </p>

              <div className="space-y-2 text-xs font-mono">
                <label className="block text-zinc-400 uppercase font-bold">
                  Reason for Flagging:
                </label>
                <select
                  value={flagReasonInput}
                  onChange={(e) => setFlagReasonInput(e.target.value)}
                  className="w-full bg-[#100D12] border border-zinc-700 text-white p-2.5 rounded-lg"
                >
                  <option value="Physical ID card photo does not match person">
                    Physical ID card photo does not match person
                  </option>
                  <option value="Fake / blurred / rubbish ID card uploaded">
                    Fake / blurred / rubbish ID card uploaded
                  </option>
                  <option value="Student Roll / Institution mismatch">
                    Student Roll / Institution mismatch
                  </option>
                  <option value="Non-accredited spectator attempting athlete access">
                    Non-accredited spectator attempting athlete access
                  </option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFlagModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 font-mono text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFlagAttendee}
                  disabled={flagSubmitting}
                  className="px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-mono text-xs font-bold uppercase shadow-lg disabled:opacity-50"
                >
                  {flagSubmitting ? 'Flagging…' : 'Confirm Flag & Deny Entry'}
                </button>
              </div>
            </div>
          </div>
        )}

        <Footer />
      </div>
    </RequireOrganizer>
  );
}
