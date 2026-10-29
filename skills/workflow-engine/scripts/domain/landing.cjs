'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the `land` verbs (6.1.8, 7.2.8), a task's change landed
// through the project's landing driver (drivers.cjs): `open` the task's pull
// request, `chain` it into its phase's stack, merge a `phase` whole, and
// `finish`, which merges every phase still standing — the review phase's fix
// phases, after every other (7.2.6).
//
// What every driver shares is settled here: the names (landing-names.cjs);
// the default branch everything lands on in each repository, never the
// state branch (4.9.4); and, for a task opened, its type and title, read
// from the tracker as the task verbs read a task (task-verbs.cjs), a task it
// lacks or holds with no type refused (7.2.18, 12.4.1), and its branch,
// named from them, whose change carries nothing under `.leeway/` at the top
// of the project's repository, where the state sits whichever folder of it
// the project is, in any case of its letters (4.1.3, 4.S2). Past the state,
// a project inside a larger repository reads the change from its own folder
// alone (7.2.17): what the change does outside it is the larger
// repository's, never refused, and lands with the task as its branch holds
// it.
//
// A task lands in every repository of the project it touches (7.2.17): the
// project's own and each nested in its folder, a clone or a submodule
// (kernel/repos.cjs), each on its own default branch, under the same names.
// A repository is touched where it holds the task's branch with a commit
// past its chain's tip, which the driver answers there; one holding the
// branch with nothing past its default branch, or its chain's tip, gets
// nothing — a task's worktree makes the branch in every child repository
// (12.7.10), changed or not. `open` reads the chain's tip in every
// repository holding the branch, and holds the branch to descend from it
// there (12.7.1), before it opens anything; the other verbs walk the
// project's own repository and each nested one holding a branch of the
// unit's in question with a commit its default branch lacks. Every verb
// walks them children first, the project's own last, so a submodule's
// landing merges before the repository holding it records its pointer, as
// each driver records it; a merge is told each submodule of its repository
// for that. A driver that lands through a host refuses, before anything
// moves, a repository it walks whose remote it does not serve
// (`assertServes`). A refusal in a nested repository names it, and one
// after a repository moved names what moved where; the verb run again picks
// up where it stopped, a repository done already passed over. A verb
// answers each repository's landing, children first, as `repos`, and a
// warning in a nested repository names it. Every verb, before anything
// else, stops on a rebase stopped in a worktree a remedy made in a
// repository it walks, until it is settled or ended there (landing-git.cjs).
//
// The landing's state is read off git and the host each time. Nothing is
// recorded but the driver setting, which the first verb settles where it is
// absent and commits to the state branch, whatever the driver then does;
// the tracker's setting up, which `open`'s read commits where the state
// branch lacks it, as every read of the tracker does; and what a driver
// keeps in a repository's own refs. A verb answers what it committed and
// was warned of, and a refusal after a commit carries that commit's
// warnings.
// ---------------------------------------------------------------------------

