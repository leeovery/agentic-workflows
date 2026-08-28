# Consolidation Walk Altitude — propose first, author after the shortlist

The consolidation boundary, the analysis loop, and the review synthesis
loop all author full task detail *before* the user has agreed any task
should exist, then render that detail wholesale at every approval gate.
The walk that should be a shortlist discussion arrives as a spec review.
This is the design log for splitting judging from authoring across the
three flows, unifying the consolidation walk's two presentation modes,
and giving spec defects found downstream a sanctioned, silent route.
Opened 2026-08-28.

## Motivation

### The failure this starts from

First live run of the consolidation boundary (folio, work unit
`folio-ui-and-api`, topic `template-authoring-system`, phase 3). The
finder returned 11 consolidations plus verdicts on 22 banked entries;
the judge folded them into 10 tasks. Three observed defects:

1. **Full detail authored pre-gate.** Stage B of `consolidation-pass.md`
   wrote `consolidation-tasks-p3.md` with complete bodies — Problem,
   Solution, Outcome, Do steps, Acceptance Criteria, Tests — before the
   user saw anything. The judge and the task-writer are fused into one
   step; stage E's writer then merely transcribes staging → plan.
2. **The walk renders all of it.** `render proposed-task`
   (`domain/render.cjs`) unconditionally emits the whole body, and its
   payload schema *requires* `steps`/`criteria`/`tests` non-empty — a
   summary-level walk is impossible on the current surface. Mid-walk the
   user asked for a TL;DR; the session trimmed the display to a tight
   Problem + one-line Solution/Outcome (keeping vestigial one-line
   stubs for the three required blocks). Every walk decision in the run
   — 10 approvals, one decline reversed on a two-sentence
   clarification — was made on problem + direction alone. The deep
   detail never changed a call.
