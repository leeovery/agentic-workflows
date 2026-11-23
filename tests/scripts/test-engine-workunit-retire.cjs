'use strict';

// ---------------------------------------------------------------------------
// `engine workunit retire` (ledger-engine/scripts/domain/workunit-retire.cjs;
// 21.7.3, 21.7.5, 19.6.7): a cross-cutting unit leaving the registry while
// the migration runs — its folder kept whole in the product's assets, its
// manifest, its spec and its topic's log among it, nothing of it deleted; off
// the registry, its name free for a unit made later, which meets none of its
// entries; its ledger lines the product's, `ledger product` showing its
// product-wide entries and its questions with each cite where the move took
// its file, and no unit's record showing any; no copy rendered nor the
// knowledge base told, which the migration's finish does (21.9.1); its
// cache purged; each epic's topic promoted to
// it gone from that epic's map and items (P4); a roadmap source under its
// folder following its file; its legacy files among the product's, a log's
// links to one and to their folder following them, once; the commit held
// for the migration's. Retired again it finds everything done; a session
// killed after each step, retired again, leaves what a run never killed
// leaves. Every refusal writes nothing.
// The records directive's rule that a cross-cutting unit's entries are
// product-wide is test-migration-079.cjs's.
//
// Layer: verb, the kills spawned. World: the cut and the merges'
// (migration-world.cjs), made once and copied for each test that writes,
// once for the refusals, which write nothing, and once retired whole for
// the kills to be held to.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { ok, git, statePath, layout, writeState, treeSnapshot, refusedPristine, killedAt, cleanupFixture } = harness;
const { SESSION, cutMigration, settledState, stateUnborn, refusedUntouched } = require('./migration-world.cjs');

const RETIRE = ['workunit', 'retire', 'caching'];
const HELD = 'held for the migration\'s commit';

/** @type {string} */
let dir;

/** The cut and the merges' world, at a fresh folder. */
const world = () => cutMigration(fs.mkdtempSync(path.join(os.tmpdir(), 'workunit-retire-')));

/** An engine call in the conversation the migration runs in. @param {string[]} args @param {string} [at] */
const run = (args, at = dir) => ok(at, args, { env: SESSION });

/** A call that must refuse, writing nothing: its error. @param {string[]} args @param {import('./engine-harness.cjs').CallOptions} [opts] */
const untouched = (args, opts = { env: SESSION }) => refusedUntouched(dir, args, opts, harness);

/** A product-wide entry as `ledger product` shows it: its text and where each cite is. @param {{text: string, cites: {path: string}[]}} entry */
const shown = ({ text, cites }) => [text, cites.map(({ path: file }) => file)];

