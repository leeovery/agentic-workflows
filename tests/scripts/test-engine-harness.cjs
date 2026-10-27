'use strict';

// The shared engine runner's own contract: each shape answers what its name
// says, the refusal shape asserts the refusal, the call's environment and
// stdin reach the engine, the git fixture is a repo with its state worktree
// that an engine commit lands in, a keyword-only checkout is one a transaction's index builds a real
// store in, and a call's attempts at a lock are seen as it makes them.

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const harness = require('./engine-harness.cjs');
const io = require('../../skills/workflow-engine/scripts/kernel/manifest-io.cjs');
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

describe('engine harness — the attempts at a lock', () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-lock-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('records each attempt at the lock, a lock file\'s or a claim\'s, made or taken — onTaken run before the attempt answers — and no other file\'s', (t) => {
    const lock = path.join(dir, '.lock');
    fs.writeFileSync(lock, String(process.pid));
    /** @type {boolean[]} */
    const heldAt = [];
    const attempts = harness.lockAttempts(t, lock, (taken) => {
      heldAt.push(fs.existsSync(lock));
      if (taken === 2) fs.unlinkSync(lock);
    });

    io.acquireLockFile(lock, 'Timed out', io.LOCK_TIMEOUT_MS);
    io.releaseLockFile(lock);
    /** @type {() => void} */ (io.tryClaimFile(lock))();
    /** @type {() => void} */ (io.tryClaimFile(path.join(dir, 'other')))();

    assert.deepStrictEqual(attempts, ['taken', 'taken', 'made', 'made']);
    assert.deepStrictEqual(heldAt, [true, true]);
  });
});
