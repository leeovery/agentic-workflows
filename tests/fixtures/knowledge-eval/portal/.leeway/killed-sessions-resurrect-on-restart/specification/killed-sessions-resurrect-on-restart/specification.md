# Specification: Killed Sessions Resurrect on Restart

## Specification

## Problem Statement

Portal's bootstrap-step-5 skeleton-restore runs a per-pane hydrate helper that waits up to 3s on a per-pane FIFO for a "go" signal from tmux's `client-attached` / `client-session-changed` hooks. When the signal fails to arrive, the helper times out into a recovery path that leaks state and silently degrades user-visible features.

This bug fixes the upstream signaling contract and corrects two compounding defects in the timeout-recovery path.

### Observed Symptoms

- **Symptom A — killed sessions resurrect on next `portal open`** (driven by stuck `@portal-skeleton-<paneKey>` markers feeding the daemon-merge re-injection path).
- **Symptom B — on-resume hooks never fire** for panes that hit the timeout path; the pane gets a bare interactive shell.
- **Symptom C — scrollback save silently skipped** for any pane whose marker is stuck (the daemon's capture loop skips marked panes indefinitely). The existing post-restore `CleanStaleMarkers` step does **not** close this gap — its predicate is "marker without a live pane", but timeout-stuck markers sit on live panes (the helper has exec'd a shell, so the pane is alive even though hydration failed). Eager signaling closes the gap at the marker-production layer rather than the cleanup layer. The symptom is genuinely invisible at the time of failure — no error, no warning, no diagnostic — and only manifests on the *next* cold-start as empty scrollback, with no log trail back to the original marker leak. Manual Verification of Symptom C therefore requires a two-boot protocol (boot 1: trigger the leak; boot 2: observe the missing scrollback).
- **Defect D — orphan `sh -c` wrapper** parked on every restored pane regardless of hydration outcome (success, file-missing, timeout): the wrapper's trailing `; exec $SHELL` is unreachable on success, breaks pane-close-on-`exit`, and leaves a parked `sh` parent under tmux for the lifetime of the pane. Both `execShellAndExit` and `execShellOrHookAndExit` `syscall.Exec` the user's shell from inside the wrapper, so the parked parent appears on every restored pane — not only after timeout.

### Root Cause

`signal-hydrate` is fired by tmux's `client-attached` / `client-session-changed` per-session hooks, scoped via `#{session_name}` to the session the user is attaching to or switching to. Bootstrap step 5 creates skeletons for **every** non-live saved session; `signal-hydrate` writes only to the FIFOs of the attached session. On a cold-start with N saved sessions, only the attached session's panes get signaled. The remaining N−1 sessions' helpers wait 3s, never receive the signal, and time out — by design of the per-session signaling contract.

This is not a race with the helper's `O_RDONLY` open. It is a missing trigger: no signal will ever arrive for non-attached sessions during this server lifetime under the current contract.

The `handleHydrateTimeout` handler then compounds the missing-signal condition into the user-visible symptoms via two deliberate-but-now-incorrect choices: (1) leaves `@portal-skeleton-<paneKey>` set ("marker stays set so the next attach re-signals" — a promise that cannot be kept because the FIFO is unlinked at the same site, leaving no reader for any subsequent signal), and (2) routes the fall-through through `execShellAndExit` (bare shell), bypassing the hook-firing exec path used by every other recovery branch.

### Scope Boundary

The bug surfaces only on **cold-start** bootstrap (first `portal` invocation after the tmux server starts), because `internal/restore/restore.go` skips already-live sessions on subsequent invocations. The cardinality is "once per tmux-server lifetime, affecting all-saved-sessions-minus-one" — not "once per `portal open`".

Single-saved-session users are unaffected (one session = one attach = one signal; no panes left unsignaled). Hot-path `portal open <existing-session>` after the cold-start bootstrap completes is also unaffected — Restore skips live sessions, so no skeleton is built and no helpers run.

