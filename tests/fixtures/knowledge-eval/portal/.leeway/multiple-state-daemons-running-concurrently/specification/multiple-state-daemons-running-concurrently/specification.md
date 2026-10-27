# Specification: Multiple State Daemons Running Concurrently

## Specification

## Problem Statement

### What's broken

Up to seven `portal state daemon` processes were observed running concurrently against the same tmux server, all parented to the tmux server PID. Only one was the daemon hosted inside the `_portal-saver` session; the other six were past-lifecycle orphans — their owning session had been killed, but their in-flight `tick()` had not yet observed the cancelled context.

Expected behaviour: **exactly one** `portal state daemon` process per **state directory** at any time. In practice `stateDir` resolves per-user (via XDG config path resolution), so this is equivalent to "one daemon per user" — a single user running two tmux servers against the same `stateDir` will see one daemon shared between them, and the second-started tmux server's bootstrap will hit the lock and recover via the standard contention path. Multi-tmux-server-per-user is an unusual configuration; isolating daemons per tmux server is **not** in scope for this fix. Bootstrap-driven kill+respawn cycles (e.g. version-mismatch upgrades) should produce a clean handover — the old daemon exits before the replacement starts writing to shared state.

### Impact

- **Severity: High.** When 2+ daemons run concurrently the tmux server pegs at 75–98% CPU. The cost is in `capture-pane -e -p -S -` (unbounded scrollback) called by each daemon's per-pane sweep — `sample` shows all time in `cmd_capture_pane_exec` → `grid_string_cells` → `grid_string_cells_add_code`. Observational confirmation: 1 s-resolution `ps` snapshots showed 4–7 concurrent `tmux capture-pane -e -p -S -` child processes (one per running daemon mid-sweep) and a one-to-one correlation between daemon count and the CPU peg. With zero daemons running, server CPU dropped to 0–22% and capture-pane processes dropped to zero — confirming daemons are the workload, not some other process.
- **Scope: server-wide.** All tmux operations on the affected server become sluggish — not just portal-managed sessions. TUI redraws, prefix keystrokes, and `tmux ls` itself become multi-second-slow. Load average sustained 5–10 during the observation window.
- **Shared-state corruption.** Multiple daemons writing the same state directory: `sessions.json` (atomic per-commit but two daemons race the read-then-commit window, producing flip-flop content across consecutive ticks), per-pane scrollback `.bin` files (`AtomicWrite` is per-call atomic but the two writers can interleave content versions), and `daemon.pid`/`daemon.version` markers become incoherent — `BootstrapAliveCheck` becomes meaningless once N > 1. The `save.requested` flag is a notable exception — both daemons race to remove it on successful sweep, but the loser's remove is a benign no-op via `errors.Is(err, fs.ErrNotExist)`.

### Potentially affected (to confirm during planning)

- **FIFO sweep paths.** Two daemons could in principle both call into `state` cleanup helpers concurrently. `FIFOSweeper` itself runs only in bootstrap (single-shot per process), so daemon-side FIFO interaction is read-only — investigation assessed this as "likely safe" but flagged that the fix design should explicitly confirm there is no daemon-side write path that two concurrent daemons could race on.

### Trigger frequency

Trigger frequency is **incidental to the bug.** The observed accumulation (~7 orphans over 10 days uptime) is consistent with low-frequency events compounding — stale pidfile recovery, manual session kills, brew upgrades, daemon crashes mid-tick. The version-mismatch path is dormant on a normal user with matching real semver on both `portal version` and `daemon.version`.

The structural defects (covered in Root Cause) make any kill-respawn trigger — high or low frequency — capable of producing an orphan. The fix closes the race regardless of how often the trigger fires.

**Reproducibility caveat.** The whole observation is a **single snapshot** from one user (2026-05-09). The fix is justified by structural inevitability (the bootstrap race + missing singleton lock), not by repeated observation. Any future occurrence of any kill-respawn trigger reproduces the accumulation mechanism; the spec's confidence in the fix shape derives from the code trace, not from N>1 field reports.

### Recovery for affected users

Workaround: `tmux kill-session -t _portal-saver` followed by `pkill portal` (or `tmux kill-server` for the heaviest impact). No hotfix needed — likely few users are affected at the observed accumulation rate of roughly one orphan per 34 hours of tmux uptime.

## Root Cause

The bug is the conjunction of **two structural defects** in the saver-bootstrap and daemon-startup pair. Neither alone produces the accumulation; together they make it inevitable on every kill-respawn cycle.

### Defect 1: No singleton enforcement

`state.WritePIDFile` and `BootstrapAliveCheck` cooperate as an **informational pidfile**, not as a singleton lock:

- `cmd/state_daemon.go:226` — `state.WritePIDFile(dir, os.Getpid())` is called by every starting daemon, **before** the tick loop begins. Implementation in `internal/state/daemon_state.go:33-36` is `fileutil.AtomicWrite` (temp + rename) — last writer wins, no locking.
- `internal/state/daemon_state.go:82-88` — `DaemonAlive` reads `daemon.pid` then `IsProcessAlive` (signal-0 probe). After a new daemon overwrites the file, `DaemonAlive` sees only the new PID — the prior daemon's PID is no longer recorded anywhere and is invisible to any future `BootstrapAliveCheck`. The orphan is now unreachable through portal's bootstrap surface.

Consequence: once two daemons coexist for any reason, nothing in the system prevents both from running concurrent capture loops over the same state directory.

### Defect 2: Bootstrap does not synchronise with the killed daemon's exit

`EnsurePortalSaverVersion` issues `KillSession`, then `BootstrapPortalSaver` immediately observes "no session" and creates a fresh one — **no aliveness barrier between kill and respawn**:

- `internal/tmux/portal_saver.go:106-114` — `EnsurePortalSaverVersion` calls tolerant `KillSession(_portal-saver)` then unconditionally calls `BootstrapPortalSaver`.
- `internal/tmux/portal_saver.go:63-83` — `BootstrapPortalSaver` calls `HasSession(PortalSaverName)`, observes the kill just took effect → false, falls through to `createPortalSaverWithRetry`.
- `internal/tmux/portal_saver.go:138-158` — `createPortalSaverWithRetry` calls `NewDetachedSessionNoCwd(PortalSaverName, "portal state daemon")` which forks-execs the new daemon process as soon as tmux returns from `new-session`.

The new daemon starts and writes its PID before the old daemon — currently mid-`tick()` — observes the cancelled context.

### Why the old daemon survives the kill signal

The kill arrives but the old daemon does not exit promptly:

- `cmd/state_daemon.go:54-63` — `defaultDaemonRun` is `for { select { ticker.C / ctx.Done() } }`. `tick()` runs synchronously inside the same select arm; **`ctx.Done()` is only reachable between ticks, never during one.**
- `cmd/state_daemon.go:265-270` — `signal.Notify(sigCh, SIGHUP, SIGTERM)` flips the context via `cancel()`, but the cancellation is observed only after the in-flight `tick()` completes.
- `cmd/state_daemon.go:115-158` — `captureAndCommit` runs sequentially: marker list → `CaptureStructure` → per-pane `CaptureAndHashPane` (always invokes `capture-pane` for the hash) → `WriteScrollbackIfChanged` → `state.Commit`. The dedup only avoids the **file write**, not the expensive `capture-pane` call.

Sweep cost is the cost driver. `internal/tmux/tmux.go:625` uses `capture-pane -e -p -S -` (unbounded scrollback). Measured 24-pane sweep: **3.9 s cold / 1.5 s warm** at the observed scrollback profile (~28 MB rendered text). The Go ticker drops missed fires, so when a sweep overruns the 1 s tick interval the next tick fires immediately on completion — daemons in this regime **never reach `ctx.Done()` between sweeps**, extending the orphan-eligibility window indefinitely after a kill.

**Recycle-induced sweep pressure.** The kill-respawn event itself generates `session-closed` and `session-created` tmux hooks. Both fire `save.requested`, which keeps the daemon's dirty flag set and forces the surviving daemon's sweep into the back-to-back regime described above. The cancel-to-exit window is therefore widest precisely on the recycle path that the fix must defend — the worst-case kill-barrier latency is structural to the recycle event, not a tail-case observation.

### How the defects compose

- (1) alone: a benign condition — at N=1 the informational pidfile is sufficient.
- (2) alone: would produce a brief race window that resolves once the old daemon's sweep ends — except the absence of (1) means the old daemon, having lost its pidfile to the new daemon, becomes a permanent orphan instead of being cleaned up on the next bootstrap.
- (1)+(2) together: every kill-respawn cycle pushes N from 1 to 2+. Orphans accumulate over uptime.

### Why the design promised more than it delivered

The original design comment at `internal/tmux/portal_saver.go:28-33` states: *"tmux owns the daemon's lifecycle: when this session is killed (or the server dies), the kernel delivers SIGHUP to the daemon for graceful shutdown."* This is true in principle, but **graceful ≠ instant** — the daemon shuts down at the end of its current sweep, not on signal receipt. The lifecycle promise is honoured eventually, but the bootstrap path treats it as synchronous.

## Fix Part 1: Daemon-Side Singleton Lock

### Purpose

A structural invariant that guarantees **N ≤ 1 daemons** ever write to the same state directory, regardless of how they were started. This is the floor that holds even if every other guard fails.

