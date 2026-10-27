# Investigation: Bootstrap CleanStale Wipes Hooks on Tmux Transient

## Symptoms

### Problem Description

**Expected behavior:**
Bootstrap step 11 (`CleanStale`) should preserve `hooks.json` entries when tmux is in a transient state where `list-panes -a` returns a non-zero exit code. A transient tmux failure should be treated as "I don't know the live pane set right now — skip cleanup, log, continue," not "the live pane set is empty, therefore every persisted hook entry is stale and should be removed." The same posture is already in force for Component B's orphan-sweep, which logs and skips on a transient `list-panes` failure (`sweep: list-panes _portal-saver failed, legitimate set empty: ...`).

**Actual behavior:**
On 2026-05-26 at ~17:04 BST, `~/.config/portal/hooks.json` went from 22 valid per-pane on-resume hook entries (registered earlier that day by `~/.claude/hooks/portal-resume-backfill.sh --apply`, covering every live Claude session in every active tmux pane) to `{}` empty. No user action that should have produced that outcome occurred:

- No `portal hooks rm` invocations.
- No `portal clean` invocations.
- No Claude `SessionEnd` events firing the removal branch of `~/.claude/hooks/portal-resume-hook.sh` — `/tmp/portal-resume-hook.log` only shows CodexBar probe invocations that exited early at the `TMUX_PANE unset` guard.
- The user-level SessionEnd branch had already been softened earlier the same day so it no longer calls `portal hooks rm` even if it fires.

The wipe correlated tightly in time with a Portal bootstrap that left a single WARN entry in `~/.config/portal/state/portal.log` at `17:11:25Z`:

```
sweep: list-panes _portal-saver failed, legitimate set empty: list-panes -t _portal-saver: exit status 1: can't find window: _portal-saver
```

That WARN is Component B's orphan-sweep noting a transient tmux state where `_portal-saver` was momentarily absent. Component B logged and continued (its documented best-effort posture). The same bootstrap cycle also ran step 11 (`CleanStale`), which appears to have hit a related transient failure when enumerating live panes — and unlike Component B, `CleanStale` did not log-and-skip. It interpreted the transient as "zero live panes exist" and proceeded to remove every hook entry whose key was not in the empty live set — i.e. all 22 of them.

### Manifestation

- Silent data destruction: `hooks.json` content goes from 22 entries to `{}` with no error returned to the user, no WARN in portal.log specifically for the hook wipe, and no UI signal during the bootstrap that ran the cleanup.
- User-visible follow-on impact: at next reboot, no Claude session auto-resumes because every per-pane on-resume hook entry is gone. The user has to manually identify and resume each Claude session via Claude's own session picker — exactly the scenario the Portal resume system was built to prevent.
- Indistinguishable user-symptom from the earlier `slow-open-empty-previews-and-zombie-sessions` bug ("none of my Claude sessions resumed"), even though the upstream cause is entirely different — that bug was about FIFO timing during restore; this one is the cleanup-after-restore step destroying state during a tmux transient. **Distinguishable in logs**, though: the FIFO race left 53 eager-signal `ENOENT` warnings in `portal.log`; the CleanStale wipe leaves **zero** warnings (the destructive adapter call emits no log at all). Until adapter logging is added, "silent in logs" is itself a fingerprint for this defect class.

### Reproduction Steps

1. Have a populated `~/.config/portal/hooks.json` (multiple per-pane `on-resume` entries).
2. Run any Portal-bootstrap-triggering command (`portal open`, `x`, `portal hooks set`, `portal hooks rm`, etc.) while the tmux server is in a transient state where `tmux list-panes -a` returns a non-zero exit code OR returns an empty list.
3. Observe `hooks.json` becomes `{}` empty.

**Reproducibility:** Intermittent in the field (depends on hitting the tmux transient window). Should be deterministic in a unit test by injecting a `Commander` that returns `exit 1` or empty stdout for the `list-panes -a` call.

### Environment

- **Affected environments:** Any environment running `portal` against a live tmux server. Observed on macOS / tmux 3.6b.
- **Trigger windows of highest empirical risk:**
  - Saver-respawn window after the zombie-sessions bugfix triggers kill-and-recreate of `_portal-saver`.
  - Version-upgrade kill cycle in `EnsurePortalSaverVersion`.
  - Any time the tmux server is under heavy load.
  - The same race that produced the observed `sweep: list-panes _portal-saver failed` WARN.
