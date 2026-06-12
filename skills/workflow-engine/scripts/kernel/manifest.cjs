'use strict';

// ---------------------------------------------------------------------------
// Kernel: manifest IO — load and save one work unit's manifest.json.
//
// Mechanism only: file location, parse, atomic write. It knows nothing about
// what the manifest contains. Saves go through a temp file in the same
// directory followed by a rename, so a crash mid-write can never leave a
// truncated manifest behind.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

/** @param {string} cwd @param {string} workUnit */
function manifestPath(cwd, workUnit) {
  return path.join(cwd, '.workflows', workUnit, 'manifest.json');
}

/**
 * Load and parse one work unit's manifest.
 * @param {string} cwd      project root (the directory containing `.workflows/`)
 * @param {string} workUnit
 * @returns {object}
 */
function loadWorkUnitManifest(cwd, workUnit) {
  const file = manifestPath(cwd, workUnit);
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    throw new Error(`manifest not found: ${file}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`invalid JSON in ${file}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Save one work unit's manifest atomically (temp file in the same directory,
 * then rename over the target).
 * @param {string} cwd
 * @param {string} workUnit
 * @param {object} manifest
 */
function saveWorkUnitManifest(cwd, workUnit, manifest) {
  const file = manifestPath(cwd, workUnit);
  const tmp = path.join(path.dirname(file), `.manifest.json.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

module.exports = { loadWorkUnitManifest, saveWorkUnitManifest };
