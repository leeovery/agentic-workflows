# Invoke Review Synthesizer

*Reference for **[workflow-review-process](../SKILL.md)***

---

This step dispatches a `workflow-review-findings-synthesizer` agent to read review findings, deduplicate, group, and normalize them into proposed tasks.

---

## Determine Cycle Number

Count existing `review-tasks-c*.md` files in `.workflows/{work_unit}/implementation/{topic}/` and add 1.

```bash
ls .workflows/{work_unit}/implementation/{topic}/review-tasks-c*.md 2>/dev/null | wc -l
```

---

## Invoke the Agent

**Agent path**: `../../../agents/workflow-review-findings-synthesizer.md`

Dispatch **one agent** via the Task tool.

The synthesizer receives:

1. **Work unit** — the work unit name (for path construction)
2. **Plan topic** — the plan being synthesized
3. **Review path** — path to `review/{topic}/` directory (review summary + QA files)
4. **Specification path** — from the manifest
5. **Cycle number** — the review remediation cycle number

---

## Wait for Completion

> **CHECKPOINT**: Do not proceed until the synthesizer has returned.

If the agent fails (error, timeout), record the failure and report "synthesis failed" to the user.

---

## Commit Findings

Commit the report and staging file (if created):

```
review({scope}): synthesis cycle {N} — findings
```

---

## Expected Result

The synthesizer returns:

```
STATUS: tasks_proposed | clean
TASKS_PROPOSED: {N}
SUMMARY: {1-2 sentences}
```

The full report is at `.workflows/{work_unit}/implementation/{topic}/review-report-c{N}.md`. If tasks were proposed, the staging file is at `.workflows/{work_unit}/implementation/{topic}/review-tasks-c{N}.md`.

→ Return to caller.
