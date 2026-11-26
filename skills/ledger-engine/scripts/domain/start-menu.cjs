'use strict';

// ---------------------------------------------------------------------------
// Domain ring: what the start menu reads (18.2) — each unit in progress with
// how far it has come (progress.cjs) and what waits on the person in it
// (waits.cjs), counted by what it is: the authority gates, the
// questions and the decided topics an answer they relied on, replaced
// since, holds (18.2.3); and whether mail waits for its topic, shown beside the count and never in it
// (10.4.3), an epic's left to its own menu, which shows it by topic; the
// inbox's live items by kind; the product's conversation, its sessions holding
// talk (discovery-entry.cjs), and whether the
// brownfield research is owed (8.12.13); and whether any unit has closed.
//
// The ledger is read once for the waits (ledger-read.cjs, `readShownOnce`),
// a raise this conversation sealed counting in it as it does wherever the
// waits are read in a conversation. A read with the waits left out reads
// no ledger, and counts nothing waiting: a sample drawn from a fixture, which has no state branch and no
// project of its own on this machine.
// ---------------------------------------------------------------------------

const { loadAllManifests, loadProjectManifest } = require('./reads.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { handedSession } = require('../kernel/process.cjs');
const { readShownOnce } = require('./ledger-read.cjs');
const { waitsOf } = require('./waits.cjs');
const { progressOf, progressWords } = require('./progress.cjs');
const { productConversation } = require('./discovery-entry.cjs');
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
 * What waits in each unit given, the ledger read once (the header's); what
 * the reads said pushed to `warnings`.
 * @param {string} cwd @param {Record<string, any>[]} active @param {string[]} warnings
 * @returns {Map<string, Wait[]>}
 */
function waitingIn(cwd, active, warnings) {
  return readShownOnce(stateRoot(cwd), warnings, (shower) => {
    const read = waitsOf(cwd, active, { session: handedSession(), shower });
    warnings.push(...read.warnings);
    return read.waits;
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
  const waits = reading ? waitingIn(cwd, active, warnings) : new Map();
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
    closed: all.some(({ status }) => status === 'completed' || status === 'cancelled'),
    warnings,
  };
}

module.exports = { counts, startMenuRead };
