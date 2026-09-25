# Research: Resume Sessions After Reboot

Generic restart command registry so Portal can resume processes (Claude Code, dev servers, etc.) in tmux sessions after a system reboot.

## Starting Point

- After reboot, tmux-resurrect restores session layout, CWDs, and pane structure — but processes are dead
- The idea is a subcommand that stores opaque restart command strings (Portal doesn't know what they do)
- On the Claude side, a `SessionStart` hook would register a restart command with Portal
- After reboot, Portal could use registered commands to restart processes in their panes
- tmux-resurrect's `@resurrect-processes` re-runs original launch commands, which doesn't work for Claude (resume UUID differs from launch command)

---

## Findings

### Claude Code Hook Payload

The `SessionStart` hook receives JSON on stdin including:
- `session_id` — the UUID needed for `claude --resume <uuid>`
- `source` — distinguishes startup/resume/clear/compact
- Hook fires on every session start and resume, so it could keep a registration current automatically

This means the data needed for Claude resume is available to a hook script.

### Pane Identification

`$TMUX_PANE` is an environment variable set automatically by tmux in every process running inside a pane. This means any process (including Portal) running in a pane can discover its own pane ID without it being passed explicitly.

A hook script could stay purely tool-specific — it only needs to know about Claude's session ID. Portal could handle the pane association internally by reading `$TMUX_PANE` from its own environment. Example hook:

```bash
SESSION_ID=$(cat - | jq -r '.session_id')
portal register-restart "claude --resume $SESSION_ID"
```

### Scoping Considerations

- A tmux session can have multiple windows, each with multiple panes
- If you have 4 Claude instances in 4 panes of the same project, each needs its own restart command
- This points toward pane-level scoping for the registry, rather than session-level
- Tmux pane IDs (e.g. `%0`, `%1`) persist across resurrect

### Execution Timing

When should registered restart commands run? Options explored but not decided:
- **Eagerly** — on server bootstrap, fire all registered commands immediately after resurrect
- **Lazily** — when the user selects a session in the TUI, execute for that session's panes
- Each has tradeoffs around control vs. warm-up time

### Detection vs. Registry-Driven

Two approaches were discussed:
- Portal could try to detect whether a pane's process is dead before executing — adds complexity
- Alternatively, if a restart command is registered, just execute it; if not, normal behavior — simpler but assumes registration is always valid

## Open Questions

- Per-session vs per-pane scoping — pane-level seems necessary but needs discussion
- When to execute restart commands (eager vs lazy vs hybrid)
- Whether to confirm before auto-sending commands to panes
- Whether dead-process detection is needed or if registry-driven is sufficient
- Whether users should be advised not to add Claude to `@resurrect-processes` to avoid conflicts
- What the subcommand should actually be called (not `register-restart`)
- Registry storage format and location
- What happens when a pane ID becomes stale (pane was closed before reboot)
