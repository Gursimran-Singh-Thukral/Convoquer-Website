'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { OrganizerNavRail } from '@/components/OrganizerNavRail';
import { RequireOrganizer } from '@/components/RequireOrganizer';
import { apiAuthedGet, apiPost, type EventSummary } from '@/lib/api';
import { parseParticipantCsv, type ImportRow } from '@/lib/csv';

function ImportContent() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [eventId, setEventId] = useState('');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [validated, setValidated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    apiAuthedGet<EventSummary[]>('/events')
      .then(setEvents)
      .catch((e) => setMessage(e.message));
  }, []);
  async function upload(file?: File) {
    setValidated(false);
    setRows([]);
    setMessage('');
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMessage('CSV must be smaller than 2 MB');
      return;
    }
    try {
      setRows(parseParticipantCsv(await file.text()));
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function submit(dryRun: boolean) {
    setBusy(true);
    setMessage('');
    try {
      const result = await apiPost<{ importedCount: number }>('/participants/import', {
        eventId,
        rows,
        dryRun,
      });
      setValidated(dryRun);
      setMessage(
        dryRun
          ? `Validation passed for ${rows.length} rows. Review the preview, then import.`
          : `Imported ${result.importedCount} rows successfully. Teams and participant passes are ready.`,
      );
    } catch (e) {
      setValidated(false);
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Navbar />
      <OrganizerNavRail />
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold text-[#FFD700]">Import teams and participants</h1>
        <p>
          In Google Sheets, choose File → Download → Comma-separated values (.csv). Create the sport
          first. Existing institute and roll number pairs are reused, so importing the same sheet
          again does not duplicate participants.
        </p>
        <p className="text-zinc-400">
          Required headers: name, college, rollNumber. Optional: sport, gender, contactNumber, role,
          category. Each sport creates or reuses the institute’s team.
        </p>
        <a
          className="underline text-[#FFD700]"
          download="participants-template.csv"
          href="data:text/csv;charset=utf-8,name%2Ccollege%2CrollNumber%2Csport%2Cgender%2CcontactNumber%2Crole%2Ccategory%0A"
        >
          Download blank template
        </a>
        <label className="block">
          Event
          <select
            aria-label="Import event"
            className="block bg-zinc-900 p-3 border border-white/20 rounded w-full"
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value);
              setValidated(false);
            }}
          >
            {<option value="">Choose event</option>}
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Google Sheets CSV
          <input
            aria-label="Google Sheets CSV"
            className="block my-2"
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(e) => void upload(e.target.files?.[0])}
          />
        </label>
        {message && (
          <p role="status" className="border border-[#FFD700]/40 p-4 rounded">
            {message}
          </p>
        )}
        <p>{rows.length} rows loaded</p>
        {!!rows.length && (
          <div className="overflow-auto max-h-96">
            <table className="w-full text-left">
              <thead>
                <tr>
                  {['Name', 'College', 'Roll number', 'Sport'].map((h) => (
                    <th key={h} className="p-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t border-white/10">
                    <td className="p-2">{row.name}</td>
                    <td>{row.college}</td>
                    <td>{row.rollNumber}</td>
                    <td>{row.sport}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex gap-4">
          <button
            disabled={busy || !eventId || !rows.length}
            onClick={() => void submit(true)}
            className="bg-zinc-700 p-3 rounded disabled:opacity-40"
          >
            Validate import
          </button>
          <button
            disabled={busy || !validated}
            onClick={() => void submit(false)}
            className="bg-[#800020] p-3 rounded disabled:opacity-40"
          >
            Import participants
          </button>
        </div>
      </main>
    </>
  );
}
export default function ImportPage() {
  return (
    <RequireOrganizer anyPermission={['participant.create']}>
      <ImportContent />
    </RequireOrganizer>
  );
}
