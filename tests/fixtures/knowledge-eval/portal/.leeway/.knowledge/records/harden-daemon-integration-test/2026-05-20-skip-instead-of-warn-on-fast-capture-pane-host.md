# Skip instead of WARN on fast capture-pane host in mid-tick SIGHUP test

In `cmd/state_daemon_integration_test.go`, `TestDaemon_MidTickSIGHUP_ExitsWithinBoundedWindow` measures one pane's `capture-pane` wall time and derives `anchorThreshold = max(2s, 2 × singlePaneWallTime)`. When the aggregate per-tick wall time is below 2s on a fast host, the test currently emits a `t.Logf` warning (around line 252) and proceeds.

Proceeding in that state means the test passes trivially without exercising the load-bearing "tick spans the kill barrier" scenario — defeating the purpose of the integration test. Swap the warning for `t.Skip(...)` so the test explicitly skips when the fixture cannot exercise the cancellation path, rather than silently degrading to a no-op pass.

Source: review of saver-kill-respawn-loop-leaks-daemons (Task 2-5 non-blocking note #12).
