# Investigation: Persistent "no host-local terminal" banner on remote clients; multi-select blocked on unsupported terminals

## Symptoms

### Problem Description

**Expected behavior:**

On remote/unsupported terminals the picker should behave sensibly:

1. **Banner split by identity shape.** Drop the proactive "no host-local terminal" banner entirely for the **NULL/remote** identity (mosh/SSH, no host-local terminal) so the standard `Sessions ··· N` section header (count + grouping-mode suffix) renders as normal. **Keep** the proactive banner for *named* unsupported terminals (e.g. Apple Terminal) where it is actionable — it carries the bundle id (the copy-paste key for `terminals.json`) and the `see docs` hint.
2. **Multi-select fully disabled on any unsupported resolution** (named and NULL alike). Pressing `m` fails immediately rather than entering the mode and dead-ending at the N≥2 Enter. The blocked `m` surfaces a **transient error banner that self-clears on the next keypress** (a flash), and `m` does **not** appear in the `?` help keymap when unavailable.

**Actual behavior:**

- On a pure-remote client (mosh/SSH, NULL terminal identity from spawn detection) the §6.2 proactive unsupported-terminal banner shows **permanently** for the whole picker session and, because it *replaces* the standard section header (`unsupportedBannerActive` in `internal/tui/model.go`), the session count and grouping-mode suffix are lost. On a remote client this is pure noise — nothing the user can act on.
- Multi-select `m` still **enters** the mode on any unsupported terminal, letting the user mark sessions only to dead-end at the N≥2 Enter with a reactive no-op flash (`⚠ no host-local terminal — nothing opened`, per `internal/tui/burst_unsupported_noop_test.go`) — a misleading affordance for a burst that can never fire.

### Manifestation

- A permanent `⚠ no host-local terminal` warning band replacing the `Sessions ··· N` section header on every remote picker launch.
- A walkable-but-dead multi-select flow: `m` enters, sessions mark, N≥2 Enter no-ops with a reactive flash.

### Reproduction Steps

1. Log into the Mac over mosh from an iPad (pure-remote client; no host-local terminal attached to the tmux server).
2. Open the picker (`portal open` / `x`).
3. Observe: the `⚠ no host-local terminal` banner shows permanently; the `Sessions ··· N` header (count + grouping suffix) is gone.
4. Press `m`, mark ≥2 sessions, press Enter → atomic no-op with reactive flash, selection intact.

**Reproducibility:** Always (any picker launch where spawn detection resolves the NULL identity, or a named unsupported terminal for the multi-select dead-end).

### Environment

- **Affected environments:** local (developer machine, remote access)
- **Browser/platform:** tmux picker TUI; remote clients (mosh/SSH) resolve NULL identity; named unsupported terminals (e.g. Apple Terminal) resolve a bundle id but no adapter.
- **User conditions:** picker launched with spawn detection resolving an unsupported terminal (NULL/remote OR named-unsupported).

### Impact

- **Severity:** Low (cosmetic-but-constant + misleading affordance; no data loss)
- **Scope:** every remote picker launch; every unsupported-terminal multi-select attempt
- **Business impact:** reads as ugly/broken even though behaving as designed; wasted user effort on a guaranteed dead-end.

### References

- Seed: `seeds/2026-07-16-persistent-no-host-terminal-banner.md` (inbox:bug)
- Discovery: `discovery/sessions/session-001.md`
- Related in-flight: `cli-verb-surface-redesign` (owns CLI multi-target burst block — out of scope here)
- Related bug: `2026-07-15--remote-trigger-spawns-on-local-terminal` (once its trigger-locality gate is fixed, every remote login resolves NULL → this banner would appear on all remote use)

---

## Analysis

### Hypotheses

**Checkpoint depth:** straight-through — the bug is contained to `internal/tui`, the mechanism is near-confirmed from recon (discovery framed this a light confirm pass); the genuine design forks belong to the spec, not the trace.

