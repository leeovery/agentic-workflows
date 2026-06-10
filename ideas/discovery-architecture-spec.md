# Discovery / Projection Architecture Spec (Draft)

Status: **draft for mark-up.** Companion to [deterministic-tree-and-menu-renderer.md](deterministic-tree-and-menu-renderer.md). That doc covers the renderer (built). This doc covers the *integration* — how each skill's discovery script, the data it holds, and the deterministic renders fit together cleanly. Written to be handed to an implementing agent once the open decisions (§9) are settled.

---

## 1. Goal

Two outcomes, one architecture:

1. **Deterministic display.** Trees, menus, and signposts are computed by code and emitted verbatim — never hand-drawn in skill prose. (The renderer that does this is already built; see §3.)
2. **Less per-skill boilerplate.** Today each skill's `discovery.cjs` re-implements its own phase looping, detail-building, and text formatting. Move the *generic* machinery to one place; keep each skill's *specifics* declared in that skill.

The guiding constraint, in the user's words: **do not centralise skill-specific knowledge.** A central blob of "every skill's data structures woven into logic" is the thing to avoid. Each skill must remain the single, legible place where *what that skill needs* is declared.

## 2. The anchor pattern — mirror the manifest CLI

The manifest CLI is the model to copy:

> The **manifest CLI** is a *generic read layer*. It holds zero skill knowledge; each skill supplies the **dot-paths** it wants (`get <wu>.specification.<topic> status`).

Do the same for shaping + rendering:

> A **generic engine** — also zero skill knowledge; each skill supplies a **declaration** (schema) describing the data it needs and how to render it.

So skill-specific knowledge lives *in the skill*, declared next to where it's used. The central code is a dumb interpreter + the renderer. Open one skill's discovery script → see everything that skill needs, in one place.

## 3. What already exists (do not rebuild)

- **`skills/workflow-render/scripts/render.cjs`** — generic layout primitives, pure, no domain knowledge:
  - `signpost(label, {style})`, `box(title)` — Family-1 shapes.
  - `renderTree(nodes, {width})` — recursive `{ title, body?, children? }` tree. Owns branch glyphs, the continuous `│` gutter, and wrap-with-gutter-budget (the original bug is structurally impossible). Width default 72.
  - `wrap` / `wrapWithPrefix` / `fillTo` — the core. **`wrapWithPrefix` is the single home of the gutter-budget math.**
