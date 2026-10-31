'use strict';

// The roadmap domain — project-level horizons + items, lifecycle by join
// (skills/leeway-engine/scripts/domain/roadmap.cjs) — driven through the
// engine CLI: JIT birth, self-commits scoped to the project manifest, the
// joined-item guards, horizon restructuring, and the derived state read. The
// inbox's notes onto the roadmap and back are test-engine-roadmap-inbox.cjs's;
// the postpone, and a cancel's revert of a join, are
// test-engine-roadmap-topic-verbs.cjs's.
//
// Layer: verb. World: the roadmap's (roadmap-world.cjs).

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { createManifest } = require('./discovery-test-utils.cjs');
const { git, stateGit, commitAll, cleanupFixture: cleanup, ok } = require('./engine-harness.cjs');
const { roadmapWorld, runOk, runFail, readProject, projectManifestText, writeSource } = require('./roadmap-world.cjs');

/** A temp-dir git repo with an empty project manifest committed. */
const setupGitFixture = roadmapWorld();

/** Write a joined item directly — corrupt-shape and orphan fixtures the verbs refuse to create. */
function joinItem(dir, name, workUnit, topic) {
  const manifest = readProject(dir);
  manifest.roadmap.items[name].pulled_to = topic ? { work_unit: workUnit, topic } : { work_unit: workUnit };
  fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify(manifest, null, 2));
}

