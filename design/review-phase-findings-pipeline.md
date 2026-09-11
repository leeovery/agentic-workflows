# Review Phase: Findings Pipeline

**Status:** shipped (stack #900, v0.6.67) and run live once at full scale; recall audited. The executing pass is decided and building.
**Started:** 2026-08-12, from a live incident on Portal's `theming-system` feature.

---

## The Trigger

`workflow-review-process` ran over a 176-task feature and dispatched 175 `workflow-review-task-verifier` agents. They produced **488 non-blocking notes and 2 blocking issues**.

The two blocking issues were a missing three-line conditional and an unemptied directory. Both were spec violations; both would have been fixed on the spot by a human reviewer rather than sent back through planning.

The 488 was the problem — not because the notes were wrong, but because handling them was unmanageable.

---

## What Caused the Volume

### The corpus is stratified by agent version

The verifier agent changed four times. Comparing raw counts across work units is meaningless without splitting by version. Across 31 completed Portal work units, 954 task reports:

| Era | Boundary | Tasks | Notes | Mean | Zero% | Tag mix |
|---|---|---|---|---|---|---|
| A | pre 2026‑04‑02 (untagged prose) | 72 | 82 | 1.14 | 19% | untagged |
| B | 2026‑04‑02 → 06‑03 (tags, no floor) | 367 | 561 | 1.53 | 24% | idea 81% |
| C | 2026‑06‑03 (+floor, +do‑now) | 340 | 255 | **0.75** | **50%** | idea 36 / qf 31 / do-now 29 |
| D | 2026‑08‑06 (+comment accuracy) | 175 | 488 | **2.79** | **2%** | qf 48 / do-now 35 / idea 15 |

Two immediate findings: the Step 6 floor **cut notes 51%** when it landed (1.53 → 0.75) and collapsed `[idea]` from 81% to 36% — it did its job. And era C shows a working detector: half of all tasks produce zero notes.

Era D is `theming-system` alone. No other work unit has been reviewed under the current agent.

### The cause was the model, proven by pinning

`~/.claude/stats-cache.json` records per-day model usage. The switch is unambiguous:

```
2026-07-14  opus-4-8   732M   (no opus-5)
2026-07-20  opus-4-8  2021M   (no opus-5)   ← cli-verb-surface-redesign reviewed, 0.72 notes/task
2026-07-21  opus-4-8  1166M   (no opus-5)
        ── switch ──
2026-08-05  opus-5    1032M   (opus-4-8 → 9.9M)
2026-08-06  opus-5     796M   (opus-4-8 → 0.8M)   ← theming-system reviewed 08-12, 2.79
```

**Every one of the 954 control tasks ran on a pre-Opus-5 model.** The post-floor Opus 4.8 baseline is 0.77 notes/task across 285 tasks and 6 work units, range 0.18–1.25 — stable. Theming is 2.79.

Confirmed by controlled re-run (below): same tasks, same code, same prose, Opus 4.8 → 12 notes where Opus 5 gave 29.

### The prose changes are a minor contributor

Two edits landed close to the incident:

- **#459 (2026‑07‑20)** — one line, hands every verifier the *plan-wide* implementation file list (543 files for theming) rather than the task's own.
- **#793 (2026‑08‑06)** — three lines, adds `Comment accuracy` to Step 5. Comment-related notes went 0.20 → 0.63 per task, roughly 75 of ~357 excess notes (~21%).

Neither can explain the tag-mix shift (`[idea]` 36% → 15%), because neither touches Step 6's tagging. That shift is a model disposition.

---

## Experiments

Four Portal clones, all pinned to `e38cda4a` (the review commit), no git remotes. A **systematic sample** of 10 tasks (every 17th, spanning build phases 2/4/7/8/9 and analysis phases 11/12/13/15/17) whose Opus 5 mean is 2.90 against the population's 2.79.

### Model and bar (t1, t2)

| | o5 stock | o4.8 stock | o5 + bar v1 | o5 + bar v2 |
|---|---|---|---|---|
| notes | 29 | 12 | 7 | 8 |
| zero-note tasks | 0/10 | 3/10 | 4/10 | 3/10 |
| blocking | 0 | 0 | 0 | 0 |
| `[quickfix]` | 14 | 2 | 2 | 5 |

Model pins verified from subagent transcripts (`~/.claude/projects/<project>/<session>/subagents/*.jsonl` carry a `model` field per message) — 100% of verifiers ran on the intended model in every arm.

**Bar v1** (materiality test + "returning no notes is correct" + comments always `[do-now]` + a blanket "don't report that working code could be written another way") over-filtered: it dropped a test that would pass if cancel wrote, a convention-only coupling, and a missing import guard.

**Bar v2** narrowed the exclusion to cosmetic-only, explicitly protecting structural classes (duplication that will drift, coupling safe only by convention, missing guards, complexity, tests that cannot fail). Volume held at 8; the structural classes returned at different sites.

**t2 is a filter, not a resampler:** 8/8 of its findings sit at the same site as a stock note. Same code, same detections, 21 dropped.

### Whole-plan review (t3)

Four lenses (spec-adherence, correctness, coherence, structure) over the whole feature plus a synthesiser. **Not a controlled comparison** — scope, prose and structure all differ from t1/t2. Run as a one-sided existence probe with a pre-declared criterion: a finding with no counterpart in the 488, verified against the code.

Result: 7 findings, 4 with counterparts in the 488, **one novel and verified** — a double-badge bug in `internal/theme/union.go:190`. `listedUnder` compares `row.Slug` while `Identity()` is `cmp.Or(Slug, Filename, Persisted)`, so a bad-name file row (empty `Slug`) and a persisted row naming its filename collide on `BadgeKey()`. The `BadgeKey` carve-out covers `ReasonReservedName` but not `BadNameSlug`.

It matters because of *where it lives*: an interaction between the file-enumeration path and the persisted path — code owned by two different tasks. No per-task verifier can see both sides. That is a structural blind spot, demonstrated rather than inferred.

### Classification into lanes (495 findings)

488 per-task + 7 whole-plan, five parallel classifiers, rule-based with no numeric targets:

```
FIX_NOW        366  (73.9%)
CONSOLIDATION   61  (12.3%)
DROP            45  ( 9.1%)
INBOX_IDEA      11  ( 2.2%)
DECIDE           9  ( 1.8%)
INBOX_BUG        3  ( 0.6%)
```

**23 of 495 reach a human — 4.6%.** Not a target; what the rules produced.

**58 findings were defects wearing a mundane tag** (52 `[quickfix]`, 4 `[idea]`, 2 `[do-now]`). The dominant class: *tests that would stay green if the thing they name broke.* A truecolor channel of exactly `1` reading as bold and false-passing a positive assertion; `GoSourceFiles` returning `(nil, nil)` on a zero-file walk, vacuuming five guards; a `want` derived from the same source as `got`; two consts bypassing an equal-reds fatal, vacuuming ten sites. Also a real user-facing defect — the contrast swatch sets `BackgroundColor` but `RestoreTerminalBackground` runs only for `tui.Model`, so the terminal canvas stays changed after quit.

**This is the argument against a suppressive bar:** every one of those looks like taste until read.

### The apply sweep — the failure

366 FIX_NOW findings applied by 8 parallel agents partitioned by cited file. Baseline: builds clean, 33 packages ok, one known-flaky test (`cmd/bootstrap`, passes 3/3 in isolation).

```
              build  vet   packages ok   failing
baseline        ✓     ✓        33         1 (flaky)
after 366       ✓     ✓        30         4 packages / 6 tests
```

353 of 366 applied (96%), 13 skipped, **34 conflicts reconciled**.

All six failures are architectural guard tests, not typos:

- `TestNoPackageLevelThemeVar` — a fix introduced a package-scope var holding theme data; a theme captured at init can never see a swap.
- `TestOpenExecPath_DoesNoThemeWork` — theme work leaked into the exec path.
- `TestFallback_MissingBuiltinIsFatal` — an emission appeared where silence is required.
- `TestThemingDocExampleThemeIsTheDarkBuiltin` — two findings edited a doc and a theme file to *different* text; a guard binds them.
- plus `TestModelAt_ReachesCapturedState`, `TestCommitFailure_ThemeStaysApplied`.

`go build` and `go vet` both passed. These are individually reasonable changes violating constraints expressed elsewhere.

**This was a strawman test** — raw, unvalidated, undeduplicated findings thrown at parallel agents. It proves mass unattended apply is unsafe; it does not prove a prepped, sequential apply is.

Secondary findings from the run, all real requirements:

- **Findings collide constantly.** Five findings each proposed a different rewrite of *one sentence* in `theme_seams.go`. A sixth edited the same doc block.
- **Partitioning by cited file does not hold.** Agents wandered outside their partition when a finding's real target differed from its citation (`events_test.go`, confirmed collision), findings spanning files got **half-applied** (P112 — worse than not applying, since the code then asserts two different things), and renames had to go tree-wide because a partial rename won't compile.
- **`go build` checks the wrong half** — it does not compile `_test.go`, where most of these findings live. `go vet ./...` does.
- **Findings carry absolute paths** into the real repo, because the verifiers wrote them that way. An applier following them literally edits the wrong repository.
- **Concurrent appliers see transient compile errors** in files they never touched; an applier's own green build proves nothing about the tree.
- **A finding can be self-blocking** — P346's fix invalidates the AST pin that the same finding relies on, unless the pin is re-pointed first.

---

## Ground Truth

The `theming-system` review was triaged by hand (under time pressure, and the user notes the judgment may not have been optimal). Dispositions:

```
Applied     139  (34%)     comments the code falsifies · the do-now sweep ·
                           defects hiding in the quick-fix bucket
Declined     75  (18%)     comment restorations "carrying no claim the code cannot"
Won't fix   191  (47%)     shared-helper extractions, redundant subtests, fixture
                           consolidation — ~85% in _test.go, none touching behaviour
Dropped       2
```

Its stated rationale is a usable criteria source (not a correctness oracle):

> "Applying them would rotate roughly 28,000 lines of test code for no change in coverage, against a real risk of breaking working tests. If the duplication is ever worth addressing it is worth **one deliberate consolidation pass**, not 191 separate edits."

That independently reached the same conclusion as `ideas/implementation-end-of-phase-pass.md`.

---

## Corpus Caveat

`theming-system` straddles the comment-standard change. Its plan and early code were written when tasks *instructed* comments; the standard now forbids most of them, and later strip sweeps removed what those steps wrote. The verifiers graded against the criteria as written and filed the gap.

So this corpus **overstates raw volume** and **understates prep's proportional value** relative to a feature planned entirely post-change. Conclusions drawn from it should be discounted accordingly.

---

## Current Design

### Principles settled

- **Detection is not the problem.** 8/8 of the filtered set were real; 58 genuine defects hid under mundane tags. Do not suppress at source.
- **Classify by cost to act, not by value.** A finding's importance stops mattering once it costs nothing to fix. The question is "does this need a human/design", not "is this worth reporting".
- **Reversibility is the axis for ceremony.** *Would getting this wrong be painful to undo, and could the suite fail to catch it?* No → do it now. Yes → planning, implementation, review. An error message is one sentence, one commit; breaking the hook system is not.
- **"Blocking" must not mean "loop back".** An AI reviewer has the context a fresh implementation subagent would. Sending work back is a constraint inherited from human process, where the reviewer lacks the context to write the fix.
- **No numeric targets anywhere.** Rules, not counts. The output is however large the rules make it.
- **The report is for the AI, not the user.** The user does not read `report.md` or the per-task reports. The synthesiser must therefore run *before* the report is written — the report should *be* the synthesis.
- **The loop-back mechanism must survive.** Its value is not human judgment (there is none in it) but the independent task-loop reviewer. Do not filter it to death; gate it on reversibility.

### Pipeline

```
per-task verification   one read-only verifier per task; a criterion reading
                        cannot settle is recorded under its own heading,
                        never passed over
 → executing pass       once, after the batches; three to five change-set
                        verifiers over the whole change-set, split by the
                        specification's numbered sections plus one over the
                        test surface; measures where the project gives a
                        way to; takes the unsettled criteria as items to
                        measure; one findings file + one coverage map per
                        section
 → prep                 assessor (validity · standards · remedy) ×N · guards
                        (inventory first, depends verdict) ×N · relationships
                        (both streams as one set, duplicates collapsed) ×1
 → synthesis            verify claims, collapse collisions, route, derive the
                        verdict; out-of-scope banked on the manifest;
                        checkpoint commit
 → apply                batched appliers (whole connected file-sets,
                        sequential) → fix-verifier over the complete
                        uncommitted diff (runs the suite) → one commit
 → report               written from the outcome; Specification Compliance
                        is the coverage maps; Plan Completion names what
                        neither layer could measure
 → present              verdict tier · findings · gate: p/plan | c/complete
```

Two detection layers, one routing. Per-task verification holds each task against its criteria and the spec by reading; the executing pass holds the whole system against the specification's intent and the product by measuring. Everything downstream is shared — the same prep agents, the same lanes, the same derived verdict.

Verification-side rules:

- A blocking issue with a contained remedy routes do-now; the report's Corrected in this session section names it as blocking and corrected. A spreading one replans. Aggregation reads the BLOCKING ISSUES section, never `STATUS` — `issues_found` is a status clean reports also use.
- Coverage (`reviewed_tasks`) is pushed after every batch, never once at the end.
- The assessor asks one question with the code open: is a comment remedy a comment remedy because the prose is wrong, or because it was the easy edit? When the remedy changes to code, synthesis re-reads blast radius with the code open — the one case where a verifier's call is not carried through untouched.
- The per-task verifier keeps its no-execution rule, stated beside the reason the pass exists, so the two contracts never blur.

### The executing pass

- Runs after every verifier batch, once per review cycle, over the whole change-set as it then stands. Wall clock is not the priority; one dispatch that can take the verifiers' unsettled criteria is.
- Three to five `workflow-review-change-set-verifier` agents in fresh context, split by the specification's numbered sections plus one over the test surface; sections merge when there are more than agents. A quick-fix gets one agent over its scoping document.
- Authority is the specification's intent and the product, never the task's criteria. A spec gap the work introduced is in scope; spreading, it replans and fails the review. A pre-existing defect inside the work's own problem is out of scope and banked. No new routes.
- Execution rules come from the project, never from the workflows: the manifest's declared linters, the project skills, and the project's own conventions for running a package's tests or standing up a disposable dependency. Measure where the project gives a way to, read where it does not. Package-scoped runs only, never the suite — the fix-verifier runs the suite. The tree is clean after the pass; the orchestrator checks and surfaces dirt, never reverts blind.
- Reads no per-task report. Makes no edit. Loads the shared `finding-floor.md` — the three rules every finder clears; the comment-correction shape the implementation's finders report in lives in the code standard, not the floor.
- Writes one file per section, named for the cycle; a crash resumes by dispatching only the cycle's missing sections, and a later cycle measures again rather than reading the previous cycle's files. The tree check after the pass reads everything outside `.workflows/`, where the review's own uncommitted artifacts sit.
- Returns findings in the verifier's format into the same prep pipeline, and a coverage map per section — what it checked and found sound. The report's Specification Compliance section is those maps: a coverage map is the only evidence an empty findings list can offer. What the pass also cannot measure is disclosed under Plan Completion as a named list, never absorbed.

### Lanes

| Lane | What | The user sees |
|---|---|---|
| **Fix now** | Finishable in-session by an agent with full context. Comment/doc/message text; documentation accuracy; identifier renames; **spec violations with a small determinate fix**; defects with an obvious contained fix. Low value is fine — cost to fix is what matters. | count + commit |
| **Consolidation** | Real duplication, wrong as N separate edits. Scheduled as one pass. | one line |
| **Needs design** | More than one defensible shape, or wrong in a way the suite wouldn't catch, or painful to undo | the item |
| **Inbox** | Real bugs, real new features. Never refactors. | the item |
| **Drop** | Taste, unreachable theoretical edges | count only |

`DECIDE` is probably mis-named — of the 9 so routed, most are "needs designing", not "needs the user".

### Prep pipeline v1 result (consolidated agents — under-powered)

Three assessors doing validity+standards+guards each, plus one merge agent.

```
366 raw
 − 28 dropped (5 factually wrong · 22 standards · 1 guard)
 = 338 survive
 → 201 independent + 70 merged groups
 = 271 actions (74% of raw)

coupled        14 groups /  48 findings   ← break the build silently
contradictory   7 groups /  14 findings   ← opposite outcomes
overlap        37 groups /  87 findings   ← same site, competing edits
duplicate      13 groups /  28 findings
                  148 of 366 (40%) entangled
```

**Prep statically caught 2 of the 6 apply failures**, before any edit:

- P144 → `TestOpenExecPath_DoesNoThemeWork` (a new shared helper trips a guard permitting `theme.*` in four named functions)
- P285/P303 → `TestThemingDocExampleThemeIsTheDarkBuiltin` (the doc's example fence is compared line-for-line against the built-in's bytes, comments included)

**Known weakness of v1:** the assessors satisficed. One reported zero guard risks across 122 findings while another found one — not a plausible distribution. Three remits in one agent means it finds the easy textual class, spends its budget verifying, and stops before sweeping.

### Prep pipeline v2 (one remit per agent)

Six agents — validity ×2, standards ×2, guards ×2 — each over half the corpus. Merge output reused from v1 (that agent performed; the miss was on the assess side).

```
VALIDITY   361 valid · 2 wrong · 3 unactionable      (366)
STANDARDS  218 n/a · 124 compliant · 24 violates     (366)
GUARDS     342 none · 22 depends · 2 violates        (366)
```

**The findings are 98.6% accurate.** Only 2 of 366 misread the code, and 3 were unactionable through a truncation bug in the harness that built this corpus, not through any fault of the reviewers. Nothing was `already-done` or `stale`. Whatever the review phase's problem is, it is not detection accuracy — which is the strongest single argument against suppressing at source.

Both validity agents independently reached the same verdict on P316 (the claim that `themeExportCmd` sets neither `SilenceErrors` nor `SilenceUsage` is true of the command literal, but `rootCmd` sets both and cobra suppresses on the root's setting, so the described symptom cannot occur) — a useful consistency check on the remit.

Near-duplication was independently confirmed at nine sites where multiple findings target the same lines with *different* replacement text, including four on the single `theme_seams.go` sentence. None are byte-identical, which is why textual dedup would miss them.

**4 of the 6 apply failures predicted statically, against v1's 2:**

| Failure | Predicted by |
|---|---|
| `TestOpenExecPath_DoesNoThemeWork` | P144 (violates), P394, P454 |
| `TestThemingDocExampleThemeIsTheDarkBuiltin` | P285 (violates), P303 |
| `TestNoPackageLevelThemeVar` | P073, P408 |
| `TestModelAt_ReachesCapturedState` | P248, P339, P425, P475 |
| `TestFallback_MissingBuiltinIsFatal` | — missed |
| `TestCommitFailure_ThemeStaysApplied` | — missed |

Three findings that matter for the build:

**1. The `depends` verdict is what did the work.** v1 offered only none/violates and found 0 depends; v2 found 22. `depends` means *safe only if implemented a particular way* — which is the exact shape of implementation-choice breakage. `TestNoPackageLevelThemeVar` broke because an applier chose a package-scope var; P073 flags precisely that ("the silent loader must stay a call inside `defaultDarkTheme`"). The earlier claim in this document that such breaches are unreachable by static analysis is **false** — they are reachable, but only if the verdict vocabulary allows for them.

**2. Splitting helps where the remit needs upfront investment, not uniformly.**

```
guards      v1: 1 violates,  0 depends   →   v2: 2 violates, 22 depends
standards   v1: 22 violates              →   v2: 24 violates
```

Guards requires building an inventory (~40 invariants, enumerated from the guard tests) before any judgment is possible — a satisficing agent skips that. Standards is a textual judgment against a rule sheet and needs no groundwork, so a consolidated agent does it about as well. **Give guards its own agent; standards can share.**

**3. The pipeline needs an `amend` verdict, not just keep/drop.** Repeatedly, a finding is right while its *prescribed steps* are wrong:

- P207 instructs dropping a now-unused `os` import — `os.ReadFile` on the next line keeps it. Following it **breaks the build**.
- P113/P114 remove a test claim and reintroduce a cardinality one in the replacement wording.
- P411, P440, P455, P305 each keep a genuine warning if the offending clause is dropped.
- P002 claims ~171 occurrences across ~30 files; it is ~87 across 32. P103's "the only place in the tree" is false. P089 says eleven call sites; there are ten. P030's outcome holds but it cites the wrong mechanism.

A keep/drop pipeline either applies bad instructions or discards good findings. Verification must extend past *is this real?* to *are its instructions right?*

Also corrected by v2: **there is no CLAUDE.md-to-code guard in this repo** (`grep CLAUDE *.go` is empty). An earlier assumption to the contrary was carried in the prompts and would have reached the build.

### Methodological limit of every test in this document

None of these runs is a system test. The prep and apply agents were dispatched by a design session in `agentic-workflows`, not by a review orchestrator in Portal mid-phase. They lacked the plan, the spec, the phase context and the review that had just run; a fork of the design session would instead be biased by the hypotheses formed here. So these results measure **component judgment quality in isolation** and nothing more.

A genuine test requires building the pipeline into the workflows, copying it into a Portal clone wound back to `e38cda4a~1` (implementation complete, review unrun), and running the real review phase cold.

---

## Test Projects

Kept temporarily. All pinned to `e38cda4a`, git remotes removed.

| Path | Condition |
|---|---|
| `~/Code/portal` | the real repo — Opus 5, stock prose (control, 488 notes) |
| `~/Code/portal-opus48` | Opus 4.8, stock bar |
| `~/Code/portal-opus5-t1` | Opus 5, bar v1 |
| `~/Code/portal-opus5-t2` | Opus 5, bar v2 |
| `~/Code/portal-opus5-t3` | Opus 5, whole-plan lenses + `SPIKE-t3.md` |
| `~/Code/portal-apply` | the 366-finding sweep, post-apply (6 failures) |

Re-arming a clone for another 10-task run: trim the sample's ids from `reviewed_tasks` in the work-unit manifest and delete their `report-*.md`; the engine's resume gate then offers `c/continue` for exactly those.

---

## Open Questions

- Per-task verification's size once the implementation phase's analysis loop stops generating tasks. In the first live run the machinery phases were 140 of 190 verified tasks and 29 of 35 findings. With that surface gone, whether one verifier per task still earns its dispatch count, or the executing pass carries the plan-phase surface alone, is unmeasured.
- Whether the executing pass should own spec-gap findings' routing beyond today's lanes. A spec gap the work introduced rides the lanes as a code finding; the specification's own correction — whether it is owed, and by whom — is unassigned.
- Whether 0.18 findings per task is the post-change baseline or the recall gap's signature. One run cannot separate the two; the first run with the pass in place can.
- The applier seam rate: the fix-verifier repaired 9 of 27 applied items against 4 of 109 in the cold run. Whether that tracks batch shape or finding shape is unmeasured.
- Whether the assessor's remedy question satisfices inside the validity remit, as guards did in prep v1 before it got its own agent.
- What the executing pass costs against per-task verification. The audit that stood in for it spent ~1.4M tokens over five agents.

---

## The Build (2026-08-14)

Stack #900, seven PRs. The shape that shipped:

```
Step 5  verify      per-task verifiers — a finding names its failure, its scope
                    (delivered change-set, behaviour-level) and blast radius
                    (observability, never file count); nitpicks never reported;
                    comment-only remedies never block
Step 6  prep        assessor (validity+standards) ×N · guards (inventory first,
                    with a depends verdict) ×N · relationships (whole set) ×1
                    → synthesis: verify claims, collapse collisions, route,
                    derive the verdict · out-of-scope banked on the manifest
                    · checkpoint commit (reports + manifest)
Step 7  apply       announce → batched appliers (whole connected file-sets,
                    bundled, sequential, compile-check only) → fix-verifier
                    over the complete uncommitted diff (repairs, normalises,
                    runs the suite, never commits) → one orchestrator commit
Step 8  produce     report written from the outcome, not a proposal
Step 9  present     TITLE chrome · verdict tier (red properties on fail) ·
                    findings display · gate: p/plan | c/complete + i/inbox + Ask
Step 11 actions     pass completes; fail feeds the replan actions (not the raw
                    reports) to the remediation synthesizer
```

Verdict is binary and derived: any `replan` action or blocking issue fails. Resume after a verification crash lands on prep (`reviewed_tasks` + report existence discriminate), never re-verifying. Fresh-context doctrine recorded in every prep agent; the appliers are fresh too — measurability: a forked applier inherits a different context every run, so a bad apply can never be attributed to the design.

## The Cold Run (2026-08-14)

Full-scale live test: Portal clone at the implementation-complete commit, the built workflows installed, review run cold by a real session. Verification was reused from an interrupted earlier run (175 old-contract reports — headers renamed to `FINDINGS:`, judgment content untouched, no legacy handling anywhere in the build), so the run exercised everything downstream of verification; the new verifier contract itself awaits the next real feature.

```
463 findings → discarded 296 (64%) · do-now 109 · replan 1 · out-of-scope 10
verdict FAIL, derived · rescued 21 · amended 15
apply: 109/109, ten bundled batches, verifier repaired 4 batch-seam comment
artefacts, 0 reverts, suite green (independently confirmed)
one screen reaches the user; three engine commits; out-of-scope banked
```

Notable in-flight behaviours: the orchestrator handled the legacy-tag fixture quirk in session judgment (no workflow code), and merged the 66 connected file-sets into 10 batches — codified afterwards as the bundling allowance.

## The Audits

Three fresh hostile auditors over the run's every judgment:

**Discards — 294/296 correct.** Two misses: a vacuous test discarded on a false "stronger neighbour" claim (the neighbour pins a different property), and a real two-snapshot read race filed under "behaviour identical either way".

**Apply — 109/109 executed faithfully.** Every production hunk read; zero execution defects, zero unrequested changes, suite green uncached. Five actions were spreading-shaped by the letter (multi-site renames, a shared helper, a signature change) yet all safe — fully prescribed, compiler-chased. The one genuine risk: a fix no test observes ("the suite settles it" was false for exactly that change).

**Verdict — right outcome, wrong finding.** The single fail-driver's spreading case was inflated (one caller, not four; every "open question" settled by the code) — it was containable. Two in-scope doc gaps were misrouted out-of-scope under spec-text reasoning. Meanwhile the discarded read race genuinely needs a design call. Net: fail-on-one stands, on a different finding. Of the ten out-of-scope calls, eight held — including two my own file-level provenance check had wrongly flagged (the behaviours predate the feature; the spec deliberately chose the no-lock model).

**Five consequential errors in 463 decisions, one root cause: expensive decisions made on claims nobody opened** — a spreading narrative, a neighbour-coverage claim, a "behaviour identical" label, spec-text scope reasoning. Execution was flawless everywhere; only unverified trust failed.

## Post-Run Fixes (all landed same day)

1. **Bundling codified** — a batch is one or more whole sets; safety is the unbending rules (never split a set, sequential), never batch size.
2. **Scope = the delivered change-set, at behaviour level** — what the work introduced or altered, never the spec's table of contents, and never mere file provenance. Divergence doctrine alongside: the code is the source of truth; a deliberate, sound divergence from the written word is not a violation.
3. **A spreading claim is verified before it fails a review** — open the code, count the callers.
4. **Blast radius is observability and prescription, never file count** — a compiler-chased rename is contained across a dozen files; a fix the suite cannot observe is contained only with its covering case.
5. **A discard reason is a verdict, verified like any claim.**
6. **Presentation chrome** — TITLE anchor, verdict tier (red on fail), findings display.

## The First Live Run (2026-09-09)

### The run

Portal, bugfix work unit `resume-hooks-silently-lost`, skills v0.7.32, review session 10:31–16:03 BST. The first review under the new verifier contract — the cold run reused old-contract reports, so this is the layer that had never been exercised.

| Source | Phases | Tasks |
|---|---|---|
| plan | 1–5 | ~50 |
| implementation analysis loop | 6–9 | 25 · 35 · 49 · 52 |
| fix | 10 | 1 |

212 tasks completed, 22 cancelled, 190 verified through 195 verifier dispatches (5 retries after a session rate limit at task 180). Change-set: 796 files, +57,695 / −17,310; 98 production Go files, 369 test files.

**Verification.** 35 findings from 31 reports, none tagged spreading. Density 0.18 per task:

| Era | A | B | C | D | this run |
|---|---|---|---|---|---|
| per task | 1.14 | 1.53 | 0.75 | 2.79 | **0.18** |

| Source | Tasks | Findings | Per task |
|---|---|---|---|
| plan phases 1–5 | 50 | 6 | 0.12 |
| machinery phases 6–10 | 140 | 29 | 0.21 |

**Prep.** Assessor: 35 valid, 4 amendable — about a third cited a line 1–3 off with substance intact. Guards: 0 violates, 5 depends. Relationships: 6 groups over 12 findings.

**Synthesis.** Pass — 27 do-now · 2 out-of-scope · 0 replan · 0 discarded. 2 rescued; 2 out-of-scope calls overturned to in-scope.

**Apply.** 4 sequential appliers, 27/27. The fix-verifier repaired 9 items — two partials, seven insert scars, one false `.golangci.yml` rationale an applier had introduced — and ran both lanes and lint green. One commit: 40 files, +316 / −182.

The user chose complete; the pipeline closed; the release CI passed. The three earlier Portal work units under the previous design each carried two "Review Remediation" cycles; this run created none. Precision was perfect: nothing the review reported was wrong.

### What the audit found

Five independent Opus agents with execution allowed — build, vet, single-package tests, a throwaway tmux server — one per specification area plus one over the test surface, ~1.4M tokens in total, 15–20 minutes each, over the same tree. Seven items, none surfaced by the review:

1. **Duplicate enumeration.** A tmux grouped session or `link-window` lists one pane under two sessions: capture writes two records with one token, restore arms both, the resume hook fires twice, and `hook set` / `hook rm` in either pane act on both. A behaviour defect the work introduced — a regression against the positional key in that corner, reproduced on tmux 3.7c — and a spec gap: the spec never considered enumeration duplication.
2. **An unparseable `hooks.json` reads as empty**, so the next `hook set` writes a one-entry file over every other registration at exit 0. Pre-existing since March, inside the work's own problem (silent hook loss); the work renamed the type on that exact line. Verified live against a built binary.
3. **The phase-10 test-cache fix reads the anchor directory, not the judged closure**, so the guard that keeps harness code out of the production binary is served a cached pass after an import is added under `cmd/`. Proven by experiment. The task's own verifier saw it — "is served exactly the stale cached pass this task exists to remove" — prescribed comment text, and it landed as a doc correction.
4. **The lock re-entrancy source guard** keys on receiver `s` and hand-named methods with no matched-anything check, and forbids `Save` and `Get`, which the work deleted — a rename would have made it pass over nothing. The spec's final corrigendum also names `Save`.
5. **The discard-logger guard** is a substring match on one spelling; CLAUDE.md claims an invariant twenty-plus test constructions falsify.
6. **Doctor and sweep disagree on judgeability** for an empty store; the parity test that exists to pin agreement lacks that case.
7. **Four false claims** in comments and CLAUDE.md.

Two behaviour defects, four weak or vacuous guards, five false claims. All landed as Portal PRs the next day, the two hard ones as inbox captures.

### The diagnosis

Three structural causes, all in the verifier contract:

| | Cause | Evidence |
|---|---|---|
| a | **No execution.** Verifiers may not run anything. | Items 1, 2 and 3 needed a server, a binary or a cache experiment. Six verifiers wrote that a criterion "could not be settled by reading"; the review passed over those criteria. |
| b | **Authority is the task's criteria plus the spec.** A spec gap and a pre-existing defect inside the work's problem belong to no verifier; nothing holds the whole system. | Items 1 and 2. The whole-plan lens had been left an open question after t3. |
| c | **"A finding whose entire remedy is comment text never blocks"** let a verifier choose the comment remedy for a code defect. | Item 3. |

Two execution defects in the run:

- One verifier recorded an acceptance criterion unmet under BLOCKING ISSUES; the orchestrator relabelled it non-blocking; the report said no task was found incomplete. The prose has no arm for a blocking issue with a contained remedy, and the aggregation step equates `STATUS: issues_found` with blocking — a status eleven clean reports also used.
- Coverage (`reviewed_tasks`) is recorded only after every batch, so the rate limit at task 180 of 190 found nothing durable.

One design point earned its place: the whole-diff fix-verifier caught the false rationale an applier introduced.

The report's Specification Compliance section, presented as a holistic assessment, was composed from the per-task reports in about a minute.

### The decisions (2026-09-10)

Detection changes; routing does not. The lanes, the prep pipeline and the derived verdict stand.

- **An executing pass over the whole change-set runs after the verifier batches, once per review cycle.** Wall clock is not the priority; one dispatch that can take the verifiers' unsettled criteria is. Three to five agents (`workflow-review-change-set-verifier`), fresh context, split by the specification's numbered sections plus one over the test surface, sections merged when there are more; a quick-fix gets one agent over its scoping document. Authority is the specification's intent and the product: a spec gap the work introduced is in scope and, when spreading, replans and fails the review; a pre-existing defect inside the work's problem is out of scope and banked. No new routes.
- **Execution rules come from the project, never from the workflows**: the manifest's declared linters, the project skills, and whatever the project's own conventions say about running a package's tests or standing up a disposable dependency. The mandate: measure where the project gives you a way to, read where it does not. Package-scoped runs only, never the suite — the fix-verifier runs the suite. The tree is clean after the pass; the orchestrator checks and surfaces dirt, never reverts blind.
- **The pass reads no per-task report and makes no edit.** It writes one file per section per cycle so a crash resumes by dispatching only the cycle's missing sections and a later cycle measures the remediated change-set afresh, and feeds findings in the verifier's format into the same prep pipeline, where the relationships agent collapses duplicates.
- **A verifier that cannot settle a criterion by reading records it under its own heading**; the orchestrator hands those to the pass as items to measure. What the pass also cannot measure is disclosed in the report under Plan Completion as a named list, never absorbed.
- **Each pass agent returns a coverage map** — what it checked and found sound. The report's Specification Compliance section carries those maps: a coverage map is the only evidence an empty findings list can offer.
- **The assessor gains one question, with the code open**: is a comment remedy a comment remedy because the prose is wrong, or because it was the easy edit? When the remedy changes to code, synthesis re-reads blast radius with the code open — the one case where a verifier's call is not carried through untouched.
- **A blocking issue with a contained remedy routes do-now**, and the report's Corrected in this session section names it as blocking and corrected; a spreading one replans. Aggregation reads the BLOCKING ISSUES section, never `STATUS`. The verdict stays derived.
- **Coverage is pushed after every batch.**
- **The verifier keeps its no-execution rule**, stated explicitly beside the reason the pass exists, so the two contracts never blur.
- **One finding floor.** The shared `finding-floor.md` is the file the pass loads — the three rules every finder clears. Its comment-correction shape, which only the implementation's finders report in, lives in the code standard's Comments section, so loading the floor commits the pass to nothing the review routes differently.
- **Two prose cases** pin the design: the pass dispatched after the batches, the unsettled hand-off measured, findings flowing into prep; and the blocking-with-contained-remedy route.

## Where This Stands

Two live runs. The cold run (2026-08-14) exercised everything downstream of verification over reused reports; the first live run (2026-09-09) exercised the whole pipeline under the new verifier contract. In both, routing held, precision was perfect, apply landed in one commit with the fix-verifier doing the last mile, and no remediation cycle was created. The cold run's two watches closed clean: none of 35 findings was tagged spreading, and synthesis handled the set with no satisficing visible.

Recall is the open gap. An audit with execution found seven items the review could not — two behaviour defects, four vacuous guards, five false claims — and every structural cause sits in the verifier contract: no execution, authority bounded to the task, and a comment remedy the contract let stand for a code defect.

The executing pass is the answer, decided 2026-09-10: `workflow-review-change-set-verifier`, dispatched once after the batches, measuring where the project gives a way to, findings into the same prep. Four holes close with it: the unsettled-criterion hand-off, the blocking-with-contained-remedy route, aggregation by section rather than status, coverage pushed per batch. The floor the pass loads is the shared one, its comment-correction shape moved to the code standard where only the implementation's finders read it. Two prose cases pin the design.

The first run of the pass answers what nothing else can: whether its coverage maps stay honest or drift to boilerplate, what it costs against per-task verification, and whether 0.18 per task was the post-change baseline or the recall gap's signature.
