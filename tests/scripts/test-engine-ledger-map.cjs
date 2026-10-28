'use strict';

// ---------------------------------------------------------------------------
// A topic's map and the questions moved across it
// (workflow-engine/scripts/domain/ledger-read.cjs, `engine ledger map`, with
// domain/ledger-fold.cjs): a topic's questions, where each stands now and
// its answers, which its record shows too; a reworded question keeps its
// answers and its parts; a merged duplicate is no second entry; a question
// moved in or away shown by a live move the map's own unit made alone, led
// to its current wording and the topic it stands on now.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library, the work unit's manifest written there.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { ok, refuses, cleanupFixture } = require('./engine-harness.cjs');

const { UNIT, SESSION, MADE, NOTE, SPACE, ledgerReadHelpers, ledgerWorld } = require('./ledger-world.cjs');

/** @type {string} */
let dir;

beforeEach(() => {
  dir = ledgerWorld('ledger-read-');
});

afterEach(() => {
  cleanupFixture(dir);
});

const {
  write, ask, decide, change, read, rawLines, entries, full, line, current, shownMerge, answered, assertAgree, reword, menuBar, mint, dock, moves,
} = ledgerReadHelpers(() => dir);

describe('a topic\'s map (5.8.5)', () => {
  it('shows each question with where it stands, who asked it, and its current answers with whose they are', () => {
    const open = ask(NOTE, 'Does a note snap to the grid?');
    const answered = write('ask', NOTE, [], { by: 'person', who_moved_whom: 'none', text: 'Is a note a window?' }).id;
    const answer = decide(NOTE, answered, 'A panel.', [], { by: 'person' });

    const map = read('map', UNIT, 'note-window');

    assert.deepStrictEqual(map.questions, [
      { id: open, text: 'Does a note snap to the grid?', by: 'claude', at: line(open).at, stands: 'open', moved_from: null, moved_to: null, part_of: null, parts: [], answers: [] },
      {
        id: answered, text: 'Is a note a window?', by: 'person', at: line(answered).at, stands: 'answered', moved_from: null, moved_to: null, part_of: null, parts: [],
        answers: [{ id: answer, unit: UNIT, topic: 'note-window', by: 'person', text: 'A panel.' }],
      },
    ]);
    assert.deepStrictEqual([map.unit, map.topic, map.live], [UNIT, 'note-window', true]);
  });

  it('puts the unsettled part of a question an answer settles in part on the map as its own question, linked to the first (5.S15)', () => {
    const whole = ask(NOTE, 'How does a note look and behave?');
    decide(NOTE, whole, 'It looks frameless.');

    const part = ask(NOTE, 'How does a note behave?', ['--part-of', whole]);

    const rows = read('map', UNIT, 'note-window').questions;
    assert.deepStrictEqual(rows.map((/** @type {Record<string, unknown>} */ r) => [r.id, r.stands, r.part_of, r.parts]), [
      [whole, 'answered', null, [part]],
      [part, 'open', whole, []],
    ]);
  });

  it('keeps one entry, the owner\'s, unchanged, where another topic reaches the same decision, and shows that topic\'s question answered by it (5.S17)', () => {
    const owners = decide(NOTE, ask(NOTE, 'Does a note float above every Space?'), 'Notes float above every Space.');
    const reached = ask(SPACE, 'Does a note stay on its Space?');
    const before = rawLines();

    const merged = write('merge', SPACE, ['--question', reached, '--into', owners], MADE).id;

    assert.deepStrictEqual(rawLines().slice(0, -1), before, 'the merge edited a line before it');
    assert.deepStrictEqual(entries().filter((e) => e.event === 'decided' || e.event === 'replaced').map((e) => e.id), [full(owners)], 'the ledger holds a second decision');
    const [rowShown] = read('map', UNIT, 'space-homing').questions;
    assert.deepStrictEqual([rowShown.id, rowShown.stands, rowShown.answers], [reached, 'merged', [{ id: owners, unit: UNIT, topic: 'note-window', by: 'claude', text: 'Notes float above every Space.' }]]);
    const record = read('record', UNIT, 'space-homing');
    assert.deepStrictEqual([record.decisions, record.merged, record.other_topics], [[], [shownMerge(merged, null, true)], [{ ...line(owners), named: [reached, owners] }]]);
    assertAgree('space-homing');
  });

  it('takes a duplicate merged where it is found out of the current entries, so its question stands answered by the owner\'s entry alone, and no write names it as current (5.5.4, 5.5.5)', () => {
    const owners = decide(NOTE, ask(NOTE, 'Does a note float above every Space?'), 'Notes float above every Space.');
    const reached = ask(SPACE, 'Does a note stay on its Space?');
    const duplicate = decide(SPACE, reached, 'Notes float above every Space.');

    const merged = write('merge', SPACE, ['--question', reached, '--into', owners, '--duplicate', duplicate], MADE).id;

    const record = read('record', UNIT, 'space-homing');
    assert.deepStrictEqual([record.decisions, record.merged], [[], [shownMerge(merged, duplicate, true)]], 'the merge does not show the duplicate it set aside');
    assert.deepStrictEqual(read('map', UNIT, 'space-homing').questions[0].answers.map((/** @type {{id: string}} */ a) => a.id), [owners]);
    const refusal = refuses(dir, ['ledger', 'replace', SPACE, '--replaces', duplicate, '--reason', 'changed-mind'], { env: SESSION, stdin: JSON.stringify({ ...MADE, drops: [], text: 'Again.', why: 'Again.' }) });
    assert.match(refusal.error, new RegExp(`^ledger replace --replaces names ${duplicate}, which ${merged} merged as a duplicate — the current one is ${owners}$`));
  });

  it('follows the entry a question was merged into down its chain to the current one', () => {
    const owners = decide(NOTE, ask(NOTE, 'Does a note float above every Space?'), 'Notes float above every Space.');
    const reached = ask(SPACE, 'Does a note stay on its Space?');
    write('merge', SPACE, ['--question', reached, '--into', owners], MADE);

    const replaced = change(NOTE, owners, 'Notes float above every Space and display.');

    assert.deepStrictEqual(read('map', UNIT, 'space-homing').questions[0].answers.map((/** @type {{id: string}} */ a) => a.id), [replaced]);
    assert.deepStrictEqual(read('record', UNIT, 'space-homing').other_topics, [{ ...line(replaced), named: [reached, owners] }]);
  });

  it('keeps a reworded question\'s answers: a decision naming any earlier wording answers the current one, beside one naming it (5.3.13)', () => {
    const first = ask(NOTE, 'Is a note a window?');
    const decided = decide(NOTE, first, 'A panel.', [], { product_wide: true });

    const reworded = reword(NOTE, first, 'Is a note a window or a panel?');

    assert.deepStrictEqual(answered('note-window'), [[reworded, 'answered', [decided]]]);
    const record = read('record', UNIT, 'note-window');
    assert.deepStrictEqual([record.questions, record.decisions], [[current(reworded, [first])], [current(decided)]]);
    assert.deepStrictEqual(read('product').decisions, [current(decided)]);
    const later = decide(NOTE, reworded, 'A panel, on every display.');
    assert.deepStrictEqual(answered('note-window'), [[reworded, 'answered', [decided, later]]]);
    assertAgree('note-window');
  });

  it('keeps a reworded question merged: it stands answered by the entry an earlier wording was merged into (5.5.5)', () => {
    const owners = decide(NOTE, ask(NOTE, 'Does a note float above every Space?'), 'Notes float above every Space.');
    const reached = ask(SPACE, 'Does a note stay on its Space?');
    write('merge', SPACE, ['--question', reached, '--into', owners], MADE);

    const reworded = reword(SPACE, reached, 'Does a note stay on the Space it opened on?');

    assert.deepStrictEqual(answered('space-homing'), [[reworded, 'merged', [owners]]]);
    assertAgree('space-homing');
  });

  it('lists a reworded question\'s parts, each shown part of the question\'s current wording (5.3.11)', () => {
    const whole = ask(NOTE, 'How does a note look and behave?');
    const part = ask(NOTE, 'How does a note behave?', ['--part-of', whole]);

    const reworded = reword(NOTE, whole, 'How does a note look, behave and sound?');
    const later = ask(NOTE, 'How does a note sound?', ['--part-of', reworded]);

    const rows = read('map', UNIT, 'note-window').questions;
    assert.deepStrictEqual(rows.map((/** @type {Record<string, unknown>} */ r) => [r.id, r.part_of, r.parts]), [
      [part, reworded, []],
      [reworded, null, [part, later]],
      [later, reworded, []],
    ]);
  });
});

