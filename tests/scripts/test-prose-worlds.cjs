'use strict';

// The prose harness's world machinery: what `buildWorld` makes of a case's
// sidecars, and which cases a diff implicates. Both are load-bearing and
// silent when wrong — a peer's hold that materialises stale reads free to the
// walk, and a selection filter that lets bookkeeping through selects the whole
// corpus, which is the same as selecting none.

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const cases = require('../prose/lib/cases.cjs');
const worlds = require('../prose/lib/worlds.cjs');

const STALE_AFTER_SECONDS = 900;

/** `git status --porcelain` in a materialised world. */
function statusLines(dir) {
  return execFileSync('git', ['status', '--porcelain'], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
  }).split('\n').filter(Boolean);
}

describe('buildWorld: sidecar materialisation', () => {
  // The one case declaring both shapes of dirt and a peer's heartbeat.
  const CASE = 'discussion-sweeps-a-dead-peers-leavings';

  it('lands declared dirt as declared, and a peer heartbeat fresh enough to read live', function () {
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
      const committed = execFileSync('git', ['show', `HEAD:${modified}`], {
        cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
      });
      assert.notStrictEqual(committed, fs.readFileSync(path.join(dir, modified), 'utf8'),
        'the working tree carries the snapshot, the index carries the sidecar');

      // The heartbeat is stamped after every commit, so its mtime is the
      // freshest thing in the world. A peer that reads stale is a peer the
      // walk sails straight past.
      const beat = path.join(dir, '.workflows/.cache/search-relevance/research/relevance-measurement/presence');
      assert.ok(fs.existsSync(beat), 'the declared peer holds a heartbeat');
      const age = (Date.now() - fs.statSync(beat).mtimeMs) / 1000;
      assert.ok(age < STALE_AFTER_SECONDS, `the peer's heartbeat must read live, aged ${age}s`);
      assert.ok(!statusLines(dir).some((l) => l.includes('.cache')), 'and never shows up as dirt');
    } finally {
      worlds.destroyWorld(dir);
    }
  });

  it('refuses a dirt path the fixture does not hold', () => {
    // A sidecar naming a file no snapshot carries would silently produce a
    // world missing the dirt the case is about.
    const CASES_DIR = cases.CASES_DIR;
    const id = '.tmp-dirt-guard';
    const dir = path.join(CASES_DIR, id, cases.SNAPSHOTS.fixture);
    fs.mkdirSync(dir, { recursive: true });
    try {
      fs.writeFileSync(path.join(dir, '.world-dirt.json'), JSON.stringify(['src/never-written.js']));
      assert.throws(() => worlds.buildWorld(id), /names "src\/never-written\.js", which the fixture does not hold/);
    } finally {
      fs.rmSync(path.join(CASES_DIR, id), { recursive: true, force: true });
    }
  });
});

describe('the harness stamp: what materialise adds, the differ strips — and nothing else', () => {
  const NATIVE_CASE = 'start-records-a-native-verdict';

  function scratch() {
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'prose-stamp-'));
    fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
    return dir;
  }
  function manifestOf(tree) {
    const buf = tree.get(worlds.PROJECT_MANIFEST);
    return buf ? JSON.parse(buf.toString('utf8')) : null;
  }

  it('a fixture with no baseline is stamped native, and the stamp is stripped back out', () => {
    const dir = scratch();
    try {
      fs.writeFileSync(path.join(dir, worlds.PROJECT_MANIFEST), JSON.stringify({ work_units: {} }, null, 2) + '\n');
      const stamped = worlds.stampLabelKill(dir);
      assert.deepStrictEqual(stamped, { baseline: true });
      const tree = worlds.collectTree(dir);
      assert.deepStrictEqual(manifestOf(tree), { work_units: {}, defaults: { tmux_labels: false }, baseline: { status: 'native' } });
      worlds.unstampLabelKill(tree, stamped);
      assert.deepStrictEqual(manifestOf(tree), { work_units: {} }, 'both stamps gone, nothing else touched');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a fixture holding `baseline: {}` is not stamped, so a verdict the walk records survives the strip', () => {
    const dir = scratch();
    try {
      fs.writeFileSync(path.join(dir, worlds.PROJECT_MANIFEST), JSON.stringify({ work_units: {}, baseline: {} }, null, 2) + '\n');
      const stamped = worlds.stampLabelKill(dir);
      assert.deepStrictEqual(stamped, { baseline: false });
      // The walk records its verdict.
      fs.writeFileSync(path.join(dir, worlds.PROJECT_MANIFEST),
        JSON.stringify({ work_units: {}, defaults: { tmux_labels: false }, baseline: { status: 'native' } }, null, 2) + '\n');
      const tree = worlds.collectTree(dir);
      worlds.unstampLabelKill(tree, stamped);
      assert.deepStrictEqual(manifestOf(tree), { work_units: {}, baseline: { status: 'native' } },
        'the recorded verdict is a real delta, never mistaken for the stamp');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a layered project manifest keeps `.workflows/` out of the root commit and is stamped when its layer lands', function () {
    if (worlds.readSnapshot(NATIVE_CASE, 'fixture') === null) return; // corpus not built
    const dir = worlds.buildWorld(NATIVE_CASE);
    try {
      const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
      const log = (...args) => execFileSync('git', ['log', '--reverse', '--format=%s', ...args], { cwd: dir, encoding: 'utf8', env }).trim().split('\n');
      const all = log('HEAD');
      const arrival = log('HEAD', '--', '.workflows');
      assert.ok(all.length > 1, `the world layers history: ${all.join(' | ')}`);
      assert.ok(all.indexOf(arrival[0]) > 0, `.workflows/ arrives after the root commit: ${all.join(' | ')}`);
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, worlds.PROJECT_MANIFEST), 'utf8'));
      assert.strictEqual(manifest.defaults.tmux_labels, false, 'the label kill lands on the layered manifest');
      assert.deepStrictEqual(manifest.baseline, {}, 'the fixture\'s nothing-recorded baseline is left alone');
      assert.deepStrictEqual(worlds.readStampMarker(dir), { baseline: false });
      assert.strictEqual(statusLines(dir).length, 0, 'no dirt for the walk to sweep up');
    } finally {
      worlds.destroyWorld(dir);
    }
  });
});

describe('case selection: what a diff implicates', () => {
  const all = cases.loadAllCases();
  const sample = all[0];

  it('a recipe-hash-only change selects nothing', () => {
    const restamped = all.map((c) => `${c.rel}/${cases.SNAPSHOTS.fixture}/.recipe-hash`);
    assert.deepStrictEqual(cases.selectCases(all, restamped), [],
      'bookkeeping records when a world was rebuilt, never what a case tests');
  });

  it('a snapshot content change still selects its case', () => {
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
