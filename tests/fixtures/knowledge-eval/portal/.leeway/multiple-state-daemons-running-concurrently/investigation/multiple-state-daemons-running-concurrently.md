# Investigation: Multiple State Daemons Running Concurrently

## Symptoms

### Problem Description

**Expected behavior:**
Exactly one `portal state daemon` process runs per tmux server lifetime. Bootstrap-driven kill+respawn cycles (e.g. version mismatch upgrades) produce a clean handover: the old daemon exits before the new one is allowed to start writing to shared state. Per-tick CPU cost stays bounded so the daemon does not pin the tmux server.

**Actual behavior:**
Up to **seven** `portal state daemon` processes were observed simultaneously, all parented to the tmux server (PID 94966). Only one was inside the `_portal-saver` session; the other six were past-lifecycle orphans whose owning session had already been killed but whose `cancel()` had not yet been observed by their in-flight `tick()`. While 2+ daemons ran, the tmux server stayed pegged at 75–98% CPU; `sample` showed all time in `cmd_capture_pane_exec` → `grid_string_cells` → `grid_string_cells_add_code`.

### Manifestation

- Severe sluggishness across the entire tmux server: TUI redraws, prefix keystrokes, and `tmux ls` itself were multi-second slow.
- Load average sustained at 5–10 during the observation window.
- `ps` snapshots once per second showed 4–7 concurrent `tmux capture-pane -e -p -S -` child processes (one per running daemon mid-sweep).
- With zero daemons running, tmux server CPU dropped to 0–22% and capture-pane processes dropped to zero.

### Reproduction Steps

**Trigger mechanism still to be confirmed by code analysis.** The inbox report attributed the kill-respawn cycle to a mixed `release/dev` `portal` binary alternation, but the user has clarified they do **not** have two binaries on PATH. So the version-mismatch trigger (if that is even the trigger) fires for a different reason — possibly the `dev/dev` or empty-stored cases in `portalSaverVersionMismatch`, or via a path unrelated to version mismatch entirely.

What is reproducible regardless of trigger:

1. Whenever `EnsurePortalSaverVersion` decides to recycle the saver, it calls `KillSession(_portal-saver)` then immediately `BootstrapPortalSaver` — no aliveness barrier.
2. If the killed daemon is mid-`tick()` (1.5–4 s on the observed scrollback profile), the old daemon stays alive while the new one is already running.
3. Over enough invocations, daemons accumulate.

**Reproducibility:** Single observation so far (2026-05-09). Conditions for accumulation are structural (the bootstrap race), so any repeat of the trigger reproduces.

### Environment

- **Affected environments:** Any tmux server lifetime where the version-mismatch path is taken repeatedly. Empirically observed on macOS (`darwin`), but the root cause is platform-independent.
- **User conditions:** Mixed `release/dev` binaries on PATH; long-running tmux server; many panes with substantial scrollback.

### Impact

- **Severity:** High. The whole tmux server (all sessions, not just portal-managed ones) becomes unusable for sustained periods.
- **Scope:** Any user running portal long enough to accumulate orphan daemons; worst with mixed release/dev binaries.
- **Business impact:** N/A (developer tool); user-experience degradation severe.

### References

- Inbox file (archived): `.workflows/.inbox/.archived/bugs/2026-05-09--multiple-state-daemons-running-concurrently.md`
- Related (separate work units, may share machinery but not assumed identical):
  - `.workflows/killed-sessions-resurrect-on-restart/` (active, in implementation)
  - `.workflows/daemon-merge-reintroduces-dead-sessions/` (completed)

---

## Analysis

### Initial Hypotheses

1. **Bootstrap does not wait for the killed daemon to exit before spawning a replacement.** Read from `portal_saver.go:106-114` — `KillSession` then immediate `BootstrapPortalSaver` with no aliveness barrier.
2. **No singleton lock.** `state_daemon.go:226` writes `daemon.pid` informationally only; `BootstrapAliveCheck` (`portal_saver.go:37`) signal-0-probes only the *current* `daemon.pid` and cannot see prior orphans whose PID has been overwritten.
3. **Some path is firing the saver-recycle cycle frequently enough that orphans accumulate.** The inbox file blamed mixed release/dev binaries on PATH but the user has none — so we need to identify what actually triggers the kill-respawn cycle. Candidates: empty stored version on disk, `dev`/empty current version embedded in the binary, parallel `portal` invocations stomping each other, or non-version-mismatch code paths that also call `KillSession(_portal-saver)`.

