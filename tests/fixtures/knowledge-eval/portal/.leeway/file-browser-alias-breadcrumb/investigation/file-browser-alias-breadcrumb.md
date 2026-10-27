# Investigation: File-Browser Alias Creation Emits No Audit Breadcrumb

## Symptoms

### Problem Description

**Expected behavior:**
Saving an alias from the shared file-browser "save alias for highlighted dir"
flow (the `a`-key, `handleAliasSave` in `internal/ui/browser.go`, wired into
`cmd/open.go`) should emit an `aliases: set` audit breadcrumb in `portal.log`,
exactly like every other production alias-mutation site.

**Actual behavior:**
Aliases created this way leave **no** `aliases: set` breadcrumb in `portal.log`.
The flow uses the un-audited two-step `store.Set(...)` + `store.Save()` rather
than the audited `SetAndSave` seam. The `AliasSaver` interface this flow depends
on exposes only `Load` / `Set` / `Save` — so the audited path is structurally
unreachable from this caller.

### Manifestation

- Missing observability: no `aliases: set` log line for file-browser-created
  aliases.
- Defeats the State-mutation audit-trail spec guarantee of "a single place per
  file where the breadcrumb can't be forgotten."

### Reproduction Steps

1. Launch the file browser (`portal open` → TUI file browser, or `cmd/open.go`
   path).
2. Highlight a directory and press `a` to save an alias for it.
3. Inspect `portal.log` — observe no `aliases: set` breadcrumb is emitted.

**Reproducibility:** Always (structural — the audited seam is not wired in).

### Environment

- **Affected environments:** All (local — this is a CLI/TUI tool).
- **Platform:** n/a
- **User conditions:** Any alias created via the file-browser `a`-key flow.

### Impact

- **Severity:** Low. Observability gap, and — per the reachability finding in
  Analysis — currently **latent**: the file-browser alias-save flow is not wired
  into production, so no alias is created this way today. The defect is a
  landmine that activates the moment the flow is wired with a real alias store.
- **Scope:** Zero live aliases today; every file-browser-created alias if/when
  the flow is activated.
- **Business impact:** Weakens the observability spec's chokepoint guarantee
  ("a single place per file where the breadcrumb can't be forgotten") by leaving
  a reachable-by-construction bypass on the alias store.

### References

- Seed: `seeds/2026-06-02-file-browser-alias-breadcrumb.md` (inbox:bug)
- Source: review of `portal-observability-layer/portal-observability-layer`
- Precedent: Task 3-5 instrumented `cmd/alias.go` + `internal/tui/model.go` via
  the audited `SetAndSave(name, path, "cli")` seam; the file-browser site was
  outside that task's literal "Do" list.

---

## Analysis

### Initial Hypotheses

The file-browser alias-save flow (`handleAliasSave`) is a third production
alias-mutation site still using the un-audited `Set` + `Save` two-step. Its
`AliasSaver` interface omits the audited `SetAndSave` method, so the breadcrumb
cannot be emitted. Suspected fix: extend `AliasSaver` to expose `SetAndSave`,
thread `handleAliasSave` onto it, and update the file-browser mock accordingly.

### Code Trace

**The defect site — `internal/ui/browser.go`:**

- `handleAliasSave` (`browser.go:248`) is the `a`-key alias-save flow. Its
  command closure (`browser.go:263-278`) performs the **un-audited two-step**:
  ```go
  if _, err := store.Load(); err != nil { ... }
  store.Set(name, resolved)        // browser.go:272 — in-memory only
  if err := store.Save(); err != nil { ... }  // browser.go:273 — writes file, no breadcrumb
  ```
- The `AliasSaver` interface (`browser.go:44-49`) exposes only
  `Load() / Set(name,path) / Save() error` — the audited `SetAndSave` seam is
  **structurally unreachable** from this caller.

**The audited seam that should be used — `internal/alias/store.go`:**

- `(*Store).SetAndSave(name, path, via string) error` (`store.go:170`) is the
  chokepoint: classifies the op from the pre-mutation map (`set` / `modify` /
  `set-noop`), performs the in-memory `Set`, runs `Save`, and emits **exactly
  one** breadcrumb under the `aliases` component (INFO on success, WARN with
  `error_class` on persist failure, DEBUG `set-noop` skipping the write). This
  is the spec's "single place per file where the breadcrumb can't be forgotten."
