'use strict';

// ---------------------------------------------------------------------------
// Where an entry stands (workflow-engine/scripts/domain/ledger-fold.cjs,
// read through domain/ledger-read.cjs, `engine ledger record|map`): where
// the earliest entry of its chain in a live place was made. A replacement
// made from the spec or by another unit stays on the topic's record and
// map, and shows where it was made as another place's current answer; a
// finished unit stays finished when a later one replaces its decision; a
// question reworded or moved, after it was answered or however often,
// stands whole where it is now, its answers read from their own lines.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library, the work unit's manifest written there.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { ok, statePath, cleanupFixture } = require('./engine-harness.cjs');

const { UNIT, MADE, NOTE, SPACE, ids, ledgerReadHelpers, ledgerWorld } = require('./ledger-world.cjs');

/** @type {string} */
let dir;

beforeEach(() => {
  dir = ledgerWorld('ledger-read-');
});

afterEach(() => {
  cleanupFixture(dir);
});

const {
  write, ask, find, decide, change, read, line, current, answered, assertAgree, changeFromSpec, reword, menuBar, mint,
} = ledgerReadHelpers(() => dir);

describe('where an entry stands (5.3.3, 5.8.4)', () => {
  it('keeps a decision replaced from the spec on its topic\'s record and map, the replacement current with the decision beneath it, and once on the unit\'s record', () => {
    const question = ask(NOTE, 'Is a note a window?');
    const decided = decide(NOTE, question, 'A panel.');

    const replacement = changeFromSpec(decided, { text: 'A sheet.', why: 'Sheets stack.' });

    assert.strictEqual(line(replacement).topic, null);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions, [current(replacement, [decided])]);
    const [rowShown] = read('map', UNIT, 'note-window').questions;
    assert.deepStrictEqual(rowShown.answers, [{ id: replacement, unit: UNIT, topic: null, by: 'claude', text: 'A sheet.' }]);
    assert.deepStrictEqual(read('record', UNIT).decisions, [current(replacement, [decided])]);
    assertAgree('note-window');
  });

  it('keeps another unit\'s replacement of a topic\'s decision on that topic\'s record and map, where its chain stands, and shows it where it was made, on the replacing unit\'s record and map, as another place\'s current answer (5.6.1, 5.8.19)', () => {
    mint();
    const question = ask(NOTE, 'Is a note a window?');
    const decided = decide(NOTE, question, 'A panel.');

    const replacement = change('mint.discussion.mint', decided, 'A sheet.');

    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions, [current(replacement, [decided])]);
    assert.deepStrictEqual(read('map', UNIT, 'note-window').questions[0].answers, [{ id: replacement, unit: 'mint', topic: 'mint', by: 'claude', text: 'A sheet.' }]);
    for (const minted of [read('record', 'mint'), read('record', 'mint', 'mint')]) {
      assert.deepStrictEqual([minted.questions, minted.decisions, minted.other_topics], [[], [], [{ ...line(replacement), named: [] }]]);
    }
    const [row] = read('map', 'mint', 'mint').questions;
    assert.deepStrictEqual([row.id, row.stands, row.stands_in, ids(row.answers)], [question, 'elsewhere', { unit: UNIT, topic: 'note-window' }, [replacement]]);
    assertAgree('note-window');
  });

  it('leaves a finished unit finished when a later unit replaces its decision: its entries stay current until replaced, and its record shows the new answer with the old beneath it (5.S10)', () => {
    mint();
    const question = ask(NOTE, 'Is a note a window?');
    const decided = decide(NOTE, question, 'A panel.');
    const relying = find(NOTE, 'A panel takes no focus.', ['--relies-on', decided]);
    ok(dir, ['manifest', 'set', UNIT, 'status', 'completed']);
    const finished = read('record', UNIT, 'note-window');
    assert.deepStrictEqual([finished.questions, finished.findings, finished.decisions], [[current(question)], [current(relying)], [current(decided)]]);

    const minted = change('mint.discussion.mint', decided, 'A sheet.');

    assert.strictEqual(JSON.parse(fs.readFileSync(statePath(dir, UNIT, 'manifest.json'), 'utf8')).status, 'completed', 'the replacement reopened the finished unit');
    const record = read('record', UNIT, 'note-window');
    assert.deepStrictEqual([record.questions, record.findings, record.decisions], [[current(question)], [current(relying)], [current(minted, [decided])]]);
    assert.deepStrictEqual(answered('note-window'), [[question, 'answered', [minted]]]);
    assertAgree('note-window');
  });

  it('keeps a question reworded from the spec on its topic\'s map and record, the old wording beneath it', () => {
    const first = ask(NOTE, 'Is a note a window?');

    const reworded = changeFromSpec(first, { text: 'Is a note a window or a panel?' });

    assert.deepStrictEqual(answered('note-window'), [[reworded, 'open', []]]);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').questions, [current(reworded, [first])]);
    assert.deepStrictEqual(ids(read('record', UNIT).questions), [reworded]);
  });

  it('shows a question moved after it was answered with its answer on the topic it moved to, read from the answer\'s own line where it was given (5.S16)', () => {
    const question = ask(NOTE, 'Which Space does a new note open on?');
    const decided = decide(NOTE, question, 'The active one.');

    const moved = write('move', NOTE, ['--question', question, '--to', 'space-homing'], MADE).id;

    const there = read('record', UNIT, 'space-homing');
    assert.deepStrictEqual([there.questions, there.decisions, there.other_topics], [[current(question)], [], [{ ...line(decided), named: [question] }]]);
    assert.deepStrictEqual(answered('space-homing'), [[question, 'answered', [decided]]]);
    const here = read('record', UNIT, 'note-window');
    assert.deepStrictEqual([here.questions, here.decisions, ids(here.moved)], [[], [current(decided)], [moved]]);
    assertAgree('space-homing');
    assertAgree('note-window');
  });

  it('moves a reworded question whole: its every wording stands where it moved, and the old topic\'s map shows it moved away', () => {
    const first = ask(NOTE, 'Which Space does a new note open on?');
    const reworded = reword(NOTE, first, 'Which Space, on which display, does a new note open on?');

    write('move', NOTE, ['--question', reworded, '--to', 'space-homing'], MADE);

    assert.deepStrictEqual(read('record', UNIT, 'space-homing').questions, [current(reworded, [first])]);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').questions, []);
    assert.deepStrictEqual(answered('note-window'), [[reworded, 'moved-away', []]]);
  });

  it('leads a question moved away to its current wording and the topic it stands on now, however often it moved on', () => {
    menuBar();
    const first = ask(NOTE, 'Which Space does a new note open on?');
    write('move', NOTE, ['--question', first, '--to', 'space-homing'], MADE);
    const reworded = reword(SPACE, first, 'Which Space, on which display, does a new note open on?');

    write('move', SPACE, ['--question', reworded, '--to', 'menu-bar'], MADE);

    const away = (/** @type {string} */ topic) => read('map', UNIT, topic).questions.map((/** @type {Record<string, unknown>} */ r) => [r.id, r.stands, r.moved_to]);
    assert.deepStrictEqual([away('note-window'), away('space-homing')], [[[reworded, 'moved-away', 'menu-bar']], [[reworded, 'moved-away', 'menu-bar']]]);
    assert.deepStrictEqual(answered('menu-bar'), [[reworded, 'open', []]]);
  });
});