describe('a question moved, as its map shows it now (5.3.3, 5.8.5)', () => {
  it('shows no move another unit made: a question one unit moved and another reworded stands, while the first is cancelled, where the rewording was made, moved from nowhere', () => {
    mint();
    const question = ask(NOTE, 'Which Space does a new note open on?');
    write('move', NOTE, ['--question', question, '--to', 'space-homing'], MADE);
    const reworded = reword('mint.discussion.mint', question, 'Which Space, on which display, does a new note open on?');
    assert.deepStrictEqual([moves(UNIT, 'note-window'), moves(UNIT, 'space-homing'), moves('mint', 'mint')], [
      [[reworded, 'moved-away', null, 'space-homing']], [[reworded, 'open', 'note-window', null]], [],
    ]);

    ok(dir, ['workunit', 'cancel', UNIT]);

    assert.deepStrictEqual(moves('mint', 'mint'), [[reworded, 'open', null, null]]);
  });

  it('leads a question moved away only to a topic of the unit it stands in: another unit\'s move, made while the question stood there, shows on no map once it stands where it was asked again — the first unit\'s topic of the same name\'s included — and on its record as history', () => {
    dock();
    const question = ask(NOTE, 'Does a note show on the dock?');
    const reworded = reword('dock.discussion.space-homing', question, 'Does a note badge the dock icon?');
    ok(dir, ['workunit', 'cancel', UNIT]);
    const moved = write('move', 'dock.discussion.space-homing', ['--question', reworded, '--to', 'badge'], MADE).id;
    assert.deepStrictEqual([moves('dock', 'space-homing'), moves('dock', 'badge')], [[[reworded, 'moved-away', null, 'badge']], [[reworded, 'open', 'space-homing', null]]]);

    ok(dir, ['workunit', 'reactivate', UNIT]);

    assert.deepStrictEqual([moves('dock', 'space-homing'), moves('dock', 'badge'), moves(UNIT, 'note-window'), moves(UNIT, 'space-homing')], [[], [], [[reworded, 'open', null, null]], []]);
    assert.deepStrictEqual(read('record', 'dock', 'space-homing').moved, [{ ...line(moved), text: 'Does a note badge the dock icon?' }]);
  });

  it('shows no row for a question moved to a topic set aside, the topic it moved from keeping the move on its record as history alone, until the topic it moved to is reactivated', () => {
    const question = ask(NOTE, 'Which Space does a new note open on?');
    const moved = write('move', NOTE, ['--question', question, '--to', 'space-homing'], MADE).id;

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'space-homing']);

    assert.deepStrictEqual(moves(UNIT, 'note-window'), []);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').moved, [{ ...line(moved), text: 'Which Space does a new note open on?' }]);
    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'space-homing']);
    assert.deepStrictEqual(moves(UNIT, 'note-window'), [[question, 'moved-away', null, 'space-homing']]);
  });

  it('places a question where the last move its unit made of it took it, a move outliving the topic it was made from: it stands there, set aside with that topic alone, and names where it moved from while that is live', () => {
    menuBar();
    const once = ask(NOTE, 'Does a note snap to the grid?');
    write('move', NOTE, ['--question', once, '--to', 'space-homing'], MADE);
    const twice = ask(NOTE, 'Which Space does a new note open on?');
    write('move', NOTE, ['--question', twice, '--to', 'space-homing'], MADE);
    write('move', SPACE, ['--question', twice, '--to', 'menu-bar'], MADE);
    const maps = () => ['note-window', 'space-homing', 'menu-bar'].map((topic) => moves(UNIT, topic));
    assert.deepStrictEqual(maps(), [
      [[once, 'moved-away', null, 'space-homing'], [twice, 'moved-away', null, 'menu-bar']],
      [[once, 'open', 'note-window', null], [twice, 'moved-away', null, 'menu-bar']],
      [[twice, 'open', 'space-homing', null]],
    ]);

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);
    assert.deepStrictEqual(maps(), [[], [[once, 'open', null, null], [twice, 'moved-away', null, 'menu-bar']], [[twice, 'open', 'space-homing', null]]]);
    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'note-window']);

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'space-homing']);
    assert.deepStrictEqual(maps(), [[[twice, 'moved-away', null, 'menu-bar']], [], [[twice, 'open', null, null]]]);
    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'space-homing']);

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'menu-bar']);
    assert.deepStrictEqual(maps(), [[[once, 'moved-away', null, 'space-homing']], [[once, 'open', 'note-window', null]], []]);
  });
});
