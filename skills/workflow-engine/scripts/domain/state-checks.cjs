'use strict';

// ---------------------------------------------------------------------------
// Domain ring: boot's checks of the state (4.4.3, 22.1.2), run on every boot
// before anything writes state — and before the writer lock, a file in the
// state worktree these checks put in place, so they hold a lock of their
// own, and two boots at once check one after the other. The state's remote
// is asked once where its `leeway-state` stands, and the catch-up starts
// from that answer, so a boot with nothing to do asks the network once.
//
// - The branch: one this clone lacks is made from the remote's — a fresh
//   clone, or a local branch lost — and one the remote lacks is pushed back
//   to it (4.4.4, 4.4.12, 4.5.1).
// - The worktree: one gone is added again, one unlocked is locked (4.4.9),
//   and a folder whose link broke is relinked — the project folder moved, or
//   was copied, the copy's state becoming its own and the original's left
//   alone.
// - No branch here or on the remote: a project being set up gets the orphan
//   branch; one whose code tree holds the workflows' trace lost its state,
//   and boot stops there, starting again only on the person's yes (4.4.5,
//   4.5.2); one on the layout before the state branch stops for the
//   migration, and boot writes nothing.
// - A remote out of reach is never read as holding nothing, so never as lost
//   state or a branch to push back: boot works on what this clone holds —
//   its own branch, or the remote's as last fetched — and, holding neither,
//   stops with nothing written.
// - A `leeway-state` holding code history is refused (4.9.2): no worktree is
//   added onto it, no local branch is made from it, and it is never pushed.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { stateRoot } = require('../kernel/state-root.cjs');
const { titlecase } = require('./conventions.cjs');
const {
  STATE_BRANCH, inspectState, createState, addStateWorktree, repairStateWorktree, createStateBranchFromRemote,
  lockStateWorktree, askStateRemote, fetchStateTip, codeBranchSharing, pushState, withBootLock,
} = require('./state-worktree.cjs');
const { holdsTrace, onLegacyLayout } = require('./code-trace.cjs');

/** @typedef {import('./state-worktree.cjs').RemoteAnswer} RemoteAnswer */
/** @typedef {import('./state-worktree.cjs').StateInspection} StateInspection */

/**
 * What boot's checks left: a stop, with nothing written — the state `lost`,
 * or the project on the layout before the state branch, owing the
 * `migrate`ion; or the state in place — made by this boot where `made` says
 * so — with the remote's answer the catch-up starts from, none where a push
 * this boot made left it behind.
 * @typedef {{stop: 'lost'|'migrate'}
 *   | {made: 'created'|'restarted'|null, listing: RemoteAnswer|undefined, warnings: string[]}} Placed
 */

/**
 * The project's name as the person knows it: its main checkout's folder.
 * @param {string} cwd
 * @returns {string}
 */
function projectName(cwd) {
  return titlecase(path.basename(path.dirname(stateRoot(cwd))));
}

/**
 * Refuse a branch holding code history: one sharing a commit with a code
 * branch is no state branch.
 * @param {string} root @param {string} ref @param {string} named how the refusal names it
 */
function refuseCodeHistory(root, ref, named) {
  const code = codeBranchSharing(root, ref);
  if (code !== null) {
    throw new Error(
      `${named} holds code history — it shares commits with ${code}, where the state branch is a line of its own — ` +
      'so boot neither checks it out nor pushes it, and wrote nothing. Rename that branch, and boot sets the state up afresh',
    );
  }
}

/**
 * Make the local branch from the remote's — a fresh clone's, or a local
 * branch lost — answering whether there is one now. A remote out of reach
 * gives its branch as this clone last fetched it; where this clone never
 * did, boot stops, since a remote out of reach says nothing of what it holds.
 * @param {string} root @param {StateInspection} seen @param {RemoteAnswer} answer
 * @returns {boolean}
 */
function restoreBranch(root, seen, answer) {
  if (answer.remote === null) return false;
  if ('unreachable' in answer) {
    if (!seen.remoteBranch) {
      throw new Error(`${answer.remote} could not be reached, and this clone holds no ${STATE_BRANCH} of its own, so boot wrote nothing — start again once it can be reached: ${answer.unreachable}`);
    }
  } else if (answer.tip === null) {
    return false;
  } else {
    const failed = fetchStateTip(root, answer.remote, answer.tip);
    if (failed !== null) {
      throw new Error(`${STATE_BRANCH} could not be fetched from ${answer.remote}, and this clone holds none of its own, so boot wrote nothing: ${failed}`);
    }
  }
  refuseCodeHistory(root, `refs/remotes/${answer.remote}/${STATE_BRANCH}`, `${answer.remote}'s ${STATE_BRANCH}`);
  createStateBranchFromRemote(root);
  return true;
}

