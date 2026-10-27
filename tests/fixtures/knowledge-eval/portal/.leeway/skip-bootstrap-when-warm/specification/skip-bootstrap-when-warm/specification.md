# Specification: Skip Bootstrap When Warm

## Overview & Goals

### Problem

Portal's bootstrap orchestrator (`cmd/bootstrap`, run from `cmd/root.go`'s `PersistentPreRunE`) fires on **every** command not in the `skipTmuxCheck` allow-list. Its meaningful work — `EnsureServer`, `RegisterPortalHooks`, `SweepOrphanDaemons`, `EnsureSaver`, `Restore`, and the cleanup sweeps — is logically a **once-per-tmux-server-lifetime** concern, run once-per-command purely defensively: Portal has no "has this server already been bootstrapped this lifetime?" signal, so each command re-ensures the whole world. On a warm server these steps are idempotent no-ops — redundant work plus an avoidable concurrency surface when N commands hit the server near-simultaneously.

### Goal

Set a single **server-scoped latch** at the end of a successful bootstrap. Later commands in that server lifetime see the latch and take a cheap **abridged** path instead of re-running the full orchestrator. First (unlatched) touch runs the full bootstrap and sets the latch; latched commands do a cheap latch-check and skip.

### Motivation (what this is and isn't for)

