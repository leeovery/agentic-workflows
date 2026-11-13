'use strict';

// ---------------------------------------------------------------------------
// What the raise suites share (test-engine-raise.cjs,
// test-engine-raise-answer.cjs, test-engine-raise-replace.cjs): the
// conversation's session id and Claude's account of the person's reason; and
// over a suite's own world, its config folder and its call (`raiseHelpers`),
// the conversation's environment and folder, the raises it sealed, the
// trust log's text and events, the person's answer that must land, the
// ledger's last line, and a raise event as the trust log holds it. And what
// the suites raising under the ask rule share (test-engine-raise-rule.cjs,
// test-engine-raise-blind.cjs): a kind made quiet in the trust log, the
// conversation with the stand-in labelling a call, and a raise drawn.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const fs = require('fs');
const path = require('path');
const { ok, okSectionsAsync } = require('./engine-harness.cjs');
const { ledgerHelpers } = require('./ledger-world.cjs');
const { DAY, lines, history, trustLogHelpers } = require('./trust-world.cjs');
const { labelling } = require('./labels.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { RAISE_SHOWN } = require(path.join(SCRIPTS, 'domain/gate.cjs'));
const { TRUST_LOG } = require(path.join(SCRIPTS, 'domain/trust-log.cjs'));

/** @typedef {import('../../skills/leeway-engine/scripts/domain/event-fields.cjs').Kind} Kind */
/** @typedef {import('./labels.cjs').Marks} Marks */

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

  /** The trust log's events, each but its id, its time, a raise's time and the project's name. */
  const logged = () => logEvents().map(({ id: _id, at: _at, raised: _raised, project_name: _name, ...event }) => event);

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
    entry, kind: null, label: null, sort: call.sort, sealed: call.lean, answer: call.lean, via: 'typed', with_text: false, reading: null, didnt_follow: false, dont_care: false, blocks_build: false, replaced_by: null, always: null, blind: false, ...own,
  });

  /**
   * The trust log holding `clean` answers on `kind` in this project, each
   * taking Claude's lean, as of a day ago: its text.
   * @param {Kind} kind @param {number} [clean]
   */
  function quietOn(kind, clean = 30) {
    const h = history({ project: project(), start: Date.now() - DAY });
    h.agree(clean, kind);
    fs.mkdirSync(config(), { recursive: true });
    fs.writeFileSync(path.join(config(), TRUST_LOG), lines(...h.events));
    return logText();
  }

  /** The conversation, the stand-in labelling `labelled`'s question `kind`, marked as `marks` says. @param {Record<string, unknown>} labelled @param {Kind} kind @param {Marks} [marks] */
  const labelledAs = (labelled, kind, marks) => conversation(labelling(/** @type {string} */ (labelled.question), kind, marks));

  /**
   * A raise of `raising` at `at` with `flags`, in the conversation `env`
   * names: its response and whatever it drew.
   * @param {string} at @param {string[]} flags @param {Record<string, unknown>} raising @param {Record<string, string|undefined>} env
   */
  const raised = (at, flags, raising, env) => okSectionsAsync(dir(), ['raise', at, ...flags], { env, stdin: JSON.stringify(raising) });

  return { conversation, inFolder, seals, logText, logged, project, answer, lastEntry, raiseEvent, quietOn, labelledAs, raised };
}

module.exports = { SESSION, WHY, raiseHelpers };
