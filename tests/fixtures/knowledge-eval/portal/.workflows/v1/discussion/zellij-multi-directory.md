---
topic: zellij-multi-directory
status: concluded
work_type: greenfield
date: 2026-01-22
---

# Discussion: Zellij Multi-Directory Sessions

## Context

CX's current design assumes a 1:1 relationship between Zellij sessions and project directories. However, Zellij sessions can have **multiple panes spread across multiple directories/projects**.

This challenges the core model and could dramatically change the tool's architecture.

### References

- [CX Design Discussion](cx-design.md) - Concluded design assuming simpler model
- [CX Tool Plan](../research/cc-tool-plan.md) - Initial research

### Current Model Assumptions (from cx-design.md)

1. **sessions.json** maps each session to exactly one project path
2. **cd before attach** - CX changes to project dir before attaching
3. **Project as anchor** - TUI organizes around projects, sessions as children
4. **Session naming** - `{project-name}-{NN}` implies project ownership

## Questions

- [ ] How do users actually use Zellij multi-pane sessions?
- [ ] Does the session → project mapping need to change?
- [ ] What should "cd before attach" mean for multi-directory sessions?
- [ ] How does this affect the TUI model?
- [ ] Is the naming convention still valid?

---

*Each question gets its own section below. Check off as concluded.*

---

## How do users actually use Zellij multi-pane sessions?

### The Problem

Zellij allows multiple panes per session, each potentially in a different directory. Need to understand how this is actually used in practice to determine if CX's model needs fundamental changes.

### Journey

**Confirmed Zellij behavior:**
- No interactive picker - `zellij attach` without args just lists sessions, requires you to pass a name/prefix
- Sessions restore fully on reattach - not "cd-ing", the shell process never died
- You can pass any unambiguous prefix to attach

**Key realization:**
All three multi-pane scenarios (monorepo, separate projects, mixed) are valid use cases. This means session ≠ project. Session = workspace.

**Existential question raised:** Is CX even needed?

User already has aliases wrapping Zellij (`cc` function). The original "cd to project before attach" value prop disappears since Zellij restores everything.

### Options Considered

**CX as "Claude executor"** (original vision)
- Tightly coupled to Claude Code
- Manages project → session mapping
- Auto-starts Claude in sessions
- *Problem*: Model assumes 1:1 session-project, which doesn't hold

**CX as "workspace manager"** (emerging vision)
- Zellij wrapper with better UX
- Interactive picker (Zellij lacks this)
- Workspace = session, may span multiple directories
- Claude is incidental, not core
- *Problem*: Might be a thin wrapper over `zellij attach`

**Just use aliases** (status quo)
- Already works
- No maintenance burden
- *Problem*: Limited discoverability, no rich UI

### Decision

*Pending - need to explore what value CX adds over aliases...*

---

## What defines a workspace?

### The Problem

If CX is a workspace manager (not project manager), how do workspaces get created and defined? This is the crux of whether CX is worth building.

### Journey

**What user actually wants:**
1. One command (`cx`) → interactive picker
2. Picker shows existing Zellij sessions (queried live)
3. Picker shows remembered projects (for starting new sessions)
4. Select session → attach
5. Select project → cd + start new Zellij session

**Key simplification:** No session → project mapping needed. They're separate concerns:
- Sessions = live data from `zellij ls`
- Projects = CX's memory of "directories I've started sessions in before"

CX doesn't track which project a session belongs to. Select session → attach. Select project → new session.

**New session flow:**
1. Select `[n] new session...`
2. Project picker (remembered dirs + browse option)
3. Name prompt: "Workspace name? [default: dir-name]"
4. cd to dir, `zellij attach -c <name>`

### Decision

*Pending - exploring what info we can show per session...*

---

## Can we query session details from outside Zellij?

### The Problem

Zellij's built-in session manager shows rich info (tabs, panes, commands). Can CX show similar detail from *outside* a running session?

### Research Findings

**Yes - via CLI actions with `--session` flag:**

```bash
# Get tab names for a specific session
zellij --session my-session action query-tab-names

# Dump full layout (KDL format)
zellij --session my-session action dump-layout

# List connected clients
zellij --session my-session action list-clients
```

This works from *outside* Zellij, targeting any running session by name.

**For exited (resurrectable) sessions:**

Layout stored in cache:
```
~/.cache/zellij/<version>/session_info/<session-name>/session-layout.kdl
```

KDL file contains tabs, panes, cwds, commands:
```kdl
layout {
    tab name="my-tab" cwd="/some/path" {
        pane command="claude" cwd="/project/dir"
        pane command="htop"
    }
}
```

