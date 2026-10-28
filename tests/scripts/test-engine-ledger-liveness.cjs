'use strict';

// ---------------------------------------------------------------------------
// The one liveness rule (workflow-engine/scripts/domain/ledger-units.cjs)
// through the ledger's reads (domain/ledger-read.cjs, domain/ledger-fold.cjs):
// a cancelled topic or unit, or a postponed topic while it waits, holds
// nothing current until it comes back — and a replacement, a merge or a
// confirmation made there counts for nothing meanwhile, while a question
// moved away stays where it was moved, and another unit's replacement of an
// entry there stands where it was made; and the write verbs decide by the
// same rule.
//
// Layer: verb. World: a project with its state worktree from the fixture
// library, the work unit's manifest written there; the lifecycle verbs
// cancel, postpone and bring topics and units back.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { ok, refuses, setupGitFixture, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const { UNIT, SESSION, MADE, NOTE, SPACE, PHASES, ids, ledgerReadHelpers } = require('./ledger-read-world.cjs');

/** @type {string} */
let dir;

beforeEach(() => {
  dir = setupGitFixture('ledger-read-');
  createManifest(dir, UNIT, { work_type: 'epic', phases: PHASES });
});

afterEach(() => {
  cleanupFixture(dir);
});

const { write, ask, find, decide, change, read, rawLines, line, current, shownMerge, answered, assertAgree, mint } = ledgerReadHelpers(() => dir);

