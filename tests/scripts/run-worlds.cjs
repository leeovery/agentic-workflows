'use strict';

// ---------------------------------------------------------------------------
// Worlds built once per run (tests/README.md §3): every world a suite starts
// from, named for what builds it, built by the first process of an `npm
// test` run that asks for it and copied by every other. The run names the
// folder its worlds are kept in, LEDGER_TEST_WORLDS, made at its start and
// removed at its end (package.json), so no world outlives its run; a process
// run outside one builds its own, once, as a suite's own world is.
//
// A world is kept under its name and a hash of every source that could
// build it — every file under skills/ and the test library's modules, the
// files of tests/scripts/ and tests/drivers/ that are no suite — so it never
// outlives the code that built it. The run's starter hashes the sources once
// and hands the hash down (LEDGER_TEST_SOURCES, from this module run as a
// script); a process outside a run hashes its own. One name is one build:
// the world's mark names the source of what built it — the builder, and
// what a helper that wraps it was given — and an asker whose builder's
// source is another fails, naming the suite each asked from, in another
// process or in this one. What a build answers travels with its world, in
// its mark, to every process that takes it — the ids a build minted that
// its suites cite, say.
//
// Its builder holds a claim beside it while it builds (the engine's own,
// manifest-io.cjs, whose holder that dies is taken over by the next to ask)
// and builds it where it stands, so every path the build writes into it
// names the world as it is kept; the world is there for others once its
// mark is, written last, so no process ever meets a world half built, and a
// half-built one a dead builder left is built over. A build that fails
// leaves its error there instead, and every later asker fails with it at
// once rather than building it again. The others wait on the claim; one
// still waiting after WAIT_LIMIT_MS, its builder alive but stuck, builds its
// own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { tryClaimFile } = require('../../skills/ledger-engine/scripts/kernel/manifest-io.cjs');
const { sleepSync } = require('../../skills/ledger-engine/scripts/kernel/process.cjs');
const { templateFolder } = require('./discovery-test-utils.cjs');

const REPO = path.join(__dirname, '../..');

// A simulation's world takes a minute or two to build on a machine at load
// 100; a builder still at it after this is stuck.
const WAIT_LIMIT_MS = 10 * 60 * 1000;
// Each look at a held claim reads its holder's start time, a `ps` of its own.
const POLL_MS = 1000;

// The modules a world is asked through, passed over to find who asked.
const LIBRARY = [__filename, path.join(__dirname, 'engine-harness.cjs'), path.join(__dirname, 'discovery-test-utils.cjs')];

/** A world's name as a folder's. @param {string} name */
const slug = (name) => name.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '');

/**
 * One hash of every source under `root` a world's build could read: each
 * file's path and bytes.
 * @param {string} root
 */
function sourcesHash(root) {
  const hash = crypto.createHash('sha256');
  for (const dir of ['skills', 'tests/scripts', 'tests/drivers']) {
    const files = /** @type {string[]} */ (fs.readdirSync(path.join(root, dir), { recursive: true }))
      .map((name) => path.join(dir, name))
      .filter((file) => !(dir.startsWith('tests/') && path.basename(file).startsWith('test-')) && fs.statSync(path.join(root, file)).isFile())
      .sort();
    for (const file of files) hash.update(`${file}\0`).update(fs.readFileSync(path.join(root, file))).update('\0');
  }
  return hash.digest('hex');
}

/** Each root's sources, hashed once per process; this checkout's as the run hashed it, where it did. @type {Map<string, string>} */
const hashes = new Map();

/**
 * The folder name the world `name` is kept under, for the sources under `root`.
 * @param {string} name @param {string} [root]
 */
function worldKey(name, root = REPO) {
  if (!hashes.has(root)) hashes.set(root, (root === REPO && process.env.LEDGER_TEST_SOURCES) || sourcesHash(root));
  const hash = crypto.createHash('sha256').update(`${name}\0${hashes.get(root)}`).digest('hex');
  return `${slug(name)}-${hash.slice(0, 16)}`;
}

/** A builder as its mark names it: its source, hashed. @param {unknown} by */
const sourceOf = (by) => crypto.createHash('sha256').update(String(by)).digest('hex').slice(0, 16);

// Deep enough to pass a chain of world modules and reach the suite.
const STACK_FRAMES = 100;

/** Where a world was asked for: the suite's frame, else the first outside the library. */
function askedFrom() {
  const limit = Error.stackTraceLimit;
  Error.stackTraceLimit = STACK_FRAMES;
  const stack = String(new Error().stack);
  Error.stackTraceLimit = limit;
  const frames = stack.split('\n').slice(1).map((line) => line.trim().replace(/^at (?:.* \()?(.*?)\)?$/, '$1'))
    .filter((frame) => frame.startsWith('/') && !LIBRARY.some((file) => frame.startsWith(`${file}:`)));
  return frames.find((frame) => /^test-[^/]*:\d+:\d+$/.test(path.basename(frame))) ?? frames[0] ?? 'an unknown place';
}

/** @typedef {{source: string, site: string}} Builder */
/** @typedef {{dir: string, how: 'alone'|'built'|'found'|'waited'|'own', kept: unknown}} RunWorld */