- **User conditions:** Anyone using `portal hooks set --on-resume` to persist per-pane Claude-resume hooks. Severity escalates with the number of registered hooks (one bootstrap can wipe all of them).

### Impact

- **Severity:** High — silent destruction of user-persisted configuration that the user did not request and cannot detect until the next reboot.
- **Scope:** Every user of the Portal hooks subsystem who experiences a tmux transient during a bootstrap-triggering command. Empirically, this includes anyone running on macOS with `_portal-saver` enabled.
- **Business impact:** The Portal resume system's reliability promise is undermined. Recent same-day mitigations (softening user-level SessionEnd to a no-op, rebuilding the backfill script) are fully nullified by this defect — every bootstrap is a fresh opportunity to silently empty `hooks.json`.

### References

- portal.log entry: `~/.config/portal/state/portal.log` line 1 (`sweep: list-panes _portal-saver failed, legitimate set empty: ...` at `17:11:25Z` 2026-05-26). Previous log content was rotated during one of today's bootstrap cycles.
- Recovery one-shot: `~/.claude/hooks/portal-resume-backfill.sh --apply` walks every live Claude session inside tmux and re-registers a hook for each — not durable until this bug is fixed.
- Related memory: [[project_reboot_hooks_followup]] flagged re-verifying reboot Claude-resume hook firing after the slow-open-empty-previews bugfix shipped.

### Initial File Pointers

- `cmd/bootstrap_production.go` — `cleanStaleAdapter.CleanStale` (~line 76-83). No adapter-level logging of the call or the live-panes count.
- `cmd/clean.go` — `portal clean` subcommand (~line 82), same destructive pattern via the same `ListAllPanes` path.
- `internal/tmux/tmux.go` — `ListAllPanes` (~line 687). Collapses `list-panes -a` exit ≠ 0 into `([]string{}, nil)` — indistinguishable from a legitimate empty-pane reply.
- `internal/hooks/store.go` — `Store.CleanStale` (~line 130).

### Observation Boundary

Direct observation extends only to:

1. Component B logged `list-panes -t _portal-saver: exit status 1: can't find window: _portal-saver` at `19:48:39Z`.
2. `hooks.json` went from 23 → 1 entries.
3. No log entry from `cleanStaleAdapter.CleanStale` itself.

From those facts we infer `hookStore.CleanStale` must have been called with an empty (or near-empty) `livePanes` slice. We **cannot** tell from logs whether the upstream `list-panes -a` call returned exit ≠ 0 (which `ListAllPanes` collapses to `([]string{}, nil)`) or returned exit 0 with empty stdout. Both paths produce the same destructive end-state. Component B's WARN is a different list-panes call (`-t _portal-saver`, not `-a`), so it confirms tmux was transient at that moment but does not pin down step 11's exact behavior.

### Failure Modes That Must Be Covered

Both failure modes are plausible and produce the same destructive end-state:

- **(a) `list-panes -a` exit ≠ 0** — collapsed to `([]string{}, nil)` inside `ListAllPanes`. The error is swallowed; the caller cannot distinguish "tmux is transient" from "tmux has no panes."
- **(b) `list-panes -a` exit 0 with empty stdout** — possible during a `_portal-saver` mid-respawn transient (Component F's placeholder-then-respawn ordering reduces but doesn't eliminate this window). Tmux can momentarily reply "no panes" on `-a` with exit 0 while the saver is being recreated.

A fix that propagates the error from `ListAllPanes` alone closes (a) but a real exit-0-with-empty-stdout reply from tmux during a saver-respawn transient (b) would still bypass the error guard.

### Defensive Sanity Gate Worth Considering

Cross-check `ListSessionNames` (or `tmux has-session`) returning non-empty at the adapter layer. If tmux says it has live sessions but `list-panes -a` returns zero panes, that's incoherent and the wipe should be refused. Bounds the blast radius cheaply but is **defense-in-depth, not the root-cause fix.**

### Audit Scope

All other callers of `ListAllPanes` must be audited as part of the investigation. `portal clean` uses the same path at `cmd/clean.go:82`. Any other consumer that interprets `ListAllPanes → empty` as ground truth has the same defect latent.

### Relationship to Recent Releases

The fix in v0.5.11 (`hooks-skip-bootstrap`) reduces trigger frequency by eliminating the `SessionStart` cascade but does **not** change the latency of this bug. `portal open` / `x` / attach during a tmux transient can still wipe everything.

---

## Analysis

### Initial Hypotheses

From the inbox handoff and the user's observation-boundary follow-up:

