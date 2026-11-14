'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a unit's own branch (7.2.34–7.2.41). An epic or a feature
// whose build starts with two or more phases of its cut has a branch of its
// own, `feat/{unit}` (landing-names.cjs): each phase's stack starts from it
// and merges into it, and it lands on the default branch once, at finish
// (landing.cjs). Every other unit lands on the default branch.
//
// - Decided once, as the first phase start of the build closes
//   (checklist.cjs): where no phase start of the build has closed before
//   and the manifest records none, from the cut as it then stands; a cut
//   that gains or loses phases later never moves where the unit lands. It
//   is kept as `build.branch` on the unit's manifest, written by that
//   close's own state commit and nothing else.
// - Made then, in the project's own repository, at the default branch's tip
//   as the host has it — fetched where the landing driver lands through a
//   host — and pushed there before it is made here, so nothing is laid out
//   on a branch the host lacks. A branch of that name, here or on the host,
//   that holds a commit the default branch lacks is another's: the close is
//   refused, writing nothing, naming it and where it is, the way on to
//   delete or rename it there (19.5.33). One holding nothing the default
//   branch lacks is taken, brought to that tip — as a start killed between
//   its push and its record leaves it.
// - Readied where the manifest records it and the repository lacks it here,
//   as a second clone does: made here at the host's copy, fetched — else
//   at the remote's as last fetched — and never cut anew (19.5.30); by
//   every verb that lands onto it (landing.cjs), and by each later phase
//   start's close. Refused where neither has it.
// - In a nested repository (7.2.40), made where the unit's first task
//   touching it opens there, at the commit that task's branch was cut from
//   that repository's default branch, so the task descends from it — the
//   host's copy taken as it stands where it is the unit's, holding a commit
//   that names one of its tasks, as a second clone finds it. A repository
//   the unit never touches gets none, and its host is asked nothing.
// - Never deleted by the engine (7.2.41).
// ---------------------------------------------------------------------------

const lg = require('./landing-git.cjs');
const names = require('./landing-names.cjs');
const { chosenDriver } = require('./drivers.cjs');
const { remoteName } = require('./remote.cjs');
const { cutPhases, cutLength, phaseStarted } = require('./derivations.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');

/** @typedef {import('./drivers.cjs').LandingDriver} LandingDriver */

/**
 * A repository a unit's branch is made or readied in: its folder; where it
 * is, as a refusal names it, null for the project's own; its remote, null
 * where it has none chosen; and whether the landing driver lands through
 * the host there.
 * @typedef {{root: string, nested: string|null, remote: string|null, hosted: boolean}} BranchHome
 */

/** The work types a branch of their own may come to (7.2.34). */
const BRANCHED_TYPES = Object.freeze(['epic', 'feature']);

/**
 * Whether a landing driver lands through the host at a remote: it reads the
 * branch a merge lands onto there (`landsOn`), and the repository has a
 * remote chosen.
 * @param {LandingDriver} driver @param {string|null} remote
 */
const landsThroughHost = (driver, remote) => driver.landsOn !== undefined && remote !== null;

/** Whether a phase start of the unit's build has closed: only the cut's phases have one. @param {Record<string, any>} manifest */
const phaseStartClosed = (manifest) => cutPhases(manifest).some((_, at) => phaseStarted(manifest, at + 1));

/**
 * Whether the phase start closing now gives the unit a branch of its own
 * (the header's): an epic or a feature whose cut holds two or more phases,
 * none recorded, no phase start of its build closed before.
 * @param {Record<string, any>} manifest
 */
function branchWanted(manifest) {
  return BRANCHED_TYPES.includes(manifest.work_type) && typeof manifest.build?.branch !== 'string' && !phaseStartClosed(manifest) && cutLength(manifest) >= 2;
}

/** Where a branch is, as a refusal names it. @param {BranchHome} home @param {boolean} onHost */
function whereOf(home, onHost) {
  const repo = home.nested === null ? '' : `${lg.plain(home.nested)}'s `;
  if (onHost) return `on ${repo}${home.remote}`;
  return home.nested === null ? 'here' : `in ${lg.plain(home.nested)}`;
}

/**
 * Refuse a copy of the unit's branch that holds a commit the default branch
 * lacks: another's (the header's), naming it and where it is.
 * @param {BranchHome} home @param {string} branch @param {string|null} copy @param {boolean} onHost @param {Making} making
 */
function refuseStranger(home, branch, copy, onHost, { into, held, undone, then }) {
  if (copy === null || lg.isAncestor(home.root, copy, held)) return;
  const where = whereOf(home, onHost);
  throw new Error(`${branch} ${where} holds commits ${into} lacks, so it is no branch the unit made: nothing was made and ${undone} — delete or rename it ${where === 'here' ? 'here' : 'there'}, and ${then}`);
}

/** The host's copy of a branch, fetched, null where the host has none or cannot be read. @param {BranchHome} home @param {string} branch */
function hostCopy(home, branch) {
  if (!home.hosted) return null;
  const fetched = lg.fetchBranch(home.root, /** @type {string} */ (home.remote), branch);
  return 'commit' in fetched ? fetched.commit : null;
}

