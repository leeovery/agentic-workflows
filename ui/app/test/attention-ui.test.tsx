import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DigestCard } from '../src/components/DigestCard';
import { EscalationChip } from '../src/components/EscalationChip';

afterEach(cleanup);

describe('DigestCard', () => {
  it('renders landed commits/artifacts and next; suppresses waiting by default', () => {
    render(
      <DigestCard
        digest={{
          channel: 'auth',
          landed: { commits: [{ sha: 'deadbeef', subject: 'feat: x' }], artifacts: ['auth/spec.md'] },
          next: 'NEXT: planning',
          emittedAt: 't',
        }}
      />,
    );
    expect(screen.getByText('#auth')).toBeTruthy();
    expect(screen.getByText(/feat: x/)).toBeTruthy();
    expect(screen.getByText(/auth\/spec.md/)).toBeTruthy();
    expect(screen.getByText(/NEXT: planning/)).toBeTruthy();
    // The waiting section is never rendered in the strip.
    expect(screen.queryByText(/waiting shown/)).toBeNull();
  });

  it('renders nothing when there is nothing landed and no next', () => {
    const { container } = render(
      <DigestCard digest={{ channel: 'x', landed: { commits: [], artifacts: [] }, next: null, emittedAt: 't' }} />,
    );
    expect(container.innerHTML).toBe('');
  });
});

describe('EscalationChip', () => {
  it('shows idle age and marks escalation', () => {
    const since = new Date(Date.now() - 20 * 60_000).toISOString();
    render(<EscalationChip since={since} escalated quiet />);
    const el = screen.getByText(/idle 20m/);
    expect(el.textContent).toContain('escalated');
    expect(el.textContent).toContain('holds till morning');
  });
});
