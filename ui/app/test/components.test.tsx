// Component contracts: the spine's admissible variants, the banner's closed
// list, and the embed's verbatim rule.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SpineItem } from '../src/components/SpineItem';
import { BridgeBanner, causesFromHealth } from '../src/components/BridgeBanner';
import { EngineEmbed } from '../src/components/EngineEmbed';

afterEach(cleanup);

const base = { ts: '2026-08-26T10:00:00Z', address: { workUnit: 'x' } };

describe('SpineItem', () => {
  it('renders the phase-completion variant', () => {
    const { container } = render(
      <SpineItem event={{ ...base, type: 'phase.completed', payload: { phase: 'discussion', topic: 'x' } }} />,
    );
    expect(container.querySelector('[data-variant="phase-completion"]')).toBeTruthy();
    expect(container.textContent).toContain('discussion');
  });

  it('renders the unit-status-change and tombstone variants', () => {
    const { container: a } = render(
      <SpineItem event={{ ...base, type: 'workunit.status-changed', payload: { from: 'in-progress', to: 'completed' } }} />,
    );
    expect(a.querySelector('[data-variant="unit-status-change"]')).toBeTruthy();
    const { container: b } = render(
      <SpineItem event={{ ...base, type: 'workunit.removed', payload: { successor: 'epic1/x' } }} />,
    );
    expect(b.querySelector('[data-variant="tombstone"]')).toBeTruthy();
    expect(b.textContent).toContain('epic1/x');
  });

  it('renders NOTHING for inadmissible types — never invents a variant', () => {
    const { container } = render(
      <SpineItem event={{ ...base, type: 'commit.landed', payload: { sha: 'x', subject: 's', scope: [] } }} />,
    );
    expect(container.innerHTML).toBe('');
  });
});

describe('BridgeBanner', () => {
  it('derives the closed-list causes from health', () => {
    const causes = causesFromHealth({
      bridgeMode: 'read-only',
      version: { supported: false, pendingMigrations: ['052'], shallow: false },
    });
    expect(causes.map((c) => c.cause)).toEqual(['version-skew', 'pending-migrations']);
  });

  it('renders live-only for a shallow clone', () => {
    const causes = causesFromHealth({
      bridgeMode: 'live-only',
      version: { supported: true, pendingMigrations: [], shallow: true },
    });
    expect(causes.map((c) => c.cause)).toEqual(['live-only']);
    render(<BridgeBanner cause="live-only" />);
    expect(screen.getByRole('status').textContent).toContain('live view only');
  });
});

describe('EngineEmbed', () => {
  it('renders the engine text verbatim — whitespace preserved, nothing restyled into it', () => {
    const text = 'PIPELINE (feature)\n  └─ ◐ Discussion    [in-progress]';
    render(<EngineEmbed text={text} />);
    expect(screen.getByTestId('engine-embed').textContent).toBe(text);
  });
});
