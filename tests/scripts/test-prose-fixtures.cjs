'use strict';

// Fixture golden check (design/prose-tests.md P2/P3): every committed
// snapshot rebuilds byte-identical from its recipe under the frozen
// clock. A red run here means the engine moved the world — regenerate
// with `node tests/prose/run.cjs snap <name>` and review the snapshot
// diff in the same PR as the change that moved it. Never hand-edit a
// snapshot to green this.

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const fixtures = require('../prose/lib/fixtures.cjs');

describe('prose-test fixtures', () => {
  const names = fixtures.listFixtures();

  it('has at least one fixture', () => {
    assert.ok(names.length > 0, 'no fixtures found');
  });

  for (const name of names) {
    it(`${name}: recipe rebuilds the committed snapshot byte-identical`, () => {
      assert.ok(fixtures.readSnapshot(name) !== null,
        `fixture "${name}" has no committed snapshot — run: node tests/prose/run.cjs snap ${name}`);
      const scratch = fixtures.runRecipe(name);
      try {
        const diff = fixtures.compareSnapshot(name, scratch);
        const report = [
          ...diff.changed.map((f) => `changed: ${f}`),
          ...diff.extra.map((f) => `extra (rebuilt, not in snapshot): ${f}`),
          ...diff.missing.map((f) => `missing (in snapshot, not rebuilt): ${f}`),
        ];
        assert.deepStrictEqual(report, [],
          `world moved — regenerate: node tests/prose/run.cjs snap ${name}\n` +
          report.map((l) => `  ${l}`).join('\n'));
      } finally {
        fs.rmSync(scratch, { recursive: true, force: true });
      }
    });
  }
});
