# `cleanup` / `--purge` subtests run against the developer's real state dir

`TestStateUserFacingSubcommandsExitZero` (in `cmd/state_test.go`) drives several `portal state` subcommands as table cases, but its `PORTAL_STATE_DIR` isolation is applied selectively. Around lines 232-234 the test sets `PORTAL_STATE_DIR=t.TempDir()` only when `tt.args[1] == "status"`. The other two cases — "cleanup with no flags" and "cleanup with --purge" — get no isolation, so they resolve the state directory via the normal XDG path and run against the developer's real `~/.config/portal/state`.

The `--purge` case is the damaging one: it calls `os.RemoveAll` on the resolved state directory. When run against the real install it fails with `unlinkat ~/.config/portal/state: directory not empty`, which happens because a live `portal state daemon` / `_portal-saver` is concurrently writing into that directory while `RemoveAll` walks it. The symptom is an intermittent test failure (it depends on whether the real state dir exists, is non-empty, and is being actively written) — the `--purge` subtest fails on a developer machine that has a live portal install, while passing in a clean environment such as fresh CI.

Beyond the flaky failure, the deeper concern is the side effect: a unit/integration test reaches outside its sandbox and deletes (or attempts to delete) the developer's real persisted state. This is the same test-isolation-gap class that `CLAUDE.md` explicitly warns about — a leaked/unisolated test that touches the real `~/.config/portal/state/` is how the slow-open / empty-previews / zombie-session incident was originally caused. The `status` subtest already demonstrates the correct pattern (temp-dir isolation); the gap is that the guard is keyed on the specific subcommand string rather than applied uniformly.

The fix direction is to apply `PORTAL_STATE_DIR=t.TempDir()` isolation unconditionally to all three subtests (`status`, `cleanup`, `cleanup --purge`) rather than gating it on `tt.args[1] == "status"` — ideally also adopting `portaltest.IsolateStateForTest` so the fingerprint-diff backstop covers these cases too.

Relevant file: `cmd/state_test.go` (the `TestStateUserFacingSubcommandsExitZero` table and its conditional env-isolation block ~lines 232-234); the purge behaviour itself lives in `cmd/state_cleanup.go`.

Discovered during the `portal-observability-layer` feature implementation (analysis cycle 3, task 9-2 review). It is pre-existing and unrelated to that feature's changes — the observability work touched neither the cleanup/purge command path nor that test.
