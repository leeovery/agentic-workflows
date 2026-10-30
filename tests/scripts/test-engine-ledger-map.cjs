'use strict';

// ---------------------------------------------------------------------------
// A topic's map and the questions moved across it
// (leeway-engine/scripts/domain/ledger-read.cjs, `engine ledger map`, with
// domain/ledger-fold.cjs): a topic's questions, where each stands now and
// its answers, which its record shows too, and an answer whose question is
// set aside on a row of its own; a reworded question keeps its answers and
// its parts; a merged duplicate is no second entry; a question moved in or
// away shown by a live move the map's own unit made alone, led to its
// current wording and the topic it stands on now; a question moved to the
// roadmap standing later where it is; and an open question an experiment
// of its unit measures marked waiting on it until its result is written.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library, the work unit's manifest written there.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { ok, refuses, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const { UNIT, SESSION, MADE, NOTE, SPACE, PHASES, ids, ledgerReadHelpers, ledgerWorld } = require('./ledger-world.cjs');

const MINT = 'mint.discussion.mint';

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
  it('shows each question with where it stands, who asked it, and its current answers with whose they are; a reworded question keeps its answers, a decision naming any earlier wording answering the current one, beside one naming it (5.3.13)', () => {
    const open = ask(NOTE, 'Does a note snap to the grid?');
    const asked = write('ask', NOTE, [], { by: 'person', who_moved_whom: 'none', text: 'Is a note a window?' }).id;
    const answer = decide(NOTE, asked, 'A panel.', [], { by: 'person', product_wide: true });

    const map = read('map', UNIT, 'note-window');

    assert.deepStrictEqual(map.questions, [
      { id: open, text: 'Does a note snap to the grid?', by: 'claude', at: line(open).at, stands: 'open', moved_from: null, moved_to: null, stands_in: null, part_of: null, parts: [], answers: [], waiting_on: null },
      {
        id: asked, text: 'Is a note a window?', by: 'person', at: line(asked).at, stands: 'answered', moved_from: null, moved_to: null, stands_in: null, part_of: null, parts: [],
        answers: [{ id: answer, unit: UNIT, topic: 'note-window', by: 'person', given: 'own', text: 'A panel.' }], waiting_on: null,
      },
    ]);
    assert.deepStrictEqual([map.unit, map.topic, map.live], [UNIT, 'note-window', true]);

    const reworded = reword(NOTE, asked, 'Is a note a window or a panel?');

    assert.deepStrictEqual(answered('note-window'), [[open, 'open', []], [reworded, 'answered', [answer]]]);
    const record = read('record', UNIT, 'note-window');
    assert.deepStrictEqual([record.questions, record.decisions], [[current(open), current(reworded, [asked])], [current(answer)]]);
    assert.deepStrictEqual(read('product').decisions, [current(answer)]);
    const later = decide(NOTE, reworded, 'A panel, on every display.');
    assert.deepStrictEqual(answered('note-window')[1], [reworded, 'answered', [answer, later]]);
    assertAgree('note-window');
  });

  it('puts the unsettled part of a question an answer settles in part on the map as its own question, linked to the first, and lists a reworded question\'s parts, each shown part of its current wording — a part asked of a wording set aside since too, the question standing again in the wording before it (5.S15, 5.3.11, 5.8.17)', () => {
    mint();
    const whole = ask(NOTE, 'How does a note look and behave?');
    decide(NOTE, whole, 'It looks frameless.');

    const part = ask(NOTE, 'How does a note behave?', ['--part-of', whole]);

    const rows = () => read('map', UNIT, 'note-window').questions.map((/** @type {Record<string, unknown>} */ r) => [r.id, r.stands, r.part_of, r.parts]);
    assert.deepStrictEqual(rows(), [[whole, 'answered', null, [part]], [part, 'open', whole, []]]);
    const reworded = reword(NOTE, whole, 'How does a note look, behave and sound?');
    const later = ask(NOTE, 'How does a note sound?', ['--part-of', reworded]);
    assert.deepStrictEqual(rows(), [[part, 'open', reworded, []], [reworded, 'answered', null, [part, later]], [later, 'open', reworded, []]]);
    const inMint = reword(MINT, reworded, 'How does a Mint note look, behave and sound?');
    const third = ask(NOTE, 'How does a Mint note sound?', ['--part-of', inMint]);

    ok(dir, ['workunit', 'cancel', 'mint']);

    assert.deepStrictEqual(rows(), [[part, 'open', reworded, []], [reworded, 'answered', null, [part, later, third]], [later, 'open', reworded, []], [third, 'open', reworded, []]]);
  });

  it('keeps one entry, the owner\'s, unchanged, where another topic reaches the same decision, and shows that topic\'s question answered by it, reworded or not, followed down the owner\'s chain to the current entry (5.S17, 5.5.5)', () => {
    const owners = decide(NOTE, ask(NOTE, 'Does a note float above every Space?'), 'Notes float above every Space.');
    const reached = ask(SPACE, 'Does a note stay on its Space?');
    const before = rawLines();

    const merged = write('merge', SPACE, ['--question', reached, '--into', owners], MADE).id;

    assert.deepStrictEqual(rawLines().slice(0, -1), before, 'the merge edited a line before it');
    assert.deepStrictEqual(entries().filter((e) => e.event === 'decided' || e.event === 'replaced').map((e) => e.id), [full(owners)], 'the ledger holds a second decision');
    const [rowShown] = read('map', UNIT, 'space-homing').questions;
    assert.deepStrictEqual([rowShown.id, rowShown.stands, rowShown.answers], [reached, 'merged', [{ id: owners, unit: UNIT, topic: 'note-window', by: 'claude', given: 'own', text: 'Notes float above every Space.' }]]);
    const record = read('record', UNIT, 'space-homing');
    assert.deepStrictEqual([record.decisions, record.merged, record.other_topics], [[], [shownMerge(merged, null, true)], [{ ...line(owners), named: [reached, owners] }]]);
    assertAgree('space-homing');

    const reworded = reword(SPACE, reached, 'Does a note stay on the Space it opened on?');
    const replaced = change(NOTE, owners, 'Notes float above every Space and display.');

    assert.deepStrictEqual(answered('space-homing'), [[reworded, 'merged', [replaced]]]);
    assert.deepStrictEqual(read('record', UNIT, 'space-homing').other_topics, [{ ...line(replaced), named: [owners, reworded] }]);
    assertAgree('space-homing');
  });

  it('takes a duplicate merged where it is found out of the current entries, so its question stands answered by the owner\'s entry alone, and no write names it as current; merged in a wording set aside since, the question stays merged, standing again in its first wording (5.5.4, 5.5.5, 5.8.17)', () => {
    mint();
    const owners = decide(NOTE, ask(NOTE, 'Does a note float above every Space?'), 'Notes float above every Space.');
    const reached = ask(SPACE, 'Does a note stay on its Space?');
    const duplicate = decide(SPACE, reached, 'Notes float above every Space.');
    const reworded = reword(MINT, reached, 'Does a Mint note stay on its Space?');

    const merged = write('merge', SPACE, ['--question', reworded, '--into', owners, '--duplicate', duplicate], MADE).id;

    const record = read('record', UNIT, 'space-homing');
    assert.deepStrictEqual([record.decisions, record.merged], [[], [shownMerge(merged, duplicate, true)]], 'the merge does not show the duplicate it set aside');
    assert.deepStrictEqual(answered('space-homing'), [[reworded, 'merged', [owners]]]);
    const refusal = refuses(dir, ['ledger', 'replace', SPACE, '--replaces', duplicate, '--reason', 'changed-mind'], { env: SESSION, stdin: JSON.stringify({ ...MADE, drops: [], text: 'Again.', why: 'Again.' }) });
    assert.match(refusal.error, new RegExp(`^ledger replace --replaces names ${duplicate}, which ${merged} merged as a duplicate — the current one is ${owners}$`));

    ok(dir, ['workunit', 'cancel', 'mint']);

    assert.deepStrictEqual(answered('space-homing'), [[reached, 'merged', [owners]]]);
    assertAgree('space-homing');
  });

});

