'use strict';

// ---------------------------------------------------------------------------
// `engine board` in a specification (leeway-engine/scripts/domain/
// projections/board-spec.cjs, 20.9): the spec's sections, each with the
// passes that changed it and whether a pass running reads it; the review's
// passes newest first, each with its calls and the person's, a running one
// with its clock and what it reads; each gap waiting on the person by its
// entry, its words, its pass and its sections; Claude's calls since the list
// was last drawn — read without looking (5.8.14) — the cut, and whose ready
// to build waits on; a section's page and a pass's.
//
// Layer: verb. World: spec-review-world.cjs's — the epic `payments`, its two
// topics decided — copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { ok, readState, writeState } = require('./engine-harness.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');
const {
  UNIT, SESSION_ID, SESSION, MADE, AT_SPEC, LANED, OWNER, STORE, made, useSpecReviewWorld, specReviewHelpers,
} = require('./spec-review-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { passesInFlight } = require(path.join(SCRIPTS, 'domain/agent-state.cjs'));

const dir = useSpecReviewWorld();
const { write, entries } = ledgerHelpers(dir);
const {
  spec, writeSpec, land, issued, dispatchReview, reportIn, acked, cleanPass,
} = specReviewHelpers(dir);

/** The board's view and banner for the world's conversation, at the unit's specification. @param {string[]} [args] */
function board(args = []) {
  ok(dir(), ['session', 'label', UNIT, 'specification', UNIT], { env: SESSION });
  const { view, banner } = ok(dir(), ['board', SESSION_ID, ...args], { env: SESSION });
  return { view, banner };
}

/** A banner fact. @param {string} text @param {boolean} [needs] */
const fact = (text, needs = false) => ({ text, needs });

/** Claude's call the world made on a topic of the unit, which no look has shown. */
const RADIUS = () => ({ id: made.radius, text: 'Ten points.', question: null });

/**
 * The ledger's last entry's time, to the second, moved on by `ms`, and a
 * pass's dispatch put then in the agent store.
 */
const lastAt = (ms = 0) => new Date(Date.parse(entries().at(-1).at) + ms).toISOString();
/** @param {{id: string}} pass @param {string} created */
function dispatchedAt({ id }, created) {
  const store = JSON.parse(readState(dir(), STORE));
  store.agents[id].created = created;
  writeState(dir(), STORE, JSON.stringify(store));
}

/** The spec written and landed. */
function landed() {
  writeSpec(spec());
  land();
}

describe('a specification on the board (20.9)', () => {
  it('before the spec is written: no section, no pass, nothing waiting; the banner says it is being written', () => {
    assert.deepStrictEqual(board(), {
      view: {
        kind: 'spec', unit: UNIT, title: 'Payments', type: 'epic', sections: [], passes: [], waiting: [], since: [RADIUS()], cut: [], ready: 'review',
      },
      banner: { name: 'Payments', state: 'running', facts: [fact('epic'), fact('specification'), fact('being written')] },
    });
  });

  it('the spec\'s areas in its order, each with the passes that changed it and whether a pass running reads it; a pass running numbered after those reported, newest first, since it was dispatched, with what it reads; the banner names the pass reading (20.9.1)', () => {
    landed();
    cleanPass();
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, always.' }));
    land();
    const running = dispatchReview(OWNER.running);
    issued(['spec-reviewer', UNIT, '--agent', running.id]);
    const [{ created }] = passesInFlight(dir(), UNIT);
    const { view, banner } = board();

    assert.deepStrictEqual({ sections: view.sections, passes: view.passes, facts: banner.facts.slice(2) }, {
      sections: [{ number: '1', title: 'Cards', changed_by: [], reading: false }, { number: '2', title: 'Refunds', changed_by: [1], reading: true }],
      passes: [
        { pass: 2, found: 0, calls: 0, yours: 0, running: true, since: created, reads: ['2'] },
        { pass: 1, found: 0, calls: 0, yours: 0, running: false, since: null, reads: null },
      ],
      facts: [fact('pass 2 reading')],
    });
  });

  it('a section a later land changed again is changed by each pass whose findings the land took (20.9.1)', () => {
    landed();
    cleanPass();
    writeSpec(spec({ instant: '2.1.2 Refunds are instant, always.' }));
    land();
    cleanPass();

    assert.deepStrictEqual(board().view.sections.map(({ changed_by: by }) => by), [[], [1]]);
  });

  it('20.9.1: a question asked at the spec and a replacement the review raised each wait on the person by its entry and words, the pass that raised it and the sections citing what it is about; the pass\'s finds split into Claude\'s calls and the person\'s; the banner says the next pass waits on them, plain, the count waiting flagged (20.2.4)', () => {
    const asked = write('ask', AT_SPEC, [], { ...MADE, text: 'Is a refund ever split?' }).id;
    landed();
    const pass = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', pass.id]);
    reportIn(pass, LANED);
    acked(pass, ['F1', 'F2']);
    ok(dir(), ['agent', 'surface', UNIT, 'specification', UNIT, pass.id, 'F1', '--replaces', made.where, '--reason', 'changed-mind']);
    dispatchedAt(pass, lastAt(1000));
    const { view, banner } = board();

    assert.deepStrictEqual({ passes: view.passes, waiting: view.waiting, banner }, {
      passes: [{ pass: 1, found: 2, calls: 1, yours: 1, running: false, since: null, reads: null }],
      waiting: [
        { id: asked, text: 'Is a refund ever split?', pass: null, sections: [] },
        { id: made.where, text: 'Back to the card.', pass: 1, sections: ['2'] },
      ],
      banner: { name: 'Payments', state: 'needs', facts: [fact('epic'), fact('specification'), fact('pass 2 waits on you'), fact('2 waiting on you', true)] },
    });
  });

  it('20.9.1: a question asked after a pass reported is that pass\'s — one dispatched in the second it was asked among them, the ledger\'s time being to the second — with the sections it cites', () => {
    landed();
    const pass = cleanPass();
    const asked = write('ask', AT_SPEC, [], { ...MADE, text: 'Is a refund ever split?', cites: [{ path: `${UNIT}/spec.md`, section: '2. Refunds' }] }).id;
    dispatchedAt(pass, lastAt(999));

    assert.deepStrictEqual(board().view.waiting, [{ id: asked, text: 'Is a refund ever split?', pass: 1, sections: ['2'] }]);
  });

  it('once the review settles, ready to build waits on the person, the banner saying so plain (20.2.4)', () => {
    landed();
    cleanPass();
    const { view, banner } = board();

    assert.deepStrictEqual([view.ready, banner], ['person', { name: 'Payments', state: 'needs', facts: [fact('epic'), fact('specification'), fact('ready to build waits on you')] }]);
  });

  it('5.8.14: Claude\'s calls on the unit since the list was last drawn stay listed however often the board is drawn, and none once it is', () => {
    const asked = write('ask', AT_SPEC, [], { ...MADE, text: 'Is a refund ever partial?' }).id;
    const call = write('decide', AT_SPEC, ['--answers', asked], { ...MADE, given: 'own', text: 'Never.', why: 'A refund returns the whole charge.' }).id;
    const drawn = [board().view.since, board().view.since];
    ok(dir(), ['ledger', 'shown', UNIT], { env: SESSION });
    const calls = [RADIUS(), { id: call, text: 'Never.', question: null }];

    assert.deepStrictEqual([...drawn, board().view.since], [calls, calls, []]);
  });

  it('20.9.2: a section opens on its own page; one the spec lacks is unavailable, saying why', () => {
    landed();

    assert.deepStrictEqual([board(['--page', 'section:2']).view.title, board(['--page', 'section:2']).view.kind, board(['--page', 'section:9']).view], [
      'Refunds', 'section', { kind: 'unavailable', reason: 'payments\'s spec holds no section 9' },
    ]);
  });

  it('20.9.2: a pass opens on its own page, what it found and its report; one not reported is unavailable, saying why', () => {
    landed();
    const pass = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', pass.id]);
    reportIn(pass, LANED);
    acked(pass, ['F1', 'F2']);

    assert.deepStrictEqual([board(['--page', 'pass:1']).view, board(['--page', 'pass:2']).view], [
      { kind: 'pass', unit: UNIT, pass: 1, found: 2, calls: 1, yours: 1, text: `${LANED}\n` },
      { kind: 'unavailable', reason: 'payments\'s review holds no reported pass 2' },
    ]);
  });
});
