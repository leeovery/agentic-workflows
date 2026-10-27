# Specification: Persistent No Host Terminal Banner

## Specification

## 1. Problem & Target Behaviour

### Context

On the sessions picker, spawn-detection resolves the host terminal identity into one of three shapes: **supported** (a driveable adapter — native Ghostty or a `terminals.json` match), **named-unsupported** (a recognised bundle id with no adapter, e.g. Apple Terminal), or **NULL/remote** (mosh/SSH — no host-local terminal attached to the tmux server). Two surfaces key off the coarse `DetectUnsupported()` resolution without distinguishing the NULL and named shapes, producing two defects on unsupported terminals:

1. **Persistent noise banner on remote clients.** The proactive unsupported-terminal banner *replaces* the `Sessions ··· N` section header (count + grouping-mode suffix) for the whole picker session. For a NULL/remote client the banner (`⚠ no host-local terminal`) carries nothing actionable — no bundle id, no `see docs` hint — yet permanently costs the user their session count and grouping indicator.
2. **Walkable dead-end multi-select.** On *any* unsupported terminal (NULL or named), pressing `m` enters multi-select mode and lets the user mark sessions, only to dead-end at the N≥2 Enter with a reactive no-op flash. The affordance is offered for a burst that can never fire, and `m` is listed unconditionally in the `?` help.

Neither is a regression — both surfaces work to the original `restore-host-terminal-windows` spec, which modelled "unsupported" as one flat state served by one banner + one reactive burst-time no-op. That is correct for the named-undriven case but wrong for NULL/remote and wrong as the *primary* multi-select gate.

### Target Behaviour

On a picker session where detection has resolved an unsupported terminal:

- **NULL/remote identity:** no proactive banner. The standard `Sessions ··· N` header (count + grouping-mode suffix) renders normally, and the By-Tag "no tags yet" signpost behaves as on any supported client.
- **Named-unsupported identity:** the proactive banner is **kept unchanged** — it is actionable (carries the bundle id, the copy-paste key for `terminals.json`, and the `see docs` hint).
- **Multi-select (`m`) on any unsupported resolution (NULL or named):** the mode does **not** open. Pressing `m` fails immediately with a transient flash (self-clearing on the next keypress) instead of walking the user to a guaranteed dead-end. `m` is omitted from the `?` help while unavailable.

### Solution Shape

Four coordinated, independently-testable TUI-side sub-fixes (banner split, proactive `m`-entry block, help-modal `m`-suppression, blocked-entry flash copy), plus a plain-language rewrite of the shared `UnsupportedNoopMessage` in `internal/spawn/message.go` (in scope — see §5/§8). No change to the CLI's burst/block **logic**, but that shared message is rendered by the CLI open-burst too, so its rewritten copy must stay coherent with `cli-verb-surface-redesign` (the one cross-package, coordination-sensitive dimension of this fix). No state/daemon/`sessions.json`/`prefs.json` footprint — spawn's near-zero state footprint is unchanged.

---

## 2. Sub-fix 1 — Banner Split by Identity Shape

### Change

Add an `IsNull()` identity-shape discriminator to `unsupportedBannerActive()` (`internal/tui/model.go`) so the predicate is true **only for a named-unsupported identity**, false for NULL/remote. Currently it is `DetectUnsupported() && !multiSelectMode`, which fires for *any* unsupported resolution; the new form additionally requires `!m.detectIdentity.IsNull()`.

### Behaviour

- **Named-unsupported:** predicate stays true → the banner still replaces the section header, unchanged (`⚠ unsupported terminal — <name> · <bundleID>` + right-anchored `see docs`).
- **NULL/remote:** predicate now false → the banner never activates; the standard `Sessions ··· N` header (count + grouping-mode suffix) renders normally.

### Why one gate covers both surfaces

`unsupportedBannerActive()` is the single predicate read by **two** consumers, so the discriminator fixes both coherently in one place:

1. **`applySectionHeader`** — swaps in the unsupported banner in place of the title row. With the split, NULL no longer claims the header row.
2. **`activeNoticeBand`** — reads the same predicate to *suppress* the By-Tag "no tags yet" signpost while the banner is active. With the split, a NULL/remote client that has no tags now shows the signpost again (correct — there is no banner competing for the slot).

The renderer already knows the NULL/named split (`renderUnsupportedHeader` / `unsupportedLeftCluster` branch on `bundleID == ""`); only the *gate* was blind to it. This sub-fix adds the missing discriminator at the gate — it does not change the renderers (the fate of the now-unreachable NULL render branch is Topic 6).

### Scope guard — the detection cache is not the defect

The banner's *permanence* comes from the once-only detection cache (the `detectDispatched` latch → cached `detectResolved`/`detectResolution`; nothing re-detects, and `rebuildSessionList` does not re-run detection), which is re-read every frame. The missing `IsNull()` gate decides only *whether* that cached unsupported resolution renders as the banner — the exact chain is "once-cached unsupported resolution × identity-blind gate", **not** "the gate makes it permanent." The `!IsNull()` gate change alone fully resolves the NULL symptom; the once-only detection cache is **not** itself a defect and must be left untouched (do not add re-detection on rebuild).

---

## 3. Sub-fix 2 — Proactive Multi-Select Entry Block

### Change

Gate the entry branch of `handleMultiSelectToggle` (`internal/tui/model.go`) on `DetectUnsupported()`. Today the entry branch (`if !m.multiSelectMode { multiSelectMode = true; …mark-on-entry… }`) has **no** detection read; the only unsupported gate is downstream at `decideBurst`'s N≥2 Enter. The fix adds a proactive check: when `DetectUnsupported()` is true, pressing `m` does **not** open the mode — it sets a transient blocked-entry flash instead (copy defined in Topic 5) and returns.

Applies to **both** unsupported shapes (NULL and named) — `DetectUnsupported()` is the coarse resolution predicate; the entry block is deliberately identity-blind (only the *flash copy* differs by shape, Topic 5).

### Only the keypress entry is gated

`handleMultiSelectToggle` is the sole *live* entry point for opening multi-select. `WithInitialMultiSelect` is a construction-time option used only by the capture harness (not a keypress) and is a separate `multiSelectMode = true` setter that is deliberately **not** gated — so the existing multi-select capture fixtures (e.g. `sessions-multi-select-active`) are unaffected by the entry block regardless of detection state. Do **not** gate `WithInitialMultiSelect`.

### Retain the reactive backstop (Fork A → A1)

`decideBurst`'s reactive unsupported no-op (`internal/tui/burst_progress.go`, the N≥2-Enter arm that emits `spawn.UnsupportedNoopMessage` and flashes) is **retained**. It is not redundant: detection is asynchronous, so the entry block cannot fully replace it.

### Async in-flight window (why the backstop is load-bearing)

- Detection dispatches on Bubble Tea's command goroutine on reaching the Sessions page and resolves later via `terminalDetectedMsg`. Until it resolves, `detectResolved == false` → `DetectUnsupported() == false` → the entry block does **not** fire, so a user *can* enter multi-select during the in-flight window.
- **Fork A resolved to A1 (leave the reactive backstop; no mid-mode eject).** If the user entered multi-select during the in-flight window and detection then resolves unsupported, the mode is **not** ejected. The `terminalDetectedMsg` arm continues to only cache identity/adapter/resolution (and resolve a `pendingBurstEnter` deferral) — it does not close an open multi-select mode. The reactive `decideBurst` no-op remains the sole backstop for the "entered-before-resolve → Enter" path.
- Rationale: the in-flight window is tiny and ejecting a user mid-interaction is jarring. A2 (eject on resolve) was explored and rejected for that reason.

### Visible flash, not a silent no-op (Fork B → B1)

The block produces a **visible** transient flash rather than silently swallowing the keypress. **Fork B resolved to B1 (honest explanatory flash).** B2 (silent no-op) was explored and rejected because a silent `m` reads as broken — the user gets no signal for why nothing happened. This matters most on NULL/remote, where there is no `terminals.json` remedy: the flash *explains* rather than guides (its copy is settled in §5/§6), but it must still fire so the keypress is not silently swallowed. This is the sole reason the pre-emptive entry block surfaces any feedback at all — do **not** "simplify" it to a silent no-op.

