'use strict';

//
// Tests for the commit door: the state's pathspec'd commits (`engine commit
// --topic` and its siblings) on the state branch, the code tree's (`--paths`,
// the owned paths of `--migrations`) with their commit lock and index.lock
// retry, never on the state branch, and the transaction-tail degrade.
//

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const harness = require('./engine-harness.cjs');
const { commitStaged } = require('../../skills/workflow-engine/scripts/kernel/git.cjs');
const { withCommitLock, commitAcrossRepos, commitPathspecScoped } = require('../../skills/workflow-engine/scripts/domain/commit.cjs');

const { ENGINE, git, stateGit, commitAll, cleanupFixture, fixtureFrom } = harness;

const setupGitFixture = () => harness.setupGitFixture('engine-commit-');

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

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

/** Run the engine expecting success; returns the parsed JSON response. */
const engine = (dir, args, env) => harness.ok(dir, args, { env });

/** Run the engine expecting failure; returns the parsed stderr JSON. */
const engineFails = (dir, args, env) => harness.refuses(dir, args, { env });

function epicManifest() {
  return {
    name: 'payments',
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      discovery: { items: { 'topic-a': { routing: 'discussion', source: 'discovery' } } },
      research: { items: { 'auth-flow': { status: 'in-progress' } } },
      discussion: { items: { 'topic-a': { status: 'in-progress' }, 'topic-b': { status: 'in-progress' } } },
    },
  };
}

/** Two in-progress discussion topics, both committed clean. @param {string} dir */
function twoTopics(dir) {
  writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(epicManifest(), null, 2) + '\n');
  writeFile(dir, '.leeway/payments/discussion/topic-a.md', '# Topic A\n');
  writeFile(dir, '.leeway/payments/discussion/topic-b.md', '# Topic B\n');
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
  writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  writeFile(dir, 'src/app.js', 'const x = 1;\n');
  for (const [rel, content] of Object.entries(more)) writeFile(dir, rel, content);
  commitAll(dir, 'code');
}

const setupTwoTopicFixture = fixtureFrom('engine-commit-', twoTopics);

describe('engine commit --topic: pathspec isolation', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('commits own topic + manifest, leaves the other topic dirty and uncommitted', () => {
    writeFile(dir, '.leeway/payments/discussion/topic-a.md', '# Topic A\nprogress\n');
    writeFile(dir, '.leeway/payments/discussion/topic-b.md', '# Topic B\npeer session dirt\n');
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(epicManifest(), null, 2) + '\n\n');

    const res = engine(dir, ['commit', 'payments', '-m', 'discussion(payments/topic-a): progress', '--topic', 'discussion/topic-a']);

    assert.strictEqual(res.ok, true);
    assert.match(res.committed, /^[0-9a-f]+$/);
    const files = headFiles(dir);
    assert.ok(files.includes('payments/discussion/topic-a.md'), 'own topic committed');
    assert.ok(files.includes('payments/manifest.json'), 'manifest committed');
    assert.ok(!files.includes('payments/discussion/topic-b.md'), 'peer topic not committed');
    assert.deepStrictEqual(statusLines(dir), [' M payments/discussion/topic-b.md'], 'peer dirt untouched');
  });

  it('commits an experiment record tree whole — documents, data, nested sub-records — and leaves the tree clean', () => {
    writeFile(dir, '.leeway/payments/experiment/topic-a/E1-x/problem.md', '# Problem\n');
    writeFile(dir, '.leeway/payments/experiment/topic-a/E1-x/design.md', '# Design\n');
    writeFile(dir, '.leeway/payments/experiment/topic-a/E1-x/data/samples.csv', 'a,b\n');
    writeFile(dir, '.leeway/payments/experiment/topic-a/E1-x/E1.1-y/report.md', '# Sub report\n');
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(epicManifest(), null, 2) + '\n\n');
    writeFile(dir, '.leeway/payments/discussion/topic-b.md', '# Topic B\npeer session dirt\n');

    const res = engine(dir, ['commit', 'payments', '-m', 'experiment(payments/topic-a): E1 designed', '--topic', 'experiment/topic-a']);
    assert.strictEqual(res.ok, true);
    const files = headFiles(dir);
    for (const rel of [
      'payments/experiment/topic-a/E1-x/problem.md',
      'payments/experiment/topic-a/E1-x/design.md',
      'payments/experiment/topic-a/E1-x/data/samples.csv',
      'payments/experiment/topic-a/E1-x/E1.1-y/report.md',
      'payments/manifest.json',
    ]) {
      assert.ok(files.includes(rel), `record tree committed whole: ${rel}`);
    }
    assert.deepStrictEqual(statusLines(dir), [' M payments/discussion/topic-b.md'],
      'the record tree is clean; only the peer dirt remains');
  });

  it('topic absorb deletes one message file, commits action-scoped, and answers remaining', () => {
    writeFile(dir, '.leeway/payments/discussion/.mailbox/topic-a/001-first.md', '### First\nbody\n');
    writeFile(dir, '.leeway/payments/discussion/.mailbox/topic-a/002-second.md', '### Second\nbody\n');
    commitAll(dir, 'deliveries');
    writeFile(dir, '.leeway/payments/discussion/topic-a.md', '# Topic A\nfold\n');
    writeFile(dir, '.leeway/payments/discussion/topic-b.md', '# Topic B\npeer dirt\n');

    const res = engine(dir, ['topic', 'absorb', 'payments', 'discussion', 'topic-a', '--file', '001-first.md', '--subtopic', 'first', '-m', 'discussion(payments/topic-a): absorb 001-first (from origin)']);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.absorbed, '001-first.md');
    assert.strictEqual(res.remaining, 1, 'answers the post-deletion count');
    assert.match(res.committed, /^[0-9a-f]+$/);
    assert.ok(!fs.existsSync(path.join(dir, '.leeway/payments/discussion/.mailbox/topic-a/001-first.md')), 'message file deleted');
    const files = headFiles(dir);
    assert.ok(files.includes('payments/discussion/topic-a.md'), 'fold rides the commit');
    assert.ok(files.includes('payments/discussion/.mailbox/topic-a/001-first.md'), 'the deletion rides the commit');
    assert.ok(!files.includes('payments/discussion/topic-b.md'), 'peer topic not swept');

    const last = engine(dir, ['topic', 'absorb', 'payments', 'discussion', 'topic-a', '--file', '002-second.md', '--subtopic', 'second', '-m', 'discussion(payments/topic-a): absorb 002-second (from origin)']);
    assert.strictEqual(last.remaining, 0, 'the emptied mailbox answers zero');

    assert.match(
      engineFails(dir, ['topic', 'absorb', 'payments', 'discussion', 'topic-a', '--file', '002-second.md', '--subtopic', 'second', '-m', 'x']).error,
      /is not in the topic-a discussion mailbox/);
    assert.match(
      engineFails(dir, ['topic', 'absorb', 'payments', 'discussion', 'topic-a', '--file', '../002-second.md', '-m', 'x']).error,
      /message-file name, not a path/);
    assert.match(
      engineFails(dir, ['topic', 'absorb', 'payments', 'planning', 'topic-a', '--file', '001-x.md', '-m', 'x']).error,
      /research\|discussion\|investigation only/);
  });

  it('leaves content another process staged out of the commit and still staged', () => {
    writeFile(dir, '.leeway/payments/discussion/topic-a.md', '# Topic A\nprogress\n');
    writeFile(dir, '.leeway/payments/discussion/topic-b.md', '# Topic B\npeer session dirt\n');
    stateGit(dir, ['add', '--', 'payments/discussion/topic-b.md']);

    engine(dir, ['commit', 'payments', '-m', 'discussion(payments/topic-a): progress', '--topic', 'discussion/topic-a']);

    assert.ok(!headFiles(dir).includes('payments/discussion/topic-b.md'), 'staged peer file not committed');
    assert.strictEqual(stateGit(dir, ['diff', '--cached', '--name-only']).trim(), 'payments/discussion/topic-b.md', 'peer staging preserved');
  });

  it('commits an untracked artifact directory (specification phase)', () => {
    writeFile(dir, '.leeway/payments/specification/topic-a/specification.md', '# Spec\n');

    const res = engine(dir, ['commit', 'payments', '-m', 'spec(payments): construct topic-a', '--topic', 'specification/topic-a']);

    assert.match(res.committed, /^[0-9a-f]+$/);
    assert.ok(headFiles(dir).includes('payments/specification/topic-a/specification.md'));
  });

  it('reports nothing to commit on clean paths, and on paths that do not exist', () => {
    const clean = engine(dir, ['commit', 'payments', '-m', 'noop', '--topic', 'discussion/topic-a']);
    assert.strictEqual(clean.committed, null);
    assert.strictEqual(clean.note, 'nothing to commit');

    const missing = engine(dir, ['commit', 'payments', '-m', 'noop', '--topic', 'review/never-started']);
    assert.strictEqual(missing.committed, null);
    assert.strictEqual(missing.note, 'nothing to commit');
  });

  it('regression: --topic commits survive an emptied mailbox (the post-drain state)', () => {
    // Deliver a message (creates + commits the sidecar file), drain it (rm +
    // commit stages the deletion), then keep working: the emptied-but-present
    // directory must not poison later --topic commits.
    writeFile(dir, '.leeway/.cache/scratch/c.md', '### Q\n*From: x · discussion · d*\n\nBody.\n');
    engine(dir, ['topic', 'send', 'payments', 'discussion', 'topic-a',
      '--content', '.leeway/.cache/scratch/c.md', '--slug', 'q', '-m', 'discussion(payments/x): send message to topic-a']);
    fs.unlinkSync(path.join(dir, '.leeway/payments/discussion/.mailbox/topic-a/001-q.md'));
    const drain = engine(dir, ['commit', 'payments', '-m', 'discussion(payments/topic-a): drain mailbox', '--topic', 'discussion/topic-a']);
    assert.match(drain.committed, /^[0-9a-f]+$/, 'the drain commit stages the deletion');

    writeFile(dir, '.leeway/payments/discussion/topic-a.md', '# Topic A\nprogress after the drain\n');
    const after = engine(dir, ['commit', 'payments', '-m', 'discussion(payments/topic-a): progress', '--topic', 'discussion/topic-a']);
    assert.match(after.committed, /^[0-9a-f]+$/, 'the emptied mailbox directory no longer breaks the pathspec');
    assert.ok(fs.existsSync(path.join(dir, '.leeway/payments/discussion/.mailbox/topic-a')), 'the empty dir is still on disk — excluded, not deleted');
  });

  it('an investigation\'s mailbox rides its own topic\'s commit', () => {
    // A mailbox is legal for investigation, and a delivery whose own tail commit
    // failed leaves the message file on disk with a pending note prescribing
    // `--topic investigation/{topic} --sweep` as the retry. Without the
    // sidecar in the scope that retry commits the manifest and walks past the
    // message it was run to land.
    writeFile(dir, '.leeway/crash-fix/manifest.json', JSON.stringify({
      name: 'crash-fix',
      work_type: 'bugfix',
      status: 'in-progress',
      phases: { investigation: { items: { 'crash-fix': { status: 'in-progress' } } } },
    }, null, 2) + '\n');
    writeFile(dir, '.leeway/crash-fix/investigation/crash-fix.md', '# Investigation — Crash Fix\n');
    commitAll(dir, 'a bugfix under investigation');

    writeFile(dir, '.leeway/crash-fix/investigation/.mailbox/crash-fix/001-q.md',
      '### Q\n*From: topic-a · discussion · 2026-01-01*\n\nBody.\n');
    const landed = engine(dir, ['commit', 'crash-fix', '-m', 'investigation(crash-fix): land the message',
      '--topic', 'investigation/crash-fix', '--sweep']);

    assert.match(landed.committed, /^[0-9a-f]+$/);
    assert.ok(headFiles(dir).includes('crash-fix/investigation/.mailbox/crash-fix/001-q.md'),
      'the waiting message rides the investigation topic commit');

    // And the drain's deletion commits on the same scope.
    fs.unlinkSync(path.join(dir, '.leeway/crash-fix/investigation/.mailbox/crash-fix/001-q.md'));
    const drain = engine(dir, ['commit', 'crash-fix', '-m', 'investigation(crash-fix): drain mailbox',
      '--topic', 'investigation/crash-fix']);
    assert.match(drain.committed, /^[0-9a-f]+$/, 'the drain commit stages the deletion');
    assert.deepStrictEqual(statusLines(dir), [], 'nothing left dirty');
  });

  it('does not stage the knowledge store — the KB dir never rides a --topic commit', () => {
    writeFile(dir, '.leeway/.knowledge/metadata.json', '{}\n');
    writeFile(dir, '.leeway/payments/discussion/topic-a.md', '# Topic A\nprogress\n');

    engine(dir, ['commit', 'payments', '-m', 'discussion(payments/topic-a): progress', '--topic', 'discussion/topic-a']);

    assert.ok(!headFiles(dir).some((f) => f.startsWith('.knowledge/')), 'KB dir not committed');
    assert.ok(fs.existsSync(path.join(dir, '.leeway/.knowledge/metadata.json')), 'KB dirt left in place');
  });

  it('rejects malformed and illegal --topic specs', () => {
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--topic', 'bogus/topic-a']).error, /expected <phase>\/<topic>/);
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--topic', 'discussion']).error, /expected <phase>\/<topic>/);
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--topic', 'discussion/..']).error, /invalid topic name/);
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--topic', 'discussion/topic-a', '--plan', 'topic-a']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', '--inbox', '-m', 'x', '--topic', 'discussion/topic-a']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--topic', 'toString/topic-a']).error, /expected <phase>\/<topic>/);
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--topic', '__proto__/topic-a']).error, /expected <phase>\/<topic>/);
  });
});

