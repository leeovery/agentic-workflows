# Specification: Esc After Preview Hides Session List

## Specification

### Problem Statement

When a user filters the Sessions page, commits the filter, opens the scrollback preview, and dismisses it with `Esc`, the session list visibly disappears and the committed filter text is silently discarded. A second `Esc` is required to restore the list, which then appears unfiltered.

**Expected behaviour:** After `Esc` dismisses the preview, the Sessions page renders the previously filtered list intact — committed filter still applied, matching rows visible, highlighted row preserved.

**Reproduction:**

1. Launch the TUI (`portal open` / `x`) — Sessions page visible.
2. Press `/` to enter filter mode; type until the list narrows.
3. Press `Enter` to commit the filter.
4. Press `Space` to open the scrollback preview for the highlighted session.
5. Press `Esc` — **bug**: list appears empty, filter text gone.
6. Press `Esc` again — list reappears, unfiltered.

**Severity:** Low — UX friction only. No tmux state affected; no data destroyed. User must re-type the filter to recover.

### Scope

**In scope:**

- The blank-list / lost-filter symptom on the preview-dismiss path.
- The same latent symptom on every other code path that routes through `applySessions` — kill-refresh, rename-refresh, externally-killed-during-preview bail.
- Sweep of the remaining `SetItems` discard sites in `internal/tui/model.go` (`Model.WithInsideTmux`, `ProjectsLoadedMsg` handler), plus an audit of sibling `bubbles/list` mutator APIs (`SetItem`, `InsertItem`, `RemoveItem`) against `m.sessionList` and `m.projectList`. The sibling APIs share the same "returns a cmd you must propagate" contract — any call site that discards the cmd against a filtered list would blank-render the same way. Propagate the cmd at any sites found; if none exist, record the audit outcome (sites checked + result) in the PR description.

**Out of scope:**

- Cursor reanchoring under an applied filter on the externally-killed-during-preview branch. `reanchorSessionCursor` runs synchronously in the `previewSessionsRefreshedMsg` handler before the bubbles list's deferred `FilterMatchesMsg` repopulates `filteredItems`, so `VisibleItems()` is empty at reanchor time and the call silently no-ops. After this bugfix, the refilter still completes asynchronously — making reanchor land on a filtered row needs a different mechanism (e.g. stash the target name and reanchor on the refilter-completion tick). Filed as a separate follow-up; narrow surface (only the kill-during-preview-while-filtered path).

### Root Cause

`applySessions` (`internal/tui/model.go:660-668`) calls `m.sessionList.SetItems(ToListItems(filtered))` and discards the `tea.Cmd` that `bubbles/list` returns.

`bubbles/list.SetItems` (`bubbles@v1.0.0/list.go:385-397`) has a two-phase contract when the list's `filterState != Unfiltered`:

1. **Synchronously** nils `m.filteredItems` — the next render shows zero visible items.
2. **Returns a `filterItems` cmd** that asynchronously runs the filter against the new items and emits `FilterMatchesMsg` (`bubbles@v1.0.0/list.go:1260-1284`). The list's own `Update` consumes this message (`bubbles@v1.0.0/list.go:833-835`) to repopulate `filteredItems`.

When `applySessions` drops the returned cmd, the `FilterMatchesMsg` never fires; `filteredItems` stays nil; the list renders empty while `filterState` is still `FilterApplied`. A second `Esc` is then routed by the list's `handleBrowsing` path to `KeyMap.ClearFilter` (`bubbles@v1.0.0/list.go:864-867`), which calls `resetFiltering()` — clearing the committed filter text and flipping back to `Unfiltered`. The list re-renders with all items; the committed filter is permanently lost.

**Execution path on the buggy Esc:**

1. `internal/tui/pagepreview.go:467-468` — `tea.KeyEsc` in `previewModel.Update` returns `previewDismissedMsg{}`.
2. `internal/tui/model.go:954-974` — top-level Update receives `previewDismissedMsg`, captures `m.preview.session`, calls `m.exitPreviewToSessions(captured)`.
3. `internal/tui/model.go:743-747` — `exitPreviewToSessions` sets `m.activePage = PageSessions`, zeros `m.preview`, returns the `refreshSessionsAfterPreviewCmd` `tea.Cmd`.
4. Refresh cmd resolves → emits `previewSessionsRefreshedMsg`.
5. `internal/tui/model.go:1011-1023` — handler calls `m.applySessions(msg.Sessions)`, then `m.reanchorSessionCursor(msg.PreserveName)`, returns `(m, nil)`.
6. `internal/tui/model.go:660-668` — `applySessions` calls `m.sessionList.SetItems(...)` and **discards the returned cmd**.

