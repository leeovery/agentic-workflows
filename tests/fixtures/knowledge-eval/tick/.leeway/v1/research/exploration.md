# Tick Research Exploration

## What We're Exploring

**Tick** - A minimal, deterministic task tracker for AI coding agents.

Core thesis: Existing tools (Beads, br, Backlog.md) are either too complex or lack deterministic querying. Tick aims for zero-friction git integration with JSONL as source of truth and SQLite as auto-rebuilding cache.

---

## Foundational Context (from initial design)

### Problem Statement

**Why not Beads?**
- SQLite + JSONL + Git sync (three layers)
- Background daemons for auto-sync
- Git hooks (pre-commit, post-merge, pre-push, post-checkout)
- Auto-commits that can conflict with deployment pipelines
- 730-line uninstall script required for full removal

**Why not br (beads_rust)?**
- Cleaner but still requires manual sync
- `br sync --flush-only` after changes (easy to forget)
- `br sync --import-only` after git pull (easy to forget)
- Forgetting to sync = data inconsistency or loss

**Why not Backlog.md?**
- Markdown files without structured querying
- Relies on agents parsing natural language
- No deterministic "what's ready?" query
- Agents can miss things in large task lists

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Agent (Claude, etc.)                                   │
│  - Calls: tick ready --json                             │
│  - Receives: Deterministic structured data              │
│  - Never reads raw files                                │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  CLI (tick / tk)                                        │
│  - Reads: Checks cache freshness                        │
│  - Rebuilds: If JSONL changed since last index          │
│  - Queries: SQLite for deterministic results            │
│  - Writes: Updates JSONL + SQLite together              │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
┌──────────────────┐          ┌──────────────────┐
│  tasks.jsonl     │          │  .cache/tick.db  │
│  (committed)     │  ──────► │  (gitignored)    │
│  Source of truth │  rebuild │  Ephemeral cache │
└──────────────────┘          └──────────────────┘
```

### Proposed Data Structures

**JSONL Format** (`.tick/tasks.jsonl`):
```jsonl
{"id":"tick-a1b2","title":"Setup Laravel Sanctum","status":"done","priority":1,"type":"task","created":"2025-01-19T10:00:00Z","closed":"2025-01-19T14:30:00Z"}
{"id":"tick-c3d4","title":"Implement login endpoint","status":"open","priority":1,"type":"task","blocked_by":["tick-a1b2"],"parent":"tick-e5f6","created":"2025-01-19T10:05:00Z"}
{"id":"tick-e5f6","title":"Authentication System","status":"open","priority":1,"type":"epic","created":"2025-01-19T09:00:00Z"}
```

**Task Schema** (proposed):
```
id: string              # tick-a1b2c3 (prefix + hash)
title: string
status: "open" | "in_progress" | "done"
priority: 0 | 1 | 2 | 3 | 4  # 0=critical, 4=backlog
type: "epic" | "task" | "bug" | "spike"

# Optional
description?: string
blocked_by?: string[]   # Task IDs this is blocked by
parent?: string         # Parent task ID (hierarchy)
assignee?: string
labels?: string[]
created: string         # ISO 8601
updated?: string
closed?: string
notes?: string          # Free-form context for agents
```

**SQLite Schema** (proposed):
```sql
-- Metadata for freshness checking
CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Main task table
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority INTEGER NOT NULL DEFAULT 2,
  type TEXT NOT NULL DEFAULT 'task',
  description TEXT,
  parent TEXT,
  assignee TEXT,
  labels TEXT,  -- JSON array
  created TEXT NOT NULL,
  updated TEXT,
  closed TEXT,
  notes TEXT
);

-- Dependencies (many-to-many)
CREATE TABLE dependencies (
  task_id TEXT NOT NULL,
  blocked_by TEXT NOT NULL,
  PRIMARY KEY (task_id, blocked_by)
);

-- Indexes for common queries
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_parent ON tasks(parent);

-- View for "ready" tasks (open, not blocked)
CREATE VIEW ready_tasks AS
SELECT t.* FROM tasks t
WHERE t.status = 'open'
  AND t.id NOT IN (
    SELECT d.task_id FROM dependencies d
    JOIN tasks blocker ON d.blocked_by = blocker.id
    WHERE blocker.status != 'done'
  )
ORDER BY t.priority ASC, t.created ASC;
```

**Directory Structure**:
```
.tick/
├── config              # Project settings (key = value)
├── tasks.jsonl         # Committed - source of truth
├── archive.jsonl       # Archived done tasks (optional)
└── .cache/
    └── tick.db         # Gitignored - query cache
