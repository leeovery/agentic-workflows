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

Read the plan's `external_id` via `engine manifest`:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} external_id
```

Follow the format's **reading.md** instructions to determine the next available task.

#### If no available tasks remain

→ Proceed to **I. All Tasks Complete**.

#### If a task is available

1. Normalise the task content following **[task-normalisation.md](task-normalisation.md)**.
2. Start the task via the engine (resets `fix_attempts`, clears the task's fix tracking cache file — clean slate per task):
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs task start {work_unit} {topic} {internal_id}
   ```
   The response's `gates` carry `task_gate_mode` and `fix_gate_mode` — stages E and G branch on these values. Do not re-read them mid-task: an `a`/`auto` opt-in is made by this flow itself, so you already know the current mode.
3. Mark the task as in-progress — follow the format's **updating.md** status transition.

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

→ Return to **[the skill](../SKILL.md)** for **Step 8**.

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

Write the reviewer's findings to `.workflows/.cache/{work_unit}/implementation/{topic}/attempt-findings.md`:

```markdown
ISSUES:
{copy ISSUES from reviewer output, including FIX, ALTERNATIVE, and CONFIDENCE per issue}

NOTES:
{copy NOTES from reviewer output}
```

Record the attempt via the engine (increments `fix_attempts` and appends the findings to the task's fix tracking file under a `## Attempt {N}` section):
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs task fix-attempt {work_unit} {topic} {internal_id} --findings-file .workflows/.cache/{work_unit}/implementation/{topic}/attempt-findings.md
```

`{N}` below is the response's `attempts`.

#### If the response's `threshold_reached` is `true`

→ Load **[convergence-analysis.md](../../workflow-shared/references/convergence-analysis.md)** with loop_type = `fix`, work_unit = `{work_unit}`, topic = `{topic}`, internal_id = `{internal_id}`.

> *Output the next fenced block as a code block:*

```
Review for Task {internal_id}: {Task Name} — needs changes (attempt {N})

{ISSUES from reviewer, including FIX, ALTERNATIVE, and CONFIDENCE for each}

Notes (non-blocking):
{NOTES from reviewer}
```

→ Proceed to **F. Fix Approval Gate**.

#### If the response's `threshold_reached` is `false`

> *Output the next fenced block as a code block:*

```
Review for Task {internal_id}: {Task Name} — needs changes (attempt {N})

{ISSUES from reviewer, including FIX, ALTERNATIVE, and CONFIDENCE for each}

Notes (non-blocking):
{NOTES from reviewer}
```

Branch on the response's `fix_gate_mode`.

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
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} fix_gate_mode auto
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

Branch on the `task_gate_mode` carried by this task's `start` response.

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
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} task_gate_mode auto
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

**Record progress via the engine** — add `--phase-complete` when the current phase has no remaining open/in-progress tasks, and `--skipped` when the task was skipped rather than implemented:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs task complete {work_unit} {topic} {internal_id} --phase {N} --next-task '{next_task_id or ~}' [--skipped] [--phase-complete]
```

**Internal ID convention**: The internal ID used with the engine and in commit messages MUST use the format `{topic}-{phase_id}-{task_id}`. If only the format adapter's external ID is at hand, pass `--external {external_id}` in place of `{internal_id}` — the engine resolves it through the plan's task map and reports the internal id in its response.

**Commit all changes** with raw git — stage the task's code and tests, the plan format's tracking state, and the work unit's manifest, then commit:

```
impl({work_unit}): T{internal_id} — {brief description}
```

One commit per approved task. Never `engine commit` here — its scopes cover `.workflows` only, never code or the plan format's storage.

→ Return to **A. Retrieve Next Task**.

---

## I. All Tasks Complete

> *Output the next fenced block as a code block:*

```
All tasks complete. {M} tasks implemented.
```

**CRITICAL**: The caller always routes to the analysis loop after task loop completion — on every pass, not just the first. Even if you have already been through this cycle before, return to the caller and let it route to the analysis loop. Never skip ahead to completion from here.

→ Return to caller.