The preview-dismiss path is the most prominently affected because `previewSessionsRefreshedMsg` always fires after a `Space` keystroke on the Sessions page, where a filter may be applied. The same `applySessions` call site is reached from `killAndRefresh` (`model.go:1517-1525`), `renameAndRefresh` (`model.go:1571-1579`), and the `previewAttachBailMsg` handler (`model.go:975-993`) — all of which can run while a filter is applied. The `x` (kill) and `r` (rename) keystrokes are accepted on the Sessions page even when a committed filter is active, which is what makes `killAndRefresh` and `renameAndRefresh` legitimately reachable from a filtered list. Those paths share the same blank-list / lost-filter outcome.

`Model.WithInsideTmux` (`model.go:403-411`) and the `ProjectsLoadedMsg` handler (`model.go:936-947`) also call `SetItems` and discard the cmd. They are currently safe because they run before any filter is applied, but the lossy plumbing shape is identical.

### Why It Wasn't Caught

- `TestPreviewEscFilterStatePreservedAcrossDismissWithRefresh` (`internal/tui/pagepreview_refetch_test.go:270-301`) exercises the exact buggy sequence (filter + Space + Esc with a wired `SessionLister` driving the refresh) but only asserts `FilterState`, `FilterValue`, and `IsFiltered`. None of those probe `filteredItems`. A single `VisibleItems()` assertion would have caught the bug — wrong axis was checked, not a missing test.
- `TestPreviewEscPreservesCommittedFilter` (`internal/tui/pagepreview_dismiss_test.go:121-151`) uses `pressSpaceThenEsc` which discards the refresh cmd (`updated3, _ := got2.Update(msg)` at line 41), and `modelWithSeams` does not wire a `SessionLister` — so the test never reaches `previewSessionsRefreshedMsg` / `applySessions`. False sense of coverage.
- Bubble Tea's "returns a cmd you must forward" pattern is easy to miss for void-returning helpers — no compile-time signal.
- **Regression provenance:** the preview-dismiss refresh path that exposes the bug was added by `enter-attaches-from-preview` (to handle the externally-killed-session case). That work introduced the first realistic scenario in which `applySessions` is called against a filtered list — the original `SessionsMsg`-only usage was filter-naive, so the lossy plumbing in `applySessions` had no live consequence until then. The wrong-axis assertion in the new test was added in the same surrounding preview-pathway work, which is why the regression and the test gap landed together.

### Fix Approach

Forward the `tea.Cmd` returned by `m.sessionList.SetItems(...)` out of every call site in `internal/tui/model.go` that currently discards it.

**Primary change — `applySessions`:**

- Change the signature from `func (m *Model) applySessions(sessions []tmux.Session)` to `func (m *Model) applySessions(sessions []tmux.Session) tea.Cmd`.
- Return whatever `m.sessionList.SetItems(...)` returns.
- Update both call sites to propagate the cmd:
  - **`SessionsMsg` handler** (`internal/tui/model.go:893-918`) — batch the returned cmd into whatever the handler already returns. The cmd is `nil` at boot time, so the boot path is functionally unchanged. On `killAndRefresh` / `renameAndRefresh` round-trips, the cmd carries the deferred refilter.
  - **`previewSessionsRefreshedMsg` handler** (`internal/tui/model.go:1011-1023`) — return the cmd directly (handler currently returns `nil`).

**Secondary sweep — other `SetItems` discard sites:**

- **`Model.WithInsideTmux`** (`internal/tui/model.go:403-411`) — `WithInsideTmux` is called before `tea.NewProgram(m).Run()` at TUI construction time (`cmd/open.go:360`), so there is no `tea.Cmd` dispatcher available to batch into. At this point the session list is empty and no filter can be applied, so `SetItems` returns `nil` unconditionally. Keep the chained `*Model` return shape, but capture the returned cmd locally and assert/comment that it is always `nil` at this site (e.g. `if cmd := m.sessionList.SetItems(...); cmd != nil { panic("unreachable: WithInsideTmux runs before any filter can be applied") }`, or a quieter discard-with-comment variant). The intent is to lock in the safe invariant without rewiring the constructor signature; if the call site ever moves to a point where a filter can be applied, the panic surfaces the breakage immediately.
- **`ProjectsLoadedMsg` handler** (`internal/tui/model.go:936-947`) — call site updates the *projects* list, not the sessions list. Apply the same propagation: capture the cmd from the `SetItems` call and batch/return it from the handler. Currently safe (handler runs before any project filter can be committed), but treated the same way.

