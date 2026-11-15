'use strict';

// ---------------------------------------------------------------------------
// A landing by hand carrying other work beside a task's, read off its line
// (task-landed.cjs, `landingsOf`): a squash giving what merging a commit of
// the line gives but at paths no commit of the task's changes lands that
// commit, against each shipped driver in turn. Task 1.1, of three commits,
// squashed by hand carrying a change of the person's own, or with 1.2's
// work as one commit, then its second file taken back by a commit of its
// own: the take-back lands. Each row holds the default branch's tree, the task's
// record and the verb again answering already (landing-point-world.cjs).
// Conformance layer.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');

const { landingPoints } = require('./landing-point-world.cjs');

const CARRYING = 'a squash by hand carrying a change of my own';
const TAKEN = 'the file it added deleted';

landingPoints('a landing by hand carrying other work beside the task\'s, read off its line (task-landed.cjs, `landingsOf`)', [
  [CARRYING, TAKEN, false],
  ['a squash by hand of it and 1.2 as one commit', TAKEN, false],
], [], { describe, it, afterEach });
