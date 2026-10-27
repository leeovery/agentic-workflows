# Investigation: Ghostty Spawn Opens Zero Windows

## Symptoms

### Problem Description

**Expected behavior:**
Picker multi-select multi-window spawn opens N host-terminal windows (one per selected session) on a real Mac running native Ghostty. The trigger window self-attaches to the Nth session; the N−1 others are externally spawned as new Ghostty windows. On success the notice band / log reports `opened N/N`.

**Actual behavior:**
Three sessions selected, Enter pressed, **zero** windows opened. The notice band showed:

```
'portal-EfVRkk', 'portal-agent-first-3' failed to open — others left open
```

`portal.log` shows `spawn: opened 0/3` for two consecutive batches (17:37:28 and 17:37:33 on 2026-07-16), **no** `portal attach --spawn-ack` process ever starting, and **no** permission-required line. A retry seconds later failed identically.

### Manifestation

- Every external window fails instantly (osascript exits non-zero in milliseconds).
- Suspected error: osascript compile error `-2741` (reproduced locally per discovery).
- The banner suffix "— others left open" renders even though `opened=0` and nothing was actually left open (misleading copy — rider defect #2).
- At production-default INFO log level, the log records *that* windows failed but never *why* — the per-window osascript error detail is emitted at DEBUG only (rider defect #1).

### Reproduction Steps

1. Real Mac, portal 0.9.1, native Ghostty 1.3.1 as host terminal.
2. Launch picker, enter multi-select (`m`), mark ≥2 sessions.
3. Press Enter to dispatch the spawn burst.
4. Observe: zero windows open; notice band reports failure.

**Reproducibility:** Always (feature entirely non-functional on native Ghostty adapter).

### Environment

- **Affected environments:** Local (production binary on developer's Mac).
- **Browser/platform:** macOS, native Ghostty 1.3.1, portal 0.9.1.
- **User conditions:** Host terminal detected as native Ghostty (the config-`terminals.json`-less path → native Ghostty adapter).

### Impact

- **Severity:** High — multi-window spawn is entirely non-functional on the primary supported terminal (native Ghostty). Every burst fails; nothing self-attaches.
- **Scope:** All users spawning via the native Ghostty adapter (no `terminals.json` override).
- **Business impact:** Core feature of a shipped release broken in practice; shipped without live validation.

### References

- Seed: `.workflows/ghostty-spawn-zero-windows/seeds/2026-07-16-ghostty-spawn-zero-windows.md` (inbox:bug)
- Discovery session: `.workflows/ghostty-spawn-zero-windows/discovery/sessions/session-001.md`
- `portal.log` batches at 17:37:28 / 17:37:33 on 2026-07-16 (`spawn: opened 0/3`)

---

## Analysis

### Initial Hypotheses

Seed / discovery diagnosis (to validate, not assume):

1. **Primary:** The AppleScript template in `internal/spawn/ghostty.go` uses `make new surface configuration with properties {…}` and `make new window with properties {configuration:…}`, but Ghostty 1.3.1's scripting dictionary (`Ghostty.sdef`) has **no `make` command** — `surface configuration` is a record-type, and windows are created via a custom `new window` command taking a `with configuration` parameter. The script fails to *compile* (osascript `-2741`), so osascript exits non-zero instantly, the adapter maps it to `SpawnFailed`, and every external window fails in milliseconds. The sdef-correct form is `new window with configuration {command:"…", wait after command:true}`. The in-code "validated (Ghostty 1.3.1)" claim appears never to have been exercised; the `-tags manual` test `TestManual_OpenWindow_OpensRealGhosttyWindow` would have failed with exactly this error.

2. **Rider #1:** Per-window spawn failure detail (`Result.Detail`, the osascript error text) is emitted at DEBUG only in `internal/spawn/logemit.go`, so at production-default INFO the log records failure but not cause. Surfacing at WARN is a spec amendment (the `spawn` log catalog is spec-governed).

3. **Rider #2:** The partial-failure banner suffix "— others left open" in `internal/spawn/message.go` is static and renders even when `opened=0`. The copy is golden-spec-governed and parity-tested across CLI and picker.

### Code Trace

**Primary defect — the AppleScript template (`internal/spawn/ghostty.go:18-21`):**

```applescript
tell application "Ghostty"
	set surfaceConfig to make new surface configuration with properties {command:"%s", wait after command:true}
	make new window with properties {configuration:surfaceConfig}
end tell
```

Both statements are invalid against the **actual installed Ghostty 1.3.1 scripting dictionary** (`sdef /Applications/Ghostty.app`, verified this session — 318 lines):

- **No `make` command exists.** The dictionary defines `perform action`, `new surface configuration`, `new window`, `new tab`, `split`, `focus`, `close`, `activate window`, … `count`, `exists`, `quit` — but **no `make`**. Ghostty ships only a *partial* copy of the Standard Suite (`<suite name="Standard Suite">` at line 296 contains only `count`/`exists`/`quit`), so `make` and `with properties` are undefined terminology.
- **`surface configuration` is a `record-type`, not a class** (`sdef` line 104). You cannot `make new` a record. It carries the properties `command` (text) and `wait after command` (boolean) — exactly the two the code populates — but they belong on a record *literal*, not a `make`d object.
- **`new window` takes a `with configuration` parameter** of type `surface configuration` (`sdef` line 167-168), NOT `with properties {configuration:…}`.

The correct, minimal single-statement form (record literal coerced to the `with configuration` param):

```applescript
tell application "Ghostty"
	new window with configuration {command:"%s", wait after command:true}
end tell
```

**Execution path from the malformed script to zero windows:**

1. `ghosttyOpenScript` (`ghostty.go:41`) → `ghosttyOpenArgv` (`:47`) builds `["osascript", "-e", <malformed script>]`.
2. `ghosttyAdapter.OpenWindow` (`:94`) runs it via `execOsascriptRunner.Run` → `runArgvCombined`.
3. osascript rejects the script at **compile time** and exits **non-zero in milliseconds** (no window ever created). The diagnosing session (transcript `7d88b6b8`) reproduced this via `osacompile` against the installed Ghostty 1.3.1, exact output:
   ```
   ghostty_test.applescript:2: error: Expected "given", "with", "without", other parameter name, etc. but found "{". (-2741)
   exit=1
   ```
   The parser reaches line 2's `make new surface configuration with properties {…}`, cannot resolve `with properties` (undefined terminology), and errors on the `{`. Because it is a **compile** failure it fails identically and instantly for every window, independent of any runtime/permission state — which is why the log shows no `-1743`/`-1712` and no `--spawn-ack` process ever starting.
4. `mapGhosttyResult` (`:109`): `exitCode != 0`, output contains neither `-1743` nor `-1712` → falls through to **`SpawnFailed`** (`:116`), carrying the osascript error as `Detail`.
5. Every one of the N−1 external windows hits this identically → burst reports `opened 0/3`, trigger self-attach skipped.

**Rider #1 — failure reason invisible at INFO (`internal/spawn/logemit.go:34-39`):**
`LogWindowResults` emits the opaque `detail` (the osascript error text) at `logger.Debug(…)`. The INFO batch summary (`:62`) carries only `opened/total`/resolution attrs, no `detail`. At production-default INFO the log records *that* windows failed (`spawn: opened 0/3`) but never *why* — matching the observed log exactly. Diagnosing the root cause required reproducing osascript outside portal.

**Rider #2 — misleading total-failure banner (`internal/spawn/message.go:54-56`):**
`PartialFailureMessage` hard-codes the suffix `— others left open`. Traced through the picker: `handleBurstPartialFailure` (`internal/tui/burst_partial_failure.go:34`) → `PartitionResults` gives `confirmed=[]`, `failed=[2 external names]` → `burstPartialFailureFlash` (`:107`) returns `PartialFailureMessage(failed)` even though `opened=0`. This reproduces the observed banner verbatim: `'portal-EfVRkk', 'portal-agent-first-3' failed to open — others left open` — the "others left open" clause is false (nothing opened, and the trigger self-attach was skipped). (Note: only 2 names appear because `total=3` counts the trigger self-attach target, which is never in the external `failed` set — explaining the 2-names-but-0/3 discrepancy.) The CLI path (`cmd/spawn.go:210`) uses the same renderer, so the copy defect is symmetric across both surfaces.

**Key files involved:**
- `internal/spawn/ghostty.go` — the malformed template (primary defect).
- `internal/spawn/ghostty_openwindow_manual_test.go` — the `//go:build manual` test that would have caught it (see Why It Wasn't Caught).
- `internal/spawn/logemit.go` — DEBUG-only failure detail (rider #1).
- `internal/spawn/message.go` + `internal/tui/burst_partial_failure.go` + `cmd/spawn.go` — static "others left open" suffix (rider #2).

### Root Cause

The native Ghostty spawn adapter's AppleScript template (`internal/spawn/ghostty.go:18-21`) is written against a **non-existent scripting API**. It uses `make new surface configuration with properties {…}` and `make new window with properties {configuration:…}`, but Ghostty 1.3.1's scripting dictionary has **no `make` command** and **no `with properties`** terminology (its Standard Suite is trimmed to `count`/`exists`/`quit`), `surface configuration` is a **record-type** (not a makeable class), and windows are created via the custom `new window` command's **`with configuration`** parameter. The script therefore **fails to compile** (osascript `-2741`), osascript exits non-zero in milliseconds without opening anything, and the adapter maps that to `SpawnFailed`. Every external window in every burst fails identically → `opened 0/N`, nothing self-attaches.

The correct form is a single statement passing a `surface configuration` record literal to `new window with configuration`:

```applescript
tell application "Ghostty"
	new window with configuration {command:"%s", wait after command:true}
end tell
```

**Why this happens:** the template was authored against a generic Cocoa-Scripting shape (`make new <class> with properties {…}`) instead of Ghostty 1.3.1's actual custom verb-style dictionary. Notably this is a **regression away from the researched design, not a guess at an unknown API**: the original feasibility research (`restore-host-terminal-windows`, deep-dive 001, 2026-06-30) had already resolved and recorded the correct form — *"Ghostty 1.3.x (user confirmed on 1.3.1) ships an AppleScript dictionary: `new window with configuration` where the config carries a `command` field"* (research §F1, line 42; restated line 146). The implementation drifted from `new window with configuration` to the invalid `make new … with properties` idiom, and that drift was never re-validated against the sdef the research had checked. The in-code comment claiming the template was "validated (Ghostty 1.3.1)" is false.

### Contributing Factors

- **The only test that exercises the real osascript is opt-in manual.** `TestManual_OpenWindow_OpensRealGhosttyWindow` is `//go:build manual` — compiled into *neither* the unit lane nor the integration lane. No automatable lane can catch a wrong AppleScript template, because the real osascript boundary can only be validated on a live Mac inside Ghostty.
- **The template is a plain string constant**, correct-looking and well-commented, so it reads as validated. The escaping logic around it (`ghosttyEmbed`) is unit-tested and correct, lending false confidence to the whole file.
- **The `SpawnFailed` mapping is coarse, and its detail is hidden.** A compile error and a genuine runtime spawn failure both map to opaque `SpawnFailed`, and (rider #1) the distinguishing detail logs at DEBUG only — so the failure was indistinguishable from any other spawn problem at the default log level.

### Why It Wasn't Caught

- **No live validation before shipping.** The feature reached a tagged release (0.9.1) without anyone running the manual-tag test or a real multi-select burst. The manual test would have failed with exactly the `-2741` compile error.
- **The manual gate is invisible to CI-style runs.** `go test ./...` and `go test -tags integration ./...` both silently skip the `manual` file, so a green suite says nothing about the Ghostty template's validity.
- **First-ever live exercise = first-ever failure.** 2026-07-16 was the first live multi-window spawn on the real Mac; the bug surfaced immediately and universally (not an edge case).

### Blast Radius

**Directly affected:**
- Multi-window spawn via the **native Ghostty adapter** — entirely non-functional (`opened 0/N`, no self-attach). Both the `portal spawn` CLI and the picker multi-select burst, since both route through the same `internal/spawn` adapter.

**Not affected (scoping the fix):**
- The **config-`terminals.json`** adapter path — precedence is config → native Ghostty → unsupported, so a user with a `terminals.json` Ghostty recipe never reaches the broken native template.
- Detection, pre-flight gating, the token-ack channel, selection mutation, notice-band arbitration — all correct; the failure is isolated to the emitted osascript.
- Single-session `portal open`/attach (no osascript).

**Potentially affected (verify during fix):**
- The `ghosttyEmbed` escaping and `%s` payload embedding must still hold under the new single-statement form (the payload now sits inside the record literal passed to `with configuration` — same string context, but confirm).
- Riders #1 and #2 are separate defects surfaced by, not caused by, the template bug — both in scope.

---

## Fix Direction

### Chosen Approach

Three coordinated changes, all in `internal/spawn` (+ its picker/CLI seams), plus a prevention guard:

1. **Primary — correct the Ghostty AppleScript template** (`internal/spawn/ghostty.go`). Replace the invalid two-statement `make new … with properties {…}` form with the single-statement, sdef-correct form:
   ```applescript
   tell application "Ghostty"
       new window with configuration {command:"%s", wait after command:true}
   end tell
   ```
   The `surface configuration` record literal coerces directly to `new window`'s `with configuration` parameter — no `make`, no `with properties`. Correct the false "validated (Ghostty 1.3.1)" comment. Re-verify the `ghosttyEmbed` escaping holds under the relocated `%s` payload (same double-quoted string context; expected to be unchanged).

2. **Rider #1 — surface failure reason at WARN** (`internal/spawn/logemit.go`). Raise the per-window failure `detail` from DEBUG to WARN so the osascript error is visible at production-default INFO. This is a **spec amendment** (the `spawn` log catalog is spec-governed); the exact event shape/level wording is pinned at the spec phase.

3. **Rider #2 — honest total-failure banner** (`internal/spawn/message.go`, consumed by `internal/tui/burst_partial_failure.go` + `cmd/spawn.go`). Make the "— others left open" suffix conditional on `opened > 0`; on total failure (`opened = 0`) render honest copy (e.g. "…failed to open — nothing opened"). **Golden-spec-governed + parity-tested** across CLI and picker; exact wording pinned at spec.

4. **Prevention — compile-check regression guard.** Add a lightweight test that compiles the emitted AppleScript (via `osacompile`/osascript compile, no window opened) when Ghostty is present on macOS. It cannot run in a hermetic/CI lane (needs a real Mac + Ghostty) but would have caught *this exact* template regression automatically — the manual-only gate is precisely what let it ship.

**Deciding factor:** the primary form is the researched-and-recorded API (restore-host-terminal-windows deep-dive 001) and was compile-validated this session, so it is the correct single fix, not one of several candidates. The riders are the two same-diagnosis defects that made the bug hard to see and hard to trust; both are cheap and directly reduce recurrence/mis-diagnosis risk. The prevention guard (option b) was chosen over process-discipline-only (option a) because the failed guard was process discipline.

### Options Explored

- **Primary template form** — the corrected `new window with configuration {…}` is the only viable form (validated against the installed sdef; the broken form has no valid API to salvage). No real alternatives.
- **Prevention (a) manual test + discipline** — rejected: it is the same guard that already failed once (a `//go:build manual` test nobody ran).
- **Prevention (b) compile-check guard** — chosen: automatically catches template terminology regressions; accepted limitation that it is macOS+Ghostty-gated, not hermetic.
- **Rider #1 level** — WARN chosen over leaving at DEBUG (invisible when it matters) or ERROR (a per-window spawn failure is a recoverable, leave-what-opened condition, not process-fatal). Per-window-WARN vs distinct-WARN-event is a spec-phase shape decision.

### Discussion

User confirmed the findings and agreed the fix direction in one pass. The genuine decision raised — how to prevent recurrence — was resolved in favour of the compile-check guard (b) on the reasoning that the root "why it shipped" is a guard that only runs when someone remembers to run it. Two wording-level decisions (rider #1 log event shape/level, rider #2 total-failure copy) are deliberately left to the spec phase because both touch spec-governed vocabularies (the closed `spawn` log catalog; the golden parity-tested message copy) — the *direction* is decided here; the exact strings are pinned in the spec.

### Testing Recommendations

- **Mandatory live validation (load-bearing).** Run `go test -tags manual -run TestManual_OpenWindow_OpensRealGhosttyWindow ./internal/spawn/` on the live Mac inside Ghostty, then a real 3-session multi-select burst confirming `opened 3/3` and acks landing. Compile-only validation is insufficient — it proves the script parses, not that a window opens and runs the command. The fix is not "done" until this passes.
- **New compile-check regression test** (prevention item 4) exercising `ghosttyOpenScript(...)` output through `osacompile`, asserting a zero exit (macOS+Ghostty-gated build tag).
- **Rider #1** — a unit test asserting a failed `WindowResult` emits the `detail` at WARN (using the existing `logtest.Sink`).
- **Rider #2** — extend the existing parity tests: assert the total-failure (`opened = 0`) message across both CLI and picker renders the honest copy (no "others left open"), and that the genuine partial case (`opened > 0`) still renders the suffix.

### Risk Assessment

- **Fix complexity:** Low. The primary is a template string swap; the riders are a log-level change and a conditional-copy change.
- **Regression risk:** Low for the primary (the broken form opens nothing, so any working form is strictly better) and Low–Medium for the riders (both touch spec-governed surfaces with existing parity/log tests that must be updated in lockstep — the risk is spec-conformance drift, not runtime breakage).
- **Recommended approach:** Regular release. Not a hotfix candidate in the urgency sense (the feature is new and was never functional), but it is the whole point of a shipped feature, so it should land promptly with the mandatory live validation gating the merge.

---

## Notes

- Verification of any fix MUST include running the `-tags manual` Ghostty test plus a live end-to-end multi-select burst confirming `opened N/N` — the absence of live validation is what let this ship.
