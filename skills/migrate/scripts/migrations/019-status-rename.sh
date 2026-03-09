#!/bin/bash
#
# Migration 019: Rename work unit statuses
#   active   → in-progress
#   archived → cancelled
#   Also: if status is active/in-progress but all phases through review are
#   completed, set to concluded.
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"
MANIFEST="node ${PROJECT_DIR:-.}/.claude/skills/workflow-manifest/scripts/manifest.js"

if [ ! -d "$WORKFLOWS_DIR" ]; then
  exit 0
fi

for dir in "$WORKFLOWS_DIR"/*/; do
  [ -d "$dir" ] || continue
  name=$(basename "$dir")

  # Skip dot-prefixed directories
  [[ "$name" == .* ]] && continue

  [ -f "$dir/manifest.json" ] || continue

  status=$($MANIFEST get "$name" status 2>/dev/null) || continue

  # Rename old statuses
  if [ "$status" = "active" ]; then
    $MANIFEST set "$name" status in-progress 2>/dev/null
    status="in-progress"
    echo "  updated: $dir/manifest.json → in-progress" >&2
  elif [ "$status" = "archived" ]; then
    $MANIFEST set "$name" status cancelled 2>/dev/null
    status="cancelled"
    echo "  updated: $dir/manifest.json → cancelled" >&2
  fi

  # Check if pipeline is fully done but status is still in-progress
  if [ "$status" = "in-progress" ]; then
    work_type=$($MANIFEST get "$name" work_type 2>/dev/null) || continue

    review_done=false

    if [ "$work_type" = "epic" ]; then
      # Epic: check if all review items have status completed
      review_items=$($MANIFEST get "$name" phases.review.items 2>/dev/null) || true
      if [ -n "$review_items" ] && [ "$review_items" != "undefined" ]; then
        all_completed=$(node -e "
          const items = JSON.parse(process.argv[1]);
          const vals = Object.values(items);
          console.log(vals.length > 0 && vals.every(i => i.status === 'completed'));
        " "$review_items" 2>/dev/null) || true
        if [ "$all_completed" = "true" ]; then
          review_done=true
        fi
      fi
    else
      # Feature/bugfix: check flat review status
      review_status=$($MANIFEST get "$name" --phase review status 2>/dev/null) || true
      if [ "$review_status" = "completed" ]; then
        review_done=true
      fi
    fi

    if [ "$review_done" = "true" ]; then
      $MANIFEST set "$name" status concluded 2>/dev/null
      echo "  updated: $dir/manifest.json → concluded" >&2
    fi
  fi
done
