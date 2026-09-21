'use strict';

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ENGINE = path.join(__dirname, '../../skills/workflow-engine/scripts/engine.cjs');
const { computeTopicLifecycle } = require('../../skills/workflow-engine/scripts/domain/derivations.cjs');

/** @param {string} dir @param {string[]} args */
function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

/** A temp-dir fixture that is a real git repo with a `.workflows/` tree. */
function setupGitFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-tx-'));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  fs.mkdirSync(path.join(dir, '.workflows'), { recursive: true });
  return dir;
}

function cleanupFixture(dir) {
  // Retries absorb the macOS teardown race (ENOTEMPTY while a just-exited
  // child's writes settle).
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function commitAll(dir, message) {
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', message]);
}

function lastMessage(dir) {
  return git(dir, ['log', '-1', '--pretty=%s']).trim();
}

function shortHead(dir) {
  return git(dir, ['rev-parse', '--short', 'HEAD']).trim();
}

function readManifest(dir, wu) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.workflows', wu, 'manifest.json'), 'utf8'));
}

/** Run the engine expecting success; returns the parsed JSON response. */
function engine(dir, args) {
  const out = execFileSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8' });
  const nl = out.indexOf('\n');
  const res = JSON.parse((nl === -1 ? out : out.slice(0, nl)).trim());
  engine.lastSections = nl === -1 ? '' : out.slice(nl + 1);
  return res;
}
engine.lastSections = '';

/** Run `engine render` expecting success; returns the whole stdout (sections). */
function render(dir, args) {
  return execFileSync('node', [ENGINE, 'render', ...args], { cwd: dir, encoding: 'utf8' });
}

