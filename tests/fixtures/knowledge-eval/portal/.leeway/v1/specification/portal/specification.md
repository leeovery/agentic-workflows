---
topic: portal
status: concluded
type: feature
work_type: greenfield
date: 2026-02-14
sources:
  - name: cx-design
    status: incorporated
  - name: zellij-multi-directory
    status: incorporated
  - name: fzf-output-mode
    status: incorporated
  - name: git-root-and-completions
    status: incorporated
  - name: zellij-to-tmux-migration
    status: incorporated
  - name: x-xctl-split
    status: incorporated
  - name: session-launch-command
    status: incorporated
---

# Specification: Portal

## Overview

### What is Portal

Portal is a Go CLI that provides an interactive session picker for tmux. It runs at bare shell (before entering tmux) and offers a mobile-friendly TUI for managing tmux sessions.

### Architecture

Portal is a **single binary** (`portal`) with **shell integration** (the zoxide/starship pattern). Users add one line to their shell config:

```
eval "$(portal init zsh)"
```

This emits two shell functions:
- **`x`** — The interactive launcher. Gets you into a tmux session.
- **`xctl`** — The control plane. Session management, aliases, housekeeping.

Command names are configurable via `--cmd`:
```
eval "$(portal init zsh --cmd p)"  # creates p() and pctl()
```

Under the hood:
- `x` routes to `portal open`
- `xctl` passes through to `portal` directly (e.g., `xctl list` = `portal list`)

### The Problem

When SSH/Mosh-ing to a machine (e.g., from phone to Mac), it's tedious to:
- Remember which tmux sessions exist
- Type session names correctly to attach
- Navigate to the right directory to start new sessions

tmux's built-in session management is command-line only (`tmux ls`, `tmux attach -t <name>`) with no interactive picker.

### The Solution

A single command (`x`) that:
1. Shows existing running sessions
2. Allows quick attachment with arrow keys + Enter
3. Remembers project directories for starting new sessions
4. Works at bare shell, optimized for small screens

### Value Proposition

1. **Interactive picker at bare shell** - An interactive session picker that works outside tmux
2. **Mobile-friendly** - Clean, minimal interface optimized for small screens
3. **Project memory** - Quick-start new sessions in remembered directories
4. **One command** - `x` does everything vs. `tmux ls` + `tmux attach -t <name>`

## Core Model

### Sessions as Workspaces

Portal treats tmux sessions as **workspaces**. A workspace may span multiple directories — tmux allows multiple windows and panes in a session, each potentially in different directories.

### Sessions and Projects are Separate Concerns

- **Sessions** = Live data queried from tmux (`tmux list-sessions`)
- **Projects** = Portal's memory of directories used to start new sessions

Portal does not track which project a session belongs to. Select a session → attach. Select a project → start a new session there.

### No Directory Change Before Attach

When attaching to an existing session, Portal does not change directories. tmux restores shell state on reattach — each pane resumes exactly where it was.

### Directory Change for New Sessions

When starting a **new** session, Portal passes the resolved directory to tmux via the `-c` flag. The sequence is:

1. Resolve directory to git root (if inside a git repository)
2. Run `tmux new-session -A -s <session-name> -c <resolved-dir>`

tmux's `-c` flag sets the working directory at session creation — no `cd` needed in Portal's process.

### Git Root Resolution

When a directory is selected for a new session (via `x .`, `x <path>`, or the file browser), Portal resolves it to the git repository root before proceeding.

**Implementation**: Run `git -C <selected-dir> rev-parse --show-toplevel`. If it succeeds, use the output as the directory. If it fails (exit code 128 — not a git repo), use the original directory as-is.

**Behavior**:
- Resolution is automatic and silent — no prompt or confirmation
- Non-git directories are used unchanged, with no warning
- One resolution function applied uniformly at all three entry points (`x .`, `x <path>`, file browser)

## TUI Design

### Technology

