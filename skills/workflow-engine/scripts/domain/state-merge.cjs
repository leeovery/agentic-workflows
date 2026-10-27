'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the state's catch-up, and the merge between two clones (4.7).
// The person works on one machine at a time, so the state branch diverges
// only where a push failed. Boot runs the catch-up before anything writes
// state (4.7.8); it loses nothing, and never rewrites what was pushed.
//
// - Catching up: ask the state's remote where its `leeway-state` stands —
//   or take the answer boot's checks got, so a boot asks once — and fetch
//   it where this clone lacks that tip. Where only the remote
//   moved, the branch fast-forwards to it with no commit; where only this
//   clone moved, it pushes what a failed push left behind; where both moved,
//   it merges. No remote, or a remote holding no state branch, leaves
//   nothing to do. A remote that cannot be reached is a warning, and the
//   session works on the state it has. A side holding code history — code
//   pushed or pointed at by the state branch's name — is refused before
//   anything is merged or pushed; it is looked for only where a side's new
//   commits hold a commit with no parent, so a catch-up with nothing new
//   pays nothing for it.
// - The merge: one new commit whose parent is the remote's tip, its tree
//   merged path by path (state-merge-paths.cjs) from the common ancestor,
//   this clone's tip and the remote's: committed state only. This clone's
//   unpushed commits are replaced by the merge: they were never pushed. It
//   is pushed with a lease on the tip it was merged onto; a remote that
//   moved meanwhile is fetched and merged again, a bounded number of times.
//   No git merge, and no merge driver.
// - The working tree then moves to the merge's tree, its uncommitted files
//   merged into and left uncommitted (state-merge-worktree.cjs), and the
//   branch follows. The landing is recorded first, and a catch-up finishes
//   one a kill cut short before anything else (state-merge-landing.cjs).
// - The stop: a manifest field both sides changed to different values stops
//   the merge (4.7.6), with nothing written. A field the working tree's
//   uncommitted copy and the merge changed differently stops it the same
//   way, once every field on the branch is picked. Nothing but a manifest
//   stops the merge, so its questions are worked out from the manifests
//   alone, and the whole merge only once every question is answered. The
//   stop is kept in the state worktree's git directory, beside the private
//   index: it outlives the session and is never on the branch. It holds each
//   choice with the person's pick, and a pick answers its choice, the field
//   and the two values, wherever the merge meets it again; so the merge is
//   always worked out afresh from the sides as they stand, and only a choice
//   it has not met before is asked. Picks are recorded one at a time, each
//   naming the choice its screen showed; a pick naming any other choice than
//   the one the merge now asks is not taken. The last pick finishes the
//   merge (4.7.11).
//
// Every git call goes through kernel/isolated-git, under the state's writer
// lock, but those of the stop's screen, which reads the merge waiting on a
// pick in files of its own.
// ---------------------------------------------------------------------------