/** Run the engine expecting failure; returns the parsed stderr JSON. */
function engineFails(dir, args) {
  const res = spawnSync('node', [ENGINE, ...args], { cwd: dir, encoding: 'utf8' });
  assert.strictEqual(res.status, 1, `expected exit 1, got ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  assert.strictEqual(res.stdout, '');
  const parsed = JSON.parse(res.stderr.trim());
  assert.strictEqual(parsed.ok, false);
  return parsed;
}

/** An epic manifest with plural phase items and a discovery-map entry carrying `order`. */
function epicManifest() {
  return {
    name: 'payments',
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      discovery: { items: { 'auth-flow': { routing: 'discussion', order: 2, source: 'discovery' } } },
      research: { items: { 'auth-flow': { status: 'in-progress' }, 'fee-model': { status: 'completed' } } },
      discussion: { items: { 'session-model': { status: 'completed' }, 'refund-policy': { status: 'in-progress' } } },
    },
  };
}

function setupEpicFixture() {
  const dir = setupGitFixture();
  writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(epicManifest(), null, 2) + '\n');
  commitAll(dir, 'init');
  return dir;
}

// An epic whose map carries every unit shape the cancel meets: a never-
// started topic, a started one with a live evidence wait and a proposed
// grouping over its discussion, a parked stub, a topic a started spec
// sources, and a Definition unit with a plan beneath it.
function unitManifest() {
  return {
    name: 'payments',
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      discovery: {
        items: {
          'data-export': { routing: 'discussion', source: 'discovery', order: 1 },
          'auth-flow': { routing: 'research', source: 'discovery', order: 2 },
          'fee-model': { routing: 'discussion', source: 'discovery', order: 3 },
          'session-model': { routing: 'discussion', source: 'discovery', order: 4 },
        },
      },
      research: { items: { 'auth-flow': { status: 'completed' }, 'fee-model': { status: 'triaged' } } },
      discussion: {
        items: {
          'auth-flow': { status: 'in-progress', awaiting_experiments: ['E1'] },
          'fee-model': { status: 'completed' },
          'session-model': { status: 'completed' },
        },
      },
      experiment: {
        items: {
          'auth-flow': { status: 'in-progress', experiments: { E1: { slug: 'latency', status: 'running' }, 'E1.1': { slug: 'part', status: 'conceived' } } },
        },
      },
      specification: {
        items: {
          grouping: { status: 'proposed', sources: { 'auth-flow': { status: 'pending' } } },
          'session-model': { status: 'in-progress', order: 1, sources: { 'session-model': { status: 'incorporated' } } },
          'fee-model': { status: 'completed', order: 2, sources: { 'fee-model': { status: 'incorporated' } } },
        },
      },
      planning: { items: { 'session-model': { status: 'in-progress' }, 'fee-model': { status: 'completed' } } },
      implementation: { items: { 'fee-model': { status: 'in-progress' } } },
    },
  };
}

function setupUnitFixture() {
  const dir = setupGitFixture();
  writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(unitManifest(), null, 2) + '\n');
  commitAll(dir, 'init');
  return dir;
}

describe('engine topic cancel — the discovery unit', () => {
  let dir;
  beforeEach(() => { dir = setupUnitFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a never-started topic takes the map marker alone, its order stashed, and commits', () => {
    const res = engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'data-export']);
    assert.deepStrictEqual(res, {
      ok: true, topic: 'data-export', phase: 'discovery', status: 'cancelled',
      cancelled: [], discarded: [], abandoned: [], released_waits: [],
      committed: shortHead(dir), warnings: [], roadmap_reverted: [],
    });
    assert.deepStrictEqual(readManifest(dir, 'payments').phases.discovery.items['data-export'],
      { routing: 'discussion', source: 'discovery', cancelled: true, previous_order: 1 });
    assert.strictEqual(lastMessage(dir), 'workflow(payments): cancel data-export (discovery)');
    assert.strictEqual(engine.lastSections, '', 'transactions answer with pure JSON');
    assert.match(render(dir, ['topic-receipt', 'payments.discovery.data-export', '--verb', 'cancel']),
      /DISPLAY: confirmation[\s\S]*Cancelled "Data Export"\.\n/);
  });

  it('a started topic takes every conversation, releasing the waits before the holders close, abandoning the records, discarding the proposed grouping', () => {
    const res = engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'auth-flow']);
    assert.deepStrictEqual(res.cancelled, [
      { phase: 'research', previous_status: 'completed' },
      { phase: 'discussion', previous_status: 'in-progress' },
    ]);
    assert.deepStrictEqual(res.discarded, ['grouping']);
    assert.deepStrictEqual(res.abandoned, ['E1', 'E1.1'], 'every open record ends abandoned, the split with its parent');
    assert.deepStrictEqual(res.released_waits, [{ phase: 'discussion', released: ['E1'], remaining: [] }]);
    // No KB configured in the fixture — warn-don't-block, one warning per
    // indexed item the cancel took.
    assert.strictEqual(res.warnings.length, 2);
    assert.match(res.warnings[0], /knowledge remove failed/);

    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.research.items['auth-flow'], { status: 'cancelled', previous_status: 'completed' });
    // The release landed while the holder was still live: the flag rides the
    // cancelled item inertly and comes back live with the reactivate.
    assert.deepStrictEqual(m.phases.discussion.items['auth-flow'],
      { status: 'cancelled', previous_status: 'in-progress', reconcile_needed: 'experiment' });
    const series = m.phases.experiment.items['auth-flow'];
    assert.strictEqual(series.status, 'completed', 'every record terminal — the series settles, never a cancel');
    assert.strictEqual(series.experiments.E1.reason, 'topic cancelled');
    assert.strictEqual(series.experiments['E1.1'].reason, 'topic cancelled');
    assert.strictEqual(m.phases.specification.items.grouping, undefined, 'the proposed grouping is gone, not cancelled');
    assert.deepStrictEqual(m.phases.discovery.items['auth-flow'],
      { routing: 'research', source: 'discovery', cancelled: true, previous_order: 2 });
    assert.strictEqual(lastMessage(dir), 'workflow(payments): cancel auth-flow (discovery)');
    assert.match(render(dir, ['topic-receipt', 'payments.discovery.auth-flow', '--verb', 'cancel', '--warn']),
      /⚑ Knowledge removal warning[\s\S]*Cancelled "Auth Flow"\./);
  });

  it('a parked stub is taken with the topic — triaged stashed like any status', () => {
    // fee-model's specification is implementation-locked in the fixture; with
    // no code under it, the specification cancels and frees the topic.
    const m = unitManifest();
    delete m.phases.implementation;
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    engine(dir, ['topic', 'cancel', 'payments', 'specification', 'fee-model']);
    const res = engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'fee-model']);
    assert.deepStrictEqual(res.cancelled, [
      { phase: 'research', previous_status: 'triaged' },
      { phase: 'discussion', previous_status: 'completed' },
    ]);
    assert.deepStrictEqual(readManifest(dir, 'payments').phases.research.items['fee-model'], { status: 'cancelled', previous_status: 'triaged' });
  });

  it('a started specification locks its source topic; cancelling the specification frees it', () => {
    const err = engineFails(dir, ['topic', 'cancel', 'payments', 'discovery', 'session-model']);
    assert.strictEqual(err.error, 'cancelling "session-model" is refused while the specification "session-model" sources its discussion — cancel the specification first');
    assert.strictEqual(readManifest(dir, 'payments').phases.discussion.items['session-model'].status, 'completed', 'the refusal writes nothing');

    engine(dir, ['topic', 'cancel', 'payments', 'specification', 'session-model']);
    const res = engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'session-model']);
    assert.deepStrictEqual(res.cancelled, [{ phase: 'discussion', previous_status: 'completed' }]);
    assert.deepStrictEqual(res.discarded, [], 'a cancelled specification is not a proposal — nothing to discard');
  });

  it('two started specifications sourcing the discussion are both named', () => {
    const m = unitManifest();
    m.phases.specification.items.other = { status: 'in-progress', sources: { 'session-model': { status: 'pending' } } };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments', 'discovery', 'session-model']).error,
      /refused while the specifications "session-model", "other" source its discussion — cancel them first/);
  });

  it('a cancel that would take nothing refuses — an off-map topic whose only item is superseded', () => {
    const m = unitManifest();
    m.phases.research.items.legacy = { status: 'superseded', superseded_by: 'auth-flow' };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    const before = JSON.stringify(readManifest(dir, 'payments'));
    assert.strictEqual(engineFails(dir, ['topic', 'cancel', 'payments', 'discovery', 'legacy']).error,
      '"legacy" has nothing to cancel — no live item under its name and no map row');
    assert.strictEqual(JSON.stringify(readManifest(dir, 'payments')), before, 'nothing written');
    assert.match(engineFails(dir, ['render', 'cancel-gate', 'payments.discovery.legacy']).error,
      /"legacy" has nothing to cancel — no live item under its name and no map row, so the menu never offers it/);
  });

  it('an off-map topic reads cancelled beside a superseded sibling, and reactivates', () => {
    const m = unitManifest();
    m.phases.research.items.legacy = { status: 'superseded', superseded_by: 'auth-flow' };
    m.phases.discussion.items.legacy = { status: 'cancelled', previous_status: 'completed' };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    assert.strictEqual(computeTopicLifecycle(readManifest(dir, 'payments'), 'legacy').lifecycle, 'cancelled');
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments', 'discovery', 'legacy']).error, /"legacy" is already cancelled/);
    const res = engine(dir, ['topic', 'reactivate', 'payments', 'discovery', 'legacy']);
    assert.deepStrictEqual(res.restored, [{ phase: 'discussion', status: 'completed' }]);
    assert.strictEqual(computeTopicLifecycle(readManifest(dir, 'payments'), 'legacy').lifecycle, 'decided');
  });

  it('a dead end cancels and comes back a dead end — the marker sits over the close', () => {
    const m = unitManifest();
    m.phases.discovery.items['data-export'].handled = true;
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    const res = engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'data-export']);
    assert.deepStrictEqual(res.cancelled, []);
    assert.deepStrictEqual(readManifest(dir, 'payments').phases.discovery.items['data-export'],
      { routing: 'discussion', source: 'discovery', handled: true, cancelled: true, previous_order: 1 });
    assert.strictEqual(computeTopicLifecycle(readManifest(dir, 'payments'), 'data-export').lifecycle, 'cancelled');
    assert.match(engineFails(dir, ['discovery-map', 'unhandle', 'payments', 'data-export']).error,
      /"data-export" can't be reopened — it's cancelled; reactivate it from the epic menu first/);
    engine(dir, ['topic', 'reactivate', 'payments', 'discovery', 'data-export']);
    assert.deepStrictEqual(readManifest(dir, 'payments').phases.discovery.items['data-export'],
      { routing: 'discussion', source: 'discovery', handled: true, order: 1 });
    assert.strictEqual(computeTopicLifecycle(readManifest(dir, 'payments'), 'data-export').lifecycle, 'handled');
  });

  it('a legacy array-form sources list locks and holds the same way', () => {
    const m = unitManifest();
    m.phases.specification.items['session-model'].sources = [{ name: 'session-model', status: 'incorporated' }];
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments', 'discovery', 'session-model']).error,
      /refused while the specification "session-model" sources its discussion — cancel the specification first/);
    engine(dir, ['topic', 'cancel', 'payments', 'specification', 'session-model']);
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'session-model']);
    assert.strictEqual(engineFails(dir, ['topic', 'reactivate', 'payments', 'specification', 'session-model']).error,
      'reactivating "session-model" is refused while its source "session-model" is cancelled — reactivate the topic first');
  });

  it('a legacy topic with no map row cancels through its items and reads cancelled', () => {
    const m = unitManifest();
    m.phases.research.items.legacy = { status: 'completed' };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    const res = engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'legacy']);
    assert.deepStrictEqual(res.cancelled, [{ phase: 'research', previous_status: 'completed' }]);
    assert.strictEqual(computeTopicLifecycle(readManifest(dir, 'payments'), 'legacy').lifecycle, 'cancelled');
  });

  it('refuses an already-cancelled unit, an unknown topic, and every non-unit phase', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'data-export']);
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments', 'discovery', 'data-export']).error, /"data-export" is already cancelled/);
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments', 'discovery', 'ghost']).error,
      /no topic "ghost" — nothing on the map and no research or discussion item of that name/);
    assert.match(engineFails(dir, ['topic', 'cancel', 'ghost', 'discovery', 'data-export']).error, /manifest not found/);
    for (const phase of ['research', 'discussion', 'experiment', 'planning', 'nonsense']) {
      assert.strictEqual(engineFails(dir, ['topic', 'cancel', 'payments', phase, 'auth-flow']).error,
        'cancel is topic-level per stage — discovery (the map row with its research, discussion, and experiments) or specification (with its planning)', phase);
    }
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments']).error, /Usage: engine topic cancel <work-unit> <discovery\|specification> <topic>/);
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments', 'discovery', 'auth-flow', '--cascade']).error,
      /Usage: engine topic cancel <work-unit> <discovery\|specification> <topic>/, 'the retired flag is a usage error');
    assert.strictEqual(readManifest(dir, 'payments').phases.discussion.items['auth-flow'].status, 'in-progress', 'no refusal wrote anything');
  });

  it('the cancel gate states exactly what the cancel takes, and refuses what the menu never offers', () => {
    assert.match(render(dir, ['cancel-gate', 'payments.discovery.data-export']),
      /Cancelling \*\*Data Export\*\* takes it off the board — nothing has started, so only the map row is marked; it can be reactivated later\./);
    const started = render(dir, ['cancel-gate', 'payments.discovery.auth-flow']).replace(/\n +/g, ' ');
    assert.match(started, /Cancelling \*\*Auth Flow\*\* marks its research \[completed\] and discussion \[in-progress\] cancelled — it can be reactivated later\. 1 open experiment \(E1, with E1\.1\) ends abandoned on the register\. The proposed grouping \*\*Grouping\*\* is discarded — the next grouping analysis rebuilds from the new world\./);
    assert.match(started, /◆ Cancel it\?/);
    assert.match(started, /\*\*`y\/yes`\*\* → Confirm cancellation/);
    assert.match(engineFails(dir, ['render', 'cancel-gate', 'payments.discovery.session-model']).error,
      /"session-model" is locked by the specification sourcing its discussion \(session-model\) — the menu never offers it/);
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'data-export']);
    assert.match(engineFails(dir, ['render', 'cancel-gate', 'payments.discovery.data-export']).error, /already cancelled — the menu never offers it/);
    assert.match(engineFails(dir, ['render', 'cancel-gate', 'payments.research.auth-flow']).error,
      /address must be <work_unit>\.discovery\.<topic> or <work_unit>\.specification\.<spec>, got phase "research"/);
  });
});

describe('engine topic cancel — the specification unit', () => {
  let dir;
  beforeEach(() => { dir = setupUnitFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('takes the specification and its plan, stashing statuses and the build order, and leaves the sources alone', () => {
    const res = engine(dir, ['topic', 'cancel', 'payments', 'specification', 'session-model']);
    assert.deepStrictEqual(res, {
      ok: true, topic: 'session-model', phase: 'specification', status: 'cancelled', discarded: [], abandoned: [], released_waits: [],
      cancelled: [
        { phase: 'specification', previous_status: 'in-progress' },
        { phase: 'planning', previous_status: 'in-progress' },
      ],
      committed: shortHead(dir), warnings: [res.warnings[0]],
    });
    assert.match(res.warnings[0], /knowledge remove failed/);
    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.specification.items['session-model'],
      { status: 'cancelled', previous_status: 'in-progress', previous_order: 1, sources: { 'session-model': { status: 'incorporated' } } });
    assert.deepStrictEqual(m.phases.planning.items['session-model'], { status: 'cancelled', previous_status: 'in-progress' });
    assert.strictEqual(m.phases.discussion.items['session-model'].status, 'completed', 'the source discussion is untouched');
    assert.strictEqual(m.phases.discovery.items['session-model'].order, 4, 'the map order belongs to the topic, not the specification');
    assert.strictEqual(lastMessage(dir), 'workflow(payments): cancel session-model (specification)');
    assert.match(render(dir, ['topic-receipt', 'payments.specification.session-model', '--verb', 'cancel', '--warn']),
      /⚑ Knowledge removal warning[\s\S]*Cancelled "Session Model"\./);
  });

  it('the cancel gate names the plan and the source discussions the cancel frees', () => {
    const out = render(dir, ['cancel-gate', 'payments.specification.session-model']).replace(/\n +/g, ' ');
    assert.match(out, /Cancelling \*\*Session Model\*\* marks the specification and its plan cancelled and frees its source discussion \(Session Model\) to be regrouped or cancelled; it can be reactivated later\./);
  });

  it('a specification that carries no status has nothing to cancel — the analysis\'s augment against a mistyped key creates one', () => {
    const m = unitManifest();
    m.phases.specification.items.blank = { sources: { 'session-model': { status: 'pending' } } };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    const before = JSON.stringify(readManifest(dir, 'payments'));
    assert.strictEqual(engineFails(dir, ['topic', 'cancel', 'payments', 'specification', 'blank']).error,
      'specification "blank" has nothing to cancel — it carries no status');
    assert.strictEqual(JSON.stringify(readManifest(dir, 'payments')), before, 'nothing written');
    assert.match(engineFails(dir, ['render', 'cancel-gate', 'payments.specification.blank']).error,
      /"blank" has nothing to cancel — it carries no status, so the menu never offers it/);
    // Nor does it lock its source: the topic beneath it cancels freely once
    // the started specification over the same discussion is gone.
    engine(dir, ['topic', 'cancel', 'payments', 'specification', 'session-model']);
    assert.deepStrictEqual(engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'session-model']).discarded, []);
  });

  it('refuses a proposed grouping, a locked specification, and an already-cancelled one', () => {
    assert.strictEqual(engineFails(dir, ['topic', 'cancel', 'payments', 'specification', 'grouping']).error,
      'a proposed grouping is not started — cancel its source topic to discard it, or let the grouping walk regroup');
    assert.strictEqual(engineFails(dir, ['topic', 'cancel', 'payments', 'specification', 'fee-model']).error,
      '"fee-model" is locked — implementation has started; code in the tree is fixed forward, and the work-unit cancel abandons the epic');
    assert.match(engineFails(dir, ['render', 'cancel-gate', 'payments.specification.fee-model']).error, /is locked — implementation has started/);
    assert.match(engineFails(dir, ['render', 'cancel-gate', 'payments.specification.grouping']).error, /is a proposed grouping/);
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments', 'specification', 'ghost']).error, /no specification item "ghost"/);
    engine(dir, ['topic', 'cancel', 'payments', 'specification', 'session-model']);
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments', 'specification', 'session-model']).error, /"session-model" is already cancelled/);
  });

  it('a review item locks the specification too, and a legacy cancelled implementation item still does', () => {
    const m = unitManifest();
    m.phases.review = { items: { 'session-model': { status: 'completed' } } };
    m.phases.implementation.items['fee-model'].status = 'cancelled';
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments', 'specification', 'session-model']).error, /is locked — implementation has started/);
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments', 'specification', 'fee-model']).error, /is locked — implementation has started/);
  });
});

// A spec topic's name collides with a discovery-map topic's name by
// construction — an independent discussion becomes a grouping of one. The
// map's order belongs to the Discovery unit, so a Definition-unit cancel
// must leave it untouched.
function collidingManifest() {
  return {
    name: 'payments',
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      discovery: {
        items: {
          'auth-flow': { routing: 'discussion', order: 1, source: 'discovery' },
          'fee-model': { routing: 'discussion', order: 2, source: 'discovery' },
        },
      },
      discussion: {
        items: { 'auth-flow': { status: 'completed' }, 'fee-model': { status: 'completed' } },
      },
      specification: {
        items: { 'auth-flow': { status: 'in-progress', sources: { 'auth-flow': { status: 'incorporated' } } } },
      },
    },
  };
}

describe('a specification cancel leaves the discovery order alone', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(collidingManifest(), null, 2) + '\n');
    commitAll(dir, 'init');
  });
  afterEach(() => { cleanupFixture(dir); });

  it('cancelling a specification does not strip the same-named map topic order', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'specification', 'auth-flow']);

    const map = readManifest(dir, 'payments').phases.discovery.items['auth-flow'];
    assert.strictEqual(map.order, 1, 'a live map topic keeps its position');
    assert.strictEqual(map.previous_order, undefined, 'nothing stashed');
  });

  it('reactivating a specification does not overwrite a re-sequenced map order', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'specification', 'auth-flow']);
    engine(dir, ['discovery-map', 'sequence', 'payments', 'auth-flow=2', 'fee-model=1']);
    engine(dir, ['topic', 'reactivate', 'payments', 'specification', 'auth-flow']);

    const items = readManifest(dir, 'payments').phases.discovery.items;
    assert.strictEqual(items['auth-flow'].order, 2, 're-sequenced position survives');
    assert.strictEqual(items['fee-model'].order, 1, 'no collision');
    assert.strictEqual(items['auth-flow'].previous_order, undefined);
  });

  it('a topic cancel stashes the map order and its reactivate restores it', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'fee-model']);
    assert.strictEqual(readManifest(dir, 'payments').phases.discovery.items['fee-model'].previous_order, 2);

    engine(dir, ['topic', 'reactivate', 'payments', 'discovery', 'fee-model']);
    const back = readManifest(dir, 'payments').phases.discovery.items['fee-model'];
    assert.strictEqual(back.order, 2);
    assert.strictEqual(back.previous_order, undefined);
    assert.strictEqual(back.cancelled, undefined, 'the marker is gone');
  });

  it('a taken map number is not restored — the stash drops and the row reads unordered', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'fee-model']);
    engine(dir, ['discovery-map', 'sequence', 'payments', 'auth-flow=2']);
    engine(dir, ['topic', 'reactivate', 'payments', 'discovery', 'fee-model']);

    const items = readManifest(dir, 'payments').phases.discovery.items;
    assert.strictEqual(items['fee-model'].order, undefined, 'stale number not restored over auth-flow');
    assert.strictEqual(items['fee-model'].previous_order, undefined, 'stash dropped');
    assert.strictEqual(items['auth-flow'].order, 2, 'no collision');
  });

  it('a closed row squatting on the number does not veto the restore', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'fee-model']);
    engine(dir, ['discovery-map', 'handle', 'payments', 'auth-flow']);
    const m = readManifest(dir, 'payments');
    m.phases.discovery.items['auth-flow'].order = 2;
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    commitAll(dir, 'squat');

    engine(dir, ['topic', 'reactivate', 'payments', 'discovery', 'fee-model']);
    assert.strictEqual(readManifest(dir, 'payments').phases.discovery.items['fee-model'].order, 2, 'restored over the dead-ended squatter');
  });
});

describe('engine topic reactivate', () => {
  let dir;
  beforeEach(() => { dir = setupUnitFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a never-started topic returns with nothing to restore — the marker cleared, the order back', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'data-export']);
    const res = engine(dir, ['topic', 'reactivate', 'payments', 'discovery', 'data-export']);
    assert.deepStrictEqual(res, {
      ok: true, topic: 'data-export', phase: 'discovery', status: 'reactivated', restored: [], discarded: [],
      committed: shortHead(dir), warnings: [],
    });
    assert.deepStrictEqual(readManifest(dir, 'payments').phases.discovery.items['data-export'],
      { routing: 'discussion', source: 'discovery', order: 1 });
    assert.strictEqual(lastMessage(dir), 'workflow(payments): reactivate data-export (discovery)');
    assert.match(render(dir, ['topic-receipt', 'payments.discovery.data-export', '--verb', 'reactivate']),
      /Reactivated "Data Export"\.\n/);
  });

  it('a started topic restores every item, re-indexes the completed artifacts, and carries the release flag back live', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'auth-flow']);
    const res = engine(dir, ['topic', 'reactivate', 'payments', 'discovery', 'auth-flow']);
    assert.deepStrictEqual(res.restored, [
      { phase: 'research', status: 'completed' },
      { phase: 'discussion', status: 'in-progress' },
    ]);
    assert.strictEqual(res.status, 'reactivated');
    // The completed research is re-indexed (no KB — a warning); the
    // in-progress discussion is not.
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /knowledge index failed/);

    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.research.items['auth-flow'], { status: 'completed' });
    assert.deepStrictEqual(m.phases.discussion.items['auth-flow'], { status: 'in-progress', reconcile_needed: 'experiment' });
    assert.deepStrictEqual(m.phases.discovery.items['auth-flow'], { routing: 'research', source: 'discovery', order: 2 });
    assert.strictEqual(m.phases.experiment.items['auth-flow'].experiments.E1.status, 'abandoned', 'the abandoned records stand on the register');
    assert.strictEqual(lastMessage(dir), 'workflow(payments): reactivate auth-flow (discovery)');
    assert.match(render(dir, ['topic-receipt', 'payments.discovery.auth-flow', '--verb', 'reactivate', '--warn']),
      /⚑ Knowledge indexing warning[\s\S]*Reactivated "Auth Flow"\. Restored research \[completed\] · discussion \[in-progress\]\./);
  });

  it('a specification returns with its plan and its build order', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'specification', 'session-model']);
    const res = engine(dir, ['topic', 'reactivate', 'payments', 'specification', 'session-model']);
    assert.deepStrictEqual(res.restored, [
      { phase: 'specification', status: 'in-progress' },
      { phase: 'planning', status: 'in-progress' },
    ]);
    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.specification.items['session-model'],
      { status: 'in-progress', order: 1, sources: { 'session-model': { status: 'incorporated' } } });
    assert.deepStrictEqual(m.phases.planning.items['session-model'], { status: 'in-progress' });
    assert.strictEqual(lastMessage(dir), 'workflow(payments): reactivate session-model (specification)');
    assert.match(render(dir, ['topic-receipt', 'payments.specification.session-model', '--verb', 'reactivate']),
      /Reactivated "Session Model"\. Restored specification \[in-progress\] · planning \[in-progress\]\./);
  });

  it('a specification stays cancelled while a source topic is cancelled — reactivate the topic first', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'specification', 'session-model']);
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'session-model']);
    const before = JSON.stringify(readManifest(dir, 'payments'));
    assert.strictEqual(engineFails(dir, ['topic', 'reactivate', 'payments', 'specification', 'session-model']).error,
      'reactivating "session-model" is refused while its source "session-model" is cancelled — reactivate the topic first');
    assert.strictEqual(JSON.stringify(readManifest(dir, 'payments')), before, 'nothing written');
    engine(dir, ['topic', 'reactivate', 'payments', 'discovery', 'session-model']);
    const res = engine(dir, ['topic', 'reactivate', 'payments', 'specification', 'session-model']);
    assert.deepStrictEqual(res.restored, [{ phase: 'specification', status: 'in-progress' }, { phase: 'planning', status: 'in-progress' }]);
    assert.deepStrictEqual(res.discarded, []);
  });

  it('a specification stays cancelled while another started specification holds its source; a proposed grouping never holds and is discarded on the return', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'specification', 'session-model']);
    const m = readManifest(dir, 'payments');
    m.phases.specification.items.other = { status: 'in-progress', sources: { 'session-model': { status: 'pending' } } };
    m.phases.specification.items.sketch = { status: 'proposed', sources: { 'session-model': { status: 'pending' } } };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    assert.strictEqual(engineFails(dir, ['topic', 'reactivate', 'payments', 'specification', 'session-model']).error,
      'reactivating "session-model" is refused while the specification "other" sources "session-model" — regroup at the specification entry');
    assert.strictEqual(readManifest(dir, 'payments').phases.specification.items.sketch.status, 'proposed', 'a refusal discards nothing');
    engine(dir, ['topic', 'cancel', 'payments', 'specification', 'other']);
    const res = engine(dir, ['topic', 'reactivate', 'payments', 'specification', 'session-model']);
    assert.deepStrictEqual(res.discarded, ['sketch']);
    const after = readManifest(dir, 'payments');
    assert.strictEqual(after.phases.specification.items.sketch, undefined, 'the proposed grouping is gone, not cancelled');
    assert.strictEqual(after.phases.specification.items.other.status, 'cancelled', 'a cancelled sibling holds nothing');
    assert.strictEqual(after.phases.specification.items['session-model'].status, 'in-progress');
  });

  it('the reactivate refusal names every unavailable source — cancelled and held alike, singular and plural', () => {
    const m = unitManifest();
    for (const topic of ['alpha', 'beta']) {
      m.phases.discovery.items[topic] = { routing: 'discussion', source: 'discovery' };
      m.phases.discussion.items[topic] = { status: 'completed' };
    }
    m.phases.specification.items.pair = { status: 'cancelled', previous_status: 'completed', sources: { alpha: { status: 'incorporated' }, beta: { status: 'incorporated' } } };
    m.phases.specification.items.other = { status: 'completed', sources: { beta: { status: 'incorporated' } } };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'alpha']);
    assert.strictEqual(engineFails(dir, ['topic', 'reactivate', 'payments', 'specification', 'pair']).error,
      'reactivating "pair" is refused while its source "alpha" is cancelled and the specification "other" sources "beta" — reactivate the topic first and regroup at the specification entry');
    engine(dir, ['topic', 'cancel', 'payments', 'specification', 'other']);
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'beta']);
    assert.strictEqual(engineFails(dir, ['topic', 'reactivate', 'payments', 'specification', 'pair']).error,
      'reactivating "pair" is refused while its sources "alpha", "beta" are cancelled — reactivate the topics first');
  });

  it('a stash-less cancelled item returns to never-attempted — the per-item cancel of a status-less item stashed nothing', () => {
    const m = unitManifest();
    m.phases.research.items.stuck = { status: 'cancelled', reconcile_needed: 'brief' };
    m.phases.discussion.items.stuck = { status: 'cancelled', previous_status: 'in-progress' };
    m.phases.specification.items.blank = { status: 'cancelled', previous_order: 3, sources: {} };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    const topic = engine(dir, ['topic', 'reactivate', 'payments', 'discovery', 'stuck']);
    assert.deepStrictEqual(topic.restored, [{ phase: 'research', status: null }, { phase: 'discussion', status: 'in-progress' }]);
    const after = readManifest(dir, 'payments');
    assert.deepStrictEqual(after.phases.research.items.stuck, { reconcile_needed: 'brief' }, 'the status is gone, the other fields stay');
    assert.strictEqual(computeTopicLifecycle(after, 'stuck').lifecycle, 'discussing');
    const spec = engine(dir, ['topic', 'reactivate', 'payments', 'specification', 'blank']);
    assert.deepStrictEqual(spec.restored, [{ phase: 'specification', status: null }]);
    assert.deepStrictEqual(readManifest(dir, 'payments').phases.specification.items.blank, { order: 3, sources: {} });
  });

  it('a legacy topic cancelled per phase reactivates every item carrying a stash', () => {
    const m = unitManifest();
    m.phases.research.items.legacy = { status: 'cancelled', previous_status: 'completed' };
    m.phases.discussion.items.legacy = { status: 'cancelled', previous_status: 'in-progress' };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    const res = engine(dir, ['topic', 'reactivate', 'payments', 'discovery', 'legacy']);
    assert.deepStrictEqual(res.restored, [
      { phase: 'research', status: 'completed' },
      { phase: 'discussion', status: 'in-progress' },
    ]);
  });

  it('refuses a unit that is not cancelled, an unknown topic, and every non-unit phase', () => {
    assert.match(engineFails(dir, ['topic', 'reactivate', 'payments', 'discovery', 'auth-flow']).error, /"auth-flow" is not cancelled \(lifecycle: discussing\)/);
    assert.match(engineFails(dir, ['topic', 'reactivate', 'payments', 'specification', 'session-model']).error, /not cancelled \(status: in-progress\)/);
    assert.match(engineFails(dir, ['topic', 'reactivate', 'payments', 'discovery', 'ghost']).error, /no topic "ghost"/);
    for (const phase of ['research', 'discussion', 'experiment', 'planning']) {
      assert.match(engineFails(dir, ['topic', 'reactivate', 'payments', phase, 'auth-flow']).error,
        /^reactivate is topic-level per stage — discovery/, phase);
    }
    assert.match(engineFails(dir, ['topic', 'reactivate', 'payments', 'discovery', 'auth-flow', 'extra']).error,
      /Usage: engine topic reactivate <work-unit> <discovery\|specification> <topic>/);
  });

  it('the receipts refuse a state the verb has not produced', () => {
    assert.match(engineFails(dir, ['render', 'topic-receipt', 'payments.discovery.auth-flow', '--verb', 'cancel']).error,
      /"auth-flow" is not cancelled — the cancel has not run/);
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'auth-flow']);
    assert.match(engineFails(dir, ['render', 'topic-receipt', 'payments.discovery.auth-flow', '--verb', 'reactivate']).error,
      /"auth-flow" is still cancelled — the reactivate has not run/);
    assert.match(engineFails(dir, ['render', 'topic-receipt', 'payments.research.auth-flow', '--verb', 'cancel']).error,
      /--verb cancel addresses a unit — <work_unit>\.discovery\.<topic> or <work_unit>\.specification\.<spec>, got phase "research"/);
  });
});

describe('engine topic start', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('creates an absent phase item with status in-progress — init-phase semantics, no commit', () => {
    const res = engine(dir, ['topic', 'start', 'payments', 'investigation', 'auth-flow']);

    assert.deepStrictEqual(res, { ok: true, topic: 'auth-flow', phase: 'investigation', status: 'in-progress', created: true });

    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.investigation.items, { 'auth-flow': { status: 'in-progress' } });
    // No commit inside — the manifest change is left for the session's cadence.
    assert.strictEqual(git(dir, ['rev-list', '--count', 'HEAD']).trim(), '1');
    assert.match(git(dir, ['status', '--porcelain']), /^ M \.workflows\/payments\/manifest\.json/m);
  });

  it('creates alongside existing items in a populated phase — siblings untouched', () => {
    const res = engine(dir, ['topic', 'start', 'payments', 'research', 'settlement']);

    assert.strictEqual(res.created, true);
    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.research.items, {
      'auth-flow': { status: 'in-progress' },
      'fee-model': { status: 'completed' },
      settlement: { status: 'in-progress' },
    });
  });

  it('resumes an existing in-progress item: created false, fields preserved', () => {
    const m0 = epicManifest();
    m0.phases.research.items['auth-flow'].note = 'keep me';
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m0, null, 2) + '\n');

    const res = engine(dir, ['topic', 'start', 'payments', 'research', 'auth-flow']);

    assert.deepStrictEqual(res, { ok: true, topic: 'auth-flow', phase: 'research', status: 'in-progress', created: false });
    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.research.items['auth-flow'], { status: 'in-progress', note: 'keep me' });
  });

  it('rejects starting a completed item — reopen owns that path', () => {
    const err = engineFails(dir, ['topic', 'start', 'payments', 'research', 'fee-model']);
    assert.match(err.error, /already completed — reopen it instead/);
  });

  it('rejects starting a cancelled item — reactivate owns that path', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'auth-flow']);
    const err = engineFails(dir, ['topic', 'start', 'payments', 'research', 'auth-flow']);
    assert.match(err.error, /is cancelled — reactivate it instead/);
  });

  it('rejects starting a superseded item — supersession is terminal, superseded_by preserved', () => {
    engine(dir, ['topic', 'supersede', 'payments', 'research', 'auth-flow', '--by', 'fee-model']);
    const err = engineFails(dir, ['topic', 'start', 'payments', 'research', 'auth-flow']);
    assert.match(err.error, /is superseded \(by "fee-model"\) — supersession is terminal/);
    // start must NOT resurrect the item — that would leave superseded_by dangling
    // on an in-progress item, a state the render layer promises never to show.
    const item = readManifest(dir, 'payments').phases.research.items['auth-flow'];
    assert.strictEqual(item.status, 'superseded');
    assert.strictEqual(item.superseded_by, 'fee-model');
  });

  it('rejects unknown work unit, phase, and missing args — loud and specific', () => {
    assert.match(engineFails(dir, ['topic', 'start', 'ghost', 'research', 'auth-flow']).error, /manifest not found/);
    assert.match(engineFails(dir, ['topic', 'start', 'payments', 'nonsense', 'auth-flow']).error, /unknown or non-lifecycle phase "nonsense"/);
    assert.match(engineFails(dir, ['topic', 'start', 'payments', 'research']).error, /Usage: engine topic start/);
    assert.match(engineFails(dir, ['topic', 'begin', 'payments', 'research', 'auth-flow']).error, /Usage: engine topic <start\|triage\|complete\|reopen\|supersede\|cancel\|reactivate\|queue\|absorb\|requeue>/);
  });

  it('flips a triaged stub to in-progress — the one exit from triaged', () => {
    engine(dir, ['topic', 'triage', 'payments', 'research', 'parked-topic']);
    const res = engine(dir, ['topic', 'start', 'payments', 'research', 'parked-topic']);

    assert.deepStrictEqual(res, { ok: true, topic: 'parked-topic', phase: 'research', status: 'in-progress', created: false });
    assert.strictEqual(readManifest(dir, 'payments').phases.research.items['parked-topic'].status, 'in-progress');
  });
});

describe('engine topic triage', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('creates an absent phase item with status triaged — no commit', () => {
    const res = engine(dir, ['topic', 'triage', 'payments', 'discussion', 'edge-cases']);

    assert.deepStrictEqual(res, { ok: true, topic: 'edge-cases', phase: 'discussion', status: 'triaged', created: true, status_before: null });
    assert.strictEqual(engine.lastSections, '', 'triage appends no sections');

    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.discussion.items['edge-cases'], { status: 'triaged' });
    // No commit inside — the calling flow commits the artefact append alongside.
    assert.strictEqual(git(dir, ['rev-list', '--count', 'HEAD']).trim(), '1');
    assert.match(git(dir, ['status', '--porcelain']), /^ M \.workflows\/payments\/manifest\.json/m);
  });

  it('delivery form: installs the concern in the sidecar, self-commits concern + manifest only', () => {
    writeFile(dir, '.workflows/payments/discussion/refund-policy.md', '# Peer topic\ndirty peer content\n');
    const scratch = path.join(dir, '.workflows/.cache/scratch/concern-scratch.md');
    writeFile(dir, '.workflows/.cache/scratch/concern-scratch.md', '### Rate limits\n*From: refund-policy · discussion · 2026-07-31*\n\nFull context.\n');

    const res = engine(dir, ['topic', 'triage', 'payments', 'discussion', 'edge-cases',
      '--concern', '.workflows/.cache/scratch/concern-scratch.md', '--slug', 'rate-limits', '-m', 'discussion(payments/refund-policy): reroute concern to edge-cases']);

    assert.strictEqual(res.created, true);
    assert.strictEqual(res.status, 'triaged');
    assert.strictEqual(res.concern_path, '.workflows/payments/discussion/.triage/edge-cases/001-rate-limits.md');
    assert.match(res.committed, /^[0-9a-f]+$/);
    assert.deepStrictEqual(res.warnings, []);
    const installed = fs.readFileSync(path.join(dir, res.concern_path), 'utf8');
    assert.match(installed, /### Rate limits/);
    assert.ok(!fs.existsSync(scratch), 'scratch concern file consumed');
    const show = git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').sort();
    assert.deepStrictEqual(show, [
      '.workflows/payments/discussion/.triage/edge-cases/001-rate-limits.md',
      '.workflows/payments/manifest.json',
    ], 'commit confined to concern + manifest');
    assert.match(git(dir, ['status', '--porcelain']), /discussion\/refund-policy\.md/, 'peer dirt untouched');
  });

  it('delivery form: numbers concerns sequentially and never collides', () => {
    for (const slug of ['first', 'second']) {
      writeFile(dir, '.workflows/.cache/scratch/c.md', `### ${slug}\n*From: x · discussion · d*\n\nBody.\n`);
      engine(dir, ['topic', 'triage', 'payments', 'discussion', 'edge-cases',
        '--concern', '.workflows/.cache/scratch/c.md', '--slug', slug, '-m', `discussion(payments/x): reroute concern to edge-cases`]);
    }
    const files = fs.readdirSync(path.join(dir, '.workflows/payments/discussion/.triage/edge-cases')).sort();
    assert.deepStrictEqual(files, ['001-first.md', '002-second.md']);
  });

  it('delivery form: refuses a missing or empty concern file, a bad slug, a missing message — nothing written', () => {
    assert.match(engineFails(dir, ['topic', 'triage', 'payments', 'discussion', 'edge-cases',
      '--concern', '.workflows/.cache/scratch/absent.md', '--slug', 'ok-slug', '-m', 'msg']).error, /concern file not found/);
    writeFile(dir, '.workflows/.cache/scratch/empty.md', '  \n');
    assert.match(engineFails(dir, ['topic', 'triage', 'payments', 'discussion', 'edge-cases',
      '--concern', '.workflows/.cache/scratch/empty.md', '--slug', 'ok-slug', '-m', 'msg']).error, /concern file is empty/);
    writeFile(dir, '.workflows/.cache/scratch/c.md', 'content\n');
    assert.match(engineFails(dir, ['topic', 'triage', 'payments', 'discussion', 'edge-cases',
      '--concern', '.workflows/.cache/scratch/c.md', '--slug', 'Bad_Slug', '-m', 'msg']).error, /kebab-case/);
    assert.match(engineFails(dir, ['topic', 'triage', 'payments', 'discussion', 'edge-cases',
      '--concern', '.workflows/.cache/scratch/c.md', '--slug', 'ok-slug']).error, /Usage/);
    assert.strictEqual(readManifest(dir, 'payments').phases.discussion.items['edge-cases'], undefined, 'no item conjured');
    assert.ok(!fs.existsSync(path.join(dir, '.workflows/payments/discussion/.triage')), 'no sidecar conjured');
  });

  it('hardening: refuses a concern path outside .workflows/.cache — a live artifact is never consumed', () => {
    writeFile(dir, '.workflows/payments/research/live.md', '# Live artifact\n');
    assert.match(engineFails(dir, ['topic', 'triage', 'payments', 'research', 'edge-cases',
      '--concern', '.workflows/payments/research/live.md', '--slug', 'oops', '-m', 'msg']).error, /must point inside \.workflows\/\.cache/);
    assert.ok(fs.existsSync(path.join(dir, '.workflows/payments/research/live.md')), 'live artifact untouched');
    assert.match(engineFails(dir, ['topic', 'triage', 'payments', 'research', 'edge-cases',
      '--concern', '../outside.md', '--slug', 'oops', '-m', 'msg']).error, /must point inside \.workflows\/\.cache/);
  });

  it('hardening: refuses traversal in topic names — triage, queue, presence', () => {
    writeFile(dir, '.workflows/.cache/scratch/c.md', 'content\n');
    assert.match(engineFails(dir, ['topic', 'triage', 'payments', 'discussion', '../../../evil',
      '--concern', '.workflows/.cache/scratch/c.md', '--slug', 'x', '-m', 'msg']).error, /invalid topic name/);
    assert.match(engineFails(dir, ['topic', 'queue', 'payments', 'discussion', '../evil']).error, /invalid topic name/);
    assert.ok(!fs.existsSync(path.join(dir, '.workflows/evil')), 'nothing escaped');
  });

  it('hardening: a research landing never clobbers a pending brief-reconcile flag', () => {
    const m = readManifest(dir, 'payments');
    m.phases.discussion.items['session-model'].reconcile_needed = true;
    fs.writeFileSync(path.join(dir, '.workflows/payments/manifest.json'), JSON.stringify(m, null, 2) + '\n');
    writeFile(dir, '.workflows/.cache/scratch/c.md', '### Q\n*From: x · discussion · d*\n\nBody.\n');

    const res = engine(dir, ['topic', 'triage', 'payments', 'research', 'session-model',
      '--concern', '.workflows/.cache/scratch/c.md', '--slug', 'q', '-m', 'msg']);

    assert.strictEqual(res.reconcile_flagged, undefined);
    assert.strictEqual(readManifest(dir, 'payments').phases.discussion.items['session-model'].reconcile_needed, true, 'brief flag preserved');
  });

  it('delivery form: a terminal target refuses before the concern is consumed', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'refund-policy']);
    writeFile(dir, '.workflows/.cache/scratch/c.md', 'content\n');
    assert.match(engineFails(dir, ['topic', 'triage', 'payments', 'discussion', 'refund-policy',
      '--concern', '.workflows/.cache/scratch/c.md', '--slug', 'ok-slug', '-m', 'msg']).error, /cancelled/);
    assert.ok(fs.existsSync(path.join(dir, '.workflows/.cache/scratch/c.md')), 'scratch concern preserved on refusal');
  });

  it('research-side delivery beneath a completed discussion flags it for reconciliation', () => {
    writeFile(dir, '.workflows/.cache/scratch/c.md', '### Q\n*From: x · discussion · d*\n\nBody.\n');
    const res = engine(dir, ['topic', 'triage', 'payments', 'research', 'session-model',
      '--concern', '.workflows/.cache/scratch/c.md', '--slug', 'open-question', '-m', 'discussion(payments/x): reroute concern to session-model']);

    assert.strictEqual(res.reconcile_flagged, true);
    const m = readManifest(dir, 'payments');
    assert.strictEqual(m.phases.discussion.items['session-model'].reconcile_needed, 'research');
    assert.strictEqual(m.phases.discussion.items['session-model'].status, 'completed', 'the discussion itself is not reopened');
    assert.strictEqual(m.phases.research.items['session-model'].status, 'triaged', 'the research item parks the concern');
  });

  it('discussion-side delivery beneath a spec-sourced discussion flags the spec and stales the row', () => {
    const m = epicManifest();
    m.phases.specification = { items: {
      unified: { status: 'completed', sources: { 'session-model': { status: 'incorporated' } } },
    } };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    writeFile(dir, '.workflows/.cache/scratch/c.md', 'content\n');

    const res = engine(dir, ['topic', 'triage', 'payments', 'discussion', 'session-model',
      '--concern', '.workflows/.cache/scratch/c.md', '--slug', 'shifted-ground', '-m', 'm']);

    assert.strictEqual(res.reopened, true, 'the landing reopens the discussion');
    assert.strictEqual(res.reconcile_flagged, true);
    assert.deepStrictEqual(res.sources_staled, ['unified']);
    const items = readManifest(dir, 'payments').phases.specification.items;
    assert.strictEqual(items.unified.reconcile_needed, 'discussion');
    assert.strictEqual(items.unified.sources['session-model'].status, 'stale');
  });

  it('no reconcile flag for a discussion-side delivery — its downstream is the spec join', () => {
    writeFile(dir, '.workflows/.cache/scratch/c.md', 'content\n');
    const disc = engine(dir, ['topic', 'triage', 'payments', 'discussion', 'session-model',
      '--concern', '.workflows/.cache/scratch/c.md', '--slug', 'a-decision', '-m', 'm']);
    assert.strictEqual(disc.reconcile_flagged, undefined);
  });

  it('research-side delivery beneath a live discussion flags it — research feeds discussion', () => {
    writeFile(dir, '.workflows/.cache/scratch/c.md', 'content\n');
    const live = engine(dir, ['topic', 'triage', 'payments', 'research', 'refund-policy',
      '--concern', '.workflows/.cache/scratch/c.md', '--slug', 'open-q', '-m', 'm']);
    assert.strictEqual(live.reconcile_flagged, true);
    const m = readManifest(dir, 'payments');
    assert.strictEqual(m.phases.discussion.items['refund-policy'].reconcile_needed, 'research');
    assert.strictEqual(m.phases.discussion.items['refund-policy'].status, 'in-progress', 'the discussion stays in flight — the flag says why it cannot conclude');
    assert.strictEqual(m.phases.research.items['refund-policy'].status, 'triaged', 'the research item parks the concern');
  });

  it('queue read: empty for a missing directory, lists delivered concerns sorted, refuses illegal phases', () => {
    const empty = engine(dir, ['topic', 'queue', 'payments', 'discussion', 'edge-cases']);
    assert.deepStrictEqual(empty, { ok: true, work_unit: 'payments', phase: 'discussion', topic: 'edge-cases', count: 0, files: [] });

    for (const slug of ['first', 'second']) {
      writeFile(dir, '.workflows/.cache/scratch/c.md', `### ${slug}\n*From: x · discussion · d*\n\nBody.\n`);
      engine(dir, ['topic', 'triage', 'payments', 'discussion', 'edge-cases',
        '--concern', '.workflows/.cache/scratch/c.md', '--slug', slug, '-m', 'discussion(payments/x): reroute concern to edge-cases']);
    }
    const two = engine(dir, ['topic', 'queue', 'payments', 'discussion', 'edge-cases']);
    assert.strictEqual(two.count, 2);
    assert.deepStrictEqual(two.files, [
      '.workflows/payments/discussion/.triage/edge-cases/001-first.md',
      '.workflows/payments/discussion/.triage/edge-cases/002-second.md',
    ]);

    fs.mkdirSync(path.join(dir, '.workflows/payments/discussion/.triage/edge-cases/dir.md'), { recursive: true });
    const withDir = engine(dir, ['topic', 'queue', 'payments', 'discussion', 'edge-cases']);
    assert.strictEqual(withDir.count, 2, 'a directory named *.md is not a concern');

    assert.match(engineFails(dir, ['topic', 'queue', 'payments', 'planning', 'edge-cases']).error, /research\|discussion\|investigation only/);
    assert.match(engineFails(dir, ['topic', 'queue', 'ghost', 'discussion', 'edge-cases']).error, /no work unit directory/);
    assert.match(engineFails(dir, ['topic', 'queue', 'payments', 'discussion']).error, /Usage/);
  });

  it('is idempotent — a second call on a triaged stub is a no-op', () => {
    engine(dir, ['topic', 'triage', 'payments', 'research', 'edge-cases']);
    const res = engine(dir, ['topic', 'triage', 'payments', 'research', 'edge-cases']);

    assert.deepStrictEqual(res, { ok: true, topic: 'edge-cases', phase: 'research', status: 'triaged', created: false, status_before: 'triaged' });
    assert.deepStrictEqual(readManifest(dir, 'payments').phases.research.items['edge-cases'], { status: 'triaged' });
  });

  it('leaves an in-progress item untouched — never backwards', () => {
    const res = engine(dir, ['topic', 'triage', 'payments', 'research', 'auth-flow']);

    assert.deepStrictEqual(res, { ok: true, topic: 'auth-flow', phase: 'research', status: 'in-progress', created: false, status_before: 'in-progress' });
    assert.strictEqual(readManifest(dir, 'payments').phases.research.items['auth-flow'].status, 'in-progress');
  });

  it('reopens a completed item to in-progress — never land an entry in a concluded artefact', () => {
    const res = engine(dir, ['topic', 'triage', 'payments', 'discussion', 'session-model']);

    assert.deepStrictEqual(res, { ok: true, topic: 'session-model', phase: 'discussion', status: 'in-progress', created: false, status_before: 'completed', reopened: true });
    assert.strictEqual(readManifest(dir, 'payments').phases.discussion.items['session-model'].status, 'in-progress');
  });

  it('a bare reopen of a completed discussion hops like reopen — no completed→in-progress transition skips it', () => {
    const m = epicManifest();
    m.phases.specification = { items: {
      unified: { status: 'completed', sources: { 'session-model': { status: 'incorporated' } } },
    } };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');

    const res = engine(dir, ['topic', 'triage', 'payments', 'discussion', 'session-model']);

    assert.strictEqual(res.reopened, true);
    assert.strictEqual(res.reconcile_flagged, true);
    assert.deepStrictEqual(res.sources_staled, ['unified']);
    const items = readManifest(dir, 'payments').phases.specification.items;
    assert.strictEqual(items.unified.reconcile_needed, 'discussion');
    assert.strictEqual(items.unified.sources['session-model'].status, 'stale');
  });

  it('a bare call that does not reopen never hops — parking and idempotent re-parks stay hop-free', () => {
    const m = epicManifest();
    m.phases.specification = { items: {
      unified: { status: 'completed', sources: { 'refund-policy': { status: 'incorporated' } } },
    } };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');

    // refund-policy's discussion is in-progress — the bare call leaves it
    // untouched and must not stale the spec.
    const res = engine(dir, ['topic', 'triage', 'payments', 'discussion', 'refund-policy']);

    assert.strictEqual(res.reopened, undefined);
    assert.strictEqual(res.reconcile_flagged, undefined);
    assert.strictEqual(readManifest(dir, 'payments').phases.specification.items.unified.sources['refund-policy'].status, 'incorporated');
  });

  it('refuses a closed map row before the item is touched; off the map, a cancelled or superseded item refuses with the start messages', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'auth-flow']);
    for (const phase of ['research', 'discussion']) {
      assert.strictEqual(engineFails(dir, ['topic', 'triage', 'payments', phase, 'auth-flow']).error,
        '"auth-flow" is cancelled — reactivate it from the epic menu first', phase);
    }
    assert.strictEqual(readManifest(dir, 'payments').phases.discussion.items['auth-flow'], undefined, 'nothing born under a cancelled row');

    const m = readManifest(dir, 'payments');
    m.phases.discovery.items['dead-lead'] = { routing: 'research', source: 'discovery', handled: true };
    m.phases.research.items['dead-lead'] = { status: 'completed' };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    assert.strictEqual(engineFails(dir, ['topic', 'triage', 'payments', 'research', 'dead-lead']).error,
      '"dead-lead" is closed as a dead end — reopen it in discovery first');
    assert.strictEqual(readManifest(dir, 'payments').phases.research.items['dead-lead'].status, 'completed', 'the dead end is not reopened underneath');

    // session-model has no map row — the item's own refusal stands.
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'session-model']);
    assert.match(engineFails(dir, ['topic', 'triage', 'payments', 'discussion', 'session-model']).error, /discussion item "session-model" is cancelled — reactivate it instead/);

    engine(dir, ['topic', 'supersede', 'payments', 'research', 'fee-model', '--by', 'auth-flow']);
    assert.match(engineFails(dir, ['topic', 'triage', 'payments', 'research', 'fee-model']).error, /is superseded \(by "auth-flow"\) — supersession is terminal/);
  });

  it('heals a status-less item to triaged — fields preserved, manifest saved', () => {
    const m0 = epicManifest();
    m0.phases.research.items['half-written'] = { reconcile_needed: true };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m0, null, 2) + '\n');

    const res = engine(dir, ['topic', 'triage', 'payments', 'research', 'half-written']);

    assert.deepStrictEqual(res, { ok: true, topic: 'half-written', phase: 'research', status: 'triaged', created: false, status_before: null });
    assert.deepStrictEqual(readManifest(dir, 'payments').phases.research.items['half-written'],
      { reconcile_needed: true, status: 'triaged' });
  });

  it('refuses phases whose vocabulary lacks triaged — schema-driven', () => {
    const err = engineFails(dir, ['topic', 'triage', 'payments', 'planning', 'auth-flow']);
    assert.match(err.error, /Invalid status "triaged" for phase "planning"/);
    // Nothing created on the refused path.
    assert.strictEqual(readManifest(dir, 'payments').phases.planning, undefined);
  });
});

