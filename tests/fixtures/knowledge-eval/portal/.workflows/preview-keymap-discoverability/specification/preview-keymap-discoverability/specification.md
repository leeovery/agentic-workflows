# Specification: Preview Keymap Discoverability

## Change Description

Two UX polish gaps in the session-scrollback-preview keymap surface — the `Space` binding that opens preview from the Sessions page is not advertised in the page's help bar, and the preview's chrome bar renders `]`, `[`, `Tab`, `Esc` as bare key tokens with no action labels (unlike the bottom help bar's `enter attach · r rename · …` style). Compounding the second issue, the chrome's `%s` slot prints the raw tmux window name, which is often a basename echo (e.g. Claude's renamed argv[0] `2.1.138`) so the chrome reads like a stray version number with no context. Pure display polish: no spec amendment, no behaviour change, no new bindings.

## Scope

Two single-file mechanical edits in `internal/tui`:

- `internal/tui/model.go:476-485` — `sessionHelpKeys()`: append one `key.NewBinding(key.WithKeys(" "), key.WithHelp("space", "preview"))` entry to the returned slice so the Sessions-page help bar advertises Space alongside enter/r/k/p/n/q.
- `internal/tui/pagepreview.go:163-172` — `chromeLine()`: replace the hardcoded `"Window %d of %d · Pane %d of %d · %s    ] [ Tab Esc"` format with one that (a) annotates each key token with a short action label in the bottom-help-bar style (e.g. `] next win · [ prev win · tab next pane · esc back`) and (b) prefixes the window name with `win:` so it is recognisable as a window label rather than mistaken for an unrelated number/identifier. Wording is implementation-time detail — final phrasing is decided in the task, not pinned here.

## Exclusions

- No changes to the live keymap behaviour in either page — bindings already work; only their advertisement changes.
- No changes to the preview's `Update` handler or any other file in `internal/tui`.
- No new keybindings (e.g. attaching from preview via Enter) — out of scope; tracked separately as `enter-attaches-from-preview` in the inbox.
- No changes to the windowName source (`m.currentGroup().WindowName`) or the underlying tmux enumeration — only the chrome's rendering of it.

## Verification

- `go build -o portal .` succeeds.
- `go test ./internal/tui/...` passes — existing chromeLine and help-bar test coverage continues to hold (the chromeLine test, if it asserts substring matches, will need updating to match the new format; treat that as part of the same task).
- Manual smoke check: launch `./portal`, observe `space preview` in the Sessions help bar, press Space to open preview, observe annotated key tokens (`] next win · [ prev win · tab next pane · esc back`) and `win:` prefix on the chrome line.