describe('a question moved, as its map shows it now (5.3.3, 5.8.5)', () => {
  it('shows no move another unit made: a question one unit moved and another reworded shows where the rewording was made as standing elsewhere, and stands there, moved from nowhere, while the first is cancelled (5.8.19)', () => {
    mint();
    const question = ask(NOTE, 'Which Space does a new note open on?');
    write('move', NOTE, ['--question', question, '--to', 'space-homing'], MADE);
    const reworded = reword('mint.discussion.mint', question, 'Which Space, on which display, does a new note open on?');
    assert.deepStrictEqual([moves(UNIT, 'note-window'), moves(UNIT, 'space-homing'), moves('mint', 'mint')], [
      [[reworded, 'moved-away', null, 'space-homing']], [[reworded, 'open', 'note-window', null]], [[reworded, 'elsewhere', null, null]],
    ]);

    ok(dir, ['workunit', 'cancel', UNIT]);

    assert.deepStrictEqual(moves('mint', 'mint'), [[reworded, 'open', null, null]]);
  });

  it('leads a question moved away only to a topic of the unit it stands in: another unit\'s move, made while the question stood there, shows on no map once it stands where it was asked again — the first unit\'s topic of the same name\'s included — and on its record as history, the rewording standing elsewhere on the topic that unit moved it to (5.8.19)', () => {
    dock();
    const question = ask(NOTE, 'Does a note show on the dock?');
    const reworded = reword('dock.discussion.space-homing', question, 'Does a note badge the dock icon?');
    ok(dir, ['workunit', 'cancel', UNIT]);
    const moved = write('move', 'dock.discussion.space-homing', ['--question', reworded, '--to', 'badge'], MADE).id;
    assert.deepStrictEqual([moves('dock', 'space-homing'), moves('dock', 'badge')], [[[reworded, 'moved-away', null, 'badge']], [[reworded, 'open', 'space-homing', null]]]);

    ok(dir, ['workunit', 'reactivate', UNIT]);

    assert.deepStrictEqual([moves('dock', 'space-homing'), moves('dock', 'badge'), moves(UNIT, 'note-window'), moves(UNIT, 'space-homing')], [[], [[reworded, 'elsewhere', null, null]], [[reworded, 'open', null, null]], []]);
    assert.deepStrictEqual(read('record', 'dock', 'space-homing').moved, [{ ...line(moved), text: 'Does a note badge the dock icon?' }]);
  });

  it('shows no row for a question moved to a topic set aside, the topic it moved from keeping the move on its record as history alone, and a current answer to it placed there as a row of its own: laid in the ledger\'s order among the questions\' rows, headed as a row\'s answer shows one — where it was made, and what the late check found of it, nothing before the check judges it — as its record and `since` show it, and saying where it stands on the map of a place it was made in alone; until the topic it moved to is reactivated (5.8.19)', () => {
    mint();
    const open = ask(NOTE, 'Does a note snap to the grid?');
    const question = ask(NOTE, 'Which Space does a new note open on?');
    const answer = decide(NOTE, question, 'The active Space.');
    const framed = change(MINT, answer, 'The Space it was made on.');
    const later = ask(NOTE, 'Does a note dim when idle?');
    const moved = write('move', NOTE, ['--question', question, '--to', 'space-homing'], MADE).id;
    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'space-homing']);

    const { id, unit, topic, by, given, text, at } = line(framed);
    const unjudged = { id, unit, topic, by, given, text, at, stands: 'question-set-aside', moved_from: null, moved_to: null, stands_in: null, part_of: null, parts: [], answers: [], waiting_on: null };
    assert.deepStrictEqual(read('map', UNIT, 'note-window').questions[1], unjudged);
    ok(dir, ['ledger', 'late-check'], { env: { CLAUDE_CODE_SESSION_ID: 'session-2', CLAUDE_STUB_ANSWERS: JSON.stringify({ '': { rules: ['One rule.'] } }) } });
    const row = { ...unjudged, late_check: 'one' };
    const rows = read('map', UNIT, 'note-window').questions;
    assert.deepStrictEqual([ids(rows), rows[1], read('map', 'mint', 'mint').questions], [[open, framed, later], row, [{ ...row, stands_in: { unit: UNIT, topic: 'note-window' } }]]);
    const record = read('record', UNIT, 'note-window');
    assert.deepStrictEqual([ids(record.decisions), record.moved], [[framed], [{ ...line(moved), text: 'Which Space does a new note open on?' }]]);
    assert.deepStrictEqual(ids(read('since', UNIT, 'note-window').calls), [framed]);
    assertAgree('note-window');

    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'space-homing']);

    assert.deepStrictEqual(answered('note-window'), [[open, 'open', []], [question, 'moved-away', [framed]], [later, 'open', []]]);
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

