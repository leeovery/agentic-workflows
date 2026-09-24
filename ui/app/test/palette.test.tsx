// The ⌘K palette must offer every top-level rail destination, not just Lobby
// (a browser walk found only Lobby was listed — round-13). Plus the channels.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Palette } from '../src/Palette';

// cmdk uses ResizeObserver + scrollIntoView, which jsdom doesn't implement.
(globalThis as any).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
(Element.prototype as any).scrollIntoView = () => {};

afterEach(cleanup);

describe('Palette', () => {
  it('lists Lobby, Queue, Roadmap and each channel', () => {
    render(
      <MemoryRouter>
        <Palette open onClose={() => {}} onNavigate={() => {}} units={[{ name: 'auth-flow', type: 'feature' }]} />
      </MemoryRouter>,
    );
    for (const label of ['Lobby', 'Queue', 'Roadmap']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText('#auth-flow')).toBeTruthy();
  });

  it('navigates to the chosen destination', () => {
    const onNavigate = vi.fn();
    render(
      <MemoryRouter>
        <Palette open onClose={() => {}} onNavigate={onNavigate} units={[]} />
      </MemoryRouter>,
    );
    screen.getByText('Queue').click();
    expect(onNavigate).toHaveBeenCalledWith('/queue');
  });
});
