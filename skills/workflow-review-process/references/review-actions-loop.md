# Review Actions Loop

*Reference for **[workflow-review-process](../SKILL.md)***

---

After a review is complete, this loop synthesizes findings into actionable tasks.

Stages A through G run sequentially. Always start at **A. Verdict Gate**.

```
A. Verdict gate (check verdicts, offer synthesis)
B. Dispatch review synthesizer → invoke-review-synthesizer.md
C. Approval overview
D. Process task (per-task approval loop)
E. Route on results
F. Create tasks in plan → invoke-review-task-writer.md
G. Re-open implementation + plan mode handoff
```

---

## A. Verdict Gate

Check the verdict(s) from the review(s) being analyzed.

#### If all verdicts are `Approve` with no required changes

> *Output the next fenced block as a code block:*

```
No actionable findings. All reviews passed with no required changes.
```

Mark the review completed — the engine sets the status:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} review {topic}
```

Commit the completion:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): complete review phase"
```

**Pipeline continuation** — Invoke `/workflow-bridge {work_unit} review`.

**STOP.** Do not proceed — terminal condition.

#### If any verdict is `Request Changes`

Blocking issues exist. Synthesis is strongly recommended.

> *Output the next fenced block as a code block:*

```
The review found blocking issues that require changes.
Synthesizing findings into actionable tasks is recommended.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Proceed with synthesis?

- **`y`/`yes`** — Synthesize findings into tasks *(recommended)*
- **`n`/`no`** — Skip synthesis
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **B. Dispatch Review Synthesizer**.

**If `no`:**

Mark the review completed:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} review {topic}
```

Commit the completion:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): complete review phase"
```

**Pipeline continuation** — Invoke `/workflow-bridge {work_unit} review`.

**STOP.** Do not proceed — terminal condition.

#### If verdict is `Comments Only`

Non-blocking improvements only. Synthesis is optional.

> *Output the next fenced block as a code block:*

```
The review found non-blocking suggestions only.
You can synthesize these into tasks or skip.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Synthesize non-blocking findings?

- **`y`/`yes`** — Synthesize findings into tasks
- **`n`/`no`** — Skip synthesis
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **B. Dispatch Review Synthesizer**.

**If `no`:**

Mark the review completed:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} review {topic}
```

Commit the completion:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): complete review phase"
```

**Pipeline continuation** — Invoke `/workflow-bridge {work_unit} review`.

**STOP.** Do not proceed — terminal condition.

---

## B. Dispatch Review Synthesizer

**If an in-flight staging cycle exists** (read `manifest get {work_unit}.review.{topic} staging` — a cycle whose `tasks` still hold a `pending` — a crash-resume): do not re-dispatch. Resume that cycle at **C. Approval Overview** with its file `review-tasks-c{N}.md` — the manifest's `staging.c{N}` subtree carries `gate_mode` and the per-task decisions.

**If a staging file exists on disk with no matching manifest cycle** (a crash between the synthesizer's write and the init): initialise the cycle now from the file's task count (the batched `pending` set from **[invoke-review-synthesizer.md](invoke-review-synthesizer.md)**) and resume at **C**.

→ Load **[invoke-review-synthesizer.md](invoke-review-synthesizer.md)** and follow its instructions as written.

> **CHECKPOINT**: Do not proceed until the synthesizer has returned.

#### If `STATUS` is `clean`

No actionable tasks from synthesis. Mark the review completed:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} review {topic}
```

Commit the completion:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): complete review phase"
```

> *Output the next fenced block as a code block:*

```
No actionable tasks synthesized. Review complete.
```

**Pipeline continuation** — Invoke `/workflow-bridge {work_unit} review`.

**STOP.** Do not proceed — terminal condition.

#### If `STATUS` is `tasks_proposed`

→ Proceed to **C. Approval Overview**.

---

## C. Approval Overview

Read the staging file from `.workflows/{work_unit}/implementation/{topic}/review-tasks-c{cycle-number}.md` (task content) and the cycle's state from `manifest get {work_unit}.review.{topic} staging.c{cycle-number}` (statuses + `gate_mode`).