### Behaviour

At daemon startup — **before** `WritePIDFile`, **before** the tick loop begins — acquire an advisory file lock on `<stateDir>/daemon.lock`:

- Use `unix.Flock(fd, LOCK_EX|LOCK_NB)` (exclusive, non-blocking).
- **Success path:** lock acquired → daemon proceeds normally (writes pidfile, enters tick loop). Lock is held for the lifetime of the process and released by the kernel on exit (`exit(0)`, `exit(N)`, signal-kill, crash — all release the fd).
- **Fd retention is load-bearing.** The lock fd MUST be held in a variable that lives for the lifetime of the daemon process — for example, a package-level `var` in the daemon command, or a field on a struct kept alive by the run loop. The fd MUST NOT be allowed to go out of scope while the daemon is running; Go's finalizer mechanism could otherwise close the fd, releasing the lock while the daemon is still active and silently re-introducing the very race the lock is meant to close. If a future refactor wraps the fd in a value with a finalizer, the finalizer must not close the fd.
- **Contention path:** lock acquisition fails (EWOULDBLOCK) → daemon logs a single WARN line *"another daemon holds the lock; exiting"* (or equivalent — log content not load-bearing, presence of the log line is) and exits with status 0. Exit 0 ensures tmux does not treat this as an abnormal session termination.
- The lock fd must be set `FD_CLOEXEC` so it does not leak into any child process the daemon forks.

### Lock-file create / open semantics

- The lock file is opened with mode `0600` (matching the file mode of other portal state files).
- The lock helper does **not** create `<stateDir>` itself. State-directory existence is a pre-existing responsibility of the caller (the daemon-startup path already writes other state files; whichever step ensures the directory exists today still does so).
- `open(2)` failures **other than** `EWOULDBLOCK` (which comes from `flock`, not `open`) — e.g. `EACCES`, `ENOSPC`, `ENOENT`, `EMFILE`, `ENFILE` — are treated as fatal: the daemon logs an ERROR-level line describing the failure and exits **non-zero**. This is distinct from the contention path (lock held → WARN + exit 0): an `open` failure indicates a genuine misconfiguration or system problem that should be surfaced loudly, not absorbed silently.

### Placement and structure

Lock acquisition belongs in `cmd/state_daemon.go`, before the call to `state.WritePIDFile` at line 226. The lock helper itself may live in `internal/state` (alongside the pidfile helpers) for symmetry — final package placement is a planning decision, but the lock must execute on the daemon-startup path before any state-directory write.

The lock acquire call should be **seamed for testing** via a package-level `var lockAcquire = unix.Flock` (or similar), matching the existing test-seam pattern at `daemonRunFunc` / `daemonShutdownFunc`. Tests inject a fake that simulates acquire success, acquire failure, and inspects FD_CLOEXEC state.

### Why fail-fast (`LOCK_EX|LOCK_NB`) and not blocking (`LOCK_EX`)

A blocking acquire would cause the loser daemon to sit waiting on the lock until the winner exited — but the loser was launched as the initial process of a tmux session, so a long block holds tmux's `new-session` synchronously. Fail-fast keeps the contention path bounded (one log line, immediate exit). The bootstrap retry path covers the rare case where a loser exits and the next `portal` command needs to recover by recreating `_portal-saver` (the tolerant-kill-and-recreate branch in `BootstrapPortalSaver`).

### Loser-daemon session aftermath

When the loser exits status 0 as the initial process of `_portal-saver`, default tmux behaviour (no `remain-on-exit`) closes the window — and since the session has only that one window, the **session itself closes**. The next bootstrap therefore typically observes `HasSession(_portal-saver) == false` and falls through to `createPortalSaverWithRetry` (no kill barrier invoked — there is no prior session to kill). If `remain-on-exit` is in effect for any reason, the next bootstrap observes the session with a dead pane, hits the stale-pidfile recovery branch, runs the barrier (which returns immediately because the prior PID is already dead), and recreates. Both convergence paths are recoverable.

### Why a lock and not `O_EXCL` pidfile create

`O_EXCL` is a one-shot atomic-create primitive, not a held lock. It leaks on crash (the file lingers, blocking startup until manually cleaned) and would need its own cleanup-on-startup dance. `flock` is the right primitive for "held while process is alive."

### Compatibility with the existing pidfile

The pidfile (`daemon.pid`) is retained. It continues to record the current daemon's PID for `BootstrapAliveCheck` and is rewritten by every successful lock-acquirer **after** the lock is held. With the lock in place, the pidfile transitions from "informational and racy" to "informational and authoritative" — it always reflects the single daemon that won the lock.

