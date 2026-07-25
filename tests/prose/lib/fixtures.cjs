'use strict';

// Fixture recipes and golden snapshots.
//
// A fixture is tests/prose/fixtures/{name}/: a recipe.cjs (a module whose
// build(harness) drives real engine/knowledge calls against a scratch
// project) and a committed snapshot/ (the recipe's byte-exact output).
// The recipe is the source of truth; the snapshot is what makes drift
// visible — CI rebuilds every recipe and byte-compares (P2/P3 in
// design/prose-tests.md). Hand-editing a snapshot is forbidden:
// regenerate with `node tests/prose/run.cjs snap {name}`.
//
// Determinism: recipe subprocesses run under the frozen-clock preload and
// pinned git identity/dates. Snapshots exclude `.git/` (SHAs live in
// manifest values where recipes record them, not as a tree) and
// `.workflows/.knowledge/` (binary store; the world builder re-derives it
// at materialise time). `.gitignore` files inside a snapshot are stored
// escaped so the product-written `.workflows/.gitignore` cannot ignore
// fixture content out of THIS repo's git.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '../../..');
const ENGINE = path.join(ROOT, 'skills/workflow-engine/scripts/engine.cjs');
const KNOWLEDGE = path.join(ROOT, 'skills/workflow-knowledge/scripts/knowledge.cjs');
const FIXTURES_DIR = path.join(ROOT, 'tests/prose/fixtures');
const CLOCK = path.join(__dirname, 'fake-clock.cjs');

const GITIGNORE = '.gitignore';
const GITIGNORE_ESCAPED = '_gitignore.fixture';

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
      throw new Error(`recipe call failed: ${path.basename(script)} ${args.join(' ')}\n` +
        `stdout: ${res.stdout}\nstderr: ${res.stderr}`);
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

function listFixtures() {
  if (!fs.existsSync(FIXTURES_DIR)) return [];
  return fs.readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(FIXTURES_DIR, e.name, 'recipe.cjs')))
    .map((e) => e.name);
}

/** Build a fixture's world into a fresh scratch dir; caller removes it. */
function runRecipe(name) {
  const recipePath = path.join(FIXTURES_DIR, name, 'recipe.cjs');
  if (!fs.existsSync(recipePath)) throw new Error(`no recipe for fixture "${name}"`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `prose-recipe-${name}-`));
  const h = makeHarness(dir);
  h.git('init', '-q', '-b', 'main');
  h.git('config', 'user.email', 'prose@example.com');
  h.git('config', 'user.name', 'Prose Fixture');
  h.git('config', 'commit.gpgsign', 'false');
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
  delete require.cache[require.resolve(recipePath)];
  require(recipePath).build(h);
  return dir;
}

function excluded(rel) {
  const parts = rel.split(path.sep);
  if (parts.includes('.git')) return true;
  if (rel === path.join('.workflows', '.knowledge')) return true;
  if (rel.startsWith(path.join('.workflows', '.knowledge') + path.sep)) return true;
  // Installed skills/agents: copied into live worlds by the world builder,
  // never part of a snapshot. Excluding them lets an acted world be
  // compared against an expected snapshot on equal terms.
  if (rel.startsWith(path.join('.claude', 'skills') + path.sep)) return true;
  if (rel.startsWith(path.join('.claude', 'agents') + path.sep)) return true;
  return false;
}

