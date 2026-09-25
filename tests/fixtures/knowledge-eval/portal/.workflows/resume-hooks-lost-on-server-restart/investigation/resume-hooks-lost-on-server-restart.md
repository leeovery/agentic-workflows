# Investigation: Resume Hooks Lost On Server Restart

## Symptoms

### Problem Description

**Expected behavior:**
Resume hooks registered in `hooks.json` should survive tmux server restarts and fire when Portal reopens sessions.

**Actual behavior:**
`CleanStale()` removes all hooks from `hooks.json` after a server restart because the old pane IDs no longer exist in the new tmux server. Hooks are destroyed before they get a chance to execute.

### Manifestation

- Hooks silently vanish from `hooks.json` after tmux server kill/restart
- Portal reopens with "No sessions available" in the project picker
- Resume hooks never fire — session continuity is broken
- No error messages or warnings — the deletion is silent

### Reproduction Steps

1. Have two or more Claude Code sessions running in tmux panes, each with an on-resume hook registered (e.g., pane `%0`, `%1`)
2. Kill the tmux server (`tmux kill-server`) or reboot
3. Reopen Portal — project picker shows "No sessions available"
4. Inspect `hooks.json` — entries have been removed

**Reproducibility:** Always

### Environment

- **Affected environments:** Local (any system using tmux + Portal)
- **User conditions:** Multiple panes with registered resume hooks
- **First observed:** 2026-04-01, on freshly installed MacBook Pro — first real test of this functionality on new hardware
- **Workaround:** None — hooks are destroyed before they can be used
- **History:** Likely always been this way; never tested against a server restart scenario before

### Impact

- **Severity:** High
- **Scope:** All users relying on resume hooks for session continuity
- **Business impact:** Core workflow broken — resume hooks are the mechanism for restoring Claude Code sessions after restart

### References

- Inbox bug report: `.workflows/.inbox/.archived/bugs/2026-04-01--resume-hooks-lost-on-server-restart.md`

---

## Analysis

### Initial Hypotheses

`ExecuteHooks()` calls `store.CleanStale()` unconditionally at the start of execution. After a server restart, the new tmux server has no knowledge of old pane IDs — they're ephemeral identifiers that reset. `CleanStale()` sees all old entries as stale and deletes them.

### Code Trace

**Entry point:** `cmd/attach.go:40-42` / `cmd/open.go` — both call `hookExecutor(name)` which invokes `hooks.ExecuteHooks`.

**Execution path:**
1. `cmd/hook_executor.go:14-18` — `buildHookExecutor` creates a closure calling `hooks.ExecuteHooks(sessionName, client, store)`
2. `internal/hooks/executor.go:66-68` — `ExecuteHooks` calls `tmux.ListAllPanes()`, then `store.CleanStale(livePanes)`
3. `internal/tmux/tmux.go:235-241` — `ListAllPanes()` runs `tmux list-panes -a -F #{pane_id}`. **On error (no server/no sessions), returns `[]string{}, nil`** — empty slice, nil error
4. `internal/hooks/executor.go:66` — `err == nil` is always true (ListAllPanes never returns error), so `CleanStale` always runs
5. `internal/hooks/store.go:130-159` — `CleanStale(livePaneIDs)` builds a set from `livePaneIDs`, keeps only hooks whose pane ID is in the set, removes the rest
6. With empty `livePaneIDs` after server restart → every hook entry is "stale" → all hooks deleted from disk

**Key files involved:**
- `internal/hooks/executor.go` — orchestrates cleanup + hook execution, no guard against empty live panes
- `internal/hooks/store.go` — `CleanStale` faithfully removes anything not in the live set
- `internal/tmux/tmux.go` — `ListAllPanes` swallows errors, returns empty slice
- `cmd/clean.go:77-80` — **has the fix already**: skips cleanup when `len(livePanes) == 0` with existing hooks. This guard was not replicated in `ExecuteHooks`.

### Root Cause

Two distinct problems prevent resume hooks from working after a tmux server restart:

**Problem 1 — Hook deletion (data loss):**
`ExecuteHooks()` in `executor.go:66-68` calls `CleanStale()` with the result of `ListAllPanes()` without checking whether the live pane list is empty. After a server restart, `ListAllPanes()` returns an empty slice (no error, it swallows errors at `tmux.go:237-238`). `CleanStale()` interprets this as "no panes exist" and removes all hook entries from `hooks.json`.

