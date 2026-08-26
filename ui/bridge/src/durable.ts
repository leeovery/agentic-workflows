// The needs-you queue's DURABLE tier (spec 5) — waiting-on-you state readable
// from the record with no session anywhere: reconcile flags, stale sources,
// triage queues, blocked specs/plans (engine-derived, never re-derived here),
// and pending agent reports. Phase 1 consumes the per-unit counts for the
// lobby; Phase 2 builds the full queue on the same rows.
import path from 'node:path';
import type { Snapshot } from './snapshot.js';
import { scanAgentRows } from './watch.js';

export type DurableRow = {
  kind:
    | 'reconcile'
    | 'stale-source'
    | 'triage-waiting'
    | 'spec-blocked'
    | 'dep-blocked-plan'
    | 'report-pending';
  address: { workUnit: string; topic?: string; phase?: string };
  detail: string;
};

export function durableRows(snap: Snapshot, projectRoot: string): DurableRow[] {
  const rows: DurableRow[] = [];

  for (const [name, unit] of Object.entries(snap.units)) {
    const phases = unit.manifest?.phases ?? {};
    for (const [phase, data] of Object.entries<any>(phases)) {
      for (const [topic, item] of Object.entries<any>(data?.items ?? {})) {
        const reconcileFlagged = item?.reconcile_needed !== undefined;
        if (reconcileFlagged) {
          rows.push({
            kind: 'reconcile',
            address: { workUnit: name, topic, phase },
            detail: `input moved — ${item.reconcile_needed}`,
          });
        }
        // Stale source rows on spec items (either storage shape). One
        // staleness hop sets BOTH reconcile_needed and the stale source rows
        // in the same transition — one fact, one row: an item already
        // carrying the reconcile flag doesn't count its stale sources again.
        if (reconcileFlagged) continue;
        const sources = item?.sources;
        const entries = Array.isArray(sources)
          ? sources.map((s: any) => [s?.topic ?? s?.name, s] as const)
          : Object.entries<any>(sources ?? {});
        for (const [srcName, src] of entries) {
          const status = src?.status ?? src?.incorporated;
          if (status === 'stale' || status === 'pending') {
            rows.push({
              kind: 'stale-source',
              address: { workUnit: name, topic, phase },
              detail: `${srcName} ${status}`,
            });
          }
        }
      }
    }
    // Engine-derived blocked views (attached by the snapshot builder).
    for (const b of unit.derived?.specBlocked ?? []) {
      rows.push({
        kind: 'spec-blocked',
        address: { workUnit: name, topic: b.name },
        detail: `blocked by ${b.by.join(', ')}`,
      });
    }
    for (const b of unit.derived?.depBlocked ?? []) {
      rows.push({
        kind: 'dep-blocked-plan',
        address: { workUnit: name, topic: b.name },
        detail: `deps: ${b.holders.join(', ')}`,
      });
    }
  }

  for (const [key, count] of Object.entries(snap.triage)) {
    const [wu, phase, topic] = key.split('/');
    rows.push({
      kind: 'triage-waiting',
      address: { workUnit: wu!, topic, phase },
      detail: `${count} rerouted concern(s)`,
    });
  }

  // Pending agent reports (cache store): returned but not yet drained.
  for (const agent of scanAgentRows(path.join(projectRoot, '.workflows', '.cache'))) {
    if (agent.status === 'pending' || agent.status === 'acknowledged') {
      rows.push({
        kind: 'report-pending',
        address: agent.address,
        detail: `${agent.agentType} report awaiting drain`,
      });
    }
  }

  return rows;
}

export function durableCounts(rows: DurableRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    counts[r.address.workUnit] = (counts[r.address.workUnit] ?? 0) + 1;
  }
  return counts;
}
