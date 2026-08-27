// Phase 6 — multiplayer: identity + member check, gate ownership (routing not
// authority), the capture gesture, humans-viewing presence, comment ceremony.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDb, type Db } from '../src/db.js';
import { Identity, githubPushAccess, parseCookies, SENTINEL_HUMAN } from '../src/identity.js';
import {
  recordSessionDriver,
  ensureChannelDefault,
  reassignChannel,
  assignOwnerOnOpen,
  claimGate,
  noteOwnerActivity,
  ownerInfo,
  mayAnswer,
  externallyResolvedAt,
} from '../src/ownership.js';
import { beatViewing, humansViewing } from '../src/presence-humans.js';
import { addComment, unreadForGate, markTargetRead, listComments } from '../src/comments.js';
import { CaptureRunner, capturePrompt } from '../src/capture.js';
import type { SessionDriver, DriverEvent, TurnOptions } from '../src/sessions.js';

let tmp: string;
let db: Db;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-'));
  db = openDb(path.join(tmp, 'state'));
});
afterEach(() => {
  db.sqlite.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

const card = (id: string, over: any = {}) => ({
  id,
  gateType: 'signoff',
  session: { bridgeSessionId: 'bs-1', askOrdinal: 0 },
  address: { workUnit: 'auth', topic: 'auth', phase: 'specification' },
  openedAt: '2026-08-27T10:00:00.000Z',
  ...over,
});

// A stub gate_ledger row (assignOwnerOnOpen and ownerInfo read it).
function seedLedger(gateId: string): void {
  db.sqlite
    .prepare(
      `INSERT OR IGNORE INTO gate_ledger (gate_id, bridge_session_id, ask_ordinal, card, state, opened_at)
       VALUES (?, 'bs-1', 0, '{}', 'open', '2026-08-27T10:00:00.000Z')`,
    )
    .run(gateId);
}

describe('identity', () => {
  it('single mode is always the sentinel, member, zero-config', () => {
    const id = new Identity(db, { mode: 'single', apiBase: 'https://api.github.com' });
    const h = id.resolve('anything=x');
    expect(h).toEqual(SENTINEL_HUMAN);
    expect(h.member).toBe(true);
  });

  it('github mode resolves anonymous without a cookie, and a human with one', async () => {
    const id = new Identity(db, { mode: 'github', repo: 'acme/app', apiBase: 'https://api.github.com' }, {
      serverToken: 't',
      fetchImpl: (async () => ({ ok: true, json: async () => ({ permission: 'write' }) })) as any,
    });
    expect(id.resolve(undefined).member).toBe(false); // anonymous
    const res = await id.login('alice');
    expect('cookie' in res).toBe(true);
    if ('cookie' in res) {
      expect(res.human.member).toBe(true);
      const back = id.resolve(`wf_bridge_auth=${res.cookie}`);
      expect(back.githubLogin).toBe('alice');
      expect(back.member).toBe(true);
    }
  });

  it('a non-member (read-only access) authenticates but is not a member', async () => {
    const id = new Identity(db, { mode: 'github', repo: 'acme/app', apiBase: 'https://api.github.com' }, {
      serverToken: 't',
      fetchImpl: (async () => ({ ok: true, json: async () => ({ permission: 'read' }) })) as any,
    });
    const res = await id.login('bob');
    if ('cookie' in res) expect(res.human.member).toBe(false);
    else throw new Error('login should still succeed');
  });

  it('githubPushAccess fails closed on a network error and rejects bad names', async () => {
    const throwing = (async () => { throw new Error('offline'); }) as any;
    expect(await githubPushAccess({ apiBase: 'https://api.github.com' }, 'acme/app', 'alice', 't', throwing)).toBe(false);
    const ok = (async () => ({ ok: true, json: async () => ({ permission: 'admin' }) })) as any;
    expect(await githubPushAccess({ apiBase: 'https://api.github.com' }, 'bad repo', 'alice', 't', ok)).toBe(false);
    expect(await githubPushAccess({ apiBase: 'https://api.github.com' }, 'acme/app', 'al/ice', 't', ok)).toBe(false);
  });

  it('parseCookies tolerates junk', () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('a=1; b=2; broken')).toEqual({ a: '1', b: '2' });
  });
});

