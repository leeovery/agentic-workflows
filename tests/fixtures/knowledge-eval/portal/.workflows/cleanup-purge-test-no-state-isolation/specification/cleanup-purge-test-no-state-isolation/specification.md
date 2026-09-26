# Specification: Cleanup Purge Test No State Isolation

## Change Description

`TestStateUserFacingSubcommandsExitZero` in `cmd/state_test.go` applies its
`PORTAL_STATE_DIR=t.TempDir()` isolation only when `tt.args[1] == "status"`, so
the `cleanup` and `cleanup --purge` subtests resolve the state directory via the
normal XDG path and run against the developer's real `~/.config/portal/state`.
The `--purge` case then calls `os.RemoveAll` on that directory, causing both an
intermittent failure (when a live daemon is concurrently writing) and the risk of
deleting live persisted state. Lift the temp-dir isolation out of the
subcommand-string conditional so it applies unconditionally to all three subtests.

## Scope

- `cmd/state_test.go` — `TestStateUserFacingSubcommandsExitZero` only (the
  conditional env-isolation block at ~lines 232-234).
- The fix is to make `t.Setenv("PORTAL_STATE_DIR", t.TempDir())` apply to every
  subtest in the table rather than gating it on `tt.args[1] == "status"`.
- In-process test (`rootCmd.Execute()`), so the in-process `t.Setenv` override is
  the correct mechanism — matching the existing `status` pattern.

## Exclusions

- Production code is unchanged — `cmd/state_cleanup.go` (the purge behaviour
  itself) is correct; the defect is purely the test's missing isolation.
- Do **not** adopt `portaltest.IsolateStateForTest` here: that helper is
  subprocess-shaped (returns `env []string` for `cmd.Env`, mutates HOME/XDG) and
  is a misfit for this in-process `rootCmd.Execute()` test. The manifest
  description scopes the fix to `PORTAL_STATE_DIR` isolation.
- Other tests in `cmd/state_test.go` already isolate correctly
  (`TestStateInternalSubcommandsAcceptValidArgv` daemon case) and are out of scope.

## Verification

- `go test ./cmd -run TestStateUserFacingSubcommandsExitZero` passes on a developer
  machine with a live portal install (previously the `--purge` subtest could flake
  with `unlinkat ~/.config/portal/state: directory not empty`).
- No subtest in `TestStateUserFacingSubcommandsExitZero` resolves the state
  directory via the real XDG path — every case sets `PORTAL_STATE_DIR` to a
  per-test `t.TempDir()`.
- `go test ./cmd` passes (no regression in the surrounding table or the shared
  `resetStateCmdFlags`/`resetRootCmd` harness).
