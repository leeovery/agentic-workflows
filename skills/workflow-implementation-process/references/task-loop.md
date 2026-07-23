# Task Loop

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

Follow stages A through H sequentially for each task. Do not abbreviate, skip, or compress stages based on previous iterations.

At loop entry (crash-resume healing): if the plan marks tasks done that the manifest's `completed_tasks` lacks, run `engine task complete` for each missing internal id before retrieving the next task — the push is an idempotent no-op for ids already recorded, and this reseals the seam a crash between the plan mark and the bookkeeping can leave.

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

**Engine gate sections**: `engine task` responses carry rendered `=== DISPLAY … ===` / `=== MENU … ===` sections after their JSON line — the loop's state-derived gates, parameterised from manifest state. Emit a section only where a stage below prescribes it: DISPLAY verbatim as a code block, MENU verbatim as markdown (not a code block). A section is everything beneath its `===` marker up to the next marker or the end of the response — the marker lines themselves are never emitted. Section content is emitted byte-for-byte — never redrawn, reflowed, or re-derived.

→ Load **[product-lens.md](../../workflow-shared/references/product-lens.md)** and follow its instructions as written — the register for the review and task-result retellings in **E** and **G**. Findings cache files and records stay fully technical.

Read `work_type` once here at loop entry — it selects the executor's workflow reference (TDD vs verification) for every task and never changes mid-loop, so **[invoke-executor.md](invoke-executor.md)** consumes it from session context rather than re-reading it per invocation:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit} work_type
```

---

## A. Retrieve Next Task

Read the plan's `external_id` via `engine manifest`:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} external_id
```

Follow the format's **reading.md** instructions to determine the next available task.

#### If no available tasks remain

"No available tasks" is not the same as "all tasks complete". Using the format's **reading.md**, list all tasks and check for tasks still open or in-progress — these are blocked: excluded from "next available" because a dependency was skipped, cancelled, or otherwise never reached the format's completed status.

**If no open or in-progress tasks remain:**

→ Proceed to **I. All Tasks Complete**.

**If open or in-progress tasks remain (blocked):**

> *Output the next fenced block as a code block:*

```
No ready tasks remain, but {N} task(s) are still open — blocked:

  {internal_id}: {Task Name}
  └─ Blocked by {blocker_id} [{blocker status}]

  ...
```

Emit the `MENU: blocked tasks` section carried by this session's most recent `task init` or `task complete` response.

**STOP.** Wait for user response.

**If `proceed`:**

Treat the first blocked task as the available task.

→ Proceed to the **If a task is available** flow below.

**If `skip`:**

Take the first blocked task as the one to skip.

→ Proceed to **H. Update Progress and Commit** (mark task as skipped).

Stage A re-detects any remaining blocked tasks on the loop back.

**If `stop`:**

→ Return to **[the skill](../SKILL.md)** for **Step 8**.

#### If a task is available

