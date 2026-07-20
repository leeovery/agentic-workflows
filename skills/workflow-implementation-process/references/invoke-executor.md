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

**Every invocation** — initial or re-attempt — includes these file paths:

1. **Workflow reference**: the file determined above
2. **code-quality.md**: `.claude/skills/workflow-implementation-process/references/code-quality.md`
3. **Specification path**: from the specification (if available)
4. **Project skill paths**: from session context — the `project_skills` discovered in Step 3 (Project Skills Discovery)
5. **Task content**: normalised task content (see [task-normalisation.md](task-normalisation.md))
6. **Linter commands**: from session context — the `linters` configured in Step 4 (Linter Discovery), if any

**Re-attempts after review feedback** additionally include:
7. **User-approved review notes**: verbatim or as modified by the user
8. **Specific issues to address**: the ISSUES from the review

The executor is stateless — each invocation starts fresh with no memory of previous attempts. Always pass the full task content so the executor can see what was asked, what was done, and what needs fixing.

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
