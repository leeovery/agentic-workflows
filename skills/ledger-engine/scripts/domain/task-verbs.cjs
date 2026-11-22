'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the `task` verbs, the only way anything in Ledger
// touches a tracker (7.1.2), through the project's task driver (drivers.cjs);
// a verb of another kind that needs a task reads it as `task show` does
// (`trackedTask`), as `land open` reads its type and title, and one that
// needs a unit's phases reads each one's list, and its own phase's tasks
// whole (`trackedPhases`); the build's standing reads the lists of the
// phases it names (`trackedLists`), a phase's checklist that phase's tasks
// whole (`trackedPhase`), and the tasks the build goes on with: those in
// progress in every phase written, and those ready in a phase the caller
// lets go on (`goingOn`) — in step, and in a quick-fix, whose tasks share
// its worktree (19.5.23), the one in flight first and any other going
// on held behind it, its briefs and gate refused until that one is done —
// for a quick-fix, done or closed, or a question parks it (`stepTurn`,
// `turnRefusal`); and the board reads the whole unit from
// a copy of the tracker's store, taking no lock and setting nothing up, so
// it never waits on a writer (`trackedUnit`, `withStoreCopy`).
// A unit's phases are written into the tracker as each starts, so it holds
// only those (7.4.1); a task is made from the task template in a file, one
// call per task (7.1.3, 12.5.3), or as a one-line task from its title and
// type alone (task-file.cjs), reviewed by none by its shape, its review's
// record written with it (round-report.cjs, `reviewedNone`) — a quick-fix's
// referencing no spec, since it has none (19.5.5), fix 1.n naming its
// scenarios n.S1 and on — its id the engine's (task-id.cjs), numbered after
// the highest its phase holds; never into a phase whose stack has landed. An
// addition goes onto a task not yet ended, marked as the orchestrator's or
// the person's, its text from a file (13.11.3), the task marked changed after
// the last round reported of its review, which its pair reads again
// (round-report.cjs); a task not yet ended takes a new type, as the migration
// gives one (21.5.21). While the migration runs, and only then, the plan
// the tracker held from before Ledger of a unit that built nothing, or was
// cancelled, is closed under its root (`task close-plan`, 21.8.4,
// drivers.cjs), the driver refusing a plan holding a task done: the
// tracker wins, and the migration stops there (21.8.12) — but a cancelled
// unit's, whose tasks done stand, the rest closed;
// the close marked in the state's cache, so the cut and the merges' check
// tells it done (080). It never takes a unit not cancelled whose spec the
// migration joined: its cut carries its plans on. The
// migration's cut runs its tracker steps here too (`migratedTracker`,
// cut-migrating.cjs): the phases it names the parents of read as their
// adoption would leave them, each task a correction of the directive's ends
// read as it ends it, writing nothing, and refused, every fault named at
// once — a correction naming a task no adopted phase holds, or titling it
// otherwise, a phase it marks built holding a
// task neither done nor closed, or naming a section outside the area of its
// old plan's topic, a phase it leaves unbuilt holding none, and a link
// holding a task neither done nor closed after one neither, of a later
// phase or another unit's, which `task link` refuses and the build would
// wait on for ever (12.6.4, 7.1.14; a link after an ended task holds
// nothing up) — and another unit's task so held after one of the unit's,
// which the cut of that unit, first, could not see, this unit's tasks
// not yet named — so a refusal leaves the tracker as it was, and the join
// of the migration's pieces names the same faults of a piece but the
// links' (`adoptionFaults`, cut-merges.cjs); then each phase
// adopted, each task a correction ends ended where it has not, and each
// task neither done nor closed typed (21.5.21), answering the tasks of the
// phases not built the tracker holds done, and those neither done nor
// closed with their text. The brief of the migration's per-unit agent
// reads those phases as their adoption would leave them, writing nothing to
// the tracker (`adoptionRead`). A link holds a task after one of its own
// phase's or an earlier phase's, still unfinished, and only a task not yet ended is linked
// (12.6.4); ready answers every task waiting with nothing before it and no
// question parking it (7.1.5, 13.4.6), and, in step or in a quick-fix, the
// task in progress whose turn has come where an answer freed it — its builder sent back in,
// never a new one — until its builder's brief is next issued, and never while
// its pair reads a round of it (`stepTurn`, round-report.cjs, 12.7.9); start,
// refused for a phase the cut holds before its start checklist has closed
// (6.4.8, 12.S7) — a quick-fix's fixes, held by no cut, have none — and in
// step, or in a quick-fix, whose fixes and its review's fix tasks are all
// built in its worktree on its one branch (19.5.23), for any
// task but the one in flight — in progress in any phase written, the
// review's fixes past the cut among them, here or in another conversation,
// no question parking it, and ahead of any other going on (12.7.9) — puts
// the task in flight on the conversation's position, beside any others in
// flight there — a task already in flight kept as it stands, its builder
// and reviewers with it; a quick-fix's task lays the quick-fix's worktree
// out where it is not, on its one branch (fix-branch.cjs), and puts back
// what its park set aside there (fix-aside.cjs) — the start held under the
// writer lock, then the steps that prepare a worktree run there with the
// lock let go, as `task worktree` runs them, once a worktree.
// A quick-fix's worktree has one holder (R27, `checkoutHold`, one read of
// the turn shared by start, the building briefs, the commit door, done and
// close, ready naming the next by the same turn, `stepTurn`): the fix in
// flight whose turn it is, never one a
// question parks. Start refuses a parked fix, as done does, and any fix
// but the holder while one holds it. The holder leaves the worktree clean
// as it stops holding it — a park sets its work aside, and done and close
// refuse while the worktree holds changes not committed — so any change
// there is the holder's. Done and close take a task off the
// position, each first taking off it every task of the unit the tracker
// holds ended — one another conversation ended, or its own verb killed
// once the tracker moved, so the verb run again finishes — before it
// refuses or answers, then
// taking the task's worktree apart (6.3.3, 24.2.4); done refuses a task a
// question waiting parks, and a bugfix's reproducing task until its test's
// series proves the bug (bug-proven.cjs, 15.5.3); close ends a task without
// it being done, with a reason — a bugfix's reproducing task never (15.5.5)
// — takes it off every question parking it (task-parks.cjs), and frees what
// waits on it as done does (7.1.12) — a quick-fix's task ending as
// fix-end.cjs says, a fix's close committing beside the tracker's store the
// record it takes out and keeping what its park set aside, naming it, and
// a quick-fix's move closing its tasks with no end refused, what their
// parks set aside kept too (`closeForMove`, R26),
// and either, ending the last of what held a
// quick-fix's ended review open, handing back to its close
// (review-round.cjs, `handBack`);
// worktree lays the task's worktree out for its builder, reading the task
// as show does, then runs the steps that prepare it (task-worktree.cjs);
// stopped records, against the task in
// flight in the calling conversation, that its builder stopped, unable to
// build past a problem (13.11.9, position.cjs).
// The verbs refuse in the engine's words: a tool the driver needs missing or
// failing, a phase not written, a task the tracker lacks or already holds, a
// task already ended. Beside them, four take the build's records, each its
// own module's: account, a task's account and its rounds' reports; review,
// the orchestrator's choice of its reviewers; and settle, the
// orchestrator's settlement of a failed round (task-account.cjs)
// or, with `--phase`, of a phase review that failed (phase-settlement.cjs);
// and note, a note for later (notes.cjs). No verb removes a phase: a moved
// quick-fix's phases, its fixes' and its review's, are taken out by the
// move (`removeBuild`, workunit-move.cjs), its store staged in the move's
// own commit.
//
// Every verb runs under the writer lock (engine.cjs), the tool's own lock
// inside it — worktree around its layout alone, its steps run outside it. Before anything else reaches the driver, the project's setting
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
const { isObject, jsonText, writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { loadWorkUnitManifest } = require('../kernel/manifest.cjs');
const { workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { resolveDriver, chosenDriver, settingOf, needsRefusal } = require('./drivers.cjs');
const { ignoreInState, withIgnored, migrationRuns, withStateLock } = require('./state-worktree.cjs');
const { commitStateTail, noteCommitOutcome, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { TASK_TYPES, taskId, sameTask, shownTask, parseShownTask, parsePhase, taskName, phaseName } = require('./task-id.cjs');
const { NO_SPEC, breaksLine, readTaskText, specReferenceOf, scenarioIds, oneLineText } = require('./task-file.cjs');
const { recordTask, clearTask, clearTasks, recordStop } = require('./position.cjs');
const { tasksInFlight } = require('./conversation.cjs');
const {
  phaseStarted, cutLength, quickFixBuild, specJoined, areaOfAddress, FIXES_PHASE,
} = require('./derivations.cjs');
const { reproducingHold, reproducingClose } = require('./bug-proven.cjs');
const { layOutTask, takeWorktreeApart } = require('./task-worktree.cjs');
const { markChanged, briefedOf, beingRead, recordReview } = require('./round-report.cjs');
const { prepareWorktreeSteps } = require('./worktree-prep.cjs');
const { refusing } = require('./staged-payload.cjs');
const { isoNow } = require('./dates.cjs');
const { unitClosure } = require('./topic-standing.cjs');

// The questions parking a task, and the landing naming a phase's mutation
// run, loaded at their call: each reads the task through this module.
const parks = () => require('./task-parks.cjs');
const landing = () => require('./landing.cjs');
const fixBranch = () => require('./fix-branch.cjs');
/** What a quick-fix's park set aside, read when asked: it reads the landing, which reads this module. */
const fixAside = () => require('./fix-aside.cjs');
const fixEnd = () => require('./fix-end.cjs');

/** @typedef {import('./drivers.cjs').TaskDriver} TaskDriver */
/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */
/** @typedef {import('./drivers.cjs').TaskRow} TaskRow */
/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */

/** In step or in a quick-fix's worktree (`checkout`), the task in flight, and those going on behind it. @typedef {{inFlight: string, behind: string[], checkout: boolean}} StepTurn */

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

/** A phase the tracker lacks, refused — naming, where a task is made in it, the way it is written first. @param {string} unit @param {number} phase @param {boolean} [creating] */
function unwritten(unit, phase, creating = false) {
  return new TaskRefusal(`${phaseName(unit, phase)} is not written${creating ? ` — write it first: engine task phase ${unit} ${phase} --title <title>` : ''}`);
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
 * `refuseEnded` for an ending verb, every task of the unit on the calling
 * conversation's position the tracker holds ended taken off it first (the
 * header's).
 * @param {string} cwd @param {TaskRef} ref @param {string} rule
 */
function refuseEnding(cwd, ref, rule) {
  withTracker(cwd, ref.unit, null, (driver, root) => {
    const session = handedSession();
    const held = session === null ? [] : tasksInFlight(session).filter(({ unit }) => unit === ref.unit);
    clearTasks(ref.unit, held.filter(({ task }) => ENDED.includes(driver.show(root, parseShownTask(ref.unit, task))?.status ?? '')).map(({ task }) => task));
    return refuseEnded(driver, root, ref, rule);
  });
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
 * `describe` where the answer names it better — or null for a read, the
 * state files `beside` names, those `act` wrote beside the store, committed
 * with it. A refusal, the driver's missing tools named in it where any is,
 * commits what of setting up the branch does not yet hold — the store made,
 * the setting, the ignore lines, and nothing else of the manifest or the
 * ignore file — under "set up the tracker", or, where the verb wrote before
 * it was refused, that and what it wrote under `verb` refused; the commit's
 * warnings are carried in the refusal. A refusal with nothing of either
 * commits nothing.
 * @template {object} T
 * @param {string} cwd @param {string} unit @param {string|null} verb
 * @param {(driver: TaskDriver, root: string) => T} act
 * @param {{describe?: (answer: T) => string, beside?: () => string[]}} [opts]
 * @returns {T & {committed?: string|null, note?: string, warnings?: string[]}}
 */
function withTracker(cwd, unit, verb, act, { describe = () => /** @type {string} */ (verb), beside = () => [] } = {}) {
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
      const { warnings } = commitTracker(cwd, wrote ? [...driver.storeFiles(), ...beside()] : [], `task(${unit}): ${wrote ? `${verb} refused — what it wrote kept` : 'set up the tracker'}`, setUp);
      if (warnings !== undefined && err instanceof Error) err.message = `${err.message} — and ${warnings.join('; ')}`;
    }
    throw err;
  }
  const setUp = setupUncommitted(root, driver);
  if (verb !== null) return Object.assign({}, answer, commitTracker(cwd, [...driver.storeFiles(), ...beside()], `task(${unit}): ${describe(answer)}`, setUp));
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
 * @param {string} cwd @param {string} unit @param {string} file @param {boolean} quickFix whether the unit is built as one
 */
function fileTask(cwd, unit, file, quickFix) {
  const task = readTaskText(fs.readFileSync(path.resolve(cwd, file), 'utf8'));
  const reference = specReferenceOf(task.text);
  if (quickFix && reference !== NO_SPEC) {
    throw new Error(`${unit} is a quick-fix, which has no spec — its task's Spec reference is ${NO_SPEC}, not "${reference}"`);
  }
  return task;
}

/**
 * Refuse a quick-fix's fix naming a scenario of another number: fix 1.n's
 * are n.S1, n.S2 and on, so each fix owns its runs.
 * @param {TaskRef} ref @param {string} text
 */
function refuseOthersScenarios(ref, text) {
  const others = scenarioIds(text).filter((id) => id.split('.')[0] !== String(ref.n));
  if (others.length > 0) throw new TaskRefusal(`${taskName(ref)}, a quick-fix's fix, names its scenarios ${ref.n}.S1, ${ref.n}.S2 and on — not ${others.join(', ')}`);
}

/**
 * A one-line task's (task-file.cjs): its title, one line, and its type, one
 * of the kinds.
 * @param {string} title @param {string} type @returns {import('./task-file.cjs').TaskText}
 */
function oneLineTask(title, type) {
  if (breaksLine(title)) throw new Error('the title breaks its line — a title is one line');
  if (!TASK_TYPES.includes(type)) throw new Error(`the type "${type}" is not one of ${TASK_TYPES.join(', ')}`);
  return { title, type, text: oneLineText(title, type) };
}

const CREATE_USAGE = '<unit> <N> --file <path> | <unit> <N> --title <line> --type <type> --why <reason>';

/**
 * Whether the phase's stack has landed, its tasks `rows` as the tracker
 * holds them (phase-checks.cjs, `phaseLanded`), so no task goes into it —
 * never a quick-fix's, whose fixes land in its one pull request, merged
 * whenever the person merges it.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest the unit's @param {number} phase @param {TaskRow[]} rows
 */
function phaseMerged(cwd, unit, manifest, phase, rows) {
  const { trackerGiven, phaseLanded } = require('./phase-checks.cjs');
  const phases = Array.from({ length: phase }, (_, at) => (at === phase - 1 ? rows : null));
  return !quickFixBuild(manifest) && phaseLanded(trackerGiven(cwd, unit, manifest, /** @type {any} */ (phases)), phase);
}

/**
 * `task create`: a task of the phase from a task file, or a one-line task
 * from its title and type, its record of no reviewer written beside it with
 * `why`, the orchestrator's reason for making it so, numbered after its
 * highest; refused, with the usage, given both forms, neither or a part of
 * the one-line form, and for a phase whose stack has landed.
 * @param {string} cwd @param {string} unit @param {string} given @param {string} [file] @param {string} [title] @param {string} [type] @param {string} [why]
 */
function createTask(cwd, unit, given, file, title, type, why) {
  const oneLine = [title, type, why].filter((value) => value !== undefined).length;
  if ((file === undefined) !== (oneLine === 3) || (file !== undefined && oneLine > 0)) {
    throw new Error(`Usage: engine task create ${CREATE_USAGE}`);
  }
  const phase = parsePhase(given);
  requireUnit(cwd, unit);
  const manifest = loadWorkUnitManifest(cwd, unit);
  const quickFix = quickFixBuild(manifest);
  const task = file === undefined ? oneLineTask(/** @type {string} */ (title).trim(), /** @type {string} */ (type).trim()) : fileTask(cwd, unit, file, quickFix);
  /** @type {string[]} */
  const recorded = [];
  return withTracker(cwd, unit, `create in phase ${phase}`, (driver, root) => {
    const rows = driver.list(root, unit, phase);
    if (rows === null) throw unwritten(unit, phase, true);
    if (phaseMerged(cwd, unit, manifest, phase, rows)) throw new TaskRefusal(`${phaseName(unit, phase)}'s stack has landed — a task goes into a phase still being built, or the review's fix phase`);
    const ref = { unit, phase, n: Math.max(0, ...rows.map((row) => row.ref.n)) + 1 };
    if (driver.show(root, ref) !== null) throw new TaskRefusal(`the tracker already holds ${taskName(ref)}`);
    if (quickFix && phase === FIXES_PHASE.number) refuseOthersScenarios(ref, task.text);
    driver.createTask(root, ref, task);
    if (file === undefined) recorded.push(recordReview(cwd, ref, { reviewers: 0, why: /** @type {string} */ (why).trim() }));
    return named(ref);
  }, { describe: ({ task: shown }) => `create ${shown}`, beside: () => recorded });
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
 * Where `task close-plan` marks a plan from before Ledger closed, in the
 * state's cache, so the cut and the merges' check tells it done (080).
 * @param {string} cwd @param {string} unit @param {string} parent the plan's root, the tracker's own id
 */
const closedMarkPath = (cwd, unit, parent) => statePath(cwd, '.cache', 'migrate', 'closed', unit, `${parent}.json`);

/** Why a closed plan from before Ledger was closed, as the tracker keeps it, by whether its unit was cancelled (21.8.4). */
const PLAN_CLOSED = Object.freeze({
  built: 'closed by the migration — nothing of its unit was built, so the unit\'s build is planned afresh from its spec',
  cancelled: 'closed by the migration — its unit was cancelled before Ledger, so nothing more of it is built',
});

/** Refuse, outside the migration, a verb on a plan from before Ledger. @param {string} cwd */
function refuseUnlessMigrating(cwd) {
  if (!migrationRuns(stateRoot(cwd))) throw new Error('a plan from before Ledger is taken in only while the migration runs — the state branch has its first commit, so the migration is done');
}

/**
 * `task close-plan`: the plan the tracker held from before Ledger of a unit
 * that built nothing, or was cancelled, closed under its root (21.8.4),
 * named by the tracker's own id, only while the migration runs (E13) —
 * refused for a unit not cancelled whose spec it joined, its building
 * started, which its cut alone carries on; and by the driver for a plan
 * holding a task done, but a cancelled unit's, whose tasks done stand.
 * @param {string} cwd @param {string} unit @param {string} parent
 */
function closePlan(cwd, unit, parent) {
  refuseUnlessMigrating(cwd);
  requireUnit(cwd, unit);
  const manifest = loadWorkUnitManifest(cwd, unit);
  const cancelled = manifest.status === 'cancelled';
  if (!cancelled && specJoined(manifest)) throw new Error(`${unit}'s building started before the migration — its specs joined — so its plan is not closed — its cut carries it on: cut ${unit} --migrating --file <plan.json>`);
  const reason = cancelled ? PLAN_CLOSED.cancelled : PLAN_CLOSED.built;
  const closed = withTracker(cwd, unit, 'close the plan from before Ledger', (driver, root) => ({ parent, closed: driver.closePlan(root, unit, parent, reason, cancelled) }));
  const mark = closedMarkPath(cwd, unit, parent);
  fs.mkdirSync(path.dirname(mark), { recursive: true });
  writeJsonAtomic(mark, { at: isoNow(), closed: closed.closed });
  return closed;
}

/** A task as the verb that takes a link off names it: its own unit's as shown, another's by its id. @param {string} unit @param {TaskRef} ref */
const unlinkName = (unit, ref) => (ref.unit === unit ? shownTask(ref) : taskId(ref));

/** A task as a link the cut refuses names it: the unit cut's by its number, another's with its unit. @param {string} unit @param {TaskRef} ref */
const linkedName = (unit, ref) => (ref.unit === unit ? `task ${shownTask(ref)}` : taskName(ref));

/**
 * A task's link after another as the cut of `unit` refuses it, each by its
 * title as the tracker holds it, naming why the build would wait on it for
 * ever and the verb that takes the link off where it no longer holds: the
 * link is the tracker's, so no piece of the plan settles it.
 * @param {string} unit the unit cut @param {TaskRow} task @param {TaskRow} after
 */
function linkWords(unit, task, after) {
  const own = after.ref.unit === task.ref.unit;
  const held = `${linkedName(unit, task.ref)}, "${task.title}", is held after ${linkedName(unit, after.ref)}, "${after.title}"`;
  const why = own ? 'of a later phase — a task waits on its own phase\'s or an earlier one\'s alone' : 'another unit\'s — a task waits on its own unit\'s alone';
  const waiting = task.ref.unit === unit ? shownTask(task.ref) : linkedName(unit, task.ref);
  const verb = `task unlink ${unit} ${unlinkName(unit, task.ref)} --after ${unlinkName(unit, after.ref)} --file <plan.json>`;
  return `${held}, ${why}, so ${waiting} would never start: the link is the tracker's, which no piece of the plan settles — where it no longer holds, ${verb} takes it off`;
}

/**
 * Whether a link of the unit's is one the cut keeps: a task of the unit's
 * after one of its own phase or an earlier one.
 * @param {string} unit @param {TaskRef} task @param {TaskRef} after
 */
const inOrder = (unit, task, after) => task.unit === unit && after.unit === unit && after.phase <= task.phase;

/**
 * The links the cut refuses (the header's): each holding a task neither
 * done nor closed after one neither, of a later phase or another unit's.
 * @param {TaskDriver} driver @param {string} root @param {string} unit @param {TaskDetail[]} tasks every task of the phases adopted
 */
function linkFaults(driver, root, unit, tasks) {
  const held = new Map(tasks.map((task) => [taskId(task.ref), task]));
  return tasks.filter(({ status }) => !ENDED.includes(status)).flatMap((task) => task.after.flatMap((ref) => {
    if (inOrder(unit, task.ref, ref)) return [];
    const on = held.get(taskId(ref)) ?? driver.show(root, ref);
    return on === null || ENDED.includes(on.status) ? [] : [linkWords(unit, task, on)];
  }));
}

/**
 * The links the cut refuses on the unit's tasks from another unit's (the
 * header's): each task of another unit neither done nor closed held after
 * one of the unit's neither, the unit's named as its adoption names them.
 * @param {TaskDriver} driver @param {string} root @param {string} unit @param {{phase: number, parent: string, order: string[]}[]} phases @param {TaskDetail[]} tasks every task of the phases adopted
 */
function waitingFaults(driver, root, unit, phases, tasks) {
  const held = new Map(tasks.map((task) => [taskId(task.ref), task]));
  return driver.waitingOn(root, unit, phases).filter(({ status }) => !ENDED.includes(status)).flatMap((task) => task.after.flatMap((ref) => {
    const on = held.get(taskId(ref));
    return on === undefined || ENDED.includes(on.status) ? [] : [linkWords(unit, task, on)];
  }));
}

/**
 * `task unlink`: the link holding `task` after `after` taken off, for the
 * migration's cut, before its adoption (21.8.8): each named as adopting
 * `phases` in turn would name it, either another unit's by its id, one of
 * the two the unit's. Refuses two tasks of other units, a link the cut
 * keeps (`inOrder`), a task none holds
 * — no phase the cut adopts, or no task of another unit held after one of
 * them — and a link it does not hold.
 * @param {string} cwd @param {string} unit @param {{phase: number, parent: string, order: string[]}[]} phases @param {TaskRef} task @param {TaskRef} after
 */
function unlinkAdopted(cwd, unit, phases, task, after) {
  const [shown, afterShown] = [task, after].map((ref) => unlinkName(unit, ref));
  if (task.unit !== unit && after.unit !== unit) throw new Error(`task unlink: neither ${shown} nor ${afterShown} is ${unit}'s — the cut of ${unit} takes off a link one of whose tasks is its own`);
  if (inOrder(unit, task, after)) throw new Error(`task unlink: ${shown} after ${afterShown} is a link of its own phase or an earlier one's, which the cut keeps — it takes off a link the cut refuses`);
  return withTracker(cwd, unit, `take the link of ${shown} after ${afterShown} off`, (driver, root) => {
    const held = heldFor(driver, root, unit, phases, task);
    if (!held.after.some((ref) => sameTask(ref, after))) throw new TaskRefusal(`task ${shown} is held after no task ${afterShown} — the link is not there to take off`);
    driver.unlink(root, unit, phases, task, after);
    return { task: shown, after: afterShown };
  });
}

/**
 * The task whose link `task unlink` takes off, refused where nothing
 * holds it (`unlinkAdopted`'s).
 * @param {TaskDriver} driver @param {string} root @param {string} unit @param {{phase: number, parent: string, order: string[]}[]} phases @param {TaskRef} task
 * @returns {TaskDetail}
 */
function heldFor(driver, root, unit, phases, task) {
  /** @type {[TaskDetail|undefined, string]} */
  const [held, refusal] = task.unit === unit ? [driver.adoption(root, unit, phases).flatMap(({ tasks }) => tasks).find(({ ref }) => sameTask(ref, task)), `no phase the cut adopts holds task ${shownTask(task)}`]
    : [driver.waitingOn(root, unit, phases).find(({ ref }) => sameTask(ref, task)), `task ${taskId(task)} is held after no task of ${unit}'s — the link is not there to take off`];
  if (held === undefined) throw new TaskRefusal(refusal);
  return held;
}

/**
 * The faults of a phase's tasks against what the cut marks it: built with a
 * task neither done nor closed, or not built with none.
 * @param {{phase: number, built: boolean, tasks: TaskDetail[]}} phase
 */
function builtFaults({ phase, built, tasks }) {
  const open = tasks.filter(({ status }) => !ENDED.includes(status));
  if (built && open.length > 0) return [`phase ${phase} is marked built, and the tracker holds ${open.map(({ ref }) => `task ${shownTask(ref)}`).join(', ')} neither done nor closed — the tracker wins: a phase built has every task ended`];
  if (!built && open.length === 0) return [`phase ${phase} is not marked built, and the tracker holds no task of it neither done nor closed — the tracker wins: mark it built`];
  return [];
}

/**
 * Where a phase marked built names a section outside the area its old plan
 * built — its plan's topic's place among the topics joined, `topics` — that
 * fault; none for a single-topic unit, `topics` null, whose plan built the
 * whole spec.
 * @param {{phase: number, built: boolean, sections: string[], plan: string|null}} held @param {string[]|null} topics
 */
function areaFaults({ phase, built, sections, plan }, topics) {
  if (!built || topics === null) return [];
  const area = String(topics.indexOf(plan ?? '') + 1);
  if (area === '0') return [`phase ${phase} is marked built, and its old plan's root names ${plan === null ? 'no topic' : `${plan}, a topic`} the migration joined into no area — so what it built is no area of the spec`];
  const outside = sections.filter((address) => areaOfAddress(address) !== area);
  if (outside.length === 0) return [];
  return [`phase ${phase} is marked built with ${outside.map((address) => `§${address}`).join(', ')}, outside §${area}, the area of its old plan's topic, ${plan} — a phase built before the migration names only what its old plan built`];
}

/**
 * A task the migration's cut ends where its phase's sources and the code
 * showed the tracker wrong (cut-migrating.cjs): the task by the name its
 * phase's adoption gives it, its title as the tracker holds it, how it
 * ends, and why, the reason a close keeps.
 * @typedef {{ref: TaskRef, title: string, to: 'done'|'closed', why: string}} TrackerCorrection
 */

/**
 * The faults of the corrections against the phases as their adoption
 * leaves them: a task no phase adopted holds, or one titled otherwise.
 * @param {{phase: number, tasks: TaskDetail[]}[]} held @param {TrackerCorrection[]} corrections
 */
function correctionFaults(held, corrections) {
  return corrections.flatMap(({ ref, title }) => {
    const task = held.find(({ phase }) => phase === ref.phase)?.tasks.find((each) => each.ref.n === ref.n);
    if (task === undefined) return [`a correction names task ${shownTask(ref)}, which no phase the cut adopts holds`];
    return task.title === title ? [] : [`a correction names task ${shownTask(ref)} "${title}", and the tracker titles it "${task.title}" — a correction names the task its phase's adoption gives that number`];
  });
}

/**
 * A phase the migration's cut adopts, as its adoption leaves it, with what
 * the cut says of it.
 * @typedef {{phase: number, plan: string|null, built: boolean, sections: string[], tasks: TaskDetail[]}} AdoptedPhase
 */

/**
 * The phases as their adoption leaves them, each task a correction ends
 * read as it ends it.
 * @param {AdoptedPhase[]} held @param {TrackerCorrection[]} corrections @returns {AdoptedPhase[]}
 */
function corrected(held, corrections) {
  const ending = (/** @type {TaskDetail} */ task) => corrections.find(({ ref }) => taskId(ref) === taskId(task.ref));
  return held.map((phase) => ({ ...phase, tasks: phase.tasks.map((task) => {
    const correction = ending(task);
    return correction === undefined || ENDED.includes(task.status) ? task : { ...task, status: correction.to };
  }) }));
}

/**
 * The faults of the phases the migration's cut adopts against what its plan
 * says of them (the header's): a correction naming a task no phase of
 * `read` holds, or titling it otherwise; and each phase of `judged`, its
 * tasks read as the corrections end them, marked built holding a task
 * neither done nor closed or not marked built holding none, or marked built
 * naming a section outside the area of its old plan's topic. `judged` is
 * every phase read but where one phase's piece is checked alone
 * (cut-merges.cjs).
 * @param {AdoptedPhase[]} read @param {TrackerCorrection[]} corrections @param {string[]|null} topics @param {AdoptedPhase[]} [judged]
 */
function adoptionFaults(read, corrections, topics, judged = read) {
  return [...correctionFaults(read, corrections), ...corrected(judged, corrections).flatMap((phase) => [...builtFaults(phase), ...areaFaults(phase, topics)])];
}

/**
 * The migration's cut's tracker steps, one tracker commit (the header's):
 * the phases read as their adoption would leave them, each task a
 * correction ends read as ended, and refused, every fault named and
 * nothing written; then each phase naming its parent adopted, each task a
 * correction ends that the tracker holds neither done nor closed ended, and
 * each task neither done nor closed given `type` where it has another;
 * answering, too, the tasks of the phases not built that the tracker holds
 * done, and those neither done nor closed with their text. A run again
 * adopts, ends and types only what the last left out.
 * @param {string} cwd @param {string} unit @param {{phase: number, parent: string, order: string[], built: boolean, sections: string[]}[]} phases
 * @param {string} type @param {string[]|null} topics the topics joined, area by area — null for a single-topic unit (`areaFaults`)
 * @param {TrackerCorrection[]} [corrections]
 * @returns {{adopted: {phase: number, tasks: string[]}[], typed: string[], ended: string[], done: string[], open: {task: string, text: string}[], committed?: string|null, note?: string, warnings?: string[]}}
 */
function migratedTracker(cwd, unit, phases, type, topics, corrections = []) {
  return withTracker(cwd, unit, 'adopt the plan', (driver, root) => {
    /** @type {AdoptedPhase[]} */
    const read = driver.adoption(root, unit, phases).map(({ phase, plan, tasks }, at) => ({ phase, plan, built: phases[at].built, sections: phases[at].sections, tasks }));
    const held = corrected(read, corrections);
    const faults = [...adoptionFaults(read, corrections, topics), ...linkFaults(driver, root, unit, held.flatMap(({ tasks }) => tasks)), ...waitingFaults(driver, root, unit, phases, held.flatMap(({ tasks }) => tasks))];
    if (faults.length > 0) throw new TaskRefusal(faults.join('; '));
    const adopted = phases.map(({ phase, parent, order }) => ({ phase, tasks: driver.adopt(root, unit, phase, parent, order).map(shownTask) }));
    const unended = new Set(read.flatMap(({ tasks }) => tasks.filter(({ status }) => !ENDED.includes(status)).map(({ ref }) => taskId(ref))));
    const ended = corrections.filter(({ ref }) => unended.has(taskId(ref))).map(({ ref, to, why }) => {
      if (to === 'done') driver.done(root, ref);
      else driver.close(root, ref, why);
      return shownTask(ref);
    });
    const typed = held.flatMap(({ tasks }) => tasks
      .filter((task) => !ENDED.includes(task.status) && task.type !== type)
      .map((task) => {
        driver.setType(root, task.ref, type);
        return shownTask(task.ref);
      }));
    const unbuilt = held.filter(({ built }) => !built).flatMap(({ tasks }) => tasks);
    return {
      adopted,
      typed,
      ended,
      done: unbuilt.filter(({ status }) => status === 'done').map(({ ref }) => shownTask(ref)),
      open: unbuilt.filter(({ status }) => !ENDED.includes(status)).map(({ ref, text }) => ({ task: shownTask(ref), text })),
    };
  });
}

/**
 * The phases of plans the tracker held from before Ledger, read as their
 * adoption would leave them, writing nothing to the tracker — what the
 * migration's per-unit agent's brief draws (brief-records.cjs).
 * @param {string} cwd @param {string} unit @param {{phase: number, parent: string, order: string[]}[]} phases
 * @returns {{phase: number, plan: string|null, title: string, tasks: TaskDetail[]}[]}
 */
function adoptionRead(cwd, unit, phases) {
  return withTracker(cwd, unit, null, (driver, root) => ({ phases: driver.adoption(root, unit, phases) })).phases;
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
 * Every task of each phase the unit has written, whole, in order, read as
 * any read is: from phase 1 on — the build's own `length`, a phase of them
 * not written holding none, and the review's fixes numbered on past them
 * (P14).
 * @param {string} cwd @param {string} unit @param {number} length
 * @returns {{tasks: TaskDetail[], committed?: string|null, warnings?: string[]}}
 */
function trackedBuild(cwd, unit, length) {
  requireUnit(cwd, unit);
  return withTracker(cwd, unit, null, (driver, root) => {
    /** @type {TaskDetail[]} */
    const tasks = [];
    for (let phase = 1; ; phase += 1) {
      const held = driver.tasks(root, unit, phase);
      if (held === null && phase > length) return { tasks };
      tasks.push(...(held ?? []));
    }
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
 * Every phase the unit has written taken out of the tracker for good, its
 * tasks with it, from phase 1 on — the build's own `length`, a phase of
 * them not written passed over, and the review's fixes numbered on past
 * them (P14), as `trackedBuild` reads them — the store left for the
 * caller's own commit, as a read leaves it: the store's files, to stage
 * there.
 * @param {string} cwd @param {string} unit @param {number} length
 * @returns {string[]}
 */
function removeBuild(cwd, unit, length) {
  requireUnit(cwd, unit);
  return withTracker(cwd, unit, null, (driver, root) => {
    for (let phase = 1; ; phase += 1) {
      const written = driver.list(root, unit, phase) !== null;
      if (!written && phase > length) return { files: driver.storeFiles() };
      if (written) driver.removePhase(root, unit, phase);
    }
  }).files;
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
 * `read` against a copy of the tracker's store, each of its files there read
 * whole once — a store kept in one file, read as it stood at one moment:
 * no writer lock taken, nothing set up or written into the state — the
 * driver read as things stand, never set — the copy removed after.
 * @template T @param {string} cwd @param {(driver: TaskDriver, root: string) => T} read @returns {T}
 */
function withStoreCopy(cwd, read) {
  const driver = /** @type {TaskDriver} */ (chosenDriver(cwd, 'task').driver);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-store-'));
  try {
    for (const file of driver.storeFiles().filter((name) => fs.existsSync(statePath(cwd, name)))) {
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

/** Whether the unit's tasks take turns: in step (12.7.9), and in a quick-fix, whose tasks share its worktree (19.5.23). @param {Record<string, any>} manifest */
const takesTurns = (manifest) => manifest.build?.position === 'step' || quickFixBuild(manifest);

/**
 * In step or in a quick-fix (`takesTurns`), the task in flight among those
 * the build goes on with (`goingOn`), and those behind it, which go on once
 * it is done (12.7.9) — a quick-fix's once it is done or closed, or a
 * question parks it, and the worktree is free (19.5.23): the one that went
 * back in flight first — one never parked before any, then by when an
 * answer last freed each (task-parks.cjs), the tracker's order between
 * those alike, as two left running in auto are. Null in auto, and where
 * none goes on.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest the unit's
 * @returns {StepTurn|null}
 */
function stepTurn(cwd, unit, manifest) {
  if (!takesTurns(manifest)) return null;
  return turnOf(goingOn(cwd, unit, manifest).tasks, () => parks().freedAt(cwd, unit), quickFixBuild(manifest));
}

/**
 * Of the tasks the build goes on with, in the tracker's order, the one in
 * flight and those behind it (`stepTurn`'s), when an answer last freed each
 * read only where two go on; `checkout` where they take turns in a
 * quick-fix's worktree.
 * @param {string[]} tasks @param {() => Map<string, number>} freedAt @param {boolean} checkout @returns {StepTurn|null}
 */
function turnOf(tasks, freedAt, checkout) {
  if (tasks.length < 2) return tasks.length === 0 ? null : { inFlight: tasks[0], behind: [], checkout };
  const freed = freedAt();
  const [inFlight, ...behind] = [...tasks].sort((a, b) => (freed.get(a) ?? 0) - (freed.get(b) ?? 0));
  return { inFlight, behind, checkout };
}

/** What a task behind the one in flight waits for, as a line says it. @param {StepTurn} turn */
const turnEnds = ({ inFlight, checkout }) => (checkout ? `task ${inFlight} is done or closed, or a question parks it` : `task ${inFlight} is done`);

/**
 * Why, in step, the task goes no further yet — its briefs, its gate — or
 * null: another went on before it, which goes first (`stepTurn`).
 * @param {string} cwd @param {TaskRef} ref @param {Record<string, any>} manifest the unit's
 * @returns {string|null}
 */
function turnRefusal(cwd, ref, manifest) {
  const turn = stepTurn(cwd, ref.unit, manifest);
  if (turn === null || !turn.behind.includes(shownTask(ref))) return null;
  return turnWords(ref, turn);
}

/** Why the task goes no further while another holds the turn, as a refusal says it. @param {TaskRef} ref @param {StepTurn} turn */
const turnWords = (ref, turn) => `${ref.unit} builds ${turn.checkout ? 'in its worktree' : 'in step'}, one task at a time — task ${turn.inFlight} is in flight, and task ${shownTask(ref)} goes on once ${turn.checkout ? turnEnds(turn) : 'it is done'}`;

/** `task show`: the task whole, what was added to it among it. @param {string} cwd @param {string} unit @param {string} given */
function showTask(cwd, unit, given) {
  const ref = parseShownTask(unit, given);
  const { ref: _ref, after, ...shown } = trackedTask(cwd, ref);
  return { ...named(ref), ...shown, after: after.map(shownTask) };
}

/**
 * A verb that moves one task on, then the position with it: `prepare`, run
 * before the tracker moves, answers what settles the rest once it has, and
 * that answers what it adds to the verb's answer. The move answers the
 * state files it wrote beside the tracker's store, committed with it, which
 * the settling is told.
 * @param {string} verb
 * @param {(cwd: string, driver: TaskDriver, root: string, ref: TaskRef, ...more: string[]) => string[]|void} move
 * @param {(cwd: string, ref: TaskRef, verb: string) => (written: string[]) => object} prepare
 * @returns {(cwd: string, unit: string, given: string, ...more: string[]) => object}
 */
function moving(verb, move, prepare) {
  return (cwd, unit, given, ...more) => {
    const ref = parseShownTask(unit, given);
    requireUnit(cwd, unit);
    const settle = prepare(cwd, ref, verb);
    /** @type {string[]} */
    let written = [];
    const answer = withTracker(cwd, unit, `${verb} ${shownTask(ref)}`, (driver, root) => {
      written = move(cwd, driver, root, ref, ...more) ?? [];
      return named(ref);
    }, { beside: () => written });
    /** @type {{warnings?: string[]}} */
    const settled = settle(written);
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
 * In step, refuse any task but the one in flight, or at its gate, which it
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

/**
 * A quick-fix's task against its worktree (R27), from one read of the
 * turn: the turn, its task in flight the fix holding the worktree, never
 * one a question parks (`stepTurn`), null where none holds it; whether
 * `ref` is that fix; and the questions parking `ref`, none where none
 * does.
 * @param {string} cwd @param {TaskRef} ref @param {Record<string, any>} manifest the unit's
 * @returns {Hold}
 */
function checkoutHold(cwd, ref, manifest) {
  const turn = stepTurn(cwd, ref.unit, manifest);
  const shown = shownTask(ref);
  return { turn, holds: turn?.inFlight === shown, parkedOn: parks().parkedOf(cwd, ref.unit).get(shown) ?? [] };
}

/** @typedef {{turn: StepTurn|null, holds: boolean, parkedOn: string[]}} Hold */

/**
 * Refuse, in the words of `said`, ending the fix that holds a quick-fix's
 * worktree by `end` while the worktree holds changes not committed (R27):
 * it leaves the worktree clean as it stops holding it.
 * @param {string} cwd @param {TaskRef} ref @param {'done'|'close'} end @param {string} said
 */
function refuseLeftDirty(cwd, ref, end, said) {
  const manifest = loadWorkUnitManifest(cwd, ref.unit);
  if (quickFixBuild(manifest) && checkoutHold(cwd, ref, manifest).holds) fixBranch().refuseDirtyEnd(cwd, ref, end, said);
}

/**
 * Refuse, in the words of `said`, a quick-fix's task that may not take the
 * worktree (R27): one a question parks, and any but the holder while one
 * holds it.
 * @param {TaskRef} ref @param {Hold} hold @param {string} said
 */
function refuseNotHolding(ref, { turn, holds, parkedOn }, said) {
  if (parkedOn.length > 0) throw new Error(`${said}: ${parks().parkedWords(ref, parkedOn)}`);
  if (turn === null || holds) return;
  throw new Error(`${said}: ${ref.unit} builds one task at a time, in its worktree on its one branch — task ${turn.inFlight} is in flight, and task ${shownTask(ref)} starts once it is done or closed, or a question parks it`);
}

/** The start under the writer lock (`startTask`): refused for a unit not in progress, before its phase has started, and in step beside the task in flight, or in a quick-fix where the task may not take its worktree; else in progress — where it is not already — and in flight on the position beside any others, a quick-fix's worktree laid out where it is not, then what its park set aside put back there. */
const startHeld = moving('start', (_cwd, driver, root, ref) => {
  if (refuseEnded(driver, root, ref, 'only a task not yet ended is started').status !== 'in-progress') driver.start(root, ref);
}, (cwd, ref) => {
  const manifest = loadWorkUnitManifest(cwd, ref.unit);
  const closure = unitClosure(manifest);
  if (closure !== null) throw new Error(`task start: ${closure}`);
  refuseUnstarted(ref, manifest);
  const quickFix = quickFixBuild(manifest);
  if (quickFix) refuseNotHolding(ref, checkoutHold(cwd, ref, manifest), 'task start');
  else refuseSecondInStep(cwd, ref, manifest);
  return () => {
    recordTask(cwd, ref.unit, taskId(ref));
    if (!quickFix) return {};
    const out = fixBranch().layOutFix(cwd, ref.unit);
    const back = fixAside().putBack(out.worktree, ref, 'task start');
    return { ...out, ...(back.length === 0 ? {} : { put_back: back }) };
  };
});

/**
 * `task start`: the start under the writer lock (`startHeld`), then, for a
 * quick-fix's task, the steps that prepare its worktree run with the lock
 * let go, as `task worktree` runs them: its answer, and the steps run,
 * where any ran.
 * @param {string} cwd @param {string} unit @param {string} given
 */
function startTask(cwd, unit, given) {
  const out = /** @type {Record<string, any>} */ (withStateLock(stateRoot(cwd), () => startHeld(cwd, unit, given)));
  if (out.worktree === undefined) return out;
  const { top } = fixBranch().fixWorktree(cwd, unit);
  const prepared = refusing('task start', () => prepareWorktreeSteps(cwd, out.worktree, top, `${unit}'s worktree is not ready to build in`));
  return prepared.length === 0 ? out : { ...out, prepared };
}

const DONE_RULE = 'only a task not yet ended is done';
const CLOSE_RULE = 'only a task not yet ended is closed';

/**
 * `task done`: refused while a question waiting parks it; for a
 * quick-fix's task as its end refuses it (fix-end.cjs) — no commit of its
 * own, or its newest not in the pull request — before its account; where
 * its account is not taken of its review as it stands (task-account.cjs) —
 * a quick-fix's as any task's — or, a one-line task, until it is built;
 * for the fix holding a quick-fix's worktree
 * while the worktree holds changes not committed (R27); and for a bugfix's
 * reproducing task while its test's series on the unfixed code does not
 * prove the bug (bug-proven.cjs); else its
 * worktree taken apart, then done, and off the position — the last of
 * what held a quick-fix's ended review open handing back to its close
 * (review-round.cjs, `handBack`).
 */
const doneTask = moving('done', (_cwd, driver, root, ref) => {
  refuseEnded(driver, root, ref, DONE_RULE);
  driver.done(root, ref);
}, (cwd, ref, verb) => {
  refuseEnding(cwd, ref, DONE_RULE);
  fixEnd().refuseUndone(cwd, ref, `task ${verb}`);
  account().refuseUnaccounted(cwd, ref, `task ${verb}`);
  refuseLeftDirty(cwd, ref, 'done', `task ${verb}`);
  const unproven = reproducingHold(cwd, loadWorkUnitManifest(cwd, ref.unit), ref, 'is done');
  if (unproven !== null) throw new Error(`task ${verb}: ${unproven}`);
  const settle = ending(DONE_RULE)(cwd, ref, verb);
  return () => ({ ...settle(), ...reviewRound().handBack(cwd, ref.unit) });
});

/**
 * A task closed, its end refused first as `refuseHeld` refuses it, and
 * what follows it once closed answered by `then` (the header's `task
 * close`).
 * @param {(cwd: string, ref: TaskRef, said: string) => void} refuseHeld
 * @param {(cwd: string, ref: TaskRef) => object} [then]
 */
const closing = (refuseHeld, then = () => ({})) => moving('close', (cwd, driver, root, ref, reason) => {
  refuseEnded(driver, root, ref, CLOSE_RULE);
  driver.close(root, ref, reason);
  return fixEnd().closedRecord(cwd, ref);
}, (cwd, ref, verb) => {
  refuseEnding(cwd, ref, CLOSE_RULE);
  const kept = reproducingClose(loadWorkUnitManifest(cwd, ref.unit), ref);
  if (kept !== null) throw new Error(`task ${verb}: ${kept}`);
  refuseHeld(cwd, ref, `task ${verb}`);
  const parking = parks().parkingOf(cwd, ref, `task ${verb}`);
  const settle = ending(CLOSE_RULE, () => parks().takeOff(cwd, ref, `task ${verb}`, parking))(cwd, ref, verb);
  return (written) => ({ ...settle(), ...landing().mutationRun(cwd, ref, false), ...fixEnd().recordReindexed(cwd, ref, written), ...then(cwd, ref) });
});

/**
 * `task close`: refused for a bugfix's reproducing task (bug-proven.cjs),
 * for a quick-fix's task as its end refuses it (fix-end.cjs), and for the
 * fix holding its worktree while the worktree holds changes not committed
 * (R27); where a
 * question parks it, refused with no session before anything moves; its
 * worktree taken apart, then off every question parking it, then closed
 * without being done, its reason kept — a quick-fix's fix's record taken
 * out in the same commit, the knowledge base brought in line after — and
 * off the position — the last of its phase's to end, another done, naming
 * the phase's mutation run (landing.cjs, `mutationRun`), and the last of
 * what held a quick-fix's ended review open handing back to its close
 * (review-round.cjs, `handBack`); a quick-fix's fix's work its park set
 * aside kept, never dropped, and named with the calls that show it and
 * bring it into a checkout (fix-aside.cjs, `keptAside`, R26).
 */
const closeTask = closing((cwd, ref, said) => {
  fixEnd().refuseHeld(cwd, ref, said);
  refuseLeftDirty(cwd, ref, 'close', said);
}, (cwd, ref) => {
  const kept = fixAside().keptAside(cwd, ref.unit).filter(({ task }) => task === shownTask(ref));
  return { ...(kept.length === 0 ? {} : { kept_aside: kept }), ...reviewRound().handBack(cwd, ref.unit) };
});

/**
 * A quick-fix's task closed by its move (workunit-move.cjs), as `task
 * close` closes it but for its end's refusal: the move lands nothing, its
 * branch and its fixes' work set aside kept and named by the move (R26).
 */
const closeForMove = closing(() => {});

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
// tracker's phases, through this module; and the migration's cut, which
// takes a link off through it.
const account = () => require('./task-account.cjs');
const reviewRound = () => require('./review-round.cjs');
const settlement = () => require('./phase-settlement.cjs');
const notes = () => require('./notes.cjs');
const migrating = () => require('./cut-migrating.cjs');

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
  create: { usage: CREATE_USAGE, arity: 2, mayTake: ['file', 'title', 'type', 'why'], run: (cwd, [unit, phase], file, title, type, why) => createTask(cwd, unit, phase, file, title, type, why) },
  add: { usage: '<unit> <task> --file <path> --by <orchestrator|person>', arity: 2, flags: ['file', 'by'], run: (cwd, [unit, task], file, by) => addToTask(cwd, unit, task, file, by) },
  type: { usage: '<unit> <task> <type>', arity: 3, run: (cwd, [unit, task, type]) => typeTask(cwd, unit, task, type) },
  'close-plan': { usage: '<unit> --parent <tracker-id>', arity: 1, flags: ['parent'], run: (cwd, [unit], parent) => closePlan(cwd, unit, parent) },
  link: { usage: '<unit> <task> --after <task>', arity: 2, flags: ['after'], run: (cwd, [unit, task], after) => linkTask(cwd, unit, task, after) },
  unlink: { usage: '<unit> <task> --after <task> --file <plan.json>', arity: 2, flags: ['after', 'file'], run: (cwd, [unit, task], after, file) => migrating().unlinkMigrating(cwd, unit, task, after, file) },
  ready: { usage: '<unit> [<N>]', arity: 1, optional: 1, run: (cwd, [unit, phase]) => readyTasks(cwd, unit, phase) },
  start: { usage: '<unit> <task>', arity: 2, run: (cwd, [unit, task]) => startTask(cwd, unit, task) },
  done: { usage: '<unit> <task>', arity: 2, run: (cwd, [unit, task]) => doneTask(cwd, unit, task) },
  close: { usage: '<unit> <task> --reason <reason>', arity: 2, flags: ['reason'], run: (cwd, [unit, task], reason) => closeTask(cwd, unit, task, reason) },
  list: { usage: '<unit> <N>', arity: 2, run: (cwd, [unit, phase]) => listTasks(cwd, unit, phase) },
  show: { usage: '<unit> <task>', arity: 2, run: (cwd, [unit, task]) => showTask(cwd, unit, task) },
  worktree: { usage: '<unit> <task>', arity: 2, run: (cwd, [unit, task]) => worktreeTask(cwd, unit, task) },
  stopped: { usage: '<unit> <task>', arity: 2, run: (cwd, [unit, task]) => stoppedTask(cwd, unit, task) },
  account: { usage: '<unit> <task>', arity: 2, run: (cwd, [unit, task]) => account().takeAccount(cwd, unit, task) },
  review: { usage: '<unit> <task> --reviewers <1|2> --file <why>', arity: 2, flags: ['reviewers', 'file'], run: (cwd, [unit, task], reviewers, file) => account().reviewTask(cwd, unit, task, reviewers, file) },
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

module.exports = { TASK_VERBS, ENDED, STATUS_WORDS, runTaskVerb, closeForMove, migratedTracker, adoptionRead, adoptionFaults, unlinkAdopted, writePhase, trackedTask, trackedPhases, trackedLists, trackedPhase, trackedBuild, removeBuild, trackedUnit, goingOn, goesOn, phaseOpen, takesTurns, stepTurn, turnOf, turnEnds, turnRefusal, turnWords, checkoutHold, phaseWritten, givenText, trackedStart, copiedTasks };
