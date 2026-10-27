# Investigation: Esc After Preview Hides Session List

## Symptoms

### Problem Description

**Expected behavior:**
After pressing `Esc` to dismiss the scrollback preview opened from a filtered sessions list, the TUI returns to the previously filtered session list — the committed filter text remains in effect and the matching rows are still visible.

**Actual behavior:**
The first `Esc` after returning from the preview puts the TUI into a hidden / empty-looking state (session list disappears). A second `Esc` is required to recover, and the committed filter is silently discarded — the reappearing list is unfiltered.

### Manifestation

- After `Esc` from preview on the filter→commit→preview path:
  - Session list visually vanishes / appears empty
  - Filter text committed earlier is gone
  - A second `Esc` brings the list back, but unfiltered
- Path is specific: filter (`/`) → type → `Enter` to commit → `Space` to preview → `Esc`
- Without the filter step (preview an unfiltered list and press `Esc`), preview dismisses straight back to the session list normally.

### Reproduction Steps

1. Launch the TUI: `portal open` (or `x`) so the Sessions page is showing.
2. Press `/` to enter filter mode.
3. Type characters until the list narrows to an available session.
4. Press `Enter` to commit the filter (filter input exits; matching session row highlighted).
5. Press `Space` — scrollback preview opens for the highlighted session.
6. Press `Esc` — **bug**: session list disappears entirely; committed filter is also gone.
7. Press `Esc` a second time — session list reappears, unfiltered.

**Reproducibility:** Always, on this specific keystroke path.

### Environment

- **Affected environments:** Local (TUI; not environment-specific)
- **Browser/platform:** N/A (terminal TUI)
- **User conditions:** Any sessions present; must be in `portal open`/`x` TUI

### Impact

- **Severity:** Low (UX friction)
- **Scope:** All TUI users who use filter + preview together
- **Business impact:** UX-only — no tmux state affected, nothing destroyed; user must re-type filter

### References

- Inbox: `.workflows/.inbox/.archived/bugs/2026-05-19--esc-after-preview-hides-session-list.md`
- Suspect area: `internal/tui/` — `pagePreview → pageSessions` dismiss handler and sessions-page Esc handling

---

## Analysis

### Initial Hypotheses

- Esc on `pagePreview` likely both dismisses the preview AND is then re-delivered to a sessions-page handler that interprets it as "clear filter / hide list."
- Alternatively, the dismiss transition may reset filter state but not re-apply the filter to the visible list, leaving the model in a state where the list renders empty until another event nudges it.

### Code Trace

**Entry point:** `previewModel.Update` in `internal/tui/pagepreview.go:467` — `tea.KeyEsc` case returns `previewDismissedMsg{}`.

**Execution path on the buggy Esc:**

1. `internal/tui/pagepreview.go:467-468` — `tea.KeyEsc` in `previewModel.Update` returns `previewDismissedMsg{}` (single Esc keystroke; no second delivery).
2. `internal/tui/model.go:954-974` — top-level Update receives `previewDismissedMsg`, captures `m.preview.session` and calls `m.exitPreviewToSessions(captured)`.
3. `internal/tui/model.go:743-747` — `exitPreviewToSessions` sets `m.activePage = PageSessions`, zeros `m.preview`, returns the live-refresh `tea.Cmd` (`refreshSessionsAfterPreviewCmd`).
4. Render tick: the Sessions page renders with the **existing** filtered list — at this exact moment the filter is still intact, cursor still on the previously-highlighted session.
5. Refresh cmd resolves → emits `previewSessionsRefreshedMsg`.
6. `internal/tui/model.go:1011-1023` — handler calls `m.applySessions(msg.Sessions)` then `m.reanchorSessionCursor(msg.PreserveName)` and returns `(m, nil)`.
7. `internal/tui/model.go:660-668` — `applySessions` calls `m.sessionList.SetItems(ToListItems(filtered))` and **discards its returned `tea.Cmd`**.

**Inside `bubbles/list.SetItems`** (`bubbles@v1.0.0/list.go:385-397`):

```go
func (m *Model) SetItems(i []Item) tea.Cmd {
    var cmd tea.Cmd
    m.items = i
    if m.filterState != Unfiltered {
        m.filteredItems = nil          // ← list is now visibly empty
        cmd = filterItems(*m)          // ← async cmd we silently drop
    }
    m.updatePagination()
    m.updateKeybindings()
    return cmd
}
```

When the committed filter is applied (`filterState == FilterApplied`), `SetItems`:
- Nils out `m.filteredItems` immediately (next render shows 0 visible items)
- Returns a `filterItems` cmd that asynchronously runs the filter against the new `m.items` and emits a `FilterMatchesMsg` (`bubbles@v1.0.0/list.go:1260-1284`) which the list's Update consumes (`bubbles@v1.0.0/list.go:833-835`) to repopulate `filteredItems`.

