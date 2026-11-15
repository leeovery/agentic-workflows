'use strict';

// ---------------------------------------------------------------------------
// A take-back written into a task's own commits after its landing, a verb
// having read that landing (task-landed.cjs, `apart`), against each
// shipped driver in turn: its branch no longer holding its landing point,
// the verbs refuse it, the way on its work laid on that point, so no landed
// work leaves the default branch. Task 1.1, of three commits, squashed by
// hand then its last commit amended to take its second file back: the
// amended commit, laid on the landing, removes the file, and the take-back
// lands — the default branch holds the task's work as its branch does, its
// record names the engine's landing with its first landing kept, and the
// verb again answers already. Merged by hand by a merge commit, or by a
// rebase merge, then folded into one commit under its own stamp, that file
// taken back: the fold, laid on the landing, is nothing new, the default
// branch keeping the file, and `land open` answers already. Squashed by
// hand, then its last commit's message amended alone: laid on the landing,
// nothing new. The rows and what each holds are landing-point-world.cjs's.
// Conformance layer.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');

const { landingPoints } = require('./landing-point-world.cjs');

landingPoints('its own commits rewritten after a verb read its landing — a take-back written into them, or a message alone — refused as apart from it, its work laid on it (task-landed.cjs, `apart`)', [
  ['a squash by hand', 'its last commit amended, taking back the file it added', true],
  ['a merge commit by hand', 'its commits folded into one under its own stamp, taking back the file it added', true],
  ['a rebase merge by hand', 'its commits folded into one under its own stamp, taking back the file it added', true],
  ['a squash by hand', 'its last commit\'s message amended alone', true],
], [], { describe, it, afterEach });
