---
name: workflow-engine
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-engine/scripts/engine.cjs)
---

# Workflow Engine

The shared engine behind the workflow skills: deterministic state, derivation, and rendering. Anything fully determined by data is computed here, in code, and consumed by Claude — never re-derived in prose.

Internally layered as rings:

- **Kernel** (`scripts/kernel/`) — mechanism with no workflow vocabulary: render primitives, the wrap/width core. The wrap budget (`width − prefix`) lives here once, so gutter-overflow bugs can exist in only one place.
- **Domain** (`scripts/domain/`) — the workflow ontology: glyph vocabulary, `[tag]` and `↳` composition conventions. Grows queries, projections, and transitions as call sites migrate.
- **Gateway harness** (`scripts/gateway.cjs`) — the uniform verb dispatch every skill's adapter script uses, plus the demarcated output sections.

Two ways in:

- **Library** — scripts `require()` `scripts/lib.cjs` and call functions in-process. The data owner builds structures and calls the renderer; Claude never assembles render input.
- **CLI** — `scripts/engine.cjs`, called from skill .md files at prescribed points.

Output sections are one-directional: DATA is for reasoning and is never displayed; DISPLAY and MENU are emitted to the user verbatim and never parsed for decisions.

## CLI

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs <command> [args]
```

### `render signpost <label> [--style step|substep] [--width N]`

A step or sub-step marker, padded to width (default 49). One line.

```
engine render signpost "Construct Specification"
── Construct Specification ──────────────────────

engine render signpost "Extract Sources" --style substep
·· Extract Sources ······························
```

### `render box <title> [--width N]`

A bullet-bordered phase-title box with a trailing blank line.

```
engine render box "Planning Overview"
●───────────────────────────────────────────────●
  Planning Overview
●───────────────────────────────────────────────●
```

### `render wrap <text> [--width N] [--prefix STR]`

Word-wrap so that `prefix + line` stays within `width`; every line carries the prefix. Utility/inspection command — in code, call `wrapWithPrefix` directly.

### `render tree [--width N]` (reads a JSON node array on stdin)

A continuous-gutter tree. Pure layout — glyphs, tags, and provenance are composed into the strings by the caller. Each node is `{ title, body?: string[], children?: node[] }`; rows hang off the preceding header via `├─`/sole `└─` (never `┌─`); body lines wrap under a continuous `│` gutter with the budget already subtracting the gutter. Default width 72. `title` is single-line and never wrapped.

## Library — `scripts/lib.cjs`

```js
const engine = require('.../skills/workflow-engine/scripts/lib.cjs');

// kernel: pure layout
engine.render.signpost(label, { style, width })   // → string (one line)
engine.render.box(title, { width })               // → string (block)
engine.render.renderTree(nodes, { width })        // → string (recursive tree)
engine.render.wrapWithPrefix(text, { width, prefix }) // → string[] (prefixed lines)
engine.render.wrap(text, budget)                  // → string[] (segments ≤ budget)
engine.render.fillTo(head, fillChar, width)       // → string (padded)

// domain: composition conventions
engine.conventions.title({ glyph, label, tag })   // → "◐ Menu And Admin [researching]"
engine.conventions.tag('decided')                 // → "[decided]"
engine.conventions.derivedFrom('from exploration')// → "↳ From exploration"
engine.conventions.discoveryGlyph('researching')  // → "◐"

// gateway: adapter harness
engine.gateway.runGateway(handlers)               // argv verb dispatch → stdout
engine.gateway.dataBlock(obj | string)            // → demarcated DATA section
engine.gateway.displayBlock(text)                 // → demarcated DISPLAY section
engine.gateway.menuBlock(text)                    // → demarcated MENU section
```

`wrapWithPrefix` throws if the prefix leaves no room within the width — a misconfigured gutter fails loudly rather than silently overflowing.

## Gateway contract

Each skill's adapter script registers handlers and calls `runGateway`:

```js
engine.gateway.runGateway({
  index: () => ...,          // no-args call — the head-of-skill `!` insert
  data:  (wu) => ...,        // reasoning-only flags for housekeeping steps
  view:  (wu) => ...,        // one snapshot: DATA + DISPLAY + MENU
  // skill-specific sub-views by verb; `fallback` catches unmatched argv
});
```

The .md's prescribed call names the verb (`discovery.cjs view {work_unit}`) — the adapter never infers what a call is for.

## Tests

`tests/scripts/test-render.cjs` and `tests/scripts/test-engine-gateway.cjs` (run `node --test tests/scripts/test-render.cjs tests/scripts/test-engine-gateway.cjs`). Type contracts are enforced by `npm run typecheck` (JSDoc + `tsc --noEmit`). Add a test alongside any change to engine scripts.
