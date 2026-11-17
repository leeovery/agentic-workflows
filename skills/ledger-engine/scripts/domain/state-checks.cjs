'use strict';

// ---------------------------------------------------------------------------
// Domain ring: boot's checks of the state (4.4.3, 22.1.2), run on every boot
// before anything writes state — and before the writer lock, a file in the
// state worktree these checks put in place, so they hold a lock of their
// own, and two boots at once check one after the other. The state's remote
// is asked once where its `ledger-state` stands, and the catch-up starts
// from that answer, so a boot with nothing to do asks the network once.
//
// - The ignoring: first, the state folder is kept in the repository's own
//   exclude file, which no branch carries, so no branch takes it in, whatever
//   its `.gitignore` holds (4.1.2, 4.1.3). It is never the state or the code,
//   so a stop that writes nothing to either keeps it too.
// - The branch: one this clone lacks is made from the remote's — a fresh
//   clone, or a local branch lost — and one the remote lacks is pushed back
//   to it (4.4.4, 4.4.12, 4.5.1). A local branch lost under a folder still
//   there is made at the commit the folder's files stand at, and the
//   catch-up moves them on to the remote's tip as it moves any clone behind,
//   merging in what was not yet committed; never made at the remote's tip
//   under files that are not its, which the next write would commit back
//   over the remote's change.
// - The worktree: one gone is added again, one unlocked is locked (4.4.9),
//   and a folder whose link broke is relinked — the project folder moved, or
//   was copied, the copy's state becoming its own and the original's left
//   alone.
// - No branch here or on the remote: a project that owes the reshape — which
//   the migrate skill answers (ledger-migrate/scripts/old-layout.cjs, `owed`)
//   — goes on to the migration, which puts its state in place, whatever
//   folder a migration cut short left there; a project being set up gets
//   the orphan branch; one whose repository holds Ledger's trace — on
//   any branch, the remote's fetched first, or in any tree checked out —
//   lost its state, and boot stops there, starting again only on the
//   person's yes (4.4.5, 4.5.2).
// - The migration under way: its state worktree checked out on a
//   `ledger-state` with no commit yet, its files standing at the code
//   commit it was added at, until the migration's commit — whatever the
//   code branch holds meanwhile, a commit of the person's own among it
//   (21.5.11). The worktree is relinked where its link broke, the project
//   folder moved or copied meanwhile, as a born branch's is, and locked
//   where it is not; boot goes on to the migrations with nothing pushed:
//   the branch is the migration's to begin (21.9.3). A folder standing at
//   no code commit is never the migration's worktree: one holding no link
//   git can read — a plain `.ledger/` in a project owing the reshape — is
//   left to the migration, whose guard sets it aside, and a branch lost
//   under its folder stands at a commit of the state's, and is restored or
//   refused as above.
// - A remote out of reach is never read as holding nothing, so never as lost
//   state or a branch to push back: boot works on what this clone holds —
//   its own branch, or the remote's as last fetched — and, holding neither,
//   stops with nothing written.
// - A `ledger-state` holding code history is refused (4.9.2): no worktree is
//   added onto it, no local branch is made from it, and it is never pushed.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { stateRoot } = require('../kernel/state-root.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { titlecase } = require('./conventions.cjs');
const {
  STATE_BRANCH, trackingRef, inspectState, createState, addStateWorktree, repairStateWorktree, createStateBranchFromRemote,
  createStateBranchAt, folderCommit, standsAtCodeCommit, lockStateWorktree, askStateRemote, fetchStateTip, fetchRemoteBranches, refuseCodeHistory, pushState, withBootLock,
} = require('./state-worktree.cjs');
const { holdsTrace, keepStateExcluded } = require('./code-trace.cjs');
const { owed } = require('../../../ledger-migrate/scripts/old-layout.cjs');

/** @typedef {import('./state-worktree.cjs').RemoteAnswer} RemoteAnswer */
/** @typedef {import('./state-worktree.cjs').StateInspection} StateInspection */