(1) and (2) are the structural defects — they make accumulation possible. (3) determines frequency. The fix focuses on (1)+(2); (3) is diagnostic context.

To validate against current code.

### Code Trace

**Trigger path** — every `portal` command goes through bootstrap step 4 (`EnsureSaver`):

1. `cmd/bootstrap/bootstrap.go:260-266` — Step 4 calls `o.Saver.EnsureSaver()`. Best-effort; failure becomes `SaverDownWarning`, success continues silently.
2. `cmd/bootstrap_production.go:58-60` — `saverAdapter.EnsureSaver()` delegates to `tmux.EnsurePortalSaverVersion(client, stateDir, version)`, passing the binary's ldflags-injected version.
3. `internal/tmux/portal_saver.go:106-114` — `EnsurePortalSaverVersion`:
   - Reads stored version: `state.ReadVersionFile(stateDir)`.
   - `portalSaverVersionMismatch(stored, currentVersion, readErr)` (lines 120-131) returns true if **any** of: read error, `currentVersion ∈ {"", "dev"}`, `stored ∈ {"", "dev"}`, or `stored != currentVersion`.
   - If mismatch AND `HasSession(_portal-saver)` → tolerant `KillSession(_portal-saver)`.
   - Unconditionally calls `BootstrapPortalSaver` next.
4. `internal/tmux/portal_saver.go:63-83` — `BootstrapPortalSaver`:
   - `HasSession(PortalSaverName)` — observes the kill just took effect → false.
   - Falls through to `createPortalSaverWithRetry`.
5. `internal/tmux/portal_saver.go:138-158` — `createPortalSaverWithRetry`:
   - `c.NewDetachedSessionNoCwd(PortalSaverName, "portal state daemon")` creates a fresh detached tmux session whose initial process is `portal state daemon`. **New daemon process A2 forks-execs as soon as tmux returns from new-session.**
   - On error, retries up to 3 attempts with `HasSession` race-resolution.

**Race window inside the old daemon (A1):**

6. `cmd/state_daemon.go:54-63` — `defaultDaemonRun` is a `for { select { ticker.C / ctx.Done() } }` loop. `tick()` runs synchronously inside the same select arm; `ctx.Done()` is only reachable **between** ticks, never during one. So if SIGHUP arrives at A1 mid-sweep, A1 keeps running for the remainder of the current `tick()` (measured 1.5–4 s on the observed scrollback profile).
7. `cmd/state_daemon.go:265-270` — `signal.Notify(sigCh, SIGHUP, SIGTERM)` then `go func() { <-sigCh; cancel() }()`. The goroutine flips ctx, but ctx.Done() is gated by tick completion (point 6).
8. `cmd/state_daemon.go:115-158` — `captureAndCommit` runs sequentially: marker list → `CaptureStructure` → per-pane `CaptureAndHashPane` (line 135) + `WriteScrollbackIfChanged` (line 140) → `state.Commit`. `CaptureAndHashPane` always invokes `capture-pane` to compute the hash; the dedup at `WriteScrollbackIfChanged` only saves the file write.

**PID file overwrite (no singleton enforcement):**

9. `cmd/state_daemon.go:226` — `state.WritePIDFile(dir, os.Getpid())` is called by A2 early in startup, **before** the tick loop begins.
10. `internal/state/daemon_state.go:33-36` — `WritePIDFile` is `fileutil.AtomicWrite` (temp + rename). No locking; last writer wins.
11. `internal/state/daemon_state.go:82-88` — `DaemonAlive` reads `daemon.pid` then `IsProcessAlive` (signal-0 probe). After A2 overwrites, `DaemonAlive` sees A2's PID and reports alive — **A1's PID is no longer recorded anywhere** and is invisible to `BootstrapAliveCheck`. A1 is now an unreachable orphan.

**Scrollback-cost backing data** — confirms `internal/tmux/tmux.go:625` `capture-pane -e -p -S -` (unbounded scrollback) is the cost driver. Inbox measurements showed a 24-pane sweep at 3.9 s cold / 1.5 s warm; same sweep with `-S -100` measured 293 ms (13× faster, 130× less data).

