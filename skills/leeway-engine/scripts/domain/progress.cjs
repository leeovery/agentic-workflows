'use strict';

// ---------------------------------------------------------------------------
// Domain ring: how far a unit has come, as a menu's row says it (18.2.2) —
// the start menu's row for each unit, and an epic menu's build row.
//
// - Its phase is where the board has it come to (board-standing.cjs).
// - A phase with a measure says how far: an epic's discovery its topics on
//   the map; an epic's discussion its topics decided of all ("discussion, 1
//   of 4 topics decided"); a build the phase it is at, the first of its cut
//   not closed, of every phase the cut holds on the manifest, written or
//   not, since the tracker holds only the phases whose tasks are written
//   (7.4.2, 28.2.1): "build, phase 2 of 3".
// - Any other phase is said by its name alone ("investigation", "review"),
//   and a unit of a type the reshape retires as waiting on the migration's
//   cut.
// ---------------------------------------------------------------------------

const { nowOf } = require('./projections/board-standing.cjs');
const { epicWords } = require('./projections/board-unit.cjs');
const { mapCount } = require('./projections/board-discovery.cjs');
const { counted } = require('./projections/map.cjs');
const { cutPhases, cutLength, phaseClosed } = require('./derivations.cjs');

/** How far a unit has come: its phase, and how far into it where the phase has a measure. @typedef {{phase: string, far: string|null}} Progress */

/** The phase a build is at: the first of its cut not closed. @param {Record<string, any>} manifest */
const buildAt = (manifest) => cutPhases(manifest).findIndex((_, at) => !phaseClosed(manifest, at + 1)) + 1;

/** How far into each phase that has a measure (the header's). @type {Readonly<Record<string, (cwd: string, manifest: Record<string, any>) => string|null>>} */
const MEASURES = Object.freeze({
  discovery: (cwd, manifest) => (manifest.work_type === 'epic' ? `${counted(mapCount(cwd, manifest), 'topic')} on the map` : null),
  discussion: (_cwd, manifest) => (manifest.work_type === 'epic' ? epicWords(manifest) : null),
  build: (_cwd, manifest) => `phase ${buildAt(manifest)} of ${cutLength(manifest)}`,
});

/** A phase said in other words than its name. @type {Readonly<Record<string, string>>} */
const NAMED = Object.freeze({ cut: 'waiting on the migration\'s cut' });

/**
 * How far the unit has come (the header's).
 * @param {string} cwd @param {Record<string, any>} manifest
 * @returns {Progress}
 */
function progressOf(cwd, manifest) {
  /** @type {Map<string, unknown>} */
  const reads = new Map();
  /** @type {<T>(key: string, read: () => T) => T} */
  const once = (key, read) => {
    if (!reads.has(key)) reads.set(key, read());
    return /** @type {any} */ (reads.get(key));
  };
  const { phase } = nowOf({ cwd, unit: manifest.name, manifest, once });
  return { phase, far: Object.hasOwn(MEASURES, phase) ? MEASURES[phase](cwd, manifest) : null };
}

/** A unit's progress as its row says it: "build, phase 2 of 3". @param {Progress} progress */
function progressWords({ phase, far }) {
  const named = Object.hasOwn(NAMED, phase) ? NAMED[phase] : phase;
  return far === null ? named : `${named}, ${far}`;
}

module.exports = { progressOf, progressWords };
