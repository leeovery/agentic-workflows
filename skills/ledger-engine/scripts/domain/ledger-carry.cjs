'use strict';

// ---------------------------------------------------------------------------
// Domain ring: a topic's record carried into the ledger by the migration
// (21.6, 21.10.9) — `ledger carry <unit>.<phase>.<topic>`, the records
// directive's one write — and a unit's own, `ledger carry <unit>.discovery`:
// what its discovery sessions hold of the unit as a whole, or of no one
// topic, at the unit's own place in discovery, no topic's.
//
// - When: only while the migration runs (state-worktree.cjs's
//   `migrationRuns`), so its commit is held for the migration's, and the
//   trust log is told nothing (21.1.5, 21.9.3). It renders no copies for
//   the knowledge base, nor indexes them: boot does both at the finish,
//   where the knowledge question is asked (21.9.1).
// - Where: a topic of a unit, holding an item in the phase named, one of the
//   phases the records directive carries a topic of (079's check), live or
//   not: a cancelled unit's topics and a cancelled topic get their records
//   too (21.6.2), their entries landing not current, by the rule every read
//   decides by. A topic an epic promoted to a cross-cutting unit is that
//   unit's to carry. A unit's own record is carried at `<unit>.discovery`,
//   for an epic whose discovery folder holds a session (079's check).
// - What: the record as one JSON object, `{"entries": […]}` — beside them,
//   where no map row says what its topic is about, `description`, the line
//   its composer says it in (079's check) — composed where
//   the state keeps it (`.cache/migrate/records/{unit}/{topic}.json`, a
//   unit's own `.cache/migrate/records/{unit}.json`), read
//   from the state root whichever checkout the session runs in. Each entry
//   is an `asked`, `found` or `decided` in the content its write takes
//   (ledger-write.cjs) — who made it, and for a decision how it was given,
//   `carried` where the log shows no maker (21.6.5) — beside its `ref`, a
//   name the record gives it, unique in it; its links by ref, each to an
//   entry before it: a question's `part_of`, a decision's `answers`, a
//   question of the record, which several sibling decisions may answer
//   (5.3.13), and any entry's `relies_on`; any entry's `map_item`, the item
//   of the topic's old map it carries, and `thread`, the thread of its
//   research it carries, each a name or, where one entry carries several, a
//   list of them; an open question's `raise`, `true`, marking a point no
//   source settles, to raise at the end (21.6.10), never one a decision of
//   the record answers, which `raise` refuses; a question's `at_odds`, the
//   sections at odds of a contradiction it names, kept with the record and
//   never written to the ledger — what they must be, and that no decision
//   settles such a point, are the directive's rules (079's check);
//   and its `assets`, each
//   `{path, status}`, a file the state holds, linked as it is canonical or
//   reference. An entry's words — its text, why and how, what it rules
//   out, its alternatives and evidence — never name another entry by its
//   ref, which the record alone reads: the ledger links by id, so a
//   drafting label left in them means nothing there, and the carry refuses
//   it, naming it. Every line it writes is tagged with the session
//   `migration` (ledger-events.cjs, `CARRIED_SESSION`), whoever made the entry, no
//   conversation's: the mark of an entry from before Ledger, which needs no
//   session handed. Every entry moves no one; a decision lands unchecked
//   and unlabelled, its kind and hard-to-undo mark null: no call is made
//   while the migration runs, and the late one-decision check never sends
//   it, the records step having held it to one thing (21.6.3).
// - Kept: the rules the records directive's check holds a topic's record to
//   (079-records.check.cjs) — what keeps the ledger whole, never a judgment
//   of the record's content — run on the record before a line is written,
//   so a record carried passes the check and one that would not is
//   refused, nothing carried, to be amended.
// - Every fault at once: the record's shape, entry by entry, each check of
//   an entry run whichever others refuse — within its content, each field
//   unknown, missing or of another type, and what it says of itself that
//   cannot be — and the directive's rules, so one refusal names everything
//   to mend. `--dry-run` answers the same faults,
//   none where the carry would take the record, and writes nothing, no
//   refusal beside the record either: the record's composer runs it before
//   handing back, and the session before a verifier reads the record.
// - Verified, in its unit's order: a record is carried only once no
//   finding its composer handed back to the session stands unsettled
//   beside it (`handedBack`), and once its verifier has passed it, the
//   findings beside it an empty file, or the session settled a late
//   round's findings (ledger-settle.cjs; 079's check, `unverified`) — the
//   carry clears them, and a record is carried once, so a finding left
//   standing would never be answered — the record unchanged since that
//   verifier's brief was issued on it (`briefedOn`), and its verdicts
//   naming every entry its brief asked a verdict of — in a later round
//   those not passed unchanged since (later-rounds.cjs) — and none the
//   record it read does not hold (`unchecked`); and a record of a unit
//   whose records share a source — an approved spec, a discovery session
//   or an asset they walk — only once each record drawing on it, the
//   unit's own and a topic it promoted among them, is so passed and no
//   section of it goes uncited, nor a contradiction one record names
//   between its sections unnamed on another citing it, and likewise of
//   each unit a topic of its
//   unit was promoted from (`unitWaits`), the refusal framed on each unit
//   waited on, a record carried taking no section found later; refused,
//   writing nothing beside the record, for the session alone keeps the
//   order. A dry run names none of it: it is the record's composer's.
// - Once: the whole record is appended in one write, after what it carried
//   is kept in the state's cache (`.cache/migrate/carried/{unit}/{topic}.json`)
//   — the record as given, and each entry's ref with the id it was given —
//   so a session that dies leaves the topic with all of its entries or none
//   (21.10.9), and the check tells the two apart. A topic the ledger holds
//   an entry on already is refused: its record was carried — asked of the
//   ledger before the verifier's pass and the unit's order, so a carry run
//   again is told so, and one killed before its append runs again. Once
//   carried, its verifier's passing round is kept with the rounds before
//   it, its findings, rulings and verdicts, and they, the record its
//   verifier was briefed on and any refusal beside the record are cleared.
// - Frozen with 079: the record this takes and the carried file it keeps
//   are the directive's, released with it, so a later ledger version keeps
//   taking them while 079 can run. The check rests on those two things
//   alone: the carried file's record, and each of its ids standing as a
//   line's `id` in the ledger, never another field of a line.
// - It refuses, carrying nothing: outside the migration; argv of another
//   shape; a place of
//   another shape, a phase the directive carries no topic of, a unit the
//   project lacks, a topic with no item in the phase, one whose item is in
//   a later phase, a topic promoted. And what the record's composer
//   answers — no record composed, or a file holding none; and every fault
//   of a record — is written beside the
//   record (`.cache/migrate/records/{unit}/{topic}.refused.md`), for the
//   next per-topic agent's brief, and nothing else.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { messageOf } = require('../kernel/call.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { appendEntries, withLedger, carrying, commitLedger } = require('./ledger.cjs');
const { newId, shortIds } = require('./ledger-ids.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { withStateLock, assertMigrationRuns } = require('./state-worktree.cjs');
const { HELD_NOTE } = require('./commit.cjs');
const { WRITES, contentFaults, saidFaults, unsealedFaults, decisionGiven } = require('./ledger-write.cjs');
const { CARRIED_SESSION } = require('./ledger-events.cjs');
const { codeRoot } = require('../kernel/code-root.cjs');
const { directiveOf } = require('./directives.cjs');
const {
  carriedPath, composedPath, findingsPath, refusedPath, rulingsPath, handbackPath, checkedPath, verifyingPath, roundsPath, settledPath,
  linesOf, roundsKept, recordHash, verdictRef, handedBack, unchecked, unsettledRound, briefedOn: briefedNote,
} = require('../../../ledger-migrate/scripts/record-files.cjs');

/** The record the last verifier was briefed on, as a later round reads it, or null where none was. @type {(root: string, unit: string, topic: string|null) => import('./later-rounds.cjs').Note|null} */
const briefedOn = /** @type {any} */ (briefedNote);

const CARRY_VERB = 'carry';
const CARRY_USAGE = 'ledger carry <work-unit>.<phase>.<topic>|<work-unit>.discovery [--dry-run]   (the record as JSON, {"entries": [...], "description"?}, composed at .cache/migrate/records/{unit}/{topic}.json in the state, a unit\'s own at .cache/migrate/records/{unit}.json)';
const SAID = 'ledger carry';
const DRY_RUN = '--dry-run';

/** The write each entry's event is made by. @type {Readonly<Record<string, string>>} */
const EVENT_WRITES = Object.freeze({ asked: 'ask', found: 'find', decided: 'decide' });

/** The kind of entry each event writes, as the write's own checks name it. @type {Readonly<Record<string, import('./ledger-events.cjs').EntryKind>>} */
const EVENT_KINDS = Object.freeze({ asked: 'question', found: 'finding', decided: 'decision' });

/** What a carried entry never holds: the migration's record is carried as it stands, never asked as a point from before. */
const CARRIED_WITHOUT = Object.freeze(['from_before']);

/** What a record holds: its entries, and the line saying what its topic is about. */
const RECORD_FIELDS = Object.freeze(['entries', 'description']);

/** A record as composed. @typedef {{entries: Record<string, any>[], description?: string}} Composed */

/** What an entry of a record carries beside its content: its name, its event, its links by name, and what the migration reads. */
const RECORD_KEYS = Object.freeze(['ref', 'event', 'part_of', 'answers', 'relies_on', 'map_item', 'thread', 'raise', 'at_odds', 'assets']);

const ASSET_STATUSES = Object.freeze(['canonical', 'reference']);

/** Where a record is carried: the state root, the unit, the phase and the topic, null for the unit's own. @typedef {{root: string, unit: string, phase: string, topic: string|null}} Place */

/** An entry of the record as written: its line's fields and id, and what is kept of it. @typedef {{fields: Record<string, unknown>, id: string}} Line */

/** The id an entry of the record was given, by its ref. @typedef {{ref: string, id: string}} Kept */

/** An entry before another, as its links read it: its id, its event, and whether it is marked to raise. @typedef {{id: string, event: string, raised: boolean}} Earlier */

/** The record drawn: its lines, what is kept of each entry, and every fault it holds. @typedef {{lines: Line[], kept: Kept[], faults: string[]}} Drawn */

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
 *   unitWaits: (at: Record<string, unknown>) => {unit: string, waits: string[]}[],
 *   unverified: (at: Record<string, unknown>) => string|null,
 *   ownRecord: (at: Record<string, unknown>) => boolean,
 *   sourcesOf: (at: Record<string, unknown>) => Record<string, any>,
 * }}
 */
