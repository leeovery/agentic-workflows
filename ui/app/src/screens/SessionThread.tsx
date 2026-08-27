// S4 · Thread — the conversation surface for a bridge-driven session
// (conversation mode; drain and telemetry arrive with Phases 3 and 5).
import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { api, useLive } from '../api';
import { Thread } from '../components/Thread';
import { SessionHealthBadge } from '../components/SessionHealthBadge';

export function SessionThread() {
  const { id = '' } = useParams();
  const { data: thread, reload } = useLive(() => api.thread(id), [id]);
  const [busy, setBusy] = useState(false);

  if (!thread) return <div className="p-8 font-sans text-sm text-stone-400">…</div>;

  const meta = thread.records.find((r) => r.record === 'meta');
  const address = thread.openGate?.address;

  const [note, setNote] = useState<string | null>(null);
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
      {note && <p className="max-w-3xl mt-2 text-xs font-sans text-warn">{note}</p>}
    </div>
  );
}
