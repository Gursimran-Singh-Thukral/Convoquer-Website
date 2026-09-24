import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TournamentManagerPage from '../app/tournaments/page';
import { ToastProvider } from '@/components/ui/ToastProvider';

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    isLoading: false,
    authenticated: true,
    canAccessOrganizer: true,
    hasPermission: () => true,
    myScopedSportId: () => undefined,
  }),
}));
vi.mock('@/components/Navbar', () => ({ Navbar: () => null }));
vi.mock('@/components/Footer', () => ({ Footer: () => null }));
vi.mock('@/components/LiveTickerRibbon', () => ({ LiveTickerRibbon: () => null }));
vi.mock('@/components/OrganizerNavRail', () => ({ OrganizerNavRail: () => null }));

afterEach(() => vi.restoreAllMocks());

describe('Tournament registration and fixture forms', () => {
  it.each([
    ['KNOCKOUT', 'Generate Knockout Bracket', 'generate-bracket'],
    ['ROUND_ROBIN', 'Generate Round Robin', 'generate-round-robin'],
    ['SWISS', 'Start Swiss Tournament', 'generate-swiss-round'],
  ])('keeps registration separate from %s generation', async (format, button, endpoint) => {
    const consoleError = vi.spyOn(console, 'error');
    const tournament = {
      id: 'cup',
      eventId: 'event',
      sportId: 'sport',
      name: 'Test Cup',
      format,
      status: 'UPCOMING',
      stages: [],
      seeds: [],
    };
    const teams = [
      { id: 'team-a', name: 'Team A' },
      { id: 'team-b', name: 'Team B' },
    ];
    const writes: { path: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input), 'http://localhost');
        const path = url.pathname.replace(/^\/api/, '');
        let body: unknown = [];
        if (init?.method === 'POST') {
          const data = JSON.parse(String(init.body));
          writes.push({ path, body: data });
          if (path === '/teams') teams.push({ id: 'new-team', name: data.name });
          body = { message: 'Fixtures generated', roundNumber: 1 };
        } else if (path === '/tournaments') body = [tournament];
        else if (path === '/tournaments/cup') body = tournament;
        else if (path === '/teams') body = teams;
        else if (path === '/institutes') body = [{ id: 'institute', name: 'Test Institute' }];
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );

    const { container } = render(
      <ToastProvider>
        <TournamentManagerPage />
      </ToastProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Manage/ }));
    fireEvent.click(screen.getByRole('button', { name: 'generate' }));
    fireEvent.click(screen.getByRole('button', { name: /Register a new team/ }));
    const registration = screen.getByRole('form', { name: 'Register team' });
    const generation = screen.getByRole('form', { name: 'Generate fixtures' });
    expect(container.querySelector('form form')).toBeNull();
    expect(registration.contains(generation)).toBe(false);
    expect(generation.contains(registration)).toBe(false);

    await screen.findByRole('option', { name: 'Test Institute' });
    fireEvent.change(screen.getByLabelText('Team institute'), { target: { value: 'institute' } });
    fireEvent.change(screen.getByPlaceholderText('Team name'), { target: { value: 'New Team' } });
    // No fixture start time is filled: registration must not validate or submit generation.
    fireEvent.submit(registration);
    await waitFor(() =>
      expect(writes).toEqual([
        {
          path: '/teams',
          body: { eventId: 'event', sportId: 'sport', instituteId: 'institute', name: 'New Team' },
        },
      ]),
    );
    await screen.findByRole('checkbox', { name: 'New Team' });
    expect(screen.queryByText('Start time is required.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Team A' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Team B' }));
    fireEvent.change(generation.querySelector('input[type="datetime-local"]')!, {
      target: { value: '2027-04-01T09:00' },
    });
    expect(within(generation).getByRole('button', { name: button })).toHaveAttribute(
      'type',
      'submit',
    );
    fireEvent.submit(generation);
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toMatchObject({
      path: `/tournaments/cup/${endpoint}`,
      body: { teamIds: ['team-a', 'team-b'] },
    });
    await screen.findByText('Fixtures generated');
    expect(consoleError.mock.calls.flat().join(' ')).not.toMatch(
      /cannot.*(?:descendant|nested)|hydration/i,
    );
  });
});
