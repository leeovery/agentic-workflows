#!/bin/bash
#
# Migration 038: Drop surfaced_topics and gap_topics from manifests
#
# Phase 7 re-points research-analysis and gap-analysis to write inception
# items directly via phases.inception.items.{topic} with source provenance.
# The legacy phases.research.surfaced_topics and phases.discussion.gap_topics
# arrays are no longer consumed (continue-epic, discussion-entry, refinement
# all read inception items now). Leaving them in the manifest is confusing
# for anyone reading raw JSON.
#
# This migration deletes those two fields if present. The cache fields
# (analysis_cache, gap_analysis_cache) stay — they are still valid; only the
# topic-list output redirects.
#
# Idempotent (no-op when fields are absent). Bash 3.2 compatible.
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"

[ -d "$WORKFLOWS_DIR" ] || return 0

for manifest in "$WORKFLOWS_DIR"/*/manifest.json; do
  [ -f "$manifest" ] || continue

  dir_name=$(basename "$(dirname "$manifest")")
  case "$dir_name" in .*) continue ;; esac

  result=$(node -e "
    const fs = require('fs');
    const m = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    let changed = false;
    if (m.phases && m.phases.research && Object.prototype.hasOwnProperty.call(m.phases.research, 'surfaced_topics')) {
      delete m.phases.research.surfaced_topics;
      changed = true;
    }
    if (m.phases && m.phases.discussion && Object.prototype.hasOwnProperty.call(m.phases.discussion, 'gap_topics')) {
      delete m.phases.discussion.gap_topics;
      changed = true;
    }
    if (changed) {
      fs.writeFileSync(process.argv[1], JSON.stringify(m, null, 2) + '\n');
      console.log('cleared');
    }
  " "$manifest" 2>/dev/null) || true

  if [ "$result" = "cleared" ]; then
    report_update
  fi
done
