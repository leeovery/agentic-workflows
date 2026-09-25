# Investigation: Scrollback Not Restored With Non-Zero Base Index

## Symptoms

### Problem Description

**Expected behavior:**
After `tmux kill-server` and reattach, Portal restores sessions/windows/panes with their saved scrollback replayed into each pane.

**Actual behavior:**
With tmux configured `set -g base-index 1` and `setw -g pane-base-index 1`, Portal restores skeleton (sessions/windows/panes), cwd, and layout, but the saved scrollback never appears in the pane. The pane comes up with only a fresh shell prompt — the session looks restored but feels empty.

### Manifestation

`~/.config/portal/state/portal.log` contains, for each pane after restart:

```
WARN | restore | session "-dotfiles-HM9Zhw": pane 0 predicted=-dotfiles-HM9Zhw__0.0 live=-dotfiles-HM9Zhw__1.1
WARN | hydrate | timeout waiting for signal on --hook-key=-dotfiles-HM9Zhw:1.1 --fifo=/Users/lee/.config/portal/state/hydrate--dotfiles-HM9Zhw__1.1.fifo
```

Save side is unaffected; per-pane scrollback files contain the expected ANSI-coloured terminal history.

### Reproduction Steps

1. Project directory whose basename starts with `.` (e.g., `~/.dotfiles`) — **OR** any tmux config with non-zero `base-index` that surfaces the misleading WARN.
2. tmux.conf includes `set -g base-index 1` and `setw -g pane-base-index 1`.
3. Open a Portal-managed session in the dotfiles project, generate scrollback.
4. `tmux kill-server`, reattach via Portal.

**Reproducibility:** Always, when project name yields a session name starting with `-`. (See "Root Cause" — base-index is **not** the actual cause of hydration failure.)

### Environment

- Portal v0.3.0; tmux 3.x; not platform-specific.
- Triggered by combination of (a) project directory whose basename has a leading `.` or `:` (e.g. `.dotfiles`, `.config`), and (b) `client-attached` / `client-session-changed` hooks invoking `signal-hydrate <session>`.

### Impact

- **Severity:** High — silent loss of scrollback persistence for any Portal session whose name starts with `-`. Users with non-default base-index see a misleading WARN and conclude the bug is base-index–related.
- **Scope:** Anyone whose project basename begins with `.` or `:` (sanitised to `-` by `internal/session/naming.go::SanitiseProjectName`), regardless of base-index settings.
- **Business impact:** Save daemon reports success — failure is invisible until a user actually inspects scrollback after a reboot.

### References

- Inbox bug report: `.workflows/.inbox/.archived/bugs/2026-04-30--scrollback-not-restored-with-non-zero-base-index.md`
- Spec § "Index Semantics and base-index / pane-base-index" — mandates re-querying live indices (already implemented).

---

## Analysis

### Initial Hypothesis (from bug report)

Reporter's interpretation: restore predicts pane keys assuming default tmux indexing; with non-zero `base-index`, predicted key (`__0.0`) diverges from live key (`__1.1`); the hydrate FIFO/hook handshake — keyed off the predicted id — never closes.

### What the code actually does

The implementation **already follows the spec's "Index Semantics" section** (`internal/restore/session.go`):

- `armPanes` (session.go:195) calls `ListPanesInSession` to get live `[]tmux.PaneCoord` after `new-session`/`split-window`/`new-window`.
- FIFO path at `session.go:215` is built from `state.SanitizePaneKey(sess.Name, live.Window, live.Pane)` — the **live** key.
- Helper is dispatched via `respawn-pane -k` against the live pane target (session.go:222).
- `ApplySkeletonMarkers` (session.go:354) iterates `livePanes` and writes `@portal-skeleton-<liveKey>` for each.

So the helper correctly waits at `hydrate-<sess>__1.1.fifo` (live FIFO), the marker is set at `@portal-skeleton-<sess>__1.1` (live key), and `signal-hydrate` enumerates live panes via `list-panes -s` and computes the same live key for marker lookup. **Functionally, the live-index path is consistent end-to-end and would succeed under base-index drift in isolation.**

