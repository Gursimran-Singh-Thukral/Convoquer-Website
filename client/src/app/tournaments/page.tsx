'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { OrganizerNavRail } from '@/components/OrganizerNavRail';
import { LiveTickerRibbon } from '@/components/LiveTickerRibbon';
import { Footer } from '@/components/Footer';
import { RequireOrganizer } from '@/components/RequireOrganizer';
import {
  apiAuthedGet,
  apiPost,
  apiDelete,
  ApiError,
  type Sport,
  type Team,
  type Tournament,
  type EventSummary,
} from '@/lib/api';

type GroupFormat = 'KNOCKOUT' | 'ROUND_ROBIN' | 'SWISS';

interface Group {
  id: string;
  name: string;
  format: GroupFormat;
  teamIds: string[];
}

const FORMAT_LABEL: Record<GroupFormat, string> = {
  KNOCKOUT: 'Knockout',
  ROUND_ROBIN: 'Round robin',
  SWISS: 'Swiss',
};

const GROUP_LETTERS = 'ABCDEFGHIJ';

function newGroup(index: number): Group {
  return {
    id: `g-${Date.now()}-${index}`,
    name: `Group ${GROUP_LETTERS[index] || index + 1}`,
    format: 'KNOCKOUT',
    teamIds: [],
  };
}

interface BuildResult {
  groupName: string;
  ok: boolean;
  message: string;
  tournamentId?: string;
}

