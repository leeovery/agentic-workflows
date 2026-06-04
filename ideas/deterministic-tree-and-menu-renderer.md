# Deterministic Renderer for Trees, Menus & Signposts (Stop Asking Claude to Draw ASCII by Hand)

## The Idea

Across the workflow skills, a great deal of output is **structured ASCII layout** that Claude is currently instructed to draw by hand on every render: tree diagrams (`┌─ ├─ └─` with `│` continuation gutters), numbered selection menus, signpost banners (`── Section ──`), key/legend blocks, and the dotted `· · ·` gate prompts. The skill markdown describes the layout in prose ("hard-wrap the summary at 65 characters, prepend `│` + 6 spaces…") and the model re-derives the exact characters each time.

This is the wrong division of labour. Layout that is fully determined by data should be computed by **deterministic code** and emitted by Claude **verbatim**, not reasoned out character-by-character on every invocation.

The proposal: build a small shared renderer (e.g. `lib/render/tree.cjs`, and siblings for menus) that takes a structured description (a schema/IR) and returns the finished, gutter-correct, wrapped text block. Skills then shrink from "here's how to draw a tree" to "print the prepared block verbatim." Start with the tree renderer (highest payoff, most error-prone), then consider extending the same approach to selection menus, signposts, legends — anywhere Claude is laying out fixed-shape content.

Expected benefits:
- **Correctness** — the gutter/branch/wrap math happens once, in code, and is identical every time.
- **Lower token + reasoning cost over time** — the model stops spending output and attention on character arithmetic on every render. This was the user's primary motivation: less model work, more determinism.
- **Single source of truth** — the off-by-gutter wrap bug (below) can only exist in one place, where it's fixed once for all skills.

> **Note on ownership:** designing the actual schema is explicitly **not** part of this idea — it's the implementer's job. This file captures the motivating bug, the discussion, and the shape of the opportunity. A survey of every tree/menu render across the skills should precede schema design.

## What Happened (the motivating bug)

While resuming the `quiz-competition-v1` epic via `/workflow-start` → continue-epic, the discovery map rendered through **section A of `workflow-continue-epic/references/epic-display-and-menu.md`**. The map has 9 topics, each a `○` fresh row with a wrapped multi-line summary beneath it, all joined by a `│` continuation gutter forming a single vertical tree.

Two of the nine rows rendered **broken**: "Game And Content Engine" and "Synchronous Round Engine." Their summary text overran and the overflow wrapped back to **column 0** — i.e. it fell out from under the `│` gutter — visually snapping the tree in half at those rows. The other seven rows looked fine because their wrapped lines happened to be shorter.

The user reported it directly: *"the game and content engine description seems broken, and it's broken the tree view. Synchronous round engine is also a little broken."* and asked whether it was the skill's rendering instructions or just model weirdness.

## Root Cause

It was the skill's instructions, not model weirdness — a **wrap-budget bug**.

The "Summary / provenance sub-lines" rule in `epic-display-and-menu.md` says to *hard-wrap the summary text at 65 characters*. But every summary sub-line is then prefixed with a **7-character tree gutter** (`│` + 6 spaces for non-last topics, or 7 spaces for the last topic — the `{gutter}` rule in the same bullet). So a line wrapped to the full 65 chars of *text* actually renders at **72 columns** on screen.

The wrap budget never subtracts the gutter. So the author's intended "short" width silently became 72 columns. On any terminal narrower than ~72 (a split pane, a mobile view, a narrowed window), those lines soft-wrap, and because terminal soft-wrap returns to column 0 with **no gutter**, the tree breaks. Rows whose wrapped lines landed near the 65-char limit (e.g. ones containing long unbreakable tokens like `fastest-cumulative-time`) were exactly the ones that overran; shorter rows survived. That's why only two of nine looked broken.

## What I Did to Fix It (in-session, manually)

Re-rendered the whole map with the summary text wrapped to **~58 characters** instead of 65, so that text + 7-char gutter stays ≤ 65 columns. That brought every row back under the threshold and the tree rendered cleanly. This is only a per-session patch — it does **not** fix the skill; the next session will re-derive from the 65-char instruction and can break again.

## On Manual Wrapping (the design discussion)

The user noted — correctly — that the manual short wrap was a **deliberate original choice**, not an accident, and it should be preserved. The rationale:

1. **Narrow reads well everywhere.** Pre-wrapping to a short width means the output already looks good on mobile / split panes / narrow terminals, with no reflow.
2. **It pre-empts the column-0 break.** If you wrap *shorter than any realistic terminal*, the terminal never needs to soft-wrap, so the gutter is never orphaned. You trade a little wasted width on a wide desktop terminal for guaranteed tree integrity on a narrow one. For status-display output (not prose), slightly-ragged-narrow looks deliberate; soft-wrapped-broken looks broken. That's the right trade.

So the bug was **not** the short-wrap strategy failing — the strategy is sound. The execution drifted by exactly the gutter width (65 text → 72 cols), so "short enough to never break" quietly stopped being short enough.

Crucially: **letting the terminal handle wrapping is not a viable alternative here**, precisely because of the gutter. Terminal soft-wrap returns continuation lines to column 0 with no `│`, which breaks the tree the same way. For a tree-with-vertical-bar, manual (computed) wrapping is the *only* way to keep the bar on every visual line. A deterministic renderer therefore **enforces** the short-wrap choice — it doesn't replace it. Whoever implements this must understand the width is intentionally narrow and must **not** "fix" it by widening or by deferring to the terminal.

### Why a per-summary fix isn't enough (and why a whole-tree renderer is the right level)

An intermediate idea — have the discovery script wrap each summary string — was considered and rejected as half a fix. Wrapping each summary independently still leaves the model holding the part that actually goes wrong: deciding **which rows carry a `│` versus a blank**, and keeping that vertical run continuous down through every wrapped sub-line. That's not per-summary state — it's a property of the **whole tree** (who is the last sibling at each depth, whether the bar above continues). The renderer must own the entire tree to make that decision once, correctly. This is the user's point: the gutter forms a continuous hierarchical diagram, so the unit of rendering is the tree, not the line.

## On "Fragile" (framing for the implementer)

The hand-drawn wrapping isn't *hard* — after the user flagged it, the re-render was perfect. The accurate framing is **"wrong by default, correct only when babysat."** The first render, with no one watching, shipped broken; it came out right the second time only because the user had pointed at it and the model was paying attention. A fresh session next week, or a topic with a different long token, rolls the dice again. Deterministic code removes the dice. That — not difficulty — is the argument for moving it out of the prompt.

## Scope of the Opportunity (how widespread the pattern is)

This is not a one-skill problem. In the dev copy:
- **15 skill `.md` files** contain the `├─` tree glyph.
- **3 files explicitly reference a "gutter"**: `workflow-continue-epic/references/epic-display-and-menu.md`, `workflow-start/references/inbox-working-set.md`, `workflow-discussion-process/references/discussion-session.md`.
- Beyond trees: nearly every entry/continue skill hand-draws numbered selection menus, `── Section ──` signposts, `Key:` legend blocks, and `· · ·` gate prompts — all fixed-shape content currently described in prose and re-emitted by the model.

The variations the schema would need to absorb (catalogued from what was seen, **not** an exhaustive survey — the implementer should do that):
- Different glyph sets — discovery tiers (`○ ◐ ✓ ⊘ →`), plain build-phase trees with no glyph, status icons elsewhere.
- Inline suffixes in several flavours — `[in-progress]`, `· {format}`, `(recommended)`, `[fresh · routed to research]`.
- Nodes with multi-line **wrapped** bodies (discovery summaries, provenance) vs pure one-liner nodes (build-phase items).
- Genuinely nested children — specification → source rows, planning → tasks, implementation → progress lines.
- The oddball first-row `┌─` the discovery map uses that most other trees don't.
- Non-tree preamble/callout lines that sit above the rows (`⚑ Discovery in progress…`, `✓ Discovery settled…`) but aren't nodes.

A rough node shape that came up in discussion (illustrative only, **not** a spec):

```
{
  glyph:    "○",                              // optional leading symbol, or none
  label:    "Legal And Regulatory",
  suffixes: ["fresh · routed to research"],   // → [tag] / · format / (recommended)
  body:     ["summary paragraph…", "provenance"], // renderer wraps each to (width − indent − gutter)
  children: [ … ]
}
```

The renderer takes a target width (deliberately narrow, per the discussion above), and owns: branch glyph selection by sibling position, gutter continuity across depth and across wrapped sub-lines, body wrapping with the gutter already subtracted, and last-sibling / last-line edge cases. Skills emit the result verbatim.

## Suggested First Step