const { resolveDriver, needsRefusal } = require('./drivers.cjs');
const { commitStateTail, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { remoteName, nestedRemoteName } = require('./remote.cjs');
const { assertUnit, parsePhase, parseShownTask, shownTask, taskId } = require('./task-id.cjs');
const { trackedTask, ENDED } = require('./task-verbs.cjs');
const names = require('./landing-names.cjs');
const lg = require('./landing-git.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { projectRepos, projectPath, childrenFirst } = require('../kernel/repos.cjs');
const { STATE_DIR_NAME } = require('../kernel/state-root.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('./drivers.cjs').LandingDriver} LandingDriver */
/** @typedef {import('../kernel/repos.cjs').Repo} Repo */

/**
 * What a landing driver is called with, for one repository of the project:
 * the folder its git runs in — the code root, for the project's own — and
 * the repository as answers name it, `.` for the project's own; the unit;
 * the default branch everything lands on there; the name of its remote,
 * null where it has none chosen; and, for a merge, each submodule directly
 * inside it, by its path from the repository's top, with its own context.
 * @typedef {{root: string, repo: string, unit: string, into: string, remote: string|null, submodules: {path: string, ctx: LandingContext}[]}} LandingContext
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

/**
 * The project a verb lands in: its repositories, its own first, and their
 * contexts, each made once, as the verb first needs it.
 * @typedef {{unit: string, repos: Repo[], contexts: Map<string, LandingContext>}} Project
 */

/**
 * One repository's part of a verb, and what it answered: null where there
 * was nothing to do there.
 * @typedef {{ctx: LandingContext, act: () => Record<string, any>|null}} Step
 * @typedef {Record<string, any> & {repo: string}} Answer
 */

const LAND_USAGE = [
  'land open <work-unit> <phase>.<task>',
  'land chain <work-unit> <phase>.<task>',
  'land phase <work-unit> <phase>',
  'land finish <work-unit>',
].join('\n');

/**
 * `act`, a refusal it throws in a nested repository naming it; the
 * project's own repository's as it stands.
 * @template T @param {string} repo as answers name it @param {() => T} act @returns {T}
 */
function inRepo(repo, act) {
  try {
    return act();
  } catch (err) {
    if (repo !== '.' && err instanceof Error) err.message = `land: in ${lg.plain(repo)}, ${err.message.replace(/^land: /, '')}`;
    throw err;
  }
}

/**
 * A repository's context, once no rebase a remedy began is stopped there.
 * @param {string} unit @param {Repo} repo @param {string|null} remote
 * @returns {LandingContext}
 */
function repoContext(unit, repo, remote) {
  const nested = repo.dir !== '';
  const named = nested ? repo.dir : '.';
  return inRepo(named, () => {
    const stopped = lg.scratchBlock(repo.path);
    if (stopped !== null) throw new Error(`land: ${stopped}`);
    return { root: repo.path, repo: named, unit, into: lg.defaultBranch(repo.path, remote, nested), remote, submodules: [] };
  });
}

/**
 * The project a verb lands in, its own repository's context made first.
 * @param {string} cwd @param {string} unit @returns {Project}
 */
function projectOf(cwd, unit) {
  assertUnit(unit);
  const repos = projectRepos(codeRoot(cwd));
  return { unit, repos, contexts: new Map([['', repoContext(unit, repos[0], remoteName(cwd))]]) };
}

/** A repository's context in the project, made once. @param {Project} project @param {Repo} repo @returns {LandingContext} */
function contextOf(project, repo) {
  const made = project.contexts.get(repo.dir) ?? repoContext(project.unit, repo, nestedRemoteName(repo.path));
  project.contexts.set(repo.dir, made);
  return made;
}

/**
 * A repository's context for a merge: with each of its submodules that is
 * a repository of the project, by its path from the repository's top.
 * @param {Project} project @param {Repo} repo
 * @returns {LandingContext}
 */
function mergingIn(project, repo) {
  const ctx = contextOf(project, repo);
  const subs = repo.submodules.flatMap((folder) => project.repos.filter((sub) => sub.dir === projectPath(repo.dir, folder)).map((sub) => ({ folder, sub })));
  if (subs.length === 0) return ctx;
  const prefix = lg.prefixOf(repo.path);
  return { ...ctx, submodules: subs.map(({ folder, sub }) => ({ path: `${prefix}${folder}`, ctx: contextOf(project, sub) })) };
}

/**
 * Whether a nested repository holds a branch `picks` with a commit its
 * default branch lacks.
 * @param {Project} project @param {Repo} repo @param {(branch: string) => boolean} picks
 */
function holdsWork(project, repo, picks) {
  const named = [...lg.branches(repo.path).keys()].filter(picks);
  if (named.length === 0) return false;
  const ctx = contextOf(project, repo);
  const past = lg.branchesPast(ctx.root, ctx.into);
  return named.some((branch) => past.has(branch));
}

/**
 * The repositories a verb but `open` walks, children first: the project's
 * own, and each nested one holding a branch `picks` with a commit its
 * default branch lacks — each refused before any acts where the driver does
 * not serve its remote.
 * @param {Project} project @param {LandingDriver} driver @param {(branch: string) => boolean} picks
 * @returns {Repo[]}
 */
function walked(project, driver, picks) {
  const repos = childrenFirst(project.repos).filter((repo) => repo.dir === '' || holdsWork(project, repo, picks));
  for (const repo of repos) {
    const ctx = contextOf(project, repo);
    inRepo(ctx.repo, () => driver.assertServes?.(ctx));
  }
  return repos;
}

/**
 * Each step's answer, in turn, with its repository, those with nothing to
 * do left out. A refusal names its repository and, where those before it
 * moved, what moved where — `did` says it of an answer, null where it moved
 * nothing.
 * @param {Step[]} steps @param {(answer: Answer) => string|null} did
 * @returns {Answer[]}
 */
function walk(steps, did) {
  /** @type {Answer[]} */
  const done = [];
  for (const { ctx, act } of steps) {
    try {
      const answer = inRepo(ctx.repo, act);
      if (answer !== null) done.push({ repo: ctx.repo, ...answer });
    } catch (err) {
      throw movedBefore(err, done, did);
    }
  }
  return done;
}

/**
 * A refusal carrying what moved, and where, before it.
 * @param {unknown} err @param {Answer[]} done @param {(answer: Answer) => string|null} did
 */
function movedBefore(err, done, did) {
  /** @type {Map<string, string[]>} */
  const moved = new Map();
  for (const answer of done) {
    const what = did(answer);
    if (what !== null) moved.set(what, [...(moved.get(what) ?? []), lg.plain(answer.repo)]);
  }
  if (moved.size > 0 && err instanceof Error) {
    err.message = `${err.message} (${[...moved].map(([what, repos]) => `${what} in ${repos.join(', ')}`).join('; ')} before it)`;
  }
  return err;
}

/**
 * The repositories' answers, and their warnings beside them, each from a
 * nested repository naming it.
 * @param {Answer[]} answers
 */
function lifted(answers) {
  const warnings = answers.flatMap(({ repo, warnings: said = [] }) => said.map((/** @type {string} */ warning) => (repo === '.' ? warning : `in ${lg.plain(repo)}, ${warning}`)));
  const repos = answers.map(({ warnings: _said, ...answer }) => answer);
  return { repos, ...(warnings.length > 0 ? { warnings } : {}) };
}

/**
 * Run a driver's verb with the project's landing driver, committing the
 * setting where this call settled it, whether or not the driver refused. A
 * verb that fails where a tool the driver needs is not installed, or fails
 * to run, is refused for that (`needsRefusal`). The answer carries the
 * verb's last state commit, null where it failed, and every warning:
 * `before`'s — what the verb committed and was warned of before — the
 * setting's own, and the driver's.
 * @param {string} cwd @param {(driver: LandingDriver) => Record<string, unknown> & {warnings?: string[]}} act
 * @param {{committed?: string|null, warnings?: string[]}} [before]
 */
function withDriver(cwd, act, before = {}) {
  const { driver, written } = resolveDriver(cwd, 'landing');
  const warnings = [...(before.warnings ?? [])];
  let { committed } = before;
  const { warnings: driven = [], ...answer } = carrying(warnings, () => {
    try {
      return act(/** @type {LandingDriver} */ (driver));
    } catch (err) {
      const missing = needsRefusal(driver);
      throw missing === null ? err : new Error(`land: ${missing}`);
    } finally {
      if (written) committed = commitStateTail(cwd, PROJECT_MANIFEST_SPEC, `chore: the landing driver is ${driver.name}`, warnings).committed;
    }
  });
  warnings.push(...driven);
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
 * for it (7.2.18, 12.4.1), and the repositories holding its branch: refused
 * where it has no type, where no repository holds its branch, and where its
 * change carries the state.
 * @param {Project} project @param {TaskRef} ref @param {{type: string|null, title: string, status: string}} task
 * @returns {{task: LandingTask, holding: Repo[]}}
 */
function landingOf(project, ref, { type, title, status }) {
  const shown = shownTask(ref);
  if (type === null) throw new Error(untyped(ref, status));
  const branch = names.taskBranch(ref, type, title);
  const holding = project.repos.filter((repo) => lg.branches(repo.path).has(branch));
  if (holding.length === 0) {
    throw new Error(`land: task ${shown} has no branch ${branch}, the name its type and title in the tracker give it — name its branch so and open it again`);
  }
  const own = /** @type {LandingContext} */ (project.contexts.get(''));
  const state = holding[0].dir === '' ? lg.changedAtTop(own.root, own.into, branch, STATE_DIR_NAME) : [];
  if (state.length > 0) {
    throw new Error(`land: task ${shown}'s change carries ${state.map(lg.plain).join(', ')} — the workflows' state never lands on a code branch, so take it off the task's branch and open the task again`);
  }
  return { task: { ref, branch, message: names.landedMessage(ref, type, title) }, holding };
}

/**
 * The repositories a task's branch touches, children first, each with its
 * chain's tip — read in every repository holding the branch, and the branch
 * held to descend from it there, before anything opens. Refuses a task
 * touching none: opened already wherever it touches, or with nothing past a
 * chain's tip — the project's own named, where it holds the branch.
 * @param {Project} project @param {LandingDriver} driver @param {LandingTask} task @param {Repo[]} holding
 * @returns {{ctx: LandingContext, tip: ChainTip}[]}
 */
function touching(project, driver, task, holding) {
  const shown = shownTask(task.ref);
  /** @type {{ctx: LandingContext, tip: ChainTip}[]} */
  const opening = [];
  let opened = false;
  /** @type {{ctx: LandingContext, past: string}|null} */
  let idle = null;
  for (const repo of childrenFirst(holding)) {
    const ctx = contextOf(project, repo);
    inRepo(ctx.repo, () => {
      if (lg.isAncestor(ctx.root, task.branch, ctx.into)) {
        idle = { ctx, past: ctx.into };
        return;
      }
      driver.assertServes?.(ctx);
      const tip = driver.chainTip(ctx, task);
      if (tip === null) opened = true;
      else if (lg.isAncestor(ctx.root, task.branch, tip.commit)) idle = { ctx, past: tip.name };
      else if (lg.isAncestor(ctx.root, tip.commit, task.branch)) opening.push({ ctx, tip });
      else throw new Error(`land: task ${shown}'s branch ${task.branch} does not descend from the chain's tip, ${tip.name} (${lg.short(tip.commit)}) — merge it back onto ${tip.name} first`);
    });
  }
  if (opening.length > 0) return opening;
  if (opened) throw new Error(`land: task ${shown} is in phase ${task.ref.phase}'s stack already — there is nothing more to open`);
  const { ctx, past } = /** @type {{ctx: LandingContext, past: string}} */ (/** @type {unknown} */ (idle));
  return inRepo(ctx.repo, () => {
    throw new Error(lg.nothingPast(shown, task.branch, past));
  });
}

/**
 * The task's pull request opened in every repository its change touches —
 * locally, its change squashed onto its phase's branch there — under the
 * type and title the tracker holds for it. A task the tracker lacks is
 * refused as the read finds it.
 * @param {string} cwd @param {string} unit @param {string} task shown, `{phase}.{n}`
 */
function landOpen(cwd, unit, task) {
  const ref = parseShownTask(unit, task);
  const shown = shownTask(ref);
  const project = projectOf(cwd, unit);
  const lacking = `land: task ${shown} of ${unit} is not in the tracker — open a task it holds, as \`task list ${unit} ${ref.phase}\` lists them`;
  const { committed, warnings, ...held } = trackedTask(cwd, ref, lacking);
  const { task: landing, holding } = carrying(warnings ?? [], () => landingOf(project, ref, held));
  return withDriver(cwd, (driver) => {
    const steps = touching(project, driver, landing, holding).map(({ ctx, tip }) => ({ ctx, act: () => driver.open(ctx, landing, tip) }));
    return { task: shown, branch: landing.branch, ...lifted(walk(steps, () => `task ${shown} opened`)) };
  }, { committed, warnings });
}

/**
 * The task chained into its phase's stack in every repository it is open
 * in, each answered in the order its tasks were merged back there.
 * @param {string} cwd @param {string} unit @param {string} task shown, `{phase}.{n}`
 */
function landChain(cwd, unit, task) {
  const ref = parseShownTask(unit, task);
  const project = projectOf(cwd, unit);
  const ofTask = (/** @type {string} */ branch) => names.taskOfBranch(unit, branch)?.n === ref.n && names.taskOfBranch(unit, branch)?.phase === ref.phase;
  return withDriver(cwd, (driver) => {
    const steps = walked(project, driver, ofTask).map((repo) => {
      const ctx = contextOf(project, repo);
      return { ctx, act: () => driver.chain(ctx, ref) };
    });
    const answers = walk(steps, () => `phase ${ref.phase} chained`);
    if (answers.length === 0) throw new Error(`land: task ${shownTask(ref)} is not open — open it first`);
    return { phase: ref.phase, ...lifted(answers) };
  });
}

/**
 * The refusal of a phase merged already wherever it lands, as the project's
 * own repository says it — else the last nested one to — with every
 * warning merging it gave.
 * @param {number} phase @param {Answer[]} answers
 */
function mergedAlready(phase, answers) {
  const { warnings = [] } = lifted(answers);
  const { repo, into } = answers[answers.length - 1];
  return inRepo(repo, () => {
    throw new Error(`land: phase ${phase} is merged into ${into} already — there is nothing more to merge${warnings.map((warning) => `; ${warning}`).join('')}`);
  });
}

/**
 * A phase merged whole in every repository it lands in, children first.
 * @param {string} cwd @param {string} unit @param {string} given
 */
function landPhase(cwd, unit, given) {
  const phase = parsePhase(given);
  const project = projectOf(cwd, unit);
  const ofPhase = (/** @type {string} */ branch) => (names.taskOfBranch(unit, branch)?.phase ?? names.phaseOfBranch(unit, branch)) === phase;
  return withDriver(cwd, (driver) => {
    const steps = walked(project, driver, ofPhase).map((repo) => {
      const ctx = mergingIn(project, repo);
      return { ctx, act: () => driver.mergePhase(ctx, phase) };
    });
    const answers = walk(steps, (answer) => (answer.already ? null : `phase ${phase} merged`));
    if (answers.length === 0) throw new Error(`land: phase ${phase} of ${unit} has no task opened — open its tasks first`);
    const merged = answers.filter((answer) => !answer.already);
    if (merged.length === 0) return mergedAlready(phase, answers);
    const { warnings } = lifted(answers);
    return { phase, repos: lifted(merged).repos, ...(warnings === undefined ? {} : { warnings }) };
  });
}

/**
 * Every phase still standing merged, after every other (7.2.6), in every
 * repository of the unit's, children first.
 * @param {string} cwd @param {string} unit
 */
function landFinish(cwd, unit) {
  const project = projectOf(cwd, unit);
  const ofUnit = (/** @type {string} */ branch) => names.taskOfBranch(unit, branch) !== null || names.phaseOfBranch(unit, branch) !== null;
  return withDriver(cwd, (driver) => {
    const steps = walked(project, driver, ofUnit).map((repo) => {
      const ctx = mergingIn(project, repo);
      return { ctx, act: () => driver.finish(ctx) };
    });
    const did = (/** @type {Answer} */ answer) => (answer.phases.length === 0 ? null : `phase ${answer.phases.map((/** @type {{phase: number}} */ merged) => merged.phase).join(', ')} merged`);
    return lifted(walk(steps, did));
  });
}

module.exports = { LAND_USAGE, landOpen, landChain, landPhase, landFinish };
