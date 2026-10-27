# Specification: Killed Session Resurrects Within Tick Window

## Specification

## Problem Statement

When a Portal-managed tmux session is killed (via TUI `K` confirm flow, `portal kill`, the user's `Option-Q` binding, tmux's `M-q` keymap, or external `tmux kill-session`), a subsequent `portal` invocation within ~2–5 seconds:

- Still lists the killed session in the TUI Sessions page.
- Triggers bootstrap step 5 `Restore` to reconstruct the session in tmux as a skeleton pane.

After roughly one daemon tick (~5s on affected scrollback profiles) the session disappears from both surfaces. The symptom is reliably reproducible given the timing window.

## Required Behavior After Fix

For every kill path — TUI `K`, `portal kill`, `Option-Q`, `M-q`, external `tmux kill-session` — the following must hold immediately after the kill (no sleep, no retry):

1. `sessions.json` on disk no longer contains the killed session.
2. A subsequent `portal` invocation does not list the killed session.
3. Bootstrap step 5 `Restore` does not reconstruct the killed session.

The kill must be authoritative and immediate from the user's point of view. "Eventual consistency on the order of one daemon tick" is unacceptable for kill events.

## Severity Classification

High (trust tier). Same user-visible "I killed this, and Portal brought it back" surface as two recently-shipped resurrection-class bugfixes (`daemon-merge-reintroduces-dead-sessions`, `killed-sessions-resurrect-on-restart`). Symptom is recoverable today by waiting ~5s, so regular release posture — no hotfix.

## Root Cause

`sessions.json` is rewritten **eventually**, not synchronously with kills.

The kill-event plumbing today:

1. Any kill path causes tmux to fire the `session-closed` global hook.
2. The hook runs `portal state notify`, which by deliberate design performs **zero tmux calls and zero `sessions.json` writes** — it creates/truncates `save.requested` (the daemon's dirty flag) and exits.
3. The daemon's 1-second ticker observes the dirty flag, then runs `captureAndCommit`, which walks all panes, captures and hashes scrollback per-pane, and atomically rewrites `sessions.json`. Per-tick wall time scales with rendered scrollback — field-measured ≥3.9–5s on the affected user profile.

The race window is `[0, ticker.period + per-tick wall time]`, bounded above only by worst per-tick capture latency.

Bootstrap step 5 `Restore` reads `sessions.json` on every Portal invocation. During the race window, the consumer-side contract — "if it's in `sessions.json` and not in live tmux, restore it" — faithfully reconstructs the killed session because the file still lists it.

The merge filter shipped by `daemon-merge-reintroduces-dead-sessions` is doing its job: it correctly drops dead sessions from the previous index during the daemon's commit. That fix operates **inside** the daemon's tick. The bug here is that the consumer (`Restore`) runs **before** the daemon ticks at all. This bugfix is therefore a sibling, not a regression, of the two recently-shipped resurrection-class fixes.

### Contributing Factors Worth Preserving

- The daemon's tick is uninterruptible — `ctx.Done()` is unreachable inside an in-flight `tick()`, so dirty-flag immediacy does not translate to commit immediacy.
- The daemon may not be running at all. `_portal-saver` is best-effort (bootstrap step 4 surfaces `SaverDownWarning` on failure). With the daemon down, `save.requested` is touched but no commit happens until the next bootstrap, extending the resurrection window from seconds to "until the next Portal start".
- Same-process kill paths (TUI `K`, `portal kill`) call `tmux.KillSession` and return without a synchronous commit — they rely on the same eventual-consistency contract as external kills.

## Fix Approach

Make the `session-closed` tmux hook **synchronously rewrite `sessions.json`** before the hook subprocess returns.

### Mechanism

A new minimal-cost capture-and-commit path that:

1. Reads the existing `sessions.json` from disk via `state.ReadIndex` and passes it as `PrevIndex` to `state.CaptureStructure`. This preserves the scrollback-hash and per-pane content fields that `CaptureStructure` itself does not regenerate (because no scrollback work is done in this path), so live sessions retain full schema fidelity. Dead sessions are filtered out by `mergeSkippedPanes`'s live-structure rule regardless of `PrevIndex` contents.

   **`PrevIndex` resolution failure modes:** if `sessions.json` does not exist yet (first-ever invocation on a fresh install before bootstrap has written one) **or** if the file exists but cannot be decoded (corruption, partial write), `commit-now` proceeds with a zero-value `PrevIndex`, logs a WARN-level event via the state logger (see § Logging Discipline), and completes the structural commit normally. The daemon's next tick will repopulate scrollback-hash fields for the live sessions; the primary goal of the synchronous path — removing the killed session from `sessions.json` — is satisfied regardless of `PrevIndex` availability. A `ReadIndex` failure is **not** treated as a `commit-now` failure exit.
2. Captures the current structural index via `state.CaptureStructure` (no scrollback content, no hash work).
3. Atomically commits via `state.Commit(dir, idx, anyScrollbackChanged=false, logger)` — the `anyScrollbackChanged` argument is hard-coded to `false` because the sync path writes no `.bin` files.
4. Short-circuits as a no-op when `@portal-restoring` is set on the tmux server (defers to the daemon's existing restoration discipline).

This path uses **only existing primitives**. `state.CaptureStructure` already takes a `CaptureClient` interface satisfied by `*tmux.Client` — it is not daemon-exclusive. `state.Commit` is already the atomic-write primitive used by the daemon and is structurally available to any caller.

### Where the Synchronous Commit Lives

The new path is invoked from the kill-side hook context as a short-lived `portal state ...` subprocess (matching the existing `portal state notify` pattern). See § Entry-Point Design Decision for the resolved shape (`portal state commit-now`).

### What Stays Eventually Consistent

The six other save-trigger events keep the existing cheap dirty-flag touch (`portal state notify`):

- `session-created`
- `session-renamed`
- `window-linked`
- `window-unlinked`
- `window-layout-changed`
- `pane-focus-out`

These are creates, renames, and focus changes — none can produce a "consumer sees a session that no longer exists" symptom. Eventual consistency on the daemon's tick is correct and acceptable for them, and raising their cost from a 2-syscall touch to a full structural capture is gratuitous.

### What's Excluded from the Synchronous Path

- **Scrollback `.bin` writes and hash work.** The synchronous path only writes `sessions.json`. The daemon retains exclusive ownership of `.bin` file writes, content hashing, and `gcOrphanScrollback`.
- **Marker management.** `@portal-skeleton-*` server-option markers continue to be managed by the daemon and the existing bootstrap/restore lifecycle.
- **Per-pane environment beyond what `CaptureStructure` already captures.** No new tmux work is added.

### Why This Approach

The user's explicit directive: synchronous at the kill-side path, eliminate the race at its source. The `session-closed` hook is the single tmux-side seam that fires uniformly across **all** kill paths — cmd-internal (TUI `K`, `portal kill`) and external (`Option-Q`, `M-q`, `tmux kill-session`). Making it the synchronous commit point covers every kill path with one change:

- No new IPC.
- No daemon dependency for kill-path correctness — the synchronous commit works even when `_portal-saver` is down.
- No timeout window to size against scrollback profile.
- No ticker rate or retry tuning.

After the fix, every kill path produces a consistent `sessions.json` before the kill-triggered hook subprocess returns, eliminating the race window for the resurrection symptom.

### Cost Profile

Per-kill subprocess cost: one `ListSessionNames` + one `list-panes -a -F …` + per-session `ShowEnvironment` + one atomic file write. Estimated ~50–200ms. This is per-kill, not per-keypress; acceptable cost on a path that previously was free.

## Entry-Point Design Decision

The synchronous capture-and-commit path is exposed as a **new sibling subcommand**: `portal state commit-now`.

### Final Shape

```
portal state commit-now     # captures structural index, atomically rewrites sessions.json, exits
portal state notify         # unchanged: touches save.requested, exits
```

### Why V1 Over V2 (`portal state notify --sync`)

The two commands have **disjoint internal logic** — they don't share a handler:

- `notify` performs zero tmux calls and zero `sessions.json` writes. It opens/truncates `save.requested` and exits. It does not *do* the save; it asks the daemon to.
- `commit-now` calls `state.CaptureStructure` (live tmux queries) and `state.Commit` (atomic write of `sessions.json`), bypassing the daemon entirely.

These are two different operations that happen to converge on the same file eventually, not the same operation in different wait modes. Sharing a verb parameterised by a flag would understate that separation.

Additional supporting points:

- The sync path has an `@portal-restoring` short-circuit; `notify` does not (it touches the flag freely during restoration — the daemon honours the marker). The no-op semantics diverge, so the flag would gate an entire alternate codepath, not a wait mode.
- A named verb composes better with potential future callers (`portal save`, `portal kill --commit`) than a flag on `notify`.

### Trade-Offs Accepted

- One additional top-level verb under `portal state`. This is the explicit cost of semantic clarity.
- Marginally wider cmd-surface change (new file `cmd/state_commit_now.go` alongside `cmd/state_notify.go`).

## Hook Registration Migration

### Today

`internal/tmux/hooks_register.go` defines:

```go
var saveTriggerEvents = []string{
    "session-created", "session-closed", "session-renamed",
    "window-linked", "window-unlinked", "window-layout-changed",
    "pane-focus-out",
}
const notifyCommand = `run-shell "command -v portal >/dev/null 2>&1 && portal state notify"`
```

`RegisterPortalHooks` (bootstrap step 2) idempotently appends `notifyCommand` to each event in `saveTriggerEvents`. All seven events fire the same dirty-flag touch.

### After Fix

`session-closed` migrates off the shared `notifyCommand` and onto a new command that invokes the synchronous commit:

```go
const commitNowCommand = `run-shell "command -v portal >/dev/null 2>&1 && portal state commit-now"`
```

The other six save-trigger events remain on `notifyCommand` unchanged.

### Registration Strategy: Replace (not Alongside)

`session-closed` is registered with **only** `commitNowCommand`, not both `commitNowCommand` and `notifyCommand`. Running both would do redundant work — `commit-now` already writes `sessions.json` synchronously, making the dirty-flag touch obsolete for this event. The daemon's next tick after a kill would just re-confirm a state that's already on disk.

### Idempotency Requirements

`RegisterPortalHooks` must remain idempotent across multiple bootstrap invocations:

- A repeat bootstrap must not append `commitNowCommand` twice to `session-closed`.
- A bootstrap upgrade from a pre-fix Portal install that left `notifyCommand` registered on `session-closed` must:
  1. Remove the stale `notifyCommand` registration from `session-closed`.
  2. Register `commitNowCommand` in its place.

### Migration Algorithm

The upgrade requires more than the existing append-if-absent idempotency — it must also remove a stale entry. Using the existing tmux-client primitives (`ShowGlobalHooks`, `AppendGlobalHook`, `UnsetGlobalHookAt`), the algorithm for `session-closed` is:

1. Call `ShowGlobalHooks` to enumerate the currently-registered hook entries across all events, filter in-process to entries for `session-closed`. (Per `CLAUDE.md`, `ShowGlobalHooks` is the available enumeration primitive; no per-event variant is assumed to exist.)
2. Scan the entries. For each entry whose body **exact-string matches** the historical pre-fix `notifyCommand` literal — `run-shell "command -v portal >/dev/null 2>&1 && portal state notify"` — record its index and call `UnsetGlobalHookAt(event, index)`. Indices must be processed highest-first so removal does not shift the remaining indices.
3. After removal, scan the resulting entries again. If none **exact-string match** the `commitNowCommand` literal — `run-shell "command -v portal >/dev/null 2>&1 && portal state commit-now"` — call `AppendGlobalHook(event, commitNowCommand)`.

**Why exact-string match (not substring/regex):** an exact-string comparison against the historical Portal-emitted literal is robust against accidentally removing user-customised hand-rolled hooks (e.g., `run-shell "portal state notify --debug"` or a script wrapper invoking `portal state notify`). Tolerating quoting drift would create false positives. If a historical Portal version emitted a textually different `notifyCommand` literal, that exact string is added to the match set (the spec assumes a single historical literal until proven otherwise).

For the six other save-trigger events, the existing append-if-absent discipline is unchanged — no scan-and-remove pass is needed.

This algorithm is idempotent: re-running it on a post-fix install produces no changes (no stale entries to remove, `commitNowCommand` already present).

### Why `session-closed` Is The Right Hook

It is the **single tmux-side seam that fires uniformly across all kill paths**:

| Kill path | Trigger |
|---|---|
| TUI `K` confirm | `tmux.KillSession` → tmux fires `session-closed` |
| `portal kill` | `tmux.KillSession` → tmux fires `session-closed` |
| `Option-Q` user binding | tmux's `kill-session` → fires `session-closed` |
| `M-q` tmux default | tmux's `kill-session` → fires `session-closed` |
| External `tmux kill-session` | tmux fires `session-closed` |

Migrating this one event covers every kill path without per-call-site changes in the cmd layer.

## Invariants & Edge Cases

### `@portal-restoring` Defence (Required)

`portal state commit-now` **must short-circuit as a no-op** when the `@portal-restoring` server option is set on the tmux server.

Rationale: during bootstrap step 5 `Restore`, the marker is set deliberately to suppress writers from racing the reconstruction. `_portal-saver` version-upgrade (bootstrap step 4) can fire `session-closed` while restoration is still in progress. A synchronous commit at that moment would write a partial skeleton state and corrupt the in-flight restore.

The daemon already honours this marker in its tick loop (`tick()` returns early if `restoring`). `commit-now` adopts the identical discipline: read `@portal-restoring`, return immediately if set, log the skip at INFO via the existing `state` package structured logger.

### Logging Discipline

`commit-now` runs as a tmux hook subprocess. There is no attached terminal or in-process consumer for its stderr, so all `commit-now` output (info-level skips, error-level failures, structured events) goes through the **existing state-package structured logger** (file-backed, written under the state directory — the same sink the daemon uses).

`commit-now` uses **the same component constant the daemon uses for `sessions.json` captures**. This keeps daemon-driven and hook-driven captures in the same log stream for diagnosis. The constant is not renamed; if it is named `ComponentDaemon` today, `commit-now` adopts it as-is.

The hook subprocess's stdout/stderr are not relied upon for diagnostic information. Anything written to them is best-effort and may be discarded by tmux's hook execution context.

### `_portal-saver` Self-Kill (Documented, No Code Change)

`_portal-saver` self-kill fires `session-closed` in two distinct timelines, each protected by a **different mechanism**. Both protections are required and orthogonal — neither subsumes the other.

**Timeline 1 — Bootstrap step 4 version-upgrade (`@portal-restoring` is set):**

When `_portal-saver` is killed for a version upgrade during bootstrap, the `@portal-restoring` marker is set. `commit-now`'s short-circuit fires and returns without writing `sessions.json`. The protection here is the **restoring-window short-circuit** (see `@portal-restoring` Defence above).

Per the `save.requested` Discipline, the short-circuit also touches `save.requested` on its way out. This means **every bootstrap step 4 version-upgrade queues a daemon commit for the first post-restoration tick**. This is intentional and desired: by the time `@portal-restoring` is cleared in bootstrap step 7, the daemon's first scheduled tick reads the dirty flag and commits the post-restoration `sessions.json` immediately, rather than waiting up to 30 seconds for the `gap` rule to fire. The extra tick is one of many normal post-restoration ticks the daemon was always going to run; the dirty-flag touch just promotes the earliest one from "skip" to "commit." No extra wall time or work is added at the user-visible level.

**Timeline 2 — Steady-state user-kill (`@portal-restoring` is clear):**

When the user kills `_portal-saver` outside of bootstrap (e.g. manual debugging), the marker is clear. `commit-now` proceeds normally. `state.CaptureStructure`'s `keepSessionNames` filter excludes underscore-prefixed sessions, so the resulting structural index omits `_portal-saver` — same as today's daemon-driven captures. The protection here is the **underscore-prefix filter**.

**Invariant to document, not change:** the underscore-prefix filter in `keepSessionNames` is the single source of truth for which sessions are persisted to `sessions.json`. Both the daemon's tick and `commit-now` rely on it. This filter must not be moved, special-cased, or bypassed in the synchronous commit path.

### Daemon vs Hook Narrow Race (Accepted Residual)

Both writers (`commit-now` and the daemon's `tick`) re-query live tmux via `CaptureStructure → ListSessionNames` as their first step. In the common case, both observe identical post-kill state. `state.Commit`'s atomic write (temp + rename) means the final on-disk state is always one of N consistent snapshots, never torn.

A **sub-millisecond edge window** exists where the daemon's `ListSessionNames` could return just before tmux completes the kill, while a concurrent `commit-now` (triggered by the same kill) observes the post-kill state. In that window, the daemon's subsequent commit might briefly overwrite the correct `commit-now` output with a stale view.

This window is bounded by:

1. The daemon's next commit picks up the post-kill `ListSessionNames` result, correcting the file.
2. The window is sub-millisecond — orders of magnitude shorter than the multi-second symptom the fix targets.

**Accepted as residual.** Documented but not blocked on. No additional locking, no IPC, no daemon-side wait for `commit-now` to finish. This residual does not reproduce the original symptom — at worst it briefly re-stales the file, recovered on the next tick.

### Concurrent `commit-now` Invocations (Safe by Atomic Rename)

Rapid-fire kills — a user killing multiple sessions in quick succession, or a script-driven mass kill — fire `session-closed` multiple times within milliseconds, spawning concurrent `commit-now` subprocesses. Each subprocess independently calls `state.CaptureStructure` (tmux serialises server-side requests, so each gets a consistent view of live state at its own moment) and `state.Commit` (temp file + rename — atomic on POSIX).

The atomic temp+rename pattern guarantees the on-disk `sessions.json` is **always one of N consistent snapshots**, never a torn write. Last-writer-wins, and every potential winner reflects a real moment of live tmux state with the cumulative kills already applied. No additional file-level locking is required between concurrent `commit-now` invocations.

### Hook Re-entrancy (Validate in Plan/Implementation Phase)

`commit-now` makes tmux client calls (`ListSessionNames`, `list-panes -a -F …`, per-session `ShowEnvironment`) back into the same tmux server from within the `session-closed` hook context. `pane-focus-out` and `session-renamed` have historical re-entrancy quirks in the tmux server; `session-closed` is less suspect but not pre-validated for this specific call pattern.

**Requirement on plan/implementation phase:** a real-tmux integration test fixture must confirm no deadlock or hang occurs when `commit-now` runs from inside the `session-closed` hook. The test must be written and passing **before** the rest of the implementation work is taken as complete.

**On re-entrancy test failure:** the work unit returns to the specification phase, not the implementation phase. The chosen mechanism (synchronous tmux calls from within the hook subprocess) is structurally dependent on tmux tolerating this re-entrancy pattern; if it doesn't, the fix shape has to be redesigned (e.g., deferring the tmux work via `tmux run-shell`, or moving the synchronous write to a non-hook seam), which is a spec-level decision, not an implementation-level pivot. Pre-locking a fallback before validation would commit to a design whose merits we can't yet weigh.

### Daemon Merge Interaction (Verified Safe)

The daemon's next tick after a `commit-now` invocation will run `captureAndCommit` with a `PrevIndex` (the in-memory previous-tick view) that may be staler than the just-written `sessions.json`. `mergeSkippedPanes` (`internal/state/capture.go`) filters by **live structure**, not by `PrevIndex` — it only retains prev panes that are also present in the fresh capture. The killed session won't be in fresh, so it won't be re-introduced regardless of `PrevIndex` staleness.

**Verdict:** safe by inspection. No code change required. Documented here so future readers don't re-litigate.

### Scrollback `.bin` Ownership (Unchanged)

`.bin` files for the killed session are not deleted by `commit-now`. They are reclaimed by `gcOrphanScrollback` on the daemon's next successful tick. The synchronous path's `sessions.json` rewrite is sufficient to suppress the resurrection symptom; orphan `.bin` cleanup remains the daemon's responsibility.

### `commit-now` Failure Behaviour

If `commit-now` fails (tmux unreachable, disk error, etc.), it must:

1. **Touch `save.requested` before exiting.** This is the explicit fallback that hands recovery to the daemon. Without this touch, the daemon's tick body short-circuits unless either `save.requested` is set or the 30-second `gap` has elapsed — leaving the resurrection window open for up to 30 seconds on failure. Touching the flag guarantees the daemon's next scheduled tick (within 1s) will commit.
2. Exit non-zero so the failure is logged in tmux's hook subprocess context.
3. **Not** propagate the failure back to the kill — tmux has already removed the session; the kill is authoritative regardless of Portal's persistence success.

### `save.requested` Discipline

`commit-now` touches `save.requested` on **every exit path except a successful sync commit**:

- **Successful sync commit (exit 0):** `sessions.json` is already current; no daemon work is needed. `save.requested` is **not** touched (avoids a redundant daemon tick).
- **Failure exit (exit non-zero):** `save.requested` is touched (see above).
- **`@portal-restoring` short-circuit (exit 0):** `save.requested` is touched. The daemon honours the marker too, so the flag queues a commit for the daemon's first post-restoration tick — without it, the daemon could skip ticks (via the `dirty || gap` rule) until the 30s gap is reached, briefly leaving `sessions.json` stale after restoration completes.

This discipline keeps the common path (successful sync commit) free of daemon work while guaranteeing bounded recovery on every error or skip path.

### Exit Code Summary

| Outcome | Exit code |
|---|---|
| Successful sync commit | 0 |
| `@portal-restoring` short-circuit (deliberate skip) | 0 |
| Failure (tmux unreachable, disk error, etc.) | non-zero |

The short-circuit is a normal completion path, not an error condition; exit 0 reflects that the command did exactly what its `@portal-restoring` defence prescribed.

### `save.requested` Touch Failure Handling

If touching `save.requested` itself fails (disk full, permission denied, state directory missing), the touch is **best-effort**: log the failure via the state logger and continue to the chosen exit. Do not nest error handling, do not panic, do not propagate. The original `commit-now` outcome determines the exit code:

- Failure path with `save.requested` touch error → still exit non-zero (the original failure dominates).
- Short-circuit path with `save.requested` touch error → still exit 0 (the deliberate skip dominates; the daemon's `gap` rule provides a 30-second worst-case fallback).

This is a recovery-of-last-resort layer and the spec accepts that if both the synchronous commit and the dirty-flag fallback fail, the next Portal bootstrap will capture fresh state on its own.

The fix does not introduce a kill-blocking failure mode. The kill always succeeds; persistence is best-effort with strong success in the common case.

### Consumer-Side Untouched

`internal/restore/restore.go` and `internal/restore/session.go` are not modified. The `Restore` contract ("if it's in `sessions.json` and not in live tmux, restore it") remains correct given a current `sessions.json`. The fix targets the writer, not the reader.

## Out of Scope / Non-Goals

The following are deliberately excluded from this bugfix. Each item below was either explored and rejected, or is correctly addressed by a different mechanism that already works.

### Excluded Fix Approaches

- **Synchronous commit from cmd-layer TUI `K` and `portal kill` paths only.** Rejected: doesn't cover `Option-Q`, `M-q`, or external `tmux kill-session`, which the user identified as the most common kill paths.
- **Making `portal state notify` synchronously commit on every save-trigger event.** Rejected: would raise six unrelated events (including `pane-focus-out`, potentially many fires per minute) from a 2-syscall touch to a full structural capture. Eventual consistency is correct for create/rename/relayout events.
- **Notify-and-wait IPC.** Rejected: introduces a new IPC channel and protocol, depends on the daemon being alive (`_portal-saver` is best-effort), and still requires a timeout window — violates the user's explicit "no timeouts" directive.
- **Consumer-side cross-check inside `Restore`** (have `Restore` skip sessions tmux says are gone). Rejected as the primary fix: it patches only the consumer, leaves `sessions.json` itself stale, and any other consumer (`portal status`, future features, external tools) remains exposed. The user's directive is to fix the writer side.
- **Registering `commit-now` alongside `notify` on `session-closed`.** Rejected: redundant work — `commit-now` already writes `sessions.json` synchronously, making the dirty-flag touch obsolete for that event.

### Mechanisms Not Modified

- **Daemon tick rate.** The 1-second `time.NewTicker` period in `cmd/state_daemon.go` is unchanged. This bugfix does not adjust ticker cadence as a mitigation.
- **Daemon tick body (`tick()`, `captureAndCommit`).** Unchanged. The daemon retains exclusive ownership of scrollback `.bin` writes, content hashing, dedup, and `gcOrphanScrollback`.
- **Merge filter (`mergeSkippedPanes`).** Unchanged. The fix from `daemon-merge-reintroduces-dead-sessions` continues to operate correctly inside the daemon's tick.
- **Atomic-commit primitive (`state.Commit`).** Unchanged. Reused as-is by `commit-now`.
- **Restore engine (`internal/restore/*`).** Unchanged. No consumer-side patches.
- **Skeleton marker lifecycle (`@portal-skeleton-*`).** Unchanged. Managed by the daemon and the existing bootstrap stale-marker cleanup.
- **Hydrate signaling and FIFO plumbing.** Orthogonal mechanism, not implicated.
- **Hook store (`hooks.json`).** Not implicated; per-pane resume hooks remain cleaned lazily as today.
- **The six other save-trigger events** (`session-created`, `session-renamed`, `window-linked`, `window-unlinked`, `window-layout-changed`, `pane-focus-out`). Stay on the cheap `notify` path.
- **Hydration-trigger events** (`client-attached`, `client-session-changed`). Orthogonal to this fix.

### Symptoms Not Addressed

- **Stale `@portal-skeleton-*` markers from prior runs.** Already addressed by bootstrap step 8 `CleanStaleMarkers` and the recently-shipped `killed-sessions-resurrect-on-restart` fix. This bugfix does not extend or modify that cleanup.
- **Orphan `hydrate-*.fifo` files.** Already addressed by bootstrap step 9 `SweepOrphanFIFOs`. Unchanged.
- **Resurrection symptoms caused by stale daemon `PrevIndex` re-merge.** Already addressed by `daemon-merge-reintroduces-dead-sessions`. Unchanged.
- **Multi-second daemon tick wall-time** under heavy scrollback. Not a target of this fix. The synchronous commit avoids the daemon entirely on the kill path, so daemon tick latency no longer gates kill-side correctness — but the daemon itself remains as-is.

### What This Fix Doesn't Promise

- **Atomicity of the kill *and* persistence together.** tmux still removes the session before `commit-now` runs (tmux fires `session-closed` after the kill is complete). There is no transactional rollback if `commit-now` fails. The kill is authoritative regardless of persistence outcome.
- **Persistence guarantee when `commit-now` fails.** Failure mode is best-effort: `commit-now` exits non-zero, the daemon's next tick (if it's alive) corrects the file. If both `commit-now` and the daemon fail, the next Portal bootstrap captures fresh state. The fix does not introduce a stronger persistence guarantee on failure than today.

## Acceptance Criteria

### Functional Acceptance

1. **Resurrection-symptom elimination.** For every kill path (TUI `K`, `portal kill`, `Option-Q`, `M-q`, external `tmux kill-session`), the killed session must be absent from `sessions.json` on disk by the time the kill-triggered hook subprocess exits. No `sleep`, no retry, no second invocation.
2. **Bootstrap reconstruction suppression.** Immediately after any kill, a fresh `portal` invocation must complete bootstrap step 5 `Restore` without reconstructing the killed session as a skeleton pane in tmux.
3. **TUI Sessions list correctness.** Immediately after any kill, a fresh `portal` invocation must not display the killed session in the TUI Sessions page.
4. **Restoration-window safety.** When `@portal-restoring` is set, `portal state commit-now` must perform no work — `sessions.json` must remain byte-identical before and after the invocation.
5. **`_portal-saver` self-kill safety — steady-state (marker clear).** The `session-closed` hook firing for `_portal-saver` outside of a restoration window must result in a `sessions.json` that omits `_portal-saver` (via `keepSessionNames` filter) and contains all other live sessions intact.
6. **`_portal-saver` self-kill safety — bootstrap version-upgrade (marker set).** The `session-closed` hook firing for `_portal-saver` while `@portal-restoring` is set must short-circuit; `sessions.json` must be byte-identical before and after the hook subprocess runs.
7. **Hook idempotency across upgrades.** A bootstrap from a pre-fix Portal install (with `notifyCommand` registered on `session-closed`) must result in exactly one `commitNowCommand` registration on that event and zero `notifyCommand` registrations. Repeated bootstraps must not append duplicates.
8. **Kill non-blocking on persistence failure.** A `commit-now` failure (tmux unreachable, disk full, permission denied) must not prevent or revert the kill. The kill remains authoritative; the failure is logged and Portal proceeds.

### Behavioural Acceptance

9. **Six other events untouched.** `session-created`, `session-renamed`, `window-linked`, `window-unlinked`, `window-layout-changed`, and `pane-focus-out` must continue to fire `portal state notify` (the cheap dirty-flag touch). No structural capture cost is added to these events.
10. **Daemon tick unchanged.** The daemon's `tick()` body, period, scrollback capture, hash work, merge filter, and `.bin` ownership are unaltered by this fix.

### Non-Regression

11. **`daemon-merge-reintroduces-dead-sessions` invariant preserved.** The daemon's next tick (and every subsequent tick) after a `commit-now` invocation must produce a `sessions.json` whose set of session names does **not** contain the killed session. Byte-equivalence between `commit-now`'s output and the daemon's next-tick output is not required — the daemon legitimately enriches the schema with fields that `commit-now` preserves from prev (scrollback hashes, per-pane content references). The invariant is **semantic**: dead sessions stay out, live sessions stay in.
12. **`killed-sessions-resurrect-on-restart` invariant preserved.** Bootstrap steps 7 (`Clear @portal-restoring`), 8 (`CleanStaleMarkers`), and 9 (`SweepOrphanFIFOs`) continue to function identically.
13. **Existing `portal state notify` semantics preserved.** `notify` still performs zero tmux calls, zero `sessions.json` writes, and only touches `save.requested`.

## Testing Requirements

### Unit Tests (Required)

- **`commit-now` happy path.** Drive `state.CaptureStructure` + `state.Commit` against a mock tmux client; assert `sessions.json` is written with the expected sessions. Cover: zero sessions, one session, multiple sessions, sessions with multiple windows and panes.
- **`commit-now` `@portal-restoring` short-circuit.** With the marker set on the mock tmux client, assert `commit-now` returns without writing `sessions.json` (file is byte-identical to pre-invocation).
- **`commit-now` underscore-session filter.** Confirm `keepSessionNames` is applied — a tmux state containing `_portal-saver` produces a `sessions.json` that omits it.
- **`commit-now` tmux failure exit.** Mock tmux returning an error from `ListSessionNames` / `list-panes` — assert non-zero exit, no partial write to `sessions.json`.
- **`commit-now` disk failure exit.** Mock `Commit` returning an error — assert non-zero exit, no partial file, kill path not affected (this is verified by the test asserting `commit-now` returns rather than panicking).
- **Hook registration migration.** Unit-test `RegisterPortalHooks` against a fake hook store:
  - Pre-fix state (`notifyCommand` on `session-closed`) → post-bootstrap state (`commitNowCommand` on `session-closed`, `notifyCommand` removed from that event only).
  - Post-fix state (`commitNowCommand` already on `session-closed`) → no duplicate appended.
  - Empty state → `commitNowCommand` on `session-closed`, `notifyCommand` on the other six events.

### Integration Tests (Real Tmux Fixture, Required)

- **Kill → bootstrap timeline (the canonical symptom test).**
  1. Bootstrap into a stable state with two sessions A and B.
  2. Kill session B via `tmux kill-session -t B` (drives the hook in the real way).
  3. Immediately — no sleep, no retry — read `sessions.json` and assert B is absent.
  4. Run another bootstrap; assert B is not reconstructed.
- **Hook re-entrancy validation.** Run `commit-now` from inside the `session-closed` hook context; assert no deadlock, no hang, completion within a reasonable bound (e.g. 1s). This is the gate that confirms the chosen mechanism is viable under real tmux.
- **`@portal-restoring` defence under real tmux.** Set the marker, fire `session-closed`, assert `sessions.json` is untouched. Clear the marker, fire `session-closed` again, assert the file updates correctly.
- **`_portal-saver` self-kill.** During the version-upgrade kill of `_portal-saver` in bootstrap step 4, assert `sessions.json` remains valid and contains all user sessions intact (no corruption from the underscore-session firing through the synchronous path).

### Regression Tests (Required)

- **Daemon merge stability after `commit-now`.** After a `commit-now` write that omits a killed session, the daemon's next tick must produce a `sessions.json` whose session-name set still omits that session. The test asserts on the set of session names, not on byte-equivalence (the daemon legitimately repopulates scrollback-hash fields that `commit-now` carries over from prev). Verifies no spurious re-introduction of dead sessions via `PrevIndex` staleness.
- **Six-event eventual consistency.** Fire each of the six non-`session-closed` save-trigger events; assert each one results in a `save.requested` touch and **no** `sessions.json` write within the same tick window. Verifies they remained on the cheap path.

### Manual Verification (Recommended)

- Reproduce the original symptom on a pre-fix binary, confirm the resurrection. Run the same steps on a post-fix binary, confirm the symptom is gone. Vary kill path across TUI `K`, `portal kill`, `Option-Q`, `M-q`, and external `tmux kill-session`.

---

## Working Notes
