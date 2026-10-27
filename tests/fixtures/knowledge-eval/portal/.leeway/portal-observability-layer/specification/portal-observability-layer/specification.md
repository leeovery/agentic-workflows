# Specification: Portal Observability Layer

## Overview

### Purpose

Portal's logging is incidental — lines added ad hoc, not a deliberate observability layer. On 2026-05-28 a `hooks.json` wipe followed by a saver-disappearance event was undiagnosable: `portal.log` had rotated the evidence away (1 MiB threshold, single `.old` overwritten on each rotation) and was later found at 0 bytes. This feature replaces incidental logging with a disciplined, structured observability layer built on Go's `log/slog`, fixes the rotation system that caused the evidence loss, and instruments the codebase so that `grep "<subsystem>:" portal.log` reconstructs any subsystem's behaviour at the production-default level.

### What we're building

- A new `internal/log` package wrapping `log/slog` with a custom rotating handler (factory `For`, plus `Init`, `Close`, `SetTestHandler`).
- Calendar-daily log rotation with a configurable size-cap safety valve, replacing the 1 MiB churn-prone scheme.
- Bounded, auditable retention (default 30 days) with per-deletion breadcrumbs.
- A locked log-level contract (DEBUG/INFO/WARN/ERROR), production default INFO.
- A closed subsystem-prefix taxonomy (18 components), a closed attr-key vocabulary, and mandatory per-record baseline attrs.
- Defensive invariants (per-process lifecycle markers, rotated-file immutability, `O_CREAT|O_EXCL` first-of-day open) that make log destruction detectable post-hoc.
- Instrumentation catalogs: state-mutation audit trail, cycle-level summaries, saver/daemon lifecycle events, hydrate-helper forensic trail, and a boundary-context-preservation sweep.

### Specification roadmap

1. Overview (this section)
2. The `internal/log` package — foundation, API, migration sweep
3. Subsystem prefix taxonomy — components, attrs, baselines, rendering
4. Log-level discipline — the level contract + mechanical selection table
5. Call-site logging pattern
6. Log rotation mechanism
7. Retention policy and audit
8. Defensive invariants against log destruction
9. Log-level propagation verification
10. State-mutation audit trail
11. Diagnostic context preservation at boundaries
12. Cycle-level summary cadence and shape
13. Saver and daemon lifecycle event taxonomy
14. The `theme` component event catalog
15. Hook-firing observability limit

---

## The `internal/log` package

### Decision

Adopt Go's standard-library `log/slog` (stable since Go 1.21) as the logging foundation. The existing bespoke printf-style `internal/state/logger.go` is replaced wholesale. Rationale: standard library (no new dependency), structured fields native, handler-based (one set of call sites emits human-readable text for tail/grep *or* JSON for tooling), and future-proof as instrumentation call sites multiply.

A new package `internal/log` is the single owner of all logging machinery. No `*slog.Logger` is constructed anywhere outside it.

### Public API

```go
package log

// Init configures the process-wide logger: builds the custom rotating handler
// (baseline attrs pid/version/process_role injected per-record) and atomically
// swaps it in behind the stable root logger. Called from main.go before any
// other portal code runs. IDEMPOTENT and re-entrant — a second call re-points
// the handler, it does NOT panic. By convention only main calls Init in prod.
func Init(stateDir string, version string, processRole string) error

// For returns a component-bound child logger (root.With("component", name)).
// Safe to call before Init — always returns a valid, non-nil *slog.Logger.
// Callers cache it at package init via a package-level var; the cached logger
// picks up Init's handler automatically because the swap lives inside the
// shared handler indirection.
func For(component string) *slog.Logger

// Close emits the "process: exit" marker, computing took from the
// package-private startTime captured at Init. Does NOT call os.Exit — the
// logger owns no control flow. (Marker semantics: see Defensive invariants.)
func Close(exitCode int)

// SetTestHandler swaps in h for the duration of the test and restores the
// previous handler via t.Cleanup. Test-only seam for capturing or silencing
// log output in-process — no subprocess required.
func SetTestHandler(t *testing.T, h slog.Handler)
```

### Init/For contract — swappable-handler indirection

- The root `*slog.Logger` is constructed in `internal/log`'s own package `init`, over a small custom handler whose inner delegate is **replaceable** (mutex- or `atomic.Pointer`-guarded). Because every consumer imports `internal/log`, Go runs its `init` first, so `root` exists before any `For` call.
- `Init` swaps the configured rotating handler into that indirection. Every `For`-created logger shares the indirection, so loggers cached at package-init (before `Init` ran) route to the configured handler once `Init` lands — no stale-logger footgun, no nil returns.
- Before `Init` runs, the indirection holds a **safe default handler that writes INFO-and-above as text to stderr**. (The discussion left this as "discard or stderr-text"; pinned to stderr-text-at-INFO so any unexpected pre-`Init` log surfaces rather than silently vanishing. `main` calls `Init` first thing, before any TUI rendering, so this window carries no expected output.)
- The "configured once in prod" invariant is preserved by **convention** (only `main` calls `Init`) plus the test-only `SetTestHandler` seam — **not** by panicking. In-process tests swap a capture / `io.Discard` handler; no subprocess required.
- **Cost:** one synchronized read (atomic load / RLock) per `Handle`. Negligible behind slog's level filter, and free-riding on the custom handler already needed for rotation.
- **Baseline-attr injection:** baseline attrs (`pid`, `version`, `process_role`) are injected by the configured handler **per-record**, NOT via `root.With(...)` at construction — otherwise package-init children created before `Init` would miss them.

The custom handler also owns rotation (see Log rotation mechanism), retention sweeps (see Retention policy), the `component:`-prefix text rendering and the lifecycle-marker level-filter bypass (see Subsystem prefix taxonomy and Defensive invariants). The text-mode line format is fully specified in the Subsystem prefix taxonomy section.

### `process_role` resolution

Because `Init` is called from `main` before any other portal code (and before Cobra parses argv), `main` resolves `process_role` from a lightweight `os.Args` inspection — a longest-prefix match of the leading subcommand tokens against a small static table, matching on subcommand path tokens only (flags ignored) so it needs no full parse. The resolved value is passed to `log.Init`.

| Leading `os.Args[1:]` tokens | `process_role` |
|---|---|
| `state daemon` | `daemon` |
| `state hydrate` / `state signal-hydrate` | `hydrate` |
| `hooks …` | `hooks_cli` |
| `clean` | `clean` |
| `open …` / `x …` / `attach …` / no subcommand (bare `portal`) | `tui` |
| anything else | `bootstrap` (default/fallback) |

First match wins. `bootstrap` is the explicit default for any invocation not matched above, so the closed 6-value space is fully covered and no invocation is left unmapped.

### Consumer usage

A package that logs binds each component it emits under **once**, at package init:

```go
import "github.com/leeovery/portal/internal/log"

var logger = log.For("<component-name-from-taxonomy>")
```

Call sites then use `logger.{Debug,Info,Warn,Error}` directly with `slog.Attr` args (`"key", value` variadic form), attr keys drawn from the closed vocabulary.

**The rule is bind-once *per package, per component* — not one package per component**, and the taxonomy is deliberately not partitioned by package:

- **A component may be bound by several packages.** `signal` is bound in `cmd`, `cmd/bootstrap` and `internal/state`; `bootstrap`, `hooks`, `clean` and `spawn` each span two. The component names a *subsystem*, and a subsystem's code need not live in one package for `grep "<component>:"` to reconstruct it.
- **A package may bind several components.** `cmd` holds package-level bindings for `daemon`, `hydrate`, `notify`, `hooks`, `bootstrap`, `restore`, `preview`, `signal`, `capture`, `spawn`, `resolve` and `theme`.
- **A package handed an already-bound logger through a seam binds nothing.** `internal/theme` emits the whole `theme` component through an injected logger and never calls `log.For` at all; the single `log.For("theme")` binding lives in `cmd` (see *The `theme` component event catalog*). `internal/spawn`'s shared emission helpers take an injected logger the same way — `cmd` passes its own binding in for the CLI burst and injects that same binding into `internal/tui` for the picker burst, so the TUI binds nothing either — alongside that package's own binding, which covers its detection path and its `terminals.json` load.

What the rule forbids is a *second* binding of the same component inside one package — invisible at review, because every call site still looks correct in isolation.

### Migration sweep (single PR, big-bang — no adapter shim, no co-existence period)

- The `internal/state.Logger` type is **deleted**.
- The `internal/state.Component*` constants (`internal/state/logger.go:30-38`) are **deleted**.
- The pipe-delimited line format (`timestamp | level | component | message`) is **deleted**.
- All call sites of `state.Logger.{Debug,Info,Warn,Error}(component, fmt, args...)` are rewritten to `logger.{Debug,Info,Warn,Error}(msg, attrs...)`, component bound at package-init via `log.For`.
- `state.NopLogger()` is **deleted**; tests requiring a silent logger use `slog.New(slog.NewTextHandler(io.Discard, nil))` directly.
- All test mock surfaces in `bootstrapDeps` and friends that previously held `*state.Logger` are updated to hold `*slog.Logger`.

---

## Subsystem prefix taxonomy

### Rendering mechanism

`component` is a structured slog attr set at every call site. The custom `slog.Handler` renders **text** output with `component:` as a literal prefix at the start of the message body, timestamp + level preceding it. `component` remains a real structured attr under the hood, so **JSON** output and programmatic filtering work unchanged.

Example text-mode line:
```
2026-05-29T08:38:00Z INFO hydrate: ok pane_key=foo:0.0 took=1.2s pid=12345 version=0.5.0 process_role=hydrate
```

Same call site, JSON handler:
```json
{"time":"2026-05-29T08:38:00Z","level":"INFO","component":"hydrate","msg":"ok","pane_key":"foo:0.0","took":"1.2s","pid":12345,"version":"0.5.0","process_role":"hydrate"}
```

Grep idiom preserved: `grep "hydrate:" portal.log` produces the per-subsystem audit trail. Programmatic filtering also works: handlers route by `component` attr, JSON tooling indexes it.

Call-site binding is the factory pattern defined in *The `internal/log` package* — a consumer binds each component it emits under once at init via `var logger = log.For("<component>")`, or is handed an already-bound logger through a seam and binds nothing.

### Closed component value space (18 total)

```
bootstrap  daemon  restore  hydrate  notify  hooks  preview
saver  capture  signal  log-rotate  clean  aliases  projects
process  spawn  resolve  theme
```

This list is the **single source of truth** for the component count.

