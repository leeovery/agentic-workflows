---
topic: hierarchy-dependency-model
status: concluded
work_type: greenfield
date: 2026-01-19
---

# Discussion: Hierarchy & Dependency Model

## Context

Tick uses two distinct concepts for task relationships:
- **Hierarchy** (`parent` field): "I am part of this larger thing" - decomposition/organization
- **Dependencies** (`blocked_by` array): "I can't start until these are done" - sequencing

The data-schema-design discussion established that hierarchy is "organizational, not workflow constraint" and deferred the question of what `tick ready` actually returns as "implementation detail." This discussion resolves that implementation detail.

**User's question**: How do tasks depend on each other, what shows up when you run `tick ready`, and how does it all tie together?

### References

- [Research: exploration.md](../research/exploration.md) (lines 324-358) - Hierarchy/dependency model
- [Data Schema Design](data-schema-design.md) - Schema decisions, Q3 on hierarchy
- [CLI Command Structure & UX](cli-command-structure-ux.md) - `tick ready` as alias for `list --ready`

### What's Already Decided

From prior discussions:
- `blocked_by` array in JSONL, normalized to `dependencies` table in SQLite
- Hierarchy via `parent` field (no separate `type` field)
- Both `done` and `cancelled` satisfy dependencies
- Explicit completion - parents don't auto-complete when children finish

## Questions

- [x] What exactly does `tick ready` return?
      - **Decision**: Leaf tasks only (no open children, not blocked)
- [x] What parent context appears in `tick show`?
      - **Decision**: Parent ID + title (not full description)
- [x] Should agents work on parent tasks directly, or only leaf tasks?
      - **Decision**: Addressed by Q1 - agents work leaves; parents appear when children done
- [x] How do hierarchy and dependencies interact?
      - **Decision**: Child→parent deps disallowed (deadlock); parent→child allowed; cycles detected at write time
- [x] What about tasks with no children and no blockers - always ready?
      - **Decision**: Yes, always ready (base case)
- [x] Edge cases: cycles, orphans, deep nesting
      - **Decision**: Deep nesting handled naturally; orphans flagged by doctor; parent-done-before-children allowed

---

## What exactly does `tick ready` return?

### Context

This is the core question. An agent runs `tick ready` to get its next task. What should appear in that list?

**Scenario from data-schema-design**:
```
Epic: Auth System (tick-a1b2)
├── Setup Sanctum (tick-c3d4) - DONE
├── Login endpoint (tick-e5f6, blocked_by=[tick-c3d4])
│     ├── Validation (tick-g7h8)
│     └── Rate limiting (tick-i9j0)
└── Logout endpoint (tick-k1l2, blocked_by=[tick-e5f6])
```

Setup Sanctum is done. Login endpoint is unblocked. But Login endpoint has children.

### Options Considered

**Option A: Return the unblocked parent (Login endpoint)**
- Query is simple: status=open, no incomplete blockers
- Agent sees Login endpoint, can `tick show` to see children
- Con: Agent must do extra lookup to find actual work units

**Option B: Return only leaf tasks (Validation, Rate limiting)**
- Tasks with open children are implicitly "not ready"
- Agent gets work items directly, no extra lookups
- Con: Query more complex, must check for open children

**Option C: Return all (parent + children)**
- Full visibility
- Con: Cluttered, agent might start parent when children need work first

### Journey

Started by examining what "hierarchy is organizational" (from data-schema-design) actually means in practice.

**Initial tension identified**: Prior discussion said "parent readiness determined only by explicit `blocked_by`, not by having open children" but also "agent works through subtasks." These seemed contradictory - if subtasks are just organizational, why would agent "work through" them? And if agent works through them, shouldn't they appear in `tick ready` instead of parent?

**Two coherent models emerged**:
- **Model A (Subtasks as documentation)**: Parent appears in ready, subtasks are notes/context, agent works on parent
- **Model B (Subtasks as work units)**: Only leaves appear in ready, parent is container, agent works through subtasks

User initially leaned toward Model B but raised concern: "If you create a task with description and acceptance criteria, then later add subtasks, does parent suddenly become unworkable?"

**Explored hybrid**: What if both parent and subtasks appear, but sorted with subtasks first? This creates implicit ordering via sort rather than blocking.

**Challenge raised**: Traced concrete scenario:
```
Parent: Implement login (tick-p1)
Subtask: Add validation (tick-s1, parent=tick-p1)
Subtask: Add rate limiting (tick-s2, parent=tick-p1)
```

If all three appear in `tick ready` with subtasks sorted first:
1. Agent works tick-s1 (validation), done
2. Agent works tick-s2 (rate limiting), done
3. Agent picks tick-p1... what's left?

