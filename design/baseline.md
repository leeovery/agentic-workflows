# Baseline — backfill the record a brownfield project never had

A project that grew up on the workflows accumulates discussions, specs,
and a knowledge base that give every later phase its ambient context. A
project the workflows are installed *into* has none of that — and the
consumption surfaces designed to lean on the record silently fire blanks
forever. Baseline is the assessment that backfills it: fan-out research
over the codebase, synthesised into an interview that extracts the WHY
layer from the one place it still exists — the owner's head — and lands
the result as a KB-indexed doc set under `.workflows/.baseline/`. Design
log for the stack. Opened 2026-08-12 from the discussion with Lee.

## Motivation (2026-08-12)

- **The degradation is real, structural, and silent.** Mapped across the
  tree: the phase-start contextual query (research, discussion,
  investigation, scoping) takes its `[0 results]` → "proceed silently"
  branch 100% of the time on a brownfield install; the required
  `Sibling check:` trace degrades to "no overlap found" — performed-looking,
  information-free; the spec-entry advisory and planning's cross-cutting
  query return nothing; discovery opens cold. `knowledge check` certifies
  "somewhere to write", never "something to read" — an empty store is
  `ready`. Nothing under `.workflows/` records that the project's code
  exists.

- **The consumption side is already built.** The phase-start queries are
  unfiltered — anything indexed under a new phase flows into every one of
  those surfaces automatically, provenance-tagged. The feature is cheap
  where it matters most.

- **Lee has hand-built the answer once and half-built it twice.** FlowX's
  docs corpus (~249 files) is the method fully worked: provenance zones,
  derived trust, per-claim confidence, verdict-first templates, and 686
  surviving `> OPEN:` markers — uncertainty named, never filled with a
  plausible guess. Turnstile's two ~2,000-line architecture guides are
  the failure mode: convention manuals, all HOW, no domain, no WHY.
  Docman's CLAUDE.md is the other failure mode: a decent mini-baseline
  already drifted from the code in three places. One-shot docs rot;
  convention docs are redundant with what agents read from code.

- **The WHY layer cannot be inferred — and must not be faked.** Probes of
  Turnstile and Docman found the same gradient: structure (glossary,
  boundaries, state machines, invariants, integrations) is reliably
  recoverable from code; rationale, business constraints, incident
  history, tuned constants, and partner semantics are not. A naive
  synthesizer is redundant at the well-commented end and confidently
  wrong at the `// FABLOA` end — and this system specifically cannot
  tolerate fabricated rationale: spec construction silently derives
  decisions the record settles, and ask-or-decide only asks when the
  record doesn't. A fake record turns "derive silently" into "fabricate
  silently".

## The decision

1. **Baseline is an interview, not archaeology.** Fan-out agents research
   the codebase per area; a synthesiser converts their findings into a
   ranked question agenda; the user answers in rounds (AskUserQuestion —
   evidence carried in the question, candidate rationales as options, a
   costless "don't know" exit on every question). The agents' product is
   questions; the docs are woven afterwards from what the code showed and
   what the user said. "Grill me and I'll remember" is the design's
   engine.
2. **Three trust layers, replacing FlowX's zones**: *observed* (what the
   code shows, user-confirmed where load-bearing), *stated* (WHY, from
   the interview, in the user's words), *open* (asked and unanswered, or
   never asked). For intent the human is the only source; for mechanism
   claims the code outranks memory and agents corroborate rather than
   transcribe (FlowX's own source hierarchy ranks "Human (Lee)" below
   code — "invaluable for intent/history, but fallible").
3. **Anchor to stable names, never file:line.** Classes, enums,
   subsystems, pipelines — what a future agent greps or semantically
   matches. FlowX needed line citations because nothing else could verify
   its claims; Baseline's claims are verified by a better mechanism — the
   user, live. The confirmation replaces the citation.
4. **Doc set at `.workflows/.baseline/`** — roughly 6–15 files, one per
   concern: `overview.md` (product verdict, user classes, estate
   position), `glossary.md`, `boundaries.md` (modules, surfaces,
   integration map), per-area docs (entity + lifecycle, pipeline,
   subsystem), a thin `conventions.md` (pointer-level), and the open
   questions threaded per-doc. Verdict-first, observation and stated
   rationale structurally separated, unknowns as OPEN items. No per-line
   documentation — code stays the source of truth; Baseline holds what a
   fresh session won't reliably rebuild.
