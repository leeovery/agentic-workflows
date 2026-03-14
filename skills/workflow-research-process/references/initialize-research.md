# Initialize Research

*Reference for **[workflow-research-process](../SKILL.md)***

---

1. Load **[template.md](template.md)** — use it to create the research file at the Output path from the handoff (e.g., `.workflows/{work_unit}/research/{resolved_filename}`)
2. Populate the Starting Point section with context from the handoff. If restarting (no Context in handoff), create with a minimal Starting Point — the session will gather context naturally
3. Register in manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js init-phase {work_unit}.research.{topic}
   ```
4. Commit the initial file

→ Return to **[the skill](../SKILL.md)**.
