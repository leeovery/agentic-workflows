'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the spec's trace (11.4.1–11.4.4) — each statement and screen
// of a unit's spec held to the ledger, by the one rule the land's answer and
// ready to build's `statements-traced` both read. A line traces where every
// entry its bracket cites resolves — its short id read as a prefix, as git
// reads a short hash (ledger-ids.cjs) — to one of the unit's current
// decisions or findings (unit-entries.cjs), what a line comes from; or where
// it is the builder's: `[builder]` alone, or `[builder: id]`, whose one cite
// must be the person's "don't care" decision the line rests on (11.4.3). Any
// other line is invented (11.4.2), answered with why: it cites no entry; or,
// for each cite that fails, the prefix naming none, several, or too short to
// name one; naming no entry; the entry replaced, merged away, or on a topic
// or unit set aside; standing in another unit; a question, whose answer is
// what the line comes from; or, for a builder's cite, being no "don't care"
// decision. A scenario's source is its statements, so the trace passes it
// by. A prefix that resolves now can grow ambiguous as the ledger grows, and
// its line reads invented from then.
// ---------------------------------------------------------------------------

const { messageOf } = require('../kernel/call.cjs');
const { resolveId } = require('./ledger-ids.cjs');
const { factsOf, notCurrent, standingOf } = require('./ledger-fold.cjs');
const { withUnitEntries } = require('./unit-entries.cjs');

/** @typedef {import('./spec-sections.cjs').Line} Line */
/** @typedef {import('./unit-entries.cjs').UnitView} UnitView */
/** A line that does not trace, by its number, and why. @typedef {{number: string, why: string}} Invented */

/**
 * Why the entry `id` names is none of the unit's: no entry, not current, or
 * placed in another unit.
 * @param {UnitView} view @param {string} id @returns {string}
 */
function notTheUnits({ folded, short }, id) {
  if (factsOf(folded, id).kind === null) return 'names no entry';
  const not = notCurrent(folded, id);
  if (not === null) return `belongs to ${standingOf(folded, id).unit}`;
  if ('replaced_by' in not) return `was replaced by ${short(not.replaced_by)}`;
  if ('merged_by' in not) return `was merged away by ${short(not.merged_by)}`;
  return `is not current — ${not.dead}`;
}

/**
 * Why one cite fails, or null where it holds: resolved to one of the unit's
 * current decisions or findings, and for a builder's line to a "don't care"
 * decision.
 * @param {UnitView} view @param {string} cite @param {boolean} builder @returns {string|null}
 */
function citeFault(view, cite, builder) {
  let id;
  try {
    id = resolveId(cite, view.folded.facts.keys());
  } catch (err) {
    return messageOf(err);
  }
  if (!view.entries.has(id)) return `${cite} ${notTheUnits(view, id)}`;
  const { kind, given } = factsOf(view.folded, id);
  if (builder) return kind === 'decision' && given === 'dont-care' ? null : `${cite} is no "don't care" decision — a builder's line cites the one it rests on, or carries [builder] alone`;
  return kind === 'question' ? `${cite} is a question — cite its answer` : null;
}

/** Why a line does not trace, or null where it does. @param {UnitView} view @param {Line} line @returns {string|null} */
function untraced(view, { cites, builder }) {
  if (cites.length === 0) return builder ? null : 'cites no entry';
  const faults = cites.map((cite) => citeFault(view, cite, builder)).filter((fault) => fault !== null);
  return faults.length === 0 ? null : faults.join('; ');
}

/**
 * The statements and screens among a unit's spec's `lines` that do not
 * trace, each with why, in the spec's order; what a landing the read's
 * check finished said pushed to `warnings`.
 * @param {string} cwd @param {string} unit @param {Line[]} lines @param {string[]} [warnings]
 * @returns {Invented[]}
 */
function inventedLines(cwd, unit, lines, warnings = []) {
  return withUnitEntries(cwd, unit, warnings, (view) => lines.flatMap((line) => {
    const why = line.kind === 'statement' || line.kind === 'screen' ? untraced(view, line) : null;
    return why === null ? [] : [{ number: line.number, why }];
  }));
}

module.exports = { untraced, inventedLines };
