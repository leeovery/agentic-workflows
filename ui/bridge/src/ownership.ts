// Phase 6 §2 — gate ownership. Routing, NEVER process authority: the workflow
// record has no concept of which human answered, and this module must never
// invent one that can disagree with it. Everything here is UI-side steering —
// who the card is addressed to, whose submit is enabled — enforced only by the
// bridge's own API, never by the engine or the session process.
//
// Precedence when a gate opens (the walkthrough caught first-to-open disabling
// the driver of a live session):
//   1. the human who launched / drives the raising session (session_drivers)
//   2. else the channel default — first authenticated human to open the channel
// Both are claimable and reassignable, per gate and per channel.
//
// Stuck handling: an ESCALATED gate with no owner activity for T_stuck (24h)
// enters everyone's queue with a "stuck — claim?" chip.
import type { Db } from './db.js';
import type { GateCard } from '@workflow-ui/shared';

export type OwnerInfo = {
  ownerId: string | null;
  ownerName: string | null;
  stuck: boolean;
  lastActivityAt: string | null;
};

const nameOf = (db: Db, id: string | null): string | null => {
  if (!id) return null;
  const row = db.sqlite.prepare('SELECT name FROM humans WHERE id = ?').get(id) as { name: string } | undefined;
  return row?.name ?? id;
};

/** Record which human launched a bridge session (the primary ownership input). */
export function recordSessionDriver(db: Db, bridgeSessionId: string, humanId: string): void {
  db.sqlite
    .prepare('INSERT OR REPLACE INTO session_drivers (bridge_session_id, human_id) VALUES (?, ?)')
    .run(bridgeSessionId, humanId);
}

export function sessionDriver(db: Db, bridgeSessionId: string): string | null {
  const row = db.sqlite
    .prepare('SELECT human_id as humanId FROM session_drivers WHERE bridge_session_id = ?')
    .get(bridgeSessionId) as { humanId: string } | undefined;
  return row?.humanId ?? null;
}

/**
 * The channel default owner (first-write-wins). Records `humanId` as the
 * default the FIRST time a member opens the channel; later opens are no-ops.
 * Returns the current default.
 */
export function ensureChannelDefault(db: Db, project: string, channel: string, humanId: string): string {
  const now = new Date().toISOString();
  db.sqlite
    .prepare(
      `INSERT INTO channel_defaults (project, channel, owner_id, claimed_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(project, channel) DO NOTHING`,
    )
    .run(project, channel, humanId, now);
  return channelDefault(db, project, channel) ?? humanId;
}

export function channelDefault(db: Db, project: string, channel: string): string | null {
  const row = db.sqlite
    .prepare('SELECT owner_id as ownerId FROM channel_defaults WHERE project = ? AND channel = ?')
    .get(project, channel) as { ownerId: string } | undefined;
  return row?.ownerId ?? null;
}

/** Reassign a channel's default owner (an explicit, member-only act). */
export function reassignChannel(db: Db, project: string, channel: string, humanId: string): void {
  const now = new Date().toISOString();
  db.sqlite
    .prepare(
      `INSERT INTO channel_defaults (project, channel, owner_id, claimed_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(project, channel) DO UPDATE SET owner_id = excluded.owner_id, claimed_at = excluded.claimed_at`,
    )
    .run(project, channel, humanId, now);
}

/**
 * Assign an owner to a newly-opened gate by precedence. Idempotent: an already-
 * owned gate (a prior claim) keeps its owner. Writes gate_ledger.owner_id and
 * seeds owner activity. `channel` is the card's work unit (lobby gates fall to
 * the channel default of '').
 */
export function assignOwnerOnOpen(db: Db, project: string, card: Pick<GateCard, 'id' | 'session' | 'address'>): string | null {
  const existing = db.sqlite
    .prepare('SELECT owner_id as ownerId FROM gate_ledger WHERE gate_id = ?')
    .get(card.id) as { ownerId: string | null } | undefined;
  if (existing?.ownerId) return existing.ownerId;

  const channel = card.address.workUnit ?? '';
  const driver = sessionDriver(db, card.session.bridgeSessionId);
  const owner = driver ?? channelDefault(db, project, channel);
  if (owner) {
    db.sqlite.prepare('UPDATE gate_ledger SET owner_id = ? WHERE gate_id = ?').run(owner, card.id);
    noteOwnerActivity(db, card.id, owner);
  }
  return owner;
}

/**
 * Claim (or reassign) a gate to `humanId`. Ownership is routing, so any member
 * may claim — the direction of error is toward letting a human take
 * responsibility, never toward locking them out. Records fresh owner activity.
 */
export function claimGate(db: Db, gateId: string, humanId: string): void {
  db.sqlite.prepare('UPDATE gate_ledger SET owner_id = ? WHERE gate_id = ?').run(humanId, gateId);
  noteOwnerActivity(db, gateId, humanId);
}