function TournamentBuilderContent() {
  const [activeEvent, setActiveEvent] = useState<EventSummary | null>(null);
  const [sports, setSports] = useState<Sport[]>([]);

  const [selectedSportId, setSelectedSportId] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  const [tournamentName, setTournamentName] = useState('');
  const [groups, setGroups] = useState<Group[]>([newGroup(0)]);
  const [explicitActiveGroupId, setExplicitActiveGroupId] = useState<string>('');
  const [draggingTeamId, setDraggingTeamId] = useState<string | null>(null);

  // Derived rather than synced via effect — whichever group was last clicked,
  // falling back to the first group once that one's gone (e.g. removed).
  const activeGroupId = groups.some((g) => g.id === explicitActiveGroupId)
    ? explicitActiveGroupId
    : (groups[0]?.id ?? '');

  const [building, setBuilding] = useState(false);
  const [buildResults, setBuildResults] = useState<BuildResult[] | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);

  const [existingTournaments, setExistingTournaments] = useState<Tournament[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    apiAuthedGet<EventSummary[]>('/events?status=ACTIVE')
      .then((events) => setActiveEvent(events[0] ?? null))
      .catch(() => setActiveEvent(null));
    apiAuthedGet<Sport[]>('/sports')
      .then(setSports)
      .catch(() => setSports([]));
  }, []);

  const loadExisting = useCallback((sportId: string) => {
    if (!sportId) {
      setExistingTournaments([]);
      return;
    }
    apiAuthedGet<Tournament[]>(`/tournaments?sportId=${sportId}`)
      .then(setExistingTournaments)
      .catch(() => setExistingTournaments([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Deferred via a microtask so this effect's own setState calls don't run
    // synchronously within the effect body (matches the pattern used
    // elsewhere for react-hooks/set-state-in-effect — see auth-context.tsx).
    Promise.resolve().then(() => {
      if (cancelled) return;
      if (!selectedSportId) {
        setTeams([]);
        setExistingTournaments([]);
        return;
      }
      setTeamsLoading(true);
      apiAuthedGet<Team[]>(`/teams?sportId=${selectedSportId}`)
        .then((data) => {
          if (!cancelled) setTeams(data);
        })
        .catch(() => {
          if (!cancelled) setTeams([]);
        })
        .finally(() => {
          if (!cancelled) setTeamsLoading(false);
        });
      loadExisting(selectedSportId);
      // Reset group assignments — a fresh sport means a fresh team pool.
      setGroups([newGroup(0)]);
      setBuildResults(null);
      setBuildError(null);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedSportId, loadExisting]);

  const assignedTeamIds = new Set(groups.flatMap((g) => g.teamIds));
  const unassignedTeams = teams.filter((t) => !assignedTeamIds.has(t.id));

  function assignTeamToGroup(teamId: string, groupId: string) {
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        teamIds:
          g.id === groupId
            ? [...g.teamIds.filter((id) => id !== teamId), teamId]
            : g.teamIds.filter((id) => id !== teamId),
      })),
    );
  }

  function unassignTeam(teamId: string) {
    setGroups((prev) =>
      prev.map((g) => ({ ...g, teamIds: g.teamIds.filter((id) => id !== teamId) })),
    );
  }

  function addGroup() {
    setGroups((prev) => [...prev, newGroup(prev.length)]);
  }

  function removeGroup(groupId: string) {
    setGroups((prev) => (prev.length > 1 ? prev.filter((g) => g.id !== groupId) : prev));
  }

  function renameGroup(groupId: string, name: string) {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, name } : g)));
  }

  function setGroupFormat(groupId: string, format: GroupFormat) {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, format } : g)));
  }

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name || id;

  // Building only ever produces the structure — a Tournament per group, with
  // that group's teams registered as its seed list. It never creates a
  // single Match: which team plays whom, and at what time and venue, is
  // entirely the Sports Coordinator's call, made match-by-match from
  // /matches → "Schedule New Match" (scoped to just this tournament's
  // seeded teams — see that page's eligibleTeams).
  async function handleBuild() {
    if (!activeEvent || !selectedSportId || !tournamentName.trim()) return;
    setBuilding(true);
    setBuildError(null);
    setBuildResults(null);

    const eligibleGroups = groups.filter((g) => g.teamIds.length >= 2);
    if (eligibleGroups.length === 0) {
      setBuildError('At least one group needs 2 or more teams before you can build a structure.');
      setBuilding(false);
      return;
    }

    const results: BuildResult[] = [];
    const usesGroupNames = groups.length > 1;

    for (const group of eligibleGroups) {
      const name = usesGroupNames
        ? `${tournamentName.trim()} — ${group.name}`
        : tournamentName.trim();
      try {
        const tournament = await apiPost<Tournament>('/tournaments', {
          eventId: activeEvent.id,
          sportId: selectedSportId,
          name,
          format: group.format,
        });

        await apiPost(`/tournaments/${tournament.id}/seeds`, {
          seeds: group.teamIds.map((teamId, index) => ({ teamId, seedNumber: index + 1 })),
        });

        results.push({
          groupName: group.name,
          ok: true,
          message: `Structure created with ${group.teamIds.length} teams (${FORMAT_LABEL[group.format]}) — no matches yet.`,
          tournamentId: tournament.id,
        });
      } catch (err) {
        results.push({
          groupName: group.name,
          ok: false,
          message: err instanceof ApiError ? err.message : 'Failed to build this group.',
        });
      }
    }

    setBuildResults(results);
    setBuilding(false);
    loadExisting(selectedSportId);
  }

  async function handleDeleteTournament(id: string) {
    setDeletingId(id);
    try {
      await apiDelete(`/tournaments/${id}`);
      loadExisting(selectedSportId);
    } catch {
      // surfaced via the existing-tournaments list simply not refreshing
    } finally {
      setDeletingId(null);
    }
  }

  const selectedSport = sports.find((s) => s.id === selectedSportId);

  return (
    <div className="min-h-screen flex flex-col bg-[#121114] text-[#E8E6EB] selection:bg-[#FFD700] selection:text-black font-sans">
      <LiveTickerRibbon />
      <Navbar />
      <OrganizerNavRail />
      <div className="h-[2px] w-full bg-gradient-to-r from-[#800020] via-[#FF4500] to-[#FFD700]"></div>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#FFD700] uppercase tracking-widest mb-1">
              <span>CONVOQUER&apos;26</span>
              <span>•</span>
              <span>TOURNAMENT BUILDER</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white">
              BUILD <span className="text-[#FFD700]">TOURNAMENT STRUCTURE</span>
            </h1>
            <p className="text-zinc-400 text-sm mt-1 max-w-2xl leading-relaxed">
              Name the tournament, drag teams into groups, and pick each group&apos;s format. This
              only builds the structure — no matches. Sports Coordinators decide who plays whom and
              schedule the time and venue for every match, one at a time, from{' '}
              <Link href="/matches" className="text-[#FFD700] underline">
                Matches
              </Link>
              .
            </p>
          </div>
          <Link
            href="/organizer"
            className="px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold uppercase text-zinc-300 transition-colors shrink-0"
          >
            Organizer Overview
          </Link>
        </section>

        {!activeEvent && (
          <div className="mt-4 p-3 rounded-lg bg-[#FF4500]/10 border border-[#FF4500]/30 text-[#FF4500] text-xs font-semibold">
            No active event found — building is disabled until an event is active.
          </div>
        )}

        {/* STEP 1: Name + Sport */}
        <section className="mt-6 bg-[#1d1b1e] border border-white/10 rounded-xl p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#FFD700] mb-3">
            1. Tournament name &amp; sport
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase text-zinc-400 block mb-1">
                Tournament name
              </label>
              <input
                type="text"
                value={tournamentName}
                onChange={(e) => setTournamentName(e.target.value)}
                placeholder="e.g. Convoquer'26 Football Cup"
                className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-zinc-400 block mb-1">Sport</label>
              <select
                value={selectedSportId}
                onChange={(e) => setSelectedSportId(e.target.value)}
                className="w-full bg-[#121014] border border-white/15 p-2.5 rounded-lg text-white text-sm"
              >
                <option value="">Select a sport…</option>
                {sports.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* STEP 2: Groups + drag and drop */}
        {selectedSportId && (
          <section className="mt-6 bg-[#1d1b1e] border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#FFD700]">
                2. Groups — drag teams in, pick each group&apos;s format
              </h2>
              <button
                type="button"
                onClick={addGroup}
                className="text-[10px] font-bold uppercase tracking-wider text-[#FFD700] hover:text-white border border-[#FFD700]/40 rounded-lg px-3 py-1.5"
              >
                + Add group
              </button>
            </div>

            {teamsLoading ? (
              <p className="text-xs text-zinc-500 font-mono py-4">
                Loading {selectedSport?.name} teams…
              </p>
            ) : teams.length === 0 ? (
              <p className="text-xs text-zinc-500 font-mono py-4">
                No teams registered for {selectedSport?.name} yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
                {/* Unassigned pool */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const teamId = e.dataTransfer.getData('text/plain');
                    if (teamId) unassignTeam(teamId);
                    setDraggingTeamId(null);
                  }}
                  className="bg-[#121014] border border-dashed border-white/15 rounded-lg p-3 min-h-[120px]"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Unassigned ({unassignedTeams.length})
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {unassignedTeams.map((t) => (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', t.id);
                          setDraggingTeamId(t.id);
                        }}
                        onDragEnd={() => setDraggingTeamId(null)}
                        onClick={() => activeGroupId && assignTeamToGroup(t.id, activeGroupId)}
                        title="Drag into a group, or tap to add to the active group"
                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium cursor-grab active:cursor-grabbing bg-[#232025] border border-white/10 text-zinc-200 hover:border-[#FFD700]/50 transition-colors ${
                          draggingTeamId === t.id ? 'opacity-40' : ''
                        }`}
                      >
                        {t.name}
                      </div>
                    ))}
                    {unassignedTeams.length === 0 && (
                      <p className="text-[11px] text-zinc-600 font-mono">All teams assigned.</p>
                    )}
                  </div>
                </div>

                {/* Groups */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const teamId = e.dataTransfer.getData('text/plain');
                        if (teamId) assignTeamToGroup(teamId, group.id);
                        setDraggingTeamId(null);
                      }}
                      onClick={() => setExplicitActiveGroupId(group.id)}
                      className={`rounded-lg border p-3 min-h-[160px] flex flex-col gap-2 transition-colors ${
                        activeGroupId === group.id
                          ? 'border-[#FFD700]/60 bg-[#FFD700]/5'
                          : 'border-white/10 bg-[#121014]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={group.name}
                          onChange={(e) => renameGroup(group.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 bg-transparent border-b border-white/15 text-sm font-bold text-white focus:outline-none focus:border-[#FFD700]"
                        />
                        {groups.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeGroup(group.id);
                            }}
                            className="text-zinc-500 hover:text-rose-400 text-xs"
                            title="Remove group"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <select
                        value={group.format}
                        onChange={(e) => {
                          setGroupFormat(group.id, e.target.value as GroupFormat);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-[#1d1b1e] border border-white/15 rounded p-1.5 text-[11px] text-white"
                      >
                        <option value="KNOCKOUT">Knockout</option>
                        <option value="ROUND_ROBIN">Round robin</option>
                        <option value="SWISS">Swiss</option>
                      </select>
                      <div className="flex flex-col gap-1.5 flex-1">
                        {group.teamIds.map((teamId) => (
                          <div
                            key={teamId}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', teamId);
                              setDraggingTeamId(teamId);
                            }}
                            onDragEnd={() => setDraggingTeamId(null)}
                            onClick={(e) => {
                              e.stopPropagation();
                              unassignTeam(teamId);
                            }}
                            title="Tap to unassign"
                            className={`px-2.5 py-1.5 rounded-md text-xs font-medium cursor-grab active:cursor-grabbing bg-[#800020]/30 border border-[#FFD700]/20 text-white hover:border-rose-400/60 transition-colors ${
                              draggingTeamId === teamId ? 'opacity-40' : ''
                            }`}
                          >
                            {teamName(teamId)}
                          </div>
                        ))}
                        {group.teamIds.length === 0 && (
                          <p className="text-[11px] text-zinc-600 font-mono">Drop teams here.</p>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500">
                        {group.teamIds.length} team{group.teamIds.length === 1 ? '' : 's'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[10px] text-zinc-500 mt-3">
              Tip: click a group to make it &quot;active&quot;, then tap an unassigned team to add
              it without dragging — handy on a touchscreen.
            </p>
          </section>
        )}

        {/* STEP 3: Build — structure only, no matches */}
        {selectedSportId && teams.length > 0 && (
          <section className="mt-6 bg-[#1d1b1e] border border-white/10 rounded-xl p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#FFD700] mb-3">
              3. Build the structure
            </h2>
            <p className="text-[11px] text-zinc-500 mb-3">
              This creates the tournament and registers each group&apos;s teams — it does{' '}
              <strong className="text-zinc-300">not</strong> create any matches. Pairings, times and
              venues are entirely up to whichever Sports Coordinator schedules each match from{' '}
              <Link href="/matches" className="text-[#FFD700] underline">
                Matches
              </Link>
              .
            </p>

            {buildError && (
              <div className="mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
                {buildError}
              </div>
            )}

            {buildResults && (
              <div className="mt-4 space-y-1.5">
                {buildResults.map((r) => (
                  <div
                    key={r.groupName}
                    className={`text-xs p-2.5 rounded-lg border ${
                      r.ok
                        ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <span className="font-bold">{r.groupName}:</span> {r.message}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleBuild}
                disabled={building || !activeEvent || !tournamentName.trim() || teams.length === 0}
                className="px-6 py-3 rounded-lg bg-[#FFD700] hover:bg-[#ffe16d] text-black font-bold text-xs uppercase tracking-wider shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {building ? 'Building…' : 'Build Tournament Structure'}
              </button>
            </div>
          </section>
        )}

        {/* Existing tournaments for this sport */}
        {selectedSportId && (
          <section className="mt-6 bg-[#1d1b1e] border border-white/10 rounded-xl p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#FFD700] mb-3">
              Existing {selectedSport?.name} tournaments
            </h2>
            {existingTournaments.length === 0 ? (
              <p className="text-xs text-zinc-500 font-mono">None yet.</p>
            ) : (
              <div className="space-y-2">
                {existingTournaments.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 bg-[#121014] border border-white/10 rounded-lg p-3"
                  >
                    <div>
                      <div className="text-sm font-bold text-white">{t.name}</div>
                      <div className="text-[10px] font-mono text-zinc-500 uppercase">
                        {t.format} · {t.status} · {t._count?.matches ?? 0} matches
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/matches?tournamentId=${t.id}`}
                        className="text-[10px] font-bold uppercase tracking-wider text-[#FFD700] hover:text-white"
                      >
                        View matches
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDeleteTournament(t.id)}
                        disabled={deletingId === t.id}
                        className="text-[10px] font-bold uppercase tracking-wider text-rose-400 hover:text-rose-300 disabled:opacity-50"
                      >
                        {deletingId === t.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}

// Tournament structure (create/update/delete a Tournament, register its
// group's teams as seeds) is kept to you alone — Sports Coordinators decide
// pairings/time/venue and CRUD matches inside a structure you've already
// built (see /matches) but never touch the structure itself. Backed by
// SoleAdminGuard server-side, not just this client-side gate.
export default function TournamentBuilderPage() {
  return (
    <RequireOrganizer requireRole={['WEB_DEV_HEAD']}>
      <TournamentBuilderContent />
    </RequireOrganizer>
  );
}
