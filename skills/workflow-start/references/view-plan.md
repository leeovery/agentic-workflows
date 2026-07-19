# View Plan

*Reference for **[manage-work-unit.md](manage-work-unit.md)***

---

Display a readable summary of a plan's phases, tasks, and status.

## A. Determine Topic

#### If work_type is not `epic`

Set `topic` = `selected.name`.

→ Proceed to **B. Read Plan**.

#### If work_type is `epic`

Read `planning_topics` from the caller's `manage {selected.name}` snapshot DATA.

**If only one topic exists:**

> *Output the next fenced block as a code block:*

```
Automatically proceeding with "{topic:(titlecase)}".
```

Set `topic` to that topic.

→ Proceed to **B. Read Plan**.

**If multiple topics exist:**

Emit the `MENU: plan topics` section from the same snapshot verbatim as markdown (not a code block). Its numbering follows `planning_topics` order.

**STOP.** Wait for user response.

Resolve the number against `planning_topics` and set `topic` to the selected topic.

→ Proceed to **B. Read Plan**.

---

## B. Read Plan

Read the `format` and `external_id` from the manifest:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {selected.name}.planning.{topic} format
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {selected.name}.planning.{topic} external_id
```

Use `external_id` as the plan-level parent identifier when following the format adapter's instructions below.

→ Load **[reading.md](../../workflow-planning-process/references/output-formats/{format}/reading.md)** and follow its instructions as written.

→ Proceed to **C. Display Summary**.

---

## C. Display Summary

> *Output the next fenced block as markdown (not a code block):*

```
**Plan: {selected.name} / {topic:(titlecase)}**

**Format:** {format}

@foreach(phase in phases)
### Phase {phase.number}: {phase.name}
@foreach(task in phase.tasks)
- [{task.status_checkbox}] {task.internal_id}: {task.title}
@endforeach
@endforeach
```

Show:
- Phase names
- Task descriptions and status (`[x]` for completed, `[ ]` for pending/in-progress)
- Any blocked or dependent tasks noted inline

Keep it scannable — this is for quick reference, not full detail.

→ Return to caller.