describe('engine commit --discovery: the discovery session\'s scope', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('commits sessions, briefs and the manifest — never a live peer\'s topic', () => {
    writeFile(dir, '.leeway/payments/discovery/sessions/session-001.md', '# Session 001\n');
    writeFile(dir, '.leeway/payments/discovery/briefs/topic-a.md', '# Brief — topic A\n');
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(epicManifest(), null, 2) + '\n\n');
    writeFile(dir, '.leeway/payments/discussion/topic-b.md', '# Topic B\npeer session dirt\n');

    const res = engine(dir, ['commit', 'payments', '--discovery', '-m', 'discovery(payments): shape the map']);

    assert.match(res.committed, /^[0-9a-f]+$/);
    const files = headFiles(dir);
    assert.ok(files.includes('payments/discovery/sessions/session-001.md'), 'session log committed');
    assert.ok(files.includes('payments/discovery/briefs/topic-a.md'), 'brief committed');
    assert.ok(files.includes('payments/manifest.json'), 'manifest committed');
    assert.ok(!files.includes('payments/discussion/topic-b.md'), 'the peer session\'s topic is not swept');
    assert.deepStrictEqual(statusLines(dir), [' M payments/discussion/topic-b.md'], 'peer dirt untouched');
  });

  it('reports nothing to commit on a work unit with no discovery content', () => {
    const clean = engine(dir, ['commit', 'payments', '--discovery', '-m', 'noop']);
    assert.strictEqual(clean.committed, null);
    assert.strictEqual(clean.note, 'nothing to commit');
  });

  it('refuses --discovery beside another scope flag', () => {
    assert.match(engineFails(dir, ['commit', 'payments', '--discovery', '-m', 'x', '--topic', 'discussion/topic-a']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', '--discovery', '-m', 'x']).error, /Usage/);
  });
});

describe('engine commit --imports: the landing\'s retry scope', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('commits the imports home and the manifest — never a live peer\'s topic', () => {
    writeFile(dir, '.leeway/payments/imports/dockset-05.jpeg', 'jpeg bytes\n');
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(epicManifest(), null, 2) + '\n\n');
    writeFile(dir, '.leeway/payments/research/auth-flow.md', '# Auth Flow\npeer session dirt\n');

    const res = engine(dir, ['commit', 'payments', '--imports', '-m', 'workflow(payments): import 1 file(s) for research/auth-flow']);

    assert.match(res.committed, /^[0-9a-f]+$/);
    const files = headFiles(dir);
    assert.ok(files.includes('payments/imports/dockset-05.jpeg'), 'the landed file committed');
    assert.ok(files.includes('payments/manifest.json'), 'the manifest its entry lives on committed');
    assert.ok(!files.includes('payments/research/auth-flow.md'), 'the peer session\'s topic is not swept');
    assert.deepStrictEqual(statusLines(dir), ['?? payments/research/'], 'peer dirt untouched');
  });

  it('refuses --imports beside another scope flag, and with no work unit', () => {
    assert.match(engineFails(dir, ['commit', 'payments', '--imports', '-m', 'x', '--discovery']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', 'payments', '--imports', '-m', 'x', '--topic', 'discussion/topic-a']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', '--imports', '-m', 'x']).error, /Usage/);
  });
});

describe('engine commit --state: the analysis scopes', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('the work unit form takes its analysis dir and its manifest — never the store', () => {
    writeFile(dir, '.leeway/.knowledge/metadata.json', '{}\n');
    writeFile(dir, '.leeway/payments/.state/discussion-consolidation-analysis.md', '# Groupings\n');
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(epicManifest(), null, 2) + '\n\n');
    // A live peer mid-write, in the same work unit — the theft this scope closes.
    writeFile(dir, '.leeway/payments/discussion/topic-b.md', '# Topic B\npeer session dirt\n');
    writeFile(dir, '.leeway/payments/specification/topic-a/specification.md', '# Spec\nhalf written\n');

    const res = engine(dir, ['commit', 'payments', '--state', '-m', 'spec(payments): grouping analysis']);

    assert.match(res.committed, /^[0-9a-f]+$/);
    const files = headFiles(dir);
    assert.ok(files.includes('payments/.state/discussion-consolidation-analysis.md'), 'the analysis rides');
    assert.ok(files.includes('payments/manifest.json'), 'so does the manifest it wrote');
    assert.ok(!files.some((f) => f.startsWith('.knowledge/')), 'the store is never committed');
    assert.deepStrictEqual(
      statusLines(dir).sort(),
      [' M payments/discussion/topic-b.md', '?? payments/specification/'],
      'both live peers keep every byte they had not committed',
    );
  });

  it('the global form takes .leeway/.state and nothing else', () => {
    writeFile(dir, '.leeway/.state/environment-setup.md', '# Environment\n');
    writeFile(dir, '.leeway/payments/discussion/topic-b.md', '# Topic B\npeer session dirt\n');
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(epicManifest(), null, 2) + '\n\n');

    const res = engine(dir, ['commit', '--state', '-m', 'chore: record environment setup']);

    assert.deepStrictEqual(headFiles(dir), ['.state/environment-setup.md']);
    assert.match(res.committed, /^[0-9a-f]+$/);
    assert.deepStrictEqual(
      statusLines(dir).sort(),
      [' M payments/discussion/topic-b.md', ' M payments/manifest.json'],
      'a work unit is none of the global state dir\'s business',
    );
  });

  it('reports nothing to commit on a clean scope, and refuses a second scope flag', () => {
    const clean = engine(dir, ['commit', 'payments', '--state', '-m', 'noop']);
    assert.strictEqual(clean.committed, null);
    assert.strictEqual(clean.note, 'nothing to commit');

    assert.match(engineFails(dir, ['commit', 'payments', '--state', '--discovery', '-m', 'x']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', 'payments', '--state', '-m', 'x', '--topic', 'discussion/topic-a']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', 'payments', '--state', '-m', 'x', '--plan', 'topic-a']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', '--state', '--inbox', '-m', 'x']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', '--state', '-m', 'x', '--topic', 'discussion/topic-a']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', 'no-such-unit', '--state', '-m', 'x']).error, /no work unit directory/);
  });

  it('never beats — an analysis is not a session sitting in a topic', () => {
    writeFile(dir, '.leeway/payments/.state/discussion-consolidation-analysis.md', '# Groupings\n');
    engine(dir, ['commit', 'payments', '--state', '-m', 'spec(payments): grouping analysis']);
    assert.ok(!fs.existsSync(path.join(dir, '.leeway/.cache/payments')), 'no heartbeat anywhere');
  });
});

describe('engine commit --plan: the planning topic plus the plan\'s storage', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('commits the planning topic and the declared storage, leaving foreign dirt behind', () => {
    const manifest = epicManifest();
    manifest.phases.planning = { items: { 'topic-a': { status: 'in-progress', storage_paths: ['plans/topic-a'] } } };
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
    writeFile(dir, 'plans/topic-a/tasks.md', '# Tasks\n');
    writeFile(dir, 'src/app.js', 'const x = 1;\n');
    commitAll(dir, 'plan storage');

    writeFile(dir, '.leeway/payments/planning/topic-a/planning.md', '# Plan\n');
    writeFile(dir, 'plans/topic-a/tasks.md', '# Tasks\n- one\n');
    writeFile(dir, 'src/app.js', 'const x = 2;\n');
    // A peer session mid-write, inside the same work unit.
    writeFile(dir, '.leeway/payments/discussion/topic-b.md', '# Topic B\npeer session dirt\n');

    const res = engine(dir, ['commit', 'payments', '-m', 'plan(payments): author', '--plan', 'topic-a']);

    assert.strictEqual(res.committed, stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(res.code_committed, git(dir, ['rev-parse', '--short', 'HEAD']).trim());
    assert.deepStrictEqual(headFiles(dir), ['payments/planning/topic-a/planning.md'], 'the planning topic rides the state');
    assert.deepStrictEqual(codeHeadFiles(dir), ['plans/topic-a/tasks.md'],
      'the declared storage rides the code tree — and code outside it never does');
    assert.deepStrictEqual(statusLines(dir), [' M payments/discussion/topic-b.md'],
      'a sibling topic inside the same work unit is not a planning session\'s to commit');
    assert.deepStrictEqual(codeStatusLines(dir), [' M src/app.js'], 'nor is code outside the plan\'s storage');
  });

  it('leaves a sibling planning topic alone', () => {
    const manifest = epicManifest();
    manifest.phases.planning = { items: {
      'topic-a': { status: 'in-progress', storage_paths: [] },
      'topic-b': { status: 'in-progress', storage_paths: [] },
    } };
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
    writeFile(dir, '.leeway/payments/planning/topic-a/planning.md', '# Plan A\n');
    writeFile(dir, '.leeway/payments/planning/topic-b/planning.md', '# Plan B\n');
    commitAll(dir, 'two plans');

    writeFile(dir, '.leeway/payments/planning/topic-a/planning.md', '# Plan A\nphase 1\n');
    writeFile(dir, '.leeway/payments/planning/topic-b/planning.md', '# Plan B\na peer planner mid-write\n');

    engine(dir, ['commit', 'payments', '-m', 'planning(payments): draft phase structure', '--plan', 'topic-a']);

    assert.ok(headFiles(dir).includes('payments/planning/topic-a/planning.md'));
    assert.deepStrictEqual(statusLines(dir), [' M payments/planning/topic-b/planning.md'],
      'the peer planning session keeps its own dirt');
  });

  it('leaves the knowledge store alone', () => {
    const manifest = epicManifest();
    manifest.phases.planning = { items: { 'topic-a': { status: 'in-progress', storage_paths: [] } } };
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
    // A conclusion in a peer session left the store mid-index.
    writeFile(dir, '.leeway/.knowledge/metadata.json', '{}\n');
    writeFile(dir, '.leeway/payments/planning/topic-a/planning.md', '# Plan\n');

    engine(dir, ['commit', 'payments', '-m', 'plan(payments): author', '--plan', 'topic-a']);

    assert.ok(!headFiles(dir).some((f) => f.startsWith('.knowledge/')), 'a plan pass never commits the store');
    assert.ok(fs.existsSync(path.join(dir, '.leeway/.knowledge/metadata.json')), 'which stays as it was on disk');
  });

  it('refuses a planning topic name that is a path', () => {
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--plan', '../escapee']).error, /invalid planning topic name/);
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--plan', 'a/b']).error, /invalid planning topic name/);
  });

  it('never takes another process\'s staged code', () => {
    const manifest = epicManifest();
    manifest.phases.planning = { items: { 'topic-a': { status: 'in-progress', storage_paths: [] } } };
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
    writeFile(dir, 'src/app.js', 'const x = 1;\n');
    commitAll(dir, 'code');

    writeFile(dir, '.leeway/payments/planning/topic-a/planning.md', '# Plan\n');
    writeFile(dir, 'src/app.js', 'const x = 2;\n');
    git(dir, ['add', '--', 'src/app.js']);

    const res = engine(dir, ['commit', 'payments', '-m', 'plan(payments): author', '--plan', 'topic-a']);

    assert.ok(headFiles(dir).includes('payments/planning/topic-a/planning.md'), 'the plan lands');
    assert.strictEqual(res.code_committed, null, 'staged code is not swept into a plan commit');
    assert.strictEqual(git(dir, ['diff', '--cached', '--name-only']).trim(), 'src/app.js', 'and stays staged');
  });
});

