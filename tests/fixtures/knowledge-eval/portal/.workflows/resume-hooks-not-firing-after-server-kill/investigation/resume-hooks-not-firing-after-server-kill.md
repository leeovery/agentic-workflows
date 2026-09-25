# Investigation: Resume Hooks Not Firing After Server Kill

## Symptoms

### Problem Description

**Expected behavior:**
After `tmux kill-server`, reopening Portal should resurrect previous sessions (via tmux-resurrect) and fire resume hooks, resuming Claude Code sessions in their respective panes.

**Actual behavior:**
Portal boots tmux but goes straight to the projects page instead of the sessions page — sessions are not resurrected and resume hooks do not fire.

### Manifestation

- No sessions present after server restart — user lands on projects page instead of sessions page
- Resume hooks never execute because there are no sessions to trigger them
- The recent `resume-hooks-lost-on-server-restart` bugfix was supposed to address this scenario

### Reproduction Steps

1. Open Portal, initiate two Claude Code sessions — resume hooks register successfully
2. Run `tmux kill-server` to kill the tmux server
3. Open Ghostty terminal and type `x` (Portal alias) — not inside any tmux session
4. Portal shows "starting tmux server" loading page, then lands on projects page — no sessions restored
5. Running `tmux list-sessions` from another terminal shows "no server running"

**Reproducibility:** Confirmed on at least one system

**Critical finding:** After Portal's bootstrap, the tmux server is not running at all. The server either fails to start properly or starts and immediately dies. This means tmux-resurrect/continuum never get a chance to restore sessions.

### Environment

- **Affected environments:** Local (tested on a separate MacBook Pro, not the dev machine)
- **Platform:** macOS (Ghostty terminal)
- **tmux plugins confirmed:** tmux-resurrect + tmux-continuum installed with `@continuum-restore 'on'` and `@resurrect-capture-pane-contents 'on'`
- **No error output** from Portal during startup

### Impact

- **Severity:** High
- **Scope:** All users relying on resume hooks after server restart
- **Business impact:** Core workflow disruption — Claude sessions lost on tmux restart

### References

- Previous bugfix: `resume-hooks-lost-on-server-restart` (recent commits on main)

---

## Analysis

### Initial Hypotheses

