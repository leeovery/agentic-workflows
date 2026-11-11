'use strict';

// ---------------------------------------------------------------------------
// The door to a decided topic an answer it relied on, replaced since, holds
// (10.2.6, 18.4.2, 18.S52; leeway-engine/scripts/domain/topic-standing.cjs,
// domain/enter.cjs): `handoff topic` and `enter discussion` admit that
// decided topic alone, every other refused word for word as before; the
// entry reads its affected entries and says it stays decided; it waits on
// the epic's menu, first, and in the start menu's count, picking the epic
// opening its menu with it first (18.S3, 18.2.4), until each such entry is
// confirmed or replaced, when it is listed decided again with no key and
// its door shuts; the conversation hands back to the epic's menu. A message
// to it reopens it instead (10.2.7): in progress, mail waiting, never that
// wait. The menu's row itself: test-engine-epic-menu-waits.cjs.
//
// Layer: verb. World: the decided suites' (decided-world.cjs) — an epic,
// `fumi`, its note window and space homing under discussion — built once
// and copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { ok, output, refuses, screenOf, readManifest } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { UNIT: FUMI, SESSION, MADE, NOTE, SPACE } = require('./ledger-world.cjs');
const { writeIn, answeredIn, useDecidedWorld, decidedBoardHelpers } = require('./decided-world.cjs');

const TOPIC = 'note-window';
const DECIDED = `the topic "${TOPIC}" is decided — it reopens through a message sent to it, or through the epic menu's discovery row`;
const STAYS = 'stays decided: entered for its affected entries alone';
const AFFECTED_ROW = /"Note Window": a decision it relies on changed/;

