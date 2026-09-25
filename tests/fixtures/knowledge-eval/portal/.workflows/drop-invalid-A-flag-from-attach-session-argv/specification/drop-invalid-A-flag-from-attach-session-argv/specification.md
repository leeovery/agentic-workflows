# Specification: Drop Invalid A Flag From Attach Session Argv

## Change Description

`cmd/open.go:101` passes `-A` to `tmux attach-session`, but `attach-session` does not accept `-A` — that flag belongs to `new-session`. Every outside-tmux attach from the Sessions list now fails with tmux's `command attach-session: unknown flag -A`, leaving Portal fully broken for bare-shell users on v0.5.1 and v0.5.2. The fix is to remove `-A` from the argv while keeping the `=` exact-match target prefix, and to correct the now-falsified justification in the surrounding docstring, the matching unit-test expectation, and the upstream specification lines that re-derive the same wrong shape.

## Scope

- **`cmd/open.go:101`** — production argv for `AttachConnector.Connect`. Drop `"-A"` token; keep `"="+name`. Final argv: `[]string{"tmux", "attach-session", "-t", "=" + name}`.
- **`cmd/open.go:79-83`** — docstring on `AttachConnector.Connect` that justifies `-A` as "atomic create-or-attach" and "TOCTOU residual fallback". The claim is false (the flag is invalid) and must be removed. Retain only the `=`-prefix rationale.
- **`cmd/open_test.go:1122`** — unit-test argv assertion `[]string{"tmux", "attach-session", "-A", "-t", "=foo"}`. Update to `[]string{"tmux", "attach-session", "-t", "=foo"}`. Adjust the surrounding comment at `cmd/open_test.go:1101` if it references the `-A` semantics.
- **`.workflows/enter-attaches-from-preview/specification/enter-attaches-from-preview/specification.md`** — §88 ("Connector handoff") and §166 ("Other edge cases → session-killed-externally bail path") both assert `tmux attach-session -A -t '=<session>'` as canonical argv; §166 additionally attributes fictional "auto-create on absent session" behaviour to `-A`. Both lines must be corrected so future re-derivation does not reintroduce the same bug. Add a short corrigendum note at the top of the spec linking to this quick-fix.

## Exclusions

- `internal/session/quickstart.go:52` — uses `new-session -A`, which is the valid form of `-A`. Out of scope.
- `SwitchConnector` / `switch-client` path — does not use `attach-session`. Unaffected.
- The bail flash / pre-select / `=` exact-match prefix behaviours — those are correct and stay as-is.

## Verification

- `cmd/open_test.go` passes (the updated argv expectation matches the production change).
- `go test ./...` passes — no other test references the `-A` token on `attach-session`.
- `grep -rn 'attach-session.*-A\|"-A".*attach-session' cmd/ internal/` returns no production references; only `new-session -A` matches.
- Manual smoke: from a bare shell (outside tmux), run `portal` and Enter on an existing session — process exec's into tmux and attaches; no `unknown flag -A` error.
- The spec corrigendum line is present at the top of `enter-attaches-from-preview/specification.md`; §88 and §166 show the corrected argv `tmux attach-session -t '=<session>'`.
