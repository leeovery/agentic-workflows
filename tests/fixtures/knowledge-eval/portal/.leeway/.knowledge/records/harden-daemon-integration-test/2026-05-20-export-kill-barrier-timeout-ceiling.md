# Export killBarrierTimeoutCeiling from internal/tmux

`cmd/state_daemon_integration_test.go` mirrors the production `killBarrierTimeout` (5s) as a local constant (`killBarrierTimeoutCeiling`) for its "exit within 5s" regression assertion. The mirror is currently justified on grep-readability grounds with a comment, but a future drop in the production value would silently desync the test — the assertion would keep passing against the stale local constant rather than the new tighter ceiling it is meant to guard.

Export the constant from `internal/tmux` (e.g. `tmux.KillBarrierTimeoutCeiling`) and import it in the integration test. Closes the silent-desync gap with zero behaviour change.

Source: review of saver-kill-respawn-loop-leaks-daemons (Task 2-5 non-blocking note #13).
