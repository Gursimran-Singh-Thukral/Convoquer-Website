'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { OrganizerNavRail } from '@/components/OrganizerNavRail';
import { RequireOrganizer } from '@/components/RequireOrganizer';
import { apiAuthedGet, apiDelete } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface PassRow {
  id: string;
  name: string;
  category: string;
  gatePassNumber: string | null;
  isCheckedIn: boolean;
  createdAt: string;
  photographUrl?: string | null;
  institute?: { name: string; shortName: string | null } | null;
}

const CATEGORIES = ['ALL', 'ATHLETE', 'AUDIENCE', 'GUEST', 'OFFICIAL'];

function PassesContent() {
  const { hasPermission } = useAuth();
  const canDelete = hasPermission('participant.update');
  const [rows, setRows] = useState<PassRow[]>([]);
  const [category, setCategory] = useState('ALL');
  const [query, setQuery] = useState('');
  const [onlyPasses, setOnlyPasses] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (category !== 'ALL') params.set('category', category);
      if (query.trim()) params.set('query', query.trim());
      setRows(await apiAuthedGet<PassRow[]>(`/participants?${params.toString()}`));
    } catch (e) {
      setError(true);
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [category, query]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const shown = useMemo(
    () => (onlyPasses ? rows.filter((r) => r.gatePassNumber) : rows),
    [rows, onlyPasses],
  );

  async function remove(row: PassRow) {
    if (
      !window.confirm(
        `Delete ${row.name}${row.gatePassNumber ? ` (pass ${row.gatePassNumber})` : ''}? This removes the person, their pass and team memberships and cannot be undone.`,
      )
    )
      return;
    setBusyId(row.id);
    setMessage('');
    setError(false);
    try {
      await apiDelete(`/participants/${row.id}`);
      setRows((all) => all.filter((r) => r.id !== row.id));
      setMessage(`Deleted ${row.name}.`);
    } catch (e) {
      setError(true);
      setMessage((e as Error).message);
    } finally {
      setBusyId('');
    }
  }

  const input = 'bg-zinc-900 border border-white/20 rounded p-2';
  return (
    <>
      <Navbar />
      <OrganizerNavRail />
      <main className="max-w-6xl mx-auto p-6 space-y-5">
        <h1 className="text-3xl font-bold text-[#FFD700]">Gate passes</h1>
        <p className="text-zinc-400">
          Everyone with a pass: players, officials and on-spot audience registrations.
          {canDelete
            ? ' Deleting is permanent and only available to the administrator account.'
            : ''}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            aria-label="Search"
            placeholder="Search name, roll number or pass"
            className={`${input} w-72`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="Category"
            className={input}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlyPasses}
              onChange={(e) => setOnlyPasses(e.target.checked)}
            />
            Only people with a pass
          </label>
          <span className="text-sm text-zinc-400">{shown.length} shown</span>
        </div>
        {message && (
          <p
            role={error ? 'alert' : 'status'}
            className={error ? 'text-red-300' : 'text-emerald-300'}
          >
            {message}
          </p>
        )}
        <div className="overflow-x-auto rounded-lg border border-white/15">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Pass</th>
                <th className="p-3">Category</th>
                <th className="p-3">College</th>
                <th className="p-3">Entered</th>
                <th className="p-3">Registered</th>
                {canDelete && <th className="p-3" />}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="p-4" colSpan={7}>
                    Loading…
                  </td>
                </tr>
              ) : shown.length === 0 ? (
                <tr>
                  <td className="p-4 text-zinc-400" colSpan={7}>
                    No passes match.
                  </td>
                </tr>
              ) : (
                shown.map((r) => (
                  <tr key={r.id} className="border-t border-white/10">
                    <td className="p-3 font-semibold">{r.name}</td>
                    <td className="p-3 font-mono">{r.gatePassNumber ?? '—'}</td>
                    <td className="p-3">{r.category}</td>
                    <td className="p-3">{r.institute?.shortName || r.institute?.name || '—'}</td>
                    <td className="p-3">{r.isCheckedIn ? 'Yes' : 'No'}</td>
                    <td className="p-3 text-zinc-400">
                      {new Date(r.createdAt).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    {canDelete && (
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void remove(r)}
                          className="rounded border border-red-400/50 px-3 py-1 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}

export default function PassesPage() {
  return (
    <RequireOrganizer anyPermission={['participant.view']}>
      <PassesContent />
    </RequireOrganizer>
  );
}
