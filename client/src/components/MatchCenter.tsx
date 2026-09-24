'use client';
import { useEffect, useState } from 'react';
import { apiGet, getApiBaseUrl, type LiveMatchDetail } from '@/lib/api';

export function MatchCenter({ id }: { id: string }) {
  const [match, setMatch] = useState<LiveMatchDetail | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    const load = async () => {
      try {
        const value = await apiGet<LiveMatchDetail>(`/matches/${encodeURIComponent(id)}/live`);
        if (!disposed) {
          setMatch(value);
          setError('');
        }
      } catch {
        if (!disposed) setError('Live updates are temporarily unavailable. Retrying shortly.');
      }
    };
    void load();
    const stream = new EventSource(`${getApiBaseUrl()}/realtime/matches/${encodeURIComponent(id)}`);
    for (const event of ['match.score.updated', 'match.status.updated', 'result.published'])
      stream.addEventListener(event, load);
    stream.onopen = load;
    const poll = setInterval(load, 15000);
    return () => {
      disposed = true;
      stream.close();
      clearInterval(poll);
    };
  }, [id]);
  return (
    <div>
      {error && (
        <p role="alert" className="text-amber-300 mb-4">
          {error}
        </p>
      )}
      {!match ? (
        <p>Loading match…</p>
      ) : (
        <>
          <p className="text-[#FFD700]">
            {match.tournament?.name} · {match.status}
          </p>
          <div aria-live="polite" className="grid grid-cols-2 gap-6 text-center py-10">
            <div>
              <h2>{match.teamA?.name || 'TBD'}</h2>
              <strong className="text-6xl">{match.teamAScore ?? '?'}</strong>
            </div>
            <div>
              <h2>{match.teamB?.name || 'TBD'}</h2>
              <strong className="text-6xl">{match.teamBScore ?? '?'}</strong>
            </div>
          </div>
          <p>
            {match.currentPeriod} · {match.venue?.name || 'Venue to be announced'}
          </p>
          <p className="text-zinc-400 mt-4">
            {match.resultPublished
              ? 'Official result approved and published.'
              : 'Scores are provisional until the result is approved and published.'}
          </p>
          <h2 className="text-xl mt-8 mb-4">Latest events</h2>
          <ol className="space-y-2">
            {match.scoreEvents?.map((event) => (
              <li key={event.id}>
                {event.team?.name} · {event.eventType.replaceAll('_', ' ')} · {event.points} points
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
