'use strict';

// ---------------------------------------------------------------------------
// The commit door suites' world and helpers (test-engine-commit-door-state.cjs,
// test-engine-commit-door-code.cjs, test-engine-commit-door-guards.cjs): an
// epic, `payments`, its two topics in progress, their investigation
// documents committed clean, built once per process and copied — with
// topic-a's implementation and code committed beside it where a suite needs
// one — and the reads of what a commit took and left, on the state branch
// and in the code tree.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const { git, stateGit, commitAll, fixtureFrom, layout, createFile, writeState } = require('./engine-harness.cjs');

/** Files in the state branch's head commit, state-relative. */
function headFiles(dir) {
  return stateGit(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').filter(Boolean);
}

/** The state worktree's `git status --porcelain` lines. */
function statusLines(dir) {
  return stateGit(dir, ['status', '--porcelain']).split('\n').filter(Boolean);
}

/** Files in the code tree's head commit. */
function codeHeadFiles(dir) {
  return git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').filter(Boolean);
}

/** The code tree's `git status --porcelain` lines. */
function codeStatusLines(dir) {
  return git(dir, ['status', '--porcelain']).split('\n').filter(Boolean);
}

/**
 * Hold the state branch's ref as a peer git process would mid-update: every
 * state commit fails at the ref move until the hold goes.
 * @param {string} dir
 */
function holdStateRef(dir) {
  fs.writeFileSync(path.join(dir, '.git/refs/heads/leeway-state.lock'), '');
}

function epicManifest() {
  return {
    name: 'payments',
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      discovery: { items: { 'topic-a': { source: 'discovery' } } },
      discussion: { items: { 'topic-a': { status: 'in-progress' }, 'topic-b': { status: 'in-progress' } } },
      investigation: { items: { 'topic-a': { status: 'in-progress' }, 'topic-b': { status: 'in-progress' } } },
    },
  };
}

/** Two in-progress topics, their investigation documents committed clean. @param {string} dir */
function twoTopics(dir) {
  writeState(dir, layout.manifest('payments'), JSON.stringify(epicManifest(), null, 2) + '\n');
  writeState(dir, layout.doc('payments', 'investigation', 'topic-a'), '# Topic A\n');
  writeState(dir, layout.doc('payments', 'investigation', 'topic-b'), '# Topic B\n');
  commitAll(dir, 'init');
}

/**
 * The two topics, topic-a's implementation in progress, and code committed
 * at `src/app.js` — with `more` written beside it before the commit.
 * @param {string} dir @param {Record<string, string>} [more]
 */
function implementing(dir, more = {}) {
  twoTopics(dir);
  const manifest = epicManifest();
  manifest.phases.implementation = { items: { 'topic-a': { status: 'in-progress' } } };
  writeState(dir, layout.manifest('payments'), JSON.stringify(manifest, null, 2) + '\n');
  createFile(dir, 'src/app.js', 'const x = 1;\n');
  for (const [rel, content] of Object.entries(more)) createFile(dir, rel, content);
  commitAll(dir, 'code');
}

const setupTwoTopicFixture = fixtureFrom('engine-commit-', twoTopics);

module.exports = { headFiles, statusLines, codeHeadFiles, codeStatusLines, holdStateRef, epicManifest, twoTopics, implementing, setupTwoTopicFixture };
