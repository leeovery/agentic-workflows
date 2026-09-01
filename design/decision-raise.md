# Decision Raise — a product fork is raised, never rendered

The proposal walks (implementation analysis, review synthesis, the
consolidation boundary) stop the user for an irreducible product fork by
emitting the staged record verbatim: a run-on block of synthesizer-written,
code-facing Problem/Solution prose with the question and stakes at the
bottom, then a menu of sides. The decision-bar stack (#1064–#1069) fixed
who may stop the walk and what the stop must argue; it never touched how
the stop reaches the user. This is the design log for making a surviving
Decision a composed, product-terms raise — borrowing the shape the
background-findings walk already has — and for making that composition
itself the bar's enforcement. Opened 2026-09-01.

## Motivation

### The failure this starts from

First post-release decision stop observed live (Portal, work unit
`resume-hooks-silently-lost`, analysis cycle 3, session dcd7920a). The
walk raised a release-scope fork over a session-name refusal. What the
user got:

1. **A 200-word Problem paragraph entirely in code terms** —
   `ErrUnaddressableSessionName`, `tmux.go:283`, wrapper names — with the
   one judgeable sentence (*a rename the picker accepted yesterday is now
   refused, and here is the message*) nowhere in it.
2. **Run-on layout.** `render proposed-task` joins Problem, Solution,
   Decision, Stakes with single `\n`; markdown collapses them into one
   paragraph. The question sat at the bottom of the wall.
3. **Sides as work plans** ("document the refusal in README's rename
   section and CLAUDE.md's `tmux` row…") — two lists of chores, when a
   choice needs two end states.
4. **A dead fork.** Two sibling proposals approved minutes earlier in the
   same walk had made the fork's losing side unpickable; nothing surfaced
   the dependency, and the stop should never have happened. One user
   question collapsed it.

The register machinery that would have prevented 1–3 exists and is
mandatory elsewhere: `background-agent-surfacing.md` §G composes every
walked finding as a cold-start raise (product perspective first, worked
example / ASCII diagram / before-after devices), and `product-lens.md`
gives report-class content its product register with a technical retelling
one option away. The proposal walks load neither — and both registers
explicitly stop at engine `DISPLAY`/`MENU` boundaries, so the one surface
that puts a live product fork to the user is the one surface no register
reaches.

### The principle

A Decision stops the walk because it needs *discussion* — mirrored
consequences no investigation reconciles — never because it needs a human
rubber stamp. The presentation must therefore ground the reader from zero
in product terms and put two futures on the table, with the record's
technical depth one option away. And a stop that cannot be composed that
way was never a real fork: composition doubles as enforcement.

## Decisions

1. **A surviving Decision is raised, never rendered.** The decision path
   of `render proposed-task` stops emitting the record. Emission order at
   the gate: slim header DISPLAY → the session's composed raise
   (conversational markdown, authored between the two section emissions
   of the one render call) → MENU. The staged Problem/Solution stay on
   disk as the record; they reach the screen only through the technical
   arm. Plain proposals keep the verbatim render (watch item: revisit if
   gated plain walls hurt too).
2. **Slim header.** Title + ordinal + severity, plus the meta lines
   (sources/placement). No Problem, no Solution, no Stakes. The menu
   carries the question as its statement label (`**Decision**: {q}`,
   auto-override line beneath it under auto), then the glyphed
   `◆ Which way?`, the sides, `t/technical`, `d/decline`, Comment.
3. **The raise has two beats**, defined in a new shared reference
   `workflow-shared/references/raising-a-decision.md`:
   - *What changes for the product, from zero.* The user-terms
     before/after first, then one to three understanding devices
     (worked example, small ASCII diagram, before/after list, analogy)
     — the cold-start rule: nothing from the session assumed remembered.
   - *The fork as two end states.* Each side stated as what the product
     is if chosen; the mirrored consequence neither side escapes (this is
     the stop's justification); any sibling proposal the fork depends on,
     named. Position and recommendation carry the staged Stakes argument.
4. **Composition is the test.** The raise is composed before the stop is
   committed. A fork whose sides cannot be written as two distinct
   product end states, or whose mirrored consequence cannot be stated,
   is below the bar by construction — the session settles it and presents
   a plain proposal. The dispose check gains two named clauses: ground
   that has moved includes proposals approved earlier in this same walk;
   and a side no informed user would choose is not a side — a fork with
   one live side is settled.
5. **The shared reference owns the whole decision arm.** Dispose →
   composition → payload/render → response handling (side, decline,
   technical, comment), parameterised over dotpath, staging file, cache
   path, gate-mode variable, and manifest row address. The three walks'
   near-identical "If it carries a Decision" arms collapse to a Load
   with parameters; each walk keeps its plain-proposal path and loop
   routing.
6. **Sides are stored as end states.** The synthesizer agents
   (`workflow-implementation-analysis-synthesizer`,
   `workflow-review-findings-synthesizer`), the consolidation fold step,
   and the two spec-defect staging paragraphs (analysis-loop E,
   review-actions C) require each side written as the product end state
   chosen, never the work to do — with the self-test stated: a fork whose
   sides can't be written as two distinct end states is below the bar.
7. **`t/technical` is a lens shift, not a dump** — per the codified
   precedent (`technical-lens.md`): the session retells the fork
   mechanism-first from the staged record, then re-runs the render and
   re-emits header + menu (the raise is not re-composed; the dispose
   exception that covers the Comment arm covers this arm too).
8. **"Making it land" is extracted** to
   `workflow-shared/references/making-it-land.md` (device palette,
   example-over-description, the glance test); `background-agent-surfacing.md`
   §G loads it, `raising-a-decision.md` loads it. §G's walk-specific
   clauses (cheap path, scene reuse) stay in §G.
9. **Layout fix for what still renders verbatim**: blank lines between
   Problem, Solution, and Outcome in the plain-proposal body.
10. **Payload contract unchanged.** `stakes` stays required beside
    `decision` — it is the record's argument and feeds the raise. The
    engine change is what the decision path *emits*, not what it demands.
11. **The interleave is codified.** CONVENTIONS.md's Engine Output
    Sections gains the sanctioned pattern: a surface may prescribe
    session-composed content between its DISPLAY and MENU emissions,
    within the same turn as the call — never across steps.

## Plan

- **PR0** — this document (standalone branch, not the stack base).
- **PR1 (stack bottom)** — engine: `render.cjs` decision path (slim
  display, question-as-menu-label, `t/technical` row), plain-body
  spacing, `commands.md`, `test-engine-render-surfaces.cjs` re-pins,
  pipeline-simulation updates.
- **PR2** — prose: `raising-a-decision.md` + `making-it-land.md`; the
  three walk arms (`analysis-loop.md` F, `review-actions-loop.md` D,
  `consolidation-pass.md` D) collapse to the Load; end-state sides in
  both synthesizer agents, the consolidation fold, and the two
  spec-defect staging paragraphs; §G's extraction pointer;
  CONVENTIONS.md interleave sentence.
- **PR3** — prose cases: `implementation-walks-a-decision-proposal`
  updated for the raised shape (+ a `t/technical` answer exercising the
  arm), `implementation-settles-a-sub-bar-decision` re-pinned, coverage
  for the dead-fork-settles clause; snapshot goldens regenerated;
  `select --diff main` run at the end.

## Log

- 2026-09-01 — opened, after the Portal task-6 incident. Ruling: the
  stop exists because the fork needs discussion; the presentation must
  facilitate it — examples, product terms, end states — with technical
  depth one option away, and a raise that cannot be composed is the
  below-bar verdict.
- 2026-09-01 — stack up: #1078 (engine) → #1079 (prose) → #1081
  (cases), stack #1080. Two implementation rulings against decision 5:
  a Comment whose feedback settles the fork exits to the caller's
  plain path rather than re-rendering inside the reference — the
  settled payload would draw the approval menu, whose handling
  (including the auto opt-in's caller-specific gate-mode write) is the
  walk's; each walk's plain render instead carries the
  explicit-approval clause (`--gate gated` for a Comment-settled
  fork). And the Comment/technical re-entries skip dispose
  structurally — they loop inside the reference's response section and
  never re-pass it — so no exception clause exists in prose.
  Dead-fork dispose coverage landed by reworking
  `implementation-settles-a-sub-bar-decision` to the Portal shape: a
  Decision staged beside the sibling whose approval forecloses a side.
