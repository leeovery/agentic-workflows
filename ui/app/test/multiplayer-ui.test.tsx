// Phase 6 UI: presence strips (three honest kinds), the capture gesture
// (optimistic ack → reconcile), and the durable failed-capture lobby row.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { PresenceStrip } from '../src/components/PresenceStrip';
import { CaptureButton } from '../src/components/CaptureButton';
import { FailedCaptures } from '../src/components/FailedCaptures';
import type { FailedCapture } from '../src/api';

afterEach(() => {
  cleanup();
  delete (globalThis as any).fetch;
});

describe('PresenceStrip — three honest kinds', () => {
  it('renders humans viewing, sessions working, and inferred sessions distinctly', () => {
    render(
      <PresenceStrip
        rows={[{ topic: 'auth', phase: 'discussion', held: true, live: true }]}
        humansViewing={[{ humanId: 'gh:bob', name: 'bob', lastSeenAt: '2026-08-27T10:00:00Z' }]}
        inferred={[{ phase: 'implementation', topic: 'rate-limit', mtime: '2026-08-27T10:00:00Z', inferred: true }]}
      />,
    );
    expect(screen.getByText(/bob is here/)).toBeTruthy();
    expect(screen.getByText(/a session is in/)).toBeTruthy();
    // The inferred row must be labelled inferred, never presented as certain.
    expect(screen.getByText(/inferred/)).toBeTruthy();
  });

  it('renders nothing when all three are empty', () => {
    const { container } = render(<PresenceStrip rows={[]} />);
    expect(container.querySelector('[data-testid="presence-strip"]')).toBeNull();
  });
});

describe('CaptureButton — optimistic ack then reconcile', () => {
  it('acknowledges at once and reconciles to captured on success', async () => {
    (globalThis as any).fetch = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.includes('/api/token') ? { token: null } : { ok: true }),
    }));
    render(<CaptureButton />);
    fireEvent.click(screen.getByText(/capture/));
    fireEvent.change(screen.getByPlaceholderText(/what's on your mind/), { target: { value: 'add dark mode' } });
    fireEvent.click(screen.getByText('capture'));
    // Optimistic toast is immediate.
    expect(screen.getByTestId('capture-toast').textContent).toMatch(/Capturing/);
    await waitFor(() => expect(screen.getByTestId('capture-toast').textContent).toMatch(/Captured to the inbox/));
  });

  it('opens the popover with the requested alignment/direction (never off-screen)', () => {
    // A left-rail/bottom button opens the fixed-width popover upward-right so it
    // never clips off the viewport edge (round-13 browser finding).
    render(<CaptureButton align="left" direction="up" />);
    fireEvent.click(screen.getByText(/capture/));
    const pop = screen.getByPlaceholderText(/what's on your mind/).closest('div[class*="absolute"]')!;
    expect(pop.className).toContain('left-0'); // opens rightward
    expect(pop.className).toContain('bottom-full'); // opens upward
  });

  it('a failed capture reconciles to a "kept to retry" toast, never a silent loss', async () => {
    (globalThis as any).fetch = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.includes('/api/token') ? { token: null } : { ok: false, captureId: 'cap-1' }),
    }));
    render(<CaptureButton />);
    fireEvent.click(screen.getByText(/capture/));
    fireEvent.change(screen.getByPlaceholderText(/what's on your mind/), { target: { value: 'x' } });
    fireEvent.click(screen.getByText('capture'));
    await waitFor(() => expect(screen.getByTestId('capture-toast').textContent).toMatch(/kept on the lobby to retry/));
  });
});

describe('FailedCaptures — durable, payload retained', () => {
  const rows: FailedCapture[] = [
    { id: 'cap-1', kind: 'bug', payload: 'crash on save', provenance: null, error: 'boom', failedAt: '2026-08-27T10:00:00Z' },
  ];
  it('shows the retained payload with retry + discard', () => {
    render(<FailedCaptures rows={rows} />);
    expect(screen.getByText(/1 capture.*failed/)).toBeTruthy();
    expect(screen.getByText('crash on save')).toBeTruthy();
    expect(screen.getByText('retry')).toBeTruthy();
    expect(screen.getByText('discard')).toBeTruthy();
  });
  it('renders nothing when empty', () => {
    const { container } = render(<FailedCaptures rows={[]} />);
    expect(container.querySelector('[data-testid="failed-captures"]')).toBeNull();
  });
});
