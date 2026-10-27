---
topic: tui-session-picker
status: concluded
type: feature
work_type: feature
date: 2026-02-28
review_cycle: 2
finding_gate_mode: gated
sources:
  - name: tui-session-picker
    status: incorporated
---

# Specification: TUI Session Picker

## Specification

### Architecture & Component Choices

The TUI is rebuilt as a **two-page architecture** using `charmbracelet/bubbles/list`. The two pages — Sessions and Projects — are equal peers (not parent-child). Each page is a full `bubbles/list.Model` instance with built-in filtering, pagination, help bar, status bar, custom item delegates, and keybinding management.

**Component adoption:**
- **`bubbles/list`** — adopted for both pages. Brings `help`, `key`, and `paginator` as transitive dependencies.
- **`bubbles/textinput`** — retained for rename and project edit input fields.
- **`bubbles/filepicker`** — not adopted. It shows files and directories (Portal needs directories only), lacks fuzzy filtering, and doesn't support alias saving or current-directory selection. Too many gaps.
- **Custom file browser** (`internal/ui/browser.go`) — retained as-is. Purpose-built for directory-only navigation with fuzzy filtering and alias support.

**Structural changes:**
- `ProjectPickerModel` (`internal/ui/projectpicker.go`) is **deleted** along with its associated tests. All project listing functionality moves into a `bubbles/list` page within the main TUI model.
- The `viewState` enum (`viewSessionList`, `viewProjectPicker`, `viewFileBrowser`) is replaced by a page-based model with the file browser as a sub-view.
- Hand-rolled `strings.Builder` rendering is replaced by `bubbles/list` delegates and lipgloss styling.
- Any code, tests, or message types that exist solely to support the old `ProjectPickerModel` should be removed rather than left as dead code.

### Sessions Page

A full `bubbles/list.Model` displaying all active tmux sessions.

**Help bar keybindings:**
`[enter] attach  [r] rename  [k] kill  [p] projects  [n] new in cwd  [/] filter  [q] quit`

**Item display:** Each session item is rendered via a custom `ItemDelegate`. Sessions show the session name, window count, and attached badge.

**Inside-tmux mode:**
- The current session is **excluded** from the items list — filtered out before calling `SetItems()`
- The current session is displayed in the **list title**: `Sessions (current: {session-name})`

**Kill confirmation:**
- `k` triggers a modal overlay — "Kill {name}? (y/n)"
- On confirm: kill session via tmux, fetch fresh session list, call `SetItems()` on the list
- `bubbles/list` handles cursor repositioning automatically after item removal
- If killed session was the last one, the list shows its empty state

**Rename:**
- `r` triggers a modal overlay with a `textinput` pre-populated with the current session name
- On confirm: rename session via tmux, refresh list

**Attach:**
- `enter` attaches to the selected session and exits the TUI

### Projects Page

A full `bubbles/list.Model` displaying all saved projects.

**Help bar keybindings:**
`[enter] new session  [e] edit  [d] delete  [s] sessions  [n] new in cwd  [b] browse  [/] filter  [q] quit`

**Item display:** Each project item is rendered via a custom `ItemDelegate`. Projects show the project name and path.

**New session:**
- `enter` creates a new session in the selected project's directory and attaches

**Edit:**
- `e` triggers a modal overlay with the project's name field, alias list, and full edit controls
- On confirm: save changes to project config, refresh list

**Delete:**
- `d` triggers a modal overlay — delete confirmation for the selected project
- On confirm: remove project from config, refresh list

**Browse:**
- `b` opens the custom file browser as a separate sub-view from anywhere on the Projects page
- Not a list item — always accessible regardless of filter state, shown in help bar
- File browser sub-view remains as-is — `Esc` returns to Projects page
- On directory selection: browser emits `BrowserDirSelectedMsg{Path}` → parent creates session and exits TUI
- On cancel: `BrowserCancelMsg` → return to Projects page

### Modal System

