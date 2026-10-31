'use strict';

// ---------------------------------------------------------------------------
// The decided screen as drawn from its view (leeway-engine/scripts/domain/
// projections/decided.cjs): the verdict's question cut to the map's length,
// as the other rows are, and the gate's yes saying the small counts it
// covers in words, as 9.7.3 draws it.
//
// Layer: unit. World: none — the view is a value.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { decidedScreen } = require('../../skills/leeway-engine/scripts/domain/projections/decided.cjs');

/** @type {import('../../skills/leeway-engine/scripts/domain/projections/decided.cjs').DecidedView} */
const VIEW = {
  unit: 'fumi', topic: 'note-window', title: 'Note Window',
  decided: [], carried: [], moved: 0, calls: [], listed: false,
  lines: [], withdrawals: [], candidates: [], skips: [], verdict: null,
};

/** What the decided gate says the yes covers. @param {Partial<typeof VIEW>} view */
const covers = (view) => /^Your yes marks .*$/m.exec(decidedScreen({ ...VIEW, ...view }))?.[0];

/** `n` of `make()`. @template T @param {number} n @param {(at: number) => T} make */
const many = (n, make) => Array.from({ length: n }, (_, at) => make(at));

describe('the decided screen drawn', () => {
  it('cuts the verdict\'s question to the map\'s length', () => {
    const verdict = { entry: 'abc', at: 1, of: 1, question: 'Which corner of the screen does a new note open in?', lean: 'Top left.', yours: 'Bottom right.' };
    assert.match(decidedScreen({ ...VIEW, verdict }), /\nYOUR VERDICT \(1 of 1 call you changed\)\n {2}└─ Which corner of the screen does a new n…\n/);
  });

  it('says the counts its yes covers in words, up to nine', () => {
    const line = (/** @type {number} */ at) => ({ text: `Rule ${at}.`, replaces: null });
    const withdrawal = (/** @type {number} */ at) => ({ text: `Old ${at}.`, why: `Why ${at}.` });
    const candidate = (/** @type {number} */ at) => ({ name: `topic-${at}`, reason: 'R.', struck: false });
    assert.strictEqual(covers({}), 'Your yes marks Note Window decided.');
    assert.strictEqual(covers({ lines: many(2, line), withdrawals: many(1, withdrawal), candidates: many(3, candidate) }),
      'Your yes marks Note Window decided, with the two product-record lines, the withdrawal and the three candidates.');
    assert.strictEqual(covers({ withdrawals: many(9, withdrawal), candidates: [...many(12, candidate), { ...candidate(12), struck: true }] }),
      'Your yes marks Note Window decided, with the nine withdrawals and the 12 candidates.');
  });
});
