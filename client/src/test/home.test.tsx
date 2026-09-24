import { describe, expect, it } from 'vitest';
import { render, screen } from './test-utils';
import Home from '../app/page';

describe('Convoquer Home Page', () => {
  it('renders championship branding and headline', () => {
    render(<Home />);

    // Checks that the core championship display and tagline are rendered
    const titleElements = screen.getAllByText(/CONVOQUER/i);
    expect(titleElements.length).toBeGreaterThan(0);

    expect(screen.getByText(/DEFEND THE RIDGE/i)).toBeDefined();
    expect(screen.getByText(/CONQUER THE HEIGHTS/i)).toBeDefined();
    expect(screen.getAllByText(/ARENA WIRE/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SANCTIONED/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/MEDAL TALLY/i).length).toBeGreaterThan(0);
  });
});
