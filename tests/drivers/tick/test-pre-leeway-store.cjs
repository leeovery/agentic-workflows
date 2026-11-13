'use strict';

// ---------------------------------------------------------------------------
// Where Tick's driver folder says a project from before Leeway keeps Tick's
// store (`pre-leeway-store.json`, beside drivers/task/tick/driver.cjs): the
// literal paths the reshape's migrations were released against, which they
// read with fs alone to carry the store into the state and drop it from the
// code branch (21.5.18). A released migration is never changed, so a change
// here must face them first.
//
// Layer: unit. World: the driver's folder as it ships.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DECLARATION = path.join(__dirname, '../../../skills/leeway-engine/scripts/drivers/task/tick/pre-leeway-store.json');

it('declares the store at the project root\'s .tick/ and Tick\'s local files there, as the reshape\'s migrations were released against', () => {
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(DECLARATION, 'utf8')), {
    files: ['.tick/tasks.jsonl'],
    localFiles: ['/.tick/cache.db*', '/.tick/lock', '/.tick/.tasks-*.jsonl.tmp'],
  });
});
