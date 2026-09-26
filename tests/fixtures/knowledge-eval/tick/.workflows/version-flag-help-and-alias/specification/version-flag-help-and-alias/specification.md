# Specification: Version Flag Help And Alias

## Change Description

Two co-located follow-ups to the existing `--version` global flag (from the
`add-version-flag` work unit, which deliberately deferred both). First, surface
`--version` in the `tick --help` output — its global-flags listing currently
omits both `--version` and `--help` itself, so neither is discoverable from the
top-level help. Second, add a `-V` short alias for `--version`, matching the
common CLI convention (`-V` for version, mirroring `-h` for help). Both are
small, mechanical additions in two functions; no behaviour of the flag itself
changes beyond accepting the new alias.

## Scope

- **`internal/cli/help.go`**
  - `printTopLevelHelp` (global-flags block, ~lines 257–262): add `--help, -h`
    and `--version, -V` entries to the listing. Render aliases inline using the
    existing `--quiet, -q` style. Place `--help, -h` and `--version, -V` so the
    listing reads naturally (e.g. `--help` first, `--version` last).
  - `printAllHelp` (inline global-flags line, ~line 271): add `--version/-V` to
    the `Global flags: --help/-h --quiet/-q ...` line (this line already lists
    `--help/-h`; only `--version/-V` is missing).
- **`internal/cli/app.go`**
  - `applyGlobalFlag` (~line 418): extend `case "--version":` to
    `case "--version", "-V":` so the short alias sets `flags.version`. No other
    change — dispatch in `App.Run` already handles `flags.version`.
- **Test coverage in `internal/cli/`**
  - Add a test exercising `tick -V` and confirming output matches `tick version`
    / `tick --version` (identical `tick version {Version}\n`).
  - Add/extend a help-output test asserting `tick --help` lists `--version` (and
    `--help`) in its global flags.

## Exclusions

- No change to the `version` subcommand or to how `Version` is sourced (ldflags
  injection unchanged).
- No change to flag precedence or dispatch order — `-V` reuses the existing
  `flags.version` early-dispatch path unchanged.
- No new help flag behaviour beyond listing the already-existing flags; `--help`
  matching already works, only its absence from the listing is fixed.

## Verification

- All existing tests pass (`go test ./...`).
- New test confirms `tick -V` produces output identical to `tick version`.
- New/updated test confirms `tick --help` output includes `--version` and
  `--help` in the global-flags section.
- Manual: `go build -o tick ./cmd/tick && ./tick -V` prints `tick version dev`;
  `./tick --help` lists both flags.
- `gofmt -w` and `go vet ./...` clean.
