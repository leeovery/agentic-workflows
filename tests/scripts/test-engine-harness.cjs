'use strict';

// The shared engine runner's own contract: each shape answers what its name
// says, the refusal shape asserts the refusal, the call's environment and
// stdin reach the engine, the git fixture is a repo with its state worktree
// that an engine commit lands in, a world made once is copied whole and
// apart, a keyword-only checkout is one a transaction's index builds a real
// store in, and a long suite's shards hold every test once.

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const harness = require('./engine-harness.cjs');
const shards = require('./shards.cjs');
const {
  call, ok, okSections, refuses, output, git, stateGit, statePath, commitAll, setupGitFixture, cleanupFixture,
} = harness;

const OWN = { CLAUDE_PID: String(process.pid), CLAUDE_CODE_SESSION_ID: 'sess-own' };
const PEER = { CLAUDE_PID: '1', CLAUDE_CODE_SESSION_ID: 'sess-peer' };

/** A feature with one research item, committed. */
function seed(dir, { commit = true } = {}) {
  const wu = statePath(dir, 'pay');
  fs.mkdirSync(path.join(wu, 'research'), { recursive: true });
  fs.writeFileSync(path.join(wu, 'manifest.json'), JSON.stringify({
    name: 'pay',
    work_type: 'feature',
    status: 'in-progress',
    phases: { research: { items: { pay: { status: 'in-progress' } } } },
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(wu, 'research', 'pay.md'), '# Research\n');
  if (commit) commitAll(dir, 'init');
}

describe('engine harness — the shapes', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture('harness-test-'); seed(dir); });
  afterEach(() => cleanupFixture(dir));

  it('ok answers the parsed response line of a call that succeeds', () => {
    assert.deepStrictEqual(ok(dir, ['manifest', 'set', 'pay.research.pay', 'brief_incorporated', 'true']),
      { ok: true, path: 'pay.research.pay', set: { brief_incorporated: true } });
  });

  it('ok fails loudly when the engine refuses', () => {
    assert.throws(() => ok(dir, ['topic', 'complete', 'pay', 'research', 'absent']),
      /engine topic complete pay research absent failed/);
  });

  it('okSections answers the response and everything after it', () => {
    const pure = okSections(dir, ['manifest', 'set', 'pay.research.pay', 'brief_incorporated', 'true']);
    assert.strictEqual(pure.res.ok, true);
    assert.strictEqual(pure.sections, '', 'a transaction answers with pure JSON');

    ok(dir, ['presence', 'beat', 'pay', 'research', 'pay'], { env: PEER });
    const scan = okSections(dir, ['presence', 'scan', 'pay'], { env: OWN });
    assert.strictEqual(scan.res.held_sources, 1);
    assert.match(scan.sections, /Analyses deferred/, 'the sections after the response line');
  });

  it('refuses answers the refusal, and asserts exit 1 with nothing on stdout', () => {
    const before = fs.readFileSync(statePath(dir, 'pay/manifest.json'), 'utf8');
    assert.match(refuses(dir, ['topic', 'complete', 'pay', 'research', 'absent']).error, /absent/);
    assert.strictEqual(fs.readFileSync(statePath(dir, 'pay/manifest.json'), 'utf8'), before);
  });

  it('refuses fails loudly when the call succeeds instead', () => {
    assert.throws(() => refuses(dir, ['manifest', 'get', 'pay', 'work_type']),
      /was expected to refuse/);
  });

  it('output answers the whole stdout of a call that must succeed', () => {
    const rendered = output(dir, ['render', 'resume-gate', 'pay.research.pay']);
    assert.match(rendered, /^=== /, 'the render surface, sections and all');
    assert.strictEqual(output(dir, ['manifest', 'get', 'pay.research.pay', 'status']), 'in-progress\n',
      'a bare read is its raw stdout, trailing newline included');
  });

  it('call answers the three parts and asserts nothing — an expected miss included', () => {
    assert.deepStrictEqual(call(dir, ['manifest', 'exists', 'pay.research.absent']),
      { stdout: 'false\n', stderr: '', code: 0 });
    const miss = call(dir, ['manifest', 'key-of', 'pay.research', 'items', 'absent']);
    assert.strictEqual(miss.code, 2);
    assert.match(miss.stderr, /^Error: Value "absent" not found/);
  });

  it('the call\'s environment reaches the engine, and a key it takes away is gone', () => {
    ok(dir, ['presence', 'beat', 'pay', 'research', 'pay'], { env: OWN });
    const record = JSON.parse(fs.readFileSync(statePath(dir, '.cache/pay/research/pay/presence'), 'utf8'));
    assert.strictEqual(record.session_id, 'sess-own');

    ok(dir, ['presence', 'beat', 'pay', 'research', 'pay'], { env: { ...OWN, CLAUDE_CODE_SESSION_ID: undefined } });
    const anonymous = JSON.parse(fs.readFileSync(statePath(dir, '.cache/pay/research/pay/presence'), 'utf8'));
    assert.strictEqual(anonymous.session_id, null, 'the engine saw no session id at all');
  });

  it('the call\'s stdin reaches the engine', () => {
    ok(dir, ['presence', 'beat', 'pay', 'research', 'pay'], { env: OWN });
    const swept = ok(dir, ['presence', 'cleanup'], { stdin: JSON.stringify({ session_id: 'sess-own' }) });
    assert.deepStrictEqual(swept.cleared, [{ work_unit: 'pay', phase: 'research', topic: 'pay' }]);
  });
});

