'use strict';

// ---------------------------------------------------------------------------
// Approve the map (leeway-engine/scripts/domain/approve-map.cjs): the
// authority gate at the end of an epic's shaping — `render approve-map`
// staging Claude's payload and drawing one screen of the topics in order and
// the parks with their horizons (8.S17), refusing a park with no horizon
// (8.S49), a name struck from the map, a twin of a waiting roadmap item not
// taken in (8.S52) and a live topic left out, carrying the prior record of
// an item another epic postponed, and marking new and moved
// topics on a re-shape (8.S48); `approve-map yes` landing it all from the
// staged copy as one transaction — the order on the manifest (8.S10), the
// session closed, the epic's menu next with its first topic marked next
// (8.S47, 24.S15) — and a yes the map moved under, or that fails part-way,
// changing nothing. And `render discovery-map`, the map for Claude and the
// person, its struck names folded in.
//
// Layer: verb. World: discovery's gate suites' epic to shape
// (discovery-gates-world.cjs).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const { ok, output, refusedPristine, readManifest, readState, statePath, lastMessage, touched, head, layout } = require('./engine-harness.cjs');
const { EPIC, SESSION, useGatesWorld, gatesHelpers, failingWrites, manifestTemp, sectionOf } = require('./discovery-gates-world.cjs');

const { epicMenuKeys } = require('../../skills/leeway-engine/scripts/domain/projections/epic.cjs');
const { NBSP } = require('../../skills/leeway-engine/scripts/domain/projections/surfaces.cjs');
const epicGateway = require('../../skills/leeway-continue-epic/scripts/gateway.cjs');

const dir = useGatesWorld('epic');
const { scratch, payload, screen, answer, run } = gatesHelpers(dir);

const LOG = layout.session(EPIC, '001');
const STAGED = layout.cache(EPIC, 'discovery', EPIC, 'approve-map.json');

/** A new topic as Claude stages it, its brief drafted. @param {string} name @param {string} summary */
function fresh(name, summary) {
  return { name, summary, brief: scratch(`# ${name}\n\nWhat discovery heard.\n`) };
}

/** A park on `horizon`, shaped in the epic's log. @param {string} name @param {string} summary @param {string} [horizon] */
function park(name, summary, horizon) {
  return { name, summary, sources: [LOG], ...(horizon === undefined ? {} : { horizon }) };
}

/** The map the world's first shaping proposes: three topics, two parks, the epic's seed bound. */
function firstMap() {
  return {
    topics: [fresh('note-model', 'What a note is'), fresh('storage-and-sync', 'Where notes live'), fresh('sharing', 'Sharing a note')],
    parks: [park('fumi-sync', 'Fumi Sync, a hosted sync service', 'later'), park('a-lifetime-tier', 'A lifetime tier', 'someday')],
    binds: [{ item: 'share-links', topic: 'sharing' }],
  };
}

/** The yes the staged screen's gate leads to, run. @param {unknown} given */
function approved(given) {
  screen(['approve-map', EPIC], given);
  return run(answer('approve the map', 'y'));
}

/** The stage refused, writing nothing: its error. @param {unknown} given */
function refusedStage(given) {
  return refusedPristine(dir(), ['render', 'approve-map', EPIC, '--file', payload(given)], { env: SESSION }).error;
}

