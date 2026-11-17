'use strict';

// ---------------------------------------------------------------------------
// The pipeline simulation from the state the migration committed, once the
// cut and the merges' verbs have run over today's layout: the cross-cutting
// unit retired, two topics of the building epic split into a new one and a
// third postponed to the roadmap, the epic then cut by the migration — its
// phase's piece, its verifier passing it, joined into the plan the cut takes — and the
// directive's check passing, then the reshape's finish (081) and the
// migration's commit. The retired unit's product-wide entries the product
// record's and no unit's, its questions the product's, which the product's
// conversation opens on and no topic's opening reads, its spec and its
// topic's log reference in the product's assets, the oracle's audit passing
// over the state as committed (21.S26); the epic nothing of which was built
// sitting in discussion, its specs and its plan reference in its assets,
// its topics where they stood, and once every topic is decided its one spec
// written fresh through the review and ready to build (21.S27); a topic
// split away entered in discussion on its new epic, reading the record and
// the mail it carried, none of it an earlier record, and the topic
// postponed, pulled into that epic, opening on the record it left, its
// entries as they stood (21.8.9, 18.8.17); and the epic, whole once its
// topics left, entering its build on the phase its cut wrote (21.S31). The tracker's tasks the
// directive closes for a unit nothing of which was built are the task
// driver's (`task close`), which nothing from the spec's entry to ready to
// build reads.
//
// Layer: simulation. World: the cut and the merges' (migration-world.cjs)
// taken through the verbs, the finish and the commit, and made ready for a
// sim, once per process and copied for each scenario; each replays the
// engine calls the skill prose makes, in prose order, and the oracle
// (pipeline-oracle.cjs) audits the whole state after every mutation.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const harness = require('./engine-harness.cjs');
const { statePath, layout, writeState } = harness;
const { templateFolder, copyWorld } = require('./discovery-test-utils.cjs');
const { SESSION, cutMigration, stateUnborn } = require('./migration-world.cjs');
const { Sim, readyForSim, enterEntry, decideTopic, handoff, specEntry, specBuilt } = require('./pipeline-world.cjs');
const { auditState } = require('./pipeline-oracle.cjs');

const FINISH = require('../../skills/ledger-migrate/scripts/migrations/081-reshape-finish.cjs');

/**
 * The cut and the merges' world taken through the verbs, the finish and the
 * commit, at `folder`, made ready for a sim, the records indexed into the
 * store its knowledge setup brings, as the next start indexes them.
 * @param {string} folder
 */
async function buildMigrated(folder) {
  const dir = cutMigration(folder);
  const log = writeState(dir, layout.cache('scratch', 'storefront.md'), '# Discovery Session 001\n\nWhat buyers see, apart from the shop.\n');
  writeState(dir, layout.cache('migrate', 'cut-and-merges', 'shop', 'plan.json'), JSON.stringify({ answers: { leaving: { to: 'epic', epic: 'storefront' } } }));
  for (const args of [
    ['workunit', 'retire', 'caching'],
    ['workunit', 'split', 'shop', '--topics', 'reviews,gifts', '--into', 'storefront', '--description', 'What buyers see', '--session-log-file', log],
    ['topic', 'postpone', 'shop', 'wishlist', '--horizon', 'later'],
  ]) harness.ok(dir, args, { env: SESSION });
  writeState(dir, layout.cache('migrate', 'cut-and-merges', 'shop', 'phases', '1.json'), JSON.stringify({
    phase: { name: 'Weights', goal: 'Ties broken by price.', sections: ['1'], relies_on: [] },
    scenarios: ['Given two items of one weight, when they are listed, then the cheaper comes first.'],
    notes: [],
    corrections: [],
  }));
  writeState(dir, layout.cache('migrate', 'cut-and-merges', 'shop', 'phases', '1.findings.txt'), '');
  const { plan } = harness.ok(dir, ['migrate', 'join', 'shop', '--directive', '080-cut-and-merges'], { env: SESSION });
  harness.ok(dir, ['cut', 'shop', '--migrating', '--file', plan], { env: SESSION });
  assert.strictEqual(harness.ok(dir, ['migrate', 'check', '080-cut-and-merges'], { env: SESSION }).passed, true, 'the cut and the merges\' check passes');
  FINISH.run({ projectDir: dir, reportUpdate: () => {}, reportSkip: () => {} });
  harness.ok(dir, ['commit', '--migrations', '-m', "chore: apply Ledger's migrations"], { env: SESSION });
  assert.ok(!stateUnborn(dir), 'the migration\'s commit gives the state branch its first commit');
  readyForSim(dir);
  const indexed = await harness.callAsync(dir, ['knowledge', 'index'], { env: SESSION });
  assert.strictEqual(indexed.code, 0, indexed.stderr);
  return dir;
}

