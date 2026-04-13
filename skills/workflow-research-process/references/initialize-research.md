# Initialize Research

*Reference for **[workflow-research-process](../SKILL.md)***

---

#### If source is `import`

1. Read each file listed in the handoff's Import files verbatim
2. Create the research file at the Output path using the standard template from **[template.md](template.md)**. Populate the Starting Point from conversation context. Place the full verbatim content of each imported file after the `---`, separated by `---` if multiple files.

   **CRITICAL**: No summarization, no restructuring. Imported content is copied exactly as-is.
3. Register in manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.research.{topic}
   ```
4. Commit: `research({work_unit}): import {topic} research from existing files`

→ Return to caller.

#### Otherwise

1. Load **[template.md](template.md)** — use it to create the research file at the Output path from the handoff (e.g., `.workflows/{work_unit}/research/{resolved_filename}`)
2. Populate the Starting Point section with context from the handoff. If restarting (no Context in handoff), create with a minimal Starting Point — the session will gather context naturally
3. Register in manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.research.{topic}
   ```
4. Commit the initial file

→ Return to caller.