### The misleading WARN (`predicted=__0.0 live=__1.1`)

`Orchestrator.warnOnPaneKeyDrift` (`restore.go:153`) calls `SessionRestorer.PredictLiveIndices()` (session.go:424) which calls `client.GetServerOption("base-index")` and `client.GetServerOption("pane-base-index")`.

**Bug:** `GetServerOption` reads tmux **server-scope** options (via `show-options -sv`). But:
- `base-index` is a **session option** (`set-option -t <target>` / `set -g`).
- `pane-base-index` is a **window option** (`setw -t <target>` / `setw -g`).

Neither is a server option. `GetServerOption` always returns `ErrOptionNotFound`, so `readIndexOption` falls back to `0` for both. `PredictLiveIndices()` therefore returns `(0, 0)` regardless of the user's tmux config.

Consequence: the diagnostic WARN compares the always-zero "predicted" against the actual live key. Whenever the user has non-zero `base-index`/`pane-base-index`, live ≠ 0,0, and the WARN fires. The WARN is non-causal — it does not affect any FIFO path, marker, or hook — but it misleads users into believing prediction-vs-live is the source of hydration failure.

`PredictLiveIndices` has no other caller beyond this diagnostic.

### The actual cause of hydration timeout

The failing session in the report is named `-dotfiles-HM9Zhw`. The leading `-` traces to:

- Project directory `.dotfiles` (basename has leading dot).
- `internal/session/naming.go::SanitiseProjectName` (line 24) replaces `.` and `:` with `-` — `.dotfiles` → `-dotfiles`.
- `GenerateSessionName` appends a 6-char nanoid → `-dotfiles-HM9Zhw`.

The `client-attached` / `client-session-changed` hook command is:

```
run-shell "command -v portal >/dev/null 2>&1 && portal state signal-hydrate #{session_name}"
```

(`internal/tmux/hooks_register.go:39`). When tmux fires the hook for a session named `-dotfiles-HM9Zhw`, the resolved shell command is:

```
... && portal state signal-hydrate -dotfiles-HM9Zhw
```

cobra/pflag parses `-dotfiles-HM9Zhw` as **short flags**, fails with `unknown shorthand flag: 'd' in -dotfiles-HM9Zhw`, and exits non-zero. RunE never executes, so no FIFO byte is written, and the helper times out at 3 seconds.

Verified empirically:

```
$ portal state signal-hydrate -dotfiles-HM9Zhw
unknown shorthand flag: 'd' in -dotfiles-HM9Zhw
Exit: 1

$ portal state signal-hydrate myrepo-AbCdEf
Exit: 0

$ portal state signal-hydrate -- -dotfiles-HM9Zhw
Exit: 0
```

`stateSignalHydrateCmd` defines no flags (cmd/state_signal_hydrate.go:132), but cobra inherits parent persistent flags and pflag still attempts to parse leading-`-` tokens as short-flag clusters even with no flags registered.

### Why "removing base-index makes it work" appears true (but isn't)

The reporter observed the WARN disappear after removing base-index settings. With base-index unset, live indices match the always-zero prediction (`live=__0.0`, `predicted=__0.0`), so `warnOnPaneKeyDrift` does not fire — but `signal-hydrate` would **still fail** to parse `-dotfiles-HM9Zhw` and hydration would still time out. The reporter likely:
- Tested a different session whose name did not start with `-` (no leading-dot project), OR
- Observed only the absence of the WARN line, not whether scrollback actually appeared.

The reporter's confidence that "removing base-index — or matching Portal's predicted indices — makes the symptom go away" is consistent with seeing the diagnostic WARN go quiet, not with verifying end-to-end hydration.

### Code Trace

**Entry point:** `client-attached` hook fires after `tmux attach-session -A` exec'd by Portal.

