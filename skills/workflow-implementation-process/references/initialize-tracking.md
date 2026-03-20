# Initialize Implementation Tracking

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

Check if implementation entry exists in the manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.implementation.{topic}
```

#### If implementation entry exists

→ Return to caller.

#### If implementation entry does not exist

1. Set implementation state via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js init-phase {work_unit}.implementation.{topic}
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} task_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} fix_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} analysis_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} fix_attempts 0
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} analysis_cycle 0
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} linters '[]'
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} project_skills '[]'
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} current_phase 1
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} current_task '~'
   ```

2. Commit: `impl({work_unit}): start implementation`

→ Return to caller.