- The raw `(*Store).Set` (`store.go:136`) and `(*Store).Save` (`store.go:109`)
  are deliberately breadcrumb-free; `Save` writes the **entire** in-memory map
  (`s.List()`), so a `Load()` must precede any mutation to avoid clobbering
  other aliases — this is why `handleAliasSave` and the precedent callers all
  `Load` first.

**Precedent callers already on the audited seam (Task 3-5):**

- `cmd/alias.go:81` → `store.SetAndSave(name, normalised, "cli")` (store
  pre-loaded by `loadAliasStore`, which calls `Load` internally at
  `cmd/alias.go:96`).
- `internal/tui/model.go:1951` → `m.aliasEditor.SetAndSave(newAlias,
  m.editProject.Path, "cli")` (projects-edit modal). Its `AliasEditor`
  interface (`model.go:106`) already requires `SetAndSave` — the exact shape to
  mirror onto `AliasSaver`.

**Key files involved:**

- `internal/ui/browser.go` — defect site (`handleAliasSave` + `AliasSaver`).
- `internal/alias/store.go` — the audited `SetAndSave` seam (target).
- `internal/ui/browser_test.go` — `mockAliasSaver` (`:716`) implements
  `Load`/`Set`/`Save`; the only production-adjacent constructor call
  `NewFileBrowserWithAlias` lives here (`:754`), see below.
- `cmd/alias.go`, `internal/tui/model.go` — precedent for the fix.

### Reachability finding (diverges from the seed's framing)

**`handleAliasSave` is NOT currently reachable in production — the defect is
latent, not active.** The seed/discovery called it "a *third* production
alias-mutation site"; the code trace shows it is a *would-be* site that is not
wired in:

1. The only production file-browser construction is
   `internal/tui/model.go:1653` → `ui.NewFileBrowser(m.startPath, m.dirLister)`
   — the **plain** constructor, which leaves `aliasStore == nil`.
2. The `a`-key handler (`browser.go:210`) is gated on `m.aliasStore != nil`, so
   in the production TUI pressing `a` just appends `a` to the filter text; the
   alias prompt never opens and `handleAliasSave` never runs.
3. `NewFileBrowserWithAlias` (`browser.go:102`) — the only constructor that
   injects an alias store and enables the `a`-key prompt — is called **only**
   from `internal/ui/browser_test.go:754`.
4. Git confirms intent: the introducing commit `160d1e9c` ("file browser alias
   shortcut", Feb 2026) touched only `browser.go` + its test; it never wired
   the constructor into the TUI or `cmd/open.go`. `cmd/open.go` loads the alias
   store and passes it as the TUI's `aliasEditor` (the audited projects-modal
   path), not into the file browser.

So today **no alias is created via this flow**, which is exactly why the missing
breadcrumb produced no observable symptom — and why Task 3-5 (which converts
observable mutation sites) had no failing-grep signal pointing here.

### Root Cause

`handleAliasSave` was written (commit `160d1e9c`, Feb 2026) **before** the
observability layer's audited `SetAndSave` seam existed (`portal-observability-layer`,
June 2026), using the then-only-available `Load`→`Set`→`Save` two-step. The
`AliasSaver` interface was shaped around those three methods. When
`portal-observability-layer` Task 3-5 introduced `SetAndSave` as the
audit chokepoint and converted the alias-mutation callers, it migrated the two
**reachable** callers (`cmd/alias.go`, `internal/tui/model.go`) but left this
caller on the un-audited two-step. The interface's omission of `SetAndSave`
makes the audited path structurally impossible to reach from the file browser.

**Why this happens:** the audit-trail guarantee depends on every mutation
flowing through the store's combined `SetAndSave` chokepoint. A caller that
holds an interface exposing the raw `Set`+`Save` primitives can bypass the
chokepoint entirely — which is what `AliasSaver` permits and `handleAliasSave`
does.

### Contributing Factors

- **Interface predates the seam.** `AliasSaver` was minted before `SetAndSave`
  existed; nothing forced it to adopt the audited method when the seam shipped.
- **Out of Task 3-5's literal scope.** Task 3-5's "Do" list named only
  `cmd/alias.go` and `internal/tui/model.go`; this site wasn't enumerated.
- **No production reachability = no symptom.** Because the flow is dead in prod,
  there was no missing-breadcrumb grep failure to catch it.

### Why It Wasn't Caught

- The flow is unreachable in production, so no integration/manual path exercises
  it — the missing breadcrumb is invisible.
