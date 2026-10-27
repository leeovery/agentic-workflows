# Specification: Ghostty Spawn Zero Windows

## Specification

## Context: Defect & Root Cause

**Defect.** Multi-window spawn via the **native Ghostty adapter** is entirely non-functional. Selecting ≥2 sessions in the picker and pressing Enter (or running `portal spawn <sessions…>`) opens **zero** host-terminal windows: the log reports `spawn: opened 0/N`, no `portal attach --spawn-ack` process ever starts, no permission-required line appears, and the trigger window never self-attaches. Reproduces 100% on native Ghostty 1.3.1 (the path taken when no `terminals.json` override exists).

**Root cause.** The adapter's AppleScript template (`internal/spawn/ghostty.go`) is written against a **non-existent scripting API**:

```applescript
tell application "Ghostty"
	set surfaceConfig to make new surface configuration with properties {command:"%s", wait after command:true}
	make new window with properties {configuration:surfaceConfig}
end tell
```

Ghostty 1.3.1's scripting dictionary has **no `make` command** and **no `with properties`** terminology (its Standard Suite is trimmed to `count`/`exists`/`quit`); `surface configuration` is a **record-type**, not a makeable class; and windows are created via the custom `new window` command's **`with configuration`** parameter. The script therefore **fails to compile** (osascript `-2741`), exits non-zero in milliseconds without opening anything, and `mapGhosttyResult` maps a non-zero exit whose output contains neither `-1743` nor `-1712` to **`SpawnFailed`**. Every external window in every burst fails identically → `opened 0/N`.

**Why it shipped.** This is a **regression away from a researched-and-recorded API**, not a guess at an unknown one — earlier feasibility research had already resolved the correct `new window with configuration` form, and the implementation drifted to the invalid `make new … with properties` idiom without re-validation. The in-code comment claiming the template was "validated (Ghostty 1.3.1)" is false. The only test exercising real osascript (`TestManual_OpenWindow_OpensRealGhosttyWindow`) is `//go:build manual` — compiled into neither the unit nor integration lane — so no automatable lane could catch a wrong template, and the feature reached tagged release 0.9.1 without live validation.

**Two rider defects** surfaced by (not caused by) the template bug, both in scope:
- **Rider #1:** the per-window osascript failure detail logs at DEBUG only, so at production-default INFO the log records *that* windows failed but never *why*.
- **Rider #2:** the partial-failure banner suffix "— others left open" is static and renders even when `opened=0` (nothing was left open), producing misleading copy.

---

## Fix 1 — Correct the Ghostty AppleScript template

**File:** `internal/spawn/ghostty.go`

Replace the invalid two-statement `make new … with properties {…}` template (`ghosttyScriptTemplate`) with the single-statement, sdef-correct form that passes a `surface configuration` record literal directly to `new window`'s `with configuration` parameter:

```applescript
tell application "Ghostty"
	new window with configuration {command:"%s", wait after command:true}
end tell
```

Requirements:

- The single `%s` remains the `ghosttyEmbed`-escaped, space-joined composed argv, supplied as a `fmt.Sprintf` format argument (a `%` in the payload stays inert).
- The record literal carries exactly the two fields the sdef defines on `surface configuration`: `command` (text) and `wait after command` (boolean `true` — keeps the window up after its command exits, the normal-detach lifecycle for a spawned session).
- No `make`, no `with properties`, no intermediate `set surfaceConfig` variable.
- Correct the false "validated (Ghostty 1.3.1)" comment so it no longer claims validation the template never had; the comment should describe the actual sdef-correct `new window with configuration` form.
- Re-verify `ghosttyEmbed` escaping holds under the relocated `%s`: the payload now sits inside the record literal's double-quoted `command:"…"` string — the same double-quoted AppleScript string context as before — so the backslash-before-quote escape order is expected to be unchanged. Confirm, don't assume.

Everything downstream of the template is correct and stays unchanged: `ghosttyOpenScript` / `ghosttyOpenArgv` (script → `osascript -e` argv), the `osascriptRunner` exec seam, and `mapGhosttyResult`'s outcome mapping (`-1743`/`-1712` → PermissionRequired; other non-zero exit → SpawnFailed; clean exit → Success). Once the template compiles and opens a window, a clean exit maps to Success and the burst proceeds normally (acks land, trigger self-attaches).

---

## Fix 2 (Rider #1) — Surface per-window failure reason at WARN

**File:** `internal/spawn/logemit.go` (`LogWindowResults`). Spec amendment to the closed `spawn` log catalog.

**Problem.** `LogWindowResults` emits every external-window record — success *and* failure — at `DEBUG` (message `"external window"`, attrs `session`/`ack`/`detail`). At production-default INFO the batch summary `opened 0/N` is visible but the per-window `detail` (the osascript error text — the actual diagnosis) is not. The root cause could only be found by reproducing osascript outside portal.

