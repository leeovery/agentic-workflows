---
name: workflow-engine
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-engine/scripts/engine.cjs)
---

# Workflow Engine

The platform behind the workflow skills: deterministic state, derivation, and rendering. Anything fully determined by data is computed here, in code, and consumed by Claude — never re-derived in prose.

This skill is a reference, not a flow. In normal use the workflow prose prescribes exact engine calls at exact points; consult this documentation when you need to understand how the engine works — a command's full contract, the library surface, or the architecture — rather than which call to make next.

## Architecture

Three rings under `scripts/`:

- **Kernel** (`kernel/`) — mechanism plus the manifest's on-disk contract: render primitives (the wrap budget `width − prefix` lives here once, so gutter-overflow bugs can exist in only one place), `manifest-io.cjs` (one read/parse, one atomic-write serialisation, one lock protocol — every manifest writer flows through it), and `manifest-schema.cjs` (the single vocabulary of legal work types, phases, and statuses). Every engine load→mutate→save holds the manifest lock; KB syncs and commits run after release.
- **Domain** (`domain/`) — the workflow ontology: transitions, queries, projections, glyph and `[tag]` composition conventions, and the shared derivations in `discovery-utils.cjs` (lifecycle joins, next-phase computation, cache status) consumed by the domain ring and every per-skill read adapter.
- **Gateway** (`gateway.cjs`) — the uniform verb-dispatch harness every per-skill adapter (`skills/*/scripts/gateway.cjs`) runs on, plus the demarcated output sections.

Two doors:

- **CLI** (`engine.cjs`) — writes: transactions, lifecycle, and the `manifest` field surface. Called from skill prose at prescribed points.
- **Library** (`lib.cjs`) — reads: adapter scripts `require()` it in-process for detail builders, projections, and the gateway harness.

Output sections are one-directional: `DATA` is for reasoning and is never displayed; `DISPLAY` and `MENU` are emitted to the user verbatim and never parsed for decisions.

**Rendering is not a runtime CLI concern.** Static chrome lives as literal blocks in skill prose; parameterised chrome is rendered in-process by projections. The `render` command group in `engine.cjs` is a development utility only.

## Reference

- **[commands.md](references/commands.md)** — the CLI catalogue: command grammar, the response contract, and every noun's full signature and behaviour (`boot`, `manifest`, `workunit`, `topic`, `discovery-map`, `discovery-session`, `discussion-map`, `task`, `inbox`, `cache`, `commit`).
- **[library-and-gateway.md](references/library-and-gateway.md)** — the `lib.cjs` surface (render kernel, manifest IO, conventions, detail builders, projections) and the gateway contract adapter scripts implement.

## Tests

Engine suites are wired into `npm test` (with shell contract suites under `npm run test:cli`) — `package.json` is the authoritative list. Type contracts: `npm run typecheck` (JSDoc + `tsc --noEmit`). Add a test alongside any change to engine scripts.
