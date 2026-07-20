'use strict';

//
// Migration 048: Strip the dead status field from discovery map items
//
// Discovery map items are status-less by design — lifecycle is computed at
// render time by joining the map item against per-phase items. The retired
// create-discovery-topic command (and init-phase before it) stamped a dead
// `status: "in-progress"` on map items that nothing reads. The schema now
// refuses discovery status writes (empty vocabulary); this strips the field
// from existing manifests so on-disk state matches the rule.
//
// Idempotent: manifests whose discovery items carry no status are skipped.
// Defensive: unparseable manifests are skipped untouched. Reports one update
// per work unit changed (the counter mirrors the bash per-unit report_update).
//
// Point-in-time snapshot: reads/writes manifest.json directly. Never uses the
// engine field surface.
//

const fs = require('fs');
const path = require('path');

module.exports = {
  id: '048',
  description: 'strip discovery item status',
  run({ projectDir, reportUpdate, reportSkip }) {
    const wfDir = path.join(projectDir, '.workflows');
    const updated = [];

    for (const entry of fs.readdirSync(wfDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const mf = path.join(wfDir, entry.name, 'manifest.json');
      if (!fs.existsSync(mf)) continue;

      let manifest;
      try {
        manifest = JSON.parse(fs.readFileSync(mf, 'utf8'));
      } catch (_) {
        continue; // defensive: never touch an unparseable manifest
      }

      const items = manifest && manifest.phases && manifest.phases.discovery
        && manifest.phases.discovery.items;
      if (!items || typeof items !== 'object') continue;

      let changed = false;
      for (const item of Object.values(items)) {
        if (item && typeof item === 'object' && 'status' in item) {
          delete item.status;
          changed = true;
        }
      }

      if (changed) {
        fs.writeFileSync(mf, JSON.stringify(manifest, null, 2) + '\n');
        updated.push(entry.name);
      }
    }

    if (updated.length > 0) {
      for (let i = 0; i < updated.length; i++) reportUpdate();
    } else {
      reportSkip();
    }
  },
};
