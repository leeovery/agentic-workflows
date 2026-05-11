#!/bin/bash
#
# Migration 038: Seed discovery-map inception phase for legacy epics
#
# Walks in-progress epic manifests that pre-date the inception phase and
# seeds phases.inception.items.* from existing research/discussion items
# plus the legacy phases.research.surfaced_topics and
# phases.discussion.gap_topics arrays. Per-topic idempotent.
#
# Topic collection (research-precedence on dedup):
#   - research items                          → routing: research, source: migration-seeded
#   - discussion items (only)                 → routing: discussion, source: migration-seeded
#   - surfaced_topics (only, no phase item)   → routing: discussion, source: migration-seeded:research-analysis
#   - gap_topics (only, no phase item)        → routing: discussion, source: migration-seeded:gap-analysis
#
# Also back-fills a placeholder session-001.md so refinement-session's
# numbering logic ("Initial Framing" assumption at session-001) holds.
#
# Non-destructive: legacy surfaced_topics / gap_topics arrays stay in place
# (a later migration drops them as part of the larger refactor). No file
# moves, no content rewrites. Skips non-epic and non-in-progress work units.
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
  const surfaced = Array.isArray(phases.research && phases.research.surfaced_topics)
    ? phases.research.surfaced_topics
    : [];
  const gaps = Array.isArray(phases.discussion && phases.discussion.gap_topics)
    ? phases.discussion.gap_topics
    : [];

  // Build per-topic provenance set
  const topics = {};
  function ensure(name) {
    if (!topics[name]) topics[name] = { research: false, discussion: false, surfaced: false, gap: false };
    return topics[name];
  }
  for (const name of Object.keys(researchItems)) ensure(name).research = true;
  for (const name of Object.keys(discussionItems)) ensure(name).discussion = true;
  for (const name of surfaced) ensure(name).surfaced = true;
  for (const name of gaps) ensure(name).gap = true;

  // Counts for session-001 back-fill (only items the migration would create)
  let phaseItemCount = 0;
  let surfacedOnlyCount = 0;
  let gapOnlyCount = 0;

  // Resolve routing + source for each topic (phase items win over legacy arrays)
  const toAdd = {};
  for (const [name, src] of Object.entries(topics)) {
    let routing, source;
    if (src.research || src.discussion) {
      routing = src.research ? 'research' : 'discussion';
      source = 'migration-seeded';
      phaseItemCount++;
    } else if (src.surfaced) {
      routing = 'discussion';
      source = 'migration-seeded:research-analysis';
      surfacedOnlyCount++;
    } else {
      routing = 'discussion';
      source = 'migration-seeded:gap-analysis';
      gapOnlyCount++;
    }
    toAdd[name] = { status: 'in-progress', routing, source };
  }

  if (Object.keys(toAdd).length === 0) continue;

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

  // Back-fill session-001.md if missing — refinement-session's numbering
  // assumes session-001 exists as the 'Initial Framing' anchor.
  const incDir = path.join(wfDir, entry.name, 'inception');
  const sessionPath = path.join(incDir, 'session-001.md');
  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(incDir, { recursive: true });
    const lines = [];
    lines.push('# Initial Framing — Pre-Inception Migration');
    lines.push('');
    lines.push('This work unit pre-dates the discovery-map system. The map was seeded');
    lines.push('from existing artifacts:');
    lines.push('');
    if (phaseItemCount > 0) {
      lines.push('- ' + phaseItemCount + ' item(s) from research/discussion items (source: migration-seeded)');
    }
    if (surfacedOnlyCount > 0) {
      lines.push('- ' + surfacedOnlyCount + ' item(s) from surfaced_topics (source: migration-seeded:research-analysis)');
    }
    if (gapOnlyCount > 0) {
      lines.push('- ' + gapOnlyCount + ' item(s) from gap_topics (source: migration-seeded:gap-analysis)');
    }
    lines.push('');
    lines.push('Open \`f\`/\`refine\` to populate summaries and curate the map.');
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
