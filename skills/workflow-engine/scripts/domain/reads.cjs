'use strict';

// ---------------------------------------------------------------------------
// Domain ring: generic reads — manifest and file loads with no phase or
// lifecycle semantics. Quiet by design: a missing file answers null/[] so
// callers branch on data, never on exceptions. Derivations may require
// reads; never the reverse.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function fileExists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function listFiles(dir, ext) {
  try {
    return fs.readdirSync(dir).filter(f => f.endsWith(ext)).sort();
  } catch {
    return [];
  }
}

function listDirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
             .filter(d => d.isDirectory())
             .map(d => d.name)
             .sort();
  } catch {
    return [];
  }
}

function countFiles(dir, ext) {
  return listFiles(dir, ext).length;
}

function filesChecksum(paths) {
  if (!paths || paths.length === 0) return null;
  const hash = crypto.createHash('md5');
  for (const p of paths) {
    try {
      hash.update(fs.readFileSync(p));
    } catch {
    }
  }
  return hash.digest('hex');
}

function loadProjectManifest(cwd) {
  const p = path.join(cwd, '.workflows', 'manifest.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function loadManifest(cwd, name) {
  const p = path.join(cwd, '.workflows', name, 'manifest.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Get work unit names from the project manifest, falling back to filesystem scanning.
 */
function workUnitNames(cwd) {
  const proj = loadProjectManifest(cwd);
  if (proj && proj.work_units && Object.keys(proj.work_units).length > 0) {
    return Object.keys(proj.work_units);
  }
  // Fallback: scan filesystem (pre-migration compat)
  const workflowsDir = path.join(cwd, '.workflows');
  return listDirs(workflowsDir).filter(n => !n.startsWith('.'));
}

function loadActiveManifests(cwd) {
  const results = [];
  for (const name of workUnitNames(cwd)) {
    const m = loadManifest(cwd, name);
    if (m && m.status === 'in-progress') results.push(m);
  }
  return results;
}

function loadAllManifests(cwd) {
  const results = [];
  for (const name of workUnitNames(cwd)) {
    const m = loadManifest(cwd, name);
    if (m) results.push(m);
  }
  return results;
}

module.exports = {
  listFiles,
  listDirs,
  countFiles,
  fileExists,
  loadManifest,
  filesChecksum,
  loadActiveManifests,
  loadAllManifests,
  loadProjectManifest,
};
