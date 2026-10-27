# Investigation: Status "Recent Warnings" Reads Zero (Pipe-Format Mismatch)

## Symptoms

### Problem Description

**Expected behavior:**
`portal state status` reports the actual recent warnings the daemon (and other
portal processes) logged in its "Recent warnings" section.

**Actual behavior:**
`portal state status` reports zero recent warnings regardless of what was
logged, because its log scanner still parses the **legacy pipe-delimited**
log format (`logFieldSeparator = " | "`) while `internal/log` now writes
slog **text** format (`<RFC3339Nano> <LEVEL> <component>: <msg> <attrs>`).
The formats no longer agree, so the scan silently matches nothing.

### Manifestation

- No error, no crash — silent. The "Recent warnings" section is always empty
  in production, masking real daemon/bootstrap/restore warnings.

### Reproduction Steps

1. Run portal so the daemon logs at least one WARN-level line to `portal.log`.
2. Run `portal state status`.
3. Observe the "Recent warnings" section reports zero / nothing.

**Reproducibility:** Always (deterministic format mismatch).

### Environment

- **Affected environments:** All (local + any install running the
  post-observability-layer build).
- **Platform:** n/a (format parsing, platform-independent).

### Impact

- **Severity:** Medium — a diagnostic/observability regression, not a
  data-loss or crash bug. The status command lies by omission.
- **Scope:** Anyone relying on `portal state status` to surface recent warnings.

### References

- Seed: `seeds/2026-06-02-status-recent-warnings-pipe-format.md` (inbox:bug,
  surfaced from review of `portal-observability-layer`).
- Discovery: `discovery/session-001.md`.

---

## Analysis

### Initial Hypotheses

(Seed claim, to be verified during code analysis:)
- `internal/state/status.go` (`scanRecentWarnings` / `logEntryQualifies`,
  `logFieldSeparator = " | "`) still parses the legacy pipe-delimited format.
- `internal/log`'s handler now writes slog text format.
- The two no longer agree → the warning scan matches nothing.
- Tests (`cmd/state_status_test.go`, `internal/state/status_test.go`) still
  seed pipe-format lines, so they pass against the stale parser.

Open questions deferred from discovery to this phase:
- How deep does the mismatch go — is **only** the warnings scanner affected,
  or do other `portal state status` fields read the log too?
- Do the status tests still seed the old pipe format (and thus give false
  green)?

### Code Trace

**Entry point:** `portal state status` → `cmd/state_status.go` → `state.CollectStatus(dir, now)`.

**Execution path:**
1. `internal/state/status.go:86` `CollectStatus` — gathers daemon state, index
   state, state-dir size, then calls `scanRecentWarnings(rep, PortalLog(dir), cutoff)`.
   The other collectors (`collectDaemonState`, `collectIndexState`,
   `computeStateSize`) do **not** read `portal.log` — only `scanRecentWarnings` does.
2. `internal/state/status.go:186` `scanRecentWarnings` — opens the log, scans
   line by line, calls `logEntryQualifies(line, cutoff)` per line.
3. `internal/state/status.go:207` `logEntryQualifies` — **the bug**:
   - `status.go:19` `logFieldSeparator = " | "` (pipe).
   - `status.go:208` `strings.SplitN(line, " | ", 4)`.
   - `status.go:209` `if len(parts) < 4 { return false }`.
4. Result flows to `cmd/state_status.go:108` `warningsLine` (renders
   `"N (last: <LastWarning>)"`) **and** to `cmd/state_status.go:127`
   `isUnhealthy` (`r.RecentWarnings > 0` → unhealthy / non-zero exit).

**The break (verified against the real writer):**
Production now writes slog **text** format (`internal/log/handler.go:131` `Handle`):
```
<RFC3339Nano> <LEVEL> <component>: <msg> <attrs k=v…> pid=… version=… process_role=…
```
e.g. `2026-06-08T14:00:00.12345Z WARN daemon: tick complete sessions=2 took=18ms pid=2 version=0.5.0 process_role=daemon`