describe('a question moved to the roadmap (9.5.4)', () => {
  it('stands later where it was asked, naming the roadmap\'s item, the move on its record, until a decision answers it or a later move of its unit takes it to a topic; a move to an item the roadmap lacks is refused', () => {
    const syncing = ask(NOTE, 'Do notes sync across Macs?');
    const sharing = ask(NOTE, 'Can a note be shared?');
    const toSync = ['--question', syncing, '--to', 'roadmap:sync'];
    const lacking = refuses(dir, ['ledger', 'move', NOTE, ...toSync], { env: SESSION, stdin: JSON.stringify(MADE) });
    assert.strictEqual(lacking.error, 'ledger move: --to names roadmap:sync, and the roadmap has no item "sync" — put it on the roadmap first');
    ok(dir, ['roadmap', 'add', 'sync', '--horizon', 'v2', '--summary', 'Notes sync across Macs']);

    const moved = write('move', NOTE, toSync, MADE).id;
    write('move', NOTE, ['--question', sharing, '--to', 'roadmap:sync'], MADE);

    assert.deepStrictEqual(moves(UNIT, 'note-window'), [[syncing, 'later', null, 'roadmap:sync'], [sharing, 'later', null, 'roadmap:sync']]);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').moved.slice(0, 1), [{ ...line(moved), text: 'Do notes sync across Macs?' }]);
    const shared = decide(NOTE, sharing, 'A note is shared as a link.');
    write('move', NOTE, ['--question', syncing, '--to', 'space-homing'], MADE);
    assert.deepStrictEqual([answered('note-window'), moves(UNIT, 'space-homing')], [[[syncing, 'moved-away', []], [sharing, 'answered', [shared]]], [[syncing, 'open', 'note-window', null]]]);
  });
});

