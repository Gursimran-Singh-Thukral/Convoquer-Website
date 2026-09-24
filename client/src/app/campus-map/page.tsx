'use client';
import { useEffect, useState } from 'react';
import { PublicPage } from '@/components/PublicPage';
import { GoogleCampusMap } from '@/components/GoogleCampusMap';
import { apiGet, type Venue } from '@/lib/api';
export default function CampusMapPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void apiGet<Venue[]>('/venues?status=ACTIVE')
      .then((data) => {
        if (active) setVenues(data);
      })
      .catch(() => {
        if (active) setError('Unable to load venue locations.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const venue = venues.find((item) => item.id === selected);
  const point =
    venue?.latitude != null && venue.longitude != null
      ? { latitude: venue.latitude, longitude: venue.longitude }
      : null;
  return (
    <PublicPage title="Campus & venue map">
      <p className="text-zinc-400 mb-5">
        IIT Jammu, Jagti campus. Select a venue to view its saved location.
      </p>
      <GoogleCampusMap venues={venues} point={point} />
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p>Loading venues?</p>
      ) : !venues.length ? (
        <p className="my-5">No venues have been published yet.</p>
      ) : (
        <div className="grid sm:grid-cols-3 gap-4 mt-6">
          {venues.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item.id)}
              aria-pressed={selected === item.id}
              className="text-left border border-white/20 rounded-xl p-5"
            >
              <h2 className="font-bold text-[#FFD700]">{item.name}</h2>
              <p>{item.location || 'Location description not supplied.'}</p>
              <p className="text-sm text-zinc-400">
                {item.latitude != null && item.longitude != null
                  ? `${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}`
                  : 'Map pin not set yet.'}
              </p>
            </button>
          ))}
        </div>
      )}
    </PublicPage>
  );
}
