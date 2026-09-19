# Planning — spec gaps

The specification review's gap tiers (`spec-review-gap-tiers.md`,
2026-09-19) sorted what a gap owes into three tiers by how much of the
room it needs, and bounded themselves to the specification phase:
*planning and implementation are untouched*. The first planning run on
a specification that had been through six review cycles under those
rules found five gaps the specification never reasoned about, and had
nowhere to land a single one of them: the planner's only prescribed
move was a `[needs-info]` flag and a question, with nothing said about
the answer. This programme gives planning the same three tiers one hop
down, holds a plan while its specification is unsettled, retires the
flag, and closes the two recall gaps that let four of the five reach
planning at all. Design log for the stack. Opened 2026-09-19 on one
Fable 5.1 run.

## Motivation — the answered question with nowhere to go

Portal, `lazy-resume-on-attach`, planning phase, 2026-09-19. Breaking
Phase 2 into tasks surfaced a behaviour the specification asserted —
*a pane can wait indefinitely and still be restored with its original
content* — without the mechanism that makes it true, leaving an
existing default in force under which one rearrangement during the
wait loses the pane's scrollback for good. The planner put the fork to
the user at product altitude, the user settled it in two exchanges,
and the planner then told the user the answer needed a specification
re-entry. The user overruled it: gaps found in planning are fillable
from planning. Five corrigenda landed by hand that session, stamped
`from planning/lazy-resume-on-attach` — a value the correction
reference says cannot exist.

Three things were wrong at once.

**Planning had no landing.** `planning-principles.md` says stop and ask
when the specification is silent on what the product does, and flag it
`[needs-info]`. It says nothing about the answer. The one landing the
phase's own files offered — *note the ambiguity in the task's Context*
(the task author's rule 8) — is the bypass the traceability review then
rejects as content the specification never decided. The correction
reference (`correcting-historical-artifacts.md`) carries exactly the
route planning needed, an omission arm included, and gates it to
implementation and review by phase name rather than by property.

**Nothing held the plan.** A plan can be entered, continued, and
concluded over a specification whose source discussion has reopened
beneath it. The plan's only inflow is the entry advisory (completed
plans alone) and a diff against a stored baseline at resume, both
advisory. Every other phase with an upstream is held engine-side
while that upstream is out; planning's status vocabulary has no wait
and its conclusion checks nothing.

**Review had seen four of the five.** Cross-referencing the corrigenda
against every `## Observations` line in the fourteen tracking files:
the discard confirmation's consequence line — the one user-facing
string on a destructive screen whose wording was not stated — sat in
Observations in gap cycle 2 *and* input cycle 4; the unreadable
`prefs.json` case sat in Observations in gap cycle 6, the final cycle,
on a setting that decides whether every restored pane waits; the
frozen-pane record and the marker-clearing tails each sat one question
short of the defect. A Contradiction was filed as an Observation. And
the load-bearing citation under the data-loss guarantee —
`internal/state/capture.go:96-127` — was never measured in three claims
passes: the claims agent measures stated facts and is told never to
re-litigate decisions, the gap agent is forbidden from reading code,
and no pass owns *read the cited mechanism and check the guarantee
holds under it*. Claims cycle 1 also records that the design frames
the strings lived in were not checked — *this pass has no route to the
design file*.

## Diagnosis

**D1 — the correction gate is drawn around phases, not a property.**
`correcting-historical-artifacts.md` §B admits implementation and
review because they read a concluded golden record from downstream.
Planning reads the same record from the same position, and is the
first phase to read it end to end with a buildable eye — where
omissions surface first.

**D2 — the answer has no home because the spec cannot take it.** The
specification makes decisions clear; it never makes them. A product
decision made in planning therefore cannot land in the specification
as a corrigendum — a corrigendum carries what the record or a
measurement determined. Its home is the discussion, the document that
records decisions, and the specification re-aligns to it. The
specification phase already does exactly this for its own tier 2: the
pick lands in the owning source document first, then the
specification.

**D3 — the flag is the bypass.** `[needs-info]` lets a product question
be answered in the plan and never in the record. Nothing reads the
flag — no format's reading file, no implementation or review step —
and the traceability review rejects what it produces.

**D4 — the plan's upstream signal is one hop short.** A triage landing
on a source discussion flips the specification's source row to `stale`
and flags the completed specification; the specification's status
stays `completed` until someone re-enters it. A hold that keys on the
specification's status alone fires too late; one that keys on a stored
flag on the plan fires only when the specification reopens. The
durable signal is the specification's own unsettledness — its status,
its flag, and its source rows together.

