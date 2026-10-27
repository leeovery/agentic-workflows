# Investigation: Daemon Merge Reintroduces Dead Sessions

## Symptoms

### Problem Description

**Expected behavior:**
The daemon's structural index merge should not re-introduce sessions that have been killed in tmux. The `@portal-skeleton-<paneKey>` server-option marker is meant to preserve pre-hydrate state for panes that have been skeleton-restored but not yet hydrated — it must not override the live tmux session list.

**Actual behavior:**
`mergeSkippedPanes` → `mergePane` → `findOrAppendSession` (`internal/state/capture.go:154`) appends a session from `prev.Sessions` into the freshly-built index without checking whether that session still exists in tmux. Any paneKey in the marker set whose session has been killed in tmux causes the dead session to be re-committed to `sessions.json`. On the next bootstrap, the restore phase reconstructs the killed session from the saved state. To the user this presents as: "killed sessions reappear after Portal restart."

### Manifestation

- Killed session reappears in `~/.config/portal/state/sessions.json` within one daemon tick (≤30s) after deletion in tmux.
- Subsequent Portal bootstrap reconstructs the dead session via `internal/restore` from the polluted index.
- No error or warning surfaces — silent data corruption of the source of truth.

### Reproduction Steps

Synthetic repro (does not require triggering the hydrate cascade):

1. Inside a live tmux server, identify an existing pane and its paneKey.
2. Set the marker manually: `tmux set-option -s @portal-skeleton-<paneKey> 1`
3. `tmux kill-session -t <session>` against the session containing that pane.
4. Wait one daemon tick (≤30s).
5. Inspect `~/.config/portal/state/sessions.json` — the killed session is present.

**Reproducibility:** Always, given the marker set + session killed conditions.

**Live in-the-wild confirmation (2026-05-08):** the user observed three specific sessions resurrecting after kill: `agentic-workflows-XXrJ3J`, `leeovery-Gi5NLG`, `leeovery-feqhpg`. Inspecting `tmux show-options -s` revealed exactly three matching stale `@portal-skeleton-*` markers (`agentic-workflows-XXrJ3J__1.1`, `leeovery-Gi5NLG__1.1`, `leeovery-feqhpg__1.1`). Killing an unmarkered session (`game-ideas`) did NOT resurrect it. This is the cleanest possible empirical confirmation: presence of marker is necessary AND sufficient (given a daemon tick) for the resurrection symptom.

### Environment

- **Affected environments:** Local — any installation running `portal state daemon`.
- **User conditions:** Any user running Portal with the resurrection feature enabled (i.e. all current users).

### Impact

- **Severity:** High — silent corruption of the persisted state; user-visible "zombie" sessions; eroded trust that `kill-session` is permanent.
- **Scope:** All users; triggers under any path that produces a stale `@portal-skeleton-*` marker (hydrate timeout, daemon crash mid-hydrate, version-upgrade restart, manual tmux ops).
- **Business impact:** Trust regression on a core product promise (user controls their session list).

### References

- Inbox source: `.workflows/.inbox/.archived/bugs/2026-05-08--daemon-merge-reintroduces-dead-sessions.md`
- Companion bug (different layer, shared symptom): `.workflows/.inbox/bugs/2026-05-08--killed-sessions-resurrect-on-restart.md`
- Spec context: `built-in-session-resurrection` feature work in `.workflows/completed/`

---

## Analysis

### Initial Hypotheses

The merge step in `CaptureStructure` trusts the `@portal-skeleton-<paneKey>` marker set as authoritative evidence that a session is "in flight" (skeleton-created, awaiting hydrate). It does not cross-check the live tmux session list — which it has just enumerated in the same call — so a stale marker pulls a dead session forward indefinitely.

### Code Trace

**Entry point:** `tick` in `cmd/state_daemon.go:77` — fires every 1s in the `_portal-saver` daemon.

**Execution path:**

