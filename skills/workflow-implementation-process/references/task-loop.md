# Task Loop

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

Follow stages A through H sequentially for each task — stage J is the phase-boundary detour H and A route into. Do not abbreviate, skip, or compress stages based on previous iterations.

At loop entry (crash-resume healing): if the plan marks tasks completed — completed, not skipped — that the manifest's `completed_tasks` lacks, run `engine task complete` for each missing internal id — in plan order, passing `--phase` with the phase embedded in the id — before retrieving the next task. The push is an idempotent no-op for ids already recorded, and this reseals the seam a crash between the plan mark and the bookkeeping can leave.

```
A. Retrieve next task + mark in-progress + present the task brief
B. Execute task → invoke-executor.md
C. Handle executor block (conditional)
D. Review task → invoke-reviewer.md
E. Evaluate review changes (conditional, fix_gate_mode)
F. Fix approval gate (gated prompt)
G. Task gate (gated → prompt user / auto → announce)
H. Update progress + phase check + commit
I. All tasks complete (exit to caller)
J. Consolidation pass (phase boundary) → consolidation-pass.md
→ loop back to A until done
```

**Engine sections**: the loop's state-derived sections — the task brief, the result header, and the gates — render via `engine render` calls — each stage below fetches its own section at the moment it displays it and emits what returns, so the section always sits in the tool result directly above its emission. Each section is emitted verbatim as the form its marker names. A section is everything beneath its `===` marker up to the end of the response — the marker lines themselves are never emitted. Section content is emitted byte-for-byte — never redrawn, reflowed, or re-derived.

**Agent lifecycle**: every review dispatches a fresh reviewer agent, and every task's first attempt dispatches a fresh executor agent; the only continuation is re-invoking the current task's executor for a fix round, a retry, or a gate comment round. Warm context never justifies crossing these lines — **[invoke-executor.md](invoke-executor.md)** and **[invoke-reviewer.md](invoke-reviewer.md)** carry the dispatch mechanics.

→ Load **[report-register.md](report-register.md)** and follow its instructions as written — the register for the task brief in **A**, the findings summaries and their lenses in **E** and **F**, and the result summary and its lenses in **G**.

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

**If the current phase's tasks are all complete and the manifest's `completed_phases` lacks `current_phase`** (an interrupted consolidation boundary):

→ Proceed to **J. Consolidation Pass**.

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

Fetch the blocked-tasks menu and emit its `MENU: blocked tasks` section:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render blocked-tasks
```

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

**If the task belongs to a later phase than the manifest's `current_phase`, the current phase's tasks are all complete, and `completed_phases` lacks `current_phase`** (an interrupted consolidation boundary — the previous phase must close first):

→ Proceed to **J. Consolidation Pass**.

1. Normalise the task content following **[task-normalisation.md](task-normalisation.md)**.
2. Note the task's position for the task presentations (**[display-task-brief.md](display-task-brief.md)**, **[display-task-result.md](display-task-result.md)**): list every task in plan order via the format's **reading.md** listing procedure — completed and skipped included — and record this task's ordinal and the total across the plan (`{task_number}` of `{task_total}`) and within its plan phase (`{phase_task_number}` of `{phase_task_total}`). When the format's listing cannot yield the counts, skip them — the presentations render without.
3. Start the task via the engine (records the task as `current_task`; a fresh task gets a clean slate — `fix_attempts` reset, fix tracking cache file cleared; re-starting the in-flight task — already `current_task` with its tracking file on disk — preserves both, so a re-run is safe):
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs task start {work_unit} {topic} {internal_id}
   ```
   The response's `gates` carry `task_gate_mode` and `fix_gate_mode` — stages E and G branch on these values. Do not re-read them mid-task: an `a/auto` opt-in is made by this flow itself, so you already know the current mode.
4. Mark the task as in-progress — follow the format's **updating.md** status transition.

→ Load **[display-task-brief.md](display-task-brief.md)** and follow its instructions as written.

