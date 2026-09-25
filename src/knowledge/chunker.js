'use strict';

// Generic markdown chunking engine for the knowledge base.
//
// Pure function — no external dependencies. Given a markdown string and a
// phase config, returns an array of { content } objects. Each `content`
// includes the heading line so it travels with its body as a semantic
// anchor.
//
// The algorithm is the same for every phase — only the config parameters
// change. See the `chunk()` function for the execution order; the order
// matters and resolves ambiguity between `keep_whole_below` (whole-file
// gate) and `special_sections` (split-time behaviour).
//
// Every chunk is at most MAX_CHUNK_CHARS. A piece over the budget splits at
// the next heading level present inside it, level by level; a piece with no
// heading left inside splits into paragraph groups, then lines, then slices
// of a single line — packed greedily back up to the budget at each of those
// tiers, and never inside a fenced block that fits on its own.
//
// Content preservation invariant — "no lossy compression anywhere in the
// pipeline": every emitted chunk's content must be a verbatim substring of
// the post-frontmatter source. Chunks are sliced from the source by offset,
// never assembled by concatenating strings with a synthetic separator.
//
// One deliberate exception: whitespace-free runs longer than
// MAX_TOKEN_LENGTH are split with a space (see capTokenRuns). Orama's
// tokenizer normalises each token via String.fromCharCode(...codes) — one
// spread argument per character — so a single ~200k-char token (base64
// blob, minified JS) overflows the call stack with an uncatchable-looking
// RangeError deep inside indexing. Such runs carry no retrieval value at
// that length; splitting them keeps every byte while capping token size.

