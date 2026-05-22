# Review Finding Grouping

## The Idea

Group related non-blocking notes into themed clusters before they reach the user. Today the review report lists every note 1:1, so the user sees 30+ numbered items when really there are 8-10 themes. Surfacing them to the inbox produces one file per note, which then has to be manually re-bundled.

## Context

The flow is:

1. Per-task verifier writes `report-N-M.md` with non-blocking notes, tagged `[quickfix]`/`[idea]`/`[bug]`.
2. `produce-review.md` reads all task reports, groups by tag, writes `### Quick-fixes` / `### Ideas` / `### Bugs` to `report.md`. Items are numbered sequentially across sections.
3. `present-review.md` shows the numbered list and offers `s`/`surface` to push to inbox. Each selected number becomes one inbox file.

Grouping happens only in `workflow-review-findings-synthesizer` (for in-plan tasks). The synthesiser does dedupe + cluster but its output goes to the plan, not the inbox. Inbox surfacing reads `report.md` directly and is therefore ungrouped.

## Observed Pattern

From the portal `killed-sessions-resurrect-on-restart` review:

- Recs 14, 15, 16, 25 — all `cmd/state_hydrate_test.go` micro-refactors → user bundled into one inbox file `cmd-hydrate-test-refactors.md`.
- Recs 5, 6, 13 — all cmd-layer soft-fail test gaps → user bundled into `cmd-layer-soft-fail-test-gaps.md`.
- Recs 11, 12 — both AC4 test hardening → user bundled into `ac4-test-hardening.md`.

The user manually clustered ~10 raw recommendations into ~3 inbox files. The signal is there in the report (same file, same theme) — it's just not being collapsed.

## What I'd Change

Two possible insertion points; pick one.

### Option A — Group in `produce-review.md` (recommended)

`skills/workflow-review-process/references/produce-review.md` is where notes from all task reports get merged into the final report. Add a clustering pass here.

Clustering signal:

- **Same file** — multiple notes naming the same path → likely one cluster (`foo_test.go` × 4 → "tighten foo_test.go scaffolding")
- **Same theme keyword** — "test gap", "doc staleness", "marker handling", "logger interface" → cluster across files
- **Same source task report** — multiple notes from `report-2-1` about the same module → cluster

Output format: each cluster becomes one numbered item with sub-bullets for each constituent note. Example:

```
### Ideas

4. cmd/state_hydrate_test.go — tighten test scaffolding
   - EISDIR-via-mkdir fixture recurs at lines 1517-1521 and 1576-1580; extract `seedUnreadableHookStore` helper
   - Lines 1504 and 1565 are near-identical except for `OpenFIFO` seam; table-driven would express the invariant
   - Lower-bound timing test (line 1050) and handler-level test (line 1212) could be co-located as `TestHydrate_Timeout_SleepOwnership`
   - Optional `makeAndSignalFIFO(t, dir)` companion helper would extend cleanup further
```

Surfacing one cluster produces one inbox file with the cluster body as its content. The user gets the bundling for free.

### Option B — Multi-select grouping at surface time

Extend `present-review.md` so the user can select multiple recommendations and surface them as one combined inbox file. Example:

```
Which recommendations? (enter numbers, comma-separated, or a/all)
Group selected into one inbox file? (y/n)
```

If `y`, Claude generates a combined title and concatenates the bodies under one file.

This preserves the raw report but adds a bundling affordance at surface time.

## Recommendation

**Option A** is the better fix because it addresses the root cause — the report itself is unclustered, so anyone reading it (not just the surface flow) sees the noise. Option B is a UX patch on top of an unclustered source of truth.

Option A also amplifies the value of [[review-classifier-quality]]: better tags + clustering together produce the most legible review report.

## Open Questions

- **Should clustering happen at the verifier level or at produce-review?** Verifier-level keeps individual task reports trustworthy as a source of truth; produce-review-level is one place to change and easier to audit. Probably produce-review.
- **How aggressive should clustering be?** Same-file is a clear signal. Same-theme is fuzzier — needs judgment. Worth tuning by running it against the three portal reviews and checking the result.
- **Should clusters preserve the original numbered references?** Yes — the constituent notes should carry their `(Report N-M)` source tags so traceability survives.
- **What about quick-fixes specifically?** Quick-fixes are by definition small and discrete — clustering them might just hide the granularity. Maybe only cluster `[idea]` items. Or only cluster when count > N in a single file.

## Relevant Files

- `skills/workflow-review-process/references/produce-review.md` — primary edit site for Option A
- `skills/workflow-review-process/references/present-review.md:151-194` — surface mechanism; Option B would touch here
- `agents/workflow-review-findings-synthesizer.md:27` — existing dedupe/cluster logic for in-plan tasks; useful reference for clustering heuristics

## Implementation Notes

- Pair this with [[review-classifier-quality]] for compounded effect. Order: classifier first (cheaper), then grouping.
- The verifier already groups its own task's notes by category. Cross-task clustering is the new behaviour.
- Don't cluster across categories — a `[quickfix]` and an `[idea]` about the same file are still semantically different; keep them separate even when they share a target.
- The clustering pass needs file content access (already has it — `produce-review.md` reads all `report-*.md` files).
- A clustered item that the user surfaces should write a file with all sub-bullets in the body, plus the source list ("Sources: Report 1-3, 2-1, 3-4") as a footer. This matches what the user manually does today.
