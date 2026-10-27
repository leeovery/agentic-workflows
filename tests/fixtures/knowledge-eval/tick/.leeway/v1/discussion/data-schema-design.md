---
topic: data-schema-design
status: concluded
work_type: greenfield
date: 2026-01-19
---

# Discussion: Data Schema Design

## Context

Tick uses JSONL as the source of truth (committed to git) and SQLite as an ephemeral cache (gitignored, auto-rebuilds). The research phase proposed schemas for both, but several questions need resolution before specification.

**Key constraint**: The schema must support the CLI decisions already made:
- 4 statuses: `open`, `in_progress`, `done`, `cancelled`
- Dependencies via `blocked_by` array
- Hierarchy via `parent` field
- Output includes related entity context (not just IDs)

### References

- [Research: exploration.md](../research/exploration.md) (lines 62-138) - Proposed schemas
- [CLI Command Structure & UX](cli-command-structure-ux.md) - Status values, commands
- [TOON Output Format](toon-output-format.md) - Output structure decisions

### Proposed Schema (from research)

**Task fields**:
```
id: string              # tick-a1b2c3 (prefix + hash)
title: string
status: "open" | "in_progress" | "done"  # Now 4 values per CLI discussion
priority: 0 | 1 | 2 | 3 | 4
type: "epic" | "task" | "bug" | "spike"

# Optional
description?: string
blocked_by?: string[]
parent?: string
assignee?: string
labels?: string[]
created: string         # ISO 8601
updated?: string
closed?: string
notes?: string
```

## Questions

- [x] Are all proposed fields necessary? Should any be removed or added?
- [x] What are the exact constraints and validation rules for each field?
- [x] How should hierarchy work? (organizational vs workflow constraint)
- [x] Is the SQLite schema optimal for expected queries?
- [x] Should `cancelled` tasks behave differently from `done` in queries?

---

## Q1: Field Selection - What's Necessary?

### Context

Research proposed 15 fields. Need to determine minimal viable schema without over-engineering.

### Fields Questioned

**`type` (epic|task|bug|spike)**
- Research assumed this distinguishes "big things" (epics) from "small things" (tasks)
- But hierarchy (`parent`) already provides this - a task with children is implicitly an "epic"
- Agent running `tick ready` works on leaf tasks; hierarchy provides context

**`assignee`**
- Research states "single-agent focus"
- If only one agent, who gets assigned? No value.

**`labels`**
- Flexible tagging adds complexity
- Priority already handles urgency; type was handling categorization
- Can add later if needed

**`notes` vs `description`**
- Two free-text fields with unclear distinction
- Research: `description` for task details, `notes` for "free-form context for agents"
- Overlap is significant - one field sufficient

**`updated`**
- Tracks last modification time
- Minimal overhead - already updating the record anyway

### Decision

**Remove**: `type`, `assignee`, `labels`, `notes`
**Keep**: `updated`, `description`

**Rationale**:
- **Type removed**: Hierarchy handles epic/task distinction. A task with children is effectively an epic. Agent instructions explain navigation. Keeps schema simpler.
- **Assignee removed**: Single-agent focus. No multi-agent coordination planned.
- **Labels removed**: YAGNI. Priority covers urgency. Can add later if needed.
- **Notes removed**: `description` is sufficient for free-form context. One field, not two.
- **Updated kept**: Useful for debugging/audit. Overhead negligible since we're mutating anyway.

### Resulting Schema

```
id: string              # tick-a1b2c3 (prefix + hash)
title: string
status: "open" | "in_progress" | "done" | "cancelled"
priority: 0 | 1 | 2 | 3 | 4
description?: string
blocked_by?: string[]
parent?: string
created: string         # ISO 8601
updated?: string
closed?: string
```

**10 fields** (down from 15). Minimal, focused.

---

## Q2: Field Constraints and Validation

### Decision

| Field | Required | Constraints |
|-------|----------|-------------|
| `id` | Yes | `{prefix}-{6-8 char hash}`, unique |
| `title` | Yes | Non-empty string |
| `status` | Yes | Enum: `open`, `in_progress`, `done`, `cancelled` |
| `priority` | Yes | 0-4 integer, default 2 |
| `description` | No | Free text |
| `blocked_by` | No | Array of valid task IDs |
| `parent` | No | Valid task ID |
| `created` | Yes | ISO 8601 timestamp |
| `updated` | No | ISO 8601 timestamp |
| `closed` | No | ISO 8601 timestamp (set when done/cancelled) |

### blocked_by: Array vs Relational

**Two layers, two representations:**

- **JSONL (source of truth)**: Array - keeps one line per task for clean git diffs
- **SQLite (cache)**: Normalized `dependencies` table - efficient for "ready" query joins

Cache rebuild expands arrays into relational rows. Best of both worlds.

---

## Q3: Hierarchy Behavior

### Context

With `type` removed, hierarchy does more work. Need to clarify exactly how `tick ready` behaves with parent/child relationships.

### The Scenario

```
Epic: Auth System (tick-a1b2)
├── Setup Sanctum (tick-c3d4) - DONE
├── Login endpoint (tick-e5f6, blocked_by=[tick-c3d4])
│     ├── Validation (tick-g7h8)
│     └── Rate limiting (tick-i9j0)
└── Logout endpoint (tick-k1l2, blocked_by=[tick-e5f6])
```

