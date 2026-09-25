# Specification: Bootstrap CleanStale Wipes Hooks On Tmux Transient

## Specification

## Problem Statement

### Defect

Bootstrap step 11 (`CleanStale`) and the `portal clean` subcommand silently wipe all entries from `~/.config/portal/hooks.json` whenever `tmux list-panes -a` returns empty for any reason during execution. The destructive call leaves no log breadcrumb at the adapter layer — the only post-hoc evidence is the wiped file.

**Observed evidence (2026-05-26, ~17:11Z):** `hooks.json` went from 22 valid per-pane on-resume entries to `{}` empty during a bootstrap cycle. The same bootstrap left a Component B WARN at `17:11:25Z` (`sweep: list-panes _portal-saver failed, legitimate set empty: ...`), time-correlating the wipe with a tmux transient.

### Expected Behavior

When `list-panes -a` returns a non-zero exit code or an empty result, the cleanup must treat the live-pane set as **unknown**, not as **empty**. Specifically:

- Skip the destructive call.
- Log a `Warn` at `ComponentBootstrap`.
- Continue (next bootstrap retries).

This matches the posture already in force at:
- Bootstrap step 9 (`CleanStaleMarkers` — error-propagating helper + mass-deletion hazard guard).
- Component B orphan-sweep (logs and skips on transient `list-panes` failure).

### Failure Modes Covered

The fix must close both failure modes that produce the destructive end-state:

- **(a)** `list-panes -a` exit ≠ 0 (transient tmux failure during saver-respawn or under load) — evidenced by the observed Component B WARN.
- **(b)** `list-panes -a` exit 0 with empty stdout (saver mid-respawn momentary "no panes" reply) — plausible but unobserved; precautionary coverage.

### Trigger Windows of Highest Empirical Risk

Four documented windows produce the tmux transient in which the wipe fires. They define where integration tests should be seeded and where post-fix monitoring is most informative:

1. **Saver-respawn window** after the `slow-open-empty-previews-and-zombie-sessions` bugfix triggers kill-and-recreate of `_portal-saver`.
2. **Version-upgrade kill cycle** in `EnsurePortalSaverVersion` (the Component A kill-barrier executes `kill-session` followed by a 5s exit poll and identity-checked SIGKILL escalation).
3. **Tmux server under heavy load**, where transport-level `list-panes` failures become non-rare.
4. **The same race that produced the observed Component B WARN** at `17:11:25Z` 2026-05-26 (`sweep: list-panes _portal-saver failed, legitimate set empty: ...`).

Step 11 (`CleanStale`) runs after `EnsureSaver`, `Restore`, `EagerSignalHydrate`, `CleanStaleMarkers`, and `SweepOrphanFIFOs` — placing it inside the tail of the recovery window for every bootstrap that exercises any of these triggers.

### Scope of Wipe (Bounding)

The wipe affects **user-session hooks only**. Portal-internal sessions (`_portal-bootstrap`, `_portal-saver`) never have `hooks.json` entries — they are filtered out at registration. During a fired event: 100% of user hooks affected, 0% of portal-internal hooks.

### User-Visible Impact

At next reboot, no Claude session auto-resumes because every per-pane on-resume hook entry is gone. The user must manually identify and resume each Claude session via Claude's own session picker — precisely the scenario the Portal resume system was built to prevent. Recovery one-shot exists (`~/.claude/hooks/portal-resume-backfill.sh --apply`) but is not durable until this bug is fixed.

### Symptom Distinguishability

User-facing symptoms collide with the earlier `slow-open-empty-previews-and-zombie-sessions` bug ("none of my Claude sessions resumed"), but `portal.log` distinguishes them:

- FIFO race: 53 eager-signal `ENOENT` warnings.
- CleanStale wipe: **zero** warnings (silent at the adapter).

"Silent in logs" is itself a fingerprint for this defect class until the new adapter logging lands.

## Root Cause

**Dual conflation across two layers, neither of which independently makes the bug appear, but jointly produce silent destruction of `hooks.json` whenever `tmux list-panes -a` returns an empty result for any reason during a bootstrap-triggering command.**