Symptom A's user-visible behaviour was structurally fixed on `main` by the companion daemon-merge live-set filter (`.workflows/completed/daemon-merge-reintroduces-dead-sessions/`). Markers still leak under the bug pre-fix, but the merge no longer turns the leak into a resurrection. This work additionally hardens the upstream cause so the marker stops leaking in the first place.

## Fix Scope

A single coordinated fix across three code sites that addresses the upstream trigger and the two downstream defects:

1. **Bootstrap eager-signaling step** — new step that writes the hydrate signal to every freshly-armed skeleton pane immediately after restore, removing the per-session signaling gap.
2. **Timeout-path corrections** in `cmd/state_hydrate.go` — turn the timeout fall-through from a leaky bypass into a correct recovery path (unset marker, fire hooks).
3. **Wrapper drop** in `internal/restore/session.go` — replace `sh -c '<helper>; exec $SHELL'` with the bare helper invocation.

The three changes are bundled because (a) the eager-signaling step resolves the root cause architecturally, and (b) the timeout-path corrections and wrapper drop are cheap defensive changes at the same code sites the eager-signaling step interacts with — splitting them would leave the recovery path incoherent against the new steady state.

### What stays in place

- **Both `client-attached` and `client-session-changed` registrations remain** as defensive idempotent fallbacks. They cover disjoint attach paths: outside-tmux `attach-session` fires only `client-attached`; inside-tmux `switch-client` fires only `client-session-changed`. Removing either would regress one path. Their second-fire on already-hydrated panes is a no-op (marker already unset, `signal-hydrate` skips).
- **The 3-second helper timeout is preserved** as a safety net for genuine signal-flow bugs (FIFO disappears between `mkfifo` and helper open; `signal-hydrate` regression). Eager signaling makes the timeout path rare-but-correct rather than common-and-broken.

### What is explicitly out of scope

- **Removing either hydration-trigger hook registration.** Both cover disjoint attach paths.
- **Panic-resilience wrapping for `portal state hydrate`.** If a real-world panic in the helper surfaces, address with a `defer recover` inside `runHydrate`, not with a respawn-pane-level fallback.
- **The transient `daemon | capture pane … exit status 1` warnings** noted in the investigation — sporadic, same panes capture cleanly on later ticks. Tracked separately if it persists.
- **Any change to the daemon's merge logic** — the companion fix on `main` already neutralises Symptom A's user-visible resurrection.
- **Wrapper redesign that keeps the outer `sh -c` envelope** (e.g. `sh -c 'exec portal state hydrate ...'`) — same correctness as dropping the wrapper, no upside, more complex.
- **Status-quo per-session signaling with timeout-path-only corrections** — Symptom C cannot be fixed from the timeout side because the marker has to outlive the timeout to suppress scrollback save; the production-layer fix (eager signaling) is required to close that gap.

## Fix 1: Bootstrap Eager-Signaling Step

### Behaviour

A new bootstrap orchestrator step is inserted **after step 5 (Restore) and before step 6 (Clear `@portal-restoring`)**. The step iterates the freshly-set `@portal-skeleton-*` marker map and writes the single-byte hydrate signal to every pane's per-pane FIFO. After the step completes, every helper armed during restore has received its signal — usually within milliseconds of being respawned — and proceeds through the success path: marker unset, scrollback replayed, hooks fired (if registered), then `exec $SHELL`.

### Placement and Ordering Invariant

The step **must** run while `@portal-restoring` is still set. The daemon's `captureAndCommit` loop is suppressed during the `@portal-restoring` window, so helpers can dump scrollback and unset their markers without any chance of a concurrent capture on a pane mid-replay. This matches the existing helper invariants (the 100 ms settle sleep + marker-unset sequence) without introducing a new contract.

The placement also runs the step **after** restore has populated the skeleton-marker set, so the iteration source — `state.ListSkeletonMarkers` (via the existing `@portal-skeleton-*` server-option enumeration) — has the complete set of freshly-armed panes.

### Pane Enumeration and FIFO Resolution

The step does not require an additional tmux round-trip beyond `state.ListSkeletonMarkers`. The pane-target list is the marker map itself; the corresponding FIFO path is deterministic via `state.FIFOPath(stateDir, paneKey)`. No `list-panes` enumeration is needed at this layer.

