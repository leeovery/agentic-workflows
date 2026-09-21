'use strict';

// Snapshot goldens (design/prose-tests.md P2/P3): every committed
// snapshot rebuilds byte-identical from its recipe under the frozen
// clock. A red run means the engine moved the world — regenerate with
// `node tests/prose/run.cjs snap <case-id>` and land the snapshot diff in
// the same commit as the change that moved it. Never hand-edit a
// snapshot to green this.
//
// Rebuilds fan out over a thread pool and are skipped for worlds whose
// recipes, shared mainlines, and engine sources are all unchanged since the
// world last rebuilt clean here — so a second run costs nothing, and any
// engine change invalidates every cached hash and rebuilds the lot.

require('./hermetic-env.cjs');

const { after, describe, it } = require('node:test');
const assert = require('node:assert');

const cases = require('../prose/lib/cases.cjs');
const worlds = require('../prose/lib/worlds.cjs');
const { POOL_SIZE, createVerifyPool } = require('../prose/lib/verify-pool.cjs');

// One test in flight per thread: each awaits its own world, so a test's
// duration is its world's rebuild and the pool never idles.
describe('prose-test snapshots', { concurrency: POOL_SIZE }, () => {
  const all = cases.loadAllCases();
  const pool = createVerifyPool();
  after(() => pool.close());

  it('has at least one built world', () => {
    assert.ok(all.some((c) => c.hasFixtureState), 'no case builds a world');
  });

  for (const c of all) {
    const states = [
      c.hasFixtureState ? 'fixture' : null,
      c.hasAssertionState ? 'assertion' : null,
    ].filter(Boolean);

    for (const which of states) {
      it(`${c.id}/${which}: rebuilds byte-identical`, async () => {
        assert.ok(worlds.hasSnapshot(c.id, which),
          `${c.id}/${which} has no committed snapshot — run: node tests/prose/run.cjs snap ${c.id}`);
        const d = await pool.submit({ caseId: c.id, which });
        if (d.skipped) return;
        const report = [
          ...d.changed.map((f) => `changed: ${f}`),
          ...d.extra.map((f) => `extra (rebuilt, not in snapshot): ${f}`),
          ...d.missing.map((f) => `missing (in snapshot, not rebuilt): ${f}`),
        ];
        assert.deepStrictEqual(report, [],
          `world moved — regenerate: node tests/prose/run.cjs snap ${c.id}\n${report.map((l) => `  ${l}`).join('\n')}`);
      });
    }
  }
});
