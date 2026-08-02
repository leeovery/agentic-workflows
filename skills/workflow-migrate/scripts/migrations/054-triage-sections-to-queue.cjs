'use strict';

//
// Migration 054: In-document `## Triage` sections → triage queue
//
// Rerouted concerns used to land as `### {title}` entries inside the target
// artifact's `## Triage` section. They now live as one file per concern in
// the topic's triage queue (`.workflows/{wu}/{phase}/.triage/{topic}/`),
// delivered by the engine. Convert every parked entry to a queue file and
// reset the section to `(none)` so the drain (which folds queue files, and
// legacy sections as a fallback) and the conclude gate (which checks the
// queue) see a consistent world.
//
// Idempotent: a converted file's section reads `(none)` and yields nothing
// on a re-run. Sections without real entries are untouched.
//

const fs = require('fs');
const path = require('path');

const PHASES = ['research', 'discussion'];

/** @param {string} title */
function slugify(title) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'concern';
}

/**
 * Split `content` around its `## Triage` section, fence-aware — a heading
 * quoted inside a fenced code block is content, not the section. Returns
 * null when the section is absent.
 * @param {string} content
 * @returns {{before: string, body: string, after: string}|null}
 */
function splitTriageSection(content) {
  const lines = content.split('\n');
  let inFence = false;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) { inFence = !inFence; continue; }
    if (!inFence && lines[i].trim() === '## Triage') { start = i; break; }
  }
  if (start === -1) return null;
  let end = lines.length;
  inFence = false;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) { inFence = !inFence; continue; }
    if (!inFence && /^## /.test(lines[i])) { end = i; break; }
  }
  return {
    before: lines.slice(0, start + 1).join('\n'),
    body: lines.slice(start + 1, end).join('\n'),
    after: lines.slice(end).join('\n'),
  };
}

/**
 * The `### {title}` entries inside a triage section body.
 * @param {string} body
 * @returns {{title: string, text: string}[]}
 */
function parseEntries(body) {
  const lines = body.split('\n');
  /** @type {{title: string, text: string}[]} */
  const entries = [];
  /** @type {string[]|null} */
  let current = null;
  let title = '';
  for (const line of lines) {
    const m = line.match(/^### (.+)$/);
    if (m) {
      if (current) entries.push({ title, text: current.join('\n') });
      title = m[1].trim();
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) entries.push({ title, text: current.join('\n') });
  return entries;
}

module.exports = {
  id: '054',
  description: 'in-document triage sections to triage queue',
  info: 'Rerouted concerns used to land as "### {title}" entries inside a research or discussion artifact\'s "## Triage" section. They now live as one file per concern in the topic\'s triage queue (.workflows/{wu}/{phase}/.triage/{topic}/NNN-{slug}.md), delivered by the engine; the drain folds queue files and the conclude gates check the queue — nothing reads in-document sections any more. This migration moves every parked entry into the queue and resets the section to "(none)".',
  run({ projectDir, reportUpdate, reportSkip }) {
    const workflowsDir = path.join(projectDir, '.workflows');
    /** @type {string[]} */
    let units;
    try {
      units = fs.readdirSync(workflowsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => e.name);
    } catch {
      reportSkip();
      return;
    }

    /** @type {string[]} */
    const converted = [];
    let sawArtifacts = false;
    for (const wu of units) {
      for (const phase of PHASES) {
        const phaseDir = path.join(workflowsDir, wu, phase);
        /** @type {string[]} */
        let files;
        try {
          files = fs.readdirSync(phaseDir).filter((f) => f.endsWith('.md'));
        } catch {
          continue;
        }
        // A completed topic's artifact is knowledge-indexed — its edits go
        // through the corrigendum protocol, never a migration; the verify
        // pass owns spotting anything parked there. Read the manifest
        // directly (never `engine manifest` — migrations are point-in-time).
        /** @type {Record<string, any>} */
        let items = {};
        try {
          const manifest = JSON.parse(fs.readFileSync(path.join(workflowsDir, wu, 'manifest.json'), 'utf8'));
          const ph = manifest && manifest.phases && manifest.phases[phase];
          if (ph && typeof ph.items === 'object' && ph.items !== null) items = ph.items;
        } catch { /* unreadable manifest — convert everything, verify pass reviews */ }

        for (const file of files) {
          sawArtifacts = true;
          const topic = file.replace(/\.md$/, '');
          const item = items[topic];
          if (item && typeof item === 'object' && item.status === 'completed') continue;
          const artifact = path.join(phaseDir, file);
          // Normalise CRLF for parsing — the exact-match patterns are
          // LF-anchored, and a CRLF artifact must convert, not silently skip.
          const content = fs.readFileSync(artifact, 'utf8').replace(/\r\n/g, '\n');
          const split = splitTriageSection(content);
          if (!split) continue;
          const entries = parseEntries(split.body);
          if (entries.length === 0) continue;

          const queueDir = path.join(phaseDir, '.triage', topic);
          fs.mkdirSync(queueDir, { recursive: true });
          let n = 0;
          for (const f of fs.readdirSync(queueDir)) {
            const m = f.match(/^(\d{3})-.+\.md$/);
            if (m) n = Math.max(n, parseInt(m[1], 10));
          }
          for (const entry of entries) {
            n += 1;
            const dest = path.join(queueDir, `${String(n).padStart(3, '0')}-${slugify(entry.title)}.md`);
            fs.writeFileSync(dest, entry.text.replace(/\n+$/, '') + '\n');
          }
          fs.writeFileSync(artifact, `${split.before}\n\n(none)\n${split.after === '' ? '' : '\n' + split.after}`);
          converted.push(`${wu}/${phase}/${file}`);
          reportUpdate();
        }
      }
    }

    if (converted.length === 0) reportSkip();

    // The parser is exact-match; artifacts were written by judgment and may
    // hold shapes it cannot recognise — hand those to the verification pass.
    if (!sawArtifacts) return;
    const outcome = converted.length > 0
      ? `Converted entries from: ${converted.join(', ')}.`
      : 'No in-document entries matched the exact shape (a heading of "## Triage" with "### " entries) — that can mean none exist, or that any which do are malformed.';
    return {
      verify: `${outcome} Now check every research and discussion artifact (.workflows/*/research/*.md, .workflows/*/discussion/*.md) for triage content this code could not recognise: malformed headings (e.g. "## Triage:" or "##Triage"), concern entries not under "### " headings, or concern text sitting below a "(none)". Move any straggler into the topic's queue as .workflows/{wu}/{phase}/.triage/{topic}/NNN-{slug}.md (next free NNN, kebab slug), one file per concern, keeping its full text, and reset the section body to "(none)". While there, delete now-empty "## Triage"/"(none)" sections from documents whose topic is NOT completed — completed documents are knowledge-indexed, leave them untouched.`,
    };
  },
};