**Change.** In the per-window loop, split by outcome:

- A window that **failed** (`!r.Confirmed()`, i.e. `r.Ack` is `AckTimeout` or `AckFailed`) **and** whose `r.Result.Outcome` is **not** `OutcomePermissionRequired` → emit at **`WARN`** with a distinct message **`"external window failed"`**, carrying the existing closed attrs `session`, `ack`, `detail`.
- Every other window — a **confirmed** window, or the **permission-required** window (whose detail is already carried by the dedicated `permission required — nothing self-attached` INFO event) → emit at **`DEBUG`** with the existing message `"external window"`, attrs unchanged.

The failed set deliberately spans **both** non-permission failure modes — `AckFailed` (the adapter reported no window opened: `OutcomeSpawnFailed`, `detail` = the osascript error — the observed bug) and `AckTimeout` (the adapter opened the window `OutcomeSuccess` but its token never arrived within budget: `detail` = the benign success string). Both are genuine window failures the operator must see at INFO, and the **`ack` attr distinguishes the mode** (`ack=failed` vs `ack=timeout`), so the record stays honest even when `detail` is a success string. Restricting the WARN to open-failures (`OutcomeSpawnFailed`) only would re-introduce the exact invisibility gap this fix closes — a batch whose windows open but whose acks never land would show `opened 0/N` at INFO with no WARN explaining why.

Rationale for the exclusions:
- **Permission window excluded** so it does not double-report — `LogPermission` (INFO) is the single authority for the permission case, and the CLI's permission arm calls `LogWindowResults` before it.
- **Distinct message string** (`"external window failed"`) rather than reusing `"external window"` at a higher level, so the failure is greppable and the same message string never appears at two levels.

**Catalog amendment (spec-governed).** The closed `spawn` component gains **one** new message string, `external window failed`, at **WARN**. It introduces **no new attr keys** — `session`, `ack`, `detail` are all already in the closed `spawn` vocabulary. The INFO batch summary (`opened N/N`) and all other spawn events are unchanged; the WARN is additive (a total-failure batch now logs both `opened 0/N` at INFO and one `external window failed` WARN per non-permission failed window).

**Parity.** Both surfaces emit per-window records through this same helper (picker via `LogBatchSummary` → `LogWindowResults`; CLI via `logSpawnSummary`/its permission arm → `LogWindowResults`), so the WARN behaviour is identical across CLI and picker with no per-caller divergence beyond the pre-existing permission-arm asymmetry.

---

## Fix 3 (Rider #2) — Honest total-failure banner copy

**Files:** `internal/spawn/message.go` (`PartialFailureMessage`, the single renderer), consumed by `cmd/spawn.go` (CLI exit-1 error) and `internal/tui/burst_partial_failure.go` (`burstPartialFailureFlash`, the picker flash). Golden-spec-governed copy; parity-tested across both surfaces.

**Problem.** `PartialFailureMessage(failed []string)` hard-codes the suffix `— others left open`:

```
's2' failed to open — others left open
```

On a **total** failure (every external window failed, nothing confirmed) the "others left open" clause is false — nothing opened, and the trigger self-attach is always skipped on partial failure. The observed banner `'portal-EfVRkk', 'portal-agent-first-3' failed to open — others left open` was emitted with `opened=0`.

**Change.** Make the suffix conditional on whether any **other external window** actually opened. The renderer gains a signal for "did any other window open" — the intended signature is `PartialFailureMessage(failed []string, othersOpened bool) string`. Both callers derive `othersOpened` from the shared `spawn.PartitionResults` chokepoint (`othersOpened = len(confirmed) > 0`, confirmed = external windows whose ack landed). The trigger self-attach is never in the confirmed set and is skipped on partial failure, so it never counts as an "other".

Exact copy (single-sourced in `PartialFailureMessage`):

| Condition | Message |
|-----------|---------|
| At least one other external window opened (`othersOpened == true`) | `'s2' failed to open — others left open` (unchanged; single and multiple names) |
| No other external window opened — total failure (`othersOpened == false`) | `'s2', 's3' failed to open — nothing opened` (single and multiple names — a total failure can involve exactly one failed external window, e.g. an N=2 burst: `'s2' failed to open — nothing opened`) |

The `— nothing opened` suffix mirrors the established spawn copy in `GoneMessage` and `UnsupportedNoopMessage`, keeping the spawn message vocabulary consistent. As before: no count-aware verb ("failed to open" agrees with one or several names), no `spawn:` prefix (the CLI adds it), and no ⚠ glyph (the notice band prepends it).