**D5 — the Observation bar admits what the record already answers.** A
point is an Observation when it names no failure for the product's
user or is minor enough that landing it would be polish. A
user-facing string whose every sibling is stated verbatim, on the
screen that destroys user data, is neither: the record — the design
frame, the two existing destructive confirmations — determines the
wording, so the finding is `settled` under R1 of the gap tiers, and a
settled finding never stops under `auto`. The two agents that filed it
sub-floor were both applying the bar as written.

**D6 — no pass reads a cited mechanism.** Claims measures what a claim
states; gap analysis may not read code; input review compares against
sources. A specification sentence that cites a code range as the
ground for a product guarantee is a claim that the cited code delivers
the guarantee, and its measurement is reading the range. Three passes
had the citation in front of them.

## The premise

A phase corrects the record one hop up, in the document that owns the
ground, and that document's own phase decides whether the correction
goes further. Planning's owning document for a derivation is the
specification; for a decision it is the discussion, because the
specification owns no decisions. The three tiers are the same three
tiers: what the record settles is applied without a stop; a product
fork stops for a brief exchange and lands in the record without
reopening anything; only a gap the exchange shows needs the room goes
back, and the plan waits. No route-back by default.

## The rules

**R1 — a decision found downstream lands in the discussion.** A
corrigendum on a concluded specification carries what the record or a
measurement determined — a derivable gap, a measured value, an honest
technical call — never a product decision. A product decision made in
planning is written into the completed discussion document in place,
in the discussion's own idiom (a dated timeline revision of a decided
block, or a new subtopic section where the document never decided the
point), presence-checked, re-indexed, committed; then the
specification is re-aligned to it by corrigendum under the
record-settled arm, the landed decision being the record that settles
it. On an epic the sibling specifications that extracted the same
discussion are flagged stale; the plan's own specification is excepted
because the planner re-aligned it.

**R2 — planning takes the three tiers, one hop down.** A gap the
planner or a planning agent finds in the specification is classified
first, before anything renders: the record settles it (a measurement,
a convention, a sibling decision, first principles over the decisions
the record made whittling it to one answer the session stands behind)
→ corrigendum, silent, one line said; a product fork → a brief
exchange in conversation, the sides composed at product altitude, the
pick landing per R1, the plan continuing; the exchange shows the gap
needs real discussion work → the concern goes to the owning
discussion's triage queue and the plan pauses through the bridge. The
third tier is reached only from an exchange that shows it, or when the
owning discussion is held by another session — the room is occupied,
so the agreed resolution is queued there and the plan waits for it.