## Fix Part 2: Synchronous Kill Barrier

### Purpose

Make the **common-case** kill-respawn quiet: before a kill is followed by a respawn, wait for the prior daemon to actually exit. This keeps the daemon-side singleton lock (Part 1) from firing its WARN line on every recycle. Without the barrier, every saver recycle would produce noisy *"lock held; exiting"* lines and (briefly) an empty `_portal-saver` session until the next bootstrap retries. Functionally safe via the lock, but undignified.

### Behaviour

The barrier wraps the kill operation:

1. **Before** issuing `KillSession`, read the prior `daemon.pid` via `state.ReadPIDFile(stateDir)` and capture the PID.
2. Issue `KillSession(_portal-saver)` as today.
3. **After** the kill, poll `state.IsProcessAlive(prior_pid)` until it returns false. Polling cadence is a planning detail (50–100 ms is a reasonable starting point); bound the total wait by a **5-second timeout**.
4. **On clean exit within timeout** → proceed silently to `BootstrapPortalSaver`. This is the expected path.
5. **On timeout** → log a single WARN line and proceed to `BootstrapPortalSaver`. The new daemon's lock acquisition (Part 1) is the safety net — either the prior daemon has already released the lock and the new one succeeds, or the new one will fail-fast and the next bootstrap recovers.
6. **No usable prior PID** (file missing, unreadable, empty, or malformed — e.g. non-numeric content from a partial write) → barrier is skipped, proceed directly to respawn. There is no prior daemon to wait for.
7. **Prior PID file points to a dead process** (signal-0 already returns false) → barrier completes immediately, proceed.

### Timeout rationale

5 seconds is chosen specifically to sit **above the cold-sweep upper bound** of 3.9 s measured on the affected user's scrollback profile (24 panes, ~28 MB rendered text), with margin. A 3 s timeout would fire WARN-and-proceed on cold-cache restarts at this profile. 5 s keeps the WARN path reserved for genuinely stuck daemons (or users with even heavier scrollback than the observed sample) rather than ordinary cold sweeps.

### Both kill sites use the barrier

There are **two kill call sites** in the saver-bootstrap surface and **both** must use the barrier — these are not alternatives:

1. **`EnsurePortalSaverVersion`** version-mismatch branch (`internal/tmux/portal_saver.go:108-112`) — fires when stored ≠ current version.
2. **`BootstrapPortalSaver`** stale-pidfile recovery branch (`internal/tmux/portal_saver.go:66-70`) — fires when the session exists but `BootstrapAliveCheck` reports the daemon dead.

The two sites are factored into a **shared helper** (e.g. `killSaverAndWaitForDaemon(c, stateDir) error`) rather than duplicating the poll loop. The helper takes the tmux client + state directory, reads the prior PID, kills the session, polls, returns nil on clean exit and a non-fatal error on timeout (or returns nil with the call site logging — exact error shape is a planning decision).

### Test seams

The barrier should be testable without spawning real processes. Required seams:

- `ReadPIDFile` — already a function; use as-is or wrap behind a `var` for injection.
- The polling clock — `state.IsProcessAlive` and the time source (`time.Sleep` / `time.After`) need to be injectable so tests can simulate "PID dies after 200 ms" / "PID never dies" / "PID was already dead" without real processes or real waits.
- The existing `BootstrapAliveCheck` seam (`var` in `internal/tmux/portal_saver.go`) is unrelated and unchanged — it operates on the session-presence check, not the kill barrier.

### Critical-path latency budget

The barrier executes on the bootstrap critical path only when a recycle actually happens — i.e. when the kill branch fires. It does **not** add latency to the steady-state path where the saver already exists and the version matches.

- **Median case** when a recycle does fire: prior daemon exits in under 100 ms (most ticks are sub-second; the cold-sweep ceiling is the worst case, not the typical case).
- **Worst case**: bounded 5 s timeout.

This trade is acceptable because (a) the recycle path is rare per `EnsurePortalSaver` invocation and (b) the alternative is silent corruption from N > 1 daemons.

### Interaction with `@portal-restoring` marker

Bootstrap step 3 sets `@portal-restoring`; step 4 (EnsureSaver) is where the kill barrier fires; step 7 clears `@portal-restoring`. On the barrier-timeout path, the marker remains set for up to 5 s longer than in current behaviour. This is **explicitly acceptable**: the marker is designed to bracket the whole bootstrap window, daemon `captureAndCommit` suppression is the intended behaviour while it is set, and a 5 s extension does not affect the correctness of steps 5 (Restore), 6 (EagerSignalHydrate), or downstream warning surfacing. The "Critical-path latency budget" caveat above applies to the overall bootstrap, not specifically to the marker.