- `browser_test.go`'s `mockAliasSaver` mirrors the un-audited interface
  (`Load`/`Set`/`Save`) and asserts only the final map state, not log output —
  so the tests pass while the breadcrumb is absent.
- The observability spec's audit-trail acceptance focused on the store-method
  chokepoint and the named reachable callers, not on auditing every interface
  that fronts the alias store.

### Blast Radius / Removal Manifest (of the decided fix — full removal)

Exhaustively swept (every importer, every exported symbol, all tests, help
text, docs) and independently cross-verified by a second pass. Line numbers are
as of investigation date — implementation must re-confirm, but the *set* of
sites is complete. **Sequencing note:** delete the two packages last (or expect
transient compile breaks) — remove the consumers first, then the packages.

#### Packages deleted entirely
- **`internal/ui/`** — `browser.go`, `browser_test.go`, `testmain_isolation_test.go`.
  Nothing but the file browser lives here. Sole importers: `internal/tui/model.go`
  (+ its test) — both edited below.
- **`internal/browser/`** — `listing.go`, `listing_test.go`,
  `testmain_isolation_test.go`. After `internal/ui` and `cmd/open.go`'s
  `osDirLister` are gone it has **zero** importers (verified: only consumers were
  `internal/ui`, `cmd/open.go`, and three test files, all removed/edited).

#### `internal/tui/model.go` — edit sites
- L20 — remove `internal/ui` import (becomes unused).
- L33-34 — remove `pageFileBrowser` const + comment from the `page` iota.
  `pagePreview` renumbers 4→3 — **safe** (iota-safety verified below).
- L119-120 — remove `DirLister` comment + `type DirLister = ui.DirLister`.
- L189 / L190 / L194 — remove fields `dirLister`, `startPath`, `fileBrowser`.
- L574-580 — remove `WithDirLister` Option + its doc comment.
- L721 — remove the `projectHelpKeys` `b`/"browse" binding.
- **L728-729 — update the `commandPendingHelpKeys` doc comment** (it lists `b` as
  a shown key: *"Only enter (run here), n, b, /, and q are shown"*) to drop `b`.
- L732 — remove the `commandPendingHelpKeys` `b`/"browse" binding.
- L1363-1366 — remove the `ui.BrowserDirSelectedMsg` and `ui.BrowserCancelMsg`
  cross-view handlers. **`createSession` STAYS** — it has 3 other callers
  (project-enter L1666, `createSessionInCWD` L2241); only the browser→create-
  session entry point goes.
- L1544-1545 — remove the `case pageFileBrowser:` update arm.
- L1637-1638 — remove the `case isRuneKey(msg, "b"):` dispatch on the Projects
  page.
- L1649-1656 — remove `handleBrowseKey()`.
- L1971-1977 — remove `updateFileBrowser()`.
- L2269-2270 — remove the `case pageFileBrowser:` view arm.

#### `cmd/open.go` — edit sites
- L11 — remove `internal/browser` import.
- L332-338 — remove `osDirLister` type + `ListDirectories` method + comment.
- L349 — remove `dirLister tui.DirLister` field from `tuiConfig`.
- L370 — remove the `tui.WithDirLister(cfg.dirLister, cfg.cwd)` opt.
  **Keep L371 `tui.WithCWD(cfg.cwd)`.**
- L505 — remove `dirLister: &osDirLister{}` from the cfg literal.
  **Keep `cwd: cwd`** (still consumed by `WithCWD`).

#### `internal/tui/model_test.go` — test edits
- L13 / L17 — remove `internal/browser` and `internal/ui` imports (both become
  unused after the deletions below).
- L775-785 — remove the `mockDirLister` type + method (unused after deletions).
- **Delete whole functions:**
  - `TestFileBrowserIntegration` (L787-1034) — every subtest is the
    `b`→browser→select/cancel flow.
  - `TestFileBrowserFromProjectsPage` (L5551-5758) — entirely browser.
- **Delete browser subtests (enclosing function survives):**
  - `TestCommandPendingMode` → "browse selection applies pending command"
    (L2371-2414).
  - `TestNewWithFunctionalOptions` → "WithDirLister enables file browser"
    (L3031-3066).
  - `TestCommandPendingBrowseAndNKey` → "browse directory selection forwards
    command…" (L6737-6785) and "browse cancel returns to locked Projects page…"
    (L6787-6829). Survivor is n-key-only — optional rename to
    `TestCommandPendingNKey`.
  - `TestCommandPendingEscAndQuit` → "Esc in file browser…" (L7182-7229).
