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
// the project's id it keys them by (`trustLogHelpers`). And what the ask
// rule's suites share (test-engine-trust-counts.cjs,
// test-engine-ask-rule.cjs, test-engine-raise-rule.cjs): a history of the
// log's events built in memory, each a second after the last (`history`),
// and questions' ids the blind draw reads each way.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { beforeEach, afterEach } = require('node:test');
const fs = require('fs');
const path = require('path');

const { STATE_DIR_NAME, FROZEN_MS, layout, statePath } = require('./engine-harness.cjs');
const { useTempFolder } = require('./discovery-test-utils.cjs');
const { labelled } = require('./labels.cjs');

const SCRIPTS = path.join(__dirname, '../../skills/leeway-engine/scripts');
const { pinStateRoot } = require(path.join(SCRIPTS, 'kernel/state-root.cjs'));
const { conversationDir, markConversation } = require(path.join(SCRIPTS, 'domain/conversation.cjs'));
const { TRUST_LOG, PENDING } = require(path.join(SCRIPTS, 'domain/trust-log.cjs'));
const { newId } = require(path.join(SCRIPTS, 'domain/ledger-ids.cjs'));
const { trustEvent } = require(path.join(SCRIPTS, 'domain/trust-events.cjs'));
const { MODEL_LINES } = require(path.join(SCRIPTS, 'domain/trust-counts.cjs'));

/** @typedef {import('../../skills/leeway-engine/scripts/domain/event-fields.cjs').Kind} Kind */

/** An id of the ledger's shape, spelled from `word`. @param {string} word */
const idOf = (word) => word.padEnd(21, '0');

const PROJECT_ID = idOf('Fumi');
// Questions' ids as the blind draw reads them (decision-point.cjs): one
// drawn at every share, one drawn only at the wide share, and one never.
const DRAWN = idOf('Drawn');
const NARROW = idOf('Narrow');
const UNDRAWN = idOf('Undrawn');
// A Claude Code session's id.
const SESSION = 'c0ffee00-1234-4abc-8def-0123456789ab';
const DAY = 24 * 60 * 60 * 1000;
// The current model: the newest of the first line of model ids.
const MODEL = MODEL_LINES[0][MODEL_LINES[0].length - 1];

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

/**
 * Where an event of a history is logged, and when: its project, its model,
 * and its time, each the history's own where not given.
 * @typedef {{project?: string|null, model?: string|null, at?: number}} Where
 */

/**
 * A history of the trust log's events, built in memory: in `project`, on
 * `model`, each a second after the last unless given its own time, the
 * first a second after `start`.
 * @param {{project?: string, model?: string|null, start?: number}} [opts]
 */