describe('gate ownership — routing, not authority', () => {
  it('precedence: the session driver owns over the channel default', () => {
    ensureChannelDefault(db, 'demo', 'auth', 'gh:bob'); // channel default = bob
    recordSessionDriver(db, 'bs-1', 'gh:alice'); // alice drives the session
    seedLedger('a'.repeat(16));
    const owner = assignOwnerOnOpen(db, 'demo', card('a'.repeat(16)) as any);
    expect(owner).toBe('gh:alice'); // driver wins
  });

  it('falls back to the channel default when no driver', () => {
    ensureChannelDefault(db, 'demo', 'auth', 'gh:bob');
    seedLedger('b'.repeat(16));
    const owner = assignOwnerOnOpen(db, 'demo', card('b'.repeat(16)) as any);
    expect(owner).toBe('gh:bob');
  });

  it('channel default is first-write-wins; reassign overrides it', () => {
    expect(ensureChannelDefault(db, 'demo', 'auth', 'gh:alice')).toBe('gh:alice');
    expect(ensureChannelDefault(db, 'demo', 'auth', 'gh:bob')).toBe('gh:alice'); // no-op
    reassignChannel(db, 'demo', 'auth', 'gh:bob');
    expect(ensureChannelDefault(db, 'demo', 'auth', 'gh:carol')).toBe('gh:bob');
  });

  it('a watcher may not answer; the owner may; a stuck owner opens it to anyone', () => {
    const g = 'c'.repeat(16);
    seedLedger(g);
    claimGate(db, g, 'gh:alice'); // alice owns + is active now
    const now = Date.parse('2026-08-27T12:00:00.000Z');
    const stuckMs = 24 * 3600 * 1000;
    expect(mayAnswer(db, g, 'gh:alice', { escalated: true, now, stuckMs }).ok).toBe(true);
    expect(mayAnswer(db, g, 'gh:bob', { escalated: true, now, stuckMs }).ok).toBe(false); // watcher
    // Make alice inactive > 24h AND the gate escalated → stuck → bob may claim.
    noteOwnerActivity(db, g, 'gh:alice');
    db.sqlite.prepare('UPDATE gate_owner_activity SET last_activity_at = ? WHERE gate_id = ?').run('2026-08-26T00:00:00.000Z', g);
    const info = ownerInfo(db, g, { escalated: true, now, stuckMs });
    expect(info.stuck).toBe(true);
    expect(mayAnswer(db, g, 'gh:bob', { escalated: true, now, stuckMs }).ok).toBe(true);
  });

  it('an unowned gate is answerable by anyone (single-user / zero-config)', () => {
    const g = 'd'.repeat(16);
    seedLedger(g);
    const r = mayAnswer(db, g, 'local-human', { escalated: false, now: Date.now(), stuckMs: 1 });
    expect(r.ok).toBe(true);
  });

  it('an unowned gate is never "stuck" — only claimable', () => {
    const g = 'e'.repeat(16);
    seedLedger(g);
    const info = ownerInfo(db, g, { escalated: true, now: Date.now(), stuckMs: 1 });
    expect(info.stuck).toBe(false);
    expect(info.ownerId).toBeNull();
  });

  it('externallyResolvedAt fires on a matching durable signal, not on other topics', () => {
    const c = card('f'.repeat(16));
    const durable = [
      { type: 'phase.completed', ts: '2026-08-27T11:00:00.000Z', address: { workUnit: 'auth', topic: 'auth' } },
    ];
    expect(externallyResolvedAt(c as any, durable)).toBe('2026-08-27T11:00:00.000Z');
    // A different topic completing must not resolve this card.
    const other = [{ type: 'phase.completed', ts: '2026-08-27T11:00:00.000Z', address: { workUnit: 'auth', topic: 'billing' } }];
    expect(externallyResolvedAt(c as any, other)).toBeNull();
    // A pre-open signal is not this decision.
    const before = [{ type: 'phase.completed', ts: '2026-08-27T09:00:00.000Z', address: { workUnit: 'auth', topic: 'auth' } }];
    expect(externallyResolvedAt(c as any, before)).toBeNull();
    // A card with no resolving gateType never externally-resolves.
    expect(externallyResolvedAt(card('f'.repeat(16), { gateType: 'task-loop' }) as any, durable)).toBeNull();
  });

  it('a topicless workunit.status-changed does NOT resolve a signoff card (round-12 G1)', () => {
    const c = card('f'.repeat(16)); // gateType signoff, topic auth
    // A unit cancel/status change is topicless and must not falsely resolve a
    // still-open sign-off (the bug: it resolved every sign-off on the unit).
    const statusChange = [
      { type: 'workunit.status-changed', ts: '2026-08-27T11:00:00.000Z', address: { workUnit: 'auth' } },
    ];
    expect(externallyResolvedAt(c as any, statusChange)).toBeNull();
    // A lifecycle (cancel) gate DOES resolve on it — that's unit-level.
    const cancel = card('f'.repeat(16), { gateType: 'lifecycle', address: { workUnit: 'auth' } });
    expect(externallyResolvedAt(cancel as any, statusChange)).toBe('2026-08-27T11:00:00.000Z');
  });
});

