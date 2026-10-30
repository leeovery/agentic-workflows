'use strict';

// ---------------------------------------------------------------------------
// What the trust log's suites share (test-engine-trust-log.cjs,
// test-engine-trust-evidence.cjs): an id of the ledger's shape spelled from a
// word, the project's id and a session's; and `useTrustWorld`, each test's
// folder with the trust log in a config folder of its own, its projects plain
// folders whose state roots are pinned, its events as the log's lines, and a
// call run in a conversation. And what every suite reading the trust log a
// project world's commands wrote shares — the ledger's trust suite, the
// verdicts' and the raises' (raise-world.cjs): the log's text and events, and
// the project's id it keys them by (`trustLogHelpers`).
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { beforeEach, afterEach } = require('node:test');
const fs = require('fs');
const path = require('path');

const { STATE_DIR_NAME, layout, statePath } = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { pinStateRoot } = require(path.join(SCRIPTS, 'kernel/state-root.cjs'));
const { conversationDir, markConversation } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));
const { TRUST_LOG, PENDING } = require(path.join(SCRIPTS, 'domain/trust-log.cjs'));

/** An id of the ledger's shape, spelled from `word`. @param {string} word */
const idOf = (word) => word.padEnd(21, '0');

const PROJECT_ID = idOf('Fumi');
// A Claude Code session's id.
const SESSION = 'c0ffee00-1234-4abc-8def-0123456789ab';

/** Events as the lines of the log. @param {...Record<string, unknown>} events */
const lines = (...events) => events.map((event) => `${JSON.stringify(event)}\n`).join('');

/** A record's context: run from `cwd`, its warnings into `warnings`. @param {string} cwd @param {string[]} [warnings] */
const from = (cwd, warnings = []) => ({ cwd, warnings });

/** The waiting events' file of the conversation `session`. @param {string} [session] */
const waitingPath = (session = SESSION) => path.join(conversationDir(session), PENDING);

/**
 * `fn` run in the conversation `session`, the conversation marked as
 * running from `dir`: its answer.
 * @template T @param {string} dir @param {() => T} fn @param {string} [session]
 * @returns {T}
 */
function inConversation(dir, fn, session = SESSION) {
  process.env.CLAUDE_CODE_SESSION_ID = session;
  try {
    markConversation(dir);
    return fn();
  } finally {
    delete process.env.CLAUDE_CODE_SESSION_ID;
  }
}

/**
 * Each test of the calling file in a folder of its own, made before it and
 * removed after it, its trust log in the folder's config folder.
 * @param {string} prefix temp-directory prefix, so a leftover names its suite
 */
function useTrustWorld(prefix) {
  const folder = useTempFolder(prefix);
  /** @type {string|undefined} */
  let pinned;
  beforeEach(() => {
    pinned = process.env.LEEWAY_CONFIG_DIR;
    process.env.LEEWAY_CONFIG_DIR = path.join(folder(), 'config');
  });
  afterEach(() => {
    process.env.LEEWAY_CONFIG_DIR = pinned;
  });

  /** This test's trust log. */
  const logPath = () => path.join(folder(), 'config', TRUST_LOG);

  /** The log's text, '' where there is none. */
  function logText() {
    return fs.existsSync(logPath()) ? fs.readFileSync(logPath(), 'utf8') : '';
  }

  /**
   * A project of this test whose state holds `manifest` as its project
   * manifest — none at all where null — its state root pinned: its folder.
   * @param {string} name @param {Record<string, unknown>|null} [manifest]
   */
  function project(name, manifest = { project_id: PROJECT_ID }) {
    const dir = path.join(folder(), name);
    const root = path.join(dir, STATE_DIR_NAME);
    fs.mkdirSync(root, { recursive: true });
    if (manifest !== null) fs.writeFileSync(path.join(root, layout.projectManifest), JSON.stringify(manifest));
    pinStateRoot(dir, root);
    return dir;
  }

  return { folder, logPath, logText, project };
}

/**
 * The trust log in the config folder `config` names, which the commands run
 * in the project world at `dir` write to: its text, '' where there is none;
 * its events, each as written; and the id the project's events are keyed by.
 * @param {() => string} dir @param {() => string} config
 */
function trustLogHelpers(dir, config) {
  const file = () => path.join(config(), TRUST_LOG);
  const logText = () => (fs.existsSync(file()) ? fs.readFileSync(file(), 'utf8') : '');
  /** @returns {Record<string, any>[]} */
  const logEvents = () => logText().split('\n').slice(0, -1).map((line) => JSON.parse(line));
  /** @returns {string} */
  const project = () => JSON.parse(fs.readFileSync(statePath(dir(), layout.projectManifest), 'utf8')).project_id;
  return { logText, logEvents, project };
}

module.exports = { idOf, PROJECT_ID, SESSION, lines, from, waitingPath, inConversation, useTrustWorld, trustLogHelpers };