```

### Technical Implementation Notes

**Freshness check**:
```
On any read operation:
  1. Get JSONL file hash (or mtime)
  2. Compare to stored hash in SQLite metadata
  3. If different: rebuild entire index
  4. Then: execute query
```

**Dual write on mutations**:
```
tick create "New task"
  → Append line to tasks.jsonl
  → Insert row to SQLite
  → Update hash in SQLite metadata
```

**Atomic file writes**:
- Write to temp file
- fsync
- Rename to target (atomic on POSIX)

**JSONL update strategy**: Rewrite entire file for updates (simple, works for hundreds of tasks, <10ms for <1MB file).

### Proposed CLI Commands

**Core**:
- `tick init` - Initialize .tick directory
- `tick create <title>` - Create new task
- `tick list` - List tasks with filters
- `tick show <id>` - Show task detail
- `tick start <id>` - Mark in_progress
- `tick done <id>` - Mark complete
- `tick reopen <id>` - Reopen closed task

**Aliases**:
- `tick ready` - Alias for `tick list --ready`
- `tick blocked` - Alias for `tick list --blocked`

**Dependencies**:
- `tick dep add <id> <blocked_by>`
- `tick dep remove <id> <blocked_by>`

**Utilities**:
- `tick stats` - Project statistics
- `tick doctor` - Check for issues (orphans, cycles)
- `tick archive` - Move done tasks to archive
- `tick rebuild` - Force cache rebuild

**Global flags**: `--json`, `--plain`, `--quiet`, `--verbose`, `--include-archived`

**Short alias**: All commands work with `tk` as well as `tick`.

### Success Criteria

1. **Zero sync friction** - No manual sync commands ever
2. **Deterministic queries** - Same input = same output, always
3. **Sub-100ms operations** - Fast enough to not notice
4. **Clean uninstall** - `rm -rf .tick` and it's gone
5. **Survives cache deletion** - Delete .cache, everything rebuilds
6. **Git-friendly** - Clean diffs, rare conflicts

### Agent Instructions Concept (AGENTS.md)

For inclusion in projects using tick:
```
1. Never read .tick/tasks.jsonl directly - Use CLI commands
2. Always use --json flag - Parse structured output
3. Check ready tasks first - tick ready --json
4. Update status when starting - tick start <id>
5. Add notes when completing - tick done <id> --notes "What was done"
```

---

## Key Architecture Decisions (Already Made)

1. **JSONL as source of truth** - Committed, human-readable, git-friendly diffs
2. **SQLite as disposable cache** - Auto-rebuilds from JSONL on staleness
3. **Dual write on mutations** - No sync commands ever
4. **No hooks, no daemons** - Just a CLI
5. **Single-agent focus** - Multi-agent is explicitly out of scope

## Open Questions to Explore

1. **ID format** - Sequential (`TICK-001`) vs hash-based (`tick-abc123`)?
2. **Subtasks** - Flat with parent reference vs nested structure?
3. **Archive strategy** - Separate file for done tasks vs keep in main?
4. **Config file** - Worth the complexity?
5. **Language choice** - Rust vs Go (or others)?

## Research Sessions

### Session 1 - 2026-01-19

**Starting context**: Comprehensive design document provided with architecture, schemas, CLI commands, and implementation plan.

---

#### Primary User & Use Case

**Q: Who is the primary user?**

**A:** AI coding agents (Claude Code specifically), with human oversight. Not a general-purpose task tracker.

**Key insights:**

1. **Agent-first design** - Built for agents to consume, no UI planned. Humans can use it but it's optimized for agent workflows.

2. **Two-agent workflow pattern**:
   - **Planning agent**: Takes specification → creates tasks, phases, epics with full dependency graph
   - **Implementation agent**: Queries tick to find next task, gets context needed to execute

3. **Integration context**: Part of a broader "Claude workflow package" with multiple planning phases. Tick replaces existing output formats (beads, linings, markdown systems) that all have issues.

4. **Collaboration tool**: Enables user-agent collaboration on structured work. User provides oversight, agent executes against deterministic task queries.

5. **The real pain**: Current tools either require manual sync (easy to forget → data loss), are too complex (hooks, daemons), or lack deterministic querying (agents parsing markdown can miss things).

---

#### Integration Context: Claude Technical Workflows

**Q: How does tick fit into the existing workflow package?**

**A:** Tick becomes a new output format for the planning phase, replacing/complementing existing options.

**Current output formats** (from [claude-technical-workflows](https://github.com/leeovery/claude-technical-workflows)):

| Format | Storage | Query Method | Issues |
|--------|---------|--------------|--------|
| **Local Markdown** | Single `.md` file | Parse markdown | No deterministic "what's ready?" query |
| **Beads** | JSONL + SQLite + daemon | `bd ready` | Complex - daemon, sync, hooks |
| **Backlog.md** | Individual `.md` files | MCP or parse files | Requires MCP or markdown parsing |
| **Linear** | External service | API/MCP | External dependency |

**What Tick offers**:
- Deterministic `tick ready` query (like Beads)
- Simple JSONL storage (like Beads)
- No daemon, no sync, no hooks (unlike Beads)
- No markdown parsing required (unlike Local Markdown, Backlog.md)

**Workflow integration point**:
```
Specification → Planning Agent → tick create (tasks, deps, epics)
                                      ↓
