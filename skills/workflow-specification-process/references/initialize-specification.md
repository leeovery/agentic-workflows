# Initialize Specification

*Reference for **[workflow-specification-process](../SKILL.md)***

---

→ Load **[specification-format.md](specification-format.md)** and follow its instructions as written.

Create the specification file at `.workflows/{work_unit}/specification/{topic}/specification.md`:

1. Use the body template from specification-format.md (title + specification section + working notes section)
2. Register specification and initialize state via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js init-phase {work_unit}.specification.{topic}
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.specification.{topic} review_cycle 0
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.specification.{topic} finding_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.specification.{topic} date $(date +%Y-%m-%d)
   ```
3. Add all sources with `status: pending` via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.specification.{topic} sources.{source-name}.status pending
   ```

Commit: `spec({work_unit}): initialize specification`

→ Return to caller.