### Trigger frequency (resolved)

The inbox file blamed mixed release/dev binaries on PATH. The user has confirmed they don't have them. The follow-up hypothesis was that the user's binary was a dev build (`version == "dev"`) so every command would trip the mismatch path. **Also wrong** — verified with the user:

```
$ portal version
portal version 0.3.1
$ cat ~/.config/portal/state/daemon.version
0.3.1
```

With matching real semver on both sides, `portalSaverVersionMismatch` returns `false` and the version-mismatch kill path is dormant on this user's normal commands. The 7-daemon accumulation therefore came from low-frequency triggers compounding over the 10-day uptime, not from a high-frequency recycle source. Candidate paths consistent with the observation:

- **Stale `daemon.pid`** — file missing, unreadable, or PID points to a dead process. `BootstrapPortalSaver:66-70` kills the (live) tmux session and recreates. If the actual daemon was still running but the pidfile was lost, this races a fresh respawn against the mid-sweep window.
- **Manual interventions** — `tmux kill-session -t _portal-saver`, `pkill portal`, or anything else that signals the daemon between bootstraps.
- **Brew upgrades** — any version bump trips `stored != currentVersion` for one recycle.
- **Daemon crash mid-tick** — pidfile lingers pointing to dead PID; next bootstrap triggers a recovery cycle while a successor sweep is starting up.

Accumulating 7 orphans from low-frequency events (~one every 34 hours) over a 10-day uptime is consistent with the observed snapshot. **The trigger frequency is incidental to the bug.** The bootstrap race + no-singleton-lock structural defects make any trigger — high or low frequency — capable of producing an orphan; the fix closes the race regardless of how often it fires.

### Root Cause

The bug is the conjunction of two structural defects in the saver-bootstrap and daemon-startup pair:

1. **No singleton enforcement.** `state.WritePIDFile` and `BootstrapAliveCheck` cooperate as an informational pidfile, not as a singleton lock. Once two daemons coexist (for any reason), nothing in the system prevents both from running concurrent capture loops over the same state directory.
2. **Bootstrap does not synchronise with the killed daemon's exit.** `EnsurePortalSaverVersion` issues `KillSession`, then `BootstrapPortalSaver` immediately observes "no session" and creates a fresh one. The new daemon (A2) starts and writes its PID before the old daemon (A1) — currently mid-sweep — observes the cancelled context. A1 finishes its sweep with its PID overwritten and becomes invisible to any future `BootstrapAliveCheck`.

These two defects compose: (1) means N daemons can coexist; (2) is the recurring mechanism that pushes N from 1 to 2+ on every saver recycle.

**Why this happens:** The original design (per the `portalSaverCommand` comment at `internal/tmux/portal_saver.go:28-33`) was: *"tmux owns the daemon's lifecycle: when this session is killed (or the server dies), the kernel delivers SIGHUP to the daemon for graceful shutdown."* True in principle, but graceful ≠ instant — the daemon shuts down at the end of its current sweep, not on signal receipt. The lifecycle promise is honoured eventually, but the bootstrap path treats it as synchronous.

### Contributing Factors

- **Unbounded scrollback capture** (`tmux.go:625` `capture-pane -S -`) makes each sweep 1.5–4 s at the user's scrollback profile. The Go ticker drops missed fires, so when a sweep overruns the 1 s tick interval the next tick fires immediately on completion — daemons in this regime never reach `ctx.Done()` between sweeps, extending the orphan-eligibility window indefinitely after a kill.
- **Long-running tmux server with high scrollback** (24 panes, ~28 MB rendered text, top `history_bytes` 82 MB) — the conditions under which sweep overrun becomes the dominant regime.
- **Low-frequency recycle triggers compound over long uptime.** Stale-pidfile recovery, manual session kills, brew upgrades, and mid-tick crashes are all rare individually but accumulate over a 10-day server uptime to produce the observed 7-daemon snapshot.
- **Topology-churn from any saver recycle.** When the kill-respawn path does fire, the resulting `session-closed`/`session-created` hooks write `save.requested`, keeping the daemon's dirty flag set and pushing surviving daemons into the back-to-back-sweep regime exactly when the kill race is most live.

### Why It Wasn't Caught

