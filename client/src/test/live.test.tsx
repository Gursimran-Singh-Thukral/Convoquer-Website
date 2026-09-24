import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from './test-utils';
import LivePage from '../app/live/page';

describe('Convoquer Live Arena Page', () => {
  it('renders telecast matches returned by the backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        let body: unknown = [];
        if (url.endsWith('/matches'))
          body = [
            {
              id: 'match-1',
              status: 'LIVE',
              isTelecast: true,
              currentPeriod: '72 minutes',
              teamAScore: 2,
              teamBScore: 1,
              teamA: { name: 'IIT Jammu' },
              teamB: { name: 'GCET' },
              tournament: { name: 'Football Cup', sport: { name: 'Football' } },
              venue: { name: 'Main Ground', location: 'Campus West' },
            },
          ];
        if (url.includes('/volunteers/public'))
          body = [{ name: 'Test Contact', department: 'Sports', venueName: 'Main Ground' }];
        if (url.includes('/auth/me')) body = { authenticated: false, user: null };
        return new Response(JSON.stringify(body));
      }),
    );
    render(<LivePage />);

    // Check main branding and live indicators
    expect(screen.getAllByText(/LIVE MATCHES/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ARENA ACTION/i).length).toBeGreaterThan(0);

    expect((await screen.findAllByText(/Football/i)).length).toBeGreaterThan(0);

    // Check teams & codes
    expect(screen.getAllByText(/IIT Jammu/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/GCET/i).length).toBeGreaterThan(0);

    // Check Game time / over / set / quarter indicators
    expect(screen.getAllByText(/72 minutes/i).length).toBeGreaterThan(0);

    // Check venue locations
    expect(screen.getAllByText(/Main Ground/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Campus West/i).length).toBeGreaterThan(0);

    // Check assigned volunteer contacts
    expect(await screen.findByText('Test Contact')).toBeInTheDocument();
    expect(screen.queryByText(/\+91/)).not.toBeInTheDocument();

    // Check Match Center button and opening modal
    const matchCenterButtons = screen.getAllByRole('button', { name: /Open Match Center/i });
    expect(matchCenterButtons.length).toBeGreaterThan(0);

    // Click Match Center button to open modal
    fireEvent.click(matchCenterButtons[0]);
    expect(screen.getByRole('dialog')).toBeDefined();
    const closeButtons = screen.getAllByRole('button', { name: /Close Match Center/i });
    expect(closeButtons.length).toBeGreaterThan(0);

    // Close modal
    fireEvent.click(closeButtons[0]);
  });
});
