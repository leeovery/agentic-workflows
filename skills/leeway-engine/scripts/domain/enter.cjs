'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the entry (CONVENTIONS, Entering) — `enter <phase> <unit>
// [<topic>]`, the one call a phase is entered by. It refuses what cannot be
// entered, each refusal naming the way on: a unit this project lacks or has
// closed, a phase its work type has no place for, a topic it lacks or that
// stands closed, and any topic once the unit has its spec (4.11.2). It starts
// a topic not yet started, writing nothing ahead of its opening (9.3.1), and
// commits that start; records where the conversation is working — its
// position, the tmux label and the topic's presence, as `session label` and
// `topic start` do; and answers what the phase needs to begin or resume, in
// sections: any question first, then a DATA naming what to read, as paths
// and engine calls, never their contents, and the log the conversation keeps
// with the line it opens its first write with (8.14.8). The reading comes
// after the question (2.10.3).
//
// A phase enters through its row of `ENTRIES`: how its topic stands, whether
// and how it starts, the questions it raises first, what it reads, and its
// log. Discussion is the first row; each later phase adds its own as its
// rewrite moves it onto the entry.
//
// The refusals and the reads take no lock. The start holds the writer lock
// around its manifest write and the commit; the position, the label and the
// presence are files outside the state's commits.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { WORK_TYPE_PIPELINES, illegalNameReason, workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { withWorkUnitLock } = require('../kernel/manifest.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { hasTopic, manifestOf, liveTopics } = require('./ledger-units.cjs');
const { computeTopicLifecycle, itemOf } = require('./derivations.cjs');
const { startTopic } = require('./transitions.cjs');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { arriveAt } = require('./session-label.cjs');
const { beatQuietly } = require('./presence.cjs');
const { earlierAgents } = require('./agent-state.cjs');
const { runningTranscript } = require('./conversation.cjs');
const { topicLog, recordCall, productCall, owedHeader } = require('./topic-log.cjs');
const { entrySections } = require('./projections/enter.cjs');

/** @typedef {[string, string]} Line a DATA line, its key and its value */

/**
 * What a phase's row reads from: where the entry is, the unit's manifest as
 * it stood on arrival, whether this entry started the topic, and the
 * calling conversation.
 * @typedef {{cwd: string, unit: string, topic: string, manifest: Record<string, any>, started: boolean, sessionId: string|null}} Entering
 */

/**
 * A phase's row: why its topic cannot be entered as it stands, or null;
 * whether it is yet to start, and what starts it; the questions owed before
 * anything is read, each a section drawn whole; what it reads; and the log
 * its conversation keeps, state-relative.
 * @typedef {object} Entry
 * @property {(manifest: Record<string, any>, topic: string) => string|null} standing
 * @property {(manifest: Record<string, any>, topic: string) => boolean} unstarted
 * @property {(cwd: string, unit: string, topic: string) => void} start
 * @property {(at: Entering) => string[]} questions
 * @property {(at: Entering) => Line[]} reads
 * @property {(unit: string, topic: string) => string} log
 */

/**
 * Where a decided or set-aside topic of the unit is reopened (8.6.5).
 * @param {Record<string, any>} manifest
 */
function reopenedThrough(manifest) {
  return manifest.work_type === 'epic' ? 'the epic menu\'s discovery row' : 'manage on the start menu';
}

/** @type {Readonly<Record<string, (topic: string, through: string) => string>>} */
const SET_ASIDE = Object.freeze({
  cancelled: (topic, through) => `the topic "${topic}" is cancelled — reactivating it goes through ${through}`,
  handled: (topic, through) => `the topic "${topic}" is closed as a dead end — reopening it goes through ${through}`,
  postponed: (topic) => `the topic "${topic}" is postponed and waits on the roadmap — pulling it forward brings it back`,
});

/**
 * Why a discussion's topic cannot be entered: set aside on the map, promoted
 * out of the unit, or decided; null where it can.
 * @param {Record<string, any>} manifest @param {string} topic
 * @returns {string|null}
 */