export function noteOwnerActivity(db: Db, gateId: string, ownerId: string | null): void {
  db.sqlite
    .prepare(
      `INSERT INTO gate_owner_activity (gate_id, owner_id, last_activity_at) VALUES (?, ?, ?)
       ON CONFLICT(gate_id) DO UPDATE SET owner_id = excluded.owner_id, last_activity_at = excluded.last_activity_at`,
    )
    .run(gateId, ownerId, new Date().toISOString());
}

/**
 * The owner/stuck view of a gate. Stuck = the gate is escalated AND its owner
 * has not touched it within T_stuck. An unowned gate is never "stuck" (there is
 * no one to be unresponsive) — it is simply claimable.
 */
export function ownerInfo(
  db: Db,
  gateId: string,
  opts: { escalated: boolean; now: number; stuckMs: number },
): OwnerInfo {
  const ledger = db.sqlite
    .prepare('SELECT owner_id as ownerId FROM gate_ledger WHERE gate_id = ?')
    .get(gateId) as { ownerId: string | null } | undefined;
  const activity = db.sqlite
    .prepare('SELECT last_activity_at as at FROM gate_owner_activity WHERE gate_id = ?')
    .get(gateId) as { at: string } | undefined;
  const ownerId = ledger?.ownerId ?? null;
  const lastActivityAt = activity?.at ?? null;
  const stuck =
    opts.escalated &&
    ownerId !== null &&
    lastActivityAt !== null &&
    opts.now - new Date(lastActivityAt).getTime() > opts.stuckMs;
  return { ownerId, ownerName: nameOf(db, ownerId), stuck, lastActivityAt };
}

/**
 * May `humanId` submit an answer to this gate? UI-side routing only.
 *   - single-user / no ownership recorded → always yes (zero-config).
 *   - the owner → yes.
 *   - a non-owner → NO while the owner is active; YES once the gate is stuck
 *     (the "claim?" path) — answering then implicitly claims it.
 * The engine enforces none of this; a terminal answer bypasses it entirely.
 */
export function mayAnswer(
  db: Db,
  gateId: string,
  humanId: string,
  opts: { escalated: boolean; now: number; stuckMs: number },
): { ok: boolean; reason?: string } {
  const info = ownerInfo(db, gateId, opts);
  if (info.ownerId === null) return { ok: true };
  if (info.ownerId === humanId) return { ok: true };
  if (info.stuck) return { ok: true }; // stuck owner → any member may claim + answer
  return { ok: false, reason: `owned by ${info.ownerName} — you are watching (claim to answer)` };
}

// The durable event types that RESOLVE a decision a card was gating — the
// signal that the same decision was answered outside the UI (a terminal
// session, the MCP surface, any path the bridge doesn't mediate).
//
// A sign-off resolves ONLY on `phase.completed` (which is topic-addressed): a
// spec sign-off IS a phase completing. `workunit.status-changed` is topicless
// (derive.cjs addresses it {workUnit} only) and fires on cancel/reactivate too,
// so keying signoff off it resolved EVERY open sign-off card on the unit,
// including for a cancelled unit — a false positive (round-12 G1). It stays the
// signal for a LIFECYCLE (unit-level cancel) gate, which is unit-addressed.
const RESOLVING_EVENTS: Record<string, readonly string[]> = {
  signoff: ['phase.completed'],
  lifecycle: ['workunit.status-changed'],
};

/**
 * Was the decision this card gates answered OUTSIDE the UI? We only claim it
 * for cards whose gateType we can join to a durable resolving signal on the
 * SAME address, post-dating the card — never a guess. Returns the resolving
 * event's ts, or null.
 *
 * This is the "answered outside the UI" detector (done-means): a terminal
 * sign-off flips the manifest; the watcher stores the durable event; this join
 * resolves the still-open card within one watcher cycle.
 */
export function externallyResolvedAt(
  card: Pick<GateCard, 'gateType' | 'address' | 'openedAt'>,
  durableEvents: { type: string; ts: string; address: { workUnit?: string; topic?: string } }[],
): string | null {
  const kinds = card.gateType ? RESOLVING_EVENTS[card.gateType] : undefined;
  if (!kinds) return null;
  const opened = new Date(card.openedAt).getTime();
  for (const e of durableEvents) {
    if (!kinds.includes(e.type)) continue;
    if (e.address.workUnit !== card.address.workUnit) continue;
    // If the card names a topic, the resolving signal must match it (an epic's
    // other topics completing must not resolve this card).
    if (card.address.topic && e.address.topic && e.address.topic !== card.address.topic) continue;
    if (new Date(e.ts).getTime() >= opened) return e.ts;
  }
  return null;
}
