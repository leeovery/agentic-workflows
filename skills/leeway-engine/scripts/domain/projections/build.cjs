'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the build as the person sees it in the conversation (12.12),
// drawn from where the build stands (build-entry.cjs) and a task's records
// (build-screens.cjs) — the same whatever order Claude works in (12.12.2):
// - the step marker, `□ Build (phase N of M) · {position}`, the phase the
//   first of the build's not yet closed — once the cut is through, one of
//   the review's fixes, `□ Build (the review's fixes, round k) · {position}`
//   (3.3.10);
// - the headline as work starts: the tasks started together in one block,
//   each with its number, title and phase, what it is about to change and
//   what to watch when it lands, those two Claude's (12.12.4);
// - the landing summary: what changed, the criteria its tests prove, what
//   running the product proved of its scenarios with the proof a press away
//   on the board, the pair's verdict and rounds and the calls it sent to the
//   ledger — and beneath it, every time, the questions waiting, counted,
//   then a line each (12.12.5); no review report (12.12.6);
// - a task's account: its title, phase and place in it, its verdict, what it
//   does, what was done with the engine's figures, every way it differs
//   from the task, and, printed when asked, each round's summary (12.14.1,
//   12.14.2); one with no account says so, and whether it closed without;
// - the gate after a task in step, the account above it (12.14.3); and the
//   gate before a phase's stack merges in step (7.2.4);
// - the stop report, when nothing can go on without an answer: the
//   questions front and centre, what was built, and what each answer lets
//   run (12.12.9, 12.13.22);
// - the build's phases and tasks, each with its state and what holds it,
//   a phase not yet written drawn from the cut, the review's fix phases
//   after it, and in step a task behind the task in flight, or at its gate
//   until the person's go there, running no more (12.12.11, 7.4.2, 12.7.9).
// A phase whose review owes fixes says so in the standing's words, on the
// progress and the stop alike. Nothing here counts a measure (17.2.2).
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, promptOption, treeList, emitAs, MENU_INSTRUCTION, CONTINUE_INSTRUCTION, CONTINUE_MARKDOWN_INSTRUCTION } = require('./surfaces.cjs');
const { renderTree, wrapWithPrefix } = require('../../kernel/render.cjs');
const { TREE_WIDTH } = require('../conventions.cjs');
const { counted } = require('./map.cjs');
const { block } = require('./closing.cjs');
const { cutCount } = require('../build-entry.cjs');
const { STATUS_WORDS } = require('../task-verbs.cjs');

/** @typedef {import('./surfaces.cjs').Next} Next */
/** @typedef {import('../build-entry.cjs').BuildStanding} BuildStanding */
/** @typedef {import('../build-entry.cjs').StandingPhase} StandingPhase */
/** @typedef {import('../build-entry.cjs').StandingTask} StandingTask */
/** @typedef {import('../questions.cjs').Waiting} Waiting */

/** A task as a screen names it: its number, title, and its phase's number and name. @typedef {{task: string, title: string, phase: number, phase_name: string}} TaskHead */
/** A task started, with what Claude says of it. @typedef {TaskHead & {changes: string, watch: string}} Started */
/** How a task's review ended: its rounds, and whether the orchestrator settled the last. @typedef {{rounds: number, settled: boolean}} Reviewed */
/** One of a task's cut scenarios, by its id and as its criterion reads, and what running it proved. @typedef {{scenario: string, criterion: string, standing: import('../runs.cjs').Standing}} Ran */
/**
 * A task landing: the task, how its review ended, the calls it sent to the
 * ledger, what changed, its criteria, what running the product proved of
 * its scenarios of the cut — null where it holds none — with whether any
 * run was recorded, and the questions waiting.
 * @typedef {{head: TaskHead, reviewed: Reviewed, calls: number, changed: string, criteria: string[], product: string, ran: Ran[]|null, recorded: boolean, waiting: Waiting[]}} Landing
 */
/** Whether another unit is finished, by its name. @typedef {(unit: string) => boolean} Finished */
/** The engine's figures of a task, with when it started and finished (task-account.cjs). @typedef {{files: number, added: number, removed: number, criteria: number, started: string|null, finished: string}} Figures */
/**
 * A task's account as a screen draws it: the task, its place in its phase,
 * what it does, whether it closed, and its account where one is written —
 * its sections, its differences, its rounds' summaries by their headings,
 * how its review ended and its figures.
 * @typedef {{
 *   head: TaskHead, at: number, of: number, does: string, closed: boolean,
 *   account: {sections: Record<string, string>, differences: string[], reviews: {heading: string, summary: string}[], reviewed: Reviewed, figures: Figures}|null,
 * }} AccountView
 */

