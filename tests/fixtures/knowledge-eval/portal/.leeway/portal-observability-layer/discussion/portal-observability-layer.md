# Discussion: Portal Observability Layer

## Context

Portal's logging today is incidental — lines added when someone needed them — not a deliberate observability layer. A real incident on 2026-05-28 (a `hooks.json` wipe at 08:18 BST followed by a saver-disappearance event, with `portal.log` then truncated to 0 bytes at 08:38 BST) destroyed all diagnostic evidence before the symptom could be investigated. The same shape of gap shows up across several unrelated subsystems: silent error paths, missing tick-level summaries, discarded diagnostic context at boundaries, and inconsistent log prefixes that defeat grep-based audit trails.

The seed for this work was a reboot where some Claude `--resume` hooks fired and others didn't, and `portal.log` couldn't tell us which path each helper actually took (`project_reboot_hooks_followup` in MEMORY.md). The investigation surfaced parallel gaps during the cycle-1 review of `slow-open-empty-previews-and-zombie-sessions`. Together these point to a coherent set of patterns to apply consistently across the codebase — not a one-off patch.

The feature also has to cover **log rotation**: the current "rotate to 0 bytes whenever it feels like it" behaviour is the wrong default and was the proximate cause of the 2026-05-28 evidence loss.

### References

- Seed: `.workflows/.inbox/.archived/ideas/2026-05-25--portal-observability-layer.md`
- Memory: `project_reboot_hooks_followup`
- Related: `slow-open-empty-previews-and-zombie-sessions` (cycle-1 review surfaced parallel gaps)

## Discussion Map

### States

- **pending** — identified but not yet explored
- **exploring** — actively being discussed
- **converging** — narrowing toward a decision
- **decided** — decision reached with rationale documented

### Map

  Logger library (slog adoption) [decided]
  Log rotation mechanism [decided]
  Retention policy and audit [decided]
  Log-level discipline (DEBUG/INFO/WARN/ERROR contract) [decided]
  Subsystem prefix taxonomy [decided]
  Call-site logging pattern (DEBUG breadcrumbs + INFO terminal) [decided]
  State-mutation audit trail for user config files [decided]
  Defensive invariants against unknown-cause log destruction [decided]
  Diagnostic context preservation at boundaries [decided]
  Cycle-level summary cadence and shape [decided]
  Log-level propagation verification [decided]
  Saver and daemon lifecycle event taxonomy [decided]
  Hook-firing observability limit (syscall.Exec) [decided]
  Rollout sequencing and scope bundling [decided]

---

*Subtopics are documented below as they reach `decided` or accumulate enough exploration to capture.*

---

## Log rotation mechanism

### Context

Today's logger (`internal/state/logger.go`) rotates `portal.log` to `portal.log.old` when a daemon write would push the file past 1 MiB. Only the daemon rotates (`OpenLogger(path, rotate=true)`); non-daemon writers (bootstrap, hooks CLI, hydrate helpers) call `OpenLogger(path, false)` and append. Only one rotated file is ever kept — `os.Remove(oldPath)` runs before every rename, so back-to-back rotations destroy the previous `.old`.

This is the actual mechanism behind the 2026-05-28 evidence loss. The inbox premise ("rotate to 0 bytes whenever it feels like it") describes the symptom; the mechanism is rotation churn — at 1 MiB threshold under any active load, the file rotates every few hours, and any second rotation within a short window overwrites the previous `.old`. The 08:18 BST hooks.json wipe lived in a `.old` file that was overwritten by a subsequent rotation before the user looked.

There is a separate, currently-unidentified zeroing bug: the user's portal.log is at 0 bytes with no `.old` on disk, which suggests something other than rotation zeroed it (no `O_TRUNC` exists in `logger.go`). Recorded in Open Threads — investigate during implementation; may be resolved as a side effect of replacing the rotation system.

### Options Considered

**A. Calendar-only daily rotation.** Local midnight boundary. Files named `portal.log.YYYY-MM-DD` for completed days; same-day overflow appends `.N`. No size threshold.
- Pros: Mirrors `logrotate daily dateext` / Go `lumberjack` daily mode. Burst of WARNs in one hour can't push out yesterday's history. Simple model: one file per day, period.
- Cons: A pathological runaway emitting 100+ MB/min could fill the disk between midnight ticks before any rotation fires.

**B. Size-only with larger headroom.** Same shape as today but threshold raised to 50–100 MiB, retaining multiple rotated files instead of one.
- Pros: Bounds disk use deterministically. No clock-dependence.
- Cons: A WARN burst can still flush yesterday's history out of the rotation queue. The forensic horizon depends on activity, not on calendar time — opposite of what we want.

**C. Calendar primary + size-cap safety valve.** Daily rotation as in A; if today's file reaches a generous threshold (e.g. 500 MiB or 1 GiB), force a same-day rotation (`.N` overflow file).
- Pros: Normal-day behaviour identical to A. Disk-fill safety net for runaway scenarios.
- Cons: Adds a code path that almost never fires in production. Slightly more complex than A.

### Journey

The inbox proposed calendar-daily as the fix; first instinct was "daily + size-cap safety valve" because that's the logrotate default. Sizing the actual log volumes flipped that:

| Mode | Steady-state | Stressed |
|---|---|---|
| WARN (default) | 50–200 KB/day | 1–10 MB/day during an incident |
| INFO (cycle summaries enabled) | 1–5 MB/day | 10–50 MB/day |
| DEBUG (`PORTAL_LOG_LEVEL=debug`) | 5–20 MB/day | 50–500 MB/day during a stuck loop |

Across realistic modes, the rolling 30-day window peaks at ~600 MB even at DEBUG — trivial disk cost. Size-cap only fires on stuck loops, and in those cases the runaway *is* the evidence: capping it at 100 MB doesn't help debug it, it just splits the same loop across two files. Retention bounds total disk use either way.

That made size-cap defensible only as a disk-fill defence at a very generous threshold (500 MB / 1 GB) where it'd never fire in normal operation. Open question: is the disk-fill defence worth the extra code path?

The current 1 MiB threshold being laughably small also explains why the `.old` keeps getting overwritten before the user can read it — rotation under any active load fires every few hours, not every few days.

### Decision

**Locked: Option C — calendar-daily rotation primary, configurable size-cap safety valve, library-encapsulated ownership.**

**Rotation ownership (library-level, every-writer date-aware):**
- The `slog.Handler` in every portal process is date-aware. On each write, it computes today's filename via `time.Now().Format("2006-01-02")` and ensures the open fd points at today's file.
- First write of the day across all processes opens the new day's file via `O_CREAT|O_EXCL`. First writer wins the create race atomically; losers detect the file exists and open `O_APPEND` — race-safe on Unix for slog-sized line writes (< PIPE_BUF).
- A symlink `portal.log → portal.log.YYYY-MM-DD` is swung atomically (`os.Symlink` + `os.Rename`) at the boundary so `tail -f portal.log` always follows today's file regardless of which process owns the swing.
- Daemon-down across midnight is solved by construction — any waking process's first write opens today's file. No explicit catchup logic needed. (Closes review F1 and F2.)

