# Specification: Kill-Rename Prefix Collision

## Specification

## Problem & Root Cause

### The bug

`internal/tmux/tmux.go` exposes two session-mutating Client methods that build their tmux `-t <session>` target argv **without** tmux's `=` exact-match prefix:

- `KillSession(name)` → `kill-session -t <name>`
- `RenameSession(oldName, newName)` → `rename-session -t <oldName> <newName>`

tmux's default target resolution is **prefix-match**. When the named session is not a live exact match but another live session has that name as a prefix (e.g. target `foo` with a live `foo-2`), tmux silently resolves `-t foo` to `foo-2` — operating on the wrong session.

The **kill path is the dangerous one**: destructive, no undo, and silent on a wrong-session kill. `KillSession("foo")` can destroy `foo-2`'s session and surface no error. The rename path is less severe (recoverable) but still incorrect.

### Why it happens

The `=` exact-match policy was introduced by the sibling `enter-attaches-from-preview` work, which applied it only to the five sites in *its* blast radius (the preview Enter / pre-select-and-attach pipeline). The policy lives as an inline `"="+name` string repeated per call site, with **no centralising helper** — so these two destructive callers, sitting outside that pipeline, were never brought under the policy, and there is no single point that enforces it.

Contributing factors:
- **Inline-string policy, no chokepoint** — the prefix is hand-applied per call site, so any `-t` caller can silently opt out.
- **Session names are `{project}-{nanoid}` and freely renamed by the user**, so prefix collisions between coexisting sessions are plausible in practice, not theoretical.

### Why it wasn't caught

The existing unit tests actively **pinned the buggy form**:
- `TestKillSession` (`tmux_test.go`) asserts `kill-session -t my-session`
- `TestRenameSession` (`tmux_test.go`) asserts `rename-session -t old-name new-name`

Both lock in the bare-`-t` argv, so the fix must **update** these assertions, not merely add new ones.

### Impact

- **Severity:** High — `KillSession` is destructive with no undo and fails silently on the wrong session.
- **Scope:** Any portal user with prefix-colliding session names.
- **Business impact:** Data/work loss (a wrong tmux session killed).

## Required Behaviour & The Fix

### Required behaviour

`KillSession(name)` and `RenameSession(oldName, newName)` must operate on **exactly** the named session. The `-t` target must use tmux's `=` exact-match prefix so it binds only to the literal session name and never prefix-matches a different session.

### Chosen approach

