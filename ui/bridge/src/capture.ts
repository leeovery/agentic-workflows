// Phase 6 §3 — the capture gesture. Any human parks any channel message or text
// selection as an inbox item, via an EPHEMERAL headless session invoking the
// capture skill with the payload as its single turn. Acknowledge optimistically
// (the SPA shows a toast at once), reconcile on completion; a FAILED capture
// lands as a durable lobby row with the payload retained UI-side until it
// succeeds or is discarded — never a vanishing toast.
//
// Message-level provenance (who, which message) lives in the UI ledger (the
// failed_captures row + the toast) and the captured file's BODY — never in a
// workflow state field.
import crypto from 'node:crypto';
import type { Db } from './db.js';
import type { SessionDriver } from './sessions.js';
import { sessionEnv } from './sessions.js';
import { logger } from './log.js';

export type CaptureKind = 'idea' | 'bug' | 'quickfix' | 'roadmap';
export type CaptureProvenance = { source: string; gateId?: string; artifact?: string; messageSeq?: number; author?: string };

export type CaptureRequest = {
  kind: CaptureKind;
  payload: string;
  provenance: CaptureProvenance;
  humanId: string;
};

export type CaptureResult = { ok: true } | { ok: false; captureId: string; error: string };

export type FailedCaptureRow = {
  id: string;
  kind: string;
  payload: string;
  provenance: CaptureProvenance | null;
  error: string | null;
  failedAt: string;
};

// A roadmap-shaped capture has no confirmable origin token (UPSTREAM.md #3 was
// WITHDRAWN — the product's own doctrine is that an unconfirmable capture is an
// inbox item, promoted later). So it lands as an idea with a note, not a
// roadmap park. The other kinds map to their capture skill directly.
const SKILL: Record<CaptureKind, { skill: string; note?: string }> = {
  idea: { skill: 'workflow-log-idea' },
  bug: { skill: 'workflow-log-bug' },
  quickfix: { skill: 'workflow-log-quickfix' },
  roadmap: {
    skill: 'workflow-log-idea',
    note: 'Captured as a roadmap-shaped thought; parked to the inbox as an idea (no confirmed roadmap origin at capture time).',
  },
};

/** The single-turn prompt handed to the capture skill. Provenance rides the
 *  BODY (a note the skill weaves into the file), never a state field. */
export function capturePrompt(req: CaptureRequest): string {
  const meta = SKILL[req.kind];
  const prov = req.provenance;
  const lines = [
    `/${meta.skill} ${req.payload}`,
    '',
    '---',
    `Captured via the workflow bridge${prov.author ? ` by ${prov.author}` : ''}.`,
    `Source: ${prov.source}${prov.gateId ? ` (gate ${prov.gateId})` : ''}${prov.artifact ? ` (artifact ${prov.artifact})` : ''}.`,
  ];
  if (meta.note) lines.push(meta.note);
  return lines.join('\n');
}

export class CaptureRunner {
  constructor(
    private db: Db,
    private driver: SessionDriver,
    private opts: { projectRoot: string; project: string; allowedTools?: string[]; displayWidth?: number },
  ) {}

  /**
   * Run one capture turn to completion. Returns ok on the SDK's `completed`
   * result; on any error (SDK error result or a thrown exception) records a
   * durable failed-capture row and returns its id. The payload is retained on
   * that row so a retry needs nothing from the user.
   */
  async run(req: CaptureRequest): Promise<CaptureResult> {
    const prompt = capturePrompt(req);
    const env: Record<string, string> = { WORKFLOWS_DISPLAY_WIDTH: String(this.opts.displayWidth ?? 65) };
    try {
      let errored: string | null = null;
      for await (const ev of this.driver.runTurn({
        prompt,
        cwd: this.opts.projectRoot,
        allowedTools: this.opts.allowedTools,
        env: sessionEnv(env),
      })) {
        if (ev.type === 'result' && ev.outcome === 'error') errored = ev.error ?? 'capture session errored';
      }
      if (errored) return this.recordFailure(req, errored);
      return { ok: true };
    } catch (err) {
      return this.recordFailure(req, String((err as Error).message ?? err));
    }
  }

  private recordFailure(req: CaptureRequest, error: string): CaptureResult {
    const id = `cap-${crypto.randomBytes(6).toString('hex')}`;
    this.db.sqlite
      .prepare(
        `INSERT INTO failed_captures (id, project, human_id, kind, payload, provenance, error, failed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        this.opts.project,
        req.humanId,
        req.kind,
        req.payload,
        JSON.stringify(req.provenance),
        error,
        new Date().toISOString(),
      );
    logger.warn('capture failed — retained as a durable lobby row', { id, kind: req.kind, error });
    return { ok: false, captureId: id, error };
  }

  /** Retry a failed capture. On success the row is cleared; on failure it stays
   *  (with the fresh error), so a persistent failure never silently vanishes. */
  async retry(captureId: string): Promise<CaptureResult> {
    const row = this.db.sqlite
      .prepare('SELECT kind, payload, provenance, human_id as humanId FROM failed_captures WHERE id = ?')
      .get(captureId) as { kind: CaptureKind; payload: string; provenance: string | null; humanId: string } | undefined;
    if (!row) return { ok: true }; // already cleared
    const req: CaptureRequest = {
      kind: row.kind,
      payload: row.payload,
      provenance: row.provenance ? JSON.parse(row.provenance) : { source: 'retry' },
      humanId: row.humanId,
    };
    const result = await this.run(req);
    if (result.ok) this.discard(captureId);
    return result;
  }

  discard(captureId: string): void {
    this.db.sqlite.prepare('DELETE FROM failed_captures WHERE id = ?').run(captureId);
  }

  list(): FailedCaptureRow[] {
    const rows = this.db.sqlite
      .prepare(
        'SELECT id, kind, payload, provenance, error, failed_at as failedAt FROM failed_captures WHERE project = ? ORDER BY failed_at DESC',
      )
      .all(this.opts.project) as { id: string; kind: string; payload: string; provenance: string | null; error: string | null; failedAt: string }[];
    return rows.map((r) => ({ ...r, provenance: r.provenance ? JSON.parse(r.provenance) : null }));
  }
}
