# Render Surfaces — moving menus and complex output into the engine

Design log for the render-surface programme. Long-lived branch, PR'd early,
merged when the programme lands. Dated entries append; decisions are edited in
place only to mark them superseded.

## Motivation (2026-07-21)

The engine campaign codified the *navigation* surfaces — start, continue-*,
the epic dashboard, map-view all emit engine-rendered DATA/DISPLAY/MENU
sections verbatim. The *phase-internal* surfaces — approval gates, findings
loops, task gates, resume gates, confirmation lines — remained prose templates
the model assembles at runtime. Two production incidents on Portal showed the
cost:

- **Planning task-list gate**: the prescribed display is a code block with
  one-line task summaries and comma-separated edge cases. The model emitted
  markdown instead of a code block and poured the task designer's full
  implementation detail into the overview — nine lines of argv arrays where
  one summary line belongs. Nothing enforces the shape, so the shape drifts.
- **Findings frame**: the `╭─ Finding … ─╮` boxed frame renders with a border
  that stops short of the content width — prose cannot compute widths.

The principle, per Lee: *menus and complex outputs are not rendered by the
LLM. Code produces structured content; the LLM blindly copies it to the
terminal.* Judgment decides; code renders.

## Census (2026-07-21)

Mechanical enumeration of every rendering-instruction-preceded fence in
`skills/`: **473 menu/display sites** — 296 templated, 177 static (plus 86
markers and 111 signposts, which are chrome, out of scope). Extraction script:
render-census.cjs (session scratchpad; re-runnable).

Key finding: **most "dynamic" content is already persisted at render time.**
The templates' own placeholder annotations say "from tracking file", "from the
planning file", "from task detail file"; validation surfaces reference their
cache paths. Genuine this-turn judgment payloads are rare.

### Surface families

| Family | ~Sites | Data source | Contract |
|---|---|---|---|
| Select/validate/display (continue-* ×5) | 30 | engine state | address (folds into clone-family factory) |
| Bridge continuations (×4 types) | 14 | manifest phase status | address |
| Resume gates (shared + inline variants) | 10 | file existence + manifest markers | address |
| Findings/approval loops (process-review-findings ×2 near-identical, analysis-approval-gate, spec-construction) | 35 | cache tracking files + gate modes | address |
| Task gates (define-tasks, author-tasks, analysis-loop, review-actions-loop) | 25 | task content + gate modes | **payload** (task content lives in markdown — never parsed) + address (gate mode) |
| Agent-verdict surfaces (validations, task review, task-graph) | 15 | agent output → cache | address after persist-first flip |
| Transaction confirmations ("Cancelled X", ⚑ warnings) | 45 | the engine response itself | fold into transaction verbs |
| Entry validation/error blocks | 35 | manifest state | address |
| Conversational judgment (openers, briefings, session prompts) | 50 | model synthesis | **stays prose** |
| Static menus/confirms | 88 | none | see Decisions |

## The contract

1. **Address-backed by default — JSON state only.** `engine render <surface>
   <work_unit>[.<phase>[.<topic>]]` reads manifest and cache (JSON). The
   engine **never parses markdown artifacts** to populate a render — markdown
   scraping is error-prone and forbidden (same rule as migrations vs the field
   surface).
2. **Payload for judgment content and markdown-held content.** Claude writes
   JSON to the phase cache dir with the Write tool (no shell quoting), passes
   `--file <path>`; the engine validates loudly per-field (the
   `--proposed-file` precedent) and renders. Scalars may ride as flags.
3. **Persist-first.** If a flow shows-then-persists JSON-representable state,
   flip the order and render from the address; never invent a payload for
   state that should exist.
4. **Gate modes render inside the surface.** A surface whose menu is
   gate-mode-coupled reads the mode from the manifest at the same address and
   returns either the menu or the auto-proceed line — the model no longer
   branches on mode.
5. **Output shape**: the existing demarcated-section contract —
   `=== DISPLAY ===` emitted verbatim as a code block, `=== MENU ===` verbatim
   as markdown. No new emission rules for skills to learn.
6. **One builder.** Every surface renders through shared primitives in
   `domain/projections` (menu, dot frame, callout, key, boxed frame). Boxed
   frames compute borders from content width — fixing the findings-frame
   defect by construction. Restyle in one place.

## Layering

- `domain/projections/surfaces.cjs` — the primitives (pure functions,
  byte-golden tested).
- `domain/render.cjs` — the surface catalogue: named surfaces mapping
  (address, payload) → sections. Documented in the engine SKILL.md.
