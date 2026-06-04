#!/usr/bin/env node
'use strict';

const fs = require('fs');

// ---------------------------------------------------------------------------
// Deterministic renderer for fixed-shape workflow output.
//
// Layout that is fully determined by data is computed here, in code, and
// emitted verbatim — never re-derived character-by-character by the model on
// every render. This is both a LIBRARY (scripts `require()` it and call the
// functions in-process) and a CLI (Claude invokes it via Bash for trivial
// shapes). The wrap/width math lives here once, so the gutter-budget bug can
// exist in exactly one place.
//
// Slice 1: the shared width/wrap core + the signpost family (step markers,
// sub-step markers, phase-title boxes). Menus, lists, and trees build on the
// same core later.
// ---------------------------------------------------------------------------

const WIDTH = 49; // canonical fixed width (CONVENTIONS.md: phase titles, markers)

// ---------------------------------------------------------------------------
// Core: width + wrap primitives
// ---------------------------------------------------------------------------

// Fill a head string out to `width` with `fillChar`. If the head already meets
// or exceeds the width, it is returned unchanged (never truncated, never a
// negative repeat).
function fillTo(head, fillChar, width) {
  const deficit = width - head.length;
  return deficit > 0 ? head + fillChar.repeat(deficit) : head;
}

// Greedy word-wrap `text` into segments no wider than `budget` columns. A word
// longer than the budget is hard-split (so a long unbroken token can never
// overflow the budget). Returns an array of segments with no trailing spaces.
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
function wrapWithPrefix(text, { width = WIDTH, prefix = '' } = {}) {
  const budget = width - prefix.length;
  if (budget < 1) {
    throw new Error(
      `wrapWithPrefix: prefix (${prefix.length}) leaves no room within width ${width}`
    );
  }
  return wrap(text, budget).map((seg) => prefix + seg);
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
function box(title, { width = WIDTH } = {}) {
  const text = String(title).trim();
  if (!text) throw new Error('box: title is required');
  const border = '●' + '─'.repeat(width - 2) + '●';
  return `${border}\n  ${text}\n${border}\n\n`;
}

// ---------------------------------------------------------------------------
// Shapes: tree (continuous-gutter, recursive)
// ---------------------------------------------------------------------------

// Render nodes as a continuous-gutter tree. PURE LAYOUT: branch glyphs (├─/└─,
// never ┌─ — the list hangs off whatever header precedes it), a continuous │
// gutter at every depth, body word-wrap with the gutter subtracted from the
// budget, and recursion for children. It knows nothing about glyphs, tags, or
// provenance — the caller composes those into the strings (see conventions.cjs).
//
//   ├─ ◐ Ai Content Engine [researching]      ← title (caller-composed line)
//   │      summary text wrapped to the budget…  ← body[0]
//   │      ↳ From exploration                   ← body[1]
//   ├─ → Decision-Point INFO Line Shape
//   │  ├─ ✓ Field Order                         ← child
//   │  └─ ◐ Truncation Rules
//   └─ ◐ Menu And Admin [researching]           ← last sibling drops the │
//
// node: { title, body?: string[], children?: node[] }
//   title    — the one-line header row (glyph + label + tag already baked in)
//   body     — paragraphs beneath the row; each wraps independently
//   children — nested nodes, same shape, recursively
//
// Every sub-line carries the accumulated gutter, so the │ runs unbroken at any
// depth; the body wrap budget is width − gutter, so body can never orphan.
function renderTree(nodes, { width = 72 } = {}) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error('renderTree: nodes must be a non-empty array');
  }
  const out = [];
  renderSiblings(nodes, '  ', width, out);
  return out.join('\n') + '\n';
}

// `prefix` is the accumulated gutter that precedes this level's branch glyphs.
function renderSiblings(nodes, prefix, width, out) {
  nodes.forEach((node, i) => {
    if (!node || !node.title) throw new Error(`renderTree: node ${i} needs a title`);
    const isLast = i === nodes.length - 1;
    out.push(prefix + (isLast ? '└─ ' : '├─ ') + node.title);
    // Continuation gutters. The last sibling drops the │ (blank) so nothing
    // dangles below └─. Body hangs under the row; children branch one step in.
    const bodyPrefix = prefix + (isLast ? ' ' : '│') + '      ';
    const childPrefix = prefix + (isLast ? '   ' : '│  ');
    for (const para of node.body || []) {
      for (const wl of wrapWithPrefix(para, { width, prefix: bodyPrefix })) out.push(wl);
    }
    if (node.children && node.children.length) {
      renderSiblings(node.children, childPrefix, width, out);
    }
  });
}

// ---------------------------------------------------------------------------
// Exports (library use)
// ---------------------------------------------------------------------------

module.exports = { WIDTH, fillTo, wrap, wrapWithPrefix, signpost, box, renderTree };

// ---------------------------------------------------------------------------
// CLI (Claude / shell use) — guarded so `require()` never runs it.
// ---------------------------------------------------------------------------

function die(msg) {
  process.stderr.write(msg + '\n');
  process.exit(1);
}

// Minimal flag parser: collects `--key value` pairs and bare positionals.
function parseArgs(argv) {
  const opts = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      opts[a.slice(2)] = argv[++i];
    } else {
      positional.push(a);
    }
  }
  return { opts, positional };
}

function runCli(argv) {
  const [command, ...rest] = argv;
  const { opts, positional } = parseArgs(rest);
  const width = opts.width !== undefined ? parseInt(opts.width, 10) : WIDTH;

  switch (command) {
    case 'signpost':
      if (!positional.length) die('Usage: render signpost <label> [--style step|substep] [--width N]');
      process.stdout.write(signpost(positional.join(' '), { style: opts.style || 'step', width }) + '\n');
      break;
    case 'box':
      if (!positional.length) die('Usage: render box <title> [--width N]');
      process.stdout.write(box(positional.join(' '), { width }));
      break;
    case 'wrap': {
      if (!positional.length) die('Usage: render wrap <text> [--width N] [--prefix STR]');
      const lines = wrapWithPrefix(positional.join(' '), { width, prefix: opts.prefix || '' });
      process.stdout.write(lines.join('\n') + '\n');
      break;
    }
    case 'tree': {
      // Reads a JSON node array from stdin (the data-owner builds it).
      const input = fs.readFileSync(0, 'utf8');
      const treeWidth = opts.width !== undefined ? width : undefined;
      process.stdout.write(renderTree(JSON.parse(input), treeWidth ? { width: treeWidth } : {}));
      break;
    }
    default:
      die(`Unknown command "${command || ''}"\nCommands: signpost, box, wrap, tree`);
  }
}

if (require.main === module) {
  try {
    runCli(process.argv.slice(2));
  } catch (err) {
    die(err.message);
  }
}
