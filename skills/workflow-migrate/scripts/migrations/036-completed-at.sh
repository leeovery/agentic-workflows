#!/bin/bash
#
# Migration 036: Backfill completed_at on completed work units
#
# Scans work unit manifests. For each with status=completed and no
# completed_at, finds the latest artifact mtime across all phases and
# sets completed_at to that date (YYYY-MM-DD).
#
# Idempotent: skips if completed_at already exists or status != completed.
# Direct node for JSON — never uses manifest CLI.
# Bash 3.2 compatible (no mapfile, declare -A, local -n).
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"

[ -d "$WORKFLOWS_DIR" ] || return 0

node -e "
const fs = require('fs');
const path = require('path');

const wfDir = process.argv[1];
const entries = fs.readdirSync(wfDir, { withFileTypes: true });

function latestMtime(dir) {
  let latest = 0;
  function walk(d) {
    let items;
    try { items = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const item of items) {
      if (item.name === 'manifest.json' || item.name.startsWith('.')) continue;
      const full = path.join(d, item.name);
      if (item.isDirectory()) {
        walk(full);
      } else if (item.isFile()) {
        try {
          const st = fs.statSync(full);
          if (st.mtimeMs > latest) latest = st.mtimeMs;
        } catch { /* skip unreadable files */ }
      }
    }
  }
  walk(dir);
  return latest;
}

function toISODate(ms) {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

for (const entry of entries) {
  if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

  const mPath = path.join(wfDir, entry.name, 'manifest.json');
  if (!fs.existsSync(mPath)) continue;

  let m;
  try { m = JSON.parse(fs.readFileSync(mPath, 'utf8')); } catch { continue; }

  if (m.status !== 'completed') continue;
  if (m.completed_at !== undefined && m.completed_at !== null) continue;

  // Find latest mtime across all artifact files in this work unit dir.
  const wuDir = path.join(wfDir, entry.name);
  const latest = latestMtime(wuDir);

  if (latest === 0) {
    // No files found — skip (do not set a bogus date).
    continue;
  }

  m.completed_at = toISODate(latest);
  fs.writeFileSync(mPath, JSON.stringify(m, null, 2) + '\n');
}
" "$WORKFLOWS_DIR" 2>/dev/null

if [ $? -eq 0 ]; then
  report_update
else
  report_skip
fi