**Path:**
1. tmux runs `portal state signal-hydrate -dotfiles-HM9Zhw` via `run-shell`.
2. cobra parses argv → `unknown shorthand flag: 'd' in -dotfiles-HM9Zhw` → exit 1.
3. No FIFO write. No marker check. No work.
4. Helper at `cmd/state_hydrate.go:100` blocks on FIFO open via `openFIFOWithTimeout(cfg.FIFO, 3*time.Second)`.
5. After 3s, `ErrHydrateTimeout` returns. `handleHydrateTimeout` (state_hydrate.go:248) writes the WARN and exec's `$SHELL`. Pane lands on a fresh shell with no scrollback.

**Key files involved:**
- `internal/session/naming.go:24` — `SanitiseProjectName` produces leading `-` for `.dotfiles`.
- `internal/tmux/hooks_register.go:39` — `signalHydrateCommand` lacks `--` separator before `#{session_name}`.
- `cmd/state_signal_hydrate.go:132-162` — cobra command parses argv before RunE.
- `internal/restore/session.go:412-426` — `PredictLiveIndices` queries wrong scope (independent diagnostic-only bug).

### Root Cause

**Primary:** `signalHydrateCommand` in `internal/tmux/hooks_register.go:39` interpolates `#{session_name}` directly as a positional argument. When the session name begins with `-` (which Portal generates for any project basename starting with `.` or `:` via `SanitiseProjectName`), cobra parses it as a flag cluster, fails, and exits non-zero before `runSignalHydrate` runs. No FIFO byte is written; the helper times out at 3 s and exec's a bare shell.

**Secondary (diagnostic-only):** `SessionRestorer.PredictLiveIndices` reads `base-index`/`pane-base-index` via `GetServerOption` (server scope), but those are session/window options. Reads always return zero, making the `predicted=__0.0 live=__X.Y` WARN misleading whenever base-index is non-zero. The WARN is the visible artefact users associate with the bug, but it is non-causal — the actual hydration failure path runs entirely on live indices.

### Contributing Factors

- `SanitiseProjectName`'s `.` → `-` substitution silently produces session names that Portal's own subcommands (when invoked from `run-shell`) cannot consume.
- The `predicted vs live` WARN was authored as an early-warning diagnostic but compares against an always-broken predictor, so it consistently fires for users with non-default base-index — directing diagnostic attention away from the real cause.
- `signal-hydrate` failures are invisible to users: the only symptom is "no scrollback" + a `hydrate timeout` WARN. The argv parse error goes to stderr, which `tmux run-shell` captures into its own output stream, not `portal.log`.

### Why It Wasn't Caught

- Tests of `runSignalHydrate` (`cmd/state_signal_hydrate_test.go`) construct `signalHydrateConfig` directly and call the run function — they bypass cobra's argv parse stage entirely. Argv-parsing happens only in production via `RunE`.
- The reboot round-trip integration test in `cmd/bootstrap/reboot_roundtrip_test.go` uses session names that do not begin with `-` (e.g. "alpha", "beta"). Adding a leading-dash session name would have surfaced the failure.
- Project basenames with leading `.`/`:` are an uncommon but real workflow (dotfiles repos especially).

### Blast Radius

