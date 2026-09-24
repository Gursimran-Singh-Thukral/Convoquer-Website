import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from './test-utils';
import React from 'react';
import LoginPage from '../app/login/page';
import GalleryPage from '../app/gallery/page';

// Mock matchMedia
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

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

describe('Login Page', () => {
  it('renders Google OAuth sign in and domain restriction message', () => {
    render(<LoginPage />);
    expect(screen.getAllByText(/ORGANIZER/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/PORTAL/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Sign in with Google/i)).toBeInTheDocument();
    expect(screen.getAllByText(/@iitjammu\.ac\.in/).length).toBeGreaterThanOrEqual(1);
  });
});

describe('Gallery Page', () => {
  it('renders an honest empty gallery before approved media exists', async () => {
    render(<GalleryPage />);
    expect(screen.getAllByText(/CHAMPIONSHIP/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/GALLERY/i).length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText(/gallery is being curated/i)).toBeInTheDocument();
  });
});
