#!/bin/bash
#
# Migration 030: Backfill spec sources from frontmatter into manifests
#
# Migration 016 built manifests from spec file frontmatter using a simple
# key:value parser that can't handle YAML lists. This silently dropped the
# `sources:` field (which is a list of {name, status} objects).
#
# This migration reads sources from each spec file's frontmatter and writes
# them into the manifest as the current object format:
#   sources: { "<name>": { "status": "<status>" } }
#
# Only backfills if the manifest item has no sources but the spec file does.
# Idempotent. Direct node for JSON — never uses manifest CLI.
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"

[ -d "$WORKFLOWS_DIR" ] || return 0

node -e "
const fs = require('fs');
const path = require('path');

const wfDir = '$WORKFLOWS_DIR';
let totalUpdated = 0;

// Parse sources from spec file frontmatter
// Handles: sources:\n  - name: X\n    status: Y
function parseSourcesFromFrontmatter(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return [];
  const fm = fmMatch[1];

  // Find the sources block
  const sourcesIdx = fm.indexOf('sources:');
  if (sourcesIdx === -1) return [];

  const lines = fm.slice(sourcesIdx).split('\n').slice(1); // skip 'sources:' line
  const sources = [];
  let current = null;

  for (const line of lines) {
    // Stop if we hit a non-indented line (next top-level field)
    if (line.match(/^\S/) && line.trim() !== '') break;

    const nameMatch = line.match(/^\s+-\s*name:\s*(.+)/);
    if (nameMatch) {
      if (current) sources.push(current);
      current = { name: nameMatch[1].trim(), status: 'incorporated' };
      continue;
    }

    const statusMatch = line.match(/^\s+status:\s*(.+)/);
    if (statusMatch && current) {
      current.status = statusMatch[1].trim();
    }
  }
  if (current) sources.push(current);

  return sources;
}

const entries = fs.readdirSync(wfDir, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

  const mPath = path.join(wfDir, entry.name, 'manifest.json');
  if (!fs.existsSync(mPath)) continue;

  let m;
  try { m = JSON.parse(fs.readFileSync(mPath, 'utf8')); } catch { continue; }

  const specPhase = (m.phases || {}).specification || {};
  const items = specPhase.items || {};
  let manifestUpdated = false;

  for (const [topic, item] of Object.entries(items)) {
    // Skip if manifest already has sources
    const existingSources = item.sources || {};
    if (typeof existingSources === 'object' && !Array.isArray(existingSources) && Object.keys(existingSources).length > 0) {
      continue;
    }

    // Read from spec file frontmatter
    const specFile = path.join(wfDir, entry.name, 'specification', topic, 'specification.md');
    const fmSources = parseSourcesFromFrontmatter(specFile);
    if (fmSources.length === 0) continue;

    // Write as object format
    item.sources = {};
    for (const src of fmSources) {
      item.sources[src.name] = { status: src.status };
    }
    manifestUpdated = true;
    totalUpdated++;
  }

  if (manifestUpdated) {
    fs.writeFileSync(mPath, JSON.stringify(m, null, 2) + '\n');
  }
}

if (totalUpdated > 0) {
  process.stderr.write('backfilled sources for ' + totalUpdated + ' spec item(s)\n');
}
" 2>&1

if [ $? -eq 0 ]; then
  report_update
else
  report_skip
fi
