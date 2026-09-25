# Specification: Distinguish Transport Errors in GetServerOption

## Specification

## Problem & Goal

### Problem

`Client.GetServerOption` (`internal/tmux/tmux.go:304-310`) collapses every error from `cmd.Run("show-option", "-sv", name)` into the sentinel `ErrOptionNotFound`. The underlying tmux error and its stderr text are discarded.

The wrapper `Client.TryGetServerOption` (`internal/tmux/tmux.go:317-326`) therefore cannot distinguish "option absent" from "tmux call failed for any other reason." Its `if err != nil { return "", false, err }` branch is unreachable, and its `(value, found, err)` contract reports every transport failure as `("", false, nil)` — i.e. "option absent, no error."

This violates three documented contracts:

1. `internal/tmux/tmux.go:312-316` — `TryGetServerOption` docstring claims it distinguishes absence from real failure.
2. `internal/state/markers.go:34-35` — `RestoringChecker` interface docstring asserts absence is distinguishable from real failure.
3. `internal/state/markers.go:136-138` — `IsRestoringSet` docstring promises real tmux errors are propagated.

A fourth site (`cmd/state_daemon_run_test.go:557-565`) documents the bug as a known gap: a test for the "conservatively skip the final flush on read error" branch in `defaultShutdownFlush` cannot be written through the public `Client` surface today because of the conflation.

The bug is latent — no user-visible incident has been reported, because tmux runs against a local Unix-domain socket where transient transport failures are vanishingly rare. The bug is structural, not observed. The two production consumers (`cmd/state_daemon.go` `tick()` at L95-99 and `defaultShutdownFlush()` at L187-201) read `@portal-restoring` defensively and already want conservative-on-error behaviour ("skip the tick / skip the flush"). The conflation silently flips them from conservative-on-error to permissive-on-error in the presence of any transient tmux failure during the restoration window — both consumers proceed as if restoration is not in progress and would commit (per-tick) or flush (at shutdown) state derived from a half-restored skeleton.

**Historical note:** the original bug report (archived inbox entry at `.workflows/.inbox/.archived/bugs/2026-03-28--distinguish-transport-errors-in-getserveroption.md`) was framed around a hook-executor "two-condition check" that no longer exists — hook firing migrated into the hydrate helper's exec chain. The original symptom site is gone; the architectural concern moved to the marker-state reads in the daemon's restoration-window logic, which is what this specification addresses.

### Goal

`GetServerOption` and `TryGetServerOption` deliver on their documented contracts:

- **`GetServerOption(name)` → `(value, error)`**: returns `ErrOptionNotFound` only when tmux reports the option is genuinely absent; returns a non-nil, non-sentinel error for any other failure (transport, server crash, executable missing, etc.).
- **`TryGetServerOption(name)` → `(value, found, err)`**:
  - Option present → `(value, true, nil)`
  - Option absent → `("", false, nil)`
  - Any other failure → `("", false, non-nil-err)`
- The two daemon read sites (`tick()`, `defaultShutdownFlush()`) start receiving the errors they were always written to handle. Their consumer code is unchanged.
- The three docstrings cited above accurately describe what the code delivers.

---

## Design: `CommandError` at the Commander Layer

### Why this layer

The bug exists because the `Commander` interface signature `(string, error)` erases tmux's stderr distinction. Callers cannot route on stderr content without type-asserting on `*exec.ExitError`, which couples them to `os/exec` and breaks the mock surface. Wrapping at the `Commander` layer (rather than inside `GetServerOption`) restores the diagnostic shape in a type the interface can carry, lets every future caller discriminate failures through the same channel, and keeps mocks construct-by-struct-literal without involving `os/exec` types.

**Why the original "default to `ErrOptionNotFound`" shape felt safe:** every pre-existing caller of `GetServerOption` was an existence check that happily mapped failure to absence — the conflation produced the right answer for the common case. The contract drift only surfaced when the first wrapper (`TryGetServerOption`) was added asserting distinguishability that the underlying primitive could not deliver. The fix preserves the common-case ergonomics (callers using `errors.Is(err, ErrOptionNotFound)` continue to work unchanged) while delivering the distinguishability the wrapper has always claimed.

### Type

