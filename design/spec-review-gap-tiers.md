# Specification Review — gap tiers

The record bar (`spec-review-record-bar.md`, 2026-09-18) gave the
specification review a floor, a bar for `settled`, settled directions
across cycles, and a churn exit. It also gave a product-level gap the
record does not determine a lane of its own — `decide`: the reviewer
makes the call, names what leaned and the alternatives, and the walk
holds every such call for a veto screen that stops even under `auto`.
The first real run under those rules stopped on that screen in every
cycle. This programme retires the veto screen, sorts what a gap owes
into three tiers by how much of the room it needs, and aligns the
discussion reviewer's bar with the specification's so the gaps that
reach specification are the ones the discussion genuinely missed.
Design log for the stack. Opened 2026-09-19 on one Opus 5 run.

## Motivation — the call is made, now ratify it

Portal `lazy-resume-on-attach`, specification review 2026-09-18 to
2026-09-19, the first run on the record bar. `finding_gate_mode` set
to `auto` at finding 1.

| Cycle | Pass | Findings | `decide` | Stops under `auto` |
|---|---|---|---|---|
| 1 | claims · input · gap | 2 · 4 · 8 | 0 · 1 · 5 | 2 batch screens |
| 2 | input · gap | 2 · 6 | 1 · 4 | 2 batch screens |
| 3 | claims · gap | 1 · 4 | 0 · 1 | 1 batch screen |
| 4 | input | 1 | 1 | 1 batch screen |

Thirteen of twenty-eight findings took the `decide` lane. Every one
carried a call, what leaned, and the alternatives that also fit the
record; every one was approved. The user's words on seeing the third
screen: *"If the decision has already been made why stop? What am I
meant to do? Argue?"*

