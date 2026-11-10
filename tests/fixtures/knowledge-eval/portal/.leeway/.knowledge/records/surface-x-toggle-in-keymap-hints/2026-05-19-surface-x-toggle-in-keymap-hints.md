# Surface the X page-toggle in the sessions/projects keymap hints

In the TUI today the sessions page footer shows `P` as the hint for jumping to the projects page, and the projects page shows `S` as the hint for jumping back to the sessions page. There is also an undocumented binding where pressing `X` from either page toggles to the other — it does exactly what the contextual `P` / `S` keys already do, but it has never been surfaced in the keymap footer.

The behaviour itself should stay as-is. This is purely a keymap-hint display change: on the sessions page, the projects-jump hint should show both keys (`P/X` or the equivalent rendering the existing footer uses for grouped bindings), and on the projects page the sessions-jump hint should show both keys (`S/X`). Both `X` bindings stay wired exactly as they are wired today.

Background for context: `portal open` (and its `x` shorthand) was originally designed to land the user on the most useful page — sessions if there are any active sessions, projects otherwise. The `X` page-toggle was tacked on as a convenience backdoor for users already inside the TUI who wanted a single key to bounce between the two lists without having to remember the page-specific `S` / `P` keys. Because it was never added to the hint footer, nobody knows it exists. Bringing it into the keymap rendering makes the binding discoverable without adding any new functionality.

Files to look at: the key-hint footer rendering for the sessions page and the projects page in `internal/tui/`.
