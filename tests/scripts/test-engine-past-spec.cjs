'use strict';

// ---------------------------------------------------------------------------
// Past its spec (leeway-engine/scripts/domain/spec-standing.cjs): once a
// unit's spec is written, or concluded, no topic exists (4.11.2) and an
// epic's map is closed (18.4.19, P3) — one predicate, read at every door.
// Each door here refuses, writing nothing and naming the way on from what
// the person was doing: a topic added to the map, one or a batch, new work
// that belongs in the product's conversation — refused so before a roadmap
// twin is; a map topic cancelled, its decision settled in the phase the
// epic is in, or reactivated or reopened, a change settled in the spec; a
// roadmap item pulled forward into the epic, back to its own row or as a
// new one, staying on the roadmap; a feature absorbed, or pivoted, carrying
// on as work of its own, or an epic taking one in, the feature kept or
// absorbed elsewhere; and approve the map. Manage offers no absorb past the
// spec, nor an epic past its spec as the target. What stays open: a decided
// topic postponed until ready to build's yes (P3, the split), and the
// roadmap item holding a postponed topic archived (18.8.17). The doors the
// topic's entry shares — a phase entered at a topic, a handoff into one, a
// message sent to one, an epic's discovery — are test-engine-enter.cjs's,
// test-engine-handoff.cjs's and test-engine-topic-mail.cjs's.
//
// Layer: verb. World, built once and copied: an epic, `fumi`, its spec
// written — `alpha` decided, `widgets` postponed to the roadmap, `removal`
// cancelled, and an idea waiting on the roadmap; an epic, `open`, before
// its spec; a feature, `atlas`, decided with its spec written; a feature,
// `loose`, decided before its spec; and a bugfix, `crash`, its
// investigation concluded and its spec written.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { ok, refusedPristine, readManifest, readState, statePath, writeState, layout, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { pastItsSpec } = require('../../skills/leeway-engine/scripts/domain/spec-standing.cjs');
const { manageDetail } = require('../../skills/leeway-engine/scripts/domain/workunit-manage.cjs');

/** A map row. @param {number} order */
const row = (order) => ({ order, summary: `Topic ${order}`, source: 'discovery' });

/** A feature decided, its discussion's log on disk. @param {string} dir @param {string} name */
function decidedFeature(dir, name) {
  createManifest(dir, name, { phases: { discussion: { items: { [name]: { status: 'completed' } } } } });
  writeState(dir, layout.doc(name, 'discussion', name), `# ${name}\n`);
}

/** The unit's spec written. @param {string} dir @param {string} unit */
const specWritten = (dir, unit) => writeState(dir, layout.unit(unit, 'spec.md'), `# ${unit}\n`);

const world = fixtureFrom('engine-past-spec-', (dir) => {
  createManifest(dir, 'fumi', {
    work_type: 'epic',
    phases: {
      discovery: { items: { alpha: row(1), widgets: row(2), removal: row(3) } },
      discussion: { items: { alpha: { status: 'completed' }, widgets: { status: 'in-progress' }, removal: { status: 'in-progress' } } },
    },
  });
  ok(dir, ['topic', 'postpone', 'fumi', 'widgets', '--horizon', 'next']);
  ok(dir, ['topic', 'cancel', 'fumi', 'discovery', 'removal']);
  ok(dir, ['roadmap', 'add', 'extra', '--horizon', 'next', '--summary', 'An idea for later', '--kind', 'idea']);
  specWritten(dir, 'fumi');
  createManifest(dir, 'open', { work_type: 'epic', phases: { discovery: { items: { seed: row(1) } } } });
  decidedFeature(dir, 'atlas');
  specWritten(dir, 'atlas');
  decidedFeature(dir, 'loose');
  createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'completed' } } } } });
  specWritten(dir, 'crash');
});

let dir; // the project

/** A file of Claude's in the cache: its path. @param {string} name @param {string} content */
function draft(name, content) {
  const file = statePath(dir, '.cache', 'scratch', name);
  writeState(dir, `.cache/scratch/${name}`, content);
  return file;
}

/** The refusal of a unit past its spec, by the way on from its door. */
const past = Object.freeze({
  change: (/** @type {string} */ unit) => `${unit} has its spec — a topic exists only before it, and a change is settled in the spec from here`,
  newWork: (/** @type {string} */ unit) => `${unit} has its spec, so its map is closed — talk about it belongs in the product's conversation, where what comes of it lands as roadmap items: engine enter discovery product`,
  pull: (/** @type {string} */ unit) => `${unit} has its spec, so its map is closed — the item stays on the roadmap: pull it into an epic still before its spec, or start it as work of its own`,
  absorbInto: (/** @type {string} */ unit) => `${unit} has its spec, so its map is closed — absorb the feature into an epic still before its spec, or keep it as work of its own`,
  ownWork: (/** @type {string} */ unit) => `${unit} has its spec — it carries on as work of its own`,
  cancel: (/** @type {string} */ unit) => `${unit} has its spec — a decision that must change is settled in the phase the epic is in, and abandoning the work is the unit's cancel, through manage on the start menu`,
});

