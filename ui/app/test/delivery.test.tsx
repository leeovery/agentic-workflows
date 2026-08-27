import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TelemetrySurface, ConsolidationCard, PlanDAG } from '../src/components/delivery';
import type { TopicTelemetry } from '../src/api';

afterEach(cleanup);

const tele = (over: Partial<TopicTelemetry> = {}): TopicTelemetry => ({
  topic: 'rate-limiting',
  status: 'in-progress',
  currentPhase: '2',
  currentTask: 'add-delay',
  completedPhases: ['1'],
  completedTasks: ['t1'],
  fixAttempts: 0,
  analysisCycles: 0,
  depBlocked: [],
  consolidation: { gated: false, bank: [], staging: {}, consolidatedPhases: [] },
  commitsLanded: [{ sha: 'deadbeef', subject: 'feat: x' }],
  agentsActive: 0,
  ...over,
});

describe('TelemetrySurface', () => {
  it('shows the current task and status collapsed; expands to detail', () => {
    render(<TelemetrySurface t={tele()} />);
    expect(screen.getByText(/phase 2 · add-delay/)).toBeTruthy();
    expect(screen.queryByText(/completed phases/)).toBeNull();
    fireEvent.click(screen.getByText('rate-limiting'));
    expect(screen.getByText(/completed phases/)).toBeTruthy();
    expect(screen.getByText(/feat: x/)).toBeTruthy();
  });

  it('marks dep-blocked, agents-active, and the consolidation gate', () => {
    render(<TelemetrySurface t={tele({ depBlocked: [{ topic: 'other' }], agentsActive: 2, consolidation: { gated: true, bank: [], staging: {}, consolidatedPhases: [] } })} />);
    expect(screen.getByText(/dep-blocked/)).toBeTruthy();
    expect(screen.getByText(/2 reading/)).toBeTruthy();
    expect(screen.getByText(/consolidation/)).toBeTruthy();
  });
});

describe('ConsolidationCard', () => {
  it('renders the bank and staged tasks as one decide-shaped read view', () => {
    render(
      <ConsolidationCard
        t={tele({ consolidation: { gated: true, bank: [{ opportunity: 'dedupe X' }], staging: { p2: [{ task: 'consolidate-a' }] }, consolidatedPhases: [] } })}
      />,
    );
    expect(screen.getByText(/banked opportunities/)).toBeTruthy();
    expect(screen.getByText('dedupe X')).toBeTruthy();
    expect(screen.getByText(/consolidate-a/)).toBeTruthy();
    expect(screen.getByText(/Decide this in the session/)).toBeTruthy();
  });
  it('renders nothing when there is no consolidation moment', () => {
    const { container } = render(<ConsolidationCard t={tele()} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('PlanDAG', () => {
  it('lays tasks by dependency depth and shows deps', () => {
    render(
      <PlanDAG
        dag={{
          format: 'local-markdown',
          tasks: [
            { id: 't-1-1', title: 'First', phase: '1', status: 'completed', priority: 0, dependsOn: [] },
            { id: 't-1-2', title: 'Second', phase: '1', status: 'pending', priority: 0, dependsOn: ['t-1-1'] },
          ],
        }}
      />,
    );
    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByText('Second')).toBeTruthy();
    expect(screen.getByText(/after: t-1-1/)).toBeTruthy();
  });
  it('degrades a Linear plan to a link-out, no graph', () => {
    render(<PlanDAG dag={{ format: 'linear', linkOut: 'https://linear.app/x' }} />);
    expect(screen.getByText(/tracked in Linear/)).toBeTruthy();
    expect(screen.getByText('open in Linear')).toBeTruthy();
  });
});