If subtasks must be done before parent work makes sense, that's a real dependency - should use `blocked_by`. The sorting trick was masking an actual dependency relationship.

**Key realization**: If subtasks need to complete before parent can be worked, that IS a dependency - use the dependency system. Hierarchy should remain purely organizational.

**Resolution**: If a task has subtasks, the parent becomes a container. The subtasks ARE the work. Parent only becomes "ready" when children are all closed. This is the leaf-only model (Option B) but with clear reasoning.

**Concern about parent context**: Would epic's description inform subtasks? In Linear/JIRA, humans typically work the task in front of them without checking parent. Only look at parent if task is unclear or ambiguous. Agent can do the same - `tick show` reveals parent exists, agent can look if needed.

**Task quality principle**: Tasks SHOULD be self-contained. Parent context is a safety net, not a crutch. This puts burden on task writing quality, not the tool.

### Decision

**Option B: Leaf-only `tick ready`**

A task appears in `tick ready` only if ALL of these are true:
1. Status is `open`
2. All `blocked_by` tasks are closed (`done` or `cancelled`)
3. **Has no open children** (tasks with status `open` or `in_progress` where `parent` = this task)

**The rules**:
- No children → leaf task → appears in `tick ready` when unblocked
- Has open children → container → does NOT appear in `tick ready`
- All children closed → parent becomes leaf → appears in `tick ready`
- Explicit `blocked_by` → always respected regardless of hierarchy

**Example**:
```
Epic: Auth System (tick-a1b2) - has 3 children, WON'T appear
├── Setup Sanctum (tick-c3d4) - DONE, won't appear
├── Login endpoint (tick-e5f6) - READY (leaf, unblocked) ✓
└── Logout endpoint (tick-k1l2, blocked_by=[tick-e5f6]) - blocked, won't appear
```

Agent sees only: `tick-e5f6`

When Login and Logout are done, Auth System appears (now a "leaf" with no open children). Agent can verify epic is complete, mark done.

**Rationale**:
- Deterministic: agent always gets actual work units, no ambiguity
- Simple mental model: children ARE the work, parent is container
- Matches human behavior: work the task in front of you
- Dependencies remain explicit: if order matters, use `blocked_by`

---

## Parent Context in `tick show`

### Context

When `tick show <id>` displays a task that has a parent, how much parent information should be included?

### Options Considered

**Option A: Just parent ID**
```
parent: tick-a1b2
```
- Minimal, agent must do extra lookup to understand context

**Option B: Parent ID + title**
```
parent: tick-a1b2 "Auth System"
```
- Gives enough signal for "do I need more context?"
- Agent can `tick show tick-a1b2` if needed

**Option C: Parent ID + title + description**
- Full context inline
- Bloats every task view
- Often unnecessary if task is well-written

### Decision

**Option B: Parent ID + title**

The title provides enough context to determine if deeper investigation is needed. Agent can choose to `tick show <parent_id>` for full description if the current task is unclear.

**Rationale**:
- Mirrors human workflow: work the task, check parent only if unclear
- Puts burden on task quality (tasks should be self-contained)
- Parent context is safety net, not automatic inclusion
- Keeps task output focused on the task itself

---

## How do hierarchy and dependencies interact?

### Context

With the leaf-only `tick ready` rule established, we need to understand how explicit `blocked_by` dependencies interact with the parent/child hierarchy.

### Scenarios Analyzed

**1. Child blocked by its own parent**
```
tick-epic (parent)
└── tick-child (parent=tick-epic, blocked_by=[tick-epic])
```
- Parent has open children → not in `tick ready` (leaf-only rule)
- Child is blocked by parent → not in `tick ready`
- **Result: Deadlock. Neither task is ever workable.**

**2. Parent blocked by its own child**
```
tick-epic (blocked_by=[tick-child])
└── tick-child (parent=tick-epic)
```
- Child is leaf → appears in `tick ready`
- Agent works child, marks done
- Parent now has no open children AND blocker is done → appears in `tick ready`
- **Result: Valid workflow. Explicit "do children before parent."**

**3. Child blocked by sibling**
```
tick-epic
├── tick-child-1
└── tick-child-2 (blocked_by=[tick-child-1])
```
- tick-child-1 is ready, agent works it
- tick-child-2 becomes ready after tick-child-1 done
- **Result: Valid. Normal sequencing within an epic.**

**4. Cross-hierarchy dependencies**
```
tick-epic-a
└── tick-child-a (blocked_by=[tick-unrelated])

tick-unrelated (no parent)
```
- Dependencies can cross hierarchy boundaries
- **Result: Valid. Normal dependency behavior.**

