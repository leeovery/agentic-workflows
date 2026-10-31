'use strict';

// ---------------------------------------------------------------------------
// The topic's map as the conversation shows it (leeway-engine/scripts/
// domain/topic-map.cjs, drawn by domain/projections/map.cjs): `engine render
// map <unit>.<topic>` — the person's questions and Claude's calls, one line
// each, with where each stands: open, a question moved in shown as the
// message it came as and one an experiment still measures shown waiting on
// it (9.1.11, 9.S61); decided, the person's, handed over, Claude's own
// call, or carried over and counted apart (21.6.5); moved on to another
// topic — each tag in one column across the sections; and Claude's calls
// since the person last looked (9.5.5, 9.S18), drawing the map in the
// conversation moving the last-looked mark in the same call (5.8.14,
// 9.5.11).
//
// Layer: verb. World, built once and copied: an epic, `fumi`, its two
// topics under discussion, the note window's map written through the
// ledger's verbs, an experiment of the unit running on one of its
// questions.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { ok, output, refusedPristine, fixtureFrom, cleanupFixture } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');
const { UNIT, SESSION, MADE, NOTE, SPACE, row, ledgerHelpers } = require('./ledger-world.cjs');

const PERSON = Object.freeze({ by: 'person', who_moved_whom: 'none' });

/** One ledger write in `dir`: its short id. @param {string} dir @param {string} verb @param {string} at @param {string[]} flags @param {Record<string, unknown>} content */
function writeIn(dir, verb, at, flags, content) {
  return ok(dir, ['ledger', verb, at, ...flags], { env: SESSION, stdin: JSON.stringify(content) }).id;
}

/** A question asked at `at`: its short id. @param {string} dir @param {string} text @param {string} [at] */
const askIn = (dir, text, at = NOTE) => writeIn(dir, 'ask', at, [], { ...MADE, text });

/** `question` answered at `at` as `answer` says: its short id. @param {string} dir @param {string} question @param {Record<string, unknown>} answer @param {string} [at] */
const decideIn = (dir, question, answer, at = NOTE) => writeIn(dir, 'decide', at, ['--answers', question], { why: 'Because.', ...answer });

const world = fixtureFrom('map-', (dir) => {
  const phases = {
    discovery: { items: { 'note-window': row(1, 'The note window'), 'space-homing': row(2, 'Where notes open') } },
    discussion: { items: { 'note-window': { status: 'in-progress' }, 'space-homing': { status: 'in-progress' } } },
  };
  createManifest(dir, UNIT, { work_type: 'epic', phases });
  const licence = askIn(dir, 'Does an unlicensed Fumi open on a licence wizard step?', SPACE);
  writeIn(dir, 'move', SPACE, ['--question', licence, '--to', 'note-window'], MADE);
  const timing = askIn(dir, 'How fast does a note open?');
  decideIn(dir, askIn(dir, 'How does first run open?'), { ...PERSON, text: 'The tour first.' });
  decideIn(dir, askIn(dir, 'Is pricing mentioned?'), { ...MADE, text: 'No price line anywhere in first run.' });
  decideIn(dir, askIn(dir, 'Which corner of the screen does a new note open in?'), { ...MADE, given: 'your-call', text: 'Top left.' });
  ledgerHelpers(() => dir).carriedOver(NOTE, askIn(dir, 'Does a note dim when idle?'), 'After a minute.');
  writeIn(dir, 'move', NOTE, ['--question', askIn(dir, 'Where does a space keep its notes?'), '--to', 'space-homing'], MADE);
  createManifest(dir, UNIT, {
    work_type: 'epic',
    phases: { ...phases, experiment: { items: { 'note-window': { status: 'in-progress', experiments: { E1: { slug: 'open-time', status: 'running', question: ledgerHelpers(() => dir).full(timing) } } } } } },
  });
});

/** @type {string} */
let dir;
beforeEach(() => { dir = world(); });
afterEach(() => { cleanupFixture(dir); });

/** The map of `topic`, drawn. @param {string} [topic] */
const map = (topic = 'note-window') => output(dir, ['render', 'map', `${UNIT}.${topic}`]);

