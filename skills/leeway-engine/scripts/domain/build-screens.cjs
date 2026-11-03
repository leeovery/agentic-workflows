'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the build's screens as `render` serves them (12.12, 12.14),
// each read from the records and drawn by projections/build.cjs; nothing
// here writes. Where the build stands is read from its standing alone
// (build-entry.cjs); a task, from the tracker as any read of a task is, a
// phase of the review's fixes past the cut among them (P14), named for its
// round; a task's account, rounds and figures where `task account` took them
// (task-account.cjs, round-report.cjs); the questions waiting, from the
// ledger's projection (questions.cjs, 12.13.7); a task's calls, the
// decisions of Claude's the ledger holds made for it in the build
// (12.12.12); and what running the product proved of a task's scenarios of
// the cut, at the tips of its branch (runs.cjs).
//
// - `build-headline <unit> --file <payload>`: the tasks started together,
//   the payload `{"tasks": [{"task", "changes", "watch"}, …]}` saying what
//   each is about to change and what to watch when it lands, each a task
//   in progress.
// - `task-landed <unit> <task>`: a task's landing summary, once its account
//   is taken.
// - `task-account <unit> <task>`: any task's account, printed when asked —
//   one not yet taken drawn without it.
// - `step-gate <unit> <task>`: the gate after a task, in step alone, once
//   its account is taken and before it is done; in auto none follows a task
//   (12.12.7).
// - `phase-merge-gate <unit> <N>`: the gate before a phase's stack merges,
//   in step alone, once `land phase` would take it (7.2.4).
// - `build-stop <unit>`: the stop report, while a question waits (12.12.9).
// - `build-progress <unit>`: the build's phases and tasks.
//
// Each refuses, opening on its command: a unit the project lacks or whose
// build has not begun; a task the tracker lacks; and as each says above.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { statePath, stateRoot } = require('../kernel/state-root.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { buildStanding, builtUnit, ownInFlight } = require('./build-entry.cjs');
const { cutPhases, phaseReviewRefusal } = require('./phase-checks.cjs');
const { trackedTask, trackedLists, ENDED } = require('./task-verbs.cjs');
const { fieldOf, criteriaTexts, holdsScenario, namesScenario } = require('./task-file.cjs');
const { accountPath, figuresPath, readAccount } = require('./task-account.cjs');
const { taskRounds } = require('./round-report.cjs');
const { phaseStack, tipCommits } = require('./phase-stack.cjs');
const { runsOf } = require('./runs.cjs');
const { waitingQuestions } = require('./questions.cjs');
const { unitEntries } = require('./unit-entries.cjs');
const { projectName } = require('./state-checks.cjs');
const { parseShownTask, parsePhase, shownTask, taskName } = require('./task-id.cjs');
const { filled, shaped, listed, readPayload, refusing } = require('./staged-payload.cjs');
const {
  landingScreen, accountScreen, stepGateScreen, phaseMergeGateScreen, headlineScreen, progressScreen, stopScreen,
} = require('./projections/build.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */
/** @typedef {import('./round-report.cjs').Round} Round */
/** @typedef {import('./projections/build.cjs').TaskHead} TaskHead */
/** @typedef {import('./projections/build.cjs').Reviewed} Reviewed */
/** @typedef {import('./projections/build.cjs').AccountView} AccountView */
/** @typedef {{dotpath?: string, item?: string, file?: string}} Args */

/** A phase's name: the cut's, or for a phase past it, the review's fixes of its round (P14). @param {Record<string, any>} manifest @param {number} phase */
function phaseNamed(manifest, phase) {
  const cut = cutPhases(manifest);
  return phase <= cut.length ? cut[phase - 1].name ?? '' : `the review's fixes, round ${phase - cut.length}`;
}

/** A task as the tracker holds it, read as every read of the tracker is. @param {string} cwd @param {TaskRef} ref @returns {TaskDetail} */
const taskOf = (cwd, ref) => withStateLock(stateRoot(cwd), () => trackedTask(cwd, ref));

/** A task as screens name it. @param {Record<string, any>} manifest @param {TaskRef} ref @param {TaskDetail} task @returns {TaskHead} */
const headOf = (manifest, ref, task) => ({ task: shownTask(ref), title: task.title, phase: ref.phase, phase_name: phaseNamed(manifest, ref.phase) });

/** The unit a screen is for, its build begun, and the task it names. @param {string} cwd @param {Args} args @param {string} surface */
function namedTask(cwd, { dotpath: unit = '', item }, surface) {
  if (item === undefined) throw new Error(`Usage: engine render ${surface} <work-unit> <task>`);
  const manifest = builtUnit(cwd, unit);
  const ref = parseShownTask(unit, item);
  return { manifest, ref, task: taskOf(cwd, ref) };
}

/** The figures `task account` took, or null where it has not. @param {string} cwd @param {TaskRef} ref @returns {import('./projections/build.cjs').Figures|null} */
function takenFigures(cwd, ref) {
  const file = statePath(cwd, figuresPath(ref));
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/** The findings a task's rounds before its last sent back, nits aside: each round's, as many as its reviewer who found most, so one found by both counts once. @param {Round[]} rounds */
function fixedFindings(rounds) {
  return rounds.slice(0, -1).reduce((sum, { reports }) => sum + Math.max(0, ...reports.map(({ findings }) => findings.filter(({ call }) => call !== 'nit').length)), 0);
}

/** How a task's review ended. @param {Round[]} rounds @returns {Reviewed} */
function reviewedOf(rounds) {
  const last = /** @type {Round} */ (rounds.at(-1));
  return { rounds: rounds.length, settled: last.settled, fixed: fixedFindings(rounds) };
}

/** Each summary's heading under `## Reviews`: each round's, and after each round settled, its settlement's. @param {Round[]} rounds */
const reviewHeadings = (rounds) => rounds.flatMap(({ round, settled }) => [`Round ${round}`, ...(settled ? ['Settled'] : [])]);

/**
 * A task's account as `task account` took it, read with its rounds; null
 * where it has not taken one.
 * @param {string} cwd @param {TaskRef} ref @returns {AccountView['account']}
 */
function takenAccount(cwd, ref) {
  const figures = takenFigures(cwd, ref);
  if (figures === null) return null;
  const rounds = taskRounds(cwd, ref);
  const settled = rounds.filter((round) => round.settled).map(({ round }) => round);
  const { sections, differences, reviews } = readAccount(fs.readFileSync(statePath(cwd, accountPath(ref)), 'utf8'), rounds.length, settled);
  const headings = reviewHeadings(rounds);
  return { sections, differences, reviews: reviews.map((summary, at) => ({ heading: headings[at], summary })), reviewed: reviewedOf(rounds), figures };
}

/** The account a screen needs, refused where `task account` has not taken it. @param {string} cwd @param {TaskRef} ref */
function requiredAccount(cwd, ref) {
  const account = takenAccount(cwd, ref);
  if (account === null) throw new Error(`${taskName(ref)} has no account taken — it lands once its account is: task account ${ref.unit} ${shownTask(ref)}`);
  return account;
}

/** A task's account as a screen draws it, with its place among its phase's tasks not closed. @param {string} cwd @param {Record<string, any>} manifest @param {TaskRef} ref @param {TaskDetail} task @param {AccountView['account']} account @returns {AccountView} */
function accountView(cwd, manifest, ref, task, account) {
  const { phases: [rows] } = withStateLock(stateRoot(cwd), () => trackedLists(cwd, ref.unit, [ref.phase]));
  const live = (rows ?? []).filter(({ status }) => status !== 'closed').map((row) => shownTask(row.ref));
  return { head: headOf(manifest, ref, task), at: live.indexOf(shownTask(ref)) + 1, of: live.length, does: fieldOf(task.text, 'Outcome') ?? '', account };
}

/** Refuses a unit building in auto, where `what` never shows (12.12.7). @param {Record<string, any>} manifest @param {string} what */
function stepOnly(manifest, what) {
  if (manifest.build.position !== 'step') throw new Error(`${manifest.name} builds in auto, where ${what} — the person meets only danger, the authority gates and the questions parked`);
}

/** The calls of Claude's the ledger holds made for a task (12.12.12). @param {string} cwd @param {TaskRef} ref */
function callsMade(cwd, ref) {
  const task = shownTask(ref);
  return [...unitEntries(cwd, ref.unit).values()].filter(({ kind, line }) => kind === 'decision' && line.by === 'claude' && line.task === task).length;
}

/**
 * What running the product proved of each of the task's scenarios of the
 * cut, at the tips of its branch; null where it holds none.
 * @param {string} cwd @param {Record<string, any>} manifest @param {TaskRef} ref @param {TaskDetail} task @param {string[]} criteria
 */
function ranOf(cwd, manifest, ref, task, criteria) {
  const scenarios = cutPhases(manifest).flatMap(({ scenarios: held }) => held).filter((scenario) => holdsScenario(task.text, scenario));
  if (scenarios.length === 0) return { ran: null, recorded: false };
  const head = tipCommits(phaseStack(cwd, ref.unit, ref.phase, [task]));
  const read = scenarios.map((scenario) => ({ scenario, ...runsOf(cwd, ref.unit, scenario, head) }));
  return {
    ran: read.map(({ scenario, standing }) => ({ criterion: criteria.find((criterion) => namesScenario(criterion, scenario)) ?? scenario, standing })),
    recorded: read.some(({ runs }) => runs.length > 0),
  };
}

/** `render task-landed <unit> <task>`. @param {string} cwd @param {Args} args */
function taskLandedSurface(cwd, args) {
  return refusing('render task-landed', () => {
    const { manifest, ref, task } = namedTask(cwd, args, 'task-landed');
    const account = requiredAccount(cwd, ref);
    const criteria = criteriaTexts(task.text);
    return landingScreen({
      head: headOf(manifest, ref, task),
      reviewed: account.reviewed,
      calls: callsMade(cwd, ref),
      changed: account.sections['What was done'],
      criteria,
      product: projectName(cwd),
      ...ranOf(cwd, manifest, ref, task, criteria),
      waiting: waitingQuestions(cwd, [ref.unit]).waiting,
    });
  });
}

/** `render task-account <unit> <task>`. @param {string} cwd @param {Args} args */
function taskAccountSurface(cwd, args) {
  return refusing('render task-account', () => {
    const { manifest, ref, task } = namedTask(cwd, args, 'task-account');
    return accountScreen(accountView(cwd, manifest, ref, task, takenAccount(cwd, ref)));
  });
}

/** `render step-gate <unit> <task>`. @param {string} cwd @param {Args} args */
function stepGateSurface(cwd, args) {
  return refusing('render step-gate', () => {
    const { manifest, ref, task } = namedTask(cwd, args, 'step-gate');
    stepOnly(manifest, 'no gate follows a task');
    if (ENDED.includes(task.status)) throw new Error(`${taskName(ref)} is ${task.status} — its gate comes as it lands, before task done`);
    return stepGateScreen(ref.unit, accountView(cwd, manifest, ref, task, requiredAccount(cwd, ref)));
  });
}

/** `render phase-merge-gate <unit> <N>`. @param {string} cwd @param {Args} args */
function phaseMergeGateSurface(cwd, { dotpath: unit = '', item }) {
  return refusing('render phase-merge-gate', () => {
    if (item === undefined) throw new Error('Usage: engine render phase-merge-gate <work-unit> <N>');
    const manifest = builtUnit(cwd, unit);
    const phase = parsePhase(item);
    stepOnly(manifest, 'a phase\'s stack merges with no gate');
    const refused = phaseReviewRefusal(cwd, unit, phase);
    if (refused !== null) throw new Error(refused);
    return phaseMergeGateScreen(unit, phase, phaseNamed(manifest, phase));
  });
}

/** One task the headline names, as the payload gives it. @param {unknown} given @param {number} at */
function startedTask(given, at) {
  const { task, changes, watch } = shaped(given, `tasks[${at}]`, ['task', 'changes', 'watch']);
  if (![task, changes, watch].every(filled)) throw new Error(`tasks[${at}]'s task, changes and watch are each words`);
  return { task: /** @type {string} */ (task), changes: /** @type {string} */ (changes).trim(), watch: /** @type {string} */ (watch).trim() };
}

/** `render build-headline <unit> --file <payload>`. @param {string} cwd @param {Args} args */
function buildHeadlineSurface(cwd, { dotpath: unit = '', file }) {
  return refusing('render build-headline', () => {
    if (file === undefined) throw new Error('Usage: engine render build-headline <work-unit> --file <payload.json>');
    const manifest = builtUnit(cwd, unit);
    const given = listed(shaped(readPayload(cwd, file), 'the payload', ['tasks']).tasks, 'the payload\'s tasks').map(startedTask);
    if (given.length === 0) throw new Error('the payload names the tasks started together, one at least');
    const twice = given.map(({ task }) => task).find((task, at, all) => all.indexOf(task) !== at);
    if (twice !== undefined) throw new Error(`the payload names task ${twice} twice`);
    const started = given.map(({ task: shown, changes, watch }) => {
      const ref = parseShownTask(unit, shown);
      const task = taskOf(cwd, ref);
      if (task.status !== 'in-progress') throw new Error(`${taskName(ref)} is ${task.status === 'open' ? 'not started' : task.status} — the headline names tasks as they start: task start ${unit} ${shown}`);
      return { ...headOf(manifest, ref, task), changes, watch };
    });
    return headlineScreen(buildStanding(cwd, unit, ownInFlight(unit)), started);
  });
}

/** `render build-stop <unit>`. @param {string} cwd @param {Args} args */
function buildStopSurface(cwd, { dotpath: unit = '' }) {
  return refusing('render build-stop', () => {
    const standing = buildStanding(cwd, unit, ownInFlight(unit));
    if (standing.waiting.length === 0) throw new Error(`no question waits on the person in ${unit}'s build — it stops only where nothing can go on without their answer (12.13.22)`);
    return stopScreen(standing);
  });
}

/** `render build-progress <unit>`. @param {string} cwd @param {Args} args */
function buildProgressSurface(cwd, { dotpath: unit = '' }) {
  return refusing('render build-progress', () => progressScreen(buildStanding(cwd, unit, ownInFlight(unit))));
}

module.exports = { buildHeadlineSurface, taskLandedSurface, taskAccountSurface, stepGateSurface, phaseMergeGateSurface, buildStopSurface, buildProgressSurface };
