import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { LensTabs, ClaimChip, SourcesPanel, WhatMovedRibbon } from '../src/components/lenses';

afterEach(cleanup);

describe('LensTabs', () => {
  it('omits Structure entirely when structure is unavailable (never an error tab)', () => {
    render(<LensTabs lens="read" onLens={() => {}} hasStructure={false} />);
    expect(screen.getByText('Read')).toBeTruthy();
    expect(screen.getByText('History')).toBeTruthy();
    expect(screen.queryByText('Structure')).toBeNull();
  });
  it('shows Structure when available', () => {
    render(<LensTabs lens="structure" onLens={() => {}} hasStructure />);
    expect(screen.getByText('Structure')).toBeTruthy();
  });
});

describe('ClaimChip', () => {
  it('copies the command, never offers a run', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<ClaimChip chip={{ command: 'npm run typecheck', result: '0 errors' }} />);
    expect(screen.getByText('npm run typecheck')).toBeTruthy();
    expect(screen.getByText(/0 errors/)).toBeTruthy();
    // The only button is "copy" — no run/execute affordance.
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]!.textContent).toBe('copy');
    fireEvent.click(screen.getByText('copy'));
    expect(writeText).toHaveBeenCalledWith('npm run typecheck');
    vi.unstubAllGlobals();
  });
  it('carries the review-report verification badge when provided', () => {
    render(<ClaimChip chip={{ command: 'x' }} verified={true} />);
    expect(screen.getByTitle(/claims pass/).textContent).toBe('✓');
  });
});

describe('SourcesPanel', () => {
  it('shows sources AND consult references (both block sign-off equally)', () => {
    render(
      <SourcesPanel
        sources={[{ label: 'd1', status: 'incorporated' }, { label: 'd2', status: 'stale' }]}
        consult={[{ label: 'other', status: 'pending' }]}
      />,
    );
    expect(screen.getByText('Sources')).toBeTruthy();
    expect(screen.getByText('Consult references')).toBeTruthy();
    expect(screen.getByText('other')).toBeTruthy();
    expect(screen.getByText('stale')).toBeTruthy();
  });
});

describe('WhatMovedRibbon', () => {
  it('renders nothing when nothing moved', () => {
    const { container } = render(<WhatMovedRibbon moved={{ state: 'none' }} />);
    expect(container.innerHTML).toBe('');
  });
  it('shows the epoch-break lost state, never a wrong diff', () => {
    render(<WhatMovedRibbon moved={{ state: 'lost' }} />);
    expect(screen.getByText(/History rewritten/)).toBeTruthy();
  });
  it('expands the diff on click', () => {
    render(<WhatMovedRibbon moved={{ state: 'unread', base: 'abc', diff: '@@ -1 +1 @@\n-old\n+new' }} />);
    fireEvent.click(screen.getByText(/what moved/));
    expect(screen.getByText(/\+new/)).toBeTruthy();
  });
});
