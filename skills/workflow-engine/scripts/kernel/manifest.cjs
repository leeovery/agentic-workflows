'use strict';

// ---------------------------------------------------------------------------
// Kernel: manifest IO — the engine's façade over the shared manifest-io
// module (workflow-shared/scripts/manifest-io.cjs), which the manifest CLI
// consumes too: one read/parse, one atomic-write serialisation, one lock
// protocol — the two writers can never drift.
//
// Mechanism only: it knows nothing about what the manifest contains. The
// façade translates the engine's `cwd` convention (project root) to the
// shared module's `workflowsDir` and keeps the engine ring's import surface
// stable.
// ---------------------------------------------------------------------------

const path = require('path');
const io = require('../../../workflow-shared/scripts/manifest-io.cjs');

/** @param {string} cwd project root (the directory containing `.workflows/`) */
function workflowsDir(cwd) {
  return path.join(cwd, '.workflows');
}

/**
 * Load and parse one work unit's manifest (loud on missing/invalid).
 * @param {string} cwd
 * @param {string} workUnit
 * @returns {any}
 */
function loadWorkUnitManifest(cwd, workUnit) {
  return io.readWorkUnitManifest(workflowsDir(cwd), workUnit);
}

/**
 * Save one work unit's manifest atomically (temp file + rename).
 * @param {string} cwd
 * @param {string} workUnit
 * @param {object} manifest
 */
function saveWorkUnitManifest(cwd, workUnit, manifest) {
  io.writeWorkUnitManifestAtomic(workflowsDir(cwd), workUnit, manifest);
}

/**
 * Run `fn` holding the work unit's manifest lock — every load→mutate→save
 * belongs inside one of these so engine writes and CLI writes serialise
 * against each other.
 * @template T
 * @param {string} cwd
 * @param {string} workUnit
 * @param {() => T} fn
 * @returns {T}
 */
function withWorkUnitLock(cwd, workUnit, fn) {
  return io.withWorkUnitLock(workflowsDir(cwd), workUnit, fn);
}

/**
 * Read the project manifest ({} when absent; loud on corrupt JSON).
 * @param {string} cwd
 * @returns {Record<string, any>}
 */
function readProjectManifest(cwd) {
  return io.readProjectManifest(workflowsDir(cwd));
}

/**
 * Save the project manifest atomically.
 * @param {string} cwd
 * @param {object} data
 */
function writeProjectManifestAtomic(cwd, data) {
  io.writeProjectManifestAtomic(workflowsDir(cwd), data);
}

/**
 * Run `fn` holding the project manifest lock.
 * @template T
 * @param {string} cwd
 * @param {() => T} fn
 * @returns {T}
 */
function withProjectLock(cwd, fn) {
  return io.withProjectLock(workflowsDir(cwd), fn);
}

module.exports = {
  loadWorkUnitManifest,
  saveWorkUnitManifest,
  withWorkUnitLock,
  readProjectManifest,
  writeProjectManifestAtomic,
  withProjectLock,
};
