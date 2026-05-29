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
#   analysis_cycle_total   — monotonic; drives file naming. Seeded from the old
#                            analysis_cycle value (preserves existing numbering).
#   analysis_cycle_session — resets per session; drives the escape hatch.
#                            Seeded to 0.
#
# This migration walks every work unit's implementation phase items and:
# 1. Renames analysis_cycle → analysis_cycle_total (if not already present).
# 2. Adds analysis_cycle_session = 0 where missing.
#
# Idempotent: safe to re-run. Items with no analysis_cycle and already-present
# split fields are left untouched.
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

  const impl = m.phases && m.phases.implementation;
  if (!impl || !impl.items || typeof impl.items !== 'object') continue;

  let updated = false;

  for (const name of Object.keys(impl.items)) {
    const item = impl.items[name];
    if (!item || typeof item !== 'object') continue;

    const has = (k) => Object.prototype.hasOwnProperty.call(item, k);

    if (has('analysis_cycle')) {
      if (!has('analysis_cycle_total')) {
        item.analysis_cycle_total = item.analysis_cycle;
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
