'use strict';

// ---------------------------------------------------------------------------
// A task's landing point (task-landed.cjs, `pointOf`, L) against each
// shipped driver in turn, by each kind of landing but a squash by hand: the
// engine's own, read off its record; by hand, a merge commit and a
// fast-forward, read off the commits of its line the default branch holds,
// and a rebase merge, off their copies; and on GitHub's site, a squash of
// its pull request, off the commit its driver took — then its branch given
// a change: the file it added deleted, deleted and added back, the branch
// rewritten (F1), or, the squash on GitHub's site, rebased onto the default
// branch, its commits dropped there as applied, its landing point still the
// commit its driver took, never its tip read whole. A squash by hand is
// test-engine-landing-point.cjs's; the rows and what each holds,
// landing-point-world.cjs's. Conformance layer.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');

const { landingPoints } = require('./landing-point-world.cjs');

landingPoints('each kind of landing, its landing point the one source of every read and every way on (task-landed.cjs, R29)', [
  ['the engine\'s own landing', 'the file it added deleted', false],
  ['the engine\'s own landing', 'that file deleted, then added back', false],
  ['a merge commit by hand', 'the file it added deleted', false],
  ['a merge commit by hand', 'its branch rewritten', false],
  ['a fast-forward by hand', 'the file it added deleted', false],
  ['a rebase merge by hand', 'the file it added deleted', false],
  ['a squash on GitHub\'s site', 'the file it added deleted', false],
  ['a squash on GitHub\'s site', 'its branch rewritten', false],
  ['a squash on GitHub\'s site', 'its branch rebased onto the default branch, its commits dropped there as applied', false],
], [], { describe, it, afterEach });
