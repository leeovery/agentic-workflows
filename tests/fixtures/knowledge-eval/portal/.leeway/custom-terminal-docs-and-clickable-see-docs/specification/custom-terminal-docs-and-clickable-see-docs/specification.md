# Specification: Custom-Terminal Docs And Clickable See-Docs

## Change Description

The sessions-picker's named-unsupported-terminal banner renders a blue `see docs`
hint that resolves to nothing — there is no dedicated `terminals.json` setup guide
in the repo (only a brief subsection in the README's Configuration section). This
change (1) creates a dedicated custom-terminal setup docs page and (2) turns the
banner's `see docs` hint into a clickable OSC 8 hyperlink pointing at that page. The
change is additive: where a terminal renders OSC 8, `see docs` becomes clickable;
where it does not (or under `NO_COLOR`), it degrades to today's exact bare `see docs`
word. **The banner never prints a URL or a path** — there is no horizontal room, and
this degradation rule (from the manifest description) supersedes the seed's earlier
"fall back to a concrete URL/path" wording.

## Scope

**New docs page — `docs/custom-terminals.md`:** a complete setup guide for configuring
host-terminal window recipes via `terminals.json` (used by picker multi-select and the
multi-target `x` open burst). Content is sourced from the existing README §Configuration
"Custom terminals" subsection plus `internal/spawn/` (`terminalsconfig.go`,
`resolver.go`, `configadapter.go`, `configmatch.go`). It covers:
- What it is for and when it applies (non-Ghostty terminals; Ghostty is built in).
- How to find your terminal's identity key (read the unsupported banner's bundle id, or
  run `xctl doctor` — the copy-paste key: friendly `.app` name, raw bundle id, or `*`-glob).
- Key-matching precedence (exact bundle id → `.app`/alias → longer glob → bare `*`;
  most-specific wins).
- The two recipe forms, exactly one per entry: `argv` (Portal substitutes `{command}`
  into one element) and `script` (Portal execs the file with the command as `$1`; needs
  its own shebang + exec bit; `~` is expanded).
- `{command}` self-sufficiency (carries its own `PATH`/environment; `TMUX`/`TMUX_PANE`
  stripped so the spawned window runs outside tmux) — recipes never need env plumbing.
- At least one worked `argv` example and one `script` example.
- Tolerant-decode behaviour and troubleshooting via the `spawn:` log breadcrumbs; the
  `xctl doctor` host-terminal check line.
- File location + `PORTAL_TERMINALS_FILE` env override.

**README trim — `README.md` §Configuration:** replace the existing "Custom terminals
(`terminals.json`)" subsection (the prose + JSON example + recipe explanation, currently
~lines 387–401) with a one-line pointer to `docs/custom-terminals.md`. The
`terminals.json` row in the Configuration table stays.

**Banner link — `internal/tui/section_header.go`:** add a package-level
`unsupportedDocsURL` constant next to `unsupportedDocsHint`, set to
`https://github.com/leeovery/portal/blob/main/docs/custom-terminals.md`. In
`renderUnsupportedHeader`, wrap the `see docs` hint's style with lipgloss's native
`.Hyperlink(unsupportedDocsURL)` (chained on the existing `headerStyle(theme.MV.AccentBlue, …)`
result). Emit the hyperlink **unconditionally** (OSC 8 is orthogonal to colour, so it
rides through the `NO_COLOR`/`colourless` carve-out unchanged and still degrades to plain
text where unsupported). No change to detection, gating, layout geometry, or the copy.

**Test update — `internal/tui/unsupported_banner_test.go`:** update the `blueRun`
assertion in `TestUnsupportedHeader_NamedIdentityAmberDimSeeDocs` to expect the
hyperlinked run (`headerStyle(theme.MV.AccentBlue, …).Hyperlink(unsupportedDocsURL).Render("see docs")`).
The other banner tests are unaffected by construction: OSC 8 escapes are zero-width
(`lipgloss.Width`), so the right-alignment, exactly-one-row, narrow-degrade, and
canvas-paint tests hold; `ansi.Strip` removes OSC 8, so the colourless glyph-backed test
holds.

**Capture fixtures — `testdata/vhs/sessions-unsupported-terminal{,-nocolor}.tape` +
reference PNGs:** re-verify at the visual gate and re-capture the reference PNGs if the
OSC 8 escape alters the rendered frame.

## Exclusions

- **No change to the CLI reactive/no-op copy** (`spawn.UnsupportedNoopMessage`) or the
  blocked-entry flash — those are plain-language and separately owned; the OSC 8 link is
  the picker banner's only site.
- **No change to detection, banner gating (`unsupportedBannerActive`), the NULL/remote
  path, layout, or the banner copy text.**
- **No re-pointing of other intra-README `[terminals.json](#configuration)` links** — they
  continue to resolve to §Configuration, which now forwards to the docs page. (Accepted.)
- **No printed URL/path fallback in the banner** — link-or-bare-word only.
- **No shared/exported docs-URL constant** — it is used at a single call site and stays
  local to `section_header.go`.

## Verification

- `go build -o portal .` succeeds.
- `go test ./...` (unit lane) passes — notably `internal/tui` (the updated
  `unsupported_banner_test.go` and the full banner test set).
- Visual check of the banner fixture: `go run ./cmd/capturetool --fixture sessions-unsupported-terminal`
  (and `--appearance light`); the row still reads `⚠ unsupported terminal — <name> · <bundleID>`
  with a right-anchored `see docs`, and no URL/path is printed. Re-capture the reference
  PNGs via `vhs testdata/vhs/sessions-unsupported-terminal.tape` (+ the `-nocolor` tape)
  only if the frame changed; confirm a fresh write (hash changed) per the flaky-write caution.
- `docs/custom-terminals.md` renders correctly on GitHub and the banner's OSC 8 target URL
  resolves to it.
- The rendered `see docs` hint carries the OSC 8 hyperlink wrapper (asserted by the updated
  test) and remains readable as plain text after `ansi.Strip`.