describe('engine topic requeue', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  /** Land one concern in a topic's queue via the delivery form. */
  function land(phase, topic, slug) {
    writeFile(dir, '.workflows/.cache/scratch/c.md', `### ${slug}\n*From: x · discussion · d*\n\nBody of ${slug}.\n`);
    return engine(dir, ['topic', 'triage', 'payments', phase, topic,
      '--concern', '.workflows/.cache/scratch/c.md', '--slug', slug, '-m', `land ${slug}`]);
  }

  it('moves the concern to the other phase-side: dest item parked, file renumbered, stub removed, action-scoped commit', () => {
    land('research', 'edge-cases', 'a-decision-owed');
    writeFile(dir, '.workflows/payments/research/auth-flow.md', 'dirty peer\n');

    const res = engine(dir, ['topic', 'requeue', 'payments', 'research', 'discussion', 'edge-cases',
      '--file', '001-a-decision-owed.md', '-m', 'research(payments/edge-cases): requeue 001-a-decision-owed to discussion']);

    assert.strictEqual(res.from_phase, 'research');
    assert.strictEqual(res.to_phase, 'discussion');
    assert.strictEqual(res.moved, '001-a-decision-owed.md');
    assert.strictEqual(res.concern_path, '.workflows/payments/discussion/.triage/edge-cases/001-a-decision-owed.md');
    assert.strictEqual(res.remaining, 0);
    assert.strictEqual(res.status, 'triaged');
    assert.strictEqual(res.created, true);
    assert.strictEqual(res.source_item_removed, true);
    assert.match(res.committed, /^[0-9a-f]+$/);

    const m = readManifest(dir, 'payments');
    assert.strictEqual(m.phases.research.items['edge-cases'], undefined, 'the emptied parked stub is removed');
    assert.deepStrictEqual(m.phases.discussion.items['edge-cases'], { status: 'triaged' });
    assert.match(fs.readFileSync(path.join(dir, res.concern_path), 'utf8'), /Body of a-decision-owed/);
    assert.ok(!fs.existsSync(path.join(dir, '.workflows/payments/research/.triage/edge-cases/001-a-decision-owed.md')), 'source file gone');
    const show = git(dir, ['show', '--name-only', '--no-renames', '--pretty=format:', 'HEAD']).trim().split('\n').sort();
    assert.deepStrictEqual(show, [
      '.workflows/payments/discussion/.triage/edge-cases/001-a-decision-owed.md',
      '.workflows/payments/manifest.json',
      '.workflows/payments/research/.triage/edge-cases/001-a-decision-owed.md',
    ], 'commit confined to the two queue paths + manifest');
    assert.match(git(dir, ['status', '--porcelain', '-uall']), /research\/auth-flow\.md/, 'peer dirt untouched');
    assert.strictEqual(lastMessage(dir), 'research(payments/edge-cases): requeue 001-a-decision-owed to discussion');
  });

  it('renumbers into the destination queue behind existing entries', () => {
    land('discussion', 'edge-cases', 'already-queued');
    land('research', 'edge-cases', 'a-decision-owed');

    const res = engine(dir, ['topic', 'requeue', 'payments', 'research', 'discussion', 'edge-cases',
      '--file', '001-a-decision-owed.md', '-m', 'm']);

    assert.strictEqual(res.concern_path, '.workflows/payments/discussion/.triage/edge-cases/002-a-decision-owed.md');
    assert.deepStrictEqual(fs.readdirSync(path.join(dir, '.workflows/payments/discussion/.triage/edge-cases')).sort(),
      ['001-already-queued.md', '002-a-decision-owed.md']);
  });

  it('leaves an in-progress source item alone, and a still-populated triaged source stub in place', () => {
    land('research', 'auth-flow', 'a-decision-owed');
    const live = engine(dir, ['topic', 'requeue', 'payments', 'research', 'discussion', 'auth-flow',
      '--file', '001-a-decision-owed.md', '-m', 'm']);
    assert.strictEqual(live.source_item_removed, undefined);
    assert.strictEqual(readManifest(dir, 'payments').phases.research.items['auth-flow'].status, 'in-progress');

    land('research', 'edge-cases', 'first');
    land('research', 'edge-cases', 'second');
    const partial = engine(dir, ['topic', 'requeue', 'payments', 'research', 'discussion', 'edge-cases',
      '--file', '001-first.md', '-m', 'm']);
    assert.strictEqual(partial.remaining, 1);
    assert.strictEqual(partial.source_item_removed, undefined);
    assert.strictEqual(readManifest(dir, 'payments').phases.research.items['edge-cases'].status, 'triaged', 'a stub with entries left keeps parking them');
  });

  it('a completed destination reopens and hops — the same staleness a triage delivery lands', () => {
    const m = epicManifest();
    m.phases.specification = { items: {
      unified: { status: 'completed', sources: { 'session-model': { status: 'incorporated' } } },
    } };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    land('research', 'session-model', 'a-decision-owed');

    const res = engine(dir, ['topic', 'requeue', 'payments', 'research', 'discussion', 'session-model',
      '--file', '001-a-decision-owed.md', '-m', 'm']);

    assert.strictEqual(res.reopened, true);
    assert.strictEqual(res.status, 'in-progress');
    assert.strictEqual(res.reconcile_flagged, true);
    assert.deepStrictEqual(res.sources_staled, ['unified']);
    const items = readManifest(dir, 'payments').phases.specification.items;
    assert.strictEqual(items.unified.reconcile_needed, 'discussion');
    assert.strictEqual(items.unified.sources['session-model'].status, 'stale');
  });

  it('moves discussion-side concerns to research too', () => {
    land('discussion', 'refund-policy', 'an-open-question');

    const res = engine(dir, ['topic', 'requeue', 'payments', 'discussion', 'research', 'refund-policy',
      '--file', '001-an-open-question.md', '-m', 'm']);

    assert.strictEqual(res.to_phase, 'research');
    assert.strictEqual(res.concern_path, '.workflows/payments/research/.triage/refund-policy/001-an-open-question.md');
    assert.strictEqual(readManifest(dir, 'payments').phases.research.items['refund-policy'].status, 'triaged');
    assert.strictEqual(readManifest(dir, 'payments').phases.discussion.items['refund-policy'].status, 'in-progress', 'source discussion untouched');
  });

  it('refuses anything outside the research↔discussion pair, a path for --file, and a file not in the queue — nothing written', () => {
    land('research', 'edge-cases', 'a-decision-owed');

    assert.match(engineFails(dir, ['topic', 'requeue', 'payments', 'research', 'research', 'edge-cases',
      '--file', '001-a-decision-owed.md', '-m', 'm']).error, /other phase-side/);
    assert.match(engineFails(dir, ['topic', 'requeue', 'payments', 'research', 'investigation', 'edge-cases',
      '--file', '001-a-decision-owed.md', '-m', 'm']).error, /other phase-side/);
    assert.match(engineFails(dir, ['topic', 'requeue', 'payments', 'planning', 'discussion', 'edge-cases',
      '--file', '001-a-decision-owed.md', '-m', 'm']).error, /other phase-side/);
    assert.match(engineFails(dir, ['topic', 'requeue', 'payments', 'research', 'discussion', 'edge-cases',
      '--file', 'sub/001-a-decision-owed.md', '-m', 'm']).error, /queue-file name, not a path/);
    assert.match(engineFails(dir, ['topic', 'requeue', 'payments', 'research', 'discussion', 'edge-cases',
      '--file', '009-ghost.md', '-m', 'm']).error, /not in the edge-cases research triage queue/);
    assert.match(engineFails(dir, ['topic', 'requeue', 'payments', 'research', 'discussion', 'edge-cases',
      '--file', '001-a-decision-owed.md']).error, /Usage/);

    assert.ok(fs.existsSync(path.join(dir, '.workflows/payments/research/.triage/edge-cases/001-a-decision-owed.md')), 'queue untouched on every refusal');
    assert.strictEqual(readManifest(dir, 'payments').phases.discussion.items['edge-cases'], undefined, 'no destination item conjured');
  });

  it('a terminal destination refuses before the file moves', () => {
    land('research', 'session-model', 'a-decision-owed');
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'session-model']);

    assert.match(engineFails(dir, ['topic', 'requeue', 'payments', 'research', 'discussion', 'session-model',
      '--file', '001-a-decision-owed.md', '-m', 'm']).error, /is cancelled — reactivate it instead/);
    assert.ok(fs.existsSync(path.join(dir, '.workflows/payments/research/.triage/session-model/001-a-decision-owed.md')), 'concern still queued at the source');
  });
});

