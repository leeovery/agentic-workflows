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
//   is taken — a bugfix's reproducing task's once its bug is proven too
//   (bug-proven.cjs), as it lands.
// - `task-account <unit> <task>`: any task's account, printed when asked —
//   one not yet taken drawn without it — a quick-fix's fix's and its
//   review's fix tasks' among them, each built through the task loop and
//   accounted as any task is (19.5.3).
// - `step-gate <unit> <task>`: the gate after a task, in step alone, once
//   its account is taken and before it is done — a bugfix's reproducing
//   task's once its bug is proven too — and for a task an answer freed
//   while another went on, once that one is done (12.7.9); in auto none
//   follows a task (12.12.7).
// - `phase-merge-gate <unit> <N>`: the gate before a phase's stack merges,
//   in step alone, for a phase written and not yet merged: one of the cut
//   once `land phase` would take it (7.2.4), one of the review's fixes
//   once its tasks are done.
// - `build-stop <unit>`: the stop report, while a question waits and
//   nothing can go on without an answer (`buildGoesOn`, which the board
//   reads too): no task in progress, in any phase written, and none ready,
//   that no question parks, of a phase started or one whose start waits on
//   Claude's own items alone, every item the engine checks of it holding
//   (checklist.cjs); no phase's next step — a phase whose every task not
//   closed is done its close, one closed its merge, and once a phase has
//   closed the next one's writing; and once the cut is through, the
//   review's round with nothing to go on with, its reads named and every
//   report of it in (review-phase.cjs, `reviewGoesOn`) (12.12.9, 12.13.22).
//   A quick-fix's stops as a build's does, its fixes its one phase, with no
//   phase's step and no position: no fix, or fix task of its review, that
//   no question parks in progress or ready, and once its review was asked
//   for at its close, the review's round with nothing to go on with.
// - `build-progress <unit>`: the build's phases and tasks — a quick-fix's
//   fixes, and its review's fix phases after them.
//
// Each refuses, opening on its command: a unit the project lacks or whose
// build has not begun — a quick-fix, but for `task-account`, `build-stop`
// and `build-progress`, which serve one whose fixes have begun, the rest
// none, its tasks having no headline, no landing summary, no gate and no
// stack; a task the tracker lacks; and as each says above.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { statePath, stateRoot } = require('../kernel/state-root.cjs');
const { BUILD_PHASES } = require('../kernel/manifest-schema.cjs');
const { withStateLock } = require('./state-worktree.cjs');
const { phaseNamed, buildStanding, builtUnit, standingUnit, ownInFlight } = require('./build-entry.cjs');
const { reading, phaseLists, phaseLanded, reviewRefusalOf } = require('./phase-checks.cjs');
const { reviewStanding, reviewGoesOn } = require('./review-phase.cjs');
const { cutPhases, cutLength, quickFixBuild, reviewAsked } = require('./derivations.cjs');
const { trackedTask, trackedLists, goingOn, phaseOpen, turnRefusal, ENDED, STATUS_WORDS } = require('./task-verbs.cjs');
const { engineItemsHold } = require('./checklist.cjs');
const { fieldOf, criteriaTexts, criterionWords, holdsScenario, namesScenario, scenarioIds } = require('./task-file.cjs');
const { finishedUnits } = require('./ledger-units.cjs');
const { accountPath, takenFigures, readAccount } = require('./task-account.cjs');
const { taskRounds } = require('./round-report.cjs');
const { heldStack, tipCommits } = require('./phase-stack.cjs');
const { branchHead } = require('./fix-branch.cjs');
const { runsOf } = require('./runs.cjs');
const { reproducingHold } = require('./bug-proven.cjs');
const { waitingQuestions } = require('./questions.cjs');
const { unitEntries } = require('./unit-entries.cjs');
const { projectName } = require('./state-checks.cjs');
const { parseShownTask, parsePhase, shownTask, taskName, phaseName } = require('./task-id.cjs');
const { filled, shaped, listed, readPayload, refusing } = require('./staged-payload.cjs');
const {
  landingScreen, accountScreen, stepGateScreen, phaseMergeGateScreen, headlineScreen, progressScreen, stopScreen,
} = require('./projections/build.cjs');

