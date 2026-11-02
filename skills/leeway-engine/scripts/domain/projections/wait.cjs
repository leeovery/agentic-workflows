'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the epic menu's banner for a phase leaving on a pause —
// rendered in place of the completed banner when a phase leaves on a wait
// rather than concluding — and what a held item owes, said once
// (`owedWaits`).
// ---------------------------------------------------------------------------

const { section, CONTINUE_INSTRUCTION } = require('./surfaces.cjs');
const { titlecase } = require('../conventions.cjs');

/** @typedef {import('../derivations.cjs').Wait} Wait */

/**
 * What an item's waits owe, as one clause — `experiment evidence (E1, E2)`;
 * empty where it awaits nothing.
 * @param {Wait[]} waits  the derivation's order
 * @returns {string}
 */
function owedWaits(waits) {
  return waits.length === 0 ? '' : `experiment evidence (${waits.map((w) => w.id).join(', ')})`;
}

/**
 * The epic menu's banner for a phase leaving on a pause —
 * `phase-completed`'s sibling. One clause per paused item naming
 * what it awaits; a linear unit's one item is the unit itself, so
 * its clause drops the name. No holder left renders the bare line.
 * @param {string} phase  the paused phase
 * @param {string} workUnit
 * @param {{topic: string, title: string, owed: string}[]} holders  the phase's in-progress items still awaiting something, each as screens title it, with what it awaits
 * @returns {string}
 */
function phasePaused(phase, workUnit, holders) {
  const head = `${titlecase(phase)} paused for "${titlecase(workUnit)}"`;
  const clauses = holders.map(({ topic, title, owed }) => (topic === workUnit
    ? `awaiting ${owed}`
    : `"${title}" awaits ${owed}`));
  const line = clauses.length > 0 ? `${head} — ${clauses.join('; ')}.` : `${head}.`;
  return section('DISPLAY: phase paused', CONTINUE_INSTRUCTION, line);
}

module.exports = { phasePaused, owedWaits };
