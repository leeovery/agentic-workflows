'use strict';

//
// Tests for the commit door: `engine commit --topic` pathspec'd commits,
// the commit lock, the index.lock retry, and the transaction-tail degrade.
//

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync, spawn } = require('child_process');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');

process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_SYSTEM = '/dev/null';

/** @param {string} dir @param {string[]} args */
function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

function setupGitFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-commit-'));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
  // The nested gitignore every booted project carries (migration 049) — the
  // cache is ephemeral session machinery, mechanical heartbeats included.
  fs.writeFileSync(path.join(dir, '.workflows', '.gitignore'), '.cache/\n.manifest.json.*.tmp\n');
  return dir;
}

function cleanupFixture(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function commitAll(dir, message) {
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', message]);
}

/** Files in the HEAD commit. */
function headFiles(dir) {
  return git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').filter(Boolean);
}

/** `git status --porcelain` lines. */
function statusLines(dir) {
  return git(dir, ['status', '--porcelain']).split('\n').filter(Boolean);
}

/** Run the engine expecting success; returns the parsed JSON response. */
function engine(dir, args, env) {
  const out = execFileSync('node', [ENGINE, ...args], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, ...env },
  });
  const nl = out.indexOf('\n');
  return JSON.parse((nl === -1 ? out : out.slice(0, nl)).trim());
}

