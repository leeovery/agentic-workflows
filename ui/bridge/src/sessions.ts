// The session manager (phase-2 §1) — drives workflow sessions headless per
// specs/session-lifecycle.md. Invocation model: ONE query per human turn,
// answers submitted via resume; turn-complete = the SDK result message.
// Gates are a PROJECTION of session state re-derived from the journal —
// never a table; the ledger is the durable audit record, not the source.
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import { execFile } from 'node:child_process';
import type { Db } from './db.js';
import { Journal, openAsk, deriveAsks, type DerivedAsk } from './journal.js';
import { logger } from './log.js';
import type { GateCard } from '@workflow-ui/shared';

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

// --- driver abstraction -----------------------------------------------------
// The SDK behind an interface so tests (and replay adoption) can script it.

export type DriverEvent =
  | { type: 'init'; sdkSessionId: string }
  | { type: 'assistant'; text: string }
  | { type: 'tool-use'; tool: string; id?: string; input?: unknown }
  | { type: 'tool-result'; tool?: string; id?: string; text: string }
  | { type: 'usage'; inputTokens?: number; outputTokens?: number; costUsd?: number }
  | { type: 'result'; outcome: 'completed' | 'error'; error?: string };

export type TurnOptions = {
  prompt: string;
  cwd: string;
  resume?: string;
  allowedTools?: string[];
  env: Record<string, string>;
};

export interface SessionDriver {
  runTurn(opts: TurnOptions): AsyncIterable<DriverEvent>;
}

/** The real SDK driver — a thin translation of query() messages. */
export class SdkDriver implements SessionDriver {
  constructor(private model?: string) {}

  async *runTurn(opts: TurnOptions): AsyncIterable<DriverEvent> {
    const { query } = await import('@anthropic-ai/claude-agent-sdk');
    const toolNames = new Map<string, string>();
    const q = query({
      prompt: opts.prompt,
      options: {
        cwd: opts.cwd,
        ...(opts.resume ? { resume: opts.resume } : {}),
        ...(this.model ? { model: this.model } : {}),
        permissionMode: 'default',
        ...(opts.allowedTools ? { allowedTools: opts.allowedTools } : {}),
        env: { ...process.env, ...opts.env },
        settingSources: ['project'] as any,
      },
    });
    for await (const msg of q as AsyncIterable<any>) {
      if (msg.type === 'system' && msg.subtype === 'init') {
        yield { type: 'init', sdkSessionId: msg.session_id };
      } else if (msg.type === 'assistant') {
        const content = msg.message?.content;
        if (Array.isArray(content)) {
          const text = content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
          if (text) yield { type: 'assistant', text };
          for (const b of content) {
            if (b.type === 'tool_use') {
              toolNames.set(b.id, b.name);
              yield { type: 'tool-use', tool: b.name, id: b.id, input: b.input };
            }
          }
        }
        if (msg.message?.usage) {
          yield {
            type: 'usage',
            inputTokens: msg.message.usage.input_tokens,
            outputTokens: msg.message.usage.output_tokens,
          };
        }
      } else if (msg.type === 'user') {
        const content = msg.message?.content;
        if (Array.isArray(content)) {
          for (const b of content) {
            if (b.type === 'tool_result') {
              const text = Array.isArray(b.content)
                ? b.content.map((c: any) => (typeof c === 'string' ? c : (c?.text ?? ''))).join('\n')
                : String(b.content ?? '');
              yield { type: 'tool-result', tool: toolNames.get(b.tool_use_id), id: b.tool_use_id, text };
            }
          }
        }
      } else if (msg.type === 'result') {
        yield {
          type: 'usage',
          costUsd: msg.total_cost_usd,
        };
        yield {
          type: 'result',
          outcome: msg.subtype === 'success' ? 'completed' : 'error',
          error: msg.subtype === 'success' ? undefined : String(msg.subtype),
        };
      }
    }
  }
}

// --- the manager ------------------------------------------------------------

