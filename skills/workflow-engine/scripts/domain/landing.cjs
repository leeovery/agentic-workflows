'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the `land` verbs (6.1.8, 7.2.8), a task's change landed
// through the project's landing driver (drivers.cjs): `open` the task's pull
// request, `chain` it into its phase's stack, merge a `phase` whole, and
// `finish`, which merges every phase still standing — the review phase's fix
// phases, after every other (7.2.6).
//
// What every driver shares is settled here: the names (landing-names.cjs);
// the default branch everything lands on, never the state branch (4.9.4);
// and, for a task opened, its branch, named from its type and title, whose
// change carries nothing under `.leeway/`, in any case of its letters (4.1.3,
// 4.S2), and lands in the project's own repository alone — nested
// repositories are not supported yet. The driver answers the chain's tip
// the task lands on, and the seam holds the task's branch to descend from
// it before the driver opens anything (12.7.1). A task is named by its id's
// shape alone; that it exists and passed its review is the build's to know.
// Before anything else, every verb stops on a rebase stopped in a worktree
// a remedy made, until it is settled or ended there (landing-git.cjs).
//
// The landing's state is read off git and the host each time. Nothing is
// recorded but the driver setting, which the first verb settles where it is
// absent and commits to the state branch, whatever the driver then does, and
// what a driver keeps in the repository's own refs.
// ---------------------------------------------------------------------------

