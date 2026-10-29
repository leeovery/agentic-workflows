'use strict';

// ---------------------------------------------------------------------------
// The local landing driver's remedy table (landing-remedies.cjs), its rows
// of a landing's trailer gone, a stack built on, and a task's branch gone, changed or moved, followed with the main checkout on a branch of its own, ignoring a file of its own at every path a code branch tracks: each row refuses, moving nothing; the
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
const { READY, BRANCH_ROWS } = require('./landing-remedies.cjs');

const STATE = personState('ignored', 'engine-land-remedies-branches-ignored-', READY);

describe('land: each refusal of a trailer gone, a stack built on, or a task\'s branch gone, changed or moved, its remedy followed as written, the person\'s checkout on a branch of its own, ignoring a file at every path a branch tracks', () => {
  for (const { name, setup } of BRANCH_ROWS) it(name, followed(STATE, setup));
});