describe('engine commit --paths: the code commit', () => {
  const setup = fixtureFrom('engine-commit-', (at) => implementing(at, { 'src/other.js': 'const y = 1;\n', 'src/gone.js': 'const z = 1;\n' }));
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { cleanupFixture(dir); });

  const forTopic = ['--for', 'payments', 'implementation/topic-a'];

  it('commits the named paths and answers the dirt still outside .leeway', () => {
    writeFile(dir, 'src/app.js', 'const x = 2;\n');
    writeFile(dir, 'src/new.js', 'const n = 1;\n');
    writeFile(dir, 'src/other.js', 'const y = 2;\n');
    writeFile(dir, '.leeway/payments/discussion/topic-b.md', '# Topic B\na doc session\'s dirt\n');

    const res = engine(dir, ['commit', '--paths', 'src/app.js', 'src/new.js', '-m', 'feat(topic-a): the task', ...forTopic]);

    assert.deepStrictEqual(res.committed, [{ repo: '.', sha: git(dir, ['rev-parse', '--short', 'HEAD']).trim() }],
      'a project of one repo commits once, in the root');
    const files = codeHeadFiles(dir);
    assert.deepStrictEqual(files.sort(), ['src/app.js', 'src/new.js'], 'exactly the named paths — untracked included');
    assert.deepStrictEqual(res.left_dirty, ['src/other.js'],
      'the forgotten path is named; a doc session\'s .leeway dirt is its own');
  });

  it('records a task\'s deletion and beats the named code topic', () => {
    fs.unlinkSync(path.join(dir, 'src/gone.js'));

    const res = engine(dir, ['commit', '--paths', 'src/gone.js', '-m', 'refactor(topic-a): drop the module', ...forTopic]);

    assert.ok(codeHeadFiles(dir).includes('src/gone.js'), 'the deletion rides the commit');
    assert.deepStrictEqual(res.left_dirty, []);
    assert.ok(fs.existsSync(path.join(dir, '.leeway/.cache/payments/implementation/topic-a/presence')),
      '--for beats the code topic');
  });

  it('carries a staged rename, and reads the residual dirt past its two-field record', () => {
    // `git status --porcelain -z` writes a rename as one record with TWO
    // NUL-separated paths. Miscounting there would misread every path after
    // it, so `left_dirty` would name files the task never touched.
    git(dir, ['mv', 'src/other.js', 'src/renamed.js']);
    writeFile(dir, 'src/left-behind.js', '// not this task\n');

    const res = engine(dir, ['commit', '--paths', 'src/other.js', 'src/renamed.js',
      '-m', 'refactor(topic-a): move the module', ...forTopic]);

    assert.deepStrictEqual(
      git(dir, ['show', '--name-only', '--no-renames', '--pretty=format:', 'HEAD']).trim().split('\n').filter(Boolean).sort(),
      ['src/other.js', 'src/renamed.js'], 'both sides of the rename ride the commit');
    assert.deepStrictEqual(res.left_dirty, ['src/left-behind.js'],
      'the rename record is consumed whole — nothing after it shifts');
  });

  it('answers nothing to commit when the named paths are clean', () => {
    const res = engine(dir, ['commit', '--paths', 'src/app.js', '-m', 'noop', ...forTopic]);
    assert.deepStrictEqual(res.committed, []);
    assert.strictEqual(res.note, 'nothing to commit');
  });

  it('takes every path literally — a routing file is that file, never a pattern its siblings match', () => {
    const named = ['app/[id]/page.tsx', 'app/(marketing)/page.tsx', 'src/a*b?.js', ':notes.md'];
    for (const rel of [...named, 'app/i/page.tsx', 'app/d/page.tsx', 'src/aXbY.js']) writeFile(dir, rel, `// ${rel}\n`);

    const res = engine(dir, ['commit', '--paths', ...named, '-m', 'feat(topic-a): the routes', ...forTopic]);

    assert.deepStrictEqual(codeHeadFiles(dir).sort(), [...named].sort(), 'exactly the named files');
    assert.deepStrictEqual(res.left_dirty, ['app/d/page.tsx', 'app/i/page.tsx', 'src/aXbY.js'],
      'the siblings a glob would have matched stay uncommitted, named as they are');
    assert.deepStrictEqual(engine(dir, ['code', 'status']).files,
      res.left_dirty.map((rel) => ({ path: rel, status: '??' })), 'code status names them as they are too');
  });

  it('takes a tracked path literally through its edit, its deletion, a staged removal and a retry', () => {
    for (const rel of ['app/[slug]/page.tsx', 'app/[slug]/old.tsx', 'app/(shop)/cart.tsx', 'app/s/page.tsx', 'app/s/old.tsx']) {
      writeFile(dir, rel, `// ${rel}\n`);
    }
    commitAll(dir, 'routes');
    for (const rel of ['app/[slug]/page.tsx', 'app/s/page.tsx', 'app/s/old.tsx']) writeFile(dir, rel, '// edited\n');
    fs.unlinkSync(path.join(dir, 'app/[slug]/old.tsx'));
    git(dir, ['rm', '-q', '--', ':(literal)app/(shop)/cart.tsx']);
    const call = ['commit', '--paths', 'app/[slug]/page.tsx', 'app/[slug]/old.tsx', 'app/(shop)/cart.tsx',
      '-m', 'feat(topic-a): the slug route', ...forTopic];

    const res = engine(dir, call);

    assert.deepStrictEqual(git(dir, ['show', '--name-status', '--pretty=format:', 'HEAD']).trim().split('\n').sort(),
      ['D\tapp/(shop)/cart.tsx', 'D\tapp/[slug]/old.tsx', 'M\tapp/[slug]/page.tsx']);
    assert.deepStrictEqual(res.left_dirty, ['app/s/old.tsx', 'app/s/page.tsx']);

    const again = engine(dir, call);
    assert.deepStrictEqual(again.committed, [], 'the HEAD commit\'s own deletions pass the retry, with nothing left');
  });

  it('refuses a literal path git cannot stage or does not hold — a sibling its pattern would match stands in for none', () => {
    writeFile(dir, '.gitignore', '.leeway/\n*.log\n');
    writeFile(dir, 'app/[id]/debug.log', 'noise\n');
    writeFile(dir, 'app/x/page.tsx', '// a sibling\n');
    commitAll(dir, 'routes');
    fs.symlinkSync('app', path.join(dir, 'alias'));
    writeFile(dir, 'app/[id]/page.tsx', '// the route\n');

    assert.strictEqual(engineFails(dir, ['commit', '--paths', 'app/[id]/debug.log', '-m', 'x', ...forTopic]).error,
      'commit --paths: git in . refuses to stage "app/[id]/debug.log" (an ignore rule, or a path beyond a symbolic link)');
    assert.strictEqual(engineFails(dir, ['commit', '--paths', 'alias/[id]/page.tsx', '-m', 'x', ...forTopic]).error,
      'commit --paths: git in . refuses to stage "alias/[id]/page.tsx" (an ignore rule, or a path beyond a symbolic link)');
    assert.strictEqual(engineFails(dir, ['commit', '--paths', 'app/[x]/page.tsx', '-m', 'x', ...forTopic]).error,
      'commit --paths: "app/[x]/page.tsx" is neither on disk nor tracked');
    assert.strictEqual(git(dir, ['diff', '--cached', '--name-only']).trim(), '', 'a refusal stages nothing');
  });

  it('refuses escapes, workflow artifacts, and a missing target', () => {
    assert.match(engineFails(dir, ['commit', '--paths', '../elsewhere.js', '-m', 'x', ...forTopic]).error, /resolves outside the project/);
    assert.match(engineFails(dir, ['commit', '--paths', '/etc/hosts', '-m', 'x', ...forTopic]).error, /resolves outside the project/);
    assert.strictEqual(engineFails(dir, ['commit', '--paths', '.leeway/payments/discussion/topic-a.md', '-m', 'x', ...forTopic]).error,
      'commit --paths: ".leeway/payments/discussion/topic-a.md" is in the workflows\' state — it commits by its own scope (--topic/--discovery/--plan)');
    assert.match(engineFails(dir, ['commit', '--paths', 'src/never-written.js', '-m', 'x', ...forTopic]).error, /neither on disk nor tracked/);
    assert.match(engineFails(dir, ['commit', '--paths', '-m', 'x', ...forTopic]).error, /Usage/);
    assert.match(engineFails(dir, ['commit', '--paths', 'src/app.js', '-m', 'x']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', '--paths', 'src/app.js', '-m', 'x', '--for', 'payments', 'discussion/topic-a']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', '--paths', 'src/app.js', '--for', 'payments', 'review/topic-a']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', 'payments', '--paths', 'src/app.js', '-m', 'x', ...forTopic]).error, /Usage/);
    assert.strictEqual(codeStatusLines(dir).length, 0, 'a refusal touches nothing');
  });

  it('names a path in the state as in the state from a code worktree too, never as outside the project', () => {
    const wt = `${dir}-side`;
    git(dir, ['worktree', 'add', '-q', '-b', 'side', wt]);
    try {
      const inState = path.join(dir, '.leeway/payments/discussion/topic-a.md');
      assert.strictEqual(harness.refuses(wt, ['commit', '--paths', inState, '-m', 'x', ...forTopic]).error,
        `commit --paths: "${inState}" is in the workflows' state — it commits by its own scope (--topic/--discovery/--plan)`);
    } finally {
      cleanupFixture(wt);
    }
  });

  it('refuses a --for target that does not exist — the phantom-hold repro', () => {
    // The commit beats what --for names. A typo there mints a hold on a topic
    // no session owns and no session-end sweeps, and the checkout's code slot
    // then reads taken forever. It must refuse before anything is staged.
    writeFile(dir, 'src/app.js', 'const x = 2;\n');

    assert.match(engineFails(dir, ['commit', '--paths', 'src/app.js', '-m', 'x',
      '--for', 'payments', 'implementation/topic-typo']).error,
    /no implementation item "topic-typo" in "payments"/);
    assert.match(engineFails(dir, ['commit', '--paths', 'src/app.js', '-m', 'x',
      '--for', 'no-such-unit', 'implementation/topic-a']).error,
    /no work unit directory/);
    assert.match(engineFails(dir, ['commit', '--paths', 'src/app.js', '-m', 'x',
      '--for', 'payments', 'implementation/..']).error,
    /invalid topic name/);
    assert.match(engineFails(dir, ['commit', '--paths', 'src/app.js', '-m', 'x',
      '--for', '../escapee', 'implementation/topic-a']).error,
    /invalid work unit name/);

    assert.ok(!fs.existsSync(path.join(dir, '.leeway/.cache/payments/implementation/topic-typo')),
      'no ghost heartbeat is minted');
    assert.deepStrictEqual(codeStatusLines(dir), [' M src/app.js'], 'a refusal stages nothing');
  });

  it('refuses a path deleted long before — only the HEAD commit\'s own deletion passes', () => {
    fs.unlinkSync(path.join(dir, 'src/gone.js'));
    commitAll(dir, 'drop the module');
    writeFile(dir, 'src/app.js', 'const x = 2;\n');
    commitAll(dir, 'later work');

    assert.match(engineFails(dir, ['commit', '--paths', 'src/gone.js', '-m', 'x', ...forTopic]).error,
      /"src\/gone\.js" is neither on disk nor tracked/);
  });

  it('commits in a project nested in its repository under the project\'s own directory, reading only its own folder', () => {
    const repo = harness.setupGitFixture('engine-commit-nested-paths-');
    try {
      const project = path.join(repo, 'apps/web');
      const manifest = epicManifest();
      manifest.phases.implementation = { items: { 'topic-a': { status: 'in-progress' } } };
      writeFile(repo, '.leeway/payments/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
      writeFile(project, 'src/app.js', 'const x = 1;\n');
      writeFile(repo, 'other/x.js', 'const s = 1;\n');
      commitAll(repo, 'init');
      writeFile(project, 'src/app.js', 'const x = 2;\n');
      writeFile(project, 'src/leftover.js', 'const l = 1;\n');
      writeFile(repo, '.leeway/payments/discussion/topic-b.md', '# a doc session\'s own\n');
      writeFile(repo, 'other/x.js', 'const s = 2;\n');

      const res = engine(project, ['commit', '--paths', 'src/app.js', '-m', 'feat(topic-a): the task', ...forTopic]);

      assert.deepStrictEqual(res.committed, [{ repo: '.', sha: git(repo, ['rev-parse', '--short', 'HEAD']).trim() }]);
      assert.deepStrictEqual(codeHeadFiles(repo), ['apps/web/src/app.js']);
      assert.deepStrictEqual(res.left_dirty, ['src/leftover.js'],
        'named from the project — never a sibling folder\'s dirt, never the state\'s');
    } finally {
      cleanupFixture(repo);
    }
  });
});

describe('engine commit --paths: code in repos of its own', () => {
  const setup = fixtureFrom('engine-commit-', (at) => {
    implementing(at, { '.gitignore': '.leeway/\napi/\n' });
    // An ignored clone: a repo of its own that the root's .gitignore lists.
    const clone = harness.initRepo(path.join(at, 'api'));
    writeFile(clone, 'src/handler.js', 'const h = 1;\n');
    writeFile(clone, 'src/other.js', 'const o = 1;\n');
    writeFile(clone, 'src/old.js', 'const d = 1;\n');
    commitAll(clone, 'init');
  });
  let dir;
  let api;
  beforeEach(() => {
    dir = setup();
    api = path.join(dir, 'api');
  });
  afterEach(() => { cleanupFixture(dir); });

  const forTopic = ['--for', 'payments', 'implementation/topic-a'];
  const head = (repo) => git(repo, ['rev-parse', '--short', 'HEAD']).trim();
  const subject = (repo) => git(repo, ['log', '-1', '--format=%s']).trim();
  /** The commit the root's HEAD records for a submodule. */
  const pointer = (rel) => git(dir, ['rev-parse', `HEAD:${rel}`]).trim();
  /** A pre-commit hook in the repo that refuses every commit. */
  const refusingHook = (repo, name) => {
    const hook = path.join(repo, '.git/hooks/pre-commit');
    fs.mkdirSync(path.dirname(hook), { recursive: true });
    fs.writeFileSync(hook, `#!/bin/sh\necho "the ${name} hook refuses" >&2\nexit 1\n`, { mode: 0o755 });
    return hook;
  };

  it('commits each path in the repo that owns it — one call, a commit per repo, one message, the nested repo first', () => {
    writeFile(dir, 'src/app.js', 'const x = 2;\n');
    writeFile(api, 'src/handler.js', 'const h = 2;\n');
    writeFile(api, 'src/new.js', 'const n = 1;\n');

    const res = engine(dir, ['commit', '--paths', 'src/app.js', 'api/src/handler.js', 'api/src/new.js',
      '-m', 'feat(topic-a): the task', ...forTopic]);

    assert.deepStrictEqual(res.committed, [{ repo: 'api', sha: head(api) }, { repo: '.', sha: head(dir) }]);
    assert.deepStrictEqual(codeHeadFiles(dir), ['src/app.js']);
    assert.deepStrictEqual(codeHeadFiles(api).sort(), ['src/handler.js', 'src/new.js']);
    assert.deepStrictEqual([subject(dir), subject(api)], ['feat(topic-a): the task', 'feat(topic-a): the task']);
    assert.deepStrictEqual(res.left_dirty, []);
  });

  it('takes a path in a nested repo literally — a routing file in a clone or a submodule is that file', () => {
    const sdk = harness.addSubmodule(dir, 'sdk', api);
    const named = ['api/app/[id]/page.tsx', 'api/app/(marketing)/page.tsx', 'sdk/routes/[slug]/+page.svelte'];
    for (const rel of [...named, 'api/app/i/page.tsx', 'sdk/routes/s/+page.svelte']) writeFile(dir, rel, `// ${rel}\n`);

    const res = engine(dir, ['commit', '--paths', ...named, '-m', 'feat(topic-a): the routes', ...forTopic]);

    assert.deepStrictEqual(res.committed, [{ repo: 'api', sha: head(api) }, { repo: 'sdk', sha: head(sdk) }, { repo: '.', sha: head(dir) }]);
    assert.deepStrictEqual(codeHeadFiles(api).sort(), ['app/(marketing)/page.tsx', 'app/[id]/page.tsx']);
    assert.deepStrictEqual(codeHeadFiles(sdk), ['routes/[slug]/+page.svelte']);
    assert.deepStrictEqual(codeHeadFiles(dir), ['sdk'], 'the submodule\'s new pointer, and nothing else');
    assert.deepStrictEqual(res.left_dirty, ['api/app/i/page.tsx', 'sdk/routes/s/+page.svelte']);
  });

  it('carries no pathspec magic into a nested repo — a name opening on a colon is that file, or not on disk', () => {
    writeFile(api, ':weird.txt', 'odd\n');
    writeFile(api, 'weird.txt', 'plain\n');
    writeFile(api, 'keep.txt', 'kept\n');
    writeFile(api, 'src/handler.js', 'const h = 2;\n');
    const apiBefore = head(api);

    assert.strictEqual(engineFails(dir, ['commit', '--paths', 'api/:(exclude)keep.txt', '-m', 'x', ...forTopic]).error,
      'commit --paths: "api/:(exclude)keep.txt" is neither on disk nor tracked');
    assert.strictEqual(head(api), apiBefore, 'never a sweep of the clone');

    const res = engine(dir, ['commit', '--paths', 'api/:weird.txt', '-m', 'feat(topic-a): the odd file', ...forTopic]);

    assert.deepStrictEqual(res.committed, [{ repo: 'api', sha: head(api) }]);
    assert.deepStrictEqual(codeHeadFiles(api), [':weird.txt']);
    assert.deepStrictEqual(res.left_dirty.sort(), ['api/keep.txt', 'api/src/handler.js', 'api/weird.txt']);
  });

  it('commits a nested repo\'s paths alone — the root gains no commit', () => {
    const rootBefore = head(dir);
    writeFile(api, 'src/handler.js', 'const h = 2;\n');

    const res = engine(dir, ['commit', '--paths', 'api/src/handler.js', '-m', 'feat(topic-a): the task', ...forTopic]);

    assert.deepStrictEqual(res.committed, [{ repo: 'api', sha: head(api) }]);
    assert.strictEqual(head(dir), rootBefore);
    assert.ok(fs.existsSync(path.join(dir, '.leeway/.cache/payments/implementation/topic-a/presence')),
      'the commit beats the code topic once, in the project');
  });

  it('answers every repo\'s leftover in left_dirty, project-relative — never a parent\'s view of a nested repo', () => {
    const web = harness.initRepo(path.join(dir, 'web'));
    writeFile(web, 'index.js', 'const w = 1;\n');
    commitAll(web, 'init');
    writeFile(api, 'src/handler.js', 'const h = 2;\n');
    writeFile(api, 'src/other.js', 'const o = 2;\n');
    writeFile(web, 'index.js', 'const w = 2;\n');

    const res = engine(dir, ['commit', '--paths', 'api/src/handler.js', '-m', 'feat(topic-a): the task', ...forTopic]);

    assert.ok(codeStatusLines(dir).includes('?? web/'), 'the root\'s git names the untracked repo\'s folder');
    assert.deepStrictEqual(res.left_dirty, ['api/src/other.js', 'web/index.js']);
  });

  it('records a submodule\'s new pointer in its parent when the call reaches into it, the submodule first', () => {
    const sdk = harness.addSubmodule(dir, 'sdk', api);
    writeFile(sdk, 'src/handler.js', 'const h = 2;\n');
    writeFile(dir, 'src/app.js', 'const x = 2;\n');

    const both = engine(dir, ['commit', '--paths', 'src/app.js', 'sdk/src/handler.js', '-m', 'feat(topic-a): the task', ...forTopic]);

    assert.deepStrictEqual(both.committed, [{ repo: 'sdk', sha: head(sdk) }, { repo: '.', sha: head(dir) }]);
    assert.deepStrictEqual(codeHeadFiles(dir).sort(), ['sdk', 'src/app.js']);
    assert.strictEqual(pointer('sdk'), git(sdk, ['rev-parse', 'HEAD']).trim(), 'the gitlink records the submodule\'s new HEAD');
    assert.deepStrictEqual(both.left_dirty, []);

    writeFile(sdk, 'src/other.js', 'const o = 2;\n');
    const alone = engine(dir, ['commit', '--paths', 'sdk/src/other.js', '-m', 'feat(topic-a): the rest', ...forTopic]);

    assert.deepStrictEqual(alone.committed, [{ repo: 'sdk', sha: head(sdk) }, { repo: '.', sha: head(dir) }],
      'a call naming the submodule alone records its pointer too');
    assert.deepStrictEqual(codeHeadFiles(dir), ['sdk']);
    assert.strictEqual(pointer('sdk'), git(sdk, ['rev-parse', 'HEAD']).trim());

    writeFile(sdk, 'scratch.txt', 'stray\n');
    const again = engine(dir, ['commit', '--paths', 'sdk/src/other.js', '-m', 'feat(topic-a): the rest', ...forTopic]);

    assert.deepStrictEqual(again.committed, [], 'work uncommitted inside the submodule is no pointer to record');
    assert.strictEqual(again.note, 'nothing to commit');
  });

  it('refuses a call that would commit in a repo on a detached HEAD, before any repo commits', () => {
    const sdk = harness.addSubmodule(dir, 'sdk', api);
    const branch = git(sdk, ['symbolic-ref', '--short', 'HEAD']).trim();
    git(sdk, ['checkout', '-q', '--detach']);
    writeFile(sdk, 'src/handler.js', 'const h = 2;\n');
    writeFile(dir, 'src/app.js', 'const x = 2;\n');
    const call = ['commit', '--paths', 'src/app.js', 'sdk/src/handler.js', '-m', 'feat(topic-a): the task', ...forTopic];
    const [rootBefore, sdkBefore] = [head(dir), head(sdk)];

    assert.strictEqual(engineFails(dir, call).error,
      'commit --paths: sdk is on a detached HEAD — check out a branch there, then run the commit again');
    assert.deepStrictEqual([head(dir), head(sdk)], [rootBefore, sdkBefore], 'nothing commits in any repo');

    git(sdk, ['checkout', '-q', branch]);
    git(dir, ['checkout', '-q', '--detach']);

    assert.strictEqual(engineFails(dir, ['commit', '--paths', 'sdk/src/handler.js', '-m', 'feat(topic-a): the task', ...forTopic]).error,
      'commit --paths: . is on a detached HEAD — check out a branch there, then run the commit again',
      'the parent a reached submodule\'s pointer lands in is checked too');
    assert.strictEqual(head(sdk), sdkBefore);

    git(dir, ['checkout', '-q', '-']);
    const landed = engine(dir, call);

    assert.deepStrictEqual(landed.committed, [{ repo: 'sdk', sha: head(sdk) }, { repo: '.', sha: head(dir) }]);
    assert.deepStrictEqual(codeHeadFiles(dir).sort(), ['sdk', 'src/app.js']);
  });

  it('refuses a call that would commit in a repo mid-operation — a rebase in a submodule, a merge in the root — before any repo commits', () => {
    const sdk = harness.addSubmodule(dir, 'sdk', api);
    writeFile(sdk, 'src/handler.js', 'const h = 2;\n');
    commitAll(sdk, 'the submodule moves on');
    assert.throws(() => git(sdk, ['rebase', '-q', '--exec', 'false', 'HEAD~1']), 'the rebase stops at its failing exec');
    writeFile(sdk, 'src/other.js', 'const o = 2;\n');
    writeFile(dir, 'src/app.js', 'const x = 2;\n');
    const [rootBefore, sdkBefore] = [head(dir), head(sdk)];

    assert.strictEqual(engineFails(dir, ['commit', '--paths', 'src/app.js', 'sdk/src/other.js', '-m', 'feat(topic-a): the task', ...forTopic]).error,
      'commit --paths: a rebase is in progress in sdk (rebase-merge) — finish or abort it there, then run the commit again',
      'never read as the detached HEAD the rebase leaves');
    assert.deepStrictEqual([head(dir), head(sdk)], [rootBefore, sdkBefore], 'nothing commits in any repo');

    git(sdk, ['rebase', '--abort']);
    git(dir, ['checkout', '-q', '-b', 'side']);
    writeFile(dir, 'src/side.js', 'const s = 1;\n');
    commitAll(dir, 'the side');
    git(dir, ['checkout', '-q', '-']);
    git(dir, ['merge', '-q', '--no-ff', '--no-commit', 'side']);
    writeFile(api, 'src/handler.js', 'const h = 3;\n');
    const apiBefore = head(api);

    assert.strictEqual(engineFails(dir, ['commit', '--paths', 'src/app.js', 'api/src/handler.js', '-m', 'feat(topic-a): the task', ...forTopic]).error,
      'commit --paths: a merge is in progress in . (MERGE_HEAD) — finish or abort it there, then run the commit again');
    assert.deepStrictEqual([head(dir), head(api)], [rootBefore, apiBefore], 'the clone, whose commit would come first, made none');
  });

  it('never checks a repo the call does not commit in — a detached clone blocks nothing elsewhere', () => {
    git(api, ['checkout', '-q', '--detach']);
    writeFile(dir, 'src/app.js', 'const x = 2;\n');

    const res = engine(dir, ['commit', '--paths', 'src/app.js', '-m', 'feat(topic-a): the task', ...forTopic]);

    assert.deepStrictEqual(res.committed, [{ repo: '.', sha: head(dir) }]);
  });

  it('commits beside a folder whose .git is a dangling link — no repo, never a failure', () => {
    writeFile(dir, '.gitignore', '.leeway/\napi/\nbroken/\n');
    commitAll(dir, 'the broken folder is ignored');
    fs.mkdirSync(path.join(dir, 'broken'));
    fs.symlinkSync(path.join(dir, 'nowhere'), path.join(dir, 'broken/.git'));
    writeFile(dir, 'src/app.js', 'const x = 2;\n');

    const res = engine(dir, ['commit', '--paths', 'src/app.js', '-m', 'feat(topic-a): the task', ...forTopic]);

    assert.deepStrictEqual(res.committed, [{ repo: '.', sha: head(dir) }]);
    assert.deepStrictEqual(res.left_dirty, []);
  });

  it('records the pointer of a submodule the call reaches into inside a folder the call also names', () => {
    const sub = harness.addSubmodule(dir, 'packages/sub', api);
    writeFile(dir, 'packages/readme.txt', 'the packages\n');
    writeFile(sub, 'lib.txt', 'a library\n');

    const res = engine(dir, ['commit', '--paths', 'packages', 'packages/sub/lib.txt', '-m', 'feat(topic-a): the task', ...forTopic]);

    assert.deepStrictEqual(res.committed, [{ repo: 'packages/sub', sha: head(sub) }, { repo: '.', sha: head(dir) }]);
    assert.deepStrictEqual(codeHeadFiles(dir).sort(), ['packages/readme.txt', 'packages/sub']);
    assert.strictEqual(pointer('packages/sub'), git(sub, ['rev-parse', 'HEAD']).trim());
    assert.deepStrictEqual(codeStatusLines(dir), []);
  });

  it('never commits a nested repo in its parent the call did not reach into — an untouched submodule, an untracked repo', () => {
    const sdk = harness.addSubmodule(dir, 'sdk', api);
    const before = pointer('sdk');
    writeFile(sdk, 'src/handler.js', 'const h = 2;\n');
    commitAll(sdk, 'the submodule moves on its own');
    writeFile(dir, 'src/app.js', 'const x = 2;\n');

    const res = engine(dir, ['commit', '--paths', 'src/app.js', '-m', 'feat(topic-a): the task', ...forTopic]);

    assert.deepStrictEqual(res.committed, [{ repo: '.', sha: head(dir) }]);
    assert.deepStrictEqual(codeHeadFiles(dir), ['src/app.js']);
    assert.strictEqual(pointer('sdk'), before, 'the untouched gitlink stays where it was');
    assert.ok(codeStatusLines(dir).includes(' M sdk'), 'the moved pointer is the root\'s git to see');
    assert.deepStrictEqual(res.left_dirty, [], 'and never dirt');

    writeFile(dir, 'packages/notes.txt', 'loose\n');
    const kit = harness.initRepo(path.join(dir, 'packages/kit'));
    writeFile(kit, 'kit.js', 'const k = 1;\n');
    commitAll(kit, 'init');

    const folder = engine(dir, ['commit', '--paths', 'packages', '-m', 'chore(topic-a): the notes', ...forTopic]);

    assert.deepStrictEqual(folder.committed, [{ repo: '.', sha: head(dir) }]);
    assert.deepStrictEqual(codeHeadFiles(dir), ['packages/notes.txt'], 'the folder\'s files ride, the repo inside it never does');
    assert.strictEqual(git(dir, ['ls-files', '--stage', '--', 'packages/kit']).trim(), '', 'no gitlink staged for the untracked repo');
  });

  it('commits beside a submodule its parent ignores, and records that submodule\'s pointer when the call reaches into it', () => {
    writeFile(dir, '.gitignore', '.leeway/\napi/\nvendor/\n');
    commitAll(dir, 'the vendor folder is ignored');
    const sdk = harness.addSubmodule(dir, 'vendor/sdk', api, { force: true });
    const before = pointer('vendor/sdk');
    writeFile(sdk, 'src/handler.js', 'const h = 2;\n');
    commitAll(sdk, 'the submodule moves on its own');
    writeFile(dir, 'index.js', 'const i = 1;\n');

    const beside = engine(dir, ['commit', '--paths', 'index.js', '-m', 'feat(topic-a): the task', ...forTopic]);

    assert.deepStrictEqual(beside.committed, [{ repo: '.', sha: head(dir) }]);
    assert.deepStrictEqual(codeHeadFiles(dir), ['index.js']);
    assert.strictEqual(pointer('vendor/sdk'), before);
    assert.strictEqual(git(dir, ['diff', '--cached', '--name-only']).trim(), '', 'nothing is left staged');

    writeFile(sdk, 'src/other.js', 'const o = 2;\n');
    const into = engine(dir, ['commit', '--paths', 'vendor/sdk/src/other.js', '-m', 'feat(topic-a): the rest', ...forTopic]);

    assert.deepStrictEqual(into.committed, [{ repo: 'vendor/sdk', sha: head(sdk) }, { repo: '.', sha: head(dir) }]);
    assert.strictEqual(pointer('vendor/sdk'), git(sdk, ['rev-parse', 'HEAD']).trim(), 'the pointer lands without being added');
  });

  it('names the repo whose commit failed, and the commits already made', () => {
    writeFile(api, 'src/handler.js', 'const h = 2;\n');
    const hook = refusingHook(api, 'api');

    assert.strictEqual(engineFails(dir, ['commit', '--paths', 'api/src/handler.js', '-m', 'x', ...forTopic]).error,
      'the commit in api failed: git commit failed: the api hook refuses');

    fs.rmSync(hook);
    writeFile(dir, 'src/app.js', 'const x = 2;\n');
    refusingHook(dir, 'root');

    assert.strictEqual(engineFails(dir, ['commit', '--paths', 'src/app.js', 'api/src/handler.js', '-m', 'x', ...forTopic]).error,
      `the commit in . failed after api committed ${head(api)} — re-running the same call commits the rest: git commit failed: the root hook refuses`);
  });

  it('re-running a call one repo failed is the retry — a deletion a nested repo already committed answers nothing', () => {
    fs.unlinkSync(path.join(api, 'src/old.js'));
    writeFile(dir, 'src/app.js', 'const x = 2;\n');
    const hook = refusingHook(dir, 'root');
    const call = ['commit', '--paths', 'api/src/old.js', 'src/app.js', '-m', 'feat(topic-a): the task', ...forTopic];
    const rootBefore = head(dir);

    engineFails(dir, call);

    const apiSha = head(api);
    assert.strictEqual(git(api, ['show', '--name-status', '--pretty=format:', 'HEAD']).trim(), 'D\tsrc/old.js',
      'the clone committed the deletion before the root failed');
    assert.strictEqual(head(dir), rootBefore, 'the root committed nothing');

    fs.rmSync(hook);
    const retried = engine(dir, call);

    assert.deepStrictEqual(retried.committed, [{ repo: '.', sha: head(dir) }], 'the clone has nothing left in the paths');
    assert.strictEqual(head(api), apiSha);
    assert.deepStrictEqual(codeHeadFiles(dir), ['src/app.js']);
    assert.deepStrictEqual(retried.left_dirty, []);
  });

  it('re-running the call picks up a submodule\'s pointer its parent failed to record', () => {
    const sdk = harness.addSubmodule(dir, 'sdk', api);
    writeFile(sdk, 'src/handler.js', 'const h = 2;\n');
    const hook = refusingHook(dir, 'root');
    const call = ['commit', '--paths', 'sdk/src/handler.js', '-m', 'feat(topic-a): the task', ...forTopic];

    assert.match(engineFails(dir, call).error, new RegExp(`^the commit in \\. failed after sdk committed ${head(sdk)} — `));

    fs.rmSync(hook);
    const retried = engine(dir, call);

    assert.deepStrictEqual(retried.committed, [{ repo: '.', sha: head(dir) }], 'the submodule has nothing left; its pointer has');
    assert.strictEqual(pointer('sdk'), git(sdk, ['rev-parse', 'HEAD']).trim());
  });

  it('checks every path in the repo that owns it before any repo commits', () => {
    writeFile(dir, '.gitignore', '.leeway/\napi/\n*.log\n');
    commitAll(dir, 'logs are ignored');
    writeFile(api, 'src/handler.js', 'const h = 2;\n');
    writeFile(dir, 'debug.log', 'noise\n');
    const apiBefore = head(api);

    assert.strictEqual(engineFails(dir, ['commit', '--paths', 'api/src/handler.js', 'debug.log', '-m', 'x', ...forTopic]).error,
      'commit --paths: git in . refuses to stage "debug.log" (an ignore rule, or a path beyond a symbolic link)');
    assert.strictEqual(head(api), apiBefore, 'the clone, whose commit would come first, made none');
    assert.strictEqual(git(api, ['diff', '--cached', '--name-only']).trim(), '', 'and staged nothing');

    writeFile(dir, 'src/app.js', 'const x = 2;\n');
    const rootBefore = head(dir);

    assert.match(engineFails(dir, ['commit', '--paths', 'src/app.js', 'api/src/never-written.js', '-m', 'x', ...forTopic]).error,
      /"api\/src\/never-written\.js" is neither on disk nor tracked/);
    assert.strictEqual(head(dir), rootBefore);
    assert.deepStrictEqual(codeStatusLines(dir), [' M src/app.js'], 'a refusal stages nothing');

    writeFile(dir, '.gitignore', '.leeway/\napi/\n*.log\nlib/gen/\n');
    commitAll(dir, 'generated code is ignored');
    harness.addSubmodule(dir, 'lib/gen/sdk', api, { force: true });
    writeFile(dir, 'lib/util.js', 'const u = 1;\n');

    assert.strictEqual(engineFails(dir, ['commit', '--paths', 'api/src/handler.js', 'lib', '-m', 'x', ...forTopic]).error,
      'commit --paths: git in . refuses to stage "lib" (an ignore rule, or a path beyond a symbolic link)',
      'a folder holding a submodule its parent ignores is checked as the commit would stage it');
    assert.strictEqual(head(api), apiBefore);

    git(api, ['rm', '-q', '--', 'src/old.js']);
    const res = engine(dir, ['commit', '--paths', 'api/src/old.js', '-m', 'refactor(topic-a): drop the module', ...forTopic]);

    assert.deepStrictEqual(res.committed, [{ repo: 'api', sha: head(api) }], 'a deletion staged in the clone is its to commit');
    assert.deepStrictEqual(git(api, ['show', '--name-status', '--pretty=format:', 'HEAD']).trim(), 'D\tsrc/old.js');
  });
});

describe('engine commit --migrations: the state and the paths the workflows own', () => {
  const setup = fixtureFrom('engine-commit-', (at) => {
    writeFile(at, '.leeway/payments/manifest.json', '{"name":"payments"}\n');
    writeFile(at, '.claude/settings.json', '{}\n');
    writeFile(at, '.worktreeinclude', '.leeway/.knowledge/store.bin\n');
    writeFile(at, '.gitignore', '.leeway/\nnode_modules\n');
    writeFile(at, 'src/app.js', 'const x = 1;\n');
    commitAll(at, 'init');
  });
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { cleanupFixture(dir); });

  const migrate = (message = 'chore: apply workflow migrations') => engine(dir, ['commit', '--migrations', '-m', message]);

  /** `git show --name-status` of the code tree's HEAD, sorted. */
  function headChanges() {
    return git(dir, ['show', '--name-status', '--pretty=format:', 'HEAD']).trim().split('\n').filter(Boolean).sort();
  }

  /** `git show --name-status` of the state branch's HEAD, sorted. */
  function stateChanges() {
    return stateGit(dir, ['show', '--name-status', '--pretty=format:', 'HEAD']).trim().split('\n').filter(Boolean).sort();
  }

  const codeHead = () => git(dir, ['rev-parse', '--short', 'HEAD']).trim();
  const stateHead = () => stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim();

  it('commits the whole state on its branch and every owned code path on the code branch — one commit each, nothing else', () => {
    writeFile(dir, '.claude/settings.json', '{"permissions":{}}\n');
    fs.unlinkSync(path.join(dir, '.worktreeinclude'));
    writeFile(dir, '.gitignore', '.leeway/\nnode_modules\n.DS_Store\n');
    writeFile(dir, '.leeway/payments/manifest.json', '{"name":"payments","v":2}\n');
    writeFile(dir, '.leeway/.state/migrations', '062\n');
    writeFile(dir, '.leeway/.knowledge/store.bin', 'local store\n');
    writeFile(dir, '.leeway/.cache/payments/state.json', '{}\n');
    writeFile(dir, 'src/app.js', 'const x = 2;\n');
    writeFile(dir, 'src/new.js', 'const n = 1;\n');

    const res = migrate();

    assert.deepStrictEqual(res, { ok: true, committed: stateHead(), code_committed: codeHead() });
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'chore: apply workflow migrations');
    assert.strictEqual(stateGit(dir, ['log', '-1', '--pretty=%s']).trim(), 'chore: apply workflow migrations');
    assert.deepStrictEqual(headChanges(), ['D\t.worktreeinclude', 'M\t.claude/settings.json', 'M\t.gitignore']);
    assert.deepStrictEqual(stateChanges(), ['A\t.state/migrations', 'M\tpayments/manifest.json']);
    assert.deepStrictEqual(codeStatusLines(dir).sort(), [' M src/app.js', '?? src/new.js'], 'code stays as it was');
    assert.deepStrictEqual(statusLines(dir), [], 'and the ignored store and cache stay out of the state');
    assert.strictEqual(stateGit(dir, ['ls-files', '--', '.knowledge', '.cache']).trim(), '');
  });

  it('commits one side alone where only it changed', () => {
    writeFile(dir, '.leeway/payments/manifest.json', '{"name":"payments","v":2}\n');
    const before = codeHead();
    assert.deepStrictEqual(migrate(), { ok: true, committed: stateHead(), code_committed: null });
    assert.strictEqual(codeHead(), before, 'the code branch takes no state commit');

    writeFile(dir, '.claude/settings.json', '{"hooks":{}}\n');
    const state = stateHead();
    assert.deepStrictEqual(migrate(), { ok: true, committed: null, code_committed: codeHead() });
    assert.strictEqual(stateHead(), state);
  });

  it('records a removal a migration staged in the code tree, the file left on disk', () => {
    writeFile(dir, '.gitignore', '.leeway/\nnode_modules\n.worktreeinclude\n');
    git(dir, ['add', '--', '.gitignore']);
    git(dir, ['commit', '-q', '-m', 'the include is local now']);
    git(dir, ['rm', '-q', '--cached', '--', '.worktreeinclude']);

    migrate();

    assert.deepStrictEqual(headChanges(), ['D\t.worktreeinclude']);
    assert.strictEqual(git(dir, ['ls-files', '--', '.worktreeinclude']).trim(), '', 'no longer tracked');
    assert.ok(fs.existsSync(path.join(dir, '.worktreeinclude')), 'and still on disk');
    assert.deepStrictEqual(codeStatusLines(dir), []);
  });

  it('leaves another process\'s staged work out of the commit, still staged', () => {
    writeFile(dir, 'src/app.js', 'const x = 2;\n');
    git(dir, ['add', '--', 'src/app.js']);
    writeFile(dir, '.claude/settings.json', '{"hooks":{}}\n');

    migrate();

    assert.deepStrictEqual(headChanges(), ['M\t.claude/settings.json']);
    assert.strictEqual(git(dir, ['diff', '--cached', '--name-only']).trim(), 'src/app.js');
  });

  it('leaves an owned path the project ignores to git — never forced in', () => {
    writeFile(dir, '.gitignore', '.leeway/\nnode_modules\n.claude/\n');
    git(dir, ['rm', '-q', '--cached', '--', '.claude/settings.json']);
    commitAll(dir, 'the project ignores its Claude Code settings');
    writeFile(dir, '.claude/settings.json', '{"hooks":{}}\n');
    writeFile(dir, '.leeway/payments/manifest.json', '{"name":"payments","v":2}\n');

    const res = migrate();

    assert.strictEqual(res.code_committed, null);
    assert.deepStrictEqual(stateChanges(), ['M\tpayments/manifest.json']);
    assert.strictEqual(git(dir, ['ls-files', '--', '.claude']).trim(), '');
  });

  it('leaves a tracked file whose directory the project ignores as it is — the rest still commit', () => {
    writeFile(dir, '.gitignore', '.leeway/\nnode_modules\n.claude/\n');
    commitAll(dir, 'the project ignores .claude/ and still tracks its settings');
    writeFile(dir, '.claude/settings.json', '{"hooks":{}}\n');
    writeFile(dir, '.worktreeinclude', '.leeway/.knowledge/metadata.json\n');

    migrate();

    assert.deepStrictEqual(headChanges(), ['M\t.worktreeinclude']);
    assert.deepStrictEqual(codeStatusLines(dir), [' M .claude/settings.json']);
  });

  it('leaves settings beyond a symbolic link as they are — the rest still commit', () => {
    git(dir, ['rm', '-r', '-q', '--', '.claude']);
    writeFile(dir, 'config/claude/settings.json', '{}\n');
    fs.symlinkSync('config/claude', path.join(dir, '.claude'));
    commitAll(dir, '.claude links to the shared config');
    writeFile(dir, 'config/claude/settings.json', '{"hooks":{}}\n');
    writeFile(dir, '.worktreeinclude', '.leeway/.knowledge/metadata.json\n');

    migrate();

    assert.deepStrictEqual(headChanges(), ['M\t.worktreeinclude']);
    assert.deepStrictEqual(codeStatusLines(dir), [' M config/claude/settings.json']);
  });

  it('never reads another process\'s hold on the index as a refusal', () => {
    writeFile(dir, '.claude/settings.json', '{"hooks":{}}\n');
    fs.writeFileSync(path.join(dir, '.git', 'index.lock'), '');
    const before = codeHead();

    const res = engineFails(dir, ['commit', '--migrations', '-m', 'x'], { WORKFLOWS_GIT_LOCK_BUDGET_MS: '200' });

    assert.match(res.error, /index\.lock/);
    assert.strictEqual(codeHead(), before);
  });

  it('commits a project nested in its repository under the project\'s own directory — the state the repository\'s', () => {
    const repo = harness.setupGitFixture('engine-commit-nested-');
    try {
      const project = path.join(repo, 'apps/web');
      writeFile(repo, 'README.md', '# monorepo\n');
      writeFile(repo, '.leeway/payments/manifest.json', '{"name":"payments"}\n');
      writeFile(project, '.claude/settings.json', '{}\n');
      commitAll(repo, 'init');
      writeFile(repo, '.leeway/payments/manifest.json', '{"name":"payments","v":2}\n');
      writeFile(repo, '.leeway/.state/migrations', '062\n');
      writeFile(project, '.claude/settings.json', '{"hooks":{}}\n');
      writeFile(project, '.gitignore', '.DS_Store\n');

      engine(project, ['commit', '--migrations', '-m', 'chore: apply workflow migrations']);

      assert.deepStrictEqual(git(repo, ['show', '--name-status', '--pretty=format:', 'HEAD']).trim().split('\n').sort(), [
        'A\tapps/web/.gitignore',
        'M\tapps/web/.claude/settings.json',
      ]);
      assert.deepStrictEqual(stateGit(repo, ['show', '--name-status', '--pretty=format:', 'HEAD']).trim().split('\n').sort(), [
        'A\t.state/migrations',
        'M\tpayments/manifest.json',
      ]);
      assert.deepStrictEqual(codeStatusLines(repo), []);
      assert.deepStrictEqual(statusLines(repo), []);
    } finally {
      cleanupFixture(repo);
    }
  });

  it('refuses when HEAD\'s tree cannot be read — never a commit built on an empty tree', () => {
    writeFile(dir, '.claude/settings.json', '{"hooks":{}}\n');
    writeFile(dir, '.leeway/payments/manifest.json', '{"name":"payments","v":2}\n');
    const [code, state] = [codeHead(), stateHead()];
    // A git that fails the tree read alone, as a branch with no commits
    // would: exit 1, and every other call goes to the real git.
    const shim = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-git-shim-'));
    try {
      const realGit = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
      fs.writeFileSync(path.join(shim, 'git'),
        `#!/bin/sh\ncase "$*" in *'HEAD^{tree}'*) echo 'fatal: tree unreadable' >&2; exit 1;; esac\nexec '${realGit}' "$@"\n`,
        { mode: 0o755 });

      const res = engineFails(dir, ['commit', '--migrations', '-m', 'x'], { PATH: `${shim}:${process.env.PATH}` });

      assert.match(res.error, /tree unreadable/);
      assert.deepStrictEqual([codeHead(), stateHead()], [code, state]);
    } finally {
      fs.rmSync(shim, { recursive: true, force: true });
    }
  });

  it('answers nothing to commit on clean owned paths and a clean state, and where no owned path exists', () => {
    assert.deepStrictEqual(migrate('noop'), { ok: true, committed: null, note: 'nothing to commit', code_committed: null });

    git(dir, ['rm', '-r', '-q', '--', '.claude', '.worktreeinclude']);
    git(dir, ['commit', '-q', '-m', 'code only']);
    const before = codeHead();
    assert.deepStrictEqual(migrate('noop'), { ok: true, committed: null, note: 'nothing to commit', code_committed: null });
    assert.strictEqual(codeHead(), before);
  });

  it('makes the first commit on a code branch with none yet', () => {
    git(dir, ['checkout', '-q', '--orphan', 'fresh']);
    git(dir, ['rm', '-r', '-q', '--cached', '--', '.']);

    const res = migrate();

    assert.strictEqual(res.code_committed, codeHead());
    assert.deepStrictEqual(git(dir, ['ls-files']).trim().split('\n'), ['.claude/settings.json', '.gitignore', '.worktreeinclude']);
    assert.deepStrictEqual(codeStatusLines(dir), ['?? src/'], 'code stays untracked');
  });

  it('refuses while a merge is in progress, staging nothing', () => {
    writeFile(dir, '.claude/settings.json', '{"hooks":{}}\n');
    fs.writeFileSync(path.join(dir, '.git', 'MERGE_HEAD'), git(dir, ['rev-parse', 'HEAD']));
    const before = codeHead();

    assert.match(engineFails(dir, ['commit', '--migrations', '-m', 'x']).error, /a merge is in progress \(MERGE_HEAD\)/);
    assert.strictEqual(codeHead(), before);
    assert.strictEqual(git(dir, ['diff', '--cached', '--name-only']).trim(), '');
  });

  it('refuses beside another scope, and without a message', () => {
    assert.match(engineFails(dir, ['commit', '--migrations', '--workflows', '-m', 'x']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', '--migrations', '--state', '-m', 'x']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', 'payments', '--migrations', '-m', 'x']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', '--paths', 'src/app.js', '--migrations', '-m', 'x',
      '--for', 'payments', 'implementation/topic-a']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', '--migrations']).error, /Usage/);
  });

  it('takes each path literally — a file named with brackets is that file, never its glob siblings', () => {
    for (const rel of ['app/[id]/page.tsx', 'app/[id]/old.tsx', 'app/i/page.tsx', 'app/d/page.tsx']) writeFile(dir, rel, `// ${rel}\n`);
    commitAll(dir, 'routes');
    for (const rel of ['app/[id]/page.tsx', 'app/i/page.tsx', 'app/d/page.tsx']) writeFile(dir, rel, '// edited\n');
    fs.unlinkSync(path.join(dir, 'app/[id]/old.tsx'));
    git(dir, ['add', '--', 'app/d/page.tsx']);

    const sha = commitStaged(dir, ['app/[id]/page.tsx', 'app/[id]/old.tsx'], 'chore: the bracketed files');

    assert.strictEqual(sha, codeHead());
    assert.deepStrictEqual(headChanges(), ['D\tapp/[id]/old.tsx', 'M\tapp/[id]/page.tsx']);
    assert.deepStrictEqual(codeStatusLines(dir), ['M  app/d/page.tsx', ' M app/i/page.tsx'],
      'the glob siblings stay as they were — one staged, one not');
  });
});