### Why not spin-wait inside `BootstrapPortalSaver` until the lock is acquirable

Rejected during investigation discussion: bootstrap is on the critical path of every `portal` command and must stay fast. A 1.5–4 second hold to wait for lock release would make every command sluggish whether or not a recycle was happening. The barrier scopes the wait to **only the recycle path**.

### Why not treat `_portal-saver` session presence as the singleton signal

Considered and rejected during investigation. The idea: skip the kill+respawn entirely on dev-build mismatch and let the daemon detect version-mismatch internally and self-exit. Rejected because it would require teaching the daemon to introspect and manage its own version lifecycle — significantly larger surgery than the kill barrier + lock. The kill-respawn protocol is otherwise sound; it needs a synchronisation barrier, not a redesign.

## Acceptance Criteria

The fix is correct when **all** of the following hold:

### Singleton invariant

- At most one `portal state daemon` process exists per state directory at any time, regardless of how many bootstrap invocations have run during the tmux server lifetime.
- Verified by: an integration test (real-tmux fixture) that runs two back-to-back `EnsurePortalSaverVersion` calls — one must trigger a recycle via version mismatch — and asserts exactly one live `portal state daemon` process when both calls complete.
- Verified manually by: running `pgrep -P <tmux-server-pid> -f 'portal state daemon'` after repeated bootstrap invocations and observing a count of exactly 1.
- **Forward-compatibility rationale.** Singleton-ness is a structural property that future seams may depend on (e.g. a centralised hook queue, a single-writer log channel). Once 2+ daemons are possible, any such seam silently breaks. The lock (Part 1) is the floor that holds this property even under code paths not yet written.

### Clean handover on the common case

- "Common case" = a **single** bootstrap invocation triggering a recycle (e.g. one `portal` command on an upgraded binary). Concurrent bootstrap invocations (two `portal` commands started in close succession) are not the common case and may produce one WARN line on whichever loses the lock — this is accepted behaviour, with Part 1 guaranteeing safety.
- When a single-invocation saver recycle is triggered (version mismatch, stale pidfile, manual session kill), the prior daemon's process has exited before the new daemon begins its first tick.
- No WARN line about lock contention is emitted on the single-invocation recycle path.
- Verified by: barrier unit tests (prior PID dies within timeout → returns cleanly, no log) and a manual recycle test against the affected scrollback profile.

### Graceful degradation under timeout

- If the prior daemon does not exit within the 5-second timeout, the bootstrap proceeds to respawn — it does not block indefinitely.
- The new daemon's `flock` acquisition either succeeds (prior daemon released between timeout and respawn) or fails cleanly (prior daemon still holds the lock), with the loser exiting status 0 after a single WARN line.
- The next `portal` invocation recovers via the tolerant-kill-and-recreate branch in `BootstrapPortalSaver`. No manual user intervention is required.

### No regression on the steady-state critical path

- When the saver already exists and the version matches (no recycle needed), `EnsurePortalSaverVersion` does not invoke the kill barrier. Latency on this path is unchanged from current behaviour.
- Verified by: barrier unit tests confirming the barrier is only entered from the kill call sites; no broad timing test required.

### Pidfile remains coherent

- After every successful bootstrap, `daemon.pid` reflects the PID of the daemon that won the lock — **while that daemon is running**. The pidfile is informational and is not required to be cleaned up on graceful shutdown (`BootstrapAliveCheck` already tolerates stale-after-exit content via its signal-0 probe).
- `BootstrapAliveCheck` reads `daemon.pid` and finds the lock-holding process alive (while running) or detects the dead PID and proceeds to the stale-pidfile recovery branch (after exit).
- Verified by: the existing pidfile/`BootstrapAliveCheck` unit tests continue to pass; the new lock acquisition occurs **before** `WritePIDFile` so the file is never written by a daemon that loses the lock.

### Lock cleanup on crash

- A daemon that crashes (panic, SIGKILL, OS reboot) releases the lock via kernel fd cleanup. The next daemon startup acquires cleanly without a stale-lockfile dance.
- Verified by: a regression test that simulates abrupt exit and confirms the next acquisition succeeds.

### Observability

- The fix emits at most **two new WARN-class log lines** across the bug surface, one per logical event:
  1. The lock-contention event (loser daemon) — example text *"another daemon holds the lock; exiting"*.
  2. The barrier-timeout event — example text *"prior daemon did not exit within timeout"*.
