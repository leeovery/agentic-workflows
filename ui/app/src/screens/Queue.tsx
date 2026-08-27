// S2 · The needs-you queue — full-height list in spec 5's order, two row
// anatomies (live ask / durable flag). A card-bearing row opens the card in
// an overlay; a pass-through row opens the thread; a durable row navigates to
// the surface that resolves it.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { api, useLive, type QueueRowData, type SessionData } from '../api';
import { GateCard } from '../components/GateCard';
import { BatchScreenCard } from '../components/BatchScreenCard';
import { EscalationChip } from '../components/EscalationChip';

function age(since: string): string {
  const ms = Date.now() - new Date(since).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

export function Queue() {
  const { data, reload } = useLive(() => api.queue());
  const { data: sessions } = useLive(() => api.sessions());
  const [overlayGate, setOverlayGate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const rows = data?.rows ?? [];
  const openCards = new Map(
    (sessions?.sessions ?? [])
      .filter((s: SessionData) => s.openGate)
      .map((s: SessionData) => [s.openGate!.id, s.openGate!]),
  );

  const select = (row: QueueRowData) => {
    if (row.tier === 'live' && row.gateId) {
      const card = openCards.get(row.gateId);
      if (card && card.kind !== 'pass-through') {
        setOverlayGate(row.gateId);
        return;
      }
      // Pass-through rows open the thread tail — never a fabricated card.
      navigate(`/s/${row.bridgeSessionId}`);
      return;
    }
    // Durable rows navigate to the surface that resolves them.
    if (row.address.workUnit) navigate(`/c/${row.address.workUnit}`);
  };

  const [answerNote, setAnswerNote] = useState<string | null>(null);
  const answer = async (gateId: string, text: string) => {
    setBusy(true);
    setAnswerNote(null);
    try {
      const res = await api.answerGate(gateId, text);
      // A blocked answer (watching / unread comments) keeps the card open with
      // the reason — never a silent no-op.
      if (res.ok === false) {
        setAnswerNote(res.error ?? res.reason ?? 'could not answer');
        return;
      }
      setOverlayGate(null);
    } finally {
      setBusy(false);
      reload();
    }
  };
  const claim = async (gateId: string) => {
    await api.claimGate(gateId);
    reload();
  };

  const overlay = overlayGate ? openCards.get(overlayGate) : null;

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="font-sans font-semibold text-lg mb-4">Needs you</h1>
      {rows.length === 0 && (
        <p className="text-sm font-sans text-stone-400">Nothing is waiting on you.</p>
      )}
      <div className="divide-y divide-stone-200/70 dark:divide-stone-800/70">
        {rows.map((row, i) => (
          <button
            key={`${row.tier}-${row.gateId ?? `${row.kind}-${row.address.workUnit}-${row.address.topic}-${i}`}`}
            onClick={() => select(row)}
            data-tier={row.tier}
            className="w-full text-left flex items-baseline gap-3 py-2.5 px-1 hover:bg-stone-100/60 dark:hover:bg-stone-900/60"
          >
            <span
              className={clsx(
                'font-mono text-xs shrink-0 w-24 truncate',
                row.tier === 'live' ? 'text-gate' : 'text-stone-500',
              )}
            >
              {row.tier === 'live' ? `◆ ${row.kind}` : `⚑ ${row.kind}`}
            </span>
            <span className="font-sans text-sm shrink-0 text-stone-600 dark:text-stone-400">
              {row.address.workUnit ?? 'lobby'}
              {row.address.topic && row.address.topic !== row.address.workUnit ? ` · ${row.address.topic}` : ''}
            </span>
            <span className="font-serif text-sm truncate flex-1 text-stone-800 dark:text-stone-200">
              {row.tier === 'live' ? (row.askPreview ?? '') : row.detail}
            </span>
            {/* Ownership + ceremony cues (Phase 6). */}
            {row.stuck ? (
              <span className="shrink-0 text-[10px] font-sans text-warn border border-warn/40 rounded px-1.5">stuck — claim?</span>
            ) : row.owner?.id && !row.owner.isYou ? (
              <span className="shrink-0 text-[10px] font-sans text-stone-400" title={`owned by ${row.owner.name}`}>watching</span>
            ) : row.owner?.isYou ? (
              <span className="shrink-0 text-[10px] font-sans text-ok">yours</span>
            ) : null}
            {(row.unreadComments ?? 0) > 0 && (
              <span className="shrink-0 text-[10px] font-mono text-gate" title="unread comments block sign-off">💬 {row.unreadComments}</span>
            )}
            {row.tier === 'live' && <EscalationChip since={row.since} escalated={row.escalated} />}
            <time className="font-sans text-xs text-stone-400 shrink-0">{age(row.since)}</time>
          </button>
        ))}
      </div>

      {overlay && (
        <div
          className="fixed inset-0 bg-black/30 z-40 flex items-start justify-center pt-24 px-4"
          onClick={() => setOverlayGate(null)}
        >
          <div className="w-full max-w-xl bg-stone-50 dark:bg-stone-950 rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 pt-3 text-xs font-sans text-stone-400">
              #{overlay.address.workUnit ?? 'lobby'} — the card answers here; the full thread is one click away.
            </div>
            <div className="px-2 pb-2">
              {overlay.kind === 'batch-screen' ? (
                <BatchScreenCard card={overlay} onAnswer={(text) => answer(overlay.id, text)} busy={busy} />
              ) : (
                <GateCard card={overlay} onAnswer={(text) => answer(overlay.id, text)} busy={busy} onClaim={() => claim(overlay.id)} />
              )}
              {answerNote && <p className="px-2 pb-1 text-xs font-sans text-warn">{answerNote}</p>}
              <button
                className="text-xs font-sans text-nav hover:underline px-2 pb-2"
                onClick={() => navigate(`/s/${overlay.session.bridgeSessionId}`)}
              >
                open the thread behind this card →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
