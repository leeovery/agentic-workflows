# Investigation: Config Dir Wrong Path Macos

## Symptoms

### Problem Description

**Expected behavior:**
Config files (projects.json, aliases, hooks.json) should be stored at `~/.config/portal/` following XDG conventions, as documented in the specification, README, and CLAUDE.md.

**Actual behavior:**
On macOS, `os.UserConfigDir()` returns `~/Library/Application Support` instead of `~/.config`, so config files are silently written to `~/Library/Application Support/portal/`.

### Manifestation

- Config files appear at `~/Library/Application Support/portal/` instead of `~/.config/portal/`
- Users/tooling checking `~/.config/portal/` find nothing
- No error messages — the bug is silent
- All functionality works correctly at the wrong path

### Reproduction Steps

1. Run Portal on macOS (any command that reads/writes config)
2. Check `~/.config/portal/` — directory does not exist
3. Check `~/Library/Application Support/portal/` — config files are there

**Reproducibility:** Always (on macOS)

### Environment

- **Affected environments:** macOS only (Linux works correctly)
- **Platform:** macOS — `os.UserConfigDir()` returns `~/Library/Application Support`
- **User conditions:** All macOS users

### Impact

- **Severity:** Medium
- **Scope:** All macOS users
- **Business impact:** Documentation/tooling mismatch; real user data exists at the wrong path requiring migration

### References

- `cmd/config.go` — `configFilePath` function using `os.UserConfigDir()`
- `cmd/config_test.go`
- Specification at `.workflows/v1/specification/portal/specification.md`
- `README.md`

---

## Analysis

### Initial Hypotheses

`os.UserConfigDir()` follows platform conventions — on macOS that's `~/Library/Application Support`, not `~/.config`. The project intends XDG-style paths on all platforms.

### Code Trace

**Entry point:** `cmd/config.go:12` — `configFilePath(envVar, filename string)`

**Execution path:**
1. `cmd/config.go:13` — checks env var override first (e.g. `PORTAL_PROJECTS_FILE`)
2. `cmd/config.go:17` — falls back to `os.UserConfigDir()` which returns `~/Library/Application Support` on macOS
3. `cmd/config.go:22` — joins with `portal/<filename>`

**Three callers, all in `cmd` package:**
- `cmd/alias.go:102` — `configFilePath("PORTAL_ALIASES_FILE", "aliases")`
- `cmd/clean.go:113` — `configFilePath("PORTAL_PROJECTS_FILE", "projects.json")`
- `cmd/hooks.go:130` — `configFilePath("PORTAL_HOOKS_FILE", "hooks.json")`

**Key files involved:**
- `cmd/config.go` — the single function that determines the base config directory
- `cmd/config_test.go` — tests use `os.UserConfigDir()` itself as the expected value, so they pass on macOS (wrong path but consistent)

**Env var overrides** (`PORTAL_PROJECTS_FILE`, `PORTAL_ALIASES_FILE`, `PORTAL_HOOKS_FILE`) are used exclusively in tests to redirect config to temp dirs. They take precedence over `configFilePath`'s directory logic, so they are unaffected by this bug.

### Root Cause

`configFilePath` uses `os.UserConfigDir()` as the base directory. On macOS, Go's `os.UserConfigDir()` returns `~/Library/Application Support` (the Apple-native path), not `~/.config` (the XDG path). The project's documented convention is `~/.config/portal/`.

**Why this happens:** Go's stdlib follows platform conventions. The project chose XDG conventions cross-platform but used a platform-aware stdlib function.

### Contributing Factors

- Go's `os.UserConfigDir()` is the "correct" stdlib call for platform-native config, but the project wants XDG-style paths
- No `XDG_CONFIG_HOME` handling exists anywhere in the codebase
- The function works correctly — it just resolves to the wrong directory for this project's conventions

### Why It Wasn't Caught

- `cmd/config_test.go` tests compare against `os.UserConfigDir()` — the same function that's wrong. Tests pass because they verify consistency with the stdlib, not against the documented path.
- The bug is silent — all config operations succeed at the wrong path
- Development and testing happen on macOS where the bug is always present, so the "wrong" path became normal

### Blast Radius

**Directly affected:**
- `cmd/config.go` — needs to hardcode `~/.config` instead of using `os.UserConfigDir()`
- `cmd/config_test.go` — tests need to verify against `~/.config`, not `os.UserConfigDir()`
- All three config files: `projects.json`, `aliases`, `hooks.json`

**Documentation references (say `~/.config/portal/` correctly, but code disagrees):**
- `CLAUDE.md` — three references
- `README.md` — config section
- Specification at `.workflows/v1/specification/portal/specification.md`

**Migration concern:**
- Existing macOS users have real data at `~/Library/Application Support/portal/`
- Fix must migrate files from old path to new path on first run

---

## Fix Direction

### Chosen Approach

Replace `os.UserConfigDir()` with XDG-compliant logic: check `XDG_CONFIG_HOME` first, fall back to `~/.config`. Add a one-shot migration that moves files from `~/Library/Application Support/portal/` to `~/.config/portal/` on macOS.

**Deciding factor:** Fixes macOS while preserving Linux `XDG_CONFIG_HOME` support. Avoids regressing existing Linux users who have a custom `XDG_CONFIG_HOME`.

### Options Explored

**Option A: Hardcode `~/.config` via `os.UserHomeDir()` + `/.config`**
Simple, matches docs. However, would regress Linux behavior — `os.UserConfigDir()` currently respects `XDG_CONFIG_HOME` on Linux. Not recommended.

**Option B: Check `XDG_CONFIG_HOME` first, fall back to `~/.config`** (recommended)
Fixes macOS, preserves Linux `XDG_CONFIG_HOME` support. Slightly more code but avoids a regression.

**Option C: Keep `os.UserConfigDir()` on macOS, update docs**
Would mean accepting Apple-native paths. Rejected — the project has explicitly chosen XDG conventions and users/tooling expect `~/.config/portal/`.

### Discussion

Straightforward bug with a clear fix. Synthesis validation caught two important gaps: env var overrides are user-facing (not test-only), and the naive fix would regress Linux XDG_CONFIG_HOME support. Option B (check XDG_CONFIG_HOME, fall back to ~/.config) was agreed as the right approach. Migration on macOS is necessary since real user data exists at the old path.

### Testing Recommendations

- Test `configFilePath` returns `~/.config/portal/<file>` (not `os.UserConfigDir()`)
- Test migration moves files from old macOS path to new path
- Test migration is a no-op when files already at correct path
- Test migration handles partial state (some files at old path, some at new)
- Test env var overrides still take precedence over both old and new paths

### Risk Assessment

- **Fix complexity:** Low — single function change + migration logic
- **Regression risk:** Low — migration preserves existing data; env var overrides bypass the changed code entirely
- **Recommended approach:** Regular release

---

## Notes

- The env var overrides (`PORTAL_PROJECTS_FILE`, etc.) are documented as user-facing in the README, not test-only. They bypass the config directory logic entirely and are unaffected by this fix.
- On Linux, `os.UserConfigDir()` already respects `XDG_CONFIG_HOME`. A naive fix that hardcodes `~/.config` would regress this. The fix should check `XDG_CONFIG_HOME` first, then fall back to `~/.config` — this preserves Linux behavior and fixes macOS.
