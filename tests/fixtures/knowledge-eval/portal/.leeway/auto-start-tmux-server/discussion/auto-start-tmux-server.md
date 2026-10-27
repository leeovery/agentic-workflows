# Discussion: Auto-Start Tmux Server

## Context

After a system reboot, running Portal (`x`) shows no sessions because the tmux server hasn't started yet. tmux-continuum can't restore sessions until a server exists. A LaunchAgent (`com.leeovery.tmux-boot`) currently works around this by starting the server on login, but it leaves a leftover `_boot` session.

Portal should self-bootstrap the tmux server when it detects none is running, removing the LaunchAgent dependency entirely.

### References

- [ideas/auto-start-tmux-server.md](../../../ideas/auto-start-tmux-server.md) — Original idea doc with proposed flow and edge cases

## Questions

- [x] What's the right bootstrap flow — and does the proposed sequence from the idea hold up?
- [x] Which Portal commands should trigger bootstrap vs skip it?
- [x] What should the user experience be during the wait for session restore?
- [x] How should we handle the _boot session lifecycle?
- [x] What happens when things go wrong — timeouts, no resurrect data, partial restores?

---

## Q1: Bootstrap Flow

### Context

The original idea proposed: detect no server → check resurrect data → start `_boot` session → poll for restore → kill `_boot` → proceed. This had a conditional branch based on whether resurrect data existed.

### Options Explored

**Option A (original proposal):** Check resurrect data at `~/.local/share/tmux/resurrect/last` first, conditionally wait. Two code paths.

**Option B:** Always start server, always poll briefly, proceed regardless. One code path. The poll timeout handles both "sessions restored" and "nothing to restore" naturally.

**Option C (chosen):** Start server via `tmux start-server`, show a loading interstitial in the TUI, let sessions appear naturally via the TUI's refresh cycle. No polling loop.

### Journey

Started with the idea's proposed flow but questioned why Portal should check for resurrect data at all. Key realisation: **Portal should be completely agnostic about tmux plugins.** Whether the user has resurrect/continuum, some other plugin, or nothing — that's tmux's business. Portal's only job is to ensure a server is running.

Searched the codebase and confirmed zero references to resurrect/continuum in Portal source code — it's already decoupled. All references are in idea docs and old workflow discussions.

This reframing eliminated the resurrect data check entirely and simplified the design.

### Decision

**Option C — immediate entry with loading interstitial.** Portal starts the server and drops into the TUI immediately with a loading screen. Sessions appear as tmux/plugins do their thing. No blocking poll, no knowledge of resurrect.

**Why:** Keeps `x` responsive. Portal stays plugin-agnostic. User gets visual feedback that something is happening.

---

## Q2: No `_boot` Session Needed

### Context

The original idea required creating a throwaway `_boot` session (`tmux new-session -d -s _boot`) because the assumption was tmux needed at least one session to keep the server alive.

### Journey

Questioned whether a throwaway session was truly necessary. Checked `man tmux` and discovered `tmux start-server` (alias `start`) — explicitly starts the server **without creating any sessions**.

### Decision

Use `tmux start-server` instead of creating a `_boot` session. No throwaway session to create, name, hide, or clean up.

**Caveat noted:** tmux docs say the server exits by default with no sessions. Assumption is that continuum hooks into the process quickly enough to create sessions before this happens. If not, a keepalive session could be added later — but treating that as an edge case to handle if it actually occurs, not upfront.

---

## Q3: User Experience — Loading Interstitial

### Options Explored

1. Normal empty state (Projects page) with a subtle "tmux server starting..." banner that auto-dismisses
2. A dedicated interstitial/overlay — "Starting tmux..." — that dissolves into the normal view
3. Small status indicator in the corner/footer

### Journey

Explored a Spectrum-inspired design direction with rainbow block characters, Manic Miner-style status bars, and animated progress indicators. Captured separately in `ideas/spectrum-design.md` as a broader TUI redesign exploration — out of scope for this feature.