- `engine render <surface> …` — the single CLI noun for shared surfaces.
- Skill gateways keep skill-specific surfaces (select/display family — the
  clone-family factory), built on the same primitives.
- Transaction verbs absorb their own confirmation lines (existing
  labelled-section pattern, extended).

## Decisions

- **D1 (2026-07-21)**: Pilot surfaces are `resume-gate` (address-backed,
  7 consumers via the shared reference) and `task-list` (payload + gate-mode
  absorption — the Portal incident case). Agreed with Lee.
- **D2 (2026-07-21)**: Markdown artifacts are never parsed by render surfaces
  (Lee). Task/finding content reaches the engine as parameters at authoring
  time or from JSON cache written at persist time.
- **D3 — open**: the 88 static menus. Options: (a) fold the gate-coupled ones
  into their surfaces, leave standalone confirms in prose under the existing
  lint; (b) full purity — every menu a catalogue entry (~30 extra entries).
  Leaning (a); Lee to decide by the static-sweep stage.
- **D4 — open**: closing lint — "a templated menu/display fence in prose is a
  violation" once the sweep completes (mechanically decidable).
- **D5 (2026-07-21)**: task-shaped displays use the subsection grammar — name
  line, `·`-glyphed wrapped summary, `· Edge cases` header owning a flat
  wrapped tree; continuations never fall to column zero (Lee, from the A′
  mock). Multi-phase displays (phase-structure approval, plan summary,
  task-graph view — stage 3) render as trees: numbered phase nodes with
  task/goal children, same primitives, one visual grammar.
- **D6 (2026-07-21)**: assembly idioms live in `projections/surfaces.cjs` —
  the sanctioned middle layer between the mechanism kernel and per-surface
  projections that the campaign's two-layer doctrine lacked (which is where
  the five dot-frame copies accumulated). The dot-rule literal is pinned to
  one module by a single-source invariant test; the callout idiom is
  structurally single-sourced (no mechanical invariant — inline ⚑ headers
  make a content grep false-positive-prone).

## Staged plan

1. **Primitives + `engine render` + pilots** — surfaces.cjs, render.cjs, the
   noun, `resume-gate` + `task-list`, consumer swaps (shared
   resume-detection.md; define-tasks.md), byte-golden tests. Proves the
   contract end-to-end.
2. **Findings/approval family** — unify the two near-identical
   process-review-findings copies; analysis-approval-gate; spec-construction
   gates. Boxed-frame fix lands user-visibly here.
3. **Task gates** — author-tasks, analysis-loop + review-actions-loop
   (byte-identical task displays today), plan-construction's twin gate.
4. **Bridge + continue-*** — merges with the clone-family consolidation
   ledger item (same files, same factoring).
5. **Entry validation + transaction folds.**
6. **Static sweep + closing lint** (D3/D4 decided).

Each stage is a stacked PR; stack driven per the pr-stacked skill
(author → chain PR bases → `safe-stack sync` → review → `safe-stack merge`).

## Log

- 2026-07-21 — Census run (473 sites), families table drawn, contract and
  layering agreed in session with Lee. Portal incidents recorded as
  motivation. Doc branch opened; stage 1 begins.
- 2026-07-21 — Stage 1 up (#490): surfaces primitives, `engine render`
  catalogue, resume-gate + task-list pilots, consumer swaps. Lee's review
  drove the subsection grammar (D5), surfaced the assembly-idiom duplication
  (D6 — four projections adopted, byte-identity by golden pins), and the
  boxed-frame width fix landed in the primitive. Option grammar became
  builders (cmdOption/promptOption/rangeOption) with a third single-source
  invariant; 22 legacy literals converted.
- 2026-07-21 — Stage 2 up (#491): finding + findings-summary unify the two
  near-identical process-review-findings references; diff frame ships as
  three sections so ```diff colouring survives; frame borders computed from
  content, capped at 100 so a border never wraps. Banked separately: cache
  purge at work-unit close (design settled).
- 2026-07-21 — Stage 3 up (#492): proposed-task (analysis + review loops'
  byte-identical twins unified; gate mode as a flag — mode ownership differs
  per consumer), tasks-overview, author-task-gate, phase-tree (D5 delivered;
  define-phases gains shaped output), task-list --variant existing for
  plan-construction's twin gate. Stack synced: main → #490 → #491 → #492.
  Remaining: stage 4 (bridge + continue-* = clone-family), stage 5 (entry
  validation + transaction folds), stage 6 (static sweep + D4 lint).
