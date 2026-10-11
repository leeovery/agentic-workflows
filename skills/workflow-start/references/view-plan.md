# View Plan

*Reference for **[manage-work-unit.md](manage-work-unit.md)***

---

Display a readable summary of a plan's phases, tasks, and status.

## A. Determine Topic

#### If work_type is not `epic`

Set `topic` = `selected.name`.

→ Proceed to **B. Read Plan**.

#### If work_type is `epic`

Read `planning_topics` from the caller's `manage {selected.name}` snapshot DATA, then fetch the topic pick — the auto-select line when the epic has one plan, the selection menu when it has several — and emit the call's section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render plan-topics {selected.name}
```

**If the response carried `DISPLAY: plan topic auto-select`:**

Set `topic` to the one topic in `planning_topics`.

→ Proceed to **B. Read Plan**.

**If the response carried `MENU: plan topics`:**

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

→ On return, proceed to **C. Display Summary**.

---

## C. Display Summary

Write the plan's phases and tasks, as the format's reading gives them, to `.workflows/.cache/{selected.name}/planning/{topic}/plan-summary.json` with the Write tool — every phase in order with each of its tasks, `done` true for a completed task and false for a pending or in-progress one, and a short `note` on a task that is blocked or depends on another:

```json
{"phases": [{"name": "…", "tasks": [{"id": "{internal_id}", "title": "…", "done": false, "note": "…"}]}]}
```

Render the summary and emit the call's DISPLAY section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render plan-summary {selected.name}.planning.{topic} --file .workflows/.cache/{selected.name}/planning/{topic}/plan-summary.json
```

→ Return to caller.
