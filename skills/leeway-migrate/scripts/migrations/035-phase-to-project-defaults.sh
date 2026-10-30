#!/bin/bash
#
# Migration 035: Remove phase-level format, project_skills, and linters
#
# Removes phases.planning.format, phases.implementation.project_skills,
# and phases.implementation.linters from work unit manifests.
# Project defaults will populate naturally via skill usage going forward.
#
# Idempotent: skips if phase-level keys don't exist.
# Direct node for JSON — never uses manifest CLI.
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"

[ -d "$WORKFLOWS_DIR" ] || return 0

node -e "
const fs = require('fs');
const path = require('path');

const wfDir = '$WORKFLOWS_DIR';

// Scan work unit directories
const entries = fs.readdirSync(wfDir, { withFileTypes: true });
let anyUpdated = false;

for (const entry of entries) {
  if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

  const mPath = path.join(wfDir, entry.name, 'manifest.json');
  if (!fs.existsSync(mPath)) continue;

  let m;
  try { m = JSON.parse(fs.readFileSync(mPath, 'utf8')); } catch { continue; }
  if (!m.phases) continue;

  let updated = false;

  // Remove phases.planning.format
  if (m.phases.planning && m.phases.planning.format !== undefined) {
    delete m.phases.planning.format;
    updated = true;
  }

  // Remove phases.implementation.project_skills
  if (m.phases.implementation && m.phases.implementation.project_skills !== undefined) {
    delete m.phases.implementation.project_skills;
    updated = true;
  }

  // Remove phases.implementation.linters
  if (m.phases.implementation && m.phases.implementation.linters !== undefined) {
    delete m.phases.implementation.linters;
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(mPath, JSON.stringify(m, null, 2) + '\n');
    anyUpdated = true;
  }
}

" 2>/dev/null

if [ $? -eq 0 ]; then
  report_update
else
  report_skip
fi