describe('mechanical heartbeats: the self-referential rule', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  const beatFile = (phase, topic) => path.join(dir, '.leeway/.cache/payments', phase, topic, 'presence');
  const beaten = (phase, topic) => fs.existsSync(beatFile(phase, topic));

  it('the session-cadence commit beats; the conclusion commit clears; --sweep suppresses', () => {
    writeFile(dir, '.leeway/payments/discussion/topic-a.md', '# Topic A\nprogress\n');
    engine(dir, ['commit', 'payments', '-m', 'discussion(payments/topic-a): progress', '--topic', 'discussion/topic-a']);
    assert.ok(beaten('discussion', 'topic-a'), 'the cadence commit is the heartbeat');

    // The conclusion: `topic complete` then its commit. The completed item
    // makes that commit a release, so a concluded topic never reads held.
    writeFile(dir, '.leeway/payments/discussion/topic-a.md', '# Topic A\nconcluded\n');
    engine(dir, ['topic', 'complete', 'payments', 'discussion', 'topic-a']);
    engine(dir, ['commit', 'payments', '-m', 'discussion(payments): complete topic-a', '--topic', 'discussion/topic-a']);
    assert.ok(!beaten('discussion', 'topic-a'), 'the conclusion commit clears instead of beating');

    // The conclude sweep committing a dead session's leavings must not
    // resurrect the hold it just swept.
    writeFile(dir, '.leeway/payments/discussion/topic-b.md', '# Topic B\ndead session leavings\n');
    engine(dir, ['commit', 'payments', '-m', 'chore(payments/topic-b): sweep session leavings', '--topic', 'discussion/topic-b', '--sweep']);
    assert.ok(!beaten('discussion', 'topic-b'), '--sweep never stamps the swept topic');
  });

  it('--sweep leaves a live peer\'s hold as it found it — neither stamped nor cleared', () => {
    // The spec-side resolution edits and reindexes another phase's document;
    // a peer that is alive but idle still holds it.
    const peer = beatFile('discussion', 'topic-b');
    fs.mkdirSync(path.dirname(peer), { recursive: true });
    fs.writeFileSync(peer, JSON.stringify({ pid: 1, pid_start: null, session_id: 'peer' }) + '\n');

    writeFile(dir, '.leeway/payments/discussion/topic-b.md', '# Topic B\nresolution landed\n');
    engine(dir, ['commit', 'payments', '-m', 'discussion(payments/topic-b): supersede the decision',
      '--topic', 'discussion/topic-b', '--sweep']);

    assert.ok(beaten('discussion', 'topic-b'), 'the peer\'s hold stands');
    assert.strictEqual(JSON.parse(fs.readFileSync(peer, 'utf8')).session_id, 'peer',
      'and this session\'s identity is never stamped over the peer\'s');
  });

  it('--sweep outranks the terminal-status release too — the live spec-side case', () => {
    // The document a spec sources is `completed`, and its own session may be
    // sitting in it idle-but-alive (a reopen, a correction round). Terminal
    // status releases a slot this session holds; it must never release one
    // this session is only visiting.
    engine(dir, ['topic', 'start', 'payments', 'discussion', 'topic-b']);
    engine(dir, ['topic', 'complete', 'payments', 'discussion', 'topic-b']);
    const peer = beatFile('discussion', 'topic-b');
    fs.mkdirSync(path.dirname(peer), { recursive: true });
    fs.writeFileSync(peer, JSON.stringify({ pid: 1, pid_start: null, session_id: 'peer' }) + '\n');

    writeFile(dir, '.leeway/payments/discussion/topic-b.md', '# Topic B\nthe resolution landed\n');
    engine(dir, ['commit', 'payments', '-m', 'discussion(payments/topic-b): supersede the decision',
      '--topic', 'discussion/topic-b', '--sweep']);

    assert.strictEqual(JSON.parse(fs.readFileSync(peer, 'utf8')).session_id, 'peer',
      'a completed topic another session holds is still that session\'s to release');
  });

  it('--sweep still requires a --topic scope', () => {
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--sweep']).error, /Usage/);
  });

  it('the topic verbs a session runs on its own topic beat — and the reads and a send never create one', () => {
    const me = { CLAUDE_PID: String(process.pid), CLAUDE_CODE_SESSION_ID: 'door-sess' };
    // The mailbox read is reachable for any topic — a session checking a
    // foreign mailbox must not manufacture a hold there.
    engine(dir, ['topic', 'mailbox', 'payments', 'discussion', 'topic-a'], me);
    assert.ok(!beaten('discussion', 'topic-a'), 'a mailbox read never creates a heartbeat');

    engine(dir, ['topic', 'start', 'payments', 'planning', 'topic-a'], me);
    assert.ok(beaten('planning', 'topic-a'), 'start opens the session\'s own topic');

    writeFile(dir, '.leeway/payments/discussion/.mailbox/topic-a/001-first.md', '### First\nbody\n');
    commitAll(dir, 'a delivered message');
    engine(dir, ['topic', 'absorb', 'payments', 'discussion', 'topic-a', '--file', '001-first.md',
      '--subtopic', 'first', '-m', 'discussion(payments/topic-a): absorb 001-first (from topic-b)'], me);
    assert.ok(beaten('discussion', 'topic-a'), 'absorb folds a message into the session\'s own document');

    // The per-turn mailbox poll on the session's own topic is turn coverage:
    // it refreshes the hold the write-shaped verbs established.
    const own = beatFile('discussion', 'topic-a');
    const past = new Date(Date.now() - 20 * 60 * 1000);
    fs.utimesSync(own, past, past);
    engine(dir, ['topic', 'mailbox', 'payments', 'discussion', 'topic-a'], me);
    assert.ok(fs.statSync(own).mtimeMs > Date.now() - 60 * 1000, 'the poll keeps the owned hold live');

    // Delivery acts on the TARGET topic from the origin's session — a beat
    // there would manufacture a hold on a topic no session is in.
    writeFile(dir, '.leeway/.cache/scratch/c.md', '### Q\n*From: topic-a · discussion · d*\n\nBody.\n');
    engine(dir, ['topic', 'send', 'payments', 'discussion', 'topic-b',
      '--content', '.leeway/.cache/scratch/c.md', '--slug', 'q', '-m', 'discussion(payments/topic-a): send message to topic-b'], me);
    assert.ok(!beaten('discussion', 'topic-b'), 'send never beats the target');
  });

  it('no field write beats — a three-segment set is often a cross-phase write', () => {
    // Storage-path backfills, review's `updated` stamp and the epic menu's
    // unblock all write one phase's item from another phase's session. A beat
    // there mints a hold on a topic nobody is in.
    engine(dir, ['manifest', 'set', 'payments.discussion.topic-a', 'status', 'in-progress']);
    assert.ok(!beaten('discussion', 'topic-a'), 'a field write is not a session claiming the topic');

    engine(dir, ['manifest', 'set', 'payments.discussion', 'gate_mode', 'gated']);
    assert.ok(!beaten('discussion', 'topic-b'), 'a phase-level write names no topic');

    const ops = JSON.stringify([{ op: 'set', path: 'payments.discussion.topic-b', fields: { status: 'in-progress' } }]);
    writeFile(dir, '.leeway/.cache/scratch/ops.json', ops);
    engine(dir, ['manifest', 'apply', 'payments', '--file', '.leeway/.cache/scratch/ops.json']);
    assert.ok(!beaten('discussion', 'topic-b'), 'apply writes across topics — the analysis session holds none of them');
  });

  it('the close releases the slot, and every commit after it keeps it released', () => {
    engine(dir, ['topic', 'start', 'payments', 'planning', 'topic-a']);
    assert.ok(beaten('planning', 'topic-a'), 'start opens the topic');

    engine(dir, ['topic', 'complete', 'payments', 'planning', 'topic-a']);
    assert.ok(!beaten('planning', 'topic-a'), 'complete is the release');

    // The conclude-plan commit that follows must not re-take what the close
    // let go — a terminal item is finished, whatever the session does next.
    writeFile(dir, '.leeway/payments/planning/topic-a/planning.md', '# Plan\nconcluded\n');
    engine(dir, ['commit', 'payments', '-m', 'planning(payments): conclude topic-a', '--topic', 'planning/topic-a']);
    assert.ok(!beaten('planning', 'topic-a'), 'a post-completion cadence commit stays released');
  });

  it('the review sequence leaves no held row behind', () => {
    // `topic complete review` then the session's own artifact commit — the
    // shape review's conclusion runs. Under a held row the checkout's code
    // slot would read taken until the process died.
    engine(dir, ['topic', 'start', 'payments', 'review', 'topic-a']);
    assert.ok(beaten('review', 'topic-a'));

    writeFile(dir, '.leeway/payments/review/topic-a/report.md', '# Report\n');
    engine(dir, ['topic', 'complete', 'payments', 'review', 'topic-a']);
    engine(dir, ['commit', 'payments', '-m', 'review(payments): complete topic-a', '--topic', 'review/topic-a']);

    assert.ok(!beaten('review', 'topic-a'), 'the code slot is free the moment review closes');
  });

  it('a reopened item beats again', () => {
    engine(dir, ['topic', 'start', 'payments', 'specification', 'topic-a']);
    writeFile(dir, '.leeway/payments/specification/topic-a/specification.md', '# Spec\n');
    engine(dir, ['topic', 'complete', 'payments', 'specification', 'topic-a']);
    assert.ok(!beaten('specification', 'topic-a'), 'closed and released');

    engine(dir, ['topic', 'reopen', 'payments', 'specification', 'topic-a']);
    writeFile(dir, '.leeway/payments/specification/topic-a/specification.md', '# Spec\nreopened\n');
    engine(dir, ['commit', 'payments', '-m', 'spec(payments/topic-a): reconcile', '--topic', 'specification/topic-a']);
    assert.ok(beaten('specification', 'topic-a'), 'a live item\'s cadence commit is its heartbeat again');
  });

  it('a --topic commit on a topic with no manifest item neither beats nor clears', () => {
    writeFile(dir, '.leeway/payments/research/never-registered.md', '# Notes\n');
    engine(dir, ['commit', 'payments', '-m', 'research(payments/never-registered): notes', '--topic', 'research/never-registered']);
    assert.ok(!beaten('research', 'never-registered'), 'no item, nothing to hold');
  });

  it('agent-store writes beat the topic they address', () => {
    engine(dir, ['agent', 'dispatch', 'payments', 'discussion', 'topic-b', '--kind', 'review']);
    assert.ok(beaten('discussion', 'topic-b'), 'the dispatching session holds the topic');
  });

  it('a beat never changes a verb\'s answer, and discovery stays out of presence', () => {
    // Discovery carries no heartbeat — `discovery-session open` serialises it
    // engine-side — so the write lands and the beat silently no-ops.
    const res = engine(dir, ['manifest', 'set', 'payments.discovery.topic-a', 'routing', 'discussion']);
    assert.strictEqual(res.ok, true);
    assert.deepStrictEqual(res.set, { routing: 'discussion' }, 'the response is the field surface\'s, untouched');
    assert.ok(!fs.existsSync(path.join(dir, '.leeway/.cache/payments/discovery/topic-a/presence')));
  });
});