There are **no `" | "` separators** in this format. So
`strings.SplitN(line, " | ", 4)` returns a **single-element** slice (the whole
line), `len(parts) == 1 < 4`, and `logEntryQualifies` returns `false` for
**every** line — unconditionally. `RecentWarnings` is always 0 and `LastWarning`
is always "".

**Key files involved:**
- `internal/state/status.go` — the stale pipe-format reader (root cause).
- `internal/log/handler.go` — the current slog text writer (`Handle`, line 147–177).
- `cmd/state_status.go` — formatting + `isUnhealthy` consumers of the broken fields.
- `internal/state/status_test.go:22` + `cmd/state_status_test.go:189,250` — tests
  that seed the **legacy pipe format**, so they pass against the stale parser
  (false green).

**Regression timeline (git):**
- `507f7308` (built-in-session-resurrection T6-4) introduced the pipe parser in
  `status.go` — at that time `internal/state`'s legacy logger wrote pipe-delimited
  lines, so reader and writer agreed.
- `08980e61` (portal-observability-layer T1-10, "delete legacy internal/state
  logger") changed the writer to slog text format. The status reader was out of
  scope for every observability task (per the seed), so its pipe assumption was
  never updated. **This is the introducing change.**

**Secondary detail (not a second bug):** `status.go:216` parses the timestamp
with `time.RFC3339` while the writer emits `RFC3339Nano`. Verified empirically
that Go's `time.Parse(time.RFC3339, …)` accepts fractional-second input (and
whole-second input) — so the timestamp/cutoff logic is salvageable as-is; the
**only** functional break is the field separator + field extraction. Worth
re-confirming during the fix, not a separate defect.

### Root Cause

`internal/state/status.go` parses `portal.log` assuming the **legacy
pipe-delimited** field format (`timestamp | level | component | message`,
`logFieldSeparator = " | "`), but the observability layer changed the writer to
**slog text** format (`<RFC3339Nano> <LEVEL> <component>: <msg> <attrs>`, space-
separated, `component:` literal prefix, no pipes). The reader's
`strings.SplitN(line, " | ", 4)` never yields ≥4 fields, so `logEntryQualifies`
rejects every line. `portal state status` reports zero recent warnings and a
"healthy" warnings signal regardless of what was actually logged.

**Why this happens:** a format contract between two modules (`internal/log` as
writer, `internal/state/status.go` as reader) was broken on the writer side with
no corresponding update to the reader, and no test exercised the reader against a
real writer-produced line.

### Contributing Factors

- **Self-seeding tests.** Both status test files construct fixtures in the old
  pipe format rather than via the real `internal/log` writer, so they validate
  the parser against input only the parser understands — the format change could
  not turn them red.
- **No shared format constant / no producer-consumer coupling.** The line format
  lives implicitly in `internal/log/handler.go`'s `Handle`; the reader re-derives
  it independently with its own constants. Nothing links the two.
- **Out-of-scope reader.** The status *reader* appeared in no observability plan
  task's file list (it is not the deleted logger), so the sweep that changed the
  format never touched it.

### Why It Wasn't Caught

- The status unit tests (`internal/state/status_test.go`,
  `cmd/state_status_test.go`) seed pipe-format lines and stayed green through the
  writer change — a textbook false green.
- No integration test feeds a genuine `internal/log`-produced line into
  `CollectStatus`/`scanRecentWarnings`.
- Silent failure mode: the scanner swallows malformed lines by design, so a
  100%-mismatch reads identically to "no warnings logged" — no error, no panic,
  nothing to notice.

### Blast Radius

**Directly affected:**
- `portal state status` "Recent warnings" line — always `0 (last: none)`.
- `portal state status` health/exit-code policy (`isUnhealthy`) — the
  "recent-warnings → unhealthy" branch (`cmd/state_status.go:134`) can never
  fire, so a daemon actively logging WARN/ERROR still reports healthy (exit 0).

**Not affected (confirmed):**
- All other `portal state status` fields — daemon running/PID/version, last save,
  sessions/panes counts, state size — read `daemon.pid` / `daemon.version` /
  `sessions.json` / the state-dir tree, **not** `portal.log`. The mismatch is
  confined to the two warning-derived fields.
