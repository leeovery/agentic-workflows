'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the `task` verbs, the only way anything in the workflows
// touches a tracker (7.1.2), through the project's task driver (drivers.cjs);
// a verb of another kind that needs a task reads it as `task show` does
// (`trackedTask`), as `land open` reads its type and title, and one that
// needs a unit's phases reads each one's list, and its own phase's tasks
// whole (`trackedPhases`); the build's standing reads the lists of the
// phases it names (`trackedLists`), a phase's checklist that phase's tasks
// whole (`trackedPhase`), and the tasks the build goes on with: those in
// progress in every phase written, and those ready in a phase the caller
// lets go on (`goingOn`) — in step, the one in flight first and any other
// going on held behind it, its briefs and gate refused until that one is
// done (`stepTurn`, `turnRefusal`); and the board reads the whole unit from
// a copy of the tracker's store, taking no lock and setting nothing up, so
// it never waits on a writer (`trackedUnit`, `withStoreCopy`).
// A unit's phases are written into the tracker as each starts, so it holds
// only those (7.4.1); a task is made from the task template in a file, one
// call per task (7.1.3, 12.5.3) — a quick-fix's referencing no spec, since
// it has none (19.5.5) — and its id is the engine's (task-id.cjs),
// numbered after the highest its phase holds. An addition goes onto a task
// not yet ended, marked as the orchestrator's or the person's, its text from
// a file (13.11.3), the task marked changed after the last round reported
// of its review, which its pair reads again (round-report.cjs); a task not
// yet ended takes a new type, as the migration gives one (21.5.21). A link
// holds a task after one of its own phase's or an earlier phase's, still
// unfinished, and only a task not yet ended is linked (12.6.4); ready
// answers every task waiting with nothing before it and no question parking
// it (7.1.5, 13.4.6), and, in step, the task in progress whose turn has come
// where an answer freed it — its builder sent back in, never a new one —
// until its builder's brief is next issued, and never while its pair reads
// a round of it (`stepTurn`, round-report.cjs, 12.7.9); start, refused for
// a phase the cut holds before its start checklist has closed (6.4.8,
// 12.S7) — a quick-fix's fixes, held by no cut, have none — and in step for
// any task but the one in flight or at its gate —
// in progress
// in any phase written, the review's fixes past the cut among them, here or
// in another conversation, no question parking it, and ahead of any other
// going on (12.7.9) — puts the task in flight on the conversation's
// position, beside any others in flight there — a task already in flight
// kept as it stands, its builder and reviewers with it — and done and close
// take it off, each first taking the task's worktree apart (6.3.3,
// 24.2.4); done refuses a task a question waiting parks, and a bugfix's
// reproducing task until its test's series proves the bug (bug-proven.cjs,
// 15.5.3); close ends a task without it being done, with a reason — a
// bugfix's reproducing task never (15.5.5) — takes it off every question
// parking it (task-parks.cjs), and frees what waits on it as done does
// (7.1.12); worktree lays the task's worktree out for its builder, reading
// the task as show does (task-worktree.cjs); stopped records, against the
// task in flight in the calling conversation, that its builder stopped,
// unable to build past a problem (13.11.9, position.cjs). The verbs
// refuse in the engine's words: a tool the driver needs missing or
// failing, a phase not written, a task the tracker lacks or already holds,
// a task already ended. Beside them, three take the build's records, each
// its own module's: account, a task's account and its rounds' reports, and
// settle, the orchestrator's settlement of a failed round
// (task-account.cjs) or, with `--phase`, of a phase review that failed
// (phase-settlement.cjs); and note, a note for later (notes.cjs).
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
const os = require('os');
const path = require('path');
const { isolatedGit } = require('../kernel/isolated-git.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { isObject, jsonText } = require('../kernel/manifest-io.cjs');
const { loadWorkUnitManifest } = require('../kernel/manifest.cjs');
const { workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { resolveDriver, settingOf, needsRefusal } = require('./drivers.cjs');
const { ignoreInState, withIgnored } = require('./state-worktree.cjs');
const { commitStateTail, noteCommitOutcome, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { taskId, shownTask, parseShownTask, parsePhase, taskName, phaseName } = require('./task-id.cjs');
const { TASK_TYPES, NO_SPEC, breaksLine, readTaskText, specReferenceOf } = require('./task-file.cjs');
const { recordTask, clearTask, recordStop } = require('./position.cjs');
const { phaseStarted, cutLength, quickFixBuild } = require('./derivations.cjs');
const { reproducingHold, reproducingClose } = require('./bug-proven.cjs');
const { layOutTask, takeWorktreeApart } = require('./task-worktree.cjs');
const { markChanged, briefedOf, beingRead } = require('./round-report.cjs');

// The questions parking a task, and the landing naming a phase's mutation
// run, loaded at their call: each reads the task through this module.
const parks = () => require('./task-parks.cjs');
const landing = () => require('./landing.cjs');

/** @typedef {import('./drivers.cjs').TaskDriver} TaskDriver */
/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */
/** @typedef {import('./drivers.cjs').TaskRow} TaskRow */
/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */

/** In step, the task in flight, and those going on behind it. @typedef {{inFlight: string, behind: string[]}} StepTurn */

/** Where a task stands once it has ended, done or not. */
const ENDED = Object.freeze(['done', 'closed']);

/** Where a task stands, as a line says it. @type {Readonly<Record<import('./build-entry.cjs').TaskState, string>>} */
const STATUS_WORDS = Object.freeze({
  open: 'not started', 'in-progress': 'in progress', behind: 'behind the task in flight', 'at-gate': 'at its gate', done: 'done', closed: 'closed',
});

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
 * The task as the tracker holds it, refused where it has ended, saying what
 * only an unended one takes.
 * @param {TaskDriver} driver @param {string} root @param {TaskRef} ref @param {string} rule
 * @returns {TaskDetail}
 */
function refuseEnded(driver, root, ref, rule) {
  const task = taskIn(driver, root, ref);
  if (ENDED.includes(task.status)) throw new TaskRefusal(`task ${shownTask(ref)} is ${task.status} — ${rule}`);
  return task;
}

/**
 * The text of a file a verb is given, by its path from `cwd`, trimmed;
 * refused where there is no such file or it holds nothing.
 * @param {string} cwd @param {string} file @param {string} purpose what it would hold nothing to do
 */
function givenText(cwd, file, purpose) {
  const at = path.resolve(cwd, file);
  if (!fs.statSync(at, { throwIfNoEntry: false })?.isFile()) throw new Error(`there is no file ${file}`);
  const text = fs.readFileSync(at, 'utf8').trim();
  if (text === '') throw new Error(`${file} holds nothing to ${purpose}`);
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
 * @returns {T & {committed?: string|null, note?: string, warnings?: string[]}}
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

/**
 * A task file's task, refused where the template does not hold it, or where
 * the unit is a quick-fix and the task references a spec, which it has none
 * of (19.5.5).
 * @param {string} cwd @param {string} unit @param {string} file
 */
function fileTask(cwd, unit, file) {
  const task = readTaskText(fs.readFileSync(path.resolve(cwd, file), 'utf8'));
  const reference = specReferenceOf(task.text);
  if (quickFixBuild(loadWorkUnitManifest(cwd, unit)) && reference !== NO_SPEC) {
    throw new Error(`${unit} is a quick-fix, which has no spec — its task's Spec reference is ${NO_SPEC}, not "${reference}"`);
  }
  return task;
}

/** `task create`: a task of the phase from a task file, numbered after its highest. @param {string} cwd @param {string} unit @param {string} given @param {string} file */
function createTask(cwd, unit, given, file) {
  const phase = parsePhase(given);
  requireUnit(cwd, unit);
  const task = fileTask(cwd, unit, file);
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
  const text = givenText(cwd, file, 'add');
  return withTracker(cwd, unit, `add to ${shownTask(ref)}`, (driver, root) => {
    refuseEnded(driver, root, ref, 'only a task not yet ended is added to');
    driver.add(root, ref, { by: /** @type {'orchestrator'|'person'} */ (by), text });
    markChanged(cwd, ref);
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

/**
 * `task ready`: every task waiting to start, of the phase or of the unit,
 * but those a question waiting parks; and, in step, `back`, the task in
 * progress an answer freed whose turn has come (`stepTurn`).
 * @param {string} cwd @param {string} unit @param {string} [given]
 */
function readyTasks(cwd, unit, given) {
  const phase = given === undefined ? null : parsePhase(given);
  requireUnit(cwd, unit);
  const ready = withTracker(cwd, unit, null, (driver, root) => {
    const rows = driver.ready(root, unit, phase);
    if (rows === null) throw unwritten(unit, /** @type {number} */ (phase));
    const parked = parks().parkedOf(cwd, unit);
    return { tasks: rows.filter((row) => !parked.has(shownTask(row.ref))).map((row) => ({ ...named(row.ref), title: row.title })) };
  });
  const back = freedTurn(cwd, unit);
  return back === null ? ready : { ...ready, back };
}

/**
 * In step, the task in progress whose turn has come where an answer freed
 * it, its builder waiting to go back in: freed since a brief to its builder
 * was last issued, its builder's or a fix round's, its pair reading no
 * round of it in this conversation; null in auto, and where none is.
 * @param {string} cwd @param {string} unit @returns {string|null}
 */
function freedTurn(cwd, unit) {
  const turn = stepTurn(cwd, unit, loadWorkUnitManifest(cwd, unit));
  if (turn === null) return null;
  const ref = parseShownTask(unit, turn.inFlight);
  const freed = parks().freedAt(cwd, unit).get(turn.inFlight);
  return freed !== undefined && freed > briefedOf(cwd, ref).builder && beingRead(cwd, ref, handedSession()) === null ? turn.inFlight : null;
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

/** Whether the tracker holds a phase of the unit written, read as any read is. @param {string} cwd @param {string} unit @param {number} phase */
function phaseWritten(cwd, unit, phase) {
  requireUnit(cwd, unit);
  return withTracker(cwd, unit, null, (driver, root) => ({ written: driver.list(root, unit, phase) !== null })).written;
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

/**
 * When a task first moved into progress, as the tracker holds it, read as
 * any read is; null where it never has.
 * @param {string} cwd @param {TaskRef} ref @returns {string|null}
 */
function trackedStart(cwd, ref) {
  requireUnit(cwd, ref.unit);
  return withTracker(cwd, ref.unit, null, (driver, root) => ({ started: driver.started(root, ref) })).started;
}

/**
 * Each of the unit's phases from 1 to `last` as the tracker holds it, read
 * as any read is: a phase written as the list of its tasks, in order, null
 * for one not written; and phase `last`'s tasks whole, null where it is not
 * written.
 * @param {string} cwd @param {string} unit @param {number} last
 * @returns {{phases: (TaskRow[]|null)[], written: TaskDetail[]|null, committed?: string|null, warnings?: string[]}}
 */
function trackedPhases(cwd, unit, last) {
  requireUnit(cwd, unit);
  return withTracker(cwd, unit, null, (driver, root) => {
    const phases = Array.from({ length: last }, (_, at) => driver.list(root, unit, at + 1));
    return { phases, written: driver.tasks(root, unit, last) };
  });
}

/**
 * The unit's phases `numbers` names as the tracker holds them, read as any
 * read is: each written as the list of its tasks, in order, null for one
 * not written.
 * @param {string} cwd @param {string} unit @param {number[]} numbers
 * @returns {{phases: (TaskRow[]|null)[], committed?: string|null, warnings?: string[]}}
 */
function trackedLists(cwd, unit, numbers) {
  requireUnit(cwd, unit);
  return withTracker(cwd, unit, null, (driver, root) => ({ phases: numbers.map((phase) => driver.list(root, unit, phase)) }));
}

/**
 * A phase's tasks whole, in order, as the tracker holds them, read as any
 * read is; null where the phase is not written.
 * @param {string} cwd @param {string} unit @param {number} phase
 * @returns {{tasks: TaskDetail[]|null, committed?: string|null, warnings?: string[]}}
 */
function trackedPhase(cwd, unit, phase) {
  requireUnit(cwd, unit);
  return withTracker(cwd, unit, null, (driver, root) => ({ tasks: driver.tasks(root, unit, phase) }));
}

/**
 * The unit's tasks its build goes on with, but each a question waiting
 * parks, in one read of the tracker: those in progress in every phase it
 * has written — the cut's, and the review's fixes numbered on past it
 * (P14) — any conversation's in flight among them, and, where `ready` is
 * given, those waiting to start with nothing before them whose phase it
 * lets go on (`goesOn`).
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest the unit's
 * @param {{ready?: (phase: number) => boolean}} [opts]
 * @returns {{tasks: string[], committed?: string|null, warnings?: string[]}}
 */
function goingOn(cwd, unit, manifest, { ready } = {}) {
  requireUnit(cwd, unit);
  const { phases, waiting, ...read } = withTracker(cwd, unit, null, (driver, root) => ({
    phases: writtenPhases(driver, root, unit, cutLength(manifest)),
    waiting: ready === undefined ? [] : driver.ready(root, unit, null) ?? [],
  }));
  return { ...read, tasks: goesOn(parks().parkedOf(cwd, unit), { phases, ready: waiting }, ready ?? (() => false)) };
}

/**
 * Each phase the unit has written, from 1 on — the cut's, a phase of it not
 * written null, and the review's fixes numbered on past it (P14).
 * @param {TaskDriver} driver @param {string} root @param {string} unit @param {number} cut @returns {(TaskRow[]|null)[]}
 */
function writtenPhases(driver, root, unit, cut) {
  /** @type {(TaskRow[]|null)[]} */
  const phases = [];
  for (let phase = 1; ; phase += 1) {
    const list = driver.list(root, unit, phase);
    if (list === null && phase > cut) return phases;
    phases.push(list);
  }
}

/**
 * The tasks the unit's build goes on with, from what the tracker gave, but
 * each `parked` holds — those a question waiting parks: those in progress
 * in the phases read, then those ready to start whose phase `lets` go on,
 * asked once a phase.
 * @param {{has: (task: string) => boolean}} parked @param {{phases: (TaskRow[]|null)[], ready: TaskRow[]}} read
 * @param {(phase: number) => boolean} lets
 * @returns {string[]}
 */
function goesOn(parked, { phases, ready }, lets) {
  /** @type {Map<number, boolean>} */
  const asked = new Map();
  const goes = (/** @type {number} */ phase) => asked.get(phase) ?? asked.set(phase, lets(phase)).get(phase);
  const running = phases.flatMap((list) => (list ?? []).filter(({ status }) => status === 'in-progress'));
  return [...running, ...ready.filter(({ ref }) => goes(ref.phase))].map(({ ref }) => shownTask(ref)).filter((task) => !parked.has(task));
}

/**
 * What a read of the whole unit takes from the tracker, in one read: each
 * phase it has written, as `writtenPhases` gives them; each phase's tasks
 * whole where it holds one not yet ended, else null; the tasks ready to
 * start; when each task in progress first moved into it, by task; and,
 * where `task` names one, that task whole — null where the tracker lacks
 * it — and when it first moved into progress.
 * @typedef {{
 *   phases: (TaskRow[]|null)[], written: (TaskDetail[]|null)[], ready: TaskRow[], starts: Record<string, string|null>,
 *   task: TaskDetail|null, started: string|null,
 * }} TrackedUnit
 */

/**
 * `read` against a copy of the tracker's store, each of its files read
 * whole once — a store kept in one file, read as it stood at one moment:
 * no writer lock taken, nothing set up or written into the state, the copy
 * removed after.
 * @template T @param {string} cwd @param {(driver: TaskDriver, root: string) => T} read @returns {T}
 */
function withStoreCopy(cwd, read) {
  const driver = /** @type {TaskDriver} */ (resolveDriver(cwd, 'task').driver);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'leeway-store-'));
  try {
    for (const file of driver.storeFiles()) {
      const text = fs.readFileSync(statePath(cwd, file));
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), text);
    }
    return read(driver, root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

/**
 * The unit as the tracker holds it (the typedef's), read from a copy of
 * its store (`withStoreCopy`), for a reader that must never wait on a
 * writer.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest the unit's @param {TaskRef|null} [task]
 * @returns {TrackedUnit}
 */
function trackedUnit(cwd, unit, manifest, task = null) {
  requireUnit(cwd, unit);
  return withStoreCopy(cwd, (driver, root) => {
    const phases = writtenPhases(driver, root, unit, cutLength(manifest));
    const running = phases.flatMap((rows) => (rows ?? []).filter(({ status }) => status === 'in-progress'));
    return {
      phases,
      written: phases.map((rows, i) => (rows?.some(({ status }) => status === 'open' || status === 'in-progress') ? driver.tasks(root, unit, i + 1) : null)),
      ready: driver.ready(root, unit, null) ?? [],
      starts: Object.fromEntries(running.map(({ ref }) => [shownTask(ref), driver.started(root, ref)])),
      task: task === null ? null : driver.show(root, task),
      started: task === null ? null : driver.started(root, task),
    };
  });
}

/**
 * Each of a unit's phases' tasks whole, read from a copy of its store
 * (`withStoreCopy`), for a reader that must never wait on a writer.
 * @param {string} cwd @param {string} unit @param {number[]} phases @returns {TaskDetail[][]}
 */
function copiedTasks(cwd, unit, phases) {
  return withStoreCopy(cwd, (driver, root) => phases.map((phase) => driver.tasks(root, unit, phase) ?? []));
}

/**
 * In step, the task in flight among those the build goes on with
 * (`goingOn`), and those behind it, which go on once it is done (12.7.9):
 * the one that went back in flight first — one never parked before any,
 * then by when an answer last freed each (task-parks.cjs), the tracker's
 * order between those alike, as two left running in auto are. Null in
 * auto, and where none goes on.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest the unit's
 * @returns {StepTurn|null}
 */
function stepTurn(cwd, unit, manifest) {
  if (manifest.build?.position !== 'step') return null;
  return turnOf(goingOn(cwd, unit, manifest).tasks, () => parks().freedAt(cwd, unit));
}

/**
 * Of the tasks the build goes on with, in the tracker's order, the one in
 * flight and those behind it (`stepTurn`'s), when an answer last freed each
 * read only where two go on.
 * @param {string[]} tasks @param {() => Map<string, number>} freedAt @returns {StepTurn|null}
 */
function turnOf(tasks, freedAt) {
  if (tasks.length < 2) return tasks.length === 0 ? null : { inFlight: tasks[0], behind: [] };
  const freed = freedAt();
  const [inFlight, ...behind] = [...tasks].sort((a, b) => (freed.get(a) ?? 0) - (freed.get(b) ?? 0));
  return { inFlight, behind };
}

/**
 * Why, in step, the task goes no further yet — its briefs, its gate — or
 * null: another went on before it, which goes first (`stepTurn`).
 * @param {string} cwd @param {TaskRef} ref @param {Record<string, any>} manifest the unit's
 * @returns {string|null}
 */
function turnRefusal(cwd, ref, manifest) {
  const turn = stepTurn(cwd, ref.unit, manifest);
  const shown = shownTask(ref);
  if (turn === null || !turn.behind.includes(shown)) return null;
  return `${ref.unit} builds in step, one task at a time — task ${turn.inFlight} is in flight, and task ${shown} goes on once it is done`;
}

/** `task show`: the task whole, what was added to it among it. @param {string} cwd @param {string} unit @param {string} given */
function showTask(cwd, unit, given) {
  const ref = parseShownTask(unit, given);
  const { ref: _ref, after, ...shown } = trackedTask(cwd, ref);
  return { ...named(ref), ...shown, after: after.map(shownTask) };
}

/**
 * A verb that moves one task on, then the position with it: `prepare`, run
 * before the tracker moves, answers what settles the rest once it has, and
 * that answers what it adds to the verb's answer.
 * @param {string} verb
 * @param {(driver: TaskDriver, root: string, ref: TaskRef, ...more: string[]) => void} move
 * @param {(cwd: string, ref: TaskRef, verb: string) => () => object} prepare
 * @returns {(cwd: string, unit: string, given: string, ...more: string[]) => object}
 */
function moving(verb, move, prepare) {
  return (cwd, unit, given, ...more) => {
    const ref = parseShownTask(unit, given);
    requireUnit(cwd, unit);
    const settle = prepare(cwd, ref, verb);
    const answer = withTracker(cwd, unit, `${verb} ${shownTask(ref)}`, (driver, root) => {
      move(driver, root, ref, ...more);
      return named(ref);
    });
    /** @type {{warnings?: string[]}} */
    const settled = settle();
    const warnings = [...(answer.warnings ?? []), ...(settled.warnings ?? [])];
    return { ...answer, ...settled, ...(warnings.length > 0 ? { warnings } : {}) };
  };
}

/**
 * Ending a task, refused once it has ended as `rule` says: its worktree
 * taken apart before the tracker moves (task-worktree.cjs), so a removal
 * failing leaves it in flight for the verb run again, the worktrees removed
 * answered where any was, then `after`, answering what it adds; and, once
 * the tracker has moved, the task taken off the position, where it is one
 * in flight.
 * @param {string} rule @param {(cwd: string, ref: TaskRef, verb: string) => object} [after]
 * @returns {(cwd: string, ref: TaskRef, verb: string) => () => object}
 */
function ending(rule, after = () => ({})) {
  return (cwd, ref, verb) => {
    const removed = takeWorktreeApart(cwd, ref, verb, () => withTracker(cwd, ref.unit, null, (driver, root) => refuseEnded(driver, root, ref, rule)));
    const added = after(cwd, ref, verb);
    return () => {
      clearTask(ref.unit, taskId(ref));
      return { ...(removed.length === 0 ? {} : { removed }), ...added };
    };
  };
}

/**
 * Whether the phase's tasks may start: for a phase the unit's cut holds,
 * once its start checklist has closed, so no builder starts before its
 * tasks are written (6.4.8, 12.S7); a phase past the cut — a fix phase of
 * the review's (P14), or a quick-fix's, which has no cut — has no start
 * checklist.
 * @param {Record<string, any>} manifest @param {number} phase
 */
const phaseOpen = (manifest, phase) => phase > cutLength(manifest) || phaseStarted(manifest, phase);

/** Refuse a task whose phase's tasks may not start yet (`phaseOpen`). @param {TaskRef} ref @param {Record<string, any>} manifest */
function refuseUnstarted(ref, manifest) {
  if (phaseOpen(manifest, ref.phase)) return;
  throw new Error(`task start: ${phaseName(ref.unit, ref.phase)} has not started — its tasks start once its start checklist closes: checklist close phase-start ${ref.unit} ${ref.phase}`);
}

/**
 * In step, refuse any task but the one in flight or at its gate, which it
 * reaches before it is done (12.7.9): in progress in any phase the unit has
 * written, in flight here or in another conversation, no question waiting
 * parking it — a parked task holds nothing new to test — and ahead of any
 * other going on (`stepTurn`).
 * @param {string} cwd @param {TaskRef} ref @param {Record<string, any>} manifest
 */
function refuseSecondInStep(cwd, ref, manifest) {
  const turn = stepTurn(cwd, ref.unit, manifest);
  if (turn === null || turn.inFlight === shownTask(ref)) return;
  throw new Error(`task start: ${ref.unit} builds in step, one task at a time — task ${turn.inFlight} is in flight or at its gate, and the next starts once the person's go there is given and it is done`);
}

/** `task start`: refused before its phase has started, and in step beside another task; else in progress — where it is not already — and in flight on the position beside any others. */
const startTask = moving('start', (driver, root, ref) => {
  if (refuseEnded(driver, root, ref, 'only a task not yet ended is started').status !== 'in-progress') driver.start(root, ref);
}, (cwd, ref) => {
  const manifest = loadWorkUnitManifest(cwd, ref.unit);
  refuseUnstarted(ref, manifest);
  refuseSecondInStep(cwd, ref, manifest);
  return () => {
    recordTask(cwd, ref.unit, taskId(ref));
    return {};
  };
});

const DONE_RULE = 'only a task not yet ended is done';
const CLOSE_RULE = 'only a task not yet ended is closed';

/**
 * `task done`: refused while a question waiting parks it, where its account
 * is not taken of its review as it stands (task-account.cjs) — a
 * quick-fix's owing none — and for a bugfix's reproducing task while its
 * test's series on the unfixed code does not prove the bug (bug-proven.cjs);
 * else its worktree taken apart, then done, and off the position.
 */
const doneTask = moving('done', (driver, root, ref) => {
  refuseEnded(driver, root, ref, DONE_RULE);
  driver.done(root, ref);
}, (cwd, ref, verb) => {
  withTracker(cwd, ref.unit, null, (driver, root) => refuseEnded(driver, root, ref, DONE_RULE));
  account().refuseUnaccounted(cwd, ref, `task ${verb}`);
  const unproven = reproducingHold(cwd, loadWorkUnitManifest(cwd, ref.unit), ref, 'is done');
  if (unproven !== null) throw new Error(`task ${verb}: ${unproven}`);
  return ending(DONE_RULE)(cwd, ref, verb);
});

/**
 * `task close`: refused for a bugfix's reproducing task (bug-proven.cjs);
 * where a question parks it, refused with no session before anything
 * moves; its worktree taken apart, then off every question parking it,
 * then closed without being done, its reason kept, and off the position —
 * the last of its phase's to end, another done, naming the phase's
 * mutation run (landing.cjs, `mutationRun`).
 */
const closeTask = moving('close', (driver, root, ref, reason) => {
  refuseEnded(driver, root, ref, CLOSE_RULE);
  driver.close(root, ref, reason);
}, (cwd, ref, verb) => {
  const kept = reproducingClose(loadWorkUnitManifest(cwd, ref.unit), ref);
  if (kept !== null) throw new Error(`task ${verb}: ${kept}`);
  const parking = parks().parkingOf(cwd, ref, `task ${verb}`);
  const settle = ending(CLOSE_RULE, () => parks().takeOff(cwd, ref, `task ${verb}`, parking))(cwd, ref, verb);
  return () => ({ ...settle(), ...landing().mutationRun(cwd, ref, false) });
});

/**
 * `task worktree`: the task's worktree laid out where the call is made
 * (task-worktree.cjs), its type and title read as any read of the tracker is.
 * @param {string} cwd @param {string} unit @param {string} given
 */
function worktreeTask(cwd, unit, given) {
  const ref = parseShownTask(unit, given);
  requireUnit(cwd, unit);
  return layOutTask(cwd, ref, () => trackedTask(cwd, ref));
}

/**
 * `task stopped`: the task's builder stopped, unable to build past a
 * problem — the time recorded against the task in flight in the calling
 * conversation, a first stop kept; refused with no conversation, or where
 * the task is not in flight in it.
 * @param {string} cwd @param {string} unit @param {string} given
 */
function stoppedTask(cwd, unit, given) {
  const ref = parseShownTask(unit, given);
  requireUnit(cwd, unit);
  const session = handedSession();
  if (session === null) throw new Error('task stopped: no conversation is named, so no task is in flight — run it from the Claude Code conversation building the task');
  const stopped = recordStop(session, unit, shownTask(ref), new Date().toISOString());
  if (stopped === null) throw new Error(`task stopped: ${taskName(ref)} is not in flight in this conversation — a stop is recorded for a task this conversation builds`);
  return { task: shownTask(ref), id: taskId(ref), stopped };
}

// The build's records, loaded at their call: each reads its task, or the
// tracker's phases, through this module.
const account = () => require('./task-account.cjs');
const settlement = () => require('./phase-settlement.cjs');
const notes = () => require('./notes.cjs');

const SETTLE_USAGE = '<unit> <task> --file <why> | <unit> --phase <N> --file <why> [--fixes <task>,…]';

/**
 * `task settle`: a task's failed round settled, or with `--phase` a phase
 * review that failed, naming its fixes; refused, with the usage, given both
 * a task and a phase, neither, or fixes for a task.
 * @param {string} cwd @param {string[]} positional @param {string} file @param {string} [phase] @param {string} [fixes]
 */
function settleVerb(cwd, [unit, task], file, phase, fixes) {
  if ((task === undefined) === (phase === undefined) || (phase === undefined && fixes !== undefined)) throw new Error(`Usage: engine task settle ${SETTLE_USAGE}`);
  return phase === undefined ? account().settleTask(cwd, unit, task, file) : settlement().settlePhase(cwd, unit, phase, file, fixes);
}

/**
 * Each verb: its arguments after `task {verb}`, how many positionals it
 * takes and how many of them may be left out, the flags it needs and those
 * it may be given, and what it runs, given the flags' values in their
 * order, one left out undefined.
 * @type {Readonly<Record<string, {usage: string, arity: number, optional?: number, flags?: string[], mayTake?: string[], run: (cwd: string, positional: string[], ...values: string[]) => object}>>}
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
  worktree: { usage: '<unit> <task>', arity: 2, run: (cwd, [unit, task]) => worktreeTask(cwd, unit, task) },
  stopped: { usage: '<unit> <task>', arity: 2, run: (cwd, [unit, task]) => stoppedTask(cwd, unit, task) },
  account: { usage: '<unit> <task>', arity: 2, run: (cwd, [unit, task]) => account().takeAccount(cwd, unit, task) },
  settle: { usage: SETTLE_USAGE, arity: 1, optional: 1, flags: ['file'], mayTake: ['phase', 'fixes'], run: settleVerb },
  note: { usage: '<unit> --file <note> [--phase <N>]', arity: 1, flags: ['file'], mayTake: ['phase'], run: (cwd, [unit], file, phase) => notes().depositNote(cwd, unit, file, phase) },
});

/**
 * One `task` verb's answer, its arguments held to its usage first.
 * @param {string} cwd @param {string} verb one of TASK_VERBS
 * @param {string[]} positional @param {Record<string, string>} opts
 * @returns {object}
 */
function runTaskVerb(cwd, verb, positional, opts) {
  const { usage, arity, optional = 0, flags = [], mayTake = [], run } = TASK_VERBS[verb];
  const values = flags.map((flag) => opts[flag] ?? '');
  const given = mayTake.map((flag) => (Object.hasOwn(opts, flag) ? opts[flag] ?? '' : undefined));
  if (positional.length < arity || positional.length > arity + optional || [...values, ...given].some((value) => value !== undefined && value.trim() === '')) {
    throw new Error(`Usage: engine task ${verb} ${usage}`);
  }
  return run(cwd, positional, ...values, .../** @type {string[]} */ (given));
}

module.exports = { TASK_VERBS, ENDED, STATUS_WORDS, runTaskVerb, writePhase, trackedTask, trackedPhases, trackedLists, trackedPhase, trackedUnit, goingOn, goesOn, phaseOpen, stepTurn, turnOf, turnRefusal, phaseWritten, givenText, trackedStart, copiedTasks };
