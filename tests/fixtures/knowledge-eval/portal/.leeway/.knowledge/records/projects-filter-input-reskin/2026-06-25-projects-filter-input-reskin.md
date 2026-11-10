# Reskin the Projects page live filter input to Modern Vivid

The Projects page's live filter input was never reskinned to Modern Vivid. When you press `/` on the Projects page, the input row that replaces the title (the `Filtering` / input-active state) still renders with the default `bubbles/list` styling — the old `Filter: ` prompt and default query/cursor colours — instead of the §7 MV treatment (accent.orange `/ ` prompt, orange query text, orange block cursor).

The cause is that `styleFilterInput()` in `internal/tui/model.go` (around line 1214) only restyles `m.sessionList.FilterInput`; it never touches `m.projectList.FilterInput`. The Sessions page therefore reads correctly while Projects shows the pre-reskin design.

The fix is to mirror the existing session-list restyle onto the project list's `FilterInput`: set its prompt to `filterPromptPrefix`, set `Focused.Prompt` and `Focused.Text` foreground to accent.orange, set `Cursor.Color` to orange with `Blink` off — and cover both the colourless (NO_COLOR) branch and the coloured branch exactly as the session list does.

Scope is contained to the input-active state only. The rest of the Projects filter path is already reskinned: the `FilterApplied` locked-query header goes through `renderFilterQueryHeader`, and the contextual filter footers go through `renderFilteringFooter` / `renderProjectsFilterAppliedFooter`. No test currently asserts the project filter input prompt, so coverage for the project `FilterInput` restyle would be net-new.
