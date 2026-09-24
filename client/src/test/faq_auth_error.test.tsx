import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from './test-utils';
import React from 'react';
import FAQPage from '../app/faq/page';
import AuthErrorPage from '../app/auth-error/page';

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

describe('FAQ Page', () => {
  it('shows an honest empty state when no official answers are published', async () => {
    render(<FAQPage />);
    expect(
      screen.getByRole('heading', { name: /Frequently asked questions/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Official answers will appear/)).toBeInTheDocument();
    expect(screen.queryByText(/24\/7/)).not.toBeInTheDocument();
  });
});

describe('Auth Error Page', () => {
  it('renders domain restriction error message and Google retry button', () => {
    render(<AuthErrorPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/ACCESS/i);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/RESTRICTED/i);
    expect(screen.getAllByText(/@iitjammu\.ac\.in/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Try Again with @iitjammu\.ac\.in/i)).toBeInTheDocument();
    expect(screen.getByText(/Return to Homepage/i)).toBeInTheDocument();
  });
});
