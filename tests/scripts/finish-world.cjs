'use strict';

// ---------------------------------------------------------------------------
// What finish's suites share (test-engine-finish*.cjs), over
// review-world.cjs's world: the screen as a conversation draws it, and a
// refusal that writes and commits nothing.
// ---------------------------------------------------------------------------

const { output } = require('./engine-harness.cjs');
const { UNIT, env, refusedPristine } = require('./review-world.cjs');

/** Finish's screen and refusals for the project `dirOf` names. @param {() => string} dirOf */
function finishHelpers(dirOf) {
  /** The screen as a conversation draws it. @param {string} [session] */
  const screen = (session) => output(dirOf(), ['render', 'finish', UNIT], { env: env(session) });

  /** The refusal's error, nothing written or committed. @param {string[]} args */
  const refused = (args) => refusedPristine(dirOf(), args, { env: env() }).error;

  return { screen, refused };
}

module.exports = { finishHelpers };
