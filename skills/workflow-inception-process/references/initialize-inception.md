# Initialize Inception

*Reference for **[workflow-inception-process](../SKILL.md)***

---

The entry skill (`workflow-inception-entry`) has already verified there are no existing inception items in the manifest and has handed off the work unit, description, and imports list. This step creates the on-disk surface and seeds the draft session log. **No manifest writes happen here** — topics are persisted in one batch at the confirm-and-persist gate.

1. Ensure the inception directory exists: `.workflows/{work_unit}/inception/`.
2. Load **[template.md](template.md)** and use it to create `.workflows/{work_unit}/inception/session-001.md`. Populate:
   - The header (date, work unit name).
   - The **Description (as of session)** section from the handoff `description`.
   - The **Imports** section from the handoff `imports` list. If the list is empty, omit the section entirely.
   - Leave **Topics Identified**, **Considered and Discarded**, and **Conclusion** as placeholders — they fill in during the session.
3. Commit the initial draft: `inception({work_unit}): seed initial session log`.

The draft session log is your recovery surface. Keep it current at natural pauses during the session loop so a context refresh can pick up where you left off.

→ Return to caller.
