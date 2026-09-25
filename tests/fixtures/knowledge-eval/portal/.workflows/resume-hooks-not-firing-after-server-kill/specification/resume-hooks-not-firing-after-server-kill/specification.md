# Specification: Resume Hooks Not Firing After Server Kill

## Specification

### Bug: Server Exits Before Session Restoration

**Root Cause:** Portal's `StartServer()` (`internal/tmux/tmux.go:125-131`) runs `tmux start-server`, which creates a sessionless server. tmux's default `exit-empty on` causes the server to self-terminate when no sessions exist. tmux-continuum's session restore is async with a 1-second delay (`sleep 1` in `continuum_restore.sh`), so the server dies before restoration can occur.

**Failure Sequence:**
1. `EnsureServer()` calls `tmux start-server` — server starts, sources `.tmux.conf`
2. TPM initializes plugins including tmux-continuum
3. Continuum backgrounds `continuum_restore.sh` which sleeps 1 second before calling resurrect
4. `start-server` client disconnects — server sees zero sessions, `exit-empty` triggers server exit
5. Continuum wakes after 1s, tries to restore — server is dead, restore fails silently
6. Portal's TUI polls `ListSessions()` which returns empty (swallows errors from dead server)
7. After 6s max-wait, TUI transitions to projects page — no sessions restored, no hooks fire

### Fix

Replace `tmux start-server` with `tmux new-session -d` in `StartServer()`. This creates a detached bootstrap session that keeps the server alive during plugin initialization and continuum's delayed restore.

**Session naming:** Use bare `tmux new-session -d` with no explicit session name. tmux defaults to session name "0". Resurrect's "restoring from scratch" logic detects exactly 1 pane and cleans up session "0" if it wasn't in the save file — a custom name would not be recognized by this cleanup.

**Scope:** `internal/tmux/tmux.go` — `StartServer()` function only. No changes to hooks, TUI, polling, or any other component.

**Precedent:** This is the same pattern tmux-continuum uses in its own systemd/launchd bootstrap. Resurrect has built-in "restoring from scratch" handling — when it detects exactly 1 pane, it replaces the bootstrap session with saved state and cleans up the default session "0" if it wasn't in the save file.

### Behavior After Fix

| Scenario | Expected Behavior |
|----------|-------------------|
| Server killed, resurrect installed + has save | Bootstrap session created → continuum restores saved sessions → resurrect replaces bootstrap session → Portal shows restored sessions → hooks fire |
| Server killed, resurrect installed, no save | Bootstrap session "0" persists → Portal shows sessions page with one session |
| Server killed, resurrect NOT installed | Bootstrap session "0" persists → Portal shows sessions page with one session |
| Server already running | No change — `EnsureServer()` returns `(false, nil)`, `StartServer()` not called |
| CLI with path arg, server killed | Bootstrap session keeps server alive → `bootstrapWait()` polls find restored sessions → command proceeds normally |

### `EnsureServer` Return Contract

`EnsureServer()` return values remain unchanged:
- `(false, nil)` — server was already running
- `(true, nil)` — server was just started (now with a bootstrap session)
- `(true, err)` — server start attempted but failed

### Testing Requirements

1. `StartServer()` creates a detached session (server stays alive after call returns)
2. `ServerRunning()` returns true after the new bootstrap
3. When resurrect is not installed, bootstrap session "0" persists harmlessly
4. Existing `EnsureServer()` tests updated to expect `new-session -d` instead of `start-server` — return contract unchanged
5. End-to-end unit test in `internal/tmux`: `EnsureServer()` starts server (mock verifies `new-session -d`) → `ListSessions()` returns sessions — validates the full bootstrap→query flow through mock expectations

### Out of Scope

- `ListSessions()` error swallowing — not needed for this fix, server will stay alive
- TUI polling logic changes — not needed, polling will find sessions
- Hook execution changes — hooks work correctly once sessions exist
- `exit-empty` configuration — the fix works regardless of the user's `exit-empty` setting

---

## Working Notes

[Optional - capture in-progress discussion if needed]
