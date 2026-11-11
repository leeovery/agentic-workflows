'use strict';

// ---------------------------------------------------------------------------
// Worlds built once per run (run-worlds.cjs): a world's key, hashed from its
// name and the sources that could build it; built in process where the run
// names no folder; built once under its claim by the first of two processes
// that ask at once and renamed into place whole, the other waiting and
// taking it; a build that fails leaving its error, which every later asker
// meets at once; a world placed between a look and a claim never built
// again; a dead builder's claim taken over by the next to ask; and a builder
// alive past the wait limit left to finish while the waiter, having looked
// once a pause, builds its own.
//
// Layer: process, for the race and the wait limit, each asker a child; the
// rest in process.
// World: a stand-in world — a folder holding the pid of the process that
// built it — and a temp folder for the run's worlds.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { contend, withEnv } = require('./engine-harness.cjs');
const { tryClaimFile } = require('../../skills/leeway-engine/scripts/kernel/manifest-io.cjs');
const { worldOfTheRun, worldKey } = require('./run-worlds.cjs');

const RUN_WORLDS = path.join(__dirname, 'run-worlds.cjs');
// A claim whose holder is no process: no pid is ever this high.
const DEAD = JSON.stringify({ pid: 2147483646, pid_start: null });
// No wait: a claim still held has the asker build its own at once, so one
// that should have come free fails the test rather than holding it.
const AT_ONCE = Object.freeze({ limitMs: 0 });
// A wait long enough to look several times, short enough to cost the suite little.
const LIMIT_MS = 300;
const POLL_MS = 100;