Implementation Agent → tick ready → execute task → tick done
```

The planning skill would get a new `output-tick.md` adapter alongside the existing formats.

---

#### Decision: ID Format

**Q: Sequential (`TICK-001`) vs hash-based (`tick-abc123`)?**

**A:** Hash-based with customizable prefix.

**Decision**: `{prefix}-{hash}` format (e.g., `tick-a3f2b7`, `auth-c1d9e4`)

**Rationale**:
- No merge conflicts - IDs are globally unique without coordination
- Prefix is customizable at `tick init` time (default: `tick`)
- Still readable and referenceable in conversation

**Open implementation detail**: Hash length and source (random? content-based?). Short enough to type, long enough to avoid collisions. 6-8 chars seems reasonable for project-scale uniqueness.

---

#### Decision: Hierarchy vs Dependencies

**Q: Subtasks - flat with parent reference vs nested structure?**

**A:** Flat with `parent` field. Infinite depth possible. Separate from dependencies.

**Two distinct concepts**:

| Concept | Field | Meaning |
|---------|-------|---------|
| **Hierarchy** | `parent: string` | "I am part of this larger thing" (decomposition) |
| **Dependency** | `blocked_by: string[]` | "I can't start until these are done" (sequencing) |

**Example**:
```
Epic: Auth System (tick-a1b2)
├── Task: Setup Sanctum (tick-c3d4, parent=tick-a1b2)
├── Task: Login endpoint (tick-e5f6, parent=tick-a1b2, blocked_by=[tick-c3d4])
│     ├── Subtask: Validation (tick-g7h8, parent=tick-e5f6)
│     └── Subtask: Rate limiting (tick-i9j0, parent=tick-e5f6)
└── Task: Logout endpoint (tick-k1l2, parent=tick-a1b2, blocked_by=[tick-e5f6])
```

**Key decisions**:
1. **Infinite depth** - Tasks can have children, which can have children
2. **Explicit completion** - Parent doesn't auto-complete when children done. Manual `tick done`.
3. **Organization, not enforcement** - Hierarchy helps organize work, doesn't constrain it

**Queries are simple**:
```sql
-- Get children of a task
SELECT * FROM tasks WHERE parent = ?;

-- Get dependencies
SELECT blocked_by FROM dependencies WHERE task_id = ?;
```

---

#### Decision: Archive Strategy

**Q: Separate file for done tasks vs keep in main?**

**A:** Keep in main by default. Optional `tick archive` command for manual archiving.

**Behavior**:

| State | Files | What's indexed |
|-------|-------|----------------|
| **Default** | `tasks.jsonl` only | All tasks (including done) |
| **After archive** | `tasks.jsonl` + `archive.jsonl` | Only `tasks.jsonl` by default |
| **With flag** | Both files | Both files (`--include-archived`) |

**Commands**:
```bash
# Archive all done tasks
tick archive

# Search including archived
tick list --include-archived
tick show tick-a1b2 --include-archived
```

**Rationale**:
- Simple by default (one file, everything visible)
- Archiving is opt-in when file gets large
- Archived tasks don't slow down daily queries
- But history is searchable when needed

**File structure after archive**:
```
.tick/
├── tasks.jsonl      # Active tasks
├── archive.jsonl    # Archived (done) tasks
└── .cache/
    └── tick.db      # Only indexes tasks.jsonl by default
