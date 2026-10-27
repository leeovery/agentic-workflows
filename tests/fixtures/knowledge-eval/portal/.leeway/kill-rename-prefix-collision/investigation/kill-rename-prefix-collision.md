# Investigation: Kill / Rename Prefix Collision

## Symptoms

### Problem Description

**Expected behavior:**
`KillSession(name)` and `RenameSession(oldName, newName)` must operate on
**exactly** the named session. tmux's `=` exact-match target prefix should be
used so `-t =<name>` binds only to the literal session name and never
prefix-matches a different session.

**Actual behavior:**
- `KillSession(name)` issues `kill-session -t <name>` with a bare `-t` argv.
- `RenameSession(oldName, newName)` issues `rename-session -t <oldName>` with a
  bare `-t` argv.

tmux's default target resolution is **prefix-match**. With a live `foo-2`
coexisting with a killed-then-recreated `foo`, `-t foo` can silently bind to
`foo-2` — killing or renaming the wrong session. The kill path is the dangerous
one: destructive, no undo, and silent on a wrong-session kill.

### Manifestation

- Silent wrong-session kill: `KillSession("foo")` can destroy `foo-2`'s tmux
  session if `foo` is not an exact live match but `foo-2` prefix-matches `foo`.
  No error surfaces.
- Wrong-session rename: `RenameSession("foo", ...)` can rename `foo-2`. Less
  severe (recoverable) but still incorrect.

### Reproduction Steps

1. Have two sessions whose names share a prefix, e.g. `foo` and `foo-2`.
2. Kill the exact-match session `foo` (so only `foo-2` remains, but a caller
   still references `foo`), OR have a state where `foo` no longer exists as an
   exact match.
3. Call `KillSession("foo")` → tmux prefix-matches `foo-2` and kills it.

**Reproducibility:** Deterministic given the prefix-collision precondition
(tmux default target resolution is prefix-match).

### Environment

- **Affected environments:** All — this is core CLI behaviour in
  `internal/tmux/tmux.go`.
- **Browser/platform:** n/a (tmux 3.6b confirmed in shaping).
- **User conditions:** Any state where a target session name is a prefix of
  another live session name.

### Impact

- **Severity:** High — `KillSession` is destructive with no undo and fails
  silently on the wrong session.
- **Scope:** Any portal user who has prefix-colliding session names (session
  names are `{project}-{nanoid}`, so prefix collisions across projects sharing
  a name stem are plausible).
- **Business impact:** Data/work loss (a wrong tmux session killed).

### References

- Seed: `.workflows/kill-rename-prefix-collision/seeds/2026-05-16-kill-rename-prefix-collision.md`
- Sibling work: `enter-attaches-from-preview` (fixed 5 sites with the `=` prefix).
- Discovery: `.workflows/kill-rename-prefix-collision/discovery/session-001.md`

---

## Analysis

### Initial Hypotheses

`KillSession` and `RenameSession` build a bare `-t <name>` argv, missing the `=`
exact-match prefix that the five sites fixed in `enter-attaches-from-preview`
already carry. Root cause is believed to already be located; the investigation
must confirm it in the current source and assess blast radius / scope.

### Code Trace

**The two buggy sites (confirmed in current source):**

- `internal/tmux/tmux.go:352-358` — `KillSession(name)`:
  ```go
  _, err := c.cmd.Run("kill-session", "-t", name)
  ```
  Bare `-t name` — no `=` prefix. No godoc rationale block (unlike the fixed
  sites).
- `internal/tmux/tmux.go:360-367` — `RenameSession(oldName, newName)`:
  ```go
  _, err := c.cmd.Run("rename-session", "-t", oldName, newName)
  ```
  Bare `-t oldName` — no `=` prefix. **Only `oldName` (the `-t` target) needs
  the prefix; `newName` is the literal new-name positional argument and must
  stay bare** (it is not a target lookup).

**The already-fixed sites (carry `=`, with rationale godoc) — for contrast:**

- `HasSession` (136) / `HasSessionProbe` (166): `has-session -t =name`
- `SwitchClient` (378): `switch-client -t =name`
- `SelectWindow` (936-937): `select-window -t =session:window`
- `SelectPane` (955-957): `select-pane -t` via `PaneTargetExact`
- `ResizePaneZoom` (974-976): via `PaneTargetExact`
- `PaneTargetExact` (546): the `=`-prefixed pane-target formatter; `PaneTarget`
  (530) is the deliberately non-prefixed hooks.json key formatter (out of scope).
- **attach-session is fixed, but not in `tmux.go`**: the `=`-prefixed attach
  argv lives at `cmd/open.go:104` (`tmux attach-session -t =<name>`). Note a
  *separate* bare `attach-session -t <name>` (and bare `set-option -t <name>`)
  exists in `internal/session/quickstart.go:77-78` — left bare and out of scope
  because `GenerateSessionName` guarantees a freshly-unique name at creation
  (quickstart.go godoc 61-65), so no live session can prefix-collide at that
  instant.