describe('commit door: never a code commit on the state branch', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('refuses a tree that has leeway-state checked out, running nothing there', () => {
    const state = path.join(dir, '.leeway');
    writeFile(state, 'stray.md', '# stray\n');
    const before = stateGit(dir, ['rev-parse', 'HEAD']).trim();
    let ran = false;

    assert.throws(() => withCommitLock(state, () => { ran = true; }),
      new RegExp(`^Error: refusing a code commit in ${state}: it has the state branch leeway-state checked out`));
    assert.throws(() => commitAcrossRepos([{ repo: { dir: '', path: state, heldOut: [], submodules: [] }, paths: ['stray.md'] }], 'stray'),
      /leeway-state checked out/);

    assert.strictEqual(ran, false);
    assert.strictEqual(stateGit(dir, ['rev-parse', 'HEAD']).trim(), before, 'nothing committed on the state branch');
    assert.deepStrictEqual(statusLines(dir), ['?? stray.md'], 'nor staged');
  });

  it('commits the owned paths in the main checkout from inside the state worktree', () => {
    writeFile(dir, '.claude/settings.json', '{"hooks":{}}\n');
    const stateHead = stateGit(dir, ['rev-parse', 'HEAD']).trim();

    const res = harness.ok(path.join(dir, '.leeway'), ['commit', '--migrations', '-m', 'chore: apply workflow migrations']);

    assert.deepStrictEqual(res, { ok: true, committed: null, code_committed: git(dir, ['rev-parse', '--short', 'HEAD']).trim() });
    assert.deepStrictEqual(codeHeadFiles(dir), ['.claude/settings.json']);
    assert.strictEqual(git(dir, ['symbolic-ref', '--short', 'HEAD']).trim(), 'main');
    assert.strictEqual(stateGit(dir, ['rev-parse', 'HEAD']).trim(), stateHead);
    assert.strictEqual(fs.existsSync(path.join(dir, '.leeway/.claude')), false);
  });
});

