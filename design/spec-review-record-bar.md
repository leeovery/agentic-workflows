# Specification Review — the record bar

Specification review runs three agent passes per cycle — claims
verification, input review, gap analysis — and loops until all three
return clean, capped at five cycles under `auto`. Since the agents
began running on Opus 5, no review has converged: the gap pass returns
a fresh double-digit batch every cycle, every finding is approved, and
the specification grows by rules nobody decided. The generator is not
a model defect. It is a brief with no floor, a dispose that tests
derivability instead of worth, and an exit condition that cannot be
reached. This programme puts a floor under what counts as a finding, a
record bar under what `settled` means, a lane under what a gap owes,
and a churn exit under the loop. Design log for the stack. Opened
2026-09-18 on four Opus 5 runs across two projects.

## Motivation — the loop does not end

| Run | Date | Model | Gap findings per cycle | Spec words |
|---|---|---|---|---|
| portal, eleven runs March–23 July | pre 2026-07-30 | Opus 4.x / 4.8 | 7,2,1 · 6,1 · 21,12,2 · 17,12,1 · 13,4,3 · 12,4,1 · 6,4,1 · 9,5,1 · 8,2,1 · 8,7,3,2 · 3,1,1 | — |
| portal theming-system | 2026-07-30 | Opus 5, first session | 20,18,14,9,11,9,8,7,9,7,10,4 | 38,511 |
| portal resume-hooks-silently-lost | 2026-08-24 | Opus 5 | 19,13,9,8,10,8 | 6,458 → 13,722 |
| portal open-with-forced-filter | 2026-09-11 | Opus 5 | 14,10,7,6,3,6,8 | 10,841 |
| tick free-text-round-trip | 2026-09-17, v0.7.61 | Opus 5 | 15,10,11,6,7 | 6,154 → 9,099 |

**The model is the only variable.** theming-system ran on the same
agent brief as the Opus 4.8 runs a week earlier — the duplication hunt
landed the day after, 2026-07-31, and theming's 126 findings contain
no Duplication rows. Prose held constant, model changed, and the tail
that used to reach one never reached one again.

**Approval is structural, not a measure of quality.** Every gap
finding in every Opus 5 run was approved: zero declined across 49
(tick), 67 and 126 (portal). Under `auto` an approval is what happens
when nothing stops.

**The findings are consequences of the findings.** In tick's five
cycles 13 of 49 gap findings were Duplication, and the field-selection
section drew findings in all five. Section 9 of that specification
went from 983 words at construction to 2,012 under review. About a
third of the result is rules nobody decided — how a repeated field
name resolves, a section named whole and by position at once, the
output order of positions, zero bytes versus a newline for an empty
bare value. None of them wrong. All of them the planner's honest
calls, made one phase early and written as if decided.

**The volume is not a stop problem.** tick's user gave four inputs in
three hours across five cycles: the move contract
(`design/review-finding-gate.md`) did the job it was built for. What
it does not touch is how much the review writes. The session's own
convergence diagnostic at cycle 5 named the mechanism: *"every rule
added to the field flag creates a new boundary for the next cycle to
find — design work the discussion never did, better settled by a
planner reading the spec."*

## Diagnosis — six mechanisms

**D1 — the gap brief has no floor.**
`workflow-specification-review-gap-analysis` is pointed at *"edge
cases within scope boundaries"*, *"what happens when they're empty or
malformed"*, *"areas where an implementer would have to guess"*. Those
name a search space, not a bar. A stronger model exhausts the space,
and every rule it adds to close a boundary opens boundaries of its
own. The brief trusted the model's own sense of enough; Opus 5 moved
that sense.

**D2 — the duplication rule inverts the finding floor.**
`finding-floor.md` writes duplication as a finding only where
divergence would be silent and consequential. The gap agent's rule is
*"Flag duplication even when the copies still agree"*. Each cycle's
additions restate context so the new text reads on its own; the next
cycle flags the restatement. Self-feeding, by instruction.

**D3 — the altitude collides with planning's.**
`planning-principles.md` gives the planner every fork in how the plan
builds a decided requirement, and calls a how-fork never a stop. The
gap agent lists *"sections that would force an implementer to make
design decisions"* as a finding class. Two rules over the same ground
with opposite verdicts, and spec review reaches it first — so the how
is decided a phase early, in prose, by a pass with no end condition.

**D4 — the dispose tests derivability, not worth.**
`process-review-findings.md` **B** re-derives every staged move
against the bar, and its decline arm fires only where *nothing leans*.
Every gap finding arrives `settled` with a derivation that leans on
something — a neighbouring rule, a convention, the shape of the
document — so the arm never fires. The bar asks whether a call can be
derived; it never asks whether the call was worth writing. The
2026-08-23 ruling that considered and declined a gap-analysis
sufficiency bar rested on portal's 99.6% approval rate read as finding
quality — structural under `auto` — and on *"units converge to low
single digits by cycle 3"*, measured on Opus 4.x files and true of
none of the Opus 5 runs.

