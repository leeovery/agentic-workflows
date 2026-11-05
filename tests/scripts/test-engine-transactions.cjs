'use strict';

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const harness = require('./engine-harness.cjs');
const { computeTopicLifecycle } = require('../../skills/leeway-engine/scripts/domain/derivations.cjs');

const { git, stateGit, commitAll, cleanupFixture, call, ok: engine, okSections, refuses: engineFails } = harness;

/** Run `engine render` expecting success; returns the whole stdout (sections). */
const render = (dir, args) => harness.output(dir, ['render', ...args]);

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

/** The state branch's last commit message. */
function lastMessage(dir) {
  return stateGit(dir, ['log', '-1', '--pretty=%s']).trim();
}

/** The state branch's head, short. */
function shortHead(dir) {
  return stateGit(dir, ['rev-parse', '--short', 'HEAD']).trim();
}

function readManifest(dir, wu) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.leeway', wu, 'manifest.json'), 'utf8'));
}

/** An epic manifest with plural phase items and a discovery-map entry carrying `order`. */
function epicManifest() {
  return {
    name: 'payments',
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      discovery: { items: { 'auth-flow': { order: 2, source: 'discovery' } } },
      investigation: { items: { 'auth-flow': { status: 'in-progress' }, 'fee-model': { status: 'completed' } } },
      discussion: { items: { 'session-model': { status: 'completed' }, 'refund-policy': { status: 'in-progress' } } },
    },
  };
}

/** Park a payments topic's item not started, as a message landing on it once did. */
function parkStub(dir, phase, topic) {
  const m = readManifest(dir, 'payments');
  m.phases[phase].items[topic] = { status: 'unstarted' };
  writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
}

/** A world built once over the payments epic as `manifest` gives it, every test given a copy. @param {Record<string, unknown>} manifest */
function paymentsFixture(manifest) {
  return harness.fixtureFrom('engine-tx-', (dir) => {
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
    commitAll(dir, 'init');
  });
}

const setupEpicFixture = paymentsFixture(epicManifest());

// An epic whose map carries every unit shape the cancel meets: a never-
// started topic, a started one with a live evidence wait, and decided ones.
function unitManifest() {
  return {
    name: 'payments',
    work_type: 'epic',
    status: 'in-progress',
    phases: {
      discovery: {
        items: {
          'data-export': { source: 'discovery', order: 1 },
          'auth-flow': { source: 'discovery', order: 2 },
          'fee-model': { source: 'discovery', order: 3 },
          'session-model': { source: 'discovery', order: 4 },
        },
      },
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
    },
  };
}

const setupUnitFixture = paymentsFixture(unitManifest());

