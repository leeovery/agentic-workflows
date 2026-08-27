// Phase 6 §4 — presence, the two honest kinds:
//
//   humans VIEWING  — UI presence, a heartbeat with a TTL (this module). Replaces
//                     Phase 3's provisional single activity signal.
//   sessions WORKING — workflow heartbeats. research/discussion carry a real
//                     engine heartbeat (scanPresence, elsewhere); OTHER phases
//                     have none, so their coexistence is INFERRED from lock
//                     mtimes + commits and labelled `inferred` — never presented
//                     as certain, never as absence-of-work.
import fs from 'node:fs';
import path from 'node:path';
import type { Db } from './db.js';

const VIEW_TTL_MS = 90_000; // a viewer heartbeat older than this has left

export type ViewingHuman = { humanId: string; name: string; lastSeenAt: string };

/** A viewer heartbeat: `humanId` is viewing `channel` (work unit, or '' for
 *  the lobby). Called from the activity route; cheap upsert. */
export function beatViewing(db: Db, project: string, humanId: string, channel: string): void {
  db.sqlite
    .prepare(
      `INSERT INTO human_presence (human_id, project, channel, last_seen_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(human_id, project, channel) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
    )
    .run(humanId, project, channel, new Date().toISOString());
}

/** Humans viewing a channel within the TTL — excludes the requesting human so
 *  the strip reads "others here", never counting yourself. */
export function humansViewing(
  db: Db,
  project: string,
  channel: string,
  now: number,
  excludeHumanId?: string,
): ViewingHuman[] {
  const rows = db.sqlite
    .prepare(
      `SELECT p.human_id as humanId, p.last_seen_at as lastSeenAt, COALESCE(h.name, p.human_id) as name
       FROM human_presence p LEFT JOIN humans h ON h.id = p.human_id
       WHERE p.project = ? AND p.channel = ?`,
    )
    .all(project, channel) as ViewingHuman[];
  return rows.filter(
    (r) => now - new Date(r.lastSeenAt).getTime() < VIEW_TTL_MS && r.humanId !== excludeHumanId,
  );
}

export type InferredSession = { phase: string; topic: string; mtime: string; inferred: true };

// The engine heartbeat covers these — never infer for them (the real signal
// wins, and inferring would double-count).
const HEARTBEAT_PHASES = new Set(['research', 'discussion']);
const INFER_TTL_MS = 15 * 60 * 1000; // a presence file touched within 15m = plausibly live

/**
 * Best-effort "a session may be working here" for the phases WITHOUT an engine
 * heartbeat. Those phases write NO `presence` file (the engine only heartbeats
 * research/discussion — reading a presence file here would always find nothing,
 * round-12 G3). Instead we read the mtime of the topic's cache `state.json` —
 * the per-topic session machinery every active phase writes — as the lock-mtime
 * signal the plan names. Every row is marked `inferred: true`; the UI labels it
 * as such and never renders it beside a real heartbeat as equally certain.
 */
export function inferredWorkingSessions(projectRoot: string, wu: string, now: number): InferredSession[] {
  const base = path.join(projectRoot, '.workflows', '.cache', wu);
  const out: InferredSession[] = [];
  let phases: string[];
  try {
    phases = fs.readdirSync(base).filter((n) => !n.startsWith('.'));
  } catch {
    return out;
  }
  for (const phase of phases) {
    if (HEARTBEAT_PHASES.has(phase)) continue;
    let topics: string[];
    try {
      topics = fs.readdirSync(path.join(base, phase)).filter((n) => !n.startsWith('.'));
    } catch {
      continue;
    }
    for (const topic of topics) {
      // Newest of state.json (session machinery) or the topic dir itself — a
      // recent touch means a session plausibly worked here lately.
      const topicDir = path.join(base, phase, topic);
      let mtimeMs = 0;
      for (const p of [path.join(topicDir, 'state.json'), topicDir]) {
        try {
          mtimeMs = Math.max(mtimeMs, fs.statSync(p).mtimeMs);
        } catch {
          /* absent — try the next signal */
        }
      }
      if (mtimeMs > 0 && now - mtimeMs < INFER_TTL_MS) {
        out.push({ phase, topic, mtime: new Date(mtimeMs).toISOString(), inferred: true });
      }
    }
  }
  return out;
}
