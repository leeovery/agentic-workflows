# Specification: Projects Filter Input Reskin

## Change Description

The Projects page's live `/` filter input never received the Modern Vivid (§7) reskin. Pressing `/` on Projects shows the default `bubbles/list` `Filter: ` prompt with default query/cursor colours, whereas the Sessions filter carries the §7 treatment — an `accent.orange` `/ ` prompt, `accent.orange` query text, and an `accent.orange` block cursor. The cause is that `styleFilterInput()` in `internal/tui/model.go` restyles only `m.sessionList.FilterInput` and never touches `m.projectList.FilterInput`. This change mirrors the existing session-list restyle onto the project list's `FilterInput` so both pages read identically while filtering.

## Scope

- **`internal/tui/model.go`** — `styleFilterInput()` (currently ~line 1398, called from `applyCanvasMode()` at ~line 1309). Apply the identical restyle to `m.projectList.FilterInput` that it already applies to `m.sessionList.FilterInput`, covering **both** branches:
  - **Colourless (NO_COLOR) branch:** `Prompt = filterPromptPrefix`; `Focused.Prompt` and `Focused.Text` set to a bare `lipgloss.NewStyle()`; `Cursor.Color = lipgloss.NoColor{}`; `Cursor.Blink = false`.
  - **Coloured branch:** `Prompt = filterPromptPrefix`; `Focused.Prompt` and `Focused.Text` foreground set to `theme.MV.AccentOrange.ColorFor(m.canvasMode)`; `Cursor.Color = orange`; `Cursor.Blink = false`.

  The session and project `FilterInput` styling must be byte-identical (same prompt, same tokens, same blink-off, same NO_COLOR handling). The natural shape is to extract the per-`FilterInput` styling into a small helper applied to both lists so the two cannot drift; the implementer owns the exact factoring.

- **`internal/tui/` test file** — net-new coverage asserting the project `FilterInput` restyle in both the coloured (Dark/Light) and colourless branches, mirroring the existing session-list assertions in `filtering_reskin_test.go`. No test currently asserts the project filter input prompt, so this coverage is new.

## Exclusions

- **The rest of the Projects filter path**, which is already reskinned: the `FilterApplied` locked-query header (`renderFilterQueryHeader`) and the contextual filter footers (`renderFilteringFooter` / `renderProjectsFilterAppliedFooter`). Out of scope.
- **The Sessions filter input** — already correct; no change to its styling or existing assertions.
- **Filter behaviour / the filter engine** — no change to filtering logic, key bindings, the two-mode boundary (§7.1/§7.2), or the over-filtered empty state (§7.3). This is styling only.
- **The `filterPromptPrefix` constant and `theme.MV.AccentOrange` token** — reused as-is, not modified.

## Verification

- `go build -o portal .` succeeds.
- `go test ./internal/tui/...` passes — existing session-filter and Projects-page tests unchanged, plus the net-new project `FilterInput` restyle assertions.
- `go test ./...` passes — no cross-package regressions.
- The project `FilterInput` styling matches the session `FilterInput` styling byte-for-byte across both the coloured and NO_COLOR branches (prompt = `filterPromptPrefix`, `Focused.Prompt`/`Focused.Text` = accent.orange / bare, `Cursor.Color` = orange / `NoColor`, `Cursor.Blink` = false).
- Manual smoke (verified at review, not blocking implementation): launch `./portal`, press `x` to reach Projects, press `/` — the filter prompt renders as an accent.orange `/ ` with orange query text and an orange block cursor, matching the Sessions filter.
