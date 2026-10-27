'use strict';

// ---------------------------------------------------------------------------
// Domain ring: "what have you decided without me?" and the map's "since you
// last looked" — one query (5.8.7) — and the last-looked mark it counts from
// (5.8.14, 5.8.15): `ledger since`, and `ledger shown`, the read a screen
// draws from as it shows in the conversation.
//
// - Claude's calls: the current decisions Claude made, `by` claude, the
//   build's included (5.1.6), standing in a unit or on one of its topics.
// - The mark is the machine's own: the ids of the calls a screen has shown
//   on this machine, each topic's map and the spec's list alike, kept in the
//   cache at `.cache/.marks/{unit}.json`. It sits outside the unit's own
//   cache, which a cancel or a completion clears, so a unit reactivated or
//   reopened keeps what was shown; it goes when the unit is absorbed. A call
//   is new until a look here has covered it, wherever it sits in the ledger:
//   a catch-up merge lays the other machine's entries before this one's
//   unpushed ones, and a call made there was never shown here.
// - Only `ledger shown` moves the mark: opening the board is not looking. It
//   answers as `ledger since` does, and adds each call it showed to the mark
//   — on the topic named, or across the unit. Under a lock of the mark's
//   own, so no look's calls are lost to another's. The cache is off the
//   state branch: looking never commits, and each machine counts from its
//   own looks (4.1.7).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { messageOf } = require('../kernel/call.cjs');
const { isObject, writeJsonAtomic, withStateLockFile } = require('../kernel/manifest-io.cjs');
const { standingOf, isCurrent } = require('./ledger-fold.cjs');

/** @typedef {import('./ledger-fold.cjs').Folded} Folded */
/** @typedef {import('./ledger-read.cjs').Shower} Shower */
/** @typedef {import('./ledger-read.cjs').Place} Place */

/** The last-looked mark: the full ids of the calls shown on this machine. @typedef {{shown: string[]}} Marks */

/** A new call, and the topic it stands on — null at the unit's level, the spec's. @typedef {{id: string, topic: string|null}} Call */

/** The marks' folder in the cache. @param {string} root */
function marksDir(root) {
  return path.join(root, '.cache', '.marks');
}

/** The unit's mark. @param {string} root @param {string} unit */
function marksFile(root, unit) {
  return path.join(marksDir(root), `${unit}.json`);
}

/** Whether a mark read is in its shape: the ids shown, and nothing else. @param {unknown} marks @returns {marks is Marks} */
function isMarks(marks) {
  return isObject(marks) && Object.keys(marks).length === 1 && Array.isArray(marks.shown) && marks.shown.every((id) => typeof id === 'string');
}

/**
 * The unit's mark on this machine; nothing shown where none is kept.
 * @param {string} root @param {string} unit
 * @returns {Marks}
 */
function marksOf(root, unit) {
  const file = marksFile(root, unit);
  if (!fs.existsSync(file)) return { shown: [] };
  let marks;
  try {
    marks = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`the last-looked mark at ${file} is no JSON — ${messageOf(err)}`);
  }
  if (!isMarks(marks)) throw new Error(`the last-looked mark at ${file} is not {"shown": [<id>, …]}, the ids of the calls shown`);
  return marks;
}

/**
 * Claude's current calls standing in `unit` and, given one, on `topic`,
 * that no look on this machine has shown, in the ledger's order. None on a
 * unit or topic that is not live.
 * @param {Folded} folded @param {Marks} marks @param {string} unit @param {string|null} topic
 * @returns {Call[]}
 */
function callsSince(folded, marks, unit, topic) {
  if (folded.live(unit, topic) !== null) return [];
  const shown = new Set(marks.shown);
  /** @type {Call[]} */
  const calls = [];
  for (const [id, facts] of folded.facts) {
    if (shown.has(id) || facts.kind !== 'decision' || facts.by !== 'claude' || !isCurrent(folded, id)) continue;
    const standing = standingOf(folded, id);
    if (standing.unit === unit && (topic === null || standing.topic === topic)) calls.push({ id, topic: standing.topic });
  }
  return calls;
}

/**
 * The new calls as a read answers them: each line, and where it stands.
 * @param {Shower} shower @param {Place} place @param {Call[]} calls
 */
function answerOf({ folded, show }, { unit, topic }, calls) {
  return {
    unit,
    topic,
    live: folded.live(/** @type {string} */ (unit), topic) === null,
    calls: calls.map((call) => ({ ...show(call.id), standing: { unit, topic: call.topic } })),
  };
}

/**
 * `ledger since`: Claude's calls in a unit or on a topic that no look on
 * this machine has shown. Moves no mark.
 * @param {Shower} shower @param {Place} place @param {string} root
 */
function answerSince(shower, place, root) {
  const unit = /** @type {string} */ (place.unit);
  return answerOf(shower, place, callsSince(shower.folded, marksOf(root, unit), unit, place.topic));
}

/**
 * `ledger shown`: what `ledger since` answers, each call it shows added to
 * the mark. Runs under the mark's lock (`withMarkLock`).
 * @param {Shower} shower @param {Place} place @param {string} root
 */
function answerShown(shower, place, root) {
  const unit = /** @type {string} */ (place.unit);
  const marks = marksOf(root, unit);
  const calls = callsSince(shower.folded, marks, unit, place.topic);
  if (calls.length > 0) writeJsonAtomic(marksFile(root, unit), { shown: [...marks.shown, ...calls.map((call) => call.id)] });
  return answerOf(shower, place, calls);
}

/**
 * `read` holding the lock of the unit's mark, beside it in the cache.
 * @template T
 * @param {string} root @param {Place} place @param {() => T} read
 * @returns {T}
 */
function withMarkLock(root, { unit }, read) {
  fs.mkdirSync(marksDir(root), { recursive: true });
  return withStateLockFile(`${marksFile(root, /** @type {string} */ (unit))}.lock`, read);
}

/** Remove a unit's mark, under its lock, as the unit goes. @param {string} root @param {string} unit */
function dropMarks(root, unit) {
  withMarkLock(root, { unit, topic: null }, () => fs.rmSync(marksFile(root, unit), { force: true }));
}

module.exports = { answerSince, answerShown, withMarkLock, dropMarks };
