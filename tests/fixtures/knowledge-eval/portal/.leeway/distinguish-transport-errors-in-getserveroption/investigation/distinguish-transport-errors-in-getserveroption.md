# Investigation: Distinguish Transport Errors From Missing Option in GetServerOption

## Symptoms

### Problem Description

**Expected behavior:**
- `GetServerOption` should distinguish "option does not exist" from "tmux command failed for any other reason" (transport failure, permission error, server crash mid-call, etc.).
- `TryGetServerOption`'s `(value, found, err)` contract should match its docstring: option-absent returns `("", false, nil)`; any other failure returns `("", false, non-nil-err)`.
- Callers reading volatile markers (e.g. `@portal-restoring`) should be able to tell "marker absent" apart from "tmux call failed," so transport blips never get silently converted into a marker-state flip.

**Actual behavior:**
- `GetServerOption` (`internal/tmux/tmux.go:304-310`) collapses every `c.cmd.Run("show-option", "-sv", name)` error to the sentinel `ErrOptionNotFound`. The original error and its message are discarded.
- `TryGetServerOption` (`internal/tmux/tmux.go:317-326`) delegates to `GetServerOption`, then checks `errors.Is(err, ErrOptionNotFound)` first. Because that branch always matches for any non-nil error from `GetServerOption`, the subsequent `if err != nil { return "", false, err }` at line 322 is unreachable.
- Net effect: every transport/transient tmux failure is reported to callers as `("", false, nil)` — i.e., "option absent, no error."
- The package-level docstring at `internal/state/markers.go:34-35` documents the wrapper as "absence vs. real failure is distinguishable" — a claim the implementation cannot satisfy.

### Manifestation

This bug is *latent* — no user-visible incident has been reported. Manifestation is structural:

- **Misleading API contract:** `TryGetServerOption`'s docstring says it distinguishes absence from real failure; it does not.
- **Dead-code branch:** `internal/tmux/tmux.go:322-324` is unreachable, masking the conflation from readers auditing the code.
- **Silent caller misbehaviour potential:** `internal/state/markers.go:140` reads `@portal-restoring` via `TryGetServerOption` to gate daemon capture suppression during the restoration window. A transport blip during this lookup would be read as "marker absent," potentially flipping the daemon out of restoration-window suppression mid-bootstrap.

### Reproduction Steps

Direct reproduction in production is not realistic — local tmux socket failures are vanishingly rare. Reproduction is via inspection / fault injection in tests:

1. Construct a `Commander` mock that returns a non-tmux-unknown-option error from `show-option -sv @some-marker` (e.g., simulate `exit 1` with stderr `lost server`).
2. Call `client.TryGetServerOption("@portal-restoring")`.
3. Observed result: `("", false, nil)`.
4. Expected result: `("", _, non-nil-error)` so the caller can choose to abort the operation rather than treat the marker as absent.

**Reproducibility:** Always, given the fault-injection harness above. The bug is deterministic given the current code structure.

### Environment

- **Affected environments:** All (Darwin / Linux). The conflation is in pure Go logic with no platform branching.
- **Trigger conditions:** Any `cmd.Run` failure from `show-option -sv <name>` — either the option being absent (legitimate) or any other failure (the bug case).

### Impact

- **Severity:** Low (latent — no observed user impact).
- **Scope:** API surface in `internal/tmux` and one known consumer in `internal/state/markers.go`. Additional consumers may surface during code analysis.
- **Architectural impact:** Medium. A documented-but-unmet contract is depended on by load-bearing daemon code; silent contract drift increases the cost of future correctness audits.

### References

- Original inbox entry (now archived): `.workflows/.inbox/.archived/bugs/2026-03-28--distinguish-transport-errors-in-getserveroption.md`
- Source files: `internal/tmux/tmux.go` (GetServerOption, TryGetServerOption, ErrOptionNotFound), `internal/state/markers.go` (RestoringMarker reader and the package-level docstring asserting distinguishability).

---

## Analysis

### Initial Hypotheses

- The conflation lives in `GetServerOption`; `TryGetServerOption`'s "dead branch" claim from the symptoms is mechanically true.
- Only the `@portal-restoring` marker read at `markers.go:140` is meaningfully impacted; other server-option reads either don't exist or use the bulk path (`ShowAllServerOptions`).

### Code Trace

**Entry point — the conflation site:** `internal/tmux/tmux.go:304-310` (`GetServerOption`).

```go
func (c *Client) GetServerOption(name string) (string, error) {
    output, err := c.cmd.Run("show-option", "-sv", name)
    if err != nil {
        return "", ErrOptionNotFound          // ← every error becomes this sentinel
    }
    return strings.TrimSpace(output), nil
}
```

