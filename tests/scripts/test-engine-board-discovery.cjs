'use strict';

// ---------------------------------------------------------------------------
// `engine board` in an epic's discovery (leeway-engine/scripts/domain/
// projections/board-discovery.cjs, 20.11): the map as it stands, the map
// Claude staged while approve the map waits on the person with what it parks
// on the roadmap, a topic's brief by its sections — a staged topic's from
// its draft — the epic's spikes and a spike's page, and, the map approved,
// the epic's first topic next.
//
// Layer: verb. World: discovery's gate suites' epic to shape
// (discovery-gates-world.cjs), copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, writeState, layout } = require('./engine-harness.cjs');
const { EPIC, SESSION, useGatesWorld, gatesHelpers } = require('./discovery-gates-world.cjs');
const { SESSION_ID } = require('./ledger-world.cjs');

const dir = useGatesWorld('epic');
const { scratch, screen, answer, run } = gatesHelpers(dir);

/** The board's answer for the world's conversation, at the epic's discovery. @param {string[]} [args] */
function board(args = []) {
  ok(dir(), ['session', 'label', EPIC, 'discovery', EPIC], { env: SESSION });
  const { view, banner } = ok(dir(), ['board', SESSION_ID, ...args], { env: SESSION });
  return { view, banner };
}

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

describe('discovery on the board (20.11)', () => {
  it('the epic\'s map as it stands, nothing waiting on the person', () => {
    assert.deepStrictEqual(board(), {
      view: { kind: 'discovery', unit: EPIC, title: 'Fumi', type: 'epic', session: 1, waits: false, map: [], roadmap: [], spikes: [] },
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
        waits: true,
        map: [{ topic: 'note-model', title: 'Note Model', summary: 'What a note is' }, { topic: 'sharing', title: 'Sharing', summary: 'Sharing a note' }],
        roadmap: [{ title: 'Fumi Sync, a hosted sync service', horizon: 'later' }],
        spikes: [],
      },
      banner: { name: 'Fumi', state: 'needs', facts: [fact('epic'), fact('discovery'), fact('2 topics on the map'), fact('the map waits on you', true)] },
    });
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
        { spike: '001-frame', title: 'Frame', status: 'canonical' },
        { spike: '002-sync', title: 'Sync', status: 'reference' },
        { spike: '003-list', title: 'List', status: null },
      ],
      page: { kind: 'spike', unit: EPIC, spike: '001-frame', title: 'Frame', status: 'canonical', path: `${EPIC}/spikes/001-frame` },
      none: { kind: 'unavailable', reason: 'fumi has no spike 009-none' },
    });
  });

  it('the map approved, the epic\'s page names its first topic next while none has started, the rest not started (20.8.1)', () => {
    staged();
    run(answer('approve the map', 'y'));
    const states = () => board(['--tab', 'unit']).view.topics.map(({ topic, state }) => [topic, state]);
    const approved = states();
    ok(dir(), ['topic', 'start', EPIC, 'discussion', 'note-model'], { env: SESSION });

    assert.deepStrictEqual([approved, states()], [[['note-model', 'next'], ['sharing', 'not-started']], [['note-model', 'discussing'], ['sharing', 'not-started']]]);
  });
});
