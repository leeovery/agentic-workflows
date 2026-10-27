# CX - Claude eXecute

## Vision

A Go CLI tool for managing Claude Code sessions with first-class Zellij support. Designed for developers who want persistent, resumable Claude sessions across terminal restarts, crashes, and remote access scenarios.

**Primary goals:**
- Zellij-first workflow (sessions survive crashes/restarts)
- Quick project switching with directory memory
- Remote session attachment (SSH/Mosh from phone → pick session → resume)
- Clean, intuitive TUI using bubbletea
- Homebrew installable

### Naming

The binary is called `cx` (Claude eXecute). Short, memorable, easy to type.

```bash
brew install leeovery/tools/cx
```

---

## Core Concepts

### Session Types

1. **Zellij Session** (default): Claude runs inside a Zellij session with a custom layout. Survives terminal crashes, can be attached from anywhere.

2. **Raw Session**: Claude runs directly in current terminal. Lost if terminal closes. Useful for quick one-off questions.

### Project Registry

The tool maintains a registry of known projects:
- Path to project directory
- Last-used timestamp
- Optional alias/nickname
- Session count (how many times used)

When starting a new session, you can pick from recent projects, and the tool will `cd` into that directory before launching Claude.

### Session Tracking

For Zellij sessions, the tool queries Zellij directly for session state. Each session is associated with:
- Project name (derived from directory or explicit)
- Working directory
- Status (running, attached, exited)
- Creation time

---

## CLI Interface

### Primary Command (Unified View)

The main command `cx` (or `claude-sessions`) shows a unified interactive view:

```bash
cx                      # Show unified picker: active sessions + recent projects
cx .                    # Quick start: new session in current directory
cx <project>            # Fuzzy match → attach existing or start new
cx <path>               # If path exists, cd there and start new session

# Modifiers (apply to new sessions)
cx --raw                # Skip Zellij, run Claude directly (one-off)
cx --continue, -c       # Pass --continue to Claude
cx --resume, -r         # Pass --resume to Claude
```

**The unified view abstracts away Zellij session naming.** Users think in terms of projects/directories, not session names like "myapp-01". The tool handles the mapping internally.

### Management Commands

```bash
cx list                 # Non-interactive list of all sessions
cx list --all           # Include dead/exited sessions
cx kill                 # Interactive picker to kill sessions
cx kill <pattern>       # Kill sessions matching pattern
cx kill --all           # Kill all active sessions
cx clean                # Delete all exited/dead Zellij sessions
cx projects             # List registered projects
cx projects add [path]  # Register directory (default: current)
cx projects forget      # Interactive picker to remove
cx config               # Show/edit configuration
cx help                 # Help
```

---

## Configuration

Location: `~/.config/cx/config.yaml`

```yaml
# Default behavior
defaults:
  use_zellij: true              # false = raw Claude by default
  zellij_layout: "claude"       # Layout name for Zellij sessions
  project_dir: "~/Code"         # Default directory to scan for projects

# Session naming
session:
  format: "{project}-{num}"     # e.g., "myapp-01"
  num_padding: 2                # Zero-pad session numbers

# UI preferences
ui:
  show_timestamps: true         # Show last-used times in project picker
  max_recent: 10                # Max projects to show in quick picker
  theme: "default"              # Future: color themes

# Claude options
claude:
  default_args: []              # Args always passed to Claude
  # Example: ["--model", "opus"]
```

---

## Data Storage

Location: `~/.config/cx/`

### projects.json

```json
{
  "projects": [
    {
      "path": "/Users/lee/Code/myapp",
      "name": "myapp",
      "alias": null,
      "last_used": "2024-01-15T10:30:00Z",
      "use_count": 42
    }
  ]
}
```

### Sessions

**No persistent session storage.** Sessions are queried live from Zellij. The tool parses `zellij list-sessions` output to get current state.

For session → project mapping, we can either:
1. Encode project path in session name (ugly)
2. Store a lightweight session registry that maps session names to project paths
3. Query the session's CWD from Zellij (if possible)

**Recommendation:** Option 2 - maintain `sessions.json` with active session mappings, cleaned up when sessions are deleted.

```json
{
  "sessions": {
    "myapp-01": {
      "project": "/Users/lee/Code/myapp",
      "created": "2024-01-15T10:30:00Z"
    }
  }
}
```

---

## Feature Details

### 1. Unified Interactive View

When running `cx` with no arguments, show a single unified view combining active sessions and recent projects:

```
┌─ Claude Sessions ────────────────────────────────┐
│                                                  │
│  > myapp          ~/Code/myapp       ● 2 active  │
│    dotfiles       ~/.dotfiles          3h ago   │
│    api-server     ~/Code/api         ○ 1 active  │
│    website        ~/Code/website       1w ago   │
│                                                  │
│  ─────────────────────────────────────────────   │
│    [.] current directory                         │
│    [n] new directory...                          │
│                                                  │
│  [enter] select  [/] filter  [?] help            │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Indicators:**
- `● N active` = has running sessions (● = attached to one)
- `○ N active` = has running sessions (none attached)
- `3h ago` = no active sessions, shows last used time

**Behavior when selecting a project:**

If project has **no active sessions**:
→ cd to directory → start new session

If project has **one active session**:
→ cd to directory → attach to it

If project has **multiple active sessions**:
→ Show sub-picker to choose which to attach, or start new:

```
┌─ myapp ──────────────────────────────────────────┐
│                                                  │
│  > Attach: session 1          started 2h ago    │
│    Attach: session 2          started 30m ago   │
│    ─────────────────────────────────────────     │
│    Start new session                             │
│                                                  │
│  [enter] select  [esc] back                      │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Note:** Session names like "myapp-01" are internal implementation. Users see "session 1", "session 2" etc. The abstraction keeps things simple.

### 2. Non-Interactive List

`cx list` for quick terminal output (no TUI):

```
myapp (~/Code/myapp)
  ● session 1    running  attached   2h ago
  ○ session 2    running             30m ago

dotfiles (~/.dotfiles)
  ○ session 1    running             3h ago

api-server (~/Code/api)
  ◌ session 1    exited              1w ago

3 active, 1 exited
```

### 3. Remote Attach Flow

When SSHing from phone and running `cx`:

1. Same unified view appears
2. Select project with active session
3. Tool looks up project directory from registry
4. `cd` into project directory
5. Attach to Zellij session

This ensures the shell is in the right directory when you detach or the session ends. The user doesn't need to know `cx attach` exists - just `cx` handles everything.

### 4. Session Naming

Format: `{project}-{NN}`

- Project derived from directory basename (lowercase, strip leading dot)
- Number increments per project (01, 02, 03...)
- Numbers consider both active AND exited sessions to avoid confusion

Example: Starting sessions in `~/Code/MyApp`:
- First: `myapp-01`
- Second (while 01 running): `myapp-02`
- After killing 01 and 02: `myapp-03` (not 01)

### 5. Cleanup

`cx clean` deletes all exited Zellij sessions and removes them from `sessions.json`.

`cx kill` offers:
- Interactive picker for selective killing
- Pattern matching (`cx kill myapp` kills all myapp-* sessions)
- `--all` flag for bulk kill

---

## Technical Architecture

### Project Structure

```
cx/
├── cmd/
│   └── cx/
│       └── main.go           # Entry point
├── internal/
│   ├── cli/
│   │   ├── root.go           # Cobra root command
│   │   ├── start.go          # Default/start command
│   │   ├── list.go           # List sessions
│   │   ├── attach.go         # Attach to session
│   │   ├── kill.go           # Kill sessions
│   │   ├── clean.go          # Clean dead sessions
│   │   ├── projects.go       # Project management
│   │   └── config.go         # Config management
│   ├── config/
│   │   └── config.go         # Config loading/saving
│   ├── projects/
│   │   └── registry.go       # Project registry operations
│   ├── sessions/
│   │   ├── zellij.go         # Zellij interaction
│   │   ├── tracker.go        # Session tracking
│   │   └── claude.go         # Claude process spawning
│   ├── ui/
│   │   ├── picker.go         # Project/session picker
│   │   ├── list.go           # Session list view
│   │   └── styles.go         # Lipgloss styles
│   └── util/
│       └── paths.go          # Path utilities
├── go.mod
├── go.sum
├── Makefile
└── README.md
```

### Dependencies

```go
require (
    github.com/spf13/cobra v1.8.0           // CLI framework
    github.com/charmbracelet/bubbletea v0.25.0  // TUI framework
    github.com/charmbracelet/lipgloss v0.9.0    // Styling
    github.com/charmbracelet/bubbles v0.18.0    // UI components
    github.com/sahilm/fuzzy v0.1.0              // Fuzzy matching
    gopkg.in/yaml.v3 v3.0.1                     // Config parsing
)
```

### Zellij Integration

```go
// sessions/zellij.go

type ZellijSession struct {
    Name     string
    Status   SessionStatus  // Running, Exited
    Attached bool
}

func ListSessions() ([]ZellijSession, error) {
    // Run: zellij list-sessions
    // Parse output (strip ANSI codes)
    // Return structured data
}

func AttachSession(name string) error {
    // Exec: zellij attach <name>
}

func CreateSession(name, layout string) error {
    // Exec: zellij attach -c <name> options --default-layout <layout>
}

func KillSession(name string) error {
    // Run: zellij kill-session <name>
}

func DeleteSession(name string) error {
    // Run: zellij delete-session <name>
}
```

### Claude Spawning

```go
// sessions/claude.go

type ClaudeOptions struct {
    Continue bool
    Resume   bool
    Print    bool
    Args     []string
}

func StartClaude(opts ClaudeOptions) error {
    args := []string{}
    if opts.Continue {
        args = append(args, "--continue")
    }
    if opts.Resume {
        args = append(args, "--resume")
    }
    // ... etc

    // Exec replaces current process with claude
    return syscall.Exec(claudePath, args, os.Environ())
}
```