describe('engine topic cancel — the discovery unit', () => {
  let dir;
  beforeEach(() => { dir = setupUnitFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a never-started topic takes the map marker alone, its order stashed, and commits', () => {
    const { res, sections } = okSections(dir, ['topic', 'cancel', 'payments', 'discovery', 'data-export']);
    assert.deepStrictEqual(res, {
      ok: true, topic: 'data-export', phase: 'discovery', status: 'cancelled',
      cancelled: [], abandoned: [], released_waits: [], closed_agents: [],
      committed: shortHead(dir), warnings: [], roadmap_reverted: [], inbox: [], next: { kind: 'continue' },
    });
    assert.deepStrictEqual(readManifest(dir, 'payments').phases.discovery.items['data-export'],
      { source: 'discovery', cancelled: true, previous_order: 1 });
    assert.strictEqual(lastMessage(dir), 'workflow(payments): cancel data-export (discovery)');
    assert.strictEqual(sections, '', 'transactions answer with pure JSON');
    assert.match(render(dir, ['topic-receipt', 'payments.discovery.data-export', '--verb', 'cancel']),
      /DISPLAY: confirmation[\s\S]*Cancelled "Data Export"\.\n/);
  });

  it('a started topic takes every conversation, releasing the waits before the holders close, abandoning the records', () => {
    harness.unreadableKnowledge(dir);
    const res = engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'auth-flow']);
    assert.deepStrictEqual(res.cancelled, [{ phase: 'discussion', previous_status: 'in-progress' }]);
    assert.deepStrictEqual(res.abandoned, ['E1', 'E1.1'], 'every open record ends abandoned, the split with its parent');
    assert.deepStrictEqual(res.released_waits, [{ phase: 'discussion', released: ['E1'], remaining: [] }]);
    assert.deepStrictEqual(res.warnings, [], 'a conversation holds no indexed artifact — the store is never asked');

    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.discussion.items['auth-flow'], { status: 'cancelled', previous_status: 'in-progress' });
    const series = m.phases.experiment.items['auth-flow'];
    assert.strictEqual(series.status, 'completed', 'every record terminal — the series settles, never a cancel');
    assert.strictEqual(series.experiments.E1.reason, 'topic cancelled');
    assert.strictEqual(series.experiments['E1.1'].reason, 'topic cancelled');
    assert.deepStrictEqual(m.phases.discovery.items['auth-flow'],
      { source: 'discovery', cancelled: true, previous_order: 2 });
    assert.strictEqual(lastMessage(dir), 'workflow(payments): cancel auth-flow (discovery)');
    assert.match(render(dir, ['topic-receipt', 'payments.discovery.auth-flow', '--verb', 'cancel']),
      /Cancelled "Auth Flow"\./);
  });

  it('a parked stub is taken with the topic — unstarted stashed like any status', () => {
    const m = unitManifest();
    m.phases.discussion.items['data-export'] = { status: 'unstarted' };
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    const res = engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'data-export']);
    assert.deepStrictEqual(res.cancelled, [{ phase: 'discussion', previous_status: 'unstarted' }]);
    assert.deepStrictEqual(readManifest(dir, 'payments').phases.discussion.items['data-export'], { status: 'cancelled', previous_status: 'unstarted' });
  });

  it('an off-map topic reads cancelled, and reactivates', () => {
    const m = unitManifest();
    m.phases.discussion.items.legacy = { status: 'cancelled', previous_status: 'completed' };
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    assert.strictEqual(computeTopicLifecycle(readManifest(dir, 'payments'), 'legacy').lifecycle, 'cancelled');
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments', 'discovery', 'legacy']).error, /"legacy" is already cancelled/);
    const res = engine(dir, ['topic', 'reactivate', 'payments', 'discovery', 'legacy']);
    assert.deepStrictEqual(res.restored, [{ phase: 'discussion', status: 'completed' }]);
    assert.strictEqual(computeTopicLifecycle(readManifest(dir, 'payments'), 'legacy').lifecycle, 'decided');
  });

  it('a legacy topic with no map row cancels through its items and reads cancelled', () => {
    const m = unitManifest();
    m.phases.discussion.items.legacy = { status: 'completed' };
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    const res = engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'legacy']);
    assert.deepStrictEqual(res.cancelled, [{ phase: 'discussion', previous_status: 'completed' }]);
    assert.strictEqual(computeTopicLifecycle(readManifest(dir, 'payments'), 'legacy').lifecycle, 'cancelled');
  });

  it('refuses an already-cancelled unit, an unknown topic, and every non-unit phase', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'data-export']);
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments', 'discovery', 'data-export']).error, /"data-export" is already cancelled/);
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments', 'discovery', 'ghost']).error,
      /no topic "ghost" — the map's topics are auth-flow, fee-model, session-model$/);
    assert.match(engineFails(dir, ['topic', 'cancel', 'ghost', 'discovery', 'data-export']).error, /manifest not found/);
    for (const phase of ['discussion', 'experiment', 'specification', 'planning', 'nonsense']) {
      assert.strictEqual(engineFails(dir, ['topic', 'cancel', 'payments', phase, 'auth-flow']).error,
        'cancel is topic-level — discovery, the map row with its discussion and experiments', phase);
    }
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments']).error, /Usage: engine topic cancel <work-unit> discovery <topic>/);
    assert.match(engineFails(dir, ['topic', 'cancel', 'payments', 'discovery', 'auth-flow', '--cascade']).error,
      /Usage: engine topic cancel <work-unit> discovery <topic>/, 'the retired flag is a usage error');
    assert.strictEqual(readManifest(dir, 'payments').phases.discussion.items['auth-flow'].status, 'in-progress', 'no refusal wrote anything');
  });

  it('the cancel gate states exactly what the cancel takes, and refuses what the menu never offers', () => {
    assert.match(render(dir, ['cancel-gate', 'payments.discovery.data-export']),
      /Cancelling \*\*Data Export\*\* takes it off the board — nothing has started, so only the map row is marked; it can be reactivated later\./);
    const started = render(dir, ['cancel-gate', 'payments.discovery.auth-flow']).replace(/\n +/g, ' ');
    assert.match(started, /Cancelling \*\*Auth Flow\*\* marks its discussion \[in-progress\] cancelled — it can be reactivated later\. 1 open experiment \(E1, with E1\.1\) ends abandoned on the register\./);
    assert.match(started, /◆ Cancel it\?/);
    assert.match(started, /\*\*`y\/yes`\*\* → Confirm cancellation/);
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'data-export']);
    assert.match(engineFails(dir, ['render', 'cancel-gate', 'payments.discovery.data-export']).error, /already cancelled — the menu never offers it/);
    assert.match(engineFails(dir, ['render', 'cancel-gate', 'payments.discussion.auth-flow']).error,
      /address must be <work_unit>\.discovery\.<topic>, got phase "discussion"/);
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
      ok: true, topic: 'data-export', phase: 'discovery', status: 'reactivated', restored: [],
      committed: shortHead(dir), warnings: [],
    });
    assert.deepStrictEqual(readManifest(dir, 'payments').phases.discovery.items['data-export'],
      { source: 'discovery', order: 1 });
    assert.strictEqual(lastMessage(dir), 'workflow(payments): reactivate data-export (discovery)');
    assert.match(render(dir, ['topic-receipt', 'payments.discovery.data-export', '--verb', 'reactivate']),
      /Reactivated "Data Export"\.\n/);
  });

  it('a started topic restores every item', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'auth-flow']);
    const res = engine(dir, ['topic', 'reactivate', 'payments', 'discovery', 'auth-flow']);
    assert.deepStrictEqual(res.restored, [{ phase: 'discussion', status: 'in-progress' }]);
    assert.strictEqual(res.status, 'reactivated');
    assert.deepStrictEqual(res.warnings, []);

    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.discussion.items['auth-flow'], { status: 'in-progress' });
    assert.deepStrictEqual(m.phases.discovery.items['auth-flow'], { source: 'discovery', order: 2 });
    assert.strictEqual(m.phases.experiment.items['auth-flow'].experiments.E1.status, 'abandoned', 'the abandoned records stand on the register');
    assert.strictEqual(lastMessage(dir), 'workflow(payments): reactivate auth-flow (discovery)');
    assert.match(render(dir, ['topic-receipt', 'payments.discovery.auth-flow', '--verb', 'reactivate']),
      /Reactivated "Auth Flow"\. Restored discussion \[in-progress\]\./);
  });

  it('a stash-less cancelled item returns to never-attempted — the per-item cancel of a status-less item stashed nothing', () => {
    const m = unitManifest();
    m.phases.discussion.items.stuck = { status: 'cancelled', reconcile_needed: 'brief' };
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    const topic = engine(dir, ['topic', 'reactivate', 'payments', 'discovery', 'stuck']);
    assert.deepStrictEqual(topic.restored, [{ phase: 'discussion', status: null }]);
    const after = readManifest(dir, 'payments');
    assert.deepStrictEqual(after.phases.discussion.items.stuck, { reconcile_needed: 'brief' }, 'the status is gone, the other fields stay');
  });

  it('a legacy topic with no map row reactivates the item carrying a stash', () => {
    const m = unitManifest();
    m.phases.discussion.items.legacy = { status: 'cancelled', previous_status: 'in-progress' };
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    const res = engine(dir, ['topic', 'reactivate', 'payments', 'discovery', 'legacy']);
    assert.deepStrictEqual(res.restored, [{ phase: 'discussion', status: 'in-progress' }]);
  });

  it('refuses a unit that is not cancelled, an unknown topic, and every non-unit phase', () => {
    assert.match(engineFails(dir, ['topic', 'reactivate', 'payments', 'discovery', 'auth-flow']).error, /"auth-flow" is not cancelled \(lifecycle: discussing\)/);
    assert.match(engineFails(dir, ['topic', 'reactivate', 'payments', 'discovery', 'ghost']).error, /no topic "ghost"/);
    for (const phase of ['discussion', 'experiment', 'specification', 'planning']) {
      assert.match(engineFails(dir, ['topic', 'reactivate', 'payments', phase, 'auth-flow']).error,
        /^reactivate is topic-level — discovery/, phase);
    }
    assert.match(engineFails(dir, ['topic', 'reactivate', 'payments', 'discovery', 'auth-flow', 'extra']).error,
      /Usage: engine topic reactivate <work-unit> discovery <topic>/);
  });

  it('the receipts refuse a state the verb has not produced', () => {
    assert.match(engineFails(dir, ['render', 'topic-receipt', 'payments.discovery.auth-flow', '--verb', 'cancel']).error,
      /"auth-flow" is not cancelled — the cancel has not run/);
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'auth-flow']);
    assert.match(engineFails(dir, ['render', 'topic-receipt', 'payments.discovery.auth-flow', '--verb', 'reactivate']).error,
      /"auth-flow" is still cancelled — the reactivate has not run/);
    assert.match(engineFails(dir, ['render', 'topic-receipt', 'payments.discussion.auth-flow', '--verb', 'cancel']).error,
      /--verb cancel addresses the Discovery unit — <work_unit>\.discovery\.<topic>, got phase "discussion"/);
  });
});

