# Specification: Saver Kill-Respawn Loop Leaks Daemons

## Specification

### Problem Statement

Every portal bootstrap that runs step 4 (`EnsureSaver`) fires an unnecessary kill-respawn cycle on the `_portal-saver` session, leaking orphan `portal state daemon` processes and leaving no live saver session after bootstrap completes. The user-visible consequences are:

- **~520ms wasted per portal invocation** on a kill-respawn block that should not run when the daemon is healthy and the binary version matches.
- **Accumulating orphan daemons** — observed three concurrent `portal state daemon` processes parented to the same tmux server (oldest 5 days old, each ~40MB RSS). Only the most recent holds `daemon.lock`; the rest are stranded.
- **Silently-paused saves between portal invocations** — bootstrap ends with `_portal-saver` destroyed, so no daemon runs to capture state until the next bootstrap recreates it. The resurrection guarantee is silently broken.
- **Noisy diagnostic log** — three WARN lines emitted on every bootstrap (`prior daemon … did not exit within 5s` → `another daemon holds the lock; exiting` → `step 4 (EnsureSaver) failed: … no such session: _portal-saver`).

**Reproducibility:** Always, on any environment where (a) `daemon.version` is missing OR (b) the daemon's per-tick wall time exceeds the 5s kill-barrier window. The latter applies to any user with non-trivial scrollback volume (~23 panes × ~1.2MB rendered text was sufficient on the affected machine).

**Scope of impact:** Performance regression and silent reliability regression — portal still works functionally, but the resurrection daemon's continuity guarantee is violated between invocations and startup latency is degraded.

### Root Cause

The bug is the conjunction of two independent defects in the saver-bootstrap and daemon-startup pair, plus a third open question whose user-visible effect is neutralised by fixing the first two.

#### Defect 1 — Version-mismatch false positive when `daemon.version` is absent

`portalSaverVersionMismatch` (`internal/tmux/portal_saver.go`) collapses three distinct conditions into a single "mismatch" result: (a) genuine version disagreement, (b) dev-build workflows (stored or current is `dev`/empty), and (c) "version file absent". Case (c) is the false positive — file absence does not imply version mismatch; it merely means we cannot confirm the version, while the daemon may still be perfectly healthy.

`EnsurePortalSaverVersion` (`internal/tmux/portal_saver.go:249`) consults the mismatch predicate without first checking daemon aliveness. So any condition that removes `daemon.version` while leaving the daemon alive triggers an unnecessary kill on every subsequent bootstrap.

#### Defect 2 — Daemon SIGHUP-unresponsive within the 5s kill-barrier window

`defaultDaemonRun` (`cmd/state_daemon.go`) runs `tick()` synchronously inside the ticker's `select` arm:

```go
for {
    select {
    case <-ticker.C:
        tick(deps)               // synchronous; no ctx awareness inside
    case <-ctx.Done():
        return daemonShutdownFunc(deps)
    }
}
```

`ctx.Done()` is structurally unreachable during a tick. The expensive work inside `tick → captureAndCommit` iterates every live pane and invokes `tmux capture-pane -e -p -S -` (unbounded scrollback) per pane for the hash check. On the affected user's profile (~23 panes × ~1.2MB rendered text), measured wall time exceeds the 5s `killBarrierTimeout` sized by the prior fix.

When the barrier gives up early, the new daemon spawns, immediately collides with the still-held `daemon.lock`, exits cleanly **without writing `daemon.pid` or `daemon.version`**, destroys the just-created `_portal-saver` pane process, and triggers the `SetSessionOption(_portal-saver, destroy-unattached, off)` "no such session" cascade. The session dies because tmux destroys a session whose only pane's initial process has exited normally — a distinct lifecycle axis from `destroy-unattached`, which governs the detach/no-clients case. The cascade is therefore unaffected by the `destroy-unattached=off` setting that the failing `SetSessionOption` call was trying to apply.

