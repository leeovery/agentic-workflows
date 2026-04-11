---
topic: tick-core
status: concluded
type: feature
work_type: greenfield
date: 2026-02-09
sources:
  - name: project-fundamentals
    status: incorporated
  - name: data-schema-design
    status: incorporated
  - name: freshness-dual-write
    status: incorporated
  - name: id-format-implementation
    status: incorporated
  - name: hierarchy-dependency-model
    status: incorporated
  - name: cli-command-structure-ux
    status: incorporated
  - name: toon-output-format
    status: incorporated
  - name: tui
    status: incorporated
  - name: task-scoping-by-plan
    status: incorporated
---

# Specification: Tick Core

## Specification

### Vision & Scope

#### What is Tick?

**Tick** is a minimal, deterministic task tracker designed for AI coding agents.

Agents need to know "what should I work on next?" without ambiguity. Existing tools either require manual sync steps (easy to forget, causing data loss), add complexity through daemons and hooks (hard to manage, harder to uninstall), or rely on markdown parsing (non-deterministic, token-expensive at scale).

Tick solves this with a simple model: JSONL as the git-committed source of truth, SQLite as an auto-rebuilding local cache, and a CLI that always returns deterministic results. No sync commands. No daemons. No hooks. Just `tick ready` to get the next task.

**Tagline**: "A minimal, deterministic task tracker for AI coding agents"

#### Primary User

AI coding agents (Claude Code and similar), with humans able to use it directly for oversight and manual intervention.

#### Core Values

- **Minimal simplicity** - Fewer features done well
- **Deterministic queries** - Same input, same output, always
- **Zero sync friction** - No manual sync commands ever

#### Primary Workflow

```
1. PROJECT SETUP
   Human runs: tick init
   Result: .tick/ directory created

2. PLANNING PHASE
   Planning agent (or human) creates tasks:
   - tick create "Setup authentication" --priority 1
   - tick create "Login endpoint" --blocked-by tick-a1b2
   Result: tasks.jsonl populated with work items

3. IMPLEMENTATION LOOP
   Implementation agent (or human):
   a) tick ready        → "What can I work on?"
   b) tick start <id>   → "I'm working on this"
   c) [does the work]
   d) tick done <id>    → "I finished this"
   e) Repeat until tick ready returns nothing

4. PROJECT COMPLETE
   All tasks done. .tick/ can be deleted or kept for reference.
```

**Key principle**: Tick is workflow-agnostic. It's a tracker, not a workflow engine. It doesn't care who creates tasks, who works them, or when. It just answers: "What's ready?"

#### Explicit Non-Goals

| Non-goal | Rationale |
|----------|-----------|
| Archive strategy | YAGNI - single file sufficient for v1 |
| Config file | YAGNI - hardcoded defaults are fine |
| Windows support | Not a priority - macOS and Linux first |
| Multi-agent coordination | Out of scope - single-agent focused |
| Real-time sync | Git is the sync mechanism |
| GUI/web interface | CLI only - agent-first means no visual UI |
| Plugin/extension system | Keep it simple - no hooks, no customization |

#### Success Criteria for v1

| Criterion | Description |
|-----------|-------------|
| All commands implemented | Every command works as specified |
| Fully tested | Comprehensive test coverage |
| Zero sync friction | No manual sync commands ever needed |
| Deterministic queries | Same input = same output, always |
| Sub-100ms operations | Fast enough to not notice |
| Clean uninstall | `rm -rf .tick` removes everything |
| Survives cache deletion | Delete .cache, everything auto-rebuilds |
| Git-friendly | Clean diffs, rare merge conflicts |
| Dogfooded | Used on real projects |

### Overview

Tick uses a dual-storage architecture:

- **JSONL** (`tasks.jsonl`) - Source of truth, committed to git
- **SQLite** (`.tick/cache.db`) - Query cache, gitignored, auto-rebuilds

This design provides git-friendly storage (JSONL diffs cleanly, one line per task) with fast querying (SQLite for complex filters and joins).

**Key principle**: SQLite is a cache, not a peer. It can always be rebuilt from JSONL. Mismatches self-heal on next read.

### Task Schema

