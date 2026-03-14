# Read Plan + Load Plan Adapter

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

1. Read the plan from the provided location (typically `.workflows/{work_unit}/planning/{topic}/planning.md`)
2. Plans can be stored in various formats. Read the `format` via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.implementation.{topic} format
   ```
   If not set in the implementation phase, check the planning phase:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} format
   ```
3. Load the format's per-concern adapter files from `../workflow-planning-process/references/output-formats/{format}/`:
   - **about.md** — prerequisites and installation instructions for the format
   - **reading.md** — how to read tasks from the plan
   - **updating.md** — how to write progress to the plan
4. If no `format` field exists, ask the user which format the plan uses.
5. Follow the format's **about.md** for any setup prerequisites (e.g., required tools).
6. These adapter files apply during Step 6 (task loop) and Step 7 (analysis).
7. Also load the format's **authoring.md** adapter — needed in Step 7 if analysis tasks are created.

→ Return to **[the skill](../SKILL.md)**.
