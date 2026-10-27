# Specification: Hidden Sessions Showing On Startup

## Specification

## Problem Statement

### Symptoms

After fresh tmux/Portal startup, two sessions appear in the Portal session
list that should be hidden by default:

1. **`0`** — an unnamed bootstrap session created by Portal's own
   `StartServer` (a side-effect of `tmux new-session -d`).
2. **`_portal-saver`** — Portal's internal saver session that hosts
   `portal state daemon`.

Both surface in:

- The TUI session picker (`internal/tui`).
- `portal list` CLI output (`cmd/list.go`).

### Reproduction

1. Start tmux fresh (no existing server) or kill the tmux server.
2. Run `portal` (or `portal open` / `x`).
3. Open the TUI session picker (or run `portal list`).
4. Both `0` and `_portal-saver` are visible.

Reproducibility: always.

### Scope

- Severity: low (cosmetic / UX clutter, no data loss).
- Affected: all Portal users on all platforms.
- Confirmed independent of `tmux-resurrect` / `tmux-continuum` —
  Portal itself is the source of both unwanted sessions.

**Behavioural change beyond the visible UX:** any external tooling
that scripts against `portal list` will, after this fix, see output
strictly trimmed to user-visible sessions. Scripts that today
tolerate or filter `_portal-saver` / `0` will continue to work; any
script that depended on those names appearing will silently observe
their absence. The change is benign but is documented here so
consumers are not surprised.

### Design Intent

The `built-in-session-resurrection` specification mandates that Portal
filters sessions whose names begin with `_` from:

- The TUI session picker.
- `sessions.json` capture.
- Any future internal-only sessions.

The capture-side filter shipped. The TUI / `portal list` filter did
not. The bootstrap session was never given an underscore-prefixed name,
so even with the spec-mandated filter in place it would still leak.

## Root Causes

Two distinct, related root causes — both in production code.

### Root Cause 1 — TUI / `portal list` Skip Underscore Filter

The `built-in-session-resurrection` spec mandates filtering of `_*`
sessions at three sites. Implementation landed at two:

| Site | Status |
|------|--------|
| `internal/state/capture.go` (sessions.json capture) | filtered ✓ |
| `internal/restore/restore.go` (defensive restore-side skip) | filtered ✓ |
| `internal/tmux/tmux.go` (`Client.ListSessions`) | **not filtered ✗** |
| `internal/tui/model.go` (`filteredSessions`) | **not filtered ✗** |
| `cmd/list.go` (`portal list`) | **not filtered ✗** |

`Client.ListSessions` returns every running session as tmux reports
it. `filteredSessions` only excludes the current session when inside
tmux. `cmd/list.go` prints `ListSessions` output verbatim. The
doc-comment on `tmux.PortalSaverName` documents an invariant the code
does not enforce.

The `built-in-session-resurrection` planning phase authored a
capture-side filtering task (`2-8`) but no equivalent task for the
TUI picker or `portal list`. The traceability check between
specification and plan did not catch the gap.

### Root Cause 2 — Bootstrap `0` Session Never Cleaned Up

`internal/tmux/tmux.go` `StartServer` runs `tmux new-session -d`
without `-s`, so tmux assigns the default name (lowest unused numeric
index from `base-index`, typically `0`). The change was deliberate
(commit `bd659a3`) — replacing `tmux start-server` with
`tmux new-session -d` keeps the server alive long enough that
`exit-empty on` does not kill it before restoration completes.

The original rationale relied on `tmux-resurrect` recognising and
cleaning up the `0` session. With Portal's own session resurrection
now authoritative, that delegation is obsolete and never runs.
Bootstrap step 5 (`Restore`) does not target the `0` session, and no
other bootstrap step or cleanup mechanism removes it. The session
lingers indefinitely.

The bootstrap session is functionally redundant the moment
bootstrap step 4 (`EnsureSaver`) creates `_portal-saver` or step 5
(`Restore`) creates user sessions — its sole job is to keep the
server alive *until* something else exists. Once another session
is present, the `0` session has no role to play. No step removes
it; tmux's `exit-empty` policy cannot reap it because the server
is no longer empty. This justifies why Fix B's reliance on tmux's
native lifecycle is acceptable: the renamed session has no purpose
once real sessions exist, and tmux's `exit-empty` reaping (when
applicable) targets exactly that condition.

### Why The Two Causes Surface Together

Both unwanted sessions appear at first startup because both are
products of the same bootstrap sequence. Each has a separate fix,
but both fixes ride on the same mechanism — once Portal filters
`_*` sessions at the chokepoint, both `_portal-saver` and the
renamed bootstrap session disappear from view together.