describe('a cross-cutting unit leaves the registry (21.7.3, 21.7.5, 19.6.7)', () => {
  beforeEach(() => { dir = world(); });
  afterEach(() => cleanupFixture(path.dirname(dir)));

  it('21.S26: its folder kept whole in the product\'s assets, off the registry, its entries the product record\'s and no unit\'s, its questions the product\'s, each cite where its file went; the epic\'s promoted topic gone (P4); the roadmap\'s source following; no copy rendered, which the finish does (21.9.1); the commit held', () => {
    const before = treeSnapshot(dir);

    assert.deepStrictEqual(run(RETIRE), {
      ok: true,
      work_unit: 'caching',
      kept: statePath(dir, layout.productAssets('caching')),
      carried: 5,
      promoted: [{ work_unit: 'gateway', topic: 'invalidation' }],
      committed: null,
      warnings: [],
      roadmap_sources_rewritten: [{ item: 'edge-cache', from: layout.topic('caching', 'invalidation', 'log.md'), to: layout.productAssets('caching', 'topics', 'invalidation', 'log.md') }],
      note: HELD,
    });

    const afterwards = treeSnapshot(dir);
    const kept = Object.entries(before).filter(([rel]) => rel.startsWith(layout.unit('caching', ''))).map(([rel, text]) => [layout.productAssets(rel), text]);
    assert.deepStrictEqual(kept.map(([rel]) => rel).sort(), [
      layout.productAssets(layout.assets('caching', 'specs', 'caching.md')), layout.productAssets(layout.manifest('caching')), layout.productAssets(layout.topic('caching', 'invalidation', 'log.md')),
    ]);
    assert.deepStrictEqual(kept.map(([rel]) => [rel, afterwards[rel]]), kept, 'nothing of it changed or deleted');
    assert.deepStrictEqual(Object.keys(afterwards).filter((rel) => rel.startsWith(layout.unit('caching', ''))), []);

    const project = JSON.parse(afterwards[layout.projectManifest]);
    const gateway = JSON.parse(afterwards[layout.manifest('gateway')]);
    assert.deepStrictEqual(Object.keys(project.work_units), ['gateway', 'shop']);
    assert.deepStrictEqual([Object.keys(gateway.phases.discovery.items), Object.keys(gateway.phases.discussion.items)], [['auth', 'limits', 'errors'], ['auth', 'limits', 'errors']]);
    assert.deepStrictEqual(project.roadmap.items['edge-cache'].sources, [layout.productAssets('caching', 'topics', 'invalidation', 'log.md')]);

    const product = run(['ledger', 'product']);
    const spec = layout.productAssets('caching', 'assets', 'specs', 'caching.md');
    const log = layout.productAssets('caching', 'topics', 'invalidation', 'log.md');
    assert.deepStrictEqual([product.findings.map(shown), product.decisions.map(shown), product.decisions[0].assets.map(({ path: file }) => file), product.questions.map(shown)], [
      [['An entry lives an hour at most.', [spec, log]]],
      [['Every write purges its keys.', [spec]]],
      [spec],
      [['When is a cached key purged?', [log]], ['Do reads ever purge a key?', [log]]],
    ]);
    assert.ok(!Object.hasOwn(run(['ledger', 'product', 'gateway', 'errors']), 'questions'), 'read for a topic, the product record alone: its questions are the product\'s conversation\'s');
    assert.deepStrictEqual(Object.entries(afterwards).filter(([rel]) => rel.startsWith(layout.knowledge())), Object.entries(before).filter(([rel]) => rel.startsWith(layout.knowledge())), 'no copy rendered');
    assert.ok(stateUnborn(dir));
  });

  it('its cache purged, the old cache\'s reports the migration copied into its earlier/ with it', () => {
    writeState(dir, layout.cache('caching', 'discussion', 'invalidation', 'entered.json'), '{}\n');
    writeState(dir, `${layout.cache('caching')}/earlier/discussion/invalidation/review-001.md`, 'an old report\n');

    run(RETIRE);

    assert.ok(!fs.existsSync(statePath(dir, layout.cache('caching'))), 'its cache purged');
  });

  it('its legacy files go among the product\'s, its log\'s links to one and to their folder following them, and a redo rebasing neither again', () => {
    const log = layout.topic('caching', 'invalidation', 'log.md');
    writeState(dir, layout.assets('caching', 'legacy', 'notes.md'), '# Notes\n');
    writeState(dir, log, `${fs.readFileSync(statePath(dir, log), 'utf8')}\nSee [the notes](../../assets/legacy/notes.md), in [the legacy](../../assets/legacy/).\n`);

    run(RETIRE);
    run(RETIRE);

    const notes = layout.productAssets('legacy', 'caching', 'notes.md');
    assert.strictEqual(fs.readFileSync(statePath(dir, notes), 'utf8'), '# Notes\n');
    assert.ok(!fs.existsSync(statePath(dir, layout.productAssets('caching', 'assets', 'legacy'))), 'nothing of them left in the kept folder');
    assert.match(fs.readFileSync(statePath(dir, layout.productAssets(log)), 'utf8'), /See \[the notes\]\(\.\.\/\.\.\/\.\.\/legacy\/caching\/notes\.md\), in \[the legacy\]\(\.\.\/\.\.\/\.\.\/legacy\/caching\/\)\.\n$/);
  });

  it('its name freed: a unit made later under it meets none of the retired unit\'s entries, which stay the product\'s', () => {
    run(RETIRE);
    const log = writeState(dir, layout.cache('scratch', 'caching.md'), '# Discovery Session 001\n\nA cache of its own.\n');

    run(['workunit', 'create', 'caching', 'feature', '--description', 'A cache of its own', '--session-log-file', log]);

    const record = run(['ledger', 'record', 'caching']);
    assert.deepStrictEqual([record.questions, record.findings, record.decisions], [[], [], []]);
    assert.deepStrictEqual(run(['ledger', 'product']).decisions.map(shown), [['Every write purges its keys.', [layout.productAssets('caching', 'assets', 'specs', 'caching.md')]]]);
  });

  it('retired again, it finds everything done: nothing carried, nothing written', () => {
    run(RETIRE);
    const done = settledState(dir);

    assert.deepStrictEqual(run(RETIRE), {
      ok: true, work_unit: 'caching', kept: statePath(dir, layout.productAssets('caching')), carried: 0, promoted: [], committed: null, warnings: [], note: HELD,
    });
    assert.deepStrictEqual(settledState(dir), done);
  });

  it('outside the migration: once the state branch has its first commit, refused, nothing written', () => {
    git(statePath(dir), ['add', '-A']);
    git(statePath(dir), ['commit', '-q', '-m', 'the migration\'s commit']);

    assert.strictEqual(refusedPristine(dir, RETIRE, { env: SESSION }).error,
      'workunit retire: a unit leaves the registry only while the migration runs — the state branch has its first commit, so the migration is done');
  });

  it('its folder\'s place in the product\'s assets held beside its own folder: refused, nothing written', () => {
    writeState(dir, layout.productAssets('caching', 'notes.md'), '# Notes\n');

    assert.strictEqual(untouched(RETIRE), 'workunit retire: .product/assets/caching is held already, so caching\'s folder has nowhere to go');
  });
});