```

---

#### Decision: Config File

**Q: Config file - worth the complexity?**

**A:** Yes. Flat key-value format, created during `tick init`.

**Format**: Properties-style (flat `key = value`)
```
prefix = tick
default_priority = 2
```

**Why this format**:
- No nesting, no schema, no compatibility concerns
- Easy to parse: read lines, split on `=`, trim whitespace
- Missing keys → hardcoded defaults
- Extensible: new options can be added without breaking existing configs

**File**: `.tick/config`

**Initial options**:
- `prefix` - ID prefix (default: `tick`)

**Future options** (as needs emerge):
- `default_priority` - Priority for new tasks
- `auto_archive_after_days` - Auto-archive threshold
- Others TBD

**Parsing logic**:
```
1. Read .tick/config if exists
2. Parse key = value pairs
3. Merge with hardcoded defaults
4. Use merged config
```

---

#### Decision: Language & Database

**Q: Rust vs Go (or others)?**

**A:** Go with `modernc.org/sqlite` (pure Go SQLite).

**Why Go**:
- Single static binary (no runtime dependencies)
- Gentle learning curve (approachable from TypeScript background)
- Fast development cycle
- Excellent Claude assistance (lots of training data)
- Simple cross-compilation (`GOOS=linux go build`)

**Why `modernc.org/sqlite`**:
- Pure Go - no CGO, no C compiler needed
- Truly static binary
- Cross-compiles trivially
- Fast enough for tick's use case (sub-100ms operations)

**Why SQLite over key-value stores** (bbolt, Badger, etc.):
- Tick's data is relational (tasks + dependencies = joins)
- The `tick ready` query is naturally expressed in SQL
- Key-value stores would require manual index management and query logic in code

**Alternatives considered**:
| Option | Verdict |
|--------|---------|
| Rust | Steeper learning curve, longer time to prototype |
| Python | Runtime dependency, larger binary |
| bbolt/Badger | Key-value not ideal for relational queries |

---

#### Exploration: Output Format (TOON vs JSON)

**Q: Should output default to JSON or a more token-efficient format?**

**Context**: [TOON (Token-Oriented Object Notation)](https://github.com/toon-format/toon) is a format designed for LLM consumption that achieves 30-60% token savings over JSON while actually improving parsing accuracy (73.9% vs 69.7% in benchmarks).

**JSON output**:
```json
[
  {"id": "tick-a1b2", "title": "Setup Sanctum", "status": "done", "priority": 1},
  {"id": "tick-c3d4", "title": "Login endpoint", "status": "open", "priority": 1}
]
```

**TOON output**:
```
tasks[2]{id,title,status,priority}:
  tick-a1b2,Setup Sanctum,done,1
  tick-c3d4,Login endpoint,open,1
```

**Exploration outcome**:
- TOON is well-suited for `tick ready` and `tick list` (uniform arrays of tasks)
- Default to TOON for agent consumption
- Provide `--json` flag for compatibility/debugging
- Consider `--plain` for human-readable output

**Storage vs Output**:

| Concern | Storage (JSONL) | Output (TOON) |
|---------|-----------------|---------------|
| Token efficiency | Doesn't matter | Critical |
| Git diffs | Clean line-by-line | N/A |
| Human debugging | Readable | Less readable |
| Parser maturity | Universal | Newer |

**Decision**: Keep JSONL for storage, use TOON as default output format.

**Note on JSONL**: JSONL (JSON Lines) and NDJSON (Newline Delimited JSON) are the same format - one JSON object per line. JSONL is the more common name.

---

#### Exploration: CLI Framework

**Q: What Go CLI framework should we use?**

**Options considered**:
| Framework | Notes |
|-----------|-------|
| **Cobra** | Most popular, used by K8s/Docker/GitHub CLI, subcommand-focused |
| urfave/cli | Simpler API, also subcommand-focused |
| Kong | Newer, struct-tag based |
| Standard `flag` | No dependencies, but no subcommand support |

**Decision**: Cobra

**Rationale**:
- Perfect fit for subcommand pattern (`tick create`, `tick list`, `tick dep add`)
- Shell completion built-in
- Huge community, easy to find examples
- Compile-time dependency only - binary is still self-contained

---

#### Exploration: Edge Cases & Distribution

**Edge cases**:
- **Cache corruption** → Auto-rebuild from JSONL. Also provide `tick rebuild` for manual force.
- **Dependency cycles** → `tick doctor` will detect and report
- **Orphaned tasks** → `tick doctor` will detect (tasks referencing non-existent parents/deps)
- **Merge conflicts** → Minimized by hash-based IDs. When they occur, Git handles it.

**Distribution**:
- Public GitHub repository
- GitHub releases (via goreleaser or manual)
- Homebrew via existing personal tap

**Validation**:
- Dogfooding with claude-technical-workflows integration
- Iterate until v1.0 release

---

## Research Summary

**Decisions made:**
1. Go with `modernc.org/sqlite` (pure Go, no CGO)
2. Cobra for CLI framework
3. Hash-based IDs with customizable prefix
4. Flat `parent` field for hierarchy, `blocked_by` for dependencies
5. JSONL for storage, TOON as default output
6. Flat `key = value` config file
7. Optional archiving with `--include-archived` flag

**Ready for Discussion phase** - lock down architecture, finalize CLI structure, resolve any remaining ambiguities.
