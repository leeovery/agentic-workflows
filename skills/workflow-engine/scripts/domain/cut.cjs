'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the phase cut (11.5) — `cut <unit> --file <cut.json>`, the one
// writer of the cut on a unit's manifest (11.5.8), from where everything that
// shows or follows the cut reads it (11.5.10). The file holds the cut as the
// manifest keeps it, `{phases: [{name, goal, scenarios, sections,
// relies_on}]}`: the phases in build order, numbered from 1 by it (11.5.2);
// each phase's scenarios by id, `N.Sk`, and the sections it draws on by
// address, `N` or `N.M`, as `spec.md` gives them (spec-sections.cjs); and
// what it relies on, an earlier phase by its number or another unit by its
// name (11.5.4, 12.6.2). A list may be empty: ready to build's checklist
// holds each phase to having its own (6.4.7).
//
// It refuses, naming each fault and writing nothing (11.5.9): a unit with no
// `spec.md`; a file of another shape; a scenario or a section the spec
// lacks; a scenario placed in two phases or in none; a phase relying on
// itself or one after it, its own unit, or another unit the project lacks.
// A second cut replaces the whole cut until a phase has started — its
// start's checklist closed (6.4.8, 6.4.12) — and once one has, it keeps
// every phase to the last started as it stands, changing only those after.
// It runs under the writer lock (engine.cjs), and commits the unit's
// manifest alone to the state branch, pushed.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { isObject } = require('../kernel/manifest-io.cjs');
const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock } = require('../kernel/manifest.cjs');
const { workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { manifestOf } = require('./ledger-units.cjs');
const { readSpec, specSections, specScenarios, SPEC_FILE } = require('./spec-sections.cjs');
const { commitStateTail, noteCommitOutcome } = require('./commit.cjs');
const { phaseStarted } = require('./checklist.cjs');

/** @typedef {{name: string, goal: string, scenarios: string[], sections: string[], relies_on: Array<number|string>}} Phase */

const CUT_USAGE = 'cut <work-unit> --file <cut.json>';

/** What each of a phase's fields holds, and how a fault in it is named. */
const FIELDS = Object.freeze({
  name: { holds: 'text', fits: (/** @type {unknown} */ value) => typeof value === 'string' && value.trim() !== '' },
  goal: { holds: 'text', fits: (/** @type {unknown} */ value) => typeof value === 'string' && value.trim() !== '' },
  scenarios: { holds: 'a list of scenario ids, each once', each: (/** @type {unknown} */ id) => typeof id === 'string' },
  sections: { holds: 'a list of section addresses, each once', each: (/** @type {unknown} */ address) => typeof address === 'string' },
  relies_on: {
    holds: 'a list of earlier phases by number and other units by name, each once',
    each: (/** @type {unknown} */ on) => (Number.isInteger(on) && /** @type {number} */ (on) >= 1) || (typeof on === 'string' && on !== ''),
  },
});

/** The fields of a phase, in the order the manifest keeps them. */
const PHASE_FIELDS = /** @type {Array<keyof Phase>} */ (Object.keys(FIELDS));

/** @param {string[]} faults @returns {never} */
function refuse(faults) {
  throw new Error(`cut: ${faults.join('; ')}`);
}

/** Whether a value fits a field: a whole list of fitting items, given once each, where it is a list. @param {keyof Phase} field @param {unknown} value */
function fits(field, value) {
  const kind = FIELDS[field];
  if ('fits' in kind) return kind.fits(value);
  return Array.isArray(value) && value.every(kind.each) && new Set(value).size === value.length;
}

/** The faults in one phase's shape. @param {unknown} phase @param {number} number */
function shapeFaults(phase, number) {
  if (!isObject(phase) || Object.keys(phase).length !== PHASE_FIELDS.length || !PHASE_FIELDS.every((field) => Object.hasOwn(phase, field))) {
    return [`phase ${number} is not {${PHASE_FIELDS.join(', ')}}`];
  }
  return PHASE_FIELDS.filter((field) => !fits(field, phase[field])).map((field) => `phase ${number}'s ${field} is not ${FIELDS[field].holds}`);
}

/**
 * The phases a cut's file holds, each its fields in the manifest's order.
 * Refuses a file it cannot read as a cut.
 * @param {string} file @returns {Phase[]}
 */
function phasesIn(file) {
  /** @type {unknown} */
  let cut;
  try {
    cut = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    refuse([`${file} holds no cut: ${err instanceof Error ? err.message : String(err)}`]);
  }
  if (!isObject(cut) || Object.keys(cut).join() !== 'phases' || !Array.isArray(cut.phases) || cut.phases.length === 0) {
    refuse([`${file} holds no cut — a cut is {"phases": [{${PHASE_FIELDS.join(', ')}}, …]}`]);
  }
  const faults = cut.phases.flatMap((phase, at) => shapeFaults(phase, at + 1));
  if (faults.length > 0) refuse(faults);
  return cut.phases.map((phase) => /** @type {Phase} */ (Object.fromEntries(PHASE_FIELDS.map((field) => [field, phase[field]]))));
}

/** A list in words: `1`, `1 and 2`, `1, 2 and 3`. @param {Array<string|number>} items */
const inWords = (items) => (items.length === 1 ? String(items[0]) : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

/** @typedef {{scenarios: string[], sections: Map<string, unknown>}} Spec */

/**
 * The unit's spec's scenarios and sections, a refusal of it the cut's.
 * @param {string} cwd @param {string} unit @returns {Spec}
 */
function specOf(cwd, unit) {
  try {
    const text = readSpec(cwd, unit);
    return { scenarios: specScenarios(text), sections: specSections(text) };
  } catch (err) {
    return refuse([messageOf(err)]);
  }
}

/**
 * The faults of the cut against the spec: each scenario or section a phase
 * names that the spec lacks, and each scenario of the spec placed in two
 * phases or in none, in the spec's order.
 * @param {Phase[]} phases @param {Spec} spec
 */
function specFaults(phases, { scenarios, sections }) {
  const lacking = phases.flatMap(({ scenarios: placed, sections: drawn }, at) => [
    ...placed.filter((id) => !scenarios.includes(id)).map((id) => `phase ${at + 1} places scenario ${id}, which ${SPEC_FILE} lacks`),
    ...drawn.filter((address) => !sections.has(address)).map((address) => `phase ${at + 1} draws on section "${address}", which ${SPEC_FILE} lacks`),
  ]);
  const placing = scenarios.flatMap((id) => {
    const numbers = phases.flatMap(({ scenarios: placed }, at) => (placed.includes(id) ? [at + 1] : []));
    if (numbers.length === 0) return [`scenario ${id} is in no phase`];
    return numbers.length > 1 ? [`scenario ${id} is in phases ${inWords(numbers)}`] : [];
  });
  return [...lacking, ...placing];
}

/**
 * The faults in what each phase relies on: an earlier phase by its number,
 * another unit the project holds by its name.
 * @param {Phase[]} phases @param {string} root @param {string} unit
 */
function reliesFaults(phases, root, unit) {
  return phases.flatMap(({ relies_on: on }, at) => on.flatMap((relied) => {
    const number = at + 1;
    if (relied === number) return [`phase ${number} relies on itself`];
    if (typeof relied === 'number') return relied > number ? [`phase ${number} relies on phase ${relied}, which comes after it`] : [];
    if (relied === unit) return [`phase ${number} relies on ${unit}, its own unit — an earlier phase is named by its number`];
    const known = workUnitNameRefusal(relied) === null && manifestOf(root, relied) !== null;
    return known ? [] : [`phase ${number} relies on "${relied}", a work unit the project lacks`];
  }));
}

/**
 * The last phase of the cut on the manifest to have started, 0 where none
 * has.
 * @param {Record<string, any>} manifest
 */
function lastStarted(manifest) {
  /** @type {Phase[]} */
  const phases = manifest.cut?.phases ?? [];
  return phases.reduce((last, _, at) => (phaseStarted(manifest, at + 1) ? at + 1 : last), 0);
}

/**
 * The fault of a cut changing or dropping a phase that has started, or one
 * before it.
 * @param {Record<string, any>} manifest @param {Phase[]} phases
 * @returns {string[]}
 */
function startedFaults(manifest, phases) {
  const started = lastStarted(manifest);
  /** @type {Phase[]} */
  const kept = manifest.cut?.phases ?? [];
  const changed = kept.slice(0, started).findIndex((phase, at) => JSON.stringify(phase) !== JSON.stringify(phases[at]));
  if (changed === -1) return [];
  const how = phases[changed] === undefined ? 'drops' : 'changes';
  return [`phase ${started} has started, and the cut ${how} phase ${changed + 1} — a cut keeps every phase to ${started} as it stands and changes only those after`];
}

/**
 * Write the phase cut in `file` onto the unit's manifest, after every check,
 * and commit it.
 * @param {string} cwd @param {string} unit @param {string} file absolute or from cwd
 * @returns {{unit: string, phases: number, committed: string|null, warnings?: string[], note?: string}}
 */
function writeCut(cwd, unit, file) {
  const root = stateRoot(cwd);
  if (workUnitNameRefusal(unit) !== null || manifestOf(root, unit) === null) throw new Error(`cut: there is no work unit "${unit}"`);
  const phases = withWorkUnitLock(cwd, unit, () => {
    const spec = specOf(cwd, unit);
    const cut = phasesIn(path.resolve(cwd, file));
    const manifest = loadWorkUnitManifest(cwd, unit);
    const faults = [...specFaults(cut, spec), ...reliesFaults(cut, root, unit), ...startedFaults(manifest, cut)];
    if (faults.length > 0) refuse(faults);
    manifest.cut = { phases: cut };
    saveWorkUnitManifest(cwd, unit, manifest);
    return cut.length;
  });
  /** @type {string[]} */
  const warnings = [];
  const outcome = commitStateTail(cwd, `${unit}/manifest.json`, `cut(${unit}): ${phases === 1 ? '1 phase' : `${phases} phases`}`, warnings);
  /** @type {{unit: string, phases: number, committed: string|null, warnings?: string[], note?: string}} */
  const result = { unit, phases, committed: outcome.committed };
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome, `${unit} --state`);
  return result;
}

module.exports = { CUT_USAGE, writeCut };