**Parsing considerations:**
- `query-tab-names` returns simple text (easy)
- `dump-layout` returns KDL (need parser - Go has `github.com/sblinch/kdl-go`)
- JSON output requested but not yet implemented (Issue #4212)

### Decision

CX can show tab names per session:
```
>  cx-03          ● attached
   └─ 2 tabs: "Claude Code", "Tests"
```

Implementation: call `zellij --session <name> action query-tab-names` for each session.

For more detail (pane cwds, commands), parse `dump-layout` KDL output.

---

## What should the TUI look like?

### The Problem

Need a mobile-friendly, keyboard-driven TUI that works at bare shell (before Zellij is running).

### Journey

**User's actual workflow:**
1. SSH/Mosh to machine → drops into `~` (bare shell)
2. Run `cx`
3. Full-screen picker appears (optimized for small screens)
4. Arrow to selection, Enter
5. Attached to session (or new one started)

**Zellij's built-in session manager** exists but:
- Only works *inside* an existing Zellij session
- Too information-dense for mobile screens
- Can't start from bare shell

### Options Considered

**Minimal info per session:**
```
SESSIONS
  cx-03       ● attached
  api-work
```

**With tab names:**
```
SESSIONS
  cx-03       ● attached
  └─ 2 tabs: "Code", "Tests"
  api-work
  └─ 1 tab: "Main"
```

**With pane details (like Zellij's manager):**
- Too dense for mobile
- Overkill for just picking a session

### Decision

**Minimal with optional expansion.** Default view shows session names + attached status. Could add tab names as one-liner if useful, but keep it scannable.

```
┌─────────────────────────────────────┐
│                                     │
│           SESSIONS                  │
│                                     │
│    >  cx-03          ● attached     │
│       api-work       2 tabs         │
│       client-proj                   │
│                                     │
│           EXITED                    │
│                                     │
│       old-feature    (resurrect)    │
│                                     │
│    ─────────────────────────────    │
│    [n] new in project...            │
│                                     │
└─────────────────────────────────────┘
```

---

## Summary (so far)

### Model Shift

From **project-centric** (original cx-design.md) to **workspace-centric**:

| Original Model | New Model |
|----------------|-----------|
| Session belongs to project | Session = workspace (may span dirs) |
| sessions.json maps session→project | No mapping needed |
| cd before attach | Not needed (Zellij restores) |
| TUI organized by projects | TUI organized by sessions |
| Naming: `{project}-{NN}` | User chooses workspace name |

### CX's Value Proposition

1. **Interactive picker at bare shell** - what Zellij's session-manager does, but *before* you're inside Zellij
2. **Mobile-friendly** - cleaner, less dense than Zellij's built-in
3. **Project memory** - quick start new sessions in remembered directories
4. **One command** - `cx` does everything vs. `zellij ls` + `zellij attach <name>`

### Open Questions

- [x] Is this enough value over aliases + `zellij ls | fzf`?
- [x] Session naming convention - still `{name}-{NN}` or free-form?
- [x] Should CX manage layouts for new sessions?
- [x] Can CX detect it's running inside a Zellij session?
- [x] What operations should work from inside vs outside Zellij?

---

## Is CX worth building?

### Decision

**Yes.** Reasons:
- Personal project, fun to build in Go
- Could expand for other uses later
- Streamlines workflow, reduces cognitive load
- Not trying to sell it - scratching own itch

---

## Session naming convention

### The Problem

Original design: `{project}-{NN}`. But if workspaces aren't tied to projects, how should naming work?

### Decision

**Free-form with smart defaults:**

1. **Default** = directory basename (e.g., starting in `~/Code/myapp` suggests "myapp")
2. **Always prompt** before starting, even for previously saved projects
3. **Rename later** supported - workspaces evolve (start as "project-a", becomes "comparison-testing")

**Why always prompt:** User might start session in Project B directory but want to call it "testing-workflow" or something contextual.

**Example flow:**
```
Selected: ~/Code/myapp

Workspace name: [myapp] _
  (Enter to accept, or type a custom name)

Layout: [default] ▾
  • default (single pane)
  • claude (single pane + Claude)
  • split (two panes)
```

---

## Layouts for new sessions

### The Problem

When starting a new session, what layout should be used?

### Decision

**Default + optional saved layouts:**

1. **Default** = single pane in the chosen directory (just wraps shell in Zellij)
2. **Saved layouts** = user can pick from predefined layouts
3. **Layout picker** shown at session start (can be skipped with Enter for default)

**Example layouts:**
- `default` - single pane
- `claude` - single pane, runs `claude` command
- `split` - two horizontal panes
- `dev` - custom layout for specific workflow

**Where layouts live:** `~/.config/cx/layouts/` (KDL files, same format as Zellij)

**Future nice-to-have:** "Save current layout" from inside a session.

---

## Running CX from inside Zellij

### The Problem

If user is already inside a Zellij session and runs `cx`, what should happen? Can CX detect this?

### Research Needed

Zellij sets environment variables inside sessions:
- `ZELLIJ` = `0` (when inside a session)
- `ZELLIJ_SESSION_NAME` = current session name

So CX *can* detect it's running inside Zellij.

### Options

**If inside Zellij, CX could:**

1. **Refuse** - "Already in a Zellij session. Use Zellij's session manager instead."
2. **Limited mode** - Show sessions but warn about nesting
3. **Smart mode** - Offer different actions:
   - Rename current session
   - Switch to different session (via Zellij's internal mechanism?)
   - Kill other sessions
   - Just show info (read-only)

### Decision

**Utility mode** when running inside Zellij:
- Detect via `ZELLIJ` env var
- **Block nesting** - don't allow attaching to another session from inside one
- **Allow safe operations:**
  - Rename current session
  - View other sessions (read-only)
  - Kill other sessions
  - Show current session info

---

## File browser for new projects

### Decision

**Unchanged from original design:**
- `[/]` or arrow to "new directory" option opens interactive file browser
- Navigate directories, select one to start session there
- Selected directory gets added to remembered projects

---

## Configuration & Storage

### Decision

**Location:** `~/.config/cx/`

Contents:
- `config` - flat key=value config (as in original design)
- `projects.json` - remembered project directories
- `layouts/` - custom layout files (KDL format)

---

## Error Handling: Zellij not installed

### Decision

**Not a concern** - Zellij will be a Homebrew dependency. Install scripts will ensure it's present.

If somehow missing, simple error: "CX requires Zellij. Install with: brew install zellij"

---

## CLI Subcommands

### Decision

**Minimal, as originally designed:**
- `cx` - main TUI picker
- `cx clean` / `cx prune` - remove dead/exited sessions (non-interactive)
- `cx version` - version info
- `cx help` - usage

Most operations happen through the TUI.

---

## Distribution

### Decision

**Unchanged from original design:**
- Homebrew tap (`leeovery/tools`)
- GoReleaser for builds
- Zellij as brew dependency

---

## Final Summary

### The Pivot

This discussion identified a fundamental model change for CX:

**Before:** Project-centric tool that maps sessions to single project directories, auto-runs Claude, manages session→project relationships.

**After:** Workspace-centric Zellij wrapper that provides a mobile-friendly session picker, remembers project directories for quick new session creation, and lets workspaces evolve freely across multiple directories.

### Key Decisions

| Area | Decision |
|------|----------|
| **Core model** | Session = workspace (may span multiple directories) |
| **Session→project mapping** | None needed - separate concerns |
| **Naming** | Free-form, defaults to directory basename, always prompt |
| **Layouts** | Default single pane + optional saved layouts in `~/.config/cx/layouts/` |
| **Inside Zellij** | Utility mode (rename, info, kill) - block nesting |
| **TUI** | Minimal, mobile-friendly, sessions + exited + new option |
| **Session info** | Query via `zellij --session <name> action query-tab-names` |
| **File browser** | Unchanged from original design |
| **Storage** | `~/.config/cx/` |
| **Distribution** | Homebrew + GoReleaser (unchanged) |

### What Carries Forward from Original Design

- Go + Bubbletea TUI
- Flat config format
- Homebrew distribution via `leeovery/tools` tap
- File browser for new project discovery
- Keyboard shortcuts (N, K, Enter, etc.)
- `cx clean` subcommand

### What Changes from Original Design

- No `sessions.json` mapping file
- No automatic Claude execution
- Session names are user-chosen, not `{project}-{NN}`
- TUI organized by sessions (not projects with session badges)
- No "cd before attach" (Zellij handles it)
- Utility mode when running inside Zellij

### Tool Rename

**Old name:** CX (Claude eXecute) - no longer fits since it's not Claude-specific

**New name:** **ZW (Zellij Workspaces)**
- Short, easy to type
- `z` and `w` are close on keyboard
- Clearly communicates purpose: manage Zellij workspaces
- Command: `zw`

**Implications:**
- Config location: `~/.config/zw/`
- Homebrew formula: `zw`
- Repository: consider renaming from `cx` to `zw`

### Next Steps

1. **Update specification** - Revise based on this discussion's outcomes
2. **Reconcile with cx-design.md** - Mark superseded sections
3. **Rename repository** - `cx` → `zw`
4. **Implementation planning** - New plan reflecting the simpler model
