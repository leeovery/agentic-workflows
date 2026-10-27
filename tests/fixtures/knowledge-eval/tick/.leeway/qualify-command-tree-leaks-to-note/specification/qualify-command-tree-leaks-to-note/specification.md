# Specification: Qualify Command Tree Leaks To Note

## Specification

### Bug

`qualifyCommand` in `internal/cli/app.go` unconditionally qualifies `"tree"` as a subcommand of both `"dep"` and `"note"` parents. `"tree"` is only valid under `"dep"`.

**Symptom:** `tick note tree --foo` produces `unknown flag "--foo" for "note tree"`, implying `"note tree"` is a real command. Without flags, `tick note tree` falls through to `handleNote` which correctly errors, but the flag validation path is misleading.

### Root Cause

The `qualifyCommand` switch at `app.go:374-376` groups `"add"`, `"remove"`, `"tree"` in a single case for both `"dep"` and `"note"` parents. `"add"` and `"remove"` are legitimately shared, but `"tree"` is dep-only. No parent-specific guard exists within the case.

### Fix

Split the switch case so `"tree"` only qualifies under `"dep"`:

- The shared `"add", "remove"` case remains for both parents
- `"tree"` gets a separate case guarded by `subcmd == "dep"`
- When `subcmd == "note"` and sub is `"tree"`, `qualifyCommand` should NOT qualify it — return the original command and args unchanged, letting `handleNote` produce the correct error

### Acceptance Criteria

1. `tick note tree --foo` no longer produces a misleading "note tree" error — the error should reference `"note"`, not `"note tree"`
2. `tick note tree` (no flags) continues to produce `"unknown note sub-command 'tree'"`
3. `tick dep tree` behavior is unchanged
4. `tick dep tree --foo` behavior is unchanged (flag validation against `"dep tree"`)
5. Shared subcommands (`add`, `remove`) continue to qualify correctly under both parents

### Tests

- `qualifyCommand("note", ["tree"])` returns `("note", ["tree"])` — tree not qualified under note
- `qualifyCommand("note", ["tree", "--foo"])` returns `("note", ["tree", "--foo"])` — args preserved
- Existing `qualifyCommand("dep", ["tree", ...])` tests remain unchanged
