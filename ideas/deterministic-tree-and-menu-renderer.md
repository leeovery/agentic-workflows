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

## Update — PR #344 (epic-dashboard stage grouping)

After this idea was written, PR #344 restructured `epic-display-and-menu.md`. Relevant to this proposal:

- **The motivating bug persists.** The summary is still hard-wrapped at 65 chars; the gutter grew 7 → 9 (the map moved under a stage divider), so overflow is now at **74 cols**, not 72. The restructure did not touch the wrap budget. The immediate sub-fix (subtract gutter from budget) is still outstanding — and now even more clearly worth doing independently of the renderer.
- **Several flagged drifts were hand-fixed** — dangling `└─` build sub-rows now nest properly; first-row `┌─` dropped for the discovery map (tree hangs off its header via `├─`); sub-headers uppercased. This is the survey's thesis demonstrated: per-file, by hand, correct only when watched.
- **A composition layer appeared** — three `── DISCOVERY/DEFINITION/DELIVERY ──` stage dividers (Family 1) now wrap the trees (Family 3). The dashboard is now a multi-primitive composite — see **3B-composite** below.
- **A new genuine tree** — the build-phase render gained a real `{child_gutter}`/`{child_branch}`, so `epic-display-and-menu.md` now holds two continuous-gutter trees sharing one mechanism (see **3B-v**). Best beachhead for the renderer.

The survey below has been updated to reflect this state.

---

# Design Decisions (locked 2026-06-04)

The model, agreed in discussion. Implementation flows from these.