describe('engine CLI: roadmap add / add-batch', () => {
  let dir;
  beforeEach(() => { dir = setupGitFixture(); });
  afterEach(() => { cleanup(dir); });

  it('JIT-births the node and the horizon, writes the item, self-commits scoped', () => {
    fs.writeFileSync(path.join(dir, 'unrelated.txt'), 'outside the scope\n');
    writeSource(dir, '.product/sessions/session-001.md');
    const res = runOk(dir, ['add', 'loyalty', '--horizon', 'v1', '--summary', 'repeat-customer rewards', '--origin', 'park:mvp', '--source', '.product/sessions/session-001.md']);
    assert.strictEqual(res.op, 'add');
    assert.strictEqual(res.state, 'waiting');
    assert.strictEqual(res.horizon_created, true);
    assert.deepStrictEqual(res.horizons, ['v1']);
    assert.strictEqual(res.item_total, 1);
    assert.strictEqual(res.committed, stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim());
    assert.strictEqual(stateGit(dir, ['log', '-1', '--pretty=%s']).trim(), 'roadmap: add loyalty (v1)');
    // Scoped: the unrelated file stays uncommitted.
    assert.match(git(dir, ['status', '--porcelain']), /\?\? unrelated\.txt/);

    const item = readProject(dir).roadmap.items.loyalty;
    assert.deepStrictEqual(item, {
      horizon: 'v1',
      summary: 'repeat-customer rewards',
      kind: 'idea',
      origin: 'park:mvp',
      sources: ['.product/sessions/session-001.md'],
    });
  });

  it('defaults kind to idea and origin to harvest, and omits sources when none given', () => {
    const res = runOk(dir, ['add', 'loyalty', '--horizon', 'v1', '--summary', 's']);
    assert.strictEqual(res.kind, 'idea');
    const item = readProject(dir).roadmap.items.loyalty;
    assert.strictEqual(item.kind, 'idea');
    assert.strictEqual(item.origin, 'harvest');
    assert.strictEqual('sources' in item, false);
    assert.strictEqual('pulled_to' in item, false);
    assert.strictEqual('status' in item, false);
  });

  it('--kind records a bug or a quick-fix, and refuses any other kind with nothing written', () => {
    assert.strictEqual(runOk(dir, ['add', 'login-crash', '--horizon', 'v1', '--summary', 's', '--kind', 'bug']).kind, 'bug');
    runOk(dir, ['add', 'typo', '--horizon', 'v1', '--summary', 's', '--kind', 'quick-fix']);
    const before = projectManifestText(dir);
    assert.strictEqual(runFail(dir, ['add', 'x', '--horizon', 'v1', '--summary', 's', '--kind', 'feature']).error,
      'unknown kind "feature" — one of: idea, bug, quick-fix');
    assert.strictEqual(projectManifestText(dir), before);
    const items = readProject(dir).roadmap.items;
    assert.strictEqual(items['login-crash'].kind, 'bug');
    assert.strictEqual(items.typo.kind, 'quick-fix');
    assert.deepStrictEqual(runOk(dir, ['state']).items.map((i) => [i.name, i.kind]), [['login-crash', 'bug'], ['typo', 'quick-fix']]);
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
    const head = stateGit(dir, ['rev-parse', 'HEAD']).trim();

    assert.match(runFail(dir, ['add', 'loyalty', '--horizon', 'v1', '--summary', 's']).error, /already on the roadmap/);
    assert.match(runFail(dir, ['add', 'bad.name', '--horizon', 'v1', '--summary', 's']).error, /not a legal item name/);
    assert.match(runFail(dir, ['add', 'bad/name', '--horizon', 'v1', '--summary', 's']).error, /not a legal item name/);
    assert.match(runFail(dir, ['add', 'x', '--horizon', 'v1', '--summary', '  ']).error, /non-empty one-liner/);
    assert.match(runFail(dir, ['add', 'x', '--summary', 's']).error, /--horizon is required/);
    assert.match(runFail(dir, ['add', 'x', '--horizon', 'v1', '--summary', 's', '--origin', 'gremlin']).error, /unknown origin/);
    assert.match(runFail(dir, ['add', 'x', '--horizon', 'v1', '--summary', 's', '--origin', 'park:']).error, /unknown origin/);
    assert.match(runFail(dir, ['add', 'x', '--horizon', 'v1', '--summary', 's', '--source', '/abs/path.md']).error, /never absolute/);
    assert.match(runFail(dir, ['add', 'x', '--horizon', 'v1', '--summary', 's', '--source', '../escape.md']).error, /never absolute or traversing/);
    assert.match(runFail(dir, ['add', 'x', '--horizon', 'v1', '--summary', 's', '--source', '.leeway/.product/sessions/session-001.md']).error,
      /relative to the state, so drop the leading "\.leeway\/" \("\.product\/sessions\/session-001\.md"\)/);
    assert.match(runFail(dir, ['add', 'x', '--horizon', 'bad.h', '--summary', 's']).error, /not a legal horizon name/);

    assert.strictEqual(projectManifestText(dir), before);
    assert.strictEqual(stateGit(dir, ['rev-parse', 'HEAD']).trim(), head);
  });

  it('refuses a source not on disk, naming each missing path — the log opens before the op, nothing written', () => {
    const before = projectManifestText(dir);
    const head = stateGit(dir, ['rev-parse', 'HEAD']).trim();

    assert.strictEqual(runFail(dir, ['add', 'loyalty', '--horizon', 'v1', '--summary', 's', '--source', '.product/sessions/session-002.md']).error,
      `source ".product/sessions/session-002.md" does not exist under ${dir}/.leeway/ — a source must exist before an item records it; `
      + 'open a session log\'s session first (discovery-session open product, or the session\'s own open)');

    writeSource(dir, '.product/sessions/session-001.md');
    const several = runFail(dir, ['add', 'loyalty', '--horizon', 'v1', '--summary', 's',
      '--source', 'mvp/discussion/ordering.md', '--source', '.product/sessions/session-001.md', '--source', '.product/sessions/session-002.md']).error;
    assert.ok(several.startsWith(`sources "mvp/discussion/ordering.md", ".product/sessions/session-002.md" do not exist under ${dir}/.leeway/ — `), several);
    assert.ok(!several.includes('session-001'), 'a source on disk is never named');

    assert.strictEqual(projectManifestText(dir), before);
    assert.strictEqual(stateGit(dir, ['rev-parse', 'HEAD']).trim(), head);

    runOk(dir, ['add', 'loyalty', '--horizon', 'v1', '--summary', 's', '--source', '.product/sessions/session-001.md']);
    assert.deepStrictEqual(readProject(dir).roadmap.items.loyalty.sources, ['.product/sessions/session-001.md']);
  });

  it('takes a folder on disk as a source — a discussion parks a question with its topic\'s folder (9.5.4)', () => {
    writeSource(dir, 'mvp/topics/ordering/log.md');
    runOk(dir, ['add', 'seat-transfer', '--horizon', 'v1', '--summary', 's', '--origin', 'park:mvp', '--source', 'mvp/topics/ordering']);
    assert.deepStrictEqual(readProject(dir).roadmap.items['seat-transfer'].sources, ['mvp/topics/ordering']);
  });

  it('accepts park:, inbox: and postpone: origins with non-empty tails', () => {
    runOk(dir, ['add', 'a', '--horizon', 'v1', '--summary', 's', '--origin', 'park:mvp']);
    runOk(dir, ['add', 'b', '--horizon', 'v1', '--summary', 's', '--origin', 'inbox:2026-08-01--gift-cards']);
    runOk(dir, ['add', 'c', '--horizon', 'v1', '--summary', 's', '--origin', 'postpone:mvp']);
    assert.strictEqual(readProject(dir).roadmap.items.c.origin, 'postpone:mvp');
    assert.match(runFail(dir, ['add', 'd', '--horizon', 'v1', '--summary', 's', '--origin', 'postpone:']).error, /unknown origin/);
  });

  it('add-batch lands the whole set under one commit, JIT horizons in entry order', () => {
    writeSource(dir, '.product/sessions/session-001.md');
    const payload = [
      { name: 'ordering', horizon: 'mvp', summary: 'customers order from a menu' },
      { name: 'menus', horizon: 'mvp', summary: 'operators maintain the menu' },
      { name: 'loyalty', horizon: 'v1', summary: 'rewards', kind: 'bug', origin: 'harvest', sources: ['.product/sessions/session-001.md'] },
    ];
    fs.writeFileSync(path.join(dir, 'items.json'), JSON.stringify(payload));
    const res = runOk(dir, ['add-batch', '--file', 'items.json']);
    assert.strictEqual(res.op, 'add-batch');
    assert.deepStrictEqual(res.added.map((a) => a.kind), ['idea', 'idea', 'bug']);
    assert.strictEqual('notes_moved' in res, false);
    assert.deepStrictEqual(Object.values(readProject(dir).roadmap.items).map((i) => i.kind), ['idea', 'idea', 'bug']);
    assert.deepStrictEqual(res.horizons, ['mvp', 'v1']);
    assert.deepStrictEqual(res.horizons_created, ['mvp', 'v1']);
    assert.strictEqual(res.item_total, 3);
    // One commit for the batch on top of init.
    assert.deepStrictEqual(stateGit(dir, ['log', '-2', '--pretty=%s']).trim().split('\n'), ['roadmap: add 3 items', 'init']);
  });

  it('add-batch validates everything before applying anything', () => {
    runOk(dir, ['add', 'loyalty', '--horizon', 'v1', '--summary', 's']);
    const before = projectManifestText(dir);

    fs.writeFileSync(path.join(dir, 'dup.json'), JSON.stringify([
      { name: 'fresh', horizon: 'mvp', summary: 's' },
      { name: 'loyalty', horizon: 'v1', summary: 's' },
    ]));
    assert.strictEqual(runFail(dir, ['add-batch', '--file', 'dup.json']).error,
      'add-batch: "loyalty" is already on the roadmap — edit it, or pick a different name');

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

    fs.writeFileSync(path.join(dir, 'kind.json'), JSON.stringify([
      { name: 'ok', horizon: 'mvp', summary: 's' },
      { name: 'nope', horizon: 'mvp', summary: 's', kind: 'epic' },
    ]));
    assert.match(runFail(dir, ['add-batch', '--file', 'kind.json']).error, /entry 2 — unknown kind "epic"/);

    fs.writeFileSync(path.join(dir, 'prefixed.json'), JSON.stringify([
      { name: 'ok', horizon: 'mvp', summary: 's', sources: ['.product/sessions/session-001.md'] },
      { name: 'nope', horizon: 'mvp', summary: 's', sources: ['.leeway/.product/sessions/session-001.md'] },
    ]));
    assert.match(runFail(dir, ['add-batch', '--file', 'prefixed.json']).error, /entry 2 .*drop the leading "\.leeway\/"/);

    // One entry's source not yet on disk refuses the whole batch, the path named once.
    writeSource(dir, '.product/sessions/session-001.md');
    fs.writeFileSync(path.join(dir, 'unopened.json'), JSON.stringify([
      { name: 'ok', horizon: 'mvp', summary: 's', sources: ['.product/sessions/session-001.md'] },
      { name: 'early', horizon: 'mvp', summary: 's', sources: ['.product/sessions/session-002.md'] },
      { name: 'later', horizon: 'v1', summary: 's', sources: ['.product/sessions/session-002.md'] },
    ]));
    assert.strictEqual(runFail(dir, ['add-batch', '--file', 'unopened.json']).error,
      `add-batch: source ".product/sessions/session-002.md" does not exist under ${dir}/.leeway/ — a source must exist before an item records it; `
      + 'open a session log\'s session first (discovery-session open product, or the session\'s own open)');

    assert.strictEqual(projectManifestText(dir), before);
  });
});