- **H1 — Persistent NULL banner** [confirmed]
  The section-header swap gates only on `DetectUnsupported()` (resolution-based, TRUE for NULL/remote), with no identity-shape discriminator, so the NULL/remote resolution claims the header row permanently and drops `Sessions ··· N`.
  _Basis:_ `unsupportedBannerActive()` = `DetectUnsupported() && !multiSelectMode` (model.go:4681); `DetectUnsupported` = `detectResolved && detectResolution == ResolutionUnsupported` (spawn_detect.go:117), true for both NULL and named-unsupported.
  _Evidence:_ `applySectionHeader` (model.go:4780) swaps in `renderUnsupportedHeader` whenever `unsupportedBannerActive()` — and `renderUnsupportedHeader` (section_header.go:178) ALREADY branches on `bundleID == ""` to draw the NULL variant `⚠ no host-local terminal` (no identity, no `see docs`). The single predicate is also read by `activeNoticeBand` (notice_band.go:371) to suppress the By-Tag signpost, so the two consumers can never drift. Adding `!m.detectIdentity.IsNull()` to `unsupportedBannerActive()` drops NULL (standard header returns) while keeping named — the render already knows the split; only the gate lacks the discriminator.

- **H2 — `m` enters unconditionally** [confirmed]
  `handleMultiSelectToggle`'s entry branch has NO `DetectUnsupported()` gate; the only unsupported gate is downstream at `decideBurst`'s N≥2 Enter (the reactive `— nothing opened` no-op).
  _Basis:_ model.go:3508-3524 (entry, ungated); burst_progress.go:425 (reactive arm).
  _Evidence:_ the `!m.multiSelectMode` entry branch (model.go:3509) sets `multiSelectMode=true` + mark-on-entry with no detection read. The sole live entry point is this handler (dispatched at model.go:3433); `WithInitialMultiSelect` (model.go:1006) is a construction/capture-harness option, not a keypress path. The reactive gate at `decideBurst` (burst_progress.go:425) fires only at the N≥2 Enter — so the user walks enter → mark → Enter before hitting it.

- **H3 — `m` shows in `?` help unconditionally** [confirmed]
  The help modal is fed the static `sessionsKeymap()` with no detection-aware filtering; `m` is a help-only (non-Core) entry, so the FOOTER is unaffected — only the help modal.
  _Basis:_ keymap.go:89-105; help modal call model.go:4547.
  _Evidence:_ `m` is `{Key:"m", ..., }` with no `Core:true` (keymap.go:97), so `renderCondensedFooter` (footer.go:65) never lists it — the footer needs no change. The help modal renders EVERY descriptor entry (help_modal.go:141) from `sessionsKeymap()` passed at model.go:4547. **Suppression mechanism confirmed viable:** filtering `m` out of the descriptor slice passed to `renderHelpModalOnClearedCanvas` when `DetectUnsupported()` keeps `sessionsKeymap()` static, so `keymap_dispatch_guard_test.go` (which probes the static descriptor with an unwired-detection model → `m` supported → enters mode) still passes. A parameterised `sessionsKeymap()` that conditionally omits `m` would instead break that guard — so the call-site filter is the guard-safe shape.

- **H4 — (contributing/edge) async detection keeps the reactive backstop load-bearing** [confirmed]
  Detection is ASYNC — `DetectUnsupported()` is false until resolved, so an entry-time `m`-block cannot fully replace the reactive `decideBurst` no-op: the in-flight→resolve race keeps the reactive backstop load-bearing, and raises a UX fork (eject from the mode when detection resolves unsupported mid-mode?).
  _Basis:_ async dispatch spawn_detect.go:83-92; `TestBurstUnsupported_DeferredThenUnsupported`.
  _Evidence:_ detection runs on Bubble Tea's command goroutine (`maybeDispatchDetectionCmd`, spawn_detect.go:83), resolving later via `terminalDetectedMsg` (model.go:2460). Before it resolves, `detectResolved==false` → `DetectUnsupported()==false` → the entry-block does NOT fire, so the user CAN enter multi-select in the in-flight window. The `terminalDetectedMsg` arm (model.go:2471-2485) caches the resolution but does NOT eject an already-open multi-select mode (it only resolves a `pendingBurstEnter` deferral via `decideBurst`). So `decideBurst`'s unsupported arm remains the backstop for "entered before resolve, then Enter". The fix ADDS a proactive entry-block; it must RETAIN the reactive no-op.

### Trace lines (agreed order)