describe('liveness (5.8.17)', () => {
  /**
   * A topic's entries, a question it moved to another topic, and another
   * topic's entries relying on them.
   */
  function relyingTopics() {
    const decided = decide(NOTE, ask(NOTE, 'Is a note a window?'), 'A panel.', [], { product_wide: true });
    const moving = ask(NOTE, 'Which Space does a new note open on?');
    const moved = write('move', NOTE, ['--question', moving, '--to', 'space-homing'], MADE).id;
    const relying = decide(SPACE, ask(SPACE, 'Does a note open on the active Space?'), 'Yes.', ['--relies-on', decided]);
    return { decided, moving, moved, relying };
  }

  /** Every read over the unit. */
  function reads() {
    return {
      note: read('record', UNIT, 'note-window'),
      map: read('map', UNIT, 'note-window'),
      space: read('record', UNIT, 'space-homing'),
      unit: read('record', UNIT),
      product: read('product'),
    };
  }

  /**
   * Assert the note window's entries are not current: off its record and
   * its map, off the unit's record and the product record, off the record
   * relying on them, and refused where a write needs a current entry, the
   * ledger keeping every line; while the unit is live, the question it
   * moved away stays where it moved, its move on the unit's record.
   * @param {{decided: string, moving: string, moved: string}} topics @param {RegExp} reason @param {{note: boolean, unit: boolean}} live @param {string} [from] where the write is made
   */
  function assertSetAside({ decided, moving, moved }, reason, live, from = SPACE) {
    const lines = rawLines();
    const now = reads();
    const empty = { questions: [], findings: [], decisions: [], moved: [], merged: [], other_topics: [] };
    assert.deepStrictEqual(now.note, { ok: true, unit: UNIT, topic: 'note-window', live: live.note, ...empty });
    assert.deepStrictEqual(now.map, { ok: true, unit: UNIT, topic: 'note-window', live: live.note, questions: [] });
    assert.deepStrictEqual(now.product.decisions, []);
    assert.deepStrictEqual(now.space.other_topics, []);
    assert.deepStrictEqual([now.unit.live, ids(now.unit.moved), ids(now.space.questions).includes(moving)], [live.unit, live.unit ? [moved] : [], live.unit]);
    assert.ok(!JSON.stringify(now.unit).includes(`"id":"${decided}"`), 'the unit\'s record shows an entry that is not current');
    const refusal = refuses(dir, ['ledger', 'hold', from, '--entry', decided, '--after', decided], { env: SESSION, stdin: JSON.stringify(MADE) });
    assert.match(refusal.error, reason);
    assert.deepStrictEqual(rawLines(), lines, 'the ledger did not keep its lines');
  }

  it('takes a cancelled topic\'s entries out of every read until the topic is reactivated, the ledger holding them throughout', () => {
    const topics = relyingTopics();
    const { decided } = topics;
    const before = reads();

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);
    assertSetAside(topics, new RegExp(`^ledger hold --entry names ${decided}, which is not current: its topic, note-window, is cancelled$`), { note: false, unit: true });

    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'note-window']);
    assert.deepStrictEqual(reads(), before);
  });

  it('takes a postponed topic\'s entries out of every read while it waits, and back once it is pulled back into its own epic', () => {
    const topics = relyingTopics();
    const { decided } = topics;
    const before = reads();

    ok(dir, ['topic', 'postpone', UNIT, 'note-window', '--horizon', 'later']);
    assertSetAside(topics, new RegExp(`^ledger hold --entry names ${decided}, which is not current: its topic, note-window, is postponed$`), { note: false, unit: true });

    ok(dir, ['roadmap', 'pull-forward', 'note-window', '--into', UNIT]);
    assert.deepStrictEqual(reads(), before);
  });

  it('takes a cancelled unit\'s entries out of every read, another unit\'s included, until the unit is reactivated', () => {
    mint();
    const topics = relyingTopics();
    const { decided } = topics;
    decide('mint.discussion.mint', ask('mint.discussion.mint', 'Does Mint float its notes too?'), 'Yes, as Fumi does.', ['--relies-on', decided]);
    const before = { ...reads(), mint: read('record', 'mint') };

    ok(dir, ['workunit', 'cancel', UNIT]);
    assert.deepStrictEqual(read('record', 'mint').other_topics, []);
    assert.deepStrictEqual(read('record', UNIT, 'space-homing').decisions, []);
    assertSetAside(topics, new RegExp(`^ledger hold --entry names ${decided}, which is not current: ${UNIT} is cancelled$`), { note: false, unit: false }, 'mint.discussion.mint');

    ok(dir, ['workunit', 'reactivate', UNIT]);
    assert.deepStrictEqual({ ...reads(), mint: read('record', 'mint') }, before);
  });

  it('counts a replacement only while it is live: another unit\'s, cancelled with its unit, leaves what it replaced current, until the unit is reactivated', () => {
    mint();
    const question = ask(NOTE, 'Is a note a window?');
    const decided = decide(NOTE, question, 'A panel.');
    const minted = change('mint.discussion.mint', decided, 'A sheet.');
    const before = { record: read('record', UNIT, 'note-window'), map: read('map', UNIT, 'note-window') };

    ok(dir, ['workunit', 'cancel', 'mint']);

    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions, [current(decided)]);
    assert.deepStrictEqual(answered('note-window'), [[question, 'answered', [decided]]]);
    assertAgree('note-window');

    ok(dir, ['workunit', 'reactivate', 'mint']);
    assert.deepStrictEqual({ record: read('record', UNIT, 'note-window'), map: read('map', UNIT, 'note-window') }, before);
    assert.deepStrictEqual(answered('note-window'), [[question, 'answered', [minted]]]);
  });

  it('reads a chain as though a replacement that is not live were not there: what it replaced stands again, and what replaced it stands with nothing beneath', () => {
    mint();
    const question = ask(NOTE, 'Is a note a window?');
    const decided = decide(NOTE, question, 'A panel.');
    const minted = change('mint.discussion.mint', decided, 'A sheet.');
    const reworked = change(NOTE, minted, 'A sheet that stacks.');
    const before = read('record', UNIT, 'note-window');
    assert.deepStrictEqual(before.decisions, [current(reworked, [minted, decided])]);

    ok(dir, ['workunit', 'cancel', 'mint']);

    assert.deepStrictEqual(read('record', UNIT, 'note-window').decisions, [current(decided), current(reworked)]);
    assert.deepStrictEqual(answered('note-window'), [[question, 'answered', [decided, reworked]]]);
    assertAgree('note-window');

    ok(dir, ['workunit', 'reactivate', 'mint']);
    assert.deepStrictEqual(read('record', UNIT, 'note-window'), before);
  });

  it('leads an entry to its live replacements alone: a replacement that is not live, and what replaced it, are no current form of it', () => {
    mint();
    const decided = decide(NOTE, ask(NOTE, 'Is a note a window?'), 'A panel.');
    find(SPACE, 'Homing reads the note\'s frame.', ['--relies-on', decided]);
    const minted = change('mint.discussion.mint', decided, 'A sheet.');
    const reworked = change(NOTE, minted, 'A sheet that stacks.');
    ok(dir, ['workunit', 'cancel', 'mint']);

    const replacement = change(NOTE, decided, 'A framed panel.');

    assert.deepStrictEqual(read('record', UNIT, 'space-homing').other_topics, [{ ...line(replacement), named: [decided] }]);
    ok(dir, ['workunit', 'reactivate', 'mint']);
    assert.deepStrictEqual(ids(read('record', UNIT, 'space-homing').other_topics), [reworked, replacement]);
  });

  it('shows a confirmation made where it is live alone: another unit\'s, cancelled with its unit, until the unit is reactivated', () => {
    mint();
    const decided = decide(NOTE, ask(NOTE, 'Is a note a window?'), 'A panel.');
    const relying = find(NOTE, 'A panel takes no focus.', ['--relies-on', decided]);
    const replacement = change(NOTE, decided, 'A sheet.');
    const confirmed = write('hold', 'mint.discussion.mint', ['--entry', relying, '--after', replacement], MADE).id;
    assert.deepStrictEqual(read('record', UNIT, 'note-window').findings, [current(relying, [], [confirmed])]);

    ok(dir, ['workunit', 'cancel', 'mint']);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').findings, [current(relying)]);

    ok(dir, ['workunit', 'reactivate', 'mint']);
    assert.deepStrictEqual(read('record', UNIT, 'note-window').findings, [current(relying, [], [confirmed])]);
  });

  it('stands another unit\'s replacement where it was made while the entry it replaced is set aside: its unit cancelled, then its topic, each until reactivated (5.6.1)', () => {
    mint();
    const decided = decide(NOTE, ask(NOTE, 'Is a note a window?'), 'A panel.', [], { product_wide: true });
    const minted = change('mint.discussion.mint', decided, 'A sheet.');
    /** Where the replacement shows: the topic it replaced on, each unit's record, and the product record. */
    const shown = () => ({
      note: read('record', UNIT, 'note-window').decisions,
      fumi: ids(read('record', UNIT).decisions),
      mint: read('record', 'mint').decisions,
      product: ids(read('product').decisions),
    });
    const standing = { note: [current(minted, [decided])], fumi: [minted], mint: [], product: [minted] };
    const fallenBack = { note: [], fumi: [], mint: [current(minted)], product: [minted] };
    assert.deepStrictEqual(shown(), standing);

    ok(dir, ['workunit', 'cancel', UNIT]);
    assert.deepStrictEqual(shown(), fallenBack);
    ok(dir, ['workunit', 'reactivate', UNIT]);
    assert.deepStrictEqual(shown(), standing);
    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);
    assert.deepStrictEqual(shown(), fallenBack);
    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'note-window']);
    assert.deepStrictEqual(shown(), standing);
  });

  it('stands a chain across three units where its earliest entry in a live place stands: the first unit cancelled, then the second', () => {
    mint();
    createManifest(dir, 'zeta', { work_type: 'feature', phases: { discussion: { items: { zeta: { status: 'in-progress' } } } } });
    const decided = decide(NOTE, ask(NOTE, 'Is a note a window?'), 'A panel.', [], { product_wide: true });
    const minted = change('mint.discussion.mint', decided, 'A sheet.');
    const latest = change('zeta.discussion.zeta', minted, 'A card.');
    const shown = () => ({
      fumi: read('record', UNIT).decisions, mint: read('record', 'mint').decisions, zeta: read('record', 'zeta').decisions, product: ids(read('product').decisions),
    });
    assert.deepStrictEqual(shown(), { fumi: [current(latest, [minted, decided])], mint: [], zeta: [], product: [latest] });

    ok(dir, ['workunit', 'cancel', UNIT]);
    assert.deepStrictEqual(shown(), { fumi: [], mint: [current(latest, [minted])], zeta: [], product: [latest] });

    ok(dir, ['workunit', 'cancel', 'mint']);
    assert.deepStrictEqual(shown(), { fumi: [], mint: [], zeta: [current(latest)], product: [latest] });
  });

  it('sets a merged duplicate aside only while the entry it went into has a current form: the owner\'s topic cancelled, the duplicate answers its question again, until the topic is reactivated (5.5.5)', () => {
    const owners = decide(NOTE, ask(NOTE, 'Does a note float above every Space?'), 'Notes float above every Space.');
    const reached = ask(SPACE, 'Does a note stay on its Space?');
    const duplicate = decide(SPACE, reached, 'Notes float above every Space.');
    const merged = write('merge', SPACE, ['--question', reached, '--into', owners, '--duplicate', duplicate], MADE).id;
    const before = { record: read('record', UNIT, 'space-homing'), map: read('map', UNIT, 'space-homing') };
    assert.deepStrictEqual(answered('space-homing'), [[reached, 'merged', [owners]]]);

    ok(dir, ['topic', 'cancel', UNIT, 'discovery', 'note-window']);

    assert.deepStrictEqual(answered('space-homing'), [[reached, 'answered', [duplicate]]]);
    const record = read('record', UNIT, 'space-homing');
    assert.deepStrictEqual([record.decisions, record.merged, record.other_topics], [[current(duplicate)], [shownMerge(merged, duplicate, false)], []]);
    assertAgree('space-homing');

    ok(dir, ['topic', 'reactivate', UNIT, 'discovery', 'note-window']);
    assert.deepStrictEqual({ record: read('record', UNIT, 'space-homing'), map: read('map', UNIT, 'space-homing') }, before);
  });
});