describe('commit door: never a code commit inside an operation git holds open', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  for (const [marker, operation] of [
    ['MERGE_HEAD', 'a merge'], ['CHERRY_PICK_HEAD', 'a cherry-pick'], ['REVERT_HEAD', 'a revert'], ['rebase-merge', 'a rebase'], ['rebase-apply', 'a rebase'],
    ['BISECT_START', 'a bisect'],
  ]) {
    it(`the confined commit refuses while ${operation} is in progress (${marker}), staging nothing`, () => {
      writeFile(dir, '.claude/settings.json', '{"hooks":{}}\n');
      const at = path.join(dir, '.git', marker);
      if (marker.startsWith('rebase')) fs.mkdirSync(at);
      else fs.writeFileSync(at, git(dir, ['rev-parse', 'HEAD']));
      const [head, status] = [git(dir, ['rev-parse', 'HEAD']), codeStatusLines(dir)];

      assert.throws(() => commitPathspecScoped(dir, '.claude/settings.json', 'chore: install workflow session hooks'),
        new RegExp(`^Error: ${operation} is in progress \\(${marker}\\) — finish or abort it, then commit again$`));

      assert.strictEqual(git(dir, ['rev-parse', 'HEAD']), head);
      assert.deepStrictEqual(codeStatusLines(dir), status);
      assert.strictEqual(git(dir, ['diff', '--cached', '--name-only']).trim(), '');
    });
  }
});