describe('engine CLI: roadmap item ops and the joined-item guards', () => {
  const setup = roadmapWorld((at) => {
    runOk(at, ['add', 'ordering', '--horizon', 'mvp', '--summary', 'customers order']);
    runOk(at, ['add', 'loyalty', '--horizon', 'v1', '--summary', 'rewards']);
    createManifest(at, 'mvp', { work_type: 'epic', status: 'in-progress' });
    joinItem(at, 'ordering', 'mvp');
    commitAll(at, 'join');
  });
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { cleanup(dir); });

  it('edit rewrites the summary — on a pulled item too (cosmetic; the row is a window)', () => {
    const res = runOk(dir, ['edit', 'ordering', '--summary', 'guests order from a menu']);
    assert.strictEqual(res.op, 'edit');
    assert.strictEqual(res.state, 'in-flight');
    assert.strictEqual(readProject(dir).roadmap.items.ordering.summary, 'guests order from a menu');
    assert.strictEqual(stateGit(dir, ['log', '-1', '--pretty=%s']).trim(), 'roadmap: edit ordering');
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

  it('refuses re-bucketing and removing an item riding with an epic — no topic there — naming the whole work\'s cancel as its one way back', () => {
    const before = projectManifestText(dir);
    assert.strictEqual(runFail(dir, ['move', 'ordering', '--horizon', 'v1']).error,
      '"ordering" is joined to work unit "mvp" — re-bucketing a pulled item is a delivery decision; it rides with "mvp", and it goes back to waiting only if that work is cancelled');
    assert.strictEqual(runFail(dir, ['remove', 'ordering']).error,
      '"ordering" is joined to work unit "mvp" — removing a pulled item is a delivery decision; it rides with "mvp", and it goes back to waiting only if that work is cancelled');
    assert.strictEqual(projectManifestText(dir), before);

    ok(dir, ['workunit', 'cancel', 'mvp']);
    assert.strictEqual(runOk(dir, ['remove', 'ordering']).op, 'remove', 'back to waiting, it removes');
  });

  it('a join to an epic topic names the topic\'s cancel or postpone as its way back', () => {
    joinItem(dir, 'ordering', 'mvp', 'ordering');
    assert.strictEqual(runFail(dir, ['remove', 'ordering']).error,
      '"ordering" is joined to work unit "mvp" — removing a pulled item is a delivery decision; cancel or postpone its topic "ordering" in "mvp" and it goes back to waiting');
  });

  it('a join into a unit of another type is part of that work, back to waiting only if it is cancelled', () => {
    createManifest(dir, 'login-crash', { work_type: 'bugfix', status: 'in-progress' });
    joinItem(dir, 'loyalty', 'login-crash');
    assert.strictEqual(runFail(dir, ['move', 'loyalty', '--horizon', 'mvp']).error,
      '"loyalty" is joined to work unit "login-crash" — re-bucketing a pulled item is a delivery decision; it is part of "login-crash", and it goes back to waiting only if that work is cancelled');
  });

  it('a shipped item stays as its release\'s record, and an orphaned join says so — neither promises a way back', () => {
    createManifest(dir, 'mvp', { work_type: 'epic', status: 'completed' });
    assert.strictEqual(runFail(dir, ['remove', 'ordering']).error,
      '"ordering" shipped with work unit "mvp" — it stays on the roadmap as the record of what its release was');
    joinItem(dir, 'loyalty', 'ghost');
    assert.strictEqual(runFail(dir, ['move', 'loyalty', '--horizon', 'mvp']).error,
      '"loyalty" is joined to work unit "ghost", which is missing or cancelled — the join is orphaned');
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
  const setup = roadmapWorld((at) => {
    runOk(at, ['add', 'ordering', '--horizon', 'mvp', '--summary', 's']);
    runOk(at, ['add', 'menus', '--horizon', 'mvp', '--summary', 's']);
    runOk(at, ['add', 'loyalty', '--horizon', 'v1', '--summary', 's']);
  });
  let dir;
  beforeEach(() => { dir = setup(); });
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
  const setup = roadmapWorld((at) => {
    runOk(at, ['add', 'ordering', '--horizon', 'mvp', '--summary', 'customers order']);
    runOk(at, ['add', 'menus', '--horizon', 'mvp', '--summary', 'operators maintain']);
    runOk(at, ['add', 'kds', '--horizon', 'mvp', '--summary', 'orders reach the kitchen']);
    runOk(at, ['add', 'loyalty', '--horizon', 'v1', '--summary', 'rewards']);
    createManifest(at, 'mvp', { work_type: 'epic', status: 'in-progress', phases: { discovery: { items: {} } } });
    commitAll(at, 'fixture');
  });
  let dir;
  beforeEach(() => { dir = setup(); });
  afterEach(() => { cleanup(dir); });

  it('pull joins a subset and names the remainder per touched horizon', () => {
    const res = runOk(dir, ['pull', 'ordering', 'menus', '--into', 'mvp']);
    assert.deepStrictEqual(res.pulled, ['ordering', 'menus']);
    assert.deepStrictEqual(res.remainder, { mvp: 1 });
    assert.strictEqual(stateGit(dir, ['log', '-1', '--pretty=%s']).trim(), 'roadmap: pull 2 items into mvp');
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
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.leeway', 'mvp', 'manifest.json'), 'utf8'));
    manifest.phases.discovery.items['guest-ordering'] = { routing: 'discussion', source: 'roadmap', summary: 's' };
    fs.writeFileSync(path.join(dir, '.leeway', 'mvp', 'manifest.json'), JSON.stringify(manifest, null, 2));
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
    const epicItem = JSON.parse(fs.readFileSync(path.join(dir, '.leeway', 'mvp', 'manifest.json'), 'utf8'))
      .phases.discovery.items.loyalty;
    assert.deepStrictEqual(epicItem, { routing: 'discussion', source: 'roadmap', summary: 'rewards' });
    assert.deepStrictEqual(readProject(dir).roadmap.items.loyalty.pulled_to, { work_unit: 'mvp', topic: 'loyalty' });
    // One commit, both manifests staged.
    assert.strictEqual(stateGit(dir, ['log', '-1', '--pretty=%s']).trim(), 'roadmap: pull-forward loyalty into mvp');
    const staged = stateGit(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(staged.includes('manifest.json'), 'project manifest staged');
    assert.ok(staged.includes('mvp/manifest.json'), 'epic manifest staged');
  });

  it('pull-forward requires --routing on the creating branch — only the return names nothing', () => {
    assert.match(runFail(dir, ['pull-forward', 'loyalty', '--into', 'mvp']).error, /--routing is required/);
    assert.strictEqual(
      JSON.parse(fs.readFileSync(path.join(dir, '.leeway', 'mvp', 'manifest.json'), 'utf8')).phases.discovery.items.loyalty,
      undefined, 'nothing lands on the map');
  });

  it('pull-forward refuses a non-epic, a joined item, and an occupied topic name', () => {
    createManifest(dir, 'small', { work_type: 'feature', status: 'in-progress' });
    assert.match(runFail(dir, ['pull-forward', 'loyalty', '--into', 'small', '--routing', 'discussion']).error, /is a feature/);
    runOk(dir, ['pull', 'ordering', '--into', 'mvp']);
    assert.match(runFail(dir, ['pull-forward', 'ordering', '--into', 'mvp', '--routing', 'discussion']).error, /already joined/);
    runOk(dir, ['pull-forward', 'loyalty', '--into', 'mvp', '--routing', 'discussion']);
    runOk(dir, ['move', 'kds', '--horizon', 'v1']);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.leeway', 'mvp', 'manifest.json'), 'utf8'));
    manifest.phases.discovery.items.kds = { routing: 'discussion', source: 'discovery', summary: 'already here' };
    fs.writeFileSync(path.join(dir, '.leeway', 'mvp', 'manifest.json'), JSON.stringify(manifest, null, 2));
    assert.match(runFail(dir, ['pull-forward', 'kds', '--into', 'mvp', '--routing', 'discussion']).error, /already on the map/);
  });

  it('pull-forward refuses a bug or a quick-fix, naming the pull as the way to start it — the epic\'s map never moves', () => {
    runOk(dir, ['add', 'login-crash', '--horizon', 'mvp', '--summary', 'sign-in crashes', '--kind', 'bug']);
    runOk(dir, ['add', 'typo', '--horizon', 'mvp', '--summary', 'the footer typo', '--kind', 'quick-fix']);
    const epicBefore = fs.readFileSync(path.join(dir, '.leeway', 'mvp', 'manifest.json'), 'utf8');
    assert.strictEqual(runFail(dir, ['pull-forward', 'login-crash', '--into', 'mvp', '--routing', 'discussion']).error,
      '"login-crash" is a bug — an epic grows by topics, and pull-forward takes ideas only; start it with the pull (roadmap pull), as work of its own');
    assert.match(runFail(dir, ['pull-forward', 'typo', '--into', 'mvp', '--routing', 'discussion']).error, /^"typo" is a quick-fix — /);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.leeway', 'mvp', 'manifest.json'), 'utf8'), epicBefore);
    assert.strictEqual('pulled_to' in readProject(dir).roadmap.items['login-crash'], false);
  });

  it('pull-forward honours the dismissed list, force passing the confirmed re-add through', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.leeway', 'mvp', 'manifest.json'), 'utf8'));
    manifest.phases.discovery.dismissed = ['loyalty'];
    fs.writeFileSync(path.join(dir, '.leeway', 'mvp', 'manifest.json'), JSON.stringify(manifest, null, 2));
    assert.match(runFail(dir, ['pull-forward', 'loyalty', '--into', 'mvp', '--routing', 'discussion']).error, /previously dismissed/);
    const res = runOk(dir, ['pull-forward', 'loyalty', '--into', 'mvp', '--routing', 'discussion', '--force-dismissed']);
    assert.strictEqual(res.state, 'in-flight');
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
    const write = (m) => fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify(m, null, 2));

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

  it('refuses a mutation loudly over a malformed horizons node', () => {
    fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify({ roadmap: { horizons: { not: 'a list' }, items: {} } }, null, 2));
    assert.match(runFail(dir, ['add', 'x', '--horizon', 'v1', '--summary', 's']).error, /horizons is malformed/);
  });

  it('reads the product\'s conversation\'s sessions: its marker on the project manifest, its logs and next number from .product/sessions — a log alone giving a roadmap that exists, holding nothing', () => {
    const logs = ['session-001.md', 'session-003.md'].map((name) => path.join(dir, '.leeway', '.product', 'sessions', name));
    for (const log of logs) writeSource(dir, path.relative(path.join(dir, '.leeway'), log));
    fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify({ product_session: '003' }, null, 2));
    const sessions = ({ exists, items, active_session, session_logs, next_session_number }) => ({ exists, items: items.map((i) => i.name), active_session, session_logs, next_session_number });
    const expected = { exists: true, active_session: '003', session_logs: [{ number: 1, path: logs[0] }, { number: 3, path: logs[1] }], next_session_number: 4 };
    assert.deepStrictEqual(sessions(runOk(dir, ['state'])), { ...expected, items: [] });
    runOk(dir, ['add', 'loyalty', '--horizon', 'v1', '--summary', 's']);
    assert.deepStrictEqual(sessions(runOk(dir, ['state'])), { ...expected, items: ['loyalty'] });
    for (const log of logs) fs.rmSync(log);
    fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify({}, null, 2));
    assert.strictEqual(runOk(dir, ['state']).exists, false, 'no log and no node is no roadmap');
  });
});

describe('engine CLI: roadmap guards the first pass left unexercised', () => {
  let dir;
  const setup = roadmapWorld((at) => {
    runOk(at, ['add', 'ordering', '--horizon', 'mvp', '--summary', 'customers order']);
    runOk(at, ['add', 'menus', '--horizon', 'mvp', '--summary', 'operators maintain']);
    runOk(at, ['add', 'loyalty', '--horizon', 'v1', '--summary', 'rewards']);
    createManifest(at, 'mvp', { work_type: 'epic', status: 'in-progress', phases: { discovery: { items: {} } } });
    commitAll(at, 'fixture');
  });
  beforeEach(() => { dir = setup(); });
  afterEach(() => { cleanup(dir); });

  function epicManifest() {
    return JSON.parse(fs.readFileSync(path.join(dir, '.leeway', 'mvp', 'manifest.json'), 'utf8'));
  }
  function writeEpic(m) {
    fs.writeFileSync(path.join(dir, '.leeway', 'mvp', 'manifest.json'), JSON.stringify(m, null, 2));
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
});

describe('engine CLI: the un-pull and the re-aim — remove and absorb move joins, never orphan them', () => {
  let dir;
  const setup = roadmapWorld((at) => {
    runOk(at, ['add', 'loyalty', '--horizon', 'v1', '--summary', 'rewards']);
    createManifest(at, 'mvp', { work_type: 'epic', status: 'in-progress', phases: { discovery: { items: {} } } });
    commitAll(at, 'fixture');
  });
  beforeEach(() => { dir = setup(); });
  afterEach(() => { cleanup(dir); });

  const engineOk = (/** @type {string[]} */ args) => ok(dir, args);

  it('discovery-map remove of a fresh joined topic reverts the join, staged in its own commit', () => {
    runOk(dir, ['pull-forward', 'loyalty', '--into', 'mvp', '--routing', 'discussion']);
    const res = engineOk(['discovery-map', 'remove', 'mvp', 'loyalty']);
    assert.deepStrictEqual(res.roadmap_reverted, ['loyalty']);
    const item = readProject(dir).roadmap.items.loyalty;
    assert.strictEqual('pulled_to' in item, false);
    assert.strictEqual(item.origin, 'harvest', 'origin survives the un-pull');
    assert.strictEqual(stateGit(dir, ['log', '-1', '--pretty=%s']).trim(), 'roadmap: un-pull loyalty (loyalty removed from mvp)');
    const staged = stateGit(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.deepStrictEqual(staged, ['manifest.json'], 'the un-pull commit carries the project manifest alone');
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
    fs.mkdirSync(path.join(dir, '.leeway', 'loyalty-feat', 'topics', 'loyalty-feat'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.leeway', 'loyalty-feat', 'topics', 'loyalty-feat', 'log.md'), '# Discussion\n');
    commitAll(dir, 'feature fixture');
    runOk(dir, ['pull', 'loyalty', '--into', 'loyalty-feat']);

    const res = engineOk(['workunit', 'absorb', 'loyalty-feat', '--into', 'mvp', '--topic', 'loyalty']);
    assert.deepStrictEqual(res.roadmap_reaimed, ['loyalty']);
    assert.deepStrictEqual(readProject(dir).roadmap.items.loyalty.pulled_to, { work_unit: 'mvp', topic: 'loyalty' });
    const state = runOk(dir, ['state']);
    assert.strictEqual(state.items.find((i) => i.name === 'loyalty').state, 'in-flight');
    assert.strictEqual(state.items.find((i) => i.name === 'loyalty').work_unit, 'mvp');
  });
});
