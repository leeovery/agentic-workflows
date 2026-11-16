'use strict';

//
// Migration 055: Top-of-file corrigendum blockquotes → bottom `## Corrigenda` section
//
// Corrigenda used to be prescribed as blockquote entries at the top of the
// specification, directly beneath the title — where they ride the
// title/intro chunk at indexing time and dilute it. They now live in a
// `## Corrigenda` section at the bottom of the file, which the chunker
// isolates as its own chunk (H2 split + an own-chunk rule in the spec
// config). Move every corrigendum blockquote sitting above the first
// section heading into that section, preserving its text verbatim.
// Specifications only — the correction protocol never touches any other
// phase artifact.
//
// Idempotent: a converted file has no corrigendum blockquotes above its
// first section heading and yields nothing on a re-run.
//

const fs = require('fs');
const path = require('path');

// Matches the entry header in both observed spellings: the ⚠ marker may sit
// inside or outside the bold span.
const CORRIGENDUM_RE = /^>\s*(?:⚠\s*)?\*\*\s*(?:⚠\s*)?Corrigendum\b/;
// Chunker-compatible fence handling: both fence styles, closed only by the
// matching marker.
const FENCE_RE = /^\s*(```+|~~~+)/;
const HEADING_RE = /^#{1,6} /;
const SECTION_RE = /^#{2,6} /;

/**
 * Find corrigendum blockquote blocks above the first section heading,
 * fence-aware. A block is a whole blockquote run — `>` lines, markdown lazy
 * continuations (a non-blank line directly under a block line), and blank
 * gaps followed by further `>` lines — collected when ANY of its lines
 * matches CORRIGENDUM_RE, so a preamble line or a wrapped entry never
 * splits the record. Returns [start, end] line ranges (inclusive).
 * @param {string[]} lines
 * @returns {[number, number][]}
 */
function findTopCorrigenda(lines) {
  /** @type {[number, number][]} */
  const blocks = [];
  let inFence = false;
  let fenceMarker = '';
  for (let i = 0; i < lines.length; i++) {
    const fence = FENCE_RE.exec(lines[i]);
    if (fence) {
      const marker = fence[1][0];
      if (!inFence) { inFence = true; fenceMarker = marker; }
      else if (marker === fenceMarker) { inFence = false; fenceMarker = ''; }
      continue;
    }
    if (inFence) continue;
    if (SECTION_RE.test(lines[i])) break;
    if (!/^>/.test(lines[i])) continue;

    const start = i;
    let end = i;
    let sawCorrigendum = CORRIGENDUM_RE.test(lines[i]);
    while (end + 1 < lines.length) {
      const next = lines[end + 1];
      if (FENCE_RE.test(next) || HEADING_RE.test(next)) break;
      if (/^>/.test(next)) {
        end++;
        if (CORRIGENDUM_RE.test(next)) sawCorrigendum = true;
        continue;
      }
      if (next.trim() !== '') { end++; continue; } // lazy continuation
      // Blank run: part of the block only when more `>` lines follow it.
      let j = end + 2;
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j < lines.length && /^>/.test(lines[j]) && !SECTION_RE.test(lines[j])) {
        end = j - 1;
        continue;
      }
      break;
    }
    if (sawCorrigendum) blocks.push([start, end]);
    i = end;
  }
  return blocks;
}

/**
 * Locate an existing `## Corrigenda` section, fence-aware. Returns the line
 * index one past the section's last content line (the insertion point), or
 * -1 when the section is absent.
 * @param {string[]} lines
 * @returns {number}
 */
function corrigendaSectionEnd(lines) {
  let inFence = false;
  let fenceMarker = '';
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const fence = FENCE_RE.exec(lines[i]);
    if (fence) {
      const marker = fence[1][0];
      if (!inFence) { inFence = true; fenceMarker = marker; }
      else if (marker === fenceMarker) { inFence = false; fenceMarker = ''; }
      continue;
    }
    if (!inFence && lines[i].trim() === '## Corrigenda') { start = i; break; }
  }
  if (start === -1) return -1;
  let end = lines.length;
  inFence = false;
  fenceMarker = '';
  for (let i = start + 1; i < lines.length; i++) {
    const fence = FENCE_RE.exec(lines[i]);
    if (fence) {
      const marker = fence[1][0];
      if (!inFence) { inFence = true; fenceMarker = marker; }
      else if (marker === fenceMarker) { inFence = false; fenceMarker = ''; }
      continue;
    }
    if (!inFence && /^## /.test(lines[i])) { end = i; break; }
  }
  while (end > start + 1 && lines[end - 1].trim() === '') end--;
  return end;
}

/**
 * Move top-region corrigendum blockquotes into a bottom `## Corrigenda`
 * section. Returns the rewritten content, or null when nothing matched.
 * @param {string} content
 * @returns {string|null}
 */
function convert(content) {
  const lines = content.split('\n');
  const blocks = findTopCorrigenda(lines);
  if (blocks.length === 0) return null;

  const moved = blocks.map(([s, e]) => lines.slice(s, e + 1).join('\n'));

  // Remove the blocks back-to-front; collapse the seam only when the
  // removal leaves two blank lines touching, so a lone separator is never
  // eaten.
  for (let b = blocks.length - 1; b >= 0; b--) {
    const [s, e] = blocks[b];
    lines.splice(s, e - s + 1);
    if (s > 0 && s < lines.length && lines[s - 1].trim() === '' && lines[s].trim() === '') {
      lines.splice(s, 1);
    }
  }
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();

  const entries = moved.join('\n\n');
  const sectionEnd = corrigendaSectionEnd(lines);
  if (sectionEnd !== -1) {
    lines.splice(sectionEnd, 0, '', entries);
    return lines.join('\n');
  }
  return lines.join('\n').replace(/\s+$/, '') + '\n\n## Corrigenda\n\n' + entries + '\n';
}

module.exports = {
  id: '055',
  description: 'top-of-file corrigenda to bottom section',
  info: 'Corrigendum entries used to be blockquotes at the top of a corrected specification, directly beneath the title — where they ride the title/intro chunk at knowledge-indexing time and dilute it. They now live in a "## Corrigenda" section at the bottom of the file, which the chunker isolates as its own chunk. This migration moves every corrigendum blockquote sitting above the first section heading of a specification into that bottom section, text preserved verbatim. Specifications only — the correction protocol never touches any other phase artifact.',
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
    const artifacts = [];
    for (const wu of units) {
      const specDir = path.join(workflowsDir, wu, 'specification');
      try {
        for (const topic of fs.readdirSync(specDir, { withFileTypes: true })) {
          if (!topic.isDirectory()) continue;
          const spec = path.join(specDir, topic.name, 'specification.md');
          if (fs.existsSync(spec)) artifacts.push(spec);
        }
      } catch { /* phase absent */ }
    }

    /** @type {string[]} */
    const converted = [];
    for (const artifact of artifacts) {
      // Normalise CRLF for parsing — the patterns are LF-anchored, and a
      // CRLF artifact must convert, not silently skip. A file the fs
      // refuses to read or write degrades to unconverted; the verify
      // pass's sweep owns anything left behind.
      try {
        const content = fs.readFileSync(artifact, 'utf8').replace(/\r\n/g, '\n');
        const rewritten = convert(content);
        if (rewritten === null) continue;
        fs.writeFileSync(artifact, rewritten);
      } catch {
        continue;
      }
      converted.push(path.relative(projectDir, artifact).split(path.sep).join('/'));
      reportUpdate();
    }

    if (converted.length === 0) reportSkip();

    // The parser is exact-match; corrigenda were written by judgment and may
    // hold shapes it cannot recognise — hand those to the verification pass.
    if (artifacts.length === 0) return;
    const outcome = converted.length > 0
      ? `Moved corrigenda in: ${converted.join(', ')}.`
      : 'No corrigendum blockquotes matched the exact shape (a "> **Corrigendum" or "> **⚠ Corrigendum" blockquote above the first section heading) — that can mean none exist, or that any which do are malformed or sit elsewhere in the file.';
    return {
      verify: `${outcome} Now: (1) read each moved block in its new bottom position and fix wording that the move falsified — e.g. "Bodies below were edited in place" must become "The document body was edited in place" — editing only the block itself, never the document body; (2) search every specification (.workflows/*/specification/*/specification.md) for corrigendum-like content the parser missed — any blockquote still sitting above the first section heading, or content mentioning Corrigendum in a non-blockquote shape or outside the "## Corrigenda" section — and move stragglers into that file's bottom "## Corrigenda" section; (3) if the knowledge store is initialised, re-run \`node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index <path>\` for every file changed by (1)/(2) or listed above whose spec is actually indexed — the owning work unit not cancelled and the specification topic completed; indexing anything else would create or resurrect chunks the store deliberately lacks. Skip (3) entirely when the store was never set up.`,
    };
  },
};