- ~~tmux-resurrect may not be installed on the test machine~~ — CONFIRMED installed with auto-restore on
- Portal's EnsureServer / server bootstrap may start the server in a way that doesn't persist (e.g., server starts, Portal's TUI runs, server dies when Portal exits)
- The tmux server may start but without loading tmux.conf / TPM plugins, so resurrect never triggers
- Portal may be using `tmux new-session` in a way that creates and immediately destroys the server

### Code Trace

**Entry point:** `cmd/root.go:53` — `PersistentPreRunE` calls `bootstrapper.EnsureServer()`

**Server bootstrap path:**
1. `cmd/root.go:63` — `bootstrapper.EnsureServer()` called
2. `internal/tmux/tmux.go:137-145` — `EnsureServer()` checks `ServerRunning()` (runs `tmux info`), if false calls `StartServer()` (runs `tmux start-server`)
3. `tmux start-server` starts the server process, sources `.tmux.conf`, but creates **no sessions**
4. tmux's `exit-empty` option (on by default) causes the server to exit when there are no active sessions

**TUI loading path (no-args invocation):**
1. `cmd/open.go:90-91` — no destination → calls `openTUIFunc` with `serverStarted=true`
2. `cmd/open.go:349-406` — `openTUI` builds model with `serverStarted: true`, launches Bubble Tea
3. `internal/tui/model.go:367-374` — `WithServerStarted(true)` sets `activePage = PageLoading`
4. `internal/tui/model.go:607-629` — `Init()` on PageLoading: fetches sessions, sets minWait (1s) and maxWait (6s) ticks
5. `internal/tui/model.go:671-681` — SessionsMsg handler on PageLoading: if sessions empty, calls `pollSessionsCmd()` (re-polls every 500ms)
6. `internal/tui/model.go:696-701` — MaxWaitElapsedMsg (6s): calls `transitionFromLoading()`
7. `internal/tui/model.go:585-589` — `transitionFromLoading()` → `evaluateDefaultPage()`
8. `internal/tui/model.go:542-545` — `evaluateDefaultPage()`: 0 session items → `activePage = PageProjects`

**Why sessions are empty:**
- `ListSessions()` (`tmux.go:79-83`) swallows errors, returns `[]Session{}, nil` when server is dead
- Every 500ms poll returns empty because the server exited before or shortly after `start-server` returned
- The server never lives long enough for tmux-continuum to restore sessions

**Key files involved:**
- `internal/tmux/tmux.go:125-145` — `StartServer` / `EnsureServer` — starts server with no sessions
- `internal/tui/model.go:574-589` — loading/polling logic — polls a dead server
- `cmd/root.go:50-76` — `PersistentPreRunE` — bootstrap orchestration

### Root Cause

**Portal uses `tmux start-server` to bootstrap tmux, but this command creates a sessionless server that immediately exits under tmux's default `exit-empty on` — killing the server before tmux-continuum can restore sessions.**

Verified failure sequence (backed by tmux source code and tmux-continuum source code):

1. Portal's `EnsureServer()` calls `tmux start-server` — the server daemon forks, sources `.tmux.conf`
2. TPM runs via `run-shell`, initializes plugins including tmux-continuum
3. Continuum detects a fresh server (via `#{start_time}` check) and **backgrounds** `continuum_restore.sh` — which **sleeps 1 second** before calling resurrect's `restore.sh`
4. The `start-server` client completes and disconnects (it's not attached to any session)
5. The tmux server loop checks `exit-empty` (on by default) and sees zero sessions → **server exits**
6. After 1 second, `continuum_restore.sh` wakes up and tries to run `restore.sh` — but the server is dead, so session creation fails silently
7. Portal's TUI polls for sessions but `ListSessions()` returns `[]Session{}, nil` (swallows errors from dead server)
8. After 6s MaxWait, TUI transitions to projects page

**Key evidence from tmux man page:** *"start-server — Start the tmux server, if not already running, without creating any sessions. Note that as by default the tmux server will exit with no sessions, this is only useful if a session is created in ~/.tmux.conf, exit-empty is turned off, or another command is run as part of the same command sequence."* (Sources: [tmux issue #182](https://github.com/tmux/tmux/issues/182), [tmux issue #936](https://github.com/tmux/tmux/issues/936))

**Key evidence from tmux-continuum source:** Continuum's own systemd/launchd bootstrap uses `tmux new-session -d` — NOT `tmux start-server`. This is because continuum knows the server needs at least one session to stay alive while the 1-second delayed restore runs. Resurrect's `restore.sh` has a "restoring from scratch" mode that detects exactly 1 pane and replaces the bootstrap session with saved state. (Source: [tmux-continuum continuum.tmux](https://github.com/tmux-plugins/tmux-continuum/blob/master/continuum.tmux), [tmux-resurrect restore.sh](https://github.com/tmux-plugins/tmux-resurrect/blob/master/scripts/restore.sh))

### Contributing Factors

- **`exit-empty on` (tmux default):** The server self-terminates with zero sessions. The tmux server loop checks `!RB_EMPTY(&sessions)` on every iteration — with no sessions, it returns 1 and exits. (Source: tmux `server.c`)
- **Continuum restore is async + delayed:** `continuum_restore.sh` runs in the background with a `sleep 1` before invoking resurrect. The server dies in that 1-second gap.
- **`ListSessions()` swallows errors:** Returns `[]Session{}, nil` on failure — Portal can't distinguish "no sessions yet" from "server is dead." The TUI polling loop silently retries against a dead server for 6 seconds.
- **Portal chose `start-server` over `new-session -d`:** The original design discussion (`.workflows/auto-start-tmux-server/discussion/auto-start-tmux-server.md:65-67`) explicitly rejected creating a bootstrap session to avoid lifecycle complexity. The assumption was *"continuum hooks into the process quickly enough to create sessions before [exit-empty] happens."* This assumption was wrong — continuum's restore is async with a 1-second delay.

### Why It Wasn't Caught

- The previous bugfix focused on hook storage — it assumed tmux-resurrect would handle session restoration
- The dev machine has an active tmux server, so `EnsureServer` returns `(false, nil)` — the `start-server` path is never exercised in development
- The `exit-empty` risk was acknowledged as a deferred edge case in the original design discussion but never tested
- No test covers the `start-server` → `exit-empty` → server dies → no restoration scenario

### Blast Radius

**Directly affected:**
- `internal/tmux/tmux.go:125-131` — `StartServer()` — uses `start-server` instead of `new-session -d`
- `internal/tmux/tmux.go:137-145` — `EnsureServer()` — orchestrates the broken bootstrap
- All resume hook functionality — hooks can't fire without sessions
- TUI loading page — polls a dead server

**Potentially affected:**
- `cmd/bootstrap_wait.go` — CLI bootstrap wait also polls against a dead server
- Any command depending on `PersistentPreRunE` starting the server (attach, open, kill, list)

---

## Fix Direction

### Chosen Approach

Replace `tmux start-server` with `tmux new-session -d` to create a bootstrap session that keeps the server alive during plugin initialization and continuum's delayed restore.

This is the same pattern tmux-continuum uses in its own systemd/launchd bootstrap. Resurrect has built-in "restoring from scratch" handling: when it detects exactly 1 pane, it replaces the bootstrap session with saved state and cleans up the default session "0" if it wasn't in the save file.

**Deciding factor:** This follows tmux-continuum's own proven bootstrap pattern rather than inventing a new mechanism. The fix is scoped entirely to server bootstrap — no changes needed to hooks, TUI, or polling logic.

### Options Explored

Only one approach was presented — it directly addresses the root cause using the same mechanism tmux-continuum itself uses. No alternatives were needed.

### Discussion

The investigation initially speculated about `exit-empty` and continuum internals. User correctly pushed back on unverified assumptions, which led to research against tmux source code (`server.c`, `cmd-kill-server.c`), tmux-continuum source (`continuum.tmux`, `continuum_restore.sh`), and tmux-resurrect source (`restore.sh`). This research confirmed the root cause and revealed the exact mechanism: continuum's restore is async with a 1-second sleep, the server dies from `exit-empty` in that gap, and continuum's own bootstrap uses `new-session -d` to avoid this.

User priorities:
- Fix should be minimal and targeted — server bootstrap only
- No changes to hooks, TUI, or polling logic
- Works correctly with resurrect installed, degrades gracefully without

### Testing Recommendations

- Test that `EnsureServer` / `StartServer` creates a detached session (server stays alive)
- Test that `ServerRunning()` returns true after the new bootstrap
- Integration test: bootstrap → poll for sessions → verify server persists
- Test graceful behavior when resurrect is not installed (bootstrap session "0" persists)

### Risk Assessment

- **Fix complexity:** Low — change `start-server` to `new-session -d` in `StartServer()`
- **Regression risk:** Low — the bootstrap session is either replaced by resurrect or harmlessly persists
- **Recommended approach:** Regular release

---

## Notes

- User explicitly asked not to kill tmux server on the dev machine during investigation
- tmux-resurrect and tmux-continuum are confirmed installed with auto-restore on
- The previous bugfix was about hook storage durability — this bug is about server lifecycle and session restoration
- The user's tmux.conf does NOT set `exit-empty off`
- **Prior art:** The `exit-empty` risk was explicitly acknowledged in the original `auto-start-tmux-server` discussion (`.workflows/auto-start-tmux-server/discussion/auto-start-tmux-server.md:67`): "tmux docs say the server exits by default with no sessions. Assumption is that continuum hooks into the process quickly enough to create sessions before this happens. If not, a keepalive session could be added later." The edge case has now materialized.
- Synthesis agent validated root cause — all Portal code paths independently verified
- Root cause verified against tmux source code (server.c, cmd-kill-server.c, server-client.c), tmux-continuum source (continuum.tmux, continuum_restore.sh), and tmux-resurrect source (restore.sh)
- tmux-continuum's own bootstrap mechanism uses `tmux new-session -d`, not `tmux start-server` — this is the pattern Portal should follow
