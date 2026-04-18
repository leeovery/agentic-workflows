# Task Loop

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

Follow stages A through H sequentially for each task. Do not abbreviate, skip, or compress stages based on previous iterations.

```
A. Retrieve next task + mark in-progress
B. Execute task → invoke-executor.md
C. Handle executor block (conditional)
D. Review task → invoke-reviewer.md
E. Evaluate review changes (conditional, fix_gate_mode)
F. Fix approval gate (gated prompt)
G. Task gate (gated → prompt user / auto → announce)
H. Update progress + phase check + commit
→ loop back to A until done
```

---

## A. Retrieve Next Task

Read the plan's `external_id` via manifest CLI:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.planning.{topic} external_id
```

Follow the format's **reading.md** instructions to determine the next available task.

#### If no available tasks remain

→ Proceed to **I. All Tasks Complete**.

#### If a task is available

1. Normalise the task content following **[task-normalisation.md](task-normalisation.md)**.
2. Reset `fix_attempts` to `0` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.implementation.{topic} fix_attempts 0`).
3. Delete any existing fix tracking cache file for this task: `.workflows/.cache/{work_unit}/implementation/{topic}/fix-tracking-{internal_id}.md` (clean slate per task).
4. Mark the task as in-progress — follow the format's **updating.md** status transition.

→ Proceed to **B. Execute Task**.

---

## B. Execute Task

→ Load **[invoke-executor.md](invoke-executor.md)** and follow its instructions as written. Pass the normalised task content.

> **CHECKPOINT**: Do not proceed until the executor has returned its result.

#### If `STATUS` is `blocked` or `failed`

→ Proceed to **C. Handle Executor Block**.

#### If `STATUS` is `complete`

→ Proceed to **D. Review Task**.

---

## C. Handle Executor Block

> *Output the next fenced block as a code block:*

```
Task {internal_id}: {Task Name} — {blocked/failed}

{executor's ISSUES content}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Task failed. How would you like to proceed?

- **`r`/`retry`** — Re-invoke the executor with your comments (provide below)
- **`s`/`skip`** — Skip this task and move to the next
- **`t`/`stop`** — Stop implementation entirely
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `retry`

→ Return to **B. Execute Task**.

#### If `skip`

→ Proceed to **H. Update Progress and Commit** (mark task as skipped).

#### If `stop`

→ Return to **[the skill](../SKILL.md)** for **Step 9**.

---

## D. Review Task

→ Load **[invoke-reviewer.md](invoke-reviewer.md)** and follow its instructions as written. Pass the executor's result.

> **CHECKPOINT**: Do not proceed until the reviewer has returned its result.

#### If `VERDICT` is `needs-changes`

→ Proceed to **E. Evaluate Review Changes**.

#### If `VERDICT` is `approved`

→ Proceed to **G. Task Gate**.

---

## E. Evaluate Review Changes

Increment `fix_attempts` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.implementation.{topic} fix_attempts {N}`).

**Persist fix tracking** — Append the reviewer's findings to the fix tracking cache file at `.workflows/.cache/{work_unit}/implementation/{topic}/fix-tracking-{internal_id}.md`. If the file does not exist, create it. Append a section for this attempt:

```markdown
## Attempt {N}

ISSUES:
{copy ISSUES from reviewer output, including FIX, ALTERNATIVE, and CONFIDENCE per issue}

NOTES:
{copy NOTES from reviewer output}
```

#### If `fix_attempts` >= 3

→ Load **[convergence-analysis.md](../../workflow-shared/references/convergence-analysis.md)** with loop_type = `fix`, work_unit = `{work_unit}`, topic = `{topic}`, internal_id = `{internal_id}`.

> *Output the next fenced block as a code block:*

```
Review for Task {internal_id}: {Task Name} — needs changes (attempt {N})

{ISSUES from reviewer, including FIX, ALTERNATIVE, and CONFIDENCE for each}

Notes (non-blocking):
{NOTES from reviewer}
```

→ Proceed to **F. Fix Approval Gate**.

#### If `fix_attempts` < 3

> *Output the next fenced block as a code block:*