/** @param {string} name @param {string} first @param {string} second */
const twoBuilders = (name, first, second) => new Error(`the world ${name} has two builders, at ${first} and at ${second}: a world's name names one build`);

/** The world this process built for itself, in a template folder removed as it exits. @param {string} name @param {(dir: string) => unknown} build @returns {RunWorld} */
function builtAlone(name, build) {
  const dir = templateFolder(`${slug(name)}-template-`);
  return { dir, how: 'alone', kept: build(dir) };
}

/**
 * `build` run at `dir`, over any half-built world a dead builder left, its
 * mark then written beside it, naming its builder and holding what it
 * answered; a build that fails leaves its error at `failed` in place of the
 * world.
 * @param {string} dir @param {string} failed @param {(dir: string) => unknown} build @param {Builder} builder
 */
function published(dir, failed, build, builder) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  fs.mkdirSync(dir);
  let kept;
  try {
    kept = build(dir);
  } catch (err) {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    fs.writeFileSync(`${failed}.${process.pid}`, err instanceof Error && err.stack ? err.stack : String(err));
    fs.renameSync(`${failed}.${process.pid}`, failed);
    throw err;
  }
  fs.writeFileSync(`${dir}.built.${process.pid}`, JSON.stringify({ ...builder, kept }));
  fs.renameSync(`${dir}.built.${process.pid}`, `${dir}.built`);
  return kept;
}

/**
 * The world at `dir` where its builder marked it, null while it is not
 * marked; where its build failed, that failure thrown again, and where
 * another builder built it, that refused.
 * @param {string} dir @param {string} failed @param {string} name @param {boolean} waited @param {Builder} builder
 * @returns {RunWorld|null}
 */
function placed(dir, failed, name, waited, builder) {
  if (fs.existsSync(`${dir}.built`)) {
    const mark = JSON.parse(fs.readFileSync(`${dir}.built`, 'utf8'));
    if (mark.source !== builder.source) throw twoBuilders(name, mark.site, builder.site);
    return { dir, how: waited ? 'waited' : 'found', kept: mark.kept };
  }
  if (fs.existsSync(failed)) throw new Error(`the world ${name} failed to build earlier in this run, and is not built again:\n${fs.readFileSync(failed, 'utf8')}`);
  return null;
}

/**
 * The world `name` from the run's folder `folder`: found there, built
 * there under its claim, or waited for while another process builds it.
 * @param {string} folder @param {string} name @param {(dir: string) => unknown} build @param {Builder} builder
 * @param {number} limitMs @param {number} pollMs
 * @returns {RunWorld}
 */
function fromTheRun(folder, name, build, builder, limitMs, pollMs) {
  const dir = path.join(fs.realpathSync(folder), worldKey(name));
  const failed = `${dir}.failed`;
  const deadline = Date.now() + limitMs;
  for (let waited = false; ; waited = true) {
    const there = placed(dir, failed, name, waited, builder);
    if (there !== null) return there;
    const release = tryClaimFile(`${dir}.claim`);
    if (release !== null) {
      try {
        // Its builder may have marked it, or failed, and let go between the look and the claim.
        return placed(dir, failed, name, waited, builder) ?? { dir, how: 'built', kept: published(dir, failed, build, builder) };
      } finally {
        release();
      }
    }
    if (Date.now() >= deadline) return { ...builtAlone(name, build), how: 'own' };
    sleepSync(pollMs);
  }
}

/** Each world this process came by, by the run's folder and its name, with the builder it was first asked with. @type {Map<string, {world: RunWorld, builder: Builder}>} */
const fetched = new Map();

/**
 * The world `name`, which `build` builds into the empty folder it is given:
 * the folder holding it, kept for the run, how this process came by it, and
 * what the build answered, a JSON value or nothing. No one writes in it
 * again; a test works in a copy. Asked again, the same.
 * @param {string} name the world's own, one name to one build
 * @param {(dir: string) => unknown} build
 * @param {{by?: unknown, limitMs?: number, pollMs?: number}} [options] what the world is known by where `build` wraps it, made afresh at each ask — the builder, and what a helper was given, its source read; how long a builder is waited on, and how often its claim is looked at
 * @returns {RunWorld}
 */
function worldOfTheRun(name, build, { by, limitMs = WAIT_LIMIT_MS, pollMs = POLL_MS } = {}) {
  const folder = process.env.LEDGER_TEST_WORLDS || '';
  const at = `${folder}\0${name}`;
  const builder = { source: sourceOf(by ?? build), site: askedFrom() };
  const known = fetched.get(at);
  if (known !== undefined) {
    if (known.builder.source !== builder.source) throw twoBuilders(name, known.builder.site, builder.site);
    return known.world;
  }
  const world = folder === '' ? builtAlone(name, build) : fromTheRun(folder, name, build, builder, limitMs, pollMs);
  fetched.set(at, { world, builder });
  return world;
}

// Run as a script, by the run's starter: this checkout's sources hash, for LEDGER_TEST_SOURCES.
if (require.main === module) process.stdout.write(sourcesHash(REPO));

module.exports = { worldOfTheRun, worldKey };