**Boundary, filenames, size cap, immutability:**
- Calendar boundary: local midnight (timezone/DST handling deferred to spec phase).
- Filenames: `portal.log.YYYY-MM-DD` for completed days; same-day overflow on size-cap appends `.N`. Semantics for N — monotonic via `O_CREAT|O_EXCL` retry against highest existing `.N` — deferred to spec.
- Size-cap safety valve: default **500 MB**. Configurable via `PORTAL_LOG_ROTATE_SIZE` env var accepting K/M/G suffixes (e.g. `500M`, `1G`). When today's file reaches the threshold, library rotates to `portal.log.YYYY-MM-DD.N`.
- Rotated files are immutable (`chmod 0400` once they are no longer today's file).
- Default 500 MB chosen as: never fires in normal use even at DEBUG steady-state (20 MB/day), catches a runaway within ~1 day before disk can fill.

**Operational edges deferred to spec phase**: DST/timezone transitions and the local-midnight definition; behaviour across portal version upgrades mid-day; first-startup migration from any existing `portal.log.old`; disk-full and EACCES failure modes; retention-pass scheduling and missed-day catchup; `.N` ordering details. These are tactical — none invalidates the strategic shape locked above.

**Mechanical rule (spec-phase intake):**

For each `Handle(record)` call into the custom `internal/log` `slog.Handler`:

1. Compute `today := time.Now().Format("2006-01-02")`.
2. **Reuse the currently-open fd only while BOTH hold (resolves review-008 M2): (a) no date change — it is for `portal.log.<today>`; AND (b) its inode still matches the current `portal.log` symlink target** (`fstat` the open fd, `stat` the symlink target, compare `st_dev`+`st_ino`). Otherwise reopen. Two reopen triggers, handled differently:
   - **Date change** (new calendar day) → run the full new-day path (steps a–d below) plus the Retention sweep (separate rule).
   - **Inode mismatch / `ENOENT` on the target, same day** → today's file was unlinked or replaced out from under us mid-day (the unknown-zeroing scenario this subtopic defends against — a long-lived daemon's `O_APPEND` fd would otherwise keep writing to the orphaned inode and lose every byte on close — or a peer's size-cap rotation). Reopen by following the current symlink target if it exists (`O_APPEND|O_WRONLY`), else recreate via step a. Do NOT run the retention/`chmod` sweeps — the date did not change.

   When a reopen is needed (either trigger):
   a. Open `${stateDir}/portal.log.<today>` with `O_CREAT|O_EXCL|O_APPEND|O_WRONLY`, mode `0600`.
   b. On `EEXIST`, retry with `O_APPEND|O_WRONLY` (lost the cross-process create race; another writer beat us).
   c. On either path: swing the symlink `${stateDir}/portal.log → portal.log.<today>` atomically. The temp link is **pid-scoped** — `portal.log.<pid>.symlink.tmp` — so cross-process swings can never collide on the tmp name (a single process performs at most one swing at a time, so no counter is needed); if this pid's own tmp already exists from a prior crash, `os.Remove` it and recreate. Then `os.Symlink(target, pidTmp)` + `os.Rename(pidTmp, link)` — `Rename` is atomic and last-writer-wins, and every racer's target is identical (`portal.log.<today>`), so a concurrent swing is benign. A tmp leaked by a crash between `Symlink` and `Rename` is reclaimed best-effort on the next swing and by `portal clean`. (Resolves review-004 I1.)
   d. `chmod 0400` any other `portal.log.<date>*` files in `${stateDir}` that are not `<today>` and not already mode 0400. **Strict date-parse, skip otherwise (review-009 N2):** only files whose date portion parses as a valid `YYYY-MM-DD` (the `portal.log.<date>` / `portal.log.<date>.<N>` shapes) are candidates; any other `portal.log.*` sibling — the `portal.log.<pid>.symlink.tmp` swing temp, the `portal.log.swept.<date>` sentinel, any future non-log sibling — is **skipped (never `chmod`'d)**. Crucially this keeps a leaked symlink temp writable so its best-effort reclamation isn't bricked by a `0400`.
3. After fd is open, check `current_size + len(serialized) >= PORTAL_LOG_ROTATE_SIZE` (parsed once at handler init from env var, default `500*1024*1024`). If true, rotate to `portal.log.<today>.N`:
   a. Find max existing `N` for today (`portal.log.<today>.*` listing); next N = max + 1, or 1 if none.
   b. Open `portal.log.<today>.<N>` with `O_CREAT|O_EXCL|O_APPEND|O_WRONLY`.
   c. On `EEXIST`, retry with `N+1`.
   d. Swing the symlink to the new file (same pid-scoped-tmp + atomic-rename procedure as step 2c). **Do NOT `chmod 0400` the previous segment** (resolves review-007 L6): it is a *same-day* file, a peer process may still hold an open `O_APPEND` fd on it (`chmod` does not evict an already-open writer on Unix), and it is part of today's active write surface. Same-day segments are sealed only when the day rolls over — the next day's step 2d sweep `chmod 0400`s all of yesterday's segments at once. A peer that didn't observe this size-cap rotation simply keeps appending to the prior same-day segment; that splits today's writes across two readable same-day files (the symlink points at the newest), which is acceptable — the size cap is a disk-fill valve, not a correctness boundary.
4. Write the serialized record to the now-current fd.

The above applies to ONE seam: the `slog.Handler` in `internal/log`. No call site outside that package implements rotation logic.

**Hot-path cost (resolves review-007 L7).** The unbuffered-writer constraint (locked in the Defensive invariants I5/I9 resolution) means every record is its own `write(2)`, and the per-`Handle` rotation logic runs on the daemon's 1 Hz tick goroutine. This is intentionally *not* moved off the hot path — the cost is negligible at portal's scale, for record:

- **Steady state:** at INFO the daemon emits ~1 line per tick (the cycle summary). One unbuffered `write(2)` to an `O_APPEND` fd is microseconds; one syscall/sec is immaterial. (DEBUG emits more but is off in production.)
- **Midnight maintenance:** the first record after local midnight does the symlink swing + `chmod 0400` past-day sweep + retention sweep — a directory listing plus a handful of `chmod`/`unlink` calls, sub-millisecond to low-single-digit-ms, **once per day**.
- **Budget:** tick period is 1 s and self-supervision tolerates 3 consecutive missed ticks (3 s), so a once-a-day few-ms spike is well within budget.
- **Gating:** the I2 single-winner sweep gate means only one process per host runs the midnight sweep — often bootstrap or the TUI, not the daemon — so the daemon frequently pays zero sweep cost.

Moving the maintenance to a background goroutine would add synchronisation complexity for no measurable benefit at this scale; rejected.

---

## Retention policy and audit

### Context

Lost evidence is also lost retention. The new rotation system needs a bounded retention window: keep rotated logs for N days, delete older ones. Deletion must be auditable so an operator can grep the rotation history.

### Options Considered

**Window**: 7 / 14 / 30 / 90 days hardcoded, or env-configurable.
**Audit shape**: Silent deletion / per-deletion INFO line / batched daily summary.
**Configuration locus**: env var (`PORTAL_LOG_RETENTION_DAYS`) / config file entry / both.

### Journey

30 days is the inbox proposal and matches the "this happened last week" forensic horizon — the primary use case is investigating incidents 1–14 days after they occurred. logrotate's defaults sit in the 4–7 week range. Shorter windows risk the same evidence-gone-by-the-time-you-look problem we have today; longer windows give more cushion at trivial disk cost (worst-case ~600 MB at DEBUG over 30 days).

Making the window configurable matters for users with constrained disk budgets or for users who want longer history. Env var is the simplest locus — matches existing portal envs (`PORTAL_LOG_LEVEL`, `PORTAL_PROJECTS_FILE`, etc.). No config-file entry needed.

Per-deletion INFO line is required: the 2026-05-28 incident taught that silent destruction is the actual bug. A single INFO `log-rotate: deleted portal.log.2026-04-29 (retention 30d)` per deleted file means `grep 'log-rotate:' portal.log` reconstructs the rotation history. Batched daily summary is harder to correlate against specific deletions.

`portal clean` should NOT touch rotated logs by default — clean is a hygiene command, not an evidence-destroyer. An explicit `portal clean --logs` opts in to log cleanup; without it, only retention-based deletion (by the daemon's daily rotation pass) removes rotated files.

### Decision

**Locked:**
- Default retention: **30 days** of rotated history kept on disk.
- Configurable via `PORTAL_LOG_RETENTION_DAYS` environment variable. Invalid values fall back to default with a startup WARN.
- Per-deletion INFO breadcrumb with stable prefix `log-rotate: deleted <file> (retention <N>d)`. One INFO line per deleted file.
- `portal clean` preserves rotated logs; `portal clean --logs` opts in to log cleanup.

**Open in spec phase**: where the rotation/retention breadcrumb lands across the midnight boundary (yesterday's file vs today's, or both); whether rotated logs are compressed (would cut 30d worst-case from ~600 MB to under 80 MB); how an open-fd-on-yesterday's-file interacts with retention `unlink` (zombie writers post-deletion). Plus whether to mirror retention breadcrumbs to a separate out-of-band file so the audit trail survives even if rotation itself is the corruptor.

**Mechanical rule (spec-phase intake):**

On the first `Handle(record)` call of each calendar date (detected via the date-change check from the rotation rule above), the handler **attempts to claim the day's sweep, and only the winner runs it** (resolves review-004 I2 + I10):

0. **Single-winner gate.** Attempt to create `${stateDir}/portal.log.swept.<today>` via `O_CREAT|O_EXCL`. On `EEXIST`, another process already owns today's sweep — **return immediately, run nothing, emit nothing.** On success, this process owns the sweep; proceed. (Same single-winner `O_EXCL` primitive the rotation rule uses one section up — the two adjacent rules now share one concurrency stance instead of contradicting.) Only *today's* sentinel is meaningful; prior-day sentinels are pruned in step 3 below (resolves review-007 L5 — they do NOT self-clean via the date-cutoff walk, which deliberately excludes `portal.log.swept.*`).
1. Parse `cutoff := today.AddDate(0, 0, -PORTAL_LOG_RETENTION_DAYS)`. Default `PORTAL_LOG_RETENTION_DAYS = 30`. Invalid env value (non-integer, negative, > 365) → use default and emit one WARN: `log-rotate: invalid PORTAL_LOG_RETENTION_DAYS=<v>, using 30d`.
2. List `${stateDir}/portal.log.*` files. **Strict date-parse, skip otherwise (review-009 N2):** extract the date portion and keep only filenames that parse as a valid `portal.log.<YYYY-MM-DD>[.<N>]` — any sibling whose date portion does not parse (the `portal.log.<pid>.symlink.tmp` swing temp, the `portal.log.swept.<date>` sentinel, any future non-log sibling) is **skipped: never deleted**. This subsumes the old explicit `swept.*` exclusion and is robust by default — a new non-log sibling is safe without being remembered. For each surviving file whose date < `cutoff`:
   a. Emit one INFO line BEFORE deletion: `log-rotate: deleted path=<filename> retention=<N>d`.
   b. `os.Remove(filename)`. On error, emit one WARN with `error` attr and continue (don't abort the sweep).
3. **Prune stale sentinels (resolves review-007 L5).** Unlink any `portal.log.swept.<date>` sentinel whose `<date>` ≠ `today` — prior-day sentinels are dead weight (only today's gates today's sweep). On error, WARN and continue. This is why step 2 excludes `portal.log.swept.*` from the date-cutoff walk: sentinels are pruned here by an exact "not today" rule, not by the retention cutoff.
4. The sweep is best-effort. The single-winner gate (step 0) means it runs at most once per host per day, so the duplicate-INFO / duplicate-WARN floor from N concurrent process startups (the reboot-storm case) cannot occur.

**Why single-winner rather than "re-entrant no-op":** every process's first log call of the day is its `process: start` line (Defensive invariants), so without the gate ALL ~32 reboot-morning processes would each emit the same deletion INFO lines and 31 would then hit `os.Remove` "already gone" WARNs — 32× audit noise on exactly the forensic surface this feature exists to keep clean. The gate makes the deletion breadcrumbs single-sourced.

**Winner-completion semantics (resolves review-008 M4).** The sweep (steps 0–3) runs **synchronously inside the winner's first-of-day `Handle`**, and that first `Handle` is the `process: start` line emitted *during* `log.Init` — before the process does any work or `syscall.Exec`s. So even a short-lived winner (a bootstrap that hands off, a hydrate helper that exec's into the shell) completes the whole sweep before it exits; the exec does not preempt it. The gate guarantees **at-most-once per host per day**; the only failure of **at-least-once-completed** is a winner SIGKILL'd or crashing *mid-deletion-loop* (sentinel created, deletions partial). That is an **accepted risk**: retention is a disk-space bound, not a correctness boundary, so a partial sweep merely leaves a few extra rotated files until the next day's fresh winner sweeps — it self-heals, at ~tens-of-MB cost. A resumable sentinel (`.partial` → rename-to-final, with takeover of a dead winner's `.partial`) was considered and **rejected** as disproportionate complexity for a harmless one-day slip.

`portal clean` does NOT trigger this sweep on its own; it preserves rotated logs by default. `portal clean --logs` triggers the sweep with `cutoff = today` (i.e. delete every rotated file, leaving only the current one). **The `portal clean --logs` path BYPASSES the step-0 single-winner gate** — it is an explicit, deliberate user invocation and must always run regardless of any `portal.log.swept.<today>` sentinel; the gate exists only to dedupe the *automatic* per-process-startup sweep. (It also removes stale `portal.log.swept.*` sentinels as part of the clean.)

The above applies to ONE seam: the `slog.Handler` in `internal/log` (and `portal clean --logs`, which calls into the same sweep function).

---

## Logger library (slog adoption)

### Context

The existing `internal/state/logger.go` is a thin printf-style wrapper around `os.File`: line format `timestamp | level | component | message\n`, levels `LevelDebug/Info/Warn/Error`, component constants (`daemon`, `restore`, `hydrate`, ...), file-mutex serialisation. It works but is bespoke — no structured fields, no handler abstraction, no contextual propagation. Any extension (e.g. structured per-key fields for state-mutation breadcrumbs) means inventing conventions on top of printf.

The broader framing — "use logging anywhere it helps, with disciplined levels, learn from known patterns" — pushes toward a structured leveled logger as the foundation. Go's standard library `log/slog` (stable since Go 1.21) is the canonical choice: handler-based (swap text/JSON without changing call sites), `slog.Attr`-based field passing, level + context propagation via `slog.Logger`.

### Options Considered

- **A. Keep printf + extend.** Add structured field conventions on top of the existing format. Minimal migration. Loses standardisation; future tooling expects slog-shaped logs.
- **B. Adopt `log/slog`.** Migrate call sites, replace `state.Logger` with a thin wrapper around `slog.Logger` (or use slog directly). Standard library, no new dependency, future-proof, structured fields native. Requires a sweep of every existing `logger.Info/Warn/...` call site, then becomes the foundation for the broader instrumentation rollout.

### Decision

**Locked: Option B — adopt `log/slog`.**

Reasoning: standard library, structured by default, handler-based (one set of call sites can emit human-readable text for tail/grep and JSON for tooling/aggregation depending on handler), and future-proof. The broader scope of "instrument everywhere" means call sites multiply, and we want them ergonomic and conventional from day one. Migration cost is manageable today (small N of existing call sites) and savings compound as we add new sites.

**Implementation detail for spec phase**: the existing rotation/multi-writer machinery in `logger.go` needs to be re-expressed as a custom `slog.Handler` (or wrap a `slog.TextHandler` with rotation-aware `io.Writer`) so rotation behaviour is preserved end-to-end. The text handler's line format can be retained for backward compatibility with existing greps, or replaced with an `slog`-canonical key=value layout — TBD during spec.

**Mechanical rule (spec-phase intake):**

A new package `internal/log` exposes exactly two public functions:

```go
package log

// Init configures the process-wide logger: builds the custom rotating handler
// (baseline attrs pid/version/process_role injected per-record) and atomically
// swaps it in behind the stable root logger. Called from main.go before any
// other portal code runs. IDEMPOTENT and re-entrant — a second call re-points
// the handler, it does NOT panic. By convention only main calls Init in prod.
func Init(stateDir string, version string, processRole string) error

// For returns a component-bound child logger (root.With("component", name)).
// Safe to call before Init — always returns a valid, non-nil *slog.Logger
// backed by a safe default handler (discard / stderr-text at INFO) until Init
// swaps in the configured handler. Cheap; callers cache it at package init via
// a package-level var, and that cached logger picks up Init's handler
// automatically because the swap lives inside the shared handler.
func For(component string) *slog.Logger

// SetTestHandler swaps in h for the duration of the test and restores the
// previous handler via t.Cleanup. Test-only seam for capturing or silencing
// log output in-process — no subprocess required.
func SetTestHandler(t *testing.T, h slog.Handler)
```

**Init/For contract — swappable-handler indirection (resolves review-004 I6).** The original "idempotent only via panic-on-second-call" rule was dropped — it fought slog's grain (the stdlib's own `slog.SetDefault` is re-settable, and `slog.LevelVar` mutates level without rebuilding). Replaced with:

- The root `*slog.Logger` is constructed in `internal/log`'s own package init, over a small custom handler whose inner delegate is **replaceable** (mutex- or `atomic.Pointer`-guarded). Because every consumer imports `internal/log`, Go runs its init first, so `root` exists before any `For` call.
- `Init` swaps the configured rotating handler into that indirection. Every `For`-created logger shares the indirection, so loggers cached at package-init (before `Init` ran) route to the configured handler once `Init` lands — no stale-logger footgun, no nil returns.
- The "configured once in prod" invariant is preserved by **convention** (only `main` calls `Init`) plus the separate test-only `SetTestHandler` seam — NOT by panicking. In-process tests swap a capture/`io.Discard` handler; the prior design's "every log-asserting test must be a subprocess" tax is gone.
- Cost: one synchronized read (atomic load / RLock) per `Handle`. Negligible behind slog's level filter, and free-riding on the custom handler we already need for rotation — the swap is one extra field, not a new abstraction.
- **Baseline-attr refinement:** baseline attrs (`pid`, `version`, `process_role`) are injected by the configured handler **per-record**, NOT via `root.With(...)` at construction — otherwise package-init children created before `Init` would miss them. (Refines the Subsystem prefix taxonomy "root-injected once" wording.)

Every other portal package that needs to log:

```go
import "github.com/leeovery/portal/internal/log"

var logger = log.For("<component-name-from-locked-taxonomy>")
```

Then call sites use `logger.{Debug,Info,Warn,Error}` directly with `slog.Attr` args (`"key", value` variadic form).

Migration sweep:
- The `internal/state.Logger` type is deleted.
- The `internal/state.Component*` constants are deleted.
- All call sites of `state.Logger.{Debug,Info,Warn,Error}(component, fmt, args...)` are rewritten to `logger.{Debug,Info,Warn,Error}(msg, attrs...)` with the component bound at package-init via `log.For`.
- `state.NopLogger()` is deleted; tests requiring a silent logger use `slog.New(slog.NewTextHandler(io.Discard, nil))` directly.
- All test mock surfaces in `bootstrapDeps` and friends that previously held `*state.Logger` are updated to hold `*slog.Logger`.

Big-bang in one PR (no adapter shim, no co-existence period).

---

## Log-level discipline (DEBUG/INFO/WARN/ERROR contract)

### Context

The slog adoption pinned four levels (`Debug`, `Info`, `Warn`, `Error`) but didn't specify what events go where. Without a contract, "log everywhere" devolves into noise — DEBUG and INFO blur, WARN gets used for events that should be ERROR or vice versa, and `PORTAL_LOG_LEVEL` loses meaning because changing it doesn't predictably change what you see.

The contract also has to match portal's production posture: the daemon swallows-and-continues on per-pane failures, so genuinely unrecoverable conditions are rare. ERROR sites that existed historically (e.g. the non-contention lock-acquire failure) were downgraded to WARN during the `slow-open-empty-previews-and-zombie-sessions` remediation precisely because the operational reality didn't match "unrecoverable".

### Options Considered

**Default level for production:**
- A. WARN (current). Only anomalies surface. ~50–200 KB/day. Quiet at the cost of forensic baseline.
- B. INFO (new). Steady-state production signal — bootstrap transitions, cycle summaries, lifecycle events. ~1–5 MB/day. Continuous forensic baseline. Trivial within the 30-day window (well under 500 MB cap).

**Level granularity:**
- Stay with slog's four standard levels (Debug/Info/Warn/Error).
- Custom sublevels (e.g. Trace under Debug, Notice between Info and Warn) for more granularity.

### Journey

The seed framing was "DEBUG aggressive dump; INFO steady-state when all good". That collapses to: DEBUG is bounded by code paths reached (not judgement); INFO is bounded by the rate of *meaningful* events. WARN is "every line is signal"; ERROR is "we're about to give up".

Default-level discussion: WARN-only is what we have today, and is exactly the posture that left no evidence on 2026-05-28 — no INFO-level breadcrumbs were emitted around the hooks.json wipe or the saver disappearance. The point of the broader observability initiative is to *have* a steady-state baseline to grep through; defaulting to WARN defeats that. INFO trades trivial disk for a continuous forensic record.

Custom sublevels were considered briefly and rejected — slog's four is the standard; introducing Trace/Notice creates a contract drift the rest of the codebase has to learn. Keep it simple.

ERROR usage: the prior downgrade of non-contention lock-failure from ERROR to WARN reflects portal's reality. ERROR is for "we're exiting because we cannot continue" — the lock-contention case is exactly that (the loser daemon exits because it lost the lock). Most other "errors" in portal are recoverable and warrant WARN.

### Decision

**Locked: slog four-level (Debug/Info/Warn/Error) with the semantic contract below; production default `PORTAL_LOG_LEVEL=info`.**

| Level | Purpose | Volume |
|---|---|---|
| **DEBUG** | Kitchen sink for reconstruction: breadcrumbs on swallowed-error paths, per-event state changes under cycle summaries, observed transient values, decision-point inputs. Off in production. | Bound by code paths reached, not judgement. |
| **INFO** | Decision/terminal-point summaries, cycle summaries, lifecycle events. One line per *meaningful choice*, not per state change. The steady-state production signal. | Bound by rate of meaningful events (~1–5 MB/day). |
| **WARN** | Unexpected-but-recoverable conditions. Per-session capture anomalies, retries triggered, transient probe failures inside hysteresis, invalid config falling back to default. | Every line is a signal worth looking at. |
| **ERROR** | Genuinely unrecoverable — process is about to exit because it cannot continue. Rare in portal due to swallow-and-continue posture. | Few sites total; most candidates warrant WARN instead. |

Two implications carry forward:
1. **Subsystem prefix taxonomy** (next subtopic) must be designed so `grep` on a prefix produces a useful trace at INFO level — INFO is the production baseline that has to be greppable.
2. **State-mutation audit trail** breadcrumbs are INFO (decision points), not DEBUG — they need to survive at production level.

### Placement clarifications (refines contract per review-002 G1)

- **Idempotent no-ops** (e.g. `RegisterPortalHooks` deciding "already current, no action"): DEBUG by default. INFO only when the no-op IS the user-visible decision (e.g. "saver already at version V, skipping respawn" — the operator wants to see we considered upgrading and chose not to act). A purely-internal idempotent skip clutters the INFO baseline.
- **Hysteresis-internal failures** (e.g. saver-membership probe failure inside the 3-tick self-supervision hysteresis): DEBUG per spurious tick. ONE INFO or WARN on the trip (when the threshold is crossed and the eject decision lands). WARN per tick during transient tmux contention would fire continuously and invert the "every WARN is signal" promise.
- **Recoverable-but-rare** (e.g. corrupt `sessions.json` falling back to empty state; pane decode failures dropping one pane and continuing): WARN. These are signal even when recovered. "Rare" doesn't bump them to ERROR — ERROR is strictly "process exiting because it cannot continue".

### Mechanical rule (spec-phase intake)

Level selection per call site is determined mechanically by the code shape. Spec writers and code reviewers apply this table without judgment:

| Code shape at the call site | Level |
|---|---|
| `_ = expectedErr` / `if errors.Is(err, KnownExpected) { return }` swallow path | `Debug` with `error_class="expected"` |
| `log-and-continue` on an unexpected error where swallowing it **drops a unit of work or leaves the function's postcondition unmet** (skipped a session this tick, write not persisted, degraded result returned) | `Warn` with `error_class="unexpected"` |
| `log-and-continue` on an unexpected error where **the postcondition still holds** — the failure is incidental or self-heals next cycle (transient probe, best-effort cleanup safe to skip) | `Debug` with `error_class="unexpected"` |
| Terminal line just before successful return from a function representing a meaningful choice (saver respawn, hook fire, capture-tick complete, lifecycle transition) | `Info` |
| Cycle-end summary at the end of a tick/iteration/batch (`tick complete`, `bootstrap step done`, `clean-stale entries=N`) | `Info` |
| Idempotent no-op decision (key already correct, version already current, hook already registered) | `Debug` UNLESS the no-op is the user-visible decision (e.g. "skipping respawn because version matches"), in which case `Info` |
| Probe failure inside a hysteresis window (`probe failed, retries=N/M`) | `Debug` per failure |
| Hysteresis threshold trip (escalation, eject, give-up) | `Info` (the resolved decision) OR `Warn` if the trip represents an anomaly |
| Unexpected-but-recoverable condition (anomalous capture, fallback to default after invalid config, retry triggered) | `Warn` |
| Line immediately preceding `os.Exit(N)` / `return err` from `main` / panic | `Error` |

**Swallowed-error predicate (resolves review-004 I3).** The previous "DEBUG **or** WARN if production visibility is wanted" row carried the one piece of spec-time judgment the table exists to eliminate. It is replaced by the two structural rows above, selected by a single mechanical question: **did swallowing the error lose something?** If the function dropped a unit of work or failed its postcondition → WARN; if the postcondition still holds → DEBUG. Anchored to the function's contract, not the author's sense of importance. (Matches the codebase: per-session capture skips already log WARN — work dropped that tick — while transient hysteresis probe failures stay DEBUG.)

Default `PORTAL_LOG_LEVEL = info`. Invalid env value (any value that is not exactly `debug` / `info` / `warn` / `error` after lowercase) → fall back to `info` and emit one WARN at process start: `bootstrap: invalid PORTAL_LOG_LEVEL=<v>, using info`.

Spec writers MUST verify each new log call site against this table during spec authoring. Code reviewers verify the same at PR review time.

---

## Subsystem prefix taxonomy

### Context

The grep affordance is what makes the INFO baseline forensically useful. Without a stable, predictable prefix shape, `grep "<subsystem>:" portal.log` doesn't produce a clean per-subsystem audit trail — it produces a mix of subsystem mentions in arbitrary log lines.

The inbox framing was: `grep 'hydrate:' portal.log` should reconstruct exactly which pane took which exit path on every helper invocation. That intuitive idiom — `<component>:` as a literal at the start of the human-readable message — is the design target.

Under slog, the natural model is a structured `component` attr that handlers render however they choose. The mechanism decision below preserves both the literal `component:` grep idiom for tail-and-eyeball use AND the structured attr for programmatic filtering and JSON output.

The subtopic scope (per review-002 G11) absorbs two adjacent concerns: the canonical attr-key vocabulary across call sites (G3), and the mandatory baseline attrs every log line should carry (G4). These are part of the same "what does a portal log line look like" decision and shouldn't be re-litigated when the first call site lands.

### Options Considered (rendering mechanism)

**A. Standard slog `TextHandler`.** `... component=hydrate path=/x/y took=1.2s`. Standard, predictable, JSON-friendly. Grep: `component=hydrate`. Noisier when scanning by eye.

**B. Custom `slog.Handler` rendering `component` as a literal `<component>:` prefix at the start of the message body.** `... INFO hydrate: ok paneKey=foo:0.0 took=1.2s`. Matches the inbox grep idiom; preserves `component` as a structured attr under the hood (JSON output still works). One small custom handler — and we already need a custom handler for the rotation machinery, so the cost is essentially zero.

**C. Manual `<component>:` prefix in the message text only.** Simplest but loses the structured attr — `component` is buried inside `msg` and programmatic filtering / JSON output regress.

### Decision (partial — mechanism locked, taxonomy and attr vocabulary still open)

**Locked: Option B — `component` is a structured slog attr at every call site; the custom `slog.Handler` renders text output with `component:` as a literal prefix at the start of the message body and the timestamp + level preceding it.**

Example text-mode line:
```
2026-05-29T08:38:00Z INFO hydrate: ok pane_key=foo:0.0 took=1.2s
```

Example JSON-mode line (same call site, different handler):
```json
{"time":"2026-05-29T08:38:00Z","level":"INFO","component":"hydrate","msg":"ok","pane_key":"foo:0.0","took":"1.2s"}
```

Grep idiom preserved: `grep "hydrate:" portal.log` produces the per-subsystem audit trail. Programmatic filtering also works: handlers can route by `component` attr, JSON tooling can index it.

**Locked: call-site shape — factory pattern.**

A central `internal/log` package owns the shared `*slog.Logger` (the root, configured at process start with our custom handler for rotation, prefix render, and baseline attrs). It exposes one factory function:

```go
func For(component string) *slog.Logger
```

Each consumer package binds its component name once, at init:

```go
package state // package: internal/state

import "github.com/leeovery/portal/internal/log"

var logger = log.For("daemon")
```

Call sites then use the package-level logger with no component argument repeated:

```go
logger.Info("tick complete", "panes", 12, "took", "18ms")
// renders: 2026-05-29T08:38:00Z INFO daemon: tick complete panes=12 took=18ms
```

The factory returns a thin child wrapper around the root via `root.With("component", component)` — cheap, no shared-state surface. Test code injects a silent logger via existing DI seams (`slog.New(slog.NewTextHandler(io.Discard, nil))`) or constructs its own via `log.For("test")`.

**Existing `Component*` constants (`internal/state/logger.go:30-38`) are deleted as part of the migration sweep.** The factory's string argument is the only place a component name appears in Go code, so the typo surface is the ~12 package-init call sites — easy to review by eye. CLAUDE.md gets updated at lock time to reflect the new shape. (Closes review-002 G6.)

**Locked: component taxonomy — initial set of 12 (kebab-case where multi-word), later extended to the authoritative closed set of 15 (+`aliases`, +`projects` from State-mutation audit trail; +`process` from Defensive invariants). The closed-space list in the Mechanical rule below is the single source of truth for the count (resolves review-004 I7 count drift).**

| Component | Owns |
|---|---|
| `daemon` | `portal state daemon` runtime — tick loop, self-supervision |
| `bootstrap` | The 11-step bootstrap orchestrator |
| `restore` | Two-phase restore engine (skeleton + geometry + scrollback) |
| `hydrate` | Per-pane `portal state hydrate` helper — FIFO open, scrollback replay, exec chain |
| `notify` | Notification helpers |
| `hooks` | `hooks.json` mutations (`portal hooks set/rm`, `hookStore.CleanStale`) |
| `preview` | TUI scrollback preview page |
| `saver` | `_portal-saver` session lifecycle |
| `capture` | The daemon's per-tick capture loop (promoted from inside `daemon`) |
| `signal` | FIFO signaling — `EagerSignalHydrate`, hydrate-helper signal receipt |
| `log-rotate` | Rotation and retention events |
| `clean` | `portal clean` command path |

`tmux` deliberately excluded — `internal/tmux` is a thin wrapper; logging at that layer produces extreme volume per tmux call. Better as DEBUG breadcrumbs under the caller's component (e.g. `daemon` logs "tmux command failed: …").

**Locked: attr-key vocabulary (snake_case, slog/JSON ecosystem convention).**

| Key | What |
|---|---|
| `pane_key` | Structural pane key (canonical, persisted form like `session__window.pane`) |
| `tmux_pane` | `$TMUX_PANE` env var (live tmux pane id like `%42`) |
| `session` | tmux session name |
| `project` | project name from `projects.json` |
| `path` | filesystem path |
| `took` | duration (`time.Duration` rendered) |
| `error` | error message (slog idiom: `slog.Any("error", err)`) |
| `error_class` | for swallowed errors: `expected` / `unexpected` |
| `hook_key` | hooks subsystem — the structural hook key |
| `op` | state-mutation breadcrumbs — `set` / `rm` / `clean-stale` |

Conventions:
- **snake_case** for all attr keys.
- **Message string is a terse phrase**, data lives in attrs: `logger.Info("ok", "pane_key", k, "took", d)` — NOT `logger.Info(fmt.Sprintf(...))`.
- **Sticky context via `.With(...)`** when multiple events share context: `paneLogger := logger.With("pane_key", k); paneLogger.Info("replay finished"); paneLogger.Info("hook fired")`.

The vocabulary is the closed set today; new keys are added by amendment in spec/follow-on PRs when a use case appears. The point is *no ad-hoc invention at call-site time* — every contributor consults the list.

**Locked: mandatory baseline attrs (every line carries these, injected per-record by the configured handler — see Logger library § Init/For contract, resolves I6's package-init ordering).**

| Key | Set where |
|---|---|
| `component` | Per-package via `log.For("...")` |
| `pid` | Root logger construction (`os.Getpid()`) |
| `version` | Root logger construction (build-time `cmd.version`) |
| `process_role` | Root logger construction — one of `daemon` / `bootstrap` / `hydrate` / `hooks_cli` / `tui` / `clean`. Identifies which portal binary invocation emitted the line. Critical for multi-writer disambiguation on reboot-recovery days. |

Example full line (INFO mode, text handler):
```
2026-05-29T08:38:00Z INFO hydrate: ok pane_key=foo:0.0 took=1.2s pid=12345 version=0.5.0 process_role=hydrate
```

Baseline attrs add ~50 bytes per line — negligible at INFO steady-state (~3 MB/day total). They make every line self-describing for forensic use across multi-writer days. (Closes review-002 G3 and G4.)

### Mechanical rule (spec-phase intake)

**Closed component value space** (15 total — 12 original + 2 added by State-mutation audit trail + 1 added by Defensive invariants):

```
bootstrap  daemon  restore  hydrate  notify  hooks  preview
saver  capture  signal  log-rotate  clean  aliases  projects
process
```

`process` is reserved for portal-binary lifecycle markers (start, exit, panic) only; subsystem-level lifecycle events have their own components.

**Closed attr-key value space** (13 contextual + 11 cycle-summary + 7 lifecycle + 3 hydrate + 7 process + 4 baseline). *(review-007 L1–L3: the process-lifecycle, log-level-propagation, and state-mutation attr sets — emitted by decided subtopics but previously missing here — are now enrolled in the Process and Contextual groups below.)*

Contextual (set per call as relevant): `pane_key`, `tmux_pane`, `session`, `project`, `path`, `took`, `error`, `error_class`, `hook_key`, `op`, `alias`, `value`, `via`. (`alias` = aliases-store key; `value`/`via` = state-mutation audit attrs — enrolled per review-007 L3.)

Cycle-summary (set per summary line as relevant; enumerated by the Cycle-level summary subtopic): `sessions`, `panes`, `entries`, `steps`, `warnings`, `natural_churn`, `anomalous`, `reaped`, `killed`, `unset`, `entries_failed`.

Lifecycle (set per saver/daemon lifecycle event; enumerated by the Saver and daemon lifecycle subtopic): `target_pid`, `from_pid`, `to_pid`, `reason`, `ticks`, `threshold`, `flush_completed`.

Hydrate (set per hook-firing exec chain event; enumerated by the Hook-firing observability subtopic): `result`, `hook_present`, `bytes`.

Process (set per `process:` lifecycle/diagnostic line; enumerated by the Defensive invariants + Log-level propagation subtopics): `cmd`, `args`, `target`, `code`, `resolved`, `source`, `raw`. (Enrolled per review-007 L1+L2 — emitted by `process: start`/`exec`/`exit` and `process: log-level resolved`, previously absent from the closed space.) `target` + `args` are the **shared exec-handoff attrs** used by both `process: exec` and `hydrate: exec` (review-008 M3), so the two `syscall.Exec` markers are structurally parallel.

Baseline (auto-injected per-record by the configured handler — see Logger library § Init/For contract): `component` (set per package via `log.For`), `pid`, `version`, `process_role`.

**Custom `slog.Handler` text-mode rendering rule:**

```
<RFC3339Nano timestamp> <LEVEL> <component>: <msg> <attrs as key=value pairs>
```

Where:
- `<component>` is read from the bound `component` attr and emitted as a literal prefix immediately before the colon. The `component` attr is NOT also rendered in the attrs key=value list.
- `<msg>` is the slog record's message field.
- `<attrs>` are emitted as space-separated `key=value` pairs in the order: contextual attrs (in slog.Record order), then the four baselines (`pid`, `version`, `process_role`; `component` was already rendered as the prefix).
- Multi-word string values are quoted with `"`.
- `time.Duration` values render with Go's default `String()` (e.g. `1.234s`).

**Custom `slog.Handler` JSON-mode rendering rule:**

Standard `slog.NewJSONHandler` output, no special handling — `component` becomes a normal `"component":"<name>"` JSON field.

**Extension policy:**

- New components require explicit amendment of THIS discussion file's closed component list (or a successor specification amendment).
- New attr keys require the same amendment process.
- Spec writers and code reviewers MAY NOT introduce new component or attr names ad hoc.
- **The space is now genuinely closed, not soft (resolves review-004 I11; completed by review-007 L1–L3).** I11 worried that decided subtopics would need to add components/attrs, making "closed" aspirational. Its first pass folded in only the lifecycle (`target_pid`/`from_pid`/`to_pid`/`reason`/`ticks`/`threshold`/`flush_completed`) and hydrate (`result`/`hook_present`/`bytes`) sets and prematurely declared "no pending vocabulary need." review-007 L1–L3 caught that the **process-lifecycle** (`cmd`/`args`/`target`/`code`), **log-level-propagation** (`resolved`/`source`/`raw`), and **state-mutation** (`alias`/`value`/`via`) attr sets — all from decided subtopics — were still unenrolled. They are now in the Process and Contextual groups above. With that enrollment complete, no subtopic carries a pending vocabulary need; any future addition goes through this amendment policy.

---

## Call-site logging pattern (DEBUG breadcrumbs + INFO terminal)

This subtopic absorbs what was originally split between "Decision-point INFO line shape" and "DEBUG breadcrumb pattern on swallowed errors" — both are facets of the same call-site discipline.

### Context

The level discipline contract names DEBUG breadcrumbs and INFO terminal-point summaries but doesn't specify the call-site mechanics. Two questions follow: (1) does a function emit one log call that renders differently per level (some kind of "trace" abstraction), or multiple independent calls each at its chosen level? (2) what does the resulting log shape look like for a typical multi-step operation?

### Options Considered

**A. Multiple independent calls.** Each `logger.Debug(...)` and `logger.Info(...)` is a standalone call. Slog handles level filtering — drops calls below threshold cheaply. The function author explicitly chooses level per call.

**B. Wrapper that bundles levels.** A custom helper like `logger.Trace(msg, debugAttrs, infoAttrs)` that emits at one or both levels based on enabled state.

**C. OpenTelemetry-style span wrapper.** A `trace := logger.Span("hydrate.process"); defer trace.End()` pattern that records breadcrumbs as DEBUG events and emits the span-end as INFO.

### Journey

Option B couples two distinct concerns (the per-step breadcrumb and the terminal-point summary) into one API call, and hides level discipline from code review — a reviewer can't point at a line and say "this should be DEBUG, not INFO" because the level choice is buried in the wrapper logic. Rejected.

Option C is designed for distributed tracing systems where span hierarchies and correlation IDs matter across hosts. Portal is single-host, file-logged. The wrapper adds API surface and conceptual load for benefits we don't need. Rejected.

Option A is Go's `log/slog` idiom — independent calls, lazy formatting, near-zero cost for filtered-out calls. Working with the grain of the standard library means future contributors don't have to learn anything portal-specific.

### Decision

**Locked: Option A — multiple independent log calls per function, slog handles level filtering.**

Canonical call-site pattern for a multi-step operation:

```go
package hydrate

import "github.com/leeovery/portal/internal/log"

var logger = log.For("hydrate")

func Process(paneKey, fifoPath string) error {
    log := logger.With("pane_key", paneKey)  // sticky context bound once
    start := time.Now()

    log.Debug("opening fifo", "path", fifoPath)
    fd, err := openFifo(fifoPath)
    if err != nil {
        return err
    }
    log.Debug("fifo opened", "fd", fd, "took", time.Since(start))

    if err := awaitSignal(fd); err != nil {
        return err
    }
    log.Debug("signal received", "took", time.Since(start))

    n, err := replayScrollback(...)
    if err != nil {
        return err
    }
    log.Debug("replay finished", "bytes", n)  // illustrative breadcrumb — see note below

    log.Info("ok", "took", time.Since(start))  // terminal-point summary
    return nil
}
```

At INFO (production): one INFO line per invocation lands in portal.log.
At DEBUG (investigating): all four DEBUG lines + the INFO summary.

**This `Process` listing illustrates the breadcrumb→terminal *pattern* only — it is not a literal transcription of the hydrate helper's log lines (resolves review-008 M1).** Where the pattern overlaps a real cataloged site, the subtopic catalog governs. In particular, the hydrate helper's actual `scrollback replayed` line is the **INFO exit-path terminal** carrying `bytes`+`took` (Hook-firing observability rule), NOT a DEBUG breadcrumb — the breadcrumb above is deliberately renamed (`replay finished`) so it no longer collides with that cataloged INFO line. The subtopic catalogs (Hook-firing, Cycle-summary, Lifecycle) are authoritative for their real call sites; this example only shows the shape.

**Allowed ergonomic helpers:**

1. **`.With(...)` for sticky context** — bind shared attrs once when a function/scope has many log calls sharing context (e.g. `pane_key`, `session`). Stops attr-key repetition.
2. **`logger.Enabled(ctx, slog.LevelDebug)` guard** — only for the rare case where computing the attrs is itself expensive (e.g. JSON-marshalling something just to attach as a debug attr). Slog's lazy formatting makes this irrelevant 99% of the time.
3. **Shared helpers in `internal/log`** — only after the same idiom appears 5+ times in production code and earns its weight. Don't pre-build helpers for theoretical cases.

**Anti-pattern (explicitly rejected):** custom wrappers like `logger.Trace(LEVEL_BREADCRUMB, LEVEL_TERMINAL, msg, debugAttrs, infoAttrs)` that bundle levels into one call. Couples concerns, obscures level discipline at the call site, makes review harder. Each log call has ONE level chosen explicitly.

### Mechanical rule (spec-phase intake)

Per function authored or amended, spec writers and code reviewers apply this discipline mechanically:

1. **DEBUG breadcrumbs** at each meaningful state transition inside the function (resource acquired, event received, sub-operation completed, branch chosen). One `logger.Debug(<terse-msg>, <attrs>...)` per transition.
2. **INFO at terminal decision points** — one `logger.Info(<terse-msg>, <attrs>...)` immediately before each successful return path. The line MUST capture the chosen outcome and the resolved decision attrs.
3. **WARN per recoverable error path** — one `logger.Warn(<terse-msg>, "error", err, <attrs>...)` before swallowing/returning. WARN exists at any code path that classifies as "unexpected-but-recoverable" per the level discipline table.
4. **ERROR only at lines immediately preceding** `os.Exit(N)` / `panic(...)` / `return err` from a main entry point.

**Sticky-context rule:** when ≥ 3 subsequent log calls in the same lexical scope share an attr, bind it once via `local := logger.With(<attrs>...)` and use `local.<Level>(...)` thereafter. Below the 3-call threshold, repeat attrs at each call.

**Expensive-attr guard:** wrap with `if logger.Enabled(ctx, slog.LevelDebug) { ... }` ONLY when computing an attr value involves measurable cost (JSON marshalling, slice formatting > 100 elements, syscall to read state). For ordinary attrs (strings, ints, durations, pre-computed values), use slog's lazy formatting directly.

**Allowed slog idioms (resolves review-004 I12).**
- `logger.LogAttrs(ctx, level, msg, slog.String(...), …)` — explicitly PERMITTED and preferred on hot paths: it is the lower-allocation, type-safe equivalent of the variadic `"key", value` form, with identical semantics and level discipline. Attr keys still come from the closed vocabulary.
- `slog.Group(name, …)` — PERMITTED. Text-mode rendering flattens grouped attrs to **dotted keys** in the `key=value` stream (`group.key=value`), mirroring how the JSON handler nests them. A group name is part of the closed attr vocabulary — adding one needs the same discussion-file amendment as a new attr key.

**Prohibited (PR review must reject):**
- Custom helpers that bundle multiple levels into one call (e.g. `Trace(msg, debugAttrs, infoAttrs)`).
- `fmt.Sprintf` inside log message strings to embed values that should be attrs (`logger.Info(fmt.Sprintf("ok %s", k))` — wrong; use `logger.Info("ok", "key", k)`).
- Direct construction of `*slog.Logger` outside `internal/log` package.
- Pre-formatting attrs into the message string (use slog attrs instead).
- Using attr keys not in the closed value space (extend the vocabulary first via discussion-file amendment).

---

## State-mutation audit trail for user config files

### Context

Direct answer to the 2026-05-28 incident's "I have no record of who wiped `hooks.json`" gap. Every mutation of a portal-owned user-config file must leave a breadcrumb in `portal.log` so the next time a file changes unexpectedly, `grep "<file>:" portal.log` reconstructs the change history.

The subtopic's *design intent* is straightforward — log mutations. The *mechanical rule* below is what spec phase ingests to produce the per-call-site enumeration with zero implementation-time judgment. This is the first locked subtopic written with that explicitness target; the existing five will be retro-sharpened in the same shape.

### Decision

**Locked.**

**Files in scope (closed set):**
- `hooks.json`
- `aliases`
- `projects.json`

`sessions.json` is **out of scope** for this subtopic — it's daemon-managed high-frequency state (mutated every tick), covered by the pending cycle-summary subtopic (one INFO per tick under `daemon` / `capture` components, not per-write).

**Taxonomy addition:** `aliases` and `projects` are added as components (12 → 14; `process` is added later by Defensive invariants for **15 total** — the authoritative closed-space list in the Subsystem prefix taxonomy Mechanical rule is the single source of truth).

**Mechanical rule (the seam spec phase enumerates against):**

**Seam = the per-file store's mutation methods, NOT `AtomicWrite` and NOT the callers (resolves review-004 I8).** Each portal-owned config file is fronted by exactly one store — `hooks.Store`, the alias store, the project store — and every mutation flows through that store's `Set` / `Rm` / `CleanStale` methods. The store is the chokepoint that (a) knows the `op` and the affected key and (b) is the single place per file where the breadcrumb can't be forgotten. The generic `internal/fileutil.AtomicWrite` primitive stays audit-unaware — it is shared with out-of-scope `sessions.json` and has no `op`/key semantics, so logging does NOT live inside it, and it does NOT live scattered at each caller (the forgettable "log in every controller" anti-pattern). This is the model-observer layer, not the controllers.

**One sanctioned exception to the store-method seam: `migrateConfigFile` (resolves review-009 N1).** The one-shot migration in `cmd/config.go` is a directory-to-directory file *move*, not a store mutation — it never flows through `hooks.Store`/alias/project `Set`/`Rm`, so under the store-method seam the `migrate` op / `via=migrate` values would have no emitter at all. But a config directory relocating out from under the user is exactly the "a file changed and I don't know why" event this audit trail exists to explain, so the values are kept and `migrateConfigFile` is named as an **explicit, enumerated emission site**: it emits one INFO per migrated file under that file's owning component (`hooks` / `aliases` / `projects`) with `op=migrate via=migrate`. This is the *only* sanctioned non-store emitter; no other caller-level emission is permitted. **PR timing:** it lands in PR 2 with the rest of the state-mutation work, so a migration that fires during the PR-1-only window goes unlogged — an accepted caveat, since the migration is a rare idempotent one-shot most existing users already ran and the move is otherwise observable (file mtimes, `process:` markers).

> *Every mutating method of an in-scope config store (`hooks.Store`, alias store, project store) emits, immediately after the underlying `AtomicWrite` returns to it:*
>
> - *On `error == nil`: ONE INFO log line.*
> - *On `error != nil`: ONE WARN log line.*
>
> *The log line's component (prefix) is the store's owning component: `hooks` for `hooks.json`, `aliases` for `aliases`, `projects` for `projects.json`.*
>
> *Required attrs:*
> - `op` — drawn from the closed value space below.
> - Key identifying the affected entry: `hook_key` (hooks), `alias` (aliases), `project` (projects).
> - On failure (WARN path): `error_class` from the closed AtomicWrite failure space below.
>
> *Optional attrs:*
> - `value` — verbatim new value for `set` / `modify`; absent for `rm` / `clean-stale`.
> - `via` — `cli` for user-facing commands, `internal` for code-driven mutations (e.g. `CleanStale`), `migrate` for the one-shot `migrateConfigFile` path.

**Closed `op` value space:**

| `op` value | Meaning |
|---|---|
| `set` | Create new entry (key did not exist before this write) |
| `modify` | Update existing entry (key existed; value differs) |
| `rm` | Remove existing entry |
| `clean-stale` | Internal cleanup of an entry (always batched) |
| `migrate` | One-shot migration from old config path (e.g. `~/Library/Application Support/portal/`) |

**Closed `error_class` value space for AtomicWrite failures (per phase):**

`write-failed-temp-create` / `write-failed-write` / `write-failed-fsync` / `write-failed-rename`

**No-op handling:** A `set` call where the entry already exists and the value matches → DEBUG with `op=set-noop`. NOT INFO. Matches the level-discipline placement clarification for idempotent no-ops.

**Batch operations (e.g. `CleanStale` iterating entries):**

> *Every batch loop that mutates multiple entries emits:*
> - *Per-entry DEBUG inside the loop.*
> - *ONE INFO summary at the end of the batch with attrs `op=<batch-op>`, `entries=N`, and `entries_failed=M` if any per-entry failures occurred.*
> - *Per-entry WARN with `error_class=unexpected` on per-entry failure mid-loop (regardless of whether the batch continues).*

This applies the hysteresis-trip pattern (from level discipline) to mutation batches: detail at DEBUG, summary at INFO, exceptions at WARN. Replaces the per-entry-INFO proposal that contradicted that pattern.

**Privacy posture: verbatim.** Hook commands, alias values, project paths logged as-is. Threat model accepted: portal is a single-user dev tool; `portal.log` lives on the same disk as the config files which already store these values plaintext. Users sharing logs in bug reports redact manually (same posture as `hooks.json` itself).

**Closes review-003 H1, H2, H3, H4, H5, H7.** Defers H6, H9, H10 to spec phase (boundary-rule formalization, aliases read-side scope, source-distinguishability per call site).

---

## Defensive invariants against unknown-cause log destruction

### Context

The locked rotation/retention machinery is robust against the known destruction mechanism (rotation churn at the old 1 MiB threshold). The 2026-05-28 incident also suggested an unidentified zeroing path exists somewhere — currently deferred as Open Thread for investigation during implementation.

Even with the new design, an unknown bug could destroy today's `portal.log`. The defense-in-depth invariants here make destruction **detectable post-hoc** so an operator who later looks at the log can tell that destruction happened and roughly when, even if the cause remains unknown.

### Decision

**Locked.** Three invariants. Two are already enforced inside the rotation subtopic — re-stated here for completeness; their authoritative rule lives in the rotation mechanical rule above. The third is new to this subtopic.

**Invariant 1: Rotated-file immutability.** (Already locked in Log rotation mechanism.) Files older than today are `chmod 0400` so even a buggy library can't overwrite past evidence. The destruction surface narrows to today's file only.

**Invariant 2: `O_CREAT|O_EXCL` on first-of-day open.** (Already locked in Log rotation mechanism.) Every process's first write of a day creates `portal.log.<today>` via `O_CREAT|O_EXCL` (with append-fallback on `EEXIST`). If something deletes today's file mid-day, the next writer's create-or-append races safely and observably. **An *already-open* writer (notably the long-lived daemon) recovers too:** its per-`Handle` inode-identity check (Log rotation rule step 2, resolves review-008 M2) detects that its fd's inode no longer matches the `portal.log` symlink target and reopens onto the live file — so a mid-day deletion is both detectable (start-marker tripwire) AND non-lossy going forward, rather than the daemon silently writing into an orphaned inode.

**Invariant 3 (new this subtopic): Per-process lifecycle markers.** Every portal process emits ONE INFO line at the very start of its execution and ONE INFO line on clean exit. These are the tripwires that make destruction visible: if today's `portal.log` contains only lines from 09:15 forward but you know portal was running before, the first line of today's file is a "process: start" marker that timestamps when destruction had to have happened.

**Taxonomy addition:** add `process` as a 15th component. Used exclusively for lifecycle markers (start, exit, exec, panic) for the portal binary itself, regardless of which subcommand is running. (Subsystem-level lifecycle events — saver respawn, daemon `lock acquired`/`self-eject`/`shutdown` — go under the Saver/daemon lifecycle subtopic, not under `process`. The daemon's *process startup* is NOT a separate subsystem event: `process: start process_role=daemon` covers it — see the I4 resolution there.)

### Mechanical rule (spec-phase intake)

The `internal/log.Init(stateDir, version, processRole)` function, after constructing the root logger and wiring the rotating handler, MUST emit exactly one INFO line as its final action before returning:

```go
log.For("process").Info("start",
    "cmd", filepath.Base(os.Args[0]),
    "args", strings.Join(os.Args[1:], " "),
)
```

Renders (text mode):
```
2026-05-30T14:00:00Z INFO process: start cmd=portal args="open ." pid=12345 version=0.5.0 process_role=tui
```

(Note: `pid`, `version`, `process_role` are baseline attrs auto-injected; the call site does not pass them.)

The `internal/log` package additionally exposes `func Close(exitCode int)` — a marker-emitter that computes `took` from the package-private `startTime` (captured at `Init`) and emits one INFO line. **`Close` does NOT call `os.Exit`; the logger owns no control flow** (resolves review-004 I5 — mirrors slog's deliberate omission of `Fatal`). It emits:

```go
log.For("process").Info("exit",
    "code", exitCode,
    "took", time.Since(startTime),
)
```

Renders:
```
2026-05-30T14:00:02Z INFO process: exit code=0 took=2.1s pid=12345 version=0.5.0 process_role=tui
```

`startTime` is captured at `Init` time and stored package-private.

**`main` owns the single `os.Exit` (resolves I5).** The prior "defer `Close` OR call it before `os.Exit`" rule was unsound: `os.Exit` skips deferred functions, so Cobra's `Execute()`-error path (`os.Exit(1)`) emitted no `process: exit` — the most operationally-interesting termination class went unmarked, and the Close-defer vs recover-defer ordering was ambiguous. Replaced with the idiomatic "exit only in `main`, everything else returns a code/error" shape (an explicit rule in the Uber and Google Go style guides):

```go
func main() {
    log.Init(...)
    code := 0
    func() {
        defer func() {
            if r := recover(); r != nil { log.For("process").Error("panic", "reason", r); code = 2 }
        }()
        if err := rootCmd.Execute(); err != nil { code = 1 }
    }()
    log.Close(code)   // emits process: exit code=N — does NOT exit
    os.Exit(code)
}
```

- Exactly one terminal marker fires per run: `exit` on clean/error return, `panic` on a recovered panic. No double-emit, no defer-ordering ambiguity, no "if practical" judgment language.
- **Bare `os.Exit` is prohibited outside `main`** (PR-review reject) — every other function returns an error/code. That prohibition is the enforcement mechanism for "every termination is marked."
- `Execute()` maps to a return code rather than calling `os.Exit` inside.

**Coverage requirement:** every binary entry point (currently only `main.go`, extending in principle to any future entry binary) calls `log.Init` before any other portal code that might log, and routes all termination through the `main` shape above.

**Flush reduces to "do not buffer the log writer" (resolves the I5/I9 flush concern).** The rotation handler writes directly to the `*os.File` (`O_APPEND`) with no `bufio` wrapper, so a marker is already in the kernel by the time `Info(...)` returns. `os.Exit` and `syscall.Exec` do not discard kernel buffers, so the bytes survive for a later reader — no `Sync()`/flush API and no logger-owned atomic exit/exec helper are needed. **Unbuffered writer is a locked constraint on the rotation handler** (Logger library subtopic).

**Exec-handoff markers (resolves review-004 I9).** `os.Exit` and normal-return paths are covered above, but `syscall.Exec` is neither: it overwrites the process image, runs no deferred functions, and never returns — so `Close` never fires and no `process: exit` line is written. The bare-shell `portal open` happy path (`AttachConnector` → `tmux attach-session`) is exactly this, and it is portal's *most common* termination. Without a marker, a benign tmux handoff leaves an unpaired `process: start` that is indistinguishable from a destructive mid-flight kill — defeating the whole invariant.

Rule: **every `syscall.Exec` call site MUST emit a plain `exec`-terminal INFO line immediately before the exec, under its owning component.** No logger-owned helper — the call site uses the ordinary logger and then performs its own `syscall.Exec`. The logger never execs (same principle as I5: the logger owns no control flow). Because the writer is unbuffered (see the I5 flush resolution above), the marker is already in the kernel before `syscall.Exec` replaces the image.

```go
// At the AttachConnector call site, immediately before syscall.Exec:
log.For("process").Info("exec", "target", "tmux", "args", strings.Join(argv, " "))
syscall.Exec(tmuxPath, argv, env)
```

- `AttachConnector` (bare-shell `portal open` → tmux) emits `process: exec target=tmux args="attach-session -A …"`. This is binary-level lifecycle, so `exec` joins `start` / `exit` / `panic` in the **`process` component's event space**.
- The hydrate helper's pre-`syscall.Exec` marker is already locked as `hydrate: exec` (Hook-firing observability subtopic) — same pattern, component-owned. This rule generalises it to the remaining exec site.

This yields a clean four-way terminal classification of any `process: start`:

| Followed by | Meaning |
|---|---|
| `process: exit` | Normal return (via `Close`) |
| `process: exec` | Clean handoff to another image — no exit line expected (benign) |
| `process: panic` | Crash, but recorded |
| *nothing* | Genuinely alarming — process vanished without a terminal marker; investigate |

**Externally-killed-process footnote (from review-004 I4).** A process killed by an uncatchable signal (the kill-barrier's escalation to SIGKILL) cannot run code, so it emits no terminal marker — its `process: start` looks "unpaired." That is *not* the alarming case when the kill was deliberate: the **killer records it**. Bootstrap already emits `saver: kill-barrier started/escalated target_pid=X` and `saver: placeholder died` (Saver/daemon lifecycle catalog). So the rule is: **an unpaired `process: start` is alarming only if no `saver:`/`daemon:` line names that pid as an external kill.** (The daemon's clean self-eject path uses `os.Exit(0)` and still emits its own `process: exit`.)

**Lifecycle markers bypass the level filter (resolves review-008 M5).** The `process`-component lifecycle set — `start`, `exit`, `exec`, `panic`, and `log-level resolved` — is emitted **unconditionally by the custom handler, regardless of `PORTAL_LOG_LEVEL`.** These are forensic tripwires (and, for `log-level resolved`, a test anchor), not ordinary application logging. At `PORTAL_LOG_LEVEL=warn`/`error` a normal INFO line would be filtered — which would make the "always-present tripwire" guarantee false and would hide the very line that proves the resolved level took effect (`resolved=warn source=env`) exactly when a test or operator needs it. The handler therefore special-cases this `process` lifecycle set to write through the level gate. They remain semantically INFO for every other purpose (no ERROR pollution). This reconciles the "always-present" framing here with the level filter and with the Log-level-propagation test contract.

**Flush** is handled by the unbuffered-writer constraint locked in the I5 resolution above — no exec-path-specific flush logic is needed.

**`SwitchConnector` (in-tmux path) is unaffected** — it runs `tmux switch-client` as a subprocess and returns normally, so it gets a proper `process: exit` via `Close`. Only true `syscall.Exec` replace-process sites need the exec marker.

**Privacy on `args` attr:** verbatim. Same posture as state-mutation audit trail. CLI commands like `portal hooks set --on-resume "claude --resume X"` will have the full args string in `portal.log`. Acceptable for portal's single-user threat model.

---

## Diagnostic context preservation at boundaries

### Context

Pattern (4) from the inbox: when a subprocess fails or an external command returns unexpected output, capture stderr alongside stdout and propagate both into the wrapped error. Discarding stderr is the most common form of "we lost the debug context exactly where we needed it most." Same principle applies to syscalls (errno text) and tmux command failures.

The cycle-1 review of `slow-open-empty-previews-and-zombie-sessions` surfaced `defaultIdentifyPS` (`internal/state/daemon_identity.go`) as a concrete example: stderr was discarded on failure, leaving the wrapped error context-free.

This subtopic governs **error wrapping at external boundaries**. It is orthogonal to the level discipline (which governs how the resulting wrapped error is logged). Together they guarantee: when an external call fails, the failure context survives all the way to the log line.

### Decision

**Locked.** Every external-boundary call site MUST preserve stderr / errno / phase-of-failure context in the wrapped error returned to callers. The locked level discipline + call-site pattern then determines how that error reaches `portal.log`.

### Mechanical rule (spec-phase intake)

Four boundary classes; each has a concrete wrapping pattern.

**Boundary class 1: `exec.Cmd`** (currently used in `internal/state/daemon_identity.go`, `internal/tmux/commander.go`, etc.).

Every call site MUST either use `cmd.CombinedOutput()` OR capture `cmd.Stderr` into a `bytes.Buffer` before `cmd.Run/Output`. On error, the wrapped error MUST embed both:
- The exit status (or signal) if the process exited.
- The stderr text (trimmed).

Canonical wrapping pattern:

```go
var stderr bytes.Buffer
cmd.Stderr = &stderr
out, err := cmd.Output()
if err != nil {
    return nil, fmt.Errorf("%s %v: %w (stderr: %s)",
        cmd.Path,
        cmd.Args[1:],
        err,
        strings.TrimSpace(stderr.String()),
    )
}
```

PROHIBITED: `_, _ = cmd.Run()`, `cmd.Output()` without `cmd.Stderr` assignment, or any error path that returns a wrapped error WITHOUT stderr text included.

**Boundary class 2: `internal/tmux.RealCommander.Run` / `RunRaw`** (the wrapper layer for all tmux command execution).

The commander interface MUST capture both stdout and stderr on every invocation. On non-zero exit:
- The error returned MUST embed the exit code, the tmux argv, and the trimmed stderr text.
- Tmux-specific sentinel errors (`ErrNoSuchSession`, `ErrEmptyPaneList` per `internal/tmuxerr`) MUST be detected via the stderr text and wrapped with the sentinel using `fmt.Errorf("%w: %s", sentinel, stderr)`.

PROHIBITED: returning a generic error from a tmux invocation without the stderr context.

**Boundary class 3: `os` package syscalls** (`os.Stat`, `os.OpenFile`, `os.Rename`, `os.Remove`, etc.).

Go's standard `os` package wraps syscall errors with path + errno text by default (e.g. `open /tmp/x: permission denied`). The rule: do NOT replace these errors with a wrapper that loses the path/errno context. When additional context is wrapped on top, use `fmt.Errorf("...: %w", ..., err)` so the underlying error is preserved verbatim and accessible via `errors.Unwrap`.

PROHIBITED: `return errors.New("file operation failed")` style wrapping that discards the original `*os.PathError`.

**Boundary class 4: stdlib `io` / `bufio` / scrollback FIFO reads** (`internal/state/scrollback.go`, hydrate helper FIFO reads).

EOF and timeout conditions are valid expected outcomes, not boundary failures — they take the "expected" classification in the level discipline contract. Other I/O errors (read error mid-stream, write error mid-write) wrap with `fmt.Errorf("read %s: %w", path, err)` to preserve path context.

**Across all four classes — `slog` attr usage at the eventual log site:**

```go
logger.Warn("tmux command failed", "error", err, "session", sessionName)
```

The `"error"` attr value MUST be the wrapped error directly (`err`, not `err.Error()`); slog handles serialization. Custom handler renders the full chain of wrapped messages including the stderr text.

**Boundary helper (allowed shared idiom, internal/log):**

After 3+ identical boundary-wrapping patterns appear in production code, a shared helper in `internal/log` MAY be added. Examples of allowed helpers:

```go
// CombinedOutputWithContext runs cmd and returns its stdout. On error,
// returns a wrapped error embedding exit status, argv, and trimmed stderr.
func CombinedOutputWithContext(cmd *exec.Cmd) ([]byte, error)
```

Until 3+ sites need it, write the wrapping at each call site directly.

---

## Cycle-level summary cadence and shape

### Context

Pattern (5) from the inbox: daemon ticks, capture loops, bootstrap sequences, orphan sweeps — every cycle emits a single INFO summary at completion so an operator can reconstruct what happened over a window without needing per-event lines. Per-event WARNs still fire on anomalies; the summary is the steady-state grep target.

The 2026-05-28 incident's reconstruction would have benefited from cycle summaries: a daemon tick that emitted `capture: tick complete sessions=3 panes=12 natural_churn=0 anomalous=0 took=18ms` once per second across the morning would have given a forensic timeline of when the saver disappeared, without scrolling through per-pane DEBUG breadcrumbs.

This subtopic governs **when a cycle emits a summary, what attrs it carries, and what falls below it (DEBUG breadcrumbs) vs alongside it (per-event WARNs)**.

### Decision

**Locked.** Every cycle in portal emits ONE INFO summary at completion, with per-item events emitted at DEBUG (steady state) or WARN (anomaly).

### Mechanical rule (spec-phase intake)

A "cycle" is a function or method whose body matches one of these shapes:

1. **Loop cycle** — a `for` loop iterating distinct items (sessions, panes, files, entries, orphans).
2. **Sequence cycle** — an orchestrator running discrete named steps (e.g. the 11-step bootstrap orchestrator, the two-phase restore engine).
3. **Tick cycle** — a periodic loop driven by a ticker (the daemon's 1Hz capture loop).

For every cycle in portal, the function/method MUST:

1. Capture `start := time.Now()` before the loop / sequence / tick body.
2. Track counts of items processed and per-item anomalies (failures that did not terminate the loop).
3. At the end of the cycle body (just before the function returns / the tick completes), emit exactly ONE INFO log line:

```go
logger.Info("<verb> complete",
    "<unit>", count,
    // additional counts for sub-categories if relevant, e.g.:
    "natural_churn", churnCount,
    "anomalous", anomCount,
    "took", time.Since(start),
)
```

Where:
- `<verb>` is the cycle's purpose phrase: `tick`, `sweep`, `step`, `phase`, `orchestration`, `replay`, etc.
- `<unit>` is the item being iterated: `sessions`, `panes`, `entries`, `orphans`, `steps`, `files`, etc.
- Additional counts (sub-categorisations) ride as attrs on the same summary line. Examples: `natural_churn` (sessions that ended cleanly mid-capture), `entries_failed` (per-item failures), `warnings`.
- `took` is always present.

**Per-item event level inside a cycle:**

- Per-item DEBUG breadcrumb ALWAYS for items where the per-item path is interesting (the capture loop's per-pane state, the bootstrap step's invocation, etc.). These flood at DEBUG and are silent at INFO — the summary is the INFO truth.
- Per-item WARN ONLY for items that fail anomalously (count goes into the summary's anomalous attr).

**Concrete cycle catalog (sites that this rule mandates a summary at):**

| Cycle | Owning component | Summary line shape |
|---|---|---|
| Daemon tick (1Hz capture + commit) | `capture` | `capture: tick complete sessions=N panes=N natural_churn=N anomalous=N took=T` |
| Bootstrap orchestration | `bootstrap` | `bootstrap: orchestration complete steps=11 warnings=N took=T` |
| Each bootstrap step | `bootstrap` | `bootstrap: step complete step=<StepName> took=T` |
| Restore phase A (skeleton) | `restore` | `restore: skeleton complete sessions=N windows=N panes=N took=T` |
| Restore phase B (geometry + replay) | `restore` | `restore: geometry complete panes=N took=T` |
| Orphan FIFO sweep | `clean` | `clean: orphan-fifo sweep complete reaped=N skipped=N took=T` |
| Orphan daemon sweep | `clean` | `clean: orphan-daemon sweep complete killed=N took=T` |
| Marker cleanup | `clean` | `clean: marker sweep complete unset=N took=T` |
| Hooks CleanStale | `hooks` | (already locked in State-mutation audit trail — same summary shape) |
| Retention sweep (rotated logs) | `log-rotate` | (already locked in Retention policy — same summary shape) |

**Closed attr extension (added to the prefix taxonomy attr vocabulary):** `sessions`, `panes`, `entries`, `steps`, `warnings`, `natural_churn`, `anomalous`, `reaped`, `killed`, `unset`, `entries_failed`. These were implicit in the locked attr vocab's "counts" but are explicitly enumerated here so spec writers don't invent names.

Spec writers consulting this rule will produce one INFO call site per cycle in the codebase, with the verb-phrase + counts + `took` triplet, matching the catalog shape.

---

## Log-level propagation verification

### Context

Pattern (7) from the inbox: `PORTAL_LOG_LEVEL` must actually take effect through the test → tmux server → respawn-pane'd daemon chain. Today this is implicit and fragile; integration tests can set `PORTAL_LOG_LEVEL=debug` and assume the spawned daemon process receives it, but no positive verification exists. If the env var fails to propagate (because tmux clears it on `respawn-pane`, or because a test harness forgets to pass it), DEBUG coverage silently degrades and the test still passes (just with less log output than expected).

The fix is a positive log-marker: every process emits one INFO line at start declaring the resolved level and its source (env / default / fallback). Tests assert on that line.

### Decision

**Locked.** Every portal process emits exactly one additional INFO line as part of its lifecycle init sequence, declaring the resolved log level and how it was resolved. Tests that depend on a specific log level for coverage assert on this line.

### Mechanical rule (spec-phase intake)

`internal/log.Init(stateDir, version, processRole)` MUST emit one INFO line immediately AFTER the `process: start` line (defined in Defensive invariants subtopic) and BEFORE returning:

```go
log.For("process").Info("log-level resolved",
    "resolved", resolvedLevelStr,
    "source", levelSource,
    "raw", rawEnvValue,
)
```

Where:
- `resolved` is one of `debug` / `info` / `warn` / `error` — the level slog will actually filter at.
- `source` is one of:
  - `env` — `PORTAL_LOG_LEVEL` was set to a valid value.
  - `default` — `PORTAL_LOG_LEVEL` was unset → `info`.
  - `fallback` — `PORTAL_LOG_LEVEL` was set to an invalid value → fell back to `info` (also emits the WARN defined in the Log-level discipline mechanical rule).
- `raw` is the raw env var value as observed (empty string if unset, the verbatim string if set — including invalid values).

Renders (text mode):
```
2026-05-30T14:00:00Z INFO process: log-level resolved resolved=debug source=env raw="DEBUG" pid=12345 version=0.5.0 process_role=daemon
2026-05-30T14:00:00Z INFO process: log-level resolved resolved=info source=default raw="" pid=12345 version=0.5.0 process_role=tui
2026-05-30T14:00:00Z INFO process: log-level resolved resolved=info source=fallback raw="trace" pid=12345 version=0.5.0 process_role=daemon
```

**Test assertion contract:** any integration test that sets `PORTAL_LOG_LEVEL` MUST scan `portal.log` for the `process: log-level resolved resolved=<expected> source=env` line for the spawned process (matched by `pid` attr if multiple processes were involved). If the line is absent or `source` is not `env`, the test fails — the env var did not propagate. This line is emitted **unconditionally** — it bypasses the level filter (see Defensive invariants § "Lifecycle markers bypass the level filter", resolves review-008 M5) — so the assertion holds even when the test deliberately sets a non-INFO level like `warn` or `error`.

A canonical assertion helper SHOULD live in `internal/portaltest`:

```go
// AssertLogLevelResolved scans portal.log for the process: log-level resolved
// line matching the given pid and asserts the resolved level matches expected
// with source="env". Used by integration tests that set PORTAL_LOG_LEVEL.
func AssertLogLevelResolved(t *testing.T, logPath string, pid int, expected string)
```

This helper closes the env-propagation gap for ALL daemon-spawning integration tests, not just the test that motivated the assertion.

**Coverage requirement:** every binary entry point that calls `log.Init` automatically emits this line; no separate per-entry-point work needed. The propagation assertion is the test-side coverage requirement.

---

## Saver and daemon lifecycle event taxonomy

### Context

Implicitly covered by patterns (5) cycle summaries and (6) lifecycle events, but worth surfacing as its own category because portal's reconstruction needs precisely these events and historically didn't have them. The 2026-05-28 incident's "why did the saver disappear at 08:18?" was undiagnosable because no INFO-level saver lifecycle events existed in the log — only a handful of WARNs from downstream sites that lost their connection.

This subtopic enumerates the **closed catalog** of saver and daemon lifecycle INFO events. With these events grep'd as `saver:` and `daemon:`, an operator can reconstruct the entire saver-and-daemon lifecycle across any rotation boundary.

### Decision

**Locked.** The closed catalog below covers every saver and daemon lifecycle event. Adding new events requires explicit amendment of this discussion (or a successor spec amendment). Per-tick cycle summaries are already covered by the Cycle-level summary subtopic and don't reappear here.

### Mechanical rule (spec-phase intake)

Every site listed below MUST emit exactly one INFO log line at the moment described. Each row specifies the component, msg, and required attrs. Optional attrs (always allowed but not mandatory) are not listed; they follow the call-site pattern's general rules.

**Saver lifecycle events (component: `saver`):**

| Site | msg | Required attrs |
|---|---|---|
| Bootstrap creates the `_portal-saver` placeholder pane | `placeholder created` | `tmux_pane` (the pane id), `pid` (auto-baseline; the bootstrap process emitting this) |
| Bootstrap turns off `destroy-unattached` on the placeholder session | `destroy-unattached off` | `tmux_pane` |
| Bootstrap respawns the placeholder pane as `portal state daemon` (transition) | `respawn-daemon` | `from_pid` (placeholder pid), `to_pid` (daemon pid, post-respawn), `tmux_pane` |
| Bootstrap observes the daemon process is up and ready (after the 2s readiness barrier) | `daemon ready` | `target_pid` (the daemon pid), `version` (auto-baseline) |
| Bootstrap initiates the kill-barrier (Component A) for a prior daemon | `kill-barrier started` | `target_pid` (the prior daemon pid being killed) |
| Bootstrap escalates from `kill-session` to direct SIGKILL on the prior daemon | `kill-barrier escalated` | `target_pid`, `reason="kill-session-timeout"` |
| Daemon self-supervision observes the saver pane's host process exited | `placeholder died` | `target_pid` (the dead pid), `reason` ∈ {`signal`, `exit`, `unknown`} |

**Process/subsystem boundary (resolves review-004 I4).** `process:` owns the OS-process boundary (`start`/`exit`/`exec`/`panic`) for *every* role, including the daemon — emitted by `Init`/`main`. `daemon:`/`saver:` lines are *additive subsystem milestones*, never a substitute for `process:`, and cover only moments `process:` cannot express. The redundant `daemon: spawn` event (it fired at the same instant as `process: start process_role=daemon`, carrying the same data) is therefore **dropped**; its one unique attr (`tmux_pane`) moves onto `daemon: lock acquired`. The `saver:` catalog is unaffected — those lines are emitted by *bootstrap observing the saver from outside* (a different observer than the saver's own `process:` lines), so they are not redundant.

**Daemon lifecycle events (component: `daemon`):**

| Site | msg | Required attrs |
|---|---|---|
| Daemon acquires `daemon.lock` (post-pre-check) | `lock acquired` | `pid` (auto-baseline), `tmux_pane` |
| Daemon's self-supervision counter increments toward eject | (no INFO — DEBUG per the level discipline placement-clarification "hysteresis-internal failures") | n/a |
| Daemon's self-supervision counter trips threshold and ejects | `self-eject` | `ticks` (consecutive-absence count at trip), `threshold` (configured ejection threshold) |
| Daemon shutdown (any reason — SIGHUP, self-eject, normal exit) | `shutdown` | `reason` ∈ {`sighup`, `self-eject`, `signal`, `exit`}, `flush_completed` (bool — whether the final commit completed) |

**Closed attr extension (added to the prefix taxonomy attr vocabulary):** `target_pid`, `from_pid`, `to_pid`, `reason`, `ticks`, `threshold`, `flush_completed`. Plus existing baseline `pid`, `version` and existing contextual `tmux_pane`.

**Reason value spaces (closed):**

- `kill-barrier escalated reason`: `kill-session-timeout` (only value today; new values require amendment).
- `placeholder died reason`: `signal` / `exit` / `unknown`.
- `daemon shutdown reason`: `sighup` / `self-eject` / `signal` / `exit`.

Reason value spaces are closed sets per event — spec writers MAY NOT introduce new reason values without amending this catalog.

**Per-tick events (NOT in this catalog):**

Tick-rate events (capture loop, self-supervision probe) are NOT INFO. They're covered by:
- Cycle-level summary subtopic — one INFO per tick at the end of the daemon's capture-and-commit cycle (`capture: tick complete ...`).
- Level-discipline placement clarifications — per-tick probe failures are DEBUG; only the trip (self-eject) is INFO per this catalog.

Calling code for the catalog above lives across:
- `cmd/bootstrap/` — most saver lifecycle events (placeholder creation, respawn, kill-barrier, daemon-ready observation).
- `cmd/state_daemon.go` — daemon lifecycle (`lock acquired`, `self-eject`, `shutdown`). The daemon's process startup is marked by `process: start process_role=daemon`, not a `daemon:` event — `daemon: spawn` was dropped per I4.
- `internal/tmux/portal_saver.go` — kill-barrier escalation.

Spec writers walking these files apply the catalog row-by-row.

---

## Hook-firing observability limit (syscall.Exec)

### Context

Portal exec's hooks via `syscall.Exec`, replacing the helper process. After exec, portal will never observe the hook command's own exit status (whether `claude --resume <UUID>` actually launched Claude, exited with an invalid-session error, or hung). Capturing exit status would require wrapping the exec'd command in a shell envelope that records exit status before chaining to `$SHELL` — a separate, more invasive change with its own correctness considerations (signal forwarding, terminal-control handoff, shell quoting).

This subtopic carries the architectural limit forward: **we accept the limit and instrument what we CAN see, which is everything up to the moment of exec**.

### Decision

**Locked.** No wrapper envelope. Hydrate helper logs the lookup decision and the exec target as its terminal-point INFO; post-exec is silent by design. The wrapper-envelope option is preserved as a future consideration but is explicitly NOT in scope for this work.

The high-signal-per-LOC wins are:
1. The hook lookup decision (hit / miss / error) — DEBUG breadcrumb.
2. The exec decision itself (the binary being launched, whether a hook was resolved) — INFO terminal point.

With these, `grep "hydrate:" portal.log` reconstructs every helper invocation up to the exec moment. Post-exec behavior remains opaque, and that's an accepted architectural cost.

### Mechanical rule (spec-phase intake)

The hydrate helper (`cmd/state_hydrate.go`, specifically the `execShellOrHookAndExit` function path) MUST emit log lines at three points in its exec chain:

**1. Hook lookup (DEBUG breadcrumb):**

After the helper has computed the structural pane key and queried `hooks.json` for an on-resume hook, but BEFORE the exec call:

```go
hookLogger.Debug("hook lookup",
    "hook_key", paneKey,
    "result", lookupResult,  // "hit" | "miss" | "error"
)
```

Where `lookupResult` is `"hit"` if a hook was registered, `"miss"` if no hook for that pane_key, `"error"` if the lookup itself failed (parse error, etc.). On `"error"`, also include the `"error"` attr per the diagnostic-context preservation subtopic.

This DEBUG line is the diagnostic anchor for distinguishing "hooks.json drifted from the saved hook-key" (miss) from "lookup failed for some other reason" (error) from "helper never reached the lookup" (no line at all).

**2. Exec terminal point (INFO):**

Immediately before the `syscall.Exec` call:

```go
hookLogger.Info("exec",
    "target", execPath,        // the binary being exec'd (e.g. "$SHELL" or "sh") — review-008 M3
    "args", argv,              // its argv (e.g. `-c '<HOOK>; exec $SHELL'`) — parallel with process: exec
    "hook_present", hookFound, // bool — hydrate-specific extra
)
```

This INFO line is the terminal-point summary for the hydrate helper process (its last action before being replaced by the exec'd command). Per the call-site pattern, it's emitted at every successful exit path. **It is structurally parallel with `process: exec` (resolves review-008 M3):** both `syscall.Exec` handoff markers use `target` (the exec'd binary) + `args` (its argv), so `grep` on `target=`/`args=` gives a uniform "what did each process hand off to" view across `process: exec` and `hydrate: exec`. The switch from the earlier `path` attr to `target` is deliberate — `path` remains reserved for the helper's genuine filesystem-path lines (`fifo missing path=…`, `scrollback missing path=…`), which are unchanged.

When `hook_present=true`, the helper exec's `sh -c '<HOOK>; exec $SHELL'`. When `false`, it exec's `$SHELL` directly. The presence/absence is observable via this attr; the hook content itself is in the prior INFO line written by `hookStore` mutations (the state-mutation audit trail), so it's reconstructible via grep history without redundant logging here.

**3. Failure-mode INFO lines (the four exit paths from the original inbox seed):**

Per the inbox's specific framing, the hydrate helper has four terminal points other than the happy "exec" path that must all be instrumented:

| Exit path | Code shape | Log call |
|---|---|---|
| Silent ENOENT — helper opened FIFO and got "no such file or directory" | Handled in `cmd/state_hydrate.go` around line 120 | `hookLogger.Info("fifo missing", "path", fifoPath)` then exec (or exit per behavior) |
| Timeout — helper waited 3s, signal never arrived | Around line 115 | `hookLogger.Info("signal timeout", "took", "3s")` then exec |
| Scrollback file missing | Around line 147 | `hookLogger.Info("scrollback missing", "path", scrollbackPath)` then exec |
| Success — signal arrived, scrollback dumped | Around line 188 | `hookLogger.Info("scrollback replayed", "bytes", n, "took", took)` then exec |

Each exit path's INFO is followed by the exec INFO (from rule 2). Two INFO lines per invocation in the failure-mode cases, three in the success case (counting the lookup DEBUG which is below INFO threshold in production). The repetition is intentional — the exit-path INFO captures *what happened in the helper*; the exec INFO captures *what we handed off to*.

`grep "hydrate:" portal.log` after this rule applies will produce a complete per-pane audit trail for every helper invocation, broken down by exit path.

**Wrapper envelope (NOT in scope):**

A future enhancement could wrap the exec'd command in a shell envelope that captures exit status, e.g.:

```sh
sh -c '<HOOK>; ec=$?; printf "%d\n" "$ec" > /tmp/portal-hook-exit-<pid>; exec $SHELL'
```

The daemon could then read the exit-status file to log the hook's outcome. This is deferred — it introduces shell-quoting hazards, signal-handling complications, and a new file-cleanup concern. If the lookup + exec INFO lines turn out insufficient for a future investigation, this is the next layer to consider, in a separate work unit.

---

## Rollout sequencing and scope bundling

### Context

The locked design touches every package that logs (most of `internal/` and `cmd/`), introduces a new `internal/log` package, deletes the existing `state.Logger` type and `Component*` constants, and adds new instrumentation at ~30 explicit sites (per the locked catalogs). Shipping this all in one PR would produce a massive diff that's hard to review and risky to revert if a regression slips in.

Shipping it in too many PRs adds coordination cost and risks the patterns drifting across PRs (e.g. PR 3's call sites adopt a slightly different attr convention than PR 2's).

### Decision

**Locked: two-PR rollout, gated by short production observation between them.**

**PR 1 — Foundation + proof-of-pattern (one subsystem).**

Scope:
- New `internal/log` package (factory `For`, `Init`, `Close`) with the custom rotating slog.Handler.
- Migration sweep: delete `state.Logger`, `Component*` constants; rewrite every existing `logger.X(component, ...)` call site to use slog idioms via `log.For("...")`.
- Wire `log.Init` and `log.Close` into `main.go` for every entry point.
- Apply the locked Defensive invariants (`process: start`, `process: log-level resolved`, `process: exit`) and the Log-level propagation INFO line.
- Apply the locked Hook-firing observability subtopic in full (the original inbox seed): hydrate helper's lookup DEBUG, 4 exit-path INFOs, exec INFO.
- Tests: existing test suite must remain green. Add the `portaltest.AssertLogLevelResolved` helper. Add one new integration test covering the hydrate forensic story end-to-end.
- CLAUDE.md updated to reflect the new logger architecture.

PR 1 ships behavior-equivalent for users at the steady state (logs look slightly different but cover the same events), with one substantial new capability: full hydrate-helper forensic trail.

**Production observation window between PR 1 and PR 2:**

After PR 1 ships, run portal for **at least 7 days** in production (the user's own daily-driver install).

Gates:
- `portal.log` shows the expected `process:` / `log-rotate:` / `daemon:` / `hydrate:` baseline at INFO.
- No regressions in tmux/restore/hooks behavior.
- The hydrate helper's INFO trail reconstructs every Claude-resume hook invocation observed.
- No unexplained zeroing of `portal.log` (the open thread from F10).

If gates pass: proceed to PR 2. If any gate fails: fix before PR 2 ships.

**PR 2 — Pattern rollout across all remaining subsystems.**

Scope:
- State-mutation audit trail across all 3 files (hooks.json, aliases, projects.json) per the locked mechanical rule. Includes adding `aliases` + `projects` to the taxonomy in the new component-set.
- Cycle-level summaries at all 10 catalog sites (capture tick, bootstrap orchestration + per-step, restore phases, orphan sweeps, marker cleanup).
- Saver and daemon lifecycle event catalog (all 12 sites).
- Diagnostic context preservation sweep — audit every `exec.Cmd`, tmux invocation, and `os.*` boundary; apply the locked wrapping pattern.
- Concrete gap-closures from the inbox: `defaultIdentifyPS` stderr capture, `escalateKillToSIGKILL` DEBUG breadcrumb, `ShowGlobalHooks` failure-log asymmetry, defensive-branch "why this branch exists" comments.
- CLAUDE.md updated again to reflect the new instrumentation breadth.

PR 2 lands the full observability initiative. After PR 2 ships, the 30-day "no unexplained zeroing recurrence" window (from F10) starts ticking.

### Mechanical rule (spec-phase intake)

The spec phase produces ONE specification document covering both PRs, with explicit per-PR scope sections. The plan phase produces TWO plans, one per PR, with the PR 1 plan completing before the PR 2 plan is finalized (because PR 2's tasks depend on PR 1's foundation being merged and observed).

**PR 1 task surface (planned tasks, generated mechanically from the locked rules):**
- T1: implement `internal/log` package
- T2: migration sweep across all existing `state.Logger` consumers
- T3: implement `process:` lifecycle markers per Defensive invariants mechanical rule
- T4: implement `process: log-level resolved` per Log-level propagation mechanical rule
- T5: implement hydrate helper instrumentation per Hook-firing observability mechanical rule
- T6: integration test for hydrate forensic story
- T7: CLAUDE.md update

**PR 2 task surface:**
- T8: state-mutation audit trail across hooks/aliases/projects
- T9: cycle-summary catalog (10 sites)
- T10: lifecycle event catalog (12 sites)
- T11: boundary context preservation sweep
- T12: gap-closures bundle (4-5 small fixes)
- T13: CLAUDE.md update

Spec phase fleshes each task with the exact files, line ranges, and log call sites per the mechanical rules. Plan phase breaks each task into TDD steps. Implementation executes mechanically against the plan.

### Out of scope (separate future work)

- The shell-envelope hook-wrapping for post-exec exit status capture (see Hook-firing observability subtopic).
- An out-of-band rotation audit channel (`portal-rotation.log` — see F7, considered and rejected).
- Compression of rotated logs (see F12, considered and rejected).
- Migrating `sessions.json` and other daemon-internal state files to the user-config audit-trail pattern (see review-003 H1 — out of scope by explicit decision).

---

## Summary

### Key Insights

1. The 2026-05-28 evidence loss is rotation-churn (1 MiB threshold + single `.old` overwritten on each rotation), not literal truncation. Reframes the inbox premise.
2. Realistic per-day log sizing makes calendar-daily rotation the right primary boundary; size cap is a disk-fill safety valve, not the main mechanism.
3. Silent destruction (no log line on retention deletion or rotation) was the actual incident-multiplier. Every destructive action must emit a breadcrumb.
4. State-mutation breadcrumbs need to cover *internal* mutations too (e.g. `hookStore.CleanStale`), not just user-CLI mutations — the bash hook log can only see user-driven calls.
5. The scope is broader than the inbox's seven patterns — it's "use logging anywhere it aids debugging or insight under a disciplined level taxonomy". That makes level discipline and prefix taxonomy foundational, not auxiliary.
6. The foundation is `log/slog` (Go 1.21 standard library). Structured fields, handler abstraction, standard-library posture all compose better than extending the existing printf wrapper.
7. Default production level shifts from WARN to INFO. WARN-only is exactly the posture that left no evidence on 2026-05-28; a continuous INFO-level baseline costs ~5 MB/day and gives the forensic record the whole initiative is about.
8. Call-site discipline is "multiple independent log calls, slog filters by level" — no portal-specific abstraction. Trace-style wrappers couple DEBUG breadcrumbs to INFO summaries and obscure level discipline at code-review time; we reject them explicitly. Each log call has ONE level chosen explicitly.

### Open Threads

- **Current `portal.log` zeroing bug** — no `.old` exists, no `O_TRUNC` in `logger.go`, so the destruction mechanism is currently unidentified. Not logged as a separate inbox bug — likely surfaced or resolved as a side effect of the rotation rewrite; investigate during implementation. (The new design now brackets it: `process:` start-marker tripwires make a mid-day destruction *detectable*, and the review-008 M2 inode-identity reopen makes the daemon *recover* onto the live file instead of writing into the orphaned inode — but the root cause remains the implementation-phase investigation target.)

(The earlier "Hook command privacy" open thread is resolved — the State-mutation audit trail subtopic locked the **verbatim** posture, so it is no longer open; the decision and its threat-model rationale live in that subtopic.)

### Considered and Rejected / Closed by Prior Decisions

Documenting review-set 001 finding resolutions so future-us knows omissions were deliberate, not oversights.

- **F1** (rotation when daemon down at midnight boundary) — closed by library-encapsulated date-aware open. Daemon presence is no longer load-bearing for boundary crossing.
- **F2** (multi-writer concurrency at rotation boundary) — closed by same library-encapsulated decision; `O_CREAT|O_EXCL` handles cross-process create race.
- **F7** (out-of-band rotation audit channel) — considered and rejected. Locked invariants (rotated-file immutability + per-process startup markers + `O_EXCL` on today's file creation) provide sufficient post-hoc detectability for portal's scale. Cost of a second log file with divergent rotation policy outweighs benefit for a single-user dev tool.
- **F3, F4, F5, F6, F8, F9, F11, F13** (rotation/retention operational edges: timezone/DST, first-startup migration, disk-full/EACCES, retention scheduling and missed-day catchup, version-upgrade boundary, `.N` ordering, open-fd-after-unlink, rotation-INFO placement) — captured in the locked rotation/retention Decision sections as spec-phase work.
- **F14** (subsystem prefix taxonomy sequencing) — closed by scope-expansion call to promote level discipline and prefix taxonomy to foundational subtopics ahead of further pattern decisions.
- **F10** (investigation gate for the unknown zeroing bug) — closed. Ship the rewrite without blocking on root-cause understanding. If destruction recurs in the new system with no clear cause within 30 days post-ship, file a separate investigation bug; startup-marker tripwires will provide concrete evidence. Until then, treat the original bug as resolved-by-rewrite or detectable-when-it-recurs.
- **F12** (compress rotated logs) — considered and rejected. Worst-case 30-day window at ~600 MB uncompressed is already trivial; introducing `zgrep` as a precondition for searching anything older than today adds friction at exactly the moment the user is investigating an incident. Greppability outweighs disk savings at portal's scale.
- **G6, G11** (Component constants reconciliation and prefix taxonomy scope) — closed by the factory pattern: `internal/log` exposes `log.For(component string) *slog.Logger`; each package binds its component once at init; existing `Component*` constants are deleted as part of the migration sweep. Prefix taxonomy subtopic scope explicitly absorbed attr-key vocabulary (G3) and mandatory baseline attrs (G4).
- **G3, G4** (attr-key vocabulary and mandatory baseline attrs) — closed by the locked attr-key vocabulary (snake_case, 10 canonical keys) and the 4-attr mandatory baseline (`component`, `pid`, `version`, `process_role`). (Refined by review-004 I6: the baselines are injected **per-record by the configured handler**, not via `root.With(...)` at construction, so `log.For`-loggers cached before `Init` still carry them.)
- **G7, G10** (PORTAL_LOG_LEVEL default flip user-visible impact and deprecation path for existing `warn` users) — closed. Resolution: release notes only, no in-band breadcrumb. `portal.log` is a forensic artifact users only look at after the fact, so an in-band INFO line announcing the default change is invisible at the moment it would matter. Existing users who explicitly set `PORTAL_LOG_LEVEL=warn` continue to work unchanged. Users without an explicit value get the new INFO baseline; the "more volume than expected" friction is one mental moment + a changelog glance, acceptable cost for the continuous forensic baseline win.
- **G1** (level edge classes — idempotent no-ops, hysteresis-internal anomalies, recoverable-but-rare) — closed via the placement clarifications added under "Log-level discipline § Placement clarifications": no-ops default to DEBUG (INFO only when the no-op IS the user-visible decision), hysteresis-internal failures stay DEBUG until the threshold trips, recoverable-but-rare events warrant WARN.
- **G8** (NopLogger sentinel / nil-receiver semantics under slog) — closed by the factory pattern. `log.For(...)` always returns non-nil; the migration mandate is "every consumer holds a `*slog.Logger` from `log.For` or accepts one via DI". Tests use `slog.New(slog.NewTextHandler(io.Discard, nil))` as the silent-logger idiom. No `NopLogger()` sentinel survives the rewrite.
- **G9** (expected vs unexpected swallowed errors) — closed by the `error_class` attr already in the vocab. DEBUG breadcrumbs carry `error_class=expected|unexpected`. (Superseded by review-004 I3: the DEBUG-vs-WARN choice for an *unexpected* swallowed error is no longer a per-site judgment call — it is the mechanical postcondition predicate "WARN if work was dropped / postcondition unmet, else DEBUG" in the Log-level discipline table.)
- **G2** (volume math for reboot/upgrade burst at INFO) — closed. Reboot burst on a 30-pane install at INFO is ~50-100 lines across the first 10 seconds (30 hydrate-helper INFOs + 11 bootstrap-step INFOs + ~5-10 saver lifecycle INFOs + initial capture cycle summaries). Steady-state with 1Hz cycle summaries at INFO peaks at ~8 MB/day even under churn. Both well under the 500 MB cap; no rate limiting or sampling needed. The cap exists as runaway-loop protection, not steady-state ceiling.
- **G5** (migration plan from existing `state.Logger` printf API to slog) — closed. The factory pattern lock makes this structurally simple: each of ~12 packages gets `var logger = log.For("<component>")` at init, and `state.Logger.Info(component, fmt, args)` call sites become `logger.Info(msg, attrs...)`. Big-bang sweep in one PR — no adapter shim, no co-existence period. The pipe-delimited line format and `state.Logger` type are deleted in the same PR. Test mock surfaces (`bootstrapDeps` and friends) drop the logger mock entirely and accept `*slog.Logger` directly via `slog.New(slog.NewTextHandler(io.Discard, nil))`.

### Current State

- All 14 subtopics decided. Every locked subtopic carries a "Mechanical rule (spec-phase intake)" sub-section detailed enough that spec phase can produce per-call-site enumeration with zero judgment.
- Scope expansion confirmed and applied: the codebase is instrumented across ~30 enumerated INFO sites (per the locked catalogs in Cycle summary + Lifecycle event + Hook-firing + State-mutation subtopics), plus DEBUG breadcrumbs at every boundary and decision point per the level discipline mechanical rule.
- Taxonomy final: 15 components; closed attr space = 13 contextual + 11 cycle-summary + 7 lifecycle + 3 hydrate + 7 process + 4 baseline (review-007 L1–L3 enrolled the previously-missing process, propagation, and state-mutation attr sets).
- Rollout: two-PR sequence — Foundation+hydrate proof (PR 1) → 7-day production observation → Full pattern rollout across all subsystems (PR 2). 30-day "no unexplained zeroing" gate starts after PR 2.
- Review-sets 001–004 and 007–009 fully drained: 58 findings closed (001–003: 32; 004: I1–I12; 007: L1–L7; 008: M1–M5; 009: N1–N2), each walked one finding at a time and captured in-place under its owning subtopic. Reviews 005 and 006 were generated against the *since-reverted* review-004 in-place amendments (the cascade rolled back in git `ed61436b`/`cbed8200`/`e852fb84`) and were discarded as moot. Review-009 was the final pre-conclusion convergence check (2 narrow seams, both resolved).
- Discussion convergence: all map entries decided; subtopic write-ups + mechanical rules + closed value spaces + spec-phase-ingestible catalogs all captured.
