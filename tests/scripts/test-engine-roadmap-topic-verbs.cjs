'use strict';

// The roadmap as the work's own verbs move it
// (skills/leeway-engine/scripts/domain/roadmap.cjs), driven through the
// engine CLI: a topic postponed to the roadmap — its horizon born JIT, its
// files the item's sources — and pulled back, and a join reverted by the cancel of
// its topic or its unit, never by the unit's completion. One landing guard is
// driven directly instead: a peer taking a name between a postpone's plan and
// its write is a race no CLI sequence can reach, and the guard is the reason
// it can never become an overwrite.
//
// Layer: verb. World: the roadmap's (roadmap-world.cjs), each group's epic on
// top.

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { createManifest } = require('./discovery-test-utils.cjs');
const { postponeToRoadmap } = require('../../skills/leeway-engine/scripts/domain/roadmap.cjs');
const { stateGit, commitAll, cleanupFixture: cleanup, ok, output, refuses } = require('./engine-harness.cjs');
const { roadmapWorld, inState, runOk, runFail, readProject, projectManifestText, writeSource } = require('./roadmap-world.cjs');

describe('engine CLI: the postpone — a topic leaves the epic for the roadmap and comes back by the pull', () => {
  let dir;
  const setup = roadmapWorld((at) => {
    createManifest(at, 'mvp', {
      work_type: 'epic',
      status: 'in-progress',
      phases: {
        discovery: { items: {
          ordering: { routing: 'discussion', source: 'discovery', summary: 'Customers order', order: 1, brief_path: 'discovery/briefs/ordering.md' },
          menus: { routing: 'discussion', source: 'discovery', summary: 'Operators maintain', order: 2 },
          loyalty: { routing: 'discussion', source: 'discovery', order: 3 },
        } },
        discussion: { items: { ordering: { status: 'in-progress' }, menus: { status: 'completed' } } },
        specification: { items: { grp: { status: 'proposed', sources: { ordering: { status: 'pending' } } } } },
      },
    });
    for (const rel of ['discovery/briefs/ordering.md', 'topics/ordering/log.md']) {
      const abs = path.join(at, '.leeway', 'mvp', rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, '# x\n');
    }
    commitAll(at, 'fixture');
  });
  beforeEach(() => { dir = setup(); });
  afterEach(() => { cleanup(dir); });

  const engineOk = (/** @type {string[]} */ args) => ok(dir, args);
  const engineFails = (/** @type {string[]} */ args, /** @type {RegExp} */ p) => refuses(dir, args, p);
  const epicText = () => fs.readFileSync(path.join(dir, '.leeway', 'mvp', 'manifest.json'), 'utf8');
  const epic = () => JSON.parse(epicText());

  it('the birth arm: map and horizon born JIT, origin and postponed_from written, sources only where the file exists', () => {
    const res = engineOk(['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'next']);
    assert.strictEqual(res.status, 'postponed');
    assert.deepStrictEqual(res.postponed, [
      { phase: 'discussion', previous_status: 'in-progress' },
    ]);
    assert.deepStrictEqual(res.discarded, ['grp']);
    assert.deepStrictEqual(res.roadmap, { name: 'ordering', horizon: 'next', born_map: true, born_horizon: true, reverted_join: false });

    assert.deepStrictEqual(readProject(dir).roadmap, {
      horizons: ['next'],
      items: { ordering: {
        horizon: 'next',
        summary: 'Customers order',
        kind: 'idea',
        origin: 'postpone:mvp',
        postponed_from: { work_unit: 'mvp', topic: 'ordering' },
        sources: ['mvp/discovery/briefs/ordering.md', 'mvp/topics/ordering/log.md'],
      } },
    });
    const m = epic();
    assert.deepStrictEqual(m.phases.discovery.items.ordering,
      { routing: 'discussion', source: 'discovery', summary: 'Customers order', brief_path: 'discovery/briefs/ordering.md', postponed: true, previous_order: 1 });
    assert.strictEqual(m.phases.discussion.items.ordering.status, 'postponed');
    assert.strictEqual(m.phases.discussion.items.ordering.previous_status, 'in-progress');
    assert.strictEqual(m.phases.specification.items.grp, undefined, 'the proposed grouping is discarded, never stashed');

    assert.strictEqual(stateGit(dir, ['log', '-1', '--pretty=%s']).trim(), 'workflow(mvp): postpone ordering → next');
    const staged = stateGit(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(staged.includes('manifest.json'), 'project manifest staged');
    assert.ok(staged.includes('mvp/manifest.json'), 'epic manifest staged');
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
    assert.strictEqual(item.kind, 'idea');
  });

  it('a bug or a quick-fix never binds to a topic — it rides with the unit — so a re-wait is always an idea\'s', () => {
    runOk(dir, ['add', 'checkout-crash', '--horizon', 'mvp', '--summary', 'the order page crashes', '--kind', 'bug']);
    runOk(dir, ['add', 'typo', '--horizon', 'mvp', '--summary', 'the footer typo', '--kind', 'quick-fix']);
    runOk(dir, ['pull', 'checkout-crash', 'typo', '--into', 'mvp']);
    const before = projectManifestText(dir);
    assert.strictEqual(runFail(dir, ['bind', 'checkout-crash', '--topic', 'ordering']).error,
      '"checkout-crash" is a bug — it rides with the unit as material; only an idea binds to a topic');
    assert.match(runFail(dir, ['bind', 'typo', '--topic', 'ordering']).error, /^"typo" is a quick-fix — it rides with the unit/);
    assert.strictEqual(projectManifestText(dir), before);
    const res = engineOk(['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'later']);
    assert.strictEqual(res.roadmap.reverted_join, false, 'nothing bound to the topic, so the topic\'s own idea is born');
    assert.strictEqual(readProject(dir).roadmap.items.ordering.kind, 'idea');
    assert.deepStrictEqual(readProject(dir).roadmap.items['checkout-crash'].pulled_to, { work_unit: 'mvp' }, 'the bug rides on with the unit');
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
    const before = epicText();
    assert.throws(() => output(dir, ['render', 'postpone-gate', 'mvp.discovery.ordering', '--horizon', 'v2.1']));
    assert.match(refuses(dir, ['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'v2.1']).error,
      /"v2\.1" is not a legal horizon name — dots and slashes break manifest addressing/);
    assert.strictEqual(epicText(), before, 'the hold is never written');
  });

  it('a refusal at the landing leaves the epic manifest unsaved', () => {
    // The roadmap side lands inside the work-unit lock, before the epic is
    // saved: a malformed node refuses there, with the hold written in memory
    // alone. Seeded here because the race it stands in for — a peer taking
    // the name in the window — no CLI sequence can reach.
    const project = readProject(dir);
    project.roadmap = { horizons: {}, items: {} };
    fs.writeFileSync(path.join(dir, '.leeway', 'manifest.json'), JSON.stringify(project, null, 2));
    const before = epicText();
    assert.match(refuses(dir, ['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'next']).error,
      /roadmap\.horizons is malformed/);
    assert.strictEqual(epicText(), before, 'the topic is where the plan found it');
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

  it('the roadmap owns it from there: cancel and reactivate refuse, a send lands, the field surface refuses a status write and a delete', () => {
    engineOk(['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'next']);
    engineFails(['topic', 'cancel', 'mvp', 'discovery', 'ordering'],
      /"ordering" is postponed — the roadmap owns it; remove its item there to cancel it, or pull it forward first/);
    engineFails(['topic', 'reactivate', 'mvp', 'discovery', 'ordering'],
      /"ordering" is postponed, not cancelled — pull it forward from the roadmap instead/);
    for (const args of [
      ['topic', 'start', 'mvp', 'discussion', 'ordering'],
      ['topic', 'complete', 'mvp', 'discussion', 'ordering'],
      ['topic', 'supersede', 'mvp', 'discussion', 'ordering', '--by', 'menus'],
    ]) {
      engineFails(args, /discussion item "ordering" is postponed — the topic waits on the roadmap; pull it forward from there instead/);
    }
    engineFails(['manifest', 'set', 'mvp.discussion.ordering', 'status', 'in-progress'],
      /discussion item "ordering" is postponed — pull it forward from the roadmap instead/);
    engineFails(['manifest', 'delete', 'mvp.discussion.ordering', 'previous_status'],
      /discussion item "ordering" is postponed — pull it forward from the roadmap instead/);
    // A message for a topic that waits is mail that waits with it.
    fs.mkdirSync(path.join(dir, '.leeway/.cache/scratch'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.leeway/.cache/scratch/message.md'), 'Ordering\n\nA question for later.\n');
    const before = fs.readFileSync(path.join(dir, '.leeway/mvp/manifest.json'), 'utf8');
    const parked = engineOk(['topic', 'send', 'mvp', 'ordering', '--from', 'menus', '--content', '.leeway/.cache/scratch/message.md', '--slug', 'a-question']);
    assert.strictEqual(parked.message_path, path.join(dir, '.leeway/mvp/topics/ordering/mail/001-a-question.md'));
    assert.strictEqual(fs.readFileSync(path.join(dir, '.leeway/mvp/manifest.json'), 'utf8'), before, 'the send leaves the hold alone');
  });

  it('roadmap remove cancels the epic\'s row in the same transaction, one commit over both manifests', () => {
    engineOk(['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'next']);
    const res = runOk(dir, ['remove', 'ordering']);
    assert.deepStrictEqual(res.epic_row_cancelled, { work_unit: 'mvp', topic: 'ordering' });
    const m = epic();
    assert.strictEqual(m.phases.discovery.items.ordering.postponed, undefined);
    assert.strictEqual(m.phases.discovery.items.ordering.cancelled, true);
    assert.strictEqual(m.phases.discovery.items.ordering.previous_order, 1, 'the stashed order survives for the reactivate');
    assert.strictEqual(m.phases.discussion.items.ordering.status, 'cancelled');
    assert.strictEqual(m.phases.discussion.items.ordering.previous_status, 'in-progress');
    assert.strictEqual(readProject(dir).roadmap.items.ordering, undefined);
    assert.strictEqual(stateGit(dir, ['log', '-1', '--pretty=%s']).trim(), 'roadmap: remove ordering — ordering cancelled in mvp');
    const staged = stateGit(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(staged.includes('manifest.json') && staged.includes('mvp/manifest.json'), 'both manifests ride one commit');
    // And the reactivate is then the way back, as for any cancelled unit.
    assert.deepStrictEqual(ok(dir, ['topic', 'reactivate', 'mvp', 'discovery', 'ordering']).restored,
      [{ phase: 'discussion', status: 'in-progress' }]);
  });

  it('roadmap remove of a re-waited item brought from the inbox declines its note and cancels the epic\'s row, one commit over both manifests and the note', () => {
    const inboxNote = '.leeway/.inbox/ideas/2026-03-01--guest-ordering.md';
    const roadmapNote = '.leeway/.roadmap/notes/ideas/2026-03-01--guest-ordering.md';
    const archived = '.leeway/.inbox/.archived/ideas/2026-03-01--guest-ordering.md';
    fs.mkdirSync(path.dirname(path.join(dir, inboxNote)), { recursive: true });
    fs.writeFileSync(path.join(dir, inboxNote), '# Guest ordering\n');
    commitAll(dir, 'inbox');
    fs.writeFileSync(path.join(dir, 'batch.json'), JSON.stringify([{ name: 'guest-ordering', horizon: 'mvp', summary: 'customers order', note: inboxNote }]));
    runOk(dir, ['add-batch', '--file', 'batch.json']);
    runOk(dir, ['pull', 'guest-ordering', '--into', 'mvp']);
    runOk(dir, ['bind', 'guest-ordering', '--topic', 'ordering']);
    assert.strictEqual(engineOk(['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'later']).roadmap.reverted_join, true);
    assert.ok(readProject(dir).roadmap.items['guest-ordering'].sources.includes('.roadmap/notes/ideas/2026-03-01--guest-ordering.md'));

    const res = runOk(dir, ['remove', 'guest-ordering']);
    assert.deepStrictEqual(res.notes_moved, [{ from: path.join(dir, roadmapNote), to: path.join(dir, archived) }]);
    assert.deepStrictEqual(res.epic_row_cancelled, { work_unit: 'mvp', topic: 'ordering' });
    assert.strictEqual(fs.existsSync(path.join(dir, roadmapNote)), false);
    assert.ok(fs.existsSync(path.join(dir, archived)), 'the note is declined to the inbox archive');
    assert.ok(fs.existsSync(path.join(dir, '.leeway/mvp/topics/ordering/log.md')), 'the topic\'s own files are its epic\'s, never archived');
    assert.strictEqual(epic().phases.discovery.items.ordering.cancelled, true);
    assert.strictEqual(readProject(dir).roadmap.items['guest-ordering'], undefined);
    assert.strictEqual(stateGit(dir, ['log', '-1', '--pretty=%s']).trim(), 'roadmap: remove guest-ordering — ordering cancelled in mvp');
    assert.deepStrictEqual(stateGit(dir, ['show', '--name-status', '--pretty=format:', 'HEAD']).trim().split('\n').sort(), [
      'M\tmanifest.json', 'M\tmvp/manifest.json', `R100\t${inState(roadmapNote)}\t${inState(archived)}`,
    ]);
  });

  it('roadmap remove over a topic that holds no postpone refuses — the join is stale, not a cancel to make', () => {
    engineOk(['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'next']);
    // The epic's row came back by some other hand; the item still names it.
    const m = epic();
    delete m.phases.discovery.items.ordering.postponed;
    m.phases.discussion.items.ordering.status = 'in-progress';
    fs.writeFileSync(path.join(dir, '.leeway', 'mvp', 'manifest.json'), JSON.stringify(m, null, 2));
    const before = epicText();
    assert.match(runFail(dir, ['remove', 'ordering']).error,
      /"ordering" was postponed from "ordering" in work unit "mvp", where nothing is postponed — the join is stale/);
    assert.strictEqual(epicText(), before, 'the epic is untouched');
    assert.ok(readProject(dir).roadmap.items.ordering, 'and the item stands');
  });

  it('roadmap remove of an item whose epic is gone refuses rather than orphaning the row', () => {
    engineOk(['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'next']);
    fs.rmSync(path.join(dir, '.leeway', 'mvp'), { recursive: true, force: true });
    runFail(dir, ['remove', 'ordering']);
    assert.match(runFail(dir, ['remove', 'ordering']).error,
      /"ordering" was postponed from work unit "mvp", which no longer exists — the join is orphaned/);
  });

  it('pull-forward back into the same epic restores the unit and drops postponed_from', () => {
    ok(dir, ['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'next']);
    const res = ok(dir, ['roadmap', 'pull-forward', 'ordering', '--into', 'mvp']);
    assert.strictEqual(res.op, 'pull-forward');
    assert.strictEqual(res.state, 'in-flight');
    assert.deepStrictEqual(res.restored, [{ phase: 'discussion', status: 'in-progress' }]);
    const m = epic();
    assert.strictEqual(m.phases.discovery.items.ordering.postponed, undefined, 'the marker is gone');
    assert.strictEqual(m.phases.discovery.items.ordering.order, 1, 'the map order returns');
    assert.strictEqual(m.phases.discussion.items.ordering.status, 'in-progress');
    assert.strictEqual('previous_status' in m.phases.discussion.items.ordering, false);
    const item = readProject(dir).roadmap.items.ordering;
    assert.deepStrictEqual(item.pulled_to, { work_unit: 'mvp', topic: 'ordering' });
    assert.strictEqual('postponed_from' in item, false, 'the item is in flight again — a later postpone re-sets it');
    const staged = stateGit(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(staged.includes('manifest.json') && staged.includes('mvp/manifest.json'));
  });

  it('the re-wait merges into the sources the item already carries — never a duplicate', () => {
    writeSource(dir, '.product/sessions/session-001.md');
    runOk(dir, ['add', 'guest-ordering', '--horizon', 'mvp', '--summary', 'customers order',
      '--source', '.product/sessions/session-001.md', '--source', 'mvp/topics/ordering/log.md']);
    runOk(dir, ['pull', 'guest-ordering', '--into', 'mvp']);
    runOk(dir, ['bind', 'guest-ordering', '--topic', 'ordering']);
    engineOk(['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'later']);
    assert.deepStrictEqual(readProject(dir).roadmap.items['guest-ordering'].sources, [
      '.product/sessions/session-001.md',
      'mvp/topics/ordering/log.md',
      'mvp/discovery/briefs/ordering.md',
    ]);
  });

  it('refuses a call that names no topic', () => {
    engineFails(['topic', 'postpone', 'mvp'], /Usage: engine topic postpone <work-unit> <topic> --horizon "<horizon>"/);
    engineFails(['topic', 'postpone', 'mvp', 'ordering', 'extra', '--horizon', 'next'], /Usage: engine topic postpone/);
  });

  it('pull-forward into another epic creates as usual and carries prior onto the new row', () => {
    engineOk(['topic', 'postpone', 'mvp', 'ordering', '--horizon', 'next']);
    createManifest(dir, 'v2', { work_type: 'epic', status: 'in-progress', phases: { discovery: { items: {} } } });
    const res = runOk(dir, ['pull-forward', 'ordering', '--into', 'v2', '--routing', 'discussion']);
    assert.deepStrictEqual(res.prior, { work_unit: 'mvp', topic: 'ordering' });
    const row = JSON.parse(fs.readFileSync(path.join(dir, '.leeway', 'v2', 'manifest.json'), 'utf8')).phases.discovery.items.ordering;
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
    commitAll(dir, 'v2');
    runOk(dir, ['pull', 'ordering', '--into', 'v2']);
    const res = runOk(dir, ['bind', 'ordering', '--topic', 'checkout']);
    assert.deepStrictEqual(res.prior, { work_unit: 'mvp', topic: 'ordering' });
    assert.deepStrictEqual(
      JSON.parse(fs.readFileSync(path.join(dir, '.leeway', 'v2', 'manifest.json'), 'utf8')).phases.discovery.items.checkout.prior,
      { work_unit: 'mvp', topic: 'ordering' });
    const staged = stateGit(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(staged.includes('v2/manifest.json'), 'the map write rides the bind commit');
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
  const setup = roadmapWorld((at) => {
    runOk(at, ['add', 'ordering', '--horizon', 'mvp', '--summary', 's']);
    runOk(at, ['add', 'menus', '--horizon', 'mvp', '--summary', 's']);
    createManifest(at, 'mvp', {
      work_type: 'epic',
      status: 'in-progress',
      phases: {
        discovery: { items: { ordering: { routing: 'discussion', source: 'roadmap', summary: 's' } } },
        discussion: { items: { ordering: { status: 'in-progress' } } },
      },
    });
    commitAll(at, 'fixture');
    runOk(at, ['pull', 'ordering', 'menus', '--into', 'mvp']);
    runOk(at, ['bind', 'ordering', '--topic', 'ordering']);
  });
  beforeEach(() => { dir = setup(); });
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
    const staged = stateGit(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(staged.includes('manifest.json'), 'project manifest rides the cancel commit');
    const state = runOk(dir, ['state']);
    assert.strictEqual(state.items.find((i) => i.name === 'ordering').state, 'waiting');
  });

  it('work-unit cancel reverts every join into the unit', () => {
    const res = engineOk(['workunit', 'cancel', 'mvp']);
    assert.deepStrictEqual([...res.roadmap_reverted].sort(), ['menus', 'ordering']);
    const state = runOk(dir, ['state']);
    assert.deepStrictEqual(state.totals, { items: 2, waiting: 2, in_flight: 0, shipped: 0, orphaned: 0 });
    const staged = stateGit(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n');
    assert.ok(staged.includes('manifest.json'), 'project manifest rides the cancel commit');
  });

  it('work-unit complete leaves joins in place — shipped by derivation, no revert', () => {
    const res = engineOk(['workunit', 'complete', 'mvp', '-m', 'done']);
    assert.strictEqual('roadmap_reverted' in res, false);
    const state = runOk(dir, ['state']);
    assert.strictEqual(state.totals.shipped, 2);
  });

  it('a never-started topic\'s cancel reverts the join too — the marker alone reads cancelled', () => {
    const p = path.join(dir, '.leeway', 'mvp', 'manifest.json');
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
