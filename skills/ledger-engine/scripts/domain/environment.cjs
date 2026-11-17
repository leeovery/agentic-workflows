'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the project's environment setup, `environment` on the project
// manifest (22.5.1, 22.5.12), each part a field the engine reads — the brief
// draws the linters (brief-records.cjs); the commit door runs the tests and
// the linters before every code commit (commit-task.cjs); the build's first
// entry and each task's worktree run the steps that prepare the environment
// (build-entry.cjs, worktree-prep.cjs), and the build's entry carries what
// cannot run at once; its verbs and its screen are environment-verbs.cjs's;
// and two clones merge it part by part (state-merge-rules.cjs):
//
//   environment.run          how to run the product: `build`, `tests` and
//                            `run`, each a command, any of them left out
//   environment.prepare      the steps that prepare the environment, in the
//                            order they run, each `{name, when, command}` —
//                            `when` is `first`, before the build's first
//                            task; `worktree`, in each worktree a task runs
//                            in; or `both` — or `{name, when, note}`, a step
//                            no command does, shown on the setup's screen
//                            and never run; each name once
//   environment.concurrency  what cannot run at once in the project, each
//                            `{what, at, by}`: what it is, when it was
//                            recorded, and the unit whose build learned it,
//                            null where none did; each `what` once
//   environment.verify       the verify setup (15.2.11), recorded by `verify
//                            setup` once it has run end to end (verify.cjs):
//                            its `place` in the product's code and the feature
//                            map's beside it, `feature_map`, each from the code
//                            root; its five parts, `launch`, `health`, `drive`,
//                            `evidence` and `cleanup`, each a command; the
//                            mutation tool it names, `mutation`, a command,
//                            where it names one (15.6.3); and the run end to
//                            end it was recorded after, `ran`, `{unit,
//                            scenario, verdict, commits, at}` — the scenario
//                            of the cut it ran, the verdict its drive wrote,
//                            and each repository's HEAD it ran against
//   environment.linters      each linter, `{name, command}`, each name once,
//                            and `fix`, the command that mends what it
//                            finds, where it has one
//   environment.confirmed    when the person's yes recorded the setup at the
//                            project's first ready to build, the one time it
//                            is asked (22.5.3)
//
// A part the setup does not hold is none: nothing to run the product with,
// no step, nothing that cannot run at once, no verify setup, no linter, and
// the setup not yet asked. One of another shape refuses, naming each fault.
// What the engine runs from it — the tests, the linters and the steps — is
// none until the person's yes confirms the setup, so what Claude found and
// recorded for the screen runs nowhere before it; until then a quick-fix
// runs the tests and linters it finds (22.5.7, 22.5.10, brief-records.cjs).
// ---------------------------------------------------------------------------

