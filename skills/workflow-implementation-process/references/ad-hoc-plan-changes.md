# Ad Hoc Plan Changes

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

Folds conversationally-surfaced unplanned work into the plan through the same infrastructure that authored the plan, never by hand. Always start at **A. Frame the Work**.

The caller is whatever flow the conversation interrupted. On `→ Return to caller.`, resume that flow exactly where it stopped; if a gate menu was pending when the conversation interrupted, re-present it — engine-rendered menus re-fetch from their surface, prose menus re-emit from their authoring file.

Context to hold before acting: `{format}` is the plan's output format, read at Step 2 — if it is not in session context (an early or post-refresh entry), read it now (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} format`).

## A. Frame the Work

Establish in conversation what the work is and what done looks like.

#### If the work requires a decision the specification doesn't answer

Decisions belong to the user — present it plainly, with what each answer would mean for the work.

**STOP.** Wait for user response.

**If the user settles the decision in scope:**

The work is absorbable now.

→ Proceed to **B. Pick the Landing**.

**If the user rules the work out of scope:**

Invoke the matching capture skill (`/workflow-log-idea`, `/workflow-log-bug`, or `/workflow-log-quickfix` — default to idea if unsure). The capture skill writes the inbox file but does not commit it, so commit it now:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit --inbox -m "workflow(inbox): capture {slug}"
```

→ Return to caller.

#### Otherwise

→ Proceed to **B. Pick the Landing**.

## B. Pick the Landing

**If `work_type` is `quick-fix`:** the plan never grows — a quick-fix is defined by its ceiling. The first two landings below stay available; anything that would need a new task goes to the inbox (the capture-and-commit shape in **A**), or signals the work has outgrown quick-fix — say so to the user rather than absorbing it.

Pick by first match:

- The task currently in flight already owns the ground — same files, same scope, a "watch out for this". → Proceed to **C. Deliver to the Executor**.
- A pending task already owns the ground — the work refines or extends a task not yet run. → Proceed to **D. Amend a Pending Task**.
- Otherwise — new work, including rework of a task already completed. → Proceed to **E. Draft the Tasks**.

## C. Deliver to the Executor

No plan write — the instruction becomes part of the current task's scope, for the executor and the reviewer alike:

1. **Append the instruction to the task's normalised content in session** — every later use of that content carries it: a fresh executor dispatch (item 5 of the payload), and the reviewer's task-content input.
2. **Deliver it to the executor** with the next send, per **[invoke-executor.md](invoke-executor.md)**: as round material on a continuation (SendMessage to the recorded agent id), or riding the normalised content on a fresh dispatch. Mark it as an addition from the user.

#### If the task completed approved before any send carried the instruction

The work was never absorbed — treat it as unlanded.

→ Return to **B. Pick the Landing**.

#### Otherwise

→ Return to caller.

## D. Amend a Pending Task

Read the plan format's updating adapter — `../../workflow-planning-process/references/output-formats/{format}/updating.md`, **Updating Task Content** — and apply the change: edit the description or append to it, whichever the format supports and the change warrants. Where the format's commands take an external id, resolve it from the manifest (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} task_map.{internal_id}` — the internal id comes from the plan read that identified the task). The task carries the addition when its turn comes.

Confirm the wording with the user before writing when the change is more than mechanical — soft, conversational, no structured gate.

**If the planning item carries no `storage_paths`** (a plan initialised before the field existed): record it now — read the format's authoring.md → Storage Pathspecs and copy the fenced array (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} storage_paths '{format storage pathspecs}'`).

Commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): amend task {internal_id}" --plan {topic}
```

→ Return to caller.

## E. Draft the Tasks

**Placement first.** Read the format's graph adapter — `../../workflow-planning-process/references/output-formats/{format}/graph.md` — before settling placement: ordering defaults differ per format (some surface a new task by priority and creation date, not phase position), and placement is expressed through the adapter's own mechanics. Read the plan via the format's reading adapter where the conversation needs the actual phase numbers and task ids. Then settle in conversation where the work surfaces — it usually falls out of the problem: a bug blocking the user's testing comes up next; deferred polish tails the plan; work belonging to an upcoming phase joins it. Per task, the choices are:

- an existing **open** phase, or a new phase at the tail — never a completed phase
- a priority, in the format's own vocabulary, when the default ordering would surface it too late or too early
- dependency edges, when order matters and ordering mechanics alone wouldn't produce it — naming an existing task's internal id, or `task {n}` for a sibling drafted task

**Draft.** Write each task in the staging shape below — `placement:` always; the `priority:` and `depends_on:` lines only when the placement discussion called for them. Then write the staging file to `.workflows/{work_unit}/implementation/{topic}/ad-hoc-tasks-{n}.md` (`{n}` = next integer not on disk) — pure markdown, no frontmatter:

```markdown
# Ad Hoc Tasks: {Topic}