1. Banner predicate chain — `unsupportedBannerActive` → `applySectionHeader` AND `activeNoticeBand` (the single predicate both read); confirm an `IsNull()` discriminator drops NULL while keeping named.
2. `m`-entry handler — `handleMultiSelectToggle` entry vs toggle branch; confirm the live entry point is the only ungated site (`WithInitialMultiSelect` is capture-harness only).
3. Help-modal descriptor feed — `sessionsKeymap()` → `renderHelpModalOnClearedCanvas`; confirm `keymap_dispatch_guard_test` tolerates a conditionally-absent `m`.
4. Reactive backstop + async race — why the entry-block does NOT remove `decideBurst`'s unsupported arm; scope the in-flight window.
5. Flash lifecycle + copy — `setFlash` self-clears on next actionable key (model.go:3328); the blocked-entry copy variant vs `spawn.UnsupportedNoopMessage`'s `— nothing opened` burst-response wording (design fork for the spec).

### Code Trace

**Locus 1 — Banner (persistent NULL band).**
- `Model.View` (sessions arm) → `applySectionHeader(listView)` — model.go:4720.
- `applySectionHeader` §6.2 branch (model.go:4780): `if m.unsupportedBannerActive() → replaceHeaderLine(listView, renderUnsupportedHeader(name, bundleID, …))`. Replaces the FIRST list line (the title row) so the `Sessions ··· N` header is gone for the session.
- `unsupportedBannerActive()` (model.go:4681) = `DetectUnsupported() && !multiSelectMode` — **no identity-shape check.**
- `DetectUnsupported()` (spawn_detect.go:117) = `detectResolved && detectResolution == ResolutionUnsupported` → TRUE for NULL (remote/mosh) AND named-undriven alike.
- `renderUnsupportedHeader` (section_header.go:178) + `unsupportedLeftCluster` (section_header.go:223) already split on `bundleID == ""`: NULL → `⚠ no host-local terminal` (no identity, no `see docs`); named → `⚠ unsupported terminal — <name> · <bundleID>` + `see docs`.
- Second consumer: `activeNoticeBand` (notice_band.go:371) reads the SAME `unsupportedBannerActive()` to suppress the By-Tag signpost. Fixing the one predicate fixes both surfaces coherently.

**Locus 2 — `m`-entry (no proactive block).**
- Dispatch: `updateSessionList` `case isRuneKey(msg, "m") → handleMultiSelectToggle()` — model.go:3433.
- `handleMultiSelectToggle` entry branch (model.go:3509-3524): `if !m.multiSelectMode { multiSelectMode=true; … mark-on-entry … }` — **no `DetectUnsupported()` read.**
- Reactive gate downstream: `handleMultiSelectEnter` → `beginBurst`/`decideBurst` (burst_progress.go:414); `if m.DetectUnsupported() { …preflight…; emitUnsupportedNoop; setFlash(unsupportedFlashText(id)); return }` (burst_progress.go:425-445). Fires only at N≥2 Enter.
- Live entry point is unique: `WithInitialMultiSelect` (model.go:1006) is construction-time (capture harness), not a keypress.

**Locus 3 — `?` help lists `m` unconditionally.**
- Footer: `renderSessionsFooter → renderCondensedFooter(sessionsKeymap(), …)` (footer.go:65) lists only `Core` entries; `m` is non-Core (keymap.go:97) → **absent from footer already** (no footer change needed).
- Help modal: `Model.View` modalHelp arm → `renderHelpModalOnClearedCanvas(sessionsKeymap(), …)` (model.go:4547) → `helpModalBodyRows` renders every non-`RightAligned` entry (help_modal.go:141) → `m` always shown.
- Guard: `keymap_dispatch_guard_test.go:143` probes `m` against a plain `sessionsGuardModel` (detection unwired → supported) and asserts `MultiSelectActive()`. It reads the **static** `sessionsKeymap()` (line 184), so a call-site descriptor filter (drop `m` only in the help-modal feed when `DetectUnsupported()`) leaves the guard green; a parameterised keymap would not.

**Locus 4 — async race / reactive backstop.**
- `maybeDispatchDetectionCmd` (spawn_detect.go:83) dispatches `Detect()` on the command goroutine on reaching PageSessions; resolves later via `terminalDetectedMsg` (model.go:2460).
- The arm caches identity/adapter/resolution (model.go:2471-2473) and, only if `pendingBurstEnter`, calls `decideBurst` (model.go:2482-2484). It does **not** eject an open multi-select mode.
- Consequence: the proactive entry-block (gated on `DetectUnsupported()`) is inert during the in-flight window, so `decideBurst`'s unsupported arm stays load-bearing for "entered-before-resolve → Enter".

