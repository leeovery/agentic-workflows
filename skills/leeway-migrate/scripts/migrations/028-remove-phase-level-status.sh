#!/bin/bash
#
# Migration 028: Remove phase-level status fields
#
# Phase-level status (phases.<phase>.status) is legacy. All status tracking
# belongs inside items (phases.<phase>.items.<topic>.status).
#
# For phases with flat status but no items:
#   - Research: backfill items from .md files on disk, mark completed
#   - Other phases: remove the orphaned status (no files to backfill from)
#
# For phases with both flat status and items: just remove the flat status.
#
# Idempotent. Direct node for JSON — never uses manifest CLI.
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"

[ -d "$WORKFLOWS_DIR" ] || return 0

for manifest in "$WORKFLOWS_DIR"/*/manifest.json; do
  [ -f "$manifest" ] || continue

  dir=$(dirname "$manifest")
  wu_name=$(basename "$dir")

  # Skip dot-prefixed directories
  case "$wu_name" in .*) continue ;; esac

  result=$(node -e "
    const fs = require('fs');
    const path = require('path');
    const m = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));

    if (!m.phases || typeof m.phases !== 'object') process.exit(0);

    const manifestDir = path.dirname(process.argv[1]);
    let changed = false;
    const details = [];

    for (const [phase, data] of Object.entries(m.phases)) {
      if (!data || typeof data !== 'object') continue;
      if (!('status' in data)) continue;

      // Phase has a flat status field — remove it
      if (data.items && typeof data.items === 'object' && Object.keys(data.items).length > 0) {
        // Items exist alongside flat status — just remove the flat status
        delete data.status;
        changed = true;
        details.push(phase + ': removed flat status (items exist)');
      } else if (phase === 'research') {
        // Research with flat status but no items — backfill from disk
        const researchDir = path.join(manifestDir, 'research');
        let files = [];
        try {
          files = fs.readdirSync(researchDir).filter(f => f.endsWith('.md')).sort();
        } catch {}

        if (files.length > 0) {
          const items = {};
          for (const file of files) {
            const topic = file.replace(/\\.md\$/, '');
            items[topic] = { status: 'completed' };
          }
          delete data.status;
          data.items = items;
          changed = true;
          details.push('research: backfilled ' + files.length + ' item(s) from disk');
        } else {
          // No files on disk — just remove the orphaned status
          delete data.status;
          changed = true;
          details.push('research: removed orphaned flat status (no files)');
        }
      } else {
        // Other phase with flat status but no items — remove orphaned status
        delete data.status;
        changed = true;
        details.push(phase + ': removed orphaned flat status');
      }

      // Clean up empty phase objects
      if (Object.keys(data).length === 0) {
        delete m.phases[phase];
      }
    }

    if (changed) {
      fs.writeFileSync(process.argv[1], JSON.stringify(m, null, 2) + '\n');
      console.log(details.join('; '));
    }
  " "$manifest" 2>/dev/null) || true

  if [ -n "$result" ]; then
    report_update
  fi
done
