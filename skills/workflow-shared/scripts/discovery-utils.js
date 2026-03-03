'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function fileExists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function listFiles(dir, ext) {
  try {
    return fs.readdirSync(dir).filter(f => f.endsWith(ext)).sort();
  } catch { return []; }
}

function listDirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort();
  } catch { return []; }
}

function countFiles(dir, ext) {
  return listFiles(dir, ext).length;
}

function filesChecksum(paths) {
  if (!paths || paths.length === 0) return null;
  const hash = crypto.createHash('md5');
  for (const p of paths) {
    try { hash.update(fs.readFileSync(p)); } catch {}
  }
  return hash.digest('hex');
}

function loadManifest(cwd, name) {
  const p = path.join(cwd, '.workflows', name, 'manifest.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch { return null; }
}

function loadActiveManifests(cwd) {
  const workflowsDir = path.join(cwd, '.workflows');
  const results = [];
  for (const name of listDirs(workflowsDir)) {
    if (name.startsWith('.')) continue;
    const m = loadManifest(cwd, name);
    if (m && m.status === 'active') results.push(m);
  }
  return results;
}

function phaseStatus(manifest, phase) {
  return ((manifest.phases || {})[phase] || {}).status || null;
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
  const ps = (phase) => phaseStatus(manifest, phase);
  const wt = manifest.work_type;

  if (ps('review') === 'completed') return { next_phase: 'done', phase_label: 'pipeline complete' };
  if (ps('review') === 'in-progress') return { next_phase: 'review', phase_label: 'review (in-progress)' };
  if (ps('implementation') === 'completed') return { next_phase: 'review', phase_label: 'ready for review' };
  if (ps('implementation') === 'in-progress') return { next_phase: 'implementation', phase_label: 'implementation (in-progress)' };
  if (ps('planning') === 'concluded') return { next_phase: 'implementation', phase_label: 'ready for implementation' };
  if (ps('planning') === 'in-progress') return { next_phase: 'planning', phase_label: 'planning (in-progress)' };
  if (ps('specification') === 'concluded') return { next_phase: 'planning', phase_label: 'ready for planning' };
  if (ps('specification') === 'in-progress') return { next_phase: 'specification', phase_label: 'specification (in-progress)' };

  if (wt === 'bugfix') {
    if (ps('investigation') === 'concluded') return { next_phase: 'specification', phase_label: 'ready for specification' };
    if (ps('investigation') === 'in-progress') return { next_phase: 'investigation', phase_label: 'investigation (in-progress)' };
    return { next_phase: 'investigation', phase_label: 'ready for investigation' };
  }

  if (ps('discussion') === 'concluded') return { next_phase: 'specification', phase_label: 'ready for specification' };
  if (ps('discussion') === 'in-progress') return { next_phase: 'discussion', phase_label: 'discussion (in-progress)' };

  if (wt === 'epic') {
    if (ps('research') === 'concluded') return { next_phase: 'discussion', phase_label: 'ready for discussion' };
    if (ps('research') === 'in-progress') return { next_phase: 'research', phase_label: 'research (in-progress)' };
    return { next_phase: 'research', phase_label: 'ready for research' };
  }

  return { next_phase: 'discussion', phase_label: 'ready for discussion' };
}

module.exports = {
  fileExists,
  listFiles,
  listDirs,
  countFiles,
  filesChecksum,
  loadManifest,
  loadActiveManifests,
  phaseStatus,
  phaseItems,
  phaseData,
  computeNextPhase,
};
