'use strict';

// The roadmap domain — project-level horizons + items, lifecycle by join
// (skills/workflow-engine/scripts/domain/roadmap.cjs) — driven through the
// engine CLI: JIT birth, self-commits scoped to the project manifest, the
// joined-item guards, horizon restructuring, and the derived state read.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');

const { createManifest } = require('./discovery-test-utils.cjs');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');

// Hermetic git: no user/system config leaks into the engine's spawned git.
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_SYSTEM = '/dev/null';

/** @param {string} dir @param {string[]} args */
function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

/** A temp-dir git repo with an empty project manifest committed. */
function setupGitFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-roadmap-'));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'), '{}\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'init']);
  return dir;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

/** Run a roadmap command expecting success; returns the parsed JSON line. */
function runOk(dir, args) {
  return JSON.parse(execFileSync('node', [ENGINE, 'roadmap', ...args], { cwd: dir, encoding: 'utf8' }).trim());
}

/** Run a roadmap command expecting failure; returns the parsed stderr JSON. */
function runFail(dir, args) {
  const res = spawnSync('node', [ENGINE, 'roadmap', ...args], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(res.status, 1, `expected failure for: ${args.join(' ')}`);
  const parsed = JSON.parse(res.stderr.trim());
  assert.strictEqual(parsed.ok, false);
  return parsed;
}

function readProject(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'manifest.json'), 'utf8'));
}

function projectManifestText(dir) {
  return fs.readFileSync(path.join(dir, '.workflows', 'manifest.json'), 'utf8');
}

/** Write a joined item directly (the pull verb lands in a later slice). */
function joinItem(dir, name, workUnit, topic) {
  const manifest = readProject(dir);
  manifest.roadmap.items[name].pulled_to = topic ? { work_unit: workUnit, topic } : { work_unit: workUnit };
  fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'), JSON.stringify(manifest, null, 2));
}

