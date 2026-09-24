'use client';

import React, { useCallback, useEffect, useState } from 'react';
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
  apiPost,
  apiPatch,
  apiDelete,
  ApiError,
  type Sport,
  type Venue,
  type Team,
  type Tournament,
  type TournamentStage,
  type TournamentSeed,
  type EventSummary,
  type Institute,
} from '@/lib/api';

const TOURNAMENT_FORMATS = ['KNOCKOUT', 'ROUND_ROBIN', 'LEAGUE', 'GROUP_KNOCKOUT', 'SWISS'];
const TOURNAMENT_STATUSES = ['UPCOMING', 'ONGOING', 'COMPLETED', 'ARCHIVED'];
const STAGE_TYPES = ['KNOCKOUT', 'ROUND_ROBIN', 'SWISS'];
const STAGE_STATUSES = ['PENDING', 'ONGOING', 'COMPLETED'];

/** The generation flow is determined entirely by the format chosen at tournament creation (Overview tab) — never re-chosen here. */
function formatToGenerateMode(format?: string): 'knockout' | 'round-robin' | 'swiss' {
  const f = (format || '').toUpperCase();
  if (f === 'SWISS') return 'swiss';
  if (f === 'ROUND_ROBIN' || f === 'LEAGUE') return 'round-robin';
  return 'knockout'; // KNOCKOUT, GROUP_KNOCKOUT
}

function statusBadgeClasses(status?: string): string {
  const s = (status || '').toUpperCase();
  if (s === 'ONGOING') return 'bg-[#FF4500]/20 text-[#FF4500] border-[#FF4500]/40';
  if (s === 'COMPLETED') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  return 'bg-[#FFD700]/10 text-[#FFD700] border-[#FFD700]/30';
}

// ===================================================================
// MANAGE TOURNAMENT MODAL (seeding, stages, generation, update)
// ===================================================================

interface ManageModalProps {
  tournament: Tournament;
  venues: Venue[];
  onClose: () => void;
  onChanged: () => void;
}