describe('a question an experiment measures (9.1.11)', () => {
  it('marks an open question waiting on the experiment of its unit that names it, in any wording, until the discussion writes the result: running or concluded, never abandoned, and no longer once the question is answered', () => {
    const timing = ask(NOTE, 'How fast does a panel open?');
    const snapping = ask(NOTE, 'Does a note snap to the grid?');
    /** The unit's manifest with experiment E1 at `status`, measuring the question. @param {string} status */
    const measuring = (status) => createManifest(dir, UNIT, {
      work_type: 'epic', phases: { ...PHASES, experiment: { items: { 'note-window': { status: 'in-progress', experiments: { E1: { slug: 'open-time', status, question: full(timing) } } } } } },
    });
    const waits = () => read('map', UNIT, 'note-window').questions.map((/** @type {Record<string, unknown>} */ r) => [r.id, r.waiting_on]);

    measuring('running');

    const reworded = reword(NOTE, timing, 'How fast does a panel open, cold?');
    assert.deepStrictEqual(waits(), [[snapping, null], [reworded, 'E1']]);
    measuring('concluded');
    assert.deepStrictEqual(waits(), [[snapping, null], [reworded, 'E1']], 'the result is the discussion\'s to write');
    measuring('abandoned');
    assert.deepStrictEqual(waits(), [[snapping, null], [reworded, null]], 'an abandoned experiment leaves its question open');
    measuring('concluded');
    decide(NOTE, reworded, 'In 4 ms.');
    assert.deepStrictEqual(waits(), [[snapping, null], [reworded, null]]);
  });
});