- **No singleton invariant test.** The comment at `portal_saver.go:31-32` documents the desired property but no integration test asserts it. A test that runs two `EnsurePortalSaverVersion` calls back-to-back in a real-tmux fixture and asserts a single live daemon would catch this in CI.
- **Unit-level seam tests** (`BootstrapAliveCheck` is a `var` for test override) verify the alive-check **for a given pidfile** but cannot model "what happens when the pidfile is overwritten while the prior daemon still runs."
- **Sweep-duration unrealistic in CI.** The bug is latent at N=1 with sub-second sweeps; it only manifests when sweep overrun + saver-recycle frequency combine. No load test exists at realistic scrollback scale.
- **Saver recycle is silent.** The kill-respawn path in `EnsurePortalSaverVersion` and `BootstrapPortalSaver` logs nothing at the moment it decides to recycle, so an operator has no signal that a kill happened or how often. Even if multiplication were happening continuously, the visibility surface for "daemon was killed; replacement is starting" is zero.

### Blast Radius

**Directly affected:**
- All tmux operations on the affected tmux server (not just portal-managed sessions): TUI redraws, prefix keystrokes, `tmux ls` itself.
- `_portal-saver` session lifecycle and the resurrection capture loop.
- Shared state files written by the daemon: `sessions.json` (atomic, but two daemons can race the `_, _ = cancel()` between read and commit, producing flip-flop sessions across consecutive ticks), per-pane scrollback `.bin` files (`fileutil.AtomicWrite` is per-call atomic, but two daemons writing the same pane key can interleave content versions across ticks).
- `daemon.pid` and `daemon.version` markers — incoherent under multiplication; `BootstrapAliveCheck` becomes meaningless once N > 1.
- `save.requested` flag — both daemons race to remove it on successful sweep; remove on the loser's side is a benign no-op via `errors.Is(err, fs.ErrNotExist)`.

**Potentially affected:**
- FIFO sweep paths: two daemons could both call into `state` cleanup helpers concurrently. The `FIFOSweeper` runs only in bootstrap (single-shot per process), so daemon-side FIFO interaction is read-only — likely safe but worth confirming during fix design.
- Any future seam expecting daemon-singleton semantics (e.g. a centralised hook queue) would silently break.

---

## Fix Direction

### Chosen Approach

**Proposed scope (pre-discussion):** close the structural multiplication via a coordinated pair of changes:

1. **Daemon-side singleton lock** in `cmd/state_daemon.go`. At daemon startup — before `WritePIDFile`, before the tick loop — acquire an advisory file lock on `<stateDir>/daemon.lock` via `unix.Flock(fd, LOCK_EX|LOCK_NB)`. On failure (another daemon holds the lock), log a single WARN line *"another daemon holds the lock; exiting"* and exit 0. The lock is held for the lifetime of the process and released by kernel on exit. This is the **structural invariant**: even if every other guard fails, the lock guarantees N ≤ 1 daemons writing to the same state directory.

2. **Synchronous kill in `EnsurePortalSaverVersion`** (`internal/tmux/portal_saver.go`). Before issuing `KillSession`, read the prior `daemon.pid` via `state.ReadPIDFile(stateDir)` and capture it. After `KillSession`, poll `state.IsProcessAlive(prior_pid)` until it returns false, bounded by a 5-second timeout (covers the cold-sweep upper bound at the observed scrollback profile with headroom over the 3.9 s measurement). On timeout, log a WARN and proceed — the new daemon's lock acquisition is the safety net. This is the **graceful upgrade path**: most recycles will see the old daemon exit cleanly and the new one start with no lock contention or log noise.

   The barrier applies to both call sites that fire a kill: the version-mismatch branch in `EnsurePortalSaverVersion` (lines 108-112) and the stale-pidfile branch in `BootstrapPortalSaver` (lines 66-70). Refactor the kill+wait into a shared helper rather than duplicating the poll loop.

Both changes compose:
- (1) alone closes the bug but produces noisy WARN lines on every saver recycle (because the new daemon races the old one and loses the lock until the old one releases). Functionally correct but undignified.
- (2) alone reduces the race window but does not eliminate it (a sweep can outlast the timeout) and provides no defence against any other path that might double-spawn the daemon.
- (1)+(2) together: (2) makes the common case quiet, (1) makes every edge case safe.