export type SessionState = 'live' | 'idle-at-ask' | 'stalled' | 'errored' | 'dead' | 'ended';

export type SessionRow = {
  bridgeSessionId: string;
  sdkSessionId: string | null;
  address: { workUnit?: string; topic?: string; phase?: string };
  state: SessionState;
  openGate: GateCard | null;
  lastError?: string;
};

const T_STALL_MS = 120_000;

export class SessionManager extends EventEmitter {
  private sessions = new Map<string, SessionRow>();
  private mutex = new Map<string, Promise<unknown>>();
  private stallTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private db: Db,
    private driver: SessionDriver,
    readonly opts: {
      projectRoot: string;
      project: string;
      bridgeId: string;
      journalsDir: string;
      allowedTools?: string[];
      displayWidth?: number;
      enginePath?: string | null;
    },
  ) {
    super();
  }

  list(): SessionRow[] {
    return [...this.sessions.values()];
  }

  get(bridgeSessionId: string): SessionRow | undefined {
    return this.sessions.get(bridgeSessionId);
  }

  /** Serialize all gate/session transitions per session (spec 1). */
  private locked<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.mutex.get(id) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    this.mutex.set(id, next.catch(() => undefined));
    return next;
  }

  async start(address: SessionRow['address'], entryPrompt: string): Promise<SessionRow> {
    const bridgeSessionId = `bs-${crypto.randomUUID().slice(0, 13)}`;
    const row: SessionRow = { bridgeSessionId, sdkSessionId: null, address, state: 'live', openGate: null };
    this.sessions.set(bridgeSessionId, row);
    this.db.sqlite
      .prepare(
        `INSERT INTO sessions (bridge_session_id, bridge_id, project, address, started_at, state)
         VALUES (?, ?, ?, ?, ?, 'live')`,
      )
      .run(bridgeSessionId, this.opts.bridgeId, this.opts.project, JSON.stringify(address), new Date().toISOString());
    const journal = new Journal(this.opts.journalsDir, bridgeSessionId);
    journal.append({
      record: 'meta',
      bridgeSessionId,
      width: this.opts.displayWidth ?? 65,
      entryPrompt,
      recordedAt: new Date().toISOString(),
    });
    this.emit('session', { type: 'session.started', bridgeSessionId, address });
    await this.locked(bridgeSessionId, () => this.runTurn(row, journal, entryPrompt, 1));
    return row;
  }

  /**
   * Answer the session's open gate. CAS: a submit against a non-open gate
   * answers with the current state instead ("already answered"). The
   * answer-while-dead path is the same path — one query per turn means the
   * process is gone between turns by design; before injecting we re-derive
   * the tail gate from the journal and refuse on mismatch.
   */
  async answer(
    bridgeSessionId: string,
    gateId: string,
    text: string,
    via: 'ui' | 'mcp',
  ): Promise<{ ok: boolean; state: string; reason?: string }> {
    const row = this.sessions.get(bridgeSessionId);
    if (!row) return { ok: false, state: 'unknown-session', reason: 'no such session' };
    return this.locked(bridgeSessionId, async () => {
      const journal = new Journal(this.opts.journalsDir, bridgeSessionId);
      const tail = openAsk(journal.read(), bridgeSessionId);
      if (!tail) {
        row.openGate = null;
        return { ok: false, state: 'resolved-externally', reason: 'no open ask on the journal tail' };
      }
      if (tail.gateId !== gateId) {
        // The session advanced past the ask this card described.
        if (row.openGate?.id === gateId) {
          row.openGate = { ...row.openGate, state: 'resolved-externally' };
          this.emitGate(row, row.openGate);
        }
        return { ok: false, state: 'resolved-externally', reason: 'journal tail names a different gate' };
      }
      if (row.openGate && row.openGate.state !== 'open') {
        return { ok: false, state: row.openGate.state, reason: 'already being answered' };
      }
      if (row.openGate) {
        row.openGate = { ...row.openGate, state: 'answering' };
        this.emitGate(row, row.openGate);
      }
      const turnNo = journal.read().filter((r) => r.record === 'user').length + 1;
      try {
        await this.runTurn(row, journal, text, turnNo);
        const resolvedAt = new Date().toISOString();
        this.db.sqlite
          .prepare('UPDATE gate_ledger SET state = ?, resolved_at = ?, resolution = ? WHERE gate_id = ?')
          .run('resolved', resolvedAt, JSON.stringify({ answer: text, via, at: resolvedAt }), gateId);
        this.emit('gate', { type: 'gate.resolved', gateId, via, bridgeSessionId });
        return { ok: true, state: 'resolved' };
      } catch (err) {
        row.state = 'errored';
        row.lastError = String((err as Error).message ?? err);
        if (row.openGate) {
          row.openGate = { ...row.openGate, state: 'orphaned' };
          this.emitGate(row, row.openGate);
        }
        this.persistState(row);
        return { ok: false, state: 'orphaned', reason: row.lastError };
      }
    });
  }

  /** One SDK turn: stream, tee the journal, detect the ask, project the gate. */
  private async runTurn(row: SessionRow, journal: Journal, prompt: string, turnNo: number): Promise<void> {
    row.state = 'live';
    this.persistState(row);
    journal.append({ record: 'user', text: prompt, ts: new Date().toISOString() });

    const env: Record<string, string> = {
      WORKFLOWS_DISPLAY_WIDTH: String(this.opts.displayWidth ?? 65),
      BRIDGE_ID: this.opts.bridgeId,
      // CLAUDE_PID / CLAUDE_CODE_SESSION_ID deliberately unset — the harness
      // overrides them (spiked); presence identity is read back from records.
    };

    const armStall = () => {
      this.clearStall(row.bridgeSessionId);
      this.stallTimers.set(
        row.bridgeSessionId,
        setTimeout(() => {
          if (row.state === 'live') {
            row.state = 'stalled';
            this.persistState(row);
            this.emit('session', { type: 'session.stalled', bridgeSessionId: row.bridgeSessionId });
          }
        }, T_STALL_MS),
      );
    };

    let inFlightTool = false;
    let errored: string | null = null;
    armStall();
    try {
      for await (const ev of this.driver.runTurn({
        prompt,
        cwd: this.opts.projectRoot,
        resume: row.sdkSessionId ?? undefined,
        allowedTools: this.opts.allowedTools,
        env,
      })) {
        // The stall timer flips state concurrently — TS's narrowing is wrong here.
        if ((row.state as SessionState) === 'stalled') row.state = 'live';
        switch (ev.type) {
          case 'init':
            row.sdkSessionId = ev.sdkSessionId;
            this.db.sqlite
              .prepare('UPDATE sessions SET sdk_session_id = ? WHERE bridge_session_id = ?')
              .run(ev.sdkSessionId, row.bridgeSessionId);
            break;
          case 'assistant':
            journal.append({ record: 'assistant', text: ev.text, ts: new Date().toISOString() });
            break;
          case 'tool-use':
            inFlightTool = true;
            this.clearStall(row.bridgeSessionId); // agent dispatches run minutes
            journal.append({ record: 'tool-use', tool: ev.tool, id: ev.id, input: ev.input ?? null });
            break;
          case 'tool-result': {
            inFlightTool = false;
            armStall();
            journal.append({ record: 'tool-result', tool: ev.tool, id: ev.id, text: ev.text });
            // The prompt-fallout rule: a denied permission surfaces as errored
            // health with the denied command shown — never a silent hang.
            if (/requested permissions|permission.*denied|hasn't granted/i.test(ev.text)) {
              row.lastError = `permission denied: ${ev.text.slice(0, 200)}`;
              logger.warn('allowlist gap — permission denied in session', {
                bridgeSessionId: row.bridgeSessionId,
                detail: row.lastError,
              });
            }
            break;
          }
          case 'usage':
            journal.append({ record: 'usage', inputTokens: ev.inputTokens, outputTokens: ev.outputTokens });
            this.db.sqlite
              .prepare(
                `UPDATE sessions SET input_tokens = input_tokens + ?, output_tokens = output_tokens + ?,
                 cost_usd = cost_usd + ?, last_event_at = ? WHERE bridge_session_id = ?`,
              )
              .run(ev.inputTokens ?? 0, ev.outputTokens ?? 0, ev.costUsd ?? 0, new Date().toISOString(), row.bridgeSessionId);
            break;
          case 'result':
            if (ev.outcome === 'error') errored = ev.error ?? 'sdk error';
            break;
        }
      }
    } finally {
      this.clearStall(row.bridgeSessionId);
    }

    journal.append({ record: 'turn-end', turn: turnNo, ts: new Date().toISOString() });

    if (errored) {
      row.state = 'errored';
      row.lastError = errored;
      this.persistState(row);
      this.emit('session', { type: 'session.errored', bridgeSessionId: row.bridgeSessionId, error: errored });
      return;
    }

    // Project the gate from the journal (never from memory of the stream).
    const ask = openAsk(journal.read(), row.bridgeSessionId);
    if (ask) {
      row.state = 'idle-at-ask';
      row.openGate = this.toCard(row, ask);
      this.recordLedger(row, row.openGate, ask);
      this.emitGate(row, row.openGate);
    } else {
      row.state = 'ended';
      row.openGate = null;
      this.emit('session', { type: 'session.ended', bridgeSessionId: row.bridgeSessionId, address: row.address });
      this.presenceSweep(row).catch(() => {});
    }
    this.persistState(row);
    void inFlightTool;
  }

  private toCard(row: SessionRow, ask: DerivedAsk): GateCard {
    const d = ask.detection;
    return {
      id: ask.gateId,
      kind: d.kind,
      ...(d.kind !== 'pass-through' && 'gateType' in d && d.gateType ? { gateType: d.gateType } : {}),
      source: d.source,
      session: { bridgeSessionId: row.bridgeSessionId, askOrdinal: ask.ordinal },
      address: row.address,
      ...('surface' in d && d.surface ? { surface: d.surface } : {}),
      context: d.context,
      ...('question' in d && d.question ? { question: d.question } : {}),
      options: d.options as GateCard['options'],
      freeText: true,
      confirm: d.confirm,
      ...('relayDiverged' in d && d.relayDiverged !== undefined ? { relayDiverged: d.relayDiverged } : {}),
      openedAt: new Date().toISOString(),
      state: 'open',
    };
  }

  private recordLedger(row: SessionRow, card: GateCard, ask: DerivedAsk): void {
    this.db.sqlite
      .prepare(
        `INSERT OR IGNORE INTO gate_ledger (gate_id, bridge_session_id, ask_ordinal, card, state, opened_at)
         VALUES (?, ?, ?, ?, 'open', ?)`,
      )
      .run(card.id, row.bridgeSessionId, ask.ordinal, JSON.stringify(card), card.openedAt);
  }

  private emitGate(row: SessionRow, card: GateCard): void {
    this.emit('gate', { type: `gate.${card.state === 'open' ? 'opened' : card.state}`, card, bridgeSessionId: row.bridgeSessionId });
  }

  private persistState(row: SessionRow): void {
    this.db.sqlite
      .prepare('UPDATE sessions SET state = ?, last_event_at = ? WHERE bridge_session_id = ?')
      .run(row.state, new Date().toISOString(), row.bridgeSessionId);
  }

  private clearStall(id: string): void {
    const t = this.stallTimers.get(id);
    if (t) clearTimeout(t);
    this.stallTimers.delete(id);
  }

  /**
   * Presence compensation (spiked): read the record for the session's
   * address; if its pid is dead, sweep `presence cleanup <session-id>` with
   * the id read BACK from the record.
   */
  private async presenceSweep(row: SessionRow): Promise<void> {
    const { workUnit, phase, topic } = row.address;
    if (!workUnit || !phase || !topic || !this.opts.enginePath) return;
    const presencePath = path.join(this.opts.projectRoot, '.workflows', '.cache', workUnit, phase, topic, 'presence');
    let record: { pid?: number; session_id?: string } | null = null;
    try {
      record = JSON.parse(fs.readFileSync(presencePath, 'utf8'));
    } catch {
      return;
    }
    if (!record?.session_id) return;
    try {
      process.kill(record.pid ?? -1, 0);
      return; // pid alive — not ours to sweep
    } catch {
      /* dead → sweep */
    }
    await new Promise<void>((resolve) => {
      execFile(
        'node',
        [path.join(this.opts.enginePath!, 'engine.cjs'), 'presence', 'cleanup', record!.session_id!],
        { cwd: this.opts.projectRoot, env: { ...process.env, WORKFLOWS_DISPLAY_WIDTH: String(this.opts.displayWidth ?? 65) } },
        () => resolve(),
      );
    });
  }

  /**
   * Explicit session end — the lobby's end-shaping affordance and the
   * idle-timeout land here. With one query per turn, every turn carries an
   * SDK result; only an explicit end (or an error) closes the session.
   */
  async end(bridgeSessionId: string, outcome: 'completed' | 'interrupted' = 'completed'): Promise<void> {
    const row = this.sessions.get(bridgeSessionId);
    if (!row) return;
    await this.locked(bridgeSessionId, async () => {
      const journal = new Journal(this.opts.journalsDir, bridgeSessionId);
      journal.append({ record: 'result', outcome, ts: new Date().toISOString() });
      if (row.openGate && row.openGate.state === 'open') {
        row.openGate = { ...row.openGate, state: 'stale' };
        this.db.sqlite
          .prepare('UPDATE gate_ledger SET state = ? WHERE gate_id = ?')
          .run('stale', row.openGate.id);
        this.emitGate(row, row.openGate);
      }
      row.state = 'ended';
      row.openGate = null;
      this.persistState(row);
      this.emit('session', { type: 'session.ended', bridgeSessionId, address: row.address });
      await this.presenceSweep(row).catch(() => {});
    });
  }

  /**
   * Restart recovery: sessions rows with a live-ish state are re-projected
   * from their journals — gates re-derived, never read from a table. An
   * unresumable session surfaces as dead, never dropped.
   */
  restore(): void {
    const rows = this.db.sqlite
      .prepare(
        `SELECT bridge_session_id as bridgeSessionId, sdk_session_id as sdkSessionId, address, state
         FROM sessions WHERE project = ? AND state NOT IN ('ended')`,
      )
      .all(this.opts.project) as { bridgeSessionId: string; sdkSessionId: string | null; address: string; state: string }[];
    for (const r of rows) {
      const journal = new Journal(this.opts.journalsDir, r.bridgeSessionId);
      const records = journal.read();
      const row: SessionRow = {
        bridgeSessionId: r.bridgeSessionId,
        sdkSessionId: r.sdkSessionId,
        address: JSON.parse(r.address),
        state: 'dead',
        openGate: null,
      };
      const ask = records.length > 0 ? openAsk(records, r.bridgeSessionId) : null;
      if (ask) {
        row.state = 'idle-at-ask';
        row.openGate = this.toCard(row, ask);
      }
      this.sessions.set(r.bridgeSessionId, row);
      this.persistState(row);
      if (row.openGate) this.emitGate(row, row.openGate);
    }
    if (rows.length > 0) logger.info('sessions restored from journals', { count: rows.length });
  }

  /** All asks (answered included) for a session — the thread surface reads this. */
  transcript(bridgeSessionId: string): { records: Record<string, unknown>[]; asks: DerivedAsk[] } {
    const journal = new Journal(this.opts.journalsDir, bridgeSessionId);
    const records = journal.read();
    return { records, asks: deriveAsks(records, bridgeSessionId) };
  }
}

export { sha256 as sha256hex };
