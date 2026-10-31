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
// handler that stops the command never stops the process. Within a call, its
// git runners share one read of the config's hooks in each folder they run
// in: boot's many git calls read them once in the project and once in the
// state.
//
// A command that waits on the embedding provider answers through
// `engine.runAsync`, the environment held until it settles; `run` refuses to
// answer one it cannot wait for.
//
// The entry dispatches no uninstall, and the release ships no skill or agent
// for one (27.S3).
//
// The last tests pin the two doors together: whatever the in-process entry
// answers, the spawned CLI answers byte for byte.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');

const REPO = path.join(__dirname, '../..');
const ENGINE = path.join(REPO, 'skills/leeway-engine/scripts/engine.cjs');
const engine = require(ENGINE);
const { displayWidth } = require('../../skills/leeway-engine/scripts/kernel/terminal.cjs');

/** A bugfix work unit with one investigation item to write to. */
function seed(dir, name = 'payments') {
  createManifest(dir, name, {
    work_type: 'bugfix',
    phases: { investigation: { items: { [name]: { status: 'in-progress' } } } },
  });
  return name;
}

function manifestOf(dir, name = 'payments') {
  return fs.readFileSync(path.join(dir, '.leeway', name, 'manifest.json'), 'utf8');
}

/** The one presence record a beat leaves, or null. */
function presenceRecord(dir, wu, phase, topic) {
  const file = path.join(dir, '.leeway', '.cache', wu, phase, topic, 'presence');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

/**
 * Run `fn` with this process's environment holding `values`, an undefined
 * one unset, and put every key back as it was, whatever `fn` throws.
 * @param {Record<string, string|undefined>} values @param {() => void} fn
 */
function withProcessEnv(values, fn) {
  const earlier = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  const assign = (/** @type {Record<string, string|undefined>} */ set) => {
    for (const [key, value] of Object.entries(set)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  assign(values);
  try {
    fn();
  } finally {
    assign(earlier);
  }
}

/**
 * The folder of each read of the config's hooks the git processes `fn`
 * starts make, as trace2 records them: `fn` is given the environment to run
 * them under.
 * @param {(env: Record<string, string>) => void} fn
 * @returns {string[]}
 */
function hooksReadIn(fn) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'trace2-'));
  const file = path.join(folder, 'events.json');
  try {
    fn({ GIT_TRACE2_EVENT: file });
    /** @type {Map<string, {argv?: string[], worktree?: string}>} */
    const processes = new Map();
    for (const event of fs.readFileSync(file, 'utf8').trim().split('\n').map((line) => JSON.parse(line))) {
      const seen = processes.get(event.sid) ?? {};
      if (event.event === 'start') seen.argv = event.argv;
      if (event.event === 'def_repo') seen.worktree = event.worktree;
      processes.set(event.sid, seen);
    }
    return [...processes.values()].filter(({ argv }) => argv?.includes('^hook\\..+\\.command$')).map(({ worktree }) => String(worktree));
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

describe('engine.run — the invocation is the caller\'s', () => {
  let dir;

  beforeEach(() => { dir = setupFixture(); seed(dir); });
  afterEach(() => cleanupFixture(dir));

  it('a mutation answers one ok:true JSON line on stdout, exit 0', () => {
    const res = engine.run(['manifest', 'set', 'payments.investigation.payments', 'brief_incorporated=true'], { cwd: dir });
    assert.strictEqual(res.code, 0, res.stderr);
    assert.strictEqual(res.stderr, '');
    assert.strictEqual(res.stdout.split('\n').filter(Boolean).length, 1, 'one line, nothing after it');
    assert.strictEqual(JSON.parse(res.stdout).ok, true);
    assert.match(manifestOf(dir), /"brief_incorporated": true/);
  });

  it('a refusal answers {ok:false} on stderr with exit 1, and writes nothing', () => {
    const before = manifestOf(dir);
    const res = engine.run(['topic', 'complete', 'payments', 'investigation', 'absent'], { cwd: dir });
    assert.strictEqual(res.code, 1);
    assert.strictEqual(res.stdout, '', 'a refusal says nothing on stdout');
    assert.strictEqual(JSON.parse(res.stderr).ok, false);
    assert.strictEqual(manifestOf(dir), before, 'the refused call left the manifest alone');
  });

  it('a bare read writes its bare value to stdout', () => {
    assert.deepStrictEqual(engine.run(['manifest', 'get', 'payments.investigation.payments', 'status'], { cwd: dir }),
      { stdout: 'in-progress\n', stderr: '', code: 0 });
    assert.deepStrictEqual(engine.run(['manifest', 'exists', 'payments.investigation.absent'], { cwd: dir }),
      { stdout: 'false\n', stderr: '', code: 0 });
  });

  it('a read\'s expected miss carries the read\'s own exit code', () => {
    const res = engine.run(['manifest', 'key-of', 'payments.investigation', 'items', 'absent'], { cwd: dir });
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
      engine.run(['manifest', 'set', 'payments.investigation.payments', 'status=completed'], { cwd: other });
      assert.strictEqual(engine.run(['manifest', 'get', 'payments.investigation.payments', 'status'], { cwd: dir }).stdout,
        'in-progress\n', 'the first fixture is untouched');
      assert.strictEqual(engine.run(['manifest', 'get', 'payments.investigation.payments', 'status'], { cwd: other }).stdout,
        'completed\n');
      assert.strictEqual(process.cwd(), here, 'the caller was never chdir-ed');
    } finally {
      cleanupFixture(other);
    }
  });

  it('an environment key is held for the call and restored after it, absent keys included', () => {
    withProcessEnv({ CLAUDE_CODE_SESSION_ID: undefined, CLAUDE_PID: 'ambient' }, () => {
      engine.run(['presence', 'beat', 'payments', 'investigation', 'payments'],
        { cwd: dir, env: { CLAUDE_CODE_SESSION_ID: 'held-session', CLAUDE_PID: String(process.pid) } });
      assert.strictEqual(presenceRecord(dir, 'payments', 'investigation', 'payments').session_id, 'held-session',
        'the call\'s environment reached the domain');
      assert.ok(!('CLAUDE_CODE_SESSION_ID' in process.env), 'a key that was absent is absent again');
      assert.strictEqual(process.env.CLAUDE_PID, 'ambient', 'a key that was set is what it was');
    });
  });

  it('a key the caller takes away is gone for the call', () => {
    withProcessEnv({ CLAUDE_CODE_SESSION_ID: 'ambient-session' }, () => {
      engine.run(['presence', 'beat', 'payments', 'investigation', 'payments'],
        { cwd: dir, env: { CLAUDE_CODE_SESSION_ID: undefined, CLAUDE_PID: String(process.pid) } });
      assert.strictEqual(presenceRecord(dir, 'payments', 'investigation', 'payments').session_id, null,
        'the engine saw no session id at all');
      assert.strictEqual(process.env.CLAUDE_CODE_SESSION_ID, 'ambient-session', 'and it came back');
    });
  });

  it('a call reads the config\'s hooks once in each folder its git runs in — boot\'s many calls in each among them', () => {
    const folders = hooksReadIn((env) => assert.strictEqual(engine.run(['boot'], { cwd: dir, env }).code, 0));

    assert.deepStrictEqual(folders.sort(), [dir, path.join(dir, '.leeway')]);
  });

  it('the display width resolves per call, and the process keeps its own', () => {
    createFile(dir, 'payload.json', JSON.stringify({ missing: ['notes/one.md'] }));
    const ambient = displayWidth();
    const rendered = (w) => engine.run(['render', 'import-reprompt', '--file', 'payload.json'],
      { cwd: dir, env: { LEEWAY_DISPLAY_WIDTH: w } }).stdout;
    const narrow = rendered('40');
    assert.notStrictEqual(rendered('100'), narrow, 'the width a call carries is the width it renders at');
    assert.strictEqual(rendered('40'), narrow, 'and no memo carries the last call\'s width into this one');
    assert.strictEqual(displayWidth(), ambient, 'the process\'s own width is what it was');
  });

  it('stdin is the caller\'s text — the hook verbs read it and nothing else', () => {
    engine.run(['presence', 'beat', 'payments', 'investigation', 'payments'],
      { cwd: dir, env: { CLAUDE_CODE_SESSION_ID: 'ending-session', CLAUDE_PID: String(process.pid) } });
    const res = engine.run(['presence', 'cleanup'], { cwd: dir, stdin: JSON.stringify({ session_id: 'ending-session' }) });
    assert.strictEqual(res.code, 0, res.stderr);
    const answer = JSON.parse(res.stdout);
    assert.strictEqual(answer.session_id, 'ending-session');
    assert.deepStrictEqual(answer.cleared, [{ work_unit: 'payments', phase: 'investigation', topic: 'payments' }]);
    assert.strictEqual(presenceRecord(dir, 'payments', 'investigation', 'payments'), null);
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
    assert.strictEqual(engine.run(['manifest', 'get', 'payments', 'work_type'], { cwd: dir }).stdout, 'bugfix\n',
      'the next call still works');
  });

  it('an unknown command answers the usage on stderr, exit 1', () => {
    const res = engine.run(['nonsense'], { cwd: dir });
    assert.strictEqual(res.code, 1);
    assert.match(res.stderr, /^Usage: engine <command> \[args\]/);
  });

  it('the usage names every command the engine dispatches, each on a line of its own', () => {
    const lines = engine.run(['nonsense'], { cwd: dir }).stderr.split('\n');
    const unnamed = Object.keys(engine.COMMANDS).filter((command) => !lines.some((line) => line.startsWith(`  ${command} `)));
    assert.deepStrictEqual(unnamed, []);
  });
});

describe('no uninstall in the release (27.2.3)', () => {
  it('the engine dispatches no uninstall, and its usage names none — `engine uninstall` answers that usage — and no skill or agent, nor any file of theirs, is one (27.S3)', () => {
    const res = engine.run(['uninstall'], { cwd: os.tmpdir() });
    const shipped = ['skills', 'agents'].flatMap((folder) => /** @type {string[]} */ (fs.readdirSync(path.join(REPO, folder), { recursive: true })));

    assert.strictEqual(res.code, 1);
    assert.match(res.stderr, /^Usage: engine <command> \[args\]\n\nCommands:\n {2}boot /);
    assert.ok(Object.hasOwn(engine.COMMANDS, 'boot') && shipped.includes('leeway') && shipped.includes('leeway-product-researcher.md'));
    assert.deepStrictEqual([...Object.keys(engine.COMMANDS), res.stderr, ...shipped].filter((name) => /uninstall/i.test(name)), []);
  });
});

describe('engine.runAsync — a command that waits on the embedding provider', () => {
  let dir;

  beforeEach(() => {
    dir = setupFixture();
    seed(dir);
    createFile(dir, '.leeway/.knowledge/config.json', '{ "knowledge": { "provider": null } }\n');
    createFile(dir, '.leeway/payments/investigation/payments.md', '# Payments\n\nCards settle nightly.\n');
    engine.run(['knowledge', 'index', '.leeway/payments/investigation/payments.md'], { cwd: dir });
  });
  afterEach(() => cleanupFixture(dir));

  it('answers a knowledge query once it settles', async () => {
    const res = await engine.runAsync(['knowledge', 'query', 'cards settle'], { cwd: dir });
    assert.strictEqual(res.code, 0, res.stderr);
    assert.match(res.stdout, /^\[keyword-only mode — configure embedding provider for semantic search\]\n\[1 results\]\n/);
  });

  it('holds the call\'s environment until the answer settles, then restores it', async () => {
    delete process.env.LEEWAY_PROBE;
    const pending = engine.runAsync(['knowledge', 'query', 'cards'], { cwd: dir, env: { LEEWAY_PROBE: 'held' } });
    assert.strictEqual(process.env.LEEWAY_PROBE, 'held', 'held while the query waits');
    await pending;
    assert.ok(!('LEEWAY_PROBE' in process.env), 'and gone once it answered');
  });

  it('overlapping calls each hold their own environment, and leave none behind', async () => {
    delete process.env.LEEWAY_PROBE;
    const answers = await Promise.all(['first', 'second', 'third'].map((probe) =>
      engine.runAsync(['knowledge', 'query', 'cards'], { cwd: dir, env: { LEEWAY_PROBE: probe } })));
    for (const res of answers) assert.strictEqual(res.code, 0, res.stderr);
    assert.ok(!('LEEWAY_PROBE' in process.env), `left behind: ${process.env.LEEWAY_PROBE}`);
  });

  it('answers a command that never waits exactly as run does', async () => {
    const args = ['manifest', 'get', 'payments.investigation.payments', 'status'];
    assert.deepStrictEqual(await engine.runAsync(args, { cwd: dir }), engine.run(args, { cwd: dir }));
  });

  it('a waiting command\'s failure is its exit code, never a rejection', async () => {
    const res = await engine.runAsync(['knowledge', 'query', 'cards', '--boost:bogus', 'x'], { cwd: dir });
    assert.strictEqual(res.code, 1);
    assert.match(res.stderr, /^Unknown --boost field: "bogus"/);
  });

  it('run refuses a command it cannot wait for, naming runAsync — a raise\'s draw, which waits on its rows\' checks, among them', () => {
    assert.throws(() => engine.run(['knowledge', 'query', 'cards'], { cwd: dir }), /engine knowledge query answers asynchronously — call runAsync/);
    assert.throws(() => engine.run(['raise', 'payments.investigation.payments', '--answers', 'abcd'], { cwd: dir }), /engine raise payments\.investigation\.payments answers asynchronously — call runAsync/);
  });

  it('run refuses a waiting command before it acts — nothing written, the environment untouched', () => {
    const knowledge = path.join(dir, '.leeway', '.knowledge');
    fs.rmSync(path.join(knowledge, 'store.bin'));
    fs.rmSync(path.join(knowledge, 'metadata.json'));
    const conversations = path.join(process.env.LEEWAY_CONFIG_DIR, 'conversations');
    delete process.env.LEEWAY_PROBE;
    assert.throws(
      () => engine.run(['knowledge', 'index'], { cwd: dir, env: { LEEWAY_PROBE: 'held', CLAUDE_CODE_SESSION_ID: 'refused-before-acting' } }),
      /engine knowledge index answers asynchronously — call runAsync/,
    );
    assert.ok(!('LEEWAY_PROBE' in process.env));
    assert.ok(!fs.existsSync(path.join(knowledge, 'store.bin')), 'no store built');
    assert.ok(!fs.existsSync(path.join(conversations, 'refused-before-acting')), 'no conversation marked');
  });

  it('a single-file index answers at once, so run takes it', () => {
    const res = engine.run(['knowledge', 'index', '.leeway/payments/investigation/payments.md'], { cwd: dir });
    assert.strictEqual(res.code, 0, res.stderr);
  });

  it('--dry-run is a switch: it never takes the argument after it as its value', () => {
    const res = engine.run(['knowledge', 'index', '--dry-run', '.leeway/payments/investigation/payments.md'], { cwd: dir });
    assert.strictEqual(res.code, 0, res.stderr);
    assert.match(res.stdout, /^Indexed \d+ chunks from /);
    assert.ok(res.stdout.endsWith(` from ${path.join(dir, '.leeway/payments/investigation/payments.md')}\n`), res.stdout);
  });

  it('the verdict before a knowledge command runs is the one its answer bears out', async () => {
    const { runKnowledge, knowledgeWaits } = require('../../skills/leeway-engine/scripts/domain/knowledge/commands.cjs');
    const forms = [
      ['index'], ['index', '.leeway/payments/investigation/payments.md'], ['query', 'cards'], ['check'], ['status'],
      ['remove', '--work-unit', 'payments', '--dry-run'], ['compact', '--dry-run'], ['rebuild'], ['fill'],
      ['--help'], ['bogus'], [], ['setup', '--keyword-only'],
    ];
    for (const argv of forms) {
      const call = { cwd: dir, out: () => {}, err: () => {}, stdin: () => '' };
      let answer;
      try {
        answer = runKnowledge(call, argv);
      } catch {
        answer = undefined;
      }
      assert.strictEqual(answer instanceof Promise, knowledgeWaits(argv), `knowledge ${argv.join(' ')}`);
      if (answer) await answer.catch(() => {});
    }
  });

  it('the spawned CLI answers a waiting command byte for byte as runAsync does', async () => {
    const args = ['knowledge', 'query', 'cards settle', '--explain'];
    const spawned = spawnSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8' });
    const inProcess = await engine.runAsync(args, { cwd: dir });
    assert.deepStrictEqual(inProcess, { stdout: spawned.stdout, stderr: spawned.stderr, code: spawned.status });
  });
});

describe('the two doors answer alike', () => {
  let dir;

  beforeEach(() => { dir = setupFixture(); seed(dir); });
  afterEach(() => cleanupFixture(dir));

  // The in-process entry is only worth having if it is the CLI. Each case is
  // run both ways against the same state and compared byte for byte.
  for (const [what, args] of Object.entries({
    'a read': ['manifest', 'get', 'payments.investigation.payments', 'status'],
    'an expected miss': ['manifest', 'key-of', 'payments.investigation', 'items', 'absent'],
    'a mutation': ['manifest', 'set', 'payments.investigation.payments', 'brief_incorporated=true'],
    'a refusal': ['topic', 'complete', 'payments', 'investigation', 'absent'],
    'a usage': ['workunit'],
    'a render surface': ['render', 'resume-gate', 'payments.investigation.payments'],
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
