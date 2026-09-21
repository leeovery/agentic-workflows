# Planning Review — convergence

The planning review loop gets the brakes the specification review got on 2026-09-18 and 2026-09-19, and both loops get an `auto` that means auto: a churning verdict, or the cycle cap, ends the review with the diagnostic shown and one line said — never a gate.

## Motivation — twelve cycles, forty-nine findings, zero declined

Portal's `lazy-resume-on-attach` plan ran its review on 2026-09-20 under `auto`. Cycles 1–4 ran silently, as the loop prescribes. From cycle 5 the loop stopped after every round with the diagnostic and the re-loop gate, and the user answered `y` eight times — at 14:04, 15:56, 16:28, 16:55, 17:19, 18:32, 20:32 and 21:29 — because the diagnostic read `converging` six times and `stable` twice, and its callout under `converging` said *Continuing is likely to resolve remaining items.* It never read `churning`.

The run:

| cycle | traceability | integrity | plan words at cycle start |
|---|---|---|---|
| 1 | 3 | 6 | 63,929 |
| 2 | 2 | 4 | 65,371 |
| 3 | 4 | 4 | 66,353 |
| 4 | 1 | 2 | 67,271 |
| 5 | 1 | 4 | 67,734 |
| 6 | — | 1 | 68,255 |
| 7 | 1 | 2 | 68,255 |
| 8 | — | 3 | 68,780 |
| 9 | — | 2 | 68,955 |
| 10 | 1 | 3 | 69,364 |
| 11 | 2 | 1 | 70,232 |
| 12 | 1 | 1 | 70,610 → 71,917 |

Forty-nine findings, every one `settled`, every one applied, none declined, no Observations — the format has no such section. The plan grew by 7,988 words (+12.5%) to 5.4 times the size of its 13,274-word specification. The specification's own review, on the record bar shipped two days earlier, had run six cycles (8, 6, 4, … findings) and stopped on the cap.

The findings were not noise. Each names a failure a user would meet. What they were is the review designing the product's terminal-input handling one defect at a time: cycle 10 found the appearance probe reading the wrong descriptor and prescribed a `/dev/tty` reader seam; cycle 12's traceability pass found a bare escape byte dispatched as a keystroke and prescribed an escape-sequence resolver with a byte cap; cycle 12's integrity pass found that resolver mis-terminating an OSC reply and prescribed an introducer branch and a second cap. Each fix wrote mechanism the specification never decided into a task's **Do**; the next cycle's fresh reviewer read that mechanism and found the defect in it. By cycle 12 task 5-3 specifies a terminal escape parser. That is implementation's job, under tests, with the code in front of the builder.

## Diagnosis

Four defects, none of them the reviewer's judgment.

**D1 — the diagnostic cannot say churning.** `convergence-analysis.md` classifies *resolved* as every finding of any prior cycle absent from the latest, and *new* as the latest cycle's first appearances. In a loop that applies every finding in its own cycle, resolved is cumulative and new is per-cycle: at Portal's eight gates the resolved rows were 18, 12, 9, 8, 8, 6, 8, 8 against 1, 1, 2, 2, 1, 3, 2, 2 new. `churning` requires resolved ≈ new; `converging` requires resolved > new. The verdict is structurally `converging`, and the callout under it is a recommendation to continue. The same reference serves the specification loop, so the churn exit shipped on 2026-09-18 rests on a verdict that cannot fire either.

**D2 — the planning briefs have no brakes.** The specification programme named its root causes — the brief trusted the model's sense of enough, the dispose tested derivability rather than worth, no cross-cycle memory, an exit that could not be reached — and shipped the finding floor, `## Observations`, earlier tracking files as settled directions, a coverage target and the growth signal. Planning got none of them. Neither planning brief loads the floor; neither tracking format has Observations; neither reviewer sees an earlier cycle's file; `Minor: Polish or improvement that strengthens the plan` is a severity class; and `process-review-findings.md` states *nothing is declined at the dispose*. Under `auto` that is a generator with a 100% acceptance rate and no memory.

