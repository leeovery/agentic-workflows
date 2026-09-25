# Specification: Resume Hooks Lost on Server Restart

## Specification

### Problem Statement

Resume hooks registered in `hooks.json` do not survive tmux server restarts. Two distinct problems cause this:

**Problem 1 — Hook deletion on restart:** `ExecuteHooks()` calls `store.CleanStale()` with the result of `ListAllPanes()`. After a server restart, `ListAllPanes()` returns an empty slice (it swallows errors), so `CleanStale()` treats every hook entry as stale and deletes it. The `clean` command already guards against this (`cmd/clean.go:77-80`), but the guard was never replicated in `ExecuteHooks`.

**Problem 2 — Pane ID instability:** Hooks are keyed by tmux pane ID (`%0`, `%1`), which are ephemeral identifiers that reset on server restart. Even if hooks survive deletion (problem 1 fixed), they reference stale pane IDs that either collide with unrelated new panes or match nothing. The original design incorrectly assumed pane IDs persist across tmux-resurrect — they do not.

### Solution Overview

Two-part fix:

1. **Empty-pane guard:** Add `len(livePanes) > 0` check in `ExecuteHooks` before calling `CleanStale`, matching the existing guard in `clean.go:77-80`. Prevents hook data loss on server restart.

2. **Structural keys replacing pane IDs:** Change the hook storage model from pane-ID-based keys to structural keys using tmux's positional addressing: `session_name:window_index.pane_index`. This format survives tmux-resurrect (which uses the same addressing scheme internally for `send-keys` targeting during restore). Pane IDs do not survive.

### Storage Model

**Current model:** `hooks.json` maps `pane_id → map[event]command` (e.g., `{"%0": {"on-resume": "claude --resume abc"}}`).

**New model:** `hooks.json` maps `structural_key → map[event]command`, where `structural_key` is `session_name:window_index.pane_index` (e.g., `{"my-project-abc123:0.0": {"on-resume": "claude --resume abc"}}`).

**Structural key format:** `session_name:window_index.pane_index`
- `session_name` — the tmux session name (e.g., `my-project-abc123`)
- `window_index` — zero-based window index within the session
- `pane_index` — zero-based pane index within the window
- Separator: colon between session name and window, dot between window and pane

This is the same addressing scheme tmux-resurrect uses for targeting panes during restore.

**Key assumption:** Structural keys depend on session names, window indices, and pane indices surviving tmux-resurrect. This has been verified: tmux-resurrect's save/restore scripts explicitly use `session_name:window_index.pane_index` for targeting `send-keys` and `select-pane` during restore. Pane IDs (`%N`) do not survive — they are reassigned by the tmux server on restart.

### Component Changes

**Hook registration (`cmd/hooks.go`):** Instead of using `$TMUX_PANE` as the key, query tmux for the current pane's session name, window index, and pane index. Build the structural key `session_name:window_index.pane_index` and use it as the hook storage key.

**Hook execution (`internal/hooks/executor.go`):**
- Add empty-pane guard: skip `CleanStale` when `len(livePanes) == 0`.
- Match hooks by structural key instead of pane ID. When `ExecuteHooks(sessionName)` runs, query the session's panes with their window/pane indices and look up hooks by `sessionName:windowIndex.paneIndex`.

**Hook storage (`internal/hooks/store.go`):** Update the data model — the map key changes from pane ID to structural key. `CleanStale` cross-references structural keys against live tmux structure instead of pane IDs.

**Pane querying (`internal/tmux/tmux.go`):** `ListPanes(sessionName)` and `ListAllPanes()` change their tmux format strings to return structural keys instead of pane IDs. Add a new method to resolve the current pane's structural key from a pane ID (for use by `hooks set` and `hooks rm`).

**Volatile markers:** Marker naming changes from `@portal-active-%paneID` to `@portal-active-{structural_key}` (e.g., `@portal-active-my-project-abc:0.0`). `MarkerName` takes a structural key parameter.

