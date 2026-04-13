# Initialize Research

*Reference for **[workflow-research-process](../SKILL.md)***

---

#### If source is `import`

1. Read each file listed in the handoff's Import files verbatim
2. Create the research file at the Output path using this structure:
   ```markdown
   # Research: {Title}

   Imported from existing research files.

   ## Starting Point

   Imported from:
   - {path_1}
   - {path_2}

   ---

   {Full verbatim content of first file}

   ---

   {Full verbatim content of second file, if multiple}
   ```
   **CRITICAL**: No summarization, no restructuring. Content is copied exactly as-is. If multiple files, separate with `---`.
3. Register in manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.research.{topic}
   ```
4. Commit: `research({work_unit}): import {topic} research from existing files`
5. Check if any import files are git-tracked:
   ```bash
   git ls-files --error-unmatch {path_1} {path_2} ...
   ```

   **If any files are tracked:**

   > *Output the next fenced block as markdown (not a code block):*

   ```
   · · · · · · · · · · · ·
   The following source files are tracked by git:

   • {tracked_path_1}
   • {tracked_path_2}

   - **`d`/`delete`** — Delete source files and commit cleanup
   - **`k`/`keep`** — Keep source files as they are
   · · · · · · · · · · · ·
   ```

   **STOP.** Wait for user response.

   **If `delete`**: Delete the tracked files and commit: `research({work_unit}): remove imported source files`

   **If `keep`**: Continue without changes.

   **If no files are tracked:** Skip silently.

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