**The fix chokepoint is the Client method, not the callers.** Both methods are
the single argv-construction point. Fixing the argv inside `KillSession` /
`RenameSession` covers every caller uniformly — no caller-side change needed.

**Callers (blast radius of the destructive paths):**

- `KillSession`:
  - `cmd/kill.go:37` — `portal kill <name>` (user session, by name) — **exposed**
  - `internal/tui/model.go:2171` — TUI kill key (user session) — **exposed**
  - `cmd/state_cleanup.go:185`, `internal/tmux/portal_saver.go:366,372,385` —
    kill the fixed-name `_portal-saver` internal session. Low collision risk
    (fixed literal name) but the method-level fix covers them harmlessly and
    uniformly.
- `RenameSession`:
  - `internal/tui/model.go:2225` — TUI rename (user session) — **exposed**

### Root Cause

`KillSession` and `RenameSession` construct their tmux `-t <session>` argv
**without** tmux's `=` exact-match prefix. tmux's default target resolution is
**prefix-match**, so when the named session is not a live exact match but
another live session has that name as a prefix (e.g. target `foo` with live
`foo-2`), tmux silently resolves to the prefix-matching session — killing or
renaming the wrong one.

**Why this happens:** the `=` exact-match policy was introduced by the
`enter-attaches-from-preview` work, which applied it only to the five sites in
*its* blast radius (the preview Enter / pre-select-and-attach pipeline). The
policy lives as an inline `"="+name` string repeated per call site, with no
centralising helper — so a site outside that pipeline (these two destructive
callers) was never brought under the policy and there is no single point that
enforces it.

### Contributing Factors

- **Inline-string policy, no chokepoint.** The `=` prefix is hand-applied at
  each call site rather than centralised, so adding a new `-t` caller (or
  leaving an old one) silently opts out of the policy.
- **Sibling-work scope boundary.** `enter-attaches-from-preview` deliberately
  fixed only the sites it touched; the two destructive callers sit outside that
  pipeline and were left bare (later surfaced in that work's own review →
  inbox bug → this work unit).
- **Session names are `{project}-{nanoid}` and freely renamed by the user**, so
  prefix collisions between coexisting sessions are plausible in practice, not
  theoretical.

### Why It Wasn't Caught

**The existing unit tests actively pinned the buggy form.**

- `TestKillSession` (`tmux_test.go:737`): `wantArgs := "kill-session -t my-session"`
- `TestRenameSession` (`tmux_test.go:953`): `wantArgs := "rename-session -t old-name new-name"`

Both assert the bare-`-t` argv, so they *locked in* the bug — a fix must
**update** these existing assertions, not merely add new ones. Contrast with
`TestHasSessionUsesExactMatchPrefix` (`tmux_test.go:443`), the regression test
the sibling work added that pins `=foo` and even simulates tmux's prefix-match
semantics ("killed foo with live foo-2 reports absent"). `TestSwitchClient`
(`tmux_test.go:770`) already expects `switch-client -t =my-session`.

The sibling work (`enter-attaches-from-preview`) fixed the five sites in its
own blast radius (the preview Enter / pre-select-and-attach pipeline) and did
not sweep the two destructive callers, which sit outside that pipeline.

### Blast Radius

**Directly affected (the fix):**
- `tmux.go` `KillSession`, `RenameSession`.
- `tmux_test.go` `TestKillSession`, `TestRenameSession` (assertions updated).

**Same hazard class but OUT OF SCOPE per seed** — other bare `-t <session>`
sites in `tmux.go` that also lack the `=` prefix. None are destructive (reads
or option/env sets), and the seed scoped only the two destructive callers.
They inform the helper-vs-minimal scope question (a centralising `exactTarget`
helper could eventually cover them to prevent drift) but are not part of this
bugfix:
- `ActivePaneCurrentPath` (344): `display-message -t session` (read)
- `SetSessionOption` (399): `set-option -t session`
- `ListPanesInSession` (555), and the other `list-panes -t session` reads
  (631, 686)
- `ShowEnvironment` (712): `show-environment -t session` (read)
- `SetSessionEnvironment` (898): `set-environment -t session`

Also same hazard class but operating on **caller-supplied pane/window targets**
(not session names directly), so lower collision exposure and out of scope —
listed for completeness so a future `exactTarget`-helper sweep knows the full
drift surface: `SendKeys` (763), `RespawnPane` (779), `CapturePane` (830),
`NewWindow` (861), `SplitWindow` (881), `SelectLayout` (912). (`display-message
-t <paneID>` at 324 targets a unique `%N` pane ID — not a prefix-collision
concern.)

Explicitly out of scope (per seed): `PaneTarget` (530) — the no-prefix
hooks.json key formatter; changing it would invalidate existing hook entries.