`stateDir` is plumbed through the orchestrator construction — same source as Restore and EnsureSaver. The orchestrator resolves `state.Paths().StateDir` once at startup and passes it into each step that needs it.

### Write Primitive

The step uses the existing `writeFIFOSignal` helper and `signalHydrateRetryDelays` retry schedule from `cmd/state_signal_hydrate.go`, mirroring the per-session signaling posture so failure semantics remain identical between the eager step and the existing `client-attached` / `client-session-changed` paths.

**Sharing mechanism**: Both `writeFIFOSignal` and `signalHydrateRetryDelays` are currently package-private inside `cmd`. The fix moves them into a shared internal package (`internal/state`, alongside the existing FIFO/marker helpers). `cmd/state_signal_hydrate.go` and the new `cmd/bootstrap` step both call into the shared package. No public API is exposed.

### Race-Free Ordering vs. Client-Attached

The eager step always runs **before** any `client-attached` event for the bootstrap-time skeleton. The bootstrap orchestrator runs in `PersistentPreRunE` and returns before any tmux attach occurs:

- **Bare-CLI path** (`portal open`): bootstrap returns, then `syscall.Exec`s `tmux attach-session`. The `client-attached` event fires only after bootstrap completion.
- **Inside-tmux path**: bootstrap returns, then `tmux switch-client` is invoked. Same ordering.

There is therefore no race where the eager step writes to a FIFO whose helper has already self-hydrated via `client-attached`. The "second-fire is a no-op" property describes the **subsequent** client-attached firing, not concurrent firing.

### Failure Posture

- **Per-FIFO write failures are soft warnings.** Log shape: `WARN | hydrate | eager-signal: write fifo <fifoPath>: <error>`. paneKey is derivable from the FIFO basename (`hydrate-<paneKey>.fifo`); no separate paneKey field is added. The step continues to the next pane on failure. A failed write does not abort the step.
- **The step itself never escalates to a fatal bootstrap error.** Mirrors steps 7 (CleanStaleMarkers), 8 (SweepOrphanFIFOs), and 9 (CleanStale) — best-effort cleanup classed alongside other non-fatal post-restore steps.
- **Zero markers post-Restore is a no-op.** No FIFO writes attempted; step returns nil.

### Relationship to Existing Hook-Driven Signaling

The `client-attached` and `client-session-changed` registrations remain in place. After the eager step has run, the user's subsequent attach (which is what causes the bare-CLI handoff or `tmux switch-client`) fires its hook against panes whose markers have already been unset by the helpers' success path; `signal-hydrate` enumerates the now-empty marker set for that session and exits cleanly. This is the desired "second-fire is a no-op" behaviour.

This also incidentally resolves the duplicate-timestamp ENOENT warnings observed in the investigation — both `client-attached` and `client-session-changed` can fire near-simultaneously on attach, and under the pre-fix flow each invocation logged ENOENT against the now-unlinked FIFO. With markers cleared by the eager step before either event fires, both invocations enumerate empty marker sets and exit silently.

### Bootstrap Step Numbering Update

After this insertion the orchestrator's step list becomes:

1. EnsureServer
2. RegisterPortalHooks
3. Set `@portal-restoring`
4. EnsureSaver
5. Restore
6. **EagerSignalHydrate** *(new)*
7. Clear `@portal-restoring`
8. CleanStaleMarkers
9. SweepOrphanFIFOs
10. CleanStale

`EagerSignalHydrate` is the canonical identifier across the orchestrator method, the step's logged label, the seam interface name (suffix), and test assertions.

The `CLAUDE.md` "Server bootstrap" section is updated **as part of the same PR**. The update only renumbers steps and inserts a one-paragraph EagerSignalHydrate description; the existing "Return is the post-step boundary, not a numbered step" framing is preserved.

### Adapter Wiring

The new step's seam interface lives alongside the existing post-restore-step seams in `cmd/bootstrap/`. Suggested shape:

```go
type EagerHydrateSignaler interface {
    ListSkeletonMarkers() (map[string]string, error) // paneKey → liveTarget
    WriteFIFOSignal(path string) error
}
```

The production adapter in `internal/bootstrapadapter` wires `state.ListSkeletonMarkers` (with the orchestrator's `*tmux.Client`) for the marker enumeration and the shared `internal/state` package's `WriteFIFOSignal` for the writer. The orchestrator owns `stateDir` and resolves `state.FIFOPath(stateDir, paneKey)` per marker before calling `WriteFIFOSignal`.

No new public API surface is exposed. Test fakes implement the same interface to assert per-FIFO write counts, error propagation, and zero-marker no-op behaviour.

## Fix 2: Timeout-Path Corrections in `handleHydrateTimeout`

### Behaviour

`handleHydrateTimeout` (`cmd/state_hydrate.go`) is rewritten from a "leave-the-mess-and-degrade-to-bare-shell" bypass into a correct recovery path. After the change, a hydrate timeout produces a clean state: marker unset, FIFO removed, on-resume hook fired (if registered), shell exec'd.

### Specific Changes

1. **Unset `@portal-skeleton-<paneKey>` on timeout.** The handler calls `unsetSkeletonMarkerOrLog` — the cmd-layer wrapper that internally invokes the `state.UnsetSkeletonMarkerForFIFO` primitive and logs a soft warning on failure. This is the canonical primitive used by `handleHydrateFileMissing`; tests reuse the same mock pattern by overriding the `state.UnsetSkeletonMarkerForFIFO` seam. Failure to unset is logged as a soft warning; does not block the shell exec.

2. **Route timeout fall-through through `execShellOrHookAndExit`** (the hook-firing exec) instead of `execShellAndExit` (bare shell). The timeout and file-missing recovery paths now share the same exec contract: both unset the marker, both fire hooks if registered, both exec `$SHELL` if not. The current divergence between them is eliminated.

   **No new `--hook-key` plumbing is required.** `runHydrate` already holds the hook key in scope as `cfg.HookKey`; both `handleHydrateTimeout` and `handleHydrateFileMissing` recovery paths can call `execShellOrHookAndExit(cfg.HookKey)` symmetrically. The hook lookup happens inside `execShellOrHookAndExit` against `hooks.json`; no parameter shape changes.

3. **Remove the "marker stays set so the next attach re-signals" comment** at line 262. That comment encoded a non-deliverable invariant: the FIFO is unlinked at line 256 of the same handler before any subsequent attach could write to it, so "next attach re-signals" was a no-op that just re-fired ENOENT. The comment is replaced with a one-line note explaining the recovery contract.

4. **The 100 ms settle-sleep is preserved** before exec — same posture as the success path, gives tmux time to settle the post-restore state before respawn-pane chains take over.

### Spec Supersession (Original Resurrection Spec)

This change deliberately supersedes two invariants from `.workflows/built-in-session-resurrection/specification/built-in-session-resurrection/specification.md`:

- **Original line 838: "Helper does NOT unset marker on FIFO timeout — next attach re-signals, retry happens naturally."** Superseded because the implementation cannot deliver the "next attach re-signals" semantic — the FIFO is unlinked before any next attach. Leaving the marker set with no possibility of retry just feeds Symptom C (stuck markers suppress scrollback save indefinitely).

- **Original line 873: "Resume hooks fire only from inside the hydrate helper's exec chain, at the end of successful hydration."** Refined: hooks fire from inside the helper's exec chain on **any non-fatal terminal path** — successful hydration, file-missing recovery, and timeout recovery. The original phrasing reflected an assumption that timeout was an exceptional condition; in practice it was the steady state, which made the "hooks unsafe on timeout" rationale incoherent. With Fix 1 in place, timeout is genuinely rare, and when it fires, the recovery path should match file-missing's already-tested behaviour.

The original session-resurrection spec is not modified in place; the supersession is recorded here as the canonical updated semantic for the timeout path.

### Hook-Firing Safety on Timeout

Resume hooks are command-launchers (e.g. `claude --resume`). They do not depend on scrollback replay having succeeded — scrollback is for the visible terminal buffer, hook execution is for re-launching processes. Firing the hook on the timeout path is therefore independent of the scrollback-replay outcome. The hook may produce a slightly degraded user experience (terminal blank instead of restored scrollback) but the user's resume command runs, which is the feature contract.

### Logging

The existing `WARN | hydrate | timeout waiting for signal on …` log line is preserved — under the new design, it is now a genuine signal that something is wrong (FIFO disappeared, signal-hydrate regression, eager-signal step's writer failed) rather than ambient noise on every cold-start. Log volume drops dramatically as a side effect of Fix 1.

## Fix 3: Wrapper Drop in `buildHydrateCommand`

### Behaviour

`buildHydrateCommand` (`internal/restore/session.go`) is changed from constructing the wrapped form:

```
sh -c 'portal state hydrate --fifo X --file Y --hook-key Z; exec $SHELL'
```

…to the bare form:

```
portal state hydrate --fifo X --file Y --hook-key Z
```

The `respawn-pane -k` invocation passes the bare command string directly. Argument quoting/escaping responsibilities shift from the wrapper-shell to the call-site formatter — this is the same shape the existing tmux command-construction helpers in `internal/tmux` already produce for non-shell pane commands.

### Why the Outer Wrapper Is Removable

The wrapper exists for two stated reasons; both fail to materialise in practice.

1. **Trailing `; exec $SHELL` as crash-resilience.** The trailer would only execute if the inner `portal state hydrate` exited *without* exec'ing a replacement. Both helper exit paths — `execShellAndExit` (`syscall.Exec($SHELL, …)` at `cmd/state_hydrate.go:322-325`) and `execShellOrHookAndExit` (`syscall.Exec` of either bare `$SHELL` or `sh -c 'HOOK; exec $SHELL'`) — always exec their replacement. The helper does not have a reachable code path that returns control to the outer wrapper. The trailer is therefore unreachable on every observed exit.

2. **Comment-stated "exiting the shell ends the pane".** Empirically broken under the wrapper: when the user types `exit`, the inner shell exits and control returns to the wrapper sh, which then runs `; exec $SHELL` and replaces itself with a *fresh* shell. The user must type `exit` twice. Dropping the wrapper restores correct exit-on-`exit` semantics.

### Inner Hook-Firing Wrapper Is Untouched

This change drops the **outer** wrapper at the `respawn-pane` site. The **inner** `sh -c '<HOOK>; exec $SHELL'` constructed inside `execShellOrHookAndExit` (when an on-resume hook is registered) is unchanged. The two wrappers are independent — the outer wraps the helper invocation; the inner wraps the user's hook command. Hook-firing semantics are preserved exactly.

### Side Effects

- **Orphan `sh` parent eliminated.** Every restored pane currently leaves a parked `sh` parent under tmux for the lifetime of the pane (observed at ~20 hours uptime in the investigation addendum). After this change, `portal state hydrate` is the pane's initial process and `syscall.Exec`s its replacement directly under tmux — no parked parent.
- **Pane closes on first `exit`.** Matches the documented `buildHydrateCommand` intent and aligns with non-restored panes, which already close on first `exit`.

### Argument Quoting

`buildHydrateCommand` returns a single shell-safe command string (no `[]string` argv split). `RespawnPane`'s interface signature is unchanged — it continues to accept a single command-string argument. The change is purely the omission of the `sh -c '…; exec $SHELL'` envelope around the helper invocation.

The bare form is `portal state hydrate --fifo <fifo> --file <file> --hook-key <hookKey>`, where each value-arg is shell-escaped using the existing internal/tmux quoting helper used for non-shell pane commands. The helper invocation itself is `portal` (PATH-resolved); not absolute. The unit test snapshot asserts the exact resulting string format produced by the helper on representative inputs.

### Defect-D Closure

This change closes Defect D from the problem statement (orphan `sh -c` wrappers post-timeout). It is bundled with Fixes 1 and 2 because it lives at the same code site (`buildHydrateCommand`) that is touched by the helper's exec contract — the wrapper shape and the timeout-path's exec target are coupled, and treating them in one work product is cheaper than splitting.

## Acceptance Criteria

The fix is complete when all of the following hold:

### Behavioural

- **AC1**: After a tmux server cold-start with N≥2 saved sessions, all `@portal-skeleton-<paneKey>` markers are unset within **2 seconds** post-bootstrap (no client attach required to drive the unset). The integration test polls `state.ListSkeletonMarkers` with a 2-second timeout; pass condition is empty marker set within the window. The 2-second bound is generous: the helper writes its scrollback dump and unsets the marker after a 100 ms settle sleep, so 2s gives ~10× slack for tmux command latency at any plausible N.
- **AC2**: On-resume hooks registered via `portal hooks set --on-resume "<cmd>"` fire end-to-end on cold-start for **every** restored pane that has a hook registered, regardless of which session the user attached to. The attached-session case is already covered by existing happy-path resurrection integration tests (preserved under "Regression Coverage to Preserve"); the new multi-session integration test specifically covers the previously-broken non-attached case.
- **AC3**: A pane killed via `portal` TUI `K` (or `tmux kill-session` from inside) does not reappear on the next `portal open`. (Already neutralised on `main` by the daemon-merge live-set filter; verified post-fix as a regression guard rather than a new behaviour.)
- **AC4**: Scrollback save resumes for previously-stuck-marker panes — daemon `captureAndCommit` no longer indefinitely skips any live pane.
- **AC5**: `exit` typed in a restored pane closes the pane on the first invocation. No orphan `sh` parent process under tmux for any restored pane.

### Logging

- **AC6**: `WARN | hydrate | write fifo … no such file or directory` and `WARN | hydrate | timeout waiting for signal on …` log volume on every cold-start drops to zero in the steady state. These warnings appear only when a genuine signal-flow bug occurs. The pre-fix volume on every bootstrap was high enough to drown out future genuine warnings, so the post-fix steady-state cleanliness restores signal-to-noise for diagnostic value rather than being purely cosmetic. **Verification is via the Manual Verification Protocol step 2** — observational, not a gated automated test. Inspect `~/.config/portal/state/portal.log` after a clean cold-start with N≥2 saved sessions; the two warning lines must be absent.

### Spec Conformance (Original Resurrection Spec)

- **AC7**: All happy-path resurrection invariants stated in `.workflows/built-in-session-resurrection/specification/built-in-session-resurrection/specification.md` continue to hold for the success path: scrollback dumped, marker unset by helper, on-resume hook fires once at end of successful hydration, `exec $SHELL`.
- **AC8**: Daemon suppression during the `@portal-restoring` window remains intact — the new eager-signaling step does not introduce any race between the daemon's capture loop and helper-driven scrollback replay.

### AC ↔ Fix Traceability

| AC | Satisfied by |
|----|--------------|
| AC1 | Fix 1 (eager signaling unsets markers without waiting for client attach) |
| AC2 | Fix 1 (eager signaling drives hydration for non-attached sessions) + Fix 2 (timeout fall-through fires hooks if registered) |
| AC3 | Companion daemon-merge fix on `main` (regression guard); Fix 1 hardens upstream by preventing marker leak |
| AC4 | Fix 1 (eager signaling unsets markers, daemon resumes capturing those panes) |
| AC5 | Fix 3 (wrapper drop — pane closes on first `exit`; no parked `sh` parent) |
| AC6 | Fix 1 (markers cleared before client-attached fires; eliminates ENOENT writes) + Fix 2 (timeout no longer the steady-state path) |
| AC7 | Invariant: existing happy-path tests preserved under "Regression Coverage to Preserve" |
| AC8 | Invariant: eager step runs inside `@portal-restoring` window (Fix 1 → Placement and Ordering Invariant) |

### Definition of Done

The work unit is complete when **all** of the following hold:

1. All unit and integration tests in the Test Plan pass in CI.
2. Existing tests under "Regression Coverage to Preserve" remain green.
3. The Manual Verification Protocol has been executed once on a real machine; pre-fix and post-fix observations recorded in the PR description (or linked).
4. `CLAUDE.md` "Server bootstrap" section is updated with the new step list.
5. PR is reviewed and merged to `main`.

## Test Plan

### Unit

- **`cmd/bootstrap` (new step)**:
  - Given a marker map of N entries, the step writes the signal byte to N FIFOs (mock the FIFO writer) and returns nil. Verify each write goes to the correct path derived from `state.FIFOPath(stateDir, paneKey)`.
  - A per-FIFO write failure logs a soft warning and continues to the next pane. The step never escalates to a fatal error.
  - Zero-marker case is a no-op — no FIFO writes attempted.

- **`cmd/state_hydrate.go` (timeout-path corrections)**:
  - `handleHydrateTimeout` calls the marker-unset primitive (`state.UnsetSkeletonMarkerForFIFO` / equivalent) before returning. Use the existing `unsetSkeletonMarkerOrLog` mock pattern.
  - `runHydrate` timeout fall-through routes to `execShellOrHookAndExit` (template: existing `state_hydrate_test.go` file-missing-path test — replicate for timeout).
  - Hook-firing on timeout end-to-end: registered on-resume hook, force `OpenFIFO` to return `ErrHydrateTimeout`, assert exec target is `sh -c '<HOOK>; exec $SHELL'`.

- **`internal/restore/session.go` (wrapper drop)**:
  - `buildHydrateCommand` returns the bare `portal state hydrate ...` string (no `sh -c` envelope, no `; exec $SHELL` trailer). Update the existing snapshot/equality test in `session_test.go` to the new shape.

### Integration (real tmux fixture)

- **Bootstrap orchestrator ordering**: New step runs at the correct position (after step 5 Restore, before step 6 Clear `@portal-restoring`). Sequence test asserts ordering by injecting a recording orchestrator deps fake.
- **Multi-session cold-start**: Boot with N≥2 saved sessions. Poll `state.ListSkeletonMarkers` with a 2-second timeout; pass condition is empty marker set within the window. This test closes a specific gap in existing coverage — prior integration tests for the resurrection feature verified the signal-arrived flow only for the attached session, never modelling the N≥2 case where the bug's deterministic behaviour surfaces.
- **End-to-end hook firing on cold-start**: Register an on-resume hook for a non-attached saved session. Cold-start. Assert the hook ran in the restored pane.
- **Pane close on `exit`**: Restored pane runs `exit` once; tmux `list-panes` shows the pane is gone (not respawned with a fresh shell).

### Regression Coverage to Preserve

- All existing happy-path skeleton + signal + dump + hook + shell integration tests in the `built-in-session-resurrection` test surface remain green.
- Companion daemon-merge fix's tests (`internal/state/capture_test.go` filter tests, `cmd/bootstrap/stale_marker_cleanup_test.go`) remain green.

## Risks & Rollout

### Regression Risk

Low.

- **Eager signaling is additive.** It does not change the per-session signaling semantics on `client-attached` / `client-session-changed`; it fires the same primitive earlier. Existing hook-driven signaling stays in place as a fallback.
- **Timeout-path corrections converge two recovery paths** (timeout + file-missing) onto the same exec contract, removing a divergence rather than adding one. The file-missing path is already exercised by existing tests; timeout follows the same shape.
- **Wrapper drop is a respawn-pane invocation simplification.** The helper's behaviour is unchanged; only the outer process tree shape changes (no parked `sh` parent).

### Behavioural Changes for Users

- **On-resume hooks fire end-to-end across multi-session cold-start** (previously only fired for the attached session).
- **Scrollback save resumes** for previously-stuck-marker panes (previously silently skipped indefinitely; users would notice empty scrollback on the *next* cold-start).
- **`exit` closes the pane on the first invocation** (previously needed two `exit`s because of the wrapper's trailing `; exec $SHELL`).
- **Reduced `WARN` log volume on every bootstrap** — `write fifo … no such file or directory` and `timeout waiting for signal on …` no longer appear in the steady state.

### Non-User-Visible Changes

- Bootstrap step list grows by one; the orchestrator's step ordering is updated in `CLAUDE.md`.
- `internal/bootstrapadapter` gains a thin wiring layer for the new step's seam interface.
- The `built-in-session-resurrection` spec's timeout-path semantics are explicitly superseded by Section "Fix 2 → Spec Supersession" of this specification.

### Rollout

- **Regular release.** No hotfix required:
  - Symptom A is already neutralised on `main` by the companion daemon-merge fix; this work hardens the upstream cause but does not address an active data-integrity bug.
  - Symptoms B, C and Defect D are quality-of-feature regressions, not data-integrity issues.
- **No feature flag.** The fix changes default behaviour for all users; flagging would add complexity without proportional value (the new behaviour is strictly better for every user).
- **No migration step required.** Stuck markers from before the fix are cleaned up by the existing post-restore `CleanStaleMarkers` step on the next cold-start once their panes die naturally; eager signaling additionally clears them on every subsequent cold-start. Users with currently-stuck markers can manually clear them via `tmux set-option -us @portal-skeleton-<key>` or by restarting the tmux server, but this is not required.

### Manual Workaround for Affected Users on Pre-Fix Builds

Users encountering Symptoms B/C in a current `portal` build can clear stuck markers with `tmux show-options -s | grep '@portal-skeleton-'` to identify them, then `tmux set-option -us @portal-skeleton-<paneKey>` per stuck marker. Or restart the tmux server (kills all sessions; bootstrap rebuilds from saved state with no markers carried forward). Documented here for completeness; not required after the fix.

### Empirical Reconfirmation Before Implementation Starts

The investigation flagged that Symptom A's user-visible behaviour (kill → reappear on next `portal open`) should be empirically re-checked against current `main` before implementation begins. The expectation is that the daemon-merge fix already neutralises it, but reconfirming closes the loop. This is a one-time check, not an ongoing acceptance criterion.

**Owner**: planning agent runs the check before scoping tasks. **Result recording**: outcome is logged in the plan's pre-flight notes (or PR description for a one-PR plan).

**Branch behaviour**:
- If reconfirmation shows Symptom A still reproduces on `main`, plan scope adds an explicit Symptom A regression test (kill → reopen → assert absent) and AC3 graduates from "regression guard" to "verified fix".
- If reconfirmation shows Symptom A is already neutralised, AC3 remains a regression guard and no additional task is added.

Either way, Fix 1 / Fix 2 / Fix 3 still ship — reconfirmation only affects whether a Symptom-A-specific test is added, not whether the upstream-trigger fix proceeds.

### Manual Verification Protocol

A canonical 6-step reproduction protocol for verifying state on a real machine. Pre-fix: each step reproduces the documented symptom. Post-fix: every step's failure mode is absent.

1. **Boot Portal** so that bootstrap step 5 reconstructs the saved sessions (cold-start scenario; tmux server not previously running, or kill the server first).
2. **Inspect `~/.config/portal/state/portal.log`** for `WARN | hydrate | write fifo …` and `WARN | hydrate | timeout waiting for signal on …` entries against specific paneKeys. *Pre-fix: present for non-attached sessions. Post-fix: absent in steady state.*
3. **Inspect server options:** `tmux show-options -s | grep '@portal-skeleton-'`. *Pre-fix: stuck markers for affected paneKeys. Post-fix: empty (or only freshly-armed markers in the brief window before eager signaling unsets them).*
4. **Kill an affected session** via Portal TUI `K` or `tmux kill-session` from inside it. Confirm the session disappears from the Portal list.
5. **Run `portal open` again.** *Pre-fix (with companion-fix not yet on main): the killed session reappears. Post-fix: stays gone.*
6. **Inspect any registered on-resume hook** for an affected pane. *Pre-fix: hook has not run; pane is a bare interactive shell. Post-fix: hook has run before the user's shell.*

Additional post-fix checks (Defect D / wrapper drop):
- `pgrep -fa "sh -c.*portal state hydrate"` returns no rows for any restored pane (no parked wrapper parents).
- `exit` typed once in a restored pane closes the pane (no second `exit` required).

---

## Working Notes
