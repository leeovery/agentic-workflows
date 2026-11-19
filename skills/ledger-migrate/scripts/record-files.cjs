'use strict';

//
// record-files.cjs — the files a topic's record is kept in as the records
// directive composes, verifies and carries it (079), which its check and the
// engine's carry (ledger-carry.cjs) both read, so neither keeps a copy and no
// migration loads the engine. Frozen with 079, as the carry's record is: a
// later version keeps reading them while 079 can run.
//
// Each file is state-relative, beneath the composed records' folder or the
// carried ones', a topic's in its unit's folder and a unit's own beside it;
// what the session is told to write or remove is named by its whole path,
// for it runs from the project's folder, never the state's.
// What the carry would still refuse a record its verifier passed for is
// read from them alone: findings handed back to the session (`handedBack`),
// and the record changed since its verifier was briefed on it, or its
// verdicts missing an entry its brief asked one of (`unsettledRound`,
// `verdictGaps`). Where a record's round stands is read from them too: the
// rounds kept (`roundsKept`), each finding standing (`findingItems`), and
// the round the session settles from (`SETTLED_FROM`).
//

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/** What the migration carried of each topic, state-relative: `{unit}/{topic}.json` beneath it. */
const CARRIED = '.cache/migrate/carried';

/**
 * Where each topic's record is composed before it is carried, and the
 * verifier's findings on it written, state-relative: `{unit}/{topic}.json`
 * and `{unit}/{topic}.findings.txt` beneath it.
 */
const COMPOSED = '.cache/migrate/records';

/**
 * The files a record is kept in as it is composed, beneath the composed
 * records' folder, by their endings: the record, its verifier's findings,
 * rulings, verdicts and note, the carry's refusal, its composer's
 * hand-back, its rounds, and the points the session settled.
 */
const ENDINGS = Object.freeze({
  composed: '.json',
  findings: '.findings.txt',
  rulings: '.rulings.txt',
  checked: '.checked.txt',
  verifying: '.verifying.json',
  refused: '.refused.md',
  handback: '.handback.txt',
  rounds: '.rounds.md',
  settled: '.settled.md',
});

/** Each ending a file a record is kept in as it is composed takes. */
const RECORD_ENDINGS = Object.freeze(Object.values(ENDINGS));

/**
 * The record its verifier was briefed on, as its brief's note keeps it:
 * its hash, the refs of the entries asked a verdict of, and the entries it
 * held, by ref; the engine reads more of it (later-rounds.cjs, `Note`).
 * @typedef {{hash: string, refs: string[], entries: Record<string, string>}} Briefed
 */

/**
 * A file of a record's beneath `folder`: a topic's in its unit's folder, a
 * unit's own beside that folder.
 * @param {string} folder @param {string} unit @param {string|null} topic @param {string} ending
 */
const recordFile = (folder, unit, topic, ending) => (topic === null ? path.posix.join(folder, `${unit}${ending}`) : path.posix.join(folder, unit, `${topic}${ending}`));

/** @param {string} unit @param {string|null} topic */
const carriedPath = (unit, topic) => recordFile(CARRIED, unit, topic, '.json');

/** @param {string} unit @param {string|null} topic */
const composedPath = (unit, topic) => recordFile(COMPOSED, unit, topic, ENDINGS.composed);

/** @param {string} unit @param {string|null} topic */
const findingsPath = (unit, topic) => recordFile(COMPOSED, unit, topic, ENDINGS.findings);

/** @param {string} unit @param {string|null} topic */
const refusedPath = (unit, topic) => recordFile(COMPOSED, unit, topic, ENDINGS.refused);

/** The points the last verifier ruled are not the record's, or a later answer replaced. @param {string} unit @param {string|null} topic */
const rulingsPath = (unit, topic) => recordFile(COMPOSED, unit, topic, ENDINGS.rulings);

/** The findings the composer handed back to the session, asking for a point the rulings set aside. @param {string} unit @param {string|null} topic */
const handbackPath = (unit, topic) => recordFile(COMPOSED, unit, topic, ENDINGS.handback);

/** The last verifier's verdict on each entry it read, a line each, `{ref}: ok` or `{ref}: see finding`. @param {string} unit @param {string|null} topic */
const checkedPath = (unit, topic) => recordFile(COMPOSED, unit, topic, ENDINGS.checked);

/** The record its last verifier was briefed on, `{hash, refs}`, written as its brief is issued. @param {string} unit @param {string|null} topic */
const verifyingPath = (unit, topic) => recordFile(COMPOSED, unit, topic, ENDINGS.verifying);

/** Every verifier's findings before the last, each under its round, its rulings and its verdicts with it. @param {string} unit @param {string|null} topic */
const roundsPath = (unit, topic) => recordFile(COMPOSED, unit, topic, ENDINGS.rounds);

/** The points of the record the session settled where a verifier reversed an earlier round. @param {string} unit @param {string|null} topic */
const settledPath = (unit, topic) => recordFile(COMPOSED, unit, topic, ENDINGS.settled);

/** The heading each verifier's round is kept under in the rounds file. */
const ROUND = /^## Round (\d+)$/gm;

/** The first round whose findings the session settles, in a verifier's place (`ledger settle`). */
const SETTLED_FROM = 3;

/** A finding's opening line in a findings file: a list item at the line's start. */
const FINDING = /^(?:[-*+]|[0-9]+[.)])[ \t]+/;

/** How many rounds are kept at `rounds`. @param {string} rounds */
const roundsKept = (rounds) => (fs.existsSync(rounds) ? [...fs.readFileSync(rounds, 'utf8').matchAll(ROUND)].length : 0);