---

## Homebrew Distribution

### Tap Setup

Repository: `github.com/leeovery/homebrew-tools`

Formula: `Formula/cx.rb`

```ruby
class Cx < Formula
  desc "Claude eXecute - Claude Code session manager with Zellij support"
  homepage "https://github.com/leeovery/cx"
  url "https://github.com/leeovery/cx/releases/download/v1.0.0/cx-1.0.0.tar.gz"
  sha256 "..."
  license "MIT"

  depends_on "zellij"

  def install
    bin.install "cx"
  end

  test do
    assert_match "cx version", shell_output("#{bin}/cx --version")
  end
end
```

### Installation

```bash
brew tap leeovery/tools
brew install cx
```

### Release Process

1. Tag release in cx repo
2. Build binaries (darwin-arm64, darwin-amd64)
3. Create GitHub release with binaries
4. Update formula with new URL and sha256

---

## Open Questions

### 1. Zellij layout location

Where should the custom Claude layout live?
- Bundled with the tool (installed to `~/.config/zellij/layouts/`)
- User maintains their own (tool just references by name)
- Tool has a `cx setup` command that installs the layout

**Recommendation:** User maintains layout, tool references by name from config. Keeps concerns separated.

### 2. Session directory tracking

How do we know which directory a session belongs to?
- Store in `sessions.json` when session is created
- Parse from session name (encode path somehow)
- Query Zellij for CWD (may not be possible/reliable)

**Recommendation:** Store in `sessions.json`. Simple, reliable.

### 3. Auto-registration of projects

Should we auto-register projects when starting sessions?
- Yes: Less friction, projects remembered automatically
- No: User explicitly controls what's in the registry

**Recommendation:** Yes, auto-register. User can `forget` if needed.

### 4. What if Zellij isn't installed?

- Error and require Zellij?
- Fall back to raw mode with a warning?
- Make it configurable?

**Recommendation:** Warn and fall back to raw mode. Zellij is the default but shouldn't be a hard requirement.

### 5. Continue/Resume behavior

Should `-c` and `-r` work with existing sessions?
- `cx -c myapp` → attach myapp-01 and pass --continue?
- Or: `-c` and `-r` only apply when starting new Claude instances?

**Recommendation:** These flags only affect new Claude processes. For existing sessions, you're attaching to an already-running Claude.

---

## Implementation Phases

### Phase 1: Core MVP
- Basic project picker (bubbletea)
- Zellij session creation/attachment
- Project registry (add, list, forget)
- Session listing
- Config file support
- `--raw` flag for non-Zellij mode

### Phase 2: Session Management
- Interactive attach picker with cd-before-attach
- Kill command with picker and patterns
- Clean command for dead sessions
- Session → project mapping in sessions.json

### Phase 3: Polish
- Fuzzy matching everywhere
- Better error messages
- `--continue` and `--resume` flags
- Help system
- Shell completions (bash, zsh, fish)

### Phase 4: Distribution
- GitHub repo setup
- Build automation (Makefile/GoReleaser)
- Homebrew formula
- README and docs

---

## Example Workflows

### Daily workflow

```bash
# Morning: Start working on myapp
$ cx
# [unified picker shows myapp with no active sessions]
# Select myapp → cd ~/Code/myapp → starts new session

# ... work, close laptop, go home ...

# Evening: SSH from phone
$ ssh mac
$ cx
# [same unified picker shows myapp with ● 1 active]
# Select myapp → cd ~/Code/myapp → attaches to session

# Check progress, detach
# Ctrl+o, d
```

### Quick question (no project)

```bash
$ cx --raw
# Starts claude directly in current dir, no Zellij
```

### Resume last conversation

```bash
$ cx -r
# Opens unified picker, then runs claude --resume in selected project
```

### Multiple sessions on same project

```bash
$ cx myapp       # Creates session 1
$ cx myapp       # Shows sub-picker: attach session 1, or start new
                 # Select "start new" → creates session 2
$ cx list
# Shows both sessions under myapp
```

### Cleanup

```bash
$ cx list --all
# Shows 3 active, 5 exited

$ cx clean
# Deleted 5 exited sessions

$ cx list
# Shows 3 active, 0 exited
```

---

## Notes for Implementation

1. **Use `syscall.Exec` for Claude/Zellij**: Don't spawn as child process - replace the current process so signals work correctly.

2. **Handle ANSI codes**: Zellij outputs colored text. Strip codes when parsing.

3. **Atomic file writes**: Use write-to-temp + rename for `projects.json` and `sessions.json` to prevent corruption.

4. **XDG compliance**: Use `~/.config/cx/` for config, could also support `$XDG_CONFIG_HOME`.

5. **Path expansion**: Handle `~` in paths, resolve symlinks consistently.

6. **Testing**: Mock Zellij commands for unit tests. Integration tests can use actual Zellij if available.