describe('approve the map, the screen (8.8.4, 8.S17)', () => {
  it('stages the map and changes nothing before the yes; one screen shows the topics in their order and each park with its horizon', () => {
    const before = { head: head(dir()), manifest: readManifest(dir(), EPIC) };
    const out = screen(['approve-map', EPIC], firstMap());
    assert.strictEqual(sectionOf(out, 'DISPLAY: approve the map'), [
      'THE MAP (3 topics, foundations first)',
      '  ├─ 1. Note Model',
      '  ├─ 2. Storage And Sync',
      '  └─ 3. Sharing',
      '',
      'TO THE ROADMAP (2, with the map)',
      '  ├─ Fumi Sync, a hosted sync service    [later]',
      '  └─ A lifetime tier                     [someday]',
      '',
    ].join('\n'));
    assert.strictEqual(sectionOf(out, 'MENU: approve the map'), [
      '· · · · · · · · · · · ·',
      'Your yes puts the topics on Fumi in this order and the parks on the roadmap.',
      '',
      '**`◆ Approve the map?`**',
      '',
      '**`y/yes`**        → Approve it',
      '**Keep shaping** → Tell me what to change — a topic, the order or a',
      `${NBSP.repeat(15)}park`,
      '',
    ].join('\n'));
    assert.deepStrictEqual({ head: head(dir()), manifest: readManifest(dir(), EPIC) }, before, 'nothing reaches the map or the roadmap before the yes');
    assert.ok(fs.existsSync(statePath(dir(), STAGED)), 'the payload waits in the epic\'s discovery cache');
    assert.deepStrictEqual(answer('approve the map', 'y'), { kind: 'engine', argv: ['approve-map', 'yes', EPIC] });
  });

  it('refuses a park with no horizon: the person is asked first, Claude naming none (8.S49)', () => {
    const map = firstMap();
    assert.strictEqual(refusedStage({ ...map, parks: [park('fumi-sync', 'Fumi Sync, a hosted sync service')] }),
      'render approve-map: park "fumi-sync": it has no horizon — the horizon is the person\'s: ask with render horizon-pick --park fumi-sync, before the screen');
  });

  it('refuses a name struck from the map: it comes back only at the person\'s ask', () => {
    assert.strictEqual(refusedStage({ topics: [fresh('dock-badge', 'A badge on the dock')] }),
      'render approve-map: topic 1: "dock-badge" was struck from the map — it comes back only at the person\'s ask, through topic add --re-add');
  });

  it('refuses a new topic beside a waiting roadmap item of its name, unless it takes the item in (8.S52)', () => {
    assert.strictEqual(refusedStage({ topics: [fresh('note-sync', 'Notes synced between Macs')] }),
      'render approve-map: "note-sync" would stand beside the waiting roadmap item of its name — the topic takes it in with from_roadmap, or is named apart');
    approved({ topics: [{ ...fresh('note-sync', 'Notes synced between Macs'), from_roadmap: 'note-sync' }] });
    assert.deepStrictEqual(readManifest(dir(), '.').roadmap.items['note-sync'].pulled_to, { work_unit: EPIC, topic: 'note-sync' }, 'the item leaves the waiting roadmap for its topic');
    assert.strictEqual(readManifest(dir(), EPIC).phases.discovery.items['note-sync'].source, 'roadmap:note-sync');
  });

  it('carries, for a topic taking in an item another epic postponed, that epic\'s record as its prior', () => {
    ok(dir(), ['workunit', 'create', 'kumo', 'epic', '--description', 'Clouds', '--session-log-file', scratch('# Kumo\n')]);
    ok(dir(), ['topic', 'add', 'kumo', 'offline-mode', '--summary', 'Notes offline', '--brief', scratch('# Offline mode\n')]);
    ok(dir(), ['topic', 'postpone', 'kumo', 'offline-mode', '--horizon', 'later']);
    approved({ topics: [{ ...fresh('offline-mode', 'Notes offline'), from_roadmap: 'offline-mode' }] });
    assert.deepStrictEqual(readManifest(dir(), EPIC).phases.discovery.items['offline-mode'].prior, { work_unit: 'kumo', topic: 'offline-mode' });
  });

  it('refuses a feature, whose discovery ended at start this work', () => {
    assert.match(refusedPristine(dir(), ['render', 'approve-map', 'atlas', '--file', payload(firstMap())], { env: SESSION }).error,
      /^render approve-map: atlas is a feature — its discovery ended at start this work/);
  });
});

