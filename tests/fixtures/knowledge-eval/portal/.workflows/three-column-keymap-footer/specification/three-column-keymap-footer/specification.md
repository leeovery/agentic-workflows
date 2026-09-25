# Specification: Three Column Keymap Footer

## Change Description

In the TUI, the bottom-of-screen keymap footer on the sessions list and the projects list currently renders as two columns (the visible result of the built-in `bubbles/list` `FullHelp` grouping after Portal disables Quit, `ShowFullHelp`, and `CloseFullHelp`). Restructure the footer to render as three columns of a fixed per-column entry count. This is a pure layout/rendering change — no key bindings are added, removed, or rebound, and no behaviour changes on any key.

## Scope

- `internal/tui/model.go` only. The sessions-page and projects-page render paths and their list-construction helpers (`newSessionList`, `newProjectList`, `viewSessionList`, `viewProjectList`) are the only surfaces that change.
- The relevant keymap entry sources are already present and remain unchanged in content: `sessionHelpKeys()` (model.go:518-529), `projectHelpKeys()` (model.go:563-574), `commandPendingHelpKeys()` (model.go:576-585), plus the navigation and filter-mode bindings that the built-in `list.Model.FullHelp()` contributes (CursorUp/CursorDown/NextPage/PrevPage/GoToStart/GoToEnd; Filter/ClearFilter/AcceptWhileFiltering/CancelWhileFiltering).
- The implementer chooses how to produce a fixed three-column layout. The natural shape is to leave `AdditionalFullHelpKeys` unset, set `l.SetShowHelp(false)`, and render the footer manually below the list view using `l.Help.FullHelpView([][]key.Binding{col1, col2, col3})` with the entry set flattened from the existing per-page binding sources (navigation, filter bindings, page-specific additional keys) and chunked evenly into three columns in their existing order. Per-list-page sizing must be adjusted so the rendered footer height is subtracted from the available list height (the built-in path used `lipgloss.Height(m.helpView())`; the manual path must do the equivalent).
- The fixed per-column entry count is a constant chosen during implementation — somewhere around five. It must not be dynamic. The third column being a little shorter than the other two when entries do not divide evenly is fine and expected.
- The same three-column layout applies to both the sessions list and the projects list so the two screens stay visually consistent. Both pages share the same fixed per-column constant.
- `commandPendingHelpKeys()` (projects-page command-pending mode) follows the same three-column rule mechanically; if there are fewer total entries than would fill the layout, short or empty trailing columns are fine — no behaviour change.

## Exclusions

- No changes to any key binding's key, description text, or runtime behaviour.
- No semantic grouping. Entries are split evenly across the three columns in their existing order.
- No changes to the projects-list pagination behaviour; the asymmetry the inbox note describes between the sessions list (typically one page) and the projects list (paginates) is not addressed here. (`README.md` aside.)
- No changes to the preview page's chrome line (`internal/tui/pagepreview.go`) or to any other page's footer/help rendering.
- No changes to `brightenHelpStyles`'s palette or to the `l.Help.Styles.*` fields beyond what is mechanically required to reach the manual footer renderer (the same styles must be preserved so the manual render looks identical to the current bar in colour and separator characters).

## Verification

- `go build -o portal .` succeeds.
- `go test ./...` passes. Existing TUI tests (`internal/tui/...`) — including help-bar/keymap-related tests in `pagepreview_keymap_constants_test.go`, `model_test.go`, and the flash/render tests — continue to pass without changes to the assertions, unless an assertion was pinned to the exact two-column output, in which case the assertion is updated to reflect three columns as part of this change. The `Update`-level keystroke handling tests are unaffected by definition (no behavioural change).
- Manual smoke check: launch `./portal`, observe the sessions-list footer rendering as three columns with a fixed per-column entry count, press `p` to swap to the projects list, observe the same three-column layout. Tab between filter mode and browse mode on both pages to confirm filter-mode bindings (which the built-in list path also renders in the help bar when filtering) still surface correctly within the new three-column layout.
