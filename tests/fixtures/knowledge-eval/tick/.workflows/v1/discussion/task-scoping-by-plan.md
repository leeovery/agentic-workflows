---
topic: task-scoping-by-plan
status: concluded
work_type: greenfield
date: 2026-02-09
---

# Discussion: Task Scoping by Plan/Project

## Context

In real-world usage with the claude-technical-workflows system, a project goes through research → discussion → specification → planning → implementation → review. Medium-to-large projects produce **multiple specs and multiple plans**, each covering a different feature or subsystem.

During implementation, an agent works through ONE plan at a time. It needs to query only the tasks relevant to that plan - not every task across every plan. This is the "plan scoping" problem.

**How other backends handle this:**
- **Linear**: Create a project per plan, scope queries to that project
- **Local Markdown**: Each plan gets its own directory, tasks are files within that directory - natural filesystem scoping

**In Tick today:**
- Parent/child hierarchy exists (`--parent` on create)
- Leaf-only `tick ready` works (tasks with open children don't appear)
- **No `--parent` filter on `tick list` or `tick ready`** - can't scope queries

The proposed approach: create a top-level parent task per plan, add all plan tasks as children, then filter queries by that parent.

### References

- [Hierarchy & Dependency Model](hierarchy-dependency-model.md) - Leaf-only ready rule, parent/child semantics
- [CLI Command Structure & UX](cli-command-structure-ux.md) - List command filters
- [Specification: tick-core](../specification/tick-core.md) (lines 499-509) - Current list options

## Questions

- [x] Is `--parent` filter on `tick list`/`tick ready` sufficient for plan scoping?
      - **Decision**: Yes. Single `--parent <id>` flag on `tick list` (inherited by `ready`/`blocked` aliases)
- [x] Should filtering be direct children only, or all descendants?
      - **Decision**: All descendants (recursive). Scope at any level of the tree.
- [x] How does this interact with the existing leaf-only ready rule?
      - **Decision**: Composes naturally. Recursive descent collects the subtree, then existing leaf-only/blocked filters apply within it.
- [x] Is this a v1 requirement or can it wait?
      - **Decision**: v1 essential. Without it, Tick is unusable for multi-plan projects — the primary use case.

---

## Is `--parent` filter sufficient for plan scoping?

### Context

The claude-technical-workflows system produces multiple plans per project. During implementation, agents work one plan at a time and need to query only that plan's tasks. Without scoping, `tick ready` returns tasks from ALL plans — unusable once 2+ plans exist.

Existing backends solve this differently:
- **Linear**: Separate project per plan, queries scoped to project
- **Local Markdown**: Filesystem directories per plan — natural scoping

Tick already has parent/child hierarchy but no way to filter queries by parent.

### Options Considered

**Option A: Add `--parent <id>` filter to `tick list`**
- Reuses existing hierarchy. Plan root = parent task, plan tasks = children.
- No new concepts. Just a WHERE clause on queries.
- Pro: Minimal addition, leverages existing infrastructure
- Con: None identified — it's the obvious fit

**Option B: Add a "project" or "label" concept**
- Separate metadata field for grouping tasks
- Pro: Decoupled from hierarchy
- Con: New concept, new field, more complexity for the same result

**Option C: Do nothing — agents filter client-side**
- Agent gets all tasks, filters by parent in its own logic
- Pro: Zero changes to Tick
- Con: Wasteful, error-prone, defeats purpose of a query tool

### Journey

Started from the real-world workflow: agent implementing a plan needs scoped queries. Examined how Linear and Local Markdown handle it — both use some form of container scoping.

Looked at Tick's existing model. Parent/child is already there. `tick create --parent <id>` works. The leaf-only ready rule means parent tasks don't appear in `tick ready` when they have open children — so a plan root task naturally acts as a container.

The only missing piece: you can't tell `tick list` or `tick ready` to only show tasks under a specific parent. Option A (adding `--parent` filter) was immediately obvious and uncontested. No need for a separate "project" abstraction — the hierarchy IS the project structure.

### Decision

**Option A: `--parent <id>` filter on `tick list`.**

```bash
tick list --parent <id>       # all tasks under this parent (recursive)
tick ready --parent <id>      # ready leaves under this parent
tick blocked --parent <id>    # blocked tasks under this parent
```

No new concepts. The plan root task IS the project container.

---

## Direct children or all descendants?

### Context

Given `--parent`, should it return only immediate children, or walk the full subtree?

### Example

```
Plan: Auth System (tick-p1a2)
├── Login endpoint (tick-e5f6)
│   ├── Validation (tick-g7h8)      ← leaf
│   └── Rate limiting (tick-i9j0)   ← leaf
└── Logout endpoint (tick-k1l2)     ← leaf
```

`tick ready --parent tick-p1a2` — should this return tick-g7h8, tick-i9j0, tick-k1l2? Or only tick-e5f6 and tick-k1l2?

### Journey

If direct-children-only, you'd miss the actual leaf work items (tick-g7h8, tick-i9j0) when scoping to the plan root. The leaf-only ready rule means tick-e5f6 (Login endpoint) won't appear because it has open children. You'd get back only tick-k1l2 — missing two workable tasks.

Recursive is the only model that makes sense with leaf-only ready. And it gives natural nesting: scope to plan root for all tasks, scope to a subtask for just that branch.

```bash
tick ready --parent tick-p1a2    # all ready leaves under Auth System
tick ready --parent tick-e5f6    # just ready leaves under Login endpoint
tick ready                       # everything, no scoping
```

No debate here — recursive was immediately agreed.

### Decision

**All descendants (recursive).** Scope at whatever level you want. This composes naturally with the existing leaf-only ready rule.

Implementation: recursive CTE in SQLite to collect all descendant IDs, then apply existing ready/blocked/status filters within that set.

---

## Interaction with leaf-only ready rule

### Context

The leaf-only ready rule (from hierarchy-dependency-model discussion) says a task only appears in `tick ready` if it has no open children. Does `--parent` filtering change or complicate this?

### Journey

No tension here. The `--parent` flag simply restricts which tasks are *considered* — it narrows the universe. The leaf-only and blocked-by rules still apply within that narrowed set.

Query logic: collect all descendant IDs of the given parent (recursive CTE), then apply the same ready/blocked/status filters as today, but only within that set.

The plan root task itself is excluded from results naturally — it has open children, so the leaf-only rule filters it out.

### Decision

**No interaction issues.** `--parent` is a pre-filter (which tasks to consider), leaf-only/blocked-by are post-filters (which of those are workable). They compose cleanly.

---

## Is this v1?

### Context

Without `--parent` filtering, can Tick serve the primary use case of agents working through plans?

### Journey

No debate. Once a project has 2+ plans, `tick ready` returns tasks from all plans mixed together. The implementation agent has no way to focus on its current plan. This is the equivalent of Linear without projects or a filesystem without directories.

The implementation cost is minimal — a single recursive CTE and a new flag on the list command. Not adding this would make Tick a toy for single-plan projects only.

### Decision

**v1 essential.** This is not a nice-to-have. It's a prerequisite for real-world usage with the claude-technical-workflows system (and any similar multi-plan workflow).

---

## Summary

### Key Insights

1. **Hierarchy IS the scoping mechanism.** No need for a separate "project" or "label" concept. Plan root task = project container. Tick's minimalism pays off — one concept (parent/child) serves both organization and scoping.

2. **Recursive descent is required.** Direct-children-only would break with the leaf-only ready rule — you'd miss the actual workable tasks nested deeper in the tree.

3. **Composes cleanly with existing rules.** `--parent` narrows the task universe, existing filters (ready, blocked, status, priority) apply within it. No special cases.

### Key Decisions

| Question | Decision |
|----------|----------|
| Sufficient for plan scoping? | Yes — `--parent <id>` on `tick list` |
| Direct children or recursive? | Recursive (all descendants) |
| Interaction with leaf-only? | Clean composition, no issues |
| v1 requirement? | Essential — prerequisite for multi-plan usage |

### Spec Changes Required

Add to `tick list` options (tick-core spec, lines 499-509):

```bash
tick list [options]

Options:
  --ready       Show only ready tasks (unblocked, no open children)
  --blocked     Show only blocked tasks
  --status <s>  Filter by status (open, in_progress, done, cancelled)
  --priority <p> Filter by priority (0-4)
  --parent <id> Scope to descendants of this task (recursive)
```

### Current State

All questions resolved. Ready for specification update.

### Next Steps

- [ ] Update tick-core specification to add `--parent` flag to list command options
- [ ] Ensure planning documentation reflects the "plan root task" pattern for workflow integration
