// Digests (phase-3 §3, §6) — assembled from workflow events at natural breaks.
// Contents per spec 5: what LANDED (commits + artifacts — their only roll-up,
// never on the spine), what WAITS (the queue's current rows; the lobby render
// suppresses this), what's NEXT (the engine's own next-phase surface, embedded
// verbatim, never re-derived). Pure composition — no new derivation.
import type { StoredEvent } from './store.js';
import type { QueueRow } from './queue.js';

export type Digest = {
  channel: string;
  landed: { commits: { sha: string; subject: string }[]; artifacts: string[] };
  waiting: QueueRow[];
  next: string | null; // engine next-phase render, verbatim
  emittedAt: string;
};

export function buildDigest(
  channel: string,
  events: StoredEvent[],
  queue: QueueRow[],
  nextRender: string | null,
  since: string,
  now: string,
): Digest {
  const cut = new Date(since).getTime();
  const inWindow = events.filter((e) => new Date(e.ts).getTime() >= cut);
  const commits = inWindow
    .filter((e) => e.type === 'commit.landed' && ((e.payload as any).scope ?? []).includes(channel))
    .map((e) => ({ sha: String((e.payload as any).sha).slice(0, 8), subject: (e.payload as any).subject }));
  const artifacts = [
    ...new Set(
      inWindow
        .filter((e) => e.type === 'artifact.updated' && e.address.workUnit === channel)
        .map((e) => (e.payload as any).path as string),
    ),
  ];
  return {
    channel,
    landed: { commits, artifacts },
    waiting: queue.filter((r) => r.address.workUnit === channel),
    next: nextRender,
    emittedAt: now,
  };
}

/**
 * The lobby digest strip — pure concatenation of channel digests, WITH the
 * waiting section suppressed (NEEDS YOU already shows those rows one strip up,
 * per the duplication discipline).
 */
export function lobbyStrip(digests: Digest[]): Omit<Digest, 'waiting'>[] {
  return digests.map(({ waiting, ...rest }) => {
    void waiting;
    return rest;
  });
}