## Task 1: {title}
placement: {phase {N}|new phase "{label}"}
priority: {level, in the format's vocabulary}
depends_on: {internal_id or task {n}, ...}

**Problem**: {what's missing or wrong}
**Solution**: {what to do}
**Outcome**: {what success looks like}
**Do**: {step-by-step implementation instructions}
**Acceptance Criteria**:
- {criterion}
**Tests**:
- {test description}

## Task 2: {title}
...
```

Initialise the gate state — one batched write, one `pending` row per drafted task:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.ad-hoc-{n}.gate_mode=gated staging.ad-hoc-{n}.tasks.1=pending … staging.ad-hoc-{n}.tasks.{K}=pending
```

→ Proceed to **F. Approve Each Task**.

## F. Approve Each Task

#### If no `pending` row remains in `staging.ad-hoc-{n}.tasks`

→ Proceed to **G. Create Tasks in Plan**.

#### Otherwise

Present the next pending task. Write its payload to `.workflows/.cache/{work_unit}/implementation/{topic}/proposed-task.json` with the Write tool — `{"current": …, "total": …, "title": "…", "problem": "…", "solution": "…", "outcome": "…", "steps": […], "criteria": […], "tests": […]}` from the staging file, plus `"placement"`, `"priority"`, and `"depends_on"` when the staged task carries them — then render with the gate mode from the manifest's `staging.ad-hoc-{n}` subtree, and emit each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render proposed-task {work_unit}.implementation.{topic} --file .workflows/.cache/{work_unit}/implementation/{topic}/proposed-task.json --gate {gate_mode} --comment-hint "Provide feedback to adjust"
```

#### If the response carried `DISPLAY: task auto-approved`

Record the approval (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.ad-hoc-{n}.tasks.{k} approved`), then emit the section per its marker.

→ Return to **F. Approve Each Task**.

#### If the response carried `MENU: task approval`

**STOP.** Wait for user response.

**If `yes`:**

Record the approval: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.ad-hoc-{n}.tasks.{k} approved`.

→ Return to **F. Approve Each Task**.

**If `auto`:**

Record the approval: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.ad-hoc-{n}.tasks.{k} approved`.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.ad-hoc-{n}.gate_mode auto
```

→ Return to **F. Approve Each Task**.

**If `decline`:**

Record the decline: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.ad-hoc-{n}.tasks.{k} skipped`.

→ Return to **F. Approve Each Task**.

**If comment:**

Revise the staged task in the staging file based on the user's feedback (content only), and rewrite the payload.

→ Return to **F. Approve Each Task**.

## G. Create Tasks in Plan

#### If no task was approved

Commit the staging record:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): ad hoc tasks declined" --topic implementation/{topic}
```

→ Return to caller.

#### Otherwise

Invoke the task-writer agent.

**Agent path**: `../../../agents/workflow-implementation-task-writer.md`

Pass via the orchestrator's prompt:

1. **Work unit** — the work unit name (for path construction)
2. **Topic name** — the implementation topic (scopes tasks to the correct plan)
3. **Staging file path** — the `ad-hoc-tasks-{n}.md` file from **E**
4. **Planning file path** — `.workflows/{work_unit}/planning/{topic}/planning.md`
5. **Plan format reading adapter path** — `../../workflow-planning-process/references/output-formats/{format}/reading.md`
6. **Plan format authoring adapter path** — `../../workflow-planning-process/references/output-formats/{format}/authoring.md`
7. **Phase placement** — `per-task`
8. **Approved task numbers** — the task numbers whose staging rows are `approved`
9. **Plan format graph adapter path** — `../../workflow-planning-process/references/output-formats/{format}/graph.md`, when any approved task carries a `priority:` or `depends_on:` line

The agent creates exactly the approved tasks; a crash-resume re-invocation is safe (it creates only those not yet present). It returns:

```
STATUS: complete
TASKS_CREATED: {N}
PHASES: {comma-separated phase numbers}
SUMMARY: {1 sentence}
```

> **CHECKPOINT**: Do not proceed until the task writer has returned.

**If the planning item carries no `storage_paths`** (a plan initialised before the field existed): record it now — read the format's authoring.md → Storage Pathspecs and copy the fenced array (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} storage_paths '{format storage pathspecs}'`).

Commit the staging file with this topic's implementation artifacts, then the tasks — `--plan` stages the planning topic, the manifests, and the plan's declared storage:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): add {K} ad hoc task(s) — staged" --topic implementation/{topic}
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): add {K} ad hoc task(s)" --plan {topic}
```

Any task totals held in session context are stale — the plan changed; re-derive them at the next display.

#### If the interrupted flow is the task loop

The loop's next task fetch sees the new tasks in graph order.

→ Return to caller.

#### Otherwise

The plan now holds open tasks past the loop — re-enter it.

→ Return to **[the skill](../SKILL.md)** for **Step 6**.