- **Primary driver — collapse the concurrency surface.** This latch is the pretext for the downstream `restore-host-terminal-windows` feature, whose multi-select reopen spawns N−1 windows each running `portal attach <session>` (and `attach` is *not* in `skipTmuxCheck`). A 20-window post-crash rebuild would otherwise fire ~20 near-simultaneous full bootstraps against one server — a stability hazard. The latch collapses that to ~20 cheap latch-checks.
- **Secondary driver — stop redundant per-command work.** Every warm command stops re-running restore/sweep/clean.
- **Explicit non-goal — single-command safety.** A lone warm bootstrap is *already* safe today: `Restore` skips already-live sessions (`internal/restore/restore.go`), so on a warm server it is a near-no-op. The feature is **not** about correctness of one warm bootstrap; it is about concurrency and redundancy. (One pre-existing latent edge is acknowledged and explicitly out of scope: a ~1s resurrection race if a session is killed *outside* the picker and `x` runs before the daemon's next tick captures the kill — rare, not introduced or changed by this feature.)

### Hard constraint — long-lived servers

The user routinely keeps a tmux server alive for **weeks**; server restarts are rare and must not be relied on for recovery. Anything that self-heals today on the *next command* (because bootstrap re-runs every command) must keep a path to self-heal within a single, possibly weeks-long, server lifetime. Recovery cannot be pushed to "next server restart."

### Scope

- A **version-stamped server-option latch** (`@portal-bootstrapped`) gating a **full** vs a single **abridged** bootstrap path.
- The abridged path runs a **liveness-only EnsureSaver** and nothing else.
- **Hooks stale-cleanup (former step 11) is removed from the orchestrator entirely** and re-homed on the `_portal-saver` daemon (orchestrator drops from 11 → 10 steps).

### Dependency

This feature is built **before** `restore-host-terminal-windows`, which depends on it landing first. It surfaced as review finding **F1** during that feature's discussion. Once landed, reopen can spawn plain `portal attach` with no special bootstrap-exempt command or hidden flag.

---

## The Two Bootstrap Paths

The all-or-nothing "latch set ⇒ skip all steps" framing is rejected — the orchestrator's steps are not the same *kind* of work. Some are genuinely once-per-lifetime and categorically pointless on a latched server; one is an ongoing safety net that must keep running. The design splits into two named paths, selected by the latch.

### Terminology

- **Full bootstrap** vs **abridged bootstrap** — *not* "cold"/"warm". "Cold/warm" collides with "is the tmux server running"; the real trigger is the **latch** ("has Portal bootstrapped *this* server yet"). These usually coincide with server-was-off but are not identical: a hand-started tmux server hit by `x` has no latch → gets the full bootstrap.
- **Same orchestrator, two invocation modes.** Full and abridged are not different programs. The full path is the existing `Orchestrator.Run`; on a cold `portal open` it runs concurrently behind the loading screen, otherwise synchronously. The loading screen is a slow-path wrapper, not a distinct bootstrap.

### Step classification

Three classes:

| Class | Steps | Path behaviour when latched |
|---|---|---|
| **1 — Cold-only** (once-per-lifetime; idempotent no-op when warm) | EnsureServer, RegisterPortalHooks, SetRestoring, SweepOrphanDaemons, Restore, EagerSignalHydrate, ClearRestoring | **Skipped.** Server is up (else the latch would have died with it); hooks converged once and nothing re-adds them mid-lifetime; restore is a cold-boot concern; the orphan-daemon sweep targets *prior-lifetime* leftovers (within a lifetime the daemon flock + self-supervision keep N≤1). |
| **2 — Protective liveness** (safety net against mid-lifetime death) | EnsureSaver | **Kept on every abridged command** as a cheap probe + re-ensure if down. (Reduced to liveness-only — see the EnsureSaver topic.) |
| **3 — Cleanup / hygiene** (accrues over the lifetime) | CleanStaleMarkers, SweepOrphanFIFOs, ~~CleanStale (hooks)~~ | Markers/FIFO sweeps stay in the full bootstrap for cold-boot leftovers (a warm server produces none). Hooks `CleanStale` is **removed from the orchestrator entirely** and re-homed on the daemon — see that topic. |

### The two paths

- **Full bootstrap** (latch not satisfied): the full orchestrator — **10 steps** (the original 11 minus `CleanStale`, which is removed and relocated to the daemon; the marker/FIFO sweeps stay for cold-boot leftovers) — then set the latch as the final action of a successful run.
- **Abridged bootstrap** (latch satisfied): **EnsureSaver liveness probe only** — the single, uniform reduced path. Everything else is skipped.

### Single-abridged constraint (user directive)

There is **exactly one** abridged path, run identically by every command against an already-bootstrapped server. Multiple abridged variants (e.g. an `open`-flavour that cleans + an `attach`-flavour that doesn't) are explicitly rejected. This constraint is load-bearing: it is what forces hooks cleanup out of the orchestrator entirely (a per-command-classified cleanup would be exactly the rejected multi-variant design, and keeping it in the one abridged path would run it under the 20× `attach` burst).

---

## The Version-Stamped Latch

### Storage

`@portal-bootstrapped`, a tmux **server option** whose value is the **binary version** (a *version-stamped* latch, not a bare presence flag):

- Set via `SetServerOption("@portal-bootstrapped", <version>)` (`set-option -s`).
- Read via `TryGetServerOption` → `(value, found, err)`.
- Cleared via `UnsetServerOption` (`set-option -su`, idempotent) — used by the manual escape hatch; production code never needs to unset it.

Same server-option mechanism as `@portal-restoring`: it **dies with the tmux server**, so a server restart auto-clears it and the next command full-bootstraps. It reuses the existing `internal/state/markers.go` seam vocabulary (`RestoringChecker` for the read, `ServerOptionWriter` for set/unset) and the `internal/tmux/tmux.go` server-option API. The difference from `@portal-restoring` is that the **value is load-bearing** (a version), not presence-only. `@portal-restoring` is the direct precedent — an already-existing presence-latch on the same mechanism.

### Semantics — "satisfied"

The latch is **satisfied** only when it is **present *and* its stored version equals the running binary's `cmd.version`**. A single `TryGetServerOption` read drives a three-way outcome:

| Read result | Meaning | Path |
|---|---|---|
| Absent (not found) | Cold / fresh server | Not satisfied → **full bootstrap** |
| Present, version **matches** | Already bootstrapped this binary | Satisfied → **abridged bootstrap** |
| Present, version **mismatches** | Post-upgrade | Not satisfied → **full bootstrap** |
| Read error / down-server | Unreadable | Not satisfied → **full bootstrap** |

Both "value mismatch" and "unreadable/error" fold into *not satisfied → full bootstrap*. A separate `ServerRunning()` probe is not required — the read fails gracefully on a down server. Single read chosen for minimalism.

**Value format (v1):** the stored value is **exactly `cmd.version`** — a bare version string, nothing else. The satisfied test is a plain string equality (`stored == cmd.version`), so the format must stay parse-free. Forensic extras (set-timestamp, pid) are **out of scope for v1**: adding them would require a delimiter/parse-and-compare rule (equality could no longer be naive), so they are deferred rather than left as an ambiguous "implementation detail."

### Why version-stamped, not presence

The user upgrades Portal often (brew) and restarts tmux rarely (weeks). A **presence** latch would keep `RegisterPortalHooks` from ever re-running mid-lifetime, so a new binary's changed global-hook bodies would silently lag the installed version until a tmux restart — potentially weeks. **Version-stamping** makes a release upgrade re-converge hooks and recreate the daemon on the new binary on the **first post-upgrade command**, then re-stamp the latch with the new version. It self-heals with no special-casing. The version is the load-bearing (and, in v1, the only) field of the stored value — forensic extras are deferred (see the value-format note above).

### Dev-build nuance (accepted)

Local/unversioned builds carry a constant version string, so version-stamping only re-bootstraps on real version bumps (releases), not local rebuilds. The user rarely runs local builds (they interfere with the brew-installed version and aren't easily isolated), so this is a non-issue. Testing local hook changes uses the escape hatch: `tmux set-option -u @portal-bootstrapped` forces the next command back to a full bootstrap.

---

## Latch Set-Point & Timing

This is the load-bearing decision: a full bootstrap can take seconds (it restores N sessions), so the window between "full bootstrap starts" and "latch set" is where all concurrency/atomicity risk lives.

### Decision

**Set the latch as the final action of a *successful* `Orchestrator.Run` — after the last step, gated on no fatal error.**

1. **Atomic-with-success, uniform across both invocation modes.** The latch is set *inside* `Run`, not by the two callers, so the synchronous path and the concurrent cold+TUI goroutine both get it identically — no second set-point to keep in sync. "Latch present" ⟺ "a full bootstrap ran to completion."

2. **Set at the *end*, not early.** Early-setting (e.g. right after the server is up) is **unsafe**: a concurrent command would see the latch and take the abridged path *before Restore recreated the sessions*, then attach to a session that doesn't exist yet. End-setting is **sufficient** for the target scenario: the reopen burst can't fire until the user multi-selects in the picker, and the picker only appears *after* bootstrap completes (loading screen on cold, synchronous on warm) — so by the time the ~20 `attach` fire, the latch is already set and they all take the abridged path.
   - **Explicitly accepted non-goal:** a *pure cold-burst* — N commands hitting a genuinely serverless tmux simultaneously, *not* via the picker — is **not** collapsed by end-setting. That isn't the reopen flow, and it is already tolerated today (daemon flock + idempotent hook convergence). We accept it rather than complicate the set-point.

3. **"Successful" = no *fatal* error; soft warnings still latch.** A soft-step warning (`SaverDownWarning`, `CorruptSessionsJSONWarning`, partial restore) **still sets the latch**, because those either self-heal on the abridged path (EnsureSaver re-probes every command) or are non-retryable (a corrupt file won't un-corrupt next command). Requiring a totally-clean run would let one transient `SaverDownWarning` force every command back to full bootstrap for the whole server lifetime — defeating the feature. Only a **fatal** step (EnsureServer / RegisterPortalHooks / SetRestoring / ClearRestoring — the steps that already abort with a non-zero exit / red TUI frame) leaves the latch **unset**, so the next command correctly retries the full bootstrap.

### Write posture

The terminal `SetServerOption("@portal-bootstrapped", version)` is **best-effort**: on failure, log WARN and swallow — never fatal. A failed write simply leaves the latch unset, so the next command reads "not satisfied" and re-runs the (idempotent, near-no-op on warm) full bootstrap, retrying the write. (Full failure/invalidation treatment is in **Edge Cases & Latch Invalidation**.)

### Insertion point in `Run`

`Run` ends with a non-numbered "Return" boundary that has already accumulated the soft `warnings` slice and then emits the `bootstrap: orchestration complete` summary before returning `(serverStarted, warnings, nil)`. The latch write goes **after the last soft step and after the fatal-error gate, but before the orchestration-complete summary + return** — i.e. once no fatal error can occur, stamp the latch, then emit the summary and return. On the concurrent path this also means the latch is written **before** the terminal completion event (`BootstrapCompleteMsg` / the progress pipe's `Done`) is emitted, so "latch present ⟺ a full bootstrap ran to completion" holds by the time the picker transitions and any reopen burst could fire.

A latch-write failure is a **pure log line** (WARN under the bootstrap component) on both paths — it is **not** appended to the returned `warnings` slice and **not** routed through the progress channel / `bootstrapWarnings` sink (unlike `SaverDownWarning`). It self-heals (next command re-runs the near-no-op full bootstrap), so there is nothing actionable to surface to the user; the same treatment applies inside the concurrent goroutine.

### Ordering bonus

Because the latch is set only *after* `EagerSignalHydrate` and `Clear @portal-restoring` have run, "latch present" **guarantees** hydrate signalling finished and `@portal-restoring` was cleared. Two consequences fall out with no extra logic:

- The latch and `@portal-restoring` can never both be set on an abridged command.
- A late-arming skeleton pane can't be stranded unsignalled.

---

## Latch-Check Placement & Abridged-Path Wiring

### Placement — a single latch-read drives a three-way branch

In `PersistentPreRunE`, after the tmux client is built, read the latch (`TryGetServerOption("@portal-bootstrapped")`) and compare its value to the running binary version:

- **Latch satisfied** (present **and** version matches) → **abridged path**.
- **Latch not satisfied** (absent, unreadable/down-server, **or** version-mismatch) → **full bootstrap**: concurrent + loading screen on the TUI path (`open`, no args), synchronous otherwise.

A separate `ServerRunning()` probe is not required — the latch-read fails gracefully on a down server, so "unreadable" folds into "not satisfied → full bootstrap."

### Control-flow sequencing (single read, computed once)

The latch verdict is read **once** and threaded — never read twice. Sequencing in `PersistentPreRunE`, after the tmux client is built:

1. **Compute the verdict once.** Perform the single `TryGetServerOption` read + version compare into a `latchSatisfied bool`.
2. **Abridged gate first.** If `latchSatisfied` → take the **abridged path** (liveness-only EnsureSaver + context injection + warning drain; see below) and return. The orchestrator and the concurrent route are never reached.
3. **Full-bootstrap routing.** If **not** `latchSatisfied` → full bootstrap. The concurrent-vs-synchronous choice is then made by `shouldRunConcurrentBootstrap`, which **drops its `ServerRunning()` probe** and reduces to the TUI-path test only (`isTUIPath && client != nil`) — because "needs a full bootstrap" is already established by the not-satisfied verdict, and a full bootstrap on the TUI path should always show the loading screen. No second latch read, no server-down probe.

So the abridged branch sits **upstream** of `shouldRunConcurrentBootstrap`; the concurrent route is reached only on the not-satisfied path, where the single verdict has already decided full-bootstrap. This is what keeps the design to one read while serving both the abridged-vs-full decision and the concurrent-route decision.

### Loading-screen trigger: latch-absent, not server-down

The concurrent/loading path (`shouldRunConcurrentBootstrap`) currently fires only for `portal open` (no args) **and** server-not-running. It now fires whenever a **full** bootstrap runs on the TUI path — keyed off **latch-not-satisfied**, not server-down. This retires the warm-unlatched edge as an improvement: a hand-started tmux server + `x` now gets the loading screen + progress during its first full bootstrap instead of a synchronous no-progress stall. Conceptually, "loading screen" now means exactly "a full bootstrap is in progress." *What* the full bootstrap does is unchanged (Restore etc. already ran on warm-unlatched today) — only the presentation improves.

**`serverStarted` force-true stays correct on this route.** On the concurrent route `openTUI` forces `serverStarted=true` (currently justified as "cold by construction"). Extending the route to a warm-unlatched server means the server was *not* actually started by this command — but the force-true remains correct, because `serverStarted`'s **sole** effect is to park the model on the loading page (`WithServerStarted(true)` → `activePage = PageLoading`); no other consumer reads it. On the concurrent route the variable's real meaning is "a full bootstrap is in progress → show the loading page," which is exactly what we want whether or not the server pre-existed. So `openTUI`'s force-true does **not** need to become conditional; the "cold by construction" comment should be reworded to "full bootstrap in progress."

### Outcome matrix

| Command | Latch | Outcome |
|---|---|---|
| `open` (no args) TUI | not satisfied (absent / version-mismatch) | full bootstrap, concurrent + loading screen |
| `open` (no args) TUI | satisfied (present + version match) | abridged (sync plumbing, instant picker) |
| `attach` / `open <path>` / CLI | not satisfied | full bootstrap, synchronous |
| `attach` / CLI | satisfied | abridged (sync plumbing) |

### Abridged wiring reuses the sync plumbing

The abridged path runs through the **same entry-path plumbing** (warning sink + context injection) as the synchronous full path, differing only in executing a reduced step set (EnsureSaver only). This is what makes the following inherit existing, tested handling:

- **Context injection.** The abridged path still injects `serverStartedKey` + `tmuxClientKey` into `cmd.Context()` (exactly as the sync path does) — it just doesn't run the orchestrator. `serverStarted` is injected as **`false`** (correct: the command did not start the server). Its sole production consumer is `openTUI`'s loading-page gate → `false` → no loading page → instant picker, which is exactly right for a warm command. There is no hidden "third state" to disambiguate. **Load-bearing precondition:** the abridged path must **not** stash the `deferredBootstrapKey` context value — `openTUI` force-sets `serverStarted=true` whenever a deferred bootstrap is present on the context, which would wrongly show the loading page. Abridged sets no deferred bootstrap, so `deferredBootstrapFromContext` returns nil and `serverStarted=false` survives to the instant-picker gate.
- **Warnings.** EnsureSaver's `SaverDownWarning` funnels into the same package-level `bootstrapWarnings` sink the sync path already uses → the CLI flushes to stderr; the TUI drains to the notice band. Identical to a warm command today; no new emission mechanism.

---

## Abridged EnsureSaver — Liveness-Only

EnsureSaver (Class 2) is the one step that stays on the abridged path. It is the safety net against the `_portal-saver` daemon dying mid-lifetime — the daemon's own self-supervision can `os.Exit(0)`, tearing down its pane and killing the `_portal-saver` session, and a per-command re-ensure brings it back. With weeks-long servers, dropping this net would let a self-ejected daemon stay dead for weeks (silent loss of scrollback capture and resurrection-state), so it must keep running per-command.

### EnsureSaver's two duties, split across the two paths

EnsureSaver does two things:

- **(a) Liveness** — create `_portal-saver` + daemon if absent (`BootstrapPortalSaver`).
- **(b) Version-gate** — if the running daemon's binary is stale, kill + recreate it on the new binary via a guarded kill-barrier (`EnsurePortalSaverVersion`).

The version-stamped latch splits these:

- **Abridged path → liveness only.** A *satisfied* latch (present **and** version-matching) already proves the running daemon is the current binary, so the version-gate is redundant. Abridged EnsureSaver reduces to a pure liveness probe (`SaverPanePIDOrAbsent` + re-ensure if absent).
- **Full bootstrap → keeps the version-gate.** A version bump makes the latch mismatch → full bootstrap → the version-gate kill-barrier recreates the daemon on the new binary → re-stamp.

### Where it lives (build shape)

The abridged path does **not** run through the orchestrator, so its EnsureSaver is a **new liveness-only helper in package `cmd`** — not a "liveness mode" of the orchestrator step. It composes the existing primitives directly: `SaverPanePIDOrAbsent` (presence probe) → `BootstrapPortalSaver` (re-ensure if absent), and on failure constructs a `SaverDownWarning` fed into the same package-level `bootstrapWarnings` sink the sync path uses. It never calls `EnsurePortalSaverVersion` (the version-gate) — that lives solely in the full-bootstrap orchestrator step, which retains both duties.

### Liveness-only is *not* reduced crash recovery

Dropping the version re-check is **not** a reduction in crash/death recovery. On every abridged command the liveness probe asks "is the `_portal-saver` daemon alive?" (`SaverPanePIDOrAbsent`) and recreates it if absent. A random daemon crash → pane process exits → `_portal-saver` session gone → the next warm command's liveness probe revives it. That is exactly the fail-safe from the "keep EnsureSaver on the warm path" decision, preserved unchanged. The **only** thing dropped from the abridged path is the redundant *version* re-check.

### Concurrency benefit (dissolves the kill-barrier race)

Because no abridged command ever runs the version-gate kill-barrier, N concurrent warm commands can never race to kill-barrier a stale daemon — the single post-upgrade full bootstrap does the recreate once. Liveness re-ensure of a genuinely-absent saver stays serialised by the daemon flock as before.

### Two independent daemon safety nets (both preserved)

1. **Self-supervision** — the daemon self-ejects if it detects it is no longer the legitimate `_portal-saver` pane (split-brain guard).
2. **Abridged liveness revival** — on every warm command (plus a full bootstrap on cold boot / upgrade).

This is belt-and-suspenders: keep the fail-safe *and* separately pursue making the daemon as robust as possible (ongoing work, not gated by this feature).

### Restore-window note

On the warm path EnsureSaver runs **outside** the `@portal-restoring` window (no restore in flight), which is correct — a revived daemon should capture normally, not suppress.

---

## Daemon-Owned Hooks Cleanup

The weeks-long-server constraint raised a worry: cleanup steps (marker sweep, FIFO sweep, hooks `CleanStale`) are framed as once-per-lifetime, but if cruft *accrues* during a weeks-long lifetime, skipping them on abridged commands would let it pile up for weeks. This matters because the daemon does **not** clean any of these today — its only GC is `gcOrphanScrollback` (scrollback `.bin` files, inside `Commit`); marker/FIFO/hooks cleanup live only in bootstrap + `portal clean`. So re-homing cleanup on the daemon is a genuinely new responsibility, not something it already did. Tracing each cleanup target to its producer resolves the worry.

### The trace — what a warm server actually produces

- **Skeleton markers (`@portal-skeleton-*`)** — `SetSkeletonMarker` is called from exactly **one** place: `internal/restore/session.go` during bootstrap restore. A warm server creates **zero**. Any stale ones are cold-boot restore leftovers, already cleaned by the marker sweep during that same cold boot. ⇒ **no mid-lifetime workload.**
- **Hydrate FIFOs (`hydrate-*.fifo`)** — `CreateFIFO` is called from exactly **one** place: `internal/restore/session.go` during restore. A warm server creates **zero**. ⇒ **no mid-lifetime workload.**
- **Hook entries (`hooks.json`)** — created by `portal hooks set` (user action, any time) and go stale when the keyed pane/session is killed (normal warm activity). This is the **only** cleanup target a warm server genuinely produces over time.

So the marker/FIFO sweeps have no warm workload and stay in the full bootstrap for cold-boot leftovers. Only hooks cleanup needs a new home.

### A stale hook entry cannot misfire

The user's concern is side-effects, not bloat — can a stale hook fire on the wrong target? No. The hook key is the structural key `#{session_name}:#{window_index}.#{pane_index}` (e.g. `myproj-AbC123:0.0`). Session names are `{project}-{nanoid}` and `GenerateSessionName` **guarantees uniqueness**. A "stale" entry = a key not in the live pane set. For that key to become live again, a session with that exact nanoid-bearing name must exist again — which only happens when Portal **restores that same saved session** (same identity) after a reboot, where firing is the hook's *intended* behaviour. A different, newly-created session gets a new nanoid → new key → never collides. Within-session index reuse keeps the key **live** (never classed as stale). **Conclusion: a genuinely-stale hook entry cannot fire on the wrong session — the only cost of leaving it is inert JSON bloat.** (The one boundary condition, explicitly named and dismissed as unrealistic: a user manually recreating a session under an old nanoid name by hand.)

### Decision — remove hooks cleanup from the orchestrator; home it on the daemon

The single-abridged constraint forces this: a command-classified cleanup ("clean on `open`, not `attach`") is the rejected multi-variant design, and keeping cleanup in the one abridged path would run it under the 20× `attach` burst (the anti-recommended `list-panes -a` + `hooks.json` rewrite concurrency surface). So cleanup can live in **neither** abridged variant.

- **Steps 9 & 10 (marker/FIFO sweeps):** stay in the full bootstrap, skipped on the abridged path (a warm server produces none of their targets).
- **Former step 11 (`CleanStale` hooks):** **removed from the orchestrator entirely** — the step *and* its seam/adapter — taking the orchestrator from 11 → 10 steps. The `_portal-saver` daemon (`portal state daemon`) becomes its **sole automatic home**.

Rationale for full removal (not just skipping on abridged): a bootstrap-time cleanup would only *uniquely* help when a full bootstrap runs **and** EnsureSaver fails to start the daemon — a scenario already catastrophic (no daemon ⇒ no scrollback capture), where an inert stale-hook entry is noise. What it cleans is inert anyway. At cold boot the freshly-started daemon cleans on its first eligible tick (~10s) rather than during bootstrap — fine, since it's inert. **Bonus:** taking hooks cleanup off the per-command bootstrap path also removes exposure to the known `bootstrap-cleanstale-wipes-hooks-on-tmux-transient` bug (which only triggers inside a bootstrap when `list-panes -a` returns transiently-empty) — keeping the step would have re-introduced that hooks-wipe surface on every warm command. (Trade-off acknowledged: slightly more surgery than leaving a harmless idempotent double-clean in place; the clean single-home model won.)

### Operational contract

- **Home:** the existing background process inside the hidden `_portal-saver` tmux session — **not launchd**. `portal clean` remains the manual, daemon-independent backstop.
- **Reuse, don't reinvent:** the daemon calls the existing shared `cmd/run_hook_stale_cleanup.go` `runHookStaleCleanup` helper. That helper already carries the **mass-deletion hazard guard** (`len(livePanes)==0 && hooks present` → skip + WARN, never wipe) and drives `hooks.Store.CleanStale`, which emits the existing `EmitCleanStaleSummary` **audit breadcrumb** — so no new audit event/vocabulary is invented.
- **Dependency wiring (pinned).** `runHookStaleCleanup(lister AllPaneLister, store *hooks.Store, logger *slog.Logger, onRemoved func(string))` takes four arguments; the daemon supplies them as:
  - **`lister`** = the daemon's existing `daemonDeps.Client` (`*tmux.Client` satisfies `AllPaneLister` via `ListAllPanes`). No new client, no new seam.
  - **`store`** = a `*hooks.Store` built **once at daemon startup** via the existing `loadHookStore()` (→ `hooksFilePath()` → `configFilePath("PORTAL_HOOKS_FILE", "hooks.json")`) and carried on `daemonDeps` — not reconstructed per cleanup. **Load-bearing:** it MUST resolve the *same* `hooks.json` the foreground commands mutate. Because the daemon runs as the `_portal-saver` pane process, this holds only if it sees the same `PORTAL_HOOKS_FILE` / `XDG_CONFIG_HOME` env the foreground process used — so it must reuse `loadHookStore()`/`configFilePath` (never a bespoke path), and the `_portal-saver` session must be created with that env (the same daemon-env-inheritance rule the state daemon already depends on). A daemon resolving a *different* `hooks.json` would silently never clean the file the user edits, defeating the feature.
  - **`onRemoved`** = **`nil`** (a background daemon emits no per-removal foreground output; the `EmitCleanStaleSummary` breadcrumb is the audit record). (`ListAllPanes` errors are swallowed unconditionally — WARN + retry next cadence, the `portal clean` posture; the former `swallowListError` axis was dropped when the sole bootstrap caller was removed.)
- **No layering problem:** `runHookStaleCleanup` and the daemon (`cmd/state_daemon.go`) are both in package `cmd` — same package, so no new import and no cycle. Adding the `*hooks.Store` (and reusing `Client` as the lister) to `daemonDeps` stays within `cmd`.
- **Cadence:** **not** every 1s tick. Throttled to ~10s via a cheap `time.Since(lastCleanup) >= interval` check; the cleanup body fires only when the interval has elapsed. The 1s tick must stay light (capture/scrollback save is the priority and can exceed 1s); stale hooks are inert so precise timing is irrelevant. Exact interval is a tuning detail (**10s default**).
- **Placement in the tick (load-bearing).** The daemon's `tick` today has three early returns in order: (1) `@portal-restoring` set → return; (2) `!dirty && !gap` idle fast-path → return; (3) otherwise `captureAndCommit`. Cleanup must be placed on the **idle branch** — evaluated *after* the `@portal-restoring` check but *at* the `!dirty && !gap` point, replacing the bare idle `return` with "check the cleanup throttle → maybe run cleanup → return." This is what makes cleanup actually fire on a mostly-idle warm server (the weeks-long scenario it targets). Placing it *after* the idle return instead would gate cleanup behind capture work, so it would **never** run on an idle server — the opposite of the goal. Net behaviour: `@portal-restoring` set → no cleanup (whole tick skipped); capture pending (`dirty || gap`) → capture runs, cleanup skipped this tick (scrollback always wins); idle (`!dirty && !gap`) + throttle elapsed → cleanup runs. On a continuously-busy server cleanup is deferred until idle ticks resume — acceptable, since stale hooks are inert and a busy server accrues few of them.
- **First-cleanup timing.** Initialise `lastCleanup` to the daemon's **start time** (not the zero `time.Time`), so the first cleanup fires one interval (~10s) after daemon start rather than on the first idle tick (~1s). This matches the "cleans on its first eligible tick (~10s)" cold-boot statement and makes the cadence-gate unit test deterministic.
- **Priority / non-interference:** cleanup never competes with a pending capture — the tick loop is single-threaded, cleanup lives only on the idle branch (capture ticks never reach it), and it is skipped entirely while `@portal-restoring` is set. Scrollback saving always wins.
- **Failure posture:** log WARN and retry next cadence (mirrors the tick loop's existing "tick failed" handling); a cleanup error never escalates or crashes the daemon.

---

## Edge Cases & Latch Invalidation

`@portal-bootstrapped` is a *persistent* lifetime latch (unlike the transient `@portal-restoring`), so its failure/staleness modes need explicit treatment. **Guiding principle:** don't program around anything that self-heals via an idempotent, no-op full bootstrap.

### Invalidation & failure modes

- **Auto-invalidation by design.** The latch is a server option → dies with the server → restart auto-clears it → next command full-bootstraps. No explicit invalidation code.
- **Upgrade invalidation.** Version-mismatch is treated as "not satisfied" → the first post-upgrade command full-bootstraps (re-registers hooks, recreates the daemon on the new binary) and re-stamps. Self-healing; no special-casing.
- **Two markers can't both be set.** The latch is set *last* (after `Clear @portal-restoring`), so "latch satisfied" ⇒ restoring was cleared. A crash mid-bootstrap leaves the latch unset → next command full-bootstraps and re-clears any leaked restoring marker. No inconsistent state reachable on a steady server.
- **Latch-set write failure.** The terminal `SetServerOption("@portal-bootstrapped", version)` is **best-effort**: on failure, log WARN and swallow. The next command reads "not satisfied" → re-runs the (idempotent, near-no-op on warm) full bootstrap → retries the write. Self-heals; **never fatal**.
- **Manual escape hatch.** `tmux set-option -u @portal-bootstrapped` forces the next command back to a full bootstrap — handy for debugging or forcing a re-converge without a tmux restart.
- **Abridged EnsureSaver hard-failure.** With the version-gate moved off the abridged path, abridged EnsureSaver is liveness-only; a failure to re-ensure an absent saver surfaces as a soft `SaverDownWarning` (via the existing sink) and the command **proceeds** — attach/switch still works; capture simply resumes on the next successful revival. No kill-barrier runs on the abridged path, so there is no kill-barrier-failure branch to handle there (it lives in the full bootstrap, already a soft step).

### Accepted residues (harmless bloat — reviewed & tolerated)

- **Cold-boot cleanup leftovers.** If a cold boot's marker/FIFO cleanup soft-fails, that residue isn't retried until the next full bootstrap. Accepted: markers/FIFOs are inert (the daemon-merge live-set filter already prevents dead-session resurrection), and version-stamped upgrades now give *extra* full-bootstrap cleanup passes beyond just restarts.
- **Daemon-death vs cleanup home.** Hooks cleanup was relocated from an always-runs path (per-command bootstrap) to a conditionally-alive one (the daemon) and removed from the orchestrator — a named trade. Homes: the daemon (revived by the abridged liveness EnsureSaver) plus `portal clean` (manual, daemon-independent). Worst case (daemon dead *and* revival failing *and* no `portal clean`) leaves only inert hooks bloat until the daemon next revives. Accepted given the misfire trace (stale hooks can't fire on the wrong session); a bootstrap-time pass was explicitly weighed and rejected — it would only help when the daemon can't start at all, already a catastrophic (capture-down) state.
- **Flapping daemon starves cleanup.** A daemon that repeatedly self-ejects and is re-revived within short windows (< the ~10s cleanup interval) resets its in-process `lastCleanup` each incarnation, so cleanup could be starved indefinitely even while liveness probes report "alive." Accepted for the same reason as the dead-daemon case: the un-cleaned residue is inert hooks bloat (cannot misfire), and a flapping daemon is itself a rare pathological state whose real problem is the flapping, not the deferred cleanup.

### Out of scope (planning must not invent)

- **No `portal`-level unset command.** The manual escape hatch is exactly `tmux set-option -u @portal-bootstrapped` — the entire user-facing contract for forcing a re-bootstrap. `UnsetServerOption` is listed as a reused mechanism only for that raw path; production code never unsets the latch. No `portal clean` flag, subcommand, or help-text surface for unsetting the latch is added in v1.

---

## Test Strategy

The feature's value is *not running* steps, which is harder to assert than running them, and the blast radius is load-bearing core machinery — so the tests target branch selection, set-point gating, and self-heal directly.

- **Branch selection (unit, seam-mocked).** The orchestrator + steps are already `bootstrapDeps`-injected. Set `@portal-bootstrapped` on a fake client to {absent, version-match, version-mismatch} and assert:
  - *Satisfied* → **only EnsureSaver invoked**; the heavy steps (RegisterHooks / Restore / marker+FIFO sweeps) **not** invoked.
  - *Not satisfied* → full `Run` (now **10 steps, no `CleanStale`**) runs **and** the latch ends stamped with the current version.
  - Assert via seam call-recording. Also assert the daemon's throttled cleanup is the **only** hooks-`CleanStale` caller left (bootstrap no longer runs it).
- **Set-point gating.** Inject a soft-warning step → assert the latch **is** set; inject a fatal step → assert the latch **unset**. Directly nails the soft-vs-fatal rule.
- **Abridged self-heal (crash-recovery regression guard).** Latch satisfied + saver dead → assert the abridged liveness EnsureSaver revives it. This is the explicit guard for the "keep the fail-safe" thread.
- **Daemon cleanup.** Unit-test the throttled cadence gate (`time.Since(lastCleanup) >= interval`) with `lastCleanup` initialised to daemon-start (assert no cleanup before one interval elapses, then cleanup on the first eligible idle tick). Assert cleanup runs on an **idle** tick (`!dirty && !gap`) and is **skipped** while `@portal-restoring` is set and on capture-pending ticks. The cleanup body is the existing `runHookStaleCleanup` (already covered, mass-delete guard included).
- **Integration (real tmux).** Extend `cmd/concurrent_*_test.go` + `tmuxtest` socket fixtures, **under `IsolateStateForTest`** (mandatory for daemon-spawning tests): a warm+satisfied command skips restore but revives a killed saver; a version-mismatch latch triggers a full re-bootstrap that re-stamps.
- **Design-for-test.** Make the "current version" **injectable** (it is `cmd.version`) so a version-mismatch branch is unit-testable without rebuilding the binary.

---

## Affected Code Surface

Confirmed anchors (code map, 2026-06-30) for planning. This is a map, not a task list.

### Entry path

- **`cmd/root.go` `PersistentPreRunE`** — where the latch-read + three-way branch is added, after the tmux client is built and before the orchestrator runs. `skipTmuxCheck` = `alias, clean, help, hooks, init, state, version` (`attach` is **not** in it — the F1 dependency).
- **`shouldRunConcurrentBootstrap` (`cmd`)** — currently returns true only for `portal open` (no args) **and** server-not-running (via one `ServerRunning()` `tmux info` probe). Re-key its trigger to **latch-not-satisfied** on the TUI path.
- **`runBootstrap` / `bootstrapOnce` (`sync.Once`, `cmd`)** — existing in-process memoisation; the latch is its cross-*process* equivalent.
- **Context injection** — the sync path injects `serverStartedKey` + `tmuxClientKey` into `cmd.Context()`; the abridged path must inject the same (`serverStarted=false`) without running the orchestrator.
- **`bootstrapWarnings` sink (`cmd`)** — the abridged path's `SaverDownWarning` reuses it (CLI → stderr; TUI → notice band).

### Orchestrator

- **`cmd/bootstrap/bootstrap.go` `Run(ctx) (serverStarted bool, warnings []Warning, err error)`** — set the latch as the final action on no fatal error (see **Insertion point in `Run`**). Remove the `CleanStale` step + its seam/adapter (11 → 10 steps).
  - Fatal steps (return `*FatalError`): EnsureServer, RegisterPortalHooks, SetRestoring, ClearRestoring.
  - Soft steps: SweepOrphanDaemons, EnsureSaver (`SaverDownWarning`), Restore (`CorruptSessionsJSONWarning`), EagerSignalHydrate, CleanStaleMarkers, SweepOrphanFIFOs.
  - The `11 → 10` change also touches the **`totalSteps = 11` constant** (a documented "load-bearing contract" feeding the `orchestration complete` summary's `steps` attr → set to `10`), the package doc comment enumerating the "eleven-step" sequence, and the removed step's `emitStep(11, …)` call.
- **`internal/tui/loading_progress.go`** — two independent constants must move 11 → 10:
  - **`stepLabelTable`** maps the real step indices to the 5 friendly labels; removing `CleanStale` drops its `11:` table entry. Steps 9 and 10 keep their indices (only step 11 is removed), so the surviving keys stay contiguous at 1..10 — a drop-key-11, **not** a renumber; the drift-guard test's `1..N` assertion (e.g. `TestMapping…NoGaps`) retunes to 1..10.
  - **`totalBootstrapSteps = 11`** is the **denominator of the loading-bar fraction** (`BarFraction = len(completedSteps) / totalBootstrapSteps`). It must become `10` or the bar tops out at 10/11 ≈ 91% and never reaches 100% on a successful full bootstrap.
  - Verify the real-step→label mapping and the `N/M` counter (only on `Restoring sessions`) still hold at 10 steps.

### Latch mechanism (reuse existing)

- **`internal/tmux/tmux.go`** — `SetServerOption(name, value)` (`set-option -s`), `TryGetServerOption(name) (val, found, err)`, `UnsetServerOption(name)` (`set-option -su`, idempotent).
- **`internal/state/markers.go`** — seam interfaces `RestoringChecker` (TryGet) and `ServerOptionWriter` (Set/Unset); `@portal-restoring` is the direct precedent (set/cleared/read via `IsRestoringSet`).
- **`cmd.version`** (ldflags-injected) — the value stamped into the latch; must be injectable for tests.

### Daemon (new cleanup home)

- **`cmd/state_daemon.go`** — the 1s `TickerPeriod` tick loop; add the throttled (`time.Since(lastCleanup) >= interval`, ~10s) hooks-cleanup gate on the **idle branch** (at the `!dirty && !gap` point, after the `@portal-restoring` check — replacing the bare idle `return`; see **Daemon-Owned Hooks Cleanup → Placement**). Add a `*hooks.Store` field to `daemonDeps` (built once at startup via `loadHookStore()`); reuse the existing `daemonDeps.Client` as the `AllPaneLister`; init `lastCleanup` to daemon-start time.
- **`cmd/run_hook_stale_cleanup.go` `runHookStaleCleanup`** — the reused cleanup body (mass-delete guard + `EmitCleanStaleSummary` audit breadcrumb); same `cmd` package → no new import, no cycle. Daemon call args pinned in **Daemon-Owned Hooks Cleanup → Dependency wiring** (`lister`=Client, `store`=`loadHookStore()`, `swallowListError`=true, `onRemoved`=nil).
- **`cmd/hooks.go` `loadHookStore` / `configFilePath("PORTAL_HOOKS_FILE", "hooks.json")`** — the path resolver the daemon must reuse so it cleans the *same* `hooks.json` foreground commands mutate.

### Cleanup-target producers (why steps 9/10 have no warm workload)

- **`internal/restore/session.go`** — the sole call sites of `SetSkeletonMarker` and `CreateFIFO` (both restore-only).

---

## Working Notes

_Optional - capture in-progress discussion if needed._
