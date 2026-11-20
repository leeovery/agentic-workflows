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
// - The keep's doors go through without the stamp while the checkout owes
//   no migration on this version (22.1.8, engine.cjs `KEEP_FORMS`): its
//   migrations record holds the installed migrations' highest id — the
//   runner records each once it completes, in order — as the state branch
//   holds it, so a migration waiting on its review's yes, its record
//   uncommitted (boot.cjs), is owed too; and the reshape waits on no
//   commit. A conversation boot stamped meets the migration waiting alone:
//   its stamp vouches for the rest. Either way no keep commits a
//   migration's edits. One read of the record, a stat and one git call, on
//   the keep's way alone; a record that does not read is owed.
// - Written whole under the lock beside it, so two projects booted at once
//   in one conversation both stand; a file that does not read is written
//   over. The gate mod copies the file across a handoff's clear, unread, so
//   the conversation the work goes on in stands booted as the one it left.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { LOCK_TIMEOUT_MS, isObject, withStateLockFile, writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { stateRoot, statePath } = require('../kernel/state-root.cjs');
const { conversationDir } = require('./conversation.cjs');
const { BOOTED } = require('./user-files.cjs');
const { highestMigration } = require('../../../ledger-migrate/scripts/migration-ids.cjs');
const { MIGRATIONS_RECORD, finishWaits, reviewWaits } = require('./migration-commit.cjs');

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
  return `this conversation has not booted Ledger for ${key} on this version — invoke the start skill, /ledger, which runs engine boot before anything else`;
}

/** Why a keep's door is refused while the checkout owes a migration (`owesMigration`). */
const MIGRATION_OWED = 'this checkout owes Ledger\'s migration on this version — on the person\'s yes, run boot\'s migration, then this again';

/**
 * Whether the checkout `cwd` is in owes a migration on this version (the
 * header's), for a conversation boot has stamped, or not.
 * @param {string} cwd @param {boolean} stamped @returns {boolean}
 */
function owesMigration(cwd, stamped) {
  if (finishWaits(cwd) || reviewWaits(cwd)) return true;
  if (stamped) return false;
  let record;
  try {
    record = fs.readFileSync(statePath(cwd, MIGRATIONS_RECORD), 'utf8');
  } catch {
    return true;
  }
  const highest = installedMigration();
  return highest !== null && !record.split('\n').includes(highest);
}

module.exports = { MIGRATION_OWED, stampBoot, unbootedRefusal, owesMigration };
