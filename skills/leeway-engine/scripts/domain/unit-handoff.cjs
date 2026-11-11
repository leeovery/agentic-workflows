'use strict';

// ---------------------------------------------------------------------------
// Domain ring: Continue — `handoff unit <work-unit>`, the move into a unit
// where it stands, the start menu's row for it (19.1.3, E6), with no menu
// between: an epic onto its menu; a feature, bugfix or quick-fix into the
// phase it has come to, as the board has it come there
// (board-standing.cjs), whose entry lists what waits on the person first —
// but a unit whose topic has an experiment out, spawned from its discussion
// and not yet concluded or abandoned, into the laboratory (24.1.2, P8).
//
// It refuses a unit the project lacks, one not in progress — a closed unit
// is seen through the start menu's view and brought back through manage —
// and a feature, bugfix or quick-fix waiting on the migration's cut (P12),
// in its line. The move itself is the handoff table's (handoff.cjs), checked
// and composed as any other.
//
// Where the unit stands also says where a decided topic's entry relying on
// an answer replaced since is answered (18.4.2, 12.15.4): in the topic
// itself while the unit is in the phase its topics are talked through, else
// in the phase it has come to, the unit never going back to its discussion
// — the door the waits read gives it (waits.cjs) and the one the topic's
// standing admits it by (topic-standing.cjs).
// ---------------------------------------------------------------------------

const { resolveHandoff, phaseSkill } = require('./handoff.cjs');
const { knownUnit, noUnit } = require('./topic-standing.cjs');
const { nowOf, unitRead } = require('./projections/board-standing.cjs');
const { awaitsCut, buildRefusal, mailPhase, openRecords } = require('./derivations.cjs');

/** @typedef {import('./handoff.cjs').Handoff} Handoff */

const UNIT_HANDOFF_USAGE = 'handoff unit <work-unit>';

/** The phase each place the board has a unit come to is entered as, where it is not its own name. @type {Readonly<Record<string, string>>} */
const ENTERED_AS = Object.freeze({ build: 'implementation' });

/**
 * The phase the unit has come to, as it is entered: where the board has it
 * come to, its build entered as implementation.
 * @param {string} cwd @param {Record<string, any>} manifest @returns {string}
 */
function phaseNow(cwd, manifest) {
  const { phase } = nowOf(unitRead(cwd, manifest));
  return ENTERED_AS[phase] ?? phase;
}

/**
 * Where a decided topic's entry relying on a replaced answer is answered
 * (the header's): null in the topic itself, else the phase the unit has
 * come to.
 * @param {string} cwd @param {Record<string, any>} manifest @returns {string|null}
 */
function affectedAnsweredIn(cwd, manifest) {
  const now = phaseNow(cwd, manifest);
  return now === mailPhase(manifest.work_type) ? null : now;
}

/**
 * The unit's manifest, refused where the project has no such unit or it is
 * closed (the header's).
 * @param {string} cwd @param {string} unit @returns {Record<string, any>}
 */
function openUnit(cwd, unit) {
  const manifest = knownUnit(cwd, unit);
  if (manifest === null) throw new Error(noUnit(unit));
  if (manifest.status !== 'in-progress') {
    throw new Error(`${unit} is ${manifest.status} — closed work is seen through the start menu's view, and brought back through manage`);
  }
  return manifest;
}

/**
 * `handoff unit <work-unit>`: the move into the unit where it stands (the
 * header's).
 * @param {string} cwd @param {string[]} args @returns {Handoff}
 */
function unitHandoff(cwd, args) {
  if (args.length !== 1) throw new Error(`Usage: engine ${UNIT_HANDOFF_USAGE}`);
  const [unit] = args;
  const manifest = openUnit(cwd, unit);
  const type = manifest.work_type;
  if (type === 'epic') return resolveHandoff(cwd, 'leeway-continue-epic', [unit]);
  if (awaitsCut(manifest)) throw new Error(/** @type {string} */ (buildRefusal(manifest)));
  if (openRecords(manifest, unit).length > 0) return resolveHandoff(cwd, phaseSkill('experiment', type), [type, unit, unit]);
  return resolveHandoff(cwd, phaseSkill(phaseNow(cwd, manifest), type), [type, unit]);
}

module.exports = { unitHandoff, affectedAnsweredIn, UNIT_HANDOFF_USAGE };
