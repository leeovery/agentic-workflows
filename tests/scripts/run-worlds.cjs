'use strict';

// ---------------------------------------------------------------------------
// Worlds built once per run (tests/README.md §3): a world several suites
// start from, named for what builds it, built by the first process of an
// `npm test` run that asks for it and copied by every other. The run names
// the folder its worlds are kept in, LEEWAY_TEST_WORLDS, made at its start
// and removed at its end (package.json), so no world outlives its run; a
// process run outside one builds its own, once, as a suite's own world is.
//
// A world is kept under its name and a hash of every source that could
// build it — every file under skills/ and the test library's modules, the
// files of tests/scripts/ that are no suite — so it never outlives the code
// that built it. Its builder holds a claim beside it while it builds (the
// engine's own, manifest-io.cjs, whose holder that dies is taken over by the
// next to ask), builds it in a folder of its own and renames that into
// place, so no process ever meets a world half built. The others wait on
// the claim; one still waiting after WAIT_LIMIT_MS, its builder alive but
// stuck, builds its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { tryClaimFile } = require('../../skills/leeway-engine/scripts/kernel/manifest-io.cjs');
const { sleepSync } = require('../../skills/leeway-engine/scripts/kernel/process.cjs');
const { templateFolder } = require('./discovery-test-utils.cjs');

const REPO = path.join(__dirname, '../..');

// A simulation's world takes a minute or two to build on a machine at load
// 100; a builder still at it after this is stuck.
const WAIT_LIMIT_MS = 10 * 60 * 1000;
// Each look at a held claim reads its holder's start time, a `ps` of its own.
const POLL_MS = 1000;

/** A world's name as a folder's. @param {string} name */
const slug = (name) => name.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '');

/**
 * One hash of every source under `root` a world's build could read: each
 * file's path and bytes.
 * @param {string} root
 */
function sourcesHash(root) {
  const hash = crypto.createHash('sha256');
  for (const dir of ['skills', 'tests/scripts']) {
    const files = /** @type {string[]} */ (fs.readdirSync(path.join(root, dir), { recursive: true }))
      .map((name) => path.join(dir, name))
      .filter((file) => !(dir === 'tests/scripts' && path.basename(file).startsWith('test-')) && fs.statSync(path.join(root, file)).isFile())
      .sort();
    for (const file of files) hash.update(`${file}\0`).update(fs.readFileSync(path.join(root, file))).update('\0');
  }
  return hash.digest('hex');
}

/** Each root's sources, hashed once per process. @type {Map<string, string>} */
const hashes = new Map();

/**
 * The folder name the world `name` is kept under, for the sources under `root`.
 * @param {string} name @param {string} [root]
 */
function worldKey(name, root = REPO) {
  if (!hashes.has(root)) hashes.set(root, sourcesHash(root));
  const hash = crypto.createHash('sha256').update(`${name}\0${hashes.get(root)}`).digest('hex');
  return `${slug(name)}-${hash.slice(0, 16)}`;
}

/** @typedef {{dir: string, how: 'alone'|'built'|'found'|'waited'|'own'}} RunWorld */

/** The world this process built for itself, in a template folder removed as it exits. @param {string} name @param {(dir: string) => void} build */
function builtAlone(name, build) {
  const dir = templateFolder(`${slug(name)}-template-`);
  build(dir);
  return dir;
}

/** `build` run in a folder beside `dir`, renamed into place whole. @param {string} dir @param {(dir: string) => void} build */
function published(dir, build) {
  const building = fs.mkdtempSync(`${dir}.building-`);
  try {
    build(building);
  } catch (err) {
    fs.rmSync(building, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    throw err;
  }
  fs.renameSync(building, dir);
  return dir;
}

/**
 * The world `name` from the run's folder `folder`: found there, built
 * there under its claim, or waited for while another process builds it.
 * @param {string} folder @param {string} name @param {(dir: string) => void} build
 * @param {number} limitMs @param {number} pollMs
 * @returns {RunWorld}
 */
function fromTheRun(folder, name, build, limitMs, pollMs) {
  const dir = path.join(folder, worldKey(name));
  const deadline = Date.now() + limitMs;
  for (let waited = false; ; waited = true) {
    if (fs.existsSync(dir)) return { dir, how: waited ? 'waited' : 'found' };
    const release = tryClaimFile(`${dir}.claim`);
    if (release !== null) {
      try {
        // Its builder may have placed it and let go between the look and the claim.
        if (fs.existsSync(dir)) return { dir, how: waited ? 'waited' : 'found' };
        return { dir: published(dir, build), how: 'built' };
      } finally {
        release();
      }
    }
    if (Date.now() >= deadline) return { dir: builtAlone(name, build), how: 'own' };
    sleepSync(pollMs);
  }
}

/** Each world this process came by, by the run's folder and its name. @type {Map<string, RunWorld>} */
const fetched = new Map();

/**
 * The world `name`, which `build` builds into the empty folder it is given:
 * the folder holding it, kept for the run, and how this process came by it.
 * No one writes in it again; a test works in a copy. Asked again, the same.
 * @param {string} name what builds the world, its arguments among it
 * @param {(dir: string) => void} build
 * @param {{limitMs?: number, pollMs?: number}} [wait] how long a builder is waited on, and how often its claim is looked at
 * @returns {RunWorld}
 */
function worldOfTheRun(name, build, { limitMs = WAIT_LIMIT_MS, pollMs = POLL_MS } = {}) {
  const folder = process.env.LEEWAY_TEST_WORLDS || '';
  const at = `${folder}\0${name}`;
  let world = fetched.get(at);
  if (world === undefined) {
    world = folder === '' ? { dir: builtAlone(name, build), how: 'alone' } : fromTheRun(folder, name, build, limitMs, pollMs);
    fetched.set(at, world);
  }
  return world;
}

module.exports = { worldOfTheRun, worldKey };