describe('commit door: a confined commit that does not land leaves the index as it found it', () => {
  const setup = fixtureFrom('engine-commit-', (at) => {
    writeFile(at, 'a.txt', 'one\n');
    commitAll(at, 'a');
  });
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a commit a hook refuses unstages what it staged and puts back what the person had staged — on its own paths and elsewhere', () => {
    writeFile(dir, 'a.txt', 'staged\n');
    writeFile(dir, 'c.txt', 'elsewhere\n');
    git(dir, ['add', 'a.txt', 'c.txt']);
    writeFile(dir, 'a.txt', 'on disk\n');
    writeFile(dir, 'b.txt', 'new\n');
    writeFile(dir, '.git/hooks/pre-commit', '#!/bin/sh\nexit 1\n');
    fs.chmodSync(path.join(dir, '.git/hooks/pre-commit'), 0o755);
    const [head, index] = [git(dir, ['rev-parse', 'HEAD']), git(dir, ['ls-files', '--stage'])];

    assert.throws(() => commitPathspecScoped(dir, ['a.txt', 'b.txt'], 'chore: refused'), /git commit failed/);

    assert.strictEqual(git(dir, ['rev-parse', 'HEAD']), head);
    assert.strictEqual(git(dir, ['ls-files', '--stage']), index);
    assert.strictEqual(git(dir, ['show', ':a.txt']), 'staged\n');
    assert.deepStrictEqual(git(dir, ['diff', '--cached', '--name-only']).trim().split('\n'), ['a.txt', 'c.txt']);
    assert.strictEqual(fs.readFileSync(path.join(dir, 'a.txt'), 'utf8'), 'on disk\n');
  });

  it('paths that turn out clean leave the person\'s staged change to them as it was', () => {
    writeFile(dir, 'a.txt', 'staged\n');
    git(dir, ['add', 'a.txt']);
    writeFile(dir, 'a.txt', 'one\n');

    assert.strictEqual(commitPathspecScoped(dir, 'a.txt', 'chore: nothing'), null);

    assert.strictEqual(git(dir, ['show', ':a.txt']), 'staged\n');
  });
});

describe('commit door: index.lock retry and the commit lock', () => {
  const setup = fixtureFrom('engine-commit-', implementing);
  let dir;
  beforeEach(() => {
    dir = setup();
    writeFile(dir, 'src/app.js', 'const x = 2;\n');
  });
  afterEach(() => { cleanupFixture(dir); });

  const task = ['commit', '--paths', 'src/app.js', '-m', 'feat(topic-a): the task', '--for', 'payments', 'implementation/topic-a'];

  it('retries through transient index.lock contention', () => {
    const indexLock = path.join(dir, '.git', 'index.lock');
    fs.writeFileSync(indexLock, '');
    // A detached deleter releases git's own lock mid-retry.
    spawn('node', ['-e', `setTimeout(() => require('fs').unlinkSync(${JSON.stringify(indexLock)}), 400)`], {
      detached: true, stdio: 'ignore',
    }).unref();

    const res = engine(dir, task);

    assert.deepStrictEqual(res.committed, [{ repo: '.', sha: git(dir, ['rev-parse', '--short', 'HEAD']).trim() }]);
  });

  it('surfaces the git error once the retry budget is exhausted, and releases the commit lock', () => {
    fs.writeFileSync(path.join(dir, '.git', 'index.lock'), '');

    const res = engineFails(dir, task, { WORKFLOWS_GIT_LOCK_BUDGET_MS: '200' });

    assert.match(res.error, /index\.lock/);
    assert.ok(!fs.existsSync(path.join(dir, '.git', 'workflows-commit.lock')), 'commit lock released on failure');
  });

  it('breaks a stale commit lock left by a crashed process', () => {
    const lock = path.join(dir, '.git', 'workflows-commit.lock');
    fs.writeFileSync(lock, '99999');
    const past = new Date(Date.now() - 360000);
    fs.utimesSync(lock, past, past);

    const res = engine(dir, task);

    assert.strictEqual(res.committed.length, 1);
    assert.ok(!fs.existsSync(lock), 'stale lock cleared');
  });

  it('a state commit never takes the code tree\'s index — a peer\'s hold there blocks nothing', () => {
    fs.writeFileSync(path.join(dir, '.git', 'index.lock'), '');
    writeFile(dir, '.leeway/payments/discussion/topic-a.md', '# Topic A\nprogress\n');

    const res = engine(dir, ['commit', 'payments', '-m', 'discussion(payments/topic-a): progress', '--topic', 'discussion/topic-a'],
      { WORKFLOWS_GIT_LOCK_BUDGET_MS: '200' });

    assert.strictEqual(res.committed, stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim());
  });
});

