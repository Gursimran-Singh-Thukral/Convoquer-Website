'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { OrganizerNavRail } from '@/components/OrganizerNavRail';
import { LiveTickerRibbon } from '@/components/LiveTickerRibbon';
import { Footer } from '@/components/Footer';
import { RequireOrganizer } from '@/components/RequireOrganizer';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/ToastProvider';
import {
  apiAuthedGet,
  apiPatch,
  apiPost,
  ApiError,
  teamCodeFromName,
  type Match,
  type PendingResultItem,
} from '@/lib/api';

function formatTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function scoreDetailsPreview(details?: Record<string, unknown> | null): string | null {
  if (!details || Object.keys(details).length === 0) return null;
  try {
    return JSON.stringify(details);
  } catch {
    return null;
  }
}

export default function MatchApprovalsPage() {
  const { hasPermission, myScopedSportId } = useAuth();
  const { promptText } = useToast();

  const canApprove = hasPermission('result.approve');
  const canSubmit = hasPermission('result.submit');
  const canOverride = hasPermission('result.override');

  const [pendingResults, setPendingResults] = useState<PendingResultItem[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [pendingError, setPendingError] = useState<string | null>(null);

  const [sportFilter, setSportFilter] = useState<string>('ALL');
  const [notification, setNotification] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [approvedThisSession, setApprovedThisSession] = useState(0);

  const [overrideOpenId, setOverrideOpenId] = useState<string | null>(null);
  const [overrideForm, setOverrideForm] = useState({
    finalScoreA: '',
    finalScoreB: '',
    winnerTeamId: '',
    reason: '',
  });

  // Submit-new-result panel
  const [submitPanelOpen, setSubmitPanelOpen] = useState(false);
  const [completedMatches, setCompletedMatches] = useState<Match[]>([]);
  const [loadingCompleted, setLoadingCompleted] = useState(false);
  const [submitForm, setSubmitForm] = useState({
    matchId: '',
    finalScoreA: '',
    finalScoreB: '',
    winnerTeamId: '',
    notes: '',
  });

  const loadPending = useCallback(async () => {
    if (!canApprove) {
      setPendingResults([]);
      setLoadingPending(false);
      return;
    }
    setLoadingPending(true);
    setPendingError(null);
    try {
      // A Sports Coordinator only holds result.approve scoped to their own
      // sport — the backend requires that scope to be passed explicitly as a
      // query param (it never infers it), so this must be included or a
      // scoped coordinator gets a 403 instead of just seeing their sport.
      const scopedSportId = myScopedSportId('result.approve');
      const qs = scopedSportId ? `?sportId=${encodeURIComponent(scopedSportId)}` : '';
      const data = await apiAuthedGet<PendingResultItem[]>(`/dashboard/pending-approvals${qs}`);
      setPendingResults(Array.isArray(data) ? data : []);
    } catch (err) {
      setPendingError(
        err instanceof ApiError ? err.message : 'Failed to load the approvals queue.',
      );
    } finally {
      setLoadingPending(false);
    }
  }, [canApprove, myScopedSportId]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) loadPending();
    });
    return () => {
      cancelled = true;
    };
  }, [loadPending]);

  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 5000);
    return () => clearTimeout(t);
  }, [notification]);

  const sportTabs = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of pendingResults) {
      const sport = r.match.tournament?.sport;
      if (sport?.id) map.set(sport.id, sport.name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [pendingResults]);

  const filteredResults = useMemo(() => {
    if (sportFilter === 'ALL') return pendingResults;
    return pendingResults.filter((r) => r.match.tournament?.sport?.id === sportFilter);
  }, [pendingResults, sportFilter]);

  const runAction = async (key: string, fn: () => Promise<unknown>, successMsg: string) => {
    setActionKey(key);
    setActionError(null);
    try {
      await fn();
      setNotification(successMsg);
      await loadPending();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Action failed. Please try again.');
    } finally {
      setActionKey(null);
    }
  };

  const handleApprove = (result: PendingResultItem) => {
    runAction(
      `approve-${result.id}`,
      async () => {
        await apiPatch(`/results/${result.id}/approve`, {});
        setApprovedThisSession((n) => n + 1);
      },
      `Result for ${result.match.teamA?.name || 'Team A'} vs ${result.match.teamB?.name || 'Team B'} approved and published.`,
    );
  };

  const handleReject = async (result: PendingResultItem) => {
    const reason = await promptText('Reason for rejecting this result (required):');
    if (!reason || !reason.trim()) return;
    runAction(
      `reject-${result.id}`,
      () => apiPatch(`/results/${result.id}/reject`, { reason: reason.trim() }),
      `Result sent back for correction.`,
    );
  };

  const handleBulkApprove = async () => {
    if (filteredResults.length === 0) return;
    setActionKey('bulk');
    setActionError(null);
    const outcomes = await Promise.allSettled(
      filteredResults.map((r) => apiPatch(`/results/${r.id}/approve`, {})),
    );
    const succeeded = outcomes.filter((o) => o.status === 'fulfilled').length;
    const failed = outcomes.length - succeeded;
    setApprovedThisSession((n) => n + succeeded);
    setNotification(
      failed === 0
        ? `All ${succeeded} pending scorecards approved and published.`
        : `${succeeded} approved, ${failed} failed (check permissions/status and retry).`,
    );
    setActionKey(null);
    await loadPending();
  };

  const openOverride = (result: PendingResultItem) => {
    setOverrideOpenId(result.id);
    setOverrideForm({
      finalScoreA: String(result.finalScoreA ?? ''),
      finalScoreB: String(result.finalScoreB ?? ''),
      winnerTeamId: result.winnerTeamId || '',
      reason: '',
    });
  };

  const handleOverrideSubmit = (e: React.FormEvent, result: PendingResultItem) => {
    e.preventDefault();
    const scoreA = Number(overrideForm.finalScoreA);
    const scoreB = Number(overrideForm.finalScoreB);
    if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) {
      setActionError('Final scores for both teams are required to override a result.');
      return;
    }
    if (!overrideForm.reason.trim()) {
      setActionError('A reason is required to override a result.');
      return;
    }
    runAction(
      `override-${result.id}`,
      async () => {
        await apiPatch(`/results/${result.id}/override`, {
          finalScoreA: scoreA,
          finalScoreB: scoreB,
          winnerTeamId: overrideForm.winnerTeamId || undefined,
          reason: overrideForm.reason.trim(),
        });
        setApprovedThisSession((n) => n + 1);
      },
      `Result overridden and republished.`,
    );
    setOverrideOpenId(null);
  };

  const loadCompletedMatches = useCallback(async () => {
    setLoadingCompleted(true);
    try {
      const data = await apiAuthedGet<Match[]>('/matches?status=COMPLETED');
      setCompletedMatches(Array.isArray(data) ? data : []);
    } catch {
      setCompletedMatches([]);
    } finally {
      setLoadingCompleted(false);
    }
  }, []);

  const toggleSubmitPanel = () => {
    const next = !submitPanelOpen;
    setSubmitPanelOpen(next);
    if (next && completedMatches.length === 0) {
      loadCompletedMatches();
    }
  };

  const selectedCompletedMatch = completedMatches.find((m) => m.id === submitForm.matchId);

  const handleSubmitResult = (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitForm.matchId) {
      setActionError('Select a match to submit a result for.');
      return;
    }
    const body: Record<string, unknown> = {};
    if (submitForm.finalScoreA !== '') body.finalScoreA = Number(submitForm.finalScoreA);
    if (submitForm.finalScoreB !== '') body.finalScoreB = Number(submitForm.finalScoreB);
    if (submitForm.winnerTeamId) body.winnerTeamId = submitForm.winnerTeamId;
    if (submitForm.notes.trim()) body.notes = submitForm.notes.trim();

    runAction(
      'submit-result',
      () => apiPost(`/matches/${submitForm.matchId}/result`, body),
      'Result submitted for coordinator approval.',
    );
    setSubmitForm({ matchId: '', finalScoreA: '', finalScoreB: '', winnerTeamId: '', notes: '' });
  };

  return (
    <RequireOrganizer anyPermission={['result.submit', 'result.approve', 'result.override']}>
      <div className="min-h-screen flex flex-col bg-[#121114] text-[#E8E6EB] selection:bg-[#FF4500] selection:text-white font-sans">
        <LiveTickerRibbon />
        <Navbar />
        <OrganizerNavRail />

        <div className="h-[3px] w-full bg-gradient-to-r from-[#800020] via-[#FF4500] to-[#FFD700]"></div>

        <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
          <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-[#FFD700] uppercase tracking-widest mb-1">
                <span>CONVOQUER&apos;26 CHIEF SECRETARIAT</span>
                <span>•</span>
                <span>VERIFICATION DESK</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white">
                MATCH <span className="text-[#FFD700]">APPROVALS</span> &amp; RESULTS DESK
              </h1>
              <p className="text-zinc-400 text-sm sm:text-base mt-2 max-w-2xl leading-relaxed font-sans">
                Official score verification, result approvals, corrections, and public leaderboard
                publishing.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 self-start md:self-end">
              <Link
                href="/organizer"
                className="px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-white transition-colors"
              >
                Organizer Overview
              </Link>
              {canApprove && filteredResults.length > 0 && (
                <button
                  onClick={handleBulkApprove}
                  disabled={actionKey !== null}
                  className="text-xs font-bold uppercase tracking-wider bg-[#FF4500] hover:brightness-110 disabled:opacity-40 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 transition-all active:scale-95 border border-[#FF4500]/50"
                  type="button"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                  <span>
                    {actionKey === 'bulk'
                      ? 'PUBLISHING…'
                      : `BULK PUBLISH APPROVED (${filteredResults.length})`}
                  </span>
                </button>
              )}
            </div>
          </section>

          {notification && (
            <div className="my-4 p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-sm flex items-center gap-3 animate-in fade-in duration-200">
              <svg
                className="w-5 h-5 text-emerald-400 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="font-semibold">{notification}</span>
            </div>
          )}
          {actionError && (
            <div className="my-4 p-4 rounded-xl bg-red-950/50 border border-red-500/40 text-red-300 text-sm flex items-center gap-3">
              <svg
                className="w-5 h-5 text-red-400 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-semibold">{actionError}</span>
            </div>
          )}
          {pendingError && (
            <div className="my-4 p-4 rounded-xl bg-red-950/50 border border-red-500/40 text-red-300 text-sm">
              {pendingError}
            </div>
          )}

          {/* Metric KPI Overview */}
          <section className="grid grid-cols-1 gap-5 my-8 md:grid-cols-2">
            <div className="bg-[#1d1b1e] border border-white/10 rounded-xl p-5 relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold">
                  Pending Verification
                </span>
                <div className="w-9 h-9 rounded-lg bg-[#2c292c] border border-[#FFD700]/40 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-[#FFD700]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-black text-white tracking-wide font-mono">
                  {canApprove ? (loadingPending ? '…' : pendingResults.length) : '—'} MATCHES
                </div>
                <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-white/5 text-xs text-[#FFD700]">
                  <span className="w-2 h-2 rounded-full bg-[#FFD700] animate-pulse"></span>
                  <span>
                    {canApprove
                      ? 'Awaiting Coordinator Attestation Sign-off'
                      : 'You do not hold result.approve permission'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[#1d1b1e] border border-white/10 rounded-xl p-5 relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold">
                  Approved This Session
                </span>
                <div className="w-9 h-9 rounded-lg bg-[#2c292c] border border-[#800020]/60 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-[#ff828a]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-black text-white tracking-wide font-mono">
                  {approvedThisSession} MATCHES
                </div>
                <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-white/5 text-xs text-zinc-300">
                  <span className="w-2 h-2 rounded-full bg-[#800020]"></span>
                  <span>Published in this browser session</span>
                </div>
              </div>
            </div>
          </section>

          {/* Submit New Result Panel */}
          {canSubmit && (
            <section className="mb-8 bg-[#1d1b1e] border border-white/10 rounded-xl p-5">
              <button
                onClick={toggleSubmitPanel}
                type="button"
                className="w-full flex items-center justify-between text-left"
              >
                <span className="text-sm font-bold uppercase tracking-wider text-white">
                  Submit New Match Result
                </span>
                <span className="text-[#FFD700] text-xs font-bold">
                  {submitPanelOpen ? '▾ HIDE' : '▸ SHOW'}
                </span>
              </button>
              {submitPanelOpen && (
                <form onSubmit={handleSubmitResult} className="mt-4 space-y-3">
                  <div>
                    <label className="text-[10px] text-zinc-400 uppercase block mb-1">
                      Completed Match
                    </label>
                    <select
                      value={submitForm.matchId}
                      onChange={(e) =>
                        setSubmitForm((p) => ({ ...p, matchId: e.target.value, winnerTeamId: '' }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#0e0e11] border border-white/10 text-sm text-white"
                    >
                      <option value="">
                        {loadingCompleted
                          ? 'Loading completed matches…'
                          : 'Select a completed match'}
                      </option>
                      {completedMatches.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.matchNumber || m.id.slice(0, 8)} — {m.teamA?.name || 'TBD'} vs{' '}
                          {m.teamB?.name || 'TBD'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-zinc-400 uppercase block mb-1">
                        {selectedCompletedMatch?.teamA?.name || 'Team A'} Final Score
                      </label>
                      <input
                        type="number"
                        value={submitForm.finalScoreA}
                        onChange={(e) =>
                          setSubmitForm((p) => ({ ...p, finalScoreA: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[#0e0e11] border border-white/10 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-400 uppercase block mb-1">
                        {selectedCompletedMatch?.teamB?.name || 'Team B'} Final Score
                      </label>
                      <input
                        type="number"
                        value={submitForm.finalScoreB}
                        onChange={(e) =>
                          setSubmitForm((p) => ({ ...p, finalScoreB: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[#0e0e11] border border-white/10 text-sm text-white"
                      />
                    </div>
                  </div>
                  {selectedCompletedMatch && (
                    <div>
                      <label className="text-[10px] text-zinc-400 uppercase block mb-1">
                        Winner
                      </label>
                      <select
                        value={submitForm.winnerTeamId}
                        onChange={(e) =>
                          setSubmitForm((p) => ({ ...p, winnerTeamId: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[#0e0e11] border border-white/10 text-sm text-white"
                      >
                        <option value="">Auto-determine from scores (draw if equal)</option>
                        {selectedCompletedMatch.teamA && (
                          <option value={selectedCompletedMatch.teamA.id}>
                            {selectedCompletedMatch.teamA.name}
                          </option>
                        )}
                        {selectedCompletedMatch.teamB && (
                          <option value={selectedCompletedMatch.teamB.id}>
                            {selectedCompletedMatch.teamB.name}
                          </option>
                        )}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] text-zinc-400 uppercase block mb-1">Notes</label>
                    <textarea
                      value={submitForm.notes}
                      onChange={(e) => setSubmitForm((p) => ({ ...p, notes: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg bg-[#0e0e11] border border-white/10 text-sm text-white"
                      placeholder="Optional notes for the approving coordinator"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={actionKey === 'submit-result' || !submitForm.matchId}
                    className="px-5 py-2.5 rounded-lg bg-[#FFD700] text-black text-xs font-black uppercase tracking-wider disabled:opacity-40"
                  >
                    {actionKey === 'submit-result' ? 'Submitting…' : 'Submit Result For Approval'}
                  </button>
                </form>
              )}
            </section>
          )}

          {/* Action Filter Tabs */}
          {canApprove && sportTabs.length > 0 && (
            <section className="mb-8">
              <div className="bg-[#1d1b1e] border border-white/10 rounded-xl p-2 flex items-center overflow-x-auto gap-1">
                <button
                  onClick={() => setSportFilter('ALL')}
                  className={`text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg whitespace-nowrap transition-all ${
                    sportFilter === 'ALL'
                      ? 'bg-[#800020] text-white border border-[#FFD700]/40 shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                  type="button"
                >
                  ALL PENDING ({pendingResults.length})
                </button>
                {sportTabs.map((tab) => {
                  const isActive = sportFilter === tab.id;
                  const count = pendingResults.filter(
                    (r) => r.match.tournament?.sport?.id === tab.id,
                  ).length;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setSportFilter(tab.id)}
                      className={`text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg whitespace-nowrap transition-all ${
                        isActive
                          ? 'bg-[#800020] text-white border border-[#FFD700]/40 shadow-sm'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                      type="button"
                    >
                      {tab.name.toUpperCase()} ({count})
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Match Approval Queue */}
          {canApprove && (
            <section className="space-y-6 mb-10">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-[#FF4500]"></span>
                  <h2 className="text-xl uppercase tracking-wider text-white font-bold">
                    Pending Match Scorecards Queue ({filteredResults.length})
                  </h2>
                </div>
              </div>

              {loadingPending && (
                <div className="p-12 text-center rounded-2xl bg-[#1d1b1e] border border-white/10">
                  <p className="text-zinc-400 font-semibold text-sm">Loading approvals queue…</p>
                </div>
              )}

              {!loadingPending && filteredResults.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-[#1d1b1e] border border-white/10">
                  <p className="text-zinc-400 font-semibold text-sm">
                    No pending scorecards found for the selected category.
                  </p>
                </div>
              ) : (
                filteredResults.map((result) => {
                  const teamACode = teamCodeFromName(
                    result.match.teamA?.institute?.shortName || result.match.teamA?.name,
                  );
                  const teamBCode = teamCodeFromName(
                    result.match.teamB?.institute?.shortName || result.match.teamB?.name,
                  );
                  const details = scoreDetailsPreview(result.scoreDetails);
                  return (
                    <div
                      key={result.id}
                      className="bg-[#1d1b1e] border border-[#FFD700]/40 rounded-xl p-6 relative overflow-hidden shadow-lg transition-all"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-1 bg-[#800020] text-white text-xs font-bold rounded uppercase tracking-wider">
                            {result.match.tournament?.sport?.name || 'SPORT'}
                          </span>
                          <span className="text-xs text-[#FFD700] uppercase tracking-wider font-bold">
                            {result.match.tournament?.name || ''}
                          </span>
                          <span className="text-zinc-400 text-xs font-mono">
                            • Match #{result.match.matchNumber || result.matchId.slice(0, 8)}
                          </span>
                          {result.match.venue?.name && (
                            <span className="text-zinc-400 text-xs">
                              • {result.match.venue.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2.5 py-1 rounded bg-[#2c292c] text-[#FFD700] font-mono font-medium border border-[#FFD700]/30 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700] animate-pulse"></span>
                            Awaiting Sign-off
                          </span>
                          {result.submittedAt && (
                            <span className="text-xs text-zinc-400 font-mono">
                              Submitted: {formatTime(result.submittedAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                        <div className="lg:col-span-7 space-y-3">
                          <div className="flex items-center justify-between bg-[#211f22] p-3 rounded-lg border border-white/5">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-[#800020] flex items-center justify-center font-bold text-white text-xs border border-[#FFD700]/30">
                                {teamACode}
                              </div>
                              <div>
                                <span className="text-base font-bold text-white tracking-wide block">
                                  {result.match.teamA?.name || 'TBD'}
                                </span>
                                {result.winnerTeamId === result.match.teamA?.id && (
                                  <span className="text-[11px] text-emerald-400 font-bold uppercase">
                                    Winner
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-2xl font-black text-white px-3 font-mono">
                              {result.finalScoreA}
                            </div>
                          </div>

                          <div className="flex items-center justify-between bg-[#211f22] p-3 rounded-lg border border-white/5">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-[#2c292c] flex items-center justify-center font-bold text-zinc-300 text-xs border border-white/10">
                                {teamBCode}
                              </div>
                              <div>
                                <span className="text-base font-bold text-white tracking-wide block">
                                  {result.match.teamB?.name || 'TBD'}
                                </span>
                                {result.winnerTeamId === result.match.teamB?.id && (
                                  <span className="text-[11px] text-emerald-400 font-bold uppercase">
                                    Winner
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-2xl font-black text-zinc-400 px-3 font-mono">
                              {result.finalScoreB}
                            </div>
                          </div>

                          <div className="text-xs text-zinc-400 flex flex-wrap gap-4 pt-1 font-mono">
                            <span>
                              Submitted By:{' '}
                              <strong className="text-white">
                                {result.submitter?.name || 'Unknown'}
                              </strong>
                            </span>
                            {result.notes && (
                              <span>
                                Notes: <strong className="text-white">{result.notes}</strong>
                              </span>
                            )}
                            {details && (
                              <span className="truncate max-w-xs">Details: {details}</span>
                            )}
                          </div>
                        </div>

                        <div className="lg:col-span-5 flex flex-col gap-2.5 lg:border-l lg:border-white/10 lg:pl-6">
                          <button
                            onClick={() => handleApprove(result)}
                            disabled={actionKey !== null}
                            className="w-full py-3 bg-[#FF4500] hover:brightness-110 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 border border-[#FF4500]/50"
                            type="button"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            <span>
                              {actionKey === `approve-${result.id}`
                                ? 'APPROVING…'
                                : 'APPROVE & PUBLISH LEADERBOARD'}
                            </span>
                          </button>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReject(result)}
                              disabled={actionKey !== null}
                              className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-zinc-300 hover:text-white font-bold text-xs uppercase tracking-wider rounded-lg border border-white/10 transition-colors"
                              type="button"
                            >
                              {actionKey === `reject-${result.id}`
                                ? 'REJECTING…'
                                : 'Reject (Send Back)'}
                            </button>
                            {canOverride && (
                              <button
                                onClick={() =>
                                  overrideOpenId === result.id
                                    ? setOverrideOpenId(null)
                                    : openOverride(result)
                                }
                                disabled={actionKey !== null}
                                className="flex-1 py-2.5 bg-[#800020]/40 hover:bg-[#800020] disabled:opacity-40 text-[#FFD700] hover:text-white font-bold text-xs uppercase tracking-wider rounded-lg border border-[#800020] text-center transition-colors"
                                type="button"
                              >
                                {overrideOpenId === result.id
                                  ? 'Cancel Override'
                                  : 'Score Override'}
                              </button>
                            )}
                          </div>

                          {overrideOpenId === result.id && (
                            <form
                              onSubmit={(e) => handleOverrideSubmit(e, result)}
                              className="mt-2 p-3 rounded-lg bg-black/30 border border-[#800020]/50 space-y-2"
                            >
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] text-zinc-400 uppercase block mb-1">
                                    {result.match.teamA?.name || 'Team A'} Score
                                  </label>
                                  <input
                                    type="number"
                                    required
                                    value={overrideForm.finalScoreA}
                                    onChange={(e) =>
                                      setOverrideForm((p) => ({
                                        ...p,
                                        finalScoreA: e.target.value,
                                      }))
                                    }
                                    className="w-full px-2 py-1.5 rounded bg-[#0e0e11] border border-white/10 text-sm text-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-zinc-400 uppercase block mb-1">
                                    {result.match.teamB?.name || 'Team B'} Score
                                  </label>
                                  <input
                                    type="number"
                                    required
                                    value={overrideForm.finalScoreB}
                                    onChange={(e) =>
                                      setOverrideForm((p) => ({
                                        ...p,
                                        finalScoreB: e.target.value,
                                      }))
                                    }
                                    className="w-full px-2 py-1.5 rounded bg-[#0e0e11] border border-white/10 text-sm text-white"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] text-zinc-400 uppercase block mb-1">
                                  Winner
                                </label>
                                <select
                                  value={overrideForm.winnerTeamId}
                                  onChange={(e) =>
                                    setOverrideForm((p) => ({ ...p, winnerTeamId: e.target.value }))
                                  }
                                  className="w-full px-2 py-1.5 rounded bg-[#0e0e11] border border-white/10 text-sm text-white"
                                >
                                  <option value="">
                                    Auto-determine from scores (draw if equal)
                                  </option>
                                  {result.match.teamA && (
                                    <option value={result.match.teamA.id}>
                                      {result.match.teamA.name}
                                    </option>
                                  )}
                                  {result.match.teamB && (
                                    <option value={result.match.teamB.id}>
                                      {result.match.teamB.name}
                                    </option>
                                  )}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] text-zinc-400 uppercase block mb-1">
                                  Reason (required)
                                </label>
                                <textarea
                                  required
                                  rows={2}
                                  value={overrideForm.reason}
                                  onChange={(e) =>
                                    setOverrideForm((p) => ({ ...p, reason: e.target.value }))
                                  }
                                  className="w-full px-2 py-1.5 rounded bg-[#0e0e11] border border-white/10 text-sm text-white"
                                  placeholder="Why is this override necessary?"
                                />
                              </div>
                              <button
                                type="submit"
                                disabled={actionKey !== null || !overrideForm.reason.trim()}
                                className="w-full py-2 rounded-lg bg-[#FFD700] text-black text-xs font-black uppercase tracking-wider disabled:opacity-40"
                              >
                                {actionKey === `override-${result.id}`
                                  ? 'Overriding…'
                                  : 'Confirm Override & Republish'}
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          )}

          {!canApprove && (
            <section className="p-8 rounded-2xl bg-[#1d1b1e] border border-white/10 text-center text-zinc-400 text-sm mb-10">
              Your account does not hold the <strong className="text-white">result.approve</strong>{' '}
              permission, so the approvals queue is hidden.{' '}
              {canSubmit
                ? 'You can still submit match results above for a coordinator to review.'
                : ''}
            </section>
          )}
        </main>

        <Footer />
      </div>
    </RequireOrganizer>
  );
}