const recordsRules = () => require(directiveOf(RECORDS_DIRECTIVE).check);

/** What a record's verifier writes beside its findings, kept with them in its round, each under its heading, in this order. */
const BESIDE_FINDINGS = Object.freeze([
  Object.freeze({ heading: '### Rulings', rel: rulingsPath }),
  Object.freeze({ heading: '### Checked', rel: checkedPath }),
]);

/**
 * The last verifier's findings, at `findings`, as the round after those kept
 * at `rounds`, under its heading — an empty file its pass — and beneath
 * them, under its heading, each file `beside` it holding anything; null
 * where no verifier wrote since the last was kept.
 * @param {string} rounds @param {string} findings @param {{heading: string, file: string}[]} [beside] @returns {string|null}
 */
function lastRound(rounds, findings, beside = []) {
  if (!fs.existsSync(findings)) return null;
  const kept = roundsKept(rounds);
  const text = fs.readFileSync(findings, 'utf8').trim();
  const written = beside.flatMap(({ heading, file }) => {
    const said = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '';
    return said === '' ? [] : [`${heading}\n\n${said}`];
  });
  return [`## Round ${kept + 1}`, text === '' ? 'None: the verifier passed it.' : text, ...written].join('\n\n');
}

/**
 * The last verifier's findings, and what it wrote `beside` them, kept as a
 * round at `rounds`, and cleared: no findings file is no verdict yet.
 * @param {string} rounds @param {string} findings @param {{heading: string, file: string}[]} [beside]
 */