describe('approve the map, the yes (8.8.3, 8.8.13, 8.14.11)', () => {
  it('lands the topics in their order with their briefs, the parks, the bind and the session closed in one commit, and hands off to the epic\'s menu, its first topic marked next (8.S10, 8.S47, 24.S15)', () => {
    const map = firstMap();
    const res = approved(map);
    assert.deepStrictEqual(res, {
      ok: true,
      unit: EPIC,
      topics: ['note-model', 'storage-and-sync', 'sharing'],
      added: map.topics.map(({ name }) => ({ name, brief: statePath(dir(), layout.brief(EPIC, name)) })),
      parked: [{ name: 'fumi-sync', horizon: 'later' }, { name: 'a-lifetime-tier', horizon: 'someday' }],
      bound: [{ item: 'share-links', topic: 'sharing' }],
      session_closed: '001',
      committed: head(dir()).slice(0, res.committed.length),
      next: { kind: 'handoff', skill: 'leeway-continue-epic', args: [EPIC] },
    });
    const { discovery } = readManifest(dir(), EPIC).phases;
    assert.deepStrictEqual(discovery.items, {
      'note-model': { source: 'discovery', summary: 'What a note is', order: 1 },
      'storage-and-sync': { source: 'discovery', summary: 'Where notes live', order: 2 },
      sharing: { source: 'discovery', summary: 'Sharing a note', order: 3 },
    });
    assert.deepStrictEqual([discovery.active_session, discovery.dismissed], [undefined, ['dock-badge']], 'the session closes with the map; the struck name stays struck');
    assert.deepStrictEqual(map.topics.map(({ name, brief }) => [readState(dir(), layout.brief(EPIC, name)), fs.existsSync(brief)]),
      map.topics.map(({ name }) => [`# ${name}\n\nWhat discovery heard.\n`, false]), 'each brief lands from its draft, the draft consumed');
    const { roadmap } = readManifest(dir(), '.');
    assert.deepStrictEqual([roadmap.items['fumi-sync'], roadmap.items['a-lifetime-tier'], roadmap.items['share-links'].pulled_to, roadmap.horizons], [
      { horizon: 'later', summary: 'Fumi Sync, a hosted sync service', kind: 'idea', origin: `park:${EPIC}`, sources: [LOG] },
      { horizon: 'someday', summary: 'A lifetime tier', kind: 'idea', origin: `park:${EPIC}`, sources: [LOG] },
      { work_unit: EPIC, topic: 'sharing' },
      ['later', 'next', 'someday'],
    ]);
    assert.strictEqual(lastMessage(dir()), `discovery(${EPIC}): approve the map`);
    assert.deepStrictEqual(touched(statePath(dir()), 'HEAD'), [
      ...map.topics.map(({ name }) => `A\t${layout.brief(EPIC, name)}`),
      `M\t${layout.manifest(EPIC)}`,
      'M\tmanifest.json',
    ].sort());
    assert.ok(!fs.existsSync(statePath(dir(), STAGED)), 'the staged payload goes');
    assert.strictEqual(epicMenuKeys(EPIC, epicGateway.discover(dir(), EPIC)).find((key) => key.recommended)?.topic, 'note-model',
      'the epic\'s menu marks the first topic in the map\'s order next');
  });

  it('marks, on a re-shape, the topics that are new and those that moved; a topic on the map is named alone, and none is left out (8.S48)', () => {
    approved(firstMap());
    assert.strictEqual(refusedStage({ topics: [{ name: 'note-model' }, { name: 'sharing' }] }),
      'render approve-map: the map\'s "storage-and-sync" is left out — every live topic stands in the order, and a topic leaves the map at the person\'s word alone: topic remove');
    assert.strictEqual(refusedStage({ topics: [{ name: 'note-model', summary: 'Rewritten' }, { name: 'storage-and-sync' }, { name: 'sharing' }] }),
      'render approve-map: topic 1: "note-model" is on the map already, so it is named alone — its summary and brief change at the person\'s word: topic edit, topic brief');
    const out = screen(['approve-map', EPIC], { topics: [{ name: 'note-model' }, fresh('note-window', 'The note window'), { name: 'sharing' }, { name: 'storage-and-sync' }] });
    assert.strictEqual(sectionOf(out, 'DISPLAY: approve the map'), [
      'THE MAP (4 topics, foundations first)',
      '  ├─ 1. Note Model',
      '  ├─ 2. Note Window         [new]',
      '  ├─ 3. Sharing             [moved]',
      '  └─ 4. Storage And Sync    [moved]',
      '',
    ].join('\n'));
    run(answer('approve the map', 'y'));
    const { items } = readManifest(dir(), EPIC).phases.discovery;
    assert.deepStrictEqual(['note-model', 'note-window', 'sharing', 'storage-and-sync'].map((name) => items[name].order), [1, 2, 3, 4]);
  });

  it('checks the staged map again at the yes: a topic landed on the map since refuses, writing nothing', () => {
    screen(['approve-map', EPIC], firstMap());
    ok(dir(), ['topic', 'add', EPIC, 'sharing', '--summary', 'Added at the person\'s word', '--brief', scratch('# Sharing\n')]);
    assert.strictEqual(refusedPristine(dir(), ['approve-map', 'yes', EPIC], { env: SESSION }).error,
      'approve-map yes: topic 3: "sharing" is on the map already, so it is named alone — its summary and brief change at the person\'s word: topic edit, topic brief');
  });

  it('changes nothing where the yes fails part-way: the roadmap put back, no brief left, the drafts kept', () => {
    const map = firstMap();
    screen(['approve-map', EPIC], map);
    const refused = failingWrites(manifestTemp(statePath(dir(), EPIC)), () => refusedPristine(dir(), ['approve-map', 'yes', EPIC], { env: SESSION }));
    assert.strictEqual(refused.error, 'approve-map yes: disk full');
    assert.ok(map.topics.every(({ brief }) => fs.existsSync(brief)), 'the drafts are kept, so the yes can run again');
  });
});

describe('the map for Claude and the person (render discovery-map)', () => {
  it('names each topic in its order with its lifecycle, then the names struck from the map, in DATA and on the display', () => {
    approved(firstMap());
    const out = output(dir(), ['render', 'discovery-map', EPIC]);
    assert.strictEqual(sectionOf(out, 'DATA'), [
      `work_unit: ${EPIC}`,
      'map: 3 topics — 0 decided, 0 in-flight, 3 fresh, 0 cancelled, 0 postponed',
      'topics (3):',
      '  1 note-model [fresh] — What a note is',
      '  2 storage-and-sync [fresh] — Where notes live',
      '  3 sharing [fresh] — Sharing a note',
      'dismissed (1):',
      '  - dock-badge',
      '',
    ].join('\n'));
    assert.match(sectionOf(out, 'DISPLAY: discovery map'), /^ {2}└─ ○ Sharing\n {8}↳ Fresh\n\nStruck from the map \(1\)\n {2}· Dock Badge\n$/m);
  });

  it('refuses a unit with no map', () => {
    assert.strictEqual(refusedPristine(dir(), ['render', 'discovery-map', 'atlas']).error, 'render discovery-map: a feature has no map — its one topic is the unit itself');
  });
});