### Net effect

Once detection has resolved unsupported, `m` is proactively blocked at entry. Before resolution, the mode is enterable but the burst is still caught reactively at Enter. Supported terminals are unaffected — `m` enters and dispatches as today.

---

## 4. Sub-fix 3 — Help-Modal `m`-Suppression

### Change

When `DetectUnsupported() && !m.multiSelectMode` is true, filter the `m` (multi-select) entry out of the keymap descriptor slice passed to the help modal **at the call site** (`renderHelpModalOnClearedCanvas`, `internal/tui/model.go`). `sessionsKeymap()` itself stays a pure static constant — the filter is applied to the copy fed to the modal, not baked into the descriptor function.

### Behaviour

- **Unsupported (NULL or named), not in multi-select:** the `?` help body omits the `m` row — `m` cannot be entered here.
- **In multi-select mode (any terminal, however entered):** `?` help lists `m` — it is a live row-toggle.
- **Supported:** `?` help lists `m` as today.
- **Footer unchanged either way.** `m` is a non-`Core` descriptor entry, so `renderCondensedFooter` never lists it — the footer needs no change under any resolution.

### Consistency with A1 (in-flight entry)

The filter is gated on `!m.multiSelectMode` as well as `DetectUnsupported()` so the rule is exactly "`m` appears in `?` help iff `m` is functional." A1 (§3) permits a state where detection resolves unsupported *while* multi-select is already open (entered during the async in-flight window, not ejected); in that state `m` is a live row-toggle, so it stays listed in help. `m` is hidden only when it would actually be blocked — unsupported **and** not already in the mode. This keeps §4 consistent with §3/A1: the help never hides a working key. (The extra `&& !m.multiSelectMode` is guard-safe — `keymap_dispatch_guard_test` probes with detection unwired, so `DetectUnsupported()` is false and the filter is inert regardless.)

### Why call-site filter, not a parameterised keymap

A parameterised `sessionsKeymap()` (dropping `m` inside the descriptor function) is **rejected**. `keymap_dispatch_guard_test.go` probes the *static* descriptor against an unwired-detection model (where `DetectUnsupported()` is false → `m` supported → dispatch enters the mode) to guard descriptor↔dispatch parity. A call-site filter leaves that static descriptor — and therefore the guard — green; parameterising the descriptor would break it. The descriptor is meant to remain the single static source for dispatch parity.

### Latent guard-coupling note (carry into implementation)

Sub-fix 3's guard-safety depends on `sessionsGuardModel` (`NewModelWithSessions`) keeping detection **unwired**, so `DetectUnsupported()` is false and the `m` dispatch probe still enters the mode. This is true today. Sub-fix 2's entry block makes `keymap_dispatch_guard_test` newly sensitive to that seed state: a future change that wires detection into `NewModelWithSessions` (or defaults `DetectUnsupported()` true) would make the `m` probe hit the block and fail. This coupling is **not introduced** by this fix, but an inline source note near the entry-block gate / the guard probe should record it so a later reader understands the dependency.

---

## 5. Unsupported-Terminal Copy (Plain-Language Rewrite)

### Principle

All user-facing copy in the unsupported-terminal family is rewritten in plain language — no jargon. Every message must make clear *what happened, why, and (where applicable) what to do*. `<name>`/`<bundleID>` are filled at render.

### The copy set

| Message | NULL / remote | Named-unsupported |
|---|---|---|
| **Blocked-entry flash** *(new — `m` pressed after detection resolves unsupported)* | `multi-select isn't available over a remote connection` | `multi-select isn't available on this terminal` |
| **Reactive no-op** *(`spawn.UnsupportedNoopMessage` — async-race path + shared with the CLI open-burst)* | `can't open new windows over a remote connection — nothing opened` | `can't open new windows in <name> · <bundleID> — nothing opened` |
| **Named banner** *(kept, persistent, named-only)* | — *(no NULL banner — Topic 2)* | `⚠ unsupported terminal — <name> · <bundleID>` + `see docs` |