**Mechanical confirmation of the dead-branch claim** (`internal/tmux/tmux.go:317-326`):

```go
func (c *Client) TryGetServerOption(name string) (string, bool, error) {
    val, err := c.GetServerOption(name)
    if errors.Is(err, ErrOptionNotFound) {     // matches every non-nil err
        return "", false, nil
    }
    if err != nil {                            // unreachable
        return "", false, err
    }
    return val, true, nil
}
```

The `if err != nil` branch at line 322 is unreachable: `GetServerOption` returns either `nil` (success) or `ErrOptionNotFound` (any failure). `errors.Is(err, ErrOptionNotFound)` matches every non-nil case.

**tmux's actual error surface** (probed against tmux on Darwin 25.3.0):

| Trigger                         | stderr                                                   | exit |
|---------------------------------|----------------------------------------------------------|------|
| Unknown `@` option              | `invalid option: @nonexistent-test-option-xyz`           | 1    |
| Unknown non-prefixed option     | `invalid option: foo-bar-baz`                            | 1    |
| Empty option name               | `ambiguous option: ` *(treated as ambiguous match)*      | 1    |
| Wrong / nonexistent socket (`-L`) | `error connecting to /private/tmp/tmux-501//<sock> (No such file or directory)` | 1 |

All exit code 1. The discriminator is **stderr content**, not the exit code. `RealCommander.Run` (`internal/tmux/tmux.go:39-46`) uses `cmd.Output()`, which populates `(*exec.ExitError).Stderr` automatically when `cmd.Stderr` is nil — so the stderr text is available on the returned error, just not surfaced through the `Commander` interface today.

**Production consumers — direct callers of `GetServerOption`:**

- None outside `internal/tmux/tmux.go` itself (`TryGetServerOption` is the only internal caller).

**Production consumers — direct callers of `TryGetServerOption`:**

- `internal/state/markers.go:140` — `IsRestoringSet(c RestoringChecker) (bool, error)`. The wrapper around the `@portal-restoring` marker read. Two production callers:
  - `cmd/state_daemon.go:95-99` — `tick()` reads `@portal-restoring` once per second. On `err != nil`, logs warn and returns (skips the tick — conservative).
  - `cmd/state_daemon.go:187-201` — `defaultShutdownFlush()` reads `@portal-restoring` at SIGHUP/SIGTERM. On `err != nil`, logs warn and returns nil (skips the final flush — conservative).

Both downstream consumers want **conservative** behaviour on read failure: if we can't tell whether restoration is in progress, assume it is and skip. The bug inverts this — transport errors are converted to `(false, nil)` upstream, so the consumers proceed as if restoration is NOT in progress and commit potentially-corrupt state.

**Production callers of `TryGetServerOption` outside `IsRestoringSet`:** none. Every other reference is in test code (assertion-only).

### Adjacent Patterns Audited (Wide Scope)

- **`ShowAllServerOptions`** (`internal/tmux/tmux.go:337-343`) propagates errors correctly: `return "", fmt.Errorf("failed to show server options: %w", err)`. No conflation.
- **`ListSkeletonMarkers`** (`internal/state/markers.go:61-93`) consumes `ShowAllServerOptions`, returns `(nil, err)` on failure — clean. The skeleton-marker enumeration path used by the daemon's per-tick capture cycle is unaffected by this bug.
- **`SetServerOption` / `UnsetServerOption`** (paths used by the marker writers) propagate errors normally — write-side is not affected.

The bug is **isolated to `GetServerOption`** and its single wrapper `TryGetServerOption`. The wide-scope audit confirms no other surface in `internal/tmux` exhibits the same shape.

### Documented Contract Violations

Three production sites assert distinguishability that is not delivered:

1. `internal/tmux/tmux.go:312-316` — `TryGetServerOption` docstring: *"distinguishing absence from a real tmux failure (which surfaces as a non-nil error)."*
2. `internal/state/markers.go:34-35` — `RestoringChecker` interface docstring: *"absence vs. real failure is distinguishable."*
3. `internal/state/markers.go:136-138` — `IsRestoringSet` docstring: *"Any underlying tmux error is propagated so a real failure does not silently masquerade as 'not restoring'."*

A fourth site documents the bug explicitly as a known gap awaiting this fix:

4. `cmd/state_daemon_run_test.go:557-565` — comment block explaining that a test for *"conservatively skips the final flush when @portal-restoring read errors"* cannot be exercised through the public Client surface today because of the conflation, and that *"the defensive code is preserved for future refactors that distinguish 'real failure' from 'not found'."*

### Root Cause

