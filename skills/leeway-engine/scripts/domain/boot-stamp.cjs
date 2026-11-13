'use strict';

// ---------------------------------------------------------------------------
// Domain ring: boot's stamp (22.1.7) — the record that boot has run in a
// conversation for a project, at the installed engine's version, which every
// verb that touches work refuses without (engine.cjs, `BOOT_EXEMPT`). It is
// `booted.json` in the conversation's folder (conversation.cjs), one entry
// for each project the conversation booted, a file only the engine writes
// (user-files.cjs):
//
//   { "<the project's main checkout>": { "migration": "<id>", "at": "<instant>" } }
//
// - The key is the project's main checkout (kernel/state-root), wherever the
//   call runs: a builder's code worktree, a linked worktree and a folder
//   inside the repository all read the one entry, and an entry for one
//   project says nothing of another.
// - The version is the highest migration id the installed migrations hold
//   (the migrate skill's migration-ids.cjs), read once per process: a
//   release that brings a migration leaves every stamp stale, and the verbs
//   refuse until boot has run it.
// - Boot stamps where it reaches the work, and at a directive's stop, whose
//   steps call verbs; never at a stop where nothing may touch the work
//   (boot.cjs). A call with no session id has no conversation to stamp, and
//   one from a folder in no repository the state can sit in has no project,
//   no work to touch and no boot that could stamp it: nothing refuses
//   either.
// - Written whole under the lock beside it, so two projects booted at once
//   in one conversation both stand; a file that does not read is written
//   over. The gate mod copies the file across a handoff's clear, unread, so
//   the conversation the work goes on in stands booted as the one it left.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { LOCK_TIMEOUT_MS, isObject, withStateLockFile, writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { stateRoot } = require('../kernel/state-root.cjs');
const { conversationDir } = require('./conversation.cjs');
const { BOOTED } = require('./user-files.cjs');
const { highestMigration } = require('../../../leeway-migrate/scripts/migration-ids.cjs');

const STAMP_LOCK = { timeoutMs: LOCK_TIMEOUT_MS, name: 'the lock on the conversation\'s boot stamp' };

/** @typedef {{migration: string|null, at: string}} Stamp */

/** @type {string|null|undefined} */
let installed;

/** The highest migration id the installed migrations hold, read once. @returns {string|null} */
function installedMigration() {
  if (installed === undefined) installed = highestMigration();
  return installed;
}

/**
 * The project a call from `cwd` is in, as the stamp keys it: its main
 * checkout. Throws where the folder is in no repository the state can sit in.
 * @param {string} cwd @returns {string}
 */
function projectKey(cwd) {
  return path.dirname(stateRoot(cwd));
}

/** Where the conversation `sessionId` keeps its stamp. @param {string} sessionId */
function stampPath(sessionId) {
  return path.join(conversationDir(sessionId), BOOTED);
}

/** Every project's entry the stamp at `file` holds; none where it does not read. @param {string} file @returns {Record<string, unknown>} */
function readStamps(file) {
  try {
    const stamps = JSON.parse(fs.readFileSync(file, 'utf8'));
    return isObject(stamps) ? stamps : {};
  } catch {
    return {};
  }
}

/**
 * Stamp the conversation `sessionId` as booted for the project `cwd` is in,
 * at the installed version, beside the other projects' entries.
 * @param {string} cwd @param {string} sessionId
 */
function stampBoot(cwd, sessionId) {
  const key = projectKey(cwd);
  const file = stampPath(sessionId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  withStateLockFile(`${file}.lock`, () => {
    /** @type {Stamp} */
    const entry = { migration: installedMigration(), at: new Date().toISOString() };
    writeJsonAtomic(file, { ...readStamps(file), [key]: entry });
  }, STAMP_LOCK);
}

/**
 * Why a verb called from `cwd` in the conversation `sessionId` is refused —
 * no entry for its project, or one from before the installed version — or
 * null where boot has stamped the conversation for it, or `cwd` is in no
 * project.
 * @param {string} cwd @param {string} sessionId @returns {string|null}
 */
function unbootedRefusal(cwd, sessionId) {
  let key;
  try {
    key = projectKey(cwd);
  } catch {
    return null;
  }
  const entry = readStamps(stampPath(sessionId))[key];
  if (isObject(entry) && entry.migration === installedMigration()) return null;
  return `this conversation has not booted Leeway for ${key} on this version — invoke the start skill, /leeway, which runs engine boot before anything else`;
}

module.exports = { stampPath, stampBoot, unbootedRefusal };
