'use client';
import { useEffect, useRef, useState } from 'react';

export type MapPoint = { latitude: number; longitude: number };
// IIT Jammu's published Jagti campus site plan: 32°48'6.56"N, 74°53'42.83"E.
const CAMPUS = { lat: 32.8018222, lng: 74.8952306 };
type Listener = { remove: () => void };
type MapInstance = {
  addListener: (
    name: string,
    callback: (event: { latLng?: { lat: () => number; lng: () => number } }) => void,
  ) => Listener;
  panTo: (position: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
};
type MarkerInstance = { map: MapInstance | null };
type MapsApi = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => MapInstance;
  marker: { AdvancedMarkerElement: new (options: Record<string, unknown>) => MarkerInstance };
};
type MapsWindow = Window & {
  google?: { maps: MapsApi };
  __convoquerMapReady?: () => void;
  gm_authFailure?: () => void;
};
let mapsPromise: Promise<MapsApi> | undefined;

function createYouAreHereMarker() {
  const wrap = document.createElement('div');
  wrap.setAttribute('aria-label', 'Your current location');
  wrap.style.cssText =
    'display:flex;align-items:center;justify-content:center;width:22px;height:22px;position:relative;';
  const pulse = document.createElement('span');
  pulse.style.cssText = [
    'position:absolute',
    'width:22px',
    'height:22px',
    'border-radius:50%',
    'background:rgba(66,133,244,0.35)',
    'animation:convoquer-pulse 1.6s ease-out infinite',
  ].join(';');
  const dot = document.createElement('span');
  dot.style.cssText = [
    'width:12px',
    'height:12px',
    'border-radius:50%',
    'background:#4285F4',
    'border:2px solid #ffffff',
    'box-shadow:0 1px 4px rgba(0,0,0,.5)',
  ].join(';');
  if (!document.getElementById('convoquer-map-pulse-style')) {
    const style = document.createElement('style');
    style.id = 'convoquer-map-pulse-style';
    style.textContent =
      '@keyframes convoquer-pulse{0%{transform:scale(0.6);opacity:0.9}100%{transform:scale(2.2);opacity:0}}';
    document.head.appendChild(style);
  }
  wrap.append(pulse, dot);
  return wrap;
}

function createMarkerLabel(name: string, selected = false) {
  const marker = document.createElement('div');
  marker.setAttribute('aria-label', name);
  marker.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:6px',
    'max-width:220px',
    'padding:7px 10px',
    'border-radius:9999px',
    `background:${selected ? '#FFD700' : '#18161b'}`,
    `color:${selected ? '#111111' : '#ffffff'}`,
    `border:2px solid ${selected ? '#18161b' : '#FFD700'}`,
    'box-shadow:0 3px 10px rgba(0,0,0,.55)',
    'font:700 12px/1.2 system-ui,sans-serif',
    'white-space:nowrap',
  ].join(';');

  const dot = document.createElement('span');
  dot.style.cssText = [
    'width:9px',
    'height:9px',
    'flex:none',
    'border-radius:50%',
    `background:${selected ? '#800020' : '#FFD700'}`,
  ].join(';');
  const label = document.createElement('span');
  label.style.cssText = 'overflow:hidden;text-overflow:ellipsis';
  label.textContent = name;
  marker.append(dot, label);
  return marker;
}

