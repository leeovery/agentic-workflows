'use strict';

// ---------------------------------------------------------------------------
// What the menus read of an epic and a feature before the build: what waits
// on the person there (leeway-engine/scripts/domain/waits.cjs; 18.2.3,
// 18.4.2) — approve the map staged, an epic's topic's decided once its
// screen draws, the decided topics an answer replaced since holds (10.2.6),
// and, asked for, the verdicts waiting on the unit's departures — each with
// its door, a topic's by `handoff topic`; and how far the unit has come, as
// a menu's row says it (domain/progress.cjs; 7.4.1). The spec's: test-
// engine-waits-spec.cjs; a bug's: test-engine-waits-bug.cjs; the build's,
// and the read's cost: test-engine-waits-build.cjs; a quick-fix's:
// test-engine-waits-quick-fix.cjs.
//
// Layer: verb, the reads called in process. World: the decided suites'
// (decided-world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

const { ok, output, readManifest, writeState, statePath } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { UNIT: FUMI, SESSION, MADE, NOTE, SPACE } = require('./ledger-world.cjs');
const { SOLO, SOLO_AT, NO_PAYLOAD, NOTE_MAP, writeIn, answeredIn, markAllButTheClosingPass, useDecidedWorld, decidedHelpers, decidedBoardHelpers } = require('./decided-world.cjs');
const { waitsIn, progress, door, topicDoor, wait } = require('./waits-world.cjs');