function keepRound(rounds, findings, beside = []) {
  const round = lastRound(rounds, findings, beside);
  if (round !== null) fs.appendFileSync(rounds, `${fs.existsSync(rounds) ? '\n' : ''}${round}\n`);
  for (const file of [findings, ...beside.map(({ file: at }) => at)]) fs.rmSync(file, { force: true });
}

/** What a record's verifier writes beside its findings, each absolute under its heading. @param {string} root @param {string} unit @param {string|null} topic */
const besideFindings = (root, unit, topic) => BESIDE_FINDINGS.map(({ heading, rel }) => ({ heading, file: path.join(root, rel(unit, topic)) }));

/** A record's last verifier's round kept with all it wrote, and cleared. @param {string} root @param {string} unit @param {string|null} topic */
const keepRecordRound = (root, unit, topic) => keepRound(path.join(root, roundsPath(unit, topic)), path.join(root, findingsPath(unit, topic)), besideFindings(root, unit, topic));

/**
 * The record a verifier's brief is issued on noted beside it: its hash;
 * the refs of the entries it gives a verdict on, which its verdicts are
 * held to; and what a later round reads of it (later-rounds.cjs, `Note`).
 * @param {string} root @param {string} unit @param {string|null} topic @param {Omit<import('./later-rounds.cjs').Note, 'hash'>} round
 */
function noteVerifying(root, unit, topic, round) {
  fs.writeFileSync(path.join(root, verifyingPath(unit, topic)), `${JSON.stringify({ hash: recordHash(root, unit, topic), ...round })}\n`);
}

