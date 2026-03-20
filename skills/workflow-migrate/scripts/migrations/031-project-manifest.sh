#!/bin/bash
#
# Migration 030: Build project manifest from existing work units
#
# Scans .workflows/*/manifest.json and builds .workflows/manifest.json
# with { "work_units": { "<name>": { "work_type": "<type>" } } }.
#
# Idempotent: skips if project manifest already contains all work units.
# Direct node for JSON — never uses manifest CLI.
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"

[ -d "$WORKFLOWS_DIR" ] || return 0

node -e "
const fs = require('fs');
const path = require('path');

const wfDir = '$WORKFLOWS_DIR';
const projPath = path.join(wfDir, 'manifest.json');

// Load existing project manifest if present
let proj = {};
if (fs.existsSync(projPath)) {
  try { proj = JSON.parse(fs.readFileSync(projPath, 'utf8')); } catch {}
}
if (!proj.work_units) proj.work_units = {};

let updated = false;

// Scan work unit directories
const entries = fs.readdirSync(wfDir, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

  const mPath = path.join(wfDir, entry.name, 'manifest.json');
  if (!fs.existsSync(mPath)) continue;

  let m;
  try { m = JSON.parse(fs.readFileSync(mPath, 'utf8')); } catch { continue; }

  if (!m.name || !m.work_type) continue;

  // Skip if already registered with correct type
  if (proj.work_units[m.name] && proj.work_units[m.name].work_type === m.work_type) continue;

  proj.work_units[m.name] = { work_type: m.work_type };
  updated = true;
}

if (updated) {
  fs.writeFileSync(projPath, JSON.stringify(proj, null, 2) + '\n');
}
" 2>/dev/null

if [ $? -eq 0 ]; then
  if [ -f "$WORKFLOWS_DIR/manifest.json" ]; then
    report_update
  else
    report_skip
  fi
else
  report_skip
fi