describe('engine CLI: roadmap add / add-batch', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture(); });
  afterEach(() => { cleanup(dir); });

  it('JIT-births the node and the horizon, writes the item, self-commits scoped', () => {
    fs.writeFileSync(path.join(dir, 'unrelated.txt'), 'outside the scope\n');
    const res = runOk(dir, ['add', 'loyalty', '--horizon', 'v1', '--summary', 'repeat-customer rewards', '--origin', 'park:mvp', '--source', '.roadmap/sessions/session-001.md']);
    assert.strictEqual(res.op, 'add');
    assert.strictEqual(res.state, 'waiting');
    assert.strictEqual(res.horizon_created, true);
    assert.deepStrictEqual(res.horizons, ['v1']);
    assert.strictEqual(res.item_total, 1);
    assert.strictEqual(res.committed, git(dir, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'roadmap: add loyalty (v1)');
    // Scoped: the unrelated file stays uncommitted.
    assert.match(git(dir, ['status', '--porcelain']), /\?\? unrelated\.txt/);

    const item = readProject(dir).roadmap.items.loyalty;
    assert.deepStrictEqual(item, {
      horizon: 'v1',
      summary: 'repeat-customer rewards',
      origin: 'park:mvp',
      sources: ['.roadmap/sessions/session-001.md'],
    });
  });

  it('defaults origin to harvest and omits sources when none given', () => {
    runOk(dir, ['add', 'loyalty', '--horizon', 'v1', '--summary', 's']);
    const item = readProject(dir).roadmap.items.loyalty;
    assert.strictEqual(item.origin, 'harvest');
    assert.strictEqual('sources' in item, false);
    assert.strictEqual('pulled_to' in item, false);
    assert.strictEqual('status' in item, false);
  });

  it('reuses an existing horizon without re-creating it', () => {
    runOk(dir, ['add', 'a', '--horizon', 'v1', '--summary', 's']);
    const res = runOk(dir, ['add', 'b', '--horizon', 'v1', '--summary', 's']);
    assert.strictEqual('horizon_created' in res, false);
    assert.deepStrictEqual(res.horizons, ['v1']);
  });

  it('refuses duplicates, illegal names, bad origins, bad sources — nothing written', () => {
    runOk(dir, ['add', 'loyalty', '--horizon', 'v1', '--summary', 's']);
    const before = projectManifestText(dir);
    const head = git(dir, ['rev-parse', 'HEAD']).trim();

    assert.match(runFail(dir, ['add', 'loyalty', '--horizon', 'v1', '--summary', 's']).error, /already on the roadmap/);
    assert.match(runFail(dir, ['add', 'bad.name', '--horizon', 'v1', '--summary', 's']).error, /not a legal item name/);
    assert.match(runFail(dir, ['add', 'bad/name', '--horizon', 'v1', '--summary', 's']).error, /not a legal item name/);
    assert.match(runFail(dir, ['add', 'x', '--horizon', 'v1', '--summary', '  ']).error, /non-empty one-liner/);
    assert.match(runFail(dir, ['add', 'x', '--summary', 's']).error, /--horizon is required/);
    assert.match(runFail(dir, ['add', 'x', '--horizon', 'v1', '--summary', 's', '--origin', 'gremlin']).error, /unknown origin/);
    assert.match(runFail(dir, ['add', 'x', '--horizon', 'v1', '--summary', 's', '--origin', 'park:']).error, /unknown origin/);
    assert.match(runFail(dir, ['add', 'x', '--horizon', 'v1', '--summary', 's', '--source', '/abs/path.md']).error, /never absolute/);
    assert.match(runFail(dir, ['add', 'x', '--horizon', 'v1', '--summary', 's', '--source', '../escape.md']).error, /never absolute or traversing/);
    assert.match(runFail(dir, ['add', 'x', '--horizon', 'bad.h', '--summary', 's']).error, /not a legal horizon name/);

    assert.strictEqual(projectManifestText(dir), before);
    assert.strictEqual(git(dir, ['rev-parse', 'HEAD']).trim(), head);
  });

  it('accepts park: and inbox: origins with non-empty tails', () => {
    runOk(dir, ['add', 'a', '--horizon', 'v1', '--summary', 's', '--origin', 'park:mvp']);
    runOk(dir, ['add', 'b', '--horizon', 'v1', '--summary', 's', '--origin', 'inbox:2026-08-01--gift-cards']);
  });

  it('add-batch lands the whole set under one commit, JIT horizons in entry order', () => {
    const payload = [
      { name: 'ordering', horizon: 'mvp', summary: 'customers order from a menu' },
      { name: 'menus', horizon: 'mvp', summary: 'operators maintain the menu' },
      { name: 'loyalty', horizon: 'v1', summary: 'rewards', origin: 'harvest', sources: ['.roadmap/sessions/session-001.md'] },
    ];
    fs.writeFileSync(path.join(dir, 'items.json'), JSON.stringify(payload));
    const res = runOk(dir, ['add-batch', '--file', 'items.json']);
    assert.strictEqual(res.op, 'add-batch');
    assert.deepStrictEqual(res.horizons, ['mvp', 'v1']);
    assert.deepStrictEqual(res.horizons_created, ['mvp', 'v1']);
    assert.strictEqual(res.item_total, 3);
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'roadmap: add 3 items');
    // One commit for the batch on top of init.
    assert.strictEqual(git(dir, ['rev-list', '--count', 'HEAD']).trim(), '2');
  });

  it('add-batch validates everything before applying anything', () => {
    runOk(dir, ['add', 'loyalty', '--horizon', 'v1', '--summary', 's']);
    const before = projectManifestText(dir);

    fs.writeFileSync(path.join(dir, 'dup.json'), JSON.stringify([
      { name: 'fresh', horizon: 'mvp', summary: 's' },
      { name: 'loyalty', horizon: 'v1', summary: 's' },
    ]));
    assert.match(runFail(dir, ['add-batch', '--file', 'dup.json']).error, /"loyalty" is already on the roadmap — nothing was added/);

    fs.writeFileSync(path.join(dir, 'twice.json'), JSON.stringify([
      { name: 'x', horizon: 'mvp', summary: 's' },
      { name: 'x', horizon: 'v1', summary: 's' },
    ]));
    assert.match(runFail(dir, ['add-batch', '--file', 'twice.json']).error, /appears more than once/);

    fs.writeFileSync(path.join(dir, 'bad.json'), JSON.stringify([
      { name: 'ok', horizon: 'mvp', summary: 's' },
      { name: 'nope', horizon: 'mvp', summary: '' },
    ]));
    assert.match(runFail(dir, ['add-batch', '--file', 'bad.json']).error, /entry 2/);

    assert.strictEqual(projectManifestText(dir), before);
  });
});

