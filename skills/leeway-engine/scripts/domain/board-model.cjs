'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the workflows board's view model (§20) — the contract
// between `engine board` (board.cjs) and the gate mod's pane and banner,
// which draws it and refuses a version it does not know rather than draw
// it wrongly. A change of any shape here raises `BOARD_VERSION`.
//
// It carries kinds, states, counts, times and the records' own words; never
// a colour, a mark or a layout, which are the mod's (20.4.1), and never a
// clock's reading: what runs carries the time it began, ISO, and the mod
// turns its clock (20.4.8). Every list is in the order the board draws it.
//
// - The board: the version; where the session is (`place`); the banner
//   (20.2.4); the unit the second tab names, by its key and title, null at
//   the start menu (20.3.1); the tab answered and the view or page it shows
//   (20.3.3); the questions of the session's unit a press can queue (20.6),
//   which the banner, every WAITING ON YOU and READY TO DISCUSS draw from;
//   and what the reads warned of.
// - A page is asked for by its ref (`--page`), resolved against the tab's
//   unit whatever phase the session is in, so a page stays while the
//   session moves beneath it (20.3.5): `task:{N.n}`, `task:{N.n}:written`,
//   `task:{N.n}:round:{k}`, `entry:{id}`, `finding:{round}:{k}`,
//   `section:{n}`, `topic:{topic}`, `unit:{unit}`. The way back is the
//   mod's, which knows where the page was opened from.
// ---------------------------------------------------------------------------

/** The view model's version (the header's). */
const BOARD_VERSION = 1;

/** The board's tabs (20.3.1). */
const TABS = Object.freeze(['this', 'unit', 'all']);

/**
 * Where the session is, as its position records it: a unit, its type, the
 * phase and topic it works in — each null where it is at none; all null at
 * the start menu or a project-level place.
 * @typedef {{unit: string|null, type: string|null, phase: string|null, topic: string|null}} Place
 */

/** A banner's state: running, waiting on the person, done, or neither. @typedef {'running'|'needs'|'done'|'idle'} BannerState */
/** A fact on the banner: its words, and whether it waits on the person. @typedef {{text: string, needs: boolean}} Fact */
/**
 * The banner (20.2.4): its state, the work's name, and its facts in order.
 * Its buttons are the mod's, from the board's questions and its own queue.
 * @typedef {{state: BannerState, name: string, facts: Fact[]}} Banner
 */

/**
 * A question waiting on the person a press can queue (12.13, 20.5.3): its
 * number, what it asks, each task it parks with its title, the tasks
 * waiting after those, and when it parked.
 * @typedef {{question: string, asks: string, parks: {task: string, title: string}[], after: string[], since: string}} Question
 */

/**
 * A task's state on the board (20.4.9, 20.5.2): done; building or in review,
 * clocked from the brief issued for it in this conversation (P15); failed;
 * waiting on a question; after another task; not started; closed without
 * being done.
 * @typedef {'done'|'building'|'in-review'|'failed'|'waits'|'after'|'not-started'|'closed'} TaskState
 */
/**
 * A task's line: its number, title and state; since when it runs, where it
 * builds or is in review with a clock, else null; and what holds it — the
 * questions for one waiting, the tasks for one after others, else none.
 * @typedef {{task: string, title: string, state: TaskState, since: string|null, on: string[]}} TaskLine
 */
/** A phase's state on the board: not yet written, written, running, complete (every task done). @typedef {'not-written'|'written'|'running'|'complete'} PhaseState */
/** A phase of the cut: its number, name, state, tasks done of its tasks, and its tasks. @typedef {{phase: number, name: string, state: PhaseState, done: number, total: number, tasks: TaskLine[]}} BuildPhase */
/**
 * The build's This session (20.5.1–20.5.3): the unit, its title and type;
 * the progress — tasks done of the tasks, the phase it is at of the cut's,
 * how many run, and whether it has stopped, every task waiting on the
 * person; the questions waiting, by number; and every phase of the cut.
 * @typedef {{
 *   kind: 'build', unit: string, title: string, type: string,
 *   progress: {done: number, total: number, phase: number, phases: number, running: number, stopped: boolean},
 *   waiting: string[], phases: BuildPhase[],
 * }} BuildView
 */

