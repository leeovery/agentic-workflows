# Specification: Surface X Toggle In Keymap Hints

## Change Description

In the TUI, the sessions-page keymap footer shows `p` as the hint for jumping to the projects page, and the projects-page footer shows `s` for jumping back to sessions. A separate `x` binding already toggles between the two pages from either side — functionally identical to the contextual `p` / `s` keys — but it has never appeared in the footer, so it is undiscoverable. Surface `x` by widening the key glyph on the two existing page-jump hints to `p/x` (sessions page) and `s/x` (projects page). This is a display-only change — the `x` bindings stay wired exactly as they are today and no behaviour changes.

## Scope

- `internal/tui/model.go` only — two single-line edits to the help-key text:
  - `sessionHelpKeys()` (`model.go:529`): change `key.WithHelp("p", "projects")` so the displayed key reads `p/x` (e.g. `key.NewBinding(key.WithKeys("p"), key.WithHelp("p/x", "projects"))`).
  - `projectHelpKeys()` (`model.go:576`): change `key.WithHelp("s", "sessions")` so the displayed key reads `s/x` (e.g. `key.NewBinding(key.WithKeys("s"), key.WithHelp("s/x", "sessions"))`).
- Only the `WithHelp` display string changes. `WithKeys` is left unchanged — these footer bindings are display feeders only; actual `p` / `s` / `x` keystroke handling lives in the `Update` key switch and is untouched. Because the edit only widens the glyph on existing entries (it does not add or remove entries), the three-column footer chunking (`keymapFooterColumnSize = 5`, from the `three-column-keymap-footer` work unit) is unaffected.

## Exclusions

- No change to any runtime key handling — the `x`, `p`, and `s` bindings stay wired exactly as today.
- No change to the projects-page **command-pending** footer (`commandPendingHelpKeys()`): command-pending mode never registers `s` / `x` (per the `tui-session-picker` spec), so it has no page-jump hint to widen.
- No change to the three-column footer layout, chunking constant, column sizing, or `brightenHelpStyles` palette.
- No new footer entries, no semantic grouping, no separate standalone `x` entry — the `x` glyph is folded into the existing page-jump hint only.
- No documentation/README updates.

## Verification

- `go build -o portal .` succeeds.
- `go test ./internal/tui/...` passes — existing help-bar tests (`model_test.go` "projects help bar …" / "sessions help bar …" runs) assert on the description text (`"projects"`, `"sessions"`), not the key glyph, so they continue to pass unchanged.
- `go test ./...` passes — no cross-package regressions.
- Manual smoke: launch `./portal`; the sessions-page footer shows `p/x  projects`; press `p`; the projects-page footer shows `s/x  sessions`. Pressing `x` from either page still toggles to the other (behaviour unchanged).
