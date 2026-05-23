#!/bin/bash
#
# Migration 039: Move gap_analysis_cache from discussion to inception
#
# Previous location: phases.discussion.gap_analysis_cache
# New location:      phases.inception.gap_analysis_cache (populated on next run)
#
# We do NOT copy the cache — its input checksum is computed against a new
# set of inputs (completed research + completed discussion files only,
# no longer including the .state/research-analysis.md file). Carrying the
# old cache would mark valid caches as stale anyway. Absent = absent under
# the existing computeAnalysisCacheStatus logic; analyses repopulate on
# next run.
#
# Only acts on epic manifests — gap_analysis_cache was epic-only.
# Idempotent: skips manifests with no legacy cache field.
#
# Direct node for JSON — never uses manifest CLI.
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"

[ -d "$WORKFLOWS_DIR" ] || return 0

node -e "
const fs = require('fs');
const path = require('path');

const wfDir = '$WORKFLOWS_DIR';

const entries = fs.readdirSync(wfDir, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

  const mPath = path.join(wfDir, entry.name, 'manifest.json');
  if (!fs.existsSync(mPath)) continue;

  let m;
  try { m = JSON.parse(fs.readFileSync(mPath, 'utf8')); } catch { continue; }

  if (m.work_type !== 'epic') continue;

  const phases = m.phases || {};
  const discussion = phases.discussion || {};

  if (!Object.prototype.hasOwnProperty.call(discussion, 'gap_analysis_cache')) continue;

  delete discussion.gap_analysis_cache;
  fs.writeFileSync(mPath, JSON.stringify(m, null, 2) + '\n');
}
" 2>/dev/null

if [ $? -eq 0 ]; then
  report_update
else
  report_skip
fi