/** Run the engine expecting failure; returns the parsed stderr JSON. */
function engineFails(dir, args, env) {
  const res = spawnSync('node', [ENGINE, ...args], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, ...env },
  });
  assert.strictEqual(res.status, 1, `expected exit 1, got ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  const parsed = JSON.parse(res.stderr.trim());
  assert.strictEqual(parsed.ok, false);
  return parsed;
}

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

/** Two in-progress discussion topics, both committed clean. */
function setupTwoTopicFixture() {
  const dir = setupGitFixture();
  writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(epicManifest(), null, 2) + '\n');
  writeFile(dir, '.workflows/payments/discussion/topic-a.md', '# Topic A\n');
  writeFile(dir, '.workflows/payments/discussion/topic-b.md', '# Topic B\n');
  commitAll(dir, 'init');
  return dir;
}

describe('engine commit --topic: pathspec isolation', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('commits own topic + manifest, leaves the other topic dirty and uncommitted', () => {
    writeFile(dir, '.workflows/payments/discussion/topic-a.md', '# Topic A\nprogress\n');
    writeFile(dir, '.workflows/payments/discussion/topic-b.md', '# Topic B\npeer session dirt\n');
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(epicManifest(), null, 2) + '\n\n');

    const res = engine(dir, ['commit', 'payments', '-m', 'discussion(payments/topic-a): progress', '--topic', 'discussion/topic-a']);

    assert.strictEqual(res.ok, true);
    assert.match(res.committed, /^[0-9a-f]+$/);
    const files = headFiles(dir);
    assert.ok(files.includes('.workflows/payments/discussion/topic-a.md'), 'own topic committed');
    assert.ok(files.includes('.workflows/payments/manifest.json'), 'manifest committed');
    assert.ok(!files.includes('.workflows/payments/discussion/topic-b.md'), 'peer topic not committed');
    assert.deepStrictEqual(statusLines(dir), [' M .workflows/payments/discussion/topic-b.md'], 'peer dirt untouched');
  });

  it('topic absorb deletes one queue file, commits action-scoped, and answers remaining', () => {
    writeFile(dir, '.workflows/payments/discussion/.triage/topic-a/001-first.md', '### First\nbody\n');
    writeFile(dir, '.workflows/payments/discussion/.triage/topic-a/002-second.md', '### Second\nbody\n');
    commitAll(dir, 'deliveries');
    writeFile(dir, '.workflows/payments/discussion/topic-a.md', '# Topic A\nfold\n');
    writeFile(dir, '.workflows/payments/discussion/topic-b.md', '# Topic B\npeer dirt\n');

    const res = engine(dir, ['topic', 'absorb', 'payments', 'discussion', 'topic-a', '--file', '001-first.md', '-m', 'discussion(payments/topic-a): absorb 001-first (from origin)']);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.absorbed, '001-first.md');
    assert.strictEqual(res.remaining, 1, 'answers the post-deletion count');
    assert.match(res.committed, /^[0-9a-f]+$/);
    assert.ok(!fs.existsSync(path.join(dir, '.workflows/payments/discussion/.triage/topic-a/001-first.md')), 'queue file deleted');
    const files = headFiles(dir);
    assert.ok(files.includes('.workflows/payments/discussion/topic-a.md'), 'fold rides the commit');
    assert.ok(files.includes('.workflows/payments/discussion/.triage/topic-a/001-first.md'), 'the deletion rides the commit');
    assert.ok(!files.includes('.workflows/payments/discussion/topic-b.md'), 'peer topic not swept');

    const last = engine(dir, ['topic', 'absorb', 'payments', 'discussion', 'topic-a', '--file', '002-second.md', '-m', 'discussion(payments/topic-a): absorb 002-second (from origin)']);
    assert.strictEqual(last.remaining, 0, 'the emptied queue answers zero');

    assert.match(
      engineFails(dir, ['topic', 'absorb', 'payments', 'discussion', 'topic-a', '--file', '002-second.md', '-m', 'x']).error,
      /is not in the topic-a discussion triage queue/);
    assert.match(
      engineFails(dir, ['topic', 'absorb', 'payments', 'discussion', 'topic-a', '--file', '../002-second.md', '-m', 'x']).error,
      /queue-file name, not a path/);
    assert.match(
      engineFails(dir, ['topic', 'absorb', 'payments', 'planning', 'topic-a', '--file', '001-x.md', '-m', 'x']).error,
      /research\|discussion\|investigation only/);
  });

  it('leaves content another process staged out of the commit and still staged', () => {
    writeFile(dir, '.workflows/payments/discussion/topic-a.md', '# Topic A\nprogress\n');
    writeFile(dir, '.workflows/payments/discussion/topic-b.md', '# Topic B\npeer session dirt\n');
    git(dir, ['add', '--', '.workflows/payments/discussion/topic-b.md']);

    engine(dir, ['commit', 'payments', '-m', 'discussion(payments/topic-a): progress', '--topic', 'discussion/topic-a']);

    assert.ok(!headFiles(dir).includes('.workflows/payments/discussion/topic-b.md'), 'staged peer file not committed');
    assert.strictEqual(git(dir, ['diff', '--cached', '--name-only']).trim(), '.workflows/payments/discussion/topic-b.md', 'peer staging preserved');
  });

  it('commits an untracked artifact directory (specification phase)', () => {
    writeFile(dir, '.workflows/payments/specification/topic-a/specification.md', '# Spec\n');

    const res = engine(dir, ['commit', 'payments', '-m', 'spec(payments): construct topic-a', '--topic', 'specification/topic-a']);

    assert.match(res.committed, /^[0-9a-f]+$/);
    assert.ok(headFiles(dir).includes('.workflows/payments/specification/topic-a/specification.md'));
  });

  it('reports nothing to commit on clean paths, and on paths that do not exist', () => {
    const clean = engine(dir, ['commit', 'payments', '-m', 'noop', '--topic', 'discussion/topic-a']);
    assert.strictEqual(clean.committed, null);
    assert.strictEqual(clean.note, 'nothing to commit');

    const missing = engine(dir, ['commit', 'payments', '-m', 'noop', '--topic', 'review/never-started']);
    assert.strictEqual(missing.committed, null);
    assert.strictEqual(missing.note, 'nothing to commit');
  });

  it('regression: --topic commits survive an emptied triage queue (the post-drain state)', () => {
    // Deliver a concern (creates + commits the sidecar file), drain it (rm +
    // commit stages the deletion), then keep working: the emptied-but-present
    // directory must not poison later --topic commits.
    writeFile(dir, '.workflows/.cache/scratch/c.md', '### Q\n*From: x · discussion · d*\n\nBody.\n');
    engine(dir, ['topic', 'triage', 'payments', 'discussion', 'topic-a',
      '--concern', '.workflows/.cache/scratch/c.md', '--slug', 'q', '-m', 'discussion(payments/x): reroute concern to topic-a']);
    fs.unlinkSync(path.join(dir, '.workflows/payments/discussion/.triage/topic-a/001-q.md'));
    const drain = engine(dir, ['commit', 'payments', '-m', 'discussion(payments/topic-a): drain triage', '--topic', 'discussion/topic-a']);
    assert.match(drain.committed, /^[0-9a-f]+$/, 'the drain commit stages the deletion');

    writeFile(dir, '.workflows/payments/discussion/topic-a.md', '# Topic A\nprogress after the drain\n');
    const after = engine(dir, ['commit', 'payments', '-m', 'discussion(payments/topic-a): progress', '--topic', 'discussion/topic-a']);
    assert.match(after.committed, /^[0-9a-f]+$/, 'the emptied queue directory no longer breaks the pathspec');
    assert.ok(fs.existsSync(path.join(dir, '.workflows/payments/discussion/.triage/topic-a')), 'the empty dir is still on disk — excluded, not deleted');
  });

  it('does not stage the knowledge store — the KB dir never rides a --topic commit', () => {
    writeFile(dir, '.workflows/.knowledge/metadata.json', '{}\n');
    writeFile(dir, '.workflows/payments/discussion/topic-a.md', '# Topic A\nprogress\n');

    engine(dir, ['commit', 'payments', '-m', 'discussion(payments/topic-a): progress', '--topic', 'discussion/topic-a']);

    assert.ok(!headFiles(dir).some((f) => f.startsWith('.workflows/.knowledge/')), 'KB dir not committed');
    assert.ok(statusLines(dir).some((l) => l.includes('.workflows/.knowledge')), 'KB dirt left in place');
  });

  it('--kb stages the knowledge store alongside the topic pathspec', () => {
    writeFile(dir, '.workflows/.knowledge/metadata.json', '{}\n');
    writeFile(dir, '.workflows/payments/discussion/topic-a.md', '# Topic A\nconcluded\n');
    writeFile(dir, '.workflows/payments/discussion/topic-b.md', '# Topic B\npeer dirt\n');

    const res = engine(dir, ['commit', 'payments', '-m', 'discussion(payments): complete topic-a discussion', '--topic', 'discussion/topic-a', '--kb']);

    assert.match(res.committed, /^[0-9a-f]+$/);
    const files = headFiles(dir);
    assert.ok(files.includes('.workflows/.knowledge/metadata.json'), 'KB dirt rides the --kb commit');
    assert.ok(!files.includes('.workflows/payments/discussion/topic-b.md'), 'peer topic still excluded');
  });

  it('rejects malformed and illegal --topic specs', () => {
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--topic', 'bogus/topic-a']).error, /expected <phase>\/<topic>/);
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--topic', 'discussion']).error, /expected <phase>\/<topic>/);
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--topic', 'discussion/..']).error, /invalid topic name/);
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--topic', 'discussion/topic-a', '--plan', 'topic-a']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', '--inbox', '-m', 'x', '--topic', 'discussion/topic-a']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--kb']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--topic', 'toString/topic-a']).error, /expected <phase>\/<topic>/);
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--topic', '__proto__/topic-a']).error, /expected <phase>\/<topic>/);
  });
});

describe('engine commit --discovery: the discovery session\'s scope', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('commits sessions, briefs and the manifest — never a live peer\'s topic', () => {
    writeFile(dir, '.workflows/payments/discovery/sessions/session-001.md', '# Session 001\n');
    writeFile(dir, '.workflows/payments/discovery/briefs/topic-a.md', '# Brief — topic A\n');
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(epicManifest(), null, 2) + '\n\n');
    writeFile(dir, '.workflows/payments/discussion/topic-b.md', '# Topic B\npeer session dirt\n');

    const res = engine(dir, ['commit', 'payments', '--discovery', '-m', 'discovery(payments): shape the map']);

    assert.match(res.committed, /^[0-9a-f]+$/);
    const files = headFiles(dir);
    assert.ok(files.includes('.workflows/payments/discovery/sessions/session-001.md'), 'session log committed');
    assert.ok(files.includes('.workflows/payments/discovery/briefs/topic-a.md'), 'brief committed');
    assert.ok(files.includes('.workflows/payments/manifest.json'), 'manifest committed');
    assert.ok(!files.includes('.workflows/payments/discussion/topic-b.md'), 'the peer session\'s topic is not swept');
    assert.deepStrictEqual(statusLines(dir), [' M .workflows/payments/discussion/topic-b.md'], 'peer dirt untouched');
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

describe('engine commit --plan: confined to the plan\'s storage', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('commits the work unit and the declared storage, leaving foreign dirt behind', () => {
    const manifest = epicManifest();
    manifest.phases.planning = { items: { 'topic-a': { status: 'in-progress', storage_paths: ['plans/topic-a'] } } };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
    writeFile(dir, 'plans/topic-a/tasks.md', '# Tasks\n');
    writeFile(dir, 'src/app.js', 'const x = 1;\n');
    commitAll(dir, 'plan storage');

    writeFile(dir, 'plans/topic-a/tasks.md', '# Tasks\n- one\n');
    writeFile(dir, 'src/app.js', 'const x = 2;\n');

    const res = engine(dir, ['commit', 'payments', '-m', 'plan(payments): author', '--plan', 'topic-a']);

    assert.match(res.committed, /^[0-9a-f]+$/);
    const files = headFiles(dir);
    assert.ok(files.includes('plans/topic-a/tasks.md'), 'the declared storage rides');
    assert.ok(!files.includes('src/app.js'), 'code outside the plan\'s storage never rides a --plan commit');
    assert.deepStrictEqual(statusLines(dir), [' M src/app.js'], 'the code is left exactly as it was');
  });

  it('never takes another process\'s staged code', () => {
    const manifest = epicManifest();
    manifest.phases.planning = { items: { 'topic-a': { status: 'in-progress', storage_paths: [] } } };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
    writeFile(dir, 'src/app.js', 'const x = 1;\n');
    commitAll(dir, 'code');

    writeFile(dir, '.workflows/payments/planning/topic-a/planning.md', '# Plan\n');
    writeFile(dir, 'src/app.js', 'const x = 2;\n');
    git(dir, ['add', '--', 'src/app.js']);

    engine(dir, ['commit', 'payments', '-m', 'plan(payments): author', '--plan', 'topic-a']);

    assert.ok(headFiles(dir).includes('.workflows/payments/planning/topic-a/planning.md'), 'the plan lands');
    assert.ok(!headFiles(dir).includes('src/app.js'), 'staged code is not swept into a plan commit');
    assert.strictEqual(git(dir, ['diff', '--cached', '--name-only']).trim(), 'src/app.js', 'and stays staged');
  });
});

describe('engine commit --paths: the code commit', () => {
  let dir;
  beforeEach(() => {
    dir = setupTwoTopicFixture();
    writeFile(dir, 'src/app.js', 'const x = 1;\n');
    writeFile(dir, 'src/other.js', 'const y = 1;\n');
    writeFile(dir, 'src/gone.js', 'const z = 1;\n');
    commitAll(dir, 'code');
  });
  afterEach(() => { cleanupFixture(dir); });

  const forTopic = ['--for', 'payments', 'implementation/topic-a'];

  it('commits the named paths and answers the dirt still outside .workflows', () => {
    writeFile(dir, 'src/app.js', 'const x = 2;\n');
    writeFile(dir, 'src/new.js', 'const n = 1;\n');
    writeFile(dir, 'src/other.js', 'const y = 2;\n');
    writeFile(dir, '.workflows/payments/discussion/topic-b.md', '# Topic B\na doc session\'s dirt\n');

    const res = engine(dir, ['commit', '--paths', 'src/app.js', 'src/new.js', '-m', 'feat(topic-a): the task', ...forTopic]);

    assert.match(res.committed, /^[0-9a-f]+$/);
    const files = headFiles(dir);
    assert.deepStrictEqual(files.sort(), ['src/app.js', 'src/new.js'], 'exactly the named paths — untracked included');
    assert.deepStrictEqual(res.left_dirty, ['src/other.js'],
      'the forgotten path is named; a doc session\'s .workflows dirt is its own');
  });

  it('records a task\'s deletion and beats the named code topic', () => {
    fs.unlinkSync(path.join(dir, 'src/gone.js'));

    const res = engine(dir, ['commit', '--paths', 'src/gone.js', '-m', 'refactor(topic-a): drop the module', ...forTopic]);

    assert.ok(headFiles(dir).includes('src/gone.js'), 'the deletion rides the commit');
    assert.deepStrictEqual(res.left_dirty, []);
    assert.ok(fs.existsSync(path.join(dir, '.workflows/.cache/payments/implementation/topic-a/presence')),
      '--for beats the code topic');
  });

  it('answers nothing to commit when the named paths are clean', () => {
    const res = engine(dir, ['commit', '--paths', 'src/app.js', '-m', 'noop', ...forTopic]);
    assert.strictEqual(res.committed, null);
    assert.strictEqual(res.note, 'nothing to commit');
  });

  it('refuses patterns, escapes, workflow artifacts, and a missing target', () => {
    assert.match(engineFails(dir, ['commit', '--paths', 'src/*.js', '-m', 'x', ...forTopic]).error, /is a pattern/);
    assert.match(engineFails(dir, ['commit', '--paths', '../elsewhere.js', '-m', 'x', ...forTopic]).error, /resolves outside the project/);
    assert.match(engineFails(dir, ['commit', '--paths', '/etc/hosts', '-m', 'x', ...forTopic]).error, /resolves outside the project/);
    assert.match(engineFails(dir, ['commit', '--paths', '.workflows/payments/discussion/topic-a.md', '-m', 'x', ...forTopic]).error,
      /workflow artifact/);
    assert.match(engineFails(dir, ['commit', '--paths', 'src/never-written.js', '-m', 'x', ...forTopic]).error, /neither on disk nor tracked/);
    assert.match(engineFails(dir, ['commit', '--paths', '-m', 'x', ...forTopic]).error, /Usage/);
    assert.match(engineFails(dir, ['commit', '--paths', 'src/app.js', '-m', 'x']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', '--paths', 'src/app.js', '-m', 'x', '--for', 'payments', 'discussion/topic-a']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', '--paths', 'src/app.js', '--for', 'payments', 'review/topic-a']).error, /Usage/);
    assert.match(engineFails(dir, ['commit', 'payments', '--paths', 'src/app.js', '-m', 'x', ...forTopic]).error, /Usage/);
    assert.strictEqual(statusLines(dir).length, 0, 'a refusal touches nothing');
  });
});

describe('mechanical heartbeats: the self-referential rule', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  const beatFile = (phase, topic) => path.join(dir, '.workflows/.cache/payments', phase, topic, 'presence');
  const beaten = (phase, topic) => fs.existsSync(beatFile(phase, topic));

  it('the session-cadence commit beats; --kb clears; --sweep suppresses', () => {
    writeFile(dir, '.workflows/payments/discussion/topic-a.md', '# Topic A\nprogress\n');
    engine(dir, ['commit', 'payments', '-m', 'discussion(payments/topic-a): progress', '--topic', 'discussion/topic-a']);
    assert.ok(beaten('discussion', 'topic-a'), 'the cadence commit is the heartbeat');

    // The conclusion: `topic complete` then the --kb commit. Clearing is what
    // stops a concluded topic reading held forever.
    writeFile(dir, '.workflows/payments/discussion/topic-a.md', '# Topic A\nconcluded\n');
    engine(dir, ['commit', 'payments', '-m', 'discussion(payments): complete topic-a', '--topic', 'discussion/topic-a', '--kb']);
    assert.ok(!beaten('discussion', 'topic-a'), '--kb clears instead of beating');

    // The conclude sweep committing a dead session's leavings must not
    // resurrect the hold it just swept.
    writeFile(dir, '.workflows/payments/discussion/topic-b.md', '# Topic B\ndead session leavings\n');
    engine(dir, ['commit', 'payments', '-m', 'chore(payments/topic-b): sweep session leavings', '--topic', 'discussion/topic-b', '--sweep']);
    assert.ok(!beaten('discussion', 'topic-b'), '--sweep never stamps the swept topic');
  });

  it('the topic verbs a session runs on its own topic beat — and triage never does', () => {
    engine(dir, ['topic', 'queue', 'payments', 'discussion', 'topic-a']);
    assert.ok(beaten('discussion', 'topic-a'), 'the per-turn queue poll is turn coverage');

    engine(dir, ['topic', 'start', 'payments', 'planning', 'topic-a']);
    assert.ok(beaten('planning', 'topic-a'), 'start opens the session\'s own topic');
    engine(dir, ['topic', 'complete', 'payments', 'planning', 'topic-a']);
    assert.ok(beaten('planning', 'topic-a'), 'complete is the session\'s own close');

    writeFile(dir, '.workflows/payments/discussion/.triage/topic-a/001-first.md', '### First\nbody\n');
    commitAll(dir, 'a delivered concern');
    engine(dir, ['topic', 'absorb', 'payments', 'discussion', 'topic-a', '--file', '001-first.md',
      '-m', 'discussion(payments/topic-a): absorb 001-first (from topic-b)']);
    assert.ok(beaten('discussion', 'topic-a'), 'absorb folds a concern into the session\'s own document');

    // Delivery acts on the TARGET topic from the origin's session — a beat
    // there would manufacture a hold on a topic no session is in.
    writeFile(dir, '.workflows/.cache/scratch/c.md', '### Q\n*From: topic-a · discussion · d*\n\nBody.\n');
    engine(dir, ['topic', 'triage', 'payments', 'discussion', 'topic-b',
      '--concern', '.workflows/.cache/scratch/c.md', '--slug', 'q', '-m', 'discussion(payments/topic-a): reroute to topic-b']);
    assert.ok(!beaten('discussion', 'topic-b'), 'triage never beats the target');
  });

  it('a topic-addressed manifest set beats; the batch apply does not', () => {
    engine(dir, ['manifest', 'set', 'payments.discussion.topic-a', 'status', 'in-progress']);
    assert.ok(beaten('discussion', 'topic-a'), 'every state transition heartbeats');

    engine(dir, ['manifest', 'set', 'payments.discussion', 'gate_mode', 'gated']);
    assert.ok(!beaten('discussion', 'topic-b'), 'a phase-level write names no topic');

    const ops = JSON.stringify([{ op: 'set', path: 'payments.discussion.topic-b', fields: { status: 'in-progress' } }]);
    writeFile(dir, '.workflows/.cache/scratch/ops.json', ops);
    engine(dir, ['manifest', 'apply', 'payments', '--file', '.workflows/.cache/scratch/ops.json']);
    assert.ok(!beaten('discussion', 'topic-b'), 'apply writes across topics — the analysis session holds none of them');
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
    assert.ok(!fs.existsSync(path.join(dir, '.workflows/.cache/payments/discovery/topic-a/presence')));
  });
});

describe('commit door: index.lock retry and the commit lock', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('retries through transient index.lock contention', () => {
    writeFile(dir, '.workflows/payments/discussion/topic-a.md', '# Topic A\nprogress\n');
    const indexLock = path.join(dir, '.git', 'index.lock');
    fs.writeFileSync(indexLock, '');
    // A detached deleter releases git's own lock mid-retry.
    spawn('node', ['-e', `setTimeout(() => require('fs').unlinkSync(${JSON.stringify(indexLock)}), 400)`], {
      detached: true, stdio: 'ignore',
    }).unref();

    const res = engine(dir, ['commit', 'payments', '-m', 'discussion(payments/topic-a): progress', '--topic', 'discussion/topic-a']);

    assert.match(res.committed, /^[0-9a-f]+$/);
  });

  it('surfaces the git error once the retry budget is exhausted, and releases the commit lock', () => {
    writeFile(dir, '.workflows/payments/discussion/topic-a.md', '# Topic A\nprogress\n');
    fs.writeFileSync(path.join(dir, '.git', 'index.lock'), '');

    const res = engineFails(
      dir,
      ['commit', 'payments', '-m', 'discussion(payments/topic-a): progress', '--topic', 'discussion/topic-a'],
      { WORKFLOWS_GIT_LOCK_BUDGET_MS: '200' },
    );

    assert.match(res.error, /index\.lock/);
    assert.ok(!fs.existsSync(path.join(dir, '.git', 'workflows-commit.lock')), 'commit lock released on failure');
  });

  it('breaks a stale commit lock left by a crashed process', () => {
    writeFile(dir, '.workflows/payments/discussion/topic-a.md', '# Topic A\nprogress\n');
    const lock = path.join(dir, '.git', 'workflows-commit.lock');
    fs.writeFileSync(lock, '99999');
    const past = new Date(Date.now() - 360000);
    fs.utimesSync(lock, past, past);

    const res = engine(dir, ['commit', 'payments', '-m', 'discussion(payments/topic-a): progress', '--topic', 'discussion/topic-a']);

    assert.match(res.committed, /^[0-9a-f]+$/);
    assert.ok(!fs.existsSync(lock), 'stale lock cleared');
  });
});

describe('commit door: transaction tails commit their own scope', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a deletion that empties its scope still commits (inbox delete)', () => {
    writeFile(dir, '.workflows/.inbox/.archived/ideas/a-thought.md', '# A thought\n');
    commitAll(dir, 'an archived idea');
    writeFile(dir, '.workflows/payments/discussion/topic-b.md', '# Topic B\npeer dirt\n');

    const res = engine(dir, ['inbox', 'delete', '.workflows/.inbox/.archived/ideas/a-thought.md']);

    assert.match(res.committed, /^[0-9a-f]+$/, 'the staged deletion commits even though nothing is left on disk');
    assert.ok(headFiles(dir).includes('.workflows/.inbox/.archived/ideas/a-thought.md'), 'the deletion is in the commit');
    assert.deepStrictEqual(statusLines(dir), [' M .workflows/payments/discussion/topic-b.md'], 'the live session\'s dirt is untouched');
  });

  it('a topic cancel commits the manifest write alone', () => {
    writeFile(dir, '.workflows/payments/discussion/topic-a.md', '# Topic A\nlive session dirt\n');

    const res = engine(dir, ['topic', 'cancel', 'payments', 'discussion', 'topic-b']);

    assert.match(res.committed, /^[0-9a-f]+$/);
    assert.deepStrictEqual(headFiles(dir), ['.workflows/payments/manifest.json'],
      'a cancel from the epic menu takes nothing a session is holding');
    assert.deepStrictEqual(statusLines(dir), [' M .workflows/payments/discussion/topic-a.md']);
  });

  it('the discovery session close commits the discovery scope, not the work unit', () => {
    const manifest = epicManifest();
    manifest.phases.discovery.active_session = '001';
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
    writeFile(dir, '.workflows/payments/discovery/sessions/session-001.md', '# Session 001\n');
    commitAll(dir, 'an open session');

    writeFile(dir, '.workflows/payments/discovery/sessions/session-001.md', '# Session 001\n\n## Conclusion\n');
    writeFile(dir, '.workflows/payments/discovery/briefs/topic-a.md', '# Brief\n');
    writeFile(dir, '.workflows/payments/discussion/topic-a.md', '# Topic A\na peer session mid-turn\n');

    const res = engine(dir, ['discovery-session', 'close', 'payments', '-m', 'discovery(payments): synthesise 1 topic']);

    assert.match(res.committed, /^[0-9a-f]+$/);
    const files = headFiles(dir);
    assert.ok(files.includes('.workflows/payments/discovery/sessions/session-001.md'));
    assert.ok(files.includes('.workflows/payments/discovery/briefs/topic-a.md'));
    assert.ok(!files.includes('.workflows/payments/discussion/topic-a.md'), 'the peer\'s half-written document stays uncommitted');
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
    'const file = dir + "/.workflows/payments/discussion/" + topic + ".md";',
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
    const log = git(dir, ['log', '--format=%H%x00%s', '--name-only', '-z', 'HEAD']);
    const commits = git(dir, ['log', '--format=%H', 'HEAD']).trim().split('\n');
    assert.ok(commits.length >= 2 * turns, `expected a commit per turn, got ${commits.length - 1}`);

    for (const sha of commits) {
      const subject = git(dir, ['log', '--format=%s', '-1', sha]).trim();
      if (!subject.startsWith('discussion(payments/')) continue;
      const mine = subject.slice('discussion(payments/'.length).split(')')[0];
      const foreign = mine === 'topic-a' ? 'topic-b' : 'topic-a';
      const files = git(dir, ['show', '--name-only', '--pretty=format:', sha]).trim().split('\n').filter(Boolean);
      assert.ok(!files.includes(`.workflows/payments/discussion/${foreign}.md`),
        `${subject} (${sha}) swept a foreign session's file:\n${files.join('\n')}\n${log}`);
      assert.deepStrictEqual(files, [`.workflows/payments/discussion/${mine}.md`],
        `${subject} committed more than its own action`);
    }

    // Both sessions' last turn is in HEAD, and the tree is clean.
    for (const topic of ['topic-a', 'topic-b']) {
      const committed = git(dir, ['show', `HEAD:.workflows/payments/discussion/${topic}.md`]);
      assert.strictEqual(committed, fs.readFileSync(path.join(dir, `.workflows/payments/discussion/${topic}.md`), 'utf8'),
        `${topic}'s last turn never reached a commit`);
      assert.ok(committed.trim().endsWith(`line ${turns}`), `${topic} lost a turn`);
    }
    assert.deepStrictEqual(statusLines(dir), [], 'nothing left dirty');
  });
});

