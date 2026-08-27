// Delivery surfaces (S3 telemetry mode / S4, phase-5) — the quiet end of the
// cone: a calm progress report that never demands attention, collapsed by
// default, never animates (the anti-theater rule). Every datum traces to the
// telemetry source inventory. Read-only.
import { useState } from 'react';
import { clsx } from 'clsx';
import type { TopicTelemetry, PlanDagData, PlanTask } from '../api';

// TelemetrySurface (catalog: P5, intent 4/5) — manifest-sourced loop state,
// in-place updates, collapsed by default.
export function TelemetrySurface({ t, extra }: { t: TopicTelemetry; extra?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const consulting = false; // the consult state arrives as a live gate, not here
  const blocked = t.depBlocked.length > 0;
  return (
    <div
      data-testid="telemetry"
      className={clsx(
        'rounded-lg border text-sm',
        blocked ? 'border-warn/40' : t.consolidation.gated ? 'border-gate/40' : 'border-stone-200 dark:border-stone-800',
      )}
    >
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-baseline gap-3 px-3 py-2 text-left">
        <span className="font-sans font-medium">{t.topic}</span>
        <span className="font-mono text-xs text-stone-500">
          {t.status}
          {t.currentPhase && ` · phase ${t.currentPhase}`}
          {t.currentTask && ` · ${t.currentTask}`}
        </span>
        <span className="ml-auto flex items-center gap-2 text-xs">
          {t.agentsActive > 0 && (
            <span className="text-nav font-sans" title="background agents reading">
              ● {t.agentsActive} reading
            </span>
          )}
          {blocked && <span className="text-warn font-sans">⚑ dep-blocked</span>}
          {t.consolidation.gated && <span className="text-gate font-sans">◆ consolidation</span>}
          <span className="text-stone-400">{open ? '▾' : '▸'}</span>
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-stone-200/70 dark:border-stone-800/70 pt-2">
          {t.completedPhases.length > 0 && (
            <div className="text-xs font-sans text-stone-500">
              completed phases: <span className="font-mono">{t.completedPhases.join(', ')}</span>
            </div>
          )}
          {t.completedTasks.length > 0 && (
            <div className="text-xs font-sans text-stone-500">{t.completedTasks.length} task(s) done</div>
          )}
          {(t.fixAttempts > 0 || t.analysisCycles > 0) && (
            <div className="text-xs font-sans text-stone-500">
              {t.fixAttempts} fix attempt(s) · {t.analysisCycles} analysis cycle(s)
            </div>
          )}
          {blocked && (
            <div className="text-xs font-sans text-warn">
              waiting on: {t.depBlocked.map((d) => d.topic).join(', ')}
            </div>
          )}
          {t.commitsLanded.length > 0 && (
            <div className="space-y-0.5">
              <div className="region-label">commits</div>
              {t.commitsLanded.slice(-5).map((c) => (
                <div key={c.sha} className="text-xs font-mono text-stone-500 truncate">
                  <span className="text-stone-400">{c.sha}</span> {c.subject}
                </div>
              ))}
            </div>
          )}
          {/* The heavy telemetry (consolidation, plan graph) lives HERE, behind
              the per-topic toggle — so the channel scroll stays density-neutral
              and the conversation/telemetry seam never occurs (S3 spec). */}
          {extra}
        </div>
      )}
      {void consulting}
    </div>
  );
}

