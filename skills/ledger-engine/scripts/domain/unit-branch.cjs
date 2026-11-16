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
//   and the manifest records none, from the cut as it then stands, a phase
//   built before the migration cut the unit counting for none — so a unit
//   the migration cut mid-build gets its branch as the first phase it still
//   builds starts, where two or more are left; a cut
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
// - Kept current (7.2.36): each later phase start's close, and the review
//   phase's entry at its first round (review-entry.cjs, landing.cjs), bring
//   the default branch, as the host has it — fetched where the driver lands
//   through one, so the person's unpushed commits never come in — into the
//   unit's branch, as the driver lands it, in each repository holding it,
//   children first (`bringUp`): by a merge commit, `Merge {default} into
//   feat/{unit}` (landing-names.cjs), made with no checkout and signed as
//   the person signs, its first parent the unit's branch, so the line the
//   landing record names is kept — a merge even where the default branch
//   holds the branch's tip; nothing where the branch
//   holds the default branch already. The merge is pushed to the host, leased
//   on its copy there, then the branch moved here, nothing moving where a
//   checkout that has it out holds changes the move would touch (7.2.20).
// - A conflict refuses, nothing moved and nothing recorded: the merge is
//   begun in a worktree made for it, detached (landing-git.cjs,
//   `mergingTree`), its conflicts left in its files, and the refusal names
//   each path, the worktree and the way on — settled and finished there,
//   then the same step run again, which takes it onto the branch, pushed
//   and moved, and the worktree taken apart; if the default branch moved
//   since, it brings that in on top, as any bring-up does, a conflict
//   refusing again. A merge not finished there refuses again, naming what
//   still conflicts; one the branch moved past since, which holds none of
//   that move, refuses, the way on taking the worktree apart so the merge
//   is begun again. Until it is taken, every land verb in the repository
//   waits on it (landing-git.cjs, `scratchBlock`).
// - At finish (landing.cjs), where the unit's branch would conflict with
//   the default branch it lands on, the default branch is brought into it
//   first by the same merge (`broughtUpToLand`); a conflict left begins
//   the same merge with the same way on, and finish run again takes it
//   before anything lands (`settlementsTaken`).
// - Never deleted by the engine (7.2.41).
// ---------------------------------------------------------------------------

