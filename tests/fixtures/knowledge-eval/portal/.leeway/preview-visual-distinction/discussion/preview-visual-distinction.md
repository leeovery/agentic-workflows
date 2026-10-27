# Discussion: Preview Visual Distinction

## Context

When the quick preview opens (Space on a session in the TUI), it visually looks indistinguishable from a fully-attached session. The scrollback body fills the screen and reads identically to the attached state — there is no signal that this is a read-only, transient preview. Users need to be able to tell instantly that they are in preview mode and not actually inside the session.

### What already exists

Preview already has a **single-line chrome strip** at the top of the page (`internal/tui/pagepreview.go` → `chromeLine()`), rendered above the embedded `bubbles/viewport`. Today it reads:

`window M of N · pane X of Y · win:{name} · ] next win · [ prev win · tab next pane · enter attach · esc back`

This was iterated up by two completed pieces of work:

- `preview-keymap-discoverability` (quick-fix, 2026-05-14) — annotated bare key tokens with short action labels and added the `win:` prefix on the window name so it is not mistaken for a stray number.
- `enter-attaches-from-preview` (feature, 2026-05-15) — added the `enter attach` token to the chrome and the `Enter` binding behind it.

So discoverability of the *keymap* is already handled. The remaining gap — what this discussion is about — is the **body** of the preview: the scrollback content underneath the chrome line still looks identical to an attached session.

### The seed proposals

Two directions were sketched in the inbox:

1. **Dim the preview body** — render the scrollback text at reduced contrast / lower opacity so it reads as inactive. Cheap, minimal layout change, no screen real estate cost beyond the existing chrome line.
2. **Bordered chrome around the preview body** — wrap the viewport content in a visible frame, with the existing chrome line living inside the frame's header. More explicit; takes screen real estate.

A combination is also possible (subtle border + slightly dimmed body). The goal is "obviously a preview" — not maximally decorated.

### Relevant code surface