**Deciding factor (proposed):** the user reported wanting a structural fix. The pidfile-as-singleton design is the gap the inbox identified — closing it as a proper `flock` is the cleanest answer. Synchronous kill is the smallest additional change to keep upgrade transitions clean. Both live entirely within `cmd/state_daemon.go` and `internal/tmux/portal_saver.go` — no orchestrator surgery, no test-pattern departures.

### Out-of-Scope Candidates (Flagged for Discussion)

These are real defects in adjacent layers but are not strictly required to fix the multiplication symptom. Bundling them adds risk and surface area. Each is a defensible separate work unit.

- **(C) Bound `capture-pane -S -<N>`** in `internal/tmux/tmux.go:625`. Measured 13× speedup, 130× less data with `-S -100`. **High-leverage perf lever, even at N=1.** Trades off how much scrollback history is preserved in `_portal-saver`-driven restore — that's a feature decision, not a bug fix. Worth flagging to the user for a separate work unit on "bound scrollback capture cost."

- **(D) Tighten `portalSaverVersionMismatch`**. The `dev`-string special case (`portal_saver.go:124-127`) is the high-frequency trigger for dev-build users. Could plausibly be relaxed to "treat `dev` as a normal version string and only recycle when `stored != currentVersion`." Lower priority once (1)+(2) make the recycle path safe — the recycles still happen, but they're now harmless.

- **(E) Cheaper change-detection before `capture-pane`** (e.g. `display-message -p '#{cursor_x},#{cursor_y},#{history_size}'`). Today the hash dedup at `WriteScrollbackIfChanged` only avoids the **file write**, not the `capture-pane` call (which is the cost driver). A per-pane "did anything change since last tick" probe before capture would let the dedup avoid the expensive call. Larger refactor; defer.

### Options Explored

- **Singleton flock alone (no synchronous kill).** Rejected for noise reasons — every saver recycle would produce a "lock held; exiting" WARN line and (briefly) an empty `_portal-saver` session until the next bootstrap retries. Functionally correct but a poor user experience for an upgrade path that should be silent.

- **Synchronous kill alone (no flock).** Rejected — closes the common-case race but provides no defence against double-spawn through any future code path. The lock is the structural invariant; without it, "no two daemons can coexist" remains a comment, not an enforced property.

- **Spin-wait inside `BootstrapPortalSaver` until lock is acquirable.** Rejected — bootstrap is on the critical path of every `portal` command and must stay fast. A 1.5–4 second hold for lock acquisition would make every command sluggish. Synchronous kill in `EnsurePortalSaverVersion` is the targeted alternative: only happens on the recycle path, bounded timeout, doesn't punish the steady state.

- **PID-file-as-lock via `O_EXCL` create.** Rejected — `O_EXCL` is a one-shot atomic-create primitive, not a held lock. It leaks on crash (file lingers) and would need its own cleanup-on-startup dance. `flock` is the right primitive for "held while process is alive."