/** The width every display here wraps to. */
const WIDTH = TREE_WIDTH;

/** A task's glyph by its state. @type {Readonly<Record<string, string>>} */
const TASK_GLYPH = Object.freeze({ open: '○', 'in-progress': '◐', behind: '◌', 'at-gate': '●', done: '✓', closed: '⊘' });

/** Whether a phase has closed, merged or not. @param {StandingPhase} phase */
const closedPhase = ({ state }) => state === 'closed' || state === 'merged';

/** The phase the build is at: the first not closed, else its last. @param {BuildStanding} standing @returns {StandingPhase} */
function currentPhase({ phases }) {
  return phases.find((phase) => !closedPhase(phase)) ?? phases[phases.length - 1];
}

/** A phase's number as the marker and the tree give it: one of the cut's with the cut's count, a fix phase's alone. @param {StandingPhase} phase @param {number} of */
const numbered = ({ phase, round }, of) => (round === null ? `${phase} of ${of}` : `${phase}`);

/** The step marker, naming the build's phase — a fix phase by its round — and position (3.3.10). @param {BuildStanding} standing */
function markerSection(standing) {
  const current = currentPhase(standing);
  const at = current.round === null ? `phase ${numbered(current, cutCount(standing))}` : current.name;
  return section('DISPLAY: build marker', CONTINUE_MARKDOWN_INSTRUCTION, `**\`□ Build (${at}) · ${standing.position}\`**`);
}

/** Text wrapped at the display's width beneath `indent`, its lines after the first `hang` further in. @param {string} text @param {string} indent @param {number} [hang] */
const wrapped = (text, indent, hang = 0) => wrapWithPrefix(text, { width: WIDTH, prefix: indent, hang });

/** A task as a marker names it. @param {TaskHead} head */
const taskMarker = ({ task, title }) => `▪ ${title} (task ${task})`;

/**
 * Markdown Claude wrote, drawn in a text block at `indent`: each paragraph
 * wrapped, each list item a `·` line — every paragraph one where `dotted`,
 * a fenced block then under the dots' text — and a fenced block's lines as
 * written, its fences dropped, so a diagram keeps its shape.
 * @param {string} markdown @param {string} indent @param {{dotted?: boolean}} [opts]
 */
function prose(markdown, indent, { dotted = false } = {}) {
  /** @type {string[]} */
  const out = [];
  /** @type {string[]} */
  let words = [];
  let item = dotted;
  const flush = () => {
    if (words.length > 0) out.push(...(item ? wrapped(`· ${words.join(' ')}`, indent, 2) : wrapped(words.join(' '), indent)));
    words = [];
    item = dotted;
  };
  let fenced = false;
  for (const line of markdown.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      flush();
      fenced = !fenced;
    } else if (fenced) {
      out.push(`${indent}${dotted ? '  ' : ''}${line}`);
    } else if (line.trim() === '') {
      flush();
    } else if (/^(?:[-*+]|[0-9]+[.)])[ \t]+/.test(line)) {
      flush();
      item = true;
      words.push(line.replace(/^(?:[-*+]|[0-9]+[.)])[ \t]+/, '').trim());
    } else {
      words.push(line.trim());
    }
  }
  flush();
  return out;
}

/** The tasks a question parks, as its line says them. @param {string[]} parks */
function parksWords(parks) {
  if (parks.length === 0) return 'parks no task';
  return `parks ${parks[0]}${parks.length > 1 ? ` and ${parks.length - 1} more` : ''}`;
}

/** The questions waiting, counted, then a line each (12.12.5, 12.13.7). @param {Waiting[]} waiting */
function waitingBlock(waiting) {
  const heading = `${waiting.length === 0 ? 'NO' : waiting.length} ${waiting.length === 1 ? 'QUESTION' : 'QUESTIONS'} WAITING FOR YOU`;
  if (waiting.length === 0) return heading;
  return block(heading, treeList(waiting.map(({ question, asks, parks }) => `⚑ ${question} ${asks} · ${parksWords(parks)}`), { indent: '  ', width: WIDTH }));
}

