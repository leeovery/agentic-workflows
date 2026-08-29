// S4 · Thread — the conversation surface for a bridge-driven session
// (conversation mode; drain and telemetry arrive with Phases 3 and 5).
import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { api, useLive } from '../api';
import { Thread } from '../components/Thread';
import { SessionHealthBadge } from '../components/SessionHealthBadge';
import { ChatInput } from '../components/ChatInput';
import { Working } from '../components/Working';

export function SessionThread() {
  const { id = '' } = useParams();
  const { data: thread, reload } = useLive(() => api.thread(id), [id]);
  const [busy, setBusy] = useState(false);
  // Hooks must run on every render in the same order — this useState must sit
  // ABOVE the `if (!thread) return` below, never after it (React error #310).
  const [note, setNote] = useState<string | null>(null);

  if (!thread) return <div className="p-8 font-sans text-sm text-stone-400">…</div>;

  const meta = thread.records.find((r) => r.record === 'meta');
  const address = thread.openGate?.address;

  const answer = async (gateId: string, text: string) => {
    setBusy(true);
    setNote(null);
    try {
      const res = await api.answerGate(gateId, text, id);
      // A watcher / unread-comment block keeps the card and says why (round-12).
      if (res.ok === false) setNote(res.error ?? res.reason ?? 'could not answer');
    } finally {
      setBusy(false);
      reload();
    }
  };
  const claim = async (gateId: string) => {
    await api.claimGate(gateId);
    reload();
  };
  const resume = async (text: string) => {
    setBusy(true);
    setNote(null);
    try {
      const res = await api.resumeSession(id, text);
      if (res.ok === false) setNote(res.error ?? res.reason ?? 'could not resume');
    } finally {
      setBusy(false);
      reload();
    }
  };
  // An interrupted (dead) or errored session has no open gate — the thread would
  // otherwise dead-end with no input. Offer a free-text turn to resume it (the
  // "resumable" badge finally has an affordance).
  const resumable = !thread.openGate && (thread.state === 'dead' || thread.state === 'errored');

  return (
    <div className="p-8">
      <header className="max-w-3xl flex items-baseline gap-3 mb-4">
        <h1 className="font-sans font-semibold text-lg">
          {address?.workUnit ? (
            <Link to={`/c/${address.workUnit}`} className="hover:underline">
              #{address.workUnit}
            </Link>
          ) : (
            'shaping thread'
          )}
        </h1>
        <span className="font-mono text-[11px] text-stone-400">{String(meta?.entryPrompt ?? '')}</span>
        <SessionHealthBadge state={thread.state} error={thread.lastError} />
        <button
          onClick={async () => {
            await api.endSession(id);
            reload();
          }}
          className="ml-auto text-xs font-sans text-stone-400 hover:text-blocked"
        >
          end session
        </button>
      </header>
      <Thread thread={thread} onAnswer={answer} busy={busy} onClaim={claim} />
      {resumable && (
        <div data-testid="resume-box" className="max-w-3xl mt-4 border-t border-stone-200 dark:border-stone-800 pt-3">
          <p className="text-xs font-sans text-stone-400 mb-1.5">
            This session was {thread.state === 'errored' ? 'errored' : 'interrupted'} — send a message to resume it.
          </p>
          <ChatInput
            busy={busy}
            placeholder="resume the session…"
            sendLabel="resume"
            onSend={resume}
            attach={{ bridgeSessionId: id, workUnit: thread.openGate?.address?.workUnit }}
          />
          {busy && (
            <div className="mt-1.5">
              <Working label="resuming…" />
            </div>
          )}
        </div>
      )}
      {note && <p className="max-w-3xl mt-2 text-xs font-sans text-warn">{note}</p>}
    </div>
  );
}
