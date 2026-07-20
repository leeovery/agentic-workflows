#!/bin/bash
#
# Migration 048: Strip the dead status field from discovery map items
#
# Discovery map items are status-less by design — lifecycle is computed at
# render time by joining the map item against per-phase items. The retired
# create-discovery-topic command (and init-phase before it) stamped a dead
# `status: "in-progress"` on map items that nothing reads. The schema now
# refuses discovery status writes (empty vocabulary); this strips the field
# from existing manifests so on-disk state matches the rule.
#
# Idempotent: manifests whose discovery items carry no status are skipped.
# Defensive: unparseable manifests are skipped untouched.
#
# Point-in-time snapshot: inline node reading/writing manifest.json directly.
# Never uses the manifest CLI.
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"

[ -d "$WORKFLOWS_DIR" ] || return 0

result=$(node -e "
const fs = require('fs');
const path = require('path');

const wfDir = '$WORKFLOWS_DIR';
const updated = [];

for (const entry of fs.readdirSync(wfDir, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
  const mf = path.join(wfDir, entry.name, 'manifest.json');
  if (!fs.existsSync(mf)) continue;

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(mf, 'utf8'));
  } catch {
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

process.stdout.write(updated.join(' '));
" 2>/dev/null)

if [ -n "$result" ]; then
  for wu in $result; do
    report_update "$wu: stripped dead status field(s) from discovery map items"
  done
else
  report_skip "no discovery map items carry a status field"
fi

return 0
