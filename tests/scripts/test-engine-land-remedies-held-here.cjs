'use strict';

// ---------------------------------------------------------------------------
// The local landing driver's remedy table (landing-remedies.cjs), each row
// whose remedy moves a branch followed with that branch out in the person's
// own checkout, busy: an edit to a tracked file, and a file it ignores at
// every path a code branch has held that the branch does not track. Each
// row refuses, moving nothing; its remedy is followed as written, the
// checkout detached at its own commit first; the verb then goes through;
// and every worktree is as the person left it, byte for byte, the
// checkout's HEAD detached where it was, the stash as it was, and no commit
// left on no branch (landing-world.cjs, `followed`). Git layer: the landing
// world with tasks 1.1 and 2.1 opened, built once and copied for each row.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');

const { personState, followed } = require('./landing-world.cjs');
const { READY, MOVING } = require('./landing-remedies.cjs');

const STATE = personState('heldHere', 'engine-land-remedies-held-here-', READY);

describe('land: each remedy that moves a branch followed as written, that branch out in the person\'s own checkout, busy', () => {
  for (const row of MOVING) it(row.name, followed(STATE, row));
});
