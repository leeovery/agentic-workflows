'use strict';

// ---------------------------------------------------------------------------
// `engine board` in an epic's discovery (leeway-engine/scripts/domain/
// projections/board-discovery.cjs, 20.11): the map as it stands, the map
// Claude staged while approve the map waits on the person with what it parks
// on the roadmap, a topic's brief by its sections — a staged topic's from
// its draft — the epic's spikes and a spike's page, what the logs say under
// their fixed headings, as `discovery-log` put it there, each entry its one
// line, and what does not read among the warnings (discovery-log.cjs),
// the day the session started, and, the map approved, the epic's first
// topic next; and the epic past its discovery from the yes's record of the
// approval, never from the topics on its map, a map staged again after it
// waiting on every view that reads the epic.
//
// Layer: verb. World: discovery's gate suites' epic to shape
// (discovery-gates-world.cjs), copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, writeState, readState, readManifest, layout } = require('./engine-harness.cjs');
const { EPIC, SESSION, useGatesWorld, gatesHelpers } = require('./discovery-gates-world.cjs');
const { SESSION_ID } = require('./ledger-world.cjs');
const { fixture, fixtureModule, misfits, emptyLists, standingOn } = require('./board-world.cjs');

const PRODUCT = 'product';

const dir = useGatesWorld('epic');
const { scratch, screen, answer, run } = gatesHelpers(dir);

/** The board's answer for the world's conversation, at the epic's discovery. @param {string[]} [args] */
function board(args = []) {
  ok(dir(), ['session', 'label', EPIC, 'discovery', EPIC], { env: SESSION });
  const { view, banner } = ok(dir(), ['board', SESSION_ID, ...args], { env: SESSION });
  return { view, banner };
}

/** This session's view at the epic's discovery, and the warnings beside it. */
function heard() {
  ok(dir(), ['session', 'label', EPIC, 'discovery', EPIC], { env: SESSION });
  const { view, warnings } = ok(dir(), ['board', SESSION_ID], { env: SESSION });
  return { view, warnings };
}

/** An entry put in the open log by discovery-log. @param {string[]} args */
const logged = (args) => ok(dir(), ['discovery-log', ...args]);

/** The note model's brief: what discovery heard, the person's leans, no path not taken, and an open question. */
const NOTE_BRIEF = '# Note model\n\nWhat discovery heard.\n\n## Leans\n\nA note is plain text.\n\n## Paths not taken\n\n## Open questions\n\nCan a note hold a picture?\n';

/** The map Claude stages: two topics, their briefs drafted, and one park. */
function staged() {
  screen(['approve-map', EPIC], {
    topics: [
      { name: 'note-model', summary: 'What a note is', brief: scratch(NOTE_BRIEF) },
      { name: 'sharing', summary: 'Sharing a note', brief: scratch('# Sharing\n') },
    ],
    parks: [{ name: 'fumi-sync', summary: 'Fumi Sync, a hosted sync service', horizon: 'later', sources: [layout.session(EPIC, '001')] }],
  });
}

/** A banner fact. @param {string} text @param {boolean} [needs] */
const fact = (text, needs = false) => ({ text, needs });

/** Approve the map, waiting on the person, as the unit's one list holds the map `staged` stages. */
const APPROVAL = { kind: 'map', id: 'approve-the-map', text: 'Approve the map: 2 topics in this order, and 1 to the roadmap', page: null };