**5. General cycles (non-hierarchical)**
```
tick-a (blocked_by=[tick-c])
tick-b (blocked_by=[tick-a])
tick-c (blocked_by=[tick-b])
```
- Classic cycle, no hierarchy involved
- **Result: Invalid. Caught by cycle detection.**

### Decision

**Validation rules for dependencies:**

| Scenario | Allowed | Reason |
|----------|---------|--------|
| Child blocked_by parent | NO | Creates deadlock with leaf-only rule |
| Parent blocked_by child | YES | Valid "do children first" workflow |
| Sibling dependencies | YES | Normal sequencing |
| Cross-hierarchy dependencies | YES | Normal dependency behavior |
| Circular dependencies (any) | NO | Cycle detection catches these |

**Validation timing:**
- **At write time**: Validate when adding/modifying `blocked_by`
- Prevent child→parent dependency immediately (clear error message)
- Detect cycles immediately (before writing to JSONL)

**Error messages should be clear:**
```
Error: Cannot add dependency - tick-child cannot be blocked by its parent tick-epic
       (would create unworkable task due to leaf-only ready rule)

Error: Cannot add dependency - creates cycle: tick-a → tick-b → tick-c → tick-a
```

---

## Simple cases: no children, no blockers

### Context

What about the simplest case - a standalone task with no parent, no children, no blockers?

### Decision

**Always ready** (assuming status is `open`).

This is the base case. A task with:
- `status: open`
- No `blocked_by` (or all blockers are `done`/`cancelled`)
- No open children

...appears in `tick ready`. No special handling needed.

---

## Edge cases: deep nesting, orphans

### Context

What happens with unusual hierarchy structures?

### Scenarios

**Deep nesting (5+ levels)**
```
tick-epic
└── tick-story
    └── tick-task
        └── tick-subtask
            └── tick-sub-subtask (leaf)
```
- Only tick-sub-subtask appears in `tick ready`
- As leaves complete, their parents become "leaves" and appear
- **No special handling needed** - leaf-only rule handles naturally

**Orphaned children (parent deleted/not found)**
```
tick-child (parent=tick-deleted)  # tick-deleted doesn't exist
```
- Options: treat as root task (no parent) OR surface as error
- **Decision needed**: Should `tick doctor` flag this? Should it auto-heal?

**Parent completed before children**
```
tick-epic (status=done)
└── tick-child (status=open, parent=tick-epic)
```
- Parent is done but child still open
- Child is still a valid leaf task → appears in `tick ready`
- **No special handling** - hierarchy is organizational, not constraint

### Decision

**Deep nesting**: Handled naturally by leaf-only rule. No depth limit.

**Orphaned children**:
- Task remains valid, treated as root-level task (parent reference ignored)
- `tick doctor` should flag: "tick-child references non-existent parent tick-deleted"
- No auto-heal - human/agent decides whether to fix or remove parent reference

**Parent done before children**:
- Valid state. Children remain workable.
- May indicate planning issue, but not enforced by tool
- `tick doctor` could optionally warn: "tick-epic is done but has open children"

---

## Summary

### Key Insights

1. **Hierarchy is organizational, dependencies are workflow.** Parent/child relationships organize work; `blocked_by` controls execution order. Don't conflate them.

2. **Leaf-only `tick ready` provides determinism.** Agents get actual work units, never containers. No ambiguity about "which task do I pick?"

3. **Tasks should be self-contained.** Parent context is available but shouldn't be required. Puts burden on task writing quality.

4. **Validation prevents unworkable states.** Child→parent dependencies create deadlocks with leaf-only rule. Catch at write time, not runtime.

5. **Edge cases degrade gracefully.** Orphaned parents, deep nesting, unusual states - the tool handles them without crashing, `tick doctor` flags issues.

### Key Decisions

| Question | Decision |
|----------|----------|
| What does `tick ready` return? | Leaf tasks only (open, unblocked, no open children) |
| Parent context in `tick show`? | ID + title (agent can look up full description if needed) |
| Child blocked_by parent? | Disallowed (creates deadlock) |
| Parent blocked_by child? | Allowed (valid "do children first" workflow) |
| Cycles? | Detected and rejected at write time |
| Orphaned children? | Treated as root tasks, flagged by `tick doctor` |
| Deep nesting? | No limit, leaf-only rule handles naturally |

### Current State

All core questions resolved. Ready for specification.

### Next Steps

- [ ] Specify the `tick ready` query (SQL for ready_tasks view)
- [ ] Specify validation rules for `blocked_by` mutations
- [ ] Specify `tick doctor` checks for hierarchy issues
