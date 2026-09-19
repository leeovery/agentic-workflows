// The thread renders the assistant conversation as MARKDOWN (bold, blockquotes,
// code), not raw source — a browser walk showed literal `**` / `>` / fences.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Thread } from '../src/components/Thread';
import type { ThreadData } from '../src/api';

// jsdom lacks scrollIntoView (the thread auto-scrolls to its tail).
(Element.prototype as any).scrollIntoView = () => {};

afterEach(cleanup);

const thread = (text: string): ThreadData => ({
  state: 'idle-at-ask',
  openGate: null,
  lastError: undefined,
  records: [{ record: 'assistant', text }],
  asks: [],
});

describe('Thread markdown rendering', () => {
  it('renders bold, blockquote, and inline code — not raw markdown source', () => {
    const { container } = render(
      <Thread thread={thread('Pick up **Task Model** — `id` matters.\n\n> Discussion starting.')} onAnswer={() => {}} />,
    );
    // The .read-lens prose wrapper is present with real markdown elements.
    const md = container.querySelector('.read-lens');
    expect(md).toBeTruthy();
    expect(md!.querySelector('strong')?.textContent).toBe('Task Model');
    expect(md!.querySelector('blockquote')).toBeTruthy();
    expect(md!.querySelector('code')?.textContent).toBe('id');
    // No literal ** left in the visible text.
    expect(md!.textContent).not.toContain('**Task Model**');
  });
});