**Mechanism:** When `SetItems` is called against a `FilterApplied` list, the propagated `filterItems` cmd actually fires; the list's `FilterMatchesMsg` consumer repopulates `filteredItems`; the Sessions (or Projects) page renders the filtered list intact with the previously-highlighted row still visible. When the list is `Unfiltered`, `SetItems` returns `nil` and behaviour is unchanged.

Result: the preview-dismiss path, the kill-refresh path, the rename-refresh path, and the externally-killed-during-preview bail path all preserve their committed filter across the round-trip via a single point change in `applySessions`. The secondary sweep eliminates the same lossy shape from the remaining call sites.

**Implementation notes for the implementer:**

- The current `SessionsMsg` handler (`internal/tui/model.go:893-915`) returns `nil` on both branches it can reach after `applySessions`. After the change, return the propagated cmd directly on the post-applySessions branches — no `tea.Batch` is needed at this site (a Batch is only required if the same return expression also carries another cmd; presently it does not).
- The `previewAttachBailMsg` handler (`internal/tui/model.go:975-993`) reaches `applySessions` transitively via `exitPreviewToSessions` → `refreshSessionsAfterPreviewCmd` → `previewSessionsRefreshedMsg`. The bail path is therefore covered by the `previewSessionsRefreshedMsg` call-site fix — no separate change is required at the bail handler itself.
- The `ProjectsLoadedMsg` handler propagation is shape-consistency only: it is not reachable today with a committed projects filter (the handler fires before the page transitions to `pageProjects`, and the projects list filter is never applied at this point). No production-reachable failure exists to test against, and no test is added for this site — a contrived test would have to construct a state that cannot occur in production. Acceptance criterion #5 is satisfied by the code change and the diff review.
- The current `ProjectsLoadedMsg` handler (`internal/tui/model.go:936-947`) returns `m, nil`. After the change, capture the cmd from the `SetItems` call and return it directly — no `tea.Batch` is needed at this site (the handler does not currently combine multiple cmds at the return point).

### Alternatives Considered (Rejected)

1. **Clear the committed filter on preview-dismiss.** Defeats the existing documented intent (`TestPreviewEscPreservesCommittedFilter` and the `previewDismissedMsg` handler explicitly preserve filter state byte-identically). Users committed for a reason.
2. **Intercept `FilterMatchesMsg` / re-route the filter pipeline.** Overbuilt. The library already does the right thing if its cmd is propagated.

### Risk

- **Fix complexity:** Low — signature change in one helper, plus mechanical cmd propagation at the call sites.
- **Regression risk:** Low — `SetItems` returns `nil` when filter state is `Unfiltered`, so all currently-unfiltered call paths are functionally unchanged. The change is strictly more correct, never less.
- **Release:** Regular release, single PR. No feature flag, no hotfix urgency (UX friction only).

### Test Coverage

**Lock in the fix at the wrong-axis miss site:**

- `TestPreviewEscFilterStatePreservedAcrossDismissWithRefresh` (`internal/tui/pagepreview_refetch_test.go:270-301`) already exercises the exact buggy sequence (filter applied + `Space` + `Esc` with a wired `SessionLister` driving the refresh) but only asserts `FilterState`, `FilterValue`, and `IsFiltered`. **Add two assertions:**
  - A `VisibleItems()` assertion — use `visibleSessionNames(got)` (or equivalent helper already in the test package) and assert equality with the expected filtered slice. This is the single assertion that would have caught the original bug and is what prevents the same wrong-axis miss recurring.
  - A cursor-index assertion — assert the bubbles list's selected index (`got.sessionList.Index()` or via an existing helper) points at the previously-highlighted row. This locks in AC #1's cursor-preservation clause; without it, a future handler reordering or library behaviour shift could regress cursor preservation silently.

**Cover the latent variant:**

