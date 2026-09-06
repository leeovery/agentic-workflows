'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the wait gate — the blocked-conclusion gate over a
// conversation's waits, every kind: the research a discussion stands on,
// the experiments a conversation spawned. The engine's completion refusal
// is the backstop; this is its graceful face — the blocker names what is
// owed, the guidance names the ways out, and the menu offers the pause the
// spawn gate's `now` takes.
// ---------------------------------------------------------------------------

const { section, menu, cmdOption } = require('./surfaces.cjs');
const { titlecase } = require('../conventions.cjs');

/** @typedef {import('../derivations.cjs').Wait} Wait */

const MENU_INSTRUCTION = "emit verbatim as markdown, then STOP for the user's response";

/**
 * @param {string} phase  the holding phase — `research` or `discussion`
 * @param {string} topic
 * @param {Wait[]} waits  non-empty — the derivation's order
 * @returns {string}
 */
function waitGate(phase, topic, waits) {
  const research = waits.find((w) => w.kind === 'research');
  const ids = waits.flatMap((w) => (w.kind === 'experiment' ? [w.id] : []));
  const owed = [];
  const guidance = [];
  const queued = [];
  const lands = [];
  if (research) {
    owed.push(`research on "${titlecase(topic)}" (${research.status === 'triaged' ? 'parked — not yet started' : 'in flight'})`);
    queued.push('the research');
    lands.push('the research');
  }
  if (ids.length > 0) {
    owed.push(`experiment evidence (${ids.join(', ')})`);
    queued.push(ids.join(', '));
    lands.push('the evidence');
  }
  // Each kind names its own release; the conclusion clause is composed over
  // every wait present, never over one kind while another still holds.
  if (research) guidance.push(`Work the research first — cancelling it releases its wait${ids.length > 0 ? '.' : `; this ${phase} can conclude once the research lands.`}`);
  if (ids.length > 0) guidance.push('The wait releases when each experiment ends.');
  if (research && ids.length > 0) guidance.push(`This ${phase} can conclude once the research and the evidence have landed.`);
  guidance.push('The menu carries the way in.');
  return [
    section(
      'DISPLAY: wait block',
      'emit verbatim as a properties code block — ```properties fence',
      `⚑ Conclusion blocked — this ${phase} awaits ${owed.join(' and ')}`,
    ),
    section('DISPLAY: wait guidance', 'emit verbatim as markdown', `> ${guidance.join(' ')}`),
    section('MENU: wait gate', MENU_INSTRUCTION, menu('', [
      cmdOption('p', 'pause', `Pause this ${phase} here — the session ends and the menu takes over with ${queued.join(' and ')} queued`),
      cmdOption('k', 'keep', `Keep the conversation going — conclusion stays blocked until ${lands.join(' and ')} ${lands.length > 1 ? 'land' : 'lands'}`),
    ], { question: 'Pause to the menu?' })),
  ].join('\n');
}

module.exports = { waitGate };
