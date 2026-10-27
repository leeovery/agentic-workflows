---
topic: tui
status: concluded
work_type: greenfield
date: 2026-01-19
---

# Discussion: TUI (Terminal User Interface for Humans)

## Context

Tick is agent-first, but humans also interact with the CLI. The research phase established:
- TOON as default output (for agents)
- `--json` flag for compatibility
- TTY detection: terminal = human-readable, pipe = TOON

This discussion focuses on what human-facing terminal output should look like - library vs raw output, styling decisions, and overall UX.

**Key constraint**: Human output is secondary to agent output. Simplicity preferred.

**Important context from TOON discussion**: Agents automatically get TOON output (pipes aren't TTYs). Human-readable output only appears when someone is actually at a terminal. This is a secondary use case.

## References

- [exploration.md](../research/exploration.md) - Core architecture, output format decisions
- [toon-output-format.md](toon-output-format.md) - TTY detection, format selection

## Questions to Explore

1. Library vs raw output - Do we need a TUI library or can plain text suffice?
2. What should human-readable output look like?
3. Interactive features - Any needed, or pure CLI?

---

## Q1: Library vs Raw Output

### The Question

Should Tick use a TUI library (like `charm/lipgloss`, `bubbletea`, `termenv`) or stick with raw `fmt.Print` output?

### Options Considered

**Option A: Raw output (`fmt.Print` only)**
- Simple, no dependencies
- Full control
- Portable (works on any terminal)
- Manual column alignment

**Option B: Lightweight styling library (e.g., `lipgloss`, `termenv`)**
- Easy colors, tables, boxes
- Still CLI (not interactive)
- Small dependency
- Consistent styling

**Option C: Full TUI framework (e.g., `bubbletea`)**
- Interactive UI (selection, scrolling)
- Rich visual experience
- Larger complexity
- Overkill for tick's simplicity

### Journey

Initial instinct was Option A or B - full TUI frameworks are clearly overkill for a tool where agents are primary users.

Key realization: Since agents auto-get TOON via TTY detection, human-readable output is truly secondary. It only appears when a human is at a terminal. This shifts the calculus heavily toward simplicity.

Colors add complexity:
- Terminal capability detection
- `$NO_COLOR` environment variable respect
- Windows compatibility
- For what? A secondary use case.

Conclusion: Start with raw `fmt.Print`. Can always add styling later if humans complain. Zero dependencies for a secondary feature.

### Decision

**Option A: Raw output (`fmt.Print` only)**

No TUI library. Simple aligned columns:

```
ID          STATUS       PRI  TITLE
tick-a1b2   done         1    Setup Sanctum
tick-c3d4   in_progress  1    Login endpoint
```

**Rationale**:
- Zero dependencies for secondary use case
- Works on any terminal
- Easy to implement
- Can iterate later if needed

---

## Q2: Human-Readable Output Format

### The Question

What should the human-readable output look like when TTY is detected?

### Decision

Simple aligned columns. No borders, no colors, no icons.

**List output:**
```
ID          STATUS       PRI  TITLE
tick-a1b2   done         1    Setup Sanctum
tick-c3d4   in_progress  1    Login endpoint
```

**Show output:**
```
ID:       tick-c3d4
Title:    Login endpoint
Status:   in_progress
Priority: 1
Type:     task
Created:  2026-01-19T10:00:00Z

Blocked by:
  tick-a1b2  Setup Sanctum (done)

Description:
  Implement the login endpoint with validation...
```

Clean, scannable, no visual noise.

---

## Q3: Interactive Features

### The Question

Should tick have any interactive features (arrow key navigation, selection menus, scrolling)?

### Options Considered

**Option A: No interactivity - pure CLI commands**
- `tick list` shows list
- `tick show <id>` drills into task
- Standard Unix command pattern

**Option B: Interactive browsing**
- Arrow keys to navigate task list
- Enter to drill into details
- Requires TUI framework

### Journey

Brief discussion. Interactivity has fundamental problems for tick:

1. **Agents can't use it** - They execute commands and parse output. Interactive menus are useless to the primary user.

2. **Composability breaks** - Unix philosophy: small commands that do one thing. Pipe, script, automate. Interactive UIs don't compose.

3. **Complexity for zero benefit** - Interactive frameworks (bubbletea) add significant code for a feature agents can't use.

4. **Humans adapt easily** - `tick show <id>` is one extra command. Not a burden.

The only "interactivity" worth having is shell tab-completion, which Cobra provides for free at the shell level (not app level).

### Decision

**Option A: No interactivity**

Pure CLI commands. Drill into tasks via `tick show <id>`.

---

## Summary

### Key Insights

1. **Human output is truly secondary** - TTY detection means agents auto-get TOON. Human-readable output is the exception, not the rule.

2. **Zero dependencies for secondary features** - Don't add TUI libraries for a use case that's not primary.

3. **Interactivity is anti-pattern here** - Agents can't use it, breaks composability, adds complexity for nothing.

4. **Can iterate later** - If humans complain about plain output, styling can be added. Start simple.

### Decisions Made

| Question | Decision |
|----------|----------|
| TUI library | None - raw `fmt.Print` |
| Human output style | Simple aligned columns, no colors/borders |
| Interactive features | None - pure CLI commands |

### Implementation Notes

- Column alignment via `fmt.Printf` with width specifiers
- No external dependencies for human output
- Tab completion via Cobra (shell-level, not app-level)
