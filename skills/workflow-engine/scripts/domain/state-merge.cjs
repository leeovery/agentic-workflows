'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the state's catch-up, and the merge between two clones (4.7).
// The person works on one machine at a time, so the state branch diverges
// only where a push failed. Boot runs the catch-up before anything writes
// state (4.7.8); it loses nothing, and never rewrites what was pushed.
//
// - Catching up: ask the state's remote where its `leeway-state` stands,
//   and fetch it where this clone lacks that tip. Where only the remote
//   moved, the branch fast-forwards to it with no commit; where only this
//   clone moved, it pushes what a failed push left behind; where both moved,
//   it merges. No remote, or a remote holding no state branch, leaves
//   nothing to do. A remote that cannot be reached is a warning, and the
//   session works on the state it has.
// - The merge: one new commit whose parent is the remote's tip, its tree
//   merged path by path (state-merge-paths.cjs) from the common ancestor,
//   this clone's tip and the remote's: committed state only. This clone's
//   unpushed commits are replaced by the merge: they were never pushed. It
//   is pushed with a lease on the tip it was merged onto; a remote that
//   moved meanwhile is fetched and merged again, a bounded number of times.
//   No git merge, and no merge driver.
// - The working tree then moves to the merge's tree, its uncommitted files
//   merged into and left uncommitted (state-merge-worktree.cjs). The files
//   land first, then the worktree's index, then the branch, so a catch-up
//   killed at any step leaves the branch at this clone's tip, where the next
//   catch-up works the merge out again and lands it, or at the whole merge.
// - The stop: a manifest field both sides changed to different values stops
//   the merge (4.7.6), with nothing written. A field the working tree's
//   uncommitted copy and the merge changed differently stops it the same
//   way, once every field on the branch is picked. The stop is kept in the
//   state worktree's git directory, beside the private index: it outlives
//   the session and is never on the branch. It holds each choice with the
//   person's pick, and a pick answers its choice, the field and the two
//   values, wherever the merge meets it again; so the merge is always worked
//   out afresh from the sides as they stand, and only a choice it has not
//   met before is asked. Picks are recorded one at a time, and the last one
//   finishes the merge (4.7.11).
//
// Every git call goes through kernel/isolated-git, under the state's writer
// lock.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isolatedGit } = require('../kernel/isolated-git.cjs');
const { GitError } = require('../kernel/git.cjs');
const { writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { STATE_BRANCH, stateRoot, inspectState, withStateLock, pushState } = require('./state-worktree.cjs');
const { sameChoice } = require('./state-merge-rules.cjs');
const { changedPaths, entriesOf, writeTree, mergeTrees } = require('./state-merge-paths.cjs');
const { workingEntries, planWorktree, moveWorktree, alignIndex } = require('./state-merge-worktree.cjs');
const { stateMergeGate } = require('./projections/state-merge.cjs');
const { titlecase } = require('./conventions.cjs');

const BRANCH_REF = `refs/heads/${STATE_BRANCH}`;
// Beside the state commit's own private index, in the worktree's git dir.
const MERGE_INDEX = 'leeway-merge.index';
const KEPT_STOP = 'leeway-merge.json';
const SCRATCH = 'leeway-merge-files';
const STAGED = 'leeway-merge-staged';

const MERGE_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 15000;
const PUSH_TIMEOUT_MS = 15000;
const NETWORK_ENV = { GIT_TERMINAL_PROMPT: '0' };
const MERGE_MESSAGE = `state: merge onto the remote's ${STATE_BRANCH}`;

/** @type {Record<string, 'local'|'remote'>} */
const PICK_KEYS = { 1: 'local', 2: 'remote' };

const SIDES_MOVED = 'the state merge\'s sides moved since it stopped, so the merge was worked out again';

/** @typedef {import('./projections/state-merge.cjs').Conflict} Conflict */
/** @typedef {import('./state-merge-paths.cjs').Entries} Entries */
/** @typedef {import('./state-merge-paths.cjs').PickOf} PickOf */
/** @typedef {import('./state-merge-worktree.cjs').WorktreeContext} WorktreeContext */
/** @typedef {import('./state-merge-worktree.cjs').WorktreePlan} WorktreePlan */

/**
 * The state worktree opened for a catch-up: the merge's context, the state's
 * remote, a runner bound to the main checkout, and where the stop is kept.
 * @typedef {WorktreeContext & {
 *   remote: string|null,
 *   remotes: string[],
 *   main: import('../kernel/isolated-git.cjs').IsolatedGit,
 *   stopFile: string,
 * }} State
 */

/** @typedef {{local: string, remote: string, base: string|null}} Sides */

/** @typedef {{fetchMs: number, pushMs: number}} Timeouts */

/**
 * What a catch-up did. `reason` says why there was nothing to do; `commit`
 * is the local branch's tip after; `uncommitted` names the worktree's
 * uncommitted paths the catch-up left as they were and those it merged.
 * @typedef {{
 *   action: 'nothing'|'unreachable'|'pushed'|'fast-forwarded'|'merged'|'stopped',
 *   reason: 'no-remote'|'no-remote-branch'|'current'|null,
 *   remote: string|null,
 *   commit: string,
 *   pushed: boolean,
 *   uncommitted: {kept: string[], merged: string[]},
 *   conflicts: Conflict[],
 *   warnings: string[],
 * }} CatchUpOutcome
 */

/** The choices a stop left the person, with the picks made. @typedef {{conflicts: Conflict[]}} KeptStop */

/**
 * A step whose push did not land: where the remote stood, the outcome if the
 * remote has not moved since, and what the step merged.
 * @typedef {{onto: string, outcome: CatchUpOutcome, notes: string[], merged: string[]}} Retry
 */

/**
 * The merge worked out, nothing written but objects: this clone's tree and
 * the merged one, every conflicted field with its pick, the notes on files
 * merged, and the working tree's move, which waits while a field on the
 * branch waits on a pick.
 * @typedef {{
 *   local: Entries,
 *   target: Entries,
 *   conflicts: Conflict[],
 *   notes: string[],
 *   worktree: WorktreePlan|null,
 *   superseded: boolean,
 * }} Plan
 */

/** @param {string} remote @returns {string} */
function trackingRef(remote) {
  return `refs/remotes/${remote}/${STATE_BRANCH}`;
}

/** @param {import('../kernel/isolated-git.cjs').IsolatedGit} git @param {string} ref @returns {string} */
function tipOf(git, ref) {
  return git.run(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).trim();
}

/** @param {{pick: Conflict['pick']}} conflict */
function open(conflict) {
  return conflict.pick === null;
}

/**
 * Open the state worktree for a catch-up. Refuses where git cannot open it
 * as this repository's, or where it has anything but `leeway-state`
 * checked out: boot's checks put it right first.
 * @param {string} root
 * @returns {State}
 */
function openState(root) {
  const seen = inspectState(root);
  if (seen.folder !== 'linked' || seen.worktree === null || seen.worktree.branch !== STATE_BRANCH) {
    throw new Error(`the state worktree at ${root} is not checked out on ${STATE_BRANCH} — it cannot catch up until boot's checks put it right`);
  }
  const git = isolatedGit(root);
  const [objectFormat, ...files] = git.run([
    'rev-parse', '--show-object-format', '--git-path', MERGE_INDEX, '--git-path', KEPT_STOP, '--git-path', SCRATCH, '--git-path', STAGED,
  ]).trim().split('\n');
  const [index, stopFile, scratch, staged] = files.map((file) => path.resolve(root, file));
  return {
    root,
    remote: seen.remote,
    remotes: seen.remotes,
    project: titlecase(path.basename(seen.main)),
    git,
    main: isolatedGit(seen.main),
    objectFormat,
    index,
    stopFile,
    scratch,
    staged,
  };
}

/**
 * A catch-up's outcome, the local tip read as it now stands.
 * @param {State} state @param {CatchUpOutcome['action']} action @param {Partial<CatchUpOutcome>} [details]
 * @returns {CatchUpOutcome}
 */
function outcome(state, action, details = {}) {
  return {
    action,
    reason: null,
    remote: state.remote,
    commit: tipOf(state.git, BRANCH_REF),
    pushed: false,
    uncommitted: { kept: [], merged: [] },
    conflicts: [],
    warnings: [],
    ...details,
  };
}

// --- the stop kept between its screen and the picks ------------------------

/** @param {State} state @returns {KeptStop|null} */
function readKeptStop(state) {
  try {
    return JSON.parse(fs.readFileSync(state.stopFile, 'utf8'));
  } catch {
    return null;
  }
}

/** @param {State} state @param {KeptStop} stop */
function keepStop(state, stop) {
  writeJsonAtomic(state.stopFile, stop);
}

/** @param {State} state */
function dropKeptStop(state) {
  fs.rmSync(state.stopFile, { force: true });
}

/** Whether two conflicts are one choice in one manifest, on the branch or in the working tree. @param {Conflict} a @param {Conflict} b */
function sameConflict(a, b) {
  return a.manifest === b.manifest && a.uncommitted === b.uncommitted && sameChoice(a, b);
}

/**
 * The picks a kept stop holds, each for the choice it answered.
 * @param {KeptStop|null} stop @param {boolean} uncommitted
 * @returns {PickOf}
 */
function picksOf(stop, uncommitted) {
  return (manifest, choice) => stop?.conflicts.find((c) => c.manifest === manifest && c.uncommitted === uncommitted && sameChoice(c, choice))?.pick ?? null;
}

// --- the merge, worked out and landed ---------------------------------------

/** @param {State} state @param {string} remote @returns {Sides} */
function sidesOf(state, remote) {
  const local = tipOf(state.git, BRANCH_REF);
  if (local === remote) return { local, remote, base: local };
  const base = state.git.tryRun(['merge-base', local, remote]);
  return { local, remote, base: base === null ? null : base.trim() };
}

/**
 * The merge of the two sides worked out, with the kept stop's picks: the
 * branch's tree from committed state alone, then, once every field on it
 * is picked, the working tree's move to it.
 * @param {State} state @param {Sides} sides
 * @returns {Plan}
 */
function planMerge(state, sides) {
  const stop = readKeptStop(state);
  const base = sides.base === null ? new Map() : entriesOf(state.git, sides.base);
  const local = entriesOf(state.git, sides.local);
  const merged = mergeTrees(state, base, local, entriesOf(state.git, sides.remote), picksOf(stop, false));
  const committed = merged.conflicts.map((c) => ({ ...c, uncommitted: false }));
  const worktree = committed.some(open)
    ? null
    : planWorktree(state, local, merged.entries, workingEntries(state, sides.local), picksOf(stop, true));
  const conflicts = [...committed, ...(worktree?.conflicts ?? []).map((c) => ({ ...c, uncommitted: true }))];
  return {
    local,
    target: merged.entries,
    conflicts,
    notes: [...merged.notes, ...(worktree?.notes ?? [])],
    worktree,
    superseded: stop !== null && stop.conflicts.some((kept) => !conflicts.some((c) => sameConflict(c, kept))),
  };
}

/**
 * Land the plan: the remote's tip itself where the merged tree is the
 * remote's, else a new commit whose one parent is the remote's tip. The
 * working tree moves first, then the worktree's index, then the branch,
 * only from the tip the merge was worked out from.
 * @param {State} state @param {Sides} sides @param {Plan} plan
 * @returns {{target: string, said: string[]}} the commit landed on, and the notes and warnings on the way
 */
function land(state, sides, plan) {
  const worktree = /** @type {WorktreePlan} */ (plan.worktree);
  const tree = writeTree(state, plan.target);
  const remoteTree = state.git.run(['rev-parse', `${sides.remote}^{tree}`]).trim();
  const target = tree === remoteTree ? sides.remote : state.git.run(['commit-tree', tree, '-p', sides.remote, '-m', MERGE_MESSAGE]).trim();
  const moved = moveWorktree(state, worktree.steps);
  const aligned = alignIndex(state, target, changedPaths(plan.local, plan.target));
  state.git.run(['update-ref', '-m', `catch up: ${target}`, BRANCH_REF, target, sides.local]);
  return { target, said: [...plan.notes, ...moved.notes, ...moved.warnings, ...aligned] };
}

/**
 * Push the merge, leased on the remote tip it was merged onto: a remote that
 * moved since refuses it.
 * @param {State} state @param {string} onto @param {number} timeoutMs
 * @returns {{pushed: boolean, warnings: string[]}}
 */
function pushWithLease(state, onto, timeoutMs) {
  const remote = /** @type {string} */ (state.remote);
  try {
    state.main.run(['push', '--quiet', `--force-with-lease=${BRANCH_REF}:${onto}`, remote, `${BRANCH_REF}:${BRANCH_REF}`], { timeoutMs, env: NETWORK_ENV });
    return { pushed: true, warnings: [] };
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    return { pushed: false, warnings: [`${STATE_BRANCH} is merged here but was not pushed to ${remote}: ${err.message}`] };
  }
}

// --- one catch-up step, and the bounded loop -------------------------------

/**
 * A call to the remote: its output, or, where it fails, the outcome that
 * leaves the session on the state it has.
 * @param {State} state @param {string[]} args @param {number} timeoutMs
 * @returns {{out: string}|{outcome: CatchUpOutcome}}
 */
function overNetwork(state, args, timeoutMs) {
  try {
    return { out: state.main.run(args, { timeoutMs, env: NETWORK_ENV }) };
  } catch (err) {
    if (!(err instanceof GitError)) throw err;
    return {
      outcome: outcome(state, 'unreachable', {
        warnings: [`${STATE_BRANCH} could not be fetched from ${state.remote}, so this session works on the state it has: ${err.message}`],
      }),
    };
  }
}

/**
 * Bring the remote's state branch here, answering its tip, or the outcome
 * where there is nothing to bring or the remote cannot be reached. The
 * remote is asked once where its tip stands; a tip this clone already holds
 * needs no fetch, and a remote holding no state branch leaves its stale
 * remote-tracking branch to go.
 * @param {State} state @param {number} timeoutMs
 * @returns {{tip: string}|{outcome: CatchUpOutcome}}
 */
function fetchState(state, timeoutMs) {
  const { remote, remotes } = state;
  if (remote === null) {
    const warnings = remotes.length === 0 ? [] : [
      `${STATE_BRANCH} was not fetched: the project has several remotes (${remotes.join(', ')}), and none is named origin or tracked by the main checkout's branch`,
    ];
    return { outcome: outcome(state, 'nothing', { reason: 'no-remote', warnings }) };
  }
  const listed = overNetwork(state, ['ls-remote', remote, BRANCH_REF], timeoutMs);
  if ('outcome' in listed) return listed;
  const tip = listed.out.split('\n').map((line) => line.split('\t')).find(([, ref]) => ref === BRANCH_REF)?.[0];
  if (tip === undefined) {
    state.main.tryRun(['update-ref', '-d', trackingRef(remote)]);
    return { outcome: outcome(state, 'nothing', { reason: 'no-remote-branch' }) };
  }
  if (state.main.tryRun(['cat-file', '-e', `${tip}^{commit}`]) !== null) {
    state.main.run(['update-ref', trackingRef(remote), tip]);
    return { tip };
  }
  const fetched = overNetwork(state, ['fetch', '--quiet', '--no-tags', '--no-write-fetch-head', remote, `+${BRANCH_REF}:${trackingRef(remote)}`], timeoutMs);
  return 'outcome' in fetched ? fetched : { tip: tipOf(state.main, trackingRef(remote)) };
}

/**
 * Only this clone moved: push what a failed push left behind.
 * @param {State} state @param {Sides} sides @param {Timeouts} timeouts
 * @returns {{outcome: CatchUpOutcome}|{retry: Retry}}
 */
function pushAhead(state, sides, timeouts) {
  const { pushed, warnings } = pushState(state.root, { timeoutMs: timeouts.pushMs });
  const done = outcome(state, 'pushed', { pushed, warnings });
  return pushed ? { outcome: done } : { retry: { onto: sides.remote, outcome: done, notes: [], merged: [] } };
}

/**
 * The remote moved: merge, stop on a conflict not yet picked, or land and
 * push.
 * @param {State} state @param {Sides} sides @param {Timeouts} timeouts
 * @returns {{outcome: CatchUpOutcome}|{retry: Retry}}
 */
function mergeSides(state, sides, timeouts) {
  const plan = planMerge(state, sides);
  const moved = plan.superseded ? [SIDES_MOVED] : [];
  if (plan.conflicts.some(open)) {
    keepStop(state, { conflicts: plan.conflicts });
    return { outcome: outcome(state, 'stopped', { conflicts: plan.conflicts, warnings: moved }) };
  }
  const landed = land(state, sides, plan);
  dropKeptStop(state);
  const { kept, merged } = /** @type {WorktreePlan} */ (plan.worktree);
  const said = [...moved, ...landed.said];
  if (landed.target === sides.remote) {
    return { outcome: outcome(state, 'fast-forwarded', { uncommitted: { kept, merged }, warnings: said }) };
  }
  const { pushed, warnings } = pushWithLease(state, sides.remote, timeouts.pushMs);
  const done = outcome(state, 'merged', { pushed, uncommitted: { kept, merged }, warnings: [...said, ...warnings] });
  if (pushed) return { outcome: done };
  return { retry: { onto: sides.remote, outcome: { ...done, warnings }, notes: said, merged } };
}

/**
 * One step: fetch, then act on where the two sides stand. After a push that
 * failed, a remote that has not moved since ends the loop with that failure.
 * @param {State} state @param {Timeouts} timeouts @param {Retry|null} retry
 * @returns {{outcome: CatchUpOutcome}|{retry: Retry}}
 */
function step(state, timeouts, retry) {
  const fetched = fetchState(state, timeouts.fetchMs);
  if ('outcome' in fetched) {
    return { outcome: retry === null ? fetched.outcome : { ...retry.outcome, warnings: [...retry.outcome.warnings, ...fetched.outcome.warnings] } };
  }
  if (retry !== null && fetched.tip === retry.onto) return { outcome: retry.outcome };
  const sides = sidesOf(state, fetched.tip);
  if (sides.local === sides.remote) return { outcome: outcome(state, 'nothing', { reason: 'current' }) };
  if (sides.base === sides.remote) return pushAhead(state, sides, timeouts);
  return mergeSides(state, sides, timeouts);
}

/**
 * Catch up, retrying while the remote moves under the push. What earlier
 * steps merged rides on the outcome the last one answers. A kept stop goes
 * once the catch-up settles anywhere but at a stop or an unreachable remote.
 * @param {State} state @param {Timeouts} timeouts
 * @returns {CatchUpOutcome}
 */
function converge(state, timeouts) {
  const carried = { notes: /** @type {string[]} */ ([]), merged: /** @type {string[]} */ ([]) };
  /** @type {Retry|null} */
  let retry = null;
  /** @type {CatchUpOutcome|null} */
  let settled = null;
  for (let attempt = 1; attempt <= MERGE_ATTEMPTS && settled === null; attempt++) {
    const next = step(state, timeouts, retry);
    if ('outcome' in next) {
      settled = next.outcome;
    } else {
      retry = next.retry;
      carried.notes.push(...retry.notes);
      carried.merged.push(...retry.merged);
    }
  }
  const last = settled ?? {
    ...(/** @type {Retry} */ (retry)).outcome,
    warnings: [...(/** @type {Retry} */ (retry)).outcome.warnings, `the remote kept moving: ${STATE_BRANCH} is not pushed after ${MERGE_ATTEMPTS} attempts, and the next catch-up carries on`],
  };
  if (!['stopped', 'unreachable'].includes(last.action)) dropKeptStop(state);
  return {
    ...last,
    uncommitted: { kept: last.uncommitted.kept, merged: [...new Set([...carried.merged, ...last.uncommitted.merged])] },
    warnings: [...new Set([...carried.notes, ...last.warnings])],
  };
}

/** @param {{fetchTimeoutMs?: number, pushTimeoutMs?: number}} opts @returns {Timeouts} */
function timeoutsOf({ fetchTimeoutMs = FETCH_TIMEOUT_MS, pushTimeoutMs = PUSH_TIMEOUT_MS } = {}) {
  return { fetchMs: fetchTimeoutMs, pushMs: pushTimeoutMs };
}

// --- the API ----------------------------------------------------------------

/**
 * Bring the state up to date with the remote's (4.7.8), under the writer
 * lock: fast-forward, push what a failed push left behind, or merge. Boot
 * runs it before anything writes state.
 * @param {string} root  the state root
 * @param {{fetchTimeoutMs?: number, pushTimeoutMs?: number}} [opts]
 * @returns {CatchUpOutcome}
 */
function catchUpState(root, opts = {}) {
  return withStateLock(root, () => converge(openState(root), timeoutsOf(opts)));
}

/**
 * The merge waiting on the person: the kept stop, and the merge worked out
 * afresh from this clone's tip and the remote's as last fetched. Null where
 * no stop is kept, or the sides no longer differ.
 * @param {State} state
 * @returns {{stop: KeptStop, plan: Plan}|null}
 */
function waitingMerge(state) {
  const stop = readKeptStop(state);
  if (stop === null || state.remote === null) return null;
  const remote = state.main.tryRun(['rev-parse', '--verify', '--quiet', `${trackingRef(state.remote)}^{commit}`]);
  if (remote === null) return null;
  const sides = sidesOf(state, remote.trim());
  return sides.local === sides.remote ? null : { stop, plan: planMerge(state, sides) };
}

/**
 * The state merge waiting on the person's pick, kept as it is now asked;
 * null where none waits, or every field is picked and the next catch-up
 * finishes it.
 * @param {string} root  the state root
 * @returns {{conflicts: Conflict[]}|null}
 */
function pendingStateMerge(root) {
  return withStateLock(root, () => {
    const state = openState(root);
    const waiting = waitingMerge(state);
    if (waiting === null || !waiting.plan.conflicts.some(open)) return null;
    keepStop(state, { conflicts: waiting.plan.conflicts });
    return { conflicts: waiting.plan.conflicts };
  });
}

/**
 * Record the person's pick for the choice the stop asks about — `1` keeps
 * this machine's value, `2` the remote's — and, once every field is picked,
 * finish the merge (4.7.11). Where the merge now asks a different choice
 * than the stop last showed, the pick is not taken, and the stop asks the
 * new one.
 * @param {string} root  the state root
 * @param {string} key
 * @param {{fetchTimeoutMs?: number, pushTimeoutMs?: number}} [opts]
 * @returns {CatchUpOutcome}
 */
function pickStateMerge(root, key, opts = {}) {
  const side = Object.hasOwn(PICK_KEYS, key) ? PICK_KEYS[key] : undefined;
  if (side === undefined) throw new Error(`a state merge pick is 1 (this machine's value) or 2 (the remote's), got "${key}"`);
  return withStateLock(root, () => {
    const state = openState(root);
    const waiting = waitingMerge(state);
    if (waiting === null) throw new Error('no state merge is waiting on a pick');
    const { conflicts } = waiting.plan;
    const asked = conflicts.find(open);
    if (asked === undefined) return converge(state, timeoutsOf(opts));
    const shown = waiting.stop.conflicts.find(open);
    if (shown === undefined || !sameConflict(asked, shown)) {
      keepStop(state, { conflicts });
      return outcome(state, 'stopped', { conflicts, warnings: [SIDES_MOVED] });
    }
    asked.pick = side;
    keepStop(state, { conflicts });
    if (conflicts.some(open)) return outcome(state, 'stopped', { conflicts });
    return converge(state, timeoutsOf(opts));
  });
}

/**
 * `render state-merge-gate`: the screen of the stop waiting on a pick.
 * @param {string} cwd @param {object} _args
 * @returns {string}
 */
function stateMergeGateSurface(cwd, _args) {
  const pending = pendingStateMerge(stateRoot(cwd));
  if (pending === null) throw new Error('render state-merge-gate: no state merge is waiting on a pick');
  return stateMergeGate(pending);
}

/**
 * `state-merge pick <1|2>`: the person's pick at the stop's screen.
 * @param {string} cwd @param {string[]} argv
 * @returns {CatchUpOutcome}
 */
function stateMergeCommand(cwd, argv) {
  const [command, ...rest] = argv;
  if (command !== 'pick' || rest.length !== 1) throw new Error('Usage: engine state-merge pick <1|2>');
  return pickStateMerge(stateRoot(cwd), rest[0]);
}

module.exports = {
  catchUpState,
  pendingStateMerge,
  pickStateMerge,
  stateMergeGateSurface,
  stateMergeCommand,
};