**D3 — the integrity brief pulls the plan below its altitude.** Its purpose line says an implementer should execute the plan *without needing to make design decisions*, and `Important` is *would force implementer to guess or make design decisions*. CLAUDE.md #8 and `altitude.md` say the opposite: mechanism is the implementer's; the plan pins what the product does, the task's design, and the criteria that prove it. A brief that treats every builder's call as a plan defect writes mechanism into the plan, and mechanism is the one thing a fresh reviewer can always find a defect in.

**D4 — `auto` has no exit.** `plan-review.md` §E under `auto` loops to cycle 4 and then renders the re-loop gate after every cycle from 5, with no churn check and no cap. The specification loop's cycle-≥5 arm is the same gate. Under the 2026-09-19 ruling — *if the decision has already been made why stop? What am I meant to do? Argue?* — a gate every round under `auto` is the ratification wall by another name.

## The premise

The plan is the last document before code, and its review is a sweep for what an implementer would build wrong — not a second pass at the design. A plan review finding names a failure the product's user would meet if the implementer followed the plan as written; where the plan prescribes a mechanism the specification never decided and the mechanism is wrong, the remedy restates the behaviour and the criterion that proves it and takes the mechanism out — it never swaps one mechanism for another. The loop is finite by construction: a cycle that turns over findings without recurring ones is churn, and churn ends the review; the cap ends it regardless; and under `auto` neither end is a gate.

## The rules

**R1 — the floor and Observations at planning.** Both planning briefs load the shared `finding-floor.md` and state its planning flavour: a finding names what the implementer builds wrong or fails to build, for whom, and how it would be noticed — or it is not written. Both tracking formats gain `## Observations` at the end: one line each, sub-floor points and anything minor enough that landing it would only be polish; never walked, never counted, never re-raised. The Observation bar from `planning-spec-gaps` R7 carries over unchanged: a point the record already answers is never an Observation, and a Contradiction is a finding. Severities are `Critical` and `Important` only; `Minor` is retired — polish is an Observation. The convergence reader counts `## Findings` alone for planning as it does for the specification.

**R2 — the builder's is not a finding.** The integrity brief's purpose is re-aimed: an implementer executes the plan without making product decisions; the builder's calls — a mechanism, boundary, byte, ordering, or format detail any competent implementer settles the same way, or one where either way leaves the user well served — are theirs to make with the code in front of them. `Important` becomes *would force the implementer to guess at a behaviour or a criterion the product's user meets*. A finding whose whole remedy is mechanism the specification leaves open is not written; at most it is an Observation. A finding may name that a prescribed mechanism builds the wrong behaviour; its Proposal then restates the behaviour the task must deliver and the criterion and test that prove it, and removes the mechanism the record never decided. At the dispose the one decline is the builder's — mirroring the specification walk — and everything else disposes as today. The line is altitude, not size: the plan's how — which task owns a slice, what a consumer keys on, what state it keeps, the seam a test injects — stays the planner's to state, and a staged fork in it whose sides differ in stored state, tests, or code shape is settled at the dispose on the planner's honest call, as CLAUDE.md #8 has it; the builder's is the detail inside that how, which any competent implementer settles the same way or which leaves the user equally served either way, and that is what the dispose declines.

**R3 — settled directions.** From cycle 2 both reviewers receive every earlier cycle's tracking files of both streams, listed by the orchestrator at dispatch. A finding that refines, extends, or re-scopes a landed fix is out unless it contradicts it; a point an earlier cycle declined or recorded as an Observation is never raised again. That bounds what a reviewer may find, never what it reads — every cycle reads the whole plan (the 2026-09-18 ruling against delta-scoped cycles stands).

**R4 — the diagnostic reads the latest cycle against the previous one.** In `convergence-analysis.md`, for every loop type: *resolved* is the previous cycle's findings absent from the latest; *recurring* is a latest-cycle finding that appeared in any earlier cycle; *new* is a latest-cycle finding with no earlier appearance. The trend rules keep their shape — churning when recurring is zero or near it and resolved and new are both above zero and roughly equal; converging when resolved exceeds new; stable when they match; diverging when new exceeds resolved — and become reachable. Against Portal's cycle 12 the reading is three resolved, two new, one recurring: churning.

