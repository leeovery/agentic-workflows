#!/bin/bash
#
# Migration 040: Heal-forward cleanup of premature inception items
#
# v0.4.0 shipped a buggy research-analysis that fired on in-progress research
# files and wrote category-error inception items (broad domain decomposition
# mis-labelled as derived discussion candidates, hardcoded to routing:
# discussion). This migration removes the orphan items.
#
# For each in-progress epic, walk phases.inception.items. For items whose
# `source` field contains "research-analysis":
#
#   SKIP if a sibling phases.research.items.{name} exists.
#   SKIP if a sibling phases.discussion.items.{name} exists.
#   SKIP if any downstream phase has an item for this topic
#         (specification, planning, implementation, review).
#   Otherwise: delete the inception item.
#
# Do NOT add to phases.inception.dismissed[] — these topics may legitimately
# re-surface via the corrected analyses once research/discussion completes.
#
# Idempotent: once items are removed they stay removed.
#
# Direct node for JSON — never uses manifest CLI.
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"

[ -d "$WORKFLOWS_DIR" ] || return 0

node -e "
const fs = require('fs');
const path = require('path');

const wfDir = '$WORKFLOWS_DIR';
const DOWNSTREAM = ['specification', 'planning', 'implementation', 'review'];

const entries = fs.readdirSync(wfDir, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

  const mPath = path.join(wfDir, entry.name, 'manifest.json');
  if (!fs.existsSync(mPath)) continue;

  let m;
  try { m = JSON.parse(fs.readFileSync(mPath, 'utf8')); } catch { continue; }

  if (m.work_type !== 'epic') continue;
  if (m.status !== 'in-progress') continue;

  const phases = m.phases || {};
  const inception = phases.inception || {};
  const items = inception.items || {};

  const research = (phases.research && phases.research.items) || {};
  const discussion = (phases.discussion && phases.discussion.items) || {};

  let manifestUpdated = false;
  for (const [name, item] of Object.entries(items)) {
    const src = (item && item.source) || '';
    if (!src.includes('research-analysis')) continue;

    if (research[name]) continue;
    if (discussion[name]) continue;

    let hasDownstream = false;
    for (const phase of DOWNSTREAM) {
      const pData = phases[phase];
      if (pData && pData.items && pData.items[name]) {
        hasDownstream = true;
        break;
      }
    }
    if (hasDownstream) continue;

    delete items[name];
    manifestUpdated = true;
  }

  if (manifestUpdated) {
    fs.writeFileSync(mPath, JSON.stringify(m, null, 2) + '\n');
  }
}
" 2>/dev/null

if [ $? -eq 0 ]; then
  report_update
else
  report_skip
fi
