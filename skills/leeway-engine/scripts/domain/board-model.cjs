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
//   (20.3.3), and under a page the view the tab shows beneath it, else
//   null; the questions of the session's unit a press can queue (20.6),
//   which the banner, every WAITING ON YOU and READY TO DISCUSS draw from;
//   and what the reads warned of.
// - A page is asked for by its ref (`--page`), resolved against the unit it
//   was opened in (`--page-unit`), else the tab's, whatever the session is
//   doing, so a page stays while the session moves beneath it (20.3.5) and
//   once it leaves the unit: `task:{N.n}`, `task:{N.n}:written`,
//   `task:{N.n}:round:{k}`, `task:{N.n}:scenario:{id}`,
//   `task:{N.n}:scenario:{id}:evidence:{k}`, `entry:{id}`, `finding:{round}:{k}`,
//   `check:{round}:{scenario}`, `section:{n}`, `pass:{k}`, `topic:{topic}`,
//   `message:{topic}:{file}`, `review:{topic}:{id}`, `spike:{folder}`,
//   `report:{topic}:{id}`; and from All work `unit:{unit}`. The way back is
//   the mod's, which names the page it was opened over, else `beneath`.
// - Each tab is answered on its own: a view or page that cannot be drawn
//   is `unavailable`, saying why, and the banner and questions still stand.
// ---------------------------------------------------------------------------

/** The view model's version (the header's). */
const BOARD_VERSION = 2;

/** The board's tabs (20.3.1). */
const TABS = Object.freeze(['this', 'unit', 'all']);

/**
 * Where the session is, as its position records it: a unit, its type, the
 * phase and topic it works in — each null where it is at none; all null at
 * the start menu or a project-level place.
 * @typedef {{unit: string|null, type: string|null, phase: string|null, topic: string|null}} Place
 */

/** A banner's state: running, waiting on the person, done, or neither. @typedef {'running'|'needs'|'done'|'idle'} BannerState */
/**
 * A fact on the banner: its words, and whether it is drawn flagged (⚑,
 * 20.2.4) — the questions waiting on the person, or the map waiting on
 * approve the map; every other fact plain, `stopped` and what a
 * specification waits on among them.
 * @typedef {{text: string, needs: boolean}} Fact
 */
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
 * clocked from the brief issued for it in this conversation (P15); in step,
 * at its gate, or behind the task in flight; failed, from its builder's stop
 * until it is sent back or parked (P5); waiting on a question; after another
 * task; not started; closed without being done.
 * @typedef {'done'|'building'|'in-review'|'at-gate'|'behind'|'failed'|'waits'|'after'|'not-started'|'closed'} TaskState
 */
/**
 * A task's line: its number, title and state; since when it runs, where it
 * builds or is in review with a clock, else null; and what holds it — the
 * questions for one waiting, the tasks for one after others, the task in
 * flight for one behind it, else none.
 * @typedef {{task: string, title: string, state: TaskState, since: string|null, on: string[]}} TaskLine
 */
/** A phase's state on the board: not yet written, written, running, complete (every task done), or, in step, its merge waiting at its gate. @typedef {'not-written'|'written'|'running'|'complete'|'merging'} PhaseState */
/** A phase of the cut, or of the review's fixes past it: its number, name, state, tasks done of its tasks, and its tasks. @typedef {{phase: number, name: string, state: PhaseState, done: number, total: number, tasks: TaskLine[]}} BuildPhase */
/**
 * The build's This session (20.5.1–20.5.3): the unit, its title and type;
 * the progress — tasks done of the tasks, the phase it is at of its phases,
 * how many run, and whether it has stopped, every task waiting on the
 * person; the questions waiting, by number; and every phase of the cut,
 * then of the review's fixes past it.
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
 * where it never has, and when it finished, as its account was taken, null
 * where none is; what it does and its count of acceptance criteria; its
 * account, null where none is taken; each round's summary; each call it
 * made; what running the product proved of its scenarios, null where it
 * holds none; each question parking it, whole, none where none does;
 * and, for a fix task, each finding of the review it fixes (D17), else none.
 * @typedef {{
 *   kind: 'task', unit: string, phase: number, phase_name: string, line: TaskLine, started: string|null, finished: string|null,
 *   does: string, criteria: number,
 *   account: {done: string, where: string, tests: string, differences: string[], figures: Figures}|null,
 *   reviews: {round: string, summary: string}[], calls: {id: string, text: string}[], ran: Ran[]|null, questions: Question[],
 *   fixes: FoundLine[],
 * }} TaskPage
 */
