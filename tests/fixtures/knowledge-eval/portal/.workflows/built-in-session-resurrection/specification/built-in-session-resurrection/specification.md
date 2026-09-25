# Specification: Built-In Session Resurrection

## Specification

## Overview

Portal will own the full tmux session lifecycle end-to-end: server start → session restoration → resume hook execution. The current middle step depends on tmux-resurrect/continuum, which fails to reliably restore sessions after reboot, breaking the resume hook feature despite the hook code being correct.

This replaces reliance on external plugins with a built-in save/restore mechanism.

## Product Goal

**"Zellij in tmux."** When a user reboots, their tmux sessions come back as they were — structure *and* content. Restoration is automatic, on by default, with no opt-in required.

## Organizing Principles

- **Portal owns the full lifecycle.** Save, restore, and hook execution are all internal. No external plugin dependencies for resurrection.
- **Portal's hook system is generic.** Portal stores and fires command strings. It has no awareness of what consumers do with them. Caller wrapper scripts own process-specific policy (e.g., re-registering dynamic hooks).
- **Portal does not maintain a separate session registry.** Live tmux state is read directly via `list-panes -a`, `list-sessions`, etc. Portal's saved state mirrors tmux state; it never diverges from or substitutes for it.
- **Portal captures all sessions — both Portal-created and native tmux.** Consistent with existing behavior. Sessions prefixed with `_` are reserved for Portal internals and excluded from capture, restore, and the TUI picker.
- **Bootstrap is the natural point for restoration.** Portal is always the entry point; `PersistentPreRunE` already runs before every user-facing command.
- **Degrade locally, log, continue.** No single failure may crash Portal or leave the user stuck. All failures log to a file and degrade the affected pane/session to a workable state.
- **Single-writer architecture.** All state-file writes funnel through one long-running process. Other triggers signal via a dirty flag. Eliminates write races by construction.
- **YAGNI rigorously.** Speculative features (ephemeral opt-out, background prefetch, compression, multi-host sync) are deferred until concrete user demand surfaces.

## Scope & Constraints

### Minimum Versions

- **tmux ≥ 3.0** (Feb 2020). Array-indexed hooks (`set-hook -a` semantics) require 3.0; the hook-lifecycle coexistence model depends on them.
- **Go, macOS, Linux**: inherits Portal's existing requirements. No change.

**Runtime version check.** Bootstrap runs `tmux -V` once on the first `PersistentPreRunE` invocation per Portal process, parses the version string, and errors out with a clear user-facing message if the version is below 3.0 (e.g., `"Portal requires tmux ≥ 3.0 (found 2.9). Please upgrade."`). The check happens **before** any `set-hook -ga` registration so that users on older tmux don't land in the "mysteriously not working" silent-failure mode Observability explicitly argues against.

### In Scope — Captured and Restored

**Structural state:**
- Session names
- Window indices, names, layout strings, active flag, zoom flag
- Pane indices, current working directories, active flag

**Content:**
- Full pane main-screen scrollback with ANSI escape sequences — colors, attributes, formatting preserved via `tmux capture-pane -e -p -S - -t <pane>`
- tmux per-session environment via `show-environment -t <session>` — the tmux-level env used for initializing new panes (not live shell env). Restored in full without filtering; tmux's own `update-environment` refreshes stale values (`SSH_AUTH_SOCK`, `DISPLAY`) on client attach.

**Already stored elsewhere (unchanged):**
- Resume hooks (`hooks.json`)

### Out of Scope — Ephemeral Interaction State

Excluded from capture even though tmux exposes them, because they are transient:
- Copy mode state
- Active selections
- Paste buffers
- Cursor position within panes
- Scroll position within scrollback
- Per-client state (which client has which pane focused, client-specific dimensions)

### Out of Scope — Uncapturable by tmux

Not Portal's problem to solve. Users can compensate via resume hooks where meaningful:
- Live shell environment variables — tmux cannot observe shell-side `export`. Callers compensate via resume hooks if they care.
- Running process state (REPL state, interactive sessions like vim/htop/less) — alt-screen buffer contents are explicitly not scrollback. The resume hook system exists specifically for process relaunch.
- Open file descriptors, pipes, sockets, ptrace state.

### Explicit Non-Goals

- **Live shell environment variables.** Scope-boundary non-goal; see above.
- **Running process state.** Same.
- **tmux server-level options and user's `.tmux.conf` customizations.** Portal reads live tmux state via standard APIs; does not introspect or capture config files. Restoration uses the user's current `.tmux.conf` as baseline.
- **Third-party tmux plugin state.** Portal coexists with other TPM plugins via hook-append semantics but does not capture, understand, or interact with their state.
- **Multi-server, multi-host, remote sync.** Portal works with a single local tmux server per machine. No cross-machine sync, no remote tmux, no session groups distributed across hosts.
- **Non-tmux multiplexers.** Portal is tmux-specific. Zellij, GNU screen, wezterm, abduco — not supported.
- **Shell-specific behavior.** Portal is shell-agnostic. Helper `exec`s `$SHELL`. No special-casing bash/zsh/fish.
- **Mouse state / clipboard state.** Ephemeral interaction state.
- **Generic tmux option capture** (session/window/pane options). Nearly all tmux options are set globally via `~/.tmux.conf` and apply on restore automatically. Per-session overrides are niche. Capturing them requires diffing `show-options` against global defaults — complexity not justified. Also carries a recursion risk: Portal's own `set-hook -g` definitions would be captured and replayed on restore, creating a feedback loop on its own plumbing. If a specific flag becomes important, add it as an explicit per-window/per-session field later.
- **Marks / position bookmarks.** tmux's `<prefix>m` marks panes (not scrollback positions), and copy-mode position marks have no tmux API to capture or restore. No functional gain.
- **Last-pane tracking.** No confirmed tmux format variable exposes this.

### Deferred (Not Non-Goals, Just Not Now)

- **Ephemeral session opt-out** (per-session/per-pane exclusion from capture). Speculative without concrete user demand. `history-limit 0` on a window is the tmux-native workaround documented in the README.
- **Scrollback compression.** Deferred until disk usage becomes a complaint.
- **Parallel capture** for many-pane configurations. Deferred until performance complaints surface. Sequential capture is adequate at realistic scale: per-pane round-trip cost is ~10ms and realistic pane counts stay under ~20, keeping capture well inside the 1-second tick budget.
- **Schema migration (v1 → v2).** Standard practice when the time comes; not a v1 design decision.
- **Background prefetch / full-eager hydration.** Rejected in favor of pure-lazy hydration; can be reconsidered if attach-time latency becomes a complaint.

## Hook System Lifecycle Behavior

### Behavior

Portal's resume hook system has **a single persistent behavior**. Hooks registered via `portal hooks set --on-resume "cmd"` live in `hooks.json` across reboots and survive tmux server restarts. They are removed only by explicit `portal hooks rm --on-resume` invocation.

There is no `mode` field, no `once` vs `always` flag, no per-hook lifetime configuration. Portal is a mechanism; hook lifecycle policy (one-shot, bounded-lifetime, dynamic re-registration) is the caller's responsibility.

### Caller Pattern for Dynamic or One-Shot Semantics

Long-running processes that need dynamic hook management (e.g., `claude --resume <uuid>` where the UUID changes each session) are invoked via a wrapper script that owns the hook lifecycle:

- Wrapper calls `portal hooks set --on-resume "<cmd>"` when the process starts, inferring the current pane from `TMUX_PANE`.
- Wrapper re-registers on each resume if the command includes dynamic state (e.g., a new resume UUID).
- Wrapper calls `portal hooks rm --on-resume` on explicit process exit, via an exit trap or teardown routine.

Portal exposes `set` and `rm` as primitives; callers wire them into their own lifecycle hooks.

### Rejected Alternative: `&&` Shell-Chaining for Self-Removal

A pattern like `portal hooks set --on-resume "my-cmd && portal hooks rm --on-resume"` does **not** work for the flagship class of hook commands. Long-running processes (`claude --resume`, `npm start`, `tail -f`) never exit, so the `&&` clause never fires, and the hook never self-removes. This pattern is architecturally broken for the exact use case hooks exist to serve and is not supported as a recommendation.

### CLI Surface (Unchanged User-Facing Shape)

- `portal hooks set --on-resume "<cmd>"` — register or replace the resume hook for the current pane (pane inferred from `TMUX_PANE`, keyed by structural key `session:window.pane`).
- `portal hooks list` — list registered hooks.
- `portal hooks rm --on-resume` — remove the resume hook for the current pane.

The storage file (`hooks.json`) and structural-key scheme are unchanged. Internal implementation changes are covered in "Resume Hook Firing" and "CleanStale Behavior" sections below.

### Rationale

A mode field can be added later if a concrete use case surfaces where wrapper-script management is genuinely impractical. None was identified during discussion — the flagship Claude use case is satisfied by caller-side wrapping, and static commands (`npm start`, file watchers, `tail -f`) only make sense as persistent.

## Save-Side Architecture: Execution Model

### Host Process: Detached tmux Session

Portal hosts its long-running save process inside a detached tmux session named `_portal-saver`. The session's command is `portal state daemon` — a long-running Go process. tmux owns the process lifecycle: when tmux terminates, the PTY is closed, the kernel delivers SIGHUP to the daemon, and the daemon flushes its final state before exiting.

**Why a detached tmux session (not a platform-specific service and not subprocess-per-event):**

- tmux already owns process supervision. No launchd/systemd per-platform code, no install/uninstall service lifecycle, no double-fork fallback with silent-failure mode.
- The daemon has nothing useful to do when tmux is dead, so tying its lifetime to tmux's is correct.
- Portal creates `_portal-saver` idempotently at bootstrap. Crash recovery is automatic — a dead session is recreated on the next `portal open`.
- Pattern has real-world precedent (tmux-slay, the only public tool known to host a long-running process inside a detached tmux session). The concerns are concrete and addressed, but the pattern is niche — new territory relative to common tmux integrations.

**Why not subprocess-per-event:** structural-event-driven saves miss scrollback drift. A user sitting in one pane with a program outputting for hours produces no structural events; crash loses everything since the last event.

**Why not a full external daemon (Zellij path):** ~500 LOC of platform-specific lifecycle code (install, supervise, PID files, IPC, upgrade). Zellij's daemon is intrinsic to the tool; Portal bolting one on for one feature is a different engineering calculus.

### Session Visibility and Filtering

`_portal-saver` shows up in `tmux ls`. There is no tmux mechanism to hide it. Portal filters sessions whose names begin with `_` (underscore prefix is reserved for Portal internals) from:

- The TUI session picker.
- `sessions.json` capture (the save process skips `_*` sessions when enumerating live state).
- Any future internal-only sessions.

This keeps the internal machinery invisible in Portal's own UX while remaining inspectable via `tmux ls` for debugging.

### Defensive Session Setup

On every `EnsureServer()` call, Portal runs `tmux set-option -t _portal-saver destroy-unattached off` unconditionally (idempotent). The `-t <session>` scoping is load-bearing: it targets the saver session only, as a session-local override. **Do not** use `-g` (global) — that would overwrite the user's global `destroy-unattached` setting, which is out of scope. This defends against users with `destroy-unattached on` set globally in `.tmux.conf` — without this override, their global setting would kill `_portal-saver` immediately on creation (the session is `-d` and has zero attached clients).

### Signal Handling

The daemon traps two signals:

- **SIGHUP** — delivered by the kernel when tmux closes the PTY master fd. This is the dominant shutdown path (tmux `kill-server`, server crash, reboot). Discussion verified the kernel sends SIGHUP, not SIGTERM, in this case — Portal must trap SIGHUP explicitly.
- **SIGTERM** — delivered by direct `kill <pid>` from outside tmux. Less common but handled for completeness.

Handler behavior:

1. If the `@portal-restoring` marker is set, skip the final flush (an in-progress restore is underway; capturing now would capture mid-transition state).
2. Otherwise, flush the current state atomically via `AtomicWrite` and exit.

No configurable grace period. Atomic rename guarantees either the old or new state file is always valid on disk, so there is no mid-write corruption risk from signal-timing.

### Lifecycle Summary

- **Creation:** `EnsureServer()` calls `has-session -t _portal-saver`. If absent, `new-session -d -s _portal-saver "portal state daemon"`.
- **Liveness verification.** `has-session` returning true is not sufficient proof the daemon is running — the session could have been left behind with a dead process inside. The daemon writes its OS PID to `~/.config/portal/state/daemon.pid` on startup (alongside `daemon.version`). Bootstrap reads `daemon.pid` and tests the process via `kill(pid, 0)` (Go: `syscall.Kill`; signal 0 tests existence without signalling). If the PID file is missing, unparseable, or the process check fails, Portal treats the daemon as absent: `kill-session -t _portal-saver` (tolerant of already-dead) then recreate. `#{pane_current_command}` is not used as a liveness predicate — it returns only a short process name, which is too imprecise (any `portal <subcommand>` invocation would match). The PID-file + signal-0 check is definitive.
- **Auto-destroy:** when the daemon exits (normal shutdown, crash, or version-mismatch restart), tmux's default session-auto-destroy behavior removes the session. No `remain-on-exit` tuning required.
- **Recreation:** the next `portal open` after destruction runs bootstrap, finds `_portal-saver` absent, and recreates it.
- **Version-based restart:** see the "tmux Hook Registration Lifecycle" section for the version-marker restart protocol.

## Save-Side Architecture: Triggers & Serialization

### Trigger Layers

Two complementary trigger mechanisms ensure both responsiveness and bounded data loss:

**1. Event-driven (immediate response).** tmux global hooks (`set-hook -ga`) fire on structural events. Each event runs `run-shell "command -v portal >/dev/null 2>&1 && portal state notify"`, which signals that state is dirty.

The events:
- `session-created`
- `session-closed`
- `session-renamed`
- `window-linked`
- `window-unlinked`
- `window-layout-changed`
- `pane-focus-out`

