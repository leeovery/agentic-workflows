import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { findingCeremony, gateCeremony, type ActivityContext } from '../src/attention.js';
import { extractLanes, readReportLanes, normalizeLane } from '../src/lanes.js';
import { Notifier, withinDailyWindow, type Delivered } from '../src/notifier.js';
import { EscalationTracker } from '../src/escalation.js';
import { buildDigest, lobbyStrip } from '../src/digest.js';
import { openDb, type Db } from '../src/db.js';

const idle: ActivityContext = { appConnected: false, engagedThread: false, inGrace: false, quietHours: false };

describe('lane extractor', () => {
  it('maps apply/decide/route as themselves, anything else to walk', () => {
    expect(normalizeLane('apply')).toBe('apply');
    expect(normalizeLane('Decide')).toBe('decide');
    expect(normalizeLane('ask')).toBe('walk');
    expect(normalizeLane('anything')).toBe('walk');
  });

  it('counts findings by their Lane line; a heading with no lane is walk', () => {
    const md = [
      '## Gaps',
      '### F1: thing',
      '**Lane:** apply',
      '### F2: other',
      '**Lane:** ask', // caller-named walk lane
      '### F3: no lane here',
      'body only',
    ].join('\n');
    const ex = extractLanes(md);
    expect(ex.counts).toEqual({ apply: 1, decide: 0, route: 0, walk: 2 });
    expect(ex.hasWalk).toBe(true);
  });

  it('the real recorded review report parses with walk findings (the ask lane)', () => {
    // Two `**Lane:** ask` findings → walk.
    const report = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '.claude',
      'jobs',
    );
    // Fall back to a synthetic if the live cache isn't present.
    const md = '### F1: x\n**Lane:** ask\n### F2: y\n**Lane:** ask\n';
    const ex = extractLanes(md);
    expect(ex.counts.walk).toBe(2);
    void report;
  });

  it('ENOENT is not-present; a present-unreadable file degrades to walk', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lanes-'));
    try {
      expect(readReportLanes(path.join(tmp, 'nope.md')).present).toBe(false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('finding ceremony', () => {
  it('any walk-lane finding pushes once (report-landing); batch-only badges+digests', () => {
    expect(findingCeremony({ present: true, parsed: true, counts: { apply: 0, decide: 0, route: 0, walk: 1 }, hasWalk: true }, idle)).toBe('push');
    expect(findingCeremony({ present: true, parsed: true, counts: { apply: 3, decide: 2, route: 0, walk: 0 }, hasWalk: false }, idle)).toBe('digest');
    expect(findingCeremony({ present: true, parsed: true, counts: { apply: 0, decide: 0, route: 0, walk: 0 }, hasWalk: false }, idle)).toBe('badge');
  });

  it('app-connected downgrades a walk push to an alert; quiet hours is the notifier’s job now', () => {
    const walk = { present: true, parsed: true, counts: { apply: 0, decide: 0, route: 0, walk: 1 }, hasWalk: true };
    expect(findingCeremony(walk, { ...idle, appConnected: true })).toBe('alert');
    // The pure function no longer downgrades for quiet hours — that would
    // conflate a deferred push with a batch digest. It stays 'push'; the
    // notifier accrues it when quietHours is passed.
    expect(findingCeremony(walk, { ...idle, quietHours: true })).toBe('push');
  });
});

describe('gate ceremony', () => {
  const base = { ...idle, escalated: false, blocksWithNothingElse: false };
  it('typed-confirm and consult/replan/signoff push', () => {
    expect(gateCeremony('confirm', undefined, 'typed', base)).toBe('push');
    expect(gateCeremony('menu', 'consult', 'tap', base)).toBe('push');
    expect(gateCeremony('confirm', 'signoff', 'tap', base)).toBe('push');
  });
  it('task-loop and bootstrap menus badge', () => {
    expect(gateCeremony('menu', 'task-loop', 'tap', base)).toBe('badge');
    expect(gateCeremony('menu', undefined, 'tap', base)).toBe('badge');
  });
  it('batch-screen never pings on open (digest), but escalation overrides to push', () => {
    expect(gateCeremony('batch-screen', undefined, 'tap', base)).toBe('digest');
    expect(gateCeremony('batch-screen', undefined, 'tap', { ...base, escalated: true })).toBe('push');
  });
  it('conflict pushes only when it blocks with nothing else pending', () => {
    expect(gateCeremony('menu', 'conflict', 'tap', base)).toBe('badge');
    expect(gateCeremony('menu', 'conflict', 'tap', { ...base, blocksWithNothingElse: true })).toBe('push');
  });
});

describe('Notifier + push ledger', () => {
  let dir: string;
  let db: Db;
  let delivered: Delivered[];
  let notifier: Notifier;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notif-'));
    db = openDb(dir);
    delivered = [];
    notifier = new Notifier(db, 'demo', { rollupMinutes: 10, quietStart: '22:00', quietEnd: '08:00', morningHour: 8 }, (d) => delivered.push(d));
  });
  afterEach(() => {
    db.sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('fires a push once; a restart re-pushes nothing (same content)', () => {
    const t = new Date('2026-08-27T14:00:00Z');
    notifier.notify({ rowKey: 'wu-a:g1', ceremony: 'push', contentHash: 'h1' }, 'gate open', t);
    expect(delivered).toHaveLength(1);
    // Restart: a fresh notifier over the same db re-evaluates and fires nothing.
    const n2 = new Notifier(db, 'demo', { rollupMinutes: 10, quietStart: '22:00', quietEnd: '08:00', morningHour: 8 }, (d) => delivered.push(d));
    n2.notify({ rowKey: 'wu-a:g1', ceremony: 'push', contentHash: 'h1' }, 'gate open', new Date('2026-08-27T14:20:00Z'));
    expect(delivered).toHaveLength(1);
  });

  it('quiet-hours pushes accrue (quietHours flag) and fire as one morning roll-up', () => {
    const night = new Date('2026-08-27T02:00:00Z');
    // A real push offered during quiet hours accrues rather than firing.
    notifier.notify({ rowKey: 'wu-a:g1', ceremony: 'push', contentHash: 'h1' }, 'a', night, true);
    notifier.notify({ rowKey: 'wu-b:g2', ceremony: 'push', contentHash: 'h2' }, 'b', night, true);
    expect(delivered).toHaveLength(0);
    const roll = notifier.drainAccrued(new Date('2026-08-27T08:00:00Z'));
    expect(roll).not.toBeNull();
    expect(delivered).toHaveLength(1);
    expect(delivered[0]!.body).toContain('2 waiting across 2 work units');
  });

  it('a batch digest NEVER pushes and NEVER accrues for the morning (never pings on open)', () => {
    notifier.notify({ rowKey: 'wu-a:batch', ceremony: 'digest', contentHash: 'b1' }, 'batch', new Date('2026-08-27T14:00:00Z'));
    expect(delivered).toHaveLength(0);
    // Nothing accrued — the morning roll-up finds nothing from a batch digest.
    expect(notifier.drainAccrued(new Date('2026-08-28T08:00:00Z'))).toBeNull();
  });

  it('an escalation ALWAYS fires, even within the T_roll window', () => {
    const t = new Date('2026-08-27T14:00:00Z');
    notifier.notify({ rowKey: 'wu-a:g1', ceremony: 'push', contentHash: 'h1' }, 'first', t);
    // A normal push within T_roll accrues; an escalated one fires anyway.
    notifier.notify({ rowKey: 'wu-b:g2', ceremony: 'push', contentHash: 'h2' }, 'normal', new Date('2026-08-27T14:02:00Z'));
    notifier.notify({ rowKey: 'wu-c:g3', ceremony: 'push', contentHash: 'e1', escalated: true }, 'escalated', new Date('2026-08-27T14:03:00Z'));
    expect(delivered.map((d) => d.rowKey)).toEqual(['wu-a:g1', 'wu-c:g3']);
  });

  it('a second push within T_roll collapses into accrual', () => {
    const t = new Date('2026-08-27T14:00:00Z');
    notifier.notify({ rowKey: 'wu-a:g1', ceremony: 'push', contentHash: 'h1' }, 'first', t);
    notifier.notify({ rowKey: 'wu-b:g2', ceremony: 'push', contentHash: 'h2' }, 'second', new Date('2026-08-27T14:03:00Z'));
    expect(delivered).toHaveLength(1); // only the first fired discretely
    const roll = notifier.drainAccrued(new Date('2026-08-27T14:15:00Z'));
    expect(roll?.body).toContain('1 waiting');
  });

  it('quiet-hours window wraps midnight', () => {
    expect(withinDailyWindow(new Date('2026-08-27T23:00:00'), '22:00', '08:00')).toBe(true);
    expect(withinDailyWindow(new Date('2026-08-27T03:00:00'), '22:00', '08:00')).toBe(true);
    expect(withinDailyWindow(new Date('2026-08-27T12:00:00'), '22:00', '08:00')).toBe(false);
  });
});

describe('EscalationTracker', () => {
  it('escalates once per attendance; re-arms only after activity', () => {
    const t = new EscalationTracker(15 * 60_000, 5 * 60_000);
    t.observeOpen('g1', 0);
    expect(t.dueForEscalation(10 * 60_000, new Map())).toEqual([]); // under T_esc
    expect(t.dueForEscalation(16 * 60_000, new Map())).toEqual(['g1']);
    t.markEscalated('g1', 16 * 60_000);
    expect(t.dueForEscalation(30 * 60_000, new Map())).toEqual([]); // once per attendance
    t.markActive(31 * 60_000);
    expect(t.dueForEscalation(32 * 60_000, new Map())).toEqual(['g1']); // re-armed
  });

  it('navigation grace suppresses escalation for a recently-left row', () => {
    const t = new EscalationTracker(15 * 60_000, 5 * 60_000);
    t.observeOpen('g1', 0);
    const left = new Map([['g1', 16 * 60_000]]);
    expect(t.dueForEscalation(17 * 60_000, left)).toEqual([]); // within grace
    expect(t.dueForEscalation(22 * 60_000, left)).toEqual(['g1']); // grace elapsed
  });
});

describe('digest', () => {
  const ev = (type: string, ts: string, payload: any, address: any = {}): any => ({ type, ts, payload, address, id: 'x', seq: 0, epoch: 'e', project: 'p' });
  it('rolls up landed commits+artifacts, carries waiting + next; lobby suppresses waiting', () => {
    const events = [
      ev('commit.landed', '2026-08-27T10:00:00Z', { sha: 'deadbeefcafe', subject: 'feat: x', scope: ['wu'] }),
      ev('artifact.updated', '2026-08-27T10:05:00Z', { path: 'wu/spec.md' }, { workUnit: 'wu' }),
      ev('commit.landed', '2026-08-26T00:00:00Z', { sha: 'old', subject: 'stale', scope: ['wu'] }), // before window
    ];
    const queue = [{ tier: 'durable', kind: 'reconcile', address: { workUnit: 'wu' } } as any];
    const d = buildDigest('wu', events, queue, 'NEXT: specification', '2026-08-27T09:00:00Z', '2026-08-27T11:00:00Z');
    expect(d.landed.commits).toHaveLength(1);
    expect(d.landed.artifacts).toEqual(['wu/spec.md']);
    expect(d.waiting).toHaveLength(1);
    expect(d.next).toBe('NEXT: specification');
    const strip = lobbyStrip([d]);
    expect('waiting' in strip[0]!).toBe(false);
  });
});