/**
 * The state branch is neither here nor on the remote: set the state up —
 * on a project being set up, or on the person's yes where it was lost — or
 * stop. The orphan branch comes first, and the trace after it.
 * @param {string} cwd @param {string} root @param {RemoteAnswer} answer @param {boolean} startAgain
 * @returns {Placed}
 */
function startState(cwd, root, answer, startAgain) {
  if (fs.existsSync(root)) {
    throw new Error(
      `the state folder ${root} is still there, but ${STATE_BRANCH} is gone — from this clone, and from ${answer.remote ?? 'any remote'} — ` +
      'so boot wrote nothing: it makes no state branch under a folder holding state it cannot account for. ' +
      `Where another clone still holds ${STATE_BRANCH}, run Leeway there to push it back, and this clone restores it at its next boot; ` +
      `otherwise move ${root} aside, keeping what it holds, and boot again`,
    );
  }
  if (onLegacyLayout(cwd)) return { stop: 'migrate' };
  const lost = holdsTrace(cwd);
  if (lost && !startAgain) return { stop: 'lost' };
  const created = createState(root);
  return { made: lost ? 'restarted' : 'created', listing: created.pushed ? undefined : answer, warnings: created.warnings };
}

/**
 * Put the worktree in place for the branch: added where it is gone, relinked
 * where its link broke, locked where it is not.
 * @param {string} root @param {StateInspection} seen
 * @returns {string[]} warnings
 */
function placeWorktree(root, seen) {
  if (seen.folder === 'absent') {
    refuseCodeHistory(root, STATE_BRANCH, STATE_BRANCH);
    addStateWorktree(root);
    return [];
  }
  /** @type {string[]} */
  const warnings = [];
  let placed = seen;
  if (placed.folder === 'unlinked' || placed.worktree === null) {
    const { was, from } = repairStateWorktree(root);
    if (was === 'copied') warnings.push(`this project is a copy of ${from}: its state worktree was linked to that project's, and is now this one's own — ${from} is untouched`);
    placed = inspectState(root);
  }
  const { worktree } = placed;
  if (placed.folder !== 'linked' || worktree === null) {
    throw new Error(`git cannot open the state worktree at ${root} as this repository's, even relinked, so boot wrote nothing`);
  }
  if (worktree.branch !== STATE_BRANCH) {
    throw new Error(`the state worktree at ${root} has ${worktree.branch ?? 'a detached HEAD'} checked out, not ${STATE_BRANCH}, so boot wrote nothing — check ${STATE_BRANCH} out there again`);
  }
  if (!worktree.locked) lockStateWorktree(root);
  return warnings;
}

/**
 * Push the branch back to a remote that was reached and holds none
 * (4.4.12). The catch-up asks afresh after a push this made.
 * @param {string} root @param {RemoteAnswer} answer @param {string[]} warnings
 * @returns {RemoteAnswer|undefined}
 */
function pushBack(root, answer, warnings) {
  if (answer.remote === null || 'unreachable' in answer || answer.tip !== null) return answer;
  refuseCodeHistory(root, STATE_BRANCH, STATE_BRANCH);
  const pushed = pushState(root);
  warnings.push(...pushed.warnings);
  return pushed.pushed ? undefined : answer;
}

/**
 * Boot's checks: the state branch and its worktree put in place, set up on
 * a project being set up, and started again on a lost one where the person
 * said yes (`startAgain`); or the stop where it is lost, or where the
 * project is on the layout before the state branch. Held one boot at a
 * time. Refuses, with nothing written, where the remote is out of reach and
 * this clone holds no state, where a `leeway-state` holds code history, and
 * where the state's folder is there in a shape boot cannot account for.
 * @param {string} cwd
 * @param {{startAgain?: boolean}} [opts]
 * @returns {Placed}
 */
function placeState(cwd, { startAgain = false } = {}) {
  const root = stateRoot(cwd);
  return withBootLock(root, () => {
    const answer = askStateRemote(root);
    const seen = inspectState(root);
    if (!seen.branch && !restoreBranch(root, seen, answer)) return startState(cwd, root, answer, startAgain);
    const warnings = placeWorktree(root, seen.branch ? seen : inspectState(root));
    return { made: null, listing: pushBack(root, answer, warnings), warnings };
  });
}

module.exports = { placeState, projectName };