/**
 * The last verifier's verdicts, each ref's `ok` or not, where it has
 * written its findings since its brief; null where it has not, its round
 * counting for nothing.
 * @param {string} root @param {string} unit @param {string|null} topic @returns {Map<string, boolean>|null}
 */
function lastVerdicts(root, unit, topic) {
  if (!fs.existsSync(path.join(root, findingsPath(unit, topic)))) return null;
  return new Map(linesOf(path.join(root, checkedPath(unit, topic))).map((line) => [verdictRef(line), /^ok\b/i.test(line.slice(line.indexOf(':') + 1).trim())]));
}

/**
 * The guard before a brief that follows a verifier: where a verifier was
 * briefed on the record and has written its findings, its verdicts name
 * each entry it read (`unchecked`), said of the record; else null.
 * @param {string} root @param {string} unit @param {string|null} topic @returns {string|null}
 */
function uncheckedRound(root, unit, topic) {
  const briefed = fs.existsSync(path.join(root, verifyingPath(unit, topic))) && fs.existsSync(path.join(root, findingsPath(unit, topic)));
  return briefed ? unchecked(root, unit, topic, []) : null;
}

/** The phase a unit's own record is carried in. */
const UNIT_PHASE = 'discovery';

/** A record's place as a sentence names it. @param {{unit: string, topic: string|null}} place */
const recordName = ({ unit, topic }) => (topic === null ? `${unit}'s own discovery` : `${unit}'s ${topic}`);

/** A record's place as its dot-path names it. @param {{unit: string, phase: string, topic: string|null}} place */
const placePath = ({ unit, phase, topic }) => (topic === null ? `${unit}.${phase}` : `${unit}.${phase}.${topic}`);

/**
 * A topic of a unit, from its dot-path, live or not, as a directive's check
 * carries topics — the records directive's, where no other is given — at
 * the phase its item is in: the last of the directive's phases holding it,
 * so an epic's topic past its map is carried at its discussion, never at
 * discovery. Refuses, in the words of `said`, the command asking, a path of
 * another shape, a phase the directive carries no topic of, a unit the
 * project lacks, a topic with no item in the phase, one whose item is in a
 * later phase, and a topic promoted.
 * @param {string} cwd @param {string} dotpath @param {string} said
 * @param {ReturnType<typeof recordsRules>} [rules] @returns {Place}
 */
function topicPlace(cwd, dotpath, said, rules = recordsRules()) {
  const parts = String(dotpath).split('.');
  if (parts.length === 2 && parts[1] === UNIT_PHASE && parts[0] !== '') return unitPlace(cwd, parts[0], said, rules);
  if (parts.length !== 3 || parts.some((part) => part === '')) throw new Error(`${said}: "${dotpath}" names no topic — <work-unit>.<phase>.<topic>, or <work-unit>.${UNIT_PHASE} for a unit's own`);
  const [unit, phase, topic] = parts;
  if (!rules.phases.includes(phase)) throw new Error(`${said}: the records carry no topic in "${phase}" — one of ${rules.phases.join(', ')}`);
  const root = stateRoot(cwd);
  const manifest = manifestOf(root, unit);
  if (manifest === null) throw new Error(`${said}: there is no work unit "${unit}"`);
  if (!rules.holds(manifest, phase, topic)) throw new Error(`${said}: ${unit} has no topic "${topic}" in ${phase}`);
  const at = [...rules.phases].reverse().find((held) => rules.holds(manifest, held, topic));
  if (at !== phase) throw new Error(`${said}: ${unit}'s ${topic} is in ${at}, past ${phase} — its record is carried there: ${unit}.${at}.${topic}`);
  if (!rules.topicsOf(manifest).includes(topic)) {
    throw new Error(`${said}: ${unit}'s ${topic} was promoted to ${manifest.phases.discussion.items[topic].promoted_to}, which carries its record`);
  }
  return { root, unit, phase, topic };
}

/**
 * A unit's own record's place, at its discovery: refused for a unit the
 * project lacks, and one with no record of its own (079's check).
 * @param {string} cwd @param {string} unit @param {string} said @param {ReturnType<typeof recordsRules>} rules @returns {Place}
 */
function unitPlace(cwd, unit, said, rules) {
  const root = stateRoot(cwd);
  if (manifestOf(root, unit) === null) throw new Error(`${said}: there is no work unit "${unit}"`);
  if (!rules.ownRecord({ stateDir: root, unit })) throw new Error(`${said}: ${unit} has no record of its own — an epic whose discovery holds a session has one, and a unit of one topic's discovery is its topic's`);
  return { root, unit, phase: UNIT_PHASE, topic: null };
}

