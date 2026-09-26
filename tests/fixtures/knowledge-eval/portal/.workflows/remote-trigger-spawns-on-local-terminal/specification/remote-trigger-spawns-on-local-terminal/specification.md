# Specification: remote-trigger-spawns-on-local-terminal

## Specification

## Background

Portal's multi-window spawn burst (both the TUI multi-select picker burst and the CLI multi-target `portal open <a> <b> …` N≥2 burst) resolves the host terminal to spawn windows into through a single shared gate: `spawn.Detector.Detect()`. When Portal runs **inside tmux**, `Detect()` cannot walk its own process ancestry (that leads to the tmux server, not the launching terminal), so it enumerates the clients attached to the triggering pane's session and walks each client's process tree to decide whether a host-local terminal is present.

## The Bug

When a spawn burst is triggered from a **remote** tmux client (e.g. Blink on iPhone/iPad over SSH/mosh) while a **host-local** terminal client (e.g. Ghostty on the Mac) is *also* attached to the same session, the N−1 spawned windows open on the host-local terminal — a screen the triggering user is not at. The trigger window self-attaches to the Nth session on the remote side, so it reads as a partial/confusing success while host windows silently accumulate on the machine at home (Portal never tears down host windows, so they linger until closed manually).

The expected behaviour: a remote-triggered burst must resolve **unsupported** and take the same atomic no-op as the pure-remote case — windows must never open on a machine/display the triggering user isn't at.

**Precondition (when it fires):** a remote triggering client **plus** at least one host-local client attached to *the same session* at detection time. If the local client is on a different session it isn't enumerated → clean NULL → correct no-op. The precondition is natural: a `tmux attach` with no `-t` lands on the most-recently-used session, so a remote + local client commonly mirror one session.

## Root Cause

`detectInsideTmux` (`internal/spawn/detect_inside.go`) decides host-terminal locality in the **wrong order**. It treats client *locality* as a pre-filter (drop every remote/mosh client whose walk resolves NULL) and client *activity* (`client_activity`) as a tiebreak applied only **among the surviving local clients**. It therefore answers *"is there any host-local client attached to the triggering session?"* rather than *"is the client that triggered this burst host-local?"*

In the mixed case the remote (triggering) client — which has the highest `client_activity` — is dropped by the NULL walk *before* its activity is ever consulted, so `best` becomes the local client, `Detect()` returns that non-NULL identity, and the burst treats the host terminal as supported.

