// Phase 6 §3 — the capture gesture. Any human parks a note as an inbox item.
// Acknowledge OPTIMISTICALLY (the toast appears the instant you submit, before
// the ephemeral capture session finishes), reconcile on completion. A failure
// is never a vanishing toast — it becomes a durable lobby row (server-side),
// and the toast says so.
import { useState } from 'react';
import { api } from '../api';

type Toast = { text: string; tone: 'pending' | 'ok' | 'fail' };

const KINDS: { value: string; label: string }[] = [
  { value: 'idea', label: 'idea' },
  { value: 'bug', label: 'bug' },
  { value: 'quickfix', label: 'quick-fix' },
  { value: 'roadmap', label: 'roadmap (→ inbox)' },
];

export function CaptureButton({ provenance }: { provenance?: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('idea');
  const [payload, setPayload] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);

  const submit = async () => {
    const text = payload.trim();
    if (text === '') return;
    setOpen(false);
    setPayload('');
    // Optimistic: the gesture is acknowledged at once (seconds, not ms, for the
    // ephemeral session — spec risk: latency must never block the gesture).
    setToast({ text: 'Capturing…', tone: 'pending' });
    try {
      const res = await api.capture(kind, text, { source: 'capture-gesture', ...provenance });
      if (res.ok) setToast({ text: 'Captured to the inbox.', tone: 'ok' });
      else setToast({ text: 'Capture failed — kept on the lobby to retry.', tone: 'fail' });
    } catch {
      setToast({ text: 'Capture failed — kept on the lobby to retry.', tone: 'fail' });
    }
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-sans text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 border border-stone-300 dark:border-stone-700 rounded px-2 py-1"
        title="park a note as an inbox item"
      >
        ✦ capture
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-30 w-72 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg shadow-xl p-3">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-full mb-2 rounded border border-stone-300 dark:border-stone-700 bg-transparent px-2 py-1 text-xs font-sans"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            autoFocus
            rows={3}
            placeholder="what's on your mind…"
            className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-2 py-1 text-sm font-sans focus:outline-none focus:border-gate"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => setOpen(false)} className="text-xs font-sans text-stone-500">
              cancel
            </button>
            <button onClick={submit} disabled={payload.trim() === ''} className="text-xs font-sans rounded px-2 py-1 bg-nav text-white disabled:opacity-40">
              capture
            </button>
          </div>
        </div>
      )}
      {toast && (
        <div
          data-testid="capture-toast"
          className={`absolute right-0 mt-1 z-30 text-xs font-sans rounded px-2 py-1 border ${
            toast.tone === 'ok'
              ? 'text-ok border-ok/40'
              : toast.tone === 'fail'
                ? 'text-warn border-warn/40'
                : 'text-stone-500 border-stone-300 dark:border-stone-700'
          } bg-stone-50 dark:bg-stone-950`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
