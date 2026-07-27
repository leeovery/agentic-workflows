'use strict';

// World building: run a case's state recipe, snapshot it, compare it.
//
// A recipe (fixture-state.cjs / assertion-state.cjs) drives real engine
// calls against a scratch project under a frozen clock; its committed
// output lives beside it as fixture/ or assertion/. The recipe is the
// source of truth, the snapshot is the golden that makes drift visible:
// `npm test` rebuilds and byte-compares, so an engine change that moves
// a world goes red at the gate and lands as a reviewable diff.
//
// Rebuilds are skipped when nothing that feeds them has changed — the
// hash of the case's recipes, the shared mainlines, and the engine and
// knowledge sources is stored inside each snapshot. An engine change
// invalidates every hash, so drift can never hide behind the skip.
//
// Snapshots exclude `.git/` (SHAs), `.workflows/.knowledge/` (binary
// store, re-derived at materialise) and `.claude/skills|agents/` (copied
// into live worlds, never part of a world's own state), and store
// `.gitignore` files escaped so the product-written `.workflows/.gitignore`
// cannot ignore snapshot content out of this repo.

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const cases = require('./cases.cjs');

const ROOT = cases.ROOT;
const ENGINE = path.join(ROOT, 'skills/workflow-engine/scripts/engine.cjs');
const KNOWLEDGE = path.join(ROOT, 'skills/workflow-knowledge/scripts/knowledge.cjs');
const MAINLINES_DIR = path.join(cases.PROSE_DIR, 'mainlines');
const CLOCK = path.join(__dirname, 'fake-clock.cjs');

const GITIGNORE = '.gitignore';
const GITIGNORE_ESCAPED = '_gitignore.fixture';
const HASH_FILE = '.recipe-hash';
// Written by the walker's PostToolUse hook (lib/record-action.cjs) —
// observation of the walk, not part of the world it acted on.
const ACTION_LOG = '.walk-actions.log';

// --- the recipe harness ---------------------------------------------------

function recipeEnv() {
  if (/\s/.test(CLOCK)) {
    throw new Error(`fake-clock path contains whitespace — NODE_OPTIONS cannot carry it: ${CLOCK}`);
  }
  return {
    ...process.env,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require ${CLOCK}`].filter(Boolean).join(' '),
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z',
    GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z',
    TZ: 'UTC',
  };
}

function makeHarness(dir) {
  const env = recipeEnv();
  const node = (script, args) => {
    const res = spawnSync('node', [script, ...args], { cwd: dir, encoding: 'utf8', env });
    if (res.status !== 0) {
      throw new Error(`recipe call failed: ${path.basename(script)} ${args.join(' ')}\n`
        + `stdout: ${res.stdout}\nstderr: ${res.stderr}`);
    }
    return res.stdout;
  };
  return {
    dir,
    engine: (...args) => node(ENGINE, args),
    knowledge: (...args) => node(KNOWLEDGE, args),
    git: (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', env }),
    write(rel, content) {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
    },
    remove(rel) {
      fs.rmSync(path.join(dir, rel), { recursive: true, force: true });
    },
  };
}

/** Build a case's world into a fresh scratch dir; the caller removes it. */
function runRecipe(caseId, which) {
  const state = cases.requireState(caseId, which);
  if (!state) throw new Error(`case "${caseId}" has no ${cases.FILES[which]}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `prose-recipe-${caseId}-`));
  const h = makeHarness(dir);
  h.git('init', '-q', '-b', 'main');
  h.git('config', 'user.email', 'prose@example.com');
  h.git('config', 'user.name', 'Prose Fixture');
  h.git('config', 'commit.gpgsign', 'false');
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
  state.build(h);
  return dir;
}

// --- trees ----------------------------------------------------------------

function excluded(rel) {
  const parts = rel.split(path.sep);
  if (parts.includes('.git')) return true;
  if (rel === HASH_FILE || rel === ACTION_LOG) return true;
  if (rel === path.join('.workflows', '.knowledge')) return true;
  if (rel.startsWith(path.join('.workflows', '.knowledge') + path.sep)) return true;
  if (rel.startsWith(path.join('.claude', 'skills') + path.sep)) return true;
  if (rel.startsWith(path.join('.claude', 'agents') + path.sep)) return true;
  return false;
}

