'use strict';

// ---------------------------------------------------------------------------
// What the review phase's board suites share (test-engine-board-review*.cjs):
// the board as the world's conversation reads it at the review phase, the
// view's head, an area's line and the tests' reader's, finish waiting, and
// the banner's facts.
// ---------------------------------------------------------------------------

const path = require('path');
const { UNIT, SESSION_ID, env, ok } = require('./review-world.cjs');
const { place } = require('./board-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { projectName } = require(path.join(SCRIPTS, 'domain/state-checks.cjs'));

/** An area's line. @param {string} area @param {string} title @param {string} state @param {{ran?: number, found?: number, since?: string|null}} [more] */
const area = (area, title, state, { ran = 0, found = 0, since = null } = {}) => ({ area, title, state, ran, found, since });

/** The tests' reader's line. @param {string} state @param {{ran?: number, found?: number, since?: string|null}} [more] */
const tests = (state, more) => area('tests', 'Tests held against the specification', state, more);

/** Finish, waiting on the person, as the unit's one list holds it. */
const FINISH = { kind: 'finish', id: 'finish', text: 'Finish: the report of every round, and your verdict on each call you changed', page: null };

/** The banner's facts, each plain unless flagged. @param {...(string|[string])} facts */
const facts = (...facts) => facts.map((fact) => (typeof fact === 'string' ? { text: fact, needs: false } : { text: fact[0], needs: true }));

/** The banner's facts that say where the session is, then the rest as `facts` takes them. @param {string[]} where @param {...(string|[string])} rest */
const placed = (where, ...rest) => [...where.map(place), ...facts(...rest)];

/** The board and the view's head for the project `dirOf` names. @param {() => string} dirOf */
function reviewBoard(dirOf) {
  /** The board's view of the session's review phase, and its banner. @param {string[]} [args] */
  function board(args = []) {
    const { view, banner } = ok(dirOf(), ['board', SESSION_ID, ...args], { env: env() });
    return { view, banner };
  }

  /** The view's head: the unit, the project and the tasks built, finish waiting where `finish` says, no question waiting. @param {number} round @param {boolean} [finish] */
  const head = (round, finish = false) => ({ kind: 'review', unit: UNIT, title: 'Pay', project: projectName(dirOf()), type: 'feature', built: 3, round, waiting: finish ? [FINISH] : [], stopped: false });

  return { board, head };
}

module.exports = { area, tests, FINISH, facts, placed, reviewBoard };
