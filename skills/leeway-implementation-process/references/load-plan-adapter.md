# Read Plan + Load Plan Adapter

*Reference for **[leeway-implementation-process](../SKILL.md)***

---

1. Read the plan's `format` via `engine manifest`:
   ```bash
   node .claude/skills/leeway-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} format
   ```
2. Load the format's adapter files from `../../leeway-planning-process/references/output-formats/{format}/`:
   - **about.md** — prerequisites and setup instructions
   - **reading.md** — how to read tasks from the plan
   - **updating.md** — how to mark task progress
   - **authoring.md** — how to create new tasks (needed if analysis adds tasks)
3. Load **[format-version-check.md](../../leeway-shared/references/format-version-check.md)** with format = `{format}`, work_unit = `{work_unit}`, phase = `implementation`, topic = `{topic}`.
4. Follow **about.md** for any setup prerequisites (e.g., required tools).

→ Return to caller.