### Layer 1 — Helper Swallow (`internal/tmux/tmux.go:687-693`)

`(*tmux.Client).ListAllPanes` swallows every error class — transient transport failures, exit ≠ 0 from a saver-respawn race, server-gone, and legitimate empty — into the same `([]string{}, nil)` signal. The contract is irreversibly ambiguous from this layer up.

```go
func (c *Client) ListAllPanes() ([]string, error) {
    output, err := c.cmd.Run("list-panes", "-a", "-F", "...")
    if err != nil {
        return []string{}, nil
    }
    return parsePaneOutput(output), nil
}
```

The peer helper `ListAllPanesWithFormat` (same file, lines 655-665) does the opposite — it propagates errors. The conflation in `ListAllPanes` is a documented, intentional behavioural divergence. The cost of that divergence is exactly this bug.

### Layer 2 — Unguarded Destructive Consumer

Two callsites pass the (possibly empty) live-pane slice straight to `hooks.Store.CleanStale` with no hazard guard against the `empty live set + non-empty store` combination, and no adapter-level logging:

- `cmd/bootstrap_production.go:76-83` — `cleanStaleAdapter.CleanStale` (bootstrap step 11).
- `cmd/clean.go:75-91` — `portal clean` subcommand's hook-cleanup tail.

The hooks store itself (`internal/hooks/store.go:130-159`) is correctly scoped — it does precisely what its name says ("remove entries for keys not present in `liveKeys`"). The destructive end-state is therefore a caller-side defect, not a store-side defect.

### Why This Happens

The helper's docstring describes the swallow as a convenience for the "no tmux server" case — a real, legitimate situation where `portal clean` should not error out. The convenience was retained when the helper was reused inside bootstrap step 11, where the same swallow becomes a vector for silent destruction because the caller's context guarantees a tmux server *is* running. The error-swallow assumption that was safe outside tmux became unsafe inside tmux without the docstring or implementation being revisited.

### Architectural Inconsistency

Bootstrap step 9 (`CleanStaleMarkers`) implements the same diff-then-delete shape against tmux server-option markers and is **immune** to this defect by construction:

1. Uses `ListAllPanesWithFormat` (the error-propagating helper).
2. Has an explicit mass-deletion hazard guard (`cmd/bootstrap/stale_marker_cleanup.go:126-141`) that refuses to unset markers when the parsed live set is empty but markers exist.

Step 11 has the same shape of work but neither safeguard. **The architectural inconsistency is the bug.** The fix lifts the step-9 pattern verbatim into the two affected callsites.

## Fix Specification

**Defense-in-depth across both layers**, lifting the prior-art pattern from bootstrap step 9 (`CleanStaleMarkers`) verbatim. Three coordinated changes:

### Defect Class Scope (Audit Result)

An audit of all production callers of the live-pane enumeration helpers bounds the defect class to exactly **two** sites — both fixed by this work unit:

- `cmd/bootstrap_production.go:76-83` — `cleanStaleAdapter.CleanStale` (bootstrap step 11).
- `cmd/clean.go:75-91` — `portal clean` hook-cleanup tail.

No other consumer of `ListAllPanes` exists. Consumers of `ListAllPanesWithFormat` (the error-propagating variant) already handle the empty/error path correctly (see "Audited Reference Set" below). The fix therefore has no third-party callsite to update.

### Audited Reference Set — Correct-by-Construction Consumers

The three production consumers of `ListAllPanesWithFormat` already handle errors deliberately and form the pattern reference the fix lifts:

- **`cmd/bootstrap/stale_marker_cleanup.go:119`** — step 9 (`CleanStaleMarkers`); propagates the helper error to its caller and applies the mass-deletion hazard guard at lines 126-141. This is the canonical prior-art for Change 3.
- **`internal/state/capture.go:99`** — daemon capture loop; treats non-nil as a per-tick skip (not destructive). Demonstrates the propagating helper is safely consumable inside high-frequency loops without escalation.
- **`cmd/bootstrap/orphan_sweep.go`** — Component B (orphan-sweep); logs at WARN under `ComponentBootstrap` and skips on non-nil. This is the same posture the spec mandates at step 11 for hooks.