function discussionStanding(manifest, topic) {
  const through = reopenedThrough(manifest);
  const { lifecycle } = computeTopicLifecycle(manifest, topic);
  if (Object.hasOwn(SET_ASIDE, lifecycle)) return SET_ASIDE[lifecycle](topic, through);
  const item = itemOf(manifest, 'discussion', topic);
  if (item?.status === 'promoted') return `the topic "${topic}" was promoted to "${item.promoted_to}" — it carries on there`;
  if (item?.status === 'completed') return `the topic "${topic}" is decided — it reopens through a message sent to it, or through ${through}`;
  return null;
}

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
 * What a discussion reads before its opening (9.3.2–9.3.6, 8.7.7): the
 * topic's brief — for the unit's one topic, discovery's log and the unit's
 * seeds; the record of every other topic decided so far, never its log; the
 * product record with the findings it holds from the code; and the unit's
 * spikes. Resuming adds the topic's own record (9.3.11) and the reports of
 * agents an earlier conversation dispatched, landed since it left, with
 * those lost with it (9.7.8). The log comes with every entry's.
 * @param {Entering} at @returns {Line[]}
 */
function discussionReads({ cwd, unit, topic, manifest, started, sessionId }) {
  const own = topic === unit;
  const seeds = Array.isArray(manifest.seeds) ? manifest.seeds.filter((seed) => typeof seed?.path === 'string') : [];
  const decided = liveTopics(unit, manifest).filter((other) => other !== topic && computeTopicLifecycle(manifest, other).lifecycle === 'decided');
  const agents = earlierAgents(cwd, unit, 'discussion', topic, sessionId);
  /** @param {string} key @returns {(value: string) => Line} */
  const as = (key) => (value) => [key, value];
  return [
    ...existing([statePath(cwd, unit, 'discovery', 'briefs', `${topic}.md`)]).map(as('brief')),
    ...(own ? filesIn(statePath(cwd, unit, 'discovery', 'sessions')) : []).map(as('discovery log')),
    ...(own ? existing(seeds.map((seed) => statePath(cwd, unit, seed.path))) : []).map(as('seed')),
    ...decided.map((other) => as('decided')(`\`${recordCall(unit, other)}\``)),
    as('product')(`\`${productCall()}\``),
    ...filesIn(statePath(cwd, unit, 'spikes')).map(as('spike')),
    ...(started ? [] : [as('record')(`\`${recordCall(unit, topic)}\``)]),
    ...agents.landed.map(({ file }) => as('landed')(file)),
    ...agents.lost.map(as('lost')),
  ];
}

/** @type {Readonly<Record<string, Entry>>} */
const ENTRIES = Object.freeze({
  discussion: {
    standing: discussionStanding,
    unstarted: (manifest, topic) => ['unstarted', undefined].includes(itemOf(manifest, 'discussion', topic)?.status),
    start: (cwd, unit, topic) => { startTopic(cwd, unit, 'discussion', topic); },
    questions: () => [],
    reads: discussionReads,
    log: topicLog,
  },
});

const ENTER_USAGE = `enter <${Object.keys(ENTRIES).join('|')}> <work-unit> [<topic>]`;

/**
 * The unit's manifest, refused where this project has no such unit or it
 * is not in progress.
 * @param {string} cwd @param {string} unit @returns {Record<string, any>}
 */
function unitInProgress(cwd, unit) {
  const manifest = workUnitNameRefusal(unit) === null ? manifestOf(stateRoot(cwd), unit) : null;
  if (manifest === null) throw new Error(`there is no work unit "${unit}" — the start menu lists the work in progress`);
  if (manifest.status === 'cancelled') throw new Error(`${unit} is cancelled — reactivating it comes first`);
  if (manifest.status !== 'in-progress') throw new Error(`${unit} is ${manifest.status} — new work starts from the start menu`);
  return manifest;
}