/** Scratch tree → Map(snapshot-relative path → Buffer), escaped + filtered. */
function collectTree(root) {
  const files = new Map();
  const walk = (rel) => {
    const abs = path.join(root, rel);
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const childRel = rel === '' ? entry.name : path.join(rel, entry.name);
      if (excluded(childRel)) continue;
      if (entry.isDirectory()) {
        walk(childRel);
      } else if (entry.isFile()) {
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

/** Committed snapshot dir → Map(snapshot-relative path → Buffer), verbatim. */
function readSnapshot(name) {
  const snapDir = path.join(FIXTURES_DIR, name, 'snapshot');
  if (!fs.existsSync(snapDir)) return null;
  const files = new Map();
  const walk = (rel) => {
    for (const entry of fs.readdirSync(path.join(snapDir, rel), { withFileTypes: true })) {
      const childRel = rel === '' ? entry.name : path.join(rel, entry.name);
      if (entry.isDirectory()) walk(childRel);
      else if (entry.isFile()) files.set(childRel, fs.readFileSync(path.join(snapDir, childRel)));
    }
  };
  walk('');
  return files;
}

/** Regenerate the committed snapshot from a built scratch tree. */
function writeSnapshot(name, scratchDir) {
  const snapDir = path.join(FIXTURES_DIR, name, 'snapshot');
  fs.rmSync(snapDir, { recursive: true, force: true });
  const files = collectTree(scratchDir);
  for (const [rel, buf] of files) {
    const dest = path.join(snapDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
  }
  return files.size;
}

/** Rebuild-compare: {missing, extra, changed} — all empty means current. */
function compareSnapshot(name, scratchDir) {
  const snap = readSnapshot(name);
  if (snap === null) return { missing: ['<no committed snapshot>'], extra: [], changed: [] };
  const built = collectTree(scratchDir);
  const missing = [];
  const extra = [];
  const changed = [];
  for (const [rel, buf] of built) {
    if (!snap.has(rel)) extra.push(rel);
    else if (!snap.get(rel).equals(buf)) changed.push(rel);
  }
  for (const rel of snap.keys()) {
    if (!built.has(rel)) missing.push(rel);
  }
  return { missing, extra, changed };
}

/** Snapshot → real project tree at dest, unescaping .gitignore files. */
function materialiseSnapshot(name, destDir) {
  const snap = readSnapshot(name);
  if (snap === null) {
    throw new Error(`fixture "${name}" has no committed snapshot — run: node tests/prose/run.cjs snap ${name}`);
  }
  for (const [rel, buf] of snap) {
    const real = path.basename(rel) === GITIGNORE_ESCAPED
      ? path.join(path.dirname(rel), GITIGNORE)
      : rel;
    const dest = path.join(destDir, real);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
  }
}

/** Unified diff of two buffers, via git — no diff algorithm of our own. */
function unifiedDiff(label, expectedBuf, actualBuf) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prose-diff-'));
  try {
    const a = path.join(dir, 'expected');
    const b = path.join(dir, 'actual');
    fs.writeFileSync(a, expectedBuf);
    fs.writeFileSync(b, actualBuf);
    const res = spawnSync('git', ['diff', '--no-index', '--unified=3', '--no-color', a, b],
      { encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } });
    const body = (res.stdout || '').split('\n').slice(4).join('\n').trimEnd();
    return `--- ${label}\n${body}`;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Compare a live (acted) world against a committed snapshot. Returns the
 * factual delta — what a walk actually did to the world — for the
 * asserting agent to classify. No normalisation: volatile fields (times,
 * SHAs) surface as ordinary differences and the agent rules on them.
 */
function diffWorldAgainstSnapshot(worldDir, snapshotName) {
  const expected = readSnapshot(snapshotName);
  if (expected === null) throw new Error(`fixture "${snapshotName}" has no committed snapshot`);
  const actual = collectTree(worldDir);

  const added = [];
  const removed = [];
  const changed = [];
  for (const [rel, buf] of actual) {
    if (!expected.has(rel)) added.push(rel);
    else if (!expected.get(rel).equals(buf)) changed.push(unifiedDiff(rel, expected.get(rel), buf));
  }
  for (const rel of expected.keys()) if (!actual.has(rel)) removed.push(rel);

  return { snapshot: snapshotName, added, removed, changed, identical: !added.length && !removed.length && !changed.length };
}

module.exports = {
  ROOT, ENGINE, KNOWLEDGE, FIXTURES_DIR,
  listFixtures, runRecipe, collectTree, readSnapshot,
  writeSnapshot, compareSnapshot, materialiseSnapshot, diffWorldAgainstSnapshot,
};
