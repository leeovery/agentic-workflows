# Author Tasks

*Reference for **[workflow-planning-process](../SKILL.md)***

---

This step uses the `workflow-planning-task-author` agent (`../../../agents/workflow-planning-task-author.md`) to write full detail for all tasks in a phase. One sub-agent authors all tasks, writing to a per-phase task detail file. The orchestrator then handles per-task approval and format-specific writing to the output format.

---

## A. Prepare the Task Detail File

Task detail file path: `.workflows/{work_unit}/planning/{topic}/phase-{N}-tasks.md`

#### If the file exists and any `staging.author-p{N}` row is `rejected`

A prior session ended mid-revision — the amendment is still owed.

→ Proceed to **F. Revision Check**.

#### If the file exists and `staging.author-p{N}` rows exist and none are `rejected`

Mid-authoring resume — the text and its decisions already stand; re-invoking would rewrite text the user already approved.

→ Proceed to **D. Check Gate Mode**.

#### Otherwise

→ Proceed to **B. Invoke the Agent**.

---

## B. Invoke the Agent

**Amendment runs** — when `staging.author-p{N}` carries `rejected` rows (arrival from **F. Revision Check**, or a mismatch retry from **C** during an amendment), the invocation is an amendment: name those ids via input item 8. All other arrivals are full runs — omit item 8.

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
8. **Amendment context** (amendment runs only): the rejected internal ids being rewritten — any surviving feedback blockquotes sit under their headings in the detail file

The agent writes all tasks to the task detail file and returns.

→ Proceed to **C. Validate Task Detail File**.

---

## C. Validate Task Detail File

Read the task detail file and count tasks. Verify task count matches the task table in the planning file for this phase. Track the number of agent invocations for this phase in-conversation.

#### If `valid`

**On an amendment run** (the manifest still carries `rejected` rows): the rewrite is validated — reset each rejected row to `pending` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} staging.author-p{N}.tasks.{internal_id} pending` per id); in auto mode they approve automatically, like any pending row.

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

Register the phase's authoring state. Read the subtree first (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} staging.author-p{N}` — `set` overwrites, so existing rows carry decisions a resume must keep), then batch-set `pending` for the ids not yet present; skip the call entirely when none are missing:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} staging.author-p{N}.tasks.{internal_id}=pending …
```

Check `author_gate_mode` via `engine manifest`:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} author_gate_mode
```

#### If `author_gate_mode` is `auto`

Approve every `pending` row in one batched write — skip the call entirely when none are `pending` (an all-approved crash resume): `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} staging.author-p{N}.tasks.{internal_id}=approved …`.

> *Output the next fenced block as a code block:*

```
Phase {N}: {count} tasks authored. Auto-approved. Writing to plan.
```

→ Proceed to **G. Write to Plan**.

#### If `author_gate_mode` is `gated`

→ Proceed to **E. Approval Loop**.

---

## E. Approval Loop

For each task in the task detail file, in order, branching on its row in the manifest's `staging.author-p{N}.tasks`:

#### If the row is `approved`

Skip — already approved from a previous pass.

→ Return to **E. Approval Loop**.

#### If the row is `rejected`

Skip — **F. Revision Check** sweeps it into the amendment.

→ Return to **E. Approval Loop**.

#### If the row is `pending`

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

Record the approval: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} staging.author-p{N}.tasks.{internal_id} approved`.

→ Return to **E. Approval Loop**.

**If `auto`:**

Record this task and every remaining `pending` row `approved`, and the gate mode, in one batched write:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} author_gate_mode=auto staging.author-p{N}.tasks.{internal_id}=approved …
```

→ Proceed to **F. Revision Check** (earlier `rejected` tasks still need revision before writing).

**If the user provides feedback:**

Record the rejection (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} staging.author-p{N}.tasks.{internal_id} rejected`) and add the feedback as a blockquote under the task's heading in the detail file:

```markdown
## {internal_id}

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

Read the manifest's `staging.author-p{N}.tasks` for `rejected` rows.

#### If no rejected tasks

→ Proceed to **G. Write to Plan**.

#### If rejected tasks exist

> *Output the next fenced block as a code block:*

```
{count} tasks need revision. Re-invoking author agent...
```

→ Return to **B. Invoke the Agent** for an amendment run.

---

## G. Write to Plan

> **CHECKPOINT**: Verify the manifest marks every `staging.author-p{N}` row `approved` before writing — both gate modes approve every task before reaching this section. A `pending` row means the loop was interrupted — return to **E. Approval Loop**; a `rejected` row still owes its amendment — return to **F. Revision Check**. Never write a partial phase.

For each approved task in the task detail file, in order (crash-resume guard: a task whose internal id is already in `task_map` was written before an interruption — skip its format write and continue with the next; a task missing from `task_map` may still exist in the backend from a crash between its format write and the manifest record — check per the format's **[reading.md](output-formats/{format}/reading.md)** first and, when present, record its external id instead of re-creating):

1. Read the task content from the task detail file
2. Write to the output format (format-specific — see the format's **[authoring.md](output-formats/{format}/authoring.md)**)
3. Record the task's manifest updates in one batched write, all under `{work_unit}.planning.{topic}`:
   - `task_map.{internal_id}` — this task's external ID
   - `task` — the next pending task's internal ID (the next phase's position is set by **D. Advance Phase** when this was the phase's last task)

   On the **phase's first task**, fold the once-per-phase phase mapping into the same write — `task_map.{phase_internal_id}` = the phase's external ID (declared in the format's **[authoring.md](output-formats/{format}/authoring.md)** Phase Structure section); it is identical for every task in the phase, so it is written once, not per task. And on the very first task authored for the plan, when the manifest's `external_id` is still empty, also fold in `external_id` = the plan's external identifier as exposed by the output format. Drop each extra field from a task's write once it no longer applies — the phase mapping after the phase's first task, the plan `external_id` once it is set, and `task=` on the phase's last task (D. Advance Phase sets the next position).
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} task_map.{internal_id}={external_id} task={next_task_id} task_map.{phase_internal_id}={phase_external_id} external_id={plan_external_id}
   ```
4. Commit — `--plan` stages the work unit, the project manifest, and the plan's declared storage in one scoped call:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "planning({work_unit}): author task {internal_id} ({task name})" --plan {topic}
   ```

> *Output the next fenced block as a code block:*

```
Task {M} of {total}: {Task Name} — authored.
```

Repeat for each task.

Authoring for this phase is **complete** — the plan's tasks are the record, so clear the spent authoring state and report completion to the caller:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.planning.{topic} staging.author-p{N}
```

→ Return to caller.
