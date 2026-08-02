# Initialize Research

*Reference for **[workflow-research-process](../SKILL.md)***

---

→ Load **[seed-context.md](../../workflow-shared/references/seed-context.md)** and follow its instructions as written.

The seed just read, the brief or carrier the entry skill read at Gather Context, and the handoff's description are inherited ground, not a list of questions to re-ask. Exploring adjacent territory is this phase's job; putting a decision discovery already reached back to the user as an open question is not. Where exploration turns up something that genuinely undercuts one, surface that as a finding rather than reopening the decision.

1. Load **[template.md](template.md)** — use it to create the research file at the Output path from the handoff (e.g., `.workflows/{work_unit}/research/{resolved_filename}`). When the file already exists, keep its content and write the template's working sections around it.
2. Populate the Starting Point section from whatever seeded this phase: the handoff's `Context:` fields when the interview ran, otherwise the carrier in context — the brief the entry read, or the seed — and the handoff's `Description:`. When restarting (the handoff carries `Source: existing research`), leave the section empty — the session gathers context naturally.
3. Register in manifest:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic start {work_unit} research {topic}
   ```
4. Commit:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} --topic research/{topic} -m "research({work_unit}): initialize {topic} research"
   ```

→ Return to caller.