const fs = require('fs');
const os = require('os');
const path = require('path');
const { isolatedGit } = require('../kernel/isolated-git.cjs');
const { GitError } = require('../kernel/git.cjs');
const { writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const {
  STATE_BRANCH, BRANCH_REF, FETCH_TIMEOUT_MS, PUSH_TIMEOUT_MS, NETWORK_ENV, trackingRef, noRemoteChosen, openWorktree, inspectState,
  withStateLock, pushState, pushRefusal, askStateRemote, fetchStateTip, refuseCodeHistory,
} = require('./state-worktree.cjs');
const { ruleOf, choiceId } = require('./state-merge-rules.cjs');
const { changedPaths, entriesOf, writeTree, mergeTrees } = require('./state-merge-paths.cjs');
const { workingEntries, planWorktree } = require('./state-merge-worktree.cjs');
const { readRecord, openMerge, startLanding, finishLanding } = require('./state-merge-landing.cjs');
const { stateMergeGate } = require('./projections/state-merge.cjs');

// Beside the merge's other files, in the worktree's git dir.
const KEPT_STOP = 'leeway-merge.json';

const MERGE_ATTEMPTS = 3;
const MERGE_MESSAGE = `state: merge onto the remote's ${STATE_BRANCH}`;

/** @type {Record<string, 'local'|'remote'>} */
const PICK_KEYS = { 1: 'local', 2: 'remote' };

const SIDES_MOVED = 'the state merge\'s sides moved since it stopped, so the merge was worked out again';
const NOT_ASKED = 'the pick answered a question the state merge no longer asks, so it was not taken';

/** @typedef {import('./projections/state-merge.cjs').Conflict} Conflict */
/** @typedef {import('./state-merge-paths.cjs').Entries} Entries */
/** @typedef {import('./state-merge-paths.cjs').PickOf} PickOf */
/** @typedef {import('./state-merge-worktree.cjs').WorktreePlan} WorktreePlan */
/** @typedef {import('./state-merge-landing.cjs').Landing} Landing */
/** @typedef {import('./state-worktree.cjs').RemoteAnswer} RemoteAnswer */

/**
 * The state worktree opened for a catch-up: the merge's context, the
 * state's remote, a runner bound to the main checkout, where the stop is
 * kept, and the files each commit and the working tree hold, listed once a
 * run.
 * @typedef {import('./state-merge-landing.cjs').LandingContext & {
 *   remote: string|null,
 *   remotes: string[],
 *   main: import('../kernel/isolated-git.cjs').IsolatedGit,
 *   stopFile: string,
 *   listings: Map<string, Entries>,
 * }} State
 */

/** @typedef {{local: string, remote: string, base: string|null}} Sides */

/** @typedef {{fetchMs: number, pushMs: number}} Timeouts */

/**
 * A catch-up's time limits, and the read budget its merge holds blobs to.
 * @typedef {{fetchTimeoutMs?: number, pushTimeoutMs?: number, readBudgetBytes?: number}} CatchUpOptions
 */

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
 * }} Plan
 */

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
 * @param {string} root @param {CatchUpOptions} opts
 * @returns {State}
 */