Because `applySessions` discards this cmd, the `FilterMatchesMsg` never fires; `filteredItems` stays nil; the list renders empty while `filterState` is still `FilterApplied`.

**Second Esc** (`internal/tui/model.go:1057` → bubbles list handleBrowsing path, `bubbles@v1.0.0/list.go:864-867`):

```go
case key.Matches(msg, m.KeyMap.ClearFilter):
    m.resetFiltering()
```

Esc matches `KeyMap.ClearFilter` (which defaults to Esc) — `resetFiltering()` clears the filter text and sets `filterState = Unfiltered`. The list now renders unfiltered items; the committed filter is permanently gone.

**Key files involved:**
- `internal/tui/model.go` — `applySessions` (lines 660-668), `previewSessionsRefreshedMsg` handler (lines 1011-1023), `exitPreviewToSessions` (lines 743-747)
- `internal/tui/pagepreview.go` — `previewModel.Update` Esc arm (line 467)
- `github.com/charmbracelet/bubbles@v1.0.0/list/list.go` — `SetItems`, `filterItems`, `handleBrowsing`/ClearFilter

### Root Cause

`applySessions` calls `m.sessionList.SetItems(...)` and discards the `tea.Cmd` that `bubbles/list` returns. When a filter is applied at the moment of the call, `SetItems` synchronously nils `filteredItems` and defers re-filtering into the returned cmd. Dropping the cmd leaves the list in a "filter applied, filtered items empty" state that renders as a blank list.

The bug is most prominently reproducible on the preview-dismiss path because `previewSessionsRefreshedMsg` always fires after a `Space` keystroke that necessarily happens on the Sessions page (where a filter may be applied). However, the `SessionsMsg` `applySessions` call site (`model.go:893-897`) is **not** boot-only as initially scoped — it also fires from `killAndRefresh` (`model.go:1517-1525`) and `renameAndRefresh` (`model.go:1571-1579`), which can run while a filter is applied (`x` and `r` keys are accepted on the Sessions page mid-filter). Those paths exhibit the same latent blank-list outcome on filtered lists; they have not been reported separately, but share the bug.

### Contributing Factors

- `applySessions` was extracted as a "single canonical sequence" but its signature drops the cmd, making its caller-facing API silently lossy when a filter is applied.
- The preview-dismiss refresh path (added in `enter-attaches-from-preview` for the externally-killed-session case) is the first realistic scenario in which `applySessions` can be called against a filtered list — the original `SessionsMsg`-only use was filter-naive.
- The list's `SetItems` API has the well-known "returns a cmd you must propagate" shape; an analogous trap exists for `SetItem`, `InsertItem`, `RemoveItem` (lines 421, 435, 449 in bubbles list) — anywhere these are called without forwarding the cmd, a filtered list will go blank.

### Why It Wasn't Caught

- `TestPreviewEscFilterStatePreservedAcrossDismissWithRefresh` (`pagepreview_refetch_test.go:270-301`) **does** exercise the exact buggy sequence — filter applied + Space + Esc with a wired `SessionLister` driving the refresh — but it only asserts `FilterState` / `FilterValue` / `IsFiltered`. None of those probe `filteredItems`. A single assertion against `VisibleItems()` (or the existing `visibleSessionNames` helper) would have caught the bug. The wrong axis was checked, not a missing test.
- `TestPreviewEscPreservesCommittedFilter` (`pagepreview_dismiss_test.go:121-151`) uses `pressSpaceThenEsc` which discards the refresh cmd (`updated3, _ := got2.Update(msg)` at line 41), AND `modelWithSeams` does not wire a `SessionLister` — so the test never reaches `previewSessionsRefreshedMsg` / `applySessions`. False sense of coverage.
- Bubble Tea's "returns a cmd you must forward" pattern is easy to miss for void-returning helpers — there is no compile-time signal.

### Blast Radius

**Directly affected:**
- TUI Sessions page when dismissing the scrollback preview after committing a filter — the documented reproduction path.

**Potentially affected (latent, not yet observed):**
- `killAndRefresh` (`internal/tui/model.go:1517-1525`) — triggered by `x` on the Sessions page after the kill-confirm modal. Emits `SessionsMsg`, routes through the same `applySessions`. If the user has a committed filter and kills a session, the list goes blank.
- `renameAndRefresh` (`internal/tui/model.go:1571-1579`) — triggered by `r` → rename-modal commit. Same `SessionsMsg` → `applySessions` path; same exposure under an applied filter.
- The externally-killed-session-during-preview branch (`previewAttachBailMsg` handler, `internal/tui/model.go:975-993`) traverses the same `exitPreviewToSessions` → refresh → `applySessions` path. If preview was bailed (HasSessionProbe reported gone) while the Sessions page held a committed filter, the user would land on the same empty-list state.
- `Model.WithInsideTmux` (`internal/tui/model.go:403-411`) and `ProjectsLoadedMsg` handler (`model.go:936-947`) also call `SetItems` and discard the cmd — currently safe (construction-time / boot-time before any filter), but share the same lossy shape.
- The fix at `applySessions` (forwarding the cmd) covers the preview-dismiss, kill-refresh, and rename-refresh paths uniformly. Other discard sites (`WithInsideTmux`, `ProjectsLoadedMsg`) are out of scope for this bug but worth a sweeping check during implementation.

