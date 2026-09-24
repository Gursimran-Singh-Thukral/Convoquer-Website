'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FixtureResultEditor } from '@/components/FixtureResultEditor';
import { Navbar } from '@/components/Navbar';
import { OrganizerNavRail } from '@/components/OrganizerNavRail';
import { LiveTickerRibbon } from '@/components/LiveTickerRibbon';
import { Footer } from '@/components/Footer';
import { RequireOrganizer } from '@/components/RequireOrganizer';
import { useAuth } from '@/lib/auth-context';
import {
  apiAuthedGet,
  apiPost,
  apiPatch,
  apiDelete,
  ApiError,
  type Sport,
  type Venue,
  type Team,
  type Tournament,
  type Match,
  type MatchOfficial,
  type UserSummary,
} from '@/lib/api';

const MATCH_STATUSES = [
  'SCHEDULED',
  'LIVE',
  'PAUSED',
  'COMPLETED',
  'ABANDONED',
  'CANCELLED',
  'RESCHEDULED',
];
const OFFICIAL_ROLES = ['SCOREKEEPER', 'REFEREE', 'UMPIRE', 'JUDGE'];

function statusBadgeClasses(status: string): string {
  const s = status.toUpperCase();
  if (s === 'LIVE') return 'bg-[#FF4500]/20 text-[#FF4500] border-[#FF4500]/40';
  if (s === 'SCHEDULED' || s === 'RESCHEDULED')
    return 'bg-[#FFD700]/10 text-[#FFD700] border-[#FFD700]/30';
  if (s === 'COMPLETED') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (s === 'CANCELLED' || s === 'ABANDONED')
    return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
  return 'bg-white/10 text-zinc-300 border-white/10';
}

function formatTeamName(team?: Team): string {
  if (!team) return 'TBD';
  return team.name;
}

function toIso(datetimeLocal: string): string {
  return new Date(datetimeLocal).toISOString();
}

// ===================================================================
// CREATE MATCH MODAL
// ===================================================================