describe('an epic\'s gates, the topics a changed answer holds, and the verdicts waiting (18.2.3, 10.2.6)', () => {
  const dir = useDecidedWorld();
  const { close, payload, staged, reverse } = decidedHelpers(dir);
  const { made } = decidedBoardHelpers(dir);
  const intoNote = topicDoor(FUMI, 'note-window');
  const DECIDED = wait('decided', 'note-window', 'Decided: Note Window', intoNote, 'note-window');

  /** A decision on the note window relying on space homing's answer, that answer replaced since. */
  function reliedOnReplaced() {
    const homing = answeredIn(dir(), SPACE, 'Does a space remember its notes?', { ...MADE, text: 'It does.' });
    const asked = writeIn(dir(), 'ask', NOTE, [], { ...MADE, text: 'Where does a note open?' });
    writeIn(dir(), 'decide', NOTE, ['--answers', asked, '--relies-on', homing.answer], { ...MADE, text: 'In the space that made it.', why: 'Spaces remember.' });
    writeIn(dir(), 'replace', SPACE, ['--replaces', homing.answer, '--reason', 'changed-mind'], { by: 'person', drops: ['the old answer'], text: 'It does not.', why: 'The person wants it so.' });
  }

  it('approve the map waits while a map is staged for the epic, its door the epic\'s own discovery', () => {
    const before = waitsIn(dir(), [FUMI]);
    output(dir(), ['render', 'approve-map', FUMI, '--file', payload({ topics: [{ name: 'note-window' }, { name: 'space-homing' }], parks: [] })], { env: SESSION });

    assert.deepStrictEqual([before, waitsIn(dir(), [FUMI])], [
      { [FUMI]: [] },
      { [FUMI]: [wait('map', 'approve-the-map', 'Approve the map', { kind: 'handoff', skill: 'leeway-discovery', args: ['none', FUMI] })] },
    ]);
  });

  it('a topic\'s decided waits once its screen draws, its door the topic by `handoff topic` — not closed with nothing staged, nor while a message waits in its mailbox, its close\'s own check failing, nor once the topic is postponed', () => {
    close();
    const unstaged = waitsIn(dir(), [FUMI]);
    staged(NO_PAYLOAD);
    const waiting = waitsIn(dir(), [FUMI]);
    const message = `${FUMI}/topics/note-window/mail/001-from-space-homing.md`;
    writeState(dir(), message, 'Space homing decided notes open where they were made.\n');
    const mailed = waitsIn(dir(), [FUMI]);
    fs.rmSync(statePath(dir(), message));
    ok(dir(), ['topic', 'postpone', FUMI, 'note-window', '--horizon', 'later'], { env: SESSION });

    assert.deepStrictEqual([unstaged, waiting, mailed, waitsIn(dir(), [FUMI])], [{ [FUMI]: [] }, { [FUMI]: [DECIDED] }, { [FUMI]: [] }, { [FUMI]: [] }]);
  });

  it('a payload staged against a close that no longer stands waits for nothing: the discussion gone on since, the topic closed anew, or a question opened on it since that the ledger alone holds, its manifest never told', () => {
    close();
    staged(NO_PAYLOAD);
    answeredIn(dir(), NOTE, 'Does a note keep its size?', { ...MADE, text: 'It does.' });
    const voided = waitsIn(dir(), [FUMI]);
    markAllButTheClosingPass(dir(), FUMI, 'note-window');
    close();
    const closedAnew = waitsIn(dir(), [FUMI]);
    staged(NO_PAYLOAD);
    const restaged = waitsIn(dir(), [FUMI]);
    answeredIn(dir(), NOTE, 'Does a note keep its colour?', { ...MADE, text: 'It does.' });
    const manifest = readManifest(dir(), FUMI);
    delete manifest.checklists.decided['note-window'].voided;
    createManifest(dir(), FUMI, manifest);

    assert.deepStrictEqual([voided, closedAnew, restaged, waitsIn(dir(), [FUMI])], [{ [FUMI]: [] }, { [FUMI]: [] }, { [FUMI]: [DECIDED] }, { [FUMI]: [] }]);
  });

  it('10.2.6, 18.4.2: a decided topic holding an entry that relies on an answer replaced since waits, "{Topic}: a decision it relies on changed", its door the topic while the epic is in its discussion; a topic still under discussion holds its own', () => {
    reliedOnReplaced();
    const discussing = waitsIn(dir(), [FUMI]);
    const manifest = readManifest(dir(), FUMI);
    manifest.phases.discussion.items['note-window'].status = 'completed';
    createManifest(dir(), FUMI, manifest);

    assert.deepStrictEqual([discussing, waitsIn(dir(), [FUMI])], [
      { [FUMI]: [] },
      { [FUMI]: [wait('affected', 'note-window', 'Note Window: a decision it relies on changed', intoNote, 'note-window')] },
    ]);
  });

  it('12.15.4: a feature in its build, a decision its topic\'s entry relies on replaced there — the wait\'s door is the build, whose entry reads what the change affected', () => {
    const split = answeredIn(dir(), SOLO_AT, 'Is a refund ever split?', { ...MADE, by: 'person', text: 'Never split.' });
    const asked = writeIn(dir(), 'ask', SOLO_AT, [], { ...MADE, text: 'Does a receipt list refunds?' });
    writeIn(dir(), 'decide', SOLO_AT, ['--answers', asked, '--relies-on', split.answer], { ...MADE, text: 'One line per refund.', why: 'Refunds are never split.' });
    const manifest = readManifest(dir(), SOLO);
    createManifest(dir(), SOLO, {
      ...manifest,
      phases: { ...manifest.phases, discussion: { items: { [SOLO]: { status: 'completed' } } } },
      build: { position: 'auto' },
      cut: { phases: [{ name: 'All', goal: 'Pay.', scenarios: [], sections: ['1'], relies_on: [] }] },
    });
    const before = waitsIn(dir(), [SOLO]);
    writeIn(dir(), 'replace', `${SOLO}.implementation`, ['--replaces', split.answer, '--reason', 'changed-mind'], { by: 'person', who_moved_whom: 'none', drops: ['never split'], text: 'Split when asked.', why: 'The person wants it so.' });

    assert.deepStrictEqual([before, waitsIn(dir(), [SOLO])], [
      { [SOLO]: [] },
      { [SOLO]: [wait('affected', SOLO, 'Solo: a decision it relies on changed', door('leeway-implementation-process', 'feature', SOLO), SOLO)] },
    ]);
  });

  it('asked for, each verdict waiting on a departure standing in the unit, by its entry and words, its door the verdict page — never unasked, and never another unit\'s', () => {
    const sync = reverse(NOTE_MAP.sync.answer, 'Off until you turn it on.');
    const tally = answeredIn(dir(), SOLO_AT, 'Does a tally show a total?', { ...MADE, text: 'It does.' });
    const total = writeIn(dir(), 'replace', SOLO_AT, ['--replaces', tally.answer, '--reason', 'changed-mind'], { by: 'person', drops: ['the total'], text: 'No total.', why: 'The person wants it so.' });
    const VERDICTS = { kind: 'engine', argv: ['render', 'verdicts'] };

    assert.deepStrictEqual([waitsIn(dir(), [FUMI, SOLO]), waitsIn(dir(), [FUMI, SOLO], { verdicts: true })], [
      { [FUMI]: [], [SOLO]: [] },
      { [FUMI]: [wait('verdict', sync, 'Off until you turn it on.', VERDICTS)], [SOLO]: [wait('verdict', total, 'No total.', VERDICTS)] },
    ]);
  });

  it('7.4.1: an epic in discovery says its topics on the map, in discussion its topics decided of all; a feature\'s discussion has no measure', () => {
    made('atlas', 'epic');

    assert.deepStrictEqual([progress(dir(), 'atlas'), progress(dir(), FUMI), progress(dir(), SOLO)], ['discovery, 0 topics on the map', 'discussion, 0 of 2 topics decided', 'discussion']);
  });
});