/** @typedef {import('./task-id.cjs').TaskRef} TaskRef */
/** @typedef {import('./build-entry.cjs').BuildStanding} BuildStanding */
/** @typedef {import('./drivers.cjs').TaskDetail} TaskDetail */
/** @typedef {import('./round-report.cjs').Round} Round */
/** @typedef {import('./projections/build.cjs').TaskHead} TaskHead */
/** @typedef {import('./projections/build.cjs').Reviewed} Reviewed */
/** @typedef {import('./projections/build.cjs').AccountView} AccountView */
/** @typedef {{dotpath?: string, item?: string, file?: string}} Args */

/** A task as the tracker holds it, read as every read of the tracker is. @param {string} cwd @param {TaskRef} ref @returns {TaskDetail} */
const taskOf = (cwd, ref) => withStateLock(stateRoot(cwd), () => trackedTask(cwd, ref));

/** A task as screens name it. @param {Record<string, any>} manifest @param {TaskRef} ref @param {TaskDetail} task @returns {TaskHead} */
const headOf = (manifest, ref, task) => ({ task: shownTask(ref), title: task.title, phase: ref.phase, phase_name: phaseNamed(manifest, ref.phase) });

/**
 * The unit a screen is for, its build begun — a quick-fix's, its fixes
 * begun, where `quickFix` lets one — and the task it names.
 * @param {string} cwd @param {Args} args @param {string} surface @param {{quickFix?: boolean}} [opts]
 */
function namedTask(cwd, { dotpath: unit = '', item }, surface, { quickFix = false } = {}) {
  if (item === undefined) throw new Error(`Usage: engine render ${surface} <work-unit> <task>`);
  const manifest = quickFix ? standingUnit(cwd, unit) : builtUnit(cwd, unit);
  const ref = parseShownTask(unit, item);
  return { manifest, ref, task: taskOf(cwd, ref) };
}

/** How a task's review ended: in which round, and whether passed or settled. @param {Round[]} rounds @returns {Reviewed} */
const reviewedOf = (rounds) => ({ rounds: rounds.length, settled: /** @type {Round} */ (rounds.at(-1)).settled });

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

/** A task's account as a screen draws it, with its place among its phase's tasks. @param {string} cwd @param {Record<string, any>} manifest @param {TaskRef} ref @param {TaskDetail} task @param {AccountView['account']} account @returns {AccountView} */
function accountView(cwd, manifest, ref, task, account) {
  const { phases: [rows] } = withStateLock(stateRoot(cwd), () => trackedLists(cwd, ref.unit, [ref.phase]));
  const tasks = (rows ?? []).map((row) => shownTask(row.ref));
  return {
    head: headOf(manifest, ref, task), at: tasks.indexOf(shownTask(ref)) + 1, of: tasks.length, does: fieldOf(task.text, 'Outcome') ?? '', closed: task.status === 'closed', account,
  };
}

/** Refuses a unit building in auto, where `what` never shows (12.12.7). @param {Record<string, any>} manifest @param {string} what */
function stepOnly(manifest, what) {
  if (manifest.build.position !== 'step') throw new Error(`${manifest.name} builds in auto, where ${what} — the person meets only danger, the authority gates and the questions parked`);
}

/**
 * The calls of Claude's the ledger holds made in the build for a task
 * (12.12.12), each by its short id and words — never one a moved unit's
 * build made for its own task of that number, carried to its topic's
 * first phase (ledger-rehomed.cjs).
 * @param {string} cwd @param {TaskRef} ref
 */