/**
 * The topic the entry is at — the unit itself where it has one topic and
 * none is named — refused where the work type has no place for the phase,
 * an epic names none, the name is not one, the unit has its spec, or it has
 * no such topic.
 * @param {string} cwd @param {Record<string, any>} manifest @param {string} phase @param {string} unit @param {string|undefined} named
 * @returns {string}
 */
function topicAt(cwd, manifest, phase, unit, named) {
  const type = manifest.work_type;
  const pipeline = WORK_TYPE_PIPELINES[/** @type {keyof typeof WORK_TYPE_PIPELINES} */ (type)] ?? [];
  if (!pipeline.includes(phase)) throw new Error(`a ${type} has no ${phase} — its phases are ${pipeline.join(', ')}`);
  if (named === undefined && type === 'epic') throw new Error(`an epic enters ${phase} at one of its topics — name the topic: engine enter ${phase} ${unit} <topic>`);
  const topic = named ?? unit;
  const illegal = illegalNameReason('topic', topic);
  if (illegal !== null) throw new Error(illegal);
  if (fs.existsSync(statePath(cwd, unit, 'spec.md'))) throw new Error(`${unit} has its spec — a topic exists only before it, and a change is settled in the spec from here`);
  if (!(topic === unit && type !== 'epic') && !hasTopic(manifest, topic)) {
    throw new Error(type === 'epic'
      ? `${unit} has no topic "${topic}" — the epic's map holds its topics, and a new one comes through its discovery`
      : `${unit} has no topic "${topic}" — a ${type}'s topic is the unit itself`);
  }
  return topic;
}

/**
 * Start the topic and commit the start, in one hold of the writer lock:
 * the response's commit fields.
 * @param {string} cwd @param {Entry} entry @param {string} phase @param {string} unit @param {string} topic
 * @returns {{committed: string|null, note?: string, warnings?: string[]}}
 */
function startAndCommit(cwd, entry, phase, unit, topic) {
  /** @type {string[]} */
  const warnings = [];
  const outcome = withWorkUnitLock(cwd, unit, () => {
    entry.start(cwd, unit, topic);
    return commitStateTail(cwd, `${unit}/manifest.json`, `${phase}(${unit}): start ${topic}`, warnings);
  });
  /** @type {{committed: string|null, note?: string, warnings?: string[]}} */
  const result = { committed: outcome.committed };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome, `${unit} --state`);
  return result;
}

/**
 * `enter`: the response line and the sections after it.
 * @param {string} cwd @param {string[]} argv
 * @returns {{response: Record<string, unknown>, sections: string}}
 */
function enter(cwd, argv) {
  const [phase, unit, named, ...extra] = argv;
  if (!Object.hasOwn(ENTRIES, phase) || !unit || named === '' || extra.length > 0) throw new Error(`Usage: engine ${ENTER_USAGE}`);
  const entry = ENTRIES[phase];
  const manifest = unitInProgress(cwd, unit);
  const topic = topicAt(cwd, manifest, phase, unit, named);
  const standing = entry.standing(manifest, topic);
  if (standing !== null) throw new Error(standing);
  const started = entry.unstarted(manifest, topic);
  const commit = started ? startAndCommit(cwd, entry, phase, unit, topic) : {};
  arriveAt(cwd, unit, phase, topic);
  beatQuietly(cwd, unit, phase, topic);
  const sessionId = handedSession();
  /** @type {Entering} */
  const at = { cwd, unit, topic, manifest, started, sessionId };
  const log = statePath(cwd, entry.log(unit, topic));
  const header = owedHeader(log, sessionId, sessionId === null ? null : runningTranscript(sessionId));
  /** @type {Line[]} */
  const lines = [...entry.reads(at), ['log', log], ...(header === null ? [] : /** @type {Line[]} */ ([['log header', header]]))];
  return { response: { phase, unit, topic, started, ...commit }, sections: entrySections(entry.questions(at), lines) };
}

module.exports = { ENTER_USAGE, ENTRIES, enter };
