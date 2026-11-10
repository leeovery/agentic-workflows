'use strict';

// ---------------------------------------------------------------------------
// What the absorb suites share (test-engine-workunit-absorb.cjs and
// test-engine-workunit-absorb-ledger.cjs): the feature, auth-flow, and the
// epic it is absorbed into, payments, their manifests as the absorb reads
// them; the project carrying both, filled in a folder of its own
// (`setupFixture`) or in a suite's world built once and copied
// (`fillFixture`, `copyFixture`); the engine called on it; and the reads the
// suites hold its answers to.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const fs = require('fs');
const os = require('os');
const path = require('path');
const { git, stateGit, okSections, refuses, keywordOnlyKnowledge, commitAll, setupFixtureAt } = require('./engine-harness.cjs');

/** The absorb the suites run: the feature into the epic, as the topic auth. */
const ABSORB = Object.freeze(['workunit', 'absorb', 'auth-flow', '--into', 'payments', '--topic', 'auth']);

/** A file at `rel` under `dir`, its folders made. @param {string} dir @param {string} rel @param {string} content */
function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

/** The absorbable feature: a discussion and a seed. @param {Record<string, unknown>} [overrides] @returns {Record<string, any>} */
function featureManifest(overrides = {}) {
  return {
    name: 'auth-flow',
    work_type: 'feature',
    status: 'in-progress',
    created: '2026-06-01',
    description: 'auth flow work',
    seeds: [{ path: 'seeds/seed.md', source: 'inbox:idea', seeded_at: '2026-06-02T10:00:00Z' }],
    phases: {
      discussion: { items: { 'auth-flow': { status: 'completed' } } },
    },
    ...overrides,
  };
}

/** The target epic — carries a seed of its own and a dismissed name. @param {Record<string, unknown>} [overrides] @returns {Record<string, any>} */
function epicManifest(overrides = {}) {
  return {
    name: 'payments',
    work_type: 'epic',
    status: 'in-progress',
    seeds: [{ path: 'seeds/roadmap.md', source: 'inbox:idea', seeded_at: '2026-05-01T08:00:00Z' }],
    phases: {
      discovery: {
        items: { 'fee-model': { source: 'discovery', summary: 'Fees' } },
        dismissed: ['dead-idea'],
      },
    },
    ...overrides,
  };
}

/**
 * The project at `project` carrying the feature and the epic, its state
 * committed.
 * @param {string} project @param {{feature?: Record<string, any>, epic?: Record<string, any>}} [manifests]
 */
function fillFixture(project, { feature = featureManifest(), epic = epicManifest() } = {}) {
  keywordOnlyKnowledge(project);
  const setUp = JSON.parse(fs.readFileSync(path.join(project, '.leeway/manifest.json'), 'utf8'));
  writeFile(project, '.leeway/manifest.json', JSON.stringify({
    ...setUp,
    work_units: { 'auth-flow': { work_type: 'feature' }, payments: { work_type: 'epic' } },
  }, null, 2) + '\n');
  writeFile(project, '.leeway/auth-flow/manifest.json', JSON.stringify(feature, null, 2) + '\n');
  writeFile(project, '.leeway/auth-flow/topics/auth-flow/log.md', '# Discussion\n');
  writeFile(project, '.leeway/auth-flow/seeds/seed.md', '# Seed\n');
  writeFile(project, '.leeway/payments/manifest.json', JSON.stringify(epic, null, 2) + '\n');
  writeFile(project, '.leeway/payments/seeds/roadmap.md', '# Roadmap\n');
  // A file-only collision in the epic's seeds — dedupe must dodge it.
  writeFile(project, '.leeway/payments/seeds/notes.md', '# Epic notes\n');
  commitAll(project, 'init');
}

/** A project in a temp folder of its own, and the folder. @typedef {{root: string, project: string}} Fixture */

/** A project of its own, its state committed, carrying the feature and the epic. @param {Parameters<typeof fillFixture>[1]} [manifests] @returns {Fixture} */
function setupFixture(manifests = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-wu-absorb-'));
  const project = setupFixtureAt(path.join(root, 'project'));
  fillFixture(project, manifests);
  return { root, project };
}

/** A copy of `world`, a suite's world built once (`fixtureFrom`), in a temp folder of its own. @param {(dir: string) => string} world @returns {Fixture} */
function copyFixture(world) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-wu-absorb-'));
  return { root, project: world(path.join(root, 'project')) };
}

/** Remove a fixture's folder. @param {Fixture} fix */
function removeFixture(fix) {
  fs.rmSync(fix.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

/**
 * Run the engine expecting success: the parsed JSON response, the sections
 * after it kept on `engine.lastSections`.
 * @param {Fixture} fix @param {readonly string[]} args @param {Record<string, string|undefined>} [env]
 * @returns {Record<string, any>}
 */
function engine(fix, args, env = {}) {
  const { res, sections } = okSections(fix.project, [...args], { env });
  engine.lastSections = sections;
  return res;
}
engine.lastSections = '';

/** Run the engine expecting failure: the parsed stderr JSON. @param {Fixture} fix @param {readonly string[]} args @param {Record<string, string|undefined>} [env] */
const engineFails = (fix, args, env = {}) => refuses(fix.project, [...args], { env });

/** Where a path in the epic lands, absolute, as the response names it. @param {Fixture} fix @param {string} rel */
function inEpic(fix, rel) {
  return path.join(fix.project, '.leeway', 'payments', rel);
}

/** A unit's manifest as it stands. @param {Fixture} fix @param {string} wu */
function readManifest(fix, wu) {
  return JSON.parse(fs.readFileSync(path.join(fix.project, '.leeway', wu, 'manifest.json'), 'utf8'));
}

/** The state branch's head, short. @param {Fixture} fix */
function shortHead(fix) {
  return stateGit(fix.project, ['rev-parse', '--short', 'HEAD']).trim();
}

/** The files the state branch's head commit touched. @param {Fixture} fix @param {string[]} [flags] */
function headFiles(fix, flags = []) {
  return stateGit(fix.project, ['show', '--name-only', ...flags, '--pretty=format:', 'HEAD']).trim().split('\n');
}

/** Every file under `.leeway/`, rel path → content, the commits and both trees' status — the pristine check. @param {Fixture} fix */
function treeSnapshot(fix) {
  /** @type {Record<string, string>} */
  const files = {};
  const walk = (/** @type {string} */ dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else files[path.relative(fix.project, full)] = fs.readFileSync(full, 'utf8');
    }
  };
  walk(path.join(fix.project, '.leeway'));
  return {
    files,
    commits: stateGit(fix.project, ['rev-list', '--count', 'HEAD']).trim(),
    status: git(fix.project, ['status', '--porcelain']) + stateGit(fix.project, ['status', '--porcelain']),
  };
}

module.exports = {
  ABSORB, writeFile, featureManifest, epicManifest, fillFixture, setupFixture, copyFixture, removeFixture,
  engine, engineFails, inEpic, readManifest, shortHead, headFiles, treeSnapshot,
};
