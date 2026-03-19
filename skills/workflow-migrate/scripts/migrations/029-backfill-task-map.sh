#!/bin/bash
#
# Migration 029: Backfill task_map from existing plan index files
#
# Parses planning.md files for Internal ID ↔ External ID mappings from:
#   1. Task tables: | Internal ID | ... | External ID |
#   2. Phase headers: external_id: {value}
#
# Writes all mappings to task_map in the manifest.
# Skips entries where External ID is empty (not yet authored).
# Skips if task_map already exists in the manifest (idempotent).
#
# Also migrates cache directory structure:
#   Old: .workflows/.cache/planning/{work_unit}/{topic}/
#   New: .workflows/.cache/{work_unit}/planning/{topic}/
#
# Idempotent. Direct node for JSON — never uses manifest CLI.
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"
CACHE_DIR="$WORKFLOWS_DIR/.cache"

[ -d "$WORKFLOWS_DIR" ] || return 0

# --- Part 1: Backfill task_map from plan index files ---

for manifest in "$WORKFLOWS_DIR"/*/manifest.json; do
  [ -f "$manifest" ] || continue

  dir=$(dirname "$manifest")
  wu_name=$(basename "$dir")

  # Skip dot-prefixed directories
  case "$wu_name" in .*) continue ;; esac

  planning_dir="$dir/planning"
  [ -d "$planning_dir" ] || continue

  for plan_file in "$planning_dir"/*/planning.md; do
    [ -f "$plan_file" ] || continue

    topic=$(basename "$(dirname "$plan_file")")

    result=$(node -e "
      const fs = require('fs');
      const m = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
      const planContent = fs.readFileSync(process.argv[2], 'utf8');
      const topic = process.argv[3];

      // Check if task_map already exists
      const phase = ((m.phases || {}).planning || {}).items || {};
      const topicData = phase[topic];
      if (!topicData) process.exit(0);
      if (topicData.task_map && Object.keys(topicData.task_map).length > 0) {
        console.log('SKIP');
        process.exit(0);
      }

      const taskMap = {};

      // Parse task table rows line-by-line
      // Only match rows with exactly 5 data columns (6 pipes): | Internal ID | Name | Edge Cases | Status | External ID |
      const lines = planContent.split('\\n');
      for (const line of lines) {
        const cells = line.split('|').map(c => c.trim());
        // A 5-column table row has 7 parts when split by | (empty before first pipe, 5 cells, empty after last pipe)
        if (cells.length < 7) continue;
        const internalId = cells[1];
        const externalId = cells[5];
        // Skip header and separator rows
        if (!internalId || internalId === 'Internal ID' || internalId === 'ID' || internalId.startsWith('-')) continue;
        if (!externalId || externalId.startsWith('-')) continue;
        taskMap[internalId] = externalId;
      }

      // Parse phase-level external_id fields
      let currentPhaseId = null;
      for (const line of lines) {
        // Match phase headers: ### Phase {N}: {Name}
        const phaseMatch = line.match(/^###\\s+Phase\\s+(\\d+):/);
        if (phaseMatch) {
          currentPhaseId = topic + '-' + phaseMatch[1];
        }
        // Match external_id field
        const extMatch = line.match(/^external_id:\\s*(.+)/);
        if (extMatch && currentPhaseId) {
          const extId = extMatch[1].trim();
          if (extId) {
            taskMap[currentPhaseId] = extId;
          }
        }
      }

      if (Object.keys(taskMap).length === 0) process.exit(0);

      topicData.task_map = taskMap;
      fs.writeFileSync(process.argv[1], JSON.stringify(m, null, 2) + '\\n');
      console.log(Object.keys(taskMap).length);
    " "$manifest" "$plan_file" "$topic" 2>/dev/null) || true

    if [ "$result" = "SKIP" ]; then
      report_skip
    elif [ -n "$result" ]; then
      report_update "$wu_name/$topic: migrated $result entries to task_map"
    fi
  done
done

# --- Part 2: Migrate cache directory structure ---

if [ -d "$CACHE_DIR/planning" ]; then
  for wu_dir in "$CACHE_DIR/planning"/*/; do
    [ -d "$wu_dir" ] || continue
    wu_name=$(basename "$wu_dir")

    for topic_dir in "$wu_dir"*/; do
      [ -d "$topic_dir" ] || continue
      topic=$(basename "$topic_dir")

      new_dir="$CACHE_DIR/$wu_name/planning/$topic"
      if [ -d "$new_dir" ]; then
        report_skip
        continue
      fi

      mkdir -p "$new_dir"
      cp -r "$topic_dir"* "$new_dir/" 2>/dev/null || true
      rm -rf "$topic_dir"
      report_update "$wu_name/$topic: moved cache to new structure"
    done

    # Clean up empty wu_dir
    rmdir "$wu_dir" 2>/dev/null || true
  done

  # Clean up empty planning dir
  rmdir "$CACHE_DIR/planning" 2>/dev/null || true
fi