**Parity & single-source.** The two callers must pass the correct `othersOpened` signal:
- **CLI** (`cmd/spawn.go`): already computes `PartitionResults(results)` for `failed`; pass `len(confirmed) > 0`.
- **Picker** (`burst_partial_failure.go` → `burstPartialFailureFlash`): already has `results`; compute `confirmed` from `PartitionResults` and pass `len(confirmed) > 0`.

The permission-wall branch (returns the driver Guidance) and the degenerate empty-`failed` branch (returns `""` so no band renders) are **unchanged** — only the final `PartialFailureMessage(failed …)` call is affected. The copy stays single-sourced in `message.go` so a future edit lands in one place, and the CLI/picker parity tests assert byte-identical output.

---

## Fix 4 (Prevention) — Compile-check regression guard

**New test** in `internal/spawn` (a new `//go:build`-gated file). Prevents recurrence of a template-terminology regression.

**Why.** The root "why it shipped" is that the only test exercising the real osascript boundary is `//go:build manual` — a test nobody ran before tagging 0.9.1. Process-discipline-only prevention (option a) was **rejected**: it is the exact guard that already failed once. Instead, add an **automated** compile-check that catches a wrong AppleScript template without a human in the loop.

**What it does.** Feed `ghosttyOpenScript(<representative composed argv>)` through a **compile-only** osascript path (`osacompile`, which resolves the `tell application "Ghostty"` terminology against the installed Ghostty scripting dictionary — intended to **open no window / run nothing**; see the assumption note below) and assert a **zero exit**. The current broken template fails this with the observed `-2741` compile error; the corrected `new window with configuration {…}` form compiles clean. The representative argv mirrors the shape the spawn layer composes (an env-self-sufficient `/usr/bin/env -u TMUX -u TMUX_PANE …` argv) so the template and `ghosttyEmbed` escaping are exercised together.

**Gating.** It **cannot** be hermetic (it needs a real Mac + Ghostty installed), so it is fenced out of both default lanes:

- A **dedicated build tag** (proposed name **`ghosttycompile`**), so it compiles into neither `go test ./...` (unit) nor `go test -tags integration ./...` (integration), and is separable from the window-opening `manual` test. It runs via `go test -tags ghosttycompile ./internal/spawn/`.
- **Within** the test, `t.Skip` when not macOS or when `Ghostty.app` is not present, so invoking the tag on a machine without Ghostty skips cleanly rather than hard-failing.

**Invocation (concrete).** Compile via `osacompile -e <script> -o <out>`, where `<script>` is `ghosttyOpenScript(argv)` and `<out>` is a throwaway path under `t.TempDir()` (e.g. `probe.scpt`, auto-cleaned) — `osacompile` requires an output target and does not parse-and-discard like `osascript`. Assert the process exits `0`; a non-zero exit fails the test with the captured compiler output (the current broken template yields `-2741`). The representative argv is a fixed literal of the composed shape, e.g. `[]string{"/usr/bin/env", "-u", "TMUX", "-u", "TMUX_PANE", "/bin/sh", "-c", "echo probe"}`, so the template and `ghosttyEmbed` escaping are exercised together.

**Assumption to confirm (during live-Mac implementation).** The guard's core mechanism is already **evidenced, not assumed**: the investigation reproduced the defect by running **`osacompile` against the installed Ghostty 1.3.1** — the same tool the guard uses — which resolved the `tell application "Ghostty"` block against the app's dictionary and produced the exact `-2741` terminology error the guard is designed to catch, opening no window. So `osacompile`'s terminology resolution and its no-window property are demonstrated. The one genuinely-open nuance is whether Ghostty must be **running** for that resolution (the investigation's reproduction was likely done inside a running Ghostty), which the `t.Skip`-on-*installed* gate does not cover. Confirm it on the live Mac (the test is macOS+Ghostty-gated, so it is authored and first run there): if terminology resolution turns out to require Ghostty running, or launches it as a side effect, document the observed behaviour and adjust the precondition so the guard never produces a false failure unrelated to the template — either ensure/require Ghostty is running as part of the gate, or `t.Skip` when terminology cannot be resolved.

**Accepted limitation.** The compile-check proves the emitted script **compiles** against the installed dictionary — it does **not** prove a window opens and runs the command. It is the automated regression tripwire for terminology drift; the functional proof remains the mandatory live validation (see Testing & Validation Requirements). The two are complementary, not substitutes.

---

## Scope & Non-Goals

