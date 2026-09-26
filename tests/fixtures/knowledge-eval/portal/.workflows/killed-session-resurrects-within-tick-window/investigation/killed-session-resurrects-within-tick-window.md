# Investigation: Killed Session Resurrects Within Tick Window

## Symptoms

### Problem Description

**Expected behavior:**
After a tmux session is killed (via tmux's `M-q kill-session` keymap, the user's `Option-Q` binding, or Portal's TUI `K` confirm flow), a subsequent `portal` invocation must not show that session in the Sessions list and must not reconstruct it as a skeleton pane in tmux. The kill should be authoritative and immediate from the user's point of view.

**Actual behavior:**
For roughly 2–5 seconds after the kill, a subsequent `portal` invocation:
- Still lists the killed session in the TUI Sessions page.
- Triggers bootstrap step 5 `Restore` to reconstruct the session in tmux as a skeleton pane (`pane_start_command` shows `portal state hydrate ...`, matching `internal/restore/session.go` / `internal/restore/restore.go`).

After ~5 seconds the session disappears from both the list and tmux and stays gone — i.e. eventual consistency on the order of one daemon tick.

### Manifestation

- Session appears in `portal` Sessions list after the user explicitly killed it.
- Same session is observable as a freshly-created skeleton pane in tmux via `tmux list-panes -a -F '#{pane_start_command}'` showing `portal state hydrate ...`.
- Window/pane geometry of the resurrected session matches the pre-kill saved skeleton, not whatever the user had open at kill time.
- After ~5s the same `portal` invocation produces a session list without the killed session and tmux is quiet.

### Reproduction Steps

1. Have at least one Portal-managed tmux session attached.
2. Kill it via any of the three paths:
   - `Option-Q` (user keybind),
   - tmux's `M-q` binding to `kill-session`,
   - Portal TUI: select session, press `K`, confirm.
3. Within ~2 seconds, run `portal` (or `x`).
4. Observe the killed session present in the Sessions list and reconstructed in tmux as a skeleton pane.
5. Wait until at least ~5 seconds have elapsed from the kill, run `portal` again.
6. Observe the session gone from the list and absent from tmux.

**Reproducibility:** Always, given the timing window.

### Environment

- **Affected environments:** Local — Portal 0.5.0 on the user's primary development machine.
- **Browser/platform:** N/A (CLI/TUI). macOS, tmux backend.
- **User conditions:** Single-user-per-machine. State directory has clean `@portal-skeleton-*` markers (verified — `tmux show-options -s | grep @portal-skeleton` is empty), and previously-affected sessions have fresh scrollback `.bin` files. Sibling, not regression, of `daemon-merge-reintroduces-dead-sessions` and `killed-sessions-resurrect-on-restart`, which both targeted the stale-marker class — that class is observably resolved here.

### Impact

- **Severity:** High (trust-tier). User-visible "I killed this, and Portal brought it back" symptom on the same surface as two recent resurrection-class bugfixes.
- **Scope:** Any user who kills a session and reopens Portal within the race window. Single-user product so no multi-user concurrency angle.
- **Business impact:** Trust regression against recently-shipped resurrection fixes.

### References

- Recently-shipped sibling fixes: `daemon-merge-reintroduces-dead-sessions`, `killed-sessions-resurrect-on-restart`.
- Implicated paths called out by the user:
  - tmux global hook `session-closed` → `portal state notify` (`cmd/state_notify.go`).
  - Daemon tick loop owning `sessions.json` rewrites (`cmd/state_daemon.go`).
  - Bootstrap step 5 `Restore` reading `sessions.json` on every Portal invocation (`internal/restore/restore.go`, `internal/restore/session.go`).

---

## Analysis

### Initial Hypotheses

- The kill-side path (`session-closed` hook → `portal state notify`) is fire-and-forget against the daemon. `sessions.json` is rewritten on the daemon's tick, not synchronously with the kill — so any Portal invocation between kill and the next tick observes a `sessions.json` that still lists the dead session, and `Restore` faithfully reconstructs it.
- The user has explicitly stated that the fix direction must be **synchronous at the kill-side path** (commit the persistence change before returning), not timeouts / tick-rate adjustments / retry tuning.

### Code Trace

**Kill-side hook plumbing (`internal/tmux/hooks_register.go:15-23, 43`):**

```go
var saveTriggerEvents = []string{
    "session-created", "session-closed", "session-renamed",
    "window-linked", "window-unlinked", "window-layout-changed",
    "pane-focus-out",
}
const notifyCommand = `run-shell "command -v portal >/dev/null 2>&1 && portal state notify"`
```

`RegisterPortalHooks` (bootstrap step 2) idempotently appends `notifyCommand` on `session-closed` (among six other events). For every kill — TUI `K`, `portal kill`, `Option-Q`, `M-q`, external `tmux kill-session` — tmux fires `session-closed`, which runs `portal state notify` from the tmux hook context as a detached short-lived subprocess.

**What `portal state notify` actually does (`cmd/state_notify.go:33-62`):**

```go
RunE: func(cmd *cobra.Command, args []string) error {
    dir, err := state.EnsureDir()
    ...
    path := state.SaveRequested(dir)
    f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
    _ = f.Close()
    _ = os.Chtimes(path, time.Now(), time.Now())
    return nil
}
```

`notify` does **zero tmux calls** and writes nothing to `sessions.json`. It creates/truncates `save.requested` and returns. The docstring is explicit: *"The hosted daemon polls this dirty flag on its 1-second tick and performs the actual capture."*

**Daemon tick — eventual consistency (`cmd/state_daemon.go:70-120, 132-207`):**

```go
func defaultDaemonRun(ctx context.Context, deps *daemonDeps) error {
    ticker := time.NewTicker(deps.TickerPeriod)         // 1 second
    for {
        select {
        case <-ticker.C:
            tick(ctx, deps)
        case <-ctx.Done():
            return daemonShutdownFunc(deps)
        }
    }
}
func tick(...) {
    if restoring { return }
    if !dirty && !gap { return }                        // gap = 30s max
    captureAndCommit(...)                                // full structural capture + per-pane scrollback
    deps.LastSaveAt = time.Now()
    os.Remove(state.SaveRequested(deps.Dir))
}
```

`captureAndCommit` enumerates `ListSkeletonMarkers` + `CaptureStructure` (which calls `ListSessionNames`, `ListAllPanesWithFormat`, per-session `ShowEnvironment`) + per-pane `CaptureAndHashPane` (unbounded `capture-pane -e -p -S -`) + `Commit`. Per-tick wall time scales with rendered scrollback; field-measured at >1s and previously documented as ≥3.9–5s on this user's profile (see prior work unit `saver-kill-respawn-loop-leaks-daemons`).

**Consumer side — bootstrap step 5 Restore (`internal/restore/restore.go:42-66`):**

```go
func (o *Orchestrator) Restore() (bool, error) {
    idx, skip, err := state.ReadIndex(o.StateDir)       // ← reads sessions.json
    ...
    liveSet, ok := o.snapshotLiveSessions()             // ← live tmux session names
    ...
    for _, sess := range idx.Sessions {
        o.restoreOne(sr, sess, liveSet)                 // ← reconstructs anything in idx but not in live
    }
}
```

`restoreOne` (lines 110-133): if the session name from `sessions.json` is not in the live tmux set, it dispatches to `SessionRestorer.Restore` → `ApplyWindowGeometry` → `ApplySkeletonMarkers`. The killed session is *exactly* this case during the race window: present in stale `sessions.json`, absent from live tmux, therefore reconstructed.

**Race window arithmetic:**

| t | Event |
|---|-------|
| T0 | User kills session (any path). tmux removes it from live state, fires `session-closed`. |
| T0+ε | `portal state notify` spawned; touches `save.requested`; exits. `sessions.json` still contains the dead session. |
| T0+(0,1s) | User runs `portal`. Bootstrap step 5 reads stale `sessions.json`; killed session present, live tmux says it's gone → **Restore reconstructs**. Visible symptom. |
| T0+~1s | Daemon's next ticker fire. `tick()` enters `captureAndCommit`. |
| T0+~1s..5s | `captureAndCommit` walks panes, hashes scrollback. While in flight, `sessions.json` remains stale. |
| T0+~2..5s | `state.Commit` rewrites `sessions.json` without the dead session (merge filter from `daemon-merge-reintroduces-dead-sessions` correctly rejects prev's dead entry). Symptom clears. |

**The merge filter is doing its job.** `mergeSkippedPanes` (`internal/state/capture.go:122-147`) correctly drops any prev session/window/pane that is not in the fresh capture — confirming the user's note that this is **not** a regression of `daemon-merge-reintroduces-dead-sessions` or `killed-sessions-resurrect-on-restart`. Those fixes operate **after** the daemon's tick completes; the bug here is that the consumer (`Restore`) runs before the daemon ticks at all.

**Key files:**
- `internal/tmux/hooks_register.go` — `session-closed` → `notifyCommand` registration. The seam where kill-event → persistence is wired.
- `cmd/state_notify.go` — the dirty-flag touch; the single point that decides "do I persist synchronously or queue?".
- `cmd/state_daemon.go` — the daemon tick loop; owner of `sessions.json` rewrites today.
- `internal/restore/restore.go` — the consumer that reads `sessions.json` on every Portal invocation.
- `internal/state/commit.go` — `Commit(dir, idx, anyScrollbackChanged, logger)` is the atomic-write primitive; structurally available to any caller, not daemon-exclusive.
- `internal/state/capture.go` — `CaptureStructure` is also caller-agnostic (takes a `CaptureClient` interface satisfied by `*tmux.Client`).

### Root Cause

`sessions.json` is rewritten **eventually**, not synchronously with kills. The `session-closed` tmux global hook fires `portal state notify`, which is by deliberate design a "dirty flag touch + return": no tmux calls, no `sessions.json` write. The actual `sessions.json` rewrite is owned by the daemon's 1s ticker, gated on `save.requested` being set. The race window for the symptom is `[0, ticker.period + per-tick wall time]` — bounded above only by the daemon's worst per-tick capture latency.

Bootstrap step 5's `Restore` reads the still-stale `sessions.json` during this window and reconstructs the killed session because the consumer-side contract is "if it's in `sessions.json` and not in live tmux, restore it." That contract is correct given the assumption that `sessions.json` is a current truth of the user's intended session set. The assumption is what the kill-side path violates.

**Root cause statement:** The kill-side persistence path (`session-closed` hook → `portal state notify`) is asynchronous with respect to the daemon's commit of `sessions.json`. No code path makes the kill durable to disk before the spawned hook subprocess exits. Any consumer reading `sessions.json` within the daemon's tick window observes a state that is inconsistent with the kill that already happened in tmux.

### Contributing Factors

- **`notify` is intentionally minimal.** It performs zero tmux calls and zero `sessions.json` writes — a 2-syscall hot path designed to be fired by all seven save-trigger events without measurable cost in any of them. The current `session-closed` registration inherits this minimal cost but pays a correctness price the other six events don't (since for them, eventually-consistent state is fine).
- **The daemon's tick is uninterruptible.** `tick()` runs synchronously inside the ticker arm; per the `saver-kill-respawn-loop-leaks-daemons` analysis, `ctx.Done()` is unreachable inside a tick. Even with `save.requested` set immediately, the daemon can't preempt its current iteration to honour the new dirtiness — the race window widens with sweep cost.
- **The daemon may not be running at all.** `_portal-saver` is best-effort (bootstrap step 4 surfaces `SaverDownWarning` on failure). If the daemon is down at the time of a kill, `save.requested` is touched but no commit will ever happen until the next bootstrap recreates it — extending the resurrection window from seconds to "until the next Portal start".
- **Same-process kill paths don't intercept before tmux's hook.** The TUI `K` path (`internal/tui/model.go:1521-1529 killAndRefresh`) and `portal kill` (`cmd/kill.go:33-38`) call `tmux.KillSession` and then return — neither commits `sessions.json` synchronously. They rely on the same eventual-consistency contract as the external Option-Q / M-q paths.
- **`Restore`'s contract is "stale-data-friendly".** It uses `sessions.json` as the only source of "what was here last". There is no live tombstone, no marker-of-recent-kills, no cross-check against any source of truth other than `sessions.json` itself.

### Why It Wasn't Caught

- **The two recent resurrection-class bugfixes targeted a different layer.** `daemon-merge-reintroduces-dead-sessions` (Fix Component A) added live-set filtering inside the daemon's merge step; `killed-sessions-resurrect-on-restart` added an eager-signal step and stale-marker cleanup. Both layers operate **inside** the daemon or its produced state; they assume that by the time their fixes execute, `sessions.json` itself is being rewritten correctly. None of them gated the consumer side (`Restore`) against the bound on how stale `sessions.json` could be.
- **No test exercises the "kill then immediately bootstrap" timeline.** Integration tests using `restoretest` typically pre-seed `sessions.json` and assert the post-bootstrap structure. They don't drive the live tmux state through a kill mid-bootstrap-window.
- **The 1-second tick was tested for steady-state, not boundary.** The daemon tick test surface in `cmd/state_daemon_test.go` mocks the ticker and asserts per-tick behaviour. There is no test asserting "between two ticks, `sessions.json` does NOT contain a session that is no longer in live tmux." That property is unstated.
- **Per-tick wall time is environment-sensitive.** On CI / fresh checkouts with empty scrollback, captures complete in milliseconds; the race window collapses to ~50ms and is reproducible only with specific scrollback profiles in the wild. The earlier 0.5.0 release notes characterised tick cost without flagging the consumer-side window.

### Blast Radius

**Directly affected:**

- `cmd/state_notify.go` — the natural seam for a synchronous commit on `session-closed`. Either a flag (`--sync`) or a sibling subcommand (`portal state commit-now`) lands here.
- `internal/tmux/hooks_register.go` — the `session-closed` event needs to migrate from `notifyCommand` to the synchronous variant. The six other events keep the existing dirty-flag touch.
- `cmd/state_daemon.go` — must tolerate concurrent `sessions.json` writers; in practice `state.Commit` is already atomic (temp+rename), so this is a documentation and invariant tightening rather than a code change.

**Potentially affected:**

- **`mergeSkippedPanes` (`internal/state/capture.go:122-147`).** The daemon's next tick after a notify-driven synchronous commit will run `captureAndCommit` with a `PrevIndex` that may be older than the just-written `sessions.json`. The merge still works correctly because it filters by live structure, but `PrevIndex` staleness needs to be reasoned about explicitly (verdict from trace: safe — merge only adds back panes that are also present in fresh, which won't include the killed session regardless of stale PrevIndex).
- **`@portal-restoring` interaction.** A synchronous commit triggered during the restoring window (rare but possible: `session-closed` fires for the `_portal-saver` self-kill during bootstrap step 4 version-upgrade) must respect the marker just as the daemon's tick does, or it will corrupt the in-flight restore by committing a partial skeleton state.
- **Hook subprocess cost.** Adding a structural capture to the `session-closed` hook adds ~50-200ms of tmux work (one `ListSessionNames` + one `list-panes -a -F …` + per-session `ShowEnvironment`). This is per-kill, not per-keypress; acceptable cost on a path that previously was free.

**Not affected:**

- The six non-`session-closed` events (`session-created`, `session-renamed`, `window-linked`, `window-unlinked`, `window-layout-changed`, `pane-focus-out`). These are *creates*, *renames*, or *focus changes* — none of them are kill events, none of them can produce a "consumer sees a session that no longer exists" symptom. They stay on the cheap dirty-flag path.
- The hydration-trigger events (`client-attached`, `client-session-changed`). Orthogonal mechanism (skeleton FIFO signaling).
- Scrollback `.bin` files. The fix targets `sessions.json` only; the daemon retains ownership of `.bin` writes and dedup hashing. Orphan `.bin` files for the killed session are cleaned by `gcOrphanScrollback` on the daemon's next successful tick.
- The hooks layer (`hooks.json`). Not implicated; killed sessions have their hook entries cleaned lazily as today.

---

## Fix Direction

### Chosen Approach

**Make the `session-closed` tmux hook synchronously rewrite `sessions.json` before its subprocess returns**, by introducing a new minimal-cost capture-and-commit path that:

1. Captures the current structural index via the existing `state.CaptureStructure` (no scrollback / no hash work).
2. Atomically commits it via the existing `state.Commit` primitive.
3. Skips when `@portal-restoring` is set (defers to the daemon's existing restoration discipline).

The new path is wired into a dedicated entry point — either a flag on `portal state notify` (`--sync` / `--commit-now`) or a sibling subcommand (`portal state commit-now`). The `session-closed` hook registration in `internal/tmux/hooks_register.go` migrates from `notifyCommand` to the new entry point. The other six save-trigger events retain the existing cheap dirty-flag touch.

After this fix, every kill path (TUI `K`, `portal kill`, `Option-Q`, `M-q`, external `tmux kill-session`) produces a consistent `sessions.json` before the kill-triggered hook subprocess returns, eliminating the race window for the resurrection symptom without touching ticker rates, retry tuning, or timeouts.

**Deciding factor:** the user's explicit directive — synchronous, not eventually consistent; eliminate the race at its source. The `session-closed` hook is the single tmux-side seam that fires uniformly across all kill paths (cmd-internal and external), so making it the synchronous commit point covers all paths with one change. No new IPC. No daemon dependency for correctness of the kill path. No race window to size against scrollback profile.

### Options Explored

- **A. Synchronously commit from the cmd-layer TUI K and `portal kill` paths only.** Rejected: doesn't fix Option-Q / M-q / external `tmux kill-session`, which the user explicitly listed as the most common kill paths.
- **B. Make `portal state notify` synchronously commit on every save-trigger event.** Rejected: notify is registered on six other events including `pane-focus-out` (potentially many fires per minute); raising every one of those events from a 2-syscall touch to a full structural capture is gratuitous cost on paths that don't need it. Eventual consistency is correct for create/rename/relayout events.
- **C. Notify-and-wait IPC: `notify` signals the daemon and blocks until the daemon ACKs the commit.** Rejected: introduces a new IPC channel and protocol, depends on the daemon being alive (`_portal-saver` is best-effort), and still tunes a timeout window (the user's explicit "no timeouts" directive).
- **D. Have `Restore` cross-check `sessions.json` against live tmux and skip sessions tmux says are gone.** Rejected as the primary fix: it only patches the consumer side, leaving `sessions.json` itself stale and any other consumer (a future feature, an external tool, the daemon itself reading prev) subject to the same staleness. The user's directive is to fix the writer side, not patch the reader.
- **E. Register the new synchronous command in addition to (alongside) `notifyCommand` on `session-closed`.** Slightly more conservative than full replacement; both fire on every kill. Defer to user preference during findings review — both V1 (replace) and V2 (alongside) are viable.

### Discussion

User directional preference recorded in the inbox up front: synchronous at the kill-side path, no timeouts / retry tuning / tick-rate adjustments. Findings review confirmed the direction without contention; user said `y` to both the findings block and the fix-direction block on first presentation.

Synthesis validation surfaced four gaps the investigation hadn't enumerated. All four are addressed by the chosen approach rather than redirecting it:

- **`portal status` is also a stale-window reader.** Broadens the motivation for the writer-side fix; the synchronous commit benefits every consumer of `sessions.json`, not just `Restore`. No change to the fix shape.
- **Daemon-vs-hook narrow race.** Both writers re-query live tmux via `CaptureStructure → ListSessionNames` as their first step, so both observe post-kill state in the common case. `state.Commit`'s atomic write means the final on-disk state is one of N consistent snapshots, never torn. The sub-millisecond edge window where the daemon's `ListSessionNames` returned just before tmux completed the kill is real but vanishingly narrow; spec phase will document it as an accepted residual, not a blocker.
- **Hook re-entrancy.** The synchronous commit subprocess makes tmux client calls back into the same server from within the `session-closed` hook context. `pane-focus-out` and `session-renamed` have had historical re-entrancy quirks; `session-closed` is less suspect but not pre-validated. Plan phase needs a real-tmux integration test fixture to confirm no deadlock occurs from this hook event specifically.
- **`_portal-saver` underscore filter.** Steady-state user-kill of `_portal-saver` triggers the hook, runs the synchronous commit; `state.CaptureStructure`'s `keepSessionNames` excludes underscore-prefixed sessions, so the resulting idx omits `_portal-saver` — same as today. Structural guarantee from the existing filter; no special-casing needed. Spec phase should call this out explicitly so the invariant is documented, not implicit.

**Open design choice deferred to spec phase: V1 (new `portal state commit-now` sibling subcommand) vs V2 (`portal state notify --sync` flag on the existing entry point).** Both are mechanically equivalent for the user-visible behaviour. V1 is cleanest separation; V2 has the tighter blast radius on the cmd surface. User did not express a preference at investigation time — spec author chooses.

No alternatives explored beyond the five listed under **Options Explored**. The user's directional preference closed off C (notify-and-wait IPC) and D (no-timeouts), and the inbox's explicit listing of Option-Q / M-q ruled out A (cmd-layer-only fix). The chosen direction (E with limit to `session-closed`) is the only candidate satisfying all of "synchronous", "covers all kill paths", "no timeouts", and "no new IPC".

### Testing Recommendations

- **Unit test for the new commit-now command:** drive `state.CaptureStructure` + `state.Commit` against a mock tmux client; assert `sessions.json` is written with the expected sessions, and that `@portal-restoring` set causes a no-op return.
- **Integration test (real tmux fixture) for the kill → bootstrap timeline:**
  1. Bootstrap into a stable state with two sessions A and B.
  2. Kill session B via `tmux kill-session -t B` (drives the hook in the real way).
  3. Immediately (no sleep, no retry) read `sessions.json` and assert B is absent.
  4. Run another bootstrap; assert B is not reconstructed (consumer-side regression guard).
- **Regression test for the merge interaction:** assert the daemon's next tick after a synchronous commit produces an `sessions.json` byte-equivalent to the synchronous commit (no spurious re-introduction via a stale `PrevIndex`).
- **Behavioural test for the `_portal-saver` self-kill case:** during the version-upgrade kill of `_portal-saver`, `session-closed` fires; the synchronous commit must not corrupt `sessions.json` (verify the underscore-session-name filter in `keepSessionNames` correctly excludes `_portal-saver`).
- **`@portal-restoring` defence test:** simulate `session-closed` firing while the marker is set; assert the synchronous commit short-circuits and `sessions.json` is left untouched until the daemon's restoration completes.

### Risk Assessment

- **Fix complexity:** Low. ~30–50 lines for the new commit path (uses existing `state.CaptureStructure` + `state.Commit`); ~3 lines in `hooks_register.go` to migrate the `session-closed` registration; small `_test.go` additions.
- **Regression risk:** Low. The other six save-trigger events are untouched. The atomic-commit primitive is unchanged. The merge filter is unchanged. The daemon's tick is unchanged. The only new code is a thin orchestration shim on top of existing primitives.
- **Recommended approach:** Regular release. Symptom is recoverable today (wait ~5s and re-run `portal`); workaround was implicit. Fix posture is standard release; no hotfix needed.

---

## Notes

- User directional preference recorded up front: synchronous kill-side persistence, not eventual consistency. Avoid timeouts / retry tuning / tick-rate as mitigation.
