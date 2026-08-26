// Screen integration smoke — the real App tree rendered in jsdom against
// mocked bridge responses (no browser in CI; the live demo is the
// done-means' manual half).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('shiki', () => ({ codeToHtml: async () => '<pre class="shiki"><code>x</code></pre>' }));
vi.mock('mermaid', () => ({ default: { initialize: () => {}, render: async () => ({ svg: '<svg/>' }) } }));

import App from '../src/App';

const HEALTH = {
  ok: true,
  mode: 'live',
  bridgeMode: 'full',
  project: 'demo',
  epoch: 'e',
  bannerReasons: [],
  version: { productVersion: 'v0.7.13', supported: true, pendingMigrations: [], shallow: false },
};

const LOBBY = {
  empty: false,
  detail: {
    features: { work_units: [{ name: 'rate-limiting', phase_label: 'discussion (in-progress)' }] },
    epics: { work_units: [] },
    bugfixes: { work_units: [] },
    quick_fixes: { work_units: [] },
    cross_cutting: { work_units: [] },
    inbox: { total_count: 2 },
  },
  overviewRender: 'Features\n  └─ 1. Rate Limiting',
  knowledge: { state: 'ready' },
  durable: { counts: { 'rate-limiting': 1 }, rows: [] },
  roadmap: null,
  baseline: { status: 'skipped' },
};

const ARTIFACT = {
  workUnit: 'rate-limiting',
  path: 'specification/rate-limiting/specification.md',
  phase: 'specification',
  content: '# Spec\n\n## Decisions\n\nHardened text.',
};

const CHANNEL = {
  name: 'rate-limiting',
  workType: 'feature',
  status: 'in-progress',
  spine: [
    {
      id: 'a'.repeat(16),
      seq: 13,
      type: 'phase.completed',
      ts: '2026-08-26T10:00:00Z',
      address: { workUnit: 'rate-limiting' },
      payload: { phase: 'discussion', topic: 'rate-limiting' },
    },
  ],
  drawer: [
    {
      id: 'b'.repeat(16),
      type: 'commit.landed',
      ts: '2026-08-26T10:00:00Z',
      address: {},
      payload: { sha: 'deadbeefcafe', subject: 'feat: x', scope: ['rate-limiting'] },
    },
  ],
  threads: [{ name: 'rate-limiting', lifecycle: 'in-progress', phase: 'discussion', cues: {} }],
  embed: 'PIPELINE (feature)\n  └─ ◐ Discussion    [in-progress]',
  artifacts: [{ path: 'discussion/rate-limiting.md', phase: 'discussion' }],
};

class FakeEventSource {
  onmessage: unknown;
  onerror: unknown;
  addEventListener() {}
  close() {}
}

beforeEach(() => {
  vi.stubGlobal('EventSource', FakeEventSource as any);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body = String(url).startsWith('/health')
        ? HEALTH
        : String(url).startsWith('/api/lobby')
          ? LOBBY
          : String(url).startsWith('/api/channel/')
            ? CHANNEL
            : String(url).startsWith('/api/artifact/')
              ? ARTIFACT
              : null;
      if (!body) return { ok: false, status: 404, json: async () => ({}) } as any;
      return { ok: true, status: 200, json: async () => body } as any;
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('screens', () => {
  it('lobby renders work cards with the durable count and the Phase 2 disclosure', async () => {
    render(
      <MemoryRouter initialEntries={['/lobby']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText('#rate-limiting').length).toBeGreaterThan(0));
    expect(screen.getByText(/1 waiting on you/)).toBeTruthy();
    expect(screen.getByText(/live asks arrive with bridge sessions/)).toBeTruthy();
    expect(screen.getByText(/memory ready/)).toBeTruthy();
  });

  it('channel renders the spine item, the embed verbatim, and commits only in the drawer', async () => {
    render(
      <MemoryRouter initialEntries={['/c/rate-limiting']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('engine-embed')).toBeTruthy());
    expect(screen.getByTestId('engine-embed').textContent).toBe(CHANNEL.embed);
    const spine = document.querySelector('[data-variant="phase-completion"]');
    expect(spine).toBeTruthy();
    // The commit is not rendered until the drawer opens — never on the spine.
    expect(screen.queryByText(/feat: x/)).toBeNull();
  });

  it('artifact Read lens renders with the firmness chrome and anchored headings', async () => {
    render(
      <MemoryRouter initialEntries={['/c/rate-limiting/a/specification/rate-limiting/specification.md']}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(document.querySelector('.read-lens')).toBeTruthy());
    const article = document.querySelector('article.read-lens')!;
    expect(article.className).toContain('firmness-specification');
    // Section anchors: headings carry slug ids.
    await waitFor(() => expect(document.getElementById('decisions')).toBeTruthy());
    expect(screen.getByText(/specification — the record/)).toBeTruthy();
  });
});