const lg = require('./landing-git.cjs');
const names = require('./landing-names.cjs');
const { chosenDriver } = require('./drivers.cjs');
const { remoteName, nestedRemoteName } = require('./remote.cjs');
const { cutPhases, phaseBuilt, phaseStarted } = require('./derivations.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { projectRepos, childrenFirst } = require('../kernel/repos.cjs');

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

/** The phases of the unit's cut its build builds, by number: each but those built before the migration cut the unit (21.8.6). @param {Record<string, any>} manifest @returns {number[]} */
const phasesToBuild = (manifest) => cutPhases(manifest).flatMap((_, at) => (phaseBuilt(manifest, at + 1) ? [] : [at + 1]));

/** Whether a phase start of the unit's build has closed: only the cut's phases it builds have one. @param {Record<string, any>} manifest */
const phaseStartClosed = (manifest) => phasesToBuild(manifest).some((number) => phaseStarted(manifest, number));

/**
 * Whether the phase start closing now gives the unit a branch of its own
 * (the header's): an epic or a feature whose cut holds two or more phases
 * its build builds, none recorded, no phase start of its build closed
 * before.
 * @param {Record<string, any>} manifest
 */
function branchWanted(manifest) {
  return BRANCHED_TYPES.includes(manifest.work_type) && typeof manifest.build?.branch !== 'string' && !phaseStartClosed(manifest) && phasesToBuild(manifest).length >= 2;
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
 * cannot be fetched, saying what was `not` done.
 * @param {BranchHome} home @param {string} not @param {{undone: string, then: string}} making
 * @returns {{into: string, tip: string}}
 */
function defaultTip(home, not, { undone, then }) {
  const into = lg.defaultBranch(home.root, home.remote, home.nested !== null);
  if (!home.hosted) return { into, tip: /** @type {string} */ (lg.branches(home.root).get(into)) };
  const fetched = lg.fetchBranch(home.root, /** @type {string} */ (home.remote), into);
  if ('failed' in fetched) throw new Error(`${home.remote}/${into} could not be fetched (${fetched.failed}), so ${not} and ${undone} — ${then} once it can be`);
  return { into, tip: fetched.commit };
}

/**
 * What a phase start's close does with the unit's branch before it records
 * itself (the header's): the first of the build, where the unit wants a
 * branch of its own (`branchWanted`), makes it and answers its name for
 * the close to record; a later one brings the default branch into the
 * branch recorded (`bringUp`); any other does nothing. Null where nothing
 * is to be recorded.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest @param {number} phase
 * @returns {string|null}
 */
function atPhaseStart(cwd, unit, manifest, phase) {
  const recorded = manifest.build?.branch;
  const making = { undone: 'nothing was recorded', then: `close phase ${phase}'s start again` };
  if (typeof recorded === 'string') {
    bringUp(cwd, unit, recorded, making);
    return null;
  }
  if (!branchWanted(manifest)) return null;
  const branch = names.unitBranch(unit);
  asStep('.', () => {
    const home = ownHome(cwd);
    const { into, tip } = defaultTip(home, `${unit}'s branch was not made`, making);
    madeAt(home, branch, tip, hostCopy(home, branch), { into, held: tip, ...making });
  });
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
  const { into, tip } = defaultTip(home, `${unit}'s branch was not made`, making);
  const theirs = hostCopy(home, branch);
  if (theirs !== null && lg.namedPast(home.root, unit, tip, theirs).some(({ ids }) => ids.length > 0)) {
    lg.moveBranch(home.root, branch, lg.branches(home.root).get(branch) ?? null, theirs);
    return;
  }
  madeAt(home, branch, lg.mergeBase(home.root, `refs/heads/${task}`, tip), theirs, { into, held: tip, ...making });
}

/**
 * What a step keeping the unit's branch current refuses with: what was not
 * done, and the step the way on runs again, which takes a merge settled in
 * the worktree a refusal names.
 * @typedef {{undone: string, then: string}} Bringing
 */

/**
 * The unit's branch in a repository as the step reads it: here, the host's
 * copy, fetched — null where it has none, or the driver lands through no
 * host there — and so its tip as the driver lands it.
 * @typedef {{here: string|null, hosted: string|null, tip: string}} Standing
 */

/** A repository of the project, as its unit's branch is kept current there. @param {string} cwd @param {import('../kernel/repos.cjs').Repo} repo @param {LandingDriver} driver @returns {BranchHome} */
function homeOf(cwd, repo, driver) {
  const remote = repo.dir === '' ? remoteName(cwd) : nestedRemoteName(repo.path);
  return { root: repo.path, nested: repo.dir === '' ? null : repo.dir, remote, hosted: landsThroughHost(driver, remote) };
}

/** The unit's branch in a repository, readied where this clone lacks it here (`readied`), as the step reads it. @param {BranchHome} home @param {string} unit @param {string} branch @returns {Standing} */
function standingOf(home, unit, branch) {
  readied(home, unit, branch);
  const here = lg.branches(home.root).get(branch) ?? null;
  const hosted = hostCopy(home, branch);
  return { here, hosted, tip: /** @type {string} */ (hosted ?? here) };
}

/**
 * What `act` answers for a step keeping the unit's branch, its refusal the
 * repository's own — the project's as it is, a nested one's naming it,
 * `repo` its folder — never worded as a land verb's.
 * @template T @param {string} repo @param {() => T} act @returns {T}
 */
function asStep(repo, act) {
  try {
    return act();
  } catch (err) {
    if (err instanceof Error) err.message = lg.saidIn(repo, err.message.replace(/^land: /, ''));
    throw err;
  }
}

/**
 * Where the unit's branch, at `tip`, goes on from the merge held in the
 * worktree made for it (the header's): `tip` where none is held, or the
 * branch holds what it made already; else what it made, where it stands on
 * `tip` — the worktree's folder given where one is held. Refused while the
 * merge there is not finished, and where the branch moved since past what
 * it made.
 * @param {BranchHome} home @param {string} branch @param {string} tip @param {string} then
 * @returns {{ours: string, held: string|null}}
 */
function settled(home, branch, tip, then) {
  const held = lg.mergeHeld(home.root, branch);
  if (held === null) return { ours: tip, held: null };
  if (held.unmerged !== null) {
    const still = held.unmerged.length === 0 ? 'is not finished' : `still conflicts at ${held.unmerged.map(lg.plain).join(', ')}`;
    throw new Error(`the merge into ${branch} begun at ${held.path} ${still}, so nothing moved — settle each conflict there and finish the merge, as ${lg.mergeContinued(held.path)} does once they are, then ${then}`);
  }
  if (lg.isAncestor(home.root, held.head, tip)) return { ours: tip, held: held.path };
  if (lg.isAncestor(home.root, tip, held.head)) return { ours: held.head, held: held.path };
  const remove = lg.removing(held, home.nested === null ? undefined : home.root);
  throw new Error(`${branch} moved to ${lg.short(tip)} since the merge into it was begun at ${held.path}, and the merge settled there, ${lg.short(held.head)}, holds none of that, so nothing moved — take that worktree apart with ${remove}, then ${then}, which begins the merge again`);
}

/**
 * The unit's branch moved to `to` (the header's): refused, nothing moved,
 * where a checkout that has it out holds changes the move would touch — as
 * a land verb's move refuses, its way on this step run again in place of
 * landing again (landing-git.cjs, `checkoutBlock`);
 * pushed to the host, leased on its copy there, then moved here; and the
 * worktree a merge was held in, `held`, taken apart.
 * @param {BranchHome} home @param {string} branch @param {Standing} at @param {string} to @param {string|null} held @param {Bringing} bringing
 * @returns {string} `to`
 */
function movedTo(home, branch, { here, hosted }, to, held, { undone, then }) {
  const block = here === null || here === to ? null : lg.checkoutBlock(home.root, branch, { from: here, to });
  if (block !== null) throw new Error(block.replace('land again', then));
  if (home.hosted && hosted !== to) lg.pushBranches(home.root, /** @type {string} */ (home.remote), [{ branch, commit: to, lease: hosted ?? '' }], `${branch} was not moved and ${undone} — clear what git names, and ${then}`);
  if (here !== to) lg.moveBranch(home.root, branch, here, to);
  if (held !== null) lg.mergeDone(home.root, held);
  return to;
}

/**
 * A merge of the default branch into the unit's branch, as the step makes
 * it: the default branch by name and by its tip, and the unit's branch's
 * side.
 * @typedef {{into: string, theirs: string, ours: string}} Merging
 */

/** The default branch as a refusal of the step names it: as the host has it, where the driver lands through one. @param {BranchHome} home @param {string} into */
const theirsNamed = (home, into) => (home.hosted ? `${home.remote}/${into}` : into);

/**
 * The merge stopped where the default branch conflicts with the unit's
 * branch at `paths` (the header's): begun in the worktree made for it, and
 * the refusal naming each path, the worktree and the way on — `so` what
 * did not happen, and `then` the step run again.
 * @param {BranchHome} home @param {string} branch @param {Merging} merging @param {string[]} paths @param {{so: string, then: string}} words
 * @returns {string}
 */
function mergeStopped(home, branch, { into, theirs, ours }, paths, { so, then }) {
  const tree = lg.mergeBegun(home.root, { branch, ours, theirs, message: `${names.bringUpSubject(into, branch)}\n`, then });
  return `${theirsNamed(home, into)} conflicts with ${branch} at ${paths.map(lg.plain).join(', ')}, so ${so} — the merge is begun at ${tree}, a worktree of its own: `
    + `settle each conflict there and finish the merge, as ${lg.mergeContinued(tree)} does once they are, then ${then}, which takes it onto ${branch}; every land verb in the repository waits on it until then, a quick-fix's among them`;
}

/**
 * The default branch, at `theirs`, merged into the unit's branch, at
 * `ours` (the header's): the merge commit, its first parent `ours` —
 * refused where the two conflict, the merge begun in its worktree
 * (`mergeStopped`).
 * @param {BranchHome} home @param {string} branch @param {string} into @param {string} ours @param {string} theirs @param {Bringing} bringing
 * @returns {string}
 */
function mergedIn(home, branch, into, ours, theirs, bringing) {
  const { root } = home;
  const merged = lg.mergeTree(root, lg.mergeBase(root, ours, theirs), ours, theirs);
  if ('conflicts' in merged) {
    const named = theirsNamed(home, into);
    throw new Error(mergeStopped(home, branch, { into, theirs, ours }, merged.conflicts, { so: `${named} was not brought into ${branch} and ${bringing.undone}`, then: bringing.then }));
  }
  const { tree } = merged;
  return lg.commitTree(root, { tree, parent: [ours, theirs], message: `${names.bringUpSubject(into, branch)}\n`, signed: lg.signs(root) }, `the merge of ${into} into ${branch}`, bringing.then);
}

/**
 * The default branch brought into the unit's branch in one repository (the
 * header's), a merge held in its worktree taken first (`settled`): its tip
 * as brought up.
 * @param {BranchHome} home @param {string} unit @param {string} branch @param {Bringing} bringing
 * @returns {string}
 */
function broughtUpIn(home, unit, branch, bringing) {
  const { into, tip: theirs } = defaultTip(home, `nothing was brought into ${branch}`, bringing);
  const at = standingOf(home, unit, branch);
  const { ours, held } = settled(home, branch, at.tip, bringing.then);
  const to = lg.isAncestor(home.root, theirs, ours) ? ours : mergedIn(home, branch, into, ours, theirs, bringing);
  return movedTo(home, branch, at, to, held, bringing);
}

/**
 * The default branch, at `theirs`, merged into the unit's branch in one
 * repository as finish lands it there, where landing it would conflict
 * (the header's): the merge a bring-up makes (`mergedIn`) — pushed
 * and moved as a bring-up's is, refused the same where the two still
 * conflict. Its tip.
 * @param {string} cwd @param {import('../kernel/repos.cjs').Repo} repo @param {string} unit @param {{branch: string, into: string, theirs: string}} merging the unit's branch, and the default branch by name and by its tip @param {Bringing} bringing
 * @returns {string}
 */
function broughtUpToLand(cwd, repo, unit, { branch, into, theirs }, bringing) {
  const home = homeOf(cwd, repo, /** @type {LandingDriver} */ (chosenDriver(cwd, 'landing').driver));
  const at = standingOf(home, unit, branch);
  return movedTo(home, branch, at, mergedIn(home, branch, into, at.tip, theirs, bringing), null, bringing);
}

/**
 * `act` run in each repository of the project holding the unit's branch,
 * children first, with its home.
 * @param {string} cwd @param {string} unit @param {(home: BranchHome) => unknown} act
 */
function eachHolding(cwd, unit, act) {
  const driver = /** @type {LandingDriver} */ (chosenDriver(cwd, 'landing').driver);
  for (const repo of childrenFirst(projectRepos(codeRoot(cwd)))) {
    if (lg.unitBranchIn(cwd, repo, unit) !== null) asStep(repo.dir === '' ? '.' : repo.dir, () => act(homeOf(cwd, repo, driver)));
  }
}

/**
 * The default branch brought into the unit's branch, `branch`, in each
 * repository of the project holding it, children first (the header's).
 * @param {string} cwd @param {string} unit @param {string} branch @param {Bringing} bringing
 */
function bringUp(cwd, unit, branch, bringing) {
  eachHolding(cwd, unit, (home) => broughtUpIn(home, unit, branch, bringing));
}

/**
 * Each merge into the unit's branch held in its worktree taken onto the
 * branch, in each repository of the project holding one, children first,
 * as finish's landing takes it before the branch lands (the header's) —
 * nothing for a unit with no branch of its own.
 * @param {string} cwd @param {string} unit @param {Bringing} bringing
 */
function settlementsTaken(cwd, unit, bringing) {
  const branch = lg.recordedBranch(cwd, unit);
  if (branch === null) return;
  eachHolding(cwd, unit, (home) => {
    if (lg.mergeHeld(home.root, branch) === null) return;
    const at = standingOf(home, unit, branch);
    const { ours, held } = settled(home, branch, at.tip, bringing.then);
    movedTo(home, branch, at, ours, held, bringing);
  });
}

module.exports = { landsThroughHost, atPhaseStart, readied, madeNested, bringUp, broughtUpToLand, settlementsTaken };
