# Review Actions Loop

*Reference for **[workflow-review-process](../SKILL.md)***

---

After a review is complete, this loop synthesizes findings into actionable tasks.

Stages A through G run sequentially. Always start at **A. Verdict Gate**.

```
A. Verdict gate (check verdicts, offer synthesis)
B. Dispatch review synthesizer → invoke-review-synthesizer.md
C. Approval overview
D. Process task (per-task approval loop)
E. Route on results
F. Create tasks in plan → invoke-review-task-writer.md
G. Re-open implementation + plan mode handoff
```

---

## A. Verdict Gate

Check the verdict(s) from the review(s) being analyzed.

#### If all verdicts are `Approve` with no required changes

> *Output the next fenced block as a code block:*

```
No actionable findings. All reviews passed with no required changes.
```

Mark the review completed — the engine sets the status:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} review {topic}
```

Commit the completion:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): complete review phase"
```

**Pipeline continuation** — Invoke the bridge:

```
Pipeline bridge for: {work_unit}
Completed phase: review

Invoke the workflow-bridge skill to enter plan mode with completion confirmation.
```

**STOP.** Do not proceed — terminal condition.

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

**If `yes`:**

→ Proceed to **B. Dispatch Review Synthesizer**.

**If `no`:**

Mark the review completed:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} review {topic}
```

Commit the completion:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): complete review phase"
```

**Pipeline continuation** — Invoke the bridge:

```
Pipeline bridge for: {work_unit}
Completed phase: review

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

**STOP.** Do not proceed — terminal condition.

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

**If `yes`:**

→ Proceed to **B. Dispatch Review Synthesizer**.

**If `no`:**

Mark the review completed:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} review {topic}
```

Commit the completion:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): complete review phase"
```

**Pipeline continuation** — Invoke the bridge:

```
Pipeline bridge for: {work_unit}
Completed phase: review

Invoke the workflow-bridge skill to enter plan mode with completion confirmation.
```

**STOP.** Do not proceed — terminal condition.

---

## B. Dispatch Review Synthesizer

→ Load **[invoke-review-synthesizer.md](invoke-review-synthesizer.md)** and follow its instructions as written.

> **CHECKPOINT**: Do not proceed until the synthesizer has returned.

#### If `STATUS` is `clean`

No actionable tasks from synthesis. Mark the review completed:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} review {topic}
```

Commit the completion:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): complete review phase"
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

**STOP.** Do not proceed — terminal condition.

#### If `STATUS` is `tasks_proposed`

→ Proceed to **C. Approval Overview**.

---

## C. Approval Overview

Read the staging file from `.workflows/{work_unit}/implementation/{topic}/review-tasks-c{cycle-number}.md`.

> *Output the next fenced block as a code block:*

```
Review synthesis cycle {N}: {K} proposed tasks

  1. {title} ({severity})
  2. {title} ({severity})
```

→ Proceed to **D. Process Task**.

---

## D. Process Task

#### If no pending tasks remain

→ Proceed to **E. Route on Results**.

Present the next pending task:

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

Check `gate_mode` in the staging file frontmatter (`gated` or `auto`).

#### If `gate_mode` is `auto`

Update `status: approved` in the staging file.

> *Output the next fenced block as a code block:*

```
Task {current} of {total}: {title} — approved [auto].
```

→ Return to **D. Process Task**.

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

**If `yes`:**

Update `status: approved` in the staging file.

→ Return to **D. Process Task**.

**If `auto`:**

Update `status: approved` in the staging file. Update `gate_mode: auto` in the staging file frontmatter.

→ Return to **D. Process Task**.

**If `skip`:**

Update `status: skipped` in the staging file.

→ Return to **D. Process Task**.

**If comment:**

Revise the task content in the staging file based on the user's feedback.

→ Return to **D. Process Task**.

---

## E. Route on Results

#### If any tasks have `status: approved`

→ Proceed to **F. Create Tasks in Plan**.

#### If all tasks were skipped

Mark the review completed:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} review {topic}
```

Commit the staging file updates:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): synthesis cycle {N} — tasks skipped"
```

**Pipeline continuation** — Invoke the bridge:

```
Pipeline bridge for: {work_unit}
Completed phase: review

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

**STOP.** Do not proceed — terminal condition.

---

## F. Create Tasks in Plan

Filter staging file to tasks with `status: approved`.

→ Load **[invoke-review-task-writer.md](invoke-review-task-writer.md)** and follow its instructions as written.

> **CHECKPOINT**: Do not proceed until the task writer has returned.

Commit all changes (staging file, plan tasks, task_map updates) with raw git — the format's task storage may live outside the work unit, so the scoped helper cannot cover it. Stage the format's storage and the work unit, then commit:

```bash
git add -- .workflows/{work_unit} {format task storage paths}
git commit -m "review({work_unit}): add review remediation ({K} tasks)"
```

→ Proceed to **G. Re-open Implementation**.

---

## G. Re-open Implementation

For each plan that received new tasks:

1. Update the manifest via CLI:
   - `node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.implementation.{topic} status in-progress`
   - `node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.implementation.{topic} updated {today's date}`
2. Commit tracking changes:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): re-open implementation tracking"
```

Then enter plan mode and write the following plan:

```
# Review Actions Complete: {work_unit}

Review findings have been synthesized into {N} implementation tasks.

## Summary

{Summary, e.g., "auth-flow: 3 tasks in Phase 9"}

## Instructions

1. Invoke `workflow-implementation-entry`
2. The skill will detect the new tasks and start executing them

## Context

- Plan updated: {work_unit}
- Tasks created: {total count}
- Implementation tracking: re-opened

## How to proceed

Clear context and continue. The fresh session will start
implementation and pick up the new review remediation tasks
automatically.
```

Exit plan mode. The user will approve and clear context, and the fresh session will pick up with the implementation entry skill routing to the new tasks.
