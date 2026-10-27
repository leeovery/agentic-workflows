# Specification: Clean Test Isolation Hooks File

## Change Description

The older project-only clean tests in `cmd/clean_test.go` do not set the `PORTAL_HOOKS_FILE` environment variable. If a developer has a real `~/.config/portal/hooks.json` on disk, those tests could interact with it. Adding `t.Setenv("PORTAL_HOOKS_FILE", filepath.Join(t.TempDir(), "hooks.json"))` to these tests closes the isolation gap, matching the pattern already used by the newer hook-specific tests.

## Scope

- File: `cmd/clean_test.go`
- Affected test functions (7 — those that set `PORTAL_PROJECTS_FILE` but not `PORTAL_HOOKS_FILE`):
  - "removes stale project and prints removal message" (line 12)
  - "keeps project with existing directory and produces no output for it" (line 49)
  - "keeps project with permission error" (line 85)
  - "no stale projects produces no output" (line 134)
  - "all projects stale removes all and prints each" (line 165)
  - "multiple stale projects each printed" (line 209)
  - "exit code 0 in all cases" (line 258)

## Exclusions

- Hook-specific clean tests (lines 276+) — already set `PORTAL_HOOKS_FILE`
- Test helpers (`writeCleanHooksJSON`, `readCleanHooksJSON`, `mockCleanPaneLister`) — unchanged

## Verification

- All existing tests pass after the change (`go test ./cmd -run TestCleanCommand`)
- Every subtest within `TestCleanCommand` sets `PORTAL_HOOKS_FILE`