3. **The set-aside findings arrived as improvised prose.** Stage B's bar
   set three non-refactor findings aside; stage E's entire prescription
   for surfacing them is one sentence ("present each plan-authorable
   finding and offer ad-hoc-plan-changes.md"). With no render surface
   behind it, the session authored its own casual question ("Want any
   of these folded into the plan?") — exactly what the
   all-menus-engine-rendered rule exists to prevent. The user — the
   system's author — could not tell whether the moment was prescribed.

The same fused judge/author shape exists in the analysis loop
(`analysis-loop.md`: the synthesizer agent writes full staging detail,
stage F renders it all) and the review synthesis loop
(`review-actions-loop.md`: same, stage D). All three share the
`proposed-task`/`tasks-overview` surfaces and the
`workflow-implementation-task-writer` agent.

### The precedent

Planning already has the correct two-altitude shape, per phase:
`define-tasks.md` gates on a summary task table (name + one-line summary
+ edge cases, via `render task-list`) — the gate question is *is this
the right split of the work?* — and only after approval does
`author-tasks.md` write full executor-ready bodies. Structure is agreed
cheaply before expensive detail exists.

## Decisions

Settled in conversation 2026-08-27/28.

### 1. Judges produce proposals, not tasks

Stage B (consolidation) and the two synthesizer agents still apply
their bars, fold findings, and settle bank verdicts — but the staging
file they write holds **proposals**: title, class tag, **Problem**,
**Solution** (what will be done), optional **Outcome** (included only
when it adds something Solution doesn't carry). No Do steps, no
acceptance criteria, no tests. Detail that doesn't exist can't be
rendered, can't drift, and isn't wasted when a proposal is declined.

### 2. The walk stays structurally as-is, rendered at proposal altitude

Same overview list (`tasks-overview`, unchanged), same one-at-a-time
gate (y/auto/decline/comment), same manifest staging semantics
(`staging.p{N}`/`staging.c{N}` rows, gate modes, crash-resume guards —
branch conditions unchanged; only what the staging file holds at each
stage changes). `render proposed-task` makes the three block fields
optional: the body renders only what the payload carries. One surface,
two altitudes, caller picks by payload.

### 3. One unified consolidation walk — presentation follows the move owed

The two-set split (structured refactor walk, then conversational
set-asides) collapses into one list. The judge's bar survives as an
internal **router**, not a presentation divider — the same principle as
the review-findings lanes: classified by the move owed, never by
taxonomy. Per item:

- **Pure refactors** walk as today (class tags `duplication`,
  `near-miss`, `drift`, `dead-code`, `complexity`, `comments`).
- **Behaviour-changing improvements** join the same walk tagged
  `behaviour`. The tag is one word in the existing tag slot — kept
  because it costs nothing and matters the day a regression traces back
  to an approved item. The author writes these under a relaxed
  contract: new tests expected, not "existing tests stay green".
- **Items carrying an open decision** (the folio A4-vs-preferCssPageSize
  case) cannot be a bare `y` — approving without the *how* delegates
  the decision to the executor. The walk stop presents the decision's
  sides as the menu's options (the specification conflict-menu idiom),
  payload-declared, engine-rendered. The overlap check against pending
  plan tasks moves to judge time so a proposal arrives already saying
  "nothing upcoming covers this".
- **Items that don't land in the plan** state where approval sends them
  in one line — hiding *that* difference would recreate the original
  confusion in mirror image.

The E/F freeform "surface set-asides and offer ad-hoc-plan-changes"
step is deleted — its landing machinery is consumed by the walk's
routing. `ad-hoc-plan-changes.md` itself remains for its conversational
caller (unplanned work surfaced mid-task).

### 4. Authoring happens after the shortlist, for survivors only

A new agent, `workflow-implementation-task-author`, expands the
approved proposals into full bodies **in the staging file** — grounded
in the proposal, the finder's/analysis findings file (file:line
specifics), the specification, and the code. Then the existing
`workflow-implementation-task-writer` transcribes staging → plan
exactly as today. The writer is untouched: its transcribe-exactly
contract (Hard Rule 2) and crash-resume idempotency are load-bearing
for all four of its callers, and the staging file stays the interface
between the two agents.

**No second gate on the authored text.** Planning re-gates authored
bodies; here the walk was the go/no-go, the user's walk comments ride
to the author as input, and the executor/reviewer loop still guards the
work itself. A deliberate divergence from planning, decided as such.

**Reference reuse over agent reuse.** `workflow-planning-task-author`
stays untouched — its contract is spec-centric ("specification is
source of truth", spec-section traceability), wrong for tasks grounded
in code observation. The new agent loads planning's `task-design.md`
cross-skill for the template and quality standards (the precedent:
consolidation-pass already hands the writer planning's output-format
adapters by relative path), with its prompt naming which fields apply
(the staging core six; no Edge Cases / Context / Spec Reference).
Planning's agent carries an inline restatement of `task-design.md`'s
template; tidying that duplication is banked, not bundled here.

### 5. Spec defects found downstream: a sanctioned, silent route

Once a work unit's specification is concluded and a downstream phase
(consolidation finder, analysis, review) finds it defective, the move
is classified — the same classifier shape as the spec phase's
`resolve-source-incoherence.md`:

- **The record settles it** (supersession by an approved landed change;
  a derivable factual repair): fix the spec **silently, now** — in-place
  edit + corrigenda entry + single-file `knowledge index` + commit.
  Applied by the orchestrator at judge time, before authoring, so tasks
  are authored against a correct spec. Never inside a task (an executor
  editing spec prose mixes ownership). No gate, no walk item; at most
  one summary line in the pass's output ("N spec corrections
  recorded") — reporting, not raising.
- **The code is wrong, the spec is right**: not a spec correction — a
  proposal in the walk (typically `behaviour`).
- **Genuinely open** (fixing either side means *making* a decision):
  a walk item carrying the decision. If in doubt, raise.

This is a deliberate, named exception to the no-gap-editing rule
(artifacts change only inside their own phase sessions): the corrigenda
entry is the audit trail that replaces the human gate — silent but
recorded, re-indexed so the KB stays truthful. It extends
`correcting-historical-artifacts.md`'s world: that reference today
covers only *another* unit's **completed** spec (its in-progress branch
forbids outside edits entirely — which is precisely why folio's O3 had
no route and surfaced to the user). The new branch: **same unit, spec
concluded, defect found by a downstream phase, record-settled**. The
cross-unit branches keep their existing gates. All three flows point
their spec-defect findings here.

### 6. Scope

Consolidation, analysis loop, and review synthesis all take the
altitude + author changes (shared surfaces, shared writer — half-
migrating leaves one verb serving two philosophies). The unified walk
(decision 3) is consolidation-specific — the other two never had the
two-set split. Ad-hoc plan changes keeps full-detail gating: its
discussion happens *before* drafting, so pre-gate detail is not the
same defect.

## The folio evidence

Session `839ee687-33ce-40d4-9565-be26591db232` (project
`/Users/leeovery/Code/fabric/folio`). The run that surfaced all three
defects, and the walk's validation: task 5 (`.env-local` Gotenberg URL)
was declined on a misread (port vs hostname), corrected in two
sentences, reversed to approved — the discussion format working at
summary altitude. Its three set-asides: O1 paper-format defect (open
decision → folded via ad hoc), O2 stale-schema sample data (spec right,
code wrong → folded), O3 stale Working Note 7 (record-settled
supersession → the class decision 5 makes silent).

## Plan

- **PR0** — this document, standalone.
- **PR1 — engine**: `render proposed-task` proposal altitude
  (`steps`/`criteria`/`tests` optional; body renders what the payload
  carries) + decision items (payload-declared sides as menu options).
  Engine tests + pipeline-simulation updates.
- **PR2 — author machinery**: `agents/workflow-implementation-task-author.md`
  + `invoke-task-author.md` (implementation references). Writer
  untouched.
- **PR3 — consolidation prose**: `consolidation-pass.md` B–F rewrite —
  proposals at B (spec corrections applied silently there; behaviour
  findings join the list), proposal-altitude walk at D, author + writer
  at E, freeform set-aside offer deleted. The same-unit spec-correction
  branch lands in the shared reference with this first consumer.
- **PR4 — analysis + review prose**: `analysis-loop.md`,
  `review-actions-loop.md`, both synthesizer agents' output contracts;
  spec-defect findings routed to the shared reference.
- **PR5 — prose cases**: new/updated cases for the changed walks;
  `select --diff` sweep.

## Log

- **2026-08-28** — Log opened. Decisions 1–6 settled in conversation;
  stack shape approved.
- **2026-08-28** — Stack built and opened: #1042 (engine) → #1043
  (author agent) → #1045 (consolidation prose) → #1046 (synthesis
  loops) → #1047 (prose cases), linked as stack #1044. Decisions made
  in the build:
  - **Author test contract inverted**: the refactor framing applies
    only to the six named refactor classes; *any* other tag authors as
    a deliberate behaviour change. Safe under both the consolidation
    class vocabulary and the synthesis loops' high/medium/low grades —
    an unknown tag can never author a genuine fix as a refactor.
  - **Finder restructured, not bypassed**: the `behaviour` finding
    class absorbs the deleted plan-authorable demotion, and spec
    defects arrive as a structured `## Spec Defects` report section
    (claim / observed / the finder's read) — the judge classifies
    authoritatively. Observations stay sub-bar and unraised.
  - **Spec-corrections summary is inline prose, not a fenced display**:
    the conventions lint ratchet pins new templated fences at 0; the
    corpus one-line-total idiom (`background-agent-surfacing.md`)
    serves instead.
  - **Zero-proposal cycles**: both synthesis loops gained a
    stages-no-proposal branch (the empty overview was a dead end
    against `render tasks-overview`'s non-empty requirement), and the
    settle steps create the staging file when a defect-only synthesis
    wrote none.
  - **Known residue, accepted**: a crash in the narrow window after a
    spec-defect-only synthesis commit and before the settle costs one
    redundant analysis cycle, or orphans a bare review `gate_mode` row
    — corrections themselves are never lost (each lands with its own
    commit). Closing it wants an engine-side marker written at
    synthesis time regardless of task count; deliberately not built.
  - **Banked tidy**: `workflow-planning-task-author` still inlines its
    copy of `task-design.md`'s template; drop it once the shared
    reference is authoritative for both authors.