1. `cmd/state_daemon.go:115` `captureAndCommit` reads the marker set:
   `skipSet, err := state.ListSkeletonMarkers(deps.Client)` — this is the full set of `@portal-skeleton-<paneKey>` server options regardless of whether the underlying session still exists.
2. `cmd/state_daemon.go:121` calls `state.CaptureStructure(deps.Client, skipSet, deps.PrevIndex)`.
3. `internal/state/capture.go:62-106` `CaptureStructure`:
   - Line 66: `ListSessionNames` → live tmux session names.
   - Line 71: `keepSessionNames` strips internal-prefix → set of live, non-internal session names. **This is the live-session truth.**
   - Lines 85-96: builds the fresh `[]Session` from `keep`. **Killed sessions are correctly absent here.**
   - Line 100: `if len(skipSet) > 0 && prev != nil { mergeSkippedPanes(&idx, *prev, skipSet) }` — **the bug surface.**
4. `internal/state/capture.go:117-130` `mergeSkippedPanes` iterates `prev.Sessions` and for each pane whose `SanitizePaneKey` is in `skipSet`, calls `mergePane`. **No reference to `keep` or `idx.Sessions` for live-session validation.**
5. `internal/state/capture.go:137-148` `mergePane` → `findOrAppendSession` (line 154) — this is where the dead session is re-created in `idx.Sessions` if not present.
6. After `CaptureStructure` returns, `captureAndCommit` writes the polluted index to `sessions.json` via `state.Commit` (line 152) and updates `deps.PrevIndex = &idx` (line 156). **The dead session is now part of `prev` for every subsequent tick — bug self-sustains.**
7. Next bootstrap (`cmd/bootstrap` step 5, Restore) reads `sessions.json` and reconstructs the dead session.

**Key files involved:**
- `internal/state/capture.go` — `mergeSkippedPanes`, `mergePane`, `findOrAppendSession`. The defective layer.
- `cmd/state_daemon.go` — `captureAndCommit`, `tick`. Caller; updates `PrevIndex` to the committed (polluted) index every tick.
- `internal/state/markers.go` — `ListSkeletonMarkers`. Faithfully reads markers; not at fault.
- `internal/state/capture_test.go:570-617` — the test `merges a skipped pane's session and window from prev when missing from fresh` **codifies the current (buggy) behaviour** and will need updating as part of the fix.

**Marker lifecycle (how stale markers arise):**
- **Set** by `internal/restore/session.go:380-384` (`setSkeletonMarker` → `state.SetSkeletonMarker`) during bootstrap step 5 skeleton restore.
- **Unset** by hydrate helper at `cmd/state_hydrate.go:312` (`UnsetSkeletonMarkerForFIFO`) after scrollback replay completes.
- **Leak paths** (any of these produces a stale marker whose session may later be killed):
  1. Hydrate timeout — pane never gets hydrated; marker survives.
  2. Daemon crash mid-hydrate — never reaches the unset.
  3. User runs `tmux kill-session` against a not-yet-hydrated pane — pane goes away, marker stays.
  4. Version-upgrade of `_portal-saver` mid-hydrate.
  5. Manual `tmux set-option -s @portal-skeleton-<key>` (synthetic repro).
- **No cleanup path exists.** The bootstrap orchestrator's step 8 `CleanStale` only prunes hook-store entries (`cmd/bootstrap_production.go:63`), not markers. `SweepOrphanFIFOs` in step 7 only removes orphan FIFO files. Once a marker leaks, it persists for the tmux server's lifetime.

### Root Cause