const FENCE_RE = /^\s*(```+|~~~+)/;
const FRONTMATTER_DELIM = /^---\s*$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;

// Maximum length of a single whitespace-free run allowed into a chunk.
const MAX_TOKEN_LENGTH = 2048;
const LONG_RUN_RE = new RegExp(`\\S{${MAX_TOKEN_LENGTH + 1},}`, 'g');

// ≈3.5k tokens of English prose — under half the 8192-token embedding input limit, leaving room for code and non-Latin text, which tokenise denser.
const MAX_CHUNK_CHARS = 16000;

/**
 * Split any whitespace-free run longer than MAX_TOKEN_LENGTH into
 * space-separated pieces of at most MAX_TOKEN_LENGTH chars, so no single
 * token can overflow the tokenizer's per-character argument spread.
 *
 * @param {string} text
 * @returns {string}
 */
function capTokenRuns(text) {
  return text.replace(LONG_RUN_RE, (run) => {
    const pieces = [];
    for (let i = 0; i < run.length; i += MAX_TOKEN_LENGTH) {
      pieces.push(run.slice(i, i + MAX_TOKEN_LENGTH));
    }
    return pieces.join(' ');
  });
}

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
    keep_whole_below: keepWholeBelow = 50,
    special_sections: specialSections = {},
    strip_frontmatter: stripFrontmatter = true,
    skip_empty_sections: skipEmptySections = true,
  } = config;

  // 0. Normalise line endings so CRLF fixtures chunk identically to LF.
  const normalised = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 1. Strip YAML frontmatter if configured, then cap pathological
  //    whitespace-free runs before any content can reach the tokenizer.
  //    Applied to the body (not per-chunk) so every return path below is
  //    covered; only spaces are inserted, so line structure — and with it
  //    heading/fence parsing — is unchanged.
  const body = capTokenRuns(
    stripFrontmatter ? stripOpeningFrontmatter(normalised) : normalised
  );

  if (body.trim() === '') return [];

  const doc = parseDocument(body);
  const fit = (piece) => fitToBudget(doc, piece, skipEmptySections);
  const whole = { startLine: 0, endLine: doc.lines.length - 1, headed: false };

  // 2. Whole-file gate: below keep_whole_below lines the file is one piece.
  //    Do NOT proceed to heading parsing or special_sections.
  if (doc.lines.length < keepWholeBelow) return fit(whole);

  // 3. Split level: primary -> fallback -> whole file.
  const splitLevel = [primaryLevel, fallbackLevel].find((level) =>
    doc.headings.some((h) => h.level === level)
  );
  if (splitLevel === undefined) return fit(whole);

  // 4. Build sections at splitLevel with source line ranges. Content before
  //    the first splitLevel heading (typically an H1 title + intro) becomes
  //    the first section, with the H1 line used as its heading text.
  const sections = buildSections(doc.lines, doc.headings, splitLevel);

  // 5. Expand sections by applying sub-level special_sections rules. Any
  //    heading inside a regular section whose text matches a special_sections
  //    entry (at any level, not just the split level) is carved out of its
  //    parent and emitted with its own action. If the parent itself matches
  //    at the split level, the parent's action wins and no sub-carving
  //    happens — "Discussion Map as H2" stays one chunk while it fits the
  //    budget.
  const items = expandSubLevelSpecials(
    sections,
    doc.lines,
    splitLevel,
    specialSections,
    doc.headings
  );

  // 6. Apply special_sections segment rules (merge-up / skip), then fit each
  //    segment to the budget.
  return buildSegments(items, doc.lines)
    .filter((seg) => !(skipEmptySections && isEmptyPiece(doc, seg)))
    .flatMap(fit);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isBlank(line) {
  return line.trim() === '';
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
 * Scan markdown lines for headings and fenced code blocks. Headings inside a
 * fence are ignored. Returns the headings as { level, text, line } in
 * document order, and each fence's opening line mapped to its closing line
 * (an unclosed fence runs to the last line).
 */
function scanStructure(lines) {
  const headings = [];
  const fenceClose = new Map();
  let openedAt = -1;
  let marker = '';

  for (let i = 0; i < lines.length; i += 1) {
    const fence = FENCE_RE.exec(lines[i]);
    if (fence) {
      if (openedAt < 0) {
        openedAt = i;
        marker = fence[1][0];
      } else if (fence[1][0] === marker) {
        fenceClose.set(openedAt, i);
        openedAt = -1;
      }
      continue;
    }
    if (openedAt >= 0) continue;

    const heading = HEADING_RE.exec(lines[i]);
    if (heading) {
      headings.push({ level: heading[1].length, text: heading[2].trim(), line: i });
    }
  }
  if (openedAt >= 0) fenceClose.set(openedAt, lines.length - 1);

  return { headings, fenceClose };
}

/**
 * The body as lines plus the offsets that turn any line range — or any
 * character span — back into a verbatim, right-trimmed slice of the body.
 */
function parseDocument(body) {
  const lines = body.split('\n');
  const offsets = [0];
  for (const line of lines) offsets.push(offsets[offsets.length - 1] + line.length + 1);
  const { headings, fenceClose } = scanStructure(lines);

  const trimmedEnd = (from, to) => {
    let end = to;
    while (end > from && /\s/.test(body[end - 1])) end -= 1;
    return end;
  };

  return {
    lines,
    headings,
    fenceEnd: (line) => (fenceClose.has(line) ? fenceClose.get(line) : line),
    lineStart: (line) => offsets[line],
    lineSpan: (start, end) => ({ from: offsets[start], to: offsets[end + 1] - 1 }),
    size: ({ from, to }) => trimmedEnd(from, to) - from,
    content: ({ from, to }) => body.slice(from, trimmedEnd(from, to)),
  };
}

/**
 * Build a flat list of sections split at `splitLevel`. Each section carries
 * its source line range ({ startLine, endLine }).
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
    const h1 = headings.find((h) => h.level === 1 && h.line < firstSplitLine);
    if (lines.slice(0, firstSplitLine).some((line) => !isBlank(line))) {
      sections.push({
        heading: h1 ? h1.text : '',
        headingLine: h1 ? lines[h1.line] : '',
        startLine: 0,
        endLine: firstSplitLine - 1,
      });
    }
  }

  for (let i = 0; i < splitIndices.length; i += 1) {
    const start = splitIndices[i];
    const end =
      i + 1 < splitIndices.length ? splitIndices[i + 1] - 1 : lines.length - 1;
    sections.push({
      heading: HEADING_RE.exec(lines[start])[2].trim(),
      headingLine: lines[start],
      startLine: start,
      endLine: end,
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
 * one chunk regardless of any nested H3s, while it fits the budget.
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
 * Apply the segment actions — `skip` drops an item, `merge-up` extends the
 * previous segment to the item's end (a first-section merge-up stands as its
 * own segment) — and reduce each survivor to its line range plus whether
 * that range opens on its own heading line.
 */
function buildSegments(items, lines) {
  const segments = [];
  for (const item of items) {
    if (item.action === 'skip') continue;
    if (item.action === 'merge-up' && segments.length > 0) {
      segments[segments.length - 1].endLine = item.endLine;
      continue;
    }
    segments.push({
      startLine: item.startLine,
      endLine: item.endLine,
      headed: Boolean(item.headingLine) && lines[item.startLine] === item.headingLine,
    });
  }
  return segments;
}

/**
 * A piece is empty when nothing but whitespace follows its own heading line.
 * Used to drop pieces that sub-level extraction and heading splits leave
 * behind (e.g. `## Parent` with no intro text before the first sub-section).
 */
function isEmptyPiece(doc, piece) {
  const bodyStart = piece.headed ? piece.startLine + 1 : piece.startLine;
  for (let i = bodyStart; i <= piece.endLine; i += 1) {
    if (!isBlank(doc.lines[i])) return false;
  }
  return true;
}

/**
 * The chunk a span yields — none when it holds only whitespace.
 */
function chunksOf(doc, span) {
  const content = doc.content(span);
  return content.trim() === '' ? [] : [{ content }];
}

/**
 * Emit a piece whole while it fits the budget; otherwise split it at the
 * next heading level inside it and fit each sub-piece, or — with no heading
 * left inside — pack it by paragraphs, lines, and line slices.
 */
function fitToBudget(doc, piece, skipEmpty) {
  const span = doc.lineSpan(piece.startLine, piece.endLine);
  if (doc.size(span) <= MAX_CHUNK_CHARS) return chunksOf(doc, span);

  const subs = splitAtNextHeadingLevel(doc, piece);
  if (subs === null) return packTier(doc, { start: piece.startLine, end: piece.endLine }, 0);
  return subs
    .filter((sub) => !(skipEmpty && isEmptyPiece(doc, sub)))
    .flatMap((sub) => fitToBudget(doc, sub, skipEmpty));
}

/**
 * Split a piece at every heading of the shallowest level found after its
 * first line. Text before the first of those headings stays with the
 * piece's own opening line as the first sub-piece. Null when no heading
 * follows the first line.
 */
function splitAtNextHeadingLevel(doc, piece) {
  const inner = doc.headings.filter(
    (h) => h.line > piece.startLine && h.line <= piece.endLine
  );
  if (inner.length === 0) return null;

  const level = Math.min(...inner.map((h) => h.level));
  const cuts = inner.filter((h) => h.level === level).map((h) => h.line);
  const subs = [{ startLine: piece.startLine, endLine: cuts[0] - 1, headed: piece.headed }];
  cuts.forEach((line, i) => {
    const endLine = i + 1 < cuts.length ? cuts[i + 1] - 1 : piece.endLine;
    subs.push({ startLine: line, endLine, headed: true });
  });
  return subs;
}

/**
 * Blank-line-separated paragraphs; a fenced block never breaks a paragraph.
 */
function paragraphs(doc, { start, end }) {
  const atoms = [];
  let i = start;
  while (i <= end) {
    if (isBlank(doc.lines[i])) {
      i += 1;
      continue;
    }
    const first = i;
    while (i <= end && !isBlank(doc.lines[i])) {
      i = Math.min(doc.fenceEnd(i), end) + 1;
    }
    atoms.push({ start: first, end: i - 1 });
  }
  return atoms;
}

/**
 * Non-blank lines, each fenced block held together as one atom.
 */
function fencedLines(doc, { start, end }) {
  const atoms = [];
  for (let i = start; i <= end; i += 1) {
    if (isBlank(doc.lines[i])) continue;
    const last = Math.min(doc.fenceEnd(i), end);
    atoms.push({ start: i, end: last });
    i = last;
  }
  return atoms;
}

/**
 * Non-blank lines, fences included.
 */
function singleLines(doc, { start, end }) {
  const atoms = [];
  for (let i = start; i <= end; i += 1) {
    if (!isBlank(doc.lines[i])) atoms.push({ start: i, end: i });
  }
  return atoms;
}

const PACKING_TIERS = [paragraphs, fencedLines, singleLines];

/**
 * Pack a range's atoms at the given tier greedily into chunks within the
 * budget — each chunk the source slice from its first atom to its last. An
 * atom over the budget on its own is packed at the next tier; past the last
 * tier it is a single line, sliced.
 */
function packTier(doc, range, tier) {
  if (tier === PACKING_TIERS.length) return sliceLine(doc, range.start);

  const chunks = [];
  let open = null;
  const flush = () => {
    if (open) chunks.push(...chunksOf(doc, doc.lineSpan(open.start, open.end)));
    open = null;
  };

  for (const atom of PACKING_TIERS[tier](doc, range)) {
    if (open && doc.size(doc.lineSpan(open.start, atom.end)) <= MAX_CHUNK_CHARS) {
      open.end = atom.end;
      continue;
    }
    flush();
    if (doc.size(doc.lineSpan(atom.start, atom.end)) <= MAX_CHUNK_CHARS) {
      open = { start: atom.start, end: atom.end };
    } else {
      chunks.push(...packTier(doc, atom, tier + 1));
    }
  }
  flush();
  return chunks;
}

/**
 * Cut one over-budget line into consecutive slices of at most the budget.
 */
function sliceLine(doc, line) {
  const from = doc.lineStart(line);
  const length = doc.lines[line].length;
  const chunks = [];
  for (let at = 0; at < length; at += MAX_CHUNK_CHARS) {
    chunks.push(...chunksOf(doc, { from: from + at, to: from + Math.min(at + MAX_CHUNK_CHARS, length) }));
  }
  return chunks;
}

module.exports = { chunk, MAX_TOKEN_LENGTH, MAX_CHUNK_CHARS };
