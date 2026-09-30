import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ResultEntryForm } from '@/components/results/ResultEntryForm';
import { ResultScorecard } from '@/components/results/ResultScorecard';
import { resultSummary } from '@/lib/resultFormat';
import type { Match } from '@/lib/api';

afterEach(() => vi.unstubAllGlobals());

const fixture = (sport: string, matchNumber = 'Match 1'): Match =>
  ({
    id: 'm1',
    status: 'SCHEDULED',
    matchNumber,
    teamAId: 'a',
    teamBId: 'b',
    teamA: { id: 'a', name: 'IIT Jammu' },
    teamB: { id: 'b', name: 'MIET' },
    tournament: { name: 't', sport: { id: 's', name: sport } },
  }) as Match;

function capture() {
  const bodies: Record<string, unknown>[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      if (init?.body) bodies.push(JSON.parse(String(init.body)));
      return new Response('{}', { status: 200 });
    }),
  );
  return bodies;
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

it('records a badminton match set by set and only asks for set 3 at one set all', async () => {
  const bodies = capture();
  render(<ResultEntryForm match={fixture('Badminton (Women)')} onSaved={vi.fn()} />);
  expect(screen.queryByLabelText('Set 3 (decider) team A')).not.toBeInTheDocument();
  type('Set 1 team A', '21');
  type('Set 1 team B', '15');
  type('Set 2 team A', '18');
  type('Set 2 team B', '21');
  expect(screen.getByLabelText('Set 3 (decider) team A')).toBeInTheDocument();
  type('Set 3 (decider) team A', '21');
  type('Set 3 (decider) team B', '19');
  expect(screen.getByText(/Sets: 2–1/)).toBeInTheDocument();
  fireEvent.submit(screen.getByRole('form', { name: 'Enter final result' }));
  await screen.findByText(/submitted for approval/);
  expect(bodies[0].scoreDetails).toEqual({
    kind: 'SETS',
    sets: [
      { a: 21, b: 15 },
      { a: 18, b: 21 },
      { a: 21, b: 19 },
    ],
  });
});

it('records men’s badminton as best of 5 games of 3 sets and stops at 3 games', async () => {
  const bodies = capture();
  render(<ResultEntryForm match={fixture('Badminton (Men)')} onSaved={vi.fn()} />);
  expect(screen.queryByLabelText('Game 2 Set 1 team A')).not.toBeInTheDocument();
  type('Game 1 Set 1 team A', '21');
  type('Game 1 Set 1 team B', '15');
  type('Game 1 Set 2 team A', '18');
  type('Game 1 Set 2 team B', '21');
  type('Game 1 Set 3 (decider) team A', '21');
  type('Game 1 Set 3 (decider) team B', '19');
  expect(screen.getByLabelText('Game 2 Set 1 team A')).toBeInTheDocument();
  for (const g of [2, 3]) {
    type(`Game ${g} Set 1 team A`, '21');
    type(`Game ${g} Set 1 team B`, '10');
    type(`Game ${g} Set 2 team A`, '21');
    type(`Game ${g} Set 2 team B`, '12');
  }
  expect(screen.queryByLabelText('Game 4 Set 1 team A')).not.toBeInTheDocument();
  expect(screen.getByText(/Games: 3–0/)).toBeInTheDocument();
  fireEvent.submit(screen.getByRole('form', { name: 'Enter final result' }));
  await waitFor(() => expect(bodies).toHaveLength(1));
  const d = bodies[0].scoreDetails as { kind: string; games: { sets: unknown[] }[] };
  expect(d.kind).toBe('GAMES');
  expect(d.games.map((g) => g.sets.length)).toEqual([3, 2, 2]);
});

