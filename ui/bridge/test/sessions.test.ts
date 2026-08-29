// Session manager: gates as journal projections, the serialized answer path,
// answer-while-dead verification, restart re-derivation — driven by a
// scripted driver (the SDK behind the same interface).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDb, type Db } from '../src/db.js';
import { SessionManager, type SessionDriver, type DriverEvent, type TurnOptions } from '../src/sessions.js';
import { Journal } from '../src/journal.js';

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

  it('resumes an interrupted (dead, no open ask) session with a free-text turn', async () => {
    // Build a session whose journal was cut mid-turn (tail is a tool-result, no
    // ask) — exactly the bridge-restart-mid-turn case — and restore it dead.
    const id = 'bs-dead1';
    const jdir = path.join(tmp, 'journals');
    fs.mkdirSync(jdir, { recursive: true });
    const j = new Journal(jdir, id);
    j.append({ record: 'meta', bridgeSessionId: id, width: 65, entryPrompt: '/workflow-start', recordedAt: 't' } as any);
    j.append({ record: 'user', text: '/workflow-start', ts: 't' } as any);
    j.append({ record: 'tool-use', tool: 'Bash', id: 't1', input: {} } as any);
    j.append({ record: 'tool-result', tool: 'Bash', id: 't1', text: 'partial output' } as any);
    db.sqlite
      .prepare(
        `INSERT INTO sessions (bridge_session_id, sdk_session_id, bridge_id, project, address, started_at, state)
         VALUES (?, 'sdk-1', 'b1', 'demo', '{}', 't', 'live')`,
      )
      .run(id);
    const mgr2 = makeManager();
    mgr2.restore();
    const row = mgr2.get(id)!;
    expect(row.state).toBe('dead'); // interrupted → dead, no gate
    expect(row.openGate).toBeNull();

    // Resume with a free-text turn — it resumes the recorded SDK session.
    driver.turns.push([{ type: 'assistant', text: 'resumed' }, { type: 'result', outcome: 'completed' }]);
    const res = await mgr2.resume(id, 'keep going');
    expect(res.ok).toBe(true);
    const last = driver.seen[driver.seen.length - 1]!;
    expect(last.prompt).toBe('keep going');
    expect(last.resume).toBe('sdk-1'); // resumed the recorded SDK session

    // A live/ended session refuses resume.
    const busy = await mgr2.resume('nope', 'x');
    expect(busy.ok).toBe(false);
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

  it('a permission denial flips to errored health AND is captured for the allowlist bug log', async () => {
    driver.turns.push([
      { type: 'init', sdkSessionId: 'sdk-p' },
      { type: 'tool-use', tool: 'Bash', id: 't1', input: {} },
      { type: 'tool-result', tool: 'Bash', id: 't1', text: "Claude requested permissions to use Bash, but you haven't granted it" },
      { type: 'assistant', text: 'blocked' },
    ]);
    const row = await mgr.start({ workUnit: 'x' }, '/workflow-start');
    expect(row.lastError).toContain('permission denied');
    // No gate followed, so the errored state stands (the prompt-fallout rule).
    expect(row.state).toBe('errored');
  });

  it('a second start on the same address returns the existing session (bridge-side dedup)', async () => {
    driver.turns.push(askTurn('First?'));
    const a = await mgr.start({ workUnit: 'dup', topic: 'dup' }, '/workflow-start');
    const b = await mgr.start({ workUnit: 'dup', topic: 'dup' }, '/workflow-start');
    expect(b.bridgeSessionId).toBe(a.bridgeSessionId);
    expect(driver.seen).toHaveLength(1); // no second session driven
  });

  it('the injected answer turn is tagged with the gate id in the journal', async () => {
    driver.turns.push(askTurn('Tag?'));
    const row = await mgr.start({ workUnit: 'x' }, '/workflow-start');
    driver.turns.push(askTurn('Next?'));
    await mgr.answer(row.bridgeSessionId, row.openGate!.id, 'c', 'ui');
    const journal = mgr.transcript(row.bridgeSessionId).records;
    const answerTurn = journal.find((r) => r.record === 'user' && r.text === 'c') as any;
    expect(answerTurn.gateId).toBeTruthy();
  });

  it('restart re-derives TWO open gates across two sessions (done-means, n=2)', async () => {
    driver.turns.push(askTurn('Gate A?'));
    const a = await mgr.start({ workUnit: 'a' }, '/workflow-start');
    driver.turns.push(askTurn('Gate B?'));
    const b = await mgr.start({ workUnit: 'b' }, '/workflow-start');

    const mgr2 = makeManager();
    mgr2.restore();
    expect(mgr2.get(a.bridgeSessionId)!.openGate!.id).toBe(a.openGate!.id);
    expect(mgr2.get(b.bridgeSessionId)!.openGate!.id).toBe(b.openGate!.id);
    expect(mgr2.list().filter((s) => s.state === 'idle-at-ask')).toHaveLength(2);
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
