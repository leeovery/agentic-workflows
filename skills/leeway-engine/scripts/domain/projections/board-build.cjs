'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the build on the board (20.5) — This session in a build, a
// task's page, the task as written and a round of its review read in full,
// and the questions a press can queue — read from where the build stands
// (build-entry.cjs), a task's records (build-screens.cjs) and the briefs
// this conversation issued.
//
// - A task's state (20.4.9, 20.5.2): done, or closed, as the tracker holds
//   it; in step, at its gate, or behind the task in flight, which it names,
//   as its standing says, neither running; waiting on the questions that
//   park it; one in progress building or in review by the last brief this
//   conversation issued for it — the builder's or a fix round's building, a
//   reviewer's in review — since that brief was issued, its clock ended by
//   `task account`, and building where no brief of this conversation's
//   names it (P15) — failed instead from its builder's stop, held against
//   it in flight in this conversation, until the builder is sent back or a
//   raise parks it (P5); one not started after the tasks not yet done it is
//   linked after, else not started.
// - The phases are the cut's, then the review's fixes past it, as the
//   standing lists them. A phase is merging where, in step, its merge waits
//   at its gate — the lowest whose does, the cut's as the build's standing
//   names it, past it a fix phase whose tasks are done as the review
//   phase's does (`mergingAt`); else complete once every task not closed is
//   done, one at least; not yet written, written or running as its
//   standing says.
// - The build has stopped (20.5.1, D6) while a question waits and nothing
//   can be built without an answer: the stop report's rule (`goesOn`, its
//   phases let go on by `phaseLets`), over every phase the unit has written,
//   the review's fixes among them.
// - A question (20.5.3) parks its tasks, and the tasks linked after those
//   wait after it.
// - Where the build stands is read from the unit's one read of the tracker
//   (board.cjs), as the build's one reader of it reads it (build-entry.cjs);
//   a task's page takes its task from that read.
// ---------------------------------------------------------------------------

const fs = require('fs');
const { statePath } = require('../../kernel/state-root.cjs');
const { standingOf, buildPhases } = require('../build-entry.cjs');
const { reviewStanding } = require('../review-phase.cjs');
const { reading } = require('../phase-checks.cjs');
const { goesOn } = require('../task-verbs.cjs');
const { phaseNamed, phaseLets, takenAccount, callsOf, ranOf } = require('../build-screens.cjs');
const { fieldOf, criteriaTexts, FIELDS } = require('../task-file.cjs');
const { figuresPath, takenFigures } = require('../task-account.cjs');
const { roundReportPath } = require('../round-report.cjs');
const { REVIEWER_LETTERS } = require('../../kernel/reviewers.cjs');
const { parseShownTask, taskName } = require('../task-id.cjs');
const { counted } = require('./map.cjs');
const { BUILDING_ROLES } = require('../brief-names.cjs');

/** @typedef {import('../board-model.cjs').TaskLine} TaskLine */
/** @typedef {import('../board-model.cjs').TaskState} TaskState */
/** @typedef {import('../board-model.cjs').BuildPhase} BuildPhase */
/** @typedef {import('../board-model.cjs').BuildView} BuildView */
/** @typedef {import('../board-model.cjs').Question} Question */
/** @typedef {import('../board-model.cjs').Fact} Fact */
/** @typedef {import('../build-entry.cjs').BuildStanding} BuildStanding */
/** @typedef {import('../build-entry.cjs').StandingTask} StandingTask */
/** @typedef {import('../build-entry.cjs').StandingPhase} StandingPhase */
/** @typedef {import('../review-phase.cjs').ReviewStanding} ReviewStanding */
/**
 * What the board reads at a call: the project, the tab's unit with its
 * manifest and title, the conversation's tasks in flight and the briefs it
 * issued, and the warnings gathered.
 * @typedef {import('../board.cjs').BoardAt} BoardAt
 */

/**
 * A task in progress's state and since when: failed where its builder's
 * stop stands (P5), else by the last brief this conversation issued for it
 * (P15).
 * @param {BoardAt} at @param {string} task @returns {{state: TaskState, since: string|null}}
 */
function runningOf(at, task) {
  if (stopOf(at, task) !== null) return { state: 'failed', since: null };
  const brief = at.issued.filter((issued) => issued.task === task && [...BUILDING_ROLES, 'reviewer'].includes(issued.role)).at(-1);
  if (brief === undefined) return { state: 'building', since: null };
  const state = BUILDING_ROLES.includes(brief.role) ? 'building' : 'in-review';
  return { state, since: fs.existsSync(statePath(at.cwd, figuresPath(parseShownTask(at.unit, task)))) ? null : brief.at };
}

