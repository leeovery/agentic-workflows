# Initialize Discussion

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

1. Ensure the discussion directory exists: `.workflows/{work_unit}/discussion/`
2. Load **[template.md](template.md)** — use it to create the discussion file at `.workflows/{work_unit}/discussion/{topic}.md`.
3. Populate Context section and seed the Discussion Map:

   **If the handoff includes a `Research files:` section:**

   Read each listed research file using the Read tool. Use the full research content — guided by the `Topic context` field — to populate the Context section and derive initial subtopics for the Discussion Map. Seed subtopics should represent the key concerns, decisions, and questions that emerged from research. Set all initial subtopics to `pending`.

   **Otherwise:**

   Populate from handoff context and user input. Derive initial subtopics from whatever context is available — the user's description, the topic itself, obvious architectural concerns. These are seeds, not a complete list — the map will grow during discussion.

4. Register discussion in manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.discussion.{topic}
   ```
5. Commit the initial file

→ Return to caller.