**Copy source.**
- `unsupportedFlashText(id)` (burst_progress.go:460) → `spawn.UnsupportedNoopMessage(id)` (message.go:77): NULL → `no host-local terminal — nothing opened`; named → `unsupported terminal — <name> · <bundleID> — nothing opened`. Same renderer feeds the CLI open burst (`cmd/open_burst_run.go:168`). The `— nothing opened` clause is a burst RESPONSE — semantically off for a pre-emptive `m`-entry block that attempts nothing (design fork for the spec).

**Flash lifecycle (self-clear on next keypress — already satisfied).**
- `setFlash` (model.go:1969) records `flashText`; `activeNoticeBand` (notice_band.go:361) gives the flash the §11 notice-band slot (a SEPARATE row below the title separator — co-renders with a named banner on the header row).
- Auto-clear: `updateSessionList` (model.go:3328) `if m.flashText != "" && isActionableKey(msg) { clearFlash() }` — an actionable key clears the flash and falls through to its handler. So a blocked-`m` flash self-clears on the next keypress with no new mechanism.

### Root Cause

Two independent design gaps in the `restore-host-terminal-windows` unsupported-terminal UX, both stemming from the single decision to key everything off the coarse **resolution** (`DetectUnsupported`) without distinguishing the two shapes an unsupported resolution can take (NULL/remote vs named-undriven), and from placing the multi-select unsupported gate **reactively** (at N≥2 Enter) rather than at mode entry:

1. **Banner has no identity-shape gate.** `unsupportedBannerActive()` (model.go:4681) fires on `DetectUnsupported()` for *any* unsupported resolution, so the NULL/remote identity permanently claims the section-header row and drops `Sessions ··· N` + the grouping suffix. The renderer already knows the NULL/named split (`renderUnsupportedHeader` branches on `bundleID == ""`); only the *gate* is blind to it. For NULL the banner carries no actionable content (no bundle id, no `see docs`), so it is pure noise.

2. **Multi-select is gated reactively, not at entry.** `handleMultiSelectToggle`'s entry branch (model.go:3509) has no `DetectUnsupported()` read, and `m` is listed unconditionally in the `?` help (help_modal.go via model.go:4547). The only unsupported gate is `decideBurst`'s N≥2-Enter no-op (burst_progress.go:425). So on any unsupported terminal (NULL or named) the user can enter the mode, mark sessions, and walk to the last keypress before the burst reveals it can never fire — a misleading affordance.

**Why this happens:** the feature modelled "unsupported" as one flat state served by one banner and one reactive burst-time no-op. That is correct for the *named-undriven* case (the banner is actionable, the no-op is a rare last-mile guard) but wrong for the *NULL/remote* case and wrong as the *primary* multi-select gate — the affordance should never be reachable when detection has already resolved unsupported.

**Causal-precision note (from validation).** The banner's *permanence* is produced by the once-only detection cache (`detectDispatched` latch → cached `detectResolved`/`detectResolution`, spawn_detect.go:84-87; nothing re-detects, and `rebuildSessionList` does not re-run detection), which is re-read every frame. The missing `IsNull()` gate decides only *whether* that cached unsupported resolution renders as the banner. The fix (add `!IsNull()` to the gate) still fully resolves the NULL symptom — the cache is not itself a defect — but the exact chain is "once-cached unsupported resolution × identity-blind gate", not "the gate makes it permanent".

### Contributing Factors

- **Coarse `DetectUnsupported()` predicate.** A single resolution-based boolean collapses NULL and named-undriven, which the banner needs to tell apart. `IsNull()` exists (identity.go:24) but is not consulted at the banner gate.
- **Reactive placement of the burst-time gate.** `decideBurst` was the natural (and, for the async race, still-necessary) gate, so no proactive entry gate was added — the affordance was left fully walkable.
- **Async detection.** `DetectUnsupported()` is false until `terminalDetectedMsg` resolves, so any proactive entry-block is inert in the in-flight window — a proactive block is additive, it cannot replace the reactive backstop.
- **Static keymap descriptor.** `sessionsKeymap()` is a pure constant with no detection input, so the help modal cannot drop `m` without a call-site filter.
- **Behaving-as-designed.** Not a regression: every surface works to its original spec; the spec simply did not cover the NULL/remote case or treat multi-select as unreachable-when-unsupported.

### Why It Wasn't Caught

