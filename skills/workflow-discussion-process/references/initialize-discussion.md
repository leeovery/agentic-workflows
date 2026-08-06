# Initialize Discussion

*Reference for **[workflow-discussion-process](../SKILL.md)***

---

→ Load **[seed-context.md](../../workflow-shared/references/seed-context.md)** and follow its instructions as written.

The seed just read, the brief or carrier the entry skill read at Gather Context, and the handoff's description are this discussion's **inherited position**, not a list of questions to re-ask. Decisions discovery already reached with the user carry forward as working ground: record them, build on them, let this discussion's own findings test them. Softness means such a decision *can* move when something surfaced here contradicts it, or when the user reopens it — never that it gets re-elicited on entry. Re-running settled scope as a fresh options weigh-up spends the user's time on ground they covered and puts alternatives they already rejected back into the document as live material.

1. Ensure the discussion directory exists: `.workflows/{work_unit}/discussion/`
2. Register the discussion in the manifest (the map commands below require the item to exist):
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic start {work_unit} discussion {topic}
   ```
3. Load **[template.md](template.md)** — use it to create the discussion file at `.workflows/{work_unit}/discussion/{topic}.md`. When the file already exists, keep its content and write the template's working sections around it.
4. Populate the Context section and derive the initial subtopics:

   **If the handoff includes a `Research files:` section:**

   Read each listed research file using the Read tool. Use the full research content — guided by the `Topic context` field — to populate the Context section and derive initial subtopics. Seed subtopics should represent the key concerns, decisions, and questions that emerged from research.

   **Otherwise:**

   Populate from the seed, handoff context, and user input. Derive initial subtopics from whatever context is available — the seed, the user's description, the topic itself, obvious architectural concerns. These are seeds, not a complete list — the map grows during discussion.

   Either way, the triage queue is never a seeding source: parked concerns enter through the session loop's triage check — raised with their full context and discussed — and pre-adding their titles to the map forces every fold into the wrong branch.

5. Seed the Discussion Map — record each initial subtopic (kebab-case name; new subtopics start `pending`):
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map add {work_unit} {topic} {subtopic}
   ```
6. Commit:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic discussion/{topic} -m "discussion({work_unit}): initialize {topic} discussion"
   ```

→ Return to caller.