describe('engine topic start', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('creates an absent phase item with status in-progress — init-phase semantics, no commit', () => {
    const res = engine(dir, ['topic', 'start', 'payments', 'scoping', 'auth-flow']);

    assert.deepStrictEqual(res, { ok: true, topic: 'auth-flow', phase: 'scoping', status: 'in-progress', created: true });

    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.scoping.items, { 'auth-flow': { status: 'in-progress' } });
    // No commit inside — the manifest change is left for the session's cadence.
    assert.strictEqual(lastMessage(dir), 'init', 'no commit');
    assert.match(stateGit(dir, ['status', '--porcelain']), /^ M payments\/manifest\.json/m);
  });

  it('creates alongside existing items in a populated phase — siblings untouched', () => {
    const res = engine(dir, ['topic', 'start', 'payments', 'investigation', 'settlement']);

    assert.strictEqual(res.created, true);
    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.investigation.items, {
      'auth-flow': { status: 'in-progress' },
      'fee-model': { status: 'completed' },
      settlement: { status: 'in-progress' },
    });
  });

  it('resumes an existing in-progress item: created false, fields preserved', () => {
    const m0 = epicManifest();
    m0.phases.investigation.items['auth-flow'].note = 'keep me';
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(m0, null, 2) + '\n');

    const res = engine(dir, ['topic', 'start', 'payments', 'investigation', 'auth-flow']);

    assert.deepStrictEqual(res, { ok: true, topic: 'auth-flow', phase: 'investigation', status: 'in-progress', created: false });
    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.investigation.items['auth-flow'], { status: 'in-progress', note: 'keep me' });
  });

  it('rejects starting a completed item — reopen owns that path', () => {
    const err = engineFails(dir, ['topic', 'start', 'payments', 'investigation', 'fee-model']);
    assert.match(err.error, /already completed — reopen it instead/);
  });

  it('rejects starting a cancelled item — reactivate owns that path', () => {
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'refund-policy']);
    const err = engineFails(dir, ['topic', 'start', 'payments', 'discussion', 'refund-policy']);
    assert.match(err.error, /is cancelled — reactivate it instead/);
  });

  it('rejects unknown work unit, phase, and missing args — loud and specific', () => {
    assert.match(engineFails(dir, ['topic', 'start', 'ghost', 'investigation', 'auth-flow']).error, /manifest not found/);
    assert.match(engineFails(dir, ['topic', 'start', 'payments', 'nonsense', 'auth-flow']).error, /unknown or non-lifecycle phase "nonsense"/);
    assert.match(engineFails(dir, ['topic', 'start', 'payments', 'research', 'auth-flow']).error, /unknown or non-lifecycle phase "research"/);
    assert.match(engineFails(dir, ['topic', 'start', 'payments', 'investigation']).error, /Usage: engine topic start/);
    assert.match(engineFails(dir, ['topic', 'begin', 'payments', 'investigation', 'auth-flow']).error, /Usage: engine topic <start\|send\|complete\|reopen\|cancel\|reactivate\|postpone\|mailbox\|answered\|add\|add-batch\|edit\|rename\|remove\|order\|brief> <work-unit> …/);
  });

  it('refuses a specification or planning item on every unit but a quick-fix — the spec is entered at the work unit, the build planned by its cut', () => {
    const before = fs.readFileSync(path.join(dir, '.leeway/payments/manifest.json'), 'utf8');
    for (const verb of ['start', 'complete', 'reopen']) {
      assert.strictEqual(engineFails(dir, ['topic', verb, 'payments', 'specification', 'auth-flow']).error,
        "payments's spec keeps no items — it is entered at the work unit: engine enter specification payments", verb);
      assert.strictEqual(engineFails(dir, ['topic', verb, 'payments', 'planning', 'auth-flow']).error,
        "payments's build is planned by its cut — a planning item is a quick-fix's scoping's alone", verb);
    }
    assert.strictEqual(fs.readFileSync(path.join(dir, '.leeway/payments/manifest.json'), 'utf8'), before, 'nothing written');
    writeFile(dir, '.leeway/typo/manifest.json', JSON.stringify({
      name: 'typo', work_type: 'quick-fix', status: 'in-progress', phases: { scoping: { items: { typo: { status: 'in-progress' } } } },
    }, null, 2) + '\n');
    assert.strictEqual(engine(dir, ['topic', 'start', 'typo', 'specification', 'typo']).created, true, "scoping's spec keeps its item");
    assert.strictEqual(engine(dir, ['topic', 'start', 'typo', 'planning', 'typo']).created, true, "scoping's plan keeps its item");
  });

  it('refuses the build\'s places on every unit, a quick-fix\'s too — they stand by the build\'s cut, entered by `enter`', () => {
    writeFile(dir, '.leeway/typo/manifest.json', JSON.stringify({
      name: 'typo', work_type: 'quick-fix', status: 'in-progress', phases: { scoping: { items: { typo: { status: 'completed' } } } },
    }, null, 2) + '\n');
    const before = fs.readFileSync(path.join(dir, '.leeway/typo/manifest.json'), 'utf8');
    for (const verb of ['start', 'complete', 'reopen']) {
      for (const phase of ['implementation', 'review']) {
        assert.strictEqual(engineFails(dir, ['topic', verb, 'typo', phase, 'typo']).error,
          `${phase} stands by the build's cut — it is entered by \`engine enter ${phase} <work-unit>\`, never written by a topic verb`, `${verb} ${phase}`);
      }
    }
    assert.strictEqual(fs.readFileSync(path.join(dir, '.leeway/typo/manifest.json'), 'utf8'), before, 'nothing written');
  });

  it('flips an unstarted stub to in-progress — the one exit from unstarted', () => {
    parkStub(dir, 'investigation', 'parked-topic');
    const res = engine(dir, ['topic', 'start', 'payments', 'investigation', 'parked-topic']);

    assert.deepStrictEqual(res, { ok: true, topic: 'parked-topic', phase: 'investigation', status: 'in-progress', created: false });
    assert.strictEqual(readManifest(dir, 'payments').phases.investigation.items['parked-topic'].status, 'in-progress');
  });
});

