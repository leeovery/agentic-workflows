# Specification: File Browser Alias Breadcrumb

## Specification

## Problem & Chosen Approach

### What was reported

Saving an alias from the shared file-browser "save alias for highlighted dir" flow (the `a`-key, `handleAliasSave` in `internal/ui/browser.go`) emits **no** `aliases: set` audit breadcrumb in `portal.log`. The flow uses the un-audited two-step `store.Set(...)` + `store.Save()` rather than the audited `SetAndSave` chokepoint, and the `AliasSaver` interface it depends on exposes only `Load`/`Set`/`Save` — so the audited path is structurally unreachable from this caller.

### What the investigation established

The flow is **unreachable dead code in production** — the defect is latent, not active:

- The only production file-browser construction (`internal/tui/model.go`) uses the plain `ui.NewFileBrowser(...)` constructor, leaving `aliasStore == nil`.
- The `a`-key handler is gated on `m.aliasStore != nil`, so in the production TUI pressing `a` just appends `a` to the filter text — the alias prompt never opens and `handleAliasSave` never runs.
- `NewFileBrowserWithAlias` (the only constructor that injects an alias store and enables the prompt) is called **only** from a test file.
- The whole file browser is reachable only via the Projects-page `b` key, which the user confirmed they never use.

No alias is created via this flow today, so the missing breadcrumb produces no observable symptom.

### Decision — remove the file browser feature in full

Decided with the user at findings review (2026-06-09). Because the reported bug sits on unreachable dead code, an in-place audit-fix would only polish code that never runs. The user confirmed they never use the file browser and want it gone. **The fix for this bug is to delete the file-browser feature** — this resolves the latent audit-bypass by removal and reclaims two dead packages. No `SetAndSave` rewiring is performed.

Alternatives rejected at findings review:
- **(A) Audit-fix in place** (route `handleAliasSave` onto `SetAndSave`) — polishes code that never executes; leaves unused surface area.
- **(B) Wire it up and finish the feature** — net-new feature work the user doesn't want.
- **(C) Remove the feature entirely** — **chosen**.

**Work-type — remains a `bugfix`.** This work unit stays typed as `bugfix` even though the fix is a full removal. Bugfix is the only work type whose pipeline includes an Investigation phase — which is already complete here. Re-typing to `quick-fix` or `feature` would orphan this investigation (those pipelines never read it) and force re-seeding the findings by hand. The removal's blast radius (two packages + TUI state-machine surgery) also warrants the spec/planning/review rigor that quick-fix skips. A bugfix concluding "the fix is deletion" is the cleanest framing; expect a bugfix that adds no behaviour and writes no new tests.

### Scope boundary — what must stay green and unchanged

These are independent of the file browser and must not be touched:

- The alias CLI (`cmd/alias.go`; `portal alias set/rm/list`).
- The projects-modal alias editor (`internal/tui/model.go` `aliasEditor` → `SetAndSave`).
- The resolver chain (path → alias → zoxide → TUI filter fallback).
- The Sessions, Projects, and Preview pages.
- `createSession` — survives; it has three non-browser callers. Only the browser→create-session entry point is removed.
- `cfg.cwd` / `m.cwd` — consumed by `WithCWD` and `viewCWD` / `createSession(m.cwd)`, independent of the browser.

### Out-of-scope context note (not a requirement of this fix)

Established during the findings-review side-investigation, captured so it isn't lost: the alias system is wired, functional, and out-prioritises zoxide in the resolver chain (the user simply had no matching alias for the names they tried). A noted UX sharp edge — an exact-match alias miss silently degrades to a fuzzy zoxide search, which can open a *different* directory than intended with **no indication the alias was skipped**. This is **not** part of the removal and must **not** become an acceptance criterion; it is recorded only as context for whoever revisits the resolver later.

## Removal Manifest

The removal was exhaustively swept (every importer, every exported symbol, all tests, help text, docs) and independently cross-verified by a second pass. **Line numbers are as of the investigation date — the implementation must re-confirm each, but the *set* of sites below is complete as of that date.**

**Re-sweep at implementation start (required).** The set-completeness guarantee above is relative to the codebase at investigation time. Before deleting anything, run a fresh repo-wide reference sweep — grep for `internal/ui`, `internal/browser`, `pageFileBrowser`, `DirLister`, `WithDirLister`, and the `b`/"browse" strings — **and also for the bare quoted tokens `"ui"` and `"browser"`** (allow-list / map-key references such as the surface-audit `preExistingPackages` map use the bare package name, which the path-prefixed `internal/ui` grep misses). Reconcile any site **not** in this manifest before proceeding. Treat the manifest as the verified baseline, not a closed set: a reference newly added between investigation and implementation (especially a doc/comment reference, which the compile+test gate would not catch) must be caught here.

**Sequencing:** delete the two packages **last** (or expect transient compile breaks) — remove the consumers first, then the packages.

### Packages deleted entirely

Remove the **entire directory** in each case (`rm -rf`), not just the files named below. The file lists are a confirmation of current contents as of the investigation, not the deletion target — if the directory holds any file not listed (e.g. one added between investigation and implementation), it is still part of the removal.