| Component | Owns |
|---|---|
| `daemon` | `portal state daemon` runtime — tick loop, self-supervision |
| `bootstrap` | The ten-step bootstrap orchestrator |
| `restore` | Two-phase restore engine (skeleton + geometry + scrollback) |
| `hydrate` | Per-pane `portal state hydrate` helper — FIFO open, scrollback replay, exec chain |
| `notify` | Notification helpers |
| `hooks` | `hooks.json` mutations (`portal hooks set/rm`, `hookStore.CleanStale`) |
| `preview` | TUI scrollback preview page |
| `saver` | `_portal-saver` session lifecycle |
| `capture` | The daemon's per-tick capture loop (promoted from inside `daemon`) |
| `signal` | FIFO signaling **mechanism** — `EagerSignalHydrate`, the per-session hook-driven `portal state signal-hydrate` command (`runSignalHydrate`'s marker-enumeration / per-session / per-FIFO-write diagnostics), and the lower-level FIFO signal send/receive plumbing in `internal/state`. `signal-hydrate`'s `process_role` stays `hydrate` (the argv-resolved binary) — orthogonal to this subsystem `component` (cycle-3 decision: the FIFO-signaling subsystem is homed under `signal` regardless of which binary writes it, so `grep "signal:"` reconstructs the whole mechanism). (The hydrate helper's own exit-path outcome lines — incl. `signal timeout` — render under `hydrate` per the Hook-firing catalog, which governs the helper's exec-chain.) |
| `log-rotate` | Rotation and retention events |
| `clean` | The sweep paths — bootstrap's orphan-daemon and stale-marker sweeps and `internal/state`'s orphan-FIFO sweep. Named for the `portal clean` command it was introduced for; that command is retired, and its user-invoked repairs live on `portal doctor --fix` |
| `aliases` | `aliases` store mutations |
| `projects` | `projects.json` store mutations |
| `process` | Portal-binary lifecycle markers (`start` / `exit` / `exec` / `panic` / `log-level resolved`) only, regardless of subcommand |
| `spawn` | The multi-window spawn service — host-terminal detection, adapter resolution, per-window ack outcomes, and the burst's batch summary. Bound in `internal/spawn` and again in `cmd`; both burst surfaces (the picker's multi-select burst and `portal open`'s multi-target burst) emit through `internal/spawn`'s single-sourced renderers, so the two paths cannot drift |
| `resolve` | `portal open`'s resolution decision — one INFO per bare positional resolved through the guessing chain (glob and domain-pinned targets are deterministic and emit nothing). Bound and emitted **only** in `cmd/open.go`; `internal/resolver` stays a pure, log-free library |
| `theme` | Theme load / enumeration / persistence **outcomes**, emitted from three sites across two packages: the loader in `internal/theme` (which binds nothing — it emits through an injected logger seam), `cmd/config.go`'s one-shot `appearance` → theme translation, and the `cmd`-owned theme persister behind the panel's commit. Full catalog, levels and cadences: *The `theme` component event catalog* |

`process` is reserved for portal-binary lifecycle/diagnostic markers only; subsystem-level lifecycle events have their own components. `tmux` is **deliberately excluded** — `internal/tmux` is a thin wrapper; logging at that layer produces extreme volume per tmux call. Tmux-call detail rides as DEBUG breadcrumbs under the caller's component.

`prefs` and `terminals` are **deliberately excluded** too, on a different argument from `tmux`'s: they are dumb stores — a tolerant decode and a write — with no runtime behaviour and therefore no outcomes worth a trail. (`prefs.json` likewise stays outside the *State-mutation audit trail*'s closed file set.) What earns `theme` a component where those two are refused is that the theme loader **has** outcomes: a nomination that would not parse, a themes directory that could not be read, a shipped palette standing in for the one the user asked for.

### Closed attr-key value space (64 keys)

**Contextual** (set per call as relevant) — 14:

| Key | What |
|---|---|
| `pane_key` | Structural pane key (canonical persisted form, e.g. `session__window.pane`) |
| `tmux_pane` | `$TMUX_PANE` env var (live tmux pane id, e.g. `%42`) |
| `session` | tmux session name |
| `project` | project name from `projects.json` |
| `path` | filesystem path |
| `took` | duration (`time.Duration` rendered) |
| `error` | error message (slog idiom: `slog.Any("error", err)`) |
| `error_class` | swallowed-error classification: `expected` / `unexpected`; or AtomicWrite failure phase |
| `hook_key` | hooks subsystem — the structural hook key |
| `op` | state-mutation breadcrumbs — `set` / `modify` / `rm` / `clean-stale` / `migrate` / `set-noop` |
| `alias` | aliases-store key |
| `value` | state-mutation — verbatim new value for `set` / `modify` |
| `via` | state-mutation origin — `cli` / `internal` / `migrate` |
| `retention` | log-rotate — retention window in days (integer); on `deleted` and invalid-env WARN lines |

**Cycle-summary** (set per summary line as relevant) — 14: `sessions`, `panes`, `entries`, `steps`, `step`, `windows`, `skipped`, `warnings`, `natural_churn`, `anomalous`, `reaped`, `killed`, `unset`, `entries_failed`. (`step` = bootstrap step name; `windows` = restore-skeleton window count; `skipped` = orphan-fifo sweep skip count.)

**Lifecycle** (set per saver/daemon lifecycle event) — 7: `target_pid`, `from_pid`, `to_pid`, `reason`, `ticks`, `threshold`, `flush_completed`.

**Hydrate** (set per hook-firing exec-chain event) — 3: `result`, `hook_present`, `bytes`.

**Process** (set per `process:` lifecycle/diagnostic line) — 7: `cmd`, `args`, `target`, `code`, `resolved`, `source`, `raw`. `target` + `args` are the **shared exec-handoff attrs** used by both `process: exec` and `hydrate: exec`, so the two `syscall.Exec` markers are structurally parallel. The `process: panic` line additionally carries `reason` — that key is **defined in the Lifecycle group and cross-listed here** (not a separate key; the 64-key total counts it once).

**Spawn** (set per `spawn:` event — host-terminal detection, `terminals.json` load, per-window outcome, batch summary) — 8:

| Key | What |
|---|---|
| `batch` | The burst's option-name-safe nanoid — the `@portal-spawn-<batch>-<token>` ack channel's namespace |
| `terminal` | Detected host-terminal name |
| `bundle_id` | Detected host terminal's macOS bundle id (absent on a NULL / remote identity) |
| `resolution` | Which route resolved the adapter — `config` (a `terminals.json` recipe) / `native` / `unsupported` |
| `ack` | One window's token-ack outcome — `confirmed` / `timeout` / `failed` |
| `opened` | Batch summary — sessions actually surfaced, the trigger's self-attach counted only on full success |
| `total` | Batch summary — N, the whole target set including the trigger's own surface |
| `detail` | The opaque lower-layer string: the driver's OS-specific text (osascript output, AppleEvent code), the detection route, or a rejected `terminals.json` entry's reason. Carried verbatim and **never parsed** by the logging layer |

The per-window records also carry `session` — **defined in the Contextual group and cross-listed here** (not a separate key; the 64-key total counts it once).

**Resolve** (set on the single `resolve: resolved` decision line) — 2: `domain` (which arm of the grammar answered — `session` / `path` / `alias` / `zoxide`, or `miss`), `resolved_path` (the resolved directory, the session name on a session hit, empty on a miss). The same line carries `target`, the raw input — **defined in the Process group and cross-listed here** (counts once).

**Theme** (set per `theme:` event) — 5:

| Key | What |
|---|---|
| `slug` | A theme's identity — its filename stem. On `theme: loaded` this is the palette that actually rendered; on `theme: fallback applied` it is the nomination that failed |
| `slot` | Which half of an adaptive pair a line is about — `light` / `dark`. **Absent under a constant setting**: not an empty string and not the word "constant" |
| `token` | The offending token list on a rejection whose reason names one (`missing tokens`, `bad colour`). `theme: rejected` is its **only** consumer |
| `count` | `theme: enumerated` — rows the panel's union produced, built-ins included |
| `rejected` | `theme: enumerated` — the unselectable subset of those rows |

Theme events also carry `reason` (Lifecycle group) and `path` (Contextual group) — **cross-listed, not separate keys; the 64-key total counts each once**. `path` is the identity attr for a rejection with no usable slug and for `theme: directory unusable`.

**Baseline** (auto-injected per-record by the configured handler) — 4: `component` (set per package via `log.For`), `pid`, `version`, `process_role`.

### Mandatory baseline attrs

Every line carries these four, injected **per-record** by the configured handler (not via `root.With` — so package-init children created before `Init` still carry them):

| Key | Set where |
|---|---|
| `component` | Per-package via `log.For("...")` |
| `pid` | Captured at `Init` (`os.Getpid()`); injected per-record by the configured handler |
| `version` | Passed to `Init` (build-time `cmd.version`); injected per-record by the configured handler |
| `process_role` | Passed to `Init` — one of `daemon` / `bootstrap` / `hydrate` / `hooks_cli` / `tui` / `clean` (resolution in *The `internal/log` package* § `process_role` resolution); injected per-record by the configured handler. Identifies which portal binary invocation emitted the line; critical for multi-writer disambiguation on reboot-recovery days. |

Baseline attrs add ~50 bytes per line — negligible at INFO steady-state (~3 MB/day). They make every line self-describing for forensic use across multi-writer days.

### Conventions

- **snake_case** for all attr keys.
- **Message string is a terse phrase**; data lives in attrs: `logger.Info("ok", "pane_key", k, "took", d)` — never `logger.Info(fmt.Sprintf(...))`.
- **Sticky context via `.With(...)`** when multiple events share context.

### Custom `slog.Handler` text-mode rendering rule

```
<RFC3339Nano timestamp> <LEVEL> <component>: <msg> <attrs as key=value pairs>
```

- `<component>` is read from the bound `component` attr and emitted as a literal prefix immediately before the colon. It is **not** also rendered in the attrs key=value list.
- `<msg>` is the slog record's message field.
- `<attrs>` are emitted space-separated `key=value` in order: contextual attrs (in `slog.Record` order), then the three remaining baselines (`pid`, `version`, `process_role`).
- Multi-word string values are quoted with `"`. **Single-token values are emitted unquoted** — so e.g. `raw=trace` / `raw=` render without quotes (the `raw="<v>"` forms shown in the illustrative example lines elsewhere in this spec are slog-default-style sketches, not the text-mode contract; only a value containing whitespace, e.g. an invalid `raw="de bug"`, is quoted).
- `time.Duration` values render with Go's default `String()` (e.g. `1.234s`).
- `slog.Group` attrs flatten to **dotted keys** (`group.key=value`), mirroring the JSON handler's nesting.

### Custom `slog.Handler` JSON-mode rendering rule

Standard `slog.NewJSONHandler` output, no special handling — `component` becomes a normal `"component":"<name>"` JSON field.

### Extension policy

- New components require explicit amendment of THIS specification's closed component list.
- New attr keys require the same amendment process.
- Spec writers and code reviewers MAY NOT introduce new component or attr names ad hoc.
- The space is **genuinely closed** — every contributor consults these lists; no ad-hoc invention at call-site time.

