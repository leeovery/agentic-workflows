'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the session's settlement of a record a third verifier round
// still finds against (21.6.10, directive 079) — `ledger settle
// <unit>.<phase>.<topic>|<unit>.discovery`. From the third round on, a
// verifier's finding goes to the session, never to an agent: it settles each
// from the record's sources, has the record amended where one changes it,
// and records here what became of each, in place of a fresh verifier.
//
// - When: only while the migration runs, as the carry.
// - What: on stdin, `{"findings": [{"numbers", "settled", "why"}]}`: every
//   finding of the round, named by its number — the findings file's list
//   items in order, or its text one finding where it holds none — one
//   entry naming several the session settles alike, each `fixed` — the
//   record amended to answer it — or `ruled-out`, and why.
// - It writes, beside the record: the last verifier's round kept with the
//   rounds before it, as the next brief would keep it; after it, a round of
//   the session's own, each finding as settled and why; and the record
//   noted as the session passed it — hashed, asking no verdict, marked
//   settled — so the carry takes it (079's check, `unverified`), and
//   refuses it changed since, as it refuses a record changed since its
//   verifier read it.
// - It refuses, writing nothing: outside the migration; argv or stdin of
//   another shape; a place the carry refuses; findings the record's
//   composer handed back still standing; a record the session passed that
//   no verifier has read since, whose findings are the session's own, for
//   a fresh verifier; no findings standing — no round written since the
//   last brief, or one that passed the record; findings of a round before
//   the third; a round whose verdicts miss what its brief asked
//   (ledger-carry.cjs, `uncheckedRound`); a settlement naming a finding the
//   round lacks, one twice, or leaving one unnamed; and a finding settled
//   fixed on a record unchanged since its verifier was briefed on it.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { stdinObject } = require('../kernel/call.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { assertMigrationRuns } = require('./state-worktree.cjs');
const { LINE } = require('./event-fields.cjs');
const { entryHashes, entriesHeld, pastOf } = require('./later-rounds.cjs');
const {
  topicPlace, recordName, readRecord, recordHash, roundsKept, findingsPath, roundsPath, handedBack, uncheckedRound, briefedOn, lastVerdicts, keepRecordRound, noteVerifying,
} = require('./ledger-carry.cjs');

const SETTLE_VERB = 'settle';
const SETTLE_USAGE = 'ledger settle <work-unit>.<phase>.<topic>|<work-unit>.discovery   (every finding of the round by its number as JSON on stdin, {"findings": [{"numbers", "settled", "why"}]}, settled fixed or ruled-out)';
const SAID = 'ledger settle';

/** The first round whose findings the session settles. */
const SETTLED_FROM = 3;

/** How each finding may be settled, and how the session's round says it. @type {Readonly<Record<string, string>>} */
const SETTLED_AS = Object.freeze({ fixed: 'fixed', 'ruled-out': 'ruled out' });

/** Findings the session settled alike, by their numbers. @typedef {{numbers: number[], settled: string, why: string}} Settled */

/** @param {unknown} numbers @returns {numbers is number[]} */
const isNumbers = (numbers) => Array.isArray(numbers) && numbers.length > 0 && numbers.every((n) => Number.isInteger(n) && n > 0);

/** @param {unknown} one @returns {one is Settled} */
const isSettled = (one) => isObject(one) && Object.keys(one).length === 3 && isNumbers(one.numbers) && Object.hasOwn(SETTLED_AS, /** @type {string} */ (one.settled)) && LINE.test(one.why);

// A finding's opening line: a list item at the line's start.
const FINDING = /^(?:[-*+]|[0-9]+[.)])[ \t]/;

/** How many findings a findings file holds: its list items, or its text one where it holds none. @param {string} text */
function findingsIn(text) {
  const items = text.split('\n').filter((line) => FINDING.test(line)).length;
  return items > 0 ? items : 1;
}

/** Numbers as the session's round names them. @param {number[]} numbers */
const numbered = (numbers) => `${numbers.length === 1 ? 'Finding' : 'Findings'} ${numbers.join(', ')}`;

/** The settlement on stdin, refused in another shape. @param {() => string} stdin @returns {Settled[]} */
function settlementOf(stdin) {
  const given = stdinObject(stdin(), SAID, 'the settlement');
  const { findings } = given;
  if (Object.keys(given).length !== 1 || !Array.isArray(findings) || findings.length === 0 || !findings.every(isSettled)) {
    throw new Error(`${SAID}: the settlement is {"findings": [...]}, one at least, each {"numbers", "settled", "why"}: the numbers of the findings it settles, one at least; ${Object.keys(SETTLED_AS).join(' or ')}; and why, one line`);
  }
  return findings;
}

/**
 * The round whose findings stand, and how many it holds, refused where none
 * the session settles stands: handed back to it, written since the
 * session's own pass, none written, a pass, before the third round, or
 * written without a verdict on each entry asked.
 * @param {import('./ledger-carry.cjs').Place} place @returns {{round: number, count: number}}
 */
