#!/bin/bash
#
# Migration 038: Seed discovery-map inception phase for legacy epics
#
# Walks in-progress epic manifests that pre-date the inception phase and
# seeds phases.inception.items.* from existing research and discussion items.
# Per-topic idempotent.
#
# Routing rules (research wins on dedup):
#   - topic in research items           → routing: research
#   - topic in discussion items only    → routing: discussion
#   - topic in both                     → routing: research (single item)
#
# Every migrated item gets source: migration-seeded. No summary field —
# downstream legacy-recovery flow derives summaries from the source files.
#
# The legacy phases.research.surfaced_topics and phases.discussion.gap_topics
# arrays are intentionally NOT migrated. Those are just topic names with no
# context. Topic-discovery analyses re-run on next continue-epic and
# surface fresh themes with proper summaries from current source content.
# The arrays sit on disk as inert legacy data.
#
# Also back-fills a placeholder session-001.md so the inception session
# numbering picks up at session-002 on next entry (rather than re-using 001).
#
# Non-destructive: no file moves, no content rewrites. Skips non-epic and
# non-in-progress work units.
#
# Idempotent. Direct node for JSON — never uses manifest CLI.
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

  // Only in-progress epics — non-epics have no discovery map; completed and
  // cancelled epics are left alone (reactivation re-runs migrations later).
  if (m.work_type !== 'epic') continue;
  if (m.status !== 'in-progress') continue;

  const phases = m.phases || {};
  const researchItems = (phases.research && phases.research.items) || {};
  const discussionItems = (phases.discussion && phases.discussion.items) || {};

  // Collect topic names from both sources; track which phase each topic appears in
  const topics = {};
  for (const name of Object.keys(researchItems)) {
    topics[name] = topics[name] || { research: false, discussion: false };
    topics[name].research = true;
  }
  for (const name of Object.keys(discussionItems)) {
    topics[name] = topics[name] || { research: false, discussion: false };
    topics[name].discussion = true;
  }

  if (Object.keys(topics).length === 0) continue;

  // Resolve routing — research wins on dedup
  const toAdd = {};
  for (const [name, src] of Object.entries(topics)) {
    toAdd[name] = {
      status: 'in-progress',
      routing: src.research ? 'research' : 'discussion',
      source: 'migration-seeded',
    };
  }

  // Per-topic idempotency: only add topics that don't already exist
  if (!m.phases) m.phases = {};
  if (!m.phases.inception) m.phases.inception = {};
  if (!m.phases.inception.items) m.phases.inception.items = {};

  let manifestUpdated = false;
  for (const [name, item] of Object.entries(toAdd)) {
    if (m.phases.inception.items[name]) continue;
    m.phases.inception.items[name] = item;
    manifestUpdated = true;
  }

  if (manifestUpdated) {
    fs.writeFileSync(mPath, JSON.stringify(m, null, 2) + '\n');
  }

  // Back-fill session-001.md if missing — gives the migrated epic a
  // concluded-style session-001 so the next inception entry opens session-002.
  const incDir = path.join(wfDir, entry.name, 'inception');
  const sessionPath = path.join(incDir, 'session-001.md');
  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(incDir, { recursive: true });
    const count = Object.keys(toAdd).length;
    const lines = [];
    lines.push('# Initial Framing — Pre-Inception Migration');
    lines.push('');
    lines.push('This work unit pre-dates the discovery-map system. The map was seeded');
    lines.push('from ' + count + ' topic(s) found in existing research/discussion items (source: migration-seeded).');
    lines.push('');
    lines.push('Open the epic via \`/workflow-start\` — the legacy-recovery flow will');
    lines.push('draft summaries from the existing source files and present them for review.');
    lines.push('');
    fs.writeFileSync(sessionPath, lines.join('\n'));
  }
}
" 2>/dev/null

if [ $? -eq 0 ]; then
  report_update
else
  report_skip
fi
