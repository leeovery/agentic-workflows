'use strict';

// Snapshot goldens (design/prose-tests.md P2/P3): every committed
// snapshot rebuilds byte-identical from its recipe under the frozen
// clock. A red run means the engine moved the world — regenerate with
// `node tests/prose/run.cjs snap <case-id>` and land the snapshot diff in
// the same commit as the change that moved it. Never hand-edit a
// snapshot to green this.
//
// Rebuilds are skipped for worlds whose recipes, shared mainlines, and
// engine sources are all unchanged since the snapshot was written — so a
// normal run costs nothing, and any engine change invalidates every hash
// and rebuilds the lot.

const { describe, it } = require('node:test');
const assert = require('node:assert');

const cases = require('../prose/lib/cases.cjs');
const worlds = require('../prose/lib/worlds.cjs');

describe('prose-test snapshots', () => {
  const all = cases.loadAllCases();

  it('has at least one built world', () => {
    assert.ok(all.some((c) => c.hasFixtureState), 'no case builds a world');
  });

  for (const c of all) {
    const states = [
      c.hasFixtureState ? 'fixture' : null,
      c.hasAssertionState ? 'assertion' : null,
    ].filter(Boolean);

    for (const which of states) {
      it(`${c.id}/${which}: rebuilds byte-identical`, () => {
        assert.ok(worlds.readSnapshot(c.id, which) !== null,
          `${c.id}/${which} has no committed snapshot — run: node tests/prose/run.cjs snap ${c.id}`);
        const d = worlds.verifySnapshot(c.id, which);
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
