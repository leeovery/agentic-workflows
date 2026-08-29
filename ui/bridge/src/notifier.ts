// The notifier (phase-3 §2) — turns ceremony decisions into at-most-one
// notification per pending item, arbitrated by the DURABLE push ledger so a
// bridge restart re-pushes nothing (spec 5). Suppression is time-based (an
// existence-based version starves every gate after the first); quiet-hours
// pushes accrue into a morning roll-up; the T_roll window collapses a burst.
import type { Db } from './db.js';
import { logger } from './log.js';
import { isPushLike, type Ceremony } from './attention.js';

export type NotifyDecision = {
  rowKey: string; // queue-row id / drain id
  ceremony: Ceremony;
  contentHash: string; // re-push only on content change or escalation re-cross
  escalated?: boolean;
};

export type Delivered = { rowKey: string; kind: 'push' | 'alert'; body: string };

export type NotifierConfig = {
  rollupMinutes: number; // T_roll
  quietStart: string; // "22:00"
  quietEnd: string; // "08:00"
  morningHour: number; // pinned morning digest/roll-up hour
};

export class Notifier {
  constructor(
    private db: Db,
    readonly project: string,
    private cfg: NotifierConfig,
    // Injected sink (web-push in production; captured in tests).
    private deliver: (d: Delivered) => void,
  ) {}

  private ledgerGet(rowKey: string, kind: string): { decidedAt: string; contentHash: string } | undefined {
    return this.db.sqlite
      .prepare('SELECT decided_at as decidedAt, content_hash as contentHash FROM push_ledger WHERE row_key = ? AND kind = ?')
      .get(rowKey, kind) as any;
  }

  private ledgerSet(rowKey: string, kind: string, contentHash: string, at: string): void {
    this.db.sqlite
      .prepare(
        `INSERT INTO push_ledger (row_key, kind, decided_at, content_hash) VALUES (?, ?, ?, ?)
         ON CONFLICT(row_key, kind) DO UPDATE SET decided_at = excluded.decided_at, content_hash = excluded.content_hash`,
      )
      .run(rowKey, kind, at, contentHash);
  }

  /**
   * Decide and (maybe) fire ONE notification for a pending item. Returns what
   * was delivered, or null when suppressed/accrued/badged. Idempotent by the
   * ledger: the same (rowKey, contentHash) never fires twice; a content change
   * or a fresh escalation re-cross does.
   */
  notify(d: NotifyDecision, body: string, now: Date, quietHours = false): Delivered | null {
    const nowIso = now.toISOString();
    // 'none' (engaged) and badge/digest (batch — badge + digest surface, NEVER
    // an OS push) deliver nothing now; the queue/digest carry them.
    if (!isPushLike(d.ceremony)) return null;

    const kind = d.ceremony === 'alert' ? 'alert' : 'push';
    const prior = this.ledgerGet(d.rowKey, kind);
    if (prior && prior.contentHash === d.contentHash && !d.escalated) {
      // Already delivered for this content — a restart re-pushes nothing.
      return null;
    }
    // Quiet-hours: a would-be push accrues; the morning roll-up fires it.
    // Nothing is so urgent it beats sleep (spec 5).
    if (quietHours) {
      this.ledgerSet(d.rowKey, 'accrued', d.contentHash, nowIso);
      return null;
    }
    // Roll-up: a non-escalation push within T_roll of another collapses into
    // the accrued set (drained shortly after by the intraday roll-up).
    // Escalations ALWAYS fire — a stopped session is spent attention.
    if (!d.escalated && this.withinRollup(now)) {
      this.ledgerSet(d.rowKey, 'accrued', d.contentHash, nowIso);
      return null;
    }
    this.ledgerSet(d.rowKey, kind, d.contentHash, nowIso);
    this.ledgerSet('__last_push__', 'window', '', nowIso);
    const delivered: Delivered = { rowKey: d.rowKey, kind, body };
    this.deliver(delivered);
    logger.info('notification fired', { rowKey: d.rowKey, kind });
    return delivered;
  }

  private withinRollup(now: Date): boolean {
    const last = this.ledgerGet('__last_push__', 'window');
    if (!last) return false;
    return now.getTime() - new Date(last.decidedAt).getTime() < this.cfg.rollupMinutes * 60_000;
  }

  /** The oldest accrued row's age in ms, or null if none accrued. */
  private oldestAccruedAgeMs(now: Date): number | null {
    const row = this.db.sqlite
      .prepare("SELECT MIN(decided_at) as t FROM push_ledger WHERE kind = 'accrued'")
      .get() as { t: string | null } | undefined;
    if (!row?.t) return null;
    return now.getTime() - new Date(row.t).getTime();
  }

  /**
   * The intraday roll-up: outside quiet hours, once accrued pushes have aged
   * past T_roll, fire them as ONE roll-up. (Quiet-hours accrual waits for the
   * morning drain instead.) Returns what it delivered, or null.
   */
  maybeRollup(now: Date, quietHours: boolean): Delivered | null {
    if (quietHours) return null;
    const age = this.oldestAccruedAgeMs(now);
    if (age === null || age < this.cfg.rollupMinutes * 60_000) return null;
    return this.drainAccrued(now, 'waiting');
  }

  /**
   * Fire the accrued set as ONE roll-up (the morning roll-up, or the T_roll
   * collapse). Clears the accrual ledger. Returns the roll-up body, or null
   * if nothing accrued.
   */
  drainAccrued(now: Date, label = 'waiting'): Delivered | null {
    const rows = this.db.sqlite.prepare("SELECT row_key as rowKey FROM push_ledger WHERE kind = 'accrued'").all() as {
      rowKey: string;
    }[];
    if (rows.length === 0) return null;
    const units = new Set(rows.map((r) => r.rowKey.split(':')[0]));
    const body = `${rows.length} ${label} across ${units.size} work unit${units.size === 1 ? '' : 's'}`;
    this.db.sqlite.prepare("DELETE FROM push_ledger WHERE kind = 'accrued'").run();
    const delivered: Delivered = { rowKey: '__rollup__', kind: 'push', body };
    this.deliver(delivered);
    this.ledgerSet('__last_push__', 'window', '', now.toISOString());
    logger.info('roll-up fired', { count: rows.length, units: units.size });
    return delivered;
  }

  /** Is `now` within the configured quiet-hours window? */
  inQuietHours(now: Date): boolean {
    return withinDailyWindow(now, this.cfg.quietStart, this.cfg.quietEnd);
  }
}

/** True if the local wall-clock time is within [start, end), wrapping midnight. */
export function withinDailyWindow(now: Date, start: string, end: string): boolean {
  const mins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = sh! * 60 + sm!;
  const e = eh! * 60 + em!;
  return s <= e ? mins >= s && mins < e : mins >= s || mins < e;
}