1. Normalise the task content following **[task-normalisation.md](task-normalisation.md)**.
2. Start the task via the engine (records the task as `current_task`; a fresh task gets a clean slate — `fix_attempts` reset, fix tracking cache file cleared; re-starting the in-flight task — already `current_task` with its tracking file on disk — preserves both, so a re-run is safe):
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs task start {work_unit} {topic} {internal_id}
   ```
   The response's `gates` carry `task_gate_mode` and `fix_gate_mode` — stages E and G branch on these values. Do not re-read them mid-task: an `a`/`auto` opt-in is made by this flow itself, so you already know the current mode. When the task gate is `gated`, the response also carries the `MENU: task gate` section that **G. Task Gate** emits — never emit it here.
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
Task {status:[blocked|failed]}. How would you like to proceed?

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

`{N}` below is the response's `attempts`. The response also carries the `MENU: fix gate` section that **F. Fix Approval Gate** emits — never emit it here.

#### If the response's `threshold_reached` is `true`

Emit the response's `DISPLAY: fix threshold` section.

→ Load **[convergence-analysis.md](../../workflow-shared/references/convergence-analysis.md)** with loop_type = `fix`, work_unit = `{work_unit}`, topic = `{topic}`, internal_id = `{internal_id}`.

> *Output the next fenced block as a code block:*

```
Review for Task {internal_id}: {Task Name} — needs changes (attempt {N})
```

Retell the reviewer's findings as a product-lens markdown narrative (not a code block): each issue as what is wrong or at risk in what was built, with the proposed fix, any alternative, and the reviewer's confidence; non-blocking notes last.

→ On return, proceed to **F. Fix Approval Gate**.

#### If the response's `threshold_reached` is `false`

> *Output the next fenced block as a code block:*

```
Review for Task {internal_id}: {Task Name} — needs changes (attempt {N})
```

Retell the reviewer's findings as a product-lens markdown narrative (not a code block): each issue as what is wrong or at risk in what was built, with the proposed fix, any alternative, and the reviewer's confidence; non-blocking notes last.

Branch on the response's `fix_gate_mode`.

**If `fix_gate_mode` is `auto`:**

→ Return to **B. Execute Task**.

**If `fix_gate_mode` is `gated`:**

→ Proceed to **F. Fix Approval Gate**.

---

## F. Fix Approval Gate

Emit the `MENU: fix gate` section from this task's most recent `fix-attempt` response. The `a`/`auto` option is present only while the fix gate is `gated` — a threshold-forced gate in auto mode omits it.

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

#### If `technical`

→ Load **[technical-lens.md](../../workflow-shared/references/technical-lens.md)** and follow its instructions as written.

Retell the reviewer's findings through the technical lens — mechanism-first, from the attempt findings.

→ Return to **F. Fix Approval Gate**.

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
```

Retell the executor's SUMMARY as a product-lens markdown narrative (not a code block): what the product now does that it didn't before, the decisions worth knowing, and how it was verified. After a fix round, include what changed since the last gate.

Branch on the `task_gate_mode` carried by this task's `start` response.

#### If `task_gate_mode` is `auto`

→ Proceed to **H. Update Progress and Commit**.

#### If `task_gate_mode` is `gated`

Emit the `MENU: task gate` section from this task's `start` response.

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **H. Update Progress and Commit**.

**If `auto`:**

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} task_gate_mode auto
```

→ Proceed to **H. Update Progress and Commit**.

**If `technical`:**

→ Load **[technical-lens.md](../../workflow-shared/references/technical-lens.md)** and follow its instructions as written.

Retell the same result through the technical lens — mechanism-first, from the executor's SUMMARY and the changes on disk.

→ Return to **G. Task Gate**.

**If ask:**

Answer the user's questions about the implementation.

→ Return to **G. Task Gate**.

**If comment:**

Include the user's feedback when re-invoking.

→ Return to **B. Execute Task**.

---

## H. Update Progress and Commit

**Update task progress in the plan** — follow the format's **updating.md** instructions to mark the task complete — or, when this stage was reached via a skip path (stage C `skip`, or the blocked-tasks `skip`), its skip transition instead.

**Check for phase completion** — use the format's **reading.md** to list remaining tasks in the current phase. If no tasks remain open or in-progress, follow the format's **updating.md** instructions for phase completion.

**Record progress via the engine** — add `--phase-complete` when the current phase has no remaining open/in-progress tasks, and `--skipped` when the task was skipped rather than implemented:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs task complete {work_unit} {topic} {internal_id} --phase {N} --next-task '{next_task_id or ~}' [--skipped] [--phase-complete]
```

The response also carries the `MENU: blocked tasks` section that **A. Retrieve Next Task** emits — never emit it here.

**Internal ID convention**: The internal ID used with the engine and in commit messages MUST use the format `{topic}-{phase_id}-{task_id}`. If only the format adapter's external ID is at hand, pass `--external {external_id}` in place of `{internal_id}` — the engine resolves it through the plan's task map and reports the internal id in its response.

**If the planning item carries no `storage_paths`** (a plan initialised before the field existed): record it now — read the format's authoring.md → Storage Pathspecs and copy the fenced array (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} storage_paths '{format storage pathspecs}'`).

**Commit all changes** with raw git — stage the task's code and tests, the plan's `storage_paths` (recorded on the planning item), the work unit's manifest, and the task's fix-tracking file when one exists (`.workflows/{work_unit}/implementation/{topic}/fix-tracking-{internal_id}.md`), then commit:

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