**Recycle-induced sweep pressure (self-amplifying property).** The kill-respawn path itself emits `session-closed` and `session-created` hooks; both fire `save.requested` events on the surviving daemon, pushing it into a back-to-back sweep regime. This widens the cancel-to-exit window precisely on the recycle path the barrier is meant to defend. Change 2's ctx-aware loop must remain interruptible under this pressure.

#### Defect 3 — `daemon.version` disappearance (open, instrumentation only)

Code-trace exhaustively enumerated every production file-removal path; **no linearly-traced production code path removes `daemon.version` individually**. The user confirmed no user-initiated cleanup (no `portal clean`, no manual `rm`, no state-dir touch), so the deleter is most likely inside portal's own runtime path but in a code path not surfaced by the linear trace — candidate suspects (carried forward under Change 3) include an atomic-write race inside `state.WriteVersionFile`, an over-eager cleanup pass in the daemon's tick loop, the bootstrap `CleanStale` step, or shutdown-flush behaviour. Fixing Defect 1 makes the disappearance non-load-bearing for the user-visible symptom regardless of which suspect is correct — Defect 3 becomes a follow-up question, not a blocker.

#### Why It Wasn't Caught

- The prior fix (`multiple-state-daemons-running-concurrently`, 2026-05-11) sized `killBarrierTimeout` at 5s against a measured 3.9s cold sweep with margin. The user's profile grew past that bound within months; no telemetry exposed the relationship.
- `portalSaverVersionMismatch`'s existing unit test pins the false-positive "absent → mismatch" behaviour as correct, codifying the bug as contract.
- No alive-daemon-with-missing-version-file integration test exists. The closest test verifies kill-respawn under explicit version mismatch, not under absent version.
- The orphan-leak symptom is invisible without `ps | grep portal`; the WARN cascade only lands in `portal.log`.

### Change 1 — Alive-check first in `EnsurePortalSaverVersion`

**Target:** `internal/tmux/portal_saver.go` — `EnsurePortalSaverVersion`, `portalSaverVersionMismatch`.

**Required behaviour:**

Rework the kill decision in `EnsurePortalSaverVersion` to consult `BootstrapAliveCheck(stateDir)` **before** the version-mismatch branch. The new decision matrix:

| Daemon alive? | Version file state | Versions match? | Action |
|---|---|---|---|
| Yes | (any) | Either side is `dev` or `""` | **Kill.** Dev-build short-circuit — preserves current behaviour (development workflows always recycle). |
| Yes | Absent | (unknowable, neither dev) | **No kill.** Write daemon.version defensively from bootstrap, then proceed to BootstrapPortalSaver. |
| Yes | Present, reads cleanly | Match (neither dev) | **No kill.** Proceed to BootstrapPortalSaver. |
| Yes | Present, reads cleanly | Mismatch, neither dev (real upgrade) | **Kill.** Run `killSaverAndWaitForDaemon`, then BootstrapPortalSaver. |
| Yes | Read error (non-absent I/O failure) | (unknowable) | **Kill.** Conservative — treat unknown I/O failure as needing recycle. |
| No | (any) | (any) | **No kill needed.** No daemon to recycle. Proceed to BootstrapPortalSaver. |

The dev-build rule is the first row evaluated when the daemon is alive — it short-circuits the rest of the matrix. The "no daemon" branch is unaffected by dev semantics (nothing to recycle).

**No new function signature.** `EnsurePortalSaverVersion(c *Client, stateDir, currentVersion string) error` already takes `stateDir` as a parameter. `BootstrapAliveCheck` is the existing package-level variable (already wired to `state.DaemonAlive`) and is invoked with that same `stateDir`. No caller-side signature changes propagate from this fix.

`portalSaverVersionMismatch` keeps its current external shape but is **no longer the lone gate**. The alive-check classifies the situation first; the mismatch predicate is consulted only on the alive-with-readable-version branch.

**Update the existing function comment.** The comment currently at `internal/tmux/portal_saver.go:232-241` explicitly encodes "ErrVersionFileAbsent counts as mismatch — for first-ever bootstrap or user-initiated state-dir cleanup" as intentional design. That invariant is being inverted by Change 1 (alive-check ordering is what captures the broader invariant; the predicate no longer treats absence as mismatch in isolation). The comment must be revised to reflect the new contract, otherwise it becomes a future trap for the next reader.

