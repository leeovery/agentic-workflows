'use strict';

// The prose harness's world machinery: what `buildWorld` makes of a case's
// sidecars, what the golden gate rebuilds and what it skips, and which cases a
// diff implicates. All of it is load-bearing and silent when wrong — a peer's
// hold that materialises stale reads free to the walk, a skip that fires over a
// moved world hides drift the gate exists to catch, and a selection that
// implicates the whole corpus is the same as selecting none.

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { Worker } = require('worker_threads');

const cases = require('../prose/lib/cases.cjs');
const worlds = require('../prose/lib/worlds.cjs');
const { createVerifyPool } = require('../prose/lib/verify-pool.cjs');
const { scanPresence, ownsRow } = require('../../skills/workflow-engine/scripts/domain/presence.cjs');

/** `git status --porcelain` in a materialised world. */
function statusLines(dir) {
  return execFileSync('git', ['status', '--porcelain'], {
    cwd: dir,
    encoding: 'utf8',
  }).split('\n').filter(Boolean);
}

// A case the corpus never sees: `_`-prefixed directories under cases/ are not
// cases, so a suite validating the corpus beside this one can never meet one.
const SCRATCH_PREFIX = '_scratch-';

/** The scratch case and whatever it recorded in the hash cache. */
function removeScratchCase(id) {
  fs.rmSync(path.join(cases.CASES_DIR, id), { recursive: true, force: true });
  for (const which of Object.keys(cases.SNAPSHOTS)) {
    fs.rmSync(worlds.hashCacheFile(id, which), { force: true });
  }
}

/**
 * A scratch case whose recipe writes one file, plus the committed snapshot a
 * rebuild is compared against — the smallest world that can be verified.
 * `recipe: null` leaves the case without a recipe, `snapshot: null` without a
 * committed snapshot.
 */
