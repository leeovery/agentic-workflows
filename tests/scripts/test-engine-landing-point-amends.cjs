'use strict';

// ---------------------------------------------------------------------------
// A take-back written into a task's own commits after its landing, a verb
// having read that landing (task-landed.cjs, `rewritten`, F1), against each
// shipped driver in turn: its branch no longer holding its landing point,
// the verbs refuse it. Task 1.1, of three commits, squashed by hand then
// its last commit amended to take its second file back; merged by hand by
// a merge commit, or by a rebase merge, then folded into one commit under
// its own stamp, that file taken back: each refused with F1, its way on
// followed as the engine words it, and the take-back lands — the default
// branch holds the task's work as its branch does, its record names the
// engine's landing with its first landing kept, and the verb again answers
// already. Squashed by hand, then its last commit's message amended alone:
// refused with F1, its way on followed commits nothing, the branch put back
// on the commit that landed, nothing lands, and `land open` answers
// already. The rows and what each holds are landing-point-world.cjs's.
// Conformance layer.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');

const { landingPoints } = require('./landing-point-world.cjs');

landingPoints('its own commits rewritten after a verb read its landing — a take-back written into them, or a message alone — refused with F1 (task-landed.cjs, `rewritten`)', [
  ['a squash by hand', 'its last commit amended, taking back the file it added', true],
  ['a merge commit by hand', 'its commits folded into one under its own stamp, taking back the file it added', true],
  ['a rebase merge by hand', 'its commits folded into one under its own stamp, taking back the file it added', true],
  ['a squash by hand', 'its last commit\'s message amended alone', true],
], [], { describe, it, afterEach });
