# Review Maturity — one review, graded by how settled the document is

Every review reads a document and asks whether it is good enough. The
shipped bar asks that one way — *would the specification be wrong,
blocked, or built on a contradiction* — which is the right test for a
settled document and the wrong one for a document two decisions old.
This programme grades what a review looks for by the document's
maturity, and moves each piece of review content into the file whose
name owns it. Design log for the stack. Opened 2026-08-04.

## Motivation (2026-08-04)

- **All field experience is pre-lanes.** The lanes release (#737 and
  its fix stack #747–#753) is merged but installed in no project — the
  user installs once this programme lands. Everything known about how
  reviews *feel* comes from the prior system: no bar, no batching, a
  review dispatched after one decision returning ten findings, each
  with full ceremony and a stop. The recurring experience: *"I'm just
  getting into the flow of having a conversation, and then suddenly a
  review goes off… we haven't even decided on the shape of this yet."*

- **The shipped system likely fails early in the opposite
  direction.** The bar asks whether the specification would be wrong or
  blocked. On a two-decision document, almost nothing passes that test
  — including exactly the findings an early review is valued for:
  areas worth thinking about, threads worth pulling, questions the
  conversation hasn't reached. Predicted (not observed): early reviews
  return thin or empty. The dump and the drought share one cause — a
  single bar applied at every maturity.

- **A mid review and the final review are not different kinds.** The
  final review's special properties are orchestration only: it is
  mandatory once before conclusion, and the closing gate owns when it
  fires. What it looks for is what any review of a fully-decided
  document looks for. Maturity is the axis; "final" is just its far
  end.

- **The shared surfacing file stopped matching its name.** #737 packed
  lane vocabulary, the apply lane's correction shape, and the
  landing-phase judgement into `background-agent-surfacing.md` — a
  file whose name promises surfacing mechanics. The `walk_heading`
  parameter was the tell: a phase's own word passed into a shared file
  as a synonym is phase content living in the wrong home.

- **The landing-phase rule is stated three times, and the
  triplication produced a live flake.** `off-topic-epic.md`,
  `document-review.md`, and the surfacing file's route section each
  state open-question-→-research / correction-owed-→-discussion. A
  prose-test walker resolved the phase from the target topic's
  `routing` field instead; the fix added a fourth statement of the
  rule. A rule that must be restated at every call site is a rule
  living in the wrong place.

- **No prose case walks a research review.** One case touches the
  research phase at all (`research-initialises-from-the-brief`, phase
  initialisation). The research brief inherited a discussion-shaped
  bar and lane vocabulary in #737 with no walk evidence on either
  side.

## The contract

- **M1 — one review, one axis.** Mid-session and final reviews differ
  in orchestration (the final pass is mandatory; the closing gate owns
  its timing), never in nature. What a review looks for is a function
  of document maturity alone. The final review needs no special
  casing: at conclusion the map is decided, so the mature emphasis
  applies by construction.

- **M2 — emphasis by maturity, not thresholds.** Three emphases,
  stated plainly in each brief, with the agent interpolating from the
  document rather than computing a boundary:
  - **early** (little decided): findings are fuel — areas untouched,
    questions worth asking, adjacent concerns. Offered as things to
    pull on, not defects to resolve. Nothing is a "gap" when there is
    no shape yet to have gaps in.
  - **forming** (converging, some decided): gaps proper — decisions
    missing rationale, edge cases unraised, subtopics that stalled.
  - **settled** (mostly decided): the shipped bar as-is —
    contradictions, stale text, readiness for the consuming phase.

- **M3 — the maturity signal is the phase's best evidence.**
  Discussion: the agent derives maturity from the Discussion Map it
  already reads — tracked state beats impression. Research: nothing
  tracked exists, so the dispatching orchestrator passes a one-line
  indication of where the session stands, and the agent weighs it
  against its own read of the document — an input, never a verdict.

- **M4 — three owners, disjoint content.** The agent brief owns *what
  earns a lane* (classification). The phase's caller reference owns
  *what approving a lane does* (vocabulary, headings, resolution — the
  amendment shape, the landing). The shared surfacing file owns *how
  findings reach the user* (lifecycle, announce, screens, ordering,
  promotion, never-dump). No sentence is shared between owners, so
  there is nothing to drift.

- **M5 — the shared file matches its name.** Everything in
  `background-agent-surfacing.md` that is not surfacing mechanics
  moves to its phase's caller reference. The caller's lane block is in
  context before the shared file runs — the existing load-parameter
  mechanism, grouped into one declaration instead of scattered
  parameters. `walk_heading` is deleted.

- **M6 — the landing-phase judgement is stated once.** It moves into
  `triage-landing.md` — the reference that consumes it — as its
  opening step. The three current statements defer to it. The rule
  itself is unchanged: the concern's nature decides, the target's
  `routing` never does.

- **M7 — cadence is deferred, deliberately.** The dispatch trigger is
  untouched. The felt abruptness was measured against the old system;
  the graded bar changes what an early review returns, and the user's
  first real use of the new stack is the first evidence of whether
  timing still hurts. The offer-gate design (dispatch becomes a
  question; deferral anchored to map movement) is on file for that
  eventuality — building it now would mean never learning which change
  mattered.

## Where the moved content lands

| Content | From | To |
|---|---|---|
| Lane names, meanings, walk heading | surfacing §B/§F + `walk_heading` param | each phase's `review-agent.md` lane block |
| Apply resolution (amendment shape, per-finding commit) | surfacing §E | discussion's `review-agent.md`; research variant cites sources, not decisions |
| Route resolution (landing, batch record) | surfacing §G | phase lane block; judgement itself to `triage-landing.md` (M6) |
| Landing-phase judgement | surfacing §G, `off-topic-epic.md`, `document-review.md` | `triage-landing.md`, stated once |
| Screens, stops, store calls, ordering, promotion, never-dump | surfacing | stays |

Synthesis tensions remain all-walk and need no lane block. Deep-dive
findings likewise.

## The stack

1. **Canonical landing phase** — the judgement moves into
   `triage-landing.md`; the three statements defer. Independent,
   smallest, de-risks the flakiest rule first.
2. **The ownership split** — lane blocks move to the phase callers;
   the surfacing file slims to its name; `walk_heading` deleted. Ships
   with the inbound-route enumeration: every path into the shared
   protocol (both session loops, `final-review-menu.md`, deep-dive,
   closing gates) verified to have the phase's lane block in context.
3. **Graded bars** — both briefs restate the bar as emphasis-by-
   maturity (M2); discussion self-derives from the map, research gains
   the dispatch indication (M3).
4. **Coverage and docs** — a case walking a research review (the
   phase's first), a case walking an early-maturity discussion review,
   and the maturity sentence in `docs/research-and-discussion.md`.

## Open decisions

- The three maturity words themselves (early / forming / settled is
  the working set) and how each brief phrases the interpolation.
- Whether research's early emphasis should route naturally into the
  deep-dive offer — an early research finding's move is usually "go
  look", which the deep-dive machinery already owns.
- Whether the docs' phase-neutral wording — *would the phase that
  consumes this document be wrong or blocked* — becomes the canonical
  settled-end formulation in both briefs.
- Cadence numbers, ceilings, and the offer gate: out of scope until
  field data exists (M7).

## Log

- 2026-08-04 — Programme opened. Scope agreed in discussion: maturity
  grading, the three-owner split, the canonical landing rule, research
  coverage; cadence deferred pending first real use of the lanes
  stack. Supersedes the closed review-cadence note (#754), whose
  question returns here as M7.
