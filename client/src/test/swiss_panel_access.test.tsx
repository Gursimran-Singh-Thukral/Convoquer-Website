import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SwissRoundsPanel } from '@/components/SwissRoundsPanel';

// A permission check like the real one: global grant, or a grant scoped to a sport.
const mockAuth = (grants: { global?: boolean; sportIds?: string[] }) => ({
  hasPermission: (_action: string, scope?: { sportId?: string }) =>
    !!grants.global ||
    (!scope
      ? !!grants.sportIds?.length
      : !!scope.sportId && !!grants.sportIds?.includes(scope.sportId)),
});
let auth = mockAuth({});
vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth }));

afterEach(() => vi.unstubAllGlobals());

function stubApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body = url.includes('/sports')
        ? [
            { id: 'chess-m', name: 'Chess (Men)' },
            { id: 'athl', name: 'Athletics' },
          ]
        : url.includes('/tournaments')
          ? [
              {
                id: 't1',
                name: 'Chess (Men) Championship',
                format: 'LEAGUE',
                sportId: 'chess-m',
                sport: { id: 'chess-m', name: 'Chess (Men)' },
                stages: [],
                seeds: [],
                _count: { matches: 0 },
              },
            ]
          : url.includes('/venues')
            ? [{ id: 'v', name: 'Student Activity Centre', simultaneousMatches: 3 }]
            : [];
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

it('shows the Swiss panel to the chess coordinator', async () => {
  auth = mockAuth({ sportIds: ['chess-m'] });
  stubApi();
  render(<SwissRoundsPanel />);
  expect(await screen.findByText(/Swiss rounds/i)).toBeInTheDocument();
});

it('hides it from the coordinator of another sport', async () => {
  auth = mockAuth({ sportIds: ['athl'] });
  stubApi();
  render(<SwissRoundsPanel />);
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  await new Promise((r) => setTimeout(r, 50));
  expect(screen.queryByText(/Swiss rounds/i)).not.toBeInTheDocument();
});

it('shows it to a global role such as the convener', async () => {
  auth = mockAuth({ global: true });
  stubApi();
  render(<SwissRoundsPanel />);
  expect(await screen.findByText(/Swiss rounds/i)).toBeInTheDocument();
});
