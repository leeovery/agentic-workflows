'use strict';

// The shared engine runner's own contract: each shape answers what its name
// says, the refusal shape asserts the refusal, the call's environment and
// stdin reach the engine, the git fixture is a repo an engine commit lands
// in, and the stubbed tree is the one the engine resolves its knowledge CLI
// against.

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const harness = require('./engine-harness.cjs');
const { call, ok, okSections, refuses, output, git, setupGitFixture, cleanupFixture } = harness;

const OWN = { CLAUDE_PID: String(process.pid), CLAUDE_CODE_SESSION_ID: 'sess-own' };
const PEER = { CLAUDE_PID: '1', CLAUDE_CODE_SESSION_ID: 'sess-peer' };

/** A feature with one research item, committed. */
function seed(dir, { commit = true } = {}) {
  const wu = path.join(dir, '.workflows', 'pay');
  fs.mkdirSync(path.join(wu, 'research'), { recursive: true });
  fs.writeFileSync(path.join(wu, 'manifest.json'), JSON.stringify({
    name: 'pay',
    work_type: 'feature',
    status: 'in-progress',
    phases: { research: { items: { pay: { status: 'in-progress' } } } },
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(wu, 'research', 'pay.md'), '# Research\n');
  if (commit) {
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'init']);
  }
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
    const before = fs.readFileSync(path.join(dir, '.workflows/pay/manifest.json'), 'utf8');
    assert.match(refuses(dir, ['topic', 'complete', 'pay', 'research', 'absent']).error, /absent/);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows/pay/manifest.json'), 'utf8'), before);
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
    const record = JSON.parse(fs.readFileSync(path.join(dir, '.workflows/.cache/pay/research/pay/presence'), 'utf8'));
    assert.strictEqual(record.session_id, 'sess-own');

    ok(dir, ['presence', 'beat', 'pay', 'research', 'pay'], { env: { ...OWN, CLAUDE_CODE_SESSION_ID: undefined } });
    const anonymous = JSON.parse(fs.readFileSync(path.join(dir, '.workflows/.cache/pay/research/pay/presence'), 'utf8'));
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

  it('is a repo on main with a `.workflows/` tree and an identity that can commit', () => {
    assert.ok(fs.existsSync(path.join(dir, '.workflows')));
    assert.strictEqual(git(dir, ['symbolic-ref', '--short', 'HEAD']).trim(), 'main');
    seed(dir);
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%an']).trim(), 'Test');
  });

  it('is a repo an engine commit lands in', () => {
    seed(dir);
    fs.writeFileSync(path.join(dir, '.workflows/pay/research/pay.md'), '# Research\n\nMore.\n');
    const res = ok(dir, ['commit', 'pay', '-m', 'research(pay): notes', '--topic', 'research/pay']);
    assert.strictEqual(res.committed, git(dir, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'research(pay): notes');
  });
});

describe('engine harness — the stubbed tree', () => {
  let dir;
  const stubbed = harness.stubbedEngine();
  beforeEach(() => { dir = setupGitFixture('harness-stub-'); seed(dir); });
  afterEach(() => cleanupFixture(dir));

  it('is the tree the engine resolves its knowledge CLI against — the store is never reached', () => {
    const res = stubbed.ok(dir, ['topic', 'complete', 'pay', 'research', 'pay']);
    assert.deepStrictEqual(res.warnings, [], 'the stub answers where the real CLI would have failed');
    assert.deepStrictEqual(harness.knowledgeCalls(dir), ['index .workflows/pay/research/pay.md']);
    assert.ok(!fs.existsSync(path.join(dir, '.workflows/.knowledge')));
  });

  it('is one tree per process, and the repo\'s own engine is a separate door', () => {
    assert.strictEqual(harness.stubbedEngine(), stubbed);
    ok(dir, ['topic', 'complete', 'pay', 'research', 'pay']);
    assert.deepStrictEqual(harness.knowledgeCalls(dir), [], 'the real engine never reaches the stub');
  });
});
