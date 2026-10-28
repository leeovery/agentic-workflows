'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the task's id, the one shape the task verbs and the land verbs
// share. The internal id is `{unit}-{phase}-{n}`, lasting: it goes into
// commit messages and onto screens. Screens show it `{phase}.{n}`, the form
// the verbs take beside the unit. A unit's name may hold hyphens, so the id
// is read from its end. The tracker's own ids never leave its driver.
// ---------------------------------------------------------------------------

const { illegalNameReason } = require('../kernel/manifest-schema.cjs');

/** @typedef {{unit: string, phase: number, n: number}} TaskRef */

const INTERNAL_ID = /^(.+)-([1-9][0-9]*)-([1-9][0-9]*)$/;
const SHOWN = /^([1-9][0-9]*)\.([1-9][0-9]*)$/;

/** Refuses a unit name no work unit can take. @param {unknown} unit */
function assertUnit(unit) {
  const illegal = illegalNameReason('work unit', unit);
  if (illegal !== null) throw new Error(`task-id: ${illegal}`);
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

/** The task an internal id names. Refuses another shape. @param {string} id @returns {TaskRef} */
function parseTaskId(id) {
  const named = INTERNAL_ID.exec(id);
  if (named === null || illegalNameReason('work unit', named[1]) !== null) {
    throw new Error(`task-id: "${id}" is not a task's id — it is {unit}-{phase}-{n}`);
  }
  return { unit: named[1], phase: Number(named[2]), n: Number(named[3]) };
}

/** The id as screens show it, `{phase}.{n}`. @param {TaskRef} ref @returns {string} */
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

module.exports = { taskId, parseTaskId, shownTask, parseShownTask };
