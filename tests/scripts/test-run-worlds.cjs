'use strict';

// ---------------------------------------------------------------------------
// Worlds built once per run (run-worlds.cjs): a world's key, hashed from its
// name and the sources that could build it; built in process where the run
// names no folder; built once under its claim by the first of two processes
// that ask at once, the other waiting and taking it; a build that fails
// leaving nothing; a world placed between a look and a claim never built
// again; a dead builder's claim taken over by the next to ask; and a
// builder alive past the wait limit left to finish while the waiter builds
// its own.
//
// Layer: process, for the race between two processes; the rest in process.
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

  it('keys a world by its name and by every file under skills/ and of the test library, never by a suite, a path or a time', () => {
    const files = { 'skills/a/scripts/engine.cjs': 'one', 'tests/scripts/a-world.cjs': 'two', 'tests/scripts/test-a.cjs': 'three' };
    /** A sources tree of `files`, `changed` over them. @param {string} name @param {Record<string, string>} [changed] */
    const tree = (name, changed = {}) => {
      const root = path.join(tmp, name);
      for (const [file, text] of Object.entries({ ...files, ...changed })) {
        fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        fs.writeFileSync(path.join(root, file), text);
      }
      return root;
    };
    const key = worldKey('cutClosed(ledger)', tree('as-is'));
    assert.match(key, /^cutClosed-ledger-[0-9a-f]{16}$/);
    assert.strictEqual(worldKey('cutClosed(ledger)', tree('the-same')), key, 'the same sources elsewhere, written later: the same key');
    assert.notStrictEqual(worldKey('cutClosed(ledgerly)', tree('as-is')), key, 'another name');
    assert.notStrictEqual(worldKey('cutClosed[ledger]', tree('as-is')), key, 'another name, its folder\'s name read the same');
    assert.notStrictEqual(worldKey('cutClosed(ledger)', tree('engine', { 'skills/a/scripts/engine.cjs': 'one, changed' })), key, 'a skill\'s file changed');
    assert.notStrictEqual(worldKey('cutClosed(ledger)', tree('library', { 'tests/scripts/a-world.cjs': 'two, changed' })), key, 'a library module changed');
    assert.notStrictEqual(worldKey('cutClosed(ledger)', tree('added', { 'skills/a/SKILL.md': 'new' })), key, 'a file added');
    assert.strictEqual(worldKey('cutClosed(ledger)', tree('suite', { 'tests/scripts/test-a.cjs': 'three, changed' })), key, 'a suite changed builds no world');
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

  it('two processes asking at once: the first to claim it builds it, the other waits on the claim, never meets it half built, and takes it; the folder holds the world alone', async () => {
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
      '  fs.writeFileSync(path.join(into, "built-by"), String(process.pid));',
      '}, { pollMs: 10 });',
      'report({ how, dir, builtBy: fs.readFileSync(path.join(dir, "built-by"), "utf8") });',
    ].join('\n'), [marks, world], { ...process.env, LEEWAY_TEST_WORLDS: folder });

    assert.deepStrictEqual(reports.map((report) => report.how).sort(), ['built', 'waited'], 'one built it while the other waited');
    const builder = fs.readFileSync(path.join(marks, 'builds'), 'utf8');
    assert.match(builder, /^\d+\n$/, 'built once');
    assert.deepStrictEqual([...new Set(fs.readdirSync(marks).map((name) => name.replace(/-\d+$/, '')))].sort(), ['builds', 'held', 'looked'], 'the other found the claim held and looked again while it was built, never at a world half built');
    for (const report of reports) assert.deepStrictEqual({ dir: report.dir, builtBy: report.builtBy }, { dir: world, builtBy: builder.trim() });
    assert.deepStrictEqual(fs.readdirSync(folder), [path.basename(world)], 'no claim and no half-built folder left beside it');
  });

  it('a build that fails leaves nothing half built and lets its claim go: the next to ask builds the world', () => {
    const name = named('failing');
    withEnv({ LEEWAY_TEST_WORLDS: folder }, () => {
      assert.throws(() => worldOfTheRun(name, (dir) => {
        fs.writeFileSync(path.join(dir, 'half'), '');
        throw new Error('the build failed');
      }), /^Error: the build failed$/);
      assert.deepStrictEqual(fs.readdirSync(folder), [], 'no world, no half-built folder, no claim');
      assert.strictEqual(worldOfTheRun(name, build, AT_ONCE).how, 'built');
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

  it('a builder alive past the wait limit: the waiter builds its own, leaving the run\'s folder to the builder', () => {
    const name = named('stuck');
    const claim = path.join(folder, `${worldKey(name)}.claim`);
    const release = tryClaimFile(claim);
    assert.ok(release, 'this process holds the claim, as a live builder would');
    try {
      const world = withEnv({ LEEWAY_TEST_WORLDS: folder }, () => worldOfTheRun(name, build, AT_ONCE));
      assert.strictEqual(world.how, 'own');
      assert.ok(!world.dir.startsWith(folder), 'built in a folder of its own');
      assert.deepStrictEqual(builds, [world.dir]);
      assert.deepStrictEqual(fs.readdirSync(folder), [path.basename(claim)], 'nothing placed beside the claim');
    } finally {
      release();
    }
  });
});
