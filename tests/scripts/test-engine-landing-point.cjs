'use strict';

// ---------------------------------------------------------------------------
// A task's landing point (task-landed.cjs, `pointOf`, L) against each
// shipped driver in turn, where it is read off its line, the task squashed
// by hand: its line's squash matched as its landing, or its record's where
// a verb read the landing first, then the file it added deleted, deleted
// and added back, or, that landing read, its branch rewritten, refused as
// apart from its landing and its work laid on it, the file it never adds
// kept; its commits folded into one, nothing else changed, laid on it as
// nothing new; or its last commit dropped, its branch then behind its
// landing: landed, nothing new, its record kept. Every other kind of landing is
// test-engine-landing-point-kinds.cjs's; the way on of a change
// conflicting with a later landing, test-engine-landing-point-conflicts.cjs's;
// the rows and what each holds, landing-point-world.cjs's. Conformance
// layer.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');

const { landingPoints } = require('./landing-point-world.cjs');

landingPoints('a task squashed by hand, its landing point the one source of every read and every way on (task-landed.cjs, R29)', [
  ['a squash by hand', 'the file it added deleted', false],
  ['a squash by hand', 'the file it added deleted', true],
  ['a squash by hand', 'that file deleted, then added back', false],
  ['a squash by hand', 'its branch rewritten', true],
  ['a squash by hand', 'its commits folded into one under its own stamp, nothing else changed', true],
  ['a squash by hand', 'its last commit dropped, its branch behind its landing', true],
], [], { describe, it, afterEach });