Introduce a typed error in `internal/tmux` that carries tmux's stderr alongside the underlying error so callers can discriminate failure modes without coupling to `os/exec`:

```go
// CommandError wraps an error returned by Commander.Run / Commander.RunRaw and
// carries the captured stderr from the underlying process. Stderr is empty when
// the failure was not an *exec.ExitError (e.g., executable not found).
type CommandError struct {
    Stderr string
    Err    error
}

func (e *CommandError) Error() string { /* see formatting rules below */ }
func (e *CommandError) Unwrap() error { return e.Err }
```

**`Error()` formatting:**

- When `Stderr` (after `strings.TrimSpace`) is non-empty: return `e.Err.Error() + ": " + strings.TrimSpace(e.Stderr)` — colon-space separator, trimmed stderr.
- When `Stderr` is empty or whitespace-only: return `e.Err.Error()`.
- When `e.Err == nil` (defensive — should not happen in practice): return `strings.TrimSpace(e.Stderr)`, or `"<no error>"` if that is also empty.

The rendered format is **not part of the public contract**; tests assert behavioural properties (e.g., that `errors.As` extracts a `*CommandError`, that `Stderr` contains the expected substring), not the exact string. `Stderr` itself is stored verbatim — only the `Error()` rendering trims for readability.

**Placement and exported-ness:** package-level exported type in `internal/tmux`. Exported so test code outside the package (and any future package-level helpers) can construct `*CommandError` literals as mock returns. The constructor is a plain struct literal — no `NewCommandError` factory.

### Wiring at `RealCommander`

Both `RealCommander.Run` (`internal/tmux/tmux.go:39-46`) and `RealCommander.RunRaw` (`internal/tmux/tmux.go:51-58`) currently invoke the process identically via `exec.Command("tmux", args...)` + `cmd.Output()` with `cmd.Stderr` left as nil, differing only in how they post-process the stdout bytes (`TrimSpace` vs verbatim). Both methods wrap their non-nil errors before returning:

- If the error is `*exec.ExitError`, populate `Stderr` from `(*exec.ExitError).Stderr`. This field is auto-populated by `cmd.Output()` only when `cmd.Stderr == nil` — a precondition of the current `RealCommander` implementation. Future changes that assign `cmd.Stderr` (e.g., to tee stderr elsewhere) would silently break the wrapping; the wiring is responsible for preserving this invariant or capturing stderr explicitly via `cmd.StderrPipe()` if `cmd.Stderr` is repurposed.
- If the error is any other type (e.g., `exec.Command(...)` failed to find the binary), wrap with `Stderr: ""`. An empty `Stderr` means "no signal" — discriminators that examine `Stderr` will see no pattern match and treat the error as non-absence, which is the correct conservative behaviour.

In both cases the original error is preserved via `Unwrap()` so existing `errors.Is` / `errors.As` checks against sentinel errors continue to work.

### Mock surface

The `Commander` interface signature is unchanged: `Run(args ...string) (string, error)` / `RunRaw(args ...string) (string, error)`. Mocks that previously returned a bare `error` continue to compile.

Mocks that need to simulate a specific stderr return a `*CommandError` literal:

```go
mockCmd.RunFn = func(args ...string) (string, error) {
    return "", &tmux.CommandError{Stderr: "invalid option: @foo", Err: errors.New("exit status 1")}
}
```

Tests that don't care about stderr continue to return `errors.New(...)` — discriminators will see an empty `Stderr` and behave conservatively.

---

## Design: Discrimination in `GetServerOption`

### Behaviour

`Client.GetServerOption(name string) (string, error)` extracts the wrapped `*CommandError` from any non-nil error, inspects its `Stderr`, and returns:

- `(strings.TrimSpace(output), nil)` on success (no error).
- `("", ErrOptionNotFound)` when the error unwraps to a `*CommandError` whose `Stderr` matches the option-absent pattern family (see below).
- `("", err)` — the original wrapped error — for every other failure (transport, executable-missing, server crash, unmatched stderr).

Extraction uses `errors.As(err, &cmdErr)` so a future error-wrapping change at the `Commander` layer does not break the discriminator.