/** The round a task's review ended in, and the rounds of fixes before a pass. @param {Reviewed} reviewed */
function roundWords({ rounds, settled }) {
  return settled || rounds === 1 ? `in round ${rounds}` : `in round ${rounds}, after ${counted(rounds - 1, 'round')} of fixes`;
}

/** How a task's review ended, as the landing says it. @param {Reviewed} reviewed */
function landedVerdict(reviewed) {
  return reviewed.settled ? `the orchestrator settled its review ${roundWords(reviewed)}` : `its reviewer pair passed it ${roundWords(reviewed)}`;
}

/** The calls a task sent to the ledger, as the landing says them. @param {number} calls */
const callsWords = (calls) => `${calls === 0 ? 'no' : calls} ${calls === 1 ? 'call' : 'calls'} went to the ledger`;

/** What running the product proved of the task's scenarios, the proof a press away (15.2.14). @param {Landing} landing */
function ranBlock({ head, product, ran, recorded }) {
  const shown = /** @type {Ran[]} */ (ran);
  const proven = shown.filter(({ standing }) => standing === 'proven').length;
  const short = shown.filter(({ standing }) => standing !== 'proven').map(({ criterion, standing }) => `△ ${standing === 'not proven' ? 'Not proven' : 'Named, not run'}: ${criterion}`);
  const lines = [
    ...(short.length === 0 ? [] : [treeList(short, { indent: '  ', width: WIDTH })]),
    ...(recorded ? [`  ↳ The proof is on ${head.task}'s page on the board.`] : []),
  ];
  const heading = `RUNNING ${product.toUpperCase()} PROVED ${proven} OF ${shown.length}`;
  return lines.length === 0 ? heading : block(heading, lines.join('\n'));
}

/**
 * The landing summary (12.12.5), the questions waiting beneath it.
 * @param {Landing} landing
 */
function landingScreen(landing) {
  const { head, reviewed, calls, changed, criteria, ran, waiting } = landing;
  const blocks = [
    taskMarker(head),
    wrapped(`✓ Landed — ${landedVerdict(reviewed)} · ${callsWords(calls)}`, '', 2).join('\n'),
    block('WHAT CHANGED', prose(changed, '  ').join('\n')),
    ...(criteria.length === 0 ? [] : [block(`ITS TESTS PROVE (${criteria.length})`, treeList(criteria, { indent: '  ', width: WIDTH }))]),
    ...(ran === null ? [] : [ranBlock(landing)]),
    waitingBlock(waiting),
  ];
  return section('DISPLAY: task landed', CONTINUE_INSTRUCTION, blocks.join('\n\n'));
}

/** How a task's review ended, as its account says it. @param {Reviewed} reviewed */
function accountVerdict(reviewed) {
  return `${reviewed.settled ? '✓ Settled by the orchestrator' : '✓ Passed its review'} ${roundWords(reviewed)}`;
}

/** What was done, where in the code and what the tests prove, then the engine's figures. @param {NonNullable<AccountView['account']>} account */
function doneBlock({ sections, figures }) {
  const { criteria, files, added, removed } = figures;
  return block('WHAT WAS DONE', [
    ...prose(sections['What was done'], '  '),
    ...prose(sections['Where in the code'], '  ', { dotted: true }),
    ...prose(sections['What the tests prove'], '  ', { dotted: true }),
    `  ✓ Proves ${counted(criteria, 'criterion', 'criteria')} · ${counted(files, 'file')} changed · +${added} −${removed}`,
  ].join('\n'));
}

/** Every way the work differs from the task, or that none does. @param {string[]} differences */
function differsBlock(differences) {
  if (differences.length === 0) return block('DIFFERS FROM THE TASK', '  Nothing: it was built as the task was written.');
  return block(`DIFFERS FROM THE TASK (${differences.length})`, differences.flatMap((difference) => wrapped(`△ ${difference}`, '  ', 2)).join('\n'));
}

/** Each round's summary, under its heading. @param {{heading: string, summary: string}[]} reviews */
function reviewsBlock(reviews) {
  return block('REVIEWS', reviews.flatMap(({ heading, summary }) => [`  ${heading}`, ...prose(summary, '    ')]).join('\n'));
}

