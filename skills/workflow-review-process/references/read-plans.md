# Read Plans and Specifications

*Reference for **[workflow-review-process](../SKILL.md)***

---

Read all plan(s) provided for the selected scope.

For each plan:
1. Read the plan — understand phases, tasks, and acceptance criteria
2. Read the linked specification — load design context
3. Read the plan's `format` via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} format
   ```
4. Load the format's reading adapter from `../workflow-planning-process/references/output-formats/{format}/reading.md` — this tells you how to locate and read individual task files
5. Extract all tasks across all phases

→ Return to caller.