describe('worlds built once per run', () => {
  /** @type {string} */ let tmp;
  /** @type {string} */ let folder;
  /** @type {string[]} */ let builds;
  /** A stand-in world's build, counted: the pid that built it, written in it. @param {string} dir */
  const build = (dir) => {
    builds.push(dir);
    fs.writeFileSync(path.join(dir, 'built-by'), String(process.pid));
  };
  /** A unique world's name, so no test meets another's in this process. @param {string} what */
  const named = (what) => `stand-in ${what} ${path.basename(tmp)}`;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'run-worlds-'));
    folder = path.join(tmp, 'worlds');
    fs.mkdirSync(folder);
    builds = [];
  });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('keys a world by its name and by the path and bytes of every file under skills/ and of the test library; never by a suite, where the tree sits, or when it was written', () => {
    const files = { 'skills/a/scripts/engine.cjs': 'one', 'tests/scripts/a-world.cjs': 'two', 'tests/scripts/test-a.cjs': 'three' };
    /** A sources tree of `files`, `changed` over them, a file changed to null gone. @param {string} name @param {Record<string, string|null>} [changed] */
    const tree = (name, changed = {}) => {
      const root = path.join(tmp, name);
      for (const [file, text] of Object.entries({ ...files, ...changed })) {
        if (text === null) continue;
        fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        fs.writeFileSync(path.join(root, file), text);
      }
      return root;
    };
    const key = worldKey('cutClosed', tree('as-is'));
    assert.match(key, /^cutClosed-[0-9a-f]{16}$/);
    assert.strictEqual(worldKey('cutClosed', tree('the-same')), key, 'the same sources elsewhere, written later: the same key');
    assert.notStrictEqual(worldKey('specToBuild', tree('as-is')), key, 'another name');
    assert.notStrictEqual(worldKey('cut closed', tree('as-is')), worldKey('cut-closed', tree('as-is')), 'two names, their folders\' names read the same');
    assert.notStrictEqual(worldKey('cutClosed', tree('engine', { 'skills/a/scripts/engine.cjs': 'one, changed' })), key, 'a skill\'s file changed');
    assert.notStrictEqual(worldKey('cutClosed', tree('library', { 'tests/scripts/a-world.cjs': 'two, changed' })), key, 'a library module changed');
    assert.notStrictEqual(worldKey('cutClosed', tree('added', { 'skills/a/SKILL.md': 'new' })), key, 'a file added');
    assert.notStrictEqual(worldKey('cutClosed', tree('moved', { 'skills/a/scripts/engine.cjs': null, 'skills/a/scripts/kernel.cjs': 'one' })), key, 'a file moved');
    assert.strictEqual(worldKey('cutClosed', tree('suite', { 'tests/scripts/test-a.cjs': 'three, changed' })), key, 'a suite changed builds no world');
  });

  it('a run naming no folder: the world built in this process, in a folder of its own, once however often it is asked for', () => {
    withEnv({ LEEWAY_TEST_WORLDS: undefined }, () => {
      const world = worldOfTheRun(named('alone'), build);
      assert.strictEqual(world.how, 'alone');
      assert.strictEqual(fs.readFileSync(path.join(world.dir, 'built-by'), 'utf8'), String(process.pid));
      assert.deepStrictEqual(worldOfTheRun(named('alone'), build), world, 'asked again: the same');
      assert.deepStrictEqual(builds, [world.dir], 'built once');
    });
  });

  it('two processes asking at once: the first to claim it builds it, the other waits on the claim, never meets it half built, and takes it, the folder it was built in renamed into place; the folder holds the world alone', async () => {
    const marks = path.join(tmp, 'marks');
    fs.mkdirSync(marks);
    const world = path.join(folder, worldKey('stand-in'));
    const reports = await contend(2, [
      `const { worldOfTheRun } = require(${JSON.stringify(RUN_WORLDS)});`,
      "const path = require('path');",
      'const [marks, world] = process.argv.slice(1);',
      'const mark = (name) => fs.writeFileSync(path.join(marks, name), "");',
      'const marked = (name) => fs.readdirSync(marks).some((at) => at.startsWith(name));',
      // An attempt at the claim that found it held is marked; so is each look
      // at the world after it, and a look that found the world half built.
      'const link = fs.linkSync;',
      'fs.linkSync = (from, to) => {',
      '  try { return link(from, to); } catch (err) {',
      '    if (err.code === "EEXIST" && to.endsWith(".claim")) mark(`held-${process.pid}`);',
      '    throw err;',
      '  }',
      '};',
      'const exists = fs.existsSync;',
      'fs.existsSync = (at) => {',
      '  const there = exists(at);',
      '  if (at === world && there && !exists(path.join(world, "built-by"))) mark("half-built");',
      '  if (at === world && marked(`held-${process.pid}`)) mark(`looked-${process.pid}`);',
      '  return there;',
      '};',
      'atBarrier();',
      'const { dir, how } = worldOfTheRun("stand-in", (into) => {',
      '  fs.appendFileSync(path.join(marks, "builds"), `${process.pid}\\n`);',
      // The builder holds its claim until the other has found it held and looked again.
      '  while (!marked("looked-")) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);',
      '  fs.writeFileSync(path.join(into, "inode"), String(fs.statSync(into).ino));',
      '  fs.writeFileSync(path.join(into, "built-by"), String(process.pid));',
      '}, { pollMs: 10 });',
      'report({ how, dir, builtBy: fs.readFileSync(path.join(dir, "built-by"), "utf8") });',
    ].join('\n'), [marks, world], { ...process.env, LEEWAY_TEST_WORLDS: folder });

    assert.deepStrictEqual(reports.map((report) => report.how).sort(), ['built', 'waited'], 'one built it while the other waited');
    const builder = fs.readFileSync(path.join(marks, 'builds'), 'utf8');
    assert.match(builder, /^\d+\n$/, 'built once');
    assert.deepStrictEqual([...new Set(fs.readdirSync(marks).map((name) => name.replace(/-\d+$/, '')))].sort(), ['builds', 'held', 'looked'], 'the other found the claim held and looked again while it was built, never at a world half built');
    for (const report of reports) assert.deepStrictEqual({ dir: report.dir, builtBy: report.builtBy }, { dir: world, builtBy: builder.trim() });
    assert.strictEqual(fs.readFileSync(path.join(world, 'inode'), 'utf8'), String(fs.statSync(world).ino), 'published whole: the folder it was built in, renamed, never a copy of it');
    assert.deepStrictEqual(fs.readdirSync(folder), [path.basename(world)], 'no claim and no half-built folder left beside it');
  });

  it('a build that fails leaves its error in place of the world, nothing half built and no claim: the next to ask fails with it at once, building nothing', () => {
    const name = named('failing');
    withEnv({ LEEWAY_TEST_WORLDS: folder }, () => {
      assert.throws(() => worldOfTheRun(name, (dir) => {
        fs.writeFileSync(path.join(dir, 'half'), '');
        throw new Error('the build failed');
      }), /^Error: the build failed$/);
      assert.deepStrictEqual(fs.readdirSync(folder), [`${worldKey(name)}.failed`], 'no world, no half-built folder, no claim: its error alone');
      assert.throws(() => worldOfTheRun(name, build, AT_ONCE), (/** @type {Error} */ err) => err.message.startsWith(`the world ${name} failed to build earlier in this run, and is not built again:\nError: the build failed\n`));
      assert.deepStrictEqual(builds, [], 'built nothing');
    });
  });

  it('a world placed by its builder between this process\'s look and its claim: taken as found, never built again', (t) => {
    const name = named('placed');
    const dir = path.join(folder, worldKey(name));
    const link = fs.linkSync;
    t.mock.method(fs, 'linkSync', (/** @type {string} */ from, /** @type {string} */ to) => {
      if (to === `${dir}.claim`) fs.mkdirSync(dir);
      return link(from, to);
    });
    const world = withEnv({ LEEWAY_TEST_WORLDS: folder }, () => worldOfTheRun(name, build));
    assert.deepStrictEqual(world, { dir, how: 'found' });
    assert.deepStrictEqual(builds, []);
    assert.deepStrictEqual(fs.readdirSync(folder), [path.basename(dir)], 'the claim let go');
  });

  it('a builder that died under its claim: the next to ask takes the claim over and builds the world for the run', () => {
    const name = named('dead');
    fs.writeFileSync(path.join(folder, `${worldKey(name)}.claim`), DEAD);
    const world = withEnv({ LEEWAY_TEST_WORLDS: folder }, () => worldOfTheRun(name, build, AT_ONCE));
    assert.deepStrictEqual(world, { dir: path.join(folder, worldKey(name)), how: 'built' });
    assert.strictEqual(fs.readFileSync(path.join(world.dir, 'built-by'), 'utf8'), String(process.pid));
    assert.deepStrictEqual(fs.readdirSync(folder), [worldKey(name)], 'the dead claim gone, the world in its place');
  });

  it('a builder alive past the wait limit: the waiter looks again once a pause until the limit, then builds its own, leaving the run\'s folder to the builder', async () => {
    const world = path.join(folder, worldKey('stand-in'));
    const release = tryClaimFile(`${world}.claim`);
    assert.ok(release, 'this process holds the claim, as a live builder would');
    try {
      // In a child, so a limit that never comes is killed rather than holding the suite.
      const [waiter] = await contend(1, [
        `const { worldOfTheRun } = require(${JSON.stringify(RUN_WORLDS)});`,
        "const path = require('path');",
        'const [world, limitMs, pollMs] = process.argv.slice(1);',
        'let looks = 0;',
        'const exists = fs.existsSync;',
        'fs.existsSync = (at) => { if (at === world) looks += 1; return exists(at); };',
        'const started = Date.now();',
        'const { dir, how } = worldOfTheRun("stand-in", (into) => fs.writeFileSync(path.join(into, "built-by"), ""), { limitMs: Number(limitMs), pollMs: Number(pollMs) });',
        'report({ how, apart: !dir.startsWith(path.dirname(world)), waitedMs: Date.now() - started, looks });',
      ].join('\n'), [world, String(LIMIT_MS), String(POLL_MS)], { ...process.env, LEEWAY_TEST_WORLDS: folder });

      assert.deepStrictEqual({ how: waiter.how, apart: waiter.apart }, { how: 'own', apart: true }, 'built its own, in a folder of its own');
      assert.ok(waiter.waitedMs >= LIMIT_MS, `built its own after ${waiter.waitedMs} ms, inside the ${LIMIT_MS} ms limit`);
      assert.ok(waiter.looks <= LIMIT_MS / POLL_MS + 1, `${waiter.looks} looks in ${LIMIT_MS} ms with ${POLL_MS} ms between them`);
      assert.deepStrictEqual(fs.readdirSync(folder), [`${path.basename(world)}.claim`], 'nothing placed beside the claim');
    } finally {
      release();
    }
  });
});
