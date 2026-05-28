#!/bin/bash
#
# Migration 040: Rename inception phase to discovery
#
# The first phase of an epic was renamed from "inception" to "discovery" to
# align the phase name with the artifact it builds (the discovery map) and to
# resolve the awkwardness of re-entering an "inception" phase repeatedly.
#
# This migration:
# 1. Renames phases.inception → phases.discovery in every manifest (subtree
#    moves verbatim — items, dismissed[], active_session, gap_analysis_cache,
#    legacy_split_state, etc.)
# 2. Rewrites source provenance values from 'inception' → 'discovery' on each
#    item's source field (handles multi-source comma-accumulated values like
#    'inception,research-analysis').
# 3. Renames .workflows/{wu}/inception/ directory → .workflows/{wu}/discovery/.
# 4. Renames .workflows/{wu}/.state/inception-gap-analysis.md →
#    discovery-gap-analysis.md.
#
# Idempotent: safe to re-run. Walks all work units, not just epics — the field
# is epic-only in practice but we don't gate on work_type.
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

  const wuDir = path.join(wfDir, entry.name);
  const mPath = path.join(wuDir, 'manifest.json');
  if (fs.existsSync(mPath)) {
    let m;
    try { m = JSON.parse(fs.readFileSync(mPath, 'utf8')); } catch { m = null; }

    if (m && m.phases) {
      let updated = false;

      if (Object.prototype.hasOwnProperty.call(m.phases, 'inception')) {
        const merged = Object.assign({}, m.phases.inception, m.phases.discovery || {});
        m.phases.discovery = merged;
        delete m.phases.inception;
        updated = true;
      }

      const disc = m.phases.discovery;
      if (disc && disc.items && typeof disc.items === 'object') {
        for (const name of Object.keys(disc.items)) {
          const item = disc.items[name];
          if (item && typeof item.source === 'string' && item.source.length) {
            const parts = item.source.split(',').map(p => p === 'inception' ? 'discovery' : p);
            const next = parts.join(',');
            if (next !== item.source) {
              item.source = next;
              updated = true;
            }
          }
        }
      }

      if (updated) {
        fs.writeFileSync(mPath, JSON.stringify(m, null, 2) + '\n');
      }
    }
  }

  // Rename inception/ directory to discovery/. If discovery/ already exists
  // (partial prior run), leave inception/ alone — admin must reconcile.
  const incDir = path.join(wuDir, 'inception');
  const discDir = path.join(wuDir, 'discovery');
  if (fs.existsSync(incDir) && !fs.existsSync(discDir)) {
    try { fs.renameSync(incDir, discDir); } catch {}
  }

  // Rename state cache file.
  const oldCache = path.join(wuDir, '.state', 'inception-gap-analysis.md');
  const newCache = path.join(wuDir, '.state', 'discovery-gap-analysis.md');
  if (fs.existsSync(oldCache) && !fs.existsSync(newCache)) {
    try { fs.renameSync(oldCache, newCache); } catch {}
  }
}
" 2>/dev/null

if [ $? -eq 0 ]; then
  report_update
else
  report_skip
fi
