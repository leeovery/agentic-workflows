'use strict';

//
// migration-ids.cjs — how a migration is named, which the runner
// (migrate.cjs) and the engine both ask. A migration's id is its file name's
// leading digits, whatever its extension: `*.sh`, `*.cjs` and a directive's
// `*.md` share one id space, and a directive's check beside it,
// `NNN-{slug}.check.cjs`, is its directive's, no migration of its own.
//
// The highest id the installed migrations hold is the version boot's stamp
// names (the engine's domain/boot-stamp.cjs): a release that brings a
// migration raises it, so a conversation booted before the release boots
// again before it works.
//

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const CHECK = '.check.cjs';

/** Leading digits of a filename, or '' when none. @param {string} scriptPath */
function migrationId(scriptPath) {
  const m = path.basename(scriptPath).match(/^[0-9]+/);
  return m ? m[0] : '';
}

/** Whether a file in the migrations folder is a migration: a directive's check is its directive's. @param {string} name */
function isMigration(name) {
  return /\.(sh|cjs|md)$/.test(name) && !name.endsWith(CHECK);
}

/**
 * The highest id the installed migrations hold, as its file names it; null
 * where the folder holds none.
 * @returns {string|null}
 */
function highestMigration() {
  let dirents;
  try {
    dirents = fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true });
  } catch {
    return null;
  }
  /** @type {string|null} */
  let highest = null;
  for (const entry of dirents) {
    const id = entry.isFile() && isMigration(entry.name) ? migrationId(entry.name) : '';
    if (id !== '' && (highest === null || parseInt(id, 10) > parseInt(highest, 10))) highest = id;
  }
  return highest;
}

module.exports = { MIGRATIONS_DIR, migrationId, isMigration, highestMigration };
