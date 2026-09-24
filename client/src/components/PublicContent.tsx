import { apiGet } from '@/lib/api';

export interface ContentEntry {
  id: string;
  kind: string;
  title: string;
  body: string;
  linkUrl?: string | null;
  status?: string;
}

export async function PublicContent({ kind }: { kind: string }) {
  let entries: ContentEntry[];
  try {
    entries = await apiGet<ContentEntry[]>(`/content?kind=${kind}`);
  } catch {
    return (
      <p role="alert">This information is temporarily unavailable. Please try again shortly.</p>
    );
  }
  if (!entries.length)
    return (
      <p className="text-zinc-400">
        Official information will appear here once published by the organizing team.
      </p>
    );
  return (
    <div className="space-y-6">
      {entries.map((entry) => (
        <article key={entry.id} className="rounded-xl border border-white/15 p-6">
          <h2 className="text-2xl font-semibold mb-3">{entry.title}</h2>
          <p className="whitespace-pre-wrap leading-relaxed text-zinc-300">{entry.body}</p>
          {entry.linkUrl && (
            <a
              className="inline-block text-[#FFD700] underline mt-4"
              href={entry.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open official resource
            </a>
          )}
        </article>
      ))}
    </div>
  );
}