/** The place `args` give, and whether the carry is a dry run, refused for argv of another shape. @param {string[]} args @returns {{dotpath: string, dry: boolean}} */
function argsOf(args) {
  const dry = args.length === 2 && args[1] === DRY_RUN;
  if (args.length !== (dry ? 2 : 1) || args[0].startsWith('--')) throw new Error(`Usage: engine ${CARRY_USAGE}`);
  return { dotpath: args[0], dry };
}

/**
 * The topic's record, read where it is composed: its entries, and the line
 * saying what the topic is about where it gives one. Refuses, in the words
 * of `said`, the command asking, a file that cannot be read, and one
 * holding no record.
 * @param {Place} place @param {string} [said] @returns {Composed}
 */
function readRecord({ root, unit, topic }, said = SAID) {
  const file = path.join(root, composedPath(unit, topic));
  let record;
  try {
    record = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${said}: the record could not be read from ${file}: ${messageOf(err)}`);
  }
  if (!isObject(record) || Object.keys(record).some((key) => !RECORD_FIELDS.includes(key)) || !Array.isArray(record.entries) || !record.entries.every(isObject)
    || !['string', 'undefined'].includes(typeof record.description)) {
    throw new Error(`${said}: ${file} holds no record — a record is {"entries": [...]}, each entry an object, and where it says what its topic is about, "description", a line`);
  }
  return /** @type {Composed} */ (record);
}

/** Whether a map item or a thread names what it carries: a name, or a list of them. @param {unknown} named */
const isNamed = (named) => (typeof named === 'string' && named !== '')
  || (Array.isArray(named) && named.length > 0 && named.every((name) => typeof name === 'string' && name !== ''));

/** What a link of one ref is given as. */
const ONE_REF = 'the ref of an entry before it';

/** What a link of several refs is given as. */
const REFS = 'a list of refs, each an entry\'s before it';

/**
 * One link's refs, each naming an entry before it of the kind it needs:
 * the ids of those that do, in order, a fault said for each that does not,
 * and one for refs given in another shape than `shape` says.
 * @param {(text: string) => void} fault @param {string} field @param {unknown} refs @param {string} shape
 * @param {Map<string, Earlier>} before @param {string|null} event the event each must be, or null for any
 * @returns {string[]}
 */
function linked(fault, field, refs, shape, before, event) {
  if (!Array.isArray(refs) || !refs.every((ref) => typeof ref === 'string')) {
    fault(`${field} is ${shape}`);
    return [];
  }
  return refs.flatMap((ref) => {
    const named = before.get(ref);
    if (named !== undefined && (event === null || named.event === event)) return [named.id];
    fault(`${field} names ${ref}, and no entry before it is ${event === null ? 'an entry' : 'a question'} of that ref`);
    return [];
  });
}

/**
 * The asset links an entry carries: its `assets`, each a file the state
 * holds and the status it is linked as, a fault said for each that is not.
 * @param {(text: string) => void} fault @param {Place} place @param {unknown} assets @param {string} entry @param {Record<string, unknown>} tags
 * @returns {Line[]}
 */
function assetLines(fault, place, assets, entry, tags) {
  if (assets === undefined) return [];
  if (!Array.isArray(assets)) {
    fault('assets is a list of {path, status}');
    return [];
  }
  return assets.flatMap((asset) => {
    if (!isObject(asset) || Object.keys(asset).length !== 2 || typeof asset.path !== 'string' || !ASSET_STATUSES.includes(/** @type {string} */ (asset.status))) {
      fault(`an asset is {path, status}, its status ${ASSET_STATUSES.join(' or ')}`);
      return [];
    }
    const within = withinState(place.root, asset.path);
    if (within !== null) {
      fault(`the asset ${asset.path} is a whole path — an asset's path is from the state's folder: ${within}`);
      return [];
    }
    const plain = asset.path.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
    if (!plain || !fs.statSync(path.join(place.root, asset.path), { throwIfNoEntry: false })?.isFile()) {
      fault(`the asset ${asset.path} is no file the state holds — an asset's path is from the state root`);
      return [];
    }
    return [{ fields: { event: 'asset', ...tags, entry, path: asset.path, status: asset.status, into: null }, id: newId() }];
  });
}

/**
 * What an entry's marks break of their shapes, each a fault said: who moved
 * whom given, a link its event takes none of, a map item or a thread of
 * another shape, a raise on no question.
 * @param {Record<string, unknown>} entry @param {string} event @param {(text: string) => void} fault
 */
