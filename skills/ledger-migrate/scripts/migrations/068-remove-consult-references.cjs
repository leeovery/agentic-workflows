'use strict';

//
// Migration 068: Remove consult references
//
// A specification no longer tracks consult references — a sibling discussion
// owing a grouping a correction, recorded per specification item as
// `consult_references.{ref}.status`. The grouping analysis records that
// correction as a `**Tension**` line on the receiving grouping instead, which
// the specification session reads at setup and its construction raises. The
// field is deleted from every specification item, and in each work unit's
// grouping analysis (`.state/discussion-consolidation-analysis.md`) a line
// opening `**Consult**:` opens `**Tension**:` instead, the rest of the line
// kept, so an owed correction is still raised. Everything else in either
// file stands, the manifest in the format the engine writes it in.
//
// A directory whose manifest is absent or does not parse is not a work unit,
// and is left alone.
//
// Idempotent: once removed, no field and no `**Consult**:` line is left.
//

const fs = require('fs');
const path = require('path');

const ANALYSIS = path.join('.state', 'discussion-consolidation-analysis.md');
const CONSULT_LINE = /^\*\*Consult\*\*:/gm;

/** @param {unknown} v @returns {v is Record<string, any>} */
function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Delete every specification item's consult references in place.
 * @param {Record<string, any>} manifest
 * @returns {boolean} whether anything changed
 */
function removeConsultReferences(manifest) {
  const phases = manifest.phases;
  const specification = isObject(phases) ? phases.specification : undefined;
  const items = isObject(specification) ? specification.items : undefined;
  if (!isObject(items)) return false;
  let changed = false;
  for (const item of Object.values(items)) {
    if (!isObject(item) || !Object.hasOwn(item, 'consult_references')) continue;
    delete item.consult_references;
    changed = true;
  }
  return changed;
}

/**
 * Rewrite the grouping analysis's `**Consult**:` lines as `**Tension**:` lines.
 * @param {string} file
 * @returns {boolean} whether the file changed
 */
function retagConsultLines(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return false;
  }
  const retagged = text.replace(CONSULT_LINE, '**Tension**:');
  if (retagged === text) return false;
  fs.writeFileSync(file, retagged);
  return true;
}

module.exports = {
  id: '068',
  description: 'remove consult references — a correction a sibling discussion owes a grouping is carried as a tension line',
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
      const unitDir = path.join(workflowsDir, entry.name);
      const manifestPath = path.join(unitDir, 'manifest.json');
      let manifest;
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch {
        continue;
      }
      if (!isObject(manifest)) continue;

      const manifestChanged = removeConsultReferences(manifest);
      if (manifestChanged) fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
      const analysisChanged = retagConsultLines(path.join(unitDir, ANALYSIS));
      if (manifestChanged || analysisChanged) {
        reportUpdate();
        touched = true;
      }
    }
    if (!touched) reportSkip();
  },
};
