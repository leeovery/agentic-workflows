// The roadmap surface (phase-4 §4) — horizons + items with lifecycle
// (waiting / pulled → the joined work unit / shipped), item provenance
// (origin), and links into the sessions record. Read-and-navigate: grooming
// and the pull run as lobby sessions (Phase 2).
import { Link } from 'react-router-dom';
import { api, useLive, type RoadmapData } from '../api';

const LIFECYCLE_CLS: Record<string, string> = {
  waiting: 'text-stone-400',
  'in-flight': 'text-nav',
  shipped: 'text-ok',
  orphaned: 'text-warn',
};

export function Roadmap() {
  const { data } = useLive<RoadmapData>(() => api.roadmap());
  if (!data) return <div className="p-8 font-sans text-sm text-stone-400">…</div>;
  if (!data.exists) {
    return (
      <div className="p-12 max-w-measure font-sans">
        <h1 className="text-xl font-semibold mb-3">No roadmap yet</h1>
        <p className="text-sm text-stone-600 dark:text-stone-400 leading-6">
          The product roadmap is created from a terminal session (<code className="font-mono">/workflow-roadmap</code>).
          Once it exists, its horizons and items appear here.
        </p>
      </div>
    );
  }

  const byHorizon = new Map<string, any[]>();
  for (const item of data.items) {
    const h = item.horizon ?? 'unplaced';
    (byHorizon.get(h) ?? byHorizon.set(h, []).get(h)!).push(item);
  }

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <header className="flex items-baseline gap-4">
        <h1 className="text-xl font-sans font-semibold">Roadmap</h1>
        <span className="text-xs font-mono text-stone-400">
          {data.totals.items} items · {data.totals.waiting} waiting · {data.totals.shipped} shipped
          {(data.totals.orphaned ?? 0) > 0 && ` · ${data.totals.orphaned} orphaned`}
        </span>
      </header>

      {/* Known horizons in order, then any horizon an item names that the list
          doesn't carry (a stale/hand-edited manifest) — so no item vanishes. */}
      {(() => {
        const known = data.horizons.map((h: any) => h.name ?? h);
        const extra = [...byHorizon.keys()].filter((k) => !known.includes(k));
        return [...known, ...extra];
      })().map((hn: string) => (
        <section key={hn}>
          <div className="region-label mb-2">{hn}</div>
          <div className="space-y-1.5">
            {(byHorizon.get(hn) ?? []).map((item: any, i: number) => (
              // state, work_unit, origin all come from the engine's own
              // roadmapState row — never re-derived here.
              <div key={item.summary ?? i} className="flex items-baseline gap-3 text-sm font-sans py-1">
                <span className={`font-mono text-[10px] shrink-0 w-16 ${LIFECYCLE_CLS[item.state] ?? 'text-stone-400'}`}>
                  {item.state ?? 'waiting'}
                </span>
                <span className="truncate flex-1">{item.summary}</span>
                {item.work_unit && (
                  <Link to={`/c/${item.work_unit}`} className="text-nav hover:underline shrink-0 text-xs">
                    #{item.work_unit}
                  </Link>
                )}
                {item.origin && <span className="text-stone-400 text-[10px] shrink-0">{item.origin}</span>}
              </div>
            ))}
            {(byHorizon.get(hn) ?? []).length === 0 && (
              <div className="text-xs font-sans text-stone-400">no items</div>
            )}
          </div>
        </section>
      ))}

      {data.sessions.length > 0 && (
        <section>
          <div className="region-label mb-2">Sessions</div>
          <div className="text-xs font-mono text-stone-500 space-y-0.5">
            {data.sessions.map((s: any, i: number) => (
              <div key={i}>{typeof s === 'string' ? s : (s.name ?? JSON.stringify(s))}</div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