function history({ project: here = PROJECT_ID, model: current = MODEL, start = FROZEN_MS - DAY } = {}) {
  let clock = start;
  /** @type {Record<string, unknown>[]} */
  const events = [];
  /** @param {string} type @param {Record<string, unknown>} fields @param {Where} [where] */
  const log = (type, fields, { project = here, model = current, at } = {}) => {
    clock = at ?? clock + 1000;
    const header = { id: newId(), at: new Date(clock).toISOString(), project, project_name: project === null ? null : 'fumi', model, session: null };
    const event = trustEvent(type, header, fields);
    events.push(event);
    return event;
  };
  /** A label composing `kind`, null for none. @param {Kind|null} kind */
  const label = (kind) => (kind === null ? null : labelled(kind));
  /**
   * A raise on `kind` answered `answer`, Claude's lean row 1 — the
   * person's "don't care", typed, where `dontCare`: its entry.
   * @param {Kind|null} kind @param {string} answer @param {{sort?: string, dontCare?: boolean}} [opts] @param {Where} [where]
   */
  const raise = (kind, answer, { sort = 'several', dontCare = false } = {}, where = {}) => /** @type {string} */ (log('raise', {
    entry: newId(), kind, label: label(kind), sort, sealed: '1', answer, via: dontCare ? 'typed' : 'pressed', with_text: false, reading: null, didnt_follow: false, dont_care: dontCare, blocks_build: false, replaced_by: null, always: null, blind: false,
  }, where).entry);
  const h = {
    events,
    /** The clock's time now, as the next event's is a second on. */
    now: () => clock,
    /** `n` answers on `kind` taking Claude's lean. @param {number} n @param {Kind|null} [kind] @param {Where} [where] */
    agree: (n, kind = 'behaviour', where = {}) => Array.from({ length: n }, () => raise(kind, '1', {}, where)),
    /** `n` of the person's "don't care" answers on `kind`. @param {number} n @param {Kind|null} [kind] @param {Where} [where] */
    dontCare: (n, kind = 'behaviour', where = {}) => Array.from({ length: n }, () => raise(kind, '1', { dontCare: true }, where)),
    /** A departure on `kind`, judged `verdict` where given: its entry. @param {string|null} [verdict] @param {Kind|null} [kind] @param {Where} [where] */
    depart: (verdict = null, kind = 'behaviour', where = {}) => {
      const entry = raise(kind, '2', {}, where);
      if (verdict !== null) h.verdict(entry, verdict, where);
      return entry;
    },
    /** A raise Claude sorted `sort`, answered `answer`. @param {string} sort @param {string} answer @param {Kind} [kind] */
    sorted: (sort, answer, kind = 'behaviour') => raise(kind, answer, { sort }),
    /** Claude's call on `kind`, sorted `sort`: its entry. @param {string|null} sort @param {Kind} [kind] @param {Where} [where] */
    call: (sort, kind = 'behaviour', where = {}) => /** @type {string} */ (log('call', { entry: newId(), kind, label: label(kind), sort }, where).entry),
    /** The person's reversal of `entry`: its own. @param {string} entry @param {Where} [where] */
    reverse: (entry, where = {}) => /** @type {string} */ (log('reversal', { entry: newId(), reverses: entry }, where).entry),
    /** A raise on `kind` Claude sorted `sort`, which the person didn't follow. @param {string} sort @param {Kind} [kind] */
    unfollowed: (sort, kind = 'behaviour') => {
      log('raise', { entry: null, kind, label: label(kind), sort, sealed: '1', answer: null, via: 'pressed', with_text: false, reading: null, didnt_follow: true, dont_care: false, blocks_build: false, replaced_by: null, always: null, blind: false });
    },
    /** @param {string} entry @param {string} verdict @param {Where} [where] */
    verdict: (entry, verdict, where = {}) => log('verdict', { entry, verdict, point: 'decided' }, { project: where.project }),
    /** @param {string} entry @param {{kind?: Kind|null, verdict?: string|null}} to */
    correct: (entry, { kind = null, verdict = null }) => log('correction', { entry, kind, verdict }),
    /**
     * An answer at gate `name`: a row pressed, or free text read as `reading`.
     * @param {string} name @param {{picked?: string, reading?: string|null}} answer @param {Where} [where]
     */
    gate: (name, { picked, reading = null }, where = {}) => log('gate', picked === undefined
      ? { gate: name, recommended: 'y', picked: null, via: 'typed', with_text: true, reading }
      : { gate: name, recommended: 'y', picked, via: 'pressed', with_text: false, reading: null }, where),
    /** The other events of the log, which answer nothing. */
    others: () => {
      h.unfollowed('several');
      log('blind-draw', { entry: newId(), kind: 'behaviour' });
      log('position-switch', { unit: 'pay', to: 'step' });
      log('convergence', { unit: 'pay', topic: 'cards' });
    },
  };
  return h;
}

module.exports = { idOf, PROJECT_ID, DRAWN, NARROW, UNDRAWN, SESSION, DAY, MODEL, lines, from, waitingPath, inConversation, useTrustWorld, trustLogHelpers, history };
