'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a topic's record carried into the ledger by the migration
// (21.6, 21.10.9) — `ledger carry <unit>.<phase>.<topic>`, the records
// directive's one write.
//
// - When: only while the migration runs (state-worktree.cjs's
//   `migrationRuns`), so its commit is held for the migration's, and the
//   trust log is told nothing (21.1.5, 21.9.3).
// - Where: a topic of a unit, holding an item in the phase named, one of the
//   phases the records directive carries a topic of (079's check), live or
//   not: a cancelled unit's topics and a cancelled topic get their records
//   too (21.6.2), their entries landing not current, by the rule every read
//   decides by. A topic an epic promoted to a cross-cutting unit is that
//   unit's to carry.
// - What: the record as one JSON object, `{"entries": […]}`, composed where
//   the state keeps it (`.cache/migrate/records/{unit}/{topic}.json`), read
//   from the state root whichever checkout the session runs in. Each entry
//   is an `asked`, `found` or `decided` in the content its write takes
//   (ledger-write.cjs) — who made it, and for a decision how it was given,
//   `carried` where the log shows no maker (21.6.5) — beside its `ref`, a
//   name the record gives it, unique in it; its links by ref, each to an
//   entry before it: a question's `part_of`, a decision's `answers`, a
//   question of the record no other decision answers, and any entry's
//   `relies_on`; a question's or decision's `map_item`, the item of the
//   topic's old map it carries, and a question's `thread`, the thread of
//   its research it carries, each a name or, where one entry settles
//   several, a list of them; an open question's `raise`, `true`, marking a
//   point no source settles, to raise at the end (21.6.10); and its
//   `assets`, each `{path, status}`, a file the state holds, linked as it
//   is canonical or reference. Every entry moves no one; a decision lands
//   unchecked, for the late one-decision check after the migration.
// - Kept: the rules the records directive's check holds a topic's record to
//   (079-records.check.cjs) — its sections cited, its old map, its threads
//   and its imports, and in discovery no decision and nothing product-wide —
//   run on the record before a line is written, so a record carried passes
//   the check and one that would not is refused, nothing carried, to be
//   composed again.
// - Once: the whole record is appended in one write, after what it carried
//   is kept in the state's cache (`.cache/migrate/carried/{unit}/{topic}.json`)
//   — the record as given, and each entry's ref with the id it was given —
//   so a session that dies leaves the topic with all of its entries or none
//   (21.10.9), and the check tells the two apart. A topic the ledger holds
//   an entry on already is refused: its record was carried. Once carried,
//   the verifier's findings on the record and any refusal of it beside it
//   are cleared.
// - Frozen with 079: the record this takes and the carried file it keeps
//   are the directive's, released with it, so a later ledger version keeps
//   taking them while 079 can run. The check rests on those two things
//   alone: the carried file's record, and each of its ids standing as a
//   line's `id` in the ledger, never another field of a line.
// - It refuses, carrying nothing: outside the migration; no session; argv
//   of another shape; a place of another shape, a phase the directive
//   carries no topic of, a unit the project lacks, a topic with no item in
//   the phase, a topic promoted. And what the record's composer answers —
//   no record composed, or a file holding none; an entry of another event,
//   a ref missing or given twice, a link naming no earlier entry of the
//   kind it needs, a question answered twice, a point to raise a decision of
//   the record answers or marked otherwise, a map item or a thread on an
//   entry that takes none, or of another shape, content its write refuses,
//   who moved whom given, an asset the state lacks, and a record breaking
//   the directive's rules, naming each thing it breaks — is written beside
//   the record
//   (`.cache/migrate/records/{unit}/{topic}.refused.md`), for the next
//   per-topic agent's brief, and nothing else.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { messageOf } = require('../kernel/call.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { appendEntries, withLedger, carrying, commitLedger } = require('./ledger.cjs');
const { newId, shortIds } = require('./ledger-ids.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { withStateLock, migrationRuns } = require('./state-worktree.cjs');
const { HELD_NOTE } = require('./commit.cjs');
const { refreshLedgerCopies } = require('./ledger-copies.cjs');
const { WRITES, contentFields, checkSaid, checkUnsealed } = require('./ledger-write.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { directiveOf } = require('./directives.cjs');

const CARRY_VERB = 'carry';
const CARRY_USAGE = 'ledger carry <work-unit>.<phase>.<topic>   (the topic\'s record as JSON, {"entries": [...]}, composed at .cache/migrate/records/{unit}/{topic}.json in the state)';
const SAID = 'ledger carry';

/** What the migration carried of each topic, state-relative: `{unit}/{topic}.json` beneath it. */
const CARRIED = '.cache/migrate/carried';

/**
 * Where each topic's record is composed before it is carried, and the
 * verifier's findings on it written, state-relative: `{unit}/{topic}.json`
 * and `{unit}/{topic}.findings.md` beneath it.
 */
const COMPOSED = '.cache/migrate/records';

/** The write each entry's event is made by. @type {Readonly<Record<string, string>>} */
const EVENT_WRITES = Object.freeze({ asked: 'ask', found: 'find', decided: 'decide' });

/** What an entry of a record carries beside its content: its name, its event, its links by name, and what the migration reads. */
const RECORD_KEYS = Object.freeze(['ref', 'event', 'part_of', 'answers', 'relies_on', 'map_item', 'thread', 'raise', 'assets']);

const ASSET_STATUSES = Object.freeze(['canonical', 'reference']);

/** Where a topic's record is carried: the state root, the unit, the phase and the topic. @typedef {{root: string, unit: string, phase: string, topic: string}} Place */

/** An entry of the record as written: its line's fields and id, and what is kept of it. @typedef {{fields: Record<string, unknown>, id: string}} Line */

/** The id an entry of the record was given, by its ref. @typedef {{ref: string, id: string}} Kept */

/** The records directive, whose check holds the rules a record keeps. */
const RECORDS_DIRECTIVE = '079-records';

/**
 * The records directive's check: the phases it carries a topic of, its
 * rules and what it reads of a topic, loaded where they are asked for.
 * @returns {{
 *   phases: string[],
 *   holds: (manifest: Record<string, any>, phase: string, topic: string) => boolean,
 *   topicsOf: (manifest: Record<string, any>) => string[],
 *   recordProblems: (at: Record<string, unknown>) => string[],
 *   sourcesOf: (at: Record<string, unknown>) => Record<string, any>,
 * }}
 */
const recordsRules = () => require(directiveOf(RECORDS_DIRECTIVE).check);

/** @param {string} unit @param {string} topic */
const carriedPath = (unit, topic) => path.posix.join(CARRIED, unit, `${topic}.json`);

/** @param {string} unit @param {string} topic */
const composedPath = (unit, topic) => path.posix.join(COMPOSED, unit, `${topic}.json`);

/** @param {string} unit @param {string} topic */
const findingsPath = (unit, topic) => path.posix.join(COMPOSED, unit, `${topic}.findings.md`);

/** @param {string} unit @param {string} topic */
const refusedPath = (unit, topic) => path.posix.join(COMPOSED, unit, `${topic}.refused.md`);

/**
 * A topic of a unit, from its dot-path, live or not. Refuses, in the words
 * of `said`, the command asking, a path of another shape, a phase the
 * records directive carries no topic of, a unit the project lacks, a topic
 * with no item in the phase, and a topic promoted.
 * @param {string} cwd @param {string} dotpath @param {string} said @returns {Place}
 */
function topicPlace(cwd, dotpath, said) {
  const parts = String(dotpath).split('.');
  if (parts.length !== 3 || parts.some((part) => part === '')) throw new Error(`${said}: "${dotpath}" names no topic — <work-unit>.<phase>.<topic>`);
  const [unit, phase, topic] = parts;
  const rules = recordsRules();
  if (!rules.phases.includes(phase)) throw new Error(`${said}: the records carry no topic in "${phase}" — one of ${rules.phases.join(', ')}`);
  const root = stateRoot(cwd);
  const manifest = manifestOf(root, unit);
  if (manifest === null) throw new Error(`${said}: there is no work unit "${unit}"`);
  if (!rules.holds(manifest, phase, topic)) throw new Error(`${said}: ${unit} has no topic "${topic}" in ${phase}`);
  if (!rules.topicsOf(manifest).includes(topic)) {
    throw new Error(`${said}: ${unit}'s ${topic} was promoted to ${manifest.phases.discussion.items[topic].promoted_to}, which carries its record`);
  }
  return { root, unit, phase, topic };
}

/** The place `args` give, refused for argv of another shape. @param {string[]} args @returns {string} */
function dotpathOf(args) {
  if (args.length !== 1 || args[0].startsWith('--')) throw new Error(`Usage: engine ${CARRY_USAGE}`);
  return args[0];
}

/**
 * The topic's record's entries, read where it is composed. Refuses a file
 * that cannot be read, and one holding no record.
 * @param {Place} place @returns {Record<string, any>[]}
 */
function readRecord({ root, unit, topic }) {
  const file = composedPath(unit, topic);
  let record;
  try {
    record = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  } catch (err) {
    throw new Error(`${SAID}: the record could not be read from ${file}: ${messageOf(err)}`);
  }
  if (!isObject(record) || Object.keys(record).length !== 1 || !Array.isArray(record.entries) || !record.entries.every(isObject)) {
    throw new Error(`${SAID}: ${file} holds no record — a record is {"entries": [...]}, each entry an object`);
  }
  return record.entries;
}

/** Whether a map item or a thread names what it carries: a name, or a list of them. @param {unknown} named */
const isNamed = (named) => (typeof named === 'string' && named !== '')
  || (Array.isArray(named) && named.length > 0 && named.every((name) => typeof name === 'string' && name !== ''));

/**
 * One link's refs, each naming an entry before it of the kind it needs:
 * their ids, in order.
 * @param {string} said @param {string} field @param {unknown} refs @param {Map<string, {id: string, event: string}>} before @param {string|null} event the event each must be, or null for any
 * @returns {string[]}
 */
function linked(said, field, refs, before, event) {
  if (!Array.isArray(refs) || !refs.every((ref) => typeof ref === 'string')) throw new Error(`${said}: ${field} names entries by their refs`);
  return refs.map((ref) => {
    const named = before.get(ref);
    const what = event === null ? 'an entry' : 'a question';
    if (named === undefined || (event !== null && named.event !== event)) throw new Error(`${said}: ${field} names ${ref}, and no entry before it is ${what} of that ref`);
    return named.id;
  });
}

/**
 * The asset links an entry carries: its `assets`, each a file the state
 * holds and the status it is linked as.
 * @param {string} said @param {Place} place @param {unknown} assets @param {string} entry @param {Record<string, unknown>} tags
 * @returns {Line[]}
 */
function assetLines(said, place, assets, entry, tags) {
  if (assets === undefined) return [];
  if (!Array.isArray(assets)) throw new Error(`${said}: assets is a list of {path, status}`);
  return assets.map((asset) => {
    if (!isObject(asset) || Object.keys(asset).length !== 2 || typeof asset.path !== 'string' || !ASSET_STATUSES.includes(/** @type {string} */ (asset.status))) {
      throw new Error(`${said}: an asset is {path, status}, its status ${ASSET_STATUSES.join(' or ')}`);
    }
    const plain = asset.path.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
    if (!plain || !fs.statSync(path.join(place.root, asset.path), { throwIfNoEntry: false })?.isFile()) {
      throw new Error(`${said}: the asset ${asset.path} is no file the state holds — an asset's path is from the state root`);
    }
    return { fields: { event: 'asset', ...tags, entry, path: asset.path, status: asset.status, into: null }, id: newId() };
  });
}

/**
 * The record's lines, each entry followed by its asset links, and what is
 * kept of each entry, its links resolved to the ids minted for the entries
 * before it.
 * @param {Place} place @param {Record<string, unknown>[]} entries @param {string} session
 * @returns {{lines: Line[], kept: Kept[]}}
 */
function recordLines(place, entries, session) {
  /** @type {Map<string, {id: string, event: string, raised: boolean}>} */
  const before = new Map();
  const answered = new Set();
  /** @type {Line[]} */
  const lines = [];
  /** @type {Kept[]} */
  const kept = [];
  const tags = { unit: place.unit, topic: place.topic, phase: place.phase, session };
  entries.forEach((entry, at) => {
    const { ref, event, part_of: partOf, answers, relies_on: reliesOn = [], map_item: mapItem = null, thread = null, raise, assets } = entry;
    const said = `${SAID}: entry ${typeof ref === 'string' ? ref : at + 1}`;
    if (typeof ref !== 'string' || ref === '') throw new Error(`${said}: gives no ref, the name the record links it by`);
    if (before.has(ref)) throw new Error(`${said}: its ref is given twice`);
    if (typeof event !== 'string' || !Object.hasOwn(EVENT_WRITES, event)) throw new Error(`${said}: its event is none of ${Object.keys(EVENT_WRITES).join(', ')}`);
    if (Object.hasOwn(entry, 'who_moved_whom')) throw new Error(`${said}: gives who_moved_whom — an entry the migration carries moves no one`);
    if (partOf !== undefined && event !== 'asked') throw new Error(`${said}: only a question is part of another`);
    if ((answers === undefined) !== (event !== 'decided')) throw new Error(`${said}: ${event === 'decided' ? 'a decision answers a question of the record' : 'only a decision answers'}`);
    if (mapItem !== null && (event === 'found' || !isNamed(mapItem))) throw new Error(`${said}: a map item is a question's or a decision's: a name, or a list of names`);
    if (thread !== null && (event !== 'asked' || !isNamed(thread))) throw new Error(`${said}: a thread is a question's: a name, or a list of names`);
    if (raise !== undefined && (event !== 'asked' || raise !== true)) throw new Error(`${said}: raise marks a question to raise, true`);
    const links = {
      ...(event === 'asked' ? { part_of: partOf === undefined ? null : linked(said, 'part_of', [partOf], before, 'asked')[0] } : {}),
      ...(event === 'decided' ? { answers: linked(said, 'answers', [answers], before, 'asked')[0] } : {}),
      relies_on: linked(said, 'relies_on', reliesOn, before, null),
    };
    if (event === 'decided') {
      if (answered.has(links.answers)) throw new Error(`${said}: answers ${answers}, which another decision of the record answers — a question's current answer is one`);
      answered.add(links.answers);
    }
    const given = Object.fromEntries(Object.entries(entry).filter(([key]) => !RECORD_KEYS.includes(key)));
    const content = contentFields(said, WRITES[EVENT_WRITES[event]], { ...given, who_moved_whom: 'none' }, null);
    checkUnsealed(said, content);
    checkSaid(said, event === 'decided' ? 'decision' : event === 'found' ? 'finding' : 'question', content);
    const id = newId();
    before.set(ref, { id, event, raised: raise === true });
    lines.push({ fields: { event, ...tags, ...content, ...links, ...(event === 'decided' ? { unchecked: true } : {}) }, id });
    lines.push(...assetLines(said, place, assets, id, tags));
    kept.push({ ref, id });
  });
  const settled = kept.find(({ ref, id }) => before.get(ref)?.raised === true && answered.has(id));
  if (settled !== undefined) throw new Error(`${SAID}: entry ${settled.ref}: is marked to raise, and a decision of the record answers it — a point to raise is an open question`);
  return { lines, kept };
}

/**
 * The record refused where it breaks the records directive's rules, each
 * thing it breaks named.
 * @param {string} cwd @param {Place} place @param {Record<string, any>[]} entries
 */
function checkRules(cwd, { root, unit, phase, topic }, entries) {
  const problems = recordsRules().recordProblems({ projectDir: codeRoot(cwd), stateDir: root, unit, topic, phase, entries });
  if (problems.length > 0) throw new Error(`${SAID}: ${unit}'s ${topic} breaks the records directive's rules, so nothing is carried — ${problems.join('; ')}`);
}

/**
 * The ids the ledger holds, refused where one of its entries is on the
 * place's topic already: its record was carried.
 * @param {Place} place @param {string[]} warnings
 * @returns {string[]}
 */
function idsBeside({ root, unit, topic }, warnings) {
  return withLedger(root, warnings, (ledger) => [...ledger.entries()].map(({ event }) => {
    if (event.unit === unit && event.topic === topic) throw new Error(`${SAID}: the ledger holds entries on ${unit}'s ${topic} already — a topic's record is carried once`);
    return /** @type {string} */ (event.id);
  }));
}

/** `text` written whole at `file` in the state: written beside it, then renamed in. @param {string} file @param {string} text */
function writeWhole(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const written = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(written, text);
  fs.renameSync(written, file);
}

/**
 * What was carried of a topic kept whole in the state's cache: the record
 * as given, and each entry's id by its ref.
 * @param {Place} place @param {Record<string, any>[]} entries @param {Kept[]} kept
 */
function keepCarried({ root, unit, phase, topic }, entries, kept) {
  writeWhole(path.join(root, carriedPath(unit, topic)), `${JSON.stringify({ unit, phase, topic, entries: kept, record: { entries } }, null, 2)}\n`);
}

/**
 * The record read, its lines drawn and held to the directive's rules; where
 * the composer must answer something, the refusal written beside the
 * record.
 * @param {string} cwd @param {Place} place @param {string} session
 */
function composedRecord(cwd, place, session) {
  try {
    const entries = readRecord(place);
    const { lines, kept } = recordLines(place, entries, session);
    checkRules(cwd, place, entries);
    return { entries, lines, kept };
  } catch (err) {
    writeWhole(path.join(place.root, refusedPath(place.unit, place.topic)), `${messageOf(err)}\n`);
    throw err;
  }
}

/** What was said of a topic's record beside it cleared, once it is carried: the verifier's findings and any refusal. @param {Place} place */
function clearBeside({ root, unit, topic }) {
  for (const rel of [findingsPath(unit, topic), refusedPath(unit, topic)]) fs.rmSync(path.join(root, rel), { force: true });
}

/**
 * `ledger carry <unit>.<phase>.<topic>`: the topic's record appended in one
 * write, what was carried kept, what was said of it beside it cleared, the
 * ledger's commit held for the migration's. Answers how many entries it
 * carried, each entry's short id by its ref, the commit — null, held — and
 * any warnings.
 * @param {string} cwd @param {string[]} args
 */
function carryRecord(cwd, args) {
  /** @type {string[]} */
  const warnings = [];
  try {
    if (!migrationRuns(stateRoot(cwd))) throw new Error(`${SAID}: a topic's record is carried into the ledger only while the migration runs — the state branch has its first commit, so the migration is done`);
    const session = handedSession();
    if (session === null) throw new Error(`${SAID}: no session to tag the entries with — CLAUDE_CODE_SESSION_ID is not set`);
    const place = topicPlace(cwd, dotpathOf(args), SAID);
    const { entries, lines, kept } = composedRecord(cwd, place, session);
    const { outcome, short } = withStateLock(place.root, () => {
      const beside = idsBeside(place, warnings);
      keepCarried(place, entries, kept);
      if (lines.length > 0) appendEntries(place.root, lines, warnings);
      return {
        outcome: lines.length === 0 ? null : commitLedger(cwd, `ledger(${place.unit}): carry ${place.topic}'s record`, warnings),
        short: shortIds([...beside, ...lines.map(({ id }) => id)]),
      };
    });
    clearBeside(place);
    if (lines.length > 0) refreshLedgerCopies(cwd, warnings);
    return {
      carried: kept.length,
      ids: Object.fromEntries(kept.map(({ ref, id }) => [ref, short.get(id)])),
      committed: outcome === null ? null : outcome.committed,
      ...(outcome !== null && outcome.held ? { note: HELD_NOTE } : {}),
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  } catch (err) {
    throw carrying(err, warnings);
  }
}

module.exports = { CARRY_VERB, CARRY_USAGE, carriedPath, composedPath, findingsPath, refusedPath, topicPlace, recordsRules, carryRecord };
