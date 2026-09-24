// EscalationChip (catalog: P3 — intent 3) — idle-at-ask age, with a
// quiet-hours accrual marker. A state, not a countdown that performs.
function ageLabel(sinceMs: number): string {
  const m = Math.floor((Date.now() - sinceMs) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

export function EscalationChip({ since, escalated, quiet }: { since: string; escalated?: boolean; quiet?: boolean }) {
  const ms = Date.parse(since);
  if (Number.isNaN(ms)) return null;
  return (
    <span
      className={`font-sans text-[10px] rounded px-1.5 py-0.5 border ${
        escalated ? 'text-gate border-gate/40' : 'text-stone-400 border-stone-300 dark:border-stone-700'
      }`}
    >
      idle {ageLabel(ms)}
      {escalated && ' · escalated'}
      {quiet && ' · holds till morning'}
    </span>
  );
}