`GetServerOption` discards the underlying tmux error and substitutes a sentinel that downstream callers interpret as "option absent." Three documented promises of distinguishability are violated; a known-defensive code branch in the SIGHUP/SIGTERM flush handler is unreachable; the daemon's two restoration-gate read sites (per-tick and at shutdown) silently flip from conservative-on-error to permissive-on-error in the presence of any transient tmux failure.

**Why this happens:**

`RealCommander.Run` uses `cmd.Output()`, which returns a typed `*exec.ExitError` whose `.Stderr` field holds tmux's actual diagnostic message (`invalid option: ...`, `error connecting to ...`, etc.). The `Commander` interface erases this distinction by returning a bare `error`, and `GetServerOption` does not type-assert to recover the stderr text. The simplest assumption — "any error means option absent" — is wrong, but worked well enough that the bug stayed latent until the wrapper was added with a docstring asserting otherwise.

### Contributing Factors

- The `Commander` interface signature `(string, error)` discards the stderr distinction. Callers cannot route on stderr content without type-asserting on `*exec.ExitError`, which couples them to `os/exec` and breaks the mock surface.
- The "default to ErrOptionNotFound" pattern is tempting because the legitimate "not found" case is by far the most common — every other use of `GetServerOption` was for an existence check that happily treats failure as absence.
- The first wrapper (`TryGetServerOption`) was added with a contract the underlying primitive could not deliver. The dead branch was retained as defensive code "for future refactors" — the test-file comment block (`state_daemon_run_test.go:557-565`) documents this anticipation explicitly.

### Why It Wasn't Caught

- No test exercises the transport-error path through `GetServerOption` with a real `*exec.ExitError`. Existing tests at `internal/tmux/tmux_test.go:924-934` use `errors.New("unknown option: @portal-active-%3")` — a synthetic error string that never gets inspected. Under the current behaviour, any error becomes `ErrOptionNotFound`, so the test passes without exercising stderr inspection.
- The `defaultShutdownFlush` `if err != nil` branch is unreachable through the public `Client` surface and is documented as such — *"verified by inspection,"* not by test.
- Production has not surfaced the bug because tmux runs against a local socket; transient transport failures are vanishingly rare. The bug is structural, not observed.

### Blast Radius

**Directly affected:**

- `internal/tmux/tmux.go` — `GetServerOption`, `TryGetServerOption`, and `ErrOptionNotFound` semantics.
- `internal/state/markers.go` — `IsRestoringSet` and the `RestoringChecker` seam docstring.
- `cmd/state_daemon.go` — `tick()` and `defaultShutdownFlush()` are the impacted *consumers*, but their code is already correct. They will start receiving the errors they were always expecting.

**Potentially affected:**

- `internal/tmux/tmux_test.go` — `TestGetServerOption` and `TestTryGetServerOption` cases will need to be reshaped: the existing "unknown option:" string-based test must construct an error whose stderr matches the "option not found" pattern, and a new transport-error case must be added.
- `cmd/state_daemon_run_test.go:557-565` — the documented-gap test for `defaultShutdownFlush`'s err branch becomes writable once the wrapper propagates errors.
- `internal/state/markers_test.go:206` — `TestIsRestoringSet`'s "tmux exploded" case already covers the err-propagation behaviour against a mock, so it continues to pass; the test is currently testing a property the production code couldn't reach.

---

## Fix Direction

### Chosen Approach

**Typed `CommandError` at the `Commander` layer.**

1. **At the `Commander` layer**: introduce `type CommandError struct { Stderr string; Err error }` in `internal/tmux`. `RealCommander.Run` and `RealCommander.RunRaw` wrap `*exec.ExitError` into `CommandError`, capturing `(*exec.ExitError).Stderr`. Non-`ExitError` failures (executable not found, etc.) are wrapped with an empty `Stderr` so discriminators that examine `Stderr` see "no signal" rather than a misleading match.
2. **At the `GetServerOption` layer**: use `errors.As(err, &cmdErr)` to extract `Stderr`, substring-match against the "option not found" pattern family (`invalid option:`, `unknown option:`, `ambiguous option:`), and return `ErrOptionNotFound` only on match; otherwise propagate the wrapped `CommandError` to the caller. The pattern set is a small package-level slice — cross-tmux-version tolerant, not a single literal.
3. **At `TryGetServerOption`**: the existing `errors.Is(err, ErrOptionNotFound)` branch keeps doing the right thing; the `if err != nil { return "", false, err }` branch becomes live for the first time.
4. **Docstrings/tests**: update the three contract-assertion sites (tmux.go:312-316, markers.go:34-35, markers.go:136-138) to match what the code now delivers. Write the previously-blocked test for `defaultShutdownFlush`'s err branch in `cmd/state_daemon_run_test.go` and remove the documenting-gap comment block at lines 557-565.

