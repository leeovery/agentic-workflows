'use strict';

// ---------------------------------------------------------------------------
// `engine workunit split` (ledger-engine/scripts/domain/workunit-split.cjs;
// 21.8.9, 21.8.10, 21.7.4): topics leaving a building unit for a new epic
// while the migration runs — the epic made with its description and Claude's
// first discovery log verbatim, registered, its map approved holding the
// topics numbered in the order they stood, so each starts where it stood and
// none in discovery; each topic moved whole, its folder — log, brief and mail
// — and its items, each link to the unit's assets rebased to resolve from
// where it now sits and each within its folder as written, and a link into
// it from a document of the unit's following it; its ledger lines
// carried, its record read on the epic's topic with each cite where its file
// went and its copy following, the knowledge store indexing it there at once;
// its places in the unit's cache purged; a roadmap item joined to it
// re-aimed, its source following; the unit keeping the rest; the commit held
// for the migration's. The other way out, to the roadmap: `topic postpone`
// takes a topic of the building unit while the migration runs, before the cut
// writes the build, and refuses once it has (P3); pulled into the new epic
// once the migration's commit lands, the topic reads the record it left, its
// entries as they stood and never current. Split again it finds everything
// done, and naming a topic the epic it made lacks is refused; a session
// killed after each step, split again, leaves what a run never killed leaves,
// the store among it. Every refusal writes nothing.
//
// Layer: verb, the kills spawned. World: the cut and the merges'
// (migration-world.cjs), made once and copied for each test that writes,
// once for the refusals, which write nothing, and once split whole for the
// kills to be held to.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { ok, callAsync, refuses, git, statePath, layout, writeState, readState, treeSnapshot, refusedPristine, killedAt, cleanupFixture, keywordOnlyKnowledge, indexedFiles } = harness;
const { SESSION, cutMigration, settledState, stateUnborn, refusedUntouched } = require('./migration-world.cjs');

const FINISH = require('../../skills/ledger-migrate/scripts/migrations/081-reshape-finish.cjs');

const HELD = 'held for the migration\'s commit';
const LOG = '# Discovery Session 001\n\nWhat buyers see, apart from the shop.\n';

/** @type {string} */
let dir;

/** The cut and the merges' world, at a fresh folder. */
const world = () => cutMigration(fs.mkdtempSync(path.join(os.tmpdir(), 'workunit-split-')));

/** An engine call in the conversation the migration runs in. @param {string[]} args @param {string} [at] */
const run = (args, at = dir) => ok(at, args, { env: SESSION });

/** A call that must refuse, writing nothing: its error. @param {string[]} args @param {import('./engine-harness.cjs').CallOptions} [opts] */
const untouched = (args, opts = { env: SESSION }) => refusedUntouched(dir, args, opts, harness);

/**
 * The split of `topics` from shop into `into`, Claude's log written where
 * the directive drafts it: its argv.
 * @param {string} [topics] @param {{into?: string, description?: string, at?: string}} [given]
 */
function split(topics = 'reviews,gifts', { into = 'storefront', description = 'What buyers see', at = dir } = {}) {
  return ['workunit', 'split', 'shop', '--topics', topics, '--into', into, '--description', description, '--session-log-file', writeState(at, layout.cache('scratch', 'storefront.md'), LOG)];
}

/** Each of a record's entries: its text, and where each cite is. @param {{text: string, cites: {path: string}[]}[]} entries */
const shown = (entries) => entries.map(({ text, cites }) => [text, cites.map(({ path: file }) => file)]);

/** A unit's manifest. @param {string} unit */
const manifest = (unit) => JSON.parse(readState(dir, layout.manifest(unit)));

/** The knowledge store built over the world, as a set-up project's first index builds it. */
async function indexed() {
  keywordOnlyKnowledge(dir);
  const res = await callAsync(dir, ['knowledge', 'index'], { env: SESSION });
  assert.strictEqual(res.code, 0, res.stderr);
}

const STARS = '](../../assets/stars.md)';

const MOVED = ['reviews', 'gifts'];

