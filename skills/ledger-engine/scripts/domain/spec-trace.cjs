'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the spec's trace (11.4.1–11.4.4) — each statement and screen
// of a unit's spec held to the ledger, by the one rule the land's answer and
// ready to build's `statements-traced` both read. A line traces where every
// entry its bracket cites resolves — its short id read as a prefix, as git
// reads a short hash (ledger-ids.cjs) — to one of the unit's current
// decisions or findings (unit-entries.cjs), what a line comes from; or where
// it is the builder's, `[builder: cite]`, its one cite what made it the
// builder's (11.4.4): the person's "don't care" decision the line rests on,
// or a call the sweep left to the builder, by the id the sweep taken records
// it under (sweep.cjs, 8.10.5) — a unit that took no sweep, a feature or a
// bugfix among them, has none. Any other line is invented (11.4.2), answered
// with why: it cites no entry, a bare `[builder]` among them; or, for each
// cite that fails, the prefix naming none, several, or too short to name
// one; naming no entry; the entry replaced, merged away, or on a topic or
// unit set aside; standing in another unit; a question, whose answer is what
// the line comes from; or, for a builder's cite, being no "don't care"
// decision, or naming no call the sweep left to the builder. A scenario's
// source is its statements, so the trace passes it by. A prefix that
// resolves now can grow ambiguous as the ledger grows, and its line reads
// invented from then.
// ---------------------------------------------------------------------------

const { messageOf } = require('../kernel/call.cjs');
const { resolveId } = require('./ledger-ids.cjs');
const { factsOf, notCurrent, standingOf } = require('./ledger-fold.cjs');
const { withUnitEntries } = require('./unit-entries.cjs');
const { builderCalls, isCallId } = require('./sweep.cjs');

/** @typedef {import('./spec-sections.cjs').Line} Line */
/** @typedef {import('./unit-entries.cjs').UnitView} UnitView */
/** The unit's entries, and the ids of the calls its sweep left to the builder. @typedef {UnitView & {calls: Set<string>}} TraceView */
/** A line that does not trace, by its number, and why. @typedef {{number: string, why: string}} Invented */

const DONT_CARE = 'a builder\'s line cites the "don\'t care" decision it rests on';

/** What a builder's line cites, where the sweep left calls to the builder or none. @param {TraceView} view */
const buildersCite = ({ calls }) => (calls.size === 0 ? DONT_CARE : `${DONT_CARE}, or the sweep's call that left it to the builder`);

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
 * Why a builder's cite of a call fails, or null where the sweep taken
 * records it.
 * @param {TraceView} view @param {string} cite @returns {string|null}
 */
function callFault(view, cite) {
  if (view.calls.has(cite)) return null;
  return view.calls.size === 0
    ? `${cite} names no call the sweep left to the builder — none is recorded, so ${DONT_CARE}`
    : `${cite} names no call the sweep left to the builder`;
}

/**
 * Why one cite fails, or null where it holds: resolved to one of the unit's
 * current decisions or findings, and for a builder's line to a "don't care"
 * decision or a call the sweep left to the builder.
 * @param {TraceView} view @param {string} cite @param {boolean} builder @returns {string|null}
 */
function citeFault(view, cite, builder) {
  if (builder && isCallId(cite)) return callFault(view, cite);
  let id;
  try {
    id = resolveId(cite, view.folded.facts.keys());
  } catch (err) {
    return messageOf(err);
  }
  if (!view.entries.has(id)) return `${cite} ${notTheUnits(view, id)}`;
  const { kind, given } = factsOf(view.folded, id);
  if (builder) return kind === 'decision' && given === 'dont-care' ? null : `${cite} is no "don't care" decision — ${buildersCite(view)}`;
  return kind === 'question' ? `${cite} is a question — cite its answer` : null;
}

/** Why a line does not trace, or null where it does. @param {TraceView} view @param {Line} line @returns {string|null} */
function untraced(view, { cites, builder }) {
  if (cites.length === 0) return builder ? `cites no entry — ${buildersCite(view)}` : 'cites no entry';
  const faults = cites.map((cite) => citeFault(view, cite, builder)).filter((fault) => fault !== null);
  return faults.length === 0 ? null : faults.join('; ');
}

/**
 * `answer`, given the unit's entries and the calls its sweep left to the
 * builder; what a landing the read's check finished said pushed to
 * `warnings`.
 * @template T
 * @param {string} cwd @param {string} unit @param {string[]} warnings @param {(view: TraceView) => T} answer
 * @returns {T}
 */
function withTraceView(cwd, unit, warnings, answer) {
  const calls = new Set(builderCalls(cwd, unit).map(({ id }) => id));
  return withUnitEntries(cwd, unit, warnings, (view) => answer({ ...view, calls }));
}

/**
 * The statements and screens among a unit's spec's `lines` that do not
 * trace, each with why, in the spec's order; what a landing the read's
 * check finished said pushed to `warnings`.
 * @param {string} cwd @param {string} unit @param {Line[]} lines @param {string[]} [warnings]
 * @returns {Invented[]}
 */
function inventedLines(cwd, unit, lines, warnings = []) {
  return withTraceView(cwd, unit, warnings, (view) => lines.flatMap((line) => {
    const why = line.kind === 'statement' || line.kind === 'screen' ? untraced(view, line) : null;
    return why === null ? [] : [{ number: line.number, why }];
  }));
}

module.exports = { withTraceView, untraced, inventedLines };
