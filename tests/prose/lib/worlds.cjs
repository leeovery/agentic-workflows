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
//
// What a snapshot cannot hold directly — git history, another session's
// heartbeat, an uncommitted file — a recipe declares in a sidecar that
// materialise turns into the real thing (see WORLD_HISTORY and friends).

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
// Written by the same hook at SubagentStop: the walk as it was told,
// turn by turn, lifted from the runtime's own transcript. An agent
// returns one final message; the walk happens across dozens of turns.
const WALK_LOG = '.walk-transcript.log';

// A recipe's git history dies at the world's fresh init, so a fixture
// that needs one (implementation commits the review scope-grep reads)
// declares it: the recipe writes this sidecar — [{"message", "files"}]
// — the snapshot carries it, and materialise turns it into real
// layered commits. The sidecar itself never lands in the world.
const WORLD_HISTORY = '.world-history.json';

// Two siblings of the same shape, for the worlds a concurrent-session
// case needs. A recipe writes them, the snapshot carries them,
// materialise turns them into world state, and neither lands in the
// world itself.
//
// Heartbeats a PEER session holds — [{"work_unit", "phase", "topic"
// [, "session_id", "pid", "pid_start"]}]. Presence files are excluded
// from every snapshot (timing noise no case claim can pin), so a
// fixture that needs a peer's hold declares it here instead, and
// materialise stamps it last: the mtime is the liveness signal and
// must read fresh for the walk that follows. Omit the identity fields
// for the mtime-fallback record — held while the file is younger than
// the staleness window, which no walk outlives.
const WORLD_PRESENCE = '.world-presence.json';

// Snapshot paths left OUT of the world's commits. Everything a recipe
// writes is committed at materialise, so a fixture that needs a session's
// uncommitted work names it here and it is written back after the last
// commit. Two shapes, because dirt has two:
//
//   "path"                        untracked — the file has no committed
//                                 version at all
//   {"path", "committed": "…"}    modified — `committed` is what goes
//                                 into the world's commits, and the
//                                 snapshot's own content is what lands
//                                 on top of it
//
// The second matters more often than it looks: an untracked file inside
// an otherwise untracked directory collapses to the directory in
// `git status --porcelain`, so a case whose walk must name the dirty
// path needs the directory tracked.
const WORLD_DIRT = '.world-dirt.json';

// Every sidecar: carried by the snapshot, never part of the world.
const SIDECARS = [WORLD_HISTORY, WORLD_PRESENCE, WORLD_DIRT];

// --- the recipe harness ---------------------------------------------------

