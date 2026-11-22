'use strict';

// ---------------------------------------------------------------------------
// Domain ring: how far a unit has come, as a menu's row says it (18.2.2) —
// the start menu's row for each unit, and an epic menu's build row.
//
// - Its phase is where the unit has come to (unit-phases.cjs).
// - A phase with a measure says how far: an epic's discovery its topics on
//   the map; an epic's discussion its topics decided of all ("discussion, 1
//   of 4 topics decided"), each in the words All work says it in
//   (board-all.cjs); a build the phase it is at, the first of its cut not
//   closed, of every phase the cut holds on the manifest, written or not,
//   since the tracker holds only the phases whose tasks are written (7.4.2,
//   28.2.1): "build, phase 2 of 3", and a phase whose start has not closed,
//   its tasks not written, says so: "build, phase 3 of 5, not yet written"
//   — a phase whose parent the migration adopted has its tasks written.
// - Any other phase is said by its name alone ("investigation", "review").
// ---------------------------------------------------------------------------

const { nowOf, unitRead } = require('./unit-phases.cjs');
const { liveInOrder } = require('./approve-map.cjs');
const { mapCount } = require('./projections/board-discovery.cjs');
const { counted } = require('./projections/map.cjs');
const {
  cutPhases, cutLength, phaseClosed, phaseStarted, phaseAdopted, computeTopicLifecycle,
} = require('./derivations.cjs');

/** How far a unit has come: its phase, and how far into it where the phase has a measure. @typedef {{phase: string, far: string|null}} Progress */

/** How far an epic in its discussion has come: its topics decided of all. @param {Record<string, any>} manifest */
function epicWords(manifest) {
  const live = liveInOrder(manifest);
  return `${live.filter((topic) => computeTopicLifecycle(manifest, topic).lifecycle === 'decided').length} of ${counted(live.length, 'topic')} decided`;
}

/** How far into its discovery and its discussion an epic has come (the header's). @type {Readonly<Record<string, (cwd: string, manifest: Record<string, any>) => string>>} */
const EPIC_MEASURES = Object.freeze({
  discovery: (cwd, manifest) => `${counted(mapCount(cwd, manifest), 'topic')} on the map`,
  discussion: (_cwd, manifest) => epicWords(manifest),
});

/** How far into `phase` an epic has come, where the phase has a measure (the header's); null for any other unit or phase. @param {string} cwd @param {Record<string, any>} manifest @param {string} phase */
function epicMeasure(cwd, manifest, phase) {
  return manifest.work_type === 'epic' && Object.hasOwn(EPIC_MEASURES, phase) ? EPIC_MEASURES[phase](cwd, manifest) : null;
}

/** How far into its build the unit has come: the first phase of its cut not closed, of all, and whether it is written yet (the header's). @param {Record<string, any>} manifest */
function buildMeasure(manifest) {
  const at = cutPhases(manifest).findIndex((_, index) => !phaseClosed(manifest, index + 1)) + 1;
  const written = phaseStarted(manifest, at) || phaseAdopted(manifest, at);
  return `phase ${at} of ${cutLength(manifest)}${written ? '' : ', not yet written'}`;
}

/**
 * How far the unit has come (the header's).
 * @param {string} cwd @param {Record<string, any>} manifest
 * @returns {Progress}
 */
function progressOf(cwd, manifest) {
  const { phase } = nowOf(unitRead(cwd, manifest));
  return { phase, far: phase === 'build' ? buildMeasure(manifest) : epicMeasure(cwd, manifest, phase) };
}

/** A unit's progress as its row says it: "build, phase 2 of 3". @param {Progress} progress */
function progressWords({ phase, far }) {
  return far === null ? phase : `${phase}, ${far}`;
}

module.exports = { epicMeasure, buildMeasure, progressOf, progressWords };