/**
 * What a making refuses with: the default branch, as a refusal names it,
 * and its tip; what was not done, and what the way on runs again.
 * @typedef {{into: string, held: string, undone: string, then: string}} Making
 */

/**
 * The unit's branch at `tip` (the header's): its copies here and on the
 * host, `theirs`, refused where either holds a commit the default branch,
 * at `held`, lacks; then pushed to the host where its copy there is not at
 * `tip` — leased on that copy, or on none — before it is made or moved
 * here.
 * @param {BranchHome} home @param {string} branch @param {string} tip @param {string|null} theirs @param {Making} making
 */
function madeAt(home, branch, tip, theirs, making) {
  const here = lg.branches(home.root).get(branch) ?? null;
  refuseStranger(home, branch, here, false, making);
  refuseStranger(home, branch, theirs, true, making);
  if (home.hosted && theirs !== tip) lg.pushBranches(home.root, /** @type {string} */ (home.remote), [{ branch, commit: tip, lease: theirs ?? '' }], `${branch} was not made and ${making.undone} — clear what git names, and ${making.then}`);
  if (here !== tip) lg.moveBranch(home.root, branch, here, tip);
}

/** The project's own repository, as its unit's branch is made or readied there. @param {string} cwd @returns {BranchHome} */
function ownHome(cwd) {
  const remote = remoteName(cwd);
  return { root: codeRoot(cwd), nested: null, remote, hosted: landsThroughHost(/** @type {LandingDriver} */ (chosenDriver(cwd, 'landing').driver), remote) };
}

/**
 * A repository's default branch, and its tip as the host has it, fetched
 * where the landing driver lands through the host — refused where it
 * cannot be fetched.
 * @param {BranchHome} home @param {string} unit @param {{undone: string, then: string}} making
 * @returns {{into: string, tip: string}}
 */
function defaultTip(home, unit, { undone, then }) {
  const into = lg.defaultBranch(home.root, home.remote, home.nested !== null);
  if (!home.hosted) return { into, tip: /** @type {string} */ (lg.branches(home.root).get(into)) };
  const fetched = lg.fetchBranch(home.root, /** @type {string} */ (home.remote), into);
  if ('failed' in fetched) throw new Error(`${home.remote}/${into} could not be fetched (${fetched.failed}), so ${unit}'s branch was not made and ${undone} — ${then} once it can be`);
  return { into, tip: fetched.commit };
}

/**
 * What a phase start's close does with the unit's branch before it records
 * itself (the header's): the first of the build, where the unit wants a
 * branch of its own (`branchWanted`), makes it and answers its name for
 * the close to record; a later one readies the branch recorded where the
 * project's own repository lacks it here; any other does nothing. Null
 * where nothing is to be recorded.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {number} phase
 * @returns {string|null}
 */
function atPhaseStart(cwd, unit, manifest, phase) {
  const recorded = manifest.build?.branch;
  if (typeof recorded === 'string') {
    readied(ownHome(cwd), unit, recorded);
    return null;
  }
  if (!branchWanted(manifest)) return null;
  const branch = names.unitBranch(unit);
  const home = ownHome(cwd);
  const making = { undone: 'nothing was recorded', then: `close phase ${phase}'s start again` };
  const { into, tip } = defaultTip(home, unit, making);
  madeAt(home, branch, tip, hostCopy(home, branch), { into, held: tip, ...making });
  return branch;
}

/**
 * The unit's recorded branch readied in a repository that lacks it here
 * (the header's): made at the host's copy, fetched, else at the remote's as
 * last fetched — refused where neither has it.
 * @param {BranchHome} home @param {string} unit @param {string} branch
 */
function readied(home, unit, branch) {
  if (lg.branches(home.root).has(branch)) return;
  const theirs = home.hosted ? hostCopy(home, branch) : (home.remote === null ? null : lg.trackedTip(home.root, home.remote, branch));
  if (theirs === null) {
    const nowhere = home.remote === null ? 'not here, and the repository has no remote' : `neither here nor on ${home.remote}`;
    throw new Error(`land: ${branch}, where ${unit}'s work lands, is ${nowhere} — make it again at the commit its last phase merged at, as \`git branch ${branch} <commit>\` does, and run this again`);
  }
  lg.moveBranch(home.root, branch, null, theirs);
}

/**
 * The unit's branch made in a nested repository where its first task
 * touching it opens there (the header's): at the commit the task's branch
 * was cut from the repository's default branch as the host has it — the
 * host's copy taken as it stands where it names one of the unit's tasks.
 * @param {BranchHome} home @param {string} unit @param {string} branch @param {string} task the task's branch
 */
function madeNested(home, unit, branch, task) {
  const making = { undone: 'nothing opened', then: 'open the task again' };
  const { into, tip } = defaultTip(home, unit, making);
  const theirs = hostCopy(home, branch);
  if (theirs !== null && lg.namedPast(home.root, unit, tip, theirs).some(({ ids }) => ids.length > 0)) {
    lg.moveBranch(home.root, branch, lg.branches(home.root).get(branch) ?? null, theirs);
    return;
  }
  madeAt(home, branch, lg.mergeBase(home.root, `refs/heads/${task}`, tip), theirs, { into, held: tip, ...making });
}

module.exports = { landsThroughHost, branchWanted, atPhaseStart, readied, madeNested };