**Hook removal (`cmd/hooks.go` — `hooks rm`):** Update to resolve the current pane's structural key instead of using `$TMUX_PANE`. Remove the hook entry and volatile marker using the structural key.

**Hook listing (`cmd/hooks.go` — `hooks list`, `internal/hooks/store.go` — `Hook` struct and `List()`):** The `Hook` struct's `PaneID` field becomes a structural key field. `List()` populates it with structural keys. The `hooks list` CLI output displays structural keys instead of pane IDs.

**Clean command (`cmd/clean.go`):** Update to use structural key model for cleanup. The existing empty-pane guard remains.

### Behavioral Requirements

**Graceful failure without tmux-resurrect:** If resurrect is not installed or not used, the server restarts with no sessions. Hooks remain on disk (empty-pane guard prevents deletion) but no matching structure exists — hooks simply don't fire. No errors, no data loss. This is correct best-effort behavior.

**No resurrect dependency:** Portal must not check for, detect, or explicitly depend on tmux-resurrect. The structural key approach works with resurrect naturally and fails gracefully without it.

**Multi-pane support:** Each pane in a session has its own hook entry keyed by its unique structural position. A session with three panes has three independent hook entries (e.g., `proj-abc:0.0`, `proj-abc:0.1`, `proj-abc:0.2`).

**Silent operation:** Hook execution failures (no matching panes, stale keys) are silent — no errors surfaced to the user. This matches the current best-effort design.

**Breaking change to `hooks.json`:** Existing hook entries keyed by pane ID become invalid. Old pane-ID-keyed entries (e.g., `%0`) are automatically cleaned by `CleanStale` on the first run with live panes after upgrading — they won't match any live structural key. No explicit migration step required. This is acceptable since the current format produces broken behavior anyway.

### Design Decisions

**SendKeys targeting:** Use structural keys directly as tmux `-t` targets. tmux natively accepts `session:window.pane` format for targeting panes (e.g., `tmux send-keys -t "my-project-abc:0.1" "command" Enter`). No need to resolve structural keys back to pane IDs. This is the same approach tmux-resurrect uses.

**Pane querying approach:** `ListPanes` and `ListAllPanes` return structural keys (`[]string`) instead of pane IDs. The underlying tmux commands change their `-F` format string to output `#{session_name}:#{window_index}.#{pane_index}` instead of `#{pane_id}`. Function signatures remain `[]string` — the semantic meaning of the strings changes from pane IDs to structural keys. For registration and removal, a new `tmux.Client` method resolves the current pane's structural key from `$TMUX_PANE` (e.g., `tmux display-message -p -t "$TMUX_PANE" "#{session_name}:#{window_index}.#{pane_index}"`).

**CleanStale contract:** `CleanStale(liveKeys []string)` — same signature, parameter renamed. Callers pass structural keys from `ListAllPanes`. The function cross-references hook map keys against `liveKeys` — semantics unchanged, just the key format changes.

**Interface changes:** `PaneLister`, `AllPaneLister`, and `KeySender` interface signatures remain `[]string` / `string` — the values change from pane IDs to structural keys. `SendKeys(target string, command string)` accepts structural keys (tmux resolves them). No new interfaces needed. Mocks in tests update to use structural key values instead of pane ID values.

**Volatile marker format:** Definitive format is `@portal-active-{structural_key}` where structural key uses the standard format. Example: `@portal-active-my-project-abc:0.0`. tmux user options accept colons and dots in names.

### Testing Requirements

- Fix existing test "no tmux server running skips cleanup gracefully" (`executor_test.go:537-568`) to assert `CleanStale` is **not** called when `livePanes` is empty
- Add test for hook survival when `ListAllPanes` returns empty (post-restart, pre-resurrect scenario)
- Add tests for structural key construction, registration, and lookup
- Add tests for hooks with multiple panes in the same session using structural keys
- Add test verifying graceful no-op when structural keys don't match any live panes (no-resurrect scenario)
- Update all existing hook tests to use structural keys instead of pane IDs

---

## Working Notes

[Optional - capture in-progress discussion if needed]