5. **KB phase `baseline`, confidence low, advisory-only.** Indexed like
   imports (reference material, KB-sliced), never as record. Provenance
   line reads `[baseline | …]`; one doctrine line in `knowledge-usage.md`
   fixes the weight: observed/stated context that informs, never a
   settled call a spec may lean on silently. Promotion to record-grade is
   a later decision; demotion after being leaned on isn't possible.
6. **Index-as-you-go.** Docs index per file as areas complete. A
   half-interviewed baseline is live coverage plus a recorded agenda, not
   an all-or-nothing artifact. Consequence accepted deliberately: an
   in-progress baseline already feeds phase queries.
7. **Resumable interview, discovery-session style.** Research dossiers
   and the interview ledger (questions asked, answers given, agenda
   remaining, per-area status) persist under the baseline's own roof —
   committed, not `.cache/` (which is gitignored, purgeable, and keyed by
   work unit, which baseline is not). The ledger is written per round, so
   an abrupt death costs at most the current round; a deliberate exit is
   "stop after this round, commit". Fatigue is the real UX risk: rounds
   are themed per area, batched where independent, sequential where an
   answer branches, ranked by "would a future phase plausibly need this".
8. **Status-keyed surfacing, not origin-keyed.** Project-manifest status
   `none / native / in-progress / completed / skipped`. `in-progress` →
   a first-class resume row on the start menu (unfinished interview
   looks like unfinished work); `completed` → under `m/manage` (view,
   expand, refresh); `none` → nothing recorded yet: workflow-start's
   one-time judgment, which either records `native` (a project that
   grew up on the workflows — never asked again, never a row outside
   manage) or makes the brownfield offer (yes → the assessment, no →
   `skipped`, reachable via manage and the empty-state menu). The
   judgment is recorded whichever way it falls: a verdict with no home
   is re-made every boot, and one boot's wrong roll is an offer a
   native project should never see.
9. **Resume and expand are one flow** — resume walks a non-empty agenda;
   expand generates a new one (new area, or deeper on an existing one)
   and walks it. Refresh (re-verifying the observed layer against moved
   code) is deliberately out of v1: the stated layer doesn't rot, and
   re-running expand over a drifted area covers most of the need.
10. **Decay: none in v1, by the existing mechanics.** Baseline has no
    completion entry on the progress clock, so it reads as frontier and
    never prunes; low confidence keeps it modest as real record
    accumulates. Deliberate aging ("decaying is the point — scaffolding
    the record replaces") is a later knob, now well understood.
11. **Graceful absence for free.** Consumption is provenance-tagged, not
    phase-branched: no baseline → no `[baseline | …]` chunks → identical
    to today. The doctrine line is conditional by construction. The only
    visible surface is the status-keyed menu entry.

## Engine surface (small, mechanical)

- `INDEXED_PHASES` + chunking config for `baseline`; `deriveIdentity`
  path shape `.workflows/.baseline/{topic}.md` with a pseudo-identity
  carve-out (baseline is not a work unit; no manifest to read
  `work_type` from).
- `baseline` reserved as a work-unit name (alongside `project`).
- Project-manifest baseline status field + whatever boot needs to report
  it — and, while nothing is recorded, boot's `baseline_signal`: the
  repository facts the judgment is made from (`domain/baseline.cjs`
  `baselineSignal`): the first commit's date, the date of the first
  commit touching `.workflows/` (null when none is committed yet, so
  the whole history predates the workflows), commits before that
  arrival against the total, and the tracked project files at the last
  commit before it. Null with no git history — the tree decides then.
- Simulation coverage per the house rule; prose cases for the offer, an
  interview round, exit/resume, and the status-keyed menu.

## Relation to the rebuild work-type design

The parked rebuild design's "system ingestion" (fan-out agents → a
trust-graded system map) and "trust/provenance grading" are this idea's
siblings — per-epic, aimed at a system being replaced, where Baseline is
project-level ambient context for the system being continued. Building
Baseline first delivers the trust-grading layer the rebuild design needs.
Convergent, not competing.

## Build log (2026-08-12)

Stack #890: #887 (this log) → #888 (KB + engine surface) → #889 (the
skill) → integration. Deltas from the decisions above, all
ratchet-or-convention driven rather than design changes:

- **Displays are engine-rendered.** The templated-fence ratchet refused
  hand-drawn baseline displays, so the state-derivable ones became a
  four-surface render family (`baseline-progress`, `baseline-area-gate`,
  `baseline-paused`, `baseline-receipt` in `projections/baseline.cjs`);
  the two genuine-judgment presentations (proposed areas, the doc skim)
  render as report-class markdown prose, not fences. Zero new pins.
- **One menu action.** All baseline rows (`a/baseline` on the start,
  empty, and manage menus) share the `open_baseline` action — the skill
  self-routes on `project.baseline.status`, so callers carry no mode.
- **The offer is Step 0.4** of workflow-start (after the knowledge gate,
  which now exits there); decline writes `skipped` and commits.
- **Area statuses**: `pending` (research owed) → `researched` (agenda
  ready) → `completed` (doc landed + indexed) under
  `project.baseline.areas.{area}`.
- **Prose cases still owed**: the offer decline, an interview
  round + pause/resume, the status-keyed menu rows. The interview rounds
  use AskUserQuestion, which the walker harness may not simulate —
  case design must stop at gates it can script.

## Review pass (2026-08-12)

Eight-dimension finder fleet over the stack; Lee's rulings and the
resulting deltas — several revise the decisions above:

- **The interview is conversational, not AskUserQuestion** (revises
  decision 1). Rounds render as engine ask blocks (`baseline-round`,
  payload-fed: numbered questions, lettered candidates) and the user
  answers in prose. Kills the instructions.md exception entirely and
  makes the interview walkable by the prose harness unchanged.
- **Every menu and output is engine-generated** (Lee, mid-review): the
  scope confirmation (payload-validated — area names mechanically
  kebab/dot-free), doc/manage/pick gates, and workflow-start's offer
  menu all joined the `baseline-*` surface family. No prose-authored
  menus anywhere in the feature.
- **No harness-failure workarounds in prose** (Lee): the research
  failure branch is deleted, not elaborated — a transient agent failure
  is rerun in the moment, unprescribed. The same principle stripped the
  planned empty-map guards; the scope persist simply registers areas
  before the status flips, making the crash state unreachable.
- **Deepen is a real merge** (revises decision 9's sibling-area
  reading): reusing an area's name appends new questions to its agenda
  (recorded answers never rewritten) and extends its doc (Decisions
  never dropped, Open Questions reconciled).
- **A declined baseline rides the empty-state menu** (`skipped` →
  `a/baseline` start row) — the empty state has no manage row, and that
  window is exactly the one the offer targets. `none` stays hidden
  there; manage carries the row for every status.
- **The offer keys on precedence, not size** — code and history that
  predate the workflows, so a project that grew up on them is never
  offered one however large it gets. Precedence is read from the
  signal, not from context: a scaffold of a few commits over the first
  days before `.workflows/` first landed is the project's start, a
  substantial run of commits or a tree of working code before it is a
  codebase the workflows were installed into. No "when in doubt, offer"
  — the tree resolves the doubt, the user is never the tiebreak.
- **Confirmation questions restored** (decision 2's "user-confirmed
  where load-bearing"): the agenda keeps confirm-class questions for
  load-bearing observed claims, and a correction to an observed claim
  is re-checked against the code before the doc carries it.
- **`conventions.md` is deliberately dropped from the doc spine**
  (revises decision 4): agents read conventions from code; a baseline
  conventions doc is the Turnstile failure mode in miniature.
- **Legacy work unit named `baseline`**: accepted, no guard, no
  migration, per Lee.
- **One state home**: `domain/baseline.cjs` derives status/areas/
  remaining for boot, the start menus, and every surface; projections
  are pure detail-to-string.
- **Prose worlds stamp `baseline: native`** (the tmux-kill precedent)
  so the workflow-start-entry cases never meet the judgment; a case
  about the judgment itself holds `baseline: {}` in its fixture — an
  object with nothing recorded reads `none` — and the harness strips
  the stamp only where the expected world carries no baseline.

## Open / deferred

- Interview-stated WHY as record-grade (v1: advisory-only; revisit once
  real baselines exist).
- Deliberate decay / aging of baseline chunks.
- Refresh as a distinct verb.
- Depth knob / charter-style coverage matrix (FlowX's completeness
  charter) — v2 territory.
- Discovery opener reads `overview.md` in full when it exists (read-in-full
  when scope matches; conditional, so greenfield untouched) — in scope
  for the stack, listed here so the read-budget interaction with
  continuity-load gets checked at build time.