These catch structural changes (session/window/pane topology, renames, layout changes, focus transitions) as they happen.

**Deliberately NOT registered.** `window-renamed` and `pane-exited`/`pane-died` are not in the save-trigger list. Their effects are either already covered (a pane close changes layout, firing `window-layout-changed`) or non-critical enough that the 30-second max-gap periodic tick catches the drift. `pane-focus-out` is registered to capture `pane_current_command` transitions that would not otherwise fire a structural hook. Any event not listed here is the 30-second max-gap's responsibility.

**2. Periodic (bounded worst-case).** The hosted daemon runs a 1-second ticker internally. Each tick: if the dirty flag is set OR it has been ≥30 seconds since the last save, capture and persist state; otherwise no-op.

- **Dirty-flag check** produces ≤1 second event-to-save latency.
- **30-second max-gap** bounds worst-case scrollback loss on unexpected tmux/system termination at 30 seconds, even during periods with zero structural events.

**30-second cadence rationale.** The 30-second figure is informed by Zellij's trajectory — Zellij originally defaulted to 1-second serialization, then raised to 60 seconds in v0.39.2 after disk-write volume complaints (Zellij PR #2951). Portal's 30s is a compromise between Zellij's pre- and post-complaint positions, reflecting both the write-volume concern and Portal's narrower YAGNI-first disk budget.

### No Opportunistic Trigger

Earlier framing proposed additional saves fired from `portal open` / `portal attach` based on last-save staleness. This is **not** included. If the hosted daemon is running, it is already saving via events + ticker. If it is not running, `EnsureServer()` will recreate `_portal-saver` and its first tick fires within ~1 second — coverage is already complete. An opportunistic trigger would only add a code path racing with the hosted process.

### Single-Writer Serialization via Dirty Flag

All state-file writes flow through the hosted daemon. Other trigger paths only *signal*. This eliminates write races by construction.

**Mechanism:**

1. tmux fires a structural event.
2. The hook command runs `portal state notify`.
3. `portal state notify` is a small binary: touch (create or bump mtime of) `~/.config/portal/state/save.requested`, exit. **No tmux calls. No state-file reads. No conditional logic.** The binary is deliberately dumb: it always sets the dirty flag, even during restoration. The daemon (not `notify`) is responsible for honouring `@portal-restoring` and suppressing captures. The file's **contents are irrelevant** — `notify` writes an empty file, and the daemon only checks for presence (not content). The file is never cleaned up outside of daemon-startup and explicit capture: if Portal is uninstalled and tmux is never restarted, a stale `save.requested` simply lingers on disk until the next daemon starts. Harmless.

Any behavioural augmentation (session-rename migration, diagnostic fan-out, etc.) lives in a **separate internal subcommand** invoked by a dedicated tmux hook — it does not accrue into `notify`. See Resume Hook Firing → Session Rename: Hook Key Migration for the rename path.
4. The hosted daemon's 1-second ticker checks on each tick:
   - Is `save.requested` present? → capture, then clear the flag.
   - Has it been ≥30 seconds since the last save? → capture, then clear the flag.
   - Neither? → no-op.
5. Capture inspects `@portal-restoring` first; if set, skip the tick entirely (restoration in progress).

**Properties:**

- **Single writer by construction.** Only the hosted daemon writes scrollback files and `sessions.json`. No filesystem coordination beyond the dirty flag.
- **Natural coalescing.** Five events firing in 100ms all just set the flag; the next tick does exactly one save.
- **Max-gap guarantee.** 30 seconds is the ceiling on save staleness, even during idle periods.
- **Event latency.** ≤1 second from tmux event to save completion (bounded by the ticker interval).
- **Restoration guard.** The daemon's tick checks `@portal-restoring` at the top of the cycle. While set (during the skeleton-restore window), no capture runs, regardless of dirty-flag state.

### Daemon Tick Loop (Pseudocode)

```
for {
    select {
    case <-ticker.C:  // 1 second
        if isRestoringFlagSet() {
            continue  // skip entire tick during restore
        }
        if isDirty() || timeSinceLastSave() >= 30*time.Second {
            captureAndWrite()
            clearDirty()
        }
    case <-ctx.Done():  // SIGHUP or SIGTERM
        if !isRestoringFlagSet() {
            captureAndWrite()  // flush final state on shutdown
        }
        return
    }
}
```

### Defensive Dirty-Flag Clear on Daemon Startup

On daemon startup, the first action is to clear `save.requested` if present. This prevents a stale dirty flag from a prior (crashed or version-mismatch-restarted) daemon from triggering an immediate save of a mid-restore state.

Correctness does not depend on this — even without it, the eventual capture converges to the correct state once restoration completes and `@portal-restoring` is cleared. The clear is a belt-and-braces cleanup that avoids a redundant capture during the restore window.

### Tick Cadence Rationale

The 1-second ticker is a **poll cadence**, not a save cadence. Per-tick idle cost is a filesystem stat of `save.requested` and a `time.Since` comparison — measured in microseconds. Heavy work (capture-pane, hashing, writes) only fires when the dirty flag is set or the 30-second max-gap elapses.

This polling approach is not load-bearing. It could be swapped for `fsnotify`-style filesystem watching for sub-10ms responsiveness, at the cost of cross-platform watcher complexity. Current polling is simpler and good enough for the responsiveness target.

### In-Flight Capture Atomicity

A capture cycle is a single synchronous Go function. It checks `@portal-restoring` at entry only and runs to completion without re-checking. If bootstrap flips `@portal-restoring` from `0` to `1` while a capture is mid-execution, the in-flight capture completes normally and may commit its write after the flag is set. This is safe because:

- A capture that started before the flag was set was capturing pre-restore (steady-state) tmux, which is a valid snapshot.
- Writes are atomic (per-file `AtomicWrite`) and commit via the `sessions.json` rename — so the committed state is a coherent pre-restore snapshot.
- The next tick will see `@portal-restoring=1` at entry and skip, so no subsequent capture interferes with the skeleton-build.

No per-tick locking is required. Correctness relies on: (a) the daemon being single-writer, and (b) `AtomicWrite`'s rename-based atomicity.

### Crash Safety

- **Mid-capture crash:** in-memory state discarded. On-disk `sessions.json` still points to the previous save's scrollback files. Previous save remains fully valid.
- **Mid-write crash:** `AtomicWrite` (temp file + rename) guarantees either the old or new file is intact. No partial-file states exist on disk.
- **Orphan scrollback files** from an interrupted save are cleaned up by the GC step on the next successful save (see Save Format & Schema section).

## Save Format & Schema

### Storage Location

Saved state lives at `~/.config/portal/state/`, resolved via Portal's existing `configFilePath` mechanism (per-file env var → `XDG_CONFIG_HOME/portal/` → `~/.config/portal/`). Same location as other Portal config (`hooks.json`, `projects.json`, `aliases`) — no separate XDG state directory.

All files written with mode `0600` (owner read/write only). New directories (`state/`, `state/scrollback/`) created with mode `0700` to prevent other users on a multi-user system from listing filenames — keeping scrollback content private even at the metadata level. Matches the trust model of shell history and debug logs already on the user's filesystem. No encryption at rest.

### Directory Layout

```
~/.config/portal/state/
├── sessions.json                        # structural index (the atomic commit)
├── save.requested                       # dirty flag (touched by portal state notify)
├── daemon.version                       # daemon binary version marker
├── daemon.pid                           # daemon OS PID (liveness verification)
├── portal.log                           # current log file
├── portal.log.old                       # previous rotated log
├── hydrate-<paneKey>.fifo               # per-pane hydration FIFOs (transient)
└── scrollback/
    ├── <session>__<window>.<pane>.bin   # raw capture-pane output per pane
    ├── work__0.0.bin
    ├── work__0.1.bin
    └── ...
```

### Scrollback Files

Each live pane has its own scrollback file containing raw `capture-pane -e -p -S -` output (ANSI escape sequences preserved inline, no encoding transformation).

Scrollback size per pane is naturally bounded by `history-limit × avg-line-bytes` — tmux's history buffer is a ring that discards oldest lines at the head when the limit is exceeded. No Portal-side cap is needed to keep files bounded.

**Filename scheme:** `<session>__<window>.<pane>.bin`

- `session` is the session name, passed through a filesystem-safe sanitizer (replace characters that conflict with filesystem conventions: `/`, null bytes, leading `.`, etc.). On collision (two sanitized session names map to the same file key), append a hash suffix.
- `window` is the numeric window index; `pane` is the numeric pane index.
- `.bin` extension indicates binary (non-textual) content due to embedded ANSI escapes.

### Index Semantics and base-index / pane-base-index

tmux window and pane indices are user-configurable via `base-index` (default 0, often 1) and `pane-base-index` (default 0, often 1). Portal captures the actual tmux-reported indices in `sessions.json` (from `list-panes -a -F '#{window_index}:#{pane_index}'`), preserving whatever scheme the user has configured.

On restore, Portal creates windows and panes in saved-structural order, but **does not assume the created tmux indices match the saved indices**. After creating each window via `new-window` and each pane via `split-window`, Portal re-queries `list-panes -t <session>` to map saved-structure position → actual live tmux index. This mapping is used for:

- Setting `@portal-skeleton-<paneKey>` markers on the correct live pane.
- Computing FIFO paths for each live pane.
- Passing `--file <scrollback>` to the correct helper at pane creation time.

If `base-index` / `pane-base-index` changed between save and restore, the *numeric* indices shift but the structural relationships (window order, pane order within a window, which pane was active) are preserved. `select-pane -t <window>.<active-pane-position>` uses the re-queried live index, not the saved one.

### Canonical paneKey (sanitization reference)

The **paneKey** used for FIFO paths, skeleton markers, and scrollback filenames is derived deterministically:

```
paneKey = sanitize(session_name) + "__" + window_index + "." + pane_index
```

where `sanitize()` replaces `/`, null bytes, leading `.`, and other filesystem-unsafe characters, with hash-suffix fallback on collision. The same sanitization is applied everywhere `paneKey` is used:

- Scrollback filename: `scrollback/<paneKey>.bin`
- FIFO filename: `hydrate-<paneKey>.fifo`
- Skeleton marker name: `@portal-skeleton-<paneKey>` (as a tmux server-option name)

**Indices used in paneKey are always *live* indices (post-restoration).** At save time, save == live, so the saved file is written under the live paneKey. At restore time, if `base-index`/`pane-base-index` changed, the *newly-created* panes have indices that may differ from what was written to disk. Portal bridges this by:

- Passing the **saved scrollback file path** directly to each helper as `--file <path>`, read from `sessions.json` at bootstrap time. The helper does not compute the path from its own environment — so it reads from the saved-indexed file regardless of any index drift.
- Setting `@portal-skeleton-<paneKey>` and creating `hydrate-<paneKey>.fifo` using **live** paneKey (re-queried via `list-panes` after pane creation). So the daemon's enumeration, `signal-hydrate`, and the FIFO signal path all agree on live indices.
- On the first post-hydration capture, the daemon writes the scrollback under the live paneKey; GC removes the old saved-indexed file. From that tick forward, disk and live indices are in sync.

**Hook structural keys** (`session:window.pane` in `hooks.json`) use the **raw** (un-sanitized) session name, window index, and pane index. Hooks.json is JSON, so any character valid in a session name is valid in the key. This is intentional: hook keys are content-addressable by the tmux identifier the user sees, not by a filesystem representation.

**Helper hook lookup under index drift.** The helper is invoked with a `--hook-key "<raw-session>:<saved-window>.<saved-pane>"` flag populated from `sessions.json` at bootstrap. The helper uses that flag (not its own live position) to look up hooks in `hooks.json`. This preserves hooks across `base-index`/`pane-base-index` changes between save and restore — the hook stays addressable by its saved identity regardless of how live tmux has numbered the recreated pane.

When session renames occur, the hook migration (see Resume Hook Firing) updates the raw-name portion of the hook key; the paneKey regenerates on the next capture cycle via the new sanitized name.

### Structural Index: `sessions.json`

Single JSON file at the root of the state directory. Contains the complete structural topology plus references to scrollback files.

**Schema (version 1):**

```json
{
  "version": 1,
  "saved_at": "2026-04-17T10:30:00Z",
  "sessions": [
    {
      "name": "work",
      "environment": { "LANG": "en_US.UTF-8", "TERM": "xterm-256color" },
      "windows": [
        {
          "index": 0,
          "name": "main",
          "layout": "b25f,200x50,0,0{...tmux layout string...}",
          "zoomed": false,
          "active": true,
          "panes": [
            {
              "index": 0,
              "cwd": "/Users/leeovery/Code/portal",
              "active": true,
              "current_command": "zsh",
              "scrollback_file": "scrollback/work__0.0.bin"
            }
          ]
        }
      ]
    }
  ]
}
```

**Field semantics:**