describe('commit door: transaction tails commit their own scope', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a deletion that empties its scope still commits (inbox delete)', () => {
    writeFile(dir, '.leeway/.inbox/.archived/ideas/a-thought.md', '# A thought\n');
    commitAll(dir, 'an archived idea');
    writeFile(dir, '.leeway/payments/discussion/topic-b.md', '# Topic B\npeer dirt\n');

    const res = engine(dir, ['inbox', 'delete', '.leeway/.inbox/.archived/ideas/a-thought.md']);

    assert.match(res.committed, /^[0-9a-f]+$/, 'the staged deletion commits even though nothing is left on disk');
    assert.ok(headFiles(dir).includes('.inbox/.archived/ideas/a-thought.md'), 'the deletion is in the commit');
    assert.deepStrictEqual(statusLines(dir), [' M payments/discussion/topic-b.md'], 'the live session\'s dirt is untouched');
  });

  it('the inbox scope leaves the knowledge store alone', () => {
    writeFile(dir, '.leeway/.inbox/ideas/a-thought.md', '# A thought\n');
    writeFile(dir, '.leeway/.knowledge/metadata.json', '{}\n');

    engine(dir, ['commit', '--inbox', '-m', 'chore(inbox): capture an idea']);

    assert.deepStrictEqual(headFiles(dir), ['.inbox/ideas/a-thought.md']);
    assert.ok(fs.existsSync(path.join(dir, '.leeway/.knowledge/metadata.json')), 'the store dirt is a peer session\'s');
  });

  it('a topic cancel commits the manifest write alone', () => {
    writeFile(dir, '.leeway/payments/discussion/topic-a.md', '# Topic A\nlive session dirt\n');

    const res = engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'topic-b']);

    assert.match(res.committed, /^[0-9a-f]+$/);
    assert.deepStrictEqual(headFiles(dir), ['payments/manifest.json'],
      'a cancel from the epic menu takes nothing a session is holding');
    assert.deepStrictEqual(statusLines(dir), [' M payments/discussion/topic-a.md']);
  });

  it('the discovery session close commits the discovery scope, not the work unit', () => {
    const manifest = epicManifest();
    manifest.phases.discovery.active_session = '001';
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
    writeFile(dir, '.leeway/payments/discovery/sessions/session-001.md', '# Session 001\n');
    commitAll(dir, 'an open session');

    writeFile(dir, '.leeway/payments/discovery/sessions/session-001.md', '# Session 001\n\n## Conclusion\n');
    writeFile(dir, '.leeway/payments/discovery/briefs/topic-a.md', '# Brief\n');
    writeFile(dir, '.leeway/payments/discussion/topic-a.md', '# Topic A\na peer session mid-turn\n');

    const res = engine(dir, ['discovery-session', 'close', 'payments', '-m', 'discovery(payments): synthesise 1 topic']);

    assert.match(res.committed, /^[0-9a-f]+$/);
    const files = headFiles(dir);
    assert.ok(files.includes('payments/discovery/sessions/session-001.md'));
    assert.ok(files.includes('payments/discovery/briefs/topic-a.md'));
    assert.ok(!files.includes('payments/discussion/topic-a.md'), 'the peer\'s half-written document stays uncommitted');
  });
});

describe('commit door: two live sessions on one checkout', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  // One session's turn loop: write its own topic file, commit it, repeat —
  // the cadence the discussion and research flows run.
  const SESSION = [
    "const fs = require('fs');",
    "const { execFileSync } = require('child_process');",
    'const [engine, dir, topic, turns] = process.argv.slice(1);',
    'const file = dir + "/.leeway/payments/discussion/" + topic + ".md";',
    'for (let i = 1; i <= Number(turns); i++) {',
    '  fs.writeFileSync(file, "# " + topic + "\\n" + Array.from({length: i}, (_, n) => "line " + (n + 1)).join("\\n") + "\\n");',
    '  execFileSync("node", [engine, "commit", "payments", "-m",',
    '    "discussion(payments/" + topic + "): turn " + i, "--topic", "discussion/" + topic],',
    '    { cwd: dir, encoding: "utf8" });',
    '}',
  ].join('\n');

  /** @param {string} topic @param {number} turns */
  function session(dir, topic, turns) {
    const proc = spawn('node', ['-e', SESSION, ENGINE, dir, topic, String(turns)], { cwd: dir });
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk; });
    return new Promise((resolve) => proc.on('exit', (code) => resolve({ code, stderr })));
  }

  it('no commit ever contains a foreign session\'s path, and nothing is lost', async () => {
    const turns = 6;
    const results = await Promise.all([session(dir, 'topic-a', turns), session(dir, 'topic-b', turns)]);
    for (const r of results) assert.strictEqual(r.code, 0, `a session crashed: ${r.stderr}`);

    // Every commit either session made, message and file list together.
    const log = stateGit(dir, ['log', '--format=%H%x00%s', '--name-only', '-z', 'HEAD']);
    const commits = stateGit(dir, ['log', '--format=%H', 'HEAD']).trim().split('\n');
    assert.ok(commits.length >= 2 * turns, `expected a commit per turn, got ${commits.length - 1}`);

    for (const sha of commits) {
      const subject = stateGit(dir, ['log', '--format=%s', '-1', sha]).trim();
      if (!subject.startsWith('discussion(payments/')) continue;
      const mine = subject.slice('discussion(payments/'.length).split(')')[0];
      const foreign = mine === 'topic-a' ? 'topic-b' : 'topic-a';
      const files = stateGit(dir, ['show', '--name-only', '--pretty=format:', sha]).trim().split('\n').filter(Boolean);
      assert.ok(!files.includes(`payments/discussion/${foreign}.md`),
        `${subject} (${sha}) swept a foreign session's file:\n${files.join('\n')}\n${log}`);
      assert.deepStrictEqual(files, [`payments/discussion/${mine}.md`],
        `${subject} committed more than its own action`);
    }

    // Both sessions' last turn is in HEAD, and the tree is clean.
    for (const topic of ['topic-a', 'topic-b']) {
      const committed = stateGit(dir, ['show', `HEAD:payments/discussion/${topic}.md`]);
      assert.strictEqual(committed, fs.readFileSync(path.join(dir, `.leeway/payments/discussion/${topic}.md`), 'utf8'),
        `${topic}'s last turn never reached a commit`);
      assert.ok(committed.trim().endsWith(`line ${turns}`), `${topic} lost a turn`);
    }
    assert.deepStrictEqual(statusLines(dir), [], 'nothing left dirty');
  });
});

describe('commit door: a push the remote refuses (4.S4)', () => {
  let dir;
  let bare;
  beforeEach(() => {
    dir = setupTwoTopicFixture();
    bare = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-commit-remote-'));
    git(bare, ['init', '-q', '--bare']);
    git(dir, ['remote', 'add', 'origin', bare]);
    git(dir, ['push', '-q', 'origin', 'leeway-state']);
    fs.writeFileSync(path.join(bare, 'hooks', 'pre-receive'), '#!/bin/sh\necho "no pushes today" >&2\nexit 1\n', { mode: 0o755 });
  });
  afterEach(() => {
    cleanupFixture(dir);
    fs.rmSync(bare, { recursive: true, force: true });
  });

  it('a verb\'s commit stands, its response carries the warning, and it answers ok with exit 0', () => {
    const pushed = git(bare, ['rev-parse', 'leeway-state']).trim();

    const res = engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'topic-b']);

    assert.strictEqual(res.status, 'cancelled');
    assert.strictEqual(res.committed, stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim(), 'the commit stands on leeway-state');
    assert.deepStrictEqual(headFiles(dir), ['payments/manifest.json']);
    assert.strictEqual(git(bare, ['rev-parse', 'leeway-state']).trim(), pushed, 'the remote refused it');
    assert.strictEqual(res.warnings.length, 1, JSON.stringify(res.warnings));
    assert.match(res.warnings[0], /^leeway-state is committed here but was not pushed to origin — the commit stands, and the next boot pushes it: .*no pushes today/s);
  });
});

describe('commit door: transaction-tail degrade', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a tail-committing verb saves state and degrades to a pending note when git is blocked', () => {
    holdStateRef(dir);

    const res = engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'auth-flow']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'cancelled');
    assert.strictEqual(res.committed, null);
    assert.strictEqual(res.note,
      'commit pending — state saved; retry with engine commit',
      'the cancel wrote the manifest alone — narrower than the work unit\'s state scope, so the retry stays generic');
    assert.ok(res.warnings.some((w) => w.includes('commit failed')), `warnings carry the git error: ${JSON.stringify(res.warnings)}`);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.leeway/payments/manifest.json'), 'utf8'));
    assert.strictEqual(manifest.phases.research.items['auth-flow'].status, 'cancelled', 'state landed despite the failed commit');
  });

  it('a foreign-topic tail prescribes a retry that beats no more than the verb did', () => {
    // The notes are contract surface: a session follows the command verbatim,
    // so a delivery's retry must carry the same suppression the delivery has.
    writeFile(dir, '.leeway/.cache/scratch/c.md', '### Q\n*From: topic-a · discussion · d*\n\nBody.\n');
    holdStateRef(dir);
    const delivered = engine(dir, ['topic', 'send', 'payments', 'discussion', 'topic-b',
      '--content', '.leeway/.cache/scratch/c.md', '--slug', 'q', '-m', 'discussion(payments/topic-a): send message to topic-b'],
    );
    assert.strictEqual(delivered.committed, null);
    assert.match(delivered.note, /--topic discussion\/topic-b --sweep -m/, 'the delivery\'s retry never beats the target');

    const moved = engine(dir, ['topic', 'forward', 'payments', 'discussion', 'research', 'topic-b',
      '--file', '001-q.md', '-m', 'research(payments/topic-b): move 001-q to the research side'],
    );
    assert.strictEqual(moved.committed, null);
    assert.match(moved.note, /--topic research\/topic-b --sweep -m/, 'the move\'s retry never beats the destination');

    // Absorb is the session folding a message into its own document — its
    // retry beats, exactly as the verb does.
    const absorbed = engine(dir, ['topic', 'absorb', 'payments', 'research', 'topic-b',
      '--file', '001-q.md', '-m', 'research(payments/topic-b): absorb 001-q (from topic-a)'],
    );
    assert.strictEqual(absorbed.committed, null);
    assert.match(absorbed.note, /--topic research\/topic-b -m/, 'the owning session\'s retry carries no suppression');
    assert.ok(!absorbed.note.includes('--sweep'));
  });

  it('every narrowed tail prescribes its own scope, never a work-unit sweep', () => {
    const manifest = epicManifest();
    manifest.phases.discovery.active_session = '001';
    manifest.phases.specification = { items: {
      'topic-a': { status: 'in-progress', sources: [] },
      'topic-b': { status: 'in-progress', sources: [] },
    } };
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
    writeFile(dir, '.leeway/payments/discovery/sessions/session-001.md', '# Session 001\n');
    commitAll(dir, 'a discovery session and two specs');
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'topic-b']);
    holdStateRef(dir);

    const reactivated = engine(dir, ['topic', 'reactivate', 'payments', 'discovery', 'topic-b']);
    assert.strictEqual(reactivated.note, 'commit pending — state saved; retry with engine commit',
      'reactivate wrote the manifest alone, like the cancel it undoes — narrower than the state scope, so its retry stays generic');

    const sequenced = engine(dir, ['build-order', 'sequence', 'payments', 'topic-a=1', 'topic-b=2']);
    assert.match(sequenced.note, /engine commit payments --state -m/,
      'build-order writes the manifest alone — the work unit\'s state scope covers it');

    const mapped = engine(dir, ['discovery-map', 'sequence', 'payments', 'topic-a=1']);
    assert.match(mapped.note, /engine commit payments --discovery -m/, 'the map lives in the discovery scope');

    const closed = engine(dir, ['discovery-session', 'close', 'payments', '-m', 'discovery(payments): close']);
    assert.match(closed.note, /engine commit payments --discovery -m/, 'so does the session log it just finalised');
  });
});
