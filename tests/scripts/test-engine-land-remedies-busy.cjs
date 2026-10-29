'use strict';

// ---------------------------------------------------------------------------
// The local landing driver's remedy table (landing-remedies.cjs), each row
// whose remedy rewrites a branch in a worktree it makes followed with the
// person's checkout busy and holding none of the branches: on a branch of
// its own, an edit to a tracked file, a file it ignores at every path a
// code branch has held, and the project at a path with a space and a
// quote, which the worktree's path then holds. Each row refuses, moving
// nothing; its remedy is followed as written; the verb then goes through;
// and every worktree is as the person left it, byte for byte, the stash as
// it was, and no commit left on no branch (landing-world.cjs, `followed`).
// Git layer: the landing world with tasks 1.1 and 2.1 opened, built once
// and copied for each row.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');

const { personState, followed } = require('./landing-world.cjs');
const { READY, REWRITING } = require('./landing-remedies.cjs');

const STATE = personState('busy', 'engine-land-remedies-busy-', READY);

describe('land: each remedy that rewrites a branch followed as written, the person\'s checkout busy and holding none of them', () => {
  for (const row of REWRITING) it(row.name, followed(STATE, row));
});
