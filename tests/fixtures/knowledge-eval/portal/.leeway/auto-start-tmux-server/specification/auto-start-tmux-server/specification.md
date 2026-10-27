# Specification: Auto Start Tmux Server

## Specification

### Overview

After a system reboot, the tmux server isn't running. Portal (`x`) currently shows no sessions because tmux-continuum can't restore until a server exists. A LaunchAgent (`com.leeovery.tmux-boot`) works around this but leaves a leftover `_boot` session and lives outside Portal's codebase.

Portal should self-bootstrap the tmux server when it detects none is running, removing the LaunchAgent dependency entirely.

### Design Philosophy

**Portal is plugin-agnostic.** Portal has zero knowledge of tmux-continuum, tmux-resurrect, or any other tmux plugin. Whether the user has resurrect/continuum, some other plugin, or nothing — that's tmux's business. Portal's only job is to ensure a server is running.

This means:
- No checking for resurrect data (`~/.local/share/tmux/resurrect/last`)
- No conditional logic based on plugin presence
- No awareness of how sessions get restored — they just appear (or don't)

### Bootstrap Mechanism

**Command:** `tmux start-server` — starts the tmux server without creating any sessions. No throwaway `_boot` session needed.

**Trigger:** A shared bootstrap function called early by every Portal command that requires tmux. Commands that skip the existing tmux availability check (`version`, `init`, `help`, `alias`, `clean`) also skip bootstrap.

**Detection:** Check if the tmux server is running (e.g., `tmux list-sessions` or `tmux info` succeeding). If running, skip bootstrap entirely — proceed to normal Portal operation. If not running, enter the bootstrap flow.

**One-shot:** Server start is a single attempt — no retry if `tmux start-server` fails. The subsequent session wait (see Timing) is a separate concern: it polls for sessions to appear, not for the server start to succeed.

**Caveat:** tmux's server exits by default with no sessions. The assumption is that continuum (if present) hooks in quickly enough to create sessions before this happens. If not, a keepalive session could be added later — but this is deferred unless the problem actually occurs.

**Two-phase ownership:**

Bootstrap has two phases with different ownership:

1. **Server start** — runs in `PersistentPreRunE` (shared by all commands). Calls `tmux start-server`. Returns immediately.
2. **Session wait** — ownership depends on context:
   - **TUI path**: The Bubble Tea model owns the wait. The interstitial is the model's initial state. The TUI's existing refresh cycle detects sessions; after min/max bounds are satisfied, transition to the normal view.
   - **CLI path**: The command owns the wait. Print stderr message, poll for sessions with the same timing bounds, then proceed to normal output.

This cleanly separates "ensure server exists" (shared, fast) from "wait for sessions" (context-specific presentation).

### User Experience

Two presentation paths share the same bootstrap logic:

**TUI path:** A dedicated loading interstitial — a blank screen with centered "Starting tmux server..." text. Visibly different from the normal TUI so the user knows something is happening. No logo, no progress bar — just a clean loading state. Sessions appear naturally via the TUI's refresh cycle as tmux/plugins do their thing.

**CLI path:** Print a status message to stderr ("Starting tmux server...") and block briefly. Normal command output goes to stdout. Piping works cleanly since the status message is on stderr.

After the wait completes, bootstrap returns control to the command. The command then executes normally — it queries tmux for sessions as it always does. Bootstrap doesn't pass session data through; it just ensures the server has had time to start and plugins have had time to restore sessions.

### Timing

**Session-detection with min/max bounds.** Transition out of the loading state as soon as sessions are detected, but enforce:

- **Minimum 1 second** — prevents a jarring flash if sessions appear very quickly
- **Maximum 6 seconds** — proceed regardless after this, even if no sessions have appeared

Not user-configurable. Both values should be defined as named constants in the code for easy adjustment.

**Applies to both TUI and CLI paths** — same timing logic, different presentation.

**Detection method:** Poll `tmux list-sessions` to check for session presence. Poll interval: 500ms. This applies to the CLI path directly; the TUI path uses its existing refresh cycle (which already polls session state) rather than a separate poll loop.

### Error Handling & Edge Cases

Bootstrap is a one-shot attempt. Try once, wait briefly, proceed regardless. No retry loop.

| Situation | What happens |
|---|---|
| Has continuum + saved sessions | Server starts, sessions restore, TUI shows them |
| Has continuum + no saved data | Server starts, nothing restores, server may exit, TUI shows empty state |
| No continuum at all | Server starts, nothing happens, server may exit, TUI shows empty state |
| tmux already running | Server detected, bootstrap skipped entirely — fast path |

All four scenarios converge to a sensible state. If the user later creates a session through Portal, `tmux new-session` starts the server implicitly — no Portal intervention needed.

Portal doesn't need the server running to show its UI. It only needs tmux when the user takes an action (create/attach session), and those commands handle server lifecycle natively.

### LaunchAgent Removal

This feature eliminates the need for the existing `com.leeovery.tmux-boot` LaunchAgent. Portal becomes self-contained for tmux server lifecycle management.

The LaunchAgent file itself lives in dotfiles (not the Portal codebase). Its removal is a separate manual cleanup, not a Portal code change.

---

## Working Notes

[Optional - capture in-progress discussion if needed]