function writeScratchCase(name, { recipe = 'note\n', snapshot = recipe } = {}) {
  const id = `${SCRATCH_PREFIX}${name}`;
  removeScratchCase(id);
  const dir = path.join(cases.CASES_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  if (recipe !== null) {
    fs.writeFileSync(path.join(dir, cases.FILES.fixtureState),
      `'use strict';\nmodule.exports = { build(h) { h.write('note.txt', ${JSON.stringify(recipe)}); } };\n`);
  }
  if (snapshot !== null) {
    fs.mkdirSync(path.join(dir, cases.SNAPSHOTS.fixture), { recursive: true });
    fs.writeFileSync(path.join(dir, cases.SNAPSHOTS.fixture, 'note.txt'), snapshot);
  }
  return id;
}

describe('buildWorld: sidecar materialisation', () => {
  // The one case declaring both shapes of dirt and a peer's heartbeat.
  const CASE = 'discussion-sweeps-a-dead-peers-leavings';

  it('lands declared dirt as declared, and a peer heartbeat that reads held', function () {
    if (worlds.readSnapshot(CASE, 'fixture') === null) return; // corpus not built
    const dir = worlds.buildWorld(CASE);
    try {
      const status = statusLines(dir);
      const untracked = '.workflows/search-relevance/discussion/synonym-handling.md';
      const modified = '.workflows/search-relevance/research/relevance-measurement.md';

      assert.ok(status.some((l) => l.startsWith('?? ') && l.includes(untracked)),
        `a bare dirt entry is untracked — it has no committed version at all:\n${status.join('\n')}`);
      assert.ok(status.some((l) => l.startsWith(' M ') && l.includes(modified)),
        `a {path, committed} entry is tracked and modified:\n${status.join('\n')}`);

      // The modified path's committed side is the sidecar's, and the working
      // tree holds the snapshot's — that difference is the whole point.
      const committed = execFileSync('git', ['show', `HEAD:${modified}`], { cwd: dir, encoding: 'utf8' });
      assert.notStrictEqual(committed, fs.readFileSync(path.join(dir, modified), 'utf8'),
        'the working tree carries the snapshot, the index carries the sidecar');

      // An identity-less sidecar row is stamped as pid 1 — alive for as long
      // as the machine is, and nobody's own — so the engine reads it held. A
      // peer that reads unheld is a peer the walk sails straight past.
      const beat = path.join(dir, '.workflows/.cache/search-relevance/research/relevance-measurement/presence');
      assert.ok(fs.existsSync(beat), 'the declared peer holds a heartbeat');
      const row = scanPresence(dir, 'search-relevance').sessions
        .find((r) => r.phase === 'research' && r.topic === 'relevance-measurement');
      assert.strictEqual(row.held, true, 'the peer\'s heartbeat must read held');
      assert.strictEqual(row.pid, 1);
      assert.ok(!ownsRow(row), 'and is never the walker\'s own');
      assert.ok(!statusLines(dir).some((l) => l.includes('.cache')), 'and never shows up as dirt');
    } finally {
      worlds.destroyWorld(dir);
    }
  });

  it('refuses a dirt path the fixture does not hold', () => {
    // A sidecar naming a file no snapshot carries would silently produce a
    // world missing the dirt the case is about.
    const id = writeScratchCase('dirt-guard', { recipe: null, snapshot: 'committed\n' });
    try {
      fs.writeFileSync(path.join(cases.CASES_DIR, id, cases.SNAPSHOTS.fixture, '.world-dirt.json'),
        JSON.stringify(['src/never-written.js']));
      assert.throws(() => worlds.buildWorld(id), /names "src\/never-written\.js", which the fixture does not hold/);
    } finally {
      removeScratchCase(id);
    }
  });
});

describe('the harness stamp: what materialise adds, the differ strips — and nothing else', () => {
  const NATIVE_CASE = 'start-records-a-native-verdict';

  function scratch() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prose-stamp-'));
    fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
    return dir;
  }
  function manifestOf(tree) {
    const buf = tree.get(worlds.PROJECT_MANIFEST);
    return buf ? JSON.parse(buf.toString('utf8')) : null;
  }
  function settingsOf(tree) {
    const buf = tree.get(worlds.SETTINGS);
    return buf ? JSON.parse(buf.toString('utf8')) : null;
  }
  /** Every SessionEnd command in a settings object, in order. */
  function hooksOf(settings) {
    return (settings.hooks?.SessionEnd ?? []).flatMap((g) => g.hooks.map((h) => h.command));
  }
  function writeSettings(dir, settings) {
    const file = path.join(dir, worlds.SETTINGS);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  }
  const PRESENCE_HOOK = 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs" presence cleanup';
  const SESSION_HOOK = 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs" session cleanup';
  const FOREIGN_HOOK = { type: 'command', command: 'say goodbye' };
  const PERMISSIONS = { allow: ['Edit(.workflows/**)'] };

  it('a fixture recording neither one-time answer is stamped both, and the stamps are stripped back out', () => {
    const dir = scratch();
    try {
      fs.writeFileSync(path.join(dir, worlds.PROJECT_MANIFEST), JSON.stringify({ work_units: {} }, null, 2) + '\n');
      const stamped = worlds.stampHarnessState(dir);
      assert.deepStrictEqual(stamped, { baseline: true, walkthrough: true, settings_created: true });
      const tree = worlds.collectTree(dir);
      assert.deepStrictEqual(manifestOf(tree), {
        work_units: {},
        defaults: { tmux_labels: false, gate_surface: false },
        baseline: { status: 'native' },
        walkthrough: { status: 'skipped' },
      });
      worlds.unstampHarnessState(tree, stamped);
      assert.deepStrictEqual(manifestOf(tree), { work_units: {} }, 'every stamp gone, nothing else touched');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a fixture holding `baseline: {}` is not stamped, so a verdict the walk records survives the strip', () => {
    const dir = scratch();
    try {
      fs.writeFileSync(path.join(dir, worlds.PROJECT_MANIFEST), JSON.stringify({ work_units: {}, baseline: {} }, null, 2) + '\n');
      const stamped = worlds.stampHarnessState(dir);
      assert.deepStrictEqual(stamped, { baseline: false, walkthrough: true, settings_created: true });
      // The walk records its verdict.
      fs.writeFileSync(path.join(dir, worlds.PROJECT_MANIFEST),
        JSON.stringify({
          work_units: {},
          defaults: { tmux_labels: false, gate_surface: false },
          baseline: { status: 'native' },
          walkthrough: { status: 'skipped' },
        }, null, 2) + '\n');
      const tree = worlds.collectTree(dir);
      worlds.unstampHarnessState(tree, stamped);
      assert.deepStrictEqual(manifestOf(tree), { work_units: {}, baseline: { status: 'native' } },
        'the recorded verdict is a real delta, never mistaken for the stamp');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a fixture holding `walkthrough: {}` is not stamped, so the answer the walk records survives the strip', () => {
    const dir = scratch();
    try {
      fs.writeFileSync(path.join(dir, worlds.PROJECT_MANIFEST),
        JSON.stringify({ work_units: {}, walkthrough: {} }, null, 2) + '\n');
      const stamped = worlds.stampHarnessState(dir);
      assert.deepStrictEqual(stamped, { baseline: true, walkthrough: false, settings_created: true });
      // The walk skips the offer — the same status the stamp would have
      // written, which is exactly why the marker decides and not the value.
      fs.writeFileSync(path.join(dir, worlds.PROJECT_MANIFEST),
        JSON.stringify({
          work_units: {},
          defaults: { tmux_labels: false, gate_surface: false },
          baseline: { status: 'native' },
          walkthrough: { status: 'skipped' },
        }, null, 2) + '\n');
      const tree = worlds.collectTree(dir);
      worlds.unstampHarnessState(tree, stamped);
      assert.deepStrictEqual(manifestOf(tree), { work_units: {}, walkthrough: { status: 'skipped' } },
        'the recorded answer is a real delta, and the baseline stamp still goes');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the strip leaves a stamped record the walk moved on from', () => {
    // `walked` is not what materialise wrote, so it is the walk's own —
    // and a record grown a second field is no longer the stamp either.
    const tree = new Map([[worlds.PROJECT_MANIFEST, Buffer.from(JSON.stringify({
      defaults: { tmux_labels: false, gate_surface: false },
      baseline: { status: 'native', areas: {} },
      walkthrough: { status: 'walked' },
    }, null, 2) + '\n')]]);
    worlds.unstampHarnessState(tree, { baseline: true, walkthrough: true, settings_created: false });
    assert.deepStrictEqual(JSON.parse(tree.get(worlds.PROJECT_MANIFEST).toString('utf8')), {
      baseline: { status: 'native', areas: {} },
      walkthrough: { status: 'walked' },
    });
  });

  it('a kill the walk answered for itself is a real delta — only the value the harness wrote is stripped', () => {
    // A case about the gate-surface question turns it on; the label kill
    // beside it is still the harness's and still goes.
    const tree = new Map([[worlds.PROJECT_MANIFEST, Buffer.from(JSON.stringify({
      work_units: {},
      defaults: { tmux_labels: false, gate_surface: true },
    }, null, 2) + '\n')]]);
    worlds.unstampHarnessState(tree, { baseline: false, walkthrough: false, settings_created: false });
    assert.deepStrictEqual(JSON.parse(tree.get(worlds.PROJECT_MANIFEST).toString('utf8')), {
      work_units: {},
      defaults: { gate_surface: true },
    });
  });

  it('a world with no settings file is seeded the presence hook alone, and the marker records the file as the harness\'s', () => {
    const dir = scratch();
    try {
      const stamped = worlds.stampHarnessState(dir);
      assert.strictEqual(stamped.settings_created, true);
      const settings = settingsOf(worlds.collectTree(dir));
      assert.deepStrictEqual(hooksOf(settings), [PRESENCE_HOOK], 'presence cleanup, never session cleanup under the label kill');
      assert.deepStrictEqual(Object.keys(settings), ['hooks'], 'and nothing the harness invented');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a fixture\'s own settings file keeps its permissions around the seeded hook', () => {
    const dir = scratch();
    try {
      writeSettings(dir, { permissions: PERMISSIONS });
      const stamped = worlds.stampHarnessState(dir);
      assert.strictEqual(stamped.settings_created, false);
      const settings = settingsOf(worlds.collectTree(dir));
      assert.deepStrictEqual(settings.permissions, PERMISSIONS);
      assert.deepStrictEqual(hooksOf(settings), [PRESENCE_HOOK]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the strip removes our hooks and drops a harness-created file, but a permission the walk edited and a foreign hook stand', () => {
    const dir = scratch();
    try {
      // A harness-created file the walk never touched goes entirely.
      const created = worlds.stampHarnessState(dir);
      let tree = worlds.collectTree(dir);
      worlds.unstampHarnessState(tree, created);
      assert.strictEqual(tree.has(worlds.SETTINGS), false, 'nothing but the seed — the file was never the world\'s');

      // The walk turned labels on (a session hook joined ours), edited a
      // permission and the user's own hook sits in its own group: only
      // ours go, and the file stays because the fixture brought it.
      writeSettings(dir, {
        permissions: PERMISSIONS,
        hooks: {
          SessionEnd: [
            { hooks: [FOREIGN_HOOK] },
            { hooks: [{ type: 'command', command: PRESENCE_HOOK }, { type: 'command', command: SESSION_HOOK }] },
          ],
        },
      });
      tree = worlds.collectTree(dir);
      worlds.unstampHarnessState(tree, { baseline: false, walkthrough: false, settings_created: false });
      assert.deepStrictEqual(settingsOf(tree), { permissions: PERMISSIONS, hooks: { SessionEnd: [{ hooks: [FOREIGN_HOOK] }] } });

      // A harness-created file the walk filled stays, minus our hooks.
      writeSettings(dir, { permissions: PERMISSIONS, hooks: { SessionEnd: [{ hooks: [{ type: 'command', command: PRESENCE_HOOK }] }] } });
      tree = worlds.collectTree(dir);
      worlds.unstampHarnessState(tree, { baseline: false, walkthrough: false, settings_created: true });
      assert.deepStrictEqual(settingsOf(tree), { permissions: PERMISSIONS }, 'the permission edit is a real delta');

      // A file holding none of ours is not rewritten — not even its bytes.
      const untouched = Buffer.from('{"permissions": {"allow": []}}\n');
      tree = new Map([[worlds.SETTINGS, untouched]]);
      worlds.unstampHarnessState(tree, { baseline: false, walkthrough: false, settings_created: false });
      assert.strictEqual(tree.get(worlds.SETTINGS), untouched);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a settings file the harness cannot parse makes the strip throw, never silently keep the seeded hooks', () => {
    const tree = new Map([[worlds.SETTINGS, Buffer.from('{not json')]]);
    assert.throws(
      () => worlds.unstampHarnessState(tree, { baseline: false, walkthrough: false, settings_created: true }),
      /cannot strip the session hooks: .*not valid JSON/);
  });

  it('a live boot — no skip switch, the walker\'s real environment — finds the hooks it wants and writes nothing', function () {
    if (worlds.readSnapshot(NATIVE_CASE, 'fixture') === null) return; // corpus not built
    const dir = worlds.buildWorld(NATIVE_CASE);
    try {
      const env = worlds.recipeEnv();
      delete env.WORKFLOWS_SKIP_SESSION_HOOKS;
      const head = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8', env }).trim();
      const before = head();
      const out = execFileSync('node', [worlds.ENGINE, 'boot'], { cwd: dir, encoding: 'utf8', env });
      const boot = JSON.parse(out.trim());
      assert.strictEqual(boot.session_hooks_installed, false, 'the seeded set is exactly what boot wants');
      assert.deepStrictEqual(boot.warnings, []);
      assert.deepStrictEqual(statusLines(dir), [], 'nothing written');
      assert.strictEqual(head(), before, 'nothing committed');
    } finally {
      worlds.destroyWorld(dir);
    }
  });

  it('the recipe env carries the engine\'s test-only hook switch, so a recipe\'s boot never writes a world\'s settings', () => {
    const env = worlds.recipeEnv();
    assert.strictEqual(env.WORKFLOWS_SKIP_SESSION_HOOKS, '1');
    assert.strictEqual(env.WORKFLOWS_DISPLAY_WIDTH, '65');
    assert.ok(!('TMUX' in env), 'and no tmux identity');
  });

  it('a layered project manifest keeps `.workflows/` out of the root commit and is stamped when its layer lands', function () {
    if (worlds.readSnapshot(NATIVE_CASE, 'fixture') === null) return; // corpus not built
    const dir = worlds.buildWorld(NATIVE_CASE);
    try {
      const log = (...args) => execFileSync('git', ['log', '--reverse', '--format=%s', ...args], { cwd: dir, encoding: 'utf8' }).trim().split('\n');
      const all = log('HEAD');
      const arrival = log('HEAD', '--', '.workflows');
      assert.ok(all.length > 1, `the world layers history: ${all.join(' | ')}`);
      assert.ok(all.indexOf(arrival[0]) > 0, `.workflows/ arrives after the root commit: ${all.join(' | ')}`);
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, worlds.PROJECT_MANIFEST), 'utf8'));
      assert.deepStrictEqual(manifest.defaults, { tmux_labels: false, gate_surface: false }, 'both kills land on the layered manifest');
      assert.deepStrictEqual(manifest.baseline, {}, 'the fixture\'s nothing-recorded baseline is left alone');
      assert.deepStrictEqual(manifest.walkthrough, { status: 'skipped' },
        'the walkthrough the fixture says nothing about is stamped with the layer');
      assert.deepStrictEqual(worlds.readStampMarker(dir), { baseline: false, walkthrough: true, settings_created: false },
        'the fixture brought its own settings file, and its own baseline');
      assert.deepStrictEqual(hooksOf(JSON.parse(fs.readFileSync(path.join(dir, worlds.SETTINGS), 'utf8'))), [PRESENCE_HOOK],
        'the seeded hook lands with the manifest layer');
      assert.strictEqual(statusLines(dir).length, 0, 'no dirt for the walk to sweep up');
    } finally {
      worlds.destroyWorld(dir);
    }
  });
});

describe('the recipe hash: what a world is built from', () => {
  it('a file reaches the digest by its content, a directory by everything under it', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prose-hash-'));
    try {
      const file = path.join(dir, 'engine.cjs');
      fs.writeFileSync(file, 'one\n');
      assert.strictEqual(worlds.hashPaths([file]), worlds.hashPaths([file]), 'the same bytes hash the same');
      const before = worlds.hashPaths([dir]);
      fs.writeFileSync(file, 'two\n');
      const edited = worlds.hashPaths([dir]);
      assert.notStrictEqual(edited, before, 'an edited file under the tree moves the digest');
      fs.mkdirSync(path.join(dir, 'domain'));
      fs.writeFileSync(path.join(dir, 'domain', 'kb.cjs'), 'three\n');
      assert.notStrictEqual(worlds.hashPaths([dir]), edited, 'and so does a new file deeper in it');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a path that is not there contributes nothing — a case without an assertion recipe still hashes', () => {
    assert.strictEqual(worlds.hashPaths([path.join(os.tmpdir(), 'prose-hash-absent')]), worlds.hashPaths([]));
  });

  it('every world\'s hash covers the mainlines, the engine tree and the knowledge bundle', () => {
    assert.deepStrictEqual(worlds.SHARED_INPUTS, [
      worlds.MAINLINES_DIR,
      path.join(worlds.ROOT, 'skills/workflow-engine/scripts'),
      worlds.KNOWLEDGE,
    ]);
    // Taken once per process and reused by every case — so it has to be the
    // real digest of those inputs, or an engine change would skip past a
    // moved world.
    assert.strictEqual(worlds.sharedInputsHash(), worlds.hashPaths(worlds.SHARED_INPUTS));
  });

  it('a case\'s own recipe is in its hash', () => {
    const id = writeScratchCase('hash', { recipe: 'first\n' });
    try {
      const before = worlds.recipeHash(id);
      assert.strictEqual(worlds.recipeHash(id), before, 'stable while nothing feeding it moves');
      writeScratchCase('hash', { recipe: 'second\n' });
      assert.notStrictEqual(worlds.recipeHash(id), before);
    } finally {
      removeScratchCase(id);
    }
  });
});

describe('the recipe-hash cache: the skip the verify maintains', () => {
  it('a clean rebuild records its hash, and the next verify skips', () => {
    const id = writeScratchCase('clean');
    try {
      assert.strictEqual(worlds.cachedHash(id, 'fixture'), null, 'a cold cache holds nothing');
      assert.deepStrictEqual(worlds.verifySnapshot(id, 'fixture'), { missing: [], extra: [], changed: [] });
      assert.strictEqual(worlds.cachedHash(id, 'fixture'), worlds.recipeHash(id));
      assert.deepStrictEqual(worlds.verifySnapshot(id, 'fixture'), { skipped: true });
    } finally {
      removeScratchCase(id);
    }
  });

  it('a drift records nothing, so it is still a drift on the next run', () => {
    const id = writeScratchCase('drift', { recipe: 'rebuilt\n', snapshot: 'committed\n' });
    const moved = { missing: [], extra: [], changed: ['note.txt'] };
    try {
      assert.deepStrictEqual(worlds.verifySnapshot(id, 'fixture'), moved);
      assert.strictEqual(worlds.cachedHash(id, 'fixture'), null, 'a moved world is never recorded as built');
      assert.deepStrictEqual(worlds.verifySnapshot(id, 'fixture'), moved);
    } finally {
      removeScratchCase(id);
    }
  });

  it('a hash from before an engine change rebuilds — a stale cache costs a rebuild, never a skip', () => {
    const id = writeScratchCase('stale');
    try {
      worlds.recordHash(id, 'fixture', 'the digest of an engine tree that has moved on');
      assert.deepStrictEqual(worlds.verifySnapshot(id, 'fixture'), { missing: [], extra: [], changed: [] });
      assert.strictEqual(worlds.cachedHash(id, 'fixture'), worlds.recipeHash(id), 'and the clean rebuild re-records');
    } finally {
      removeScratchCase(id);
    }
  });

  it('a world with no committed snapshot is a miss however fresh the cached hash is', () => {
    const id = writeScratchCase('unsnapped', { snapshot: null });
    try {
      worlds.recordHash(id, 'fixture', worlds.recipeHash(id));
      assert.deepStrictEqual(worlds.verifySnapshot(id, 'fixture'),
        { missing: ['<no committed snapshot>'], extra: [], changed: [] });
    } finally {
      removeScratchCase(id);
    }
  });

  it('`snap` records the hash too, and the snapshot it writes holds world state alone', () => {
    const id = writeScratchCase('snap', { snapshot: null });
    try {
      assert.strictEqual(worlds.writeSnapshot(id, 'fixture'), 1);
      assert.strictEqual(worlds.cachedHash(id, 'fixture'), worlds.recipeHash(id));
      assert.deepStrictEqual(worlds.verifySnapshot(id, 'fixture'), { skipped: true }, 'a just-snapped world skips');
      assert.deepStrictEqual(fs.readdirSync(path.join(cases.CASES_DIR, id, cases.SNAPSHOTS.fixture)), ['note.txt'],
        'no bookkeeping inside the snapshot — nothing for a PR to carry');
      assert.ok(worlds.hashCacheFile(id, 'fixture').startsWith(path.join(cases.PROSE_DIR, '.cache') + path.sep),
        'the hash is cached in the gitignored cache instead');
    } finally {
      removeScratchCase(id);
    }
  });
});

describe('the verify pool: a thread per core, a world at a time', () => {
  it('answers each job with its own world\'s verdict, and surfaces a failing one', async () => {
    const clean = writeScratchCase('pool-clean');
    const drift = writeScratchCase('pool-drift', { recipe: 'rebuilt\n', snapshot: 'committed\n' });
    const unsnapped = writeScratchCase('pool-unsnapped', { snapshot: null });
    const recipeless = writeScratchCase('pool-recipeless', { recipe: null, snapshot: 'committed\n' });
    // Two threads, three jobs: the queue is walked, not just the spawn.
    const pool = createVerifyPool(2);
    try {
      const verdicts = await Promise.all([clean, drift, unsnapped]
        .map((caseId) => pool.submit({ caseId, which: 'fixture' })));
      assert.deepStrictEqual(verdicts, [
        { missing: [], extra: [], changed: [] },
        { missing: [], extra: [], changed: ['note.txt'] },
        { missing: ['<no committed snapshot>'], extra: [], changed: [] },
      ]);
      assert.strictEqual(worlds.cachedHash(clean, 'fixture'), worlds.recipeHash(clean),
        'a thread\'s clean rebuild records the hash the main thread would have');
      await assert.rejects(pool.submit({ caseId: recipeless, which: 'fixture' }),
        (e) => e.message === `case "${recipeless}" has no ${cases.FILES.fixtureState}`);
    } finally {
      await pool.close();
      for (const id of [clean, drift, unsnapped, recipeless]) removeScratchCase(id);
    }
  });

  it('a thread reuses the empty config directory it inherits, never minting its own', async () => {
    // Every verifying thread requires the harness, which requires the
    // hermetic module: a thread that pinned a config directory of its own
    // would leak a temp dir per thread, and one that pinned nothing would run
    // the developer's config.
    const worker = new Worker(
      `require(${JSON.stringify(require.resolve('../prose/lib/worlds.cjs'))});\n`
      + "require('worker_threads').parentPort.postMessage(process.env.WORKFLOWS_CONFIG_DIR);\n",
      { eval: true });
    try {
      const inThread = await new Promise((resolve, reject) => {
        worker.once('message', resolve);
        worker.once('error', reject);
      });
      assert.strictEqual(inThread, process.env.WORKFLOWS_CONFIG_DIR);
    } finally {
      await worker.terminate();
    }
  });
});

describe('case selection: what a diff implicates', () => {
  const all = cases.loadAllCases();
  const sample = all[0];

  it('a snapshot content change selects its case', () => {
    const selected = cases.selectCases(all, [`${sample.rel}/${cases.SNAPSHOTS.fixture}/.workflows/manifest.json`]);
    assert.deepStrictEqual(selected.map((c) => c.id), [sample.id], 'a world that moved is real');
  });

  it('a case file, a mainline, and a stub each select', () => {
    assert.ok(cases.selectCases(all, [sample.files[0].path]).some((c) => c.id === sample.id),
      'a case selects on a file it declares — and so does every sibling declaring the same one');
    assert.strictEqual(
      cases.selectCases(all, ['tests/prose/mainlines/anything.md']).length, all.length,
      'every walk runs through the shared mainlines');
    const armed = all.find((c) => c.stubs.length > 0);
    if (armed) {
      assert.ok(cases.selectCases(all, [`tests/prose/stubs/${armed.stubs[0].name}.md`])
        .some((c) => c.id === armed.id), 'a case selects on the stubs it arms');
    }
  });

  it('an unrelated path selects nothing', () => {
    assert.deepStrictEqual(cases.selectCases(all, ['README.md', 'src/knowledge/index.js']), []);
  });
});

describe('the asserter prompt file: harness material, never world state', () => {
  // `run.cjs assert` writes the asserter's prompt into the world — the
  // record runs past what an orchestrator can relay by hand — so it must
  // stay out of the tree the differ reads and travel with the logs when a
  // failed world is archived.
  function worldDir() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prose-world-'));
    fs.writeFileSync(path.join(dir, worlds.ACTION_LOG), 'PreToolUse\tBash\tls\n');
    fs.writeFileSync(path.join(dir, worlds.WALK_LOG), 'walk\n');
    fs.writeFileSync(path.join(dir, worlds.ASSERT_PROMPT), 'PROMPT\n');
    fs.mkdirSync(path.join(dir, '.workflows'));
    fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'), '{}\n');
    return dir;
  }

  it('is excluded from the collected tree alongside the two logs', () => {
    const dir = worldDir();
    try {
      const tree = worlds.collectTree(dir);
      const rels = [...tree.keys()];
      assert.ok(rels.includes(path.join('.workflows', 'manifest.json')));
      for (const name of [worlds.ACTION_LOG, worlds.WALK_LOG, worlds.ASSERT_PROMPT]) {
        assert.ok(!rels.includes(name), `${name} leaked into the tree`);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is lifted by archive with the logs, so the archive holds what the asserter was given', () => {
    const dir = worldDir();
    let dest;
    try {
      dest = worlds.archiveWorld(dir, 'some-case');
      for (const name of [worlds.ACTION_LOG, worlds.WALK_LOG, worlds.ASSERT_PROMPT]) {
        assert.ok(fs.existsSync(path.join(dest, name)), `${name} missing from the archive`);
      }
      assert.strictEqual(fs.readFileSync(path.join(dest, worlds.ASSERT_PROMPT), 'utf8'), 'PROMPT\n');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
      if (dest) fs.rmSync(dest, { recursive: true, force: true });
    }
  });
});
