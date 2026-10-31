'use strict';

// ---------------------------------------------------------------------------
// Approve the map (leeway-engine/scripts/domain/approve-map.cjs): the
// authority gate at the end of an epic's shaping — `render approve-map`
// staging Claude's payload and drawing one screen of the topics in order and
// the parks with their horizons (8.S17), refusing a park with no horizon
// (8.S49), a name struck from the map, a twin of a waiting roadmap item not
// taken in (8.S52), a topic beside the epic's own unbound seed, a live topic
// left out, and every malformed order, park and bind, each writing nothing;
// carrying the prior record of an item another epic postponed; drawing a
// first map unmarked, and on a re-shape marking the topics new and the one
// moved (8.S48); `approve-map yes` landing it all from the
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
const { joinedTo } = require('./roadmap-world.cjs');
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

/** The topics a screen draws, each by its title with its mark, or none. @param {string} out @returns {[string, string|null][]} */
function marksOf(out) {
  return [...sectionOf(out, 'DISPLAY: approve the map').matchAll(/^ {2}[├└]─ \d+\. (.+?)(?: +\[(new|moved)\])?$/gm)].map(([, title, mark]) => [title, mark ?? null]);
}

/** Four topics, approved as the map in their order. */
function fourApproved() {
  approved({ topics: [fresh('note-model', 'What a note is'), fresh('storage-and-sync', 'Where notes live'), fresh('sharing', 'Sharing a note'), fresh('search', 'Finding a note')] });
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
      'render approve-map: "note-sync" would stand beside the waiting roadmap item of its name — take it in with "from_roadmap": "note-sync", or name the topic apart');
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

