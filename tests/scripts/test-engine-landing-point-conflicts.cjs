'use strict';

// ---------------------------------------------------------------------------
// A task's change after its landing conflicting with a later landing, read
// over its landing point (task-landed.cjs, `pointOf`, L), against each
// shipped driver in turn: 1.1 landed by a squash by hand, never opened; a
// fast-forward by hand, opened first, its branch holding its landing; or,
// on GitHub, a squash of its pull request on the site — then 4.1 rewriting
// its card and its last file and landing, and 1.1's card changed and its
// file deleted. The first verb to lay the change refuses the conflict at
// the card alone, naming the way on, its commits since its landing rebased
// onto the default branch; followed, the conflict settled the branch's way,
// its change lands, the file staying gone. The rows and what each holds are
// landing-point-world.cjs's. Conformance layer.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');

const { landingPoints } = require('./landing-point-world.cjs');

landingPoints('a change after its landing conflicting with a later landing, read over its landing point, its way on followed (task-landed.cjs, R29)', [], [
  'a squash by hand',
  'a fast-forward by hand, opened first',
  'a squash on GitHub\'s site',
], { describe, it, afterEach });