/**
 * What boot's checks left: a stop, with nothing written to the state or the
 * code — the state `lost`; or the state in place — made by this boot where
 * `made` says so — or the migration's to put in place or under way, where
 * `migrating`, with the remote's answer the catch-up starts from, none
 * where a push this boot made left it behind, or the migration has nothing
 * to catch up. Either way, what went wrong on the way that boot carries on
 * past.
 * @typedef {{stop: 'lost', warnings: string[]}
 *   | {made: 'created'|'restarted'|null, migrating: boolean, listing: RemoteAnswer|undefined, warnings: string[]}} Placed
 */

const BOOT_REFUSES = 'so boot neither checks it out nor pushes it, and wrote nothing. Rename that branch, and boot sets the state up afresh';

/**
 * The project's name as the person knows it: its main checkout's folder.
 * @param {string} cwd
 * @returns {string}
 */
function projectName(cwd) {
  return titlecase(path.basename(path.dirname(stateRoot(cwd))));
}

/**
 * Make the local branch lost under a folder still there at the commit the
 * folder's files stand at. Refuses, writing nothing, where that commit
 * cannot be told, or holds code history.
 * @param {string} root @param {string} remote
 */
function restoreUnderFolder(root, remote) {
  const moveAside = `move ${root} aside, keeping what it holds, and boot again: ${STATE_BRANCH} is restored from ${remote}`;
  const at = folderCommit(root);
  if (at === null) {
    throw new Error(
      `the state folder ${root} is still there, but ${STATE_BRANCH} is gone from this clone, and its log no longer says which commit ` +
      `the folder's files stand at, so boot wrote nothing — ${moveAside}`,
    );
  }
  refuseCodeHistory(root, at, `the commit the state folder ${root} stands at`,
    `so boot makes no ${STATE_BRANCH} there, and wrote nothing. To carry on, ${moveAside}`);
  createStateBranchAt(root, at);
}

/**
 * Make the local branch a fresh clone or a lost one lacks, answering
 * whether there is one now: from the remote's, or where the folder still
 * stands at, once the remote is known to hold one. A remote out of reach
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
  refuseCodeHistory(root, trackingRef(answer.remote), `${answer.remote}'s ${STATE_BRANCH}`, BOOT_REFUSES);
  if (seen.folder === 'absent') createStateBranchFromRemote(root);
  else restoreUnderFolder(root, answer.remote);
  return true;
}

/**
 * The state branch is neither here nor on the remote: leave the state to
 * the migration where the project owes the reshape; else set the state up
 * — on a project being set up, or on the person's yes where it was lost —
 * or stop. Which of the two it is, the trace says, read across the
 * repository once the remote's branches are fetched: a fetch that fails
 * stops boot rather than read as a project being set up. The orphan branch
 * comes first, and the trace after it.
 * @param {string} cwd @param {string} root @param {RemoteAnswer} answer @param {boolean} startAgain @param {string[]} warnings
 * @returns {Placed}
 */
function startState(cwd, root, answer, startAgain, warnings) {
  if (owed(codeRoot(cwd))) return { made: null, migrating: true, listing: undefined, warnings };
  if (fs.existsSync(root)) {
    throw new Error(
      `the state folder ${root} is still there, but ${STATE_BRANCH} is gone — from this clone, and from ${answer.remote ?? 'any remote'} — ` +
      'so boot wrote nothing: it makes no state branch under a folder holding state it cannot account for. ' +
      `Where another clone still holds ${STATE_BRANCH}, run Ledger there to push it back, and this clone restores it at its next boot; ` +
      `otherwise move ${root} aside, keeping what it holds, and boot again`,
    );
  }
  if (answer.remote !== null) {
    const failed = fetchRemoteBranches(root, answer.remote);
    if (failed !== null) {
      throw new Error(
        `${answer.remote}'s branches could not be fetched, so boot cannot tell a project being set up from one whose state was lost, ` +
        `and wrote nothing — start again once ${answer.remote} can be reached: ${failed}`,
      );
    }
  }
  const lost = holdsTrace(cwd);
  if (lost && !startAgain) return { stop: 'lost', warnings };
  const created = createState(root);
  return { made: lost ? 'restarted' : 'created', migrating: false, listing: created.pushed ? undefined : answer, warnings: [...warnings, ...created.warnings] };
}

