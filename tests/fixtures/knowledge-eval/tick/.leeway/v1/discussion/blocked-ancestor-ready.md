---
topic: blocked-ancestor-ready
status: concluded
work_type: greenfield
date: 2026-02-20
---

# Discussion: Blocked Ancestor Ready

## Context

Children of blocked parents incorrectly show as "ready" in `tick ready`. The current ready check uses 3 conditions (open status, no own unclosed blockers, no open children) but never checks whether the task's parent — or any ancestor — is itself blocked by an unclosed dependency.

Example:
```
Phase 1 (open)
Phase 2 (open, blocked_by: Phase 1)
  └─ subtask-A (open)    ← shows as "ready" despite Phase 2 being blocked
  └─ subtask-B (open)    ← same
```

The subtasks pass all ready checks because they personally have no blockers — only their parent does.

### Current Implementation

`internal/cli/query_helpers.go` defines:
- `ReadyConditions()` → 3 conditions: open status, no unclosed blockers, no open children
- `BlockedConditions()` → De Morgan inverse: open status AND (has unclosed blocker OR has open children)
- Both use simple EXISTS/NOT EXISTS subqueries against `dependencies` and `tasks` tables
- No ancestor traversal anywhere

### References

- `internal/cli/query_helpers.go` — ready/blocked SQL conditions
- `internal/cli/list.go` — `queryDescendantIDs()` uses recursive CTE (existing pattern)
- `internal/cli/stats.go` — uses `ReadyWhereClause()` for ready count

## Questions

- [x] What does "blocked ancestor" mean — dependency blockers only, or any blocked state?
- [x] How deep to check — immediate parent or full ancestor chain?
- [x] Implementation approach — recursive CTE shape?

---

## What does "blocked ancestor" mean?

### Context

A task can be "blocked" in two senses:
1. **Dependency-blocked**: has unclosed entries in the `dependencies` table
2. **Children-blocked**: has open/in_progress children (parent waiting on child work)

The question: when checking if an ancestor blocks readiness of a descendant, which sense of "blocked" matters?

### Options Considered

**Option A: Only dependency blockers on ancestors**
- Check if any ancestor has an unclosed entry in the `dependencies` table
- Ignore whether an ancestor is "blocked" because it has open children
- Rationale: "has open children" is the normal state for any parent whose children are the work to be done. A parent with open children isn't *externally* blocked — it's just waiting for its own subtasks

**Option B: Any blocked state on ancestors (dependency OR children)**
- Would mean a leaf task is never ready if its parent has open siblings
- This is clearly wrong — it would prevent leaf tasks from ever being ready, since having open children is what makes the parent *need* the children to complete

### Decision

**Option A — dependency blockers only.** The "has open children" blocked state is structural, not a sequencing constraint. Only dependency blockers represent external ordering requirements that should propagate down.

---

## How deep to check?

### Context

Should we check only the immediate parent, or walk the full ancestor chain?

### Options Considered

**Option A: Immediate parent only**
- Simpler query — just one JOIN up
- Misses grandparent+ scenarios
- Example it misses: Phase 1 → Phase 2 (blocked by Phase 1) → Group A (no own blockers) → subtask-X. With immediate-parent-only, subtask-X checks Group A (not blocked), so subtask-X appears ready despite Phase 2 being blocked

**Option B: Full ancestor chain (recursive CTE)**
- Walks all the way up to root
- Catches all transitive blocking
- Existing pattern in codebase: `queryDescendantIDs()` in `list.go` already uses recursive CTE
- Slightly heavier query, but ancestor chains are typically shallow (2-4 levels)

### Decision

**Option B — full ancestor chain.** Immediate-parent-only has a real gap with intermediate grouping tasks. The recursive CTE is already an established pattern in the codebase (`queryDescendantIDs`), and ancestor chains are shallow enough that performance is a non-issue.

---

## Implementation approach

### Context

How to add the ancestor-blocker check to the SQL query helpers.

### Decision

New `ReadyNoBlockedAncestor()` helper in `query_helpers.go` using a recursive CTE inside NOT EXISTS:

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

- `ReadyConditions()` gains this as a 4th condition
- `BlockedConditions()` gains the EXISTS inverse in its OR clause
- Follows existing pattern: each concern is a separate helper, composed into conditions
- `ReadyWhereClause()` and stats automatically pick up the change since they compose from `ReadyConditions()`

**Edge case — closed ancestors in the chain:** Don't stop walking at closed ancestors. A closed parent with open children is an inconsistency that shouldn't occur in practice, and stopping early adds complexity for no benefit.

---

## Summary

### Key Insights
1. Only dependency blockers propagate down the ancestor chain — "has open children" is structural, not a sequencing constraint
2. Full ancestor chain traversal needed to avoid gaps with intermediate grouping tasks
3. Recursive CTE is the right tool — established pattern in codebase, shallow chains make performance a non-issue

### Current State
- All questions resolved
- Clear implementation path identified

### Next Steps
- [ ] Implement `ReadyNoBlockedAncestor()` helper
- [ ] Add as 4th condition in `ReadyConditions()`
- [ ] Add EXISTS inverse to `BlockedConditions()`
- [ ] Tests: child of blocked parent, grandchild of blocked grandparent, intermediate grouping task
