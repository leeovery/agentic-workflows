# Task Loop

*Reference for **[technical-implementation](../SKILL.md)***

---

Follow stages A through E sequentially for each task. Do not abbreviate, skip, or compress stages based on previous iterations.

```
A. Retrieve next task + mark in-progress
B. Execute task → invoke-executor.md
   → Executor Blocked (conditional)
C. Review task → invoke-reviewer.md
   → Review Changes with fix analysis (conditional, fix_gate_mode)
D. Task gate (gated → prompt user / auto → announce)
E. Update progress + phase check + commit
→ loop back to A until done
```

---

## A. Retrieve Next Task

1. Follow the format's **reading.md** instructions to determine the next available task.
2. If no available tasks remain → skip to **When All Tasks Are Complete**.
3. Normalise the task content following **[task-normalisation.md](task-normalisation.md)**.
4. Reset `fix_attempts` to `0` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} fix_attempts 0`).
5. Mark the task as **in-progress** — follow the format's **updating.md** "In Progress" status transition.
6. If the format's updating.md includes a **Phase / Parent Status** section: check whether the task's phase parent needs to be started. If so, follow the format's phase start instructions.

---

## B. Execute Task

1. Load **[invoke-executor.md](invoke-executor.md)** and follow its instructions. Pass the normalised task content.
2. **STOP.** Do not proceed until the executor has returned its result.
3. On receipt of result, route on STATUS:
   - `blocked` or `failed` → follow **Executor Blocked** below
   - `complete` → proceed to **C. Review Task**

### Executor Blocked

> *Output the next fenced block as a code block:*

```
Task {id}: {Task Name} — {blocked/failed}

{executor's ISSUES content}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`r`/`retry`** — Re-invoke the executor with your comments (provide below)
- **`s`/`skip`** — Skip this task and move to the next
- **`t`/`stop`** — Stop implementation entirely
· · · · · · · · · · · ·
```

**STOP.** Wait for user choice.

#### If `retry`

→ Return to the top of **B. Execute Task** and re-invoke the executor with the full task content and the user's comments.

#### If `skip`

→ Proceed to **E. Update Progress and Commit** (mark task as skipped).

#### If `stop`

→ Return to **[the skill](../SKILL.md)** for **Step 8**.

---

## C. Review Task

1. Load **[invoke-reviewer.md](invoke-reviewer.md)** and follow its instructions. Pass the executor's result.
2. **STOP.** Do not proceed until the reviewer has returned its result.
3. On receipt of result, route on VERDICT:
   - `needs-changes` → follow **Review Changes** below
   - `approved` → proceed to **D. Task Gate**

### Review Changes

Increment `fix_attempts` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} fix_attempts {N}`).

> *Output the next fenced block as a code block:*

```
@if(fix_attempts >= 3)
  The executor and reviewer have not converged after {N} attempts. Escalating for human review.
@endif
Review for Task {id}: {Task Name} — needs changes (attempt {N})

{ISSUES from reviewer, including FIX, ALTERNATIVE, and CONFIDENCE for each}

Notes (non-blocking):
{NOTES from reviewer}
```

Check `fix_gate_mode` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase implementation --topic {topic} fix_gate_mode`).

#### If `fix_gate_mode: auto` and `fix_attempts < 3`

→ Return to the top of **B. Execute Task** and re-invoke the executor with the full task content and the reviewer's notes (including fix analysis).

#### If `fix_gate_mode: gated`, or `fix_attempts >= 3`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`y`/`yes`** — Accept the review and fix analysis, pass to executor
- **`a`/`auto`** — Accept and auto-approve future fix analyses
- **`s`/`skip`** — Override the reviewer and proceed as-is
- **Ask** — Ask questions about the review (doesn't accept or reject)
- **Comment** — Accept with adjustments — pass your own direction to the executor alongside the review
· · · · · · · · · · · ·
```

**STOP.** Wait for user choice.

- **`y`/`yes`**: → Return to the top of **B. Execute Task** and re-invoke the executor with the full task content and the reviewer's notes (including fix analysis).
- **`auto`**: Note that `fix_gate_mode` should be updated to `auto` via manifest CLI during the next commit step. → Return to the top of **B. Execute Task** and re-invoke the executor with the full task content and the reviewer's notes (including fix analysis).
- **`skip`**: → Proceed to **D. Task Gate**.
- **Ask**: Answer the user's questions about the review. When complete, re-present the Review Changes options above. Repeat until the user selects a terminal option (`yes`, `auto`, `skip`, or Comment).
- **Comment**: → Return to the top of **B. Execute Task** and re-invoke the executor with the full task content, the reviewer's notes, and the user's commentary.

---

## D. Task Gate

After the reviewer approves a task, present the result:

> *Output the next fenced block as a code block:*

```
Task {id}: {Task Name} — approved

Phase: {phase number} — {phase name}
{executor's SUMMARY — brief commentary, decisions, implementation notes}
```

Check the `task_gate_mode` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase implementation --topic {topic} task_gate_mode`).

#### If `task_gate_mode: auto`

→ Proceed to **E. Update Progress and Commit**.

#### If `task_gate_mode: gated`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**Options:**
- **`y`/`yes`** — Approve, commit, continue to next task
- **`a`/`auto`** — Approve this and all future tasks automatically (skips review prompts and questions)
- **Ask** — Ask questions about the implementation (doesn't approve or reject)
- **Comment** — Request changes — pass feedback or commentary (triggers a fix round)
· · · · · · · · · · · ·
```

**STOP.** Wait for user input.

- **`y`/`yes`**: → Proceed to **E. Update Progress and Commit**.
- **`auto`**: Note that `task_gate_mode` should be updated to `auto` via manifest CLI during the commit step. → Proceed to **E. Update Progress and Commit**.
- **Ask**: Answer the user's questions about the implementation. When complete, re-present the Task Gate options above. Repeat until the user selects a terminal option (`yes`, `auto`, or Comment).
- **Comment**: → Return to the top of **B. Execute Task** and re-invoke the executor with the full task content and the user's feedback.

---

## E. Update Progress and Commit

**Update task progress in the plan** — follow the format's **updating.md** instructions to mark the task complete.

**Check for phase completion** — use the format's **reading.md** to list remaining tasks in the current phase. If no tasks remain open or in-progress:
- If the format's updating.md includes a **Phase / Parent Status** section, follow its phase completion instructions

**Update implementation state via manifest CLI**:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} current_phase {N}
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} current_task {next-task-id or ~}
node .claude/skills/workflow-manifest/scripts/manifest.js push {work_unit} --phase implementation --topic {topic} completed_tasks "{task-id}"
```
- If the current phase has no remaining open/in-progress tasks: `node .claude/skills/workflow-manifest/scripts/manifest.js push {work_unit} --phase implementation --topic {topic} completed_phases {N}`
- If user chose `auto` at the task gate this turn: `node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} task_gate_mode auto`
- If user chose `auto` at the fix gate this turn: `node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} fix_gate_mode auto`

**Commit all changes** in a single commit:

```
impl({work_unit}): T{task-id} — {brief description}
```

Code, tests, plan progress, and implementation file — one commit per approved task.

This is the end of this iteration.

→ Proceed to **A. Retrieve Next Task** and follow the instructions as written.

---

## When All Tasks Are Complete

> *Output the next fenced block as a code block:*

```
All tasks complete. {M} tasks implemented.
```

→ Return to **[the skill](../SKILL.md)** for **Step 7**.
