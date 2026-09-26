# Persistent "no host-local terminal" banner on remote clients; multi-select should be blocked outright on unsupported terminals

Logging into the Mac over mosh from an iPad and opening the picker shows the `⚠ no host-local terminal` banner permanently for the whole picker session. This is the §6.2 proactive unsupported-terminal banner working as spec'd, not a malfunction — but on a remote client it is pure noise: there is nothing the user can do about it, it never changes, and because it *replaces* the standard `Sessions ··· N` section header (`internal/tui/model.go`, `unsupportedBannerActive`), the session count and grouping-mode suffix are lost for the entire session. It reads as ugly and broken even though it is behaving as designed.

Conditions: any picker launch where spawn detection resolves the NULL identity — a pure-remote client (mosh/SSH with no host-local terminal attached to the tmux server). Today a *mixed* setup (remote trigger plus a local Ghostty attached at home) resolves supported and shows no banner, but that is itself the subject of `2026-07-15--remote-trigger-spawns-on-local-terminal.md`; once that bug's trigger-locality gate is fixed, every remote login will resolve NULL, so this banner would then appear on all remote use.

Current multi-select behaviour on an unsupported terminal (verified in conversation against `burst_unsupported_noop_test.go`): `m` still enters the mode, sessions can be marked, and an N≥2 Enter is an atomic no-op with a reactive flash (`⚠ no host-local terminal — nothing opened`), selection intact. So the user can walk the whole flow only to hit a guaranteed dead end at the last keypress.

Expected behaviour, as decided in discussion:

1. **Banner split by identity shape.** Drop the proactive banner entirely for the NULL identity (remote/mosh) — the standard section header renders as normal. Keep the proactive banner for *named* unsupported terminals (e.g. Apple Terminal), where it is actionable: it carries the bundle id (the copy-paste key for `terminals.json`) and the `see docs` hint.
2. **Multi-select fully disabled on any unsupported resolution** (named and NULL alike, since the burst can never do anything on either). Pressing `m` fails immediately with an error/flash rather than entering the mode — not deferred to the N≥2 Enter, and not gated on selection count: completely disabled. The reactive flash copy may need a variant suited to a blocked mode entry rather than the current `— nothing opened` burst wording, and the footer's multi-select hint may need to reflect the unavailable state.

Impact: cosmetic-but-constant on every remote picker launch (a permanent warning band plus a lost section header), and a misleading affordance letting users mark sessions for a burst that can never fire.

---

**Note (2026-07-18, cli-verb-surface-redesign planning):** The CLI-verb redesign adds a CLI **multi-target `portal open <a> <b> …`** (N≥2) burst. Its planned behaviour on an unsupported/remote terminal was decided to match this bug's direction: **block outright — nothing opens, the trigger does not half-connect** (no "open-here + skip the rest"). So the CLI and TUI stay consistent: this bug disables the picker's `m`-entry, and the CLI burst hard-blocks N≥2. This bug (the TUI banner split + `m`-entry blocking) remains its own out-of-scope work — the redesign builds only the CLI-side block. When this bug is implemented, keep the copy/UX consistent with the CLI's unsupported message.
