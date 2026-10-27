# Specification: Harden Daemon Integration Test

## Change Description

`cmd/state_daemon_integration_test.go` currently guards two daemon-responsiveness contracts in ways that can silently degrade. First, it mirrors the production kill-barrier timeout (5s) as a local `killBarrierTimeoutCeiling` constant; a future drop in the production value would silently desync the mirror, leaving the "exit within 5s" assertion checking a stale ceiling. Second, `TestDaemon_MidTickSIGHUP_ExitsWithinBoundedWindow` emits a `t.Logf` warning and proceeds when a fast host's aggregate per-tick wall time falls below the 2s heuristic, passing trivially without exercising the "tick spans the kill barrier" cancellation path. This change closes both gaps — making the production timeout a single source of truth that the test imports, and converting the no-op-pass warning into an explicit `t.Skip` — with zero change to production behaviour.

## Scope

- **`internal/tmux/portal_saver.go`** — Introduce an exported `KillBarrierTimeoutCeiling` constant (value `5 * time.Second`) and reference it from the `SaverBarrierSeams.Timeout` default (currently the bare literal `5 * time.Second` at ~line 240), so production becomes the single source of truth.
- **`cmd/state_daemon_integration_test.go`** —
  - Remove the local `killBarrierTimeoutCeiling` const (~line 89) and replace all usages with `tmux.KillBarrierTimeoutCeiling`; update the now-stale mirror-justification comment.
  - Replace the `t.Logf("WARNING: …")` block (~lines 252-257) with `t.Skip(...)` when aggregate per-tick wall time is below the 2s heuristic.

## Exclusions

- No change to the production kill-barrier timeout **value** (stays 5s). This work unit only hardens the test; the separate question of whether 5s is empirically adequate (raised in the `saver-kill-respawn-loop-leaks-daemons` investigation) is out of scope.
- No change to the measurement-anchored threshold derivation, the retry/halving loop, or any other assertion logic.

## Verification

- `go build ./...` succeeds.
- `go test ./internal/tmux/...` passes (production constant introduction is behaviour-preserving).
- `go test ./cmd -run TestDaemon` (and the integration build tag, where applicable) compiles and passes; on a fast host the mid-tick SIGHUP test now reports `--- SKIP` rather than passing with a warning.
- No `killBarrierTimeoutCeiling` local constant remains in `cmd/state_daemon_integration_test.go`; the test references `tmux.KillBarrierTimeoutCeiling`.
- No `t.Logf("WARNING…` no-op-pass branch remains in `TestDaemon_MidTickSIGHUP_ExitsWithinBoundedWindow`.