/**
 * A task's account as drawn (12.14.2, 12.14.3): its rounds' summaries only
 * where `reviews`.
 * @param {AccountView} view @param {{reviews: boolean}} opts
 */
function accountDisplay({ head, at, of, does, closed, account }, { reviews }) {
  const blocks = [
    taskMarker(head),
    ...(account === null ? [] : [accountVerdict(account.reviewed)]),
    [`- Phase: ${head.phase} — ${head.phase_name}`, `- Position: ${at} of ${of} in phase`].join('\n'),
    block('WHAT IT DOES', prose(does, '  ').join('\n')),
  ];
  if (account === null) {
    blocks.push(closed ? '  No account was written: it closed without one.' : '  No account is written yet: its builder writes it as the task lands.');
  } else {
    blocks.push(doneBlock(account), differsBlock(account.differences));
    if (reviews) blocks.push(reviewsBlock(account.reviews));
  }
  return blocks.join('\n\n');
}

/** A task's account, printed when asked (12.14.1, 12.14.2). @param {AccountView} view */
function accountScreen(view) {
  return section('DISPLAY: task account', CONTINUE_INSTRUCTION, accountDisplay(view, { reviews: true }));
}

/**
 * The gate after a task in step, its account above it (12.14.3): yes goes
 * on to the next task; auto approves it and switches the build to auto
 * through its door (3.3.6); the technical retelling and the diagrams are
 * Claude's, each bringing the gate back after it; a question or a change is
 * typed.
 * @param {string} unit @param {AccountView} view
 */
function stepGateScreen(unit, view) {
  const display = section('DISPLAY: step gate', CONTINUE_INSTRUCTION, accountDisplay(view, { reviews: false }));
  const go = { next: /** @type {Next} */ ({ kind: 'continue' }) };
  const again = { next: /** @type {Next} */ ({ kind: 'engine', argv: ['render', 'step-gate', unit, view.head.task] }) };
  return display + section(`MENU: step gate — ${view.head.task}`, MENU_INSTRUCTION, menu('', [
    cmdOption('y', 'yes', 'Approve it and continue to the next task', go),
    cmdOption('a', 'auto', 'Approve it and run the rest of the build in auto', { next: { kind: 'engine', argv: ['workunit', 'position', unit, 'auto'] } }),
    cmdOption('t', 'technical', 'Retell the result from the code\'s perspective', again),
    cmdOption('s', 'show', 'Show the result as diagrams', again),
    promptOption('Ask', 'Ask questions about the task (doesn\'t approve or reject)'),
    promptOption('Comment', 'Request changes'),
  ], { question: 'Approve this task?' }));
}

/**
 * The gate before a phase's stack merges, in step (7.2.4): yes merges it.
 * @param {string} unit @param {number} phase @param {string} name
 */
function phaseMergeGateScreen(unit, phase, name) {
  return section(`MENU: phase merge — ${phase}`, MENU_INSTRUCTION, menu(`Phase ${phase}, "${name}", is ready to merge: its tasks land on the default branch as one stack.`, [
    cmdOption('y', 'yes', 'Merge it and carry on with the build', { next: { kind: 'engine', argv: ['land', 'phase', unit, String(phase)] } }),
    promptOption('Comment', 'Tell me what to change before it merges'),
  ], { question: `Merge phase ${phase}?` }));
}

/** The tasks started together, one block (12.12.4). @param {BuildStanding} standing @param {Started[]} started */
function headlineScreen(standing, started) {
  const tree = renderTree(started.map(({ task, title, phase, phase_name: name, changes, watch }) => ({
    title: `${task} ${title}`,
    body: [`Phase ${phase} · ${name}`, { text: `About to change: ${changes}`, hang: 2 }, { text: `Watch when it lands: ${watch}`, hang: 2 }],
  })), { width: WIDTH, gap: true, wrapTitles: true });
  return markerSection(standing) + section('DISPLAY: build headline', CONTINUE_INSTRUCTION, `▪ Starting ${counted(started.length, 'task')}\n\n${tree}`);
}

/** What holds a task, or where it stands. @param {StandingTask} task */
function taskTag({ status, parked, after }) {
  if (parked.length > 0) return `waits on ${parked.join(', ')}`;
  if (status === 'open' && after.length > 0) return `after ${after.join(', ')}`;
  return STATUS_WORDS[status];
}