**D5 — nothing carries across a cycle.** The gap agent is dispatched
with the specification and nothing else; it never sees an earlier
cycle's tracking file. Implementation's consolidation boundary reads
settled directions before it judges and drops a proposal that reverses
one; spec review has no equivalent. A tick cycle-4 finding was a
cycle-2 addition colliding with a cycle-3 one. The one place a
tracking file did reach a later pass made it worse:
`workflow-specification-review-input` at tick cycle 4 reported that
every unsourced statement it found *"traces to an approved finding in
an earlier cycle's tracking file"* and wrote nothing. The tracking
file had become a source of authority.

**D6 — the exit is unreachable and invisible.** `spec-review.md`
**F** ends the loop when all three passes return clean. Against a
generator that cannot happen. Under `auto` the loop runs to the
cycle-5 cap with one line of output per cycle, and
`convergence-analysis.md` — which already computes a `churning` trend
and the `review_growth` figure — renders only at the cap, after the
churn has run its course.

## The premise

The specification solidifies the decisions the discussion made. The
plan is written from it and the code from the plan. It says what is
being built, not how — not a hard rule: it may cite a file, a command
or a measurement where a decision hinges on one. What it must not
contain is a decision nobody made. An invented rule is hallucination
whether or not it happens to be right, because the specification
survives as the record of decision for the feature.

Coverage is 90–95%, not 100%. The remainder is the implementer's
wiggle room, and it is what a real specification looks like. A gap
that needs a decision is a decision — including the decision of
whether it needs the user at all, which the rest of the system already
settles through lanes.

## The rules

**R1 — settled means the record says so.** A gap finding is `settled`
only where a source document states the answer, or the record uniquely
determines it: arithmetic over recorded numbers, or a decided event
whose consequence follows with no alternative. Where more than one
answer is consistent with the record, nobody has decided. Analogy to a
neighbouring rule, precedent, and first principles are consistency,
not determination.

The discriminator — **determined by the record** against **consistent
with the record** — is the programme in one line, and it is what D4's
bar was missing. It keeps the two prose cases that pin the derivation
arm today: `spec-auto-settles-a-derivable-choice`, where a quoted
total is fully determined by the discussion's own decided release
event, and `spec-derives-an-unsourced-decision`, where a per-attempt
cap is arithmetic over recorded numbers. Both are determination.

**R2 — a gap is a fork with a lane, never a text proposal.** The
question a gap finding answers is not *what should the text say* but
*who decides this*. Four lanes, and one shape that is not a finding at
all:

- **Record-settled** → apply, riding `auto` as today.
- **The builder's** — a mechanism, a boundary or a byte any competent
  implementer settles the same way, or where either way serves the
  user — is not a finding. At most an Observation.
- **Product-level and undetermined** → the `decide` lane.
  `render finding-batch` with `lane: decide` already carries the
  words: *"This one has a single defensible answer, settled by what's
  already decided or by first principles. I've made the call and named
  what determined it. Document it?"* Screens of at most five
  (`BATCH_MAX`), scan and veto, per-item discuss. On approval each
  item lands in the owning source document through
  `resolve-source-incoherence.md` **C. Landing a Resolution** — the
  decision-the-document-never-made shape, a new subtopic section in
  the document's own voice — and the specification re-aligns to it.
  The tracking row records `Routed` with the landing named; the
  Resolution vocabulary needs nothing new.
- **A product fork the record cannot pin at all** → `choice`, which
  stops even under `auto`. Unchanged.
- **Source defect / Unsourced decision** → `route`. Unchanged.

The Move vocabulary becomes `settled | decide | choice | route`.

**R3 — tracking files are never a source.** An approved review finding
does not legitimise a decision nobody made. The input reviewer's
reverse fidelity check reads source documents only; a statement whose
sole provenance is an earlier cycle's tracking file is unsourced and
says so. D5's second half is a rule, not an accident.

**R4 — every finding clears a floor.** `finding-floor.md`'s bar,
ported to the specification review agents: a finding names what goes
wrong for the product's user if the builder guesses, or it is not
written. Duplication is a finding only where silent divergence would
be consequential, which retires the flag-even-when-they-agree rule.
Below the floor a finding lands in the tracking file under an
`## Observations` section and is never walked — the shape the lanes
protocol already uses for sub-bar findings.

**R5 — the bar is 90–95%, and the brief states it.** *"Would an
implementer have to guess"* becomes *"would an implementer guess wrong
about what the product does"*. The gap agent is told the target
coverage and told what the remainder is: planning's honest call, made
by a planner reading the specification with the tree in front of them.

**R6 — full reads, with settled directions.** Every cycle reads the
whole document. Every cycle after the first also receives the earlier
cycles' gap-analysis tracking files as settled directions: a finding
that refines a rule an earlier cycle landed is out unless it
contradicts it. Implementation's mechanism, applied to the one loop
that lacked it.

Delta-scoped later cycles — cycle 2 onward reading only what changed —
were considered and declined. On tick every cycle 2–5 finding that
survives R1–R5 is a consequence of an earlier applied finding, which
argues for deltas. Against that, the Opus 4.8 portal record shows
second and third full reads catching construction defects the first
read missed: reviewer variance over untouched text, which a delta
scope loses. Revisit toward deltas only if real runs under these rules
show cycles 2+ finding nothing but consequences.