describe('unstarted guards across the other verbs', () => {
  let dir;
  beforeEach(() => {
    dir = setupEpicFixture();
    parkStub(dir, 'investigation', 'parked-topic');
  });
  afterEach(() => { cleanupFixture(dir); });

  it('complete refuses an unstarted stub — parked messages must never bury as completed', () => {
    const err = engineFails(dir, ['topic', 'complete', 'payments', 'investigation', 'parked-topic']);
    assert.match(err.error, /is unstarted — its messages have never been worked; start the topic first/);
    assert.strictEqual(readManifest(dir, 'payments').phases.investigation.items['parked-topic'].status, 'unstarted');
  });

  it('reopen refuses an unstarted stub with the existing not-completed message', () => {
    const err = engineFails(dir, ['topic', 'reopen', 'payments', 'investigation', 'parked-topic']);
    assert.match(err.error, /is not completed \(status: unstarted\) — only a completed item can be reopened/);
  });

  it('a topic cancel stashes unstarted as previous_status; reactivate restores it', () => {
    parkStub(dir, 'discussion', 'parked-topic');
    engine(dir, ['topic', 'cancel', 'payments', 'discovery', 'parked-topic']);
    const cancelled = readManifest(dir, 'payments').phases.discussion.items['parked-topic'];
    assert.strictEqual(cancelled.status, 'cancelled');
    assert.strictEqual(cancelled.previous_status, 'unstarted');

    const res = engine(dir, ['topic', 'reactivate', 'payments', 'discovery', 'parked-topic']);
    assert.deepStrictEqual(res.restored, [{ phase: 'discussion', status: 'unstarted' }]);
    assert.deepStrictEqual(readManifest(dir, 'payments').phases.discussion.items['parked-topic'], { status: 'unstarted' });
  });
});

describe('pipeline completion banner matrix', () => {
  const { workunitReceipt } = require('../../skills/leeway-engine/scripts/domain/projections/transactions.cjs');
  const banner = (wt, opts) => workunitReceipt('complete', 'pay-x', wt, { pipeline: true, ...opts });

  it('every work-type label and both body variants render', () => {
    assert.ok(banner('feature').includes('Feature Completed\n\n"Pay X" has completed all pipeline phases.'));
    assert.ok(banner('bugfix').includes('Bugfix Completed\n\n"Pay X" has completed all pipeline phases.'));
    assert.ok(banner('quick-fix').includes('Quick-Fix Completed\n\n"Pay X" has completed all pipeline phases.'));
    assert.ok(banner('epic').includes('Epic Completed\n\n"Pay X" has completed all topics through review.'));
    assert.ok(banner('epic', { skippedReview: true }).includes('Epic Completed\n\n"Pay X" completed — review skipped.'));
  });
});

describe('topic verbs without section folds', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('every topic verb appends nothing — receipts are render surfaces', () => {
    assert.strictEqual(okSections(dir, ['topic', 'start', 'payments', 'investigation', 'brand-new']).sections, '',
      'start appends no sections');
    assert.strictEqual(okSections(dir, ['topic', 'reopen', 'payments', 'investigation', 'fee-model']).sections, '',
      'reopen appends no sections');
  });
});

