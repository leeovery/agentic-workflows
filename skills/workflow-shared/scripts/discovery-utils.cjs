'use strict';

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

function phaseStatus(manifest, phase) {
  const p = (manifest.phases || {})[phase] || {};
  if (p.items && typeof p.items === 'object') {
    const keys = Object.keys(p.items);
    if (keys.length === 0) return null;
    if (keys.length === 1) return (p.items[keys[0]] || {}).status || null;
    const statuses = keys.map(k => (p.items[k] || {}).status).filter(Boolean);
    if (statuses.length === 0) return null;
    if (statuses.every(s => s === 'completed' || s === 'skipped')) return 'completed';
    if (statuses.some(s => s === 'in-progress')) return 'in-progress';
    if (statuses.some(s => s === 'pending')) return 'pending';
    return statuses[0];
  }
  return null;
}

function phaseItems(manifest, phase) {
  const p = (manifest.phases || {})[phase] || {};
  if (!p.items || typeof p.items !== 'object') return [];
  return Object.entries(p.items).map(([name, data]) => ({ name, ...data }));
}

function phaseData(manifest, phase) {
  return (manifest.phases || {})[phase] || {};
}

function computeNextPhase(manifest) {
  const wt = manifest.work_type;

  const ps = (phase) => phaseStatus(manifest, phase);

  // Quick-fix has its own short pipeline: scoping → implementation → review
  if (wt === 'quick-fix') {
    if (ps('review') === 'completed') return { next_phase: 'done', phase_label: 'pipeline complete' };
    if (ps('review') === 'in-progress') return { next_phase: 'review', phase_label: 'review (in-progress)' };
    if (ps('implementation') === 'completed') return { next_phase: 'review', phase_label: 'ready for review' };
    if (ps('implementation') === 'in-progress') return { next_phase: 'implementation', phase_label: 'implementation (in-progress)' };
    if (ps('scoping') === 'completed') return { next_phase: 'implementation', phase_label: 'ready for implementation' };
    if (ps('scoping') === 'in-progress') return { next_phase: 'scoping', phase_label: 'scoping (in-progress)' };
    return { next_phase: 'scoping', phase_label: 'ready for scoping' };
  }

  if (ps('review') === 'completed') {
    return { next_phase: 'done', phase_label: 'pipeline complete' };
  }
  if (ps('review') === 'in-progress') {
    return { next_phase: 'review', phase_label: 'review (in-progress)' };
  }
  if (ps('implementation') === 'completed') {
    return { next_phase: 'review', phase_label: 'ready for review' };
  }
  if (ps('implementation') === 'in-progress') {
    return {
      next_phase: 'implementation',
      phase_label: 'implementation (in-progress)',
    };
  }
  if (ps('planning') === 'completed') {
    return { next_phase: 'implementation', phase_label: 'ready for implementation' };
  }
  if (ps('planning') === 'in-progress') {
    return { next_phase: 'planning', phase_label: 'planning (in-progress)' };
  }
  if (ps('specification') === 'completed') {
    if (wt === 'cross-cutting') {
      return { next_phase: 'done', phase_label: 'pipeline complete' };
    }
    return { next_phase: 'planning', phase_label: 'ready for planning' };
  }
  if (ps('specification') === 'in-progress') {
    return {
      next_phase: 'specification',
      phase_label: 'specification (in-progress)',
    };
  }

  if (wt === 'bugfix') {
    if (ps('investigation') === 'completed') {
      return {
        next_phase: 'specification',
        phase_label: 'ready for specification',
      };
    }
    if (ps('investigation') === 'in-progress') {
      return {
        next_phase: 'investigation',
        phase_label: 'investigation (in-progress)',
      };
    }
    return { next_phase: 'investigation', phase_label: 'ready for investigation' };
  }

  if (ps('discussion') === 'completed') {
    return { next_phase: 'specification', phase_label: 'ready for specification' };
  }
  if (ps('discussion') === 'in-progress') {
    return { next_phase: 'discussion', phase_label: 'discussion (in-progress)' };
  }
  if (ps('discussion') === 'pending') {
    return { next_phase: 'discussion', phase_label: 'discussion (pending topics)' };
  }

  // Research is optional for both epic and feature (not bugfix)
  if (wt !== 'bugfix') {
    if (ps('research') === 'in-progress') {
      return { next_phase: 'research', phase_label: 'research (in-progress)' };
    }
    if (ps('research') === 'completed') {
      return { next_phase: 'discussion', phase_label: 'ready for discussion' };
    }
  }

  return { next_phase: 'discussion', phase_label: 'ready for discussion' };
}

module.exports = {
  listFiles,
  listDirs,
  phaseData,
  countFiles,
  fileExists,
  phaseItems,
  phaseStatus,
  loadManifest,
  filesChecksum,
  computeNextPhase,
  loadActiveManifests,
  loadAllManifests,
  loadProjectManifest,
};