**R7 — auto stops on churn, not on the cap.**
`convergence-analysis.md` computes `churning` — recurring near zero
while resolved and new are both positive and roughly equal, which is
exactly the Opus 5 shape. From cycle 2 onward a `churning` verdict
ends `auto`: the diagnostic renders and the re-loop gate
(`render spec-review-gate --variant reloop`) asks. The cycle-5 cap
stays as the backstop for a loop that diverges without churning.
`spec-review.md` **B**'s doctrine line — *"continue running review
until no issues are found"* — becomes *until no product-level gap
remains*, a condition a review can reach.

**R8 — growth is a signal.** Review adds content the sources decide
and removes content that is wrong. Net growth from review-authored
rules is the hallucination signal, and the diagnostic already measures
it (`review_baseline_words` against the live count). This reverses the
2026-08-20 reading, which treated growth as the loop working wherever
it traced to source material: the condition was right and nothing
enforced it. R1–R5 enforce it, which in practice means most of that
growth does not occur.

**R9 — altitude in the construction brief, soft.** The specification
states what the product does and the decisions behind it. Files and
mechanism appear as evidence for a load-bearing claim, or where a
decision hinges on them — a soft rule, not a ban. Measured claims
carry their command (`` `cmd` `` → result) where a decision rests on
the number, not for every fact.

## Decisions taken

- **The gap-analysis sufficiency bar is reinstated**, reversing
  `design/review-finding-gate.md`'s 2026-08-23 "considered and
  declined". That ruling rested on two premises: a 99.6% approval rate
  read as finding quality, which is structural under `auto`; and
  convergence to low single digits by cycle 3, measured on a model no
  longer running the pass.

- **The 2026-08-20 growth ruling is kept as a condition and
  enforced.** Growth that traces to source material is the loop
  working — true, and nothing enforced the trace. R1–R5 enforce it;
  R8 reads the residue as signal.

- **The incoherence flow's derivation arm is untouched.**
  `resolve-source-incoherence.md`'s *"if a defensible derivation
  settles it — the record yields the answer"* stands as written. R1's
  discriminator sharpens what *yields* means there too: determination,
  never consistency.

- **No new engine surface.** `render finding-batch` with
  `lane: decide` at `{wu}.specification.{topic}` serves the decide
  lane as it stands; `render convergence-diagnostic`'s flag wording
  changes to name review-authored growth as the signal. No new gate
  variant, no new Resolution value, no new manifest field.

- **Planning absorbs the 5–10%.** `planning-principles.md`'s
  honest-call rule (#1144) is the downstream this programme hands the
  remainder to, and the planning traceability review traces product
  content only — so an honest call passes it. Nothing new is owed on
  the planning side.

- **The change is model-independent by design.** The brakes are
  explicit — the floor, the record bar, the lanes, the settled
  directions, the churn exit — rather than a brief that trusts the
  model's sense of enough. The next model moves that sense again; it
  does not move these.

## Boundaries

- `choice` is unchanged: a product fork the record cannot pin stops
  even under `auto`, on the bar `review-finding-gate.md` F3 sets.
- `route` is unchanged: Source defect and Unsourced decision go back
  to the owning document and never ride `auto`.
- Claims verification is unchanged. It measures; it does not generate.
- The three passes stay strictly sequential, in the order claims →
  input → gap.
- The cycle-5 cap stays.
- The specification may still cite files, commands and code where a
  decision hinges on them. R9 is an altitude, not a ban.
- 90–95% is the target for what the specification decides, never a
  quota on its length.

## Watch items

The next real specification runs on portal and tick. Measure:

- cycles to clean, and gap findings per cycle against the table above;
- decide-lane volume per cycle. A full screen every cycle is not this
  loop failing — it says the discussions are under-deciding, a
  different problem with a different fix;
- growth against `review_baseline_words`, which should fall toward
  zero net;
- whether cycles 2+ ever find anything but consequences of earlier
  findings — the trigger to revisit delta-scoped later cycles (R6).

## The stack

0. **This design doc** — standalone, merges last.

1. **Engine** — `render convergence-diagnostic` flag wording, with
   the render and simulation pins that move with it.

2. **The bar** — the gap agent rewritten (floor, record bar, 90–95%,
   duplication, Observations); the input agent's
   tracking-files-are-not-sources rule; `review-tracking-format.md`
   for the `decide` move and the Observations section.

3. **The loop** — `spec-review.md` (settled directions passed to the
   gap agent, the doctrine line, the churn stop under `auto`);
   `process-review-findings.md` (the dispose sharpened to the record
   bar, decide-batch handling, builder-level findings declined,
   Observations skipped); `convergence-analysis.md`'s growth note.

4. **Doctrine** — construction altitude, `CLAUDE.md` phase 7,
   `docs/specification.md`.

5. **Prose cases** — re-check `spec-auto-settles-a-derivable-choice`
   and `spec-derives-an-unsourced-decision` against R1; new cases for
   a decide-lane landing, a builder-level decline, the churn stop, and
   the input reviewer ignoring a tracking file.
