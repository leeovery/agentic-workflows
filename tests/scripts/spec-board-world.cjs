'use strict';

// ---------------------------------------------------------------------------
// What the specification's board suites share (test-engine-board-spec*.cjs):
// the board as the world's conversation reads it at the unit's
// specification; a banner fact, a gap and ready to build's yes as the view
// lists them, and Claude's call the world made; and the steps the suites
// take over spec-review-world.cjs's world — the spec landed, traced or not,
// a pass reported with its findings, a finding asked as a question, a pass's
// dispatch dated, and ready to build's screen drawing.
// ---------------------------------------------------------------------------

const { ok, readState, writeState, layout } = require('./engine-harness.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');
const {
  UNIT, SESSION_ID, SESSION, MADE, AT_SPEC, LANED, STORE, made, specReviewHelpers,
} = require('./spec-review-world.cjs');

/** A banner fact. @param {string} text @param {boolean} [needs] */
const fact = (text, needs = false) => ({ text, needs });

/**
 * A gap waiting on the person as the specification lists it: by its entry
 * and words, the finding of pass 1 that raised it, where one did, opening
 * that finding's page, else its entry's, and the sections it touches.
 * @param {string} id @param {string} text @param {string|null} [finding] @param {string[]} [sections]
 */
const gap = (id, text, finding = null, sections = []) => ({ kind: 'gap', id, text, page: finding === null ? `entry:${id}` : `pass:1:${finding}`, pass: finding === null ? null : 1, finding, sections });

/** Ready to build's yes, waiting on the person, as the unit's one list holds it. */
const READY = { kind: 'ready', id: 'ready-to-build', text: 'Ready to build: the outline and the phase cut, for your yes', page: null };

/** Claude's call the world made on a topic of the unit, which no look has shown: no pass asked its question. */
const RADIUS = () => ({ id: made.radius, text: 'Ten points.', question: 'What radius are the corners?', pass: null, finding: null, sections: [] });

/** The board and the steps the suites take, over the project `dir` names. @param {() => string} dir */
function specBoard(dir) {
  const { write, entries } = ledgerHelpers(dir);
  const { spec, writeSpec, land, issued, dispatchReview, reportIn, acked } = specReviewHelpers(dir);

  /** The board's view and banner for the world's conversation, at the unit's specification. @param {string[]} [args] */
  function board(args = []) {
    ok(dir(), ['session', 'label', UNIT, 'specification', UNIT], { env: SESSION });
    const { view, banner } = ok(dir(), ['board', SESSION_ID, ...args], { env: SESSION });
    return { view, banner };
  }

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

  /** The spec written with every statement traced, and landed. */
  function tracedLanded() {
    writeSpec(spec({ instant: `2.1.2 Refunds are instant. [${made.where}]` }));
    land();
  }

  /** The spec cut into one phase of every section, and ready to build's checklist worked and closed: its screen draws. */
  function readyClosed() {
    ok(dir(), ['cut', UNIT, '--file', writeState(dir(), layout.cache(UNIT, 'specification', 'cut.json'), JSON.stringify({ phases: [{ name: 'All', goal: 'A card is charged and refunded.', scenarios: ['1.S1'], sections: ['1', '2'], relies_on: [] }] }))]);
    for (const item of ['replacements-checked', 'invariants-checked']) ok(dir(), ['checklist', 'done', 'ready-to-build', UNIT, item]);
    ok(dir(), ['checklist', 'close', 'ready-to-build', UNIT]);
  }

  /** A pass reported with LANED's two findings and acknowledged with them, the spec written and landed. */
  function lanedPass() {
    landed();
    const pass = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', pass.id]);
    reportIn(pass, LANED);
    acked(pass, ['F1', 'F2']);
    return pass;
  }

  /** A question asked at the spec citing Refunds, and the pass's finding F1 surfaced as it. @param {{id: string}} pass @param {string} text */
  function askedAs(pass, text) {
    const asked = write('ask', AT_SPEC, [], { ...MADE, by: 'review', text, cites: [{ path: `${UNIT}/spec.md`, section: '2. Refunds' }] }).id;
    ok(dir(), ['agent', 'surface', UNIT, 'specification', UNIT, pass.id, 'F1', '--question', asked]);
    return asked;
  }

  /**
   * A question asked at the spec before it was written, and a replacement the
   * first pass, dispatched after it, raised. @returns {string} the question's id
   */
  function bothWaiting() {
    const asked = write('ask', AT_SPEC, [], { ...MADE, text: 'Is a refund ever split?' }).id;
    landed();
    const pass = dispatchReview();
    issued(['spec-reviewer', UNIT, '--agent', pass.id]);
    reportIn(pass, LANED);
    acked(pass, ['F1', 'F2']);
    ok(dir(), ['agent', 'surface', UNIT, 'specification', UNIT, pass.id, 'F1', '--replaces', made.where, '--reason', 'changed-mind']);
    dispatchedAt(pass, lastAt(1000));
    return asked;
  }

  return { board, lastAt, dispatchedAt, landed, tracedLanded, readyClosed, lanedPass, askedAs, bothWaiting };
}

module.exports = { fact, gap, READY, RADIUS, specBoard };
