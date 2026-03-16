#!/bin/bash
#
# Migration 021: Rename feature research exploration.md to {work_unit}.md
#   Feature research files should use the work unit name as the filename,
#   consistent with how all other phases use topic = work_unit for features.
#   Epic exploration files keep their exploration.md name.
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

  # Check if this is a feature work unit
  work_type=$(node -e "
    const fs = require('fs');
    const m = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    console.log(m.work_type || '');
  " "$manifest" 2>/dev/null) || continue

  if [ "$work_type" != "feature" ]; then
    continue
  fi

  exploration="$dir/research/exploration.md"
  target="$dir/research/${name}.md"

  if [ ! -f "$exploration" ]; then
    continue
  fi

  # Don't rename if target already exists
  if [ -f "$target" ]; then
    report_skip
    continue
  fi

  mv "$exploration" "$target"
  report_update
done
