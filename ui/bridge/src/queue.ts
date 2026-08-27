// The needs-you queue (phase-2 §6, spec 5): ONE list joining the durable tier
// (manifest-derived waiting-on-you state — all sessions, terminal included)
// and the live tier (open asks from bridge-session projections). The tier
// split is honest UI: a terminal session's open ask is not knowable without
// the upstream outbox.
import type { DurableRow } from './durable.js';
import type { SessionManager } from './sessions.js';
import type { EventStore } from './store.js';
import type { GateCard } from '@workflow-ui/shared';

export type QueueRow = {
  tier: 'live' | 'durable';
  kind: string;
  address: { workUnit?: string; topic?: string; phase?: string };
  stage: 0 | 1 | 2;
  since: string;
  escalated: boolean;
  detail: string;
  gateId?: string;
  bridgeSessionId?: string;
  askPreview?: string;
  buildOrderPos?: number;
};

// The three D's: Discovery 0 · Definition 1 · Delivery 2; lobby/addressless
// rows are stage 0 (the cone's widest end).
const PHASE_STAGE: Record<string, 0 | 1 | 2> = {
  discovery: 0,
  research: 0,
  discussion: 0,
  investigation: 0,
  scoping: 1,
  specification: 1,
  planning: 1,
  implementation: 2,
  review: 2,
};

export function stageOf(address: { phase?: string; workUnit?: string }): 0 | 1 | 2 {
  if (!address.workUnit) return 0;
  return PHASE_STAGE[address.phase ?? ''] ?? 0;
}

/**
 * `since` for durable rows: the introducing COMMIT's time, read from the
 * durable event store (survives restarts); observation time only for
 * uncommitted flags and live rows.
 */
function durableSince(row: DurableRow, store: EventStore | null): string {
  if (store) {
    const events = store.readFrom(0);
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i]!;
      if (
        e.address.workUnit === row.address.workUnit &&
        e.address.topic === row.address.topic &&
        (e.type === 'flag.input-moved' || e.type === 'triage.changed' || e.type === 'source.state-changed' ||
          e.type === 'derived.spec-blocked' || e.type === 'derived.dep-blocked')
      ) {
        return e.ts;
      }
    }
  }
  return new Date().toISOString();
}

export function buildQueue(
  durable: DurableRow[],
  sessions: SessionManager | null,
  store: EventStore | null,
  buildOrder: Record<string, Record<string, number>> = {},
): QueueRow[] {
  const rows: QueueRow[] = [];
  // buildOrderPos joins a row's (workUnit, topic) against the epic's spec
  // build order (spec 5 clause 4 — incomparable across units, so it only
  // tie-breaks within one epic at equal stage).
  const orderOf = (a: { workUnit?: string; topic?: string }) =>
    a.workUnit && a.topic ? buildOrder[a.workUnit]?.[a.topic] : undefined;

  if (sessions) {
    for (const s of sessions.list()) {
      const g: GateCard | null = s.openGate;
      if (!g || g.state !== 'open') continue;
      rows.push({
        tier: 'live',
        kind: g.kind,
        address: g.address,
        stage: stageOf(g.address),
        since: g.openedAt,
        escalated: false,
        detail: g.question ?? g.context.split('\n')[0] ?? '',
        gateId: g.id,
        bridgeSessionId: s.bridgeSessionId,
        askPreview: g.question ?? g.context.slice(0, 120),
        buildOrderPos: orderOf(g.address),
      });
    }
  }

  for (const d of durable) {
    rows.push({
      tier: 'durable',
      kind: d.kind,
      address: d.address,
      stage: stageOf(d.address),
      since: durableSince(d, store),
      escalated: false,
      detail: d.detail,
      buildOrderPos: orderOf(d.address),
    });
  }

  // Spec 5 lexicographic sort: escalated desc · live before durable · stage
  // asc · buildOrderPos within one epic (incomparable across units — skipped
  // here until epics carry it) · since asc.
  rows.sort((a, b) => {
    if (a.escalated !== b.escalated) return a.escalated ? -1 : 1;
    if (a.tier !== b.tier) return a.tier === 'live' ? -1 : 1;
    if (a.stage !== b.stage) return a.stage - b.stage;
    if (
      a.buildOrderPos !== undefined &&
      b.buildOrderPos !== undefined &&
      a.address.workUnit === b.address.workUnit
    ) {
      return a.buildOrderPos - b.buildOrderPos;
    }
    return a.since.localeCompare(b.since);
  });
  return rows;
}