**Defensive complement:** when bootstrap observes "alive daemon + absent `daemon.version`" on the survived path, write `daemon.version` from the bootstrap side before proceeding. The string written is `currentVersion` — the same value `EnsurePortalSaverVersion` received as a parameter (injected at build time via `-ldflags -X github.com/leeovery/portal/cmd.version`). No comparison against the running daemon's actual binary is performed — the alive-check has already determined the daemon is healthy, and the user is responsible for an explicit recycle on intentional upgrades. In pathological cases where the alive daemon is running an older binary AND `daemon.version` was absent, the defensive write effectively asserts "the version going forward" rather than the daemon's actual version; any disagreement is resolved by the next legitimate recycle. This closes the lock-loser lifecycle hole (lock-loser daemons return cleanly before writing `daemon.version`, leaving the file observably absent until the next bootstrap repairs it).

**What stays unchanged:**

- The `daemon.lock` flock primitive and `killSaverAndWaitForDaemon` machinery from the prior bugfix (`multiple-state-daemons-running-concurrently`).
- `BootstrapPortalSaver` itself — only the gate in front of `killSaverAndWaitForDaemon` changes.
- The no-daemon path (alive-check returns false) — already correct, no behavioural change.
- Dev-build handling (`stored == "dev"` or `currentVersion == "dev"`) — preserve current "always recycle on dev" behaviour for development workflows.

**Rejected alternative:** distinguishing `ErrVersionFileAbsent` inside `portalSaverVersionMismatch` only (smaller change). Rejected because it narrows the symptom (file absent → no kill) but misses the broader invariant: a healthy daemon should never be killed for a missing version marker regardless of *why* the file is missing. The alive-check ordering captures the broader invariant.

### Change 2 — Context-aware `captureAndCommit`

**Target:** `cmd/state_daemon.go` only — `defaultDaemonRun`, `tick`, `captureAndCommit`. Signature changes are **local to this file**. The per-pane `state.CaptureAndHashPane` call is invoked directly from inside `captureAndCommit`'s loop (currently `cmd/state_daemon.go:152`), so the `ctx.Done()` check sits adjacent to that call in the same file. `internal/state/capture.go` is **not modified** — its `CaptureStructure` and `CaptureAndHashPane` signatures remain unchanged.

**Required behaviour:**

Thread `ctx` from `defaultDaemonRun` through `tick` into `captureAndCommit` and the per-pane loop. Between per-pane iterations of the structural-index loop, check `ctx.Done()` and return early on cancellation.

This caps worst-case daemon-exit latency at **one pane's `capture-pane` wall time** rather than "all panes' aggregated wall time" — bounded by per-pane scrollback size, no longer by the user's total pane count.

**Cancellation semantics:**

- `ctx.Done()` is observed at three points inside `captureAndCommit`:
  1. **Before pane enumeration begins** — checked at function entry, ensures cancellation while a tick is queued returns immediately.
  2. **After enumeration, before the first per-pane iteration** — covers cancellation during the (fast) `CaptureStructure` call.
  3. **Between per-pane iterations** — covers cancellation during the bulk of the work.
- Cancellation is **not** honoured mid-`capture-pane` invocation. The `tmux list-panes` enumeration call and any in-flight `tmux capture-pane` invocation complete before the cancel is observed. These are single subprocess calls; `list-panes` is fast, and the per-pane `capture-pane` is bounded by one pane's scrollback (the resulting cap on worst-case exit latency).
- On cancellation, return early **without committing partial state**. The current tick is abandoned cleanly — no half-applied scrollback writes, no partial commit.
- The outer `select { ticker.C / ctx.Done() }` loop continues to handle the no-tick-in-progress cancellation path. Its semantics are unchanged.
- Shutdown flush behaviour (`daemonShutdownFunc`) is unchanged — it still runs on the cancelled-context path after the tick-loop returns.

**What stays unchanged:**

