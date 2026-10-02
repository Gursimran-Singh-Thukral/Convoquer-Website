import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from './test-utils';
import StandingsPage from '../app/standings/page';

const row = (rank: number, short: string, points: number) => ({
  teamId: `t${rank}`,
  teamName: `${short} Badminton`,
  instituteId: `i${rank}`,
  instituteName: short,
  instituteShortName: short,
  played: 2,
  won: 1,
  lost: 1,
  drawn: 0,
  scoreFor: 3,
  scoreAgainst: 3,
  differential: 0,
  points,
  rank,
});

describe('per-sport standings tabs', () => {
  it("shows one tab per sport and finds the men's and women's tables of a split sport", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        let body: unknown = [];
        if (url.includes('/sports'))
          body = [
            { id: 'b1', name: 'Badminton (Men)' },
            { id: 'b2', name: 'Badminton (Women)' },
            { id: 'e1', name: 'E-Sports' },
          ];
        if (url.includes('/tournaments?sportId=b1'))
          body = [
            {
              id: 'tm',
              name: 'Badminton (Men) Championship',
              format: 'LEAGUE',
              sport: { id: 'b1', name: 'Badminton (Men)' },
            },
          ];
        if (url.includes('/tournaments?sportId=b2'))
          body = [
            {
              id: 'tw',
              name: 'Badminton (Women) Championship',
              format: 'LEAGUE',
              sport: { id: 'b2', name: 'Badminton (Women)' },
            },
          ];
        if (url.includes('/tournaments/tm/standings')) body = { standings: [row(1, 'MIET', 6)] };
        if (url.includes('/tournaments/tw/standings')) body = { standings: [row(1, 'GCET', 3)] };
        if (url.includes('/auth/me')) body = { authenticated: false, user: null };
        return new Response(JSON.stringify(body));
      }),
    );
    render(<StandingsPage />);

    // "Badminton (Men)" and "(Women)" share one BADMINTON tab; E-Sports has its own.
    const tab = await screen.findByRole('button', { name: 'BADMINTON' });
    expect(screen.getByRole('button', { name: 'E-SPORTS' })).toBeTruthy();
    fireEvent.click(tab);
    expect(await screen.findByText('MIET')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Women' }));
    expect(await screen.findByText('GCET')).toBeTruthy();
  });
});