**R5 — growth is the signal for planning too.** `review_baseline_words` lands on the planning item when review opens (cycle 0 → 1), the word count of `planning.md` plus every `phase-{N}-tasks.md` — the plan's own record; the format's storage is its mirror. The diagnostic reads the pair for `planning-review` as it does for `spec-review`, and the render surface accepts growth for both multi-stream loops, its flag wording naming the plan where the plan is the document.

**R6 — the trend callouts describe, never recommend.** `converging` stops reading as an instruction to continue. Each trend line states what the cycles show; what to do about it is the loop's own arms and the user's call at a gate.

**R7 — auto means auto, in both loops.** Under `auto`: cycle 1 always runs a follow-up; from cycle 2 the trend is read in churning-render mode and a `churning` verdict ends the review — the diagnostic renders, one line says the findings are churning and the review is concluding, and the loop proceeds to completion; cycle 5 is a hard cap — the cycle's findings are applied, the diagnostic renders in always mode, one line names the cap, and the loop proceeds to completion. No gate renders under `auto`. `gated` keeps every gate it has: the cycle gate from cycle 4 and the re-loop gate after every cycle. The specification loop's `auto` arms change the same way; the re-loop gates stay for `gated` alone.

## Decisions taken

- The floor is the implementation phase's shared `finding-floor.md`, loaded across the skill boundary as the review phase already loads it — one floor, three phases; the planning flavour is a sentence in each brief, not a second file.
- Both streams' earlier files go to both reviewers. A landed integrity fix is settled ground for the next traceability pass and vice versa; a stream-scoped memory would let the two streams re-open each other's landings.
- The baseline counts the plan's markdown, not the format's store. The store mirrors the task files byte for byte when the plan is sound, and a format may hold its tasks where `wc` cannot reach.
- The classification change is one rule for all four loop types. The fix loop's `## Attempt` sections and the analysis loop's reports are cycles like any other; a per-loop exception would be a second rule to teach.
- The churn exit under `auto` concludes rather than asks. Lee's ruling of 2026-09-21: *auto means auto*, both loops. A user who wants the gate runs `gated`.
- The cap stays at five and concludes under `auto`. A loop still finding things at cycle 5 has said what it can; what it leaves open is the builder's.

## Boundaries

- The planning walk's `choice` and route handling, `resolve-spec-gap.md`'s three tiers, and the spec-side incoherence flow are untouched.
- The fix and analysis loops keep their own arms; only the shared classification reaches them.
- The discussion reviewer and research's aids are out of scope.
- No new gate-mode value, no new manifest field beyond `review_baseline_words` on the planning item, no migration: an existing plan without the baseline skips the growth line, as a specification without one does.

## Watch items

On the next Portal and tick planning runs after release: cycles to conclusion under `auto` and which end took it; findings per cycle from cycle 2 with settled directions in hand; Observations per cycle against later corrigenda; whether integrity findings still carry mechanism in their Proposals; plan growth per cycle against the baseline; the specification loop's first churn conclusion under `auto`; and where the dispose draws the line between a planner's how-fork (settled on an honest call — `planning-settles-a-derivable-choice` pins one) and the builder's detail (declined — `planning-review-declines-a-builders-finding` pins one), the first thing a walk of either case may argue with.

## The stack

- **PR0 — design** (this document, standalone, merges last).
- **PR1 — engine**: the convergence diagnostic surface accepts growth for `planning-review`, its flag wording names the document under review, the trend callouts describe; render-surface tests; a simulation permutation stamping the planning baseline and rendering the diagnostic with it.
- **PR2 — prose**: `convergence-analysis.md` (R4, planning growth read, Observations skipped for planning); the two planning briefs, their tracking formats, the two agents and their invoke references (R1–R3); `process-review-findings.md` (the builder's decline); `plan-review.md` (baseline stamp, R7); `spec-review.md` (R7); the planning format's field table; CLAUDE.md #7, #8; `docs/planning.md`, `docs/specification.md`.
- **PR3 — prose cases**: `planning-review-stops-on-churn` (auto, two cycles, concludes with no gate; the cycle-2 dispatch carries both cycle-1 tracking files), `planning-review-declines-a-builders-finding` (the dispose declines; an Observation is never walked), `spec-review-stops-on-churn` re-pinned to conclude without the gate, and every planning case whose cycle-1 invariants pin the new baseline write.