/** Directory → Map(snapshot-relative path → Buffer), escaped + filtered. */
function collectTree(root) {
  const files = new Map();
  const walk = (rel) => {
    for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const childRel = rel === '' ? entry.name : path.join(rel, entry.name);
      if (excluded(childRel)) continue;
      if (entry.isDirectory()) walk(childRel);
      else if (entry.isFile()) {
        const stored = entry.name === GITIGNORE
          ? path.join(path.dirname(childRel), GITIGNORE_ESCAPED)
          : childRel;
        files.set(stored, fs.readFileSync(path.join(root, childRel)));
      }
    }
  };
  walk('');
  return files;
}

function snapshotDir(caseId, which) {
  return path.join(cases.CASES_DIR, caseId, cases.SNAPSHOTS[which]);
}

function readSnapshot(caseId, which) {
  const dir = snapshotDir(caseId, which);
  return fs.existsSync(dir) ? collectTree(dir) : null;
}

// --- recipe hashing -------------------------------------------------------

function hashDir(hash, dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) hashDir(hash, full);
    else if (entry.isFile()) hash.update(entry.name).update(fs.readFileSync(full));
  }
}

/** Everything a world's content can depend on: its recipes, the shared
 *  mainlines, and the engine and knowledge sources that execute them. */
function recipeHash(caseId) {
  const hash = crypto.createHash('sha256');
  for (const which of ['fixtureState', 'assertionState']) {
    const file = path.join(cases.CASES_DIR, caseId, cases.FILES[which]);
    if (fs.existsSync(file)) hash.update(fs.readFileSync(file));
  }
  hashDir(hash, MAINLINES_DIR);
  hashDir(hash, path.join(ROOT, 'skills/workflow-engine/scripts'));
  hash.update(fs.readFileSync(KNOWLEDGE));
  return hash.digest('hex');
}

function storedHash(caseId, which) {
  const file = path.join(snapshotDir(caseId, which), HASH_FILE);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : null;
}

// --- snapshot write / verify ----------------------------------------------

// Snapshot name ('fixture'|'assertion') → the module that builds it.
const STATE_OF = { fixture: 'fixtureState', assertion: 'assertionState' };

