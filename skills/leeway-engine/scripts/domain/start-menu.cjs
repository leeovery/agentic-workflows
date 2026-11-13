'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what the start menu reads (18.2) — each unit in progress with
// how far it has come (progress.cjs) and what waits on the person in it
// (waits.cjs), counted by what it is: the authority gates, the questions and
// the decided topics an answer they relied on, replaced since, holds
// (18.2.3) — never the verdicts, which wait on the project's own row; and
// whether mail waits for its topic, shown beside the count and never in it
// (10.4.3), an epic's left to its own menu, which shows it by topic; the
// inbox's live items by kind; the product's conversation, and whether the
// brownfield research is owed (8.12.13); the verdicts waiting, the queue
// across every unit (16.10); and whether any unit has closed.
//
// The ledger is read once for the waits and the queue (ledger-read.cjs,
// `readShownOnce`), a raise this conversation sealed counting in it as it
// does wherever the waits are read in a conversation. A read with the waits
// left out reads neither the ledger nor the trust log, and counts nothing
// waiting: a sample drawn from a fixture, which has no state branch and no
// project of its own on this machine.
// ---------------------------------------------------------------------------

const { loadAllManifests, loadProjectManifest } = require('./reads.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { readShownOnce } = require('./ledger-read.cjs');
const { queueOf } = require('./ledger-verdicts.cjs');
const { evidenceOf } = require('./trust-evidence.cjs');
const { waitsOf } = require('./waits.cjs');
const { progressOf, progressWords } = require('./progress.cjs');
const { productConversation } = require('./discovery-session.cjs');
const { researchOwed } = require('./brownfield.cjs');
const { discoverInbox } = require('./start.cjs');
const { mailPhases } = require('./derivations.cjs');

/** @typedef {import('./waits.cjs').Wait} Wait */

/** What waits on the person in a unit, counted by what it is (the header's). @typedef {{gates: number, questions: number, topics: number}} Waiting */

/** A unit in progress as the start menu reads it. @typedef {{name: string, type: string, progress: string, waiting: Waiting, mail: boolean}} UnitRow */

/**
 * The start menu's read (the header's).
 * @typedef {object} StartMenuRead
 * @property {UnitRow[]} units  in the order the project lists them
 * @property {{ideas: number, bugs: number, quickfixes: number}} inbox  the live items by kind
 * @property {{sessions: number, last: string|null}} product
 * @property {boolean} researchOwed
 * @property {number} verdicts
 * @property {boolean} closed  whether any unit has completed or been cancelled
 * @property {string[]} warnings  what the ledger's read said
 */

/** The kinds of wait each count takes in (18.2.3). @type {Readonly<Record<keyof Waiting, readonly Wait['kind'][]>>} */
const COUNTED = Object.freeze({
  gates: Object.freeze(/** @type {const} */ (['map', 'decided', 'ready', 'finish'])),
  questions: Object.freeze(/** @type {const} */ (['gap', 'question', 'raise', 'raised'])),
  topics: Object.freeze(/** @type {const} */ (['affected'])),
});

/** What waits in a unit, counted (the header's). @param {Pick<Wait, 'kind'>[]} waits @returns {Waiting} */
const counts = (waits) => ({
  gates: waits.filter(({ kind }) => COUNTED.gates.includes(kind)).length,
  questions: waits.filter(({ kind }) => COUNTED.questions.includes(kind)).length,
  topics: waits.filter(({ kind }) => COUNTED.topics.includes(kind)).length,
});

/**
 * What waits in each unit given, and how many verdicts wait, the ledger read
 * once (the header's); what the reads said pushed to `warnings`.
 * @param {string} cwd @param {Record<string, any>[]} active @param {string[]} warnings
 * @returns {{waits: Map<string, Wait[]>, queue: number}}
 */
function waitingIn(cwd, active, warnings) {
  const root = stateRoot(cwd);
  return readShownOnce(root, warnings, (shower) => {
    const read = waitsOf(cwd, active, { session: handedSession(), shower });
    warnings.push(...read.warnings);
    return { waits: read.waits, queue: queueOf(shower.folded, evidenceOf(root)).length };
  });
}

/**
 * The start menu's read of the project (the header's), what waits read
 * where `waits` asks for it.
 * @param {string} cwd @param {{waits?: boolean}} [opts]
 * @returns {StartMenuRead}
 */
function startMenuRead(cwd, { waits: reading = true } = {}) {
  const all = loadAllManifests(cwd);
  const active = all.filter((manifest) => manifest.status === 'in-progress');
  /** @type {string[]} */
  const warnings = [];
  const { waits, queue } = reading ? waitingIn(cwd, active, warnings) : { waits: new Map(), queue: 0 };
  const inbox = discoverInbox(cwd);
  return {
    units: active.map((manifest) => ({
      name: manifest.name,
      type: manifest.work_type,
      progress: progressWords(progressOf(cwd, manifest)),
      waiting: counts(waits.get(manifest.name) ?? []),
      mail: manifest.work_type !== 'epic' && mailPhases(stateRoot(cwd), manifest).length > 0,
    })),
    inbox: { ideas: inbox.idea_count, bugs: inbox.bug_count, quickfixes: inbox.quickfix_count },
    product: productConversation(cwd),
    researchOwed: researchOwed(loadProjectManifest(cwd)),
    verdicts: queue,
    closed: all.some(({ status }) => status === 'completed' || status === 'cancelled'),
    warnings,
  };
}

module.exports = { counts, startMenuRead };
