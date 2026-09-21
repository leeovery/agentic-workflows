'use strict';

// ---------------------------------------------------------------------------
// The engine's in-process entry (`engine.run`) — the door a test harness takes.
//
// The contract is the CLI's: the same argv, the same two streams, the same
// exit codes. What the entry adds is that the invocation is supplied rather
// than taken from the process — the directory, the environment, the stdin —
// and that nothing of it survives the call. These tests hold that boundary:
// two calls in two directories never cross, an environment key is held for
// one call and restored after it, the width memo resolves per call, and a
// handler that stops the command never stops the process.
//
// The last test pins the two doors together: whatever `run` answers, the
// spawned CLI answers byte for byte.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');
const engine = require(ENGINE);
const { displayWidth } = require('../../skills/workflow-engine/scripts/kernel/terminal.cjs');

/** A feature work unit with one research item to write to. */
function seed(dir, name = 'payments') {
  createManifest(dir, name, {
    work_type: 'feature',
    phases: { research: { items: { [name]: { status: 'in-progress' } } } },
  });
  return name;
}

function manifestOf(dir, name = 'payments') {
  return fs.readFileSync(path.join(dir, '.workflows', name, 'manifest.json'), 'utf8');
}

/** The one presence record a beat leaves, or null. */
function presenceRecord(dir, wu, phase, topic) {
  const file = path.join(dir, '.workflows', '.cache', wu, phase, topic, 'presence');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

describe('engine.run — the invocation is the caller\'s', () => {
  let dir;

  beforeEach(() => { dir = setupFixture(); seed(dir); });
  afterEach(() => cleanupFixture(dir));

  it('a mutation answers one ok:true JSON line on stdout, exit 0', () => {
    const res = engine.run(['manifest', 'set', 'payments.research.payments', 'brief_incorporated=true'], { cwd: dir });
    assert.strictEqual(res.code, 0, res.stderr);
    assert.strictEqual(res.stderr, '');
    assert.strictEqual(res.stdout.split('\n').filter(Boolean).length, 1, 'one line, nothing after it');
    assert.strictEqual(JSON.parse(res.stdout).ok, true);
    assert.match(manifestOf(dir), /"brief_incorporated": true/);
  });

  it('a refusal answers {ok:false} on stderr with exit 1, and writes nothing', () => {
    const before = manifestOf(dir);
    const res = engine.run(['topic', 'complete', 'payments', 'research', 'absent'], { cwd: dir });
    assert.strictEqual(res.code, 1);
    assert.strictEqual(res.stdout, '', 'a refusal says nothing on stdout');
    assert.strictEqual(JSON.parse(res.stderr).ok, false);
    assert.strictEqual(manifestOf(dir), before, 'the refused call left the manifest alone');
  });

  it('a bare read writes its bare value to stdout', () => {
    assert.deepStrictEqual(engine.run(['manifest', 'get', 'payments.research.payments', 'status'], { cwd: dir }),
      { stdout: 'in-progress\n', stderr: '', code: 0 });
    assert.deepStrictEqual(engine.run(['manifest', 'exists', 'payments.research.absent'], { cwd: dir }),
      { stdout: 'false\n', stderr: '', code: 0 });
  });

  it('a read\'s expected miss carries the read\'s own exit code', () => {
    const res = engine.run(['manifest', 'key-of', 'payments.research', 'items', 'absent'], { cwd: dir });
    assert.strictEqual(res.code, 2, 'an expected miss is 2, not a refusal');
    assert.match(res.stderr, /^Error: Value "absent" not found/);
    assert.strictEqual(res.stdout, '');
  });

  it('a render surface answers its sections on stdout', () => {
    createFile(dir, 'payload.json', JSON.stringify({ missing: ['notes/one.md'] }));
    const res = engine.run(['render', 'import-reprompt', '--file', 'payload.json'], { cwd: dir });
    assert.strictEqual(res.code, 0, res.stderr);
    assert.match(res.stdout, /^=== DISPLAY: missing imports/);
    assert.match(res.stdout, /=== MENU: import reprompt/);
  });

  it('a response owed to stderr goes there, and stdout stays empty', () => {
    const res = engine.run(['session', 'resume', 'no-such-session'], { cwd: dir });
    assert.strictEqual(res.code, 0, res.stderr);
    assert.strictEqual(res.stdout, '', 'a SessionStart hook target keeps stdout clean');
    assert.strictEqual(JSON.parse(res.stderr).ok, true);
  });

  it('two calls in two directories never cross, and the process never moves', () => {
    const here = process.cwd();
    const other = setupFixture();
    try {
      seed(other);
      engine.run(['manifest', 'set', 'payments.research.payments', 'status=completed'], { cwd: other });
      assert.strictEqual(engine.run(['manifest', 'get', 'payments.research.payments', 'status'], { cwd: dir }).stdout,
        'in-progress\n', 'the first fixture is untouched');
      assert.strictEqual(engine.run(['manifest', 'get', 'payments.research.payments', 'status'], { cwd: other }).stdout,
        'completed\n');
      assert.strictEqual(process.cwd(), here, 'the caller was never chdir-ed');
    } finally {
      cleanupFixture(other);
    }
  });

  it('an environment key is held for the call and restored after it, absent keys included', () => {
    delete process.env.CLAUDE_CODE_SESSION_ID;
    process.env.CLAUDE_PID = 'ambient';
    engine.run(['presence', 'beat', 'payments', 'research', 'payments'],
      { cwd: dir, env: { CLAUDE_CODE_SESSION_ID: 'held-session', CLAUDE_PID: String(process.pid) } });
    assert.strictEqual(presenceRecord(dir, 'payments', 'research', 'payments').session_id, 'held-session',
      'the call\'s environment reached the domain');
    assert.ok(!('CLAUDE_CODE_SESSION_ID' in process.env), 'a key that was absent is absent again');
    assert.strictEqual(process.env.CLAUDE_PID, 'ambient', 'a key that was set is what it was');
    delete process.env.CLAUDE_PID;
  });

  it('a key the caller takes away is gone for the call', () => {
    process.env.CLAUDE_CODE_SESSION_ID = 'ambient-session';
    try {
      engine.run(['presence', 'beat', 'payments', 'research', 'payments'],
        { cwd: dir, env: { CLAUDE_CODE_SESSION_ID: undefined, CLAUDE_PID: String(process.pid) } });
      assert.strictEqual(presenceRecord(dir, 'payments', 'research', 'payments').session_id, null,
        'the engine saw no session id at all');
      assert.strictEqual(process.env.CLAUDE_CODE_SESSION_ID, 'ambient-session', 'and it came back');
    } finally {
      delete process.env.CLAUDE_CODE_SESSION_ID;
    }
  });

  it('the display width resolves per call, and the process keeps its own', () => {
    createFile(dir, 'payload.json', JSON.stringify({ missing: ['notes/one.md'] }));
    const ambient = displayWidth();
    const rendered = (w) => engine.run(['render', 'import-reprompt', '--file', 'payload.json'],
      { cwd: dir, env: { WORKFLOWS_DISPLAY_WIDTH: w } }).stdout;
    const narrow = rendered('40');
    assert.notStrictEqual(rendered('100'), narrow, 'the width a call carries is the width it renders at');
    assert.strictEqual(rendered('40'), narrow, 'and no memo carries the last call\'s width into this one');
    assert.strictEqual(displayWidth(), ambient, 'the process\'s own width is what it was');
  });

  it('stdin is the caller\'s text — the hook verbs read it and nothing else', () => {
    engine.run(['presence', 'beat', 'payments', 'research', 'payments'],
      { cwd: dir, env: { CLAUDE_CODE_SESSION_ID: 'ending-session', CLAUDE_PID: String(process.pid) } });
    const res = engine.run(['presence', 'cleanup'], { cwd: dir, stdin: JSON.stringify({ session_id: 'ending-session' }) });
    assert.strictEqual(res.code, 0, res.stderr);
    const answer = JSON.parse(res.stdout);
    assert.strictEqual(answer.session_id, 'ending-session');
    assert.deepStrictEqual(answer.cleared, [{ work_unit: 'payments', phase: 'research', topic: 'payments' }]);
    assert.strictEqual(presenceRecord(dir, 'payments', 'research', 'payments'), null);
  });

  it('no stdin is empty stdin — a hook verb with nothing to read answers, never blocks', () => {
    const res = engine.run(['presence', 'cleanup'], { cwd: dir });
    assert.strictEqual(res.code, 0, res.stderr);
    assert.deepStrictEqual(JSON.parse(res.stdout), { ok: true, session_id: null, cleared: [] });
  });

  it('a handler that throws without answering gets the CLI\'s last word, and the process lives on', () => {
    const res = engine.run(['render', 'tree'], { cwd: dir, stdin: 'not json at all' });
    assert.strictEqual(res.code, 1);
    assert.strictEqual(res.stdout, '');
    assert.ok(res.stderr.trim().length > 0, 'the message is on stderr');
    assert.throws(() => JSON.parse(res.stderr), 'and it is a message, not a refusal response');
    assert.strictEqual(engine.run(['manifest', 'get', 'payments', 'work_type'], { cwd: dir }).stdout, 'feature\n',
      'the next call still works');
  });

  it('an unknown command answers the usage on stderr, exit 1', () => {
    const res = engine.run(['nonsense'], { cwd: dir });
    assert.strictEqual(res.code, 1);
    assert.match(res.stderr, /^Usage: engine <command> \[args\]/);
  });
});

describe('the two doors answer alike', () => {
  let dir;

  beforeEach(() => { dir = setupFixture(); seed(dir); });
  afterEach(() => cleanupFixture(dir));

  // The in-process entry is only worth having if it is the CLI. Each case is
  // run both ways against the same state and compared byte for byte.
  for (const [what, args] of Object.entries({
    'a read': ['manifest', 'get', 'payments.research.payments', 'status'],
    'an expected miss': ['manifest', 'key-of', 'payments.research', 'items', 'absent'],
    'a mutation': ['manifest', 'set', 'payments.research.payments', 'brief_incorporated=true'],
    'a refusal': ['topic', 'complete', 'payments', 'research', 'absent'],
    'a usage': ['workunit'],
    'a render surface': ['render', 'resume-gate', 'payments.research.payments'],
  })) {
    it(what, () => {
      const spawned = spawnSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8' });
      const inProcess = engine.run(args, { cwd: dir });
      assert.deepStrictEqual(
        { stdout: inProcess.stdout, stderr: inProcess.stderr, code: inProcess.code },
        { stdout: spawned.stdout, stderr: spawned.stderr, code: spawned.status });
    });
  }
});