**R3 — a plan is held while its specification is unsettled.** A
specification is unsettled when it is not terminal and its status is
not `completed`, or it carries a live reconcile flag, or any of its
source rows is not `incorporated`. The predicate is derived from the
specification item alone, never stored. It holds the plan's entry
(the existing entry gate's planning arm, widened), its birth and
reopen, its conclusion (a `specification` wait alongside the
research and experiment waits), its epic menu rows (keyless, carrying
the reason), and the linear next-step derivation (which walks past a
stale-but-unflagged specification today). A session already inside
the plan meets the hold at its conclusion — the same backstop the
research wait is for a discussion already in session.

**R4 — planning's agents report spec defects; the orchestrator judges
them before the gate renders.** The phase designer, task designer, and
task author gain a `## Spec Defects` section in their output, the
shape implementation's finder and synthesizer already use. The
orchestrator classifies every entry per R2 before the task-list,
author, or finding gate renders, so what the user approves was
designed against a correct specification. The task author's rule 8 —
note the ambiguity in the task's Context — goes; it was the bypass.

**R5 — the landing is one shared reference.** The specification's
incoherence flow §C — presence scan, edit in the owning idiom,
re-index, stale the other extractions, commit — is extracted to a
shared reference both the specification and planning load. The
response to a held document stays with each caller: the specification
keeps its lane-bound held-document gate; planning queues and pauses
(R2). Two copies of a landing rule is the divergence the duplication
line names.

**R6 — `[needs-info]` is retired.** From the planning principles, the
traceability review, the task author, the three output formats'
Flagging sections and their labels, the phase summary, and the
output-format contract, which loses its Flagging requirement outright.
The tiers are the mechanism; a gap is answered in the record or it
holds the plan.

**R7 — a point the record already answers is never an Observation.** A
user-facing string, value, or behaviour the user meets whose answer
the record already holds — a design frame, a source document, a
sibling section, a stated rule — is a `settled` finding, whatever its
size; so is a Contradiction. The Observation bar keeps what it had:
the builder's, and polish that names no failure.

**R8 — a citation the specification leans on is read.** A `file:line`
citation under a product guarantee is a claim that the cited code
delivers the guarantee; the claims pass reads the range and checks the
sentence against what the code does, the read quoted as the
measurement. The claims dispatch also names the work unit's imports,
so a claim whose ground is a design file the unit holds is measurable
rather than recorded as out of reach; one whose ground the unit does
not hold stays Unreproducible.

## Decisions taken

- **A derived hold, not a stored flag.** Extending the downstream flag
  to an in-progress plan was the smaller-looking change and the wrong
  one: the flag fires at the specification's reopen, one step after
  the landing that unsettled it, and the entry advisory clears it.
  The specification's own state is the durable signal, and the
  research wait is the precedent — derived from the upstream item's
  status, never stored.

- **`sources stale` runs from planning on an epic.** The plan's own
  specification is re-aligned by the planner, so it is excepted; a
  sibling specification that extracted the same discussion now
  carries a superseded decision and must reconcile at its next entry.
  Single-topic work types have no siblings and skip it.

- **A held discussion is tier 3 from planning.** The specification's
  held-document gate offers next-or-stop because its flow can set the
  extraction aside and continue with others; a plan has one
  specification and nothing to continue with. The agreed resolution
  goes to the held session's queue and the plan pauses.

- **Planning's third tier reopens the owning discussion only.** The
  specification's gap exit offers a new topic and a roadmap park
  because the specification is where a gap's scope is judged against
  the work; planning is one hop further from that judgment. A gap that
  is nobody's topic, or beyond the unit, reaches those destinations
  once the specification is back in its phase.

- **The output-format contract loses Flagging.** Nothing reads the
  flag, and a contract section every format must fill for a mechanism
  the workflow no longer prescribes is residue.

- **Gap 2 is a no-op.** The claims pass runs every cycle; a clean run
  writes no tracking file by rule. Absent files are clean verdicts.

- **Delivery is untouched.** Implementation and review still land the
  user's pick on an open verdict in the staged proposal, never in the
  discussion — the same doctrine gap, Delivery-side, deferred as a
  watch item rather than widened into this programme.

## Boundaries

- The specification's own gap flow is unchanged bar the extraction of
  its landing steps; the gap exit's destinations, the settled batch,
  and the Move vocabulary stand.
- Research and discussion are untouched; the discussion reviewer's bar
  is untouched.
- Implementation and review are untouched — no new hold, no landing
  change.
- `topic triage` and the discovery map are untouched; planning is a
  new origin phase in prose only, the engine validating the target.
- The claims pass gains a read, not a lens: it still measures stated
  facts and never weighs a decision.

## Watch items

The next planning runs on Portal and tick, and the next specification
review after the bar change. Measure:

- spec defects reported per planning run, and their tier split — the
  target is tier 1 and tier 2 with no reopen;
- corrigenda landing from planning that a later phase revises — a
  tier-1 call that turns out to be a decision;
- Observations per review cycle after R7 against the cycle's later
  corrigenda — the target is none of the latter visible in the former;
- claims findings from cited reads — whether R8 finds the class it was
  built for without generating churn on citations that hold;
- Delivery's open verdicts: how often an implementation or review
  Decision lands a product call the discussion never carries.

## The stack

0. **This design doc** (#1224) — standalone, merges last.

1. **Engine** (#1225) — the derived `specUnsettled` predicate; the
   `specification` wait for planning in `waits()` and the wait gate's
   clause; `topic start`/`reopen planning` refusals; the entry gate's
   planning arm widened; `computeNextPhase` reusing the predicate; the
   epic menu's planning rows withheld while held, the tree tagged and
   cued; `render wait-gate` and `render phase-paused` accepting
   `planning`. Tests, goldens, simulation permutations.

2. **Shared references** (#1226) — the landing extracted from the
   incoherence flow's §C into `landing-a-resolution.md`, loaded by
   both phases, the held-document response staying with each caller;
   `correcting-historical-artifacts.md`'s gate and
   `{correcting_phase}` widened to planning; `triage-landing.md`
   taking `planning` as an origin.

3. **Planning prose** (#1227) — `resolve-spec-gap.md` (the three tiers
   at planning) loaded from phase design, task design, task authoring,
   and the review walk's dispose; the planning agents' `## Spec
   Defects` sections, the shape pinned in `read-specification.md`;
   `conclude-plan.md` meeting the wait gate and completing before it
   re-stamps the baseline; `[needs-info]` retired across every
   surface, the output-format contract losing Flagging; `CLAUDE.md`
   phase 8; `docs/planning.md`.

4. **Spec-review recall** (#1228) — the three review agents' Observation
   bar and `review-tracking-format.md`; the claims agent's
   cited-mechanism read and its dispatch's imports input.

5. **Prose cases** (#1229) — planning settling a tier-1 gap, landing a
   tier-2 decision, and pausing on tier 3; the entry block over an
   unsettled specification; the conclusion meeting an empty wait gate
   and completing before the re-stamp; the §C cases re-pinned; the
   planning cases' conclusion order re-pinned.
