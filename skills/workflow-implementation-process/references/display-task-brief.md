# Display Task Brief

*Reference for **[task-loop.md](task-loop.md)***

---

The pre-dispatch announcement — shown each time the loop takes up a task, after `task start` and before the executor is dispatched, so the user knows what is about to be built and what to have eyes on when it lands. Fix rounds, retries, and gate-comment rounds re-enter execution directly and never come back through it.

Write the payload to `.workflows/.cache/{work_unit}/implementation/{topic}/task-brief.json` with the Write tool:

```json
{"id": "{internal_id}", "title": "{Task Name}", "current": {task_number}, "total": {task_total}, "phase": "{phase number} — {phase name}", "position": "{phase_task_number} of {phase_task_total} in phase", "external": {"label": "{plan format}", "id": "{external id}"}, "summary": "{summary}", "watch": ["{watch line}", "..."]}
```

- `id` — the in-flight task's internal id. The engine refuses a payload naming any other task, so a stale file left by an earlier task never renders.
- `title` — the task's name, from the normalised task content. It heads the brief as the task's marker.
- `current`/`total` — the task's ordinal and the plan's task total, noted at **A. Retrieve Next Task**; whole numbers, not strings. Omit the pair when the listing did not yield the counts — the marker then carries the name alone.
- `phase` — the task's plan phase, number and name, from the normalised task content (its `PHASE` line).
- `position` — the in-phase ordinal from the same stage-A listing; omit the field when the listing did not yield the counts.
- `external` — the plan format's display identifier, obtained as its **reading.md** → Display Identifier section instructs, labelled with the plan's `format` value. Omit the field when the format declares none.
- `summary` — a sentence or two in the report register (**[report-register.md](report-register.md)** → Task Brief): what this task is about to change, from the normalised task content.
- `watch` — up to three short lines in the same register naming what deserves attention when this task lands: the UI to look at, the behaviour to try, the data to check — drawn from the task's acceptance criteria or its verification section. Omit the field when nothing earns a call-out; never restate the criteria wholesale.

Render and emit its `DISPLAY: task brief` section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render task-brief {work_unit}.implementation.{topic} --file .workflows/.cache/{work_unit}/implementation/{topic}/task-brief.json
```

→ Return to caller.
