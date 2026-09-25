# Specification: AC4 Test Hardening

## Change Description

Two test-quality improvements for `TestPhase1Integration_DaemonResumesCaptureAfterEagerSignal_AC4` (`cmd/bootstrap/eager_signal_hydrate_integration_test.go`): (1) add a drift-mirror breadcrumb comment in production `captureAndCommit` (`cmd/state_daemon.go`) pointing at the integration-only `runDaemonTick` helper that shadows its body byte-for-byte; (2) add an inline negative-control sub-test that wires `bootstrap.NoOpEagerHydrateSignaler{}` and asserts beta's scrollback file is absent, replacing a docstring-level invariant with an active assertion.

Both atoms have small surfaces, no open design choices, and no production behaviour changes. The originating context is the `killed-sessions-resurrect-on-restart` review (promoted from idea `2026-05-11--ac4-test-hardening` on 2026-05-26 with design picks baked in).

## Scope

- **Atom 1 — drift-mirror comment** — `cmd/state_daemon.go` `captureAndCommit` function (line ~308). Add a comment block pointing at `cmd/bootstrap/daemon_tick_test_helpers_test.go` `runDaemonTick` as a drift-mirror site.
- **Atom 2 — negative-control sub-test** — `cmd/bootstrap/eager_signal_hydrate_integration_test.go`. Add a new test (sub-test or sibling top-level test) that mirrors the existing AC4 shape but wires `bootstrap.NoOpEagerHydrateSignaler{}` in the orchestrator options and asserts beta's scrollback file is absent. Pattern after the existing `TestScrollbackResumption_WithoutCleanupScrollbackNotSaved` (`cmd/bootstrap/scrollback_resumption_test.go:187`).

## Exclusions

- No changes to production logic in `captureAndCommit` or anywhere in `cmd/state_daemon.go` beyond the comment line.
- No extraction of a shared `state.RunCaptureOnce` helper (explicitly rejected as premature — should happen only if drift actually becomes observable).
- No new exports, no new test helpers — both atoms reuse existing scaffolding (`runDaemonTick`, `buildIntegrationOrchestrator`, `bootstrap.NoOpEagerHydrateSignaler`, `restoretest`/`tmuxtest` fixtures).
- No expansion to other AC tests — scope is AC4 only.

## Verification

- `go build -o portal .` succeeds.
- `go vet ./...` clean.
- `go test ./...` passes (short mode for the unit suite).
- Integration suite: `go test -tags integration ./cmd/bootstrap/... -run 'TestPhase1Integration_DaemonResumesCaptureAfterEagerSignal_AC4'` passes both the existing positive case and the new negative-control case.
- Manual inspection: the new negative-control case fails loudly if `bootstrap.EagerSignalCore` is reinstated (mutate-and-revert sanity check, optional).
- The drift-mirror comment in `cmd/state_daemon.go` is plainly visible above or within the `captureAndCommit` body and explicitly names `cmd/bootstrap/daemon_tick_test_helpers_test.go` `runDaemonTick`.
