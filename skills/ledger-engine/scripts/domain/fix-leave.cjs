'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a quick-fix's worktree left as the quick-fix leaves other
// than by its close — its move to another type (workunit-move.cjs, 19.5.9)
// and its cancel (workunit-lifecycle.cjs, 18.3.9) — so nothing of it is lost
// and the worktree is taken apart (19.5.29).
//
// - The holder (`heldWork`): the fix in flight whose turn the worktree is,
//   read as any read of the tracker is (task-verbs.cjs, `stepTurn`), with
//   the project's folder in the worktree — none where no fix holds it, none
//   has begun, or the worktree is not laid out, as a cancel leaves a fix
//   in flight until its next start.
// - Leaving (`leaveWorktree`): what the holder has not committed set aside
//   as a park sets it aside, saying why — the move or the cancel
//   (fix-aside.cjs) — then the worktree taken apart, refused first, nothing
//   moved, while it still holds changes not committed (fix-branch.cjs,
//   `refuseDirtyLeave`, `takeFixApart`). Run again, it finds the work set
//   aside already and the worktree gone. Where the branch goes after is
//   each way's own: a move files it under `moved/`, a cancel keeps it under
//   its name, which its receipt names (fix-branch.cjs, `cancelKept`).
// ---------------------------------------------------------------------------

const fs = require('fs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { fixesBegun } = require('./derivations.cjs');
const { stepTurn } = require('./task-verbs.cjs');
const { setAside } = require('./fix-aside.cjs');
const { fixWorktree, refuseDirtyLeave, takeFixApart } = require('./fix-branch.cjs');
const { parseShownTask } = require('./task-id.cjs');

/**
 * The fix holding a quick-fix's worktree and the project's folder there, or
 * null (the header's).
 * @param {string} cwd @param {Record<string, any>} manifest
 * @returns {{holder: import('./task-id.cjs').TaskRef, root: string}|null}
 */
function heldWork(cwd, manifest) {
  if (!fixesBegun(manifest)) return null;
  const { root } = fixWorktree(cwd, manifest.name);
  if (!fs.existsSync(root)) return null;
  const turn = withStateLock(stateRoot(cwd), () => stepTurn(cwd, manifest.name, manifest));
  return turn?.checkout ? { holder: parseShownTask(manifest.name, turn.inFlight), root } : null;
}

/**
 * The quick-fix's worktree left by its move or its cancel (the header's):
 * the holder's work not committed set aside, refused in the words of
 * `said`, then the worktree taken apart.
 * @param {string} cwd @param {Record<string, any>} manifest @param {string} said @param {'move'|'cancel'} why
 */
function leaveWorktree(cwd, manifest, said, why) {
  const held = heldWork(cwd, manifest);
  if (held !== null) setAside(held.root, held.holder, said, why);
  refuseDirtyLeave(cwd, manifest.name);
  takeFixApart(cwd, manifest.name);
}

module.exports = { heldWork, leaveWorktree };