---

## Log-level discipline

### Decision

slog four-level model (Debug / Info / Warn / Error) with the semantic contract below. **Production default `PORTAL_LOG_LEVEL=info`** (changed from the historical WARN — WARN-only was the posture that left no evidence on 2026-05-28). Custom sublevels (Trace/Notice) were considered and rejected — four levels is the standard.

| Level | Purpose | Volume |
|---|---|---|
| **DEBUG** | Kitchen sink for reconstruction: breadcrumbs on swallowed-error paths, per-event state changes under cycle summaries, observed transient values, decision-point inputs. Off in production. | Bound by code paths reached, not judgement. |
| **INFO** | Decision/terminal-point summaries, cycle summaries, lifecycle events. One line per *meaningful choice*, not per state change. The steady-state production signal. | Bound by rate of meaningful events (~1–5 MB/day). |
| **WARN** | Unexpected-but-recoverable conditions. Per-session capture anomalies, retries triggered, transient probe failures inside hysteresis, invalid config falling back to default. | Every line is a signal worth looking at. |
| **ERROR** | Genuinely unrecoverable — process is about to exit because it cannot continue. Rare in portal due to swallow-and-continue posture. | Few sites total; most candidates warrant WARN instead. |

Two implications carry forward:
1. The **subsystem prefix taxonomy** is designed so `grep` on a prefix produces a useful trace at INFO level — INFO is the production baseline that has to be greppable.
2. **State-mutation audit trail** breadcrumbs are INFO (decision points), not DEBUG — they must survive at production level.

### Placement clarifications

- **Idempotent no-ops** (e.g. `RegisterPortalHooks` deciding "already current, no action"): DEBUG by default. INFO only when the no-op IS the user-visible decision (e.g. "saver already at version V, skipping respawn" — the operator wants to see we considered upgrading and chose not to act). A purely-internal idempotent skip clutters the INFO baseline.
- **Hysteresis-internal failures** (e.g. saver-membership probe failure inside the 3-tick self-supervision hysteresis): DEBUG per spurious tick. ONE INFO or WARN on the trip (when the threshold is crossed and the eject decision lands). WARN per tick during transient tmux contention would fire continuously and invert the "every WARN is signal" promise.
- **Recoverable-but-rare** (e.g. corrupt `sessions.json` falling back to empty state; pane decode failures dropping one pane and continuing): WARN. These are signal even when recovered. "Rare" doesn't bump them to ERROR — ERROR is strictly "process exiting because it cannot continue".

### Mechanical level-selection table

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

**Swallowed-error predicate.** The DEBUG-vs-WARN choice for an *unexpected* swallowed error is not a per-site judgment call. It is the single mechanical question: **did swallowing the error lose something?** If the function dropped a unit of work or failed its postcondition → WARN; if the postcondition still holds → DEBUG. Anchored to the function's contract, not the author's sense of importance. (Matches the codebase: per-session capture skips already log WARN — work dropped that tick — while transient hysteresis probe failures stay DEBUG.)

### Default and invalid-value handling

Default `PORTAL_LOG_LEVEL = info`. Invalid env value (any value that is not exactly `debug` / `info` / `warn` / `error` after lowercasing) → fall back to `info` and emit one WARN at process start:
```
bootstrap: invalid PORTAL_LOG_LEVEL raw="<v>" resolved=info
```

The WARN→INFO default flip affects only the **unset** case: a user who has explicitly set `PORTAL_LOG_LEVEL` (including `warn` or `error`) continues to resolve to that value unchanged (`source=env`). The default change is deliberately **not** announced by an in-band log line — a `portal.log` notice is invisible at the after-the-fact moment it would matter — so no "default changed" breadcrumb is emitted. (How the flip is communicated to users is a release-notes concern, out of scope here.)

Spec writers MUST verify each new log call site against this table during spec authoring. Code reviewers verify the same at PR review time.

---

## Call-site logging pattern

### Decision