/** @type {string} */
let made;

/** The migrated world, copied for one sim. */
const migrated = () => copyWorld(made, fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-cut-')));

describe('pipeline simulation: from the migration\'s cut and merges', () => {
  /** @type {Sim} */
  let sim;
  before(async () => { made = await buildMigrated(templateFolder('pipeline-cut-template-')); });
  beforeEach(() => { sim = new Sim(migrated); });
  afterEach(() => { sim.destroy(); });

  it('21.S26: the cross-cutting unit\'s product-wide entries the product record\'s and no unit\'s, its questions the product\'s, which the product\'s conversation opens on and no topic\'s does, its spec and its topic\'s log reference in the product\'s assets, off the registry; the oracle\'s audit passing over the state the migration committed (21.7.3, 21.7.5, 19.6.7, 21.6.9)', () => {
    auditState(sim.dir, 'the state the migration committed');

    sim.run(['enter', 'discovery', 'product']);
    const call = /^product: `node \S+ (ledger product)`$/m.exec(sim.sections)?.[1];
    assert.strictEqual(call, 'ledger product', sim.sections);
    const product = JSON.parse(sim.read(call.split(' ')));
    assert.deepStrictEqual([product.findings.map(({ text }) => text), product.decisions.map(({ text }) => text), product.questions.map(({ text }) => text)],
      [['An entry lives an hour at most.'], ['Every write purges its keys.'], ['When is a cached key purged?', 'Do reads ever purge a key?']]);
    enterEntry(sim, 'gateway', 'discussion', 'errors');
    const topicCall = /^product: `node \S+ (ledger product gateway errors)`$/m.exec(sim.sections)?.[1];
    assert.strictEqual(topicCall, 'ledger product gateway errors', sim.sections);
    const topicRead = JSON.parse(sim.read(topicCall.split(' ')));
    assert.deepStrictEqual([topicRead.findings.map(({ text }) => text), topicRead.decisions.map(({ text }) => text), Object.hasOwn(topicRead, 'questions')],
      [['An entry lives an hour at most.'], ['Every write purges its keys.'], false], 'a topic\'s opening reads the product record, never the product\'s questions');
    assert.deepStrictEqual([layout.assets('caching', 'specs', 'caching.md'), layout.topic('caching', 'invalidation', 'log.md')].map((rel) => fs.existsSync(statePath(sim.dir, layout.productAssets(rel)))), [true, true]);
    assert.deepStrictEqual(Object.keys(JSON.parse(fs.readFileSync(statePath(sim.dir, layout.projectManifest), 'utf8')).work_units).sort(), ['gateway', 'shop', 'storefront']);
    assert.match(fs.readFileSync(statePath(sim.dir, layout.knowledge('product.md')), 'utf8'), /^Every write purges its keys\.$/m);
  });

  it('21.S27: the epic nothing of which was built sits in discussion, its three specs and its plan reference in its assets, its topics where they stood, the topic it promoted gone; once every topic is decided its one spec is written fresh, through the review and ready to build (21.8.2, 21.8.3)', () => {
    const wu = 'gateway';
    assert.deepStrictEqual(['auth', 'limits', 'errors'].map((spec) => fs.existsSync(statePath(sim.dir, layout.assets(wu, 'specs', `${spec}.md`)))), [true, true, true]);
    assert.ok(fs.existsSync(statePath(sim.dir, layout.assets(wu, 'plans', 'auth', 'planning.md'))));
    const { phases } = sim.manifest(wu);
    assert.deepStrictEqual([Object.keys(phases).sort(), Object.entries(phases.discussion.items).map(([topic, { status }]) => [topic, status])],
      [['discovery', 'discussion'], [['auth', 'completed'], ['limits', 'completed'], ['errors', 'in-progress']]]);

    enterEntry(sim, wu, 'discussion', 'errors');
    const [open] = JSON.parse(sim.read(['ledger', 'record', wu, 'errors'])).questions;
    sim.run(['ledger', 'decide', `${wu}.discussion.errors`, '--answers', open.id], null, JSON.stringify({ by: 'person', who_moved_whom: 'none', text: 'A code and a message.', why: 'The person said so.' }));
    const { next } = decideTopic(sim, wu, 'errors');
    assert.deepStrictEqual(next, { kind: 'handoff', skill: 'ledger-specification-process', args: ['epic', wu] });
    handoff(sim, [`/${next.skill}`, ...next.args].join(' '));

    const topics = ['auth', 'limits', 'errors'];
    specEntry(sim, wu, topics);
    sim.run(['brief', 'sweep', wu]);
    sim.write(`.ledger/.cache/${wu}/specification/sweep.json`, { candidates: [], messages: [], builder_calls: [] });
    assert.deepStrictEqual(sim.run(['sweep', 'take', wu]).next, { kind: 'continue' });
    sim.run(['brief', 'spec-writer', wu]);
    const statements = topics.map((topic, at) => `1.1.${at + 1} ${topic} holds as decided. [${JSON.parse(sim.read(['ledger', 'record', wu, topic])).decisions[0].id}]`);
    sim.write(`.ledger/${wu}/spec.md`, [
      '# The public API', '', '## 1. The API', '', '### 1.1 As decided', '', ...statements.flatMap((statement) => [statement, '']),
      '## 1-S. Scenarios for §1', '', '1.S1 Given a call, when it is made, then the API holds as decided. (1.1.1, 1.1.2, 1.1.3)', '',
    ].join('\n'));
    assert.deepStrictEqual(sim.run(['spec', 'land', wu]).invented, []);

    specBuilt(sim, wu);

    assert.strictEqual(sim.manifest(wu).build.position, 'step');
  });

  it('a topic split away enters discussion on its new epic, reading the record it carried, none of it an earlier record; the topic postponed, pulled into that epic, opens on the record it left, its entries as they stood (21.8.9, 18.8.17)', () => {
    enterEntry(sim, 'storefront', 'discussion', 'reviews');
    assert.deepStrictEqual(JSON.parse(sim.read(['ledger', 'record', 'storefront', 'reviews'])).questions.map(({ text }) => text), ['Who may leave a review?', 'Who moderates reviews?']);
    assert.deepStrictEqual(JSON.parse(sim.read(['topic', 'mailbox', 'storefront', 'reviews'])).files, [statePath(sim.dir, layout.mailbox('storefront', 'reviews', '001-photos.md'))]);
    enterEntry(sim, 'storefront', 'discussion', 'gifts');
    assert.doesNotMatch(sim.sections, /^earlier record:/m, 'the lines the split carried are the topic\'s own record, never an earlier one');

    assert.deepStrictEqual(sim.run(['roadmap', 'pull-forward', 'wishlist', '--into', 'storefront']).prior, { work_unit: 'shop', topic: 'wishlist' });
    enterEntry(sim, 'storefront', 'discussion', 'wishlist');
    assert.ok(sim.sections.includes(`earlier log: ${statePath(sim.dir, layout.topic('shop', 'wishlist', 'log.md'))}\n`), sim.sections);
    const call = /^earlier record: `node \S+ (ledger earlier shop wishlist)`$/m.exec(sim.sections)?.[1];
    assert.strictEqual(call, 'ledger earlier shop wishlist', sim.sections);
    const earlier = JSON.parse(sim.read(call.split(' ')));
    assert.deepStrictEqual([earlier.live, earlier.earlier, earlier.questions.map(({ text }) => text)], [false, true, ['May a wishlist be shared?']]);
  });

  it('21.S31: the building epic, whole once its topics left — every topic decided, its specs joined, one build — enters its build on the phase its cut wrote (21.8.9, 21.7.4)', () => {
    const { phases } = sim.manifest('shop');
    assert.deepStrictEqual([Object.entries(phases.discussion.items).map(([topic, { status }]) => [topic, status]), sim.manifest('shop').spec.joined], [[['weights', 'completed'], ['wishlist', 'postponed']], ['weights']]);

    assert.strictEqual(sim.run(['enter', 'implementation', 'shop']).entered, true);
    assert.deepStrictEqual(sim.sections.split('\n').filter((line) => line.startsWith('phase: ')), ['phase: phase 1 of 1, "Weights": not yet written']);
  });
});
