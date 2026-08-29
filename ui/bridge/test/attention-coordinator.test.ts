// Coordinator-level tests — the wiring the reviewers found untested: the
// local-date morning guard, phase-distinct report rowKeys, the escalation
// clock feeding the queue, and heartbeat-vs-interaction.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDb, type Db } from '../src/db.js';
import { AttentionCoordinator } from '../src/attention-coordinator.js';
import { EventStore } from '../src/store.js';
import type { Delivered } from '../src/notifier.js';

let dir: string;
let db: Db;
let store: EventStore;
let delivered: Delivered[];

const CONFIG = {
  rollupMinutes: 10,
  quietStart: '22:00',
  quietEnd: '08:00',
  morningHour: 8,
  escalationMinutes: 15,
  graceMinutes: 5,
};

function makeCoordinator(sessions: any = null) {
  return new AttentionCoordinator(
    db,
    'demo',
    { projectRoot: dir, store, sessions, engine: null, config: CONFIG },
    (d) => delivered.push(d),
  );
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coord-'));
  fs.mkdirSync(path.join(dir, '.workflows', '.cache'), { recursive: true });
  db = openDb(path.join(dir, 'state'));
  store = new EventStore(db, 'demo');
  store.setMeta('e', null);
  delivered = [];
});
afterEach(() => {
  db.sqlite.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

function writeReport(wu: string, phase: string, topic: string, lane: string): string {
  const d = path.join(dir, '.workflows', '.cache', wu, phase, topic);
  fs.mkdirSync(d, { recursive: true });
  const p = path.join(d, 'review-001.md');
  fs.writeFileSync(p, `## Findings\n### F1: a thing\n**Lane:** ${lane}\n`);
  return p;
}

describe('AttentionCoordinator', () => {
  it('scans a walk-lane report and pushes once; a second identical scan does not re-push', () => {
    const c = makeCoordinator();
    writeReport('wu', 'discussion', 'wu', 'ask'); // ask → walk
    c.scanReports(new Date('2026-08-27T14:00:00').getTime());
    expect(delivered.filter((d) => d.kind === 'push')).toHaveLength(1);
    c.scanReports(new Date('2026-08-27T14:00:30').getTime());
    expect(delivered.filter((d) => d.kind === 'push')).toHaveLength(1);
    c.stop();
  });

  it('cross-phase reports for one topic are DISTINCT ledger rows — one never suppresses the other', () => {
    const c = makeCoordinator();
    writeReport('wu', 'specification', 'topic', 'ask');
    writeReport('wu', 'implementation', 'topic', 'ask');
    c.scanReports(new Date('2026-08-27T14:00:00').getTime());
    // One fired discretely, the other collapsed into the roll-up — but the
    // ledger holds BOTH phase-qualified rowKeys; neither was deduped away.
    const rows = db.sqlite
      .prepare("SELECT DISTINCT row_key FROM push_ledger WHERE kind IN ('push', 'accrued') AND row_key LIKE 'wu:report:%'")
      .all() as { row_key: string }[];
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.row_key).sort()).toEqual([
      'wu:report:implementation:topic',
      'wu:report:specification:topic',
    ]);
    c.stop();
  });

  it('an apply-only report badges, never pushes', () => {
    const c = makeCoordinator();
    writeReport('wu', 'review', 'wu', 'apply');
    c.scanReports(new Date('2026-08-27T14:00:00').getTime());
    expect(delivered).toHaveLength(0);
    c.stop();
  });

  it('the morning roll-up fires ONCE per LOCAL day, not twice (UTC/local guard fixed)', () => {
    const c = makeCoordinator();
    // Accrue something overnight so there's a roll-up to fire.
    writeReport('wu', 'discussion', 'wu', 'ask');
    // 2am local (quiet hours) → accrue.
    const twoAm = new Date('2026-08-27T02:00:00');
    c.tick(twoAm.getTime());
    expect(delivered.filter((d) => d.kind === 'push')).toHaveLength(0);
    // 8am local → morning roll-up fires once.
    c.tick(new Date('2026-08-27T08:00:00').getTime());
    const morning = delivered.filter((d) => d.rowKey === '__rollup__');
    expect(morning).toHaveLength(1);
    // 5pm local same day (a later tick) → must NOT fire a second roll-up.
    c.tick(new Date('2026-08-27T17:00:00').getTime());
    expect(delivered.filter((d) => d.rowKey === '__rollup__')).toHaveLength(1);
    c.stop();
  });

  it('a heartbeat does not re-arm escalation; a real interaction does', () => {
    const base = new Date('2026-08-27T14:00:00').getTime(); // local daytime, not quiet
    const openGate = { id: 'g1', address: { workUnit: 'wu' }, state: 'open', question: 'q', kind: 'menu', gateType: undefined, confirm: 'tap', openedAt: new Date(base).toISOString() };
    const sessions = { list: () => [{ bridgeSessionId: 'bs', openGate }], get: () => ({ openGate }), on: () => {} };
    const c = makeCoordinator(sessions);
    // Observe the gate opening at base so it's escalation-due 20m later.
    (c as any).escalation.observeOpen('g1', base);
    const now = base + 20 * 60_000; // past T_esc (15m)
    c.tick(now);
    expect(c.isEscalated('g1')).toBe(true);
    const firstPushes = delivered.length;
    // A heartbeat (interaction:false) must NOT re-arm.
    c.markActivity({ appConnected: true, interaction: false });
    c.tick(now + 60_000);
    expect(delivered.length).toBe(firstPushes); // no re-escalation
    // A real interaction re-arms → the next tick escalates again.
    c.markActivity({ appConnected: true, interaction: true });
    c.tick(now + 120_000);
    expect(delivered.length).toBeGreaterThan(firstPushes);
    c.stop();
  });
});