describe('engine topic complete', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('completes an indexed-phase item and KB-indexes it — failure is a warning, no commit', () => {
    const { res, sections } = okSections(dir, ['topic', 'complete', 'payments', 'investigation', 'auth-flow']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.topic, 'auth-flow');
    assert.strictEqual(res.phase, 'investigation');
    assert.strictEqual(res.status, 'completed');
    // The fixture holds no investigation file — warn-don't-block.
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /knowledge index failed/);
    assert.strictEqual(sections, '', 'transactions answer with pure JSON');
    const advisory = render(dir, ['topic-receipt', 'payments.investigation.auth-flow', '--verb', 'complete', '--warn']);
    assert.match(advisory, /=== DISPLAY: kb warning \(emit verbatim as a text code block \(```text fence\) — do not stop; continue as the workflow instructs\) ===\n  ⚑ Knowledge indexing warning\n    The artifact is saved\. The next start retries the indexing\./);
    assert.ok(!advisory.includes('confirmation ==='), 'complete renders the advisory only — the flow owns its conclusion display');
    assert.strictEqual(render(dir, ['topic-receipt', 'payments.investigation.auth-flow', '--verb', 'complete']), '',
      'no --warn, no advisory — an empty receipt');

    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.investigation.items, {
      'auth-flow': { status: 'completed' },
      'fee-model': { status: 'completed' },
    });
    // No commit inside.
    assert.strictEqual(lastMessage(dir), 'init', 'no commit');
    assert.match(stateGit(dir, ['status', '--porcelain']), /^ M payments\/manifest\.json/m);
  });

  it('an index that fails over a store it cannot load lands in the transaction\'s warnings', () => {
    writeFile(dir, '.leeway/payments/investigation/auth-flow.md', '# Auth Flow\n\nInvestigation findings.\n');
    harness.unreadableKnowledge(dir);

    const res = engine(dir, ['topic', 'complete', 'payments', 'investigation', 'auth-flow']);

    assert.strictEqual(res.status, 'completed');
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /^knowledge index failed: loadStore: corrupted store file at .*\/\.leeway\/\.knowledge\/store\.bin: /);
  });

  it('completes a non-indexed phase with no KB attempt — empty warnings', () => {
    const m0 = epicManifest();
    m0.phases.scoping = { items: { 'auth-flow': { status: 'in-progress' }, 'fee-model': { status: 'in-progress' } } };
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(m0, null, 2) + '\n');

    const { res, sections } = okSections(dir, ['topic', 'complete', 'payments', 'scoping', 'fee-model']);

    assert.deepStrictEqual(res, { ok: true, topic: 'fee-model', phase: 'scoping', status: 'completed', warnings: [] });
    assert.strictEqual(sections, '', 'no warnings — no sections');
    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.scoping.items, {
      'auth-flow': { status: 'in-progress' },
      'fee-model': { status: 'completed' },
    });
  });

  it('rejects completing a non-existent item, unknown phase, and a cancelled item', () => {
    assert.match(engineFails(dir, ['topic', 'complete', 'payments', 'investigation', 'ghost']).error, /no investigation item "ghost"/);
    assert.match(engineFails(dir, ['topic', 'complete', 'payments', 'scoping', 'auth-flow']).error, /no scoping items/);
    assert.match(engineFails(dir, ['topic', 'complete', 'payments', 'nonsense', 'auth-flow']).error, /unknown or non-lifecycle phase "nonsense"/);
    const m0 = epicManifest();
    m0.phases.investigation.items['auth-flow'] = { status: 'cancelled' };
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(m0, null, 2) + '\n');
    assert.match(engineFails(dir, ['topic', 'complete', 'payments', 'investigation', 'auth-flow']).error, /is cancelled — reactivate it instead/);
    assert.match(engineFails(dir, ['topic', 'complete', 'payments']).error, /Usage: engine topic complete/);
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
    const res = engine(dir, ['topic', 'reopen', 'payments', 'investigation', 'fee-model']);

    assert.deepStrictEqual(res, { ok: true, topic: 'fee-model', phase: 'investigation', status: 'in-progress' });

    const m = readManifest(dir, 'payments');
    assert.deepStrictEqual(m.phases.investigation.items, {
      'auth-flow': { status: 'in-progress' },
      'fee-model': { status: 'in-progress' },
    });
    // No commit inside — the manifest change is left for the session's cadence.
    assert.strictEqual(lastMessage(dir), 'init', 'no commit');
    assert.match(stateGit(dir, ['status', '--porcelain']), /^ M payments\/manifest\.json/m);
  });

  /** A quick-fix whose scoping concluded, its implementation item as given. @param {Record<string, any>} implementation */
  function scoped(implementation) {
    writeFile(dir, '.leeway/typo/manifest.json', JSON.stringify({
      name: 'typo', work_type: 'quick-fix', status: 'in-progress',
      phases: {
        scoping: { items: { typo: { status: 'completed' } } },
        implementation: { items: { typo: implementation } },
      },
    }, null, 2) + '\n');
  }

  it('every hop flags completed items only — a scoping reopen leaves an in-progress implementation alone', () => {
    scoped({ status: 'in-progress' });

    const res = engine(dir, ['topic', 'reopen', 'typo', 'scoping', 'typo']);

    assert.strictEqual(res.reconcile_flagged, undefined);
    assert.strictEqual(readManifest(dir, 'typo').phases.implementation.items.typo.reconcile_needed, undefined);
  });

  it('never clobbers an existing downstream flag', () => {
    scoped({ status: 'completed', reconcile_needed: 'review' });

    const res = engine(dir, ['topic', 'reopen', 'typo', 'scoping', 'typo']);

    assert.strictEqual(res.reconcile_flagged, undefined);
    assert.strictEqual(readManifest(dir, 'typo').phases.implementation.items.typo.reconcile_needed, 'review', 'the earlier flag preserved');
  });

  it('refuses a discussion, whatever it stands at — a decided one reopens through a message sent to it', () => {
    const before = fs.readFileSync(path.join(dir, '.leeway/payments/manifest.json'), 'utf8');
    for (const topic of ['session-model', 'refund-policy']) {
      assert.strictEqual(engineFails(dir, ['topic', 'reopen', 'payments', 'discussion', topic]).error,
        'a discussion decided, or closed into its spec, reopens through a message sent to it (topic send), never topic reopen');
    }
    assert.strictEqual(fs.readFileSync(path.join(dir, '.leeway/payments/manifest.json'), 'utf8'), before);
  });

  it('quick-fix scoping reopen flags the completed implementation — the pipeline hop', () => {
    scoped({ status: 'completed' });

    const res = engine(dir, ['topic', 'reopen', 'typo', 'scoping', 'typo']);

    assert.deepStrictEqual(res.reconcile_flagged, [{ phase: 'implementation', topic: 'typo' }]);
    assert.strictEqual(readManifest(dir, 'typo').phases.implementation.items.typo.reconcile_needed, 'scoping');
  });

  it('refuses an in-progress item — nothing touched', () => {
    const before = fs.readFileSync(path.join(dir, '.leeway/payments/manifest.json'), 'utf8');
    const err = engineFails(dir, ['topic', 'reopen', 'payments', 'investigation', 'auth-flow']);
    assert.match(err.error, /is not completed \(status: in-progress\) — only a completed item can be reopened/);
    assert.strictEqual(fs.readFileSync(path.join(dir, '.leeway/payments/manifest.json'), 'utf8'), before);
  });

  it('refuses a cancelled item — reactivate owns that path', () => {
    const m = epicManifest();
    m.phases.investigation.items['auth-flow'] = { status: 'cancelled' };
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    const err = engineFails(dir, ['topic', 'reopen', 'payments', 'investigation', 'auth-flow']);
    assert.match(err.error, /is cancelled — reactivate it instead/);
  });

  it('rejects unknown work unit, phase, missing item, and missing args — loud and specific', () => {
    assert.match(engineFails(dir, ['topic', 'reopen', 'ghost', 'investigation', 'fee-model']).error, /manifest not found/);
    assert.match(engineFails(dir, ['topic', 'reopen', 'payments', 'nonsense', 'fee-model']).error, /unknown or non-lifecycle phase "nonsense"/);
    assert.match(engineFails(dir, ['topic', 'reopen', 'payments', 'scoping', 'fee-model']).error, /no scoping items/);
    assert.match(engineFails(dir, ['topic', 'reopen', 'payments', 'investigation', 'ghost']).error, /no investigation item "ghost"/);
    assert.match(engineFails(dir, ['topic', 'reopen', 'payments', 'investigation']).error, /Usage: engine topic reopen/);
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
      specification: { items: { 'auth-flow': { status: 'in-progress' } } },
    },
  };
}

const setupFeatureFixture = harness.fixtureFrom('engine-tx-', (dir) => {
  writeFile(dir, '.leeway/auth-flow/manifest.json', JSON.stringify(featureManifest(), null, 2) + '\n');
  // The completed phase artifacts (the re-index discovers only files that
  // exist on disk).
  writeFile(dir, '.leeway/auth-flow/topics/auth-flow/log.md', '# Discussion\n');
  writeFile(dir, '.leeway/auth-flow/imports/notes.md', '# Notes\n');
  writeFile(dir, '.leeway/auth-flow/seeds/seed.md', '# Seed\n');
  writeFile(dir, '.leeway/auth-flow/.state/discovery-gap-analysis.md', '# Analysis\n');
  // A log, never indexed.
  writeFile(dir, '.leeway/auth-flow/discovery/session-001.md', '# Session 001\n');
  // A store that cannot be loaded, checkout-local and never committed: a
  // removal or re-index fails deterministically, so warn-don't-block is
  // provable as a warning.
  writeFile(dir, '.leeway/.gitignore', '.knowledge/\n');
  harness.unreadableKnowledge(dir);
  commitAll(dir, 'init');
});

/** A quick-fix whose pipeline is finished (derived next phase `done`), over a knowledge store that cannot be loaded. */
const setupFinishedQuickFixFixture = harness.fixtureFrom('engine-tx-', (dir) => {
  writeFile(dir, '.leeway/caching/manifest.json', JSON.stringify({
    name: 'caching',
    work_type: 'quick-fix',
    status: 'in-progress',
    phases: {
      scoping: { items: { caching: { status: 'completed' } } },
      implementation: { items: { caching: { status: 'completed' } } },
      review: { items: { caching: { status: 'completed' } } },
    },
  }, null, 2) + '\n');
  // Deterministic KB failure: a store that cannot be loaded.
  writeFile(dir, '.leeway/.gitignore', '.knowledge/\n');
  harness.unreadableKnowledge(dir);
  commitAll(dir, 'init');
});

describe('engine workunit complete', () => {
  let dir;
  beforeEach(() => { dir = setupFeatureFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('sets status completed, stamps completed_at today, commits with the given message', () => {
    writeFile(dir, 'unrelated.txt', 'outside the scope\n');
    const { res, sections } = okSections(dir, ['workunit', 'complete', 'auth-flow', '-m', 'workflow(auth-flow): complete feature pipeline']);

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
    assert.strictEqual(sections, '', 'transactions answer with pure JSON');
    assert.match(render(dir, ['workunit-receipt', 'auth-flow', '--verb', 'complete']),
      /=== DISPLAY: confirmation \(emit verbatim as a text code block \(```text fence\) after the response\) ===\n"Auth Flow" marked as completed\./);
  });

  it('purges the work unit\'s scratch cache on complete — untracked scratch leaves no dirt', () => {
    writeFile(dir, '.leeway/.cache/auth-flow/discussion/auth-flow/review-1.md', 'scratch\n');
    engine(dir, ['workunit', 'complete', 'auth-flow', '-m', 'workflow(auth-flow): complete feature pipeline']);
    assert.strictEqual(fs.existsSync(path.join(dir, '.leeway/.cache/auth-flow')), false, 'cache dir removed');
    assert.strictEqual(git(dir, ['status', '--porcelain']).trim() + stateGit(dir, ['status', '--porcelain']).trim(), '', 'no stray dirt');
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
    assert.strictEqual(okSections(dir, ['workunit', 'reactivate', 'auth-flow']).sections, '',
      'transactions answer with pure JSON');
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
    assert.match(engineFails(dir, ['workunit', 'finish', 'auth-flow']).error, /Usage: engine workunit <create\|import\|complete\|cancel\|reactivate\|pivot\|absorb\|position>/);
  });

  it('completes a cancelled unit with a finished pipeline directly, restoring its chunks', () => {
    // A cancelled finished pipeline completes directly (reactivate stays open
    // as the revisit path) — and cancellation removed the unit's chunks, so
    // the transition re-indexes them (warn-don't-block).
    const finishedDir = setupFinishedQuickFixFixture();
    engine(finishedDir, ['workunit', 'cancel', 'caching']);
    const res = engine(finishedDir, ['workunit', 'complete', 'caching', '-m', 'workflow(caching): complete quick-fix pipeline']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'completed');
    assert.strictEqual(res.committed, shortHead(finishedDir));
    // Cancellation removed the unit's chunks; completion runs ONE scoped bulk
    // re-index of the unit. The store cannot be loaded, so that pass fails → a
    // single warn-don't-block warning, the completion standing.
    assert.strictEqual(res.warnings.length, 1, res.warnings.join('\n'));
    assert.match(res.warnings[0], /^knowledge index failed: loadStore: corrupted store file at /);

    const m = readManifest(finishedDir, 'caching');
    assert.strictEqual(m.status, 'completed');
    assert.strictEqual(m.completed_at, new Date().toISOString().slice(0, 10));
    assert.strictEqual(lastMessage(finishedDir), 'workflow(caching): complete quick-fix pipeline');
    cleanupFixture(finishedDir);
  });
});

