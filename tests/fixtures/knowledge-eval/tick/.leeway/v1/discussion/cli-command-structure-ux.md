---
topic: cli-command-structure-ux
status: concluded
work_type: greenfield
date: 2026-01-19
---

# Discussion: CLI Command Structure & UX

## Context

Tick is a minimal, deterministic task tracker for AI coding agents. The CLI is the primary interface - agents call commands like `tick ready --json` to get structured task data. Humans may also use it, but agent consumption is the priority.

The research phase proposed a command structure, but several UX questions remain open before we can finalize the design.

### References

- [Research: exploration.md](../research/exploration.md) (lines 176-203) - Proposed CLI commands

### Proposed Commands (from research)

**Core**: `init`, `create`, `list`, `show`, `start`, `done`, `reopen`
**Aliases**: `ready` (list --ready), `blocked` (list --blocked)
**Dependencies**: `dep add`, `dep remove`
**Utilities**: `stats`, `doctor`, `archive`, `rebuild`
**Global flags**: `--json`, `--plain`, `--quiet`, `--verbose`, `--include-archived`
**Short alias**: `tk` works as alternative to `tick`

## Questions

- [x] What should the default output format be for each command type?
- [x] Should aliases (`ready`, `blocked`) be true aliases or standalone commands?
- [x] Is `dep add/remove` the right pattern for dependency management?
- [x] How should errors and feedback be communicated?
- [x] Should there be bulk operations for planning agents?
- [x] Command naming: are the verbs clear and consistent?

---

## Q1: Default Output Format

### Options Considered

**Option A: TOON default (agent-first)**
- Always output TOON, require `--pretty` for human-readable
- Pro: Explicit agent-first philosophy
- Con: Humans see cryptic output by default

**Option B: Human-readable default**
- Pretty tables by default, `--toon` for agents
- Pro: Intuitive for humans
- Con: Agents must always remember flag

**Option C: Auto-detect (TTY vs pipe)**
- Check if stdout is a terminal
- Terminal → human-readable table
- Piped/redirected → TOON
- Pro: Best of both worlds automatically
- Con: "Magic" behavior could confuse debugging

### How TTY Detection Works

Standard Unix mechanism - program checks if stdout is connected to a terminal:

```go
import "golang.org/x/term"

if term.IsTerminal(int(os.Stdout.Fd())) {
    // Human at terminal → pretty output
} else {
    // Piped/redirected → TOON
}
```

Well-established pattern used by `ls` (colors), `git` (pager), `grep` (colors).

### Why This Works Perfectly for Agents

When an agent runs a command via Bash tool, stdout is a pipe (not TTY):

| Who | How | TTY? | Output |
|-----|-----|------|--------|
| Human in terminal | `tick ready` | Yes | Pretty table |
| Agent via Bash tool | `tick ready` | No | TOON |
| Human in script | `tick ready --pretty` | No | Pretty table |
| Anyone wanting JSON | `tick ready --json` | - | JSON |

Agents get TOON automatically without needing any flags. Simpler agent instructions.

### Decision

**Option C: Auto-detect TTY** with explicit override flags.

- No TTY (pipe/redirect) → TOON (default for agents)
- TTY (terminal) → Human-readable table
- `--toon` → Force TOON
- `--pretty` → Force human-readable
- `--json` → Force JSON

**Rationale**: Agents naturally execute via pipes, so they get TOON without remembering flags. Humans at terminals get readable output. Edge cases covered by explicit flags. This is how Unix has worked for decades - intuitive, not magic.

---

## Q2: Aliases vs Standalone Commands

### Options Considered

**Option A: Shell-level aliases**
- User sets up aliases in shell config
- Pro: Zero code in tick
- Con: Not portable, requires setup

**Option B: Subcommand aliases in tick**
- `tick ready` internally calls `tick list --ready`
- Pro: Works everywhere, single source of truth for query logic
- Con: Two ways to do the same thing

**Option C: Standalone commands**
- Separate implementation for each command
- Pro: Can optimize independently
- Con: Code duplication, divergence risk

**Option D: No aliases**
- Just use `tick list --ready`
- Pro: One way to do things
- Con: More typing for the most common operation

### Decision

**Option B: Subcommand aliases in tick.**

`tick ready` and `tick blocked` are built-in commands that internally delegate to `tick list` with the appropriate flag. No code duplication - they share the list command's query logic.

**Rationale**: `tick ready` is likely the most-used command (agents constantly checking what to work on next). It should be easy to type. But we don't want separate implementations that could diverge. Internal delegation gives us convenience without duplication.

