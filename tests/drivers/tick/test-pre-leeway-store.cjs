'use strict';

// ---------------------------------------------------------------------------
// Where Tick's driver says a project from before Leeway keeps Tick's store
// (`preLeewayStore`, drivers/task/tick/driver.cjs): the literal paths
// migration 078 was released against, which it reads to carry the store
// into the state (21.5.18). A released migration is never changed, so a
// change here must face 078 first.
//
// Layer: unit. World: the driver's module as it ships.
// ---------------------------------------------------------------------------

require('../../scripts/hermetic-env.cjs');

const { it } = require('node:test');
const assert = require('node:assert');

const DRIVER = require('../../../skills/leeway-engine/scripts/drivers/task/tick/driver.cjs');

it('declares the store at the project root\'s .tick/ and Tick\'s local files there, as 078 was released against, frozen', () => {
  assert.deepStrictEqual(DRIVER.preLeewayStore, {
    files: ['.tick/tasks.jsonl'],
    localFiles: ['/.tick/cache.db*', '/.tick/lock', '/.tick/.tasks-*.jsonl.tmp'],
  });
  assert.ok(Object.isFrozen(DRIVER.preLeewayStore) && Object.isFrozen(DRIVER.preLeewayStore.files) && Object.isFrozen(DRIVER.preLeewayStore.localFiles));
});
