'use client';
import { useState } from 'react';
import { PublicPage } from '@/components/PublicPage';
import { RequireOrganizer } from '@/components/RequireOrganizer';
import { useAuth } from '@/lib/auth-context';
import { apiPost, ApiError } from '@/lib/api';
import { parseVolunteerCsv, type VolunteerImportRow } from '@/lib/csv';

// Mirrors server/src/common/department.ts's CANONICAL_DEPARTMENTS — a
// volunteer belongs to exactly one of these.
const CANONICAL_DEPARTMENTS = [
  'Security',
  'Media',
  'Sports',
  'Hospitality',
  'Web',
  'General Operations',
];

function AddSingleVolunteer({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [department, setDepartment] = useState(CANONICAL_DEPARTMENTS[5]);
  const [shift, setShift] = useState('MORNING');
  const [venueName, setVenueName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await apiPost('/volunteers', {
        name: name.trim(),
        email: email.trim(),
        contactNumber: contactNumber.trim() || undefined,
        department,
        shift,
        venueName: venueName.trim() || undefined,
      });
      setMessage(`Added "${name.trim()}" as a volunteer.`);
      setName('');
      setEmail('');
      setContactNumber('');
      setDepartment(CANONICAL_DEPARTMENTS[5]);
      setVenueName('');
      onAdded();
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Failed to add volunteer.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="border border-white/20 rounded p-4 my-5" open>
      <summary className="cursor-pointer font-bold">Add a single volunteer</summary>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <label className="text-sm">
          Name *
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="block w-full bg-zinc-900 border border-white/20 rounded p-2 mt-1"
          />
        </label>
        <label className="text-sm">
          Email *
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block w-full bg-zinc-900 border border-white/20 rounded p-2 mt-1"
          />
        </label>
        <label className="text-sm">
          Contact number
          <input
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
            className="block w-full bg-zinc-900 border border-white/20 rounded p-2 mt-1"
          />
        </label>
        <label className="text-sm">
          Department
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="block w-full bg-zinc-900 border border-white/20 rounded p-2 mt-1"
          >
            {CANONICAL_DEPARTMENTS.map((dep) => (
              <option key={dep} value={dep}>
                {dep}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Shift
          <select
            value={shift}
            onChange={(e) => setShift(e.target.value)}
            className="block w-full bg-zinc-900 border border-white/20 rounded p-2 mt-1"
          >
            <option value="MORNING">Morning</option>
            <option value="AFTERNOON">Afternoon</option>
            <option value="EVENING">Evening</option>
            <option value="NIGHT">Night</option>
          </select>
        </label>
        <label className="text-sm">
          Assigned venue (optional)
          <input
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            className="block w-full bg-zinc-900 border border-white/20 rounded p-2 mt-1"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            disabled={busy}
            type="submit"
            className="bg-[#800020] p-2.5 rounded disabled:opacity-40"
          >
            {busy ? 'Adding…' : 'Add volunteer'}
          </button>
        </div>
      </form>
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
    </details>
  );
}

// Role and department assignment happens in exactly one place — the RBAC
// Manager — which links a volunteer record to a login account, a role, and
// its department(s)/scope together. A second, separate form here used to let
// an admin type a department into a free-text field that was silently
// discarded server-side (no volunteer record to attach it to), which is
// exactly the "two places, conflicting behavior" this pointer replaces.
function AssignHead() {
  const { hasPermission } = useAuth();
  if (!hasPermission('role.assign')) return null;

  return (
    <div className="border border-white/20 rounded p-4 my-5">
      <p className="font-bold mb-1">Assign a role</p>
      <p className="text-sm text-zinc-400">
        Role and department assignment (Heads, Coordinators, Security/Sports/Media volunteers, and
        any custom scope) all happen in the{' '}
        <a className="text-[#FFD700] underline" href="/rbac">
          RBAC Manager
        </a>
        .
      </p>
    </div>
  );
}

function VolunteerImport() {
  const [rows, setRows] = useState<VolunteerImportRow[]>([]);
  const [sheetUrl, setSheetUrl] = useState('');
  const [validated, setValidated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function upload(file?: File) {
    setRows([]);
    setValidated(false);
    setMessage('');
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMessage('CSV must be smaller than 2 MB.');
      return;
    }
    setBusy(true);
    try {
      setRows(parseVolunteerCsv(await file.text()));
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loadSheet(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setValidated(false);
    setRows([]);
    setMessage('');
    try {
      const response = await apiPost<{ rows: VolunteerImportRow[] }>('/volunteers/import-sheet', {
        sheetUrl,
      });
      setRows(response.rows);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(dryRun: boolean) {
    setBusy(true);
    setMessage('');
    try {
      const result = await apiPost<{ created: number; updated: number }>('/volunteers/import', {
        rows,
        dryRun,
      });
      setValidated(dryRun);
      setMessage(
        `${dryRun ? 'Validated: would create' : 'Imported: created'} ${result.created}, ${dryRun ? 'update' : 'updated'} ${result.updated} volunteer(s).${dryRun ? ' No changes saved yet.' : ''}`,
      );
    } catch (error) {
      setValidated(false);
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <PublicPage title="Import volunteers" organizer>
      <AddSingleVolunteer onAdded={() => {}} />
      <AssignHead />
      <p className="mb-4 text-zinc-400">
        Or download the volunteer tab from Google Sheets as CSV and upload it below. Existing
        volunteers are matched by email, so repeat imports update their details without adding
        duplicates.
      </p>
      <p className="mb-4">
        Required columns: name, email. Optional: contactNumber, department, shift, venueName,
        venueId, status.
      </p>
      <a
        className="text-[#FFD700] underline"
        download="volunteers-template.csv"
        href="data:text/csv;charset=utf-8,name%2Cemail%2CcontactNumber%2Cdepartment%2Cshift%2CvenueName%2Cstatus%0A"
      >
        Download volunteer template
      </a>
      <label className="block my-5">
        Google Sheets CSV
        <input
          aria-label="Volunteer CSV"
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(e) => void upload(e.target.files?.[0])}
          className="block mt-2"
        />
      </label>
      <details className="border border-white/20 rounded p-4 my-5">
        <summary>Import from a readable Google Sheets link</summary>
        <p className="text-sm text-zinc-400 my-3">
          For an already-readable or published sheet, paste its link. For private volunteer/contact
          data, use CSV upload; changing sharing permissions is not necessary.
        </p>
        <form onSubmit={loadSheet} className="flex gap-3">
          <input
            aria-label="Google Sheets link"
            type="url"
            required
            value={sheetUrl}
            onChange={(e) => {
              setSheetUrl(e.target.value);
              setValidated(false);
            }}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="bg-zinc-900 border border-white/20 rounded p-3 flex-1 min-w-0"
          />
          <button disabled={busy} className="bg-zinc-700 rounded px-4">
            Load sheet
          </button>
        </form>
      </details>
      {message && (
        <p role="status" className="p-4 border border-[#FFD700]/40 rounded mb-4">
          {message}
        </p>
      )}
      <p>{rows.length} volunteer rows loaded</p>
      {!!rows.length && (
        <div className="overflow-auto max-h-96 my-4">
          <table className="w-full text-left">
            <thead>
              <tr>
                {['Name', 'Email', 'Department', 'Shift', 'Venue'].map((name) => (
                  <th key={name} className="p-2">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t border-white/10">
                  <td className="p-2">{row.name}</td>
                  <td>{row.email}</td>
                  <td>{row.department}</td>
                  <td>{row.shift}</td>
                  <td>{row.venueName || row.venueId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex gap-4 mt-5">
        <button
          disabled={busy || !rows.length}
          onClick={() => void submit(true)}
          className="bg-zinc-700 p-3 rounded disabled:opacity-40"
        >
          Validate volunteers
        </button>
        <button
          disabled={busy || !validated}
          onClick={() => void submit(false)}
          className="bg-[#800020] p-3 rounded disabled:opacity-40"
        >
          Import volunteers
        </button>
      </div>
    </PublicPage>
  );
}
export default function VolunteerImportPage() {
  return (
    <RequireOrganizer anyPermission={['volunteer.manage']}>
      <VolunteerImport />
    </RequireOrganizer>
  );
}
