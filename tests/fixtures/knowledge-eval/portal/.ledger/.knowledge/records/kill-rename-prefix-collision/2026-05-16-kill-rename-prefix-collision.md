# KillSession / RenameSession still pass bare `-t`, same prefix-collision hazard

The `enter-attaches-from-preview` work established that every `-t <session>` argv against tmux must use the exact-match `=` prefix, because tmux's default target resolution is prefix-match: with a live `foo-2` coexisting with a killed `foo`, `-t foo` silently binds to `foo-2`. The spec mandated the prefix on `has-session`, `select-window`, `select-pane`, `switch-client`, `attach-session`. Those five sites were fixed.

Two destructive callers were left bare and still carry the same hazard:

- `internal/tmux/tmux.go:314-320` — `KillSession(name)` issues `kill-session -t <name>`. **Killing intended `foo` could prefix-match a coexisting `foo-2`.** Destructive, no undo.
- `internal/tmux/tmux.go` — `RenameSession(oldName, newName)` similarly issues `-t <oldName>`. Renaming the wrong session is recoverable but still wrong.

## Suggested fix

Land the centralising helper first so the policy lives in one place:

```go
// exactTarget wraps a session name with tmux's "=" exact-match prefix.
// Use anywhere a `-t <session>` argv is constructed against a user
// session name; see spec § Pre-select + attach sequence > Exact-match
// target syntax for rationale.
func exactTarget(session string) string { return "=" + session }
```

Then update `KillSession` and `RenameSession` to use it. Add a regression test mirroring `TestHasSessionUsesExactMatchPrefix` for each.

Existing `HasSession`, `SwitchClient`, etc. could optionally migrate to the helper too — not required, but it would prevent the inline-string approach from drifting again.

Out of scope: `PaneTarget` (the no-prefix variant) stays as it is — it is the hooks.json key formatter, not a tmux argv builder, and changing it would silently invalidate every existing hook entry.

Source: review of enter-attaches-from-preview/enter-attaches-from-preview (combines recommendations #8, #9, #10)