/**
 * A scenario of a task read in full (15.2.14): the task, its title, the
 * scenario and its criterion's words, what running the product proved of
 * it and when the run that decides was recorded, null where none was run;
 * what the run drives and what it checks, from the scenario's words parted
 * at their "then" — the check null where nothing parts them, both where the
 * spec lacks them — and each text evidence kept with that run, by its name
 * and lines.
 * @typedef {{
 *   kind: 'scenario', unit: string, task: string, title: string, scenario: string, criterion: string, standing: string, at: string|null,
 *   drive: string|null, check: string|null, evidence: {name: string, lines: number}[],
 * }} ScenarioPage
 */
/** A text evidence of the run that decides a scenario, read whole: its task, scenario, name and text. @typedef {{kind: 'evidence', unit: string, task: string, scenario: string, name: string, text: string}} EvidencePage */
/** The task as written: its number, title and each section by its heading. @typedef {{kind: 'task-written', unit: string, task: string, title: string, sections: {heading: string, text: string}[]}} WrittenPage */
/** A round of a task's review read in full: each reviewer's report by its letter. @typedef {{kind: 'task-round', unit: string, task: string, title: string, round: number, reports: {letter: string, text: string}[]}} RoundPage */
/**
 * An entry of the ledger read in full: what it is, whose, its words and why,
 * and the question it answers, where it answers one.
 * @typedef {{kind: 'entry', unit: string, id: string, entry: string, by: string, text: string, why: string|null, question: string|null}} EntryPage
 */

/**
 * A finding of a round: the round; its number in it once the round is
 * recorded, else null, and while it is read the report item it is,
 * `{report}#{n}`, else null; its area, call and words.
 * @typedef {{round: number, finding: number|null, from: string|null, area: string, call: string, text: string}} FoundLine
 */
/** An area's state in a round: read, being read, waiting, or not read again (20.10.2). @typedef {'read'|'reading'|'waiting'|'unchanged'} AreaState */
/**
 * An area of a round, or the reader over the tests (`tests`): its number
 * and title, its state, the checks of its scenarios the round ran, what it
 * found, and since when it is read, else null.
 * @typedef {{area: string, title: string, state: AreaState, ran: number, found: number, since: string|null}} AreaLine
 */
/**
 * The review phase's This session (20.10): the unit, its title, the project
 * and the unit's type, how many tasks were built, the review's fix tasks
 * among them; the round shown — the one under way once it has opened, else
 * the last recorded — whether finish waits on the person, the phase over
 * (D18); the questions its fix tasks wait on, by number, and whether they
 * stop it, as the build's; whether the round is recorded, and each of its
 * areas; what it found — once recorded each finding in scope, else each
 * its landed reports hold; each check not proven, by the round that
 * recorded it, or round 1 while it is read, with its scenario's words, null
 * where the spec lacks them; each finding that went to the inbox, by its
 * round, number and words; its verdict; and the latest fix tasks, as the
 * build's phase they make, null where there are none.
 * @typedef {{
 *   kind: 'review', unit: string, title: string, project: string, type: string, built: number,
 *   round: number, finish: boolean, waiting: string[], stopped: boolean, recorded: boolean, areas: AreaLine[],
 *   found: FoundLine[], not_proven: {round: number, scenario: string, standing: string, text: string|null}[],
 *   inbox: {round: number, finding: number, text: string}[],
 *   verdict: 'passed'|'failed'|'settled'|null, fixes: {phase: number, round: number, tasks: TaskLine[]}|null,
 * }} ReviewView
 */
