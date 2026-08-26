// SessionHealthBadge (catalog: P2, intent 2) — spec 2's states with a resume
// affordance where it applies. A state, not spinner theatre (motion rule).
import { clsx } from 'clsx';

const COPY: Record<string, { label: string; cls: string }> = {
  live: { label: 'live', cls: 'text-ok border-ok/40' },
  'idle-at-ask': { label: 'waiting on you', cls: 'text-gate border-gate/40' },
  stalled: { label: 'stalled', cls: 'text-warn border-warn/40' },
  errored: { label: 'errored', cls: 'text-blocked border-blocked/40' },
  dead: { label: 'resumable', cls: 'text-stone-400 border-stone-300' },
  ended: { label: 'ended', cls: 'text-stone-400 border-stone-300' },
};

export function SessionHealthBadge({ state, error }: { state: string; error?: string }) {
  const c = COPY[state] ?? COPY.dead!;
  return (
    <span
      data-testid="session-health"
      title={error}
      className={clsx('font-sans text-[10px] uppercase tracking-wide border rounded px-1.5 py-0.5', c.cls)}
    >
      {c.label}
    </span>
  );
}