describe('discovery on the board (20.11)', () => {
  it('the epic\'s map as it stands, nothing waiting on the person', () => {
    assert.deepStrictEqual(board(), {
      view: { kind: 'discovery', unit: EPIC, title: 'Fumi', type: 'epic', session: 1, started: null, waiting: [], map: [], roadmap: [], not_taken: [], views: [], spikes: [] },
      banner: { name: 'Fumi', state: 'running', facts: [fact('epic'), fact('discovery'), fact('0 topics on the map')] },
    });
  });

  it('while approve the map waits, the map staged with what it parks on the roadmap; the banner says the map waits on the person', () => {
    staged();

    assert.deepStrictEqual(board(), {
      view: {
        kind: 'discovery',
        unit: EPIC,
        title: 'Fumi',
        type: 'epic',
        session: 1,
        started: null,
        waiting: [APPROVAL],
        map: [{ topic: 'note-model', title: 'Note Model', summary: 'What a note is' }, { topic: 'sharing', title: 'Sharing', summary: 'Sharing a note' }],
        roadmap: [{ title: 'Fumi Sync, a hosted sync service', horizon: 'later' }],
        not_taken: [],
        views: [],
        spikes: [],
      },
      banner: { name: 'Fumi', state: 'needs', facts: [fact('epic'), fact('discovery'), fact('2 topics on the map'), fact('the map waits on you', true)] },
    });
  });

  it('S1: while approve the map waits, it stands on every view that reads the epic — its tab\'s discovery waiting on the person, the map listed under what waits with its topics and parks; All work\'s epic in discovery with its topics on the map, counted — as the banner has it', () => {
    staged();

    assert.deepStrictEqual(standingOn(board, EPIC), {
      tab: { now: 'discovery', state: 'waits', words: '2 topics', waiting: ['map approve-the-map'] },
      all: { phase: 'discovery', standing: '2 topics on the map', waiting: 1, total: 1 },
      banner: { state: 'needs', waits: ['⚑ the map waits on you'] },
    });
    assert.deepStrictEqual(board(['--tab', 'unit']).view.waiting, [APPROVAL]);
  });

  it('S2: a topic added while the map is shaped leaves the epic in its discovery on every view that reads it; the yes records the approval, which dates the discovery\'s close and moves the epic on', () => {
    ok(dir(), ['topic', 'add', EPIC, 'pricing', '--summary', 'What it costs', '--brief', scratch('# Pricing\n')]);
    const shaping = { tab: board(['--tab', 'unit']).view, all: board(['--tab', 'all']).view.units.find(({ unit }) => unit === EPIC) };
    screen(['approve-map', EPIC], { topics: [{ name: 'pricing' }, { name: 'note-model', summary: 'What a note is', brief: scratch(NOTE_BRIEF) }], parks: [] });
    const before = new Date().toISOString();
    run(answer('approve the map', 'y'));
    const approved = readManifest(dir(), EPIC).phases.discovery.approved_at;
    const page = board(['--tab', 'unit']).view;

    assert.deepStrictEqual({
      shaping: { kind: shaping.tab.kind, now: shaping.tab.now, all: [shaping.all.phase, shaping.all.standing] },
      approved: approved >= before && approved <= new Date().toISOString(),
      page: { kind: page.kind, now: page.now },
    }, {
      shaping: { kind: 'unit', now: { phase: 'discovery', since: null }, all: ['discovery', '1 topic on the map'] },
      approved: true,
      page: { kind: 'epic', now: { phase: 'discussion', since: approved } },
    });
  });

  it('S1, 8.8.21: the map staged again once approved waits on every view that reads the epic — its page under what waits, All work counting it — as the banner flags it', () => {
    staged();
    run(answer('approve the map', 'y'));
    ok(dir(), ['enter', 'discovery', EPIC], { env: SESSION });
    screen(['approve-map', EPIC], { topics: [{ name: 'sharing' }, { name: 'note-model' }], parks: [] });

    assert.deepStrictEqual(standingOn(board, EPIC), {
      tab: { now: 'discussion', spec: 'waits', build: 'waits', waiting: ['map approve-the-map'] },
      all: { phase: 'discussion', standing: '0 of 2 topics decided', waiting: 1, total: 1 },
      banner: { state: 'needs', waits: ['⚑ the map waits on you'] },
    });
    assert.deepStrictEqual(board(['--tab', 'unit']).view.waiting, [{ ...APPROVAL, text: 'Approve the map: 2 topics in this order' }]);
  });

  it('20.11.2: a topic of the staged map opens on its brief\'s draft, at its place on the map, by its sections, one with nothing in it left out; one the map lacks is unavailable, saying why', () => {
    staged();

    assert.deepStrictEqual([board(['--page', 'topic:note-model']).view, board(['--page', 'topic:search']).view], [
      {
        kind: 'brief',
        unit: EPIC,
        topic: 'note-model',
        title: 'Note Model',
        order: 1,
        of: 2,
        summary: 'What a note is',
        sections: [{ heading: null, text: 'What discovery heard.' }, { heading: 'Leans', text: 'A note is plain text.' }, { heading: 'Open questions', text: 'Can a note hold a picture?' }],
        messages: [],
      },
      { kind: 'unavailable', reason: 'fumi\'s map holds no topic "search"' },
    ]);
  });

  it('20.11.1: each spike the epic started, in order, canonical or reference as its links give it, none where nothing links it; 20.11.3: a spike opens on its page', () => {
    staged();
    run(answer('approve the map', 'y'));
    ok(dir(), ['topic', 'start', EPIC, 'discussion', 'note-model'], { env: SESSION });
    const [frame, sync] = ['frame', 'sync', 'list'].map((slug) => ok(dir(), ['asset', 'spike', EPIC, slug]).path);
    writeState(dir(), `${frame}/Frame.swift`, 'struct Frame {}\n');
    writeState(dir(), `${sync}/notes.md`, 'notes\n');
    const asked = ok(dir(), ['ledger', 'ask', `${EPIC}.discussion.note-model`], { env: SESSION, stdin: JSON.stringify({ by: 'claude', who_moved_whom: 'none', text: 'How does the frame scroll?' }) }).id;
    ok(dir(), ['asset', 'add', EPIC, frame, '--entry', asked, '--status', 'canonical'], { env: SESSION });
    ok(dir(), ['asset', 'add', EPIC, `${sync}/notes.md`, '--entry', asked], { env: SESSION });

    assert.deepStrictEqual({ spikes: board().view.spikes, page: board(['--page', 'spike:001-frame']).view, none: board(['--page', 'spike:009-none']).view }, {
      spikes: [
        { spike: '001-frame', title: 'Frame', status: 'canonical', tool: null, showed: null },
        { spike: '002-sync', title: 'Sync', status: 'reference', tool: null, showed: null },
        { spike: '003-list', title: 'List', status: null, tool: null, showed: null },
      ],
      page: { kind: 'spike', unit: EPIC, spike: '001-frame', title: 'Frame', status: 'canonical', tool: null, showed: null, path: `${EPIC}/spikes/001-frame`, link: null },
      none: { kind: 'unavailable', reason: 'fumi has no spike 009-none' },
    });
  });

  it('20.11.1: the session and the day it started; the directions not taken, the person\'s views and each spike\'s tool and what it showed, as discovery-log put them in every log — each entry its one line, wherever it stands under its heading, a why and what a spike showed holding a dash of their own — a later spike line standing over an earlier, and an entry that does not read, or names no spike of the epic, said among the warnings; 20.11.3: a spike\'s live link', () => {
    for (const slug of ['frame', 'sync', 'list']) ok(dir(), ['asset', 'spike', EPIC, slug]);
    logged(['not-taken', EPIC, '--direction', 'The Mac App Store', '--why', 'the private Spaces APIs — an automatic rejection']);
    logged(['view', EPIC, '--text', 'Clean, well-structured, beautiful, and it just works']);
    logged(['spike', EPIC, '001-frame', '--tool', 'Paper', '--link', 'https://paper.design/f/1', '--showed', 'Luminous glass — reads at a glance']);
    logged(['spike', EPIC, '002-sync', '--tool', 'draft Swift', '--showed', 'a first try']);
    const first = layout.session(EPIC, '001');
    writeState(dir(), first, readState(dir(), first)
      .replace('## Not taken\n\n', '## Not taken\n\nWhat the person turned down.\n\n- Importing Stickies\n\n')
      .replace('reads at a glance', 'reads at a glance\n  - [Frame.swift](../spikes/001-frame/Frame.swift)')
      .replace('- 002-sync', '- 003-list, a thought with no shape\n- 009-ghost · Swift — never started\n- 002-sync')
      .concat('Got to: the map is drafted.\n\n```text\n## Notes\n- Fenced, never read\n```\n- 003-list · Sketch — a later look\n\n## Leans\n\n- Modern Swift — a lean, not a list\n'));
    ok(dir(), ['discovery-session', 'close', EPIC, '-m', 'discovery(fumi): end session 001']);
    ok(dir(), ['enter', 'discovery', EPIC], { env: SESSION });
    logged(['not-taken', EPIC, '--direction', 'A billing backend', '--why', 'the Merchant of Record covers checkout']);
    logged(['spike', EPIC, '002-sync', '--tool', 'Swift', '--showed', 'Sync holds across two Macs']);
    const second = layout.session(EPIC, '002');
    writeState(dir(), second, `## 2026-07-18 · session sess-2\n\n${readState(dir(), second)}`);
    const { view, warnings } = heard();

    assert.deepStrictEqual({
      session: view.session, started: view.started, not_taken: view.not_taken, views: view.views, spikes: view.spikes, warnings,
      pages: ['001-frame', '002-sync'].map((spike) => board(['--page', `spike:${spike}`]).view.link),
    }, {
      session: 2,
      started: '2026-07-18',
      not_taken: [
        { direction: 'The Mac App Store', why: 'the private Spaces APIs — an automatic rejection' },
        { direction: 'A billing backend', why: 'the Merchant of Record covers checkout' },
      ],
      views: ['Clean, well-structured, beautiful, and it just works'],
      spikes: [
        { spike: '001-frame', title: 'Frame', status: null, tool: 'Paper', showed: 'Luminous glass — reads at a glance' },
        { spike: '002-sync', title: 'Sync', status: null, tool: 'Swift', showed: 'Sync holds across two Macs' },
        { spike: '003-list', title: 'List', status: null, tool: 'Sketch', showed: 'a later look' },
      ],
      warnings: [
        `${first}: "Importing Stickies" under ## Not taken does not read as a direction and why, and is passed over`,
        `${first}: "003-list, a thought with no shape" under ## Spikes does not read as a spike, and is passed over`,
        `${first}: "009-ghost · Swift — never started" under ## Spikes names no spike the epic holds, and is passed over`,
      ],
      pages: ['https://paper.design/f/1', null],
    });
  });

  for (const [list, entry, read, expected] of /** @type {[string, string[], (view: any) => unknown, unknown][]} */ ([
    ['Not taken', ['not-taken', EPIC, '--direction', 'Importing Stickies', '--why', 'nobody asked'], (view) => view.not_taken, [{ direction: 'Importing Stickies', why: 'nobody asked' }]],
    ['Views of the product', ['view', EPIC, '--text', 'Modern Swift, correctness over speed'], (view) => view.views, ['Modern Swift, correctness over speed']],
    ['Spikes', ['spike', EPIC, '001-frame', '--tool', 'Paper', '--showed', 'Glass reads at a glance'], (view) => view.spikes, [{ spike: '001-frame', title: 'Frame', status: null, tool: 'Paper', showed: 'Glass reads at a glance' }]],
  ])) {
    it(`20.11.1: ## ${list} the log's last list, the session's closing line written directly beneath its entry and the pointer a move wrote after it are never read into it`, () => {
      ok(dir(), ['asset', 'spike', EPIC, 'frame']);
      ok(dir(), ['enter', 'discovery', EPIC], { env: SESSION });
      logged(entry);
      const first = layout.session(EPIC, '001');
      writeState(dir(), first, `${readState(dir(), first)}Got to: the map is drafted, two topics on it.\n`);
      ok(dir(), ['enter', 'discovery', PRODUCT, '--move'], { env: SESSION });
      ok(dir(), ['enter', 'discovery', EPIC, '--move'], { env: SESSION });
      const { view, warnings } = heard();

      assert.match(readState(dir(), first), /\n- .+\nGot to: the map is drafted, two topics on it\.\n\n→ Carried on in /);
      assert.deepStrictEqual({ read: read(view), warnings }, { read: expected, warnings: [] });
    });
  }

  it('the map approved, the epic\'s page names its first topic next while none has started, the rest not started (20.8.1)', () => {
    staged();
    run(answer('approve the map', 'y'));
    const states = () => board(['--tab', 'unit']).view.topics.map(({ topic, state }) => [topic, state]);
    const approved = states();
    ok(dir(), ['topic', 'start', EPIC, 'discussion', 'note-model'], { env: SESSION });

    assert.deepStrictEqual([approved, states()], [[['note-model', 'next'], ['sharing', 'not-started']], [['note-model', 'discussing'], ['sharing', 'not-started']]]);
  });

  it('D29: a topic not started opens on its brief, the messages waiting for it beneath; one postponed opens on its brief too, and one under way on its discussion (20.11.2, 20.8.3)', () => {
    staged();
    run(answer('approve the map', 'y'));
    writeState(dir(), '.cache/tour.md', '# The tour opens first\n\nIt bears on you.\n');
    ok(dir(), ['topic', 'send', EPIC, 'sharing', '--from', 'note-model', '--content', '.leeway/.cache/tour.md', '--slug', 'tour'], { env: SESSION });
    const fresh = board(['--page', 'topic:sharing']).view;
    ok(dir(), ['topic', 'start', EPIC, 'discussion', 'note-model'], { env: SESSION });
    const started = board(['--page', 'topic:note-model']).view.kind;
    ok(dir(), ['topic', 'postpone', EPIC, 'sharing', '--horizon', 'later'], { env: SESSION });
    const postponed = board(['--page', 'topic:sharing']).view;

    assert.deepStrictEqual({ fresh: [fresh.kind, fresh.messages.map(({ title, from }) => [title, from])], started, postponed: [postponed.kind, postponed.order] }, {
      fresh: ['brief', [['The tour opens first', 'Note Model']]],
      started: 'discussion',
      postponed: ['brief', null],
    });
  });

  it('D35: the map approved and the session at the epic\'s menu, All work lists the epic in its discussion, none of its topics decided, this session in it (20.16.1)', () => {
    staged();
    run(answer('approve the map', 'y'));
    ok(dir(), ['session', 'label', EPIC], { env: SESSION });
    const { view } = ok(dir(), ['board', SESSION_ID, '--tab', 'all'], { env: SESSION });

    assert.deepStrictEqual(view.units.filter(({ unit }) => unit === EPIC).map(({ type, phase, standing, session }) => ({ type, phase, standing, session })), [
      { type: 'epic', phase: 'discussion', standing: '0 of 2 topics decided', session: 'this' },
    ]);
  });
});

