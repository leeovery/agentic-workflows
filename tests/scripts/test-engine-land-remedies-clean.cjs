'use strict';

// ---------------------------------------------------------------------------
// The local landing driver's remedy table (landing-remedies.cjs), every row
// followed with the person's checkout clean on the default branch: each row
// refuses, moving nothing; the commands its refusal names are run as
// written, a step it names in words taken as a person would; the verb then
// goes through; and every worktree is as the person left it, byte for byte,
// the stash as it was, and no commit left on no branch (landing-world.cjs,
// `followed`). In the person's other states, the held-here and held-linked
// remedy suites follow each row whose remedy moves a branch, and the busy
// suite each whose remedy rewrites one; the interrupted suite takes a
// remedy cut short. Git layer: the landing world with tasks 1.1 and 2.1
// opened, built once and copied for each row.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');

const { personState, followed } = require('./landing-world.cjs');
const { READY, ROWS } = require('./landing-remedies.cjs');

const STATE = personState('clean', 'engine-land-remedies-clean-', READY);

describe('land: each refusal\'s remedy followed as written, the person\'s checkout clean on the default branch', () => {
  for (const row of ROWS) it(row.name, followed(STATE, row));
});
