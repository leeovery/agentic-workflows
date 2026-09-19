// Phase 6 §5 — comments, with ceremony. Channel-native threads on gates and
// artifacts (the Phase 0 `comments` table). The ceremony: a comment on an OPEN
// gate badges the card and its queue row and shows an unread-comments indicator
// ON THE CONFIRM CONTROL — a sign-off cannot be finalised without passing it
// (the walkthrough caught a blocking concern being signed over unseen).
//
// Comments never push (spec 5 keeps them off the notification path). A quote
// affordance inserts a comment into the owner's answer draft — the bridge never
// injects bystander text implicitly.
import type { Db } from './db.js';

export type CommentRow = {
  id: number;
  humanId: string;
  author: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export type CommentTarget = { gateId: string } | { artifact: string };

function where(target: CommentTarget): { clause: string; value: string } {
  return 'gateId' in target
    ? { clause: 'gate_id = ?', value: target.gateId }
    : { clause: 'artifact = ?', value: target.artifact };
}

export function addComment(
  db: Db,
  project: string,
  humanId: string,
  target: CommentTarget,
  body: string,
): number {
  const now = new Date().toISOString();
  const info = db.sqlite
    .prepare(
      `INSERT INTO comments (human_id, project, gate_id, artifact, body, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      humanId,
      project,
      'gateId' in target ? target.gateId : null,
      'artifact' in target ? target.artifact : null,
      body,
      now,
    );
  const id = Number(info.lastInsertRowid);
  // The author has, by definition, seen their own comment — so it never counts
  // as unread against them (a self-comment must not block your own confirm).
  markRead(db, humanId, [id]);
  return id;
}

/** Comments on a target, oldest first, flagged read/unread for `viewerId`. */
export function listComments(db: Db, project: string, target: CommentTarget, viewerId: string): CommentRow[] {
  const w = where(target);
  const rows = db.sqlite
    .prepare(
      `SELECT c.id as id, c.human_id as humanId, COALESCE(h.name, c.human_id) as author,
              c.body as body, c.created_at as createdAt,
              (SELECT 1 FROM comment_reads r WHERE r.comment_id = c.id AND r.human_id = ?) as readFlag
       FROM comments c LEFT JOIN humans h ON h.id = c.human_id
       WHERE c.project = ? AND c.${w.clause}
       ORDER BY c.id ASC`,
    )
    .all(viewerId, project, w.value) as (Omit<CommentRow, 'read'> & { readFlag: number | null })[];
  return rows.map(({ readFlag, ...r }) => ({ ...r, read: readFlag === 1 }));
}

export function markRead(db: Db, humanId: string, commentIds: number[]): void {
  const now = new Date().toISOString();
  const stmt = db.sqlite.prepare(
    'INSERT OR IGNORE INTO comment_reads (human_id, comment_id, read_at) VALUES (?, ?, ?)',
  );
  const tx = db.sqlite.transaction((ids: number[]) => {
    for (const id of ids) stmt.run(humanId, id, now);
  });
  tx(commentIds);
}

/** Mark every comment on a target read for a viewer (opening the thread). */
export function markTargetRead(db: Db, project: string, target: CommentTarget, viewerId: string): void {
  const ids = listComments(db, project, target, viewerId).filter((c) => !c.read).map((c) => c.id);
  if (ids.length > 0) markRead(db, viewerId, ids);
}

/**
 * How many comments on a gate `viewerId` has NOT seen — the number that badges
 * the card/row and, while > 0, blocks the confirm. The viewer's own comments
 * never count (they're auto-read at post).
 */
export function unreadForGate(db: Db, project: string, gateId: string, viewerId: string): number {
  const row = db.sqlite
    .prepare(
      `SELECT COUNT(*) as n FROM comments c
       WHERE c.project = ? AND c.gate_id = ?
         AND NOT EXISTS (SELECT 1 FROM comment_reads r WHERE r.comment_id = c.id AND r.human_id = ?)`,
    )
    .get(project, gateId, viewerId) as { n: number };
  return row.n;
}

/** Total comments on a gate (for the badge count, read or not). */
export function countForGate(db: Db, project: string, gateId: string): number {
  const row = db.sqlite
    .prepare('SELECT COUNT(*) as n FROM comments WHERE project = ? AND gate_id = ?')
    .get(project, gateId) as { n: number };
  return row.n;
}
