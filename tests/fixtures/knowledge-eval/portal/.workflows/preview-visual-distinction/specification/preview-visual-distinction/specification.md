# Specification: Preview Visual Distinction

## Specification

## Overview

When the quick preview opens (Space on a session in the TUI) the scrollback body fills the screen and reads identically to a fully-attached session. There is no visual signal that the surface is read-only and transient. This feature adds a paint-by-Portal visual frame around the preview body so the page is unmistakably identifiable as preview, independent of what the session's own scrollback bytes are doing.

### Goal

A user pressing `Space` on a session lands on a page that is *obviously* a preview at a glance — not at second glance, not after reading the chrome line. Distinction is content-independent: it holds when the scrollback is plain prose, a `bat`-rendered file, a vim session, or a colourful prompt.

### Non-goals

- **Dimming the preview body.** Rejected during discussion — the failure mode is content-dependent (works on plain prompts, breaks on coloured scrollback, which is precisely the case preview is most useful for).
- **A separate "preview unavailable" surface for degenerate terminal sizes.** Vertical degradation is not handled; the frame renders whatever falls out at very small heights.
- **Context-aware styling** (different render inside-tmux vs bare shell). A single unified treatment applies in both contexts.
- **Surfacing the session name in chrome.** Identity is anchored by the Sessions-page selection that triggered preview; chrome is dynamic-only.
- **Touching `pageSessions` rendering, bootstrap warning flush, or any other page's view.** The frame lives only in `pagePreview`'s `View()`.

### Boundary with prior work

This builds on three already-shipped pieces:

- `session-scrollback-preview` (feature) — the `pagePreview` arm of the TUI page state machine, with a `bubbles/viewport` rendering raw scrollback bytes.
- `preview-keymap-discoverability` (quick-fix) — added action labels to the chrome keymap tokens and the `win:` prefix on the window-name segment.
- `enter-attaches-from-preview` (feature) — added the `Enter` binding and `enter attach` chrome token; established the dismiss-refresh path from preview back to Sessions.

Those specs are frozen historical records of what they shipped. This feature *replaces* the verbose keymap token strings they introduced (the new glyph form is captured here as its own decision); they are not retroactively edited.

## Visual treatment

The preview body is wrapped in a visible frame painted by Portal. The body's rendering (raw ANSI scrollback bytes via the embedded `bubbles/viewport`) is **not touched** — distinction comes from the enclosure, not from modifying what the session emitted.

### Frame structure

The frame consists of four edges around the viewport:

- **Top edge** — manually composed (`╭─{chrome content}{filler}─╮`). Carries the chrome line as part of the top border row. See *Top edge composition*.
- **Left edge / right edge / bottom edge** — rendered by `lipgloss` using its `RoundedBorder()` preset with `BorderForeground` set to the design colour.

The chrome line (window/pane indicators + keymap) lives **inside the top border row**, not above it. The frame surrounds the viewport directly; there is no chrome row above the frame.

### Border style

`lipgloss.RoundedBorder()` — matching the existing modal precedent at `internal/tui/modal.go:24`. Portal's implicit rule is "rounded border = contextual surface, no border = main page"; preview is a contextual surface and fits that rule. Geometry differentiates preview from modals — modals are small centred overlays, preview is a full-width framed page — so identical border characters cause no visual confusion.

The manually-composed top edge **must source its corner and edge characters from the chosen `lipgloss` border value** rather than hardcoding them, so a future style switch is a single-point edit.

### Border colour