describe('approve the map, refused as staged — nothing staged, nothing written', () => {
  /** @param {[string, () => unknown, string][]} cases */
  const refusesEach = (cases) => {
    for (const [what, given, error] of cases) assert.strictEqual(refusedStage(given()), `render approve-map: ${error}`, what);
  };
  const sharing = () => fresh('sharing', 'Sharing a note');
  const bound = { item: 'share-links', topic: 'sharing' };

  it('refuses each malformed order, park and bind against the first map', () => {
    refusesEach([
      ['no topics', () => ({ topics: [] }), 'topics names the map\'s topics in their order — at least one'],
      ['a topic twice', () => ({ topics: [sharing(), sharing()], binds: [bound] }), 'the topic "sharing" stands twice'],
      ['an item taken in twice', () => ({ topics: [{ ...fresh('note-sync', 'Sync'), from_roadmap: 'note-sync' }, { ...fresh('syncing', 'Sync'), from_roadmap: 'note-sync' }] }),
        'the roadmap item taken in "note-sync" stands twice'],
      ['a park twice', () => ({ topics: [sharing()], binds: [bound], parks: [park('fumi-sync', 'Sync', 'later'), park('fumi-sync', 'Sync again', 'later')] }), 'the park "fumi-sync" stands twice'],
      ['a park named as a topic', () => ({ topics: [sharing()], binds: [bound], parks: [park('sharing', 'Sharing, later', 'later')] }), '"sharing" is a topic and a park at once'],
      ['a park named as a roadmap item', () => ({ topics: [sharing()], binds: [bound], parks: [park('note-sync', 'Sync', 'later')] }), 'park "note-sync": the roadmap has an item of its name already'],
      ['a park shaped by no log', () => ({ topics: [sharing()], binds: [bound], parks: [{ ...park('fumi-sync', 'Sync', 'later'), sources: [] }] }),
        'park "fumi-sync": sources names the logs that shaped it — at least one'],
      ['a bind of an item the epic was not started from', () => ({ topics: [sharing()], binds: [{ item: 'note-sync', topic: 'sharing' }] }),
        `bind 1: "note-sync" is no roadmap item ${EPIC} was started from and not yet bound`],
      ['a bind to a topic not staged', () => ({ topics: [sharing()], binds: [{ item: 'share-links', topic: 'search' }] }), 'bind 1: "search" is no topic of the map staged'],
      ['an item bound twice', () => ({ topics: [sharing()], binds: [bound, bound] }), 'the bound item "share-links" stands twice'],
      ['a topic beside the epic\'s unbound seed of its name', () => ({ topics: [fresh('share-links', 'Share a note by a link')] }),
        `"share-links" would stand beside the roadmap item ${EPIC} was started from, unbound — bind it with {"item": "share-links", "topic": "share-links"} in binds, or name the topic apart`],
    ]);
    approved({ topics: [fresh('share-links', 'Share a note by a link')], binds: [{ item: 'share-links', topic: 'share-links' }] });
    assert.deepStrictEqual(readManifest(dir(), '.').roadmap.items['share-links'].pulled_to, { work_unit: EPIC, topic: 'share-links' }, 'bound, the seed comes home with its topic');
  });

  it('refuses a bind of a bug the epic was started from: it rides with the work, never a topic', () => {
    joinedTo(dir(), EPIC, 'export-timeout');
    refusesEach([['a bug bound', () => ({ topics: [sharing()], binds: [bound, { item: 'export-timeout', topic: 'sharing' }] }),
      'bind 2: "export-timeout" is a bug — it rides with the work as material, never a topic']]);
  });

  it('refuses, on a re-shape, a topic postponed or cancelled standing in the order, and a bind made already', () => {
    approved(firstMap());
    ok(dir(), ['topic', 'postpone', EPIC, 'storage-and-sync', '--horizon', 'later']);
    ok(dir(), ['topic', 'cancel', EPIC, 'discovery', 'sharing']);
    refusesEach([
      ['a postponed topic in the order', () => ({ topics: [{ name: 'note-model' }, { name: 'storage-and-sync' }] }), 'topic 2: "storage-and-sync" is postponed — it stands in no order'],
      ['a cancelled topic in the order', () => ({ topics: [{ name: 'note-model' }, { name: 'sharing' }] }), 'topic 2: "sharing" is cancelled — it stands in no order'],
      ['a bind made already', () => ({ topics: [{ name: 'note-model' }], binds: [{ item: 'share-links', topic: 'note-model' }] }),
        `bind 1: "share-links" is no roadmap item ${EPIC} was started from and not yet bound`],
    ]);
    const { items } = readManifest(dir(), EPIC).phases.discovery;
    assert.strictEqual(items['storage-and-sync'].order, undefined, 'the postponed topic keeps its stashed place alone');
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

  it('draws a first map unmarked, a topic the person added while it was shaped among it (8.8.6)', () => {
    ok(dir(), ['topic', 'add', EPIC, 'pricing', '--summary', 'What it costs', '--brief', scratch('# Pricing\n')]);
    assert.deepStrictEqual(marksOf(screen(['approve-map', EPIC], { topics: [fresh('note-model', 'What a note is'), { name: 'pricing' }, fresh('sharing', 'Sharing a note')] })),
      [['Note Model', null], ['Pricing', null], ['Sharing', null]]);
  });

  it('marks, on a re-shape, each topic the approved map did not order as new — one the person added since among them — and a topic moved as the one moved (8.S48)', () => {
    fourApproved();
    ok(dir(), ['topic', 'add', EPIC, 'pricing', '--summary', 'What it costs', '--brief', scratch('# Pricing\n')]);
    const out = screen(['approve-map', EPIC], { topics: [{ name: 'search' }, { name: 'note-model' }, fresh('note-window', 'The note window'), { name: 'storage-and-sync' }, { name: 'sharing' }, { name: 'pricing' }] });
    assert.strictEqual(sectionOf(out, 'DISPLAY: approve the map'), [
      'THE MAP (6 topics, foundations first)',
      '  ├─ 1. Search         [moved]',
      '  ├─ 2. Note Model',
      '  ├─ 3. Note Window    [new]',
      '  ├─ 4. Storage And Sync',
      '  ├─ 5. Sharing',
      '  └─ 6. Pricing        [new]',
      '',
    ].join('\n'));
    run(answer('approve the map', 'y'));
    const { items } = readManifest(dir(), EPIC).phases.discovery;
    assert.deepStrictEqual(['search', 'note-model', 'note-window', 'storage-and-sync', 'sharing', 'pricing'].map((name) => items[name].order), [1, 2, 3, 4, 5, 6]);
  });

  it('marks one of two topics swapped, and none where the order stands', () => {
    fourApproved();
    const swapped = marksOf(screen(['approve-map', EPIC], { topics: [{ name: 'note-model' }, { name: 'sharing' }, { name: 'storage-and-sync' }, { name: 'search' }] }));
    assert.deepStrictEqual(swapped.filter(([, mark]) => mark !== null).length, 1);
    assert.ok(swapped.every(([title, mark]) => mark === null || ['Sharing', 'Storage And Sync'].includes(title)), 'the mark falls on one of the two swapped');
    assert.ok(marksOf(screen(['approve-map', EPIC], { topics: [{ name: 'note-model' }, { name: 'storage-and-sync' }, { name: 'sharing' }, { name: 'search' }] })).every(([, mark]) => mark === null));
  });

  it('names a topic on the map alone, and leaves none out', () => {
    approved(firstMap());
    assert.strictEqual(refusedStage({ topics: [{ name: 'note-model' }, { name: 'sharing' }] }),
      'render approve-map: the map\'s "storage-and-sync" is left out — every live topic stands in the order, and a topic leaves the map at the person\'s word alone: topic remove');
    assert.strictEqual(refusedStage({ topics: [{ name: 'note-model', summary: 'Rewritten' }, { name: 'storage-and-sync' }, { name: 'sharing' }] }),
      'render approve-map: topic 1: "note-model" is on the map already, so it is named alone — its summary and brief change at the person\'s word: topic edit, topic brief');
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
