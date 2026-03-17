# Read Plan + Load Plan Adapter

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

1. Read the plan's `format` via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} format
   ```
2. Load the format's adapter files from `../workflow-planning-process/references/output-formats/{format}/`:
   - **about.md** — prerequisites and setup instructions
   - **reading.md** — how to read tasks from the plan
   - **updating.md** — how to mark task progress
   - **authoring.md** — how to create new tasks (needed if analysis adds tasks)
3. Follow **about.md** for any setup prerequisites (e.g., required tools).

→ Return to caller.