describe('engine harness — the git fixture', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture('harness-test-'); });
  afterEach(() => cleanupFixture(dir));

  it('is a repo on main, its path the one the engine names it by, with an identity that can commit', () => {
    assert.strictEqual(fs.realpathSync(dir), dir);
    assert.strictEqual(git(dir, ['symbolic-ref', '--short', 'HEAD']).trim(), 'main');
    seed(dir);
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%an']).trim(), 'Test');
    assert.strictEqual(stateGit(dir, ['log', '-1', '--pretty=%an %s']).trim(), 'Test init');
  });

  it('holds its state worktree, locked on the state branch, and the code tree ignores it', () => {
    assert.strictEqual(stateGit(dir, ['symbolic-ref', '--short', 'HEAD']).trim(), 'leeway-state');
    assert.match(git(dir, ['worktree', 'list', '--porcelain']),
      new RegExp(`worktree ${statePath(dir)}\nHEAD [0-9a-f]+\nbranch refs/heads/leeway-state\nlocked workflows state, do not remove`));
    assert.strictEqual(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), '.leeway/\n');
    seed(dir);
    assert.deepStrictEqual(git(dir, ['ls-files']).trim().split('\n'), ['.gitignore']);
    assert.strictEqual(git(dir, ['status', '--porcelain']), '', 'the code tree is clean');
  });

  it('is its own world: a write in one fixture lands in no other', () => {
    const other = setupGitFixture('harness-test-');
    try {
      seed(dir);
      assert.strictEqual(fs.existsSync(statePath(other, 'pay')), false);
      assert.strictEqual(stateGit(other, ['rev-list', '--count', 'HEAD']).trim(), '1');
    } finally {
      cleanupFixture(other);
    }
  });

  it('is a repo an engine commit lands in — the state on the state branch, none on main', () => {
    seed(dir);
    const head = git(dir, ['rev-parse', 'HEAD']).trim();
    fs.writeFileSync(statePath(dir, 'pay/research/pay.md'), '# Research\n\nMore.\n');
    const res = ok(dir, ['commit', 'pay', '-m', 'research(pay): notes', '--topic', 'research/pay']);
    assert.strictEqual(res.committed, stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(stateGit(dir, ['log', '-1', '--pretty=%s']).trim(), 'research(pay): notes');
    assert.strictEqual(git(dir, ['rev-parse', 'HEAD']).trim(), head);
  });

  it('runs no auto maintenance after a commit, so nothing of git\'s outlives the call', () => {
    const trace = path.join(dir, '.git', 'trace.log');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a\n');
    git(dir, ['add', 'a.txt']);
    execFileSync('git', ['commit', '-q', '-m', 'a'], { cwd: dir, env: { ...process.env, GIT_TRACE: trace } });
    assert.match(fs.readFileSync(trace, 'utf8'), /built-in: git commit/, 'the trace caught nothing');
    assert.doesNotMatch(fs.readFileSync(trace, 'utf8'), /maintenance/);
  });
});

describe('engine harness — a world made once and copied', () => {
  /** @type {string[]} */
  const made = [];
  const world = harness.fixtureFrom('harness-test-', (at) => {
    made.push(at);
    seed(at);
  });
  /** @type {string[]} */
  let copies = [];
  afterEach(() => { copies.forEach(cleanupFixture); copies = []; });

  it('is built once, at the first copy, and each copy holds what the build left', () => {
    copies = [world(), world()];
    assert.strictEqual(made.length, 1);
    for (const copy of copies) {
      assert.strictEqual(stateGit(copy, ['log', '-1', '--pretty=%s']).trim(), 'init');
      assert.strictEqual(fs.readFileSync(statePath(copy, 'pay/research/pay.md'), 'utf8'), '# Research\n');
    }
  });

  it('is a world of its own each time: its state worktree is its own repository\'s, and a commit in one reaches neither the other nor the template', () => {
    copies = [world(), world()];
    const [one, two] = copies;
    assert.strictEqual(stateGit(one, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim(), path.join(one, '.git'));
    fs.writeFileSync(statePath(one, 'pay/research/pay.md'), '# Research\n\nMore.\n');
    ok(one, ['commit', 'pay', '-m', 'research(pay): notes', '--topic', 'research/pay']);
    for (const other of [two, made[0]]) {
      assert.strictEqual(stateGit(other, ['log', '-1', '--pretty=%s']).trim(), 'init');
      assert.strictEqual(fs.readFileSync(statePath(other, 'pay/research/pay.md'), 'utf8'), '# Research\n');
    }
  });

  it('is copied to the folder given, where one is', () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-test-')));
    copies = [root];
    const at = world(path.join(root, 'project'));
    assert.strictEqual(at, path.join(root, 'project'));
    assert.strictEqual(stateGit(at, ['log', '-1', '--pretty=%s']).trim(), 'init');
  });
});