function loadMaps(key: string): Promise<MapsApi> {
  const target = window as MapsWindow;
  if (target.google?.maps.marker) return Promise.resolve(target.google.maps);
  if (!mapsPromise)
    mapsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(
        () =>
          reject(
            new Error('Google Maps did not load. Check your connection and map configuration.'),
          ),
        20000,
      );
      target.__convoquerMapReady = () => {
        clearTimeout(timer);
        if (target.google) resolve(target.google.maps);
      };
      target.gm_authFailure = () => {
        clearTimeout(timer);
        window.dispatchEvent(new Event('convoquer-map-auth-error'));
        reject(
          new Error(
            'Google Maps authorization failed. Check the API key, billing and allowed website addresses.',
          ),
        );
      };
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&libraries=marker&callback=__convoquerMapReady&v=weekly`;
      script.async = true;
      script.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Unable to load Google Maps.'));
      };
      document.head.appendChild(script);
    });
  return mapsPromise;
}

export function GoogleCampusMap({
  point,
  venues = [],
  onSelect,
}: {
  point?: MapPoint | null;
  venues?: Array<{ id: string; name: string; latitude?: number | null; longitude?: number | null }>;
  onSelect?: (point: MapPoint) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');
  const mapRef = useRef<MapInstance | null>(null);
  const apiRef = useRef<MapsApi | null>(null);
  const meMarkerRef = useRef<MarkerInstance | null>(null);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const latitude = point?.latitude,
    longitude = point?.longitude;
  const serializedVenues = JSON.stringify(
    venues.map((v) => ({ id: v.id, name: v.name, latitude: v.latitude, longitude: v.longitude })),
  );
  useEffect(() => {
    if (!key || !element.current) return;
    let disposed = false;
    let listener: Listener | undefined;
    const markers: MarkerInstance[] = [];
    const authFailed = () =>
      setError('Google Maps authorization failed. Check the map configuration.');
    window.addEventListener('convoquer-map-auth-error', authFailed);
    void loadMaps(key)
      .then((api) => {
        if (disposed || !element.current) return;
        const center =
          latitude != null && longitude != null ? { lat: latitude, lng: longitude } : CAMPUS;
        const map = new api.Map(element.current, {
          center,
          zoom: 17,
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID',
          mapTypeId: 'hybrid',
          streetViewControl: false,
          gestureHandling: 'cooperative',
        });
        mapRef.current = map;
        apiRef.current = api;
        const pins = JSON.parse(serializedVenues) as typeof venues;
        let selectedVenueFound = false;
        for (const pin of pins) {
          if (pin.latitude != null && pin.longitude != null) {
            const isSelected =
              latitude != null &&
              longitude != null &&
              Math.abs(pin.latitude - latitude) < 0.000001 &&
              Math.abs(pin.longitude - longitude) < 0.000001;
            selectedVenueFound ||= isSelected;
            markers.push(
              new api.marker.AdvancedMarkerElement({
                map,
                position: { lat: pin.latitude, lng: pin.longitude },
                title: pin.name,
                content: createMarkerLabel(pin.name, isSelected),
                zIndex: isSelected ? 2 : 1,
              }),
            );
          }
        }
        if (latitude != null && longitude != null && !selectedVenueFound)
          markers.push(
            new api.marker.AdvancedMarkerElement({
              map,
              position: center,
              title: 'Selected venue location',
              content: createMarkerLabel('Selected location', true),
              zIndex: 2,
            }),
          );
        setReady(true);
        if (onSelect)
          listener = map.addListener('click', (event) => {
            if (event.latLng)
              onSelect({ latitude: event.latLng.lat(), longitude: event.latLng.lng() });
          });
      })
      .catch((reason) => {
        if (!disposed) setError((reason as Error).message);
      });
    return () => {
      disposed = true;
      window.removeEventListener('convoquer-map-auth-error', authFailed);
      listener?.remove();
      for (const marker of markers) marker.map = null;
      if (meMarkerRef.current) meMarkerRef.current.map = null;
      meMarkerRef.current = null;
      mapRef.current = null;
      apiRef.current = null;
    };
  }, [key, latitude, longitude, serializedVenues, onSelect]);

  const locateMe = () => {
    if (!navigator.geolocation) {
      setLocateError('Geolocation is not supported by this browser.');
      return;
    }
    setLocating(true);
    setLocateError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const here = { lat: position.coords.latitude, lng: position.coords.longitude };
        const map = mapRef.current;
        const api = apiRef.current;
        if (!map || !api) return;
        if (meMarkerRef.current) meMarkerRef.current.map = null;
        meMarkerRef.current = new api.marker.AdvancedMarkerElement({
          map,
          position: here,
          title: 'You are here',
          content: createYouAreHereMarker(),
          zIndex: 3,
        });
        map.panTo(here);
        map.setZoom(18);
      },
      (geoError) => {
        setLocating(false);
        setLocateError(
          geoError.code === geoError.PERMISSION_DENIED
            ? 'Location access denied — enable it in your browser settings to see your position on the map.'
            : 'Could not determine your location.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const query =
    latitude != null && longitude != null ? `${latitude},${longitude}` : 'IIT Jammu Jagti Campus';
  return (
    <div className="space-y-2">
      {key && !ready && !error && (
        <p role="status" className="text-sm text-zinc-400">
          Loading Google Maps...
        </p>
      )}
      {key && !error ? (
        <div className="relative">
          <div
            ref={element}
            aria-label={onSelect ? 'Select venue location on Google Maps' : 'IIT Jammu venue map'}
            className="h-[400px] w-full rounded-xl overflow-hidden bg-zinc-900"
          />
          {ready && (
            <button
              type="button"
              onClick={locateMe}
              disabled={locating}
              className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#18161b] border border-[#FFD700]/40 text-[#FFD700] text-xs font-bold uppercase tracking-wider shadow-lg hover:bg-[#232025] disabled:opacity-60 transition-colors"
            >
              {locating ? 'Locating…' : 'Locate Me'}
            </button>
          )}
        </div>
      ) : (
        <iframe
          title="IIT Jammu Google Map"
          src={`https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=17&output=embed`}
          className="h-[400px] w-full rounded-xl border-0"
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}
      {error && (
        <p role="alert" className="text-amber-300 text-sm">
          {error}
        </p>
      )}
      {locateError && (
        <p role="alert" className="text-amber-300 text-sm">
          {locateError}
        </p>
      )}
      {onSelect && (
        <p className="text-xs text-zinc-400">
          {key && !error
            ? 'Click the map to place the venue pin. The location is captured automatically.'
            : 'Pin selection is unavailable until the Google Maps API key is configured. Ask the site administrator to enable it.'}
        </p>
      )}
      <a
        className="text-sm underline text-[#FFD700]"
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open in Google Maps
      </a>
    </div>
  );
}