- No other production code reads `portal.log` (`grep` for `PortalLog(` confirms
  the only non-test caller is `scanRecentWarnings`).

---

## Fix Direction

### Chosen Approach

Migrate the status reader (`internal/state/status.go`) to parse the slog **text**
format instead of the legacy pipe format. The reader needs only two fields per
line — the RFC3339Nano timestamp (token 0) and the level (token 1), both
whitespace-separated in `<RFC3339Nano> <LEVEL> <component>: <msg> <attrs…>`. So
`logEntryQualifies` switches from `SplitN(line, " | ", 4)` to a whitespace split
taking the first two tokens; `logFieldSeparator` / `expectedLogFieldCount` are
dropped. The existing `time.RFC3339` parse is already compatible with the
RFC3339Nano output (verified empirically), and the cutoff/window logic is
unchanged.

Two resolved direction forks:

- **Fork 1 — reader/writer sync (anti-recurrence): chosen = B (shared helper).**
  Export a parse helper from `internal/log` and consume it from
  `internal/state/status.go`. `internal/state` may import `internal/log` (log is
  a leaf that must not import state — one-directional, no import cycle). One
  format definition, one place to change.
  **Deciding factor:** directly removes the "writer and reader each define the
  format independently" contributing factor; the import direction is already
  legal so the coupling is free.

- **Fork 2 — `LastWarning` rendering: chosen = B (trim to human part).**
  Render `"<LEVEL> <component>: <msg>"` rather than the whole raw line (which now
  carries trailing `pid=…/version=…/process_role=…` baselines and every attr).
  **Deciding factor:** readability on the single `(last: …)` status line; this
  is a UX call, not correctness.

### Options Explored

- **Fork 1A — independent parser in `status.go`.** Smallest diff, but re-derives
  the format a second time, leaving the same drift able to recur. Not chosen.
- **Fork 2A — keep the full raw line.** Literally matches the prior contract but
  is noisy with baselines/attrs. Not chosen.
- (No "change the writer" option — the writer/handler is correct and out of
  scope; the reader is the side that drifted.)

### Discussion

The root cause is a deterministic, fully-validated format mismatch (independent
synthesis: high confidence, zero gaps), so the fix shape was settled quickly. The
substantive choices were both about *preventing recurrence and presentation*
rather than about *what is broken*: couple the reader to the writer's format via a
shared helper (Fork 1B) and tidy the surfaced warning text (Fork 2B). User agreed
with both recommendations. No edge cases shifted the direction; the
timestamp-format nuance was checked and ruled out as a second defect before the
discussion.

### Testing Recommendations

- Re-point the existing pipe-format fixtures in `internal/state/status_test.go`
  (`writeLogLine`, line 22) and `cmd/state_status_test.go` (lines 189, 250) to
  the slog text format.
- **Anti-false-green:** generate fixtures via the real `internal/log` writer (or
  the Fork-1B shared helper) so the reader is exercised against producer output —
  a future writer-format change then turns these tests red instead of leaving
  them silently green.
- Add at least one case that round-trips a genuinely-written WARN line through
  `CollectStatus` end-to-end (asserting `RecentWarnings`/`LastWarning` and the
  `isUnhealthy` consequence).
- Keep/extend the existing window-cutoff, level-filter, last-wins, and
  malformed-line cases against the new format (malformed-line case at
  `status_test.go:368` must be re-expressed in the new format).

### Risk Assessment

- **Fix complexity:** Low — a localised parser change plus a small exported
  helper, no behavioural change to the writer.
- **Regression risk:** Low — single confined reader; no other consumer of
  `portal.log`; all other status fields untouched. Main watch-item is parsing
  robustness for malformed/edge lines, which the existing swallow-and-skip
  contract already covers.
- **Recommended approach:** Regular release (a diagnostic-surface bugfix, not a
  hotfix-class production outage).

---

## Notes

User directive carried from discovery: investigate first; if the root cause is
not easily identifiable, stop the work; if it is, proceed to the fix.