- `internal/tui/pagepreview.go` — `pagePreview` arm of the page state machine, peer of `pageFileBrowser`. Owns a `bubbles/viewport` and the chrome line.
- `internal/tui/previewmodel` (constructor-injected with `TmuxEnumerator` + `ScrollbackReader` seams).
- Dimming would live in the lipgloss styling layer applied to the viewport content (or via the viewport's `Style` field).
- Chrome wrapping would mean introducing an outer layout wrapper around the viewport (likely via `lipgloss.NewStyle().Border(...).Render(...)` around the composed top-chrome + viewport block).

### Related work not in scope

- `general-tui-flash-infrastructure` (inbox idea, 2026-05-14) — a project-wide flash/toast primitive deferred from `enter-attaches-from-preview`. Orthogonal — not about visual identity of the preview surface.
- `tui-redesign` (cancelled feature) — earlier broader visual reskin of the TUI; orthogonal, intentionally not revived.

### References

- Inbox seed: `.workflows/.inbox/.archived/ideas/2026-05-15--preview-visual-distinction.md`
- Completed quick-fix: `.workflows/preview-keymap-discoverability/`
- Completed feature: `.workflows/session-scrollback-preview/` (the feature this builds on)
- Completed feature: `.workflows/enter-attaches-from-preview/`

## Discussion Map

### States

- **pending** — identified but not yet explored
- **exploring** — actively being discussed
- **converging** — narrowing toward a decision
- **decided** — decision reached with rationale documented

### Map

  Visual treatment approach [decided] → border-only
  ├─ Dim-only [decided] → rejected
  ├─ Border-only [decided] → chosen
  └─ Combination [decided] → rejected

  Border composition [decided]
  ├─ Chrome line: inside header vs above frame [decided] → top header
  ├─ Width cascade / truncation [decided] → cascading degradation
  ├─ Border style [decided] → RoundedBorder (matches modal)
  └─ Border color [decided] → AdaptiveColor deeper saturated blue, single unified

  Session name visibility [decided] → not surfaced

  Rendering integrity [decided] (surfaced in review-001)
  ├─ Resize repaint [decided] → repaint every tick, no debounce
  ├─ ANSI bleed protection [decided] → inject SGR reset per row
  ├─ Scroll redraw [decided] → no special handling
  └─ Integration with page state (bootstrap, filter-then-preview) [decided] → no special handling

  Test strategy [decided] → pure-function unit + Update/View integration; no snapshots

---

*Subtopics are documented below as they reach `decided` or accumulate enough exploration to capture.*

---

## Visual treatment approach

### Context

Preview's chrome line is a single row at the top. Underneath, the embedded `bubbles/viewport` renders raw scrollback bytes (ANSI passthrough). The body has no styling of our own — whatever colors and SGR sequences the session emitted are rendered verbatim. The question is what signal we add on top of that to make the page unambiguously read as "preview, not attached."

### Options Considered

**Dim-only — render the scrollback at reduced contrast.**
- Pros: zero screen-real-estate cost beyond the existing chrome line; minimal change to the layout; subtle.
- Cons: ANSI scrollback is already colored (vim, bat, git diffs, prompts). Reliably dimming a colored payload is harder than dimming plain text — naïve wrapper styles (e.g. lipgloss `Faint(true)` applied around the viewport) interact unpredictably with the embedded SGR sequences the viewport prints verbatim. Failure mode shows up months later on a specific user colorscheme. The fade is content-dependent rather than chrome-defined.

**Border-only — wrap the viewport in a visible frame.**
- Pros: the visual cue is *enclosure*, painted by Portal rather than by the session's own bytes, so it is reliable regardless of scrollback content. The existing chrome line tucks naturally into the frame's header region. Costs ~2 rows + 2 cols (≈4–8% of vertical space on typical 50/24-row terminals — negligible).
- Cons: takes screen real estate; the body of the preview still *renders* identically to attached — distinction comes purely from the surround.

**Combination (border + subtle dim).**
- Pros: maximally unambiguous.
- Cons: pays both costs (real estate + ANSI-interaction risk) for a signal one of them already provides.

### Decision

**Border-only.** Wrap the viewport in a visible frame; do not touch the body's rendering.

Decisive factor: the dim approach's failure mode is *content-dependent* — it works on a plain prompt and breaks on a tmux session full of `bat`, `vim`, or a colorful prompt — which is precisely the scrollback content preview is most useful for. The border approach is content-independent: it is Portal's paint over Portal's layout, and its appearance does not vary with what the session was doing. Real estate cost is modest and predictable; ANSI-interaction risk for dim is unbounded and only surfaces in the wild.

Confidence: high.

---

## Chrome line composition and width cascade

### Context

With the border-only direction locked, two layout questions follow immediately: (a) where the existing chrome line sits relative to the new frame, and (b) how the chrome behaves when terminal width can't accommodate it. The chrome today (`internal/tui/pagepreview.go:165-175` → `chromeLine()`) is `Window M of M · Pane X of X · win: {name}    ] next win · [ prev win · tab next pane · enter attach · esc back` — roughly 110 chars of fixed overhead plus a variable-length window name. There is no width-awareness today; long window names or narrow terminals already wrap to a second visual row in option A's structure, just silently.

### Options Considered

**Layout — chrome above the frame (A) vs chrome as the frame's top header (B).**

- **A — chrome above frame**: structurally simpler in lipgloss. Chrome `Render()`s independently; frame surrounds only the viewport. Overhead: chrome row + top border row = 2 rows. Overflow failure mode: chrome wraps to a second visual row, pushing the viewport down.
- **B — chrome in top header**: the metadata strip becomes part of the frame edge (e.g. `┌─ window 1 of 3 · pane 1 of 1 · win:nvim · ] next win · … esc back ─┐`). Overhead: 1 row. Reinforces "this is one contained preview surface." Overflow failure mode: the corner character clips or wraps, breaking the entire border integrity — strictly worse than A's wrap, *unless* width-handling exists.
- Lipgloss has no first-class label-in-border primitive; B requires assembling the top edge manually (corner + chrome chars + corner). One-time, bounded work.

**Width handling — none vs cascading truncation.**

- **No width handling**: existing behaviour. A wraps silently; B breaks.
- **Cascading truncation**: a pure function `composeChromeLine(width int, …) string` that applies degradation in order until the line fits.

### Journey

Initial lean was B for the visual gestalt — single bounded preview surface, the metadata strip reads as a *label of* the thing rather than a *line above* the thing. Concern raised: B's overflow failure is worse than A's, so it's only viable if width can be respected.

This pivoted the conversation: width handling isn't a B-specific safety net — A also benefits today (long window names wrap and push the viewport down silently). So the truncation cascade is a real robustness improvement either way, and adopting B just makes it load-bearing rather than nice-to-have. Implementation is bounded: pure function, no I/O, exhaustively unit-testable at width thresholds. The previewModel already receives terminal width via `tea.WindowSizeMsg` (needed to size the viewport), so the data is available; no new model surface.

False path: briefly considered "drop chrome above some narrow-terminal threshold and let viewport fill the frame." Rejected as a primary strategy — the chrome is the only navigational discoverability inside preview; dropping it should be the absolute last-resort fallback, not the first response to narrowing.

### Decision

**Layout: B — chrome line as the frame's top header.** Implemented by composing the top edge manually (`┌─ … ─┐`) rather than reaching for a lipgloss primitive that doesn't exist. Frame surrounds the viewport; bottom edge is the standard lipgloss border.

**Width handling: cascading degradation**, applied in order until the assembled line fits the available width (measured with `lipgloss.Width`):

1. **Truncate window name with `…` suffix** when the budget for the name segment is positive but smaller than the name.
2. **Drop the `· win: {name}` segment** entirely if budget for it is below a sensible minimum (target: ~8 chars; below that the truncation reads as garbage).
3. **Swap full keymap for compact form** — `] [ ⇥ ⏎ ⎋` (9 cells) instead of the verbose `] next win · [ prev win · ⇥ next pane · ⏎ attach · ⎋ back` (82 cells). Saves ~73 cells. Action labels are not lost from the product — once the user has seen the verbose chrome at wider widths, the keys-only form reads as a recognised compression rather than a fresh-eyes puzzle. (See *Keymap glyphs* below for the chosen glyph set and the scope note on why the verbose form is also touched.)
4. **Drop chrome entirely** — render the frame with no header label. Strictly a degenerate-terminal fallback; almost no real user terminal hits this.

`composeChromeLine` is a pure function in `internal/tui/pagepreview.go`. Tested at each cascade threshold with table-driven cases.

Side benefit: defends against pathological window names regardless of terminal width — e.g. a long file path as a vim session's window name no longer breaks rendering today.

### Truncation semantics

Step 1 of the cascade ("truncate window name with `…` suffix") and the "target: ~8 chars" minimum in step 2 are specified in **display cells**, not bytes or runes. Window names are arbitrary UTF-8 — tmux allows CJK, emoji, combining marks, and double-width glyphs.

Implementation: iterate codepoint-by-codepoint accumulating `runewidth.RuneWidth(r)` (or equivalently `lipgloss.Width` of single-rune strings — lipgloss uses `go-runewidth` underneath). Stop when adding the next rune would exceed `budget - 1` (reserving 1 cell for the `…` suffix). Append `…` (1 cell wide).

Naïve byte-slicing (`s[:n]`) is forbidden — it can land mid-rune and produce invalid UTF-8 in the top border. Naïve rune-counting overcounts: a string of CJK glyphs is 1 rune per 2 cells, so "n runes" can be 2× the visual budget. The same display-cell-aware primitive applies wherever the cascade truncates anything.

Tested with table-driven cases including ASCII, CJK, emoji, and combining marks.

### Resize repaint behaviour

Bubble Tea emits one `tea.WindowSizeMsg` per terminal-resize signal. Dragging a terminal corner produces a stream of them. Each `tea.WindowSizeMsg` goes through Update → View.

**Decision: repaint every tick, no debounce.** Preview's resize handler in `pagepreview.go`'s `Update` does three things on each `tea.WindowSizeMsg`:

1. Call `m.viewport.SetSize(msg.Width - 2, msg.Height - 2)` to adjust the viewport's visible window for the new inner dimensions (subtracting 2 for left+right border columns and top+bottom border rows).
2. Recompute the chrome line via `composeChromeLine(msg.Width - 2, …)` for the new inner width.
3. Allow `View()` to re-render the frame.

Rationale: `composeChromeLine` is a pure function with no I/O. `viewport.SetSize` doesn't reallocate content — it adjusts the visible window over an immutable buffer. Preview's structural enumeration was captured at preview-open and is not re-fetched on resize. The per-tick cost is small enough that debouncing would only hurt: dropping frames would make chrome visibly lag resize, and maintaining a timer adds state for a problem that doesn't exist. Bubble Tea's runtime already coalesces redundant `View()` calls at the framerate level.

Build phase has one explicit obligation: implement the `tea.WindowSizeMsg` case in preview's `Update`. No special-casing for rapid resize streams.

### ANSI bleed protection

The embedded viewport renders raw ANSI bytes from scrollback as straight passthrough (per the prior `session-scrollback-preview` spec). A scrollback line can legitimately end with an unterminated SGR sequence — for example, a `bat`-rendered file whose last visible line set a background color and the buffer ended before issuing a reset. With the new frame, an unterminated SGR sits in the cell adjacent to the right border on its row.

Concrete risk: terminal is in "set bg=red" state when lipgloss emits the right border character. Lipgloss's `BorderForeground` emits its own SGR for the border foreground colour but does not reliably reset background state. The border character could render with the design blue foreground over an unwanted red background — coloured squares where the border should be.

**Decision: inject `\x1b[0m` (SGR reset) at the end of every viewport row before composing with the frame.** Per-line, not just at end-of-buffer — each line carries unterminated SGR independently.

Implementation: when wrapping `viewport.View()` output, split on `\n`, append `\x1b[0m` to each non-empty line, then pass the joined string into lipgloss's frame rendering. Five-line function, pure, unit-testable with fixture lines ending in unterminated SGR.

Cost: trivial. Upside: border integrity is bulletproof regardless of scrollback content. Removes the "depends on lipgloss internal SGR handling" uncertainty entirely.

### Scroll redraw

Bubble Tea has no partial-screen redraw mechanism — every Update tick re-renders the full View(). Viewport scroll is a model-state change inside `bubbles/viewport` (its visible-window offset), routed through Update and re-rendered via `viewport.View()` on the same tick.

**Decision: no special handling.** The frame is composed in `pagepreview.go`'s `View()` once per tick around whatever `viewport.View()` currently shows. Scroll is owned entirely by viewport's existing behaviour; the frame wraps the latest rendered output. The SGR-reset injection covers every render, so rows scrolling into view are also protected.

### Integration with existing page state

Two adjacent integration questions, both about whether the frame introduces new interaction with the rest of the TUI.

**Bootstrap warning flush.** Preview is unreachable from the Loading page. Bootstrap's warning flush happens at loading-page dismiss with alt-screen toggling (per CLAUDE.md) to avoid corrupting the rendered UI. The Sessions page renders only after bootstrap completes and any warnings are flushed. Preview is reached via Space on the Sessions page. By the time the user can press Space, bootstrap is fully done.

**Decision: no interaction, no special handling.**

**Filter-then-preview transition.** The frame lives only in `pagePreview`'s `View()`. `pageSessions`'s `View()` has no frame.

- Entry transition (Sessions → Preview via Space): preview's View() renders the frame for the first time on that tick. Bubble Tea repaints the full screen on every tick anyway, so there is no flicker — the frame's appearance is the visual signature of the page change.
- Exit transition (Preview → Sessions via Esc): the existing dismiss-refresh path from `enter-attaches-from-preview` is unchanged — pageSessions's View() just doesn't render a frame. The sessions-list refresh on dismiss continues to be dispatched as before.

**Decision: no new flicker, no special transition handling.** The frame's existence in pagePreview's View() and absence in pageSessions's View() is the natural shape of the page state machine and needs no further plumbing.

### Test strategy

Five testable surfaces emerged across this discussion. **Decision: all five are pure-function unit tests or `Update + View` integration tests with the existing `previewModel` mocks. No golden / snapshot files, no real-tmux integration test.**

1. **`composeChromeLine(width, …)`** — pure function. Table-driven cases at each cascade threshold: window name fits, window name truncates, window name dropped (segment removed), keymap compacted, chrome dropped entirely.
2. **Display-cell truncation primitive** — pure function. Table-driven cases with ASCII, CJK glyphs, emoji, and combining marks. Asserts no mid-rune cuts and correct cell-budget arithmetic.
3. **SGR reset injection** — pure function. Fixture lines containing unterminated SGR sequences; assert each non-empty line in the output ends with `\x1b[0m`.
4. **Resize handling** — `Update(tea.WindowSizeMsg{Width, Height})` on a `previewModel` constructed with mock `TmuxEnumerator` / `ScrollbackReader`. Assert viewport `SetSize` was called with `Width-2, Height-2` and that the chrome line was recomputed for the new inner width.
5. **Frame composition end-to-end** — `Update + View` on `previewModel` with mocks. Assert `View()` output contains the rounded corner glyphs (`╭`, `╮`, `╰`, `╯`), the chrome line on the top edge, and the SGR-reset bytes.

Rationale: pure-function tests cover the substantive logic exhaustively at minimal cost. The `Update + View` shape with mocked seams is the existing project convention (per `session-scrollback-preview`'s test-seam architecture) — no `tmuxtest` import, runs without a real tmux server, `t.Parallel()` would be safe (preview's seams are constructor-injected, not package-level). Snapshot tests would couple to lipgloss's specific border-rendering output, locking us to upstream behaviour we should not test against.

### Vertical degeneracy

The cascade addresses horizontal width. Vertical is intentionally not handled. The frame costs 2 rows (top chrome edge + bottom border). On an 8-row terminal the viewport gets 5 rows; on a 5-row terminal it gets 2; below that, effectively nothing.

**Decision: render anyway. No vertical threshold, no row-budget-aware degradation, no refusal-to-open flash.**

Rationale: unlike narrow terminals and long window names (which are realistic and common — multi-pane tmux splits, side-by-side terminal layouts), terminals tall enough to break preview but short enough to not be obviously unusable are a degenerate case nobody hits accidentally. Either the user has deliberately squashed the window (in which case the recovery is press Esc, resize, retry) or the terminal is broken in ways preview's chrome wouldn't fix anyway. Inventing a row-budget cascade or a "preview unavailable" flash would be speculative complexity for a case that doesn't bite.

Confidence: high.

---

## Border style

### Context

`lipgloss` ships several border presets (`NormalBorder`, `RoundedBorder`, `ThickBorder`, `DoubleBorder`, `BlockBorder`, `HiddenBorder`). Portal currently uses borders in exactly one place: `internal/tui/modal.go:24` uses `RoundedBorder()` for kill/rename/edit modal overlays. No other styles are in use.

### Decision

**`lipgloss.RoundedBorder()`** — matches the existing modal precedent.

**Rationale**:

1. Introducing a second border style would silently establish a new design rule in Portal ("each contextual surface has its own border style"). The current implicit rule is simpler: rounded border = contextual surface, no border = main page. Preview is a contextual surface, so it fits.
2. Geometry already differentiates preview from modals — modals are small centered overlays, preview is a full-width framed page. They will never be visually confused even with identical border characters.
3. Rounded corners read more cleanly at small column widths than `ThickBorder`'s heavier glyphs.

A coupling worth naming for the build phase: the manually-composed top edge (chrome-in-header) must use the same character set as `RoundedBorder`'s left/right/bottom edges so the corners align. Implementation must source corner/edge characters from the chosen lipgloss border value rather than hardcoding them — that way a future style switch would be a one-line change.

Confidence: high.

---

## Session name visibility in chrome

### Context

Today's chrome shows `win:{name}` — the *window* name within the session. Whether to additionally surface the *session* name was open. The session name is available to the previewModel at construction time (it is what triggered preview-open from the Sessions list).

### Journey

Initial framing surfaced as a review flag — the width cascade had been decided assuming chrome contains window name only; if session name was added, the ~110-char fixed-overhead figure would have been invalidated and the cascade re-opened to address how truncation chooses between session and window name when budget runs out.

The deeper question landed cleanly: does the chrome describe *identity* (what session you're previewing) or *dynamic context* (what's changing as you cycle within preview)? Window name has genuine dynamic value — pressing `]` / `[` cycles to a new window and the name changes. Session name has no such surface: there's no key inside preview that changes which session you're on; identity is fixed at preview-open by the act of selecting from the Sessions list.

Side observation from the user during this thread: even window name is borderline-useful — tmux window names are often noisy echoes of argv[0] (the `preview-keymap-discoverability` quick-fix added the `win:` prefix specifically because raw window names were being misread as stray numbers). Window name stays because (a) it does change within preview when cycling, and (b) it's already shipped. But its borderline value reinforces a cascade-ordering point: dropping the `· win: {name}` segment is step 2 of the truncation cascade, which means we're cutting something acknowledged as low-value early — a healthy alignment between budget-pressure relief and what the user actually relies on.

### Decision

**Session name is not surfaced in the preview chrome.**

The chrome stays *dynamic-only*: it describes what changes as the user navigates within preview, not what is already established by the act of opening preview. Identity is anchored by the Sessions-page selection that triggered preview; chrome's job is navigation context, not re-asserting identity.

Consequence: the previously-decided width cascade stands as-is. No change to the ~110-char fixed-overhead math, no new truncation tier needed, no decision required about whether to drop session or window name first under width pressure.

Confidence: high.

---

## Border color

### Context

Portal's existing TUI palette (`internal/tui/session_item.go`, `internal/tui/project_item.go`, `internal/tui/model.go`) is grays + two saturated accents — ANSI `212` (pink-magenta) for the list cursor and ANSI `76` (green) for the attached badge. Grays cluster at `#555555` / `#777777` / `#888888` / `#999999`. The modal (`internal/tui/modal.go:24`) uses `RoundedBorder` with no explicit `BorderForeground` — it inherits terminal default foreground (uncoloured).

Adding any colored border on the preview frame is therefore (a) a new accent in Portal's palette, and (b) automatically a differentiation from the modal even at identical border *shape*.

### Journey

First sub-question that came up: should the color differ between inside-tmux and bare-shell contexts (review F11)? Inside tmux the preview frame nests inside whatever tmux pane the user is running Portal in (potentially next to tmux's own `pane-border-style` colors); bare shell, the frame is alone on screen.

Decided: **single unified color**, not context-aware. Reasoning — context-aware styling would be Portal's first instance of "we render differently inside vs outside tmux," which is a pattern worth not introducing for a chrome accent. A single mid-luminance color reads acceptably in both contexts.

Then four candidates were compared visually on Paper:

- **Steel slate** (AdaptiveColor: `#5B6B7B` light / `#8B9CAE` dark) — sits in Portal's gray family with a slight blue tint; reads as chrome.
- **Deeper saturated blue** (AdaptiveColor: `#3B5577` light / `#7B95BD` dark) — recognisably blue, slightly more deliberate.
- **ANSI bright blue (Color("12"))** — bold, terminal-palette-inherited; reads as an active surface rather than chrome.
- **ANSI dim blue (Color("4"))** — fails the contrast test on dark terminals.

User preferred the deeper saturated blue — it reads more like "Portal painted this surface" than the steel slate's "Portal hinted at a frame," which fits the intent of *making preview visually unmistakable*.

### Decision

**`lipgloss.AdaptiveColor{Light: "#3B5577", Dark: "#7B95BD"}`** — single unified color across inside-tmux and bare-shell contexts.

Both variants sit at mid-luminance with a recognisable blue saturation. The light variant (`#3B5577`) is dark enough to be visible against pale terminal backgrounds; the dark variant (`#7B95BD`) is light enough to be visible against dark backgrounds. Neither competes with the existing accents — pink-magenta cursor (`212`) and green attached badge (`76`) are saturated in different hue families.

This introduces a third accent color to Portal's palette, owned by preview chrome.

### Color robustness: NO_COLOR, low-color terminals

Explicitly captured so the spec phase does not treat the hex tones as hard requirements:

**The frame's *enclosure* is the load-bearing distinction signal. The blue tint is enhancement.**

- **`NO_COLOR=1`**: lipgloss/termenv respects the convention and renders the border in default foreground. The blue is dropped; the frame remains visible. Distinction signal is preserved.
- **8/16-color terminals or `TERM=dumb`**: lipgloss/termenv automatically downgrades hex to the nearest palette color. Result is whatever the terminal's nearest-blue happens to be — design intent is approximated, not lost.
- **Truecolor terminals**: rendered as specified.

No explicit Portal handling is needed beyond what lipgloss/termenv provides out of the box.

Confidence: high.

---

## Implementation form specifics

These decisions fell out of review-002's findings — they are not after-the-fact build details, they are decisions the discussion locks now. Each pins a specific implementation form so spec digests a complete artifact and the build phase has no remaining design degrees of freedom in these areas.

### Replace `chromeLine()` with `composeChromeLine`

The existing `chromeLine()` method on `previewModel` at `internal/tui/pagepreview.go:165-175` is **deleted**. Callers in `View()` invoke the new pure function `composeChromeLine(width int, …) string` directly with the current width and the relevant model fields. The pure-function signature is the testable boundary; a thin method wrapper would add an indirection without value.

### Cascade algorithm (predicate-over-output)

The four-step cascade is **not** a stack of incremental transformations. Each tier produces a *candidate output*, measures it via `lipgloss.Width`, and returns if it fits. Otherwise falls through to the next tier.

Algorithm:

```
tier 1: compose with name truncated to fit + full keymap     → measure → if fits, return
tier 2: compose with name segment dropped  + full keymap     → measure → if fits, return
tier 3: compose with name segment dropped  + compact keymap  → measure → if fits, return
tier 4: corners + filler `─` (no chrome content)             → always fits any width ≥ 2 → return
```

Tier interactions:

- Tiers 1 and 2 are mutually exclusive — if tier 1's truncated name fits, tier 2 isn't reached; if tier 2 drops the segment, tier 1's work is discarded.
- Tiers 2 and 3 differ only in keymap form — tier 3 strictly compresses tier 2 further by swapping the verbose keymap for the compact one.
- Tier 4 supersedes whatever was attempted before.

Step 4 is load-bearing: it guarantees the top edge always renders cleanly down to width 2 (the two corner glyphs). Without it, terminal widths narrow enough to fail tier 3 would either clip the chrome or wrap it to a second visual row — wrapping in particular breaks the frame because the bottom corner shifts down by one row, destroying the visual integrity the cascade exists to protect. Even though tier 4 is rarely reached in practice (sub-40-col terminals are degenerate), its existence is what lets the cascade make a strong guarantee.

### Top edge composition

The top edge is `╭─{chrome content}{filler ─}─╮`. By column:

- Column 0: `╭` (left corner)
- Column 1: `─` (one-cell padding after left corner)
- Columns 2 through (2 + chromeWidth − 1): chrome content, display-cell width = `chromeWidth`
- Columns (2 + chromeWidth) through (width − 3): `─` filler (any remaining cells)
- Column (width − 2): `─` (one-cell padding before right corner)
- Column (width − 1): `╮` (right corner)

This pins the right corner at `width − 1` regardless of chrome length. At tier 4 the entire middle range `[2, width − 3]` is `─` filler — the top edge becomes `╭{─ × (width − 2)}╮`.

Degenerate widths:
- width 2: `╭╮` (corners only, no padding, no filler)
- width 3: `╭─╮`
- width 4: `╭──╮`

All such tiny widths fall into tier 4 behaviour automatically because there is no room for chrome content under any tier.

### Color application on the top edge

Lipgloss's `BorderForeground(color)` colors only the border characters lipgloss renders (left edge, right edge, bottom edge). The hand-composed top edge needs the same color applied — otherwise three edges would render in the design blue and the top edge in default foreground.

Decision: the top edge is composed in `View()` as **two stylings concatenated**:

- **Border parts** (corner glyphs + `─` padding + `─` filler) — wrapped in `lipgloss.NewStyle().Foreground(adaptiveBlue).Render(…)` so they pick up the design color.
- **Chrome content** — rendered with no explicit foreground, inheriting terminal default. This matches how the bottom help bar text renders today (`model.go:531-533` uses an explicit description color for sub-elements, but the chrome strip is conceptually a label, not a styled description). Chrome reads as legible terminal text against the blue-bordered surround.

Final assembly at the View() call site:

```
styledBorder("╭─") + chromeContent + styledBorder(filler + "─╮")
```

where `styledBorder := lipgloss.NewStyle().Foreground(adaptiveBlue).Render`.

Build-phase implication: the `composeChromeLine` pure function returns the *unstyled* chrome content string. Top-edge styling — border parts colored, chrome parts default — happens at the call site in `View()` where the final composition assembles. This keeps `composeChromeLine` pure and testable purely on content output, independent of color rendering.

### Keymap glyphs (verbose and compact forms)

The verbose form's word tokens `tab`, `enter`, `esc` are replaced with macOS-convention keyboard glyphs. The bracket keys `]` / `[` stay as ASCII because they are literally the characters the user presses — no glyph is more accurate.

**Glyph set:**

| Key   | Glyph | Codepoint |
|-------|-------|-----------|
| `]`   | `]`   | ASCII     |
| `[`   | `[`   | ASCII     |
| Tab   | `⇥`   | U+21E5    |
| Enter | `⏎`   | U+23CE    |
| Esc   | `⎋`   | U+238B    |

**Verbose form** (default at typical widths):

```
] next win · [ prev win · ⇥ next pane · ⏎ attach · ⎋ back
```

**Compact form** (cascade tier 3):

```
] [ ⇥ ⏎ ⎋
```

Compact uses single-space separators (no interpunct) — the entire point of tier 3 is character compression, and 4 separators × 2 cells saved = 8 cells back into the budget. Display-cell width of the compact form is 9 cells, comfortably below any realistic terminal floor above tier 4.

**Token order matches across forms** — `] [ tab enter esc` left-to-right in both — so a user resizing the terminal sees the same sequence of keys, just with action labels added or removed.

**Font fallback.** `⇥` and `⏎` are present in essentially every modern monospace font. `⎋` (U+238B) is the weakest link — present in SF Mono, Menlo, JetBrains Mono, Fira Code, Cascadia, and most modern terminal-targeted fonts, but a user on an old terminal with a font lacking that codepoint sees a fallback box. Acceptable degradation: the bracket keys `]` / `[` still render, the message "this is preview" still lands via the frame, and the keys still work.

**Bake into constants** in `pagepreview.go`:

```go
const (
    verboseKeymap = "] next win · [ prev win · ⇥ next pane · ⏎ attach · ⎋ back"
    compactKeymap = "] [ ⇥ ⏎ ⎋"
)
```

Tests assert against these exact bytes.

**Scope note.** Touching the verbose form means changing what `preview-keymap-discoverability` (the quick-fix that added the word tokens) and `enter-attaches-from-preview` (which added the `enter attach` token) shipped. Those specs are frozen historical records — not edited. This feature's spec captures the new glyph form as its own decision; the prior specs remain accurate as records of what they shipped at the time.

### SGR reset injection — edge cases

The "split on `\n`, append `\x1b[0m` to each non-empty line, then join" rule needs three edge cases pinned:

1. **Trailing newline.** If `viewport.View()` ends with `\n`, splitting yields an empty trailing element. The empty element is **ignored** — no reset appended. The bottom border is rendered by lipgloss with its own SGR; a trailing empty line carrying or not carrying a reset is immaterial.
2. **"Non-empty" definition.** Byte-length > 0. A line of literal spaces with an embedded SGR is non-empty and gets a reset; we do not try to distinguish whitespace-only from visible content.
3. **Idempotency.** Terminals treat `\x1b[0m\x1b[0m` as a single reset. No deduplication logic — if the content already ended with a reset, double-resetting is harmless. Tests include a fixture line that already ends in `\x1b[0m` to confirm rendering does not degrade.

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

### SGR reset placement vs lipgloss border emission

The injected reset goes at end-of-row of viewport content, *before* lipgloss composes the border. On a composed row the byte sequence is:

```
[lipgloss left-border SGR][│][reset][content with injected reset at row-end][lipgloss right-border SGR][│][reset]
```

Lipgloss uses `go-runewidth` + `termenv` for ANSI-aware measurement — both preserve SGR codes when measuring width (they count cells, not bytes). The injected reset survives into the final composed string. No special placement consideration is needed beyond what *SGR reset injection — edge cases* specifies; the *Cascade-tier end-to-end test coverage* section below confirms the boundary in practice.

### Degenerate width below corners

Cascade tier 4 produces `╭─...─╮` at any width ≥ 2. Below width 2 there is no valid frame top edge.

Decision: `composeChromeLine` returns the empty string for `width < 2`. The frame composition in `View()` calls lipgloss bordering with whatever width the model holds; lipgloss handles widths it cannot render by clipping (its own behaviour). Consistent with the "no special vertical handling" stance — width 0 or 1 is degenerate, render whatever falls out, no error path.

### Chrome-row invariant for resize math

`m.viewport.SetSize(msg.Width - 2, msg.Height - 2)` assumes top edge = 1 row, bottom edge = 1 row. The cascade guarantees a one-row top edge at any width ≥ 2 (tier 4 produces `╭{─ × (width-2)}╮`, all on one row). Below width 2 the system is degenerate anyway.

Capture the invariant explicitly:

- `composeChromeLine`'s doc comment: *"Returns a single-line string with no embedded newlines. The cascade guarantees one-row output for all widths ≥ 2; below that, returns the empty string."*
- `previewFrameOverhead = 2` comment: *"top border (1 row, carrying chrome via cascade) + bottom border (1 row) = 2 rows of frame overhead."*
- Test: `strings.Count(composeChromeLine(w, …), "\n") == 0` across the cascade-tier width thresholds.

### Initial WindowSizeMsg / preview-open ordering

The parent Bubble Tea model holds current terminal dimensions from program-start (it has been receiving `tea.WindowSizeMsg` events since startup). When the user presses Space on the Sessions page, `NewPreviewModel` is constructed in the Sessions page's `Update` handler, which has access to the parent's tracked dimensions.

Decision: `NewPreviewModel(…, width, height int)` accepts width and height as constructor parameters. The Sessions page's `Update` handler passes its current width / height into the constructor. Inside the constructor:

- `viewport.SetSize(width - 2, height - 2)` is called once with initial dimensions.
- The initial chrome string is pre-computed for the inner width.

The first `View()` call on the freshly-constructed previewModel renders with correct dimensions — no race between preview-open and first WindowSizeMsg, no "first frame at zero width" edge case. Subsequent `tea.WindowSizeMsg` updates apply via the resize handler.

### Cascade-tier end-to-end test coverage

Test surface 5 is extended with a table-driven sub-test that drives the full `Update → View` pipeline across the cascade tiers, not just the pure-function thresholds.

Procedure:

- Construct `previewModel` with mock `TmuxEnumerator` + `ScrollbackReader` and a fixed window-name fixture.
- For each width in the cascade-threshold table (e.g. 200, 60, 40, 25, 15), dispatch `Update(tea.WindowSizeMsg{Width: w, Height: 30})`, then call `View()`.
- Assert the rendered output contains the expected tier signature:

| Width | Expected signature                                                    |
|-------|-----------------------------------------------------------------------|
| 200   | Full window name + verbose keymap (`⇥ next pane`)                     |
| 60    | Window name truncated with `…` suffix; verbose keymap                 |
| 40    | No `win:` segment (tier 2 dropped); verbose keymap                    |
| 25    | No `win:`; compact keymap `] [ ⇥ ⏎ ⎋`                                 |
| 15    | Top edge is `╭{─ × 13}╮` (tier 4: corners + filler, no chrome)        |

- Assert SGR reset bytes are present on each viewport content row in every case.

This ties the pure-function cascade thresholds (surface 1) to the actual rendered frame, catching regressions where `composeChromeLine`'s output and the `View()` composition could drift apart.

### Rename `previewChromeHeight` to `previewFrameOverhead = 2`

The existing `const previewChromeHeight = 1` becomes outdated under the new model (chrome no longer sits above the viewport — it shares the top border row). Rename to `previewFrameOverhead = 2` with the comment "top border (carrying chrome) + bottom border." This names the magic 2 used in the resize math (`SetSize(msg.Width - 2, msg.Height - 2)`), preserves the file-local convention of naming chrome dimensions, and gives a single edit point if the frame's vertical geometry ever changes.

---

## Summary

### Key Insights

1. **Enclosure is the load-bearing distinction signal; everything else is enhancement.** The frame's presence makes preview unmistakable from an attached session; the AdaptiveColor blue and the glyph chrome are additive polish that degrade gracefully when not supported (NO_COLOR, low-color terminals, fonts missing `⎋`).
2. **The chrome is dynamic-only.** It describes what changes as the user navigates within preview (window/pane cycle), not what is established by the act of opening preview (session identity). This framing pre-empts a class of "should we surface X" questions by giving them a clear rule.
3. **Frame integrity demands width-awareness as a first-class concern.** Chrome wrapping to a second visual row breaks the bottom corner alignment — i.e. the *whole frame* — so a robust cascade with a guaranteed tier-4 floor is what licenses the chrome-in-header layout choice. Without the cascade, B (chrome inside the top border) would be too fragile.
4. **Discussion decides; spec digests.** The user's mid-session correction reshaped the second half of the discussion: review-002's mechanical findings were treated as decisions to lock here, not as "spec-phase verification items." This is now captured in cross-session memory.
5. **Visual decisions benefit from Paper-rendered side-by-side comparisons.** Picking the border color via four candidate swatches on the Paper canvas was faster and more confident than picking from descriptions; worth repeating for any future colour / glyph / layout decision in this codebase.

### Open Threads

None deliberately deferred. All map subtopics and all 26 review findings (13 across each of review-001 and review-002) are decided.

### Current State

- Visual treatment: border-only.
- Frame: `lipgloss.RoundedBorder()` matching modal precedent, with `BorderForeground` = `AdaptiveColor{Light: "#3B5577", Dark: "#7B95BD"}`.
- Chrome line: rides on the manually-composed top edge of the frame (B), keys glyphified (`⇥`, `⏎`, `⎋`), bracket keys (`]`, `[`) preserved as ASCII.
- Width handling: four-tier predicate-over-output cascade with display-cell-aware truncation, tier 4 guaranteeing top-edge integrity down to width 2.
- Render integrity: per-row SGR reset injection on viewport output; resize repaint every tick with no debounce; no special handling for scroll, bootstrap interaction, or page-state transitions.
- Code shape: new `composeChromeLine(width int, …) string` pure function replaces existing `chromeLine()` method; `previewChromeHeight = 1` constant renamed to `previewFrameOverhead = 2`; `NewPreviewModel` takes `width, height` as constructor parameters.
- Tests: pure-function unit tests + `Update + View` integration with existing mock seams; cascade-tier table-driven sub-test covering widths 200, 60, 40, 25, 15.
- Robustness: chrome stays 1 row at all widths ≥ 2 (cascade invariant); degenerate widths below 2 return empty chrome and rely on lipgloss's own clipping.

Confidence to proceed to specification: high. The discussion has produced a decision-grade artifact; spec digests rather than designs.
