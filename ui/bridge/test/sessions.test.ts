// Session manager: gates as journal projections, the serialized answer path,
// answer-while-dead verification, restart re-derivation — driven by a
// scripted driver (the SDK behind the same interface).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDb, type Db } from '../src/db.js';
import { SessionManager, type SessionDriver, type DriverEvent, type TurnOptions } from '../src/sessions.js';

const STOP = "emit verbatim as markdown, then STOP for the user's response";

function menuSection(name: string, question: string, options: string[]): string {
  return `=== ${name} (${STOP}) ===\n· · · · · · · · · · · ·\n**\`◆ ${question}\`**\n\n${options.join('\n')}\n`;
}

/** Scripted driver: each runTurn shifts the next turn's events. */
class FakeDriver implements SessionDriver {
  turns: DriverEvent[][] = [];
  seen: TurnOptions[] = [];
  async *runTurn(opts: TurnOptions): AsyncIterable<DriverEvent> {
    this.seen.push(opts);
    const events = this.turns.shift() ?? [{ type: 'result', outcome: 'completed' as const }];
    for (const e of events) yield e;
  }
}

let tmp: string;
let db: Db;
let driver: FakeDriver;
let mgr: SessionManager;

function makeManager(d: Db = db): SessionManager {
  return new SessionManager(d, driver, {
    projectRoot: tmp,
    project: 'demo',
    bridgeId: 'b1',
    journalsDir: path.join(tmp, 'journals'),
    displayWidth: 65,
  });
}

const askTurn = (q: string): DriverEvent[] => [
  { type: 'init', sdkSessionId: 'sdk-1' },
  { type: 'assistant', text: 'Booting.' },
  { type: 'tool-use', tool: 'Bash', id: 't1', input: { command: 'engine x' } },
  { type: 'tool-result', tool: 'Bash', id: 't1', text: menuSection('MENU: check-in gate', q, ['**`c/continue`** → Proceed (recommended)', '**`w/wrap`** → Wrap up']) },
  { type: 'assistant', text: 'Relay of the menu.' },
  { type: 'usage', inputTokens: 10, outputTokens: 5, costUsd: 0.01 },
];

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sessions-test-'));
  db = openDb(path.join(tmp, 'state'));
  driver = new FakeDriver();
  mgr = makeManager();
});

