'use strict';

//
// Migration 052: Flip phantom triage stubs from in-progress to triaged
//
// Rerouted concerns used to land on an unstarted topic via `topic start`,
// leaving a research/discussion item `in-progress` with nothing behind it but
// a bare template artefact holding parked `## Triage` entries. Such a stub is
// manifest-indistinguishable from genuinely started work: the epic map shows
// it in flight, entry skills resume it, and the process resume gate offers a
// restart that deletes the parked concerns. The `triaged` status now marks
// these stubs; this repairs existing installs' phantoms.
//
// Conservative flip — an item moves to `triaged` only when ALL hold:
//   - epic work unit
//   - research/discussion item with status `in-progress`
//   - the artefact file exists
//   - its `## Triage` section holds at least one `### ` entry
//   - (discussion) the manifest item has no non-empty `subtopics`
//   - the body above `## Triage` is template-bare: every non-blank line
//     matches the phase template's fixed headings/placeholder lines — any
//     unknown line disqualifies
//
// Skip-not-flip failure mode: a missed phantom just keeps today's resume-gate
// behaviour. Manifest-only writes; artefacts untouched. Idempotent: a flipped
// item is no longer `in-progress`. Defensive: unparseable manifests are
// skipped untouched.
//
// Point-in-time snapshot: reads/writes manifest.json directly. Never uses the
// engine field surface.
//

const fs = require('fs');
const path = require('path');

// Fixed lines of the research template body (above `## Triage`).
const RESEARCH_LINES = new Set([
  'Brief description of what this research covers and what prompted it.',
  '## Starting Point',
  'What we know so far:',
  '- {Initial thoughts or context from the user}',
  '- {Any constraints or existing knowledge}',
  "- {Where we're starting: technical, market, business, etc.}",
  '{Content follows - freeform, managed by the skill}',
]);

// Fixed lines of the discussion template body (above `## Triage`).
const DISCUSSION_LINES = new Set([
  '## Context',
  "What this is about, why we're discussing it, the problem or opportunity, current state.",
  '### References',
  '- [Related spec or doc](link)',
  '- [Prior discussion](link)',
  '*Subtopics are documented below as they reach `decided` or accumulate enough exploration to capture. Not every subtopic needs its own section — minor items resolved in passing can be folded into their parent. The Discussion Map (which subtopics exist and their states) lives in the manifest, not this file.*',
  '## {Subtopic A}',
  '## {Subtopic B}',
  '### Context',
  "Why this subtopic matters, what's at stake, how it fits the larger topic.",
  '### Options Considered',
  'The approaches explored. If pros/cons naturally emerged:',
  '**Option A**',
  '**Option B**',
  '- Pros: ...',
  '- Cons: ...',
  '### Journey',
  'The back-and-forth exploration. What we initially thought. What changed our thinking. False paths - "We considered A but realised B because C." The "aha" moments. Small details that mattered.',
  'If there was notable debate:',
  '- **Positions**: What each side argued',
  '- **Resolution**: What made us choose, what detail tipped it',
  '### Decision',
  'What we chose, why, the deciding factor, trade-offs accepted, confidence level.',
  '*(Same structure: Context → Options → Journey → Decision)*',
  '## Summary',
  '### Key Insights',
  '1. Cross-cutting learning from the discussion',
  '2. Something that applies broadly',
  '### Open Threads',
  '- Anything deliberately deferred or left for future discussion',
  '- Concerns rerouted to other topics (with links)',
  '### Current State',
  "- What's resolved",
  "- What's still uncertain",
]);

/**
 * True when every non-blank line above `## Triage` is a known template line.
 * The title heading tolerates a substituted title; everything else must match
 * the template exactly (missing lines are fine — only present lines count).
 * @param {string} head @param {'research'|'discussion'} phase
 */
function isTemplateBare(head, phase) {
  const known = phase === 'research' ? RESEARCH_LINES : DISCUSSION_LINES;
  const titleRe = phase === 'research' ? /^# Research: \S/ : /^# Discussion: \S/;
  for (const raw of head.split('\n')) {
    const line = raw.trimEnd();
    if (line === '' || line === '---') continue;
    if (titleRe.test(line)) continue;
    if (!known.has(line)) return false;
  }
  return true;
}

/**
 * Split an artefact at its terminal `## Triage` heading. Returns null when
 * the heading is absent.
 * @param {string} text @returns {{head: string, triage: string}|null}
 */
function splitAtTriage(text) {
  const lines = text.split('\n');
  const idx = lines.findIndex((l) => l.trimEnd() === '## Triage');
  if (idx === -1) return null;
  return { head: lines.slice(0, idx).join('\n'), triage: lines.slice(idx + 1).join('\n') };
}

/** @param {string} triage */
function hasTriageEntry(triage) {
  return triage.split('\n').some((l) => /^### /.test(l));
}

module.exports = {
  id: '052',
  description: 'flip phantom triage stubs to triaged',
  run({ projectDir, reportUpdate, reportSkip }) {
    const wfDir = path.join(projectDir, '.workflows');
    if (!fs.existsSync(wfDir)) {
      reportSkip();
      return;
    }
    let updates = 0;

    for (const entry of fs.readdirSync(wfDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const mf = path.join(wfDir, entry.name, 'manifest.json');
      if (!fs.existsSync(mf)) continue;

      let manifest;
      try {
        manifest = JSON.parse(fs.readFileSync(mf, 'utf8'));
      } catch (_) {
        continue; // defensive: never touch an unparseable manifest
      }
      if (!manifest || manifest.work_type !== 'epic') continue;

      let changed = false;
      for (const phase of ['research', 'discussion']) {
        const ph = manifest.phases && manifest.phases[phase];
        const items = ph && typeof ph === 'object' ? ph.items : undefined;
        if (!items || typeof items !== 'object') continue;

        for (const [topic, item] of Object.entries(items)) {
          if (!item || typeof item !== 'object' || item.status !== 'in-progress') continue;
          if (phase === 'discussion' && item.subtopics
              && typeof item.subtopics === 'object' && Object.keys(item.subtopics).length > 0) {
            continue; // a mapped discussion has been worked — not a stub
          }
          const file = path.join(wfDir, entry.name, phase, `${topic}.md`);
          if (!fs.existsSync(file)) continue;

          let text;
          try {
            text = fs.readFileSync(file, 'utf8');
          } catch (_) {
            continue;
          }
          const parts = splitAtTriage(text);
          if (!parts) continue;
          if (!hasTriageEntry(parts.triage)) continue;
          if (!isTemplateBare(parts.head, /** @type {'research'|'discussion'} */ (phase))) continue;

          item.status = 'triaged';
          changed = true;
        }
      }

      if (changed) {
        fs.writeFileSync(mf, JSON.stringify(manifest, null, 2) + '\n');
        updates++;
      }
    }

    if (updates > 0) {
      for (let i = 0; i < updates; i++) reportUpdate();
    } else {
      reportSkip();
    }
  },
};
