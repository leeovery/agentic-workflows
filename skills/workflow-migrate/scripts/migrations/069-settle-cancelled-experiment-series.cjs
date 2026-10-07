'use strict';

//
// Migration 069: Settle cancelled experiment series
//
// An experiment series' status is derived from its records — `completed`
// once every record is terminal — and a topic's cancel abandons the open
// records and lets the series settle. The per-series cancel of
// v0.7.22–v0.7.54 wrote `status: cancelled` on the series item instead,
// stashing `previous_status`, after abandoning every open record — so each
// such series reads `completed`, and its `previous_status` is deleted. The
// records, the spawning conversations, and the discovery map row are left as
// they are; everything else in the manifest stands, in the format the engine
// writes it in.
//
// A directory whose manifest is absent or does not parse is not a work unit,
// and is left alone.
//
// Idempotent: once settled, no series reads `cancelled`.
//

const fs = require('fs');
const path = require('path');

/** @param {unknown} v @returns {v is Record<string, any>} */
function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Settle every cancelled experiment series in place.
 * @param {Record<string, any>} manifest
 * @returns {boolean} whether anything changed
 */
function settleCancelledSeries(manifest) {
  const phases = manifest.phases;
  const experiment = isObject(phases) ? phases.experiment : undefined;
  const items = isObject(experiment) ? experiment.items : undefined;
  if (!isObject(items)) return false;
  let changed = false;
  for (const series of Object.values(items)) {
    if (!isObject(series) || series.status !== 'cancelled') continue;
    series.status = 'completed';
    delete series.previous_status;
    changed = true;
  }
  return changed;
}

module.exports = {
  id: '069',
  description: 'settle cancelled experiment series — a series the old per-series cancel closed reads completed',
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
        continue;
      }
      if (!isObject(manifest) || !settleCancelledSeries(manifest)) continue;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
      reportUpdate();
      touched = true;
    }
    if (!touched) reportSkip();
  },
};