**Multiple independent log calls per function; slog handles level filtering.** Each `logger.Debug(...)` / `logger.Info(...)` is a standalone call with its level chosen explicitly. Rejected alternatives: a wrapper bundling levels into one call (hides level discipline from review), and an OpenTelemetry-style span abstraction (designed for distributed multi-host tracing portal doesn't need).

Canonical pattern for a multi-step operation:

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
    log.Debug("fifo opened", "took", time.Since(start))

    if err := awaitSignal(fd); err != nil {
        return err
    }
    log.Debug("signal received", "took", time.Since(start))

    n, err := replayScrollback(...)
    if err != nil {
        return err
    }
    log.Debug("replay finished", "bytes", n)

    log.Info("ok", "took", time.Since(start))  // terminal-point summary
    return nil
}
```

At INFO (production): one INFO line per invocation. At DEBUG (investigating): all four DEBUG lines + the INFO summary.

**This listing illustrates the breadcrumb→terminal *pattern* only — it is not a literal transcription of the hydrate helper's log lines.** Where the pattern overlaps a real cataloged site, the subtopic catalog governs (the hydrate helper's actual lines are specified in *Hook-firing observability limit*). The subtopic catalogs (Hook-firing, Cycle-summary, Lifecycle) are authoritative for their real call sites; this example only shows the shape.

### Allowed ergonomic helpers

1. **`.With(...)` for sticky context** — bind shared attrs once when a function/scope has many log calls sharing context (e.g. `pane_key`, `session`). Stops attr-key repetition.
2. **`logger.Enabled(ctx, slog.LevelDebug)` guard** — only for the rare case where computing the attrs is itself expensive (e.g. JSON-marshalling something just to attach as a debug attr). Slog's lazy formatting makes this irrelevant 99% of the time.
3. **Shared helpers in `internal/log`** — only after the same idiom appears 5+ times in production code and earns its weight. Don't pre-build helpers for theoretical cases.

### Allowed slog idioms

- `logger.LogAttrs(ctx, level, msg, slog.String(...), …)` — explicitly PERMITTED and preferred on hot paths: lower-allocation, type-safe equivalent of the variadic `"key", value` form, identical semantics and level discipline. Attr keys still come from the closed vocabulary.
- `slog.Group(name, …)` — PERMITTED. Text-mode rendering flattens grouped attrs to **dotted keys** (`group.key=value`), mirroring how the JSON handler nests them. A group name is part of the closed attr vocabulary — adding one needs the same amendment as a new attr key.

### Mechanical rule

Per function authored or amended, spec writers and code reviewers apply this discipline mechanically:

1. **DEBUG breadcrumbs** at each meaningful state transition inside the function (resource acquired, event received, sub-operation completed, branch chosen). One `logger.Debug(<terse-msg>, <attrs>...)` per transition.
2. **INFO at terminal decision points** — one `logger.Info(<terse-msg>, <attrs>...)` immediately before each successful return path. The line MUST capture the chosen outcome and the resolved decision attrs.
3. **WARN per recoverable error path** — one `logger.Warn(<terse-msg>, "error", err, <attrs>...)` before swallowing/returning, at any code path that classifies as "unexpected-but-recoverable" per the level-discipline table.
4. **ERROR only at lines immediately preceding** `os.Exit(N)` / `panic(...)` / `return err` from a main entry point.

**Sticky-context rule:** when ≥ 3 subsequent log calls in the same lexical scope share an attr, bind it once via `local := logger.With(<attrs>...)` and use `local.<Level>(...)` thereafter. Below the 3-call threshold, repeat attrs at each call.

**Expensive-attr guard:** wrap with `if logger.Enabled(ctx, slog.LevelDebug) { ... }` ONLY when computing an attr value involves measurable cost (JSON marshalling, slice formatting > 100 elements, syscall to read state). For ordinary attrs (strings, ints, durations, pre-computed values), use slog's lazy formatting directly.

### Prohibited (PR review must reject)

- Custom helpers that bundle multiple levels into one call (e.g. `Trace(msg, debugAttrs, infoAttrs)`).
- `fmt.Sprintf` inside log message strings to embed values that should be attrs (`logger.Info(fmt.Sprintf("ok %s", k))` — wrong; use `logger.Info("ok", "key", k)`).
- Direct construction of `*slog.Logger` outside the `internal/log` package.
- Pre-formatting attrs into the message string (use slog attrs instead).
- Using attr keys not in the closed value space (extend the vocabulary first via amendment).

---

## Log rotation mechanism

### Decision

**Calendar-daily rotation as primary boundary, with a configurable size-cap safety valve, all encapsulated in the library handler.** Replaces the old 1 MiB-threshold scheme (which churned every few hours under load and overwrote its single `.old`, causing the 2026-05-28 evidence loss).

**Rotation ownership — library-level, every-writer date-aware.** The custom `slog.Handler` in every portal process is date-aware:
- On each write it computes today's filename via `time.Now().Format("2006-01-02")` and ensures the open fd points at today's file.
- First write of the day across all processes opens the new day's file via `O_CREAT|O_EXCL`. First writer wins the create race atomically; losers detect the file exists and open `O_APPEND` — race-safe on Unix for slog-sized line writes (< `PIPE_BUF`).
- A symlink `portal.log → portal.log.YYYY-MM-DD` is swung atomically at the boundary so `tail -f portal.log` always follows today's file regardless of which process owns the swing.
- Daemon-down across midnight is solved by construction — any waking process's first write opens today's file. No explicit catchup logic.

**Boundary, filenames, size cap, immutability:**
- Calendar boundary: **local midnight** (machine timezone).
- Filenames: `portal.log.YYYY-MM-DD` for the day's base file; same-day overflow on size-cap appends `.N` (monotonic via `O_CREAT|O_EXCL` retry against highest existing `.N`).
- Size-cap safety valve: default **500 MB**, configurable via `PORTAL_LOG_ROTATE_SIZE` (K/M/G suffixes, e.g. `500M`, `1G`). Parsed once at handler init. Chosen so it never fires in normal use even at DEBUG steady-state (~20 MB/day) yet catches a runaway within ~1 day before disk fills.
- Rotated files are immutable: `chmod 0400` once they are no longer today's file.

### Mechanical rule — per `Handle(record)` into the `internal/log` handler

1. Compute `today := time.Now().Format("2006-01-02")`.

2. **Reuse the currently-open fd only while BOTH hold:** (a) no date change — it is for `portal.log.<today>`; AND (b) its inode still matches the current `portal.log` symlink target (`fstat` the open fd, `stat` the symlink target, compare `st_dev`+`st_ino`). Otherwise reopen. Two reopen triggers, handled differently:
   - **Date change** (new calendar day) → run the full new-day path (steps a–d) plus the Retention sweep (separate rule, see Retention policy).
   - **Inode mismatch / `ENOENT` on the target, same day** → today's file was unlinked or replaced out from under us mid-day (the unknown-zeroing scenario this defends against — a long-lived daemon's `O_APPEND` fd would otherwise keep writing to the orphaned inode and lose every byte on close — or a peer's size-cap rotation). Reopen by following the current symlink target if it exists (`O_APPEND|O_WRONLY`), else recreate via step a. Do **NOT** run the retention/`chmod` sweeps — the date did not change.

   When a reopen is needed (either trigger):
   - **(First-run migration guard — clean slate.)** Before swinging the symlink, if `portal.log` exists as a **regular file** (`lstat` shows it is not a symlink), `os.Remove` it; also `os.Remove` any `portal.log.old`. This deletes pre-migration legacy logs on the first run under the new system (the old logger left a regular-file `portal.log` + single `.old`). After the first run `portal.log` is always a symlink, so this guard never fires again.
   a. Open `${stateDir}/portal.log.<today>` with `O_CREAT|O_EXCL|O_APPEND|O_WRONLY`, mode `0600`.
   b. On `EEXIST`, retry with `O_APPEND|O_WRONLY` (lost the cross-process create race; another writer beat us).
   c. Swing the symlink `${stateDir}/portal.log → portal.log.<today>` atomically. The temp link is **pid-scoped** — `portal.log.<pid>.symlink.tmp` — so cross-process swings can never collide on the tmp name (a single process performs at most one swing at a time, so no counter is needed); if this pid's own tmp already exists from a prior crash, `os.Remove` it and recreate. Then `os.Symlink(target, pidTmp)` + `os.Rename(pidTmp, link)` — `Rename` is atomic and last-writer-wins, and every racer's target is identical (`portal.log.<today>`), so a concurrent swing is benign. A tmp leaked by a crash between `Symlink` and `Rename` is reclaimed best-effort on the same pid's next swing — the retention sweep's strict date-parse skips it, so no sweep reclaims it.
   d. `chmod 0400` any other `portal.log.<date>*` files in `${stateDir}` that are not `<today>` and not already mode 0400. **Strict date-parse, skip otherwise:** only files whose date portion parses as a valid `YYYY-MM-DD` (the `portal.log.<date>` / `portal.log.<date>.<N>` shapes) are candidates; any other `portal.log.*` sibling — the `portal.log.<pid>.symlink.tmp` swing temp, the `portal.log.swept.<date>` sentinel, any future non-log sibling — is **skipped** (never `chmod`'d). This keeps a leaked symlink temp writable so its best-effort reclamation isn't bricked by a `0400`.

3. After fd is open, check `current_size + len(serialized) >= PORTAL_LOG_ROTATE_SIZE`. If true, rotate to `portal.log.<today>.N`:
   a. Find max existing `N` for today (`portal.log.<today>.*` listing); next N = max + 1, or 1 if none.
   b. Open `portal.log.<today>.<N>` with `O_CREAT|O_EXCL|O_APPEND|O_WRONLY`.
   c. On `EEXIST`, retry with `N+1`.
   d. Swing the symlink to the new file (same pid-scoped-tmp + atomic-rename procedure as step 2c). **Do NOT `chmod 0400` the previous segment**: it is a *same-day* file, a peer process may still hold an open `O_APPEND` fd on it (`chmod` does not evict an already-open writer on Unix), and it is part of today's active write surface. Same-day segments are sealed only when the day rolls over — the next day's step 2d sweep `chmod 0400`s all of yesterday's segments at once. A peer that didn't observe this size-cap rotation simply keeps appending to the prior same-day segment; that splits today's writes across two readable same-day files (the symlink points at the newest), which is acceptable — the size cap is a disk-fill valve, not a correctness boundary.

4. Write the serialized record to the now-current fd.

This applies to ONE seam: the `slog.Handler` in `internal/log`. No call site outside that package implements rotation logic.

### Resolved operational edges

- **DST / timezone.** "Local midnight" is the instant `time.Now().Format("2006-01-02")` yields a new date in the machine's local timezone. Rotation keys on the date **string**, not elapsed duration — so DST 23/25-hour days and mid-life timezone changes are handled by construction: a repeated date appends to the existing file, a forward jump opens a new file. No special handling.
- **Version upgrade mid-day.** Same date → same file; the new binary's `version` baseline attr simply changes per-record. No special handling.
- **Missed-day catchup.** Solved by construction — any waking process's first write opens today's file, and step 2d `chmod 0400`s ALL past-day files at once, so a multi-day downtime gap is caught up in a single sweep.
- **First-startup migration.** Clean slate (see step 2 migration guard): legacy regular-file `portal.log` and `portal.log.old` are deleted on first run. Pre-migration history is not preserved.
- **Disk-full / `EACCES` / write failures.** Logging never crashes portal (the logger owns no control flow). On open or write failure the handler is best-effort: it attempts a single stderr fallback write for the record, otherwise drops it, and the process continues. `chmod` / `unlink` failures during the day-roll-over and retention sweeps are WARN-and-skip (never abort the sweep). A failed symlink swing leaves the prior symlink in place; writes continue to the open fd.

### Hot-path cost

The unbuffered-writer constraint (see Defensive invariants) means every record is its own `write(2)`, and the per-`Handle` rotation logic runs on the daemon's 1 Hz tick goroutine. This is intentionally not moved off the hot path — the cost is negligible:
- **Steady state:** at INFO the daemon emits ~1 line/tick; one unbuffered `write(2)` to an `O_APPEND` fd is microseconds.
- **Midnight maintenance:** the first record after local midnight does the symlink swing + `chmod 0400` past-day sweep + retention sweep — a directory listing plus a handful of `chmod`/`unlink` calls, sub-ms to low-single-digit-ms, **once per day**, well within the 1 s tick / 3 s self-supervision budget.
- **Gating:** the single-winner sweep gate (see Retention policy) means only one process per host runs the midnight sweep, so the daemon frequently pays zero sweep cost.

---

## Retention policy and audit

### Decision

- Default retention: **30 days** of rotated history kept on disk.
- Configurable via `PORTAL_LOG_RETENTION_DAYS`. Invalid values (non-integer, negative, > 365) fall back to default with a startup WARN.
- Per-deletion INFO breadcrumb, one line per deleted file: `log-rotate: deleted path=<file> retention=<N>`. `grep 'log-rotate:' portal.log` reconstructs the rotation history.
- Nothing outside the automatic per-day sweep touches rotated logs, bar `portal doctor --fix`, which forces a full sweep as unconditional maintenance.

### Mechanical rule — the retention sweep

Runs on the first `Handle(record)` of each calendar date (the date-change trigger from the rotation rule), **after** today's file is opened. The handler attempts to claim the day's sweep; only the winner runs it:

0. **Single-winner gate.** Create `${stateDir}/portal.log.swept.<today>` via `O_CREAT|O_EXCL`. On `EEXIST`, another process already owns today's sweep — **return immediately, run nothing, emit nothing.** On success, this process owns the sweep; proceed. (Same single-winner `O_EXCL` primitive the rotation rule uses.) Only *today's* sentinel is meaningful; prior-day sentinels are pruned in step 3.
1. `cutoff := today.AddDate(0, 0, -PORTAL_LOG_RETENTION_DAYS)`. Default `PORTAL_LOG_RETENTION_DAYS = 30`. Invalid env value (non-integer, negative, > 365) → use default and emit one WARN: `log-rotate: invalid PORTAL_LOG_RETENTION_DAYS raw="<v>" retention=30`.
2. List `${stateDir}/portal.log.*` files. **Strict date-parse, skip otherwise:** keep only filenames that parse as `portal.log.<YYYY-MM-DD>[.<N>]`; any sibling whose date portion does not parse (the `portal.log.<pid>.symlink.tmp` swing temp, the `portal.log.swept.<date>` sentinel, any future non-log sibling) is **skipped: never deleted.** For each surviving file whose date < `cutoff`:
   a. Emit one INFO line BEFORE deletion: `log-rotate: deleted path=<file> retention=<N>`.
   b. `os.Remove(file)`. On error, emit one WARN with `error` attr and continue (don't abort the sweep).
3. **Prune stale sentinels.** Unlink any `portal.log.swept.<date>` sentinel whose `<date>` ≠ `today`. On error, WARN and continue. (This is why step 2 excludes `portal.log.swept.*` from the date-cutoff walk: sentinels are pruned here by an exact "not today" rule, not by the retention cutoff.)
4. The sweep is best-effort. The single-winner gate (step 0) means it runs at most once per host per day, so the duplicate-INFO / duplicate-WARN floor from N concurrent process startups (the reboot-storm case) cannot occur.

**Why single-winner rather than re-entrant no-op:** every process's first log call of the day is its `process: start` line, so without the gate ALL ~32 reboot-morning processes would each emit the same deletion INFO lines and 31 would then hit `os.Remove` "already gone" WARNs — 32× audit noise on exactly the forensic surface this feature exists to keep clean. The gate makes the deletion breadcrumbs single-sourced.

**Winner-completion semantics.** The sweep (steps 0–3) runs **synchronously inside the winner's first-of-day `Handle`**, and that first `Handle` is the `process: start` line emitted *during* `log.Init` — before the process does any work or `syscall.Exec`s. So even a short-lived winner (a bootstrap that hands off, a hydrate helper that exec's into the shell) completes the whole sweep before it exits; the exec does not preempt it. The gate guarantees **at-most-once per host per day**; the only failure of **at-least-once-completed** is a winner SIGKILL'd or crashing *mid-deletion-loop* (sentinel created, deletions partial). That is an **accepted risk**: retention is a disk-space bound, not a correctness boundary, so a partial sweep merely leaves a few extra rotated files until the next day's fresh winner sweeps — it self-heals, at ~tens-of-MB cost. A resumable sentinel was considered and rejected as disproportionate complexity for a harmless one-day slip.

**`portal doctor --fix` integration:**
- `portal doctor` (read-only diagnosis): preserves rotated logs; does NOT trigger the sweep.
- `portal doctor --fix`: triggers the sweep with `cutoff = today` (delete every rotated file, leaving only the current one). **BYPASSES the step-0 single-winner gate** — it is an explicit, deliberate user invocation and must always run regardless of any `portal.log.swept.<today>` sentinel; the gate exists only to dedupe the automatic per-process-startup sweep. It also removes every `portal.log.swept.*` sentinel, today's included. It is unconditional maintenance rather than the repair of a diagnosed condition: there is no stale-logs check to fail.

This applies to ONE seam: the `slog.Handler` in `internal/log` (and `portal doctor --fix`, which calls into the same sweep function).

### Resolved operational edges

- **Breadcrumb placement across midnight.** The sweep runs *after* step 2 opens today's new file, so all deletion INFO lines (and the retention WARN) land in today's file — never in the file being aged out.
- **Open-fd vs retention unlink.** Resolved by construction. No portal writer holds an fd older than the current day (every `Handle` re-checks the date and reopens onto today's file within ~1 tick of midnight), and retention only deletes files older than the cutoff (≥ 30 days). So a retention `unlink` never races a live writer's fd — no zombie-writer-into-deleted-inode hazard.
- **Compression of rotated logs.** Out of scope (rejected). Worst-case 30-day window (~600 MB uncompressed at DEBUG) is trivial; `zgrep` friction at investigation time outweighs the disk saving.
- **Out-of-band audit channel** (separate `portal-rotation.log`). Out of scope (rejected). Rotated-file immutability + per-process start markers + `O_EXCL` first-of-day open provide sufficient post-hoc detectability for portal's scale.

---

## Defensive invariants against log destruction

### Decision

The rotation/retention machinery is robust against the *known* destruction mechanism (1 MiB rotation churn). The 2026-05-28 incident also evidenced a second, still-unidentified path that can zero today's `portal.log`. These invariants do not root-cause it — they make any such destruction **detectable and recoverable** after the fact.

Three invariants. The first two are enforced inside the rotation handler (re-stated here for completeness; their authoritative rule lives in *Log rotation mechanism*). The third is new.

**Invariant 1: Rotated-file immutability.** Files older than today are `chmod 0400` so even a buggy library can't overwrite past evidence. The destruction surface narrows to today's file only.

**Invariant 2: `O_CREAT|O_EXCL` on first-of-day open.** Every process's first write of a day creates `portal.log.<today>` via `O_CREAT|O_EXCL` (append-fallback on `EEXIST`). If something deletes today's file mid-day, the next writer's create-or-append races safely and observably. An *already-open* writer (notably the long-lived daemon) recovers too: its per-`Handle` inode-identity check detects that its fd's inode no longer matches the `portal.log` symlink target and reopens onto the live file — so a mid-day deletion is both detectable (start-marker tripwire) AND non-lossy going forward, rather than the daemon silently writing into an orphaned inode.

**Invariant 3 (new): Per-process lifecycle markers.** Every portal process emits ONE INFO line at the very start of its execution and ONE INFO line on termination. These are the tripwires that make destruction visible: if today's `portal.log` contains only lines from 09:15 forward but you know portal was running before, the first line of today's file is a `process: start` marker that timestamps when destruction had to have happened.

### Mechanical rule — `process: start`

`internal/log.Init(stateDir, version, processRole)`, after constructing the root logger and wiring the rotating handler, MUST emit exactly one INFO line as its final action before returning:

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

(`pid`, `version`, `process_role` are baseline attrs auto-injected; the call site does not pass them.)

### Mechanical rule — `process: exit` and the `main` exit shape

`internal/log` exposes `func Close(exitCode int)` — a marker-emitter that computes `took` from the package-private `startTime` (captured at `Init`) and emits one INFO line. **`Close` does NOT call `os.Exit`; the logger owns no control flow.**

```go
log.For("process").Info("exit",
    "code", exitCode,
    "took", time.Since(startTime),
)
```
```
2026-05-30T14:00:02Z INFO process: exit code=0 took=2.1s pid=12345 version=0.5.0 process_role=tui
```

**`main` owns the single `os.Exit`.** `os.Exit` skips deferred functions, so a Close-defer would miss Cobra's `Execute()`-error path — the most operationally-interesting termination class. The idiomatic shape (exit only in `main`, everything else returns a code/error):

```go
func main() {
    log.Init(...)
    code := 0
    panicked := false
    func() {
        defer func() {
            if r := recover(); r != nil {
                log.For("process").Error("panic", "reason", r)
                code = 2
                panicked = true
            }
        }()
        if err := rootCmd.Execute(); err != nil { code = 1 }
    }()
    if !panicked {
        log.Close(code) // emits process: exit code=N — skipped on the panic path
    }
    os.Exit(code)
}
```

- Exactly one terminal marker fires per run: `exit` on clean/error return, `panic` on a recovered panic. No double-emit, no defer-ordering ambiguity. On the panic path `process: panic` is the **sole** terminal marker — `Close` is skipped — so the four-way classification stays mutually exclusive.
- **Bare `os.Exit` is prohibited outside `main`** (PR-review reject) — every other function returns an error/code. This prohibition is the enforcement mechanism for "every termination is marked."
  - **One sanctioned exception — the daemon self-eject.** The daemon's self-supervision self-eject calls `os.Exit(0)` directly (it must not unwind through another capture/commit cycle on its way out). To stay marked, it FIRST emits `daemon: self-eject ticks=N threshold=N`, THEN calls `log.Close(0)` (which emits `process: exit code=0` and does not itself exit), THEN `os.Exit(0)`. So the termination is fully paired and the four-way classification holds. It does NOT run `daemonShutdownFunc`, so **no `daemon: shutdown` line fires on the self-eject path.**
- `Execute()` maps to a return code rather than calling `os.Exit` inside.

**Coverage requirement:** every binary entry point (currently only `main.go`) calls `log.Init` before any other portal code that might log, and routes all termination through the `main` shape above.

### Mechanical rule — exec-handoff markers

`syscall.Exec` overwrites the process image, runs no deferred functions, and never returns — so `Close` never fires. The bare-shell `portal open` happy path (`AttachConnector` → `tmux attach-session`) is exactly this, and it is portal's *most common* termination. Without a marker, a benign tmux handoff leaves an unpaired `process: start` indistinguishable from a destructive mid-flight kill.

**Every `syscall.Exec` call site MUST emit a plain `exec`-terminal INFO line immediately before the exec, under its owning component.** No logger-owned helper — the call site uses the ordinary logger then performs its own `syscall.Exec`. Because the writer is unbuffered, the marker is already in the kernel before the image is replaced.

```go
// At the AttachConnector call site, immediately before syscall.Exec:
log.For("process").Info("exec", "target", "tmux", "args", strings.Join(argv, " "))
syscall.Exec(tmuxPath, argv, env)
```

- `AttachConnector` (bare-shell `portal open` → tmux) emits `process: exec target=tmux args="attach-session -A …"`. This is binary-level lifecycle, so `exec` joins `start` / `exit` / `panic` in the **`process` component's event space**.
- The hydrate helper's pre-`syscall.Exec` marker is `hydrate: exec` (see *Hook-firing observability limit*) — same pattern, component-owned. This rule generalises it to the remaining exec site.

This yields a clean four-way terminal classification of any `process: start`:

| Followed by | Meaning |
|---|---|
| `process: exit` | Normal return (via `Close`) |
| `process: exec` | Clean handoff to another image — no exit line expected (benign) |
| `process: panic` | Crash, but recorded |
| *nothing* | Genuinely alarming — process vanished without a terminal marker; investigate |

**Externally-killed-process footnote.** A process killed by an uncatchable signal (the kill-barrier's SIGKILL escalation) runs no code, so it emits no terminal marker — its `process: start` looks unpaired. That is not the alarming case when the kill was deliberate: **the killer records it.** Bootstrap emits `saver: kill-barrier started/escalated target_pid=X` and `saver: placeholder died`. So: **an unpaired `process: start` is alarming only if no `saver:`/`daemon:` line names that pid as an external kill.** (The daemon's clean self-eject calls `os.Exit(0)` directly but first emits `daemon: self-eject` and then `process: exit code=0` via `log.Close(0)` — see the sanctioned exception above — so it is paired.)

### Flush — unbuffered writer constraint

Flush reduces to "do not buffer the log writer." The rotation handler writes directly to the `*os.File` (`O_APPEND`) with no `bufio` wrapper, so a marker is already in the kernel by the time `Info(...)` returns. `os.Exit` and `syscall.Exec` do not discard kernel buffers, so the bytes survive for a later reader — no `Sync()`/flush API and no logger-owned atomic exit/exec helper are needed. **Unbuffered writer is a locked constraint on the rotation handler.**

### Lifecycle markers bypass the level filter

The `process`-component lifecycle set — `start`, `exit`, `exec`, `panic`, and `log-level resolved` (see *Log-level propagation verification*) — is emitted **unconditionally by the custom handler, regardless of `PORTAL_LOG_LEVEL`.** These are forensic tripwires (and, for `log-level resolved`, a test anchor), not ordinary application logging. At `PORTAL_LOG_LEVEL=warn`/`error` a normal INFO line would be filtered — which would falsify the "always-present tripwire" guarantee and hide the line that proves the resolved level took effect. The handler special-cases this `process` lifecycle set to write through the level gate. They remain semantically INFO for every other purpose (no ERROR pollution).

### Notes

- **`SwitchConnector` (in-tmux path) is unaffected** — it runs `tmux switch-client` as a subprocess and returns normally, so it gets a proper `process: exit` via `Close`. Only true `syscall.Exec` replace-process sites need the exec marker.
- **Privacy on `args` attr: verbatim.** CLI commands like `portal hooks set --on-resume "claude --resume X"` will have the full args string in `portal.log`. Acceptable for portal's single-user threat model.

---

## Log-level propagation verification

### Decision

Every portal process emits exactly one additional INFO line as part of its lifecycle init, declaring the resolved log level and how it was resolved. Tests that depend on a specific log level for coverage assert on this line. This closes the silent-degradation gap: if `PORTAL_LOG_LEVEL` fails to propagate (tmux clears it on `respawn-pane`, or a harness forgets to pass it), DEBUG coverage degrades but the test still passes with less output than expected — unless it asserts on this positive marker.

### Mechanical rule

`internal/log.Init(stateDir, version, processRole)` MUST emit one INFO line immediately AFTER the `process: start` line and BEFORE returning:

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

This line is emitted **unconditionally** — it bypasses the level filter (see *Defensive invariants* § "Lifecycle markers bypass the level filter") — so the assertion holds even when the test deliberately sets a non-INFO level like `warn` or `error`.

### Test assertion contract

Any integration test that sets `PORTAL_LOG_LEVEL` MUST scan `portal.log` for the `process: log-level resolved resolved=<expected> source=env` line for the spawned process (matched by `pid` attr if multiple processes were involved). If the line is absent or `source` is not `env`, the test fails — the env var did not propagate.

A canonical assertion helper lives in `internal/portaltest`:

```go
// AssertLogLevelResolved scans portal.log for the process: log-level resolved
// line matching the given pid and asserts the resolved level matches expected
// with source="env". Used by integration tests that set PORTAL_LOG_LEVEL.
func AssertLogLevelResolved(t *testing.T, logPath string, pid int, expected string)
```

This helper closes the env-propagation gap for ALL daemon-spawning integration tests, not just the test that motivated the assertion.

**Coverage requirement:** every binary entry point that calls `log.Init` automatically emits this line; no separate per-entry-point work needed. The propagation assertion is the test-side coverage requirement.

---

## State-mutation audit trail for user config files

### Decision

Every mutation of a portal-owned user-config file leaves a breadcrumb in `portal.log` so that `grep "<component>:" portal.log` reconstructs the change history.

**Files in scope (closed set):**
- `hooks.json` (component `hooks`)
- `aliases` (component `aliases`)
- `projects.json` (component `projects`)

`sessions.json` is **out of scope** — it's daemon-managed high-frequency state (mutated every tick), covered by cycle summaries (one INFO per tick under `daemon` / `capture`, not per-write).

### Seam — the per-file store's mutation methods

The seam is each store's mutation methods (`hooks.Store`, the alias store, the project store — their `Set` / `Rm` / `CleanStale`), **NOT `AtomicWrite` and NOT the callers.** Each config file is fronted by exactly one store, and every mutation flows through that store's methods. The store is the chokepoint that (a) knows the `op` and the affected key and (b) is the single place per file where the breadcrumb can't be forgotten. The generic `internal/fileutil.AtomicWrite` primitive stays audit-unaware — it is shared with out-of-scope `sessions.json` and has no `op`/key semantics — so logging does NOT live inside it, and it does NOT live scattered at each caller (the forgettable "log in every controller" anti-pattern). This is the model-observer layer, not the controllers.

**One sanctioned exception: `migrateConfigFile`.** The one-shot migration in `cmd/config.go` is a directory-to-directory file *move*, not a store mutation — it never flows through a store's `Set`/`Rm`, so under the store-method seam the `migrate` op would have no emitter. But a config directory relocating out from under the user is exactly the "a file changed and I don't know why" event this audit trail exists to explain, so `migrateConfigFile` is named as an **explicit, enumerated emission site**: it emits one INFO per migrated file under that file's owning component (`hooks` / `aliases` / `projects`) with `op=migrate via=migrate`. This is the *only* sanctioned non-store emitter; no other caller-level emission is permitted. **PR timing:** it lands in PR 2 with the rest of the state-mutation work, so a migration firing during the PR-1-only window goes unlogged — an accepted caveat (the migration is a rare idempotent one-shot most existing users already ran, and the move is otherwise observable via file mtimes and `process:` markers).

### Mechanical rule

Every mutating method of an in-scope config store emits, immediately after the underlying `AtomicWrite` returns to it:

- On `error == nil`: ONE INFO log line.
- On `error != nil`: ONE WARN log line.

The line's component (prefix) is the store's owning component: `hooks` / `aliases` / `projects`.

**Required attrs:**
- `op` — drawn from the closed value space below.
- Key identifying the affected entry: `hook_key` (hooks), `alias` (aliases), `project` (projects).
- On failure (WARN path): `error_class` from the closed AtomicWrite failure space below.

**Optional attrs:**
- `value` — verbatim new value for `set` / `modify`; absent for `rm` / `clean-stale`.
- `via` — `cli` for user-facing commands, `internal` for code-driven mutations (e.g. `CleanStale`), `migrate` for the one-shot `migrateConfigFile` path.

**Closed `op` value space:**

| `op` value | Meaning |
|---|---|
| `set` | Create new entry (key did not exist before this write) |
| `modify` | Update existing entry (key existed; value differs) |
| `rm` | Remove existing entry |
| `clean-stale` | Internal cleanup of an entry (always batched) |
| `migrate` | One-shot migration from old config path |
| `set-noop` | `set` where the entry already exists and the value matches (DEBUG only) |

**Closed `error_class` value space for AtomicWrite failures (per phase):**

`write-failed-temp-create` / `write-failed-write` / `write-failed-fsync` / `write-failed-rename`

**Which `error_class` space applies at which WARN site:**
- A **whole-mutation WARN** (the store's `AtomicWrite` itself failed, so the write did not persist) carries `error_class` from the AtomicWrite phase space above (`write-failed-*`).
- A **per-entry batch WARN** (one entry failed to process mid-loop while the batch continues) carries `error_class=unexpected` — the swallowed-error classification from the level-discipline table, since that entry's unit of work was dropped.

The two never overlap: phase values describe a failed persist of the whole file; `unexpected` describes a single dropped per-item operation.

**No-op handling:** a `set` call where the entry already exists and the value matches → DEBUG with `op=set-noop`. NOT INFO. Matches the level-discipline placement clarification for idempotent no-ops.

**Batch operations** (e.g. `CleanStale` iterating entries):
- Per-entry DEBUG inside the loop.
- ONE INFO summary at the end of the batch with attrs `op=<batch-op>`, `entries=N`, and `entries_failed=M` if any per-entry failures occurred.
- Per-entry WARN with `error_class=unexpected` on per-entry failure mid-loop (regardless of whether the batch continues).

This applies the hysteresis-trip pattern to mutation batches: detail at DEBUG, summary at INFO, exceptions at WARN.

### Privacy posture: verbatim

Hook commands, alias values, project paths logged as-is. Threat model accepted: portal is a single-user dev tool; `portal.log` lives on the same disk as the config files, which already store these values plaintext. Users sharing logs in bug reports redact manually (same posture as `hooks.json` itself).

---

## Diagnostic context preservation at boundaries

### Decision

Every external-boundary call site MUST preserve stderr / errno / phase-of-failure context in the wrapped error returned to callers. Discarding stderr is the most common form of "we lost the debug context exactly where we needed it most" (the cycle-1 review of `slow-open-empty-previews-and-zombie-sessions` surfaced `defaultIdentifyPS` discarding stderr on failure). This subtopic governs error *wrapping* at external boundaries; the level discipline + call-site pattern then determine how the wrapped error reaches `portal.log`. Together they guarantee: when an external call fails, the failure context survives all the way to the log line.

### Mechanical rule — four boundary classes

**Boundary class 1: `exec.Cmd`** (e.g. `internal/state/daemon_identity.go`, `internal/tmux/commander.go`).

Every call site MUST either use `cmd.CombinedOutput()` OR capture `cmd.Stderr` into a `bytes.Buffer` before `cmd.Run/Output`. On error, the wrapped error MUST embed both the exit status (or signal) and the trimmed stderr text:

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

**Boundary class 2: `internal/tmux.RealCommander.Run` / `RunRaw`** (the wrapper layer for all tmux execution).

The commander MUST capture both stdout and stderr on every invocation. On non-zero exit:
- The returned error MUST embed the exit code, the tmux argv, and the trimmed stderr text.
- Tmux-specific sentinel errors (`ErrNoSuchSession`, `ErrEmptyPaneList` per `internal/tmuxerr`) MUST be detected via the stderr text and wrapped with the sentinel using `fmt.Errorf("%w: %s", sentinel, stderr)`.

PROHIBITED: returning a generic error from a tmux invocation without the stderr context.

**Boundary class 3: `os` package syscalls** (`os.Stat`, `os.OpenFile`, `os.Rename`, `os.Remove`, etc.).

Go's `os` package wraps syscall errors with path + errno text by default (e.g. `open /tmp/x: permission denied`). Do NOT replace these with a wrapper that loses the path/errno context. When adding context, use `fmt.Errorf("...: %w", ..., err)` so the underlying error is preserved verbatim and accessible via `errors.Unwrap`.

PROHIBITED: `return errors.New("file operation failed")`-style wrapping that discards the original `*os.PathError`.

**Boundary class 4: stdlib `io` / `bufio` / scrollback FIFO reads** (`internal/state/scrollback.go`, hydrate helper FIFO reads).

EOF and timeout conditions are valid expected outcomes, not boundary failures — they take the `expected` classification in the level discipline. Other I/O errors (read error mid-stream, write error mid-write) wrap with `fmt.Errorf("read %s: %w", path, err)` to preserve path context.

### slog attr usage at the eventual log site

```go
logger.Warn("tmux command failed", "error", err, "session", sessionName)
```

The `"error"` attr value MUST be the wrapped error directly (`err`, not `err.Error()`); slog handles serialization. The custom handler renders the full chain of wrapped messages including the stderr text.

### Boundary helper (allowed shared idiom)

After 3+ identical boundary-wrapping patterns appear in production code, a shared helper in `internal/log` MAY be added:

```go
// CombinedOutputWithContext runs cmd and returns its stdout. On error,
// returns a wrapped error embedding exit status, argv, and trimmed stderr.
func CombinedOutputWithContext(cmd *exec.Cmd) ([]byte, error)
```

Until 3+ sites need it, write the wrapping at each call site directly.

### Enumerated gap-closure sites (existing-code defects to instrument)

Four pre-identified defects in existing code MUST be closed as part of this work. They are named explicitly because a purely-mechanical level/boundary pass can skip a site where nothing about the code shape forces a new log call:

| Site | Defect | Fix |
|---|---|---|
| `defaultIdentifyPS` (`internal/state/daemon_identity.go`) | stderr discarded on failure | Boundary class 1 — embed trimmed stderr in the wrapped error (the worked example already shown above) |
| `escalateKillToSIGKILL` (`internal/tmux/portal_saver.go`) | no breadcrumb on the SIGKILL escalation path | DEBUG breadcrumb at the escalation decision, beneath the `saver: kill-barrier escalated` INFO lifecycle event |
| `ShowGlobalHooks` | failure-log asymmetry — one branch logs, the sibling failure path does not | add the missing WARN on the unlogged failure branch per the level-discipline table |
| Defensive branches (various) | branch exists for a non-obvious reason, uncommented | add a "why this branch exists" **code comment** (not a log line) |

---

## Cycle-level summary cadence and shape

### Decision

Every cycle in portal emits ONE INFO summary at completion, with per-item events emitted at DEBUG (steady state) or WARN (anomaly). An operator reconstructs what happened over a window from the summaries without scrolling through per-event lines; per-event WARNs still fire on anomalies.

### Mechanical rule

A "cycle" is a function or method whose body matches one of these shapes:
1. **Loop cycle** — a `for` loop iterating distinct items (sessions, panes, files, entries, orphans).
2. **Sequence cycle** — an orchestrator running discrete named steps (the ten-step bootstrap orchestrator, the two-phase restore engine).
3. **Tick cycle** — a periodic loop driven by a ticker (the daemon's 1 Hz capture loop).

For every cycle, the function/method MUST:
1. Capture `start := time.Now()` before the loop / sequence / tick body.
2. Track counts of items processed and per-item anomalies (failures that did not terminate the loop).
3. At the end of the cycle body (just before the function returns / the tick completes), emit exactly ONE INFO line:

```go
logger.Info("<verb> complete",
    "<unit>", count,
    // additional sub-category counts as relevant, e.g.:
    "natural_churn", churnCount,
    "anomalous", anomCount,
    "took", time.Since(start),
)
```

Where:
- `<verb>` is the cycle's purpose phrase: `tick`, `sweep`, `step`, `phase`, `orchestration`, `replay`, etc.
- `<unit>` is the item being iterated, drawn **only** from the closed cycle-summary keys: `sessions`, `panes`, `entries`, `steps`. Sweeps report their outcome keys instead (`reaped` / `killed` / `skipped` / `unset`). A new unit key requires a vocabulary amendment — do not invent one ad hoc.
- Additional sub-categorisation counts ride as attrs on the same summary line. Defined counts: `natural_churn` — items that ended cleanly mid-cycle by normal action (e.g. a session the user closed during the tick), distinct from a capture failure; `anomalous` — items that failed anomalously without terminating the cycle (each also emits a per-item WARN); `entries_failed` — per-item failures within a batch operation.
- `took` is always present.

**Per-item event level inside a cycle:**
- Per-item DEBUG breadcrumb ALWAYS for items where the per-item path is interesting (the capture loop's per-pane state, the bootstrap step's invocation). These flood at DEBUG and are silent at INFO — the summary is the INFO truth.
- Per-item WARN ONLY for items that fail anomalously (count goes into the summary's `anomalous` attr).

### Concrete cycle catalog (sites this rule mandates a summary at)

| Cycle | Owning component | Summary line shape |
|---|---|---|
| Daemon tick (1 Hz capture + commit) | `capture` | `capture: tick complete sessions=N panes=N natural_churn=N anomalous=N took=T` |
| Bootstrap orchestration | `bootstrap` | `bootstrap: orchestration complete steps=11 warnings=N took=T` |
| Each bootstrap step | `bootstrap` | `bootstrap: step complete step=<StepName> took=T` |
| Restore phase A (skeleton) | `restore` | `restore: skeleton complete sessions=N windows=N panes=N took=T` |
| Restore phase B (geometry + replay) | `restore` | `restore: geometry complete panes=N took=T` |
| Orphan FIFO sweep | `clean` | `clean: orphan-fifo sweep complete reaped=N skipped=N took=T` |
| Orphan daemon sweep | `clean` | `clean: orphan-daemon sweep complete killed=N took=T` |
| Marker cleanup | `clean` | `clean: marker sweep complete unset=N took=T` |
| Hooks CleanStale | `hooks` | (same batch-summary shape as *State-mutation audit trail*) |
| Retention sweep (rotated logs) | `log-rotate` | (same shape as *Retention policy*) |

Spec writers consulting this rule produce one INFO call site per cycle in the codebase, with the verb-phrase + counts + `took` triplet, matching the catalog shape.

---

## Saver and daemon lifecycle event taxonomy

### Decision

The closed catalog below covers every saver and daemon lifecycle event. Adding new events requires explicit amendment of this specification. Per-tick cycle summaries are covered by *Cycle-level summary* and don't reappear here.

### Mechanical rule

Every site listed below MUST emit exactly one INFO log line at the moment described. Each row specifies the component, msg, and required attrs. Optional attrs follow the general call-site rules.

**Saver lifecycle events (component: `saver`):**

| Site | msg | Required attrs |
|---|---|---|
| Bootstrap creates the `_portal-saver` placeholder pane | `placeholder created` | `tmux_pane`, `pid` (auto-baseline; the bootstrap process emitting this) |
| Bootstrap turns off `destroy-unattached` on the placeholder session | `destroy-unattached off` | `tmux_pane` |
| Bootstrap respawns the placeholder pane as `portal state daemon` | `respawn-daemon` | `from_pid` (placeholder pid), `to_pid` (daemon pid, post-respawn), `tmux_pane` |
| Bootstrap observes the daemon up and ready (after the 2s readiness barrier) | `daemon ready` | `target_pid` (the daemon pid), `version` (auto-baseline) |
| Bootstrap initiates the kill-barrier (Component A) for a prior daemon | `kill-barrier started` | `target_pid` (the prior daemon pid being killed) |
| Bootstrap escalates from `kill-session` to direct SIGKILL on the prior daemon | `kill-barrier escalated` | `target_pid`, `reason="kill-session-timeout"` |
| Bootstrap observes a saver pane's host process has exited (e.g. during the kill-barrier exit-poll) | `placeholder died` | `target_pid` (the dead pid), `reason` ∈ {`signal`, `exit`, `unknown`} |

**Daemon lifecycle events (component: `daemon`):**

| Site | msg | Required attrs |
|---|---|---|
| Daemon acquires `daemon.lock` (post-pre-check) | `lock acquired` | `pid` (auto-baseline), `tmux_pane` |
| Daemon's self-supervision counter increments toward eject | (no INFO — DEBUG per the level-discipline "hysteresis-internal failures" clarification) | n/a |
| Daemon's self-supervision counter trips threshold and ejects | `self-eject` | `ticks` (consecutive-absence count at trip), `threshold` (configured ejection threshold) |
| Daemon shutdown via the normal return path (SIGHUP, signal, normal exit) | `shutdown` | `reason` ∈ {`sighup`, `signal`, `exit`}, `flush_completed` (bool — whether the final commit completed). **Not emitted on the self-eject path** (which bypasses `daemonShutdownFunc` — see *Defensive invariants* § sanctioned exception). |

### Process/subsystem boundary

`process:` owns the OS-process boundary (`start`/`exit`/`exec`/`panic`) for *every* role, including the daemon — emitted by `Init`/`main`. `daemon:`/`saver:` lines are *additive subsystem milestones*, never a substitute for `process:`, and cover only moments `process:` cannot express. A redundant `daemon: spawn` event (it would fire at the same instant as `process: start process_role=daemon`, carrying the same data) is therefore **dropped**; its one unique attr (`tmux_pane`) moves onto `daemon: lock acquired`. The `saver:` catalog is unaffected — those lines are emitted by *bootstrap observing the saver from outside* (a different observer than the saver's own `process:` lines), so they are not redundant.

### Reason value spaces (closed)

- `kill-barrier escalated reason`: `kill-session-timeout` (only value today; new values require amendment).
- `placeholder died reason`: `signal` / `exit` / `unknown`.
- `daemon shutdown reason`: `sighup` / `signal` / `exit`. (`self-eject` is **not** a `daemon: shutdown` reason — the self-eject path emits `daemon: self-eject` + `process: exit` instead, see *Defensive invariants* § sanctioned exception.)

Reason value spaces are closed sets per event — spec writers MAY NOT introduce new reason values without amending this catalog.

### Per-tick events (NOT in this catalog)

Tick-rate events (capture loop, self-supervision probe) are NOT INFO. They're covered by:
- *Cycle-level summary* — one INFO per tick at the end of the daemon's capture-and-commit cycle (`capture: tick complete ...`).
- Level-discipline placement clarifications — per-tick probe failures are DEBUG; only the trip (self-eject) is INFO per this catalog.

### Calling code locations

- `cmd/bootstrap/` — all `saver:` lifecycle events (placeholder creation, respawn, kill-barrier, daemon-ready observation, and `placeholder died` — bootstrap observes the saver from outside, per *Subsystem prefix taxonomy* § Process/subsystem boundary).
- `cmd/state_daemon.go` — daemon lifecycle (`lock acquired`, `self-eject`, `shutdown`). The daemon's process startup is marked by `process: start process_role=daemon`, not a `daemon:` event.
- `internal/tmux/portal_saver.go` — kill-barrier escalation.

---

## The `theme` component event catalog

### Decision

The closed catalog below covers every `theme` event. Adding new events requires explicit amendment of this specification, exactly as the saver/daemon catalog does.

The component earns its place on one argument: **a launch that could not use the theme the user asked for should leave a passive record.** The panel's row is only visible if the user opens the panel, and `portal doctor`'s line only if the user runs it — the log is the only trail that exists without the user going looking. That is also what separates `theme` from `prefs` and `terminals` (see *Closed component value space*): those are dumb stores, while the theme loader has parse / validate / fallback **outcomes**.

Two rules are part of the amendment rather than call-site detail:

1. **Rejections are WARN, not INFO.** `portal doctor` treats a rejected theme as advisory for *exit-code* purposes, but "your config did not work" is a warning in a log; the exit-code posture and the log level are separate decisions and do not have to agree.
2. **The component records where a theme is *used*, never where one is *diagnosed*.** `portal doctor` and `portal theme export` both enumerate or parse and can hit every rejection reason — and **neither emits a single `theme` event**; nor does the offline `capturetool`. Three reasons compound: the log's job is to be the record that exists without the user looking, and those commands *are* the user looking (their whole output is the diagnostic); doctor is the run most likely to hit a full reject set, so emitting there would put the largest WARN volume on the surface needing it least; and a read-only diagnosis command that writes WARNs about the state it just printed is exactly the side effect its read-only claim rules out. It also makes the per-process dedup below determinate — the emitting processes are TUI launches, and nothing else.

### Mechanical rule — the catalog

| Event | Level | Cadence and deduplication | Attrs |
|---|---|---|---|
| `loaded` | INFO | One line per **resolved slot** at TUI construction — one under a constant setting, two under an adaptive pair — plus the one load that happens outside construction: the newly-live opposite slot when a mid-session commit converts a constant into an adaptive pair. **Not deduplicated** — it is per *load*, not per condition. The panel's re-resolutions (open, `Esc`, the post-commit recompute) resolve a setting construction already reported and emit no `loaded` line. | `slug`, `slot` where one applies |
| `enumerated` | INFO | Once per **panel open** — the enumeration re-reads the directory on every open, and one open is one line, so five opens are five lines. Fires on an absent themes directory and on an unusable one alike: the panel opened either way, which is what the event records. An open refused by the **post-enumeration floor re-check** — the second check, run with the real `DirUnusable`, whose warning row raises the height floor by one — also emits it: that enumeration ran before the refusal, so the line records a read that genuinely happened. A refusal at the **entry gate** emits nothing, because it precedes the enumeration entirely. **Not deduplicated** (a per-event INFO, not a repeated warning). | `count`, `rejected` |
| `rejected` | WARN | One per rejected file, from the enumeration. **Deduplicated per process on `slug`+`reason`, or `path`+`reason` where the file yields no slug** (the `bad name` class, whose filename produces no usable identity — without the `path` half, the class most likely to recur across opens would be the one class with no dedup key). | `slug` or `path`, `reason`, `token` where the reason names one |
| `directory unusable` | WARN | The themes directory is unreadable, or a regular file sits where a directory belongs. Emitted by **both** the panel's enumeration and the construction-time by-name read, which is what gives a user who never opens the panel a record at all. **Deduplicated per process on `path`+`reason`**, which is what stops the two paths double-reporting. An **absent** directory emits nothing — zero drop-ins is the common case, not a fault. | `path`, `reason` |
| `fallback applied` | WARN | A nominated theme would not load and the mode-matched shipped default stood in. **Deduplicated per process on `slug`+`reason`**: a persistently broken active theme re-resolves at construction, again on every panel open and again on every `Esc`, and "per fallback" read literally would turn a forensic trail into running commentary. | `slug` (the nomination that **failed**), `slot` where one applies, `reason` |
| `appearance migrated` | INFO | One-shot, emitted **only on a successful persist that actually wrote a theme key** — never on compute (the write is best-effort and retries, so a compute-time emission could legitimately fire on several consecutive launches and "one-shot" would be false) and never on a marker-only write (which translated nothing). A failed, skipped or never-completed write emits nothing at all: **the absence of the event is the failure signal.** | `slug` (no `slot` — the translation always writes a constant) |
| `commit failed` | WARN | Per failed write, from the theme persister behind the panel's commit. A successful commit emits nothing. The migration path deliberately does **not** emit it — its failure signal is the absence of `appearance migrated` — which keeps this event single-sited. | `slug`, `slot` (absent when committing a constant), `reason` |

Two orderings are load-bearing. `fallback applied` is emitted **before** its paired `loaded`, so a reader meets the cause before the consequence. And `loaded` carries the slug of the palette that **actually rendered** — the fallback's, where one was applied — because if both events named the slug that failed, a `grep "theme:"` on a broken install could not answer which palette is on screen, which is the greppability the component is justified on.

The dedup key is `(event, identity, reason)`: the event is part of it so the catalogs cannot collide on a shared identity, and the reason is part of it because the same file reported for a *different* reason is a different problem and earns its own line.

### Mechanical rule — emission control

**Whether anything is written is the caller's decision, not the loader's.** The loader takes a logger seam and emits through it unconditionally; `cmd`'s one direct construction of that seam is the **real** component logger on the paths where a theme is *used* (TUI construction, the panel, the theme persister), while `portal doctor`, `portal theme export` and `capturetool` take **`theme.NewSilentLoader()`** — the constructor that builds the identical loader over a discarding seam, so the silent route is named once in the leaf rather than hand-assembled at each diagnosis-shaped call site. A silent caller runs the identical code path in silence — no branch, no flag, no second implementation to keep in step.

**The per-process dedup state lives on that injected logger**, not as package state in the leaf. One TUI process therefore shares one dedup scope across every path that enumerates — the construction-time by-name read and the panel's enumeration hit the same conditions and must not double up — while concurrent Portal processes each own their own, and a test controls it simply by injecting a fresh one. Check-and-record is one critical section, so two paths enumerating at once cannot both read "unseen" and both emit.

`internal/theme` **binds nothing**: the single `log.For("theme")` binding lives in `cmd`, and is what the seams on the used paths are constructed with — the diagnosis-shaped callers take `theme.NewSilentLoader()` instead (above). This is the seam case of the bind-once rule (see *Subsystem prefix taxonomy* § Consumer usage), and a second binding inside `cmd` is what a guard test exists to catch.

### Calling code locations

- `internal/theme` — `loaded`, `enumerated`, `rejected`, `directory unusable`, `fallback applied`, all through the injected seam.
- `cmd/config.go` — `appearance migrated`, from the persist half of the one-shot `appearance` → theme translation.
- `cmd`'s theme persister — `commit failed`, the panel's commit write. It is the only site: `prefs` is a leaf that must not import `internal/log`, and the TUI emitting it would make `internal/tui` a fourth emitting site.

**The exec path (`portal open <target>`) emits nothing**, because it constructs no TUI and discovery is lazy — the loader never runs there at all. On the path Portal is most careful to keep free of cost, this component adds nothing.

---

## Hook-firing observability limit (syscall.Exec)

### Decision

**No wrapper envelope.** Portal exec's hooks via `syscall.Exec`, replacing the helper process, so it can never observe the hook command's own exit status. We accept that architectural limit and instrument everything up to the moment of exec. The hydrate helper logs the lookup decision and the exec target as its terminal-point INFO; post-exec is silent by design. The wrapper-envelope option (capturing exit status via a shell envelope) is preserved as a future consideration but is explicitly NOT in scope.

With these lines, `grep "hydrate:" portal.log` reconstructs every helper invocation up to the exec moment.

### Mechanical rule

The hydrate helper (`cmd/state_hydrate.go`, the `execShellOrHookAndExit` function path) MUST emit log lines at three points in its exec chain.

**1. Hook lookup (DEBUG breadcrumb).** After the helper has computed the structural pane key and queried `hooks.json` for an on-resume hook, but BEFORE the exec call:

```go
hookLogger.Debug("hook lookup",
    "hook_key", paneKey,
    "result", lookupResult,  // "hit" | "miss" | "error"
)
```

Where `lookupResult` is `"hit"` if a hook was registered, `"miss"` if no hook for that pane_key, `"error"` if the lookup itself failed (parse error, etc.). On `"error"`, also include the `"error"` attr per *Diagnostic context preservation*. This DEBUG line distinguishes "hooks.json drifted from the saved hook-key" (miss) from "lookup failed for some other reason" (error) from "helper never reached the lookup" (no line at all).

**2. Exec terminal point (INFO).** Immediately before the `syscall.Exec` call:

```go
hookLogger.Info("exec",
    "target", execPath,        // the binary being exec'd (e.g. "$SHELL" or "sh")
    "args", argv,              // its argv (e.g. `-c '<HOOK>; exec $SHELL'`)
    "hook_present", hookFound, // bool
)
```

This INFO line is the terminal-point summary for the hydrate helper process (its last action before being replaced). It is **structurally parallel with `process: exec`** — both `syscall.Exec` handoff markers use `target` (the exec'd binary) + `args` (its argv), so `grep` on `target=`/`args=` gives a uniform "what did each process hand off to" view across `process: exec` and `hydrate: exec`. When `hook_present=true`, the helper exec's `sh -c '<HOOK>; exec $SHELL'`; when `false`, it exec's `$SHELL` directly. The hook content itself is in the prior INFO line written by `hookStore` mutations (the state-mutation audit trail), so it's reconstructible via grep history without redundant logging here.

(`target` is deliberately distinct from `path`, which remains reserved for the helper's genuine filesystem-path lines — `fifo missing path=…`, `scrollback missing path=…`.)

**3. Failure-mode INFO lines (the four exit paths from the inbox seed):**

| Exit path | Code shape (approx.) | Log call |
|---|---|---|
| Silent ENOENT — helper opened FIFO and got "no such file or directory" | `cmd/state_hydrate.go` ~line 120 | `hookLogger.Info("fifo missing", "path", fifoPath)`. **(Implementation erratum: a missing FIFO surfaces as an immediate ENOENT from the open and the helper hard-returns the wrapped error rather than exec'ing — so this row does NOT reach the exec handoff. The remaining three rows do exec.)** |
| Timeout — helper waited 3s, signal never arrived | ~line 115 | `hookLogger.Info("signal timeout", "took", hydrateTimeout)` then exec (where `hydrateTimeout` — the spec's working name for this 3s `time.Duration` constant — renders `took=3s`, not a quoted string) |
| Scrollback file missing | ~line 147 | `hookLogger.Info("scrollback missing", "path", scrollbackPath)` then exec |
| Success — signal arrived, scrollback dumped | ~line 188 | `hookLogger.Info("scrollback replayed", "bytes", n, "took", took)` then exec |

Each exit path's INFO is followed by the exec INFO (rule 2). Two INFO lines per invocation in the failure-mode cases, three in the success case (counting the lookup DEBUG, which is below INFO threshold in production). The repetition is intentional — the exit-path INFO captures *what happened in the helper*; the exec INFO captures *what we handed off to*.

(Line numbers are current-state hints; spec/plan phase pins exact ranges against the live file.)

### Wrapper envelope (NOT in scope)

A future enhancement could wrap the exec'd command in a shell envelope that captures exit status, e.g.:

```sh
sh -c '<HOOK>; ec=$?; printf "%d\n" "$ec" > /tmp/portal-hook-exit-<pid>; exec $SHELL'
```

The daemon could then read the exit-status file to log the hook's outcome. Deferred — it introduces shell-quoting hazards, signal-handling complications, and a new file-cleanup concern. If the lookup + exec INFO lines prove insufficient for a future investigation, this is the next layer to consider, in a separate work unit.

---

## Working Notes

## Corrigenda

> **Corrigendum 2026-08-07** (from `theming-system`): the closed component value space omitted `theme` — corrected: `theme` is declared here, with its owners, attr keys, levels, cadences and event catalog.
> **Corrigendum 2026-08-07** (from `theming-system`): "A closed subsystem-prefix taxonomy (15 components)" / "Closed component value space (15 total)" — corrected: the space holds **18** components. `spawn` (added by `multi-window-spawn`) and `resolve` (added by `cli-verb-surface-redesign`) shipped under amendments that were never landed in this file, and `theming-system` adds `theme`; membership is verified against `internal/log`'s bindings.
> **Corrigendum 2026-08-07** (from `theming-system`): "Closed attr-key value space (49 keys)" — corrected: **64 keys**, after declaring the `spawn` (8 new), `resolve` (2 new) and `theme` (5 new) groups and counting the keys they cross-list (`session`, `target`, `reason`, `path`) once each.
> **Corrigendum 2026-08-07** (from `theming-system`): `spawn`'s and `resolve`'s attr keys were undeclared here, for the same reason their components were — corrected: both groups are declared, verified against their emission sites.
> **Corrigendum 2026-08-07** (from `theming-system`): "Every package that logs binds its component name once at package init" read as one package per component — corrected: the rule is bind once **per package, per component**; a component may be bound by several packages, and a package that is handed a bound logger through a seam binds nothing at all.
> **Corrigendum 2026-08-12** (from `theming-system` review): "The 11-step bootstrap orchestrator" (the `bootstrap` owns-row, and the same phrase in the sequence-cycle list) — corrected: the orchestrator runs **ten** steps. The former step 11, `CleanStale`, was re-homed onto the `_portal-saver` daemon.
> **Corrigendum 2026-08-14** (from `theming-system` review): the `clean` component's owns-row read "`portal clean` command path", and the rotation/retention rules carried a "`portal clean` integration" block plus two further `portal clean` references — corrected: `portal clean` is retired. The component covers the sweep paths (bootstrap's orphan-daemon and stale-marker sweeps, `internal/state`'s orphan-FIFO sweep), the forced log sweep is `portal doctor --fix`, and the leaked symlink temp is reclaimed by the same pid's next swing rather than by any sweep.
> **Corrigendum 2026-08-14** (from `theming-system` review): the `enumerated` row claimed that an open "refused below the size floor" also emits the event — corrected: only the **post-enumeration floor re-check** does; an entry-gate refusal precedes the enumeration and emits nothing.
> **Corrigendum 2026-08-14** (from `theming-system` review): the emission-control rules said `cmd` constructs the loader's seam with `log.Discard()` on `portal doctor`, `portal theme export` and `capturetool` — corrected: all three take **`theme.NewSilentLoader()`**, and `cmd`'s only direct seam construction is the real-logger one.
