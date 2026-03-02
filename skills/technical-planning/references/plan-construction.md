# Plan Construction

*Reference for **[technical-planning](../SKILL.md)***

---

This step constructs the complete plan — defining phases, designing task lists, and authoring every task.

---

## Navigation

At any approval gate during plan construction, the user can navigate. They may describe where they want to go in their own words — a specific phase, a specific task, "the beginning", "the leading edge", or any point in the plan.

The **leading edge** is where new work begins — the first phase, task list, or task that hasn't been completed yet. It is tracked by the manifest (`{work_unit}.phases.planning.phase` and `{work_unit}.phases.planning.task`). To find the leading edge, read those values. If all phases and tasks are complete, the leading edge is the end of plan construction.

The manifest planning position always tracks the leading edge. It is only advanced when work is completed — never when the user navigates. Navigation moves the user's position, not the leading edge.

Navigation stays within plan construction. It cannot skip past the end of this step.

---

## Phase Structure

Load **[define-phases.md](define-phases.md)** and follow its instructions as written.

After the phase structure is approved, continue to **Process Phases** below.

---

## Process Phases

Work through each phase in order.

> *Output the next fenced block as a code block:*

```
I'll now work through each phase — presenting existing work for review
and designing or authoring anything still pending. You'll approve at
every stage.
```

### For each phase, check its state:

#### If the phase has no task table

This phase needs task design.

→ Proceed to **A. Define Tasks** with this phase.

After **A. Define Tasks** returns with an approved task table, proceed to **Author Tasks for the Phase** below.

#### If the phase has a task table

> *Output the next fenced block as markdown (not a code block):*

```
**Phase {N}: {Phase Name}** — {M} tasks.

{task list from the phase's task table}
```

Check `task_list_gate_mode` via manifest CLI:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.phases.planning.task_list_gate_mode
```

#### If `task_list_gate_mode: auto` (existing task table)

> *Output the next fenced block as a code block:*

```
Phase {N}: {Phase Name} — task list confirmed. Proceeding to authoring.
```

→ Proceed to **Author Tasks for the Phase** below.

#### If `task_list_gate_mode: gated` (existing task table)

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**To proceed:**
- **`y`/`yes`** — Confirmed.
- **Or tell me what to change.**
- **Or navigate** — a different phase or task, or the leading edge.
· · · · · · · · · · · ·
```

**STOP.** Wait for the user's response.

#### If the user wants changes

→ Proceed to **A. Define Tasks** with this phase for revision.

#### If confirmed

→ Proceed to **Author Tasks for the Phase** below.

---

## Author Tasks for the Phase

Tasks are authored in a single batch per phase. One sub-agent authors all tasks for the phase, writing to a scratch file. The orchestrator then handles approval and writing to the plan format. Never invoke multiple authoring agents concurrently. Never batch beyond a single phase.

#### If all tasks in the phase have status `authored`

All tasks already written.

> *Output the next fenced block as a code block:*

```
Phase {N}: {Phase Name} — all tasks already authored.
```

→ Proceed to the next phase.

#### If any tasks in the phase have status `pending`

→ Proceed to **B. Author Tasks** for the entire phase.

After **B. Author Tasks** returns, all tasks in the phase are authored.

If the user navigates mid-approval, the scratch file preserves approval state. On return, resume from the first non-approved task.

#### When all tasks in the phase are authored

Advance the manifest planning position to the next phase:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.phases.planning.phase {N+1}
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.phases.planning.task ~
```

Commit: `planning({topic}): complete Phase {N} tasks`

> *Output the next fenced block as a code block:*

```
Phase {N}: {Phase Name} — complete ({M} tasks authored).
```

Continue to the next phase.

---

## Loop Complete

When all phases have all tasks authored:

> *Output the next fenced block as markdown (not a code block):*

```
All phases are complete. The plan has **{N} phases** with **{M} tasks** total.
```

---

## A. Define Tasks

Load **[define-tasks.md](define-tasks.md)** and follow its instructions as written. This step designs and approves a task list for **one phase**.

---

## B. Author Tasks

Load **[author-tasks.md](author-tasks.md)** and follow its instructions as written. This step authors **all tasks for the phase** via a batch agent and returns.
