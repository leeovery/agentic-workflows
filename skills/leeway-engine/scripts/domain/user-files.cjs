'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the files at user level only the engine writes (5.4.2,
// 6.5.12, 16.13.2), and why a tool call reaching one is refused — the rules
// the layout hook holds Claude's writes to (layout-hook.cjs), and the hook
// before Bash the words of a shell command to (shell-guard.cjs).
//
// In the system config directory: every file whose bytes reach the trust
// log — the log and its lock, and each conversation's file of events waiting
// for it and that file's lock (trust-log.cjs); each conversation's two files
// a gate event is built from, the gate shown and the gate mod's last press,
// which the mod writes by no tool of Claude's (gate.cjs); each
// conversation's sealed raises, which hold Claude's lean before the person
// answers (raise.cjs); each conversation's briefs, the folder and every file
// in it, which the hook before Agent and SendMessage hands over as issued
// (brief-guard.cjs), and that hook's refusals; the one-decision check's log
// (ledger-one-decision.cjs); the settings file and the record of the person. In each project folder of Claude Code's projects
// directory, the files of its own the trust log reads the model from
// (conversation.cjs): a conversation's transcript, and a subagent's
// transcript and its record.
//
// Each is judged by the names that reach it from the folder it is guarded
// below, which each hook reads its own way, spelled as it folds them. The
// trust log's and the gate's file names live here rather than in their own
// modules, so neither hook loads those.
// ---------------------------------------------------------------------------

const path = require('path');
const { SETTINGS_FILE, systemConfigDir } = require('../kernel/system-config.cjs');
const { claudeProjectsDir, conversationsRoot } = require('./conversation.cjs');
const { BRIEFS, BRIEF_REFUSALS } = require('./brief-names.cjs');

/** The trust log, in the system config directory. */
const TRUST_LOG = 'trust.jsonl';

/** A conversation's events waiting for the trust log, in its folder. */
const PENDING = 'trust-pending.jsonl';

/** The gate a conversation was shown, in its folder. */
const SHOWN = 'gate-shown.json';

/** The raises a conversation was drawn, sealed (raise.cjs). */
const RAISE_SHOWN = 'raise-shown.json';

/** The gate mod's record of its last press (conversation.cjs). */
const PRESSED = 'pressed.json';

/** The one-decision check's runs, in the system config directory (ledger-one-decision.cjs). */
const DECISION_CHECKS = 'decision-checks.jsonl';

/** @typedef {(name: string) => string} Fold  how a name is spelled where names are compared */
/** @typedef {(file: string, root: string) => string[]} NamesBelow  the names that reach a file from the guarded folder `root`; none where they do not */

/**
 * Each file at user level the hooks refuse: its name, the folder it sits
 * below and how many names reach it from there — one in the system config
 * directory, two in a conversation's folder of the conversations directory
 * — and what it is, for the reason Claude is given.
 * @returns {{name: string, below: string, depth: number, what: string}[]}
 */
function userFiles() {
  const configFile = (/** @type {string} */ name, /** @type {string} */ what) => ({ name, below: systemConfigDir(), depth: 1, what });
  const conversationFile = (/** @type {string} */ name, /** @type {string} */ what) => ({ name, below: conversationsRoot(), depth: 2, what });
  return [
    configFile(TRUST_LOG, 'the trust log'),
    configFile(`${TRUST_LOG}.lock`, 'the trust log\'s lock'),
    conversationFile(PENDING, 'a conversation\'s file of events waiting for the trust log'),
    conversationFile(`${PENDING}.lock`, 'the lock on a conversation\'s events waiting for the trust log'),
    conversationFile(SHOWN, 'the record of the gate a conversation was shown'),
    conversationFile(PRESSED, 'the gate mod\'s record of a conversation\'s last press'),
    conversationFile(RAISE_SHOWN, 'a conversation\'s sealed raises'),
    configFile(BRIEF_REFUSALS, 'the brief hook\'s refusals'),
    configFile(DECISION_CHECKS, 'the one-decision check\'s log'),
    configFile(SETTINGS_FILE, 'the settings file'),
    configFile('person.md', 'the record of the person'),
  ];
}

/**
 * Why `file` is refused as one of the files the engine alone writes at user
 * level, or null where it is none of them.
 * @param {string} file as written @param {Fold} fold @param {NamesBelow} below
 * @returns {string|null}
 */
function userRefusal(file, fold, below) {
  const name = fold(path.basename(file));
  const refused = userFiles().find((user) => fold(user.name) === name && below(file, user.below).length === user.depth);
  return refused ? `${refused.what} (${refused.name}) changes only through the engine's commands` : null;
}

/**
 * Why `file` is refused as a conversation's briefs folder or a file in it,
 * at any depth there; null where it is none of them.
 * @param {string} file as written @param {Fold} fold @param {NamesBelow} below
 * @returns {string|null}
 */
function briefRefusal(file, fold, below) {
  const names = below(file, conversationsRoot());
  if (names.length < 2 || names[1] !== fold(BRIEFS)) return null;
  return names.length === 2 ? `a conversation's briefs (${path.basename(file)}/) change only through the engine's commands`
    : `a brief a conversation issued (${path.basename(file)}) changes only through the engine's commands`;
}

/**
 * Why `file` is refused as one of Claude Code's own files the trust log
 * reads the model from — in a project folder of its projects directory, a
 * conversation's transcript, or in a conversation's `subagents/` a
 * subagent's transcript or its record — or null where it is none of them.
 * @param {string} file as written @param {Fold} fold @param {NamesBelow} below
 * @returns {string|null}
 */
function claudeRefusal(file, fold, below) {
  const name = fold(path.basename(file));
  const transcript = name.endsWith('.jsonl');
  if (!transcript && !name.endsWith('.meta.json')) return null;
  const names = below(file, claudeProjectsDir());
  const what = names.length === 2 && transcript ? 'a conversation\'s transcript'
    : names.length === 4 && names[2] === 'subagents' ? `a subagent's ${transcript ? 'transcript' : 'record'}` : null;
  return what === null ? null : `${what} (${path.basename(file)}) is Claude Code's own: the trust log reads the model from it`;
}

/**
 * Why a tool call reaching `file` at user level is refused — a file the
 * engine alone writes there, a conversation's briefs, or one of Claude
 * Code's own the trust log reads the model from — or null where it is none
 * of them: each judged by the names `below` reads from a guarded folder to
 * the file, spelled by `fold`.
 * @param {string} file as written @param {Fold} fold @param {NamesBelow} below
 * @returns {string|null}
 */
function userLevelRefusal(file, fold, below) {
  return userRefusal(file, fold, below) ?? briefRefusal(file, fold, below) ?? claudeRefusal(file, fold, below);
}

module.exports = { TRUST_LOG, PENDING, SHOWN, RAISE_SHOWN, PRESSED, DECISION_CHECKS, userLevelRefusal };