/** The engine's figures of a task's work. @typedef {{files: number, added: number, removed: number, criteria: number}} Figures */
/** What running the product proved of one of a task's scenarios (15.2.14). @typedef {{scenario: string, criterion: string, standing: string}} Ran */
/**
 * A task's page (20.5.4–20.5.6): its line; its phase; when it started, null
 * where it never has; what it does and its count of acceptance criteria;
 * its account, null where none is taken, a closed task saying whether it
 * closed without; each round's summary; each call it made; what running the
 * product proved of its scenarios, null where it holds none; and the
 * question parking it, by number, else null.
 * @typedef {{
 *   kind: 'task', unit: string, phase: number, phase_name: string, line: TaskLine, started: string|null,
 *   does: string, criteria: number,
 *   account: {done: string, where: string, tests: string, differences: string[], figures: Figures}|null,
 *   reviews: {round: string, summary: string}[], calls: {id: string, text: string}[], ran: Ran[]|null, question: string|null,
 * }} TaskPage
 */
/** The task as written: its number, title and each section by its heading. @typedef {{kind: 'task-written', unit: string, task: string, title: string, sections: {heading: string, text: string}[]}} WrittenPage */
/** A round of a task's review read in full: each reviewer's report by its letter. @typedef {{kind: 'task-round', unit: string, task: string, title: string, round: number, reports: {letter: string, text: string}[]}} RoundPage */
/**
 * An entry of the ledger read in full: what it is, whose, its words and why,
 * and the question it answers, where it answers one.
 * @typedef {{kind: 'entry', unit: string, id: string, entry: string, by: string, text: string, why: string|null, question: string|null}} EntryPage
 */

/** An area's state in a round: read, being read, waiting, or not read again (20.10.2). @typedef {'read'|'reading'|'waiting'|'unchanged'} AreaState */
/**
 * An area of a round, or the reader over the tests (`tests`): its number
 * and title, its state, what it found, and since when it is read, else null.
 * @typedef {{area: string, title: string, state: AreaState, found: number, since: string|null}} AreaLine
 */
/** A finding of a recorded round: its number in the round, its area and words. @typedef {{finding: number, area: string, text: string}} FoundLine */
/**
 * The review phase's This session (20.10): the unit, its title and type,
 * how many tasks were built; the round under way, whether it is recorded,
 * and each of its areas; once recorded, each finding in scope, each check
 * not proven, what went to the inbox and its verdict; and the fix tasks of
 * the round before, or of this one once recorded failing, as the build's
 * phase they make, null where there are none.
 * @typedef {{
 *   kind: 'review', unit: string, title: string, type: string, built: number,
 *   round: number, recorded: boolean, areas: AreaLine[],
 *   found: FoundLine[], not_proven: string[], inbox: string[], verdict: 'passed'|'failed'|'settled'|null,
 *   fixes: {phase: number, round: number, tasks: TaskLine[]}|null,
 * }} ReviewView
 */
/** A finding read in full: its round, area, scope, call, words, and the fix task or inbox item it went to. @typedef {{kind: 'finding', unit: string, round: number, finding: number, area: string, scope: string, call: string, text: string, fix: string|null, inbox: string|null}} FindingPage */

/** An open question of the person's on a topic: its entry, words, the topic whose message it came as, and the experiment it waits on. @typedef {{id: string, text: string, from: string|null, experiment: {id: string, running: boolean}|null}} OpenLine */
/** A decision on a topic: its entry, the question's words, and whose it is. @typedef {{id: string, text: string, who: 'yours'|'claude'|'carried'}} DecidedLine */
/** A call of Claude's since the person last looked: its entry, its words and the question it answers. @typedef {{id: string, text: string, question: string|null}} CallLine */
/**
 * A discussion's This session (20.7.1): the unit, its title and type; the
 * topic and its title; the person's questions decided of theirs and Claude's
 * calls; what of theirs is still open; the messages waiting, each by its
 * file, title, sender and day; Claude's calls since the person last looked,
 * read without looking (5.8.14); every decision; and what the topic sent.
 * @typedef {{
 *   kind: 'discussion', unit: string, title: string, type: string, topic: string, topic_title: string,
 *   progress: {decided: number, yours: number, calls: number},
 *   open: OpenLine[], messages: {file: string, title: string, from: string, when: string}[], since: CallLine[],
 *   decided: DecidedLine[], sent: {title: string, to: string, when: string, waiting: boolean}[],
 * }} DiscussionView
 */

/**
 * A specification's This session (20.9.1): the unit, its title and type;
 * each section by its number and title; the review's passes, newest first,
 * each with what it found and whether it still runs; what waits on the
 * person, each asked in the conversation; Claude's calls since the calls
 * list was last drawn in the conversation, read without looking (5.8.14);
 * the phases cut, each with its scenario count and the sections it draws
 * on; and what ready to build waits on — the review settling, or the
 * person's yes.
 * @typedef {{
 *   kind: 'spec', unit: string, title: string, type: string, sections: {number: string, title: string}[],
 *   passes: {pass: number, found: number, running: boolean}[], waiting: string[], since: CallLine[],
 *   cut: {phase: number, name: string, scenarios: number, sections: string[]}[], ready: 'review'|'person',
 * }} SpecView
 */
