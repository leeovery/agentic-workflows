'use strict';

// ---------------------------------------------------------------------------
// Kernel: deterministic renderer for fixed-shape output.
//
// Pure layout — no workflow vocabulary. Layout that is fully determined by
// data is computed here, in code, and emitted verbatim by the caller — never
// re-derived character-by-character by the model. The wrap/width math lives
// here once, so the gutter-budget bug can exist in exactly one place.
//
// Library only: the engine CLI (../engine.cjs) exposes these for shell use;
// adapters and the domain ring `require()` them in-process.
// ---------------------------------------------------------------------------

/**
 * @typedef {{text: string, hang?: number}} TreeBody
 *   A body paragraph. `hang` indents its continuation lines, so a paragraph
 *   opening with a marker wraps under its text rather than under the marker.
 *   A bare string is the same thing with no hang.
 */

/**
 * @typedef {object} TreeNode
 * @property {string} title          one-line header row (glyph/label already composed)
 * @property {string} [tag]          trailing annotation, aligned into a column across the tree
 * @property {(string|TreeBody)[]} [body] paragraphs beneath the row; each wraps independently
 * @property {TreeNode[]} [children] nested nodes, same shape, recursively
 */

const { displayWidth } = require('./terminal.cjs');

const WIDTH = 49; // legacy drawn-chrome width — engine DISPLAY boxes and dev-aid CLI verbs only; prose chrome is markdown now

// ---------------------------------------------------------------------------
// Core: width + wrap primitives
// ---------------------------------------------------------------------------

// Fill a head string out to `width` with `fillChar`. If the head already meets
// or exceeds the width, it is returned unchanged (never truncated, never a
// negative repeat).
/** @param {string} head @param {string} fillChar @param {number} width */
function fillTo(head, fillChar, width) {
  const deficit = width - head.length;
  return deficit > 0 ? head + fillChar.repeat(deficit) : head;
}

