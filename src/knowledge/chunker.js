'use strict';

// Generic markdown chunking engine for the knowledge base.
//
// Pure function — no external dependencies. Given a markdown string and a
// phase config, returns an array of { content } objects. Each `content`
// includes the heading line so it travels with its body as a semantic
// anchor (see knowledge-base/design.md finding #9).
//
// The algorithm is the same for every phase — only the config parameters
// change. See the `chunk()` function for the execution order; the order
// matters and resolves ambiguity between `keep_whole_below` (whole-file
// gate) and `special_sections` (split-time behaviour).
//
// Content preservation invariant (design doc line 74 — "no lossy
// compression anywhere in the pipeline"): every emitted chunk's content
// must be a verbatim substring of the post-frontmatter source. The
// implementation tracks source line ranges on sections and slices from
// the source when merging, rather than concatenating with a synthetic
// separator — which would violate the invariant.

const FENCE_RE = /^\s*(```+|~~~+)/;
const FRONTMATTER_DELIM = /^---\s*$/;

/**
 * Chunk a markdown string according to the given config.
 *
 * @param {string} markdown
 * @param {object} config
 * @returns {Array<{ content: string }>}
 */
function chunk(markdown, config) {
  if (typeof markdown !== 'string') {
    throw new TypeError('chunk: markdown must be a string');
  }
  if (!config || typeof config !== 'object') {
    throw new TypeError('chunk: config must be an object');
  }

  const {
    primary_level: primaryLevel = 2,
    fallback_level: fallbackLevel = 3,
    max_lines: maxLines = 200,
    keep_whole_below: keepWholeBelow = 50,
    special_sections: specialSections = {},
    strip_frontmatter: stripFrontmatter = true,
    skip_empty_sections: skipEmptySections = true,
  } = config;

  // 0. Normalise line endings so CRLF fixtures chunk identically to LF.
  const normalised = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 1. Strip YAML frontmatter if configured.
  const body = stripFrontmatter
    ? stripOpeningFrontmatter(normalised)
    : normalised;

  if (body.trim() === '') return [];

  const lines = body.split('\n');

  // 2. Whole-file gate: below keep_whole_below lines returns whole file as
  //    a single chunk. Do NOT proceed to heading parsing or special_sections.
  if (lines.length < keepWholeBelow) {
    return [{ content: rtrim(body) }];
  }

  // 3. Parse into headings, tracking fenced code blocks so headings inside
  //    them do not trigger splits.
  const headings = parseHeadings(lines);

  if (headings.length === 0) {
    return [{ content: rtrim(body) }];
  }

  // Fallback chain for missing headings: primary -> fallback -> whole file.
  const hasPrimary = headings.some((h) => h.level === primaryLevel);
  const hasFallback = headings.some((h) => h.level === fallbackLevel);

  let splitLevel;
  if (hasPrimary) {
    splitLevel = primaryLevel;
  } else if (hasFallback) {
    splitLevel = fallbackLevel;
  } else {
    return [{ content: rtrim(body) }];
  }

  // 4. Build sections at splitLevel with source line ranges. Content before
  //    the first splitLevel heading (typically an H1 title + intro) becomes
  //    the first section, with the H1 line used as its heading text.
  const sections = buildSections(lines, headings, splitLevel);

  // 5. Expand sections by applying sub-level special_sections rules. Any
  //    heading inside a regular section whose text matches a special_sections
  //    entry (at any level, not just the split level) is carved out of its
  //    parent and emitted with its own action. If the parent itself matches
  //    at the split level, the parent's action wins and no sub-carving
  //    happens — "Discussion Map as H2" stays one chunk.
  const items = expandSubLevelSpecials(
    sections,
    lines,
    splitLevel,
    specialSections,
    headings
  );

  // 6. Apply special_sections segment rules (merge-up / skip), then
  //    generate chunk content by slicing from the source line array. This
  //    is how the verbatim invariant is maintained: chunks are never
  //    assembled by concatenating strings with injected separators.
  const segments = [];
  for (const item of items) {
    if (item.action === 'skip') continue;

    if (item.action === 'merge-up') {
      if (segments.length === 0) {
        // First-section merge-up: promote to its own chunk.
        segments.push({
          action: 'regular',
          startLine: item.startLine,
          endLine: item.endLine,
          heading: item.heading,
          headingLine: item.headingLine,
        });
      } else {
        // Extend the previous segment's end line. The merged chunk is a
        // contiguous source slice from prev.startLine to item.endLine, so
        // the verbatim invariant holds even if the sections are separated
        // by blank lines, code blocks, or other content in the source.
        const prev = segments[segments.length - 1];
        prev.endLine = item.endLine;
      }
      continue;
    }

    segments.push({
      action: item.action || 'regular',
      startLine: item.startLine,
      endLine: item.endLine,
      heading: item.heading,
      headingLine: item.headingLine,
    });
  }

  // 7. Generate chunks from segments.
  const chunks = [];
  for (const seg of segments) {
    const text = rtrim(lines.slice(seg.startLine, seg.endLine + 1).join('\n'));
    const sectionLike = {
      heading: seg.heading,
      headingLine: seg.headingLine,
      text,
    };

    if (skipEmptySections && isEmptySection(sectionLike)) continue;

    // Size fallback only applies to regular sections. own-chunk sections
    // stay whole regardless of size — "always its own chunk" is
    // interpreted as literal one chunk, so a large Discussion Map stays
    // intact even if it exceeds max_lines. This is a deliberate design
    // choice: special_sections are semantic units the user has marked as
    // atomic, and splitting them would defeat the purpose.
    const segLines = text.split('\n');
    if (seg.action === 'regular' && segLines.length > maxLines) {
      const subs = splitAtFallback(sectionLike, fallbackLevel);
      for (const sub of subs) {
        if (skipEmptySections && isEmptySection(sub)) continue;
        chunks.push({ content: sub.text });
      }
    } else {
      chunks.push({ content: text });
    }
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function rtrim(s) {
  return s.replace(/\s+$/, '');
}

/**
 * Strip only the opening YAML frontmatter block. A `---` on its own line at
 * the start of the file opens the block; the next `---` closes it. If there
 * is no opening frontmatter, the markdown is returned unchanged so a
 * horizontal-rule `---` later in the file is preserved.
 */
function stripOpeningFrontmatter(markdown) {
  const lines = markdown.split('\n');
  if (lines.length === 0 || !FRONTMATTER_DELIM.test(lines[0] || '')) {
    return markdown;
  }
  for (let i = 1; i < lines.length; i += 1) {
    if (FRONTMATTER_DELIM.test(lines[i])) {
      return lines.slice(i + 1).join('\n').replace(/^\n+/, '');
    }
  }
  return '';
}

/**
 * Parse markdown lines into a list of heading descriptors, tracking fenced
 * code blocks so headings inside them are ignored. Returns an array of
 * { level, text, line } entries in document order.
 */
function parseHeadings(lines) {
  const headings = [];
  let inFence = false;
  let fenceMarker = '';

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fenceMatch = FENCE_RE.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1][0]; // ` or ~
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = '';
      }
      continue;
    }
    if (inFence) continue;

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      headings.push({
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
        line: i,
      });
    }
  }

  return headings;
}

