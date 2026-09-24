// The working indicator — shown while a user-triggered turn is in flight.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Working } from '../src/components/Working';

afterEach(cleanup);

describe('Working', () => {
  it('renders a spinner (aria status) and its label', () => {
    render(<Working label="the session is working…" />);
    const el = screen.getByTestId('working');
    expect(el.getAttribute('role')).toBe('status');
    expect(el.textContent).toContain('the session is working…');
    // The spinner element animates (motion is scoped to this active moment).
    expect(el.querySelector('.animate-spin')).toBeTruthy();
  });
});
