# View Plan

*Reference for **[manage-work-unit.md](manage-work-unit.md)***

---

Display a readable summary of a plan's phases, tasks, and status.

## A. Determine Topic

**If work_type is `feature` or `bugfix`:**

Set `topic` = `selected.name`.

→ Proceed to **B. Read Plan**.

**If work_type is `epic`:**

Query manifest for all planning topics:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {selected.name} --phase planning --topic "*" status
```

**If only one topic exists**, set `topic` to that topic.

**If multiple topics exist:**

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which plan would you like to view?

@foreach(topic in planning_topics)
{N}. **{topic.name:(titlecase)}** ({topic.status})
@endforeach
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

Set `topic` to the selected topic.

→ Proceed to **B. Read Plan**.

## B. Read Plan

Get the format:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {selected.name} --phase planning --topic {topic} format
```

Load the format's reading reference:

```
../../workflow-planning-process/references/output-formats/{format}/reading.md
```

Follow those instructions to read all tasks for the plan.

→ Proceed to **C. Display Summary**.

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

→ Return to **[manage-work-unit.md](manage-work-unit.md)**.