**In scope** — four coordinated changes, all within `internal/spawn` and its CLI/picker seams:
1. Correct the native Ghostty AppleScript template (primary fix).
2. Surface per-window failure reason at WARN (rider #1).
3. Honest total-failure banner copy (rider #2).
4. Compile-check regression guard (prevention).

**Out of scope / unchanged (the failure is isolated to the emitted osascript):**
- **The config `terminals.json` adapter path.** Adapter precedence is config → native Ghostty → unsupported, so a user with a `terminals.json` Ghostty recipe never reaches the broken native template. That path is not the defect and is not touched.
- **Detection, pre-flight `has-session` gating, the token-ack channel, selection mutation, notice-band arbitration** — all verified correct in the investigation. No changes.
- **Single-session `portal open` / `portal attach`** — no osascript involved.
- **No new terminal adapters** and no broadening of terminal support — the fix restores the native Ghostty adapter to working order, nothing more.

**Verify-during-fix (not new work, but must be confirmed):**
- `ghosttyEmbed` escaping still holds under the relocated `%s` (same double-quoted string context; expected unchanged) — confirm as part of Fix 1.
- Riders #1 and #2 are separate defects surfaced by, not caused by, the template bug; both are in scope above.

**Release posture.** Regular release, not an urgency hotfix — the feature is new and was never functional, so nothing regresses relative to a working prior state. It should land promptly, with the mandatory live validation **gating the merge**.

The mandatory live validation is an **in-scope acceptance gate of this fix** (owned here, not a separate topic): its two checks — the `-tags manual` Ghostty test and a real ≥3-session `opened 3/3` burst — are acceptance criteria for this work and must be planned/tracked as part of it. They are spelled out under **Testing & Validation Requirements** below. Because they require a live Mac inside Ghostty they cannot run in an automated lane, but that does not move them out of scope — it makes them a manual acceptance step this topic owns.

---

## Testing & Validation Requirements

**Mandatory live validation (merge-gating, load-bearing).** The absence of live validation is what let this ship, so the fix is **not "done"** until, on a live Mac inside Ghostty:
1. `go test -tags manual -run TestManual_OpenWindow_OpensRealGhosttyWindow ./internal/spawn/` passes (a real Ghostty window opens and runs the command).
2. A real ≥3-session picker multi-select burst confirms `opened 3/3`, the token acks land, and the trigger self-attaches.

Compile-only validation is **insufficient** — it proves the script parses, not that a window opens and runs its command. This live gate blocks the merge.

**Automated tests (added/updated in lockstep with the fixes):**
- **Prevention compile-check** (Fix 4): the new `ghosttycompile`-tagged test compiles `ghosttyOpenScript(...)` output via `osacompile` and asserts a zero exit; skips cleanly when not macOS / Ghostty absent.
- **Rider #1** (`logemit` / `logtest.Sink`): assert an **`AckFailed` (open-failure)** window emits `external window failed` at **WARN** carrying `session`/`ack=failed`/`detail`; an **`AckTimeout`-after-`OutcomeSuccess`** window also emits `external window failed` at **WARN** carrying `ack=timeout` (and the benign success `detail`); a **confirmed** window emits `external window` at **DEBUG**; and a **permission-required** window does **not** emit the WARN (its detail is carried by the permission INFO event).
- **Rider #2 parity** (extend the existing `message_test.go` + `burst_partial_failure_test.go`, byte-identical across CLI and picker):
  - Total failure (`othersOpened == false`) renders `… failed to open — nothing opened` with **no** "others left open" — assert both a **single-name** (`'s2' failed to open — nothing opened`) and a **multi-name** case.
  - Genuine partial (`othersOpened == true`) still renders `… failed to open — others left open`.
  - The permission-wall and degenerate empty-`failed` branches are unaffected.
- **Lockstep updates to existing tests** — the template and log-level changes invalidate existing assertions that MUST be updated in the same change, or the unit lane cannot stay green:
  - `internal/spawn/ghostty_command_test.go` (`TestGhosttyOpenScript`): drop the now-stale `"surface configuration"` expectation (that keyword only existed in the old invalid form) and assert the corrected terminology instead — `new window`, `with configuration`, and the still-present `command:"…"` / `wait after command`.
  - `internal/spawn/logemit_test.go`: the `ack=timeout` (non-permission) case now emits `WARN external window failed` instead of `DEBUG external window`. Update `TestLogWindowResults_OneDebugPerWindow` and the mixed confirmed/timeout/failed per-window assertion in `TestLogBatchSummary` so confirmed windows expect DEBUG `external window` and timeout/failed windows expect WARN `external window failed` (the DEBUG-per-window count is no longer `len(results)`).

**Existing lanes stay green.** `go test ./...` (unit) and `go test -tags integration -p 1 ./...` (integration) must both pass — inclusive of the lockstep test updates above; the `manual` and `ghosttycompile` tags remain excluded from both.

---

## Working Notes
