# Initialize Discussion

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

1. Ensure the discussion directory exists: `.workflows/{work_unit}/discussion/`
2. Load **[template.md](template.md)** — use it to create the discussion file at `.workflows/{work_unit}/discussion/{topic}.md`.
3. Populate Context section and initial Questions list:

   **If the handoff includes a `Research files:` section:**

   Read each listed research file using the Read tool. Use the full research content — guided by the `Topic context` field — to populate the Context section and derive initial Questions.

   **Otherwise:**

   Populate from handoff context and user input as before.
4. Register discussion in manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js init-phase {work_unit}.discussion.{topic}
   ```
5. Commit the initial file

→ Return to **[the skill](../SKILL.md)**.
