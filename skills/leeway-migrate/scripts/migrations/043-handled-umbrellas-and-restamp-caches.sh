#!/bin/bash
#
# Migration 043: Mark legacy umbrellas handled + re-stamp valid analysis caches
#
# Two jobs, run in order per epic work unit (Job 1 feeds Job 2):
#
# Job 1 — mark legacy completed-umbrella discovery items `handled`. A
#   migration-seeded research umbrella whose content fanned out into
#   differently-named discussions never matches a same-named discussion, so the
#   map renders it `→ ready for discussion` forever (a false nag). Marking it
#   `handled` makes it terminal on the map without a next action.
#
# Job 2 — re-stamp a *valid* analysis cache for past-discovery epics. A prior
#   migration cleared analysis caches without re-stamping, so finished epics read
#   "no cache → stale → one pointless forced analysis run" on re-open. Stamping a
#   valid cache (byte-matching the read side in discovery-utils.cjs) stops the
#   re-fire. Only when the cache is currently absent — a present cache, even a
#   stale one, is never clobbered.
#
# Idempotent: Job 1 skips already-handled items; Job 2 skips present caches and
# only writes when something changed. Only epics; only migration-seeded
# umbrellas; honours phases.discovery.dismissed[]; in-discovery epics keep an
# absent cache (they still run once, behind the boot-time gate).
#
# Point-in-time snapshot: inline node reading/writing manifest.json directly.
# Never uses the manifest CLI or requires discovery-utils.cjs.
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"

[ -d "$WORKFLOWS_DIR" ] || return 0

result=$(node -e "
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const wfDir = '$WORKFLOWS_DIR';

function fileExists(p) { try { fs.accessSync(p); return true; } catch { return false; } }

function md5(paths) {
  const hash = crypto.createHash('md5');
  for (const p of paths) {
    try { hash.update(fs.readFileSync(p)); } catch {}
  }
  return hash.digest('hex');
}

function itemsOf(phase) {
  return (phase && phase.items && typeof phase.items === 'object') ? phase.items : {};
}

const now = new Date().toISOString();
let changedAny = false;

let entries;
try { entries = fs.readdirSync(wfDir, { withFileTypes: true }); } catch { entries = []; }

for (const entry of entries) {
  if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

  const wuDir = path.join(wfDir, entry.name);
  const mPath = path.join(wuDir, 'manifest.json');
  if (!fs.existsSync(mPath)) continue;

  let m;
  try { m = JSON.parse(fs.readFileSync(mPath, 'utf8')); } catch { continue; }
  if (m.work_type !== 'epic') continue;

  m.phases = m.phases || {};
  const phases = m.phases;
  phases.discovery = phases.discovery || {};
  const discovery = phases.discovery;

  const discoveryItems = itemsOf(discovery);
  const dismissed = Array.isArray(discovery.dismissed) ? discovery.dismissed : [];
  const researchItems = itemsOf(phases.research);
  const discussionItems = itemsOf(phases.discussion);

  let updated = false;

  // --- Job 1: mark legacy completed umbrellas handled ---

  const hasOtherCompletedDiscussion = Object.keys(discussionItems)
    .some(n => (discussionItems[n] || {}).status === 'completed');

  const justHandled = {};
  for (const name of Object.keys(discoveryItems)) {
    const item = discoveryItems[name] || {};
    if (item.handled === true) continue;
    const source = typeof item.source === 'string' ? item.source : '';
    if (source.indexOf('migration-seeded') === -1) continue;
    if (item.routing !== 'research') continue;
    const r = researchItems[name];
    if (!r || r.status !== 'completed') continue;
    if (!fileExists(path.join(wuDir, 'research', name + '.md'))) continue;
    const sameNamed = discussionItems[name];
    if (sameNamed && sameNamed.status === 'completed') continue;
    if (!hasOtherCompletedDiscussion) continue;
    if (dismissed.indexOf(name) !== -1) continue;
    item.handled = true;
    justHandled[name] = true;
    updated = true;
  }

  // --- Job 2: re-stamp valid caches for past-discovery epics ---

  // discoveryQuiescent: every discovery item resolves to a terminal lifecycle.
  // Mirrors computeTopicLifecycle's branch order inline, treating a just-handled
  // or already-handled item as terminal first.
  let discoveryQuiescent = true;
  for (const name of Object.keys(discoveryItems)) {
    const item = discoveryItems[name] || {};
    if (justHandled[name] || item.handled === true) continue; // handled
    const r = researchItems[name];
    const d = discussionItems[name];
    const rs = r ? r.status : null;
    const ds = d ? d.status : null;
    if (ds === 'completed') continue;                          // decided
    if (rs === 'cancelled' && ds === 'cancelled') continue;    // cancelled
    discoveryQuiescent = false;
    break;
  }

  // pastPlanning: at least one non-cancelled, non-superseded item in planning,
  // implementation, or review. Spec is not a stop — the planning floor.
  let pastPlanning = false;
  for (const ph of ['planning', 'implementation', 'review']) {
    const items = itemsOf(phases[ph]);
    for (const n of Object.keys(items)) {
      const st = (items[n] || {}).status;
      if (st !== 'cancelled' && st !== 'superseded') { pastPlanning = true; break; }
    }
    if (pastPlanning) break;
  }

  if (discoveryQuiescent && pastPlanning) {
    // research cache — completed research files on disk, sorted by full path.
    const researchCache = phases.research && phases.research.analysis_cache;
    if (!researchCache || !researchCache.checksum) {
      const files = [];
      for (const n of Object.keys(researchItems)) {
        if ((researchItems[n] || {}).status !== 'completed') continue;
        const fp = path.join(wuDir, 'research', n + '.md');
        if (fileExists(fp)) files.push(fp);
      }
      files.sort();
      if (files.length > 0) {
        phases.research = phases.research || {};
        phases.research.analysis_cache = {
          checksum: md5(files),
          generated: now,
          files: files.map(f => path.basename(f)).sort(),
        };
        updated = true;
      }
    }

    // gap cache — completed research + completed discussion files merged then
    // sorted by full path (read side sorts the combined list).
    const gapCache = discovery.gap_analysis_cache;
    if (!gapCache || !gapCache.checksum) {
      const researchFiles = [];
      for (const n of Object.keys(researchItems)) {
        if ((researchItems[n] || {}).status !== 'completed') continue;
        const fp = path.join(wuDir, 'research', n + '.md');
        if (fileExists(fp)) researchFiles.push(fp);
      }
      const discussionFiles = [];
      for (const n of Object.keys(discussionItems)) {
        if ((discussionItems[n] || {}).status !== 'completed') continue;
        const fp = path.join(wuDir, 'discussion', n + '.md');
        if (fileExists(fp)) discussionFiles.push(fp);
      }
      const inputs = researchFiles.concat(discussionFiles);
      inputs.sort();
      if (inputs.length > 0) {
        discovery.gap_analysis_cache = {
          checksum: md5(inputs),
          generated: now,
          input_files: inputs.map(f => path.basename(f)).sort(),
        };
        updated = true;
      }
    }
  }

  if (updated) {
    fs.writeFileSync(mPath, JSON.stringify(m, null, 2) + '\n');
    changedAny = true;
  }
}

if (changedAny) console.log('changed');
" 2>/dev/null) || true

if [ "$result" = "changed" ]; then
  report_update
else
  report_skip
fi

return 0