**Problem 2 — Pane ID instability (broken mapping):**
Even if hooks survive the restart (problem 1 fixed), the tracking mechanism is fundamentally broken. Hooks are keyed by tmux pane ID (`%0`, `%1`, etc.) — ephemeral identifiers that reset when the tmux server restarts. After restart:
- Old hooks reference old pane IDs (e.g., `%0` → `claude --resume abc123`)
- New sessions get new pane IDs starting from `%0` again
- A new `%0` is a completely different pane in a potentially different session/project
- Hooks either fire in the wrong context (ID collision) or never fire (no matching ID)

The hook registration (`cmd/hooks.go:83-98`) uses `$TMUX_PANE` as the key, but pane IDs provide no durable link between the hook and the session or project it belongs to. Session names are also non-durable (`{project}-{nanoid}` format, `session/naming.go:41`), but the **session name is at least passed to `ExecuteHooks`** and could serve as a scoping mechanism.

**Why this happens:**
The dual-level tracking design (persistent `hooks.json` + volatile tmux server options) was built assuming pane IDs persist across restarts. The CLAUDE.md docs describe the intent: "volatile markers lost on reboot, so hooks re-fire after restart." But pane IDs are just as volatile as the markers — they're both assigned by tmux and lost on server restart.

### Contributing Factors

- `ListAllPanes()` (`tmux.go:237-238`) swallows errors and returns `([]string{}, nil)` — the caller can't distinguish "no panes" from "tmux not ready"
- `CleanStale` is a pure filter with no awareness of whether an empty live set is meaningful
- The `clean` command (`cmd/clean.go:77-80`) already has the correct guard (`if len(livePanes) == 0 { return nil }`) but this wasn't replicated in `ExecuteHooks`
- The cleanup in `ExecuteHooks` is "best-effort" (errors silently ignored) but the consequence of incorrect cleanup is data loss, not just a missed cleanup
- Hooks are keyed solely by pane ID with no additional context (session name, project path) to enable remapping after restart
- Session names are non-durable (`{project}-{nanoid}`), so even if hooks stored session names, they couldn't match by session name alone — but the project name prefix is stable

### Why It Wasn't Caught

- The test "no tmux server running skips cleanup gracefully" (`executor_test.go:537-568`) explicitly **validates the buggy behavior**: it passes an empty live-panes list to `CleanStale` and asserts it was called, effectively testing that hooks would be wiped
- The mock-based test doesn't capture the real-world consequence because `CleanStale` is mocked and doesn't actually remove data
- No integration test covers the server-restart scenario end-to-end
- The pane ID instability was never apparent because the feature was built and tested on a machine where the tmux server was always running
- The feature was first exercised against a real server restart on a freshly installed MacBook Pro (2026-04-01)

### Blast Radius

**Directly affected:**
- `internal/hooks/executor.go` — `ExecuteHooks` cleanup path (problem 1) and hook matching logic (problem 2)
- `internal/hooks/store.go` — hook data model keyed by pane ID (problem 2)
- `cmd/hooks.go` — hook registration uses `$TMUX_PANE` as sole key (problem 2)
- All resume hook functionality — hooks are either destroyed or orphaned after any server restart

**Potentially affected:**
- `cmd/clean.go` — already has the empty-pane guard, but `CleanStale` is called with the same pane-ID-based model
- `internal/hooks/executor_test.go` — test validates buggy behavior, needs correction

---

## Fix Direction

### Chosen Approach

Two-part fix addressing both problems:

**Problem 1 — Empty-pane guard:** Add `len(livePanes) > 0` check in `ExecuteHooks` before calling `CleanStale`, matching the existing guard in `clean.go:77-80`. Prevents hook data loss on server restart.

**Problem 2 — Replace pane ID keying with structural keys:** Change the hook storage model from `pane_id → events` to `session_name:window_index.pane_index → events`. This uses tmux's structural addressing (which survives tmux-resurrect) instead of ephemeral pane IDs (which don't).