- The `killSaverAndWaitForDaemon` barrier on the bootstrap side. The barrier was correct against its contract; the fix completes the daemon side of that contract.
- `killBarrierTimeout` stays at 5s. Raising the timeout was considered and rejected — it defers the next profile-growth failure without resolving the underlying contract violation.
- The per-tick capture algorithm itself — pane enumeration, hashing, dedup, commit — is unchanged. Only the loop becomes interruptible.
- `tmux capture-pane` invocation is **not** bounded to a fixed line count. Per-pane scrollback semantics are preserved (capture-pane bounding is out of scope, see Out of Scope).

**Rejected alternatives:**

- **Raise `killBarrierTimeout` from 5s to 10s.** Rejected — defers the next failure rather than fixing it. The prior bugfix already shipped 5s with margin against a measured 3.9s sweep; the user's profile grew past that bound within months. Re-sizing without making the daemon ctx-aware repeats the same mistake.
- **Bound `tmux capture-pane -S` to a fixed line count.** Rejected — changes scrollback semantics (less history saved than the user expects) and is the wrong layer for this fix.
- **Move per-pane work onto a goroutine with a cancellable channel.** Rejected — heavier than the in-line `ctx.Done()` check, introduces new concurrency surface, doesn't improve worst-case exit latency over the inline approach.

### Change 3 — Debug breadcrumb on `daemon.version` writes

**Target:** `internal/state` — the package that owns `WriteVersionFile`.

**Required behaviour:**

Add a single DEBUG-level log entry inside `state.WriteVersionFile` capturing:

- The version string being written
- The caller's pid (`os.Getpid()`)
- The destination path

**Component:** `state.ComponentDaemon` (existing constant in `internal/state/logger.go`). Reasoning: `WriteVersionFile` lives in the `internal/state` package and is most commonly invoked from the daemon's startup path. The bootstrap-side defensive write (Change 1) also flows through the same helper; using `ComponentDaemon` keeps a single grep anchor regardless of caller.

**Format anchor:** the log line MUST begin with `daemon.version write:` so future Defect 3 investigations can grep on a stable prefix. Example: `daemon.version write: version=0.5.0 pid=12345 path=/Users/x/.config/portal/state/daemon.version`. The exact `fmt` template is implementation choice, but the prefix is contract.

No behavioural change. No additional file I/O, no new error paths, no return-shape changes. Pure instrumentation.

