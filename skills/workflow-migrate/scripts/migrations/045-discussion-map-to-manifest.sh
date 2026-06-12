#!/bin/bash
#
# Migration 045: Discussion map to manifest
#
# The Discussion Map moved from a section inside the discussion file to typed
# state in the manifest (phases.discussion.items.{topic}.subtopics). For each
# work unit with an in-progress discussion item whose discussion file carries
# a Discussion Map section, parse the subtopic tree rows
# (`├─ ◐ Name [state]`, two-level nesting from the gutter indentation) and
# write them as `subtopics` — kebab-cased keys, `{status, parent}` values.
#
# Idempotent: items that already have `subtopics` are skipped. Defensive:
# the migration must never corrupt a manifest — rows that don't parse cleanly
# are skipped (a child row with no preceding parent is dropped too), and an
# item whose map yields no parseable rows is left untouched. Completed and
# cancelled discussions are skipped entirely (their files stay as-is).
#
# Point-in-time snapshot: inline node reading/writing manifest.json directly.
# Never uses the manifest CLI.
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"

[ -d "$WORKFLOWS_DIR" ] || return 0

result=$(node -e "
const fs = require('fs');
const path = require('path');

const wfDir = '$WORKFLOWS_DIR';

const STATES = ['pending', 'exploring', 'converging', 'decided'];

function kebab(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+\$/g, '');
}

// Extract the '## Discussion Map' section: everything from the heading to the
// next level-2 heading (or EOF).
function mapSection(content) {
  const lines = content.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+Discussion Map\s*\$/.test(lines[i])) { start = i; break; }
  }
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i]) && !/^###/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start + 1, end);
}

// Parse tree rows into ordered {name, status, parent} entries. Returns null
// when no rows parse (parse doubt — leave the item untouched).
function parseRows(sectionLines) {
  const candidates = [];
  for (const line of sectionLines) {
    if (/[┌├└]─/.test(line)) candidates.push(line);
  }
  if (candidates.length === 0) return null;

  // Branch column of each candidate; the minimum is the top level.
  const rows = [];
  let minCol = Infinity;
  for (const line of candidates) {
    const col = line.search(/[┌├└]─/);
    if (col >= 0 && col < minCol) minCol = col;
  }

  const rowRe = /^[\s│]*[┌├└]─\s+(?:[○◐→✓⊙⊘]\s+)?(.+?)\s*\[([a-z-]+)\]\s*\$/;
  const out = [];
  const seen = Object.create(null);
  let lastParent = null;
  for (const line of candidates) {
    const m = line.match(rowRe);
    if (!m) continue;                            // unparseable row — skip it
    const status = m[2];
    if (STATES.indexOf(status) === -1) continue; // unknown state — skip row
    const name = kebab(m[1]);
    if (!name || seen[name]) continue;           // empty or duplicate — skip row
    const col = line.search(/[┌├└]─/);
    const isChild = col > minCol || /│/.test(line.slice(0, col));
    if (isChild) {
      if (!lastParent) continue;                 // child before any parent — skip row
      out.push({ name, status, parent: lastParent });
    } else {
      out.push({ name, status, parent: null });
      lastParent = name;
    }
    seen[name] = true;
  }
  return out.length > 0 ? out : null;
}

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

  const items = m.phases && m.phases.discussion && m.phases.discussion.items;
  if (!items || typeof items !== 'object') continue;

  let updated = false;
  for (const topic of Object.keys(items)) {
    const item = items[topic] || {};
    if (item.status !== 'in-progress') continue;          // completed/cancelled: skip
    if (item.subtopics) continue;                         // already migrated

    const filePath = path.join(wuDir, 'discussion', topic + '.md');
    let content;
    try { content = fs.readFileSync(filePath, 'utf8'); } catch { continue; }

    const section = mapSection(content);
    if (!section) continue;                               // no map section

    const rows = parseRows(section);
    if (!rows) continue;                                  // parse doubt — skip item

    const subtopics = {};
    for (const row of rows) {
      subtopics[row.name] = { status: row.status, parent: row.parent };
    }
    item.subtopics = subtopics;
    updated = true;
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