All action prompts use a **single reusable modal overlay pattern**. Bubble Tea doesn't have built-in modals — `lipgloss.Place()` positions styled content over the list output in `View()`.

**Behavior:**
- Action triggers modal → list stays visible but inactive behind it
- All key input routes to the modal while it's active
- `Esc` always dismisses the modal and returns to the list

**Modal types:**
- **Kill confirmation** — small modal: "Kill {name}? (y/n)"
- **Rename** — small modal with `bubbles/textinput` pre-populated with the current session name
- **Project edit** — larger modal with name field, alias list, full edit controls
- **Delete confirmation** — small modal: delete project confirmation (y/n)

**Why modals over inline rendering:** The delegate-level approach (rendering confirmation/input inline in the highlighted list item) requires delegates to know about multiple modal states. Modals unify all action prompts into one consistent UX pattern.

### Command-Pending Mode

When `portal open -e cmd` is used, the TUI enters command-pending mode.

**Behavior:**
- Locked to the Projects page — `s` and `x` keybindings are **not registered** (pressing them does nothing, they don't appear in the help bar)
- Title stays "Projects" for consistency
- A status line below the title indicates the pending command: `Select project to run: {command}`

**Help bar keybindings:**
`[enter] run here  [n] new in cwd  [b] browse  [/] filter  [q] quit`

**Actions:**
- `enter` — creates a session in the selected project's directory with the pending command, then attaches
- `b` — opens file browser (same as normal mode)
- `q`/`Esc` — cancels entirely (exits TUI without creating a session). When a filter is active, `Esc` first clears the filter (`bubbles/list` consumes it); a second `Esc` exits.

### Filter & Initial Filter

**Independent filters per page.** Each `bubbles/list` manages its own filter state. Filtering sessions doesn't affect projects and vice versa. Switching pages doesn't carry filter text across. This is the default `bubbles/list` behavior — no extra work needed.

**Initial filter (`--filter` flag):**
- Applied to the default page during initialization
- Call `SetFilterText()` and `SetFilterState(list.FilterApplied)` on whichever page is the default (sessions if they exist, otherwise projects)
- Same behavior as the current implementation, using `bubbles/list` API

### `n` Key — New Session in CWD

`n` immediately creates a session in the current working directory and attaches. No confirmation, no cursor movement — equivalent to `portal open .` / `x .`.

- Works from both pages (cwd doesn't change based on page)
- Works in command-pending mode (creates session in cwd with the pending command)
- No spinner — session creation is near-instant

### `Esc` Key — Progressive Back/Dismiss

`Esc` acts as a progressive "back" key, unwinding one layer of context at a time:

1. **Modal active** → dismiss modal, return to list
2. **Filter active** → clear filter (`bubbles/list` handles this)
3. **File browser active** → return to Projects page
4. **Sessions or Projects page (nothing active)** → exit TUI

This applies consistently across normal and command-pending modes.

### Page Navigation & Defaults

**Page switching:**
- `p` — go to Projects page (shown in Sessions help bar)
- `s` — go to Sessions page (shown in Projects help bar)
- `x` — toggle between pages (undocumented power-user shortcut)
- All keybindings are lowercase

**Default page on launch:**
- Sessions exist → default to Sessions page
- No sessions, projects exist → default to Projects page
- Both empty → default to Projects page (useful action is `b` to browse)

**Empty page behavior:**
- Empty pages are always reachable via `p`/`s` — navigation is consistent regardless of state
- Empty pages display the `bubbles/list` built-in empty message ("No sessions running" / "No saved projects")

### Dependencies

No blocking dependencies. All prerequisite systems exist:
- tmux session management — existing functionality, unchanged
- Project configuration and storage — existing functionality, unchanged
- File browser (`internal/ui/browser.go`) — retained as-is
- `charmbracelet/bubbles/list` — external Go package, added via `go get`

The `tui-redesign` discussion (visual frames/styling) is orthogonal — it can be applied after the architectural rebuild without blocking it.

---

## Working Notes

[Optional - capture in-progress discussion if needed]
