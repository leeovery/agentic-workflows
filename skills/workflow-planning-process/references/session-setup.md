# Session Setup

*Reference for **[workflow-planning-process](../SKILL.md)***

---

1. Read the `format` from the manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} format
   ```
2. Load the format's **[about.md](output-formats/{format}/about.md)** and **[authoring.md](output-formats/{format}/authoring.md)**
3. Reset gate modes to `gated` in the manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} task_list_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} author_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} finding_gate_mode gated
   ```
4. Update `spec_commit` to current HEAD:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} spec_commit $(git rev-parse HEAD)
   ```

→ Return to **[the skill](../SKILL.md)**.