describe('engine CLI: roadmap item ops and the joined-item guards', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    runOk(dir, ['add', 'ordering', '--horizon', 'mvp', '--summary', 'customers order']);
    runOk(dir, ['add', 'loyalty', '--horizon', 'v1', '--summary', 'rewards']);
    createManifest(dir, 'mvp', { work_type: 'epic', status: 'in-progress' });
    joinItem(dir, 'ordering', 'mvp');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'join']);
  });
  afterEach(() => { cleanup(dir); });

  it('edit rewrites the summary — on a pulled item too (cosmetic; the row is a window)', () => {
    const res = runOk(dir, ['edit', 'ordering', '--summary', 'guests order from a menu']);
    assert.strictEqual(res.op, 'edit');
    assert.strictEqual(res.state, 'in-flight');
    assert.strictEqual(readProject(dir).roadmap.items.ordering.summary, 'guests order from a menu');
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'roadmap: edit ordering');
  });

  it('rename carries every field across — the join included — and keeps key order', () => {
    const res = runOk(dir, ['rename', 'ordering', 'guest-ordering']);
    assert.strictEqual(res.renamed_from, 'ordering');
    assert.ok(res.preserved_fields.includes('pulled_to'));
    const items = readProject(dir).roadmap.items;
    assert.deepStrictEqual(Object.keys(items), ['guest-ordering', 'loyalty']);
    assert.deepStrictEqual(items['guest-ordering'].pulled_to, { work_unit: 'mvp' });
    assert.match(runFail(dir, ['rename', 'loyalty', 'guest-ordering']).error, /already on the roadmap/);
    assert.match(runFail(dir, ['rename', 'loyalty', 'loyalty']).error, /must differ/);
    assert.match(runFail(dir, ['rename', 'loyalty', 'a.b']).error, /not a legal item name/);
  });

  it('move re-buckets a waiting item, JIT-creating the horizon', () => {
    const res = runOk(dir, ['move', 'loyalty', '--horizon', 'v2']);
    assert.strictEqual(res.moved_from, 'v1');
    assert.strictEqual(res.horizon_created, true);
    assert.deepStrictEqual(res.horizons, ['mvp', 'v1', 'v2']);
    assert.match(runFail(dir, ['move', 'loyalty', '--horizon', 'v2']).error, /already in "v2"/);
  });

  it('refuses re-bucketing and removing a pulled item, naming the join and the recovery', () => {
    const before = projectManifestText(dir);
    const moveErr = runFail(dir, ['move', 'ordering', '--horizon', 'v1']).error;
    assert.match(moveErr, /joined to work unit "mvp"/);
    assert.match(moveErr, /delivery decision/);
    assert.match(moveErr, /revert returns it to waiting/);
    assert.match(runFail(dir, ['remove', 'ordering']).error, /joined to work unit "mvp"/);
    assert.strictEqual(projectManifestText(dir), before);
  });

  it('remove deletes a waiting item outright — no dismissed list', () => {
    const res = runOk(dir, ['remove', 'loyalty']);
    assert.strictEqual(res.item_total, 1);
    const roadmap = readProject(dir).roadmap;
    assert.strictEqual('loyalty' in roadmap.items, false);
    assert.strictEqual('dismissed' in roadmap, false);
    assert.match(runFail(dir, ['remove', 'ghost']).error, /no roadmap item "ghost"/);
  });
});

