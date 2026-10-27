# Specification: Space Dismisses Preview

## Change Description

In the TUI session list, `Space` opens the scrollback preview page for the highlighted session. Today the only way back is `Esc`. Make `Space` act as a second toggle: pressing it while the preview page is active dismisses the preview and returns to the session list, mirroring the existing `Esc` behaviour exactly. Motivation is ergonomic symmetry — `Space` is the open gesture, so it should also be a close gesture.

## Scope

- `internal/tui/pagepreview.go` — inside `previewModel.Update`'s `tea.KeyMsg` switch (around line 467), add a `case tea.KeySpace:` arm that returns `previewDismissedMsg{}` exactly like the sibling `tea.KeyEsc` arm. `tea.KeySpace` matches the project convention (the opener in `internal/tui/model.go:1413` uses the same type).
- `internal/tui/pagepreview_test.go` (or a peer test file in the same package) — add a focused unit test asserting that a `tea.KeyMsg{Type: tea.KeySpace}` delivered to `previewModel.Update` produces a command whose realised message is `previewDismissedMsg{}`. Pattern can mirror existing Esc-dismiss tests if any, or the test helpers used in `pagepreview_entry_test.go` / `pagepreview_filter_test.go`.

The existing dismiss pathway already handles the `pagePreview → pageSessions` transition (including the sessions-list refresh dispatched on dismissal documented in `CLAUDE.md`), so no other wiring needs touching.

## Exclusions

- No changes to the **open** binding in `internal/tui/model.go` — that lives in `updateSessionList` and remains the single Space-open site (the `pagepreview_filter_test.go:228` single-binding invariant continues to count occurrences only inside `updateSessionList`, unaffected by the new occurrence in `previewModel.Update`).
- No changes to filter-mode behaviour. The preview page is reached only after the filter has been committed and the user has pressed Space; filter-mode `Space` semantics (literal space inserted into the filter input) are unchanged because filter input lives on the Sessions page, not the Preview page.
- No changes to `Esc` handling, the dismiss message type, the post-dismiss sessions refresh, or any other key bindings (`Home`, `End`, `Enter`, `Tab`, `]`, `[`).
- No documentation/keymap-footer surface updates in this work unit — those are tracked separately under the `surface-x-toggle-in-keymap-hints` and `three-column-keymap-footer` inbox items.

## Verification

- `go build -o portal .` succeeds.
- `go test ./internal/tui/...` passes — covers existing preview behaviour plus the new Space-dismiss assertion.
- `go test ./...` passes — no cross-package regressions.
- Manual smoke (covered by the verify step at review time, not blocking implementation): launch portal, open the session list, press `Space` on a session → preview opens; press `Space` again → returns to session list identical to pressing `Esc`.
- Single-Space-open binding invariant (`pagepreview_filter_test.go`) still passes — the new `tea.KeySpace` case is in `previewModel.Update`, not in `updateSessionList`, so the count check is unaffected.