Built with Go and [Bubble Tea](https://github.com/charmbracelet/bubbletea) (terminal UI framework).

### Layout

Full-screen picker optimized for small screens (mobile SSH use case).

```
┌─────────────────────────────────────┐
│                                     │
│           SESSIONS                  │
│                                     │
│    >  cx-03          ● attached     │
│       api-work       2 windows      │
│       client-proj                   │
│                                     │
│    ─────────────────────────────    │
│    [n] new in project...            │
│                                     │
└─────────────────────────────────────┘
```

### Sections

1. **SESSIONS** - Running tmux sessions
   - Shows session name
   - Shows attached indicator (`● attached`) when `session_attached > 0`
   - Shows window count (e.g., `2 windows`)

2. **New session option** - `[n] new in project...`
   - Opens project picker to start a new session

### Sorting

**Sessions**: Displayed in the order returned by `tmux list-sessions`. No additional sorting applied.

**Projects**: Sorted by `last_used` timestamp, most recent first.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑` / `↓` or `j` / `k` | Navigate list |
| `Enter` | Select (attach to session or open project picker) |
| `n` | Jump to "new session" option |
| `R` | Rename selected session (prompts for new name) |
| `K` | Kill selected session |
| `/` | Enter filter mode |
| `q` / `Esc` | Quit |

**Kill confirmation**: Pressing `K` prompts for confirmation before killing the selected session: "Kill session 'myapp'? (y/n)"

**Rename prompt**: Pressing `R` shows an inline text input pre-filled with the current session name. `Enter` confirms, `Esc` cancels.

### Filter Mode

The session list supports fuzzy filtering via a dedicated mode, activated by pressing `/`.

**Entering filter mode**: Press `/`. A filter input appears at the bottom of the list (e.g., `filter: _`). All subsequent keystrokes are treated as filter input — shortcut keys (`n`, `k`, `K`, etc.) lose their shortcut meaning and become typeable characters.

**While filtering**:
- Typing narrows the visible list by fuzzy-matching against session names
- `↑` / `↓` navigate the filtered results
- `Enter` selects the highlighted item (same as normal mode)
- `Backspace` deletes the last filter character; if the filter is already empty, exits filter mode
- `Esc` clears the filter and exits filter mode

**What gets filtered**: Running sessions only. The `[n] new in project...` option is always visible and never filtered out.

**Outside filter mode**: All single-key shortcuts (`n`, `k`, `j`, `K`, `q`) work as documented in the keyboard shortcuts table. No filtering occurs.

### Session Info Display

Portal queries session metadata via tmux format strings:

```bash
tmux list-sessions -F '#{session_name}|#{session_windows}|#{session_attached}'
```

This provides session name, window count, and attached client count in a clean, structured format — no ANSI escape stripping needed.

For per-window detail (if needed):
```bash
tmux list-windows -t <name> -F '#{window_index}|#{window_name}|#{window_panes}'
```

### Empty States

**No sessions:**
```
┌─────────────────────────────────────┐
│                                     │
│           SESSIONS                  │
│                                     │
│       No active sessions            │
│                                     │
│    ─────────────────────────────    │
│    [n] new in project...            │
│                                     │
└─────────────────────────────────────┘
```

**No other sessions (inside tmux):**
```
┌─────────────────────────────────────┐
│  Current: my-project-x7k2m9        │
│                                     │
│           SESSIONS                  │
│                                     │
│       No other sessions             │
│                                     │
│    ─────────────────────────────    │
│    [n] new in project...            │
│                                     │
└─────────────────────────────────────┘
```

**No remembered projects (when opening project picker):**
```
Select a project:

  No saved projects yet.

  ─────────────────────────────
  browse for directory...
```

The file browser is always available to start sessions in new directories.

**Command pending (no existing sessions shown):**
```
┌─────────────────────────────────────┐
│  Command: claude                    │
│                                     │
│           PROJECTS                  │
│                                     │
│    >  myapp                         │
│       api-server                    │
│       website                       │
│                                     │
│    ─────────────────────────────    │
│    browse for directory...          │
│                                     │
└─────────────────────────────────────┘
```

When `-e` or `--` is provided, the TUI skips the session list and shows the project picker directly, with a banner indicating the pending command.

## Session Naming

### Auto-Generated from Project Name

Session names are auto-generated using the project name plus a short random suffix:

```
{project-name}-{nanoid}
```

**Example**: Project "portal" produces sessions like `portal-x7k2m9`, `portal-a3b8p1`.

The suffix is a 6-character nanoid, ensuring uniqueness without user input. Users are never prompted for a session name.

**Name sanitization**: tmux session names cannot contain periods (`.`) or colons (`:`). When generating a session name from a project name, Portal replaces these characters with hyphens (`-`). For example, project "my.app" produces sessions like `my-app-x7k2m9`.

**Collision handling**: If the generated session name already exists in tmux (checked via `tmux has-session`), Portal regenerates with a new nanoid suffix. This is unlikely with 6-character nanoids but handled gracefully.

### Renaming

Session renaming is available both inside and outside tmux:

```bash
tmux rename-session -t <current-name> <new-name>
```

tmux's `rename-session` works from outside the session (unlike Zellij, which required being inside). This means renaming is available in all contexts — the main TUI and when running inside tmux.

### New Session Flow

Session creation is always immediate — no prompts. The session name is auto-generated from the project name (directory basename after git root resolution for new projects, stored name for saved projects).

## Running Inside tmux

### Detection

Portal detects if it's running inside an existing tmux session via the `TMUX` environment variable (set by tmux when inside a session).

### Behavior Inside tmux

When running inside tmux, the TUI is the same as outside — no restricted mode. The difference is the underlying operation:

- **Outside tmux**: `Enter` on a session → `exec tmux attach-session -t <name>`
- **Inside tmux**: `Enter` on a session → `tmux switch-client -t <name>`

tmux's `switch-client` switches the current client to a different session without nesting. This means all TUI operations work from inside tmux.

### Inside tmux: Session Actions

| Action | Command |
|--------|---------|
| Select existing session | `tmux switch-client -t <name>` |
| New session from project | `tmux new-session -d -s <name> -c <dir>` then `tmux switch-client -t <name>` |
| Kill session | `tmux kill-session -t <name>` (same as outside) |
| Rename session | `tmux rename-session -t <name> <new-name>` (same as outside) |

### TUI Differences When Inside tmux

- Current session is excluded from the session list (you're already in it)
- Header shows current session name for context (e.g., from `TMUX` env var parsing or `tmux display-message -p '#{session_name}'`)

### CLI Commands Inside tmux

CLI commands also use switch-client instead of attach:

- `x .`, `x <path>`, `x <query>` → create session detached, then switch-client
- `xctl attach <name>` → switch-client to the named session

## Project Memory

### Remembered Directories

Portal maintains a list of directories where the user has previously started sessions. This enables quick access to frequently used project directories when starting new sessions.

### How Directories are Added

A directory is added to the remembered list when a new session is started there, regardless of entry point:
- File browser selection
- `x .` (current directory)
- `x <path>` (specified directory)
- `x <query>` (alias/zoxide resolves to a directory already in `projects.json`, so no addition needed)

If the directory is not already in `projects.json`, it is added automatically. The project name defaults to the directory basename (after git root resolution). No prompts are shown — session creation is always immediate.

### Project Naming

Project names default to the directory basename (after git root resolution). There is no naming prompt during session creation.

To rename a project or add aliases after the fact:
- **TUI**: Use the project picker's edit mode (`e` shortcut)
- **CLI**: Use `xctl alias set <name> <path>` for aliases

**Project names are independent of tmux session names.** A project may have many sessions — each session's name is auto-generated from the project name (see Session Naming). The project name is a Portal display concept; it does not propagate to tmux directly.

### Project Management

For saved projects, users can manage project details from the project picker via keyboard shortcut:
- **Rename** the project display name
- **Add or remove aliases** for the project's directory

Project renames update `projects.json`. Alias changes update `~/.config/portal/aliases`. Neither affects existing tmux session names.

**Alias management via CLI**: Aliases can also be managed non-interactively:

```bash
xctl alias set m2api ~/Code/mac2/api
xctl alias rm m2api
xctl alias list
```

### Storage

Remembered directories are stored in `~/.config/portal/projects.json`.

### Usage in TUI

When selecting "new in project...", remembered directories appear first in the project picker, allowing quick selection before browsing to new locations.

### Project Picker Interaction

The project picker is a full-screen list shown when selecting `[n] new in project...` from the main TUI.

**Layout**: Remembered projects are listed by recency, with a `[browse for directory...]` option always visible at the bottom of the list.

**Keyboard shortcuts:**

| Key | Action |
|-----|--------|
| `↑` / `↓` or `j` / `k` | Navigate project list |
| `Enter` | Select project → creates session immediately |
| `/` | Enter filter mode (fuzzy-matches against project name) |
| `e` | Edit selected project (rename, manage aliases) |
| `x` | Remove selected project from remembered list (with confirmation) |
| `Esc` | Return to main session list |

**Edit mode**: Pressing `e` opens an inline edit for the selected project. Editable fields: project name (stored in `projects.json`) and aliases (read/written from `~/.config/portal/aliases`, filtered to aliases whose path matches the selected project's directory). Cycle fields with `Tab`, confirm with `Enter`, cancel with `Esc`.

### Stale Project Cleanup

**Automatic**: When the project picker is displayed, Portal checks each remembered directory. If a directory no longer exists on disk, the project is silently removed from the list before display.

**Manual**: While navigating the project list, users can manually remove a project from the remembered list via the `x` keyboard shortcut.

**Via `xctl clean`**: Removes projects whose directories no longer exist on disk. Prints each action taken (e.g., "Removed stale project: myapp (/Users/lee/Code/myapp)"). Non-interactive — no confirmation prompts.

## File Browser

### Purpose

When starting a new session in a directory not in the remembered list, an interactive file browser allows navigating to and selecting the desired directory.

### Access

From the project picker (when creating a new session):
- Select the "browse for directory..." option at the bottom of the project list

### Behavior

- **Content**: Shows directories only — files are not displayed
- **Starting directory**: Current working directory
- **Navigation**: Arrow keys to move through directory listing
- **Enter directory**: `Enter` or `→` descends into highlighted directory
- **Go up**: `Backspace` or `←` goes to parent directory
- **Select current directory**: `Space` selects the current directory for session creation. Alternatively, `Enter` on the `.` entry (current dir indicator) does the same.
- **Filtering**: Typing narrows the directory listing at the current level by fuzzy match. `Backspace` removes the last filter character; when the filter is empty, `Backspace` reverts to its navigation role (go to parent directory). `Esc` clears the filter (if active) or cancels the browser (if no filter).
- **Hidden directories**: Directories starting with `.` are hidden by default. Press `.` to toggle their visibility. The toggle applies only to the current browser session and resets on next open.
- **Add alias**: `a` on a highlighted directory prompts for an alias name. Saves to `~/.config/portal/aliases` (directory is resolved to git root first). No session is started.
- The selected directory is automatically added to remembered projects

## Configuration & Storage

### Location

All Portal data is stored in `~/.config/portal/`.

### Files

| File | Format | Purpose |
|------|--------|---------|
| `config` | Flat key=value | User configuration options |
| `projects.json` | JSON | Remembered project directories |
| `aliases` | Flat key=value | Path aliases for quick navigation |

### projects.json Structure

```json
{
  "projects": [
    {
      "path": "/Users/lee/Code/myapp",
      "name": "myapp",
      "last_used": "2026-01-22T10:30:00Z"
    }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `path` | Yes | Absolute path to project directory |
| `name` | Yes | Display name (defaults to directory basename, can be customized) |
| `last_used` | Yes | ISO timestamp, used for sorting by recency |

**`last_used` updates**: The timestamp is updated every time a new session is started in the project's directory, regardless of entry point. This keeps the project picker sorted by actual usage.

### Alias Storage

Aliases are stored separately from projects in `~/.config/portal/aliases`, using a flat key-value format:

```
m2api=/Users/lee/Code/mac2/api
aa=/Users/lee/Code/aerobid/api
work=/Users/lee/Code/work
```

Aliases are pure navigation shortcuts — they map a short name to a directory path. They are independent of the project registry: you can alias a path that has never had a session started in it.

**Aliases must be unique.** Each alias name maps to exactly one path. Setting an alias that already exists overwrites it.

**Path normalization**: When setting an alias, Portal expands `~` to the user's home directory and resolves relative paths to absolute before storing. The aliases file always contains absolute paths.

### Configuration Options

Configuration uses a simple flat format:

```
key=value
another_key=another_value
```

Specific configuration options will be determined during implementation based on what behaviors need to be user-configurable.

## CLI Interface

### Shell Functions

`portal init` emits these shell functions (default names shown):

```bash
# emitted by: eval "$(portal init zsh)"
function x() { portal open "$@" }
function xctl() { portal "$@" }
```

`portal init` also emits shell tab completions for the `portal` binary (generated by Cobra). The init script is the single source of shell integration — functions, aliases, and completions are all emitted together.

Tab completions are wired to the shell function names, not just the `portal` binary. The init script ensures that `xctl<TAB>` completes subcommands (e.g., `compdef xctl=portal` for zsh). When `--cmd` is used, completions are wired to the custom names instead. Users rarely type `portal` directly — completions must work for the names they actually use.

### x — The Launcher

`x` does one thing: get you into a tmux session. No subcommands, no verbs — just a destination (or no args for the TUI).

| Input | Behavior |
|-------|----------|
| `x` | Opens TUI picker |
| `x .` | New session in current directory |
| `x <path>` | New session at resolved path |
| `x <query>` | Resolve via alias → zoxide → TUI fallback |
| `x -e <cmd> [destination]` | Resolve destination, start session, execute `<cmd>` |
| `x [destination] -- <cmd> [args...]` | Resolve destination, start session, execute `<cmd>` with args |

**Command execution** (`-e` / `--`): When launching a new session, an optional command can be passed to execute inside the session after creation. Two syntaxes are supported:

- **`-e` / `--exec`**: For simple commands and clean aliasing. `x -e claude myproject`
- **`--` (double-dash)**: For compound commands with their own flags, no quoting needed. `x myproject -- claude --resume --model opus`

Both are mutually exclusive — providing both is an error. Both resolve to the same internal command slice early in CLI parsing.

**Command is orthogonal to project resolution.** The exec command applies regardless of how the project was chosen — direct path, alias, zoxide, or TUI selection. Examples:
- `x -e claude` → TUI opens, pick project, then claude runs
- `x -e claude myproject` → resolves myproject, then claude runs
- `x -e claude .` → current directory, then claude runs

**When a command is specified, the TUI shows only the project picker** — existing sessions are not displayed. A banner at the top shows the pending command (e.g., `Command: claude`). This reinforces that the command applies to new sessions only and avoids confusion about whether the command would affect an existing session.

Users wanting to attach to an existing session use `x` without a command.

**Quick-start shortcuts**: `x .`, `x <path>`, and `x <alias>` skip the project picker — the directory is resolved, registered if new, and a session starts immediately.

### Query Resolution

When `x` receives a positional argument (e.g., `x myapp`):

1. **Existing path**: If the argument is an absolute path, relative path, or starts with `~` — use directly
2. **Alias match**: Check if it matches an alias in `~/.config/portal/aliases` — resolve to configured path
3. **Zoxide query**: Run `zoxide query <terms>` — use the best frecency match
4. **No match**: Fall back to the TUI with the query pre-filled as the filter text. If a command is pending (`-e`/`--`), this opens the project picker; otherwise, the main session picker.

Zoxide is an **optional soft dependency**. If not installed, step 3 is skipped silently. Aliases and TUI fallback still work.

**Path detection heuristic**: An argument containing `/` or starting with `.` or `~` is treated as a path (step 1). Everything else enters the alias → zoxide → fallback chain.

**Path validation**: After resolution (whether from a literal path, alias, or zoxide), Portal validates the resolved directory exists on disk. If it does not, Portal displays: "Directory not found: {path}" and exits with a non-zero status code. No session is created.

### xctl — The Control Plane

`xctl` provides session management and housekeeping commands. It passes through directly to `portal` (e.g., `xctl list` = `portal list`).

| Command | Description |
|---------|-------------|
| `xctl list` | List sessions (TTY-aware output — see below) |
| `xctl attach <name>` | Attach to session by exact name |
| `xctl kill <name>` | Kill a session |
| `xctl clean` | Remove stale projects (directories that no longer exist on disk), non-interactive |
| `xctl alias set <name> <path>` | Set a project alias |
| `xctl alias rm <name>` | Remove a project alias |
| `xctl alias list` | List all aliases |

**Attach errors**: If `xctl attach <name>` doesn't match any running session, Portal displays: "No session found: {name}" and exits with a non-zero status code.

**Kill errors**: If `xctl kill <name>` doesn't match any running session, Portal displays: "No session found: {name}" and exits with a non-zero status code.

### portal — Direct Commands

These are accessed via the `portal` binary directly (or via `xctl` since it passes through):

| Command | Description |
|---------|-------------|
| `portal open [-e cmd] [destination] [-- cmd args...]` | Launch TUI picker, or resolve destination and start/attach session. Accepts `-e`/`--exec` and `--` for command execution. Used via `x` shell function. |
| `portal init <shell>` | Output shell integration script: shell functions (`x`, `xctl`) and tab completions (bash, zsh, fish) |
| `portal init <shell> --cmd <name>` | Output shell integration with custom command names |
| `portal version` | Show version information |
| `portal help` | Show usage information |

**Note**: All `xctl` subcommands (`list`, `attach`, `kill`, `clean`, `alias`) are also accessible as `portal` subcommands directly, since `xctl` passes through to `portal`. They are documented in the xctl section above.

**Supported shells for `portal init`**: bash, zsh, fish only. No powershell — Portal wraps tmux, which doesn't run on Windows.

### xctl list — TTY-Aware Output

`xctl list` adapts its output based on whether stdout is a terminal:

**Interactive (stdout is TTY):**
```
flowx-dev    attached    3 windows
claude-lab   detached    1 window
```

**Piped (stdout is not TTY):**
```
flowx-dev
claude-lab
```

**Override flags:**
- `xctl list --short` — Names only, even in a terminal
- `xctl list --long` — Full details, even when piped

**Inside tmux**: `xctl list` includes all sessions (including the current one). The TUI excludes the current session for UX reasons, but the CLI output is always complete — callers can filter as needed.

**No sessions**: When no sessions are running (or no tmux server exists), `xctl list` outputs nothing (empty stdout) and exits with code 0.

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Not found / no match |
| 2 | Invalid usage |

### Scripting & fzf Integration

`xctl list` outputs session names when piped, enabling external tool integration:

```bash
# Quick attach with fzf
xctl attach $(xctl list | fzf)

# Scripting
for session in $(xctl list); do
  echo "Session: $session"
done
```

### Design Philosophy

Most operations happen through the TUI via `x`. The `xctl` commands provide non-interactive utilities for scripting, automation, and quick management.

## Distribution

### Target Platforms

- macOS (arm64, amd64)
- Linux (arm64, amd64)

### Installation Method

Distributed via Homebrew tap.

```bash
brew tap leeovery/tools
brew install portal
```

**Future exploration**: Publishing to Homebrew core (without requiring a personal tap) — to be explored post-implementation.

### Build & Release

[GoReleaser](https://goreleaser.com/) handles cross-platform builds and distribution.

**Release process**:
1. Run release script (generates version tag)
2. Push tag to GitHub
3. GitHub Actions workflow triggers GoReleaser
4. GoReleaser builds binaries and creates GitHub Release
5. GoReleaser auto-updates the Homebrew formula in `leeovery/homebrew-tools`

### Runtime Dependency

tmux is a required dependency. The Homebrew formula declares tmux as a dependency, ensuring it's installed automatically.

If tmux is somehow missing at runtime, Portal displays: "Portal requires tmux. Install with: brew install tmux"

## tmux Integration

### Session Operations

Portal uses these tmux commands (verified against tmux 3.6a):

| Operation | Command |
|-----------|---------|
| Create or attach | `tmux new-session -A -s <name>` |
| Create with start dir | `tmux new-session -A -s <name> -c <dir>` |
| Create detached (for switch-client) | `tmux new-session -d -s <name> -c <dir>` |
| Attach to existing | `tmux attach-session -t <name>` |
| Switch client (inside tmux) | `tmux switch-client -t <name>` |
| List sessions | `tmux list-sessions -F '#{session_name}\|#{session_windows}\|#{session_attached}'` |
| Check session exists | `tmux has-session -t <name>` (exit 0 if exists, 1 if not) |
| Kill session | `tmux kill-session -t <name>` |
| Rename session | `tmux rename-session -t <name> <new-name>` |
| List windows | `tmux list-windows -t <name> -F '#{window_index}\|#{window_name}\|#{window_panes}'` |

### Process Handoff

When launching tmux from outside (bare shell), Portal uses `exec` to replace its own process with tmux. Portal's job is complete once the user selects a session — there are no post-attach actions. This avoids terminal state management and is the standard pattern for session pickers.

When running inside tmux, no `exec` is needed — `switch-client` is a tmux command sent to the server, not a process replacement. Portal exits normally after issuing the tmux commands.

### Command Execution in Sessions

When a command is specified via `-e` or `--`, Portal passes it to the session's shell to execute. The command **runs then drops to shell** — when the command exits, the user lands in their shell at the project directory. The session stays alive.

This is the safe default: if the command crashes or is interrupted (Ctrl+C), the tmux session survives and the user retains a shell in the correct directory.

Users wanting exec-and-die behavior can pass `exec` as part of the command itself: `x myproject -- exec claude`.

**Implementation**: The command is passed as tmux's `shell-command` argument on `new-session`. Portal uses `$SHELL` to detect the user's login shell:

```
tmux new-session -A -s <name> -c <dir> "$SHELL -ic '<cmd>; exec $SHELL'"
```

This creates the session with a shell that runs the command, then replaces itself with a fresh interactive shell via `exec`. The session's shell process persists after the command completes.

For the inside-tmux case (detached creation + switch):
```
tmux new-session -d -s <name> -c <dir> "$SHELL -ic '<cmd>; exec $SHELL'"
tmux switch-client -t <name>
```

**No command specified**: When no `-e` or `--` is provided, the `shell-command` argument is omitted — tmux starts the session with the user's default shell in the project directory.

### Session Discovery

Portal uses `tmux list-sessions` with format strings to discover running sessions. The `-F` flag provides structured, parseable output with no ANSI escape codes to strip.

Available metadata per session:
- `#{session_name}` — session name
- `#{session_windows}` — window count
- `#{session_attached}` — number of attached clients (0 = detached, 1+ = attached)
- `#{session_created}` — creation timestamp (unix epoch)

**No server running**: When no tmux server is running (no sessions exist), `tmux list-sessions` exits with a non-zero status and outputs an error. Portal treats this as zero sessions — it shows the "No active sessions" empty state. This is not a fatal error.

## Dependencies

Prerequisites that must exist before implementation can begin:

### Required

None. Portal is a standalone tool with no blocking dependencies on other systems.

### Runtime Dependencies

| Dependency | Purpose |
|------------|---------|
| **tmux** | Portal wraps tmux — all session operations require tmux to be installed |

**Note**: tmux is a runtime dependency (must be present when Portal runs), not a build-time dependency. Portal can be built and tested independently; tmux is declared as a Homebrew dependency for installation.

### Build Dependencies

Standard Go toolchain and libraries (Bubble Tea, Cobra, etc.) — handled by `go.mod`.