- **Spec scope.** `restore-host-terminal-windows` designed the unsupported banner for the *named* identity (the delivered `sessions-unsupported-terminal.png` frame is Apple Terminal) and accepted the reactive no-op as the multi-select guard; the NULL/remote-only picker and the "walkable dead-end" UX were simply out of the frame.
- **Detection environment.** On the reporter's normal (mixed) setup a local Ghostty resolves *supported*, so the NULL banner never showed in day-to-day dev use; it only surfaces on a pure-remote client (mosh/SSH), an under-exercised path. (And `2026-07-15--remote-trigger-spawns-on-local-terminal` currently masks it further — its fix will make every remote login resolve NULL.)
- **Tests encode the old contract.** `burst_unsupported_noop_test.go` asserts the reactive no-op *as the intended behaviour* — the dead-end walk was tested-in, not caught.

### Blast Radius

**Directly affected (the fix touches these):**
- `internal/tui/spawn_detect.go` / `model.go` — `unsupportedBannerActive()` gains an `IsNull()` discriminator (banner split).
- `internal/tui/model.go` — `handleMultiSelectToggle` entry branch gains a proactive `DetectUnsupported()` block + blocked-entry `setFlash`.
- `internal/tui/model.go:4547` (help-modal feed) — call-site descriptor filter dropping `m` when `DetectUnsupported()`.
- `internal/tui/burst_progress.go` — `decideBurst` unsupported arm RETAINED (async-race backstop); possibly a new blocked-entry copy distinct from `spawn.UnsupportedNoopMessage`.
- Tests: `burst_unsupported_noop_test.go` (rework the "resolved-unsupported → enter → mark → Enter" fixtures to route through the in-flight path, since entry is now blocked post-resolve); new coverage for banner-split, `m`-block flash, help-suppression.

**Potentially affected (share the code/pattern, verify no drift):**
- `activeNoticeBand` (notice_band.go:371) — reads the same `unsupportedBannerActive()`; the By-Tag signpost suppression must track the banner split (NULL now shows the signpost again when applicable).
- Visual fixtures / Paper frames referencing the unsupported banner (`sessions-unsupported-terminal`); a NULL fixture would now render the standard header.
- Consistency with the CLI unsupported message owned by `cli-verb-surface-redesign` (shared `spawn.UnsupportedNoopMessage`) — keep copy coherent, do not silently diverge.