function standingRound(place) {
  const { root, unit, topic } = place;
  const handed = handedBack(root, unit, topic);
  if (handed !== null) throw new Error(`${SAID}: ${recordName(place)} ${handed}`);
  if (briefedOn(root, unit, topic)?.settled === true) {
    throw new Error(`${SAID}: ${recordName(place)} was passed by the session, and no verifier has read it since — a finding written since is the session's own, which a fresh verifier reads once the record is amended: brief a fresh verifier`);
  }
  const findings = path.join(root, findingsPath(unit, topic));
  const text = fs.existsSync(findings) ? fs.readFileSync(findings, 'utf8') : '';
  if (text.trim() === '') {
    throw new Error(`${SAID}: ${recordName(place)} has no findings standing in ${findingsPath(unit, topic)} — the session settles what a verifier found, and a record with none has passed, or waits on its verifier`);
  }
  const round = roundsKept(path.join(root, roundsPath(unit, topic))) + 1;
  if (round < SETTLED_FROM) {
    throw new Error(`${SAID}: ${recordName(place)}'s findings are round ${round}'s, and the session settles a verifier's from round ${SETTLED_FROM} on — before it, a fresh per-topic agent amends the record and a fresh verifier reads what changed`);
  }
  const unchecked = uncheckedRound(root, unit, topic);
  if (unchecked !== null) throw new Error(`${SAID}: ${recordName(place)} ${unchecked}`);
  return { round, count: findingsIn(text) };
}

/**
 * Where the settlement is not every finding of the round, each once: what
 * it names that the round lacks, names twice, or leaves unnamed.
 * @param {Settled[]} settled @param {number} count @returns {string[]}
 */
function unsettledFindings(settled, count) {
  const named = settled.flatMap(({ numbers }) => numbers);
  const all = Array.from({ length: count }, (_, at) => at + 1);
  const lacked = [...new Set(named.filter((n) => n > count))];
  const twice = [...new Set(named.filter((n, at) => named.indexOf(n) !== at))];
  const unnamed = all.filter((n) => !named.includes(n));
  return [
    ...(lacked.length > 0 ? [`it names ${lacked.join(', ')}, which the round lacks`] : []),
    ...(twice.length > 0 ? [`it names ${twice.join(', ')} twice`] : []),
    ...(unnamed.length > 0 ? [`it leaves ${unnamed.join(', ')} unsettled`] : []),
  ];
}

/** The session's round, each finding as settled and why. @param {number} number @param {Settled[]} settled */
const sessionRound = (number, settled) => [`## Round ${number}`, 'Settled by the session:', settled.map(({ numbers, settled: as, why }) => `- ${numbered(numbers)}: ${SETTLED_AS[as]} — ${why}`).join('\n')].join('\n\n');

/**
 * `ledger settle <unit>.<phase>.<topic>`: the findings standing on a
 * record from its third round on settled by the session, the record passed
 * as it stands. Answers the session's round and how many it settled.
 * @param {string} cwd @param {string[]} args @param {() => string} stdin
 */
function settleRecord(cwd, args, stdin) {
  assertMigrationRuns(stateRoot(cwd), SAID, 'a record is settled by the session');
  if (args.length !== 1 || args[0].startsWith('--')) throw new Error(`Usage: engine ${SETTLE_USAGE}`);
  const place = topicPlace(cwd, args[0], SAID);
  const { root, unit, topic } = place;
  const settled = settlementOf(stdin);
  const { round, count } = standingRound(place);
  const unsettled = unsettledFindings(settled, count);
  if (unsettled.length > 0) {
    throw new Error(`${SAID}: ${recordName(place)}'s round ${round} holds ${count === 1 ? 'one finding' : `findings 1 to ${count}`}, and the settlement is not each once — ${unsettled.join('; ')}: name every finding of the round by its number, one entry naming several settled alike`);
  }
  const note = briefedOn(root, unit, topic);
  if (note !== null && note.hash === recordHash(root, unit, topic) && settled.some((one) => one.settled === 'fixed')) {
    throw new Error(`${SAID}: ${recordName(place)} is as its verifier read it, so no finding of it is fixed — have the record amended to answer it, or rule it out`);
  }
  const { entries } = readRecord(place, SAID);
  const before = pastOf(note, lastVerdicts(root, unit, topic));
  keepRecordRound(root, unit, topic);
  fs.appendFileSync(path.join(root, roundsPath(unit, topic)), `\n${sessionRound(round + 1, settled)}\n`);
  noteVerifying(root, unit, topic, { refs: [], entries: entryHashes(entries), held: entriesHeld(entries), sections: {}, before, settled: true });
  return { round: round + 1, settled: settled.length };
}

module.exports = { SETTLE_VERB, SETTLE_USAGE, settleRecord };
