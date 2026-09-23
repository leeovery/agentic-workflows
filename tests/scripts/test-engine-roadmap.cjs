'use strict';

// The roadmap domain — project-level horizons + items, lifecycle by join
// (skills/workflow-engine/scripts/domain/roadmap.cjs) — driven through the
// engine CLI: JIT birth, self-commits scoped to the project manifest, the
// joined-item guards, horizon restructuring, and the derived state read.
// One landing guard is driven directly instead: a peer taking a name
// between a postpone's plan and its write is a race no CLI sequence can
// reach, and the guard is the reason it can never become an overwrite.

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { createManifest } = require('./discovery-test-utils.cjs');
const { postponeToRoadmap } = require('../../skills/workflow-engine/scripts/domain/roadmap.cjs');
const harness = require('./engine-harness.cjs');

const { git, cleanupFixture: cleanup, ok, output, refuses, stubbedEngine, knowledgeCalls } = harness;

/** A temp-dir git repo with an empty project manifest committed. */
function setupGitFixture() {
  const dir = harness.setupGitFixture('engine-roadmap-');
  fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'), '{}\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'init']);
  return dir;
}

/** Run a roadmap command expecting success; returns the parsed JSON line. */
const runOk = (dir, args) => ok(dir, ['roadmap', ...args]);

/** Run a roadmap command expecting failure; returns the parsed stderr JSON. */
const runFail = (dir, args) => refuses(dir, ['roadmap', ...args]);

function readProject(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'manifest.json'), 'utf8'));
}

function projectManifestText(dir) {
  return fs.readFileSync(path.join(dir, '.workflows', 'manifest.json'), 'utf8');
}

/** Write a joined item directly — corrupt-shape and orphan fixtures the verbs refuse to create. */
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

