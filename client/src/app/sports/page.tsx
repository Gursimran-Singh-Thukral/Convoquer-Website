'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PublicPage } from '@/components/PublicPage';
import { apiGet, type Sport } from '@/lib/api';
export default function SportsDirectoryPage() {
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    apiGet<Sport[]>('/sports')
      .then(setSports)
      .catch(() => setError('Sports could not be loaded. Please try again.'))
      .finally(() => setLoading(false));
  }, []);
  return (
    <PublicPage title="Sports directory">
      <p className="text-gray-400 mb-8">
        Explore the published sports, teams, fixtures and tournament rules.
      </p>
      {loading ? (
        <p>Loading sports…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : !sports.length ? (
        <p>No sports have been published yet.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sports.map((sport) => (
            <article key={sport.id} className="rounded-xl border border-white/10 bg-[#1B191E] p-6">
              <p className="text-xs text-[#D4AF37] mb-3">{sport.status}</p>
              <h2 className="text-2xl font-display font-bold">{sport.name}</h2>
              <p className="text-gray-400 my-4">
                {sport.description || 'Details have not been published yet.'}
              </p>
              <Link
                className="text-[#D4AF37] underline"
                href={`/sports/${sport.name.toLowerCase().trim().replace(/\s+/g, '-')}`}
              >
                View teams and fixtures
              </Link>
            </article>
          ))}
        </div>
      )}
      <Link className="inline-block mt-8 underline" href="/rules">
        Official rules and resources
      </Link>
    </PublicPage>
  );
}
