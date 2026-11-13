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
//   can go on without an answer: the stop report's own rule
//   (`buildGoesOn`, build-screens.cjs), over every phase the unit has
//   written, the review's fixes among them — a task no question parks, a
//   phase's next step, and once the build has finished, the review's
//   round.
// - A question (20.5.3) parks its tasks, and the tasks linked after those
//   wait after it.
// - A task's page lists what running the product proved of each of its
//   scenarios (15.2.14), and a fix task's what it fixes: each finding of the
//   review's rounds that went to it (20.10.3); and each question parking
//   it, whole, as the unit's build has it, so the page holds them wherever
//   the session goes while it is open (20.3.5). Its reviews are its
//   account's summaries, or, with no account, its rounds reported whole,
//   each by what it found and how it ended (20.5.6). A scenario opens on
//   the run that decides its standing at the task's tips (runs.cjs,
//   build-screens.cjs `taskHead`) — a quick-fix's task's the quick-fix's
//   one branch, not run where the task has no branch yet — the scenario's
//   words split at their "then" into what the run drives and what it
//   checks — and each of that run's text evidence opens whole.
// - Where the build stands is read from the unit's one read of the tracker
//   (board.cjs), as the build's one reader of it reads it (build-entry.cjs);
//   a task's page takes its task from that read.
// - What waits on the person in the build is the phase's own of the unit's
//   one list (board-standing.cjs), its questions among them.
// - How far the build has come, as This session, All work and the unit's
//   tab say it, is the start menu's row's words while the tracker holds
//   none of its tasks (progress.cjs), else its tasks done of all.
// ---------------------------------------------------------------------------

const { fact, placeFact } = require('../board-model.cjs');
const fs = require('fs');
const { statePath } = require('../../kernel/state-root.cjs');
const { standingOf, buildPhases } = require('../build-entry.cjs');
const { reviewStanding, reviewGoesOn, recordedRounds } = require('../review-phase.cjs');
const { cutLength } = require('../derivations.cjs');
const { reading } = require('../phase-checks.cjs');
const { goesOn } = require('../task-verbs.cjs');
const { phaseNamed, phaseLets, buildGoesOn, takenAccount, callsOf, ranOf, taskHead, runsAt } = require('../build-screens.cjs');
const { fieldOf, criteriaTexts, criterionWords, holdsScenario, namesScenario, FIELDS } = require('../task-file.cjs');
const { specPath, specReading, DRAWS_ON } = require('../spec-sections.cjs');
const { figuresPath, takenFigures } = require('../task-account.cjs');
const { roundReportPath, wholeRounds } = require('../round-report.cjs');
const { messageOf } = require('../../kernel/call.cjs');
const { REVIEWER_LETTERS } = require('../../kernel/reviewers.cjs');
const { parseShownTask, taskName } = require('../task-id.cjs');
const { counted } = require('./map.cjs');
const { BUILDING_ROLES } = require('../brief-names.cjs');
const { buildMeasure } = require('../progress.cjs');

/** @typedef {import('../board-model.cjs').TaskLine} TaskLine */
/** @typedef {import('../board-model.cjs').TaskState} TaskState */
/** @typedef {import('../board-model.cjs').BuildPhase} BuildPhase */
/** @typedef {import('../board-model.cjs').BuildView} BuildView */
/** The build as drawn, all but what waits, and the questions a press can queue. @typedef {{view: Omit<BuildView, 'waiting'>, questions: Question[]}} BuildRead */
/** @typedef {import('../board-model.cjs').Question} Question */
/** @typedef {import('../board-model.cjs').WaitingLine} WaitingLine */
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
  return buildGoesOn(standing, cutLength(at.manifest), {
    tasks: () => goesOn(parked, at.tracker(), phaseLets(at.cwd, at.unit, at.manifest, readingAt(at).reads)),
    review: () => reviewGoesOn(at.cwd, at.unit, reviewStandingAt(at)),
  }) === null;
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
 * call's one read of the project's repositories and the unit's one read of
 * the tracker: each phase's list, and the tasks whole of
 * each phase holding one not yet ended; and each phase the build may have
 * written past the last it has as not written — the review's fix phases
 * are written in turn, so none past the first not written is.
 * @param {BoardAt} at @returns {import('../phase-checks.cjs').Reading}
 */