Setup Sanctum is done. Login endpoint is unblocked. But Login endpoint has children.

**Question**: Should `tick ready` return:
- A) Login endpoint (the unblocked parent)
- B) Validation and Rate limiting (the leaf children)
- C) All three (parent + children)

### Options Considered

**Option A: Parent appears, agent decides**
- `tick ready` returns Login endpoint
- Agent sees it has children via `tick show`, works on them
- Pro: Simple query logic
- Con: Agent must do extra lookup to find actual work

**Option B: Only leaf tasks appear**
- Tasks with open children are implicitly "not ready"
- `tick ready` returns only Validation and Rate limiting
- Pro: Ready list = actual work items, no extra lookups
- Con: Query more complex (must check for children)

**Option C: Return all**
- Both parent and children appear
- Pro: Full visibility
- Con: Cluttered, agent may start parent when children need work first

### Decision

**Hierarchy is organizational, not workflow constraint.**

- Children are decomposition/context for the parent task
- Parent readiness determined only by explicit `blocked_by`, not by children existing
- Subtasks use the same schema as tasks (no special entity)
- Query behavior (what `tick ready` returns) is implementation detail, not schema concern

**Schema implication**: Single task schema with `parent` field. No `type` field needed. No special subtask handling.

---

## Q4: SQLite Schema

### Context

SQLite is an ephemeral cache - rebuilt from JSONL when stale. Need efficient indexes for common queries.

### Proposed Structure

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority INTEGER NOT NULL DEFAULT 2,
  description TEXT,
  parent TEXT,
  created TEXT NOT NULL,
  updated TEXT,
  closed TEXT
);

CREATE TABLE dependencies (
  task_id TEXT NOT NULL,
  blocked_by TEXT NOT NULL,
  PRIMARY KEY (task_id, blocked_by)
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_parent ON tasks(parent);
```

### Decision

**Proposed structure is sufficient.**

- `tasks` table mirrors JSONL fields (minus `blocked_by` which is normalized)
- `dependencies` table enables efficient join for "ready" query
- Indexes on `status`, `priority`, `parent` cover common filters

No changes needed from research proposal (just remove dropped fields: `type`, `assignee`, `labels`, `notes`).

---

## Q5: Cancelled vs Done Behavior

### Context

Both `cancelled` and `done` are "closed" states. Question: do they behave identically for dependency resolution?

### Scenario

- Task B is `blocked_by: [A]`
- Task A gets cancelled

Should Task B become ready?

### Options Considered

**Option 1: Yes - cancelled unblocks**
- Cancelled = closed = dependency satisfied
- Simple, uniform logic
- Rationale: if A is cancelled, the work was deemed unnecessary, so the dependency is no longer relevant

**Option 2: No - cancelled leaves dependents blocked**
- Cancelled means work wasn't done, dependents may need review
- Safer but adds complexity
- Requires manual intervention to unblock

### Decision

**Option 1: Cancelled tasks unblock dependents.**

If a task is cancelled, it was no longer required - can't be a blocker. Simple uniform logic: `status IN ('done', 'cancelled')` = dependency satisfied.

---

## Summary

### Key Decisions

1. **Trimmed schema**: 10 fields (from 15). Removed `type`, `assignee`, `labels`, `notes`. Kept `description` and `updated`.

2. **Single task entity**: No separate "epic" or "subtask" types. Hierarchy via `parent` field. A task with children is effectively an epic.

3. **Dual representation for dependencies**: Array in JSONL (git-friendly), normalized table in SQLite (query-friendly).

4. **Hierarchy is organizational**: Children don't block parents. Parent readiness determined only by explicit `blocked_by`.

5. **Cancelled unblocks**: Both `done` and `cancelled` satisfy dependencies. Simple uniform logic.

### Final JSONL Schema

```jsonl
{"id":"tick-a1b2","title":"Task title","status":"open","priority":2,"created":"2026-01-19T10:00:00Z"}
{"id":"tick-c3d4","title":"With all fields","status":"in_progress","priority":1,"description":"Details here","blocked_by":["tick-a1b2"],"parent":"tick-e5f6","created":"2026-01-19T10:00:00Z","updated":"2026-01-19T14:00:00Z"}
{"id":"tick-g7h8","title":"Completed task","status":"done","priority":1,"created":"2026-01-19T10:00:00Z","closed":"2026-01-19T16:00:00Z"}
```

### Final SQLite Schema

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority INTEGER NOT NULL DEFAULT 2,
  description TEXT,
  parent TEXT,
  created TEXT NOT NULL,
  updated TEXT,
  closed TEXT
);

CREATE TABLE dependencies (
  task_id TEXT NOT NULL,
  blocked_by TEXT NOT NULL,
  PRIMARY KEY (task_id, blocked_by)
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_parent ON tasks(parent);
```

### Next Steps

Ready for specification. Key areas to specify:
- Exact JSONL line format and field ordering
- Cache rebuild logic (hash vs mtime freshness check)
- `ready_tasks` view SQL
- Validation error handling