function markFaults(entry, event, fault) {
  if (Object.hasOwn(entry, 'who_moved_whom')) fault('gives who_moved_whom — an entry the migration carries moves no one');
  if (entry.part_of !== undefined && event !== 'asked') fault('only a question is part of another');
  if ((entry.answers === undefined) !== (event !== 'decided')) fault(event === 'decided' ? 'a decision answers a question of the record' : 'only a decision answers');
  if (entry.map_item !== undefined && !isNamed(entry.map_item)) fault('a map item is a name, or a list of names');
  if (entry.thread !== undefined && !isNamed(entry.thread)) fault('a thread is a name, or a list of names');
  if (entry.raise !== undefined && (event !== 'asked' || entry.raise !== true)) fault('raise marks a question to raise, true');
}

/**
 * An entry's content as its write takes it, or null, every fault its write
 * would refuse it for kept: each field unknown, missing or of another
 * type, and what it says of itself that cannot be. Who moved whom is the
 * carry's to give, so no fault names it among the fields an entry holds.
 * @param {string[]} faults @param {string} said @param {string} event @param {Record<string, unknown>} entry
 * @returns {Record<string, unknown>|null}
 */
function entryContent(faults, said, event, entry) {
  const given = Object.fromEntries(Object.entries(entry).filter(([key]) => !RECORD_KEYS.includes(key)));
  const read = contentFaults(said, WRITES[EVENT_WRITES[event]], { ...given, who_moved_whom: 'none' }, null, ['who_moved_whom'], CARRIED_WITHOUT);
  const all = [...read.faults, ...unsealedFaults(said, read.content), ...saidFaults(said, EVENT_KINDS[event], read.content)];
  faults.push(...all);
  return all.length === 0 ? read.content : null;
}

/**
 * One entry drawn, its links resolved to the ids minted for the entries
 * before it: its line followed by its asset links, and every fault of it,
 * each check run whichever others refuse. An entry with a ref and an event
 * is named for the entries after it even where it breaks something, so
 * their links are judged on their own.
 * @param {Place} place @param {Record<string, any>} entry @param {number} at @param {Map<string, Earlier>} before @param {Record<string, unknown>} tags
 * @returns {{lines: Line[], faults: string[]}}
 */
function entryLines(place, entry, at, before, tags) {
  /** @type {string[]} */
  const faults = [];
  const { ref, event, part_of: partOf, answers, relies_on: reliesOn = [], raise, assets } = entry;
  const named = typeof ref === 'string' && ref !== '';
  const said = `entry ${named ? ref : at + 1}`;
  const fault = (/** @type {string} */ text) => { faults.push(`${said}: ${text}`); };
  if (!named) fault('gives no ref, the name the record links it by');
  else if (before.has(ref)) fault('its ref is given twice');
  if (typeof event !== 'string' || !Object.hasOwn(EVENT_WRITES, event)) {
    fault(`its event is none of ${Object.keys(EVENT_WRITES).join(', ')}`);
    return { lines: [], faults };
  }
  markFaults(entry, event, fault);
  const links = {
    ...(event === 'asked' ? { part_of: partOf === undefined ? null : linked(fault, 'part_of', [partOf], ONE_REF, before, 'asked')[0] } : {}),
    ...(event === 'decided' && answers !== undefined ? { answers: linked(fault, 'answers', [answers], ONE_REF, before, 'asked')[0] } : {}),
    relies_on: linked(fault, 'relies_on', reliesOn, REFS, before, null),
    task: null,
  };
  const content = entryContent(faults, said, event, citedFromState(place.root, entry));
  const id = newId();
  if (named && !before.has(ref)) before.set(ref, { id, event, raised: raise === true });
  const assetLinks = assetLines(fault, place, assets, id, tags);
  if (faults.length > 0) return { lines: [], faults };
  return { lines: [{ fields: { event, ...tags, ...content, ...links, ...(event === 'decided' ? decisionGiven(null, true) : {}) }, id }, ...assetLinks], faults };
}

/** A path in the state given whole, from the state's folder; else null. @param {string} root @param {unknown} at */
const withinState = (root, at) => (typeof at === 'string' && at.startsWith(`${root}${path.sep}`) ? at.slice(root.length + 1) : null);

/**
 * The entry with each cite given by a whole path in the state named from the
 * state's folder, for its write's shape alone: the records' rules refuse such
 * a cite once, naming the path it takes (079's check).
 * @param {string} root @param {Record<string, any>} entry
 */