function openState(root, opts) {
  const seen = inspectState(root);
  const worktree = openWorktree(root);
  if (!worktree.opened || seen.worktree === null || seen.worktree.branch !== STATE_BRANCH) {
    throw new Error(`the state worktree at ${root} is not checked out on ${STATE_BRANCH} — it cannot catch up until boot's checks put it right`);
  }
  const merge = openMerge(worktree, STATE_BRANCH, opts);
  return {
    ...merge,
    remote: seen.remote,
    remotes: seen.remotes,
    main: isolatedGit(seen.main),
    stopFile: path.join(merge.gitDir, KEPT_STOP),
    listings: new Map(),
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
  return readRecord(state.stopFile);
}

/** @param {State} state @param {KeptStop} stop */
function keepStop(state, stop) {
  writeJsonAtomic(state.stopFile, stop);
}

/** @param {State} state */
function dropKeptStop(state) {
  fs.rmSync(state.stopFile, { force: true });
}

/**
 * The picks a kept stop holds, each for the choice it answered.
 * @param {KeptStop|null} stop @param {boolean} uncommitted
 * @returns {PickOf}
 */
function picksOf(stop, uncommitted) {
  return (manifest, choice) => {
    const id = choiceId({ manifest, uncommitted, ...choice });
    return stop?.conflicts.find((c) => choiceId(c) === id)?.pick ?? null;
  };
}

/** Whether a kept stop holds a choice the merge no longer meets. @param {KeptStop|null} stop @param {Conflict[]} conflicts */
function superseded(stop, conflicts) {
  const ids = new Set(conflicts.map(choiceId));
  return stop !== null && stop.conflicts.some((kept) => !ids.has(choiceId(kept)));
}

// --- the merge, worked out and landed ---------------------------------------

/** @param {State} state @param {string} remote @returns {Sides} */
function sidesOf(state, remote) {
  const local = tipOf(state.git, BRANCH_REF);
  if (local === remote) return { local, remote, base: local };
  const base = state.git.tryRun(['merge-base', local, remote]);
  return { local, remote, base: base === null ? null : base.trim() };
}

/** @param {Entries} entries @param {(file: string) => boolean} scope @returns {Entries} */
function scoped(entries, scope) {
  return new Map([...entries].filter(([file]) => scope(file)));
}

/**
 * Files listed once a run: a commit's never change, and the working tree's
 * are read once over each tip, so the questions and the merge they lead to
 * read the same files.
 * @param {State} state @param {string} key @param {() => Entries} list @returns {Entries}
 */
function listedOnce(state, key, list) {
  let entries = state.listings.get(key);
  if (entries === undefined) {
    entries = list();
    state.listings.set(key, entries);
  }
  return entries;
}

/**
 * The merge of the two sides worked out over the paths `scope` keeps, with
 * the kept stop's picks: the branch's tree from committed state alone, then,
 * once every field on it is picked, the working tree's move to it.
 * @param {State} state @param {Sides} sides @param {KeptStop|null} stop @param {(file: string) => boolean} [scope]
 * @returns {Plan}
 */
function planMerge(state, sides, stop, scope = () => true) {
  const entries = (/** @type {string} */ commit) => scoped(listedOnce(state, commit, () => entriesOf(state.git, commit)), scope);
  const local = entries(sides.local);
  const merged = mergeTrees(state, sides.base === null ? new Map() : entries(sides.base), local, entries(sides.remote), picksOf(stop, false));
  const committed = merged.conflicts.map((c) => ({ ...c, uncommitted: false }));
  const working = () => scoped(listedOnce(state, `working ${sides.local}`, () => workingEntries(state, sides.local)), scope);
  const worktree = committed.some(open) ? null : planWorktree(state, local, merged.entries, working(), picksOf(stop, true));
  return {
    local,
    target: merged.entries,
    conflicts: [...committed, ...(worktree?.conflicts ?? []).map((c) => ({ ...c, uncommitted: true }))],
    notes: [...merged.notes, ...(worktree?.notes ?? [])],
    worktree,
  };
}

/** @param {string} file */
function isManifest(file) {
  return ruleOf(file) === 'manifest';
}

/**
 * The questions the merge asks, with the kept stop's picks: worked out from
 * the manifests alone, since nothing else stops it.
 * @param {State} state @param {Sides} sides @param {KeptStop|null} stop
 * @returns {Conflict[]}
 */
function questionsOf(state, sides, stop) {
  return planMerge(state, sides, stop, isManifest).conflicts;
}

/**
 * Land the plan: the remote's tip itself where the merged tree is the
 * remote's, else a new commit whose one parent is the remote's tip.
 * @param {State} state @param {Sides} sides @param {Plan} plan
 * @returns {{target: string, said: string[]}} the commit landed on, and the notes and warnings on the way
 */
function landPlan(state, sides, plan) {
  const tree = writeTree(state, plan.target);
  const remoteTree = state.git.run(['rev-parse', `${sides.remote}^{tree}`]).trim();
  const target = tree === remoteTree ? sides.remote : state.git.run(['commit-tree', tree, '-p', sides.remote, '-m', MERGE_MESSAGE]).trim();
  /** @type {Landing} */
  const landing = {
    from: sides.local,
    to: target,
    steps: /** @type {WorktreePlan} */ (plan.worktree).steps,
    aligned: changedPaths(plan.local, plan.target),
    said: plan.notes,
  };
  return { target, said: startLanding(state, landing) };
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
    return { pushed: false, warnings: [`${STATE_BRANCH} is merged here but was not pushed to ${remote}: ${pushRefusal(err)}`] };
  }
}

// --- one catch-up step, and the bounded loop -------------------------------