1. **Error-swallowing in `ListAllPanes`** — the helper collapses any `list-panes -a` failure into `([]string{}, nil)`. A transient exit ≠ 0 looks identical to "no panes exist."
2. **No mass-deletion hazard guard in `cleanStaleAdapter.CleanStale`** — the adapter passes the live-pane slice straight through to `hooks.Store.CleanStale` without checking for the "empty live set + non-empty stored set" hazard pattern.
3. **No adapter-level logging** — neither the call into `ListAllPanes` nor the live-pane count nor the removed count is logged at the adapter, so the destructive path leaves no postmortem evidence.

Each was confirmed by reading the code (below). All three are present simultaneously; the fix must address all three for the defect to be closed.

### Code Trace

**Entry point — `cmd/bootstrap_production.go:76-83`:**

```go
func (a *cleanStaleAdapter) CleanStale() error {
    livePanes, err := a.client.ListAllPanes()
    if err != nil {
        return nil
    }
    _, err = a.store.CleanStale(livePanes)
    return err
}
```

- `err` is in practice unreachable because `ListAllPanes` cannot return a non-nil error (see next layer). The guard exists for shape only.
- No logging on entry. No logging of `len(livePanes)`. No logging of the count removed by `store.CleanStale`.
- The docstring at lines 71-75 already documents the swallow contract — "A `ListAllPanes` failure degrades to no-op (returns nil) so a transient tmux error during bootstrap never aborts the user's command — matches the safety-net semantic in `portal clean`" — but the upstream helper makes that intention unenforceable because the caller never sees the failure.

**Helper layer — `internal/tmux/tmux.go:687-693`:**

```go
func (c *Client) ListAllPanes() ([]string, error) {
    output, err := c.cmd.Run("list-panes", "-a", "-F", "#{session_name}:#{window_index}.#{pane_index}")
    if err != nil {
        return []string{}, nil
    }
    return parsePaneOutput(output), nil
}
```

