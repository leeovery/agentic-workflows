'use strict';

// ---------------------------------------------------------------------------
// What waits on the person on the epic's menu
// (leeway-engine/scripts/domain/projections/epic-menu.cjs; 18.4.2, 18.4.17,
// 18.4.18): what the waits read lists (domain/waits.cjs) drawn first, each
// a numbered row with its door, the first recommended; a topic a wait is
// about drawn as that wait alone, off DECIDED; the verdicts waiting as one
// row, e/verdicts, after the numbered waits and before the topics, the
// verdict page its door; a wait about a topic another conversation holds
// struck and never recommended; the spec's and the build's rows never
// recommended while a wait stands; every topic decided, the spec not
// entered, the epic in its specification, an affected topic's door the
// spec; a topic with experiments waiting leading into the laboratory,
// struck by a hold there alone; and the review's row standing aside for
// finish. The screen itself: test-engine-epic-menu.cjs.
//
// Layer: verb — the render through the engine in process, and the screen
// composed in process over the waits given. World: the decided suites'
// (decided-world.cjs), built once and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { ok, output, screenOf, sectionOf, readManifest } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { UNIT: FUMI, SESSION, MADE, NOTE, SPACE } = require('./ledger-world.cjs');
const { NOTE_MAP, writeIn, answeredIn, useDecidedWorld, decidedHelpers, decidedBoardHelpers } = require('./decided-world.cjs');
const { topicDoor, door, wait } = require('./waits-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { epicMenuScreen } = require(path.join(SCRIPTS, 'domain/projections/epic-menu.cjs'));
const { drawLabel } = require(path.join(SCRIPTS, 'domain/projections/surfaces.cjs'));

/** @typedef {import('../../skills/leeway-engine/scripts/domain/waits.cjs').Wait} Wait */

const VERDICTS = Object.freeze({ kind: 'engine', argv: ['render', 'verdicts'] });
const PEER = Object.freeze({ CLAUDE_CODE_SESSION_ID: 'peer-session', CLAUDE_PID: String(process.ppid) });

/** A verdict waiting, by its id. @param {string} id */
const verdict = (id) => wait('verdict', id, 'Off until you turn it on.', VERDICTS);

describe('what waits, drawn first (18.4.2)', () => {
  const dir = useDecidedWorld();
  const { close, payload, staged, reverse, answer } = decidedHelpers(dir);
  const { spawned } = decidedBoardHelpers(dir);

  /** The epic's menu as the world's conversation draws it. */
  const menu = () => output(dir(), ['render', 'epic-menu', FUMI], { env: SESSION });

  /** The menu's rows as the screen reads them, from the rule down. @param {string} out */
  const rowsOf = (out) => screenOf(out, 'MENU: epic menu').slice(3);

  /** The menu's rows composed over `waits`, each its key, its label as drawn and its next. @param {Wait[]} waits */
  const composed = (waits) => epicMenuScreen(dir(), readManifest(dir(), FUMI), waits).rows.map((row) => [String(row.key), drawLabel(row.label), row.next]);

  /** A session in another conversation sitting in one of the epic's topics. @param {string} phase @param {string} topic */
  const peerIn = (phase, topic) => ok(dir(), ['presence', 'beat', FUMI, phase, topic], { env: PEER });

  /** Every topic decided, the spec's row offered. */
  function settled() {
    const manifest = readManifest(dir(), FUMI);
    for (const item of Object.values(manifest.phases.discussion.items)) item.status = 'completed';
    createManifest(dir(), FUMI, manifest);
  }

  /** The epic in its build, at the first phase of its cut. */
  function building() {
    settled();
    createManifest(dir(), FUMI, { ...readManifest(dir(), FUMI), build: { position: 'auto' }, cut: { phases: [{ name: 'Notes', scenarios: [], sections: ['1'], relies_on: [] }] } });
  }

  it('18.S9: approve the map staged and a verdict waiting — the gate first and recommended, its door the epic\'s discovery; the verdict on e/verdicts straight after it, before the topics, its door the verdict page', () => {
    output(dir(), ['render', 'approve-map', FUMI, '--file', payload({ topics: [{ name: 'note-window' }, { name: 'space-homing' }], parks: [] })], { env: SESSION });
    reverse(NOTE_MAP.sync.answer, 'Off until you turn it on.');
    const rows = rowsOf(menu());
    const gate = answer('epic menu', '1');
    menu();

    assert.deepStrictEqual([rows, gate, answer('epic menu', 'e')], [[
      '1           → Approve the map — the map waits on your yes',
      '              (recommended)',
      'e/verdicts  → Give the verdict waiting on a call you changed',
      '2           → Continue "Note Window" — in progress',
      '3           → Continue "Space Homing" — in progress',
      'd/discovery → Change the map — a new topic, cancel, postpone,',
      '              pull forward, reactivate, or reopen a decided topic',
      'h/help      → What this menu is for, row by row',
      'b/back      → Back to the start menu',
    ], { kind: 'handoff', skill: 'leeway-discovery', args: ['none', FUMI] }, VERDICTS]);
  });

  it('a topic whose decided waits is drawn as that wait alone, its door the topic', () => {
    close();
    staged({ lines: [], candidates: [] });
    const rows = rowsOf(menu());

    assert.deepStrictEqual([rows.slice(0, 3), answer('epic menu', '1')], [[
      '1           → Close "Note Window" as decided — what it decided',
      '              waits on your yes (recommended)',
      '2           → Continue "Space Homing" — in progress',
    ], topicDoor(FUMI, 'note-window')]);
  });

  it('18.4.21: a wait about a topic another conversation holds is struck and never recommended — the first topic free is', () => {
    close();
    staged({ lines: [], candidates: [] });
    peerIn('discussion', 'note-window');

    assert.deepStrictEqual(rowsOf(menu()).slice(0, 3), [
      '1           → Continue "Space Homing" — in progress (recommended)',
      '2           → ~~Close "Note Window" as decided — what it decided~~',
      '              ~~waits on your yes~~ · in session (last active 0s ago)',
    ]);
  });

  /** Note Window's decision relying on Space Homing's answer, replaced since: Note Window affected. */
  function affected() {
    const homing = answeredIn(dir(), SPACE, 'Does a space remember its notes?', { ...MADE, text: 'It does.' });
    const asked = writeIn(dir(), 'ask', NOTE, [], { ...MADE, text: 'Where does a note open?' });
    writeIn(dir(), 'decide', NOTE, ['--answers', asked, '--relies-on', homing.answer], { ...MADE, text: 'In the space that made it.', why: 'Spaces remember.' });
    writeIn(dir(), 'replace', SPACE, ['--replaces', homing.answer, '--reason', 'changed-mind'], { by: 'person', drops: ['the old answer'], text: 'It does not.', why: 'The person wants it so.' });
  }

  it('18.S78, 10.2.6: a decided topic an entry of which relies on an answer replaced since waits first, recommended, its door the topic — off DECIDED, still counted decided', () => {
    affected();
    const manifest = readManifest(dir(), FUMI);
    manifest.phases.discussion.items['note-window'].status = 'completed';
    createManifest(dir(), FUMI, manifest);
    const out = menu();

    assert.deepStrictEqual([screenOf(out, 'DISPLAY: epic-menu'), rowsOf(out).slice(0, 4), answer('epic menu', '1')], [['2 topics · 1 decided · 1 in progress'], [
      '1           → "Note Window": a decision it relies on changed —',
      '              confirm it still holds, or replace it (recommended)',
      'e/verdicts  → Give the verdict waiting on a call you changed',
      '2           → Continue "Space Homing" — in progress',
    ], topicDoor(FUMI, 'note-window')]);
  });

  it('20.15.2, 10.2.6: every topic decided and the spec not entered, the epic is in its specification — s/spec offered, an affected topic\'s door the spec', () => {
    affected();
    settled();
    const out = menu();
    const rows = rowsOf(out);

    assert.deepStrictEqual([sectionOf(out, 'TITLE'), rows.filter((row) => /^(1|s\/spec) /.test(row)), answer('epic menu', '1')], [
      '# **`■ Specification — Fumi`**\n',
      ['1           → "Note Window": a decision it relies on changed —', 's/spec      → Start the specification — every topic is decided'],
      door('leeway-specification-process', 'epic', FUMI),
    ]);
  });

  it('a topic with an experiment waiting leads into the laboratory, in its place in the map\'s order', () => {
    spawned();

    assert.deepStrictEqual(composed([]).slice(0, 2), [
      ['1', 'Continue "Note Window" in the laboratory — *1 experiment waiting* (recommended)', { kind: 'handoff', skill: 'leeway-experiment-process', args: ['epic', FUMI, 'note-window'] }],
      ['2', 'Continue "Space Homing" — *in progress*', topicDoor(FUMI, 'space-homing')],
    ]);
  });

  it('the laboratory\'s row is struck by a hold in the laboratory, never by one in the topic\'s discussion', () => {
    spawned();
    peerIn('discussion', 'note-window');
    const [discussing] = composed([]);
    peerIn('experiment', 'note-window');

    assert.deepStrictEqual([discussing[1], composed([])[1][1]], [
      'Continue "Note Window" in the laboratory — *1 experiment waiting* (recommended)',
      '~~Continue "Note Window" in the laboratory — *1 experiment waiting*~~ · in session (last active 0s ago)',
    ]);
  });

  it('18.4.21: the spec\'s row never takes the recommendation from a wait still standing, and recommended it is drawn first', () => {
    settled();
    const ready = wait('ready', 'ready-to-build', 'Ready to build', door('leeway-specification-process', 'epic', FUMI));

    assert.deepStrictEqual([composed([ready]).map(([key, label]) => [key, label]), composed([verdict('0a1b')]).map(([key]) => key)], [[
      ['1', 'Ready to build — *the spec waits on your yes* (recommended)'],
      ['s', 'Start the specification — *every topic is decided*'],
      ['d', 'Change the map — a new topic, cancel, postpone, pull forward, reactivate, or reopen a decided topic'],
    ], ['s', 'e', 'd']]);
  });

  it('18.4.21: in the build its row never takes the recommendation from a question waiting, and leads the verdicts once nothing else waits', () => {
    building();
    const question = wait('question', 'Q1', 'Is the receipt mailed or printed?', door('leeway-implementation-process', 'epic', FUMI));

    assert.deepStrictEqual([composed([question]).map(([key, label]) => [key, label]), composed([verdict('0a1b')]).map(([key, label]) => [key, label])], [[
      ['1', 'Is the receipt mailed or printed? — *a question waiting for you* (recommended)'],
      ['2', 'Continue the build — *phase 1 of 1, not yet written*'],
    ], [
      ['1', 'Continue the build — *phase 1 of 1, not yet written* (recommended)'],
      ['e', 'Give the verdict waiting on a call you changed'],
    ]]);
  });

  it('a question waiting and ready to build each read as their own row; several verdicts are counted on the one row', () => {
    const question = wait('question', 'Q1', 'Is the receipt mailed or printed?', door('leeway-implementation-process', 'epic', FUMI));
    const ready = wait('ready', 'ready-to-build', 'Ready to build', door('leeway-specification-process', 'epic', FUMI));
    assert.deepStrictEqual(composed([question, ready, verdict('0a1b'), verdict('0c2d')]).filter(([key]) => ['1', '2', 'e'].includes(key)), [
      ['1', 'Is the receipt mailed or printed? — *a question waiting for you* (recommended)', question.next],
      ['2', 'Ready to build — *the spec waits on your yes*', ready.next],
      ['e', 'Give the 2 verdicts waiting on calls you changed', VERDICTS],
    ]);
  });

  it('in the review, finish waiting stands in for the review\'s row', () => {
    building();
    const manifest = readManifest(dir(), FUMI);
    createManifest(dir(), FUMI, { ...manifest, checklists: { ...manifest.checklists, 'phase-1-close': { items: {}, closed: '2026-11-01T00:00:00.000Z' } } });
    const finish = wait('finish', 'finish', 'Finish', door('leeway-review-process', 'epic', FUMI));

    assert.deepStrictEqual([composed([]), composed([finish])], [
      [['1', 'Continue the review (recommended)', door('leeway-review-process', 'epic', FUMI)]],
      [['1', 'Finish — *the review passed, and finish waits on your yes* (recommended)', finish.next]],
    ]);
  });
});
