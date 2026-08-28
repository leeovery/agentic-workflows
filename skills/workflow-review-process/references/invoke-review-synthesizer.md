# Invoke Review Synthesizer

*Reference for **[workflow-review-process](../SKILL.md)***

---

This step dispatches a `workflow-review-findings-synthesizer` agent to read review findings, deduplicate, group, and normalize them into proposals for the approval walk.

---

## Determine Cycle Number

Count existing `review-report-c*.md` files in `.workflows/{work_unit}/implementation/{topic}/` and add 1. The report is written every cycle — staging files are only written when tasks are proposed, so counting them would reuse a cycle number after a `clean` cycle.

```bash
ls .workflows/{work_unit}/implementation/{topic}/review-report-c*.md 2>/dev/null | wc -l
```

---

## Invoke the Agent

**Agent path**: `../../../agents/workflow-review-findings-synthesizer.md`

Dispatch **one agent** via the Task tool.

The synthesizer receives:

1. **Work unit** — the work unit name (for path construction)
2. **Plan topic** — the plan being synthesized
3. **Actions path** — `.workflows/.cache/{work_unit}/review/{topic}/actions.json`; the `replan` actions are the findings to become tasks, already deduplicated, corrected and constrained. Blocking issues from the report join them
4. **Review path** — path to `review/{topic}/` directory (the report and per-task files, for context on each action's sources)
5. **Cycle number** — the review remediation cycle number

---

## Wait for Completion

> **CHECKPOINT**: Do not proceed until the synthesizer has returned.

If the agent fails (error, timeout), record the failure and report "synthesis failed" to the user.

---

## Commit Findings

**If `STATUS` is `tasks_proposed`**, initialise the cycle's gate state — one batched write, `gate_mode` plus one `pending` per task from `TASKS_PROPOSED`. A spec-defect-only synthesis proposes none: write `gate_mode` alone, and the approval overview initialises whatever its spec-defect settling stages.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.review.{topic} staging.c{N}.gate_mode=gated staging.c{N}.tasks.1=pending … staging.c{N}.tasks.{TASKS_PROPOSED}=pending
```

Commit the report and staging file (if created) — both sit under the implementation topic, which this session is reviewing rather than working, so the commit carries `--sweep`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): synthesis cycle {N} — findings" --topic implementation/{topic} --sweep
```

---

## Expected Result

The synthesizer returns:

```
STATUS: tasks_proposed | clean
TASKS_PROPOSED: {N}
SUMMARY: {1-2 sentences}
```

- `tasks_proposed`: proposals written to the staging file, or at least one spec defect recorded in the report — present for approval
- `clean`: neither — no actionable findings and no spec defects

The full report is at `.workflows/{work_unit}/implementation/{topic}/review-report-c{N}.md`. If proposals were staged, the staging file is at `.workflows/{work_unit}/implementation/{topic}/review-tasks-c{N}.md`.

→ Return to caller.