describe('engine CLI: the postpone — a topic leaves the epic for the roadmap and comes back by the pull', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    createManifest(dir, 'mvp', {
      work_type: 'epic',
      status: 'in-progress',
      phases: {
        discovery: { items: {
          ordering: { routing: 'discussion', source: 'discovery', summary: 'Customers order', order: 1, brief_path: 'discovery/briefs/ordering.md' },
          menus: { routing: 'discussion', source: 'discovery', summary: 'Operators maintain', order: 2 },
          loyalty: { routing: 'discussion', source: 'discovery', order: 3 },
        } },
        research: { items: { ordering: { status: 'completed' } } },
        discussion: { items: { ordering: { status: 'in-progress' }, menus: { status: 'completed' } } },
        specification: { items: { grp: { status: 'proposed', sources: { ordering: { status: 'pending' } } } } },
      },
    });
    for (const rel of ['discovery/briefs/ordering.md', 'research/ordering.md', 'discussion/ordering.md']) {
      const abs = path.join(dir, '.workflows', 'mvp', rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, '# x\n');
    }
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'fixture']);
  });
  afterEach(() => { cleanup(dir); });

  const engineOk = (/** @type {string[]} */ args) => ok(dir, args);
  const engineFails = (/** @type {string[]} */ args, /** @type {RegExp} */ p) => refuses(dir, args, p);
  const epicText = () => fs.readFileSync(path.join(dir, '.workflows', 'mvp', 'manifest.json'), 'utf8');
  const epic = () => JSON.parse(epicText());

  it('the birth arm: map and horizon born JIT, origin and postponed_from written, sources only where the file exists', () => {
    const res = engineOk(['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'next']);
    assert.strictEqual(res.status, 'postponed');
    assert.deepStrictEqual(res.postponed, [
      { phase: 'research', previous_status: 'completed' },
      { phase: 'discussion', previous_status: 'in-progress' },
    ]);
    assert.deepStrictEqual(res.discarded, ['grp']);
    assert.deepStrictEqual(res.roadmap, { name: 'ordering', horizon: 'next', born_map: true, born_horizon: true, reverted_join: false });

    assert.deepStrictEqual(readProject(dir).roadmap, {
      horizons: ['next'],
      items: { ordering: {
        horizon: 'next',
        summary: 'Customers order',
        origin: 'postpone:mvp',
        postponed_from: { work_unit: 'mvp', topic: 'ordering' },
        sources: ['mvp/discovery/briefs/ordering.md', 'mvp/research/ordering.md', 'mvp/discussion/ordering.md'],
      } },
    });
    const m = epic();
    assert.deepStrictEqual(m.phases.discovery.items.ordering,
      { routing: 'discussion', source: 'discovery', summary: 'Customers order', brief_path: 'discovery/briefs/ordering.md', postponed: true, previous_order: 1 });
    assert.strictEqual(m.phases.research.items.ordering.status, 'postponed');
    assert.strictEqual(m.phases.discussion.items.ordering.previous_status, 'in-progress');
    assert.strictEqual(m.phases.specification.items.grp, undefined, 'the proposed grouping is discarded, never stashed');

    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'workflow(mvp): postpone ordering → next');
    const staged = git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(staged.includes('.workflows/manifest.json'), 'project manifest staged');
    assert.ok(staged.includes('.workflows/mvp/manifest.json'), 'epic manifest staged');
  });

  it('a never-started topic with no files: the row alone, the summary falling back to its name', () => {
    const res = engineOk(['topic', 'postpone', 'mvp', 'loyalty', '--horizon', 'later']);
    assert.deepStrictEqual(res.postponed, []);
    const item = readProject(dir).roadmap.items.loyalty;
    assert.strictEqual(item.summary, 'Loyalty');
    assert.strictEqual('sources' in item, false);
    assert.strictEqual(epic().phases.discovery.items.loyalty.postponed, true);
  });

  it('a second postpone joins the existing map under a new horizon', () => {
    engineOk(['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'next']);
    const res = engineOk(['topic', 'postpone', 'mvp', 'menus', '--horizon', 'later']);
    assert.deepStrictEqual(res.roadmap, { name: 'menus', horizon: 'later', born_map: false, born_horizon: true, reverted_join: false });
    assert.deepStrictEqual(readProject(dir).roadmap.horizons, ['next', 'later']);
  });

  it('the re-wait arm: a pulled topic\'s own item loses its join, takes the horizon, and keeps its name and origin', () => {
    runOk(dir, ['add', 'guest-ordering', '--horizon', 'mvp', '--summary', 'customers order', '--origin', 'harvest']);
    runOk(dir, ['pull', 'guest-ordering', '--into', 'mvp']);
    runOk(dir, ['bind', 'guest-ordering', '--topic', 'ordering']);
    const res = engineOk(['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'later']);
    assert.deepStrictEqual(res.roadmap, { name: 'guest-ordering', horizon: 'later', born_map: false, born_horizon: true, reverted_join: true });
    const item = readProject(dir).roadmap.items['guest-ordering'];
    assert.strictEqual('pulled_to' in item, false, 'the join reverts');
    assert.strictEqual(item.horizon, 'later');
    assert.strictEqual(item.origin, 'harvest', 'a re-wait leaves the origin as it was');
    assert.deepStrictEqual(item.postponed_from, { work_unit: 'mvp', topic: 'ordering' });
    assert.strictEqual(readProject(dir).roadmap.items.ordering, undefined, 'no second item is born under the topic name');
  });

  it('a name clash seeded between the gate and the verb refuses the whole transaction — nothing on either manifest moves', () => {
    output(dir, ['render', 'postpone-gate', 'mvp.discovery.ordering', '--horizon', 'next']);
    runOk(dir, ['add', 'ordering', '--horizon', 'mvp', '--summary', 'somebody else\'s', '--origin', 'harvest']);
    const before = [projectManifestText(dir), epicText()];
    engineFails(['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'next'],
      /a roadmap item named "ordering" \(horizon "mvp"\) is not this topic's — rename or remove it on the roadmap first/);
    assert.deepStrictEqual([projectManifestText(dir), epicText()], before);
  });

  it('an illegal horizon refuses at the gate and at the verb, and the epic never moves', () => {
    const stub = stubbedEngine();
    const before = epicText();
    assert.throws(() => output(dir, ['render', 'postpone-gate', 'mvp.discovery.ordering', '--horizon', 'v2.1']));
    assert.match(stub.refuses(dir, ['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'v2.1']).error,
      /"v2\.1" is not a legal horizon name — dots and slashes break manifest addressing/);
    assert.strictEqual(epicText(), before, 'the hold is never written');
    assert.deepStrictEqual(knowledgeCalls(dir), [], 'and no chunk is removed for a topic that stayed');
  });

  it('a refusal at the landing leaves the epic manifest unsaved and its chunks in place', () => {
    // The roadmap side lands inside the work-unit lock, before the epic is
    // saved: a malformed node refuses there, with the hold written in memory
    // alone. Seeded here because the race it stands in for — a peer taking
    // the name in the window — no CLI sequence can reach.
    const project = readProject(dir);
    project.roadmap = { horizons: {}, items: {} };
    fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'), JSON.stringify(project, null, 2));
    const stub = stubbedEngine();
    const before = epicText();
    assert.match(stub.refuses(dir, ['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'next']).error,
      /roadmap\.horizons is malformed/);
    assert.strictEqual(epicText(), before, 'the topic is where the plan found it');
    assert.deepStrictEqual(knowledgeCalls(dir), []);
  });

  it('the landing refuses a name a peer took between the plan and the project lock — a birth never overwrites', () => {
    // The verb's plan reads the roadmap before the project lock is taken;
    // this item lands in the window after it.
    runOk(dir, ['add', 'ordering', '--horizon', 'mvp', '--summary', 'somebody else\'s', '--origin', 'harvest']);
    const before = projectManifestText(dir);
    assert.throws(
      () => postponeToRoadmap(dir, 'mvp', 'ordering', { horizon: 'next', summary: 'Customers order', sources: [] }),
      /a roadmap item named "ordering" \(horizon "mvp"\) is not this topic's — rename or remove it on the roadmap first/,
    );
    assert.strictEqual(projectManifestText(dir), before, 'the peer\'s item stands, untouched');
  });

  it('refuses a missing horizon and a non-epic work unit', () => {
    engineFails(['topic', 'postpone', 'mvp', 'ordering'], /--horizon is required/);
    createManifest(dir, 'small', { work_type: 'feature', status: 'in-progress', phases: { discussion: { items: { small: { status: 'in-progress' } } } } });
    engineFails(['topic', 'postpone', 'small', 'small', '--horizon', 'next'],
      /postpone is epic-only — "small" is a feature, whose topic is the work unit/);
  });

  it('the roadmap owns it from there: cancel and reactivate refuse, triage lands, the field surface refuses a status write and a delete', () => {
    engineOk(['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'next']);
    engineFails(['topic', 'cancel', 'mvp', 'discovery', 'ordering'],
      /"ordering" is postponed — the roadmap owns it; remove its item there to cancel it, or pull it forward first/);
    engineFails(['topic', 'reactivate', 'mvp', 'discovery', 'ordering'],
      /"ordering" is postponed, not cancelled — pull it forward from the roadmap instead/);
    engineFails(['topic', 'start', 'mvp', 'discussion', 'ordering'],
      /discussion item "ordering" is postponed — the topic waits on the roadmap; pull it forward from there instead/);
    engineFails(['manifest', 'set', 'mvp.discussion.ordering', 'status', 'in-progress'],
      /discussion item "ordering" is postponed — pull it forward from the roadmap instead/);
    engineFails(['manifest', 'delete', 'mvp.discussion.ordering', 'previous_status'],
      /discussion item "ordering" is postponed — pull it forward from the roadmap instead/);
    // A concern for a topic that waits is mail that waits with it.
    const parked = engineOk(['topic', 'triage', 'mvp', 'research', 'ordering']);
    assert.strictEqual(parked.status, 'postponed', 'the triage leaves the hold alone');
  });

  it('roadmap remove cancels the epic\'s row in the same transaction, one commit over both manifests', () => {
    engineOk(['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'next']);
    const res = runOk(dir, ['remove', 'ordering']);
    assert.deepStrictEqual(res.epic_row_cancelled, { work_unit: 'mvp', topic: 'ordering' });
    const m = epic();
    assert.strictEqual(m.phases.discovery.items.ordering.postponed, undefined);
    assert.strictEqual(m.phases.discovery.items.ordering.cancelled, true);
    assert.strictEqual(m.phases.discovery.items.ordering.previous_order, 1, 'the stashed order survives for the reactivate');
    assert.strictEqual(m.phases.research.items.ordering.status, 'cancelled');
    assert.strictEqual(m.phases.research.items.ordering.previous_status, 'completed');
    assert.strictEqual(readProject(dir).roadmap.items.ordering, undefined);
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'roadmap: remove ordering — ordering cancelled in mvp');
    const staged = git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(staged.includes('.workflows/manifest.json') && staged.includes('.workflows/mvp/manifest.json'), 'both manifests ride one commit');
    // And the reactivate is then the way back, as for any cancelled unit.
    assert.deepStrictEqual(ok(dir, ['topic', 'reactivate', 'mvp', 'discovery', 'ordering']).restored,
      [{ phase: 'research', status: 'completed' }, { phase: 'discussion', status: 'in-progress' }]);
  });

  it('roadmap remove over a topic that holds no postpone refuses — the join is stale, not a cancel to make', () => {
    engineOk(['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'next']);
    // The epic's row came back by some other hand; the item still names it.
    const m = epic();
    delete m.phases.discovery.items.ordering.postponed;
    m.phases.research.items.ordering.status = 'completed';
    m.phases.discussion.items.ordering.status = 'in-progress';
    fs.writeFileSync(path.join(dir, '.workflows', 'mvp', 'manifest.json'), JSON.stringify(m, null, 2));
    const before = epicText();
    assert.match(runFail(dir, ['remove', 'ordering']).error,
      /"ordering" was postponed from "ordering" in work unit "mvp", where nothing is postponed — the join is stale/);
    assert.strictEqual(epicText(), before, 'the epic is untouched');
    assert.ok(readProject(dir).roadmap.items.ordering, 'and the item stands');
  });

  it('roadmap remove of an item whose epic is gone refuses rather than orphaning the row', () => {
    engineOk(['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'next']);
    fs.rmSync(path.join(dir, '.workflows', 'mvp'), { recursive: true, force: true });
    runFail(dir, ['remove', 'ordering']);
    assert.match(runFail(dir, ['remove', 'ordering']).error,
      /"ordering" was postponed from work unit "mvp", which no longer exists — the join is orphaned/);
  });

  it('pull-forward back into the same epic restores the unit, re-indexes its completed artifacts, and drops postponed_from', () => {
    const stub = stubbedEngine();
    stub.ok(dir, ['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'next']);
    assert.ok(knowledgeCalls(dir).includes('remove --work-unit mvp --phase research --topic ordering'), 'the postpone removes the chunks');
    const res = stub.ok(dir, ['roadmap', 'pull-forward', 'ordering', '--into', 'mvp']);
    assert.strictEqual(res.op, 'pull-forward');
    assert.strictEqual(res.state, 'in-flight');
    assert.deepStrictEqual(res.restored, [{ phase: 'research', status: 'completed' }, { phase: 'discussion', status: 'in-progress' }]);
    assert.ok(knowledgeCalls(dir).includes('index .workflows/mvp/research/ordering.md'), 'the return re-indexes the completed artifact');
    const m = epic();
    assert.strictEqual(m.phases.discovery.items.ordering.postponed, undefined, 'the marker is gone');
    assert.strictEqual(m.phases.discovery.items.ordering.order, 1, 'the map order returns');
    assert.strictEqual(m.phases.research.items.ordering.status, 'completed');
    assert.strictEqual('previous_status' in m.phases.research.items.ordering, false);
    const item = readProject(dir).roadmap.items.ordering;
    assert.deepStrictEqual(item.pulled_to, { work_unit: 'mvp', topic: 'ordering' });
    assert.strictEqual('postponed_from' in item, false, 'the item is in flight again — a later postpone re-sets it');
    const staged = git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(staged.includes('.workflows/manifest.json') && staged.includes('.workflows/mvp/manifest.json'));
  });

  it('pull-forward into another epic creates as usual and carries prior onto the new row', () => {
    engineOk(['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'next']);
    createManifest(dir, 'v2', { work_type: 'epic', status: 'in-progress', phases: { discovery: { items: {} } } });
    const res = runOk(dir, ['pull-forward', 'ordering', '--into', 'v2', '--routing', 'discussion']);
    assert.deepStrictEqual(res.prior, { work_unit: 'mvp', topic: 'ordering' });
    const row = JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'v2', 'manifest.json'), 'utf8')).phases.discovery.items.ordering;
    assert.deepStrictEqual(row, { routing: 'discussion', source: 'roadmap', summary: 'Customers order', prior: { work_unit: 'mvp', topic: 'ordering' } });
    assert.strictEqual(epic().phases.discovery.items.ordering.postponed, true, 'the prior epic keeps its record and its marker');
    assert.deepStrictEqual(readProject(dir).roadmap.items.ordering.postponed_from, { work_unit: 'mvp', topic: 'ordering' });
  });

  it('bind carries prior when the pull landed elsewhere, and never when it came home', () => {
    engineOk(['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'next']);
    createManifest(dir, 'v2', {
      work_type: 'epic',
      status: 'in-progress',
      phases: { discovery: { items: { checkout: { routing: 'discussion', source: 'discovery', summary: 's' } } } },
    });
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'v2']);
    runOk(dir, ['pull', 'ordering', '--into', 'v2']);
    const res = runOk(dir, ['bind', 'ordering', '--topic', 'checkout']);
    assert.deepStrictEqual(res.prior, { work_unit: 'mvp', topic: 'ordering' });
    assert.deepStrictEqual(
      JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'v2', 'manifest.json'), 'utf8')).phases.discovery.items.checkout.prior,
      { work_unit: 'mvp', topic: 'ordering' });
    const staged = git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(staged.includes('.workflows/v2/manifest.json'), 'the map write rides the bind commit');
  });

  it('a bind back into the epic that postponed the topic writes no prior', () => {
    engineOk(['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'next']);
    runOk(dir, ['pull', 'ordering', '--into', 'mvp']);
    const res = runOk(dir, ['bind', 'ordering', '--topic', 'menus']);
    assert.strictEqual('prior' in res, false);
    assert.strictEqual('prior' in epic().phases.discovery.items.menus, false);
  });

  it('roadmap move re-buckets a postponed item freely — it is waiting', () => {
    engineOk(['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'next']);
    const res = runOk(dir, ['move', 'ordering', '--horizon', 'later']);
    assert.strictEqual(res.state, 'waiting');
    assert.strictEqual(readProject(dir).roadmap.items.ordering.horizon, 'later');
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

  const engineOk = (/** @type {string[]} */ args) => ok(dir, args);

  it('topic cancel reverts the bound item to waiting, staging the project manifest', () => {
    const res = engineOk(['topic', 'cancel', 'mvp', 'discovery', 'ordering']);
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

  it('a never-started topic\'s cancel reverts the join too — the marker alone reads cancelled', () => {
    const p = path.join(dir, '.workflows', 'mvp', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(p, 'utf8'));
    delete manifest.phases.discussion;
    fs.writeFileSync(p, JSON.stringify(manifest, null, 2));
    const res = engineOk(['topic', 'cancel', 'mvp', 'discovery', 'ordering']);
    assert.deepStrictEqual(res.cancelled, []);
    assert.deepStrictEqual(res.roadmap_reverted, ['ordering']);
    assert.strictEqual('pulled_to' in readProject(dir).roadmap.items.ordering, false);
    // Reactivation never re-joins — the revert is one-way.
    engineOk(['topic', 'reactivate', 'mvp', 'discovery', 'ordering']);
    assert.strictEqual('pulled_to' in readProject(dir).roadmap.items.ordering, false);
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

  it('open installs the draft as session-001, resolves {NNN}, sets the marker, JIT-births the node — no commit', () => {
    const head = git(dir, ['rev-parse', 'HEAD']).trim();
    const res = runOk(dir, ['session', 'open', '--session-log-file', draft('draft.md', '# Roadmap Session {NNN}\n')]);
    assert.strictEqual(res.session, '001');
    assert.strictEqual(
      fs.readFileSync(path.join(dir, '.workflows', '.roadmap', 'sessions', 'session-001.md'), 'utf8'),
      '# Roadmap Session 001\n',
      'the template-literal {NNN} resolves to the allocated number at install');
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

  it('import lands files with the shared discipline: normalise, dedupe, stamp the origin, one commit', () => {
    fs.writeFileSync(path.join(dir, 'My App Idea.md'), '# The idea\n');
    fs.writeFileSync(path.join(dir, 'my-app-idea.md'), '# A colliding name\n');
    const res = runOk(dir, ['import', 'My App Idea.md', 'my-app-idea.md']);
    assert.deepStrictEqual(res.imports, [
      { path: 'imports/my-app-idea.md', origin: 'roadmap' },
      { path: 'imports/my-app-idea-2.md', origin: 'roadmap' },
    ]);
    assert.ok(fs.existsSync(path.join(dir, '.workflows', '.roadmap', 'imports', 'my-app-idea.md')));
    assert.ok(fs.existsSync(path.join(dir, '.workflows', '.roadmap', 'imports', 'my-app-idea-2.md')));
    const entries = readProject(dir).roadmap.imports;
    assert.strictEqual(entries.length, 2);
    assert.strictEqual(entries[0].path, 'imports/my-app-idea.md');
    assert.ok(entries[0].imported_at, 'entries carry a timestamp');
    assert.deepStrictEqual(entries.map((e) => e.origin), ['roadmap', 'roadmap'],
      'the product altitude is its own origin');
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'roadmap: import 2 files');
    const state = runOk(dir, ['state']);
    assert.deepStrictEqual(state.imports, [
      { path: 'imports/my-app-idea.md', origin: 'roadmap' },
      { path: 'imports/my-app-idea-2.md', origin: 'roadmap' },
    ]);
  });

  it('a binary lands tracked and unindexed, its extension kept and lowercased', () => {
    fs.writeFileSync(path.join(dir, 'Board Sketch.PNG'), 'png bytes\n');
    fs.writeFileSync(path.join(dir, 'notes.md'), '# notes\n');
    const res = runOk(dir, ['import', 'Board Sketch.PNG', 'notes.md']);
    assert.deepStrictEqual(res.imports, [
      { path: 'imports/board-sketch.png', origin: 'roadmap' },
      { path: 'imports/notes.md', origin: 'roadmap' },
    ]);
    assert.ok(fs.existsSync(path.join(dir, '.workflows', '.roadmap', 'imports', 'board-sketch.png')));
    const mode = fs.statSync(path.join(dir, '.workflows', '.roadmap', 'imports', 'board-sketch.png')).mode & 0o777;
    assert.strictEqual(mode, 0o644, `landed mode ${mode.toString(8)}`);
    // No index was spawned for the binary: the real bundle refuses a `.png`
    // by name, and the refusal would come back as a warning.
    assert.strictEqual('warnings' in res, false, JSON.stringify(res));
  });

  it('import fails whole with missing_imports so the flow can re-prompt', () => {
    fs.writeFileSync(path.join(dir, 'real.md'), '# real\n');
    const res = runFail(dir, ['import', 'real.md', 'ghost.md']);
    assert.deepStrictEqual(res.missing_imports, ['ghost.md']);
    assert.strictEqual(fs.existsSync(path.join(dir, '.workflows', '.roadmap', 'imports')), false, 'nothing landed');
  });

  it('a directory among the paths refuses before any copy — no half-landed batch', () => {
    fs.writeFileSync(path.join(dir, 'real.md'), '# real\n');
    fs.mkdirSync(path.join(dir, 'album'), { recursive: true });
    const res = runFail(dir, ['import', 'real.md', 'album']);
    assert.match(res.error, /import path\(s\) not found, not a file, or unreadable: album/);
    assert.deepStrictEqual(res.missing_imports, ['album']);
    assert.strictEqual(fs.existsSync(path.join(dir, '.workflows', '.roadmap', 'imports')), false, 'nothing landed');
  });

  it('commit --roadmap sweeps the roadmap dir + project manifest, nothing else', () => {
    runOk(dir, ['session', 'open', '--session-log-file', draft('draft.md', '# Session\n')]);
    fs.appendFileSync(path.join(dir, '.workflows', '.roadmap', 'sessions', 'session-001.md'), '\nMore exploration.\n');
    fs.writeFileSync(path.join(dir, 'unrelated.txt'), 'outside the scope\n');
    const res = ok(dir, ['commit', '--roadmap', '-m', 'roadmap: exploration notes — session-001']);
    assert.ok(res.committed);
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'roadmap: exploration notes — session-001');
    assert.match(git(dir, ['status', '--porcelain']), /\?\? unrelated\.txt/);
    const clean = ok(dir, ['commit', '--roadmap', '-m', 'nothing']);
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

  it('reads corrupt shapes honestly: scalar node, array items, non-object item, stray horizon, malformed join', () => {
    const write = (m) => fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'), JSON.stringify(m, null, 2));

    write({ roadmap: 'scalar' });
    assert.strictEqual(runOk(dir, ['state']).exists, false, 'a scalar node reads as never-born');
    write({ roadmap: { horizons: ['v1'], items: [] } });
    assert.deepStrictEqual(runOk(dir, ['state']).items, [], 'array items read as none');

    write({
      roadmap: {
        horizons: ['v1'],
        items: {
          good: { horizon: 'v1', summary: 's', origin: 'harvest' },
          bad: 'scalar',
          stray: { horizon: 'never-listed', summary: 's', origin: 'harvest' },
          crooked: { horizon: 'v1', summary: 's', origin: 'harvest', pulled_to: 'not-an-object' },
        },
      },
    });
    const res = runOk(dir, ['state']);
    assert.deepStrictEqual(res.items.map((i) => i.name), ['good', 'crooked', 'stray'], 'non-object skipped; stray horizon trails last');
    assert.strictEqual(res.items.find((i) => i.name === 'crooked').state, 'waiting', 'a malformed join reads as no join');
  });

  it('refuses mutations loudly over a malformed horizons node — add, session open, and import alike', () => {
    fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'), JSON.stringify({ roadmap: { horizons: { not: 'a list' }, items: {} } }, null, 2));
    assert.match(runFail(dir, ['add', 'x', '--horizon', 'v1', '--summary', 's']).error, /horizons is malformed/);
    fs.writeFileSync(path.join(dir, 'draft.md'), '# Session\n');
    assert.match(runFail(dir, ['session', 'open', '--session-log-file', 'draft.md']).error, /horizons is malformed/);
    assert.strictEqual(fs.existsSync(path.join(dir, 'draft.md')), true, 'the refused open leaves the draft in place');
    fs.writeFileSync(path.join(dir, 'ref.md'), '# ref\n');
    assert.match(runFail(dir, ['import', 'ref.md']).error, /horizons is malformed/);
    assert.strictEqual(fs.existsSync(path.join(dir, '.workflows', '.roadmap', 'imports')), false, 'the refused import copies nothing');
  });
});

describe('engine CLI: roadmap guards the first pass left unexercised', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    runOk(dir, ['add', 'ordering', '--horizon', 'mvp', '--summary', 'customers order']);
    runOk(dir, ['add', 'menus', '--horizon', 'mvp', '--summary', 'operators maintain']);
    runOk(dir, ['add', 'loyalty', '--horizon', 'v1', '--summary', 'rewards']);
    createManifest(dir, 'mvp', { work_type: 'epic', status: 'in-progress', phases: { discovery: { items: {} } } });
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'fixture']);
  });
  afterEach(() => { cleanup(dir); });

  function epicManifest() {
    return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', 'mvp', 'manifest.json'), 'utf8'));
  }
  function writeEpic(m) {
    fs.writeFileSync(path.join(dir, '.workflows', 'mvp', 'manifest.json'), JSON.stringify(m, null, 2));
  }

  it('re-binding re-aims the join at the new topic, the unit carried', () => {
    runOk(dir, ['pull', 'ordering', '--into', 'mvp']);
    const m = epicManifest();
    m.phases.discovery.items.ordering = { routing: 'discussion', source: 'roadmap', summary: 's' };
    m.phases.discovery.items['guest-ordering'] = { routing: 'discussion', source: 'roadmap', summary: 's' };
    writeEpic(m);
    runOk(dir, ['bind', 'ordering', '--topic', 'ordering']);
    const res = runOk(dir, ['bind', 'ordering', '--topic', 'guest-ordering']);
    assert.strictEqual(res.topic, 'guest-ordering');
    assert.deepStrictEqual(readProject(dir).roadmap.items.ordering.pulled_to, { work_unit: 'mvp', topic: 'guest-ordering' });
  });

  it('a cross-horizon pull names the remainder per touched horizon', () => {
    const res = runOk(dir, ['pull', 'ordering', 'loyalty', '--into', 'mvp']);
    assert.deepStrictEqual(res.remainder, { mvp: 1, v1: 0 });
  });

  it('add and add-batch refuse an illegal horizon name before anything is written', () => {
    const before = projectManifestText(dir);
    assert.match(runFail(dir, ['add', 'x', '--horizon', 'v1.5', '--summary', 's']).error, /not a legal horizon name/);
    const batch = path.join(dir, 'batch.json');
    fs.writeFileSync(batch, JSON.stringify([{ name: 'x', horizon: 'v1.5', summary: 's' }]));
    assert.match(runFail(dir, ['add-batch', '--file', 'batch.json']).error, /entry 1 — "v1\.5" is not a legal horizon name/);
    assert.strictEqual(projectManifestText(dir), before);
  });

  it('horizon split honours an explicit --position; merge refuses a missing target', () => {
    runOk(dir, ['add', 'kds', '--horizon', 'mvp', '--summary', 's']);
    const res = runOk(dir, ['horizon', 'split', 'mvp', '--new', 'mvp-2', '--items', 'kds', '--position', '1']);
    assert.deepStrictEqual(res.horizons, ['mvp-2', 'mvp', 'v1']);
    assert.match(runFail(dir, ['horizon', 'merge', 'v1', '--into', 'never-made']).error, /no horizon "never-made"/);
  });

  it('bind on an orphaned join names the orphan', () => {
    joinItem(dir, 'ordering', 'never-created');
    assert.match(runFail(dir, ['bind', 'ordering', '--topic', 'x']).error, /no longer exists — the join is orphaned/);
  });

  it('flag lands on research and discussion together when both are live', () => {
    const m = epicManifest();
    m.phases.discovery.items.ordering = { routing: 'discussion', source: 'roadmap', summary: 's' };
    m.phases.research = { items: { ordering: { status: 'in-progress' } } };
    m.phases.discussion = { items: { ordering: { status: 'in-progress' } } };
    writeEpic(m);
    runOk(dir, ['pull', 'ordering', '--into', 'mvp']);
    runOk(dir, ['bind', 'ordering', '--topic', 'ordering']);
    const res = runOk(dir, ['flag', 'ordering']);
    assert.deepStrictEqual(res.flagged, [
      { phase: 'research', topic: 'ordering' },
      { phase: 'discussion', topic: 'ordering' },
    ]);
  });
});

describe('engine CLI: the un-pull and the re-aim — remove and absorb move joins, never orphan them', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    runOk(dir, ['add', 'loyalty', '--horizon', 'v1', '--summary', 'rewards']);
    createManifest(dir, 'mvp', { work_type: 'epic', status: 'in-progress', phases: { discovery: { items: {} } } });
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'fixture']);
  });
  afterEach(() => { cleanup(dir); });

  const engineOk = (/** @type {string[]} */ args) => ok(dir, args);

  it('discovery-map remove of a fresh joined topic reverts the join, staged in its own commit', () => {
    runOk(dir, ['pull-forward', 'loyalty', '--into', 'mvp', '--routing', 'discussion']);
    const res = engineOk(['discovery-map', 'remove', 'mvp', 'loyalty']);
    assert.deepStrictEqual(res.roadmap_reverted, ['loyalty']);
    const item = readProject(dir).roadmap.items.loyalty;
    assert.strictEqual('pulled_to' in item, false);
    assert.strictEqual(item.origin, 'harvest', 'origin survives the un-pull');
    assert.strictEqual(git(dir, ['log', '-1', '--pretty=%s']).trim(), 'roadmap: un-pull loyalty (loyalty removed from mvp)');
    const staged = git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.deepStrictEqual(staged, ['.workflows/manifest.json'], 'the un-pull commit carries the project manifest alone');
  });

  it('discovery-map remove of an unjoined fresh topic reverts nothing', () => {
    engineOk(['discovery-map', 'add', 'mvp', 'plain-topic', 'discussion', '--summary', 's']);
    const res = engineOk(['discovery-map', 'remove', 'mvp', 'plain-topic']);
    assert.strictEqual('roadmap_reverted' in res, false);
  });

  it('workunit absorb re-aims the feature-held join at the epic topic', () => {
    createManifest(dir, 'loyalty-feat', {
      work_type: 'feature',
      status: 'in-progress',
      phases: { discussion: { items: { 'loyalty-feat': { status: 'completed' } } } },
    });
    fs.mkdirSync(path.join(dir, '.workflows', 'loyalty-feat', 'discussion'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.workflows', 'loyalty-feat', 'discussion', 'loyalty-feat.md'), '# Discussion\n');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'feature fixture']);
    runOk(dir, ['pull', 'loyalty', '--into', 'loyalty-feat']);

    const res = engineOk(['workunit', 'absorb', 'loyalty-feat', '--into', 'mvp', '--topic', 'loyalty']);
    assert.deepStrictEqual(res.roadmap_reaimed, ['loyalty']);
    assert.deepStrictEqual(readProject(dir).roadmap.items.loyalty.pulled_to, { work_unit: 'mvp', topic: 'loyalty' });
    const state = runOk(dir, ['state']);
    assert.strictEqual(state.items.find((i) => i.name === 'loyalty').state, 'in-flight');
    assert.strictEqual(state.items.find((i) => i.name === 'loyalty').work_unit, 'mvp');
  });
});

describe('engine CLI: import edge discipline and the store-dirt ride', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture(); });
  afterEach(() => { cleanup(dir); });

  it('skips dotfile-normalising sources and reports them; an all-skipped call refuses', () => {
    fs.writeFileSync(path.join(dir, 'real.md'), '# real\n');
    fs.writeFileSync(path.join(dir, '.hidden'), 'x');
    const res = runOk(dir, ['import', 'real.md', '.hidden']);
    assert.deepStrictEqual(res.imports, [{ path: 'imports/real.md', origin: 'roadmap' }]);
    assert.deepStrictEqual(res.skipped_imports, ['.hidden']);

    const fail = runFail(dir, ['import', '.hidden']);
    assert.match(fail.error, /nothing to land/);
    assert.strictEqual(readProject(dir).roadmap.imports.length, 1, 'the refused call recorded nothing');
  });

  it('a malformed imports node refuses before any file is copied', () => {
    fs.writeFileSync(path.join(dir, '.workflows', 'manifest.json'), JSON.stringify({ roadmap: { horizons: [], items: {}, imports: 'corrupt' } }, null, 2));
    fs.writeFileSync(path.join(dir, 'ref.md'), '# ref\n');
    assert.match(runFail(dir, ['import', 'ref.md']).error, /imports is malformed/);
    assert.strictEqual(fs.existsSync(path.join(dir, '.workflows', '.roadmap', 'imports')), false, 'no orphan copy landed');
  });

  it('close and import stage the knowledge dir when a store exists', () => {
    fs.mkdirSync(path.join(dir, '.workflows', '.knowledge'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.workflows', '.knowledge', 'store.msp'), 'store\n');
    fs.writeFileSync(path.join(dir, 'draft.md'), '# Session\n');
    runOk(dir, ['session', 'open', '--session-log-file', 'draft.md']);
    runOk(dir, ['session', 'close', '-m', 'roadmap: session 001']);
    const staged = git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(staged.includes('.workflows/.knowledge/store.msp'), 'the close stages the store dirt its indexing produced');

    fs.writeFileSync(path.join(dir, '.workflows', '.knowledge', 'store.msp'), 'store v2\n');
    fs.writeFileSync(path.join(dir, 'ref.md'), '# ref\n');
    runOk(dir, ['import', 'ref.md']);
    const staged2 = git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(staged2.includes('.workflows/.knowledge/store.msp'), 'the import stages the store dirt too');
  });
});