/** The map's display, its marker line dropped. @param {string} out */
const shown = (out) => out.slice(out.indexOf('\n') + 1);

describe('render map (9.5.6)', () => {
  it('shows the person\'s questions and Claude\'s calls, one line each, where each stands — a call handed over Claude\'s, one carried over counted apart, so the counts are the rows — each tag in one column, and Claude\'s calls since the person last looked', () => {
    const out = map();
    assert.match(out, /^=== DISPLAY: map \(emit verbatim as a text code block/);
    assert.strictEqual(shown(out), [
      'Map — Note Window',
      '4 of yours: 1 decided, 2 open, 1 moved on · 2 calls by Claude · 1 carried over',
      '',
      'SINCE YOU LAST LOOKED (2 calls by Claude)',
      '  ├─ ◇ Is pricing mentioned?',
      '  │     No price line anywhere in first run.',
      '  └─ ◇ Which corner of the screen does a new n…',
      '        Top left.',
      '',
      'OPEN (2 of yours)',
      '  ├─ ○ Does an unlicensed Fumi open on a licen…    [yours]',
      '  │     ↳ From Space Homing\'s message',
      '  └─ ○ How fast does a note open?                  [yours]',
      '        ↳ Waiting on experiment E1, still running',
      '',
      'DECIDED (1 of yours · 2 calls by Claude · 1 carried over)',
      '  ├─ ✓ How does first run open?                    [yours]',
      '  ├─ ◇ Is pricing mentioned?                       [Claude\'s call]',
      '  ├─ ◇ Which corner of the screen does a new n…    [your call]',
      '  └─ ✓ Does a note dim when idle?                  [carried over]',
      '',
      'MOVED ON (1 of yours)',
      '  └─ → Where does a space keep its notes?          [moved to Space Homing]',
      '',
    ].join('\n'));
  });

  it('moves the last-looked mark as it draws, so a call shows since the person last looked once, and a new call shows the next time (9.S18, 5.8.14)', () => {
    map();
    assert.ok(!map().includes('SINCE YOU LAST LOOKED'), 'the calls the last drawing listed are shown');
    assert.deepStrictEqual(ok(dir, ['ledger', 'since', UNIT, 'note-window']).calls, [], 'the same query, with the mark moved');
    decideIn(dir, askIn(dir, 'Is the window titled?'), { ...MADE, text: 'Untitled.' });
    assert.match(map(), /SINCE YOU LAST LOOKED \(1 call by Claude\)\n {2}└─ ◇ Is the window titled\?\n {8}Untitled\.\n/);
  });

  it('shows a question moved away on the map of the topic it left, and says so of a topic with nothing on its map', () => {
    assert.strictEqual(shown(map('space-homing')), [
      'Map — Space Homing',
      '2 of yours: 0 decided, 1 open, 1 moved on · 0 calls by Claude',
      '',
      'OPEN (1 of yours)',
      '  └─ ○ Where does a space keep its notes?          [yours]',
      '        ↳ From Note Window\'s message',
      '',
      'MOVED ON (1 of yours)',
      '  └─ → Does an unlicensed Fumi open on a licen…    [moved to Note Window]',
      '',
    ].join('\n'));
    createManifest(dir, 'solo', { phases: { discussion: { items: { solo: { status: 'in-progress' } } } } });
    assert.strictEqual(shown(output(dir, ['render', 'map', 'solo.solo'])), 'Map — Solo\nNothing on the map yet: no question asked and no call made.\n');
  });

  it('refuses an address that names no unit\'s topic', () => {
    for (const [address, refusal] of [
      ['fumi', 'render map: address must be <work-unit>.<topic>, got "fumi"'],
      ['fumi.discussion.note-window', 'render map: address must be <work-unit>.<topic>, got "fumi.discussion.note-window"'],
      ['ghost.note-window', 'render map: there is no work unit "ghost"'],
      ['fumi.ghost', 'render map: fumi has no topic "ghost"'],
    ]) {
      assert.strictEqual(refusedPristine(dir, ['render', 'map', address]).error, refusal);
    }
  });
});