That the propagating-helper-plus-explicit-handling pattern is already idiomatic across three independent subsystems grounds the architectural-consistency argument: the fix does not introduce a new convention, it removes a divergent outlier.

### Change 1 — Repurpose `ListAllPanes` to Wrap the Error-Propagating Helper

**File:** `internal/tmux/tmux.go` (~line 687-693).

Replace the current swallow body so that `ListAllPanes` becomes a thin wrapper around `ListAllPanesWithFormat`, propagating errors. Reuse the existing `parsePaneOutput` helper (same package) — no new parser is required. Approximate shape:

```go
func (c *Client) ListAllPanes() ([]string, error) {
    raw, err := c.ListAllPanesWithFormat("#{session_name}:#{window_index}.#{pane_index}")
    if err != nil {
        return nil, err
    }
    return parsePaneOutput(raw), nil
}
```

**Return-value contract change.** On error, the pre-fix helper returns `([]string{}, nil)` (non-nil empty slice, nil error). The post-fix helper returns `(nil, err)`. The Defect Class Scope audit confirms only two production consumers exist, both modified by this work unit; both check `err` and treat `nil`/empty slices identically for range/len operations, so the contract shift is safe across the audited set. Test stubs of the `AllPaneLister` / `LivePaneLister` interfaces should adopt the new `(nil, err)` shape on the error path.

**Format-string alignment.** The format string `"#{session_name}:#{window_index}.#{pane_index}"` matches the canonical structural-key form produced by `(*tmux.Client).ResolveStructuralKey` (used at hook-registration time). Hook entries in `hooks.json` are keyed by structural key, so the comparison in `hooks.Store.CleanStale` operates on identical-format strings on both sides. No parser-format mismatch exists.

**Disposition rationale (locked):** repurpose, not delete or deprecate.
- Deletion forces every call site (production and test) to be touched in this work unit; high blast radius for a contract-narrowing change.
- Deprecation with `// Deprecated:` keeps the footgun alive — the compiler does not enforce the tag.
- Repurpose structurally eliminates the swallow contract while keeping every existing call site compiling unchanged (the slice consumers compile through; only the error-path runtime shape narrows). New consumers inherit the safe behaviour by default.

**Helper docstring rewrite.** The existing docstring on `(*tmux.Client).ListAllPanes` (currently describes the swallow as a convenience for the "no tmux server" case) must be rewritten alongside the code change to describe the new error-propagating contract. Remove the no-server-convenience framing; describe what the helper actually does now: enumerate live panes via the error-propagating `ListAllPanesWithFormat` helper, return `(nil, err)` on tmux failure, and let the caller decide policy for empty/error results. Mirrors the docstring-rewrite directive in Change 3 for `cleanStaleAdapter.CleanStale`.

### Change 2 — Hook-Cleanup Parser Reuse (No Promotion Required)

The parser at `cmd/bootstrap/stale_marker_cleanup.go` (`parseLivePaneSet`) produces **canonical paneKeys** via `state.SanitizePaneKey` — the form used by `@portal-skeleton-*` markers. Hook entries in `hooks.json` are keyed by **structural keys** (raw `session:window.pane` from `ResolveStructuralKey`), not canonical paneKeys. These two parsing concerns are **distinct**, so `parseLivePaneSet` is **not** the right utility to share for hook cleanup, and no promotion is required.

The existing `parsePaneOutput` helper inside `internal/tmux/tmux.go` (split + trim) already produces the structural-key form `hooks.json` expects. Reuse it inside the repurposed `ListAllPanes` (per Change 1). Leave `parseLivePaneSet` in place — it remains the marker-side parser and is unaffected by this work unit.

### Change 3 — Add Mass-Deletion Hazard Guard at Both `CleanStale` Callsites