describe('engine CLI: roadmap horizon ops', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    runOk(dir, ['add', 'ordering', '--horizon', 'mvp', '--summary', 's']);
    runOk(dir, ['add', 'menus', '--horizon', 'mvp', '--summary', 's']);
    runOk(dir, ['add', 'loyalty', '--horizon', 'v1', '--summary', 's']);
  });
  afterEach(() => { cleanup(dir); });

  it('add inserts at a position; refuses duplicates and bad positions', () => {
    const res = runOk(dir, ['horizon', 'add', 'v2', '--position', '2']);
    assert.deepStrictEqual(res.horizons, ['mvp', 'v2', 'v1']);
    assert.match(runFail(dir, ['horizon', 'add', 'v2']).error, /already exists/);
    assert.match(runFail(dir, ['horizon', 'add', 'v3', '--position', '9']).error, /between 1 and 4/);
    assert.match(runFail(dir, ['horizon', 'add', 'v3', '--position', '0']).error, /between 1 and 4/);
  });

  it('rename cascades to member items — joined ones included — and holds position', () => {
    createManifest(dir, 'mvp', { work_type: 'epic', status: 'in-progress' });
    joinItem(dir, 'ordering', 'mvp');
    const res = runOk(dir, ['horizon', 'rename', 'mvp', 'launch']);
    assert.strictEqual(res.items_updated, 2);
    assert.deepStrictEqual(res.horizons, ['launch', 'v1']);
    const items = readProject(dir).roadmap.items;
    assert.strictEqual(items.ordering.horizon, 'launch');
    assert.strictEqual(items.menus.horizon, 'launch');
    assert.strictEqual(items.loyalty.horizon, 'v1');
    assert.match(runFail(dir, ['horizon', 'rename', 'ghost', 'x']).error, /no horizon "ghost"/);
    assert.match(runFail(dir, ['horizon', 'rename', 'v1', 'launch']).error, /already exists/);
  });

  it('reorder demands a complete permutation', () => {
    assert.match(runFail(dir, ['horizon', 'reorder', 'v1']).error, /every existing horizon exactly once/);
    assert.match(runFail(dir, ['horizon', 'reorder', 'v1', 'mvp', 'ghost']).error, /every existing horizon exactly once/);
    assert.match(runFail(dir, ['horizon', 'reorder', 'v1', 'v1']).error, /every existing horizon exactly once/);
    const res = runOk(dir, ['horizon', 'reorder', 'v1', 'mvp']);
    assert.deepStrictEqual(res.horizons, ['v1', 'mvp']);
  });

  it('merge moves every member — joined included — and drops the source label', () => {
    createManifest(dir, 'mvp', { work_type: 'epic', status: 'in-progress' });
    joinItem(dir, 'ordering', 'mvp');
    const res = runOk(dir, ['horizon', 'merge', 'mvp', '--into', 'v1']);
    assert.strictEqual(res.items_moved, 2);
    assert.deepStrictEqual(res.horizons, ['v1']);
    const items = readProject(dir).roadmap.items;
    assert.strictEqual(items.ordering.horizon, 'v1');
    assert.deepStrictEqual(items.ordering.pulled_to, { work_unit: 'mvp' });
    assert.match(runFail(dir, ['horizon', 'merge', 'v1', '--into', 'v1']).error, /must differ/);
    assert.match(runFail(dir, ['horizon', 'merge', 'ghost', '--into', 'v1']).error, /no horizon "ghost"/);
  });

  it('split creates the new horizon after the source and moves only source members', () => {
    const res = runOk(dir, ['horizon', 'split', 'mvp', '--new', 'mvp-2', '--items', 'menus']);
    assert.deepStrictEqual(res.horizons, ['mvp', 'mvp-2', 'v1']);
    assert.strictEqual(res.items_moved, 1);
    assert.strictEqual(readProject(dir).roadmap.items.menus.horizon, 'mvp-2');

    assert.match(runFail(dir, ['horizon', 'split', 'mvp', '--new', 'mvp-3', '--items', 'loyalty']).error, /is in "v1", not "mvp"/);
    assert.match(runFail(dir, ['horizon', 'split', 'mvp', '--new', 'v1', '--items', 'ordering']).error, /already exists/);
    assert.match(runFail(dir, ['horizon', 'split', 'mvp', '--new', 'mvp-3', '--items', 'ordering,ordering']).error, /more than once/);
  });

  it('remove refuses a horizon with members, naming them; removes an empty one', () => {
    const err = runFail(dir, ['horizon', 'remove', 'mvp']).error;
    assert.match(err, /holds 2 items \(ordering, menus\)/);
    runOk(dir, ['horizon', 'add', 'empty-h']);
    const res = runOk(dir, ['horizon', 'remove', 'empty-h']);
    assert.deepStrictEqual(res.horizons, ['mvp', 'v1']);
  });
});

