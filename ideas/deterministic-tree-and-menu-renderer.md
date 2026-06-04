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
