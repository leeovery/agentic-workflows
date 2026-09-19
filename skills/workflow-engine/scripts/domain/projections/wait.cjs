'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the wait gate — the blocked-conclusion gate over an item's
// waits, every kind: the research a discussion stands on, the specification
// a plan stands on, the experiments a conversation spawned. The engine's
// completion refusal is the backstop; this is its graceful face — the
// blocker names what is owed, the guidance names the ways out, and the menu
// offers the pause the spawn gate's `yes` takes. The pause's banner lives
// here too: the bridge renders it in place of the completed banner when a
// phase leaves on a wait rather than concluding.
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, CONTINUE_INSTRUCTION } = require('./surfaces.cjs');
const { titlecase } = require('../conventions.cjs');
const { specUnsettledPhrase } = require('../derivations.cjs');

/** @typedef {import('../derivations.cjs').Wait} Wait */

const MENU_INSTRUCTION = "emit verbatim as markdown, then STOP for the user's response";

// How the gate speaks about the item it holds: what it calls it, and how the
// keep row names staying put. Only planning departs from the conversations —
// a plan is a plan, not "this planning", and it is kept rather than kept
// going, because nobody is talking.
/** @type {Record<string, {noun: string, keep: string}>} */
const HOLDER_COPY = {
  planning: { noun: 'plan', keep: 'Keep planning here' },
};

/** @param {string} phase */
function holderCopy(phase) {
  return HOLDER_COPY[phase] || { noun: phase, keep: 'Keep the conversation going' };
}

// Where the awaited research stands, in the gates' voice — the wait gate and
// the discussion entry gate read as one.
/** @param {string} status  an outstanding research status */
function researchWaitState(status) {
  return status === 'triaged' ? 'parked — not yet started' : 'in flight';
}

/** @param {Wait[]} waits @returns {string[]} the evidence ids, derivation order */
function experimentIds(waits) {
  return waits.flatMap((w) => (w.kind === 'experiment' ? [w.id] : []));
}

/**
 * What an item's waits owe, as one clause — the upstream first, then the
 * evidence: `research on {subject} (in flight) and experiment evidence (E1, E2)`.
 * @param {Wait[]} waits  non-empty — the derivation's order
 * @param {string} researchSubject  what the research is on — the quoted topic, or `the topic`
 * @returns {string}
 */
function owedWaits(waits, researchSubject) {
  const research = waits.find((w) => w.kind === 'research');
  const spec = waits.find((w) => w.kind === 'specification');
  const ids = experimentIds(waits);
  const owed = [];
  if (research) owed.push(`research on ${researchSubject} (${researchWaitState(research.status)})`);
  if (spec) owed.push(`its specification (${specUnsettledPhrase(spec)})`);
  if (ids.length > 0) owed.push(`experiment evidence (${ids.join(', ')})`);
  return owed.join(' and ');
}

/**
 * @param {string} phase  the holding phase — `research`, `discussion`, or `planning`
 * @param {string} topic
 * @param {Wait[]} waits  non-empty — the derivation's order
 * @param {boolean} epic  where the pause lands — the epic menu, or the linear unit's next step
 * @returns {string}
 */
function waitGate(phase, topic, waits, epic) {
  const { noun, keep } = holderCopy(phase);
  const research = waits.find((w) => w.kind === 'research');
  const spec = waits.find((w) => w.kind === 'specification');
  const ids = experimentIds(waits);
  const guidance = [];
  const queued = [];
  const lands = [];
  if (research) {
    queued.push('the research');
    lands.push('the research');
  }
  if (spec) {
    queued.push('the specification');
    lands.push('the specification');
  }
  if (ids.length > 0) {
    queued.push(ids.join(', '));
    lands.push('the evidence');
  }
  // Each kind names its own release; the conclusion clause is composed over
  // every wait present, never over one kind while another still holds.
  const alone = lands.length === 1;
  if (research) guidance.push(`Work the research first — concluding it releases its wait${alone ? `; this ${noun} can conclude once the research lands.` : '.'}`);
  if (spec) guidance.push(`Settle the specification first — concluding it releases its wait${alone ? `; this ${noun} can conclude once the specification lands.` : '.'}`);
  if (ids.length > 0) guidance.push('The wait releases when each experiment ends.');
  if (!alone) guidance.push(`This ${noun} can conclude once ${lands.join(' and ')} have landed.`);
  guidance.push(epic ? 'The epic menu carries the way in.' : 'The pause continues the work unit at what it waits on.');
  return [
    section(
      'DISPLAY: wait block',
      'emit verbatim as a properties code block — ```properties fence',
      `⚑ Conclusion blocked — this ${noun} awaits ${owedWaits(waits, `"${titlecase(topic)}"`)}`,
    ),
    section('DISPLAY: wait guidance', 'emit verbatim as markdown', `> ${guidance.join(' ')}`),
    section('MENU: wait gate', MENU_INSTRUCTION, menu('', [
      cmdOption('y', 'yes', epic
        ? `Pause this ${noun} here and return to the epic menu with ${queued.join(' and ')} queued`
        : `Pause this ${noun} here and continue the work unit at ${queued.join(' and ')}`),
      cmdOption('k', 'keep', `${keep} — conclusion stays blocked until ${lands.join(' and ')} ${lands.length > 1 ? 'land' : 'lands'}`),
    ], { question: epic ? 'Pause to the menu?' : 'Pause here?' })),
  ].join('\n');
}

/**
 * The bridge's banner for a phase leaving on a wait —
 * `phase-completed`'s sibling. One clause per paused item naming
 * what it awaits; a linear unit's one item is the unit itself, so
 * its clause drops the name. No holder left renders the bare line.
 * @param {string} phase  the paused phase — `research`, `discussion`, or `planning`
 * @param {string} workUnit
 * @param {{topic: string, waits: Wait[]}[]} holders  the phase's in-progress items holding waits
 * @returns {string}
 */
function phasePaused(phase, workUnit, holders) {
  const head = `${titlecase(phase)} paused for "${titlecase(workUnit)}"`;
  const clauses = holders.map(({ topic, waits }) => (topic === workUnit
    ? `awaiting ${owedWaits(waits, 'the topic')}`
    : `"${titlecase(topic)}" awaits ${owedWaits(waits, 'the topic')}`));
  const line = clauses.length > 0 ? `${head} — ${clauses.join('; ')}.` : `${head}.`;
  return section('DISPLAY: phase paused', CONTINUE_INSTRUCTION, line);
}

module.exports = { waitGate, phasePaused, researchWaitState };
