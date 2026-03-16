#!/bin/bash
#
# Migration 023: Clear old-format research analysis caches
#   The analysis cache format has changed (no more line numbers or key questions).
#   This migration:
#   1. Deletes .state/research-analysis.md files from all work units
#   2. Removes analysis_cache from manifest phases.research so discovery
#      doesn't think a valid cache exists when the file is gone
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"

[ -d "$WORKFLOWS_DIR" ] || exit 0

# --- Step 1: Delete old-format .state/research-analysis.md files ---

for state_file in "$WORKFLOWS_DIR"/*/.state/research-analysis.md; do
  [ -f "$state_file" ] || continue
  rm "$state_file"
  report_update
done

# --- Step 2: Clear analysis_cache from manifests ---

for manifest in "$WORKFLOWS_DIR"/*/manifest.json; do
  [ -f "$manifest" ] || continue

  # Skip dot-prefixed directories
  dir_name=$(basename "$(dirname "$manifest")")
  case "$dir_name" in .*) continue ;; esac

  result=$(node -e "
    const fs = require('fs');
    const m = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    if (m.phases && m.phases.research && m.phases.research.analysis_cache) {
      delete m.phases.research.analysis_cache;
      fs.writeFileSync(process.argv[1], JSON.stringify(m, null, 2) + '\n');
      console.log('cleared');
    }
  " "$manifest" 2>/dev/null) || true

  if [ "$result" = "cleared" ]; then
    report_update
  fi
done