function callsOf(cwd, ref) {
  const task = shownTask(ref);
  return [...unitEntries(cwd, ref.unit).values()]
    .filter(({ kind, line }) => kind === 'decision' && line.by === 'claude' && line.task === task && BUILD_PHASES.includes(String(line.phase)))
    .map(({ short, line }) => ({ id: short, text: String(line.text) }));
}

/** The tips of the task's branch, as a run names the code it ran: null where it has none yet. @param {string} cwd @param {TaskRef} ref @param {TaskDetail} task */
function stackHead(cwd, ref, task) {
  const stack = heldStack(cwd, ref.unit, ref.phase, [task]);
  return stack === null ? null : tipCommits(stack);
}

/**
 * The tips of the task's branch, as a run names the code it ran — a
 * quick-fix's task's the quick-fix's one branch (fix-branch.cjs) — null
 * where it has none yet.
 * @param {string} cwd @param {Record<string, any>} manifest @param {TaskRef} ref @param {TaskDetail} task
 */
const taskHead = (cwd, manifest, ref, task) => (quickFixBuild(manifest) ? branchHead(cwd, ref.unit) : stackHead(cwd, ref, task));

/** A scenario of a task with no branch yet: nothing run. */
const NOT_RUN = Object.freeze({ standing: /** @type {const} */ ('not proven'), runs: [], decided: null });

/** What a scenario's runs prove at a task's tips (`taskHead`, runs.cjs): nothing run where it has none yet. @param {string} cwd @param {string} unit @param {string} scenario @param {ReturnType<typeof taskHead>} head */
const runsAt = (cwd, unit, scenario, head) => (head === null ? NOT_RUN : runsOf(cwd, unit, scenario, head));

/**
 * What running the product proved of each of the task's scenarios — of the
 * cut, or a quick-fix's fix's own, which it names (F2) — at the tips of its
 * branch, a quick-fix's task's the quick-fix's one branch (fix-branch.cjs):
 * null where it holds none, not run where the task has no branch yet; and
 * whether a run there counts, one skipped never.
 * @param {string} cwd @param {Record<string, any>} manifest @param {TaskRef} ref @param {TaskDetail} task @param {string[]} criteria
 */
function ranOf(cwd, manifest, ref, task, criteria) {
  const scenarios = quickFixBuild(manifest)
    ? scenarioIds(task.text)
    : cutPhases(manifest).flatMap(({ scenarios: held }) => held).filter((scenario) => holdsScenario(task.text, scenario));
  if (scenarios.length === 0) return { ran: null, recorded: false };
  const head = taskHead(cwd, manifest, ref, task);
  const read = scenarios.map((scenario) => ({ scenario, ...runsAt(cwd, ref.unit, scenario, head) }));
  return {
    ran: read.map(({ scenario, standing }) => ({ scenario, criterion: criterionWords(criteria.find((criterion) => namesScenario(criterion, scenario)) ?? scenario), standing })),
    recorded: read.some(({ runs }) => runs.some(({ verdict }) => verdict !== 'skipped')),
  };
}

/** Refuse a bugfix's reproducing task while its bug is not proven at its tip, naming the series or the rework: it lands once it is (bug-proven.cjs). @param {string} cwd @param {Record<string, any>} manifest @param {TaskRef} ref */
function refuseUnproven(cwd, manifest, ref) {
  const held = reproducingHold(cwd, manifest, ref, 'lands');
  if (held !== null) throw new Error(held);
}

/** `render task-landed <unit> <task>`. @param {string} cwd @param {Args} args */
function taskLandedSurface(cwd, args) {
  return refusing('render task-landed', () => {
    const { manifest, ref, task } = namedTask(cwd, args, 'task-landed');
    refuseUnproven(cwd, manifest, ref);
    const account = requiredAccount(cwd, ref);
    const criteria = criteriaTexts(task.text);
    return landingScreen({
      head: headOf(manifest, ref, task),
      reviewed: account.reviewed,
      calls: callsOf(cwd, ref).length,
      changed: account.sections['What was done'],
      criteria: criteria.map(criterionWords),
      product: projectName(cwd),
      ...ranOf(cwd, manifest, ref, task, criteria),
      waiting: waitingQuestions(cwd, [ref.unit]).waiting,
    });
  });
}

