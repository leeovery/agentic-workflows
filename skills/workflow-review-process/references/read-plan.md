# Read the Plan and Specification

*Reference for **[workflow-review-process](../SKILL.md)***

---

Read the plan's settings — the planning item carries its `format` and `external_id`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic}
```

1. Read the plan — understand phases, tasks, and acceptance criteria
2. Read the linked specification — load design context
3. Take the plan's `format` and `external_id` from the item read above
4. Load **[format-version-check.md](../../workflow-shared/references/format-version-check.md)** with format = `{format}`
5. Load the format's reading adapter from `../../workflow-planning-process/references/output-formats/{format}/reading.md` — this tells you how to locate and read individual task files
6. Extract all tasks across all phases

→ Return to caller.
