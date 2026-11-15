'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the environment setup's verbs (22.5) and its screen —
// `environment show|set|confirm|concurrency add` and `render
// environment-setup [--from manage]` — over the setup on the project
// manifest (environment.cjs).
//
// - `show` answers the setup whole, each part none where the setup holds
//   none, and takes no lock.
// - `set <part>` writes one part whole, as given on stdin: `run`, how to run
//   the product; `prepare`, the steps that prepare the environment;
//   `concurrency`, what cannot run at once, each `{what}` — a record the
//   setup holds already keeping when and by whom it was recorded, a new one
//   recorded now and by no unit; `linters`. It refuses the verify setup,
//   which only the task that builds it records (`verify setup`, 15.2.11),
//   and `confirmed`, the person's yes, which `confirm` records; and a part
//   that does not read, naming each fault.
// - `confirm` records the person's yes at the setup's screen (22.5.3):
//   `confirmed`, the instant, which ready to build's checklist reads
//   (checklist.cjs). Run again, it keeps the instant held. From manage
//   (`--from manage`), the yes that keeps the setup, it records the same
//   where none is held, and draws manage again next.
// - `concurrency add <unit> "<what>"` records what the unit's build learned
//   cannot run at once (12.7.4, 22.5.6), once: one recorded already, by any
//   unit, is answered as it stands.
//
// Each write takes the project manifest's lock, writes it whole and commits
// it alone, pushed (`environment: …`); one run again where its write stands
// commits what a kill left uncommitted. Each refuses, opening on its
// command, writing nothing.
//
// `render environment-setup [--from manage]` draws the setup's screen as the
// setup stands (projections/environment-setup.cjs): at the first ready to
// build, its gate's yes `environment confirm`; from manage, its yes
// `environment confirm --from manage`, back to manage.
// ---------------------------------------------------------------------------

const { readProjectManifest, writeProjectManifestAtomic, withProjectLock } = require('../kernel/manifest.cjs');
const { isObject } = require('../kernel/manifest-io.cjs');
const { messageOf } = require('../kernel/call.cjs');
const { commitStateTail, noteCommitOutcome, PROJECT_MANIFEST_SPEC } = require('./commit.cjs');
const { knownUnit, noUnit } = require('./topic-standing.cjs');
const { projectName } = require('./state-checks.cjs');
const { isoNow } = require('./dates.cjs');
const { refusing } = require('./staged-payload.cjs');
const { PARTS, setupOf, filled } = require('./environment.cjs');
const { environmentSetupScreen } = require('./projections/environment-setup.cjs');

/** @typedef {import('./environment.cjs').Concurrency} Concurrency */

/** The parts `set` writes. */
const SET_PARTS = Object.freeze(/** @type {const} */ (['run', 'prepare', 'concurrency', 'linters']));

const ENVIRONMENT_USAGE = [
  'environment show',
  `environment set <${SET_PARTS.join('|')}>   (the part's JSON on stdin)`,
  'environment confirm [--from manage]',
  'environment concurrency add <work-unit> "<what>"',
].join('\n');

/** `confirm`'s words after the verb from manage, whose next draws manage again. */
const FROM_MANAGE = '--from manage';

/** @returns {never} */
function usage() {
  throw new Error(`Usage: ${ENVIRONMENT_USAGE.split('\n').map((line) => `engine ${line}`).join(' | ')}`);
}

/**
 * Change the setup on the project manifest under its lock — `change` given
 * the setup as it stands and answering it as it is to be — then commit the
 * manifest alone: the commit's fields on `result`.
 * @param {string} cwd @param {(environment: Record<string, unknown>) => Record<string, unknown>} change @param {string} message @param {Record<string, unknown>} result
 */
function written(cwd, change, message, result) {
  withProjectLock(cwd, () => {
    const project = readProjectManifest(cwd);
    writeProjectManifestAtomic(cwd, { ...project, environment: change(isObject(project.environment) ? project.environment : {}) });
  });
  /** @type {string[]} */
  const warnings = [];
  const outcome = commitStateTail(cwd, PROJECT_MANIFEST_SPEC, `environment: ${message}`, warnings);
  result.committed = outcome.committed;
  if (warnings.length > 0) result.warnings = warnings;
  noteCommitOutcome(result, outcome, '--state');
  return result;
}

/** What is amiss in what cannot run at once as `set` takes it: each `{what}`, each once. @param {unknown} value @returns {string[]} */
function givenFaults(value) {
  if (!Array.isArray(value)) return ['it is not a list'];
  const held = new Set();
  return value.flatMap((entry, at) => {
    const keys = isObject(entry) ? Object.keys(entry) : null;
    if (keys === null || keys.join() !== 'what' || !filled(entry.what)) return [`entry ${at + 1}: it is not {what} — when and by whom it was recorded are the engine's`];
    if (held.has(entry.what)) return [`entry ${at + 1}: its what "${entry.what}" is an earlier entry's`];
    held.add(entry.what);
    return [];
  });
}

/**
 * What cannot run at once as `set` writes it: each `{what}` given, a record
 * the setup holds already kept as it stands, a new one recorded now and by
 * no unit.
 * @param {{what: string}[]} given @param {Concurrency[]} held @returns {Concurrency[]}
 */
