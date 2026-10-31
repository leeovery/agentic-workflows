'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the entry (CONVENTIONS, Entering) — `enter <phase> <unit>
// [<topic>] [--take]`, the one call a phase is entered by. It refuses what
// cannot be entered, each refusal naming the way on: a unit this project
// lacks or has closed, a phase its work type has no place for, and what the
// phase's own row refuses. Where another live session holds the place, it
// asks first (18.4.21) — its question the whole answer, nothing written —
// and `--take` enters all the same. Otherwise it starts what is not yet
// started, writing nothing ahead of its opening (9.3.1), and commits that
// start; records where the conversation is working — its position, the tmux
// label and the place's presence, as `session label` and `topic start` do;
// and answers what the phase needs to begin or resume, in sections: any
// question first, then a DATA naming what to read, as paths and engine
// calls, never their contents, and the log the conversation keeps with the
// line it opens its first write with (8.14.8). The reading comes after the
// question (2.10.3).
//
// A phase enters through its row of `ENTRIES`: its level — at a topic, or at
// the work unit — why it cannot be entered as it stands (topic-standing.cjs,
// the rule a handoff into a topic and a message to one share), whether and
// how it starts, the questions it raises first, what it reads, and its log.
// A topic-level row refuses an epic entered at no topic, a topic once the
// unit has its spec (4.11.2), and a topic the unit lacks; a unit-level row takes
// no topic, and is entered after the spec as before it. Discussion is the
// first row; each later phase adds its own as its rewrite moves it onto the
// entry. A unit-level place is the unit itself, as a single-topic unit's
// topic is.
//
// The refusals, the question and the reads take no lock. The start holds the
// writer lock around its manifest write and the commit; the position, the
// label and the presence are files outside the state's commits.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { withWorkUnitLock } = require('../kernel/manifest.cjs');
const { statePath } = require('../kernel/state-root.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { liveTopics } = require('./ledger-units.cjs');
const { computeTopicLifecycle, itemOf } = require('./derivations.cjs');
const { unitInProgress, assertPhaseHeld, phaseStanding } = require('./topic-standing.cjs');
const { startTopic } = require('./transitions.cjs');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { arriveAt } = require('./session-label.cjs');
const { beatQuietly, peerHold } = require('./presence.cjs');
const { agentsLeft } = require('./agent-state.cjs');
const { runningTranscript } = require('./conversation.cjs');
const { topicLog, ledgerView, recordCall, productCall, owedHeader } = require('./topic-log.cjs');
const { entrySections, heldGate } = require('./projections/enter.cjs');
const { waitingMessages } = require('./mail.cjs');
const { waitingMail } = require('./projections/mail.cjs');

/** @typedef {[string, string]} Line a DATA line, its key and its value */

/** @typedef {import('./topic-standing.cjs').Standing} Standing */

/**
 * What a row reads from once it is entered: where the entry is, and whether
 * this entry started it.
 * @typedef {Standing & {started: boolean}} Entering
 */

/**
 * A phase's row: its level; why it cannot be entered as it stands, or null;
 * whether it is yet to start, and what starts it; the questions owed before
 * anything is read, each a section drawn whole; what it reads; and the log
 * its conversation keeps, state-relative.
 * @typedef {object} Entry
 * @property {'topic'|'unit'} level
 * @property {(at: Standing) => string|null} standing
 * @property {(manifest: Record<string, any>, topic?: string) => boolean} unstarted
 * @property {(cwd: string, unit: string, topic?: string) => void} start
 * @property {(at: Entering) => string[]} questions
 * @property {(at: Entering) => Line[]} reads
 * @property {(unit: string, topic?: string) => string} log
 */

/** The files in a state folder, sorted, as absolute paths; none where it is not there. @param {string} dir absolute */
function filesIn(dir) {
  try {
    return fs.readdirSync(dir).sort().map((name) => path.join(dir, name));
  } catch {
    return [];
  }
}

/** The paths that exist. @param {string[]} paths absolute */
const existing = (paths) => paths.filter((p) => fs.existsSync(p));

/**
 * The mail waiting for a topic, raised at its opening before anything else
 * (10.4.1, 10.4.2): none where none waits.
 * @param {Entering} at @returns {string[]}
 */
function mailRaised({ cwd, unit, topic = '' }) {
  const waiting = waitingMessages(cwd, unit, topic);
  return waiting.length === 0 ? [] : [waitingMail(waiting)];
}

/**
 * What a discussion reads before its opening (9.3.2–9.3.6, 8.7.7): each
 * message waiting, its name the one `topic answered` takes; the topic's
 * brief — for the unit's one topic, discovery's log and the unit's
 * seeds; the record of every other topic decided so far, never its log; the
 * product record, with what discovery found of the product and of the unit,
 * which no topic's record shows, and of the topic, which a first opening
 * reads no record for (9.3.6, 9.3.12); and the unit's spikes. Resuming
 * adds the topic's own record (9.3.11), its map, and the entries a
 * replacement changed under it, each confirmed or replaced in the
 * conversation (9.3.6), and the reports of the agents the topic was left
 * with, landed since, with those lost with a process that no longer runs
 * (9.7.8). The log comes with every entry's.
 * @param {Entering} at @returns {Line[]}
 */
function discussionReads({ cwd, unit, topic = '', manifest, started }) {
  const own = topic === unit;
  const seeds = Array.isArray(manifest.seeds) ? manifest.seeds.filter((seed) => typeof seed?.path === 'string') : [];
  const decided = liveTopics(unit, manifest).filter((other) => other !== topic && computeTopicLifecycle(manifest, other).lifecycle === 'decided');
  const agents = agentsLeft(cwd, unit, 'discussion', topic);
  /** @param {string} key @returns {(value: string) => Line} */
  const as = (key) => (value) => [key, value];
  return [
    ...waitingMessages(cwd, unit, topic).map(({ path: message }) => as('mail')(message)),
    ...existing([statePath(cwd, unit, 'discovery', 'briefs', `${topic}.md`)]).map(as('brief')),
    ...(own ? filesIn(statePath(cwd, unit, 'discovery', 'sessions')) : []).map(as('discovery log')),
    ...(own ? existing(seeds.map((seed) => statePath(cwd, unit, seed.path))) : []).map(as('seed')),
    ...decided.map((other) => as('decided')(`\`${recordCall(unit, other)}\``)),
    as('product')(`\`${productCall(unit, topic)}\``),
    ...filesIn(statePath(cwd, unit, 'spikes')).map(as('spike')),
    ...(started ? [] : /** @type {const} */ (['record', 'map', 'affected']).map((view) => as(view)(`\`${ledgerView(view, unit, topic)}\``))),
    ...agents.landed.map(({ file }) => as('landed')(file)),
    ...agents.lost.map(as('lost')),
  ];
}

/** @type {Readonly<Record<string, Entry>>} */
const ENTRIES = Object.freeze({
  discussion: {
    level: 'topic',
    standing: phaseStanding('discussion'),
    unstarted: (manifest, topic = '') => ['unstarted', undefined].includes(itemOf(manifest, 'discussion', topic)?.status),
    start: (cwd, unit, topic = '') => { startTopic(cwd, unit, 'discussion', topic); },
    questions: mailRaised,
    reads: discussionReads,
    log: (unit, topic = '') => topicLog(unit, topic),
  },
});

const TAKE = '--take';

/** The entry's usage, over the phases a table enters. @param {Readonly<Record<string, Entry>>} entries */
function enterUsage(entries) {
  return `enter <${Object.keys(entries).join('|')}> <work-unit> [<topic>] [${TAKE}]`;
}

const ENTER_USAGE = enterUsage(ENTRIES);

/**
 * The topic an entry is at — at a topic-level row the one named, else the
 * unit's own where it has one topic; none at a unit-level row, which refuses
 * one named.
 * @param {Entry} entry @param {Record<string, any>} manifest @param {string} phase @param {string} unit @param {string|undefined} named
 * @returns {string|undefined}
 */
function topicOf(entry, manifest, phase, unit, named) {
  if (entry.level === 'topic') return named ?? (manifest.work_type === 'epic' ? undefined : unit);
  if (named !== undefined) throw new Error(`${phase} is entered at the work unit — name no topic: engine enter ${phase} ${unit}`);
  return undefined;
}

/**
 * Start what the row starts and commit the start, in one hold of the writer
 * lock: the response's commit fields.
 * @param {string} cwd @param {Entry} entry @param {string} phase @param {string} unit @param {string} [topic]
 * @returns {{committed: string|null, note?: string, warnings?: string[]}}
 */
function startAndCommit(cwd, entry, phase, unit, topic) {
  /** @type {string[]} */
  const warnings = [];
  const message = topic === undefined ? `${phase}(${unit}): start` : `${phase}(${unit}): start ${topic}`;
  const outcome = withWorkUnitLock(cwd, unit, () => {
    entry.start(cwd, unit, topic);
    return commitStateTail(cwd, `${unit}/manifest.json`, message, warnings);
  });
  /** @type {{committed: string|null, note?: string, warnings?: string[]}} */
  const result = { committed: outcome.committed };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome, `${unit} --state`);
  return result;
}

