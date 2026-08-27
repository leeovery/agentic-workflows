// GateCard (catalog: P2 — intent 3, N3, N4): the product-terms ask on top,
// option rows as buttons (recommended marked, NEVER pre-selected), free text
// always available, typed-confirm variant. Keyboard model (spec 6): initial
// focus on the free-text input; a typed option key answers when focus is on
// an option row; typed-confirm takes the typed key string only. One answer
// path: everything becomes an ordinary user turn.
import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { api, type GateCardData } from '../api';
import { GateComments } from './GateComments';

export function GateCard({
  card,
  onAnswer,
  busy,
  onClaim,
}: {
  card: GateCardData;
  onAnswer: (text: string) => void;
  busy?: boolean;
  onClaim?: () => void;
}) {
  const [text, setText] = useState('');
  const [showComments, setShowComments] = useState(false);
  // The ceremony: unread comments block the confirm until the thread is opened.
  // Local "seen" makes it crisp — opening the thread clears the block at once,
  // ahead of the server round-trip that zeroes card.unreadComments.
  const [seenComments, setSeenComments] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Initial focus is always the free-text input, never an option — focus on
    // the recommended row would be pre-selection by focus ring.
    inputRef.current?.focus();
  }, [card.id]);

  const typed = card.confirm === 'typed';
  const externallyResolved = card.state === 'resolved-externally' || Boolean(card.resolvedExternallyAt);
  const resolvedish = card.state !== 'open';
  // Ownership routing (UI-side): a watcher's submit is disabled; a stuck gate
  // opens to anyone. The process enforces none of this.
  const watching = card.watching === true;
  const unread = seenComments ? 0 : card.unreadComments ?? 0;
  const blockedByComments = unread > 0;
  const submitBlocked = busy || resolvedish || watching || blockedByComments;

  const openComments = () => {
    setShowComments(true);
    if (!seenComments) {
      setSeenComments(true);
      api.markCommentsRead({ gateId: card.id });
    }
  };

  const submitFree = () => {
    if (text.trim() === '' || submitBlocked) return;
    onAnswer(text.trim());
    setText('');
  };

  const tapOption = (key: string) => {
    if (submitBlocked) return;
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

      {/* Ownership badge — routing, never authority (Phase 6). */}
      {card.owner && card.owner.id && !externallyResolved && (
        <div className="px-4 pt-1.5 flex items-center gap-2 text-xs font-sans">
          {card.owner.isYou ? (
            <span className="text-ok">● you own this decision</span>
          ) : card.owner.stuck ? (
            <span className="text-warn">
              ● stuck — {card.owner.name} hasn't acted{' '}
              {onClaim && (
                <button className="text-nav hover:underline" onClick={onClaim}>
                  claim?
                </button>
              )}
            </span>
          ) : (
            <span className="text-stone-500">
              ● owned by {card.owner.name} — you're watching{' '}
              {onClaim && (
                <button className="text-nav hover:underline" onClick={onClaim}>
                  claim
                </button>
              )}
            </span>
          )}
        </div>
      )}

      {externallyResolved && (
        <p className="mx-4 mt-2 text-xs font-sans text-stone-500">
          Answered outside the UI — the decision was made in a terminal session; this card is closed.
        </p>
      )}

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
        {/* The ceremony: a sign-off cannot be finalised over unseen comments. */}
        {blockedByComments && !resolvedish && (
          <button
            data-testid="unread-block"
            onClick={openComments}
            className="mb-1.5 text-xs font-sans text-warn hover:underline"
          >
            {unread} unread comment{unread > 1 ? 's' : ''} — read {unread > 1 ? 'them' : 'it'} before answering →
          </button>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitFree();
            }}
            disabled={submitBlocked}
            placeholder={
              watching
                ? 'watching — the owner answers this one'
                : typed
                  ? 'type the option key to confirm…'
                  : 'answer in your own words, or type an option key…'
            }
            className="flex-1 rounded border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-1.5 text-sm font-sans focus:outline-none focus:border-gate disabled:opacity-50"
          />
          <button
            onClick={submitFree}
            disabled={submitBlocked || text.trim() === ''}
            className="rounded px-3 py-1.5 text-sm font-sans bg-nav text-white disabled:opacity-40"
          >
            {busy ? 'answering…' : 'answer'}
          </button>
        </div>
        {/* Comments toggle — the count badges the control; opening marks read. */}
        {!externallyResolved && (
          <button
            onClick={() => (showComments ? setShowComments(false) : openComments())}
            className="mt-1.5 text-xs font-sans text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
          >
            {showComments ? 'hide' : 'comments'}
            {(card.commentCount ?? 0) > 0 && (
              <span className="ml-1 font-mono text-[10px] rounded-full bg-stone-200 dark:bg-stone-800 px-1.5">
                {card.commentCount}
                {unread > 0 && <span className="text-gate"> · {unread} new</span>}
              </span>
            )}
          </button>
        )}
        {showComments && (
          <GateComments
            target={{ gateId: card.id }}
            onQuote={(q) => {
              setText((t) => (t ? `${t}\n\n${q}` : q));
              inputRef.current?.focus();
            }}
            onOpened={openComments}
          />
        )}
        {resolvedish && !externallyResolved && (
          <p className="mt-1.5 text-xs font-sans text-stone-400">
            {card.state === 'resolved-externally' ? 'answered outside this card' : card.state}
          </p>
        )}
      </footer>
    </section>
  );
}