/** The store a clean split leaves over one holding `files`: each moved topic's copy at its new path, its old one gone. @param {string[]} files */
const splitStore = (files) => [...files.filter((file) => !MOVED.some((topic) => file === layout.record('shop', topic))), ...MOVED.map((topic) => layout.record('storefront', topic))].sort();

describe('topics leave a building unit for a new epic (21.8.9, 21.8.10)', () => {
  beforeEach(() => { dir = world(); });
  afterEach(() => cleanupFixture(path.dirname(dir)));

  it('the epic made, registered and its map approved, each topic where it stood; each moved whole, its lines carried and read there, its copy following, and a link into it from a document it left following it; the roadmap following; the unit keeping the rest; the commit held', () => {
    writeState(dir, layout.brief('shop', 'reviews'), `${readState(dir, layout.brief('shop', 'reviews'))}\nIts talk is in [the log](log.md).\n`);
    const weights = layout.topic('shop', 'weights', 'log.md');
    writeState(dir, weights, `${readState(dir, weights)}\nReviews weigh in too: [their talk](../reviews/log.md).\n`);
    const before = treeSnapshot(dir);

    assert.deepStrictEqual(run(split()), {
      ok: true,
      work_unit: 'shop',
      epic: 'storefront',
      topics: ['reviews', 'gifts'],
      session_log: statePath(dir, layout.session('storefront', '001')),
      carried: 5,
      committed: null,
      warnings: [],
      roadmap_reaimed: ['star-ratings'],
      roadmap_sources_rewritten: [{ item: 'star-ratings', from: layout.topic('shop', 'reviews', 'log.md'), to: layout.topic('storefront', 'reviews', 'log.md') }],
      note: HELD,
    });

    const afterwards = treeSnapshot(dir);
    const linking = [layout.brief('shop', 'reviews'), layout.topic('shop', 'reviews', 'log.md')];
    assert.deepStrictEqual(linking.map((rel) => before[rel].includes(STARS)), [true, true], 'its log and brief link the unit\'s assets');
    const folder = Object.entries(before).filter(([rel]) => rel.startsWith(layout.topic('shop', 'reviews', '')))
      .map(([rel, text]) => [rel.replace(/^shop\//, 'storefront/'), text.replaceAll(STARS, '](../../../shop/assets/stars.md)')]);
    assert.deepStrictEqual(folder.map(([rel]) => rel).sort(), [layout.brief('storefront', 'reviews'), layout.topic('storefront', 'reviews', 'log.md'), layout.mailbox('storefront', 'reviews', '001-photos.md')]);
    assert.deepStrictEqual(folder.map(([rel]) => [rel, afterwards[rel]]), folder, 'its folder moved whole, every file as it was but each link to the unit\'s assets, rebased');
    for (const rel of linking.map((at) => at.replace(/^shop\//, 'storefront/'))) {
      const target = /** @type {string} */ (/\]\(([^)]*stars\.md)\)/.exec(afterwards[rel])?.[1]);
      assert.strictEqual(path.posix.join(path.posix.dirname(rel), target), layout.assets('shop', 'stars.md'), `${rel}'s link resolves to the unit's asset`);
    }
    const brief = layout.brief('storefront', 'reviews');
    assert.ok(Object.hasOwn(afterwards, path.posix.join(path.posix.dirname(brief), /** @type {string} */ (/\[the log\]\(([^)]+)\)/.exec(afterwards[brief])?.[1]))),
      'its brief\'s link to its own log resolves where the folder went');
    assert.deepStrictEqual(Object.keys(afterwards).filter((rel) => rel.startsWith(layout.topic('shop', 'reviews', ''))), []);
    const into = /** @type {string} */ (/\[their talk\]\(([^)]+)\)/.exec(afterwards[weights])?.[1]);
    assert.strictEqual(path.posix.join(path.posix.dirname(weights), into), layout.topic('storefront', 'reviews', 'log.md'), 'a link from a document the split left follows the topic it names');
    assert.strictEqual(afterwards[layout.session('storefront', '001')], LOG);

    const { created, phases: { discovery: { approved_at: approved, ...map }, ...phases }, ...epic } = manifest('storefront');
    assert.deepStrictEqual({ epic, map, phases }, {
      epic: { name: 'storefront', work_type: 'epic', status: 'in-progress', description: 'What buyers see' },
      map: { items: { gifts: { source: 'discovery', summary: 'Gifts', order: 1 }, reviews: { source: 'migration-seeded', order: 2 } } },
      phases: { discussion: { items: { reviews: { status: 'in-progress' } } } },
    });
    assert.match(created, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(approved, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    const shop = manifest('shop');
    const project = JSON.parse(afterwards[layout.projectManifest]);
    assert.deepStrictEqual([Object.keys(shop.phases.discovery.items), Object.keys(shop.phases.discussion.items), Object.keys(shop.phases.specification.items)],
      [['weights', 'wishlist'], ['weights', 'wishlist'], ['weights']]);
    assert.deepStrictEqual(project.work_units.storefront, { work_type: 'epic' });
    assert.deepStrictEqual([project.roadmap.items['star-ratings'].pulled_to, project.roadmap.items['star-ratings'].sources],
      [{ work_unit: 'storefront', topic: 'reviews' }, [layout.topic('storefront', 'reviews', 'log.md')]]);

    const record = run(['ledger', 'record', 'storefront', 'reviews']);
    const log = layout.topic('storefront', 'reviews', 'log.md');
    assert.deepStrictEqual([shown(record.questions), shown(record.decisions), record.decisions[0].assets.map(({ path: file }) => file)], [
      [['Who may leave a review?', [log]], ['Who moderates reviews?', [log]]],
      [['Buyers alone.', [log, layout.brief('storefront', 'reviews')]]],
      [layout.assets('shop', 'stars.md')],
    ]);
    assert.strictEqual(refuses(dir, ['ledger', 'record', 'shop', 'reviews'], { env: SESSION }).error, 'ledger record: shop has no topic "reviews"');
    assert.deepStrictEqual([layout.record('storefront', 'reviews'), layout.record('shop', 'reviews')].map((rel) => Object.hasOwn(afterwards, rel)), [true, false]);
    assert.ok(stateUnborn(dir));
  });

  it('the knowledge store read at once: each moved topic\'s record copy indexed at its new path, its old one gone; its places in the unit\'s cache purged, every phase\'s', async () => {
    await indexed();
    const places = ['discovery', 'discussion'].map((phase) => layout.cache('shop', phase, 'reviews'));
    for (const place of places) writeState(dir, `${place}/entered.json`, '{}\n');
    const before = indexedFiles(dir);
    assert.ok(MOVED.every((topic) => before.includes(layout.record('shop', topic))), 'the store held the topics\' record copies');

    run(split());

    assert.deepStrictEqual(indexedFiles(dir), splitStore(before));
    assert.deepStrictEqual(places.map((place) => fs.existsSync(statePath(dir, place))), [false, false], 'its places in the unit\'s cache purged');
  });

  it('split again, it finds everything done: nothing carried, nothing written', () => {
    run(split());
    const done = settledState(dir, ['storefront']);

    assert.deepStrictEqual(run(split()), {
      ok: true, work_unit: 'shop', epic: 'storefront', topics: ['reviews', 'gifts'], session_log: statePath(dir, layout.session('storefront', '001')), carried: 0, committed: null, warnings: [], note: HELD,
    });
    assert.deepStrictEqual(settledState(dir, ['storefront']), done);
  });

  it('P3: to the roadmap, postpone takes a topic of the building unit while the migration runs, held for its commit; once the cut writes the build, it refuses', () => {
    const postponed = run(['topic', 'postpone', 'shop', 'wishlist', '--horizon', 'later']);

    assert.deepStrictEqual([postponed.roadmap, postponed.committed, postponed.note], [
      { name: 'wishlist', horizon: 'later', born_map: false, born_horizon: true, reverted_join: false, from_archive: false }, null, HELD,
    ]);
    assert.deepStrictEqual(JSON.parse(readState(dir, layout.projectManifest)).roadmap.items.wishlist.postponed_from, { work_unit: 'shop', topic: 'wishlist' });
    assert.ok(stateUnborn(dir));

    writeState(dir, layout.manifest('shop'), JSON.stringify({ ...manifest('shop'), build: { position: 'auto' } }));
    assert.strictEqual(untouched(['topic', 'postpone', 'shop', 'reviews', '--horizon', 'later']),
      'postponing "reviews" is refused — shop\'s build has begun, so its map is closed: a decision that must change is settled in the build, and abandoning the work is the unit\'s cancel, through manage on the start menu');
  });

  it('split again naming a topic the epic it made lacks on its map: refused, naming it, nothing written', () => {
    run(split('reviews'));

    assert.strictEqual(untouched(split('reviews,gifts')),
      'workunit split: storefront, made by a split cut short, has no topic "gifts" on its map — split again naming the topics it was made with');
  });

  it('P3: the topic postponed, pulled into the new epic once the migration\'s commit lands, reads the record it left, its entries as they stood — the one read of them, none indexed, none current there or in the new epic', async () => {
    run(split());
    run(['topic', 'postpone', 'shop', 'wishlist', '--horizon', 'later']);
    FINISH.run({ projectDir: dir, reportUpdate: () => {}, reportSkip: () => {} });
    run(['commit', '--migrations', '-m', "chore: apply Ledger's migrations"]);
    await indexed();

    run(['roadmap', 'pull-forward', 'wishlist', '--into', 'storefront']);

    const earlier = run(['ledger', 'earlier', 'shop', 'wishlist']);
    assert.deepStrictEqual([earlier.live, earlier.earlier, earlier.questions.map(({ text }) => text)], [false, true, ['May a wishlist be shared?']]);
    const [asked] = earlier.questions;
    assert.deepStrictEqual(run(['ledger', 'record', 'shop', 'wishlist']).questions, []);
    assert.deepStrictEqual(run(['ledger', 'map', 'storefront', 'wishlist']).questions, []);
    const record = run(['ledger', 'record', 'storefront']);
    assert.ok([...record.questions, ...record.other_topics].every(({ id }) => id !== asked.id), 'none of its entries shows in the new epic');
    assert.ok(!indexedFiles(dir).includes(layout.record('shop', 'wishlist')), 'none of its entries indexed');
  });

  it('a topic set aside on the unit\'s map, and a topic\'s folder in both units: refused, nothing written', () => {
    run(['topic', 'postpone', 'shop', 'wishlist', '--horizon', 'later']);

    assert.strictEqual(untouched(split('reviews,wishlist')), 'workunit split: shop\'s wishlist is postponed — a topic set aside stays where it is');

    writeState(dir, layout.topic('storefront', 'reviews', 'log.md'), '# Reviews\n');
    assert.strictEqual(untouched(split()), 'workunit split: reviews\'s folder is in both shop and storefront');
  });

  it('outside the migration: once the state branch has its first commit, refused, nothing written', () => {
    const args = split();
    git(statePath(dir), ['add', '-A']);
    git(statePath(dir), ['commit', '-q', '-m', 'the migration\'s commit']);

    assert.strictEqual(refusedPristine(dir, args, { env: SESSION }).error,
      'workunit split: topics leave a unit for a new epic only while the migration runs — the state branch has its first commit, so the migration is done');
  });
});

describe('a split killed part-way finishes on its next run', () => {
  /** @type {Record<string, unknown>} */
  let clean;
  before(() => {
    const at = world();
    run(split(undefined, { at }), at);
    clean = settledState(at, ['storefront']);
    cleanupFixture(path.dirname(at));
  });
  beforeEach(() => { dir = world(); });
  afterEach(() => cleanupFixture(path.dirname(dir)));

  for (const [when, at] of /** @type {[string, import('./engine-harness.cjs').KillPoint][]} */ ([
    ['the epic\'s log written, its manifest not', { method: 'renameSync', file: layout.session('storefront', '001'), when: 'after' }],
    ['the epic made, no folder moved', { method: 'renameSync', file: layout.manifest('storefront'), when: 'after' }],
    ['the folder moved, its lines not carried', { method: 'renameSync', file: layout.topic('storefront', 'reviews'), when: 'after' }],
    ['the lines carried, the unit still holding the topics', { method: 'renameSync', file: layout.ledger, when: 'after' }],
    ['the topics gone from the unit, the epic not registered', { method: 'renameSync', file: layout.manifest('shop'), when: 'after' }],
    ['the epic registered, the copies not yet following', { method: 'renameSync', file: `.ledger/${layout.projectManifest}`, when: 'after' }],
  ])) {
    it(`killed with ${when}: split again, the state is a clean run's`, () => {
      killedAt(at, dir, split(), { env: SESSION });

      run(split());

      assert.deepStrictEqual(settledState(dir, ['storefront']), clean);
    });
  }
});

describe('a split killed between the copies and the store finishes on its next run, the store a clean run\'s', () => {
  beforeEach(() => { dir = world(); });
  afterEach(() => cleanupFixture(path.dirname(dir)));

  for (const [when, at] of /** @type {[string, import('./engine-harness.cjs').KillPoint][]} */ ([
    ['a moved topic\'s copy written at its new path', { method: 'renameSync', file: layout.record('storefront', 'reviews'), when: 'after' }],
    ['a moved topic\'s old copy removed', { method: 'rmSync', file: layout.record('shop', 'reviews'), when: 'after' }],
  ])) {
    it(`killed with ${when}, the store not yet told: split again, each moved copy indexed at its new path, its old one gone`, async () => {
      await indexed();
      const before = indexedFiles(dir);
      killedAt(at, dir, split(), { env: SESSION });

      run(split());

      assert.deepStrictEqual(indexedFiles(dir), splitStore(before));
    });
  }
});

describe('the refusals, nothing written', () => {
  before(() => { dir = world(); });
  after(() => cleanupFixture(path.dirname(dir)));

  it('argv of another shape, no topic named or one twice, a topic not on the unit\'s map, a unit that is none or no epic', () => {
    assert.deepStrictEqual([
      untouched(['workunit', 'split', 'shop', '--topics', 'reviews', '--into', 'storefront']),
      untouched(split('')),
      untouched(split('reviews,reviews')),
      untouched(split('reviews,nowhere')),
      untouched(split().map((arg) => (arg === 'shop' ? 'nowhere' : arg))),
      untouched(split().map((arg) => (arg === 'shop' ? 'caching' : arg))),
    ], [
      'Usage: engine workunit split <epic> --topics <a,b,…> --into <new-epic> --description <text> --session-log-file <path>',
      'workunit split: --topics names the topics leaving, comma-separated',
      'workunit split: --topics names reviews twice',
      'workunit split: shop\'s map has no topic "nowhere"',
      'workunit split: there is no work unit "nowhere"',
      'workunit split: caching is a cross-cutting unit — only an epic\'s topics leave for a new epic',
    ]);
  });

  it('an epic\'s name that is no name a unit takes, the unit\'s own, or one another unit holds; an empty description; a session log that cannot be read', () => {
    assert.deepStrictEqual([
      untouched(split(undefined, { into: 'Store.Front' })),
      untouched(split(undefined, { into: 'shop' })),
      untouched(split(undefined, { into: 'caching' })),
      untouched(split(undefined, { into: 'gateway' })),
      untouched(split(undefined, { description: '  ' })),
      untouched([...split().slice(0, -1), 'nowhere.md']),
    ], [
      'workunit split: Work unit name "Store.Front" must be a kebab-case slug — lowercase letters and digits, joined by single hyphens',
      'workunit split: shop\'s topics leave for another epic — --into names shop itself',
      'workunit split: work unit "caching" already exists — the topics leave for a new epic',
      'workunit split: work unit "gateway" already exists — the topics leave for a new epic',
      'workunit split: --description is empty — the new epic\'s one line',
      'workunit split: session log file not found: nowhere.md',
    ]);
  });

  it('lines to carry, and no session to tag the carry with', () => {
    assert.strictEqual(untouched(split(), {}),
      'workunit split: shop\'s topics hold ledger entries, which the split carries to the new epic in this conversation — Claude Code hands every command it runs a session id, and this one has none');
  });
});
