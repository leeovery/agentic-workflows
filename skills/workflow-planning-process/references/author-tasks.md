# Author Tasks

*Reference for **[workflow-planning-process](../SKILL.md)***

---

This step uses the `workflow-planning-task-author` agent (`../../../agents/workflow-planning-task-author.md`) to write full detail for all tasks in a phase. One sub-agent authors all tasks, writing to a scratch file. The orchestrator then handles per-task approval and format-specific writing to the plan.

---

## A. Prepare the Scratch File

Scratch file path: `.workflows/.cache/planning/{work_unit}/{topic}/phase-{N}.md`

Create the `.workflows/.cache/planning/{work_unit}/{topic}/` directory if it does not exist.

---

## B. Invoke the Agent (Batch)

> *Output the next fenced block as a code block:*

```
Authoring {count} tasks for Phase {N}: {Phase Name}...
```

Invoke `workflow-planning-task-author` with these file paths:

1. **read-specification.md**: `read-specification.md`
2. **Specification**: specification path from the manifest or `.workflows/{work_unit}/specification/{topic}/specification.md`
3. **Cross-cutting specs**: cross-cutting spec paths if any
4. **task-design.md**: `task-design.md`
5. **All approved phases**: the complete phase structure from the Plan Index File body
6. **Task list for current phase**: the approved task table (ALL tasks in the phase)
7. **Scratch file path**: `.workflows/.cache/planning/{work_unit}/{topic}/phase-{N}.md`

The agent writes all tasks to the scratch file and returns.

---

## C. Validate Scratch File

Read the scratch file and count tasks. Verify task count matches the task table in the Plan Index File for this phase.

#### If `mismatch`

Re-invoke the agent with the same inputs.

#### If `valid`

→ Proceed to **D. Check Gate Mode**.

---

## D. Check Gate Mode

Check `author_gate_mode` via manifest CLI:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} author_gate_mode
```

#### If `author_gate_mode: auto`

> *Output the next fenced block as a code block:*

```
Phase {N}: {count} tasks authored. Auto-approved. Writing to plan.
```

→ Proceed to **F. Write to Plan**.

#### If `author_gate_mode: gated`

→ Proceed to **E. Approval Loop**.

---

## E. Approval Loop

For each task in the scratch file, in order:

#### If task status is `approved`

Skip — already approved from a previous pass.

#### If task status is `pending`

Present the full task content:

> *Output the next fenced block as markdown (not a code block):*

```
{task detail from scratch file}
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

#### If approved (`y`/`yes`)

Mark the task `approved` in the scratch file. Continue to the next task.

#### If `auto`

Mark the task `approved` in the scratch file. Set all remaining `pending` tasks to `approved`. Update `author_gate_mode` in the manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} author_gate_mode auto
```

→ Proceed to **F. Write to Plan**.

#### If the user provides feedback

Mark the task `rejected` in the scratch file and add the feedback as a blockquote:

```markdown
## {internal_id} | rejected

> **Feedback**: {user's feedback here}

### Task {task_id}: {Task Name}
...
```

Continue to the next task.

#### If the user navigates

→ Return to **[plan-construction.md](plan-construction.md)**. The scratch file preserves approval state.

---

### Revision

After completing the approval loop, check for rejected tasks.

#### If no rejected tasks

→ Proceed to **F. Write to Plan**.

#### If rejected tasks exist

> *Output the next fenced block as a code block:*

```
{N} tasks need revision. Re-invoking author agent...
```

→ Return to **B. Invoke the Agent (Batch)**. The agent receives the scratch file with rejected tasks and feedback, rewrites only those, and the flow continues through validation, gate check, and approval as normal.

---

## F. Write to Plan

> **CHECKPOINT**: If `author_gate_mode: gated`, verify all tasks in the scratch file are marked `approved` before writing.

For each approved task in the scratch file, in order:

1. Read the task content from the scratch file
2. Write to the output format (format-specific — see the format's **[authoring.md](output-formats/{format}/authoring.md)**)
3. Update the task table in the Plan Index File: set `status: authored` and set `External ID` to the external identifier for the task as exposed by the output format
4. If the manifest's `external_id` is empty, set it to the external identifier for the plan as exposed by the output format:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} external_id {external_id}
   ```
5. If the current phase's `external_id` is empty, set it to the external identifier for the phase as exposed by the output format
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

---

## G. Cleanup

Delete the scratch file: `rm .workflows/.cache/planning/{work_unit}/{topic}/phase-{N}.md`

Remove the `.workflows/.cache/planning/{work_unit}/{topic}/` directory if empty.

→ Return to **[plan-construction.md](plan-construction.md)**.