/** `render task-account <unit> <task>`. @param {string} cwd @param {Args} args */
function taskAccountSurface(cwd, args) {
  return refusing('render task-account', () => {
    const { manifest, ref, task } = namedTask(cwd, args, 'task-account', { quickFix: true });
    return accountScreen(accountView(cwd, manifest, ref, task, takenAccount(cwd, ref)));
  });
}

/** `render step-gate <unit> <task>`. @param {string} cwd @param {Args} args */
function stepGateSurface(cwd, args) {
  return refusing('render step-gate', () => {
    const { manifest, ref, task } = namedTask(cwd, args, 'step-gate');
    stepOnly(manifest, 'no gate follows a task');
    if (ENDED.includes(task.status)) throw new Error(`${taskName(ref)} is ${task.status} — its gate comes as it lands, before task done`);
    refuseUnproven(cwd, manifest, ref);
    const behind = withStateLock(stateRoot(cwd), () => turnRefusal(cwd, ref, manifest));
    if (behind !== null) throw new Error(behind);
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
    const refused = mergeRefusal(reading(cwd, unit, manifest), phase);
    if (refused !== null) throw new Error(refused);
    return phaseMergeGateScreen(unit, phase, phaseNamed(manifest, phase));
  });
}

/**
 * Why no gate stands before the phase's stack merges, or null: a phase the
 * tracker lacks, one merged already, one of the cut whose review has not
 * passed or whose fixes are not done, and one of the review's fixes with a
 * task not done.
 * @param {import('./phase-checks.cjs').Reading} at @param {number} phase @returns {string|null}
 */
function mergeRefusal(at, phase) {
  const [rows] = phaseLists(at, [phase]);
  if (rows === null) return `${phaseName(at.unit, phase)} is not written — no stack of its waits to merge`;
  if (phaseLanded(at, phase)) return `${phaseName(at.unit, phase)} is merged already — its tasks are on the default branch`;
  if (phase <= cutLength(at.manifest)) return reviewRefusalOf(at, phase);
  const unfinished = rows.find(({ status }) => status !== 'done' && status !== 'closed');
  return unfinished === undefined ? null : `${phaseName(at.unit, phase)} merges once its tasks are done — task ${shownTask(unfinished.ref)} is ${STATUS_WORDS[unfinished.status]}`;
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
      if (task.status !== 'in-progress') throw new Error(`${taskName(ref)} is ${STATUS_WORDS[task.status]} — the headline names tasks as they start: task start ${unit} ${shown}`);
      return { ...headOf(manifest, ref, task), changes, watch };
    });
    return headlineScreen(buildStanding(cwd, unit, ownInFlight(unit)), started);
  });
}

/**
 * Whether the build goes on with a phase's tasks ready to start: the phase
 * open, or its start's engine items holding (12.13.22) — the stop's rule, and
 * the board's (projections/board-build.cjs), its checks reading first what
 * the call has read of the unit already, `reads`, where given.
 * @param {string} cwd @param {string} unit @param {Record<string, any>} manifest the unit's @param {Map<string, any>} [reads]
 * @returns {(phase: number) => boolean}
 */
function phaseLets(cwd, unit, manifest, reads) {
  return (phase) => phaseOpen(manifest, phase) || engineItemsHold(cwd, 'phase-start', [unit, String(phase)], reads);
}

/**
 * A phase of the cut's next step that needs no answer, or null: its close
 * — its notes, its phase review, a settlement — once every task of it not
 * closed is done; in step, its merge at its gate once it has closed; and
 * the next phase's writing once the one before it has closed (12.7.5). The
 * review's fix phases are the review's to go on with (`reviewGoesOn`).
 * @param {BuildStanding['phases']} phases @param {number} cut
 * @returns {string|null}
 */