**Files:**
- `cmd/bootstrap_production.go:76-83` — `cleanStaleAdapter.CleanStale`.
- `cmd/clean.go:75-91` — `portal clean` hook-cleanup tail.

**Current adapter shape.** `cleanStaleAdapter` (lines 66-69) holds `client *tmux.Client` + `store *hooks.Store`. Its only method `CleanStale() error` (lines 76-83) calls `a.client.ListAllPanes()` directly (no seam interface), then `a.store.CleanStale(livePanes)`. The fix introduces a `Logger` field on the struct and adds the hazard guard between the two calls. The struct continues to consume `*tmux.Client` directly — no new seam interface is introduced — but tests for the new `cmd/bootstrap_production_test.go` file may abstract `ListAllPanes` behind a local `AllPaneLister` interface (matching the existing shape in `cmd/clean.go:13-15`) to keep stubs unintrusive.

**Hazard-guard algorithm.** Before passing the live-pane slice to `hooks.Store.CleanStale`:

1. Load the persisted hooks via `hookStore.Load()` (already a public method on `*hooks.Store`); this returns the current `hooksFile` map. Use `len(persisted) > 0` as the guard's right-hand condition. No new API on `internal/hooks/store.go` is required. `portal clean` already calls `hookStore.Load()` (line 65) and exits early when empty (line 71-73), so this read is already paid for at that callsite. The bootstrap adapter must add the `Load()` call.

   **`Load()` error handling.** When `hookStore.Load()` returns a non-nil error (disk read failure, JSON parse error on a corrupt `hooks.json`), the adapter:

   1. Emits a `Warn` breadcrumb: `"stale-hook cleanup: hookStore.Load failed: <error>"`.
   2. Returns the error directly (no `hookStore.CleanStale` call), letting the orchestrator surface it as a soft warning.

   This treats `Load()` failure the same as a `ListAllPanesWithFormat` error and avoids the corrupt-file-overwrite hazard — if `Load()` were treated as `len(persisted) == 0`, a normal-path stale removal could proceed against an unparseable file, overwriting it with `{}` and silently destroying recoverable state. The "treat unknown as unknown" principle applies on both sides of the hazard guard. The `Warn` breadcrumb preserves the "single auditable destructive-callsite log stream" property (no silent-destructive-context fingerprint reintroduced). The `portal clean` callsite already errors out on `Load()` failure (line 65-68); preserve that behaviour and emit the same-shape `Warn` breadcrumb before the existing error return.
2. Check the combination `len(livePanes) == 0 && len(persisted) > 0`. When that combination holds:
   - Emit `Logger.Warn(ComponentBootstrap, "stale-hook cleanup: zero live panes parsed with %d hook(s) present; skipping to avoid mass-deletion hazard (next bootstrap retries)", len(persisted))`.
   - Skip the destructive `hookStore.CleanStale(...)` call.
   - Return nil (next bootstrap retries).
3. When `len(livePanes) == 0 && len(persisted) == 0`: return nil silently — nothing to do, no hazard.
4. Otherwise: proceed to `hookStore.CleanStale(livePanes)` as before.

This mirrors the prior-art at `cmd/bootstrap/stale_marker_cleanup.go:126-141` exactly, with `len(persisted)` substituted for `len(markers)`.

**The load-bearing comment block at `cmd/bootstrap/stale_marker_cleanup.go:80-92` must be lifted alongside the code**, adapted to name hook entries (rather than markers) as the protected data. The original prose reads: *"Treating an empty live set as authoritative would destabilise a still-live tmux server by unsetting every marker — including markers protecting legitimate hydrate-in-progress panes. The deferral is a successful soft outcome ('skip this run; next bootstrap retries'), not a failure."* The adapted equivalent for the hook-cleanup site must name `hooks.json` entries as the protected data and preserve the "deferral is a successful soft outcome" framing so the guard self-documents at its callsite.