function recordsOf(given, held) {
  const at = isoNow();
  return given.map(({ what }) => held.find((record) => record.what === what) ?? { what, at, by: null });
}

/**
 * `environment set <part>`: the part written whole as stdin gives it.
 * @param {string} cwd @param {string} part @param {string} text
 */
function setPart(cwd, part, text) {
  if (part === 'verify') throw new Error('the verify setup is recorded by the task that builds it, once it runs end to end: engine verify setup (15.2.11)');
  if (part === 'confirmed') throw new Error('the person\'s yes at the setup\'s screen records it: engine environment confirm');
  if (!(/** @type {readonly string[]} */ (SET_PARTS)).includes(part)) throw new Error(`there is no part "${part}" to set — the parts are ${SET_PARTS.join(', ')}`);
  /** @type {unknown} */
  let value;
  try {
    value = JSON.parse(text);
  } catch (err) {
    throw new Error(`the part's JSON on stdin does not read — ${messageOf(err)}`);
  }
  const faults = part === 'concurrency' ? givenFaults(value) : PARTS[/** @type {keyof typeof PARTS} */ (part)].faults(value);
  if (faults.length > 0) throw new Error(`${part} does not read — ${faults.join('; ')}`);
  const held = setupOf(cwd);
  const recorded = part === 'concurrency' ? recordsOf(/** @type {{what: string}[]} */ (value), held.concurrency) : value;
  return written(cwd, (environment) => ({ ...environment, [part]: recorded }), `${part} set`, { part, value: recorded });
}

/**
 * `environment confirm [--from manage]`: the person's yes recorded, an
 * instant held kept; from manage, manage drawn again next.
 * @param {string} cwd @param {boolean} fromManage
 */
function confirm(cwd, fromManage) {
  const confirmed = setupOf(cwd).confirmed ?? isoNow();
  const next = fromManage ? { next: { kind: 'engine', argv: ['render', 'manage'] } } : {};
  return written(cwd, (environment) => ({ ...environment, confirmed }), 'confirmed', { confirmed, ...next });
}

/**
 * `environment concurrency add <unit> "<what>"`: what the unit's build
 * learned cannot run at once, recorded once.
 * @param {string} cwd @param {string} unit @param {string} what
 */
function addConcurrency(cwd, unit, what) {
  if (knownUnit(cwd, unit) === null) throw new Error(noUnit(unit));
  if (!filled(what)) throw new Error('what cannot run at once is said in words');
  const held = setupOf(cwd).concurrency;
  const recorded = held.find((record) => record.what === what);
  if (recorded !== undefined) return written(cwd, (environment) => environment, `what can't run at once — ${what}`, { unit, ...recorded, already: true });
  const record = { what, at: isoNow(), by: unit };
  return written(cwd, (environment) => ({ ...environment, concurrency: [...held, record] }), `what can't run at once — ${what}`, { unit, ...record });
}

/** Each verb by name: what it takes after its name, and its answer. @type {Readonly<Record<string, {takes: number, run: (cwd: string, args: string[], stdin: () => string) => Record<string, unknown>}>>} */
const VERBS = Object.freeze({
  show: { takes: 0, run: (cwd) => ({ ...setupOf(cwd) }) },
  set: { takes: 1, run: (cwd, [part], stdin) => setPart(cwd, part, stdin()) },
  confirm: { takes: 0, run: (cwd) => confirm(cwd, false) },
  concurrency: {
    takes: 3,
    run: (cwd, [verb, unit, what]) => {
      if (verb !== 'add') usage();
      return addConcurrency(cwd, unit, what);
    },
  },
});

/**
 * `environment <verb> …`: the verb's answer, its refusal opening on its
 * command.
 * @param {string} cwd @param {string|undefined} verb @param {string[]} args @param {() => string} stdin
 * @returns {Record<string, unknown>}
 */
function runEnvironmentVerb(cwd, verb, args, stdin) {
  if (verb === 'confirm' && args.join(' ') === FROM_MANAGE) return refusing('environment confirm', () => confirm(cwd, true));
  const taken = verb !== undefined && Object.hasOwn(VERBS, verb) ? VERBS[verb] : null;
  if (taken === null || args.length !== taken.takes || args.some((arg) => arg.startsWith('--'))) usage();
  const said = verb === 'concurrency' ? 'environment concurrency add' : `environment ${verb}`;
  return refusing(said, () => taken.run(cwd, args, stdin));
}

/**
 * `render environment-setup [--from manage]`: the setup's screen.
 * @param {string} cwd @param {{from?: string}} args @returns {string}
 */
function environmentSetupSurface(cwd, { from }) {
  if (from !== undefined && from !== 'manage') throw new Error('Usage: engine render environment-setup [--from manage]');
  return refusing('render environment-setup', () => environmentSetupScreen({ project: projectName(cwd), setup: setupOf(cwd), manage: from === 'manage' }));
}

module.exports = { ENVIRONMENT_USAGE, runEnvironmentVerb, environmentSetupSurface };
