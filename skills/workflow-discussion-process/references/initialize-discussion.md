# Initialize Discussion

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

→ Load **[seed-context.md](../../workflow-shared/references/seed-context.md)** and follow its instructions as written.

→ Load **[read-brief-context.md](../../workflow-shared/references/read-brief-context.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`.

1. Ensure the discussion directory exists: `.workflows/{work_unit}/discussion/`
2. Register the discussion in the manifest (the map commands below require the item to exist):
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic start {work_unit} discussion {topic}
   ```
3. Load **[template.md](template.md)** — use it to create the discussion file at `.workflows/{work_unit}/discussion/{topic}.md`. Include the terminal `## Triage` section seeded as `(none)`. When the file already exists holding parked `## Triage` entries — a stub rerouted concerns landed on before any session; step 2's `topic start` has already flipped its `triaged` status, so key on the file content, not the manifest — write the template's working sections around it and preserve the existing entries verbatim — never reset them to `(none)`; they drain during the session.
4. Populate the Context section and derive the initial subtopics:

   **If the handoff includes a `Research files:` section:**

   Read each listed research file using the Read tool. Use the full research content — guided by the `Topic context` field — to populate the Context section and derive initial subtopics. Seed subtopics should represent the key concerns, decisions, and questions that emerged from research.

   **Otherwise:**

   Populate from the seed, handoff context, and user input. Derive initial subtopics from whatever context is available — the seed, the user's description, the topic itself, obvious architectural concerns. These are seeds, not a complete list — the map grows during discussion.

5. Seed the Discussion Map — record each initial subtopic (kebab-case name; new subtopics start `pending`):
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map add {work_unit} {topic} {subtopic}
   ```
6. Commit:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "discussion({work_unit}): initialize {topic} discussion"
   ```

→ Return to caller.
