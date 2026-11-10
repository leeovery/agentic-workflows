'use strict';

// ---------------------------------------------------------------------------
// What finish's suites share (test-engine-finish-*.cjs), over
// review-world.cjs's world: the review phase passed, finish's checklist then
// closed, the screen as a conversation draws it, and a refusal that writes
// and commits nothing.
// ---------------------------------------------------------------------------

const { output } = require('./engine-harness.cjs');
const { UNIT, EVERY, env, enter, reported, recorded, finishClosed, refusedPristine } = require('./review-world.cjs');

/** Round 1 recorded passing, every report of it clean. */
function reviewPassed() {
  enter();
  reported(1, EVERY);
  recorded({ can_now: ['Pay by card.'], findings: [] });
}

/** The review passed, then finish's checklist worked and closed (`finishClosed`). */
function finishReady() {
  reviewPassed();
  finishClosed();
}

/** Finish's screen and refusals for the project `dirOf` names. @param {() => string} dirOf */
function finishHelpers(dirOf) {
  /** The screen as a conversation draws it. @param {string} [session] */
  const screen = (session) => output(dirOf(), ['render', 'finish', UNIT], { env: env(session) });

  /** The refusal's error, nothing written or committed. @param {string[]} args */
  const refused = (args) => refusedPristine(dirOf(), args, { env: env() }).error;

  return { screen, refused };
}

module.exports = { reviewPassed, finishReady, finishHelpers };