/**
 * Build a flat list of sections split at `splitLevel`. Each section carries
 * its source line range ({ startLine, endLine }) so the main loop can slice
 * from the original line array when generating chunk content — this is how
 * the verbatim invariant is maintained through merge-up operations.
 *
 * Content before the first splitLevel heading — typically an H1 title and
 * any intro text — becomes the first section. The H1 line is recorded as
 * the section's heading so it travels with the chunk as a semantic anchor.
 */
function buildSections(lines, headings, splitLevel) {
  const splitIndices = headings
    .filter((h) => h.level === splitLevel)
    .map((h) => h.line);

  const sections = [];

  const firstSplitLine =
    splitIndices.length > 0 ? splitIndices[0] : lines.length;

  // Leading pre-split content (H1 + intro, or just intro if no H1).
  if (firstSplitLine > 0) {
    const preLines = lines.slice(0, firstSplitLine);
    const h1 = headings.find((h) => h.level === 1 && h.line < firstSplitLine);
    const text = rtrim(preLines.join('\n'));
    if (text.trim() !== '') {
      sections.push({
        heading: h1 ? h1.text : '',
        headingLine: h1 ? lines[h1.line] : '',
        startLine: 0,
        endLine: firstSplitLine - 1,
        text,
      });
    }
  }

  for (let i = 0; i < splitIndices.length; i += 1) {
    const start = splitIndices[i];
    const end =
      i + 1 < splitIndices.length ? splitIndices[i + 1] - 1 : lines.length - 1;
    const headingText = /^#+\s+(.*)$/.exec(lines[start])[1].trim();
    sections.push({
      heading: headingText,
      headingLine: lines[start],
      startLine: start,
      endLine: end,
      text: rtrim(lines.slice(start, end + 1).join('\n')),
    });
  }

  return sections;
}

/**
 * Expand a section list by applying sub-level special_sections rules.
 *
 * Precedence rule: if a split-level section's heading is itself in
 * special_sections, that match wins and the section is emitted whole with
 * the configured action. No sub-carving — "Discussion Map as an H2" stays
 * one chunk regardless of any nested H3s.
 *
 * Otherwise, scan the section for sub-level headings (H3+, below the
 * split level) whose text matches special_sections. Each match is carved
 * out of its parent at its natural boundary (from the sub-heading line to
 * the next heading at the same or higher level, bounded by the parent
 * section's end). The parent's remaining content is emitted as one or
 * more regular pieces around each carved-out sub-section.
 *
 * Each emitted item is `{ action, startLine, endLine, heading, headingLine }`
 * with line ranges pointing into the original source line array.
 *
 * Note: sub-level matching only handles `own-chunk` and `skip`. `merge-up`
 * is a split-level concept — it attaches a whole section to its
 * predecessor, which does not have a meaningful interpretation at
 * sub-level granularity, so sub-level merge-up entries are treated as
 * regular sub-headings and left inside the parent chunk.
 */