describe('a retire killed part-way finishes on its next run', () => {
  /** @type {Record<string, unknown>} */
  let clean;
  before(() => {
    const at = world();
    run(RETIRE, at);
    clean = settledState(at);
    cleanupFixture(path.dirname(at));
  });
  beforeEach(() => { dir = world(); });
  afterEach(() => cleanupFixture(path.dirname(dir)));

  for (const [when, at] of /** @type {[string, import('./engine-harness.cjs').KillPoint][]} */ ([
    ['its lines carried, its folder not moved', { method: 'renameSync', file: layout.ledger, when: 'after' }],
    ['its folder moved, the epic still holding the topic promoted to it', { method: 'renameSync', file: layout.productAssets('caching'), when: 'after' }],
    ['the promoted topic gone, the unit still on the registry', { method: 'renameSync', file: layout.manifest('gateway'), when: 'after' }],
    ['the unit off the registry', { method: 'renameSync', file: `.ledger/${layout.projectManifest}`, when: 'after' }],
  ])) {
    it(`killed with ${when}: retired again, the state is a clean run's`, () => {
      killedAt(at, dir, RETIRE, { env: SESSION });

      run(RETIRE);

      assert.deepStrictEqual(settledState(dir), clean);
    });
  }
});

describe('the refusals, nothing written', () => {
  before(() => { dir = world(); });
  after(() => cleanupFixture(path.dirname(dir)));

  it('argv of another shape, a name that is no unit\'s or no name a unit takes, a unit of a type the reshape keeps', () => {
    assert.deepStrictEqual([
      untouched(['workunit', 'retire']),
      untouched([...RETIRE, 'shop']),
      untouched(['workunit', 'retire', 'nowhere']),
      untouched(['workunit', 'retire', 'Not.A.Unit']),
      untouched(['workunit', 'retire', 'gateway']),
    ], [
      'Usage: engine workunit retire <work-unit>',
      'Usage: engine workunit retire <work-unit>',
      'workunit retire: there is no work unit "nowhere"',
      'workunit retire: Work unit name "Not.A.Unit" must be a kebab-case slug — lowercase letters and digits, joined by single hyphens',
      'workunit retire: gateway\'s type, epic, is one the reshape keeps — only a unit of a type it retires leaves the registry',
    ]);
  });

  it('lines to carry, and no session to tag the carry with', () => {
    assert.strictEqual(untouched(RETIRE, {}),
      'workunit retire: caching holds ledger entries, which the retire carries to the product\'s place in this conversation — Claude Code hands every command it runs a session id, and this one has none');
  });
});