/**
 * The question put where another live session holds the place: proceeding
 * is the entry again with `--take`; leaving it goes back to the epic's menu,
 * a single-topic unit having none to hand off to.
 * @param {Standing} at @param {string} place @param {number} ageSeconds
 */
function heldQuestion({ phase, unit, topic, manifest }, place, ageSeconds) {
  const take = ['enter', phase, unit, ...(topic === undefined ? [] : [topic]), TAKE];
  const menu = manifest.work_type === 'epic' ? { skill: 'leeway-continue-epic', args: [unit] } : null;
  return heldGate({ unit, phase, place, ageSeconds, take, menu });
}

/**
 * `enter` through a table of rows: the response line and the sections after
 * it.
 * @param {Readonly<Record<string, Entry>>} entries @param {string} cwd @param {string[]} argv
 * @returns {{response: Record<string, unknown>, sections: string}}
 */
function enterThrough(entries, cwd, argv) {
  const take = argv.at(-1) === TAKE;
  const [phase, unit, named, ...extra] = take ? argv.slice(0, -1) : argv;
  const bad = !Object.hasOwn(entries, phase) || !unit || named === '' || named?.startsWith('--') || extra.length > 0;
  if (bad) throw new Error(`Usage: engine ${enterUsage(entries)}`);
  const entry = entries[phase];
  const manifest = unitInProgress(cwd, unit);
  assertPhaseHeld(manifest, phase);
  /** @type {Standing} */
  const at = { cwd, phase, unit, topic: topicOf(entry, manifest, phase, unit, named), manifest };
  const standing = entry.standing(at);
  if (standing !== null) throw new Error(standing);
  const { topic } = at;
  const atTopic = topic === undefined ? {} : { topic };
  const place = topic ?? unit;
  const hold = take ? null : peerHold(cwd, unit, phase, place);
  if (hold !== null) return { response: { phase, unit, ...atTopic, entered: false }, sections: heldQuestion(at, place, hold.age_seconds) };
  const started = entry.unstarted(manifest, topic);
  const commit = started ? startAndCommit(cwd, entry, phase, unit, topic) : {};
  arriveAt(cwd, unit, phase, place);
  beatQuietly(cwd, unit, phase, place);
  const sessionId = handedSession();
  /** @type {Entering} */
  const entering = { ...at, started };
  const log = statePath(cwd, entry.log(unit, topic));
  const header = owedHeader(log, sessionId, sessionId === null ? null : runningTranscript(sessionId));
  /** @type {Line[]} */
  const lines = [...entry.reads(entering), ['log', log], ...(header === null ? [] : /** @type {Line[]} */ ([['log header', header]]))];
  return {
    response: { phase, unit, ...atTopic, entered: true, started, ...commit },
    sections: entrySections(entry.questions(entering), lines),
  };
}

/**
 * `enter`: the response line and the sections after it.
 * @param {string} cwd @param {string[]} argv
 */
function enter(cwd, argv) {
  return enterThrough(ENTRIES, cwd, argv);
}

module.exports = { ENTER_USAGE, ENTRIES, enter, enterThrough };