- **`internal/ui/`** — remove the whole directory. Current contents: `browser.go`, `browser_test.go`, `testmain_isolation_test.go`. Nothing but the file browser lives here. Sole importers are `internal/tui/model.go` (+ its test), both edited below.
- **`internal/browser/`** — remove the whole directory. Current contents: `listing.go`, `listing_test.go`, `testmain_isolation_test.go`. After `internal/ui` and `cmd/open.go`'s `osDirLister` are gone it has **zero** importers (verified: only consumers were `internal/ui`, `cmd/open.go`, and three test files, all removed/edited).

### `internal/tui/model.go` — edit sites

- L20 — remove `internal/ui` import (becomes unused).
- L33-34 — remove `pageFileBrowser` const + comment from the `page` iota. `pagePreview` renumbers 4→3 — **safe** (iota-safety verified below).
- L119-120 — remove `DirLister` comment + `type DirLister = ui.DirLister`.
- L189 / L190 / L194 — remove fields `dirLister`, `startPath`, `fileBrowser`.
- L574-580 — remove `WithDirLister` Option + its doc comment.
- L721 — remove the `projectHelpKeys` `b`/"browse" binding.
- L728-729 — update the `commandPendingHelpKeys` doc comment (it lists `b` as a shown key: *"Only enter (run here), n, b, /, and q are shown"*) to drop `b`.
- L732 — remove the `commandPendingHelpKeys` `b`/"browse" binding.
- L1363-1366 — remove the `ui.BrowserDirSelectedMsg` and `ui.BrowserCancelMsg` cross-view handlers. **`createSession` STAYS** — it has 3 other callers (project-enter L1666, `createSessionInCWD` L2241); only the browser→create-session entry point goes.
- L1544-1545 — remove the `case pageFileBrowser:` update arm.
- L1637-1638 — remove the `case isRuneKey(msg, "b"):` dispatch on the Projects page.
- L1649-1656 — remove `handleBrowseKey()`.
- L1971-1977 — remove `updateFileBrowser()`.
- L2269-2270 — remove the `case pageFileBrowser:` view arm.

### `cmd/open.go` — edit sites

- L11 — remove `internal/browser` import.
- L332-338 — remove `osDirLister` type + `ListDirectories` method + comment.
- L349 — remove `dirLister tui.DirLister` field from `tuiConfig`.
- L370 — remove the `tui.WithDirLister(cfg.dirLister, cfg.cwd)` opt. **Keep L371 `tui.WithCWD(cfg.cwd)`.**
- L505 — remove `dirLister: &osDirLister{}` from the cfg literal. **Keep `cwd: cwd`** (still consumed by `WithCWD`).

### `internal/tui/model_test.go` — test edits

- L13 / L17 — remove `internal/browser` and `internal/ui` imports (both become unused after the deletions below).
- L775-785 — remove the `mockDirLister` type + method (unused after deletions).
- **Delete whole functions:**
  - `TestFileBrowserIntegration` (L787-1034) — every subtest is the `b`→browser→select/cancel flow.
  - `TestFileBrowserFromProjectsPage` (L5551-5758) — entirely browser.
- **Delete browser subtests (enclosing function survives):**
  - `TestCommandPendingMode` → "browse selection applies pending command" (L2371-2414).
  - `TestNewWithFunctionalOptions` → "WithDirLister enables file browser" (L3031-3066).
  - `TestCommandPendingBrowseAndNKey` → "browse directory selection forwards command…" (L6737-6785) and "browse cancel returns to locked Projects page…" (L6787-6829). Survivor is n-key-only — **rename the survivor to `TestCommandPendingNKey`** (the `Browse` in the old name is now stale; this is the decided end-state, not optional).
  - `TestCommandPendingEscAndQuit` → "Esc in file browser…" (L7182-7229).
- **Rework (keep test, strip browser setup):**
  - `TestKillSession` → "NewWithAllDeps supports kill" — drop L1671 (`mockDirLister`) + the `WithDirLister(...)` arg at L1673; keep the kill assertion.
  - `TestNewWithFunctionalOptions` → "all options combined" — drop the `dirLister` var (L3080-3084) + `WithDirLister(...)` at L3092; keep the rest.

### `cmd/open_test.go` — edit sites

- L18 — remove `internal/browser` import.
- L703-708 — remove `stubDirLister` type + `ListDirectories` (the `browser.DirEntry` use lives inside it, removed with it).
- L773 — remove `dirLister: &stubDirLister{}` from `defaultTestTUIConfig`'s literal (**required** — the production `tuiConfig.dirLister` field is gone; leaving it is a compile error). Keep `cwd`.

### Other `*_test.go` (incidental coupling — preview tests)

- `internal/tui/pagepreview_entry_test.go`:
  - **Delete** `TestSpaceOnFileBrowserPageDoesNotCallNewPreviewModel` (L264-286) — its premise (being on the file-browser page) ceases to exist; the guarantee "Space only previews from the Sessions page" is already covered by sibling `TestSpaceOnProjectsPageDoesNotCallNewPreviewModel` (L240-262).
  - L12 — drop the stale `internal/ui/browser_test.go` doc reference in the file-header comment.
