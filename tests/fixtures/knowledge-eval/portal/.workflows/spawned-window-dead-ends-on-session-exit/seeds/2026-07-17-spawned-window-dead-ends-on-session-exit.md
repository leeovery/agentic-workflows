# Spawned windows dead-end on "Process exited. Press any key to close" when the session exits

Observed after the multi-window spawn feature started working (post recent patch). When a multi-select burst opens several host-terminal windows and the user later exits the process running inside one of those sessions (e.g. quitting Claude), the spawned Ghostty window does not close cleanly or drop to a usable shell. Instead it detaches and dead-ends on tmux/terminal end-of-command text:

```
[detached (from session agentic-workflows-codify)]

Process exited. Press any key to close the terminal.
```

Pressing any key then closes the window. It's an awkward dead-end rather than landing the user back at a prompt.

The behaviour is specific to the *spawned* windows — the N−1 external windows opened by the burst. The trigger window (the one the user did the multi-selection from) does **not** show this; when its session exits, the user lands back at a normal shell prompt.

The likely mechanism, from what we discussed: each spawned window runs `portal attach <session> --spawn-ack …` as the window's direct command, with no surrounding interactive shell. `portal attach` outside tmux `syscall.Exec`s into `tmux attach-session -A`, so the tmux client becomes the window's one-and-only process. When the session exits/detaches, the client returns, the window's command is finished, and the terminal has nothing left to fall back to — hence the "Process exited. Press any key to close." The trigger window avoids this because portal there was launched from an existing interactive login shell and `syscall.Exec`s over the child, so exiting attach returns control to the parent shell and its prompt.

So the asymmetry is: trigger window has a parent shell to fall back to; spawned windows do not.

Impact: cosmetic/UX rough edge rather than data loss, but it makes the spawned windows feel broken or half-finished on exit, and it's inconsistent with the trigger window's clean landing. Directions that came up (not decisions): give spawned windows something to fall back to (e.g. chain a shell after the attach command so exiting drops to a prompt like the trigger window), or configure the host terminal's post-command / wait-after-command behaviour.

Relevant areas: `internal/spawn` (command composition — the `<os.Executable()> attach <session> --spawn-ack …` env-self-sufficient argv), `cmd/attach.go` / `AttachConnector` (the `syscall.Exec` handoff to `tmux attach-session -A`), and the Ghostty adapter (`OpenWindow`). Environment: macOS, Ghostty host terminal.
