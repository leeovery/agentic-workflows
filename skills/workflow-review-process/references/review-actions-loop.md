# Review Actions Loop

*Reference for **[workflow-review-process](../SKILL.md)***

---

After a review is complete, this loop synthesizes findings into actionable tasks.

Stages A through E run sequentially. Always start at **A. Verdict Gate**.

```
A. Verdict gate (check verdicts, offer synthesis)
B. Dispatch review synthesizer → invoke-review-synthesizer.md
C. Approval gate (present tasks, approve/skip/comment)
D. Create tasks in plan → invoke-review-task-writer.md
E. Re-open implementation + plan mode handoff
```

---

## A. Verdict Gate

Check the verdict(s) from the review(s) being analyzed.

#### If all verdicts are `Approve` with no required changes

> *Output the next fenced block as a code block:*

```
No actionable findings. All reviews passed with no required changes.
```

Set the review phase status to completed:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase review --topic {topic} status completed
```

**Pipeline continuation** — Invoke the bridge:

```
Pipeline bridge for: {work_unit}
Completed phase: review

Invoke the workflow-bridge skill to enter plan mode with completion confirmation.
```

#### If any verdict is `Request Changes`

Blocking issues exist. Synthesis is strongly recommended.

> *Output the next fenced block as a code block:*

```
The review found blocking issues that require changes.
Synthesizing findings into actionable tasks is recommended.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Proceed with synthesis?

- **`y`/`yes`** — Synthesize findings into tasks *(recommended)*
- **`n`/`no`** — Skip synthesis
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

→ Proceed to **B. Dispatch Review Synthesizer**.

#### If `no`

User has chosen to skip synthesis. Set review status to completed — the review produced a verdict, even if the user declines to act on it now.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase review --topic {topic} status completed
```

**Pipeline continuation** — Invoke the bridge:

```
Pipeline bridge for: {work_unit}
Completed phase: review

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

#### If verdict is `Comments Only`

Non-blocking improvements only. Synthesis is optional.

> *Output the next fenced block as a code block:*

```
The review found non-blocking suggestions only.
You can synthesize these into tasks or skip.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Synthesize non-blocking findings?

- **`y`/`yes`** — Synthesize findings into tasks
- **`n`/`no`** — Skip synthesis
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

→ Proceed to **B. Dispatch Review Synthesizer**.

#### If `no`

Set review status to completed — the review produced a verdict, even if the user declines to act on non-blocking comments.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase review --topic {topic} status completed
```

**Pipeline continuation** — Invoke the bridge:

```
Pipeline bridge for: {work_unit}
Completed phase: review

Invoke the workflow-bridge skill to enter plan mode with completion confirmation.
```

---

## B. Dispatch Review Synthesizer

Load **[invoke-review-synthesizer.md](invoke-review-synthesizer.md)** and follow its instructions as written.

> **CHECKPOINT**: Do not proceed until the synthesizer has returned.

#### If `STATUS` is `clean`

No actionable tasks from synthesis. Set review status to completed — the review produced a verdict and synthesis was attempted.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase review --topic {topic} status completed
```

> *Output the next fenced block as a code block:*

```
No actionable tasks synthesized. Review complete.
```

**Pipeline continuation** — Invoke the bridge:

```
Pipeline bridge for: {work_unit}
Completed phase: review

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

#### If `STATUS` is `tasks_proposed`

→ Proceed to **C. Approval Gate**.

---

## C. Approval Gate

Read the staging file from `.workflows/{work_unit}/implementation/{topic}/review-tasks-c{cycle-number}.md`.

Check `gate_mode` in the staging file frontmatter (`gated` or `auto`).

Present an overview:

> *Output the next fenced block as a code block:*

```
Review synthesis cycle {N}: {K} proposed tasks

  1. {title} ({severity})
  2. {title} ({severity})
```

Then present each task with `status: pending` individually:

> *Output the next fenced block as markdown (not a code block):*

```
**Task {current}/{total}: {title}** ({severity})
Sources: {sources}

**Problem**: {problem}
**Solution**: {solution}
**Outcome**: {outcome}

**Do**:
{steps}

**Acceptance Criteria**:
{criteria}

**Tests**:
{tests}
```

#### If `gate_mode` is `gated`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Approve this task?

- **`y`/`yes`** — Approve this task
- **`a`/`auto`** — Approve this and all remaining tasks automatically
- **`s`/`skip`** — Skip this task
- **Comment** — Revise based on feedback
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `gate_mode` is `auto`

> *Output the next fenced block as a code block:*

```
Task {current} of {total}: {title} — approved (auto).
```

→ Proceed to next task without stopping.

---

Process user input:

#### If `yes`

Update `status: approved` in the staging file.

→ Present the next pending task, or proceed to routing below if all tasks processed.

#### If `auto`

Update `status: approved` in the staging file. Update `gate_mode: auto` in the staging file frontmatter.

→ Continue processing remaining tasks without stopping.

#### If `skip`

Update `status: skipped` in the staging file.

→ Present the next pending task, or proceed to routing below if all tasks processed.

#### If `comment`

Revise the task content in the staging file based on the user's feedback. Re-present this task.

---

After all tasks processed:

#### If any tasks have `status: approved`

→ Proceed to **D. Create Tasks in Plan**.

#### If all tasks were skipped

Set review status to completed — the review produced a verdict and synthesis tasks were offered, but the user chose to skip them all.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase review --topic {topic} status completed
```

Commit the staging file updates:

```
review({work_unit}): synthesis cycle {N} — tasks skipped
```

**Pipeline continuation** — Invoke the bridge:

```
Pipeline bridge for: {work_unit}
Completed phase: review

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

---

## D. Create Tasks in Plan

For approved tasks in the staging file, invoke the task writer.

1. Filter staging file to tasks with `status: approved`
2. Load **[invoke-review-task-writer.md](invoke-review-task-writer.md)** and follow its instructions as written.

> **CHECKPOINT**: Do not proceed until the task writer has returned.

Commit all changes (staging file, plan tasks, Plan Index Files):

```
review({work_unit}): add review remediation ({K} tasks)
```

→ Proceed to **E. Re-open Implementation + Plan Mode Handoff**.

---

## E. Re-open Implementation + Plan Mode Handoff

For each plan that received new tasks:

1. Read the implementation tracking file at `.workflows/{work_unit}/implementation/{topic}/implementation.md`
2. Update the manifest via CLI:
   - `node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} status in-progress`
   - `node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} updated {today's date}`
   - `node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} analysis_cycle 0`
3. Commit tracking changes:

```
review({work_unit}): re-open implementation tracking
```

Then enter plan mode and write the following plan:

```
# Review Actions Complete: {work_unit}

Review findings have been synthesized into {N} implementation tasks.

## Summary

{Summary, e.g., "tick-core: 3 tasks in Phase 9"}

## Instructions

1. Invoke `workflow-implementation-entry`
2. The skill will detect the new tasks and start executing them

## Context

- Plan updated: {work_unit}
- Tasks created: {total count}
- Implementation tracking: re-opened

## How to proceed

Clear context and continue. Claude will start implementation
and pick up the new review remediation tasks automatically.
```

Exit plan mode. The user will approve and clear context, and the fresh session will pick up with the implementation entry skill routing to the new tasks.
