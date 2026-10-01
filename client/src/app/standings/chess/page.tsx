'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import {
  apiGet,
  type Sport,
  type TeamStanding,
  type Tournament,
  type TournamentStage,
} from '@/lib/api';

const fmt = (n: number | undefined) =>
  n === undefined ? '—' : Number.isInteger(n) ? String(n) : n.toFixed(1);

function ChessStandings() {
  const params = useSearchParams();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentId, setTournamentId] = useState(params.get('tournament') ?? '');
  const [round, setRound] = useState(Number(params.get('round')) || 0);
  const [rows, setRows] = useState<TeamStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const sports = (await apiGet<Sport[]>('/sports')).filter((s) => /chess/i.test(s.name));
        const all = (
          await Promise.all(sports.map((s) => apiGet<Tournament[]>(`/tournaments?sportId=${s.id}`)))
        ).flat();
        if (live) setTournaments(all);
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const tournament = tournaments.find((t) => t.id === tournamentId) ?? tournaments[0];
  // Rounds = Swiss stages for the men's Swiss, or every stage otherwise.
  const stages: TournamentStage[] = useMemo(() => {
    const all = [...(tournament?.stages ?? [])].sort((a, b) => a.sequence - b.sequence);
    const swiss = all.filter((s) => s.stageType === 'SWISS');
    return swiss.length ? swiss : [];
  }, [tournament]);
  const stage = stages.find((_, i) => i + 1 === round) ?? stages[stages.length - 1];

  useEffect(() => {
    if (!tournament) return;
    let live = true;
    const url = stage
      ? `/tournaments/${tournament.id}/standings?throughStageId=${stage.id}`
      : `/tournaments/${tournament.id}/standings`;
    apiGet<{ standings: TeamStanding[] }>(url)
      .then((r) => live && setRows(r.standings))
      .catch(() => live && setFailed(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [tournament, stage]);

  const swiss =
    /\bmen\b/i.test(tournament?.sport?.name ?? '') && !/women/i.test(tournament?.sport?.name ?? '');
  const shownRound = stage ? stages.indexOf(stage) + 1 : 0;
  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <p className="text-sm">
          <Link href="/standings" className="underline text-[#FFD700]">
            ← All standings
          </Link>
        </p>
        <h1 className="text-3xl font-bold text-[#FFD700]">Chess standings</h1>
        {failed && <p role="alert">Standings are temporarily unavailable.</p>}
        {tournaments.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {tournaments.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTournamentId(t.id);
                  setRound(0);
                  setLoading(true);
                }}
                className={`px-3 py-1 rounded border text-sm ${
                  t.id === tournament?.id
                    ? 'border-[#FFD700] text-[#FFD700]'
                    : 'border-white/20 text-zinc-300'
                }`}
              >
                {t.sport?.name ?? t.name}
              </button>
            ))}
          </div>
        )}
        {stages.length > 0 && (
          <nav aria-label="Round" className="flex flex-wrap gap-2">
            {stages.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setRound(i + 1);
                  setLoading(true);
                }}
                aria-current={i + 1 === shownRound ? 'true' : undefined}
                className={`px-3 py-1 rounded border text-sm ${
                  i + 1 === shownRound
                    ? 'border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]'
                    : 'border-white/20 text-zinc-300 hover:border-white/50'
                }`}
              >
                After round {i + 1}
              </button>
            ))}
          </nav>
        )}
        <p className="text-sm text-zinc-400">
          {tournament?.name}
          {shownRound ? ` · standings after round ${shownRound}` : ''}. Win 2, draw 1, loss 0.{' '}
          {swiss
            ? 'Ties: Buchholz Cut-1, then Sonneborn–Berger.'
            : 'Ties: Sonneborn–Berger, then the direct encounter.'}
        </p>
        <div className="overflow-x-auto rounded-lg border border-white/15">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="p-3 text-left">#</th>
                <th className="p-3 text-left">Team</th>
                <th className="p-3">P</th>
                <th className="p-3">W</th>
                <th className="p-3">D</th>
                <th className="p-3">L</th>
                <th className="p-3" title="Board points">
                  BP
                </th>
                <th className="p-3" title="Sonneborn-Berger">
                  SB
                </th>
                <th className="p-3" title="Buchholz Cut-1">
                  BC1
                </th>
                <th className="p-3 text-[#FFD700]">Pts</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-4">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-4 text-zinc-400">
                    No published results yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.teamId} className="border-t border-white/10 text-center">
                    <td className="p-3 text-left font-bold">{r.rank}</td>
                    <td className="p-3 text-left font-semibold">
                      {r.instituteShortName || r.teamName}
                    </td>
                    <td className="p-3">{r.played}</td>
                    <td className="p-3">{r.won}</td>
                    <td className="p-3">{r.drawn}</td>
                    <td className="p-3">{r.lost}</td>
                    <td className="p-3">{fmt(r.scoreFor)}</td>
                    <td className="p-3">{fmt(r.sonnebornBerger)}</td>
                    <td className="p-3">{fmt(r.buchholzCut1)}</td>
                    <td className="p-3 font-black text-[#FFD700]">{r.points}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500">
          Only published results count. A team with a bye is credited with a win for that round.
        </p>
      </main>
      <Footer />
    </>
  );
}

export default function ChessStandingsPage() {
  return (
    <Suspense fallback={null}>
      <ChessStandings />
    </Suspense>
  );
}
