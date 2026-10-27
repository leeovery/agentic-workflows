# Specification: Resume Sessions After Reboot

## Specification

### Overview

Portal manages tmux sessions. After a system reboot, tmux-resurrect restores session layout, CWDs, and pane structure — but processes are dead. Portal provides a generic hook system that can resume processes (Claude Code, dev servers, etc.) in their original panes.

The core problem: tmux-resurrect's `@resurrect-processes` re-runs original launch commands, which doesn't work for tools where the resume command differs from the launch command (e.g., `claude --resume <uuid>` vs `claude`).

**Architecture:**

- **Persistent registry** (file on disk): maps pane IDs to restart commands — survives reboot
- **Volatile markers** (tmux server options): indicate a process was registered on this server lifetime — die with the server
- **Execution trigger**: Portal's connection flow (`portal open`) — lazy, not eager
- **Execution condition**: persistent entry exists AND volatile marker absent (server restarted since registration)

External tools register hooks via `xctl hooks set` (e.g., Claude Code's `SessionStart` hook calls `xctl hooks set --on-resume "claude --resume $SESSION_ID"`). Portal handles pane mapping internally using `$TMUX_PANE`.

### Registry Model & Storage

**Scoping model:** Per-pane, flat registry. A simple `pane_id → restart_command` map. No session or window hierarchy stored — when Portal needs to act on a session's processes, it queries tmux for that session's panes and cross-references the registry.

Pane IDs (`%0`, `%1`, etc.) are globally unique across the entire tmux server, assigned sequentially, and persist across tmux-resurrect.

**Storage format:** JSON at `~/.config/portal/hooks.json`.

```json
{
  "%3": { "on-resume": "claude --resume abc123" },
  "%7": { "on-resume": "claude --resume def456" }
}
```

- Follows existing convention: structured data → JSON, simple key-value → flat file
- Hooks are structured (pane × event type) and will grow to support multiple events per pane
- Reuses the atomic write pattern from `project/store.go`

### CLI Surface

`xctl hooks` with `set`/`rm`/`list` subcommands:

```
xctl hooks set --on-resume "claude --resume $SESSION_ID"
xctl hooks rm --on-resume
xctl hooks list
```

**Behavior:**

- Pane ID inferred from `$TMUX_PANE` — caller doesn't need to pass it
- `set` is idempotent — re-registering overwrites the previous command for that pane and event type
- Only `--on-resume` implemented initially; surface supports future event types (e.g., `--on-start`, `--on-close`)
- The event type flag (e.g., `--on-resume`) is required for `set` and `rm`. Running without an event flag is an error
- Mirrors `xctl alias set`/`rm`/`list` for consistency

**`hooks list`** shows all registered hooks across all panes — no filtering flags needed. Output format:

```
%3  on-resume  claude --resume abc123
%7  on-resume  claude --resume def456
```

One line per hook, tab-separated: pane ID, event type, command.

Under the hood: `xctl hooks set` = `portal hooks set`.

`hooks set` and `hooks rm` require `$TMUX_PANE`. If absent (e.g., called outside tmux), the command exits with an error: "must be run from inside a tmux pane".

`hooks rm` is a silent no-op if no hook is registered for the current pane. This supports scripting — tools calling `rm` in cleanup paths shouldn't fail if the hook was already removed.

**tmux requirement:** `hooks` is added to `skipTmuxCheck` (like `alias`) — it doesn't need Portal's tmux bootstrap. `hooks list` only reads the JSON file and doesn't need tmux at all. `hooks set` and `hooks rm` validate `$TMUX_PANE` themselves and require a running tmux client for the volatile marker operations.

### Volatile Marker Mechanism

Use the tmux server itself as volatile storage. Set a tmux server-level option when registering a hook — this marker lives only in server memory and dies when the server dies. tmux-resurrect does NOT restore tmux options.

**Implementation:**

- **On register (`hooks set`):** Set tmux server option `@portal-active-{pane_id}` (e.g., `set-option -s @portal-active-%3 1`)
- **On deregister (`hooks rm`):** Remove tmux server option `@portal-active-{pane_id}`
- **On execution check:** Query for the marker — absent means server restarted since registration

**Why this works:**

- `set-option -s @custom-var` works — tmux supports `@`-prefixed user options at server level
- tmux-resurrect does not save or restore any tmux options (server, session, window, or pane level)
- `set-environment -g` also dies with the server and isn't restored
- The marker's absence is a tautological indicator of "server restarted since registration"

### Execution Mechanics

**Trigger:** Lazy execution during Portal's connection flow. Restart commands fire when the user connects to a session via Portal (e.g., `portal open`). No eager startup, no tmux-level hooks. Bypass Portal, bypass the registry.

This is a Portal-mediated action, not a tmux hook. If someone uses raw `tmux attach`, they've bypassed Portal and don't get Portal's benefits.

**Two-condition execution check:** persistent entry exists AND volatile marker absent.

| Scenario | Entry? | Marker? | Result |
|----------|:---:|:---:|--------|
| Reboot, tool was running | Yes | No (server died) | Execute |
| Normal reattach, tool running | Yes | Yes | Skip |
| Reattach after clean exit | No (deregistered) | No (removed) | Skip |
| Reattach after crash/kill -9 | Yes | Yes (same server) | Skip |
| Reboot after clean exit | No | No | Skip |
| Reboot after crash (no deregister) | Yes | No (server died) | Execute |

Row 6 (crash then reboot) is arguably correct — tool was running, didn't signal intentional shutdown, server restarted. User can close it again if unwanted.

**Scope:** Hook execution is scoped to the target session's panes only. Portal queries tmux for the session's panes and cross-references the registry — hooks for other sessions are not touched. After a reboot with 5 sessions restored, hooks fire incrementally as the user opens each session.

**Insertion point:** Hook execution happens **before** connecting to the session. This is required for `AttachConnector` (`syscall.Exec` replaces the process — nothing can run after) and consistent for `SwitchConnector`. All Portal connection paths trigger hook execution: TUI picker selection, direct path argument, and `portal attach`.

**Command delivery:** Portal uses `tmux send-keys` to deliver restart commands to panes. This types the command into the pane's existing shell as if the user typed it. If the restarted process later exits, the user returns to their shell prompt.

**Post-execution:** After Portal executes a restart command, it sets the volatile marker (`@portal-active-{pane_id}`) for that pane. This prevents re-execution on subsequent `portal open` calls. Self-registering tools (like Claude Code) will overwrite this marker when they call `xctl hooks set`, which is harmless — the marker is already present.

**Multiple panes:** When a session has multiple panes with registered hooks, Portal executes them sequentially (fire-and-forget via `send-keys` — no waiting for completion). Order follows pane ID iteration from the JSON store. If `send-keys` fails for a pane (e.g., pane in unexpected state), the error is silently ignored and execution continues to the next pane.

**Auto-execute:** No confirmation prompt. The user already registered these commands as "restart me." The two-condition check provides sufficient safety. If something restarts that shouldn't have, the user can close it.

### Stale Registration Cleanup

**Lazy cleanup on read, plus `xctl clean`.**

When Portal reads hooks (during `portal open`), cross-reference pane IDs against live tmux panes. Prune entries for panes that don't exist. Invisible to the user.

This mirrors the existing pattern: the TUI already calls `CleanStale()` on the project store every time it loads, automatically pruning projects whose directories no longer exist. The `clean` command provides the same capability explicitly but the real work happens lazily.

Adding hook cleanup to `xctl clean` is a natural fit — it already says "remove stale projects whose directories no longer exist." Extending to "remove hook entries for panes that no longer exist" is semantically identical.

### Non-Goals

- **No tmux-resurrect awareness.** Portal has no awareness of tmux-resurrect or any other plugin. It doesn't know or care what's in the user's tmux config. If there's a conflict with `@resurrect-processes`, that's the user's configuration to manage.
- **No eager execution.** No process restart on server bootstrap. Only lazy, Portal-mediated triggers.
- **No process detection.** No checking if a process is alive or dead. The volatile marker mechanism replaces any need for process inspection.

---

## Working Notes

[Optional - capture in-progress discussion if needed]