**The lane asserts two things that cannot both be true** — the call
is made, and the call needs the user's eyes. `ask-or-decide.md` names
the shape: *presenting a settled call for ratification costs the user
a full read to say "yes" — the wall this rule exists to prevent*.
Every other walk in the pipeline already answers it the same way. The
implementation and review proposal walks settle a below-the-bar fork
on what leans, else on an honest call, and the plain proposal rides
`auto` (`raising-a-decision.md` **A**). The planning findings walk
settles a how-fork on the planner's honest call and rides `auto`
(#1144). Only the specification review held a call Claude had made
for a screen.

**The bar the record bar set was the right provenance rule and the
wrong stop rule.** R1 there — *determined by the record, never merely
consistent with it* — is what a `settled` finding must say about its
derivation, and it stays. It was also read as the line between
riding `auto` and stopping, and that reading is what produced the
screens: a call that follows from first principles over the decisions
the record made is consistent, not determined, so it stopped, however
obvious.

**The brakes on growth were never the stops.** Gap findings per cycle
ran 8, 6, 4 against 19, 13, 9, 8, 10, 8 on the last Portal run before
the record bar; the specification grew 27% under review against 48 to
112% before. Under `auto` a stop declines nothing — the floor, the
settled directions, and the churn exit did that work.

**Why the discussion did not find them.** The two review briefs hunt
at different bars by construction. `workflow-discussion-review` at
settled maturity asks *would specification be wrong or blocked
without it*, and its brief sends *an implementation detail
specification will settle on its own* to Observations, never raised.
`workflow-specification-review-gap-analysis` asks *would an
implementer guess wrong about what the user gets*, and hunts exactly
what the discussion reviewer defers: inputs empty or malformed,
integrations unavailable, boundaries the record is silent on,
fallback behaviour unstated. Everything between those two bars
arrives at specification review as a fork nobody decided. Portal's
thirteen sort as: five failure modes of a mechanism the discussion
chose (the marker write fails, the clear fails, the store refuses a
discard, a resize storm, a pane smaller than the card); four product
edges the discussion stopped one step short of (a typo in the stored
mode, Enter during the discard confirmation, a command longer than
the card, a light/dark theme pair); two consequences of the run's own
earlier landings; two the input pass raised in the gap pass's
clothes. All were askable in the discussion — every one hangs off a
mechanism or a screen the discussion had already decided.

## Diagnosis

**D1 — a judgment tier that stops.** #1130 ruled the specification
has no judgment tier: underivable stays a `choice` and stops. The
record bar added a tier — the reviewer judges — and stopped it anyway.
The walk's dispose sends a `settled` call whose derivation is
precedent or first principles to `decide` (process-review-findings
**B**), and **C** holds `decide` for a screen that *overrides `auto`*.

**D2 — one live side still reaches the screen.** The dispose rule *a
fork with one live side is `settled` where the record determines the
live side, `decide` otherwise* sends a one-sided fork to the screen
whenever its derivation is precedent. Portal cycle 2, finding 4: the
alternative freezes a pane's saved scrollback for its lifetime with
nothing reporting it. No informed user picks it; it stopped.

**D3 — a `choice` lands in the wrong document.** The finding gate's
numbered pick lands in the specification alone; the same point met at
construction lands in the owning source document through the
incoherence flow. Noted as a pre-existing tension in #1130 and left.

**D4 — the gap exit reaches only an existing source.** The incoherence
flow's **B. The Gap Exit** delivers to `{doc}`, one of the
specification's own sources, and the walk's route arm says *the route
never leaves the spec's sources*. A gap that is its own topic — the
thing a real room would name and reconvene on — has no door, and
neither has a gap that belongs on the roadmap.

**D5 — two review bars, one seam.** The discussion reviewer defers the
edge classes the specification gap agent is briefed to hunt. The seam
is where the thirteen came from; it is not a lapse in either agent.

## The premise

Auto means auto. A gap at specification is, in order of likelihood:
source material the specification missed (input review, `settled`,
rides `auto` today); an edge of a decided mechanism or screen with an
answer first principles over the record make obvious; a genuine
ambiguity that needs a short exchange; and, rarely, a product gap
large enough that the room goes quiet — everyone looks at each other,
and the specification pauses while a discussion is convened.

The first two are Claude's. There will usually be three or five ways
to do a thing, and they are not equally valid; when they are, the
choice does not matter and Claude picks. The target is 90–95%. A
small call that turns out wrong resurfaces at implementation or
review, or never matters. The third stops for an exchange and lands
its answer in the record — never a ping-pong back to discussion. The
fourth pauses, and the gap goes where it belongs: an existing topic
reopened, a new topic on the map that becomes one of this
specification's sources, or the roadmap.

Ideally the discussion is robust enough that the review runs once and
finds nothing. That is not where the models are, nor where a real room
is; the review cycle stays, and the discussion reviewer is brought to
the same bar so the cycle finds what was genuinely missed.

## The rules

**R1 — `settled` is the record's answer or Claude's call.** A finding
is `settled` where a source document states the answer, the record
uniquely determines it, or first principles over the decisions the
record made whittle the fork to one answer Claude stands behind; or
where several answers are equally fine and Claude picks the most
appropriate. A call the record does not determine names what leaned
and the alternatives that also fit — the record bar's provenance rule,
kept. A `settled` finding rides `auto`. A product-level call the
source document never made still lands there first, through the
incoherence flow's **C. Landing a Resolution**, carrying the
derivation marker and the alternatives; the specification re-aligns
to it and the row records `Routed`. That landing is the audit trail
for the 5–10% that resurfaces.

**R2 — the Move vocabulary is `settled | choice | route`.** `decide`
is retired at every site: the walk, the three review agents, the
tracking format, `render finding`, `render finding-batch`'s spec
caller. What was `decide` is `settled` under R1.

**R3 — one live side is never a fork.** A side no informed user would
choose is not a side. A fork with one live side is `settled`, its
derivation naming why the other side is dead — whatever the derivation
is made of.

**R4 — the builder's is still not a finding.** A mechanism, boundary,
byte, ordering, or format detail any competent implementer settles the
same way, or one where either way leaves the user well served, is the
planner's honest call. The reviewer writes it as an Observation at
most; the dispose declines one that arrives as a finding. Unchanged
from the record bar.

**R5 — a `choice` stops, inline, and lands in the record.** A fork
that clears every prong — product-level, irreducible, a side visibly
costs the user, the tie-break is product intent — stops whatever the
gate mode. It presents as it does today: the options with a stance,
`render finding` with `move: choice`. The pick lands in the owning
source document first, through the incoherence flow's **C**, then the
specification re-aligns; `Routed`, the landing named. The comment
branch is the exchange: it settles (lands as a pick does), or shows
the pick is the reader's (the menu re-presents), or shows the gap
needs the room (R6).

**R6 — the gap exit reaches three destinations.** Where an exchange
shows a gap needs work the specification cannot do in place, the
incoherence flow's gap exit offers: an existing source topic, reopened
through its triage queue; a new topic, created on the map through the
shared topic-creation core and added to this specification's `sources`
as `pending`, so the specification waits for it and re-extracts when
it concludes; or a roadmap park, where the gap is not this
specification's to fill — the finding records `Declined` naming the
roadmap item and the specification continues. The first two pause the
specification as the exit does today. Epic-only for the new topic and
the park; the linear work types keep the reopen.

**R7 — manual mode batches the settled lane.** Under `gated`, the
walk's `settled` findings render together on the batch surface —
`render finding-batch`, lane `settled`, screens of at most five, each
row the call and what leaned — with `y/yes` landing the screen,
`discuss N` raising one after the rest land, `ask N` expanding one to
its Problem, Proposal, and diff, and `a/auto` flipping the rest
through. Under `auto` the same surface renders a display of what
landed and no menu; nothing stops. `choice` findings walk one at a
time after the batches; `route` findings take the incoherence flow.

**R8 — one bar for construction and review.** The incoherence flow's
derivation arm — *a decision the sources never made but a derivation
pins lands in the owning document with a one-line notify* — reads
*pins* by R1: determination, or first principles over the record
whittling the fork to one. The construction door and the review door
meet a source-silent point the same way.

**R9 — the discussion reviewer hunts the same edges.** At settled
maturity the discussion reviewer's bar keeps *would the consuming
phase be wrong or blocked without it* and drops *an implementation
detail specification will settle on its own* for the altitude
distinction: how the tree achieves it is the builder's; what the
product's user gets at an edge of a decided mechanism or screen — an
input empty or malformed, a dependency unavailable, a boundary, a
failure of the mechanism itself — is this phase's. Such a finding
files `decide` where the record determines the answer and `ask`
otherwise, and the discussion has no `auto`: the user is in the room
for every genuine fork, which is where a product decision belongs.

## Decisions taken

- **The veto screen is retired under `auto` and kept as manual mode's
  batch.** The screen was the right shape for a user who is present
  and the wrong shape for one who opted out of being asked. R7 is the
  same surface answering both.

- **#1130's "no judgment tier on the spec side" is narrowed.** The
  specification still never invents product intent: a fork whose
  tie-break is product intent stops (R5). What it may do is make the
  call first principles over the record make obvious, and record it
  with the roads not taken. That is the tier planning and
  implementation already had; the specification's version lands the
  call in the source document rather than the plan.

- **The record bar's R1 stands as provenance, not as the stop rule.**
  A `settled` finding still says what determined it or what leaned
  and what else fit. Whether it stops is R5's prongs, not the
  determined/consistent line.

- **The record bar's R2 lane table and its `choice` boundary are
  superseded by R1–R7 here.** That document is concluded and is not
  edited; this one is the record of the change.

- **The brakes on growth are unchanged.** The floor, the settled
  directions, the churn exit, the growth flag. They did the braking on
  the Portal run and they do not depend on a stop.

- **No route-back by default.** A genuine ambiguity is an exchange and
  a landing (R5), never a reopen. The gap exit (R6) is reached only
  from an exchange that shows the room is needed, or from the
  classify step's own judgment that the gap needs discussion work.

## Boundaries

- `route` for Source defect and Unsourced decision is unchanged.
- Claims verification is unchanged bar the Move vocabulary.
- The three passes stay strictly sequential, claims → input → gap.
- The cycle-5 cap, the churn exit, and the floor stay.
- Research and discussion still have no `auto`.
- Planning and implementation are untouched.
- Every landing in a source document still goes through the
  incoherence flow's **C**: presence check, held-document queueing,
  the collapsed-topic return.

## Watch items

The next real specification runs on Portal and tick. Measure:

- stops per run under `auto` — the target is the opt-in gate alone,
  plus any genuine `choice`;
- how many `settled` findings at gap cycle 1 are edges the discussion
  could have decided, after R9 lands in the discussion reviewer —
  that number should fall;
- consequence chains across cycles (Portal: a failed discard reports
  in place → where the report goes → which screen holds it, one per
  cycle) — the settled-directions exclusion should catch a refinement
  of a landed rule and did not on cycle 3;
- discussion growth from R1 landings — Portal's discussion grew 28%
  under this review, all of it audit trail; whether that reads as
  record or as noise decides whether the landing shape changes.

## The stack

0. **This design doc** — standalone, merges last.

1. **Engine** — `render finding-batch` gains the `settled` lane with
   an `a/auto` row and a display-only auto form; `render finding`
   drops `decide`; `render incoherence-gate --variant gap-route`
   gains the destination rows. Tests, goldens, the simulation.

2. **The specification prose** — `process-review-findings.md` (moves,
   the dispose arms, the settled batch, the choice landing);
   `resolve-source-incoherence.md` (the derivation arm, the gap
   exit's destinations, the settled-batch caller); the three review
   agents' Move sections; `review-tracking-format.md`;
   `spec-review.md` where it names the batch; `CLAUDE.md` phase 7;
   `docs/specification.md`.

3. **The discussion reviewer** — `workflow-discussion-review.md`'s
   bar; `CLAUDE.md` phase 4.

4. **Prose cases** — the spec cases that pin the decide batch or the
   choice landing re-pinned; new cases for the manual-mode settled
   batch and the gap exit opening a new topic.
