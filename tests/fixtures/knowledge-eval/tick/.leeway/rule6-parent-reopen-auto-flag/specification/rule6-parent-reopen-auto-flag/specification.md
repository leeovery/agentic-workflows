# Specification: Rule6 Parent Reopen Auto Flag

## Specification

### Problem

`ApplyWithCascades` in `internal/task/apply_cascades.go` hardcodes `Auto: false` on the primary target's `TransitionRecord`. This is correct for user-initiated transitions (`RunTransition`), but incorrect for two system-initiated callers:

1. **`validateAndReopenParent`** (`internal/cli/helpers.go`) — Rule 6: reopens a done parent when a child is added. Records the parent reopen as `auto=false` (should be `auto=true`).
2. **`evaluateRule3`** (`internal/cli/update.go`) — Rule 3 via reparent: auto-completes a parent when remaining children are all terminal after reparenting a child away. Records the parent completion as `auto=false` (should be `auto=true`).

Cascade transitions (children of the primary target) are already correctly recorded as `auto=true`. Only the primary target's record is wrong.

### Fix

Add an `auto bool` parameter to `ApplyWithCascades` and make it unexported (`applyWithCascades`). Expose two semantic wrappers:

- **`ApplyUserTransition(tasks []Task, target *Task, action string)`** — wraps with `auto=false`. For user-initiated commands.
- **`ApplySystemTransition(tasks []Task, target *Task, action string)`** — wraps with `auto=true`. For system-initiated side effects.

The cascade engine logic is unchanged — same state machine, same cascade queue, same cascade recording. The only difference is the `Auto` field on the primary target's `TransitionRecord`.

Update the doc comment on `applyWithCascades` to reflect the parameterized `auto` behavior. Add doc comments to `ApplyUserTransition` and `ApplySystemTransition` documenting their intent.

### Call Site Updates

| Caller | File | Change |
|--------|------|--------|
| `RunTransition` | `internal/cli/transition.go` | `ApplyWithCascades` → `ApplyUserTransition` |
| `validateAndReopenParent` | `internal/cli/helpers.go` | `ApplyWithCascades` → `ApplySystemTransition` |
| `evaluateRule3` | `internal/cli/update.go` | `ApplyWithCascades` → `ApplySystemTransition` |

Rename `evaluateRule3` to `autoCompleteParentIfTerminal` (unexported, single call site).

### Testing

- Migrate existing `ApplyWithCascades` unit tests to call `ApplyUserTransition`. All 13 existing subtests exercise user-initiated scenarios (direct transition on the primary target); none test the `validateAndReopenParent` or `evaluateRule3` code paths. No assertion changes needed — `Auto: false` on the primary is correct for user-initiated transitions.
- Add unit test: `ApplySystemTransition` records `auto=true` on primary target
- Add unit test: `ApplyUserTransition` records `auto=false` on primary target
- Add integration test: `create --parent <done-parent>` produces `auto=true` on parent reopen (Rule 6)
- Add integration test: `update --parent` reparent triggers auto-completion with `auto=true` (Rule 3)

Integration tests verify the `auto` flag by reading the JSONL file directly and inspecting the last `TransitionRecord` on the affected task. This avoids coupling to CLI output format and tests the source of truth.

### Dependencies

None. All affected code (`ApplyWithCascades`, `validateAndReopenParent`, `evaluateRule3`, `RunTransition`) already exists in the codebase. No external systems or prerequisites required.
