# Cold-boot restore lands on the Projects page, not Sessions

After a **cold** start (no tmux server yet) through the TUI picker, the concurrent bootstrap restores the saved sessions and the loading screen reports `Restoring sessions N/N` correctly — but when the picker appears it opens on the **Projects** page rather than **Sessions**, despite N sessions having just been restored. The user has to press `x` to get to the sessions they just restored.

The **warm** path (tmux server already running) opens on Sessions as expected, so this is specific to the cold concurrent-bootstrap path.

## Observed
Reproduced repeatably in the demo harness (`demo/`, a sandboxed Linux container with a baked restore seed of 12 sessions):

1. Cold container, no tmux server, `sessions.json` + scrollback present.
2. `portal open` (the TUI picker) → loading screen shows `✓ Restoring sessions 12/12 · ✓ Replaying scrollback · ✓ Running resume commands`.
3. Picker opens on **Projects** (10 projects), footer `x sessions`.
4. Press `x` → **Sessions** page lists all 12 restored sessions (correct names, scrollback intact).

So the restore itself is fully correct — only the **initial page selection** is wrong.

## Hypothesis (to verify, not asserted)
The Loading → page transition likely chooses Sessions-vs-Projects from a session count captured *before* the restored sessions are visible to `ListSessions` (an ordering/race between restore completion on the `BootstrapCompleteMsg` path and the "no sessions yet → fall back to Projects" landing rule). Worth checking the cold-path landing decision in `internal/tui/model.go` (the `BootstrapCompleteMsg` handler / first non-loading page selection) against the warm path, which sees sessions at init and lands on Sessions.

## Impact
Minor UX: after a reboot/cold-boot you land on Projects instead of the sessions you just resurrected — mildly surprising and costs an extra keypress. Not a data/correctness issue (sessions and scrollback restore fine).

Source: observed while building the cold-boot resurrection demo (`demo/portal-cold.tape`) for spectrum-tui-design, 2026-06-25.