The correct discriminator — *"which client is the user acting through?"* — is exactly the most-recently-active client on the session (tmux's own `server_client_best` heuristic). The code already has that signal but applies it *after* locality instead of *before*, so the one client whose locality actually matters is discarded first.

**Validated mechanism:** `client_activity` tracks a client's **sent input**, not the **received redraws** it gets from mirroring another client's session. A trigger keystroke on the remote client bumps only the remote's activity; a passively-mirroring local client stays stale. **Detection also runs immediately after the user's trigger action** — picker startup for the TUI (where the identity is cached at that moment), command entry for the CLI — so the just-bumped triggering client is still the freshest at detection time. Together these make "most-active client on the session" reliably finger the remote trigger.

## The Fix: Gate Locality on the Triggering (Most-Active) Client

`detectInsideTmux` (`internal/spawn/detect_inside.go`) must select the **triggering client first, then locality-check that single winner** — inverting the current filter-then-tiebreak order.

1. Enumerate the clients attached to the triggering pane's session (unchanged — `ListClients(session)`).
2. Select the **triggering client** = the client with the highest `client_activity` across **all** enumerated clients (local and remote alike). On an exact activity tie, the **first-listed** client wins (deterministic rule; preserves the existing multi-local tie-break behaviour).
3. Walk **only that winner's** process tree and branch on the result:
   - Winner resolves to a local `.app` bundle → **drive it** (supported host terminal — return its `Identity`).
   - Winner walks to a clean NULL (remote/mosh — ancestry never reaches a local `.app`) → **honest no-op** (NULL identity, nil error — the same atomic no-op as the pure-remote case).
   - Winner's walk fails transiently (`ps`/`defaults` error) → **NULL + transient error** (`ErrDetectTransient`-wrapped), so `Detect()` emits a `spawn` WARN and folds to the unsupported no-op. **Never open windows on uncertainty.**
4. **Empty client list** (no clients on the session) → clean NULL, nil error (no winner to select).

This selects the client the user is acting through and gates the burst on *that* client's locality: a remote trigger → no-op (bug fixed); a local trigger → drives (legitimate local spawn preserved). The change is behaviourally *"sometimes no-op where it used to drive, never drive where it shouldn't"* — no new false-drive is possible.

### Behavioural outcomes by scenario

| Scenario | Selected winner | Result |
|---|---|---|
| Pure remote (no local client on session) | remote | NULL → no-op (unchanged) |
| Single local client (developer at desk) | local | drive (unchanged) |
| **Mixed: remote most-active, local idle** | remote | **NULL → no-op (bug fixed)** |
| **Mixed: local most-active, remote idle** | local | **drive (legitimate local spawn preserved)** |
| 2+ all-local clients | highest-activity local (first-listed on tie) | drive that one (unchanged) |
| `ListClients` enumeration fails | — | NULL + transient error → `spawn` WARN (unchanged) |
| Winner's walk transient-fails | — | NULL + WARN (fail-safe) |
| Empty client list | — | clean NULL (unchanged) |

### Implementation approach

Compute the most-active winner over the **existing `ListClients(session)` enumeration** — it already returns each client's PID and `client_activity` — selecting the max-activity client (first-listed winning an exact tie) in Go, then walking **only that winner**. This reuses the data already fetched (no extra tmux round-trip) and keeps the existing `clientLister` DI seam and the `detectInsideTmux(session, lister, walker, reader)` signature intact, so the unit tests and their deterministic tie-break assertions remain meaningful. Delegating to tmux's own best-client resolution (`display-message -p '#{client_pid}'`) was considered and rejected: it adds a round-trip, cannot expose a controllable tie-break, and would restructure the seam.

## Owned Behaviour Change: Dropped Walk-Resilience Property

The current code walks **all** clients specifically so that *"one flaky `ps` cannot mask a resolvable local client"* (documented in the `detect_inside.go` docstring, lines 56–59, and enforced at the per-client loop). Walking **only the winner** deliberately **drops that property for the winner**: a legitimate local burst with 2+ local clients, where the most-active client's `ps` transiently flakes, now **refuses** (NULL + WARN) instead of falling back to a resolvable lower-activity local.

This is the intended fail-safe (**never spawn on uncertainty**), accepted explicitly as a deliberate trade of resilience for correctness — not a silent side effect. It must be **owned**, not slipped in:

- **The entire `detect_inside.go` docstring contract (roughly the current lines 49–72 — the algorithm description AND the "Outcomes" list) must be rewritten** to describe the new most-active-winner selection and winner-only walk with fail-safe-to-NULL-on-transient-winner. Do not leave the old contract text in place describing behaviour the code no longer has. The sentences the fix directly inverts sit **outside** the "one bad `ps` cannot mask a resolvable local" guarantee (~lines 56–59) and are the most important to change:
  - *"NULL-filtering is the primary signal"* (~line 55) — false after the fix; `client_activity` selection is now the primary cross-client signal.
  - *"client_activity is used ONLY to disambiguate among host-local clients — never as a cross-client primary signal"* (~lines 70–72) — the exact inversion of the new rule (activity now selects the winner across **all** clients, local and remote alike).
- The lost resilience is **locked in on purpose by a new regression test** (see Testing Requirements), rather than being discovered later as a broken assumption.

## Edge Contracts to Pin

These edges are part of the behavioural contract and must be preserved exactly:

- **Empty client list → clean NULL, nil error.** No winner exists to select; this is the honest no-op, not a transient error.
- **Deterministic winner tie-break: first-listed wins on an exact `client_activity` tie.** This keeps the existing multi-local behaviour stable. (The remote/local same-epoch-second tie is explicitly *don't-care* per the scope decision below, but the code must still apply *some* deterministic rule — first-listed.)
- **`client_activity` is epoch-seconds-granular.** This is not a defect and needs no workaround; it is only the source of the acknowledged same-or-later-second residual edge (below).

## Scope: Affected Surfaces (all corrected in lockstep by the single change)

The fix is a single localized change to `detectInsideTmux` in `internal/spawn/detect_inside.go`. `detect.go` and all three `Detect()` consumers are unchanged; they inherit the corrected resolution automatically:

1. **CLI multi-target burst** — `cmd/open_burst_run.go` (`deps.Detector.Detect()`). Mixed case → NULL → atomic no-op, surfacing the shared `spawn.UnsupportedNoopMessage` NULL copy ("can't open new windows over a remote connection — nothing opened"), consistent with the Coherence section below.
2. **TUI multi-select picker burst** — `internal/tui/spawn_detect.go` (`detector.Detect()`, cached once at picker startup). Mixed case → NULL.
3. **`portal doctor` host-terminal line** — `cmd/doctor.go` `checkHostTerminal`. Read-only diagnostic; the mixed case now falls into `checkHostTerminal`'s existing NULL branch and reports its output — "unsupported (remote session)" (verified against current `checkHostTerminal`, which short-circuits on `IsNull()`) — instead of misreporting a driveable host terminal. Corrected in lockstep (informational only — never drives the exit code).

**Automatically re-armed safeguard (no extra code):**
- **The TUI proactive multi-select `m`-entry block** keys on `DetectUnsupported()` (`m.detectResolution == spawn.ResolutionUnsupported`). Today the mixed case resolves a *supported* local terminal, so the block is silently defeated and the user walks the full multi-select flow into a wrong-machine burst. After the fix the mixed case resolves NULL → `ResolutionUnsupported` → `DetectUnsupported()` true → `m` is pre-blocked. Fixing detection re-arms this safeguard with no separate change.

## Coherence with `persistent-no-host-terminal-banner` (confirmed at spec time)

That prior fix split detection outcomes into supported / named-unsupported / NULL-remote, showing the persistent `⚠ unsupported terminal — <name> · <bundleID>` banner only for a *named-undriven* terminal and dropping it for NULL/remote (its gate `unsupportedBannerActive()` carries a `!m.detectIdentity.IsNull()` discriminator). After **this** fix, the mixed case resolves **NULL** (not the local's named/supported identity), so it flows into the NULL/remote branch: **no persistent banner, standard header, and the reactive no-op copy** (`spawn.UnsupportedNoopMessage` → "can't open new windows over a remote connection — nothing opened"). The two fixes compose cleanly — remote users get the honest no-op with no noise banner. **Verified against current code:** `unsupportedBannerActive()` = `DetectUnsupported() && !multiSelectMode && !detectIdentity.IsNull()`, and `checkHostTerminal` short-circuits on `IsNull()` before consulting `Resolve`. No conflict.

## Unaffected Paths (must remain unchanged)

- **Outside-tmux detection** (`internal/spawn/detect_outside.go`) — walks Portal's own process ancestry (env fast-path / self-walk), which reflects the actual launching terminal. No client enumeration, no locality-ordering bug. Untouched.
- **Pure-remote case** (no local client on the session) — already resolves clean NULL → correct honest no-op. Unchanged.
- **Single-local-client case** (developer at the desk) — the trigger *is* the local client → drives. Unchanged.

## Out of Scope

- **A mobile-terminal (Blink) spawn adapter** — judged infeasible (no host→device control channel). This bug is about the detection locality gate only.
- **The same-or-later-second residual edge** — if a person were actively typing on the local terminal in the same `client_activity` second as, or a later second than, the remote trigger, the local could tie or win the selection (and thus drive). Explicitly ruled a non-issue: two people interacting with one mirrored session simultaneously is inherently ambiguous and not Portal's to arbitrate. **No workaround will be built for it.** The deterministic first-listed tie-break is the only rule applied.

## Testing Requirements

Two existing unit tests in `internal/spawn/detect_inside_test.go` currently **codify the buggy behaviour** and will break under the fix — they must be inverted/reframed, not deleted:

- **Invert the codified-bug test** — the subtest *"it drops remote clients but still resolves a mixed local+remote client set"* (currently ~`:133`). It seeds a high-activity remote client + a low-activity local and asserts the **local** wins ("proving the NULL-filter runs first and activity is only a local tiebreak"). Under the fix, with the remote as most-active the expectation becomes **NULL / no-op**. This assertion currently locks in the bug.
- **Reframe the resilience test** — the subtest *"it resolves a local client despite a transient walk on another client"* (currently ~`:196`). It seeds a high-activity client whose walk transiently fails **+** a lower-activity local, and asserts the local resolves with a nil error. Under walk-only-the-winner the flaky high-activity client **is** the winner → **NULL + `ErrDetectTransient`-wrapped error** (which `Detect()` folds to a `spawn` WARN). Reframe it to the new fail-safe expectation.

**New coverage to add** (beyond the two transforms above):

- **Local most-active, remote idle bystander** → the **local drives**. This is the only genuinely net-new scenario (no existing subtest covers it) — it guards against an over-correction that would refuse a legitimate local spawn because a remote client is merely attached.

The other two target scenarios are **the same scenarios** as the transforms above and need no separate near-duplicate test:

- *Remote most-active, local idle* → **NULL** (the reported bug's shape — the primary regression case) is exactly the inverted `:133` test.
- *Transient winner walk + a lower-activity resolvable local present* → **NULL + `ErrDetectTransient`-wrapped error** (the deliberately-dropped resilience property, locked in on purpose) is exactly the reframed `:196` test.

Whether those are done as in-place edits or as renamed replacements is an implementation detail; either way the coverage comes from the transforms, not from additional tests.

**Existing invariants that must stay green** (the max-across-all selection must not regress them — with no remote present, max-across-all == max-among-locals):

- Pure-remote (every client remote/mosh) → NULL (currently ~`:46`).
- Single local client → drives, no tiebreak (currently ~`:65`).
- Empty client list → clean NULL (currently ~`:220`).
- 2+ all-local clients → highest-activity local wins (currently ~`:83` / `:101`).
- Exact activity tie among locals → **first-listed wins** (currently ~`:117`).
- `ListClients` enumeration failure → NULL + `ErrDetectTransient`-wrapped error (currently ~`:151`). Unaffected by the A1 change (the winner is computed after a successful enumeration), but part of the pinned outcome set.
- Single-client walk failure → NULL + `ErrDetectTransient`-wrapped error (currently ~`:171`). Preserved unchanged: with one client it is the winner, so its walk-failure already maps to the winner-walk-transient row. Must **not** be deleted as a supposed duplicate of the reframed `:196` — it is the single-client variant of the transient-winner case and its coverage is distinct.

*(Line numbers are current-location hints as of writing; identify the tests by their subtest description.)*

**Verification scope.** The unit tests above cover the **selection / locality-ordering logic** via the seeded `clientLister` / `walker` / `reader` fakes — they lock in the fix's decision surface. The **real multi-client end-to-end scenario** — an actual remote SSH/mosh client plus a host-local client on the same session, confirming the N−1 windows genuinely do *not* open on the host machine — is **out of unit-test reach** and easy to miss in manual testing. It should be **verified manually** in the reported reproduction setup once the fix lands: trigger a burst (either surface) from a remote client while a host-local terminal is attached to the same session, and confirm the honest no-op (no host windows open).

**Release approach:** regular release — no feature flag, no hotfix urgency. Nothing is destroyed; misplaced windows are recoverable by closing them.

---

## Working Notes

[Optional - capture in-progress discussion if needed]
