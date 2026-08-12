# Display Task Result

*Reference for **[task-loop.md](task-loop.md)***

---

The one presentation shape for every task-loop result moment. The caller provides `result` — `approved`, `needs-changes`, `blocked`, or `failed`.

Write the payload to `.workflows/.cache/{work_unit}/implementation/{topic}/task-result.json` with the Write tool:

```json
{"id": "{internal_id}", "title": "{Task Name}", "current": {task_number}, "total": {task_total}, "phase": "{phase number} — {phase name}", "position": "{phase_task_number} of {phase_task_total} in phase", "external": {"label": "{plan format}", "id": "{external id}"}}
```

- `id` — the in-flight task's internal id. The engine refuses a payload naming any other task, so a stale file left by an earlier task never renders.
- `title` — the task's name, from the normalised task content. It heads the result as the task's marker.
- `current`/`total` — the task's ordinal and the plan's task total, noted at **A. Retrieve Next Task** — re-derive them from the format's **reading.md** listing when they are not in session context; whole numbers, not strings. Omit the pair when the listing did not yield the counts — the marker then carries the name alone.
- `phase` — the task's plan phase, number and name, from the normalised task content (its `PHASE` line).
- `position` — the in-phase ordinal from the same stage-A listing; omit the field when the listing did not yield the counts.
- `external` — the plan format's display identifier, obtained as its **reading.md** → Display Identifier section instructs, labelled with the plan's `format` value. Omit the field when the format declares none.

Render and emit its `DISPLAY: task result` section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render task-result {work_unit}.implementation.{topic} --file .workflows/.cache/{work_unit}/implementation/{topic}/task-result.json --result {result}
```

The verdict line — approved with its fix rounds, needs-changes with its attempt count and any reached escalation threshold, blocked, failed — derives from engine state; the payload above is all the session supplies.

→ Return to caller.