function ManageTournamentModal({ tournament, venues, onClose, onChanged }: ManageModalProps) {
  const [tab, setTab] = useState<'overview' | 'seeding' | 'stages' | 'generate'>('overview');
  const [detail, setDetail] = useState<Tournament>(tournament);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadDetail = useCallback(async () => {
    setRefreshing(true);
    try {
      const d = await apiAuthedGet<Tournament>(`/tournaments/${tournament.id}`);
      setDetail(d);
    } catch {
      // keep existing detail on refresh failure
    } finally {
      setRefreshing(false);
    }
  }, [tournament.id]);

  const loadTeams = useCallback(async () => {
    if (!detail.sportId) {
      setTeams([]);
      setTeamsLoading(false);
      return;
    }
    setTeamsLoading(true);
    setTeamsError(null);
    try {
      const params = new URLSearchParams();
      params.set('sportId', detail.sportId);
      if (detail.eventId) params.set('eventId', detail.eventId);
      const data = await apiAuthedGet<Team[]>(`/teams?${params.toString()}`);
      setTeams(data);
    } catch (err) {
      setTeamsError(err instanceof ApiError ? err.message : 'Failed to load teams');
    } finally {
      setTeamsLoading(false);
    }
  }, [detail.sportId, detail.eventId]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) loadDetail();
    });
    return () => {
      cancelled = true;
    };
  }, [loadDetail]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) loadTeams();
    });
    return () => {
      cancelled = true;
    };
  }, [loadTeams]);

  const refreshAll = async () => {
    await loadDetail();
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#141418] border border-white/20 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h3 className="text-lg font-black text-white uppercase">{detail.name}</h3>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">
              {detail.sport?.name || 'Sport'} • {detail.format} • {detail.status}
              {refreshing && ' • syncing…'}
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

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {(['overview', 'seeding', 'stages', 'generate'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              type="button"
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                tab === t
                  ? 'bg-[#FF4500] text-white'
                  : 'bg-[#181820] text-zinc-400 hover:text-white hover:bg-[#22222d]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'overview' && <OverviewTab detail={detail} onSaved={refreshAll} />}
        {tab === 'seeding' && (
          <SeedingTab
            detail={detail}
            teams={teams}
            teamsLoading={teamsLoading}
            teamsError={teamsError}
            onSaved={refreshAll}
          />
        )}
        {tab === 'stages' && <StagesTab detail={detail} onSaved={refreshAll} />}
        {tab === 'generate' && (
          <GenerateTab
            detail={detail}
            teams={teams}
            teamsLoading={teamsLoading}
            teamsError={teamsError}
            venues={venues}
            onGenerated={refreshAll}
            onTeamsChanged={loadTeams}
          />
        )}
      </div>
    </div>
  );
}

function OverviewTab({ detail, onSaved }: { detail: Tournament; onSaved: () => void }) {
  const [name, setName] = useState(detail.name);
  const [format, setFormat] = useState(detail.format);
  const [status, setStatus] = useState(detail.status || 'UPCOMING');
  const [pointsForWin, setPointsForWin] = useState(detail.pointsForWin ?? 3);
  const [pointsForDraw, setPointsForDraw] = useState(detail.pointsForDraw ?? 1);
  const [pointsForLoss, setPointsForLoss] = useState(detail.pointsForLoss ?? 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiPatch(`/tournaments/${detail.id}`, {
        name: name.trim(),
        format,
        status,
        pointsForWin: Number(pointsForWin),
        pointsForDraw: Number(pointsForDraw),
        pointsForLoss: Number(pointsForLoss),
      });
      setSuccess('Tournament updated.');
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update tournament');
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
      <div>
        <label className="font-bold uppercase text-zinc-400 block mb-1">Name</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-[#0a0a0c] border border-white/15 p-2.5 rounded-lg text-white"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-bold uppercase text-zinc-400 block mb-1">Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="w-full bg-[#0a0a0c] border border-white/15 p-2.5 rounded-lg text-white"
          >
            {TOURNAMENT_FORMATS.map((f) => (
              <option key={f} value={f}>
                {f.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-bold uppercase text-zinc-400 block mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full bg-[#0a0a0c] border border-white/15 p-2.5 rounded-lg text-white"
          >
            {TOURNAMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div>
          <label className="font-bold uppercase text-zinc-400 block mb-1">Points: Win</label>
          <input
            type="number"
            value={pointsForWin}
            onChange={(e) => setPointsForWin(Number(e.target.value))}
            className="w-full bg-[#0a0a0c] border border-white/15 p-2.5 rounded-lg text-white"
          />
        </div>
        <div>
          <label className="font-bold uppercase text-zinc-400 block mb-1">Points: Draw</label>
          <input
            type="number"
            value={pointsForDraw}
            onChange={(e) => setPointsForDraw(Number(e.target.value))}
            className="w-full bg-[#0a0a0c] border border-white/15 p-2.5 rounded-lg text-white"
          />
        </div>
        <div>
          <label className="font-bold uppercase text-zinc-400 block mb-1">Points: Loss</label>
          <input
            type="number"
            value={pointsForLoss}
            onChange={(e) => setPointsForLoss(Number(e.target.value))}
            className="w-full bg-[#0a0a0c] border border-white/15 p-2.5 rounded-lg text-white"
          />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2 rounded-lg bg-[#FF4500] hover:brightness-110 text-white font-bold uppercase tracking-wider shadow-md disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

function SeedingTab({
  detail,
  teams,
  teamsLoading,
  teamsError,
  onSaved,
}: {
  detail: Tournament;
  teams: Team[];
  teamsLoading: boolean;
  teamsError: string | null;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<TournamentSeed[]>(
    detail.seeds && detail.seeds.length > 0
      ? detail.seeds.map((s) => ({
          teamId: s.teamId,
          seedNumber: s.seedNumber,
          notes: s.notes || '',
        }))
      : [{ teamId: '', seedNumber: 1, notes: '' }],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const updateRow = (idx: number, patch: Partial<TournamentSeed>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    const nextSeed = rows.length > 0 ? Math.max(...rows.map((r) => r.seedNumber || 0)) + 1 : 1;
    setRows((prev) => [...prev, { teamId: '', seedNumber: nextSeed, notes: '' }]);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = rows.filter((r) => r.teamId && r.seedNumber);
    if (validRows.length === 0) {
      setError('Add at least one team with a seed number.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiPost(`/tournaments/${detail.id}/seeds`, {
        seeds: validRows.map((r) => ({
          teamId: r.teamId,
          seedNumber: Number(r.seedNumber),
          notes: r.notes || undefined,
        })),
      });
      setSuccess('Seeds saved successfully.');
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save seeds');
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
      {teamsError && (
        <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300">
          {teamsError}
        </div>
      )}
      {teamsLoading ? (
        <div className="text-zinc-500 py-4 text-center">Loading eligible teams…</div>
      ) : teams.length === 0 ? (
        <div className="text-zinc-500 py-4 text-center">
          No teams registered for this sport yet.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_80px_1fr_32px] gap-2 items-center">
              <select
                value={row.teamId}
                onChange={(e) => updateRow(idx, { teamId: e.target.value })}
                className="bg-[#0a0a0c] border border-white/15 p-2 rounded-lg text-white"
              >
                <option value="">Select team…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.institute?.shortName ? ` (${t.institute.shortName})` : ''}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={row.seedNumber}
                onChange={(e) => updateRow(idx, { seedNumber: Number(e.target.value) })}
                className="bg-[#0a0a0c] border border-white/15 p-2 rounded-lg text-white"
                placeholder="Seed #"
              />
              <input
                type="text"
                value={row.notes || ''}
                onChange={(e) => updateRow(idx, { notes: e.target.value })}
                className="bg-[#0a0a0c] border border-white/15 p-2 rounded-lg text-white"
                placeholder="Notes (optional)"
              />
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="text-rose-400 hover:text-rose-300 text-lg leading-none"
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            className="text-[#FFD700] hover:text-white text-xs font-bold uppercase tracking-wider"
          >
            + Add seed row
          </button>
        </div>
      )}
      <p className="text-zinc-500 text-[11px]">
        Saving replaces the tournament&apos;s entire seed list. Seeds 1 &amp; 2 are guaranteed to be
        placed on opposite bracket halves when generating a knockout bracket.
      </p>
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSubmitting || teamsLoading || teams.length === 0}
          className="px-5 py-2 rounded-lg bg-[#FF4500] hover:brightness-110 text-white font-bold uppercase tracking-wider shadow-md disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : 'Save Seeds'}
        </button>
      </div>
    </form>
  );
}

function StagesTab({ detail, onSaved }: { detail: Tournament; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [sequence, setSequence] = useState((detail.stages?.length || 0) + 1);
  const [stageType, setStageType] = useState('KNOCKOUT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  const handleCreateStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await apiPost(`/tournaments/${detail.id}/stages`, {
        name: name.trim(),
        sequence: Number(sequence),
        stageType,
      });
      setName('');
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create stage');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStageStatusChange = async (stage: TournamentStage, newStatus: string) => {
    setStatusUpdating(stage.id);
    setError(null);
    try {
      await apiPatch(`/stages/${stage.id}`, { status: newStatus });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update stage');
    } finally {
      setStatusUpdating(null);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {error && (
        <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300">
          {error}
        </div>
      )}

      <div>
        <h4 className="font-bold uppercase text-zinc-400 mb-2">Existing Stages</h4>
        {!detail.stages || detail.stages.length === 0 ? (
          <p className="text-zinc-500 py-2">No stages created yet.</p>
        ) : (
          <div className="space-y-2">
            {detail.stages
              .slice()
              .sort((a, b) => a.sequence - b.sequence)
              .map((stage) => (
                <div
                  key={stage.id}
                  className="flex items-center justify-between gap-3 bg-[#0a0a0c] border border-white/10 rounded-lg p-3"
                >
                  <div>
                    <span className="text-white font-bold">{stage.name}</span>
                    <span className="text-zinc-500 ml-2 font-mono">
                      Seq {stage.sequence} • {stage.stageType}
                    </span>
                  </div>
                  <select
                    value={stage.status || 'PENDING'}
                    disabled={statusUpdating === stage.id}
                    onChange={(e) => handleStageStatusChange(stage, e.target.value)}
                    className="bg-[#151316] border border-white/15 rounded-lg px-2 py-1 text-white"
                  >
                    {STAGE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
          </div>
        )}
      </div>

      <form onSubmit={handleCreateStage} className="space-y-3 border-t border-white/10 pt-4">
        <h4 className="font-bold uppercase text-zinc-400">Create New Stage</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="font-bold uppercase text-zinc-400 block mb-1">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Quarterfinals"
              className="w-full bg-[#0a0a0c] border border-white/15 p-2.5 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="font-bold uppercase text-zinc-400 block mb-1">Sequence</label>
            <input
              type="number"
              min={1}
              value={sequence}
              onChange={(e) => setSequence(Number(e.target.value))}
              className="w-full bg-[#0a0a0c] border border-white/15 p-2.5 rounded-lg text-white"
            />
          </div>
        </div>
        <div>
          <label className="font-bold uppercase text-zinc-400 block mb-1">Stage Type</label>
          <select
            value={stageType}
            onChange={(e) => setStageType(e.target.value)}
            className="w-full bg-[#0a0a0c] border border-white/15 p-2.5 rounded-lg text-white"
          >
            {STAGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 rounded-lg bg-[#FF4500] hover:brightness-110 text-white font-bold uppercase tracking-wider shadow-md disabled:opacity-50"
          >
            {isSubmitting ? 'Creating…' : 'Create Stage'}
          </button>
        </div>
      </form>
    </div>
  );
}

function RegisterTeamInline({
  eventId,
  sportId,
  onTeamAdded,
}: {
  eventId?: string;
  sportId?: string;
  onTeamAdded: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [instituteId, setInstituteId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) return;
    apiAuthedGet<Institute[]>('/institutes')
      .then(setInstitutes)
      .catch(() => setInstitutes([]));
  }, [expanded]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !sportId || !instituteId || !teamName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPost('/teams', {
        eventId,
        sportId,
        instituteId,
        name: teamName.trim(),
      });
      setTeamName('');
      setInstituteId('');
      onTeamAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to register team');
    } finally {
      setSubmitting(false);
    }
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-[#FFD700] hover:text-white text-xs font-bold uppercase tracking-wider"
      >
        + Register a new team for this sport
      </button>
    );
  }

  return (
    <form
      aria-label="Register team"
      onSubmit={handleAdd}
      className="bg-[#0a0a0c] border border-white/10 rounded-lg p-3 space-y-2"
    >
      {error && (
        <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300">
          {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <select
          aria-label="Team institute"
          value={instituteId}
          onChange={(e) => setInstituteId(e.target.value)}
          className="bg-[#141418] border border-white/15 p-2 rounded-lg text-white"
        >
          <option value="">Select institute…</option>
          {institutes.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="Team name"
          className="bg-[#141418] border border-white/15 p-2 rounded-lg text-white"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-bold uppercase"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !instituteId || !teamName.trim()}
          className="px-3.5 py-1.5 rounded-lg bg-[#FFD700] text-black text-xs font-bold uppercase disabled:opacity-50"
        >
          {submitting ? 'Adding…' : 'Add Team'}
        </button>
      </div>
    </form>
  );
}

function GenerateTab({
  detail,
  teams,
  teamsLoading,
  teamsError,
  venues,
  onGenerated,
  onTeamsChanged,
}: {
  detail: Tournament;
  teams: Team[];
  teamsLoading: boolean;
  teamsError: string | null;
  venues: Venue[];
  onGenerated: () => void;
  onTeamsChanged: () => void;
}) {
  const { confirm } = useToast();
  const mode = formatToGenerateMode(detail.format);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [useConfiguredSeeds, setUseConfiguredSeeds] = useState((detail.seeds?.length || 0) > 0);
  const [stageName, setStageName] = useState('');
  const [defaultVenueId, setDefaultVenueId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [matchDurationMinutes, setMatchDurationMinutes] = useState(90);
  const [breakMinutes, setBreakMinutes] = useState(30);
  const [simultaneousMatches, setSimultaneousMatches] = useState(1);
  const [scoringMode, setScoringMode] = useState<'' | 'LIVE' | 'RESULT_ONLY'>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const toggleTeam = (id: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startTime) {
      setError('Start time is required.');
      return;
    }
    const isoStart = new Date(startTime).toISOString();

    if (mode === 'knockout') {
      const hasSeeds = useConfiguredSeeds && (detail.seeds?.length || 0) > 0;
      if (!hasSeeds && selectedTeamIds.length < 2) {
        setError('Select at least 2 teams, or use configured seeds.');
        return;
      }
      const confirmMsg = `This will generate a real knockout bracket${
        hasSeeds ? ' from the configured seeds' : ` with ${selectedTeamIds.length} selected teams`
      } and create actual matches. Continue?`;
      if (!(await confirm(confirmMsg))) return;

      setIsSubmitting(true);
      setError(null);
      setResult(null);
      try {
        const res = await apiPost<{ message: string; bracketSize: number }>(
          `/tournaments/${detail.id}/generate-bracket`,
          {
            ...(hasSeeds ? {} : { teamIds: selectedTeamIds }),
            stageName: stageName || undefined,
            defaultVenueId: defaultVenueId || undefined,
            startTime: isoStart,
            matchDurationMinutes: Number(matchDurationMinutes),
            breakMinutes: Number(breakMinutes),
            simultaneousMatches,
            scoringMode: scoringMode || undefined,
          },
        );
        setResult(res.message || 'Bracket generated successfully.');
        onGenerated();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to generate bracket');
      } finally {
        setIsSubmitting(false);
      }
    } else if (mode === 'round-robin') {
      if (selectedTeamIds.length < 2) {
        setError('Select at least 2 teams for a round-robin schedule.');
        return;
      }
      if (
        !(await confirm(
          `This will generate a round-robin schedule for ${selectedTeamIds.length} teams and create actual matches. Continue?`,
        ))
      ) {
        return;
      }
      setIsSubmitting(true);
      setError(null);
      setResult(null);
      try {
        const res = await apiPost<{ message: string; totalMatches: number }>(
          `/tournaments/${detail.id}/generate-round-robin`,
          {
            teamIds: selectedTeamIds,
            stageName: stageName || undefined,
            defaultVenueId: defaultVenueId || undefined,
            startTime: isoStart,
            matchDurationMinutes: Number(matchDurationMinutes),
            breakMinutes: Number(breakMinutes),
            simultaneousMatches,
            scoringMode: scoringMode || undefined,
          },
        );
        setResult(res.message || 'Round-robin schedule generated successfully.');
        onGenerated();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to generate round-robin schedule');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const isFirstRound = !(detail.stages || []).some((s) => s.stageType === 'SWISS');
      if (isFirstRound && selectedTeamIds.length < 2) {
        setError('Select at least 2 teams to start the Swiss tournament (round 1).');
        return;
      }
      const confirmMsg = isFirstRound
        ? `This will start the Swiss tournament with ${selectedTeamIds.length} teams (round 1 pairings). Continue?`
        : 'This will generate the next Swiss round from current standings. Continue?';
      if (!(await confirm(confirmMsg))) return;

      setIsSubmitting(true);
      setError(null);
      setResult(null);
      try {
        const res = await apiPost<{ message: string; roundNumber: number; totalMatches: number }>(
          `/tournaments/${detail.id}/generate-swiss-round`,
          {
            ...(isFirstRound ? { teamIds: selectedTeamIds } : {}),
            defaultVenueId: defaultVenueId || undefined,
            startTime: isoStart,
            matchDurationMinutes: Number(matchDurationMinutes),
            breakMinutes: Number(breakMinutes),
            simultaneousMatches,
            scoringMode: scoringMode || undefined,
          },
        );
        setResult(res.message || `Swiss round ${res.roundNumber} generated successfully.`);
        onGenerated();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to generate Swiss round');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="space-y-3 text-xs">
      {error && (
        <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300">
          {error}
        </div>
      )}
      {result && (
        <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
          {result}
        </div>
      )}
      {teamsError && (
        <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300">
          {teamsError}
        </div>
      )}

      <div className="flex items-center gap-2 bg-[#181820] border border-white/10 rounded-lg px-3.5 py-2">
        <span className="text-zinc-500 uppercase font-bold">Generation Flow:</span>
        <span className="px-2.5 py-0.5 rounded bg-[#FFD700] text-black text-xs font-bold uppercase tracking-wider">
          {mode === 'knockout'
            ? 'Knockout Bracket'
            : mode === 'round-robin'
              ? 'Round Robin'
              : 'Swiss System'}
        </span>
        <span className="text-zinc-500 text-[11px]">
          fixed by the &quot;{detail.format.replace('_', ' ')}&quot; format chosen at creation —
          change it in the Overview tab.
        </span>
      </div>

      {mode === 'swiss' && (
        <p className="text-zinc-400 -mt-1">
          {(detail.stages || []).some((s) => s.stageType === 'SWISS')
            ? 'A Swiss round is already underway — this generates the next round automatically from current standings, no team selection needed.'
            : 'Select the full field below to start round 1. Later rounds pair teams by score automatically.'}
        </p>
      )}

      {mode === 'knockout' && (detail.seeds?.length || 0) > 0 && (
        <label className="flex items-center gap-2 text-zinc-300">
          <input
            type="checkbox"
            checked={useConfiguredSeeds}
            onChange={(e) => setUseConfiguredSeeds(e.target.checked)}
          />
          Use configured tournament seeds ({detail.seeds?.length} seeded teams)
        </label>
      )}

      {!(mode === 'knockout' && useConfiguredSeeds) &&
        !(mode === 'swiss' && (detail.stages || []).some((s) => s.stageType === 'SWISS')) && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold uppercase text-zinc-400">
                Select Teams{' '}
                {mode === 'round-robin'
                  ? '(all play each other once)'
                  : mode === 'swiss'
                    ? '(round 1 field)'
                    : ''}
              </label>
              {teams.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedTeamIds((prev) =>
                      prev.length === teams.length ? [] : teams.map((t) => t.id),
                    )
                  }
                  className="text-[10px] font-bold uppercase tracking-wider text-[#FFD700] hover:text-white"
                >
                  {selectedTeamIds.length === teams.length ? 'Clear all' : 'Select all'}
                </button>
              )}
            </div>
            {teamsLoading ? (
              <p className="text-zinc-500 py-2">Loading teams…</p>
            ) : teams.length === 0 ? (
              <p className="text-zinc-500 py-2">No teams registered for this sport yet.</p>
            ) : (
              <div className="max-h-40 overflow-y-auto grid grid-cols-2 gap-1.5 bg-[#0a0a0c] border border-white/10 rounded-lg p-2 mb-2">
                {teams.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-zinc-300 py-0.5">
                    <input
                      type="checkbox"
                      checked={selectedTeamIds.includes(t.id)}
                      onChange={() => toggleTeam(t.id)}
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            )}
            <RegisterTeamInline
              eventId={detail.eventId}
              sportId={detail.sportId}
              onTeamAdded={onTeamsChanged}
            />
          </div>
        )}

      <form aria-label="Generate fixtures" onSubmit={handleGenerate} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label>
            Scoring mode
            <select
              aria-label="Scoring mode"
              value={scoringMode}
              onChange={(e) => setScoringMode(e.target.value as '' | 'LIVE' | 'RESULT_ONLY')}
              className="block w-full bg-zinc-900 p-2 rounded"
            >
              <option value="">Use sport setting</option>
              <option value="LIVE">Live scoring</option>
              <option value="RESULT_ONLY">Results only</option>
            </select>
          </label>
          <label>
            Simultaneous matches
            <input
              aria-label="Simultaneous matches"
              type="number"
              min={1}
              max={64}
              required
              value={simultaneousMatches}
              onChange={(e) => setSimultaneousMatches(Number(e.target.value))}
              className="block w-full bg-zinc-900 p-2 rounded"
            />
          </label>
        </div>
        <p className="text-zinc-400">
          Matches in each round share time slots up to this limit. Later rounds start after the
          previous round and its break. The selected venue must have enough simultaneous-match
          capacity.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-bold uppercase text-zinc-400 block mb-1">
              Stage Name (optional)
            </label>
            <input
              type="text"
              value={stageName}
              onChange={(e) => setStageName(e.target.value)}
              placeholder={mode === 'knockout' ? 'e.g. Quarterfinals' : 'e.g. Group Stage'}
              className="w-full bg-[#0a0a0c] border border-white/15 p-2.5 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="font-bold uppercase text-zinc-400 block mb-1">Default Venue</label>
            <select
              value={defaultVenueId}
              onChange={(e) => setDefaultVenueId(e.target.value)}
              className="w-full bg-[#0a0a0c] border border-white/15 p-2.5 rounded-lg text-white"
            >
              <option value="">No default venue</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.simultaneousMatches ?? 1} simultaneous)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <label className="font-bold uppercase text-zinc-400 block mb-1">Start Time</label>
            <input
              type="datetime-local"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full bg-[#0a0a0c] border border-white/15 p-2.5 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="font-bold uppercase text-zinc-400 block mb-1">
              Match Duration (min)
            </label>
            <input
              type="number"
              min={1}
              value={matchDurationMinutes}
              onChange={(e) => setMatchDurationMinutes(Number(e.target.value))}
              className="w-full bg-[#0a0a0c] border border-white/15 p-2.5 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="font-bold uppercase text-zinc-400 block mb-1">
              Break Between (min)
            </label>
            <input
              type="number"
              min={0}
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(Number(e.target.value))}
              className="w-full bg-[#0a0a0c] border border-white/15 p-2.5 rounded-lg text-white"
            />
          </div>
        </div>

        <p className="text-zinc-500 text-[11px]">
          This is a generative action — it creates real matches on the server immediately upon
          confirmation.
        </p>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 rounded-lg bg-[#800020] hover:bg-[#9a0026] text-white font-bold uppercase tracking-wider shadow-md border border-[#FFD700]/30 disabled:opacity-50"
          >
            {isSubmitting
              ? 'Generating…'
              : mode === 'knockout'
                ? 'Generate Knockout Bracket'
                : mode === 'round-robin'
                  ? 'Generate Round Robin'
                  : (detail.stages || []).some((s) => s.stageType === 'SWISS')
                    ? 'Generate Next Swiss Round'
                    : 'Start Swiss Tournament'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ===================================================================
// CREATE TOURNAMENT MODAL
// ===================================================================

function CreateTournamentModal({
  sports,
  activeEvent,
  onClose,
  onCreated,
}: {
  sports: Sport[];
  activeEvent: EventSummary | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [sportId, setSportId] = useState(sports[0]?.id || '');
  const [format, setFormat] = useState('KNOCKOUT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sportId) return;
    if (!activeEvent) {
      setError('No active event available — cannot create a tournament.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await apiPost('/tournaments', {
        eventId: activeEvent.id,
        sportId,
        name: name.trim(),
        format,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create tournament');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg bg-[#141418] border border-white/20 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <h3 className="text-lg font-black text-white uppercase">Provision New Tournament</h3>
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
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300">
              {error}
            </div>
          )}
          <div>
            <label className="font-bold uppercase text-zinc-400 block mb-1">Tournament Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Football Men's Championship"
              className="w-full bg-[#0a0a0c] border border-white/15 p-2.5 rounded-lg text-sm text-white focus:border-[#FFD700] focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold uppercase text-zinc-400 block mb-1">Sport</label>
              <select
                required
                value={sportId}
                onChange={(e) => setSportId(e.target.value)}
                className="w-full bg-[#0a0a0c] border border-white/15 p-2.5 rounded-lg text-sm text-white focus:border-[#FFD700] focus:outline-none"
              >
                <option value="">Select sport…</option>
                {sports.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-bold uppercase text-zinc-400 block mb-1">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full bg-[#0a0a0c] border border-white/15 p-2.5 rounded-lg text-sm text-white focus:border-[#FFD700] focus:outline-none"
              >
                {TOURNAMENT_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-white/10 text-white text-xs font-bold uppercase disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-[#FF4500] hover:brightness-110 text-white text-xs font-bold uppercase tracking-wider shadow-md disabled:opacity-50"
            >
              {isSubmitting ? 'Creating…' : 'Create Tournament'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ===================================================================
// MAIN PAGE
// ===================================================================

function TournamentManagerContent() {
  const { confirm } = useToast();
  const { hasPermission, myScopedSportId } = useAuth();
  const canManage = hasPermission('competition.manage');

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sports, setSports] = useState<Sport[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [activeEvent, setActiveEvent] = useState<EventSummary | null>(null);

  const [filterStatus, setFilterStatus] = useState<'all' | 'UPCOMING' | 'ONGOING' | 'COMPLETED'>(
    'all',
  );
  const [selectedSportId, setSelectedSportId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [manageTournament, setManageTournament] = useState<Tournament | null>(null);

  const loadTournaments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiAuthedGet<Tournament[]>('/tournaments');
      setTournaments(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      loadTournaments();
      apiAuthedGet<Sport[]>('/sports')
        .then(setSports)
        .catch(() => setSports([]));
      apiAuthedGet<Venue[]>('/venues')
        .then(setVenues)
        .catch(() => setVenues([]));
      apiAuthedGet<EventSummary[]>('/events?status=ACTIVE')
        .then((events) => setActiveEvent(events[0] ?? null))
        .catch(() => setActiveEvent(null));
    });
    return () => {
      cancelled = true;
    };
  }, [loadTournaments]);

  // A Sports Coordinator scoped to a single sport defaults to seeing just that
  // sport's tournaments instead of every sport's — still switchable via the
  // dropdown below for roles that legitimately span more than one sport.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      const scoped = myScopedSportId('competition.manage', 'tournament.view');
      if (scoped) setSelectedSportId(scoped);
    });
    return () => {
      cancelled = true;
    };
  }, [myScopedSportId]);

  const filteredTournaments = tournaments.filter((t) => {
    if (filterStatus !== 'all' && (t.status || '').toUpperCase() !== filterStatus) return false;
    if (selectedSportId !== 'all' && t.sportId !== selectedSportId) return false;
    if (
      searchQuery.trim() &&
      !t.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !(t.sport?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const counts = {
    all: tournaments.length,
    UPCOMING: tournaments.filter((t) => t.status === 'UPCOMING').length,
    ONGOING: tournaments.filter((t) => t.status === 'ONGOING').length,
    COMPLETED: tournaments.filter((t) => t.status === 'COMPLETED').length,
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#121114] text-[#E8E6EB] selection:bg-[#FFD700] selection:text-black font-sans">
      <LiveTickerRibbon />
      <Navbar />
      <OrganizerNavRail />

      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Workspace Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white">
                TOURNAMENT <span className="text-[#FFD700]">MANAGER</span>
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-[#FFD700]/10 text-[#FFD700] border border-[#FFD700]/30 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700]"></span>
                LIVE DISPATCH
              </span>
            </div>
            <p className="text-sm text-zinc-400 max-w-3xl mt-1 leading-relaxed">
              Centralized competition control, seeding, bracket generation, and fixture status
              across all sanctioned disciplines.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/organizer"
              className="h-10 px-4 rounded-lg bg-[#181820] hover:bg-[#20202a] text-[#E5E7EB] border border-[#2d2d35] font-semibold text-xs uppercase tracking-wider flex items-center gap-2 transition-colors"
            >
              Organizer Overview
            </Link>
            {canManage && (
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="h-10 px-5 rounded-lg bg-[#FF4500] hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg active:scale-95 border border-[#FF4500]/50"
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
                <span>NEW TOURNAMENT</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-8">
          <div className="bg-[#121216] border border-[#23232b] rounded-xl p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Total Tournaments
            </div>
            <div className="mt-3 text-4xl font-black text-white font-mono">
              {loading ? '—' : String(counts.all).padStart(2, '0')}
            </div>
          </div>
          <div className="bg-[#121216] border border-[#23232b] rounded-xl p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">Ongoing</div>
            <div className="mt-3 text-4xl font-black text-[#FF4500] font-mono">
              {loading ? '—' : counts.ONGOING}
            </div>
          </div>
          <div className="bg-[#121216] border border-[#23232b] rounded-xl p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">Upcoming</div>
            <div className="mt-3 text-4xl font-black text-[#FFD700] font-mono">
              {loading ? '—' : counts.UPCOMING}
            </div>
          </div>
          <div className="bg-[#121216] border border-[#23232b] rounded-xl p-5">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Completed
            </div>
            <div className="mt-3 text-4xl font-black text-emerald-400 font-mono">
              {loading ? '—' : counts.COMPLETED}
            </div>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { key: 'all' as const, label: `ALL TOURNAMENTS (${counts.all})` },
              { key: 'ONGOING' as const, label: `ONGOING (${counts.ONGOING})` },
              { key: 'UPCOMING' as const, label: `UPCOMING (${counts.UPCOMING})` },
              { key: 'COMPLETED' as const, label: `COMPLETED (${counts.COMPLETED})` },
            ].map((tab) => {
              const isActive = filterStatus === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setFilterStatus(tab.key)}
                  className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-[#FFD700] text-black shadow-sm'
                      : 'bg-[#181820] text-zinc-400 hover:text-white hover:bg-[#22222d]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tournament or sport..."
                className="w-full h-10 px-3 rounded-lg bg-[#181820] border border-[#2d2d35] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#FFD700]"
              />
            </div>
            <select
              value={selectedSportId}
              onChange={(e) => setSelectedSportId(e.target.value)}
              className="h-10 px-3 rounded-lg bg-[#181820] border border-[#2d2d35] text-xs text-zinc-300 focus:outline-none uppercase font-semibold"
            >
              <option value="all">All Sports</option>
              {sports.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tournaments Grid */}
        {loading && (
          <div className="text-center py-20 text-zinc-500 text-sm font-mono">
            Loading tournaments…
          </div>
        )}
        {!loading && error && (
          <div className="text-center py-20 border border-rose-500/20 rounded-xl bg-rose-950/20">
            <p className="text-rose-300 text-sm mb-3">{error}</p>
            <button
              onClick={loadTournaments}
              className="px-4 py-2 rounded-lg bg-white/10 text-white text-xs font-bold uppercase hover:bg-white/20"
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !error && filteredTournaments.length === 0 && (
          <div className="text-center py-20 text-zinc-500 text-sm font-mono border border-[#23232b] rounded-xl">
            No tournaments match the current filters.
          </div>
        )}
        {!loading && !error && filteredTournaments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredTournaments.map((item) => {
              const totalMatches = item._count?.matches ?? 0;
              return (
                <div
                  key={item.id}
                  data-tournament-id={item.id}
                  className="bg-[#121216] border border-[#23232b] hover:border-[#FFD700]/40 rounded-xl p-5 flex flex-col justify-between transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-[#1e1e28] text-[#FFD700]">
                            {item.sport?.name || 'SPORT'}
                          </span>
                          <span
                            className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusBadgeClasses(item.status)}`}
                          >
                            {(item.status || 'UPCOMING').toUpperCase()}
                          </span>
                        </div>
                        <h3 className="text-lg font-black text-white uppercase tracking-tight mt-1.5">
                          {item.name}
                        </h3>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                      <span className="px-2.5 py-1 rounded bg-[#181820] text-zinc-300 border border-[#262633] font-mono font-bold">
                        {item.format.replace('_', ' ')}
                      </span>
                      <span className="px-2.5 py-1 rounded bg-[#181820] text-zinc-400 border border-[#262633]">
                        {item.stages?.length || 0} stage
                        {(item.stages?.length || 0) === 1 ? '' : 's'}
                      </span>
                      <span className="px-2.5 py-1 rounded bg-[#181820] text-zinc-400 border border-[#262633]">
                        {item.seeds?.length || 0} seeded team
                        {(item.seeds?.length || 0) === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#1f1f26]">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-zinc-400">
                          Matches: <strong className="text-white font-mono">{totalMatches}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 mt-5 pt-3 border-t border-[#1f1f26]">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/bracket?tournamentId=${item.id}`}
                        className="h-9 px-3.5 rounded-lg border border-[#343442] hover:border-[#FFD700]/50 hover:bg-[#1c1c24] text-zinc-300 hover:text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                      >
                        View Bracket
                      </Link>
                      <Link
                        href={`/matches?tournamentId=${item.id}`}
                        className="h-9 px-3.5 rounded-lg border border-[#343442] hover:border-[#FFD700]/50 hover:bg-[#1c1c24] text-zinc-300 hover:text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                      >
                        Fixtures
                      </Link>
                    </div>
                    {canManage && (
                      <button
                        onClick={() => setManageTournament(item)}
                        type="button"
                        className="h-9 px-4 rounded-lg bg-[#FF4500] hover:brightness-110 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95 border border-[#FF4500]/50"
                      >
                        <span>Manage</span>
                        <span>→</span>
                      </button>
                    )}
                    {canManage && (
                      <button
                        className="text-xs text-rose-300 underline"
                        onClick={async () => {
                          if (
                            !(await confirm(
                              `Delete ${item.name}? Tournaments with fixtures must be archived instead.`,
                            ))
                          )
                            return;
                          try {
                            await apiDelete(`/tournaments/${item.id}`);
                            setTournaments((current) => current.filter((t) => t.id !== item.id));
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        Delete tournament
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {isNewModalOpen && (
        <CreateTournamentModal
          sports={sports}
          activeEvent={activeEvent}
          onClose={() => setIsNewModalOpen(false)}
          onCreated={loadTournaments}
        />
      )}

      {manageTournament && (
        <ManageTournamentModal
          tournament={manageTournament}
          venues={venues}
          onClose={() => setManageTournament(null)}
          onChanged={loadTournaments}
        />
      )}

      <Footer />
    </div>
  );
}

export default function TournamentManagerPage() {
  return (
    <RequireOrganizer anyPermission={['tournament.view', 'competition.manage']}>
      <TournamentManagerContent />
    </RequireOrganizer>
  );
}