describe('a decided topic a replaced answer holds (10.2.6, 18.S52)', () => {
  const dir = useDecidedWorld();
  const { sent } = decidedBoardHelpers(dir);

  /** An engine call as the world's conversation runs it. @param {string[]} args */
  const run = (args) => output(dir(), args, { env: SESSION });

  /** The epic's menu: its shown lines and its rows, from the rule down. */
  function menu() {
    const out = run(['render', 'epic-menu', FUMI]);
    return { shown: screenOf(out, 'DISPLAY: epic-menu'), rows: screenOf(out, 'MENU: epic menu').slice(3) };
  }

  /** The DATA lines of the entry that say what it is entered for. @param {string} out */
  const enteredFor = (out) => out.split('\n').filter((line) => /^(affected|stays decided): /.test(line));

  /** `topic`'s discussion item set decided. @param {string} topic */
  function decide(topic) {
    const manifest = readManifest(dir(), FUMI);
    manifest.phases.discussion.items[topic].status = 'completed';
    createManifest(dir(), FUMI, manifest);
  }

  /**
   * Two of the note window's decisions relying on space homing's answer,
   * replaced since, the note window decided: their ids and the replacement's.
   */
  function affected() {
    const homing = answeredIn(dir(), SPACE, 'Does a space remember its notes?', { ...MADE, text: 'It does.' });
    const relying = ['Where does a note open?', 'Where does a closed note go?'].map((text) => {
      const asked = writeIn(dir(), 'ask', NOTE, [], { ...MADE, text });
      return writeIn(dir(), 'decide', NOTE, ['--answers', asked, '--relies-on', homing.answer], { ...MADE, text: 'In its space.', why: 'Spaces remember.' });
    });
    const replacement = writeIn(dir(), 'replace', SPACE, ['--replaces', homing.answer, '--reason', 'changed-mind'], { by: 'person', drops: ['the old answer'], text: 'It does not.', why: 'The person wants it so.' });
    decide(TOPIC);
    return { relying, replacement };
  }

  it('18.S52: the door admits the topic, the entry reading its affected entries and saying it stays decided — the topic still decided once in, and the conversation handed back onto the epic\'s menu', () => {
    affected();
    const door = run(['handoff', 'topic', FUMI, TOPIC]);
    const entry = run(['enter', 'discussion', FUMI, TOPIC]);

    assert.match(door, /^skill: leeway-discussion-process\nargs: epic fumi note-window$/m);
    assert.deepStrictEqual(enteredFor(entry), ['affected: `node .claude/skills/leeway-engine/scripts/engine.cjs ledger affected fumi note-window`', STAYS]);
    assert.strictEqual(readManifest(dir(), FUMI).phases.discussion.items[TOPIC].status, 'completed');
    assert.match(run(['handoff', 'leeway-continue-epic', FUMI]), /^skill: leeway-continue-epic\nargs: fumi$/m);
  });

  it('every other decided topic keeps its refusal word for word, at the door and at the entry', () => {
    affected();
    decide('space-homing');
    const homing = DECIDED.replace(TOPIC, 'space-homing');

    assert.deepStrictEqual([refuses(dir(), ['handoff', 'topic', FUMI, 'space-homing']).error, refuses(dir(), ['enter', 'discussion', FUMI, 'space-homing'], { env: SESSION }).error],
      [homing, homing]);
  });

  it('18.S3, 18.2.4, 18.S52: the start menu counts it, and picking the epic opens its menu with it first and recommended, its door the topic', () => {
    affected();
    const start = run(['render', 'start-menu']);
    const row = screenOf(start, 'MENU: start menu').slice(3).join('\n').replace(/\n +/g, ' ').split('\n').find((line) => line.includes('Fumi'));
    const { next } = ok(dir(), ['gate', 'start menu', '--pick', /** @type {string} */ (row).trim().split(' ')[0]], { env: SESSION });
    const opened = run(next.argv);
    const { rows } = menu();

    assert.match(/** @type {string} */ (row), /1 topic waiting for you/);
    assert.match(opened, /^skill: leeway-continue-epic\nargs: fumi$/m);
    assert.match(rows[0], /^1 +→ "Note Window": a decision it relies on changed —$/);
    assert.match(rows[1], /\(recommended\)$/);
    assert.deepStrictEqual(ok(dir(), ['gate', 'epic menu', '--pick', '1'], { env: SESSION }).next, { kind: 'engine', argv: ['handoff', 'topic', FUMI, TOPIC] });
  });

  it('18.S52: it waits until each entry is confirmed or replaced — one confirmed, it still waits; the other replaced, it is listed decided again with no key, and its door shuts', () => {
    const { relying: [held, changed], replacement } = affected();
    run(['enter', 'discussion', FUMI, TOPIC]);
    writeIn(dir(), 'hold', NOTE, ['--entry', held, '--after', replacement], MADE);
    const halfway = menu();
    writeIn(dir(), 'replace', NOTE, ['--replaces', changed, '--reason', 'changed-mind'], { by: 'person', drops: ['its space'], text: 'Where it was closed.', why: 'Spaces forget.' });
    const after = menu();

    assert.ok(halfway.rows.some((line) => AFFECTED_ROW.test(line)), halfway.rows.join('\n'));
    assert.ok(!after.rows.some((line) => AFFECTED_ROW.test(line) || line.includes('Note Window')), after.rows.join('\n'));
    assert.deepStrictEqual(after.shown.slice(after.shown.indexOf('DECIDED'), after.shown.indexOf('DECIDED') + 2), ['DECIDED', '  └─ Note Window']);
    assert.deepStrictEqual([refuses(dir(), ['handoff', 'topic', FUMI, TOPIC]).error, refuses(dir(), ['enter', 'discussion', FUMI, TOPIC], { env: SESSION }).error], [DECIDED, DECIDED]);
  });

  it('10.2.7: a message reopens it instead — in progress with mail waiting, never the changed answer\'s wait, its entry no longer saying it stays decided', () => {
    affected();
    sent('space-homing', TOPIC, 'Spaces forget');
    const { rows } = menu();
    const entry = run(['enter', 'discussion', FUMI, TOPIC]);

    assert.strictEqual(readManifest(dir(), FUMI).phases.discussion.items[TOPIC].status, 'in-progress');
    assert.ok(rows.some((line) => /Continue "Note Window" — in progress · mail waiting/.test(line)), rows.join('\n'));
    assert.ok(!rows.some((line) => AFFECTED_ROW.test(line)), rows.join('\n'));
    assert.ok(!enteredFor(entry).includes(STAYS), entry);
  });
});