- **Log content is illustrative, not load-bearing.** Tests assert the **presence and WARN level** of one log line per event — not the literal text. Implementers may adjust wording without breaking tests; reviewers should not consider rewording a regression.
- No new logs are emitted on the common-case (clean handover) path. Silent success is the expected behaviour.
- **Recycle-path silence is preserved (and acknowledged as a trade-off).** The investigation's "Why It Wasn't Caught" called out the existing kill-respawn path's total silence — operators have no signal that a recycle happened or how often. The spec does **not** add a diagnostic/info-level log at the recycle decision point. The two WARN paths above are sufficient to surface the abnormal cases (loser contention, barrier timeout). If recurrence diagnostics become a need, that is a follow-up observability work unit, not part of this fix.

## Out of Scope

The investigation identified adjacent defects in the same surface area. Each is a real issue but is **not required** to fix the multiplication symptom. Bundling them would expand the change surface, increase regression risk, and conflate distinct decisions. They are flagged here so planning does not pick them up by accident, and so future work units can reference them.

### Out: Bounding `capture-pane -S -<N>` scrollback depth

Location: `internal/tmux/tmux.go:625` uses `capture-pane -e -p -S -` (unbounded).

Measured impact: switching to `-S -100` produced **13× faster** sweeps (293 ms vs 3.9 s) and **130× less data** at the affected user's profile.

Why deferred: this is a perf lever and a **feature decision** — how much scrollback history portal preserves for `_portal-saver`-driven restore. The current bug's root cause is structural (the kill race + missing lock), and the fix closes it regardless of sweep duration. Bundling a scrollback-depth change would entangle a behavioural decision (how much history to keep) with the bugfix.

Disposition: candidate for a separate work unit on *"bound scrollback capture cost."*

### Out: Tightening `portalSaverVersionMismatch`

Location: `internal/tmux/portal_saver.go:124-127`, the `dev`-string special case.

Current behaviour: `portalSaverVersionMismatch(stored, current, readErr)` returns true on any of `readErr != nil`, `current ∈ {"", "dev"}`, `stored ∈ {"", "dev"}`, or `stored != current`. The `dev` clauses trigger a recycle on every command for dev-build users.

Why deferred: once Parts 1+2 of this fix make the recycle path safe, dev-build recycles are harmless — they happen, but they no longer accumulate daemons. The mismatch logic could be relaxed to "treat `dev` as a normal version string," but that's a separate design call about how dev builds interact with the saver.

Disposition: lower priority; revisit only if dev-user feedback indicates the per-command recycle is itself a problem.

### Out: Cheaper change-detection before `capture-pane`

Idea: a per-pane "did anything change since last tick" probe before the expensive `capture-pane` call — for example, `display-message -p '#{cursor_x},#{cursor_y},#{history_size}'` keyed per pane. Today the hash dedup at `WriteScrollbackIfChanged` only avoids the **file write**, not the capture. A pre-capture probe would let the dedup avoid the cost driver itself.

Why deferred: larger refactor across the daemon's per-pane loop. Orthogonal to multiplication. Worth doing eventually for steady-state cost, but not load-bearing for this bug.

Disposition: defer; potentially folded into a broader daemon-cost work unit.

### Out: Stale `; exec $SHELL` wrappers from hydrate helper

Companion observation in the investigation: 3 stale `sh -c 'portal state hydrate …; exec $SHELL'` processes were observed, traced to a ~20-hour-old bootstrap (i.e. long-stale, not recent). The trailing `; exec $SHELL` is unreachable because the wrapper is parked on the child shell after hydrate exits. PaneKeys overlap with `.workflows/killed-sessions-resurrect-on-restart/` (active, in implementation).

Why deferred: not load-causing for this bug. The wrappers are idle and do not contribute to the CPU pegging. Logged as a separate observation in the investigation Notes section.

Disposition: track as a standalone observation. May surface in the `killed-sessions-resurrect-on-restart` work unit since PaneKeys recur there.

### Out: Daemon tick loop restructure for prompt cancellation

The daemon's `tick()` running synchronously inside the `select` arm — preventing `ctx.Done()` from being observed mid-sweep — is a structural property contributing to the bug. A restructure (e.g. checking `ctx.Done()` between per-pane sweeps within a tick, or making `tick()` itself cancellable) would shorten the cancel-to-exit window from "rest of tick" to "rest of pane."

Why deferred: the kill barrier + singleton lock close the bug without this. Restructuring the tick loop is a larger surgery and changes daemon liveness semantics in ways that need their own design review. The 5 s barrier timeout is sized to absorb the current tick duration; tightening cancellation would let the barrier be reduced but does not eliminate the need for the lock.

Disposition: out of scope. Note for future work if daemon cost / liveness becomes a separate concern.

## Test Strategy

Tests are required across three tiers. Tests **must not** use `t.Parallel()` — the cmd package injects mocks via package-level mutable state and cleans up via `t.Cleanup()` (per project convention).

### Unit tests — daemon singleton lock

