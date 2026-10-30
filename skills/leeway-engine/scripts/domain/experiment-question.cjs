'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the question on a topic's map an experiment measures (9.1.11),
// read from the ledger.
//
// - A spawn names it by a prefix of its id, resolved as the ledger resolves a
//   link (5.3.5): a current question standing open on the map of the topic
//   that spawns the experiment. The record keeps its full id, where the map
//   projection reads it (ledger-units.cjs, ledger-read.cjs).
// - At the experiment's conclusion, whether the question still stands open
//   on the spawning topic's map decides where the report goes: open, the
//   discussion reads the report and writes the result; otherwise the report
//   reaches as a message the topic the question stands on now — the one it
//   was moved to, or the spawning topic where it was closed there or moved
//   to the roadmap as later.
// - A question matches across its wordings, by the first entry of its
//   chain, as the map matches it.
// ---------------------------------------------------------------------------

const { messageOf } = require('../kernel/call.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { resolveId, shortId } = require('./ledger-ids.cjs');
const { ID_FACTS, readFolded, factsOf, isCurrent, mapOf, standingOf } = require('./ledger-fold.cjs');
const { liveness } = require('./ledger-units.cjs');

/** @typedef {import('./ledger-fold.cjs').Folded} Folded */
/** @typedef {import('./ledger-fold.cjs').MapRow} MapRow */

/**
 * `answer` given the ledger folded against liveness and the topic's map;
 * what a landing the read's check finished said pushed to `warnings`.
 * @template T
 * @param {string} cwd @param {string} unit @param {string} topic @param {string[]} warnings
 * @param {(folded: Folded, rows: MapRow[]) => T} answer
 * @returns {T}
 */
function withMap(cwd, unit, topic, warnings, answer) {
  const root = stateRoot(cwd);
  const live = liveness(root);
  return readFolded(root, ID_FACTS, warnings, (facts) => {
    const folded = { facts, live };
    return answer(folded, mapOf(folded, unit, topic));
  });
}

/** Whether a row standing open on the map is `id`'s question, in any of its wordings. @param {Folded} folded @param {MapRow[]} rows @param {string} id */
function standsOpen(folded, rows, id) {
  const { root } = factsOf(folded, id);
  return rows.some((row) => row.stands === 'open' && factsOf(folded, row.id).root === root);
}

/**
 * The question `prefix` names, by its full id and its short one: refused
 * unless it is a current question standing open on `topic`'s map.
 * @param {string} cwd @param {string} unit @param {string} topic @param {string} prefix @param {string[]} warnings
 * @returns {{id: string, short: string}}
 */
function measuredQuestion(cwd, unit, topic, prefix, warnings) {
  return withMap(cwd, unit, topic, warnings, (folded, rows) => {
    let id;
    try {
      id = resolveId(prefix, folded.facts.keys());
    } catch (err) {
      throw new Error(`--question: ${messageOf(err)}`);
    }
    const short = shortId(id, folded.facts.keys());
    if (factsOf(folded, id).kind !== 'question') throw new Error(`--question names ${short}, which is no question — an experiment measures a question on the map`);
    if (!isCurrent(folded, id) || !standsOpen(folded, rows, id)) {
      throw new Error(`--question names ${short}, which stands open on no row of "${topic}"'s map — an experiment measures an open question of the topic that spawns it`);
    }
    return { id, short };
  });
}

/**
 * The topic the report of an experiment `topic` spawned, measuring the
 * question `id`, reaches as a message: none while the question stands open
 * on `topic`'s map; else the live topic of the unit it stands on now, or
 * `topic` itself.
 * @param {string} cwd @param {string} unit @param {string} topic @param {string} id @param {string[]} warnings
 * @returns {string|null}
 */
function reportRoute(cwd, unit, topic, id, warnings) {
  return withMap(cwd, unit, topic, warnings, (folded, rows) => {
    if (!folded.facts.has(id)) return topic;
    if (standsOpen(folded, rows, id)) return null;
    const now = standingOf(folded, id);
    return now.topic !== null && folded.live(unit, now.topic) === null ? now.topic : topic;
  });
}

module.exports = { measuredQuestion, reportRoute };