**Logger plumbing (bootstrap adapter):** `cleanStaleAdapter` gains a `Logger` field (interface shape matching `bootstrap.Logger` — `Debug`/`Warn`/`Error`). It is populated from the orchestrator-scope logger using the same field-population pattern at `cmd/bootstrap_production.go:147-152` where `MarkerCleanupCore` already receives one. The orchestrator-scope logger is resolved at lines 109-110 (`openNoRotateLogger`); apply the same nil-tolerance contract — call `Logger.Warn`/`Debug` unconditionally with a no-op substitute when nil, mirroring `MarkerCleanupCore.CleanStaleMarkers` at lines 109-112 of `stale_marker_cleanup.go`.

**Logger plumbing (`portal clean`):** the `RunE` closure in `cmd/clean.go` does not currently construct a logger. Acquire one via the same `openNoRotateLogger()` helper used in bootstrap (it returns a `*state.Logger` writing to the shared `portal.log` under the resolved state dir). Failures from `openNoRotateLogger()` are tolerated — the helper returns nil and the no-op substitute applies. The hazard-guard `Warn` and the new adapter-level `Debug`/`Warn` lines (Change 4) flow into the same `portal.log` the bootstrap path writes to, giving a single auditable destructive-callsite log stream regardless of which entry point triggered the cleanup. User-facing stderr output from `portal clean` is unchanged.

**Soft-warning surfacing contract.** A non-nil error returned from `cleanStaleAdapter.CleanStale` is converted to a `warning.Warning` by the `bootstrap.Orchestrator` step-runner, identical to how step-9 (`CleanStaleMarkers`) and step-11 errors are currently handled by the orchestrator's "never abort `PersistentPreRunE`" rule. The adapter does **not** need to wrap the error itself — returning it is sufficient. (The orchestrator's accumulated warnings are flushed to stderr post-bootstrap; refer to the step-9 path for the wiring precedent.) For `portal clean`, the propagated error is surfaced as a `Warn` log line at the callsite plus an early non-destructive return; the subcommand's `RunE` continues to return nil for the hook-cleanup tail's transient failures (matching the existing pre-fix safety-net posture at lines 77-80, which already chose silence-and-continue over user-facing error).

**Adapter docstring rewrite:** the existing docstring on `cleanStaleAdapter.CleanStale` at `cmd/bootstrap_production.go:71-75` reads: *"A `ListAllPanes` failure degrades to no-op (returns nil) so a transient tmux error during bootstrap never aborts the user's command — matches the safety-net semantic in `portal clean`."* Post-fix this is actively misleading — the adapter no longer degrades to a no-op; it surfaces propagated errors as soft warnings and refuses the wipe under the hazard guard. The docstring must be rewritten alongside the code change to describe the new contract: (i) error from `ListAllPanesWithFormat` returned for soft-warning handling, (ii) hazard-guard skip on `empty live + non-empty store`, (iii) normal-path stale removal otherwise.

The `portal clean` subcommand must apply the same hazard guard at `cmd/clean.go:75-91`.

### Change 4 — Add Adapter-Level Logging

At both `CleanStale` callsites, every invocation emits **exactly two log lines**: one entry-point line (after enumeration so both counts are known) and one terminal line (whose log-level depends on which branch fires).

**Entry-point line — emitted once per invocation, immediately after the `ListAllPanes` + `Load` calls complete successfully and before the hazard-guard check:**

- **`Debug` after enumeration** — `"stale-hook cleanup: live=<N> persisted=<M>"` (both counts known at this point).

**`portal clean` early-exit special case.** `cmd/clean.go` retains its existing pre-enumeration early-exit when `len(persisted) == 0` (the existing line 71-73 short-circuit; preserved to keep the no-tmux-server ergonomics intact). On that branch, neither `ListAllPanes` nor the hazard guard runs. Emit a single `Debug` breadcrumb at the early-exit before returning: `"stale-hook cleanup: persisted=0, skipping"`. This preserves the "every invocation logs at least one breadcrumb" property without inverting `portal clean`'s entry ergonomics. The bootstrap adapter does **not** take this branch — it always calls `ListAllPanes` first and consumes the entry-point Debug + terminal-line pair.

**Terminal line — mutually exclusive, exactly one fires per invocation:**