Location: `cmd/state_daemon_test.go` (new tests adjacent to existing daemon tests).

Mock seam: a package-level `var lockAcquire = unix.Flock` (or equivalent name in whichever package the helper lives in), matching the existing `daemonRunFunc` / `daemonShutdownFunc` test-seam pattern.

Required cases:

- **Acquire succeeds** → daemon proceeds past lock acquisition, calls `WritePIDFile`, enters the tick loop.
- **Acquire fails with EWOULDBLOCK** → daemon emits one WARN line, returns exit status 0, does **not** write the pidfile, does **not** enter the tick loop.
- **Lock fd has FD_CLOEXEC set** → asserted via fd flag inspection or via injecting a recorder that captures the fd-flag operations.
- **Acquire ordering** → `lockAcquire` is called before `WritePIDFile`; reverse order would allow a loser daemon to overwrite the pidfile before exiting. Asserted via **observable filesystem state**: after a failed-acquire test, the pidfile must remain at its previous value (or absent on a fresh state directory) — do not introduce a `WritePIDFile` seam solely for this assertion.

### Unit tests — synchronous kill barrier

Location: `internal/tmux/portal_saver_test.go` (extending existing test file).

Mock seams needed:
- `ReadPIDFile` (or a wrapper `var`)
- `IsProcessAlive` — injectable so tests simulate "alive then dead at T=200ms" / "alive forever" / "already dead" / "no PID" without spawning real processes.
- Time source (`time.Sleep` / `time.After` or an injected clock) — tests must complete without real waits.

Required cases:

- **Prior PID dies within timeout** → barrier returns nil, no WARN log emitted.
- **Prior PID does not die within timeout** → barrier returns (cleanly, non-fatally), single WARN log emitted, total wall time ≈ timeout (assert via injected clock).
- **No prior PID file** → barrier skips polling, returns immediately, no log.
- **Prior PID file points to dead process** (signal-0 already false) → barrier returns immediately, no log.
- **Prior PID file unreadable/corrupted** → barrier skips polling, returns immediately, no log (defensive — equivalent to no PID).
- **Barrier exercised through both call sites:**
  - Version-mismatch branch in `EnsurePortalSaverVersion`
  - Stale-pidfile branch in `BootstrapPortalSaver`
  - Both paths must invoke the shared helper. Asserted by triggering each path independently and recording barrier invocation.

### Integration test — singleton invariant under real tmux

Location: new `internal/tmux/portal_saver_integration_test.go` using `restoretest`/`tmuxtest` conventions (real-tmux socket fixture).

Skip behaviour: skip on CI when tmux is not available, matching existing patterns in `internal/tmux` integration tests.

Required case:

- **Back-to-back recycle produces N=1** — set up a real tmux server, run `EnsurePortalSaverVersion` to create the saver, then **directly write a different value into `<stateDir>/daemon.version`** between calls (no new test seam, exercises real `portalSaverVersionMismatch` comparison logic), then run `EnsurePortalSaverVersion` again to trigger the recycle, then assert `pgrep -P <tmux-server-pid> -f 'portal state daemon' | wc -l == 1` after both calls return.

This is the **load-bearing test** for the bug — it would have caught the issue in CI had it existed before. Crucially, the existing `BootstrapAliveCheck` seam-level unit tests cannot model the failure mode here: they fix a pidfile and probe it, but cannot model "what happens when the pidfile is overwritten while the prior daemon still runs." That asymmetry is the reason the integration test is required and is not redundant with seam-level coverage.

### Regression test — flock-loser recovery

Location: alongside the singleton-lock unit tests in `cmd/state_daemon_test.go`, or as a small integration test if real-process simulation is needed.

Required case:

- **Flock loser exits cleanly, leaving empty `_portal-saver` session** — simulate two daemon startup attempts where the second loses the lock and exits status 0. Verify the next bootstrap call recovers via the tolerant-kill-and-recreate branch in `BootstrapPortalSaver` (the empty session is detected as having no live daemon, gets killed via the barrier, and is recreated).

### Test independence

Each test isolates its state directory (per-test `t.TempDir()`) so concurrent test runs do not contend for the same `daemon.lock` file. The lock helper must accept a state directory parameter (not a hardcoded path) for this to work.

### What is NOT tested here

- **Sweep duration at realistic scrollback scale.** The bug is latent at N=1 with sub-second sweeps and only manifests when sweep overrun combines with recycle frequency. Reproducing this in CI would require fabricating ~28 MB of scrollback per pane across 24 panes. The barrier's 5 s timeout is sized for this profile based on the investigation's field measurements; this is captured in the spec, not in a CI test.
- **Long-uptime accumulation.** The 7-orphan snapshot accumulated over 10 days; no CI test can reproduce that timescale. The singleton invariant test plus the kill-barrier unit tests collectively cover the structural mechanism that would otherwise drive accumulation.