**Fallthrough when `errors.As` returns false:** if `err` is a non-nil error that is not a `*CommandError` and does not unwrap to one (e.g., a test mock returning `errors.New(...)` directly, or a future caller that wraps errors before they reach `GetServerOption`), the discriminator treats the failure as **non-absence** and returns the original `err` unchanged. This is the same outcome as "matched a `*CommandError` with empty `Stderr`": no pattern match, propagate. Callers using `errors.Is(err, ErrOptionNotFound)` correctly report `false`; callers using `errors.As(err, &cmdErr)` to recover stderr receive `false` (no `*CommandError` present) — which is correct, because none existed.

**`Stderr` storage:** the `Stderr` field on `*CommandError` is stored **verbatim** as captured from `(*exec.ExitError).Stderr` — including trailing whitespace or newlines that tmux emits. Pattern matching uses `strings.Contains`, which is insensitive to trailing whitespace. Only `CommandError.Error()` trims (for readability — see Type section).

### Option-absent pattern family

Tmux signals option absence via stderr containing one of these substrings:

- `invalid option:` — unknown `@`-prefixed user option or unknown non-prefixed option name.
- `unknown option:` — alternate form emitted by some tmux versions.
- `ambiguous option:` — option name is an ambiguous prefix match. Empirically surfaced during investigation by probing `show-option -sv ""` on tmux against Darwin 25.3.0 (the empty name is treated as an ambiguous match and produces `ambiguous option: ` with a trailing space).

