'use strict';

// ---------------------------------------------------------------------------
// A quick-fix's review round passing with a nit to fix (19.S23): it hands
// back to nothing while its fix task waits, then to the close once that
// task is done or closed — or, where the task's builder left a note for
// later, once `review notes` answers it. The review's other rounds:
// test-engine-quick-fix-review-rounds.cjs.
//
// Layer: git. World: quick-fix-review-world.cjs, the close reached, built
// once and copied. Each test's conversation keeps its records in a config
// folder of its own.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const { layout, writeState, cleanupFixture } = require('./engine-harness.cjs');
const { UNIT } = require('./quick-fix-world.cjs');
const { ledgerReadHelpers } = require('./ledger-world.cjs');
const { CLOSE, closeReached: world, quickFixReview } = require('./quick-fix-review-world.cjs');

let dir = ''; // the project
const { run, payload, nitRoundPassed, nitTaskBuilt } = quickFixReview(() => dir);

afterEach(() => {
  cleanupFixture(dir);
});

describe('19.S23: a quick-fix\'s review round passing with a nit to fix', () => {
  it('a round that passes with a nit to fix hands back to nothing while its fix task waits; its fix task done hands back to the close', () => {
    dir = world();
    const passed = nitRoundPassed();
    const done = nitTaskBuilt();

    assert.deepStrictEqual([passed.passed, passed.ends, passed.next], [true, true, undefined]);
    assert.deepStrictEqual(done.next, CLOSE);
  });

  it('its nit\'s fix task closed hands back to the close, as one done does', () => {
    dir = world();
    nitRoundPassed();
    run(['task', 'start', UNIT, '3.1']);

    assert.deepStrictEqual(run(['task', 'close', UNIT, '3.1', '--reason', 'The help names it once, as the docs do.']).next, CLOSE);
  });

  it('its nit\'s fix task\'s builder leaving a note, the task done hands back to nothing, and review notes, answering the note, to the close', () => {
    dir = world();
    nitRoundPassed();
    const note = run(['task', 'note', UNIT, '--file', writeState(dir, layout.cache('note.md'), 'The man page spells it --color too.')]).number;
    const done = nitTaskBuilt();
    const { ask, decide } = ledgerReadHelpers(() => dir);
    const call = decide(`${UNIT}.review`, ask(`${UNIT}.review`, 'Is the man page this change\'s?'), 'Dropped: the man page is generated.');
    const answered = run(['review', 'notes', UNIT, '--file', payload('notes.json', {
      findings: [{ area: 'notes', scope: 'out', call: 'nit', text: 'The man page spells it --color.', from: [`notes#${note}`], drop: 'The man page is generated.', ledger: call }],
    })]);

    assert.deepStrictEqual([done.next, answered.next], [undefined, CLOSE]);
  });
});
