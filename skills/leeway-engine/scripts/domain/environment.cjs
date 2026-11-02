'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the project's environment setup, `environment` on the project
// manifest (22.5.12), each part a field the engine reads — the brief draws
// the linters (brief-records.cjs), and the commit door runs the tests and
// the linters before every code commit (commit-task.cjs):
//
//   environment.run.tests  the command that runs the project's tests
//   environment.linters    each linter, `{name, command}`
//   environment.verify     the verify setup (15.2.11), recorded by `verify
//                          setup` once it has run end to end (verify.cjs):
//                          its `place` in the product's code and the feature
//                          map's beside it, `feature_map`, each from the code
//                          root; its five parts, `launch`, `health`, `drive`,
//                          `evidence` and `cleanup`, each a command; the
//                          mutation tool it names, `mutation`, a command,
//                          where it names one (15.6.3); and the run end to
//                          end it was recorded after, `ran`, `{unit,
//                          scenario, verdict, commits, at}` — the scenario
//                          of the cut it ran, the verdict its drive wrote,
//                          and each repository's HEAD it ran against
//
// A part the setup does not hold is none: no tests to run, no linter, no
// verify setup. One of another shape refuses, naming the field.
// ---------------------------------------------------------------------------

const path = require('path');
const { readProjectManifest } = require('../kernel/manifest.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');

/** @typedef {{name: string, command: string}} Linter */
/** @typedef {{unit: string, scenario: string, verdict: import('./runs.cjs').Verdict, commits: import('./runs.cjs').RepoCommit[], at: string}} SetupRun */
/**
 * @typedef {{place: string, feature_map: string, launch: string, health: string, drive: string, evidence: string, cleanup: string, mutation?: string}} SetupParts
 * @typedef {SetupParts & {ran: SetupRun}} VerifySetup
 */

/** The verify setup's five parts, in the order a run calls them (15.2.5). */
const VERIFY_PARTS = Object.freeze(/** @type {const} */ (['launch', 'health', 'drive', 'evidence', 'cleanup']));

/** The verify setup's places in the product's code, each from the code root. */
const SETUP_PLACES = Object.freeze(/** @type {const} */ (['place', 'feature_map']));

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

/** Whether a path is one inside the code, read from its root: relative, and never climbing out. @param {unknown} value */
function withinCode(value) {
  if (!filled(value) || path.isAbsolute(value)) return false;
  const normal = path.posix.normalize(value.split(path.sep).join('/'));
  return normal !== '..' && !normal.startsWith('../');
}

/**
 * What is amiss in a verify setup's parts, each fault in words: a field it
 * does not take, a place that is not a path inside the code, a part or the
 * mutation tool that is not a command; `ran` is taken where `recorded`.
 * @param {unknown} setup @param {boolean} recorded
 * @returns {string[]}
 */
function setupFaults(setup, recorded) {
  if (!isObject(setup)) return ['it is not an object'];
  const fields = [...SETUP_PLACES, ...VERIFY_PARTS, 'mutation', ...(recorded ? ['ran'] : [])];
  return [
    ...Object.keys(setup).filter((key) => !fields.includes(key)).map((key) => `"${key}" is no field of the verify setup`),
    ...SETUP_PLACES.filter((key) => !withinCode(setup[key])).map((key) => `${key} is not a path inside the code, from its root`),
    ...VERIFY_PARTS.filter((key) => !filled(setup[key])).map((key) => `${key} is not a command`),
    ...('mutation' in setup && !filled(setup.mutation) ? ['mutation is not a command'] : []),
    ...(recorded && !isRun(setup.ran) ? ['ran is not the run it was recorded after, {unit, scenario, verdict, commits, at}'] : []),
  ];
}

/** Whether a value reads as the run a setup was recorded after. @param {unknown} ran */
function isRun(ran) {
  return isObject(ran) && filled(ran.unit) && filled(ran.scenario) && filled(ran.verdict) && filled(ran.at)
    && Array.isArray(ran.commits) && ran.commits.every((at) => isObject(at) && filled(at.repo) && (at.commit === null || filled(at.commit)));
}

/** The project's verify setup, or null where none is recorded. @param {string} cwd @returns {VerifySetup|null} */
function verifySetup(cwd) {
  const recorded = partOf(cwd, ['verify']);
  if (recorded === undefined) return null;
  const faults = setupFaults(recorded, true);
  if (faults.length > 0) throw new Error(`the project manifest's environment.verify does not hold a verify setup — ${faults.join('; ')}`);
  return /** @type {VerifySetup} */ (recorded);
}

module.exports = { VERIFY_PARTS, SETUP_PLACES, linters, tests, setupFaults, verifySetup };