describe('humans-viewing presence', () => {
  it('shows others within the TTL, excludes the viewer and the expired', () => {
    beatViewing(db, 'demo', 'gh:alice', 'auth');
    beatViewing(db, 'demo', 'gh:bob', 'auth');
    const now = Date.now();
    const seen = humansViewing(db, 'demo', 'auth', now, 'gh:alice');
    expect(seen.map((h) => h.humanId)).toEqual(['gh:bob']); // excludes self
    // Expire bob.
    db.sqlite.prepare('UPDATE human_presence SET last_seen_at = ? WHERE human_id = ?').run('2020-01-01T00:00:00.000Z', 'gh:bob');
    expect(humansViewing(db, 'demo', 'auth', now, 'gh:alice')).toHaveLength(0);
  });
});

describe('comment ceremony', () => {
  it('a comment on a gate is unread by others but auto-read by its author', () => {
    const g = 'a'.repeat(16);
    addComment(db, 'demo', 'gh:alice', { gateId: g }, 'this blocks sign-off');
    expect(unreadForGate(db, 'demo', g, 'gh:bob')).toBe(1); // owner bob has not seen it
    expect(unreadForGate(db, 'demo', g, 'gh:alice')).toBe(0); // the author has
  });

  it('opening the thread (mark read) clears the unread count', () => {
    const g = 'b'.repeat(16);
    addComment(db, 'demo', 'gh:alice', { gateId: g }, 'concern one');
    addComment(db, 'demo', 'gh:alice', { gateId: g }, 'concern two');
    expect(unreadForGate(db, 'demo', g, 'gh:bob')).toBe(2);
    markTargetRead(db, 'demo', { gateId: g }, 'gh:bob');
    expect(unreadForGate(db, 'demo', g, 'gh:bob')).toBe(0);
    const list = listComments(db, 'demo', { gateId: g }, 'gh:bob');
    expect(list.every((c) => c.read)).toBe(true);
  });
});

// A capture driver that either completes or errors, per script.
class CaptureDriver implements SessionDriver {
  constructor(private outcome: 'completed' | 'error') {}
  seen: TurnOptions[] = [];
  async *runTurn(opts: TurnOptions): AsyncIterable<DriverEvent> {
    this.seen.push(opts);
    yield { type: 'result', outcome: this.outcome, ...(this.outcome === 'error' ? { error: 'skill blew up' } : {}) } as DriverEvent;
  }
}

describe('capture gesture', () => {
  it('prompt carries the capture skill and provenance in the body, not a state field', () => {
    const p = capturePrompt({ kind: 'idea', payload: 'add dark mode', provenance: { source: 'message', author: 'alice', messageSeq: 12 }, humanId: 'gh:alice' });
    expect(p).toContain('/workflow-log-idea add dark mode');
    expect(p).toContain('by alice');
    expect(p).toContain('Source: message');
  });

  it('a roadmap-shaped capture lands as an idea with a note (UPSTREAM #3 withdrawn)', () => {
    const p = capturePrompt({ kind: 'roadmap', payload: 'a big theme', provenance: { source: 'message' }, humanId: 'gh:alice' });
    expect(p).toContain('/workflow-log-idea');
    expect(p).toContain('parked to the inbox');
  });

  it('a successful capture leaves no durable failure row', async () => {
    const runner = new CaptureRunner(db, new CaptureDriver('completed'), { projectRoot: tmp, project: 'demo' });
    const r = await runner.run({ kind: 'idea', payload: 'x', provenance: { source: 'message' }, humanId: 'gh:alice' });
    expect(r.ok).toBe(true);
    expect(runner.list()).toHaveLength(0);
  });

  it('a failed capture is retained as a durable row with the payload; retry clears it', async () => {
    const runner = new CaptureRunner(db, new CaptureDriver('error'), { projectRoot: tmp, project: 'demo' });
    const r = await runner.run({ kind: 'bug', payload: 'crash on save', provenance: { source: 'message' }, humanId: 'gh:alice' });
    expect(r.ok).toBe(false);
    const failed = runner.list();
    expect(failed).toHaveLength(1);
    expect(failed[0]!.payload).toBe('crash on save'); // payload retained for retry
    // A retry against a driver that now succeeds clears the row.
    const okRunner = new CaptureRunner(db, new CaptureDriver('completed'), { projectRoot: tmp, project: 'demo' });
    await okRunner.retry(failed[0]!.id);
    expect(okRunner.list()).toHaveLength(0);
  });

  it('a retry that FAILS again leaves exactly one row, never a duplicate (round 12)', async () => {
    const runner = new CaptureRunner(db, new CaptureDriver('error'), { projectRoot: tmp, project: 'demo' });
    await runner.run({ kind: 'idea', payload: 'still broken', provenance: { source: 'x' }, humanId: 'gh:alice' });
    const first = runner.list();
    expect(first).toHaveLength(1);
    // Retry it — the driver still errors. Must NOT orphan the original + add a new one.
    await runner.retry(first[0]!.id);
    const after = runner.list();
    expect(after).toHaveLength(1);
    expect(after[0]!.payload).toBe('still broken');
    // A second retry-fail still holds at one.
    await runner.retry(after[0]!.id);
    expect(runner.list()).toHaveLength(1);
  });
});