- **Rework (keep test, strip browser setup):**
  - `TestKillSession` → "NewWithAllDeps supports kill" — drop L1671
    (`mockDirLister`) + the `WithDirLister(...)` arg at L1673; keep the kill
    assertion.
  - `TestNewWithFunctionalOptions` → "all options combined" — drop the
    `dirLister` var (L3080-3084) + `WithDirLister(...)` at L3092; keep the rest.

#### `cmd/open_test.go` — edit sites
- L18 — remove `internal/browser` import.
- L703-708 — remove `stubDirLister` type + `ListDirectories`.
- L706 — (the `browser.DirEntry` use lives inside `stubDirLister`, removed with it).
- L773 — remove `dirLister: &stubDirLister{}` from `defaultTestTUIConfig`'s
  literal (**required** — the production `tuiConfig.dirLister` field is gone;
  leaving it is a compile error). Keep `cwd`.

#### Other `*_test.go` (incidental coupling — preview tests)
- `internal/tui/pagepreview_entry_test.go`:
  - **Delete** `TestSpaceOnFileBrowserPageDoesNotCallNewPreviewModel`
    (L264-286) — its premise (being on the file-browser page) ceases to exist;
    the guarantee "Space only previews from the Sessions page" is already covered
    by sibling `TestSpaceOnProjectsPageDoesNotCallNewPreviewModel` (L240-262).
  - L12 — drop the stale `internal/ui/browser_test.go` doc reference in the
    file-header comment.
- `internal/tui/pagepreview_refetch_test.go` L27 — update the comment to drop the
  `pageFileBrowser → PageSessions` transition mention.
- `internal/tui/pagepreview_bracket_test.go` L14 — drop the stale
  `internal/ui/browser.go` doc reference (compiles, but dangling pointer).

#### Docs / non-Go
- `README.md:253` — *"The TUI has four views: session list, project picker,
  file browser, and scrollback preview."* → three views (drop "file browser").
- `CLAUDE.md` L48 (`tui` row) — update the page state machine
  (`Loading → Sessions → Projects → FileBrowser → Preview` → drop FileBrowser)
  and the "`pagePreview` arm (peer of `pageFileBrowser`)" phrasing.
- `CLAUDE.md` L52 — delete the `browser` package-table row.
- `CLAUDE.md` L60 — delete the `ui` package-table row.
- `go.mod` / `go.sum` — no change (internal packages).
- No `.goreleaser*`, `Makefile`, shell-completion, embed, or build-tag
  references to the file browser (swept — none).

#### Iota-safety + dangling-reference verification
- **Iota-safe.** `type page int` constants are pure in-memory runtime state — no
  int↔page cast, no numeric comparison, no JSON/prefs serialization; both
  `pageFileBrowser` and `pagePreview` are unexported and all tests compare the
  symbolic constant. Removing `pageFileBrowser` and letting `pagePreview`
  renumber is transparent.
- **No dangling reads.** `m.startPath` and `m.dirLister` are read only inside the
  removed sites; nothing else references them after removal.
- **`cfg.cwd` / `m.cwd` MUST stay** — consumed by `WithCWD` (open.go L371) and
  `viewCWD` / `createSession(m.cwd)` (model.go L443 / L2241), independent of the
  browser.

#### NOT affected (independent — must stay green)
The alias CLI (`cmd/alias.go`, `portal alias set/rm/list`), the projects-modal
alias editor (`internal/tui/model.go` `aliasEditor` → `SetAndSave`), the resolver
chain (path → alias → zoxide → TUI filter fallback), and the
Sessions/Projects/Preview pages. None depend on the file browser. `createSession`
survives (3 non-browser callers).

#### Acceptance gate
`go build ./...` and `go test ./...` both green, with zero remaining references
to `internal/ui`, `internal/browser`, `pageFileBrowser`, `DirLister`,
`WithDirLister`, `osDirLister`, `mockDirLister`, `stubDirLister`,
`handleBrowseKey`, `updateFileBrowser`, or a `b`/"browse" keybinding. Manual
check: Projects page no longer reacts to `b`.

---

## Fix Direction

### Chosen Approach — REMOVE the file browser feature in full