**Explicitly NOT affected (scope boundary):** the CLI multi-target `portal open <a> <b> …` N≥2 burst block (owned by `cli-verb-surface-redesign`); `sessions.json`, the daemon capture loop, restore, `prefs.json` (spawn's near-zero state footprint is unchanged).

---

## Fix Direction

### Chosen Approach

Four coordinated TUI-side sub-fixes, plus two forks resolved to their recommended options. No CLI change, no state footprint (spawn's near-zero footprint is unchanged).

1. **Banner split by identity.** Add an `IsNull()` discriminator to `unsupportedBannerActive()` (model.go:4681) so it is true only for a NAMED unsupported identity. The named banner (bundle id + `see docs`) is unchanged; NULL/remote falls through to the standard `Sessions ··· N` header, and because `activeNoticeBand` reads the same predicate, the By-Tag no-tags signpost returns for a NULL client. Single-point change covering both consumers coherently.

2. **Proactive `m`-entry block.** Gate `handleMultiSelectToggle`'s entry branch (model.go:3509) on `DetectUnsupported()` — the mode does not open on any unsupported terminal (NULL or named); a transient flash fires instead. `decideBurst`'s reactive no-op (burst_progress.go:425) is **retained** as the async-race backstop (the entry-block is inert while detection is in flight, so the reactive path still catches an entered-before-resolve → Enter).

3. **Help-modal `m`-suppression.** Filter `m` out of the descriptor passed to the help modal at the call site (model.go:4547) when `DetectUnsupported()`. `sessionsKeymap()` stays static so `keymap_dispatch_guard_test` stays green; the footer is unaffected (`m` is non-Core).

4. **Blocked-entry flash copy.** New copy distinct from `spawn.UnsupportedNoopMessage`'s `— nothing opened` (a burst response, semantically wrong for a pre-emptive block). Exact wording is spec detail; keep coherent with the CLI unsupported message. **Copy-shape constraint (from fix validation):** on a NAMED terminal the block flash co-renders with the persistent named banner (banner on the section-header row, flash on the §11 notice-band row — two rows, consistent with the §6-6 co-render seam). The banner already says "unsupported terminal"; the flash must ADD the "multi-select unavailable" intent, not repeat the banner. The NULL case (Fork B1) has no banner, so its flash carries the honest no-host-local line + the unavailable intent.

**Fork A — resolve-unsupported-mid-mode → A1 (leave the reactive backstop).** No eject on resolve; `decideBurst` catches it at Enter. The in-flight window is tiny and ejecting a user mid-interaction is jarring.

**Fork B — `m` on a NULL/remote terminal → B1 (honest explanatory flash).** Pressing `m` on NULL flashes an explanatory line (e.g. "no host-local terminal — multi-select unavailable") so a silent `m` doesn't read as broken; it self-clears on the next key. (NULL has no `terminals.json` remedy, so the flash explains rather than guides.)

**Deciding factor:** the direction was carried in from the report and re-affirmed in discovery; investigation confirmed every locus is TUI-local and each sub-fix is small and independently testable. A1/B1 keep the change minimal and avoid mid-interaction state jolts while still making `m` honestly unavailable.

### Options Explored

- **Fork A2 (eject on resolve).** More consistent (multi-select never survives an unsupported resolve) but introduces a mid-interaction state change for a tiny in-flight window. Not chosen.
- **Fork B2 (silent no-op for NULL).** Quieter, but a silent `m` reads as broken. Not chosen.
- **Parameterised `sessionsKeymap()` (drop `m` inside the descriptor fn).** Rejected in favour of the call-site filter: parameterising the descriptor would break `keymap_dispatch_guard_test` (which probes the static descriptor), and the descriptor is meant to be the single static source for dispatch parity.
- **Removing `decideBurst`'s reactive no-op** once the entry-block lands. Rejected: async detection makes the reactive arm load-bearing for the entered-before-resolve race.

### Discussion

The direction was pre-shaped (report → discovery), so the exploration focused on the two behavioural forks investigation surfaced rather than re-deriving the approach. The user accepted the recommended A1/B1 on first pass. Key edge cases surfaced and carried to the spec: async in-flight entry (why the reactive backstop stays), repeated `m` while the block flash is showing (actionable-key clear then re-block/re-flash — intentional), and the now-dead NULL banner render branch (remove vs retain).

### Testing Recommendations

- **Rework `burst_unsupported_noop_test.go`:** `TestBurstUnsupported_NonNullAtomicNoOp` (line 119) and `TestBurstUnsupported_NullFlash` (line 149) enter multi-select AFTER `resolveDetection`, so the post-resolve `m` press is now blocked and their `markTwo` precondition fails — rework both to enter multi-select BEFORE resolving detection (the in-flight path). `TestBurstUnsupported_DeferredThenUnsupported` (line 183, already in-flight) and `TestBurstUnsupported_SupportedStillDispatches` (line 229, supported) stay valid. Keep the deferred-Enter → unsupported no-op coverage (the retained backstop).
- **Invert (named breaking test):** `TestApplySectionHeader_UnsupportedNullShowsHonestLine` (unsupported_banner_test.go:241) currently asserts a resolved NULL identity renders `⚠ no host-local terminal` and that `Sessions` is absent — sub-fix 1 makes the opposite true, so this test must be inverted (NULL → standard `Sessions` header). The render-level `TestUnsupportedHeader_NullIdentityNoHostLocal` (line 90) still passes (it calls `renderUnsupportedHeader` directly) but its NULL branch is now unreachable from the picker — the "dead NULL branch" spec fork (remove vs retain the `bundleID == ""` render branch + `unsupportedNullLabel`).
- **New: banner split.** NULL identity → standard `Sessions ··· N` header renders (not the banner) + By-Tag signpost returns (add the mirror of `TestActiveNoticeBand_SuppressesSignpostWhenUnsupported`, which uses a NAMED identity and stays valid — assert the NULL case now RETURNS the signpost); named identity → banner unchanged.
- **New: `m`-entry block.** `m` on a resolved-unsupported terminal does NOT enter multi-select and sets the blocked flash (both NULL and named); flash self-clears on next actionable key. **Add a named co-render assertion:** on a named unsupported terminal a blocked `m` produces the intended two-row state (persistent named banner on the header row + block flash on the notice-band row).
- **New: help suppression.** `?` help omits the `m` row when `DetectUnsupported()`, lists it when supported; `keymap_dispatch_guard_test` still green.
- **Guard:** supported (native/config) terminal path unchanged — banner absent, `m` enters, help lists `m`.
- **Visual:** add a NULL-identity fixture (standard header); existing `sessions-unsupported-terminal` (named) fixture stays valid.

### Risk Assessment

- **Fix complexity:** Low — four small, independent TUI changes; no new packages, no state/daemon surface.
- **Regression risk:** Low — the banner gate can only fire on an unsupported resolution (supported terminals never reach it); the reactive backstop is retained; the guard test constrains the help/keymap change.
- **Recommended approach:** Regular release. No hotfix, no feature flag.
- **Latent guard coupling (from fix validation, note-only):** sub-fix 3's guard-safety depends on `sessionsGuardModel` (`NewModelWithSessions`) keeping detection unwired, so `DetectUnsupported()` is false and the `m` dispatch probe still enters the mode. True today. The entry-block makes `keymap_dispatch_guard_test` newly sensitive to that seed state — a future change that wires detection into `NewModelWithSessions` (or defaults `DetectUnsupported()` true) would make the `m` probe hit the block and fail. Not introduced by this fix; worth an inline note near the entry-block gate / the probe so a later reader understands the coupling.
- **Sequencing note (not a blocker):** `cli-verb-surface-redesign` (CLI burst) is expected to land first; keep the blocked-entry / unsupported copy coherent with the CLI's. Related bug `2026-07-15--remote-trigger-spawns-on-local-terminal` will make every remote login resolve NULL — increasing this fix's reach — but does not gate it.

---

## Notes

**Classification (from discovery):** Not strictly a regression — the banner and reactive-only `m` gating both work as designed. This is a *decided feature that turns out wrong in a case it didn't cover*. Settled as a **bugfix**: correcting wrong existing behaviour rather than building new capability.

**Scope boundary (from discovery):** The CLI multi-target `portal open <a> <b> …` (N≥2) burst block for unsupported/remote is owned by the in-flight `cli-verb-surface-redesign` feature, not this bug. That feature is expected to land before this bug is implemented. This bug stays **TUI-side** (banner split + `m`-entry block). Keep copy/UX consistent with the CLI's unsupported message.

**Investigation expectation (from discovery):** light confirm pass over the code loci (`unsupportedBannerActive` in `model.go`, the `m`-entry handler, `burst_unsupported_noop_test.go`, the help modal) — the spec does the real design work.

**Deferred design detail (from discovery):** exact flash copy (a variant suited to a blocked mode-entry vs the current `— nothing opened` burst wording) and the help-suppression mechanics.

**Spec forks surfaced by investigation (for the spec to resolve, not investigation blockers):**
- **Blocked-entry flash copy.** `spawn.UnsupportedNoopMessage`'s `— nothing opened` is a burst RESPONSE (something was attempted). A pre-emptive `m`-entry block attempts nothing, so it needs distinct copy — likely naming the identity + a `terminals.json`/docs pointer for the named case, and an honest no-host-local line for NULL. Keep coherent with the CLI unsupported message (shared source today; may legitimately diverge since the CLI burst *does* attempt).
- **Repeated `m` while the block flash is showing.** An actionable key clears the flash (model.go:3328) before its handler runs, so a second `m` clears then re-blocks + re-flashes. Behaviourally fine; the spec should state this is intentional so the copy/behaviour on repeated `m` is deliberate.
- **Detection-resolves-unsupported-mid-mode.** If the user entered multi-select during the async in-flight window and detection then resolves unsupported, the current `terminalDetectedMsg` arm does NOT eject the mode. Decide whether the fix should eject (and flash) on resolve, or leave the reactive `decideBurst` no-op as the only backstop at Enter.
- **Dead NULL banner branch.** If the NULL banner is dropped at the gate, `renderUnsupportedHeader`/`unsupportedLeftCluster`'s `bundleID == ""` branch + `unsupportedNullLabel` become unreachable from the picker — spec decides remove vs retain.

**Validation:** independent root-cause validation ran (`.workflows/.cache/.../root-cause-validation-001.md`) — STATUS validated, high confidence, root cause explains all symptoms with no competing hypothesis. Three surfaced items were precision/framing nuances (help-modal-as-discoverability vs enabler; causal precision on "permanent"; repeated-`m` flash ordering) — the two substantive ones are folded into the causal-precision note above and the spec forks here.
