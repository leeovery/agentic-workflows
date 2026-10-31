'use strict';

// The world the roadmap's suites share (test-engine-roadmap.cjs,
// test-engine-roadmap-topic-verbs.cjs): a project with an empty project
// manifest committed, a suite's own fixture on top (`roadmapWorld`); the
// roadmap verbs answering (`runOk`, `runFail`); and the reads their
// assertions make of the project manifest and the state.

require('./hermetic-env.cjs');

const fs = require('fs');
const path = require('path');
const harness = require('./engine-harness.cjs');

const { commitAll, ok, refuses } = harness;

/**
 * A world made once per process from a temp-dir git repo with an empty
 * project manifest committed, and `build`'s own fixture on top; each call
 * answers a copy.
 * @param {(dir: string) => void} [build]
 */
function roadmapWorld(build = () => {}) {
  return harness.fixtureFrom('engine-roadmap-', (dir) => {
    fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), '{}\n');
    commitAll(dir, 'init');
    build(dir);
  });
}

/** A path in the state as a state commit names it: from the state root. */
const inState = (rel) => rel.replace(/^\.leeway\//, '');

/** Run a roadmap command expecting success; returns the parsed JSON line. */
const runOk = (dir, args) => ok(dir, ['roadmap', ...args]);

/** Run a roadmap command expecting failure; returns the parsed stderr JSON. */
const runFail = (dir, args) => refuses(dir, ['roadmap', ...args]);

function readProject(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.leeway', 'manifest.json'), 'utf8'));
}

function projectManifestText(dir) {
  return fs.readFileSync(path.join(dir, '.leeway', 'manifest.json'), 'utf8');
}

/** Put a source on disk under `.leeway/` — an item records only a file already there. */
function writeSource(dir, rel) {
  const abs = path.join(dir, '.leeway', rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, '# Session\n');
}

module.exports = { roadmapWorld, inState, runOk, runFail, readProject, projectManifestText, writeSource };
