'use strict';

// ---------------------------------------------------------------------------
// `engine board` on an epic's page (leeway-engine/scripts/domain/projections/
// board-unit.cjs, board-all.cjs; 20.8, 20.16): the epic's page, its topics'
// experiments and what happened lately, and a topic's page from it — a
// started one's discussion, a cancelled one's once it started; and All
// work's roadmap, the topics postponed out of the epic among it. Other
// units' pages are test-engine-board-units.cjs's.
//
// Layer: verb. World: the decided suites' (decided-world.cjs) — the epic
// `fumi`, its note window's map written, its two topics under discussion —
// copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { ok, output, writeState, readManifest, stateGit, layout } = require('./engine-harness.cjs');
const { useDecidedWorld, decidedHelpers, decidedBoardHelpers, writeIn, NO_PAYLOAD } = require('./decided-world.cjs');
const { UNIT, SESSION, MADE, NOTE } = require('./ledger-world.cjs');
const { place } = require('./board-world.cjs');

const dir = useDecidedWorld();
const { close, staged, answer, run } = decidedHelpers(dir);
const { board, at, sent } = decidedBoardHelpers(dir);

/** When the world's epic had its map approved, as its manifest records it. */
const approvedOn = () => readManifest(dir(), UNIT).phases.discovery.approved_at;

