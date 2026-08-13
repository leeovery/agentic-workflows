# Review Phase: Findings Pipeline

**Status:** in design, actively being tested. Nothing here has shipped.
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
findings
 → prep (split agents, ONE remit each, parallel, read-only)
     validity · standards · guards · duplication · overlap/coupling · contradiction
 → synthesis        merge into coherent actions, dedupe the pipeline's own findings
 → review pass      over the synthesis, not the raw findings
 → review doc       updated additively — originals struck, not deleted
 → lanes            assigned from the merged actions
 → apply            a few forked-context agents (inherit orchestrator context)
 → self-review      each checks its own work
 → orchestrator     reviews the whole, fixes what it catches
```

Synthesis before the review pass: reviewing raw findings repeats the prep agents' work, whereas reviewing merged actions catches the dangerous class — a bad merge silently discarding one of several competing intents.

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
VALIDITY   179 valid · 1 wrong · 3 unactionable      (183 of 366 sampled)
STANDARDS  218 n/a · 124 compliant · 24 violates     (366)
GUARDS     342 none · 22 depends · 2 violates        (366)
```

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

- Does a properly split prep pipeline plus sequential/forked apply get the failure count to zero, or only reduce it? Guard breaches arising from *implementation choice* (the package-scope var) may be unreachable by any static pass.
- Is the forked-context applier materially better than a briefed one? Untested.
- Does the bar earn its place at all once lanes exist? Current view: demote to a classifier, keep the materiality language, drop it as a filter.
- Does the whole-plan lens pass become a permanent addition? It found one thing 175 verifiers structurally could not.
- How much of this corpus's volume is an artefact of the comment-standard split, and what does a post-change feature look like?
- Should the analysis cycles survive if the end-of-phase pass lands?