- Docstring (lines 683-686) says: *"Returns an empty slice and nil error when no tmux server is running."*
- Implementation swallows **every** error, not just the "no tmux server" case. There is no error classification — no `errors.Is(err, ErrNoServer)`, no stderr-pattern discrimination.
- Cannot distinguish:
  - **(a)** `list-panes -a` exit ≠ 0 (e.g., the same transient class that produced Component B's WARN at `19:48:39Z`).
  - **(b)** `list-panes -a` exit 0 with empty stdout (saver mid-respawn, brief steady-state with no panes).
  - **(c)** Legitimate "no tmux server" / no live panes.
- The peer helper at lines 655-665 — `ListAllPanesWithFormat` — does the opposite: it propagates errors. Its docstring explicitly contrasts the two: *"Unlike ListAllPanes, this method propagates the underlying error so callers can distinguish 'no panes' from 'tmux failed'."* The conflation in `ListAllPanes` is a documented, intentional behavioural divergence — the cost of that divergence is exactly this bug.

**Hooks store — `internal/hooks/store.go:130-159`:**

```go
func (s *Store) CleanStale(liveKeys []string) ([]string, error) {
    // ... loads, builds live set, iterates persisted entries:
    for key, events := range h {
        if _, ok := live[key]; ok {
            kept[key] = events
        } else {
            removed = append(removed, key)
        }
    }
    if len(removed) > 0 {
        if err := s.Save(kept); err != nil { ... }
    }
    return removed, nil
}
```

- `Store.CleanStale` is correctly scoped — it does precisely what its name says, "remove entries for keys not present in `liveKeys`."
- It has no business knowing whether `liveKeys` is empty by accident or by ground truth. That responsibility belongs to the caller.
- The destructive end-state is therefore a caller-side defect, not a store-side defect. Any caller that hands in an empty slice when it doesn't actually know the live set will silently wipe.

### The Prior-Art Sibling — Why Step 9 Is Not Vulnerable

Bootstrap step 9 (`CleanStaleMarkers`) implements the **exact same diff-then-delete pattern** against tmux server-option markers and is **immune** to this defect by construction. Both safeguards are in place — see `cmd/bootstrap/stale_marker_cleanup.go`:

1. **Error-propagating helper.** Calls `ListAllPanesWithFormat` (line 119), which propagates the underlying `list-panes -a` error to the caller (line 120-122):
   ```go
   raw, err := c.Panes.ListAllPanesWithFormat(liveFormat)
   if err != nil {
       return err
   }
   ```
   The orchestrator's step-9 invocation handles the non-nil return as a soft warning, exactly the posture the spec for step 11 *intends* but its current wiring cannot produce.

2. **Explicit mass-deletion hazard guard** (lines 126-141):
   ```go
   if len(live) == 0 {
       if len(markers) == 0 {
           return nil
       }
       logger.Warn(state.ComponentBootstrap,
           "stale-marker cleanup: zero live panes parsed with %d marker(s) present; skipping to avoid mass-unset hazard (next bootstrap retries)",
           len(markers))
       return nil
   }
   ```
   The comment block at lines 80-92 names the exact failure mode: *"Treating an empty live set as authoritative would destabilise a still-live tmux server by unsetting every marker — including markers protecting legitimate hydrate-in-progress panes. The deferral is a successful soft outcome ('skip this run; next bootstrap retries'), not a failure."* The guard runs **before** any unset, covering both failure-mode (a) (error → empty via propagation refused) and failure-mode (b) (exit 0 with empty parse → guard fires).

Step 11 (`CleanStale` for hooks) has the same shape of work but neither safeguard. The architectural inconsistency is the bug.

### Blast Radius — Other `ListAllPanes` Callers

Production callers of `(*tmux.Client).ListAllPanes`:

1. **`cmd/bootstrap_production.go:77`** — `cleanStaleAdapter.CleanStale` (bootstrap step 11). Primary site of the reported defect.
2. **`cmd/clean.go:76`** — `portal clean` subcommand. **Identical defect class.** Calls `lister.ListAllPanes()`, treats error case as a safety-net no-op (line 78), then passes the result straight to `hookStore.CleanStale` without any hazard guard. If a user runs `portal clean` while tmux is transient, the same wipe happens — and `portal clean` is invoked far less frequently and almost always when the user *expects* something destructive, so the silent-wipe asymmetry is even sharper there.

`(*tmux.Client).ListAllPanesWithFormat` (the error-propagating variant) has its own production callers, but each handles errors deliberately:

- `cmd/bootstrap/stale_marker_cleanup.go:119` — propagates + hazard guard (correct).
- `internal/state/capture.go:99` — daemon capture loop; treats non-nil as a per-tick skip (not destructive).
- `cmd/bootstrap/orphan_sweep.go` (referenced) — Component B; logs and skips on non-nil (correct).

So the defect class is bounded to the two `ListAllPanes` callers. Both must be fixed.

### Root Cause

**Dual conflation across two layers, neither of which independently makes the bug appear, but jointly produce silent destruction of `hooks.json` whenever `tmux list-panes -a` returns an empty result for any reason during a bootstrap-triggering command.**

- **Layer 1** (`internal/tmux/tmux.go:687-693`): `ListAllPanes` swallows every error class — transient transport failures, exit ≠ 0 from a saver-respawn race, server-gone, *and* legitimate empty — into the same `([]string{}, nil)` signal. The contract is irreversibly ambiguous from this layer up.
- **Layer 2** (`cmd/bootstrap_production.go:76-83`): `cleanStaleAdapter.CleanStale` treats an empty `livePanes` slice as authoritative ground truth and passes it straight to the destructive `hooks.Store.CleanStale`. There is no hazard guard against the empty-live-set + non-empty-store combination, and no adapter-level logging that would surface the destructive call in `portal.log`.

The same dual-conflation exists in `cmd/clean.go:75-80` (the `portal clean` callsite).

**Why this happens:** the helper's docstring describes the swallow as a convenience for the "no tmux server" case — a real, legitimate situation where `portal clean` should not error out. The convenience was retained when the helper was reused inside bootstrap step 11, where the same swallow becomes a vector for silent destruction because the caller's context guarantees a tmux server *is* running (otherwise the orchestrator would not be executing). The error-swallow assumption that was safe outside tmux became unsafe inside tmux without the docstring or implementation being revisited.

### Contributing Factors

- **Inconsistent error-handling siblings.** Two near-identical helpers (`ListAllPanes`, `ListAllPanesWithFormat`) with opposite error semantics — one swallows, one propagates — and no compiler-level signal pushing callers to the safer one.
- **No adapter-level logging at step 11.** The destructive call site emits no `Debug` or `Warn` entry — `portal.log` carries no breadcrumb that the wipe happened or how many entries it removed.
- **No mass-deletion hazard guard at step 11.** Step 9's hazard guard was a deliberate response to the same conceptual hazard for markers; the equivalent guard was never added for hooks.
- **No `_portal-saver` saver-respawn coordination at step 11.** The recent zombie-sessions bugfix (`slow-open-empty-previews-and-zombie-sessions`) and `EnsurePortalSaverVersion` involve kill-and-recreate of `_portal-saver`; the brief transient where the saver is mid-respawn is exactly the window where `list-panes -a` is most likely to return failure or empty. Step 11 runs after these, so it sits inside the tail of the recovery window for every such bootstrap.
- **Conventional ambient assumption that "tmux is reliable."** The implementation expects `list-panes -a` to be a stable read; the field evidence (Component B's WARN at `19:48:39Z`) shows transient failures do occur and are non-rare during saver lifecycle events.

### Why It Wasn't Caught

- **No unit test injects an empty `ListAllPanes` result into `cleanStaleAdapter.CleanStale`.** A trivial test ("seed hooks store with N entries; call adapter with stub returning `([]string{}, nil)`; assert no entries removed") would have failed today.
- **No unit test injects an error from `ListAllPanes` into `cleanStaleAdapter.CleanStale`.** Same observation.
- **No integration test for the saver-respawn window.** The window where transients fire is the same window where the test would need to assert hook entries survive — and that integration test does not exist.
- **The destructive call is silent.** Without logging at the adapter, the only post-hoc evidence is the wiped `hooks.json`. The bug went undetected for an unknown duration before the user noticed at next-reboot resume failure.
- **The prior-art for the fix already exists in this codebase** — bootstrap step 9 — but was not replicated to step 11 at the time step 11 was wired. The architectural-consistency review that should have caught the gap was either skipped or did not consider hook entries equivalent in destructive potential to marker entries.
- **The `slow-open-empty-previews-and-zombie-sessions` and `saver-kill-respawn-loop-leaks-daemons` work units both touched saver lifecycle but did not audit downstream consumers of `list-panes -a` for the new transient window they were introducing.** The 2026-05-19 `saver-kill-respawn-loop-leaks-daemons` investigation explicitly listed CleanStale as a candidate destructive force for disappearing `daemon.version`, but the line of inquiry didn't lead back to this hooks-wipe defect.
- **`cmd/clean_test.go:327-368` actively codifies the destructive behavior as correct.** The subtest `"zero live panes prunes every hook entry"` asserts `hooks.json` is emptied to `{}` when `ListAllPanes` returns an empty slice, with a comment: *"Phase 4: CleanStale runs unconditionally. With no live panes, every hooks.json entry is genuinely orphaned and must be pruned."* That mental model — empty live set ⇒ genuinely orphaned — *is* the bug expressed as a positive test. The fix must **invert** this subtest (preserve the structural "what happens when livePanes is empty" coverage; flip the asserted outcome from "wipes everything" to "refuses to wipe + emits a Warn"). Same inversion shape used by Phase-4 subtests in the `hooks-skip-bootstrap` quickfix earlier today. The original commit's rationale matters for spec scoping: if the destructive interpretation was deliberate (some users may rely on `portal clean` as "kill all hooks when no tmux"), the spec must address migration messaging; if it was accidental, no migration note is needed.
- **No `cmd/bootstrap_production_test.go` file exists.** Zero unit coverage of `cleanStaleAdapter`. The fix must require creation of this file, not merely inversion of the existing `clean_test.go` subtest — otherwise the bootstrap adapter's empty-`livePanes` path remains uncovered post-fix.

### Blast Radius

**Directly affected:**

- `cmd/bootstrap_production.go:76-83` — `cleanStaleAdapter.CleanStale` (step 11 of bootstrap).
- `cmd/clean.go:75-91` — `portal clean` subcommand's hook-cleanup tail.
- `~/.config/portal/hooks.json` — user-persisted per-pane on-resume hook entries, the data being wiped.

**Potentially affected (same pattern, must audit):**

- Any future caller of `(*tmux.Client).ListAllPanes` — the helper's swallow contract is a footgun every new consumer inherits unless they explicitly check the returned slice length against an out-of-band sanity signal.

**Out of scope but worth noting:**

- The `internal/tmux/tmux.go:687-693` swallow contract itself, considered in isolation, is *not* a bug — `portal clean` invoked with no tmux server running should not error. The bug is the conflation *plus* the unguarded destructive consumer pattern. Removing the swallow would force `portal clean` to handle the "no server" case explicitly; that may or may not be desirable on its own merits.

### Wipe Scope (Bounding the User-Visible Impact)

- The wipe affects **user-session hooks only**. Portal-internal sessions (`_portal-bootstrap`, `_portal-saver`) never have `hooks.json` entries — they are filtered out at registration time. So even when `livePanes` is empty (or the destructive call fires), only user-registered hooks are at risk.
- Bounds the user-visible impact precisely: 100% of user hooks affected during a fired event, 0% of portal-internal hooks (because none exist).

---

## Fix Direction

### Chosen Approach — Pending Discussion

Defense-in-depth across both layers, mirroring the prior-art pattern at bootstrap step 9 (`CleanStaleMarkers`). Three coordinated changes:

1. **Replace the swallow at the helper layer; both destructive callsites consume the fixed contract.** Parsing of `session:window.pane` lines is currently centralised in `cmd/bootstrap/stale_marker_cleanup.go`'s `parseLivePaneSet` — promote it to a shared utility (likely `internal/tmux` or a new helper next to it) so all three call sites use one parser.

   **Disposition of `ListAllPanes` — locked to repurpose.** The helper at `internal/tmux/tmux.go:687-693` is repurposed to wrap `ListAllPanesWithFormat` + the shared `parseLivePaneSet`, returning the same `([]string, error)` shape but with errors propagated. Approximately 10 lines replacing the current 7-line swallow body:

   ```go
   func (c *Client) ListAllPanes() ([]string, error) {
       raw, err := c.ListAllPanesWithFormat("#{session_name}:#{window_index}.#{pane_index}")
       if err != nil {
           return nil, err
       }
       set := parseLivePaneSet(raw, /* logger */ nil)
       keys := make([]string, 0, len(set))
       for k := range set {
           keys = append(keys, k)
       }
       return keys, nil
   }
   ```

   Rationale for repurpose vs. the alternatives:
   - **Deletion** forces every call site (production and test) to be touched in this work unit, and any future restoration via git history requires re-creating the symbol. High blast radius for a contract-narrowing change.
   - **Deprecation with `// Deprecated:`** keeps the footgun alive — a future consumer who reaches for `ListAllPanes` for ergonomic reasons can still introduce the same defect class. The compiler does not enforce the deprecation tag.
   - **Repurpose to wrap `ListAllPanesWithFormat` + sanitised parsing** gives one canonical helper, keeps every existing call site compiling unchanged, and structurally eliminates the swallow contract going forward. New consumers inherit the safe behaviour by default.

   Existing callers of `ListAllPanes` (production and test) then receive the propagated error in the `err` return slot they already check for shape — and discover their swallow assumption is wrong at the point where it matters (the destructive consumer paths in `cleanStaleAdapter.CleanStale` and `cmd/clean.go`).

2. **Add a mass-deletion hazard guard at `cleanStaleAdapter.CleanStale` (and the `portal clean` callsite).** Before passing the live-pane slice to `hooks.Store.CleanStale`, check the combination `len(livePanes) == 0 && len(persistedHooks) > 0`. When that combination holds, emit `Logger.Warn(ComponentBootstrap, ...)` with both counts and skip the destructive call — exact prior-art at `cmd/bootstrap/stale_marker_cleanup.go:126-141`. The wiring at the adapter needs a `Logger` field (currently absent — the adapter is bare); plumbing it through `buildProductionOrchestrator` is a small refactor mirroring how `MarkerCleanupCore` already receives one. **Reference site:** `cmd/bootstrap_production.go:147-152` — the inline `MarkerCleanupCore` literal where `Logger: logger` is populated from the orchestrator-scope logger resolved at lines 109-110. Copy the field-population pattern verbatim into the new `cleanStaleAdapter` construction at lines 113-118.

3. **Add adapter-level logging.** `Debug` on entry (live count, persisted count, what would be removed), `Warn` when the hazard guard fires, `Debug` on the normal-path completion (count removed). The absence of these breadcrumbs was a contributing factor; restoring them makes the next analogous defect detectable. **A secondary benefit of the logging contract:** post-fix, failure modes (a) (exit ≠ 0) and (b) (exit 0 with empty stdout) become distinguishable in `portal.log` — mode (a) surfaces as the propagated error from `ListAllPanesWithFormat` (orchestrator-level `Warn` with the wrapped error message), while mode (b) surfaces as the hazard-guard `Warn` with the counts. Currently both modes are silent at the adapter; the new logging lets future occurrences pin exactly which path fired without speculative analysis.

**Deciding factor (tentative):** matching the prior-art exactly is structurally cleaner than any alternative single-layer fix. The two-layer change closes both failure modes — (a) exit ≠ 0 closed by switching to the propagating helper; (b) exit 0 with empty stdout closed by the hazard guard. Either alone leaves one failure mode open.

### Options Explored

- **A — Switch helper only.** Replace `ListAllPanes` → `ListAllPanesWithFormat` in both callers. Closes (a) cleanly. Leaves (b) open — a real exit-0-empty-stdout from tmux during a saver-respawn transient still triggers the wipe. **Rejected as sole fix:** the saver-respawn scenario is exactly the documented high-risk window and ignoring it would ship a bug-still-present fix.

- **B — Hazard guard only.** Add the `len(livePanes)==0 && len(persisted)>0` guard at the adapter, keep `ListAllPanes` as-is. Closes (b) cleanly. Also closes (a) by side-effect (the swallow produces empty slice → guard fires). Simplest single-layer fix. **Considered but not preferred:** the helper's contract remains a footgun for any future consumer; the next person who reaches for `ListAllPanes` inherits the silent-failure mode. Defense-in-depth is cheap here.

- **C — Defense-in-depth (A + B + adapter logging).** Both layers fixed, logging added, parser deduplicated. The chosen approach.

- **D — Cross-check via `ListSessionNames` / `has-session`.** Sanity-gate the wipe by asserting tmux reports at least one live session when the live-pane set is empty. Considered as an additional defensive belt. **Out of scope unless C is judged insufficient:** the hazard guard in C covers the same failure modes more cheaply (no extra tmux RPC, no additional transient surface), and adding D layers a second guard that can itself fail transiently. Worth revisiting only if review surfaces a scenario where the hazard guard's `len(persisted)>0` check is itself ambiguous.

- **E — Adapter-side retry-with-backoff on empty result.** Re-call `list-panes -a` after a short delay; only wipe if the second call also returns empty. **Rejected:** introduces test complexity, conflicts with bootstrap's "best-effort, never block PersistentPreRunE" posture, and the hazard guard already achieves the same end (defer-and-retry-next-bootstrap) without polling.

- **F — Disable step 11 entirely.** Move stale-hook cleanup to an explicit user command. **Rejected:** stale hook entries do accumulate (panes die, sessions get renamed), and a cleanup pass at bootstrap is desirable — just not destructively so under uncertainty. The fix is to make the cleanup safe, not to remove it.

### Discussion

Findings-review surfaced four refinements / adjustments folded into the file above:

1. **Inversion (not deletion) of `cmd/clean_test.go:327-368`.** The existing subtest `"zero live panes prunes every hook entry"` codifies the destructive behaviour as correct with comment-block rationale. Fix must invert (preserve structural coverage of the empty-live-set path; flip asserted outcome from "wipes" to "refuses to wipe + emits Warn"), not delete. Spec-phase open item: examine the commit that added it — deliberate or accidental rationale drives whether migration messaging is required for any user relying on `portal clean` as "kill all hooks when no tmux."
2. **Mode-(b) precautionary framing preserved.** Mode (a) (exit ≠ 0) is well-evidenced by the time-correlated Component B WARN; mode (b) (exit 0 with empty stdout during saver-respawn) is plausible but unconfirmed. The hazard guard remains the right fix because its cost is trivial and it closes both modes — but the spec must not oversell mode (b) as observed evidence.
3. **Symptom-distinguishability nuance.** User-facing symptoms collide with `slow-open-empty-previews-and-zombie-sessions`, but logs distinguish: FIFO race left 53 eager-signal `ENOENT` warnings; CleanStale wipe leaves zero warnings (silent at the adapter). "Silent in logs" is itself a fingerprint for this defect class until the new adapter logging lands.
4. **`ListAllPanes` disposition locked to repurpose.** Three options were live (delete / deprecate / repurpose). Decision: repurpose to wrap `ListAllPanesWithFormat` + shared `parseLivePaneSet`. Deletion has high blast radius; deprecation keeps the footgun alive (compiler doesn't enforce); repurpose structurally eliminates the swallow contract and new consumers inherit the safe behaviour by default. See §Chosen Approach atom 1 for the in-line implementation sketch.

Three context items folded in alongside:

- **Wipe scope.** User-session hooks only — portal-internal sessions (`_portal-bootstrap`, `_portal-saver`) never have `hooks.json` entries (filtered at registration). 100% of user hooks affected during a fired event, 0% of portal-internal hooks.
- **Post-fix log distinguishability.** New adapter logging (Debug entry, Warn guard, Debug success, Warn propagated error) makes modes (a) and (b) distinguishable in `portal.log` for future occurrences without speculative analysis.
- **`cmd/bootstrap_production_test.go` does not exist.** Zero unit coverage of `cleanStaleAdapter`. Fix must create the file with hazard-guard, error-propagation, and normal-path coverage. Inverting the existing `clean_test.go` subtest is necessary but not sufficient — the bootstrap adapter has its own path.

User priorities surfaced:

- Defense-in-depth across both layers (closes mode (a) by helper change, closes mode (b) by hazard guard) preferred over single-layer fix.
- Maintain architectural consistency with the prior-art at step 9 — the fix shape should be lifted verbatim where possible, not re-derived.
- Test deliverables are first-class: existing test must be inverted with new prose, missing test file must be created, integration test for the transient simulation is required.

### Testing Recommendations

- **Create `cmd/bootstrap_production_test.go`.** This file does not exist today; zero unit coverage exists for `cleanStaleAdapter`. The fix must establish this file and populate it with hazard-guard, error-propagation, and normal-path coverage. Inverting the existing `clean_test.go` subtest is necessary but not sufficient — the bootstrap adapter has its own path and must be covered independently.
- **Invert (not delete) `cmd/clean_test.go:327-368` "zero live panes prunes every hook entry".** Preserve the structural coverage that the test provides ("what happens when `ListAllPanes` returns an empty slice") but flip the asserted outcome: from "every hook entry pruned" to "no entry removed, hooks file unchanged, output reports the deferral." Also rewrite the comment block (lines 333-335) so the new mental model — "empty live set is *ambiguous*, not authoritative" — is captured in test prose. The original commit's rationale for the destructive interpretation is a spec-phase input (deliberate vs. accidental drives whether migration messaging is needed).
- **Unit: hazard guard fires on empty live set.** `cleanStaleAdapter.CleanStale` with a stub `LivePaneLister` returning empty slice and a hooks store seeded with N entries → assert no `Save` call on the hooks store and a `Warn` is recorded with both counts. Mirrors `cmd/bootstrap/stale_marker_cleanup_test.go`'s hazard-guard coverage.
- **Unit: hazard guard does not fire when both sides empty.** Empty live set + empty persisted set → no warn, no save, no error. Confirms the guard is not noisy.
- **Unit: error from `ListAllPanesWithFormat` propagates as soft warning.** Stub returning non-nil error → adapter returns the error → orchestrator (or test harness) wraps as a soft warning. Counterpart to the existing swallow path.
- **Unit: legitimate stale removal still works.** Live set `{a,b,c}`, persisted `{a,b,c,d}` → assert `d` removed, `a/b/c` preserved.
- **Unit: shared parser correctness.** If the parser is promoted to a shared utility, the existing `parseLivePaneSet` coverage in `cmd/bootstrap/stale_marker_cleanup_test.go` should be moved or duplicated for the new location.
- **Integration: tmux transient simulation.** Spawn a tmux server, populate `hooks.json`, kill `_portal-saver` mid-bootstrap and arrange for `list-panes -a` to return exit ≠ 0 (e.g., via a `Commander` stub at the integration boundary). Assert `hooks.json` is unchanged at the end of the bootstrap.
- **Integration: `portal clean` analogue.** Same pattern against the `portal clean` callsite — assert it does not wipe entries on transient `ListAllPanes` failure or empty result.
- **Regression: existing `cmd/bootstrap_production_test.go` and `cmd/clean_test.go` coverage.** Confirm no behavioural change for non-empty live sets.

### Risk Assessment

- **Fix complexity:** Low–Medium. Three changes are individually small; the largest line-count contributor is the parser-deduplication refactor. No tmux-protocol changes, no `hooks.json` schema changes, no concurrency changes.
- **Regression risk:** Low. The destructive code path is the failure mode; the fix narrows what triggers it without removing legitimate cleanups. Existing tests should pass unchanged for the non-empty live-set path.
- **Recommended approach:** Regular release. The bug is high-severity (silent data destruction) but the trigger window is intermittent and the recovery path (`portal-resume-backfill.sh --apply`) exists, so a hotfix-cadence release is not required.

---

---

## Notes

- Not a regression from any recent change. The destructive pattern has existed since `CleanStale` was wired to the live-pane enumeration. Recent zombie-sessions and hydrate-command-shell-safety releases increase exposure because they involve more bootstrap activity during which tmux transients become more frequent.
- Component B (orphan-sweep) already implements the "log and skip on transient" posture this bug is asking for elsewhere — Component B's behavior is the prior-art reference.
