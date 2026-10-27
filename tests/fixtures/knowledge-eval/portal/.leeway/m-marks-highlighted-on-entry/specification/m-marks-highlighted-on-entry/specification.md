# Specification: M Marks Highlighted On Entry

## Change Description

Pressing `m` on the Sessions list to enter multi-select mode currently opens the
mode with an **empty** selection set; a second `m` toggles the highlighted row.
Change the mode-entry branch of `handleMultiSelectToggle` so it **marks the
currently-highlighted session as the first selection on entry** — the common
case being "I'm looking at a session and want it in the set." The mark reuses the
existing `selectedSessionItem()` lookup, which already returns `ok=false` on a
non-selectable `HeaderItem` row, so entering while the cursor sits on a group
header cleanly enters with zero (no special-casing).

This supersedes one decision from the `restore-host-terminal-windows`
specification ("`m` enters a real mode you can sit in with **zero selected** —
not an implicit mark-on-entry"). Per the discovery decision, this is a
supersession, **not** an edit of that prior spec.

## Scope

- **`internal/tui/model.go` — `handleMultiSelectToggle` mode-entry branch
  (currently lines ~3503–3512).** In the `!m.multiSelectMode` branch, after
  setting `multiSelectMode = true` and initialising `selectedSessions`, look up
  the highlighted row via `selectedSessionItem()` and, when `ok` is true, insert
  its `Session.Name` into the set before refreshing the delegate. The mark is
  keyed on `Session.Name` — the identical identity rule as the existing toggle
  branch, so a multi-tag By-Tag (Pattern B) highlighted row marks its underlying
  session once. Update the function docstring (currently lines ~3496–3502) to
  describe mark-on-entry instead of "enter-only, no implicit mark".
- **`internal/tui/multi_select_test.go` (and any sibling test in
  `internal/tui/` asserting enter-with-zero).** Flip the assertions that expect
  entering multi-select to leave the set empty so they expect the highlighted
  session marked (count 1). Preserve — do not delete — coverage of the retained
  edge cases: entering on a `HeaderItem` row is a no-op enter (count 0),
  zero-selected stays reachable via double-`m` (enter then toggle the
  auto-marked row off) and via `Esc`, and the By-Tag identity rule marks the
  session once regardless of how many rows it spans.
- **Documentation copy.** `CLAUDE.md:184` (the `*not* mark-on-entry` clause) and
  the `README.md` multi-select prose (the "then `m` again on any row to mark or
  unmark it" description, ~lines 303–304) are adjusted so they reflect that entry
  marks the highlighted row, while noting zero-selected remains reachable.

## Exclusions

- **No change to behaviour after entry.** The toggle semantics of subsequent `m`
  presses, the N=0/N=1/N≥2 Enter boundary, sticky selection across
  filter/paging/regroup/`Space`-preview, the notice-band precedence, and the
  spawn/burst flow are all untouched.
- **No footer or banner copy change.** The `m toggle` footer hint and the
  `N selected` banner remain accurate as-is.
- **`WithInitialMultiSelect` is unaffected.** It is the capture-harness
  entry point that seeds an *explicit named set* (not the highlighted row); it
  does not participate in the `m`-key entry path.
- **No new visual state, Paper frame, or visual gate.** Entering with one row
  marked renders as the already-delivered multi-select "active" state.

## Verification

- The `internal/tui` unit tests pass after the assertion flips
  (`go test ./internal/tui/...`), and the full unit lane (`go test ./...`) stays
  green.
- Entering multi-select while the cursor is on a **session** row yields exactly
  one marked session — the highlighted one — with its `●` marker shown.
- Entering multi-select while the cursor is on a **group-header** row yields zero
  marked (the `selectedSessionItem()` `ok=false` path), staying in the mode.
- Zero-selected remains reachable: double-`m` (enter, then toggle the
  auto-marked row off) yields an empty in-mode set; `Esc` clears and exits.
- A multi-tag By-Tag highlighted row marks the underlying session once (count
  changes by exactly 1).
- No production or documentation text continues to assert that entering
  multi-select leaves the set empty / is "not mark-on-entry".
