'use strict';

// ---------------------------------------------------------------------------
// The ledger copies' render under concurrent engines
// (workflow-engine/scripts/domain/ledger-copies.cjs): one render at a time,
// a write landing while another holds the claim returning once the holder
// has rendered and indexed it; a change to what is live that undoes another
// mid-render, the copies ending as the last change left them; a render that
// fails part way leaving no write behind; and the claim taken over from a
// holder killed part way.
//
// Layer: process. World: a project with its state worktree from the fixture
// library, its knowledge set up keyword-only; the unit's manifest written
// there. Each contender is an engine of its own, and each race waits on a
// barrier: the commit and the copy the holder has written, or the copies
// marked outdated.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
// The seams go in before the engine loads, so the copies' render binds them.
const { seams, clearSeams } = require('./ledger-copies-seams.cjs');
const { UNIT, SESSION, MADE, NOTE, NOTE_COPY, copiesHelpers, copiesWorld } = require('./ledger-world.cjs');
const { ENGINE, ok, indexedFiles, statePath, stateGit, cleanupFixture } = require('./engine-harness.cjs');
const { knowledgeFiles } = require(path.join(SCRIPTS, 'kernel/knowledge/files.cjs'));

/** @type {string} */
let dir;

beforeEach(() => {
  dir = copiesWorld();
});

afterEach(() => {
  clearSeams();
  cleanupFixture(dir);
});

const { write, ask, copy, indexedText, floatingPanel } = copiesHelpers(() => dir);

/**
 * One engine command run as its own process: its pid, and once it ends its
 * exit code and what `atExit` saw the moment it did.
 * @template T
 * @param {string[]} args @param {Record<string, unknown>|null} content its stdin, none where null
 * @param {() => T} [atExit]
 * @returns {{pid: number|undefined, done: Promise<{code: number|null, seen: T|undefined}>}}
 */
function spawnEngine(args, content, atExit) {
  const stdin = stdinFile(content);
  const child = spawn('node', [ENGINE, ...args], { cwd: dir, env: { ...process.env, ...SESSION }, stdio: [stdin, 'ignore', 'ignore'] });
  fs.closeSync(stdin);
  return { pid: child.pid, done: new Promise((resolve) => child.on('close', (code) => resolve({ code, seen: atExit?.() }))) };
}

/**
 * One engine command run under a shell of its own, which reaps it the moment
 * it is killed even while this process is busy: its process id, once
 * written, and its end.
 * @param {string[]} args @param {Record<string, unknown>} content
 */
function spawnReaped(args, content) {
  const pidFile = path.join(dir, `pid-${spawned += 1}`);
  const input = stdinPath(content);
  const shell = spawn('sh', ['-c', '"$@" < "$LEEWAY_TEST_STDIN" & echo $! > "$LEEWAY_TEST_PID"; wait', 'sh', 'node', ENGINE, ...args], {
    cwd: dir, env: { ...process.env, ...SESSION, LEEWAY_TEST_STDIN: input, LEEWAY_TEST_PID: pidFile }, stdio: 'ignore',
  });
  return { pid: () => (fs.existsSync(pidFile) ? Number(fs.readFileSync(pidFile, 'utf8')) || null : null), done: new Promise((resolve) => shell.on('close', resolve)) };
}

/** A command's stdin as an open file, so it reads it whole even while a seam holds this process. @param {Record<string, unknown>|null} content none where null */
function stdinFile(content) {
  return fs.openSync(stdinPath(content), 'r');
}

/** A command's stdin written to a file: its path. @param {Record<string, unknown>|null} content none where null */
function stdinPath(content) {
  const input = path.join(dir, `stdin-${spawned += 1}.json`);
  fs.writeFileSync(input, content === null ? '' : JSON.stringify({ ...MADE, ...content }));
  return input;
}

/** How many engine processes this suite has started. */
let spawned = 0;

/** A synchronous wait, for a seam that runs inside the engine's own call. @param {() => boolean} reached */
function holdUntil(reached) {
  const pause = new Int32Array(new SharedArrayBuffer(4));
  for (let tries = 0; !reached() && tries < 400; tries += 1) Atomics.wait(pause, 0, 0, 50);
}

/** The state branch's commit count. */
function commits() {
  return Number(stateGit(dir, ['rev-list', '--count', 'HEAD']));
}

/** A barrier: waits until `reached` holds, failing with `what` after half a minute. @param {() => boolean} reached @param {string} what */
async function until(reached, what) {
  for (let tries = 0; !reached() && tries < 600; tries += 1) await new Promise((resolve) => setTimeout(resolve, 50));
  assert.ok(reached(), what);
}