Each task has 10 fields:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | Yes | Generated | Unique identifier (see ID Generation) |
| `title` | string | Yes | - | Brief description of the task |
| `status` | enum | Yes | `open` | One of: `open`, `in_progress`, `done`, `cancelled` |
| `priority` | integer | Yes | `2` | 0 (highest) to 4 (lowest) |
| `description` | string | No | `""` | Extended details, markdown supported |
| `blocked_by` | array | No | `[]` | IDs of tasks that block this one |
| `parent` | string | No | `null` | ID of parent task (organizational grouping) |
| `created` | datetime | Yes | Now | ISO 8601 timestamp |
| `updated` | datetime | Yes | Now | ISO 8601 timestamp, updated on any change |
| `closed` | datetime | No | `null` | ISO 8601 timestamp, set when status becomes `done` or `cancelled` |

#### Field Constraints

- **status**: Only valid transitions enforced by commands (e.g., can't `start` a `done` task)
- **priority**: Integer 0-4 only; invalid values rejected
- **blocked_by**: Must reference existing task IDs; self-references rejected; cycles rejected at write time
- **parent**: Must reference existing task ID; self-references rejected

#### Title and Description Limits

- **title**:
  - Required, non-empty
  - Maximum 500 characters
  - No newlines (single line only)
  - Leading/trailing whitespace trimmed

- **description**:
  - Optional
  - No maximum length
  - Newlines and markdown allowed

#### Timestamp Format

All timestamps (`created`, `updated`, `closed`) use ISO 8601 format in UTC:
- Format: `YYYY-MM-DDTHH:MM:SSZ`
- Example: `2026-01-19T10:00:00Z`
- Always UTC (Z suffix), never local time with offset

#### Hierarchy Semantics

- **Parent/child is organizational** - A parent groups related tasks but does not block them
- **blocked_by controls workflow** - A task cannot be worked until its blockers are resolved
- **Cancelled tasks unblock dependents** - When a task is cancelled, tasks blocked by it become unblocked

### ID Generation

#### Format

Task IDs follow the pattern: `{prefix}-{6 hex chars}`

- **Prefix**: `tick` (hardcoded, no configuration)
- **Random part**: 6 lowercase hexadecimal characters (e.g., `a3f2b7`)
- **Example**: `tick-a3f2b7`

#### Generation

- Use `crypto/rand` from Go stdlib (3 random bytes → 6 hex characters)
- Provides 16.7 million possible IDs (2^24)
- Cryptographically secure, no seeding required

#### Collision Handling

- On collision: retry silently up to 5 times
- If still colliding after 5 retries: return error
- Collisions are practically impossible at expected scale (hundreds to low thousands of tasks)

**Collision error message:**
```
Error: Failed to generate unique ID after 5 attempts - task list may be too large
```

#### Case Sensitivity

- IDs are case-insensitive for matching
- Normalize to lowercase on input (user can type `TICK-A3F2B7`, stored as `tick-a3f2b7`)
- Always output lowercase

### File Locations & Formats

#### Directory Structure

```
.tick/
├── tasks.jsonl      # Source of truth (git tracked)
├── cache.db         # SQLite cache (gitignored)
└── lock             # Lock file for concurrent access
```

#### JSONL Format

One JSON object per line, no trailing commas, no array wrapper:

```jsonl
{"id":"tick-a1b2","title":"Task title","status":"open","priority":2,"created":"2026-01-19T10:00:00Z","updated":"2026-01-19T10:00:00Z"}
{"id":"tick-c3d4","title":"With all fields","status":"in_progress","priority":1,"description":"Details here","blocked_by":["tick-a1b2"],"parent":"tick-e5f6","created":"2026-01-19T10:00:00Z","updated":"2026-01-19T14:00:00Z"}
{"id":"tick-g7h8","title":"Completed task","status":"done","priority":1,"created":"2026-01-19T10:00:00Z","updated":"2026-01-19T16:00:00Z","closed":"2026-01-19T16:00:00Z"}
```

- Optional fields omitted when empty/null (not serialized as `null`)
- `updated` always present (set to `created` value initially)

#### SQLite Schema

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority INTEGER NOT NULL DEFAULT 2,
  description TEXT,
  parent TEXT,
  created TEXT NOT NULL,
  updated TEXT NOT NULL,
  closed TEXT
);

CREATE TABLE dependencies (
  task_id TEXT NOT NULL,
  blocked_by TEXT NOT NULL,
  PRIMARY KEY (task_id, blocked_by)
);

