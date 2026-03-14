#!/bin/bash
#
# Migration 020: Normalise terminal status
#   concluded → completed for all phase statuses and work unit status.
#   Implementation and review already use completed — this brings
#   research, discussion, investigation, specification, and planning
#   into alignment, along with work unit status.
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

  # Use node to do all replacements atomically
  updated=$(node -e "
    const fs = require('fs');
    const manifest = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    let changed = false;

    // Update work unit status
    if (manifest.status === 'concluded') {
      manifest.status = 'completed';
      changed = true;
    }

    // Update phase statuses
    if (manifest.phases) {
      for (const [phase, data] of Object.entries(manifest.phases)) {
        if (!data) continue;

        // Flat phase status
        if (data.status === 'concluded') {
          data.status = 'completed';
          changed = true;
        }

        // Item-level statuses (epic)
        if (data.items) {
          for (const [topic, item] of Object.entries(data.items)) {
            if (item && item.status === 'concluded') {
              item.status = 'completed';
              changed = true;
            }
          }
        }
      }
    }

    if (changed) {
      console.log('changed');
      fs.writeFileSync(process.argv[1], JSON.stringify(manifest, null, 2) + '\n');
    }
  " "$manifest" 2>/dev/null) || true

  if [ "$updated" = "changed" ]; then
    echo "  updated: $manifest → concluded to completed" >&2
  fi
done
