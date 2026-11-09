'use strict';

// ---------------------------------------------------------------------------
// `engine board` in a quick-fix (leeway-engine/scripts/domain/projections/
// board-quick-fix.cjs, 20.14), what waits on the person and the close: a
// question Claude raised in the quick-fix's conversation, until answered;
// the close once its screen draws, with whether a verdict is owed; the
// session followed to All work once it closes; and the mod's fixture held
// to the engine's shape. The fixes: test-engine-board-quick-fix.cjs.
//
// Layer: verb. The worlds `working` and `closable`
// (quick-fix-board-world.cjs), each copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const { output, okSectionsAsync, cleanupFixture } = require('./engine-harness.cjs');
const { ledgerReadHelpers } = require('./ledger-world.cjs');
const { UNIT, PLACE, FLAG } = require('./quick-fix-world.cjs');
const { fixture, misfits, emptyLists, place } = require('./board-world.cjs');
const { CALL, working, closable, fix, quickFixBoard } = require('./quick-fix-board-world.cjs');

const NONE_CHANGED = 'Close: what was proven; you changed none of Claude\'s calls, so there is no verdict to give';

let dir = ''; // the project
const { env, run, board, atTheFixes, reported, parkedOn, replaced } = quickFixBoard(() => dir);

afterEach(() => {
  cleanupFixture(dir);
});

describe('what waits on the person in a quick-fix, and its close (20.14)', () => {
  it('a question Claude raised in the quick-fix\'s conversation waits asked there, parking nothing — counted on the banner, which keeps running — until it is answered (19.5.25)', async () => {
    dir = working();
    atTheFixes();
    const asked = ledgerReadHelpers(() => dir).ask(PLACE, CALL.question);
    await okSectionsAsync(dir, ['raise', PLACE, '--answers', asked], { env: env(), stdin: JSON.stringify(CALL) });
    const { view, banner, questions } = board();
    ledgerReadHelpers(() => dir).decide(PLACE, asked, 'Keep --color as an alias');
    const answered = board();

    assert.deepStrictEqual([view.waiting.map(({ kind, text, page }) => ({ kind, text, page })), questions, view.stopped], [[{ kind: 'raised', text: CALL.question, page: null }], [], false]);
    assert.deepStrictEqual(banner, { name: 'Typo', state: 'running', facts: [place('quick-fix'), { text: '0 of 2 done', needs: false }, { text: '1 waiting on you', needs: true }] });
    assert.deepStrictEqual([answered.view.waiting, answered.banner.facts], [[], [place('quick-fix'), { text: '0 of 2 done', needs: false }]]);
  });

  it('while its close waits: what was proven and that no verdict is owed, flagged on the banner; each fix done with the round its pair passed it in; its record from summary.md (20.14.1, 16.10.4, 19.5.17)', () => {
    dir = closable();
    atTheFixes();
    reported('1.1', 1, false);
    reported('1.1', 2, true);
    const { view, banner } = board();
    const line = board(['--tab', 'all']).view.units.find((/** @type {{unit: string}} */ held) => held.unit === UNIT);

    assert.deepStrictEqual([view.standing, view.stopped, view.progress, view.waiting], ['close', false, { done: 1, total: 1, written: true }, [{ kind: 'finish', id: 'close', text: NONE_CHANGED, page: null }]]);
    assert.deepStrictEqual(view.fixes, [fix('1.1', FLAG, 'done', { rounds: { sent_back: 1, passed: 2 } })]);
    assert.deepStrictEqual(view.record, [{ title: FLAG, changed: 'The flag parser reads --colour.', why: 'The flag was spelt the American way.', leaves: 'Old scripts passing --color.' }]);
    assert.deepStrictEqual(banner, { name: 'Typo', state: 'needs', facts: [place('quick-fix'), { text: '1 of 1 done', needs: false }, { text: '1 waiting on you', needs: true }] });
    assert.strictEqual(line.standing, 'close waits on you');
  });

  it('16.10.4: the close says a verdict is owed on a call the person changed in it, and once given, that each is', () => {
    dir = closable();
    atTheFixes();
    const { ask, decide } = ledgerReadHelpers(() => dir);
    replaced(decide(PLACE, ask(PLACE, 'Does --color still work?'), 'It stays as an alias.'), 'person', 'It is dropped.');
    const owed = board().view.waiting;
    output(dir, ['render', 'finish', UNIT], { env: env() });
    run(run(['gate', 'verdict', '--pick', 'n']).next.argv);

    assert.deepStrictEqual([owed, board().view.waiting.map(({ text }) => text)], [
      [{ kind: 'finish', id: 'close', text: 'Close: what was proven; you changed 1 call of Claude\'s, so there is a verdict to give', page: null }],
      ['Close: what was proven; you changed 1 call of Claude\'s and gave each its verdict'],
    ]);
  });

  it('20.14.2: once closed, This session follows the session to All work at the start menu, the banner its close', () => {
    dir = closable();
    atTheFixes();
    run(['finish', 'yes', UNIT]);
    const { view, banner } = board();

    assert.deepStrictEqual([view.kind, view.complete.map(({ unit }) => unit)], ['all', [UNIT]]);
    assert.deepStrictEqual(banner, { name: 'Typo', state: 'done', facts: [{ text: 'quick-fix', needs: false }, { text: 'complete', needs: false }, place('at the start menu')] });
  });

  it('the mod\'s quick-fix fixture holds the shape the engine answers, its parked and its closing states between them holding every list', async () => {
    dir = working();
    atTheFixes();
    run(['task', 'start', UNIT, '1.2']);
    await parkedOn('1.2', 'Should the help name both spellings?');
    const parked = board().view;
    cleanupFixture(dir);
    dir = closable();
    atTheFixes();
    const closing = board().view;
    const held = await fixture('board-quick-fix.mjs');

    assert.deepStrictEqual([misfits(held, parked), misfits(held, closing)], [[], []]);
    assert.deepStrictEqual(emptyLists([parked, closing]), [], 'every list the shape is held to holds an entry');
  });
});
