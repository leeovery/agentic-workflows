'use strict';

// ---------------------------------------------------------------------------
// What the raise suites share (test-engine-raise.cjs,
// test-engine-raise-answer.cjs, test-engine-raise-replace.cjs): the
// conversation's session id and Claude's account of the person's reason; and
// over a suite's own world, its config folder and its call (`raiseHelpers`),
// the conversation's environment and folder, the raises it sealed, the
// trust log's text and events, the person's answer that must land, the
// ledger's last line, and a raise event as the trust log holds it.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const fs = require('fs');
const path = require('path');
const { ok } = require('./engine-harness.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');
const { trustLogHelpers } = require('./trust-world.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { RAISE_SHOWN } = require(path.join(SCRIPTS, 'domain/gate.cjs'));

// A Claude Code session's id: the conversation the raises are drawn in.
const SESSION = 'c0ffee00-1234-4abc-8def-0123456789ab';

/** Claude's account of the person's reason. */
const WHY = 'They keep their notes together on the main screen.';

/**
 * The raise suites' helpers over the project world at `dir`, the config
 * folder `config` the conversation's folder and the trust log sit in, and
 * the suite's call, whose sort and lean a raise event holds unless told
 * otherwise.
 * @param {() => string} dir @param {() => string} config @param {{sort: string, lean: string}} call
 */
function raiseHelpers(dir, config, call) {
  const { entries } = ledgerHelpers(dir);
  const { logText, logEvents, project } = trustLogHelpers(dir, config);

  /** The calling conversation's environment, over `env`. @param {Record<string, string|undefined>} [env] */
  const conversation = (env = {}) => ({ CLAUDE_CODE_SESSION_ID: SESSION, LEEWAY_CONFIG_DIR: config(), ...env });

  /** A file in the conversation's folder. @param {string} name */
  const inFolder = (name) => path.join(config(), 'conversations', SESSION, name);

  /** The conversation's sealed raises, null where none was sealed. @returns {Record<string, any>|null} */
  const seals = () => (fs.existsSync(inFolder(RAISE_SHOWN)) ? JSON.parse(fs.readFileSync(inFolder(RAISE_SHOWN), 'utf8')) : null);

  /** The trust log's events, each but its id, its time and the project's name. */
  const logged = () => logEvents().map(({ id: _id, at: _at, project_name: _name, ...event }) => event);

  /**
   * The person's answer, which must land: its response.
   * @param {string} id @param {string[]} how @param {Record<string, unknown>|null} [given] @param {Record<string, string|undefined>} [env]
   */
  const answer = (id, how, given = { why: WHY }, env = {}) => ok(dir(), ['raise', 'answer', id, ...how], { env: conversation(env), stdin: given === null ? '' : JSON.stringify(given) });

  /** The ledger's last line but its time. */
  function lastEntry() {
    const { at: _at, ...line } = /** @type {Record<string, unknown>} */ (entries().at(-1));
    return line;
  }

  /**
   * A raise event as the trust log holds it, but its id and time: `own` over
   * the pick of the lean, typed.
   * @param {string|null} entry @param {Record<string, unknown>} [own]
   */
  const raiseEvent = (entry, own = {}) => ({
    v: 1, type: 'raise', project: project(), model: null, session: SESSION,
    entry, kind: null, label: null, sort: call.sort, sealed: call.lean, answer: call.lean, via: 'typed', with_text: false, reading: null, didnt_follow: false, blocked_build: null, ...own,
  });

  return { conversation, inFolder, seals, logText, logged, project, answer, lastEntry, raiseEvent };
}

module.exports = { SESSION, WHY, raiseHelpers };
