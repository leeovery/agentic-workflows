// PresenceStrip (catalog: P2/6, intent 1) — the three honest presences, each
// rendered distinctly and labelled for what it is:
//   · humans VIEWING       — UI heartbeat (Phase 6), "N here now"
//   · sessions WORKING      — engine heartbeat, research/discussion only
//   · sessions INFERRED     — best-effort from lock mtimes, other phases,
//                             always marked "inferred", never as certain
export type PresenceRow = {
  phase?: string;
  topic?: string;
  held?: boolean;
  live?: boolean;
  age?: string;
  session_id?: string;
};
export type ViewingHuman = { humanId: string; name: string; lastSeenAt: string };
export type InferredSession = { phase: string; topic: string; mtime: string; inferred: true };

export function PresenceStrip({
  rows,
  humansViewing = [],
  inferred = [],
}: {
  rows: PresenceRow[];
  humansViewing?: ViewingHuman[];
  inferred?: InferredSession[];
}) {
  const working = rows.filter((r) => r.held);
  if (working.length === 0 && humansViewing.length === 0 && inferred.length === 0) return null;
  return (
    <div data-testid="presence-strip" className="flex flex-wrap items-center gap-2 text-xs font-sans text-stone-500">
      {humansViewing.length > 0 && (
        <span className="flex items-center gap-1 border border-nav/40 rounded px-1.5 py-0.5" title={humansViewing.map((h) => h.name).join(', ')}>
          <span className="text-nav">◉</span>
          {humansViewing.length === 1 ? `${humansViewing[0]!.name} is here` : `${humansViewing.length} others here`}
        </span>
      )}
      {working.map((r, i) => (
        <span key={`w${i}`} className="flex items-center gap-1 border border-stone-300 dark:border-stone-700 rounded px-1.5 py-0.5">
          <span className={r.live ? 'text-ok' : 'text-stone-400'}>●</span>
          a session is in <span className="font-mono">{r.topic ?? '?'}</span>
          {r.phase && <span className="text-stone-400">({r.phase})</span>}
        </span>
      ))}
      {inferred.map((r, i) => (
        <span
          key={`i${i}`}
          className="flex items-center gap-1 border border-dashed border-stone-300 dark:border-stone-700 rounded px-1.5 py-0.5"
          title="inferred from recent file activity — not a confirmed heartbeat"
        >
          <span className="text-stone-400">◌</span>
          maybe working in <span className="font-mono">{r.topic}</span>
          <span className="text-stone-400">({r.phase}, inferred)</span>
        </span>
      ))}
    </div>
  );
}
