// DigestCard (catalog: P3 — intent 3, 5) — S6 as a card, not a route. Three
// sections: landed / waiting / next. The lobby render suppresses waiting
// (NEEDS YOU shows those rows one strip up — the duplication discipline).
import type { DigestStripEntry } from '../api';

export function DigestCard({ digest, suppressWaiting = true }: { digest: DigestStripEntry; suppressWaiting?: boolean }) {
  const hasLanded = digest.landed.commits.length > 0 || digest.landed.artifacts.length > 0;
  if (!hasLanded && !digest.next) return null;
  return (
    <div className="rounded-lg border border-stone-200 dark:border-stone-800 p-3 text-sm">
      <div className="font-sans font-medium mb-1.5">#{digest.channel}</div>
      {hasLanded && (
        <div className="mb-1.5">
          <div className="region-label mb-0.5">landed</div>
          {digest.landed.commits.map((c) => (
            <div key={c.sha} className="font-mono text-xs text-stone-500 truncate">
              <span className="text-stone-400">{c.sha}</span> {c.subject}
            </div>
          ))}
          {digest.landed.artifacts.map((a) => (
            <div key={a} className="font-mono text-xs text-stone-500 truncate">
              <span className="text-stone-400">artifact</span> {a}
            </div>
          ))}
        </div>
      )}
      {!suppressWaiting && <div className="region-label mb-0.5">waiting shown in the queue</div>}
      {digest.next && (
        <div>
          <div className="region-label mb-0.5">next</div>
          <pre className="engine-embed text-[11px]">{digest.next}</pre>
        </div>
      )}
    </div>
  );
}
