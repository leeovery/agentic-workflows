# Specification: Hooks Rm Pane Key Flag

## Change Description

`portal hooks rm` currently resolves the target hook entry exclusively from `$TMUX_PANE` via `resolveCurrentPaneKey()` in `cmd/hooks.go`, so it cannot remove an entry for any pane other than the one the caller is currently inside. Add an optional `--pane-key <key>` flag: when set, use it directly as the structural key passed to `store.Remove`; when unset, fall back to the existing `resolveCurrentPaneKey()` lookup. This lets external integrations (e.g. the user's `~/.dotfiles/home/.claude/hooks/portal-resume-hook.sh` Claude `SessionStart` hook) prune stale entries from `hooks.json` through Portal's CLI instead of editing the JSON file directly, preserving Portal as the sole writer of its own state.

## Scope

- `cmd/hooks.go` — `hooksRmCmd` only:
  - `init()` (around line 162): register `Flags().String("pane-key", "", "Structural key of the pane whose hook should be removed (defaults to the current pane)")` on `hooksRmCmd`.
  - `RunE` body (around lines 143-154): read `--pane-key`; if non-empty, use it as `structuralKey` directly; otherwise call `resolveCurrentPaneKey()` as today.
- `cmd/hooks_test.go` (or equivalent existing test file for `hooks rm`): one test per branch — flag-set and flag-unset (fallback). The flag-set branch must verify the command no longer requires `$TMUX_PANE` to be set.

## Exclusions

- No change to `hooks set` (still resolves from `$TMUX_PANE` only).
- No change to `hooks list`.
- No change to the `hooks.json` schema or to `internal/hooks` (`store.Remove(key, "on-resume")` already accepts an arbitrary key).
- No validation of the supplied `--pane-key` against live tmux panes — the flag is a literal pass-through to `store.Remove`. Stale-entry pruning is the explicit use case, so a key that doesn't resolve to a live pane is *expected*, not an error.
- The companion bash-side prune loop in the user's dotfiles is a separate change outside this repo and is not part of this quick-fix.

## Verification

- `go build -o portal .` succeeds.
- `go test ./cmd -run TestHooksRm` passes (both new branch tests plus any existing `hooks rm` coverage).
- `go test ./...` passes — no regressions elsewhere.
- Manual sanity: `portal hooks rm --pane-key 'nonexistent:0.0' --on-resume` outside any tmux session succeeds without the "must be run from inside a tmux pane" error; `portal hooks rm --on-resume` inside a tmux pane still removes the current pane's hook.