describe('the views the mod draws, shaped as the engine answers them (N8)', () => {
  /** Where a fixture and the engine's answer part, and each list either holds no entry of. @param {any} held @param {any} view */
  const fits = (held, view) => ({ misfits: misfits(held, view), fixture: emptyLists(held), engine: emptyLists(view) });
  const FITS = { misfits: [], fixture: [], engine: [] };

  it('discovery while approve the map waits, with what it parks, the directions not taken, the person\'s views and the spikes', async () => {
    for (const slug of ['frame', 'sync']) ok(dir(), ['asset', 'spike', EPIC, slug]);
    logged(['not-taken', EPIC, '--direction', 'The Mac App Store', '--why', 'the private Spaces APIs — an automatic rejection']);
    logged(['view', EPIC, '--text', 'Clean, well-structured, beautiful, and it just works']);
    logged(['spike', EPIC, '001-frame', '--tool', 'Paper', '--link', 'https://paper.design/f/1', '--showed', 'Luminous glass — reads at a glance']);
    staged();
    const held = await fixtureModule('board-discovery.mjs');

    assert.deepStrictEqual(fits({ ...held.default, waiting: [held.approval('2 topics in this order')] }, board().view), FITS);
  });

  it('a topic not started, its brief by its sections with the messages waiting for it', async () => {
    staged();
    run(answer('approve the map', 'y'));
    writeState(dir(), '.cache/tour.md', '# The tour opens first\n\nIt bears on you.\n');
    ok(dir(), ['topic', 'send', EPIC, 'note-model', '--from', 'sharing', '--content', '.leeway/.cache/tour.md', '--slug', 'tour'], { env: SESSION });

    assert.deepStrictEqual(fits(await fixture('board-brief.mjs'), board(['--page', 'topic:note-model']).view), FITS);
  });
});