describe('triaged guards across the other verbs', () => {
  let dir;
  beforeEach(() => {
    dir = setupEpicFixture();
    engine(dir, ['topic', 'triage', 'payments', 'research', 'parked-topic']);
  });
  afterEach(() => { cleanupFixture(dir); });

  it('complete refuses a triaged stub — parked concerns must never bury as completed', () => {
    const err = engineFails(dir, ['topic', 'complete', 'payments', 'research', 'parked-topic']);
    assert.match(err.error, /is triaged — parked concerns have never been worked; start the topic first/);
    assert.strictEqual(readManifest(dir, 'payments').phases.research.items['parked-topic'].status, 'triaged');
  });

  it('supersede refuses a triaged stub', () => {
    const err = engineFails(dir, ['topic', 'supersede', 'payments', 'research', 'parked-topic', '--by', 'fee-model']);
    assert.match(err.error, /is triaged — parked concerns have never been worked; start the topic to drain them first/);
    assert.strictEqual(readManifest(dir, 'payments').phases.research.items['parked-topic'].status, 'triaged');
  });

  it('supersede refuses a triaged stub as the absorbing --by target — lineage must point at worked topics', () => {
    const err = engineFails(dir, ['topic', 'supersede', 'payments', 'research', 'fee-model', '--by', 'parked-topic']);
    assert.match(err.error, /"parked-topic" is triaged — a stub of parked concerns cannot absorb other topics; start it first/);
    // Nothing mutated, no KB removal path taken.
    const m = readManifest(dir, 'payments');
    assert.strictEqual(m.phases.research.items['fee-model'].status, 'completed');
    assert.strictEqual(m.phases.research.items['parked-topic'].status, 'triaged');
  });

  it('reopen refuses a triaged stub with the existing not-completed message', () => {
    const err = engineFails(dir, ['topic', 'reopen', 'payments', 'research', 'parked-topic']);
    assert.match(err.error, /is not completed \(status: triaged\) — only a completed item can be reopened/);
  });

  it('a topic cancel stashes triaged as previous_status; reactivate restores it', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'parked-topic']);
    const cancelled = readManifest(dir, 'payments').phases.research.items['parked-topic'];
    assert.strictEqual(cancelled.status, 'cancelled');
    assert.strictEqual(cancelled.previous_status, 'triaged');

    const res = engine(dir, ['topic', 'reactivate', 'payments', 'discovery', 'parked-topic']);
    assert.deepStrictEqual(res.restored, [{ phase: 'research', status: 'triaged' }]);
    assert.deepStrictEqual(readManifest(dir, 'payments').phases.research.items['parked-topic'], { status: 'triaged' });
  });
});

describe('pipeline completion banner matrix', () => {
  const { workunitReceipt } = require('../../skills/workflow-engine/scripts/domain/projections/transactions.cjs');
  const banner = (wt, opts) => workunitReceipt('complete', 'pay-x', wt, { pipeline: true, ...opts });

  it('every work-type label and both body variants render', () => {
    assert.ok(banner('feature').includes('Feature Completed\n\n"Pay X" has completed all pipeline phases.'));
    assert.ok(banner('bugfix').includes('Bugfix Completed\n\n"Pay X" has completed all pipeline phases.'));
    assert.ok(banner('quick-fix').includes('Quick-Fix Completed\n\n"Pay X" has completed all pipeline phases.'));
    assert.ok(banner('cross-cutting').includes('Cross-Cutting Completed\n\n"Pay X" has completed all pipeline phases.'));
    assert.ok(banner('epic').includes('Epic Completed\n\n"Pay X" has completed all topics through review.'));
    assert.ok(banner('epic', { skippedReview: true }).includes('Epic Completed\n\n"Pay X" completed — review skipped.'));
  });
});

describe('topic verbs without section folds', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('every topic verb appends nothing — receipts are render surfaces', () => {
    engine(dir, ['topic', 'start', 'payments', 'research', 'brand-new']);
    assert.strictEqual(engine.lastSections, '', 'start appends no sections');
    engine(dir, ['topic', 'reopen', 'payments', 'research', 'fee-model']);
    assert.strictEqual(engine.lastSections, '', 'reopen appends no sections');
    engine(dir, ['topic', 'supersede', 'payments', 'research', 'fee-model', '--by', 'auth-flow']);
    assert.strictEqual(engine.lastSections, '', 'supersede appends no sections — its removal warning stays in the JSON');
  });
});

describe('engine topic complete', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('completes an indexed-phase item and KB-indexes it — failure is a warning, no commit', () => {
    const res = engine(dir, ['topic', 'complete', 'payments', 'research', 'auth-flow']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.topic, 'auth-flow');
    assert.strictEqual(res.phase, 'research');
    assert.strictEqual(res.status, 'completed');
    // No KB configured in the fixture — warn-don't-block.
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /knowledge index failed/);
    assert.strictEqual(engine.lastSections, '', 'transactions answer with pure JSON');
    const advisory = render(dir, ['topic-receipt', 'payments.research.auth-flow', '--verb', 'complete', '--warn']);
    assert.match(advisory, /=== DISPLAY: kb warning \(emit verbatim as a code block — do not stop; continue as the workflow instructs\) ===\n  ⚑ Knowledge indexing warning\n    The artifact is saved\. Indexing can be retried later\./);
    assert.ok(!advisory.includes('confirmation ==='), 'complete renders the advisory only — the flow owns its conclusion display');
    assert.strictEqual(render(dir, ['topic-receipt', 'payments.research.auth-flow', '--verb', 'complete']), '',
      'no --warn, no advisory — an empty receipt');

    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.research.items, {
      'auth-flow': { status: 'completed' },
      'fee-model': { status: 'completed' },
    });
    // No commit inside.
    assert.strictEqual(git(dir, ['rev-list', '--count', 'HEAD']).trim(), '1');
    assert.match(git(dir, ['status', '--porcelain']), /^ M \.workflows\/payments\/manifest\.json/m);
  });

  it('completes a non-indexed phase with no KB attempt — empty warnings', () => {
    const m0 = epicManifest();
    m0.phases.scoping = { items: { 'auth-flow': { status: 'in-progress' }, 'fee-model': { status: 'in-progress' } } };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m0, null, 2) + '\n');

    const res = engine(dir, ['topic', 'complete', 'payments', 'scoping', 'fee-model']);

    assert.deepStrictEqual(res, { ok: true, topic: 'fee-model', phase: 'scoping', status: 'completed', warnings: [] });
    assert.strictEqual(engine.lastSections, '', 'no warnings — no sections');
    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.scoping.items, {
      'auth-flow': { status: 'in-progress' },
      'fee-model': { status: 'completed' },
    });
  });

  it('is idempotent on an already-completed item — mirrors the manifest set it replaces', () => {
    engine(dir, ['topic', 'complete', 'payments', 'discussion', 'refund-policy']);
    const res = engine(dir, ['topic', 'complete', 'payments', 'discussion', 'refund-policy']);
    assert.strictEqual(res.status, 'completed');
  });

  it('rejects completing a non-existent item, unknown phase, and a cancelled item', () => {
    assert.match(engineFails(dir, ['topic', 'complete', 'payments', 'research', 'ghost']).error, /no research item "ghost"/);
    assert.match(engineFails(dir, ['topic', 'complete', 'payments', 'investigation', 'auth-flow']).error, /no investigation items/);
    assert.match(engineFails(dir, ['topic', 'complete', 'payments', 'nonsense', 'auth-flow']).error, /unknown or non-lifecycle phase "nonsense"/);
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'auth-flow']);
    assert.match(engineFails(dir, ['topic', 'complete', 'payments', 'research', 'auth-flow']).error, /is cancelled — reactivate it instead/);
    assert.match(engineFails(dir, ['topic', 'complete', 'payments']).error, /Usage: engine topic complete/);
  });

  it('rejects completing a superseded item — supersession is terminal, superseded_by preserved', () => {
    engine(dir, ['topic', 'supersede', 'payments', 'research', 'auth-flow', '--by', 'fee-model']);
    const err = engineFails(dir, ['topic', 'complete', 'payments', 'research', 'auth-flow']);
    assert.match(err.error, /is superseded \(by "fee-model"\) — supersession is terminal/);
    // complete must NOT overwrite the terminal status and leave superseded_by
    // dangling on a completed item.
    const item = readManifest(dir, 'payments').phases.research.items['auth-flow'];
    assert.strictEqual(item.status, 'superseded');
    assert.strictEqual(item.superseded_by, 'fee-model');
  });

  it('round-trips with start: start → complete → resuming via start is still rejected', () => {
    engine(dir, ['topic', 'start', 'payments', 'investigation', 'auth-flow']);
    const res = engine(dir, ['topic', 'complete', 'payments', 'investigation', 'auth-flow']);
    assert.strictEqual(res.status, 'completed');
    assert.strictEqual(res.warnings.length, 1);
    const err = engineFails(dir, ['topic', 'start', 'payments', 'investigation', 'auth-flow']);
    assert.match(err.error, /already completed/);
  });
});

