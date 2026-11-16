# `portal hook set` silently persists a degenerate `:.` entry when the pane doesn't resolve

`portal hook set --on-resume "<cmd>"` succeeds and returns exit code 0 when `$TMUX_PANE` points at a pane that does not exist. Instead of failing, it resolves the hook key to the literal string `:.` — an empty session component and empty window/pane indices — and persists the entry into `hooks.json` under that key.

Reproduced on 2026-08-16 against Portal 0.11.0 by invoking `TMUX_PANE=%165 portal hook set --on-resume "noop"` where `%165` was not a live pane. The command printed nothing, exited 0, and `hooks.json` gained:

```json
":.": { "on-resume": "noop" }
```

The entry is removable with `portal hook rm --on-resume --pane-key ':.'`.

This is not a one-off. `portal.log` shows the same pattern recurring over months across both 0.10.5 and 0.11.0 — `hooks: rm op=rm hook_key=:. via=cli` lines appearing repeatedly (2026-08-11, 2026-08-14 twice, 2026-08-15 twice), each followed within seconds or minutes by a daemon `hooks: clean-stale op=clean-stale entries=1` line. The recurring single-entry clean-stale sweeps that show up in the log are this junk key being swept, not genuine staleness — which makes the daemon's clean-stale signal misleading when reading the log for real problems.

The impact is that a failed registration is indistinguishable from a successful one at the call site. The Claude Code SessionStart hook at `~/.claude/hooks/portal-resume-hook.sh` shells out to `portal hooks set` and logs the return code; because that code is 0, the hook records a success and moves on, while the pane it intended to protect has no resume hook at all. A pane can therefore end up with no reboot recovery with nothing anywhere reporting a failure — the condition is only detectable by diffing `hooks.json` keys against the live pane list. During the same 2026-08-16 audit, six of forty-two panes were found running Claude with no resume hook registered.

The same degenerate key can presumably arise from any caller whose `$TMUX_PANE` is stale or points at the wrong tmux server, not just a manually-supplied bad value.

Relevant surfaces: the hook-key derivation primitives in `internal/tmux` (`ResolveHookKey`, `HookKeyFormat`), the `hook set` command body in `cmd/hooks.go`, and the `hooks` store in `internal/hooks`. The corresponding `rm` path is also worth checking — `portal.log` shows `rm op=rm hook_key=:.` lines, so removal accepts the degenerate key too.
