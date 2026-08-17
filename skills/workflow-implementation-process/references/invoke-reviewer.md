# Invoke Reviewer

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

This step invokes the `workflow-implementation-task-reviewer` agent (`../../../agents/workflow-implementation-task-reviewer.md`) to independently verify a completed task.

---

## A. Invoke the Agent

Every review dispatches a **fresh** `workflow-implementation-task-reviewer` agent — including the re-review after a fix round. Never continue a previous reviewer: the review is independent verification, and a continued reviewer checks the fix against its own prior findings instead of reading the result fresh. The numbered payload is the reviewer's complete input — prior review findings and fix history stay out; they would anchor the fresh read.

Invoke `workflow-implementation-task-reviewer` with:

1. **Specification path**: same path given to the executor
2. **Task content**: same normalised task content the executor received
3. **Project skill paths**: from `project_skills` in the manifest (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.implementation.{topic} project_skills`)
4. **Work type**: from the manifest (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit} work_type`) — `quick-fix` switches the reviewer to completeness-based criteria and verification-workflow checks
5. **code-quality.md path**: `.claude/skills/workflow-implementation-process/references/code-quality.md` — the standards the executor worked to, including the comment discipline
6. **Executor's report**: the structured result the executor returned for this attempt — the claims under review, to be verified against the code, never trusted

---

## B. Expected Result

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
COMMENT_CORRECTIONS:
- {file:line} — {what is wrong}
  OLD: {verbatim current comment text}
  NEW: {replacement — empty to delete}
BANK:
- {cross-scope consolidation opportunity}
  DETAIL: {what and where}
  FILES: {paths}
NOTES:
- {non-blocking observations}
```

- `approved`: task passes all five review dimensions
- `needs-changes`: ISSUES contains specific, actionable items with fix recommendations and confidence levels
- COMMENT_CORRECTIONS may accompany either verdict — prose-only fixes that never count toward the verdict. On `approved`, the orchestrator applies them directly; on `needs-changes`, they travel to the executor with the findings
- BANK may accompany either verdict and never counts toward it — opportunities whose fix reaches beyond the task's scope, deposited to the manifest the moment the report arrives ([task-loop.md](task-loop.md) **D. Review Task**)

→ Return to caller.

---

## C. Confirmation Review

Dispatched from the fix gate when the user challenges a finding rather than directing a fix. Invoke a **fresh** `workflow-implementation-task-reviewer` agent — never the reviewer whose finding is under challenge, which would defend its own work, and never a continuation. Pass items 1–6 of **A. Invoke the Agent**, plus:

7. **Challenged findings** — the disputed ISSUES, verbatim from the review under challenge
8. **The user's challenge** — their argument, verbatim

The agent adjudicates (see the charter's Confirmation Dispatch) and returns:

```
TASK: {task name}
VERDICT: approved | needs-changes
CHALLENGED:
- {finding}: stands | withdrawn — {why, in one clause}
```

- `withdrawn` removes the finding; `stands` keeps it, with the reason the argument does not hold
- A finding withdrawn as real but beyond this task's scope returns under a BANK section (the standard report's shape) — deposited on arrival like any review's
- Unchallenged ISSUES carry forward untouched — the confirmation never re-sweeps the task
- VERDICT is recomputed from the ISSUES that remain after withdrawals: `approved` when no blocking issue survives

→ Return to caller.