---

## Q3: Dependency Management Pattern

### Options Considered

**Option A: `dep add/remove` only**
- Dedicated subcommand for all dependency operations
- Pro: Explicit, clear
- Con: Can't set deps at creation time

**Option B: `block/unblock`**
- Shorter command names
- Pro: Concise
- Con: "Block" sounds harsh, ambiguous which task is which

**Option C: Flags only (`--blocked-by`)**
- Set dependencies only at creation/edit time
- Pro: Natural flow when creating
- Con: Can't manage deps without editing task

**Option D: Hybrid (flags + dedicated command)**
- `--blocked-by` on create, `dep add/rm` for later
- Pro: Best of both worlds
- Con: Two ways to do similar things (but for different contexts)

### Argument Order Discussion

Two mental models for `dep add`:

1. **Task first, dependency second**: `tick dep add tick-c3d4 tick-a1b2` - "c3d4 depends on a1b2"
2. **Blocker first, blocked second**: `tick dep add tick-a1b2 tick-c3d4` - "a1b2 blocks c3d4"

**Chose Option 1** (task first) because:
- Matches the flag pattern: `tick create "X" --blocked-by Y` has subject first
- "I'm modifying task X" - the subject comes first
- Reads naturally: "Add to c3d4 a dependency on a1b2"

### Decision

**Option D: Hybrid approach.**

**At creation time:**
```bash
tick create "Login endpoint" --blocked-by tick-a1b2
tick create "Complex task" --blocked-by tick-a1b2,tick-x9y8  # comma-separated
```

**Later modifications:**
```bash
tick dep add tick-c3d4 tick-a1b2    # c3d4 now depends on a1b2
tick dep rm tick-c3d4 tick-a1b2     # remove that dependency
```

**Rationale**: Planning agents typically set dependencies at creation time - `--blocked-by` is natural there. Implementation agents may need to adjust dependencies as work progresses - `dep add/rm` handles that. Argument order (task first, dependency second) matches the flag pattern and reads naturally.

**Note on `dep`**: While `dep` looks truncated, `tick dep add` reads clearly in context. Alternatives (`link`, `needs`, `require`) were considered but didn't improve clarity.

---

## Q4: Error Handling & Feedback

### Exit Codes

**Options:**
- Simple: `0` = success, `1` = error
- Granular: Different codes for different error types (not found, invalid args, cycle detected, etc.)

**Decision**: Keep it simple. `0` for success, `1` for any error. Agents parse the error output for specifics - they don't need to memorize exit code meanings.

### Error Format

Errors go to stderr. Format follows the same TTY detection as regular output:

| Scenario | Stderr Format |
|----------|---------------|
| Human at terminal | Friendly message, possibly suggestions |
| Agent via pipe | Structured (TOON) with error code, message, context |
| With `--json` flag | JSON error object |

**Human example:**
```
Error: Task 'tick-xyz123' not found

Did you mean?
  tick-xyz124  Setup authentication
```

**Agent example (TOON):**
```
error{code,message,task_id}:
  not_found,Task 'tick-xyz123' not found,tick-xyz123
```

### Verbosity Levels

Standard flags:
- Default: Essential output only
- `--quiet` / `-q`: Suppress non-essential output (success messages, etc.)
- `--verbose` / `-v`: More detail (useful for debugging)

### Decision

- **Exit codes**: Simple `0`/`1`
- **Error format**: TTY-aware (human-readable vs structured), same pattern as regular output
- **Verbosity**: Standard `--quiet` and `--verbose` flags

**Rationale**: Exit codes signal success/failure; error output provides details. Following the same TTY detection pattern keeps the CLI consistent. Standard verbosity flags match user expectations.

---

## Q5: Bulk Operations for Planning Agents

### Options Considered

**Option A: Sequential creates**
- Use existing commands one at a time
- Pro: Simple, no new code
- Con: Many round-trips for large plans

**Option B: Bulk import from file**
- `tick import plan.jsonl`
- Pro: Single operation, atomic
- Con: Agent must write temp file first

**Option C: Stdin piping**
- `cat plan.jsonl | tick import -`
- Pro: No temp file
- Con: More complex

**Option D: No bulk - sequential is fine**
- Keep it simple
- Pro: Simpler codebase
- Con: May be slow for very large plans

### Decision

**Option A: Sequential creates for now.**

Planning agents use existing commands:
```bash
tick create "Epic: Auth" --type epic
tick create "Setup Sanctum" --parent tick-a1b2
tick create "Login endpoint" --blocked-by tick-c3d4
```