## Risk and Rollout

### Fix complexity

**Low.** Both changes are localised and contained within two files:

- Daemon-side lock: ~15 lines in `cmd/state_daemon.go` (or split across `cmd/state_daemon.go` and a small helper in `internal/state`) plus a test seam.
- Kill barrier: ~20 lines in `internal/tmux/portal_saver.go` (shared helper + two call sites updated) plus test seams.

No orchestrator surgery. No changes to `cmd/bootstrap/` step ordering. No new public API. No test-pattern departures — the existing `daemonRunFunc` / `BootstrapAliveCheck` seam style applies directly.

### Regression risk

**Low–Medium.**

- **New latency surface.** The kill barrier introduces a bounded wait on the bootstrap critical path **only when a kill actually fires**. The steady-state path (saver exists, version matches) is unchanged.
  - **Worst case:** 5 s timeout, single occurrence per recycle.
  - **Median case:** prior daemon exits in under 100 ms.
  - **Mitigation:** the lock is the actual structural invariant; the timeout firing surfaces a single WARN line, not a corrupt state.

- **Lock acquisition adding ~ms to daemon startup.** Negligible — `flock` is a syscall, sub-millisecond on a contended-free state directory. Acquisition runs before `WritePIDFile` so it does not move existing work; it adds itself before existing work.

- **Risk surface: timeout too short for heavier scrollback than observed.** Users with even larger scrollback than the affected user's 24-pane / ~28 MB rendered-text aggregate (top-pane `history_bytes` of 82 MB) could see the 5 s timeout fire on legitimate cold sweeps. The lock catches this: timeout firing produces a WARN line, and if the prior daemon does still hold the lock when the new one starts, the new one fails-fast and the next `portal` command recovers via tolerant-kill-and-recreate. No corruption; no user intervention required.

- **Risk surface: cross-platform `flock` semantics.** `unix.Flock(LOCK_EX|LOCK_NB)` is BSD/Linux POSIX advisory locking; it works on darwin (the affected platform) and Linux (CI). Windows is not a supported portal platform, so no consideration.

### Rollout

**Regular release.** No hotfix needed.

- Affected user count is small — the observed accumulation rate is one orphan per ~34 hours of tmux server uptime, requiring long-lived servers to manifest.
- Existing workaround is well-defined: `tmux kill-session -t _portal-saver && pkill portal` (or `tmux kill-server` for the heaviest impact).
- Goreleaser path is standard. Version ldflag injection (`-X github.com/leeovery/portal/cmd.version`) interacts with the version-mismatch trigger frequency but does not interact with the fix mechanism.

### Upgrade behaviour

First post-fix bootstrap on an affected server:
1. Bootstrap reads `daemon.version` — version mismatch (old → new) triggers `EnsurePortalSaverVersion` kill path.
2. The new kill barrier reads the prior PID (the one daemon currently recorded in `daemon.pid`), kills the current `_portal-saver` session (which SIGHUPs the daemon attached to it — the most recent one), and waits up to 5 s for that prior daemon to exit.
3. The **orphan daemons** are children of the tmux server but are no longer attached to any current session — their original `_portal-saver` sessions were killed during prior bootstraps. Killing the current `_portal-saver` therefore does **not** SIGHUP them; they remain running until their already-cancelled tick loops complete their current sweep and exit naturally on `ctx.Done()`. They hold their `flock`s until they exit.
4. The new daemon's `flock` acquisition fails because **at least one** orphan still holds the lock. The new daemon exits cleanly with the WARN; the (empty or dead-pane) `_portal-saver` session is left for the next bootstrap to recover.
5. The next `portal` command observes the missing/dead `_portal-saver` session and re-enters the tolerant-kill-and-recreate branch. Each pass closes the recovery loop one more time as more orphans finish their final sweep and release their locks.
6. Eventually all orphans drain (their sweeps complete and they exit on the cancelled context), and a fresh daemon acquires the lock successfully.

**This means the first post-upgrade bootstrap on an affected server may produce several WARN lines and may require multiple `portal` invocations to settle.** This is acceptable — it is the correct convergence behaviour and no worse than the existing workaround.

For users not currently in the multi-daemon state, the upgrade is silent: one kill, prior daemon exits cleanly within 100 ms, new daemon acquires the lock, no logs.

### Documentation

No user-facing documentation changes required. The fix is internal to the saver-bootstrap subsystem. The internal `CLAUDE.md` may want a brief note added to the `state` package row noting the `daemon.lock` invariant — to be evaluated during planning.

---

## Working Notes