- `version` — integer. Starts at 1. Bumped on schema-breaking changes (loader reads this and applies known-version logic).
- `saved_at` — RFC 3339 UTC timestamp, used by `portal state status` to render "last saved Xs ago."
- `sessions[].name` — exact session name at save time; restored verbatim.
- `sessions[].environment` — key-value map from `show-environment -t <session>`. Written as-is; tmux's `update-environment` refreshes stale values on client attach.
- `sessions[].windows[].layout` — pre-zoom layout string from `#{window_layout}` (not `window_visible_layout`). Correct for `select-layout` replay.
- `sessions[].windows[].zoomed` — boolean from `#{window_zoomed_flag}`. Re-applied separately after layout.
- `sessions[].windows[].active` — boolean from `#{window_active}`.
- `sessions[].windows[].panes[].cwd` — from `#{pane_current_path}`.
- `sessions[].windows[].panes[].active` — from `#{pane_active}`.
- `sessions[].windows[].panes[].current_command` — short command name from `#{pane_current_command}` (no args — that's a tmux limitation). Captured as an internal diagnostic field only; **not surfaced in `portal state status` output or any other user-facing surface** in v1, and not load-bearing for restoration. Future versions may surface a "N panes had non-shell commands — consider registering resume hooks" nudge if concrete user need surfaces.
- `sessions[].windows[].panes[].scrollback_file` — path relative to the state directory.

**Omitted fields (explicitly not captured):**
- `options` (generic per-session/per-window/per-pane option capture): dropped per Scope.
- `marks`: dropped per Scope.
- `last_pane`: dropped per Scope.

### Atomic Commit Discipline

Multi-file state with per-file atomicity. The commit order:

1. **In-memory capture.** Enumerate live sessions (skipping `_*` names), call `list-panes -a -F ...`, `show-environment -t <session>` per session, and `capture-pane -e -p -S - -t <pane>` per eligible pane. All reads run to completion before any writes.
2. **Per-pane scrollback writes.** For each pane whose scrollback hash changed (see Content-Hash Dedup below), write its `.bin` file via `AtomicWrite` (temp file + rename). Unchanged panes are skipped.
3. **Structural index write.** `sessions.json` written last, via `AtomicWrite`. **This rename is the atomic commit.** If the rename succeeds, all referenced scrollback files are present on disk.

**Failure modes:**
- Crash before step 3 → old `sessions.json` still valid, still references old scrollback files. Restore works as of the previous save.
- Crash mid-step 3 → `AtomicWrite` guarantees either the old or new `sessions.json`, never a partial. Still consistent.
- Orphan new scrollback files from a partial save → cleaned by GC on the next successful save.

### Content-Hash Dedup

To avoid rewriting unchanged scrollback on every tick — which would generate on the order of 86 GB/day of writes in a heavy-history configuration (`history-limit 50000` × 10 panes) and cause significant SSD wear — the daemon holds an in-memory map `paneKey → hash-of-last-written-scrollback`. Content-hash dedup reduces worst-case write volume to single-digit MB/day for realistic workloads.

Per pane per capture cycle:
1. Capture scrollback bytes (cheap — tmux internal buffer).
2. Hash the bytes (xxhash or equivalent fast non-cryptographic hash).
3. Compare to the stored hash for this pane.
4. If identical → skip the disk write; no change.
5. If different → `AtomicWrite` the scrollback file, update the stored hash.

`sessions.json` is written at the end of the cycle only if *anything* changed (structural delta or at least one pane's hash differed). If a full 30-second cycle produces zero changes, zero disk activity occurs.

**Daemon-startup seed.** On startup the in-memory hash map is empty; without a seed step, the first tick after every daemon start (including the version-mismatch restart that fires on every `portal open` during `dev`/empty-version builds) would rewrite every scrollback file. The daemon avoids this by **seeding the hash map from disk on startup**: read each existing `scrollback/*.bin`, hash the bytes, populate the `paneKey → hash` map. Seed cost scales with total on-disk scrollback (~30 panes × 500 KB × few ms/MB = sub-second). After seeding, the first tick only writes panes whose live scrollback genuinely differs from what is on disk — typical case is a near-no-op.

### GC / Orphan Cleanup

After every successful save (after `sessions.json` is atomically committed), run GC synchronously:

1. Read the freshly-written `sessions.json` and collect every `scrollback_file` path it references.
2. List everything under `scrollback/`.
3. Any file present on disk but NOT referenced by the new index → `os.Remove`.

Handles every stale-file scenario:
- Pane closed → file no longer referenced → deleted.
- Session renamed → old-name files deleted, new-name files written.
- Window or pane renumbered → same.
- Orphan files from a previous mid-save crash → cleaned on next successful save.

Idempotent. Runs once per save. Self-healing by construction.

### Retention Policy

**Current state only.** No historical snapshots. Single `sessions.json`, no `.0`/`.1` rotation.

- `AtomicWrite` makes mid-write corruption vanishingly rare (temp + rename).
- Historical snapshots would 5-10× disk use for no restore benefit.
- If real-world corruption surfaces, a `sessions.json.previous` single-slot backup can be added later. YAGNI for v1.

### FIFO Files

Per-pane FIFOs for hydration (`hydrate-<paneKey>.fifo`) live in the state directory during the restoration window. They are created just before arming each pane (immediately before `respawn-pane -k`), unlinked by the helper on signal (or timeout), and swept defensively by `os.Remove + syscall.Mkfifo` on each bootstrap. Not part of the save schema; treated as transient coordination artifacts.

## tmux Hook Registration Lifecycle

### Global Hooks Registered by Portal

Portal registers two categories of global tmux hooks:

**Save-trigger events** (fire `portal state notify`):
- `session-created`
- `session-closed`
- `session-renamed`
- `window-linked`
- `window-unlinked`
- `window-layout-changed`
- `pane-focus-out`

**Hydration-trigger events** (fire `portal state signal-hydrate #{session_name}`):
- `client-attached` (initial attach, NULL → session)
- `client-session-changed` (existing client switches sessions)

Both events are registered; every attach path is covered (double-firing on a single attach is harmless because `signal-hydrate` is idempotent via the skeleton-marker check).

### Registration Shape

All hooks use `set-hook -ga` (global, append) so Portal coexists with user `.tmux.conf` hooks and any other plugins registering on the same events. Each hook wraps its command in a `command -v portal` defensive guard so an uninstalled or missing binary produces no error spam.

```
set-hook -ga session-created 'run-shell "command -v portal >/dev/null 2>&1 && portal state notify"'
set-hook -ga session-closed  'run-shell "command -v portal >/dev/null 2>&1 && portal state notify"'
# ... all save-trigger events identically ...
set-hook -ga client-attached         'run-shell "command -v portal >/dev/null 2>&1 && portal state signal-hydrate #{session_name}"'
set-hook -ga client-session-changed  'run-shell "command -v portal >/dev/null 2>&1 && portal state signal-hydrate #{session_name}"'
```

**Why `-ga` (append) rather than `-g` (replace):** `-g` stomps on any user or other-plugin hook registered on the same event. `-a` preserves coexistence. tmux 3.0+ requirement (array-indexed hooks) follows from this choice.

**Why the `command -v` guard:** if Portal is uninstalled or temporarily absent during a binary swap, the guard short-circuits the invocation — no "command not found" in tmux's error buffer. Runs a shell built-in on every event; cost is microseconds.

### Content-Based Idempotency (per-event, per-command)

`set-hook -ga` does **not** deduplicate. Identical appends accumulate duplicate entries in the hook array. Portal must check whether its entry is already present before appending.

For each (event, expected_command) pair Portal registers:

1. Run `tmux show-hooks -g` and capture stdout.
2. Parse lines matching `^<event>\[(\d+)\]` to find array entries for this event.
3. Look for our expected-command substring (`portal state notify` for save-trigger events, `portal state signal-hydrate` for hydration-trigger events) within those entries.
4. If any matching entry is found → skip registration for this event.
5. If none match → `set-hook -ga <event> '<full command>'` to append.

**Per-event-per-command scoping:** the check for `portal state notify` is only applied to save-trigger events; the check for `portal state signal-hydrate` is only applied to hydration-trigger events. The command substrings are distinct, so there is no cross-contamination across the two categories.

Parsing lives in Go using the existing `Commander` interface. Compiled regex per event; table-driven tests with canned `show-hooks` outputs.

**Quoting note:** tmux may render the stored command with different outer quoting than Portal supplied. The match substring (`portal state notify` or `portal state signal-hydrate`) is raw text inside the command and is not affected by tmux's outer quoting.

### Scenario-by-Scenario Behavior

#### Scenario 1: Fresh-server bootstrap

User runs `portal open` on a machine where tmux is not running.

1. `EnsureServer()` starts the tmux server.
2. Portal runs hook-registration idempotency check for every (event, command) pair. On fresh server, `show-hooks -g` returns no Portal entries → all hooks appended.
3. `has-session -t _portal-saver` → false → `new-session -d -s _portal-saver "portal state daemon"`.
4. Portal unconditionally runs `set-option -t _portal-saver destroy-unattached off`.

#### Scenario 2: Subsequent invocation on bootstrapped server

The same code path as Scenario 1. All steps are idempotent:

- Hook check finds existing entries → appends skipped.
- `has-session` returns true → session creation skipped.
- `destroy-unattached off` is a no-op when already set.

Per-bootstrap cost: ~8ms of idempotent tmux calls.

#### Scenario 3: Portal upgrade with running server

User runs `brew upgrade portal` (or equivalent). New binary on disk. tmux server still running. `_portal-saver` still hosting a daemon `exec`'d from the old binary.

**Version-marker-based restart:**

1. On daemon startup, `portal state daemon` writes its version (`cmd.version`) to `~/.config/portal/state/daemon.version`.
2. On every `EnsureServer()` call, Portal reads `daemon.version` and compares to the currently-invoking binary's `cmd.version`.
3. If they differ → `kill-session -t _portal-saver`, then recreate with the new binary. New daemon overwrites the version file on startup.
4. If the version file is absent (first-ever bootstrap, or user-initiated state-dir cleanup) → treat as mismatch; recreate. The "version file absent but `_portal-saver` exists" edge case (e.g., user manually deleted the file while a daemon was running) results in an unnecessary kill + recreate on the next bootstrap. This is accepted as a trade-off: the more-conservative logic (introspect the running daemon's version via some IPC or inference) adds complexity for a transient failure mode. One extra ~50ms daemon restart is imperceptible and self-corrects on the following bootstrap.

**Dev-build handling:**
- If `cmd.version` is empty or literally `"dev"`, treat every bootstrap as a mismatch and restart the daemon. Covers the common workflow of rebuilding Portal during development and expecting each rebuild's daemon code to take effect.
- Otherwise (release build, real semver), raw-string comparison determines mismatch.

**Data safety during restart:** tmux `kill-session -t _portal-saver` closes the PTY; kernel delivers SIGHUP to the daemon; signal handler flushes the final save via `AtomicWrite` before exit. New daemon takes over on recreation. Worst-case data loss: whatever accrued since the last dirty-flag check (≤1 second of scrollback drift).

Cost on unchanged version: one file read per `portal open` (microseconds). On upgrade: one `kill-session` + `new-session` (~50ms). Invisible to anyone not watching.

#### Scenario 4: Portal uninstall with running server

User removes the Portal binary. tmux server still running.

- **Defensive hook guard** (`command -v portal`) short-circuits every hook-fired invocation. No error spam in tmux's error buffer.
- **Dead daemon** survives in memory until it exits or the server restarts. Once gone, it cannot be recreated (binary absent). This is silent — Portal is gone, there is nothing to do.
- **`portal state cleanup`** (see CLI Surface) is the optional explicit teardown. Not required for correctness — defensive hooks and self-healing handle implicit teardown.
- **User data** (`~/.config/portal/state/`, `hooks.json`, `projects.json`, `aliases`) is left on disk. Standard Unix convention: uninstalling the tool does not destroy user data. Reinstalling picks up where the user left off.

#### Scenario 5: Portal binary replaced (brew upgrade) — composed from 3 + 4

No new rules. The atomic swap window is covered by Scenario 4's defensive guard (hooks firing during the brief swap short-circuit cleanly). After the swap, Scenario 3's version-marker detection triggers daemon restart on the next bootstrap. Install-path migrations (e.g., Intel → Apple Silicon Homebrew) are covered identically — hooks reference `portal` on `$PATH`.

#### Scenario 6: User restarts tmux server

Server dies via `kill-server`, `killall tmux`, reboot, crash, etc.

**Server-level state** (hooks, `_portal-saver`, user sessions) — all gone.
**On-disk state** (`sessions.json`, scrollback, `daemon.version`, `save.requested`) — preserved.

No new rules. Scenario 1/2 bootstrap handles end-to-end:
- Hooks re-registered fresh (append to empty arrays).
- `_portal-saver` absent → recreated.
- Version check either matches (same binary) or mismatches (daemon restarted either way since it's newly spawned).
- Restoration of user sessions is orthogonal — handled by the Restore flow.

**Defensive action on daemon startup:** clear `save.requested` if present (see Triggers & Serialization section).

#### Scenario 7: Hook collision with other plugins

Covered by the `-ga` append semantics and content-based idempotency above. Research verified:
- Major TPM plugins (continuum, resurrect, sessionist, logging, yank) do not use `set-hook` at all. Real collision risk is with user-`.tmux.conf` hooks, not other plugins.
- tmux 3.0+ stores hooks as array-indexed options; per-index removal works cleanly.
- Sparse arrays fire correctly (removed indices do not break surviving entries).

### Removal (uninstall / `portal state cleanup`)

1. Run `tmux show-hooks -g`.
2. For each (event, expected_command) pair Portal registers: parse for Portal's indices.
3. Remove each match via `set-hook -gu '<EVENT>[N]'`, in **reverse index order** (defensive — tmux does not renumber after removal, but reverse order is cheap insurance against any edge case).
4. Entries matching other commands on the same events are left alone.

### False Paths Documented

- **Plain `set-hook -g` (replace).** Stomps on user and other-plugin hooks on the same events. Rejected.
- **Assumption that `set-hook -a` is idempotent if the command matches.** Empirically disproven; identical appends accumulate. Content-based check is required.
- **Marker-comment in the hook command (e.g. `# portal-resurrect`).** Unnecessary. The `portal state notify` / `portal state signal-hydrate` command substrings are already unique identifiers.

## Restore-Side Architecture

### Restoration Trigger

Restoration runs on every `portal open` invocation (or any other Portal command that reaches `PersistentPreRunE`). No `serverStarted` gate, no explicit user command, no last-save staleness check.

**For each entry in `sessions.json`:**
- If a live tmux session already exists with that name → **skip**. User's current reality is authoritative; Portal never clobbers live sessions. This is intentional even when the live session's structure differs from the saved state (e.g., a prior bootstrap crashed partway through skeleton restore, leaving a partial session). Portal treats any live session as user-owned and will not attempt to re-complete partial restore state; the user must remove the partial session manually if they want a fresh restore.
- If no live session with that name → **skeleton-restore** it (structure only; scrollback lazy).
- If a saved session's `panes` array is empty (corrupt or invalid `sessions.json`) → log a warning, skip that window/session entirely, and continue restoring the remaining sessions. Portal never creates a session whose pane topology cannot be specified.

**Steady-state cost** (all saved sessions already live): ~20ms — one JSON read + one `list-sessions` call + diff → no-op. Invisible.

Portal's `{project}-{nanoid}` naming makes collisions between Portal-created sessions practically impossible; the skip-on-live behavior addresses the only real risk, which is a user's manually-created tmux session happening to share a name with a saved Portal session.

### Skeleton-Eager + Scrollback-Lazy

**Skeleton (structure) is restored eagerly during bootstrap.** For each missing saved session:
- `new-session -d -s <name> -c <root_cwd>` (default shell; no command argument)
- `new-window`, `split-window` for remaining windows/panes to match saved structure (no command argument; default shell)
- Immediately after each pane is created, the hydrate helper is dispatched into it via `tmux respawn-pane -k -t <pane> "<hydrate command>"` (see Scrollback Restore Mechanics). `respawn-pane -k` atomically kills the pane's default shell and replaces its process with the helper in a single tmux call, so no shell output reaches scrollback before the helper runs.
- `select-layout "<saved>"` per window
- `select-pane -t <active>` per window
- `resize-pane -Z` on the active pane if `zoomed` was true
- `@portal-skeleton-<paneKey>` marker set on each created pane

Cost: ~600ms for a heavy 10-session configuration. Covered by the loading page (see Bootstrap Flow).

**Scrollback (content) is NOT injected during bootstrap.** Scrollback files on disk are left intact. Injection happens at *attach time*, triggered by tmux's `client-attached` / `client-session-changed` hooks.

### Why Skeleton-Eager

Preserves tmux self-containment. After bootstrap:
- Native tmux commands (`tmux attach -t NAME`, `tmux switch-client -t NAME`, `tmux list-sessions`) see the real structure.
- Third-party tmux plugins see live sessions, not a placeholder state.
- Shell aliases and keybindings that reference specific session names work identically to before a reboot.

The ~500ms extra cost (versus a sessions-only-eager approach) buys Portal being *additive* rather than *invasive*.

### Why Scrollback-Lazy

Fully-eager scrollback injection at realistic power-user sizes (`history-limit 50000` per pane × 30 panes) would add 2–15 seconds to boot depending on pane scrollback fullness — unacceptable UX even at the low end. Lazy hydration amortizes cost across attaches; sessions the user never touches today cost zero to hydrate.

Mechanism details are in the Scrollback Restore Mechanics section.

### Why Hook-Driven Hydration

Both `client-attached` and `client-session-changed` are registered globally. This covers every attach path:

- `portal open` picker attach
- `portal attach NAME` (from bare shell or inside tmux)
- Direct `tmux attach -t NAME` from a bare shell
- `tmux switch-client -t NAME` from inside tmux

All run the same `portal state signal-hydrate #{session_name}` command (session name passed as argv via tmux format expansion). The subprocess enumerates panes in the specified session and signals the FIFO of any pane still carrying the `@portal-skeleton-<key>` marker. Idempotent for already-hydrated panes.

Users do not need to know "hooks only work if you attach via Portal."

### Marker Coordination

Two volatile tmux server-option markers coordinate restoration and saving. Both are **volatile** (server-option scope): they clear automatically on server restart, so stale markers cannot persist across tmux lifetimes.

#### `@portal-skeleton-<paneKey>` — "awaiting hydration"

- **Set by:** skeleton-restore, on each pane it creates, via `tmux set-option -s @portal-skeleton-<paneKey> 1` — the `-s` flag is load-bearing (server scope, matching the daemon's `show-options -sv` enumeration). Key is the structural position `session:window.pane`.
- **Unset by:** the hydrate helper, via `tmux set-option -su @portal-skeleton-<paneKey>` — the `-u` flag **removes** the user option, so the daemon's enumeration sees it gone. Assigning an empty string (`set-option -s <key> ""`) does *not* remove the option and would be a bug: the option remains present with an empty value, and the daemon would continue skipping the pane. Everywhere this spec mentions clearing the marker (helper pseudocode, failure-mode handling, `signal-hydrate` timeout path), the intended semantics is `set-option -su`.
- **Semantic:** "this pane was skeleton-restored; its saved scrollback file on disk holds pre-boot state that must not be overwritten until the pane has been hydrated."
- **Effect on save:** the daemon's capture loop **skips** panes whose marker is set. Neither the scrollback file nor the pane's `sessions.json` entry is updated. Disk file preserved.
- **Enumeration mechanism:** per capture cycle, the daemon runs a single `tmux show-options -sv` to dump all server-scope options, and filters in memory for keys prefixed with `@portal-skeleton-`. This produces the set of marker-bearing paneKeys in O(1) tmux invocations per cycle, regardless of pane count. During `list-panes` enumeration, the daemon checks each pane's computed paneKey against the filtered set; marker-present panes are skipped. Avoids N per-pane `show-option` calls.
- **Cleared by:** the hydrate helper, *after* successful content dump + 100ms settle sleep (see Scrollback Restore Mechanics). "Marker cleared" is synonymous with "helper output is complete and the pane's scrollback is in its final form."
- **User-created panes never receive this marker.** Brand-new post-boot panes are captured normally from the start.
- **Inverse semantic is deliberate:** "needs hydration" is *active state set by restore*; default absence means "safe to capture." This keeps the new-session creation path from requiring a special code branch.
- **User-visible property:** for sessions the user never attaches to, the skeleton marker stays set indefinitely, the save loop keeps skipping, and the pre-boot scrollback file on disk remains intact. A user who reboots and then leaves a session dormant for weeks will still have their pre-boot history available the first time they attach.

#### `@portal-restoring` — "restoration in progress"

- **Set by:** bootstrap, at the start of the skeleton-restore phase.
- **Unset by:** bootstrap, after skeleton-restore completes.
- **Semantic:** "bootstrap is mid-skeleton-build; save captures would see half-built state."
- **Effect on save:** the hosted daemon's tick loop honours this marker (skip the entire tick if set). `portal state notify` itself is unaware of the marker — it always touches the dirty flag, including during restore; the daemon's entry-check is the single suppression point. Restore can fire a cascade of structural events (`session-created`, `window-linked`, `window-layout-changed`) without triggering partial-state saves, because every dirty-flag set is ignored by the next tick while `@portal-restoring` is set.
- **Effect on daemon shutdown handler:** SIGHUP/SIGTERM handler skips the final flush if `@portal-restoring` is set (see Save-Side Execution Model). Prevents capturing mid-transition state during upgrade-triggered restart.

### Failure-Mode Behavior for Hydration

If scrollback injection fails (file missing, disk read error, helper timeout without signal):

1. **Unset the marker anyway.** The pane remains empty; the save loop resumes normal capture. Degraded, not stuck.
2. **Log a warning** to `portal.log` (`file not found`, `FIFO timeout`, `I/O error`, etc.). Failure is observable but not spam.
3. **Do not retry automatically** on the failure path itself. A missing file is likely permanent; the pane's future save captures whatever is on screen.

For the FIFO-timeout path specifically, the helper takes a different course that allows retry on the *next* attach (see Scrollback Restore Mechanics) — but within a single hydration attempt, failure is terminal for that attempt.

### User-Created Sessions Mid-Restore

No special handling required. Skeleton-restore only operates on saved sessions listed in `sessions.json`. Pre-existing live sessions — including sessions the user just created — are neither touched nor captured while `@portal-restoring` is set. User commands are not gated.

### Direct `tmux attach` Path

Universal coverage via `client-attached` / `client-session-changed` registration. A user who attaches directly with `tmux attach -t NAME`:

1. `client-attached` fires.
2. The hook runs `portal state signal-hydrate NAME`.
3. Portal enumerates panes in session NAME, signals any skeleton-marked pane's FIFO.
4. Helpers unblock, dump scrollback, exec hook-or-shell.

Functionally identical to `portal open` picker attach.

### Rejected Alternatives

- **Background prefetch hydration after bootstrap.** Race conditions (user attaches mid-fill), more code paths, no win over pure-lazy with marker coordination.
- **Sessions-only-eager (create sessions, skip windows/panes).** Would leave direct `tmux attach` seeing empty sessions. Breaks tmux self-containment.
- **Fully-eager scrollback injection.** 2-15s added boot delay at realistic scales. Rejected; can be revisited if attach-time latency surfaces as a user complaint.
- **Restore gated on `serverStarted` AND "no sessions exist."** No threat model justified the defensive gate. Simplified to "restore all, skip live by name."

## Scrollback Restore Mechanics

### Injection Path: Blocking Helper Pre-Shell via FIFO

Each skeleton-restored pane is **respawned** immediately after creation with a shell-pipeline command via `tmux respawn-pane -k`:

```
tmux respawn-pane -k -t <pane> "sh -c 'portal state hydrate --fifo <FIFO> --file <SCROLLBACK> --hook-key <HOOK_KEY>; exec $SHELL'"
```

where `<HOOK_KEY>` is the saved structural identifier `<raw-session>:<saved-window>.<saved-pane>` — see Save Format & Schema → Helper hook lookup under index drift.

`respawn-pane -k` atomically kills the default shell that `new-session` / `split-window` created and replaces the pane's process with the helper in a single tmux call. The `-k` flag also wipes any output the default shell may have already emitted, so no rc-file output, prompt, or other shell artefacts reach scrollback before the helper runs. The semantic guarantee — *the shell does not exist yet when the bytes are written* — is preserved: by the time the helper begins writing, the shell that briefly existed has been torn down and the pane's running process is the helper alone.

`portal state hydrate` is a Go subcommand that runs *inside the pane, before the user's shell*. Its stdout is connected directly to the pane's PTY slave. Bytes written to its stdout flow out through the PTY → tmux's VT parser → rendered into scrollback natively with full ANSI fidelity.

When the helper exits (normally or via timeout), the trailing `exec $SHELL` takes over the same process. The shell replaces the helper without spawning a new process. The shell never sees the helper's command line; no history pollution.

### Why This Mechanism Was Chosen

**All tmux-native input commands (`paste-buffer`, `send-keys`, `pipe-pane -I`) write to the PTY master bufferevent, which is the shell's *stdin*.** ESC bytes arriving as stdin get interpreted by readline as meta-key prefixes, not rendered as ANSI color sequences. The paste-buffer path is fundamentally wrong for scrollback injection.

Only two mechanisms deliver bytes to the pane's **output (display) path**:
1. A process inside the pane writing to its own stdout. Bytes flow through the PTY slave → tmux's VT parser → rendered correctly.
2. External process writing directly to the pane's slave PTY device (`/dev/pts/<N>` via `#{pane_tty}`). Faster but has positioning race issues (the shell has already prompted by the time the external writer arrives).

Option 1 (helper pre-shell) avoids the positioning race entirely: by the time the helper writes, the default shell that briefly existed before `respawn-pane -k` has been replaced and only the helper holds the pane's process slot.

### Implementation Note: respawn-pane Arming

Skeleton restore is a two-phase per-session operation: a **create** phase that establishes pane topology with the default shell, and an **arm** phase that dispatches the hydrate helper into each live pane via `tmux respawn-pane -k`. Splitting create from arm lets restoration re-query `list-panes` after creation to discover the *live* (window, pane) indices tmux assigned, then build each pane's FIFO and helper command against those indices — necessary because tmux's `base-index` / `pane-base-index` user settings can shift the indices it hands out, and saved indices may not match.

`respawn-pane -k` is preferred over `send-keys` because it atomically kills the default shell and replaces the pane's process; `send-keys` would let the shell's rc-file output and prompt render into scrollback above the helper's content dump. The `-k` flag additionally wipes any output the default shell wrote between creation and arming.

Implementation: `internal/restore/session.go` (see `armPanes` and `buildHydrateCommand`).

### Signal Mechanism: FIFO Per Pane

**FIFO path:** `~/.config/portal/state/hydrate-<paneKey>.fifo` (paneKey = `<session>__<window>.<pane>` — same sanitization as scrollback filenames).

**Creation (bootstrap, before arming the pane):**
1. `os.Remove(path)` — ignore `ENOENT`; remove any pre-existing inode (regular file, symlink, or stale FIFO from a prior crashed bootstrap or dead helper).
2. `syscall.Mkfifo(path, 0600)` — create the FIFO with owner-only permissions.
3. `os.Chmod(path, 0600)` — defensive post-mkfifo chmod to defend against an unusually-tight umask that would otherwise leave the FIFO below 0600.

This defensive pattern complements the bootstrap-step-7 sweep, which performs best-effort cleanup of orphan FIFOs whose paneKey is no longer represented by a live skeleton marker. Stale FIFOs only exist when no live helper holds them (helpers die with the tmux server, same lifetime as the FIFOs they block on).

**Signal (attach time):**
The `client-attached` / `client-session-changed` hook runs `portal state signal-hydrate <session-name>`, which:
1. Enumerates panes in the attached session (`list-panes -t <session-name>`).
2. For each pane whose `@portal-skeleton-<key>` marker is set: open the pane's FIFO for writing and write a single byte.
3. For each pane whose marker is absent: no-op (already hydrated or never skeleton-restored).

`signal-hydrate` **does not touch the marker**. The helper owns marker-unset timing to close the capture-mid-dump race (see below).

**FIFO open-for-write semantics.** POSIX FIFOs block `open(O_WRONLY)` until a reader opens. If a user attaches very quickly after bootstrap, `signal-hydrate` could reach the FIFO before the helper inside the pane has reached its `open(O_RDONLY)` call. Because `signal-hydrate` is invoked via `run-shell` (synchronous by default), a stuck open would block the tmux server.

Portal opens the FIFO with `O_WRONLY | O_NONBLOCK`. If the open returns `ENXIO` (no reader yet) or `EAGAIN`, `signal-hydrate` retries with a short backoff (e.g., 10ms, 20ms, 40ms, up to a ~500ms cumulative budget). If retries exhaust without a reader, `signal-hydrate` logs a warning and moves on — the skeleton marker stays set, and the next attach path will re-signal. Correctness is unaffected (attaches are idempotent by design); the user experiences an extra hydration retry cycle on a very tight attach race.

### Helper Behavior on Startup

```
portal state hydrate --fifo F --file S --hook-key K:
  1. Open FIFO for reading, block with 3-second timeout.
  2. On signal arrival:
     a. Close + os.Remove the FIFO.
     b. Emit reset preamble to stdout:   \033[?25h\033[?1049l\033[0m
        (cursor visible + exit alt-screen defensively + SGR reset).
     c. Copy the scrollback file's bytes to stdout.
     d. Emit reset postamble + CRLF:      \033[?25h\033[?1049l\033[0m\r\n
     e. time.Sleep(100 * time.Millisecond).
     f. tmux set-option -su @portal-skeleton-<paneKey>  (remove marker via -u flag — load-bearing; empty-string assignment does NOT remove). The unset is sequenced before the hook lookup because the lookup is independent of marker state — the helper reads hooks.json by `--hook-key` regardless — so it is safe to clear the marker first and reduce the window where the daemon would otherwise still skip this (now-hydrated) pane.
     g. Read hooks.json; look up this pane's resume hook using the --hook-key argument (the saved structural identifier), not the helper's live tmux position. This preserves hooks across base-index / pane-base-index drift.
     h. If hook exists: exec sh -c 'HOOK; exec $SHELL'.
        Else:           exec $SHELL.
  3. On 3-second timeout (no signal arrived):
     a. Emit reset preamble only (no content dump).
     b. Skip the 100ms sleep.
     c. Do NOT unset the skeleton marker — next attach will re-signal and retry.
     d. Log a warning to portal.log.
     e. exec $SHELL (bare shell; no hook firing on this path).
  4. On scrollback file missing / unreadable (detected at step 2c of the signal path):
     a. Emit reset preamble only (no content dump).
     b. Log a warning.
     c. Skip the 100ms sleep (nothing was dumped).
     d. tmux set-option -su @portal-skeleton-<paneKey> — remove the marker inline so the save loop resumes capturing this empty pane.
     e. Continue to step h (hook/shell exec). Hook runs if registered; else bare shell.
```

Reset sequences are short strings (~20 bytes total preamble + postamble). Overhead is imperceptible against the 500–1500ms dump they bracket.

### Timeout: 3 Seconds

- Normal signal latency: ~10–50ms.
- Slow-but-legit upper bound (NFS home, heavy system load, slow hook script): ~1–2s.
- 3s ≈ 2× the slow-legit tail. Fast enough to degrade snappily on real failures without cutting off rare slow-legit cases.

### The 100ms Settle Sleep (Why the Helper Owns Marker-Unset)

The helper's `write()` to stdout returning does **not** mean tmux has finished parsing the written bytes. tmux runs the VT parser in a separate process with its own event loop; there is an asynchronous lag between bytes arriving at the PTY slave and those bytes being added to the pane's scrollback ring.

If `signal-hydrate` unset the marker immediately (right after writing the FIFO byte), the daemon's next tick could run while the helper is still mid-dump. `capture-pane` would return partial scrollback; content-hash dedup would compute a hash based on the partial state and overwrite the full saved scrollback file with a truncated version.

Transferring marker-unset ownership to the helper makes "marker cleared" synonymous with "helper's output is complete and the pane's scrollback is in its final form." The 100ms sleep before the unset is a safe margin against tmux's PTY-parser lag (typical lag is ~1ms; 100ms is generous without being user-perceptible against the 500–1500ms dump).

### Marker Lifecycle Summary

- **Skeleton-restore sets** `@portal-skeleton-<paneKey>` when creating each pane.
- **Save loop skips** any pane with the marker set.
- **`signal-hydrate` writes to FIFO** but does not touch the marker.
- **Helper unsets marker** after dump + 100ms sleep, or immediately if the scrollback file was missing (empty pane path).
- **Helper does NOT unset marker** on FIFO timeout — next attach re-signals, retry happens naturally.
- **Save loop resumes capturing** the pane on the next tick once the marker is cleared.

### Failure Modes (Mechanism-Level)

- **Scrollback file missing on helper startup.** Helper logs a warning, emits reset preamble only, skips content dump, unsets marker, exec's hook/shell. Empty pane, not stuck.
- **FIFO pre-opened but hook handler crashed before writing.** Helper blocks until 3-second timeout, degrades to empty shell, logs a warning. Marker stays set — next attach retries.
- **Helper crashes mid-dump.** Pane ends up with partial content + dead process. Shell never starts. User sees a stuck pane. Recovery: user kills the pane manually; next bootstrap re-skeletons the structure (scrollback file may be mid-written or corrupt, so some bytes may be missing — truncation, not corruption). Documented as a "shouldn't happen" case.
- **Signal fires twice somehow** (e.g., both `client-attached` and `client-session-changed` fire for the same logical attach). Second write to the FIFO goes nowhere (the helper has already closed and unlinked the FIFO). Harmless.

### Implementation Notes

- FIFOs are POSIX primitives; `syscall.Mkfifo` is the Go entry point. Supported on Linux and macOS, consistent with Portal's existing platform targets.
- The `; exec $SHELL` chain is a shell construct; the pane's command must be invoked as `sh -c '...'` so the shell parses the `;` correctly.
- The helper's blocking FIFO read must implement a timeout. Go's standard `os.File.Read` on a FIFO does not time out on its own. Use a goroutine + `time.After` channel + `select` (or equivalent I/O-with-deadline pattern).

### Validation Reference

The mechanism was empirically validated on an isolated tmux socket during discussion:
- `cat FILE; exec bash` pattern: 1000-line ANSI scrollback rendered correctly; clean `bash-5.3$` prompt at end.
- Shell history contained only post-test commands — no helper, no `cat`, no scrollback content.
- Blocking-FIFO variant: pane empty before signal; after `echo "go" > fifo`, scrollback rendered and shell prompt appeared.
- Default-socket sessions were verified identical before and after the test — validation does not contaminate the user's live tmux state. The isolated socket pattern (`tmux -L <unique-name>`) is the recommended approach for future mechanism verification.

### Rejected Alternatives

- **`paste-buffer` / `send-keys` / `pipe-pane -I`.** Broken. Target the shell's stdin, not the pane's display. Confirmed via tmux source review.
- **Direct `/dev/pts/<N>` write.** Viable but has a positioning race (shell has already prompted). Mitigation via `\033[2J\033[H` + SIGWINCH redraw is feasible but more complex. Rejected in favor of helper pre-shell.
- **Fully-eager at skeleton restore time.** Would eliminate attach-time latency entirely at the cost of 2–15s boot delay. Rejected in favor of pure-lazy.
- **Zellij-style confirmation prompt before scrollback injection.** Portal's resume hooks are already explicit opt-in via `portal hooks set`; scrollback injection is just replaying the user's own history into their own pane. No second-stage confirmation needed.

## Resume Hook Firing

### Firing Point: Inside the Helper's Exec Chain

Resume hooks fire **only** from inside the hydrate helper's exec chain, at the end of successful hydration. There is no attach-time hook firing, no `send-keys` involvement, and no shell-readiness polling.

After the helper has dumped scrollback, slept 100ms, and unset its skeleton marker (see Scrollback Restore Mechanics), the helper:

1. Reads `hooks.json`.
2. Looks up the resume hook for this pane's structural key (`session:window.pane`).
3. If a hook exists → `exec sh -c 'HOOK; exec $SHELL'`. When the hook command exits (or immediately, if it's a background process), `exec $SHELL` takes over the same process.
4. If no hook exists → `exec $SHELL` directly.

### Why Firing Belongs Only in the Helper

**Hooks are for reboot recovery.** A hook "firing" means "re-launch this process when the pane comes back from the dead." The only moments when a pane comes back from the dead are:

1. After a server restart — skeleton restore creates the pane fresh with the hydrate helper chain.

That is the complete list. Within a single server lifetime, a pane that still exists does not need its hook re-fired — the hook's process either still exists or was explicitly killed by the user. Firing `claude --resume <uuid>` on a detach/reattach of a pane that already has Claude running would actively break things.

### What Is Deleted from the Previous Design

- **`ExecuteHooks` function.** Deleted. No more attach-time hook execution.
- **Call sites of `ExecuteHooks` in `cmd/open.go` and `cmd/attach.go`.** Deleted.
- **`internal/hooks/executor.go`.** Deleted.
- **`cmd/hook_executor.go`.** Deleted.
- **`@portal-active-<pane>` volatile marker** set during `portal hooks set` as a one-shot-per-server-lifetime gate. Deleted. The registration path (`portal hooks set`) becomes a pure write to `hooks.json` with no tmux-side marker management.
- **All attach-time hook checking.** Deleted.
- **Shell-readiness polling** for `send-keys` delivery. Eliminated — nothing uses `send-keys` for hook firing any more.

### What Stays Unchanged

- **`hooks.json` storage** and its on-disk schema.
- **User-facing CLI:** `portal hooks set --on-resume "<cmd>"`, `portal hooks list`, `portal hooks rm --on-resume`. Surface unchanged; internals simplified.
- **Structural-key scheme** (`session:window.pane`) for identifying hooks.
- **`CleanStale`** for pruning orphaned hook entries (with the guard change described in "CleanStale Behavior").

### Behavior Change: No "Live Attach" Firing

The only scenario where new behavior differs from old:

- **Old:** a hook registered on a pane that has not yet gone through a save/restore cycle; user detaches and reattaches within the same server lifetime. Old design fired the hook via `send-keys` once per server lifetime (one-shot via the `@portal-active-<pane>` marker).
- **New:** the hook does not fire until the next server restart triggers skeleton restoration.

This is correct behavior by design. The old "live attach firing" was the exact misbehavior the `@portal-active-<pane>` marker existed to mitigate — firing `claude --resume` on a pane that already has Claude running breaks things. The marker-at-registration approach worked only because it happened to be a one-shot-per-server-lifetime gate; it was never the right model.

Under the new design, hooks fire exactly when a pane is freshly recreated from saved state. This matches the user's mental model of "hooks are for reboot recovery" and aligns with the semantic of the hook system being a reboot-recovery mechanism.

### `run-shell` Blocking Note

`signal-hydrate` (fired from `client-attached` / `client-session-changed` hooks) does non-trivial work: enumerate panes in the attached session, check markers, write to up to N FIFOs. For a 30-pane session, cost is ~50–150ms.

tmux's `run-shell` is synchronous by default and blocks the server during hook execution. Acceptable for initial release — the user is actively attaching; sub-150ms is imperceptible at the moment of attach. If real-world use reveals problems (other clients feeling laggy during heavy attaches), switch to `run-shell -b` (async). tmux 3.0+ appears to have settled earlier `-b` flag issues (see tmux#1843, tmux#2306 for the historical context); however, the primitive remains unused by mainstream tmux plugins as a poor-man's-daemon pattern. Defer the async switch until there is evidence the synchronous blocking matters in practice.

### Net Simplification

A whole execution path is removed: attach-time hook firing + shell-readiness workaround + registration-side marker. Hook firing is folded into the hydrate helper's exec chain — an `exec` replacement that was going to exist for scrollback injection anyway. The hook fires exactly once, exactly at the right moment, with no `send-keys`, no polling, no racing.

### Session Rename: Hook Key Migration

Hook structural keys are of the form `session:window.pane`. When a user runs `tmux rename-session`, the `session-renamed` event fires and Portal must migrate any affected hook keys so they remain addressable on the renamed session.

**Migration mechanism.** Portal registers a **separate internal subcommand** — `portal state migrate-rename <old-name> <new-name>` — against the `session-renamed` tmux hook, in addition to the existing `portal state notify` registration. The two hooks coexist on the same event via the same content-based idempotency pattern applied to every other hook (see tmux Hook Registration Lifecycle). `migrate-rename` reads `hooks.json`, rewrites every key matching `<old-name>:*` to `<new-name>:*`, and writes via `AtomicWrite`. `portal state notify` stays minimal (no tmux reads, no hooks.json reads).

**Argument source.** tmux's `session-renamed` event exposes both names via format expansions (e.g., `#{hook_session_name}` for the current name; the prior name via `#{client_last_session}` is not reliable). Portal's implementation passes the session name via `#{session_name}` at hook-fire time and reconciles against an in-memory "last-seen names" map maintained by the daemon — or, more simply, uses the `session-renamed` hook's exposed variables (tmux versions vary in what is accessible). Planning-phase decides the exact wiring; the contract from the spec: hook keys are migrated atomically on rename events, the migration path is a distinct subcommand (not `notify`), and best-effort logging on failure.

**Failure mode.** If migration fails (malformed names, I/O error), hooks for the renamed session get orphaned and pruned by the next `CleanStale` run. User-visible recovery: re-register the hook against the new session name. Migration is best-effort — no retry storm on failure.

**v1 deferral (post-implementation note).** The rename-key migration hook is **not registered in v1**. tmux's `session-renamed` event reliably exposes only the new session name (`#{hook_session_name}`); the prior name is not retrievable from the hook itself, and the "last-seen names" map sketched above requires daemon-side tick-time enumeration plus persistence of the prior-tick name set keyed by `#{session_id}` so the hook can read the (oldName, newName) delta. That work is out of v1 scope. Shipping the hook with both arguments expanding to the new name produces a silent identity rewrite on every rename, so v1 ships without the registration entirely — `cmd/state_migrate_rename.go` remains in the tree as the future endpoint. Until v2 lands the daemon-side tracking, hooks for renamed sessions are orphaned and pruned by `CleanStale`; users recover by re-registering against the new name. See the implementation note in `internal/tmux/hooks_register.go` for the v2 entry point.

## Layout Restoration

### Per-Window Restoration Order

For each window being restored:

1. **Create the window** (`new-window` — the first pane is created implicitly).
2. **Create remaining panes** via `split-window` to reach the saved pane count. Direction arguments are arbitrary — the next step rearranges.
3. **`select-layout "<saved layout string>"`** — tmux parses the string and fits the panes to the saved geometry.
4. **`select-pane -t <saved active pane index>`** — set the active pane within the window.
5. **`resize-pane -Z`** on the active pane if `window_zoomed_flag` was true at save time.

Zoom **must come after** layout. `resize-pane -Z` operates on the current layout geometry, and applying it before `select-layout` would produce incorrect results. This ordering matches tmux-resurrect's proven approach.

### Layout String Source

Portal captures `#{window_layout}` (pre-zoom form), not `#{window_visible_layout}`. The pre-zoom form is the correct input for `select-layout` replay. Storing the zoomed form would cause `select-layout` to collapse panes incorrectly on re-application.

Zoom state is captured separately as a boolean (`zoomed` field in `sessions.json`) and re-applied after layout, via `resize-pane -Z`.

### Pane-Count Mismatch / `select-layout` Failure

`select-layout` requires the current pane count to match the saved layout string. Portal's restoration creates exactly the right count from `sessions.json` before applying the layout, so under normal conditions there is no mismatch.

**If `select-layout` returns an error** (corrupt layout string, pane-count mismatch from partial restore, unexpected tmux behavior):

1. Log a warning to `portal.log` identifying the session, window, and the mismatch.
2. Fall back to `select-layout tiled` — tmux's built-in auto-balanced tiled layout. Panes are visible in a sane default arrangement.
3. Continue restoring the remaining windows and sessions. One broken layout does not block other restorations.

Degraded but not stuck. Consistent with the broader "degrade locally, log, continue" principle.

### Terminal Size Drift

Layout strings encode absolute pane dimensions. If a session was saved on a 200×50 terminal and restored into an 80×24 terminal, `select-layout` does best-effort fitting — proportions shift, some panes may be cramped.

Neither Portal nor any other tool solves this at the tmux level; it is a fundamental tmux constraint. Portal does no special handling for this case:

- `select-layout "<saved>"` is always applied as-is.
- tmux fits as best it can.
- If the user cares, they can resize their terminal to match the save-time dimensions.
- `select-layout -E` ("spread evenly") is not used as a fallback — it loses the saved proportions, trading faithful-but-cramped for even-but-different. Default to faithful.

### Zoom State

- Captured at save time as `window_zoomed_flag` (boolean).
- Stored in `sessions.json` as `zoomed: true|false` per window.
- Re-applied via `resize-pane -Z` on the active pane after `select-layout`, if true. `resize-pane -Z` is a toggle; applying it when already zoomed would un-zoom. The restore flow assumes zoom is off immediately after layout application (the saved layout string is pre-zoom), so an unconditional `-Z` when `zoomed` is true produces the correct state.

### Summary of Order

```
new-window <name> -c <cwd>      # window + first pane
split-window × (N-1)            # remaining panes
select-layout "<saved>"         # apply geometry
select-pane -t <active>         # set active pane
if zoomed: resize-pane -Z       # re-apply zoom
```

Mechanical and low-risk. No special logic beyond the fallback on `select-layout` failure.

## Bootstrap Flow (Integrated)

### `PersistentPreRunE` Sequence

Every Portal command that needs tmux runs this sequence, in this order. The **exempt commands** (skip bootstrap entirely) are: `version`, `init`, `help`, `alias`, `clean`, and all `portal state ...` subcommands — both user-facing (`portal state status`, `portal state cleanup`) and internal (`portal state daemon`, `portal state notify`, `portal state signal-hydrate`, `portal state hydrate`). The internal subcommands are invoked from hooks or as pane commands and would otherwise recursively re-bootstrap; the user-facing `state` commands inspect or tear down the very machinery that bootstrap sets up, so running bootstrap first would be circular.

**1. `EnsureServer()`** — start tmux server if not running. Set `serverStarted=true` in `cmd.Context()` if Portal started it.

**2. Register global hooks idempotently** (`set-hook -ga` with content-based check):
- Save-trigger events (`session-created`, `session-closed`, `session-renamed`, `window-linked`, `window-unlinked`, `window-layout-changed`, `pane-focus-out`) → `run-shell "command -v portal >/dev/null 2>&1 && portal state notify"`.
- Hydration-trigger events (`client-attached`, `client-session-changed`) → `run-shell "command -v portal >/dev/null 2>&1 && portal state signal-hydrate #{session_name}"`.
- For each (event, expected-command) pair, parse `show-hooks -g` and append only if the Portal entry for that event is absent.

**3. Set `@portal-restoring 1`** as a server-level option. Must happen *before* `_portal-saver` is created, because creating `_portal-saver` fires `session-created` which triggers the dirty-flag notify path; `@portal-restoring` ensures that notify is a no-op while bootstrap is still running.

**4. `_portal-saver` session setup** (idempotent):
- `has-session -t _portal-saver` — if present, skip creation.
- If absent: `new-session -d -s _portal-saver "portal state daemon"`.
- Read `~/.config/portal/state/daemon.version`; compare to `cmd.version`:
  - If `cmd.version` is empty or `"dev"` → always restart (kill + recreate) on bootstrap.
  - If version file is absent → treat as mismatch (first-ever bootstrap).
  - If stored version differs from `cmd.version` → `kill-session -t _portal-saver`, then recreate with the new binary.
  - Else → leave running.
- Always run `set-option -t _portal-saver destroy-unattached off` (defensive, idempotent).

**5. `Restore()` — skeleton-only restoration.** TUI path wraps this step (and steps 6-8) with the loading page (1.2s minimum display). CLI path runs silently.

- If `~/.config/portal/state/sessions.json` does not exist → no-op; continue to step 6.
- If `sessions.json` is unparseable (corrupt JSON) → log warning, print one-line stderr warning, skip restoration entirely; continue to step 6.
- Otherwise, parse `sessions.json`. For each saved session:
  - `has-session -t <name>` → if live, skip this session.
  - Else, skeleton-create it:
    1. `new-session -d -s <name> -c <root_cwd>` for the first pane (no command argument; the pane is created with the default shell and armed via `respawn-pane -k` in the arm phase below).
    2. **Apply captured session environment** before creating any additional windows/panes: for each key/value in the saved `environment` map, run `tmux set-environment -t <name> <KEY> <VAL>`. This happens **after** `new-session` but **before** any subsequent `new-window` or `split-window`, so every subsequent pane inherits the saved per-session env at creation time. Removed-form variables (`-r` in tmux's on-wire syntax) were not captured; only plain set values round-trip.
    3. `new-window` / `split-window` for remaining windows and panes (no command argument; default shell, armed in step 4 below).
    4. **Arm each created pane with the hydrate helper.** Per pane, in order:
       a. Compute FIFO path (`~/.config/portal/state/hydrate-<paneKey>.fifo`); remove any pre-existing inode (regular file, symlink, FIFO) via `os.Remove` (ignore `ENOENT`); `syscall.Mkfifo(path, 0600)`; then `os.Chmod(path, 0600)` defensively against an unusually-tight umask. The FIFO must exist before the helper opens it for read, so creation is sequenced immediately before arming.
       b. `tmux respawn-pane -k -t <pane> "sh -c 'portal state hydrate --fifo <F> --file <scrollback> --hook-key <K>; exec $SHELL'"`, where `<K>` is the saved structural identifier `<raw-session>:<saved-window>.<saved-pane>`. `respawn-pane -k` atomically kills the default shell tmux created in steps 1/3 and replaces the pane's process with the helper in a single call — no shell output reaches scrollback before the helper runs.
    5. Per window: `select-layout "<saved>"`, `select-pane -t <active>`, `resize-pane -Z` if `zoomed`.
    6. For each created pane: `tmux set-option -s @portal-skeleton-<paneKey> 1` — the `-s` flag targets the server-option scope (load-bearing; matches the daemon's `show-options -sv` enumeration). Server-option scope is volatile — markers clear automatically on tmux server restart.
- On `select-layout` failure for a window: fall back to `select-layout tiled`, log, continue.
- On any per-session error: log, skip that session, continue with the next.

**6. Unset `@portal-restoring`.** Save loop resumes normal operation on its next tick. Daemon will capture new user state and skip skeleton-marked panes.

**7. `SweepOrphanFIFOs`** — best-effort cleanup of orphan `hydrate-*.fifo` files whose paneKey is no longer represented by a live `@portal-skeleton-*` marker.

**8. `CleanStale()`** — prune stale entries from `hooks.json` whose structural keys do not match any currently-live pane. Runs unconditionally (no empty-panes guard — see CleanStale Behavior section). Runs here because by this point live panes include both pre-existing and skeleton-restored ones.

**9. Return to the calling command.** TUI: loading page is dismissed once the 1.2s minimum has elapsed AND restoration completed. CLI: returns immediately after step 9.

### Ordering Rationale

The critical ordering — `@portal-restoring` is set in step 3 **before** `_portal-saver` is created in step 4 — exists because step 4 fires `session-created`, which the hook pipeline would otherwise use to dirty the flag. Without `@portal-restoring` set first, the daemon's first tick could attempt to capture while the restoration is still building structure.

With the ordering above:
- `@portal-restoring` set → daemon's first tick no-ops.
- Restoration runs → more structural events fire → every one is a no-op on the notify side because `@portal-restoring` is still set.
- `@portal-restoring` cleared → next daemon tick captures the now-complete post-restoration state.

Hook registration (step 2) similarly precedes `_portal-saver` creation (step 4). Creating `_portal-saver` fires a `session-created` event; with hooks already registered, the notify pathway is intact from the daemon's very first moment of existence. The `@portal-restoring` marker suppresses the initial capture, but the ordering keeps the hook pipeline fully wired rather than racing registration against the new session's first event.

`@portal-skeleton-<paneKey>` markers are set as each pane is created, so even after `@portal-restoring` clears, the daemon correctly skips unhydrated panes until their helpers complete.

### Attach Flow (After Bootstrap)

When the user selects a session via the picker, runs `portal attach NAME`, or issues any other attach command:

1. Portal's open/attach code resolves the target session (alias, path, direct name, or TUI selection).
2. `tmux switch-client -t <session>` if Portal is running inside tmux; else `exec tmux attach-session -A -t <session>` (handing off the process via `syscall.Exec`).
3. tmux fires `client-attached` (bare-shell attach) or `client-session-changed` (inside-tmux switch).
4. The registered hook runs `portal state signal-hydrate <session-name>` as a `run-shell` subprocess. `<session-name>` comes from `#{session_name}` format expansion, passed as argv.
5. Subprocess work:
   - `list-panes -t <session-name>` → enumerate panes in the attached session.
   - For each pane with `@portal-skeleton-<paneKey>` set: write a byte to the pane's FIFO. Do **not** touch the marker.
   - For each pane without the marker: no-op (already hydrated or never skeleton-restored).
6. Per-pane helpers unblock, dump scrollback, sleep 100ms, unset own markers, exec hook-or-shell.
7. Daemon's next tick (sub-second away) captures now-hydrated panes normally. Content-hash dedup skips rewrites unless scrollback has legitimately changed.
8. User is in the session. Scrollback is rendered. Hook (if any) is running; shell takes over when hook exits.

### Return-to-Caller Timing

- **TUI path:** bootstrap runs. Loading page shows for minimum 1.2s (padded if restoration was faster; natural if slower). TUI appears with populated picker. User selects → attach flow runs.
- **CLI path** (e.g., `portal attach NAME`, `portal hooks set ...`): bootstrap runs silently; command-specific logic runs next. For `portal attach NAME` where the target was in `sessions.json`, skeleton was restored before the attach logic runs, so `has-session -t NAME` returns true by the time the attach needs it.

### Loading-Page Minimum Display (TUI Only)

Skeleton restoration typically completes in ~600ms for a heavy 10-session configuration. A loading page that flashes in and out sub-second reads as a UI glitch rather than a deliberate moment. Portal enforces a **minimum display duration of 1.2 seconds** for the loading page:

```
start := time.Now()
// show loading page
// bootstrap steps 1-9 run
elapsed := time.Since(start)
if elapsed < 1200*time.Millisecond {
    time.Sleep(1200*time.Millisecond - elapsed)
}
// dismiss loading page
```

- If bootstrap is faster than 1.2s → padded to exactly 1.2s.
- If bootstrap is slower than 1.2s → loading page stays until bootstrap returns.

1.2s is intentional: long enough to register as an intentional UX beat, short enough to not become friction.

**Visual treatment.** Reuse Portal's existing loading page as it is today. No new visual redesign is specified. The page's displayed message text may be updated in planning to reflect restoration (e.g., "Restoring sessions…") instead of the previous "waiting for sessions" copy; the decision is cosmetic and local to the TUI package.

**CLI path has no loading page, no "Restoring..." output.** Typical bootstrap is ~600ms; fast enough to not need a progress indicator. If long waits surface as user complaints, a stderr one-liner can be added later when `elapsed > 2s`. YAGNI for v1.

### Scope of Bootstrap Decisions vs. Implementation

Everything in this section is design-level. Implementation will pin down:
- Exact tmux command sequences (specific flags, error-handling on each call).
- Go error-propagation strategy for partial failures during restoration.
- Stale-FIFO cleanup on bootstrap (state-directory scan to remove any leftover `hydrate-*.fifo` files that do not match an active pane).
- Unit tests using isolated tmux sockets (`tmux -L <socket>`) for restoration correctness.

These belong in the Planning phase, not in this specification.

## WaitForSessions / bootstrapWait Removal

### What Is Deleted

- **`internal/tmux/wait.go`** — where `WaitForSessions` lives. Deleted entirely.
- **`bootstrapWait` function** (in the `cmd` package). Deleted.
- **All call sites** of both functions. Deleted.

### Why

`WaitForSessions` and `bootstrapWait` existed because Portal had no control over *when* resurrect/continuum would finish populating sessions after startup. They polled (1–6s window, stderr progress output) as a hedge against upstream plugins being slow or failing.

Under the new design, Portal owns restoration directly. When `Restore()` returns, skeleton-restored sessions exist because Portal just created them synchronously. There is nothing to wait for.

### Replacement

A single synchronous `Restore()` call in `PersistentPreRunE`, immediately after `EnsureServer()` and the hook-registration / `_portal-saver` setup steps. When it returns, live tmux state reflects every saved session that was not already live. No polling, no external dependency, deterministic timing.

### What Stays

- **`EnsureServer()`** — keeps its job of starting the tmux server if not running.
- **`serverStarted` flag** in `cmd.Context()` — still used by other call sites (e.g., decision whether to show bootstrap messages).
- **The loading page itself** — retained for the TUI path, with the 1.2s minimum-display-time padding described in Bootstrap Flow.

### Behavioral Improvement

- **Previous:** "Waiting for sessions to populate (up to 6s)" — unpredictable, external-dependency-driven.
- **New:** Bounded by the 1.2s minimum display time and restoration's actual cost (~600ms for heavy configs). No external dependency; timing is deterministic.

## CleanStale Behavior

### Change

**Delete the `if len(livePanes) == 0 { return }` early return** from `CleanStale`'s current implementation. `CleanStale` now runs unconditionally, trusting live tmux state whenever it is invoked.

### Why the Guard Existed

The current guard skipped cleanup when `list-panes -a` returned empty — a hedge against Portal running CleanStale before resurrect/continuum had a chance to restore panes after reboot, which would have nuked all hooks prematurely.

That guard was a workaround for Portal not owning restoration.

### Why It Is Removed

Under the new bootstrap flow, `CleanStale` runs in **step 8 of `PersistentPreRunE`** — *after* skeleton restore completes in steps 5-6. By that point, live panes include both pre-existing panes and skeleton-restored ones. If `list-panes -a` is genuinely empty at step 8, there really are no sessions, and any hooks.json entries are genuinely orphaned.

### Where CleanStale Runs

- **Bootstrap step 8** (every non-exempt `PersistentPreRunE` invocation, post-restore). Keeps `hooks.json` consistent with live state on every Portal command that goes through bootstrap.
- **`portal clean` command** (user-initiated). Exempt from bootstrap. The command's body calls `CleanStale()` directly against live tmux state. Because it skips bootstrap, there is no skeleton-restore step preceding it — but `portal clean` is a user-initiated cleanup on whatever tmux is currently live, so that is the intended semantic. If no sessions are live when the user runs `portal clean`, and `hooks.json` has entries, they are genuinely orphaned and get pruned.

### Stale-Hook Detection Criteria (Unchanged)

An entry in `hooks.json` is considered stale if its structural key (`session:window.pane`) does not match any live pane enumerated by `list-panes -a`.

**Explicitly NOT criteria for staleness:**
- Hook command's binary missing. That is a runtime execution error when the hook fires, not a stale-entry condition. Portal does not validate hook commands.
- Project removed from `projects.json`. Portal's hook system is generic and has no coupling to `projects.json`.

Keeping the criteria narrow matches the generic-hook design principle: Portal stores and fires commands; validation is the caller's responsibility.

### Refactor Scope

Small mechanical change: remove the `len(livePanes) == 0` early-return branch. Everything else (structural-key matching, atomic write of updated `hooks.json`) stays as it is today.

## CLI Surface

### User-Facing Commands (Under `portal state`)

#### `portal state status`

Liveness check and diagnostic output. Readable in a terminal; exit code is scriptable.

**Output (example):**

```
Portal state:
  Save daemon: running (pid 12345, version v0.4.2)
  Last save: 12 seconds ago
  Sessions captured: 10
  Panes captured: 34
  State size: 18.2 MB on disk
  Recent warnings: 0 (last: none)
```

**Data sources:**
- **Daemon liveness:** `has-session -t _portal-saver` plus process verification (pane command resolves to `portal state daemon`).
- **Last save time:** `sessions.json.saved_at`.
- **Session / pane counts:** parsed from `sessions.json`.
- **State size:** total disk usage under `~/.config/portal/state/`.
- **Recent warnings:** scan `portal.log` for entries within the last hour.

**Exit code:**
- `0` — healthy (daemon running, last save recent, no recent warnings).
- non-zero — notable problem (daemon not running, last save older than 5 minutes, recent errors in the log).

Scriptable as well as human-readable.

**Scan window semantics.** "Recent warnings" and the exit-code "recent errors" check use the **same one-hour window**, measured from now back over entries in the *current* `portal.log` file only. `portal.log.old` is not scanned (its entries are considered older historical data, not "recent"). If `portal.log` does not exist (first-ever run, no warnings logged yet), both displayed count and exit-code treatment are **zero/healthy** — missing log file is never itself a warning.

#### `portal state cleanup`

Explicit teardown for users removing Portal or wanting a clean slate.

Actions (in order):
1. `kill-session -t _portal-saver` to terminate the daemon (SIGHUP → final flush on the way out). Idempotent: absent session is not an error.
2. Remove Portal's `set-hook -ga` entries via index-based `set-hook -gu '<EVENT>[N]'` for each event/command pair Portal registers (see tmux Hook Registration Lifecycle for the removal protocol). Already-absent entries are not an error.
3. Remove `~/.config/portal/state/` only when explicitly requested via the `--purge` flag. Default behaviour leaves the state directory intact so re-installing Portal picks up where the user left off.

**Exit codes:**
- `0` — all requested actions completed successfully (including idempotent no-ops when nothing needed to be cleaned).
- non-zero — one or more actions failed (e.g., tmux `set-hook -gu` errored, `kill-session` failed for non-"session-absent" reasons, `--purge` specified but rmdir failed). Partial failures still attempt subsequent actions — `cleanup` never aborts partway to leave mixed state — but the exit code reflects that at least one action did not succeed. Failures are also logged to `portal.log`.

**Not required for correctness.** The defensive hook guard (`command -v portal`) and self-healing idempotency checks handle the "user uninstalled without running cleanup" case transparently. `portal state cleanup` is a first-class option for users who want a deliberate teardown.

### Internal Subcommands (Hidden from `portal --help`)

These subcommands are invoked by tmux hooks and the hosted daemon. They are Portal-internal and not intended for direct user invocation, so they are excluded from `--help` output (Cobra's `Hidden: true` pattern or equivalent).

#### `portal state daemon`

The long-running process invoked as the `command` of the `_portal-saver` session. Responsibilities:

- Write `~/.config/portal/state/daemon.version` on startup with `cmd.version`.
- Write `~/.config/portal/state/daemon.pid` on startup with the daemon's OS PID.
- Clear `save.requested` on startup (defensive).
- Perform log-rotation check on startup (rotate `portal.log` → `portal.log.old` if the current log is ≥1 MiB).
- Seed the in-memory `paneKey → scrollback-hash` map from existing `scrollback/*.bin` files (avoids full-rewrite on every startup).
- Hold the in-memory `paneKey → scrollback-hash` map for content-hash dedup.
- Run the 1-second ticker loop.
- Honor `@portal-restoring` (skip ticks while set).
- Trap SIGHUP and SIGTERM; flush final state (unless `@portal-restoring` is set).

#### `portal state notify`

A small binary (~20 lines of Go) invoked by tmux save-trigger hooks. Responsibilities:

- Touch `~/.config/portal/state/save.requested` (create if absent, bump mtime otherwise).
- Exit 0.

That is the entire behavior. No tmux calls, no state file reads, no logging beyond critical errors. Designed for minimum latency on the hot path of every structural event.

#### `portal state signal-hydrate <session-name>`

Invoked by `client-attached` / `client-session-changed` hooks. Responsibilities:

- `list-panes -t <session-name>` → enumerate panes in the attached session.
- For each pane with `@portal-skeleton-<paneKey>` set: open the pane's FIFO for writing, write a single byte, close.
- For each pane without the marker: no-op.
- Idempotent (safe to double-fire across `client-attached` + `client-session-changed` for a single logical attach).

Does **not** unset skeleton markers. The helper owns that.

#### `portal state hydrate --fifo F --file S --hook-key K`

The pane's initial command at skeleton restore time, wrapped in `sh -c 'portal state hydrate ...; exec $SHELL'`. All three flags are required:
- `--fifo F` — absolute path to the per-pane FIFO (created by bootstrap immediately before arming the pane).
- `--file S` — absolute path to the saved-indexed scrollback file to dump on signal.
- `--hook-key K` — saved structural identifier `<raw-session>:<saved-window>.<saved-pane>`, used to look up the resume hook in `hooks.json`. This preserves hooks across `base-index` / `pane-base-index` drift between save and restore.

Responsibilities per Scrollback Restore Mechanics:

- Block on FIFO read (3s timeout).
- On signal: close + unlink FIFO, emit reset preamble, dump scrollback file, emit reset postamble + CRLF, sleep 100ms, unset skeleton marker, read hooks.json, exec hook-or-shell.
- On timeout: emit reset preamble only, leave marker set, log warning, exec bare shell.
- On file missing: emit reset preamble only, log warning, clear marker (by the signal path reaching step f), exec hook-or-shell.

### No User-Facing Manual Save Command

`portal state save` (manual synchronous save) was considered and **rejected**. Every proposed use case was already covered:

- *"Save before reboot"* — SIGHUP flush on tmux server shutdown + 30-second max-gap already cover this.
- *"Scripting / automation"* — speculative; no concrete workflow identified.
- *"Pre-risky-action save"* — same as the reboot case.
- *"Psychological reassurance"* — not a technical need.
- *"Debugging the save mechanism"* — developer concern; can touch the dirty flag manually.

YAGNI. Can be added later if a concrete automation workflow surfaces.

### Namespace Rationale

All eight resurrection-related commands (two user-facing + four internal) cluster under `portal state`. This keeps related commands grouped logically in `portal --help` output (only the user-facing commands are shown), and the internal commands are all reachable via the same `state` prefix when needed for debugging.

Existing Portal CLI top-level namespaces (`portal hooks`, `portal alias`, `portal clean`, `portal attach`, `portal open`, etc.) are unchanged.

### Unchanged User-Facing Surface

- `portal open` / `portal x` — unchanged, now benefits from automatic restoration at bootstrap.
- `portal attach <name>` — unchanged.
- `portal hooks set --on-resume "<cmd>"` — unchanged surface; internals no longer set `@portal-active-<pane>` marker (see Resume Hook Firing).
- `portal hooks list` — unchanged.
- `portal hooks rm --on-resume` — unchanged.
- `portal clean` — unchanged surface; internals no longer have the `livePanes empty` guard (see CleanStale Behavior).
- `portal alias ...`, `portal init`, `portal version` — unchanged.

## Observability & Diagnostics

### Motivation

Silent failure was one of tmux-resurrect / continuum's most-cited problems — users lost data without any indication something had gone wrong. Portal replacing those plugins risks the same opacity if diagnostics are not built in deliberately.

### Log File

**Location:** `~/.config/portal/state/portal.log`. Lives alongside state data, not in the config directory.

**Format:** single line per entry.

```
timestamp | level | component | message
```

- `timestamp` — RFC 3339 UTC.
- `level` — one of `DEBUG`, `INFO`, `WARN`, `ERROR`.
- `component` — short identifier for the subsystem (`daemon`, `restore`, `hydrate`, `notify`, `hooks`, `bootstrap`).
- `message` — free-form, human-readable.

Human-readable and grep-friendly. No structured / JSON format in v1 (YAGNI).

**Log level:** warnings and errors by default. `PORTAL_LOG_LEVEL=debug` env var enables verbose tracing for debugging sessions.

**What gets logged:**

- Save failures (disk full, write errors, permission issues).
- Restoration warnings (missing scrollback file, layout fallback, corrupt `sessions.json`).
- Hydrate timeouts (3-second signal did not arrive).
- Helper crashes (in the rare cases where they can be observed).
- Bootstrap events at `DEBUG` level only.

### Log Rotation

Simple 2-file cap at **1 MiB per file** (1,048,576 bytes).

- On reaching 1 MiB during a write, Portal renames `portal.log` → `portal.log.old` (replacing any existing old file), then starts a fresh `portal.log`.
- Total disk usage bounded at ~2 MiB.
- Portal performs rotation itself in-process. No external `logrotate` dependency.

**Concurrent-writer discipline.** Multiple Portal processes can log concurrently (daemon + CLI commands + hydrate helpers + signal-hydrate subprocesses). To avoid rotation races (two processes both observing ≥1 MiB and both renaming, clobbering `portal.log.old`), **only the daemon rotates.** Every other Portal writer appends to `portal.log` with `O_APPEND` (POSIX guarantees atomic appends for writes smaller than `PIPE_BUF` — trivially satisfied by a one-line log entry). CLI / helper / subprocess writers do not check size and do not rotate. If no daemon is running and log size grows past 1 MiB, it continues to grow until the next daemon starts, at which point the daemon's startup sequence performs a rotation check and rotates if needed. This is acceptable because: (a) daemon downtime is rare and short; (b) append-only growth during that window is bounded by how much logging happens without a daemon, which is modest.

### `portal state status` (Human-Readable Diagnostic)

Primary user-facing diagnostic entry point. Single invocation surfaces the most useful operational data without requiring the user to know where the log file lives. See CLI Surface section for the full command description.

The output includes a "recent warnings" line that scans `portal.log` for entries within the last hour, giving users a quick pointer to recent failures without needing to read the log manually.

### Proactive Health Signals

**Default: silent.** Portal does not nag about transient issues. Users opt in to visibility by running `portal state status`.

**Exception: genuinely broken states detected during `PersistentPreRunE`.** Portal emits a single line to stderr when a critical problem is detected at bootstrap:

- `_portal-saver` cannot be created after retry attempts:

  ```
  Portal save daemon failed to start — sessions won't be captured.
  Run `portal state status` for details.
  ```

- `sessions.json` exists but cannot be used (corrupt content, unsupported schema version, or unreadable due to permission denial):

  ```
  Portal state file unusable — restoration skipped.
  Check `portal state status` or ~/.config/portal/state/portal.log.
  ```

One line. No banners, no colors, no interactive UI. Just enough signal that the user knows to investigate if they care, and quiet enough not to intrude on normal use.

**TUI interaction.** While the Bubble Tea loading page is active, direct stderr writes would corrupt the rendered UI. The TUI path therefore **buffers** bootstrap warnings in memory during the loading window and emits them to stderr *after* the loading page is dismissed (before the TUI picker renders, or immediately before exit on fatal error). The CLI path writes to stderr directly as described. Both paths log the same content to `portal.log` regardless of stderr behaviour.

### Fatal Bootstrap Errors

"Soft" bootstrap failures (corrupt `sessions.json`, one session fails to restore, `_portal-saver` creation fails after retry) degrade locally and continue. **Fatal** failures — the underlying machinery can't even start — are handled differently:

- **`tmux -V` check fails** (version < 3.0 or `tmux` binary absent): Portal emits the user-facing error immediately to stderr, exits non-zero, does not enter the TUI.
- **`EnsureServer()` fails** (tmux server cannot start, e.g., permission error): emit stderr error, exit non-zero.
- **`set-hook -ga` calls fail** en masse (version check passed but hook calls error anyway): log, emit one-line stderr warning if on CLI path; on TUI path, dismiss loading page cleanly, emit error, exit non-zero.
- **`@portal-restoring` set-option fails**: same as `set-hook` failure.
- **`@portal-restoring` clear (unset) fails at step 6**: same as set-option failure. The marker MUST NOT leak past bootstrap — a stuck `@portal-restoring=1` would suppress every subsequent daemon tick across this server's lifetime, silently breaking persistence.

TUI path: loading page never "hangs forever." Any unrecoverable error tears down the Bubble Tea program cleanly, emits the error, exits. The loading page is only kept up while bootstrap is making progress.

### What Is Explicitly NOT in Scope

- **Metrics endpoint / Prometheus exporter / telemetry.** This is a CLI tool, not a service.
- **Desktop notifications.** Users would not want macOS Notification Center alerts about tmux save status.
- **syslog integration.** Single log file, single tool, local scope.
- **Log search / filter tooling.** `grep` / `awk` over `portal.log` is sufficient.

### Confidence and Scope Rationale

Observability is deliberately modest — enough to diagnose when things break, not so elaborate that it becomes a feature in its own right. The single log file + `portal state status` diagnostic command covers the realistic inspection needs for v1. More elaborate tooling can be added later if real-world usage reveals a gap.

## Failure Modes & Recovery

### Guiding Principle

**Degrade locally, log, continue.** No single failure may crash Portal or leave it stuck. The user is never blocked. Logs capture context for diagnosis. Self-healing where possible.

### Consolidated Failure-Handling Table

| Failure | Handling |
|---|---|
| Scrollback file missing at hydrate time | Helper logs a warning, emits reset preamble only (no dump), exec's shell or hook. Empty pane, not stuck. |
| `select-layout` fails (corrupt string, pane-count mismatch) | Log warning, fall back to `select-layout tiled`. Panes visible in a sane default arrangement; structure approximated. |
| Hydrate signal never arrives (hook failure, FIFO issue) | 3-second timeout; helper degrades to empty shell + logs warning. `@portal-skeleton-<key>` marker stays set; next attach re-signals and retries. |
| `AtomicWrite` mid-crash | Temp file + rename guarantees either the old or new file is intact on disk. Next successful save produces fresh state. |
| Skeleton restore crashes partway | `@portal-restoring` cleared on server restart (volatile marker); next bootstrap retries from scratch. `sessions.json` still holds pre-crash state. Partial tmux structure from the crashed attempt does not block re-restore because `has-session` check skips already-live names; newly-created partial state becomes the live state. |
| Orphaned scrollback files after an interrupted save | GC step at end of each successful save removes files not referenced by the new `sessions.json`. Self-healing. |
| Orphan FIFO from a crashed helper | Defensive `os.Remove` + `syscall.Mkfifo` on each bootstrap sweeps stale `hydrate-*.fifo` files before creating new ones. Additional state-dir scan on bootstrap removes any stale FIFOs not matching a restored pane. |
| tmux server dies mid-save | Hosted daemon in `_portal-saver` dies with the server. Kernel delivers SIGHUP; handler flushes the final save atomically (via `AtomicWrite`) before exit. Next bootstrap recreates the daemon. |
| `sessions.json` corrupt / unparseable | Log warning, emit one-line stderr warning (see Observability), skip restoration entirely, continue bootstrap. User sees an empty picker. Diagnosable via log file or file inspection. Next successful save overwrites with valid content. |
| Disk full during save | `AtomicWrite` fails at write or rename step. Daemon logs the error, continues ticking, and retries on the next tick (or on the next dirty-flag set). Previous save state remains intact on disk. When disk space frees, save resumes normally. Daemon never crashes from disk-full alone. |
| User creates new session mid-restoration | No special handling. Skeleton restore only touches saved sessions from `sessions.json`; pre-existing live sessions (including just-created ones) coexist. `@portal-restoring` blocks captures mid-build, but user commands are not gated. |
| Hydrate helper crashes mid-dump | Pane ends with partial content + dead process. Shell never starts. User sees a stuck pane. Recovery: user kills the pane manually; next bootstrap re-skeletons the structure (scrollback file may be mid-written, so some bytes may be missing — truncation, not corruption). Documented as a "shouldn't happen" case. |
| `_portal-saver` creation fails at bootstrap | Portal retries a small number of times. On persistent failure: log, emit stderr warning (see Observability), continue bootstrap without the save daemon. User can still use Portal; saves are paused until the next successful bootstrap. |
| Upgrade-triggered daemon restart during a save | `kill-session -t _portal-saver` delivers SIGHUP. Handler flushes current state atomically. If `@portal-restoring` is set (edge case), handler skips flush; new daemon captures fresh on first tick. No corruption; worst case is ≤1s of scrollback drift lost. |

### What Is Explicitly NOT Handled Specially

- **Terminal size drift on restoration.** `select-layout` does best-effort fit. Some panes may be cramped if the current terminal is smaller than the save-time terminal. Not Portal's problem to solve — documented as a limitation.
- **Non-existent `cwd` on restore.** If a pane is restored with `-c /path/that/no/longer/exists`, tmux's fallback is to start the shell in the user's home directory. Acceptable; no Portal-side handling.
- **Hook command's referenced binary missing at runtime.** If a hook references `claude` but `claude` is not installed, the hook fails at `exec` time and falls through via the `;` chain to `$SHELL`. User sees the error output, then a shell prompt. Not Portal's problem; the user-facing diagnostic is clear.

### User Feedback on Partial Restoration

Two channels keep failures observable without being intrusive:

1. **Log file.** All warnings and errors go to `~/.config/portal/state/portal.log`. Never silent at the component level.
2. **`portal state status`.** Surfaces recent warnings (last hour). Explicit diagnostic path.

**No in-TUI banners or "restoration partially failed" interstitial UI.** Silent degradation is the right default — failures are rare, and nagging users about every sub-optimal restore adds friction. Log file is the diagnostic path.

### Recovery Self-Healing Properties

Many failure modes self-heal without user intervention:

- **Orphan scrollback files** → cleaned by GC on next successful save.
- **Orphan FIFOs** → swept on next bootstrap.
- **Stripped hooks** (user or other tool runs `set-hook -gu`) → next bootstrap's content-based idempotency check re-appends.
- **Missing `_portal-saver`** → next bootstrap's `has-session` check recreates it.
- **Stale `save.requested` flag** → cleared on daemon startup.
- **Corrupt `sessions.json`** → next successful save overwrites with valid content.
- **Skeleton marker stuck set** (helper crashed before unset) → cleared on server restart (volatile).
- **`@portal-restoring` stuck set** (bootstrap crashed mid-restore) → cleared on server restart (volatile).

User-invoked recovery is almost never required. The only explicit recovery action documented is "kill the stuck pane manually" for the rare helper-crashed-mid-dump case.

## Session & Project Store Interaction

### Restored Session Names

**Restored sessions keep their saved names exactly.** No regeneration of the nanoid, no normalization, no rewriting.

Portal's existing naming scheme is `{project}-{nanoid}` (e.g., `portal-7fj8E6`). When restoration creates a session from `sessions.json`, it uses the `name` field verbatim — identical to how the name appeared in tmux before the reboot.

**Why:** name stability is what makes "your session came back" feel right. Users may have:
- Shell aliases referencing specific session names.
- tmux keybindings scoped to named sessions.
- Scripts that call `tmux attach -t <name>` with hardcoded names.
- Muscle memory for specific session names.

Regenerating the nanoid on restore would break all of these silently.

### `projects.json` Timestamp Handling

**`projects.json` timestamps update only on user-initiated attach, not on restoration.**

Restoration is Portal plumbing — it happens automatically on every `portal open` invocation, regardless of whether the user is actively working with a specific project. If a user has not touched a project in 3 months and then reboots, Portal should not rewrite the timestamp to reflect "just used."

The timestamp semantically tracks **user intent**, not tmux mechanical state. It advances only when the user explicitly engages with the project via Portal's attach flow:
- Selecting a session in the TUI picker.
- Running `portal attach <name>`.
- Any other Portal-initiated attach pathway.

**Caveat:** direct `tmux attach -t <name>` from a bare shell **does not** update `projects.json`. This is consistent with Portal's current behavior — direct tmux commands bypass Portal's tracking. Documented as a known, intentional property.

### Restoration Never Creates New `projects.json` Entries

If `projects.json` does not have an entry for a saved session's project path (perhaps the user manually removed the entry), restoration does not re-create it. `projects.json` stays authoritative for "projects the user has interacted with via Portal."

Session restoration and project tracking are separate concerns. A session existing in tmux does not imply or require a `projects.json` entry.

### Edge Case: Orphan Saved Session

**Scenario:** a user ran `portal open /some/path` months ago (creating a `projects.json` entry). The save mechanism captured the session. Later, the user manually removed the `projects.json` entry (or some future tooling did). The session's saved state persists in `sessions.json`.

**On reboot:** the session is skeleton-restored from `sessions.json`. The `projects.json` entry is **not** re-added. This is the correct behavior:

- The session exists as live tmux state — user can attach via any path.
- `projects.json` reflects user intent — the user removed it deliberately (or effectively).
- No forced linkage between "session exists" and "project tracked in Portal."

If the user attaches to the restored session via Portal's attach flow, Portal's existing logic for new-attach would engage (which may or may not add a project entry depending on invocation shape — governed by existing Portal behavior, not changed by this spec).

### Consistency With Existing Semantics

All of the above are natural extensions of Portal's existing design:

- Name stability matches how Portal already treats session names as user-visible identifiers.
- Minimal-intrusion timestamp updates match how `projects.json` already tracks engagement rather than existence.
- Clear separation between tmux state and `projects.json` state matches Portal's existing "live tmux is the source of truth" principle.

No architectural changes to `projects.json` or the project store are required by this specification.

## Documentation Deliverables

### README "Privacy Considerations" Section

The v1 release includes a brief **Privacy Considerations** section in the README covering:

- Scrollback is persisted to `~/.config/portal/state/` with file mode `0600` (owner-only read/write).
- Same local-filesystem trust model as shell history and debug logs users already have on disk.
- No encryption at rest.
- Users with genuinely sensitive workflows can set `tmux set-option -w history-limit 0` on the relevant window so nothing accumulates in scrollback for Portal to capture; `tmux clear-history` after sensitive output is a related manual mitigation.

This documentation exists because v1 ships without an ephemeral-session opt-out mechanism (deferred per Scope). The README note gives users the tmux-native workarounds so they are not surprised by scrollback persistence for sensitive contexts.

### README Uninstall Section

Document the two supported uninstall paths:

1. **Just remove the binary** (standard package manager uninstall). The defensive `command -v portal` hook guard handles residual tmux state transparently — no error spam, no broken hooks. User data on disk is preserved (standard Unix convention).
2. **Explicit teardown first** via `portal state cleanup` — kills the saver daemon, removes Portal's `set-hook -ga` entries, optionally clears the state directory. For users who want a deliberate clean slate before removing the binary.

### Existing User-Facing Documentation Updates

Changes to existing docs required by this specification:

- **Hooks documentation** (existing `portal hooks` section of the README or any `docs/` page): clarify that hooks fire **on reboot recovery** (when the pane is freshly recreated from saved state), not on every detach/reattach within a server lifetime. Update any examples that assumed the old `ExecuteHooks` attach-time firing semantics.
- **Installation requirements:** document the **tmux ≥ 3.0** requirement.
- **Storage location:** note that Portal now writes to `~/.config/portal/state/` in addition to `~/.config/portal/{hooks.json,projects.json,aliases}`.

### Not Documentation Scope

- **Exhaustive tmux API references** — users don't need to understand `capture-pane -e` internals.
- **Internal architecture diagrams** — the hidden `portal state daemon` / `notify` / `signal-hydrate` / `hydrate` commands are internal; user docs don't need to explain their interplay.
- **Changelog entries** — handled by standard release process, not specified here.

---

## Working Notes
