'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PublicPage } from '@/components/PublicPage';
import { RequireOrganizer } from '@/components/RequireOrganizer';
import { useToast } from '@/components/ui/ToastProvider';
import { useAuth } from '@/lib/auth-context';
import { apiAuthedGet, apiPost, apiPatch, apiDelete } from '@/lib/api';

type EventRecord = {
  id: string;
  name: string;
  slug: string;
  edition: string;
  startDate: string;
  endDate: string;
  status: string;
  description?: string | null;
};
type Form = {
  name: string;
  slug: string;
  edition: string;
  startDate: string;
  endDate: string;
  status: string;
  description: string;
};
const blank: Form = {
  name: '',
  slug: '',
  edition: '',
  startDate: '',
  endDate: '',
  status: 'DRAFT',
  description: '',
};
function localTime(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function EventsContent() {
  const { hasPermission } = useAuth();
  const { confirm } = useToast();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [form, setForm] = useState<Form>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const load = useCallback(async () => {
    try {
      setEvents(await apiAuthedGet<EventRecord[]>('/events'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  function edit(event: EventRecord) {
    setEditing(event.id);
    setShowForm(true);
    setError('');
    setNotice('');
    setForm({
      name: event.name,
      slug: event.slug,
      edition: event.edition,
      status: event.status,
      description: event.description || '',
      startDate: localTime(event.startDate),
      endDate: localTime(event.endDate),
    });
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (Date.parse(form.endDate) <= Date.parse(form.startDate)) {
      setError('End date must be after start date.');
      return;
    }
    setBusy(true);
    try {
      const body = {
        ...form,
        name: form.name.trim(),
        slug: form.slug.trim(),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
      };
      if (editing) await apiPatch(`/events/${editing}`, body);
      else await apiPost('/events', body);
      setNotice(editing ? 'Event updated.' : 'Event created.');
      setEditing(null);
      setForm(blank);
      setShowForm(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function archive(event: EventRecord) {
    if (!(await confirm(`Archive ${event.name}? Its competition history will be retained.`)))
      return;
    setBusy(true);
    setError('');
    try {
      await apiPatch(`/events/${event.id}`, { status: 'ARCHIVED' });
      setNotice('Event archived.');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(event: EventRecord) {
    if (!(await confirm(`Delete ${event.name}? Only empty events can be deleted.`))) return;
    setBusy(true);
    setError('');
    try {
      await apiDelete(`/events/${event.id}`);
      setNotice('Event deleted.');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const input = 'block w-full bg-zinc-900 border border-white/20 rounded p-3 mt-1';
  const visible = events.filter((event) =>
    `${event.name} ${event.edition} ${event.slug}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <PublicPage title="Events dashboard" organizer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <p className="text-zinc-400">
          Manage event dates, details and publication status. Events with registrations or
          competitions can be archived.
        </p>
        {hasPermission('event.create', {}) && (
          <button
            className="bg-[#800020] px-5 py-3 rounded"
            disabled={busy}
            onClick={() => {
              setEditing(null);
              setForm(blank);
              setShowForm(true);
              setError('');
              setNotice('');
            }}
          >
            Create event
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-rose-300 border border-rose-400/30 p-4 rounded mb-5">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-emerald-300 mb-5">
          {notice}
        </p>
      )}
      {showForm && (
        <form
          aria-label="Event editor"
          onSubmit={save}
          className="border border-white/20 rounded-xl p-6 mb-8 space-y-4"
        >
          <h2 className="text-xl font-bold">{editing ? 'Edit event' : 'New event'}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              Event name
              <input
                required
                maxLength={500}
                className={input}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              URL slug
              <input
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                className={input}
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </label>
            <label>
              Edition
              <input
                required
                className={input}
                value={form.edition}
                onChange={(e) => setForm({ ...form, edition: e.target.value })}
              />
            </label>
            <label>
              Status
              <select
                className={input}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'].map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              Start date and time
              <input
                required
                type="datetime-local"
                className={input}
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </label>
            <label>
              End date and time
              <input
                required
                type="datetime-local"
                className={input}
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </label>
          </div>
          <label className="block">
            Description
            <textarea
              rows={4}
              maxLength={10000}
              className={input}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <div className="flex gap-4">
            <button disabled={busy} className="bg-[#800020] p-3 rounded">
              {busy ? 'Saving…' : 'Save event'}
            </button>
            <button
              type="button"
              disabled={busy}
              className="underline"
              onClick={() => setShowForm(false)}
            >
              Cancel editing
            </button>
          </div>
        </form>
      )}
      <label className="block mb-6">
        Search events
        <input
          type="search"
          className={input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {loading ? (
        <p>Loading events…</p>
      ) : !visible.length ? (
        <p>No events found.</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {visible.map((event) => (
            <article
              key={event.id}
              data-event-id={event.id}
              className="border border-white/15 bg-[#1B191E] rounded-xl p-6"
            >
              <p className="text-[#FFD700] text-xs">
                {event.status} · {event.edition}
              </p>
              <h2 className="text-2xl font-bold mt-2">{event.name}</h2>
              <p className="text-zinc-400 my-3 whitespace-pre-wrap">
                {event.description || 'No description supplied.'}
              </p>
              <p className="text-sm">
                {new Date(event.startDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} –{' '}
                {new Date(event.endDate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
              </p>
              <p className="text-xs text-zinc-500 mt-2">{event.slug}</p>
              <div className="flex flex-wrap gap-4 mt-5">
                {hasPermission('event.update', { eventId: event.id }) && (
                  <>
                    <button
                      disabled={busy}
                      className="underline text-[#FFD700]"
                      onClick={() => edit(event)}
                    >
                      Edit event
                    </button>
                    <button
                      disabled={busy || event.status === 'ARCHIVED'}
                      className="underline"
                      onClick={() => void archive(event)}
                    >
                      Archive event
                    </button>
                  </>
                )}
                {hasPermission('event.delete', { eventId: event.id }) && (
                  <button
                    disabled={busy}
                    className="underline text-rose-300"
                    onClick={() => void remove(event)}
                  >
                    Delete event
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-6 mt-8">
        <Link className="underline text-[#FFD700]" href="/sports/manager">
          Manage sports and venues
        </Link>
        <Link className="underline text-[#FFD700]" href="/tournaments">
          Manage tournaments
        </Link>
      </div>
    </PublicPage>
  );
}
export default function EventsDashboard() {
  return (
    <RequireOrganizer anyPermission={['event.create', 'event.update', 'event.delete']}>
      <EventsContent />
    </RequireOrganizer>
  );
}