**Rationale**: YAGNI. For typical plans (10-50 tasks), sequential creates at <100ms each are fast enough. Once the data formats and command patterns are established and proven, bulk import can be added if needed. Start simple, add complexity only when pain is felt.

**Future consideration**: If bulk import is added later, `tick import` reading JSONL from stdin or file would be the natural pattern.

---

## Q6: Command Naming

### Verbs Considered

**Creating tasks:**
- `create` - explicit, self-contained ✓
- `add` - implies adding to something
- `new` - less verb-like

**Completing tasks:**
- `done` - casual, quick, implies success ✓
- `complete` - more formal
- `close` - generic, used by issue trackers

**Starting tasks:**
- `start` - clear, action-oriented ✓
- `begin` - alternative, same meaning
- `wip` - jargon-y

**Reopening tasks:**
- `reopen` - explicit, clear ✓
- `undo` - implies reversing last action (not quite right)

### Task Closure Discussion

`done` implies "completed successfully." But tasks can end for other reasons (cancelled, rejected, not needed, duplicate, wontfix).

**Options:**
- Option A: Just `done` for everything - loses "why" information
- Option B: `done` with `--reason` flag - "done --reason cancelled" feels odd
- Option C: Separate commands - `done` and `cancel` ✓
- Option D: Generic `close --as done|cancelled` - verbose for common case

**Decision**: Option C - separate commands.

- `tick done tick-abc` = completed successfully
- `tick cancel tick-abc` = not completed (covers: cancelled, rejected, not needed, duplicate, wontfix)

No need for more granularity. "Cancelled" covers all the non-success closure reasons.

### Backlog Discussion

"Backlog" is not a status - it's a priority level. The schema already has:
- Priority 0 = critical
- Priority 4 = backlog

So `tick create "Someday task" --priority 4` puts it in the backlog. No separate status needed.

### Decision

**Final command set:**

| Command | Action |
|---------|--------|
| `create` | Make a new task |
| `start` | Mark task in-progress |
| `done` | Mark task completed successfully |
| `cancel` | Mark task cancelled (not completed) |
| `reopen` | Reopen a closed task |

**Task statuses:**
- `open` - not started
- `in_progress` - being worked on
- `done` - completed successfully
- `cancelled` - closed without completion

**Rationale**: Short, clear verbs. `done` and `cancel` are distinct commands because they represent meaningfully different outcomes. Consistency matters - all verbs are simple, action-oriented words.

---

## Summary

### Key Decisions

1. **Output format**: Auto-detect TTY. Humans at terminal get pretty tables, agents via pipe get TOON. Override with `--toon`, `--pretty`, or `--json`.

2. **Aliases**: `tick ready` and `tick blocked` are built-in subcommand aliases that delegate to `tick list`. Single source of truth, convenient shorthand.

3. **Dependencies**: Hybrid approach. `--blocked-by` flag on create (comma-separated for multiple), `tick dep add/rm` for later modifications. Task first, dependency second.

4. **Error handling**: Simple exit codes (0/1), TTY-aware error format (human-friendly vs structured TOON), standard `--quiet`/`--verbose` flags.

5. **Bulk operations**: Sequential creates for now (YAGNI). Can add `tick import` later if needed.

6. **Command naming**: `create`, `start`, `done`, `cancel`, `reopen`. Four statuses: `open`, `in_progress`, `done`, `cancelled`.

### Final Command Reference

```bash
# Core lifecycle
tick create "Task title" [--type epic|task|bug|spike] [--priority 0-4] [--blocked-by id,id]
tick start <id>
tick done <id>
tick cancel <id>
tick reopen <id>

# Queries
tick list [--ready] [--blocked] [--status X] [--priority X]
tick ready          # alias for list --ready
tick blocked        # alias for list --blocked
tick show <id>

# Dependencies
tick dep add <task_id> <blocked_by_id>
tick dep rm <task_id> <blocked_by_id>

# Utilities
tick init
tick stats
tick doctor
tick archive
tick rebuild
```

### Output Format Flags (all commands)

- `--toon` - Force TOON output
- `--pretty` - Force human-readable output
- `--json` - Force JSON output
- `--quiet` / `-q` - Suppress non-essential output
- `--verbose` / `-v` - More detail

### Next Steps

This discussion is ready for specification. Key areas to specify:
- Exact TOON format for each command's output
- Human-readable table layouts
- Error codes and messages
- Flag interactions and precedence