beforeEach(() => { dir = world(); });
afterEach(() => { cleanupFixture(dir); });

describe('past its spec: written or concluded', () => {
  it('reads none before the spec, and past it once spec.md is written or ready to build\'s yes began the build', () => {
    const before = pastItsSpec(dir, readManifest(dir, 'open'));
    createManifest(dir, 'open', { ...readManifest(dir, 'open'), build: { position: 'auto' } });
    assert.deepStrictEqual([before, pastItsSpec(dir, readManifest(dir, 'fumi')), pastItsSpec(dir, readManifest(dir, 'open'))], [false, true, true]);
  });
});

describe('every door the spec closes refuses, writing nothing, with the way on from it (4.11.2, 18.4.19)', () => {
  it('a topic added to the map, one or a batch — new work, which belongs in the product\'s conversation — refused so before a waiting roadmap item\'s twin is', () => {
    const add = (/** @type {string} */ name) => refusedPristine(dir, ['topic', 'add', 'fumi', name, '--summary', 'Notes offline', '--brief', draft(`brief-${name}.md`, '# Offline\n')]).error;
    const batch = draft('batch.json', JSON.stringify([{ name: 'offline', summary: 'Notes offline', brief: draft('brief-batch.md', '# Offline\n') }]));
    assert.deepStrictEqual([add('offline'), add('extra'), refusedPristine(dir, ['topic', 'add-batch', 'fumi', '--file', batch]).error],
      [`topic add: ${past.newWork('fumi')}`, `topic add: ${past.newWork('fumi')}`, `topic add-batch: ${past.newWork('fumi')}`]);
  });

  it('a map topic cancelled — its decision settled in the phase the epic is in — and one reactivated, a change settled in the spec', () => {
    assert.deepStrictEqual([
      refusedPristine(dir, ['topic', 'cancel', 'fumi', 'discovery', 'alpha']).error,
      refusedPristine(dir, ['topic', 'reactivate', 'fumi', 'discovery', 'removal']).error,
    ], [past.cancel('fumi'), past.change('fumi')]);
  });

  it('a roadmap item pulled forward into the epic, the topic it postponed back to its row or an idea as a new one: it stays on the roadmap', () => {
    assert.deepStrictEqual([
      refusedPristine(dir, ['roadmap', 'pull-forward', 'widgets', '--into', 'fumi']).error,
      refusedPristine(dir, ['roadmap', 'pull-forward', 'extra', '--into', 'fumi']).error,
    ], [past.pull('fumi'), past.pull('fumi')]);
  });

  it('a feature past its spec absorbed, carrying on as work of its own, and an epic past its spec taking a feature in', () => {
    assert.deepStrictEqual([
      refusedPristine(dir, ['workunit', 'absorb', 'atlas', '--into', 'open', '--topic', 'atlas']).error,
      refusedPristine(dir, ['workunit', 'absorb', 'loose', '--into', 'fumi', '--topic', 'loose']).error,
    ], [past.ownWork('atlas'), past.absorbInto('fumi')]);
  });

  it('a feature past its spec pivoted to an epic: it carries on as work of its own', () => {
    assert.strictEqual(refusedPristine(dir, ['workunit', 'pivot', 'atlas']).error, past.ownWork('atlas'));
  });

  it('approve the map, new work as a topic\'s landing is', () => {
    assert.strictEqual(refusedPristine(dir, ['render', 'approve-map', 'fumi']).error, `render approve-map: ${past.newWork('fumi')}`);
  });

  it('manage offers no absorb for a feature past its spec, nor an epic past its spec as the target', () => {
    const [atlas, loose] = [manageDetail(dir, 'atlas'), manageDetail(dir, 'loose')];
    assert.deepStrictEqual([atlas?.has_spec, atlas?.absorb_available, loose?.available_epics], [true, false, ['open']]);
  });
});

describe('what the spec leaves open', () => {
  it('a decided topic postponed until ready to build\'s yes, for the split (P3)', () => {
    ok(dir, ['topic', 'postpone', 'fumi', 'alpha', '--horizon', 'later']);
    assert.strictEqual(readManifest(dir, 'fumi').phases.discovery.items.alpha.postponed, true);
  });

  it('the roadmap item holding a postponed topic archived, which cancels the topic\'s row (18.8.17, 18.S62)', () => {
    assert.deepStrictEqual(ok(dir, ['roadmap', 'archive', 'widgets']).epic_row_cancelled, { work_unit: 'fumi', topic: 'widgets' });
    assert.strictEqual(JSON.parse(readState(dir, layout.manifest('fumi'))).phases.discovery.items.widgets.cancelled, true);
  });
});