### Notes & decisions

- **"can't open new windows"** is the plain statement of what multi-select does and can't do here. **"nothing opened"** stays — it is plain and honestly signals an attempt occurred (distinguishing the reactive no-op from the pre-emptive block, which says "isn't available").
- The named reactive/CLI line keeps `<name> · <bundleID>` because in the CLI there is no banner — that line is the only place the user gets the bundle id (the `terminals.json` key).
- **Blocked-entry flash behaviour** (settled): distinct from the reactive no-op (a pre-emptive block attempts nothing, so no `— nothing opened`); uses the existing §11 notice-band flash slot and self-clears on the **next actionable key** (the authoritative trigger — matching the existing `setFlash` / `isActionableKey` lifecycle; "next keypress" elsewhere is shorthand for this); on a named terminal it co-renders two-row with the persistent banner (banner on the header row, flash on the notice-band row); repeated `m` while the flash shows clears then re-blocks + re-flashes (intentional). Reusing the §11 flash slot also inherits its existing auto-clear timer — that is expected and not forbidden; the "self-clears on the next actionable key" acceptance wording is the *key-driven* clear path, not a prohibition on the timer.
- **Blocked-entry flash renderer (TUI-local).** The two blocked-entry strings live in `internal/tui` (not `internal/spawn`), rendered by a new TUI-local helper (e.g. `multiSelectBlockedFlashText(id)`) that selects the shape via `m.detectIdentity.IsNull()` — mirroring `unsupportedFlashText`'s shape branch. Unlike `UnsupportedNoopMessage`, this copy is **not** shared with the CLI and needs no `cli-verb-surface-redesign` coordination.
- **Named non-repetition constraint** (from fix validation). In the named two-row state, the block flash carries **only** the "multi-select isn't available" intent and must **not** repeat the co-rendered banner's `unsupported terminal` text, identity string, or `see docs` — the banner already supplies the identity and the remedy. This is why the named block flash is the bare `multi-select isn't available on this terminal` (no bundle id, no docs pointer), rejecting the investigation's early spec-fork suggestion to name the identity + a `terminals.json`/docs pointer in the flash. Keeping the flash intent-only is what keeps the two co-rendered rows non-redundant.
- **Shared `⚠` glyph in the two-row co-render (accepted).** Both surfaces carry the shared warning glyph by design — the persistent banner (row 1) via `renderUnsupportedHeader`, and the transient block flash (row 2) via the §11 warning-flash slot's unconditional glyph. The named two-row state therefore momentarily shows **two** `⚠` (banner + flash) until the flash self-clears on the next key. This is accepted: the glyph is a consistent warning *marker* (not duplicated *information* — the non-repetition constraint governs text only), each row is independently a warning, and the flash is transient. The block flash is **not** special-cased to drop its glyph. (Subject to confirmation at the implementation visual gate.)
- **`UnsupportedNoopMessage` is in scope.** Rewriting it widens this bugfix into `internal/spawn`, and its wording is **shared with the CLI open-burst** (partly owned by `cli-verb-surface-redesign`) — the rewrite must be coordinated with that feature so the CLI copy stays coherent.
- **Setup guidance retained for named-unsupported:** the persistent banner carries the terminal name + bundle id (the copy-paste key for `terminals.json`) and the `see docs` hint. NULL/remote has no remedy, so it gets no pointer — only the plain explanation.
- **`see docs` left unchanged here.** It currently renders no concrete URL/path and there is no `terminals.json` setup doc in the repo. Making it a real (ideally clickable, OSC 8) link to a new custom-terminal setup page is **logged separately as a quickfix** (`custom-terminal-docs-and-clickable-see-docs`) and is out of scope for this bugfix.
- **Accepted minor imprecision:** NULL is almost always remote/mosh, but can rarely be a detection error folding to a null identity, where "over a remote connection" is slightly off (still directionally correct — the actionable truth, "multi-select isn't available / nothing opened", holds either way).

### Out of scope (copy)

Adjacent spawn messages for *different* scenarios — session killed mid-burst (`'…' is gone — nothing opened`), a window `failed to open`, macOS permission guidance — are already plain and separately owned; not rewritten here.

---

## 6. Dead NULL Banner Render Branch — Removed

**Decision: remove.** With the NULL banner gate dropped (Topic 2), the NULL render path is unreachable from the picker (the gate is its only caller) and is deleted:

- the `unsupportedNullLabel = "no host-local terminal"` constant;
- the `bundleID == ""` branches in `unsupportedLeftCluster` and `renderUnsupportedHeader` (the NULL banner render + its no-`see docs` handling);
- the render-level test that exercises them directly (`TestUnsupportedHeader_NullIdentityNoHostLocal`).

After removal the two renderers are **named-only** — `bundleID != ""` always holds when they are reached, so the `see docs` hint is unconditional. This also deletes the last live copy of the `no host-local terminal` jargon string (aligns with the plain-language rewrite, Topic 5). Retaining the branch as defensive dead code was rejected — it is genuinely unreachable and would rot.

### Confirmed end-state behaviour (NULL / remote)

- Standard `Sessions ··· N` header (count + grouping-mode suffix); **no persistent banner**.
- `m` absent from the `?` help and from the footer (`m` is never a footer key regardless; on remote it appears in neither).
- Pressing `m` does nothing but show the **transient flash** `multi-select isn't available over a remote connection` — no mode entered, nothing marked — which self-clears on the next actionable key.

