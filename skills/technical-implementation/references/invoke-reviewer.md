# Invoke Reviewer

*Reference for **[technical-implementation](../SKILL.md)***

---

This step invokes the `implementation-task-reviewer` agent (`../../../agents/implementation-task-reviewer.md`) to independently verify a completed task.

---

## Invoke the Agent

Invoke `implementation-task-reviewer` with:

1. **Specification path**: same path given to the executor
2. **Task content**: same normalised task content the executor received
3. **Project skill paths**: from `project_skills` in the manifest (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work-unit}.phases.implementation.project_skills`)

---

## Expected Result

The agent returns a structured finding:

```
TASK: {task name}
VERDICT: approved | needs-changes
SPEC_CONFORMANCE: {conformant | drift detected — details}
ACCEPTANCE_CRITERIA: {all met | gaps — list}
TEST_COVERAGE: {adequate | gaps — list}
CONVENTIONS: {followed | violations — list}
ARCHITECTURE: {sound | concerns — details}
ISSUES:
- {specific issue with file:line reference}
  FIX: {recommended approach}
  ALTERNATIVE: {other valid approach with tradeoff — optional}
  CONFIDENCE: {high | medium | low}
NOTES:
- {non-blocking observations}
```

- `approved`: task passes all five review dimensions
- `needs-changes`: ISSUES contains specific, actionable items with fix recommendations and confidence levels