**Why it ships now:** Defect 3 (`daemon.version` keeps disappearing on the affected user's machine) was not pinned to a production code path by the investigation. Fixing Defect 1 makes the disappearance non-load-bearing for the user-visible symptom, but the underlying mechanism remains unknown. The breadcrumb provides a paper trail in `portal.log` so the next disappearance — if it recurs — can be correlated against daemon lifecycle events without launching a fresh investigation.

**Acceptance for this change alone:**

- Every call to `WriteVersionFile` produces exactly one DEBUG log line.
- Existing call sites are unchanged in their semantics.
- No new test surface required — the existing tests for `WriteVersionFile` must remain green.

**Not in scope for this change:**

- Reproducing the disappearance. The investigation could not, and this spec does not commit to doing so.
- Identifying the deleter. The breadcrumb gives instrumentation for future diagnosis; it does not itself answer the question.

**Carry-forward for future investigation.** The investigation enumerated and ruled out every production file-removal path that could touch `daemon.version`: `state.WriteVersionFile`'s atomic-write target was the only writer, and no individual `Remove`/`Unlink` of `daemon.version` exists anywhere in production code. Paths checked and ruled out: `cmd/state_cleanup.go` `os.RemoveAll(dir)` (only via explicit `--purge`), `cmd/state_daemon.go` save.requested removals, `cmd/state_hydrate.go` per-pane FIFO removals, `internal/state/logger.go` log-rotation, `internal/state/commit.go` scrollback dedup, `internal/state/fifo_sweep.go` per-pane FIFO sweep. If Change 3's breadcrumb captures a recurrence, the follow-up investigation should start from the candidate list flagged by this investigation: an atomic-write race inside `state.WriteVersionFile`, an over-eager cleanup pass in the daemon's tick loop, the bootstrap `CleanStale` step, or shutdown-flush behaviour in `defaultShutdownFlush`. Source: investigation.md "Root Cause" → Defect 3 ruled-out table and open-sub-question candidates.

### Acceptance Criteria

The fix is complete when **all** of the following observable conditions hold:

#### Steady-state bootstrap

1. **No kill-respawn on healthy bootstrap.** On any bootstrap where the daemon is alive (regardless of `daemon.version`'s presence or readability), the three WARN lines are absent from `portal.log`:
   - `prior daemon (pid=N) did not exit within 5s`
   - `another daemon holds the lock; exiting`
   - `step 4 (EnsureSaver) failed: … no such session: _portal-saver`

2. **`_portal-saver` survives bootstrap.** Immediately after `portal hooks list` (or any bootstrap-only command) completes, `tmux has-session -t _portal-saver` returns success. The session remains running with the daemon process attached.

3. **Single live daemon, no orphans.** `pgrep -f "portal state daemon"` returns exactly one PID after bootstrap, and that PID matches the one holding `daemon.lock` (verifiable via `lsof daemon.lock`).

4. **`daemon.version` is repaired defensively on the survived-daemon path.** If a bootstrap encounters "alive daemon + absent `daemon.version`" and takes the no-kill branch, the file exists synchronously after `EnsurePortalSaverVersion` returns and contains `currentVersion`. (On the kill-respawn path, the fresh daemon writes `daemon.version` asynchronously after acquiring `daemon.lock` — a brief window of observable absence is acceptable on that path. Integration tests for the kill-respawn path must wait for the new daemon's write rather than asserting synchronous presence.)

5. **~520ms reclaimed.** Wall-time of `portal hooks list` against an already-running tmux server with a healthy saver no longer includes the kill-respawn block. (Informational — not a hard regression test, but the developer should verify the improvement empirically.)

#### Version-upgrade bootstrap

6. **Real version mismatch still triggers kill.** When `daemon.version` reads cleanly and disagrees with the current binary (and neither side is `dev`/empty), `killSaverAndWaitForDaemon` runs and a fresh daemon spawns. The prior-bugfix kill-respawn path is preserved end-to-end.

#### Daemon responsiveness

7. **SIGHUP-to-exit latency is bounded by one pane's capture wall time.** When `tmux kill-session -t _portal-saver` is issued mid-tick on a real-tmux fixture with many panes, the daemon process exits within "one pane's `capture-pane` wall time" of receiving SIGHUP — empirically verifiable inside the 5s `killBarrierTimeout` on the affected user's profile.

8. **No partial commits on cancellation.** When the daemon is cancelled mid-tick, no half-applied scrollback writes or partial commits land on disk. Either the tick committed fully before cancellation, or it abandoned cleanly.

#### Diagnostic & regression

9. **`daemon.version` writes produce a DEBUG breadcrumb.** Each `state.WriteVersionFile` call emits one DEBUG log line containing version, caller pid, and destination path.

10. **No regression of `multiple-state-daemons-running-concurrently`.** All tests from the prior bugfix remain green. The `daemon.lock` flock and `killSaverAndWaitForDaemon` barrier are unchanged.

### Testing Requirements

#### Unit tests

**`portalSaverVersionMismatch` table tests** — the existing test's assertions are preserved (the predicate still returns `true` for absent), but its framing must be **reworked**, not deleted: rename the test and update its documentation so it no longer claims "absent counts as version mismatch" as a load-bearing contract. The predicate's `absent → true` verdict is still valid at the predicate layer; what changes is that `EnsurePortalSaverVersion` no longer drives the kill decision from the predicate alone — the alive-check ordering (covered by the new `EnsurePortalSaverVersion` tests below) is now the authoritative gate.

Cases the reframed table must cover:

| Stored | Current | Read error | Expected |
|---|---|---|---|
| `0.5.0` | `0.5.0` | nil | `false` (match) |
| `0.5.0` | `0.5.1` | nil | `true` (real mismatch) |
| `""` | `0.5.0` | `ErrVersionFileAbsent` | `true` (predicate alone — alive-check happens in caller) |
| `""` | `0.5.0` | other I/O error | `true` |
| `dev` | `0.5.0` | nil | `true` (dev preserved) |
| `0.5.0` | `dev` | nil | `true` (dev preserved) |

**`EnsurePortalSaverVersion` ordering tests:**

- Assert `BootstrapAliveCheck` is consulted before any kill decision.
- Alive + absent version file → no kill, daemon.version written defensively.
- Alive + readable + matching version → no kill.
- Alive + readable + mismatching version → kill barrier runs.
- Not alive → no kill regardless of version state.

**`captureAndCommit` ctx-cancellation tests:**

- Cancel context before first per-pane iteration → early return, no commits.
- Cancel context between per-pane iterations on a multi-pane fixture → early return, no partial commits written.
- Uncancelled context → identical behaviour to current implementation (regression guard for the happy path).

#### Integration tests (real-tmux fixture)

1. **"Alive daemon, daemon.version absent, versions match"** → bootstrap completes without firing the kill barrier. `_portal-saver` survives; `daemon.version` is present and correct post-bootstrap. Pins Defect 1's user-visible contract.

2. **"Daemon mid-tick, SIGHUP arrives"** → on a fixture with multiple panes loaded with synthetic scrollback, send SIGHUP while a tick is in progress. The daemon process exits within a bounded window (target: under 2s on the test fixture). The 2s figure is a **heuristic threshold**, not anchored to a fresh measurement — no fresh wall-time measurement of one pane's `capture-pane` invocation against a representative scrollback fixture was taken during the investigation. Implementation should take that measurement and either confirm 2s as appropriate or adjust the threshold from the measurement. Pins Defect 2's responsiveness contract.

3. **"Lock-loser daemon's pane exit destroys `_portal-saver` session"** → uses **fault injection** to force the lock contention scenario: a sentinel process holds `daemon.lock` (via `state.AcquireDaemonLock` in a test goroutine), then `BootstrapPortalSaver` is invoked. The test asserts the chain:
   - The new daemon's process exits cleanly within a bounded window (target: under 1s).
   - `tmux has-session -t _portal-saver` returns failure after the daemon process exits (poll with 100ms tick, 2s ceiling).
   - The immediately-following `SetSessionOption(_portal-saver, destroy-unattached, off)` returns `exit status 1` containing the substring `no such session`.

   Observation mechanism: combination of process-wait + `has-session` polling + direct call assertion. Post-fix, this test continues to pass because the conditions for the cascade (forced lock contention) remain reachable via the fault-injection harness — only the *natural* trigger (kill-barrier giving up early) is eliminated. The test is a permanent regression guard on the cascade chain, not on the conditions that trigger it. Closes synthesis-flagged gap from investigation.

#### Regression preservation

- All tests from `multiple-state-daemons-running-concurrently` remain green. Listed by the planning phase via `git log --all --grep=multiple-state-daemons-running-concurrently` if needed.
- The existing `portal_saver_integration_test.go` "kill-respawn under explicit version mismatch" test stays green (Criterion 6 protects this path).

#### Out of testing scope

- **Reproducing the `daemon.version` disappearance.** Defect 3 is instrumentation-only; no test asserts the file is never deleted.
- **Empirical ~520ms perf measurement.** Informational acceptance criterion (#5), not a guarded regression test — measurement floor varies by machine.

### Out of Scope

The following are explicitly **not** part of this bugfix and should not be addressed by planning or implementation:

1. **Hook-registration redundancy.** `internal/tmux/hooks_register.go` runs ~1.5s of redundant `tmux show-hooks` work during bootstrap step 2 (RegisterPortalHooks). Orthogonal mechanism, orthogonal symptom (no orphan leak, no save pause). Logged separately at `.workflows/.inbox/bugs/2026-05-18--redundant-show-hooks-during-bootstrap-hook-registration.md`. Bundling would muddy review scope.

2. **`tmux capture-pane` line-count bounding.** Capping per-pane capture work via `capture-pane -S -N` is the wrong layer for this fix and would change scrollback semantics (less history saved than the user expects). Worth a separate scoping discussion if per-pane wall time becomes a problem in its own right.

3. **Raising `killBarrierTimeout` above 5s.** Considered and rejected — defers the next profile-growth failure without fixing the underlying contract (daemon must exit promptly on SIGHUP). The structural fix in Change 2 makes the timeout-sizing question moot.

4. **Identifying the root cause of Defect 3 (`daemon.version` disappearance).** No production code path was found that removes the file individually. Change 3's breadcrumb provides instrumentation for future diagnosis if the file disappears again — but reproducing or pinning the deleter is not in scope. If the breadcrumb captures evidence of a recurring deleter in production logs, a separate investigation is launched then.

5. **Goroutine-based concurrency restructure of the daemon tick loop.** Considered and rejected in favour of the simpler inline `ctx.Done()` check. Out of scope.

6. **TUI loading-floor (`LoadingMinDuration = 1.2s`) reduction.** Contributes to user-perceived startup time on the TUI path but is unrelated to the kill-respawn loop and orphan leak. Independent of this bugfix.

7. **Migration of `daemon.version` to a different storage mechanism** (e.g. server option, sqlite, etc.). The file-based approach is fine once Defect 1 makes the kill decision resilient to its transient absence.

### Risk & Rollout

#### Fix complexity

- **Change 1:** ~30 lines across `internal/tmux/portal_saver.go` — predicate refactor + alive-check threading + defensive `WriteVersionFile` call on the survived path.
- **Change 2:** ~20 lines, all within `cmd/state_daemon.go`. No changes to `internal/state/capture.go`.
- **Change 3:** ~1 line — a `logger.Debug(...)` call inside `state.WriteVersionFile`.
- **Test updates** dominate the diff (table-test expansion, new integration fixtures).

#### Regression risk

**Low.** The fix is local refactors of decision logic (Change 1) and loop interruptibility (Change 2). Specifically:

- The `daemon.lock` flock primitive stays unchanged.
- The `killSaverAndWaitForDaemon` polling loop stays unchanged.
- The version-mismatch alive-check ordering is **additive** — it gates the existing kill branch with one new condition; the no-daemon path is unchanged.
- `BootstrapPortalSaver` itself is unchanged.
- The per-tick capture algorithm is unchanged; only the loop becomes interruptible.

Main risk surfaces to watch during review:

- The defensive `WriteVersionFile` from bootstrap on the "alive + absent" path must not race with the daemon's own `WriteVersionFile`. The bootstrap write happens before `BootstrapPortalSaver` proceeds; the daemon's own write happens after lock acquisition. They don't overlap on the survived-daemon path because the daemon's already past that point. Confirm via the integration test.
- Ctx cancellation between per-pane iterations must not introduce a deadlock where the shutdown flush waits for a tick that just got cancelled. Verify that `daemonShutdownFunc` does not depend on the cancelled tick's output.

#### Rollout

**Regular release.** No hotfix required:

- The symptom is recoverable (orphan daemons can be killed manually; `daemon.version` is repaired on next clean bootstrap once the fix lands).
- Impact is performance + silent save pause rather than data corruption.
- Behaviour-changing surface is small and well-tested at unit + integration level.

#### Coordination with prior bugfix

- Builds directly on `multiple-state-daemons-running-concurrently` (completed 2026-05-11). That spec's `daemon.lock` and `killSaverAndWaitForDaemon` machinery is treated as a frozen prior layer. Implementation must not touch the lock primitive or the barrier's polling loop.
- The prior spec sized the barrier timeout to a measured 3.9s + margin. This spec doesn't resize the timeout — it makes the daemon-side contract correct so the existing timeout never has to be exceeded under healthy conditions.

**Adjacent closed bugfixes — regression-watch list.** The following exercise adjacent daemon/restore surfaces. This bugfix does not touch their logic; their tests should remain green:

- `daemon-merge-reintroduces-dead-sessions` — structural-index merge in the daemon's commit pipeline.
- `killed-sessions-resurrect-on-restart` — bootstrap-side restore decisions for explicitly killed sessions.

---

## Working Notes

