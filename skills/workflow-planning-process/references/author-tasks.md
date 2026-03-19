# Author Tasks

*Reference for **[workflow-planning-process](../SKILL.md)***

---

This step uses the `workflow-planning-task-author` agent (`../../../agents/workflow-planning-task-author.md`) to write full detail for all tasks in a phase. One sub-agent authors all tasks, writing to a per-phase task detail file. The orchestrator then handles per-task approval and format-specific writing to the output format.

---

## A. Prepare the Task Detail File

Task detail file path: `.workflows/{work_unit}/planning/{topic}/phase-{N}-tasks.md`

→ Proceed to **B. Invoke the Agent**.

---

## B. Invoke the Agent

> *Output the next fenced block as a code block:*

```
Authoring {count} tasks for Phase {N}: {Phase Name}...
```

Invoke `workflow-planning-task-author` with these file paths:

1. **read-specification.md**: `read-specification.md`
2. **Specification**: specification path from the manifest or `.workflows/{work_unit}/specification/{topic}/specification.md`
3. **Cross-cutting specs**: cross-cutting spec paths if any
4. **task-design.md**: `task-design.md`
5. **All approved phases**: the complete phase structure from the planning file body
6. **Task list for current phase**: the task table for this specific phase from the planning file
7. **Task detail file path**: `.workflows/{work_unit}/planning/{topic}/phase-{N}-tasks.md`

The agent writes all tasks to the task detail file and returns.

→ Proceed to **C. Validate Task Detail File**.

---

## C. Validate Task Detail File

Read the task detail file and count tasks. Verify task count matches the task table in the planning file for this phase.

#### If `mismatch`

→ Return to **B. Invoke the Agent**.

#### If `valid`

→ Proceed to **D. Check Gate Mode**.

---

## D. Check Gate Mode

Check `author_gate_mode` via manifest CLI:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} author_gate_mode
```

#### If `author_gate_mode` is `auto`

> *Output the next fenced block as a code block:*

```
Phase {N}: {count} tasks authored. Auto-approved. Writing to plan.
```

→ Proceed to **G. Write to Plan**.

#### If `author_gate_mode` is `gated`

→ Proceed to **E. Approval Loop**.

---

## E. Approval Loop

For each task in the task detail file, in order:

#### If task status is `approved`

Skip — already approved from a previous pass.

→ Return to **E. Approval Loop**.

#### If task status is `pending`

Present the full task content:

> *Output the next fenced block as markdown (not a code block):*

```
{task detail from task detail file}
```

**Task {M} of {total}: {Task Name}**

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Approve this task?

- **`y`/`yes`** — Write it to the plan
- **`a`/`auto`** — Approve this and all remaining tasks automatically
- **Tell me what to change** — Revise this task's detail
- **Navigate** — a different phase or task, or the leading edge
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `approved` (`y`/`yes`):**

Mark the task `approved` in the task detail file.

→ Return to **E. Approval Loop**.

**If `auto`:**

Mark the task `approved` in the task detail file. Set all remaining `pending` tasks to `approved`. Update `author_gate_mode` in the manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} author_gate_mode auto
```

→ Proceed to **G. Write to Plan**.

**If the user provides feedback:**

Mark the task `rejected` in the task detail file and add the feedback as a blockquote:

```markdown
## {internal_id} | rejected

> **Feedback**: {user's feedback here}

### Task {task_id}: {Task Name}
...
```

→ Return to **E. Approval Loop**.

**If the user navigates:**

→ Return to caller.

When all tasks are processed:

→ Proceed to **F. Revision Check**.

---

## F. Revision Check

Check for rejected tasks in the task detail file.

#### If no rejected tasks

→ Proceed to **G. Write to Plan**.

#### If rejected tasks exist

> *Output the next fenced block as a code block:*

```
{N} tasks need revision. Re-invoking author agent...
```

→ Return to **B. Invoke the Agent**.

---

## G. Write to Plan

> **CHECKPOINT**: If `author_gate_mode: gated`, verify all tasks in the task detail file are marked `approved` before writing.

For each approved task in the task detail file, in order:

1. Read the task content from the task detail file
2. Write to the output format (format-specific — see the format's **[authoring.md](output-formats/{format}/authoring.md)**)
3. Record the internal ID → external ID mapping in the manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} task_map.{internal_id} {external_id}
   ```
4. If the manifest's `external_id` is empty, set it to the external identifier for the plan as exposed by the output format:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} external_id {external_id}
   ```
5. Record the phase's internal ID → external ID mapping in the manifest (the external identifier is declared in the format's **[authoring.md](output-formats/{format}/authoring.md)** Phase Structure section):
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} task_map.{phase_internal_id} {phase_external_id}
   ```
6. Advance the manifest planning position to the next pending task (or next phase if this was the last task):
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} task {next_task_id}
   ```
7. Commit: `planning({work_unit}): author task {internal_id} ({task name})`

> *Output the next fenced block as a code block:*

```
Task {M} of {total}: {Task Name} — authored.
```

Repeat for each task.

→ Return to caller.