`lipgloss.AdaptiveColor{Light: "#3B5577", Dark: "#7B95BD"}` — a single unified colour across inside-tmux and bare-shell contexts. Applied to all four edges (the three `lipgloss`-rendered edges plus the hand-composed top edge's border parts).

Both variants sit at mid-luminance with recognisable blue saturation. The light variant is dark enough to be visible against pale terminal backgrounds; the dark variant is light enough to be visible against dark backgrounds. Neither competes with Portal's existing accents (pink-magenta cursor `ANSI 212`, green attached badge `ANSI 76`) — different hue families. This introduces a third accent colour to Portal's palette, owned by preview chrome.

### Colour robustness

The frame's **enclosure is the load-bearing distinction signal**. The blue tint is enhancement, and is allowed to degrade:

- **`NO_COLOR=1`** — `lipgloss`/`termenv` respects the convention and renders the border in default foreground. Blue is dropped; the frame remains visible. Distinction signal is preserved.
- **8/16-colour terminals or `TERM=dumb`** — `lipgloss`/`termenv` automatically downgrades the hex tones to the nearest palette colour. Design intent is approximated, not lost.
- **Truecolor terminals** — rendered as specified.

No explicit Portal handling is required beyond what `lipgloss`/`termenv` already provides. The hex values are not hard requirements at the implementation layer — they are the design target.

## Chrome line content

The chrome line is the metadata strip that rides on the frame's top edge. It is *dynamic-only* — it describes what changes as the user navigates within preview, not what was established by opening preview. Session name is **not surfaced**; identity is anchored by the Sessions-page selection that triggered preview-open.

### Segments (left to right)

1. **Window indicator** — `Window M of N` (`M = m.windowIdx + 1`, `N = len(m.groups)`)
2. **Pane indicator** — `Pane X of Y` (`X = m.paneIdx + 1`, `Y = len(m.currentGroup().Panes)`)
3. **Window name** — `win: {name}` (sourced from `m.currentGroup().WindowName` — `currentGroup()` returns `m.groups[m.windowIdx]`, a `tmux.WindowGroup`)
4. **Keymap** — see *Keymap glyphs* below

Segments 1–3 are joined by `·` (middle dot, U+00B7) with spaces on either side. The keymap is separated from the preceding segments by whitespace padding so it visually right-aligns within the available chrome budget at wide widths and compresses toward the centre at narrow widths.

### Keymap glyphs

Verbose word tokens (`tab`, `enter`, `esc`) are replaced with macOS-convention keyboard glyphs. The bracket keys (`]` / `[`) stay as ASCII because they are literally the characters the user presses — no glyph is more accurate.

| Key   | Glyph | Codepoint |
|-------|-------|-----------|
| `]`   | `]`   | ASCII     |
| `[`   | `[`   | ASCII     |
| Tab   | `⇥`   | U+21E5    |
| Enter | `⏎`   | U+23CE    |
| Esc   | `⎋`   | U+238B    |

### Verbose form (default at typical widths)

```
] next win · [ prev win · ⇥ next pane · ⏎ attach · ⎋ back
```

### Compact form (cascade tier 3)

```
] [ ⇥ ⏎ ⎋
```

Compact uses **single-space separators** (no interpunct) — the entire point of tier 3 is character compression, and replacing the 4 separators saves 8 cells. Display-cell width of the compact form is **9 cells**.

**Token order matches across forms** — `] [ tab enter esc` left-to-right in both — so a user resizing the terminal sees the same sequence of keys, just with action labels added or removed.

### Constants

The two forms are baked into `internal/tui/pagepreview.go` as exported-or-package-level constants:

```go
const (
    verboseKeymap = "] next win · [ prev win · ⇥ next pane · ⏎ attach · ⎋ back"
    compactKeymap = "] [ ⇥ ⏎ ⎋"
)
```

Tests assert against these exact bytes.

### Font fallback

`⇥` and `⏎` are present in essentially every modern monospace font. `⎋` (U+238B) is the weakest link — present in SF Mono, Menlo, JetBrains Mono, Fira Code, Cascadia, and most modern terminal-targeted fonts. A user on an old terminal with a font lacking that codepoint sees a fallback box glyph. Acceptable degradation: bracket keys still render, the frame still delivers the "this is preview" signal, and the keys still work.

### Scope note on touching the verbose form

Replacing the word tokens with glyphs modifies what `preview-keymap-discoverability` and `enter-attaches-from-preview` shipped. Those prior specs remain accurate as records of what *they* shipped at the time; this feature's spec captures the new glyph form as its own decision.

## Width cascade

Terminal widths and window names vary unboundedly; chrome content that overflows the available top-edge budget would either clip the right corner or wrap to a second visual row, breaking the entire frame (the bottom corner would shift down by one row). The cascade is the mechanism that guarantees the top edge is always exactly one row, at any width ≥ 2.

### Unit of measure

`composeChromeLine`'s `width` parameter is the **inner frame width** in display cells — i.e. `terminalWidth − 2`, the same value passed to `viewport.SetSize`. It excludes the left and right border columns (`╭`, `╮`) that `lipgloss` owns on the rendered output. The function returns the **complete top-edge row** including those corner glyphs, so the returned string has display-cell width `width + 2` (the outer terminal width) when `width ≥ 0`.

Each cascade tier produces a candidate row, measures it via `lipgloss.Width`, and returns the candidate when its width equals `width + 2`. Otherwise it falls through to the next tier.

### Algorithm shape: predicate-over-output

The four-tier cascade is **not** a stack of incremental transformations. Each tier produces a *candidate output*, measures it via `lipgloss.Width`, and returns the candidate if it fits. Otherwise it falls through to the next tier.

```
tier 1: compose with name truncated to fit + verbose keymap   → measure → if fits, return
tier 2: compose with name segment dropped  + verbose keymap   → measure → if fits, return
tier 3: compose with name segment dropped  + compact keymap   → measure → if fits, return
tier 4: corners + filler `─` (no chrome content)              → always fits any width ≥ 2 → return
```

Tier interactions:

- Tiers 1 and 2 are mutually exclusive — if tier 1's truncated name fits, tier 2 isn't reached; if tier 2 drops the segment, tier 1's work is discarded.
- Tiers 2 and 3 differ only in keymap form — tier 3 strictly compresses tier 2 further by swapping the verbose keymap for the compact one.
- Tier 4 supersedes whatever was attempted before.

### Tier-by-tier behaviour

**Tier 1 — truncate window name with `…` suffix.** When the budget for the window name segment is positive but smaller than the full name, the name is truncated to fit and a `…` (U+2026, 1 cell wide) suffix appended.

**Tier 2 — drop the `· win: {name}` segment entirely.** Reached when the budget remaining for the window name string after the cascade math is below a fixed minimum of **8 display cells** (`const minWindowNameCells = 8`). Below that minimum the truncation reads as garbage rather than as a recognisable name. The whole `· win: {name}` interpunct-prefixed segment is removed, not just the name string. Tests assert tier-2 entry exactly at the integer boundary.

**Tier 3 — swap verbose keymap for compact form.** Reached when even with the window name segment dropped the verbose keymap still overflows. Saves ≈73 cells (verbose form is 82 cells, compact is 9). Action labels are not permanently lost from the product — once the user has seen the verbose chrome at wider widths, the keys-only form reads as a recognised compression rather than a fresh-eyes puzzle.

**Tier 4 — drop chrome entirely; render corners + filler.** A degenerate-terminal fallback (sub-40-col terminals, almost no real user terminal hits this). The top edge becomes `╭{─ × width}╮` (corners + `width` filler cells = `width + 2` total). Always fits at every `width ≥ 0` (terminal width ≥ 2).

### Load-bearing tier 4

Tier 4 is **load-bearing** — it is what guarantees the top edge always renders cleanly down to width 2 (the two corner glyphs). Without it, terminal widths narrow enough to fail tier 3 would either clip the chrome or wrap it to a second visual row, and wrapping in particular breaks the frame because the bottom corner shifts down by one row, destroying the visual integrity the cascade exists to protect. Tier 4 is rarely reached in practice, but its existence is what lets the cascade make a strong guarantee.

### Defending against pathological window names

A side benefit of the cascade: pathological window names — long file paths surfaced by vim, e.g. — no longer break rendering regardless of terminal width. The truncation-then-drop path applies the same regardless of whether the budget pressure came from the terminal being narrow or the name being long.

### Pure function

The cascade is implemented as a pure function:

```go
func composeChromeLine(width, windowIdx, windowCount, paneIdx, paneCount int, windowName string) string
```

Located in `internal/tui/pagepreview.go`. No I/O. Parameters:

- `width` — inner frame width (`terminalWidth − 2`).
- `windowIdx` / `windowCount` — values for the `Window M of N` segment (`M = windowIdx + 1`).
- `paneIdx` / `paneCount` — values for the `Pane X of Y` segment (`X = paneIdx + 1`).
- `windowName` — UTF-8 window name for the `win: {name}` segment (cascade tier 1 truncates this; tier 2 drops the segment).

Returns the **complete top-edge row** including corner glyphs — display-cell width is `width + 2` for `width ≥ 0`, and the empty string for `width < 0`. Width measurements use `lipgloss.Width`. Tested exhaustively at the cascade thresholds with table-driven cases.

## Display-cell-aware truncation

Tier 1 of the cascade ("truncate window name with `…` suffix") and the ~8-cell minimum in tier 2 are specified in **display cells**, not bytes or runes. Window names are arbitrary UTF-8 — tmux allows CJK, emoji, combining marks, and double-width glyphs. Naïve byte-slicing (`s[:n]`) can land mid-rune and produce invalid UTF-8 in the top border. Naïve rune-counting overcounts: a string of CJK glyphs is 1 rune per 2 cells, so "n runes" can be 2× the visual budget.

### Algorithm

Iterate codepoint by codepoint, accumulating `runewidth.RuneWidth(r)` (or equivalently `lipgloss.Width` of single-rune strings — `lipgloss` uses `go-runewidth` underneath). Stop when adding the next rune would exceed `budget − 1` (reserving 1 cell for the `…` suffix). Append `…` (1 cell wide).

### Where it applies

The display-cell primitive is the **same primitive** used wherever the cascade truncates anything — currently the window name, but the rule is the unit of measure, not the field. Any future truncation in this codepath uses the same primitive.

### Test coverage

Table-driven with at least these glyph classes:

- ASCII (1 cell per rune)
- CJK (2 cells per rune)
- Emoji (2 cells per rune, including ZWJ sequences)
- Combining marks (0 cells per combining rune; base+combiner = base's width)

Asserts:

- No mid-rune cuts (output is valid UTF-8).
- Final display-cell width ≤ budget.
- `…` is appended only when truncation actually occurred (full-string-fits case returns the original string).

## Top edge composition

The frame's top edge is composed manually in `pagePreview`'s `View()` rather than via a `lipgloss` primitive (there is no first-class label-in-border primitive in `lipgloss`).

### Column layout

The column layout below uses `width` for the **outer terminal width**. `composeChromeLine`'s `width` parameter is the *inner* frame width (`terminalWidth − 2`); the function returns the complete top-edge row at the outer width.

For a given outer terminal width `width` and a `chromeWidth = lipgloss.Width(chromeContent)`:

- Column `0`: `╭` (left corner — sourced from `lipgloss.RoundedBorder()`)
- Column `1`: `─` (one-cell padding after left corner)
- Columns `2` through `2 + chromeWidth − 1`: chrome content (display-cell width = `chromeWidth`)
- Columns `2 + chromeWidth` through `width − 3`: `─` filler (any remaining cells)
- Column `width − 2`: `─` (one-cell padding before right corner)
- Column `width − 1`: `╮` (right corner)

The right corner is pinned at `width − 1` regardless of chrome length.

### Tier 4 (no chrome content)

At tier 4 the entire middle range `[2, width − 3]` is `─` filler. The top edge becomes `╭{─ × (width − 2)}╮`.

### Degenerate widths

The cascade returns gracefully at every width ≥ 2:

- width 2: `╭╮` (corners only, no padding, no filler)
- width 3: `╭─╮`
- width 4: `╭──╮`

All such tiny widths fall into tier 4 behaviour automatically because there is no room for chrome content under any tier.

### Width below threshold

`composeChromeLine` returns the **empty string** for `width < 0` (terminal width < 2). The frame composition in `View()` calls `lipgloss` bordering with whatever width the model holds; `lipgloss` handles widths it cannot render by clipping (its own behaviour). Consistent with the "no special vertical handling" stance — terminal widths 0 and 1 are degenerate, render whatever falls out, no error path, no panic.

### Color application

`lipgloss`'s `BorderForeground(color)` colours only the border characters that `lipgloss` renders (left edge, right edge, bottom edge). The hand-composed top edge needs the same colour applied — otherwise three edges would render in the design blue and the top edge in default foreground.

The top edge is composed as **two stylings concatenated**:

- **Border parts** — corner glyphs, the `─` padding cells, and the `─` filler. Wrapped in `lipgloss.NewStyle().Foreground(adaptiveBlue).Render(…)` so they pick up the design colour.
- **Chrome content** — rendered with no explicit foreground, inheriting terminal default. Chrome reads as legible terminal text against the blue-bordered surround. This matches the convention used elsewhere in the TUI for label-style strips.

Final assembly at the `View()` call site, conceptually:

```
styledBorder("╭─") + chromeContent + styledBorder(filler + "─╮")
```

where `styledBorder := lipgloss.NewStyle().Foreground(previewBorderColor).Render` (see *Style sourcing* for the constant definition).

**Implication for `composeChromeLine`'s purity**: the function returns the *unstyled* chrome content string. Top-edge styling — border parts coloured, chrome parts default — happens at the call site in `View()` where the final composition assembles. This keeps `composeChromeLine` pure and testable purely on content output, independent of colour rendering.

## SGR reset injection

The embedded `bubbles/viewport` renders raw ANSI bytes from scrollback as straight passthrough (per the prior `session-scrollback-preview` spec). A scrollback line can legitimately end with an unterminated SGR sequence — for example, a `bat`-rendered file whose last visible line set a background colour and the buffer ended before issuing a reset. With the new frame, an unterminated SGR sits in the cell adjacent to the right border on that row.

**Concrete risk**: the terminal is in "set bg=red" state when `lipgloss` emits the right border character. `lipgloss`'s `BorderForeground` emits its own SGR for the border foreground colour but does not reliably reset background state. The border character could render with the design blue foreground over an unwanted red background — coloured squares where the border should be.

### Rule

Inject `\x1b[0m` (SGR reset) at the **end of every non-empty viewport row** before composing with the frame. Per-line, not just at end-of-buffer — each line carries unterminated SGR independently.

### Algorithm

When wrapping `viewport.View()` output for the frame composition:

1. Split on `\n`.
2. For each line where `len(line) > 0`, append `\x1b[0m`.
3. Join back with `\n`.
4. Pass the joined string into the frame composition.

Reference implementation:

```go
func injectSGRResets(s string) string {
    lines := strings.Split(s, "\n")
    for i, line := range lines {
        if len(line) > 0 {
            lines[i] = line + "\x1b[0m"
        }
    }
    return strings.Join(lines, "\n")
}
```

### Edge cases

1. **Trailing newline.** If `viewport.View()` ends with `\n`, splitting yields an empty trailing element. The empty element is **ignored** — no reset appended. The bottom border is rendered by `lipgloss` with its own SGR; a trailing empty line carrying or not carrying a reset is immaterial.
2. **"Non-empty" definition.** Byte-length > 0. A line of literal spaces with an embedded SGR is non-empty and gets a reset; the rule does not try to distinguish whitespace-only from visible content.
3. **Idempotency.** Terminals treat `\x1b[0m\x1b[0m` as a single reset. No deduplication logic — if the content already ended with a reset, double-resetting is harmless. Tests include a fixture line that already ends in `\x1b[0m` to confirm rendering does not degrade.

### Placement relative to lipgloss border emission

The injected reset goes at end-of-row of viewport content, **before** `lipgloss` composes the border. On a composed row the byte sequence is:

```
[lipgloss left-border SGR][│][reset][content with injected reset at row-end][lipgloss right-border SGR][│][reset]
```

`lipgloss` uses `go-runewidth` + `termenv` for ANSI-aware measurement — both preserve SGR codes when measuring width (they count cells, not bytes). The injected reset survives into the final composed string. No further placement consideration is needed; the cascade-tier end-to-end test asserts this in practice (see *Tests*).

### Scope of coverage

The SGR-reset injection covers **every render**, so rows scrolling into view are also protected — viewport scroll is just a model-state change inside `bubbles/viewport` that re-routes through Update → View on the same tick, and the frame wraps the latest rendered output.

## Resize behaviour

Bubble Tea emits one `tea.WindowSizeMsg` per terminal-resize signal. Dragging a terminal corner produces a stream of them. Each goes through `Update → View`.

**Rule: repaint every tick, no debounce.** Preview's resize handler in `pagepreview.go`'s `Update` does two things on each `tea.WindowSizeMsg`:

1. Record the new dimensions on the model (`m.width`, `m.height`).
2. Call `m.viewport.SetSize(max(0, msg.Width − 2), max(0, msg.Height − 2))` to adjust the viewport's visible window for the new inner dimensions (subtracting 2 for left+right border columns and top+bottom border rows). The `max(0, …)` clamps guard against the degenerate case where `msg.Width` or `msg.Height` is 0 or 1 — `viewport.SetSize` with negative arguments is unspecified, so the clamp is mandatory at every call site.

`View()` then **recomputes the chrome line every tick** via `composeChromeLine(m.width − 2, m.windowIdx, len(m.groups), m.paneIdx, len(m.currentGroup().Panes), m.currentGroup().WindowName)` and composes the frame. No cached chrome field — recomputing per tick is cheap (pure function, no I/O), and this avoids the alternative of having to invalidate a cache from every navigation key handler (`]`, `[`, `⇥`) in addition to the resize handler. The single per-tick recompute covers resize, window/pane navigation, and any other model state change that affects chrome content with no per-handler bookkeeping.

`composeChromeLine` is a pure function with no I/O. `viewport.SetSize` does not reallocate content — it adjusts the visible window over an immutable buffer. Preview's structural enumeration is captured at preview-open and is **not** re-fetched on resize. The per-tick cost is small; debouncing would only hurt (dropped frames would make chrome visibly lag resize, and timer state would add complexity for a problem that doesn't exist). Bubble Tea's runtime already coalesces redundant `View()` calls at the framerate level.

The build phase has one explicit obligation: implement the `tea.WindowSizeMsg` case in preview's `Update` (record dimensions + `viewport.SetSize`). No special-casing for rapid resize streams.

## Initial sizing and preview-open ordering

The parent Bubble Tea model in `internal/tui/model.go` holds current terminal dimensions on `m.termWidth` / `m.termHeight` from program-start (its own `tea.WindowSizeMsg` handler records them). When the user presses `Space` on the Sessions page, `NewPreviewModel` is constructed at `model.go:1421`, where the parent's tracked dimensions are passed in.

**Rule**: `NewPreviewModel(…, width, height int)` already accepts `width` and `height` as constructor parameters (`pagepreview.go:74`); the call site at `model.go:1421` already passes `m.termWidth, m.termHeight`. No new plumbing. Inside the constructor:

- The dimensions are stored on the model (`m.width`, `m.height`).
- `viewport.SetSize(max(0, width − 2), max(0, height − 2))` is called once with initial dimensions (same `max(0, …)` clamp as the resize handler).

`View()` recomputes the chrome line on every tick (see *Resize behaviour*), so no separate pre-computation is needed at construction time. The first `View()` call on the freshly-constructed `previewModel` renders with correct dimensions — no race between preview-open and the first `WindowSizeMsg`, no "first frame at zero width" edge case. Subsequent `tea.WindowSizeMsg` updates apply via the resize handler.

## Scroll redraw

Bubble Tea has no partial-screen redraw mechanism — every `Update` tick re-renders the full `View()`. Viewport scroll is a model-state change inside `bubbles/viewport` (its visible-window offset), routed through `Update` and re-rendered via `viewport.View()` on the same tick.

**Rule: no special scroll handling.** The frame is composed in `pagepreview.go`'s `View()` once per tick around whatever `viewport.View()` currently shows. Scroll is owned entirely by viewport's existing behaviour; the frame wraps the latest rendered output. The SGR-reset injection covers every render, so rows scrolling into view are also protected.

## Integration with page state machine

The frame lives only in `pagePreview`'s `View()`. `pageSessions`'s `View()` has no frame. No other page is touched.

### Bootstrap warning flush

Preview is unreachable from the Loading page. Bootstrap's warning flush happens at loading-page dismiss with alt-screen toggling to avoid corrupting the rendered UI. The Sessions page renders only after bootstrap completes and any warnings are flushed. Preview is reached via `Space` on the Sessions page — by the time the user can press `Space`, bootstrap is fully done.

**Rule: no interaction with bootstrap, no special handling.**

### Filter-then-preview transition

- **Entry transition (Sessions → Preview via `Space`)**: preview's `View()` renders the frame for the first time on that tick. Bubble Tea repaints the full screen on every tick anyway, so there is no flicker — the frame's appearance is the visual signature of the page change.
- **Exit transition (Preview → Sessions via `Esc`)**: the existing dismiss-refresh path from `enter-attaches-from-preview` is unchanged. `pageSessions`'s `View()` simply does not render a frame. The sessions-list refresh on dismiss continues to be dispatched as before.

**Rule: no new flicker, no special transition handling.** The frame's presence in `pagePreview`'s `View()` and absence in `pageSessions`'s `View()` is the natural shape of the page state machine and needs no further plumbing.

## Vertical degradation

The cascade addresses horizontal width. Vertical is intentionally not handled. The frame costs 2 rows (top edge + bottom edge). On an 8-row terminal the viewport gets 5 rows; on a 5-row terminal it gets 2; below that, effectively nothing.

**Rule: render anyway. No vertical threshold, no row-budget-aware degradation, no refusal-to-open flash.**

Unlike narrow terminals and long window names (realistic and common — multi-pane tmux splits, side-by-side terminal layouts), terminals tall enough to break preview but short enough to not be obviously unusable are a degenerate case nobody hits accidentally. Recovery is to press `Esc`, resize, and retry.

## Code shape changes

The build phase touches `internal/tui/pagepreview.go` and the Sessions page's preview-open call site. Specific edits below.

### Replace `chromeLine()` with `composeChromeLine`

The existing `chromeLine()` method on `previewModel` at `internal/tui/pagepreview.go:165-175` is **deleted**. Callers in `View()` invoke the new pure function `composeChromeLine(width int, …) string` directly with the current width and the relevant model fields. The pure-function signature is the testable boundary; a thin method wrapper would add an indirection without value.

### Rename `previewChromeHeight` → `previewFrameOverhead = 2`

The existing `const previewChromeHeight = 1` becomes outdated under the new model (chrome no longer sits above the viewport — it shares the top border row). Rename to `previewFrameOverhead = 2` with the comment `"top border (carrying chrome) + bottom border = 2 rows of frame overhead"`.

This names the magic 2 used in the resize math (`SetSize(msg.Width − 2, msg.Height − 2)`), preserves the file-local convention of naming chrome dimensions, and gives a single edit point if the frame's vertical geometry ever changes.

The constant is package-internal to `internal/tui`. The rename must also update existing references in sibling test files: `pagepreview_layout_test.go`, `pagepreview_precedence_test.go`, `pagepreview_scroll_test.go` (test files reference the constant in their viewport-height assertions; those assertions also need their arithmetic updated from `msg.Height − previewChromeHeight` to `msg.Height − previewFrameOverhead` since the magic value changes from 1 to 2). No references outside the `internal/tui` package.

### `NewPreviewModel` signature change

`NewPreviewModel` already accepts `width` and `height` as constructor parameters today (`internal/tui/pagepreview.go:74`). The parent Bubble Tea model in `internal/tui/model.go` tracks the current terminal dimensions on `m.termWidth` / `m.termHeight` (already plumbed via its own `tea.WindowSizeMsg` handler) and passes them at the preview-open call site (`model.go:1421`). **No new plumbing is required** in the Sessions-page model or its `Update` handler — the dimensions are already available where `NewPreviewModel` is called.

### Chrome-row invariant for resize math

`m.viewport.SetSize(msg.Width − 2, msg.Height − 2)` assumes top edge = 1 row, bottom edge = 1 row. The cascade guarantees a one-row top edge at any width ≥ 2 (tier 4 produces `╭{─ × (width − 2)}╮`, all on one row). Below width 2 the system is degenerate anyway.

Capture the invariant explicitly:

- `composeChromeLine`'s doc comment: *"Returns a single-line string with no embedded newlines. The cascade guarantees one-row output for all widths ≥ 2; below that, returns the empty string."*
- `previewFrameOverhead` comment: as above.
- A test that asserts `strings.Count(composeChromeLine(w, …), "\n") == 0` across the cascade-tier width thresholds.

### Style sourcing

Corner and edge characters used in the manually-composed top edge are **sourced from the chosen `lipgloss` border value** (`lipgloss.RoundedBorder()`) rather than hardcoded — a future border-style switch is then a one-line change.

The `AdaptiveColor` defining the border foreground is declared as a package-level constant in `internal/tui/pagepreview.go`:

```go
var previewBorderColor = lipgloss.AdaptiveColor{Light: "#3B5577", Dark: "#7B95BD"}
```

Used in both the `lipgloss` border styling on the three rendered edges (via `BorderForeground(previewBorderColor)`) and the `lipgloss.NewStyle().Foreground(previewBorderColor)` wrapper on the hand-composed top edge's border parts. The name `previewBorderColor` is preferred over `adaptiveBlue` to keep the variable's *role* (border colour for the preview frame) front-and-centre rather than its current *hue*, so a future hue change does not produce a misleading identifier.

### File scope summary

| File / location                                                    | Change                                                       |
|--------------------------------------------------------------------|--------------------------------------------------------------|
| `internal/tui/pagepreview.go` (chromeLine method)                  | Delete; replaced by `composeChromeLine` pure function        |
| `internal/tui/pagepreview.go` (previewChromeHeight const)          | Rename to `previewFrameOverhead = 2`; update comment         |
| `internal/tui/pagepreview.go` (Update — `tea.WindowSizeMsg` case)  | Add `viewport.SetSize(W−2, H−2)` + chrome recompute          |
| `internal/tui/pagepreview.go` (View)                               | Pass `viewport.View()` output through `injectSGRResets`, compose top edge manually, wrap with `lipgloss` frame using `previewBorderColor` |
| `internal/tui/pagepreview.go` (NewPreviewModel)                    | Accept `width, height int`; initialise viewport + chrome     |
| `internal/tui/pagepreview.go` (keymap constants)                   | Add `verboseKeymap` / `compactKeymap` constants              |
| `internal/tui/pagepreview.go` (SGR injector)                       | Add `injectSGRResets` helper                                 |
| `internal/tui/pagepreview.go` (adaptive color)                     | Add `var previewBorderColor = lipgloss.AdaptiveColor{…}`     |
| `internal/tui/model.go:1421` (preview-open call site)              | No change required — already passes `m.termWidth, m.termHeight` to `NewPreviewModel` |

No production files outside `internal/tui/pagepreview.go` and `internal/tui/model.go` are touched. The `previewChromeHeight` → `previewFrameOverhead` rename additionally updates references in `pagepreview_layout_test.go`, `pagepreview_precedence_test.go`, and `pagepreview_scroll_test.go` (test files only; arithmetic on those assertions also updates because the constant value changes from 1 to 2).

## Tests

Five testable surfaces. All five are pure-function unit tests or `Update + View` integration tests with the existing `previewModel` mock seams (`TmuxEnumerator`, `ScrollbackReader`). **No golden / snapshot files. No real-tmux integration test.** Pure-function tests cover the substantive logic exhaustively at minimal cost; `Update + View` with mocked seams matches the existing project convention from `session-scrollback-preview`.

### Surface 1 — `composeChromeLine(width, …)` pure function

Table-driven cases at each cascade threshold:

- **Window name fits** (wide width) — full window name present, verbose keymap.
- **Window name truncates** — `…` suffix present, verbose keymap, no mid-rune cuts.
- **Window name dropped (tier 2)** — `· win: …` segment absent, verbose keymap.
- **Keymap compacted (tier 3)** — `· win: …` absent, compact form `] [ ⇥ ⏎ ⎋` present.
- **Chrome dropped (tier 4)** — output is corners + `─` filler only.

### Surface 2 — Display-cell truncation primitive

Table-driven cases with at least:

- ASCII (1 cell per rune)
- CJK glyphs (2 cells per rune)
- Emoji (including ZWJ sequences, 2 cells per rune)
- Combining marks (0-cell continuers)

Asserts: no mid-rune cuts, final display-cell width ≤ budget, `…` appended only when truncation actually occurred.

### Surface 3 — SGR reset injection

Fixture lines containing unterminated SGR sequences. Asserts each non-empty line in the output ends with `\x1b[0m`. Includes:

- Line ending in `set bg=red` SGR — gets reset appended.
- Line ending in `\x1b[0m` already — gets a second reset appended (idempotency confirmed harmless).
- Empty line — no reset appended.
- Whitespace-only line with embedded SGR — non-empty, gets reset.
- Trailing-newline input — trailing empty element ignored.

### Surface 4 — Resize handling

`Update(tea.WindowSizeMsg{Width, Height})` on a `previewModel` constructed with mock `TmuxEnumerator` / `ScrollbackReader`. Asserts:

- `viewport.SetSize` was called with `Width − 2, Height − 2`.
- The chrome line was recomputed for the new inner width.

### Surface 5 — Frame composition end-to-end

`Update + View` on `previewModel` with mocks. Asserts the rendered `View()` output contains:

- The rounded corner glyphs (`╭`, `╮`, `╰`, `╯`).
- The chrome content on the top edge.
- The SGR reset bytes on viewport content rows.

Extended with a **table-driven cascade-tier sub-test** that drives the full `Update → View` pipeline across cascade tiers, not just the pure-function thresholds:

Procedure:

- Construct `previewModel` with mock `TmuxEnumerator` + `ScrollbackReader` and the fixed fixture: 1 window, 1 pane, **window name `"nvim-editor"` (11 ASCII chars, 11 display cells)**. This fixture is long enough to truncate (tier 1) and clearly distinguishable from being dropped (tier 2) — but short enough to fit fully at width 200.
- For each width in the cascade-threshold table, dispatch `Update(tea.WindowSizeMsg{Width: w, Height: 30})`, then call `View()`.
- Assert the rendered output contains the expected tier signature.

The realised cascade math (using `lipgloss.Width(verboseKeymap) == 57`) yields tier intervals: tier 1 full at outer ≥ 108; tier 1 truncated at outer ∈ [105, 107]; tier 2 at outer ∈ [89, 104]; tier 3 at outer ∈ [41, 88]; tier 4 at outer ∈ [2, 40]. Picked widths are interior to each interval to avoid fragility:

| Width | Expected signature                                              |
|-------|-----------------------------------------------------------------|
| 200   | Full window name `nvim-editor` + verbose keymap (`⇥ next pane`) |
| 105   | Window name truncated with `…` suffix (`nvim-ed…`); verbose keymap |
| 95    | No `win:` segment (tier 2 dropped); verbose keymap              |
| 50    | No `win:`; compact keymap `] [ ⇥ ⏎ ⎋`                           |
| 15    | Top edge is `╭{─ × 13}╮` (tier 4: corners + filler, no chrome)  |

- Assert SGR reset bytes are present on each viewport content row in every case.

This ties the pure-function cascade thresholds (surface 1) to the actual rendered frame, catching regressions where `composeChromeLine`'s output and the `View()` composition could drift apart.

### Chrome-row invariant test

A focused assertion that `strings.Count(composeChromeLine(w, …), "\n") == 0` across the cascade-tier width thresholds. Guards the assumption baked into `m.viewport.SetSize(msg.Width − 2, msg.Height − 2)` that the top edge is always exactly one row.

### Test conventions

- No `t.Parallel()` (matches the cmd-package convention noted in CLAUDE.md, applied here because preview's mocks are constructor-injected — even though parallel would technically be safe, project convention dictates serial).
- No `tmuxtest` imports — preview tests must not depend on a real tmux server.
- Tests assert against the `verboseKeymap` / `compactKeymap` constants by literal byte content.

---

## Working Notes