const path = require('path');
const { readProjectManifest } = require('../kernel/manifest.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { ENVIRONMENT_PARTS, ENVIRONMENT_SETS, RUN_COMMANDS, PREPARE_WHEN } = require('../kernel/manifest-schema.cjs');

/** @typedef {{name: string, command: string, fix?: string}} Linter */
/** @typedef {Partial<Record<(typeof RUN_COMMANDS)[number], string>>} Run */
/** @typedef {(typeof PREPARE_WHEN)[number]} When */
/** @typedef {{name: string, when: When, command: string} | {name: string, when: When, note: string}} Step */
/** @typedef {{name: string, command: string}} Command a step the engine runs: its name and its command */
/** @typedef {{what: string, at: string, by: string|null}} Concurrency */
/** @typedef {{unit: string, scenario: string, verdict: import('./runs.cjs').Verdict, commits: import('./runs.cjs').RepoCommit[], at: string}} SetupRun */
/**
 * @typedef {{place: string, feature_map: string, launch: string, health: string, drive: string, evidence: string, cleanup: string, mutation?: string}} SetupParts
 * @typedef {SetupParts & {ran: SetupRun}} VerifySetup
 */
/** @typedef {{run: Run, prepare: Step[], concurrency: Concurrency[], verify: VerifySetup|null, linters: Linter[], confirmed: string|null}} Setup */

/** The verify setup's five parts, in the order a run calls them (15.2.5). */
const VERIFY_PARTS = Object.freeze(/** @type {const} */ (['launch', 'health', 'drive', 'evidence', 'cleanup']));

/** The verify setup's places in the product's code, each from the code root. */
const SETUP_PLACES = Object.freeze(/** @type {const} */ (['place', 'feature_map']));

/** Whether a value is text with something in it. @param {unknown} value @returns {value is string} */
const filled = (value) => typeof value === 'string' && value.trim() !== '';

/** Whether a value reads as an instant. @param {unknown} value */
const instant = (value) => filled(value) && !Number.isNaN(Date.parse(value));

/** Words as a sentence lists them: `a, b and c`. @param {readonly string[]} words */
const series = (words) => (words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`);

/** Each key of `entry` that is none of `keys`, as a fault naming what it is no field of. @param {Record<string, unknown>} entry @param {readonly string[]} keys @param {string} of */
const strayKeys = (entry, keys, of) => Object.keys(entry).filter((key) => !keys.includes(key)).map((key) => `"${key}" is no field of ${of}`);

/** What is amiss in how to run the product. @param {unknown} run @returns {string[]} */
function runFaults(run) {
  if (!isObject(run)) return ['it is not an object'];
  return [
    ...Object.keys(run).filter((key) => !(/** @type {readonly string[]} */ (RUN_COMMANDS)).includes(key)).map((key) => `"${key}" is no command of run — its commands are ${series(RUN_COMMANDS)}`),
    ...RUN_COMMANDS.filter((key) => key in run && !filled(run[key])).map((key) => `${key} is not a command`),
  ];
}

/** What is amiss in a step that prepares the environment. @param {unknown} step @returns {string[]} */
function stepFaults(step) {
  if (!isObject(step)) return ['it is not an object'];
  const does = ['command', 'note'].filter((key) => key in step);
  return [
    ...strayKeys(step, ['name', 'when', 'command', 'note'], 'a step'),
    ...(filled(step.name) ? [] : ['its name is not text']),
    ...((/** @type {readonly unknown[]} */ (PREPARE_WHEN)).includes(step.when) ? [] : [`its when is none of ${series(PREPARE_WHEN.map((when) => `"${when}"`))}`]),
    ...(does.length === 1 ? [] : ['it holds a command or a note, one of them']),
    ...does.filter((key) => !filled(step[key])).map((key) => `its ${key} is not text`),
  ];
}

/** What is amiss in a record of what cannot run at once. @param {unknown} record @returns {string[]} */
function concurrencyFaults(record) {
  if (!isObject(record)) return ['it is not an object'];
  return [
    ...strayKeys(record, ['what', 'at', 'by'], 'a record of what cannot run at once'),
    ...(filled(record.what) ? [] : ['its what is not text']),
    ...(instant(record.at) ? [] : ['its at is not an instant']),
    ...(record.by === null || filled(record.by) ? [] : ['its by is not a unit\'s name, nor null']),
  ];
}

/** What is amiss in a linter. @param {unknown} linter @returns {string[]} */
function linterFaults(linter) {
  if (!isObject(linter)) return ['it is not an object'];
  return [
    ...strayKeys(linter, ['name', 'command', 'fix'], 'a linter'),
    ...['name', 'command'].filter((key) => !filled(linter[key])).map((key) => `its ${key} is not text`),
    ...(linter.fix === undefined || filled(linter.fix) ? [] : ['its fix is not text']),
  ];
}

/**
 * What is amiss in a list of a part's entries: each entry's faults by its
 * place, and each entry naming one another holds already by `key`.
 * @param {unknown} list @param {string} key @param {(entry: unknown) => string[]} faultsOf
 * @returns {string[]}
 */
function listFaults(list, key, faultsOf) {
  if (!Array.isArray(list)) return ['it is not a list'];
  const held = new Set();
  return list.flatMap((entry, at) => {
    const faults = faultsOf(entry);
    if (faults.length > 0) return faults.map((fault) => `entry ${at + 1}: ${fault}`);
    const named = /** @type {Record<string, unknown>} */ (entry)[key];
    if (held.has(named)) return [`entry ${at + 1}: its ${key} "${named}" is an earlier entry's`];
    held.add(named);
    return [];
  });
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

/**
 * Each part of the setup by name: what is amiss in it, and what it is where
 * the setup holds none.
 * @type {Readonly<Record<(typeof ENVIRONMENT_PARTS)[number], {faults: (value: unknown) => string[], none: unknown}>>}
 */
const PARTS = Object.freeze({
  run: { faults: runFaults, none: {} },
  prepare: { faults: (value) => listFaults(value, ENVIRONMENT_SETS.prepare, stepFaults), none: [] },
  concurrency: { faults: (value) => listFaults(value, ENVIRONMENT_SETS.concurrency, concurrencyFaults), none: [] },
  verify: { faults: (value) => setupFaults(value, true), none: null },
  linters: { faults: (value) => listFaults(value, ENVIRONMENT_SETS.linters, linterFaults), none: [] },
  confirmed: { faults: (value) => (instant(value) ? [] : ['it is not an instant']), none: null },
});

