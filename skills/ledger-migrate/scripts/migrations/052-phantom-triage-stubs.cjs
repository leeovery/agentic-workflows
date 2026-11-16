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
// An item moves to `triaged` only when ALL hold:
//   - epic work unit
//   - research/discussion item with status `in-progress`
//   - the artefact file exists
//   - its `## Triage` section holds at least one `### ` entry
//   - (discussion) the manifest item has no non-empty `subtopics` — the
//     decisive signal: initialization seeds the Discussion Map before any
//     session work (047 ports legacy maps, ordered before this migration),
//     so a subtopic-less in-progress discussion has never run a session.
//     Real stub bodies are improvised prose, so no artefact-shape test —
//     a wrong flip is benign (start reinitializes without loss), a miss
//     leaves the resume-gate bug in place.
//   - (research) the body above `## Triage` is template-bare: every
//     non-blank line matches the research template's fixed headings and
//     placeholder lines — any unknown line disqualifies. Research has no
//     manifest-side signal, so it keeps the strict skip-not-flip test.
//
// Manifest-only writes; artefacts untouched. Idempotent: a flipped item is
// no longer `in-progress`. Defensive: unparseable manifests are skipped
// untouched.
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

/**
 * True when every non-blank line above `## Triage` is a known research
 * template line. The title heading tolerates a substituted title; everything
 * else must match the template exactly (missing lines are fine — only
 * present lines count).
 * @param {string} head
 */
function isTemplateBare(head) {
  for (const raw of head.split('\n')) {
    const line = raw.trimEnd();
    if (line === '' || line === '---') continue;
    if (/^# Research: \S/.test(line)) continue;
    if (!RESEARCH_LINES.has(line)) return false;
  }
  return true;
}

/**
 * Split an artefact at its first `## Triage` heading (the template places it
 * terminally). Returns null when the heading is absent.
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
          if (phase === 'research' && !isTemplateBare(parts.head)) continue;

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