/** When the builder of a task in flight in this conversation stopped, null where it stands unstopped. @param {BoardAt} at @param {string} task */
const stopOf = (at, task) => at.inFlight.find((held) => held.task === task)?.stopped ?? null;

/** A task's line on the board (the header's). @param {BoardAt} at @param {StandingTask} task @returns {TaskLine} */
function taskLine(at, { task, title, status, parked, after }) {
  /** @type {(state: TaskState, since?: string|null, on?: string[]) => TaskLine} */
  const line = (state, since = null, on = []) => ({ task, title, state, since, on });
  if (status === 'done' || status === 'closed' || status === 'at-gate') return line(status);
  if (status === 'behind') return line(status, null, [/** @type {import('../task-verbs.cjs').StepTurn} */ (standingAt(at).turn).inFlight]);
  if (parked.length > 0) return line('waits', null, parked);
  if (status === 'in-progress') {
    const { state, since } = runningOf(at, task);
    return line(state, since);
  }
  return after.length > 0 ? line('after', null, after) : line('not-started');
}

/**
 * A phase of the build on the board, the cut's or the review's fixes past
 * it (the header's). @param {BoardAt} at @param {StandingPhase} phase @param {number|null} merging
 * @returns {BuildPhase}
 */
function buildPhase(at, { phase, name, state, tasks }, merging) {
  const lines = tasks.map((task) => taskLine(at, task));
  const live = lines.filter((line) => line.state !== 'closed');
  const done = live.filter((line) => line.state === 'done').length;
  return { phase, name, state: phaseShown(state, phase === merging, live.length > 0 && done === live.length), done, total: live.length, tasks: lines };
}

/** A phase's state as the board shows it. @param {StandingPhase['state']} state @param {boolean} merging @param {boolean} complete @returns {BuildPhase['state']} */
function phaseShown(state, merging, complete) {
  if (state === 'not yet written') return 'not-written';
  if (merging) return 'merging';
  if (complete) return 'complete';
  return state === 'written' ? 'written' : 'running';
}

/** Whether a task line runs: building or in review. @param {TaskLine} line */
const running = ({ state }) => state === 'building' || state === 'in-review';

/** Whether the build has stopped (the header's). @param {BoardAt} at @param {BuildStanding} standing */
function stoppedOf(at, standing) {
  if (standing.waiting.length === 0) return false;
  const parked = new Set(standing.waiting.flatMap(({ parks }) => parks));
  return goesOn(parked, at.tracker(), phaseLets(at.cwd, at.unit, at.manifest, readingAt(at).reads)).length === 0;
}

/** The questions a press can queue, oldest first (the header's). @param {BuildStanding} standing @returns {Question[]} */
function questionsOf(standing) {
  const tasks = standing.phases.flatMap(({ tasks: held }) => held);
  const titled = new Map(tasks.map(({ task, title }) => [task, title]));
  return standing.waiting.map(({ question, asks, parks, since }) => ({
    question,
    asks,
    parks: parks.map((task) => ({ task, title: titled.get(task) ?? '' })),
    after: tasks.filter(({ after }) => after.some((task) => parks.includes(task))).map(({ task }) => task),
    since,
  }));
}

/**
 * What the board's unit's checks read it by, once a call, seeded with the
 * unit's one read of the tracker: each phase's list, and the tasks whole of
 * each phase holding one not yet ended; and each phase the build may have
 * written past the last it has as not written — the review's fix phases
 * are written in turn, so none past the first not written is.
 * @param {BoardAt} at @returns {import('../phase-checks.cjs').Reading}
 */
const readingAt = (at) => at.once('reading', () => {
  const { phases, written } = at.tracker();
  const read = reading(at.cwd, at.unit, at.manifest, at.warnings);
  phases.forEach((rows, i) => read.reads.set(`list ${i + 1}`, rows));
  written.forEach((tasks, i) => {
    if (tasks !== null) read.reads.set(`tasks ${i + 1}`, tasks);
  });
  for (const phase of buildPhases(read).filter((each) => each > phases.length)) read.reads.set(`list ${phase}`, null);
  return read;
});

