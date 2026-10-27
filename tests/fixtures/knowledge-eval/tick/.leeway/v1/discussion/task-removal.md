---
topic: task-removal
status: concluded
work_type: greenfield
date: 2026-02-18
---

# Discussion: Task Removal

## Context

Tick currently supports status transitions (open → in_progress → done/cancelled) but has no mechanism to permanently remove a task from the data file. Cancelling a task keeps it in the JSONL log and SQLite cache — it's still visible in listings and still referenced by dependencies.

The need: a way to completely eliminate a task, removing it from the JSONL source of truth (and by extension the SQLite cache). This is a fundamentally different operation from cancellation — cancel marks a task as resolved-but-present; remove erases it entirely.

### Codebase Context

- **Terminology**: The codebase consistently uses "task" (not "issue")
- **Storage**: JSONL is the source of truth, rewritten atomically on every mutation via `Store.Mutate()`. SQLite cache is rebuilt from JSONL after each write. This means removal is mechanically straightforward — filter the task from the slice, rewrite.
- **Dependencies**: Tasks have `BlockedBy []string` (task IDs) and `Parent string`. Cancelling a task does NOT clean up BlockedBy arrays — cancelled tasks are treated as "resolved blockers" by query logic. Removing a task would leave orphaned IDs in other tasks' BlockedBy arrays.
- **Existing commands**: `cancel` is the closest analog — dispatched via `handleTransition()` → `RunTransition()`. No bulk operations exist for status transitions.
- **Doctor**: The `doctor` command validates JSONL integrity but currently doesn't check for orphaned dependency references.

### References

- Task struct: `internal/task/task.go`
- Dependency validation: `internal/task/dependency.go`
- Store.Mutate: `internal/storage/store.go`
- Transition handler: `internal/cli/transition.go`
- Command dispatch: `internal/cli/app.go`

## Questions

- [x] What does "remove" mean at the storage level?
- [x] Command naming: `remove`, `rm`, or both?
- [x] Which tasks can be removed? Any status restrictions?
- [x] How should dependency references be handled on removal?
- [x] How should parent/child relationships be handled on removal?
- [x] Should bulk removal be supported?

---

## What does "remove" mean at the storage level?

### Context

The JSONL file is rewritten atomically on every mutation via `Store.Mutate()`. A "remove" could mean either filtering the task out of the slice entirely (true deletion) or introducing a new status like `removed`/`deleted`. This is foundational — every other question depends on it.

### Options Considered

**Option A: True deletion — filter task from the slice**
- Task is completely gone from JSONL and cache
- No history preserved
- Clean and simple — consistent with what "remove" implies
- Mechanically trivial: return slice without the task from Mutate callback

**Option B: New status (e.g., `removed` or `deleted`)**
- Task remains in JSONL with a terminal status
- Preserves audit trail
- But: how is this meaningfully different from `cancelled`?
- Adds complexity: need to filter out of all queries, handle in ready logic, etc.

### Journey

Option B was quickly dismissed — it's functionally redundant with `cancelled`. If someone wants a task gone-but-tracked, cancel is already that. The whole point of "remove" is a stronger action: the task ceases to exist. Parallels drawn to Jira and Linear where delete truly deletes. No recovery mechanism needed in Tick because the JSONL file is tracked in Git — prior state is always recoverable from Git history.

### Decision

**True deletion (Option A).** Filter the task from the slice inside `Store.Mutate()`, rewrite JSONL without it. Clean, simple, gives users a capability they genuinely don't have today. Irreversibility is acceptable — Git history provides a safety net.

---

## Command naming: `remove`, `rm`, or both?

### Context

Need a command name. Existing commands: `init`, `create`, `list`, `show`, `update`, `start`, `done`, `cancel`, `reopen`, `ready`, `blocked`, `dep`, `stats`, `rebuild`, `doctor`, `migrate`, `help`.

### Options Considered

**Option A: `remove`** — consistent with verbose style of existing commands (`cancel`, `reopen`, `create`)

**Option B: `rm`** — short, unix-y, matches destructive-action convention

**Option C: Both as aliases** — introduces aliasing pattern that doesn't exist yet

### Journey

Existing commands are full English words. `rm` would be the odd one out. Aliasing is a separate feature concern — don't introduce it just for this command.

### Decision

**`remove`** — keeps naming consistent with existing command vocabulary. Aliasing can be added later as a cross-cutting feature if desired.

---

## Which tasks can be removed? Any status restrictions?

### Context

Should removal be allowed from any status, or only certain ones? Cancellation is valid from `open` or `in_progress`.

### Options Considered

**Restrict to certain statuses** — e.g., only `open` or `cancelled` tasks

**Any status** — open, in_progress, done, cancelled — all removable

### Journey

No logical reason to prevent removing a `done` or `cancelled` task. Use cases exist for all: remove a mistakenly created `open` task, clean up old `cancelled` tasks, remove a duplicate `done` task. The `--force` confirmation already guards against accidents.

### Decision

**Any status.** No restrictions. The confirmation prompt (or `--force` flag) is the safety gate, not status rules.

---

## How should dependency references be handled on removal?

### Context

Tasks reference other tasks via `BlockedBy []string`. If task A is in task B's BlockedBy and we remove task A, B's BlockedBy now contains an orphaned ID. Currently, cancelling a task does NOT clean up BlockedBy arrays — the query logic treats cancelled/done as "resolved." But a removed task won't exist at all.

### Options Considered

**Option A: Block removal if dependencies exist** — refuse until deps are manually cleaned up. Safe but high friction.

