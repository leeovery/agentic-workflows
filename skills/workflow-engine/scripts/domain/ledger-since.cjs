'use strict';

// ---------------------------------------------------------------------------
// Domain ring: "what have you decided without me?" and the map's "since you
// last looked" — one query (5.8.7) — and the last-looked mark it counts from
// (5.8.14, 5.8.15): `ledger since`, and `ledger shown`, the read a screen
// draws from as it shows in the conversation.
//
// - Claude's calls: the current decisions Claude made, `by` claude, the
//   build's included (5.1.6), standing in a unit or on one of its topics.
// - The mark is the machine's own, in the unit's cache,
//   `.cache/{unit}/last-looked.json`: for each topic, and for the spec — the
//   unit's level, where everything from the spec on stands (4.11.2) — the id
//   of the newest call its screen has shown. A call is new while it comes
//   later in the ledger than the mark of the screen showing it, its topic's
//   or the spec's; with no mark, or one naming no entry of the ledger, every
//   call is.
// - Only `ledger shown` moves the mark: opening the board is not looking. It
//   answers as `ledger since` does, and moves the mark of each screen it
//   covers — the topic named, or every topic of the unit and the spec — to
//   the newest call it showed there. Under a lock of the mark's own, its
//   fold of the ledger too, so a peer's look never moves a mark back and no
//   topic's mark is lost to another's. The cache is off the state branch:
//   looking never commits, and each machine counts from its own look (4.1.7).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { messageOf } = require('../kernel/call.cjs');
const { isObject, writeJsonAtomic, withStateLockFile } = require('../kernel/manifest-io.cjs');
const { standingOf, isCurrent } = require('./ledger-fold.cjs');

/** @typedef {import('./ledger-fold.cjs').Folded} Folded */
/** @typedef {import('./ledger-read.cjs').Shower} Shower */
/** @typedef {import('./ledger-read.cjs').Place} Place */

/**
 * The last-looked mark: the id of the newest call each topic's screen has
 * shown, and the spec's.
 * @typedef {{topics: Record<string, string>, spec: string|null}} Marks
 */

/** A new call, and the topic of the screen showing it — null for the spec's. @typedef {{id: string, topic: string|null}} Call */

const MARKS = 'last-looked.json';

/** The unit's folder in the cache. @param {string} root @param {string} unit */
function unitCache(root, unit) {
  return path.join(root, '.cache', unit);
}

/**
 * The unit's mark on this machine; no mark where none is kept.
 * @param {string} root @param {string} unit
 * @returns {Marks}
 */
function marksOf(root, unit) {
  const file = path.join(unitCache(root, unit), MARKS);
  if (!fs.existsSync(file)) return { topics: {}, spec: null };
  let marks;
  try {
    marks = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`the last-looked mark at ${file} is no JSON — ${messageOf(err)}`);
  }
  if (!isObject(marks) || !isObject(marks.topics)) throw new Error(`the last-looked mark at ${file} holds no topics`);
  return /** @type {Marks} */ (marks);
}

/**
 * The line of the call a screen's mark names; none for no mark, or one
 * naming no entry of the ledger.
 * @param {Folded} folded @param {Marks} marks @param {string|null} topic the screen's, null for the spec's
 */
function markedLine(folded, marks, topic) {
  const mark = topic === null ? marks.spec : Object.hasOwn(marks.topics, topic) ? marks.topics[topic] : null;
  return (mark === null ? undefined : folded.facts.get(mark))?.place.number ?? 0;
}

/**
 * Claude's current calls standing in `unit` and, given one, on `topic`, each
 * later in the ledger than the mark of the screen showing it, in the
 * ledger's order. None on a unit or topic that is not live.
 * @param {Folded} folded @param {Marks} marks @param {string} unit @param {string|null} topic
 * @returns {Call[]}
 */
function callsSince(folded, marks, unit, topic) {
  if (folded.live(unit, topic) !== null) return [];
  /** @type {Call[]} */
  const calls = [];
  for (const [id, facts] of folded.facts) {
    if (facts.kind !== 'decision' || facts.by !== 'claude' || !isCurrent(folded, id)) continue;
    const standing = standingOf(folded, id);
    if (standing.unit !== unit || (topic !== null && standing.topic !== topic)) continue;
    if (facts.place.number > markedLine(folded, marks, standing.topic)) calls.push({ id, topic: standing.topic });
  }
  return calls;
}

/**
 * The mark moved, for each screen showing a new call, to the newest of
 * them; the calls come in the ledger's order.
 * @param {Marks} marks @param {Call[]} calls
 * @returns {Marks}
 */
function movedOn(marks, calls) {
  const moved = { topics: { ...marks.topics }, spec: marks.spec };
  for (const { id, topic } of calls) {
    if (topic === null) moved.spec = id;
    else moved.topics[topic] = id;
  }
  return moved;
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
 * `ledger since`: Claude's calls in a unit or on a topic since the person
 * last looked on this machine. Moves no mark.
 * @param {Shower} shower @param {Place} place @param {string} root
 */
function answerSince(shower, place, root) {
  const unit = /** @type {string} */ (place.unit);
  return answerOf(shower, place, callsSince(shower.folded, marksOf(root, unit), unit, place.topic));
}

/**
 * `ledger shown`: what `ledger since` answers, the mark of each screen it
 * covers moved to the newest call it showed there. Runs under the mark's
 * lock (`withMarkLock`).
 * @param {Shower} shower @param {Place} place @param {string} root
 */
function answerShown(shower, place, root) {
  const unit = /** @type {string} */ (place.unit);
  const marks = marksOf(root, unit);
  const calls = callsSince(shower.folded, marks, unit, place.topic);
  if (calls.length > 0) writeJsonAtomic(path.join(unitCache(root, unit), MARKS), movedOn(marks, calls));
  return answerOf(shower, place, calls);
}

/**
 * `read` holding the lock of the unit's mark, beside it in the cache.
 * @template T
 * @param {string} root @param {Place} place @param {() => T} read
 * @returns {T}
 */
function withMarkLock(root, { unit }, read) {
  const dir = unitCache(root, /** @type {string} */ (unit));
  fs.mkdirSync(dir, { recursive: true });
  return withStateLockFile(path.join(dir, `${MARKS}.lock`), read);
}

module.exports = { MARKS, marksOf, callsSince, answerSince, answerShown, withMarkLock };