The pattern set is a small, package-level slice in `internal/tmux` named `optionAbsentStderrPatterns` (unexported — `internal/tmux` already gates the surface, so package-private is sufficient and avoids adding to the package's exported API; tests live in the same `tmux` package and can read the unexported slice directly). It is not inlined in `GetServerOption` so that:

- The discrimination set is reviewable and testable in isolation.
- Future tmux versions or platforms that emit additional absence phrasings can be added in one place.

Iteration form: a simple `for _, pat := range optionAbsentStderrPatterns { if strings.Contains(cmdErr.Stderr, pat) { return ErrOptionNotFound } }` — short-circuits on first match. No compiled regex, no alternation. Three patterns; iteration cost is negligible.

Matching is **case-sensitive substring** against `cmdErr.Stderr`. No normalisation (lowercasing, regex) is required.

**Compatibility floor:** the project does not pin a tmux minimum version anywhere. The pattern set is therefore treated as empirically derived from the tmux baseline available during investigation (probed against tmux on Darwin 25.3.0) and is best-effort across the tmux versions users are likely to run. The discriminator-set unit tests (see Testing) lock the contract behaviourally — a future tmux release that emits a new option-absent phrasing surfaces as a fast test failure rather than a silent drift, at which point the pattern slice can be extended in one place.

### Failure modes that do NOT match the absent family

- "error connecting to /private/tmp/tmux-501//<sock> (No such file or directory)" — socket/transport.
- Empty `Stderr` (non-`ExitError` wrapping, e.g., binary not found).
- Any other stderr the future yields.

These propagate as the wrapped `*CommandError` to the caller. They are not `ErrOptionNotFound`.

---

## Design: `TryGetServerOption` and Consumer Surface

### `TryGetServerOption` body — unchanged

```go
func (c *Client) TryGetServerOption(name string) (string, bool, error) {
    val, err := c.GetServerOption(name)
    if errors.Is(err, ErrOptionNotFound) {
        return "", false, nil
    }
    if err != nil {
        return "", false, err
    }
    return val, true, nil
}
```

No code change is required in this function. Its behaviour changes because its dependency (`GetServerOption`) is now contract-faithful:

- The `errors.Is(err, ErrOptionNotFound)` branch is now exclusive to genuine absence.
- The `if err != nil { return "", false, err }` branch — previously unreachable — becomes the live transport-error path.

### Consumer surface — unchanged

- `internal/state/markers.go:140` — `IsRestoringSet` continues to propagate errors via the existing `_, found, err := c.TryGetServerOption("@portal-restoring")` shape. No code change.
- `cmd/state_daemon.go:95-99` — `tick()` already does `if err != nil { log.Warn(...); return }`. The warn log and early return start firing for transport errors instead of being silently dead.
- `cmd/state_daemon.go:187-201` — `defaultShutdownFlush()` already does `if err != nil { log.Warn(...); return nil }`. Same — the branch becomes live.

No daemon consumer code changes. The behavioural shift is "transport errors now flow into branches the consumers already wrote."

### `ErrOptionNotFound` — unchanged

`ErrOptionNotFound` remains a `var` sentinel in `internal/tmux`. Its meaning narrows from "any error from `GetServerOption`" to "tmux reports the option is genuinely absent." External code using `errors.Is(err, tmux.ErrOptionNotFound)` continues to work — under the new contract those checks now correctly mean "the option does not exist."

---

## Documentation & Test-Comment Updates

Four production-code docstring sites currently document or anticipate the distinguishability contract; after the fix, all four must be coherent with the implementation. A fifth site is a test-file comment block that documents the bug as a known gap — removed and replaced with the previously-blocked test. Items 1–4 below belong to a docs-tightening task; item 5 belongs to the test-reshape task (see Testing section).

### 1. `internal/tmux/tmux.go:312-316` — `TryGetServerOption` docstring

Existing wording asserts: *"distinguishing absence from a real tmux failure (which surfaces as a non-nil error)."* This becomes accurate once the dependency is fixed. The docstring may be tightened to reference `ErrOptionNotFound` explicitly and to clarify that any other error indicates a transport or environmental failure.

### 2. `internal/tmux/tmux.go` — `GetServerOption` docstring

Add or update a docstring describing the new contract:

- Returns `ErrOptionNotFound` only when tmux's stderr matches the option-absent pattern family.
- Returns a wrapped `*CommandError` (accessible via `errors.As`) for any other failure.
- Callers using `errors.Is(err, ErrOptionNotFound)` continue to work and now correctly identify genuine absence only.

### 3. `internal/state/markers.go:34-35` — `RestoringChecker` interface docstring

Existing wording: *"absence vs. real failure is distinguishable."* Becomes accurate. May be lightly amended to point at `tmux.ErrOptionNotFound` as the discriminator sentinel, but no semantic change is required.

### 4. `internal/state/markers.go:136-138` — `IsRestoringSet` docstring

Existing wording: *"Any underlying tmux error is propagated so a real failure does not silently masquerade as 'not restoring'."* Becomes accurate. No change required unless tightening for clarity.

### 5. `cmd/state_daemon_run_test.go:557-565` — documented-gap comment block

The comment block explains that a test for `defaultShutdownFlush`'s err-branch cannot be written through the public `Client` surface today. After the fix:

- The comment block is **removed**.
- It is **replaced** by the actual test (see "Testing" section).

---

## Testing

### `internal/tmux/tmux_test.go`

- **Reshape existing `TestGetServerOption` "option does not exist" case** (currently uses `errors.New("unknown option: @portal-active-%3")`): the existing error string is decorative — it is never inspected because today every error from `cmd.Run` becomes `ErrOptionNotFound` regardless of content. Replace the bare `errors.New(...)` with a `*CommandError` whose `Stderr` matches the option-absent pattern family so the test actually exercises stderr-pattern matching. The test continues to assert `errors.Is(err, ErrOptionNotFound)`.
- **Add `TestGetServerOption_TransportError`**: parametrised over a small set of representative non-absent stderr shapes — at minimum the socket-connect failure (`"error connecting to /tmp/tmux-501//default (No such file or directory)"`) and a server-crash shape (`"lost server"`). Mock returns a `*CommandError` with each stderr; assert `!errors.Is(err, ErrOptionNotFound)` and that the returned error unwraps to a `*CommandError` carrying the original stderr. The fault-injection harness is the existing `Commander` mock returning a synthetic exit-1 + stderr — no real `os/exec` interaction required for the discriminator tests.
- **Add `TestGetServerOption_NonExitErrorPropagates`**: mock returns a `*CommandError{Stderr: "", Err: errors.New("exec: \"tmux\": not found")}`. Assert `!errors.Is(err, ErrOptionNotFound)` and that the error propagates.
- **Add `TestTryGetServerOption_PropagatesTransportError`**: covers the previously-unreachable `if err != nil { return "", false, err }` branch. Assert `(value, found, err) == ("", false, non-nil)` with `errors.As` recovering the `*CommandError`.
- **Add discriminator-set unit tests** in `internal/tmux/tmux_test.go` (same-package, white-box — so the unexported `optionAbsentStderrPatterns` slice is directly addressable): each entry in the slice is exercised against a synthetic stderr containing it, asserting `ErrOptionNotFound` is returned. A negative case asserts an unrelated stderr does not match.

### `cmd/state_daemon_run_test.go`

- **Remove the documented-gap comment block at lines 557-565.**
- **Add the previously-blocked test** for `defaultShutdownFlush`'s `if err != nil { return nil }` branch:
  - **Fault injection**: use the existing `Deps`-style seam in `cmd/state_daemon.go` to inject a tmux-client mock whose `TryGetServerOption("@portal-restoring")` returns `("", false, &tmux.CommandError{Stderr: "lost server", Err: errors.New("exit status 1")})`.
  - **"Returns nil"**: assert the function's return value is `nil`.
  - **"Without committing state"**: assert via the daemon's existing capture/commit seam — the same mock-tracking pattern already used by neighbouring tests in `cmd/state_daemon_run_test.go` to verify zero commit calls. (No new seam is introduced by this fix.)
  - **"Warn log is emitted"**: capture via the same log-capture pattern used by neighbouring tests (the `state` package's structured logger writes through a test sink already wired in the daemon test harness). If the existing harness has no log-capture seam, asserting return value + zero-commit is sufficient for acceptance — the warn-log is an observability detail, not a correctness invariant.
- **Add a test for `tick()`'s err-handling branch** (`cmd/state_daemon.go:95-99`). The implementer must first confirm whether existing daemon tests already cover this branch through the test seam (the daemon-side `tickDeps` or equivalent). If covered, replace the existing mock that returned a bare `errors.New(...)` with one that returns a non-`ErrOptionNotFound` error (per the sweep in "Pre-implementation sweep"). If not covered, add a new test asserting the tick logs warn and returns without performing capture under the same fault-injection shape used for the flush test.

### `internal/state/markers_test.go`

- **`TestIsRestoringSet :: propagates underlying tmux error` (existing, line 205-210) continues to pass.** The test uses a `checkerMock` that directly implements `RestoringChecker` and returns `errors.New("tmux exploded")` to `IsRestoringSet` — bypassing the buggy `TryGetServerOption` entirely. The test passes today because the mock surfaces the error directly, not because the production code propagated it through. After the fix, the production path (`TryGetServerOption` → `IsRestoringSet`) is finally capable of delivering this contract end-to-end; the mock-based test continues to pass unchanged and now correctly reflects production behaviour.

### `internal/tmux` — `Commander` layer

- **`TestRealCommander_RunWrapsExitError`** (new): invoke `sh -c 'echo "synthetic stderr marker" 1>&2; exit 1'` via a temporarily-shimmed exec path or by exposing a small test-only constructor that targets `sh` instead of `tmux` (the implementer picks the lower-cost shape; if `RealCommander` is hard-coded to `tmux`, factor out a small `runner` helper that accepts the binary name and have the test target it). Assert the returned error unwraps to `*CommandError` with `Stderr` containing `"synthetic stderr marker"`. Skipped automatically on platforms where `sh` is not on `PATH`; the platform-applicability statement (Darwin + Linux) makes this acceptable.
- **`TestRealCommander_RunWrapsNonExitError`** (new): invoke a deterministic non-existent binary name — `__portal_test_nonexistent_binary__`. Assert the returned error unwraps to `*CommandError` with `Stderr == ""` and `Unwrap()` returning a non-`*exec.ExitError` error (the underlying `*exec.Error` from `exec.LookPath` / `cmd.Start`).

### Test policy reminders

- Per `CLAUDE.md`: tests in `cmd` and any package using `*Deps` injection **must not** use `t.Parallel()`. The new daemon tests inherit this constraint.
- No new mock framework — existing `Commander` mock surface is sufficient with `*CommandError` literals.

### Pre-implementation sweep

Before reshaping tests, the implementer must perform two short sweeps to confirm the audited surface still matches what investigation recorded.

**Production-code sweep** — `grep -rn "ErrOptionNotFound\|GetServerOption\|TryGetServerOption" --include="*.go" . | grep -v _test.go` should produce the following call sites and no others:

- `internal/tmux/tmux.go` — defines `ErrOptionNotFound`, `GetServerOption`, `TryGetServerOption`, and `TryGetServerOption`'s only internal caller (itself). No external caller exists for `GetServerOption`.
- `internal/state/markers.go:140` — `IsRestoringSet` is the **only** production caller of `TryGetServerOption`. It propagates errors via the existing `(value, found, err)` shape; no `errors.Is(err, tmux.ErrOptionNotFound)` is performed at this site (or anywhere in production code outside `tmux.go` itself).

No production caller treats `GetServerOption`/`TryGetServerOption` failure as a silent no-op via the conflation. The Risk & Rollout "no new failure mode introduced" claim therefore holds. If the sweep surfaces any caller not listed here, it must be audited individually before the fix lands.

**Test-code sweep** — same grep including `_test.go`:

- `internal/tmux/tmux_test.go` — `TestGetServerOption` "option does not exist" case is the only test relying on the old conflation; all other server-option tests in this file either exercise success paths or use the `ShowAllServerOptions` path which is unaffected.
- `internal/state/markers_test.go:205-210` — `TestIsRestoringSet :: propagates underlying tmux error` uses a `checkerMock` (a custom `RestoringChecker` implementation, not a `Commander` mock) that returns `errors.New("tmux exploded")` directly. The mock bypasses `TryGetServerOption` entirely and surfaces the error to `IsRestoringSet` directly, so this test passes today and continues to pass — no change required.
- `cmd/state_daemon_run_test.go` — documented-gap comment at lines 557–565 indicates no existing test reaches the err-branch through the public `Client` surface; the replacement test introduced by this fix is the first such test.

If the test sweep surfaces any test outside these three sites that relies on the old conflation, it is part of the test-reshape task scope.

---

## Scope

### In scope

- New `CommandError` type in `internal/tmux` (exported, struct-literal constructable).
- `RealCommander.Run` / `RealCommander.RunRaw` wrap their non-nil errors with `*CommandError`.
- `GetServerOption` discriminates via `errors.As` + stderr pattern-family substring match.
- `TryGetServerOption` body unchanged; dead branch becomes live.
- Docstring tightening at the four cited sites.
- Test reshapes and additions per the Testing section.
- Removal of the documented-gap comment block in `cmd/state_daemon_run_test.go`.

### Out of scope

- Changes to the `Commander` interface signature. `Run` and `RunRaw` keep `(string, error)`.
- Changes to any other `internal/tmux` method. The wide-scope audit performed during investigation verified the following surfaces propagate errors correctly today and are unaffected by this fix:
  - `ShowAllServerOptions` — returns `fmt.Errorf("failed to show server options: %w", err)`.
  - `ListSkeletonMarkers` (the daemon's per-tick enumeration path) — consumes `ShowAllServerOptions` and returns `(nil, err)`.
  - `SetServerOption` / `UnsetServerOption` (the marker-writer paths) — propagate errors normally.

  The bug is **isolated to `GetServerOption`** and its single wrapper `TryGetServerOption`. No other surface in `internal/tmux` exhibits the same shape.
- Changes to daemon consumer logic in `cmd/state_daemon.go`. The fix surfaces errors into branches the consumers already wrote correctly.
- Migration of other callers to the `*CommandError` discriminator. No other production caller of `internal/tmux` currently distinguishes failure modes; this fix does not introduce new discrimination sites.
- Re-architecting `ErrOptionNotFound` (e.g., turning it into a struct error type). It remains a sentinel `var`.

### Non-goals

- Producing observable user-facing behaviour changes in the happy path. Under normal operation (no transient tmux failures), behaviour is identical to today.
- Adding telemetry or metrics for transport errors. The existing `log.Warn` calls in daemon consumers are the only observable signal and they already exist.

## Acceptance Criteria

1. `GetServerOption("@some-marker")` returns `("", ErrOptionNotFound)` if and only if the returned error unwraps (via `errors.As`) to a `*CommandError` whose `Stderr` contains a substring from the option-absent pattern family (`invalid option:`, `unknown option:`, `ambiguous option:`). Errors that do not carry a `*CommandError` propagate unchanged as non-`ErrOptionNotFound` errors regardless of their `.Error()` text.
2. `GetServerOption("@some-marker")` returns a non-nil, non-`ErrOptionNotFound` error wrapping `*CommandError` for any other failure mode whose `Commander` invocation produces one — transport errors, server crashes, executable-not-found, or any stderr that does not match the absent family.
3. `TryGetServerOption("@some-marker")` returns `("", false, non-nil-err)` for any non-absent failure — exercising the `if err != nil { return "", false, err }` branch that was previously unreachable.
4. `IsRestoringSet`'s daemon callers (`tick()`, `defaultShutdownFlush()`) receive non-nil errors for transport failures and skip their action conservatively (warn log + early return).
5. All existing tests pass without behavioural change in the happy path.
6. New tests assert each transport-error and pattern-discriminator scenario in the Testing section.
7. The four contract-violation docstrings now accurately describe the implementation.
8. The documented-gap comment block at `cmd/state_daemon_run_test.go:557-565` is removed and replaced with the previously-blocked test.

## Risk & Rollout

- **Regression risk:** Low. The behavioural change is "transport errors now propagate into branches consumers already wrote." No new failure mode is introduced — only previously-suppressed failure modes are surfaced into existing handling.
- **Rollout:** Regular release. No incident pressure, no hotfix.
- **Compatibility:** No external API changes. The `Commander` interface signature is unchanged; consumers of `tmux.ErrOptionNotFound` continue to work with semantics that now match their intent.
- **Platform applicability:** Darwin and Linux. The conflation is in pure Go logic with no platform branching, and the pattern-family discrimination relies on tmux's stderr emissions which are consistent across the two platforms. No platform-conditional code is introduced by the fix.

---

## Implementation Ordering

The fix decomposes into five logical units. They must land in this order to avoid intermediate states that break existing callers:

1. **`CommandError` type** — introduce the type in `internal/tmux`. No production behaviour change.
2. **`RealCommander` wiring** — `Run` and `RunRaw` start returning `*CommandError`. Existing `errors.Is(err, ErrOptionNotFound)` checks at `TryGetServerOption` consumers continue to work only because `GetServerOption` still maps every error to `ErrOptionNotFound` — until step 3 lands, this is the load-bearing fact. Do not split (2) and (3) across PRs.
3. **`GetServerOption` discriminator + `optionAbsentStderrPatterns` slice** — discriminator becomes contract-faithful. `TryGetServerOption`'s `if err != nil` branch becomes live. Daemon consumers start receiving transport errors. (1)+(2)+(3) must land together.
4. **Docstring tightening at items 1–4 of "Documentation & Test-Comment Updates"** — may land alongside (3) or as a follow-up. No behaviour change.
5. **Test reshape and additions** — including removal of the documented-gap comment block in `cmd/state_daemon_run_test.go`. Lands with or after (3).

Recommendation: **single PR, single commit** is acceptable given the small surface area and the fact that (1)+(2)+(3) cannot be split safely. If split into commits within one PR, the order above is mandatory.

---

## Alternatives Considered

The investigation evaluated four other shapes before settling on typed `CommandError` at the Commander layer. Each is recorded here so future readers can audit the trade-off:

- **B. `fmt.Errorf("%w: %s", err, stderr)` wrap at the Commander layer.** Rejected: the discriminator becomes a substring-match against a formatted error string. Brittle if the wrap format ever changes; harder to test the boundary cleanly.
- **C. New `Commander.RunWithStderr(args...) (out, stderr string, err error)` method.** Rejected: a parallel API surface forces every mock to stub a second method, and the addition does not protect against similar latent conflations elsewhere.
- **D. Inline type-assert against `*exec.ExitError` inside `GetServerOption`.** Rejected: couples `internal/tmux` to `os/exec` semantics at the public discriminator site, and `Commander` mocks would need to construct synthetic `*exec.ExitError` instances (their fields are partly outside our zone of control).
- **E. String-match against `err.Error()` (no wrap) at the `GetServerOption` layer.** Rejected on examination: `(*exec.ExitError).Error()` returns `"exit status 1"` — the stderr is on `.Stderr`, not in the error string. Mechanically broken without first wrapping the error.

The chosen approach (typed `CommandError`) puts the diagnostic shape in the type system where the existing docstrings already pretend it lives; mocks remain trivial struct-literal constructions; future discriminators get the same channel without API drift; and daemon consumer code is untouched.

---

## Working Notes
