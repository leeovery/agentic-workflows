// PresenceStrip (catalog: P2/6, intent 1) — sessions working, from the
// engine's own scanPresence: held/live verdicts for research/discussion;
// nothing is inferred for other phases (their coexistence is best-effort and
// says so elsewhere). Humans-viewing arrives with Phase 6.
export type PresenceRow = {
  phase?: string;
  topic?: string;
  held?: boolean;
  live?: boolean;
  age?: string;
  session_id?: string;
};

export function PresenceStrip({ rows }: { rows: PresenceRow[] }) {
  const active = rows.filter((r) => r.held);
  if (active.length === 0) return null;
  return (
    <div data-testid="presence-strip" className="flex items-center gap-2 text-xs font-sans text-stone-500">
      {active.map((r, i) => (
        <span key={i} className="flex items-center gap-1 border border-stone-300 dark:border-stone-700 rounded px-1.5 py-0.5">
          <span className={r.live ? 'text-ok' : 'text-stone-400'}>●</span>
          a session is in <span className="font-mono">{r.topic ?? '?'}</span>
          {r.phase && <span className="text-stone-400">({r.phase})</span>}
        </span>
      ))}
    </div>
  );
}