const readingAt = (at) => at.once('reading', () => {
  const { phases, written } = at.tracker();
  const read = reading(at.cwd, at.unit, at.manifest, at.warnings, at.repos);
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
 * The build as This session draws it (20.5.1–20.5.3), all but what waits
 * on the person, and the questions a press can queue, from one read of
 * where the build stands, drawn once a call whichever tabs read it.
 * @param {BoardAt} at @returns {BuildRead}
 */
const buildRead = (at) => at.once('build-view', () => drawBuild(at));

/**
 * The build's This session: the build as drawn, and what waits on the
 * person in it, the phase's own of the unit's one list (board-standing.cjs).
 * @param {BoardAt} at @param {WaitingLine[]} waiting @returns {{view: BuildView, questions: Question[]}}
 */
function buildView(at, waiting) {
  const { view, questions } = buildRead(at);
  return { view: { ...view, waiting }, questions };
}

/** The build as drawn (`buildRead`'s). @param {BoardAt} at @returns {BuildRead} */
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
        untasked: phases.some(({ tasks }) => tasks.length > 0) ? null : buildMeasure(at.manifest),
      },
      phases,
    },
    questions: questionsOf(standing),
  };
}

/**
 * The banner's facts in a build (20.2.4): the type and the phase, then
 * stopped where nothing can go on (D20), and how many build and are in
 * review; what waits on the person is counted by the board (board.cjs).
 * @param {BuildView} view @returns {{state: 'running'|'needs', facts: Fact[]}}
 */
