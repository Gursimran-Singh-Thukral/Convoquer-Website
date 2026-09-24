'use client';
import { useCallback, useEffect, useState } from 'react';
import { RequireOrganizer } from '@/components/RequireOrganizer';
import { PublicPage } from '@/components/PublicPage';
import { apiAuthedGet, apiPost, apiPatch } from '@/lib/api';
import type { ContentEntry } from '@/components/PublicContent';

function ContentManagerContent() {
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ kind: 'NEWS', title: '', body: '', linkUrl: '' });
  const load = useCallback(async () => {
    try {
      setEntries(await apiAuthedGet<ContentEntry[]>('/content/manage'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load content');
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiPost('/content', { ...form, linkUrl: form.linkUrl || undefined, status: 'DRAFT' });
      setForm({ kind: 'NEWS', title: '', body: '', linkUrl: '' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save');
    } finally {
      setBusy(false);
    }
  }
  async function publish(id: string, status: string) {
    setBusy(true);
    setError('');
    try {
      await apiPatch(`/content/${id}`, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update');
    } finally {
      setBusy(false);
    }
  }
  const inputClass = 'w-full rounded border border-white/20 bg-zinc-900 p-3';
  return (
    <PublicPage title="Official Content" organizer>
      <p className="mb-6 text-zinc-400">
        Create drafts for news, rules, approved contacts and committee information, then publish
        when ready.
      </p>
      {error && (
        <p role="alert" className="text-red-400 mb-4">
          {error}
        </p>
      )}
      <form onSubmit={submit} className="space-y-4 mb-10">
        <label className="block">
          Section
          <select
            className={inputClass}
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value })}
          >
            {['NEWS', 'RULES', 'CONTACT', 'COMMITTEE', 'FAQ'].map((kind) => (
              <option key={kind}>{kind}</option>
            ))}
          </select>
        </label>
        <label className="block">
          Title
          <input
            required
            maxLength={500}
            className={inputClass}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <label className="block">
          Text
          <textarea
            required
            maxLength={10000}
            rows={6}
            className={inputClass}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </label>
        <label className="block">
          Official document or website (optional)
          <input
            type="url"
            placeholder="https://"
            className={inputClass}
            value={form.linkUrl}
            onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
          />
        </label>
        <button disabled={busy} className="bg-[#800020] px-5 py-3 rounded">
          Save draft
        </button>
      </form>
      <div className="space-y-4">
        {entries.map((entry) => (
          <article className="border border-white/20 rounded p-5" key={entry.id}>
            <p className="text-xs text-[#FFD700]">
              {entry.kind} · {entry.status}
            </p>
            <h2 className="text-xl mb-2">{entry.title}</h2>
            <p className="whitespace-pre-wrap mb-3">{entry.body}</p>
            <button
              className="underline"
              disabled={busy}
              onClick={() =>
                publish(entry.id, entry.status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED')
              }
            >
              {entry.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
            </button>
          </article>
        ))}
      </div>
    </PublicPage>
  );
}

export default function ContentManager() {
  return (
    <RequireOrganizer anyPermission={['media.publish']}>
      <ContentManagerContent />
    </RequireOrganizer>
  );
}