/**
 * What holds a phase, or where it stands: one written waits on what it
 * relies on not yet done — a phase of the cut not merged, another unit not
 * finished.
 * @param {StandingPhase} phase @param {BuildStanding} standing @param {Finished} finished
 */
function phaseTag({ state, relies_on: reliesOn }, { phases }, finished) {
  const phasesWaited = reliesOn.filter((relied) => typeof relied === 'number' && phases[relied - 1]?.state !== 'merged');
  const unitsWaited = reliesOn.filter((relied) => typeof relied === 'string' && !finished(relied));
  const waits = [...(phasesWaited.length === 0 ? [] : [`phase ${phasesWaited.join(', ')}`]), ...unitsWaited];
  return state === 'written' && waits.length > 0 ? `written · after ${waits.join(', ')}` : state;
}

/** Each phase of the build with its tasks and what holds each, a phase's owed fixes beneath it. @param {BuildStanding} standing @param {Finished} finished */
function phaseTree(standing, finished) {
  const of = cutCount(standing);
  return renderTree(standing.phases.map((phase) => ({
    title: `Phase ${numbered(phase, of)} · ${phase.name}`,
    tag: phaseTag(phase, standing, finished),
    body: phase.fixes_owed.map((owed) => ({ text: `⚑ fixes owed: ${owed}`, hang: 2 })),
    children: phase.tasks.map((task) => ({ title: `${task.parked.length > 0 ? '⚑' : TASK_GLYPH[task.status]} ${task.task} ${task.title}`, tag: taskTag(task) })),
  })), { width: WIDTH, gap: true, wrapTitles: true });
}

/** The tasks of the build's written phases not closed: how many are done, and how many run. @param {BuildStanding} standing */
function taskCounts({ phases }) {
  const tasks = phases.flatMap(({ tasks: held }) => held).filter(({ status }) => status !== 'closed');
  const running = tasks.filter(({ status, parked }) => status === 'in-progress' && parked.length === 0).length;
  return `${tasks.filter(({ status }) => status === 'done').length} of ${counted(tasks.length, 'task')} done · ${running} running`;
}

/** The build's phases and tasks, each with its state and what holds it (12.12.11). @param {BuildStanding} standing @param {Finished} finished */
function progressScreen(standing, finished) {
  return markerSection(standing) + section('DISPLAY: build progress', CONTINUE_INSTRUCTION, `${taskCounts(standing)}\n\n${phaseTree(standing, finished)}`);
}

/** Each question's tasks, and the tasks waiting after those, that its answer lets run. @param {BuildStanding} standing */
function afterAnswers(standing) {
  const tasks = standing.phases.flatMap(({ tasks: held }) => held);
  const titled = new Map(tasks.map(({ task, title }) => [task, title]));
  return renderTree(standing.waiting.map(({ question, parks }) => {
    const then = tasks.filter(({ after }) => after.some((task) => parks.includes(task))).map(({ task }) => task);
    return {
      title: question,
      body: [
        ...parks.map((task) => ({ text: `${task} ${titled.get(task) ?? ''}`.trim(), hang: task.length + 1 })),
        ...(then.length === 0 ? [] : [`then ${then.join(', ')}`]),
      ],
    };
  }), { width: WIDTH });
}

/**
 * The stop report, when nothing can go on without an answer (12.12.9): the
 * build stopped, the questions waiting first, what was built, and what each
 * answer lets run.
 * @param {BuildStanding} standing @param {Finished} finished
 */
function stopScreen(standing, finished) {
  const stopped = section('DISPLAY: build stop', emitAs('properties'), '⚑ The build has stopped: nothing more can be built until you answer');
  const report = [
    waitingBlock(standing.waiting),
    block('WHAT WAS BUILT', `  ${taskCounts(standing)}\n${phaseTree(standing, finished)}`),
    block('WHAT RUNS ONCE YOU ANSWER', afterAnswers(standing)),
  ].join('\n\n');
  return markerSection(standing) + stopped + section('DISPLAY: build stop report', CONTINUE_INSTRUCTION, report);
}

module.exports = { landingScreen, accountScreen, stepGateScreen, phaseMergeGateScreen, headlineScreen, progressScreen, stopScreen };
