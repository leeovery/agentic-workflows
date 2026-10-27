# Specification: Add Version Flag

## Change Description

Add a `--version` global flag to the tick CLI as an alternative entry point to the existing `version` subcommand. Both forms produce identical output (`tick version {Version}\n`). This is a common CLI convention — users reach for `tick --version` instinctively, and the flag offers an alias without removing or altering the subcommand.

## Scope

- `internal/cli/app.go` — extend `globalFlags` with a `version` field, recognise `--version` in `applyGlobalFlag`, and dispatch to the existing version-print branch in `App.Run` before subcommand handling. The existing `Version` variable (set via ldflags) is reused unchanged.
- Test coverage in `internal/cli/` — add a test exercising `tick --version` and confirming output matches `tick version`.

## Exclusions

- No changes to the `version` subcommand — stays as-is.
- No changes to how the `Version` value is sourced (ldflags injection unchanged).
- No short alias (`-V` or similar) added; only the long form `--version`.
- No precedence rules with other global flags beyond what the existing parser already provides — `--version` mirrors how `--help` is handled (early dispatch in `Run`).

## Verification

- All existing tests pass after the change (`go test ./...`).
- New test confirms `tick --version` produces output identical to `tick version`.
- Manual: `go build -o tick ./cmd/tick && ./tick --version` prints `tick version dev`.
- `gofmt -w` and `go vet ./...` clean.
