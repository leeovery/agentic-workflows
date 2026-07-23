# Plan Construction

*Reference for **[workflow-planning-process](../SKILL.md)***

---

This step constructs the complete plan — defining phases, designing task lists, and authoring every task.

---

## Navigation

At any approval gate during plan construction, the user can navigate. They may describe where they want to go in their own words — a specific phase, a specific task, "the beginning", "the leading edge", or any point in the plan.

The **leading edge** is where new work begins — the first phase, task list, or task that hasn't been completed yet. It is tracked by the manifest (`phase` and `task` fields under `planning.{topic}`). To find the leading edge, read those values. If all phases and tasks are complete, the leading edge is the end of plan construction.

The manifest planning position always tracks the leading edge. It is only advanced when work is completed — never when the user navigates. Navigation moves the user's position, not the leading edge.

Navigation stays within plan construction. It cannot skip past the end of this step.

---

## A. Phase Structure

→ Load **[define-phases.md](define-phases.md)** and follow its instructions as written.

> *Output the next fenced block as a code block:*

```
I'll now work through each phase — presenting existing work for review
and designing or authoring anything still pending. You'll approve at
every stage.
```

→ On return, proceed to **B. Process Current Phase**.

---

## B. Process Current Phase

Work through each phase in order. Check the current phase's state.

#### If the phase has no task table in the planning file

→ Load **[define-tasks.md](define-tasks.md)** and follow its instructions as written.

→ On return, proceed to **C. Author Phase Tasks**.

#### If the phase has a task table

Write the task-list payload to `.workflows/.cache/{work_unit}/planning/{topic}/task-list-phase-{N}.json` with the Write tool (`{"phase": {N}, "phase_name": "{Phase Name}", "tasks": [{"name": "…", "summary": "…", "edge_cases": ["…"]}]}` from the planning file's task table), render, and emit each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render task-list {work_unit}.planning.{topic} --file .workflows/.cache/{work_unit}/planning/{topic}/task-list-phase-{N}.json --variant existing
```

The response carries the task-list display plus the surface for the current gate mode.

**If the response carried `DISPLAY: task list auto-approved`:**

→ Proceed to **C. Author Phase Tasks**.

**If the response carried `MENU: task list gate`:**

**STOP.** Wait for user response.

**If the user wants changes:**

→ Load **[define-tasks.md](define-tasks.md)** and follow its instructions as written.

→ On return, proceed to **C. Author Phase Tasks**.

**If the user navigates:**

Resolve the destination per **Navigation** above — the user's position moves, the leading edge does not.

→ Return to **B. Process Current Phase** for the phase navigated to.

**If `yes`:**

→ Proceed to **C. Author Phase Tasks**.

---

## C. Author Phase Tasks

Tasks are authored in a single batch per phase. One sub-agent authors all tasks for the phase, writing to a per-phase task detail file. The orchestrator then handles approval and writing to the output format. Never invoke multiple authoring agents concurrently. Never batch beyond a single phase.

#### If all task internal IDs for this phase exist in `task_map`

All tasks already authored. Check via manifest:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} task_map
```

> *Output the next fenced block as a code block:*

```
Phase {N}: {Phase Name} — all tasks already authored.
```

→ Proceed to **D. Advance Phase**.

#### If any task internal IDs are missing from `task_map`

→ Load **[author-tasks.md](author-tasks.md)** and follow its instructions as written.

**If authoring reported complete** (every task written to the plan):

→ Proceed to **D. Advance Phase**.

**If authoring reported incomplete** (the user navigated away):

Do not advance the manifest position — the phase is unauthored and remains the leading edge.

→ Return to **B. Process Current Phase** for the phase the user navigated to.

---

## D. Advance Phase

Advance the manifest planning position to the next phase — one batched write:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} phase={N+1} task='~'
```

Commit:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "planning({work_unit}): complete Phase {N} tasks"
```

> *Output the next fenced block as a code block:*

```
Phase {N}: {Phase Name} — complete ({M} tasks authored).
```

#### If more phases remain

→ Return to **B. Process Current Phase**.

#### If all phases are complete

→ Proceed to **E. Loop Complete**.

---

## E. Loop Complete

> *Output the next fenced block as markdown (not a code block):*

```
All phases are complete. The plan has **{N} phases** with **{M} tasks** total.
```

→ Return to caller.
