'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a quick-fix's one checkout left as the quick-fix leaves other
// than by its close — its move to another type (workunit-move.cjs, 19.5.9)
// and its cancel (workunit-lifecycle.cjs, 18.3.9) — so nothing of it is lost
// and the checkout is back where the project lands (19.5.29).
//
// - The holder (`holderOf`): the fix in flight whose turn the checkout is,
//   read as any read of the tracker is (task-verbs.cjs, `stepTurn`), none
//   where no fix holds it or none has begun.
// - Leaving (`leaveCheckout`): what the holder has not committed set aside
//   as a park sets it aside, saying why — the move or the cancel
//   (fix-aside.cjs) — then each checkout taken back to the branch its
//   repository lands on where it has the quick-fix's branch out, refused
//   first, nothing moved, while one still holds changes not committed, the
//   person's own (fix-branch.cjs, `checkOutLanding`). Run again, it finds
//   the work set aside already and the checkout back. Where the branch
//   goes after is each way's own: a move files it under `moved/`, a cancel
//   keeps it under its name, which its receipt names (fix-branch.cjs,
//   `cancelKept`).
// ---------------------------------------------------------------------------

const { stateRoot } = require('../kernel/state-root.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { fixesBegun } = require('./derivations.cjs');
const { stepTurn } = require('./task-verbs.cjs');
const { setAside } = require('./fix-aside.cjs');
const { checkOutLanding } = require('./fix-branch.cjs');
const { parseShownTask } = require('./task-id.cjs');

/**
 * The fix holding a quick-fix's one checkout, or null where none does or no
 * fix has begun (the header's).
 * @param {string} cwd @param {Record<string, any>} manifest
 * @returns {import('./task-id.cjs').TaskRef|null}
 */
function holderOf(cwd, manifest) {
  if (!fixesBegun(manifest)) return null;
  const turn = withStateLock(stateRoot(cwd), () => stepTurn(cwd, manifest.name, manifest));
  return turn?.checkout ? parseShownTask(manifest.name, turn.inFlight) : null;
}

/**
 * The quick-fix's checkout left by its move or its cancel (the header's):
 * the holder's work not committed set aside, refused in the words of
 * `said`, then each checkout taken back. Answers the branch the project's
 * checkout was taken to, null where it had another out.
 * @param {string} cwd @param {Record<string, any>} manifest @param {string} said @param {'move'|'cancel'} why
 * @returns {string|null}
 */
function leaveCheckout(cwd, manifest, said, why) {
  const holder = holderOf(cwd, manifest);
  if (holder !== null) setAside(cwd, holder, said, why);
  return checkOutLanding(cwd, manifest.name);
}

module.exports = { holderOf, leaveCheckout };
