# Specification: Slow Open Empty Previews And Zombie Sessions

## Specification

## Problem Statement

This bugfix addresses three user-visible symptoms produced by a single underlying defect: Portal's daemon-singleton invariant is not enforced end-to-end. The same broken-singleton state surfaces as three different downstream effects.

**Symptoms:**

1. **Slow `portal open` (5–8 s)** — Every invocation pays a 5 s timeout before the TUI renders. Caused by the bootstrap kill-barrier in `killSaverAndWaitForDaemon` polling for the recorded `daemon.pid` to exit after `tmux kill-session _portal-saver`; when the recorded daemon is not the saver pane's process, the kill is structurally unreachable and the barrier always times out at its 5 s limit. `portal open` is expected to be sub-second.

2. **Empty session previews** — Pressing `Space` on any session in the picker shows "no saved content" even though the scrollback exists inside tmux. Caused by competing daemons each running `gcOrphanScrollback` against the same state directory with divergent indexes — the scrollback directory oscillates between 0 and 1 `.bin` file as each daemon's commit deletes files referenced only by the other's view. Expected: the highlighted session's captured scrollback renders in the preview pane.

3. **Killed sessions resurrect** — Sessions removed via `K` in the picker (or via the user's `Option-Q` tmux shortcut) reappear on the next `portal open` and persist indefinitely. Caused by multiple daemons independently committing `sessions.json` every tick — the legitimate daemon's post-kill commit (without the dead session) is overwritten seconds later by a competing daemon whose stale `prev` state still includes it. Restore on next bootstrap reconstructs the dead session as a skeleton pane. Expected: `K` removes the session permanently. *Pre-v0.5.6 (before the kill-barrier work in `killed-session-resurrects-within-tick-window`), killed sessions reappeared briefly within a "tick window" and then disappeared after ~5 s. Post-v0.5.6, they never disappear — the kill-barrier closed the brief-reappearance window but exposed the underlying multi-daemon overwrite as a permanent zombification.*

## Scope

Bundle all seven fix components (A–G, defined below) into a single bugfix work unit. Each independently closes a real defect or latent fragility; the user has explicitly chosen defence-in-depth over a minimum-viable patch. The framing is "fix Portal so this type of thing never happens" — A+B+G handle the consequences and the known triggers, C closes the underlying *mechanism* (the inode-replacement gap that lets divergent daemons coexist) so unforeseen future triggers cannot recreate the same bug class, and D bounds orphan lifetime to one tick *between* bootstraps so the daemon is polite about its own existence even when no `portal` invocation runs.

## Out of Scope

- **Re-architecting the saver/daemon ownership model.** The current "saver pane process IS the daemon" model is retained; this bugfix hardens the surrounding invariants rather than replacing them.
- **Replacing `flock` with an alternative locking primitive.** Component C tightens the existing `flock`+inode contract rather than swapping primitives. The "flock `sessions.json` itself" alternative was ruled out during investigation synthesis because `fileutil.AtomicWrite0600` replaces sessions.json's inode on every Commit, which would itself break flock semantics.
- **Migrating away from per-tick `sessions.json` rewrites.** The commit + GC pipeline shape is unchanged; only per-session error tolerance and cross-daemon coexistence are hardened.

## Root Cause

Portal's daemon-singleton contract is not enforced end-to-end. Three independent assumptions in the surrounding code, each unverified at runtime, can be violated simultaneously to produce the observed state:

1. **`daemon.lock` excludes per-inode, not per-path.** `state.AcquireDaemonLock` (`internal/state/daemon_lock.go:55-77`) opens whatever inode `daemon.lock` currently resolves to and `flock`s it. There is no cross-check that the inode it locked is still the inode at the path. If `daemon.lock` is unlinked + recreated between two daemon spawns (by any external cause — older code path, manual `rm`, leaked test scaffolding), the two daemons end up `flock`-ing different inodes and the singleton invariant is silently broken. On the reporter's install, three concurrent daemons each held `flock` on a different `daemon.lock` inode (171463046, 171582571, 170216314).

2. **The kill-barrier can only reach daemons bound to the saver pane process.** `killSaverAndWaitForDaemon` in `internal/tmux/portal_saver.go:212-248` polls the recorded `daemon.pid` for death after issuing `tmux kill-session _portal-saver`. If the recorded PID is alive but not the saver pane's process (orphan from a prior bootstrap, leaked test daemon with a different parent tmux server, etc.), the kill is structurally unreachable — the polled process never exits and the barrier times out at 5 s. No SIGTERM/SIGKILL escalation is attempted.

3. **`CaptureStructure` aborts the whole tick on any per-session error.** `internal/state/capture.go:86-90` returns immediately when `ShowEnvironment` fails for any single session. The downstream `captureAndCommit` (`cmd/state_daemon.go:132-207`) then returns before writing scrollback or calling `Commit` — a single bad session at the alphabetical head poisons capture for every later session in the same tick. Latent since commit `7dc990be4` (2026-04-27), present in every v0.5.x release. The per-pane loop in `captureAndCommit:185-192` correctly logs and continues; the per-session loop in `CaptureStructure` is missing the same defensive pattern.

When these are violated together, multiple daemons concurrently write `sessions.json` and execute destructive scrollback GC against the same state directory. `gcOrphanScrollback` (`internal/state/commit.go:102-138`) deletes any `.bin` not referenced by the just-committed index — and trusts whatever index the calling daemon produced, with no cross-check against any other daemon's view. With multiple daemons each committing different views every ~1–2 s, `.bin` files are constantly being deleted and rewritten, and `sessions.json` flips between divergent session lists.

**Trigger on this install:** A test-fixture tmux server at `/tmp/test_hook_debug2/s` is still alive from the prior evening. A test binary at `/private/tmp/portalbin/portal` was launched against this socket and is still running. It inherited `XDG_CONFIG_HOME` from the user's environment because no test isolated it, so its daemon writes to the user's real state directory while enumerating sessions from the test-fixture tmux server (a single session "A"). This is the trigger but not the *cause* — the underlying defects above allow this trigger (and any unforeseen future equivalent) to produce the observed end-state.

**Regression-point note:** The reporter framed the preview-empty symptom as a within-v0.5.x regression (it worked under some earlier v0.5.x build). The investigation established the `CaptureStructure` abort-on-error path as latent since `7dc990be4` (2026-04-27, present in every v0.5.x release), but did not pinpoint the precise build at which the symptom became user-visible — the manifestation depends on whether a leaked orphan daemon happened to exist on the reporter's install at any given moment. The "regression point" framing is treated as inconclusive: the underlying defects pre-date any v0.5.x build and the trigger (leaked test fixture) is ambient state, not a code change.

### Symptom → mechanism mapping

- **Slow open** → kill-barrier polling an unreachable orphan PID for the full 5 s window.
- **Empty previews** → `gcOrphanScrollback` race between divergent daemons deleting each other's `.bin` writes; further amplified by the `CaptureStructure` abort-on-error path when any single session enumeration fails. The "no saved content" string surfaces from `internal/tui/preview_adapter.go`, which reads `state.ScrollbackFile(stateDir, paneKey)` for the highlighted session — when the `.bin` is missing (which is most of the time under the GC race), the read returns no content and the preview adapter renders the placeholder. The TUI read site is correct; the fix is upstream in the daemon's commit/GC pipeline.
- **Zombie sessions** → competing daemon overwrites the legitimate daemon's post-kill `sessions.json` with stale `prev` state; Restore on next bootstrap reconstructs the dead session.

### Ruled Out (preserved for future reference)

The investigation explicitly ruled out three plausible-looking adjacent causes. These are recorded so future investigators don't re-tread them:

- **TOCTOU on `ShowEnvironment` for session "A".** Manual `tmux show-environment -t A` succeeded every attempt; the daemon-log entry `failed to show environment for session "A": no such session: A` was noise from a different daemon connected to a different/transitional tmux state, not a structural per-attempt failure. The `CaptureStructure` abort-on-error path is the real latent fragility (addressed by Component E).
- **Merge-filter regression from `daemon-merge-reintroduces-dead-sessions`.** Fix Component A from that bugfix is intact in current code (`mergeSkippedPanes` calls `buildLiveStructure` and applies a three-level filter). Zombie sessions are caused by competing daemons rewriting `sessions.json`, NOT by merge-filter regression. The merge filter operates only on its own daemon's `prev`; it cannot defend against a competing daemon's stale `prev` being committed seconds later.
- **Missing ctx-cancellable fix from `saver-kill-respawn-loop-leaks-daemons`.** The fix shipped in v0.5.4 and is present in current code (`cmd/state_daemon.go` has three `<-ctx.Done()` observation points in `captureAndCommit`). The legitimate daemon exits promptly on signal; orphan daemons survive because they are no longer reachable from the saver-side kill path (addressed by Component A's direct-signal escalation), not because they fail to honour cancellation.

## Shared Primitive — Daemon Identity Check

Components A, B, and C all need the same primitive: "is PID `p` a live `portal state daemon`?" This primitive is defined once and reused.

**Location:** `internal/state/daemon_identity.go` (new file), exporting `state.IdentifyDaemon(pid int) (IdentifyResult, error)`.

**Return contract:**

```go
type IdentifyResult int
const (
    IdentifyIsPortalDaemon  IdentifyResult = iota // pid is alive AND argv matches "portal state daemon"
    IdentifyNotPortalDaemon                       // pid is alive but is NOT a portal state daemon (recycled, different binary)
    IdentifyDead                                  // pid does not exist (gone since last observation, or never existed)
)
```

- **`err == nil` with one of the three results above** is the definitive answer. Callers branch on the result.
- **`err != nil`** means the identity check itself failed transiently (e.g., `ps` exec failure, malformed output). This is the "we can't tell" case. Caller semantics:
  - **Component A (kill-barrier escalation):** treat transient error as "skip SIGKILL" (do not signal a PID we can't identify; bootstrap is best-effort).
  - **Component B (orphan sweep):** treat transient error as "skip this PID" (do not signal a PID we can't identify; next bootstrap will sweep).
  - **Component C (lock-acquire pre-check):** treat transient error as "not a portal daemon" — proceed with acquire. Rationale: the flock EWOULDBLOCK fallback still catches real contention; biasing toward "let legitimate succession proceed" is safer than spuriously blocking startup.

**Implementation:** `ps -o comm=,args= -p <pid>` (or `ps -p <pid> -o comm=,args=`). Parse the output: trim, split into comm and args. Match comm against `"portal"` AND match args against a regex anchored to `"^portal state daemon( |$)"`. Any non-zero exit from `ps`, parse error, or empty output that's not "PID not found" is a transient error.

---

## Component A — Kill-Barrier Escalation

**Goal:** Make the bootstrap kill-barrier deterministically reach any prior daemon, regardless of whether the daemon is the saver pane process.

**Current behaviour** (`internal/tmux/portal_saver.go:212-248` `killSaverAndWaitForDaemon`):
1. Read `priorPID` from the kill-barrier file.
2. If `priorPID` is not alive: `tmux kill-session _portal-saver`; return.
3. Else: `tmux kill-session _portal-saver`; poll `killBarrierIsAlive(priorPID)` every 50 ms for up to 5 s; return after process death or timeout.

If `priorPID` is alive but not the saver pane's process (orphan with a different parent tmux server), `tmux kill-session` cannot reach it. The barrier polls for an exit that never happens, times out at 5 s, and proceeds.

**New behaviour:**

1. Existing steps 1–3 run unchanged.
2. **Post-poll escalation:** if `priorPID` is still alive after the 5 s session-kill poll:
   1. **Identity-check the PID.** Verify the process at `priorPID` is a `portal state daemon` — accept only if executable name is `portal` AND argv contains `state daemon`. Implementation uses `ps -o comm=,args= -p <pid>` (macOS-compatible; portable across Linux). If the check fails (PID recycled to an unrelated process, or process gone since the last poll), treat as success and return.
   2. **Send SIGKILL directly to `priorPID`.** Do NOT send SIGTERM first.
   3. Poll `killBarrierIsAlive(priorPID)` for a bounded short window (1 s total) at **50 ms cadence**, matching the existing session-kill poll cadence in `killSaverAndWaitForDaemon`.
   4. If still alive after the SIGKILL poll, log WARN under `ComponentBootstrap` and proceed — bootstrap is best-effort at this stage.

**Why SIGKILL, not SIGTERM-with-marker:**

The daemon's signal handler at `cmd/state_daemon.go:340-345` runs `defaultShutdownFlush` → `captureAndCommit` → one final destructive GC cycle on shutdown. For an orphan being deliberately killed *because its view of state is divergent*, that final flush is exactly the destructive operation we're escaping from. SIGKILL bypasses the handler entirely — no chance of one more destructive commit on the way out.

The "SIGTERM with skip-final-flush marker" alternative would require plumbing a marker through to `defaultShutdownFlush` and auditing that no future addition to the shutdown handler can fire a write. SIGKILL achieves the same guarantee structurally with no maintenance burden.

The legitimate daemon's normal saver-kill path is **unchanged**: `tmux kill-session _portal-saver` SIGHUPs the saver pane process, its handler runs, the final flush is correct because that daemon's view is correct.

**Identity-check rationale:**

Direct signalling introduces PID-recycle risk that `tmux kill-session` did not. Between the kill-barrier writing `priorPID` and bootstrap escalating to SIGKILL, the OS could recycle the PID to an unrelated process. The identity check refuses to signal anything that isn't recognisably a `portal state daemon`.

**Residual recycle-between-check-and-kill window.** The identity-check at time T cannot rule out PID recycling between T and the SIGKILL syscall at T+ε. To minimise this window, the implementation performs the identity-check **immediately before** the `kill(2)` call (no work between them other than the syscall itself), and the syscall budget is bounded by typical syscall latency (~µs). The residual race is accepted as unmitigated; the asymmetric risk profile (SIGKILL on an unrelated short-lived process is usually recoverable; SIGKILL on a critical user process is destructive) is bounded by (a) the µs-scale window, (b) the OS's PID-recycle pressure being low under normal load, and (c) the identity-check eliminating the dominant risk source. No additional mitigation (e.g., `pidfd_open` on Linux, kqueue process watches on macOS) is required for this work unit; these may be revisited if a future incident demonstrates the residual window is being hit in practice.

**Acceptance criteria:**

- A leaked orphan daemon (parent ≠ saver pane process; `tmux kill-session` cannot reach it) is dead within ~6 s of bootstrap entering `killSaverAndWaitForDaemon` (5 s session-kill poll + 1 s SIGKILL poll).
- The bootstrap kill-barrier no longer adds a 5 s ceiling to `portal open` when an orphan is present — under steady-state-with-orphan, total bootstrap time is reduced by ~5 s.
- Identity check prevents signalling an unrelated process if `priorPID` has been recycled.
- No final-flush GC cycle runs on orphans being escalation-killed. Verified by snapshotting the scrollback directory immediately before SIGKILL and again 200 ms after the orphan exits; the two snapshots must be identical (no new `.bin` files, no deleted `.bin` files, no mtime/size changes on existing `.bin` files). The observation harness uses fsnotify or a polled `os.ReadDir` snapshot; either is acceptable.
- The legitimate daemon's normal shutdown path is unaffected — SIGHUP from `tmux kill-session` still triggers `defaultShutdownFlush` as before.

**Files affected:** `internal/tmux/portal_saver.go` (`killSaverAndWaitForDaemon`). May introduce a small helper in `internal/state/` or a new package for the identity-check / signal primitive depending on testability needs.

## Component B — Bootstrap-Time Orphan Sweep

**Goal:** During every bootstrap, proactively detect and kill any `portal state daemon` process that isn't the saver pane's process. Composes with Component A but closes the gap earlier in the bootstrap sequence — orphan daemons stop writing to the state directory *before* `EnsureSaver` runs, so the new saver's daemon doesn't compete with an existing one for the lock or the state dir.

**Current behaviour:** No orphan sweep exists. Orphan daemons are only addressed indirectly through the kill-barrier's poll-and-wait on `priorPID`, which (per Component A) is the kill-barrier's single recorded PID, not the full pgrep set.

**New bootstrap step: `SweepOrphanDaemons`.** Inserted as a new step between `Set @portal-restoring` (current step 3) and `EnsureSaver` (current step 4). All steps from `EnsureSaver` onward shift up by one. Post-insertion the full 11-step orchestrator is:

1. EnsureServer
2. RegisterPortalHooks
3. Set `@portal-restoring`
4. **SweepOrphanDaemons** *(new)*
5. EnsureSaver
6. Restore
7. EagerSignalHydrate
8. Clear `@portal-restoring`
9. CleanStaleMarkers
10. SweepOrphanFIFOs
11. CleanStale

The existing inter-step invariants (e.g., "Clear must precede CleanStaleMarkers", "EagerSignalHydrate runs while `@portal-restoring` is still set") are preserved by this insertion — `SweepOrphanDaemons` runs *before* `EnsureSaver` and does not interact with `@portal-restoring`, `client-attached` hooks, or any post-Restore state. Component F's saver-creation sub-steps (placeholder → set option → respawn) are internal to `BootstrapPortalSaver` and do NOT introduce new orchestrator-visible steps; the CLAUDE.md update for F is limited to a one-line note in the EnsureSaver step description.

**Behaviour:**

1. Enumerate candidate orphan PIDs. On macOS, `pgrep -x` matches against the process short name (`comm`), which for the daemon is `portal` — so `pgrep -x 'portal state daemon'` matches nothing. The canonical enumeration form is **`pgrep -fx '^portal state daemon( |$)'`** (the `-f` flag matches against the full argv string, the `-x` requires an exact match, and the anchored regex prevents false positives from e.g. `portal state daemon-foo`). This is the single canonical form — both the acceptance criteria (`pgrep -fxc 'portal state daemon'`) and the implementation use it. A `ps`-based form is illustrative for understanding what the pgrep call should match; it is NOT an alternative implementation, because subtle behavioural differences (whitespace splitting, anchor semantics) make the two forms non-equivalent in edge cases.
2. Build the legitimate set:
   - The pane process PID of `_portal-saver`'s only pane, if `_portal-saver` exists (via `tmux list-panes -t _portal-saver -F '#{pane_pid}'`).
   - Empty set if `_portal-saver` does not exist (fresh server, post-server-restart, etc.).
3. For each candidate PID NOT in the legitimate set:
   1. **Identity-check** (same primitive as Component A): accept only if executable is `portal` and argv contains `state daemon`. Skip if the check fails.
   2. **SIGKILL** the PID. Do NOT send SIGTERM first (same reasoning as Component A — orphan view is untrusted, no final flush).
   3. Log INFO under `ComponentBootstrap`: `"sweep: killed orphan daemon pid=%d"`.
4. Return. Step is **best-effort**; any `pgrep` / `ps` / `kill` error is logged WARN and swallowed. Never escalates to a fatal abort.

**Why this composes with Component A and is not redundant:**

- Component A handles the *single* daemon the kill-barrier knows about (`priorPID` from the kill-barrier file). It cannot handle multiple orphans because the barrier only records one PID.
- Component B sweeps the *full* pgrep set. On the reporter's install (three concurrent daemons), B kills the two orphans the barrier doesn't know about and A handles the recorded one — together they make the post-bootstrap state singleton.
- B runs before `EnsureSaver` so the new saver-pane daemon's first tick is uncontested. A runs *inside* the new `EnsureSaver` flow as part of the kill-barrier escalation.

**Concurrency note:** B is non-atomic — a new `portal state daemon` could in principle appear between the `pgrep` and the `kill` step. In practice, the only legitimate spawner of `portal state daemon` is the saver pane process via `EnsureSaver`, which has not yet run at this bootstrap step. Out-of-band spawns (manual `portal state daemon` invocation, test fixture starting between the two calls) are rare and B is best-effort anyway — the next bootstrap will sweep them.

**Acceptance criteria:**

- Given N concurrent `portal state daemon` processes where N-1 are orphans (parent ≠ saver pane process; or no saver session exists), bootstrap step `SweepOrphanDaemons` kills N-1 of them. Verified by `pgrep -fxc 'portal state daemon'` returning 1 (the legitimate saver-pane daemon) after the step completes.
- Given only the legitimate saver-pane daemon, the sweep sends zero signals. Verified by audit log: no `"sweep: killed orphan daemon"` entries on a clean-state bootstrap.
- Identity check prevents signalling an unrelated process if the PID has been recycled.
- Step is best-effort: any underlying error (pgrep failure, kill failure) logs WARN and does not abort bootstrap.
- Step ordering is documented in `CLAUDE.md` bootstrap section to match the new sequence.

**Files affected:** `cmd/bootstrap/` (new step + orchestrator wiring), `internal/bootstrapadapter/` (production adapter for pgrep + identity-check + kill seam), `CLAUDE.md` (bootstrap step ordering documentation).

**`portal clean` interaction:** Out of scope for this bugfix. `portal clean` is the user's manual escape hatch and does NOT run the bootstrap orchestrator. The orphan-sweep step is intentionally bootstrap-only: every `portal open` invocation already runs bootstrap and will sweep orphans, so adding sweep logic to `portal clean` would be redundant. Users who want to force-sweep without invoking `portal open` can use the transitional recovery snippet documented in the End-State Verification section (`pkill -9 -x 'portal state daemon'`).

## Component C — Stabilise the `daemon.lock` Singleton Against Inode Replacement

**Goal:** Close the inode-replacement gap so the daemon-singleton invariant cannot be silently broken when `daemon.lock`'s path is unlinked + recreated between two daemon spawns.

**Current behaviour** (`internal/state/daemon_lock.go:55-77` `AcquireDaemonLock`):
1. `os.OpenFile(daemon.lock, O_RDWR|O_CREATE, 0o600)` — opens whatever inode is at the path.
2. `flock(LOCK_EX|LOCK_NB)` on that fd.
3. Set `FD_CLOEXEC`. Return.

`flock` excludes per-**inode**, not per-path. If two daemons end up with fds to different inodes for the same path (because the file was unlinked + recreated between their opens), both `flock`s succeed and both daemons run.

**New behaviour:** Augment `AcquireDaemonLock` with two cross-checks that use the already-existing `daemon.pid` file and an inode invariant.

1. **Pre-acquire daemon.pid liveness check.** Before opening `daemon.lock`:
   1. Read `daemon.pid` via `state.ReadPIDFile`. If absent: skip; proceed.
   2. If present: check the recorded PID is alive AND identity-checks as a `portal state daemon` (same primitive as Component A — `ps -o comm=,args= -p <pid>`; accept only when executable is `portal` and argv contains `state daemon`).
   3. If both checks pass: return `ErrDaemonLockHeld`. Another `portal state daemon` already owns the singleton, regardless of whatever inode `daemon.lock` currently resolves to.
   4. If the recorded PID is dead or doesn't identity-check: proceed to step 2.
2. **Existing open + flock** (steps 1–3 of current behaviour) run unchanged.
3. **Post-flock inode cross-check.** After `flock` succeeds:
   1. `fstat` the fd to get `fd_inode`.
   2. `stat` the path to get `path_inode`.
   3. If `fd_inode != path_inode`: the file was replaced between our open and our flock. Release the flock (close the fd) and retry the whole acquire (steps 1–3). Bounded to **3 retries** with a 10 ms sleep between attempts. On persistent mismatch after the bound, return a wrapped error. **Exit semantics:** the daemon's `runDaemonE` (or equivalent) treats this wrapped error like any other open(2)/flock failure today — log WARN under `ComponentDaemon` and exit with **status 1** (matching the existing "wrapped error" treatment in `AcquireDaemonLock`'s docstring; distinct from the `ErrDaemonLockHeld` path which exits status 0). The lock-loser status 0 path is retained for the pre-check `ErrDaemonLockHeld` case. Because the daemon's pane is configured with `destroy-unattached=off` (Component F), a status 1 exit does NOT trigger a restart loop — `_portal-saver` persists with a dead pane process and the next bootstrap evaluates the unhealthy-saver path normally. The WARN is surfaced via `internal/state/logger.go`; it does NOT propagate to the user-facing `warning` package because lock-acquire failures are daemon-internal.
   4. If `fd_inode == path_inode`: lock acquired, proceed.
4. **Post-acquire daemon.pid write.** After successful acquire (and after the existing FD_CLOEXEC step), the caller writes `daemon.pid` atomically with the current process's PID via `state.WritePIDFile` (existing helper). The acquire helper itself does not write the PID file — that remains the daemon's responsibility, preserving the current call-site contract. The **daemon must write `daemon.pid` as the next statement after the successful `acquireDaemonLock` return** in `cmd/state_daemon.go`'s `defaultDaemonRun` (the existing function at line 70 that hosts the acquire call at line 290 and the pid write at line 301; the two calls are already consecutive). No other production call site of `AcquireDaemonLock` exists; the spec contract is "production daemon's `defaultDaemonRun` only". The window between acquire and pid-write must remain bounded by a single `state.WritePIDFile` call — implementers MUST NOT insert other work between them. A unit test asserts that the source ordering is preserved by walking the function's AST and checking that the call statement immediately following `acquireDaemonLock` is `WritePIDFile` (or a guarded equivalent).

**Layered enforcement note.** The pre-check is the *primary* singleton enforcer for steady-state contention. For the small startup window between `AcquireDaemonLock` returning and `WritePIDFile` completing, the existing `flock` EWOULDBLOCK path is the fallback enforcer: a second daemon would observe a stale/dead pre-check, proceed to open `daemon.lock`, and fail at `flock` with EWOULDBLOCK because the legitimate daemon still holds it. This layered behaviour is intentional — the pre-check covers the case where `flock` is structurally bypassed (inode replacement), and `flock` covers the case where the pre-check has no `daemon.pid` to consult yet.

**Deviation from investigation:** The investigation's described shape was "Open with `O_EXCL|O_CREAT`, then `fstat` the fd and `stat` the path, and refuse if inodes differ". The spec deviates by retaining `O_RDWR|O_CREAT` and introducing the pre-acquire `daemon.pid` liveness check as the primary singleton enforcer instead. Reasoning: `O_EXCL|O_CREAT` would require every daemon to unlink `daemon.lock` on clean shutdown (and a crash-cleanup story for un-unlinked files), inverting the lockfile's "stable across lifetimes" contract. The `daemon.pid` check achieves the same correctness guarantee without changing the lockfile lifecycle — what matters for singleton enforcement is whether a live identity-checkable daemon is recorded, not which inode the lockfile currently resolves to. The inode cross-check is retained as a secondary defence against open-vs-flock races.

**Why this closes the bug class:**

- The pre-check makes `daemon.pid` (a stable file whose content we control) authoritative for singleton membership, sidestepping `flock`'s per-inode limitation. Even if `daemon.lock` has been unlinked + recreated 100 times, what matters is whether `daemon.pid` references a live identity-checkable daemon.
- The inode cross-check absorbs the small race window where a third party replaces the file between our `open` and our `flock`. Bounded retry handles transient turbulence (e.g., another daemon coming up and aborting cleanly); persistent mismatch indicates a stuck-broken state that should fail loudly.
- The identity check on the recorded PID prevents a recycled-PID coincidence from blocking legitimate succession (e.g., shell pid coincidentally matches the prior daemon's PID).

**Composition with Components A and B:**

- A+B ensure that by the time the new saver-pane daemon calls `AcquireDaemonLock`, no other `portal state daemon` is alive — so the pre-check sees a dead recorded PID and proceeds.
- C is the structural defence: if A and B both somehow miss an orphan (unforeseen future trigger), the pre-check still refuses to acquire, and the loser exits cleanly via the existing `ErrDaemonLockHeld` path. Worst case becomes "saver pane process exits 0 with a WARN; bootstrap proceeds without a healthy daemon", which is degraded but not destructive — the existing `EnsureSaver` flow already surfaces a `SaverDownWarning` for that state.

**Acceptance criteria:**

- **Pre-check refuses on live recorded daemon.** Given a live identity-checkable `portal state daemon` referenced by `daemon.pid`, `AcquireDaemonLock` returns `ErrDaemonLockHeld` without opening `daemon.lock`. Verified via unit test with a real subprocess as the "live" daemon.
- **Pre-check ignores stale daemon.pid.** Given a `daemon.pid` whose recorded PID is dead, `AcquireDaemonLock` proceeds. Verified via unit test (write daemon.pid with a known-dead PID; assert acquire succeeds).
- **Pre-check ignores wrong-identity PID.** Given a `daemon.pid` whose recorded PID is alive but identity-check fails (e.g., the PID was recycled to `sleep`), `AcquireDaemonLock` proceeds. Verified via unit test (stub identity-check seam to return false).
- **Inode-mismatch retry.** Stub the post-flock inode comparison to return mismatch for the first attempt then match: `AcquireDaemonLock` succeeds on the second attempt. Verified via unit test through the existing `lockAcquire` seam plus a new stat seam.
- **Inode-mismatch retry bound.** Stub mismatch for all attempts: `AcquireDaemonLock` returns a wrapped error after 3 attempts, with bounded total delay (<100 ms). Verified via unit test.
- **No regression in EWOULDBLOCK path.** A second `AcquireDaemonLock` against the same `daemon.lock` with the original holder still alive returns `ErrDaemonLockHeld` (either via pre-check, or via the existing EWOULDBLOCK path if daemon.pid is missing). Verified via existing daemon-lock integration test.
- **Upgrade-path scenario.** Simulate the real-world upgrade landmine: spawn a v(N) `portal state daemon` that holds the lock, then invoke a v(N+1) binary bootstrap (the existing in-flight daemon was launched by the prior binary; the new binary's bootstrap spawns its own daemon). With Components A+B+C, the new bootstrap's daemon either acquires cleanly (because A/B swept the prior daemon and `daemon.pid` is no longer live) or refuses cleanly via the pre-check (no destructive coexistence). Verified by integration test that constructs the two-binary scenario.

**Files affected:** `internal/state/daemon_lock.go` (augment `AcquireDaemonLock`), `internal/state/daemon_state.go` (no changes to `WritePIDFile`/`ReadPIDFile` — used as-is), tests in `internal/state/daemon_lock_test.go`. New test seams may be added: identity-check function pointer and stat function pointer.

## Component D — Daemon Self-Supervision Against the Saver Session

**Goal:** Bound orphan-daemon lifetime to ~3–4 seconds even when no `portal` invocation runs. A and B sweep orphans at bootstrap time; D makes the daemon self-eject when its connection to `_portal-saver` no longer holds, without needing an external sweep.

**Current behaviour:** The daemon ticks forever after acquiring `daemon.lock` until it receives SIGHUP (from `tmux kill-session _portal-saver`) or a context cancellation. There is no per-tick check that the daemon is still bound to a live saver pane.

**New behaviour:** Add a per-tick "saver-membership self-check" to the daemon's main loop in `cmd/state_daemon.go`. The check runs **before** the existing `captureAndCommit`, so a failing check exits before any commit/GC writes.

**Self-check sequence:**

1. **Query saver existence:** `tmux has-session -t _portal-saver`. Treat any error (not just "session not found") as "absent" for this tick — tmux command failures are evidence the daemon's view is unreliable.
2. **If absent:** increment the in-process consecutive-absence counter.
3. **If present:** query the saver pane's pid via `tmux list-panes -t _portal-saver -F '#{pane_pid}'`. If the result errors or yields a pid that doesn't match `os.Getpid()`: increment the counter. If the pane pid matches `os.Getpid()`: reset the counter to 0 (this daemon is still legitimately the saver pane process).
4. **If counter ≥ N (see hysteresis below):**
   1. Log INFO under `ComponentDaemon`: `"self-supervision: saver-membership lost for N consecutive ticks, exiting"`.
   2. **Skip the final flush.** Exit immediately via `os.Exit(0)` (bypassing any deferred shutdown handler) so the divergent-view daemon does NOT execute one more `captureAndCommit` / `gcOrphanScrollback` cycle on its way out — same reasoning as Component A's straight-to-SIGKILL choice.
   3. **Stale `daemon.pid` after self-eject is intentional.** `os.Exit(0)` skips any defer that would clean up `daemon.pid`. The stale value is handled correctly by Component C's pre-check on the next acquire (the recorded PID is dead, pre-check proceeds). Implementers MUST NOT add cleanup logic to delete `daemon.pid` before the eject — such logic would be racy against a concurrent pre-check and would invert the layered-enforcement contract.
5. **If counter < N:** continue to the existing tick body (`captureAndCommit`).

**Hysteresis N:** **3 consecutive ticks.** Rationale:

- The legitimate daemon never observes a transient "saver absent" condition. The bootstrap path that kills `_portal-saver` SIGHUPs the saver pane process — i.e., the legitimate daemon itself — so the OLD legitimate daemon stops ticking before its next self-check. The NEW legitimate daemon spawned by the recreated saver only starts ticking AFTER the saver exists. There is no in-between window where a legitimate daemon would see absence.
- The only realistic source of false-positive absence is transient tmux command failure (mid-tick `has-session` returning an unexpected error during, e.g., a heavy tmux server moment). N=3 absorbs this without significantly extending orphan lifetime.
- With the daemon's current tick interval (`stateDaemonTickInterval` in `cmd/state_daemon.go`, currently ~1 s), N=3 caps orphan lifetime at ~3–4 s of additional drift after the saver-membership condition first fails — well inside the user's "bound to one tick *between* bootstraps" target framing. Acceptance criteria that reference "tick intervals" refer to this same constant.
- N=1 was considered but rejected: a single tmux-command hiccup would unnecessarily kill the legitimate daemon mid-session (extremely rare but possible).

If implementation measurement during the planning phase reveals real-world transient durations longer than ~3 ticks, N can be increased — but the spec target is "single-digit ticks", not "tens of ticks".

**Why this composes with A, B, and C:**

- A+B run only at bootstrap. Between invocations (the user closes their laptop, comes back hours later), orphans accumulate freely under the current design — the reporter's install had a 13-hour orphan-lifetime from yesterday 21:39 to detection today 10:39. D shrinks the inter-bootstrap orphan window from "hours" to "~3 seconds".
- C makes the lock-acquire path refuse the singleton on observable divergence. D makes the lock-holder self-eject when its membership becomes invalid post-acquire. Together they enforce the singleton invariant at both ends of a daemon's lifetime.

**Acceptance criteria:**

- **Self-eject on absent saver.** Spawn `portal state daemon` against a tmux server that has no `_portal-saver` session. The daemon exits within (N + 1) tick intervals. Verified by integration test.
- **Self-eject on saver pane pid mismatch.** Spawn the daemon, then externally replace the `_portal-saver` pane process (e.g., `respawn-pane` to a different process). Daemon exits within (N + 1) tick intervals. Verified by integration test.
- **No false-positive exit on legitimate transient.** Stub the saver-existence check to return "absent" for k < N consecutive ticks then "present": daemon does NOT exit, counter resets. Verified by unit test through a `saverMembershipProbe` seam.
- **No final flush on self-eject.** Snapshot the scrollback directory at the moment the daemon's self-check first registers a failing tick, and again immediately after `os.Exit(0)`. The two snapshots must be identical (no new files, no deletions, no mtime/size changes). Verified by integration test that uses fsnotify or a polled `os.ReadDir` snapshot during the eject window.
- **Skipped check on first tick is benign.** The legitimate daemon, ticking for the first time inside a freshly-created `_portal-saver`, passes the self-check on tick 1 (pane pid matches its pid). Verified by integration test in the existing daemon-saver suite.
- **Measurement artefact for N.** The chosen value of N is documented in-source as a constant (e.g., `selfSupervisionHysteresisTicks`) with a comment block citing: (i) the measured worst-case transient duration in ticks across the scenarios listed in the Risk Summary (steady-state, attach/detach, `client-attached`, bootstrap kill-and-recreate), (ii) the 2× safety factor applied, and (iii) the date of measurement and binary version. If the measurement memo is stored separately (e.g., as a note in `.workflows/`), the source comment references it. A unit test asserts `selfSupervisionHysteresisTicks >= 1` to prevent accidental zeroing; the actual value-vs-measurement justification is enforced by code review, not test.

**Test staging note.** D's integration tests intentionally violate the saver-pane-process invariant; to reach the tick loop, they must satisfy Component C's lock-acquire pre-check. Tests stage the state directory with either (i) no `daemon.pid` file (pre-check skips and proceeds), or (ii) a `daemon.pid` referencing a known-dead PID. The tests spawn the daemon directly (bypassing the bootstrap orchestrator) so Component B's sweep does not preempt the test setup. The replacement of `_portal-saver`'s pane process for the "pid mismatch" case is performed via `tmux respawn-pane -k -t _portal-saver 'sh -c "exec tail -f /dev/null"'` (or equivalent) between daemon spawn and the daemon's first self-check tick.

**Files affected:** `cmd/state_daemon.go` (insert self-check before `captureAndCommit`), `internal/tmux/` (may add a small `SaverPanePID(name) (int, error)` helper for testability), tests in `cmd/state_daemon_test.go` plus integration coverage.

## Component E — `CaptureStructure` Per-Session Log-and-Continue

**Goal:** Stop a single per-session `ShowEnvironment` error from aborting the entire tick. Today, the first failing session at the alphabetical head of the list causes `captureAndCommit` to return before writing any scrollback or committing the index — every session ordered after the failure loses capture for that tick. Latent fragility since commit `7dc990be4` (2026-04-27).

**Current behaviour** (`internal/state/capture.go:86-96`):

```go
for _, name := range sortedKeys(keep) {
    envRaw, err := c.ShowEnvironment(name)
    if err != nil {
        return empty, err     // aborts the whole CaptureStructure call
    }
    sessions = append(sessions, Session{...})
}
```

**New behaviour:** Mirror the per-pane defensive pattern already used in `captureAndCommit` (`cmd/state_daemon.go:185-192`). For each session, attempt `ShowEnvironment`; on per-session error, log WARN and skip that session; continue to the next.

```go
for _, name := range sortedKeys(keep) {
    envRaw, err := c.ShowEnvironment(name)
    if err != nil {
        logger.Warn(ComponentDaemon, "show environment for session",
            "session", name, "err", err)
        continue
    }
    sessions = append(sessions, Session{
        Name:        name,
        Environment: parseShowEnvironment(envRaw),
        Windows:     buildWindows(name, grouped[name]),
    })
}
```

**Pre-loop calls remain fail-fatal.** `ListSessionNames`, `ListAllPanesWithFormat`, and `parsePaneRows` (lines 66-83) are NOT changed — those failures indicate tmux itself is broken or returning malformed output, and continuing with partial state would produce destructive commits. The per-session loop is the only path where partial-success is meaningful.

**Total-failure guard.** Add a post-loop check that distinguishes natural session churn from anomalous tmux failure:

- **Per-session error classification.** During the loop, classify each `ShowEnvironment` error as either `natural-churn` (the session no longer exists) or `anomalous` (any other failure). Classification uses a **typed sentinel `tmux.ErrNoSuchSession`** introduced in `internal/tmux/` and returned by `ShowEnvironment` (and any other per-session tmux call) when stderr contains `"no such session"`. The wrapping happens once at the `internal/tmux/` boundary; daemon-layer callers classify via `errors.Is(err, tmux.ErrNoSuchSession)`. Substring matching in the daemon layer is rejected — it couples the daemon to tmux's exact error-string surface, which is not a stable contract.
- **Post-loop discriminator.** If `len(keep) > 0 && len(sessions) == 0`:
  - **If all per-session errors were `natural-churn`:** the sessions tmux enumerated in the pre-loop call were all destroyed by the user mid-tick. Proceed with the empty index — Commit + GC writes a `sessions.json` reflecting the new reality (sessions are gone) and reclaims orphan scrollback. This is the legitimate "user killed the last session" case.
  - **If any per-session error was `anomalous`:** at least one session enumeration failed for a non-recoverable reason. Return an error wrapping the count and types, causing `captureAndCommit` to skip Commit + GC for this tick (the existing error path) — refuse to wipe scrollback on evidence of a broken capture.

The natural-churn predicate must be conservative: any error that isn't unambiguously "session no longer exists" is treated as anomalous. This errs on the side of preserving scrollback at the cost of one tick's delay in propagating a kill, which is acceptable because the next tick's enumeration will see the same state and commit cleanly.

**Logger dependency.** `CaptureStructure` does not currently take a logger argument. To preserve the existing call-site signature without intrusive changes, the spec accepts either of the following implementation choices (planning phase decides):

- Add an optional `logger *Logger` parameter (or pass through the existing `state.Logger` plumbing).
- Add a `CaptureStructureWithLogger` variant; keep `CaptureStructure` as a thin wrapper that passes a no-op logger.

Either is acceptable as long as per-session errors are logged with enough context to diagnose (session name, error). The first option is preferred for symmetry with `Commit`'s existing logger argument.

**Acceptance criteria:**

- **Single-session failure does not abort tick.** Stub `ShowEnvironment` to fail for session "A" and succeed for "B", "C". `CaptureStructure` returns an index containing "B" and "C" (but not "A"). `captureAndCommit` proceeds to write scrollback for both surviving sessions' panes and to Commit. Verified by unit test.
- **All-session anomalous failure aborts tick.** Stub `ShowEnvironment` to return a non-"no such session" error (e.g., a generic exec failure) for every session in a non-empty `keep` set. `CaptureStructure` returns a wrapped error; `captureAndCommit` does NOT call Commit (no destructive GC runs). Verified by unit test.
- **All-session natural-churn proceeds with empty commit.** Stub `ShowEnvironment` to return a "no such session" error for every session in a non-empty `keep` set (simulating the user killing the last session mid-tick). `CaptureStructure` returns an empty index without error; `captureAndCommit` proceeds to Commit a `sessions.json` reflecting zero sessions. Verified by unit test.
- **Logging.** Every per-session skip emits a WARN log entry with the session name and the underlying error. The log uses the existing `ComponentDaemon` constant from `internal/state/logger.go` (matching the convention used by `gcOrphanScrollback` in `internal/state/commit.go:53` for capture-pipeline failures). A new component constant is NOT introduced. Verified by unit test that asserts on the logger output.
- **No regression in fail-fatal pre-loop paths.** A `ListAllPanesWithFormat` failure still causes `CaptureStructure` to return an error; `captureAndCommit` does not Commit. Verified by existing or new unit test.
- **Empty `keep` is benign.** `len(keep) == 0` returns an empty index without error (existing behaviour preserved).

**Files affected:** `internal/state/capture.go` (`CaptureStructure`), call sites in `cmd/state_daemon.go` if a signature change is chosen, tests in `internal/state/capture_test.go`.

## Component F — Saver Creation Sets `destroy-unattached=off` BEFORE Daemon Starts

**Goal:** Eliminate the race in which a newly-created `_portal-saver` session is destroyed by tmux before its `destroy-unattached=off` option can be set, producing the observed `no such session: _portal-saver` log noise and the recovery doom-loop where each bootstrap creates the saver, the daemon exits as lock-loser (because A/B haven't yet swept), the session self-destroys, and the next bootstrap finds it absent again.

**Current behaviour** (`internal/tmux/portal_saver.go:266-288` `BootstrapPortalSaver`):

```go
if !sessionPresent {
    if err := createPortalSaverWithRetry(c); err != nil { return err }  // initial cmd = "portal state daemon"
}
if err := c.SetSessionOption(PortalSaverName, "destroy-unattached", "off"); err != nil {
    return fmt.Errorf("bootstrap _portal-saver: set destroy-unattached: %w", err)
}
```

`createPortalSaverWithRetry` (lines 396-416) creates the session with `portalSaverCommand = "portal state daemon"` as the initial command. The daemon starts running inside the new pane immediately. If the daemon is going to exit cleanly (e.g., lock-loser case), it can exit between step 1 (create) and step 2 (`SetSessionOption`). With `destroy-unattached` defaulting to "on" (or set on globally in the user's tmux config), tmux destroys the session as soon as its only pane's process exits. `SetSessionOption` then runs against a session that no longer exists → `exit status 1: no such session: _portal-saver`.

**New behaviour:** Decouple session creation from daemon launch.

1. **Create the saver with a benign placeholder command.** Replace `portalSaverCommand = "portal state daemon"` (or override at the create call site) with `"sh -c 'exec tail -f /dev/null'"` for the initial-creation step. The placeholder process runs indefinitely and does NOT trigger session self-destruction.
2. **Set `destroy-unattached=off`** on the now-stable session (existing `SetSessionOption` call). This call is now safe — the session is guaranteed to exist because the placeholder is keeping it alive.
3. **Respawn the pane with the real command:** `tmux respawn-pane -k -t {PortalSaverName} 'portal state daemon'`. The `-k` flag kills the current process (the placeholder `sh -c 'exec tail -f /dev/null'`) and replaces it with the daemon. The pane survives the respawn; only its process changes. Even if the daemon exits immediately as lock-loser, `destroy-unattached=off` is already in effect, so the lock-loser cascade is quiet — every `BootstrapPortalSaver` tmux call targets an extant session and no `no such session` log entries are produced. (Literal session-persistence after daemon exit is a separate concern; see acceptance criterion 3 and the Note below for tmux-version-specific behaviour.)
4. **Readiness barrier.** After `respawn-pane`, `BootstrapPortalSaver` polls for `daemon.pid` to exist AND for `state.IdentifyDaemon` against its contents to return `IdentifyIsPortalDaemon`. Bounded to **2 s total** with **50 ms poll cadence**. On timeout: log WARN (`"saver respawn: daemon did not come up within 2s"`) and return — best-effort, the bootstrap continues. On success: return. This barrier guarantees subsequent bootstrap steps (Restore, EagerSignalHydrate, etc.) observe a healthy daemon rather than racing the respawn.

**Why this ordering is safe:**

- The placeholder is structurally incapable of running portal logic — it cannot write to the state directory or contend for the lock. The window between create and respawn is bounded by two tmux command latencies (likely <50 ms) during which no portal-daemon work happens.
- `respawn-pane -k` is already used elsewhere in the codebase (the hydrate-helper path during Restore — see CLAUDE.md restore section). The existing `RespawnPane` method on `*tmux.Client` (in `internal/tmux/`) accepts the target identifier and the command string verbatim; Component F reuses this method without signature changes. Implementer verifies the method exists with that shape during initial scaffolding; if the existing site uses a different shape (e.g., structured args), Component F adapts to match.
- **Environment inheritance across respawn.** On all supported tmux versions, `respawn-pane` runs the new process with the session's environment (preserved from `new-session` time, plus any `set-environment` updates applied since). The current `createPortalSaverWithRetry` calls `NewDetachedSessionNoCwd` which does NOT pass `-e KEY=VAL` overrides — the saver session inherits the tmux server's environment as-is. Component F preserves this behaviour: no new env overrides are introduced at create-time, and the respawned daemon sees the same environment it would have seen as the initial pane command pre-F. Acceptance scenario: after Component F lands, `tmux show-environment -t _portal-saver` produces an output identical to the pre-F baseline for any environment variable the daemon reads (`XDG_CONFIG_HOME`, `HOME`, `PATH`).
- The placeholder choice (`sh -c 'exec tail -f /dev/null'`) is portable across macOS and Linux. `sleep infinity` was considered and rejected because macOS' BSD `sleep` requires a numeric argument and exits immediately when given `infinity` — which would recreate exactly the race this component is meant to close. `tail -f /dev/null` blocks indefinitely on both platforms, does NOT exit on terminal-signal artefacts, and is widely available; it lives until killed by `respawn-pane -k` or `tmux kill-session`.

**Interaction with kill-barrier (Components A and B):**

When `BootstrapPortalSaver` encounters an existing saver with a dead daemon (lines 269-275 — `BootstrapAliveCheck` returns false), it calls `killSaverAndWaitForDaemonFn` and falls through to recreate. With Components A and B in place, the kill phase is reliable, and the recreate path now uses the placeholder-then-respawn ordering. The net effect is that no bootstrap leaves the saver in a partial-state with `destroy-unattached` unset.

**New state introduced by F — "saver exists with placeholder still running":**

F introduces a transient state where `_portal-saver` exists with the `tail -f /dev/null` placeholder as its pane process (between F's steps 1 and 3, or persistently if a prior bootstrap crashed mid-respawn). Composition checks:

- **Component B's sweep** enumerates `portal state daemon` processes only. The placeholder is `sh -c 'exec tail -f /dev/null'` — not a portal daemon — so B's sweep correctly ignores it.
- **`BootstrapAliveCheck`** (called by `BootstrapPortalSaver` when `sessionPresent=true`) inspects `daemon.pid` aliveness. With the placeholder running and no daemon writing `daemon.pid`, the alive check reports unhealthy → existing kill-and-recreate path runs → `killSaverAndWaitForDaemonFn` kills the placeholder via `tmux kill-session` → recreate with the new placeholder-then-respawn ordering. The unhealthy-saver path already handles this case; no new alive-check logic is needed.
- **No persistent placeholder leak.** Even if a bootstrap crashes between F's steps 2 and 3, the next bootstrap sees the unhealthy saver (no live daemon.pid) and recovers via the existing path.

**Acceptance criteria:**

- **No "no such session" log line on create.** A clean bootstrap (no prior saver) produces a `_portal-saver` session with `destroy-unattached=off` and a `portal state daemon` pane process, with zero `"no such session: _portal-saver"` log entries. Verified by integration test.
- **destroy-unattached=off is set before daemon process can exit.** After `BootstrapPortalSaver` returns successfully, `tmux show-options -t _portal-saver destroy-unattached` reports `off`, AND the pane process is `portal state daemon` (verified via `tmux list-panes -t _portal-saver -F '#{pane_pid}'` and `ps -o args= -p <pid>`).
- **Lock-loser cascade is quiet — no `no such session` log noise.** Simulate a lock-loser scenario (another daemon already holds the singleton): the new bootstrap creates `_portal-saver` with the placeholder, applies `destroy-unattached=off`, respawns the daemon, and the daemon exits cleanly as lock-loser. The observable contract is that **no `"no such session: _portal-saver"` (or equivalent) log lines appear in `portal.log`** during the create → set-option → respawn → daemon-exit sequence — i.e., every tmux command in `BootstrapPortalSaver` targets a session that exists at the moment of the call. Verified by integration test that scrapes the log for the offending substring across the cascade. **Rationale for log-noise-absence over literal session-persistence:** observed tmux 3.6b behaviour is that `_portal-saver` DOES disappear when the lock-loser daemon pane process exits even with `destroy-unattached=off` (the option governs unattached-after-client-detach behaviour, not pane-process-exit behaviour on this tmux version). The race this component closes is the one between `new-session` and `set-option` — i.e., the daemon exiting before `destroy-unattached=off` is set, which produced the `no such session` log entry that triggered the original investigation. Once the option is set under the placeholder-then-respawn ordering, every `BootstrapPortalSaver` tmux call targets an extant session and the log noise stops. The literal "session outlives daemon" outcome is a non-goal at this tmux version; see note below for future opt-in.
- **No regression for the happy path.** Existing daemon-saver integration tests pass without modification — the daemon comes up healthy, acquires the lock, and ticks normally.

**Note on literal session-persistence as a future opt-in.** Without `remain-on-exit on` (or the equivalent window/pane option) applied to the saver session, `_portal-saver` does NOT outlive its daemon pane process on tmux 3.6b — when the lock-loser daemon exits, the session disappears. The next bootstrap re-evaluates from the no-session path and the cascade recovers cleanly (no log noise, no doom-loop), so this is acceptable for the contract this component asserts. A future work unit could opt in to literal persistence by adding `set-option -t _portal-saver remain-on-exit on` to the saver bootstrap path — this would keep the pane present with a dead shell after the daemon exits, allowing `tmux has-session -t _portal-saver` to succeed even in the lock-loser case. That change is deferred because (a) the recovery cascade already converges correctly under the current ordering, and (b) `remain-on-exit on` has subtle interactions with restore semantics (the dead pane is still enumerable by `list-panes` and would need to be filtered out of any future enumeration logic). Re-open this trade-off if a downstream requirement emerges for literal session-persistence.

**Files affected:** `internal/tmux/portal_saver.go` (`createPortalSaverWithRetry`, `BootstrapPortalSaver`, possibly `portalSaverCommand` constant rename/split into `portalSaverPlaceholderCommand` and `portalSaverDaemonCommand`), tests in `internal/tmux/portal_saver_test.go`.

## Component G — Test Isolation Contract for `portal state daemon`

**Goal:** Prevent any test that spawns `portal state daemon` (or any subprocess that could spawn the daemon transitively, e.g., a full `portal open`) from writing to the developer's real state directory. The trigger on this install — a leaked test-fixture daemon at `/tmp/test_hook_debug2/s` running against `~/.config/portal/state/` — was the direct cause of the observed end-state.

**Attribution decision:** The investigation established that the fixture `/tmp/test_hook_debug2/` does **not** appear in the repo's test code (`grep test_hook_debug2 .` returns no matches). The leaked fixture was an ad-hoc developer test session, not a repo-originated test helper. Therefore the fix shape is **helper + documentation**, not lint enforcement (which would be appropriate if a repo helper were the offender). However, the helper SHOULD have a structurally-mandatory signature so future ad-hoc tests using it cannot accidentally inherit the developer's `$XDG_CONFIG_HOME`.

**Fix:**

1. **New test helper: `portaltest.NewIsolatedStateEnv(t)`.** Returns an `env []string` (suitable for `exec.Cmd.Env =`) and a state directory path. Both are derived from a per-test `t.TempDir()` value. The helper:
   1. Starts from `os.Environ()`.
   2. **Removes** any existing `XDG_CONFIG_HOME` entry.
   3. **Sets** `XDG_CONFIG_HOME=<t.TempDir()>/config` (and `MkdirAll` that path).
   4. Returns the constructed env slice and the resolved state directory path.
   5. Registers `t.Cleanup` to verify on test exit that the developer's real `~/.config/portal/state/` was untouched. The pre-test snapshot is a `map[string]fileFingerprint` keyed by path, where `fileFingerprint` captures (a) existence, (b) size, (c) mtime nanoseconds, (d) ctime nanoseconds, and (e) a SHA-256 of file contents for files ≤ 1 MiB. The cleanup walks the same directory and compares; **any** delta (new file, removed file, changed size/mtime/ctime/content) fails the test with a clear error citing the changed path and the type of delta. Edge cases:
      - If the directory does not exist at snapshot time, the pre-test snapshot is empty; any file or subdirectory created during the test counts as a delta and fails the test.
      - Symlink mutations (target change, new symlink) are detected via `lstat`; the snapshot uses lstat semantics throughout.
      - The walk follows `~/.config/portal/state/` only; sibling directories (e.g., `~/.config/portal/projects.json`) are out of scope for the backstop because they are not written by the daemon.

   Placement: **a new leaf package `internal/portaltest/`** (not attached to `portalbintest`). Rationale: env isolation is orthogonal to binary building, and a new leaf keeps the import graph cleaner (tests that need only isolation don't pull in `portalbintest`'s build-helper surface). Test-only — the `*testing.T` parameter ensures the helper cannot be imported into production code.

2. **Audit existing test helpers.** Any helper in `internal/portalbintest`, `internal/tmuxtest`, or `internal/restoretest` that spawns `portal` or `portal state daemon` as a subprocess MUST pass the env from `portaltest.NewIsolatedStateEnv` (or equivalent isolation). Helpers currently inheriting `os.Environ()` directly are updated to require the isolated env at their call signature — no overload that omits it.

   **Audit deliverable.** The implementer produces an audit list as part of the PR description (or a dedicated `.workflows/.../audit-G-test-helpers.md` file). The list enumerates every function in the three packages above that calls `exec.Command`, `exec.CommandContext`, or any equivalent subprocess spawn primitive with a `portal` binary path. For each entry, the audit records the helper name, file:line, and one of: (a) "updated to take isolated env" with a commit reference, (b) "does not spawn portal/daemon — out of scope" with a one-line justification, or (c) "deleted as part of this work unit" with rationale. The audit's **completion criterion** is `grep -rn "exec.Command.*portal\b" internal/portalbintest internal/tmuxtest internal/restoretest` returning zero call sites that are NOT either (a)-tagged in the audit OR explicitly opted out per (b). The grep result is captured in the audit deliverable.

3. **Contributor documentation.** Add a short section to `CLAUDE.md` under "DI / testing pattern" — or a new `TESTING.md` if planning prefers — stating:
   - Any test that runs `portal state daemon` (directly or via `portal open`/bootstrap) MUST use `portaltest.NewIsolatedStateEnv` (or equivalent) before spawning the subprocess.
   - The reasoning: a leaked test daemon inheriting the developer's `$XDG_CONFIG_HOME` corrupts the developer's live install (this incident is the canonical example).
   - The post-test mtime-snapshot check is a backstop, not a substitute for the env override.

4. **No lint or CI enforcement** is added in this work unit — the attribution showed no repo helper was the offender, so the rule is contributor-discipline + the structurally-mandatory helper signature. If a future incident reveals a repo helper that bypassed the contract, lint enforcement can be added in a separate work unit.

**Acceptance criteria:**

- **Helper exists with the documented signature.** `portaltest.NewIsolatedStateEnv(t *testing.T) (env []string, stateDir string)` is callable; the returned env contains `XDG_CONFIG_HOME=<tempDir>/config` and does NOT contain the developer's pre-test `XDG_CONFIG_HOME` value. Verified by unit test.
- **mtime backstop fires on violation.** Construct a test that uses the helper but then *deliberately* writes to the developer's real `~/.config/portal/state/sessions.json` (e.g., via direct file write bypassing the env). The `t.Cleanup` registered by `NewIsolatedStateEnv` fails the test with a clear error referencing the modified path. Verified by a meta-test.
- **Existing helpers route through isolation.** Any helper in `portalbintest` / `tmuxtest` / `restoretest` that spawns `portal` or `portal state daemon` either:
  - Takes the isolated env as a parameter (preferred), OR
  - Calls `portaltest.NewIsolatedStateEnv` internally before spawning.
  Verified by code-review of the audit list produced during implementation.
- **CLAUDE.md (or TESTING.md) documents the contract.** A reviewer can locate the rule by searching for "test isolation" or "XDG_CONFIG_HOME" in the docs.
- **Existing tests pass.** No regression in the existing integration test suite after the helpers are updated.

**Out of scope for G specifically:**

- Removing the leaked `/tmp/test_hook_debug2/` fixture from the reporter's machine. That is local cleanup (kill the orphan, `rm -rf /tmp/test_hook_debug2/`), not a code change.
- Adding lint enforcement (e.g., `go vet`-style check that all subprocess spawns of `portal` set `XDG_CONFIG_HOME`). Deferred pending evidence that a repo helper has slipped through.

**Files affected:** new `internal/portaltest/` package (or addition to `internal/portalbintest`), updates to `internal/portalbintest`, `internal/tmuxtest`, `internal/restoretest` helper signatures, `CLAUDE.md` or new `TESTING.md`.

## Composite End-to-End Verification

In addition to per-component acceptance criteria, the work unit MUST include **one composite integration test** that reconstructs the reporter's failure scenario end-to-end and asserts the converged healthy state. This test catches component-composition regressions that per-component tests cannot.

**Scenario setup:**
1. Start a real tmux server with `_portal-saver` plus some user sessions.
2. Spawn three `portal state daemon` processes against the same state directory: one as the legitimate saver-pane process, two as orphans (different parent processes; one with a `daemon.pid` reference, one without).
3. Confirm the pre-fix state reproduces: `pgrep -fxc 'portal state daemon'` returns 3, scrollback directory oscillates 0–1 `.bin` file across ticks.

**Bootstrap invocation:**
4. Invoke `portal open` (or the bootstrap orchestrator directly via its test entry point) against the new binary.

**Post-bootstrap assertions (the composite end-state):**
5. `pgrep -fxc 'portal state daemon'` returns 1 within 6 s of bootstrap entering `EnsureSaver` (Component A's escalation budget + Component B's sweep latency).
6. Scrollback directory is stable across 10 consecutive 1 s observations — no `.bin` file deletions or unexpected new files (Components A+B+E composition).
7. A subsequent test-bench invocation of `AcquireDaemonLock` from a fresh process refuses with `ErrDaemonLockHeld` (Component C pre-check verifies on the live state).
8. After externally killing the legitimate daemon's `_portal-saver` pane (simulating an out-of-band saver loss), the daemon self-ejects within (N+1) tick intervals (Component D in the live context).
9. `_portal-saver`'s pane process is `portal state daemon` AND `tmux show-options -t _portal-saver destroy-unattached` reports `off` (Component F). *Note: this step is scoped to the lock-winner case. In the lock-loser cascade — see the Component F acceptance amendment in the Corrigenda section below — the saver session disappears on tmux 3.6b and is recreated by the next bootstrap, so step 9 evaluates against the post-recovery session, not the disappeared one.*

**Files affected:** new integration test file in `cmd/` or `internal/restoretest/` (planning decides; the latter has existing real-tmux scaffolding via `tmuxtest`). The test is tagged with the existing integration build tag pattern.

---

## End-State Verification

After all seven components ship, the following should hold on the reporter's install and any equivalent install:

- **`portal open` is sub-second** under steady state (no orphan daemons, healthy saver). With an orphan present at bootstrap, total bootstrap time is bounded by Component A's escalation budget (~6 s including the existing 5 s session-kill poll), and is bounded by Component B's `pgrep`-based fast-kill (sub-second) when the orphan is reachable via direct SIGKILL.
- **Session previews render the session's captured scrollback** for every session in the picker. The scrollback directory contains one `.bin` per live pane keyed by paneKey, and is stable across daemon ticks (no oscillation).
- **`K` permanently kills sessions.** `portal open` after a kill does NOT reconstruct the killed session. `sessions.json` no longer contains the killed session and is not overwritten by a competing daemon.
- **Daemon log is quiet under steady state.** No `"another daemon holds the lock"` entries, no `"prior daemon did not exit within 5s"` entries, no `"no such session: _portal-saver"` entries, and no hydrate-side `"scrollback file not found for --hook-key=…"` warnings (these surface when the GC race has deleted the `.bin` a hydrate helper expected to find).
- **`pgrep -fxc 'portal state daemon'` returns 1** at all times under steady state (after the legitimate daemon spawned by `EnsureSaver` has come up). After bootstrap, never more.
- **`daemon.version` file content matches the running binary's version.** On the reporter's install, `daemon.version` was `0.5.5` after a 0.5.6 upgrade — direct evidence that `EnsurePortalSaverVersion` was not running cleanly because the kill-barrier was timing out. Post-fix, `daemon.version` should track the running binary on every bootstrap. **This is observation-only, not a direct test of any single component** — it is a downstream consequence of Components A and B unblocking the kill-barrier so `EnsurePortalSaverVersion` can recycle the saver when the version marker is stale. No component takes explicit ownership of this acceptance; if it fails on a real install, the diagnostic path is to check whether A's escalation or B's sweep ran successfully.
- **Orphan daemon lifetime, if one somehow appears between bootstraps, is bounded by Component D's hysteresis** (~3–4 s with the current ~1 s tick interval) plus the per-tick check itself.

## Transitional Recovery for the Reporter's Install

The reporter's live install is in the broken state at the time of this bugfix being authored. The code fix does NOT automatically clean up the existing orphans on first run — Component B's sweep will only run when the user invokes `portal open` against the new binary. Once that invocation happens, B sweeps the existing orphans and A handles the recorded one; the install converges to the healthy end state from that single invocation.

If the user wants to recover before the fix ships:

```bash
pkill -9 -x 'portal state daemon'
rm -f ~/.config/portal/state/daemon.lock ~/.config/portal/state/daemon.pid ~/.config/portal/state/daemon.version
# Optionally also kill the leaked test-fixture tmux server:
tmux -S /tmp/test_hook_debug2/s kill-server 2>/dev/null || true
rm -rf /tmp/test_hook_debug2/
```

This is a one-shot manual procedure. It is not part of the shipped fix and does not need to be documented for end users; included here for completeness of the bugfix narrative.

## Release Approach

- **Regular release.** No hotfix. Local recovery is available (see above) and the failure mode degrades only the dogfooding install at this stage — there is no evidence of broader user impact.
- **Tagged release follows the existing goreleaser flow.** ldflags-injected version constant moves to the next v0.5.x or v0.6.0 (planning decides version bump based on whether any user-visible flag/behaviour changes — currently none, so v0.5.x patch bump is appropriate).
- **No migration prompt required at startup.** Component C's `daemon.pid` pre-check is backward-compatible: a missing/stale `daemon.pid` is treated as "no holder" and acquire proceeds. Component F's saver-creation ordering is fully internal. No state-file schema changes.

## Risk Summary

- **Components A, B, E, F, G** are mechanical or test-infrastructure changes with low regression risk.
- **Component C** introduces a new pre-check that could in principle refuse to acquire when it shouldn't (false positive). The identity check on the recorded PID is the mitigation — if the recorded PID is alive but is not a `portal state daemon`, the check ignores it. Worst-case false-positive consequence is "this bootstrap's saver pane process exits as lock-loser with a WARN" — degraded but not destructive.
- **Component D's hysteresis (N=3)** is the only tuning knob. Planning phase **MUST** empirically measure the legitimate `_portal-saver` create/recreate transient duration before locking N — this is a required mitigation, not optional. Measurement covers: steady-state ticking, attach/detach cycles, hook-driven `client-attached` events, and the bootstrap kill-and-recreate sequence. The measured worst-case transient duration plus a safety factor of 2× sets the lower bound for N. The spec default of 3 ticks is a starting estimate; the measurement may revise it upward. Target ceiling remains "single-digit ticks" — if the measured transient exceeds ~5 ticks, treat that as evidence of an upstream defect (e.g., slow tmux command latency or a real recreate-spanning-window) rather than tuning N higher.

---

## Working Notes

## Corrigenda

This specification was amended after the Phase 3 specification phase closed. Amendments were authored within the same work unit (`slow-open-empty-previews-and-zombie-sessions`) during cycle-1 review remediation (Phase 11) and cycle-6 analysis (Phase 12). The document body reflects the corrected text; git history preserves the original.

### 2026-05-25 — Component F lock-loser cascade re-framed (tasks T11-3, T12-1)

**Original claim (acceptance criteria, bullet 3):**

> "`_portal-saver` session persists after the daemon exits."

**Original claim (design rationale, "New behaviour" step 3 trailing clause):**

> "Even if the daemon exits immediately as lock-loser, `destroy-unattached=off` is already in effect, so the session persists for the next bootstrap to evaluate."

**Correction:** On tmux 3.6b, the `_portal-saver` session DOES disappear when its lock-loser daemon-pane process exits even with `destroy-unattached=off`, because the daemon pane owns the session lifetime. The observable contract Component F actually delivers is **log-noise absence**: zero `no such session: _portal-saver` log entries during the lock-loser cascade. Literal session-persistence is demoted to a future opt-in via `set-option -t _portal-saver remain-on-exit on` (see the Note immediately after the acceptance criteria for trade-offs).

**Companion work:**

- **T11-3** amended acceptance criterion 3 and added the `remain-on-exit on` opt-in Note.
- **T12-1** reconciled the design-rationale prose in "New behaviour" step 3 to cross-reference acceptance criterion 3 and the Note instead of asserting the demoted claim.

### 2026-05-26 — Cycle-2 review-recommendation absorption (post-cycle-1 doc corrections)

The cycle-1 review surfaced five spec/impl mismatches and missing-acknowledgement gaps that did not block ship but were left documented for a future amendment. They are captured here so the spec matches what the implementation actually does.

**Component C — orphan-PID write semantics on self-eject path.** When `AcquireDaemonLock`'s pre-check identifies the recorded `daemon.pid` as alive but not a `portal state daemon` (the orphan case Component A/B handle), the implementation **does not** write a new `daemon.pid` value before the daemon exits. The spec did not enumerate this branch's pidfile behaviour. Source: cycle-1 recommendation #34 (T4-10). See Component C — refer to this corrigendum entry from there.

**Component D — surrogate triad for "no final flush on self-eject" acceptance.** Spec acceptance criterion uses `ProcessState.Exited()` as the verification, but when the daemon runs as a tmux pane process the test framework cannot observe `ProcessState` directly (tmux owns the child). The implementation uses a documented surrogate: (a) scrollback bytes-identical between pre- and post-eject snapshots, (b) `daemon.pid` retained (not unlinked by the eject), and (c) the literal INFO log marker "self-supervision: saver-membership lost for N consecutive ticks, exiting" present exactly once. The three together discharge the original `ProcessState`-style assertion. Source: cycle-1 recommendation #43 (T6-6).

**Component G — fingerprint backstop ordering deviation.** Spec contract specified that the backstop snapshots the developer's state dir **BEFORE** `IsolateStateForTest` mutates the env. The implementation snapshots **AFTER** env mutation as host-noise mitigation: a developer running a real portal daemon would otherwise see a transient pre-mutation snapshot drift constantly. The materially changed threat model is "env-flow tests only" — direct file writes that bypass the env are still caught because the backstop's post-test walk is independent. Source: cycle-1 recommendation #22 (T1-3).

**Component G — `hashed-changed` delta label.** The backstop's diff vocabulary includes a `hashed-changed` label, surfaced when a file's content hash differs but other metadata (size, mtime, ctime) is unchanged — the strongest "file actually edited" signal. The spec did not enumerate the delta vocabulary; the label is recorded here for future reference. Source: cycle-1 recommendation #21 (T1-3).

**Composite End-to-End Verification — step 9 scope footnote.** Composite step 9 asserts `_portal-saver`'s pane process is `portal state daemon`. On tmux 3.6b the lock-loser cascade case sees the session disappear (see the Component F amendment above) and step 9 is implicitly scoped to the lock-winner case. Reader-orientation footnote added inline at the step. Source: cycle-1 recommendation #51 (T11-3).
