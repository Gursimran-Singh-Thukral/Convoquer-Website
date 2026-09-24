'use client';
import { GoogleCampusMap } from './GoogleCampusMap';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet, type Venue } from '@/lib/api';
export function CampusMasterplanSection() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    apiGet<Venue[]>('/venues')
      .then(setVenues)
      .catch(() => setError('Venue locations could not be loaded.'));
  }, []);
  return (
    <section className="py-12 border-b border-white/10" id="masterplan">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-display font-bold text-[#FFD700]">Campus & venue locations</h2>
        <p className="text-zinc-400 my-4">Locations published by the organizing team.</p>
        <GoogleCampusMap venues={venues} />
        {error ? (
          <p role="alert">{error}</p>
        ) : !venues.length ? (
          <p>No venue locations have been published yet.</p>
        ) : (
          <div className="grid sm:grid-cols-3 gap-4">
            {venues.map((venue) => (
              <article className="border border-white/15 p-5 rounded-xl" key={venue.id}>
                <h3 className="font-bold">{venue.name}</h3>
                <p>{venue.location || 'Location not published'}</p>
              </article>
            ))}
          </div>
        )}
        <Link className="inline-block underline text-[#FFD700] mt-6" href="/campus-map">
          Open campus map
        </Link>
      </div>
    </section>
  );
}
