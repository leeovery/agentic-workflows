# Investigation: Killed Sessions Resurrect On Restart

## Symptoms

### Problem Description

**Expected behavior:**
- When a tmux session is killed — either by the user pressing the tmux prefix + `Alt-Q` (`kill-session`) from inside the session, or by selecting the session in the Portal TUI list and pressing `K` then confirming — the session should disappear from the Portal list AND stay gone across the next `portal open`.
- Per-pane on-resume hooks registered with `portal hooks set --on-resume "<cmd>"` should fire end-to-end on the next bootstrap, in the restored pane, with the configured command running before the user's interactive shell.

**Actual behavior:**
- **Symptom A** — Killed sessions disappear from the Portal list as expected, but on the very next `portal open` they reappear. Only some sessions are affected, consistently the same ones (on the reporter's machine: `leeovery-Gi5NLG`, `leeovery-feqhpg`). Other sessions kill cleanly.
- **Symptom B** — On-resume hooks never fire end-to-end for the affected panes. The reporter has not yet observed the registered command run on any restored pane.

The reporter and a prior investigator agreed both symptoms appear to share a single upstream trigger inside the hydrate path.

### Manifestation

Reported against Brew-installed `portal 0.3.1`. HEAD spot-checks of the relevant code paths suggest unchanged from the released binary, so HEAD is expected to reproduce — to be confirmed.

Observed at the time of the report:

- Three `@portal-skeleton-<paneKey>` tmux server-options were still set despite no restoration being in progress:
  - `agentic-workflows-XXrJ3J__1.1`
  - `leeovery-Gi5NLG__1.1`
  - `leeovery-feqhpg__1.1`
- Symptom A reproducers (`leeovery-Gi5NLG`, `leeovery-feqhpg`) are in this set.
- `~/.config/portal/state/portal.log` contains, dated to the most recent bootstrap, repeated entries of two distinct shapes for those same paneKeys:
  - `WARN | hydrate | write fifo …/hydrate-<paneKey>.fifo: open …: no such file or directory` — emitted by the `signal-hydrate` server-side handler (the global `client-attached` hook), failing because the per-pane FIFO does not yet exist when the signal lands.
  - `WARN | hydrate | timeout waiting for signal on --hook-key=<sess>:<w>.<p> --fifo=…` — emitted by the per-pane hydrate helper after waiting 3 s for a signal on its FIFO that never arrives.
- The reporter's `~/.config/portal/state/sessions.json` was being rewritten by the daemon (recent mtime), and the saved index continued to list the affected sessions even after they were killed.

### Reproduction Steps

1. Boot Portal so that bootstrap step 5 reconstructs the affected sessions.
2. Observe `portal.log` for `WARN | hydrate | write fifo …` and `WARN | hydrate | timeout waiting for signal on …` entries against specific paneKeys.
3. Inspect server options: `tmux show-options -s | grep '@portal-skeleton-'` — affected paneKeys still have markers set.
4. Kill one of the affected sessions (TUI `K`, or `tmux kill-session` from inside it). Confirm it disappears from the Portal list.
5. Run `portal open` again. Affected session reappears.
6. Inspect any registered on-resume hook for an affected pane — it has not run; the pane is just a bare interactive shell.

**Reproducibility:** Always, for the affected panes on the reporter's machine. Not all panes are affected — the conditioning factor is whatever causes the hydrate-signal race to land "signal first, FIFO second" for a specific pane.

### Environment

- **Affected environments:** Reporter's local macOS install (Brew `portal 0.3.1`).
- **Platform:** tmux + Portal CLI (Go).
- **User conditions:** Long-running tmux sessions reconstructed by bootstrap step 5 (Restore). Affected paneKeys are the same across reboots once they enter the stuck state.

### Impact

- **Severity:** Medium. Symptom A is low-grade but persistent — users cannot reliably clear sessions and a confirmed kill that is silently undone is a credibility issue. Symptom B effectively makes the on-resume-hooks feature non-functional in any environment where any pane times out hydrate.
- **Scope:** All users whose hydrate signals race ahead of the helper FIFO open. Probably common, not rare — same paneKeys reproduce across every bootstrap on the reporter's machine.
- **Business impact:** N/A (single-user CLI tool). User-trust impact: confirmed kills being undone, and a documented feature (on-resume hooks) silently not running.

### Supporting Observations (may or may not be related)

- `signal-hydrate` "write fifo … no such file or directory" entries appear **twice at the same timestamp** for the same paneKey on some bootstraps. Suggests the `client-attached` hook is firing more than once in quick succession — possibly from the alt-screen toggle in TUI bootstrap, or from how the `signal-hydrate` global hook is registered. Whether this matters for the bug at hand is unclear.
- `portal.log` also contains transient `WARN | daemon | capture pane <paneKey>: failed to capture pane "<paneKey>": exit status 1` entries against live, non-stuck sessions. Sporadic; same panes capture cleanly on later ticks. Possibly a race with `respawn-pane` during the hydrate window. Not user-visible but worth investigating alongside this work.
- The volume of warnings on every bootstrap is high enough to drown out future genuine warnings.

### Addendum 2026-05-09 — orphan `sh -c` wrappers post-timeout

When investigating a separate slowness issue, three `sh -c 'portal state hydrate …; exec $SHELL'` wrappers from the previous day's bootstrap were still alive (~20 hours old) for the same three paneKeys this bug names. On inspection, the inner `portal state hydrate` had long exited (presumably via the timeout path → `execShellAndExit` → exec'd the user's shell into the pane). The wrapper `sh` is parked waiting on the now-interactive shell child, which won't exit while the user has the pane open. The trailing `; exec $SHELL` in the wrapper is therefore dead code in practice — the helper has already exec'd `$SHELL` itself, and the wrapper's own `; exec $SHELL` after that is unreachable.

Probably minor (not load-causing), but every timed-out hydrate leaves a `sh` process parented to the tmux server until the pane closes, which in long-running sessions effectively means forever. Worth considering as part of the timeout-path redesign here, since the wrapper construction is the same code site that owns the bypass-hooks decision (Symptom B).

### References

- Original inbox file (now archived): `.workflows/.inbox/.archived/bugs/2026-05-08--killed-sessions-resurrect-on-restart.md`
- Related bug (already fixed): `.workflows/completed/daemon-merge-reintroduces-dead-sessions/` — the daemon merge defect that turns "stale `@portal-skeleton-*` marker" into "killed session reappears in `sessions.json`".
- Originating feature scope: `.workflows/completed/built-in-session-resurrection/` — source of truth for the timeout-path design choices that this bug interrogates.
- Likely-relevant code paths (pointers, NOT a fix proposal):
  - `cmd/state_signal_hydrate.go` — the `client-attached` handler that writes to the per-pane FIFO. Race partner.
  - `cmd/state_hydrate.go` — `runHydrate`, `handleHydrateTimeout`, `execShellAndExit`, `execShellOrHookAndExit`. Race partner; also where the timeout-path's "no hook firing" and "marker stays set" decisions live.
  - `internal/state/markers.go` — `@portal-skeleton-*` server-option lifecycle (`SetSkeletonMarker`, `UnsetSkeletonMarker`).
  - `cmd/state_hydrate.go` step 8 — the only success-path marker unset; non-fatal on failure.
  - `cmd/bootstrap/bootstrap.go` — step 2 (`RegisterPortalHooks`) for how `client-attached` is registered, step 5 (`Restore`) for the skeleton-build that primes the FIFO, step 7 (`SweepOrphanFIFOs`) for orphan-FIFO cleanup.
  - `~/.config/portal/state/portal.log` and `~/.config/portal/state/sessions.json` — useful artefacts to inspect on a reproducing machine.

---

## Analysis

### Initial Hypotheses

**Working hypothesis (to be validated):** The upstream trigger is a race between two bootstrap-step-5 actors:

- `signal-hydrate` (the global `client-attached` handler) writes a single byte to the per-pane FIFO at `…/hydrate-<paneKey>.fifo`.
- The hydrate helper (`portal state hydrate`, launched as the pane's initial process via `respawn-pane -k` during skeleton reconstruction) `mkfifo`s the FIFO and then `O_RDONLY`-blocks reading from it.

When the signal lands before the helper has the FIFO open, the writer hits ENOENT and the helper times out 3 s later.

Two design decisions in `handleHydrateTimeout` then compound the timeout into the user-visible symptoms:

1. **`handleHydrateTimeout` deliberately leaves the `@portal-skeleton-<paneKey>` server-option set** (commented as "marker stays set so the next attach re-signals"). The "next attach re-signals" promise is itself questionable — by the time the timeout fires, the helper has exec'd a bare shell, so the FIFO has no reader anymore; a subsequent `client-attached` signal would just hit ENOENT again. Meanwhile the persistent marker drives Symptom A (via the daemon-merge re-injection path, which is itself an already-fixed adjacent bug).
2. **`handleHydrateTimeout` deliberately routes to `execShellAndExit` (bare shell), bypassing the hook-firing exec.** This drives Symptom B.

### Code Trace

**Bootstrap step 5 (cold-start only — `internal/restore/restore.go:116-119`):**

```go
if _, alive := liveSet[sess.Name]; alive {
    // Silent skip per spec — the steady-state common case.
    return
}
```

Restore SKIPS already-live sessions. The skeleton path (and therefore the entire hydrate machinery) ONLY runs on the first `portal` invocation after a tmux server cold-start. Subsequent invocations of `portal open` see all sessions live and skip restore for them. **This bug is therefore a cold-start phenomenon** — the user sees it on first attach after a reboot or after the user kills the tmux server, not on every `portal open`.

**Skeleton arm phase (`internal/restore/session.go:194-227`, `armPanes`):**

For each saved pane in each non-live saved session:
1. `state.CreateFIFO(fifo)` — `mkfifo` at `<state>/hydrate-<paneKey>.fifo`. Creates the path.
2. `r.Client.RespawnPane(liveTarget, hydrateCmd)` — runs `respawn-pane -k`, killing the default shell created by `new-session`/`split-window` and replacing it with the wrapper from `buildHydrateCommand` (`internal/restore/session.go:419-426`):
   ```
   sh -c 'portal state hydrate --fifo X --file Y --hook-key Z; exec $SHELL'
   ```
3. After all panes in a session, `ApplySkeletonMarkers` (`internal/restore/session.go:351-359`) sets `@portal-skeleton-<liveKey>` for every live pane.

**Helper start (`cmd/state_hydrate.go:98-184`, `runHydrate`):**

Inside the wrapper sh, `portal state hydrate` runs and immediately calls `cfg.OpenFIFO(cfg.FIFO, hydrateTimeout)` (`runHydrate` step 1) — `os.OpenFile(path, O_RDONLY, 0)` blocks until a writer arrives or the 3-second timeout fires.

**Signal path (`cmd/state_signal_hydrate.go:58-84`, `runSignalHydrate`):**

Triggered by tmux's `client-attached` and `client-session-changed` global hooks (registered in `internal/tmux/hooks_register.go:32-35` against both events). Receives the session name via `#{session_name}`, enumerates panes IN THAT SESSION ONLY, looks up each pane's marker, and writes a single byte to its FIFO via `O_WRONLY|O_NONBLOCK`.

**Hook firing (`cmd/state_hydrate.go:221-239`, `execShellOrHookAndExit`):**

Reached only on the **signal-arrived** path (step 9 of `runHydrate`) and the **file-missing** path (`handleHydrateFileMissing`, `state_hydrate.go:279-300` — also unsets the marker before falling through). Looks up the structural hook key in `hooks.json` and exec's `sh -c '<HOOK>; exec $SHELL'` if found, or bare `$SHELL` if not.

**Timeout path (`cmd/state_hydrate.go:248-266`, `handleHydrateTimeout`):**

Fires when `openFIFOWithTimeout` returns `ErrHydrateTimeout` after 3 s with no signal. The handler:

1. Writes the reset preamble to stdout.
2. `os.Remove(cfg.FIFO)` — unlinks the FIFO from the filesystem.
3. Logs `WARN | hydrate | timeout waiting for signal on …`.
4. **Deliberately does NOT** unset `@portal-skeleton-<paneKey>` (comment at line 262: "marker stays set so the next attach re-signals").
5. Deliberately does NOT sleep 100 ms.

`runHydrate` then falls through to `execShellAndExit` (line 109) — bare shell, **no hook firing**.

### Root Cause

The bug has **one upstream trigger** producing **three downstream symptoms**, plus a fourth defect in the wrapper construction.

**Upstream trigger — selective signaling:**

`signal-hydrate` is fired by `client-attached` / `client-session-changed`, which are **per-session** hooks scoped via `#{session_name}` to the session the client is attaching to or switching to. Bootstrap step 5 creates skeletons for **every** non-live saved session, but `signal-hydrate` only writes to the FIFOs of the session being attached (the user's `portal open <X>` target). On a cold-start bootstrap with N saved sessions, only the panes of session X get signaled. The remaining N−1 sessions' helpers wait 3 seconds, never receive the signal, and time out.

This is not a race with the helper's `O_RDONLY` open — it's a missing trigger. Even if the helper opens the FIFO immediately, no signal will ever arrive for non-attached sessions during this server lifetime.

**Symptom A — killed sessions resurrect on next `portal open`:**

The timed-out helpers run `handleHydrateTimeout`, which deliberately leaves `@portal-skeleton-<paneKey>` set. When the user kills one of those panes' sessions, the daemon's next `captureAndCommit` tick runs:
- Pre-companion-fix: `mergeSkippedPanes` (`internal/state/capture.go`) saw the marker in `skipSet` and re-injected the dead session from `prev` into the freshly-captured index → killed session reappears in `sessions.json` and on next bootstrap.
- Post-companion-fix (currently on `main`): the merge filter requires session/window/pane to exist live in `idx.Sessions` before merging from prev. With the session killed, the merge correctly drops it.

So Symptom A's user-visible behaviour is **already fixed on `main`** by the companion bug's merge filter. The marker still leaks (this bug owns the marker-production path), but the merge no longer turns the leak into a resurrection. **This must be empirically reconfirmed against HEAD before scope-shaping the fix.**

**Symptom B — on-resume hooks never fire:**

`handleHydrateTimeout` returns nil without invoking the hook-firing exec; control returns to `runHydrate` at line 109 which falls through to `execShellAndExit` (bare shell). The pane gets a shell with no hook command run.

By design (`built-in-session-resurrection` spec, "Helper Behavior on Startup", step 3e: "exec $SHELL (bare shell; no hook firing on this path)"), the timeout path bypasses hooks. The spec's reasoning was that timeout signals "something went wrong with the signal flow" and bare shell is safer than potentially mis-firing the hook.

But because the upstream selective-signaling trigger turns the timeout path into the **steady-state path for every non-attached session on every cold-start bootstrap**, the on-resume-hooks feature is effectively non-functional for any user with multiple saved sessions. The "we don't know if the pane is in a healthy state" rationale doesn't hold when timeout has become a deterministic outcome of normal cold-start behaviour, not an exception.

**Symptom C — scrollback save silently skipped for stuck-marker panes:**

`captureAndCommit` (`cmd/state_daemon.go:131-133`) skips capturing scrollback for any pane whose paneKey is in the marker set. So while a marker is stuck (pane is live but marker survives the timeout), the daemon never saves that pane's scrollback. Across the server lifetime, the saved scrollback for affected panes goes stale.

The companion-fix step 7 (`CleanStaleMarkers`) does NOT close this gap because its predicate is "marker without a live pane" — but timeout-stuck markers are ON live panes (a wrapper sh + bare shell is still a live tmux pane). The cleanup correctly leaves them alone, and the markers therefore survive to suppress scrollback save indefinitely.

This is the "secondary harm" the companion spec flagged but cannot fully resolve from outside the marker-production layer.

**Defect D — orphan `sh -c` wrapper after timeout:**

`buildHydrateCommand` produces `sh -c 'portal state hydrate ...; exec $SHELL'`. The wrapper sh forks `portal state hydrate`, which on the timeout path calls `defaultExecShell` (`cmd/state_hydrate.go:322-325`) → `syscall.Exec($SHELL, [$SHELL], env)`. The portal process image becomes the user's shell; the wrapper sh remains the parent, blocked in `wait()` for that PID's exit. When the user eventually exits the shell, the wrapper proceeds to `; exec $SHELL` and replaces itself with **another** shell. Two consequences:

1. **Orphan `sh` parent**, observed at ~20 hours uptime in the addendum. Every timed-out hydrate leaves an `sh` process parented to the tmux server until the pane closes. Same on the success path — the helper exec's $SHELL inside `execShellAndExit` / `execShellOrHookAndExit`, so the wrapper sh is also parked across normal hydration.
2. **Pane does not close on `exit`** — the wrapper's trailing `; exec $SHELL` re-spawns a fresh shell when the user types `exit`. The user has to type `exit` twice to close the pane, contradicting the comment in `buildHydrateCommand` ("exiting the shell ends the pane"). The trailing `exec $SHELL` was apparently intended as a defensive fallback for the case where the inner `portal hydrate` exits without exec'ing — a scenario that does not happen in practice because both exit paths always exec.

### Contributing Factors

- **No bootstrap-driven signaling.** The hydrate-trigger contract assumes tmux's `client-attached` / `client-session-changed` will eventually deliver a signal to every skeleton pane. That contract holds only for the session the user attaches to; it has no answer for non-attached sessions.
- **Spec design choice: timeout path is a bypass, not a recovery.** The original `built-in-session-resurrection` spec treats timeout as an exceptional condition where degrading to bare shell is preferable to firing hooks blind. Under selective-signaling, timeout is the steady state for non-attached sessions.
- **Marker production is fire-and-forget.** `setSkeletonMarker` is non-fatal-if-missing and is set unconditionally for every live pane in the skeleton phase. There is no inverse "if hydration never completes, who cleans this?" lifecycle invariant — the timeout handler explicitly opts out of cleanup, and the bootstrap-time step 7 cleanup only handles the dead-pane case.
- **`exec $SHELL` fallback in the wrapper is dead code on the success path and harmful on the timeout path.** It exists for crash-resilience but is unreachable in practice (both exit paths exec) AND breaks the natural pane-close-on-exit semantics.
- **Both `client-attached` and `client-session-changed` register signal-hydrate.** When user attaches to a session, both events can fire near-simultaneously (the original `client-attached` plus an internal session-change event). Each invocation does a full marker enumeration and FIFO write attempt. For panes whose helpers have already timed out (FIFO removed, marker still set), both invocations log `ENOENT` warnings at the same timestamp. This explains the duplicate-write observation in the inbox.

### Why It Wasn't Caught

- **Integration tests cover only the happy path.** The `built-in-session-resurrection` integration tests verify the signal-arrived flow end-to-end (skeleton + signal + dump + hook + shell). They don't model the case where multiple sessions are skeletoned and only one is attached.
- **Manual reproduction requires multiple saved sessions.** A user with one saved session always attaches to it on first `portal open`, so the timeout path is unreachable. The bug only surfaces when N≥2 saved sessions exist and the user attaches to one — the steady-state shape of any actual user.
- **Timeout handler's "next attach re-signals" comment encoded the wrong invariant as true.** The comment at line 262 of `state_hydrate.go` reads as a deliberate design choice and was not flagged in review. The actual mechanism (FIFO unlinked at line 256, helper exec'd shell, no reader) makes "next attach re-signals" a no-op that just re-fires `ENOENT`.
- **Symptom B's user-visible signal is silent.** The on-resume-hooks feature failing produces no error — just a bare shell where the user expected `claude --resume`. The reporter inferred the failure from the absence of expected behaviour, not from any user-visible error.
- **Symptom C is even more silent.** Stuck markers suppressing scrollback save produces no error, no warning, no diagnostic — the user only notices on the next reboot when scrollback is empty. By then the connection to "marker leaked from a previous timeout" is invisible.

### Blast Radius

**Directly affected:**
- `cmd/state_hydrate.go` — `handleHydrateTimeout` (deliberate bypass of marker-unset and hook-firing), `runHydrate` step 1 (timeout fall-through to `execShellAndExit`), `defaultExecShell` (`syscall.Exec` semantics that the wrapper depends on).
- `cmd/state_signal_hydrate.go` — `runSignalHydrate` (per-session enumeration; no global "signal everyone" path).
- `internal/restore/session.go` — `armPanes` (skeleton arm sequence; FIFO + respawn-pane + marker), `buildHydrateCommand` (wrapper construction with the harmful `; exec $SHELL` trailer).
- `cmd/bootstrap/stale_marker_cleanup.go` — `CleanStaleMarkers` only handles dead panes; does not address timeout-stuck markers on live panes.

**Potentially affected (downstream readers of stuck markers):**
- `cmd/state_daemon.go:131-133` — daemon's capture loop skips scrollback save for marked panes. While a marker is stuck, the affected pane's scrollback is silently not saved across the server lifetime.
- `internal/state/capture.go` — `mergeSkippedPanes`. With the companion fix in place this is defensively guarded; without the fix it was the path that turned stuck markers into resurrection.

**Not affected:**
- The single-saved-session user (no race ever happens; one session = one attach = one signal). All visible bugs vanish.
- Hot-path `portal open <existing-session>` after the cold-start bootstrap completes (Restore skips live sessions; no skeleton, no helpers, no race).

---

## Fix Direction

### Chosen Approach

A single coordinated fix across three code sites that addresses the upstream trigger and the two downstream defects:

1. **Move signal-hydrate triggering into bootstrap (eager).** Insert a new bootstrap step after step 5 Restore and before step 6 Clear `@portal-restoring`. The step iterates the freshly-set `@portal-skeleton-*` marker set and writes the signal byte to every pane's FIFO using the existing `writeFIFOSignal` + `signalHydrateRetryDelays` primitives from `cmd/state_signal_hydrate.go`. The pane-target enumeration source is the marker map itself (`paneKey → FIFOPath` is deterministic via `state.FIFOPath`), so no extra tmux round-trip is needed beyond `state.ListSkeletonMarkers`. After this step every helper receives its signal within milliseconds of being respawned; the 3 s timeout stops being the steady-state path for non-attached sessions; markers self-clear via the existing hydrate→unset path.

2. **Make `handleHydrateTimeout` a correct recovery path.** With (1) in place the timeout fires only on a real signal-flow bug; when it does, leave the system clean rather than perpetuating the failure. Two changes inside `cmd/state_hydrate.go`:
   - Unset `@portal-skeleton-<paneKey>` on the way out (mirror `handleHydrateFileMissing`). Remove the "marker stays set so the next attach re-signals" comment at line 262 — that promise was never deliverable because the FIFO is unlinked at line 256 before any subsequent attach could write to it.
   - Route the timeout fall-through at `runHydrate` line 109 through `execShellOrHookAndExit` instead of `execShellAndExit`. Timeout IS reboot recovery in the rare case it fires; consistent with the file-missing recovery path which already fires hooks.

3. **Drop the wrapper from `buildHydrateCommand`.** Replace `sh -c 'portal state hydrate ...; exec $SHELL'` with the bare `portal state hydrate --fifo X --file Y --hook-key Z`. The trailing `; exec $SHELL` is dead on the success path (the helper always `syscall.Exec`s its replacement) and harmful on user `exit` (re-spawns a fresh shell instead of closing the pane — the documented "pane-close-on-exit" semantic does not hold under the wrapper today). Eliminates the orphan `sh` parent observed in the addendum and restores correct exit semantics.

**Client-attached / client-session-changed hook registrations stay in place** as defensive idempotent fallbacks. They cover disjoint attach paths (outside-tmux `attach-session` fires only `client-attached`; inside-tmux `switch-client` fires only `client-session-changed`); removing either would regress one path. Their second-fire on already-hydrated panes is a no-op (marker already unset, signal-hydrate skips).

**Deciding factor:** the eager-signaling step resolves the root cause architecturally (race goes away by construction, not by reasoning-from-timeline). The timeout-path corrections and wrapper drop are cheap defensive changes at the same code sites; bundling them produces a coherent end-to-end fix for Symptoms B, C, and Defect D in one work unit. Symptom A is already neutralised on HEAD by the merged daemon-merge fix's live-set filter (`internal/state/capture.go:122-147`), so this work additionally hardens the upstream cause without depending on the resurrection symptom still reproducing.

### Options Explored

- **Bootstrap-driven eager signaling (chosen).** Race goes away at the source. Bootstrap pays a small bounded cost (one O_WRONLY|O_NONBLOCK write per skeleton marker; tmux already pays the same cost on `client-attached`).
- **Drop the timeout entirely; helpers wait forever for a signal.** Rejected — a genuine signal-flow bug (FIFO file disappears between mkfifo and helper open; signal-hydrate logic regression) leaves panes wedged in `O_RDONLY` forever with no safety net. Replacing a guaranteed bug with a possible-but-rare wedge is not an improvement.
- **Status quo signaling; only fix what happens after timeout.** Rejected — accepts the steady state being wrong. Symptom C (scrollback save silently skipped for stuck-marker panes) is structurally hard to fix from the timeout side because the marker has to outlive the timeout to mean anything. Eager signaling closes the gap at the marker-production layer instead.
- **Wrapper redesign — keep wrapper, use `exec` inside (`sh -c 'exec portal state hydrate ...'`).** Rejected — same correctness as dropping entirely, no upside, more complex. Drop is simpler.
- **Wrapper redesign — keep wrapper as a panic-resilience fallback.** Rejected — the fallback only protects against a panic in `portal state hydrate` before any `syscall.Exec`, which is a helper bug to fix at source rather than paper over with a respawn-pane-level fallback. If a real-world panic surfaces, add a `defer recover` in `runHydrate` that exec's `$SHELL` — keep panic-recovery inside the helper.
- **Remove one of the two hydration-trigger hook registrations.** Rejected — `client-attached` and `client-session-changed` cover disjoint attach paths.

### Discussion

The discussion sharpened around a single demand: name the fix, don't enumerate options. The first pass surfaced three axes (selective-signaling, timeout-path, wrapper) without committing to a single direction; the user pushed back, asking for actual research and a definite choice. Reviewing the merge code on `main` confirmed Symptom A is already structurally fixed by the daemon-merge live-set filter — collapsing the question of "does the fix need to address Symptom A?" from "depends on empirical re-test" to "no, this hardens the upstream cause anyway".

The fix shape is therefore: eager bootstrap signaling (architectural fix for the upstream trigger), defensive timeout-path corrections (Symptom B + correctness for the rare-recovery path), and wrapper drop (Defect D). The wrapper drop rides along on the same code site as the timeout-path work — both touch the helper's exec contract. The hook registrations and the duplicate-write observation were explicitly scoped out: both events are needed for disjoint attach paths, and the duplicate ENOENT warnings vanish on their own once eager signaling unsets markers before either event fires.

The bootstrap-step placement (between Restore and Clear `@portal-restoring`) was chosen so eager signaling runs while `@portal-restoring` is still set. The daemon is suppressed during this window, so helpers can dump scrollback and unset their markers without any chance of the daemon attempting a concurrent capture on a pane mid-replay. This matches the existing helper invariants (the 100 ms settle sleep + marker-unset sequence) without requiring a new contract.

### Testing Recommendations

**Eager-signaling step (cmd/bootstrap):**
- Unit: given a marker map of N entries, the step writes the signal byte to N FIFOs (mock the FIFO writer) and returns nil. Verify each write goes to the correct path derived from `state.FIFOPath(stateDir, paneKey)`.
- Unit: a per-FIFO write failure logs a soft warning and continues to the next pane (mirrors `runSignalHydrate`'s posture). The step never escalates to a fatal error.
- Bootstrap integration: orchestrator runs the new step at the correct position (after step 5 Restore, before step 6 Clear `@portal-restoring`). Sequence test asserts ordering by injecting a recording orchestrator deps fake.
- Bootstrap integration: when zero markers exist post-Restore (e.g. nothing to restore), the step is a no-op — no FIFO writes attempted.
- Multi-session cold-start integration (against the real tmux fixture): boot with N≥2 saved sessions, assert all `@portal-skeleton-*` markers are unset within reasonable time post-bootstrap (no client attach required to drive the unset).

**Timeout-path corrections (cmd/state_hydrate.go):**
- `handleHydrateTimeout` calls `state.UnsetSkeletonMarkerForFIFO(cfg.Client, cfg.FIFO)` before returning nil. Verify with the existing `unsetSkeletonMarkerOrLog` mock pattern.
- `runHydrate` timeout fall-through routes to `execShellOrHookAndExit` (existing test in `state_hydrate_test.go` covering the file-missing path is the template — replicate for timeout).
- Hook-firing on timeout end-to-end: registered on-resume hook, force a timeout (mock `OpenFIFO` to return `ErrHydrateTimeout`), assert exec target is `/bin/sh -c '<HOOK>; exec $SHELL'`.

**Wrapper drop (internal/restore/session.go):**
- `buildHydrateCommand` returns the bare `portal state hydrate ...` string (no `sh -c` envelope, no `; exec $SHELL` trailer). Update the existing snapshot/equality test in `session_test.go` to the new shape.
- Real-tmux respawn-pane integration: the helper's exit closes the pane (via the tmux fixture's `list-panes` after the helper exits — pane is gone, not respawned with a fresh shell).

**Regression coverage to preserve:**
- Existing happy-path skeleton + signal + dump + hook + shell integration tests in `built-in-session-resurrection`'s test surface — must remain green.
- Companion daemon-merge fix's tests (`internal/state/capture_test.go` filter tests, `cmd/bootstrap/stale_marker_cleanup_test.go`) — this work must not regress them.

### Risk Assessment

- **Fix complexity:** Low–Medium. New bootstrap step (~50 lines including adapter wiring + tests; mirrors the existing `CleanStaleMarkers` step pattern). Timeout-path corrections (~5 lines in `handleHydrateTimeout` + a one-line target swap in `runHydrate`). Wrapper drop (~5 lines in `buildHydrateCommand`). Production touchpoints: `cmd/bootstrap/`, `internal/bootstrapadapter/`, `cmd/state_hydrate.go`, `internal/restore/session.go`.
- **Regression risk:** Low. Eager signaling is additive — it does not change the per-session signaling semantics on `client-attached` / `client-session-changed`, only fires the same primitive earlier. Timeout-path corrections converge two recovery paths (timeout + file-missing) onto the same exec contract, removing a divergence rather than adding one. Wrapper drop is a respawn-pane invocation simplification; the helper's behaviour is unchanged.
- **Behavioural change for users:**
  - On-resume hooks fire end-to-end across multi-session cold-start (previously only fired for the attached session).
  - Scrollback save resumes for previously-stuck-marker panes (previously silently skipped indefinitely).
  - `exit` closes the pane on the first invocation (previously needed two exits because of the wrapper's trailing exec).
  - Reduced `WARN` log volume on subsequent attaches (no more repeating `write fifo … no such file or directory` for stuck markers).
- **Recommended approach:** Regular release. No hotfix needed — Symptom A is already neutralised on `main`; remaining symptoms are quality-of-feature regressions, not data-integrity issues. Manual workaround for affected users in current builds: `tmux set-option -us @portal-skeleton-<key>` on stuck markers (or restart the tmux server).

---

## Notes

- **Empirical reconfirmation needed against HEAD.** The companion-bug fix is on `main` but the inbox was written before that fix landed. Specifically: re-verify whether killing one of the affected sessions on a current-HEAD build still reproduces Symptom A (resurrect on next `portal open`), or whether the merge filter has already neutralised the user-visible symptom even with the marker still leaking.
- **Cold-start scope.** Restore skips live sessions, so the skeleton + hydrate machinery only runs on the first `portal` invocation after the tmux server cold-starts. The bug's cardinality is therefore "once per server lifetime, affecting all-saved-sessions-minus-one" rather than "once per `portal open`".
- **Wrapper redesign and timeout-path redesign are the same code site.** Both observable defects (no hooks on timeout, orphan sh after timeout) live in the construction at `internal/restore/session.go:419` together with the consumption at `cmd/state_hydrate.go:248-266` (timeout) and `cmd/state_hydrate.go:191-194` (`execShellAndExit` final terminator). Treating these as one work product is likely cheaper than treating them as two.
- **Open question for fix direction:** does the fix push hydration into bootstrap (eagerly signal every skeleton pane right after step 5, before the user attaches), redesign the timeout path (fire hooks on timeout; unset marker on timeout; possibly drop the wrapper), or both? The findings review will sketch options and trade-offs before scope-shaping.