/**
 * The outcome that leaves the session on the state it has, the remote out
 * of reach.
 * @param {State} state @param {string} why
 * @returns {{outcome: CatchUpOutcome}}
 */
function unreachable(state, why) {
  return {
    outcome: outcome(state, 'unreachable', {
      warnings: [`${STATE_BRANCH} could not be fetched from ${state.remote}, so this session works on the state it has: ${why}`],
    }),
  };
}

/**
 * Bring the remote's state branch here, answering its tip, or the outcome
 * where there is nothing to bring or the remote cannot be reached. The
 * remote is asked once where its tip stands — or its answer is the one
 * given, asked already by the caller; a tip this clone already holds needs
 * no fetch, and a remote holding no state branch leaves its stale
 * remote-tracking branch to go.
 * @param {State} state @param {number} timeoutMs @param {RemoteAnswer} [asked]
 * @returns {{tip: string}|{outcome: CatchUpOutcome}}
 */
function fetchState(state, timeoutMs, asked) {
  const answer = asked ?? askStateRemote(state.root, { timeoutMs });
  if (answer.remote === null) {
    const warnings = answer.remotes.length === 0 ? [] : [`${STATE_BRANCH} was not fetched: ${noRemoteChosen(answer.remotes)}`];
    return { outcome: outcome(state, 'nothing', { reason: 'no-remote', warnings }) };
  }
  if ('unreachable' in answer) return unreachable(state, answer.unreachable);
  if (answer.tip === null) {
    state.main.tryRun(['update-ref', '-d', trackingRef(answer.remote)]);
    return { outcome: outcome(state, 'nothing', { reason: 'no-remote-branch' }) };
  }
  const failed = fetchStateTip(state.root, answer.remote, answer.tip, { timeoutMs });
  return failed === null ? { tip: tipOf(state.main, trackingRef(answer.remote)) } : unreachable(state, failed);
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
 * The remote moved: stop on a question not yet answered, or work the merge
 * out, land it and push.
 * @param {State} state @param {Sides} sides @param {Timeouts} timeouts
 * @returns {{outcome: CatchUpOutcome}|{retry: Retry}}
 */
function mergeSides(state, sides, timeouts) {
  const stop = readKeptStop(state);
  const conflicts = questionsOf(state, sides, stop);
  const moved = superseded(stop, conflicts) ? [SIDES_MOVED] : [];
  if (conflicts.some(open)) {
    keepStop(state, { conflicts });
    return { outcome: outcome(state, 'stopped', { conflicts, warnings: moved }) };
  }
  const plan = planMerge(state, sides, stop);
  const landed = landPlan(state, sides, plan);
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
 * Where this clone last knew the remote's state branch: its remote-tracking
 * branch, read before a fetch moves it. Null where there is none.
 * @param {State} state
 * @returns {string|null}
 */
function lastKnown(state) {
  if (state.remote === null) return null;
  const known = state.main.tryRun(['rev-parse', '--verify', '--quiet', `${trackingRef(state.remote)}^{commit}`]);
  return known === null ? null : known.trim();
}

/**
 * Whether either side gained a commit with no parent since the two were
 * last in step — the remote's commits since this clone last knew it, this
 * clone's since it last pushed; with no remote-tracking branch to go by,
 * each side's commits the other lacks. Only the new commits are walked, so
 * a step with nothing new costs nothing. A state started again elsewhere
 * gains one; so does a branch by the state's name holding code.
 * @param {State} state @param {Sides} sides @param {string|null} known
 * @returns {boolean}
 */
function gainedARoot(state, sides, known) {
  return [[sides.remote, known ?? sides.local], [sides.local, known ?? sides.remote]]
    .some(([from, past]) => state.git.run(['rev-list', '--max-parents=0', from, `^${past}`]).trim() !== '');
}

/**
 * Refuse a side holding code history, before anything is merged or pushed:
 * where a side gained a commit with no parent, each side is held against
 * the code branches, and one sharing commits with them is named, with how
 * to carry on. Two state lines — one started again — merge as ever.
 * @param {State} state @param {Sides} sides @param {string|null} known
 */
function refuseSideHoldingCode(state, sides, known) {
  if (!gainedARoot(state, sides, known)) return;
  const remote = /** @type {string} */ (state.remote);
  const looks = [
    { ref: trackingRef(remote), named: `${remote}'s ${STATE_BRANCH}`, way: `put the state's own line back on ${remote} — this clone's ${STATE_BRANCH} holds it` },
    { ref: BRANCH_REF, named: `this clone's ${STATE_BRANCH}`, way: `point ${STATE_BRANCH} back at the state's own line — ${remote}'s ${STATE_BRANCH} holds it` },
  ];
  for (const { ref, named, way } of looks) {
    refuseCodeHistory(state.root, ref, named, `so the catch-up neither merges nor pushes it, and wrote nothing. To carry on, ${way}`);
  }
}

/**
 * One step: fetch, then act on where the two sides stand. After a push that
 * failed, a remote that has not moved since ends the loop with that failure.
 * @param {State} state @param {Timeouts} timeouts @param {Retry|null} retry
 * @param {RemoteAnswer} [asked] the remote's answer, where the caller asked it already
 * @returns {{outcome: CatchUpOutcome}|{retry: Retry}}
 */
function step(state, timeouts, retry, asked) {
  const known = lastKnown(state);
  const fetched = fetchState(state, timeouts.fetchMs, asked);
  if ('outcome' in fetched) {
    return { outcome: retry === null ? fetched.outcome : { ...retry.outcome, warnings: [...retry.outcome.warnings, ...fetched.outcome.warnings] } };
  }
  if (retry !== null && fetched.tip === retry.onto) return { outcome: retry.outcome };
  const sides = sidesOf(state, fetched.tip);
  if (sides.local === sides.remote) return { outcome: outcome(state, 'nothing', { reason: 'current' }) };
  refuseSideHoldingCode(state, sides, known);
  if (sides.base === sides.remote) return pushAhead(state, sides, timeouts);
  return mergeSides(state, sides, timeouts);
}

/**
 * Catch up: first finish a landing a kill cut short, then step, retrying
 * while the remote moves under the push — the first step on the remote's
 * answer where the caller asked it already, each retry asking afresh. What
 * earlier steps merged rides on the outcome the last one answers. A kept
 * stop goes once the catch-up settles anywhere but at a stop or an
 * unreachable remote.
 * @param {State} state @param {Timeouts} timeouts @param {RemoteAnswer} [asked]
 * @returns {CatchUpOutcome}
 */
function converge(state, timeouts, asked) {
  const carried = { notes: finishLanding(state, STATE_BRANCH), merged: /** @type {string[]} */ ([]) };
  /** @type {Retry|null} */
  let retry = null;
  /** @type {CatchUpOutcome|null} */
  let settled = null;
  for (let attempt = 1; attempt <= MERGE_ATTEMPTS && settled === null; attempt++) {
    const next = step(state, timeouts, retry, attempt === 1 ? asked : undefined);
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

/** @param {CatchUpOptions} opts @returns {Timeouts} */
function timeoutsOf({ fetchTimeoutMs = FETCH_TIMEOUT_MS, pushTimeoutMs = PUSH_TIMEOUT_MS } = {}) {
  return { fetchMs: fetchTimeoutMs, pushMs: pushTimeoutMs };
}

// --- the API ----------------------------------------------------------------

/**
 * Bring the state up to date with the remote's (4.7.8), under the writer
 * lock: fast-forward, push what a failed push left behind, or merge. Boot
 * runs it before anything writes state, on the remote's answer its own
 * checks asked (`listing`), so the remote is asked once.
 * @param {string} root  the state root
 * @param {CatchUpOptions & {listing?: RemoteAnswer}} [opts]
 * @returns {CatchUpOutcome}
 */
function catchUpState(root, opts = {}) {
  return withStateLock(root, () => converge(openState(root, opts), timeoutsOf(opts), opts.listing));
}

/**
 * The questions waiting on the person: the merge's, asked afresh from this
 * clone's tip and the remote's as last fetched, with the kept stop's picks.
 * Null where no stop is kept, a landing is under way, which the next
 * catch-up finishes, or the sides no longer differ.
 * @param {State} state
 * @returns {{conflicts: Conflict[]}|null}
 */
function waitingMerge(state) {
  const stop = readKeptStop(state);
  if (stop === null || state.remote === null || fs.existsSync(state.landingFile)) return null;
  const remote = state.main.tryRun(['rev-parse', '--verify', '--quiet', `${trackingRef(state.remote)}^{commit}`]);
  if (remote === null) return null;
  const sides = sidesOf(state, remote.trim());
  return sides.local === sides.remote ? null : { conflicts: questionsOf(state, sides, stop) };
}

/**
 * The state merge waiting on the person's pick, as it is now asked; null
 * where none waits, or every field is picked and the next catch-up finishes
 * it. A read, outside the writer lock: its private index and scratch files
 * are in a folder of its own, so it never meets those of a merge a peer
 * holds the lock for, and the pick asks afresh under the lock.
 * @param {string} root  the state root
 * @returns {{conflicts: Conflict[]}|null}
 */
function pendingStateMerge(root) {
  const own = fs.mkdtempSync(path.join(os.tmpdir(), 'leeway-merge-'));
  try {
    const waiting = waitingMerge({ ...openState(root, {}), index: path.join(own, 'index'), scratch: path.join(own, 'files') });
    return waiting === null || !waiting.conflicts.some(open) ? null : waiting;
  } finally {
    fs.rmSync(own, { recursive: true, force: true });
  }
}

/**
 * Record the person's pick for the choice the screen showed — `1` keeps
 * this machine's value, `2` the remote's — and, once every field is picked,
 * finish the merge (4.7.11). The pick names the shown choice by its
 * identity; where the merge now asks another, the pick is not taken, and the
 * outcome carries the new question.
 * @param {string} root  the state root
 * @param {string} key
 * @param {string} choice  the identity the screen's DATA carried
 * @param {CatchUpOptions} [opts]
 * @returns {CatchUpOutcome}
 */
function pickStateMerge(root, key, choice, opts = {}) {
  const side = Object.hasOwn(PICK_KEYS, key) ? PICK_KEYS[key] : undefined;
  if (side === undefined) throw new Error(`a state merge pick is 1 (this machine's value) or 2 (the remote's), got "${key}"`);
  return withStateLock(root, () => {
    const state = openState(root, opts);
    const waiting = waitingMerge(state);
    if (waiting === null) throw new Error('no state merge is waiting on a pick');
    const { conflicts } = waiting;
    const asked = conflicts.find(open);
    if (asked === undefined) return converge(state, timeoutsOf(opts));
    if (choiceId(asked) !== choice) return outcome(state, 'stopped', { conflicts, warnings: [NOT_ASKED] });
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
 * `state-merge pick <1|2> <choice>`: the person's pick at the stop's screen,
 * with the identity of the choice the screen's DATA carried.
 * @param {string} cwd @param {string[]} argv
 * @returns {CatchUpOutcome}
 */
function stateMergeCommand(cwd, argv) {
  const [command, ...rest] = argv;
  if (command !== 'pick' || rest.length !== 2) throw new Error('Usage: engine state-merge pick <1|2> <choice>');
  return pickStateMerge(stateRoot(cwd), rest[0], rest[1]);
}

module.exports = {
  catchUpState,
  pendingStateMerge,
  pickStateMerge,
  stateMergeGateSurface,
  stateMergeCommand,
};