it('gives each chess team exactly four boards, paired board by board', async () => {
  const bodies = capture();
  render(<ResultEntryForm match={fixture('Chess (Women)')} onSaved={vi.fn()} />);
  expect(screen.getByLabelText('Board 4 result')).toBeInTheDocument();
  expect(screen.queryByLabelText('Board 5 result')).not.toBeInTheDocument();
  expect(screen.queryByText(/Add board/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Board 1 result'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Board 2 result'), { target: { value: '1' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Enter final result' }));
  await waitFor(() => expect(bodies).toHaveLength(1));
  expect((bodies[0].scoreDetails as { boards: unknown[] }).boards).toHaveLength(4);
  expect(screen.getByText(/Team score: 3–1/)).toBeInTheDocument();
});

it('enters a BGMI game with placement and kill points for that game’s teams only', async () => {
  const bodies: Record<string, unknown>[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      if (init?.body) {
        bodies.push(JSON.parse(String(init.body)));
        return new Response('{}', { status: 200 });
      }
      return new Response(
        JSON.stringify([
          { id: 't1', name: 'MIET E-Sports (BGMI)' },
          { id: 't2', name: 'CU E-Sports (BGMI)' },
          { id: 't3', name: 'CU E-Sports (Free Fire)' },
          { id: 't4', name: 'CU E-Sports (Valorant)' },
        ]),
        { status: 200 },
      );
    }),
  );
  render(<ResultEntryForm match={fixture('E-Sports', 'BGMI - Match 1')} onSaved={vi.fn()} />);
  await screen.findByLabelText('Kills MIET E-Sports (BGMI)');
  expect(screen.queryByLabelText('Kills CU E-Sports (Free Fire)')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Kills CU E-Sports (Valorant)')).not.toBeInTheDocument();
  type('Kills MIET E-Sports (BGMI)', '7');
  fireEvent.submit(screen.getByRole('form', { name: 'Enter final result' }));
  await waitFor(() => expect(bodies).toHaveLength(1));
  const d = bodies[0].scoreDetails as { entries: Record<string, number>[] };
  // Position 1 in BGMI = 15 placement points; kill points default to kills.
  expect(d.entries[0]).toMatchObject({
    teamId: 't1',
    rank: 1,
    kills: 7,
    placementPoints: 15,
    killPoints: 7,
  });
});

it('records a football knockout decided on penalties', async () => {
  const bodies = capture();
  render(<ResultEntryForm match={fixture('Football', 'QF 1')} onSaved={vi.fn()} />);
  type('Full time team A', '1');
  type('Full time team B', '1');
  fireEvent.click(screen.getByLabelText('Decided on penalties'));
  type('Penalties team A', '4');
  type('Penalties team B', '3');
  fireEvent.submit(screen.getByRole('form', { name: 'Enter final result' }));
  await waitFor(() => expect(bodies).toHaveLength(1));
  expect(bodies[0].scoreDetails).toEqual({
    kind: 'FOOTBALL',
    regulation: { a: 1, b: 1 },
    penalties: { a: 4, b: 3 },
  });
});

it('blocks submitting an incomplete scorecard', async () => {
  const bodies = capture();
  render(<ResultEntryForm match={fixture('Basketball (Men)')} onSaved={vi.fn()} />);
  type('Quarter 1 team A', '10');
  fireEvent.submit(screen.getByRole('form', { name: 'Enter final result' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Complete the scorecard');
  expect(bodies).toHaveLength(0);
});

it('presents a set-wise scorecard the way a match report would', () => {
  render(
    <ResultScorecard
      details={{
        kind: 'SETS',
        sets: [
          { a: 21, b: 15 },
          { a: 18, b: 21 },
          { a: 21, b: 19 },
        ],
      }}
      teamA={{ id: 'a', name: 'IIT Jammu', shortName: 'IIT J' }}
      teamB={{ id: 'b', name: 'MIET', shortName: 'MIET' }}
      scoreA={2}
      scoreB={1}
      winnerTeamId="a"
      stageName="Semifinal"
    />,
  );
  expect(screen.getByText('Semifinal')).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Set 3' })).toBeInTheDocument();
  expect(screen.getByText(/IIT J won 2–1/)).toBeInTheDocument();
});

it('states the cricket margin of victory', () => {
  const details = {
    kind: 'CRICKET',
    overs: 20,
    battingFirst: 'A',
    innings: {
      A: { runs: 160, wickets: 6, overs: '20' },
      B: { runs: 148, wickets: 9, overs: '20' },
    },
  };
  const a = { id: 'a', name: 'IIT Jammu' };
  const b = { id: 'b', name: 'MIET' };
  expect(resultSummary(details, a, b, 'a')).toBe('IIT Jammu won by 12 runs');
  expect(resultSummary({ ...details, battingFirst: 'B' }, a, b, 'a')).toBe(
    'IIT Jammu won by 4 wickets',
  );
});

it('presents a best-of-5 badminton tie game by game', () => {
  const g = (...sets: [number, number][]) => ({
    sets: sets.map(([a, b]) => ({ a, b })),
    setsA: sets.filter(([a, b]) => a > b).length,
    setsB: sets.filter(([a, b]) => a < b).length,
  });
  render(
    <ResultScorecard
      details={{
        kind: 'GAMES',
        bestOf: 5,
        games: [
          g([21, 15], [21, 10]),
          g([10, 21], [12, 21]),
          g([21, 19], [18, 21], [21, 17]),
          g([21, 5], [21, 9]),
        ],
      }}
      teamA={{ id: 'a', name: 'IIT Jammu Badminton (Men)', shortName: 'IIT Jammu' }}
      teamB={{ id: 'b', name: 'MIET Badminton (Men)', shortName: 'MIET' }}
      scoreA={3}
      scoreB={1}
      winnerTeamId="a"
    />,
  );
  expect(screen.getByRole('columnheader', { name: 'Game 4' })).toBeInTheDocument();
  expect(screen.getByText(/IIT Jammu won 3–1 \(best of 5 games\)/)).toBeInTheDocument();
  expect(screen.getByText('21–19, 18–21, 21–17')).toBeInTheDocument();
});

it('summarises football penalties and chess half points', () => {
  expect(
    resultSummary(
      { kind: 'FOOTBALL', regulation: { a: 1, b: 1 }, penalties: { a: 4, b: 3 } },
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
      'a',
      1,
      1,
    ),
  ).toBe('1–1 (4–3 pens)');
  expect(resultSummary({ kind: 'CHESS' }, { id: 'a' }, { id: 'b' }, 'a', 3.5, 2.5)).toBe('3½–2½');
});

it('shows athletics results with qualifiers and status codes', () => {
  render(
    <ResultScorecard
      details={{
        kind: 'TRACK',
        round: 'SEMIFINAL',
        sections: [
          {
            category: 'Men',
            entries: [
              { teamId: 'x', shortName: 'CU', rank: 1, mark: '10.85', qualified: true },
              { teamId: 'y', shortName: 'MIET', rank: 2, mark: '10.91', qualified: true },
              { teamId: 'z', shortName: 'GCET', rank: 3, note: 'DNF' },
            ],
          },
        ],
      }}
    />,
  );
  expect(screen.getByText(/Men.s Semi-final/)).toBeInTheDocument();
  expect(screen.getAllByTitle('Qualified for the final')).toHaveLength(2);
  expect(screen.getByText('DNF')).toBeInTheDocument();
});

it('records volleyball as best of 5 sets and stops once a team has won 3', async () => {
  const bodies = capture();
  render(<ResultEntryForm match={fixture('Volleyball (Men)')} onSaved={vi.fn()} />);
  expect(screen.getByLabelText('Set 3 team A')).toBeInTheDocument();
  expect(screen.queryByLabelText('Set 4 team A')).not.toBeInTheDocument();
  const scores: [string, string][] = [
    ['25', '20'],
    ['20', '25'],
    ['25', '22'],
  ];
  scores.forEach(([a, b], i) => {
    type(`Set ${i + 1} team A`, a);
    type(`Set ${i + 1} team B`, b);
  });
  expect(screen.getByLabelText('Set 4 team A')).toBeInTheDocument(); // 2–1, still open
  type('Set 4 team A', '18');
  type('Set 4 team B', '25');
  type('Set 5 (decider) team A', '15');
  type('Set 5 (decider) team B', '12');
  expect(screen.getByText(/Sets: 3–2/)).toBeInTheDocument();
  fireEvent.submit(screen.getByRole('form', { name: 'Enter final result' }));
  await waitFor(() => expect(bodies).toHaveLength(1));
  expect((bodies[0].scoreDetails as { sets: unknown[] }).sets).toHaveLength(5);
});

it('tells apart two teams from the same college in an E-Sports lobby', () => {
  render(
    <ResultScorecard
      details={{
        kind: 'LOBBY',
        game: 'BGMI',
        entries: [
          {
            teamId: 'a',
            shortName: 'GCET',
            teamName: 'GCET E-Sports (BGMI - Team 1)',
            rank: 1,
            kills: 8,
            placementPoints: 15,
            killPoints: 8,
            points: 23,
          },
          {
            teamId: 'b',
            shortName: 'GCET',
            teamName: 'GCET E-Sports (BGMI - Team 2)',
            rank: 2,
            kills: 3,
            placementPoints: 12,
            killPoints: 3,
            points: 15,
          },
          {
            teamId: 'c',
            shortName: 'MIET',
            teamName: 'MIET E-Sports (BGMI)',
            rank: 3,
            kills: 1,
            placementPoints: 10,
            killPoints: 1,
            points: 11,
          },
        ],
      }}
    />,
  );
  expect(screen.getByText('GCET (Team 1)')).toBeInTheDocument();
  expect(screen.getByText('GCET (Team 2)')).toBeInTheDocument();
  expect(screen.getByText('MIET')).toBeInTheDocument();
});

it('lets a coordinator add another BGMI team and shows it in the lobby', async () => {
  const posts: { url: string; body: Record<string, unknown> }[] = [];
  let teams = [{ id: 't1', name: 'MIET E-Sports (BGMI)' }];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (init?.body) {
        posts.push({ url, body: JSON.parse(String(init.body)) });
        teams = [...teams, { id: 't9', name: 'GCET E-Sports (BGMI - Team 2)' }];
        return new Response('{}', { status: 200 });
      }
      if (url.endsWith('/institutes'))
        return new Response(JSON.stringify([{ id: 'i1', name: 'GCET', shortName: 'GCET' }]), {
          status: 200,
        });
      return new Response(JSON.stringify(teams), { status: 200 });
    }),
  );
  render(<ResultEntryForm match={fixture('E-Sports', 'BGMI - Match 1')} onSaved={vi.fn()} />);
  await screen.findByLabelText('Kills MIET E-Sports (BGMI)');
  fireEvent.click(screen.getByText('+ Add team'));
  await screen.findByRole('option', { name: 'GCET' });
  fireEvent.change(screen.getByLabelText('College'), { target: { value: 'i1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await screen.findByLabelText('Kills GCET E-Sports (BGMI - Team 2)');
  expect(posts[0].body).toEqual({ sportId: 's', instituteId: 'i1', game: 'BGMI' });
});