function phaseStepOn(phases, cut) {
  const cuts = phases.filter(({ phase }) => phase <= cut);
  const closed = (/** @type {number} */ phase) => phase === 0 || ['closed', 'merged'].includes(cuts[phase - 1]?.state ?? '');
  for (const { phase, state } of cuts) {
    if (state === 'in review') return `phase ${phase}'s close: its notes, its phase review and its stack's merge`;
    if (state === 'closed') return `phase ${phase}'s merge, at its gate`;
    if (state === 'not yet written' && closed(phase - 1)) return `phase ${phase}'s writing`;
  }
  return null;
}

/**
 * What the build goes on with that needs no answer, as its refusal says
 * it, or null — the stop's
 * rule (12.13.22), which `render build-stop` and the board both read: a task
 * no question parks, in progress or ready where its phase lets it start
 * (`tasks`); a phase's next step (`phaseStepOn`); and once the build has
 * finished, the review's round (`review`, as `reviewGoesOn` answers it).
 * Each is read only where the one before it is not going on.
 * @param {BuildStanding} standing @param {number} cut
 * @param {{tasks: () => string[], review: () => string|null}} reads
 * @returns {string|null}
 */
function buildGoesOn(standing, cut, { tasks, review }) {
  const [next] = tasks();
  if (next !== undefined) return `build goes on with task ${next}, which no question parks`;
  const step = phaseStepOn(standing.phases, cut);
  if (step !== null) return `build goes on with ${step}`;
  const round = standing.finished ? review() : null;
  return round === null ? null : `review goes on: ${round}`;
}

/**
 * Where the unit's build stands as its screens draw it, and whether it is a
 * quick-fix's: one's build is through once its review was asked for at its
 * close, its fixes all ended.
 * @param {string} cwd @param {string} unit
 */
function screenStanding(cwd, unit) {
  const standing = buildStanding(cwd, unit, ownInFlight(unit));
  const manifest = standingUnit(cwd, unit);
  const quickFix = quickFixBuild(manifest);
  return { manifest, quickFix, standing: quickFix ? { ...standing, finished: reviewAsked(manifest) } : standing };
}

/** `render build-stop <unit>`. @param {string} cwd @param {Args} args */
function buildStopSurface(cwd, { dotpath: unit = '' }) {
  return refusing('render build-stop', () => {
    const { manifest, quickFix, standing } = screenStanding(cwd, unit);
    if (standing.waiting.length === 0) throw new Error(`no question waits on the person in ${unit}'s build — it stops only where nothing can go on without their answer (12.13.22)`);
    const on = buildGoesOn(standing, cutLength(manifest), {
      tasks: () => withStateLock(stateRoot(cwd), () => goingOn(cwd, unit, manifest, { ready: phaseLets(cwd, unit, manifest) })).tasks,
      review: () => reviewGoesOn(cwd, unit, reviewStanding(reading(cwd, unit, manifest))),
    });
    if (on !== null) throw new Error(`${unit}'s ${on} — it stops only where nothing can go on without the person's answer (12.13.22)`);
    return stopScreen(standing, finishedUnits(stateRoot(cwd)), quickFix);
  });
}

/** `render build-progress <unit>`. @param {string} cwd @param {Args} args */
function buildProgressSurface(cwd, { dotpath: unit = '' }) {
  return refusing('render build-progress', () => {
    const { quickFix, standing } = screenStanding(cwd, unit);
    return progressScreen(standing, finishedUnits(stateRoot(cwd)), quickFix);
  });
}

module.exports = {
  phaseNamed, phaseLets, buildGoesOn, taskOf, takenAccount, takenFigures, callsOf, ranOf, taskHead, runsAt,
  buildHeadlineSurface, taskLandedSurface, taskAccountSurface, stepGateSurface, phaseMergeGateSurface, buildStopSurface, buildProgressSurface,
};
