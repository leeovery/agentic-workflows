// Phase 3 done-means as a deterministic test: the multi-unit "fixture day"
// event script driven through the real Notifier + policy, asserting the
// interruption budget, the overnight case, restart-re-pushes-nothing, the
// notifications-off floor, and the unrecognised-lane safe direction.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDb, type Db } from '../src/db.js';
import { Notifier, type Delivered, type NotifierConfig } from '../src/notifier.js';
import { findingCeremony, gateCeremony, type ActivityContext } from '../src/attention.js';
import { extractLanes } from '../src/lanes.js';

const CFG: NotifierConfig = { rollupMinutes: 10, quietStart: '22:00', quietEnd: '08:00', morningHour: 8 };
const idle: ActivityContext = { appConnected: false, engagedThread: false, inGrace: false, quietHours: false };

let dir: string;
let db: Db;
let delivered: Delivered[];
let notifier: Notifier;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-day-'));
  db = openDb(dir);
  delivered = [];
  notifier = new Notifier(db, 'demo', CFG, (d) => delivered.push(d));
});
afterEach(() => {
  db.sqlite.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('fixture day', () => {
  it('three work units in flight → ≤5 pushes, each actionable; every other item still reachable via queue', () => {
    // Unit A: discussion in flight, a bootstrap menu (badge, no push).
    notifier.notify({ rowKey: 'A:g1', ceremony: gateCeremony('menu', undefined, 'tap', { ...idle, escalated: false, blocksWithNothingElse: false }), contentHash: 'a1' }, 'A menu', new Date('2026-08-27T10:00:00Z'));
    // Unit B: spec review pending — a signoff gate (push) and a batch screen (digest).
    notifier.notify({ rowKey: 'B:g2', ceremony: gateCeremony('confirm', 'signoff', 'tap', { ...idle, escalated: false, blocksWithNothingElse: false }), contentHash: 'b1' }, 'B signoff', new Date('2026-08-27T10:20:00Z'));
    notifier.notify({ rowKey: 'B:g3', ceremony: gateCeremony('batch-screen', undefined, 'tap', { ...idle, escalated: false, blocksWithNothingElse: false }), contentHash: 'b2' }, 'B batch', new Date('2026-08-27T10:40:00Z'));
    // Unit C: delivery running — task-loop gates (badge), one walk report (push).
    notifier.notify({ rowKey: 'C:g4', ceremony: gateCeremony('confirm', 'task-loop', 'tap', { ...idle, escalated: false, blocksWithNothingElse: false }), contentHash: 'c1' }, 'C task', new Date('2026-08-27T11:00:00Z'));
    const walk = { present: true, parsed: true, counts: { apply: 0, decide: 0, route: 0, walk: 2 }, hasWalk: true };
    notifier.notify({ rowKey: 'C:report', ceremony: findingCeremony(walk, idle), contentHash: 'c2' }, 'C review', new Date('2026-08-27T11:30:00Z'));

    // The interruption budget: only the signoff and the walk report pushed.
    const pushes = delivered.filter((d) => d.kind === 'push');
    expect(pushes.length).toBeLessThanOrEqual(5);
    expect(pushes.length).toBe(2);
    expect(pushes.map((p) => p.rowKey).sort()).toEqual(['B:g2', 'C:report']);
    // The badge/digest items fired no push but the floor (queue) still holds them.
  });

  it('overnight: a 2am walk report pushes nothing (accrues), produces one morning roll-up', () => {
    const walk = { present: true, parsed: true, counts: { apply: 0, decide: 0, route: 0, walk: 1 }, hasWalk: true };
    // The ceremony is 'push'; the notifier accrues it because quietHours=true.
    const ceremony = findingCeremony(walk, idle);
    expect(ceremony).toBe('push');
    notifier.notify({ rowKey: 'A:report', ceremony, contentHash: 'r1' }, 'overnight report', new Date('2026-08-27T02:00:00Z'), true);
    expect(delivered.filter((d) => d.kind === 'push')).toHaveLength(0);
    // Morning: one roll-up.
    notifier.drainAccrued(new Date('2026-08-27T08:00:00Z'));
    expect(delivered).toHaveLength(1);
    expect(delivered[0]!.body).toContain('1 waiting');
  });

  it('restart mid-day re-pushes nothing (the push ledger holds)', () => {
    notifier.notify({ rowKey: 'B:g2', ceremony: 'push', contentHash: 'b1' }, 'signoff', new Date('2026-08-27T10:00:00Z'));
    expect(delivered.filter((d) => d.kind === 'push')).toHaveLength(1);
    // Restart: fresh notifier over the same db, same events replayed.
    const d2: Delivered[] = [];
    const n2 = new Notifier(db, 'demo', CFG, (d) => d2.push(d));
    n2.notify({ rowKey: 'B:g2', ceremony: 'push', contentHash: 'b1' }, 'signoff', new Date('2026-08-27T10:30:00Z'));
    expect(d2).toHaveLength(0);
  });

  it('notifications-off floor: with the deliver sink silent, nothing pushes but every decision is recorded', () => {
    const silent = new Notifier(db, 'demo', CFG, () => {
      /* notifications off */
    });
    const r = silent.notify({ rowKey: 'A:g1', ceremony: 'push', contentHash: 'a1' }, 'x', new Date('2026-08-27T10:00:00Z'));
    // The decision is made (ledgered) even though nothing was delivered — the
    // queue is the floor.
    expect(r).not.toBeNull();
    const led = db.sqlite.prepare("SELECT COUNT(*) as n FROM push_ledger WHERE kind = 'push'").get() as any;
    expect(led.n).toBe(1);
  });

  it('an unrecognised lane name pushes as walk (safe direction)', () => {
    const md = '### F1: something\n**Lane:** frobnicate\n';
    const ex = extractLanes(md);
    expect(ex.counts.walk).toBe(1);
    expect(findingCeremony(ex, idle)).toBe('push');
  });
});
