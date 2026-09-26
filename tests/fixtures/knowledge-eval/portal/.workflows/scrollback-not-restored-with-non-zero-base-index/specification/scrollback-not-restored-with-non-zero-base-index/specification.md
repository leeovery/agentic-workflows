# Specification: Scrollback Not Restored With Non-Zero Base Index

## Specification

## Problem & Root Cause

### Observed Symptom

After `tmux kill-server` and reattach, Portal restores sessions/windows/panes, cwd, and layout, but saved scrollback never appears in the pane. `~/.config/portal/state/portal.log` shows two correlated lines per pane:

```
WARN | restore | session "<name>": pane 0 predicted=<name>__0.0 live=<name>__1.1
WARN | hydrate | timeout waiting for signal on --hook-key=<name>:1.1 --fifo=...
```

**Save side is unaffected.** Per-pane scrollback files on disk contain the expected ANSI-coloured terminal history; the save daemon reports success. The fix is scoped to the restore/hydrate path only — no save-side investigation is needed.

The bug report attributed this to non-zero `base-index` / `pane-base-index`. That framing is incorrect: base-index is a confound that surfaces a misleading diagnostic WARN, not the cause of hydration failure. The reporter's empirical observation that "removing base-index makes it work" is consistent with seeing the diagnostic WARN go quiet (with base-index unset, live indices match the always-zero prediction so `warnOnPaneKeyDrift` does not fire) rather than with verifying end-to-end hydration. The reporter likely either tested a session whose name did not start with `-`, or observed only the absence of the WARN line and not whether scrollback actually appeared.

### Reproduction

To reproduce the failure deterministically:

1. Use a project directory whose basename starts with `.` (e.g. `~/.dotfiles`) so `SanitiseProjectName` produces a leading-dash session name.
2. *(Optional, for the misleading WARN)* tmux.conf includes `set -g base-index 1` and `setw -g pane-base-index 1`.
3. Open a Portal-managed session in that project and generate scrollback.
4. `tmux kill-server` (against the **test** server only — see Testing Constraint), then reattach via Portal.

The two factors are independent: step 1 alone causes the actual hydration failure; step 2 alone surfaces the misleading `predicted=...__0.0 live=...__X.Y` WARN. Either reproduces a distinct symptom; together they reproduce the full user-reported scenario.

### Primary Root Cause — Leading-Dash Session Name Breaks `signal-hydrate` Argv Parsing

`internal/tmux/hooks_register.go:39` defines the global hook command as:

```
run-shell "command -v portal >/dev/null 2>&1 && portal state signal-hydrate #{session_name}"
```

When tmux fires `client-attached` / `client-session-changed` for a session whose name begins with `-` (e.g. `-dotfiles-HM9Zhw`), the resolved shell command becomes `portal state signal-hydrate -dotfiles-HM9Zhw`. cobra/pflag parses the leading-dash token as a short-flag cluster, fails with `unknown shorthand flag: 'd'`, and exits non-zero before `runSignalHydrate` executes. No FIFO byte is written; the hydrate helper times out at 3s (`openFIFOWithTimeout` at `cmd/state_hydrate.go:100`) and exec's a bare `$SHELL` (`handleHydrateTimeout` at `cmd/state_hydrate.go:248`) with no scrollback replay.

The parse-error text is written to stderr, which `tmux run-shell` captures into its own output stream rather than `portal.log`. As a result, the failure produces no Portal log line — the only observable artefact is the downstream `hydrate timeout` WARN.

Leading-dash session names arise because `internal/session/naming.go::SanitiseProjectName` (line 24) replaces `.` and `:` with `-`. Project basenames like `.dotfiles` or `.config` become `-dotfiles` / `-config`, then `GenerateSessionName` appends a 6-char nanoid yielding `-dotfiles-HM9Zhw`.

**Empirical verification:**

