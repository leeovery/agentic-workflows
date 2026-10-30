'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the project's environment setup, `environment` on the project
// manifest (22.5.12), each part a field the engine reads — the brief draws
// the linters (brief-records.cjs), and the commit door runs the tests and
// the linters before every code commit (commit-task.cjs):
//
//   environment.run.tests  the command that runs the project's tests
//   environment.linters    each linter, `{name, command}`
//
// A part the setup does not hold is none: no tests to run, no linter. One
// of another shape refuses, naming the field.
// ---------------------------------------------------------------------------

const { readProjectManifest } = require('../kernel/manifest.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');

/** @typedef {{name: string, command: string}} Linter */

/** Whether a value is text with something in it. @param {unknown} value @returns {value is string} */
const filled = (value) => typeof value === 'string' && value.trim() !== '';

/**
 * A part of the environment setup by its path under `environment`, or
 * undefined where the setup does not hold it.
 * @param {string} cwd @param {string[]} keys @returns {unknown}
 */
function partOf(cwd, keys) {
  /** @type {unknown} */
  let value = readProjectManifest(cwd).environment;
  for (const key of keys) {
    if (value === undefined) return undefined;
    value = isObject(value) ? value[key] : null;
  }
  return value;
}

/** The project's linters, in the setup's order; none where it records none. @param {string} cwd @returns {Linter[]} */
function linters(cwd) {
  const recorded = partOf(cwd, ['linters']);
  if (recorded === undefined) return [];
  if (!Array.isArray(recorded) || !recorded.every((linter) => isObject(linter) && filled(linter.name) && filled(linter.command))) {
    throw new Error('the project manifest\'s environment.linters is not a list of {name, command}');
  }
  return recorded.map(({ name, command }) => ({ name, command }));
}

/** The command that runs the project's tests, or null where the setup records none. @param {string} cwd @returns {string|null} */
function tests(cwd) {
  const recorded = partOf(cwd, ['run', 'tests']);
  if (recorded === undefined) return null;
  if (!filled(recorded)) throw new Error('the project manifest\'s environment.run.tests is not a command');
  return recorded;
}

module.exports = { linters, tests };