- **`skills/workflow-render/scripts/conventions.cjs`** — domain composition: `title({glyph,label,tag})`, `tag()`, `derivedFrom()` (the `↳` line), `discoveryGlyph()` + the tier vocabulary, `titlecase()`.
- These are sound and tested (PRs #348, #351). The renderer is the **presentation layer** below; this spec is about everything above it.

## 4. The layers

```
┌── PER SKILL ────────────────────────────────────────────────┐
│  SKILL .md      ── invoke ──▶  scripts/discovery.cjs         │
│  emits verbatim / reads        (thin: holds the skill's      │
│                                 schema; delegates to engine) │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌── ENGINE  (central, generic — workflow-shared or workflow-data) ──┐
│   run({ skill, command, params }):                          │
│     1. load the calling skill's schema                      │
│     2. read manifest per schema (data layer)                │
│     3. apply the schema's derive() functions                │
│     4. if command is a VIEW → render it                     │
│     5. return reasoning text  OR  a finished display block  │
└───────────────┬───────────────┬───────────────┬────────────┘
        data    │      display   │      display  │
        ┌───────▼──────┐  ┌──────▼──────┐  ┌─────▼─────┐
        │ dump / data  │  │  dashboard  │  │   menu    │   ◀ projections
        └──────────────┘  └──────┬──────┘  └─────┬─────┘
                                 ▼               ▼
                   ┌─────────────────────────────────┐
                   │ render.cjs + conventions.cjs     │   ◀ presentation (built)
                   └─────────────────────────────────┘
```

- **Data layer** — reads the project-level manifest into the `detail` object. The generic builder replaces each skill's bespoke `buildXDetail()`; the irreducible computations stay as skill functions (see §7).
- **Projection layer** — deterministic views off the one `detail`, produced *on demand* (one command → one output): `dump`/`data` (reasoning text), `dashboard` (display block), `menu` (display/actions).
- **Presentation** — already built.

## 5. Two kinds of output (the surfaces)

Everything is text on stdout, but two distinct kinds:

| Surface | Commands | Claude does | Today |
|---|---|---|---|
| **Reasoning** | `overview`, `data` | **reads** the labelled text to decide (selection, gating, routing) | the data dump on `main` |
| **Display** | `dashboard`, `menu` | **emits verbatim** in a code block | hand-drawn in the `.md` |

Hard rule (carried from the renderer doc): **the display is write-only-to-the-user.** Never parse a rendered tree to extract a decision — decision data comes from the reasoning surface.

## 6. Invocation mechanics (grounded in the codebase — not invented)

Two mechanisms exist in the tree today; they do **not** mix:

1. **`!`…`` dynamic insertion** — runs at skill **load**, injects stdout. **Always parameterless.** All six in the codebase are `discovery.cjs` with no args. It **cannot** interpolate `{work_unit}`. → used for the head-of-skill **overview**.
2. **Plain ```bash``` block with `{work_unit}`** — Claude runs it as a tool call, substituting the variable. ~14 exist (Step 7 re-run, backfill, bridge, …). → used for every **scoped** call.

Consequence — the command surface must split along that line:

| Need | Invocation | Mechanism |
|---|---|---|
| head overview (all units, for selection) | `discovery.cjs` | `!` auto-insert (load) |
| scoped reasoning data | `discovery.cjs data {work_unit}` | manual bash |
| rendered dashboard | `discovery.cjs dashboard {work_unit}` | manual bash |
| rendered menu | `discovery.cjs menu {work_unit}` | manual bash |

**The deterministic render is a manual bash call at the display step.** Today the display reference hand-draws from the in-context `detail` (no display-time invocation); the new model adds one scoped manual call where the display is emitted — the same pattern as the existing `discovery.cjs {work_unit}` re-run. There is no magic variable insertion.

## 7. The skill schema — epic strawman (grounded in the live `detail`)

The current `buildEpicDetail` returns (verbatim from `main`):

```
{ phases, in_progress, completed, cancelled, next_phase_ready,
  unaccounted_discussions, reopened_discussions, discovery_map,
  convergence_state, needs_sequencing, map_summary,
  imports_count, seeds_count, analysis_caches, gating }
```

A skill's discovery script would *declare* this rather than imperatively build it. Strawman (illustrative, not final):

```js
// skills/workflow-continue-epic/scripts/discovery.cjs
module.exports = defineDiscovery({
  phases: ['discovery','research','discussion','specification','planning','implementation','review'],

  // regular shape — declarative
  enrich: {
    specification: ['sources'],            // → entry.sources
    planning:      ['format','deps'],      // → entry.format, deps_blocking
    implementation:['progress'],           // → current_phase, completed_tasks
  },

  // irreducible algorithms — plain functions, defined HERE in the skill,
  // referenced by the schema; NEVER absorbed into the engine
  derive: {
    discoveryMap:     buildDiscoveryMap,   // tier/lifecycle/provenance per topic
    nextPhaseReady:   computeNextPhaseReady,
    gating:           computeGates,
    // unaccounted/reopened discussions, map_summary, convergence_state, …
  },

  // views the engine renders on demand; the node-mapping (epic-specific) is here
  views: {
    data: dumpDefault,                     // labelled reasoning text (≈ today's format())
    dashboard: state => layout(
      box(state.name),
      stage('DISCOVERY',  tree(state.discoveryMap, t => ({
        title: title({ glyph: t.tier, label: titlecase(t.name), tag: lifecycleLabel(t) }),
        body:  [t.summary, t.provenance && derivedFrom(t.provenance)].filter(Boolean),
      })), { callouts: stageMetaCallouts(state) }),
      stage('DEFINITION', phaseTrees(state, ['specification','planning'])),
      stage('DELIVERY',   phaseTrees(state, ['implementation','review'])),
    ),
    menu: state => actionMenu(state.nextPhaseReady /* + lifecycle actions */),
  },
});
```

Everything epic-specific (`buildDiscoveryMap`, `lifecycleLabel`, the dashboard layout, the menu mapping) sits in the epic skill. The engine never learns what an epic is.

### Engine contract

```
run({ skill, command, params }):
  schema  = require(skill's discovery declaration)
  detail  = buildDetail(manifest, schema)        // generic loop + schema.enrich + schema.derive
  switch command:
    'data'      → stdout: dumpDefault(detail)            // reasoning
    'dashboard' → stdout: schema.views.dashboard(detail) // display, via render.cjs
    'menu'      → stdout: schema.views.menu(detail)      // display
    (no command, no params) → stdout: overview(all units) // the head `!` insert
```

## 8. Two flavours — decide in §9

- **(A) Declarative schema → generic engine** (above). Cleanest separation; risk is the schema growing into a DSL. Mitigation: keep it declarative only for the regular shape; push all real logic into `derive`/view functions that live in the skill.
- **(B) Rich shared toolkit, skill composes.** No schema *format*; the skill's script imports a strong toolkit (manifest reads + transforms + renderer) and composes it imperatively. Same outcome (knowledge in-skill, central generic), less machinery, slightly more imperative scripts.

Recommendation: **prototype the epic in flavour (A) on paper first**; if the schema reads clean and the `derive` escape-hatch sits comfortably, take (A); if it feels like a framework, fall back to (B). (Same empirical move that de-risked the renderer.)

## 9. Open decisions (resolve before building)

1. **Flavour** — declarative schema (A) vs rich toolkit (B).
2. **Central location** — extend `workflow-shared/scripts/` (already home to `discovery-utils.cjs`) vs a new `workflow-data` skill.
3. **Language** — JS + JSDoc typedefs (lean: gives the `detail`/node contracts, low friction) vs full TypeScript. **No bundling needed either way** — pure, no npm deps, `require`d directly like `discovery-utils` (unlike `knowledge.cjs`, which bundles only for its deps). No classes.
4. **`data`/`dump` format** — stays labelled text, or becomes structured (JSON Claude reads)?
5. **Menu** — how much is code-generated vs Claude-built? (The render is deterministic; the *routing* of the user's choice stays in the `.md`.)
6. **Per-skill `discovery.cjs` consolidation order** — epic first as the reference; then one skill at a time.

## 10. Migration principles

- **Keep the renderer core** (#348/#351) — it's the presentation layer, unchanged.
- **Build the engine + the epic schema as the first consumer**, validated against fixtures (this repo has no `.workflows/`, so tests use realistic `detail` fixtures, as the spike did).
- **Behaviour-preserving** — the `data`/`overview` reasoning output stays byte-stable during migration so the many reasoning consumers don't break. Display is allowed to change only where we intend it (the renderer's `↳` provenance, 8-col gutter, width-72 wrap — already agreed).
- **One skill at a time.** Epic proves the shape; feature/bugfix/quickfix/cross-cutting/start follow.
- **Skills' `.md` stay thin** — a scoped call + "emit verbatim" / "read to route," no layout prose.

## 11. Explicitly out of scope here

- The renderer internals (done).
- Rewriting all discovery scripts at once (incremental only).
- Changing the manifest schema or the manifest CLI.
- The no-discovery-map epic branch and recommendation logic — port after the main path proves out.