describe('the shards a long suite runs as', () => {
  /** @type {string} */
  let folder;
  beforeEach(() => { folder = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-shards-')); });
  afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));

  /** @param {...string} names */
  const files = (...names) => names.forEach((name) => fs.writeFileSync(path.join(folder, name), ''));
  const suite = () => path.join(folder, 'test-long.cjs');
  const script = (/** @type {string[]} */ names) => `node --test ${names.map((name) => `tests/scripts/${name}`).join(' ')}`;

  it('deals every test to exactly one shard, round the shards in the order they are registered', () => {
    for (const count of [1, 2, 3, 6]) {
      for (let dealt = 0; dealt < 20; dealt++) {
        const holders = Array.from({ length: count }, (_, i) => i + 1).filter((shard) => shards.dealtTo(dealt, count, shard));
        assert.deepStrictEqual(holders, [dealt % count + 1], `test ${dealt} of ${count} shards`);
      }
    }
  });

  it('counts the suite and its shard files, a suite of its own alone and another suite\'s shards apart', () => {
    files('test-long.cjs', 'test-long-shard-2.cjs', 'test-long-shard-3.cjs', 'test-long-er-shard-2.cjs');
    assert.strictEqual(shards.shardCount(suite(), script(['test-long.cjs', 'test-long-shard-2.cjs', 'test-long-shard-3.cjs'])), 3);
    fs.rmSync(path.join(folder, 'test-long-shard-2.cjs'));
    fs.rmSync(path.join(folder, 'test-long-shard-3.cjs'));
    assert.strictEqual(shards.shardCount(suite(), script(['test-long.cjs'])), 1);
  });

  it('refuses shard files numbered with a gap, or not from 2', () => {
    files('test-long.cjs', 'test-long-shard-2.cjs', 'test-long-shard-4.cjs');
    assert.throws(() => shards.shardCount(suite(), script(['test-long.cjs', 'test-long-shard-2.cjs', 'test-long-shard-4.cjs'])), /numbered 2, 4 — they run from 2 on, with no gap/);
  });

  it('refuses a shard file the npm test script does not run, so no share goes unrun', () => {
    files('test-long.cjs', 'test-long-shard-2.cjs', 'test-long-shard-3.cjs');
    assert.throws(() => shards.shardCount(suite(), script(['test-long.cjs', 'test-long-shard-2.cjs'])), /the npm test script does not run test-long-shard-3\.cjs$/);
  });
});

describe('engine harness — a keyword-only checkout', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture('harness-kb-'); seed(dir); });
  afterEach(() => cleanupFixture(dir));

  it('is one a transaction indexes into: the store is real, and says what it holds', () => {
    harness.keywordOnlyKnowledge(dir);
    const res = ok(dir, ['topic', 'complete', 'pay', 'research', 'pay']);
    assert.deepStrictEqual(res.warnings, []);
    assert.deepStrictEqual(harness.indexedFiles(dir), ['pay/research/pay.md']);
  });

  it('holds nothing where the checkout was never set up — the index a warning, no store built', () => {
    const res = ok(dir, ['topic', 'complete', 'pay', 'research', 'pay']);
    assert.match(res.warnings[0], /^knowledge index failed: No knowledge store here/);
    assert.deepStrictEqual(harness.indexedFiles(dir), []);
  });

  it('is one whose index fails, deterministically, where the store cannot be loaded', () => {
    harness.unreadableKnowledge(dir);
    const res = ok(dir, ['topic', 'complete', 'pay', 'research', 'pay']);
    assert.match(res.warnings[0], /^knowledge index failed: loadStore: corrupted store file at /);
  });

  it('answers a command that waits on the embedding provider through callAsync', async () => {
    harness.keywordOnlyKnowledge(dir);
    ok(dir, ['topic', 'complete', 'pay', 'research', 'pay']);
    const answer = await harness.callAsync(dir, ['knowledge', 'query', 'research']);
    assert.strictEqual(answer.code, 0);
    assert.match(answer.stdout, /^\[keyword-only mode — configure embedding provider for semantic search\]\n\[1 results\]\n/);
  });
});