/** The build's standing for the board's unit, read once a call (`readingAt`). @param {BoardAt} at @returns {BuildStanding} */
const standingAt = (at) => at.once('build', () => standingOf(readingAt(at), at.inFlight));

/** Where the review phase stands for the board's unit, read once a call (`readingAt`). @param {BoardAt} at @returns {ReviewStanding} */
const reviewStandingAt = (at) => at.once('review', () => reviewStanding(readingAt(at)));

/**
 * In step, the lowest phase whose merge waits at its gate, of every phase
 * the build lists: one of the cut's as the build's standing names it, else,
 * once the build has finished, one past it as the review phase's does — a
 * fix phase once its fix tasks are done; null in auto, and where none waits.
 * @param {BoardAt} at @param {BuildStanding} standing @returns {number|null}
 */
const mergingAt = (at, standing) => standing.merging ?? (standing.finished ? reviewStandingAt(at).merging : null);

/**
 * The build's This session (20.5.1–20.5.3) and the questions a press can
 * queue, from one read of where the build stands, drawn once a call
 * whichever tabs show it.
 * @param {BoardAt} at @returns {{view: BuildView, questions: Question[]}}
 */
const buildView = (at) => at.once('build-view', () => drawBuild(at));

/** The build's This session, drawn (`buildView`'s). @param {BoardAt} at @returns {{view: BuildView, questions: Question[]}} */
function drawBuild(at) {
  const standing = standingAt(at);
  const merging = mergingAt(at, standing);
  const phases = standing.phases.map((phase) => buildPhase(at, phase, merging));
  const lines = phases.flatMap(({ tasks }) => tasks).filter((line) => line.state !== 'closed');
  const at_ = phases.find(({ state }) => state !== 'complete') ?? phases.at(-1);
  return {
    view: {
      kind: 'build',
      unit: at.unit,
      title: at.title,
      type: at.manifest.work_type,
      progress: {
        done: lines.filter(({ state }) => state === 'done').length,
        total: lines.length,
        phase: at_?.phase ?? 0,
        phases: phases.length,
        running: lines.filter(running).length,
        stopped: stoppedOf(at, standing),
      },
      waiting: standing.waiting.map(({ question }) => question),
      phases,
    },
    questions: questionsOf(standing),
  };
}

/**
 * The banner's facts in a build (20.2.4): stopped first where nothing can
 * go on, then the type and the phase, how many build and are in review, and
 * the questions waiting on the person.
 * @param {BuildView} view @returns {{state: 'running'|'needs', facts: Fact[]}}
 */
function buildBanner({ type, progress, phases, waiting }) {
  const lines = phases.flatMap(({ tasks }) => tasks);
  const count = (/** @type {TaskState} */ state) => lines.filter((line) => line.state === state).length;
  const fact = (/** @type {string} */ text, needs = false) => ({ text, needs });
  return {
    state: progress.stopped ? 'needs' : 'running',
    facts: [
      ...(progress.stopped ? [fact('stopped')] : []),
      fact(type),
      fact('build'),
      ...(count('building') > 0 ? [fact(`${count('building')} building`)] : []),
      ...(count('in-review') > 0 ? [fact(`${count('in-review')} in review`)] : []),
      ...(waiting.length > 0 ? [fact(`${waiting.length} waiting on you`, true)] : []),
    ],
  };
}

/** A task of the unit's build: its ref, its line and its phase as the standing holds it. @param {BoardAt} at @param {string} given */
function standingTask(at, given) {
  const ref = parseShownTask(at.unit, given);
  const standing = standingAt(at);
  const phase = standing.phases.find(({ phase: number }) => number === ref.phase);
  const task = phase?.tasks.find(({ task: shown }) => shown === given);
  return { ref, task: task === undefined ? null : taskLine(at, task) };
}

/**
 * The task the page names, as the unit's read of the tracker took it;
 * refused where the tracker lacks it.
 * @param {BoardAt} at @param {import('../task-id.cjs').TaskRef} ref
 */
function pageTask(at, ref) {
  const { task } = at.tracker();
  if (task === null) throw new Error(`${taskName(ref)} is not in the tracker`);
  return task;
}

/**
 * A task's page (20.5.4–20.5.6): a task of the cut by its line, one past it
 * — a fix task of the review's — by the tracker alone; refused where the
 * tracker lacks it.
 * @param {BoardAt} at @param {string} given @returns {import('../board-model.cjs').TaskPage}
 */
