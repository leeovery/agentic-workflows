# Read Plans and Specifications

*Reference for **[workflow-review-process](../SKILL.md)***

---

Read all plan(s) provided for the selected scope.

Read every plan's settings in one call — the planning subtree carries each topic's `format` and `external_id`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning
```

For each plan:
1. Read the plan — understand phases, tasks, and acceptance criteria
2. Read the linked specification — load design context
3. Take the plan's `format` and `external_id` from the subtree read above
4. Load the format's reading adapter from `../../workflow-planning-process/references/output-formats/{format}/reading.md` — this tells you how to locate and read individual task files
5. Extract all tasks across all phases

→ Return to caller.
