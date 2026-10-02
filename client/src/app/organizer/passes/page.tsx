'use client';
import { useCallback, useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { OrganizerNavRail } from '@/components/OrganizerNavRail';
import { RequireOrganizer } from '@/components/RequireOrganizer';
import { apiAuthedGet, apiDelete } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface WalkIn {
  id: string;
  name: string;
  category: string;
  gender?: string | null;
  contactNumber?: string | null;
  rollNumber?: string | null;
  gatePassNumber: string | null;
  isCheckedIn: boolean;
  checkedInAt?: string | null;
  isFlagged?: boolean;
  flagReason?: string | null;
  createdAt: string;
  photographUrl?: string | null;
  idDocumentUrl?: string | null;
  institute?: { name: string; shortName: string | null } | null;
  otherInstitute?: string | null;
}

const when = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-widest text-zinc-400">{label}</dt>
      <dd className="font-medium break-words">{value || '—'}</dd>
    </div>
  );
}

function Picture({ src, label }: { src?: string | null; label: string }) {
  return (
    <figure className="space-y-2">
      <figcaption className="text-[11px] uppercase tracking-widest text-zinc-400">
        {label}
      </figcaption>
      {src ? (
        <a href={src} target="_blank" rel="noreferrer" title="Open full size">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={label}
            className="max-h-80 w-full rounded-lg border border-white/15 bg-black/40 object-contain"
          />
        </a>
      ) : (
        <p className="rounded-lg border border-dashed border-white/20 p-8 text-center text-zinc-500">
          Not provided
        </p>
      )}
    </figure>
  );
}

function Detail({
  pass,
  canDelete,
  busy,
  onClose,
  onDelete,
}: {
  pass: WalkIn;
  canDelete: boolean;
  busy: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label={`Pass of ${pass.name}`}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4"
    >
      <div className="my-6 w-full max-w-3xl space-y-5 rounded-2xl border border-white/20 bg-[#18161b] p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-sm text-[#FFD700]">{pass.gatePassNumber}</p>
            <h2 className="text-2xl font-bold">{pass.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-white/20 px-3 py-1"
          >
            Close
          </button>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          <Picture src={pass.photographUrl} label="Photograph" />
          <Picture src={pass.idDocumentUrl} label="ID document" />
        </div>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Name" value={pass.name} />
          <Field label="Phone / WhatsApp" value={pass.contactNumber} />
          <Field label="Category" value={pass.category} />
          <Field
            label="College / organisation"
            value={pass.institute?.name || pass.otherInstitute}
          />
          <Field label="ID number" value={pass.rollNumber} />
          <Field label="Gender" value={pass.gender} />
          <Field label="Registered" value={when(pass.createdAt)} />
          <Field
            label="Entered the venue"
            value={pass.isCheckedIn ? `Yes (${when(pass.checkedInAt)})` : 'No'}
          />
          <Field
            label="Security flag"
            value={pass.isFlagged ? `Flagged: ${pass.flagReason ?? ''}` : 'None'}
          />
        </dl>
        {canDelete && (
          <div className="border-t border-white/10 pt-4">
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className="rounded border border-red-400/60 px-4 py-2 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
            >
              Delete this pass
            </button>
            <p className="mt-1 text-xs text-zinc-500">
              Permanent. Only the administrator account can do this; it is logged.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PassesContent() {
  const { hasPermission } = useAuth();
  const canDelete = hasPermission('participant.update');
  const [rows, setRows] = useState<WalkIn[]>([]);
  const [category, setCategory] = useState('ALL');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<WalkIn | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (category !== 'ALL') params.set('category', category);
      if (query.trim()) params.set('query', query.trim());
      setRows(await apiAuthedGet<WalkIn[]>(`/participants/walk-ins?${params.toString()}`));
      setError(false);
      setMessage('');
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

  async function remove(row: WalkIn) {
    if (
      !window.confirm(
        `Delete the pass of ${row.name} (${row.gatePassNumber})? This permanently removes the visitor and cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    try {
      await apiDelete(`/participants/${row.id}`);
      setRows((all) => all.filter((r) => r.id !== row.id));
      setOpen(null);
      setError(false);
      setMessage(`Deleted ${row.name}.`);
    } catch (e) {
      setError(true);
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const input = 'bg-zinc-900 border border-white/20 rounded p-2';
  return (
    <>
      <Navbar />
      <OrganizerNavRail />
      <main className="mx-auto max-w-6xl space-y-5 p-6">
        <h1 className="text-3xl font-bold text-[#FFD700]">Walk-in passes</h1>
        <p className="text-zinc-400">
          Visitors who registered themselves at the gate. Open a row to see the full record:
          photograph, ID picture, phone number and college.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            aria-label="Search"
            placeholder="Search name, pass, phone, college…"
            className={`${input} w-80`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="Category"
            className={input}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="ALL">All visitors</option>
            <option value="AUDIENCE">Audience</option>
            <option value="GUEST">Guests</option>
          </select>
          <span className="text-sm text-zinc-400">{rows.length} shown</span>
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
                <th className="p-3">Photo</th>
                <th className="p-3">Name</th>
                <th className="p-3">Pass</th>
                <th className="p-3">Phone</th>
                <th className="p-3">College / organisation</th>
                <th className="p-3">Entered</th>
                <th className="p-3">Registered</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-4">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-zinc-400">
                    No walk-in passes{query ? ' match your search' : ' yet'}.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/10">
                    <td className="p-2">
                      {r.photographUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.photographUrl}
                          alt=""
                          className="h-12 w-12 rounded-full border border-white/20 object-cover"
                        />
                      ) : (
                        <span className="inline-block h-12 w-12 rounded-full bg-white/10" />
                      )}
                    </td>
                    <td className="p-3 font-semibold">{r.name}</td>
                    <td className="p-3 font-mono">{r.gatePassNumber}</td>
                    <td className="p-3">{r.contactNumber ?? '—'}</td>
                    <td className="p-3">
                      {r.institute?.shortName || r.institute?.name || r.otherInstitute || '—'}
                    </td>
                    <td className="p-3">{r.isCheckedIn ? 'Yes' : 'No'}</td>
                    <td className="p-3 text-zinc-400">{when(r.createdAt)}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setOpen(r)}
                        className="rounded border border-[#FFD700]/50 px-3 py-1 text-[#FFD700] hover:bg-[#FFD700]/10"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
      {open && (
        <Detail
          pass={open}
          canDelete={canDelete}
          busy={busy}
          onClose={() => setOpen(null)}
          onDelete={() => void remove(open)}
        />
      )}
    </>
  );
}

export default function PassesPage() {
  return (
    <RequireOrganizer requireRole={['WEB_DEV_HEAD']}>
      <PassesContent />
    </RequireOrganizer>
  );
}
