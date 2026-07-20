# Initialize Discussion

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

→ Load **[../../workflow-shared/references/seed-context.md](../../workflow-shared/references/seed-context.md)** and follow its instructions as written.

→ Load **[../../workflow-shared/references/read-brief-context.md](../../workflow-shared/references/read-brief-context.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`.

1. Ensure the discussion directory exists: `.workflows/{work_unit}/discussion/`
2. Register the discussion in the manifest (the map commands below require the item to exist):
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.discussion.{topic}
   ```
3. Load **[template.md](template.md)** — use it to create the discussion file at `.workflows/{work_unit}/discussion/{topic}.md`. Include the terminal `## Triage` section seeded as `(none)`.
4. Populate the Context section and derive the initial subtopics:

   **If the handoff includes a `Research files:` section:**

   Read each listed research file using the Read tool. Use the full research content — guided by the `Topic context` field — to populate the Context section and derive initial subtopics. Seed subtopics should represent the key concerns, decisions, and questions that emerged from research.

   **Otherwise:**

   Populate from the seed, handoff context, and user input. Derive initial subtopics from whatever context is available — the seed, the user's description, the topic itself, obvious architectural concerns. These are seeds, not a complete list — the map grows during discussion.

5. Seed the Discussion Map — record each initial subtopic (kebab-case name; new subtopics start `pending`):
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs map add {work_unit} {topic} {subtopic}
   ```
6. Commit the discussion file and manifest

→ Return to caller.