For this feature, keeping the interstitial simple: no branding overhaul, just a clear loading state.

### Decision

**Option 2 — dedicated loading interstitial, kept simple.** A blank screen with centered "Starting tmux server..." text. Visibly different from the normal TUI so the user sees something is happening. No logo, no progress bar — just a clean loading state.

A broader Spectrum-themed redesign may be pursued separately (see `ideas/spectrum-design.md`).

---

## Q4: Error Handling and Edge Cases

### Context

What happens when there are no sessions to restore? The server starts, nothing appears, tmux may shut down. Risk of a loop: start server → no sessions → server exits → Portal detects no server → starts again.

### Decision

**Bootstrap is a one-shot attempt.** Try once, wait briefly, proceed regardless. No retry loop.

| Situation | What happens |
|---|---|
| Has continuum + saved sessions | Server starts, sessions restore, TUI shows them |
| Has continuum + no saved data | Server starts, nothing restores, server may exit, TUI shows empty state |
| No continuum at all | Server starts, nothing happens, server may exit, TUI shows empty state |
| tmux already running | No bootstrap needed, fast path |

All four scenarios converge to a sensible state. If the user later creates a session through Portal, `tmux new-session` starts the server implicitly — no Portal intervention needed.

**Why no loop:** Portal doesn't need the server running to show its UI. It only needs tmux when the user takes an action (create/attach session), and those commands handle server lifecycle natively.

---

## Q5: Which Commands Trigger Bootstrap

### Context

All Portal commands interact with tmux — listing sessions, attaching, creating, killing. Question was whether only the TUI should bootstrap, or all commands.

### Options Explored

**A) All commands bootstrap, CLI commands block briefly.** Consistent behavior. `x list` after reboot pauses, then shows restored sessions.

**B) All commands bootstrap, CLI commands don't wait.** Start server but no pause. `x list` might return empty immediately after reboot.

**C) Only TUI bootstraps.** CLI commands work with whatever's there. Simpler but potentially surprising if someone runs `x list` first.

### Journey

Initially considered whether CLI subcommands would realistically be the first thing run after a reboot. But the priority is correctness over simplicity — if a command needs tmux, it should ensure tmux is ready.

Explored whether a CLI command could show feedback during the wait. Answer: yes — print a status message to stderr ("Starting tmux server..."), block briefly, then output the normal result to stdout. Piping still works cleanly since the status message is on stderr.

### Decision

**Option A — all commands trigger bootstrap with context-appropriate feedback.** Shared bootstrap function called early by every command. TUI path shows the loading interstitial. CLI path prints an inline status message to stderr and blocks briefly.

**Why:** Correctness first. Every command that needs tmux should ensure it's there. The presentation differs by context but the logic is the same.

---

## Q6: Timing — Interstitial Duration

### Context

How long should the loading interstitial / CLI wait last? Need to balance responsiveness with avoiding a jarring flash if sessions appear almost instantly.

### Decision

**Session-detection with min/max bounds.** Transition out of the interstitial as soon as sessions are detected, but enforce:

- **Minimum 2 seconds** — prevents a flash of the interstitial if sessions appear very quickly
- **Maximum 5-6 seconds** — proceed regardless after this, even if no sessions have appeared

Not configurable. These are sensible defaults that cover the common case without adding user-facing complexity.

**Applies to both TUI and CLI paths** — same timing logic, different presentation.

---

## Q7: LaunchAgent Removal

### Context

The existing `com.leeovery.tmux-boot` LaunchAgent is a separate workaround (not part of Portal codebase — lives in dotfiles). This feature replaces it entirely, making Portal self-contained.

### Decision

Removing the LaunchAgent dependency is **in scope** for this feature — the discussion and spec should acknowledge that this feature eliminates the need for it. The actual LaunchAgent file removal from the system/dotfiles is a separate manual cleanup, not a Portal code change.

---

## Open Questions

None — all questions answered.

---
