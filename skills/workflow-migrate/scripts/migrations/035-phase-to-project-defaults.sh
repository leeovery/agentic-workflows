#!/bin/bash
#
# Migration 035: Move phase-level format and project_skills to project defaults
#
# Moves phases.planning.format → project.defaults.plan_format
# Moves phases.implementation.project_skills → project.defaults.project_skills
# Removes the phase-level keys from work unit manifests.
#
# Idempotent: skips if phase-level keys don't exist.
# Direct node for JSON — never uses manifest CLI.
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"

[ -d "$WORKFLOWS_DIR" ] || return 0
[ -f "$WORKFLOWS_DIR/manifest.json" ] || return 0

node -e "
const fs = require('fs');
const path = require('path');

const wfDir = '$WORKFLOWS_DIR';
const projPath = path.join(wfDir, 'manifest.json');

// Load project manifest
let proj;
try { proj = JSON.parse(fs.readFileSync(projPath, 'utf8')); } catch { process.exit(0); }
if (!proj.work_units || Object.keys(proj.work_units).length === 0) process.exit(0);

let projUpdated = false;

for (const name of Object.keys(proj.work_units)) {
  const mPath = path.join(wfDir, name, 'manifest.json');
  if (!fs.existsSync(mPath)) continue;

  let m;
  try { m = JSON.parse(fs.readFileSync(mPath, 'utf8')); } catch { continue; }
  if (!m.phases) continue;

  let wuUpdated = false;

  // Migrate phases.planning.format → project.defaults.plan_format
  if (m.phases.planning && m.phases.planning.format !== undefined) {
    if (!proj.defaults) proj.defaults = {};
    if (proj.defaults.plan_format === undefined) {
      proj.defaults.plan_format = m.phases.planning.format;
      projUpdated = true;
    }
    delete m.phases.planning.format;
    wuUpdated = true;
  }

  // Migrate phases.implementation.project_skills → project.defaults.project_skills
  if (m.phases.implementation && m.phases.implementation.project_skills !== undefined) {
    if (!proj.defaults) proj.defaults = {};
    if (proj.defaults.project_skills === undefined) {
      proj.defaults.project_skills = m.phases.implementation.project_skills;
      projUpdated = true;
    }
    delete m.phases.implementation.project_skills;
    wuUpdated = true;
  }

  if (wuUpdated) {
    fs.writeFileSync(mPath, JSON.stringify(m, null, 2) + '\n');
  }
}

if (projUpdated) {
  fs.writeFileSync(projPath, JSON.stringify(proj, null, 2) + '\n');
}

" 2>/dev/null

if [ $? -eq 0 ]; then
  report_update
else
  report_skip
fi
