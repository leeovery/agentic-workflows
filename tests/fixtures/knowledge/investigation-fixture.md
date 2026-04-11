# Investigation: Cascade Unchanged Noise

## Symptoms

### Problem Description

**Expected behavior:**
When a status transition triggers cascades, only the primary transition and genuinely cascaded changes appear in the output.

**Actual behavior:**
Output includes "(unchanged)" lines for sibling and descendant tasks that were already in a terminal state and didn't actually change. These add visual noise that makes it harder to see what actually happened.

### Manifestation

Noisy CLI output. Example:

```
$ tick done tick-b15fda
tick-b15fda: in_progress → done
tick-c5a1ff: in_progress → done (auto)
tick-18747f: in_progress → done (auto)
tick-fd039e: done (unchanged)
tick-c3e72b: done (unchanged)
tick-3d9a7e: done (unchanged)
```

The last three lines report nothing meaningful — those tasks were already done before the command ran. In projects with deeper hierarchies, unchanged lines can outnumber real transitions.

### Reproduction Steps

1. Create a parent task with multiple children
2. Complete some children individually
3. Complete the last remaining non-terminal child
4. Observe output includes "(unchanged)" entries for already-completed siblings

**Reproducibility:** Always

### Impact

- **Severity:** Low
- **Scope:** All users performing cascade transitions
- **Business impact:** Output clarity — no data correctness issue

### References

- Initial report identifies `buildCascadeResult` in `internal/cli/transition.go` as the source
- `CascadeResult` type in `internal/cli/format.go` carries `Unchanged []UnchangedEntry`
- All three formatter implementations render unchanged entries

---

## Analysis

### Initial Hypotheses

The `buildCascadeResult` function actively collects terminal descendants that weren't part of the cascade and populates them into the `Unchanged` slice. The formatters then dutifully render these entries. The fix likely involves either not collecting unchanged tasks, or not rendering them.

### Code Trace

**Entry point:**
`internal/cli/transition.go:14` — `RunTransition()` handles `start`, `done`, `cancel`, `reopen` commands.

**Execution path:**
1. `transition.go:37` — `sm.ApplyUserTransition()` returns `result` + `cascades`
2. `transition.go:42-44` — If cascades exist, calls `buildCascadeResult(id, title, result, cascades, tasks)`
3. `transition.go:66-138` — `buildCascadeResult()` constructs `CascadeResult`:
   - Lines 92-108: Builds `Cascaded` entries from actual cascade changes
   - Lines 110-115: Builds `involvedIDs` set (primary + all cascaded tasks)
   - **Lines 117-135: THE BUG** — Iterates ALL tasks, finds children of involved tasks that are terminal (done/cancelled) and not in the cascade set, adds them to `cr.Unchanged`
4. `helpers.go:102-108` — `outputTransitionOrCascade()` routes to `FormatCascadeTransition()`
5. Each formatter renders unchanged entries:
   - `toon_formatter.go:154-156` — `{id}: {status} (unchanged)`
   - `pretty_formatter.go:224-231` — Tree node with `(unchanged)` label
   - `json_formatter.go:304-310` — `unchanged` array in JSON output

**Key files involved:**
- `internal/cli/transition.go` — `buildCascadeResult()` actively collects unchanged entries
- `internal/cli/format.go` — `CascadeResult.Unchanged []UnchangedEntry` and `UnchangedEntry` type
- `internal/cli/toon_formatter.go` — Renders unchanged lines
- `internal/cli/pretty_formatter.go` — Renders unchanged in tree
- `internal/cli/json_formatter.go` — Renders unchanged array
- `internal/cli/cascade_formatter_test.go` — Tests validate unchanged rendering
- `internal/cli/helpers_test.go` — Tests `outputTransitionOrCascade`

### Root Cause

The unchanged collection is **intentional code, not a bug in logic**. Lines 117-135 of `buildCascadeResult()` deliberately walk descendants of involved tasks and collect terminal ones that weren't cascaded. This was a design decision — the feature was built to show what *didn't* change alongside what did.

The problem is that this design decision produces noisy output. The unchanged entries carry no actionable information — if a task didn't change, there's nothing the user needs to know or act on.

### Contributing Factors

- The `Unchanged` field and `UnchangedEntry` type are baked into the `CascadeResult` struct, meaning all formatters must handle them
- Tests actively validate unchanged collection and rendering, reinforcing the behavior as "correct"
- The feature was likely added for completeness/transparency, but in practice the noise outweighs the signal

### Why It Wasn't Caught

This isn't a regression — it's original behavior that proves problematic at scale. Small hierarchies (1-2 unchanged) are tolerable; the issue becomes apparent with deeper trees where unchanged entries outnumber real transitions.

### Blast Radius

**Directly affected:**
- `internal/cli/transition.go` — `buildCascadeResult()` unchanged collection loop
- `internal/cli/format.go` — `CascadeResult` struct, `UnchangedEntry` type
- `internal/cli/toon_formatter.go` — Unchanged rendering
- `internal/cli/pretty_formatter.go` — Unchanged tree rendering
- `internal/cli/json_formatter.go` — Unchanged JSON rendering
- `internal/cli/cascade_formatter_test.go` — Tests asserting unchanged behavior
- `internal/cli/helpers_test.go` — Related integration tests

**Potentially affected:**
- Any external consumers parsing JSON output that depend on the `unchanged` array (unlikely but possible)

---

## Fix Direction

### Chosen Approach

Remove the unchanged collection and rendering entirely. Clean deletion of the feature — no new behavior, no flags, no conditional logic.

1. Remove the unchanged collection loop in `buildCascadeResult()` (lines 117-135)
2. Remove `UnchangedEntry` type and `Unchanged` field from `CascadeResult`
3. Remove unchanged rendering from all three formatters
4. Update tests to remove unchanged assertions

**Deciding factor:** Unchanged entries carry no actionable information. If a task didn't change, there's nothing to report.

### Options Explored

Only one approach considered — full removal. Alternatives like verbose-flag gating or keeping the JSON array for backwards compat were discussed and dismissed. No backwards compat needed for a v0 tool.

### Discussion

Straightforward fix. User confirmed no backwards compatibility concerns. The unchanged feature was well-intentioned but adds noise that scales with hierarchy depth.

### Testing Recommendations

- Update `TestBuildCascadeResult` — remove "it collects unchanged terminal descendants recursively" and "it populates ParentID on unchanged entries for direct children" subtests
- Update formatter cascade tests — remove `Unchanged` fields from test inputs, remove assertions on unchanged rendering
- Verify remaining cascade tests still pass with unchanged removal
- Add a test confirming that terminal siblings are NOT included in cascade output

### Risk Assessment

- **Fix complexity:** Low — pure deletion
- **Regression risk:** Low — removing output, not changing state logic
- **Recommended approach:** Regular release