1. **One render library + CLI, in-repo under `skills/`.** A single shared renderer (e.g. `skills/workflow-render/scripts/render.cjs`) exposing per-shape functions (`renderSignpost`, `renderBox`, `renderMenu`, `renderList`, `renderTree`, `renderLegend`) over **one shared wrap/width/gutter core** — the single home of the budget math, so the wrap bug can exist in only one place. It is **both a library and a CLI**: scripts `require()` it in-process; Claude invokes the CLI via Bash for trivial shapes. Ships via AGNTC, no build step.
2. **Caller owns the data.** Whoever holds the data calls the renderer. Claude calls the CLI directly for trivial-input shapes (signpost, box, simple menu). Data-backed shapes (the trees) are rendered by the data script (`discovery.cjs`), which already collates the manifest — it `require()`s the renderer and calls `renderTree()` **in-process**. Claude never assembles tree JSON.
3. **One run, one source, two outputs — no double invocation.** `discovery.cjs` runs once: reads manifest → builds one structured object → from that object emits BOTH (a) the finished **display block** (by calling the render lib in-process) and (b) the thinned **reasoning data**. One process, one `stdout`, two clearly-demarcated sections. Drawing moves out of the prompt into the renderer; `format()` no longer asks Claude to draw — it concatenates a finished block + the data.
4. **Two surfaces, one source of truth.** *Display surface* (the pretty tree — for the user, emitted verbatim) and *reasoning surface* (labeled data — for Claude's decisions) are two projections of the one structured object, so they can't drift. Fields that exist **only to draw the tree** (summary text, provenance, exact glyph) leave the reasoning surface once code draws the tree; what stays is only what the skill branches on (lifecycle/gating, routing, counts, next-action, blocked/deps). The dump thins; for some items it may vanish.
5. **The tree is write-only-to-the-user (hard rule).** Claude must never read the rendered tree back to extract a decision — that re-introduces the fragile ASCII-parsing this exists to kill. Decision data always comes from the reasoning surface. `stdout` is demarcated so Claude knows which block to display vs reason about.
6. **Display contract** — Claude re-emits the rendered block verbatim in its reply. Output tokens ~unchanged; the win is reasoning cost + correctness + one source of truth.
7. **First slice → spike.** Build the **core + `signpost`** end-to-end first (prove the run→emit-verbatim loop, simplest shape). Then a **throwaway discovery-map spike**: render the map from `discovery.cjs` state and diff byte-for-byte against the hand-drawn block. The spike is the **go/no-go decider** for the whole effort, and doubles as the empirical test of which fields the reasoning surface keeps (= what continue-epic actually branches on).

**Still open** (don't block the start): the exact reasoning-surface field set per skill (settled by the spike); the menu `description` sub-line (5th form vs row option); whether the reasoning surface stays labeled text or becomes JSON (tied to the broader code-based-orchestration push — out of scope here).

## Build log

- **Core + signpost slice** (shipped) — `skills/workflow-render/render.cjs` as library+CLI: shared `fillTo`/`wrap`/`wrapWithPrefix` core (budget = `width − prefix.length`, the single home of the gutter bug) + `signpost` (step/sub-step markers) + `box` (phase title). Proven byte-exact against live hand-drawn markers/borders; surfaced a real 50-vs-49 sub-step drift the renderer normalises.
- **Tree spike → GO** (shipped) — `renderTree` (discovery-map shape) on the same core. Reproduces the documented hand-drawn rows **byte-for-byte**; the 74-col gutter-orphan bug is now structurally impossible (every body line stays within width at 49/58/65). The spike validated the whole approach, so `renderTree` is kept, not thrown away.
  - **Finding — header-row overflow is inherent.** A long `label [lifecycle]` header row can't wrap without breaking glyph alignment, so it can exceed the width (the hand-drawn version overruns identically). The renderer guarantees only the wrappable *body* lines fit. Mitigation (truncating long labels) is a separate decision.
  - **Decision deferred to wiring — tree content width.** 49 (consistent with the 49-wide dividers/markers) vs ~65 (current text density). The renderer is correct at any width; this is a visual-density call made when `discovery.cjs` is wired up.

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
Padded to ~50 cols total (PR #344's epic-dashboard stage dividers fix this at **49 chars** — `── DISCOVERY ──`, `── DEFINITION ──`, `── DELIVERY ──` — and use it as top-level structural grouping, not just a section break). ~176 occurrences across ~54 files. Title Case labels (the stage dividers are UPPERCASE).
```
── Resume Detection ─────────────────────────────
── DISCOVERY ────────────────────────────────────
```
- **Drift:** total width not actually enforced — varies with label length because it's hand-counted (the 49 vs ~50 split is itself an instance). Same class of bug as the tree wrap: a width that's "supposed to be" fixed but is eyeballed.
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

Biggest finding: **most "trees" are not trees.** They're flat lists with a single `└─` sub-row. True tree logic (continuous `│` gutter across siblings and wrapped sub-lines, last-sibling math) is needed by **five** renders (one of which, the epic build-phase tree, graduated out of the flat-list bucket in PR #344 when its sub-rows were given a proper `│/├─/└─` gutter). Separating these is the key scoping decision.

### 3A. Flat list + single sub-row  — *NOT a tree*  [script-backed]
`N. Name` then one `└─ detail` line. No `│`, no sibling continuity. Used by: `select-*.md` (all 5 types), `active-work.md`, `view-completed.md`, planning `define-tasks.md`, legacy-split themes, dependency lists (`resolve-dependencies.md`, `check-dependencies.md`), spec overview (`display-*.md`). (The epic dashboard's build-phase render used to live here too — PR #344 promoted it to a genuine tree, now 3B-v.)
```
1. Auth Flow
   └─ Planning, in-progress
```
- **Drift:** indent is 2-space in dependency renders, 3-space elsewhere; multiple sub-rows sometimes all use `└─` where `├─`/`└─` is correct (exactly the dangling-`└─` defect #344 just hand-fixed in the epic dashboard — and which will recur elsewhere until a renderer owns it).
- These don't need the tree renderer. A `list` form (item + optional sub-rows) covers them. Cheap.

### 3B. Genuine trees — continuous gutter  [script-backed]
Five renders. All share `├─ └─` branch grammar (some still use `┌─`; see below), a leading status glyph, and a `│`+indent gutter that must stay continuous. Where the renderer earns its keep.

**3B-i. Discovery map** — `workflow-continue-epic/.../epic-display-and-menu.md` (now under the `── DISCOVERY ──` stage, header `RESEARCH & DISCUSSION`), `workflow-discovery/.../session-loop.md`
Tier glyph (`→ ◐ ✓ ○ ⊙ ⊘`) + name + `[lifecycle]`, with **wrapped summary + provenance sub-lines** under each row hung off the `│` gutter. **The render with the motivating bug, still unfixed as of PR #344** (summary still hard-wrapped at 65 chars; gutter grew from 7 → **9 chars** when the map moved under the stage divider, so 65 + 9 = **74 cols** → terminal soft-wrap still orphans the gutter). First row now `├─` (was `┌─`) so the list hangs off the header.
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

**3B-v. Epic build-phase tree** — `workflow-continue-epic/.../epic-display-and-menu.md` (under the `── DEFINITION ──` and `── DELIVERY ──` stages)
Uppercase phase sub-header (`SPECIFICATION`, `PLANNING`, `IMPLEMENTATION`, `REVIEW`) + count summary, with items branching off it (`├─`/`└─`), and child sub-rows (spec sources, implementation progress) nested via a formal `{child_gutter}` + `{child_branch}`. Graduated from flat-list (3A) in PR #344. **Shares the exact gutter machinery as 3B-i in the same file** — the strongest single argument for a shared tree renderer.
```
  SPECIFICATION (2 completed)
  ├─ ✓ User Authentication
  │  ├─ ← Auth Flows [incorporated]
  │  └─ ← Session Mgmt [pending]
  └─ ○ Admin Panel
     └─ Phase 2, 4 task(s) completed
```
- `{child_gutter}` — non-last item: `2sp │ 2sp`; last item: `5sp`. `{child_branch}`: `├─` non-final, `└─` final/only. Items hang off the sub-header (no `┌─`).

**Structural variation the tree renderer must absorb (from 3B):**
- Glyph source: tier set / state set / bullet / none — pluggable leading symbol.
- **Hang-off-header vs free-standing first row:** discovery map (3B-i) and build trees (3B-v) now use `├─`/sole `└─` to tick up into a header label — **never `┌─`** (normalised in #344). Discussion map (3B-ii) and inbox (3B-iv) still open with `┌─`. The renderer should make "hang off header" the default; `┌─` the opt-in.
- Wrapped multi-line bodies (discovery, inbox) vs single-line nodes (discussion, dependency, build).
- Nesting: 1 level (discovery, inbox) vs 2 levels (discussion, dependency, build).
- **Gutter width drift (now across three trees):** discovery body gutter `2sp │ 6sp` (9); discussion child `│`+2; build child `2sp │ 2sp`. Same concept, three widths. **Normalise.**
- Single-item / last-sibling / last-line edge cases.
- Marker rows that aren't nodes (`↑ Elevated`, source `←`, promotion `→`).
- Body wrap budget **must subtract the gutter** — the bug, still live after #344 (65 + 9 = 74). Width is intentionally narrow; renderer enforces, never widens or defers to terminal.

### 3B-composite. The epic dashboard is now a multi-primitive render
PR #344 restructured `epic-display-and-menu.md` so the whole dashboard is **Family 1 signposts wrapping Family 3 trees**: three `── DISCOVERY/DEFINITION/DELIVERY ──` dividers (49-char section headers, see 1A), each followed by a header/sub-header and a tree. One render composes a box cap (`●──●` title), three dividers, two genuine trees, and several sub-headers. This is the clearest real example that the renderer is **composed primitives assembled into a dashboard**, not one schema per shape — and the obvious migration beachhead (one high-value file, two trees + three dividers, already hand-normalised to copy byte-for-byte).

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

## Open questions

Most of the original open questions are now resolved — see **Design Decisions (locked 2026-06-04)** above (packaging, location, tree input, caller model, display contract). What remains:

- **Reasoning-surface field set** per consuming skill — which fields stay vs leave once code draws the tree. Settled empirically by the first-slice spike (= what continue-epic actually branches on).
- **Recommended-description menus** — 5th menu form, or a `description` option on the numbered form?
- **Reasoning surface format** — stays labeled text vs becomes JSON. Tied to the broader code-based-orchestration push; out of scope for the renderer itself.

## Relevant files (call-site index)

- **Trees (real):** `workflow-continue-epic/references/{epic-display-and-menu,display-epic-map}.md`, `workflow-discussion-process/references/discussion-session.md`, `workflow-discovery/references/session-loop.md`, `workflow-start/references/inbox-working-set.md`
- **Lists (sub-row, not trees):** `workflow-continue-*/references/select-*.md`, `workflow-start/references/{active-work,view-completed}.md`, `workflow-planning-process/references/{define-tasks,resolve-dependencies}.md`, `workflow-implementation-entry/references/check-dependencies.md`, `workflow-legacy-research-split/references/dialog.md`, `workflow-specification-entry/references/display-*.md`
- **Menus:** `workflow-start/references/{active-work,empty-state,manage-work-unit,inbox-working-set,start-from-inbox,absorb-into-epic,inbox-archived}.md`, `workflow-continue-*/references/{select-*,revisit-phase}.md`, `workflow-bridge/references/*-continuation.md`, `workflow-specification-entry/references/display-specs-menu.md`
- **Signposts/gates/boxes:** ~54 SKILL.md + references for `── ──`; ~40 reference files for `· · ·`; `workflow-knowledge/references/knowledge-check.md`, `workflow-start/SKILL.md` (boxes); `*/process-review-findings.md`, `spec-construction.md` (framed)
- **Legends/vocab:** `workflow-specification-entry/references/display-*.md`, `workflow-continue-epic/references/epic-display-and-menu.md`
- **Out of scope:** `workflow-planning-process/references/output-formats/{tick,linear,local-markdown}/about.md` (doc filesystem trees)

---

# Discovery / Projection Architecture Spec (Draft)

Status: **superseded in part** — see the **Engine Architecture design log** below (2026-06-10/11). The §8 flavour fork is resolved there (neither A nor B as written — the three-ring engine), several §9 decisions are settled, and the engine model subsumes the §4 layer diagram. Kept for the grounding work (§6 invocation mechanics, §7 live-`detail` inventory) which still holds.

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

---

# Engine Architecture — Design Log (2026-06-10/11)

Status: **active design discussion.** This section supersedes the draft spec above where they conflict. It reframes the renderer as the first module of something bigger, records what's been **agreed**, what's **proposed but open**, and pressure-tests the model with flow walkthroughs. No code yet — the shape gets settled first.

## 1. Reframing — why this got bigger than the renderer

The ambition: move **all orchestration that doesn't need reasoning** into code. The ideal (everything in code, LLM called only for intelligence) is economically closed off — that path requires metered API billing, and the Claude subscription is by far the better deal. So the architecture **inverts**: Claude Code stays the orchestrator/driver, and code becomes the thing Claude *consults*. Claude asks "what's next?", "give me the menu for this epic" — code answers from data.

Consequences that shape everything below:

- **The manifest is the source of truth.** Kept current (which it must be anyway), code can derive next steps, gating, loops, position-in-process. Example: discussions not yet extracted into a specification ⇒ a spec is due. No LLM needed.
- **Prime directive: decision-ready answers.** Every engine answer must be consumable without re-derivation — the scarce resources are Claude's reasoning and tokens per turn.
- The four existing code islands (manifest CLI, per-skill discovery scripts, knowledge CLI, render spike) grew organically with no shared core. The engine is the designed system they converge into — **iteratively, not all at once, not every skill at once**.
- It may look over-engineered for producing a signpost. It isn't sized for signposts — it's sized for what gets bolted on.

## 2. AGREED — the three-ring engine

The onion. The engine is central but **"dumb" means skill-blind, not domain-blind** — the manifest schema's vocabulary (phases, topics, sources, routing) *is* the domain, so an engine that owns the manifest already speaks it. What the engine must never know is what any *skill's conversation* does with an answer.

```
┌─ Skills (.md / Claude) ── conversation, judgment, routing choices
│  ┌─ Adapters (per-skill discovery.cjs) ── skill-owned shaping:
│  │   "which of the engine's answers does MY flow need, in what form"
│  │  ┌─ Domain ring ── the workflow ontology: phases, lifecycle,
│  │  │   gating, next-actions, transitions, glyph/tag conventions,
│  │  │   canonical projections. Skill-blind, workflow-aware.
│  │  │  ┌─ Kernel ── manifest IO + schema validation, KB store,
│  │  │  │   render primitives, wrap math. No workflow words at all.
```

**The discriminator** (for every future "where does this go?" call):

- Derivable purely from manifest semantics, reusable by any caller → **domain ring**. (Lifecycle, gating, "what's next", spec-due detection, staleness.)
- About one skill's conversational flow → **adapter** (or the .md itself). (Which projections this step requests; flow-specific decoration.)
- Knows no workflow vocabulary → **kernel**. (`renderTree`, wrap budget, JSON IO, KB plumbing.)

**Adapters are thin — decorators, not derivers.** An adapter only *shapes* data it gets from the rings below; it never derives its own. If something needs to happen at the adapter, fine — that's what it's for — but the default home for logic is the domain ring. As skills migrate, expect **converging patterns**: variations that look skill-specific should be pushed toward normalised shapes (skill-specific → work-type-specific → general) rather than absorbed as one-off custom behaviour.

**Contract tenets:**

1. **Stable action keys.** Engine answers carry machine keys (`action: start_specification`), and skills route on keys — never by parsing labels or rendered text. (Generalises the existing write-only-display rule.)
2. **Same state → same answer.** Pure functions over the manifest; fixture-testable.
3. **Validation at the kernel.** Everything derives from the manifest, so the engine *refuses* malformed state loudly rather than deriving garbage politely. Schema validation becomes load-bearing.

**Evidence the codebase already wants this:** `discovery-utils.cjs` is a half-formed domain ring (`computeTopicLifecycle`, `computeNextPhase`, gating); the render spike split exactly on the kernel/domain line (`render.cjs` = kernel, `conventions.cjs` = domain).

**Typed state lives in the manifest; knowledge lives in markdown** *(agreed 2026-06-11, resolving walkthrough-2 finding 5)*. Anything that fits a typed system — subtopic states (`pending`/`exploring`/`converging`/`decided`), map items, lifecycle markers — is an **enum, not prose**, and belongs in the manifest. It should never have been in markdown; it's a remnant of the everything-was-markdown era that state has been steadily migrating out of. The markdown document keeps what markdown is *for*: the knowledge — transcript, discoveries, pathways, failed paths, rationale, the conversation itself. The agent and human still drive everything conversationally; but the moment an item lands on a map or a state changes, that's a CLI call recording it. Judgment decides, code records. *Boundary ratified 2026-06-12 (finding 10): this applies to **durable, derivable-from** state; ephemeral single-flow state (e.g. the inbox working set) stays in context or `.cache` — no manifest ceremony for state that dies with the flow.*

**Settled mechanics** (from the earlier discussion, still standing):

- **JS, not TS.** `.cjs` is both source and shipped artifact — no build step, no bundle drift, installed projects read real source. JSDoc typedefs on the core contracts (`detail`, tree node, projection inputs) + `tsc --noEmit` (checkJS) enforced in tests/CI. Escape hatch if deps/scale ever force it: the `src/` + esbuild path knowledge already uses.
- **Writes migrate progressively.** Not all writing moves into the engine — skills will still drive writes determined by conversational logic. But the more process is codified, the more writes (including templated git commits over known file sets, e.g. `.workflows/{wu}/`) happen engine-side. Implementation-phase commits stay with Claude where only the agent knows which files it touched.

## 3. PROPOSED — file layout

```
skills/workflow-engine/scripts/
  engine.cjs            ← thin CLI entry
  kernel/               ← manifest IO + validation, render, wrap, KB plumbing
  domain/               ← lifecycle, gating, next-actions, transitions,
                          conventions (glyphs/tags), projections/ (dashboard,
                          menu, legend, maps…)
skills/{skill}/scripts/discovery.cjs   ← adapters, stay in-skill, require() the engine
```

- `workflow-render`'s contents move into `kernel/` — it's unwired (zero call sites), so zero migration cost.
- `discovery-utils.cjs` dissolves into `domain/` over time.
- `manifest.cjs` and `knowledge.cjs` remain compatibility islands, absorbed later. (Their CLI surfaces are referenced from dozens of skill files — keep the surfaces, swap the internals.)
- Multi-file, no build: cross-skill relative `require()` already works installed (adapters require `../../workflow-shared/` today).

## 4. Walkthrough 1 — continue-epic (the navigation shape)

Every moment of the flow (SKILL.md + the 848-line `epic-display-and-menu.md`), assigned to a ring:

| # | Moment (today) | What it actually is | Ring |
|---|---|---|---|
| 0 | `Continue Epic` box + step signposts (literal fenced blocks) | Static chrome — Claude *copies*, doesn't draw | → finding 1 |
| 1 | `!` head insert runs `discovery.cjs` (labelled dump) | Reasoning surface | kernel→domain→adapter |
| 2 | Branch on `count`, store `$0` | Flow control off reasoning surface | skill .md |
| 3 | Select-epic menu | Script-backed numbered menu | domain projection |
| 5 | Backfill: `detect.cjs`, then *Claude filters* `discovery_map` for missing summaries in-context | **Derivation leaked into prose** — pure data filtering done by LLM | domain (expose `items_to_recover`) |
| 6 | `analysis_caches` staleness → dispatch analyses | Detection in code; analysis content is judgment | domain / LLM ✓ already right |
| 7 | `needs_sequencing` flag → Claude assigns order values → scoped re-run | Detection in code, **judgment in LLM — the boundary done right**; the pattern exemplar | domain + LLM |
| 8a | Dashboard (stage dividers, trees, callouts, wrap rules — ~200 lines of template prose) | Fully determined by `detail` | domain projection |
| 8b | Key/legend ("show only categories present") | Derivable from detail | domain projection |
| 8c | Menu composition (~90 lines: entries from `next_action`/`next_phase_ready`, gating filters, ordering, `(recommended)` pick) | Fully deterministic — zero judgment in section C | domain projection |
| 8d | Gate prompt, STOP, collect selection | Conversation | skill .md |
| D | Soft gates (conditions = counts; fixed message templates) | Condition + body codifiable; STOP stays | domain + .md |
| E | Route selection by **label prefix-matching** (16-row table) | Fragile string matching | → finding 3 |
| H/I | Cancel/reactivate: 2–4 manifest calls + KB remove/index + commit, step-by-step in prose | A **transaction** Claude hand-executes | → finding 4 |

**Finding 1 — static chrome wants author-time enforcement, not runtime rendering.** The step signposts are already *literal* fenced blocks — Claude copies them; there is no character arithmetic at runtime. The 49-vs-50 drift happens at **authoring** time, hand-counting dashes while writing the .md. A runtime Bash call per signpost adds a tool round-trip + more tokens than the line itself (~9× per continue-epic session) to fix a bug that doesn't occur at runtime. Cheaper kill: a **repo-side lint** — a test that extracts fenced blocks from skill .mds and validates every `── … ──` / `●──●` against the renderer. Proposed rule: **static → literal + lint; dynamic (parameterised labels, where dash-count actually varies) → rendered by code.** *Challenges locked decision #1 (CLI for trivial shapes). Open — the counter-instinct was that prose signposts become renderer calls.*

**Finding 2 — dashboard + key + menu is one projection, not three.** All derive from the same `detail`; the menu rules are pure logic re-executed by Claude per render. One adapter call returns one demarcated block (reasoning data / display / menu); ~500 of the 848 reference lines leave the .md. Also resolves the locked-decision-#3 vs §6 contradiction (one run, one snapshot — individual projections kept as utilities).

**Finding 3 — menus must return action keys; routing uses keys.** Today: code derives `next_action` → prose maps to label → user picks → another table **prefix-matches the label back** to a skill invocation. The label round-trip is the fragility. The menu projection emits, on the reasoning surface, `{n, action, topic, route}` per entry; .md routing collapses to "invoke the `route` of the selected key". This is "ask the engine what's next" made concrete — **the menu is the next-decision API**.

**Finding 4 — cancel/reactivate are the perfect first write commands.** Section H is a five-step transaction (stash status → set cancelled → drop order → KB remove → commit) with prose-specified error tolerance; reactivate has Claude piping a read value back by hand. `engine topic cancel {wu} {phase} {topic}` does it atomically; the .md keeps only the confirmation conversation. Small, high-value, proves the write side early — transitions with invariants, not raw field sets.

## 5. Walkthrough 2 — discussion-session (the in-phase shape)

The opposite character: the LLM owns the content (organic conversation, judgment everywhere) and code only punctuates. The flow (`discussion-session.md`, 407 lines):

| Moment (today) | What it actually is | Ring |
|---|---|---|
| A. Background-agent dispatch/check protocol | Judgment + protocol prose | skill .md / LLM |
| B2–B3. Discuss, navigate, track subtopics | Pure judgment | LLM |
| B4. Document — update discussion file + map states | Judgment content; **state lives in the discussion .md file**, not the manifest | → finding 5 |
| B5. Commit after each write (don't batch) | Mechanical, templated message, known file set | engine commit helper (finding 7) |
| C. Subtopic state transitions ("judgement calls") | Judgment decides; recording is mechanical | LLM decides → finding 5 for the recording |
| E. Status display — Discussion Map tree (~40 lines of exact glyph/gutter/branch rules) | Deterministic layout over session state | renderer — but see finding 5/6 for who holds the data |
| F. Off-topic concern detection + heuristic | Judgment | LLM |
| F. Off-topic gates (log/pivot/ignore, reroute/keep) | Parameterised conversational chrome | .md (conversational moment — adapter/skill side of the views line) |
| F-reroute. Read live map, candidate menu, triage-landing, scoped commit | Candidates from data; resolution is judgment; landing+commit is a transaction | domain (candidates) + LLM (choice) + engine (transaction) |
| G/H. Convergence: "all subtopics decided" + count review files in `.workflows/.cache/…` | **Prose rules over filesystem/session state** — pure checks | domain query → finding 8 |
| G/H. Conclusion gates, wait-for-agents | Conversation | .md |

**Finding 5 — conversational state is the structural decision here.** The Discussion Map (subtopics, states, parent/child) lives **inside the discussion markdown file**, maintained by Claude as the conversation flows. So the data the tree renders is held by Claude, not the manifest — the continue-epic pattern (kernel reads manifest → domain projects) doesn't apply as-is. Two options:

- **(a) Claude stays the data owner** and passes compact node JSON to the renderer at display time. Honest generalisation of "the data owner calls the renderer" — in-session, the owner *is* Claude. Layout math still never hand-drawn; but convergence checks, unresolved-counts, and resume-after-compaction all stay prose/context.
- **(b) The map becomes structured state** — a sidecar (in-manifest under the discussion item, or `.workflows/{wu}/discussion/.{topic}.map.json`). Claude still makes every state-transition *judgment* but records it via an engine command (`engine map set {subtopic} converging`). Then: the map render is a normal projection; "all decided" and "{N} not yet decided" become domain queries; the discussion file's map section can be *generated*; and **resume after context compaction becomes deterministic** instead of re-derived from prose. Cost: a cheap CLI call per state change during conversation.

**DECIDED (2026-06-11): option (b), unreservedly — and into the manifest, not a sidecar file.** All live maps (discussion map, discovery map session state, and equivalents) are typed state and move to the manifest; subtopic states are an enum and should never have been in prose. The conversation still drives everything — but the moment an item lands on a map or its state changes, that's a CLI call. The markdown document keeps the knowledge: transcript, discoveries, pathways, failed paths, the conversation. (See the matching agreed principle in §2.) *Locked decision #2 survives fully — with the map in the manifest, the data owner is the engine again, and Claude never assembles tree JSON anywhere.*

Follow-on details (settled in spirit, specifics at design time): the manifest schema grows subtopic entries under the discussion item; a migration extracts map state from in-flight discussions' markdown; the discussion file's Discussion Map section becomes generated from the manifest (or is dropped); the discussion template updates accordingly.

**Finding 6 — the two maps are the same shape.** Discussion map ≅ discovery map structurally: two-level tree, state glyphs, header with count breakdown omitting zero categories. One projection family covers both — evidence for the normalisation push. The `┌─` first-parent here vs hang-off-header in the epic dashboard is exactly the kind of inconsistency that dies in `conventions`.

**Finding 7 — session commits are codifiable.** `git add -- .workflows/{wu}/` + templated message (`discussion({wu}/{topic}): reroute concern to {x}`) appears at every documentation pause and transaction. An engine commit helper (scoped pathspec, conventional message) removes a per-pause hand-typed command — and is exactly the "git can be partly codified" case; implementation-phase commits (unknown file sets) stay with Claude.

**Finding 8 — prose rules reading the filesystem are domain queries.** "Count review files in `.workflows/.cache/{wu}/discussion/{topic}/`" is a session-state fact the adapter should surface (e.g. `review_cycles: 0`) — not an ad-hoc bash + prose rule re-stated in two sections (G and H).

## 6. Walkthrough 3 — workflow-start (the front door)

The entry hub: boot gates, the overview, and the inbox working set (`SKILL.md` + `active-work.md` + `inbox-working-set.md`; the lifecycle sub-flows `manage-work-unit.md` / `absorb-into-epic.md` were not walked in detail — noted below).

| Moment (today) | What it actually is | Ring |
|---|---|---|
| Step 0: ASCII-art welcome + init signposts | Static chrome (already literal blocks) | author-time literal + lint |
| Step 0.2: invoke `/workflow-migrate` | Already code (an island); orchestration + commit gate in prose | → finding 9 |
| Step 0.3: `knowledge check` → branch → `knowledge compact` | **Fixed check pipeline in prose** — two CLI calls + branching, same every boot | → finding 9 |
| Step 1: `!` head insert overview | Reasoning surface | adapter |
| Step 2: `has_any_work` branch | Flow control | skill .md |
| Step 3: Workflow Overview (grouped numbered list + `└─` sub-rows, inbox hint, counts) | Flat list (survey 3A — not a tree), fully data-determined | domain projection |
| Step 3: menu + per-type routing table | Deterministic from data; routing label-matched | menu projection + action keys (finding 3 again) |
| "Re-run discovery to refresh" after each sub-flow returns | State refresh | one adapter call |
| Working set render: tree + wrapped summaries (third gutter user) | Layout = renderer; **summaries are LLM-synthesised from item files** | → findings 10, 11 |
| Working set add/drop: multi-select lists, NL mapping ("add 2 and 4") | Menus deterministic; mapping free-text to action+selection is judgment | projection + LLM |
| Archive the set: `mkdir` + `mv` per item + one commit | Hand-executed **transaction** | engine command → finding 12 |
| Work the set: type-uniform table → work_type pre-seed | Pure lookup | domain |

**Finding 9 — boot is a check pipeline; collapse it to one call.** Step 0 is pure sequential checks (casing aside): migrations status/run, knowledge `check`, knowledge `compact`. All code already — the prose just sequences CLI calls and branches on their output. An `engine boot` (or `status`) returning one decision-ready answer (`ready` / `not-ready: knowledge setup needed` / `migrations applied: [...]`) replaces the per-boot plumbing; the .md keeps only the terminal-stop and commit-gate conversations. Migrations stay idempotent scripts — this changes their *orchestration*, not them.

**Finding 10 — ephemeral session state is a third category.** The working set (items added/dropped during one menu flow) is session state like the discussion map — but *deliberately transient*: it dies when you leave, has no resume value, and drives exactly one derived fact (type-uniform ⇒ `w` available). Forcing it into the manifest would be ceremony. The typed-state-in-manifest decision (§2) is about **durable** state; ephemeral selection state can stay in-context with the data-owner-calls-renderer pattern, or a transient `.cache` file. Needs a ruling so the boundary is principled, not vibes: **durable + derivable-from = manifest; ephemeral + single-flow = context/cache.**

**Finding 11 — projections can contain LLM-authored content.** Working-set rows include a summary Claude *synthesises* from each item file ("do not quote verbatim"). So projection inputs aren't always manifest fields — sometimes a field's *value* is LLM-produced text that the renderer then lays out (wrap, cap at 3 lines, ellipsis). The contract holds (layout is code, content is data) — but worth noting synthesised summaries are cacheable (synthesise once per item, not per render).

**Finding 12 — inbox lifecycle is another transaction family.** Archive (`mkdir -p` + `mv` per item + scoped commit), restore, and hard-delete (`git rm`) are hand-executed multi-step transactions — same family as cancel/reactivate (finding 4). `manage-work-unit.md` and `absorb-into-epic.md` (495 lines, unwalked) almost certainly hold the biggest ones (pivot, absorb) — flagged for a later pass.

## 7. Walkthrough 4 — implementation task loop (the iterating shape)

The most distinct character: a **state machine in prose** (`task-loop.md`, stages A–H looped per task) — Claude drives the loop, executor/reviewer agents do the work, the user gates. Walked: the task loop specifically (bootstrap steps and analysis loop not yet).

| Moment (today) | What it actually is | Ring |
|---|---|---|
| A. Next task: manifest `get external_id` → format `reading.md` → "next available task" | **"What's next" over the output format**, not the manifest — task graph lives in the format backend | → finding 14 |
| A. Reset `fix_attempts`, delete fix-tracking cache, mark in-progress | Per-task setup **transaction** (3 ops) | engine `task start` → finding 13 |
| B/D. Executor / reviewer dispatch + checkpoints | Delegation + judgment | skill .md / LLM |
| C. Executor-block menu | Conversation | skill .md |
| E. Increment counter (CLI), append findings to cache file (templated), branch on `attempts >= 3` and `fix_gate_mode` (CLI get) | Mechanical bookkeeping spread over 3+ tool calls + prose branching | engine `task fix-attempt` → finding 13 |
| F/G. Fix/task gates + `auto` mode writes | Conversation + single-field state | .md (mode writes ride engine responses) |
| H. Format `updating.md` + remaining-in-phase check + `key-of` resolution + 3–4 manifest writes | Completion **transaction** | engine `task complete` → finding 13 |
| H. Commit code + tests + plan progress | Only the agent knows which files it touched | **Claude — the confirmed counter-example** for codified commits |
| I. Exit → analysis loop | Flow control | skill .md |

**Finding 13 — the loop driver stays Claude; the bookkeeping collapses.** The economic constraint means Claude *is* the loop engine — that's fine, the loop's control flow is conversation-shaped (gates, retries, user comments). What collapses is each iteration's plumbing: today ~6–8 tool calls of counters, cache appends, mode reads, and manifest writes per task; with `engine task start` / `task fix-attempt` / `task complete` it's ~2–3, each returning decision-ready state (`{attempts, threshold_reached, gate_mode, phase_complete, next_task}`) so the .md never does a separate `get` to decide a branch. Over a 30-task plan, that's a large absolute saving — the iterating shapes multiply every win.

**Finding 14 — output formats are a second state backend, capability-split.** "Next available task" is the next-decision API again, but answered by the format adapter (tick / local-markdown / linear), not the manifest. Some backends are code-driveable (tick CLI, local-markdown files); some are inherently Claude-mediated (linear via MCP). The engine's task commands need one contract with a capability split per format driver: engine answers directly where it can, returns a `delegate: {format reading.md}` instruction where only Claude can reach the backend. Open design point — don't flatten this distinction.

## 8. Moment taxonomy (emerging, cross-flow)

The walkthrough moments generalise into recurring classes — each with one home:

| # | Moment class | Home |
|---|---|---|
| 1 | Static chrome (boxes, signposts, gate rules) | Author-time literal + CI lint *(agreed 2026-06-12)* |
| 2 | Parameterised chrome (dynamic labels) | Rendered by code |
| 3 | Reasoning surface (state dumps) | Adapter prints domain detail |
| 4 | In-context filtering/counting (leaked derivation) | Domain ring |
| 5 | Canonical projections (dashboards, maps, menus, legends, callout bodies) | Domain ring, via kernel renderer |
| 6 | Judgment moments (sequencing, analysis, state-transition calls, content) | LLM — stays |
| 7 | Conversation (gates, STOPs, selection capture) | Skill .md |
| 8 | Routing a choice | .md routes on **action keys** from the menu projection *(agreed 2026-06-12)* |
| 9 | State transitions (cancel/reactivate/unblock/triage-landing + commit) | Engine commands, transactional *(agreed — small transactions in first wave; pivot/absorb later)* |
| 10 | Session/conversational state (live maps) | Manifest-backed typed state; judgment decides, engine CLI records *(agreed)* |
| 11 | Boot/check pipelines (migrations, knowledge check + compact) | One engine status call, decision-ready *(proposed)* |
| 12 | Ephemeral session state (working set) | Context/cache, not manifest — durable+derivable = manifest; ephemeral+single-flow = context *(agreed 2026-06-12)* |
| 13 | LLM-authored content inside projections (synthesised summaries) | LLM produces, projection lays out; cacheable per item |
| 14 | Loop bookkeeping (counters, caches, progress, format updates) | Engine task commands with decision-ready responses *(proposed)* |
| 15 | External task backends (output formats) | Format drivers behind one contract, capability-split: code-driveable vs Claude-mediated *(open)* |

## 9. Open questions — resolutions (2026-06-12)

Walking concluded after four flows: continue-epic (navigation), discussion-session (in-phase), workflow-start (front door), implementation task loop (iterating). Walkthroughs 3–4 produced only additive taxonomy changes — the convergence signal. Remaining flows (entry-skill bootstrap, manage/absorb transactions, analysis loop, discovery session loop) get walked per-skill during migration, where tests catch the details.

1. ~~**Static chrome**~~ — **RESOLVED: literals + lint.** Static blocks stay literal in .mds, validated by a CI test against the renderer; runtime rendering only for parameterised content. *Supersedes locked decision #1's "CLI for trivial shapes" at static call sites — the CLI remains as a utility.*
2. ~~**Action-key routing**~~ — **RESOLVED: yes.** Menu projections emit `{key, action, topic, route}` on the reasoning surface; .mds route on the selected key. Label prefix-match tables go.
3. ~~**Write side in v1**~~ — **RESOLVED: transitions + small transactions.** Map-state recording (mandated by #4) plus cancel/reactivate, inbox archive, and the scoped session-commit helper. Pivot/absorb wait for a later wave.
4. ~~**Conversational state**~~ — **RESOLVED**: manifest-backed typed state, engine-recorded transitions (finding 5 decision + §2 principle).
5. **Adapter thinness in practice** — walked per concrete case; working line so far: views of *domain objects* (maps, dashboards) = domain; views of *conversational moments* (soft gates, off-topic prompts) = adapter/skill.
6. ~~**Ephemeral session state**~~ — **RESOLVED: ratified.** Durable + derivable-from → manifest; ephemeral + single-flow → context/`.cache` (§2 boundary note).
7. **Format-driver capability split** (finding 14) — engine answers directly for code-driveable backends, returns a delegate instruction for Claude-mediated ones; shape the contract when `engine task` commands are designed (implementation skill's migration turn). Not blocking.

## 10. Build sequence (PROPOSED — for mark-up)

Each phase is its own PR off `main` (one PR per change); this design log stays on its long-lived branch and merges at the end. Iterative throughout — fixtures + tests per phase, reasoning surfaces byte-stable unless intentionally changed.

**Phase 0 — engine skeleton + chrome lint.** Create `skills/workflow-engine/scripts/` (kernel/, domain/, `engine.cjs` stub). Move `render.cjs` → kernel, `conventions.cjs` → domain; retire `workflow-render` (unwired, zero cost). JSDoc typedefs + `tsc --noEmit` gate wired into tests. The chrome lint: a test extracting fenced blocks from skill .mds and validating every `── … ──` / `●──●` against the renderer — fixes the width-drift class repo-wide with no runtime change.

**Phase 1 — the beachhead: epic dashboard read path.** Seed the domain ring (epic detail builder over `discovery-utils` functions); projections: dashboard + key + menu with action keys; continue-epic adapter emits the combined demarcated block (DATA / DISPLAY / MENU); `epic-display-and-menu.md` sections A–C collapse to "call, emit verbatim, route on keys". Kills the motivating bug at its origin. Tree content-width decision (49 vs ~65) made here, as a named constant in conventions.

**Phase 2 — write side, first wave.** Manifest schema for discussion-map subtopics + migration extracting map state from in-flight discussions; `engine map` transition commands; `discussion-session.md` re-pointed (map render = projection; convergence/unresolved = domain queries); cancel/reactivate + inbox archive transactions; session commit helper.

**Phase 3+ — skill-by-skill.** workflow-start (overview projection + `engine boot` consolidation), then the remaining navigation/entry skills one at a time; implementation last of the big ones (`engine task` commands + the format-driver capability contract designed together). Each migration walks its own flow's details; surprises land in that skill's PR, not the platform.
