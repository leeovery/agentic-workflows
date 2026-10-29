'use strict';

// ---------------------------------------------------------------------------
// The local landing driver's remedy table (landing-remedies.cjs), every row
// of what a task holds and what a stacked phase waits on followed with the
// person's checkout clean on the default branch, under a config hostile to
// the landing (landing-world.cjs, `HOSTILE`): each row refuses, moving
// nothing; the commands its refusal names are run as written, a step it
// names in words taken as a person would; the verb then goes through; and
// every worktree is as the person left it, byte for byte, the stash as it
// was, and no commit left on no branch (landing-world.cjs, `followed`). The
// table's other half is test-engine-land-remedies-hostile-stacks.cjs's. Git
// layer: the landing world with tasks 1.1 and 2.1 opened, built once and
// copied for each row.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');

const { personState, followed } = require('./landing-world.cjs');
const { READY, MERGE_ROWS } = require('./landing-remedies.cjs');

const STATE = personState('hostile', 'engine-land-remedies-hostile-merges-', READY);

describe('land: each refusal of what a task holds or a phase waits on followed as written, the person\'s checkout clean on the default branch, their config hostile', () => {
  for (const row of MERGE_ROWS) it(row.name, followed(STATE, row));
});
