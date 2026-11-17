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
// - What: on stdin, `{"findings": [{"finding", "settled", "why"}]}`: each
//   finding standing, as the session names it, `fixed` — the record amended
//   to answer it — or `ruled-out`, and why.
// - It writes, beside the record: the last verifier's round kept with the
//   rounds before it, as the next brief would keep it; after it, a round of
//   the session's own, each finding as settled and why; and the record
//   noted as the session passed it — hashed, asking no verdict, marked
//   settled — so the carry takes it (079's check, `unverified`), and
//   refuses it changed since, as it refuses a record changed since its
//   verifier read it.
// - It refuses, writing nothing: outside the migration; argv or stdin of
//   another shape; a place the carry refuses; findings the record's
//   composer handed back still standing; no findings standing — no round
//   written since the last brief, or one that passed the record; findings
//   of a round before the third; a round whose verdicts miss what its brief
//   asked (ledger-carry.cjs, `uncheckedRound`); and a finding settled fixed
//   on a record unchanged since its verifier was briefed on it.
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
const SETTLE_USAGE = 'ledger settle <work-unit>.<phase>.<topic>|<work-unit>.discovery   (each finding standing as JSON on stdin, {"findings": [{"finding", "settled", "why"}]}, settled fixed or ruled-out)';
const SAID = 'ledger settle';

/** The first round whose findings the session settles. */
const SETTLED_FROM = 3;

/** How each finding may be settled, and how the session's round says it. @type {Readonly<Record<string, string>>} */
const SETTLED_AS = Object.freeze({ fixed: 'fixed', 'ruled-out': 'ruled out' });

/** A finding as the session settled it. @typedef {{finding: string, settled: string, why: string}} Settled */

/** @param {unknown} one @returns {one is Settled} */
const isSettled = (one) => isObject(one) && Object.keys(one).length === 3 && LINE.test(one.finding) && Object.hasOwn(SETTLED_AS, /** @type {string} */ (one.settled)) && LINE.test(one.why);

/** The settlement on stdin, refused in another shape. @param {() => string} stdin @returns {Settled[]} */
function settlementOf(stdin) {
  const given = stdinObject(stdin(), SAID, 'the settlement');
  const { findings } = given;
  if (Object.keys(given).length !== 1 || !Array.isArray(findings) || findings.length === 0 || !findings.every(isSettled)) {
    throw new Error(`${SAID}: the settlement is {"findings": [...]}, one at least, each {"finding", "settled", "why"}: the finding, one line; ${Object.keys(SETTLED_AS).join(' or ')}; and why, one line`);
  }
  return findings;
}

/**
 * The round whose findings stand, refused where none the session settles
 * stands: handed back to it, none written, a pass, before the third round,
 * or written without a verdict on each entry asked.
 * @param {import('./ledger-carry.cjs').Place} place @returns {number}
 */
function standingRound(place) {
  const { root, unit, topic } = place;
  const handed = handedBack(root, unit, topic);
  if (handed !== null) throw new Error(`${SAID}: ${recordName(place)} ${handed}`);
  const findings = path.join(root, findingsPath(unit, topic));
  if (!fs.existsSync(findings) || fs.readFileSync(findings, 'utf8').trim() === '') {
    throw new Error(`${SAID}: ${recordName(place)} has no findings standing in ${findingsPath(unit, topic)} — the session settles what a verifier found, and a record with none has passed, or waits on its verifier`);
  }
  const round = roundsKept(path.join(root, roundsPath(unit, topic))) + 1;
  if (round < SETTLED_FROM) {
    throw new Error(`${SAID}: ${recordName(place)}'s findings are round ${round}'s, and the session settles a verifier's from round ${SETTLED_FROM} on — before it, a fresh per-topic agent amends the record and a fresh verifier reads what changed`);
  }
  const unchecked = uncheckedRound(root, unit, topic);
  if (unchecked !== null) throw new Error(`${SAID}: ${recordName(place)} ${unchecked}`);
  return round;
}

/** The session's round, each finding as settled and why. @param {number} number @param {Settled[]} settled */
const sessionRound = (number, settled) => [`## Round ${number}`, 'Settled by the session:', settled.map(({ finding, settled: as, why }) => `- ${finding}: ${SETTLED_AS[as]} — ${why}`).join('\n')].join('\n\n');

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
  const round = standingRound(place);
  const note = briefedOn(root, unit, topic);
  if (note !== null && note.hash === recordHash(root, unit, topic) && settled.some((one) => one.settled === 'fixed')) {
    throw new Error(`${SAID}: ${recordName(place)} is as its verifier read it, so no finding of it is fixed — have the record amended to answer it, or rule it out`);
  }
  const entries = readRecord(place, SAID);
  const before = pastOf(note, lastVerdicts(root, unit, topic));
  keepRecordRound(root, unit, topic);
  fs.appendFileSync(path.join(root, roundsPath(unit, topic)), `\n${sessionRound(round + 1, settled)}\n`);
  noteVerifying(root, unit, topic, { refs: [], entries: entryHashes(entries), held: entriesHeld(entries), sections: {}, before, settled: true });
  return { round: round + 1, settled: settled.length };
}

module.exports = { SETTLE_VERB, SETTLE_USAGE, settleRecord };
