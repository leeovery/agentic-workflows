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
// and, for a task opened, its type and title, read from the tracker as the
// task verbs read a task (task-verbs.cjs), a task it lacks or holds with no
// type refused (7.2.18, 12.4.1), and its branch, named from them, whose
// change carries nothing under `.leeway/`, in any case of its letters (4.1.3,
// 4.S2), and lands in the project's own repository alone — nested
// repositories are not supported yet. The driver answers the chain's tip
// the task lands on, and the seam holds the task's branch to descend from
// it before the driver opens anything (12.7.1). Every other verb names a
// task by its id's shape alone; that a task passed its review is the
// build's to know. Before anything else, every verb stops on a rebase
// stopped in a worktree a remedy made, until it is settled or ended there
// (landing-git.cjs).
//
// The landing's state is read off git and the host each time. Nothing is
// recorded but the driver setting, which the first verb settles where it is
// absent and commits to the state branch, whatever the driver then does;
// the tracker's setting up, which `open`'s read commits where the state
// branch lacks it, as every read of the tracker does; and what a driver
// keeps in the repository's own refs. A verb answers what it committed and
// was warned of, and a refusal after a commit carries that commit's
// warnings.
// ---------------------------------------------------------------------------

const { resolveDriver } = require('./drivers.cjs');
const { commitStateTail, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { remoteName } = require('./remote.cjs');
const { assertUnit, parsePhase, parseShownTask, shownTask } = require('./task-id.cjs');
const { trackedTask, ENDED } = require('./task-verbs.cjs');
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
  'land open <work-unit> <phase>.<task>',
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
 * The answer carries the verb's last state commit, null where it failed,
 * and every warning: `before`'s — what the verb committed and was warned of
 * before — and the setting's own.
 * @param {string} cwd @param {(driver: LandingDriver) => Record<string, unknown>} act
 * @param {{committed?: string|null, warnings?: string[]}} [before]
 */
function withDriver(cwd, act, before = {}) {
  const { driver, written } = resolveDriver(cwd, 'landing');
  const warnings = [...(before.warnings ?? [])];
  let { committed } = before;
  const answer = carrying(warnings, () => {
    try {
      return act(/** @type {LandingDriver} */ (driver));
    } finally {
      if (written) committed = commitStateTail(cwd, PROJECT_MANIFEST_SPEC, `chore: the landing driver is ${driver.name}`, warnings).committed;
    }
  });
  return { ...answer, driver: driver.name, ...(committed === undefined ? {} : { committed }), ...(warnings.length > 0 ? { warnings } : {}) };
}

/**
 * `act`, a refusal it throws carrying `warnings` — what the verb was warned
 * of by then — as the task verbs' refusals carry their commit's.
 * @template T @param {string[]} warnings @param {() => T} act @returns {T}
 */
function carrying(warnings, act) {
  try {
    return act();
  } catch (err) {
    if (warnings.length > 0 && err instanceof Error) err.message = `${err.message} — and ${warnings.join('; ')}`;
    throw err;
  }
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
    throw new Error(`land: task ${shown}'s change carries ${state.map(lg.plain).join(', ')} — the workflows' state never lands on a code branch, so take it off the task's branch and open the task again`);
  }
  const moved = change.filter(({ gitlink }) => gitlink).map(({ path }) => path);
  const nested = projectRepos(ctx.root).slice(1).filter((repo) => lg.branches(repo.path).has(branch)).map((repo) => repo.dir);
  const reached = [...new Set([...moved, ...nested])].map(lg.plain);
  if (reached.length > 0) {
    throw new Error(`land: task ${shown}'s change reaches the nested ${reached.length === 1 ? 'repository' : 'repositories'} ${reached.join(', ')} — nested repositories are not supported yet, so take that change off the task's branch and open the task again`);
  }
}

/**
 * The refusal of a task the tracker holds with no type: given one by `task
 * type`, or, for a task ended, which that verb refuses, its change landed
 * as a task of its own.
 * @param {TaskRef} ref @param {string} status the tracker's
 */
function untyped(ref, status) {
  const shown = shownTask(ref);
  if (!ENDED.includes(status)) {
    return `land: task ${shown} has no type in the tracker, and its branch and landing are named from it — give it one with \`task type ${ref.unit} ${shown} <type>\` and open it again`;
  }
  return `land: task ${shown} is ${status} in the tracker with no type, and only a task not yet ended takes one — its branch and landing are named from its type, `
    + `so land its change as a task of its own, made with \`task create ${ref.unit} ${ref.phase} --file <path>\``;
}

/**
 * The landing a task opens under, from the type and title the tracker holds
 * for it (7.2.18, 12.4.1): refused where it has no type, where its branch
 * is not there, and where its change carries the state or reaches another
 * repository.
 * @param {LandingContext} ctx @param {TaskRef} ref @param {{type: string|null, title: string, status: string}} task
 * @returns {LandingTask}
 */
function landingOf(ctx, ref, { type, title, status }) {
  const shown = shownTask(ref);
  if (type === null) throw new Error(untyped(ref, status));
  const branch = names.taskBranch(ref, type, title);
  if (!lg.branches(ctx.root).has(branch)) {
    throw new Error(`land: task ${shown} has no branch ${branch}, the name its type and title in the tracker give it — name its branch so and open it again`);
  }
  refuseChange(ctx, shown, branch);
  return { ref, branch, message: names.landedMessage(ref, type, title) };
}

/**
 * The task's pull request opened — locally, its change squashed onto its
 * phase's branch — under the type and title the tracker holds for it. A
 * task the tracker lacks is refused as the read finds it.
 * @param {string} cwd @param {string} unit @param {string} task shown, `{phase}.{n}`
 */
function landOpen(cwd, unit, task) {
  const ref = parseShownTask(unit, task);
  const shown = shownTask(ref);
  const ctx = contextOf(cwd, unit);
  const lacking = `land: task ${shown} of ${unit} is not in the tracker — open a task it holds, as \`task list ${unit} ${ref.phase}\` lists them`;
  const { committed, warnings, ...held } = trackedTask(cwd, ref, lacking);
  const landing = carrying(warnings ?? [], () => landingOf(ctx, ref, held));
  return withDriver(cwd, (driver) => {
    /** @type {ChainTip} */
    const tip = driver.chainTip(ctx, landing);
    if (!lg.isAncestor(ctx.root, tip.commit, landing.branch)) {
      throw new Error(`land: task ${shown}'s branch ${landing.branch} does not descend from the chain's tip, ${tip.name} (${lg.short(tip.commit)}) — merge it back onto ${tip.name} first`);
    }
    return driver.open(ctx, landing, tip);
  }, { committed, warnings });
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
  const number = parsePhase(phase);
  const ctx = contextOf(cwd, unit);
  return withDriver(cwd, (driver) => driver.mergePhase(ctx, number));
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
