'use strict';

//
// Migration 082: Areas — the word "area" names a discussion's unit alone
//
// What Ledger keeps that named something else an area takes that thing's
// own name, each a step below, each run over the state, `.ledger/` in the
// repository's main checkout:
//   - bug parts: what a bugfix recorded of its bug names the part of the
//     verify setup's feature map it sits in as `part`, where it named its
//     area, `area` — on the unit's investigation item, as the conclude kept
//     it, and on its investigation's close, `checklists.conclusion.{unit}`,
//     as the recap staged it;
//   - finding sections: each finding of a review phase's round,
//     `review/round-{N}.json`, and each note for later a quick-fix's close
//     answered, `build/notes-answered.json`, names the spec's section it is
//     of as `section`, where it named its area, `area`.
// A unit is a folder of the state holding a manifest; a folder of the
// state opening on a dot holds none, and a retired unit kept whole in the
// product's assets is reference, kept as it was. A file is written whole,
// its keys in their order, by a rename from a scratch in the state's cache,
// and only where a step changed it; one that will not read is left as it
// is. Nothing is staged or committed: the migration's commit takes the
// whole state.
//
// Idempotent: a field already renamed is passed over, so a run again, or
// one after a kill between two files, finds nothing left to rename.
//

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const STATE_DIR = '.ledger';
const SCRATCH = path.join('.cache', 'migrate');
const ROUND_RECORD = /^round-\d+\.json$/;
const REPOSITORY_ENV = [
  'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_COMMON_DIR', 'GIT_CONFIG', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_PARAMETERS', 'GIT_DIR',
  'GIT_GRAFT_FILE', 'GIT_IMPLICIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_NAMESPACE', 'GIT_NO_REPLACE_OBJECTS', 'GIT_OBJECT_DIRECTORY',
  'GIT_PREFIX', 'GIT_QUARANTINE_PATH', 'GIT_REPLACE_REF_BASE', 'GIT_SHALLOW_FILE', 'GIT_WORK_TREE',
];

/** @param {unknown} v @returns {v is Record<string, any>} */
function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** The process's environment, less the variables that point git at a repository, so git finds it by the folder alone. */
function withoutRepository() {
  const env = { ...process.env };
  for (const name of REPOSITORY_ENV) delete env[name];
  return env;
}

/** The state of the repository `projectDir` is in, or null where it is in none or holds none. @param {string} projectDir */
function stateOf(projectDir) {
  const res = spawnSync('git', ['rev-parse', '--git-common-dir'], { cwd: projectDir, encoding: 'utf8', env: withoutRepository() });
  if (res.error || res.status !== 0) return null;
  const common = fs.realpathSync(path.resolve(projectDir, res.stdout.trim()));
  if (path.basename(common) !== '.git') return null;
  const state = path.join(path.dirname(common), STATE_DIR);
  return fs.existsSync(state) ? state : null;
}

/** A JSON file as read, or null where it is not there or will not read. @param {string} file */
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * The record's `from` renamed `to`, in its place among the keys, where it
 * holds `from` and not `to`: whether it was.
 * @param {Record<string, any>} record @param {string} from @param {string} to
 */
function renamed(record, from, to) {
  if (!Object.hasOwn(record, from) || Object.hasOwn(record, to)) return false;
  const entries = Object.entries(record).map(([key, value]) => [key === from ? to : key, value]);
  for (const key of Object.keys(record)) delete record[key];
  Object.assign(record, Object.fromEntries(entries));
  return true;
}

/** Each unit's folder in the state. @param {string} state */
function unitsOf(state) {
  return fs.readdirSync(state, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && fs.existsSync(path.join(state, entry.name, 'manifest.json')))
    .map((entry) => path.join(state, entry.name));
}

/**
 * The JSON file at `file` changed by `change`, and written whole where it
 * changed anything: whether it did.
 * @param {string} state @param {string} file @param {(data: Record<string, any>) => boolean} change
 */
function rewrite(state, file, change) {
  const data = readJson(file);
  if (!isObject(data) || !change(data)) return false;
  const scratch = path.join(state, SCRATCH, `082-${process.pid}.json`);
  fs.mkdirSync(path.dirname(scratch), { recursive: true });
  fs.writeFileSync(scratch, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(scratch, file);
  return true;
}

/** Each record of a map of records, `area` renamed `part`: whether any was. @param {unknown} records */
const partsIn = (records) => isObject(records) && Object.values(records).filter(isObject).map((record) => renamed(record, 'area', 'part')).includes(true);

/** Each finding of a file holding `{findings}`, `area` renamed `section`: whether any was. @param {Record<string, any>} data */
const sectionsIn = (data) => Array.isArray(data.findings) && data.findings.filter(isObject).map((finding) => renamed(finding, 'area', 'section')).includes(true);

/** The bug parts step (the header's): each unit's manifest. @param {string} state */
function bugParts(state) {
  return unitsOf(state).filter((unit) => rewrite(state, path.join(unit, 'manifest.json'), (manifest) => [
    partsIn(manifest.phases?.investigation?.items),
    partsIn(manifest.checklists?.conclusion),
  ].includes(true))).length;
}

/** The finding sections step (the header's): each unit's review rounds and its close's notes answered. @param {string} state */
function findingSections(state) {
  return unitsOf(state).flatMap((unit) => {
    const review = path.join(unit, 'review');
    const rounds = fs.existsSync(review) ? fs.readdirSync(review).filter((name) => ROUND_RECORD.test(name)).map((name) => path.join(review, name)) : [];
    return [...rounds, path.join(unit, 'build', 'notes-answered.json')];
  }).filter((file) => rewrite(state, file, sectionsIn)).length;
}

/** The steps, in order, each run over the state: how many files it changed. */
const STEPS = Object.freeze([bugParts, findingSections]);

module.exports = {
  id: '082',
  description: 'the word "area" names a discussion\'s unit alone: a bug\'s record names the feature map\'s part it sits in, and a review finding the spec\'s section it is of',
  info: 'Ledger calls the spec\'s top-level parts sections, and the parts of the verify setup\'s feature map parts, keeping "area" for a discussion\'s unit. In each work unit of the state, this migration renames a bugfix\'s `area` to `part` on its investigation item and its investigation\'s close, and each finding\'s `area` to `section` in the review phase\'s rounds (review/round-{N}.json) and in a quick-fix\'s notes answered at its close (build/notes-answered.json).',
  /** @param {{projectDir: string, reportUpdate: () => void, reportSkip: () => void}} ctx */
  run({ projectDir, reportUpdate, reportSkip }) {
    const state = stateOf(path.resolve(projectDir));
    const changed = state === null ? 0 : STEPS.reduce((sum, step) => sum + step(state), 0);
    if (changed === 0) reportSkip();
    else reportUpdate();
  },
};
