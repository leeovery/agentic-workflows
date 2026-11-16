'use strict';

// ---------------------------------------------------------------------------
// Domain ring: where a unit stands on the board — the one derivation every
// view reads, the banner in every phase and at the unit's menu, the unit's
// tab, the epic's page and its stages, and All work's row and count, so no
// view knows less of a unit than another.
//
// - Its phases and where it has come to are read from the unit alone
//   (unit-phases.cjs).
// - How the phase it is in stands: stopped where nothing of its tasks can
//   go on without an answer — its build's, the review's round and fix tasks
//   among it, a quick-fix's fixes and its review's alike, by the build's
//   rule (board-build.cjs) — worked out once, which every view reads
//   (`tasksStopped`); waiting on the person where something asked in the
//   conversation and holding it waits — the map, an investigation's raise
//   or its conclude, a gap, ready to build's yes, finish or a quick-fix's
//   close; else under way.
// - What waits on the person is the list the unit's menu reads (waits.cjs;
//   20.8.5), read in this conversation, its verdicts for an epic as the
//   epic's menu asks for them — so the board and the menus never differ —
//   each wait with the board's words and the page a press on it opens,
//   where it opens one: approve the map with the topics it holds and what
//   it parks, or the sweep's candidates still standing (8.10.9); a topic's
//   decided, and a decided topic an answer it relied on, replaced since,
//   holds (10.2.6), each opening the topic; ready to build's yes; a gap of
//   the spec opening the finding that raised it (board-spec.cjs); a
//   question of the build or the review opening the page of the first task
//   it parks, one parking none its question's entry — a replacement's, the
//   decision it would replace (questions.cjs); an investigation's raise
//   with what raised it, and its conclude (board-investigation.cjs); a
//   quick-fix's question asked in its conversation; finish, a quick-fix's
//   its close with whether a verdict is owed (board-quick-fix.cjs); and a
//   verdict waiting, by the words of the answer it judges.
// - The whole list stands on the epic's page and the unit's tab, and the
//   banner at the unit's menu counts it (20.8.5, 20.2.4). A phase's view
//   and its banner take the phase's own waits alone (`phaseWaiting`), as
//   20.2.4 draws each: discovery approve the map; an investigation its
//   raises and its conclude; the specification the map its sweep staged
//   (8.10.9), its gaps and ready to build's yes; the build and the review their questions, a quick-fix's
//   asked in its conversation among them, and finish or a quick-fix's
//   close; a discussion and an experiment none. Any other unit's wait
//   counts too in the phase its door hands into: a decided topic a changed
//   answer holds, in the phase the unit is in (12.15.4). An epic's decided
//   topics, those a changed answer holds and its verdicts are no phase's.
// - The banner counts what it takes, flagged — the map alone by its own
//   words — and at a menu says it unflagged (D40).
// ---------------------------------------------------------------------------

const { stagedOrNone, candidatesStanding } = require('../approve-map.cjs');
const { readQuestions, waitingIn } = require('../questions.cjs');
const { readShownOnce } = require('../ledger-read.cjs');
const { waitsOf } = require('../waits.cjs');
const { phaseSkill } = require('../handoff.cjs');
const { quickFixBuild, tasksBegun, topicTitle } = require('../derivations.cjs');
const { nowOf } = require('../unit-phases.cjs');
const { counted } = require('./map.cjs');
const { buildRead } = require('./board-build.cjs');
const { specLine } = require('./board-spec.cjs');
const { raiseLine, CONCLUDE_LINE } = require('./board-investigation.cjs');
const { closeWait } = require('./board-quick-fix.cjs');

/** @typedef {import('../board.cjs').BoardAt} BoardAt */
/** @typedef {import('../board-model.cjs').UnitNow} UnitNow */
/** @typedef {import('../board-model.cjs').WaitingLine} WaitingLine */
/** @typedef {import('../board-model.cjs').Fact} Fact */
/** @typedef {import('../waits.cjs').Wait} Wait */
/** How the phase a unit is in stands (the header's). @typedef {'running'|'stopped'|'waits'|'complete'} PhaseStanding */

/**
 * Approve the map with what is staged: its topics in order and what it
 * parks on the roadmap, or after the sweep its candidates still standing,
 * to take or strike.
 * @param {BoardAt} at @param {Wait} wait @returns {WaitingLine}
 */
function mapLine(at, wait) {
  const staged = /** @type {NonNullable<ReturnType<typeof stagedOrNone>>} */ (stagedOrNone(at.cwd, at.unit));
  const parks = staged.parks?.length ?? 0;
  const holds = staged.candidates === undefined
    ? `${counted(staged.topics.length, 'topic')} in this order${parks === 0 ? '' : `, and ${parks} to the roadmap`}`
    : `${counted(candidatesStanding(staged.candidates).length, 'candidate')} the sweep found, to take or strike`;
  return { kind: 'map', id: wait.id, text: `Approve the map: ${holds}`, page: null };
}

/** The questions of the build and the review waiting, by their number, each with the tasks it parks and what it is about (questions.cjs), read once a call. @param {BoardAt} at @returns {Map<string, {about: string, parks: string[]}>} */
const questionsAt = (at) => at.once('waiting-questions', () => readQuestions(at.root, at.warnings, (read, entryAt) => new Map(
  waitingIn(read, entryAt, at.unit, Date.now()).map(({ question, about, parks }) => [question, { about, parks }]),
)));

/**
 * A question of the build or the review, opening the page of the first task
 * it parks, which holds it whole, or one parking none its question's entry
 * — a replacement's, the decision it would replace.
 * @param {BoardAt} at @param {Wait} wait @returns {WaitingLine}
 */