describe('engine CLI: roadmap pull / bind / pull-forward', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    runOk(dir, ['add', 'ordering', '--horizon', 'mvp', '--summary', 'customers order']);
    runOk(dir, ['add', 'menus', '--horizon', 'mvp', '--summary', 'operators maintain']);
    runOk(dir, ['add', 'kds', '--horizon', 'mvp', '--summary', 'orders reach the kitchen']);
    runOk(dir, ['add', 'loyalty', '--horizon', 'v1', '--summary', 'rewards']);
    createManifest(dir, 'mvp', { work_type: 'epic', status: 'in-progress', phases: { discovery: { items: {} } } });
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'fixture']);
  });
  afterEach(() => { cleanup(dir); });

  it('pull joins a subset and names the remainder per touched horizon', () => {
    const res = runOk(dir, ['pull', 'ordering', 'menus', '--into', 'mvp']);
    assert.deepStrictEqual(res.pulled, ['ordering', 'menus']);
    assert.deepStrictEqual(res.remainder, { mvp: 1 });
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'roadmap: pull 2 items into mvp');
    const items = readProject(dir).roadmap.items;
    assert.deepStrictEqual(items.ordering.pulled_to, { work_unit: 'mvp' });
    assert.deepStrictEqual(items.menus.pulled_to, { work_unit: 'mvp' });
    assert.strictEqual('pulled_to' in items.kds, false);
    const state = runOk(dir, ['state']);
    assert.strictEqual(state.totals.in_flight, 2);
    assert.strictEqual(state.totals.waiting, 2);
  });

  it('pull validates everything before joining anything', () => {
    const before = projectManifestText(dir);
    assert.match(runFail(dir, ['pull', 'ordering', 'ghost', '--into', 'mvp']).error, /no roadmap item "ghost"/);
    assert.match(runFail(dir, ['pull', 'ordering', 'ordering', '--into', 'mvp']).error, /more than once/);
    assert.match(runFail(dir, ['pull', 'ordering', '--into', 'never-made']).error, /no work unit "never-made"/);
    createManifest(dir, 'done-unit', { work_type: 'epic', status: 'completed' });
    assert.match(runFail(dir, ['pull', 'ordering', '--into', 'done-unit']).error, /active work only/);
    assert.strictEqual(projectManifestText(dir), before);

    runOk(dir, ['pull', 'ordering', '--into', 'mvp']);
    assert.match(runFail(dir, ['pull', 'ordering', '--into', 'mvp']).error, /already joined to work unit "mvp"/);
  });

  it('bind names the topic the item crystallised as — validated against the map', () => {
    runOk(dir, ['pull', 'ordering', '--into', 'mvp']);
    assert.match(runFail(dir, ['bind', 'ordering', '--topic', 'guest-ordering']).error, /no discovery item "guest-ordering" on "mvp"/);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'mvp', 'manifest.json'), 'utf8'));
    manifest.phases.discovery.items['guest-ordering'] = { routing: 'discussion', source: 'roadmap', summary: 's' };
    fs.writeFileSync(path.join(dir, '.workflows', 'mvp', 'manifest.json'), JSON.stringify(manifest, null, 2));
    const res = runOk(dir, ['bind', 'ordering', '--topic', 'guest-ordering']);
    assert.strictEqual(res.work_unit, 'mvp');
    assert.deepStrictEqual(readProject(dir).roadmap.items.ordering.pulled_to, { work_unit: 'mvp', topic: 'guest-ordering' });
    assert.match(runFail(dir, ['bind', 'loyalty', '--topic', 'guest-ordering']).error, /not joined to a work unit/);
  });

  it('pull-forward lands the map topic and the join in one commit staging both manifests', () => {
    const res = runOk(dir, ['pull-forward', 'loyalty', '--into', 'mvp', '--routing', 'discussion']);
    assert.strictEqual(res.topic, 'loyalty');
    assert.strictEqual(res.state, 'in-flight');
    // The epic's map item, source roadmap, summary carried from the item.
    const epicItem = JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'mvp', 'manifest.json'), 'utf8'))
      .phases.discovery.items.loyalty;
    assert.deepStrictEqual(epicItem, { routing: 'discussion', source: 'roadmap', summary: 'rewards' });
    assert.deepStrictEqual(readProject(dir).roadmap.items.loyalty.pulled_to, { work_unit: 'mvp', topic: 'loyalty' });
    // One commit, both manifests staged.
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'roadmap: pull-forward loyalty into mvp');
    const staged = git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(staged.includes('.workflows/manifest.json'), 'project manifest staged');
    assert.ok(staged.includes('.workflows/mvp/manifest.json'), 'epic manifest staged');
  });

  it('pull-forward refuses a non-epic, a joined item, and an occupied topic name', () => {
    createManifest(dir, 'small', { work_type: 'feature', status: 'in-progress' });
    assert.match(runFail(dir, ['pull-forward', 'loyalty', '--into', 'small', '--routing', 'discussion']).error, /is a feature/);
    runOk(dir, ['pull', 'ordering', '--into', 'mvp']);
    assert.match(runFail(dir, ['pull-forward', 'ordering', '--into', 'mvp', '--routing', 'discussion']).error, /already joined/);
    runOk(dir, ['pull-forward', 'loyalty', '--into', 'mvp', '--routing', 'discussion']);
    runOk(dir, ['move', 'kds', '--horizon', 'v1']);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'mvp', 'manifest.json'), 'utf8'));
    manifest.phases.discovery.items.kds = { routing: 'discussion', source: 'discovery', summary: 'already here' };
    fs.writeFileSync(path.join(dir, '.workflows', 'mvp', 'manifest.json'), JSON.stringify(manifest, null, 2));
    assert.match(runFail(dir, ['pull-forward', 'kds', '--into', 'mvp', '--routing', 'discussion']).error, /already on the map/);
  });

  it('pull-forward honours the dismissed list, force passing the confirmed re-add through', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'mvp', 'manifest.json'), 'utf8'));
    manifest.phases.discovery.dismissed = ['loyalty'];
    fs.writeFileSync(path.join(dir, '.workflows', 'mvp', 'manifest.json'), JSON.stringify(manifest, null, 2));
    assert.match(runFail(dir, ['pull-forward', 'loyalty', '--into', 'mvp', '--routing', 'discussion']).error, /previously dismissed/);
    const res = runOk(dir, ['pull-forward', 'loyalty', '--into', 'mvp', '--routing', 'discussion', '--force-dismissed']);
    assert.strictEqual(res.state, 'in-flight');
  });
});