/**
 * Whether the migration is under way: no local branch, and the state
 * worktree checked out on `ledger-state`, which has no commit yet, its
 * files standing at the code commit it was added at.
 * @param {string} root @param {StateInspection} seen
 */
function migrationUnderWay(root, seen) {
  return !seen.branch && seen.folder === 'linked' && seen.worktree?.branch === STATE_BRANCH && standsAtCodeCommit(root);
}

/**
 * Whether the state folder is there with its link broken: git cannot open
 * it as this repository's, or this repository registers no worktree at it.
 * @param {StateInspection} seen
 */
function linkBroken(seen) {
  return seen.folder === 'unlinked' || (seen.folder === 'linked' && seen.worktree === null);
}

/**
 * Relink the state worktree whose link broke — the project folder moved, or
 * was copied, the copy's state becoming its own.
 * @param {string} root
 * @returns {string[]} warnings
 */
function relink(root) {
  const { was, from } = repairStateWorktree(root);
  return was === 'copied' ? [`this project is a copy of ${from}: its state worktree was linked to that project's, and is now this one's own — ${from} is untouched`] : [];
}

/**
 * Where the state stands, the migration's worktree relinked first where its
 * link broke while the migration was under way: a folder standing at the
 * code commit it was added at. A folder holding no link git can read, or a
 * branch lost under its folder, is left as found.
 * @param {string} root @param {string[]} warnings
 * @returns {StateInspection}
 */
function inspectRelinked(root, warnings) {
  const seen = inspectState(root);
  if (seen.branch || !linkBroken(seen) || !standsAtCodeCommit(root)) return seen;
  warnings.push(...relink(root));
  return inspectState(root);
}

/**
 * Put the worktree in place for the branch: added where it is gone, relinked
 * where its link broke, locked where it is not.
 * @param {string} root @param {StateInspection} seen
 * @returns {string[]} warnings
 */
function placeWorktree(root, seen) {
  if (seen.folder === 'absent') {
    refuseCodeHistory(root, STATE_BRANCH, STATE_BRANCH, BOOT_REFUSES);
    addStateWorktree(root);
    return [];
  }
  /** @type {string[]} */
  const warnings = [];
  let placed = seen;
  if (linkBroken(placed)) {
    warnings.push(...relink(root));
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
  refuseCodeHistory(root, STATE_BRANCH, STATE_BRANCH, BOOT_REFUSES);
  const pushed = pushState(root);
  warnings.push(...pushed.warnings);
  return pushed.pushed ? undefined : answer;
}

/**
 * Boot's checks: the state folder kept out of every branch, then the state
 * branch and its worktree put in place, set up on a project being set up,
 * and started again on a lost one where the person said yes (`startAgain`),
 * or the migration's, under way, locked, or left to it where the project
 * owes the reshape; or the stop where it is lost. Held one boot at a time.
 * Refuses, with nothing written to the state or the code, where the remote
 * is out of reach and this clone holds no state, where the remote's
 * branches cannot be fetched to read the trace from, where a
 * `ledger-state` holds code history, and where the state's folder is there
 * in a shape boot cannot account for.
 * @param {string} cwd
 * @param {{startAgain?: boolean}} [opts]
 * @returns {Placed}
 */
function placeState(cwd, { startAgain = false } = {}) {
  const root = stateRoot(cwd);
  return withBootLock(root, () => {
    const warnings = keepStateExcluded(cwd);
    const answer = askStateRemote(root);
    const seen = inspectRelinked(root, warnings);
    if (migrationUnderWay(root, seen)) {
      if (!seen.worktree?.locked) lockStateWorktree(root);
      return { made: null, migrating: true, listing: undefined, warnings };
    }
    if (!seen.branch && !restoreBranch(root, seen, answer)) return startState(cwd, root, answer, startAgain, warnings);
    warnings.push(...placeWorktree(root, seen.branch ? seen : inspectState(root)));
    return { made: null, migrating: false, listing: pushBack(root, answer, warnings), warnings };
  });
}

module.exports = { placeState, projectName };
