// GateCard (catalog: P2 — intent 3, N3, N4): the product-terms ask on top,
// option rows as buttons (recommended marked, NEVER pre-selected), free text
// always available, typed-confirm variant. Keyboard model (spec 6): initial
// focus on the free-text input; a typed option key answers when focus is on
// an option row; typed-confirm takes the typed key string only. One answer
// path: everything becomes an ordinary user turn.
import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import type { GateCardData } from '../api';

export function GateCard({
  card,
  onAnswer,
  busy,
}: {
  card: GateCardData;
  onAnswer: (text: string) => void;
  busy?: boolean;
}) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Initial focus is always the free-text input, never an option — focus on
    // the recommended row would be pre-selection by focus ring.
    inputRef.current?.focus();
  }, [card.id]);

  const typed = card.confirm === 'typed';
  const resolvedish = card.state !== 'open';

  const submitFree = () => {
    if (text.trim() === '' || busy) return;
    onAnswer(text.trim());
    setText('');
  };

  const tapOption = (key: string) => {
    if (busy || resolvedish) return;
    if (typed) {
      // Never one-tap: typing the key into the input is the confirmation.
      inputRef.current?.focus();
      return;
    }
    onAnswer(key);
  };

  const optionKeyDown = (e: React.KeyboardEvent, key: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      tapOption(key);
      return;
    }
    // A focused card accepts the typed option key as an answer.
    const hit = card.options.find((o) => o.key === e.key);
    if (hit && !typed) {
      e.preventDefault();
      tapOption(hit.key);
    }
  };

  return (
    <section
      data-testid="gate-card"
      data-state={card.state}
      className={clsx(
        'settle rounded-lg border-2 my-3',
        resolvedish ? 'border-stone-200 dark:border-stone-800 opacity-70' : 'border-gate/70',
      )}
    >
      <header className="px-4 pt-3 flex items-baseline gap-2">
        <span className="font-mono text-gate">◆</span>
        <span className="font-sans font-medium text-[15px]">
          {card.question ?? (card.kind === 'pass-through' ? 'The session is waiting on you' : 'Decision')}
        </span>
        {card.surface && <span className="ml-auto font-mono text-[10px] text-stone-400">{card.surface}</span>}
      </header>

      {card.relayDiverged && (
        <p className="mx-4 mt-2 text-xs font-sans text-warn">
          The session's own wording differed from the engine's menu — this card shows the engine's.
        </p>
      )}

      {card.context && (
        <div className="px-4 py-2 font-serif text-[14.5px] leading-6 text-stone-700 dark:text-stone-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
          {card.context}
        </div>
      )}

      <div className="px-4 py-2 space-y-1" role="listbox" aria-label="options">
        {card.options.map((o) => (
          <button
            key={o.key}
            onClick={() => tapOption(o.key)}
            onKeyDown={(e) => optionKeyDown(e, o.key)}
            disabled={busy || resolvedish}
            className={clsx(
              'w-full text-left flex items-baseline gap-3 rounded px-2.5 py-1.5 border',
              'border-stone-200 dark:border-stone-800 hover:border-gate focus:outline-none focus:ring-1 focus:ring-gate',
              'disabled:opacity-50',
            )}
          >
            <code className="font-mono text-xs text-stone-500 shrink-0">{o.word ? `${o.key}/${o.word}` : o.key}</code>
            <span className="font-sans text-sm">
              {o.label}
              {o.recommended && <span className="ml-2 text-[10px] text-stone-400 uppercase tracking-wide">recommended</span>}
            </span>
          </button>
        ))}
      </div>

      <footer className="px-4 pb-3 pt-1">
        {typed && !resolvedish && (
          <p className="text-xs font-sans text-gate mb-1.5">
            This one is never answered with a tap — type the option to confirm it.
          </p>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitFree();
            }}
            disabled={busy || resolvedish}
            placeholder={typed ? 'type the option key to confirm…' : 'answer in your own words, or type an option key…'}
            className="flex-1 rounded border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-1.5 text-sm font-sans focus:outline-none focus:border-gate"
          />
          <button
            onClick={submitFree}
            disabled={busy || resolvedish || text.trim() === ''}
            className="rounded px-3 py-1.5 text-sm font-sans bg-nav text-white disabled:opacity-40"
          >
            {busy ? 'answering…' : 'answer'}
          </button>
        </div>
        {resolvedish && (
          <p className="mt-1.5 text-xs font-sans text-stone-400">
            {card.state === 'resolved-externally' ? 'answered outside this card' : card.state}
          </p>
        )}
      </footer>
    </section>
  );
}
