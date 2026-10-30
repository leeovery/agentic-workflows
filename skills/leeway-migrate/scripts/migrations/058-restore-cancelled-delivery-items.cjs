'use strict';

//
// Migration 058: Restore cancelled planning, implementation, and review items
//
// Delivery never cancels: the epic's cancel is one unit per stage, and the
// Definition unit — the specification with its plan — is locked once an
// implementation or review item exists under its name. Installs that ran
// the per-item cancel may still carry `status: cancelled` on a planning,
// implementation, or review item — a row no menu lists and no verb frees.
// Restore each to the status it stashed, or to never-attempted when it
// stashed nothing. The specification, research, and discussion phases are
// the unit verbs' own and are never touched.
//

const fs = require('fs');
const path = require('path');

const DELIVERY_PHASES = ['planning', 'implementation', 'review'];

/**
 * Restore one manifest's cancelled delivery items in place.
 * @param {any} manifest
 * @returns {boolean}  whether anything changed
 */
function restoreDeliveryItems(manifest) {
  let changed = false;
  const phases = manifest && typeof manifest === 'object' ? manifest.phases : undefined;
  if (!phases || typeof phases !== 'object') return false;
  for (const phase of DELIVERY_PHASES) {
    const items = phases[phase] && typeof phases[phase] === 'object' ? phases[phase].items : undefined;
    if (!items || typeof items !== 'object') continue;
    for (const item of Object.values(items)) {
      if (!item || typeof item !== 'object' || item.status !== 'cancelled') continue;
      if (typeof item.previous_status === 'string' && item.previous_status !== '') {
        item.status = item.previous_status;
      } else {
        delete item.status;
      }
      delete item.previous_status;
      changed = true;
    }
  }
  return changed;
}

module.exports = {
  id: '058',
  description: 'restore cancelled planning, implementation, and review items — Delivery never cancels; the specification unit cancels whole',
  info: 'Cancel is topic-level per stage and Delivery never cancels, so a cancelled planning, implementation, or review item is a row no menu lists and no verb frees. This migration restores each such item to the status it stashed under previous_status, or to never-attempted (status removed) when it stashed nothing; specification, research, and discussion items are untouched.',
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
      const manifestPath = path.join(workflowsDir, entry.name, 'manifest.json');
      let manifest;
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch {
        continue; // no manifest or unreadable — not a work unit, leave it
      }
      if (!restoreDeliveryItems(manifest)) continue;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
      reportUpdate();
      touched = true;
    }
    if (!touched) reportSkip();
  },
};
