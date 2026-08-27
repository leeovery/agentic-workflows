// SessionThread must survive the loading→loaded transition without a hooks-order
// crash (React #310): every hook has to run on every render, so no hook may sit
// after the `if (!thread) return` guard. A browser walk caught this (round-13);
// this renders the real transition that triggers it.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SessionThread } from '../src/screens/SessionThread';

// jsdom doesn't implement scrollIntoView (Thread auto-scrolls to its tail); real
// browsers do. Stub it so the render completes.
(Element.prototype as any).scrollIntoView = () => {};

afterEach(() => {
  cleanup();
  delete (globalThis as any).fetch;
});

const thread = {
  state: 'idle-at-ask',
  openGate: null,
  lastError: undefined,
  records: [{ record: 'meta', entryPrompt: '/workflow-start' }],
  asks: [],
};

describe('SessionThread', () => {
  it('renders through null→loaded without a hooks-order crash', async () => {
    // First render sees `thread === null` (the loading branch); the next render
    // has data. If a useState sat below the early return, the second render
    // would throw React #310. Stub the thread fetch to drive the transition.
    (globalThis as any).fetch = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.includes('/thread') ? thread : { token: null }),
    }));
    render(
      <MemoryRouter initialEntries={['/s/bs-1']}>
        <Routes>
          <Route path="/s/:id" element={<SessionThread />} />
        </Routes>
      </MemoryRouter>,
    );
    // Loading state first…
    expect(screen.getByText('…')).toBeTruthy();
    // …then the loaded thread (the header entry prompt) — no crash.
    await waitFor(() => expect(screen.getByText('/workflow-start')).toBeTruthy());
    expect(screen.getByText('shaping thread')).toBeTruthy();
  });
});
