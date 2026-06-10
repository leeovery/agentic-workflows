---
name: workflow-render
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-render/scripts/render.cjs)
---

# Workflow Render

Deterministic renderer for fixed-shape workflow output. Layout that is fully determined by data is computed here, in code, and emitted verbatim — never re-derived character-by-character on every render. The wrap/width math lives here once, so the gutter-budget bug can exist in only one place.

Two ways in:

- **CLI** — Claude invokes it via Bash for trivial-input shapes (a label, a title). Print the result verbatim to the user.
- **Library** — other scripts `require()` it and call the functions in-process. The data-owner (e.g. `discovery.cjs`) builds the structure and calls the renderer; Claude never assembles the input.

The output is for display. Never read a rendered block back to extract a decision — decision data comes from structured state, not from parsing the rendered text.

## Invocation

```bash
node .claude/skills/workflow-render/scripts/render.cjs <command> [args]
```

All shapes are a fixed `--width` (default `49`, the canonical workflow width).

## Commands

### `signpost <label> [--style step|substep] [--width N]`

A step or sub-step marker, padded to width. One line.

```
render signpost "Construct Specification"
── Construct Specification ──────────────────────

render signpost "Extract Sources" --style substep
·· Extract Sources ······························
```

Loop and route labels are passed verbatim: `render signpost "Task Execution (3 of 12)"`.

### `box <title> [--width N]`

A bullet-bordered phase-title box with a trailing blank line.

```
render box "Planning Overview"
●───────────────────────────────────────────────●
  Planning Overview
●───────────────────────────────────────────────●
```

### `wrap <text> [--width N] [--prefix STR]`

Word-wrap `text` so that `prefix + line` stays within `width`; every line carries the prefix (the gutter/indent). The wrap budget is `width − prefix.length` — this is the primitive trees and wrapped lists build on. Utility/inspection command; in code, call `wrapWithPrefix` directly.

### `tree [--width N]` (reads a JSON node array on stdin)

A continuous-gutter tree. Pure layout — it knows nothing about glyphs, tags, or provenance; the caller composes those into the strings (see **Conventions** below). The data-owner (e.g. `discovery.cjs`) builds the node array and pipes it in; Claude does not assemble it.

```bash
echo '[{"title":"◐ Ai Content Engine [researching]","body":["summary…","↳ From exploration"],
       "children":[{"title":"✓ Field Order [decided]"}]}]' | render tree --width 72
```

Each node is `{ title, body?: string[], children?: node[] }`:
- **`title`** — the one-line header row, already composed (`glyph label [tag]`). Rows hang off whatever header precedes them via `├─` (or sole `└─`) — never `┌─`.
- **`body`** — paragraphs beneath the row; each wraps independently under a continuous `│` gutter (dropped on the last sibling). The budget already subtracts the gutter, so body can never orphan.
- **`children`** — nested nodes, same shape, recursively; the gutter accumulates at every depth.

Default width is 72 (`--width` / `{ width }` to override). `title` is single-line and data-determined — a long one isn't wrapped (wrapping would break glyph alignment).

## Conventions — `scripts/conventions.cjs`

The domain-aware layer: it knows what workflow content should *look* like (the glyph vocabulary, the `[tag]` format, the `↳` derived-from line) and produces the plain strings the renderer lays out. Keeps format normalised in one place while the renderer stays domain-free. Grown as call sites are wired.

```js
const { title, tag, derivedFrom, capitalise, discoveryGlyph } =
  require('.../skills/workflow-render/scripts/conventions.cjs');

title({ glyph, label, tag })   // → "◐ Menu And Admin [researching]" (a node title)
tag('decided')                 // → "[decided]"
derivedFrom('from exploration')// → "↳ From exploration"
discoveryGlyph('researching')  // → "◐"  (tier → canonical symbol)
```

## Library API — `scripts/render.cjs`

```js
const { signpost, box, renderTree, wrap, wrapWithPrefix, fillTo, WIDTH } =
  require('.../skills/workflow-render/scripts/render.cjs');

signpost(label, { style, width })          // → string (one line)
box(title, { width })                       // → string (block, trailing blank)
renderTree(nodes, { width })                // → string (recursive tree)
wrapWithPrefix(text, { width, prefix })     // → string[] (each line prefixed)
wrap(text, budget)                          // → string[] (segments ≤ budget)
fillTo(head, fillChar, width)               // → string (head padded to width)
```

`wrapWithPrefix` throws if the prefix leaves no room within the width — a misconfigured gutter fails loudly rather than silently overflowing.

## Tests

`tests/scripts/test-render.cjs` (run `node --test tests/scripts/test-render.cjs`). Add a test alongside any change to `render.cjs` or `conventions.cjs`.