function citedFromState(root, entry) {
  if (!Array.isArray(entry.cites)) return entry;
  return { ...entry, cites: entry.cites.map((cite) => (isObject(cite) && withinState(root, cite.path) !== null ? { ...cite, path: withinState(root, cite.path) } : cite)) };
}

/** The fields of an entry that say what it holds, in words. */
const WORDED = ['text', 'why', 'how', 'rules_out', 'alternatives', 'evidence'];

/**
 * Each entry whose words name another entry of the record by its ref: a
 * drafting label the ledger, linking by id, cannot read.
 * @param {Record<string, any>[]} entries @returns {string[]}
 */
function labelFaults(entries) {
  const refs = entries.map(({ ref }) => ref).filter((ref) => typeof ref === 'string' && ref !== '');
  return entries.flatMap((entry) => WORDED.flatMap((field) => {
    const words = new Set([entry[field]].flat().filter((line) => typeof line === 'string').join('\n').split(/[^\w-]+/));
    const named = refs.filter((ref) => ref !== entry.ref && words.has(ref));
    return named.length === 0 ? [] : [`entry ${entry.ref}: its ${field} names ${named.join(', ')}, the ref of another entry of the record, which the ledger cannot read — say in words what that entry holds, or link it by relies_on; where the words use it as a plain word, rename that entry's ref`];
  }));
}

/**
 * The record drawn: its lines, each entry followed by its asset links; what
 * is kept of each entry; and every fault it holds — each entry's, each
 * entry whose words name another by its ref, each question marked to raise
 * that a decision of the record answers, which `raise` would refuse, and
 * what it breaks of the records directive's rules.
 * @param {string} cwd @param {Place} place @param {Composed} record
 * @returns {Drawn}
 */
function drawnRecord(cwd, place, { entries, description }) {
  const { root, unit, phase, topic } = place;
  /** @type {Map<string, Earlier>} */
  const before = new Map();
  const tags = { unit, topic, phase, session: CARRIED_SESSION };
  const drawn = entries.map((entry, at) => entryLines(place, entry, at, before, tags));
  const answered = new Set(entries.filter(({ event }) => event === 'decided').map(({ answers }) => answers));
  const odds = new Set(entries.filter((entry) => entry.at_odds !== undefined).map(({ ref }) => ref));
  const settled = [...before].filter(([ref, { raised }]) => raised && answered.has(ref))
    .map(([ref]) => `entry ${ref}: is marked to raise, and a decision of the record answers it — raise refuses a question answered already, so a point to raise is an open question${odds.has(ref) ? '; where a later answer settles the point, it is no point at odds: no entry holds at_odds for it, its question is not marked to raise, and the decision answers it' : ''}`);
  const problems = recordsRules().recordProblems({ projectDir: codeRoot(cwd), stateDir: root, unit, topic, phase, entries, description });
  return {
    lines: drawn.flatMap(({ lines }) => lines),
    kept: [...before].map(([ref, { id }]) => ({ ref, id })),
    faults: [...drawn.flatMap(({ faults }) => faults), ...labelFaults(entries), ...settled, ...problems],
  };
}

/**
 * The ids the ledger holds, refused where one of its entries is on the
 * place's topic already, or a unit's own record's on the unit: its record
 * was carried. No other entry is on a unit, no topic's, until every record
 * is carried (the raises at the end).
 * @param {Place} place @param {string[]} warnings
 * @returns {string[]}
 */
