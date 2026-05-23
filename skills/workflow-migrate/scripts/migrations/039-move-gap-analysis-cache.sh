#!/bin/bash
#
# Migration 039: Move gap_analysis_cache from discussion to inception
#
# Previous location: phases.discussion.gap_analysis_cache
# New location:      phases.inception.gap_analysis_cache (populated on next run)
#
# Also deletes the legacy on-disk cache file at .state/discussion-gap-analysis.md
# if present — analyses now write to .state/inception-gap-analysis.md, so the
# legacy file is dead weight. KB chunks for the old basename are left in place
# (they remain queryable under topic `gap-analysis` until the next analysis run
# replaces them or a `knowledge rebuild` is invoked).
#
# We do NOT copy the manifest cache — its input checksum is computed against a
# new set of inputs (completed research + completed discussion files only, no
# longer including the .state/research-analysis.md file). Carrying the old
# cache would mark valid caches as stale anyway. Absent = absent under the
# existing computeAnalysisCacheStatus logic; analyses repopulate on next run.
#
# Only acts on epic manifests — gap_analysis_cache was epic-only.
# Idempotent: skips manifests with no legacy cache field; safe to re-run after
# the legacy disk file has already been removed.
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

  let updated = false;
  if (Object.prototype.hasOwnProperty.call(discussion, 'gap_analysis_cache')) {
    delete discussion.gap_analysis_cache;
    updated = true;
  }
  if (updated) {
    fs.writeFileSync(mPath, JSON.stringify(m, null, 2) + '\n');
  }

  // Best-effort cleanup of legacy on-disk cache file. No-op if absent.
  const legacyCachePath = path.join(wfDir, entry.name, '.state', 'discussion-gap-analysis.md');
  if (fs.existsSync(legacyCachePath)) {
    try { fs.unlinkSync(legacyCachePath); } catch {}
  }
}
" 2>/dev/null

if [ $? -eq 0 ]; then
  report_update
else
  report_skip
fi
