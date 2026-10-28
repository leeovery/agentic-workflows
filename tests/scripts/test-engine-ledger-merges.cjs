'use strict';

// ---------------------------------------------------------------------------
// Merges crossing each other (workflow-engine/scripts/domain/ledger-fold.cjs,
// read through domain/ledger-read.cjs): the later holds and the earlier not,
// whichever entry or merge is read first, a merge leading on through an
// earlier one taken once the earlier is, and a merge that set aside another
// unit's replacement weighed as that unit comes and goes.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library, the work unit's manifest written there.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { ok, refuses, statePath, cleanupFixture } = require('./engine-harness.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/workflow-engine/scripts');
const {
  ID_FACTS, foldLedger, isCurrent, currentsOf, mergeHolds,
} = require(path.join(SCRIPTS, 'domain/ledger-fold.cjs'));
const { liveness } = require(path.join(SCRIPTS, 'domain/ledger-units.cjs'));

const { UNIT, SESSION, MADE, NOTE, SPACE, MENU, ledgerReadHelpers, ledgerWorld } = require('./ledger-world.cjs');

/** @type {string} */
let dir;

beforeEach(() => {
  dir = ledgerWorld('ledger-read-');
});

afterEach(() => {
  cleanupFixture(dir);
});

const {
  write, ask, decide, change, read, full, line, current, shownMerge, answered, assertAgree, menuBar, mint,
} = ledgerReadHelpers(() => dir);

describe('merges crossing each other (5.5.5)', () => {
  /**
   * Two questions on two topics, each answered there, the first moved to the
   * menu bar and merged into the second's answer, its own answer the
   * duplicate; the menu bar cancelled, so the second is merged the other way
   * while the first merge is set aside; the menu bar reactivated.
   */
  function crossed() {
    menuBar();
    const first = ask(NOTE, 'Does a note float above every Space?');
    const floats = decide(NOTE, first, 'Notes float above every Space.');
    const second = ask(SPACE, 'Does a note stay on its Space?');
    const stays = decide(SPACE, second, 'Notes float, and never stay.');
    write('move', NOTE, ['--question', first, '--to', 'menu-bar'], MADE);
    const earlier = write('merge', MENU, ['--question', first, '--into', stays, '--duplicate', floats], MADE).id;
    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'menu-bar']);
    const later = write('merge', SPACE, ['--question', second, '--into', floats, '--duplicate', stays], MADE).id;
    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'menu-bar']);
    return { first, floats, second, stays, earlier, later };
  }

  it('lets the later merge hold and the earlier not, so the decision the later went into stays current, through a reactivate of the earlier', () => {
    const { first, floats, second, stays, earlier, later } = crossed();

    assert.deepStrictEqual([answered('menu-bar'), answered('space-homing')], [[[first, 'answered', [floats]]], [[second, 'merged', [floats]]]]);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions, [current(floats)]);
    const space = read('record', UNIT, 'space-homing');
    assert.deepStrictEqual([space.decisions, space.merged, space.other_topics], [[], [shownMerge(later, stays, true)], [{ ...line(floats), named: [second, floats] }]]);
    const menu = read('record', UNIT, 'menu-bar');
    assert.deepStrictEqual([menu.merged, menu.other_topics], [[shownMerge(earlier, floats, false)], [{ ...line(floats), named: [first] }]],
      'the record tied the entry a merge that does not hold went into');
    for (const topic of ['note-window', 'space-homing', 'menu-bar']) assertAgree(topic);
    const refusal = refuses(dir, ['ledger', 'replace', SPACE, '--replaces', stays, '--reason', 'changed-mind'], { env: SESSION, stdin: JSON.stringify({ ...MADE, drops: [], text: 'Again.', why: 'Again.' }) });
    assert.match(refusal.error, new RegExp(`^ledger replace --replaces names ${stays}, which ${later} merged as a duplicate — the current one is ${floats}$`));
    change(NOTE, floats, 'Notes float above every Space and display.');
  });

  it('works out which merge holds the same whichever entry or merge is read first', () => {
    const { floats, stays, earlier, later } = crossed();
    const facts = foldLedger(statePath(dir), ID_FACTS, []);
    const asked = [floats, stays, earlier, later].map(full);
    /** Each asked id's answers from a fresh read, the ids asked in `order`. @param {string[]} order */
    const readIn = (order) => {
      const folded = { facts, live: liveness(statePath(dir)) };
      const answers = new Map(order.map((id) => [id, [isCurrent(folded, id), currentsOf(folded, id), mergeHolds(folded, id)]]));
      return asked.map((id) => answers.get(id));
    };

    const forwards = readIn(asked);
    assert.deepStrictEqual(readIn([...asked].reverse()), forwards);
    assert.deepStrictEqual(readIn([asked[3], asked[1], asked[0], asked[2]]), forwards);
    assert.deepStrictEqual(forwards.map(([current_, currents, holds]) => [current_, currents, holds]), [
      [true, [full(floats)], false], [false, [full(floats)], false], [false, [], false], [false, [], true],
    ]);
  });

  it('takes a later merge whose entry leads on only through an earlier merge once the earlier is taken', () => {
    menuBar();
    const settled = ask(NOTE, 'Does a note float above every Space?');
    const floats = decide(NOTE, settled, 'Notes float above every Space.');
    write('move', NOTE, ['--question', settled, '--to', 'menu-bar'], MADE);
    const owners = decide(SPACE, ask(SPACE, 'Does a note follow the person?'), 'A note follows the person, floating.');
    const reached = ask(MENU, 'Does a note stay on its Space?');
    const stays = decide(MENU, reached, 'Notes float, and never stay.');
    write('merge', MENU, ['--question', settled, '--into', owners, '--duplicate', floats], MADE);
    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'space-homing']);
    write('merge', MENU, ['--question', reached, '--into', floats, '--duplicate', stays], MADE);
    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'space-homing']);

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);

    assert.deepStrictEqual(answered('menu-bar'), [[settled, 'merged', [owners]], [reached, 'merged', [owners]]]);
    assert.deepStrictEqual(read('record', UNIT, 'menu-bar').decisions, []);
    assertAgree('menu-bar');
  });

  it('lets the later merge hold where the earlier set aside another unit\'s replacement, that unit cancelled while the later was made and reactivated since', () => {
    mint();
    const first = ask(NOTE, 'Does a note float above every Space?');
    const floats = decide(NOTE, first, 'Notes float.');
    const minted = change('mint.discussion.mint', floats, 'Notes float above every Space.');
    const second = ask(SPACE, 'Does a note stay on its Space?');
    const stays = decide(SPACE, second, 'Notes float, and never stay.');
    const earlier = write('merge', NOTE, ['--question', first, '--into', stays, '--duplicate', minted], MADE).id;
    ok(dir, ['workunit', 'cancel', 'mint']);
    write('merge', SPACE, ['--question', second, '--into', floats, '--duplicate', stays], MADE);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').merged, [shownMerge(earlier, null, true)], 'a merge showed a duplicate that is not live');

    ok(dir, ['workunit', 'reactivate', 'mint']);

    assert.deepStrictEqual([answered('note-window'), answered('space-homing')], [[[first, 'answered', [minted]]], [[second, 'merged', [minted]]]]);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions, [current(minted, [floats])]);
    assertAgree('note-window');
    assertAgree('space-homing');
  });
});
