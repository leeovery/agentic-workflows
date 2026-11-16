'use strict';

//
// Tests for migration 073: environment-linters (.cjs)
//
// A step that does nothing, its number kept: the linters' carry is the
// move's (078, test-migration-078.cjs). It reports a skip, hands nothing
// back and writes nothing.
//

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MIGRATION = require('../../skills/ledger-migrate/scripts/migrations/073-environment-linters.cjs');

describe('migration 073: a step that does nothing', () => {
  it('reports a skip, hands nothing back and writes nothing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-073-'));
    try {
      let updates = 0;
      let skips = 0;

      const returned = MIGRATION.run({ projectDir: dir, reportUpdate: () => { updates++; }, reportSkip: () => { skips++; } });

      assert.deepStrictEqual({ returned, updates, skips, files: fs.readdirSync(dir) }, { returned: undefined, updates: 0, skips: 1, files: [] });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