describe('commit door: transaction-tail degrade', () => {
  let dir;
  beforeEach(() => { dir = setupTwoTopicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a tail-committing verb saves state and degrades to a pending note when git is blocked', () => {
    fs.writeFileSync(path.join(dir, '.git', 'index.lock'), '');

    const res = engine(
      dir,
      ['topic', 'cancel', 'payments', 'research', 'auth-flow'],
      { WORKFLOWS_GIT_LOCK_BUDGET_MS: '200' },
    );

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'cancelled');
    assert.strictEqual(res.committed, null);
    assert.strictEqual(res.note, 'commit pending — state saved; retry with engine commit');
    assert.ok(res.warnings.some((w) => w.includes('commit failed')), `warnings carry the git error: ${JSON.stringify(res.warnings)}`);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8'));
    assert.strictEqual(manifest.phases.research.items['auth-flow'].status, 'cancelled', 'state landed despite the failed commit');
  });

  it('a foreign-topic tail prescribes a retry that beats no more than the verb did', () => {
    // The notes are contract surface: a session follows the command verbatim,
    // so a delivery's retry must carry the same suppression the delivery has.
    writeFile(dir, '.workflows/.cache/scratch/c.md', '### Q\n*From: topic-a · discussion · d*\n\nBody.\n');
    fs.writeFileSync(path.join(dir, '.git', 'index.lock'), '');
    const delivered = engine(dir, ['topic', 'triage', 'payments', 'discussion', 'topic-b',
      '--concern', '.workflows/.cache/scratch/c.md', '--slug', 'q', '-m', 'discussion(payments/topic-a): reroute to topic-b'],
    { WORKFLOWS_GIT_LOCK_BUDGET_MS: '200' });
    assert.strictEqual(delivered.committed, null);
    assert.match(delivered.note, /--topic discussion\/topic-b --sweep -m/, 'the delivery\'s retry never beats the target');

    const moved = engine(dir, ['topic', 'requeue', 'payments', 'discussion', 'research', 'topic-b',
      '--file', '001-q.md', '-m', 'research(payments/topic-b): move 001-q to the research side'],
    { WORKFLOWS_GIT_LOCK_BUDGET_MS: '200' });
    assert.strictEqual(moved.committed, null);
    assert.match(moved.note, /--topic research\/topic-b --sweep -m/, 'the move\'s retry never beats the destination');

    // Absorb is the session folding a concern into its own document — its
    // retry beats, exactly as the verb does.
    const absorbed = engine(dir, ['topic', 'absorb', 'payments', 'research', 'topic-b',
      '--file', '001-q.md', '-m', 'research(payments/topic-b): absorb 001-q (from topic-a)'],
    { WORKFLOWS_GIT_LOCK_BUDGET_MS: '200' });
    assert.strictEqual(absorbed.committed, null);
    assert.match(absorbed.note, /--topic research\/topic-b -m/, 'the owning session\'s retry carries no suppression');
    assert.ok(!absorbed.note.includes('--sweep'));
  });
});
