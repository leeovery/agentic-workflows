# Invoke Executor

*Reference for **[technical-implementation](../SKILL.md)***

---

This step invokes the `implementation-task-executor` agent (`../../../agents/implementation-task-executor.md`) to implement one task.

---

## Invoke the Agent

**Every invocation** — initial or re-attempt — includes these file paths:

1. **tdd-workflow.md**: `tdd-workflow.md`
2. **code-quality.md**: `code-quality.md`
3. **Specification path**: from the specification phase (if available)
4. **Project skill paths**: from `project_skills` in the manifest (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work-unit}.phases.implementation.project_skills`)
5. **Task content**: normalised task content (see [task-normalisation.md](task-normalisation.md))
6. **Linter commands**: from `linters` in the manifest (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work-unit}.phases.implementation.linters`) (if configured)

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
