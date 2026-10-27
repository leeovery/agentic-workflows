---
topic: fzf-output-mode
status: concluded
work_type: greenfield
date: 2026-01-25
---

# Discussion: fzf-Compatible Output Mode

## Context

ZW is TUI-first by design. However, power users may want to pipe session/project data to fzf or use it in scripts. This discussion explores adding a non-interactive output mode.

### References

- [ZW Specification](../specification/zw.md) - Current CLI commands (lines 279-297)
- [Zesh README](https://github.com/roberte777/zesh) - Inspiration: `zesh l | fzf` pattern

### Current CLI

From the spec:
- `zw` — Launch TUI
- `zw .` — New session in current directory
- `zw <path>` — New session in specified directory
- `zw <alias>` — New session for project with alias
- `zw clean` — Remove exited sessions
- `zw version` / `zw help`

No plain-text listing for scripting.

### Proposal

Add output that can be piped to fzf or used in scripts:

```bash
zw --list                      # Output session names
zw attach $(zw --list | fzf)   # Pipe to fzf
```

## Questions

- [x] Should this be a flag (`--list`) or subcommand (`zw list`)?
- [x] What data should be included?
- [x] Do we need an `attach` subcommand to complement this?
- [x] Any flags needed?

---

## Flag or subcommand?

### Options Considered

**Option A: Flag `--list` or `-l`**
- Modifier on the main command
- Feels like "give me zw output in list form"

**Option B: Subcommand `zw list`**
- Explicit action
- Consistent with `zw clean`, `zw help`
- Could have its own flags later

**Option C: Both**
- `zw list` canonical, `-l` as shorthand

### Decision

**Subcommand: `zw list`**

Consistent with existing CLI pattern (`zw clean`, `zw help`).

---

## What data should be included?

### Options Considered

**Option A: Session names only (minimal)**
```
cx-03
api-work
client-proj
```
- Simplest, pipes directly to fzf
- One session per line

**Option B: Sessions with status indicators**
- More context but adds parsing complexity

**Option C: Configurable via flags**
- Multiple flags for different data

### Decision

**Session names only, one per line.**

Minimal and pipeable. The purpose is fzf integration, not rich output.

---

## Do we need an attach subcommand?

### Options Considered

**Option A: Add `zw attach <name>`**
- Explicit attach command
- Clear intent

**Option B: Reuse existing `zw <name>` behavior**
- Overload argument to match sessions or aliases
- Simpler surface but ambiguous

**Option C: No attach needed**
- `zw list` is just for info
- Keeps CLI minimal but breaks the fzf pattern

### Decision

**Add `zw attach <name>`**

Explicit subcommand for attaching to a session by name.

---

## Any flags needed?

### Options Considered

- `--all` to include exited sessions
- `--status` to show session state
- Other filters

### Decision

**None for now — ship minimal, add flags later if needed.**

YAGNI. If users need `--all` or similar, add it when requested.

---

## Summary

### Final Design

```bash
zw list                        # Output session names (one per line)
zw attach <name>               # Attach to session by name
zw attach $(zw list | fzf)     # The fzf pattern
```

### New CLI Commands

| Command | Description |
|---------|-------------|
| `zw list` | Output running session names, one per line |
| `zw attach <name>` | Attach to a session by exact name |

### What This Enables

Power users can bypass the TUI entirely:
```bash
# Quick attach with fzf
zw attach $(zw list | fzf)

# Scripting
for session in $(zw list); do
  echo "Session: $session"
done
```

### Spec Updates Needed

Add to CLI Commands section:
- `zw list` — List running session names (for scripting/fzf)
- `zw attach <name>` — Attach to session by name
