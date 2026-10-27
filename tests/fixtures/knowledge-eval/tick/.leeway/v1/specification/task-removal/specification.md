---
topic: task-removal
status: concluded
type: feature
work_type: greenfield
date: 2026-02-18
review_cycle: 3
finding_gate_mode: gated
sources:
  - name: task-removal
    status: incorporated
---

# Specification: Task Removal

## Specification

### Overview

Tick needs a `remove` command that permanently deletes tasks from the JSONL source of truth. This is fundamentally different from `cancel` — cancel marks a task as resolved-but-present; remove erases it entirely.

**What "remove" means at the storage level:** True deletion. The task is filtered from the in-memory slice inside `Store.Mutate()`, and the JSONL file is rewritten without it. The SQLite cache is rebuilt from JSONL after each write, so the task disappears from both stores atomically. No new status is introduced — the task ceases to exist.

**Recovery:** The JSONL file is tracked in Git. Prior state is always recoverable from Git history. No in-app undo mechanism is needed.

### Command Interface

**Command name:** `remove`

Consistent with the existing vocabulary of full English words (`cancel`, `reopen`, `create`). No alias (`rm`) — aliasing can be added later as a cross-cutting feature.

**Usage:**

```
tick remove <id> [<id>...]
tick remove <id> [<id>...] --force
```

**Arguments:**
- One or more task IDs as positional arguments (bulk removal supported)

**Flags:**
- `--force` / `-f` — Skip interactive confirmation. For AI agents, scripts, and non-interactive use.

**Status restrictions:** None. Tasks in any status (open, in_progress, done, cancelled) can be removed. The confirmation prompt is the safety gate, not status rules.

**Error handling:** If any provided task ID does not exist, the command fails with an error before any removal occurs. No partial removal — either all targets are valid and removed, or none are. This applies to both single and bulk invocations.

**Deduplication:** Duplicate task IDs in arguments are silently deduplicated. This also applies when a task appears both as an explicit argument and as a cascaded descendant of another argument — it is only removed once. The confirmation prompt shows the deduplicated set.

**No arguments:** If no task IDs are provided, the command returns an error: `"task ID is required. Usage: tick remove <id> [<id>...]"`. Consistent with existing commands like `start`, `done`, `cancel`.

### Confirmation Behavior

Remove is the first truly destructive command in Tick. All other mutations are reversible status transitions. This warrants an interactive confirmation gate.

**Default (no `--force`):** Prompt the user before proceeding. The prompt surfaces the blast radius:
- The target task(s) being removed
- Any children that will be cascade-deleted
- Any dependency references that will be cleaned up from surviving tasks

The user must enter explicit confirmation to proceed.

**Accepted confirmation input:** Case-insensitive `y` or `yes`. Any other input (including empty/Enter) is treated as decline.

The prompt should indicate the expected input, e.g.: `Remove task tick-abc "My task title"? [y/N]`

The `[y/N]` convention (capital N) signals that "no" is the default — pressing Enter without typing anything aborts.

**Prompt destination:** The confirmation prompt (question text) is written to stderr, not stdout. This keeps stdout clean for piped and scripted usage. The abort message ("Aborted.") also goes to stderr, as already specified.

**Abort behavior:** If the user declines (any input other than `y`/`yes`, including empty Enter), the command prints "Aborted." to stderr and exits with code 1. No tasks are modified. This matches the convention where a non-zero exit signals "the requested operation did not happen."

**With `--force`:** Skip the confirmation prompt entirely. The caller accepts full responsibility. Designed for AI agents, scripts, and non-interactive pipelines.

**Design choice:** `--force` rather than TTY auto-detection. The app already injects `IsTTY` for format detection, but behavior should be explicit — always confirm unless `--force` is passed. This avoids ambiguity about what happens in non-TTY contexts without `--force`.

### Cascade Deletion

Removing a task that has children triggers recursive cascade deletion — the parent and all descendants are removed together.

**Rationale:** Parent-child is structural. Children are subtasks *of* the parent (e.g., "Build authentication" → "Create login form", "Add JWT middleware"). Deleting the parent means abandoning the whole effort. Children don't make sense without the parent in most cases.

**Behavior:**
- When a task with children is removed, all descendants are collected recursively (children, grandchildren, etc.)
- All collected tasks are removed in a single atomic `Store.Mutate()` call
- Dependency references for *all* removed tasks (parent + descendants) are auto-cleaned from surviving tasks

**Confirmation prompt (without `--force`):** Explicitly lists all tasks that will be removed, e.g.:
> "This task has the following children: tick-def, tick-ghi. Removing it will also remove them. Are you sure?"

**With `--force`:** Cascade proceeds silently. The caller accepts the consequences.

**Bulk + cascade interaction:** When multiple IDs are passed and some trigger cascades, all targets plus their descendants are collected, deduplicated, and removed in a single atomic operation. The confirmation prompt lists the full deduplicated set.

**Removing a child:** When a child task (leaf node) is removed, no cleanup is needed on the parent side — the `Parent` field lives on the child, and parents don't maintain a children list. The child is simply filtered out.

### Dependency Cleanup

When a task is removed, its ID is automatically scrubbed from all surviving tasks' `BlockedBy` arrays. This happens in the same atomic `Store.Mutate()` call as the deletion.

**Rationale:** Removing a blocker removes the block. A task that depended on the deleted task is no longer blocked by it. This is both user-friendly (no manual cleanup) and leaves data clean (no orphaned IDs).

**Implementation approach:** Inside the Mutate callback, after filtering out the removed task(s), iterate remaining tasks and strip all removed IDs from their `BlockedBy` arrays. Since the full task slice is already in memory, identifying affected tasks costs nothing extra.

**Output:** Report which surviving tasks had their dependencies updated. E.g.: "Updated dependencies on tick-def, tick-ghi". This applies to all three formatters (toon, pretty, JSON).

**Interaction with cascade:** When cascade deletion removes multiple tasks, dependency cleanup scrubs *all* removed IDs (parent + descendants) from surviving tasks' `BlockedBy` arrays.

### Output

After a successful removal (with or without `--force`), output through the Formatter interface:

- Which task(s) were removed (IDs and titles)
- Which cascaded children were removed (if any)
- Which surviving tasks had dependency references cleaned up (if any)

Respects `--quiet` flag (suppress output) consistent with other commands.

All three formatters (toon, pretty, JSON) must support removal output. This will likely require a new Formatter method (e.g., `FormatRemoval`) since removal is a distinct operation — not a status transition, not a dependency change, not a generic message. It combines deletion confirmation with cascade and dependency cleanup reporting.

### Help Text

The `remove` command's help entry should document:
- Usage and flags
- Cascade behavior (removing a parent removes all descendants)
- That Git history serves as the recovery mechanism for accidental removals

---

## Dependencies

Prerequisites that must exist before implementation can begin:

### Notes

- **No blocking dependencies.** The `remove` command builds on existing infrastructure: `Store.Mutate()` for atomic writes, the Task struct with `BlockedBy`/`Parent` fields, the Formatter interface, and the command dispatch pattern in `App.Run()`. All of these already exist.
- The only new concern is stdin reading for the interactive confirmation prompt, which is a standard Go capability (`bufio.Scanner` on `os.Stdin`) — no external dependency required.
