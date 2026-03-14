# Initialize Implementation Tracking

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

#### If `.workflows/{work_unit}/implementation/{topic}/implementation.md` already exists

→ Return to **[the skill](../SKILL.md)**.

#### If no implementation file exists

1. Set implementation state via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js init-phase {work_unit}.implementation.{topic}
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} task_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} fix_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} analysis_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} fix_attempts 0
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} analysis_cycle 0
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} linters []
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} project_skills []
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} current_phase 1
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} current_task ~
   ```

2. Create `.workflows/{work_unit}/implementation/{topic}/implementation.md`:

   ```markdown
   # Implementation: {Topic Name}

   Implementation started.
   ```

3. Commit: `impl({work_unit}): start implementation`

→ Return to **[the skill](../SKILL.md)**.