- `internal/tui/pagepreview_refetch_test.go` L27 — update the comment to drop the `pageFileBrowser → PageSessions` transition mention.
- `internal/tui/pagepreview_bracket_test.go` L14 — drop the stale `internal/ui/browser.go` doc reference (compiles, but dangling pointer).
- `internal/tui/pagepreview_surface_audit_test.go` — in `TestSurfaceAudit_NoNewPackageForPreview`'s `preExistingPackages` allow-list, remove the stale `"browser":` (L295) and `"ui":` (L321) map keys. These name the two deleted packages; after removal they are dangling references to directories that no longer exist. **The build/test gate does not catch this** — the audit only errors on a directory present on disk but *absent* from the allow-list, so unused allow-list keys leave the test green. **The bare `"ui"` key also escapes the path-prefixed re-sweep greps** (`internal/ui` requires the prefix), so it must be removed explicitly here.

### Docs / non-Go

- `README.md:253` — *"The TUI has four views: session list, project picker, file browser, and scrollback preview."* → three views (drop "file browser").
- `CLAUDE.md` L48 (`tui` row) — update the page state machine (`Loading → Sessions → Projects → FileBrowser → Preview` → drop FileBrowser) and the "`pagePreview` arm (peer of `pageFileBrowser`)" phrasing.
- `CLAUDE.md` L52 — delete the `browser` package-table row.
- `CLAUDE.md` L60 — delete the `ui` package-table row.
- `go.mod` / `go.sum` — no change (internal packages).
- No `.goreleaser*`, `Makefile`, shell-completion, embed, or build-tag references to the file browser (swept — none).

### Iota-safety + dangling-reference verification

- **Iota-safe.** `type page int` constants are pure in-memory runtime state — no int↔page cast, no numeric comparison, no JSON/prefs serialization; both `pageFileBrowser` and `pagePreview` are unexported and all tests compare the symbolic constant. Removing `pageFileBrowser` and letting `pagePreview` renumber is transparent.
- **No dangling reads.** `m.startPath` and `m.dirLister` are read only inside the removed sites; nothing else references them after removal.
- **`cfg.cwd` / `m.cwd` MUST stay** — consumed by `WithCWD` (open.go L371) and `viewCWD` / `createSession(m.cwd)` (model.go L443 / L2241), independent of the browser.

## Acceptance Criteria & Testing

### Acceptance gate

- `go build ./...` is green.
- `go test ./...` is green.
- **Zero remaining references** to the removed feature. The authoritative gate is the green `go build ./...` + green `go test ./...` above — those catch any surviving reference in compiled or tested code. The following symbol list is a **non-exhaustive set of spot-check grep targets**, not a closed checklist: `internal/ui`, `internal/browser`, `pageFileBrowser`, `DirLister`, `WithDirLister`, `osDirLister`, `mockDirLister`, `stubDirLister`, `handleBrowseKey`, `updateFileBrowser`, `FileBrowserModel`, `NewFileBrowser`, `NewFileBrowserWithChecker`, `NewFileBrowserWithAlias`, `BrowserDirSelectedMsg`, `BrowserCancelMsg`, `BrowserDirSelectErrMsg`, `BrowserAliasSavedMsg`, `BrowserAliasSaveErrMsg`, `AliasSaver`, `GitRootResolver`, `PathChecker`, `browser.DirEntry`, `browser.ListDirectories`, or a `b`/"browse" keybinding. A grep hit in a non-compiled context (doc comment, prose) that the build/test gate would miss must also be reconciled.
- The `internal/ui` and `internal/browser` directories no longer exist.
- Manual check (blocking — this is the fix's only behavioural verification, since no new tests are added): on the Projects page, `b` is no longer a recognised command. With the `projectHelpKeys` binding and the `case isRuneKey(msg, "b")` dispatch removed, `b` falls through to the default `projectList.Update(msg)` handler — its expected post-removal behaviour is a visible **no-op that opens no view** (it must not open the file browser or any other page). Confirm pressing `b` opens nothing.

### Testing requirements

- After removal, `go build ./...` and `go test ./...` must pass with no dangling references to `ui` / `browser` / `pageFileBrowser` / `DirLister`.
- Spot-check (blocking) that the Sessions, Projects, and Preview pages, the alias CLI (`portal alias set/rm/list`), and the projects-modal alias editor are unchanged and functional. Pass criterion: each behaves exactly as before the removal — no page fails to open, no command regresses. These manual checks are run by whoever lands the change and gate acceptance alongside the build/test pass.
- Net test delta is **removal, not addition** — the deleted packages take their own tests with them; no new tests are required.

### Risk

- **Fix complexity:** Low–Medium — mechanical deletion spread across two packages, the central TUI model, the `cmd` wiring, and docs; easy to leave a dangling reference, so a clean compile + full-test pass is the gate.
- **Regression risk:** Low — all removed code is unreachable in production except the `b` keybinding, which the user confirmed they never use.
- **Release:** regular release (no special rollout).

---

## Working Notes