describe('engine workunit cancel', () => {
  let dir;
  beforeEach(() => { dir = setupFeatureFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  it('purges the work unit\'s scratch cache on cancel', () => {
    writeFile(dir, '.leeway/.cache/auth-flow/discussion/auth-flow/deep-dive-1.md', 'scratch\n');
    engine(dir, ['workunit', 'cancel', 'auth-flow']);
    assert.strictEqual(fs.existsSync(path.join(dir, '.leeway/.cache/auth-flow')), false, 'cache dir removed');
    assert.strictEqual(git(dir, ['status', '--porcelain']).trim() + stateGit(dir, ['status', '--porcelain']).trim(), '', 'no stray dirt');
  });

  it('sets status cancelled, removes KB chunks (failure is a warning), commits the fixed message', () => {
    const { res, sections } = okSections(dir, ['workunit', 'cancel', 'auth-flow']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'cancelled');
    assert.strictEqual(res.committed, shortHead(dir));
    // The store cannot be loaded — warn-don't-block: the cancellation still
    // landed and the failure is reported, not thrown.
    assert.strictEqual(res.warnings.length, 1);
    assert.match(res.warnings[0], /^knowledge remove failed: loadStore: corrupted store file at /);

    const m = readManifest(dir, 'auth-flow');
    assert.strictEqual(m.status, 'cancelled');
    assert.strictEqual(m.completed_at, undefined);
    assert.strictEqual(lastMessage(dir), 'workflow(auth-flow): mark as cancelled');
    assert.strictEqual(sections, '', 'transactions answer with pure JSON');
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

  it('re-indexes after a cancel in one scoped bulk pass — failure is a warning', () => {
    engine(dir, ['workunit', 'cancel', 'auth-flow']);
    const res = engine(dir, ['workunit', 'reactivate', 'auth-flow']);

    assert.strictEqual(res.status, 'in-progress');
    assert.strictEqual(res.previous_status, 'cancelled');
    // Cancellation removed the unit's chunks; reactivation re-indexes them in a
    // SINGLE scoped bulk pass over the unit — completed phase artifacts,
    // shape-valid imports/seeds, analysis caches. The store cannot be loaded,
    // so the pass fails → one warn-don't-block warning.
    assert.strictEqual(res.warnings.length, 1, res.warnings.join('\n'));
    assert.match(res.warnings[0], /^knowledge index failed: loadStore: corrupted store file at /);
    assert.strictEqual(lastMessage(dir), 'workflow(auth-flow): reactivate work unit');
  });

  it('epic reactivate re-indexes in one scoped bulk pass — failure is a warning', () => {
    const epicDir = harness.setupGitFixture('engine-tx-');
    writeFile(epicDir, '.leeway/payments/manifest.json', JSON.stringify({
      name: 'payments', work_type: 'epic', status: 'in-progress',
      phases: {
        discovery: { items: { 'auth-flow': { source: 'discovery' } } },
        discussion: { items: { 'auth-flow': { status: 'completed' } } },
      },
    }, null, 2) + '\n');
    writeFile(epicDir, '.leeway/payments/topics/auth-flow/log.md', '# Discussion\n');
    // Deterministic KB failure: a store that cannot be loaded.
    writeFile(epicDir, '.leeway/.gitignore', '.knowledge/\n');
    harness.unreadableKnowledge(epicDir);
    commitAll(epicDir, 'init');

    engine(epicDir, ['workunit', 'cancel', 'payments']);
    const res = engine(epicDir, ['workunit', 'reactivate', 'payments']);

    assert.strictEqual(res.status, 'in-progress');
    // The epic's re-index is one scoped bulk pass; the unloadable store
    // makes the single pass fail → one warning.
    assert.strictEqual(res.warnings.length, 1, res.warnings.join('\n'));
    assert.match(res.warnings[0], /^knowledge index failed: loadStore: corrupted store file at /);
    cleanupFixture(epicDir);
  });

  it('reactivates a completed unit whose pipeline is finished — the revisit path stays open', () => {
    // The unit surfaces as finalising (or in-progress once a topic is
    // reopened) — reactivate must not deadlock the reopen path.
    const finishedDir = setupFinishedQuickFixFixture();
    engine(finishedDir, ['workunit', 'complete', 'caching', '-m', 'workflow(caching): complete quick-fix pipeline']);
    const res = engine(finishedDir, ['workunit', 'reactivate', 'caching']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'in-progress');
    assert.strictEqual(res.previous_status, 'completed');
    // Completed units retained their chunks — no re-indexing, no warnings.
    assert.deepStrictEqual(res.warnings, []);
    const m = readManifest(finishedDir, 'caching');
    assert.strictEqual(m.status, 'in-progress');
    assert.ok(!('completed_at' in m), 'stale completed_at must be cleared');
    assert.strictEqual(lastMessage(finishedDir), 'workflow(caching): reactivate work unit');
    cleanupFixture(finishedDir);
  });

  it('reactivates a cancelled unit whose pipeline is finished — complete stays open as the other path', () => {
    const finishedDir = setupFinishedQuickFixFixture();
    engine(finishedDir, ['workunit', 'cancel', 'caching']);
    const res = engine(finishedDir, ['workunit', 'reactivate', 'caching']);

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.status, 'in-progress');
    assert.strictEqual(res.previous_status, 'cancelled');
    // Cancellation removed the unit's chunks — the cancelled reactivation
    // re-index runs as one scoped bulk pass (the store cannot be loaded: it
    // fails, one warn-don't-block warning).
    assert.strictEqual(res.warnings.length, 1, res.warnings.join('\n'));
    assert.match(res.warnings[0], /^knowledge index failed: loadStore: corrupted store file at /);
    assert.strictEqual(readManifest(finishedDir, 'caching').status, 'in-progress');
    cleanupFixture(finishedDir);
  });

  it('rejects an in-progress unit and a status outside the shared vocabulary', () => {
    assert.match(engineFails(dir, ['workunit', 'reactivate', 'auth-flow']).error, /already in-progress/);

    const m = featureManifest();
    m.status = 'archived';
    writeFile(dir, '.leeway/auth-flow/manifest.json', JSON.stringify(m, null, 2) + '\n');
    assert.match(
      engineFails(dir, ['workunit', 'reactivate', 'auth-flow']).error,
      /not completed or cancelled \(status: archived\)/);
  });
});

describe('schema enforcement: transitions refuse what the field surface refuses', () => {
  const { VALID_PHASE_STATUSES } = require('../../skills/leeway-engine/scripts/kernel/manifest-schema.cjs');

  it('discovery is not a lifecycle phase — start/complete/reopen refuse it; cancel addresses the unit', () => {
    const dir = harness.setupGitFixture('engine-tx-');
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify({
      name: 'payments', work_type: 'epic', status: 'in-progress',
      phases: { discovery: { items: { 'auth-flow': {} } } },
    }, null, 2));
    for (const verb of ['start', 'complete', 'reopen']) {
      assert.match(
        engineFails(dir, ['topic', verb, 'payments', 'discovery', 'auth-flow']).error,
        /non-lifecycle phase "discovery"[\s\S]*discovery tooling/
      );
    }
    // the invalid state the live drive produced must now be impossible
    const m = JSON.parse(fs.readFileSync(path.join(dir, '.leeway/payments/manifest.json'), 'utf8'));
    assert.strictEqual(m.phases.discovery.items['auth-flow'].status, undefined);
    cleanupFixture(dir);
  });

  it('the enforcement table IS the kernel schema (shared module, no mirror)', () => {
    assert.deepStrictEqual(VALID_PHASE_STATUSES.discovery, []);  // map items carry no status — empty vocabulary refuses every write
    const src = fs.readFileSync(
      path.join(__dirname, '../../skills/leeway-engine/scripts/domain/transitions.cjs'), 'utf8');
    assert.ok(src.includes("require('../kernel/manifest-schema.cjs')"),
      'transitions must require the shared schema, not mirror it');
    assert.ok(!/VALID_PHASE_STATUSES\s*=\s*{/.test(src), 'no local copy of the status table');
  });
});

describe('engine usage banner', () => {
  it('lists every topic transition, reopen included', () => {
    const res = call(process.cwd(), ['bogus-command']);
    assert.strictEqual(res.code, 1);
    for (const line of [
      'topic start <work-unit> <phase> <topic>',
      'topic send <work-unit> <topic> --from <sender> --content <file> --slug <kebab>',
      'topic mailbox <work-unit> <topic>',
      'topic answered <work-unit> <topic> <NNN-slug> --entry <id>',
      'topic complete <work-unit> <phase> <topic>',
      'topic reopen <work-unit> <phase> <topic>',
      'topic cancel <work-unit> discovery <topic>',
      'topic reactivate <work-unit> discovery <topic>',
      'experiment create <work-unit> <topic> --slug <kebab> (--from discussion --problem <file> --question <id> | --parent <E{n}>)',
      'experiment advance <work-unit> <topic> <id>',
      'experiment approve <work-unit> <topic> <id>',
      'experiment conclude <work-unit> <topic> <id> --verdict <one line>',
      'experiment abandon <work-unit> <topic> <id> --reason <one line>',
    ]) {
      assert.ok(res.stderr.includes(`  ${line}\n`), `usage banner missing "${line}"`);
    }
  });
});

describe('engine topic start — the discovery map gates the birth of a phase item', () => {
  const mapped = harness.fixtureFrom('engine-tx-', (dir) => {
    writeFile(dir, '.leeway/mapped/manifest.json', JSON.stringify({
      name: 'mapped',
      work_type: 'epic',
      status: 'in-progress',
      phases: {
        discovery: {
          items: {
            beta: { source: 'discovery' },
            gamma: { source: 'discovery' },
            epsilon: { source: 'discovery' },
            zeta: { source: 'discovery' },
            delta: { source: 'discovery' },
            iota: { source: 'discovery', cancelled: true },
          },
        },
        discussion: { items: { gamma: { status: 'in-progress' }, epsilon: { status: 'unstarted' }, zeta: { status: 'in-progress' }, delta: { status: 'completed' } } },
      },
    }, null, 2) + '\n');
    commitAll(dir, 'init');
  });
  let dir;
  beforeEach(() => { dir = mapped(); });
  afterEach(() => { cleanupFixture(dir); });

  it('a marker-only cancelled row refuses the birth — the reactivate is the way back', () => {
    assert.strictEqual(engineFails(dir, ['topic', 'start', 'mapped', 'discussion', 'iota']).error,
      'discussion can\'t start on "iota" — it is cancelled and stays on the map as record; the epic menu names its next step');
    assert.strictEqual(readManifest(dir, 'mapped').phases.discussion.items.iota, undefined, 'nothing born');
  });

  it('the map\'s own next action passes: a fresh topic is born, a parked stub flips, a live one resumes', () => {
    assert.strictEqual(engine(dir, ['topic', 'start', 'mapped', 'discussion', 'beta']).created, true);
    assert.deepStrictEqual(engine(dir, ['topic', 'start', 'mapped', 'discussion', 'epsilon']), { ok: true, topic: 'epsilon', phase: 'discussion', status: 'in-progress', created: false });
    assert.strictEqual(engine(dir, ['topic', 'start', 'mapped', 'discussion', 'gamma']).created, false);
  });

  it('a topic off the map is refused, writing nothing; a non-epic work unit is ungated by the map', () => {
    const before = fs.readFileSync(path.join(dir, '.leeway/mapped/manifest.json'), 'utf8');
    assert.strictEqual(engineFails(dir, ['topic', 'start', 'mapped', 'discussion', 'unmapped']).error,
      'discussion can\'t start on "unmapped" — it is not on the map; a topic starts from its row on the epic menu');
    assert.strictEqual(fs.readFileSync(path.join(dir, '.leeway/mapped/manifest.json'), 'utf8'), before);
    writeFile(dir, '.leeway/feat/manifest.json', JSON.stringify({
      name: 'feat', work_type: 'feature', status: 'in-progress',
      phases: { discovery: { items: { feat: { source: 'discovery' } } } },
    }, null, 2) + '\n');
    assert.strictEqual(engine(dir, ['topic', 'start', 'feat', 'discussion', 'feat']).created, true);
  });

  it('the terminal-status refusals keep their own words ahead of the map', () => {
    engine(dir, ['topic', 'cancel', 'mapped', 'discovery', 'zeta']);
    assert.match(engineFails(dir, ['topic', 'start', 'mapped', 'discussion', 'zeta']).error, /is cancelled — reactivate it instead/);
    assert.match(engineFails(dir, ['topic', 'start', 'mapped', 'discussion', 'delta']).error, /already completed — reopen it instead/);
  });
});

describe('engine topic complete — a reconcile flag is its phase start\'s, never a refusal', () => {
  let dir;
  beforeEach(() => { dir = setupEpicFixture(); });
  afterEach(() => { cleanupFixture(dir); });

  /** Stamp fields onto one phase item of the fixture's payments epic. */
  function withItem(phase, topic, fields) {
    const m = epicManifest();
    m.phases[phase].items[topic] = { ...(m.phases[phase].items[topic] || {}), ...fields };
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    return m;
  }

  it('an investigation\'s flag is an entry-time advisory — never a refusal', () => {
    withItem('investigation', 'auth-flow', { reconcile_needed: true });
    assert.strictEqual(engine(dir, ['topic', 'complete', 'payments', 'investigation', 'auth-flow']).status, 'completed');
    assert.strictEqual(readManifest(dir, 'payments').phases.investigation.items['auth-flow'].reconcile_needed, true, 'the flag stands for the entry advisory');
  });

  it('other phases\' flags are their start\'s alone — a flagged scoping completes untouched', () => {
    const m = epicManifest();
    m.phases.scoping = { items: { 'refund-policy': { status: 'in-progress', reconcile_needed: 'investigation' } } };
    writeFile(dir, '.leeway/payments/manifest.json', JSON.stringify(m, null, 2) + '\n');
    assert.strictEqual(engine(dir, ['topic', 'complete', 'payments', 'scoping', 'refund-policy']).status, 'completed');
    const after = readManifest(dir, 'payments');
    assert.strictEqual(after.phases.scoping.items['refund-policy'].reconcile_needed, 'investigation');
  });
});
