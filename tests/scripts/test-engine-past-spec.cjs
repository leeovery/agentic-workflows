'use strict';

// ---------------------------------------------------------------------------
// Past its spec (leeway-engine/scripts/domain/spec-standing.cjs): once a
// unit's spec is written, or concluded, no topic exists (4.11.2) and an
// epic's map is closed (18.4.19, P3) — one predicate, read at every door.
// Each door here refuses, naming the way on and writing nothing: a topic
// added to the map, one or a batch; a map topic cancelled or reactivated; a
// topic reopened; a roadmap item pulled forward into the epic, back to its
// own row or as a new one; a feature absorbed, or an epic taking one in; a
// feature pivoted; and approve the map. Manage offers no absorb past the
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

/** The refusal of a unit past its spec. @param {string} unit */
const past = (unit) => `${unit} has its spec — a topic exists only before it, and a change is settled in the spec from here`;

beforeEach(() => { dir = world(); });
afterEach(() => { cleanupFixture(dir); });

describe('past its spec: written or concluded', () => {
  it('reads none before the spec, and past it once spec.md is written or ready to build\'s yes began the build', () => {
    const before = pastItsSpec(dir, 'open');
    createManifest(dir, 'open', { ...readManifest(dir, 'open'), build: { position: 'auto' } });
    assert.deepStrictEqual([before, pastItsSpec(dir, 'fumi'), pastItsSpec(dir, 'open')], [false, true, true]);
  });
});

describe('every door the spec closes refuses, writing nothing (4.11.2, 18.4.19)', () => {
  it('a topic added to the map, one or a batch', () => {
    const one = refusedPristine(dir, ['topic', 'add', 'fumi', 'offline', '--summary', 'Notes offline', '--brief', draft('brief-offline.md', '# Offline\n')]).error;
    const batch = draft('batch.json', JSON.stringify([{ name: 'offline', summary: 'Notes offline', brief: draft('brief-batch.md', '# Offline\n') }]));
    assert.deepStrictEqual([one, refusedPristine(dir, ['topic', 'add-batch', 'fumi', '--file', batch]).error], [`topic add: ${past('fumi')}`, `topic add-batch: ${past('fumi')}`]);
  });

  it('a map topic cancelled, and one reactivated', () => {
    assert.deepStrictEqual([
      refusedPristine(dir, ['topic', 'cancel', 'fumi', 'discovery', 'alpha']).error,
      refusedPristine(dir, ['topic', 'reactivate', 'fumi', 'discovery', 'removal']).error,
    ], [past('fumi'), past('fumi')]);
  });

  it('a topic reopened — a bugfix\'s investigation concluded', () => {
    assert.strictEqual(refusedPristine(dir, ['topic', 'reopen', 'crash', 'investigation', 'crash']).error, past('crash'));
  });

  it('a roadmap item pulled forward into the epic: the topic it postponed back to its row, or an idea as a new one', () => {
    assert.deepStrictEqual([
      refusedPristine(dir, ['roadmap', 'pull-forward', 'widgets', '--into', 'fumi']).error,
      refusedPristine(dir, ['roadmap', 'pull-forward', 'extra', '--into', 'fumi']).error,
    ], [past('fumi'), past('fumi')]);
  });

  it('a feature past its spec absorbed, and an epic past its spec taking a feature in', () => {
    assert.deepStrictEqual([
      refusedPristine(dir, ['workunit', 'absorb', 'atlas', '--into', 'open', '--topic', 'atlas']).error,
      refusedPristine(dir, ['workunit', 'absorb', 'loose', '--into', 'fumi', '--topic', 'loose']).error,
    ], [past('atlas'), past('fumi')]);
  });

  it('a feature past its spec pivoted to an epic', () => {
    assert.strictEqual(refusedPristine(dir, ['workunit', 'pivot', 'atlas']).error, past('atlas'));
  });

  it('approve the map', () => {
    assert.strictEqual(refusedPristine(dir, ['render', 'approve-map', 'fumi']).error,
      'render approve-map: fumi has its spec, so its map is closed — talk about it belongs in the product\'s conversation, where what comes of it lands as roadmap items: engine enter discovery product');
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

  it('the roadmap item holding a postponed topic archived, which cancels the topic\'s row (18.8.17)', () => {
    ok(dir, ['roadmap', 'remove', 'widgets']);
    assert.strictEqual(JSON.parse(readState(dir, layout.manifest('fumi'))).phases.discovery.items.widgets.cancelled, true);
  });
});