function writeSnapshot(caseId, which) {
  const scratch = runRecipe(caseId, STATE_OF[which]);
  try {
    const dir = snapshotDir(caseId, which);
    fs.rmSync(dir, { recursive: true, force: true });
    const files = collectTree(scratch);
    for (const [rel, buf] of files) {
      const dest = path.join(dir, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
    }
    fs.writeFileSync(path.join(dir, HASH_FILE), `${recipeHash(caseId)}\n`);
    return files.size;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * Rebuild and byte-compare, unless nothing feeding this world has moved.
 * Returns {skipped} or {missing, extra, changed}.
 */
function verifySnapshot(caseId, which) {
  const snap = readSnapshot(caseId, which);
  if (snap === null) return { missing: ['<no committed snapshot>'], extra: [], changed: [] };
  if (storedHash(caseId, which) === recipeHash(caseId)) return { skipped: true };

  const scratch = runRecipe(caseId, STATE_OF[which]);
  try {
    const built = collectTree(scratch);
    const missing = [];
    const extra = [];
    const changed = [];
    for (const [rel, buf] of built) {
      if (!snap.has(rel)) extra.push(rel);
      else if (!snap.get(rel).equals(buf)) changed.push(rel);
    }
    for (const rel of snap.keys()) if (!built.has(rel)) missing.push(rel);
    return { missing, extra, changed };
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

// --- diffing a live world -------------------------------------------------

/** Unified diff of two buffers, via git — no diff algorithm of our own. */
function unifiedDiff(label, expectedBuf, actualBuf) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prose-diff-'));
  try {
    const a = path.join(dir, 'expected');
    const b = path.join(dir, 'actual');
    fs.writeFileSync(a, expectedBuf);
    fs.writeFileSync(b, actualBuf);
    const res = spawnSync('git', ['diff', '--no-index', '--unified=3', '--no-color', a, b], {
      encoding: 'utf8',
      env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
    });
    return `--- ${label}\n${(res.stdout || '').split('\n').slice(4).join('\n').trimEnd()}`;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The factual delta between the world after a walk and the world the case
 * expects — for the asserting agent to classify. Nothing is normalised:
 * volatile values surface as ordinary differences and the agent rules on
 * them. A case with no assertion-state expects its fixture back unchanged.
 */
function diffWorld(caseId, worldDir, claimsMode = false) {
  const which = !claimsMode && fs.existsSync(snapshotDir(caseId, 'assertion')) ? 'assertion' : 'fixture';
  const expected = readSnapshot(caseId, which);
  if (expected === null) throw new Error(`case "${caseId}" has no committed ${which} snapshot`);
  const actual = collectTree(worldDir);

  const added = [];
  const removed = [];
  const changed = [];
  for (const [rel, buf] of actual) {
    if (!expected.has(rel)) added.push(rel);
    else if (!expected.get(rel).equals(buf)) changed.push(unifiedDiff(rel, expected.get(rel), buf));
  }
  for (const rel of expected.keys()) if (!actual.has(rel)) removed.push(rel);

  return {
    expecting: which === 'assertion'
      ? 'the assertion state'
      : (claimsMode
        ? 'no fixed world — the delta below is against the STARTING state, is expected to be '
          + "non-empty, and must be judged against the case's stated claims"
        : 'the fixture state, unchanged'),
    added,
    removed,
    changed,
    identical: !added.length && !removed.length && !changed.length,
  };
}

// --- materialising a live world -------------------------------------------

const WORLD_PREFIX = 'prose-world-';

function buildWorld(caseId) {
  const snap = readSnapshot(caseId, 'fixture');
  if (snap === null) {
    throw new Error(`case "${caseId}" has no committed fixture — run: node tests/prose/run.cjs snap ${caseId}`);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), WORLD_PREFIX));
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', env });

  for (const [rel, buf] of snap) {
    const real = path.basename(rel) === GITIGNORE_ESCAPED
      ? path.join(path.dirname(rel), GITIGNORE)
      : rel;
    const dest = path.join(dir, real);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
  }
  for (const layer of ['skills', 'agents']) {
    const src = path.join(ROOT, layer);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(dir, '.claude', layer), { recursive: true });
  }

  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'prose@example.com');
  git('config', 'user.name', 'Prose World');
  git('config', 'commit.gpgsign', 'false');
  git('add', '-A');
  git('commit', '-q', '-m', `world: ${caseId}`);

  const knowledge = path.join(dir, '.claude/skills/workflow-knowledge/scripts/knowledge.cjs');
  const setup = spawnSync('node', [knowledge, 'setup', '--keyword-only'], { cwd: dir, encoding: 'utf8', env });
  if (setup.status !== 0) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw new Error(`knowledge setup failed in world:\nstdout: ${setup.stdout}\nstderr: ${setup.stderr}`);
  }
  git('add', '-A');
  git('commit', '-q', '-m', 'chore(knowledge): initialise store');

  return dir;
}

function destroyWorld(dir) {
  if (!path.basename(dir).startsWith(WORLD_PREFIX)) {
    throw new Error(`refusing to remove non-world directory: ${dir}`);
  }
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

/** What the walk actually did, as recorded by the walker's hook. */
function readActionLog(worldDir) {
  const file = path.join(worldDir, ACTION_LOG);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l, i) => {
      const [event, tool, detail = '', outcome, output] = l.split('\t');
      const head = `${String(i + 1).padStart(3)}. ${event.padEnd(19)} ${(tool || '').padEnd(6)} ${detail}`;
      if (!outcome) return head;
      return `${head}\n     → ${outcome}${output ? `: ${output}` : ''}`;
    })
    .join('\n');
}

module.exports = {
  ROOT, ENGINE, KNOWLEDGE, MAINLINES_DIR, WORLD_PREFIX, ACTION_LOG, readActionLog,
  runRecipe, collectTree, readSnapshot, snapshotDir, recipeHash, storedHash,
  writeSnapshot, verifySnapshot, diffWorld, buildWorld, destroyWorld,
};