/**
 * A finding read in full (20.10.3): its round; once the round is recorded,
 * its number, scope, and the fix task or inbox item it went to, the
 * reviewer null; while it is read, the letter of the reviewer whose report
 * holds it, the rest null; its area, call and words.
 * @typedef {{
 *   kind: 'finding', unit: string, round: number, finding: number|null, area: string, scope: string|null, call: string, text: string,
 *   fix: string|null, inbox: string|null, reviewer: string|null,
 * }} FindingPage
 */
/** A check of a round (20.10.3), recorded or round 1's while it is read: its round, its scenario, where it stands, and the scenario's words, null where the spec lacks it. @typedef {{kind: 'check', unit: string, round: number, scenario: string, standing: string, text: string|null}} CheckPage */

/** An open question of the person's on a topic: its entry, words, the topic whose message it came as, and the experiment it waits on. @typedef {{id: string, text: string, from: string|null, experiment: {id: string, running: boolean}|null}} OpenLine */
/** A decision on a topic: its entry, the question's words, and whose it is. @typedef {{id: string, text: string, who: 'yours'|'claude'|'carried'}} DecidedLine */
/** A call of Claude's since the person last looked: its entry, its words and the question it answers. @typedef {{id: string, text: string, question: string|null}} CallLine */
/**
 * A round of a discussion's review (20.7.1): its agent's id and round; where
 * it stands — in flight running, its report in and not yet taken, or lost
 * with the conversation that sent it; else read — since it was dispatched;
 * each read one's findings, those taken in and those waiting.
 * @typedef {{id: string, round: number, state: 'running'|'landed'|'lost'|'read', since: string, findings: number, taken: number, waiting: number}} ReviewLine
 */
/**
 * A discussion's This session (20.7.1): the unit, its title and type; the
 * topic and its title; the person's questions decided of theirs and Claude's
 * calls; what of theirs is still open; the messages waiting, each by its
 * file, title, sender and day; Claude's calls since the person last looked,
 * read without looking (5.8.14); its review's rounds, newest first; every
 * decision; and everything the topic sent, newest first, each with where
 * it went, when, and whether it still waits in that topic's mailbox.
 * @typedef {{
 *   kind: 'discussion', unit: string, title: string, type: string, topic: string, topic_title: string,
 *   progress: {decided: number, yours: number, calls: number},
 *   open: OpenLine[], messages: {file: string, title: string, from: string, when: string}[], since: CallLine[],
 *   reviews: ReviewLine[], decided: DecidedLine[], sent: {title: string, to: string, file: string, at: string, waiting: boolean}[],
 * }} DiscussionView
 */
/** A message waiting in a topic's mailbox read in full (20.7.3): its file, title, sender, day and text. @typedef {{kind: 'message', unit: string, topic: string, file: string, title: string, from: string, when: string, text: string}} MessagePage */
/** A round of a discussion's review read in full (20.7.3): its agent's id, its round and its report. @typedef {{kind: 'review-report', unit: string, topic: string, id: string, round: number, text: string}} ReviewReportPage */

/**
 * A section of the spec: its number and title; the passes whose findings
 * changed it, by number, none where none has; and whether a pass running
 * reads it.
 * @typedef {{number: string, title: string, changed_by: number[], reading: boolean}} SpecSection
 */
/**
 * A pass of the spec's review: its number; what it found, of which the
 * calls are Claude's and the rest the person's; where it stands — out
 * running, its report in and not yet taken, or lost with the conversation
 * that sent it; else read — and, while out, since when and the sections it
 * reads, each null for one read.
 * @typedef {{pass: number, found: number, calls: number, yours: number, state: 'running'|'landed'|'lost'|'read', since: string|null, reads: string[]|null}} SpecPass
 */