### Why It Wasn't Caught Earlier

- Tests for `internal/state/capture.go` cover the underscore-prefix
  filter. No equivalent test exists for the TUI session list,
  `cmd/list.go`, or `Client.ListSessions`. Test surface drove what
  got implemented.
- Tests for `StartServer` check that the command runs; they do not
  assert on whether the bootstrap session is cleaned up at the end
  of bootstrap. The `0` session is invisible to current assertions.
- The `built-in-session-resurrection` planning's "review" phase
  scored the implementation against the explicit task list rather
  than against an end-to-end UX walk-through. Manual QA of the
  post-bootstrap session list as a user sees it would have caught
  both root causes. The end-to-end test mandated in this bugfix
  (see Test Requirements → "End-To-End — No `_*` Sessions Visible
  Post-Bootstrap") is the regression guard for that review-process
  gap, not just the test-surface gap.

## Fix A — Filter `_*` Sessions In `Client.ListSessions`

### Behaviour Contract

`internal/tmux.Client.ListSessions` MUST exclude any session whose
name begins with `_` from its returned slice. The exclusion is
unconditional and applies to every caller.

After this change, the TUI session picker, `portal list`, and any
future caller of `ListSessions` automatically inherit the filter
without per-consumer code changes.

### Placement Rationale

The filter is applied at the chokepoint — `tmux.Client.ListSessions` —
rather than at each consumer (`internal/tui`, `cmd/list.go`).
Rationale:

- The spec describes `_*` hiding as a Portal-wide invariant, not a
  per-consumer concern.
- Single source of truth — future consumers cannot forget the rule.
- One filter site, one test, one mental model.

A per-consumer placement (each of `internal/tui` and `cmd/list.go`)
was rejected because it loses the invariant — the next consumer to
appear would forget, and the bug would repeat.

### Interaction With The Capture Path

`internal/state/capture.go` reaches tmux via `ListSessionNames` —
verified to be a thin wrapper around `ListSessions`. Adding a filter
inside `ListSessions` therefore also filters the capture caller, but
`internal/state` already applies its own `keepSessionNames` filter
on top (`internal/state/capture.go:218-228`), so the post-filter
result is unchanged.

**Chosen strategy:** apply the filter only inside `ListSessions`.
The capture path's existing `keepSessionNames` filter double-filters
`_*` names, which is a no-op (set difference is identical), so no
new method is introduced and `ListSessionNames` keeps its current
shape as a thin wrapper around `ListSessions`.

This strategy was chosen over the alternative (introducing a
lower-level raw enumeration that `ListSessionNames` calls directly,
bypassing the filter) because it is the smaller change and does
not require creating a new internal method. No new test is required
for the capture path beyond the existing regression guard (see Test
Requirements → Capture-Path Regression Guard).

**Invariant going forward.** `ListSessionNames` MUST remain a
delegation to `ListSessions` — it MUST NOT bypass `ListSessions`
to query tmux directly. The chosen strategy depends on this
delegation: if a future change decouples them, the capture path
silently loses the underscore filter and Root Cause 1 partially
regresses for capture. Any such future change MUST re-evaluate
filter placement before landing.

### Diagnostic Escape Hatch (Future)

If a future caller legitimately needs unfiltered output (e.g. an
internal diagnostic command), expose a sibling `ListAllSessions` (or
`ListSessionsRaw`) on the client. This is **not** added now — it is
documented as the available extension point so the default
`ListSessions` can remain safe by construction.

### Filter Definition

A session is filtered when `strings.HasPrefix(name, "_")` is true.
The match is on the literal session name as reported by tmux. No
trimming, no case-folding.

### Filter Application Order

The filter is applied as the **final** post-processing step before
return — after parsing tmux output and any current ordering. If
`ListSessions` later grows additional post-processing (sort,
attach-metadata enrichment), those steps run first and the filter
runs last. The contract is "the returned slice never contains a
`_*` name" — preserved regardless of how the rest of the pipeline
evolves.

### Return-Value Contract

`ListSessions` returns an empty (non-nil) slice when all underlying
sessions are filtered. Callers may rely on `len(result) == 0` and
on JSON-serialisation producing `[]` rather than `null`. The
implementation MUST NOT return `nil` to express "no visible
sessions".

### Empty-List Behaviour

After **both Fix A and Fix B** have landed, on a freshly
bootstrapped server with no restorable state, `Client.ListSessions`
returns an empty slice (only `_portal-bootstrap` and `_portal-saver`
exist, both filtered). Downstream behaviour:

- **`portal list`:** MUST emit no output when `ListSessions`
  returns an empty slice (silent exit, no "no sessions" message,
  no trailing newline beyond what the existing iteration produces).
  The implementer MUST verify `cmd/list.go` against this contract
  and adjust if the existing empty-input path produces output;
  do not assume "no change required" without the verification.
- **TUI session picker (`internal/tui`):** verify the existing
  empty-list rendering (`filteredSessions` returning an empty
  slice) is acceptable. Adding a dedicated empty-state UX is
  **out of scope** for this bugfix. If existing rendering is
  unacceptable to the user, raise it as a separate work unit;
  do not bundle it here.

## Fix B — Rename Bootstrap Session To `_portal-bootstrap`

### Behaviour Contract

`internal/tmux.Client.StartServer` MUST create the bootstrap session
with an explicit underscore-prefixed name. The chosen name is
`_portal-bootstrap`.

The implementation invokes `tmux new-session -d -s _portal-bootstrap`
instead of the current `tmux new-session -d`.

The reserved name MUST be exposed as an exported package-level
constant in `internal/tmux` (sibling to `PortalSaverName`), e.g.
`PortalBootstrapName = "_portal-bootstrap"`. **All references to
the reserved name — production code (`StartServer`'s tmux args),
tests, and any future diagnostic tooling — MUST go through the
constant.** No literal `"_portal-bootstrap"` string elsewhere in
the codebase.

**Precondition.** `StartServer` is contracted to be called only
when no tmux server is running (the existing `ServerRunning` gate
in `cmd/root.go`). Behaviour when called against a server that
already hosts a `_portal-bootstrap` session is undefined and out
of scope for this bugfix — `tmux new-session -d -s _portal-bootstrap`
would fail with "duplicate session" in that case. Callers must
check `ServerRunning` first, as today.

### Why Rename Instead Of Kill

Three alternatives were considered for the bootstrap session:

- **Rename to `_portal-bootstrap` (chosen).** Smallest surface
  change. Hidden by Fix A's filter. Lets tmux's native `exit-empty`
  lifecycle handle reaping when other sessions exist. If Restore
  creates nothing on a given startup, the bootstrap session remains
  as the keep-server-alive anchor — exactly its intended job.
- **Add an explicit kill step in the bootstrap orchestrator after
  Restore (rejected).** Works but introduces a new orchestrator
  step plus a precondition check (must not kill the only session,
  or the server dies). More moving parts than the rename.
- **Revert `StartServer` to `tmux start-server` (rejected).** Re-
  introduces the failure mode that commit `bd659a3` fixed —
  `exit-empty on` can kill the server before restoration finishes.

### Lifecycle After The Rename

Portal does **not** explicitly set or modify tmux's `exit-empty`
option. The reaping behaviour described below is opportunistic and
depends on the user's tmux configuration. When `exit-empty` is at
its tmux default (`on`), the server exits when its last session
closes — Portal benefits from this naturally. When the user has
overridden `exit-empty off`, `_portal-bootstrap` may persist
indefinitely, but Fix A's filter still hides it from view, so the
user never sees it. Reaping is therefore a nice-to-have, not a
correctness requirement.

- **Server start with restorable state:** `_portal-bootstrap` is
  created. `Restore` (bootstrap step 5) creates real user sessions.
  Killing user sessions later may eventually leave `_portal-bootstrap`
  as the only session; whether the server then exits depends on
  `exit-empty`. Fix A's filter hides `_portal-bootstrap` from view
  regardless.
- **Server start with no restorable state:** `_portal-bootstrap`
  is created and remains as the only session. It keeps the server
  alive (its original purpose). Fix A's filter hides it from the
  user's session list.
- **Server already running:** `StartServer` is not called.
  Bootstrap proceeds without creating the session.

### Naming Constraint

`_portal-bootstrap` is reserved. Other code MUST NOT create or
re-use a session with this name. The constant is the canonical
reference.

### Sole Production Caller Verified

`StartServer` is the only call site in production code that invokes
`tmux new-session` without `-s`. This was verified during
investigation. Once Fix B lands there is no remaining code path
that produces an unnamed (and therefore numerically-defaulted)
session. Any future contributor adding a sibling unnamed
`new-session` would re-introduce the bug; the chokepoint reasoning
in Fix A applies — the underscore-prefix invariant must be the
default for any new bootstrap-style session.

**Enforcement posture:** treated as a code-review concern, not a
mandated automated check. A static check (e.g. a unit test that
greps `internal/tmux` for `Run("new-session"` calls and asserts
each one is paired with `-s`) was considered and rejected — the
infrastructure cost outweighs the marginal protection given that
the end-to-end test in Test Requirements catches `_*` leaks and a
new unnamed session would also produce a non-`_*`-prefixed entry,
which would surface in the post-fix UX. Reviewers are expected to
challenge any new unnamed `new-session` call.

## Doc-Comment Cleanup

Two existing doc-comments encode incorrect or stale claims and MUST
be updated as part of this work. The edits are part of the bugfix,
not a follow-up — they document the post-fix invariants.

### `tmux.PortalSaverName`

The current comment claims `_portal-saver` is "filtered from the
TUI picker and from `sessions.json` capture." After Fix A lands the
claim becomes accurate. The comment MUST be re-read in the post-fix
context and revised so it correctly references the chokepoint —
`Client.ListSessions` — as the source of TUI-picker filtering rather
than implying any per-consumer filter. If the existing wording is
already accurate against the post-fix code, leave it; otherwise
update it. The implementer ships a deliberate edit OR an explicit
"reviewed, no change required" code comment in the commit message.

### `tmux.StartServer`

The current comment includes the rationale: *"The unnamed session
defaults to '0', which tmux-resurrect recognizes and cleans up."*
This rationale is stale — Portal no longer relies on tmux-resurrect
for cleanup, and the user has confirmed the session persists with
the plugin removed.

After Fix B, the comment MUST:

- Drop the tmux-resurrect cleanup claim entirely.
- Drop or reframe the "plugins like tmux-continuum can restore
  saved sessions" wording — Portal's own bootstrap step 5
  (`Restore`) is now the beneficiary of keeping the server alive,
  not external plugins. Reword so the rationale references
  Portal's own resurrection rather than third-party plugins.
- Document that the session is created with the reserved name
  `PortalBootstrapName` (`_portal-bootstrap`).
- Document that the session is hidden from user-facing listings by
  the underscore-prefix filter in `Client.ListSessions`.
- Retain the `exit-empty on` rationale for using `new-session -d`
  rather than `start-server` (this is still load-bearing — commit
  `bd659a3`) — but framed against Portal's own `Restore` step, per
  the previous bullet.

### Convention Precedent

Existing tests already follow the underscore-prefix convention for
seeding sessions:

- `internal/restore/integration_test.go:280` uses `_seed`.
- `cmd/bootstrap/reboot_roundtrip_test.go:236, 319` uses `_bootstrap`.

Test-bench code already demonstrates the pattern works; production
was the outlier. Fix B brings production in line with the convention
the test code has been using.

## Test Requirements

The fix MUST add or update tests at three layers. Each test asserts
a single invariant; together they cover the spec gap that allowed
the bug to ship.

### Unit — `Client.ListSessions` Excludes `_*` Sessions

In `internal/tmux/tmux_test.go`, add a unit test asserting that
`Client.ListSessions` excludes any session whose name starts with
`_`. Drive the test with mocked `Commander` output containing a
mix of `_*` and non-`_*` names; assert that only the non-`_*`
names appear in the returned slice.

This single test protects every consumer of `ListSessions` (TUI
picker, `cmd/list.go`, future callers) and prevents Root Cause 1
from regressing.

### Unit — `StartServer` Uses Reserved Bootstrap Name

Update the existing `TestStartServer` in `internal/tmux/tmux_test.go`
to assert the args passed to `Commander.Run` include
`-s _portal-bootstrap` (referenced via the `PortalBootstrapName`
constant, not the literal string). This prevents accidental
regression to an unnamed session.

### End-To-End — Post-Bootstrap Session State

Extend `cmd/bootstrap/reboot_roundtrip_test.go` (the real-tmux
fixture path) with two assertions after a full bootstrap. The
test must read tmux's raw session list directly — either via a
test-only helper (e.g. `ListAllSessions` if introduced) or by
shelling to `tmux list-sessions -F '#{session_name}'` — **not**
via `Client.ListSessions`, because asserting on `ListSessions`
output would only re-test the chokepoint filter and would NOT
catch a regression of Root Cause 2 (rename arg silently dropped,
`0` returns — `0` has no `_*` prefix and would still be filtered
into invisibility for `ListSessions` callers).

**Assertion 1 — raw tmux state (catches Root Cause 2):**
The set of session names reported directly by tmux MUST be a
subset of `{_portal-bootstrap, _portal-saver, <expected restored
sessions>}`. Specifically: no `0`, no other unexpected names. A
regression of Fix B (e.g. `-s` arg dropped) breaks this assertion
because `0` would re-appear.

**Assertion 2 — user-facing visibility (catches Root Cause 1):**
`Client.ListSessions` MUST return the expected user-facing slice —
i.e. the restored user sessions only, with both reserved names
(`_portal-bootstrap`, `_portal-saver`) excluded. A regression of
Fix A breaks this assertion because the reserved names would leak
through.

Together these two assertions catch both root causes. This is the
end-to-end regression guard for the entire bugfix and for any
future `_*` session that joins the codebase.

### Capture-Path Regression Guard

The capture-path tests (`internal/state/capture_test.go:135` and
related) MUST continue to pass unchanged. Confirm that the chosen
implementation strategy from Fix A's "Interaction With The Capture
Path" section preserves capture behaviour. No new capture tests are
required, but existing ones are an explicit regression gate.

## Out Of Scope / Deferred

The following ideas surfaced during investigation but are **not**
part of this bugfix. They are documented here so planning does not
mistakenly pull them in.

### `portal list --all` Flag

A `--all` (or equivalent) flag to display unfiltered output is
deferred. Users have `tmux ls` for inspecting Portal-internal
sessions; adding a flag now would solve a hypothetical need. Can
be added later if a real diagnostic use case emerges.

### `ListAllSessions` / `ListSessionsRaw` Sibling Method

Documented as the available extension point in Fix A but **not**
implemented in this bugfix. No production caller currently needs
unfiltered output — the only callers identified (`cmd/list.go`,
`internal/tui/model.go`) all want the filter. Add the method when
the first legitimate consumer appears, not speculatively.

### Bootstrap Orchestrator Step For Explicit Cleanup

The "kill the bootstrap session after Restore" approach (option
B2 from the investigation) was rejected in favour of Fix B
(rename). No new orchestrator step is added. The existing
nine-step bootstrap sequence is unchanged in shape.

### Generalised Internal-Session Naming Policy

The `_` prefix convention is already documented in the
`built-in-session-resurrection` specification. This bugfix does
not extend, formalise, or relocate that policy beyond the targeted
filter and rename described above.

### Audit Of Other `Client.List*` Methods

Other listing methods (`ListPanes`, `ListPanesInSession`,
`ListAllPanes`, `ListAllPanesWithFormat`) are **not** audited or
modified in this bugfix. Pane-level filtering is a separate
concern, and there is no observed bug or spec mandate driving a
change there.

### Cleanup Of Pre-Existing `0` Sessions On Upgrade

When users upgrade to a Portal version that includes Fix B, tmux
servers that were started by an older Portal will already host a
session named `0`. The new `StartServer` does not run because the
server is already running, so the rename never happens for that
server's lifetime. Fix A does not filter `0` (it filters only
`_*`).

Auto-cleanup is **not** added because Portal cannot safely
distinguish "leftover bootstrap session named `0`" from "user-owned
session named `0`" — a user is free to create one. Filtering the
literal name `0` carries the same risk.

The accepted resolution is: the legacy `0` session persists until
the user restarts their tmux server (machine reboot, manual `tmux
kill-server`, `pkill tmux`, etc.). The release notes for the
shipping change MUST mention this — the suggested wording is "After
upgrading, restart your tmux server (`tmux kill-server`) once to
clear any leftover `0` session created by the previous version." No
code change is required.

## Rollout

This is a regular bugfix. No feature flag, no env-var gate, no
staged rollout. The change is observable but strictly improves UX,
and there is no scenario where it is desirable to ship the broken
behaviour.

Commit shape: two small targeted commits, each with its own test:

1. Fix A (filter in `Client.ListSessions`) plus the
   `Client.ListSessions` unit test and the doc-comment cleanup on
   `tmux.PortalSaverName`.
2. Fix B (rename bootstrap session) plus the `TestStartServer`
   update, the `PortalBootstrapName` constant, the doc-comment
   cleanup on `tmux.StartServer`, **and the end-to-end
   post-bootstrap test** (see Test Requirements → "End-To-End —
   Post-Bootstrap Session State").

The end-to-end test MUST ship in commit 2 (or in a third commit
landing after both fixes), never in commit 1. Shipping it in
commit 1 would yield a misleading-green test: commit 1 alone leaves
the bootstrap session named `0`, and Assertion 1 of the end-to-end
test would fail against that intermediate state. Pairing the test
with commit 2 keeps the test green only when both root causes are
fixed.

**Review as a pair.** The two commits should be reviewed
together — commit 1's `tmux.PortalSaverName` doc-comment references
Fix A's filter behaviour, which is fully realised only after
commit 2's rename. A reviewer landing only commit 1 should expect
a transient state where `_portal-saver` is hidden but `0` remains
visible.

---

## Working Notes
