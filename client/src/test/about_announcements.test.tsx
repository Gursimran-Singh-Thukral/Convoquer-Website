import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from './test-utils';
import React from 'react';
import AboutPage from '../app/about/page';
import AnnouncementsPage from '../app/announcements/page';

// Mock matchMedia and resizeObserver if needed
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

describe('About Page', () => {
  it('renders festival statistics and Convener board', () => {
    render(<AboutPage />);
    expect(screen.getAllByText(/ABOUT CONVOQUER'26/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Championship Days/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Sanctioned Disciplines/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('link', { name: /View organizing committee/i })).toHaveAttribute(
      'href',
      '/committee',
    );
  });
});

describe('Announcements Page', () => {
  it('renders published announcements from the backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (input: RequestInfo | URL) =>
          new Response(
            JSON.stringify(
              String(input).includes('/announcements/public')
                ? [
                    {
                      id: 'notice-1',
                      heading: 'Football venue update',
                      description: 'Report to the main ground.',
                      targets: ['PUBLIC'],
                      createdAt: new Date().toISOString(),
                    },
                  ]
                : [],
            ),
          ),
      ),
    );
    render(<AnnouncementsPage />);
    expect(screen.getByText(/OFFICIAL FEST/i)).toBeInTheDocument();
    expect(await screen.findByText(/Football venue update/i)).toBeInTheDocument();
    expect(screen.getByText('Report to the main ground.')).toBeInTheDocument();
  });
});
