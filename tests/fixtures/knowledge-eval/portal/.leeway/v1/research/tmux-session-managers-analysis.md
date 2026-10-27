---
topic: zw
status: concluded
type: research
date: 2026-01-26
---

# Comparative Analysis: Tmux Session Managers vs ZW

Analysis of three tmux-based session management tools compared against ZW (Zellij Workspaces).

## Projects Analyzed

| Project | Language | Stars | Approach |
|---------|----------|-------|----------|
| [tmux-session-wizard](https://github.com/27medkamal/tmux-session-wizard) | Shell (85.9%) | ~247 | tmux plugin, fzf popup |
| [tmux-sessionx](https://github.com/omerxx/tmux-sessionx) | Shell (88.5%) | ~1.2k | tmux plugin, fzf popup with preview |
| [sesh](https://github.com/joshmedeski/sesh) | Go (99.8%) | ~1.6k | Standalone CLI, delegates UI to fzf/gum |

---

## 1. tmux-session-wizard

### What It Does

A tmux plugin that binds to `prefix + T` and pops up an fzf picker showing existing sessions + recently visited directories (via zoxide). Select one and it either switches to the session or creates a new one named after the directory.

### Architecture

Minimal shell scripts across `bin/t` (main entry point), `src/helpers.sh` (utility functions), and a tmux plugin wrapper. The `bin/t` script combines two data sources into fzf: active tmux sessions (excluding current) and zoxide query results. Selection handling is straightforward — if the result contains `:` it's a session:window reference, otherwise it's a path that gets promoted in zoxide and turned into a new session. No custom TUI, no config file, no project registry.

### What It Does Well

- **Extreme simplicity**: The entire tool is a handful of shell functions. No install complexity, no config files, no learning curve.
- **zoxide integration**: Leverages an existing tool the user probably already has to provide "project memory" without maintaining its own registry. Directories you `cd` to frequently already appear in zoxide's database.
- **Works outside tmux too**: The `t` command can be run from bare shell, not just inside tmux.
- **Session naming modes**: `directory` (basename), `full-path`, `short-path` (compresses intermediate dirs to initials, e.g. `/u/l/bin`) — gives users control over how sessions are named from directories. Implemented via a `session_name()` function with a `_normalize()` helper that replaces spaces, dots, and colons with hyphens.

### What ZW Does Better

- **Built-in TUI**: ZW's Bubble Tea interface is purpose-built for the use case, including sections, empty states, and mobile optimization. Session-wizard is just a raw fzf list.
- **Exited/resurrectable sessions**: ZW shows exited sessions as a separate section. Session-wizard only shows live sessions.
- **Session metadata**: ZW shows tab count, attached indicator. Session-wizard shows nothing beyond the name.
- **Layout selection**: ZW lets users pick a Zellij layout when creating a new session. Session-wizard always creates a bare session.
- **Utility mode**: ZW adapts its UI when running inside the multiplexer. Session-wizard has no such concept.
- **Kill/rename operations**: ZW provides session management beyond just switching. Session-wizard only switches.

### What We Could Learn

- **zoxide as a project source**: Rather than maintaining our own `projects.json` from scratch, we could optionally pull directory suggestions from zoxide. This would give users a "warm start" without needing to manually register projects. Our manual registry is still valuable (aliases, custom names), but zoxide could supplement the file browser as a discovery mechanism.
- **No-config philosophy taken further**: Session-wizard proves you can get a lot done with zero configuration. ZW's config is already minimal, but this reinforces the value of that approach.

---

## 2. tmux-sessionx

### What It Does

A feature-rich tmux plugin that provides a fuzzy session manager with preview panes, multiple browse modes (sessions, windows, tree, config directories, tmuxinator projects, fzf-marks, zoxide), and inline session operations (rename, delete).

### Architecture

Shell scripts orchestrating fzf-tmux with extensive configuration via tmux options (`set -g @sessionx-*`). The main `sessionx.sh` script has a `get_sorted_sessions()` function that retrieves sessions with most-recently-used ordering and applies configurable filter patterns. An `input()` function switches between window mode (listing all windows across sessions) and session mode. An `additional_input()` function adds custom config paths and subdirectories, deduplicating against existing sessions. The `handle_output()` function dispatches based on selection type: directory paths trigger directory-based session creation, colon-delimited strings target specific session:window pairs, and plain text maps to session names. Uses `bat` for syntax-highlighted previews.

### What It Does Well

- **Preview pane**: Shows a file tree of the session's working directory alongside the session list. This gives context about what each session contains without switching to it.
- **Multiple browse modes**: Users can cycle through different views (sessions → windows → tree → config dirs → tmuxinator → zoxide → fzf-marks) all from within the same popup. Each mode has a `Ctrl-*` shortcut.
- **Window-level navigation**: Not just sessions - users can browse individual windows across all sessions and jump directly to a specific window.
- **Tree mode**: Hierarchical view showing sessions with their windows nested underneath.
- **Inline rename**: `Ctrl-r` renames a session without leaving the picker.
- **Inline delete**: `alt+backspace` deletes a session immediately.
- **Rich customization**: 20+ configuration options for appearance, behavior, key bindings, and integrations.

### What ZW Does Better

- **Mobile-first design**: SessionX's dense multi-mode interface would be unusable on a phone. ZW's clean sections and minimal chrome are designed for small screens.
- **Purpose-built TUI**: SessionX is constrained by what fzf can do. ZW's Bubble Tea interface allows custom layouts, sections, prompts, and flows that fzf can't express.
- **Session creation flow**: ZW has a deliberate naming prompt + layout selection. SessionX just creates a session from whatever text you typed into fzf - no naming prompt, no layout choice.
- **Project memory with metadata**: ZW's `projects.json` stores names, aliases, and timestamps. SessionX relies on external tools (zoxide, fzf-marks, tmuxinator) for all project memory.
- **Simpler mental model**: SessionX has 7+ modes with different key bindings in each. ZW has two clear states: main picker and utility mode.
- **File browser**: ZW's interactive directory browser is more intuitive than SessionX's `Ctrl-e` expand-PWD approach.

### What We Could Learn

- **Preview pane concept**: The idea of showing context about a session (file tree, last command, etc.) without entering it is valuable. ZW already shows tab count, but we could consider an optional detail view or preview for sessions.
- **Window-level awareness**: SessionX lets users jump to specific windows, not just sessions. ZW's equivalent would be awareness of Zellij tabs. We already query tab names - we could potentially allow navigating to a specific tab.
- **Tree/hierarchical view**: Showing sessions with their tabs nested underneath could be useful for users with many sessions. Worth considering as a future enhancement.
- **Integration ecosystem**: SessionX integrates with tmuxinator, fzf-marks, and zoxide simultaneously. While ZW shouldn't bloat itself with integrations, the pattern of "aggregate multiple session sources" is worth noting. sesh does this more cleanly (see below).

---

## 3. sesh

### What It Does

A standalone Go CLI that aggregates session sources (tmux sessions, configured projects, tmuxinator layouts, zoxide directories) into a unified list. It delegates the UI entirely to external tools (fzf, gum, television) - sesh itself has no TUI. Users wire it together via tmux key bindings.

### Architecture

Clean Go codebase with ~20 focused packages: `tmux/` (session operations), `zoxide/` (directory integration), `lister/` (aggregates sources), `connector/` (session creation/attachment orchestration), `configurator/` (TOML parsing), `git/` (repo/worktree detection), `cloner/` (git clone support), `namer/` (session name generation), `previewer/` (directory preview), `startup/` (post-creation commands), `tmuxinator/` (template import), and more. The `Connector` interface abstracts session creation with a `Connect(name, opts)` method, coordinating tmux, zoxide, tmuxinator, and startup modules. TOML configuration at `$XDG_CONFIG_HOME/sesh/sesh.toml`. The CLI provides `list`, `connect`, `last`, `root`, `preview`, and `completion` commands. The UI is "bring your own" — typically fzf in a tmux popup.

### What It Does Well

- **Aggregated session sources with filtering**: `sesh list -t` (tmux only), `sesh list -z` (zoxide only), `sesh list -c` (configured only). Users can compose exactly the view they want.
- **TOML configuration with session definitions**: Users can define sessions with paths, startup commands, preview commands, and multi-window layouts in a structured config file:
  ```toml
  [[session]]
  name = "Project"
  path = "~/projects/example"
  startup_command = "nvim"
  windows = ["git", "build"]
  ```
- **Startup commands**: Run a command automatically when a session is created (e.g., open nvim, start a dev server). This is per-session configurable.
- **`sesh last`**: Quick toggle to the previous session - fixes tmux's detach-on-destroy behavior.
- **`sesh root`**: Detects git repo root for a directory, useful for creating sessions at project root regardless of where you are in the tree.
- **Preview command**: `sesh preview {}` generates a preview for any session, integrable with fzf's `--preview` flag.
- **Shell completions**: Built-in completion generation for bash/zsh/fish/powershell.
- **Platform integrations**: Raycast extension (macOS), Ulauncher extensions (Linux).

### What ZW Does Better

- **Built-in TUI**: sesh has no UI of its own - users must wire up fzf/gum themselves. ZW provides a complete, polished experience out of the box.
- **Mobile-optimized**: sesh's "compose it yourself" approach means the UI quality depends entirely on the user's fzf configuration. ZW guarantees a good mobile experience.
- **Exited session handling**: ZW treats exited/resurrectable sessions as first-class citizens with a dedicated section. sesh only shows live tmux sessions.
- **Layout selection**: ZW's interactive layout picker is more discoverable than sesh's config-file approach.
- **File browser**: ZW has interactive directory browsing. sesh relies on zoxide or pre-configured paths.
- **Lower complexity**: sesh requires users to understand fzf, tmux key binding syntax, and TOML configuration. ZW requires running `zw`.

### What We Could Learn

- **Startup commands**: The ability to run a command when creating a new session is genuinely useful. A developer might always want `nvim` to open, or a dev server to start. ZW could consider this as a per-project option in `projects.json`.
- **`last` command (quick toggle)**: Instantly switching to the previous session is a common workflow. ZW could offer `zw last` or a key binding to toggle between the two most recent sessions.
- **`root` command (git-aware paths)**: Starting sessions at the git root rather than the current subdirectory is smart. ZW's file browser or project registration could auto-detect git roots.
- **Sort order control**: sesh lets users control the ordering of session types in the list. ZW could consider letting users choose whether sessions or projects appear first.
- **Shell completions**: sesh generates shell completions for its CLI commands. ZW should do the same - it's a standard Go CLI feature (Cobra supports this out of the box).
- **Composable CLI design**: sesh's `list` + `connect` + `preview` commands make it scriptable. ZW already has `list` and `attach` which serve similar purposes, but `preview` is interesting.
- **Multi-window session definitions**: sesh allows defining sessions with multiple named windows and startup scripts. This is more structured than just selecting a layout file. However, this overlaps heavily with Zellij's own layout system (.kdl files), so ZW should lean on Zellij's layouts rather than duplicating this.

---

## Summary: What ZW Gets Right

These are areas where ZW's design is equal to or stronger than all three tools:

1. **Purpose-built TUI** - None of the three build their own TUI. They all delegate to fzf. ZW's Bubble Tea interface allows a tailored experience that fzf can't match, particularly for mobile.
2. **Mobile-first design** - None of the three consider small screens. ZW is explicitly designed for phone SSH.
3. **Exited session management** - Only ZW treats resurrectable sessions as a distinct, visible concept.
4. **Layout selection** - Only ZW presents an interactive layout picker during session creation.
5. **Utility mode** - Only ZW adapts its behavior when running inside the multiplexer with a dedicated mode.
6. **Session metadata display** - Tab count and attached indicators in the picker are unique to ZW.
7. **Structured project memory** - ZW's `projects.json` with aliases, names, and timestamps is richer than zoxide's implicit frequency tracking.

## Summary: Ideas Worth Adopting

Ranked by value-to-effort:

| Idea | Source | Effort | Value | Notes |
|------|--------|--------|-------|-------|
| Shell completions | sesh | Low | Medium | Cobra gives this for free |
| `zw last` toggle | sesh | Low | Medium | Quick switch to previous session |
| Startup commands per project | sesh | Medium | High | `"startup_command": "nvim"` in projects.json |
| zoxide as optional directory source | wizard, sesh | Medium | Medium | Supplement file browser, not replace projects.json |
| Git root detection | sesh | Low | Low | Auto-suggest git root when registering a project |
| Tab-level navigation | sessionx | High | Low | Jump to specific Zellij tab from picker |

## Summary: Ideas Explicitly Not Worth Adopting

| Idea | Why Not |
|------|---------|
| Delegating UI to fzf | ZW's whole value is the purpose-built TUI |
| Multiple browse modes (7+ modes like sessionx) | Complexity antithetical to ZW's mobile-first simplicity |
| tmuxinator/fzf-marks integration | Zellij ecosystem, not tmux ecosystem |
| Headless/composable-only CLI (like sesh) | ZW's TUI *is* the product; scripting is secondary |
| Preview pane in picker | Screen real estate too precious on mobile |
| Extensive configuration options (20+ like sessionx) | ZW is opinionated-by-design |