/** A section read in full: its number, title and text. @typedef {{kind: 'section', unit: string, number: string, title: string, text: string}} SectionPage */

/** A topic on the map: its key, title and summary. @typedef {{topic: string, title: string, summary: string}} MapLine */
/**
 * Discovery's This session (20.11.1): the unit, its title and type; its
 * session's number and when it started; whether approve the map waits on
 * the person; the map's topics in order; and what goes to the roadmap, each
 * with its horizon.
 * @typedef {{
 *   kind: 'discovery', unit: string, title: string, type: string, session: number|null, started: string|null,
 *   waits: boolean, map: MapLine[], roadmap: {title: string, horizon: string}[],
 * }} DiscoveryView
 */
/** A topic's brief (20.11.2): its place on the map of how many, its summary, and the brief's text. @typedef {{kind: 'brief', unit: string, topic: string, title: string, order: number|null, of: number, summary: string, brief: string}} BriefPage */

/**
 * An experiment's This session (20.13): the unit, its title and type; its
 * id and question; the topic it serves; where it stands, with its verdict
 * once concluded and its reason once abandoned.
 * @typedef {{
 *   kind: 'experiment', unit: string, title: string, type: string, id: string, question: string, topic: string, topic_title: string,
 *   status: string, verdict: string|null, reason: string|null,
 * }} ExperimentView
 */

/** A topic's state on the epic's page. @typedef {'decided'|'discussing'|'next'|'not-started'} TopicState */
/**
 * A topic on the epic's page: its key, title and state; its person's
 * questions decided of all; whether a session is in it, this one or
 * another, else null; its messages waiting; and the experiment it waits on.
 * @typedef {{
 *   topic: string, title: string, state: TopicState, decided: number, total: number,
 *   session: 'this'|'other'|null, messages: number, experiment: {id: string, status: string}|null,
 * }} TopicLine
 */
/**
 * The epic's page (20.8, 20.15.2): the unit, its title and what it is for;
 * whether the session is at its menu; its topics decided of all, and how
 * many are in discussion; its topics in the map's order; the specification
 * and the build, each by where it stands; and the topics set aside.
 * @typedef {{
 *   kind: 'epic', unit: string, title: string, about: string, at_menu: boolean,
 *   progress: {decided: number, total: number, discussing: number},
 *   topics: TopicLine[], spec: 'waits'|'running'|'complete', build: 'waits'|'running'|'complete',
 *   set_aside: {topic: string, title: string, state: 'cancelled'|'postponed', horizon: string|null}[],
 * }} EpicView
 */

/** A phase on a unit's tab: its name, its state, and its standing's words. @typedef {{phase: string, state: 'complete'|'running'|'waits'|'later', words: string}} UnitPhase */
/**
 * A linear unit's tab (20.15.1): the unit, its title, type and what it is
 * for; whether the session is at its menu; its phases complete of all; and
 * each phase from discovery to review.
 * @typedef {{
 *   kind: 'unit', unit: string, title: string, type: string, about: string, at_menu: boolean,
 *   progress: {complete: number, total: number}, phases: UnitPhase[],
 * }} UnitView
 */

/**
 * A unit on All work: its key, title, type and phase; how far it has come;
 * how many questions wait on the person in it; and whether a session is in
 * it, this one or another.
 * @typedef {{unit: string, title: string, type: string, phase: string, standing: string, waiting: number, session: 'this'|'other'|null}} WorkLine
 */
/**
 * All work (20.16): the project; whether the session is at the start menu;
 * the units in progress; the roadmap's waiting items by horizon; the inbox
 * by kind; and the units complete.
 * @typedef {{
 *   kind: 'all', project: string, at_start: boolean, units: WorkLine[],
 *   roadmap: {horizon: string, items: {title: string, from: string|null}[]}[],
 *   inbox: {kind: string, title: string}[], complete: {unit: string, title: string, type: string}[],
 * }} AllView
 */

/**
 * A view or page the board shows.
 * @typedef {BuildView|TaskPage|WrittenPage|RoundPage|EntryPage|ReviewView|FindingPage|DiscussionView|SpecView|SectionPage
 *   |DiscoveryView|BriefPage|ExperimentView|EpicView|UnitView|AllView} View
 */

/**
 * The board's view model (the header's).
 * @typedef {{
 *   version: number, place: Place, banner: Banner|null, unit: {unit: string, title: string}|null,
 *   tab: 'this'|'unit'|'all', view: View, questions: Question[], warnings: string[],
 * }} Board
 */

module.exports = { BOARD_VERSION, TABS };