Survey every tree- and menu-shaped render across the workflow skills, catalogue the variations, then derive the **minimal** schema and a prototype `tree.cjs` that reproduces the discovery map **plus at least two other shapes byte-for-byte**. That survey is what determines whether one renderer genuinely covers them all or whether trees and menus want separate (but similarly-shaped) renderers. Only after that should the schema be finalised and call sites migrated.

## Relevant Files

- `skills/workflow-continue-epic/references/epic-display-and-menu.md` — section A "Summary / provenance sub-lines" rule; the 65-char-vs-7-char-gutter budget bug lives here. **Immediate** fix available independent of the renderer: change the wrap target so *text + gutter ≤ intended width* (e.g. wrap text at 58, or restate as "wrap so total rendered width including the gutter ≤ 65 columns"). Note in the rule that the width is **intentionally narrow** to survive narrow terminals.
- `skills/workflow-continue-epic/scripts/discovery.cjs` — already invoked and embedded; a natural place to *call* a shared renderer, or to host one if kept local at first.
- `skills/workflow-start/references/inbox-working-set.md` — second gutter user.
- `skills/workflow-discussion-process/references/discussion-session.md` — third gutter user.
- ~15 skill `.md` files using `├─` (run `grep -rl "├─" skills`) — the full tree-render surface.
- Selection menus / signposts / legends across `workflow-*-entry` and `workflow-continue-*` skills — candidate second wave once the tree renderer proves out.
- See also: [Selection Menu Display Pattern](selection-menu-pattern.md) (#12, done) — related normalisation of how menus are displayed; a renderer would be the deterministic mechanism behind whichever pattern is chosen.

## Severity

Low for data integrity (purely cosmetic — nothing corrupts), **medium for UX and recurring cost**. The visible breakage is intermittent and terminal-width-dependent, so it'll keep resurfacing unpredictably and reads as a quality defect each time. The deeper cost is the per-render reasoning/token tax of hand-drawing layout across dozens of skills, every invocation, forever — which is the real reason to make it deterministic.

---

# Render-Shape Survey

The section above is the *why*. This is the **survey**: every structured-ASCII shape Claude is currently instructed to hand-draw across the skills, grouped into families, with the distinct variants, observed drift, and candidate canonical forms. These canonical forms are *candidates for discussion*, not decisions. Schema design stays out of scope (per the note above) — this is what a schema would have to absorb.

## How to read this

Two axes matter for the renderer, not just shape:

1. **Shape family** — signpost, menu, list, tree, legend.
2. **Where the input comes from** — does a script already hold the data (e.g. `discovery.cjs`), or does Claude compose it contextually? This decides whether the renderer kills the per-render reasoning or just relocates it. Marked **[script-backed]** / **[Claude-composed]** per shape.

Volume note: section headers ≈176 occurrences, dotted gates ≈326 (paired), bullet boxes ≈59, `├─`-using files ≈28. The high-volume, high-consistency families (signposts, gates) are the cheapest wins; the trees are the highest-variation and where the bug lives.

## Family 1 — Signposts, gates & banners  [Claude-composed, fixed-shape]

Near-perfectly consistent already. Pure presentation with trivial input (usually one string). Highest reasoning-tax-per-character to draw by hand (padding/centering/dash-counting), lowest input cost to feed a renderer. Strong, low-risk first targets.

### 1A. Section header — `── Label ──`
Padded to ~50 cols total. ~176 occurrences across ~54 files. Title Case labels.
```
── Resume Detection ─────────────────────────────
```
- **Drift:** total width not actually enforced — varies with label length because it's hand-counted. Same class of bug as the tree wrap: a width that's "supposed to be" fixed but is eyeballed.
- **Candidate canonical:** `signpost --label "Resume Detection" [--width 50]` → dashes computed to fill.

### 1B. Dotted gate — `· · · · · · · · · · · ·`
12 middle-dots, always paired around an interactive prompt. ~326 occurrences (163 pairs). Extremely consistent.
```
· · · · · · · · · · · ·
{prompt + options}
· · · · · · · · · · · ·
```
- **Candidate canonical:** `gate` emits the rule; the prompt body between the rules is still Claude's. (Or a single `gate --open/--close`.)

### 1C. Bullet box banner — `●───...───●`
Two widths: short (~50, status/error headers, ~59 occ.) and long (~65, the `workflow-start` ASCII-art welcome).
```
●───────────────────────────────────────────────●
  Knowledge Base Error
●───────────────────────────────────────────────●
```
- **Candidate canonical:** `box --title "Knowledge Base Error" [--width 50]`. Long variant is the same shape at a different width — one form, parameterised.

### 1D. Framed content box — `╭─ Finding N: … ──╮ / ╰──╯`
Wraps diff blocks in review-findings flows. Two prefixes seen (`Finding {N}:`, `Resurfacing:`).
```
╭─ Finding {N}: {Brief Title} ──────────────────────╮
{diff}
╰───────────────────────────────────────────────────╯
```
- Low volume (6 occ.). Same `box` primitive with rounded corners + a body passthrough.

### 1E. Callout line — `⚑ {label}`
Single glyph + label, no padding. ~28 occ. Warning/precondition callouts. Trivial; arguably not worth a command — just document the glyph, leave inline.

### 1F. Solid separator — `────…`
One occurrence. Full-width rule. Folds into the `box`/`signpost` dash logic.

**Family-1 normalisation:** all six reduce to **one dash/width engine** (fill-to-width with optional centred label and optional corner glyphs). Section header, bullet box, framed box, solid rule are the *same primitive* with different end-caps. Cheapest, highest-volume win; has its own latent width-drift bug (1A) worth fixing regardless.

## Family 2 — Selection menus  [mixed]

Four genuinely distinct forms (survey found ~8 variants; six are drift or composition of these four). Input is a list of `{key, label, suffix?}` rows — cheap for Claude to hand over **[Claude-composed]**, except epic/spec menus whose rows mirror manifest state **[script-backed, could be fed from the data script]**.

### 2A. Numbered-items + lettered-commands  (dominant, ~60%)
Numbered continuations, blank line, then letter commands. `active-work.md`, `empty-state.md`, all `select-*.md`.
```
What would you like to do?

- **`1`** — Continue "Auth Flow" — feature, planning
- **`2`** — Continue "Login Bug" — bugfix, investigation

- **`s`/`start`** — Start something new
- **`f`/`feature`** — Start new feature
- **`m`/`manage`** — Manage a work unit

Select an option:
```

### 2B. Simple numbered select (grouped, `b`/`back`)
Continuous numbering across category sections; minimal labels. `manage-work-unit.md`, `view-completed.md`.
```
Features:
  1. Auth Flow
  2. Billing
Bugfixes:
  3. Login Bug

Select a work unit (enter number, or **`b`/`back`**):
```

### 2C. Multi-select numbered (comma-separated)
Inbox add/drop, `start-from-inbox.md`.
```
1. Item A (idea, 2026-06-01)
2. Item B (bug, 2026-06-02)

Add which? (enter number(s), comma-separated, or **`b`/`back`**)
```

### 2D. Letter decision menu (y/n/r/b)
2–4 letter options under a context line; no explicit "Select an option". `revisit-phase.md`, `*-continuation.md`, soft-gates.
```
Continuing "Auth Flow" — planning.

- **`y`/`yes`** — Proceed to implementation
- **`r`/`revisit`** — Revisit an earlier phase
```

**Drift to normalise:**
- Phase-selection menu uses a **numbered** "Back" instead of `b`/`back`. → make back always `b`/`back`.
- `(recommended)` vs `*(recommended)*` (italic) — pick one.
- Recommended-first menus add backtick-wrapped multi-line descriptions — decide whether that's a 5th form or a row option (`description`) on 2A.

**Family-2 normalisation:** one `menu` command with a row list + a mode flag (`single` | `multi` | `letter`), optional grouping header per row, optional `recommended` and `suffix` per row, and a standard prompt line. Covers ~95%.

## Family 3 — Lists vs Trees  (the important distinction)

Biggest finding: **most "trees" are not trees.** They're flat lists with a single `└─` sub-row. True tree logic (continuous `│` gutter across siblings and wrapped sub-lines, last-sibling math) is needed by only **four** renders. Separating these is the key scoping decision.

### 3A. Flat list + single sub-row  — *NOT a tree*  [script-backed]
`N. Name` then one `└─ detail` line. No `│`, no sibling continuity. Used by: `select-*.md` (all 5 types), `active-work.md`, `view-completed.md`, planning `define-tasks.md`, legacy-split themes, dependency lists (`resolve-dependencies.md`, `check-dependencies.md`), spec overview (`display-*.md`).
```
1. Auth Flow
   └─ Planning, in-progress
```
- **Drift:** indent is 2-space in dependency renders, 3-space elsewhere; multiple sub-rows sometimes all use `└─` where `├─`/`└─` is correct.
- These don't need the tree renderer. A `list` form (item + optional sub-rows) covers them. Cheap.

### 3B. Genuine trees — continuous gutter  [script-backed]
Four renders. All share `┌─ ├─ └─` branch grammar, a leading status glyph, and a `│`+indent gutter that must stay continuous. Where the renderer earns its keep.

**3B-i. Discovery map** — `workflow-continue-epic/.../epic-display-and-menu.md`, `workflow-discovery/.../session-loop.md`
Tier glyph (`→ ◐ ✓ ○ ⊙ ⊘`) + name + `[lifecycle]`, with **wrapped summary + provenance sub-lines** under each row hung off the `│` gutter. **The render with the motivating bug** (summary hard-wrapped at 65 chars + 7-char gutter = 72 cols → terminal soft-wrap orphans the gutter).
```
  ├─ ◐ Ai Content Engine [researching]
  │      AI imagery (enhancement-only v1), description
  │      generation, per-tenant tone primitive
  │      from exploration
  └─ ◐ Menu And Admin [researching]
         Business-side menu modelling, admin shell
         from exploration
```

**3B-ii. Discussion map** — `workflow-discussion-process/.../discussion-session.md`
State glyph (`○ ◐ → ✓`) + name + `[state]`, **two-level nesting** (parent → children, no grandchildren), `↑ Elevated: …` marker rows. No wrapped bodies.
```
  ┌─ ✓ Subsystem Prefix Taxonomy [decided]
  ├─ → Decision-Point INFO Line Shape [converging]
  │  ├─ ✓ Field Order [decided]
  │  └─ ◐ Truncation Rules [exploring]
  ├─ ↑ Elevated: Log Aggregation Backend
  └─ ○ Rollout Sequencing [pending]
```

**3B-iii. Epic dependency / phase detail** — `workflow-continue-epic/.../display-epic-map.md`
Status glyph + name, sub-rows for sources (`←`) and promotions (`→`), `│` phase continuation.
```
  ├─ ✓ User Authentication
  │  ├─ ← Auth Flows Discussion
  │  └─ ← Session Management Discussion
  └─ ○ Admin Panel
     └─ Phase 2, 4 task(s) completed
```

**3B-iv. Inbox working set** — `workflow-start/.../inbox-working-set.md`
Bullet `•` (not a status glyph) + `(type)`, **wrapped summary max 3 lines + ellipsis**, and a **single-item special case** (lone item renders no branch glyph). Same `│`+gutter wrap concern as the discovery map.
```
  ┌─ • Item One (idea)
  │      Summary that wraps to a second line if needed,
  │      max 3 lines with ellipsis…
  └─ • Item Three (quickfix)
         single item gets no connector glyph
```

**Structural variation the tree renderer must absorb (from 3B):**
- Glyph source: tier set / state set / bullet / none — pluggable leading symbol.
- Special first row `┌─` (discovery, discussion, inbox) vs none.
- Wrapped multi-line bodies (discovery, inbox) vs single-line nodes (discussion, dependency).
- Nesting: 1 level (discovery, inbox) vs 2 levels (discussion, dependency).
- Gutter width drift: discovery uses `│`+6 spaces; discussion uses `│`+2. **Normalise.**
- Single-item / last-sibling / last-line edge cases.
- Marker rows that aren't nodes (`↑ Elevated`, source `←`, promotion `→`).
- Body wrap budget **must subtract the gutter** — the bug. Width is intentionally narrow; renderer enforces, never widens or defers to terminal.

### 3C. Documentation trees — `├──` 3-dash filesystem diagrams  [static, OUT OF SCOPE]
`output-formats/{tick,linear,local-markdown}/about.md`. Static docs illustrating directory/issue layout, not per-session data-driven renders. Different glyph (`├──` 3-dash + 4-space). **Exclude from the renderer** — prose, not output.

## Shared vocabulary (consistent — renderer config, not per-call reasoning)

### Glyph table (one meaning per context; no collisions found)
```
Discovery tier:  →ready-next  ◐in-flight  ✓decided  ○fresh  ⊙handled  ⊘cancelled
Discussion state: ○pending   ◐exploring  →converging ✓decided
Markers:         ↑elevated   ←source     →promoted
Alert:           ⚑
Decoration:      ● (box caps)
```
Discovery and discussion share `○ ◐ → ✓` with semantically aligned meanings — safe.

### Suffix grammar (bracket type signals metadata type — consistent)
```
[]  status / state           [in-progress] [decided] [extracted, reopened]
()  metadata                 (recommended) (was: {status}) (3 of 5 sources extracted)
·   provenance / routing     · {format}   · routed to research   · seeded from the inbox
—   phase / progress / block — implementation (Phase 2, Task 3)   — blocked by {plan}:{task}
:   cross-plan task ref      {plan}:{task}
```

### Legend / Key blocks
Several near-identical `Key:` blocks (spec-entry display-*.md, epic display) listing the subset of glyphs/statuses in play. **Candidate:** a `legend` command that emits the canonical block for a given vocabulary subset — removes the copy-paste drift between the five spec-entry variants.

## Cross-cutting observations

1. **The system is already remarkably consistent.** Most drift is mechanical (indent width, dash count, `└─` vs `├─`, italic vs plain `(recommended)`) — exactly the class of error a renderer eliminates by construction.
2. **The latent width bug isn't unique to the tree.** Section headers (1A) and boxes (1C) also rely on hand-counted widths that aren't enforced. Same fix, same primitive.
3. **The four families collapse toward shared primitives**, not one schema:
   - a **width/dash engine** (signposts, boxes, rules) — Family 1
   - a **wrap-with-prefix primitive** (`budget = width − prefixWidth`) — the root of the bug, shared by trees and wrapped lists
   - a **menu** form — Family 2
   - a **tree** form (4 real trees) over the wrap primitive — Family 3B
   - **vocab/legend** as config, not logic
4. **Scope ladder by payoff/risk:**
   - Cheapest, safest, highest volume: **signposts/gates/boxes** (Family 1) + the width-drift fix.
   - High value, contained: **menus** (Family 2, 4 forms).
   - Highest value + where the bug lives + most variation: **the 4 real trees** (3B). Feed from the data scripts that already hold the rows.
   - Skip: doc filesystem trees (3C), maybe the bare `⚑` callout (1E).

## Open questions (for decision, not yet decided)

- **Tree input source** — data-script emits the renderer IR directly (kills reasoning) vs Claude adapts script output per render (relocates it). Leaning: data-script emits IR.
- **Recommended-description menus** — 5th menu form, or a `description` option on the numbered form?
- **One CLI, subcommands** (`signpost`/`box`/`menu`/`list`/`tree`/`legend`) over a shared wrap+width core — vs separate tools. Leaning: one CLI, shared core.
- **Where it lives** — new shared script home under `skills/` (alongside `manifest.cjs`/`knowledge.cjs` conventions) vs the `bash-toolkit/lib` shared dir.
- **Display contract** — Claude re-emits the block verbatim in its reply (output tokens unchanged, reasoning saved). Confirmed acceptable.

## Relevant files (call-site index)

- **Trees (real):** `workflow-continue-epic/references/{epic-display-and-menu,display-epic-map}.md`, `workflow-discussion-process/references/discussion-session.md`, `workflow-discovery/references/session-loop.md`, `workflow-start/references/inbox-working-set.md`
- **Lists (sub-row, not trees):** `workflow-continue-*/references/select-*.md`, `workflow-start/references/{active-work,view-completed}.md`, `workflow-planning-process/references/{define-tasks,resolve-dependencies}.md`, `workflow-implementation-entry/references/check-dependencies.md`, `workflow-legacy-research-split/references/dialog.md`, `workflow-specification-entry/references/display-*.md`
- **Menus:** `workflow-start/references/{active-work,empty-state,manage-work-unit,inbox-working-set,start-from-inbox,absorb-into-epic,inbox-archived}.md`, `workflow-continue-*/references/{select-*,revisit-phase}.md`, `workflow-bridge/references/*-continuation.md`, `workflow-specification-entry/references/display-specs-menu.md`
- **Signposts/gates/boxes:** ~54 SKILL.md + references for `── ──`; ~40 reference files for `· · ·`; `workflow-knowledge/references/knowledge-check.md`, `workflow-start/SKILL.md` (boxes); `*/process-review-findings.md`, `spec-construction.md` (framed)
- **Legends/vocab:** `workflow-specification-entry/references/display-*.md`, `workflow-continue-epic/references/epic-display-and-menu.md`
- **Out of scope:** `workflow-planning-process/references/output-formats/{tick,linear,local-markdown}/about.md` (doc filesystem trees)
