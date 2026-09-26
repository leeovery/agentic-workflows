# Specification: Hooks Skip Bootstrap

## Change Description

Add `hooks` to the `skipTmuxCheck` allowlist in `cmd/root.go` so that `portal hooks set`, `portal hooks rm`, and `portal hooks list` no longer trigger the 11-step bootstrap orchestrator on every invocation. The original justification for including `hooks` in the bootstrap path (keeping `CleanStale` and skeleton restoration "where the user expects it") predates the real-world usage pattern in which Claude Code's `SessionStart` hook fires `portal hooks set` ~13 times in a 3-second burst as each resumed Claude session registers its new UUID — each cascading bootstrap reaches `EagerSignalHydrate` and emits ENOENT warnings for FIFOs that other panes' helpers have already consumed (53 such warnings observed in `portal.log` post-reboot on 2026-05-26), adds ~100 ms per resume in bootstrap overhead, and broadens the blast radius of the separately-tracked `bootstrap-cleanstale-wipes-hooks-on-tmux-transient` defect.

## Scope

- `cmd/root.go` — `skipTmuxCheck` map (around lines 33-40):
  - Add `"hooks": true` entry.
  - Rewrite the comment block above the map (lines 17-32): replace the "Note: 'hooks' is intentionally NOT in this map" paragraph with a paragraph justifying the *inclusion* — `hooks set/rm/list` are pure config-file operations that need only `$TMUX_PANE` (already guaranteed because they run inside a tmux pane) and a single `tmux display-message` call to resolve the structural pane key via `buildHooksTmuxClient()`; they do not need daemon orchestration, saver bootstrap, version-upgrade machinery, Restore, EagerSignalHydrate, marker/FIFO cleanup, or `hookStore.CleanStale`. `hooks list` needs nothing tmux-related at all. Auto-cleanup of stale hook entries continues to fire from bootstrap-triggering commands (`portal open`, `x`, `attach`).

- `cmd/root_test.go` — `skipTmuxCheck` behavior coverage:
  - Add one sub-test asserting that `portal hooks set …` does not invoke the bootstrap orchestrator (mirroring the existing assertion pattern used for the other allowlisted commands).

## Exclusions

- No change to `cmd/hooks.go`. `resolveCurrentPaneKey` (line 47) already constructs its own `*tmux.Client` via `buildHooksTmuxClient()` (line 57) and does not read any bootstrap-injected context value — no mitigation is needed.
- No change to `internal/hooks` or the `hooks.json` schema.
- No change to the bootstrap orchestrator, its step ordering, or any of the 11 bootstrap steps.
- Does not address the latent `bootstrap-cleanstale-wipes-hooks-on-tmux-transient` defect — that bug can still trigger via `portal open`/`x`/`attach` and is tracked as a separate inbox bug.
- The cascading-bootstrap → ENOENT log-noise pattern is addressed only for the `hooks set/rm/list` trigger. Other commands that legitimately go through bootstrap remain on the bootstrap path.
- No changes to the user-side `~/.dotfiles/home/.claude/hooks/portal-resume-hook.sh` Claude `SessionStart` hook script.

## Verification

- `go build -o portal .` succeeds.
- `go test ./cmd -run TestSkipTmuxCheck` (or whichever name covers the existing allowlist behaviour) passes, including the new `hooks set` sub-test.
- `go test ./...` passes — no regressions in existing `cmd/hooks_test.go` or elsewhere.
- The `cmd/root.go` comment above `skipTmuxCheck` no longer asserts that `hooks` is intentionally excluded; the new comment briefly justifies inclusion.
- Manual sanity: invoking `portal hooks set --on-resume 'true'` inside a tmux pane succeeds without the bootstrap orchestrator running (verified by absence of `ComponentBootstrap` log entries for that invocation in `portal.log`).