function buildBanner({ type, progress, phases }) {
  const lines = phases.flatMap(({ tasks }) => tasks);
  const count = (/** @type {TaskState} */ state) => lines.filter((line) => line.state === state).length;
  return {
    state: progress.stopped ? 'needs' : 'running',
    facts: [
      placeFact(type),
      placeFact('build'),
      ...(progress.stopped ? [placeFact('stopped')] : []),
      ...(count('building') > 0 ? [fact(`${count('building')} building`)] : []),
      ...(count('in-review') > 0 ? [fact(`${count('in-review')} in review`)] : []),
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
 * A task's rounds reported whole (round-report.cjs), null where a report of
 * them does not read, said among the warnings.
 * @param {BoardAt} at @param {import('../task-id.cjs').TaskRef} ref @returns {import('../round-report.cjs').Round[]|null}
 */
function roundsRead(at, ref) {
  try {
    return wholeRounds(at.cwd, ref);
  } catch (err) {
    at.warnings.push(`${taskName(ref)}'s rounds cannot be read — ${messageOf(err)}`);
    return null;
  }
}

/** How a round ended, as a task's page says it with no account: passed, settled, or sent back with what its reports found. @param {import('../round-report.cjs').Round} round */
function roundSummary({ reports, passes, settled }) {
  if (passes) return 'passed';
  if (settled) return 'settled by the orchestrator';
  return `${counted(reports.reduce((sum, { findings }) => sum + findings.length, 0), 'finding')}, sent back`;
}

/** A task's reviews: its account's summaries, or with none its rounds reported whole (20.5.6). @param {BoardAt} at @param {import('../task-id.cjs').TaskRef} ref @param {ReturnType<typeof takenAccount>} account */
function reviewsOf(at, ref, account) {
  if (account !== null) return account.reviews.map(({ heading, summary }) => ({ round: heading, summary }));
  return (roundsRead(at, ref) ?? []).map((round) => ({ round: `Round ${round.round}`, summary: roundSummary(round) }));
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
    reviews: reviewsOf(at, ref, account),
    calls: callsOf(at.cwd, ref),
    ran: ranOf(at.cwd, at.manifest, ref, task, criteria).ran,
    questions: buildRead(at).questions.filter(({ parks }) => parks.some(({ task: parked }) => parked === given)),
    fixes: recordedRounds(at.cwd, at.unit).flatMap(({ findings }, r) => findings.flatMap(({ fix, area, call, text }, k) => (fix === given ? [{ round: r + 1, finding: k + 1, from: null, area, call, text }] : []))),
  };
}

/**
 * A scenario's words as the unit's spec holds them, the statements they
 * cite left out, the spec read once a call; null where it lacks them.
 * @param {BoardAt} at @param {string} scenario @returns {string|null}
 */
function scenarioWording(at, scenario) {
  const lines = at.once('spec-lines', () => {
    const file = specPath(at.cwd, at.unit);
    return fs.existsSync(file) ? specReading(fs.readFileSync(file, 'utf8')).lines : [];
  });
  return lines.find(({ kind, number }) => kind === 'scenario' && number === scenario)?.wording.replace(DRAWS_ON, '').trimEnd() ?? null;
}

/** Where a scenario's words turn from what is done to what follows: its first "then". */
const THEN = /,\s+then\s+/i;

/** A scenario's words as what its run drives and what it checks; all of them driven where no "then" parts them. @param {string|null} words */
function drivenAndChecked(words) {
  const at = words === null ? null : THEN.exec(words);
  if (words === null || at === null) return { drive: words, check: null };
  return { drive: words.slice(0, at.index), check: words.slice(at.index + at[0].length) };
}

/**
 * A scenario of a task, with the run that decides what running the product
 * proved of it at the tips of the task's branch (`ranOf`'s), none run where
 * it has none yet; refused where the task holds no such scenario.
 * @param {BoardAt} at @param {string} given @param {string} scenario
 */
function taskScenario(at, given, scenario) {
  const ref = parseShownTask(at.unit, given);
  const task = pageTask(at, ref);
  if (!holdsScenario(task.text, scenario)) throw new Error(`${taskName(ref)} holds no scenario ${scenario}`);
  return { task, ...runsAt(at.cwd, at.unit, scenario, taskHead(at.cwd, at.manifest, ref, task)) };
}

/** The lines a text evidence holds. @param {string} text */
const linesIn = (text) => text.replace(/\n$/, '').split('\n').length;

/**
 * A scenario of a task read in full (15.2.14): what running the product
 * proved of it, when the run that decides was recorded, null where none
 * was run, what it drives and checks, and the text evidence kept with it.
 * @param {BoardAt} at @param {string} given @param {string} scenario @returns {import('../board-model.cjs').ScenarioPage}
 */
function scenarioPage(at, given, scenario) {
  const { task, standing, decided } = taskScenario(at, given, scenario);
  const criterion = criteriaTexts(task.text).find((held) => namesScenario(held, scenario)) ?? scenario;
  return {
    kind: 'scenario',
    unit: at.unit,
    task: given,
    title: task.title,
    scenario,
    criterion: criterionWords(criterion),
    standing,
    at: decided?.at ?? null,
    ...drivenAndChecked(scenarioWording(at, scenario)),
    evidence: (decided?.evidence ?? []).map(({ name, text }) => ({ name, lines: linesIn(text) })),
  };
}

/**
 * A text evidence of the run that decides a scenario, by its place among
 * them, read whole; refused where that run holds none there.
 * @param {BoardAt} at @param {string} given @param {string} scenario @param {string} k @returns {import('../board-model.cjs').EvidencePage}
 */
function evidencePage(at, given, scenario, k) {
  const held = taskScenario(at, given, scenario).decided?.evidence[Number(k) - 1];
  if (held === undefined) throw new Error(`no run of ${scenario} keeps an evidence ${k}`);
  return { kind: 'evidence', unit: at.unit, task: given, scenario, name: held.name, text: held.text };
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

/** How far the build has come while the tracker holds none of its tasks yet, as the start menu says it (progress.cjs); null once it holds one. @param {BoardAt} at */
const untasked = (at) => buildRead(at).view.progress.untasked;

/** How far the build has come, as All work says it: its tasks done of all, or the start menu's words before it has any. @param {BoardAt} at */
function buildWords(at) {
  const { progress } = buildRead(at).view;
  return untasked(at) ?? `${progress.done} of ${counted(progress.total, 'task')} done`;
}

module.exports = {
  buildRead, buildView, buildBanner, taskLine, taskPage, writtenPage, roundPage, scenarioPage, evidencePage, scenarioWording, untasked, buildWords, buildMoments, standingAt, readingAt, reviewStandingAt, questionsOf, roundsRead,
};
