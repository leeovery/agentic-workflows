'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the task's id, the one shape the task verbs and the land verbs
// share. The internal id is `{unit}-{phase}-{n}`, lasting: it goes into
// commit subjects, branch names and onto screens. Screens show it
// `{phase}.{n}`, the form the verbs take beside the unit. The unit is held to
// the rule that mints units (`workUnitNameRefusal`): a kebab-case slug, so
// the id is safe wherever it goes. A unit's name may hold hyphens and digits,
// so the id is read from its end — the one reading of an id's step, the
// plan's older ids among them, whose topic the rule does not hold. The
// tracker's own ids never leave its driver: a task, phase or unit is named
// in a sentence the one way, every driver's refusals among them, so no
// driver writes the words itself.
// ---------------------------------------------------------------------------

const { workUnitNameRefusal } = require('../kernel/manifest-schema.cjs');

/** @typedef {{unit: string, phase: number, n: number}} TaskRef */

const STEP = /-([1-9][0-9]*)-([1-9][0-9]*)$/;
const SHOWN = /^([1-9][0-9]*)\.([1-9][0-9]*)$/;
const PHASE = /^[1-9][0-9]*$/;

/** Refuses a name no work unit can take. @param {unknown} unit */
function assertUnit(unit) {
  const refusal = workUnitNameRefusal(unit);
  if (refusal !== null) throw new Error(`task-id: ${refusal}`);
}

/** Refuses a phase or task number that is not a whole number from 1. @param {string} what @param {unknown} value */
function assertNumber(what, value) {
  if (!Number.isInteger(value) || /** @type {number} */ (value) < 1) throw new Error(`task-id: the ${what} is a whole number from 1 — got ${String(value)}`);
}

/** The internal id, `{unit}-{phase}-{n}`. @param {TaskRef} ref @returns {string} */
function taskId({ unit, phase, n }) {
  assertUnit(unit);
  assertNumber('phase', phase);
  assertNumber('task', n);
  return `${unit}-${phase}-${n}`;
}

/**
 * The phase and task an id ends in, whatever names them before; null where
 * it ends otherwise.
 * @param {string} id @returns {{prefix: string, phase: number, n: number}|null}
 */
function stepOfId(id) {
  const named = STEP.exec(id);
  return named === null ? null : { prefix: id.slice(0, named.index), phase: Number(named[1]), n: Number(named[2]) };
}

/** The task an internal id names. Refuses another shape. @param {string} id @returns {TaskRef} */
function parseTaskId(id) {
  const step = stepOfId(id);
  if (step === null || workUnitNameRefusal(step.prefix) !== null) {
    throw new Error(`task-id: "${id}" is not a task's id — it is {unit}-{phase}-{n}`);
  }
  return { unit: step.prefix, phase: step.phase, n: step.n };
}

/** The phase a verb names, a whole number from 1. Refuses another shape. @param {string} given @returns {number} */
function parsePhase(given) {
  if (!PHASE.test(given)) throw new Error(`task-id: "${given}" is not a phase — it is a whole number from 1`);
  return Number(given);
}

/** The id as screens show it, `{phase}.{n}`. @param {{phase: number, n: number}} ref @returns {string} */
function shownTask({ phase, n }) {
  assertNumber('phase', phase);
  assertNumber('task', n);
  return `${phase}.${n}`;
}

/** The unit's task a shown id names. Refuses another shape. @param {string} unit @param {string} shown @returns {TaskRef} */
function parseShownTask(unit, shown) {
  assertUnit(unit);
  const named = SHOWN.exec(shown);
  if (named === null) throw new Error(`task-id: "${shown}" is not a task — it is {phase}.{n}`);
  return { unit, phase: Number(named[1]), n: Number(named[2]) };
}

/** A task as a sentence names it, `task {phase}.{n} of {unit}`. @param {TaskRef} ref */
function taskName(ref) {
  return `task ${shownTask(ref)} of ${ref.unit}`;
}

/** A phase as a sentence names it, `phase {N} of {unit}`. @param {string} unit @param {number} phase */
function phaseName(unit, phase) {
  return `phase ${phase} of ${unit}`;
}

/** A unit's own entry in the tracker as a sentence names it. @param {string} unit */
function unitName(unit) {
  return `unit ${unit}`;
}

/** What a driver calls a task in the tracker that carries none of the engine's names. */
const FOREIGN_TASK = 'a task the workflows did not make';

/**
 * A driver's refusal to make anything under a unit or phase the person
 * ended in the tracker, naming each the person must reopen, outermost first,
 * and saying how to go on.
 * @param {string[]} whats as `phaseName` or `unitName` gives each @param {string} unit
 */
function endedInTracker(whats, unit) {
  const [was, reopen] = whats.length === 1 ? ['was', 'reopen it there'] : ['were', 'reopen them there, in that order,'];
  return `${whats.join(' and ')} ${was} ended in the tracker — ${reopen} to go on, or cancel ${unit} in the workflows`;
}

module.exports = {
  assertUnit, taskId, stepOfId, parseTaskId, parsePhase, shownTask, parseShownTask, taskName, phaseName, unitName, FOREIGN_TASK, endedInTracker,
};
