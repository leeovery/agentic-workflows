'use strict';

//
// Migration 062: Clear the unasked implementation setup arrays
//
// An implementation topic's `project_skills` and `linters` are recorded by
// its two setup steps: absent means the topic was never asked, a stored
// array — `[]` included — is the set the user confirmed. `task init` used to
// write both as `[]` when it created the item, so a topic that stopped before
// its setup steps ran carries an `[]` that stands for never asked. Only an
// in-progress item with no task-loop progress can be one: an item with a
// current or completed task got past the setup steps, so its `[]` is a real
// answer. Delete the empty arrays from those items alone.
//

const fs = require('fs');
const path = require('path');

const SETUP_FIELDS = ['project_skills', 'linters'];

/**
 * Whether an implementation item never reached its task loop.
 * @param {Record<string, any>} item
 * @returns {boolean}
 */
function withoutProgress(item) {
  const noCurrent = item.current_task === undefined || item.current_task === null;
  const completed = item.completed_tasks;
  const noCompleted = completed === undefined || completed === null
    || (Array.isArray(completed) && completed.length === 0);
  return noCurrent && noCompleted;
}

/**
 * Clear one manifest's unasked setup arrays in place.
 * @param {any} manifest
 * @returns {boolean}  whether anything changed
 */
function clearUnaskedSetup(manifest) {
  const phases = manifest && typeof manifest === 'object' ? manifest.phases : undefined;
  if (!phases || typeof phases !== 'object') return false;
  const implementation = phases.implementation;
  const items = implementation && typeof implementation === 'object' ? implementation.items : undefined;
  if (!items || typeof items !== 'object' || Array.isArray(items)) return false;
  let changed = false;
  for (const item of Object.values(items)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    if (item.status !== 'in-progress' || !withoutProgress(item)) continue;
    for (const field of SETUP_FIELDS) {
      if (Array.isArray(item[field]) && item[field].length === 0) {
        delete item[field];
        changed = true;
      }
    }
  }
  return changed;
}

module.exports = {
  id: '062',
  description: 'clear the empty project_skills and linters an unstarted implementation carries — never asked, so its setup steps ask',
  info: 'An implementation topic records project_skills and linters at its setup steps: absent is never asked, a stored array (an empty one included) is a confirmed set. Items created before this release got both as empty arrays at creation, so an in-progress implementation with no current or completed task may carry an empty array that was never asked. This migration deletes those empty arrays from such items alone; populated arrays, items with task-loop progress, and every other phase are untouched.',
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
      if (!clearUnaskedSetup(manifest)) continue;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
      reportUpdate();
      touched = true;
    }
    if (!touched) reportSkip();
  },
};
