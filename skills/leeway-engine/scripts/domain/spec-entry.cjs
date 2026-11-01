'use strict';

// ---------------------------------------------------------------------------
// Domain ring: specification's row of the entry (enter.cjs) — `enter
// specification <unit>`, at the work unit, whose one spec it is (11.3.1).
// Whether the unit can enter it is spec-standing.cjs's: once its topics are
// settled, and never for a quick-fix or a cross-cutting concern. The entry
// asks nothing first, starts nothing and keeps no log, so it writes nothing
// but where the conversation is working.
//
// What it reads: each live topic's record, by its engine call, and its log;
// the files the unit's current entries link as canonical, which the spec
// links (11.6.3); once the spec is written, the spec and, where the manifest
// holds one, the cut — which the recovery note names too (position.cjs);
// and the reports of the agents the spec was left with, landed since, with
// those lost with a process that no longer runs (9.7.8).
//
// The spec's standing and its refusal are answered here too, for every verb
// that holds the spec to them; the refusal holds the unit first to the rule
// every entry does (topic-standing.cjs) — one this project has, in progress.
// ---------------------------------------------------------------------------

const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { specStanding, entryRefusal, specSources } = require('./spec-standing.cjs');
const { knownUnit, noUnit, unitClosure } = require('./topic-standing.cjs');
const { canonicalAssets } = require('./ledger-read.cjs');
const { agentsLeft } = require('./agent-state.cjs');

/** @typedef {import('./enter.cjs').Entry} Entry */
/** @typedef {import('./enter.cjs').Entering} Entering */
/** @typedef {import('./enter.cjs').Line} Line */

const PHASE = 'specification';

/** @param {string} key @returns {(value: string) => Line} */
const as = (key) => (value) => [key, value];

/** What the spec reads at its entry. @param {Entering} at @returns {Line[]} */
function specReads({ cwd, unit, manifest, notes }) {
  const { records, logs, spec, cut } = specSources(cwd, manifest);
  const agents = agentsLeft(cwd, unit, PHASE, unit);
  return [
    ...records.map((call) => as('record')(`\`${call}\``)),
    ...logs.map(as('topic log')),
    ...canonicalAssets(stateRoot(cwd), unit, notes).map((asset) => as('asset')(statePath(cwd, asset))),
    ...spec.map(as('spec')),
    ...cut.map((call) => as('cut')(`\`${call}\``)),
    ...agents.landed.map(({ file }) => as('landed')(file)),
    ...agents.lost.map(as('lost')),
  ];
}

/** @type {Entry} */
const SPECIFICATION = Object.freeze({
  level: /** @type {const} */ ('unit'),
  standing: ({ manifest }) => entryRefusal(manifest),
  unstarted: () => false,
  start: () => {},
  questions: () => [],
  reads: specReads,
});

/**
 * Why the unit cannot enter its spec, with its way on, or null where it
 * may: a unit this project lacks or one not in progress, then the spec's
 * own refusal.
 * @param {string} cwd @param {string} unit @returns {string|null}
 */
function specEntryRefusal(cwd, unit) {
  const manifest = knownUnit(cwd, unit);
  if (manifest === null) return noUnit(unit);
  return unitClosure(manifest) ?? entryRefusal(manifest);
}

module.exports = { SPECIFICATION, specStanding, specEntryRefusal };
