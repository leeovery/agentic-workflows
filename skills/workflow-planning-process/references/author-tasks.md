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

Read the task detail file and count tasks. Verify task count matches the task table in the planning file for this phase. Track the number of agent invocations for this phase in-conversation.

#### If `valid`

→ Proceed to **D. Check Gate Mode**.

#### If `mismatch` and fewer than 2 agent invocations have been made

→ Return to **B. Invoke the Agent**.

#### If `mismatch` after 2 agent invocations

> *Output the next fenced block as a code block:*

```
Task count mismatch persists after 2 authoring attempts.

Planning file task table: {N} tasks — {internal IDs from the table}
Task detail file:         {M} tasks — {internal IDs found in the file}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
How would you like to proceed?

- **`r`/`retry`** — Re-invoke the author agent once more
- **Adjust** — Tell me what to correct (the task table or the detail file), and I'll apply it and re-validate
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `retry`:**

→ Return to **B. Invoke the Agent**.

**If adjust:**

Apply the user's correction.

→ Return to **C. Validate Task Detail File**.

---

## D. Check Gate Mode

Check `author_gate_mode` via `engine manifest`:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} author_gate_mode
```

#### If `author_gate_mode` is `auto`

Set every `pending` task in the task detail file to `approved`.

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

Render the gate and emit the section verbatim:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render author-task-gate {work_unit}.planning.{topic} --m {M} --total {total} --title "{Task Name}"
```

**STOP.** Wait for user response.

**If `yes`:**

Mark the task `approved` in the task detail file.

→ Return to **E. Approval Loop**.

**If `auto`:**

Mark the task `approved` in the task detail file. Set all remaining `pending` tasks to `approved`. Update `author_gate_mode` in the manifest:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} author_gate_mode auto
```

→ Proceed to **F. Revision Check** (earlier `rejected` tasks still need revision before writing).

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

Authoring for this phase is **incomplete** — report that to the caller.

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

> **CHECKPOINT**: Verify all tasks in the task detail file are marked `approved` before writing — both gate modes approve every task before reaching this section.

For each approved task in the task detail file, in order:

1. Read the task content from the task detail file
2. Write to the output format (format-specific — see the format's **[authoring.md](output-formats/{format}/authoring.md)**)
3. Record the task's manifest updates in one batched write, all under `{work_unit}.planning.{topic}`:
   - `task_map.{internal_id}` — this task's external ID
   - `task` — the next pending task's internal ID (the next phase's position is set by **D. Advance Phase** when this was the phase's last task)

   On the **phase's first task**, fold the once-per-phase phase mapping into the same write — `task_map.{phase_internal_id}` = the phase's external ID (declared in the format's **[authoring.md](output-formats/{format}/authoring.md)** Phase Structure section); it is identical for every task in the phase, so it is written once, not per task. And on the very first task authored for the plan, when the manifest's `external_id` is still empty, also fold in `external_id` = the plan's external identifier as exposed by the output format. Drop each extra field from a task's write once it no longer applies — the phase mapping after the phase's first task, the plan `external_id` once it is set.
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} task_map.{internal_id}={external_id} task={next_task_id} task_map.{phase_internal_id}={phase_external_id} external_id={plan_external_id}
   ```
4. Commit with raw git — the format's task storage may live outside the work unit, so the scoped helper cannot cover it. Stage the format's storage and the work unit, then commit:
   ```bash
   git add -- .workflows/{work_unit} {format task storage paths}
   git commit -m "planning({work_unit}): author task {internal_id} ({task name})"
   ```

> *Output the next fenced block as a code block:*

```
Task {M} of {total}: {Task Name} — authored.
```

Repeat for each task.

Authoring for this phase is **complete** — report that to the caller.

→ Return to caller.
