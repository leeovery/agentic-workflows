# Custom-terminal setup docs page + clickable "see docs" banner link

The sessions-picker unsupported-terminal banner (named-unsupported case) renders a blue `see docs` hint, but it points nowhere: no URL or path is shown, and there is no `terminals.json` setup documentation anywhere in the repo. The hint is a promise pointing at nothing. This surfaced while specifying the `persistent-no-host-terminal-banner` bugfix, which deliberately keeps the named banner as-is.

Two parts:

1. **Create a docs page** explaining how to set up a custom or unknown terminal via `terminals.json` — using the bundle id shown in the banner as the copy-paste key for the config entry.

2. **Make `see docs` actually actionable.** If terminal hyperlinks are feasible (OSC 8 escape sequences — known possible; Claude Code renders clickable links this way), turn the banner's `see docs` into a clickable link to that specific page. If OSC 8 isn't viable across the supported terminals, fall back to rendering a concrete URL or path so the hint resolves to something the user can follow.

The banner copy lives in `internal/tui/section_header.go` (`unsupportedDocsHint = "see docs"`, rendered in `renderUnsupportedHeader`). The docs page location is TBD.

This is an additive docs + link improvement and is out of scope for the `persistent-no-host-terminal-banner` bugfix (that fix leaves the named banner unchanged). Pick it up separately.