- **`Warn` on propagated error from `ListAllPanesWithFormat`** — surfaces mode (a) with the wrapped error message. Fires before the entry-point line if `ListAllPanes` itself fails (so this branch emits only the terminal line, not the entry-point line).
- **`Warn` on `hookStore.Load()` failure** — `"stale-hook cleanup: hookStore.Load failed: <error>"` (corrupt/unreadable `hooks.json`). Fires before the entry-point line if `Load()` itself fails.
- **`Warn` when the hazard guard fires** — `"stale-hook cleanup: zero live panes parsed with <M> hook(s) present; skipping to avoid mass-deletion hazard (next bootstrap retries)"` (mode (b)).
- **`Debug` on normal-path completion** — `"stale-hook cleanup: removed=<K>"` after `hookStore.CleanStale` returns successfully.

The mutual exclusivity is structural: the adapter exits exactly once per invocation, and each exit path emits its terminal line. Tests in `cmd/bootstrap_production_test.go` assert this — the hazard-guard subtest asserts the `Warn` is recorded and the `Debug`-on-completion line is **not**.

**Post-fix log distinguishability:** failure modes (a) (exit ≠ 0) and (b) (exit 0 with empty stdout) become distinguishable in `portal.log` — mode (a) surfaces as the propagated-error `Warn` (no entry-point Debug line); mode (b) surfaces as the entry-point `Debug` followed by the hazard-guard `Warn`. Currently both modes are silent at the adapter.

### Bootstrap Posture Preserved

Bootstrap step 11 remains **best-effort** under the orchestrator's "never abort `PersistentPreRunE`" rule. The propagated error from `ListAllPanesWithFormat` and the hazard-guard skip both manifest as soft warnings, not fatal aborts. The change is "treat empty as unknown, log, and continue," not "fail loudly on empty."

### Closing Both Failure Modes

| Failure mode | Closed by |
|---|---|
| (a) `list-panes -a` exit ≠ 0 | Change 1 (helper propagates error → adapter returns it as soft warning) |
| (b) `list-panes -a` exit 0 with empty stdout | Change 3 (hazard guard refuses wipe when `len(live)==0 && len(persisted)>0`) |

Either change alone leaves one failure mode open. Both are required.

## Test Requirements

### New File — `cmd/bootstrap_production_test.go`

This file does **not** exist today; `cleanStaleAdapter` has zero unit coverage. The fix must create it and populate it with the bootstrap adapter's `CleanStale` path coverage. Inverting the existing `clean_test.go` subtest is necessary but **not sufficient** — the adapter has its own path.

Required subtests:

- **Hazard guard fires on empty live set.** Stub `LivePaneLister` returns empty slice + hooks store seeded with N entries → assert no `Save` call on the hooks store and a `Warn` is recorded with both counts. Mirrors `cmd/bootstrap/stale_marker_cleanup_test.go`'s hazard-guard coverage.
- **Hazard guard does not fire when both sides empty.** Empty live set + empty persisted set → no warn, no save, no error. Confirms the guard is not noisy.
- **Error from `ListAllPanesWithFormat` propagates as soft warning.** Stub returning non-nil error → adapter returns the error → orchestrator (or test harness) wraps as a soft warning.
- **Legitimate stale removal still works.** Live set `{a,b,c}`, persisted `{a,b,c,d}` → assert `d` removed; `a/b/c` preserved.

### Inverted Subtest — `cmd/clean_test.go:327-368`

The existing subtest `"zero live panes prunes every hook entry"` codifies the destructive behaviour as correct, with a comment block stating: *"Phase 4: CleanStale runs unconditionally. With no live panes, every hooks.json entry is genuinely orphaned and must be pruned."* That mental model — empty live set ⇒ genuinely orphaned — **is** the bug expressed as a positive test.

The fix must **invert** this subtest:

1. Preserve the structural coverage that the test provides — "what happens when `ListAllPanes` returns an empty slice."
2. Flip the asserted outcome: from "every hook entry pruned" to **"no entry removed, hooks file unchanged, output reports the deferral."**
3. Rewrite the comment block (lines 333-335) so the new mental model — **"empty live set is *ambiguous*, not authoritative"** — is captured in test prose.