/** A gap waiting on the person (20.9.1): its entry, its words, the pass that found it, null where none did, and the sections it touches. @typedef {{id: string, text: string, pass: number|null, sections: string[]}} GapLine */
/**
 * A specification's This session (20.9.1): the unit, its title and type;
 * each section; the review's passes, newest first; what waits on the
 * person, each asked in the conversation; Claude's calls since the calls
 * list was last drawn in the conversation, read without looking (5.8.14);
 * the phases cut, each with its scenario count and the sections it draws
 * on; and what ready to build waits on — the review settling, or the
 * person's yes.
 * @typedef {{
 *   kind: 'spec', unit: string, title: string, type: string, sections: SpecSection[],
 *   passes: SpecPass[], waiting: GapLine[], since: CallLine[],
 *   cut: {phase: number, name: string, scenarios: number, sections: string[]}[], ready: 'review'|'person',
 * }} SpecView
 */
/** A section read in full: its number, title and text. @typedef {{kind: 'section', unit: string, number: string, title: string, text: string}} SectionPage */
/** A pass of the spec's review read in full (20.9.2): its number, what it found, its calls and the person's, and its report. @typedef {{kind: 'pass', unit: string, pass: number, found: number, calls: number, yours: number, text: string}} PassPage */

/** A section of a document Claude writes: its heading, null for what stands before the first, and its text. @typedef {{heading: string|null, text: string}} HeadedSection */
/** A topic on the map: its key, title and summary. @typedef {{topic: string, title: string, summary: string}} MapLine */
/**
 * A spike of the unit: its folder, its slug titled, the status its links
 * give it, and the tool it was made in and what it showed as the log says
 * them — each null where none does.
 * @typedef {{spike: string, title: string, status: string|null, tool: string|null, showed: string|null}} SpikeLine
 */
/**
 * Discovery's This session (20.11.1): the unit, its title and type; its
 * session's number and the day it started, each null before its first;
 * whether approve the map waits on the person; the map's topics in order;
 * what goes to the roadmap, each with its horizon; the directions not
 * taken, each with why; the person's views of the
 * product; and the unit's spikes, in the order they started.
 * @typedef {{
 *   kind: 'discovery', unit: string, title: string, type: string, session: number|null, started: string|null,
 *   waits: boolean, map: MapLine[], roadmap: {title: string, horizon: string}[],
 *   not_taken: {direction: string, why: string}[], views: string[], spikes: SpikeLine[],
 * }} DiscoveryView
 */
/** A topic's brief (20.11.2): its place on the map of how many, its summary, and the brief's sections. @typedef {{kind: 'brief', unit: string, topic: string, title: string, order: number|null, of: number, summary: string, sections: HeadedSection[]}} BriefPage */
/** A spike's page (20.11.3): its line, where it is kept, from the state root, and its live link, null where the log names none. @typedef {{kind: 'spike', unit: string} & SpikeLine & {path: string, link: string|null}} SpikePage */

/**
 * A condition of an experiment's runs (20.13.1): its name, the runs its
 * design gives it, the runs done, their median so far, null before the
 * first, and the unit the runs are measured in, null where none is named.
 * @typedef {{condition: string, of: number, done: number, median: number|null, unit: string|null}} RunsLine
 */
/**
 * An experiment's This session (20.13): the unit, its title and type; its
 * id and question; the topic it serves; where it stands, the day the
 * person approved its design, null before that or where its record holds
 * none, its verdict once concluded and its reason once abandoned; its
 * problem as the topic put it; its design by its sections, none before it
 * is written; its runs by condition, none before the first are recorded;
 * and whether its report is written.
 * @typedef {{
 *   kind: 'experiment', unit: string, title: string, type: string, id: string, question: string, topic: string, topic_title: string,
 *   status: string, approved: string|null, verdict: string|null, reason: string|null, problem: string, design: HeadedSection[], runs: RunsLine[], report: boolean,
 * }} ExperimentView
 */
/** An experiment's report read in full (20.13.1). @typedef {{kind: 'experiment-report', unit: string, topic: string, id: string, text: string}} ReportPage */

/**
 * A moment of the unit lately: its kind, when, its topic, and what it names
 * besides — from the state's history the unit made, the map approved, a
 * phase or topic started, a topic postponed, cancelled or back, a message
 * sent or taken in, the spec landed, a review round, the unit completed;
 * from its build a question raised, a task started, failed or finished.
 * @typedef {{kind: string, at: string, topic: string|null, detail: string|null}} Moment
 */