Write the overview payload to `.workflows/.cache/{work_unit}/review/{topic}/tasks-overview.json` with the Write tool (`{"label": "Review synthesis cycle {N}", "tasks": [{"title": "…", "severity": "…"}]}`), render, and emit the section verbatim:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render tasks-overview {work_unit}.review.{topic} --file .workflows/.cache/{work_unit}/review/{topic}/tasks-overview.json
```

→ Proceed to **D. Process Task**.

---

## D. Process Task

#### If no pending tasks remain

→ Proceed to **E. Route on Results**.

#### Otherwise

Present the next pending task. Write its payload to `.workflows/.cache/{work_unit}/review/{topic}/proposed-task.json` with the Write tool — `{"current": …, "total": …, "title": "…", "severity": "…", "sources": "…", "problem": "…", "solution": "…", "outcome": "…", "steps": […], "criteria": […], "tests": […]}` from the staging file — then render with the `gate_mode` from the manifest's `staging.c{N}` subtree, and emit each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render proposed-task {work_unit}.review.{topic} --file .workflows/.cache/{work_unit}/review/{topic}/proposed-task.json --gate {gate_mode}
```

#### If the response carried `DISPLAY: task auto-approved`

Record the approval (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.review.{topic} staging.c{N}.tasks.{n} approved`), then emit the section per its marker.

→ Return to **D. Process Task**.

#### If the response carried `MENU: task approval`

**STOP.** Wait for user response.

**If `yes`:**

Record the approval: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.review.{topic} staging.c{N}.tasks.{n} approved`.

→ Return to **D. Process Task**.

**If `auto`:**

Record both in one write: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.review.{topic} staging.c{N}.tasks.{n}=approved staging.c{N}.gate_mode=auto`.

→ Return to **D. Process Task**.

**If `skip`:**

Record the skip: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.review.{topic} staging.c{N}.tasks.{n} skipped`.

→ Return to **D. Process Task**.

**If comment:**

Revise the task content in the staging file based on the user's feedback.

→ Return to **D. Process Task**.

---

## E. Route on Results

#### If the manifest's `staging.c{N}.tasks` marks any task `approved`

→ Proceed to **F. Create Tasks in Plan**.

#### If all tasks were skipped

Mark the review completed:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} review {topic}
```

Commit the cycle's decisions (the scoped commit covers the manifest):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): synthesis cycle {N} — tasks skipped"
```

**Pipeline continuation** — Invoke `/workflow-bridge {work_unit} review`.

**STOP.** Do not proceed — terminal condition.

---

## F. Create Tasks in Plan

Filter to the tasks the manifest's `staging.c{N}.tasks` marks `approved`, taking their content from the staging file.

→ Load **[invoke-review-task-writer.md](invoke-review-task-writer.md)** and follow its instructions as written.

> **CHECKPOINT**: Do not proceed until the task writer has returned.

**If the planning item carries no `storage_paths`** (a plan initialised before the field existed): record it now — read the format's authoring.md → Storage Pathspecs and copy the fenced array:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} storage_paths '{format storage pathspecs}'
```

Commit all changes (staging file, plan tasks, task_map updates) — `--plan` stages the work unit and the plan's declared storage in one scoped call:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): add review remediation ({K} tasks)" --plan {topic}
```

→ On return, proceed to **G. Re-open Implementation**.

---

## G. Re-open Implementation

For each plan that received new tasks:

1. Update the manifest via CLI:
   - `node .claude/skills/workflow-engine/scripts/engine.cjs topic reopen {work_unit} implementation {topic}`
   - `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} updated {today's date}`
2. Commit tracking changes:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): re-open implementation tracking"
```

Then enter plan mode and write the following plan. Resolve `{work_type}` from the manifest when not already in context:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit} work_type
```

```
# Review Actions Complete: {work_unit}

Review findings have been synthesized into {N} implementation tasks.

## Summary

{Summary, e.g., "auth-flow: 3 tasks in Phase 9"}

## Next Step

Invoke `/workflow-implementation-entry {work_type} {work_unit} {topic}`

Arguments: work_type = {work_type}, work_unit = {work_unit}, topic = {topic}
The skill will detect the new tasks and start executing them.

## Context

- Plan updated: {work_unit}
- Tasks created: {total count}
- Implementation tracking: re-opened

## How to proceed

Clear context and continue. The fresh session will start
implementation and pick up the new review remediation tasks
automatically.
```

Exit plan mode. The user will approve and clear context, and the fresh session will pick up with the implementation entry skill routing to the new tasks.
