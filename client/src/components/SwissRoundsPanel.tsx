'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  apiAuthedGet,
  apiPost,
  type Match,
  type Sport,
  type Tournament,
  type Venue,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const ROUNDS = 5;
const input = 'block w-full bg-zinc-900 border border-white/20 rounded p-2 mt-1';

/** "2026-10-03T10:00" typed in IST → ISO instant. */
const istToIso = (local: string) => new Date(`${local}:00+05:30`).toISOString();
const toLocalIst = (iso: string) =>
  new Date(iso)
    .toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' })
    .slice(0, 16)
    .replace(' ', 'T');

interface Pairing {
  teamA?: { name: string } | null;
  teamB?: { name: string } | null;
}

function SwissCard({
  tournament,
  venues,
  onGenerated,
}: {
  tournament: Tournament;
  venues: Venue[];
  onGenerated: () => void;
}) {
  const rounds = (tournament.stages ?? []).filter((s) => s.stageType === 'SWISS').length;
  const next = rounds + 1;
  const [lastEnd, setLastEnd] = useState<string | null>(null);
  const [start, setStart] = useState('');
  const [venueId, setVenueId] = useState('');
  const [minutes, setMinutes] = useState('75');
  const [breakMin, setBreakMin] = useState('15');
  const [parallel, setParallel] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [created, setCreated] = useState<Pairing[]>([]);
  const [bye, setBye] = useState('');

  useEffect(() => {
    let live = true;
    apiAuthedGet<Match[]>(`/matches?tournamentId=${tournament.id}`)
      .then((ms) => {
        if (!live) return;
        const ends = ms
          .map((m) => m.scheduledEndTime || m.scheduledStartTime)
          .filter(Boolean)
          .sort();
        setLastEnd(ends.length ? ends[ends.length - 1] : null);
      })
      .catch(() => live && setLastEnd(null));
    return () => {
      live = false;
    };
  }, [tournament.id, rounds]);

  const venue = venues.find((v) => v.id === venueId);
  const fieldSize = tournament.seeds?.length ?? 0;
  const defaultParallel = Math.max(
    1,
    Math.min(venue?.simultaneousMatches ?? 1, Math.floor(fieldSize / 2) || 1),
  );
  // Defaults the coordinator can leave alone: round 1 at 10:00 on 3 Oct, later
  // rounds 30 minutes after the previous round finishes.
  const startValue =
    start ||
    (lastEnd
      ? toLocalIst(new Date(new Date(lastEnd).getTime() + 30 * 60_000).toISOString())
      : '2026-10-03T10:00');
  const venueValue =
    venueId || venues.find((v) => /student activity/i.test(v.name))?.id || venues[0]?.id || '';

  async function generate() {
    setBusy(true);
    setMessage('');
    setError(false);
    setCreated([]);
    try {
      const res = await apiPost<{
        message: string;
        matches: Pairing[];
        byeTeamId?: string;
      }>(`/tournaments/${tournament.id}/generate-swiss-round`, {
        startTime: istToIso(startValue),
        defaultVenueId: venueValue || undefined,
        matchDurationMinutes: Number(minutes) || 75,
        breakMinutes: Number(breakMin) || 0,
        simultaneousMatches: Number(parallel) || defaultParallel,
      });
      setMessage(res.message);
      setCreated(res.matches ?? []);
      setBye(
        res.byeTeamId
          ? (tournament.seeds?.find((s) => s.teamId === res.byeTeamId)?.team?.name ?? 'a team')
          : '',
      );
      setStart('');
      onGenerated();
    } catch (err) {
      setError(true);
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label={`${tournament.name} Swiss rounds`}
      className="rounded-xl border border-white/15 bg-[#17171a] p-5 space-y-4"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-bold text-lg">{tournament.name}</h3>
        <p className="text-sm text-zinc-400">
          {fieldSize} teams · {rounds} of {ROUNDS} rounds generated
        </p>
      </header>
      {rounds > 0 && (
        <nav aria-label="Standings by round" className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-400">Standings:</span>
          {Array.from({ length: rounds }, (_, i) => (
            <a
              key={i}
              href={`/standings/chess?tournament=${tournament.id}&round=${i + 1}`}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-[#FFD700]/40 px-2 py-1 text-[#FFD700] hover:bg-[#FFD700]/10"
            >
              After round {i + 1}
            </a>
          ))}
        </nav>
      )}
      {next > ROUNDS ? (
        <p className="text-emerald-300">All {ROUNDS} rounds are generated — enter the results.</p>
      ) : (
        <>
          <p className="text-sm text-zinc-300">
            {rounds === 0
              ? `Round 1 pairs the seeded teams (top half against bottom half${fieldSize % 2 ? ', one team gets a bye' : ''}).`
              : `Round ${next} is paired automatically from the standings: teams on similar scores meet, nobody plays the same opponent twice. Publish every result of round ${rounds} first.`}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="lg:col-span-2 text-sm">
              Round {next} start (IST)
              <input
                aria-label="Round start"
                type="datetime-local"
                className={input}
                value={startValue}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Venue
              <select
                aria-label="Venue"
                className={input}
                value={venueValue}
                onChange={(e) => setVenueId(e.target.value)}
              >
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Boards at once
              <input
                aria-label="Boards at once"
                type="number"
                min={1}
                className={input}
                value={parallel || String(defaultParallel)}
                onChange={(e) => setParallel(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Match length (min)
              <input
                aria-label="Match length"
                type="number"
                min={10}
                className={input}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            disabled={busy || !startValue}
            onClick={() => void generate()}
            className="bg-[#800020] rounded px-4 py-2 font-bold disabled:opacity-50"
          >
            {busy ? 'Generating…' : `Generate round ${next}`}
          </button>
        </>
      )}
      {message && (
        <p
          role={error ? 'alert' : 'status'}
          className={error ? 'text-red-300' : 'text-emerald-300'}
        >
          {message}
        </p>
      )}
      {created.length > 0 && (
        <ol className="text-sm space-y-1 list-decimal pl-5">
          {created.map((m, i) => (
            <li key={i}>
              {m.teamA?.name} <span className="text-zinc-500">vs</span> {m.teamB?.name}
            </li>
          ))}
          {bye && <li className="text-zinc-400">{bye} — bye (counts as a win)</li>}
        </ol>
      )}
    </section>
  );
}

/**
 * One-click Swiss rounds for chess. Visible to anyone who can manage matches
 * (the chess coordinator for their sport, or an administrator); the server
 * does the real authorisation.
 */
export function SwissRoundsPanel({ onGenerated }: { onGenerated?: () => void }) {
  const { hasPermission } = useAuth();
  const allowed = hasPermission('match.update') || hasPermission('competition.manage');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    try {
      const sports = (await apiAuthedGet<Sport[]>('/sports')).filter((s) => /chess/i.test(s.name));
      const lists = await Promise.all(
        sports.map((s) => apiAuthedGet<Tournament[]>(`/tournaments?sportId=${s.id}`)),
      );
      // A Swiss tournament has Swiss rounds, or is still empty (rounds not made yet).
      setTournaments(
        lists
          .flat()
          .filter(
            (t) =>
              (t.stages ?? []).some((st) => st.stageType === 'SWISS') ||
              (t._count?.matches ?? 0) === 0,
          ),
      );
      setVenues(await apiAuthedGet<Venue[]>('/venues'));
    } catch {
      setTournaments([]);
    }
  }, []);
  useEffect(() => {
    if (allowed) void Promise.resolve().then(load);
  }, [allowed, load, version]);

  // Only people whose role covers THIS chess sport (its coordinator) or who
  // hold a global grant (convener, overall coordinator). A coordinator of any
  // other sport never sees the panel; the server enforces the same rule.
  const visible = tournaments.filter((t) => {
    const scope = { sportId: t.sportId ?? t.sport?.id };
    return hasPermission('match.update', scope) || hasPermission('competition.manage', scope);
  });
  if (!allowed || visible.length === 0) return null;
  return (
    <div className="space-y-4 mb-8">
      <h2 className="text-xl font-black uppercase tracking-tight">
        Chess <span className="text-[#FFD700]">Swiss rounds</span>
      </h2>
      {visible.map((t) => (
        <SwissCard
          key={t.id}
          tournament={t}
          venues={venues}
          onGenerated={() => {
            setVersion((v) => v + 1);
            onGenerated?.();
          }}
        />
      ))}
    </div>
  );
}
