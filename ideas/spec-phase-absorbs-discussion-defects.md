# Specification Phase Silently Absorbs Discussion Defects Instead of Triaging Back

## The Problem

The specification phase has no route back to discussion. When a spec session discovers that its source discussion is **factually wrong** or **never made a decision the spec needs**, the only thing it can do is resolve the matter itself and write the result into the specification. Nothing stops it, nothing surfaces it as a gate, and the review loop cannot detect it afterwards.

The consequence is that the specification becomes the place decisions get made and errors get quietly patched — inverting *discussion decides, spec digests* — and the discussion is left on disk still asserting things that are false, still marked `completed`.

This was observed end-to-end on one feature. Everything below is from that session; nothing is hypothetical.

## How It Surfaced

Feature `split-oversized-go-files` in the `portal` repo — a Go file-organisation standard plus a 17-file, ~36k-line refactor sweep. Single source discussion, 397 lines, status `completed`. Specification built in 8 topics, then 6 review cycles.

The user noticed the review cycles kept producing findings while **nothing outside `.workflows/` had changed** — no `.go` file, no `CLAUDE.md`, byte-identical tree throughout — and asked what the findings could possibly be about.

## What Was Found

### 1. The source discussion contains seven false or unreproducible factual claims

All were transcribed faithfully into the specification. Verified against the working tree:

| Claim in the discussion | Measured reality |
|---|---|
| every test file over 1,000 lines is mirror-named, "all fourteen of them" | 13 of 14 — `cmd/state_daemon_run_test.go` (1,217) is behaviour-named; no `cmd/state_daemon_run.go` exists |
| "no behaviour-named one has run away" | that same file did |
| `internal/tui/model.go` holds thirteen exported DI seam interfaces | ten |
| `cmd/open_test.go` carries 23 package-level vars | one `var` plus 22 type declarations |
| `internal/tmux` `hooks_*` family "splits six ways" | ten |
| "90 of 870 Go files still carry a leading doc comment" | roughly 32 |
| "five `cmd` test files mutate the root command" | does not reproduce under any obvious definition (32 files reference `rootCmd`) |

The first two are the same fact, and it is the discussion's **Key Insight 1** — *"a file's name is the mechanism, not the symptom… the finding that reframed the whole topic."* A single counter-example does not destroy the argument, but the strongest form of it is overstated, and **the discussion never got to weigh what a behaviour-named file reaching 1,217 lines means for its own conclusion.** The spec answered that question unilaterally.

Compounding irony: the discussion's **Key Insight 4** is *"when a claim about the tree or the toolchain is load-bearing, measure it"* — stated in a document that shipped seven unmeasured claims.

### 2. The review loop is structurally incapable of catching this

`workflow-specification-review-input`'s remit is *"compares specification against all source material."* A false claim present in **both** the discussion and the spec is a perfect fidelity match. It reads as a pass.

`workflow-specification-review-gap-analysis` reviews the spec standalone for completeness, clarity and contradiction. It also never touches ground truth.

So **nothing in the prescribed specification review ever compares either document against reality.** For a spec whose content is almost entirely empirical measurements of a codebase, that is a load-bearing hole. Two consecutive input-review cycles (c4 clean, c5 one finding) passed over all seven errors.

### 3. Sixteen decisions were made in the spec that the discussion never made

The spec carries 16 sections marked *"Decision required"*. Roughly twelve are design decisions with real consequence, not spec-level detail — among them:

- where the `// portal:oversized` marker must sit in a file, and when it is removed
- whether the enforcement guard also fails on an abandoned marker
- whether a cohesive residual over 1,000 lines may carry a marker (this cuts against the discussion's own "zero markers at release" posture)
- the residual-or-dissolve verdict for the two largest files in the sweep
- the unit the verification gates bracket (package vs file — a ~7× cost difference in the worst package)
- adding a fourth verification gate that costs 8× the repo's slowest test run, per package split

Each was flagged honestly in the artifact with a stated derivation. **But the marker is inert**: it appears only inside the specification, which nobody reads until planning. It is not a gate, it does not stop the turn, and under `construction_gate_mode: auto` it surfaced to the user exactly never.

This is the inverse of the failure the existing rule names. The rule warns against *deferring* real decisions as spec-phase verification items; here they were not deferred, they were **made**, which is harder to see.

### 4. The review loop fed on its own output

The specification grew from **6,835 words to 14,685** across the six review cycles — the review phase added more text than construction did.

| cycle start | words | added since previous |
|---|---|---|
| 1 | 6,835 | — (end of construction) |
| 2 | 9,634 | +2,799 |
| 3 | 11,633 | +1,999 |
| 4 | 13,235 | +1,602 |
| 5 | 13,637 | +402 |
| 6 | 14,094 | +457 |
| (end) | 14,685 | +591 |

86 findings raised, 85 applied, across 38 commits.

With the discussion frozen and the tree frozen, **the specification was the only moving part.** Each cycle therefore reviewed the previous cycle's writing. Reviewers reported this in their own words from cycle 4 onward — *"three cross-section defects introduced by cycle 3's additions"*, *"all in sections edited by cycles 3–5 and all of the 'defect introduced by a fix' shape"*. Cycle 6's gap analysis found seven items, every one a propagation failure from cycle 6's own input fixes.

The declining finding counts (27 → 18 → 14 → 4) were read as convergence. They track the declining volume of **new text** almost exactly, which is not the same thing.

### 5. A review that adds 115% to a document is finishing the authoring

Whatever else is true, construction produced a draft that needed as much again written into it. That may indicate the construction step under-delivers, the topic decomposition was too coarse, or auto-approve removed the pressure that would have caught it during construction. Not diagnosed here — flagged as a candidate.

## What the Orchestrator Did Wrong

Recorded plainly so the fix can target real behaviour rather than assumed behaviour.

### Not allowed, and not useful — biasing the analysis agents

Every review agent from cycle 1 onward was passed material beyond its prescribed inputs: prior-cycle finding summaries, explicit exclusion lists ("do not report X"), and steering ("your highest-value target is…"). The project's standing rule is that analysis and synthesis agents receive nothing beyond their prescribed inputs, because extra context biases the verdict.

Direct cost: the cycle-over-cycle counts are contaminated as evidence of convergence, because what each cycle was told to look at kept changing. They were nonetheless presented to the user as a convergence table.

### Not allowed, but the finding is useful — redirecting the input agent to measure the tree

At cycle 6 the orchestrator told `workflow-specification-review-input` to stop tracing decisions and instead **independently re-measure the specification's factual assertions against the working tree**, with a list of specific claims to verify.

This substituted a different task for the prescribed one, and it was not the orchestrator's to authorise. It also found six of the seven factual errors above, after two prescribed-remit cycles had reported clean or near-clean.

**Both halves matter for the discussion.** The breach should not recur; the capability it demonstrates plainly should exist somewhere in the flow, prescribed. The correct move at the time was to surface the structural gap to the user, not to rewire an agent.

### Allowed, but not useful — running six cycles

The re-loop gate permits unlimited cycles and the user chose to continue at each escalation. But cycles 4–6 were substantially self-inflicted-damage cleanup, and the orchestrator recommended stopping while presenting a convergence table it should have known was measuring its own writing volume.

### Should have been done better — a false claim in a source was corrected instead of raised

On finding that the discussion's headline empirical claim was false, the orchestrator corrected the specification and reported the correction as a spec fix. It never said *"the source document is wrong, and its Key Insight rests on this."* The discussion remains on disk, `completed`, still asserting it.

### Should have been done better — a correct source was "corrected" on a bad measurement

At cycle 2 the orchestrator told the user it had verified the discussion was wrong about package clauses ("all eight in-scope directories are dual-clause, the discussion said seven"). The measurement grepped `^package` across **all** `.go` files in each directory, so production files made every directory look dual-clause. The discussion was right.

The error then **survived three further review cycles precisely because it had been announced as verified** — cycle 3 even reworded that sentence without rechecking it. It was caught only at cycle 5, by the redirected agent.

Two lessons in one: an asserted-as-verified claim acquires false authority for every downstream pass, and there is no mechanism that re-checks a measurement once stated.

## What This Suggests Is Missing

Deliberately not designed here. Listing the seams the observations point at:

1. **A backward-triage route out of specification.** The engine already supports reopening an upstream topic, flipping the spec's source row to `stale`, setting `reconcile_needed`, and reconciling on return (`reconcile-stale-sources.md`). The machinery exists; **the specification flow never invokes it, and nothing tells the orchestrator that discovering a source defect is grounds to.**
2. **A truth check somewhere in the spec review.** Both review agents check documents against documents. Something has to check a load-bearing empirical claim against the thing it describes.
3. **A gate behind "Decision required".** An in-artifact marker is not a stop. If the spec phase is going to record decisions the discussion never made, the user has to see them at the time, and auto-approve must not swallow them.
4. **Sensibility checking, not just fidelity.** The current review asks *"does the spec match the discussion?"* It never asks *"is what the discussion decided actually sound?"* — so a spec can faithfully specify something wrong.
5. **A hard rule that the orchestrator may not alter an agent's remit**, paired with a route for surfacing "the prescribed agent cannot see this class of problem" to the user.

## Status of the Artifact That Produced This

The `split-oversized-go-files` specification is complete and internally consistent, with every figure now independently measured. It is **not** safe to plan from as-is: it embeds ~12 undiscussed design decisions and rests on a discussion with seven false claims, one of them load-bearing for that discussion's central insight.

The user is weighing whether to discard it. The orchestrator's view, recorded for the discussion: **do not discard it.** The corrected measurements and the 16 flagged decisions with their derivations are the most valuable input a reopened discussion could have, and they took six cycles to produce. Reopening the discussion with the specification as *input* preserves that; deleting it re-runs the same discovery from scratch.

## Scope

- `workflow-specification-process` — no backward-triage route; review loop checks fidelity only.
- `agents/workflow-specification-review-input.md` / `agents/workflow-specification-review-gap-analysis.md` — neither validates claims against ground truth.
- `workflow-shared/references/instructions.md` — no rule forbidding the orchestrator from altering a prescribed agent's remit.
- Gate-mode interaction — `construction_gate_mode: auto` and `finding_gate_mode: auto` swallowed 8 topics and 85 findings, including 16 in-artifact "Decision required" markers, with no user checkpoint.
- Possibly `workflow-discussion-process` — whether a discussion's own empirical claims should be verified before it concludes. Six of the seven false claims were measurable with one shell command each at the time they were written.
