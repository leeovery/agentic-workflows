// The thread surface (S4, conversation mode) — journal records rendered by
// provenance: serif for the conversation, mono EngineEmbed for engine truth,
// cards inline (resolved cards collapse to one line). PassThroughAsk is the
// thread tail + reply box — no card is fabricated (N3).
import { useEffect, useRef } from 'react';
import { extractSections } from '@workflow-ui/shared';
import { EngineEmbed } from './EngineEmbed';
import { GateCard } from './GateCard';
import { BatchScreenCard } from './BatchScreenCard';
import { CaptureButton } from './CaptureButton';
import { ChatInput } from './ChatInput';
import { Working } from './Working';
import type { GateCardData, ThreadData } from '../api';

function ToolResultBlock({ text }: { text: string }) {
  // Engine sections render verbatim (mono, terminal-framed); DATA sections
  // are the model's context, never displayed (the engine's own instruction).
  const sections = extractSections(text);
  const visible = sections.filter((s) => !s.name.startsWith('DATA'));
  if (visible.length === 0) return null;
  return (
    <div className="space-y-2">
      {visible.map((s, i) => (
        <EngineEmbed key={i} text={s.body} label={s.name.toLowerCase()} />
      ))}
    </div>
  );
}

export function Thread({
  thread,
  onAnswer,
  busy,
  onClaim,
}: {
  thread: ThreadData;
  onAnswer: (gateId: string, text: string) => void;
  busy?: boolean;
  onClaim?: (gateId: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [thread.records.length, thread.openGate?.id]);

  // deriveAsks advances an ordinal only on turns where an ask was detected;
  // mirror that exactly rather than counting every turn-end (which drifts on
  // clean-ended or ask-less turns).
  const asksInOrder = [...thread.asks].sort((a, b) => a.ordinal - b.ordinal);
  let detectedSoFar = 0;

  return (
    <div className="max-w-3xl space-y-3">
      {thread.records.map((rec, i) => {
        switch (rec.record) {
          case 'user':
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-lg bg-nav/10 px-3 py-2 font-serif text-[15px] leading-6 whitespace-pre-wrap">
                  {String(rec.text)}
                </div>
              </div>
            );
          case 'assistant':
            return (
              <div key={i} className="group font-serif text-[15px] leading-7 whitespace-pre-wrap text-stone-800 dark:text-stone-200">
                {String(rec.text)}
                {/* Capture-from-message (Phase 6 §3): park this message as an
                    inbox item, provenance (source + author) riding the body. */}
                <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 align-middle inline-block">
                  <CaptureButton
                    compact
                    label="✦ capture"
                    seed={String(rec.text)}
                    provenance={{ source: 'message', author: 'assistant', messageSeq: i }}
                  />
                </span>
              </div>
            );
          case 'tool-result':
            if (rec.tool !== undefined && rec.tool !== 'Bash') return null;
            if (!/^=== /m.test(String(rec.text ?? ''))) return null;
            return <ToolResultBlock key={i} text={String(rec.text)} />;
          case 'turn-end': {
            // Whether THIS turn produced an ask is what the ask list records —
            // consume the next ask in order only when its turn matches.
            const ask = asksInOrder[detectedSoFar];
            if (ask && ask.turn === rec.turn) {
              detectedSoFar += 1;
              if (ask.answered) {
                return (
                  <div key={i} className="text-xs font-sans text-stone-400 border-l-2 border-stone-200 dark:border-stone-800 pl-2">
                    ◆ answered
                  </div>
                );
              }
            }
            return null;
          }
          default:
            return null;
        }
      })}

      {thread.state === 'errored' && (
        <div className="banner-degraded">
          The session errored{thread.lastError ? `: ${thread.lastError}` : ''}. Answering will retry by
          resuming it.
        </div>
      )}

      {thread.openGate &&
        (thread.openGate.kind === 'pass-through' ? (
          <PassThroughAsk gate={thread.openGate} onAnswer={onAnswer} busy={busy} />
        ) : thread.openGate.kind === 'batch-screen' ? (
          <BatchScreenCard card={thread.openGate} onAnswer={(text) => onAnswer(thread.openGate!.id, text)} busy={busy} />
        ) : (
          <GateCard
            card={thread.openGate}
            onAnswer={(text) => onAnswer(thread.openGate!.id, text)}
            busy={busy}
            onClaim={onClaim ? () => onClaim(thread.openGate!.id) : undefined}
          />
        ))}
      <div ref={bottomRef} />
    </div>
  );
}

export function PassThroughAsk({
  gate,
  onAnswer,
  busy,
}: {
  gate: GateCardData;
  onAnswer: (gateId: string, text: string) => void;
  busy?: boolean;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, [gate.id]);
  return (
    <div data-testid="pass-through-ask" className="border-t border-stone-200 dark:border-stone-800 pt-3">
      <ChatInput
        inputRef={inputRef}
        busy={busy}
        placeholder="reply…"
        sendLabel="reply"
        onSend={(text) => onAnswer(gate.id, text)}
        attach={{ bridgeSessionId: gate.session.bridgeSessionId, workUnit: gate.address.workUnit }}
      />
      {/* Working feedback while the reply's turn is in flight (a pass-through
          reply resumes the session — often many seconds). */}
      {busy && (
        <div className="mt-1.5">
          <Working label="the session is working…" />
        </div>
      )}
    </div>
  );
}
