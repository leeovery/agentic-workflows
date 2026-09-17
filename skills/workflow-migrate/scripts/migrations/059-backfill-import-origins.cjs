'use strict';

//
// Migration 059: Backfill import origins
//
// Every `imports[]` entry records where its file came from, and a field whose
// absence carries meaning is a field nobody can validate. Entries that landed
// before the field existed get the origin their door had: a work unit's own
// imports arrived at discovery's opener, the project manifest's
// `roadmap.imports[]` at the product altitude. An entry already carrying an
// origin is untouched.
//

const fs = require('fs');
const path = require('path');

/**
 * Stamp `origin` on every entry of one `imports[]` that lacks it.
 * @param {unknown} entries
 * @param {string} origin
 * @returns {boolean}  whether anything changed
 */
function backfillEntries(entries, origin) {
  if (!Array.isArray(entries)) return false;
  let changed = false;
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    if (typeof entry.origin === 'string' && entry.origin !== '') continue;
    entry.origin = origin;
    changed = true;
  }
  return changed;
}

/**
 * Read a manifest, backfill it, write it back when it changed.
 * @param {string} manifestPath
 * @param {(manifest: any) => boolean} backfill
 * @returns {boolean}  whether the file was rewritten
 */
function rewriteManifest(manifestPath, backfill) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return false; // no manifest or unreadable — leave it
  }
  if (!manifest || typeof manifest !== 'object' || !backfill(manifest)) return false;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return true;
}

module.exports = {
  id: '059',
  description: 'backfill import origins — discovery for work-unit imports, roadmap for the product layer',
  info: 'Every imports[] entry now records an origin. This migration stamps "discovery" on each work-unit imports[] entry that carries none (the opener was the only door before the field existed) and "roadmap" on each of the project manifest\'s roadmap.imports[] entries; entries already carrying an origin are untouched.',
  run({ projectDir, reportUpdate, reportSkip }) {
    const workflowsDir = path.join(projectDir, '.workflows');
    let entries;
    try {
      entries = fs.readdirSync(workflowsDir, { withFileTypes: true });
    } catch {
      reportSkip();
      return;
    }

    let touched = false;
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const changed = rewriteManifest(
        path.join(workflowsDir, entry.name, 'manifest.json'),
        (manifest) => backfillEntries(manifest.imports, 'discovery'));
      if (changed) {
        reportUpdate();
        touched = true;
      }
    }

    const projectChanged = rewriteManifest(path.join(workflowsDir, 'manifest.json'), (manifest) => {
      const roadmap = manifest.roadmap;
      if (!roadmap || typeof roadmap !== 'object' || Array.isArray(roadmap)) return false;
      return backfillEntries(roadmap.imports, 'roadmap');
    });
    if (projectChanged) {
      reportUpdate();
      touched = true;
    }

    if (!touched) reportSkip();
  },
};