`mergeSkippedPanes` (`internal/state/capture.go:117`) treats the `@portal-skeleton-<paneKey>` marker set as authoritative evidence that the session is "in flight." It does not validate against the live tmux session list — which is already known inside the same `CaptureStructure` call as `keep` / `idx.Sessions`. A stale marker therefore causes `findOrAppendSession` (line 154) to append a dead session into the freshly-built index, which then gets committed to `sessions.json` and persists into `prev` indefinitely (self-reinforcing through `captureAndCommit`'s `deps.PrevIndex = &idx` at line 156).

**Why this happens:** The merge logic was designed under the implicit assumption that markers cannot be stale. It correctly handles the *intended* case (pane skeleton-created, awaiting hydrate, briefly invisible to tmux) but does not defend against the *unintended* case (marker outlives its underlying session via any of the leak paths above).

### Contributing Factors

- Marker is server-scoped (`set-option -s`), persisting across hydrate failures, daemon restarts, manual tmux ops, and indefinitely if hydrate never runs.
- `prev` in `captureAndCommit` is replaced with the just-committed index every successful tick (`cmd/state_daemon.go:156`), so once a dead session is committed once, it lives in `prev` indefinitely — the bug is self-sustaining even if the marker were later cleared.
- No marker cleanup path in bootstrap. `SweepOrphanFIFOs` cleans orphan FIFOs but not the markers that point at them; `CleanStale` cleans hook entries but not markers.
- The merge currently has no live-session cross-check — `keep` (the live-tmux truth, computed at line 71 of `CaptureStructure`) is not threaded into `mergeSkippedPanes`.

### Why It Wasn't Caught

- The existing unit test (`capture_test.go:570-617`) explicitly asserts the buggy behaviour as correct ("merges a skipped pane's session and window from prev when missing from fresh") — this codifies the wrong invariant.
- The original spec for the resurrection feature (`built-in-session-resurrection`) framed merge intent around the hydrate-in-progress scenario without modelling marker-staleness adversarial cases.
- The `built-in-session-resurrection` feature integration tests exercise the happy-path skeleton → hydrate flow, not the killed-mid-flight path.
- Reproducing in the wild requires either a hydrate failure (hard to engineer in CI) or a manual marker injection, so the bug was unlikely to surface during normal QA.

### Blast Radius

**Directly affected:**
- `internal/state` — committed `sessions.json` becomes inconsistent with live tmux.
- `internal/restore` — reconstructs ghost sessions on bootstrap.

**Potentially affected:**
- Any consumer that reads `sessions.json` (CLI list commands, TUI session picker after a restart) sees the ghost session.

---

## Fix Direction

### Chosen Approach

Two coordinated changes, both inside this work unit:

1. **Live-set filtering in `mergeSkippedPanes`** (`internal/state/capture.go`). Before processing prev's panes, build a structural map from the fresh index — session names, then per-session window indices, then per-window pane indices. The merge proceeds only when all three levels exist in fresh. A skeleton marker is no longer treated as authoritative; it only protects panes whose session/window/pane path tmux still acknowledges.

2. **Stale-marker cleanup as a new bootstrap step** (between current step 5 Restore and step 7 SweepOrphanFIFOs). Enumerates the live `@portal-skeleton-*` markers, intersects against live tmux panes, and unsets any marker whose paneKey no longer corresponds to a live pane. Best-effort, mirrors the warning-soft semantics of the existing CleanStale step. Restores scrollback-save coverage for panes whose markers leaked.

**Deciding factor:** the user requested a proper-and-clean fix that hardens both layers. The merge filter alone resolves the user-visible resurrection symptom but leaves a quieter scrollback-save defect on currently-marked panes; the cleanup closes that gap and prevents indefinite marker accumulation. Both changes are local to layers already in scope for the merge logic — they compose without architectural surgery.

### Options Explored

- **Session-level filtering only.** Smallest possible change. Rejected: the same defensive flaw exists at window and pane level — kill-window or kill-pane against a still-live session leaves the analogous resurrection path open. The user asked for a complete fix; partial filtering leaves a known sibling defect.

- **Pre-filter `skipSet` in `captureAndCommit` (higher layer).** Rejected: costs an extra `ListSessionNames` tmux call per tick that `CaptureStructure` already makes internally; staleness is a merge-layer concern and pushing it up muddies responsibility split.

- **Drop "introduce missing session" merge behaviour entirely.** Rejected: may break the legitimate hydrate-phase-A race where a skeleton-restored session is briefly invisible to list-sessions. Higher behavioural risk than targeted filtering.

- **Defer marker cleanup to a separate work unit.** Rejected per user direction — the side effect (skipped scrollback saves for currently-marked panes) is real for the user right now; bundling is the cleaner outcome.

### Discussion

Empirical confirmation came partway through the review: the user's three resurrecting sessions matched exactly with three stale `@portal-skeleton-*` markers (`agentic-workflows-XXrJ3J__1.1`, `leeovery-Gi5NLG__1.1`, `leeovery-feqhpg__1.1`). Killing an unmarkered session (`game-ideas`) did not resurrect it. This pinned the diagnosis: marker presence is necessary AND sufficient for the symptom.

Discussion progression:
- **Self-cleaning:** the merge fix alone restores correctness for the resurrection symptom (sessions.json self-heals on the next tick once a dead session is no longer reintroduced). User asked whether cleanup was needed — the resurrection symptom alone does not require it, but a separate side effect (scrollback-save skipped for live-marker panes per `cmd/state_daemon.go:131-133`) does.
- **Scope progression:** user shifted from "tight surgical fix" toward "fix it properly" after the side-effect concern surfaced. Final scope settled on full filtering (all three levels) plus the cleanup step.
- **Architectural sanity:** every consumer of `sessions.json` and the daemon's `prev` was traced; no caller depends on the buggy "merge can introduce arbitrary prev sessions" behaviour. Hydrate-in-progress (the merge's intended use case) survives unchanged because phase A creates the session in tmux before the marker is set.

