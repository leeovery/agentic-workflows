'use strict';

// ---------------------------------------------------------------------------
// `engine commit --workflows` (leeway-engine/scripts/domain/commit.cjs):
// the whole state staged and committed on the state branch, a clean tree
// committing nothing, and mixed scopes refused.
//
// Layer: verb. World: a project with its state worktree, one work unit and a
// file in its code tree committed, made once per process and copied.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { ok, refuses, git, stateGit, commitAll, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { createFile } = require('./discovery-test-utils.cjs');

const projectWorld = fixtureFrom('engine-commit-workflows-', (project) => {
  createFile(project, '.leeway/payments/manifest.json', '{"name":"payments"}\n');
  createFile(project, 'README.md', '# project\n');
  commitAll(project, 'init');
});

describe('engine commit --workflows', () => {
  let project;
  beforeEach(() => { project = projectWorld(); });
  afterEach(() => cleanupFixture(project));

  it('stages the whole state — many work units plus .state — and commits it on the state branch', () => {
    createFile(project, '.leeway/payments/manifest.json', '{"name":"payments","v":2}\n');
    createFile(project, '.leeway/auth-flow/manifest.json', '{"name":"auth-flow"}\n');
    createFile(project, '.leeway/.state/migrations', '045\n');
    createFile(project, 'unrelated.txt', 'outside the scope\n');

    const res = ok(project, ['commit', '--workflows', '-m', 'chore: apply workflow migrations']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.committed, stateGit(project, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(stateGit(project, ['log', '-1', '--pretty=%s']).trim(), 'chore: apply workflow migrations');
    // Everything in the state landed in the one commit, on the state branch…
    const show = stateGit(project, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').sort();
    assert.deepStrictEqual(show, [
      '.state/migrations',
      'auth-flow/manifest.json',
      'payments/manifest.json',
    ]);
    assert.strictEqual(git(project, ['log', '-1', '--pretty=%s']).trim(), 'init', 'none on the code side');
    // …and the unrelated file stays uncommitted.
    assert.match(git(project, ['status', '--porcelain']), /\?\? unrelated\.txt/);
  });

  it('a clean tree is fine: committed null, nothing-to-commit note, exit 0', () => {
    const res = ok(project, ['commit', '--workflows', '-m', 'noop']);
    assert.deepStrictEqual(res, { ok: true, committed: null, note: 'nothing to commit' });
  });

  it('rejects mixed scopes — exactly one of {wu, --inbox, --workflows}', () => {
    assert.match(
      refuses(project, ['commit', '--workflows', 'payments', '-m', 'msg']).error,
      /Usage: engine commit/);
    assert.match(
      refuses(project, ['commit', '--workflows', '--inbox', '-m', 'msg']).error,
      /Usage: engine commit/);
    assert.match(
      refuses(project, ['commit', '--workflows']).error,
      /Usage: engine commit/);
  });
});