```
$ portal state signal-hydrate -dotfiles-HM9Zhw      → exit 1 (parse error)
$ portal state signal-hydrate myrepo-AbCdEf         → exit 0
$ portal state signal-hydrate -- -dotfiles-HM9Zhw   → exit 0
```

`stateSignalHydrateCmd` defines no flags of its own (cmd/state_signal_hydrate.go:132), but cobra inherits parent persistent flags and pflag still attempts to parse leading-`-` tokens as short-flag clusters.

### Secondary Root Cause — `PredictLiveIndices` Reads Wrong Tmux Option Scope (Diagnostic-Only)

`Orchestrator.warnOnPaneKeyDrift` (`internal/restore/restore.go:153`) calls `SessionRestorer.PredictLiveIndices()` (session.go:424), which reads `base-index` and `pane-base-index` via `client.GetServerOption(...)`.

`GetServerOption` queries tmux **server-scope** options (via `show-options -sv`). However:
- `base-index` is a **session option** (`set -g` writes the global session value).
- `pane-base-index` is a **window option** (`setw -g` writes the global window value).

Neither is a server option. `GetServerOption` always returns `ErrOptionNotFound`, so `readIndexOption` falls back to `0` for both. `PredictLiveIndices` therefore returns `(0, 0)` regardless of user config.

Whenever the user has non-zero `base-index`/`pane-base-index`, the live key differs from the always-zero predicted key, and `warnOnPaneKeyDrift` fires. The WARN is **non-causal** — it does not affect any FIFO path, marker, or hook handshake — but it consistently misdirects diagnostic attention toward "prediction vs live drift" when the actual failure is the argv parse.

`PredictLiveIndices` has no functional consumer beyond this diagnostic WARN.

### Why the End-to-End Path Otherwise Works

The implementation already follows the spec's "Index Semantics" section (`internal/restore/session.go`):
- `armPanes` (session.go:195) calls `ListPanesInSession` to get live `[]tmux.PaneCoord` after `new-session` / `split-window` / `new-window`.
- FIFO path (session.go:215) is built from `state.SanitizePaneKey(sess.Name, live.Window, live.Pane)` — the **live** key.
- Helper is dispatched via `respawn-pane -k` against the live pane target.
- `ApplySkeletonMarkers` (session.go:354) iterates live panes and writes `@portal-skeleton-<liveKey>` for each.

The helper waits at `hydrate-<sess>__<live>.fifo`, the marker is set at `@portal-skeleton-<sess>__<live>`, and `signal-hydrate` enumerates live panes via `list-panes -s` to compute the same live key. The live-index path is end-to-end consistent and would succeed under base-index drift in isolation. Hydration only fails because `signal-hydrate` exits before doing any work for leading-dash session names.

### Blast Radius

