# Specification: Hydrate Command Shell Safety

## Change Description

Harden the `portal state hydrate` invocation produced by `buildHydrateCommand` against whitespace and shell-meta characters in tmux session names, and broaden the session-name sanitizer from a blocklist to an allowlist so it actually matches what downstream consumers (filesystem paths, tmux option names, shell command interpolation) implicitly assume.

Today the helper invocation is interpolated unquoted into a string handed to `respawn-pane -k`. tmux passes that string to a shell which word-splits it. For any session whose name contains whitespace or shell-meta bytes (e.g. the live example `evvi webhooks and watchers`, created externally via `tmux new-session -s`), the helper receives bad argv, exits without opening its FIFO, and the pane is left with no scrollback hydration and no resume-hook firing — a complete resume failure for that session. The change has two composed atoms: (1) restore the deleted `shellQuoteSingle` helper and apply it to all three interpolated values inside `buildHydrateCommand`; (2) broaden `sanitizeSessionName` to an allowlist (`[A-Za-z0-9._-]`, all other bytes become `_`) so the sanitized stem is uniformly path/option/shell-safe. The existing collision-suffix mechanism in `SanitizePaneKey` already disambiguates distinct names that collapse to the same stem.

## Scope

**Production code (two files):**

- `internal/restore/session.go` — `buildHydrateCommand` (~line 434):
  - Restore the `shellQuoteSingle` helper that was deleted in commit `98086bd9` ("T8-1 — delete shellQuoteSingle and emit bare hydrate invocation"). Single-quote wrap each input using the standard `'\''` close-escape-reopen idiom for embedded single quotes.
  - Apply `shellQuoteSingle` to all three interpolated values: `fifo`, `file`, `hookKey`.
  - Update the function's docstring: remove the incorrect "safe in practice" claim about sanitization filtering dangerous bytes (which was the root cause of this defect); describe the actual quoting contract.

- `internal/state/panekey.go` — `sanitizeSessionName` (~line 41):
  - Replace the blocklist (`isUnsafeByte` returning true for `/`, `\`, `\0`) with an allowlist: any byte not in `[A-Za-z0-9._-]` becomes `_`. Implemented as a per-byte check; behaviour is byte-wise so it remains identical regardless of UTF-8 validity of input.
  - Update the function docstring to describe the allowlist contract.
  - `isUnsafeByte` becomes unused after the switch and is deleted.
  - `SanitizePaneKey` and `collisionSuffix` are unchanged. Step 2 in the `SanitizePaneKey` algorithm (leading `.` → `_`) becomes redundant under the allowlist (`.` is allowed and a leading dot still survives sanitization) — but since the only behavioural relevance of "leading dot" was filesystem hiddenness, keep the explicit leading-dot replacement so the stem remains visible by default. The algorithm comment in the `SanitizePaneKey` docstring is updated to describe the allowlist in step 1.

**Tests (two files):**

- `internal/restore/session_build_hydrate_test.go`:
  - Three existing sub-tests pin the bare-form output of `buildHydrateCommand`; two need their expected strings updated to the quoted form. The third (the canonical `dump-portal-session-XYZ__0.1.fifo` shape, currently `--fifo /tmp/.../hydrate-... --file ...`) reflects today's bare-form pin — update its expected to the quoted form.
  - Add new sub-tests for whitespace and embedded-single-quote inputs to demonstrate the `'\''` escape idiom round-trips correctly. Use clearly-shaped inputs (e.g. a session-name-derived hookKey containing a space, and a hookKey containing a literal `'`).

- `internal/state/panekey_test.go`:
  - Add new sub-tests for whitespace, shell-meta (`$`, backtick, `"`, `;`), and other non-allowlist inputs.
  - The existing five sub-tests for `work`, `foo/bar`, `.hidden`, `foo\x00bar`, and the hash-collision case continue to pass unchanged — the broaden is additive over the cases they cover (`/` and `\0` were already replaced; `\` is also non-allowlist and remains replaced; leading `.` remains explicitly replaced; collision case unchanged).

## Exclusions

- **No schema changes.** `hooks.json`, `sessions.json`, marker name format, and FIFO path format are untouched. `PaneKeyFromFIFOPath` in `internal/state/paths.go` extracts whatever bytes appear between `hydrate-` and `.fifo` in a basename and is unaffected.
- **No per-caller updates.** The eleven production callers of `SanitizePaneKey` across `cmd/`, `internal/state/`, `internal/restore/`, `internal/bootstrap/`, `internal/tui/`, and `internal/restoretest/` consume it as the single source of truth; the output change propagates transparently.
- **No change to `cmd/state_hydrate.go`** or the helper's argv parsing. The receiving side already parses `--fifo`, `--file`, `--hook-key` via flag-based parsing, so quoted single-token values arrive correctly.
- **No change to `hookKey` sanitization.** `hookKey` is preserved-raw by design — it's the round-tripping key for `hooks.json` and cannot be sanitized without breaking lookup. Quoting is the right defense for it.
- **No daemon, bootstrap, or TUI changes.**
- **No deprecation or removal of `SanitizePaneKey`'s leading-`.` step.** Keep the explicit leading-dot replacement so sanitized stems do not start with a `.` (filesystem-hidden by default on Unix).

## Migration

A one-time event per affected session, no operator action required:

- Sessions whose name newly sanitizes to a different stem (i.e. names containing bytes outside `[A-Za-z0-9._-]` other than `/`, `\`, `\0`, leading `.`) will see their previous `.bin` scrollback files become orphans on first daemon tick after the change ships. Concrete example: `evvi webhooks and watchers` currently sanitizes to `evvi webhooks and watchers` (spaces preserved); after the change it sanitizes to `evvi_webhooks_and_watchers` (+collision suffix), so `evvi webhooks and watchers__1.1.bin` becomes orphan.
- Existing daemon scrollback GC sweeps orphan `.bin` files within a tick or two; no additional cleanup logic required.
- Sessions named with only `[A-Za-z0-9._-]` are unaffected — sanitized stem unchanged.
- Net cost: at most one tick's worth of pre-change scrollback lost on the first reboot after the fix ships, only for sessions whose names contain non-allowlist bytes. Full operation resumes from then on.

## Verification

- All existing tests pass — `go test ./...`.
- `internal/restore/session_build_hydrate_test.go` and `internal/state/panekey_test.go` cover the new behaviour explicitly:
  - Whitespace and shell-meta inputs produce quoted argv in `buildHydrateCommand` output.
  - Embedded single quotes round-trip via the `'\''` idiom.
  - Whitespace and shell-meta inputs to `sanitizeSessionName` collapse to `_`; the collision suffix is applied when the sanitized stem differs from the input.
- Manual smoke check on the live example: create a session named `evvi webhooks and watchers` (or equivalent), kill and restart the tmux server, and confirm restore hydrates the pane (FIFO opened, scrollback replayed, hook fires if registered). This is the canonical end-to-end verification of the fix.
- No occurrences of the old bare-form `fmt.Sprintf("portal state hydrate --fifo %s --file %s --hook-key %s", ...)` remain in scope.
- The `isUnsafeByte` symbol is removed cleanly (no references).