**Directly affected:** Any session whose name starts with `-`. This includes Portal-generated names from projects whose basename begins with `.` or `:` (after `SanitiseProjectName`'s substitution).

**Potentially affected:**
- Any other Portal subcommand invoked from a tmux hook with `#{session_name}` as a positional arg. `signalHydrateCommand` is currently the only such site (per `internal/tmux/hooks_register.go`); `notifyCommand` is argument-free and unaffected.
- User-issued `portal attach -dashed-session` from a shell prompt — same parse failure (unrelated to the spec but the same class of bug).

---

## Fix Direction

### Chosen Approach

Two-part fix.

**Part 1 (primary, fixes the observed symptom):** add a `--` end-of-flags separator to `signalHydrateCommand` so the session name is unambiguously positional regardless of its first character. Add a one-shot migration on bootstrap to remove any pre-existing hook entries that lack the `--` separator (so users upgrading don't keep the broken hook alongside a fixed one).

**Part 2 (diagnostic-quality fix):** delete `PredictLiveIndices`, `warnOnPaneKeyDrift`, and `flattenSavedPanePositions`. The function exists only to power a diagnostic WARN that has no functional consumer, and the spec-mandated approach is "re-query live indices, never predict." (Repair was considered — read `base-index` from session scope and `pane-base-index` from window scope — but rejected; see Discussion.) Pane-count mismatch is already logged at `armPanes:202`; if post-restore drift visibility is later wanted, a saved-vs-live comparison is the better shape.

### Options Explored

**A — `--` separator (chosen, primary).** Tiny change to one constant; no API surface impact; verified empirically with the current binary that `--` makes `-dashed-name` parse as positional. Requires a one-shot hook-content migration to evict old hooks; the migration can use a more specific `signalHydrateSubstring` like `portal state signal-hydrate --` so the dedupe check distinguishes fixed-vs-broken entries.

**B — Pass session via env var or `set-environment`.** Most robust to weird names (single quotes, semicolons, etc.) but requires a more invasive run-shell setup. Overkill for the constrained name alphabet Portal generates.

**C — Avoid leading-dash session names entirely** by re-mapping `.` to `_` (or another safe char) in `SanitiseProjectName`. Fixes one symptom but doesn't address the broader class — a user passing `-anything` to any Portal hook-invoked command would still break. Also a backwards-incompatible naming change for existing users with dotfile-prefixed projects.

**D — `cobra.Command.DisableFlagParsing = true` on `stateSignalHydrateCmd`.** Disables flag parsing for the whole subcommand. Works but loses the ability to add real flags later. Less intent-preserving than `--`.

Chosen: A for primary, plus delete-or-fix for the diagnostic. C is rejected as a name-format change; D is rejected as overly broad.

### Discussion

User accepted both findings (primary leading-dash argv parse, secondary `PredictLiveIndices` wrong-scope) on first presentation — synthesis validation gave high confidence with no gaps, and no further trace work was requested.

For Part 2, the recommendation is **delete** rather than repair `PredictLiveIndices` / `warnOnPaneKeyDrift` / `flattenSavedPanePositions`. Reasoning: the function powers only a diagnostic with no functional consumer, and the spec's stated mandate is "re-query live, never predict." A repaired predictor would buy a marginal post-restore drift signal at the cost of new tmux-client surface (session-scope + window-scope option getters) and continued conceptual tension with the spec. If post-restore drift visibility ever becomes valuable, a saved-vs-live comparison is more defensible than predicted-vs-live and can be added later without resurrecting prediction.

Bundle Part 1 + Part 2 in a single PR — both touch restoration-diagnostics correctness, both are low-complexity, and the diagnostic deletion in Part 2 closes the misleading-WARN loop that the user-facing bug report opened with.

### Testing Recommendations

- Add a unit test exercising `runSignalHydrate` end-to-end via the cobra `Execute()` path (not just direct config construction) with a session name starting with `-`. Today's tests bypass argv parsing.
- Extend `cmd/bootstrap/reboot_roundtrip_test.go` (or add a sibling integration test) with a session name starting with `-` to exercise the full hook firing path.
- Add a unit test for the hook content (including the `--` separator) so future edits to `signalHydrateCommand` don't silently regress.
- If `PredictLiveIndices` is repaired rather than deleted, add tests asserting it reads `base-index` from session scope and `pane-base-index` from window scope.

### Risk Assessment

- **Fix complexity:** Low for Part 1 (one-line constant change + migration), Low for Part 2 (delete or two-line scope swap).
- **Regression risk:** Low. Existing fixed-named sessions continue working; the migration cleanly evicts old hook entries.
- **Recommended approach:** Regular release. No hotfix urgency unless the user base has many dotfile-prefixed projects. Bundle Part 1 + Part 2 in one PR — they share a problem domain (restoration diagnostics correctness).

---

## Notes

- The bug report's framing ("non-zero base-index") is wrong about cause but right about the failing repro. The leading-dash session name is the silent variable; base-index is a confound that surfaces a misleading WARN. The investigation should drive a spec that fixes both, with the spec opening text disambiguating the user's framing.
- `SanitiseProjectName`'s `.` → `-` substitution is itself questionable (could be `_` instead) but changing it is a separate, larger discussion (existing users have sessions named with the current scheme).