("Banner" always denotes the *persistent* section-header element; the momentary message on `m` is the *transient flash*. On remote only the flash can appear; the persistent banner is retained only for *named* unsupported terminals, where it is actionable.)

---

## 7. Testing Requirements

**Rework (existing tests encoding the old contract):**

- `internal/tui/burst_unsupported_noop_test.go` — `TestBurstUnsupported_NonNullAtomicNoOp` and `TestBurstUnsupported_NullFlash` enter multi-select *after* `resolveDetection`; the post-resolve `m` is now blocked, so their `markTwo` precondition fails. Rework both to enter multi-select **before** resolving detection (the in-flight path). `TestBurstUnsupported_DeferredThenUnsupported` (already in-flight) and `TestBurstUnsupported_SupportedStillDispatches` (supported) stay valid. Keep the deferred-Enter → reactive no-op coverage (the retained backstop).
- `internal/tui/unsupported_banner_test.go` — `TestApplySectionHeader_UnsupportedNullShowsHonestLine` currently asserts a resolved NULL renders `⚠ no host-local terminal` with `Sessions` absent; sub-fix 1 inverts this → assert NULL now renders the standard `Sessions ··· N` header.
- **Copy assertions:** any test asserting the old `UnsupportedNoopMessage` strings (in `internal/spawn` and the CLI open-burst suites) updates to the new plain-language strings.

**Remove:**

- The render-level `TestUnsupportedHeader_NullIdentityNoHostLocal` — it exercises the deleted NULL render branch (Topic 6).

**New coverage:**

- **Banner split:** NULL identity → standard `Sessions ··· N` header renders (not the banner) **and** the By-Tag "no tags yet" signpost returns (mirror of `TestActiveNoticeBand_SuppressesSignpostWhenUnsupported`, which uses a *named* identity and stays valid — assert the NULL case now returns the signpost); named identity → banner unchanged.
- **`m`-entry block:** `m` on a resolved-unsupported terminal does **not** enter multi-select and sets the blocked flash (both NULL and named); flash self-clears on the next actionable key. Plus a **named co-render** assertion: a blocked `m` on a named unsupported terminal yields the two-row state (persistent banner on the header row + block flash on the notice-band row), with **both** rows carrying the `⚠` glyph.
- **Help suppression:** `?` help omits the `m` row **iff** `DetectUnsupported() && !m.multiSelectMode`. Cover all three cases: (a) unsupported + not in multi-select → `m` omitted; (b) supported → `m` listed; (c) **unsupported + in multi-select mode (the A1 in-flight-entered state) → `m` listed** — the help never hides the working row-toggle. `keymap_dispatch_guard_test` stays green (it runs with detection unwired, so the filter is inert).
- **Copy:** the new blocked-entry flash returns the correct plain strings per shape; the rewritten `UnsupportedNoopMessage` returns the correct plain strings per shape.