describe('engine topic reopen', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('sets a completed item back to in-progress — no KB attempt, no commit', () => {
    const res = engine(dir, ['topic', 'reopen', 'payments', 'research', 'fee-model']);

    assert.deepStrictEqual(res, { ok: true, topic: 'fee-model', phase: 'research', status: 'in-progress' });

    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.research.items, {
      'auth-flow': { status: 'in-progress' },
      'fee-model': { status: 'in-progress' },
    });
    // No commit inside — the manifest change is left for the session's cadence.
    assert.strictEqual(git(dir, ['rev-list', '--count', 'HEAD']).trim(), '1');
    assert.match(git(dir, ['status', '--porcelain']), /^ M \.workflows\/payments\/manifest\.json/m);
  });

  it('round-trips with complete: reopen → complete → reopen again', () => {
    engine(dir, ['topic', 'reopen', 'payments', 'discussion', 'session-model']);
    engine(dir, ['topic', 'complete', 'payments', 'discussion', 'session-model']);
    const res = engine(dir, ['topic', 'reopen', 'payments', 'discussion', 'session-model']);
    assert.strictEqual(res.status, 'in-progress');
  });

  it('flags the same-named completed discussion when research reopens — the downstream hop', () => {
    const m = epicManifest();
    m.phases.discussion.items['fee-model'] = { status: 'completed' };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');

    const res = engine(dir, ['topic', 'reopen', 'payments', 'research', 'fee-model']);

    assert.deepStrictEqual(res.reconcile_flagged, [{ phase: 'discussion', topic: 'fee-model' }]);
    const after = readManifest(dir, 'payments');
    assert.strictEqual(after.phases.discussion.items['fee-model'].reconcile_needed, 'research');
    assert.strictEqual(after.phases.discussion.items['fee-model'].status, 'completed', 'the discussion itself is not reopened');
  });

  it('flags an in-progress discussion too when research reopens — the one hop that reaches a live neighbour', () => {
    const m = epicManifest();
    m.phases.discussion.items['fee-model'] = { status: 'in-progress' };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');

    const res = engine(dir, ['topic', 'reopen', 'payments', 'research', 'fee-model']);

    assert.deepStrictEqual(res.reconcile_flagged, [{ phase: 'discussion', topic: 'fee-model' }]);
    assert.strictEqual(readManifest(dir, 'payments').phases.discussion.items['fee-model'].reconcile_needed, 'research');
  });

  it('every other hop flags completed items only — a specification reopen leaves an in-progress plan alone', () => {
    const m = epicManifest();
    m.phases.specification = { items: { 'fee-model': { status: 'completed' } } };
    m.phases.planning = { items: { 'fee-model': { status: 'in-progress' } } };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');

    const res = engine(dir, ['topic', 'reopen', 'payments', 'specification', 'fee-model']);

    assert.strictEqual(res.reconcile_flagged, undefined);
    assert.strictEqual(readManifest(dir, 'payments').phases.planning.items['fee-model'].reconcile_needed, undefined);
  });

  it('never clobbers an existing downstream flag', () => {
    const m = epicManifest();
    m.phases.discussion.items['fee-model'] = { status: 'completed', reconcile_needed: true };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');

    const res = engine(dir, ['topic', 'reopen', 'payments', 'research', 'fee-model']);

    assert.strictEqual(res.reconcile_flagged, undefined);
    assert.strictEqual(readManifest(dir, 'payments').phases.discussion.items['fee-model'].reconcile_needed, true, 'brief flag preserved');
  });

  it('discussion reopen flags owning specs by reverse join and stales their source rows', () => {
    const m = epicManifest();
    m.phases.specification = { items: {
      unified: { status: 'completed', sources: { 'session-model': { status: 'incorporated' }, other: { status: 'incorporated' } } },
      legacy: { status: 'completed', sources: [{ name: 'session-model', status: 'incorporated' }] },
      unrelated: { status: 'completed', sources: { other: { status: 'incorporated' } } },
      gone: { status: 'superseded', superseded_by: 'unified', sources: { 'session-model': { status: 'incorporated' } } },
      building: { status: 'in-progress', sources: { 'session-model': { status: 'incorporated' } } },
    } };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');

    const res = engine(dir, ['topic', 'reopen', 'payments', 'discussion', 'session-model']);

    assert.deepStrictEqual(res.reconcile_flagged, [
      { phase: 'specification', topic: 'unified' },
      { phase: 'specification', topic: 'legacy' },
    ]);
    assert.deepStrictEqual(res.sources_staled, ['unified', 'legacy', 'building']);
    const items = readManifest(dir, 'payments').phases.specification.items;
    assert.strictEqual(items.unified.reconcile_needed, 'discussion');
    assert.strictEqual(items.unified.sources['session-model'].status, 'stale');
    assert.strictEqual(items.unified.sources.other.status, 'incorporated', 'sibling rows untouched');
    assert.strictEqual(items.legacy.sources[0].status, 'stale', 'legacy array form stales in place');
    assert.strictEqual(items.unrelated.reconcile_needed, undefined, 'no source row, no flag');
    assert.strictEqual(items.gone.reconcile_needed, undefined, 'terminal specs are skipped');
    assert.strictEqual(items.gone.sources['session-model'].status, 'incorporated');
    // The in-progress spec takes no flag — its own session's sign-off reads
    // the stale row — but the row still stales.
    assert.strictEqual(items.building.reconcile_needed, undefined);
    assert.strictEqual(items.building.sources['session-model'].status, 'stale');
  });

  it('a second source re-deciding still stales its row on an already-flagged spec', () => {
    const m = epicManifest();
    m.phases.discussion.items['refund-policy'].status = 'completed';
    m.phases.specification = { items: {
      unified: { status: 'completed', reconcile_needed: 'discussion',
        sources: { 'session-model': { status: 'stale' }, 'refund-policy': { status: 'incorporated' } } },
    } };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');

    const res = engine(dir, ['topic', 'reopen', 'payments', 'discussion', 'refund-policy']);

    assert.strictEqual(res.reconcile_flagged, undefined, 'the existing flag is never clobbered');
    assert.deepStrictEqual(res.sources_staled, ['unified']);
    const item = readManifest(dir, 'payments').phases.specification.items.unified;
    assert.strictEqual(item.reconcile_needed, 'discussion');
    assert.strictEqual(item.sources['refund-policy'].status, 'stale');
  });

  it('specification reopen flags the completed plan — the pipeline hop', () => {
    const m = epicManifest();
    m.phases.specification = { items: { 'auth-flow': { status: 'completed' } } };
    m.phases.planning = { items: { 'auth-flow': { status: 'completed' } } };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');

    const res = engine(dir, ['topic', 'reopen', 'payments', 'specification', 'auth-flow']);

    assert.deepStrictEqual(res.reconcile_flagged, [{ phase: 'planning', topic: 'auth-flow' }]);
    assert.strictEqual(readManifest(dir, 'payments').phases.planning.items['auth-flow'].reconcile_needed, 'specification');
  });

  it('bugfix investigation reopen flags the completed spec — the type pipeline drives the hop', () => {
    writeFile(dir, '.workflows/crash/manifest.json', JSON.stringify({
      name: 'crash', work_type: 'bugfix', status: 'in-progress',
      phases: {
        investigation: { items: { crash: { status: 'completed' } } },
        specification: { items: { crash: { status: 'completed' } } },
      },
    }, null, 2) + '\n');

    const res = engine(dir, ['topic', 'reopen', 'crash', 'investigation', 'crash']);

    assert.deepStrictEqual(res.reconcile_flagged, [{ phase: 'specification', topic: 'crash' }]);
    assert.strictEqual(readManifest(dir, 'crash').phases.specification.items.crash.reconcile_needed, 'investigation');
  });

  it('quick-fix scoping reopen flags the completed implementation', () => {
    writeFile(dir, '.workflows/typo/manifest.json', JSON.stringify({
      name: 'typo', work_type: 'quick-fix', status: 'in-progress',
      phases: {
        scoping: { items: { typo: { status: 'completed' } } },
        implementation: { items: { typo: { status: 'completed' } } },
      },
    }, null, 2) + '\n');

    const res = engine(dir, ['topic', 'reopen', 'typo', 'scoping', 'typo']);

    assert.deepStrictEqual(res.reconcile_flagged, [{ phase: 'implementation', topic: 'typo' }]);
    assert.strictEqual(readManifest(dir, 'typo').phases.implementation.items.typo.reconcile_needed, 'scoping');
  });

  it('a phase outside the work type pipeline never mis-hops — the -1 guard', () => {
    // A bugfix with a (schema-legal, pipeline-foreign) research item: its
    // reopen must not flag investigation via a wrapped index.
    writeFile(dir, '.workflows/crash/manifest.json', JSON.stringify({
      name: 'crash', work_type: 'bugfix', status: 'in-progress',
      phases: {
        research: { items: { crash: { status: 'completed' } } },
        investigation: { items: { crash: { status: 'completed' } } },
      },
    }, null, 2) + '\n');

    const res = engine(dir, ['topic', 'reopen', 'crash', 'research', 'crash']);

    assert.strictEqual(res.reconcile_flagged, undefined);
    assert.strictEqual(readManifest(dir, 'crash').phases.investigation.items.crash.reconcile_needed, undefined);
  });

  it('refuses an in-progress item — nothing touched', () => {
    const before = fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8');
    const err = engineFails(dir, ['topic', 'reopen', 'payments', 'research', 'auth-flow']);
    assert.match(err.error, /is not completed \(status: in-progress\) — only a completed item can be reopened/);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8'), before);
  });

  it('a discussion refuses to reopen while its research is outstanding — research feeds discussion', () => {
    const withResearch = (status) => {
      const m = epicManifest();
      m.phases.research.items['session-model'] = { status };
      writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    };
    withResearch('triaged');
    const before = fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8');
    const err = engineFails(dir, ['topic', 'reopen', 'payments', 'discussion', 'session-model']);
    assert.match(err.error, /discussion can't reopen on "session-model" — research is parked on it \(triage waiting\); research feeds discussion, so it lands first — the menu names the way in/);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8'), before);
    withResearch('in-progress');
    assert.match(engineFails(dir, ['topic', 'reopen', 'payments', 'discussion', 'session-model']).error, /research is in flight on it/);
    withResearch('completed');
    assert.strictEqual(engine(dir, ['topic', 'reopen', 'payments', 'discussion', 'session-model']).status, 'in-progress');
  });

  it('refuses a superseded item — supersession stays its own flow', () => {
    engine(dir, ['topic', 'supersede', 'payments', 'research', 'auth-flow', '--by', 'fee-model']);
    const before = fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8');
    const err = engineFails(dir, ['topic', 'reopen', 'payments', 'research', 'auth-flow']);
    assert.match(err.error, /is not completed \(status: superseded\)/);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8'), before);
  });

  it('refuses a cancelled item — reactivate owns that path', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'session-model']);
    const err = engineFails(dir, ['topic', 'reopen', 'payments', 'discussion', 'session-model']);
    assert.match(err.error, /is cancelled — reactivate it instead/);
  });

  it('rejects unknown work unit, phase, missing item, and missing args — loud and specific', () => {
    assert.match(engineFails(dir, ['topic', 'reopen', 'ghost', 'research', 'fee-model']).error, /manifest not found/);
    assert.match(engineFails(dir, ['topic', 'reopen', 'payments', 'nonsense', 'fee-model']).error, /unknown or non-lifecycle phase "nonsense"/);
    assert.match(engineFails(dir, ['topic', 'reopen', 'payments', 'planning', 'fee-model']).error, /no planning items/);
    assert.match(engineFails(dir, ['topic', 'reopen', 'payments', 'research', 'ghost']).error, /no research item "ghost"/);
    assert.match(engineFails(dir, ['topic', 'reopen', 'payments', 'research']).error, /Usage: engine topic reopen/);
  });
});

describe('engine sources stale', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function specedManifest() {
    const m = epicManifest();
    m.phases.specification = { items: {
      unified: { status: 'completed', sources: { 'session-model': { status: 'incorporated' }, other: { status: 'incorporated' } } },
      legacy: { status: 'completed', sources: [{ name: 'session-model', status: 'incorporated' }] },
      unrelated: { status: 'completed', sources: { other: { status: 'incorporated' } } },
      gone: { status: 'superseded', superseded_by: 'unified', sources: { 'session-model': { status: 'incorporated' } } },
      building: { status: 'in-progress', sources: { 'session-model': { status: 'incorporated' } } },
    } };
    return m;
  }

  it('runs the reverse join without reopening — rows stale, completed specs flag, the discussion stays completed', () => {
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(specedManifest(), null, 2) + '\n');

    const res = engine(dir, ['sources', 'stale', 'payments', 'session-model']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.discussion, 'session-model');
    assert.deepStrictEqual(res.flagged, [
      { phase: 'specification', topic: 'unified' },
      { phase: 'specification', topic: 'legacy' },
    ]);
    assert.deepStrictEqual(res.staled, ['unified', 'legacy', 'building']);
    const m = readManifest(dir, 'payments');
    assert.strictEqual(m.phases.discussion.items['session-model'].status, 'completed', 'no reopen — the discussion is untouched');
    const items = m.phases.specification.items;
    assert.strictEqual(items.unified.reconcile_needed, 'discussion');
    assert.strictEqual(items.unified.sources['session-model'].status, 'stale');
    assert.strictEqual(items.unified.sources.other.status, 'incorporated', 'sibling rows untouched');
    assert.strictEqual(items.legacy.sources[0].status, 'stale', 'legacy array form stales in place');
    assert.strictEqual(items.unrelated.reconcile_needed, undefined, 'no source row, no flag');
    assert.strictEqual(items.gone.sources['session-model'].status, 'incorporated', 'terminal specs are skipped');
    assert.strictEqual(items.building.reconcile_needed, undefined, 'in-progress specs take no flag');
    assert.strictEqual(items.building.sources['session-model'].status, 'stale');
  });

  it('--except skips the invoking spec entirely — no flip, no flag', () => {
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(specedManifest(), null, 2) + '\n');

    const res = engine(dir, ['sources', 'stale', 'payments', 'session-model', '--except', 'unified']);

    assert.deepStrictEqual(res.staled, ['legacy', 'building']);
    assert.deepStrictEqual(res.flagged, [{ phase: 'specification', topic: 'legacy' }]);
    const items = readManifest(dir, 'payments').phases.specification.items;
    assert.strictEqual(items.unified.sources['session-model'].status, 'incorporated', 'the excepted spec keeps its row');
    assert.strictEqual(items.unified.reconcile_needed, undefined);
  });

  it('never clobbers an existing reconcile flag', () => {
    const m = specedManifest();
    m.phases.specification.items.unified.reconcile_needed = 'discussion';
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');

    const res = engine(dir, ['sources', 'stale', 'payments', 'session-model']);

    assert.deepStrictEqual(res.flagged, [{ phase: 'specification', topic: 'legacy' }]);
    assert.strictEqual(readManifest(dir, 'payments').phases.specification.items.unified.reconcile_needed, 'discussion');
  });

  it('refuses a discussion the manifest does not carry', () => {
    const res = engineFails(dir, ['sources', 'stale', 'payments', 'nonexistent']);
    assert.match(res.error, /discussion item "nonexistent" not found/);
  });

  it('refuses an --except that names no specification item — a typo must never self-stale', () => {
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(specedManifest(), null, 2) + '\n');
    const res = engineFails(dir, ['sources', 'stale', 'payments', 'session-model', '--except', 'unifed']);
    assert.match(res.error, /--except "unifed" names no specification item/);
    const items = readManifest(dir, 'payments').phases.specification.items;
    assert.strictEqual(items.unified.sources['session-model'].status, 'incorporated', 'nothing staled');
  });

  it('refuses a valueless --except with the usage line', () => {
    const res = engineFails(dir, ['sources', 'stale', 'payments', 'session-model', '--except']);
    assert.match(res.error, /Usage: engine sources stale/);
  });

  it('answers with empty arrays when no specification phase exists', () => {
    const res = engine(dir, ['sources', 'stale', 'payments', 'session-model']);
    assert.deepStrictEqual(res.flagged, []);
    assert.deepStrictEqual(res.staled, []);
  });
});

describe('engine topic complete: specification source gate', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function withSpec(sources) {
    const m = epicManifest();
    m.phases.specification = { items: { unified: { status: 'in-progress', ...(sources !== undefined ? { sources } : {}) } } };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
  }

  it('refuses while a source row is pending', () => {
    withSpec({ 'session-model': { status: 'incorporated' }, other: { status: 'pending' } });
    const res = engineFails(dir, ['topic', 'complete', 'payments', 'specification', 'unified']);
    assert.match(res.error, /unresolved source rows \(other\)/);
    assert.strictEqual(readManifest(dir, 'payments').phases.specification.items.unified.status, 'in-progress');
  });

  it('refuses while a source row is stale', () => {
    withSpec([{ name: 'session-model', status: 'stale' }]);
    const res = engineFails(dir, ['topic', 'complete', 'payments', 'specification', 'unified']);
    assert.match(res.error, /unresolved source rows \(session-model\)/);
  });

  it('completes when every row is incorporated, and with no sources field at all', () => {
    withSpec({ 'session-model': { status: 'incorporated' } });
    assert.strictEqual(engine(dir, ['topic', 'complete', 'payments', 'specification', 'unified']).status, 'completed');

    withSpec(undefined);
    assert.strictEqual(engine(dir, ['topic', 'complete', 'payments', 'specification', 'unified']).status, 'completed');
  });

  it('legacy array form: all-incorporated completes, a missing status blocks', () => {
    withSpec([{ name: 'session-model', status: 'incorporated' }, { name: 'other', status: 'incorporated' }]);
    assert.strictEqual(engine(dir, ['topic', 'complete', 'payments', 'specification', 'unified']).status, 'completed');

    withSpec({ 'session-model': {} });
    const res = engineFails(dir, ['topic', 'complete', 'payments', 'specification', 'unified']);
    assert.match(res.error, /unresolved source rows \(session-model\)/);
    assert.strictEqual(readManifest(dir, 'payments').phases.specification.items.unified.status, 'in-progress', 'refusal leaves status untouched');
  });
});

describe('engine topic supersede', () => {
  let dir;

  /** The epic manifest extended with specification items in every source status. */
  function specManifest() {
    const m = epicManifest();
    m.phases.specification = {
      items: {
        unified: { status: 'completed' },
        'auth-flow': { status: 'completed' },
        'fee-model': { status: 'in-progress' },
        'refund-policy': { status: 'proposed' },
        'session-model': { status: 'cancelled', previous_status: 'completed' },
      },
    };
    return m;
  }

  beforeEach(() => {
    dir = setupGitFixture();
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(specManifest(), null, 2) + '\n');
    commitAll(dir, 'init');
  });
  afterEach(() => { cleanupFixture(dir); });

  it('marks a spec source superseded with superseded_by the TOPIC, removes KB chunks, no commit', () => {
    const res = engine(dir, ['topic', 'supersede', 'payments', 'specification', 'auth-flow', '--by', 'unified']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.topic, 'auth-flow');
    assert.strictEqual(res.phase, 'specification');
    assert.strictEqual(res.status, 'superseded');
    assert.strictEqual(res.superseded_by, 'unified');
    // No KB configured in the fixture — warn-don't-block.
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /knowledge remove failed/);

    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.specification.items['auth-flow'], {
      status: 'superseded',
      superseded_by: 'unified',
    });
    // Batch-oriented: no commit inside — the calling flow commits the set.
    assert.strictEqual(git(dir, ['rev-list', '--count', 'HEAD']).trim(), '1');
    assert.match(git(dir, ['status', '--porcelain']), /^ M \.workflows\/payments\/manifest\.json/m);
  });

  it('supersedes an in-progress source too — prose only excludes proposed', () => {
    const res = engine(dir, ['topic', 'supersede', 'payments', 'specification', 'fee-model', '--by', 'unified']);
    assert.strictEqual(res.status, 'superseded');
    const m = readManifest(dir, 'payments');
    assert.strictEqual(m.phases.specification.items['fee-model'].superseded_by, 'unified');
  });

  it('phase gating is schema-driven: research allows supersede, discussion refuses', () => {
    // research carries 'superseded' in the shared schema.
    const res = engine(dir, ['topic', 'supersede', 'payments', 'research', 'auth-flow', '--by', 'fee-model']);
    assert.strictEqual(res.status, 'superseded');

    // discussion does not — refused with the schema's own vocabulary.
    const before = fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8');
    const err = engineFails(dir, ['topic', 'supersede', 'payments', 'discussion', 'session-model', '--by', 'refund-policy']);
    assert.match(err.error, /Invalid status "superseded" for phase "discussion"/);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8'), before);
  });

  it('refuses a missing item, a missing --by target, and self-supersession — nothing touched', () => {
    const before = fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8');
    assert.match(
      engineFails(dir, ['topic', 'supersede', 'payments', 'specification', 'ghost', '--by', 'unified']).error,
      /no specification item "ghost"/);
    assert.match(
      engineFails(dir, ['topic', 'supersede', 'payments', 'specification', 'auth-flow', '--by', 'ghost']).error,
      /no specification item "ghost" to supersede toward — the absorbing item must exist first/);
    assert.match(
      engineFails(dir, ['topic', 'supersede', 'payments', 'specification', 'auth-flow', '--by', 'auth-flow']).error,
      /cannot supersede itself/);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8'), before);
  });

  it('refuses an already-superseded, proposed, or cancelled item', () => {
    engine(dir, ['topic', 'supersede', 'payments', 'specification', 'auth-flow', '--by', 'unified']);
    assert.match(
      engineFails(dir, ['topic', 'supersede', 'payments', 'specification', 'auth-flow', '--by', 'unified']).error,
      /already superseded \(by "unified"\)/);
    assert.match(
      engineFails(dir, ['topic', 'supersede', 'payments', 'specification', 'refund-policy', '--by', 'unified']).error,
      /is proposed — a proposed item has no artifact to supersede/);
    assert.match(
      engineFails(dir, ['topic', 'supersede', 'payments', 'specification', 'session-model', '--by', 'unified']).error,
      /is cancelled — reactivate it instead/);
  });

  it('rejects missing args and an unknown phase — loud and specific', () => {
    assert.match(engineFails(dir, ['topic', 'supersede', 'payments', 'specification', 'auth-flow']).error, /Usage: engine topic supersede/);
    assert.match(engineFails(dir, ['topic', 'supersede', 'payments', 'specification']).error, /Usage: engine topic supersede/);
    assert.match(engineFails(dir, ['topic', 'supersede', 'payments', 'nonsense', 'auth-flow', '--by', 'unified']).error, /unknown or non-lifecycle phase "nonsense"/);
  });
});