CREATE TABLE metadata (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_parent ON tasks(parent);
```

- `tasks` table mirrors JSONL fields (minus `blocked_by` which is normalized)
- `dependencies` table enables efficient joins for "ready" queries
- `metadata` table stores the JSONL content hash for freshness detection (key: `jsonl_hash`)

### Synchronization

#### Freshness Detection

SHA256 hash-based comparison:

1. On every operation, read `tasks.jsonl` into memory
2. Compute SHA256 hash of file contents
3. Compare with hash stored in SQLite `metadata` table (key: `jsonl_hash`)
4. If mismatch: rebuild SQLite from JSONL data already in memory (no double-read)

**Trade-off accepted**: Always read full file on every operation. Acceptable for expected file sizes (<1MB, <10ms).

#### Cache Rebuild Triggers

Rebuild SQLite from JSONL when:

1. **Hash mismatch** - Primary case; JSONL was modified externally (e.g., git pull, manual edit)
2. **SQLite file missing** - Hash lookup fails; rebuild from scratch
3. **SQLite query errors** - Delete corrupted cache and rebuild
4. **Explicit command** - `tick rebuild` forces rebuild

The freshness check is the gatekeeper. Everything else is error recovery.

### Write Operations

#### Mutation Flow

All mutations (create, update, delete) follow this sequence:

1. Acquire exclusive lock on `.tick/lock` file
2. Read `tasks.jsonl`, compute hash, check freshness (rebuild if stale)
3. Apply mutation in memory
4. Write complete new content to temp file
5. `fsync` temp file (flush to disk)
6. `os.Rename(temp, tasks.jsonl)` - atomic on POSIX
7. Update SQLite in single transaction: apply mutation + store new hash
8. Release lock

#### Atomic Rewrite Pattern

Always use full file rewrite for all operations (no append-only mode):

- **Why**: Atomic rename guarantees complete file or no change; append can leave incomplete lines
- **How**: Write to temp file → fsync → rename
- **Performance**: ~500 tasks × ~200 bytes = 100KB; trivially fast

#### Partial Failure Handling

**JSONL-first, SQLite is expendable**:

- If JSONL write succeeds but SQLite fails: log warning, continue
- Next read will detect hash mismatch and rebuild SQLite automatically
- Trade-off accepted: SQLite failure costs one rebuild on next read

The hash update is part of the same SQLite transaction as the data update:
```sql
BEGIN;
INSERT INTO tasks (...) VALUES (...);
UPDATE metadata SET jsonl_hash = 'new_hash';
COMMIT;
```

#### File Locking

Use `github.com/gofrs/flock` for file locking:

- **Write operations**: Exclusive lock (blocks other readers and writers)
- **Lock file**: `.tick/lock` (separate from data files)
- Prevents concurrent access corruption (learned from Taskwarrior issues)

#### Lock Timeout

- **Timeout**: 5 seconds default
- **On timeout**: Return error, do not proceed with operation

**Lock error message:**
```
Error: Could not acquire lock on .tick/lock - another process may be using tick
```

If lock is held for extended periods (e.g., crashed process), user can manually delete `.tick/lock` file.

### Read Operations

#### Query Flow

All read operations (list, show, ready, etc.) follow this sequence:

1. Acquire shared lock on `.tick/lock` file (allows concurrent reads)
2. Read `tasks.jsonl`, compute hash, check freshness
3. If stale: rebuild SQLite from JSONL data already in memory
4. Query SQLite for requested data
5. Release lock

#### Shared Locking

- **Read operations**: Shared lock (allows other readers, blocks writers)
- Multiple concurrent reads are safe
- A pending write will wait for all readers to finish

### Hierarchy & Dependency Model

Tick has two distinct relationship types:

- **Hierarchy** (`parent` field): "This task is part of a larger thing" - organizational grouping
- **Dependencies** (`blocked_by` array): "This task can't start until these are done" - workflow sequencing

#### Ready Query Logic

A task is "ready" (workable) only when ALL conditions are met:

1. Status is `open`
2. All `blocked_by` tasks are closed (`done` or `cancelled`)
3. Has no open children (no tasks where `parent` = this task AND status is `open` or `in_progress`)

**The leaf-only rule:**

| Condition | Appears in ready? |
|-----------|-------------------|
| No children (leaf task) | Yes, when unblocked |
| Has open children | No - children are the work |
| All children closed | Yes - becomes a leaf |

**Example:**
```
Auth System (tick-a1b2) - has children → NOT ready
├── Setup Sanctum (tick-c3d4) - done → NOT ready
├── Login endpoint (tick-e5f6) - open, unblocked, no children → READY
└── Logout endpoint (tick-k1l2, blocked_by tick-e5f6) - blocked → NOT ready
```

When Login and Logout are done, Auth System appears in ready (now a "leaf" with no open children). Agent can verify the epic is complete and mark it done.

#### Dependency Validation Rules

| Scenario | Allowed | Reason |
|----------|---------|--------|
| Child blocked_by parent | **No** | Creates deadlock with leaf-only rule |
| Parent blocked_by child | Yes | Valid "do children first" workflow |
| Sibling dependencies | Yes | Normal sequencing within an epic |
| Cross-hierarchy dependencies | Yes | Normal dependency behavior |
| Circular dependencies | **No** | Cycle detection catches these |

**Validation timing**: Validate when adding/modifying `blocked_by` - reject invalid dependencies at write time, before persisting to JSONL.

**Error messages:**
```
Error: Cannot add dependency - tick-child cannot be blocked by its parent tick-epic
       (would create unworkable task due to leaf-only ready rule)

Error: Cannot add dependency - creates cycle: tick-a → tick-b → tick-c → tick-a
```

#### Parent Context in Output

When displaying a task that has a parent (e.g., `tick show`):

- Include parent ID + title (not full description)
- Agent can `tick show <parent_id>` for full context if needed
- Tasks should be self-contained; parent context is a safety net, not required

#### Edge Cases

**Deep nesting**: No depth limit. The leaf-only rule handles naturally - only the deepest incomplete tasks appear in ready.

**Orphaned children** (parent reference points to non-existent task):
- Task remains valid, treated as root-level task
- `tick doctor` flags: "tick-child references non-existent parent tick-deleted"
- No auto-fix - human/agent decides whether to remove parent reference

**Parent done before children**:
- Valid state - children remain workable
- May indicate planning issue, but not enforced by tool
- `tick doctor` warns: "tick-epic is done but has open children"

### CLI Commands

#### Command Reference

| Command | Action |
|---------|--------|
| `tick init` | Initialize .tick/ directory in current project |
| `tick create "<title>"` | Create a new task |
| `tick update <id>` | Update task fields |
| `tick start <id>` | Mark task as in-progress |
| `tick done <id>` | Mark task as completed successfully |
| `tick cancel <id>` | Mark task as cancelled (not completed) |
| `tick reopen <id>` | Reopen a closed task |
| `tick list` | List tasks with optional filters |
| `tick show <id>` | Show detailed task information |
| `tick ready` | Alias for `list --ready` - show workable tasks |
| `tick blocked` | Alias for `list --blocked` - show blocked tasks |
| `tick dep add <task_id> <blocked_by_id>` | Add dependency (task depends on blocked_by) |
| `tick dep rm <task_id> <blocked_by_id>` | Remove dependency |
| `tick stats` | Show task statistics |
| `tick doctor` | Run diagnostics and validation |
| `tick rebuild` | Force rebuild SQLite cache from JSONL |

#### Init Command

`tick init` creates the `.tick/` directory structure:
- Creates `.tick/` directory
- Creates empty `tasks.jsonl` file
- SQLite cache is created on first operation (not at init)

**If `.tick/` already exists**: Error with message "Tick already initialized in this directory"

**Output**: Confirmation message showing path initialized.

#### Create Command Options

```bash
tick create "<title>" [options]

Options:
  --priority <0-4>           Priority level (default: 2)
  --blocked-by <id,id,...>   Comma-separated dependency IDs
  --blocks <id,id,...>       Tasks this task blocks (updates their blocked_by)
  --parent <id>              Parent task ID
  --description "<text>"     Extended description
```

#### Update Command

```bash
tick update <id> [options]

Options:
  --title "<text>"           New title
  --description "<text>"     New description (use "" to clear)
  --priority <0-4>           New priority level
  --parent <id>              New parent task (use "" to clear)
  --blocks <id,id,...>       Tasks this task blocks (updates their blocked_by)
```

At least one option required. Cannot change `id`, `status`, `created`, or `blocked_by` (use dedicated commands for those).

**Note on `--blocks`**: This is the inverse of `--blocked-by`. Setting `--blocks tick-abc` on task T adds T to tick-abc's `blocked_by` array. The data model remains unchanged - only `blocked_by` is stored.

**Output**: Full task details (same format as `tick show`), TTY-aware.

#### List Command Options

```bash
tick list [options]

Options:
  --ready        Show only ready tasks (unblocked, no open children)
  --blocked      Show only blocked tasks
  --status <s>   Filter by status (open, in_progress, done, cancelled)
  --priority <p> Filter by priority (0-4)
  --parent <id>  Scope to descendants of this task (recursive)
```

The `--parent` flag also applies to `tick ready` and `tick blocked` since they are aliases for `tick list --ready` and `tick list --blocked` respectively.

#### Blocked Query Logic

A task appears in `tick blocked` when:
- Status is `open`
- AND either:
  - Has at least one `blocked_by` task that is not closed (`done` or `cancelled`), OR
  - Has at least one open child (status `open` or `in_progress`)

In other words: `blocked` = open tasks that are not `ready`.

#### Parent Scoping

The `--parent <id>` flag restricts queries to descendants of the specified task. This enables plan-level scoping — create a top-level parent task per plan, add plan tasks as children, then filter queries to that subtree.

**Behavior:**
- Collects all descendants of the specified parent (recursive, not just direct children)
- Applies existing filters (ready, blocked, status, priority) within that set
- The parent task itself is excluded from results naturally (it has open children, so the leaf-only rule filters it out)

**`--parent` is a pre-filter**: It narrows which tasks are considered. The leaf-only and blocked-by rules are post-filters that determine which of those are workable. They compose cleanly with no special cases.

**Example:**
```
Plan: Auth System (tick-p1a2)
├── Login endpoint (tick-e5f6)
│   ├── Validation (tick-g7h8)      ← leaf
│   └── Rate limiting (tick-i9j0)   ← leaf
└── Logout endpoint (tick-k1l2)     ← leaf
```

```bash
tick ready --parent tick-p1a2    # returns tick-g7h8, tick-i9j0, tick-k1l2
tick ready --parent tick-e5f6    # returns tick-g7h8, tick-i9j0
tick ready                       # all ready tasks across all plans
```

**Implementation**: Recursive CTE in SQLite to collect all descendant IDs, then apply existing query filters within that set.

#### Dependency Management

**At creation time:**
```bash
tick create "Login endpoint" --blocked-by tick-a1b2
tick create "Complex task" --blocked-by tick-a1b2,tick-x9y8
```

**Later modifications:**
```bash
tick dep add tick-c3d4 tick-a1b2    # c3d4 now depends on a1b2
tick dep rm tick-c3d4 tick-a1b2     # remove that dependency
```

**Argument order**: Task first, dependency second. Matches the `--blocked-by` flag pattern and reads naturally: "Add to c3d4 a dependency on a1b2."

#### Task Statuses

| Status | Meaning |
|--------|---------|
| `open` | Not started |
| `in_progress` | Being worked on |
| `done` | Completed successfully |
| `cancelled` | Closed without completion |

#### Status Transitions

| Command | From Status | To Status |
|---------|-------------|-----------|
| `start` | `open` | `in_progress` |
| `done` | `open`, `in_progress` | `done` |
| `cancel` | `open`, `in_progress` | `cancelled` |
| `reopen` | `done`, `cancelled` | `open` |

Invalid transitions return an error (e.g., `tick start` on a `done` task).

Note: `reopen` also clears the `closed` timestamp.

#### Error Handling

**Exit codes:**
- `0` = success
- `1` = any error

Agents parse error output for specifics; they don't need to memorize exit code meanings.

**Error output:**
- All errors go to stderr
- Plain text format (human-readable)
- Non-zero exit code signals failure

**Example:**
```
$ tick show tick-xyz
Error: Task 'tick-xyz' not found
$ echo $?
1
```

#### Verbosity Flags

| Flag | Effect |
|------|--------|
| `--quiet` / `-q` | Suppress non-essential output |
| `--verbose` / `-v` | More detail (useful for debugging) |

#### Rebuild Command

`tick rebuild` forces a complete rebuild of the SQLite cache from JSONL, bypassing the freshness check. Use when:
- SQLite appears corrupted
- Debugging cache issues
- After manual JSONL edits (though freshness check should handle this automatically)

Output: Confirmation message showing tasks rebuilt.

#### Mutation Command Output

**`tick create`**: Outputs full task details (same format as `tick show`), TTY-aware.
- With `--quiet`: Outputs only the task ID

**`tick update`**: Outputs full task details (same format as `tick show`), TTY-aware.
- With `--quiet`: Outputs only the task ID

**`tick start/done/cancel/reopen`**: Outputs task ID and status transition
```
tick-a3f2b7: open → in_progress
```
- With `--quiet`: No output

**`tick dep add/rm`**: Outputs confirmation
```
Dependency added: tick-c3d4 blocked by tick-a1b2
Dependency removed: tick-c3d4 no longer blocked by tick-a1b2
```
- With `--quiet`: No output

### Output Formats

#### Format Selection (TTY Detection)

Output format is determined automatically based on whether stdout is a terminal:

| Condition | Output Format |
|-----------|---------------|
| No TTY (pipe/redirect) | TOON (default for agents) |
| TTY (terminal) | Human-readable table |
| `--toon` flag | Force TOON |
| `--pretty` flag | Force human-readable |
| `--json` flag | Force JSON |

**Why this works**: When agents run commands via Bash tool, stdout is a pipe (not TTY). Agents get TOON automatically without flags. Humans at terminals get readable output naturally.

This is a well-established Unix pattern used by `ls` (colors), `git` (pager), `grep` (colors).

#### TOON Format (Agent Output)

TOON (Token-Oriented Object Notation) is optimized for AI agent consumption - 30-60% token savings over JSON while improving parsing accuracy.

**Structure**: Multi-section approach for complex data. Each section has its own schema header.

**Example - `tick list` output:**
```
tasks[2]{id,title,status,priority}:
  tick-a1b2,Setup Sanctum,done,1
  tick-c3d4,Login endpoint,open,1
```

**Example - `tick show` output:**
```
task{id,title,status,priority,parent,created,updated}:
  tick-a1b2,Setup Sanctum,in_progress,1,tick-e5f6,2026-01-19T10:00:00Z,2026-01-19T14:30:00Z

blocked_by[2]{id,title,status}:
  tick-c3d4,Database migrations,done
  tick-g7h8,Config setup,in_progress

children[0]{id,title,status}:

description:
  Full task description here.
  Can be multiple lines.
```

**Example - `tick stats` output:**
```
stats{total,open,in_progress,done,cancelled,ready,blocked}:
  47,12,3,28,4,8,4

by_priority[5]{priority,count}:
  0,2
  1,8
  2,25
  3,7
  4,5
```

**Principles:**
1. Each section has its own schema header - self-documenting
2. Related entities include context (title, status), not just IDs
3. Long text fields get their own unstructured sections
4. Empty arrays shown with zero count: `blocked_by[0]{id,title,status}:`
5. Sections omitted only if the field doesn't exist (vs empty)

**Empty results:**
```
tasks[0]{id,title,status,priority}:
```
Zero count with schema header, no data rows.

#### Human-Readable Format (Terminal Output)

Simple aligned columns. No borders, no colors, no icons. Raw `fmt.Print` output.

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
Created:  2026-01-19T10:00:00Z

Blocked by:
  tick-a1b2  Setup Sanctum (done)

Description:
  Implement the login endpoint with validation...
```

**Stats output:**
```
Total:       47

Status:
  Open:        12
  In Progress:  3
  Done:        28
  Cancelled:    4

Workflow:
  Ready:        8
  Blocked:      4

Priority:
  P0 (critical):  2
  P1 (high):      8
  P2 (medium):   25
  P3 (low):       7
  P4 (backlog):   5
```

**Design philosophy**: Minimalist and clean. Human output is secondary to agent output - no TUI libraries, no interactivity.

**Empty results:**
```
No tasks found.
```
Simple message, no headers.

#### JSON Format

Available via `--json` flag for compatibility and debugging. Standard JSON output.

## Dependencies

Prerequisites that must exist before implementation can begin:

### Required

None. This is the foundational data layer that other specifications depend on.

### External Libraries

| Library | Purpose |
|---------|---------|
| `github.com/gofrs/flock` | File locking for concurrent access safety |
| `github.com/mattn/go-sqlite3` | SQLite driver for Go |
| `github.com/toon-format/toon-go` | TOON encoding/decoding for agent output (handles escaping per TOON spec §7.1) |

### Optional Libraries

| Library | Purpose |
|---------|---------|
| `github.com/natefinch/atomic` | Atomic file writes (alternative to hand-rolling with `os.Rename`) |

### Notes

- All other dependencies are Go stdlib (`crypto/rand`, `os`, `encoding/json`, `crypto/sha256`)
- This specification can be implemented independently before CLI or workflow features
- Optional libraries will be assessed at implementation for reliability, maintenance, and community support