function taskPage(at, given) {
  const { ref, task: line } = standingTask(at, given);
  const task = pageTask(at, ref);
  const account = takenAccount(at.cwd, ref);
  const criteria = criteriaTexts(task.text);
  const sections = account?.sections ?? {};
  return {
    kind: 'task',
    unit: at.unit,
    phase: ref.phase,
    phase_name: phaseNamed(at.manifest, ref.phase),
    line: line ?? taskLine(at, { task: given, title: task.title, status: task.status, parked: [], after: [] }),
    started: account === null ? at.tracker().started : account.figures.started,
    finished: account?.figures.finished ?? null,
    does: fieldOf(task.text, 'Outcome') ?? '',
    criteria: criteria.length,
    account: account === null ? null : {
      done: sections['What was done'],
      where: sections['Where in the code'],
      tests: sections['What the tests prove'],
      differences: account.differences,
      figures: { files: account.figures.files, added: account.figures.added, removed: account.figures.removed, criteria: account.figures.criteria },
    },
    reviews: account?.reviews.map(({ heading, summary }) => ({ round: heading, summary })) ?? [],
    calls: callsOf(at.cwd, ref),
    ran: ranOf(at.cwd, at.manifest, ref, task, criteria).ran,
    question: line?.state === 'waits' ? line.on[0] : null,
  };
}

/** The task as written, each section by its heading (20.5.4's "▸ read the task"). @param {BoardAt} at @param {string} given @returns {import('../board-model.cjs').WrittenPage} */
function writtenPage(at, given) {
  const { title, text } = pageTask(at, parseShownTask(at.unit, given));
  return {
    kind: 'task-written',
    unit: at.unit,
    task: given,
    title,
    sections: FIELDS.flatMap((heading) => {
      const body = fieldOf(text, heading);
      return body === null ? [] : [{ heading, text: body }];
    }),
  };
}

/**
 * A round of a task's review read in full: each reviewer's report it holds,
 * by its letter; refused where the task holds no report of that round.
 * @param {BoardAt} at @param {string} given @param {string} said @returns {import('../board-model.cjs').RoundPage}
 */
function roundPage(at, given, said) {
  const ref = parseShownTask(at.unit, given);
  const round = Number(said);
  const reports = REVIEWER_LETTERS.flatMap((letter) => {
    const file = statePath(at.cwd, roundReportPath(ref, round, letter));
    return fs.existsSync(file) ? [{ letter, text: fs.readFileSync(file, 'utf8') }] : [];
  });
  if (!Number.isInteger(round) || reports.length === 0) throw new Error(`${taskName(ref)} holds no report of round ${said}`);
  return { kind: 'task-round', unit: at.unit, task: given, title: pageTask(at, ref).title, round, reports };
}

/**
 * The build's moments for the unit's LATELY (20.15.1): each question
 * waiting raised, each task in progress started, as the tracker holds it,
 * each one failed as its builder stopped, and each task done finished, as
 * its account was taken.
 * @param {BoardAt} at @returns {import('../board-model.cjs').Moment[]}
 */
function buildMoments(at) {
  const standing = standingAt(at);
  /** @type {(kind: string, when: string|null|undefined, detail: string) => import('../board-model.cjs').Moment[]} */
  const moment = (kind, when, detail) => (typeof when === 'string' ? [{ kind, at: new Date(when).toISOString(), topic: null, detail }] : []);
  return [
    ...standing.waiting.flatMap(({ question, since }) => moment('raised', since, question)),
    ...Object.entries(at.tracker().starts).flatMap(([task, when]) => moment('task-started', when, task)),
    ...standing.phases.flatMap(({ tasks }) => tasks).filter((task) => taskLine(at, task).state === 'failed')
      .flatMap(({ task }) => moment('task-failed', stopOf(at, task), task)),
    ...standing.phases.flatMap(({ tasks }) => tasks).filter(({ status }) => status === 'done')
      .flatMap(({ task }) => moment('task-finished', takenFigures(at.cwd, parseShownTask(at.unit, task))?.finished, task)),
  ];
}

/** How far the build has come, as All work and the unit's tab say it. @param {BuildView} view */
const buildWords = ({ progress }) => `${progress.done} of ${counted(progress.total, 'task')} done`;

module.exports = { buildView, buildBanner, taskLine, taskPage, writtenPage, roundPage, buildWords, buildMoments, standingAt, reviewStandingAt };
