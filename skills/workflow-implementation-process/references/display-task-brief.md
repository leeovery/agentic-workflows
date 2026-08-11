# Display Task Brief

*Reference for **[task-loop.md](task-loop.md)***

---

The pre-dispatch announcement — shown once per task, after `task start` and before the executor is dispatched, so the user knows what is about to be built and what to have eyes on when it lands.

> *Output the next fenced block as markdown (not a code block):*

```
**`▪ {Task Name} ({task_number} of {task_total})`**
```

`{task_number}`/`{task_total}` are the task's ordinal and the plan's task total, noted at **A. Retrieve Next Task**. When the format cannot yield them, the marker carries the name alone: `**`▪ {Task Name}`**`.

Write the payload to `.workflows/.cache/{work_unit}/implementation/{topic}/task-brief.json` with the Write tool:

```json
{"phase": "{phase number} — {phase name}", "position": "{phase_task_number} of {phase_task_total} in phase", "external": {"label": "{plan format}", "id": "{external id}"}, "summary": "{summary}", "watch": ["{watch line}", "..."]}
```

- `phase`, `position`, `external` — as **[display-task-result.md](display-task-result.md)** defines them.
- `summary` — a sentence or two in the product-lens register: what this task is about to change, from the normalised task content.
- `watch` — up to three short lines naming what deserves attention when this task lands: the UI to look at, the behaviour to try, the data to check — drawn from the acceptance criteria and verification notes. Omit the field when nothing earns a call-out; never restate the criteria wholesale.

Render and emit its `DISPLAY: task brief` section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render task-brief {work_unit}.implementation.{topic} --file .workflows/.cache/{work_unit}/implementation/{topic}/task-brief.json
```

→ Return to caller.