// ConsolidationCard (catalog: P5, intent 3) — the boundary sweep as one
// decide-shaped screen: the bank, the finder's staged tasks. Consistent with
// the lanes. (Answering rides the session's own gate — this is the read view.)
export function ConsolidationCard({ t }: { t: TopicTelemetry }) {
  const { bank, staging } = t.consolidation;
  const staged = Object.entries(staging).flatMap(([p, tasks]) => tasks.map((x: any) => ({ phase: p, task: x })));
  if (!t.consolidation.gated && bank.length === 0 && staged.length === 0) return null;
  return (
    <div data-testid="consolidation-card" className="rounded-lg border-2 border-gate/60 p-3 my-2">
      <div className="flex items-baseline gap-2 mb-2">
        <span className="font-mono text-gate">◆</span>
        <span className="font-sans font-medium text-sm">Consolidation boundary — {t.topic}</span>
      </div>
      {bank.length > 0 && (
        <div className="mb-2">
          <div className="region-label mb-1">banked opportunities ({bank.length})</div>
          {bank.slice(0, 5).map((b: any, i: number) => (
            <div key={i} className="text-xs font-sans text-stone-600 dark:text-stone-400 truncate">
              {b.opportunity ?? b.summary ?? b.title ?? JSON.stringify(b).slice(0, 60)}
            </div>
          ))}
        </div>
      )}
      {staged.length > 0 && (
        <div>
          <div className="region-label mb-1">staged for this phase ({staged.length})</div>
          {staged.slice(0, 5).map((s, i) => (
            <div key={i} className="text-xs font-mono text-stone-500 truncate">
              {s.phase}: {s.task.title ?? `task ${s.task.task}`}
              {s.task.decision && <span className="text-stone-400"> — {s.task.decision}</span>}
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 text-[11px] font-sans text-stone-400">
        Decide this in the session that opened the gate — this surface is the read view.
      </div>
    </div>
  );
}

// PlanDAG (catalog: P5) — @xyflow would be a heavy dep for a read-only,
// scannable graph; a dependency-ordered layered layout in plain CSS meets the
// bar and stays self-contained. Dep edges shown as "after: …" chips.
const TASK_STATUS_CLS: Record<string, string> = {
  completed: 'border-ok/50 text-ok',
  'in-progress': 'border-nav/50 text-nav',
  pending: 'border-stone-300 dark:border-stone-700 text-stone-500',
  blocked: 'border-warn/50 text-warn',
};

// Natural id compare so {topic}-1-10 sorts after {topic}-1-2.
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

function layer(tasks: PlanTask[]): { layers: PlanTask[][]; hasCycle: boolean } {
  // Longest-path layering: a task sits one level below its deepest dependency.
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const depth = new Map<string, number>();
  let hasCycle = false;
  const compute = (id: string, seen: Set<string>): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (seen.has(id)) {
      hasCycle = true;
      return 0; // cycle guard — reported honestly below
    }
    seen.add(id);
    const t = byId.get(id);
    const d = t && t.dependsOn.length ? 1 + Math.max(...t.dependsOn.map((x) => compute(x, seen))) : 0;
    depth.set(id, d);
    return d;
  };
  for (const t of tasks) compute(t.id, new Set());
  const layers: PlanTask[][] = [];
  for (const t of tasks) (layers[depth.get(t.id) ?? 0] ??= []).push(t);
  for (const col of layers) if (col) col.sort((a, b) => naturalCompare(a.id, b.id));
  return { layers, hasCycle };
}

export function PlanDAG({ dag }: { dag: PlanDagData }) {
  if (dag.format === 'linear') {
    return (
      <div className="banner-degraded text-sm">
        This plan is tracked in Linear. The bridge has no Linear credentials, so the graph opens there:{' '}
        {dag.linkOut ? (
          <a href={dag.linkOut} className="text-nav underline">
            open in Linear
          </a>
        ) : (
          <span className="text-stone-500">link unavailable</span>
        )}
      </div>
    );
  }
  if (dag.format === 'unknown' || dag.tasks.length === 0) {
    return <div className="text-sm font-sans text-stone-400">no plan tasks yet</div>;
  }
  const { layers, hasCycle } = layer(dag.tasks);
  return (
    <div data-testid="plan-dag" className="overflow-x-auto">
      {hasCycle && (
        <div className="banner-degraded text-xs mb-2">
          This plan has a dependency cycle — the graph below is a best-effort layout, not a strict order.
        </div>
      )}
      <div className="flex gap-6 min-w-max py-2">
        {layers.map((col, i) => (
          <div key={i} className="flex flex-col gap-2">
            {col.map((task) => (
              <div
                key={task.id}
                className={clsx('rounded border px-2.5 py-1.5 text-xs w-48', TASK_STATUS_CLS[task.status] ?? TASK_STATUS_CLS.pending)}
              >
                <div className="font-sans font-medium truncate">{task.title}</div>
                <div className="font-mono text-[10px] text-stone-400 truncate">
                  {task.id} · {task.status}
                </div>
                {task.dependsOn.length > 0 && (
                  <div className="text-[10px] text-stone-400 truncate">after: {task.dependsOn.join(', ')}</div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