/** A single-topic feature manifest with completed indexed artifacts, an import, and imports on disk. */
function featureManifest() {
  return {
    name: 'auth-flow',
    work_type: 'feature',
    status: 'in-progress',
    created: '2026-06-01',
    description: 'auth flow work',
    imports: [
      { path: 'imports/notes.md', imported_at: '2026-06-01T09:00:00Z' },
      { path: 'evil/../notes.md', imported_at: '2026-06-01T09:00:00Z' },
    ],
    seeds: [{ path: 'seeds/seed.md', source: 'inbox:idea', seeded_at: '2026-06-01T09:00:00Z' }],
    phases: {
      discussion: { items: { 'auth-flow': { status: 'completed' } } },
      research: { items: { exploration: { status: 'completed' }, 'dead-end': { status: 'cancelled' } } },
      specification: { items: { 'auth-flow': { status: 'in-progress' } } },
    },
  };
}

function setupFeatureFixture() {
  const dir = setupGitFixture();
  writeFile(dir, '.workflows/auth-flow/manifest.json', JSON.stringify(featureManifest(), null, 2) + '\n');
  // The completed phase artifacts (bulk re-index discovers only files that
  // exist on disk).
  writeFile(dir, '.workflows/auth-flow/research/exploration.md', '# Exploration\n');
  writeFile(dir, '.workflows/auth-flow/discussion/auth-flow.md', '# Discussion\n');
  writeFile(dir, '.workflows/auth-flow/imports/notes.md', '# Notes\n');
  writeFile(dir, '.workflows/auth-flow/seeds/seed.md', '# Seed\n');
  writeFile(dir, '.workflows/auth-flow/.state/discovery-gap-analysis.md', '# Analysis\n');
  // Present but never indexed for a feature — discovery's session leg is
  // epic-only.
  writeFile(dir, '.workflows/auth-flow/discovery/sessions/session-001.md', '# Session 001\n');
  // A plain file where the knowledge store's directory belongs: the re-index
  // spawn fails deterministically (stub mode would otherwise index the existing
  // files successfully), so warn-don't-block is provable as a warning.
  writeFile(dir, '.workflows/.knowledge', 'not a directory\n');
  commitAll(dir, 'init');
  return dir;
}

/** A cross-cutting unit whose pipeline is finished (derived next phase `done`). */
function setupFinishedCrossCuttingFixture() {
  const dir = setupGitFixture();
  writeFile(dir, '.workflows/caching/manifest.json', JSON.stringify({
    name: 'caching',
    work_type: 'cross-cutting',
    status: 'in-progress',
    phases: {
      discussion: { items: { caching: { status: 'completed' } } },
      specification: { items: { caching: { status: 'completed' } } },
    },
  }, null, 2) + '\n');
  // The completed phase artifacts on disk, so the re-index bulk walk discovers
  // them (it skips artifacts whose files are absent).
  writeFile(dir, '.workflows/caching/discussion/caching.md', '# Discussion\n');
  writeFile(dir, '.workflows/caching/specification/caching/specification.md', '# Spec\n');
  // Deterministic KB failure: a plain file where the store directory belongs.
  writeFile(dir, '.workflows/.knowledge', 'not a directory\n');
  commitAll(dir, 'init');
  return dir;
}