function CreateMatchModal({
  tournaments,
  venues,
  teams,
  onClose,
  onCreated,
}: {
  tournaments: Tournament[];
  venues: Venue[];
  teams: Team[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [tournamentId, setTournamentId] = useState(tournaments[0]?.id || '');
  const [scoringMode, setScoringMode] = useState<'' | 'LIVE' | 'RESULT_ONLY'>('');
  const [stageId, setStageId] = useState('');
  const [venueId, setVenueId] = useState('');
  const [matchNumber, setMatchNumber] = useState('');
  const [teamAId, setTeamAId] = useState('');
  const [teamBId, setTeamBId] = useState('');
  const [scheduledStartTime, setScheduledStartTime] = useState('');
  const [scheduledEndTime, setScheduledEndTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTournament = tournaments.find((t) => t.id === tournamentId);
  const stages = selectedTournament?.stages || [];
  const eligibleTeams = selectedTournament
    ? teams.filter((t) => t.sportId === selectedTournament.sportId)
    : teams;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournamentId || !scheduledStartTime) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await apiPost('/matches', {
        tournamentId,
        scoringMode: scoringMode || undefined,
        stageId: stageId || undefined,
        venueId: venueId || undefined,
        matchNumber: matchNumber.trim() || undefined,
        teamAId: teamAId || undefined,
        teamBId: teamBId || undefined,
        scheduledStartTime: toIso(scheduledStartTime),
        scheduledEndTime: scheduledEndTime ? toIso(scheduledEndTime) : undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create match');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#18161b] border border-white/20 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <h3 className="text-lg font-black text-white uppercase">Schedule New Match Fixture</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white" type="button">
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
          <label className="block">
            Scoring mode
            <select
              aria-label="Scoring mode"
              value={scoringMode}
              onChange={(e) => setScoringMode(e.target.value as '' | 'LIVE' | 'RESULT_ONLY')}
              className="block w-full bg-zinc-900 p-2"
            >
              <option value="">Use sport setting</option>
              <option value="LIVE">Live scoring</option>
              <option value="RESULT_ONLY">Results only</option>
            </select>
          </label>
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label className="font-bold uppercase text-zinc-400 block mb-1">Tournament</label>
            <select
              required
              value={tournamentId}
              onChange={(e) => {
                setTournamentId(e.target.value);
                setStageId('');
                setTeamAId('');
                setTeamBId('');
              }}
              className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white"
            >
              <option value="">Select tournament…</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.sport?.name})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold uppercase text-zinc-400 block mb-1">
                Stage (optional)
              </label>
              <select
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white"
              >
                <option value="">No stage</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-bold uppercase text-zinc-400 block mb-1">Match Number</label>
              <input
                type="text"
                value={matchNumber}
                onChange={(e) => setMatchNumber(e.target.value)}
                placeholder="e.g. FB-M01"
                className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold uppercase text-zinc-400 block mb-1">Team A</label>
              <select
                value={teamAId}
                onChange={(e) => setTeamAId(e.target.value)}
                className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white"
              >
                <option value="">TBD</option>
                {eligibleTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-bold uppercase text-zinc-400 block mb-1">Team B</label>
              <select
                value={teamBId}
                onChange={(e) => setTeamBId(e.target.value)}
                className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white"
              >
                <option value="">TBD</option>
                {eligibleTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold uppercase text-zinc-400 block mb-1">Venue</label>
            <select
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white"
            >
              <option value="">No venue assigned</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold uppercase text-zinc-400 block mb-1">Start Time</label>
              <input
                type="datetime-local"
                required
                value={scheduledStartTime}
                onChange={(e) => setScheduledStartTime(e.target.value)}
                className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="font-bold uppercase text-zinc-400 block mb-1">
                End Time (optional)
              </label>
              <input
                type="datetime-local"
                value={scheduledEndTime}
                onChange={(e) => setScheduledEndTime(e.target.value)}
                className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
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
              {isSubmitting ? 'Scheduling…' : 'Confirm Fixture'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===================================================================
// MANAGE MATCH MODAL (edit / reschedule / officials)
// ===================================================================

function ManageMatchModal({
  match,
  venues,
  teams,
  canViewUsers,
  onClose,
  onChanged,
}: {
  match: Match;
  venues: Venue[];
  teams: Team[];
  canViewUsers: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<'edit' | 'reschedule' | 'officials' | 'result'>('result');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#18161b] border border-white/20 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h3 className="text-lg font-black text-white uppercase">
              {match.matchNumber || 'Match'} — {match.tournament?.name}
            </h3>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">
              {formatTeamName(match.teamA)} vs {formatTeamName(match.teamB)}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white" type="button">
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

        <div className="flex items-center gap-1">
          {(['result', 'edit', 'reschedule', 'officials'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                tab === t
                  ? 'bg-[#800020] text-white border border-[#FFD700]/40'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'result' && <FixtureResultEditor match={match} onSaved={onChanged} />}
        {tab === 'edit' && (
          <EditMatchTab match={match} venues={venues} teams={teams} onSaved={onChanged} />
        )}
        {tab === 'reschedule' && (
          <RescheduleTab match={match} venues={venues} onSaved={onChanged} />
        )}
        {tab === 'officials' && (
          <OfficialsTab match={match} canViewUsers={canViewUsers} onSaved={onChanged} />
        )}
      </div>
    </div>
  );
}

function EditMatchTab({
  match,
  venues,
  teams,
  onSaved,
}: {
  match: Match;
  venues: Venue[];
  teams: Team[];
  onSaved: () => void;
}) {
  const [venueId, setVenueId] = useState(match.venue?.id || '');
  const [matchNumber, setMatchNumber] = useState(match.matchNumber || '');
  const [teamAId, setTeamAId] = useState(match.teamAId || match.teamA?.id || '');
  const [teamBId, setTeamBId] = useState(match.teamBId || match.teamB?.id || '');
  const [status, setStatus] = useState(match.status);
  const [isTelecast, setIsTelecast] = useState(match.isTelecast ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const locked = !['SCHEDULED', 'READY', 'RESCHEDULED'].includes(match.status);
  const eligibleTeams = match.tournament?.sport
    ? teams.filter((t) => t.sportId === match.tournament?.sport?.id || !t.sportId)
    : teams;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const changes: Record<string, unknown> = {};
      if (venueId && venueId !== (match.venue?.id || '')) changes.venueId = venueId;
      if (matchNumber.trim() !== (match.matchNumber || ''))
        changes.matchNumber = matchNumber.trim();
      if (teamAId && teamAId !== (match.teamAId || match.teamA?.id || ''))
        changes.teamAId = teamAId;
      if (teamBId && teamBId !== (match.teamBId || match.teamB?.id || ''))
        changes.teamBId = teamBId;
      if (status !== match.status) changes.status = status;
      if (isTelecast !== (match.isTelecast ?? false)) changes.isTelecast = isTelecast;
      if (!Object.keys(changes).length) {
        setSuccess('No changes to save.');
        return;
      }
      await apiPatch(`/matches/${match.id}`, changes);
      setSuccess('Match updated.');
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update match');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-xs">
      {error && (
        <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300">
          {error}
        </div>
      )}
      {success && (
        <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
          {success}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-bold uppercase text-zinc-400 block mb-1">Team A</label>
          <select
            disabled={locked || !!match.nextMatchId}
            value={teamAId}
            onChange={(e) => setTeamAId(e.target.value)}
            className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white"
          >
            <option value="">TBD</option>
            {eligibleTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-bold uppercase text-zinc-400 block mb-1">Team B</label>
          <select
            disabled={locked || !!match.nextMatchId}
            value={teamBId}
            onChange={(e) => setTeamBId(e.target.value)}
            className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white"
          >
            <option value="">TBD</option>
            {eligibleTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="font-bold uppercase text-zinc-400 block mb-1">Venue</label>
        <select
          disabled={locked}
          value={venueId}
          onChange={(e) => setVenueId(e.target.value)}
          className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white"
        >
          <option value="" disabled={Boolean(match.venue?.id)}>
            No venue assigned
          </option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-bold uppercase text-zinc-400 block mb-1">Match Number</label>
          <input
            type="text"
            disabled={locked}
            value={matchNumber}
            onChange={(e) => setMatchNumber(e.target.value)}
            className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white"
          />
        </div>
        <div>
          <label className="font-bold uppercase text-zinc-400 block mb-1">Status</label>
          <select
            disabled={locked}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white"
          >
            {Array.from(new Set([match.status, 'SCHEDULED', 'READY', 'CANCELLED'])).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-zinc-400">Set the winner and final scores in the result tab.</p>
      <label className="flex items-center gap-2 p-2.5 rounded-lg bg-[#121014] border border-white/15 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isTelecast}
          onChange={(e) => setIsTelecast(e.target.checked)}
          className="accent-[#FF4500]"
        />
        <span className="font-bold uppercase text-zinc-300">Show on public Live Arena feed</span>
      </label>
      <p className="text-zinc-500 text-[11px]">
        Live score entry is handled by the Scorer Console — this form manages scheduling and
        administrative fields only.
      </p>
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2 rounded-lg bg-[#FFD700] text-black font-bold uppercase tracking-wider shadow-md disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

function RescheduleTab({
  match,
  venues,
  onSaved,
}: {
  match: Match;
  venues: Venue[];
  onSaved: () => void;
}) {
  const [scheduledStartTime, setScheduledStartTime] = useState('');
  const [scheduledEndTime, setScheduledEndTime] = useState('');
  const [venueId, setVenueId] = useState(match.venue?.id || '');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledStartTime) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiPatch(`/matches/${match.id}/reschedule`, {
        scheduledStartTime: toIso(scheduledStartTime),
        scheduledEndTime: scheduledEndTime ? toIso(scheduledEndTime) : undefined,
        venueId: venueId || undefined,
        reason: reason.trim() || undefined,
      });
      setSuccess('Match rescheduled.');
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reschedule match');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-xs">
      {error && (
        <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300">
          {error}
        </div>
      )}
      {success && (
        <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
          {success}
        </div>
      )}
      <p className="text-zinc-500 text-[11px]">
        Current: {new Date(match.scheduledStartTime).toLocaleString()} @{' '}
        {match.venue?.name || 'No venue'}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-bold uppercase text-zinc-400 block mb-1">New Start Time</label>
          <input
            type="datetime-local"
            required
            value={scheduledStartTime}
            onChange={(e) => setScheduledStartTime(e.target.value)}
            className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white"
          />
        </div>
        <div>
          <label className="font-bold uppercase text-zinc-400 block mb-1">
            New End Time (optional)
          </label>
          <input
            type="datetime-local"
            value={scheduledEndTime}
            onChange={(e) => setScheduledEndTime(e.target.value)}
            className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white"
          />
        </div>
      </div>
      <div>
        <label className="font-bold uppercase text-zinc-400 block mb-1">Venue</label>
        <select
          value={venueId}
          onChange={(e) => setVenueId(e.target.value)}
          className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white"
        >
          <option value="">Keep current venue</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="font-bold uppercase text-zinc-400 block mb-1">Reason (optional)</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Waterlogged pitch"
          className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white"
        />
      </div>
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2 rounded-lg bg-[#800020] hover:bg-[#9a0026] text-white font-bold uppercase tracking-wider shadow-md border border-[#FFD700]/30 disabled:opacity-50"
        >
          {isSubmitting ? 'Rescheduling…' : 'Confirm Reschedule'}
        </button>
      </div>
    </form>
  );
}

function OfficialsTab({
  match,
  canViewUsers,
  onSaved,
}: {
  match: Match;
  canViewUsers: boolean;
  onSaved: () => void;
}) {
  const [officials, setOfficials] = useState<MatchOfficial[]>(match.officials || []);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [role, setRole] = useState('SCOREKEEPER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setOfficials(match.officials || []);
    });
    return () => {
      cancelled = true;
    };
  }, [match.officials]);

  useEffect(() => {
    if (!canViewUsers || !query.trim()) {
      const handle = setTimeout(() => setResults([]), 0);
      return () => clearTimeout(handle);
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiAuthedGet<UserSummary[]>(
          `/users?q=${encodeURIComponent(query.trim())}`,
        );
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, canViewUsers]);

  const handleAssign = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await apiPost(`/matches/${match.id}/officials`, { userId: selectedUser.id, role });
      setSelectedUser(null);
      setQuery('');
      setResults([]);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to assign official');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    setRemovingId(userId);
    setError(null);
    try {
      await apiDelete(`/matches/${match.id}/officials/${userId}`);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove official');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-3 text-xs">
      {error && (
        <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300">
          {error}
        </div>
      )}

      <div>
        <h4 className="font-bold uppercase text-zinc-400 mb-2">Assigned Officials</h4>
        {officials.length === 0 ? (
          <p className="text-zinc-500 py-2">No officials assigned yet.</p>
        ) : (
          <div className="space-y-2">
            {officials.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between bg-[#121014] border border-white/10 rounded-lg p-2.5"
              >
                <div>
                  <span className="text-white font-bold">{o.user?.name || o.userId}</span>
                  <span className="text-zinc-500 ml-2 font-mono">{o.role}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(o.userId || o.user?.id || '')}
                  disabled={removingId === (o.userId || o.user?.id)}
                  className="text-rose-400 hover:text-rose-300 font-bold disabled:opacity-50"
                >
                  {removingId === (o.userId || o.user?.id) ? 'Removing…' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 pt-4">
        <h4 className="font-bold uppercase text-zinc-400 mb-2">Assign Official</h4>
        {!canViewUsers ? (
          <p className="text-zinc-500 py-2">
            Your account does not have permission to search the user directory ({"'user.view'"}{' '}
            required).
          </p>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedUser(null);
              }}
              placeholder="Search organizer by name or email..."
              className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white"
            />
            {searching && <p className="text-zinc-500">Searching…</p>}
            {!searching && results.length > 0 && !selectedUser && (
              <div className="max-h-32 overflow-y-auto border border-white/10 rounded-lg divide-y divide-white/5">
                {results.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setSelectedUser(u);
                      setResults([]);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-white/5 text-zinc-200"
                  >
                    {u.name} <span className="text-zinc-500">({u.email})</span>
                  </button>
                ))}
              </div>
            )}
            {selectedUser && (
              <div className="grid grid-cols-[1fr_140px_auto] gap-2 items-center">
                <span className="text-zinc-200 font-bold">{selectedUser.name}</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="bg-[#121014] border border-white/15 p-2 rounded-lg text-white"
                >
                  {OFFICIAL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAssign}
                  disabled={isSubmitting}
                  className="px-3 py-2 rounded-lg bg-[#FFD700] text-black font-bold uppercase disabled:opacity-50"
                >
                  {isSubmitting ? 'Assigning…' : 'Assign'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ===================================================================
// MAIN PAGE
// ===================================================================

function MatchManagerContent() {
  const { hasPermission, myScopedSportId } = useAuth();
  const canManage = hasPermission('competition.manage');
  const canViewUsers = hasPermission('user.view');

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sports, setSports] = useState<Sport[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  const [filterSportId, setFilterSportId] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterTournamentId, setFilterTournamentId] = useState<string>('ALL');
  const [filterVenueId, setFilterVenueId] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState<string>('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [manageMatch, setManageMatch] = useState<Match | null>(null);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterSportId !== 'ALL') params.set('sportId', filterSportId);
      if (filterStatus !== 'ALL') params.set('status', filterStatus);
      if (filterTournamentId !== 'ALL') params.set('tournamentId', filterTournamentId);
      if (filterVenueId !== 'ALL') params.set('venueId', filterVenueId);
      if (filterDate) params.set('date', filterDate);
      const qs = params.toString();
      const data = await apiAuthedGet<Match[]>(`/matches${qs ? `?${qs}` : ''}`);
      setMatches(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  }, [filterSportId, filterStatus, filterTournamentId, filterVenueId, filterDate]);

  // A Sports Coordinator scoped to a single sport defaults to seeing just that
  // sport's matches instead of every sport's.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      const scoped = myScopedSportId('competition.manage', 'match.update');
      if (scoped) setFilterSportId(scoped);
    });
    return () => {
      cancelled = true;
    };
  }, [myScopedSportId]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) loadMatches();
    });
    return () => {
      cancelled = true;
    };
  }, [loadMatches]);

  // Keep the open "manage" modal's match data in sync with the list after a refetch
  // (e.g. after assigning/removing an official) instead of showing stale data.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setManageMatch((prev) => {
        if (!prev) return prev;
        const fresh = matches.find((m) => m.id === prev.id);
        return fresh || prev;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [matches]);

  useEffect(() => {
    apiAuthedGet<Sport[]>('/sports')
      .then(setSports)
      .catch(() => setSports([]));
    apiAuthedGet<Venue[]>('/venues')
      .then(setVenues)
      .catch(() => setVenues([]));
    apiAuthedGet<Tournament[]>('/tournaments')
      .then(setTournaments)
      .catch(() => setTournaments([]));
    apiAuthedGet<Team[]>('/teams')
      .then(setTeams)
      .catch(() => setTeams([]));
  }, []);

  const kpis = {
    total: matches.length,
    live: matches.filter((m) => m.status === 'LIVE').length,
    completed: matches.filter((m) => m.status === 'COMPLETED').length,
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#121114] text-[#E8E6EB] selection:bg-[#FF4500] selection:text-white font-sans">
      <LiveTickerRibbon />
      <Navbar />
      <OrganizerNavRail />

      {/* Tri-color Accent Line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-[#800020] via-[#FF4500] to-[#FFD700]"></div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header & Action Bar */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#FFD700] uppercase tracking-widest mb-1">
              <span>CONVOQUER&apos;26 OPERATIONS</span>
              <span>•</span>
              <span>FIELD DESK</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white">
              MATCH MANAGER &amp; <span className="text-[#FFD700]">FIXTURES DESK</span>
            </h1>
            <p className="text-zinc-400 text-sm mt-1 max-w-2xl leading-relaxed">
              Official match scheduling, pitch-level venue allocations, licensed referee rosters,
              and high-speed bracket progression controls for Convoquer&apos;26.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/organizer"
              className="px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold uppercase text-zinc-300 transition-colors"
            >
              Organizer Overview
            </Link>
            {canManage && (
              <button
                onClick={() => setIsCreateOpen(true)}
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
                <span>SCHEDULE NEW MATCH</span>
              </button>
            )}
          </div>
        </section>

        {/* 3 Brutalist KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-8">
          <div className="bg-[#1d1b1e] p-5 rounded-xl border-l-4 border-[#FFD700] border border-white/5 shadow-md flex items-center justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold block mb-1">
                TOTAL FIXTURES
              </span>
              <div className="text-3xl font-black text-white font-mono">
                {loading ? '—' : kpis.total}
              </div>
              <p className="text-xs text-zinc-400 mt-1">Matching current filters</p>
            </div>
          </div>

          <div className="bg-[#1d1b1e] p-5 rounded-xl border-l-4 border-[#FF4500] border border-white/5 shadow-md flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-[#FF4500] animate-pulse"></span>
                <span className="text-xs uppercase tracking-wider text-[#FF4500] font-bold">
                  ACTIVE / IN-PLAY
                </span>
              </div>
              <div className="text-3xl font-black text-[#FF4500] font-mono">
                {loading ? '—' : kpis.live}
              </div>
              <p className="text-xs text-zinc-400 mt-1">Live scoring active across pitches</p>
            </div>
          </div>

          <div className="bg-[#1d1b1e] p-5 rounded-xl border-l-4 border-emerald-500 border border-white/5 shadow-md flex items-center justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider text-zinc-400 font-bold block mb-1">
                COMPLETED
              </span>
              <div className="text-3xl font-black text-emerald-400 font-mono">
                {loading ? '—' : kpis.completed}
              </div>
              <p className="text-xs text-zinc-400 mt-1">Finalized and score-audited</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setFilterSportId('ALL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                filterSportId === 'ALL'
                  ? 'bg-[#800020] text-white border border-[#FFD700]/40'
                  : 'bg-[#1d1b1e] text-zinc-400 hover:text-white'
              }`}
            >
              ALL SPORTS
            </button>
            {sports.map((sp) => (
              <button
                key={sp.id}
                onClick={() => setFilterSportId(sp.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                  filterSportId === sp.id
                    ? 'bg-[#800020] text-white border border-[#FFD700]/40'
                    : 'bg-[#1d1b1e] text-zinc-400 hover:text-white'
                }`}
              >
                {sp.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {['ALL', ...MATCH_STATUSES].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${
                  filterStatus === st
                    ? 'bg-white/20 text-white font-bold'
                    : 'bg-white/5 text-zinc-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select
            value={filterTournamentId}
            onChange={(e) => setFilterTournamentId(e.target.value)}
            className="bg-[#1d1b1e] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-[#FFD700]"
          >
            <option value="ALL">All Tournaments</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={filterVenueId}
            onChange={(e) => setFilterVenueId(e.target.value)}
            className="bg-[#1d1b1e] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-[#FFD700]"
          >
            <option value="ALL">All Venues</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="bg-[#1d1b1e] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-[#FFD700]"
          />
          {(filterTournamentId !== 'ALL' || filterVenueId !== 'ALL' || filterDate) && (
            <button
              onClick={() => {
                setFilterTournamentId('ALL');
                setFilterVenueId('ALL');
                setFilterDate('');
              }}
              className="text-xs text-zinc-400 hover:text-white underline"
              type="button"
            >
              Clear extra filters
            </button>
          )}
        </div>

        {/* Fixtures Table */}
        {loading && (
          <div className="text-center py-16 text-zinc-500 text-sm font-mono">Loading fixtures…</div>
        )}
        {!loading && error && (
          <div className="text-center py-16 border border-rose-500/20 rounded-xl bg-rose-950/20">
            <p className="text-rose-300 text-sm mb-3">{error}</p>
            <button
              onClick={loadMatches}
              className="px-4 py-2 rounded-lg bg-white/10 text-white text-xs font-bold uppercase hover:bg-white/20"
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !error && matches.length === 0 && (
          <div className="text-center py-16 text-zinc-500 text-sm font-mono border border-white/10 rounded-xl">
            No fixtures match the current filters.
          </div>
        )}
        {!loading && !error && matches.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#1d1b1e] shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#262328] text-zinc-400 font-mono uppercase tracking-wider border-b border-white/10">
                <tr>
                  <th className="py-3 px-4">MATCH #</th>
                  <th className="py-3 px-4">SPORT &amp; STAGE</th>
                  <th className="py-3 px-4">TEAMS / SCORE</th>
                  <th className="py-3 px-4">VENUE</th>
                  <th className="py-3 px-4">OFFICIALS</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {matches.map((fix) => (
                  <tr key={fix.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#FFD700] whitespace-nowrap">
                      {fix.matchNumber || fix.id.slice(0, 8)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold text-white block">
                        {fix.tournament?.sport?.name || '—'}
                      </span>
                      <span className="text-zinc-400 text-[11px]">
                        {fix.stage?.name || fix.tournament?.name}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 font-bold text-white">
                        <span>{formatTeamName(fix.teamA)}</span>
                        {fix.teamAScore !== null && fix.teamAScore !== undefined && (
                          <span className="font-mono text-[#FFD700]">({fix.teamAScore})</span>
                        )}
                        <span className="text-zinc-500 font-normal">vs</span>
                        <span>{formatTeamName(fix.teamB)}</span>
                        {fix.teamBScore !== null && fix.teamBScore !== undefined && (
                          <span className="font-mono text-[#FFD700]">({fix.teamBScore})</span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-400 font-mono block mt-0.5">
                        {new Date(fix.scheduledStartTime).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-300 whitespace-nowrap">
                      {fix.venue?.name || 'TBD'}
                    </td>
                    <td className="py-3 px-4 text-zinc-400 whitespace-nowrap">
                      {fix.officials && fix.officials.length > 0
                        ? fix.officials
                            .map((o) => o.user?.name)
                            .filter(Boolean)
                            .join(', ')
                        : '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${statusBadgeClasses(fix.status)}`}
                      >
                        {fix.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {fix.scoringMode !== 'RESULT_ONLY' && (
                          <Link
                            href={`/scorer?matchId=${fix.id}`}
                            className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] uppercase tracking-wider transition-colors inline-block"
                          >
                            Scorer
                          </Link>
                        )}
                        <span className="text-xs text-zinc-400">
                          {fix.scoringMode === 'RESULT_ONLY' ? 'Results only' : 'Live scoring'}
                        </span>
                        {hasPermission('result.submit') && (
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded bg-[#800020] text-white"
                            onClick={() => setManageMatch(fix)}
                          >
                            Enter result
                          </button>
                        )}
                        {canManage && (
                          <button
                            onClick={() => setManageMatch(fix)}
                            type="button"
                            className="px-3 py-1.5 rounded bg-[#800020] hover:bg-[#9a0026] text-white font-bold text-[11px] uppercase tracking-wider transition-colors border border-[#FFD700]/30"
                          >
                            Manage
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {isCreateOpen && (
        <CreateMatchModal
          tournaments={tournaments}
          venues={venues}
          teams={teams}
          onClose={() => setIsCreateOpen(false)}
          onCreated={loadMatches}
        />
      )}

      {manageMatch && (
        <ManageMatchModal
          match={manageMatch}
          venues={venues}
          teams={teams}
          canViewUsers={canViewUsers}
          onClose={() => setManageMatch(null)}
          onChanged={loadMatches}
        />
      )}

      <Footer />
    </div>
  );
}

export default function MatchManagerPage() {
  return (
    <RequireOrganizer anyPermission={['tournament.view', 'competition.manage']}>
      <MatchManagerContent />
    </RequireOrganizer>
  );
}
