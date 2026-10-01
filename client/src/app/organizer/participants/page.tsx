'use client';
import { useCallback, useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { OrganizerNavRail } from '@/components/OrganizerNavRail';
import { RequireOrganizer } from '@/components/RequireOrganizer';
import { apiAuthedGet, apiDelete, apiPatch, apiPost, type Sport } from '@/lib/api';

interface Person {
  id: string;
  name: string;
  gender?: string | null;
  category: string;
  rollNumber?: string | null;
  institute?: { name: string; shortName: string | null } | null;
  teamMembers?: { team: { id: string; name: string; sport?: { id: string; name: string } } }[];
}

const input = 'bg-zinc-900 border border-white/20 rounded p-2';

function Editor({
  person,
  sports,
  onChanged,
  onClose,
}: {
  person: Person;
  sports: Sport[];
  onChanged: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(person.name);
  const [gender, setGender] = useState(person.gender ?? '');
  const [category, setCategory] = useState(person.category);
  const [sportId, setSportId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setMessage('');
    setError(false);
    try {
      await work();
      setMessage(ok);
      onChanged();
    } catch (e) {
      setError(true);
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-label={`Edit ${person.name}`}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4"
    >
      <div className="my-6 w-full max-w-xl space-y-5 rounded-2xl border border-white/20 bg-[#18161b] p-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">{person.name}</h2>
            <p className="text-sm text-zinc-400">
              {person.institute?.shortName || person.institute?.name || 'No college'}
              {person.rollNumber ? ` · ${person.rollNumber}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-white/20 px-3 py-1"
          >
            Close
          </button>
        </header>

        <section className="space-y-3">
          <h3 className="font-bold text-[#FFD700]">Profile</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm sm:col-span-3">
              Name
              <input
                aria-label="Name"
                className={`${input} mt-1 w-full`}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Gender
              <select
                aria-label="Gender"
                className={`${input} mt-1 w-full`}
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="">—</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </label>
            <label className="text-sm">
              Category
              <select
                aria-label="Category"
                className={`${input} mt-1 w-full`}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {['ATHLETE', 'OFFICIAL', 'GUEST', 'AUDIENCE'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() =>
              void run(
                () =>
                  apiPatch(`/participants/${person.id}`, {
                    name: name.trim(),
                    gender: gender || undefined,
                    category,
                  }),
                'Profile saved.',
              )
            }
            className="rounded bg-[#800020] px-4 py-2 disabled:opacity-50"
          >
            Save profile
          </button>
        </section>

        <section className="space-y-3">
          <h3 className="font-bold text-[#FFD700]">Sports</h3>
          <ul className="space-y-1">
            {(person.teamMembers ?? []).length === 0 && (
              <li className="text-sm text-zinc-400">No sport yet.</li>
            )}
            {(person.teamMembers ?? []).map((m) => (
              <li
                key={m.team.id}
                className="flex items-center justify-between gap-3 rounded border border-white/10 px-3 py-2 text-sm"
              >
                <span>{m.team.name}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => apiDelete(`/participants/${person.id}/sports/${m.team.id}`),
                      `Removed from ${m.team.name}.`,
                    )
                  }
                  className="text-red-300 underline disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Sport"
              className={input}
              value={sportId}
              onChange={(e) => setSportId(e.target.value)}
            >
              <option value="">Choose sport…</option>
              {sports
                .filter((s) => !/e-?sports/i.test(s.name))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={busy || !sportId}
              onClick={() =>
                void run(async () => {
                  await apiPost(`/participants/${person.id}/sports`, { sportId });
                  setSportId('');
                }, 'Sport added. The college team was created if it did not exist.')
              }
              className="rounded bg-[#800020] px-4 py-2 disabled:opacity-50"
            >
              Add to sport
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            The person joins their college&apos;s team for that sport (for example “IIT Mandi
            Athletics”). For men&apos;s and women&apos;s sports, choose the right one. E-Sports
            teams are added by the coordinator on the result form.
          </p>
        </section>

        {message && (
          <p
            role={error ? 'alert' : 'status'}
            className={error ? 'text-red-300' : 'text-emerald-300'}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

function ParticipantsContent() {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Person[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (query.trim().length < 2) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const list = await apiAuthedGet<Person[]>(
        `/participants?query=${encodeURIComponent(query.trim())}`,
      );
      setRows(list.slice(0, 60));
      setMessage('');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 300);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => {
    apiAuthedGet<Sport[]>('/sports')
      .then(setSports)
      .catch(() => setSports([]));
  }, []);

  const person = rows.find((r) => r.id === open) ?? null;
  return (
    <>
      <Navbar />
      <OrganizerNavRail />
      <main className="mx-auto max-w-5xl space-y-5 p-6">
        <h1 className="text-3xl font-bold text-[#FFD700]">Participants</h1>
        <p className="text-zinc-400">
          Find someone by name, roll number or pass, then fix their details or give them a sport.
          Useful when a contingent was imported without sports.
        </p>
        <input
          aria-label="Search participants"
          placeholder="Type at least 2 letters of a name or roll number…"
          className={`${input} w-full sm:w-96`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {message && (
          <p role="alert" className="text-red-300">
            {message}
          </p>
        )}
        <div className="overflow-x-auto rounded-lg border border-white/15">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">College</th>
                <th className="p-3">Sports</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {query.trim().length < 2 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-zinc-400">
                    Start typing to search.
                  </td>
                </tr>
              ) : loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4">
                    Searching…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-zinc-400">
                    Nobody matches.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/10">
                    <td className="p-3 font-semibold">{r.name}</td>
                    <td className="p-3">{r.institute?.shortName || r.institute?.name || '—'}</td>
                    <td className="p-3 text-zinc-300">
                      {(r.teamMembers ?? [])
                        .map((m) => m.team.sport?.name ?? m.team.name)
                        .join(', ') || <span className="text-zinc-500">none</span>}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setOpen(r.id)}
                        className="rounded border border-[#FFD700]/50 px-3 py-1 text-[#FFD700] hover:bg-[#FFD700]/10"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
      {person && (
        <Editor
          person={person}
          sports={sports}
          onChanged={() => void load()}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

export default function ParticipantsPage() {
  return (
    <RequireOrganizer anyPermission={['participant.update']}>
      <ParticipantsContent />
    </RequireOrganizer>
  );
}
