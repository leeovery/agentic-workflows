'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the session labels' stash store — where each labeller
// (session-label-tmux.cjs, session-label-portal.cjs) keeps the original it
// will put back, in the state's git-ignored cache (`.cache/.session-labels/`),
// so no other clone's engine ever reads a record. A record is written whole,
// before the label it guards lands, and carries its owning Claude process's
// identity (pid + start time, the presence discipline): a dead owner marks
// its label as stranded.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { ownerAlive } = require('../kernel/process.cjs');
const { writeJsonAtomic } = require('../kernel/manifest-io.cjs');
const { statePath } = require('../kernel/state-root.cjs');

/** The checkout's stash store, or a place below it. @param {string} cwd @param {string[]} below */
function stashDir(cwd, ...below) {
  return statePath(cwd, '.cache', '.session-labels', ...below);
}

/** A session's key as a file name: its safe characters alone. @param {string} key */
function stashName(key) {
  return key.replace(/[^A-Za-z0-9_-]/g, '');
}

/** A record written whole through the kernel's atomic write, its directory made first. @param {string} file @param {object} record */
function writeRecord(file, record) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeJsonAtomic(file, record);
}

/**
 * Put a record back as it stood before a write whose label never landed —
 * the file gone where there was none — so the record never names a label
 * the session does not wear.
 * @param {string} file @param {object|null} prior
 */
function putRecordBack(file, prior) {
  try {
    if (prior === null) fs.unlinkSync(file);
    else writeRecord(file, prior);
  } catch { /* the record stays as written — the next label re-adopts the live name */ }
}

/**
 * Parse a stash file; null for unreadable or non-object content.
 * @template T @param {string} file @returns {T|null}
 */
function readStash(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch { /* absent or unreadable */ }
  return null;
}

/** Is the record's owning Claude process gone — the kernel's liveness rule, negated? @param {{pid?: number|null, pid_start?: string|null}} stash */
function ownerDead(stash) {
  return !ownerAlive(stash);
}

module.exports = { stashDir, stashName, writeRecord, putRecordBack, readStash, ownerDead };
