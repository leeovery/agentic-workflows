# Initialize Inception

*Reference for **[workflow-inception-process](../SKILL.md)***

---

1. Ensure the inception directory exists: `.workflows/{work_unit}/inception/`.
2. Load **[template.md](template.md)** and use it to create `.workflows/{work_unit}/inception/session-001.md`. Populate:
   - The header (date, work unit name).
   - The **Description (as of session)** section from the handoff `description`.
   - The **Imports** section from the handoff `imports` list. If the list is empty, write `(none)` under the heading rather than removing the section.
   - Leave **Topics Identified**, **Considered and Discarded**, and **Conclusion** as placeholders — they fill in during the session.
3. Commit: `inception({work_unit}): seed initial session log`.

The draft session log is the recovery surface for context refresh — keep it current at natural pauses during the session loop.

→ Return to caller.
