# Resume hooks vanish when a pane moves

Registered per-pane resume hooks disappear from `hooks.json` on their own, with no user
action and no error. The symptom surfaces after a reboot: a restored pane comes back to a
bare shell instead of resuming its Claude session, and the entry that would have driven it
is simply absent from the file. Nothing in the logs at the production INFO level names what
was removed — the only trace is `hooks: clean-stale op=clean-stale entries=1`, which gives a
count and no key.

Observed live on 2026-08-21 with two panes, both running Claude, both with no hook:

- `agentic-workflows-refactor-wt` (`OCCvED:1.1`) — hook registered 2026-08-16T22:17:55 under
  key `OCCvED:1.2`, pruned by the daemon at 22:22:16, about four minutes later.
- `dex` window 2 (`d5H0DK:2.1`) — hook registered 2026-08-20T22:48:07 under key `d5H0DK:1.2`,
  pruned on 2026-08-21.

In both cases the hook was registered correctly, with the right command and the right session
id, and the pane is still alive. What changed is the pane's position. The hook key bakes
`window.pane` coordinates at registration time and nothing re-keys the entry when the pane
moves, so the key stops addressing its own pane. The daemon's stale sweep then removes it —
correctly by its own rule, since no live pane answers to that key.

The coordinates move under ordinary use. tmux derives `pane_index` from layout position, so
closing a sibling pane renumbers the survivor; this install also runs `renumber-windows on`,
so closing a window renumbers later windows; `break-pane` and `move-pane` change both halves.
Reproduced in an isolated `-L` socket: a pane holding a stamped marker went `t:1.2` → `t:2.1`
→ `t:1.1` across a break-pane and a window kill, three distinct keys for one unchanged pane.

Impact is silent loss of session continuity across reboots, proportional to how much the user
rearranges panes. Scrollback still restores, so the pane looks healthy — only the auto-resume
is gone, and it's invisible until the reboot that needed it. `portal doctor` reports all
checks green throughout, including `stale hooks: no stale hooks`.

Relevant files: `internal/tmux/tmux.go` (`HookKeyFormat`, `HookKey`, `ListAllPaneHookKeys`),
`internal/hooks/store.go` (`StaleKeys`, `CleanStale`), `internal/state/capture.go`
(`captureFormat`), `internal/restore/session.go`, `cmd/hooks.go`.

Distinct from the known subagent-SessionEnd clobber and from the degenerate `:.` key issue —
those are separate failure modes on the registration side.
