# Pressing `m` should mark the highlighted session as the first selection

**User intent (2026-07-14):** Entering multi-select mode by pressing `m` on a highlighted session should immediately select that session as the first marked item — rather than entering the mode with nothing selected. Entering-with-zero was the original choice but now reads as a mistake: the common case is "I'm looking at a session, I want it in the set." The decision is made; this is the concrete change.

**Current behaviour:** The first `m` enters mode with an empty set; a second `m` toggles the cursor row. See `handleMultiSelectToggle` (`internal/tui/model.go:3503-3512`) — the mode-entry branch sets `selectedSessions = {}` and returns without marking the cursor row. (Entering-with-zero was intentional in the shipped design; a new spec supersedes that choice — no editing of the old spec.)

**Change:** In the mode-entry branch, mark the currently-highlighted session on entry, reusing the existing `selectedSessionItem()` lookup — which already returns `ok=false` on a non-selectable `HeaderItem` row, so entering on a group header cleanly enters with zero (no special-casing). ~3 lines in one function.

**Edge cases to preserve:**
- Cursor on a group-header (`HeaderItem`) row → enters with zero (the `ok=false` path).
- Zero-selected stays reachable: double-`m` (enter + toggle the auto-marked row off) yields an empty mode; `Esc` clears/exits.
- Multi-tag (By-Tag Pattern B) highlighted row → marks the underlying session once (same identity rule as the toggle branch).

**Ripple:** A handful of tests assert "enters with zero selected" (e.g. the banner's "0 selected" case) — they flip, or reach zero via the header-row / toggle-off paths.

**Size:** Small — a concrete ~3-line edit at a known location plus the test-assertion flips.

Source: user request during review close-out of restore-host-terminal-windows
