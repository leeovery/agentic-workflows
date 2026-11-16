#!/bin/bash
#
# Migration 025: Unify manifest structure — items for all work types
#
# For each feature/bugfix manifest: wrap flat phase-level keys into
# items[manifest.name]. Preserves phase-level keys: analysis_cache, items.
# Skips phases that already have an items key.
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
    const m = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));

    // Only migrate feature and bugfix
    if (m.work_type !== 'feature' && m.work_type !== 'bugfix') process.exit(0);
    if (!m.phases || typeof m.phases !== 'object') process.exit(0);

    const topicName = m.name;
    let changed = false;

    // Phase-level keys to preserve at phase level (not wrap into items)
    const PHASE_LEVEL_KEYS = new Set(['analysis_cache', 'items']);

    for (const [phase, data] of Object.entries(m.phases)) {
      if (!data || typeof data !== 'object') continue;
      // Skip if already has items
      if (data.items) continue;

      // Collect keys to wrap
      const itemData = {};
      const keysToRemove = [];
      for (const [key, val] of Object.entries(data)) {
        if (!PHASE_LEVEL_KEYS.has(key)) {
          itemData[key] = val;
          keysToRemove.push(key);
        }
      }

      // Only wrap if there's something to wrap
      if (keysToRemove.length === 0) continue;

      // Remove wrapped keys from phase level
      for (const key of keysToRemove) {
        delete data[key];
      }

      // Create items structure
      data.items = { [topicName]: itemData };
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(process.argv[1], JSON.stringify(m, null, 2) + '\n');
      console.log('updated');
    }
  " "$manifest" 2>/dev/null) || true

  if [ "$result" = "updated" ]; then
    report_update
  fi
done