describe('engine CLI: the cancel-revert hop', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    runOk(dir, ['add', 'ordering', '--horizon', 'mvp', '--summary', 's']);
    runOk(dir, ['add', 'menus', '--horizon', 'mvp', '--summary', 's']);
    createManifest(dir, 'mvp', {
      work_type: 'epic',
      status: 'in-progress',
      phases: {
        discovery: { items: { ordering: { routing: 'discussion', source: 'roadmap', summary: 's' } } },
        discussion: { items: { ordering: { status: 'in-progress' } } },
      },
    });
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'fixture']);
    runOk(dir, ['pull', 'ordering', 'menus', '--into', 'mvp']);
    runOk(dir, ['bind', 'ordering', '--topic', 'ordering']);
  });
  afterEach(() => { cleanup(dir); });

  function engineOk(args) {
    return JSON.parse(execFileSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8' }).split('\n')[0].trim());
  }

  it('topic cancel reverts the bound item to waiting, staging the project manifest', () => {
    const res = engineOk(['topic', 'cancel', 'mvp', 'discussion', 'ordering']);
    assert.deepStrictEqual(res.roadmap_reverted, ['ordering']);
    const items = readProject(dir).roadmap.items;
    assert.strictEqual('pulled_to' in items.ordering, false);
    assert.strictEqual(items.ordering.origin, 'harvest', 'origin survives the revert');
    // The wu-level joined sibling is untouched — its topic wasn't cancelled.
    assert.deepStrictEqual(items.menus.pulled_to, { work_unit: 'mvp' });
    const staged = git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(staged.includes('.workflows/manifest.json'), 'project manifest rides the cancel commit');
    const state = runOk(dir, ['state']);
    assert.strictEqual(state.items.find((i) => i.name === 'ordering').state, 'waiting');
  });

  it('work-unit cancel reverts every join into the unit', () => {
    const res = engineOk(['workunit', 'cancel', 'mvp']);
    assert.deepStrictEqual([...res.roadmap_reverted].sort(), ['menus', 'ordering']);
    const state = runOk(dir, ['state']);
    assert.deepStrictEqual(state.totals, { items: 2, waiting: 2, in_flight: 0, shipped: 0, orphaned: 0 });
    const staged = git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(staged.includes('.workflows/manifest.json'), 'project manifest rides the cancel commit');
  });

  it('work-unit complete leaves joins in place — shipped by derivation, no revert', () => {
    const res = engineOk(['workunit', 'complete', 'mvp', '-m', 'done']);
    assert.strictEqual('roadmap_reverted' in res, false);
    const state = runOk(dir, ['state']);
    assert.strictEqual(state.totals.shipped, 2);
  });
});

describe('engine CLI: roadmap flag — reconcile across the join', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    runOk(dir, ['add', 'ordering', '--horizon', 'mvp', '--summary', 's']);
    runOk(dir, ['add', 'menus', '--horizon', 'mvp', '--summary', 's']);
    createManifest(dir, 'mvp', {
      work_type: 'epic',
      status: 'in-progress',
      phases: {
        discovery: { items: { ordering: { routing: 'discussion', source: 'roadmap', summary: 's' } } },
        research: { items: { ordering: { status: 'superseded' } } },
        discussion: { items: { ordering: { status: 'completed' } } },
      },
    });
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'fixture']);
    runOk(dir, ['pull', 'ordering', 'menus', '--into', 'mvp']);
    runOk(dir, ['bind', 'ordering', '--topic', 'ordering']);
  });
  afterEach(() => { cleanup(dir); });

  it('flags the live phase item, skips terminal ones, never clobbers', () => {
    const res = runOk(dir, ['flag', 'ordering']);
    assert.deepStrictEqual(res.flagged, [{ phase: 'discussion', topic: 'ordering' }]);
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'roadmap: flag ordering — input moved');
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'mvp', 'manifest.json'), 'utf8'));
    assert.strictEqual(manifest.phases.discussion.items.ordering.reconcile_needed, 'roadmap');
    assert.strictEqual('reconcile_needed' in manifest.phases.research.items.ordering, false, 'terminal item skipped');

    // Never clobbered: a second flag finds the existing one and writes nothing.
    const again = runOk(dir, ['flag', 'ordering']);
    assert.deepStrictEqual(again.flagged, []);
    assert.match(again.note, /no live phase item to flag/);
  });

  it('a wu-level join (no topic yet) flags nothing — the harvest reads fresh', () => {
    const res = runOk(dir, ['flag', 'menus']);
    assert.deepStrictEqual(res.flagged, []);
    assert.strictEqual(res.committed, null);
    assert.match(runFail(dir, ['flag', 'ghost']).error, /no roadmap item "ghost"/);
    runOk(dir, ['add', 'waiting-one', '--horizon', 'v2', '--summary', 's']);
    assert.match(runFail(dir, ['flag', 'waiting-one']).error, /not joined/);
  });
});