**Directly affected:** Any session whose name starts with `-`. Includes Portal-generated names from projects whose basename begins with `.` or `:` (after `SanitiseProjectName`'s substitution — `.dotfiles`, `.config`, etc.).

**Potentially affected:**
- Any other Portal subcommand invoked from a tmux hook with `#{session_name}` as a positional arg. `signalHydrateCommand` is currently the only such site (per `internal/tmux/hooks_register.go`); `notifyCommand` is argument-free and unaffected.
- User-issued `portal <subcommand> -<dashed-name>` from a shell prompt — same parse-failure class. **Not addressed** by the chosen fix: the `--` separator is added only to the hook command, so a user invoking the CLI manually with a leading-dash positional argument would still hit the parse error. This case is intentionally out of scope (see Out of Scope below).

## Fix Scope

The fix has two parts. Both are required: Part 1 stops the hydration failure; Part 2 removes the misleading diagnostic that the bug report mistook for the cause.

### Part 1 — Add `--` End-Of-Flags Separator to `signal-hydrate` Hook

**Change:** `internal/tmux/hooks_register.go:39` — update `signalHydrateCommand` so the resolved hook command is:

```
run-shell "command -v portal >/dev/null 2>&1 && portal state signal-hydrate -- #{session_name}"
```

The `--` token tells cobra/pflag to stop flag parsing and treat `#{session_name}` as a positional argument unconditionally, regardless of its first character.

**One-shot bootstrap migration:** Existing installs already have a hook entry written without `--`. Hook registration is idempotent (skips if an entry matching the current command substring is found), so without migration the new fixed entry would either be added alongside the old broken entry (both fire — broken one still errors) or rejected as "already present" (depending on dedupe substring). Both outcomes leave users broken.

The existing `RegisterPortalHooks` step (bootstrap step 2) must evict any hook entry whose command contains `portal state signal-hydrate` but does **not** contain the `--` separator before installing the fixed entry. The dedupe substring used to detect whether a hook is already present (currently `signalHydrateSubstring = "portal state signal-hydrate"` at `internal/tmux/hooks_register.go:48`) must be tightened to `"portal state signal-hydrate --"` so the migration distinguishes the fixed entry from the broken one.

**Migration mechanics (explicit):**

- **Eviction API:** Use the existing `tmux.Client` methods exposed for global hook management — `ShowGlobalHooks` to enumerate, `ParseShowHooks` to parse the result, and `UnsetGlobalHookAt` (by event + index) to remove. Do not introduce a new helper unless the existing surface is insufficient.
- **Code location:** The migration logic lives in `internal/tmux/hooks_register.go` alongside `RegisterHookIfAbsent` — hook lifecycle is the package's existing concern. Expose it as a new free function (e.g. `migrateHydrationHooks(c *Client) (evicted int, err error)`) called from `RegisterPortalHooks` before the existing register-loop reaches the hydration-trigger category. The migration test (Testing Requirements item 4) lives in `internal/tmux/hooks_register_test.go` (or a sibling `*_migration_test.go`).
- **Hook event scope:** The migration scan must cover **every event listed in `hydrationTriggerEvents`** (currently `client-attached` and `client-session-changed` per `internal/tmux/hooks_register.go:25-28`). If the slice is later extended, the migration scan must follow it. Scanning only one event would leave a broken entry on the other.
- **Eviction predicate (precise):** An entry is eligible for eviction only if it matches the **full Portal-authored hook shape** for `signal-hydrate`. Specifically, the command must contain both `command -v portal >/dev/null 2>&1 &&` and `portal state signal-hydrate`, and must **not** contain `portal state signal-hydrate --`. Requiring the `command -v portal` prefix prevents the migration from deleting hand-authored user hooks that legitimately reference `portal state signal-hydrate` in a different shape. A loose substring match (`portal state signal-hydrate` alone) is **not** acceptable.
- **Ordering:** Scan-then-evict-then-install. For each hydration-trigger event: enumerate entries → identify entries matching the eviction predicate → call `UnsetGlobalHookAt` for each (highest index first, so earlier indices are not invalidated by removal) → then proceed with the existing `RegisterHookIfAbsent` call which installs the fixed entry.
- **Error handling:** Eviction is best-effort. If `UnsetGlobalHookAt` fails on a given index, log a WARN line (`WARN | bootstrap | failed to evict stale signal-hydrate hook on <event> at index <i>: <err>`) and continue with the remaining indices. After the eviction loop completes (success or partial failure), proceed with the install step regardless — the install is itself idempotent (`RegisterHookIfAbsent` skips if the fixed entry is already present). Eviction failures must not abort bootstrap; they surface as warnings only. AC #3's "exactly 1 entry after bootstrap" invariant is verified by the migration test (Testing Requirements item 4) on the next bootstrap, which will retry eviction.
- **Operator visibility:** When at least one entry is evicted on a given bootstrap, emit a single INFO line to `portal.log` of the form `INFO | bootstrap | evicted N stale signal-hydrate hook(s) lacking '--' separator`. Bootstraps with no evictions are silent (no log noise on the steady-state path).

The migration runs at every bootstrap (idempotent) — once a user's install has only the fixed entry, subsequent bootstraps perform no eviction work and emit no INFO line.

### Part 2 — Delete `PredictLiveIndices` and Its Consumers

Delete the dead diagnostic prediction path entirely:

- `internal/restore/session.go::PredictLiveIndices` — function and its helpers `readIndexOption` (if unused after removal).
- `internal/restore/session.go::flattenSavedPanePositions` — only consumer was `warnOnPaneKeyDrift`.
- `internal/restore/restore.go::Orchestrator.warnOnPaneKeyDrift` — the diagnostic itself.
- Any call site in the orchestrator's restore loop that invokes `warnOnPaneKeyDrift`.
- Tests covering the deleted functions.

**Pre-deletion verification:** For each symbol in the list above, confirm zero remaining references across the entire repository (production, tests, exported API surface) before removal. If any references are found that are not also in the deletion list, surface them for review rather than silently deleting — they may indicate a downstream consumer that wasn't accounted for in the investigation.

**Test-side audit:** Explicitly grep `_test.go` files for references to `PredictLiveIndices`, `warnOnPaneKeyDrift`, `flattenSavedPanePositions`, and `readIndexOption`. Likely candidates: `internal/restore/session_test.go` and `internal/restore/restore_test.go`, but the audit must cover the whole repo — test helpers and integration tests in `cmd/bootstrap/` could also reference them. Remove or refactor any matches; do not leave dead test scaffolding (mocks, fixtures) for the deleted symbols.

**Rationale for deletion over repair:** The function exists only to power a diagnostic WARN with no functional consumer. The spec's "Index Semantics" section mandates "re-query live indices, never predict" — a repaired predictor would buy a marginal post-restore drift signal at the cost of new tmux-client surface area (session-scope and window-scope option getters) and continued conceptual tension with the spec mandate.

If post-restore drift visibility ever becomes valuable, a saved-vs-live comparison is the better shape than predicted-vs-live and can be added later without resurrecting prediction. Pane-count mismatch is already logged at `armPanes:202`, providing a coarser but consistent signal.

### Out of Scope

The following were considered and explicitly excluded from this fix:

- **Renaming `SanitiseProjectName`'s `.` → `-` substitution to `_` or another safe char.** Fixes one symptom (no more leading-dash names from dotfiles projects) but leaves the broader class — any user-issued or scripted invocation passing `-anything` to a hook-invoked Portal subcommand would still break. Also a backwards-incompatible change for existing users whose projects/sessions use the current scheme. Worth re-evaluating in a separate, larger discussion later — not as a fix for this bug.
- **Pass session via env var or `set-environment` instead of positional argv.** Most robust to weird names (quotes, semicolons, etc.) but requires invasive run-shell setup. Overkill for the constrained name alphabet Portal generates; `--` solves the actual observed class.
- **`cobra.Command.DisableFlagParsing = true` on `stateSignalHydrateCmd`.** Works but loses the ability to add real flags later and is less intent-preserving than `--`.
- **Repairing `PredictLiveIndices` to read `base-index` from session scope and `pane-base-index` from window scope.** Considered and rejected for the reasons above (no functional consumer, conflicts with spec mandate).

## Acceptance Criteria

The fix is complete when all of the following hold:

1. **Hydration succeeds for leading-dash session names.** After `tmux kill-server` and reattach, a Portal-managed session whose name begins with `-` (e.g. `-dotfiles-HM9Zhw`) has its saved scrollback replayed into each pane. No `hydrate timeout` WARN appears in `~/.config/portal/state/portal.log`. This holds regardless of `base-index` / `pane-base-index` values in the user's tmux config.

2. **`signal-hydrate` accepts leading-dash session names from a tmux hook.** This criterion is satisfied by the automated cobra-level argv parse test (Testing Requirements item 1) — no separate manual repro artefact is required for sign-off. The test must drive the cobra command tree via `Execute()` against a leading-dash positional argument and assert exit 0 + FIFO byte written; passing the test confirms the previous parse error (`unknown shorthand flag: 'd'`) no longer occurs.

3. **Existing installs are migrated on first bootstrap, and steady-state bootstraps are no-ops.** After upgrading, the next Portal command that runs the bootstrap orchestrator removes any pre-existing hook entry that lacks the `--` separator and installs the fixed entry. **Verifiable as a runtime invariant:** for each event in `hydrationTriggerEvents`, the count of hook entries containing `portal state signal-hydrate` is exactly 1 after bootstrap, and is unchanged across two consecutive bootstraps invoked back-to-back. The migration test (Testing Requirements item 4) asserts this invariant directly.

4. **No misleading `predicted=...__0.0 live=...__X.Y` WARN appears in `portal.log`** under any tmux config. The diagnostic is gone, not silenced. Verified by the reboot round-trip integration test (Testing Requirements item 2) running with non-zero `base-index` / `pane-base-index`: after bootstrap completes, `portal.log` must contain zero lines matching the regex `predicted=.*__\d+\.\d+ live=.*__\d+\.\d+`. The pre-deletion verification step (in Part 2) confirms the symbols are gone; this AC confirms the runtime behaviour is gone with them.

5. **No regression in the existing live-index path.** Sessions whose names do not start with `-` continue to restore and hydrate as before. Pane-count mismatch logging at `armPanes:202` is preserved.

## Testing Requirements

The following test coverage must be in place before the fix is considered complete:

1. **Cobra-level argv parse test for `signal-hydrate`.** A unit test exercising `runSignalHydrate` end-to-end via the cobra `Execute()` path (not direct `signalHydrateConfig` construction) with a session name starting with `-`. Today's tests in `cmd/state_signal_hydrate_test.go` bypass argv parsing by calling the run function directly; they would not have caught this bug. The new test must drive the cobra command tree the same way production does.

2. **Reboot round-trip integration coverage with leading-dash session name.** Extend `cmd/bootstrap/reboot_roundtrip_test.go` (or add a sibling integration test) using a session name that begins with `-` to exercise the full hook-firing path: client-attached fires → `signal-hydrate` runs via `run-shell` → FIFO byte written → helper unblocks → scrollback replays. **Must run against a real tmux server** via the `internal/tmuxtest` real-tmux socket fixture — a mock-based shape would not exercise tmux's actual `run-shell` argv resolution and so would not catch the bug. The existing test's session names ("alpha", "beta") would not have surfaced this failure.

3. **Hook content unit test.** A test asserting that `signalHydrateCommand` includes the `--` separator before `#{session_name}`, so future edits to the constant cannot silently regress the fix.

4. **Migration test for `RegisterPortalHooks`.** A unit test verifying that bootstrap evicts a pre-existing hook entry containing `portal state signal-hydrate` without `--` and installs the fixed entry. A second invocation of the same bootstrap step must be a no-op (idempotent). **Test setup:** prefer a real-tmux socket fixture (`internal/tmuxtest`) over a mocked `Commander` — the eviction logic depends on the precise format of `show-hooks` output and `set-hook -gu` index semantics, both of which a mock would have to re-implement to be faithful. Real-tmux gives end-to-end fidelity at low cost.

### Testing Constraint — Do Not Restart The Active Tmux Server

The tmux server hosting the developer's working session must **not** be killed (`tmux kill-server`) as part of executing tests or manual verification. Doing so terminates the running session and halts work in progress.

Reboot round-trip tests and any manual reproduction must use a **separate, isolated tmux server** — typically by pointing tmux at a dedicated socket via `tmux -L <test-socket>` (or equivalent fixture, e.g. `internal/tmuxtest`'s real-tmux socket helper). The `kill-server` step exercised by these tests targets only the test socket; the developer's primary tmux server is unaffected.

This constraint applies to all automated tests, manual repro steps documented in PRs, and any debugging session.

---

## Working Notes