---

## Fix Direction

### Chosen Approach

Forward the `tea.Cmd` returned by `m.sessionList.SetItems(...)` out of `applySessions` so callers can propagate it.

- Change the signature from `func (m *Model) applySessions(sessions []tmux.Session)` to `func (m *Model) applySessions(sessions []tmux.Session) tea.Cmd` and return whatever `SetItems` returns.
- Update the two call sites to propagate the cmd:
  - `SessionsMsg` handler (`internal/tui/model.go:893-918`) — batch the returned cmd into whatever the handler already returns; the cmd is `nil` at boot-time so this path is functionally unchanged.
  - `previewSessionsRefreshedMsg` handler (`internal/tui/model.go:1011-1023`) — return the cmd directly (handler currently returns `nil`).

Result: when `SetItems` is called against a `FilterApplied` list, the deferred `filterItems` cmd actually fires, the list's `FilterMatchesMsg` consumer repopulates `filteredItems`, and the Sessions page renders the filtered list intact with the previously-highlighted row still visible. The committed filter survives the preview-dismiss round-trip — matching `TestPreviewEscPreservesCommittedFilter`'s documented intent.

The latent variants (`killAndRefresh`, `renameAndRefresh`, `previewAttachBailMsg`) all route through `applySessions`, so this single change fixes them in lock-step. No further call-site work.

**Deciding factor:** The bug is mechanical lossy plumbing of bubbles/list's documented contract — propagating the cmd is the minimum sufficient fix, low-risk, single-point change. Alternative fixes either fight the library or change well-tested behaviour (filter retention) unnecessarily.

### Options Explored

1. **Forward the SetItems cmd from applySessions** *(chosen)* — minimal, library-aligned, fixes preview-dismiss + kill-refresh + rename-refresh + preview-bail uniformly.
2. **Clear the committed filter on preview-dismiss** *(rejected)* — defeats the existing documented intent (`TestPreviewEscPreservesCommittedFilter` and the `previewDismissedMsg` handler comment explicitly preserve filter state byte-identically). Users committed for a reason.
3. **Intercept `FilterMatchesMsg` / re-route the filter pipeline** *(rejected)* — overbuilt. The library already does the right thing if we propagate its cmd.

### Discussion

User priorities: ship a narrow bugfix that resolves the reported symptoms cleanly without expanding scope.

Surfaced edge case (recorded as a follow-up, NOT in this bugfix's scope):
- `reanchorSessionCursor` runs synchronously in the `previewSessionsRefreshedMsg` handler **before** `FilterMatchesMsg` fires; after `SetItems`, `filteredItems` is nil, so `VisibleItems()` returns empty and the reanchor silently no-ops. This pre-existing latent behaviour means the cursor preservation guarantee on the externally-killed-during-preview path under an applied filter is currently weakened. Out of scope here — fix the disappearing-list / lost-filter symptoms first; file a separate follow-up for sequencing reanchor after the refilter so the cursor lands on the intended item under filter.

### Testing Recommendations

- **Add a `VisibleItems()` assertion** to `TestPreviewEscFilterStatePreservedAcrossDismissWithRefresh` (`internal/tui/pagepreview_refetch_test.go:270-301`). The existing test exercises the buggy path but only asserts filter metadata. Use `visibleSessionNames(got)` (or equivalent) and assert equality with the expected filtered slice. This locks in the fix and prevents the same wrong-axis miss recurring.
- **Optional but recommended**: add a small test in the kill-refresh flow that applies a filter, kills a session via the modal, and asserts the list still renders filtered items after the `SessionsMsg` round-trip. Codifies the latent-variant coverage.
- The existing `TestPreviewEscPreservesCommittedFilter` does not need to change — it correctly asserts filter retention; it just didn't reach `applySessions` (no wired `SessionLister`).

### Risk Assessment

- **Fix complexity:** Low — signature change plus two return-statement adjustments.
- **Regression risk:** Low — `SetItems` returns `nil` when filter state is Unfiltered, so the boot path and all currently-unfiltered call paths are functionally unchanged. The change is strictly more correct, never less.
- **Recommended approach:** Regular release, single PR. No feature flag, no hotfix urgency (UX friction only — no data, no tmux state involved).

---

## Notes

- Related recently-completed work: `session-scrollback-preview`, `enter-attaches-from-preview`, `preview-visual-distinction`, `preview-keymap-discoverability`, `space-dismisses-preview` — preview pathway has had multiple iterations; this bug may be a regression introduced by one of them.
