#!/bin/bash
#
# Migration 032: Promote existing cross-cutting specs and strip type field
#
# Part A: For epic work units with spec items having type === 'cross-cutting':
#   - Create cross-cutting work unit with completed status
#   - Move discussion files and specification directory
#   - Mark epic spec item as promoted
#   - Register in project manifest
#
# Part B: For feature/bugfix with type field on spec items, delete it
#
# Part C: Strip remaining type fields from all spec items
#
# Idempotent. Direct node for JSON — never uses manifest CLI.
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"

[ -d "$WORKFLOWS_DIR" ] || return 0

node -e "
const fs = require('fs');
const path = require('path');

const wfDir = '$WORKFLOWS_DIR';
const projPath = path.join(wfDir, 'manifest.json');
let updated = false;

// Load project manifest
let proj = {};
if (fs.existsSync(projPath)) {
  try { proj = JSON.parse(fs.readFileSync(projPath, 'utf8')); } catch {}
}
if (!proj.work_units) proj.work_units = {};

// Scan work unit directories
const entries = fs.readdirSync(wfDir, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

  const mPath = path.join(wfDir, entry.name, 'manifest.json');
  if (!fs.existsSync(mPath)) continue;

  let m;
  try { m = JSON.parse(fs.readFileSync(mPath, 'utf8')); } catch { continue; }

  const specPhase = (m.phases || {}).specification || {};
  const items = specPhase.items || {};

  for (const [topic, item] of Object.entries(items)) {
    // Part A: Epic promotion
    if (m.work_type === 'epic' && item.type === 'cross-cutting') {
      const ccDir = path.join(wfDir, topic);

      // Skip if already promoted (cc work unit exists)
      if (fs.existsSync(path.join(ccDir, 'manifest.json'))) {
        // Just ensure type is removed and status is promoted
        delete item.type;
        if (item.status !== 'promoted') {
          item.status = 'promoted';
          item.promoted_to = topic;
        }
        updated = true;
        continue;
      }

      // Create cc work unit directory
      fs.mkdirSync(ccDir, { recursive: true });

      // Build cc manifest
      const ccManifest = {
        name: topic,
        work_type: 'cross-cutting',
        status: 'completed',
        created: new Date().toISOString().slice(0, 10),
        description: 'Promoted from epic: ' + m.name,
        source_work_unit: m.name,
        source_topic: topic,
        phases: {},
      };

      // Move discussion files (sources backfilled by migration 030)
      const sources = item.sources || {};
      const sourceKeys = typeof sources === 'object' && !Array.isArray(sources)
        ? Object.keys(sources)
        : [];

      if (sourceKeys.length > 0) {
        const ccDiscDir = path.join(ccDir, 'discussion');
        fs.mkdirSync(ccDiscDir, { recursive: true });

        ccManifest.phases.discussion = { items: {} };

        for (const src of sourceKeys) {
          const srcFile = path.join(wfDir, m.name, 'discussion', src + '.md');
          if (fs.existsSync(srcFile)) {
            const destFile = path.join(ccDiscDir, src + '.md');
            fs.renameSync(srcFile, destFile);
          }
          ccManifest.phases.discussion.items[src] = { status: 'completed' };
        }
      }

      // Move specification directory
      const epicSpecDir = path.join(wfDir, m.name, 'specification', topic);
      const ccSpecDir = path.join(ccDir, 'specification');
      if (fs.existsSync(epicSpecDir)) {
        fs.mkdirSync(ccSpecDir, { recursive: true });
        const destDir = path.join(ccSpecDir, topic);
        fs.renameSync(epicSpecDir, destDir);
      }

      // Initialize spec phase in cc manifest
      ccManifest.phases.specification = {
        items: {
          [topic]: {
            status: 'completed',
            date: new Date().toISOString().slice(0, 10),
          },
        },
      };

      // Write cc manifest
      fs.writeFileSync(
        path.join(ccDir, 'manifest.json'),
        JSON.stringify(ccManifest, null, 2) + '\n'
      );

      // Update epic manifest
      item.status = 'promoted';
      item.promoted_to = topic;
      delete item.type;

      // Register in project manifest
      proj.work_units[topic] = { work_type: 'cross-cutting' };

      updated = true;
      continue;
    }

    // Part B + C: Strip type field from all spec items
    if ('type' in item) {
      delete item.type;
      updated = true;
    }
  }

  // Write back manifest if we changed it
  if (updated) {
    fs.writeFileSync(mPath, JSON.stringify(m, null, 2) + '\n');
  }
}

// Write project manifest if updated
if (updated) {
  fs.writeFileSync(projPath, JSON.stringify(proj, null, 2) + '\n');
}
" 2>/dev/null

if [ $? -eq 0 ]; then
  report_update
else
  report_skip
fi
