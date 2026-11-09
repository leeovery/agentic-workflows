'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the entry (CONVENTIONS, Entering) — `enter <phase> <unit>
// [<topic>] [--take] [--move]`, the one call a phase is entered by. It
// refuses what cannot be entered, each refusal naming the way on: a unit
// this project lacks or has closed, a phase its work type has no place for,
// and what the phase's own row refuses. Where another live session holds the
// place, or what the row holds beyond it, it asks first (18.4.21, 12.7.8) —
// its question the whole answer, nothing written — and `--take` enters all
// the same. Otherwise it starts what is not yet started, writing nothing
// ahead of its opening (9.3.1), and commits that start — discussion's entry
// at a feature's topic closed into its spec voiding that close, the
// discussion going on (9.7.9), in the same commit; records where the
// conversation is working — its position, the tmux label and the place's
// presence, as `session label` and `topic start` do; and answers what the phase needs to begin or resume, in sections: any
// question first, then a DATA naming what to read, as paths and engine
// calls, never their contents, read as the place stood before the entry
// wrote anything, and the log the conversation keeps, where it keeps one,
// with the line it opens its next write with (8.14.8) — or, for a row that
// writes that line itself, the line written; what a read of the ledger said
// on the way rides the response as warnings. The reading comes after the
// question (2.10.3).
//
// A phase enters through its row of `ENTRIES`: its level — at a topic, or at
// the work unit — whether the product's conversation enters through it too,
// why it cannot be entered as it stands (topic-standing.cjs, the rule a
// handoff into a topic and a message to one share), whether and how it
// starts, the questions it raises first, what it reads, its log where it
// keeps one, where a level move leaves from, what it closes as the
// conversation arrives — specification's, a review pass an earlier
// conversation left running; the build's, the tasks another conversation
// left in flight, taken onto this one's — and what of its own holds it
// beyond its place: the build's, another session holding the checkout's
// code, whose question comes before the place's own and is answered as it
// is (12.7.8). A topic-level row refuses an epic entered at no topic, a
// topic once the unit has its spec (4.11.2), and a topic the unit lacks; a
// unit-level row takes no topic, and is entered after the spec as before
// it. Discussion is the first row, discovery the second
// (discovery-entry.cjs), specification the third (spec-entry.cjs),
// implementation, the build, the fourth (build-entry.cjs) — which hands a
// quick-fix to an arm of its own, the row read from the unit once it is
// found — the review phase the fifth (review-entry.cjs), whose arrival
// snapshots the working tree, and a bugfix's investigation the sixth,
// entered at its one topic as a feature's discussion is, its log the
// investigation (19.4.3); each later phase adds its own as its rewrite moves
// it onto the entry. A unit-level place is the unit itself, as a
// single-topic unit's topic is; the product's is `product`, a project place
// with no manifest of its own, whose marker and lock are the project
// manifest's.
//
// A level move (`--move`, discovery's alone) leaves the place the
// conversation works in as it enters the next, with no handoff (24.1.8): the
// row's departure writes what leaving writes, and the move's commit takes it
// with any start.
//
// The refusals, the question and the reads take no lock, but a read of the
// tracker, which takes the state's lock as every reader of it does
// (phase-checks.cjs). The start and the move hold the writer lock around
// their writes and the commit; the position, the label, the presence, what
// a row closes in the cache and the line a row writes into its log are
// outside the state's commits, the log riding the next.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { PRODUCT } = require('../kernel/manifest-schema.cjs');
const { withWorkUnitLock, withProjectLock, readProjectManifest, loadWorkUnitManifest, saveWorkUnitManifest } = require('../kernel/manifest.cjs');
const { statePath, stateRoot } = require('../kernel/state-root.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { liveTopics } = require('./ledger-units.cjs');
const { seedFiles } = require('./reads.cjs');
const { computeTopicLifecycle, itemOf, briefFile, topicTitle, topicKey, closedIntoSpec, voidDecidedClose, EARLIER, earlierFile } = require('./derivations.cjs');
const { carriedTo } = require('./ledger-fold.cjs');
const { keptBranches } = require('./fix-branch.cjs');
const { unitInProgress, assertPhaseHeld, phaseStanding } = require('./topic-standing.cjs');
const { startTopic } = require('./transitions.cjs');
const { commitStateTail, noteCommitOutcome, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { sessionLogs } = require('./discovery-session.cjs');
const { arriveAt } = require('./session-label.cjs');
const { beatQuietly, peerHold } = require('./presence.cjs');
const { agentsLeft } = require('./agent-state.cjs');
const { runningTranscript } = require('./conversation.cjs');
const { topicLog, ledgerView, recordCall, productCall, owedHeader, appendLine } = require('./topic-log.cjs');
const { entrySections, heldGate } = require('./projections/enter.cjs');
const { waitingMessages } = require('./mail.cjs');
const { waitingMail } = require('./projections/mail.cjs');
const { DISCOVERY } = require('./discovery-entry.cjs');
const { SPECIFICATION } = require('./spec-entry.cjs');
const { IMPLEMENTATION } = require('./build-entry.cjs');
const { REVIEW } = require('./review-entry.cjs');
const { earlierRecord, earlierReads } = require('./earlier-record.cjs');

/** @typedef {[string, string]} Line a DATA line, its key and its value */

/**
 * The ways on from a question the entry puts where its place is held: the
 * entry again with `--take`, and the epic's menu to go back to, null where
 * there is none.
 * @typedef {{take: string[], menu: {skill: string, args: string[]}|null}} HeldWays
 */

/** @typedef {import('./topic-standing.cjs').Standing} Standing */

/**
 * What a row reads from once it is entered: where the entry is, whether
 * this entry started it, and what a read of the ledger said on the way.
 * @typedef {Standing & {started: boolean, voided: boolean, notes: string[]}} Entering
 */

/**
 * Where a level move leaves from: the place, as one line; the logs leaving
 * it writes, which the move commits; and the leaving itself, once the log
 * of the unit moved to is known.
 * @typedef {object} Departure
 * @property {string} line
 * @property {string[]} logs absolute
 * @property {(to: string, unit: string) => void} leave  `to` the log moved to, absolute
 */

/**
 * A phase's row: its level, and whether the product's conversation enters
 * through it too; why it cannot be entered as it stands, or null; whether
 * it is yet to start, and what starts it; the questions owed before
 * anything is read, each a section drawn whole; what it reads, as the place stood before
 * the entry wrote anything; the log its conversation keeps, state-relative,
 * where it keeps one, and whether the entry writes the conversation's line
 * into it rather than naming it; where a level move into it leaves from,
 * for a row that takes one, which keeps a log; what it closes as the
 * conversation arrives, before it reads, for a row that closes anything;
 * and the question it puts where something of its own holds it beyond its
 * place, drawn whole, for a row that has such a hold. A start that commits
 * a write of its own through the tracker's verbs, which commit their own
 * (task-verbs.cjs), answers what that commit warned of. A row may hand a
 * unit to an arm of its own, where its work type is built by another rule
 * — the build's, a quick-fix's (build-entry.cjs) — the arm entering at the
 * row's level.
 * @typedef {object} Entry
 * @property {'topic'|'unit'} level
 * @property {boolean} [product]
 * @property {(manifest: Record<string, any>) => Entry|null} [arm]
 * @property {(at: Standing) => string|null} standing
 * @property {(at: Standing, ways: HeldWays) => string|null} [held]
 * @property {(at: Standing) => boolean} unstarted
 * @property {(cwd: string, unit: string, topic?: string) => string[]|void} start
 * @property {(at: Standing) => boolean} [voids]
 * @property {(at: Entering) => string[]} questions
 * @property {(at: Entering) => Line[]} reads
 * @property {(at: Entering) => string} [log]
 * @property {boolean} [writesHeader]
 * @property {(at: Standing) => Departure} [move]
 * @property {(at: Standing) => void} [closes]
 */

/** The files in a state folder, sorted, as absolute paths; none where it is not there. @param {string} dir absolute */
function filesIn(dir) {
  try {
    return fs.readdirSync(dir).sort().map((name) => path.join(dir, name));
  } catch {
    return [];
  }
}

/** A unit's discovery session logs, in order, as absolute paths. @param {string} cwd @param {string} unit */
function discoveryLogs(cwd, unit) {
  const dir = statePath(cwd, unit, 'discovery');
  return sessionLogs(dir).map(({ file }) => path.join(dir, file));
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
 * The earlier record a topic postponed elsewhere and pulled here reads at its
 * first opening, as input it never changes (18.8.17): none where it has none.
 * @param {string} cwd @param {Record<string, any>} manifest @param {string} unit @param {string} topic
 * @returns {Line[]}
 */
function earlierLines(cwd, manifest, unit, topic) {
  const address = earlierRecord(readProjectManifest(cwd), manifest, unit, topic);
  if (address === null) return [];
  const { brief, record, log, mail } = earlierReads(cwd, address);
  return [
    ...(brief === undefined ? [] : [/** @type {Line} */ (['earlier brief', brief])]),
    /** @type {Line} */ (['earlier record', `\`${record}\``]),
    ...(log === undefined ? [] : [/** @type {Line} */ (['earlier log', log])]),
    ...mail.map((message) => /** @type {Line} */ (['earlier mail', message])),
  ];
}

/** A DATA line's key, put to each value. @param {string} key @returns {(value: string) => Line} */
const as = (key) => (value) => [key, value];

/**
 * What a moved unit's topic holds from the type it was (workunit-move.cjs,
 * 19.5.16), read at its first opening as input it never changes, each by
 * what the move carried: the topic's record where lines were carried to
 * it, a bugfix's investigation log, and a quick-fix's build log, its
 * fixes' short records, `summary.md`, and each round's report of its
 * review, in order, where they were set aside, and the quick-fix's branch
 * kept in each repository whose commits on it stand unlanded — none where
 * the move carried none of it.
 * @param {Entering} at @returns {Line[]}
 */
function carriedBefore({ cwd, unit, topic = '', notes }) {
  const earlier = (/** @type {string} */ name) => existing([statePath(cwd, earlierFile(unit, topic, name))]);
  /** @type {string[]} */
  const rounds = [];
  for (let round = 1; ; round += 1) {
    const report = earlier(`${EARLIER.review}/round-${round}.md`);
    if (report.length === 0) break;
    rounds.push(...report);
  }
  return [
    ...(carriedTo(stateRoot(cwd), unit, topic, notes) ? [as('earlier record')(`\`${recordCall(unit, topic)}\``)] : []),
    ...earlier(EARLIER.investigationLog).map(as('earlier log')),
    ...earlier(`${EARLIER.build}/log.md`).map(as('earlier build log')),
    ...earlier(EARLIER.summary).map(as('earlier summary')),
    ...rounds.map(as('earlier review round')),
    ...keptBranches(cwd, unit).map(as('kept branch')),
  ];
}

/**
 * What a topic reads first at its opening (9.3.2, 8.7.7): each message
 * waiting, its name the one `topic answered` takes; the topic's brief; and
 * for the unit's one topic, discovery's log and the unit's seeds.
 * @param {Entering} at @returns {Line[]}
 */
function openingReads({ cwd, unit, topic = '', manifest }) {
  const own = topic === unit;
  return [
    ...waitingMessages(cwd, unit, topic).map(({ path: message }) => as('mail')(message)),
    ...existing([statePath(cwd, briefFile(unit, topic))]).map(as('brief')),
    ...(own ? discoveryLogs(cwd, unit) : []).map(as('discovery log')),
    ...(own ? seedFiles(cwd, unit, manifest) : []).map(as('seed')),
  ];
}

/** The product record's call, with what discovery found of the product, of the unit and of the topic. @param {Entering} at @returns {Line} */
const productRead = ({ unit, topic = '' }) => as('product')(`\`${productCall(unit, topic)}\``);

/**
 * The calls a resumed topic reads its views of the ledger by, `views` those
 * its phase reads; none at a first opening.
 * @param {Entering} at @param {readonly ('record'|'map'|'affected')[]} views @returns {Line[]}
 */
function resumedReads({ unit, topic = '', started }, views) {
  return started ? [] : views.map((view) => as(view)(`\`${ledgerView(view, unit, topic)}\``));
}

/**
 * The reports of the agents the topic was left with in its phase, landed
 * since, with those lost with a process that no longer runs (9.7.8).
 * @param {Entering} at @returns {Line[]}
 */
function agentReads({ cwd, unit, phase, topic = '' }) {
  const agents = agentsLeft(cwd, unit, phase, topic);
  return [...agents.landed.map(({ file }) => as('landed')(file)), ...agents.lost.map(as('lost'))];
}

/**
 * What a discussion reads before its opening (9.3.2–9.3.6, 8.7.7): what a
 * topic reads first; the record of every other topic decided so far, never
 * its log; the product record, with what discovery found of the product and
 * of the unit, which no topic's record shows, and of the topic, which a
 * first opening reads no record for (9.3.6, 9.3.12); the unit's spikes; and,
 * at a first opening, the earlier record of a topic postponed elsewhere, and
 * what a move carried to the topic from the type the unit was
 * (`carriedBefore`).
 * Resuming adds the topic's own record (9.3.11), its map, and the entries a
 * replacement changed under it, each confirmed or replaced in the
 * conversation (9.3.6); then the agents the topic was left with. The log
 * comes with every entry's.
 * @param {Entering} at @returns {Line[]}
 */
function discussionReads(at) {
  const { cwd, unit, topic = '', manifest, started } = at;
  const decided = liveTopics(unit, manifest).filter((other) => other !== topic && computeTopicLifecycle(manifest, other).lifecycle === 'decided');
  return [
    ...openingReads(at),
    ...decided.map((other) => as('decided')(`\`${recordCall(unit, other)}\``)),
    productRead(at),
    ...filesIn(statePath(cwd, unit, 'spikes')).map(as('spike')),
    ...(started ? [...earlierLines(cwd, manifest, unit, topic), ...carriedBefore(at)] : []),
    ...resumedReads(at, ['record', 'map', 'affected']),
    ...agentReads(at),
  ];
}

/**
 * What an investigation reads before its opening (8.7.7): what a topic
 * reads first, and the product record; at a first opening, what a move
 * carried to the topic from the quick-fix the unit was (`carriedBefore`);
 * resuming adds its record and its map; then the agents it was left with.
 * The log, the investigation itself (19.4.3), comes with every entry's.
 * @param {Entering} at @returns {Line[]}
 */
function investigationReads(at) {
  return [...openingReads(at), productRead(at), ...(at.started ? carriedBefore(at) : []), ...resumedReads(at, ['record', 'map']), ...agentReads(at)];
}

/**
 * The row of a phase talked through at a topic, whose item it starts as
 * `topic start` does, raising waiting mail first and keeping the topic's log:
 * discussion's, and a bugfix's investigation, its one topic the unit.
 * @param {'discussion'|'investigation'} phase @param {(at: Entering) => Line[]} reads @returns {Entry}
 */
function topicRow(phase, reads) {
  return {
    level: 'topic',
    standing: phaseStanding(phase),
    unstarted: ({ manifest, topic = '' }) => ['unstarted', undefined].includes(itemOf(manifest, phase, topic)?.status),
    start: (cwd, unit, topic = '') => { startTopic(cwd, unit, phase, topic); },
    ...(phase === 'discussion' ? { voids: (/** @type {Standing} */ { manifest }) => closedIntoSpec(manifest) } : {}),
    questions: mailRaised,
    reads,
    log: ({ unit, topic = '' }) => topicLog(unit, topic),
  };
}

/** @type {Readonly<Record<string, Entry>>} */
const ENTRIES = Object.freeze({
  discussion: topicRow('discussion', discussionReads),
  discovery: DISCOVERY,
  specification: SPECIFICATION,
  implementation: IMPLEMENTATION,
  review: REVIEW,
  investigation: topicRow('investigation', investigationReads),
});

const TAKE = '--take';
const MOVE = '--move';
const FLAGS = [TAKE, MOVE];

/** The entry's usage, over the phases a table enters. @param {Readonly<Record<string, Entry>>} entries */
function enterUsage(entries) {
  const rows = Object.values(entries);
  const unit = rows.some((entry) => entry.product) ? `<work-unit|${PRODUCT}>` : '<work-unit>';
  const move = rows.some((entry) => entry.move) ? ` [${MOVE}]` : '';
  return `enter <${Object.keys(entries).join('|')}> ${unit} [<topic>] [${TAKE}]${move}`;
}

const ENTER_USAGE = enterUsage(ENTRIES);

/**
 * The call's words and the flags trailing them, refused as a usage error
 * where it names no row, no unit, an empty topic, a flag but the entry's, a
 * flag twice, a move into a row that takes none, or an extra argument.
 * @param {Readonly<Record<string, Entry>>} entries @param {string[]} argv
 * @returns {{phase: string, unit: string, named: string|undefined, take: boolean, move: boolean}}
 */
function parseEntry(entries, argv) {
  let end = argv.length;
  while (end > 0 && FLAGS.includes(argv[end - 1])) end -= 1;
  const flags = argv.slice(end);
  const [phase, unit, named, ...extra] = argv.slice(0, end);
  const move = flags.includes(MOVE);
  const bad = !Object.hasOwn(entries, phase) || !unit || named === '' || named?.startsWith('--') || extra.length > 0
    || new Set(flags).size !== flags.length || (move && !entries[phase].move);
  if (bad) throw new Error(`Usage: engine ${enterUsage(entries)}`);
  return { phase, unit, named, take: flags.includes(TAKE), move };
}

/**
 * The topic an entry is at — at a topic-level row the one named, by its key
 * or its title, else the unit's own where it has one topic; none at a
 * unit-level row, which refuses one named.
 * @param {Entry} entry @param {Record<string, any>} manifest @param {string} phase @param {string} unit @param {string|undefined} named
 * @returns {string|undefined}
 */
function topicOf(entry, manifest, phase, unit, named) {
  if (entry.level === 'topic' && named !== undefined) return topicKey(manifest, named);
  if (entry.level === 'topic') return manifest.work_type === 'epic' ? undefined : unit;
  if (named !== undefined) throw new Error(`${phase} is entered at the work unit — name no topic: engine enter ${phase} ${unit}`);
  return undefined;
}

/**
 * Where the entry stands on arrival: the product's conversation, for a row
 * it enters through — never read as a unit, having no manifest of its own —
 * or a unit this project has in progress, its work type holding the phase.
 * @param {Entry} entry @param {string} cwd @param {string} phase @param {string} unit @param {string|undefined} named
 * @returns {Standing}
 */
function standingOf(entry, cwd, phase, unit, named) {
  if (unit === PRODUCT && entry.product) {
    if (named !== undefined) throw new Error(`${phase} is entered at the product — name no topic: engine enter ${phase} ${PRODUCT}`);
    return { cwd, phase, unit, manifest: readProjectManifest(cwd) };
  }
  const manifest = unitInProgress(cwd, unit);
  assertPhaseHeld(manifest, phase);
  return { cwd, phase, unit, topic: topicOf(entry, manifest, phase, unit, named), manifest };
}

/**
 * How an entry holds its place: the writer lock over the manifest its start
 * writes, that manifest, state-relative, the retry a commit git refuses
 * names, and the arrival — the product's conversation a project place, named
 * by its identity alone.
 * @typedef {object} Held
 * @property {<T>(fn: () => T) => T} lock
 * @property {string} manifest
 * @property {string} retry
 * @property {() => void} arrive
 */

/** @param {string} cwd @param {string} phase @param {string} unit @param {string} place @returns {Held} */
function heldAt(cwd, phase, unit, place) {
  if (unit === PRODUCT) {
    return { lock: (fn) => withProjectLock(cwd, fn), manifest: PROJECT_MANIFEST_SPEC, retry: '--product', arrive: () => { arriveAt(cwd, PRODUCT); } };
  }
  return { lock: (fn) => withWorkUnitLock(cwd, unit, fn), manifest: `${unit}/manifest.json`, retry: `${unit} --state`, arrive: () => { arriveAt(cwd, unit, phase, place); } };
}

/**
 * A feature's topic's close into its spec voided as its discussion is
 * entered again (9.7.9), read and saved under the writer lock the caller
 * holds.
 * @param {string} cwd @param {string} unit @param {string} topic
 */
function voidOnEntry(cwd, unit, topic) {
  const manifest = loadWorkUnitManifest(cwd, unit);
  if (voidDecidedClose(manifest, topic, new Date().toISOString())) saveWorkUnitManifest(cwd, unit, manifest);
}

/**
 * Start what the row starts, void the close its entry goes on past, and
 * leave where a level move leaves, committing all three in one hold of the
 * writer lock: the response's commit fields. The start and the void commit
 * the manifest they wrote, and the move the logs leaving wrote,
 * a topic's sitting among them; every log changed rides along — a start's
 * own commit's warnings, where it made one, among the response's.
 * @param {string} cwd @param {Entry} entry @param {Entering} at @param {Held} held @param {Departure|null} departure
 * @returns {{committed: string|null, note?: string, warnings?: string[]}}
 */
function settle(cwd, entry, at, held, departure) {
  const { phase, unit, topic, started, voided } = at;
  /** @type {string[]} */
  const warnings = [];
  const message = departure !== null
    ? `${phase}(${unit}): carried on from ${departure.line}`
    : topic === undefined ? `${phase}(${unit}): start` : `${phase}(${unit}): ${voided ? 'carry on' : 'start'} ${topic}`;
  const outcome = held.lock(() => {
    if (started) warnings.push(...(entry.start(cwd, unit, topic) ?? []));
    if (voided) voidOnEntry(cwd, unit, /** @type {string} */ (topic));
    departure?.leave(statePath(cwd, /** @type {NonNullable<Entry['log']>} */ (entry.log)(at)), unit);
    return commitStateTail(cwd, [...(started || voided ? [held.manifest] : []), ...(departure?.logs ?? [])], message, warnings);
  });
  /** @type {{committed: string|null, note?: string, warnings?: string[]}} */
  const result = { committed: outcome.committed };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome, held.retry);
  return result;
}

/**
 * The ways on from a question the entry puts where its place is held:
 * proceeding is the entry again with `--take`, a move kept a move; leaving
 * it goes back to the epic's menu, a single-topic unit or the product's
 * conversation having none to hand off to.
 * @param {Standing} at @param {boolean} move @returns {HeldWays}
 */
function waysOn({ phase, unit, topic, manifest }, move) {
  return {
    take: ['enter', phase, unit, ...(topic === undefined ? [] : [topic]), TAKE, ...(move ? [MOVE] : [])],
    menu: manifest.work_type === 'epic' ? { skill: 'leeway-continue-epic', args: [unit] } : null,
  };
}

/**
 * The question put where the place is held, or null where it is not: the
 * row's own hold first, where it has one — the build's, the checkout's code
 * — then another live session at the place itself.
 * @param {Entry} entry @param {Standing} at @param {string} place @param {boolean} move
 * @returns {string|null}
 */
function heldQuestion(entry, at, place, move) {
  const ways = waysOn(at, move);
  const own = entry.held?.(at, ways) ?? null;
  if (own !== null) return own;
  const hold = peerHold(at.cwd, at.unit, at.phase, place);
  if (hold === null) return null;
  return heldGate({ unit: at.unit, phase: at.phase, place, title: topicTitle(at.manifest, place), ageSeconds: hold.age_seconds, ...ways });
}

/**
 * `enter` through a table of rows: the response line and the sections after
 * it.
 * @param {Readonly<Record<string, Entry>>} entries @param {string} cwd @param {string[]} argv
 * @returns {{response: Record<string, unknown>, sections: string}}
 */
function enterThrough(entries, cwd, argv) {
  const { phase, unit, named, take, move } = parseEntry(entries, argv);
  const row = entries[phase];
  const at = standingOf(row, cwd, phase, unit, named);
  const entry = row.arm?.(at.manifest) ?? row;
  const standing = entry.standing(at);
  if (standing !== null) throw new Error(standing);
  const departure = move ? /** @type {NonNullable<Entry['move']>} */ (entry.move)(at) : null;
  const { topic } = at;
  const atTopic = topic === undefined ? {} : { topic };
  const place = topic ?? unit;
  const stop = take ? null : heldQuestion(entry, at, place, move);
  if (stop !== null) return { response: { phase, unit, ...atTopic, entered: false }, sections: stop };
  /** @type {Entering} */
  const entering = { ...at, started: entry.unstarted(at), voided: entry.voids?.(at) ?? false, notes: [] };
  entry.closes?.(at);
  const reads = entry.reads(entering);
  const held = heldAt(cwd, phase, unit, place);
  /** @type {{committed?: string|null, note?: string, warnings?: string[]}} */
  const commit = entering.started || entering.voided || departure !== null ? settle(cwd, entry, entering, held, departure) : {};
  held.arrive();
  beatQuietly(cwd, unit, phase, place);
  const lines = [...reads, ...logLines(cwd, entry, entering)];
  const warnings = [...entering.notes, ...(commit.warnings ?? [])];
  return {
    response: { phase, unit, ...atTopic, entered: true, started: entering.started, ...commit, ...(warnings.length > 0 ? { warnings } : {}) },
    sections: entrySections(entry.questions(entering), lines),
  };
}

/**
 * The DATA's last lines, for a row whose conversation keeps a log: the log,
 * then the line the conversation's next write opens with where it owes one
 * — or, for a row that writes that line itself, none, the line written.
 * @param {string} cwd @param {Entry} entry @param {Entering} at
 * @returns {Line[]}
 */
function logLines(cwd, entry, at) {
  if (entry.log === undefined) return [];
  const log = statePath(cwd, entry.log(at));
  const sessionId = handedSession();
  const header = owedHeader(log, sessionId, sessionId === null ? null : runningTranscript(sessionId));
  if (header !== null && entry.writesHeader) appendLine(log, header);
  const owed = entry.writesHeader ? null : header;
  return [['log', log], ...(owed === null ? [] : /** @type {Line[]} */ ([['log header', owed]]))];
}

/**
 * `enter`: the response line and the sections after it.
 * @param {string} cwd @param {string[]} argv
 */
function enter(cwd, argv) {
  return enterThrough(ENTRIES, cwd, argv);
}

module.exports = { ENTER_USAGE, ENTRIES, enter, enterThrough };