---

## Fix Direction

### Chosen Approach

**Option 2 (centralising helper), executed for a uniform end-state** — fix the
two destructive callers *and* close the inline-string drift surface for session
targets, so the codebase reads as if the gap was never there.

1. **Introduce a named session-level primitive** in `internal/tmux`:
   ```go
   func exactTarget(session string) string { return "=" + session }
   ```
   The session-level sibling of the existing `PaneTargetExact` (pane-level).
   Together they become the two canonical ways to build an exact-match `-t`
   target — no inline `"="+name` for a session name left anywhere in `tmux.go`.

2. **Fix the two destructive callers** (the actual bug) via the helper, each
   with a rationale godoc block (mirroring the fixed sites):
   - `KillSession`: `kill-session -t exactTarget(name)`
   - `RenameSession`: `rename-session -t exactTarget(oldName) <newName>` —
     prefix on the **target only**; `newName` is the literal positional
     new-name argument and must stay bare (prefixing it would corrupt the new
     session name).

3. **Migrate the existing bare-session inline sites onto `exactTarget`** so the
   pattern is uniform — behaviour-neutral (identical argv), a pure
   readability/anti-drift refactor: `HasSession`, `HasSessionProbe`,
   `SwitchClient` (the `"="+name` sites). Pane/window-level sites (`SelectPane`,
   `ResizePaneZoom`, `SelectWindow`) already centralise the prefix via
   `PaneTargetExact` or build it at the window-target level — left on that path;
   any tidy-up of `SelectWindow`'s inline `"=" + bareTarget` is an
   implementation-detail call for the spec.

**Deciding factor:** the user's explicit steer — "do it properly, not a hack…
clean, as if it was never there." A minimal two-caller patch (Option 1) would
leave a mixed state (helper for 2, inline for the rest), itself a new
inconsistency. The uniform migration is behaviour-neutral and removes the exact
drift surface that allowed the bug, without widening into unrelated sites.

### Options Explored

- **Option 1 — Minimal two-caller patch (inline `"="+name`).** Smallest diff,
  consistent with the current inline style, lowest surface. **Not chosen:**
  leaves the repeated-inline-string drift surface that allowed this bug; a
  "hack" rather than a clean fix per the user's direction.
- **Option 2 (chosen) — helper + uniform migration of session-level sites.**
- **Option 2 variant — helper but no migration** (my initial recommendation).
  **Superseded:** would leave a mixed inline/helper state, which the user's
  "clean, as if never there" steer explicitly rules out.

### Discussion

- The core argv fix was never in question — only *how* to apply the prefix.
- The user prioritised **cleanliness/maintainability over minimal diff**,
  resolving the open scope question toward the centralising helper and a
  uniform end-state.
- Scope was held firmly at the **session-target** surface: `PaneTarget`, the
  bare `-t <session>` reads/option-sets, the pane/window-target writers, and
  the QuickStart bare attach all stay out of scope — they are not the
  destructive kill/rename pair and don't carry the same live-collision exposure
  (the synthesis agent confirmed QuickStart names are provably unique at
  creation). Sweeping them is a separate concern.
- Edge case surfaced and pinned: `RenameSession`'s `newName` must stay bare —
  flagged by the synthesis agent as the one trap for the implementer.

### Testing Recommendations

- **Update** `TestKillSession` → expect `kill-session -t =my-session`.
- **Update** `TestRenameSession` → expect `rename-session -t =old-name new-name`.
- **Add** prefix-collision regression tests for both, mirroring
  `TestHasSessionUsesExactMatchPrefix` (simulate tmux exact-match semantics via
  `MockCommander.RunFunc` so a dropped-`=` regression fails loudly).
- **Add** a focused unit test: `exactTarget("foo") == "=foo"`.
- The migrated sites (`HasSession`, `HasSessionProbe`, `SwitchClient`) keep
  their existing tests green (argv unchanged) — that green state *is* the proof
  the migration is behaviour-neutral.

### Risk Assessment

- **Fix complexity:** Low — small helper, two argv fixes, a behaviour-neutral
  refactor of three sites, and test updates/additions.
- **Regression risk:** Low. Migrated sites have identical argv (existing tests
  pin it). The `_portal-saver` internal `KillSession` callers gain the `=`
  prefix harmlessly (fixed literal name, no possible prefix collision). No
  caller-side changes anywhere — the fix lives entirely at the Client-method
  chokepoint.
- **Recommended approach:** Regular release (no hotfix infra in this project).

---

## Notes

- Out of scope per seed: `PaneTarget` (the no-prefix hooks.json key formatter)
  must stay as-is — changing it would silently invalidate existing hook entries.
- Open scope question carried from discovery: introduce a centralising
  `exactTarget` helper (and optionally migrate existing inline-`=` sites onto
  it to prevent drift) vs. a minimal two-caller patch.