/**
 * What is amiss in an environment setup, each fault naming its part: a part
 * it does not take, and each part's own.
 * @param {unknown} environment
 * @returns {string[]}
 */
function environmentFaults(environment) {
  if (!isObject(environment)) return ['it is not an object'];
  return Object.entries(environment).flatMap(([part, value]) => (Object.hasOwn(PARTS, part)
    ? PARTS[/** @type {keyof typeof PARTS} */ (part)].faults(value).map((fault) => `${part}: ${fault}`)
    : [`"${part}" is no part of the environment setup — its parts are ${series(ENVIRONMENT_PARTS)}`]));
}

/** The setup the project manifest holds, undefined where it holds none; refused where it holds one that is no object. @param {string} cwd @returns {Record<string, unknown>|undefined} */
function recordedSetup(cwd) {
  const { environment } = readProjectManifest(cwd);
  if (environment !== undefined && !isObject(environment)) throw new Error('the project manifest\'s environment is not an object');
  return environment;
}

/**
 * A part of `environment`, read: what it is where the setup holds none, and
 * refused, naming each fault, where it does not read.
 * @param {Record<string, unknown>|undefined} environment @param {keyof typeof PARTS} part
 * @returns {any}
 */
function partIn(environment, part) {
  const value = environment?.[part];
  if (value === undefined) return PARTS[part].none;
  const faults = PARTS[part].faults(value);
  if (faults.length > 0) throw new Error(`the project manifest's environment.${part} does not read — ${faults.join('; ')}`);
  return value;
}

/** Whether the person's yes has yet to confirm the setup `environment` (the header's). @param {Record<string, unknown>|undefined} environment */
const unconfirmed = (environment) => partIn(environment, 'confirmed') === null;

/**
 * A part the engine runs commands from, read whether or not confirmed, and
 * none until the person's yes has confirmed the setup.
 * @param {string} cwd @param {'linters'|'prepare'} part @returns {any}
 */
function confirmedPart(cwd, part) {
  const environment = recordedSetup(cwd);
  const value = partIn(environment, part);
  return unconfirmed(environment) ? PARTS[part].none : value;
}

/** The project's linters, in the setup's order; none where it records none, or is not confirmed. @param {string} cwd @returns {Linter[]} */
const linters = (cwd) => confirmedPart(cwd, 'linters');

/** The command that runs the project's tests, or null where the setup records none, or is not confirmed. @param {string} cwd @returns {string|null} */
function tests(cwd) {
  const environment = recordedSetup(cwd);
  const run = environment?.run;
  const recorded = isObject(run) ? run.tests : run === undefined ? undefined : null;
  if (recorded === undefined) return null;
  if (!filled(recorded)) throw new Error('the project manifest\'s environment.run.tests is not a command');
  return unconfirmed(environment) ? null : recorded;
}

/** The project's verify setup, or null where none is recorded. @param {string} cwd @returns {VerifySetup|null} */
const verifySetup = (cwd) => partIn(recordedSetup(cwd), 'verify');

/** What cannot run at once in the project, in the order recorded. @param {string} cwd @returns {Concurrency[]} */
const concurrency = (cwd) => partIn(recordedSetup(cwd), 'concurrency');

/** When the person's yes recorded the setup, or null where it was never asked. @param {string} cwd @returns {string|null} */
const confirmedAt = (cwd) => partIn(recordedSetup(cwd), 'confirmed');

/**
 * The steps the engine runs `at` — `first`, before the build's first task,
 * or `worktree`, in each worktree a task runs in — those for both among
 * them, in the setup's order; a note is never one, and none runs before the
 * setup is confirmed.
 * @param {string} cwd @param {'first'|'worktree'} at @returns {Command[]}
 */
function stepsAt(cwd, at) {
  /** @type {Step[]} */
  const steps = confirmedPart(cwd, 'prepare');
  return steps.flatMap((step) => ((step.when === at || step.when === 'both') && 'command' in step ? [{ name: step.name, command: step.command }] : []));
}

/** The whole setup as recorded, each part read, none where the setup holds none of it. @param {string} cwd @returns {Setup} */
function setupOf(cwd) {
  const environment = recordedSetup(cwd);
  return /** @type {Setup} */ (Object.fromEntries(ENVIRONMENT_PARTS.map((part) => [part, partIn(environment, part)])));
}

module.exports = {
  VERIFY_PARTS, SETUP_PLACES, PARTS, linters, tests, verifySetup, concurrency, confirmedAt, stepsAt, setupOf, setupFaults, environmentFaults, filled,
};
