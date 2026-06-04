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

## Library API

```js
const { signpost, box, wrap, wrapWithPrefix, fillTo, WIDTH } =
  require('.../skills/workflow-render/scripts/render.cjs');

signpost(label, { style, width })          // → string (one line)
box(title, { width })                       // → string (block, trailing blank)
wrapWithPrefix(text, { width, prefix })     // → string[] (each line prefixed)
wrap(text, budget)                          // → string[] (segments ≤ budget)
fillTo(head, fillChar, width)               // → string (head padded to width)
```

`wrapWithPrefix` throws if the prefix leaves no room within the width — a misconfigured gutter fails loudly rather than silently overflowing.

## Tests

`tests/scripts/test-render.cjs` (run `node --test tests/scripts/test-render.cjs`). Add a test alongside any change to `render.cjs`.
