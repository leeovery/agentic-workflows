// Phase 6 §3 — the durable failed-capture lobby row. A capture whose ephemeral
// session failed lands HERE, payload retained, until it succeeds or is
// discarded — never a vanishing toast. Offered, never nagging.
import type { FailedCapture } from '../api';
import { api } from '../api';

export function FailedCaptures({ rows, onChange }: { rows: FailedCapture[]; onChange?: () => void }) {
  if (rows.length === 0) return null;
  const retry = async (id: string) => {
    await api.retryCapture(id);
    onChange?.();
  };
  const discard = async (id: string) => {
    await api.discardCapture(id);
    onChange?.();
  };
  return (
    <section data-testid="failed-captures" className="mb-4 rounded-lg border border-warn/40 bg-warn/5 p-3">
      <div className="text-xs font-sans font-medium text-warn mb-1.5">
        {rows.length} capture{rows.length > 1 ? 's' : ''} failed — the text is safe here to retry.
      </div>
      <div className="space-y-1.5">
        {rows.map((c) => (
          <div key={c.id}>
            <div className="flex items-baseline gap-2 text-sm">
              <span className="font-mono text-[10px] text-stone-400 shrink-0 w-16">{c.kind}</span>
              <span className="font-serif truncate flex-1 text-stone-700 dark:text-stone-300">{c.payload}</span>
              <button onClick={() => retry(c.id)} className="text-xs font-sans text-nav hover:underline shrink-0">
                retry
              </button>
              <button onClick={() => discard(c.id)} className="text-xs font-sans text-stone-400 hover:underline shrink-0">
                discard
              </button>
            </div>
            {/* The reason, so a persistently-failing retry isn't opaque. */}
            {c.error && <div className="ml-[4.5rem] text-[11px] font-mono text-stone-400 truncate">{c.error}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