**Option B: Auto-clean references** — scrub the removed task's ID from all other tasks' `BlockedBy` arrays. Single atomic operation inside `Store.Mutate()`.

**Option C: Leave orphans** — let query logic treat missing IDs as resolved. But "missing" is ambiguous — bug or removed task?

### Journey

Option A adds unnecessary friction for a problem we can solve automatically. Option C leaves dirty data. Option B is both user-friendly and leaves data clean. Conceptually, removing a blocker removes the dependency — a task that depended on the deleted task isn't blocked anymore.

Implementation is straightforward: inside the Mutate callback, after filtering out the removed task, iterate remaining tasks and strip the removed ID from their `BlockedBy`. All in one atomic write. Since we already have the full task slice, we know exactly which tasks were modified — report them in the output at zero extra cost.

### Decision

**Auto-clean (Option B).** Strip the removed task's ID from all `BlockedBy` arrays in the same atomic mutation. Report affected tasks in the output for transparency (e.g., "Updated dependencies on tick-def, tick-ghi").

---

## How should parent/child relationships be handled on removal?

### Context

Tasks have a `Parent string` field for hierarchy. Removing a parent could orphan children. Removing a child is straightforward (children point up to parent, parent doesn't reference children — no cleanup needed).

### Options Considered

**Option A: Cascade delete** — remove parent + all descendants recursively. Jira's approach.

**Option B: Block removal** — refuse to remove a parent with children. Must remove children first.

**Option C: Auto-orphan** — clear children's `Parent` field, promote them to top-level tasks.

### Journey

Industry research: Jira cascade-deletes subtasks when deleting a parent. Linear's docs don't explicitly cover it. GitHub sub-issues are too new to have clear precedent.

Key insight from discussion: parent-child is structural, not loose coupling like dependencies. Children are *part of* the parent — "Build authentication" with subtasks "Create login form", "Add JWT middleware". Deleting the parent means abandoning the whole effort. Children shouldn't make sense without the parent in most cases. While a parent might sometimes act as just a wrapper with no real work attached, that's the exception.

Cascade is the right default because it matches the semantics: children are subtasks *of* the parent. Recursive — if children have children, they all go.

Safety is handled by the confirmation prompt. For interactive use (no `--force`), the prompt surfaces the blast radius: "This task has the following children: tick-def, tick-ghi. Deleting it will also delete them. Are you sure?" This is the first truly dangerous command in Tick, and the confirmation gate makes the danger visible. For `--force` (AI/scripts), the caller accepts the consequences.

Recovery is always possible via Git history — the JSONL file is version-controlled. This should be documented in command help and README.

### Decision

**Cascade delete (Option A).** Removing a parent recursively removes all descendants. The confirmation prompt (without `--force`) explicitly lists all tasks that will be removed. Dependency references for all removed tasks are auto-cleaned from surviving tasks.

---

## Confirmation UX: `--force` flag

### Context

Remove is the first truly destructive command in Tick. All other mutations (cancel, done, start) are reversible status transitions. This warrants a confirmation gate.

### Decision

**Default: interactive confirmation prompt.** When run without `--force`:
- Show what will be removed (the target task + any cascaded children)
- Show what dependencies will be cleaned up
- Require explicit "yes" to proceed

**`--force` / `-f` flag:** Skips confirmation. For AI agents, scripts, and non-interactive use.

This follows the `rm` / `git` convention — universally understood by humans and tooling alike.

Note: the app already injects `IsTTY` for format detection, but we chose `--force` over TTY auto-detection to keep behavior explicit. TTY detection was considered but creates ambiguity (what does `--force` mean in non-TTY mode?). Simpler: always confirm unless `--force`.

---

## Should bulk removal be supported?

### Context

No existing bulk status transitions exist. Each `cancel`, `done`, `start` etc. operates on a single task ID.

### Options Considered

**Support bulk from day one** — `tick remove tick-abc tick-def tick-ghi` accepts variadic args

**Single-task only** — consistent with existing command patterns, add bulk later if needed

### Journey

Implementation cost is trivial — accept variadic args instead of a single arg inside the same Mutate callback. The confirmation prompt already handles listing everything that will be removed, so bulk + cascade is naturally transparent. Not supporting it means users run `tick remove tick-abc --force` repeatedly, which is tedious and pointless friction. While no precedent exists for bulk status transitions, remove is already a new kind of command (true deletion vs status transition) so it doesn't need to follow that pattern.

### Decision

**Yes, support bulk removal from day one.** Accept multiple task IDs as positional args. Each target (plus its cascaded children) is collected, deduplicated, and removed in a single atomic Mutate. The confirmation prompt lists the full set of tasks to be removed.

---

## Summary

### Key Insights

1. **Remove ≠ cancel.** Cancel is a reversible status transition; remove is true deletion. They serve fundamentally different purposes and the codebase needs both.
2. **Auto-clean references, don't block.** When removing tasks, automatically scrub their IDs from other tasks' `BlockedBy` arrays. Conceptually, removing a blocker removes the block.
3. **Cascade matches parent-child semantics.** Children are *part of* the parent — deleting the parent means abandoning the whole effort. Recursive cascade is the right default.
4. **Confirmation is the safety gate, not status restrictions.** Any task in any status can be removed. The interactive confirmation prompt (surfacing blast radius) and `--force` flag are the safety mechanism.
5. **Git is the recovery mechanism.** JSONL is version-controlled. No need for an undo feature — document this in help text.

### Current State
- All 6 questions decided

### Next Steps
- Proceed to specification