Changes required:
1. **Hook registration** (`cmd/hooks.go`): Instead of using `$TMUX_PANE` as the key, query tmux for the current pane's session name, window index, and pane index. Store hooks keyed by `session_name:window_index.pane_index`.
2. **Hook execution** (`internal/hooks/executor.go`): Match hooks by structural key instead of pane ID. When `ExecuteHooks(sessionName)` runs, query the session's panes with their window/pane indices and look up hooks by `sessionName:windowIndex.paneIndex`.
3. **Hook storage** (`internal/hooks/store.go`): The data model changes from `map[paneID]map[event]command` to `map[structuralKey]map[event]command`. The structural key format is `session_name:window_index.pane_index`.
4. **Volatile markers**: Change marker naming from `@portal-active-%paneID` to `@portal-active-session:window.pane` (or similar).
5. **Stale cleanup** (`CleanStale`): Cross-reference structural keys against live tmux structure instead of pane IDs. Plus the empty-result guard (problem 1).
6. **`portal clean`** (`cmd/clean.go`): Update to use structural key model for cleanup.

**Graceful failure (no tmux-resurrect):** If resurrect is not present, the server restarts with no sessions. Hooks remain on disk (problem 1 fix prevents deletion) but no matching structure exists — hooks simply don't fire. No errors, no data loss. This is correct best-effort behavior.

**Deciding factor:** The original design was built on the false assumption that tmux pane IDs persist across tmux-resurrect (stated in both the research and specification docs). They don't — resurrect assigns new pane IDs. But session names, window indices, and pane indices DO survive resurrect, making them the correct durable key. This was confirmed by examining tmux-resurrect's save/restore scripts — it explicitly uses `session_name:window_index.pane_index` for targeting `send-keys` and `select-pane` during restore.

### Options Explored

**Option A — Empty-pane guard only (problem 1 fix):** Add `len(livePanes) > 0` check. Prevents data loss but hooks still can't find their target panes after restart because pane IDs change. Insufficient.

**Option B — Key by project path:** Use the project directory path as the hook key. Durable across restarts, but can't distinguish between multiple panes in the same project — a project with 3 Claude sessions would have one hook entry, not three. Insufficient for the multi-pane requirement.

**Option C — Key by structural position (chosen):** Use `session_name:window_index.pane_index`. Survives tmux-resurrect, uniquely identifies each pane, and maps correctly after restore. Handles multiple panes per session. Fails gracefully without resurrect.

### Discussion

The investigation initially focused only on problem 1 (hook deletion via `CleanStale`). User correctly identified that the inbox bug report also flagged pane ID instability as a fundamental issue — fixing data loss alone would leave the feature broken.

Research into tmux-resurrect's approach revealed it uses structural keys (`session_name + window_index + pane_index`) rather than pane IDs, confirming that pane IDs are ephemeral across restarts. This led to discovering that the original spec's assumption ("Pane IDs persist across tmux-resurrect" — specification line 24, research line 42) was incorrect.

User priorities:
- Feature must actually work end-to-end, not just fix one piece
- tmux-resurrect is the expected setup but Portal shouldn't check for it or depend on it explicitly
- Must fail gracefully without resurrect (no errors, no data loss, hooks just don't fire)
- Must handle multiple panes per session — each with its own hook

The structural key approach satisfies all requirements. It's the same addressing scheme tmux-resurrect itself uses, so it's well-tested in practice.

### Testing Recommendations

- Fix existing test "no tmux server running skips cleanup gracefully" (`executor_test.go:537-568`) to assert `CleanStale` is NOT called when `livePanes` is empty
- Add test for hook survival when `ListAllPanes` returns empty (post-restart, pre-resurrect)
- Add tests for structural key registration, lookup, and matching
- Add tests for hooks with multiple panes in same session using structural keys
- Add test verifying graceful no-op when structural keys don't match any live panes (no-resurrect scenario)
- Update all existing hook tests to use structural keys instead of pane IDs

### Risk Assessment

- **Fix complexity:** Medium — the keying model change touches registration, execution, storage, cleanup, and CLI surface. But each change is mechanical (swap pane ID for structural key).
- **Regression risk:** Medium — hooks.json format changes (existing hooks become invalid). Acceptable since the feature doesn't work anyway.
- **Recommended approach:** Regular release. Breaking change to hooks.json format is fine since the current format produces broken behavior.

---

## Notes

- The synthesis agent independently confirmed problem 1 root cause with high confidence and no gaps
- `clean.go` guard was added during the `resume-sessions-after-reboot` feature work but wasn't applied to `ExecuteHooks` at the same time
- The original spec's core assumption about pane ID persistence was incorrect — this is the root cause of problem 2
- tmux-resurrect's restore code explicitly depends on pane indices surviving (uses `session:window.pane` for send-keys targeting), confirming this is a reliable approach
- Portal has no awareness of tmux-resurrect by design — the structural key approach works with resurrect and fails gracefully without it
