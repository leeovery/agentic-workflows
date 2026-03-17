# Initialize Investigation

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

1. Create the investigation directory: `.workflows/{work_unit}/investigation/`
2. Load **[template.md](template.md)** — use it to create `.workflows/{work_unit}/investigation/{topic}.md`
3. Populate the Symptoms section with any context already gathered
4. Register investigation in manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js init-phase {work_unit}.investigation.{topic}
   ```
5. Commit the initial file

→ Return to caller.