describe('engine CLI: roadmap sessions and imports', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture(); });
  afterEach(() => { cleanup(dir); });

  function draft(name, content) {
    fs.writeFileSync(path.join(dir, name), content);
    return name;
  }

  it('open installs the draft as session-001, sets the marker, JIT-births the node — no commit', () => {
    const head = git(dir, ['rev-parse', 'HEAD']).trim();
    const res = runOk(dir, ['session', 'open', '--session-log-file', draft('draft.md', '# Roadmap Session 001\n')]);
    assert.strictEqual(res.session, '001');
    assert.strictEqual(res.path, '.workflows/.roadmap/sessions/session-001.md');
    assert.strictEqual(fs.existsSync(path.join(dir, 'draft.md')), false, 'draft consumed (moved)');
    assert.strictEqual(readProject(dir).roadmap.active_session, '001');
    assert.strictEqual(git(dir, ['rev-parse', 'HEAD']).trim(), head, 'open never commits — the session is live');

    assert.match(runFail(dir, ['session', 'open', '--session-log-file', draft('d2.md', 'x')]).error, /already open/);
    const state = runOk(dir, ['state']);
    assert.strictEqual(state.active_session, '001');
    assert.deepStrictEqual(state.session_logs, [{ number: 1, path: '.workflows/.roadmap/sessions/session-001.md' }]);
    assert.strictEqual(state.next_session_number, 2);
  });

  it('open refuses a missing or empty draft, everything pristine', () => {
    assert.match(runFail(dir, ['session', 'open', '--session-log-file', 'ghost.md']).error, /draft not found/);
    assert.match(runFail(dir, ['session', 'open', '--session-log-file', draft('empty.md', '  \n')]).error, /draft is empty/);
    assert.strictEqual(fs.existsSync(path.join(dir, 'empty.md')), true, 'refusal leaves the draft in place');
  });

  it('close clears the marker, indexes, and commits the roadmap dir + project manifest', () => {
    runOk(dir, ['session', 'open', '--session-log-file', draft('draft.md', '# Session\n\nExploration.\n')]);
    runOk(dir, ['add', 'loyalty', '--horizon', 'v1', '--summary', 's']);
    const res = runOk(dir, ['session', 'close', '-m', 'roadmap: session 001 — genesis']);
    assert.strictEqual(res.session, '001');
    assert.strictEqual('active_session' in readProject(dir).roadmap, false);
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'roadmap: session 001 — genesis');
    const staged = git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(staged.includes('.workflows/.roadmap/sessions/session-001.md'), 'session log staged');
    assert.match(runFail(dir, ['session', 'close', '-m', 'again']).error, /no active roadmap session/);

    // The next open allocates from disk: session-002.
    const again = runOk(dir, ['session', 'open', '--session-log-file', draft('d2.md', '# Session 2\n')]);
    assert.strictEqual(again.session, '002');
  });

  it('import lands files with create discipline: normalise, dedupe, track, one commit', () => {
    fs.writeFileSync(path.join(dir, 'My App Idea.md'), '# The idea\n');
    fs.writeFileSync(path.join(dir, 'my-app-idea.md'), '# A colliding name\n');
    const res = runOk(dir, ['import', 'My App Idea.md', 'my-app-idea.md']);
    assert.deepStrictEqual(res.imports, [{ path: 'imports/my-app-idea.md' }, { path: 'imports/my-app-idea-2.md' }]);
    assert.ok(fs.existsSync(path.join(dir, '.workflows', '.roadmap', 'imports', 'my-app-idea.md')));
    assert.ok(fs.existsSync(path.join(dir, '.workflows', '.roadmap', 'imports', 'my-app-idea-2.md')));
    const entries = readProject(dir).roadmap.imports;
    assert.strictEqual(entries.length, 2);
    assert.strictEqual(entries[0].path, 'imports/my-app-idea.md');
    assert.ok(entries[0].imported_at, 'entries carry a timestamp');
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'roadmap: import 2 files');
    const state = runOk(dir, ['state']);
    assert.deepStrictEqual(state.imports, [{ path: 'imports/my-app-idea.md' }, { path: 'imports/my-app-idea-2.md' }]);
  });

  it('import fails whole with missing_imports so the flow can re-prompt', () => {
    fs.writeFileSync(path.join(dir, 'real.md'), '# real\n');
    const res = runFail(dir, ['import', 'real.md', 'ghost.md']);
    assert.deepStrictEqual(res.missing_imports, ['ghost.md']);
    assert.strictEqual(fs.existsSync(path.join(dir, '.workflows', '.roadmap', 'imports')), false, 'nothing landed');
  });

  it('commit --roadmap sweeps the roadmap dir + project manifest, nothing else', () => {
    runOk(dir, ['session', 'open', '--session-log-file', draft('draft.md', '# Session\n')]);
    fs.appendFileSync(path.join(dir, '.workflows', '.roadmap', 'sessions', 'session-001.md'), '\nMore exploration.\n');
    fs.writeFileSync(path.join(dir, 'unrelated.txt'), 'outside the scope\n');
    const res = JSON.parse(execFileSync('node', [ENGINE, 'commit', '--roadmap', '-m', 'roadmap: exploration notes — session-001'], { cwd: dir, encoding: 'utf8' }).trim());
    assert.ok(res.committed);
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'roadmap: exploration notes — session-001');
    assert.match(git(dir, ['status', '--porcelain']), /\?\? unrelated\.txt/);
    const clean = JSON.parse(execFileSync('node', [ENGINE, 'commit', '--roadmap', '-m', 'nothing'], { cwd: dir, encoding: 'utf8' }).trim());
    assert.strictEqual(clean.committed, null);
  });
});