describe('a record\'s copy (5.8.12, 22.6.6, 22.6.7)', () => {
  it('renders one at a time and no writer waits on its claim: a write that lands while a render holds it returns once the holder has rendered and indexed it, the store ending with the later text (5.8.12, 5.S22)', async () => {
    const { decision } = floatingPanel();
    const files = knowledgeFiles(statePath(dir));
    fs.writeFileSync(files.lock, String(process.pid));
    const before = commits();
    const holder = spawnEngine(['ledger', 'replace', NOTE, '--replaces', decision, '--reason', 'changed-mind'], { text: 'A framed panel.', why: 'Frames read as furniture.', drops: ['the old one'] });
    /** @type {ReturnType<typeof spawnEngine<{copy: string|null, indexed: string}>>|null} */
    let later = null;
    try {
      // The barrier: the holder has rendered its write and waits on the store inside its index pass.
      await until(() => commits() === before + 1 && /A framed panel\./.test(copy(NOTE_COPY) ?? ''), 'the replace did not commit and render');
      const marked = fs.readFileSync(files.copiesOutdated, 'utf8');
      later = spawnEngine(['ledger', 'find', NOTE], { text: 'Panels float above every Space.', how: 'a spike' }, () => ({ copy: copy(NOTE_COPY), indexed: indexedText() }));
      await until(() => commits() === before + 2 && fs.readFileSync(files.copiesOutdated, 'utf8') !== marked, 'the finding did not commit and mark the copies');

      assert.strictEqual(JSON.parse(fs.readFileSync(files.copies, 'utf8')).pid, holder.pid, 'the holder let the claim go before its index pass');
      assert.doesNotMatch(/** @type {string} */ (copy(NOTE_COPY)), /Finding/, 'the later write rendered while another held the claim');
    } finally {
      fs.rmSync(files.lock, { force: true });
    }
    const [held, landed] = await Promise.all([holder.done, /** @type {NonNullable<typeof later>} */ (later).done]);
    assert.deepStrictEqual([held.code, landed.code], [0, 0]);

    // What the later writer's own session would read the moment it returned.
    const seen = /** @type {{copy: string, indexed: string}} */ (landed.seen);
    assert.match(seen.copy, /^## Finding: Panels float above every Space\.$/m);
    assert.match(seen.indexed, /Panels float above every Space\./);
    assert.ok(!fs.existsSync(files.copies), 'the holder kept the claim');
    const text = /** @type {string} */ (copy(NOTE_COPY));
    assert.match(text, /^A framed panel\.$/m);
    assert.match(text, /^## Finding: Panels float above every Space\.$/m);
    const indexed = indexedText();
    assert.match(indexed, /A framed panel\./);
    assert.match(indexed, /Panels float above every Space\./);
    assert.doesNotMatch(indexed, /floating/i);
  });

  it('follows a change to what is live that undoes another while its render is part way through: the copies end as the last change left them (5.8.17)', async () => {
    ask(NOTE, 'Is a note a window?');
    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);
    const files = knowledgeFiles(statePath(dir));
    /** @type {ReturnType<typeof spawnEngine>|null} */
    let undoing = null;
    seams.folded = () => {
      seams.folded = null;
      const marked = fs.readFileSync(files.copiesOutdated, 'utf8');
      undoing = spawnEngine(['topic', 'cancel', UNIT, 'discovery', 'note-window'], null);
      holdUntil(() => fs.readFileSync(files.copiesOutdated, 'utf8') !== marked);
    };

    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'note-window']);
    assert.strictEqual((await /** @type {NonNullable<typeof undoing>} */ (undoing).done).code, 0);

    assert.strictEqual(copy(NOTE_COPY), null);
    assert.deepStrictEqual(indexedFiles(dir), []);
  });

  it('leaves no write behind where its render fails part way: the claim comes free, and the writer it held back renders its own write (22.6.15)', async () => {
    const question = ask(NOTE, 'Is a note a window?');
    const files = knowledgeFiles(statePath(dir));
    /** @type {ReturnType<typeof spawnEngine<string|null>>|null} */
    let waiting = null;
    seams.folded = () => {
      seams.folded = null;
      const marked = fs.readFileSync(files.copiesOutdated, 'utf8');
      waiting = spawnEngine(['ledger', 'find', NOTE], { text: 'Panels float above every Space.', how: 'a spike' }, () => copy(NOTE_COPY));
      holdUntil(() => fs.readFileSync(files.copiesOutdated, 'utf8') !== marked);
      throw new Error('the render broke');
    };

    const decided = write('decide', NOTE, ['--answers', question], { ...MADE, text: 'A floating panel.', why: 'It follows the person.' });
    assert.match(decided.warnings.join('\n'), /^knowledge record render failed: the render broke/m);
    const found = await /** @type {NonNullable<typeof waiting>} */ (waiting).done;

    assert.strictEqual(found.code, 0);
    assert.match(/** @type {string} */ (found.seen), /^## Finding: Panels float above every Space\.$/m);
    assert.match(/** @type {string} */ (found.seen), /^A floating panel\.$/m);
    assert.match(indexedText(), /Panels float above every Space\./);
  });

  it('takes the claim over from a holder killed part way, once its process is gone: the writer waiting on it renders its own write', async () => {
    const { decision } = floatingPanel();
    const files = knowledgeFiles(statePath(dir));
    fs.writeFileSync(files.lock, String(process.pid));
    const before = commits();
    const holder = spawnReaped(['ledger', 'replace', NOTE, '--replaces', decision, '--reason', 'changed-mind'], { text: 'A framed panel.', why: 'Frames read as furniture.', drops: ['the old one'] });
    try {
      // The barrier: the holder has rendered its write and waits on the store inside its index pass.
      await until(() => commits() === before + 1 && /A framed panel\./.test(copy(NOTE_COPY) ?? '') && holder.pid() !== null, 'the replace did not commit and render');
      // The holder is killed while the write below waits on it — a second into a wait bounded at ten.
      const killer = spawn('sh', ['-c', 'sleep 1; kill -9 "$0"; rm -f "$1"', String(holder.pid()), files.lock], { stdio: 'ignore' });
      const found = write('find', NOTE, [], { ...MADE, text: 'Panels float above every Space.', how: 'a spike' });
      await new Promise((resolve) => killer.on('close', resolve));

      assert.deepStrictEqual(found.warnings ?? [], []);
      const text = /** @type {string} */ (copy(NOTE_COPY));
      assert.match(text, /^A framed panel\.$/m);
      assert.match(text, /^## Finding: Panels float above every Space\.$/m);
      assert.match(indexedText(), /Panels float above every Space\./);
      assert.doesNotMatch(indexedText(), /floating/i);
    } finally {
      fs.rmSync(files.lock, { force: true });
      await holder.done;
    }
  });
});
