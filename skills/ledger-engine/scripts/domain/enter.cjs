'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the entry (CONVENTIONS, Entering) — `enter <phase> <unit>
// [<topic>] [--take] [--move] [--type-call] [--seeds <seeds>]`, the one call
// a phase is entered by. It
// refuses what cannot be entered, each refusal naming the way on: a unit
// this project lacks or has closed, a phase its work type has no place for,
// and what the phase's own row refuses. Where another live session holds the
// place, or what the row holds beyond it, it asks first (18.4.21, 12.7.8) —
// its question the whole answer, nothing written — and `--take` enters all
// the same; but the product's conversation, which several conversations
// share, each with a presence row of its own (presence.cjs), asks no one. Otherwise it starts what is not yet started, writing nothing
// ahead of its opening (9.3.1), and commits that start — discussion's entry
// at a feature's topic closed into its spec voiding that close, the
// discussion going on (9.7.9), in the same commit; records where the
// conversation is working — its position, the session label and the place's
// presence, as `session label` does — when it entered the place
// (place-entry.cjs), and the conversation entering it (catch-up.cjs); and
// answers what
// the phase needs to begin or resume, in sections: any question first, then
// a DATA naming what to read, as
// paths and engine calls, never their contents, read as the place stood
// before the entry wrote anything, and the log the conversation keeps, where it keeps one,
// with the line it opens its next write with (8.14.8) — or, for a row that
// writes that line itself, the line written; what a read of the ledger said
// on the way rides the response as warnings. The reading comes after the
// question (2.10.3). After the row's reads, the DATA names each
// conversation before this one to catch up on (catch-up.cjs). Between the row's reads
// and the log, the DATA names the place's legacy folder where it holds
// files — what the migration kept from
// before Ledger with no other place, there to look in — and the record of
// the person wherever its file stands (16.18.4, person.cjs) — none while the
// person has kept nothing — never reading either, so neither refuses an
// entry. Beside the legacy folder, an entry into a phase whose work reads
// the code against the record's decisions names the shared reference on
// decisions from before Ledger, where the work holds one
// (decisions-from-before.cjs): that read is taken with the row's, the
// ledger checked once for both (ledger.cjs, `withOneCheck`).
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
// is (12.7.8). A row may ready its place before it starts: the build's
// runs the steps that prepare the environment before its first task
// (build-entry.cjs), each run named in the DATA, one that fails refusing
// the entry before anything is written. A topic-level row refuses an epic
// entered at no topic, a topic once the unit has its spec (4.11.2), and a
// topic the unit lacks; a
// unit-level row takes no topic, and is entered after the spec as before
// it. Discussion is the first row, discovery the second
// (discovery-entry.cjs), specification the third (spec-entry.cjs),
// implementation, the build, the fourth (build-entry.cjs) — which hands a
// quick-fix to an arm of its own, the row read from the unit once it is
// found — the review phase the fifth (review-entry.cjs), whose arrival
// snapshots the working tree, a bugfix's investigation the sixth,
// entered at its one topic as a feature's discussion is, its log the
// investigation (19.4.3), and the laboratory the seventh, at the topic whose
// series holds its experiments (experiment-entry.cjs). A unit-level place is
// the unit itself, as a single-topic unit's topic is; the product's is
// `product`, a project place with no manifest of its own, whose marker and
// lock are the project manifest's.
//
// A level move (`--move`, discovery's alone) leaves the place the
// conversation works in as it enters the next, with no handoff (24.1.8): the
// row's departure writes what leaving writes, and the move's commit takes it
// with any start. The type call (`--type-call`, discovery's alone too) takes
// no place: it answers what its row reads for it, and nothing is asked
// first, started, written or recorded (discovery-entry.cjs). Seeds
// (`--seeds`, discovery's alone too) are what the handoff into the phase
// carried, checked by the row before anything is written, and read from
// (seeds.cjs). A record (`--record`, the
// laboratory's alone) is the one of the place's several the entry works,
// checked by the row before anything is written; where the call names none
// and the place holds several, the row asks which after any hold's question,
// nothing written, each answer the entry again naming its record. The record
// worked, named or the one there is, rides the conversation's position, so
// what reads it later — the verbs' way on, a compaction's note, the board —
// knows which.
//
// The refusals, the question, what a row readies and the reads take no
// lock, but a read of the tracker, which takes the state's lock as every
// reader of it does (phase-checks.cjs). The start and the move hold the writer lock around
// their writes and the commit; the position, the label, the presence, the
// entry's time, what a row closes in the cache and the line a row writes
// into its log are outside the state's commits, the log riding the next.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { PRODUCT } = require('../kernel/manifest-schema.cjs');
const { withWorkUnitLock, withProjectLock, readProjectManifest, loadWorkUnitManifest, saveWorkUnitManifest } = require('../kernel/manifest.cjs');
const { statePath, stateRoot } = require('../kernel/state-root.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { liveTopics } = require('./ledger-units.cjs');
const { seedFiles } = require('./reads.cjs');
const { computeTopicLifecycle, itemOf, briefFile, topicTitle, topicKey, closedFrom, voidTopicClose, EARLIER, earlierFile } = require('./derivations.cjs');
const { carriedTo } = require('./ledger-fold.cjs');
const { keptBranches } = require('./fix-branch.cjs');
const { keptAside, keptWords } = require('./fix-aside.cjs');
const { unitInProgress, assertPhaseHeld, phaseStanding } = require('./topic-standing.cjs');
const { startTopic } = require('./transitions.cjs');
const { commitStateTail, noteCommitOutcome, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { sessionLogs } = require('./discovery-session.cjs');
const { arriveAt } = require('./session-label.cjs');
const { beatQuietly, peerHold } = require('./presence.cjs');
const { recordEntry } = require('./place-entry.cjs');
const { owedAt, caughtUp } = require('./catch-up.cjs');
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
const { experimentRow } = require('./experiment-entry.cjs');
const { earlierRecord, earlierReads } = require('./earlier-record.cjs');
const { recordToRead } = require('./person.cjs');
const { PRODUCT_DIR } = require('./layout.cjs');
const { fromBeforeLines } = require('./decisions-from-before.cjs');
const { withOneCheck } = require('./ledger.cjs');
const { ontoEpic } = require('./topic-leave.cjs');

/** @typedef {[string, string]} Line a DATA line, its key and its value */

/**
 * The ways on from a question the entry puts where its place is held: the
 * entry again with `--take`, and the epic's menu to go back to, null where
 * there is none.
 * @typedef {{take: string[], menu: import('./projections/surfaces.cjs').Next|null}} HeldWays
 */

/** @typedef {import('./topic-standing.cjs').Standing} Standing */

/**
 * What a row reads from once it is entered: where the entry is, whether
 * this entry started it, what a read of the ledger said on the way, and
 * the seeds and the record the call named.
 * @typedef {Standing & {started: boolean, voided: boolean, notes: string[], seeds: string|null, record: string|null}} Entering
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
 * place, drawn whole, for a row that has such a hold; and, for a row that
 * takes seeds, the check refusing what it cannot take; for a row whose
 * place holds several records, the check refusing a record that is not one
 * it works, the question asking which where the call named none, drawn
 * whole, `again` the entry again naming the one picked, and the one it works
 * once nothing is asked, recorded on the position; and, for a row that
 * readies its place before its start, the readying, each line it adds to
 * the DATA; and, for a row that takes the type call, what it reads for it,
 * refusing a place it is not taken at. A start that commits
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
 * @property {(at: Standing, seeds: string) => void} [seeds]
 * @property {(at: Standing, record: string) => void} [record]
 * @property {(at: Standing, again: (record: string) => string[]) => string|null} [pick]
 * @property {(at: Standing, record: string|null) => string} [worked]
 * @property {(at: Entering) => Line[]} [readies]
 * @property {(at: Standing, seeds: string|null) => Line[]} [typeCall]
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

/** The DATA's key for each piece a move carried to the topic (`carriedBefore`), which the opening skill reads by it. */
const CARRIED = Object.freeze({
  record: 'earlier record',
  investigationLog: 'earlier log',
  buildLog: 'earlier build log',
  summary: 'earlier summary',
  reviewRound: 'earlier review round',
  branch: 'kept branch',
  work: 'kept work',
});

/**
 * What a moved unit's topic holds from the type it was (workunit-move.cjs,
 * 19.5.16), read at its first opening as input it never changes, each by
 * what the move carried: the topic's record where lines were carried to
 * it, a bugfix's investigation log, and a quick-fix's build log, its
 * fixes' short records in `summary.md`, and each round's report of its
 * review, in order, where they were set aside, the quick-fix's branch
 * kept in each repository whose commits on it stand unlanded, and each
 * fix's work it kept set aside (fix-aside.cjs) — none where the move
 * carried none of it.
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
    ...(carriedTo(stateRoot(cwd), unit, topic, notes) ? [as(CARRIED.record)(`\`${recordCall(unit, topic)}\``)] : []),
    ...earlier(EARLIER.investigationLog).map(as(CARRIED.investigationLog)),
    ...earlier(`${EARLIER.build}/log.md`).map(as(CARRIED.buildLog)),
    ...earlier(EARLIER.summary).map(as(CARRIED.summary)),
    ...rounds.map(as(CARRIED.reviewRound)),
    ...keptBranches(cwd, unit).map(as(CARRIED.branch)),
    ...keptAside(cwd, unit).map(keptWords).map(as(CARRIED.work)),
  ];
}

/**
 * What a topic stands on from discovery (8.7.7): its brief, and for the
 * unit's one topic, discovery's log and the unit's seeds.
 * @param {Entering} at @returns {Line[]}
 */
function groundReads({ cwd, unit, topic = '', manifest }) {
  const own = topic === unit;
  return [
    ...existing([statePath(cwd, briefFile(unit, topic))]).map(as('brief')),
    ...(own ? discoveryLogs(cwd, unit) : []).map(as('discovery log')),
    ...(own ? seedFiles(cwd, unit, manifest) : []).map(as('seed')),
  ];
}

/**
 * What a topic reads first at its opening (9.3.2): each message waiting,
 * its name the one `topic answered` takes, then what it stands on from
 * discovery.
 * @param {Entering} at @returns {Line[]}
 */
function openingReads(at) {
  const { cwd, unit, topic = '' } = at;
  return [...waitingMessages(cwd, unit, topic).map(({ path: message }) => as('mail')(message)), ...groundReads(at)];
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
 * A decided topic, entered for its entries relying on an answer replaced
 * since alone (10.2.6, topic-standing.cjs): it stays decided. None for any
 * other.
 * @param {Entering} at @returns {Line[]}
 */
function staysDecided({ manifest, topic = '' }) {
  return itemOf(manifest, 'discussion', topic)?.status === 'completed' ? [as('stays decided')('entered for its affected entries alone')] : [];
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
 * conversation (9.3.6) — for a decided topic, what it is entered for
 * (`staysDecided`); then the agents the topic was left with. The log comes
 * with every entry's.
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
    ...staysDecided(at),
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
 * The row of a phase talked through at a topic, whose item it starts
 * (startTopic), raising waiting mail first and keeping the topic's log:
 * discussion's, and a bugfix's investigation, its one topic the unit.
 * @param {'discussion'|'investigation'} phase @param {(at: Entering) => Line[]} reads @returns {Entry}
 */
function topicRow(phase, reads) {
  return {
    level: 'topic',
    standing: phaseStanding(phase),
    unstarted: ({ manifest, topic = '' }) => ['unstarted', undefined].includes(itemOf(manifest, phase, topic)?.status),
    start: (cwd, unit, topic = '') => { startTopic(cwd, unit, phase, topic); },
    voids: (/** @type {Standing} */ { manifest }) => closedFrom(manifest, phase),
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
  experiment: experimentRow(groundReads),
});

const TAKE = '--take';
const MOVE = '--move';
const SEEDS = '--seeds';
const RECORD = '--record';
const TYPE_CALL = '--type-call';
const FLAGS = [TAKE, MOVE, TYPE_CALL];

/** The flags that carry a value, each by the row's check that takes it. */
const VALUED = /** @type {const} */ ({ [SEEDS]: 'seeds', [RECORD]: 'record' });

/** @typedef {{seeds: string|null, record: string|null}} Valued */

/** The entry's usage, over the phases a table enters. @param {Readonly<Record<string, Entry>>} entries */
function enterUsage(entries) {
  const rows = Object.values(entries);
  const unit = rows.some((entry) => entry.product) ? `<work-unit|${PRODUCT}>` : '<work-unit>';
  const move = rows.some((entry) => entry.move) ? ` [${MOVE}]` : '';
  const typeCall = rows.some((entry) => entry.typeCall) ? ` [${TYPE_CALL}]` : '';
  const valued = Object.entries(VALUED).filter(([, key]) => rows.some((entry) => entry[key])).map(([flag, key]) => ` [${flag} <${key}>]`).join('');
  return `enter <${Object.keys(entries).join('|')}> ${unit} [<topic>] [${TAKE}]${move}${typeCall}${valued}`;
}

const ENTER_USAGE = enterUsage(ENTRIES);

/**
 * The call's words, the flags trailing them and the values its valued flags
 * carry, refused as a usage error where it names no row, no unit, an empty
 * topic, a flag but the entry's, a flag twice, no value after a valued
 * flag, a move, seeds or a record into a row that takes none, a type call
 * into a row that takes none or beside a move or a take, or an extra
 * argument.
 * @param {Readonly<Record<string, Entry>>} entries @param {string[]} argv
 * @returns {{phase: string, unit: string, named: string|undefined, take: boolean, move: boolean, typeCall: boolean} & Valued}
 */
function parseEntry(entries, argv) {
  /** @type {Valued} */
  const values = { seeds: null, record: null };
  let words = argv;
  for (const [flag, key] of Object.entries(VALUED)) {
    const at = words.indexOf(flag);
    if (at === -1) continue;
    values[key] = words[at + 1] ?? '';
    words = [...words.slice(0, at), ...words.slice(at + 2)];
  }
  let end = words.length;
  while (end > 0 && FLAGS.includes(words[end - 1])) end -= 1;
  const flags = words.slice(end);
  const [phase, unit, named, ...extra] = words.slice(0, end);
  const move = flags.includes(MOVE);
  const take = flags.includes(TAKE);
  const typeCall = flags.includes(TYPE_CALL);
  const row = Object.hasOwn(entries, phase) ? entries[phase] : null;
  const valueBad = Object.entries(VALUED).some(([flag, key]) => {
    const value = values[key];
    return words.includes(flag) || value === '' || value?.startsWith('--') || (value !== null && !row?.[key]);
  });
  const bad = row === null || !unit || named === '' || named?.startsWith('--') || extra.length > 0
    || new Set(flags).size !== flags.length || (move && !row.move) || (typeCall && (!row.typeCall || move || take)) || valueBad;
  if (bad) throw new Error(`Usage: engine ${enterUsage(entries)}`);
  return { phase, unit, named, take, move, typeCall, ...values };
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
 * names, and the arrival, with the record the entry works where it works
 * one — the product's conversation a project place, named by its identity
 * alone.
 * @typedef {object} Held
 * @property {<T>(fn: () => T) => T} lock
 * @property {string} manifest
 * @property {string} retry
 * @property {(record: string|null) => void} arrive
 */

/** @param {string} cwd @param {string} phase @param {string} unit @param {string} place @returns {Held} */
function heldAt(cwd, phase, unit, place) {
  if (unit === PRODUCT) {
    return { lock: (fn) => withProjectLock(cwd, fn), manifest: PROJECT_MANIFEST_SPEC, retry: '--product', arrive: () => { arriveAt(cwd, PRODUCT); } };
  }
  return { lock: (fn) => withWorkUnitLock(cwd, unit, fn), manifest: `${unit}/manifest.json`, retry: `${unit} --state`, arrive: (record) => { arriveAt(cwd, unit, phase, place, record ?? undefined); } };
}

/**
 * A feature's topic's close into its spec voided as its discussion is
 * entered again, a bugfix's as its investigation is (9.7.9), read and saved under the writer lock the caller
 * holds.
 * @param {string} cwd @param {string} unit @param {string} topic
 */
function voidOnEntry(cwd, unit, topic) {
  const manifest = loadWorkUnitManifest(cwd, unit);
  if (voidTopicClose(manifest, topic, new Date().toISOString())) saveWorkUnitManifest(cwd, unit, manifest);
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

/** What the call carried beyond its place. @typedef {{take: boolean, move: boolean, typeCall: boolean} & Valued} Carried */

/**
 * The entry again at the place it stands at, carrying what `carried` does —
 * a move kept a move, its seeds and its record kept.
 * @param {Standing} at @param {Carried} carried @returns {string[]}
 */
function entryAgain({ phase, unit, topic }, { take, move, seeds, record }) {
  return [
    'enter', phase, unit, ...(topic === undefined ? [] : [topic]), ...(take ? [TAKE] : []), ...(move ? [MOVE] : []),
    ...(seeds === null ? [] : [SEEDS, seeds]), ...(record === null ? [] : [RECORD, record]),
  ];
}

/**
 * The ways on from a question the entry puts where its place is held:
 * proceeding is the entry again with `--take`, all else the call carried
 * kept; leaving it goes back to the epic's menu, a single-topic unit or the
 * product's conversation having none to hand off to.
 * @param {Standing} at @param {Carried} carried @returns {HeldWays}
 */
function waysOn(at, carried) {
  return {
    take: entryAgain(at, { ...carried, take: true }),
    menu: at.manifest.work_type === 'epic' ? ontoEpic(at.unit) : null,
  };
}

/**
 * The question put where the place is held, or null where it is not: the
 * row's own hold first, where it has one — the build's, the checkout's code
 * — then another live session at the place itself, but the product's (the
 * header's).
 * @param {Entry} entry @param {Standing} at @param {string} place @param {Carried} carried
 * @returns {string|null}
 */
function heldQuestion(entry, at, place, carried) {
  const ways = waysOn(at, carried);
  const own = entry.held?.(at, ways) ?? null;
  if (own !== null || at.unit === PRODUCT) return own;
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
  const { phase, unit, named, ...carried } = parseEntry(entries, argv);
  const { take, move, typeCall, seeds, record } = carried;
  const row = entries[phase];
  const at = standingOf(row, cwd, phase, unit, named);
  const entry = row.arm?.(at.manifest) ?? row;
  const standing = entry.standing(at);
  if (standing !== null) throw new Error(standing);
  if (seeds !== null) /** @type {NonNullable<Entry['seeds']>} */ (entry.seeds)(at, seeds);
  if (record !== null) /** @type {NonNullable<Entry['record']>} */ (entry.record)(at, record);
  if (typeCall) return typeCalled(entry, at, seeds);
  const departure = move ? /** @type {NonNullable<Entry['move']>} */ (entry.move)(at) : null;
  const { topic } = at;
  const atTopic = topic === undefined ? {} : { topic };
  const place = topic ?? unit;
  const picked = (/** @type {string} */ id) => entryAgain(at, { ...carried, record: id });
  const stop = (take ? null : heldQuestion(entry, at, place, carried)) ?? (record === null ? entry.pick?.(at, picked) ?? null : null);
  if (stop !== null) return { response: { phase, unit, ...atTopic, entered: false }, sections: stop };
  const worked = entry.worked?.(at, record) ?? null;
  /** @type {Entering} */
  const entering = { ...at, started: entry.unstarted(at), voided: entry.voids?.(at) ?? false, notes: [], seeds, record: worked };
  const readied = entering.started ? entry.readies?.(entering) ?? [] : [];
  entry.closes?.(at);
  const [reads, fromBefore] = withOneCheck(() => [[...entry.reads(entering), ...readied], fromBeforeLines(cwd, phase, unit, entering.notes)]);
  const owed = owedAt(cwd, unit, phase, place, take);
  const held = heldAt(cwd, phase, unit, place);
  /** @type {{committed?: string|null, note?: string, warnings?: string[]}} */
  const commit = entering.started || entering.voided || departure !== null ? settle(cwd, entry, entering, held, departure) : {};
  held.arrive(worked);
  beatQuietly(cwd, unit, phase, place);
  recordEntry(cwd, unit, phase, place);
  const logged = logLines(cwd, entry, entering);
  const lines = [...reads, ...caughtUp(cwd, unit, phase, place, entering.started, owed), ...legacyLines(cwd, unit), ...fromBefore, ...personLines(), ...logged];
  const warnings = [...entering.notes, ...(commit.warnings ?? [])];
  return {
    response: { phase, unit, ...atTopic, entered: true, started: entering.started, ...commit, ...(warnings.length > 0 ? { warnings } : {}) },
    sections: entrySections(entry.questions(entering), lines),
  };
}

/**
 * The type call (the header's): what its row reads for it, nothing asked
 * first, started, written or recorded.
 * @param {Entry} entry @param {Standing} at @param {string|null} seeds
 * @returns {{response: Record<string, unknown>, sections: string}}
 */
function typeCalled(entry, at, seeds) {
  const lines = /** @type {NonNullable<Entry['typeCall']>} */ (entry.typeCall)(at, seeds);
  return { response: { phase: at.phase, unit: at.unit, entered: true, started: false }, sections: entrySections([], lines) };
}

/**
 * The DATA's line naming the place's legacy folder, where it holds files
 * (the header's); none where it holds none.
 * @param {string} cwd @param {string} unit a unit, or `product`
 * @returns {Line[]}
 */
function legacyLines(cwd, unit) {
  const folder = statePath(cwd, `${unit === PRODUCT ? PRODUCT_DIR : unit}/assets/legacy`);
  if (!fs.existsSync(folder) || fs.readdirSync(folder).length === 0) return [];
  return [['legacy', `${folder} — files from before Ledger the migration had no other place for; look in it when the work needs them`]];
}

/**
 * The DATA's line naming the record of the person, for what Claude picks
 * (16.18.4), wherever its file stands; none where it has none.
 * @returns {Line[]}
 */
function personLines() {
  const record = recordToRead();
  return record === null ? [] : [['person', record]];
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

module.exports = { ENTER_USAGE, ENTRIES, CARRIED, enter, enterThrough };