const { resolveDriver } = require('./drivers.cjs');
const { commitStateTail, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { remoteName } = require('./remote.cjs');
const { assertUnit, parseShownTask, shownTask } = require('./task-id.cjs');
const names = require('./landing-names.cjs');
const lg = require('./landing-git.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { projectRepos } = require('../kernel/repos.cjs');
const { STATE_DIR_NAME } = require('../kernel/state-root.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('./drivers.cjs').LandingDriver} LandingDriver */

/**
 * What a landing driver is called with: the code root its git runs in, the
 * unit, and the default branch everything lands on.
 * @typedef {{root: string, unit: string, into: string}} LandingContext
 */

/**
 * A task to land: its id, its branch, and the message it lands under.
 * @typedef {{ref: TaskRef, branch: string, message: string}} LandingTask
 */

/**
 * The chain's tip a driver answers for a task: the branch the task's branch
 * must descend from, and that branch's commit, which the repository has
 * locally. A driver may carry more on it for its own `open`.
 * @typedef {{name: string, commit: string}} ChainTip
 */

const LAND_USAGE = [
  'land open <work-unit> <phase>.<task> --type <type> --title <title>',
  'land chain <work-unit> <phase>.<task>',
  'land phase <work-unit> <phase>',
  'land finish <work-unit>',
].join('\n');

/**
 * The context every verb hands its driver, once no rebase a remedy began is
 * stopped.
 * @param {string} cwd @param {string} unit @returns {LandingContext}
 */
function contextOf(cwd, unit) {
  assertUnit(unit);
  const root = codeRoot(cwd);
  const stopped = lg.scratchBlock(root);
  if (stopped !== null) throw new Error(`land: ${stopped}`);
  return { root, unit, into: lg.defaultBranch(root, remoteName(cwd)) };
}

/**
 * Run a driver's verb with the project's landing driver, committing the
 * setting where this call settled it, whether or not the driver refused.
 * @param {string} cwd @param {(driver: LandingDriver) => Record<string, unknown>} act
 */
function withDriver(cwd, act) {
  const { driver, written } = resolveDriver(cwd, 'landing');
  /** @type {string[]} */
  const warnings = [];
  /** @type {string|null} */
  let committed = null;
  /** @type {Record<string, unknown>} */
  let answer;
  try {
    answer = act(/** @type {LandingDriver} */ (driver));
  } finally {
    if (written) committed = commitStateTail(cwd, PROJECT_MANIFEST_SPEC, `chore: the landing driver is ${driver.name}`, warnings).committed;
  }
  return { ...answer, driver: driver.name, ...(written ? { committed } : {}), ...(warnings.length > 0 ? { warnings } : {}) };
}

/**
 * Refuse a task whose change carries the state, or reaches another
 * repository: a nested one's moved pointer, or a branch of its own there.
 * @param {LandingContext} ctx @param {string} shown @param {string} branch
 */
function refuseChange(ctx, shown, branch) {
  const change = lg.changeOf(ctx.root, ctx.into, branch);
  const state = change.map(({ path }) => path).filter((path) => {
    const folded = path.toLowerCase();
    return folded === STATE_DIR_NAME || folded.startsWith(`${STATE_DIR_NAME}/`);
  });
  if (state.length > 0) {
    throw new Error(`land: task ${shown}'s change carries ${state.join(', ')} — the workflows' state never lands on a code branch, so take it off the task's branch and open the task again`);
  }
  const moved = change.filter(({ gitlink }) => gitlink).map(({ path }) => path);
  const nested = projectRepos(ctx.root).slice(1).filter((repo) => lg.branches(repo.path).has(branch)).map((repo) => repo.dir);
  const reached = [...new Set([...moved, ...nested])];
  if (reached.length > 0) {
    throw new Error(`land: task ${shown}'s change reaches the nested ${reached.length === 1 ? 'repository' : 'repositories'} ${reached.join(', ')} — nested repositories are not supported yet, so take that change off the task's branch and open the task again`);
  }
}

/**
 * The task's pull request opened — locally, its change squashed onto its
 * phase's branch.
 * @param {string} cwd @param {string} unit @param {string} task shown, `{phase}.{n}`
 * @param {{type: string, title: string}} named
 */
function landOpen(cwd, unit, task, { type, title }) {
  const ref = parseShownTask(unit, task);
  const shown = shownTask(ref);
  const branch = names.taskBranch(ref, type, title);
  const message = names.landedMessage(ref, type, title);
  const ctx = contextOf(cwd, unit);
  if (!lg.branches(ctx.root).has(branch)) throw new Error(`land: task ${shown} has no branch ${branch} — its type and title name it, so open it with those its branch was named from`);
  refuseChange(ctx, shown, branch);
  const landing = { ref, branch, message };
  return withDriver(cwd, (driver) => {
    /** @type {ChainTip} */
    const tip = driver.chainTip(ctx, landing);
    if (!lg.isAncestor(ctx.root, tip.commit, branch)) {
      throw new Error(`land: task ${shown}'s branch ${branch} does not descend from the chain's tip, ${tip.name} (${lg.short(tip.commit)}) — merge it back onto ${tip.name} first`);
    }
    return driver.open(ctx, landing, tip);
  });
}

/**
 * The task chained into its phase's stack, answered in the order its tasks
 * were merged back.
 * @param {string} cwd @param {string} unit @param {string} task shown, `{phase}.{n}`
 */
function landChain(cwd, unit, task) {
  const ref = parseShownTask(unit, task);
  const ctx = contextOf(cwd, unit);
  return withDriver(cwd, (driver) => driver.chain(ctx, ref));
}

/**
 * A phase merged whole.
 * @param {string} cwd @param {string} unit @param {string} phase
 */
function landPhase(cwd, unit, phase) {
  if (!/^[1-9][0-9]*$/.test(phase)) throw new Error(`land: the phase is a whole number from 1 — got "${phase}"`);
  const ctx = contextOf(cwd, unit);
  return withDriver(cwd, (driver) => driver.mergePhase(ctx, Number(phase)));
}

/**
 * Every phase still standing merged, after every other (7.2.6).
 * @param {string} cwd @param {string} unit
 */
function landFinish(cwd, unit) {
  const ctx = contextOf(cwd, unit);
  return withDriver(cwd, (driver) => driver.finish(ctx));
}

module.exports = { LAND_USAGE, landOpen, landChain, landPhase, landFinish };
