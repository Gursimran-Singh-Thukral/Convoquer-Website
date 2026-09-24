import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FixtureResultEditor } from '@/components/FixtureResultEditor';
import { GoogleCampusMap } from '@/components/GoogleCampusMap';
import type { Match } from '@/lib/api';
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ hasPermission: () => true }) }));
afterEach(() => {
  vi.unstubAllEnvs();
  Reflect.deleteProperty(window, 'google');
});

it('switches to results-only and submits final scores without any live lifecycle requests', async () => {
  const requests: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      requests.push(`${init.method} ${url}`);
      if (init.method === 'PATCH')
        expect(JSON.parse(String(init.body))).toEqual({ scoringMode: 'RESULT_ONLY' });
      else expect(JSON.parse(String(init.body))).toMatchObject({ finalScoreA: 3, finalScoreB: 2 });
      return new Response('{}', { status: 200 });
    }),
  );
  const onSaved = vi.fn();
  const match = {
    id: 'fixture',
    scoringMode: 'LIVE',
    status: 'SCHEDULED',
    teamAId: 'a',
    teamBId: 'b',
    teamA: { id: 'a', name: 'A' },
    teamB: { id: 'b', name: 'B' },
  } as Match;
  render(<FixtureResultEditor match={match} onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText('Scoring mode'), { target: { value: 'RESULT_ONLY' } });
  await waitFor(() => expect(screen.queryByText('Open live scorer')).not.toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('Team A final score'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Team B final score'), { target: { value: '2' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Enter final result' }));
  await screen.findByText(/Final result submitted for approval/);
  expect(requests).toHaveLength(2);
  expect(requests[0]).toMatch(/PATCH .*\/matches\/fixture$/);
  expect(requests[1]).toMatch(/POST .*\/matches\/fixture\/result$/);
  expect(onSaved).toHaveBeenCalledTimes(2);
});

it('shows an IIT Jammu Google map without an API key', () => {
  vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', '');
  render(<GoogleCampusMap onSelect={vi.fn()} />);
  expect(screen.getByTitle('IIT Jammu Google Map')).toHaveAttribute(
    'src',
    expect.stringContaining('IIT%20Jammu%20Jagti%20Campus'),
  );
  expect(screen.getByText(/Pin selection is unavailable/)).toBeVisible();
});

it('centers the configured map on IIT Jammu and returns clicked geographic coordinates', async () => {
  vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'test-key-not-a-real-credential');
  const listener = vi.fn(() => ({ remove: vi.fn() }));
  const makeMap = vi.fn();
  class FakeMap {
    constructor(element: HTMLElement, options: unknown) {
      makeMap(element, options);
    }
    addListener = listener;
  }
  Object.assign(window, {
    google: {
      maps: {
        Map: FakeMap,
        marker: {
          AdvancedMarkerElement: class {
            map = null;
          },
        },
      },
    },
  });
  const onSelect = vi.fn();
  render(<GoogleCampusMap onSelect={onSelect} />);
  await waitFor(() => expect(listener).toHaveBeenCalled());
  expect(makeMap).toHaveBeenCalledWith(
    expect.any(HTMLElement),
    expect.objectContaining({ center: { lat: 32.8018222, lng: 74.8952306 } }),
  );
  const callback = (listener.mock.calls[0] as unknown as [string, (event: unknown) => void])[1];
  callback({ latLng: { lat: () => 32.802, lng: () => 74.896 } });
  expect(onSelect).toHaveBeenCalledWith({ latitude: 32.802, longitude: 74.896 });
});

it('shows each backend venue name directly on its map pin', async () => {
  vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'test-key-not-a-real-credential');
  const markerOptions: Record<string, unknown>[] = [];
  class FakeMap {
    addListener = vi.fn(() => ({ remove: vi.fn() }));
  }
  Object.assign(window, {
    google: {
      maps: {
        Map: FakeMap,
        marker: {
          AdvancedMarkerElement: class {
            map = null;
            constructor(options: Record<string, unknown>) {
              markerOptions.push(options);
            }
          },
        },
      },
    },
  });

  render(
    <GoogleCampusMap
      venues={[
        { id: 'football-ground', name: 'Football Ground', latitude: 32.802, longitude: 74.896 },
        { id: 'indoor-arena', name: 'Indoor Arena', latitude: 32.803, longitude: 74.897 },
      ]}
    />,
  );

  await waitFor(() => expect(markerOptions).toHaveLength(2));
  expect(markerOptions.map((options) => (options.content as HTMLElement).textContent)).toEqual([
    'Football Ground',
    'Indoor Arena',
  ]);
});