Same inversion shape used by the `hooks-skip-bootstrap` quickfix — reference commit `7e33c04b` (`impl(hooks-skip-bootstrap): T1-2 — invert hooks list test, add hooks set test`). That commit shows the structural-preserve-flip-assert pattern: the test's setup and call shape are kept; the asserted outcome is inverted; the comment block is rewritten so the new mental model is captured in test prose alongside the assertions.

### Deterministic Repro Mechanism

The canonical mechanism for reproducing failure mode (a) deterministically is **`Commander` injection** at the `tmux.Client` boundary. A stub `Commander` returning `exit 1` (or empty stdout for mode (b)) on the `list-panes -a` call exercises the destructive path without spawning a real tmux server. The hazard-guard unit subtests rely on stub `LivePaneLister`s one layer up; `Commander`-level injection is the lower-level analogue used by integration tests when they want the deterministic failure without coordinating a saver-respawn race.

### Integration — Tmux Transient Simulation

Spawn a real tmux server, populate `hooks.json`, kill `_portal-saver` mid-bootstrap, and arrange for `list-panes -a` to return exit ≠ 0 via a `Commander` stub at the integration boundary (per the Deterministic Repro Mechanism above). Assert `hooks.json` is unchanged at the end of the bootstrap.

### Integration — `portal clean` Analogue

Same pattern against the `portal clean` callsite — assert it does not wipe entries on transient `ListAllPanes` failure or empty result.

### Regression — Non-Empty Live Sets

Confirm no behavioural change in existing `cmd/clean_test.go` non-empty live-set paths.

### Coverage Matrix

| Path | Test |
|---|---|
| Bootstrap adapter — hazard guard fires | New `cmd/bootstrap_production_test.go` |
| Bootstrap adapter — both-empty no-op | New `cmd/bootstrap_production_test.go` |
| Bootstrap adapter — error propagates | New `cmd/bootstrap_production_test.go` |
| Bootstrap adapter — legitimate stale removal | New `cmd/bootstrap_production_test.go` |
| `portal clean` — empty live set refuses wipe | Inverted `cmd/clean_test.go:327-368` |
| Tmux transient end-to-end | New integration test |
| `portal clean` transient end-to-end | New integration test |

## Acceptance Criteria

A bootstrap-triggering command (`portal open`, `x`, `portal hooks set`, `portal hooks rm`, etc.) executed while tmux is in a transient state (where `list-panes -a` returns exit ≠ 0 or empty stdout) must leave `hooks.json` **unchanged**.

Specifically:

1. **Hazard guard:** when `len(livePanes) == 0 && len(persistedHooks) > 0` at either `CleanStale` callsite, no entries are removed from `hooks.json` and a `Warn` is emitted at `ComponentBootstrap` recording both counts.
2. **Error propagation:** when `ListAllPanesWithFormat` returns a non-nil error, the adapter returns that error; the orchestrator surfaces it as a soft warning. `hooks.json` is untouched.
3. **Normal-path preservation:** when the live-pane set is non-empty, the pre-fix behaviour is preserved verbatim — stale entries are removed; live entries are kept.
4. **Log breadcrumbs:** every invocation of `cleanStaleAdapter.CleanStale` and the `portal clean` hook tail emits exactly two log lines on the success-of-enumeration paths (one `Debug` after enumeration with both counts, plus one terminal line — `Debug` on completion with removed count, or `Warn` on hazard-guard skip), or exactly one terminal `Warn` on either enumeration-error path (propagated error from `ListAllPanesWithFormat`, or non-nil error from `hookStore.Load()` — both fire before the entry-point Debug, so neither branch emits the entry-point line). The terminal lines are mutually exclusive per invocation. `portal clean`'s pre-enumeration early-exit on `persisted == 0` emits a single `Debug` breadcrumb so every invocation still produces at least one log line.
5. **Bootstrap posture preserved:** no fatal abort from `PersistentPreRunE` is introduced. The orchestrator's "never block the user's command" rule remains in force.
6. **Coverage:** every entry in the test coverage matrix exists, passes, and inverts (where the existing test asserts the destructive outcome) to assert the new "refuse + warn" outcome.