function questionLine(at, wait) {
  const { about, parks } = /** @type {{about: string, parks: string[]}} */ (questionsAt(at).get(wait.id));
  return { kind: 'question', id: wait.id, text: `${wait.id} ${wait.text}`, page: parks.length === 0 ? `entry:${about}` : `task:${parks[0]}` };
}

/** Finish, as what waits on the person. @type {WaitingLine} */
const FINISH = Object.freeze({ kind: 'finish', id: 'finish', text: 'Finish: the report of every round, and your verdict on each call you changed', page: null });

/** A wait by its own words, opening `page`. @param {Wait} wait @param {string|null} [page] @returns {WaitingLine} */
const plainLine = ({ kind, id, text }, page = null) => ({ kind, id, text, page });

/** A wait about a topic, opening the topic. @param {Wait} wait */
const topicLine = (wait) => plainLine(wait, `topic:${wait.topic}`);

/** Each kind of wait as the board lists it (the header's). @type {Readonly<Record<Wait['kind'], (at: BoardAt, wait: Wait) => WaitingLine>>} */
const LINES = Object.freeze({
  map: mapLine,
  decided: (at, wait) => ({ ...topicLine(wait), text: `Decided: what ${topicTitle(at.manifest, /** @type {string} */ (wait.topic))} decided, for your yes` }),
  ready: specLine,
  conclude: () => CONCLUDE_LINE,
  finish: (at) => (quickFixBuild(at.manifest) ? /** @type {WaitingLine} */ (closeWait(at)) : FINISH),
  gap: specLine,
  question: questionLine,
  raise: raiseLine,
  raised: (_, wait) => plainLine(wait),
  affected: (_, wait) => topicLine(wait),
  verdict: (_, wait) => ({ ...plainLine(wait), text: `Verdict on a call you changed: ${wait.text}` }),
});

/** What waits on the person in the unit (the header's), each wait with the board's line for it, read once a call. @param {BoardAt} at @returns {{wait: Wait, line: WaitingLine}[]} */
const waitsAt = (at) => at.once('waiting-on', () => readShownOnce(at.root, at.warnings, (shower) => {
  const { waits, warnings } = waitsOf(at.cwd, [at.manifest], { verdicts: at.manifest.work_type === 'epic', session: at.session, shower });
  at.warnings.push(...warnings);
  return /** @type {Wait[]} */ (waits.get(at.unit)).map((wait) => ({ wait, line: LINES[wait.kind](at, wait) }));
}));

/** What waits on the person in the unit (the header's). @param {BoardAt} at @returns {WaitingLine[]} */
const waitingOn = (at) => waitsAt(at).map(({ line }) => line);

/** The kinds of wait that hold the phase the unit is in: asked in the conversation, it goes no further until each is answered. */
const HOLDING = Object.freeze(['map', 'gap', 'ready', 'raise', 'conclude', 'finish']);

/** The kinds of wait each phase takes as its own, by the phase (the header's); a phase it names not, none. @type {Readonly<Record<string, readonly string[]>>} */
const PHASE_OWN = Object.freeze({
  discovery: Object.freeze(['map']),
  investigation: Object.freeze(['raise', 'conclude']),
  specification: Object.freeze(['map', 'gap', 'ready']),
  implementation: Object.freeze(['question', 'raised', 'finish']),
  review: Object.freeze(['question', 'raised', 'finish']),
});

/**
 * What waits on the person in the phase the session is in, its view's and
 * its banner's (the header's): the phase's own kinds, and in a unit not an
 * epic each wait whose door hands into the phase.
 * @param {BoardAt} at @returns {WaitingLine[]}
 */
function phaseWaiting(at) {
  const { phase } = at.place;
  const own = PHASE_OWN[phase ?? ''] ?? [];
  const door = phase === null || at.manifest.work_type === 'epic' ? null : phaseSkill(phase, at.manifest.work_type);
  return waitsAt(at).filter(({ wait: { kind, next } }) => own.includes(kind) || (next.kind === 'handoff' && next.skill === door)).map(({ line }) => line);
}

/**
 * Whether a wait holds the phase (`HOLDING`): never a build's question,
 * which waits on the board, a quick-fix's, asked in the conversation and
 * holding nothing, a topic's decided, which holds its topic alone, a
 * decided topic a changed answer holds, nor a verdict.
 * @param {WaitingLine} line
 */
const holds = ({ kind }) => HOLDING.includes(kind);

/**
 * Whether nothing of the unit's tasks can go on without an answer (the
 * header's), by the build's rule (board-build.cjs) whatever the type; read
 * once a call.
 * @param {BoardAt} at @returns {boolean}
 */
const tasksStopped = (at) => at.once('stopped', () => tasksBegun(at.manifest) && buildRead(at).view.progress.stopped);

/** How the phase the unit is in stands (the header's). @param {BoardAt} at @returns {PhaseStanding} */
function standingOf(at) {
  if (nowOf(at).phase === 'complete') return 'complete';
  if (waitingOn(at).some(holds)) return 'waits';
  return tasksStopped(at) ? 'stopped' : 'running';
}

/**
 * The banner's fact for what waits on the person (the header's): how many,
 * the map alone by its own words; flagged in a phase, said unflagged at a
 * menu (D40); none where nothing waits.
 * @param {WaitingLine[]} waiting @param {boolean} atMenu @returns {Fact[]}
 */
function waitsFacts(waiting, atMenu) {
  if (waiting.length === 0) return [];
  const text = waiting.every(({ kind }) => kind === 'map') ? 'the map waits on you' : `${waiting.length} waiting on you`;
  return [atMenu ? { text, needs: false, waits: true } : { text, needs: true }];
}

module.exports = { waitingOn, phaseWaiting, standingOf, tasksStopped, holds, waitsFacts };
