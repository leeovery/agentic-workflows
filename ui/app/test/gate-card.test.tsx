// GateCard contracts (spec 6): recommended marked, never pre-selected;
// initial focus on the free-text input; typed-confirm never one-taps;
// a typed option key answers from an option row.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { GateCard } from '../src/components/GateCard';
import type { GateCardData } from '../src/api';

afterEach(cleanup);

const card = (over: Partial<GateCardData> = {}): GateCardData => ({
  id: 'a'.repeat(16),
  kind: 'menu',
  source: 'tool-result',
  surface: 'MENU: check-in gate',
  question: 'Keep going?',
  context: 'ctx',
  options: [
    { key: 'c', word: 'continue', label: 'Proceed (recommended)', recommended: true, form: 'cmd' },
    { key: 'w', word: 'wrap', label: 'Wrap up', recommended: false, form: 'cmd' },
  ],
  confirm: 'tap',
  state: 'open',
  address: { workUnit: 'x' },
  session: { bridgeSessionId: 'bs', askOrdinal: 0 },
  openedAt: '2026-08-27T10:00:00Z',
  ...over,
});

describe('GateCard', () => {
  it('marks the recommended row and puts initial focus on the free-text input, never an option', () => {
    render(<GateCard card={card()} onAnswer={() => {}} />);
    expect(screen.getByText('recommended')).toBeTruthy();
    expect((document.activeElement as HTMLElement).tagName).toBe('INPUT');
  });

  it('a tap answers with the option key (one answer path)', () => {
    const onAnswer = vi.fn();
    render(<GateCard card={card()} onAnswer={onAnswer} />);
    fireEvent.click(screen.getByText(/Wrap up/));
    expect(onAnswer).toHaveBeenCalledWith('w');
  });

  it('a typed option key on a focused option row answers', () => {
    const onAnswer = vi.fn();
    render(<GateCard card={card()} onAnswer={onAnswer} />);
    const row = screen.getByText(/Proceed/).closest('button')!;
    row.focus();
    fireEvent.keyDown(row, { key: 'w' });
    expect(onAnswer).toHaveBeenCalledWith('w');
  });

  it('typed-confirm NEVER answers on tap — only the typed string submits', () => {
    const onAnswer = vi.fn();
    render(<GateCard card={card({ confirm: 'typed', surface: 'MENU: spec signoff gate' })} onAnswer={onAnswer} />);
    fireEvent.click(screen.getByText(/Proceed/));
    expect(onAnswer).not.toHaveBeenCalled();
    const input = screen.getByPlaceholderText(/type the option key/);
    fireEvent.change(input, { target: { value: 'c' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAnswer).toHaveBeenCalledWith('c');
  });

  it('free text submits as an ordinary answer', () => {
    const onAnswer = vi.fn();
    render(<GateCard card={card()} onAnswer={onAnswer} />);
    const input = screen.getByPlaceholderText(/your own words/);
    fireEvent.change(input, { target: { value: 'actually, park it for now' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAnswer).toHaveBeenCalledWith('actually, park it for now');
  });

  it('a resolved-externally card is inert and says why', () => {
    const onAnswer = vi.fn();
    render(<GateCard card={card({ state: 'resolved-externally' })} onAnswer={onAnswer} />);
    fireEvent.click(screen.getByText(/Wrap up/));
    expect(onAnswer).not.toHaveBeenCalled();
    expect(screen.getByText(/answered outside this card/)).toBeTruthy();
  });

  it('shows the relay-divergence notice when the model paraphrased the menu', () => {
    render(<GateCard card={card({ relayDiverged: true })} onAnswer={() => {}} />);
    expect(screen.getByText(/differed from the engine's menu/)).toBeTruthy();
  });
});