afterEach(() => {
  db.sqlite.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('SessionManager', () => {
  it('projects a gate from the journal after a turn ends at an ask', async () => {
    driver.turns.push(askTurn('Keep going?'));
    const row = await mgr.start({ workUnit: 'rate-limiting' }, '/workflow-start');
    expect(row.state).toBe('idle-at-ask');
    expect(row.openGate).not.toBeNull();
    const card = row.openGate!;
    expect(card.kind).toBe('menu');
    expect(card.surface).toBe('MENU: check-in gate');
    expect(card.question).toBe('Keep going?');
    expect(card.options).toHaveLength(2);
    expect(card.options[0]!.recommended).toBe(true);
    expect(card.source).toBe('tool-result');
    expect(card.session.askOrdinal).toBe(0);
    // The ledger recorded it — as audit, not as the source.
    const ledger = db.sqlite.prepare('SELECT state FROM gate_ledger WHERE gate_id = ?').get(card.id) as any;
    expect(ledger.state).toBe('open');
  });

  it('an answer resumes the session, resolves the gate, and projects the next ask', async () => {
    driver.turns.push(askTurn('First ask?'));
    const row = await mgr.start({ workUnit: 'x' }, '/workflow-start');
    const first = row.openGate!;
    driver.turns.push(askTurn('Second ask?'));
    const res = await mgr.answer(row.bridgeSessionId, first.id, 'c', 'ui');
    expect(res).toMatchObject({ ok: true, state: 'resolved' });
    // Resume used the recorded sdk session id.
    expect(driver.seen[1]!.resume).toBe('sdk-1');
    expect(driver.seen[1]!.prompt).toBe('c');
    expect(row.openGate!.question).toBe('Second ask?');
    expect(row.openGate!.session.askOrdinal).toBe(1);
    expect(row.openGate!.id).not.toBe(first.id);
    const ledger = db.sqlite.prepare('SELECT state, resolution FROM gate_ledger WHERE gate_id = ?').get(first.id) as any;
    expect(ledger.state).toBe('resolved');
    expect(JSON.parse(ledger.resolution).answer).toBe('c');
  });

  it('turn-final prose is a pass-through ask; only an explicit end closes the session', async () => {
    driver.turns.push(askTurn('Only ask?'));
    const row = await mgr.start({ workUnit: 'x' }, '/workflow-start');
    driver.turns.push([
      { type: 'assistant', text: 'All done — anything else?' },
      { type: 'result', outcome: 'completed' },
    ]);
    await mgr.answer(row.bridgeSessionId, row.openGate!.id, 'w', 'ui');
    // Every SDK turn carries a result — that never ends the session; the
    // trailing prose is an open conversational ask (spec 2 precedence #3).
    expect(row.state).toBe('idle-at-ask');
    expect(row.openGate!.kind).toBe('pass-through');

    await mgr.end(row.bridgeSessionId);
    expect(row.state).toBe('ended');
    expect(row.openGate).toBeNull();
    // The unanswered pass-through went stale in the ledger, not resolved.
    const stale = db.sqlite.prepare("SELECT COUNT(*) as n FROM gate_ledger WHERE state = 'stale'").get() as any;
    expect(stale.n).toBe(1);
  });

  it('answering a stale gate id resolves externally, never injects', async () => {
    driver.turns.push(askTurn('Ask?'));
    const row = await mgr.start({ workUnit: 'x' }, '/workflow-start');
    const staleId = 'f'.repeat(16);
    const res = await mgr.answer(row.bridgeSessionId, staleId, '1', 'ui');
    expect(res.ok).toBe(false);
    expect(res.state).toBe('resolved-externally');
    expect(driver.seen).toHaveLength(1); // no turn ran
  });

  it('two concurrent submits: the second resolves visibly, never double-injects', async () => {
    driver.turns.push(askTurn('Race?'));
    const row = await mgr.start({ workUnit: 'x' }, '/workflow-start');
    const gate = row.openGate!;
    driver.turns.push(askTurn('After?'));
    const [a, b] = await Promise.all([
      mgr.answer(row.bridgeSessionId, gate.id, 'c', 'ui'),
      mgr.answer(row.bridgeSessionId, gate.id, 'w', 'ui'),
    ]);
    const oks = [a, b].filter((r) => r.ok);
    expect(oks).toHaveLength(1);
    const loser = [a, b].find((r) => !r.ok)!;
    expect(loser.state).toBe('resolved-externally');
    expect(driver.seen).toHaveLength(2); // exactly one injection
  });

  it('an SDK error surfaces as errored health, never a silent hang', async () => {
    driver.turns.push([
      { type: 'init', sdkSessionId: 'sdk-e' },
      { type: 'assistant', text: 'partial' },
      { type: 'result', outcome: 'error', error: 'rate_limited' },
    ]);
    const row = await mgr.start({ workUnit: 'x' }, '/workflow-start');
    expect(row.state).toBe('errored');
    expect(row.lastError).toBe('rate_limited');
  });

  it('a permission denial is captured for the allowlist bug log', async () => {
    driver.turns.push([
      { type: 'init', sdkSessionId: 'sdk-p' },
      { type: 'tool-use', tool: 'Bash', id: 't1', input: {} },
      { type: 'tool-result', tool: 'Bash', id: 't1', text: "Claude requested permissions to use Bash, but you haven't granted it" },
      { type: 'assistant', text: 'blocked' },
    ]);
    const row = await mgr.start({ workUnit: 'x' }, '/workflow-start');
    expect(row.lastError).toContain('permission denied');
  });

  it('restart re-derives the SAME gate id from the journal — a projection, never a table', async () => {
    driver.turns.push(askTurn('Survive restart?'));
    const row = await mgr.start({ workUnit: 'x' }, '/workflow-start');
    const before = row.openGate!;

    const mgr2 = makeManager();
    mgr2.restore();
    const restored = mgr2.get(row.bridgeSessionId)!;
    expect(restored.state).toBe('idle-at-ask');
    expect(restored.openGate!.id).toBe(before.id);
    expect(restored.openGate!.question).toBe('Survive restart?');
  });

  it('the transcript exposes records and asks for the thread surface', async () => {
    driver.turns.push(askTurn('T?'));
    const row = await mgr.start({ workUnit: 'x' }, '/workflow-start');
    const t = mgr.transcript(row.bridgeSessionId);
    expect(t.records.some((r) => r.record === 'tool-result')).toBe(true);
    expect(t.asks).toHaveLength(1);
    expect(t.asks[0]!.answered).toBe(false);
  });
});
