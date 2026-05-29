#!/bin/bash
#
# Migration 041: Split the overloaded analysis_cycle counter
#
# `analysis_cycle` served two incompatible purposes: findings-file naming
# (analysis-*-c{N}.md — needs to be monotonic across sessions) and the
# escape-hatch threshold (needs to reset per session). Resetting it on resume
# / re-open / conclude broke file naming, causing prior cycles' findings to be
# overwritten. The counter is now split:
#
#   analysis_cycle_total   — monotonic; drives file naming.
#   analysis_cycle_session — resets per session; drives the escape hatch.
#
# Seeding analysis_cycle_total from the stored analysis_cycle value is NOT
# reliable: conclude-implementation reset analysis_cycle to 0 on completion, so
# every completed implementation reports 0 even when analysis-*-c{N}.md files
# exist on disk. The true cycle count is therefore inferred from the findings
# files themselves (the historical record), taking max(stored, highest c{N} on
# disk) so a later re-open numbers the next cycle past the existing files.
#
# This migration walks every work unit's implementation phase items and:
# 1. Renames analysis_cycle → analysis_cycle_total, seeded from disk-inferred
#    count (if total not already present).
# 2. Adds analysis_cycle_session = 0 where missing.
#
# Idempotent: safe to re-run. Items already split are left untouched.
#
# Direct node for JSON — never uses manifest CLI.
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"

[ -d "$WORKFLOWS_DIR" ] || return 0

node -e "
const fs = require('fs');
const path = require('path');

const wfDir = '$WORKFLOWS_DIR';

// Highest N across analysis-*-c{N}.md findings files for a topic, or 0.
function maxCycleOnDisk(wu, topic) {
  const dir = path.join(wfDir, wu, 'implementation', topic);
  let files;
  try { files = fs.readdirSync(dir); } catch { return 0; }
  let max = 0;
  for (const f of files) {
    const m = f.match(/^analysis-.*-c(\d+)\.md\$/);
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  }
  return max;
}

const entries = fs.readdirSync(wfDir, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

  const mPath = path.join(wfDir, entry.name, 'manifest.json');
  if (!fs.existsSync(mPath)) continue;

  let m;
  try { m = JSON.parse(fs.readFileSync(mPath, 'utf8')); } catch { continue; }

  const impl = m.phases && m.phases.implementation;
  if (!impl || !impl.items || typeof impl.items !== 'object') continue;

  let updated = false;

  for (const name of Object.keys(impl.items)) {
    const item = impl.items[name];
    if (!item || typeof item !== 'object') continue;

    const has = (k) => Object.prototype.hasOwnProperty.call(item, k);

    if (has('analysis_cycle')) {
      if (!has('analysis_cycle_total')) {
        const stored = parseInt(item.analysis_cycle, 10) || 0;
        const diskMax = maxCycleOnDisk(entry.name, name);
        item.analysis_cycle_total = Math.max(stored, diskMax);
      }
      delete item.analysis_cycle;
      updated = true;
    }

    if (has('analysis_cycle_total') && !has('analysis_cycle_session')) {
      item.analysis_cycle_session = 0;
      updated = true;
    }
  }

  if (updated) {
    fs.writeFileSync(mPath, JSON.stringify(m, null, 2) + '\n');
  }
}
" 2>/dev/null

if [ $? -eq 0 ]; then
  report_update
else
  report_skip
fi