**Guard (unchanged path):** supported (native/config) terminal — banner absent, `m` enters, help lists `m`, burst dispatches.

**Visual:** add a NULL-identity capture fixture — name `sessions-unsupported-null`, seeded via the existing detection seed seam with `InitialDetection = &spawn.Identity{}` (empty `BundleID` → `IsNull()` true), the same seam the named fixture uses. It renders the **standard `Sessions ··· N` header with no banner** — visually identical to `sessions-flat`. The **render-level banner-split test (above) is the primary NULL assertion**; the fixture + committed reference PNG are added for parity with `sessions-unsupported-terminal` and as a regression anchor that the resolved-unsupported NULL seed path does not intrude a banner. The existing `sessions-unsupported-terminal` (named) fixture stays valid.

---

## 8. Scope, Non-Goals & Risks

### In scope

- **`internal/tui`** — the four coordinated sub-fixes: `unsupportedBannerActive()` gains the `IsNull()` discriminator (banner split); `handleMultiSelectToggle` entry branch gains the proactive `DetectUnsupported()` block + blocked-entry flash; the help-modal call-site descriptor filter drops `m` when `DetectUnsupported()`; `decideBurst`'s reactive no-op is retained (async-race backstop); removal of the dead NULL banner render branch.
- **`internal/spawn/message.go`** — the plain-language rewrite of `UnsupportedNoopMessage` (both shapes). This widens the fix beyond the TUI, as decided in Topic 5.
- Test rework/removal/additions and a new NULL visual fixture (Topic 7).

### Non-goals / explicitly out of scope

- **The CLI multi-target `portal open <a> <b> …` (N≥2) burst *block*** — owned by the in-flight `cli-verb-surface-redesign` feature. This bugfix does **not** change the CLI's block logic; it only touches the *shared message renderer*, which must be coordinated with that feature (below).
- **The `see docs` clickable link + `terminals.json` setup docs page** — logged as the separate quickfix `custom-terminal-docs-and-clickable-see-docs`. The named banner (including its current `see docs` text) is unchanged here.
- **Adjacent spawn copy** (session-gone, failed-to-open, permission guidance) — different scenarios, already plain, not rewritten.
- **No state footprint change** — `sessions.json`, the daemon capture loop, restore, and `prefs.json` are untouched; spawn's near-zero state footprint is unchanged.

### Risks & coordination

- **Complexity: Low.** Small, independent changes; no new packages, no state/daemon surface.
- **Regression: Low.** The banner gate can only fire on an unsupported resolution (supported terminals never reach it); the reactive backstop is retained; the guard test constrains the help/keymap change.
- **CLI copy coordination.** `UnsupportedNoopMessage` is shared with the CLI open-burst. The rewritten wording must read correctly for the CLI's "something was attempted" case and be coordinated with `cli-verb-surface-redesign` so the two surfaces stay coherent.
- **Latent guard coupling** (carry as an inline source note): sub-fix 3's guard-safety depends on `sessionsGuardModel` (`NewModelWithSessions`) keeping detection unwired so the `m` dispatch probe still enters the mode. Sub-fix 2's entry block makes `keymap_dispatch_guard_test` newly sensitive to that seed state; a future change wiring detection into `NewModelWithSessions` would break the probe. Not introduced by this fix — noted so a later reader understands the dependency.
- **Sequencing (not a blocker):** `cli-verb-surface-redesign` is expected to land first — keep the blocked-entry / unsupported copy coherent with the CLI's. Related bug `2026-07-15--remote-trigger-spawns-on-local-terminal` will make every remote login resolve NULL, increasing this fix's reach, but does not gate it.
- **Release:** regular release — no hotfix, no feature flag.

---

## Working Notes