describe('an epic\'s page (20.8)', () => {
  it('at the epic\'s menu, This session is its page: each topic with its state and its person\'s questions decided, the specification and build waiting; the banner counts its topics decided', () => {
    at([UNIT]);
    const { view, banner } = board();

    assert.deepStrictEqual({ view, banner }, {
      view: {
        kind: 'epic',
        unit: UNIT,
        title: 'Fumi',
        about: 'Test: fumi',
        started: null,
        now: { phase: 'discussion', since: approvedOn() },
        at_menu: true,
        here: true,
        progress: { decided: 0, total: 2, discussing: 2 },
        waiting: [],
        topics: [
          { topic: 'note-window', title: 'Note Window', state: 'discussing', decided: 1, total: 1, session: null, messages: 0, experiment: null },
          { topic: 'space-homing', title: 'Space Homing', state: 'discussing', decided: 0, total: 0, session: null, messages: 0, experiment: null },
        ],
        spec: { state: 'waits', words: '', session: null },
        build: { state: 'waits', session: null },
        set_aside: [],
        lately: view.lately,
      },
      banner: { name: 'Fumi', state: 'running', facts: [place('epic'), place('at its menu'), { text: '0 of 2 topics decided', needs: false }] },
    });
  });

  it('20.8.2 LATELY: what the state\'s history says happened in the epic, newest first, each topic by its title, a message sent with its sender', () => {
    at([UNIT]);
    sent('note-window', 'space-homing', 'The tour opens first');
    ok(dir(), ['topic', 'postpone', UNIT, 'space-homing', '--horizon', 'later'], { env: SESSION });
    const { lately } = board().view;

    assert.deepStrictEqual(lately.slice(0, 2).map(({ kind, topic, detail }) => ({ kind, topic, detail })), [
      { kind: 'postponed', topic: 'Space Homing', detail: 'later' },
      { kind: 'sent', topic: 'Space Homing', detail: 'Note Window' },
    ]);
  });

  it('N8, 20.8.2: messages one topic took in one after another are one moment, counted — a message taken in alone names its sender — and the map approved again says what it took in', () => {
    ok(dir(), ['enter', 'discovery', UNIT], { env: SESSION });
    output(dir(), ['render', 'approve-map', UNIT, '--file', writeState(dir(), layout.cache('scratch', 'map.json'), JSON.stringify({ topics: [{ name: 'note-window' }, { name: 'space-homing' }], parks: [] }))], { env: SESSION });
    ok(dir(), ['approve-map', 'yes', UNIT], { env: SESSION });
    at([UNIT]);
    sent('space-homing', 'note-window', 'Notes open on their Space');
    const [first] = fs.readdirSync(path.join(dir(), '.leeway', UNIT, 'topics', 'note-window', 'mail'));
    ok(dir(), ['topic', 'answered', UNIT, 'note-window', first.replace(/\.md$/, ''), '--entry', writeIn(dir(), 'ask', NOTE, [], { ...MADE, text: 'Do notes open on their Space?' })], { env: SESSION });
    const alone = board().view.lately[0];
    sent('space-homing', 'note-window', 'A note keeps its Space');
    sent('space-homing', 'note-window', 'A note follows its window');
    for (const file of fs.readdirSync(path.join(dir(), '.leeway', UNIT, 'topics', 'note-window', 'mail'))) {
      ok(dir(), ['topic', 'answered', UNIT, 'note-window', file.replace(/\.md$/, ''), '--entry', writeIn(dir(), 'ask', NOTE, [], { ...MADE, text: `Is ${file} so?` })], { env: SESSION });
    }
    const said = (/** @type {any} */ { kind, topic, detail, count }) => ({ kind, topic, detail, count });
    const { lately } = board().view;

    assert.deepStrictEqual([said(alone), lately.slice(0, 2).map(said), said(lately.find(({ kind }) => kind === 'map-approved'))], [
      { kind: 'answered', topic: 'Note Window', detail: 'Space Homing', count: 1 },
      [{ kind: 'answered', topic: 'Note Window', detail: null, count: 2 }, { kind: 'sent', topic: 'Note Window', detail: 'Space Homing', count: undefined }],
      { kind: 'map-approved', topic: null, detail: '2 topics, 0 to the roadmap', count: undefined },
    ]);
  });

  it('20.8.2 LATELY shows the latest ten of the epic\'s moments, newest first', () => {
    at([UNIT]);
    for (let k = 1; k <= 11; k += 1) stateGit(dir(), ['commit', '-q', '--allow-empty', '-m', `review(${UNIT}): round ${k}`]);
    const { lately } = board().view;

    assert.deepStrictEqual(lately.map(({ detail }) => detail), Array.from({ length: 10 }, (_, k) => `${11 - k}`));
  });

  it('S1, N4, 20.16.1: All work\'s roadmap lists a topic postponed out of an epic by its title, not its summary, with the epic\'s title', () => {
    at([UNIT]);
    const summary = 'Where someone meets Fumi before paying: the only place a prospective buyer sees it work, carrying Buy, the download and the terms';
    ok(dir(), ['topic', 'add', UNIT, 'website', '--summary', summary, '--brief', writeState(dir(), layout.cache('scratch', 'website.md'), '# Website\n')], { env: SESSION });
    ok(dir(), ['topic', 'postpone', UNIT, 'website', '--horizon', 'later'], { env: SESSION });
    const item = board(['--tab', 'all']).view.roadmap.find(({ horizon }) => horizon === 'later').items.find(({ from }) => from !== null);

    assert.deepStrictEqual(item, { title: 'Website', from: 'Fumi' });
  });

  it('18.8.13: All work\'s roadmap leaves an archived item out, its horizon showing what still waits', () => {
    at([UNIT]);
    ok(dir(), ['roadmap', 'add', 'loyalty', '--horizon', 'later', '--summary', 'Points for regulars']);
    ok(dir(), ['roadmap', 'add', 'gift-cards', '--horizon', 'later', '--summary', 'Cards to give']);
    ok(dir(), ['roadmap', 'archive', 'loyalty']);

    assert.deepStrictEqual(board(['--tab', 'all']).view.roadmap, [{ horizon: 'later', items: [{ title: 'Cards to give', from: null }] }]);
  });

  it('18.8.20: All work\'s roadmap shows an item put back on no horizon, its own removed while it was in flight, under (no horizon) as the roadmap\'s view does', () => {
    at([UNIT]);
    ok(dir(), ['roadmap', 'add', 'loyalty', '--horizon', 'later', '--summary', 'Points for regulars']);
    const brief = writeState(dir(), layout.cache('scratch', 'points.md'), '# Points\n');
    ok(dir(), ['topic', 'add', UNIT, 'points-scheme', '--summary', 'Points', '--brief', brief, '--from-roadmap', 'loyalty'], { env: SESSION });
    ok(dir(), ['roadmap', 'horizon', 'remove', 'later']);
    ok(dir(), ['topic', 'remove', UNIT, 'points-scheme'], { env: SESSION });

    assert.deepStrictEqual(board(['--tab', 'all']).view.roadmap, [{ horizon: '(no horizon)', items: [{ title: 'Points for regulars', from: null }] }]);
  });

  it('N5, D29: a topic decided, and one cancelled once its discussion started, open on the discussion\'s page; one cancelled before it started — though a message waited for it — and one postponed, on its brief', () => {
    at([UNIT]);
    close();
    staged(NO_PAYLOAD);
    run(answer('decided', 'y'));
    ok(dir(), ['topic', 'cancel', UNIT, 'discovery', 'space-homing'], { env: SESSION });
    for (const topic of ['tray-icon', 'dock-menu']) ok(dir(), ['topic', 'add', UNIT, topic, '--summary', `The ${topic}`, '--brief', writeState(dir(), layout.cache('scratch', `${topic}.md`), `# ${topic}\n`)], { env: SESSION });
    sent('note-window', 'tray-icon', 'The tray shows the note count');
    ok(dir(), ['topic', 'cancel', UNIT, 'discovery', 'tray-icon'], { env: SESSION });
    ok(dir(), ['topic', 'postpone', UNIT, 'dock-menu', '--horizon', 'later'], { env: SESSION });
    const page = (/** @type {string} */ topic) => board(['--tab', 'unit', '--page', `topic:${topic}`]).view.kind;

    assert.deepStrictEqual(['note-window', 'space-homing', 'tray-icon', 'dock-menu'].map(page), ['discussion', 'discussion', 'brief', 'brief']);
    assert.strictEqual(readManifest(dir(), UNIT).phases.discussion.items['tray-icon']?.previous_status, 'unstarted', 'the message parked an unstarted discussion item, which the cancel set aside');
  });

  it('20.8.3: a started topic\'s page, read over the session, carries its summary on the map and is no live discussion; the topic the session is in is', () => {
    at([UNIT, 'discussion', 'note-window']);
    const summary = readManifest(dir(), UNIT).phases.discovery.items['space-homing'].summary;
    const page = board(['--tab', 'unit', '--page', 'topic:space-homing']).view;

    assert.deepStrictEqual([page.summary, page.live, board().view.live], [summary, false, true]);
    assert.notStrictEqual(summary, '');
  });

  it('on the epic\'s tab the topic the session is in is this session\'s, and a topic opens on its own page (20.8.3, 20.15.2)', () => {
    at([UNIT, 'discussion', 'note-window']);
    const tab = board(['--tab', 'unit']).view;
    const page = board(['--tab', 'unit', '--page', 'topic:space-homing']).view;

    assert.deepStrictEqual([tab.kind, tab.topics.map(({ session }) => session), page.kind, page.topic], ['epic', ['this', null], 'discussion', 'space-homing']);
  });
});
