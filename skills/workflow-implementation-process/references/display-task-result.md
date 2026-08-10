# Display Task Result

*Reference for **[task-loop.md](task-loop.md)***

---

The one presentation shape for every task-loop result moment. The caller provides `result` — `approved`, `needs-changes`, `blocked`, or `failed`.

> *Output the next fenced block as markdown (not a code block):*

```
**`▪ Task {task_number} of {task_total} — {Task Name}`**
```

`{task_number}`/`{task_total}` are the task's ordinal and the plan's task total, noted at **A. Retrieve Next Task**.

Write the payload to `.workflows/.cache/{work_unit}/implementation/{topic}/task-result.json` with the Write tool:

```json
{"phase": "{phase number} — {phase name}", "position": "{phase_task_number} of {phase_task_total} in phase · {task_number} of {task_total} overall", "external": {"label": "{plan format}", "id": "{external id}"}}
```

- `phase` — the task's plan phase, number and name.
- `position` — in-phase and overall ordinals from the same stage-A listing; omit the field when the listing did not yield the counts.
- `external` — the plan's display identifier: the `task_map` entry for this internal id (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} task_map`), labelled with the plan's `format` value. Include it only when the mapped id differs from the internal id and is a key a person would recognise — never a UUID or a file path; omit the field otherwise.

Render and emit each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render task-result {work_unit}.implementation.{topic} --file .workflows/.cache/{work_unit}/implementation/{topic}/task-result.json --result {result}
```

The verdict line — approved with its fix rounds, needs-changes with its attempt count and any reached escalation threshold, blocked, failed — derives from engine state; the payload above is all the session supplies.

→ Return to caller.
