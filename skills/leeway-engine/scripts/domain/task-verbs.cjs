'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the `task` verbs, the only way anything in the workflows
// touches a tracker (7.1.2), through the project's task driver (drivers.cjs);
// a verb of another kind that needs a task reads it as `task show` does
// (`trackedTask`), as `land open` reads its type and title.
// A unit's phases are written into the tracker as each starts, so it holds
// only those (7.4.1); a task is made from the task template in a file, one
// call per task (7.1.3, 12.5.3), and its id is the engine's (task-id.cjs),
// numbered after the highest its phase holds. An addition goes onto a task
// not yet ended, marked as the orchestrator's or the person's, its text from
// a file (13.11.3); a task not yet ended takes a new type, as the migration
// gives one (21.5.21). A link holds a task after one of its own phase's or
// an earlier phase's, still unfinished, and only a task not yet ended is
// linked (12.6.4); ready answers every task waiting with nothing before it
// (7.1.5); start puts the task in flight on the conversation's position — a
// task already started is put there again — and done and close take it off
// (6.3.3); close ends a task without it being done, with a reason, and
// frees what waits on it as done does (7.1.12). The verbs refuse in the
// engine's words: a tool the driver needs missing or failing, a phase not
// written, a task the tracker lacks or already holds, a task already ended.
//
// Every verb runs under the writer lock (engine.cjs), the tool's own lock
// inside it. Before anything else reaches the driver, the project's setting
// names it — written as the default where absent (drivers.cjs) — the
// state's `.gitignore` takes the files its tool keeps local, refused where
// that file is gone, and its store is made in the state worktree (7.5). A
// verb the driver fails, never one the engine refuses, is refused instead
// for a tool the driver needs that is missing or failing, where one is. A
// verb that writes commits the tracker's store in one state commit, pushed
// (4.1.6, 7.5.1) — held while the migration runs, the answer saying so
// (21.9.3) — with whatever of that setting up the state branch does not
// yet hold; a read commits only that setting up, where there is any: the
// store's files where the branch has none of them, staged or not, and the
// setting and the ignore lines alone. Those two go onto the manifest and
// the ignore file the branch holds as the commit is made, after any landing
// it finishes, so any other change in either — the working file's, or one a
// landing brought — is kept as it stands. Every argument the engine can
// judge is checked before anything is written; where the tracker refuses
// after the verb wrote, what it wrote is committed under a message saying
// the verb was refused, so no later verb carries it under its own.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isolatedGit } = require('../kernel/isolated-git.cjs');
const { isObject, jsonText } = require('../kernel/manifest-io.cjs');
const { workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { resolveDriver, settingOf, needsRefusal } = require('./drivers.cjs');
const { ignoreInState, withIgnored } = require('./state-worktree.cjs');
const { commitStateTail, noteCommitOutcome, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { taskId, shownTask, parseShownTask, parsePhase, taskName, phaseName } = require('./task-id.cjs');
const { TASK_TYPES, breaksLine, readTaskText } = require('./task-file.cjs');
const { recordTask, clearTask } = require('./position.cjs');

/** @typedef {import('./drivers.cjs').TaskDriver} TaskDriver */
/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */
/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */

/** Where a task stands once it has ended, done or not. */
const ENDED = Object.freeze(['done', 'closed']);

/** Whose an addition is. */
const ADDED_BY = Object.freeze(['orchestrator', 'person']);

/** A refusal the engine makes from what the tracker answers, the driver's tools plainly running. */
class TaskRefusal extends Error {}

/** Refuses a unit the project does not have. @param {string} cwd @param {string} unit */
function requireUnit(cwd, unit) {
  const refusal = workUnitNameRefusal(unit);
  if (refusal !== null) throw new Error(refusal);
  if (!fs.existsSync(statePath(cwd, unit, 'manifest.json'))) throw new Error(`Work unit "${unit}" not found`);
}

/** @param {string} unit @param {number} phase */
function unwritten(unit, phase) {
  return new TaskRefusal(`${phaseName(unit, phase)} is not written`);
}

/**
 * The task as the tracker holds it, refused where it holds none — in the
 * words `lacking` gives, where given.
 * @param {TaskDriver} driver @param {string} root @param {TaskRef} ref @param {string} [lacking]
 * @returns {TaskDetail}
 */
function taskIn(driver, root, ref, lacking = `${taskName(ref)} is not in the tracker`) {
  const shown = driver.show(root, ref);
  if (shown === null) throw new TaskRefusal(lacking);
  return shown;
}

/**
 * Where a task stands, refused where it has ended, saying what only an
 * unended one takes.
 * @param {TaskDriver} driver @param {string} root @param {TaskRef} ref @param {string} rule
 */
function refuseEnded(driver, root, ref, rule) {
  const { status } = taskIn(driver, root, ref);
  if (ENDED.includes(status)) throw new TaskRefusal(`task ${shownTask(ref)} is ${status} — ${rule}`);
  return status;
}

/** A task's text from its file, refused where the file holds nothing. @param {string} cwd @param {string} file */
function textOf(cwd, file) {
  const text = fs.readFileSync(path.resolve(cwd, file), 'utf8').trim();
  if (text === '') throw new Error(`${file} holds nothing to add`);
  return text;
}

/** A task as the verbs answer it. @param {TaskRef} ref */
function named(ref) {
  return { task: shownTask(ref), id: taskId(ref) };
}

/** What the store files hold, to tell whether a verb wrote them. @param {string} root @param {string[]} files */
function storeHeld(root, files) {
  return JSON.stringify(files.map((file) => (fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : null)));
}

/**
 * A project manifest's text with the driver's setting and nothing else
 * changed, or null where it holds the setting already.
 * @param {string|null} held the text, null where there is none
 * @param {TaskDriver} driver
 * @returns {string|null}
 */
function withSetting(held, driver) {
  const project = held === null ? {} : JSON.parse(held);
  if (settingOf(project, 'task') === driver.name) return null;
  return jsonText({ ...project, drivers: { ...(isObject(project.drivers) ? project.drivers : {}), task: driver.name } });
}

/** @typedef {import('./state-worktree.cjs').Change} Change */

/**
 * @typedef {{files: string[], contents: Record<string, Change>}} Setup the
 * store files to commit as the working tree holds them, and the changes to
 * make to the files the branch holds
 */

/**
 * What of setting the tracker up the state branch may not yet hold: the
 * store's files where the branch has none of them, and, where the working
 * file differs from the branch's, the project manifest's setting and the
 * `.gitignore`'s lines — each a change the commit makes to the branch's own
 * file, so nothing else of either is committed. Read from the files that
 * differ from the branch, so a state with none costs one look.
 * @param {string} root @param {TaskDriver} driver
 * @returns {Setup}
 */
function setupUncommitted(root, driver) {
  const listed = isolatedGit(root).tryRun([
    'status', '--porcelain', '-z', '--untracked-files=all', '--no-renames', '--', PROJECT_MANIFEST_SPEC, '.gitignore', ...driver.storeFiles(),
  ]) ?? '';
  const changed = new Map(listed.split('\0').filter((entry) => entry !== '').map((entry) => [entry.slice(3), entry[0]]));
  /** @type {Record<string, Change>} */
  const changes = {
    [PROJECT_MANIFEST_SPEC]: (held) => withSetting(held, driver),
    '.gitignore': (held) => withIgnored(held ?? '', driver.localFiles()),
  };
  return {
    files: driver.storeFiles().filter((file) => ['?', 'A'].includes(changed.get(file) ?? '')),
    contents: Object.fromEntries(Object.entries(changes).filter(([file]) => changed.has(file))),
  };
}

/** Whether there is anything of setting up to commit. @param {Setup} setUp */
const anySetup = (setUp) => setUp.files.length > 0 || Object.keys(setUp.contents).length > 0;

/**
 * The state's ignore file given the tool's local files, a refusal of it the
 * engine's own, never one for the driver's tools.
 * @param {string} root @param {TaskDriver} driver
 */
function ignoreLocalFiles(root, driver) {
  try {
    ignoreInState(root, driver.localFiles());
  } catch (err) {
    throw new TaskRefusal(err instanceof Error ? err.message : String(err));
  }
}

/**
 * The state commit of what a verb wrote, with the setting up the branch
 * lacks; a commit that fails is a warning, and one held while the migration
 * runs is noted so.
 * @param {string} cwd @param {string[]} paths @param {string} message @param {Setup} setUp
 * @returns {{committed: string|null, note?: string, warnings?: string[]}}
 */
function commitTracker(cwd, paths, message, setUp) {
  /** @type {string[]} */
  const warnings = [];
  const outcome = commitStateTail(cwd, [...new Set([...setUp.files, ...paths])], message, warnings, { contents: setUp.contents });
  /** @type {{committed: string|null, note?: string, warnings?: string[]}} */
  const out = { committed: outcome.committed };
  if (outcome.held) noteCommitOutcome(out, outcome);
  return warnings.length > 0 ? { ...out, warnings } : out;
}

/**
 * A read's commit of what of setting up the branch lacks, answering nothing
 * where there was nothing to commit, as a read with none of it does.
 * @param {string} cwd @param {string} unit @param {Setup} setUp
 * @returns {{committed?: string|null, warnings?: string[]}}
 */
function commitSetup(cwd, unit, setUp) {
  if (!anySetup(setUp)) return {};
  const out = commitTracker(cwd, [], `task(${unit}): set up the tracker`, setUp);
  return out.committed === null && out.warnings === undefined ? {} : out;
}

/**
 * `act` against the project's task driver in the state root, the driver
 * set up first; then the state commit (the header's), `verb` naming it —
 * `describe` where the answer names it better — or null for a read. A
 * refusal, the driver's missing tools named in it where any is, commits
 * what of setting up the branch does not yet hold — the store made, the
 * setting, the ignore lines, and nothing else of the manifest or the ignore
 * file — under "set up the tracker", or, where the verb wrote before it was
 * refused, that and the store under `verb` refused; the commit's warnings
 * are carried in the refusal. A refusal with nothing of either commits
 * nothing.
 * @template {object} T
 * @param {string} cwd @param {string} unit @param {string|null} verb
 * @param {(driver: TaskDriver, root: string) => T} act
 * @param {(answer: T) => string} [describe]
 * @returns {T & {committed?: string|null, warnings?: string[]}}
 */
function withTracker(cwd, unit, verb, act, describe = () => /** @type {string} */ (verb)) {
  const root = stateRoot(cwd);
  const driver = /** @type {TaskDriver} */ (resolveDriver(cwd, 'task').driver);
  /** @type {string|null} */
  let held = null;
  /** @type {T} */
  let answer;
  try {
    ignoreLocalFiles(root, driver);
    driver.ensureStore(root);
    held = storeHeld(root, driver.storeFiles());
    answer = act(driver, root);
  } catch (thrown) {
    const missing = thrown instanceof TaskRefusal ? null : needsRefusal(driver);
    const err = missing === null ? thrown : new Error(missing);
    const wrote = held !== null && storeHeld(root, driver.storeFiles()) !== held;
    const setUp = setupUncommitted(root, driver);
    if (wrote || anySetup(setUp)) {
      const { warnings } = commitTracker(cwd, wrote ? driver.storeFiles() : [], `task(${unit}): ${wrote ? `${verb} refused — what it wrote kept` : 'set up the tracker'}`, setUp);
      if (warnings !== undefined && err instanceof Error) err.message = `${err.message} — and ${warnings.join('; ')}`;
    }
    throw err;
  }
  const setUp = setupUncommitted(root, driver);
  if (verb !== null) return Object.assign({}, answer, commitTracker(cwd, driver.storeFiles(), `task(${unit}): ${describe(answer)}`, setUp));
  return Object.assign({}, answer, commitSetup(cwd, unit, setUp));
}

/** `task phase`: the phase written, the unit's parent made on first use. @param {string} cwd @param {string} unit @param {string} given @param {string} title */
function writePhase(cwd, unit, given, title) {
  const phase = parsePhase(given);
  if (breaksLine(title)) throw new Error('the phase\'s title breaks its line — a title is one line');
  requireUnit(cwd, unit);
  return withTracker(cwd, unit, `write phase ${phase}`, (driver, root) => {
    if (driver.list(root, unit, phase) !== null) throw new TaskRefusal(`${phaseName(unit, phase)} is already written`);
    driver.createUnit(root, unit);
    driver.createPhase(root, unit, phase, title);
    return { phase };
  });
}

/** `task create`: a task of the phase from a task file, numbered after its highest. @param {string} cwd @param {string} unit @param {string} given @param {string} file */
function createTask(cwd, unit, given, file) {
  const phase = parsePhase(given);
  requireUnit(cwd, unit);
  const task = readTaskText(fs.readFileSync(path.resolve(cwd, file), 'utf8'));
  return withTracker(cwd, unit, `create in phase ${phase}`, (driver, root) => {
    const rows = driver.list(root, unit, phase);
    if (rows === null) throw unwritten(unit, phase);
    const ref = { unit, phase, n: Math.max(0, ...rows.map((row) => row.ref.n)) + 1 };
    if (driver.show(root, ref) !== null) throw new TaskRefusal(`the tracker already holds ${taskName(ref)}`);
    driver.createTask(root, ref, task);
    return named(ref);
  }, ({ task: shown }) => `create ${shown}`);
}

/** `task link`: the task held after another, unfinished, of its phase or an earlier one. @param {string} cwd @param {string} unit @param {string} given @param {string} afterGiven */
function linkTask(cwd, unit, given, afterGiven) {
  const task = parseShownTask(unit, given);
  const after = parseShownTask(unit, afterGiven);
  if (after.phase > task.phase) {
    throw new Error(`task ${shownTask(after)} is in a later phase than ${shownTask(task)} — a task is linked after one of its own phase's or an earlier phase's`);
  }
  requireUnit(cwd, unit);
  return withTracker(cwd, unit, `link ${shownTask(task)} after ${shownTask(after)}`, (driver, root) => {
    refuseEnded(driver, root, task, 'only a task not yet ended is linked after another');
    refuseEnded(driver, root, after, 'a task is linked after an unfinished one');
    driver.link(root, task, after);
    return { task: shownTask(task), after: shownTask(after) };
  });
}

/**
 * `task add`: an addition onto a task not yet ended, its text from a file.
 * @param {string} cwd @param {string} unit @param {string} given @param {string} file @param {string} by
 */
function addToTask(cwd, unit, given, file, by) {
  const ref = parseShownTask(unit, given);
  if (!ADDED_BY.includes(by)) throw new Error(`an addition is the ${ADDED_BY.join(' or the ')}'s — got "${by}"`);
  requireUnit(cwd, unit);
  const text = textOf(cwd, file);
  return withTracker(cwd, unit, `add to ${shownTask(ref)}`, (driver, root) => {
    refuseEnded(driver, root, ref, 'only a task not yet ended is added to');
    driver.add(root, ref, { by: /** @type {'orchestrator'|'person'} */ (by), text });
    return named(ref);
  });
}

/**
 * `task type`: a task not yet ended given a type the template allows.
 * @param {string} cwd @param {string} unit @param {string} given @param {string} type
 */
function typeTask(cwd, unit, given, type) {
  const ref = parseShownTask(unit, given);
  if (!TASK_TYPES.includes(type)) throw new Error(`the type "${type}" is not one of ${TASK_TYPES.join(', ')}`);
  requireUnit(cwd, unit);
  return withTracker(cwd, unit, `type ${shownTask(ref)} as ${type}`, (driver, root) => {
    refuseEnded(driver, root, ref, 'only a task not yet ended is typed');
    driver.setType(root, ref, type);
    return { ...named(ref), type };
  });
}

/** `task ready`: every task waiting to start, of the phase or of the unit. @param {string} cwd @param {string} unit @param {string} [given] */
function readyTasks(cwd, unit, given) {
  const phase = given === undefined ? null : parsePhase(given);
  requireUnit(cwd, unit);
  return withTracker(cwd, unit, null, (driver, root) => {
    const rows = driver.ready(root, unit, phase);
    if (rows === null) throw unwritten(unit, /** @type {number} */ (phase));
    return { tasks: rows.map((row) => ({ ...named(row.ref), title: row.title })) };
  });
}

/** `task list`: the phase's tasks, in order. @param {string} cwd @param {string} unit @param {string} given */
function listTasks(cwd, unit, given) {
  const phase = parsePhase(given);
  requireUnit(cwd, unit);
  return withTracker(cwd, unit, null, (driver, root) => {
    const rows = driver.list(root, unit, phase);
    if (rows === null) throw unwritten(unit, phase);
    return { phase, tasks: rows.map((row) => ({ ...named(row.ref), title: row.title, status: row.status })) };
  });
}

/**
 * A task as the tracker holds it, read as any read is — for `task show`,
 * and for a verb of another kind that reads a task — refused where the
 * unit or the task is missing, the latter in the words `lacking` gives,
 * where given.
 * @param {string} cwd @param {TaskRef} ref @param {string} [lacking]
 * @returns {TaskDetail & {committed?: string|null, warnings?: string[]}}
 */
function trackedTask(cwd, ref, lacking) {
  requireUnit(cwd, ref.unit);
  return withTracker(cwd, ref.unit, null, (driver, root) => taskIn(driver, root, ref, lacking));
}

/** `task show`: the task whole, what was added to it among it. @param {string} cwd @param {string} unit @param {string} given */
function showTask(cwd, unit, given) {
  const ref = parseShownTask(unit, given);
  const { ref: _ref, after, ...shown } = trackedTask(cwd, ref);
  return { ...named(ref), ...shown, after: after.map(shownTask) };
}

/**
 * A verb that moves one task on, then the position with it.
 * @param {string} verb
 * @param {(driver: TaskDriver, root: string, ref: TaskRef, ...more: string[]) => void} move
 * @param {(cwd: string, ref: TaskRef) => void} settle
 * @returns {(cwd: string, unit: string, given: string, ...more: string[]) => object}
 */
function moving(verb, move, settle) {
  return (cwd, unit, given, ...more) => {
    const ref = parseShownTask(unit, given);
    requireUnit(cwd, unit);
    const answer = withTracker(cwd, unit, `${verb} ${shownTask(ref)}`, (driver, root) => {
      move(driver, root, ref, ...more);
      return named(ref);
    });
    settle(cwd, ref);
    return answer;
  };
}

/** Takes the task off the position, where it is the one in flight. @param {string} cwd @param {TaskRef} ref */
function offPosition(cwd, ref) {
  clearTask(ref.unit, ref.unit, taskId(ref));
}

/** `task start`: in progress — where it is not already — and in flight on the position. */
const startTask = moving('start', (driver, root, ref) => {
  if (refuseEnded(driver, root, ref, 'only a task not yet ended is started') !== 'in-progress') driver.start(root, ref);
}, (cwd, ref) => recordTask(cwd, ref.unit, ref.unit, taskId(ref)));

/** `task done`: done, and off the position. */
const doneTask = moving('done', (driver, root, ref) => {
  refuseEnded(driver, root, ref, 'only a task not yet ended is done');
  driver.done(root, ref);
}, offPosition);

/** `task close`: closed without being done, its reason kept, and off the position. */
const closeTask = moving('close', (driver, root, ref, reason) => {
  refuseEnded(driver, root, ref, 'only a task not yet ended is closed');
  driver.close(root, ref, reason);
}, offPosition);

/**
 * Each verb: its arguments after `task {verb}`, how many positionals it
 * takes and how many of them may be left out, the flags it needs, and what
 * it runs, given the flags' values in their order.
 * @type {Readonly<Record<string, {usage: string, arity: number, optional?: number, flags?: string[], run: (cwd: string, positional: string[], ...values: string[]) => object}>>}
 */
const TASK_VERBS = Object.freeze({
  phase: { usage: '<unit> <N> --title <title>', arity: 2, flags: ['title'], run: (cwd, [unit, phase], title) => writePhase(cwd, unit, phase, title) },
  create: { usage: '<unit> <N> --file <path>', arity: 2, flags: ['file'], run: (cwd, [unit, phase], file) => createTask(cwd, unit, phase, file) },
  add: { usage: '<unit> <task> --file <path> --by <orchestrator|person>', arity: 2, flags: ['file', 'by'], run: (cwd, [unit, task], file, by) => addToTask(cwd, unit, task, file, by) },
  type: { usage: '<unit> <task> <type>', arity: 3, run: (cwd, [unit, task, type]) => typeTask(cwd, unit, task, type) },
  link: { usage: '<unit> <task> --after <task>', arity: 2, flags: ['after'], run: (cwd, [unit, task], after) => linkTask(cwd, unit, task, after) },
  ready: { usage: '<unit> [<N>]', arity: 1, optional: 1, run: (cwd, [unit, phase]) => readyTasks(cwd, unit, phase) },
  start: { usage: '<unit> <task>', arity: 2, run: (cwd, [unit, task]) => startTask(cwd, unit, task) },
  done: { usage: '<unit> <task>', arity: 2, run: (cwd, [unit, task]) => doneTask(cwd, unit, task) },
  close: { usage: '<unit> <task> --reason <reason>', arity: 2, flags: ['reason'], run: (cwd, [unit, task], reason) => closeTask(cwd, unit, task, reason) },
  list: { usage: '<unit> <N>', arity: 2, run: (cwd, [unit, phase]) => listTasks(cwd, unit, phase) },
  show: { usage: '<unit> <task>', arity: 2, run: (cwd, [unit, task]) => showTask(cwd, unit, task) },
});

/**
 * One `task` verb's answer, its arguments held to its usage first.
 * @param {string} cwd @param {string} verb one of TASK_VERBS
 * @param {string[]} positional @param {Record<string, string>} opts
 * @returns {object}
 */
function runTaskVerb(cwd, verb, positional, opts) {
  const { usage, arity, optional = 0, flags = [], run } = TASK_VERBS[verb];
  const values = flags.map((flag) => opts[flag] ?? '');
  if (positional.length < arity || positional.length > arity + optional || values.some((value) => value.trim() === '')) {
    throw new Error(`Usage: engine task ${verb} ${usage}`);
  }
  return run(cwd, positional, ...values);
}

module.exports = { TASK_VERBS, ENDED, runTaskVerb, trackedTask };