The turn does not end here — the executor dispatch follows in the same turn.

→ On return, proceed to **B. Execute Task**.

---

## B. Execute Task

→ Load **[invoke-executor.md](invoke-executor.md)** and follow its instructions as written. Pass the normalised task content.

> **CHECKPOINT**: Do not proceed until the executor has returned its result.

**Deposit banked opportunities** — every executor report that carries BANK entries deposits them the moment it arrives, whatever its STATUS. They are decided at the phase boundary, which may be tasks away, and conversation context does not survive that long — the manifest does; the pushes ride the next commit that stages it. A near-duplicate of an earlier round's entry is fine — the boundary pass folds them. Push each entry:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest push {work_unit}.implementation.{topic} bank '{"task":"{internal_id}","source":"executor","summary":"{one line}","detail":"{what and where, file:line}","files":["{path}"]}'
```

#### If `STATUS` is `blocked` or `failed`

→ Proceed to **C. Handle Executor Block**.

#### If `STATUS` is `complete`

→ Proceed to **D. Review Task**.

---

## C. Handle Executor Block

→ Load **[display-task-result.md](display-task-result.md)** with result = `{the executor's STATUS: blocked or failed}`.

> *Output the next fenced block as a code block:*

```
{executor's ISSUES content}
```

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render executor-block-gate {work_unit}.implementation.{topic}
```

Emit the call's MENU section verbatim per its marker.

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

**Deposit banked opportunities** — every review that carries BANK entries deposits them the moment it arrives, whatever its verdict: push each as at **B. Execute Task**, with `"source":"reviewer"`.

#### If `VERDICT` is `needs-changes`

→ Proceed to **E. Evaluate Review Changes**.

#### If `VERDICT` is `approved`

**If the review carries `COMMENT_CORRECTIONS`:**

Apply each correction now with the Edit tool — replace its OLD text with its NEW text at the named file, verbatim; an empty NEW deletes the comment. Corrections touch no executable logic, so nothing re-runs and no fix round opens. A correction whose OLD text no longer matches the file is dropped — name it in the result summary at **G. Task Gate**.

→ Proceed to **G. Task Gate**.

**If it carries none:**

→ Proceed to **G. Task Gate**.

---

## E. Evaluate Review Changes

Write the reviewer's findings to `.workflows/.cache/{work_unit}/implementation/{topic}/attempt-findings.md`:

```markdown
ISSUES:
{copy ISSUES from reviewer output, including FIX, ALTERNATIVE, and CONFIDENCE per issue}

COMMENT_CORRECTIONS:
{copy COMMENT_CORRECTIONS from reviewer output — omit the section when the review carries none}

NOTES:
{copy NOTES from reviewer output}
```

Record the attempt via the engine (increments `fix_attempts` and appends the findings to the task's fix tracking file under a `## Attempt {N}` section):
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs task fix-attempt {work_unit} {topic} {internal_id} --findings-file .workflows/.cache/{work_unit}/implementation/{topic}/attempt-findings.md
```

→ Load **[display-task-result.md](display-task-result.md)** with result = `needs-changes`.

#### If the response's `threshold_reached` is `true`

→ Load **[convergence-analysis.md](../../workflow-shared/references/convergence-analysis.md)** with loop_type = `fix`, work_unit = `{work_unit}`, topic = `{topic}`, internal_id = `{internal_id}`.

Present the reviewer's findings as the register's findings summary (**[report-register.md](report-register.md)** → Findings Summary).

The turn does not end here — the gate menu follows in the same turn.

→ On return, proceed to **F. Fix Approval Gate**.

#### If the response's `threshold_reached` is `false`

Present the reviewer's findings as the register's findings summary (**[report-register.md](report-register.md)** → Findings Summary).

Branch on the response's `fix_gate_mode`.

**If `fix_gate_mode` is `auto`:**

After the findings summary, fetch the fix gate and emit its `DISPLAY: fix gate auto-accepted` section:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render fix-gate {work_unit}.implementation.{topic}
```

The turn does not end here — the executor dispatch follows in the same turn.

→ Return to **B. Execute Task**.

**If `fix_gate_mode` is `gated`:**

The turn does not end here — the gate menu follows in the same turn.

→ Proceed to **F. Fix Approval Gate**.

---

## F. Fix Approval Gate

Every arrival emits the menu in the turn it arrives — from **E**, and back from a lens, the page, an answer, or a standing challenge alike.

Fetch the fix gate and emit its `MENU: fix gate` section (the `a/auto` option renders only while the fix gate is `gated` — a threshold-forced gate in auto mode omits it):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render fix-gate {work_unit}.implementation.{topic}
```

**STOP.** Wait for user response.

#### If `yes`

→ Return to **B. Execute Task**.

#### If `auto`

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} fix_gate_mode auto
```

→ Return to **B. Execute Task**.

#### If `technical`

Retell the reviewer's findings as the register's technical retell (**[report-register.md](report-register.md)** → Technical Retell), from the attempt findings.

→ Return to **F. Fix Approval Gate**.

#### If `show`

Compose the register's show-me diagrams (**[report-register.md](report-register.md)** → Show Me) for the reviewer's findings.

→ Return to **F. Fix Approval Gate**.

#### If the user asks for the interactive page

Render the show-me explanation as an interactive browser page with the publishing tool.

→ Return to **F. Fix Approval Gate**.

#### If ask

Answer the user's questions about the review.

→ Return to **F. Fix Approval Gate**.

#### If the user challenges a finding

→ Load **[invoke-reviewer.md](invoke-reviewer.md)** for **C. Confirmation Review** and follow its instructions.

> **CHECKPOINT**: Do not proceed until the confirmation has returned.

Deposit any BANK entries the confirmation carries, as at **B**.

**If every blocking finding is withdrawn** (the confirmation's `VERDICT` is `approved`):

Apply the original review's COMMENT_CORRECTIONS as at **D**'s approved arm, and note the withdrawals for the result summary.

→ Proceed to **G. Task Gate**.

**If any finding stands:**

Summarise what stands and why, per the confirmation.

→ Return to **F. Fix Approval Gate**.

#### If the comment directs the fix

Include the reviewer's notes and the user's commentary when re-invoking.

→ Return to **B. Execute Task**.

---

## G. Task Gate

A return from a lens, the page, or an answer re-emits the menu alone — re-run the gated fetch below; the presentation belongs to the gate's first arrival.

After the reviewer approves a task, present the result:

→ Load **[display-task-result.md](display-task-result.md)** with result = `approved`.

Present the result as the register's product summary (**[report-register.md](report-register.md)** → Product Summary). When comment corrections were applied at **D. Review Task**, add a line saying so — naming any that were dropped.

Branch on the `task_gate_mode` carried by this task's `start` response.

#### If `task_gate_mode` is `auto`

After the result summary, fetch the task gate and emit its `DISPLAY: task gate auto-approved` section:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render task-gate {work_unit}.implementation.{topic}
```

The turn does not end here — the commit follows in the same turn.

→ Proceed to **H. Update Progress and Commit**.

#### If `task_gate_mode` is `gated`

Fetch the task gate and emit its `MENU: task gate` section:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render task-gate {work_unit}.implementation.{topic}
```

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **H. Update Progress and Commit**.

**If `auto`:**

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} task_gate_mode auto
```

→ Proceed to **H. Update Progress and Commit**.

**If `technical`:**

Retell the same result as the register's technical retell (**[report-register.md](report-register.md)** → Technical Retell), from the executor's and reviewer's reports and the changes on disk.

→ Return to **G. Task Gate**.

**If `show`:**

Compose the register's show-me diagrams (**[report-register.md](report-register.md)** → Show Me) for the same result.

→ Return to **G. Task Gate**.

**If the user asks for the interactive page:**

Render the show-me explanation as an interactive browser page with the publishing tool.

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

**Determine the phase disposition** — use the format's **reading.md** to list remaining tasks in the current phase, then set `{disposition}`:

- `continuing` — tasks remain open or in-progress in the current phase.
- `completing` — none remain and the boundary is not owed. Any of:
  · the work type is `quick-fix` — its plan never grows;
  · the phase's label (the planning file's `Phase {N}:` heading) starts with `Analysis (Cycle` or `Review Remediation`;
  · `consolidated_phases` contains the phase number (`manifest get {work_unit}.implementation.{topic} consolidated_phases`; absent is empty) and every `approved` row of `staging.p{N}` has its task in the plan — a missing one marks a partial task-author or task-writer run, which is `boundary`.
- `boundary` — none remain and no `completing` condition holds: the consolidation pass is owed, or unfinished. Leave the phase open in the plan — **J. Consolidation Pass** completes it once the pass has landed.

**If `{disposition}` is `completing`:** follow the format's **updating.md** instructions for phase completion.

**Record progress via the engine** — add `--phase-complete` only when `{disposition}` is `completing`, and `--skipped` when the task was skipped rather than implemented; at `boundary`, pass `--next-task '~'`:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs task complete {work_unit} {topic} {internal_id} --phase {N} --next-task '{next_task_id or ~}' [--skipped] [--phase-complete]
```

**Internal ID convention**: The internal ID used with the engine and in commit messages MUST use the format `{topic}-{phase_id}-{task_id}`. If only the format adapter's external ID is at hand, pass `--external {external_id}` in place of `{internal_id}` — the engine resolves it through the plan's task map and reports the internal id in its response.

**If the planning item carries no `storage_paths`** (a plan initialised before the field existed): record it now — read the format's authoring.md → Storage Pathspecs and copy the fenced array (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} storage_paths '{format storage pathspecs}'`).

**Commit the task** — each scope through the verb that owns it, state before code, so the code commit's answer names only code:

1. **The plan's task state** — the files the format's **updating.md** touched, the `storage_paths` recorded on the planning item for storage outside the work unit, and the work unit's manifest:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): record T{internal_id}" --plan {topic}
   ```

2. **The task's fix tracking**, when the task took a fix round (`.workflows/{work_unit}/implementation/{topic}/fix-tracking-{internal_id}.md`):

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): record T{internal_id} fix rounds" --topic implementation/{topic}
   ```

3. **The task's code and tests** — name every file the task wrote; the engine validates each path, commits confined to them, and answers with `left_dirty`:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit --paths {code and test files} -m "impl({work_unit}): T{internal_id} — {brief description}" --for {work_unit} implementation/{topic}
   ```

   The subject is exactly as shown — `T` immediately followed by the internal id, no space (`impl(pay): Tpay-1-1 — …`); review's scope-grep finds task commits by this token, and this commit alone is what it reads the task's file list from, so nothing but code and tests belongs in it. Anything in the response's `left_dirty` that this task touched is a path you forgot: commit it now with a second `--paths` call before proceeding. Nothing else in that list is yours. `.workflows` dirt never appears there at all, but a plan store outside the work unit does, and so does anything else on the tree — including a concurrent session's. Name only files this task wrote.

#### If `{disposition}` is `boundary`

→ Proceed to **J. Consolidation Pass**.

#### Otherwise

→ Return to **A. Retrieve Next Task**.

---

## I. All Tasks Complete

> *Output the next fenced block as a code block:*

```
All tasks complete. {M} tasks implemented.
```

**CRITICAL**: The caller always routes to the analysis loop after task loop completion — on every pass, not just the first. Even if you have already been through this cycle before, return to the caller and let it route to the analysis loop. Never skip ahead to completion from here.

→ Return to caller.

---

## J. Consolidation Pass

The phase boundary: the current phase's tasks are done, and the phase completes only through its consolidation pass — a sweep over what the tasks built side by side, draining the bank.

→ Load **[consolidation-pass.md](consolidation-pass.md)** and follow its instructions as written.

→ On return, proceed to **A. Retrieve Next Task**.