describe('engine workunit complete', () => {
  let dir;
  beforeEach(() => { dir = setupFeatureFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('sets status completed, stamps completed_at today, commits with the given message', () => {
    writeFile(dir, 'unrelated.txt', 'outside the scope\n');
    const res = engine(dir, ['workunit', 'complete', 'auth-flow', '-m', 'workflow(auth-flow): complete feature pipeline']);

    const today = new Date().toISOString().slice(0, 10);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.work_unit, 'auth-flow');
    assert.strictEqual(res.status, 'completed');
    assert.strictEqual(res.completed_at, today);
    assert.strictEqual(res.committed, shortHead(dir));
    // No KB action on complete — completed units retain their chunks.
    assert.deepStrictEqual(res.warnings, []);

    const m = readManifest(dir, 'auth-flow');
    assert.strictEqual(m.status, 'completed');
    assert.strictEqual(m.completed_at, today);
    assert.strictEqual(lastMessage(dir), 'workflow(auth-flow): complete feature pipeline');
    // Scoped: the unrelated file stays uncommitted.
    assert.match(git(dir, ['status', '--porcelain']), /\?\? unrelated\.txt/);
    assert.strictEqual(res.work_type, 'feature');
    assert.strictEqual(engine.lastSections, '', 'transactions answer with pure JSON');
    assert.match(render(dir, ['workunit-receipt', 'auth-flow', '--verb', 'complete']),
      /=== DISPLAY: confirmation \(emit verbatim as a code block after the response\) ===\n"Auth Flow" marked as completed\./);
  });

  it('purges the work unit\'s scratch cache on complete — untracked scratch leaves no dirt', () => {
    writeFile(dir, '.workflows/.cache/auth-flow/discussion/auth-flow/review-1.md', 'scratch\n');
    engine(dir, ['workunit', 'complete', 'auth-flow', '-m', 'workflow(auth-flow): complete feature pipeline']);
    assert.strictEqual(fs.existsSync(path.join(dir, '.workflows/.cache/auth-flow')), false, 'cache dir removed');
    assert.strictEqual(git(dir, ['status', '--porcelain']).trim(), '', 'no stray dirt');
  });

  it('stages tracked pre-049 cache residue deletions into the completion commit', () => {
    writeFile(dir, '.workflows/.cache/auth-flow/planning/auth-flow/stale.json', '{}\n');
    git(dir, ['add', '.workflows/.cache/auth-flow']);
    git(dir, ['commit', '-m', 'legacy: tracked cache residue']);
    engine(dir, ['workunit', 'complete', 'auth-flow', '-m', 'workflow(auth-flow): complete feature pipeline']);
    assert.strictEqual(fs.existsSync(path.join(dir, '.workflows/.cache/auth-flow')), false);
    assert.strictEqual(git(dir, ['status', '--porcelain']).trim(), '', 'tracked deletion committed, not left as dirt');
    assert.match(git(dir, ['show', '--name-only', 'HEAD']), /\.workflows\/\.cache\/auth-flow\/planning\/auth-flow\/stale\.json/);
  });

  it('--pipeline renders the "{Type} Completed" banner instead of the one-liner; --skipped-review varies the body', () => {
    engine(dir, ['workunit', 'complete', 'auth-flow', '-m', 'workflow(auth-flow): complete feature pipeline']);
    const banner = render(dir, ['workunit-receipt', 'auth-flow', '--verb', 'complete', '--pipeline']);
    assert.match(banner, /Feature Completed\n\n"Auth Flow" has completed all pipeline phases\./);
    assert.ok(!banner.includes('marked as completed'));
    assert.match(render(dir, ['workunit-receipt', 'auth-flow', '--verb', 'complete', '--pipeline', '--skipped-review']),
      /Feature Completed\n\n"Auth Flow" completed — review skipped\./);
  });

  it('reactivate renders its confirmation via the receipt surface', () => {
    engine(dir, ['workunit', 'cancel', 'auth-flow']);
    engine(dir, ['workunit', 'reactivate', 'auth-flow']);
    assert.strictEqual(engine.lastSections, '', 'transactions answer with pure JSON');
    assert.match(render(dir, ['workunit-receipt', 'auth-flow', '--verb', 'reactivate']), /"Auth Flow" reactivated\./);
    assert.match(engineFails(dir, ['render', 'workunit-receipt', 'auth-flow', '--verb', 'cancel']).error,
      /not "cancelled" — the cancel has not run/);
  });

  it('rejects an already-completed unit and routes a cancelled unit through reactivate', () => {
    engine(dir, ['workunit', 'complete', 'auth-flow', '-m', 'workflow(auth-flow): mark as completed']);
    assert.match(
      engineFails(dir, ['workunit', 'complete', 'auth-flow', '-m', 'again']).error,
      /already completed/);

    engine(dir, ['workunit', 'reactivate', 'auth-flow']);
    engine(dir, ['workunit', 'cancel', 'auth-flow']);
    assert.match(
      engineFails(dir, ['workunit', 'complete', 'auth-flow', '-m', 'msg']).error,
      /is cancelled — reactivate it first/);
  });

  it('rejects a missing message, missing work unit, and unknown work unit', () => {
    assert.match(engineFails(dir, ['workunit', 'complete', 'auth-flow']).error, /Usage: engine workunit complete/);
    assert.match(engineFails(dir, ['workunit', 'complete', '-m', 'msg']).error, /Usage: engine workunit complete/);
    assert.match(engineFails(dir, ['workunit', 'complete', 'ghost', '-m', 'msg']).error, /manifest not found/);
    assert.match(engineFails(dir, ['workunit', 'finish', 'auth-flow']).error, /Usage: engine workunit <create\|import\|complete\|cancel\|reactivate\|pivot\|absorb\|promote>/);
  });

  it('completes a cancelled unit with a finished pipeline directly, restoring its chunks', () => {
    // A cancelled finished pipeline completes directly (reactivate stays open
    // as the revisit path) — and cancellation removed the unit's chunks, so
    // the transition re-indexes them (warn-don't-block).
    const ccDir = setupFinishedCrossCuttingFixture();
    engine(ccDir, ['workunit', 'cancel', 'caching']);
    const res = engine(ccDir, ['workunit', 'complete', 'caching', '-m', 'workflow(caching): complete cross-cutting pipeline']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'completed');
    assert.strictEqual(res.committed, shortHead(ccDir));
    // Cancellation removed the unit's chunks; completion re-indexes them in ONE
    // scoped bulk spawn. No KB in the fixture, so that spawn fails → a single
    // warn-don't-block warning.
    assert.strictEqual(res.warnings.length, 1, res.warnings.join('\n'));
    assert.match(res.warnings[0], /knowledge index failed/);

    const m = readManifest(ccDir, 'caching');
    assert.strictEqual(m.status, 'completed');
    assert.strictEqual(m.completed_at, new Date().toISOString().slice(0, 10));
    assert.strictEqual(lastMessage(ccDir), 'workflow(caching): complete cross-cutting pipeline');
    cleanupFixture(ccDir);
  });
});

describe('engine workunit cancel', () => {
  let dir;
  beforeEach(() => { dir = setupFeatureFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('purges the work unit\'s scratch cache on cancel', () => {
    writeFile(dir, '.workflows/.cache/auth-flow/research/auth-flow/deep-dive-1.md', 'scratch\n');
    engine(dir, ['workunit', 'cancel', 'auth-flow']);
    assert.strictEqual(fs.existsSync(path.join(dir, '.workflows/.cache/auth-flow')), false, 'cache dir removed');
    assert.strictEqual(git(dir, ['status', '--porcelain']).trim(), '', 'no stray dirt');
  });

  it('sets status cancelled, removes KB chunks (failure is a warning), commits the fixed message', () => {
    const res = engine(dir, ['workunit', 'cancel', 'auth-flow']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'cancelled');
    assert.strictEqual(res.committed, shortHead(dir));
    // No KB configured in the fixture — warn-don't-block: the cancellation
    // still landed and the failure is reported, not thrown.
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /knowledge remove failed/);

    const m = readManifest(dir, 'auth-flow');
    assert.strictEqual(m.status, 'cancelled');
    assert.strictEqual(m.completed_at, undefined);
    assert.strictEqual(lastMessage(dir), 'workflow(auth-flow): mark as cancelled');
    assert.strictEqual(engine.lastSections, '', 'transactions answer with pure JSON');
    // Receipt: warning above confirmation, fetched from the cancelled state.
    // Conventions-form callout: 2-space flag, 4-space continuation.
    const receipt = render(dir, ['workunit-receipt', 'auth-flow', '--verb', 'cancel', '--warn']);
    assert.match(receipt, /  ⚑ Knowledge removal warning\n    The work unit is cancelled\./);
    assert.match(receipt, /"Auth Flow" marked as cancelled\./);
  });

  it('rejects an already-cancelled unit and routes a completed unit through reactivate', () => {
    engine(dir, ['workunit', 'cancel', 'auth-flow']);
    assert.match(engineFails(dir, ['workunit', 'cancel', 'auth-flow']).error, /already cancelled/);

    engine(dir, ['workunit', 'reactivate', 'auth-flow']);
    engine(dir, ['workunit', 'complete', 'auth-flow', '-m', 'workflow(auth-flow): mark as completed']);
    assert.match(
      engineFails(dir, ['workunit', 'cancel', 'auth-flow']).error,
      /is completed — reactivate it first/);
  });

  it('rejects missing and unknown work units', () => {
    assert.match(engineFails(dir, ['workunit', 'cancel']).error, /Usage: engine workunit cancel/);
    assert.match(engineFails(dir, ['workunit', 'cancel', 'ghost']).error, /manifest not found/);
    assert.match(engineFails(dir, ['workunit', 'cancel', 'auth-flow', 'extra']).error, /Usage: engine workunit cancel/);
  });
});

describe('engine workunit reactivate', () => {
  let dir;
  beforeEach(() => { dir = setupFeatureFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('round-trips a complete: status restored, completed_at cleared, no KB attempt', () => {
    engine(dir, ['workunit', 'complete', 'auth-flow', '-m', 'workflow(auth-flow): mark as completed']);
    const res = engine(dir, ['workunit', 'reactivate', 'auth-flow']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'in-progress');
    assert.strictEqual(res.previous_status, 'completed');
    assert.strictEqual(res.committed, shortHead(dir));
    // Completed units retained their chunks — no re-indexing, no warnings.
    assert.deepStrictEqual(res.warnings, []);

    const m = readManifest(dir, 'auth-flow');
    assert.strictEqual(m.status, 'in-progress');
    assert.ok(!('completed_at' in m), 'stale completed_at must be cleared');
    assert.strictEqual(lastMessage(dir), 'workflow(auth-flow): reactivate work unit');
  });

  it('re-indexes after a cancel in one scoped bulk spawn — failure is a warning', () => {
    engine(dir, ['workunit', 'cancel', 'auth-flow']);
    const res = engine(dir, ['workunit', 'reactivate', 'auth-flow']);

    assert.strictEqual(res.status, 'in-progress');
    assert.strictEqual(res.previous_status, 'cancelled');
    // Cancellation removed the unit's chunks; reactivation re-indexes them in a
    // SINGLE `knowledge index --work-unit` spawn (formerly one spawn per
    // artifact). The bulk walk covers the same set — completed phase artifacts,
    // shape-valid imports/seeds, analysis caches. No KB in the fixture, so the
    // spawn fails → one warn-don't-block warning.
    assert.strictEqual(res.warnings.length, 1, res.warnings.join('\n'));
    assert.match(res.warnings[0], /knowledge index failed/);
    assert.strictEqual(lastMessage(dir), 'workflow(auth-flow): reactivate work unit');
  });

  it('epic reactivate re-indexes in one scoped bulk spawn (session logs in scope) — failure is a warning', () => {
    const epicDir = setupGitFixture();
    writeFile(epicDir, '.workflows/payments/manifest.json', JSON.stringify({
      name: 'payments', work_type: 'epic', status: 'in-progress',
      phases: {
        discovery: { items: { 'auth-flow': { routing: 'discussion', source: 'discovery' } } },
        discussion: { items: { 'auth-flow': { status: 'completed' } } },
      },
    }, null, 2) + '\n');
    writeFile(epicDir, '.workflows/payments/discussion/auth-flow.md', '# Discussion\n');
    writeFile(epicDir, '.workflows/payments/discovery/sessions/session-001.md', '# Session 001\n');
    writeFile(epicDir, '.workflows/payments/discovery/sessions/session-002.md', '# Session 002\n');
    writeFile(epicDir, '.workflows/payments/discovery/sessions/notes.txt', 'not a session log\n');
    // Deterministic KB failure: a plain file where the store directory belongs.
    writeFile(epicDir, '.workflows/.knowledge', 'not a directory\n');
    commitAll(epicDir, 'init');

    engine(epicDir, ['workunit', 'cancel', 'payments']);
    const res = engine(epicDir, ['workunit', 'reactivate', 'payments']);

    assert.strictEqual(res.status, 'in-progress');
    // The epic's re-index (completed discussion + the two session logs; the
    // non-matching file is excluded by discovery) collapses to one scoped bulk
    // spawn. Session-scoping itself is pinned by the discovery snapshot test;
    // here the barrier makes the single spawn fail → one warning.
    assert.strictEqual(res.warnings.length, 1, res.warnings.join('\n'));
    assert.match(res.warnings[0], /knowledge index failed/);
    cleanupFixture(epicDir);
  });

  it('reactivates a completed unit whose pipeline is finished — the revisit path stays open', () => {
    // The unit surfaces as finalising (or in-progress once a topic is
    // reopened) — reactivate must not deadlock the reopen path.
    const ccDir = setupFinishedCrossCuttingFixture();
    engine(ccDir, ['workunit', 'complete', 'caching', '-m', 'workflow(caching): complete cross-cutting pipeline']);
    const res = engine(ccDir, ['workunit', 'reactivate', 'caching']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'in-progress');
    assert.strictEqual(res.previous_status, 'completed');
    // Completed units retained their chunks — no re-indexing, no warnings.
    assert.deepStrictEqual(res.warnings, []);
    const m = readManifest(ccDir, 'caching');
    assert.strictEqual(m.status, 'in-progress');
    assert.ok(!('completed_at' in m), 'stale completed_at must be cleared');
    assert.strictEqual(lastMessage(ccDir), 'workflow(caching): reactivate work unit');
    cleanupFixture(ccDir);
  });

  it('reactivates a cancelled unit whose pipeline is finished — complete stays open as the other path', () => {
    const ccDir = setupFinishedCrossCuttingFixture();
    engine(ccDir, ['workunit', 'cancel', 'caching']);
    const res = engine(ccDir, ['workunit', 'reactivate', 'caching']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'in-progress');
    assert.strictEqual(res.previous_status, 'cancelled');
    // Cancellation removed the unit's chunks — the cancelled reactivation
    // re-index runs as one scoped bulk spawn (no KB in the fixture: it fails,
    // one warn-don't-block warning).
    assert.strictEqual(res.warnings.length, 1, res.warnings.join('\n'));
    assert.match(res.warnings[0], /knowledge index failed/);
    assert.strictEqual(readManifest(ccDir, 'caching').status, 'in-progress');
    cleanupFixture(ccDir);
  });

  it('rejects an in-progress unit and a status outside the shared vocabulary', () => {
    assert.match(engineFails(dir, ['workunit', 'reactivate', 'auth-flow']).error, /already in-progress/);

    const m = featureManifest();
    m.status = 'archived';
    writeFile(dir, '.workflows/auth-flow/manifest.json', JSON.stringify(m, null, 2) + '\n');
    assert.match(
      engineFails(dir, ['workunit', 'reactivate', 'auth-flow']).error,
      /not completed or cancelled \(status: archived\)/);
  });
});

describe('engine inbox archive / restore / delete', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    writeFile(dir, '.workflows/.inbox/ideas/2026-06-01--smart-retry.md', '# Smart Retry\n');
    writeFile(dir, '.workflows/.inbox/bugs/2026-06-02--login-loop.md', '# Login Loop\n');
    commitAll(dir, 'init');
  });
  afterEach(() => { cleanupFixture(dir); });

  it('archives a single item — file moved to its source folder under .archived, slug commit message', () => {
    const res = engine(dir, ['inbox', 'archive', '.workflows/.inbox/ideas/2026-06-01--smart-retry.md']);

    assert.deepStrictEqual(res.archived, ['.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md']);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.ok(!fs.existsSync(path.join(dir, '.workflows/.inbox/ideas/2026-06-01--smart-retry.md')));
    assert.ok(fs.existsSync(path.join(dir, '.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md')));
    assert.strictEqual(lastMessage(dir), 'workflow(inbox): archive smart-retry');
  });

  it('archives a multi-item set in one commit with the N-items message form', () => {
    const res = engine(dir, [
      'inbox', 'archive',
      '.workflows/.inbox/ideas/2026-06-01--smart-retry.md',
      '.workflows/.inbox/bugs/2026-06-02--login-loop.md',
    ]);

    assert.deepStrictEqual(res.archived, [
      '.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md',
      '.workflows/.inbox/.archived/bugs/2026-06-02--login-loop.md',
    ]);
    assert.ok(fs.existsSync(path.join(dir, '.workflows/.inbox/.archived/bugs/2026-06-02--login-loop.md')));
    assert.strictEqual(lastMessage(dir), 'workflow(inbox): archive 2 items');
    // One commit for the whole set.
    assert.strictEqual(git(dir, ['rev-list', '--count', 'HEAD']).trim(), '2');
  });

  it('restores an archived item back to its live folder', () => {
    engine(dir, ['inbox', 'archive', '.workflows/.inbox/ideas/2026-06-01--smart-retry.md']);
    const res = engine(dir, ['inbox', 'restore', '.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md']);

    assert.deepStrictEqual(res.restored, ['.workflows/.inbox/ideas/2026-06-01--smart-retry.md']);
    assert.ok(fs.existsSync(path.join(dir, '.workflows/.inbox/ideas/2026-06-01--smart-retry.md')));
    assert.ok(!fs.existsSync(path.join(dir, '.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md')));
    assert.strictEqual(lastMessage(dir), 'workflow(inbox): restore smart-retry');
  });

  it('deletes an archived item via git rm', () => {
    engine(dir, ['inbox', 'archive', '.workflows/.inbox/ideas/2026-06-01--smart-retry.md']);
    const res = engine(dir, ['inbox', 'delete', '.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md']);

    assert.deepStrictEqual(res.deleted, ['.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md']);
    assert.ok(!fs.existsSync(path.join(dir, '.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md')));
    assert.strictEqual(lastMessage(dir), 'workflow(inbox): delete smart-retry');
    assert.strictEqual(git(dir, ['status', '--porcelain']).trim(), '');
  });

  it('rejects invalid paths strictly, before anything moves', () => {
    // Outside the inbox entirely.
    assert.match(
      engineFails(dir, ['inbox', 'archive', '.workflows/payments/manifest.json']).error,
      /not a live inbox path/);
    // Unknown folder.
    assert.match(
      engineFails(dir, ['inbox', 'archive', '.workflows/.inbox/notes/2026-06-01--x.md']).error,
      /not a live inbox path/);
    // Traversal.
    assert.match(
      engineFails(dir, ['inbox', 'archive', '.workflows/.inbox/ideas/../../../etc/passwd.md']).error,
      /not a live inbox path|without ".."/);
    // Archived path passed to archive.
    assert.match(
      engineFails(dir, ['inbox', 'archive', '.workflows/.inbox/.archived/ideas/2026-06-01--x.md']).error,
      /not a live inbox path/);
    // Live path passed to delete.
    assert.match(
      engineFails(dir, ['inbox', 'delete', '.workflows/.inbox/ideas/2026-06-01--smart-retry.md']).error,
      /not an archived inbox path/);
    // Live path passed to restore.
    assert.match(
      engineFails(dir, ['inbox', 'restore', '.workflows/.inbox/ideas/2026-06-01--smart-retry.md']).error,
      /not an archived inbox path/);
    // Missing file.
    assert.match(
      engineFails(dir, ['inbox', 'archive', '.workflows/.inbox/ideas/2026-06-01--ghost.md']).error,
      /not found/);
    // One bad path poisons the whole set — the good file did not move.
    engineFails(dir, [
      'inbox', 'archive',
      '.workflows/.inbox/ideas/2026-06-01--smart-retry.md',
      '.workflows/.inbox/ideas/2026-06-01--ghost.md',
    ]);
    assert.ok(fs.existsSync(path.join(dir, '.workflows/.inbox/ideas/2026-06-01--smart-retry.md')));
    assert.match(engineFails(dir, ['inbox', 'archive']).error, /Usage: engine inbox/);
  });

  it('refuses a duplicate path in the set before any move — no half-applied state', () => {
    const err = engineFails(dir, [
      'inbox', 'archive',
      '.workflows/.inbox/ideas/2026-06-01--smart-retry.md',
      '.workflows/.inbox/ideas/2026-06-01--smart-retry.md',
    ]);
    assert.match(err.error, /duplicate inbox path/);
    // The one real file never moved — the transaction refused up front.
    assert.ok(fs.existsSync(path.join(dir, '.workflows/.inbox/ideas/2026-06-01--smart-retry.md')));
    assert.ok(!fs.existsSync(path.join(dir, '.workflows/.inbox/.archived/ideas/2026-06-01--smart-retry.md')));
    assert.strictEqual(git(dir, ['status', '--porcelain']).trim(), '');
  });
});

describe('engine commit', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    writeFile(dir, '.workflows/payments/manifest.json', '{"name":"payments"}\n');
    writeFile(dir, '.workflows/.inbox/ideas/2026-06-01--x.md', '# X\n');
    commitAll(dir, 'init');
  });
  afterEach(() => { cleanupFixture(dir); });

  it('stages the work-unit scope and commits with the given message', () => {
    writeFile(dir, '.workflows/payments/discussion/auth.md', '# Auth\n');
    writeFile(dir, 'unrelated.txt', 'outside the scope\n');

    const res = engine(dir, ['commit', 'payments', '-m', 'discussion(payments/auth): document decision']);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.strictEqual(lastMessage(dir), 'discussion(payments/auth): document decision');
    // Scoped: the unrelated file stays uncommitted.
    assert.match(git(dir, ['status', '--porcelain']), /\?\? unrelated\.txt/);
  });

  it('a clean tree is fine: committed null, nothing-to-commit note, exit 0', () => {
    const res = engine(dir, ['commit', 'payments', '-m', 'noop']);
    assert.deepStrictEqual(res, { ok: true, committed: null, note: 'nothing to commit' });
  });

  it('--inbox commits the inbox scope', () => {
    writeFile(dir, '.workflows/.inbox/ideas/2026-06-02--y.md', '# Y\n');
    const res = engine(dir, ['commit', '--inbox', '-m', 'workflow(inbox): capture y']);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.strictEqual(lastMessage(dir), 'workflow(inbox): capture y');
  });

  it('--plan stages the recorded storage paths and the project manifest alongside the work unit', () => {
    const m = JSON.parse(fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8'));
    m.phases = { ...(m.phases || {}), planning: { items: { auth: { status: 'in-progress', storage_paths: ['.tick/'] } } } };
    fs.writeFileSync(path.join(dir, '.workflows/payments/manifest.json'), JSON.stringify(m, null, 2) + '\n');
    writeFile(dir, '.tick/tasks-auth.jsonl', '{"id":"auth-1-1"}\n');
    writeFile(dir, '.workflows/manifest.json', JSON.stringify({ work_units: { payments: { work_type: 'epic' } }, defaults: { plan_format: 'x' } }) + '\n');
    writeFile(dir, 'unrelated.txt', 'outside the scope\n');

    const res = engine(dir, ['commit', 'payments', '-m', 'planning(payments): author task auth-1-1', '--plan', 'auth']);
    assert.strictEqual(res.committed, shortHead(dir));
    const staged = git(dir, ['show', '--name-only', 'HEAD']);
    assert.match(staged, /\.tick\/tasks-auth\.jsonl/);
    assert.match(staged, /\.workflows\/manifest\.json/);
    assert.match(git(dir, ['status', '--porcelain']), /\?\? unrelated\.txt/, 'code never rides a --plan commit');
  });

  it('--plan with empty storage_paths is the plain scoped commit plus project manifest', () => {
    const m = JSON.parse(fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8'));
    m.phases = { ...(m.phases || {}), planning: { items: { auth: { status: 'in-progress', storage_paths: [] } } } };
    fs.writeFileSync(path.join(dir, '.workflows/payments/manifest.json'), JSON.stringify(m, null, 2) + '\n');
    const res = engine(dir, ['commit', 'payments', '-m', 'planning(payments): initialize plan', '--plan', 'auth']);
    assert.strictEqual(res.committed, shortHead(dir));
  });

  it('--plan stages tracked deletions of a storage path removed from disk (restart cleanup)', () => {
    const m = JSON.parse(fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8'));
    m.phases = { ...(m.phases || {}), planning: { items: { auth: { status: 'in-progress', storage_paths: ['.tick/'] } } } };
    fs.writeFileSync(path.join(dir, '.workflows/payments/manifest.json'), JSON.stringify(m, null, 2) + '\n');
    writeFile(dir, '.tick/tasks-auth.jsonl', '{"id":"auth-1-1"}\n');
    commitAll(dir, 'seed tick storage');
    fs.rmSync(path.join(dir, '.tick'), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

    const res = engine(dir, ['commit', 'payments', '-m', 'planning(payments): restart plan', '--plan', 'auth']);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.match(git(dir, ['show', '--name-only', 'HEAD']), /\.tick\/tasks-auth\.jsonl/, 'deletion staged');
    assert.strictEqual(git(dir, ['status', '--porcelain']).trim(), '', 'no stray dirt');
  });

  it('--plan is loud on a missing planning item, missing storage_paths, and illegal entries', () => {
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--plan', 'ghost']).error, /no planning item "ghost"/);
    const m = JSON.parse(fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8'));
    m.phases = { ...(m.phases || {}), planning: { items: { auth: { status: 'in-progress' } } } };
    fs.writeFileSync(path.join(dir, '.workflows/payments/manifest.json'), JSON.stringify(m, null, 2) + '\n');
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--plan', 'auth']).error, /has no storage_paths — a pre-upgrade plan/);
    m.phases.planning.items.auth.storage_paths = ['../evil'];
    fs.writeFileSync(path.join(dir, '.workflows/payments/manifest.json'), JSON.stringify(m, null, 2) + '\n');
    assert.match(engineFails(dir, ['commit', 'payments', '-m', 'x', '--plan', 'auth']).error, /illegal storage_paths entry/);
  });

  it('rejects a missing message, missing scope, and bad work unit names', () => {
    assert.match(engineFails(dir, ['commit', 'payments']).error, /Usage: engine commit/);
    assert.match(engineFails(dir, ['commit', '-m', 'msg']).error, /Usage: engine commit/);
    assert.match(engineFails(dir, ['commit', 'payments', '--inbox', '-m', 'msg']).error, /Usage: engine commit/);
    assert.match(engineFails(dir, ['commit', '../escape', '-m', 'msg']).error, /invalid work unit name/);
    assert.match(engineFails(dir, ['commit', 'ghost', '-m', 'msg']).error, /no work unit directory/);
  });
});

describe('knowledge store rides along on every engine commit', () => {
  let dir;
  beforeEach(() => {
    dir = setupEpicFixture();
    writeFile(dir, '.workflows/.knowledge/store.msp', 'v1\n');
    commitAll(dir, 'store v1');
    // Transaction side effects (index/remove) dirty the store mid-flow —
    // simulated here since the fixture has no real knowledge CLI.
    writeFile(dir, '.workflows/.knowledge/store.msp', 'v2\n');
  });
  afterEach(() => { cleanupFixture(dir); });

  function committedFiles() {
    return git(dir, ['show', '--name-only', '--pretty=format:', 'HEAD']).trim().split('\n').sort();
  }

  it('engine commit <wu> stages .workflows/.knowledge alongside the work unit', () => {
    writeFile(dir, '.workflows/payments/discussion/auth.md', '# Auth\n');
    const res = engine(dir, ['commit', 'payments', '-m', 'discussion(payments/auth): note']);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.deepStrictEqual(committedFiles(), [
      '.workflows/.knowledge/store.msp',
      '.workflows/payments/discussion/auth.md',
    ]);
  });

  it('a transaction commit sweeps the store dirt its KB sync produced', () => {
    const res = engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'auth-flow']);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.deepStrictEqual(committedFiles(), [
      '.workflows/.knowledge/store.msp',
      '.workflows/payments/manifest.json',
    ]);
  });

  it('exists-guarded: no .knowledge directory, no pathspec, no git error', () => {
    fs.rmSync(path.join(dir, '.workflows/.knowledge'), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'drop store']);
    writeFile(dir, '.workflows/payments/discussion/auth.md', '# Auth\n');
    const res = engine(dir, ['commit', 'payments', '-m', 'discussion(payments/auth): note']);
    assert.strictEqual(res.committed, shortHead(dir));
    assert.deepStrictEqual(committedFiles(), ['.workflows/payments/discussion/auth.md']);
  });
});

describe('schema enforcement: transitions refuse what the field surface refuses', () => {
  const { VALID_PHASE_STATUSES } = require('../../skills/workflow-engine/scripts/kernel/manifest-schema.cjs');

  it('discovery is not a lifecycle phase — start/triage/complete/reopen refuse it; cancel addresses the unit', () => {
    const dir = setupGitFixture();
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify({
      name: 'payments', work_type: 'epic', status: 'in-progress',
      phases: { discovery: { items: { 'auth-flow': { routing: 'research' } } } },
    }, null, 2));
    for (const verb of ['start', 'triage', 'complete', 'reopen']) {
      assert.match(
        engineFails(dir, ['topic', verb, 'payments', 'discovery', 'auth-flow']).error,
        /non-lifecycle phase "discovery"[\s\S]*discovery tooling/
      );
    }
    // the invalid state the live drive produced must now be impossible
    const m = JSON.parse(fs.readFileSync(path.join(dir, '.workflows/payments/manifest.json'), 'utf8'));
    assert.strictEqual(m.phases.discovery.items['auth-flow'].status, undefined);
    cleanupFixture(dir);
  });

  it('the enforcement table IS the kernel schema (shared module, no mirror)', () => {
    assert.deepStrictEqual(VALID_PHASE_STATUSES.discovery, []);  // map items carry no status — empty vocabulary refuses every write
    const src = fs.readFileSync(
      path.join(__dirname, '../../skills/workflow-engine/scripts/domain/transitions.cjs'), 'utf8');
    assert.ok(src.includes("require('../kernel/manifest-schema.cjs')"),
      'transitions must require the shared schema, not mirror it');
    assert.ok(!/VALID_PHASE_STATUSES\s*=\s*{/.test(src), 'no local copy of the status table');
  });
});

describe('engine usage banner', () => {
  it('lists every topic transition, reopen included', () => {
    const res = spawnSync('node', [ENGINE, 'bogus-command'], { encoding: 'utf8' });
    assert.strictEqual(res.status, 1);
    for (const line of [
      'topic start <work-unit> <phase> <topic>',
      'topic triage <work-unit> <phase> <topic> [--concern <file> --slug <kebab> -m <message>]',
      'topic queue <work-unit> <phase> <topic>',
      'topic complete <work-unit> <phase> <topic>',
      'topic reopen <work-unit> <phase> <topic>',
      'topic supersede <work-unit> <phase> <topic> --by <topic>',
      'topic cancel <work-unit> <discovery|specification> <topic>',
      'topic reactivate <work-unit> <discovery|specification> <topic>',
      'experiment create <work-unit> <topic> --slug <kebab> (--from <research|discussion> --problem <file> | --parent <E{n}>)',
      'experiment advance <work-unit> <topic> <id>',
      'experiment approve <work-unit> <topic> <id>',
      'experiment conclude <work-unit> <topic> <id> --verdict <one line>',
      'experiment abandon <work-unit> <topic> <id> --reason <one line>',
    ]) {
      assert.ok(res.stderr.includes(`  ${line}\n`), `usage banner missing "${line}"`);
    }
  });
});

describe('engine commit --plan — hardening', () => {
  let dir;
  beforeEach(() => { dir = setupFeatureFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  function planWith(storage) {
    const m = JSON.parse(fs.readFileSync(path.join(dir, '.workflows/auth-flow/manifest.json'), 'utf8'));
    m.phases = { ...(m.phases || {}), planning: { items: { 'auth-flow': { status: 'in-progress', ...(storage !== undefined ? { storage_paths: storage } : {}) } } } };
    fs.writeFileSync(path.join(dir, '.workflows/auth-flow/manifest.json'), JSON.stringify(m, null, 2) + '\n');
  }

  it('a dangling --plan is a usage error, not a ghost lookup', () => {
    assert.match(engineFails(dir, ['commit', 'auth-flow', '-m', 'x', '--plan']).error, /Usage: engine commit/);
  });

  it('malformed storage_paths gets its own message — never the pre-upgrade hint', () => {
    planWith([123]);
    const err = engineFails(dir, ['commit', 'auth-flow', '-m', 'x', '--plan', 'auth-flow']);
    assert.match(err.error, /malformed storage_paths/);
    assert.ok(!err.error.includes('pre-upgrade'), 'present-but-wrong is not pre-upgrade');
  });

  it('the pre-upgrade repair hint names the exact command', () => {
    planWith(undefined);
    const err = engineFails(dir, ['commit', 'auth-flow', '-m', 'x', '--plan', 'auth-flow']);
    assert.match(err.error, /engine manifest set auth-flow\.planning\.auth-flow storage_paths/);
  });

  it('multiple storage paths all stage', () => {
    planWith(['.tick/', 'docs-tasks/']);
    writeFile(dir, '.tick/t.jsonl', '{}\n');
    writeFile(dir, 'docs-tasks/a.md', 'task\n');
    engine(dir, ['commit', 'auth-flow', '-m', 'planning(auth-flow): author', '--plan', 'auth-flow']);
    const staged = git(dir, ['show', '--name-only', 'HEAD']);
    assert.match(staged, /\.tick\/t\.jsonl/);
    assert.match(staged, /docs-tasks\/a\.md/);
  });
});

describe('discovery-map add-batch — name typing', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a non-string name is refused before anything persists', () => {
    const p = path.join(dir, 'topics.json');
    fs.writeFileSync(p, JSON.stringify([{ name: 5, routing: 'research', summary: 's' }]));
    const err = engineFails(dir, ['discovery-map', 'add-batch', 'payments', '--file', p]);
    assert.match(err.error, /not a legal topic name/);
  });
});

