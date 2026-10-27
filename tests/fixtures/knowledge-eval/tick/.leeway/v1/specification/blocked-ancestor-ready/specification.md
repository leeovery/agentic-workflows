---
topic: blocked-ancestor-ready
status: concluded
type: feature
work_type: greenfield
date: 2026-02-20
review_cycle: 1
finding_gate_mode: gated
sources:
  - name: blocked-ancestor-ready
    status: incorporated
---

# Specification: Blocked Ancestor Ready

## Problem

Children of blocked parents incorrectly appear as "ready" in `tick ready` and `tick list --ready`. The current ready check uses 3 conditions (open status, no own unclosed blockers, no open children) but never checks whether the task's parent — or any ancestor — is itself dependency-blocked.

### Example

```
Phase 1 (open)
Phase 2 (open, blocked_by: Phase 1)
  └─ subtask-A (open)    ← shows as "ready" despite Phase 2 being blocked
  └─ subtask-B (open)    ← same
```

The subtasks pass all ready checks because they personally have no blockers — only their parent does.

### Current Implementation

`internal/cli/query_helpers.go` defines:
- `ReadyConditions()` — 3 conditions: open status, no unclosed blockers, no open children
- `BlockedConditions()` — De Morgan inverse: open status AND (has unclosed blocker OR has open children)
- Both use simple EXISTS/NOT EXISTS subqueries against `dependencies` and `tasks` tables
- No ancestor traversal anywhere

### Affected Code Paths

| File | Usage |
|------|-------|
| `internal/cli/query_helpers.go` | `ReadyConditions()`, `BlockedConditions()`, `ReadyWhereClause()` |
| `internal/cli/list.go` | Uses conditions for `--ready` and `--blocked` filters |
| `internal/cli/stats.go` | Uses `ReadyWhereClause()` for ready count |

## Design Decisions

### Blocker Type: Dependency Blockers Only

A task can be "blocked" in two senses:
1. **Dependency-blocked**: has unclosed entries in the `dependencies` table
2. **Children-blocked**: has open/in-progress children (parent waiting on child work)

Only **dependency blockers** on ancestors propagate down to affect descendant readiness. The "has open children" state is structural — it's the normal state for any parent whose children are the work to be done. A parent with open children isn't externally blocked; it's just waiting for its own subtasks to complete.

If children-blocked propagated, leaf tasks would never be ready since their parent always has open children (the leaf task itself).

### Traversal Depth: Full Ancestor Chain

The ancestor check walks the **full ancestor chain** to the root, not just the immediate parent.

**Why not immediate parent only:** Intermediate grouping tasks create a gap. Example:
```
Phase 1 (open)
Phase 2 (open, blocked_by: Phase 1)
  └─ Group A (open, no own blockers)
      └─ subtask-X (open)
```
With immediate-parent-only, subtask-X checks Group A (not blocked), so subtask-X incorrectly appears ready despite Phase 2 being dependency-blocked.

**Why full chain is safe:** Recursive CTE is an established pattern in the codebase (`queryDescendantIDs()` in `list.go`). Ancestor chains are typically shallow (2-4 levels), so performance is a non-issue.

## Implementation

### New Helper: `ReadyNoBlockedAncestor()`

Add a new helper function in `internal/cli/query_helpers.go` that returns a NOT EXISTS subquery using a recursive CTE to walk the ancestor chain:

```sql
NOT EXISTS (
    WITH RECURSIVE ancestors(id) AS (
        SELECT parent FROM tasks WHERE id = t.id AND parent IS NOT NULL
        UNION ALL
        SELECT t2.parent FROM tasks t2
        JOIN ancestors a ON t2.id = a.id
        WHERE t2.parent IS NOT NULL
    )
    SELECT 1 FROM ancestors a
    JOIN dependencies d ON d.task_id = a.id
    JOIN tasks blocker ON blocker.id = d.blocked_by
    WHERE blocker.status NOT IN ('done', 'cancelled')
)
```

The CTE collects all ancestor IDs by walking `parent` pointers up to the root. The outer query then checks whether any ancestor has an unclosed dependency blocker.

### Integration Points

**`ReadyConditions()`** — Add `ReadyNoBlockedAncestor()` as the 4th condition. All consumers (`list --ready`, `tick ready`, stats) automatically pick up the change since they compose from `ReadyConditions()`.

**`BlockedConditions()`** — Add the EXISTS inverse to the OR clause:
```sql
OR EXISTS (
    WITH RECURSIVE ancestors(id) AS ( ... )
    SELECT 1 FROM ancestors a
    JOIN dependencies d ON d.task_id = a.id
    JOIN tasks blocker ON blocker.id = d.blocked_by
    WHERE blocker.status NOT IN ('done', 'cancelled')
)
```

This follows the existing pattern: each concern is a separate helper, composed into conditions.

### Edge Case: Closed Ancestors in the Chain

Don't stop walking at closed/cancelled ancestors. A closed parent with open children is an inconsistency that shouldn't occur in practice, and stopping early adds complexity for no benefit. The CTE walks unconditionally to the root.

## Test Scenarios

| Scenario | Setup | Expected |
|----------|-------|----------|
| **Child of blocked parent** | Parent blocked by unclosed dep; child is open with no own blockers | Child is NOT ready, IS blocked |
| **Grandchild of blocked grandparent** | Grandparent blocked; intermediate parent has no own blockers; grandchild is open | Grandchild is NOT ready, IS blocked |
| **Intermediate grouping task** | Phase 2 blocked by Phase 1; Group A under Phase 2 has no own blockers; subtask under Group A | Subtask is NOT ready, IS blocked |
| **Ancestor blocker resolved** | Same as above, but blocker is done/cancelled | Descendant IS ready, NOT blocked |
| **No ancestors (root task)** | Root task with no parent, no own blockers, no open children | Remains ready (no ancestor check needed) |
| **Stats count consistency** | Mix of tasks with and without blocked ancestors | `ReadyWhereClause()` counts match `list --ready` output |

## Dependencies

Prerequisites that must exist before implementation can begin:

### Notes

- No external dependencies. All required infrastructure (recursive CTE support in SQLite, `query_helpers.go` helper pattern, `dependencies` and `tasks` tables) already exists.
- Implementation is self-contained within `internal/cli/query_helpers.go` and its test file.
