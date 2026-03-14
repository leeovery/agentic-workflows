#!/bin/bash
#
# Migration 019: Rename work unit statuses
#   active   → in-progress
#   archived → cancelled
#   Also: if status is active/in-progress but all phases through review are
#   completed, set to concluded.
#
# Note: writes directly to manifest.json — migration scripts must not use
# the manifest CLI, whose validation rules may change over time.
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"

if [ ! -d "$WORKFLOWS_DIR" ]; then
  exit 0
fi

for dir in "$WORKFLOWS_DIR"/*/; do
  [ -d "$dir" ] || continue
  dir="${dir%/}"
  name=$(basename "$dir")

  # Skip dot-prefixed directories
  [[ "$name" == .* ]] && continue

  manifest="$dir/manifest.json"
  [ -f "$manifest" ] || continue

  # Use node to do all work directly on the JSON
  result=$(node -e "
    const fs = require('fs');
    const p = process.argv[1];
    const m = JSON.parse(fs.readFileSync(p, 'utf8'));
    const updates = [];

    // Rename old statuses
    if (m.status === 'active') {
      m.status = 'in-progress';
      updates.push('in-progress');
    } else if (m.status === 'archived') {
      m.status = 'cancelled';
      updates.push('cancelled');
    }

    // Check if pipeline is fully done but status is still in-progress
    if (m.status === 'in-progress' && m.phases) {
      let reviewDone = false;
      const wt = m.work_type;

      if (wt === 'epic') {
        const items = (m.phases.review && m.phases.review.items) || {};
        const vals = Object.values(items);
        if (vals.length > 0 && vals.every(i => i.status === 'completed')) {
          reviewDone = true;
        }
      } else {
        const reviewStatus = m.phases.review && m.phases.review.status;
        if (reviewStatus === 'completed') {
          reviewDone = true;
        }
      }

      if (reviewDone) {
        m.status = 'concluded';
        updates.push('concluded');
      }
    }

    if (updates.length > 0) {
      fs.writeFileSync(p, JSON.stringify(m, null, 2) + '\n');
    }
    console.log(updates.join(','));
  " "$manifest" 2>/dev/null) || true

  if [ -n "$result" ]; then
    echo "  updated: $manifest → $result" >&2
  fi
done