// Greedy word-wrap `text` into segments no wider than `budget` columns. A word
// longer than the budget is hard-split (so a long unbroken token can never
// overflow the budget). Returns an array of segments with no trailing spaces.
/** @param {string} text @param {number} budget @returns {string[]} */
function wrap(text, budget) {
  if (!Number.isInteger(budget) || budget < 1) {
    throw new Error(`wrap: budget must be a positive integer (got ${budget})`);
  }
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (let word of words) {
    while (word.length > budget) {
      // Hard-split an oversized token across as many lines as needed.
      if (line) { lines.push(line); line = ''; }
      lines.push(word.slice(0, budget));
      word = word.slice(budget);
    }
    if (!line) {
      line = word;
    } else if (line.length + 1 + word.length <= budget) {
      line += ' ' + word;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

// Wrap `text` and prefix every resulting line with `prefix`, keeping the total
// rendered width (prefix + text) within `width`. THE budget bug lives here and
// only here: the wrap budget is `width - prefix.length`, never the bare width.
// `prefix` is the gutter/indent string applied to every line uniformly.
//
// `hang` indents continuation lines by that many columns, so a paragraph
// opening with a marker (`↳ `) wraps under its text rather than under the
// marker. The budget subtracts the hang from every line, not just the
// continuations — one unused column on the first line buys arithmetic that
// cannot overflow.
/** @param {string} text @param {{width?: number, prefix?: string, hang?: number}} [opts] @returns {string[]} */
function wrapWithPrefix(text, { width = WIDTH, prefix = '', hang = 0 } = {}) {
  const budget = width - prefix.length - hang;
  if (budget < 1) {
    throw new Error(
      `wrapWithPrefix: prefix (${prefix.length}) leaves no room within width ${width}`
    );
  }
  const continuation = prefix + ' '.repeat(hang);
  return wrap(text, budget).map((seg, i) => (i === 0 ? prefix : continuation) + seg);
}

// ---------------------------------------------------------------------------
// Shapes: signpost family
// ---------------------------------------------------------------------------

const STYLES = {
  step:    { lead: '── ', fill: '─' }, // ── name ────  (em-dash)
  substep: { lead: '·· ', fill: '·' }, // ·· name ····  (middle dot)
};

// `── Label ──────…` step marker (default) or `·· Label ··…` sub-step marker,
// padded to `width`. A single line, no trailing newline.
/** @param {string} label @param {{style?: 'step'|'substep', width?: number}} [opts] */
function signpost(label, { style = 'step', width = WIDTH } = {}) {
  const s = STYLES[style];
  if (!s) throw new Error(`signpost: unknown style "${style}" (step|substep)`);
  const text = String(label).trim();
  if (!text) throw new Error('signpost: label is required');
  return fillTo(s.lead + text + ' ', s.fill, width);
}

// Phase-title box — bullet-bordered, fixed width, 2-space title padding, with a
// trailing blank line inside the block (CONVENTIONS.md: phase titles).
//
//   ●───…───●
//     Title
//   ●───…───●
//   <blank>
/** @param {string} title @param {{width?: number}} [opts] */
function box(title, { width = WIDTH } = {}) {
  const text = String(title).trim();
  if (!text) throw new Error('box: title is required');
  const border = '●' + '─'.repeat(width - 2) + '●';
  return `${border}\n  ${text}\n${border}\n\n`;
}

// ---------------------------------------------------------------------------
// Shapes: tree (continuous-gutter, recursive)
// ---------------------------------------------------------------------------

// A row's trailing annotation renders as `[tag]` in the aligned column — the
// kernel only draws the brackets, never knows what the tag means.

// Blank columns between the longest row and the tag column.
const TAG_GAP = 4;

// Render nodes as a continuous-gutter tree. PURE LAYOUT: branch glyphs (├─/└─,
// never ┌─ — the list hangs off whatever header precedes it), a continuous │
// gutter at every depth, a connector from a parent down to its children, body
// word-wrap with the gutter subtracted from the budget, and tags aligned into
// one column. It knows nothing about glyphs, statuses, or provenance — the
// caller composes those (see the domain ring's conventions.cjs).
//
//   ├─ ◐ Ai Content Engine        [researching]   ← title + columnised tag
//   │  │  Summary text wrapped to the budget…      ← body[0], hanging off
//   │  │  ↳ From exploration                       ← body[1], marker hangs
//   │  ├─ ✓ Field Order           [decided]        ← child
//   │  └─ ◐ Truncation Rules      [exploring]
//   └─ ◐ Menu And Admin           [researching]    ← last sibling drops the │
//         Summary with no children sits unconnected
//
// Every sub-line carries the accumulated gutter, so the │ runs unbroken at any
// depth; the body wrap budget is width − gutter, so body can never orphan.
// `gap` opens a gutter-only line between top-level siblings (children stay
// dense) — for trees whose rows carry multi-line bodies. `childIndent` shifts
// every child level right by N extra columns — trees whose rows lead with a
// glyph pass the glyph width so subtrees drop from the title's first letter,
// not from the glyph. `bodyIndent` is how many columns a childless row's body
// sits past the child prefix (default 3; glyphless trees pass 1 so the body
// lands one column past the title's first character).
/** @param {TreeNode[]} nodes @param {{width?: number, gap?: boolean, childIndent?: number, bodyIndent?: number}} [opts] @returns {string} */
function renderTree(nodes, { width = displayWidth(), gap = false, childIndent = 0, bodyIndent = 3 } = {}) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error('renderTree: nodes must be a non-empty array');
  }
  /** @type {{text: string, tag: string|null}[]} */
  const rows = [];
  renderSiblings(nodes, '  ', width, rows, gap, childIndent, bodyIndent);
  return columniseTags(rows, width).join('\n') + '\n';
}

// `prefix` is the accumulated gutter that precedes this level's branch glyphs.
/** @param {TreeNode[]} nodes @param {string} prefix @param {number} width @param {{text: string, tag: string|null}[]} out @param {boolean} [gap] @param {number} [childIndent] @param {number} [bodyIndent] */
function renderSiblings(nodes, prefix, width, out, gap = false, childIndent = 0, bodyIndent = 3) {
  nodes.forEach((node, i) => {
    if (!node || !node.title) throw new Error(`renderTree: node ${i} needs a title`);
    const isLast = i === nodes.length - 1;
    out.push({ text: prefix + (isLast ? '└─ ' : '├─ ') + node.title, tag: node.tag || null });
    // Sub-content lives one level in. The last sibling drops the │ (blank) so
    // nothing dangles below └─.
    const childPrefix = prefix + (isLast ? '   ' : '│  ') + ' '.repeat(childIndent);
    const hasChildren = !!(node.children && node.children.length);
    // With children, the connector runs from this node's glyph through its
    // body down to the last child, so the subtree visibly descends from its
    // parent rather than appearing at an indent. With none there is nothing
    // to connect to, so body indents to the content column instead.
    const bodyPrefix = childPrefix + (hasChildren ? '│  ' : ' '.repeat(bodyIndent));
    for (const para of node.body || []) {
      const text = typeof para === 'string' ? para : para.text;
      const hang = typeof para === 'string' ? 0 : (para.hang || 0);
      for (const wl of wrapWithPrefix(text, { width, prefix: bodyPrefix, hang })) {
        out.push({ text: wl, tag: null });
      }
    }
    if (node.children && node.children.length) {
      renderSiblings(node.children, childPrefix, width, out, false, childIndent, bodyIndent);
    }
    if (gap && !isLast) out.push({ text: prefix + '│', tag: null });
  });
}

// Pad every tagged row out to one shared column so tags line up regardless of
// label length or depth. When the column would push the longest tag past the
// width, it tightens to a single space — the least-overflow layout available;
// a pathological row+tag can still exceed the width and soft-wrap, exactly as
// the inline [tag] form always could.
/** @param {{text: string, tag: string|null}[]} rows @param {number} width @returns {string[]} */
function columniseTags(rows, width) {
  const tagged = rows.filter((r) => r.tag);
  if (!tagged.length) return rows.map((r) => r.text);
  const longestRow = Math.max(...tagged.map((r) => r.text.length));
  const longestTag = Math.max(...tagged.map((r) => String(r.tag).length + 2));
  const column = longestRow + TAG_GAP + longestTag <= width ? longestRow + TAG_GAP : longestRow + 1;
  return rows.map((r) => (r.tag ? r.text.padEnd(column) + `[${r.tag}]` : r.text));
}

module.exports = { WIDTH, TAG_GAP, fillTo, wrap, wrapWithPrefix, signpost, box, renderTree };
