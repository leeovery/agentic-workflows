'use strict';

// ---------------------------------------------------------------------------
// Domain ring: "what have you decided without me?" and the map's "since you
// last looked" — one query (5.8.7) — and the last-looked mark it counts from
// (5.8.14, 5.8.15): `ledger since`, and `ledger shown`, the read a screen
// draws from as it shows in the conversation.
//
// - Claude's calls: the current decisions Claude made, `by` claude, the
//   build's included (5.1.6), that a place shows (5.8.19): a topic, those
//   its map shows — its rows' answers, and an answer whose question is set
//   aside on a row of its own; a unit, those it shows anywhere, its topics'
//   maps and its own level's list alike — each by where it shows
//   (ledger-fold.cjs), so a later unit's replacement of an earlier unit's
//   decision is new in both.
// - The mark is the machine's own: the ids of the calls a screen has shown
//   on this machine, each topic's map and the spec's list alike, kept in the
//   cache at `.cache/.marks/{unit}.json`. It sits outside the unit's own
//   cache, which a cancel or a completion clears, so a unit reactivated or
//   reopened keeps what was shown; it goes when the unit is absorbed. A call
//   is new until a look here has covered it, wherever it sits in the ledger:
//   a catch-up merge lays the other machine's entries before this one's
//   unpushed ones, and a call made there was never shown here. A look at any
//   place a call shows in shows it for every place: the look adds it to its
//   own unit's mark, and a read counts it shown where any unit's mark on
//   this machine holds it, a unit set aside since among them.
// - Only `ledger shown` moves the mark: opening the board is not looking. It
//   answers as `ledger since` does, and adds each call it showed to the mark
//   — on the topic named, or across the unit. The ledger is folded first,
//   and its check may take the writer lock; only then is the mark's own lock
//   taken, around reading the mark and writing it, so no look's calls are
//   lost to another's and the writer lock is never waited on holding it.
//   The cache is off the state branch: looking never commits, and each
//   machine counts from its own looks (4.1.7).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { messageOf } = require('../kernel/call.cjs');
const { isObject, writeJsonAtomic, withStateLockFile } = require('../kernel/manifest-io.cjs');
const { standingOf, inPlace, showsIn } = require('./ledger-fold.cjs');
const { isId } = require('./ledger-ids.cjs');

/** @typedef {import('./ledger-fold.cjs').Folded} Folded */
/** @typedef {import('./ledger-fold.cjs').Standing} Standing */
/** @typedef {import('./ledger-read.cjs').Shower} Shower */
/** @typedef {import('./ledger-read.cjs').Place} Place */

/** The last-looked mark: the full ids of the calls shown on this machine. @typedef {{shown: string[]}} Marks */

/** The marks' folder in the cache. @param {string} root */
function marksDir(root) {
  return path.join(root, '.cache', '.marks');
}

/** The unit's mark. @param {string} root @param {string} unit */
function marksFile(root, unit) {
  return path.join(marksDir(root), `${unit}.json`);
}

/** Whether a mark read is in its shape: the ledger ids shown, and nothing else. @param {unknown} marks @returns {marks is Marks} */
function isMarks(marks) {
  return isObject(marks) && Object.keys(marks).length === 1 && Array.isArray(marks.shown) && marks.shown.every(isId);
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
 * The calls a look on this machine has shown: those every unit's mark
 * holds, the read's own unit's as `own` holds it.
 * @param {string} root @param {string} unit @param {Marks} own
 * @returns {Set<string>}
 */
function shownHere(root, unit, own) {
  const shown = new Set(own.shown);
  const others = fs.existsSync(marksDir(root)) ? fs.readdirSync(marksDir(root)).filter((name) => name.endsWith('.json') && name !== `${unit}.json`) : [];
  for (const name of others) for (const id of marksOf(root, name.slice(0, -'.json'.length)).shown) shown.add(id);
  return shown;
}

/**
 * Claude's current calls `place` shows that no look on this machine has
 * shown, in the ledger's order: on a topic, those it shows on its map;
 * across a unit, those it shows anywhere. None on a unit or topic that is
 * not live.
 * @param {Folded} folded @param {Place} place @param {Set<string>} shown
 * @returns {string[]}
 */
function callsSince(folded, { unit, topic }, shown) {
  const at = /** @type {string} */ (unit);
  if (folded.live(at, topic) !== null) return [];
  /** @type {string[]} */
  const calls = [];
  for (const [id, facts] of folded.facts) {
    if (facts.kind !== 'decision' || facts.by !== 'claude' || shown.has(id)) continue;
    if (showsIn(folded, id).some((place) => inPlace(place, at, topic))) calls.push(id);
  }
  return calls;
}

/**
 * The new calls as a read answers them: each line, and where it stands.
 * @param {Shower} shower @param {Place} place @param {string[]} calls
 */
function answerOf({ folded, show }, { unit, topic }, calls) {
  return {
    unit,
    topic,
    live: folded.live(/** @type {string} */ (unit), topic) === null,
    calls: calls.map((id) => ({ ...show(id), standing: standingOf(folded, id) })),
  };
}

/**
 * `ledger since`: Claude's calls a unit or a topic shows that no look on
 * this machine has shown. Moves no mark.
 * @param {Shower} shower @param {Place} place @param {string} root
 */
function answerSince(shower, place, root) {
  const unit = /** @type {string} */ (place.unit);
  return answerOf(shower, place, callsSince(shower.folded, place, shownHere(root, unit, marksOf(root, unit))));
}

/**
 * `ledger shown`: what `ledger since` answers, each call it shows added to
 * the unit's mark under the mark's lock, taken once the ledger is folded.
 * @param {Shower} shower @param {Place} place @param {string} root
 */
function answerShown(shower, place, root) {
  const unit = /** @type {string} */ (place.unit);
  const calls = withMarkLock(root, unit, () => {
    const marks = marksOf(root, unit);
    const shown = callsSince(shower.folded, place, shownHere(root, unit, marks));
    if (shown.length > 0) writeJsonAtomic(marksFile(root, unit), { shown: [...marks.shown, ...shown] });
    return shown;
  });
  return answerOf(shower, place, calls);
}

/**
 * `read` holding the lock of the unit's mark, beside it in the cache: the
 * last lock a process takes, never held while it waits on another.
 * @template T
 * @param {string} root @param {string} unit @param {() => T} read
 * @returns {T}
 */
function withMarkLock(root, unit, read) {
  fs.mkdirSync(marksDir(root), { recursive: true });
  return withStateLockFile(`${marksFile(root, unit)}.lock`, read);
}

/** Remove a unit's mark, under its lock, as the unit goes. @param {string} root @param {string} unit */
function dropMarks(root, unit) {
  withMarkLock(root, unit, () => fs.rmSync(marksFile(root, unit), { force: true }));
}

module.exports = { answerSince, answerShown, dropMarks };