function idsBeside(place, warnings) {
  const { root, unit, topic } = place;
  return withLedger(root, warnings, (ledger) => [...ledger.entries()].map(({ event }) => {
    if (event.unit === unit && event.topic === topic) throw new Error(`${SAID}: the ledger holds entries on ${recordName(place)} already — a record is carried once`);
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
 * @param {Place} place @param {Composed} record @param {Kept[]} kept
 */
function keepCarried({ root, unit, phase, topic }, record, kept) {
  writeWhole(path.join(root, carriedPath(unit, topic)), `${JSON.stringify({ unit, phase, topic, entries: kept, record }, null, 2)}\n`);
}

/**
 * The record read and drawn; where the composer must answer something, the
 * refusal, naming every fault, written beside the record.
 * @param {string} cwd @param {Place} place
 */
function composedRecord(cwd, place) {
  try {
    const record = readRecord(place);
    const { lines, kept, faults } = drawnRecord(cwd, place, record);
    if (faults.length > 0) throw new Error(`${SAID}: ${recordName(place)} breaks the records directive's rules, so nothing is carried — ${faults.join('; ')}`);
    return { record, lines, kept };
  } catch (err) {
    writeWhole(path.join(place.root, refusedPath(place.unit, place.topic)), `${messageOf(err)}\n`);
    throw err;
  }
}

/**
 * Refused, writing nothing, where the record's verifier has not passed it,
 * or the topic's unit waits on its records: the session's order to keep,
 * which no composer answers.
 * @param {string} cwd @param {Place} place
 */
function refuseUnsettled(cwd, place) {
  const { root, unit, topic } = place;
  const handed = handedBack(root, unit, topic);
  if (handed !== null) throw new Error(`${SAID}: ${recordName(place)} ${handed}`);
  const rules = recordsRules();
  const unverified = rules.unverified({ stateDir: root, unit, topic });
  if (unverified !== null) {
    throw new Error(`${SAID}: ${recordName(place)} has not passed its verifier — ${unverified}: a record is carried once its verifier passes it, its findings file empty, for the carry clears the findings beside it and a record is carried once, so a finding left standing would never be answered`);
  }
  const unsettled = unsettledRound(root, unit, topic, readRecord(place).entries.map(({ ref }) => String(ref)));
  if (unsettled !== null) throw new Error(`${SAID}: ${recordName(place)} ${unsettled}`);
  const waits = rules.unitWaits({ projectDir: codeRoot(cwd), stateDir: root, unit });
  if (waits.length > 0) {
    const once = waits.map(({ unit: of, waits: on }) => `each record of ${of} drawing on the sources its records share — its approved specs, its discovery sessions and the assets its records walk, its own record and a topic it promoted among them — has passed its verifier or the session's settlement, and no section of those sources goes uncited, nor a contradiction a record names between them unnamed on another citing it — ${on.join('; ')}`);
    throw new Error(`${SAID}: ${recordName(place)} is carried, for a record carried takes no section found later, once ${once.join('; and once ')}`);
  }
}

/**
 * What was said of a topic's record beside it, once it is carried: its last
 * verifier's round kept with the rounds before it, and the rest cleared —
 * the refs it was briefed on and any refusal.
 * @param {Place} place
 */
function clearBeside({ root, unit, topic }) {
  keepRecordRound(root, unit, topic);
  for (const rel of [verifyingPath(unit, topic), refusedPath(unit, topic)]) fs.rmSync(path.join(root, rel), { force: true });
}

/**
 * `ledger carry <unit>.<phase>.<topic> --dry-run`: every fault the carry
 * would refuse the topic's record for, none where it would carry it,
 * writing nothing.
 * @param {string} cwd @param {string} dotpath
 */
function dryRun(cwd, dotpath) {
  const place = topicPlace(cwd, dotpath, SAID);
  return { faults: drawnRecord(cwd, place, readRecord(place)).faults };
}

/**
 * `ledger carry <unit>.<phase>.<topic>`: the topic's record appended in one
 * write, what was carried kept, what was said of it beside it cleared, the
 * ledger's commit held for the migration's. Answers how many entries it
 * carried, each entry's short id by its ref, the commit — null, held — and
 * any warnings; a dry run, the record's faults.
 * @param {string} cwd @param {string[]} args
 */
function carryRecord(cwd, args) {
  /** @type {string[]} */
  const warnings = [];
  try {
    assertMigrationRuns(stateRoot(cwd), SAID, 'a topic\'s record is carried into the ledger');
    const { dotpath, dry } = argsOf(args);
    if (dry) return dryRun(cwd, dotpath);
    const place = topicPlace(cwd, dotpath, SAID);
    const { record, lines, kept } = composedRecord(cwd, place);
    const { outcome, short } = withStateLock(place.root, () => {
      const beside = idsBeside(place, warnings);
      refuseUnsettled(cwd, place);
      keepCarried(place, record, kept);
      if (lines.length > 0) appendEntries(place.root, lines, warnings);
      return {
        outcome: lines.length === 0 ? null : commitLedger(cwd, `ledger(${place.unit}): carry ${place.topic === null ? 'its discovery' : place.topic}'s record`, warnings),
        short: shortIds([...beside, ...lines.map(({ id }) => id)]),
      };
    });
    clearBeside(place);
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

module.exports = { CARRY_VERB, CARRY_USAGE, DRY_RUN, placePath, recordName, readRecord, recordHash, roundsKept, carriedPath, composedPath, findingsPath, rulingsPath, handbackPath, handedBack, checkedPath, verifyingPath, noteVerifying, briefedOn, lastVerdicts, uncheckedRound, unsettledRound, lastRound, keepRound, keepRecordRound, besideFindings, refusedPath, roundsPath, settledPath, topicPlace, carryRecord };
