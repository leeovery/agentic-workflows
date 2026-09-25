# Specification: Daemon Merge Reintroduces Dead Sessions

## Specification

## Bug Summary

The daemon's structural index merge re-introduces sessions that have been killed in tmux. `mergeSkippedPanes` → `mergePane` → `findOrAppendSession` (`internal/state/capture.go:154`) appends sessions from `prev.Sessions` into the freshly-built index without checking whether those sessions still exist in tmux. Any paneKey present in the `@portal-skeleton-<paneKey>` server-option marker set whose session has been killed in tmux causes the dead session to be re-committed to `sessions.json`. On the next bootstrap, the restore phase reconstructs the killed session from the polluted index. To the user this presents as: **"killed sessions reappear after Portal restart."**

### Root Cause

`mergeSkippedPanes` treats the `@portal-skeleton-<paneKey>` marker set as authoritative evidence that the session is "in flight" (skeleton-created, awaiting hydrate). It does not validate against the live tmux session list — which is already known inside the same `CaptureStructure` call as `keep` / `idx.Sessions`. A stale marker therefore causes `findOrAppendSession` to append a dead session into the freshly-built index, which then gets committed to `sessions.json` and persists into `prev` indefinitely (self-reinforcing through `captureAndCommit`'s `deps.PrevIndex = &idx`).

### Why Markers Become Stale

The marker is set by `internal/restore/session.go` during bootstrap step 5 skeleton restore and unset by the hydrate helper after scrollback replay completes. Markers leak through any of:

1. Hydrate timeout — pane never gets hydrated; marker survives.
2. Daemon crash mid-hydrate — never reaches the unset.
3. User runs `tmux kill-session` against a not-yet-hydrated pane.
4. Version-upgrade of `_portal-saver` mid-hydrate.
5. Manual `tmux set-option -s @portal-skeleton-<key>`.

No cleanup path currently exists. Once a marker leaks, it persists for the tmux server's lifetime.

### Impact

- **Severity:** High — silent corruption of persisted state; user-visible "zombie" sessions. **Business impact:** Trust regression on a core product promise (user controls their session list).
- **Scope:** All users running `portal state daemon`; triggers under any path producing a stale `@portal-skeleton-*` marker.
- **Manifestation:** Killed session reappears in `~/.config/portal/state/sessions.json` within one daemon tick (~1s under normal load; the daemon's `TickerPeriod` is 1s. The previously-cited "≤30s" figure refers to `MaxGap`, the forced-save fallback for idle systems, not the tick interval). No error or warning surfaces.
- **User-visible surfaces affected:** Any consumer that reads `sessions.json` sees the ghost session — including `internal/restore` (reconstructs ghost sessions on bootstrap), CLI list commands, and the TUI session picker after a restart.

### Empirical Confirmation

Live in-the-wild observation (2026-05-08): three specific sessions resurrected after kill — `agentic-workflows-XXrJ3J`, `leeovery-Gi5NLG`, `leeovery-feqhpg`. `tmux show-options -s` revealed exactly three matching stale `@portal-skeleton-*` markers (`agentic-workflows-XXrJ3J__1.1`, `leeovery-Gi5NLG__1.1`, `leeovery-feqhpg__1.1`). Killing an unmarkered session (`game-ideas`) did NOT resurrect it. Marker presence is necessary AND sufficient (given a daemon tick) for the resurrection symptom.

## Fix Component A: Live-Set Filtering in `mergeSkippedPanes`

**Location:** `internal/state/capture.go`

**Behavior change:** Before processing prev's panes, build a structural map from the fresh index — session names → per-session window indices → per-window pane indices. The merge proceeds for a given prev pane only when **all three structural levels** (session, window, pane) exist in the fresh index. A skeleton marker is no longer treated as authoritative; it only protects panes whose full structural path tmux still acknowledges.

### Data Flow / Signature Approach

The structural map (session names → window indices → pane indices) is **built locally inside `mergeSkippedPanes` from `idx.Sessions`** — the freshly-built index that is already in scope at the call site (`internal/state/capture.go:100`, where `mergeSkippedPanes(&idx, *prev, skipSet)` is invoked). This is preferred over threading `keep` (or another live-truth value) through the function signature because:

- `idx.Sessions` already contains the live tmux truth at this call site (built from `keep` immediately above on lines 85-96).
- Keeps the change internal to `mergeSkippedPanes` — no signature/caller updates required.
- Avoids surface-area changes to `mergePane` / `findOrAppendSession` which remain helpers of the merge.

The function may grow a small private helper (e.g. `buildLiveStructure(idx)` returning a nested map) but its public surface stays the same.

**Helper functions are untouched.** `mergePane` and `findOrAppendSession` (also in `internal/state/capture.go`) appear in Files Touched only because the merge logic in the same file is being edited; their behaviour and contracts are unchanged. Implementers should not add belt-and-braces defensive checks inside `mergePane` / `findOrAppendSession` — the filter at the merge entry point is the single point of enforcement.

### Filtering Levels

All three levels must filter, not just session:

- **Session level** — A prev session whose name is not in fresh must NOT be merged, even when its paneKey is in `skipSet`.
- **Window level** — A prev window that exists in `skipSet` but whose window index is not present in the (otherwise-live) fresh session must be dropped from the merge result.
- **Pane level** — A prev pane that exists in `skipSet` but whose pane index is not present in the (otherwise-live) fresh window must be dropped from the merge result.

Session-level filtering alone was rejected: the same defensive flaw exists at window and pane level — `kill-window` or `kill-pane` against a still-live session leaves the analogous resurrection path open.

### Self-Healing Behavior

Once `mergeSkippedPanes` no longer reintroduces dead sessions, `sessions.json` self-heals on the next daemon tick. The polluted `prev` from prior ticks is discarded when the dead session no longer survives the merge — `captureAndCommit` then commits the clean index, and `deps.PrevIndex = &idx` propagates clean state forward.

### Preserved Behavior

The merge's intended use case — hydrate-in-progress panes briefly invisible to `list-sessions` — must remain correct. Phase A of restore creates the session in tmux **before** the marker is set, so legitimate hydrate-in-progress panes always have their session/window/pane visible in the fresh enumeration. The filter is structurally distinct from this case and does not affect it.

### Rejected Alternatives

- **Pre-filter `skipSet` in `captureAndCommit`** — Costs an extra `ListSessionNames` tmux call per tick that `CaptureStructure` already makes internally; staleness is a merge-layer concern.
- **Drop "introduce missing session" merge behaviour entirely** — May break the legitimate hydrate-phase-A race where a skeleton-restored session is briefly invisible to list-sessions. Higher behavioural risk than targeted filtering.

## Fix Component B: Stale-Marker Cleanup Bootstrap Step

**Location:** New step in the bootstrap orchestrator (`cmd/bootstrap/`), inserted **between current step 6 (Clear `@portal-restoring`) and step 7 (SweepOrphanFIFOs)** — becoming the new step 7, with subsequent steps renumbered.

**Note on numbering:** The existing nine-step orchestrator has steps "5. Restore" → "6. Clear `@portal-restoring`" → "7. SweepOrphanFIFOs". The new cleanup step inserts between steps 6 and 7 in the existing sequence (i.e. after the restoring marker is cleared, before orphan FIFO sweep), pushing SweepOrphanFIFOs and later steps down by one.

### Behavior

1. Enumerate the live `@portal-skeleton-*` server-option markers via tmux.
2. Enumerate live tmux panes (paneKeys).
3. Compute the set difference: markers whose paneKey is **not** present in the live pane set.
4. For each stale marker, unset it via tmux (`set-option -us @portal-skeleton-<key>`).

### Soft-Warning Posture

Best-effort, mirrors the warning-soft semantics of the existing `CleanStale` step (step 8). Failure (tmux unavailable, individual unset error, live-pane enumeration error) surfaces as a soft warning collected by the orchestrator and drained post-bootstrap; it never escalates to a fatal abort.

**Mass-unset hazard guard:** The cleanup must never treat a silently-empty live-pane result as authoritative. If live-pane enumeration fails or returns zero panes due to tmux instability, the cleanup must skip the unset pass and emit a soft warning. The hazard guarded against: an empty live-pane set would cause **every** `@portal-skeleton-*` marker to be computed as stale, including markers protecting legitimate hydrate-in-progress panes — destabilising a still-live tmux server. The error-propagating live-pane call (above) is the primary defence; an explicit "if zero panes, skip cleanup" guard is recommended belt-and-braces if the runtime can plausibly observe zero live panes when markers exist.

### Concurrency with the Daemon

EnsureSaver (existing step 4) starts the `_portal-saver` session that hosts the daemon, so by the time the cleanup step runs the daemon may already be ticking. The cleanup step **does not require serialisation** with daemon ticks because Fix Component A neutralises the marker's authority over the merge — concurrent daemon reads of a marker about to be unset cannot resurrect a dead session, and the merge's structural filter rejects any prev session/window/pane no longer present in tmux regardless of marker state. Implementers should not add locks or sequencing constraints between the cleanup step and the daemon.

### Synergy with `SweepOrphanFIFOs`

The cleanup runs immediately before `SweepOrphanFIFOs` (step 7 of the existing sequence). `SweepOrphanFIFOs` removes orphan `hydrate-*.fifo` files whose paneKey is no longer represented by a live `@portal-skeleton-*` marker. Because the new step unsets stale markers immediately before the sweep, FIFOs whose markers were stale become eligible for sweep in the same bootstrap. **This compound cleanup is intentional** — both halves of a stale-marker / orphan-FIFO pair are reclaimed in one bootstrap rather than the orphan-FIFO sweep being indefinitely blocked by the stale marker that protects it.

### Behaviour Against Partial Restore Failures

The cleanup step runs after Restore (step 5) and Clear `@portal-restoring` (step 6). If Restore partially succeeded — some panes skeleton-restored and marked, others failed before reaching `setSkeletonMarker` — the cleanup operates only on markers that were successfully set. For markers whose corresponding session/window/pane is alive in tmux (the normal hydrate-in-progress case), the cleanup leaves them alone; for markers whose pane is not alive (genuinely stale), cleanup unsets them. **No special-casing of just-failed restore leftovers is required**: by the time cleanup runs, "stale" is observably defined as "no live pane for this paneKey", and that definition is correct regardless of how the staleness arose.

### Adapter Wiring

A new seam interface exposed by the bootstrap Orchestrator (recommended name `StaleMarkerCleaner` or similar; final name is an implementation detail consistent with adjacent bootstrap seams), with the production adapter in `bootstrapadapter` wiring concrete dependencies:

- **Marker enumeration** — `state.ListSkeletonMarkers` is the canonical source. It already returns a `map[string]struct{}` keyed by **paneKey** (the `<paneKey>` portion of `@portal-skeleton-<paneKey>`, with the prefix stripped). No additional parsing is required on the marker side.
- **Live pane enumeration** — Must use an **error-propagating** tmux call so that a tmux failure surfaces as a soft warning rather than a silently-empty result. `(*tmux.Client).ListAllPanes()` is **unsuitable** here because it swallows tmux errors and returns `([]string{}, nil)` on failure (`internal/tmux/tmux.go:551-557`); using it would cause every `@portal-skeleton-*` marker to be computed as stale and unset on tmux failure, including markers protecting genuinely live hydrate-in-progress panes. The cleanup step **must use `(*tmux.Client).ListAllPanesWithFormat(format)`** (which propagates errors per `internal/tmux/tmux.go:528-534`) with a format such as `#{session_name}:#{window_index}.#{pane_index}` and parse the result. On error from this call, the cleanup degrades to a soft warning per the Soft-Warning Posture below — it must never fall through to "live pane set is empty, therefore unset all markers".

- **PaneKey conversion** — Each live-pane entry from the format string above is of form `session:window.pane` (e.g. `my-session:0.1`). The cleanup step **must convert each entry to canonical paneKey form** via `state.SanitizePaneKey(session, window, pane)` (which produces `session__window.pane` form, e.g. `my-session__0.1`) before computing the set difference. Without this conversion the two sides have incompatible separators (`:` vs `__`) and the diff is meaningless.

  **Parse contract for `session:window.pane`:**
  - Split on the **rightmost** `:` (tmux session names may contain `:`; the rightmost `:` separates session from `window.pane`).
  - Split the right half on `.` to obtain `window` and `pane` strings.
  - Parse `window` and `pane` as integers via `strconv.Atoi`.
  - On parse failure for any line, **skip that line** (do not abort cleanup; do not include it in the live-pane set; emit a soft warning if the failure is unexpected). A malformed line must not cause cleanup to mass-unset markers.
  - Whether to extract this parse + sanitize as a shared helper or inline it in the cleanup step is an implementation choice; the contract above is what matters.
- **Marker unset** — `(*tmux.Client).UnsetServerOption(name)` with the full option name `@portal-skeleton-<paneKey>` (i.e. the `SkeletonMarkerPrefix` constant followed by the canonical paneKey).

The seam should expose three methods (one per responsibility) so each can be mocked independently in tests; whether they live on a single composite interface or three small interfaces is an implementation choice consistent with existing bootstrap conventions. Tests exercise the seam with mock implementations following the existing `bootstrap` testing pattern.

### Why This Step Is Needed

Fix Component A alone resolves the user-visible resurrection symptom because `sessions.json` self-heals once the merge filter rejects dead sessions. However, a quieter side-effect remains: while a marker is live for a paneKey, the daemon's capture loop **skips scrollback save** for that pane (`cmd/state_daemon.go:131-133`). For panes whose markers leaked but whose underlying sessions are still alive (or were re-created with the same key), scrollback content is silently not being saved. The cleanup step closes this gap and prevents indefinite marker accumulation across the tmux server's lifetime.

### Rejected Alternative

- **Defer marker cleanup to a separate work unit** — Rejected per user direction. The scrollback-save side effect is real for users now; bundling produces the cleaner outcome and both changes are local to layers already in scope for the merge logic.

## Testing Requirements

### Existing Tests to Replace

**`internal/state/capture_test.go:570-617`** — The test `TestCaptureStructureMergeSkippedPanes/merges a skipped pane's session and window from prev when missing from fresh` codifies the buggy behaviour as correct and **must be replaced** with its inverse:

> A prev session whose name is not in fresh must NOT be merged, even when its paneKey is in `skipSet`.

### Tests to Add

**Merge filter — structural-level tests:**
- Window-level filtering: a marker for a window that exists in prev but not in fresh (within an otherwise-live session) must be dropped from the merge result.
- Pane-level filtering: a marker for a pane that exists in prev but not in fresh (within an otherwise-live window) must be dropped from the merge result.

**Merge filter — regression test mirroring the empirical scenario:**
- Marker set, session killed, daemon tick → fresh capture must NOT reintroduce the session.

**Stale-marker cleanup — unit:**
- Given a marker whose paneKey doesn't correspond to a live pane, the cleanup unsets it.
- Given a live marker (paneKey still corresponds to a live pane), the cleanup leaves it alone.
- **PaneKey normalisation correctness:** test fixture must mix tmux's `session:window.pane` form (live-pane side) with canonical `session__window.pane` form (marker side) and assert that the same logical pane is recognised across both sides. A complementary negative test where two paneKeys differ only by separator must not be treated as equivalent. This guards against a regression where the `state.SanitizePaneKey` conversion is dropped, applied to the wrong side, or replaced with a naive string equality.

Unit tests for the cleanup function should be co-located with the new step's implementation file in `cmd/bootstrap/` (e.g. `cmd/bootstrap/<new-step>_test.go`).

**Stale-marker cleanup — bootstrap integration:**
- The new cleanup step runs at the right point in the orchestrator sequence (after step 6 "Clear `@portal-restoring`", before existing step 7 SweepOrphanFIFOs).
- The cleanup degrades to a warning on tmux failure, matching the soft-warning posture of `CleanStale`.

### Tests to Preserve

- Existing happy-path skeleton-marker tests in `internal/restore/session_markers_test.go` — the fix must not regress legitimate hydrate-in-progress merge behaviour.

## Acceptance Criteria

The fix is complete when:

1. The synthetic repro (set marker, kill session, wait one daemon tick) does **not** reintroduce the killed session into `sessions.json`. **Test setup precondition:** `mergeSkippedPanes` is gated on `prev != nil` and only resurrects sessions present in `prev.Sessions`. The regression test must establish this state before kill — either by seeding `prev.Sessions` directly in the test harness, or by allowing one daemon tick to capture-and-commit the session before the kill. **Risk if skipped:** a test that runs kill-then-tick without prior `prev` population will pass on the buggy code (false-green), so this precondition is load-bearing for the regression test's value.
2. The user's empirical scenario (the three resurrecting sessions with matching stale markers) does not recur after applying both Fix Component A and Fix Component B.
3. `sessions.json` self-heals on the next daemon tick after a previously-polluted commit (the polluted `prev` no longer perpetuates dead sessions).
4. After a successful bootstrap (cleanup step did not surface a soft warning), no `@portal-skeleton-*` marker exists for a paneKey that has no corresponding live pane. When the cleanup step degrades to a soft warning (e.g. tmux temporarily unavailable), markers may legitimately remain — the warning is the user-visible signal, and the next successful bootstrap completes the cleanup.
5. While a stale marker exists between daemon ticks (before bootstrap cleanup runs), the merge filter prevents resurrection regardless of marker staleness.
6. The legitimate hydrate-in-progress flow remains correct — phase A skeleton-restored panes (marker set, session/window/pane present in tmux) are still merged from prev as expected.
7. All new tests pass; the previously-buggy test is replaced; existing happy-path tests remain green.
8. **Scrollback-save resumption** — After the cleanup step unsets a stale marker whose underlying pane is still live (the case where a marker leaked but the pane was retained or re-created), the next daemon tick saves scrollback for that pane (i.e. the skip-save guard at `cmd/state_daemon.go:131-133` no longer applies). This verifies the secondary harm closed by Fix Component B (scrollback save was being silently skipped for live-marker panes) is actually resolved, not merely the resurrection symptom.

## Why This Bug Wasn't Caught

1. **Existing test codifies the buggy behaviour** — The unit test `TestCaptureStructureMergeSkippedPanes/merges a skipped pane's session and window from prev when missing from fresh` (`internal/state/capture_test.go:570-617`) explicitly asserts the buggy behaviour as correct, codifying the wrong invariant.
2. **Original spec scope** — The original `built-in-session-resurrection` spec framed merge intent around the hydrate-in-progress scenario without modelling marker-staleness adversarial cases.
3. **Integration test coverage gap** — The `built-in-session-resurrection` feature integration tests exercise the happy-path skeleton → hydrate flow, not the killed-mid-flight path.
4. **Difficult to reproduce in CI** — Reproducing in the wild requires either a hydrate failure (hard to engineer in CI) or a manual marker injection, so the bug was unlikely to surface during normal QA.

These rationales justify why this work unit must add **adversarial marker-staleness tests** and **killed-mid-flight regression tests** beyond simply replacing the existing buggy test.

## Scope and Risk

### In Scope

Both changes are local to layers already in scope for the merge logic — they compose without architectural surgery:

- **Fix Component A** — Live-set filtering in `mergeSkippedPanes` (`internal/state/capture.go`). Estimated ~15 lines (session/window/pane filtering). The figure is illustrative, not a scope budget.
- **Fix Component B** — New stale-marker cleanup bootstrap step. Estimated ~50 lines including adapter wiring, plus orchestrator sequence and test updates. The figure is illustrative, not a scope budget.

### Files Touched

- `internal/state/capture.go` — `mergeSkippedPanes`, `mergePane`, `findOrAppendSession`.
- `internal/state/capture_test.go` — replace the codifying-bug test; add new structural-level and regression tests.
- `cmd/bootstrap/` — orchestrator sequence (insert new step), seam interface for marker cleanup, and the new step's implementation file plus its co-located `_test.go` (unit tests for cleanup behaviour and paneKey normalisation correctness).
- `internal/bootstrapadapter/` — production adapter wiring for the cleanup step.
- `cmd/bootstrap/bootstrap_test.go` — orchestrator sequence and soft-warning behaviour for the new step.
- `internal/bootstrapadapter/adapters_test.go` — production adapter wiring for the new seam.

### Regression Risk

**Low.** Every consumer of `sessions.json` and the daemon's `prev` was traced; no caller depends on the buggy "merge can introduce arbitrary prev sessions" behaviour. The merge's intended use case (hydrate-in-progress) is structurally distinct from the bug surface and remains correct because phase A creates sessions in tmux before setting markers.

### Release Posture

**Regular release.** No hotfix needed — the symptom is recoverable (kill the same session twice, or restart the tmux server) and a manual workaround exists for affected users (`tmux set-option -us @portal-skeleton-<key>`).

## Out of Scope

### Companion Bug

The companion bug `killed-sessions-resurrect-on-restart` (logged 2026-05-08) is the most likely producer of stale markers in normal use, but it lives in a different layer (`cmd/state_hydrate.go` / `cmd/state_signal_hydrate.go`) and is independently scoped. **This work unit does not depend on it; the fixes are orthogonal.**

This bug is independently wrong from the companion hydrate-cascade bug. Even with a perfect FIFO IPC, markers can become stale via process crashes, version-upgrade restart, or manual tmux operations. The merge logic should not assume marker validity on the user's behalf — that property must hold regardless of how the companion bug is eventually resolved.

### Marker Production Path

This work unit does not modify the marker-set path (`internal/restore/session.go:380-384` `setSkeletonMarker`) or the marker-unset path (`cmd/state_hydrate.go:312` `UnsetSkeletonMarkerForFIFO`). The fix is defensive: it accepts that markers can leak and ensures the consumer (merge) and one new periodic cleanup (bootstrap) handle stale markers correctly.

## Code Context

### Affected Code Path

**Entry point:** `tick` in `cmd/state_daemon.go:77` — fires every 1s in the `_portal-saver` daemon.

**Execution path (where the bug surfaces):**

1. `cmd/state_daemon.go:115` — `captureAndCommit` reads the marker set: `skipSet, err := state.ListSkeletonMarkers(deps.Client)`. The full set of `@portal-skeleton-<paneKey>` server options regardless of whether the underlying session still exists.
2. `cmd/state_daemon.go:121` — calls `state.CaptureStructure(deps.Client, skipSet, deps.PrevIndex)`.
3. `internal/state/capture.go:62-106` — `CaptureStructure`:
   - Line 66: `ListSessionNames` → live tmux session names.
   - Line 71: `keepSessionNames` strips internal-prefix → set of live, non-internal session names. **This is the live-session truth.**
   - Lines 85-96: builds the fresh `[]Session` from `keep`. Killed sessions are correctly absent here.
   - Line 100: `if len(skipSet) > 0 && prev != nil { mergeSkippedPanes(&idx, *prev, skipSet) }` — **the bug surface.**
4. `internal/state/capture.go:117-130` — `mergeSkippedPanes` iterates `prev.Sessions` and for each pane whose `SanitizePaneKey` is in `skipSet`, calls `mergePane`. **No reference to `keep` or `idx.Sessions` for live-session validation.**
5. `internal/state/capture.go:137-148` — `mergePane` → `findOrAppendSession` (line 154) — the dead session is re-created in `idx.Sessions` if not present.
6. After `CaptureStructure` returns, `captureAndCommit` writes the polluted index to `sessions.json` via `state.Commit` (line 152) and updates `deps.PrevIndex = &idx` (line 156). **The dead session is now part of `prev` for every subsequent tick — bug self-sustains.**
7. Next bootstrap (`cmd/bootstrap` step 5, Restore) reads `sessions.json` and reconstructs the dead session.

### Key Files

- `internal/state/capture.go` — `mergeSkippedPanes`, `mergePane`, `findOrAppendSession`. The defective layer (Fix Component A target).
- `cmd/state_daemon.go` — `captureAndCommit`, `tick`. Caller; updates `PrevIndex` to the committed index every tick.
- `internal/state/markers.go` — `ListSkeletonMarkers`. Faithfully reads markers; not at fault.
- `cmd/bootstrap/` — orchestrator sequence (Fix Component B insertion point).
- `internal/bootstrapadapter/` — production adapter wiring (Fix Component B target).

### Marker Lifecycle

- **Set** — `internal/restore/session.go:380-384` (`setSkeletonMarker` → `state.SetSkeletonMarker`) during bootstrap step 5 skeleton restore.
- **Unset (intended path)** — `cmd/state_hydrate.go:312` (`UnsetSkeletonMarkerForFIFO`) after scrollback replay completes.
- **Unset (new path, this work unit)** — bootstrap stale-marker cleanup step (Fix Component B), unsetting markers whose paneKey has no live pane.
- **Scope** — Server-scoped (`set-option -s`), persisting across hydrate failures, daemon restarts, manual tmux ops. Indefinite if no cleanup runs.

### Reproduction Steps (Synthetic)

Does not require triggering the hydrate cascade:

1. Inside a live tmux server with `portal state daemon` running, identify an existing pane and its paneKey. **Precondition:** the daemon must have already captured-and-committed this session at least once so it lives in `prev.Sessions` — typically guaranteed if the session has existed long enough for one tick (~1s).
2. Set the marker manually: `tmux set-option -s @portal-skeleton-<paneKey> 1`
3. `tmux kill-session -t <session>` against the session containing that pane.
4. Wait one daemon tick (~1s; up to ≤30s on idle systems where `MaxGap` is the bound).
5. Inspect `~/.config/portal/state/sessions.json` — the killed session is present (pre-fix) / absent (post-fix).

**Reproducibility:** Always, given the marker set + session killed conditions.

### Contributing Factors That Make the Bug Self-Sustaining

- Marker is server-scoped, persisting across hydrate failures, daemon restarts, and manual tmux ops.
- `prev` in `captureAndCommit` is replaced with the just-committed index every successful tick (`cmd/state_daemon.go:156`), so once a dead session is committed once, it lives in `prev` indefinitely — self-sustaining even if the marker were later cleared.
- No marker cleanup path in bootstrap. `SweepOrphanFIFOs` cleans orphan FIFOs but not the markers that point at them; `CleanStale` cleans hook entries but not markers.
- The merge currently has no live-session cross-check — `keep` (the live-tmux truth at line 71 of `CaptureStructure`) is not threaded into `mergeSkippedPanes`.

---

## Working Notes
