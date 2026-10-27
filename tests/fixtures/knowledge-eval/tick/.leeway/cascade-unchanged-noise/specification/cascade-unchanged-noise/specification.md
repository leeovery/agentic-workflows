# Specification: Cascade Unchanged Noise

## Specification

### Problem

Cascade transitions produce "(unchanged)" lines for sibling and descendant tasks already in a terminal state. These lines carry no actionable information and create visual noise that scales with hierarchy depth.

Example output today:

```
$ tick done tick-b15fda
tick-b15fda: in_progress → done
tick-c5a1ff: in_progress → done (auto)
tick-18747f: in_progress → done (auto)
tick-fd039e: done (unchanged)
tick-c3e72b: done (unchanged)
tick-3d9a7e: done (unchanged)
```

Expected output after fix:

```
$ tick done tick-b15fda
tick-b15fda: in_progress → done
tick-c5a1ff: in_progress → done (auto)
tick-18747f: in_progress → done (auto)
```

### Root Cause

`buildCascadeResult()` in `internal/cli/transition.go` (lines 117–135) deliberately walks descendants of involved tasks and collects terminal ones not part of the cascade into a `CascadeResult.Unchanged` slice. All three formatters then render these entries. This is intentional code — not a logic bug — but the design decision produces noise that outweighs any transparency benefit.

### Fix

Remove the unchanged feature entirely. No flags, no conditional logic — clean deletion.

1. **`internal/cli/transition.go`** — Remove the `involvedIDs` map (lines 110–115) and the unchanged collection loop (lines 117–135) in `buildCascadeResult()` — the map exists solely to support the loop and becomes dead code without it
2. **`internal/cli/format.go`** — Remove `UnchangedEntry` type and `Unchanged` field from `CascadeResult`
3. **`internal/cli/toon_formatter.go`** — Remove unchanged rendering
4. **`internal/cli/pretty_formatter.go`** — Remove unchanged tree rendering
5. **`internal/cli/json_formatter.go`** — Remove unchanged array from JSON output
6. **`internal/cli/cascade_formatter_test.go`** — Remove/update tests referencing `Unchanged`/`UnchangedEntry`
7. **`internal/cli/format_test.go`** — Remove `Unchanged` fields from test constructions
8. **`internal/cli/transition_test.go`** — Remove/rewrite unchanged integration test

### Testing

Affected test files and required changes:

- **`internal/cli/cascade_formatter_test.go`** — Remove subtests that assert unchanged collection ("it collects unchanged terminal descendants recursively", "it populates ParentID on unchanged entries for direct children"). Remove `Unchanged` fields from `CascadeResult` construction in remaining test cases and remove assertions on unchanged rendering (~8 additional cases including "it renders mixed cascaded and unchanged children", "it renders unchanged terminal grandchildren in tree", JSON unchanged array assertions, "all formatters handle both empty cascaded and unchanged").
- **`internal/cli/transition_test.go`** — Remove or rewrite "it includes unchanged terminal children in cascade output" integration test. This can become the negative-case test confirming terminal siblings are NOT included in cascade output.
- **`internal/cli/format_test.go`** — Update `TestCascadeResultStruct` and `FormatCascadeTransition` tests that construct `CascadeResult` with `Unchanged` fields — remove those fields and related assertions.
- **`internal/cli/helpers_test.go`** — Uses `buildCascadeResult` but does not assert on `Unchanged` directly; should compile cleanly after type changes with no modifications needed.

Additional:
- Add a test confirming terminal siblings are NOT included in cascade output
- Verify all remaining cascade tests pass

### Constraints

- No backwards compatibility concerns (pre-v1 tool)
- No new behavior introduced — pure deletion
- State/cascade logic is untouched; only output construction and rendering change

---

## Working Notes

[Optional - capture in-progress discussion if needed]
