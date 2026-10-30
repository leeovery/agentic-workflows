'use strict';

// ---------------------------------------------------------------------------
// The state's locks (workflow-engine/scripts/domain/state-worktree.cjs): the
// writer lock, `.leeway/.lock`, that keeps concurrent verbs one after the
// other — held while a verb runs and released after, taken again at once by
// its own holder, taken over at once from a holder that is gone, never
// broken while its holder lives — boot's lock in the main checkout's git
// directory, and two sessions writing state at once (4.S3).
//
// Layer: git. World: real repositories in a temp folder per test, a bare
// repository as the remote (state-worktree-world.cjs). A live holder and each
// session run in processes of their own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const { git, layout, codeProject, tip, remoteTip } = require('./engine-harness.cjs');
const { CHILD_TIMEOUT_MS, useWorld, ignored, childStderr } = require('./state-worktree-world.cjs');

const STATE = path.join(__dirname, '../../skills/workflow-engine/scripts/domain/state-worktree.cjs');
const { STATE_BRANCH, createState, withStateLock, withBootLock } = require(STATE);
const { processStartTime } = require('../../skills/workflow-engine/scripts/kernel/process.cjs');

const world = useWorld();

describe('the writer lock', () => {
  it('is .leeway/.lock, held while the verb runs and released after, whatever it throws', () => {
    const { root } = codeProject(world(), { state: true });
    const lock = path.join(root, layout.lock);

    const held = withStateLock(root, () => JSON.parse(fs.readFileSync(lock, 'utf8')));
    assert.deepStrictEqual(held, { pid: process.pid, pid_start: processStartTime(process.pid) });
    assert.ok(!fs.existsSync(lock));

    assert.throws(() => withStateLock(root, () => { throw new Error('the verb failed'); }), /the verb failed/);
    assert.ok(!fs.existsSync(lock));
  });

  it('takes over at once a lock whose holder is gone, however fresh the lock', () => {
    const { root } = codeProject(world(), { state: true });
    const lock = path.join(root, layout.lock);
    const ended = spawnSync(process.execPath, ['-e', ''], { timeout: CHILD_TIMEOUT_MS }).pid;

    for (const left of [{ pid: ended, pid_start: 'gone' }, { pid: process.pid, pid_start: 'a process before this one' }]) {
      fs.writeFileSync(lock, JSON.stringify(left));
      const started = Date.now();

      const ran = withStateLock(root, () => JSON.parse(fs.readFileSync(lock, 'utf8')).pid_start);

      assert.ok(Date.now() - started < 2000, `waited ${Date.now() - started}ms on ${JSON.stringify(left)}`);
      assert.strictEqual(ran, processStartTime(process.pid));
      assert.ok(!fs.existsSync(lock));
    }
  });

  // A holder in a process of its own: it takes the lock, ages it ten
  // minutes, says it holds it, and keeps it until told to let go.
  const HOLDER = [
    "const fs = require('fs');",
    "const path = require('path');",
    'const [mod, root, signals] = process.argv.slice(1);',
    'const { withStateLock } = require(mod);',
    'withStateLock(root, () => {',
    '  const past = (Date.now() - 600000) / 1000;',
    `  fs.utimesSync(path.join(root, ${JSON.stringify(layout.lock)}), past, past);`,
    "  fs.writeFileSync(path.join(signals, 'held'), '');",
    "  while (!fs.existsSync(path.join(signals, 'go'))) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);",
    '});',
  ].join('\n');

  /** Wait, without blocking the loop, until `ready` holds. @param {() => boolean} ready */
  async function until(ready) {
    const deadline = Date.now() + 10000;
    while (!ready()) {
      if (Date.now() > deadline) throw new Error('waited ten seconds');
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  it('never breaks a live holder, however long it has held: the contender gives up, naming it', async () => {
    const { root } = codeProject(world(), { state: true });
    const lock = path.join(root, layout.lock);
    const holder = spawn(process.execPath, ['-e', HOLDER, STATE, root, world()], { timeout: CHILD_TIMEOUT_MS, killSignal: 'SIGKILL' });
    let stderr = '';
    holder.stderr.on('data', (chunk) => { stderr += chunk; });
    /** @type {Promise<{code: number|null, signal: NodeJS.Signals|null}>} */
    const exited = new Promise((resolve) => holder.on('exit', (code, signal) => resolve({ code, signal })));
    try {
      await until(() => fs.existsSync(path.join(world(), 'held')));

      assert.throws(() => withStateLock(root, () => null, { timeoutMs: 300 }),
        new RegExp(`Timed out waiting for the state lock .*process ${holder.pid} holds it`));
      assert.strictEqual(JSON.parse(fs.readFileSync(lock, 'utf8')).pid, holder.pid);
    } finally {
      fs.writeFileSync(path.join(world(), 'go'), '');
    }
    const { code, signal } = await exited;
    assert.strictEqual(code, 0, childStderr(signal, stderr));
    assert.ok(!fs.existsSync(lock));
  });

  it('is taken again at once by the process holding it, and let go when the outermost hold ends', () => {
    const { root } = codeProject(world(), { state: true });
    const lock = path.join(root, layout.lock);
    const started = Date.now();

    const seen = withStateLock(root, () => {
      const inner = withStateLock(root, () => withStateLock(root, () => fs.existsSync(lock)));
      assert.throws(() => withStateLock(root, () => { throw new Error('the inner verb failed'); }), /the inner verb failed/);
      return [inner, fs.existsSync(lock)];
    });

    assert.ok(Date.now() - started < 2000, `the nested holds waited ${Date.now() - started}ms`);
    assert.deepStrictEqual(seen, [true, true]);
    assert.ok(!fs.existsSync(lock));
  });

  it('leaves the lock alone at release where another holder has taken it', () => {
    const { root } = codeProject(world(), { state: true });
    const lock = path.join(root, layout.lock);
    const other = JSON.stringify({ pid: 1, pid_start: 'another holder' });

    withStateLock(root, () => fs.writeFileSync(lock, other));

    assert.strictEqual(fs.readFileSync(lock, 'utf8'), other);
  });

  it('never shows as a change in the state worktree, nor do the files its claim makes', () => {
    const { root } = codeProject(world(), { state: true });

    const status = withStateLock(root, () => git(root, ['status', '--porcelain', '--untracked-files=all']));

    assert.strictEqual(status, '');
    for (const rel of ['.lock.4242.tmp', '.lock.breaking']) assert.ok(ignored(root, rel), rel);
  });

  it('refuses where there is no state worktree', () => {
    const { root } = codeProject(world());

    assert.throws(() => withStateLock(root, () => null), /no state worktree at/);
  });
});

describe('boot\'s lock', () => {
  it('is .git/leeway-boot.lock in the main checkout, there before the state worktree is, held while boot\'s checks run and released after, whatever they throw', () => {
    const { main, root } = codeProject(world());
    const lock = path.join(main, '.git/leeway-boot.lock');

    const held = withBootLock(root, () => {
      createState(root);
      return JSON.parse(fs.readFileSync(lock, 'utf8'));
    });
    assert.deepStrictEqual(held, { pid: process.pid, pid_start: processStartTime(process.pid) });
    assert.ok(!fs.existsSync(lock));

    assert.throws(() => withBootLock(root, () => { throw new Error('the checks failed'); }), /the checks failed/);
    assert.ok(!fs.existsSync(lock));
  });
});

describe('two sessions writing state at once (4.S3)', () => {
  // One session's verbs: under the writer lock, read the ledger, append its
  // line, commit it — a lost update would show as a missing line.
  const SESSION = [
    "const fs = require('fs');",
    "const path = require('path');",
    'const [mod, root, who, turns] = process.argv.slice(1);',
    'const { withStateLock, commitState } = require(mod);',
    `const ledger = path.join(root, ${JSON.stringify(layout.ledger)});`,
    'for (let i = 1; i <= Number(turns); i++) {',
    '  withStateLock(root, () => {',
    "    const before = fs.existsSync(ledger) ? fs.readFileSync(ledger, 'utf8') : '';",
    '    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15);',
    "    fs.writeFileSync(ledger, before + JSON.stringify({ who, i }) + '\\n');",
    `    const out = commitState(root, [${JSON.stringify(layout.ledger)}], who + ' ' + i);`,
    '    if (out.commit === null || !out.pushed) throw new Error(JSON.stringify(out));',
    '  });',
    '}',
  ].join('\n');

  /** @param {string} root @param {string} who @param {number} turns */
  function session(root, who, turns) {
    const proc = spawn(process.execPath, ['-e', SESSION, STATE, root, who, String(turns)], { timeout: CHILD_TIMEOUT_MS, killSignal: 'SIGKILL' });
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk; });
    return new Promise((resolve) => proc.on('exit', (code, signal) => resolve({ code, stderr: childStderr(signal, stderr) })));
  }

  it('writes one after the other: every line kept, one line per commit, a linear branch with no merge', async () => {
    const { root, bare } = codeProject(world(), { remote: true, state: true });
    const turns = 6;

    const results = await Promise.all([session(root, 'a', turns), session(root, 'b', turns)]);

    for (const r of results) assert.strictEqual(r.code, 0, `a session failed: ${r.stderr}`);
    const lines = git(root, ['show', `${STATE_BRANCH}:${layout.ledger}`]).trim().split('\n').map((line) => JSON.parse(line));
    for (const who of ['a', 'b']) {
      assert.deepStrictEqual(lines.filter((l) => l.who === who).map((l) => l.i), [1, 2, 3, 4, 5, 6], who);
    }
    const commits = git(root, ['rev-list', '--parents', STATE_BRANCH]).trim().split('\n').map((line) => line.split(' '));
    assert.strictEqual(commits.length, 2 * turns + 1);
    assert.ok(commits.every((c) => c.length <= 2), 'a commit with more than one parent');
    assert.strictEqual(git(root, ['rev-list', '--merges', STATE_BRANCH]), '');
    for (const [sha, parent] of commits.slice(0, -1)) {
      assert.strictEqual(git(root, ['diff', '--numstat', parent, sha]), `1\t0\t${layout.ledger}\n`, sha);
    }
    assert.strictEqual(remoteTip(bare), tip(root, STATE_BRANCH));
  });
});