## Out of Scope

The following are explicitly **not** part of this work unit:

- **Removing the swallow at the helper layer for "no tmux server" use cases.** The repurposed `ListAllPanes` will propagate errors uniformly; if a future user of `portal clean` wants the prior "no server → no error" ergonomics, that is a separate decision handled at the callsite, not by re-introducing the swallow.
- **Defensive cross-check via `ListSessionNames` / `has-session`.** Considered (Option D in the investigation) and judged unnecessary given the hazard guard's coverage. May be revisited only if review surfaces a scenario where `len(persisted) > 0` is itself ambiguous.
- **Retry-with-backoff on empty result.** Rejected — conflicts with the bootstrap "never block `PersistentPreRunE`" posture; the hazard guard achieves the same end (defer-and-retry-next-bootstrap) without polling.
- **Disabling step 11 entirely.** Stale hook cleanup at bootstrap remains desirable; the fix makes it safe, not removes it.
- **Migration messaging for users relying on `portal clean` as "kill all hooks when no tmux."** The investigation flagged this as a spec-phase open item (deliberate-vs-accidental rationale for the existing destructive subtest). **Resolution:** no migration messaging required. The destructive interpretation in `clean_test.go:327-368` is treated as the codified-as-correct expression of the bug, not as deliberate user-facing behaviour worth preserving. Users wanting to clear all hooks should use `portal hooks rm` explicitly per-entry; an explicit "wipe all" subcommand can be added later if demand surfaces.
- **`hooks.json` schema changes.** None.

## Risk Assessment

- **Fix complexity:** Low–Medium. Three changes are individually small; the largest line-count contributor is the parser-deduplication refactor. No tmux-protocol changes, no `hooks.json` schema changes, no concurrency changes.
- **Regression risk:** Low. The destructive code path is the failure mode; the fix narrows what triggers it without removing legitimate cleanups. Existing non-empty-live-set tests should pass unchanged.
- **Release cadence:** Regular release. The bug is high-severity (silent data destruction) but the trigger window is intermittent and a recovery one-shot exists (`portal-resume-backfill.sh --apply`). Hotfix cadence is not required.

## Notes

- Not a regression from any recent change. The destructive pattern has existed since `CleanStale` was wired to the live-pane enumeration. Recent `slow-open-empty-previews-and-zombie-sessions` and `saver-kill-respawn-loop-leaks-daemons` releases increase exposure because they involve more bootstrap activity during which tmux transients become more frequent.
- **v0.5.11 (`hooks-skip-bootstrap`) was a frequency mitigation, not a latency fix.** That quickfix eliminated the `SessionStart` cascade that was triggering bootstrap on every Claude session start, reducing how often the destructive callsite executed. It did **not** change the per-execution latency of the bug — `portal open`, `x`, and attach during a tmux transient can still wipe everything. This work unit closes the latency. The subtest-inversion pattern used in v0.5.11 (commit `7e33c04b`) is the test-inversion shape that Test Requirements lifts here.
- Component B (orphan-sweep) already implements the "log and skip on transient" posture this fix is asking for elsewhere — Component B's behaviour is the prior-art reference alongside step 9.
- The wipe affects user-session hooks only — portal-internal sessions (`_portal-bootstrap`, `_portal-saver`) are filtered out at registration and never appear in `hooks.json`.
- **Historical near-miss.** The 2026-05-19 `saver-kill-respawn-loop-leaks-daemons` investigation explicitly listed `CleanStale` as a candidate destructive force for disappearing `daemon.version`, but the line of inquiry did not reach the hooks-wipe defect class. The defect was within the field-of-view of a recent investigation but was not closed — capturing this anchors the post-mortem timing and lets future analogous investigations cross-reference this work unit when triaging similar silent-destruction signals.

---

## Working Notes
