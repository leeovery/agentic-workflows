'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the wait gate — the blocked-conclusion gate over a plan held
// by its specification. The engine's completion refusal is the backstop;
// this is its graceful face — the blocker names what is owed, the guidance
// the way out, and the menu offers the pause. What a held item owes is said
// once (`owedWaits`), for the pause's banner too. The pause's banner lives
// here too: the epic menu renders it in place of the completed banner when a
// phase leaves on a wait rather than concluding.
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, CONTINUE_INSTRUCTION, emitAs, MENU_INSTRUCTION } = require('./surfaces.cjs');
const { titlecase } = require('../conventions.cjs');
const { specUnsettledPhrase } = require('../derivations.cjs');

/** @typedef {import('../derivations.cjs').Wait} Wait */

// Where the awaited research stands, in the gates' voice — the wait gate and
// the discussion entry gate read as one.
/** @param {string} status  an outstanding research status */
function researchWaitState(status) {
  return status === 'unstarted' ? 'parked — not yet started' : 'in flight';
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
 * What a paused specification awaits, as one clause — the sources it routed
 * a gap into, by name: `the note-window discussion`, `the a and b
 * discussions`. Empty where it awaits none.
 * @param {string[]} names  the derivation's order
 * @param {string} sourcePhase  the phase the sources sit in
 * @returns {string}
 */
function owedSources(names, sourcePhase) {
  if (names.length === 0) return '';
  if (names.length === 1) return `the ${names[0]} ${sourcePhase}`;
  return `the ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} ${sourcePhase}s`;
}

/**
 * The wait gate over a plan held by its specification, the one wait it
 * serves: a discussion's waits are its map's, and its close the decided
 * screen.
 * @param {string} topic
 * @param {Wait[]} waits  the plan's specification wait
 * @param {boolean} epic  where the pause lands — the epic menu, or the linear unit's next step
 * @returns {string}
 */
function waitGate(topic, waits, epic) {
  const guidance = [
    'Settle the specification first — concluding it releases its wait; this plan can conclude once the specification lands.',
    epic ? 'The epic menu carries the way in.' : 'The pause continues the work unit at what it waits on.',
  ];
  return [
    section('DISPLAY: wait block', emitAs('properties'), `⚑ Conclusion blocked — this plan awaits ${owedWaits(waits, `"${titlecase(topic)}"`)}`),
    section('DISPLAY: wait guidance', emitAs('markdown'), `> ${guidance.join(' ')}`),
    section('MENU: wait gate', MENU_INSTRUCTION, menu('', [
      cmdOption('y', 'yes', epic
        ? 'Pause this plan here and return to the epic menu with the specification queued'
        : 'Pause this plan here and continue the work unit at the specification'),
      cmdOption('k', 'keep', 'Keep planning here — conclusion stays blocked until the specification lands'),
    ], { question: epic ? 'Pause to the menu?' : 'Pause here?' })),
  ].join('\n');
}

/**
 * The epic menu's banner for a phase leaving on a pause —
 * `phase-completed`'s sibling. One clause per paused item naming
 * what it awaits; a linear unit's one item is the unit itself, so
 * its clause drops the name. No holder left renders the bare line.
 * @param {string} phase  the paused phase
 * @param {string} workUnit
 * @param {{topic: string, owed: string}[]} holders  the phase's in-progress items still awaiting something, each with what it awaits
 * @returns {string}
 */
function phasePaused(phase, workUnit, holders) {
  const head = `${titlecase(phase)} paused for "${titlecase(workUnit)}"`;
  const clauses = holders.map(({ topic, owed }) => (topic === workUnit
    ? `awaiting ${owed}`
    : `"${titlecase(topic)}" awaits ${owed}`));
  const line = clauses.length > 0 ? `${head} — ${clauses.join('; ')}.` : `${head}.`;
  return section('DISPLAY: phase paused', CONTINUE_INSTRUCTION, line);
}

module.exports = { waitGate, phasePaused, owedWaits, owedSources, researchWaitState };