- Add a test in the kill-refresh flow that:
  1. Applies a committed filter to the Sessions page (mirror the filter-commit drive used by `TestPreviewEscFilterStatePreservedAcrossDismissWithRefresh`).
  2. Drives the full `x` kill-confirm modal flow via real keystrokes (`x` to open the confirm modal, then the confirm key as used elsewhere in the package's kill tests) — do **not** shortcut by hand-crafting a `SessionsMsg`. The point is to exercise the production message path through `killAndRefresh` → `SessionsMsg` → `applySessions`.
  3. Wire a `SessionKiller` seam that succeeds and a `SessionLister` seam that returns the post-kill session slice (sans the killed row), following the same mock/seam wiring pattern used by the existing kill tests in the package.
  4. Asserts post-refresh state with `visibleSessionNames(got)` against the expected filtered slice (the same helper used by the augmented preview test). Slice-equality is the assertion; length-only is insufficient.

  Codifies the latent-variant coverage; ensures `killAndRefresh` going through `applySessions` retains the filter.

**Test scope — one representative latent-variant test is sufficient:**

The kill-refresh test above is the canonical regression test for the latent variants. The rename-refresh variant (`renameAndRefresh`), the externally-killed-during-preview bail (`previewAttachBailMsg`), and the `ProjectsLoadedMsg` Projects-page propagation all route through the same `applySessions` (or analogous propagation) and are covered by mechanical inspection of the diff plus the kill-refresh test. **Do not add separate tests for each latent variant** — the spec deliberately scopes test work to the single representative case; reviewers verify the rest by reading the diff.

**Test harness must drain the propagated refilter cmd:**

The fix mechanism is asynchronous: when `SetItems` runs against a `FilterApplied` list it synchronously nils `filteredItems` and returns a `filterItems` `tea.Cmd`; that cmd asynchronously emits `FilterMatchesMsg`, which the bubbles list's own `Update` consumes to repopulate `filteredItems`. Only after this round-trip does `VisibleItems()` return the filtered slice.

The existing helper `pressSpaceThenEscWithRefresh` (`internal/tui/pagepreview_refetch_test.go:76-112`) discards the cmd returned by the refresh-message `Update` call (`updated4, _ := got3.Update(refreshMsg)` at line 106). After the fix, that discarded cmd is the propagated `filterItems` cmd. **Extend the helper** (and any analogous helper used by the new kill-refresh test) to:

1. Capture the cmd returned by the `Update` call that processes `previewSessionsRefreshedMsg` / `SessionsMsg`.
2. Invoke the cmd to obtain its `tea.Msg` (the `FilterMatchesMsg` emitted by `filterItems`).
3. Feed that message back through the model's `Update`. After this second `Update` call, `VisibleItems()` returns the refiltered slice and the `visibleSessionNames` / cursor-index assertions can run as prescribed.

Without this harness adjustment the prescribed `visibleSessionNames` assertion will fail on a correctly-fixed implementation. The cursor-index assertion is less directly impacted (the pre-existing cursor index remains intact while `filteredItems` is nil because `reanchorSessionCursor` early-returns on empty `VisibleItems()`), but the helper extension is required regardless to validate the visibility assertion. Update the helper at the test-package level — do not duplicate the drain logic per-test.

**Existing test left unchanged:**

- `TestPreviewEscPreservesCommittedFilter` (`internal/tui/pagepreview_dismiss_test.go:121-151`) correctly asserts filter retention; it just never reached `applySessions` (no wired `SessionLister`, and `pressSpaceThenEsc` discards the refresh cmd). Its assertions are still correct — no change needed. The new `VisibleItems()` assertion in `TestPreviewEscFilterStatePreservedAcrossDismissWithRefresh` is the one that exercises the fix end-to-end.

### Acceptance Criteria

1. **Primary symptom resolved:** On the documented reproduction path (filter → commit → Space → Esc), the Sessions page renders the filtered list intact after the single `Esc` keystroke. The committed filter text is preserved; matching rows remain visible; the previously-highlighted row remains the cursor.
2. **Latent variants resolved:** Killing a session via `x` while a filter is applied leaves the filtered list rendered after the refresh. Renaming a session via `r` while a filter is applied leaves the filtered list rendered after the refresh. Externally-killed-during-preview bail (`previewAttachBailMsg`) leaves the filtered list rendered after the refresh.
3. **Boot path unchanged:** Initial Sessions/Projects load (no filter applied) renders identically to before — `SetItems` returns `nil` in the unfiltered case, so the propagated cmd is a no-op.
4. **`applySessions` returns the `SetItems` cmd:** Signature is `func (m *Model) applySessions(sessions []tmux.Session) tea.Cmd`; both call sites batch/return the returned cmd.
5. **Secondary sweep applied:** `Model.WithInsideTmux` and the `ProjectsLoadedMsg` handler no longer discard the cmd returned by `SetItems`. Sibling mutators (`SetItem`, `InsertItem`, `RemoveItem`) on `m.sessionList`/`m.projectList` are audited; any discard sites found are fixed the same way; the audit outcome is recorded.
6. **Test additions:** `TestPreviewEscFilterStatePreservedAcrossDismissWithRefresh` includes a `VisibleItems()` assertion. A new test covers the kill-refresh-under-filter scenario.
7. **No regressions in existing TUI tests:** `go test ./internal/tui/...` passes.

---

## Working Notes