```
Review for Task {internal_id}: {Task Name} — needs changes (attempt {N})

{ISSUES from reviewer, including FIX, ALTERNATIVE, and CONFIDENCE for each}

Notes (non-blocking):
{NOTES from reviewer}
```

Check `fix_gate_mode` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.implementation.{topic} fix_gate_mode`).

**If `fix_gate_mode` is `auto`:**

→ Return to **B. Execute Task**.

**If `fix_gate_mode` is `gated`:**

→ Proceed to **F. Fix Approval Gate**.

---

## F. Fix Approval Gate

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Accept the reviewer's fix analysis?

- **`y`/`yes`** — Pass to executor
- **`a`/`auto`** — Accept and auto-approve future fix analyses
- **`s`/`skip`** — Override the reviewer and proceed as-is
- **Ask** — Ask questions about the review (doesn't accept or reject)
- **Comment** — Accept with adjustments — pass your own direction alongside the review
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

→ Return to **B. Execute Task**.

#### If `auto`

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.implementation.{topic} fix_gate_mode auto
```

→ Return to **B. Execute Task**.

#### If `skip`

→ Proceed to **G. Task Gate**.

#### If ask

Answer the user's questions about the review.

→ Return to **F. Fix Approval Gate**.

#### If comment

Include the reviewer's notes and the user's commentary when re-invoking.

→ Return to **B. Execute Task**.

---

## G. Task Gate

After the reviewer approves a task, present the result:

> *Output the next fenced block as a code block:*

```
Task {internal_id}: {Task Name} — approved

Phase: {phase number} — {phase name}
{executor's SUMMARY — brief commentary, decisions, implementation notes}
```

Check the `task_gate_mode` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.implementation.{topic} task_gate_mode`).

#### If `task_gate_mode` is `auto`

→ Proceed to **H. Update Progress and Commit**.

#### If `task_gate_mode` is `gated`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Approve this task?

- **`y`/`yes`** — Commit and continue to next task
- **`a`/`auto`** — Approve this and all future tasks automatically
- **Ask** — Ask questions about the implementation (doesn't approve or reject)
- **Comment** — Request changes (triggers a fix round)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **H. Update Progress and Commit**.

**If `auto`:**

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.implementation.{topic} task_gate_mode auto
```

→ Proceed to **H. Update Progress and Commit**.

**If ask:**

Answer the user's questions about the implementation.

→ Return to **G. Task Gate**.

**If comment:**

Include the user's feedback when re-invoking.

→ Return to **B. Execute Task**.

---

## H. Update Progress and Commit

**Update task progress in the plan** — follow the format's **updating.md** instructions to mark the task complete.

**Check for phase completion** — use the format's **reading.md** to list remaining tasks in the current phase. If no tasks remain open or in-progress, follow the format's **updating.md** instructions for phase completion.

**Internal ID convention**: The internal ID used in `completed_tasks`, `current_task`, and commit messages MUST use the format `{topic}-{phase_id}-{task_id}`. If the format adapter returns an external ID, resolve the internal ID via the manifest CLI:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs key-of {work_unit}.planning.{topic} task_map {external_id}
```

**Update implementation state via manifest CLI**:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.implementation.{topic} current_phase {N}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.implementation.{topic} current_task '{next_task_id or ~}'
node .claude/skills/workflow-manifest/scripts/manifest.cjs push {work_unit}.implementation.{topic} completed_tasks "{internal_id}"
```
If the current phase has no remaining open/in-progress tasks: `node .claude/skills/workflow-manifest/scripts/manifest.cjs push {work_unit}.implementation.{topic} completed_phases {N}`

**Commit all changes** in a single commit:

```
impl({work_unit}): T{internal_id} — {brief description}
```

Code, tests, and plan progress — one commit per approved task.

→ Return to **A. Retrieve Next Task**.

---

## I. All Tasks Complete

> *Output the next fenced block as a code block:*

```
All tasks complete. {M} tasks implemented.
```

**CRITICAL**: The caller always routes to the analysis loop after task loop completion — on every pass, not just the first. Even if you have already been through this cycle before, return to the caller and let it route to the analysis loop. Never skip ahead to completion from here.

→ Return to caller.
