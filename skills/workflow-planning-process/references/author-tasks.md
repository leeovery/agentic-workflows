# Author Tasks

*Reference for **[workflow-planning-process](../SKILL.md)***

---

This step uses the `workflow-planning-task-author` agent (`../../../agents/workflow-planning-task-author.md`) to write full detail for all tasks in a phase. One sub-agent authors all tasks, writing to a scratch file. The orchestrator then handles per-task approval and format-specific writing to the plan.

---

## A. Prepare the Scratch File

Scratch file path: `.workflows/.cache/{work_unit}/planning/{topic}/phase-{N}.md`

Create the `.workflows/.cache/{work_unit}/planning/{topic}/` directory if it does not exist.

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
5. **Planning file path**: `.workflows/{work_unit}/planning/{topic}/planning.md` — contains all approved phases and the task list for the current phase
6. **Scratch file path**: `.workflows/.cache/{work_unit}/planning/{topic}/phase-{N}.md`

The agent writes all tasks to the scratch file and returns.

→ Proceed to **C. Validate Scratch File**.

---

## C. Validate Scratch File

Read the scratch file and count tasks. Verify task count matches the task table in the planning file for this phase.

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

For each task in the scratch file, in order:

#### If task status is `approved`

Skip — already approved from a previous pass.

→ Return to **E. Approval Loop**.

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

**If `approved` (`y`/`yes`):**

Mark the task `approved` in the scratch file.

→ Return to **E. Approval Loop**.

**If `auto`:**

Mark the task `approved` in the scratch file. Set all remaining `pending` tasks to `approved`. Update `author_gate_mode` in the manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} author_gate_mode auto
```

→ Proceed to **G. Write to Plan**.

**If the user provides feedback:**

Mark the task `rejected` in the scratch file and add the feedback as a blockquote:

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

Check for rejected tasks in the scratch file.

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

> **CHECKPOINT**: If `author_gate_mode: gated`, verify all tasks in the scratch file are marked `approved` before writing.

For each approved task in the scratch file, in order:

1. Read the task content from the scratch file
2. Write to the output format (format-specific — see the format's **[authoring.md](output-formats/{format}/authoring.md)**)
3. Record the internal ID → external ID mapping in the manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} task_map.{internal_id} {external_id}
   ```
4. If the manifest's `external_id` is empty, set it to the external identifier for the plan as exposed by the output format:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} external_id {external_id}
   ```
5. If this is the first task in a phase, record the phase's internal ID → external ID mapping:
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

→ Proceed to **H. Cleanup**.

---

## H. Cleanup

Delete the scratch file: `rm .workflows/.cache/{work_unit}/planning/{topic}/phase-{N}.md`

Remove the `.workflows/.cache/{work_unit}/planning/{topic}/` directory if empty.

→ Return to caller.