/** Each finding a findings file's text holds, its list items' opening lines bare of their marks, or its text one finding where it holds none. @param {string} text */
function findingItems(text) {
  const items = text.split('\n').filter((line) => FINDING.test(line)).map((line) => line.replace(FINDING, ''));
  return items.length > 0 ? items : [text.trim()];
}

/** A file's lines holding anything, trimmed; none where it is no file. @param {string} file */
const linesOf = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean) : []);

/** The record as composed, hashed: what tells whether it changed since its verifier was briefed on it. @param {string} root @param {string} unit @param {string|null} topic */
const recordHash = (root, unit, topic) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, composedPath(unit, topic)))).digest('hex');

/** The record the last verifier was briefed on, or null where none was. @param {string} root @param {string} unit @param {string|null} topic @returns {Briefed|null} */
function briefedOn(root, unit, topic) {
  const file = path.join(root, verifyingPath(unit, topic));
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/** The ref a verdict names: before its first colon, a list item's mark and backticks aside. @param {string} line */
const verdictRef = (line) => line.replace(/^(?:[-*+]|\d+[.)])\s+/, '').split(':')[0].replace(/`/g, '').trim();

/**
 * Where findings of the record stand handed back to the session, what it
 * does before the record goes on, said of the record; else null.
 * @param {string} root @param {string} unit @param {string|null} topic @returns {string|null}
 */
function handedBack(root, unit, topic) {
  const file = path.join(root, handbackPath(unit, topic));
  if (linesOf(file).length === 0) return null;
  return `has findings handed back to the session in ${file}: settle each into ${path.join(root, settledPath(unit, topic))}, replace it in ${path.join(root, findingsPath(unit, topic))} with \`Settled: {point}, amend to agree\` where the record changes, or take it out where it stands, then remove ${file}`;
}

/**
 * The last verifier's verdicts held to the entries its brief asked a verdict
 * of — the note its brief was issued on, else, where none was, `refs` for
 * both: whether its verdicts file is missing, though a verdict was asked;
 * each entry asked of it names no verdict on; and each it names that the
 * record it read does not hold.
 * @param {string} root @param {string} unit @param {string|null} topic @param {string[]} refs
 * @returns {{unwritten: boolean, missing: string[], unknown: string[]}}
 */
function verdictGaps(root, unit, topic, refs) {
  const note = briefedOn(root, unit, topic);
  const asked = note?.refs ?? refs;
  const held = note === null ? refs : Object.keys(note.entries);
  const checked = path.join(root, checkedPath(unit, topic));
  const named = linesOf(checked).map(verdictRef);
  return {
    unwritten: !fs.existsSync(checked) && asked.length > 0,
    missing: asked.filter((ref) => !named.includes(ref)),
    unknown: [...new Set(named.filter((ref) => !held.includes(ref)))],
  };
}

/** The files a verifier that gave no verdict on every entry left, to remove before a fresh one is briefed, whole: those it wrote of its findings, rulings and verdicts. @param {string} root @param {string} unit @param {string|null} topic */
const verdictlessFiles = (root, unit, topic) => [findingsPath, rulingsPath, checkedPath].map((rel) => path.join(root, rel(unit, topic))).filter((file) => fs.existsSync(file));

/** Files as a sentence names them: `a`, `a and b`, `a, b and c`. @param {string[]} files */
const inWords = (files) => (files.length < 3 ? files.join(' and ') : `${files.slice(0, -1).join(', ')} and ${files.at(-1)}`);

/**
 * Where the last verifier's verdicts do not name each entry its brief
 * asked a verdict of, or name one the record it read does not hold
 * (`verdictGaps`), what is missing, and the way on, said of the record;
 * else null. A consistency guard alone: what each verdict says is the
 * verifier's.
 * @param {string} root @param {string} unit @param {string|null} topic @param {string[]} refs
 * @returns {string|null}
 */
function unchecked(root, unit, topic, refs) {
  const { unwritten, missing, unknown } = verdictGaps(root, unit, topic, refs);
  const checked = path.join(root, checkedPath(unit, topic));
  const told = [
    ...(unwritten ? [`${checked} is no file`] : []),
    ...(missing.length > 0 ? [`it names no verdict on ${missing.join(', ')}`] : []),
    ...(unknown.length > 0 ? [`it names ${unknown.join(', ')}, which the record it read does not hold`] : []),
  ];
  if (told.length === 0) return null;
  return `has no verdict from its last verifier on every entry its brief asked one of — ${told.join('; ')}: a verifier writes a line for each entry its walk sheet does not mark passed, \`{ref}: ok\` or \`{ref}: see finding\`, and one that does not has given no verdict — remove ${inWords(verdictlessFiles(root, unit, topic))}, and brief a fresh verifier`;
}

/**
 * Where a record its verifier passed is not as the carry takes it — changed
 * since that verifier was briefed on it, or its verdicts missing an entry
 * its brief asked one of (`unchecked`) — what stands and the way on, said
 * of the record; else null.
 * @param {string} root @param {string} unit @param {string|null} topic @param {string[]} refs the record's
 * @returns {string|null}
 */
function unsettledRound(root, unit, topic, refs) {
  const briefed = briefedOn(root, unit, topic);
  if (briefed !== null && briefed.hash !== recordHash(root, unit, topic)) return 'has changed since its verifier was briefed on it: a record is carried as its verifier read it — brief a fresh verifier';
  return unchecked(root, unit, topic, refs);
}

module.exports = {
  CARRIED, COMPOSED, RECORD_ENDINGS, SETTLED_FROM, recordFile, carriedPath, composedPath, findingsPath, refusedPath, rulingsPath, handbackPath, checkedPath, verifyingPath, roundsPath, settledPath,
  linesOf, roundsKept, findingItems, recordHash, briefedOn, verdictRef, handedBack, verdictGaps, verdictlessFiles, unchecked, unsettledRound,
};