**Centralising helper + uniform migration of session-level sites** (the investigation's Option 2, executed for a uniform end-state). Fix the two destructive callers *and* close the inline-string drift surface for session targets, so the codebase reads as if the gap was never there.

**Deciding factor:** the user's explicit steer — "do it properly, not a hack… clean, as if it was never there." A minimal two-caller patch would leave a mixed state (helper for two callers, inline `"="+name` for the rest), itself a new inconsistency. The uniform migration is behaviour-neutral (identical argv) and removes the exact drift surface that allowed the bug, without widening into unrelated sites.

### 1. Introduce the `exactTarget` session-level primitive

In `internal/tmux`:

```go
func exactTarget(session string) string { return "=" + session }
```

This is the session-level sibling of the existing `PaneTargetExact` (pane-level). Together they become the two canonical ways to build an exact-match `-t` target — no inline `"="+name` for a session name left anywhere in the `internal/tmux` package.

### 2. Fix the two destructive callers (the actual bug)

Each via the helper, each with a rationale godoc block mirroring the already-fixed sites:

- `KillSession`: `kill-session -t exactTarget(name)`
- `RenameSession`: `rename-session -t exactTarget(oldName) <newName>`

**Edge case (the one implementer trap):** in `RenameSession`, the prefix goes on the **target only**. `newName` is the literal positional new-name argument and **must stay bare** — prefixing it would corrupt the new session name (the session would literally be named `=...`).

The fix lives entirely at the Client-method chokepoint. Both methods are the single argv-construction point, so fixing the argv inside them covers every caller uniformly — **no caller-side change anywhere**. This includes the internal `_portal-saver` `KillSession` callers (`cmd/state_cleanup.go`, `internal/tmux/portal_saver.go`), which gain the `=` prefix harmlessly (fixed literal name, no possible prefix collision).

**Exposed user-facing callers (the real-world blast radius).** The entry points that actually expose this bug to users are `portal kill <name>` (`cmd/kill.go`) and the TUI kill key (`internal/tui/model.go`) for `KillSession`, and the TUI rename key (`internal/tui/model.go`) for `RenameSession`. The chokepoint fix covers all of them with no caller-side change; these are the surfaces to manually verify the wrong-session kill/rename no longer occurs.

## Migration Scope & Out of Scope

### Sites to migrate onto `exactTarget` (behaviour-neutral)

These already carry the `=` prefix as an inline `"="+name` string for a **session** target. Migrate them onto `exactTarget` so the pattern is uniform across the `internal/tmux` package — a pure readability/anti-drift refactor producing **identical argv**:

- `HasSession` (`tmux.go`)
- `HasSessionProbe` (`tmux.go`)
- `SwitchClient` (`tmux.go`)
- `saverPanePID` (`saver_pane_pid.go`)
- `SaverPaneID` (`saver_pane_pid.go`)

The two `saver_pane_pid.go` sites target the fixed `_portal-saver` name (no collision exposure), but they carry the same inline `"="+session` drift surface, so they migrate for consistency. Their existing tests stay green (argv unchanged); that green state *is* the proof the migration is behaviour-neutral.

### Pane/window-level sites — leave as-is

`SelectPane`, `ResizePaneZoom`, and `SelectWindow` already centralise the prefix via `PaneTargetExact` (pane-level) or build it at the window-target level. They stay on that path. Any tidy-up of `SelectWindow`'s inline `"=" + bareTarget` is an implementation-detail call left to the implementer — not required by this fix.

### Explicitly out of scope

Held firmly at the **session-target** surface. The following are the same hazard class but are **not** part of this bugfix (none are the destructive kill/rename pair, and none carry the same live-collision exposure):

- **`PaneTarget`** (the no-prefix hooks.json key formatter) — must stay as-is; changing it would silently invalidate existing hook entries.
- **Bare `-t <session>` reads / option-and-env sets** in `tmux.go` — `ActivePaneCurrentPath`, `SetSessionOption`, `ListPanesInSession` (and the other `list-panes -t session` reads), `ShowEnvironment`, `SetSessionEnvironment`. Non-destructive; left bare.
- **Caller-supplied pane/window-target writers** — `SendKeys`, `RespawnPane`, `CapturePane`, `NewWindow`, `SplitWindow`, `SelectLayout`. Lower collision exposure (not session names directly).
- **`display-message -t <paneID>`** (the pane-ID read) — targets a unique `%N` pane ID, so it is categorically immune to prefix collision (not merely "non-destructive" or "lower exposure"). Must stay bare — prefixing it (`=%N`) would break the lookup.
- **`internal/session/quickstart.go` bare `attach-session -t <name>` / `set-option -t <name>`** — left bare because `GenerateSessionName` guarantees a freshly-unique name at creation, so no live session can prefix-collide at that instant.

These inform a possible future `exactTarget`-helper sweep to prevent drift, but sweeping them is a separate concern outside this work unit.

## Testing Requirements & Acceptance Criteria

### Test changes

- **Update** `TestKillSession` → expect `kill-session -t =my-session` (replaces the bare-`-t` assertion that pinned the bug).
- **Update** `TestRenameSession` → expect `rename-session -t =old-name new-name` (prefix on target only; `new-name` stays bare).
- **Add** prefix-collision regression tests for both `KillSession` and `RenameSession`, mirroring `TestHasSessionUsesExactMatchPrefix`: simulate tmux's exact-match semantics via `MockCommander.RunFunc` so a dropped-`=` regression fails loudly.
- **Add** a focused unit test: `exactTarget("foo") == "=foo"`.
- The migrated sites (`HasSession`, `HasSessionProbe`, `SwitchClient`) keep their existing tests **green** with unchanged argv — that green state is the proof the migration is behaviour-neutral.

### Acceptance criteria

- `KillSession(name)` issues `kill-session -t =<name>`; `RenameSession(oldName, newName)` issues `rename-session -t =<oldName> <newName>` with `newName` bare.
- A live prefix-colliding session (e.g. `foo-2`) is **never** killed or renamed when the target (`foo`) is not a live exact match — verified by the new regression tests.
- `exactTarget` exists in `internal/tmux` as the canonical session-level exact-match target builder; no inline `"="+name` session-target strings remain anywhere in the `internal/tmux` package (covering both `tmux.go` and `saver_pane_pid.go`).
- The two destructive methods carry rationale godoc blocks mirroring the already-fixed sites.
- All existing tmux package tests pass; `go build` and `go test ./...` are green.

### Risk

- **Fix complexity:** Low — small helper, two argv fixes, a behaviour-neutral refactor of three sites, and test updates/additions.
- **Regression risk:** Low — migrated sites have identical argv (existing tests pin it); `_portal-saver` callers gain the prefix harmlessly; no caller-side changes.
- **Release:** Regular release (no hotfix infra in this project).

---

## Working Notes

[Optional - capture in-progress discussion if needed]
