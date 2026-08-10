'use strict';

//
// Migration 055: Top-of-file corrigendum blockquotes → bottom `## Corrigenda` section
//
// Corrigenda used to be prescribed as blockquote entries at the top of the
// specification, directly beneath the title — where they ride the
// title/intro chunk at indexing time and dilute it. They now live in a
// `## Corrigenda` section at the bottom of the file, which the chunker
// isolates as its own chunk (H2 split + an own-chunk rule in the spec
// config). Move every top-region corrigendum blockquote into that section,
// preserving its text verbatim. Specifications only — the correction
// protocol never touches any other phase artifact.
//
// Idempotent: a converted file has no corrigendum blockquotes above its
// first H2 and yields nothing on a re-run.
//

const fs = require('fs');
const path = require('path');

const CORRIGENDUM_RE = /^>\s*\*\*\s*(?:⚠\s*)?Corrigendum\b/;

/**
 * Find corrigendum blockquote blocks above the first H2, fence-aware.
 * A block is a contiguous run of `>`-prefixed lines whose first line
 * matches CORRIGENDUM_RE. Returns [start, end] line ranges (inclusive).
 * @param {string[]} lines
 * @returns {[number, number][]}
 */
function findTopCorrigenda(lines) {
  /** @type {[number, number][]} */
  const blocks = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (/^## /.test(lines[i])) break;
    if (!CORRIGENDUM_RE.test(lines[i])) continue;
    let end = i;
    while (end + 1 < lines.length && /^>/.test(lines[end + 1])) end++;
    blocks.push([i, end]);
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
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) { inFence = !inFence; continue; }
    if (!inFence && lines[i].trim() === '## Corrigenda') { start = i; break; }
  }
  if (start === -1) return -1;
  let end = lines.length;
  inFence = false;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) { inFence = !inFence; continue; }
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

  // Remove the blocks back-to-front, collapsing the blank-line pair each
  // removal leaves behind (one adjacent blank line goes with the block).
  for (let b = blocks.length - 1; b >= 0; b--) {
    const [s, e] = blocks[b];
    let removeStart = s;
    let removeEnd = e;
    if (removeEnd + 1 < lines.length && lines[removeEnd + 1].trim() === '') removeEnd++;
    else if (removeStart > 0 && lines[removeStart - 1].trim() === '') removeStart--;
    lines.splice(removeStart, removeEnd - removeStart + 1);
  }

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
  info: 'Corrigendum entries used to be blockquotes at the top of a corrected specification, directly beneath the title — where they ride the title/intro chunk at knowledge-indexing time and dilute it. They now live in a "## Corrigenda" section at the bottom of the file, which the chunker isolates as its own chunk. This migration moves every corrigendum blockquote sitting above the first H2 of a specification into that bottom section, text preserved verbatim. Specifications only — the correction protocol never touches any other phase artifact.',
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
      // CRLF artifact must convert, not silently skip.
      const content = fs.readFileSync(artifact, 'utf8').replace(/\r\n/g, '\n');
      const rewritten = convert(content);
      if (rewritten === null) continue;
      fs.writeFileSync(artifact, rewritten);
      converted.push(path.relative(workflowsDir, artifact));
      reportUpdate();
    }

    if (converted.length === 0) reportSkip();

    // The parser is exact-match; corrigenda were written by judgment and may
    // hold shapes it cannot recognise — hand those to the verification pass.
    if (artifacts.length === 0) return;
    const outcome = converted.length > 0
      ? `Moved corrigenda in: ${converted.join(', ')}.`
      : 'No corrigendum blockquotes matched the exact shape (a "> **Corrigendum" or "> **⚠ Corrigendum" blockquote above the first H2) — that can mean none exist, or that any which do are malformed or sit elsewhere in the file.';
    return {
      verify: `${outcome} Now: (1) read each moved block in its new bottom position and fix directional wording that the move inverted — e.g. "Bodies below were edited in place" must become "The document body was edited in place" — editing only the block itself, never the document body; (2) search the specifications (.workflows/*/specification/*/specification.md) for corrigendum-like content the parser missed — blockquotes mentioning "Corrigendum" below the first H2 or in a non-blockquote shape — and move any straggler into that file's bottom "## Corrigenda" section; (3) if the knowledge store is initialised, re-run \`node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index <path>\` for every file changed by (1)/(2) or listed above, so its chunks reflect the new layout — skip this when the store was never set up.`,
    };
  },
};