describe('engine topic start — the discovery map gates the birth of a phase item', () => {
  let dir;
  beforeEach(() => {
    dir = setupGitFixture();
    writeFile(dir, '.workflows/mapped/manifest.json', JSON.stringify({
      name: 'mapped',
      work_type: 'epic',
      status: 'in-progress',
      phases: {
        discovery: {
          items: {
            alpha: { routing: 'research', source: 'discovery' },
            beta: { routing: 'discussion', source: 'discovery' },
            gamma: { routing: 'discussion', source: 'discovery' },
            delta: { routing: 'research', source: 'discovery' },
            epsilon: { routing: 'research', source: 'discovery' },
            zeta: { routing: 'research', source: 'discovery' },
            eta: { routing: 'discussion', source: 'discovery' },
            theta: { routing: 'discussion', source: 'discovery' },
            iota: { routing: 'discussion', source: 'discovery', cancelled: true },
          },
        },
        research: { items: { gamma: { status: 'triaged' }, delta: { status: 'completed' }, zeta: { status: 'in-progress' }, eta: { status: 'triaged' }, theta: { status: 'triaged' } } },
        discussion: { items: { gamma: { status: 'in-progress' }, epsilon: { status: 'triaged' }, zeta: { status: 'in-progress' }, theta: { status: 'triaged' } } },
      },
    }, null, 2) + '\n');
    commitAll(dir, 'init');
  });
  afterEach(() => { cleanupFixture(dir); });

  it('refuses a discussion on a research-routed topic whose research has not run', () => {
    const err = engineFails(dir, ['topic', 'start', 'mapped', 'discussion', 'alpha']);
    assert.match(err.error, /discussion can't start on "alpha" — it is routed to research and nothing has started; the epic menu names its next step/);
    assert.strictEqual(readManifest(dir, 'mapped').phases.discussion.items.alpha, undefined);
  });

  it('refuses research on a discussion-routed topic — rerouting is the discovery session\'s move', () => {
    const err = engineFails(dir, ['topic', 'start', 'mapped', 'research', 'beta']);
    assert.match(err.error, /research can't start on "beta" — it is routed to discussion and nothing has started/);
  });

  it('a parked discussion stub on a research-routed topic waits for the research', () => {
    const err = engineFails(dir, ['topic', 'start', 'mapped', 'discussion', 'epsilon']);
    assert.match(err.error, /it is routed to research and nothing has started/);
    assert.strictEqual(readManifest(dir, 'mapped').phases.discussion.items.epsilon.status, 'triaged');
  });

  it('research parked on a discussion-routed topic comes first — the discussion cannot be born over it', () => {
    const err = engineFails(dir, ['topic', 'start', 'mapped', 'discussion', 'eta']);
    assert.match(err.error, /discussion can't start on "eta" — research is parked on it \(triage waiting\); research feeds discussion, so it lands first — the menu names the way in/);
    assert.strictEqual(readManifest(dir, 'mapped').phases.discussion.items.eta, undefined);
    assert.strictEqual(engine(dir, ['topic', 'start', 'mapped', 'research', 'eta']).created, false);
  });

  it('a parked research stub starts from its menu row — even beneath a live discussion, which resumes: the hold is at its door, not the engine', () => {
    // gamma: research triaged, discussion in-progress — the discussion is
    // already in session; the entry gate holds it, and complete's wait is
    // the backstop, so start (a resume, not a birth) passes.
    assert.strictEqual(engine(dir, ['topic', 'start', 'mapped', 'discussion', 'gamma']).created, false);
    const res = engine(dir, ['topic', 'start', 'mapped', 'research', 'gamma']);
    assert.strictEqual(res.status, 'in-progress');
    assert.strictEqual(res.created, false);
  });

  it('a parked discussion stub cannot be born over parked research — the stub\'s one exit is held too', () => {
    // theta: both stubs parked — the research one exits first.
    assert.match(engineFails(dir, ['topic', 'start', 'mapped', 'discussion', 'theta']).error,
      /discussion can't start on "theta" — research is parked on it \(triage waiting\); research feeds discussion, so it lands first — the menu names the way in/);
    assert.strictEqual(readManifest(dir, 'mapped').phases.discussion.items.theta.status, 'triaged', 'nothing touched');
    assert.strictEqual(engine(dir, ['topic', 'start', 'mapped', 'research', 'theta']).created, false);
  });

  it('a marker-only cancelled row refuses either birth — the reactivate is the way back', () => {
    for (const phase of ['discussion', 'research']) {
      assert.strictEqual(engineFails(dir, ['topic', 'start', 'mapped', phase, 'iota']).error,
        `${phase} can't start on "iota" — it is cancelled and stays on the map as record; the epic menu names its next step`, phase);
    }
    assert.strictEqual(readManifest(dir, 'mapped').phases.discussion.items.iota, undefined, 'nothing born');
  });

  it('the map\'s own next action passes: a fresh discussion-routed topic, a discussion after completed research', () => {
    assert.strictEqual(engine(dir, ['topic', 'start', 'mapped', 'discussion', 'beta']).created, true);
    assert.strictEqual(engine(dir, ['topic', 'start', 'mapped', 'discussion', 'delta']).created, true);
    assert.strictEqual(engine(dir, ['topic', 'start', 'mapped', 'research', 'alpha']).created, true);
  });

  it('an in-progress research resumes whatever the map shows live, and so does the in-progress discussion beside it', () => {
    // zeta: research and discussion both in flight — the lifecycle reads
    // discussing, yet neither resume is a birth; the discussion's hold sits
    // at the entry gate and at its conclusion, never on its resume.
    assert.strictEqual(engine(dir, ['topic', 'start', 'mapped', 'research', 'zeta']).created, false);
    assert.strictEqual(engine(dir, ['topic', 'start', 'mapped', 'discussion', 'zeta']).created, false);
    assert.strictEqual(readManifest(dir, 'mapped').phases.discussion.items.zeta.status, 'in-progress');
  });

  for (const workType of ['feature', 'cross-cutting']) {
    it(`every work type holds a discussion's birth for its research — a ${workType} refuses the same way`, () => {
      writeFile(dir, '.workflows/unit/manifest.json', JSON.stringify({
        name: 'unit', work_type: workType, status: 'in-progress',
        phases: { research: { items: { unit: { status: 'in-progress' } } } },
      }, null, 2) + '\n');
      assert.match(engineFails(dir, ['topic', 'start', 'unit', 'discussion', 'unit']).error,
        /discussion can't start on "unit" — research is in flight on it; research feeds discussion, so it lands first — the menu names the way in/);
      assert.strictEqual(readManifest(dir, 'unit').phases.discussion, undefined, 'nothing born');
      assert.strictEqual(engine(dir, ['topic', 'start', 'unit', 'research', 'unit']).created, false);
      engine(dir, ['topic', 'complete', 'unit', 'research', 'unit']);
      assert.strictEqual(engine(dir, ['topic', 'start', 'unit', 'discussion', 'unit']).created, true, 'landed research releases the birth');
    });
  }

  it('a topic off the map, and every non-epic work unit, are ungated by the map', () => {
    assert.strictEqual(engine(dir, ['topic', 'start', 'mapped', 'discussion', 'unmapped']).created, true);
    writeFile(dir, '.workflows/feat/manifest.json', JSON.stringify({
      name: 'feat', work_type: 'feature', status: 'in-progress',
      phases: { discovery: { items: { feat: { routing: 'research', source: 'discovery' } } } },
    }, null, 2) + '\n');
    assert.strictEqual(engine(dir, ['topic', 'start', 'feat', 'discussion', 'feat']).created, true);
  });

  it('the terminal-status refusals keep their own words ahead of the map', () => {
    engine(dir, ['topic', 'cancel', 'mapped', 'discovery', 'zeta']);
    assert.match(engineFails(dir, ['topic', 'start', 'mapped', 'research', 'zeta']).error, /is cancelled — reactivate it instead/);
    assert.match(engineFails(dir, ['topic', 'start', 'mapped', 'research', 'delta']).error, /already completed — reopen it instead/);
  });
});

describe('engine topic complete — every wait holds the conclusion shut', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  /** refund-policy's discussion is in-progress in the fixture; give it a research item and, optionally, waits of its own. */
  function withResearch(status, discussion = {}) {
    const m = epicManifest();
    m.phases.research.items['refund-policy'] = { status };
    Object.assign(m.phases.discussion.items['refund-policy'], discussion);
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
  }

  it('a discussion refuses over in-progress research, naming the ways out', () => {
    withResearch('in-progress');
    const err = engineFails(dir, ['topic', 'complete', 'payments', 'discussion', 'refund-policy']);
    assert.strictEqual(err.error, 'discussion "refund-policy" awaits research on the topic — conclude the research to release the wait');
    assert.strictEqual(readManifest(dir, 'payments').phases.discussion.items['refund-policy'].status, 'in-progress');
  });

  it('a parked research stub is the same wait', () => {
    withResearch('triaged');
    assert.match(engineFails(dir, ['topic', 'complete', 'payments', 'discussion', 'refund-policy']).error,
      /awaits research on the topic/);
  });

  it('both kinds present — both named, research first', () => {
    withResearch('in-progress', { awaiting_experiments: ['E1'] });
    const err = engineFails(dir, ['topic', 'complete', 'payments', 'discussion', 'refund-policy']);
    assert.strictEqual(err.error, 'discussion "refund-policy" awaits research on the topic — conclude the research to release the wait; and awaits experiment evidence (E1) — the wait releases when the experiment concludes or is abandoned');
  });

  it('the experiment-only wording stands', () => {
    withResearch('completed', { awaiting_experiments: ['E1', 'E2'] });
    const err = engineFails(dir, ['topic', 'complete', 'payments', 'discussion', 'refund-policy']);
    assert.strictEqual(err.error, 'discussion "refund-policy" awaits experiment evidence (E1, E2) — the wait releases when the experiment concludes or is abandoned');
  });

  it('the research landing releases the wait', () => {
    withResearch('in-progress');
    engine(dir, ['topic', 'complete', 'payments', 'research', 'refund-policy']);
    assert.strictEqual(engine(dir, ['topic', 'complete', 'payments', 'discussion', 'refund-policy']).status, 'completed');
  });

  it('research waits on experiments alone — never on the discussion beside it', () => {
    withResearch('in-progress');
    assert.strictEqual(engine(dir, ['topic', 'complete', 'payments', 'research', 'refund-policy']).status, 'completed');
  });
});

describe('a plan is held while its specification is unsettled', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  /** Give "refund-policy" a specification in the given state, and optionally a plan. */
  function withSpec(spec, planning) {
    const m = epicManifest();
    m.phases.specification = { items: { 'refund-policy': spec } };
    if (planning) m.phases.planning = { items: { 'refund-policy': planning } };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
  }

  it('the birth refuses over a specification still in motion, naming what holds it and the way in', () => {
    withSpec({ status: 'completed', sources: { 'refund-policy': { status: 'stale' } } });
    const err = engineFails(dir, ['topic', 'start', 'payments', 'planning', 'refund-policy']);
    assert.strictEqual(err.error, 'planning can\'t start on "refund-policy" — its specification is unsettled (a source has moved beneath the extraction (refund-policy)); a plan is built from a settled record, so the specification\'s entry is the way in');
    assert.strictEqual(readManifest(dir, 'payments').phases.planning, undefined, 'a refusal creates nothing');
  });

  it('the reopen refuses the same way, and a plan already in session resumes', () => {
    withSpec({ status: 'completed', reconcile_needed: 'discussion' }, { status: 'completed' });
    assert.match(engineFails(dir, ['topic', 'reopen', 'payments', 'planning', 'refund-policy']).error,
      /planning can't reopen on "refund-policy" — its specification is unsettled \(its own input moved\)/);
    withSpec({ status: 'in-progress' }, { status: 'in-progress' });
    assert.strictEqual(engine(dir, ['topic', 'start', 'payments', 'planning', 'refund-policy']).status, 'in-progress');
  });

  it('the conclusion refuses while the record moves, and the settling releases it', () => {
    withSpec({ status: 'in-progress' }, { status: 'in-progress' });
    assert.strictEqual(engineFails(dir, ['topic', 'complete', 'payments', 'planning', 'refund-policy']).error,
      'planning "refund-policy" awaits its specification (back in progress) — settle the specification to release the wait');
    engine(dir, ['topic', 'complete', 'payments', 'specification', 'refund-policy']);
    assert.strictEqual(engine(dir, ['topic', 'complete', 'payments', 'planning', 'refund-policy']).status, 'completed');
  });

  it('a settled specification holds nothing, and a terminal one releases the plan outright', () => {
    withSpec({ status: 'completed', sources: { 'refund-policy': { status: 'incorporated' } } });
    assert.strictEqual(engine(dir, ['topic', 'start', 'payments', 'planning', 'refund-policy']).created, true);
    withSpec({ status: 'cancelled' }, { status: 'in-progress' });
    assert.strictEqual(engine(dir, ['topic', 'complete', 'payments', 'planning', 'refund-policy']).status, 'completed');
  });

  it('no specification at all is the entry gate\'s business, not the engine\'s — the birth stands', () => {
    const m = epicManifest();
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    assert.strictEqual(engine(dir, ['topic', 'start', 'payments', 'planning', 'refund-policy']).created, true);
  });
});

describe('engine topic complete — a landed upstream holds a conversation shut until the session reads it', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  /** Stamp fields onto one phase item of the fixture's payments epic. */
  function withItem(phase, topic, fields) {
    const m = epicManifest();
    m.phases[phase].items[topic] = { ...(m.phases[phase].items[topic] || {}), ...fields };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    return m;
  }

  it('a discussion refuses over landed research it has not read — the flag names what landed and the way out', () => {
    // refund-policy's research landed (completed) after flagging the live
    // discussion: no wait remains, so only the unread flag holds the close.
    const m = withItem('discussion', 'refund-policy', { reconcile_needed: 'research' });
    m.phases.research.items['refund-policy'] = { status: 'completed' };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    const err = engineFails(dir, ['topic', 'complete', 'payments', 'discussion', 'refund-policy']);
    assert.strictEqual(err.error, 'discussion "refund-policy" carries reconcile_needed: research — the topic\'s research landed beneath this conversation; read what landed into the session and clear the flag before concluding');
    assert.strictEqual(readManifest(dir, 'payments').phases.discussion.items['refund-policy'].status, 'in-progress');
  });

  it('the wait outranks the flag while the research is still outstanding', () => {
    const m = withItem('discussion', 'refund-policy', { reconcile_needed: 'research' });
    m.phases.research.items['refund-policy'] = { status: 'in-progress' };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    assert.match(engineFails(dir, ['topic', 'complete', 'payments', 'discussion', 'refund-policy']).error,
      /^discussion "refund-policy" awaits research on the topic/);
  });

  it('a released evidence wait refuses the same way — discussion and research alike', () => {
    withItem('discussion', 'refund-policy', { reconcile_needed: 'experiment' });
    assert.strictEqual(engineFails(dir, ['topic', 'complete', 'payments', 'discussion', 'refund-policy']).error,
      'discussion "refund-policy" carries reconcile_needed: experiment — an experiment wait released beneath this conversation — evidence, or an abandonment; read what landed into the session and clear the flag before concluding');
    withItem('research', 'auth-flow', { reconcile_needed: 'experiment' });
    assert.strictEqual(engineFails(dir, ['topic', 'complete', 'payments', 'research', 'auth-flow']).error,
      'research "auth-flow" carries reconcile_needed: experiment — an experiment wait released beneath this conversation — evidence, or an abandonment; read what landed into the session and clear the flag before concluding');
  });

  it('the session\'s read releases it: clearing the flag lets the conclusion pass', () => {
    withItem('discussion', 'refund-policy', { reconcile_needed: 'experiment' });
    engine(dir, ['manifest', 'delete', 'payments.discussion.refund-policy', 'reconcile_needed']);
    assert.strictEqual(engine(dir, ['topic', 'complete', 'payments', 'discussion', 'refund-policy']).status, 'completed');
  });

  it('the brief flag and the roadmap flag are entry-time advisories — never a refusal', () => {
    withItem('discussion', 'refund-policy', { reconcile_needed: true });
    assert.strictEqual(engine(dir, ['topic', 'complete', 'payments', 'discussion', 'refund-policy']).status, 'completed');
    assert.strictEqual(readManifest(dir, 'payments').phases.discussion.items['refund-policy'].reconcile_needed, true, 'the flag stands for the entry advisory');
    withItem('research', 'auth-flow', { reconcile_needed: 'roadmap' });
    assert.strictEqual(engine(dir, ['topic', 'complete', 'payments', 'research', 'auth-flow']).status, 'completed');
  });

  it('other phases\' flags are the entry skill\'s alone — a flagged specification or plan completes untouched', () => {
    const m = epicManifest();
    m.phases.specification = { items: { 'refund-policy': { status: 'in-progress', reconcile_needed: 'discussion', sources: { 'refund-policy': { status: 'incorporated' } } } } };
    m.phases.planning = { items: { 'refund-policy': { status: 'in-progress', reconcile_needed: 'specification' } } };
    writeFile(dir, '.workflows/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    assert.strictEqual(engine(dir, ['topic', 'complete', 'payments', 'specification', 'refund-policy']).status, 'completed');
    // The specification's own flag is its entry's business, but it leaves the
    // record unsettled — which is the plan's wait, not the plan's own flag.
    assert.match(engineFails(dir, ['topic', 'complete', 'payments', 'planning', 'refund-policy']).error,
      /awaits its specification \(its own input moved\)/);
    engine(dir, ['manifest', 'delete', 'payments.specification.refund-policy', 'reconcile_needed']);
    assert.strictEqual(engine(dir, ['topic', 'complete', 'payments', 'planning', 'refund-policy']).status, 'completed');
    const after = readManifest(dir, 'payments');
    assert.strictEqual(after.phases.planning.items['refund-policy'].reconcile_needed, 'specification');
  });
});
