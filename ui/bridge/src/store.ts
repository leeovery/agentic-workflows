// The durable event store: assigns persistent sequence numbers (once, never
// re-assigned; a restart continues the counter), enforces id-idempotency, and
// arbitrates epoch changes (spec 3).
import type { Db } from './db.js';
import type { RawEvent } from './derive.js';

export type StoredEvent = RawEvent & { seq: number };

export class EventStore {
  constructor(
    private db: Db,
    readonly project: string,
  ) {}

  meta(): { epoch: string; lastSeq: number; spineTip: string | null } | null {
    const row = this.db.sqlite
      .prepare('SELECT epoch, last_seq as lastSeq, spine_tip as spineTip FROM project_meta WHERE project = ?')
      .get(this.project) as { epoch: string; lastSeq: number; spineTip: string | null } | undefined;
    return row ?? null;
  }

  setMeta(epoch: string, spineTip: string | null): void {
    this.db.sqlite
      .prepare(
        `INSERT INTO project_meta (project, epoch, last_seq, spine_tip) VALUES (?, ?, -1, ?)
         ON CONFLICT(project) DO UPDATE SET epoch = excluded.epoch, spine_tip = excluded.spine_tip`,
      )
      .run(this.project, epoch, spineTip);
  }

  /** Append durable events, skipping ids already stored (at-least-once, idempotent). */
  append(events: RawEvent[]): StoredEvent[] {
    const has = this.db.sqlite.prepare('SELECT 1 FROM event_log WHERE project = ? AND event_id = ?');
    const insert = this.db.sqlite.prepare(
      'INSERT INTO event_log (project, epoch, seq, event_id, body) VALUES (?, ?, ?, ?, ?)',
    );
    const bump = this.db.sqlite.prepare('UPDATE project_meta SET last_seq = ? WHERE project = ?');
    const metaRow = this.db.sqlite
      .prepare('SELECT last_seq as lastSeq FROM project_meta WHERE project = ?')
      .get(this.project) as { lastSeq: number } | undefined;
    let seq = metaRow?.lastSeq ?? -1;

    const stored: StoredEvent[] = [];
    const tx = this.db.sqlite.transaction(() => {
      for (const e of events) {
        if (has.get(this.project, e.id)) continue;
        seq += 1;
        const s: StoredEvent = { ...e, seq };
        insert.run(this.project, e.epoch, seq, e.id, JSON.stringify(s));
        stored.push(s);
      }
      bump.run(seq, this.project);
    });
    tx();
    return stored;
  }

  readFrom(seq: number): StoredEvent[] {
    const rows = this.db.sqlite
      .prepare('SELECT body FROM event_log WHERE project = ? AND seq >= ? ORDER BY seq')
      .all(this.project, seq) as { body: string }[];
    return rows.map((r) => JSON.parse(r.body));
  }

  /**
   * Epoch change (history rewrite / branch switch / restore): invalidate every
   * cursor for the project, mark unreachable read refs, wipe the event log so
   * the new epoch's stream re-derives — the durable stream is a pure function
   * of the repo, and the repo changed identity. Clients full-resync.
   */
  onEpochChange(newEpoch: string, spineTip: string | null, reachable: (sha: string) => boolean): void {
    const tx = this.db.sqlite.transaction(() => {
      this.db.sqlite.prepare('DELETE FROM stream_cursors WHERE project = ?').run(this.project);
      const refs = this.db.sqlite
        .prepare('SELECT human_id as humanId, artifact, sha FROM artifact_read_refs WHERE project = ?')
        .all(this.project) as { humanId: string; artifact: string; sha: string }[];
      for (const r of refs) {
        if (!reachable(r.sha)) {
          this.db.sqlite
            .prepare(
              'UPDATE artifact_read_refs SET state = ? WHERE project = ? AND human_id = ? AND artifact = ?',
            )
            .run('history-rewritten', this.project, r.humanId, r.artifact);
        }
      }
      this.db.sqlite.prepare('DELETE FROM event_log WHERE project = ?').run(this.project);
      // The counter continues across epochs — seq is assigned once and never
      // re-assigned; only the (epoch, seq) cursor pairing is invalidated.
      this.db.sqlite
        .prepare(
          `INSERT INTO project_meta (project, epoch, last_seq, spine_tip) VALUES (?, ?, -1, ?)
           ON CONFLICT(project) DO UPDATE SET epoch = excluded.epoch, spine_tip = excluded.spine_tip`,
        )
        .run(this.project, newEpoch, spineTip);
    });
    tx();
  }
}
