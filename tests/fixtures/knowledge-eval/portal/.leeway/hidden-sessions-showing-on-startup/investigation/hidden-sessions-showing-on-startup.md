# Investigation: Hidden Sessions Showing On Startup

## Symptoms

### Problem Description

**Expected behavior:**
After tmux/Portal startup, sessions whose names start with an underscore
(e.g. `_portal-saver`) should be hidden by default in the Portal session list.
The user recalls this convention being decided.

**Actual behavior:**
Two unwanted sessions are visible in the Portal session list at startup:

1. A session named `0` — initially suspected to be from the tmux-resurrect
   plugin.
2. `_portal-saver` — Portal's own internal saver session that hosts
   `portal state daemon`.

### Manifestation

- Session picker / session list shows the `_portal-saver` row.
- Session picker / session list shows a `0` row.
- User expectation: both should be hidden by default.

### Reproduction Steps

1. Start tmux fresh (no existing server) or kill the tmux server.
2. Run `portal` (or `portal open` / `x`) — bootstrap creates `_portal-saver`
   (step 4) and runs Restore (step 5).
3. Open the TUI session picker (or run `portal list`).
4. Observe: both `0` and `_portal-saver` appear in the list.

**Reproducibility:** Always.

### Environment

- **Affected environments:** Local (macOS).
- **Confirmed:** User has removed `tmux-resurrect` and `tmux-continuum`,
  restarted the tmux server, and both `0` and `_portal-saver` still appear.
  This rules out the resurrect-plugin hypothesis for the `0` session — Portal
  itself is the source.

### Impact

- **Severity:** Low (cosmetic / UX clutter; no data loss).
- **Scope:** All Portal users.
- **Business impact:** Confusing UX — internal infrastructure leaks into the
  user-facing list, contradicts the design intent documented in spec.

### References

- `internal/tmux/tmux.go:175-181` — `StartServer` (creates the `0` bootstrap
  session via `tmux new-session -d`).
- `internal/tmux/portal_saver.go:11-13` — `_portal-saver` session, doc-comment
  claims it is "filtered from the TUI picker".
- `internal/tmux/tmux.go:108-150` — `ListSessions` (no name-based filtering).
- `internal/tui/model.go:566-578` — `filteredSessions` (only filters current
  session when inside tmux; **no** underscore-prefix filtering).
- `cmd/list.go:48-94` — `portal list` command (no underscore-prefix
  filtering).
- `internal/state/capture.go:35-38, 218-228` — **does** filter underscore-
  prefixed sessions from `sessions.json` capture.
- `internal/restore/restore.go:118-119` — defensive skip of underscore-
  prefixed sessions on restore.
- `.workflows/built-in-session-resurrection/specification/built-in-session-resurrection/specification.md:139-147`
  — spec mandate: "Portal filters sessions whose names begin with `_` …
  from: The TUI session picker. `sessions.json` capture. Any future
  internal-only sessions."

---

## Analysis

### Initial Hypotheses

1. Underscore-prefix hiding was specced but never implemented in the TUI
   picker.
2. `0` is from `tmux-resurrect` interfering.
3. `0` is created by Portal's own server bootstrap and never cleaned up.

### Hypothesis 2 — Ruled Out

User removed `tmux-resurrect` and `tmux-continuum`, restarted the tmux
server, and `0` still appears. The plugin is not the source.

### Code Trace: `_portal-saver` Visibility

**Spec reference (`specification.md:139-147`):**

> `_portal-saver` shows up in `tmux ls`. There is no tmux mechanism to
> hide it. Portal filters sessions whose names begin with `_` … from:
>
> - The TUI session picker.
> - `sessions.json` capture.
> - Any future internal-only sessions.

The spec was authored during the `built-in-session-resurrection` feature
and explicitly calls out the TUI picker as one of the filter points. The
public doc-comment on `tmux.PortalSaverName` repeats this:

```go
// internal/tmux/portal_saver.go:10-13
// PortalSaverName is the tmux session name that hosts the long-running save daemon.
// The leading underscore marks the session as Portal-internal so it is filtered
// from the TUI picker and from sessions.json capture.
const PortalSaverName = "_portal-saver"
```

Tracing what is **actually** filtered:

1. **`internal/state/capture.go`** — **filtered ✓**. `internalSessionPrefix
   = "_"` and `keepSessionNames` (lines 218-228) drops any session whose
   name starts with `_` from `sessions.json` capture.
2. **`internal/restore/restore.go:118-119`** — **filtered ✓** (defensively
   skips underscore-prefixed entries during restore).
3. **`internal/tui/model.go:566-578`** — **NOT filtered ✗**. `filteredSessions`
   only excludes the current session (when inside tmux). No name-prefix
   filter. `_portal-saver` flows straight from `ListSessions` into the
   picker list.
4. **`cmd/list.go:48-94`** — **NOT filtered ✗**. The `portal list` command
   prints whatever `tmux.Client.ListSessions()` returns, verbatim. So
   `portal list` also surfaces `_portal-saver`.
5. **`internal/tmux/tmux.go:108-150`** — `Client.ListSessions` does no
   filtering. It returns every running session as tmux reports it.

**Cross-check — planning gap:**

`.workflows/built-in-session-resurrection/planning/.../phase-2-tasks.md`
contains task `2-8` ("structural capture: enumerate sessions, panes …
`_*` sessions filtered") which produced the `internal/state/capture.go`
filter. Searching the planning document for any task that adds the same
filter to the TUI picker or `cmd/list.go` returns nothing. The planning
phase only authored capture-side filtering.

**Verdict on `_portal-saver`:** The spec mandates filtering at three sites
(TUI picker, capture, internal-only sessions). Two of three were
implemented (capture, restore-side defensive). The TUI picker filter — and
by extension the `portal list` filter — was never authored as a planning
task and never implemented in code. The doc-comment on `PortalSaverName`
makes a claim the code does not back up.

### Code Trace: `0` Session Origin

**`internal/tmux/tmux.go:169-181`:**

```go
// StartServer starts the tmux server by creating a detached bootstrap session.
// Uses "new-session -d" instead of "start-server" so the server has at least one
// session, preventing tmux's default "exit-empty on" from terminating the server
// before plugins like tmux-continuum can restore saved sessions.
// The unnamed session defaults to "0", which tmux-resurrect recognizes and cleans up.
// Returns nil on success or a wrapped error on failure. No retry logic.
func (c *Client) StartServer() error {
    _, err := c.cmd.Run("new-session", "-d")
    ...
}
```

**Git archaeology** (`git log -S "tmux-resurrect" -- internal/tmux/tmux.go`):

```
bd659a3 impl(resume-hooks-not-firing-after-server-kill): T1-1 — fix
        StartServer to use new-session -d
```

The change history (commit `bd659a3`, dated 2026-04-07) shows the
behaviour was deliberately introduced. It replaced `tmux start-server`
with `tmux new-session -d` to keep the server alive long enough for
external plugins (`tmux-continuum`, `tmux-resurrect`) to take over.

**Why the doc-comment is now stale:**

The `built-in-session-resurrection` feature (now complete) made Portal
self-sufficient for restoration. Bootstrap step 5 (`Restore`) reconstructs
sessions/windows/panes from Portal's own `sessions.json`, not from a
third-party plugin. The justification for relying on tmux-resurrect to
clean up the bootstrap `0` session is no longer load-bearing — and as the
user has confirmed, with the plugin removed nothing else cleans it up.

**Tracing whether anything else kills the `0` session:**

- Bootstrap orchestrator (`cmd/bootstrap/bootstrap.go`) defines steps 1-9.
  None of them targets the bootstrap session by name.
- `cleanStaleAdapter.CleanStale` (`cmd/bootstrap_production.go:63-70`)
  prunes only stale entries from `hooks.json`. It does not touch tmux
  sessions.
- `SweepOrphanFIFOs` cleans orphan hydrate FIFOs on disk.
- `state.CleanStale` (and `cmd state clean`) do not kill bootstrap
  sessions.

**Test-bench hint:**
`internal/restore/integration_test.go:280` and
`cmd/bootstrap/reboot_roundtrip_test.go:236, 319` use `_seed` /
`_bootstrap` (underscore-prefixed) names for the seeding bootstrap
session in tests. That convention is precisely what would let the seed
session be hidden by name-prefix; production code does not follow it.

**Verdict on `0`:** Portal itself creates the `0` session as a side-effect
of `EnsureServer → StartServer` and never disposes of it. With Portal's
own restore now authoritative, the comment about tmux-resurrect handling
cleanup is stale and incorrect. The session lingers indefinitely.

### Root Cause

**Two distinct, related root causes — both in production code:**

1. **TUI picker / `portal list` do not filter underscore-prefixed
   sessions.** The spec mandated the filter at three sites. The capture
   side was implemented; the user-facing list views were not. The
   doc-comment on `tmux.PortalSaverName` documents an invariant the code
   does not enforce. **Result:** `_portal-saver` shows in every list.

2. **Portal's `StartServer` creates an unnamed (`0`) bootstrap session
   that nothing ever cleans up.** Cleanup was nominally delegated to
   external plugins; with Portal's own resurrection in place, that
   delegation is obsolete and never runs. **Result:** `0` shows in every
   list after a fresh server start.

The two causes intersect in the symptom because both unwanted sessions
appear together at first startup — but each requires a separate fix.

### Contributing Factors

- **Spec-implementation gap, planning-traceability failure.** The
  `built-in-session-resurrection` planning phase authored a capture-side
  filtering task but no equivalent task for the TUI picker or `portal
  list`. The traceability check between specification and plan did not
  catch the gap.
- **Stale comment encoding outdated assumption.** The `StartServer`
  comment ("tmux-resurrect recognizes and cleans up") was accurate when
  written but became wrong once Portal's own resurrection landed. The
  comment was not revisited during the resurrection feature.
- **Two cleanup mechanisms colliding.** Bootstrap step 4 creates
  `_portal-saver`, step 5 creates user sessions via Restore. The original
  `0` session has no role to play once steps 4-5 complete, but no step
  removes it.

### Why It Wasn't Caught

- Tests for `internal/state/capture.go` (`capture_test.go:135`) cover the
  underscore-prefix filter. There is no equivalent test for the TUI
  session list or `cmd/list.go`. Test surface drove what got implemented.
- Tests for `StartServer` (`tmux_test.go`) check that the command runs;
  they do not assert on whether the bootstrap session is cleaned up at
  the end of bootstrap. The `0` session is invisible to current
  assertions.
- Manual QA during the resurrection feature would have caught both, but
  the planning's "review" phase scored against the explicit task list,
  not against an end-to-end UX walk-through.

### Blast Radius

**Directly affected:**

- TUI session picker (`internal/tui` — main user-facing list).
- `portal list` CLI output (`cmd/list.go`).
- Any future caller of `Client.ListSessions` that displays results.

**Potentially affected:**

- Future `_*` internal sessions (the spec explicitly anticipates more).
- Any tooling that scripts against `portal list` and assumes only user
  sessions appear.

---

---

## Fix Direction

### Chosen Approach

Two fixes shipping together, plus doc-comment cleanup.

**Fix A1 — Filter underscore-prefixed sessions at the chokepoint.** Apply
the filter inside `tmux.Client.ListSessions` so every consumer benefits
from a single source of truth. The spec describes the filter as a
Portal-wide invariant, not a per-consumer concern. The internal
`internal/state` capture path uses its own
`keepSessionNames`/`ListSessionNames` route that is unaffected, so this
does not double-filter or starve the daemon of `_*` visibility.

**Fix B1 — Rename the bootstrap session to an underscore-prefixed name.**
Change `StartServer` to call `tmux new-session -d -s <reserved-name>`
(e.g. `_portal-bootstrap`) instead of an unnamed `new-session -d`. Once
Fix A1 is in place, the bootstrap session is hidden by the same
mechanism that hides `_portal-saver`. tmux's native `exit-empty on`
behaviour reaps the bootstrap session naturally if Restore creates real
sessions; if Restore creates nothing, the bootstrap session remains as
the keep-server-alive anchor — exactly its job.

**Doc-comment cleanup.**

- `tmux.PortalSaverName` — claim becomes accurate after A1.
- `tmux.StartServer` — drop the stale "tmux-resurrect cleans this up"
  rationale; replace with the actual mechanism (named session, hidden
  by underscore filter, reaped by tmux when no longer needed).

**Deciding factor:** A1 + B1 closes the spec gap with a single filter
invariant and removes Portal's third-party plugin dependency for
cleanup. Both fixes ride on the same mechanism — one filter site, one
test, one mental model.

### Options Explored

**Filter placement — Fix A:**

- **A1 (chosen).** Filter in `tmux.Client.ListSessions`. Single chokepoint;
  every caller benefits; future callers don't have to remember.
- **A2 (rejected).** Filter at each consumer (`internal/tui` and
  `cmd/list.go`). Mirrors the existing capture-side pattern but loses
  the Portal-wide invariant. Future consumer forgets, bug repeats.
  Two edit sites, two tests.

**Bootstrap session — Fix B:**

- **B1 (chosen).** Rename to `_portal-bootstrap`. Smallest surface change.
  Hides via Fix A1. Lets tmux's native lifecycle handle reaping.
- **B2 (rejected).** Add an explicit kill step in the bootstrap
  orchestrator after Restore. Works but introduces a new orchestrator
  step, plus a precondition check (must not kill the only session, or
  the server dies). More moving parts than B1.
- **B3 (rejected).** Revert `StartServer` to `tmux start-server`.
  Re-introduces the failure mode that bd659a3 fixed
  (`exit-empty on` can kill the server before restoration finishes).

**`portal list --all` flag.** Deferred. The user has `tmux ls` for
inspecting internals; adding a flag now would solve a hypothetical
need. Can be added later if a real diagnostic use case emerges.

### Discussion

The user pressed for 100% confirmation that the `0` session was
Portal's doing rather than a leftover from `tmux-resurrect` /
`tmux-continuum`. Three lines of evidence converge:

1. `internal/tmux/tmux.go:175-181`: `StartServer` runs
   `tmux new-session -d` without `-s`. Per `man tmux`, the default name
   is the lowest unused numeric index from `base-index` — `0` on a
   fresh server. It is the only unnamed `new-session` call in the
   production codebase.
2. Commit `bd659a3` made the change deliberately and captured the
   intent in the doc-comment ("tmux-resurrect recognizes and cleans
   up").
3. The user removed both plugins, restarted the server, and `0` still
   appears — so the plugins are not the source.

The user also asked the agent not to interfere with their tmux server
during investigation; analysis remained code-reading only.

The two root causes are independent but ride on the same fix
mechanism — once underscore-prefixed sessions are filtered out, both
`_portal-saver` and the renamed bootstrap session disappear from view
together. That alignment is what made A1 + B1 the natural pairing
rather than two unrelated patches.

### Testing Recommendations

- **TUI / `portal list` filter.** Add a unit test asserting that
  `tmux.Client.ListSessions` excludes any session whose name starts
  with `_`. With the filter at the chokepoint, this single test
  protects every consumer (TUI picker, `cmd/list.go`, future callers).
- **Bootstrap session naming.** Update the existing `TestStartServer`
  in `internal/tmux/tmux_test.go` to assert the args include
  `-s _portal-bootstrap` (or whatever reserved name is chosen),
  preventing accidental regression to an unnamed session.
- **End-to-end visibility check.** A bootstrap-level test (or
  `cmd/bootstrap/reboot_roundtrip_test.go` extension) that
  asserts the post-bootstrap session list visible via
  `Client.ListSessions` contains no entries beginning with `_`. This
  is the one assertion that would have caught both root causes during
  the resurrection feature's review.
- **Diagnostic visibility.** If the team later wants to keep an
  unfiltered listing for debugging, a sibling `ListAllSessions` (or
  `ListSessionsRaw`) on the client provides an opt-in escape hatch
  without changing the default safe behaviour.

### Risk Assessment

- **Fix complexity:** Low. A1 is a `strings.HasPrefix` skip inside an
  existing loop. B1 is a one-line argument change plus the chosen
  reserved name as a constant. Doc-comment edits are trivial.
- **Regression risk:** Low. The capture path uses
  `ListSessionNames` (a thin wrapper around `ListSessions`) — adding
  an underscore filter to `ListSessions` would also filter the capture
  caller, but `internal/state` already applies its own
  `keepSessionNames` filter on top, so the result is unchanged. Worth
  verifying no other production caller relies on seeing `_*` sessions
  in raw form (search shows the only callers are `cmd/list.go` and
  `internal/tui/model.go`, both of which want the filter). If a
  diagnostic caller appears in future, expose `ListAllSessions` then.
- **Recommended approach:** Regular bugfix. Two small targeted commits
  (filter + rename), each with its own test. No feature flag
  needed — the change is observable but strictly improves UX.
