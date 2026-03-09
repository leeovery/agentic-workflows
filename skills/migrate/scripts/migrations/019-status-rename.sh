#!/bin/bash
#
# Migration 019: Rename work unit statuses
#   active   → in-progress
#   archived → cancelled
#   Also: if status is active/in-progress but all phases through review are
#   completed, set to concluded.
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"

if [ ! -d "$WORKFLOWS_DIR" ]; then
  exit 0
fi

for manifest in "$WORKFLOWS_DIR"/*/manifest.json; do
  [ -f "$manifest" ] || continue

  node -e "
    const fs = require('fs');
    const f = process.argv[1];
    const m = JSON.parse(fs.readFileSync(f, 'utf8'));
    let changed = false;

    // Rename statuses
    if (m.status === 'active') {
      m.status = 'in-progress';
      changed = true;
    } else if (m.status === 'archived') {
      m.status = 'cancelled';
      changed = true;
    }

    // Check if pipeline is fully done (review completed) but status is still in-progress
    if (m.status === 'in-progress' && m.phases) {
      const wt = m.work_type;
      let reviewDone = false;

      if (wt === 'epic') {
        const items = (m.phases.review && m.phases.review.items) || {};
        const vals = Object.values(items);
        if (vals.length > 0 && vals.every(i => i.status === 'completed')) {
          reviewDone = true;
        }
      } else {
        if (m.phases.review && m.phases.review.status === 'completed') {
          reviewDone = true;
        }
      }

      if (reviewDone) {
        m.status = 'concluded';
        changed = true;
      }
    }

    if (changed) {
      fs.writeFileSync(f, JSON.stringify(m, null, 2) + '\n');
      process.stderr.write('  updated: ' + f + ' → ' + m.status + '\n');
    }
  " "$manifest"
done