/** A topic's state on the epic's page. @typedef {'decided'|'discussing'|'next'|'not-started'} TopicState */
/**
 * A topic on the epic's page: its key, title and state; its person's
 * questions decided of all; whether a session is in it, this one or
 * another, else null — in its discussion or in its experiment; its messages
 * waiting; and the experiment one of its questions waits on, running or
 * concluded with its report waiting (20.13.2).
 * @typedef {{
 *   topic: string, title: string, state: TopicState, decided: number, total: number,
 *   session: 'this'|'other'|null, messages: number, experiment: {id: string, running: boolean}|null,
 * }} TopicLine
 */
/**
 * The epic's page (20.8, 20.15.2): the unit, its title, what it is for and
 * the day it started, null where its manifest holds none; whether the
 * session is at its menu; its topics decided of all, and how
 * many are in discussion; its topics in the map's order; the specification
 * and the build, each by where it stands; the topics set aside; and what
 * happened lately, newest first.
 * @typedef {{
 *   kind: 'epic', unit: string, title: string, about: string, started: string|null, at_menu: boolean,
 *   progress: {decided: number, total: number, discussing: number},
 *   topics: TopicLine[], spec: 'waits'|'running'|'complete', build: 'waits'|'running'|'complete',
 *   set_aside: {topic: string, title: string, state: 'cancelled'|'postponed', horizon: string|null}[], lately: Moment[],
 * }} EpicView
 */

/**
 * A phase on a unit's tab: its name, its state, and its words — what a
 * phase complete or running produced, what one later waits on — empty where
 * the records say none.
 * @typedef {{phase: string, state: 'complete'|'running'|'waits'|'later', words: string}} UnitPhase
 */
/** What waits on the person in a unit: a question of its build, or a gap of its spec, by its number or entry and its words. @typedef {{kind: 'question'|'gap', id: string, text: string}} WaitingLine */
/**
 * A unit's tab (20.15.1), and an epic's while discovery runs before any
 * topic exists (20.15.2): the unit, its title, type, what it is for and the
 * day it started, null where its manifest holds none; whether the session
 * is at its menu; its phases complete of all; what
 * waits on the person; each phase from discovery to review; and what
 * happened lately, newest first.
 * @typedef {{
 *   kind: 'unit', unit: string, title: string, type: string, about: string, started: string|null, at_menu: boolean,
 *   progress: {complete: number, total: number}, waiting: WaitingLine[], phases: UnitPhase[], lately: Moment[],
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
 * how many questions wait on the person across the units in progress; those
 * units; the roadmap's waiting items by horizon; the inbox by kind; and the
 * units complete.
 * @typedef {{
 *   kind: 'all', project: string, at_start: boolean, waiting: number, units: WorkLine[],
 *   roadmap: {horizon: string, items: {title: string, from: string|null}[]}[],
 *   inbox: {kind: string, title: string}[], complete: {unit: string, title: string, type: string}[],
 * }} AllView
 */

/** A view or page that cannot be drawn, and why. @typedef {{kind: 'unavailable', reason: string}} Unavailable */

/**
 * A view or page the board shows.
 * @typedef {BuildView|TaskPage|ScenarioPage|EvidencePage|WrittenPage|RoundPage|EntryPage|ReviewView|FindingPage|CheckPage|DiscussionView|MessagePage|ReviewReportPage
 *   |SpecView|SectionPage|PassPage|DiscoveryView|BriefPage|SpikePage|ExperimentView|ReportPage|EpicView|UnitView|AllView|Unavailable} View
 */

/**
 * The board's view model (the header's).
 * @typedef {{
 *   version: number, place: Place, banner: Banner|null, unit: {unit: string, title: string}|null,
 *   tab: 'this'|'unit'|'all', view: View, beneath: View|null, questions: Question[], warnings: string[],
 * }} Board
 */

module.exports = { BOARD_VERSION, TABS };