Decided with the user at findings review (2026-06-09). The reported "bug" (alias
save emits no breadcrumb) is on **unreachable dead code**, so a behaviour-
preserving audit-fix would only polish code that never runs. The user confirmed
they never use the file browser (reachable only via Projects-page `b`) and want
it gone. **The fix for this bug is to delete the file-browser feature** — which
resolves the latent audit-bypass by removal and reclaims two dead packages. No
`SetAndSave` rewiring is needed.

Execute the Blast-Radius removal above: delete `internal/ui` + `internal/browser`,
excise the TUI integration and `cmd/open.go` wiring, remove/adjust the affected
tests, and update `CLAUDE.md`.

### Options considered (findings review)

- **(A) Audit-fix in place** — route `handleAliasSave` onto `SetAndSave`. Rejected:
  polishes code that never executes; leaves unused surface area.
- **(B) Wire it up + finish the feature** — swap in `NewFileBrowserWithAlias`,
  handle the saved/error messages (confirmation flash), audited save. Rejected:
  the user doesn't want the feature; this is net-new feature work.
- **(C) Remove the feature entirely — CHOSEN.** Deletes the bug by deletion,
  removes two dead packages, no behaviour change to anything the user uses.

### Work-type categorization (decided)

Keep `work_type: bugfix`. Rationale: valid types are
`epic / feature / bugfix / cross-cutting / quick-fix`; there is no "removal"
type, and **bugfix is the only type with an Investigation phase** — which we have
already completed. Re-typing to quick-fix or feature would orphan this
investigation (those pipelines never read it) and force re-seeding the findings
by hand. A bugfix legitimately concluding "the fix is deletion" is the cleanest,
lowest-friction framing; the removal's blast radius (two packages + TUI state-
machine surgery) also wants the spec/planning/review rigor that quick-fix skips.

### Discussion (findings-review journey)

- The seed framed this as auditing a "third production alias-mutation site." The
  user challenged *why* we'd fix it at all — which forced the reachability trace
  that flipped the framing: the site is unreachable dead code, not a live gap.
- The user then questioned the whole feature: they never use the file browser
  and couldn't recall why it was added. A side-investigation confirmed the alias
  system itself works and out-prioritises zoxide (the user simply had no matching
  alias for the names they'd tried), so removing the browser touches nothing they
  rely on.
- Decision shifted from "audit-fix" (A) → "remove entirely" (C). The user
  explicitly weighed re-typing the work unit and landed on keeping it a bugfix
  once it was clear bugfix is the only pipeline with the (already-completed)
  Investigation phase.
- The user's final, load-bearing instruction was **completeness**: this
  investigation feeds the spec and plan, so the removal surface must be
  exhaustive and accurate. That drove the full sweep + independent cross-check
  now captured in the Removal Manifest above.

### Testing Recommendations

- After removal: `go build ./...` and `go test ./...` green with no dangling
  references to `ui` / `browser` / `pageFileBrowser` / `DirLister`.
- Spot-check that the Projects page no longer reacts to `b` and that the
  Sessions/Projects/Preview pages and alias CLI / projects-modal alias editor
  are unchanged.
- Net test delta is removal, not addition (the deleted packages take their own
  tests with them).

### Risk Assessment

- **Fix complexity:** Low–Medium — mechanical deletion, but spread across two
  packages + the central TUI model + cmd wiring + docs; easy to leave a dangling
  reference, so a compile + full-test pass is the gate.
- **Regression risk:** Low — all removed code is unreachable in production except
  the `b` keybinding, which the user confirmed they never use.
- **Recommended approach:** Regular release.

---

## Notes

Seed flagged this as a clear, narrowly-scoped bugfix. Investigation corrected one
material fact: the alias-save site is **not** a live production mutation site — it
is unreachable dead code, so the original "missing breadcrumb" framing was a
latent landmine, not an active defect. The findings review then broadened: the
user confirmed the whole file browser is unused, and the decided fix is **full
removal** (option C) rather than auditing dead code. Kept as `work_type: bugfix`
because that is the only pipeline with the Investigation phase already done here.

Adjacent facts established during review (not part of this fix, captured for
context): the alias system **is** wired and functional and takes priority over
zoxide in the resolver chain; the user simply had no matching alias for the names
they tested. A noted UX sharp edge (out of scope): an exact-match alias miss
silently degrades to a fuzzy zoxide search, which can open a *different*
directory than intended with no indication the alias was skipped.

The earlier severity note still holds: severity is Low, and the fix-scope
question (A/B/C above) was resolved at findings review in favour of (C) removal.
