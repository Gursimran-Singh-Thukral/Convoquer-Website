import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from './test-utils';
import React from 'react';
import OrganizerDashboardPage from '../app/organizer/page';
import ScorerPage from '../app/scorer/page';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Authenticated Convener session with every permission this test suite touches,
// mirroring the shape RbacService.getUserEffectiveAuth() returns.
const ALL_PERMISSIONS = [
  'score.update',
  'result.approve',
  'result.override',
  'result.submit',
  'audit.view',
  'role.view',
  'media.publish',
  'media.create',
  'volunteer.manage',
].reduce<Record<string, unknown>>((acc, action) => {
  acc[action] = { action, isGlobal: true, sportIds: [], eventIds: [], departmentIds: [] };
  return acc;
}, {});

const SAMPLE_MATCH = {
  id: 'm1',
  matchNumber: 'FB-SF-01',
  status: 'LIVE',
  currentPeriod: '1st Half',
  scheduledStartTime: new Date().toISOString(),
  scheduledEndTime: null,
  teamAScore: 2,
  teamBScore: 0,
  teamA: {
    id: 'ta',
    name: 'IIT Jammu Football',
    institute: { name: 'IIT Jammu', shortName: 'IITJ' },
  },
  teamB: {
    id: 'tb',
    name: 'GCET Jammu Football',
    institute: { name: 'GCET Jammu', shortName: 'GCET' },
  },
  venue: { id: 'v1', name: 'Main Ground', location: 'Campus West' },
  tournament: {
    id: 't1',
    name: "Convoquer'26 Football Cup",
    sport: { id: 's1', name: 'Football' },
  },
  officials: [],
};

function jsonResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as Response);
}

/** Routes every fetch call to a canned response keyed by a substring of the URL. */
function installFetchMock(routes: Record<string, unknown>) {
  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const match = Object.entries(routes).find(([key]) => url.includes(key));
    return jsonResponse(match ? match[1] : []);
  }) as unknown as typeof fetch;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Organizer Dashboard Page', () => {
  beforeEach(() => {
    installFetchMock({
      '/auth/me': {
        authenticated: true,
        user: { id: 'u1', email: 'convener@iitjammu.ac.in', name: 'Test Convener' },
      },
      '/users/me/permissions': { userId: 'u1', roles: ['CONVENER'], permissions: ALL_PERMISSIONS },
      '/dashboard/overview': { persona: 'CONVENER', metrics: {} },
      '/dashboard/live-activity': [SAMPLE_MATCH],
      '/dashboard/pending-approvals': [],
      '/dashboard/audit-logs': [],
      '/venues': [],
    });
  });

  it('renders Organizer Command Overview header and KPI metrics', async () => {
    render(<OrganizerDashboardPage />);
    expect(
      (await screen.findAllByText(/ORGANIZER COMMAND OVERVIEW/i)).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/CONCURRENT OPERATIONS MATRIX/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/DISPATCH ANNOUNCEMENT/i)).toBeInTheDocument();
  });

  it('allows opening the announcement dispatch modal', async () => {
    render(<OrganizerDashboardPage />);
    const dispatchBtn = await screen.findByText(/Dispatch Announcement/i);
    fireEvent.click(dispatchBtn);
    expect(screen.getByPlaceholderText(/Venue change for Football Semifinal/i)).toBeInTheDocument();
  });
});

describe('Scorer Page', () => {
  beforeEach(() => {
    installFetchMock({
      '/auth/me': {
        authenticated: true,
        user: { id: 'u1', email: 'convener@iitjammu.ac.in', name: 'Test Convener' },
      },
      '/users/me/permissions': { userId: 'u1', roles: ['CONVENER'], permissions: ALL_PERMISSIONS },
      '/matches/m1/live': SAMPLE_MATCH,
      '/matches': [SAMPLE_MATCH],
    });
  });

  it('renders the match scoring desk and a live match card', async () => {
    render(<ScorerPage />);
    expect((await screen.findAllByText(/MATCH SCORING DESK/i)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/IIT Jammu/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/GCET Jammu/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/OPEN LIVE SCORING CONSOLE/i)).toBeInTheDocument();
  });

  it('opens the live scoring console for a match', async () => {
    render(<ScorerPage />);
    const openConsoleBtn = await screen.findByText(/OPEN LIVE SCORING CONSOLE/i);
    fireEvent.click(openConsoleBtn);
    expect((await screen.findAllByText(/ACTIVE SCORER TERMINAL/i)).length).toBeGreaterThanOrEqual(
      1,
    );
  });
});