describe('engine CLI: roadmap state — lifecycle by join', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture(); });
  afterEach(() => { cleanup(dir); });

  it('reads exists:false on a project with no roadmap', () => {
    const res = runOk(dir, ['state']);
    assert.deepStrictEqual(res, {
      ok: true,
      exists: false,
      horizons: [],
      items: [],
      totals: { items: 0, waiting: 0, in_flight: 0, shipped: 0, orphaned: 0 },
      active_session: null,
      session_logs: [],
      next_session_number: 1,
      imports: [],
    });
  });

  it('derives waiting / in-flight / shipped / orphaned from the join, never from storage', () => {
    runOk(dir, ['add', 'ordering', '--horizon', 'mvp', '--summary', 's']);
    runOk(dir, ['add', 'menus', '--horizon', 'mvp', '--summary', 's']);
    runOk(dir, ['add', 'loyalty', '--horizon', 'v1', '--summary', 's']);
    runOk(dir, ['add', 'ghost-work', '--horizon', 'v1', '--summary', 's']);
    runOk(dir, ['add', 'dead-work', '--horizon', 'v1', '--summary', 's']);
    createManifest(dir, 'mvp', { work_type: 'epic', status: 'in-progress' });
    createManifest(dir, 'mvp-0', { work_type: 'epic', status: 'completed' });
    createManifest(dir, 'axed', { work_type: 'epic', status: 'cancelled' });
    joinItem(dir, 'ordering', 'mvp', 'ordering');
    joinItem(dir, 'menus', 'mvp-0');
    joinItem(dir, 'ghost-work', 'never-created');
    joinItem(dir, 'dead-work', 'axed');

    const res = runOk(dir, ['state']);
    assert.strictEqual(res.exists, true);
    assert.deepStrictEqual(res.horizons, ['mvp', 'v1']);
    const byName = Object.fromEntries(res.items.map((i) => [i.name, i]));
    assert.strictEqual(byName.ordering.state, 'in-flight');
    assert.strictEqual(byName.ordering.work_unit, 'mvp');
    assert.strictEqual(byName.ordering.topic, 'ordering');
    assert.strictEqual(byName.menus.state, 'shipped');
    assert.strictEqual(byName.loyalty.state, 'waiting');
    assert.strictEqual('work_unit' in byName.loyalty, false);
    assert.strictEqual(byName['ghost-work'].state, 'orphaned');
    assert.strictEqual(byName['dead-work'].state, 'orphaned');
    assert.deepStrictEqual(res.totals, { items: 5, waiting: 1, in_flight: 1, shipped: 1, orphaned: 2 });
    // Horizon-ordered: mvp members first, then v1's.
    assert.deepStrictEqual(res.items.map((i) => i.name), ['ordering', 'menus', 'loyalty', 'ghost-work', 'dead-work']);
  });
});