Companion bug (`killed-sessions-resurrect-on-restart`, logged 2026-05-08) is the most likely producer of stale markers in normal use but lives in a different layer (`cmd/state_hydrate.go` / `cmd/state_signal_hydrate.go`) and is independently scoped. This work unit does not depend on it; the fixes are orthogonal.

### Testing Recommendations

- **Replace** the existing test `TestCaptureStructureMergeSkippedPanes/merges a skipped pane's session and window from prev when missing from fresh` (`internal/state/capture_test.go:570`) with its inverse: a prev session whose name is not in fresh must NOT be merged, even when its paneKey is in skipSet.
- **Add** unit tests for window-level and pane-level filtering: a marker for a window or pane that exists in prev but not in fresh (within an otherwise-live session) must be dropped from the merge result.
- **Add** a regression test mirroring the user's empirical scenario: marker set, session killed, daemon tick → fresh capture must NOT reintroduce the session.
- **Add** a unit test for the stale-marker cleanup function: given a marker whose paneKey doesn't correspond to a live pane, the cleanup unsets it; given a live marker, the cleanup leaves it alone.
- **Add** a bootstrap-step integration test asserting the new cleanup step runs at the right point in the orchestrator sequence and degrades to a warning on tmux failure (matching the soft-warning posture of CleanStale).
- **Preserve** the existing happy-path skeleton-marker tests in `internal/restore/session_markers_test.go` — the fix must not regress legitimate hydrate-in-progress merge behaviour.

### Risk Assessment

- **Fix complexity:** Low–Medium. The merge change is ~15 lines (session/window/pane filtering). The cleanup step is a new bootstrap step (~50 lines including adapter wiring) plus updates to the orchestrator sequence and its tests.
- **Regression risk:** Low. Every consumer of `sessions.json` and `prev` was traced; no caller depends on the buggy behaviour. The merge's intended use case (hydrate-in-progress) is structurally distinct from the bug surface and remains correct.
- **Recommended approach:** Regular release. No hotfix needed — the symptom is recoverable (kill the same session twice, or restart tmux server) and the workaround (manual marker unset via `tmux set-option -us @portal-skeleton-<key>`) is available for affected users.

---

## Notes

This bug is independently wrong from the companion hydrate-cascade bug. Even with a perfect FIFO IPC, markers can become stale via process crashes, version-upgrade restart, or manual tmux operations. The merge logic should not assume marker validity on the user's behalf.
