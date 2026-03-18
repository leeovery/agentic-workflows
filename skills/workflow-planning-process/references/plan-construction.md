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

→ Proceed to **B. Process Current Phase**.

---

## B. Process Current Phase

Work through each phase in order. Check the current phase's state.

Check `task_list_gate_mode` via manifest CLI:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} task_list_gate_mode
```

#### If the phase has no task table in the planning file

→ Load **[define-tasks.md](define-tasks.md)** and follow its instructions as written.

→ Proceed to **C. Author Phase Tasks**.

#### If the phase has a task table and `task_list_gate_mode` is `auto`

> *Output the next fenced block as markdown (not a code block):*

```
**Phase {N}: {Phase Name}** — {M} tasks.

{task list from the planning file}
```

> *Output the next fenced block as a code block:*

```
Phase {N}: {Phase Name} — task list confirmed. Proceeding to authoring.
```

→ Proceed to **C. Author Phase Tasks**.

#### If the phase has a task table and `task_list_gate_mode` is `gated`

> *Output the next fenced block as markdown (not a code block):*

```
**Phase {N}: {Phase Name}** — {M} tasks.

{task list from the planning file}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Approve this task list?

- **`y`/`yes`** — Proceed to authoring
- **Tell me what to change** — Revise tasks in this phase
- **Navigate** — a different phase or task, or the leading edge
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If the user wants changes:**

→ Load **[define-tasks.md](define-tasks.md)** and follow its instructions as written.

→ Proceed to **C. Author Phase Tasks**.

**If confirmed:**

→ Proceed to **C. Author Phase Tasks**.

---

## C. Author Phase Tasks

Tasks are authored in a single batch per phase. One sub-agent authors all tasks for the phase, writing to a scratch file. The orchestrator then handles approval and writing to the plan format. Never invoke multiple authoring agents concurrently. Never batch beyond a single phase.

#### If all task internal IDs for this phase exist in `task_map`

All tasks already authored. Check via manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} task_map
```

> *Output the next fenced block as a code block:*

```
Phase {N}: {Phase Name} — all tasks already authored.
```

→ Proceed to **D. Advance Phase**.

#### If any task internal IDs are missing from `task_map`

→ Load **[author-tasks.md](author-tasks.md)** and follow its instructions as written.

→ Proceed to **D. Advance Phase**.

---

## D. Advance Phase

Advance the manifest planning position to the next phase:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} phase {N+1}
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} task ~
```

Commit: `planning({work_unit}): complete Phase {N} tasks`

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