function recipeEnv() {
  if (/\s/.test(CLOCK)) {
    throw new Error(`fake-clock path contains whitespace — NODE_OPTIONS cannot carry it: ${CLOCK}`);
  }
  const env = {
    ...process.env,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require ${CLOCK}`].filter(Boolean).join(' '),
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z',
    GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z',
    TZ: 'UTC',
    // Width is detected from the reader's terminal, and CLAUDE_PID reaches
    // this env — without a pin, a recipe would render against whatever pane
    // happened to be open, and resizing would move the snapshots.
    WORKFLOWS_DISPLAY_WIDTH: '65',
  };
  // Session labels read the real tmux identity — a recipe's engine calls
  // must never rename the terminal session the suite happens to run in.
  delete env.TMUX;
  delete env.TMUX_PANE;
  return env;
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
  if (rel === HASH_FILE || rel === ACTION_LOG || rel === WALK_LOG) return true;
  if (rel === path.join('.workflows', '.knowledge')) return true;
  if (rel.startsWith(path.join('.workflows', '.knowledge') + path.sep)) return true;
  if (rel.startsWith(path.join('.claude', 'skills') + path.sep)) return true;
  if (rel.startsWith(path.join('.claude', 'agents') + path.sep)) return true;
  // Presence heartbeats are timing noise: the engine stamps them as side
  // effects of the verbs a session runs, and no case claim can meaningfully
  // pin an mtime artifact. Other cache content (the agent store) stays
  // visible — cases pin its rows.
  if (parts[0] === '.workflows' && parts[1] === '.cache' && parts[parts.length - 1] === 'presence') return true;
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
// --- the session-label kill switch --------------------------------------

const PROJECT_MANIFEST = path.join('.workflows', 'manifest.json');

// Where materialise records what it stamped, so the differ strips exactly
// that and never a value the walk wrote itself. Under `.git/`, which no
// collected tree ever holds.
const STAMP_MARKER = path.join('.git', 'prose-stamp.json');

/**
 * Write `defaults.tmux_labels: false` into the world's project manifest
 * (creating the manifest when the fixture has none) — the engine's
 * per-project override, which beats the developer's real system opt-in.
 * Canonical manifest style, so mid-walk engine rewrites stay byte-stable.
 * Returns what was stamped beyond the label kill.
 * @param {string} dir
 * @returns {{baseline: boolean}}
 */
function stampLabelKill(dir) {
  const file = path.join(dir, PROJECT_MANIFEST);
  /** @type {Record<string, any>} */
  let manifest = {};
  if (fs.existsSync(file)) manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  manifest.defaults = { ...(manifest.defaults || {}), tmux_labels: false };
  // A world grows up on the workflows, and workflow-start's one-time
  // baseline judgment would record exactly that — a manifest write and a
  // commit in every start case's delta. `native` pins the branch shut; a
  // case about the judgment itself stamps its own state in
  // fixture-state.cjs (`baseline: {}` reads as nothing recorded), which
  // wins here.
  const baseline = manifest.baseline === undefined;
  if (baseline) manifest.baseline = { status: 'native' };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
  return { baseline };
}

/** What materialise stamped into a world, per its marker. @param {string} dir @returns {{baseline: boolean}} */
function readStampMarker(dir) {
  const file = path.join(dir, STAMP_MARKER);
  if (!fs.existsSync(file)) return { baseline: false };
  try { return { baseline: Boolean(JSON.parse(fs.readFileSync(file, 'utf8')).baseline) }; } catch { return { baseline: false }; }
}

/**
 * Reverse the stamp on a collected tree so deltas compare against
 * unstamped snapshots: drop `defaults.tmux_labels` when it carries the
 * harness value, drop an emptied `defaults`, drop the baseline stamp only
 * when materialise stamped one (a verdict the walk recorded itself is a
 * real delta the case pins, never a stamp), and drop the manifest entirely
 * when the stamp was all it held.
 * @param {Map<string, Buffer>} tree
 * @param {{baseline: boolean}} stamped  what materialise recorded stamping
 */
function unstampLabelKill(tree, stamped) {
  const buf = tree.get(PROJECT_MANIFEST);
  if (!buf) return;
  /** @type {Record<string, any>} */
  let manifest;
  try { manifest = JSON.parse(buf.toString('utf8')); } catch { return; }
  if (!manifest || typeof manifest !== 'object' || !manifest.defaults || manifest.defaults.tmux_labels !== false) return;
  delete manifest.defaults.tmux_labels;
  if (Object.keys(manifest.defaults).length === 0) delete manifest.defaults;
  if (stamped.baseline && manifest.baseline && typeof manifest.baseline === 'object'
      && manifest.baseline.status === 'native' && Object.keys(manifest.baseline).length === 1) {
    delete manifest.baseline;
  }
  if (Object.keys(manifest).length === 0) {
    tree.delete(PROJECT_MANIFEST);
    return;
  }
  tree.set(PROJECT_MANIFEST, Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
}

function diffWorld(caseId, worldDir, claimsMode = false) {
  const which = !claimsMode && fs.existsSync(snapshotDir(caseId, 'assertion')) ? 'assertion' : 'fixture';
  const expected = readSnapshot(caseId, which);
  if (expected === null) throw new Error(`case "${caseId}" has no committed ${which} snapshot`);
  const actual = collectTree(worldDir);
  unstampLabelKill(actual, readStampMarker(worldDir));

  const added = [];
  const removed = [];
  const changed = [];
  for (const [rel, buf] of actual) {
    if (!expected.has(rel)) added.push(rel);
    else if (!expected.get(rel).equals(buf)) changed.push(unifiedDiff(rel, expected.get(rel), buf));
  }
  for (const rel of expected.keys()) {
    if (SIDECARS.includes(rel)) continue;
    if (!actual.has(rel)) removed.push(rel);
  }

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

  const sidecar = (name) => (snap.has(name) ? JSON.parse(snap.get(name).toString('utf8')) : []);
  const history = sidecar(WORLD_HISTORY);
  const presence = sidecar(WORLD_PRESENCE);
  const dirt = new Map(sidecar(WORLD_DIRT)
    .map((e) => (typeof e === 'string' ? [e, {}] : [e.path, e])));
  for (const rel of dirt.keys()) {
    if (!snap.has(rel)) throw new Error(`case "${caseId}": ${WORLD_DIRT} names "${rel}", which the fixture does not hold`);
  }
  const layered = new Set(history.flatMap((g) => g.files));
  for (const [rel, snapshotBuf] of snap) {
    if (SIDECARS.includes(rel) || layered.has(rel)) continue;
    // A dirt path commits its `committed` version, or nothing at all.
    const held = dirt.get(rel);
    if (held && held.committed === undefined) continue;
    const buf = held ? Buffer.from(held.committed) : snapshotBuf;
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

  // The walker's engine calls inherit the developer's real environment —
  // tmux identity and system config included — so every world carries the
  // project-level session-label kill switch. Stamped before the first
  // commit (no dirt for the walk to sweep up) and stripped back out by
  // diffWorld, so snapshots never see it. A fixture that layers the
  // project manifest through its history is stamped when that layer lands
  // instead — the root commit then holds no `.workflows/` at all, which is
  // what lets a case put commits before the workflows' arrival.
  const manifestLayered = layered.has(PROJECT_MANIFEST);
  let stamped = manifestLayered ? { baseline: false } : stampLabelKill(dir);

  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'prose@example.com');
  git('config', 'user.name', 'Prose World');
  git('config', 'commit.gpgsign', 'false');
  // The harness's logs live inside the world but are not world state — a
  // walker staging broadly must never commit them. info/exclude keeps the
  // rule out of the working tree, so snapshots and deltas never see it.
  fs.writeFileSync(path.join(dir, '.git', 'info', 'exclude'), '.walk-actions.log\n.walk-transcript.log\n');
  git('add', '-A');
  git('commit', '-q', '-m', `world: ${caseId}`);

  // Layer the declared history: one real commit per group, in order,
  // each carrying exactly its declared files — the shape the walk's
  // git-history reads (scope greps, baselines) expect of a real run.
  for (const group of history) {
    for (const rel of group.files) {
      const real = path.basename(rel) === GITIGNORE_ESCAPED
        ? path.join(path.dirname(rel), GITIGNORE)
        : rel;
      const dest = path.join(dir, real);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, snap.get(rel));
    }
    if (manifestLayered && group.files.includes(PROJECT_MANIFEST)) stamped = stampLabelKill(dir);
    git('add', '-A');
    git('commit', '-q', '-m', group.message);
  }
  fs.writeFileSync(path.join(dir, STAMP_MARKER), JSON.stringify(stamped) + '\n');

  // A recipe cannot know a commit hash — every world re-inits git — so a
  // fixture that must hold one (a plan's spec_commit baseline) writes
  // `@WORLD_COMMIT@` instead, and it resolves here to the world's own
  // baseline commit: a real SHA whose tree holds the fixture's files,
  // the same shape initialisation stamps on a real plan. The snapshot
  // keeps the placeholder, so rebuilds stay byte-deterministic.
  const baseline = git('rev-parse', 'HEAD').trim();
  for (const [rel] of snap) {
    if (path.basename(rel) !== 'manifest.json') continue;
    const dest = path.join(dir, rel);
    const text = fs.readFileSync(dest, 'utf8');
    if (text.includes('@WORLD_COMMIT@')) {
      fs.writeFileSync(dest, text.split('@WORLD_COMMIT@').join(baseline));
    }
  }

  const knowledge = path.join(dir, '.claude/skills/workflow-knowledge/scripts/knowledge.cjs');
  const setup = spawnSync('node', [knowledge, 'setup', '--keyword-only'], { cwd: dir, encoding: 'utf8', env });
  if (setup.status !== 0) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw new Error(`knowledge setup failed in world:\nstdout: ${setup.stdout}\nstderr: ${setup.stderr}`);
  }
  git('add', '-A');
  git('commit', '-q', '-m', 'chore(knowledge): initialise store');

  // Last, after every commit: what a peer session left behind. The dirt
  // stands untracked because it was held back from the commits above;
  // the heartbeats are stamped here so their mtimes are the freshest
  // thing in the world, which is what makes a peer read live.
  for (const rel of dirt.keys()) {
    const dest = path.join(dir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, snap.get(rel));
  }
  for (const row of presence) {
    const file = path.join(dir, '.workflows', '.cache', row.work_unit, row.phase, row.topic, 'presence');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({
      pid: row.pid ?? null,
      pid_start: row.pid_start ?? null,
      session_id: row.session_id ?? null,
    }) + '\n');
  }

  return dir;
}

function destroyWorld(dir) {
  if (!path.basename(dir).startsWith(WORLD_PREFIX)) {
    throw new Error(`refusing to remove non-world directory: ${dir}`);
  }
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

// Worlds die with their logs — and a failed run's logs are exactly the
// evidence a human wants afterwards. Archiving copies the record (both
// logs) and the workflow state out of a world before it is destroyed,
// to a directory that outlives the run. Never the skills layer — that
// is the repo's copy, not the walk's.
const ARCHIVE_PREFIX = 'prose-failed-';

function archiveWorld(dir, caseId) {
  if (!path.basename(dir).startsWith(WORLD_PREFIX)) {
    throw new Error(`refusing to archive non-world directory: ${dir}`);
  }
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), `${ARCHIVE_PREFIX}${caseId}-`));
  for (const name of [ACTION_LOG, WALK_LOG]) {
    const src = path.join(dir, name);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dest, name));
  }
  const state = path.join(dir, '.workflows');
  if (fs.existsSync(state)) fs.cpSync(state, path.join(dest, '.workflows'), { recursive: true });
  return dest;
}

/** The recorded actions as rows, for checks that run in code. */
function readActionRows(worldDir) {
  const file = path.join(worldDir, ACTION_LOG);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [event, tool, detail = '', outcome = null, output = null] = l.split('\t');
      return { event, tool, detail, outcome, output };
    });
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

/** The walk as it was told, turn by turn — not the summary it returned. */
function readWalkLog(worldDir) {
  const file = path.join(worldDir, WALK_LOG);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8').trim() || null;
}

module.exports = {
  ROOT, ENGINE, KNOWLEDGE, MAINLINES_DIR, WORLD_PREFIX,
  ACTION_LOG, readActionLog, readActionRows, WALK_LOG, readWalkLog,
  runRecipe, collectTree, readSnapshot, snapshotDir, recipeHash, storedHash,
  writeSnapshot, verifySnapshot, diffWorld, buildWorld, destroyWorld, archiveWorld,
  stampLabelKill, unstampLabelKill, readStampMarker, STAMP_MARKER, PROJECT_MANIFEST,
};
