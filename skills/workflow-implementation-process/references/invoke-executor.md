# Invoke Executor

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

This step invokes the `workflow-implementation-task-executor` agent (`../../../agents/workflow-implementation-task-executor.md`) to implement one task.

---

## Determine Workflow Reference

Use `work_type` from session context — read once at the task loop's entry (**[task-loop.md](task-loop.md)**), not per invocation.

#### If `work_type` is `quick-fix`

Use **verification-workflow.md** (`.claude/skills/workflow-implementation-process/references/verification-workflow.md`) as the workflow reference (item 1 below).

→ Proceed to **Invoke the Agent**.

#### Otherwise

Use **tdd-workflow.md** (`.claude/skills/workflow-implementation-process/references/tdd-workflow.md`) as the workflow reference (item 1 below).

→ Proceed to **Invoke the Agent**.

---

## Invoke the Agent

#### If this is the current task's first executor dispatch

Dispatch a **fresh** `workflow-implementation-task-executor` agent via the Task tool. Never continue an executor from an earlier task — the task content below is this task's complete framing, and an executor still carrying the previous task's context erodes that boundary.

The dispatch result names the new agent's id — keep it in session context; the task's later rounds (fix, retry, gate comment) continue this executor by that id.

The dispatch includes these file paths:

1. **Workflow reference**: the file determined above
2. **code-quality.md**: `.claude/skills/workflow-implementation-process/references/code-quality.md`
3. **Specification path**: from the specification (if available)
4. **Project skill paths**: from session context — the `project_skills` discovered in Step 3 (Project Skills Discovery)
5. **Task content**: normalised task content (see [task-normalisation.md](task-normalisation.md))
6. **Linter commands**: from session context — the `linters` configured in Step 4 (Linter Discovery), if any

A fresh dispatch starts with no memory — this payload is everything the executor sees.

→ Proceed to **Expected Result**.

#### If an executor already ran for the current task (fix round, retry, or gate comment)

Continue that same executor — it already holds the task, the codebase context it explored, and the code it wrote. Send the round's material to the executor's recorded agent id with the SendMessage tool; when SendMessage is not among the active tools, load it first (ToolSearch, query `select:SendMessage`). Unavailability is proven by a failed send, never assumed — do not fall back because the tool needed loading or the continuation seems uncertain. Send only the round's new material:

- **Fix round (from E or F)**: the review notes as approved — verbatim, or as the user modified them — and the ISSUES to address; on F `comment`, the user's commentary as well
- **Task-gate comment (from G)**: the user's feedback
- **Retry (from C)**: the user's comments

Any round may also carry an **ad hoc addition** ([ad-hoc-plan-changes.md](ad-hoc-plan-changes.md) section C) — the user's instruction, marked as an addition from the user, included with the round's material.

If the send fails — the recorded id no longer resolves, or a context refresh dropped it — dispatch a fresh executor with items 1–6 above plus the round's material as items 7 (**User-approved review notes**: verbatim or as modified by the user) and 8 (**Specific issues to address**: the ISSUES from the review); the full payload restores everything the continued executor would have held. When the conversation no longer holds the round's material, read it from the latest `## Attempt {N}` section of the task's fix tracking file (`.workflows/{work_unit}/implementation/{topic}/fix-tracking-{internal_id}.md`).

→ Proceed to **Expected Result**.

---

## Expected Result

The agent returns a structured report:

```
STATUS: complete | blocked | failed
TASK: {task name}
SUMMARY: {2-5 lines — commentary, decisions made, anything off-script}
TEST_RESULTS: {all passing | failures — details only if failures}
ISSUES: {blockers or deviations — omit if none}
```

- `complete`: all acceptance criteria met, tests passing
- `blocked` or `failed`: ISSUES explains why and what decision is needed

Keep the report minimal. "All passing" is sufficient for TEST_RESULTS when nothing failed. ISSUES can be omitted entirely on a clean run.

→ Return to caller.
