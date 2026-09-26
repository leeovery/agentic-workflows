# Specification: Migrate Stat Error Handling

## Change Description

The `migrateConfigFile` function in `cmd/config.go` checks whether the target file exists at the new path using `os.Stat(newPath)`. Currently it returns early when `err == nil` (file exists), but falls through to migration for any non-nil error — including permission denied or other non-"not found" failures. The fix is to check `os.IsNotExist(err)` explicitly so that only a confirmed "file not found" triggers migration, while other stat errors cause the function to return early (preserving the best-effort contract by not attempting a move that would likely also fail).

## Scope

- `cmd/config.go`: `migrateConfigFile` function, line 18 — the `os.Stat(newPath)` guard clause
- `cmd/config_test.go`: any existing tests covering this path (verify they still pass; add a test for the refined logic if one doesn't exist)

## Exclusions

- The `os.Stat(oldPath)` check on line 14 is correct as-is (any error means old file isn't accessible, so nothing to migrate)
- No changes to `configFilePath` or `xdgConfigBase`

## Verification

- All existing tests pass after the change
- The guard clause explicitly uses `os.IsNotExist(err)` to decide whether to proceed with migration
- Non-"not found" stat errors on `newPath` cause the function to return early without attempting migration
