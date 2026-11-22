'use strict';

// ---------------------------------------------------------------------------
// What finish's suites share (test-engine-finish*.cjs), over
// review-world.cjs's world: the screen as a conversation draws it, a
// refusal that writes and commits nothing, and finish's checklist.
// ---------------------------------------------------------------------------

const { output } = require('./engine-harness.cjs');
const { UNIT, env, ok, refusedPristine } = require('./review-world.cjs');

/** Finish's screen and refusals for the project `dirOf` names. @param {() => string} dirOf */
function finishHelpers(dirOf) {
  /** The screen as a conversation draws it. @param {string} [session] */
  const screen = (session) => output(dirOf(), ['render', 'finish', UNIT], { env: env(session) });

  /** The refusal's error, nothing written or committed. @param {string[]} args */
  const refused = (args) => refusedPristine(dirOf(), args, { env: env() }).error;

  /** A checklist verb, which must succeed. @param {string[]} args */
  const checklist = (args) => ok(dirOf(), ['checklist', ...args], { env: env() });

  /** Finish's items, a line each: key, who checks it, where it stands, and its way on where it names one. @param {string} [unit] */
  const items = (unit = UNIT) => checklist(['show', 'finish', unit]).items.map((/** @type {any} */ { key, by, state, way }) => `${key} ${by} ${state}${way === undefined ? '' : ` — ${way}`}`);

  return { screen, refused, checklist, items };
}

module.exports = { finishHelpers };
