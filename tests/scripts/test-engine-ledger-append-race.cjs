'use strict';

// ---------------------------------------------------------------------------
// The ledger's appends made at once by two processes
// (leeway-engine/scripts/domain/ledger-write.cjs): each lands under an id of
// its own, none a sequence, every write committed with no merge, and a read
// made while they land meeting whole lines only (5.S2).
//
// Layer: process. World: a project with its state worktree from the fixture
// library, the work unit's manifest written there; two writers spawned, the
// test reading the ledger while they land.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { spawn } = require('child_process');
const { ENGINE, stateGit, statePath, layout, ledgerEntries, cleanupFixture } = require('./engine-harness.cjs');
const { NOTE, ID, ledgerWriteHelpers, ledgerWorld } = require('./ledger-world.cjs');

/** @type {string} */
let dir;

beforeEach(() => {
  dir = ledgerWorld('ledger-append-race-');
});

afterEach(() => {
  cleanupFixture(dir);
});

const { entries, ledgerText } = ledgerWriteHelpers(() => dir);

describe('two processes appending at once (5.S2)', () => {
  it('lands two processes\' appends made at once, under ids that differ and are no sequence, a read made meanwhile meeting whole lines only (5.S2)', async () => {
    const EACH = 6;
    const script = [
      'const engine = require(process.argv[1]);',
      'const [cwd, session] = process.argv.slice(2);',
      `for (let i = 0; i < ${EACH}; i += 1) {`,
      `  const res = engine.run(['ledger', 'ask', '${NOTE}'], { cwd, env: { CLAUDE_CODE_SESSION_ID: session }, stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: session + ' asks ' + i }) });`,
      '  if (res.code !== 0) { process.stderr.write(res.stderr); process.exit(1); }',
      '}',
    ].join('\n');
    const WRITER_TIMEOUT_MS = 30000;
    const READS = 6000;
    const writers = ['session-a', 'session-b'].map((session) => {
      const child = spawn('node', ['-e', script, ENGINE, dir, session], { stdio: ['ignore', 'ignore', 'pipe'], timeout: WRITER_TIMEOUT_MS, killSignal: 'SIGKILL' });
      let stderr = '';
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      return new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, stderr: signal ? `killed after ${WRITER_TIMEOUT_MS}ms\n${stderr}` : stderr })));
    });
    let done = false;
    const landed = Promise.all(writers).finally(() => { done = true; });
    const file = statePath(dir, layout.ledger);
    let meanwhile = 0;
    let read = 0;

    for (let reads = 0; !done; reads += 1) {
      assert.ok(reads < READS, `the two writers had not both ended after ${READS} reads`);
      if (fs.existsSync(file)) {
        const text = fs.readFileSync(file, 'utf8');
        assert.ok(text.endsWith('\n'), `a read met half a line: …${JSON.stringify(text.slice(-60))}`);
        const count = text.split('\n').slice(0, -1).map((line) => JSON.parse(line)).length;
        const through = ledgerEntries(statePath(dir)).length;
        assert.ok(through >= count, 'the engine\'s read met fewer entries than the file held before it');
        read = Math.max(read, through);
        if (count > 0 && count < 2 * EACH) meanwhile += 1;
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    for (const outcome of /** @type {{code: number, stderr: string}[]} */ (await landed)) assert.strictEqual(outcome.code, 0, outcome.stderr);
    assert.ok(meanwhile > 0, 'no read was made while the appends landed');
    const all = entries();
    const ids = all.map((e) => e.id);
    assert.strictEqual(all.length, 2 * EACH);
    assert.strictEqual(new Set(ids).size, ids.length, 'two appends took one id');
    assert.ok(ids.every((id) => ID.test(id) && !/^\d+$/.test(id)), `an id is a sequence number: ${ids.join(' ')}`);
    for (const session of ['session-a', 'session-b']) {
      assert.deepStrictEqual(all.filter((e) => e.session === session).map((e) => e.text), [...Array(EACH).keys()].map((i) => `${session} asks ${i}`));
    }
    assert.strictEqual(stateGit(dir, ['show', `HEAD:${layout.ledger}`]), ledgerText());
    assert.strictEqual(stateGit(dir, ['rev-list', '--merges', 'HEAD']), '');
  });
});