- **Treat `_portal-saver` session presence as the singleton signal** (don't kill at all on dev-build mismatch). Rejected — would require teaching the daemon to handle version-mismatch internally and self-exit. Larger surgery; the kill-respawn protocol is otherwise sound, just needs a synchronisation barrier.

### Discussion

The discussion progressed through three corrections of inherited assumptions before settling on the fix:

1. **Mixed release/dev binaries on PATH** — the inbox's headline trigger hypothesis. User confirmed they don't have both binaries. Dropped.

2. **Dev-build trigger fires on every command** — the follow-up hypothesis after (1). Verified false with `portal version` and `cat daemon.version`: both report `0.3.1`, so `portalSaverVersionMismatch` returns false and the version-mismatch kill path is dormant for this user. The 7-daemon accumulation comes from low-frequency triggers (stale pidfile, manual kills, brew upgrades, daemon crashes) compounding over the 10-day uptime — not from a high-frequency recycle source.

3. **Where the fix needs to live** — the kill barrier originally proposed for `EnsurePortalSaverVersion` alone, but the synthesis agent's gap (4) and a re-read of `BootstrapPortalSaver:66-70` confirmed the stale-pidfile recovery branch is a second kill call site. Both need the barrier; a shared helper is the cleaner shape.

What the journey shifted:

- **Frequency vs. structure.** The structural defects (no singleton, no sync barrier) are the load-bearing failure mode. Trigger frequency is incidental — the fix closes the race regardless. This freed the design from chasing a frequency-narrative.
- **5 s timeout, not 3.** The cold-sweep upper bound from the inbox measurements is 3.9 s. A 3 s timeout would fire WARN-and-proceed for users at the observed scrollback profile. 5 s puts the timeout above the cold-sweep ceiling.
- **Lock as last-resort invariant.** The lock isn't redundant with the kill barrier — it's the floor that protects against any future code path that double-spawns the daemon. The graceful path (sync kill) keeps the lock acquisition silent in the common case.

Decisions deferred to spec/planning:

- Whether to bound `capture-pane -S -<N>` (option C). Flagged as a separate work unit candidate. Doesn't affect this fix.
- Whether to tighten `portalSaverVersionMismatch` once recycles are harmless. Likely unnecessary.
- Whether to use `LOCK_EX|LOCK_NB` (fail-fast, what's proposed) or `LOCK_EX` blocking. Fail-fast is simpler and the bootstrap retry path covers the rare case where a loser exits and the next bootstrap recovers.

### Testing Recommendations

- **Unit:** `cmd/state_daemon_test.go` — new tests for the singleton lock seam. Mock the `flock` call via a package-level `var lockAcquire = unix.Flock` seam (matching the existing test-seam pattern at `daemonRunFunc` / `daemonShutdownFunc`). Test cases: lock acquired successfully → daemon proceeds; lock acquisition fails (EWOULDBLOCK) → daemon logs and exits 0; lock fd is set FD_CLOEXEC.
- **Unit:** `internal/tmux/portal_saver_test.go` — new tests for the synchronous kill barrier. Use the existing `BootstrapAliveCheck` seam (`var`) plus new seams for `ReadPIDFile` and the polling clock. Test cases: prior PID dies within timeout → barrier returns cleanly; prior PID does not die within timeout → barrier logs WARN and proceeds; no prior PID file → barrier skips. The barrier should be exercised through **both** call sites (version-mismatch path and stale-pidfile path).
- **Integration (real-tmux fixture):** new test under `internal/tmux/portal_saver_integration_test.go` (using `restoretest`/`tmuxtest` conventions). Two back-to-back `EnsurePortalSaverVersion` calls in the same test against a real tmux server → assert exactly one live `portal state daemon` process. Skip on CI without tmux available.
- **Regression:** flock-loser recovery test — simulate the case where a new daemon fails lock acquisition and exits 0, leaving an empty `_portal-saver` session. Assert the next bootstrap recovers via the tolerant-kill-and-recreate branch in `BootstrapPortalSaver`.

### Risk Assessment

- **Fix complexity:** Low. Both changes are localised. Singleton lock is ~15 lines in `state_daemon.go` plus a small seam for testing. Synchronous kill is ~20 lines in `portal_saver.go` (shared helper + two call sites) plus seams.
- **Regression risk:** Low–Medium. The kill barrier introduces a new (bounded) wait on the bootstrap critical path. Worst-case latency = bounded timeout (5 s). Median case: prior daemon exits in under 100 ms. The wait only fires when a kill actually happens (rare for this user; possibly more frequent for others). Risk surface: timeout is too short for users with even heavier scrollback than the observed 24-pane / 28 MB profile — mitigated by the lock being the actual structural invariant; timeout firing surfaces a single WARN line, not a regression.
- **Recommended approach:** Regular release. No hotfix needed — workaround for affected users is `tmux kill-session -t _portal-saver` followed by `pkill portal` (or `tmux kill-server` for the heaviest impact). Likely few users are affected — the observed accumulation rate is consistent with one orphan every ~34 hours of tmux uptime.

---

## Notes

- The bug report explicitly self-corrected several earlier claims (history_bytes ≠ rendered text; daemons not all in `_portal-saver`; hooks were registered the whole time; dirty flag only set on topology events). Trust the corrected version.
- Companion side-observation: 3 stale `sh -c 'portal state hydrate …; exec $SHELL'` wrappers from a ~20-hour-old bootstrap. PaneKeys recur with `killed-sessions-resurrect-on-restart`. Trailing `; exec $SHELL` is unreachable because hydrate has exited and the wrapper is parked on the child shell. Not load-causing — log as separate observation, not part of this fix.