function expandSubLevelSpecials(
  sections,
  lines,
  splitLevel,
  specialSections,
  allHeadings
) {
  const result = [];

  for (const section of sections) {
    const trimmedHeading = section.heading ? section.heading.trim() : '';
    const topAction = specialSections[trimmedHeading];

    if (topAction) {
      // Top-level match wins — emit the whole section with the top action.
      result.push({
        action: topAction,
        startLine: section.startLine,
        endLine: section.endLine,
        heading: section.heading,
        headingLine: section.headingLine,
      });
      continue;
    }

    // Scan for sub-level matches within this section's line range. Exclude
    // H1 (already absorbed into the first section) and the split level
    // itself (those are already section boundaries).
    const subMatches = allHeadings.filter((h) => {
      if (h.line <= section.startLine) return false;
      if (h.line > section.endLine) return false;
      if (h.level === 1) return false;
      if (h.level === splitLevel) return false;
      const action = specialSections[h.text];
      return action === 'own-chunk' || action === 'skip';
    });

    if (subMatches.length === 0) {
      result.push({
        action: 'regular',
        startLine: section.startLine,
        endLine: section.endLine,
        heading: section.heading,
        headingLine: section.headingLine,
      });
      continue;
    }

    // For each sub-match, find its natural end line: the next heading at
    // the same or higher level, bounded by the parent section's end.
    const subRanges = subMatches.map((h) => {
      let end = section.endLine;
      for (const other of allHeadings) {
        if (other.line <= h.line) continue;
        if (other.line > section.endLine) break;
        if (other.level <= h.level) {
          end = other.line - 1;
          break;
        }
      }
      return {
        action: specialSections[h.text],
        startLine: h.line,
        endLine: end,
        heading: h.text,
        headingLine: lines[h.line],
      };
    });

    // Emit pieces: regular "before" chunks, each carved sub-match, and a
    // trailing remainder chunk if any content follows the last sub-match.
    let cursor = section.startLine;
    let isFirstPiece = true;
    for (const sub of subRanges) {
      if (sub.startLine > cursor) {
        result.push({
          action: 'regular',
          startLine: cursor,
          endLine: sub.startLine - 1,
          // The first piece inherits the parent section's heading as its
          // semantic anchor. Subsequent pieces have no heading (they're
          // mid-section content fragments) and will be dropped by
          // skip_empty_sections if they consist only of whitespace.
          heading: isFirstPiece ? section.heading : '',
          headingLine: isFirstPiece ? section.headingLine : '',
        });
        isFirstPiece = false;
      }
      result.push({
        action: sub.action,
        startLine: sub.startLine,
        endLine: sub.endLine,
        heading: sub.heading,
        headingLine: sub.headingLine,
      });
      cursor = sub.endLine + 1;
    }
    if (cursor <= section.endLine) {
      result.push({
        action: 'regular',
        startLine: cursor,
        endLine: section.endLine,
        heading: '',
        headingLine: '',
      });
    }
  }

  return result;
}

/**
 * Split an oversized section once at `fallbackLevel`. The original section's
 * heading and any content before the first fallbackLevel heading form the
 * first sub-section. No recursion — oversized sub-sections are returned as
 * they are and reported by `knowledge status` (Phase 4). This matches the
 * flat fallback chain in design doc finding #9: H2 → H3 → whole file.
 */
function splitAtFallback(section, fallbackLevel) {
  const lines = section.text.split('\n');
  const headings = parseHeadings(lines);
  const subIndices = headings
    .filter((h) => h.level === fallbackLevel)
    .map((h) => h.line);

  if (subIndices.length === 0) {
    return [section];
  }

  const subs = [];

  const firstSub = subIndices[0];
  if (firstSub > 0) {
    const preLines = lines.slice(0, firstSub);
    const text = rtrim(preLines.join('\n'));
    if (text.trim() !== '') {
      subs.push({
        heading: section.heading,
        headingLine: section.headingLine,
        text,
      });
    }
  }

  for (let i = 0; i < subIndices.length; i += 1) {
    const start = subIndices[i];
    const end = i + 1 < subIndices.length ? subIndices[i + 1] : lines.length;
    const sliceLines = lines.slice(start, end);
    const headingText = /^#+\s+(.*)$/.exec(lines[start])[1].trim();
    subs.push({
      heading: headingText,
      headingLine: lines[start],
      text: rtrim(sliceLines.join('\n')),
    });
  }

  return subs;
}

/**
 * A section is empty if, after removing any leading heading line, the
 * remaining text has no non-whitespace content. Used to drop pieces that
 * sub-level extraction leaves behind (e.g. `## Parent` with no intro text
 * before the first extracted sub-section).
 */
function isEmptySection(section) {
  if (!section || typeof section.text !== 'string') return true;
  const lines = section.text.split('\n');
  const bodyStart =
    section.headingLine && lines[0] === section.headingLine ? 1 : 0;
  const body = lines.slice(bodyStart).join('\n');
  return body.trim() === '';
}

module.exports = { chunk };
