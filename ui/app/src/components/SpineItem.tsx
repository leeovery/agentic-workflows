// SpineItem (catalog: P1, intent 5) — four variants: gate ref (gold, Phase 2)
// · phase completion · unit status change · tombstone ref. The spine carries
// nothing else; commits and machinery live in the drawer.
import { clsx } from 'clsx';

export type SpineEvent = {
  type: string;
  ts: string;
  address: { workUnit?: string; topic?: string; phase?: string };
  payload: Record<string, any>;
};

function when(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function SpineItem({ event }: { event: SpineEvent }) {
  const base = 'flex items-baseline gap-3 py-2 border-b border-stone-200/70 dark:border-stone-800/70';
  switch (event.type) {
    case 'gate.opened': {
      // The gate ref — gold, the reserved accent. A one-line reference that
      // navigates (never a card on the spine); live producers arrive with
      // Phase 2's session manager.
      const card = (event.payload.card ?? event.payload) as Record<string, any>;
      return (
        <div className={base} data-variant="gate-ref">
          <span className="font-mono text-gate text-sm">◆</span>
          <span className="font-sans text-sm text-gate">
            {card.question ?? 'a gate is open'}
          </span>
          <time className="ml-auto text-xs text-stone-400 font-sans">{when(event.ts)}</time>
        </div>
      );
    }
    case 'phase.completed':
      return (
        <div className={base} data-variant="phase-completion">
          <span className="font-mono text-ok text-sm">●</span>
          <span className="font-sans text-sm">
            <span className="font-mono">{event.payload.phase}</span> completed
            {event.payload.topic !== event.address.workUnit && (
              <span className="text-stone-500"> · {event.payload.topic}</span>
            )}
          </span>
          <time className="ml-auto text-xs text-stone-400 font-sans">{when(event.ts)}</time>
        </div>
      );
    case 'workunit.status-changed':
      return (
        <div className={base} data-variant="unit-status-change">
          <span className={clsx('font-mono text-sm', event.payload.to === 'completed' ? 'text-ok' : 'text-stone-400')}>
            ◆
          </span>
          <span className="font-sans text-sm">
            unit <span className="font-mono">{event.payload.from}</span> →{' '}
            <span className="font-mono">{event.payload.to}</span>
          </span>
          <time className="ml-auto text-xs text-stone-400 font-sans">{when(event.ts)}</time>
        </div>
      );
    case 'workunit.removed':
      return (
        <div className={base} data-variant="tombstone">
          <span className="font-mono text-stone-400 text-sm">▣</span>
          <span className="font-sans text-sm text-stone-600 dark:text-stone-400">
            {event.payload.successor ? (
              <>continued as <span className="font-mono">{String(event.payload.successor)}</span></>
            ) : (
              'archived'
            )}
          </span>
          <time className="ml-auto text-xs text-stone-400 font-sans">{when(event.ts)}</time>
        </div>
      );
    default:
      // Inadmissible types never reach the spine; render nothing rather than
      // inventing a variant.
      return null;
  }
}