**Deciding factor:** puts the diagnostic shape in the type system where the existing docstrings already pretend it lives; mocks remain trivial (struct-literal `CommandError{Stderr: "invalid option: @foo"}`); future discriminators (e.g., "tmux server crashed" vs "tmux not installed") get the same channel without API drift; daemon consumer code is untouched.

### Options Explored

- **A. Typed `CommandError` at the `Commander` layer.** *(Chosen — see above.)*
- **B. Stderr-embedded error string via `fmt.Errorf("%w: %s", err, stderr)` at the `Commander` layer.** Rejected: discriminator becomes a substring-match against a formatted error string; brittle if the wrap format ever changes; harder to test the boundary cleanly.
- **C. New `Commander.RunWithStderr(args...) (out, stderr string, err error)` method.** Rejected: parallel API surface forces every mock to stub a second method; doesn't fix similar latent conflations if added later; smaller upfront diff but worse shape long-term.
- **D. Inline type-assert against `*exec.ExitError` inside `GetServerOption`.** Rejected as a primary path: couples `internal/tmux` directly to `os/exec` semantics through the public discriminator site; `Commander` mocks would need to construct synthetic `*exec.ExitError` instances, which is awkward because the struct's fields are partly outside our zone of control.
- **E. String-match against `err.Error()` at the `GetServerOption` layer (no wrap).** Rejected on examination: `(*exec.ExitError).Error()` returns `"exit status 1"` — the stderr is on `.Stderr`, not in the error string. The approach is mechanically broken without first wrapping the error to embed stderr in its text.

### Discussion

Findings review with the user was brief and confirmatory. The user agreed with the structural choice on first pass; no alternatives were challenged and no edge cases were raised. The wide-scope audit had already de-risked the structural assumptions: only `GetServerOption` exhibits the conflation, `ShowAllServerOptions` and `ListSkeletonMarkers` are clean, the production consumer count is exactly two (both already conservative-on-error), and a fourth contract-violation site (the test comment at `cmd/state_daemon_run_test.go:557-565`) explicitly documents the bug and anticipates this fix.

Two implementation-time decisions were intentionally left for the specification / planning phases rather than pinned here:

- **Exact `CommandError` placement and exported-ness**: package-level type in `internal/tmux`, or a more constrained location. Either is workable; the spec will pin.
- **Pattern-family literal**: the working set is `invalid option:`, `unknown option:`, `ambiguous option:`. Spec phase confirms against tmux's source (or a documented compatibility floor) whether to widen or narrow.

### Testing Recommendations

- Add `TestGetServerOption_TransportError` exercising a synthetic stderr that does NOT match the "option not found" pattern family — expect non-nil error, not `ErrOptionNotFound`.
- Reshape `TestGetServerOption :: returns ErrOptionNotFound when option does not exist` to construct an error with stderr matching `invalid option: ...` (or whichever pattern family the fix codifies).
- Add `TestTryGetServerOption_PropagatesTransportError` covering the previously-unreachable `if err != nil { return "", false, err }` branch.
- Write the documented-gap test in `cmd/state_daemon_run_test.go` for `defaultShutdownFlush`'s `if err != nil { return nil }` branch — the comment block at lines 557-565 can be removed and replaced with the actual test.
- Confirm `TestIsRestoringSet :: tmux exploded` (markers_test.go:206) continues to pass — it asserts the contract that the production code is finally able to deliver on.

### Risk Assessment

- **Fix complexity:** Medium. Touches `Commander` interface (or its underlying primitive), `GetServerOption`, `TryGetServerOption`, plus test reshapes at 3 sites. Daemon consumer code is unchanged.
- **Regression risk:** Low. The behavioural change is "transport errors now propagate," which downstream consumers already had defensive handling for (they just couldn't reach those branches). No new failure mode introduced — only previously-suppressed failure modes surfaced into the existing error-handling paths.
- **Recommended approach:** Regular release. No incident pressure; no hotfix justification.


---

## Notes

- The original motivation (a hook-executor "two-condition check") no longer exists — hook firing migrated into the hydrate helper's exec chain. The original symptom site is gone; the architectural concern moved to marker-state reads in the daemon's restoration-window logic.
- **Investigation scope (user-confirmed):** wide. Verify the dead-branch claim, confirm `markers.go:140` consumer impact, enumerate *every* caller of `GetServerOption` / `TryGetServerOption` and assess each, and audit adjacent error-mapping patterns in `internal/tmux` (e.g., `ShowAllServerOptions`, `ListSkeletonMarkers`) for the same shape of bug.
