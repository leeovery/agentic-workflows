'use strict';

// ---------------------------------------------------------------------------
// The local landing driver's remedy table (landing-remedies.cjs), its rows
// of what a task holds and what a phase waits on, followed with the main checkout on a branch of its own with an edit to a tracked file not committed: each row refuses, moving nothing; the
// commands its refusal names are run as written, a step it names in words
// taken as a person would; the verb then goes through; and the person's
// checkout is as they left it — its branch, its edits and its files not
// tracked — with no commit left on no branch (landing-world.cjs,
// `followed`). Each other set of rows and state is a
// test-engine-land-remedies-* suite of its own. Git layer: the landing world
// with tasks 1.1 and 2.1 opened, built once and copied for each row.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');

const { personState, followed } = require('./landing-world.cjs');
const { READY, MERGE_ROWS } = require('./landing-remedies.cjs');

const STATE = personState('dirty', 'engine-land-remedies-merge-dirty-', READY);

describe('land: each refusal of what a task holds or a phase waits on, its remedy followed as written, the person\'s checkout on a branch of its own, an edit not committed', () => {
  for (const { name, setup } of MERGE_ROWS) it(name, followed(STATE, setup));
});
