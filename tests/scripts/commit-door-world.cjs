'use strict';

// ---------------------------------------------------------------------------
// The commit door suites' world and helpers (test-engine-commit-door-state.cjs,
// test-engine-commit-door-code.cjs, test-engine-commit-door-guards.cjs, and
// the task test-engine-code.cjs's code commits are made under): an
// epic, `payments`, its two topics in progress, their logs and briefs
// committed clean, built once per process and copied — with code
// committed beside it and the checkout on the branch of the task a code
// commit is made under where a suite needs one — the task in flight in the
// conversation the code commits are made in, and the reads of what a commit
// took and left, on the state branch and in the code tree.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const { ok, git, stateGit, commitAll, fixtureFrom, cleanupFixture, setupGitFixture, layout, createFile, writeState } = require('./engine-harness.cjs');
const { templateFolder } = require('./discovery-test-utils.cjs');
const { taskBranch } = require('../../skills/leeway-engine/scripts/domain/landing-names.cjs');

/** The conversation the suites' code commits are made in. */
const BUILDING = 'commit-door-building';

/** A call's options in that conversation. */
const building = Object.freeze({ env: Object.freeze({ CLAUDE_CODE_SESSION_ID: BUILDING }) });

/** A code commit's target: task 1.1 of payments, in flight in that conversation. */
const FOR_TASK = Object.freeze(['--task', 'payments', '1.1']);

/** The branch of task 1.1 of payments, which a checkout committing under it has out. */
const TASK_BRANCH = taskBranch({ unit: 'payments', phase: 1, n: 1 }, 'feat', 'Take a card');

const TASK = [
  '# Take a card', '', '## Type', 'feat', '', '## Problem', 'A card cannot be taken.', '', '## Solution', 'Add the card form.', '',
  '## Outcome', 'A card is taken.', '', '## Acceptance scenarios', '- Given a card, when it is taken, then it is charged.', '', '## Spec reference', '§1',
].join('\n');

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

/** Two in-progress topics, their logs and briefs committed clean. @param {string} dir */
function twoTopics(dir) {
  writeState(dir, layout.manifest('payments'), JSON.stringify(epicManifest(), null, 2) + '\n');
  for (const [topic, title] of [['topic-a', 'Topic A'], ['topic-b', 'Topic B']]) {
    writeState(dir, layout.doc('payments', 'investigation', topic), `# ${title}\n`);
    writeState(dir, layout.brief('payments', topic), `# ${title}\n`);
  }
  commitAll(dir, 'init');
}

/**
 * The two topics, and code committed at `src/app.js` — with `more` written
 * beside it before the commit — the checkout on task 1.1's branch.
 * @param {string} dir @param {Record<string, string>} [more]
 */
function implementing(dir, more = {}) {
  twoTopics(dir);
  createFile(dir, 'src/app.js', 'const x = 1;\n');
  for (const [rel, content] of Object.entries(more)) createFile(dir, rel, content);
  commitAll(dir, 'code');
  git(dir, ['checkout', '-q', '-b', TASK_BRANCH]);
}

/**
 * Task 1.1 of payments started in the building conversation, from a world
 * made for it and taken apart again: the conversation's record of it lives
 * outside every fixture, so a suite starts it once, before its code commits,
 * and every copy of its world commits under it.
 */
function startBuilding() {
  const dir = setupGitFixture('commit-door-building-');
  twoTopics(dir);
  ok(dir, ['task', 'phase', 'payments', '1', '--title', 'Cards']);
  const file = path.join(templateFolder('commit-door-task-'), 'task.md');
  fs.writeFileSync(file, TASK);
  ok(dir, ['task', 'create', 'payments', '1', '--file', file]);
  fs.rmSync(path.dirname(file), { recursive: true, force: true });
  ok(dir, ['task', 'start', 'payments', '1.1'], building);
  cleanupFixture(dir);
}

const setupTwoTopicFixture = fixtureFrom('engine-commit-', twoTopics);

module.exports = {
  headFiles, statusLines, codeHeadFiles, codeStatusLines, holdStateRef, epicManifest, twoTopics, implementing, setupTwoTopicFixture,
  building, FOR_TASK, TASK_BRANCH, startBuilding,
};
