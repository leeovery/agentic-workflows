# Initialize Research

*Reference for **[workflow-research-process](../SKILL.md)***

---

→ Load **[../../workflow-shared/references/seed-context.md](../../workflow-shared/references/seed-context.md)** and follow its instructions as written.

1. Load **[template.md](template.md)** — use it to create the research file at the Output path from the handoff (e.g., `.workflows/{work_unit}/research/{resolved_filename}`). Include the terminal `## Triage` section seeded as `(none)`.
2. Populate the Starting Point section with context from the handoff's `Context:` section and the seed. If restarting (no `Context:` in handoff), leave the Starting Point section empty — the session will gather context naturally.
3. Register in manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.research.{topic}
   ```
4. Commit: `research({work_unit}): initialize {topic} research`

→ Return to caller.
